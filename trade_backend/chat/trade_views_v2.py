# -*- coding: utf-8 -*-
"""
Trade and Document Management Views - V2 (AI Server Client)

AI Server HTTP API를 사용하는 스트리밍 전용 View
"""

import asyncio
import json
import logging
import re
from django.http import StreamingHttpResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .ai_client import get_ai_client
from .models import Document, DocMessage
from .utils import get_user_by_id_or_emp_no, get_user_id_int

logger = logging.getLogger(__name__)


def parse_edit_response(text: str) -> dict | None:
    """
    Agent 응답에서 편집 JSON을 파싱

    Returns:
        편집 정보 dict 또는 None (일반 텍스트인 경우)

    Format (fieldId/value based):
    {
        "type": "edit",
        "message": "수정 설명",
        "changes": [
            {"fieldId": "price", "value": "USD 50,000"}
        ]
    }
    """
    # JSON 블록 추출 시도 (```json ... ``` 형식)
    json_match = re.search(r'```json\s*([\s\S]*?)\s*```', text)
    if json_match:
        json_str = json_match.group(1)
    else:
        json_str = text.strip()

    try:
        parsed = json.loads(json_str)
        if isinstance(parsed, dict) and parsed.get('type') == 'edit':
            changes = parsed.get('changes', [])
            normalized_changes = []
            for change in changes:
                if 'fieldId' in change and 'value' in change:
                    normalized_changes.append({
                        'fieldId': change['fieldId'],
                        'value': change['value']
                    })
                elif 'field' in change and 'after' in change:
                    normalized_changes.append({
                        'fieldId': change['field'],
                        'value': change['after']
                    })

            return {
                'type': 'edit',
                'message': parsed.get('message', ''),
                'changes': normalized_changes
            }
    except json.JSONDecodeError:
        pass

    return None


def extract_buyer_from_content(content: str) -> str:
    """문서 내용(HTML)에서 buyer 이름 추출"""
    if not content:
        return None
    text = re.sub(r'<[^>]+>', ' ', content)
    text = re.sub(r'\s+', ' ', text)
    patterns = [
        r'(?:To|Buyer|Messrs\.?)\s*[:\s]+([A-Za-z][\w\s&.,()-]+?)(?:\s*(?:Address|Tel|Fax|Email|Date|From|$))',
        r'(?:To|Buyer)\s*[:\s]+([A-Za-z][\w\s&.,()-]{3,50})',
        r'MESSRS\.?\s+([A-Z][\w\s&.,()-]+?)(?:\s*$|\s+[A-Z]{2,})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            buyer = match.group(1).strip()
            if 2 < len(buyer) < 100:
                buyer = re.sub(r'[\s,;:]+$', '', buyer)
                return buyer
    return None


@method_decorator(csrf_exempt, name='dispatch')
class DocumentChatStreamViewV2(View):
    """
    문서 작성 스트리밍 챗봇 API - V2 (AI Server Client 사용)

    POST /api/documents/chat/stream/
    {
        "doc_id": 1,
        "message": "...",
        "user_id": "emp001",
        "document_content": ""
    }
    """

    def post(self, request):
        try:
            data = json.loads(request.body)
            doc_id = data.get('doc_id') or data.get('document_id')
            user_id = data.get('user_id')
            message = data.get('message')
            document_content = data.get('document_content', '')

            logger.info(f"DocumentChatStreamViewV2: doc_id={doc_id}, user_id={user_id}")
        except json.JSONDecodeError:
            return StreamingHttpResponse(
                f"data: {json.dumps({'type': 'error', 'error': 'Invalid JSON'})}\n\n",
                content_type='text/event-stream'
            )

        if not message:
            return StreamingHttpResponse(
                f"data: {json.dumps({'type': 'error', 'error': 'message 필드가 필요합니다.'})}\n\n",
                content_type='text/event-stream'
            )

        if not doc_id:
            return StreamingHttpResponse(
                f"data: {json.dumps({'type': 'error', 'error': 'doc_id 필드가 필요합니다.'})}\n\n",
                content_type='text/event-stream'
            )

        response = StreamingHttpResponse(
            self.stream_response(doc_id, user_id, message, document_content),
            content_type='text/event-stream'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    def stream_response(self, doc_id, user_id, message, document_content=''):
        """AI Server 스트리밍 응답을 중계"""

        # 1. Document 조회
        try:
            document = Document.objects.get(doc_id=doc_id)
            trade_id = document.trade_id
        except Document.DoesNotExist:
            yield f"data: {json.dumps({'type': 'error', 'error': f'Document를 찾을 수 없습니다: doc_id={doc_id}'})}\n\n"
            return

        yield f"data: {json.dumps({'type': 'init', 'doc_id': doc_id, 'trade_id': trade_id})}\n\n"

        # 2. 사용자 메시지 저장
        user_msg = DocMessage.objects.create(
            doc=document,
            role='user',
            content=message
        )

        # 3. 이전 대화 히스토리 로드
        prev_messages = DocMessage.objects.filter(doc=document).exclude(
            doc_message_id=user_msg.doc_message_id
        ).order_by('created_at')
        message_count = prev_messages.count()
        start_index = max(0, message_count - 10)
        recent_messages = list(prev_messages[start_index:])

        message_history = [
            {"role": "assistant" if msg.role == "agent" else msg.role, "content": msg.content}
            for msg in recent_messages
        ]

        # 4. AI Server 스트리밍 호출
        client = get_ai_client()
        full_response = ""
        tools_used = []

        # user_id 조회 (sync 컨텍스트에서 Django ORM 호출)
        # 반드시 async 함수 밖에서 호출해야 SynchronousOnlyOperation 에러 방지
        user_id_int = get_user_id_int(user_id)

        async def stream_from_ai_server():
            nonlocal full_response, tools_used

            if document.doc_mode == 'upload' and document.upload_status == 'ready':
                # 업로드 모드
                stream = client.document_read_chat_stream(
                    doc_id=doc_id,
                    message=message,
                    document_name=document.original_filename or f"문서_{doc_id}",
                    document_type=document.get_doc_type_display(),
                    history=message_history,
                    user_id=user_id_int
                )
            else:
                # 작성 모드
                stream = client.document_write_chat_stream(
                    doc_id=doc_id,
                    message=message,
                    document_content=document_content,
                    history=message_history,
                    user_id=user_id_int
                )

            async for event in stream:
                event_type = event.get('type')

                if event_type == 'text':
                    content = event.get('content', '')
                    full_response += content
                    yield ('text', content)

                elif event_type == 'tool':
                    tool_info = event.get('tool', {})
                    tools_used.append(tool_info)
                    yield ('tool', tool_info)

                elif event_type == 'edit':
                    yield ('edit', {
                        'message': event.get('message', ''),
                        'changes': event.get('changes', [])
                    })

                elif event_type == 'done':
                    tools_used = event.get('tools_used', tools_used)
                    yield ('done', {'tools_used': tools_used})

                elif event_type == 'error':
                    yield ('error', event.get('error', 'Unknown error'))

        # 비동기 실행
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            async_gen = stream_from_ai_server()
            while True:
                try:
                    event_type, event_data = loop.run_until_complete(async_gen.__anext__())

                    if event_type == 'text':
                        yield f"data: {json.dumps({'type': 'text', 'content': event_data})}\n\n"
                    elif event_type == 'tool':
                        yield f"data: {json.dumps({'type': 'tool', 'tool': event_data})}\n\n"
                    elif event_type == 'edit':
                        yield f"data: {json.dumps({'type': 'edit', 'message': event_data['message'], 'changes': event_data['changes']})}\n\n"
                    elif event_type == 'done':
                        yield f"data: {json.dumps({'type': 'done', 'tools_used': event_data['tools_used']})}\n\n"
                    elif event_type == 'error':
                        yield f"data: {json.dumps({'type': 'error', 'error': event_data})}\n\n"

                except StopAsyncIteration:
                    break
        finally:
            loop.close()

        # 5. 편집 응답인지 확인
        edit_response = None
        if full_response:
            edit_response = parse_edit_response(full_response)
            if edit_response:
                yield f"data: {json.dumps({'type': 'edit', 'message': edit_response['message'], 'changes': edit_response['changes']})}\n\n"

        # 6. AI 응답 저장
        try:
            ai_msg = DocMessage.objects.create(
                doc=document,
                role='agent',
                content=full_response,
                metadata={
                    'tools_used': tools_used,
                    'is_edit': edit_response is not None,
                    'changes_count': len(edit_response.get('changes', [])) if edit_response else 0
                }
            )

            # 메모리 저장 (user_id_int는 이미 sync 컨텍스트에서 조회됨)
            if user_id_int:
                try:
                    buyer_name = extract_buyer_from_content(document_content)
                    asyncio.run(client.memory_save(
                        messages=[
                            {"role": "user", "content": message},
                            {"role": "assistant", "content": full_response}
                        ],
                        user_id=user_id_int,
                        doc_id=doc_id,
                        buyer_name=buyer_name,
                        save_user=True,
                        save_doc=True,
                        save_buyer=bool(buyer_name)
                    ))
                except Exception as mem_error:
                    logger.warning(f"메모리 저장 실패 (무시): {mem_error}")

        except Exception as e:
            logger.error(f"AI 응답 저장 실패: {e}")
