"""
문서 채팅 API

Document Writing Agent / Document Read Agent 엔드포인트 (스트리밍 전용)
메모리 컨텍스트 통합
"""

import json
import re
import logging

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from agents import Runner
from agents.items import ToolCallItem

from schemas.request import DocumentChatRequest, DocumentReadRequest
from agent_runners import get_document_writing_agent, get_read_document_agent
from services.memory import get_memory_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/document", tags=["document"])


# 툴 표시 정보
TOOL_DISPLAY_INFO = {
    'search_user_document': {
        'name': '업로드 문서 검색',
        'icon': 'file-search',
        'description': '업로드한 문서에서 관련 내용을 검색했습니다.'
    },
    'search_trade_documents': {
        'name': '무역 지식 검색',
        'icon': 'document',
        'description': '무역 문서 데이터베이스에서 관련 정보를 검색했습니다.'
    },
    'search_web': {
        'name': '웹 검색',
        'icon': 'web',
        'description': '최신 정보를 위해 웹 검색을 수행했습니다.'
    }
}


def parse_edit_response(text: str) -> dict | None:
    """
    Agent 응답에서 편집 JSON 파싱

    Returns:
        편집 정보 dict 또는 None
    """
    # JSON 블록 추출
    json_match = re.search(r'```json\s*([\s\S]*?)\s*```', text)
    if json_match:
        json_str = json_match.group(1)
    else:
        json_str = text.strip()

    try:
        parsed = json.loads(json_str)
        if isinstance(parsed, dict) and parsed.get('type') == 'edit':
            changes = parsed.get('changes', [])
            normalized = []
            for change in changes:
                if 'fieldId' in change and 'value' in change:
                    normalized.append({
                        'fieldId': change['fieldId'],
                        'value': change['value']
                    })
                elif 'field' in change and 'after' in change:
                    # 레거시 형식 변환
                    normalized.append({
                        'fieldId': change['field'],
                        'value': change['after']
                    })

            return {
                'type': 'edit',
                'message': parsed.get('message', ''),
                'changes': normalized
            }
    except json.JSONDecodeError:
        pass

    return None


# ==================== 메모리 컨텍스트 헬퍼 ====================

def _build_doc_memory_context(doc_id: int, user_id: int, query: str) -> str:
    """문서 채팅용 메모리 컨텍스트 빌드"""
    if not user_id:
        return ""

    memory_service = get_memory_service()
    if not memory_service:
        return ""

    try:
        context = memory_service.build_doc_context(
            doc_id=doc_id,
            user_id=user_id,
            query=query
        )

        parts = []

        # 문서 메모리
        doc_memories = context.get('doc_memories', [])
        if doc_memories:
            doc_texts = [f"- {m.get('memory', '')}" for m in doc_memories if m.get('memory')]
            if doc_texts:
                parts.append("[이전 문서 작업 내역]\n" + "\n".join(doc_texts))

        # 사용자 선호도
        user_memories = context.get('user_memories', [])
        if user_memories:
            user_texts = [f"- {m.get('memory', '')}" for m in user_memories if m.get('memory')]
            if user_texts:
                parts.append("[사용자 선호도]\n" + "\n".join(user_texts))

        # 거래처 메모
        buyer_memories = context.get('buyer_memories', [])
        if buyer_memories:
            buyer_texts = [f"- {m.get('memory', '')}" for m in buyer_memories if m.get('memory')]
            if buyer_texts:
                parts.append("[거래처 메모]\n" + "\n".join(buyer_texts))

        if parts:
            return "\n\n" + "\n\n".join(parts)

    except Exception as e:
        logger.warning(f"문서 메모리 컨텍스트 빌드 실패 (무시): {e}")

    return ""


# ==================== Document Writing ====================

@router.post("/write/chat/stream")
async def document_write_chat_stream(request: DocumentChatRequest):
    """
    문서 작성 스트리밍 채팅 API

    SSE 형식으로 실시간 응답을 스트리밍합니다.
    메모리 컨텍스트를 Agent에 전달합니다.
    """
    logger.info(f"문서 작성 스트리밍: doc_id={request.doc_id}, user_id={request.user_id}, message={request.message[:50]}...")

    async def generate():
        try:
            # 초기화 이벤트
            yield f"data: {json.dumps({'type': 'init', 'doc_id': request.doc_id})}\n\n"

            # 메모리 컨텍스트 조회
            memory_context = _build_doc_memory_context(request.doc_id, request.user_id, request.message)

            # 메모리 컨텍스트를 메시지에 추가
            enhanced_message = request.message
            if memory_context:
                enhanced_message = f"{request.message}{memory_context}"
                logger.info(f"문서 메모리 컨텍스트 추가됨: doc_id={request.doc_id}, user_id={request.user_id}")

            agent = get_document_writing_agent(
                document_content=request.document_content or ""
            )

            tools_used = []
            seen_tools = set()
            full_response = ""

            result = Runner.run_streamed(agent, input=enhanced_message)

            async for event in result.stream_events():
                # 텍스트 스트리밍
                if event.type == "raw_response_event":
                    data = event.data
                    if hasattr(data, 'type') and data.type == 'response.output_text.delta':
                        if hasattr(data, 'delta') and data.delta:
                            full_response += data.delta
                            yield f"data: {json.dumps({'type': 'text', 'content': data.delta})}\n\n"

                # 툴 호출
                elif event.type == "run_item_stream_event":
                    item = event.item
                    if isinstance(item, ToolCallItem):
                        tool_name = None
                        try:
                            tool_name = item.raw_item.name
                        except AttributeError:
                            try:
                                tool_name = item.name
                            except AttributeError:
                                pass

                        if tool_name and tool_name not in seen_tools:
                            seen_tools.add(tool_name)
                            info = TOOL_DISPLAY_INFO.get(tool_name, {
                                'name': tool_name,
                                'icon': 'tool',
                                'description': f'{tool_name} 도구를 사용했습니다.'
                            })
                            tool_data = {'id': tool_name, **info}
                            tools_used.append(tool_data)
                            yield f"data: {json.dumps({'type': 'tool', 'tool': tool_data})}\n\n"

            # 편집 응답 확인
            edit_response = parse_edit_response(full_response)
            if edit_response:
                yield f"data: {json.dumps({'type': 'edit', 'message': edit_response['message'], 'changes': edit_response['changes']})}\n\n"

            # 완료
            yield f"data: {json.dumps({'type': 'done', 'tools_used': tools_used})}\n\n"

        except Exception as e:
            logger.error(f"문서 작성 스트리밍 오류: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


# ==================== Document Read ====================

@router.post("/read/chat/stream")
async def document_read_chat_stream(request: DocumentReadRequest):
    """
    업로드 문서 읽기 스트리밍 채팅 API

    SSE 형식으로 실시간 응답을 스트리밍합니다.
    메모리 컨텍스트를 Agent에 전달합니다.
    """
    logger.info(f"문서 읽기 스트리밍: doc_id={request.doc_id}, user_id={request.user_id}, message={request.message[:50]}...")

    async def generate():
        try:
            # 초기화 이벤트
            yield f"data: {json.dumps({'type': 'init', 'doc_id': request.doc_id})}\n\n"

            # 메모리 컨텍스트 조회
            memory_context = _build_doc_memory_context(request.doc_id, request.user_id, request.message)

            # 메모리 컨텍스트를 메시지에 추가
            enhanced_message = request.message
            if memory_context:
                enhanced_message = f"{request.message}{memory_context}"
                logger.info(f"문서 메모리 컨텍스트 추가됨: doc_id={request.doc_id}, user_id={request.user_id}")

            agent = get_read_document_agent(
                document_id=request.doc_id,
                document_name=request.document_name or f"문서_{request.doc_id}",
                document_type=request.document_type or "unknown"
            )

            tools_used = []
            seen_tools = set()

            result = Runner.run_streamed(agent, input=enhanced_message)

            async for event in result.stream_events():
                # 텍스트 스트리밍
                if event.type == "raw_response_event":
                    data = event.data
                    if hasattr(data, 'type') and data.type == 'response.output_text.delta':
                        if hasattr(data, 'delta') and data.delta:
                            yield f"data: {json.dumps({'type': 'text', 'content': data.delta})}\n\n"

                # 툴 호출
                elif event.type == "run_item_stream_event":
                    item = event.item
                    if isinstance(item, ToolCallItem):
                        tool_name = None
                        try:
                            tool_name = item.raw_item.name
                        except AttributeError:
                            try:
                                tool_name = item.name
                            except AttributeError:
                                pass

                        if tool_name and tool_name not in seen_tools:
                            seen_tools.add(tool_name)
                            info = TOOL_DISPLAY_INFO.get(tool_name, {
                                'name': tool_name,
                                'icon': 'tool',
                                'description': f'{tool_name} 도구를 사용했습니다.'
                            })
                            tool_data = {'id': tool_name, **info}
                            tools_used.append(tool_data)
                            yield f"data: {json.dumps({'type': 'tool', 'tool': tool_data})}\n\n"

            # 완료
            yield f"data: {json.dumps({'type': 'done', 'tools_used': tools_used})}\n\n"

        except Exception as e:
            logger.error(f"문서 읽기 스트리밍 오류: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )
