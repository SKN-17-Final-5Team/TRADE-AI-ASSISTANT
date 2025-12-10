"""
문서 채팅 API

Document Writing Agent / Document Read Agent 엔드포인트
"""

import json
import re
import logging

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from agents import Runner
from agents.items import ToolCallItem

from schemas.request import (
    DocumentChatRequest,
    DocumentChatStreamRequest,
    DocumentReadRequest,
    DocumentReadStreamRequest,
)
from schemas.response import (
    DocumentChatResponse,
    DocumentReadResponse,
    ToolUsedInfo,
    EditChange,
)
from agent_runners import get_document_writing_agent, get_read_document_agent

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


def extract_tools_used(result) -> list[ToolUsedInfo]:
    """Agent 실행 결과에서 사용된 툴 정보 추출"""
    tools_used = []
    seen_tools = set()

    for item in result.new_items:
        if isinstance(item, ToolCallItem):
            tool_name = None
            try:
                tool_name = item.raw_item.name
            except AttributeError:
                try:
                    tool_name = item.tool_call.function.name
                except AttributeError:
                    continue

            if tool_name and tool_name not in seen_tools:
                seen_tools.add(tool_name)
                info = TOOL_DISPLAY_INFO.get(tool_name, {
                    'name': tool_name,
                    'icon': 'tool',
                    'description': f'{tool_name} 도구를 사용했습니다.'
                })
                tools_used.append(ToolUsedInfo(id=tool_name, **info))

    return tools_used


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


# ==================== Document Writing ====================

@router.post("/write/chat", response_model=DocumentChatResponse)
async def document_write_chat(request: DocumentChatRequest):
    """
    문서 작성 채팅 API (비스트리밍)

    문서 편집/작성을 지원합니다.
    """
    logger.info(f"문서 작성 채팅: doc_id={request.doc_id}, message={request.message[:50]}...")

    try:
        agent = get_document_writing_agent(
            document_content=request.document_content or ""
        )
        result = await Runner.run(agent, input=request.message)

        tools_used = extract_tools_used(result)
        edit_response = parse_edit_response(result.final_output)

        return DocumentChatResponse(
            doc_id=request.doc_id,
            message=result.final_output,
            tools_used=tools_used,
            is_edit=edit_response is not None,
            changes=[EditChange(**c) for c in edit_response['changes']] if edit_response else None
        )

    except Exception as e:
        logger.error(f"문서 작성 채팅 오류: {e}")
        raise


@router.post("/write/chat/stream")
async def document_write_chat_stream(request: DocumentChatStreamRequest):
    """
    문서 작성 스트리밍 채팅 API

    SSE 형식으로 실시간 응답을 스트리밍합니다.
    """
    logger.info(f"문서 작성 스트리밍: doc_id={request.doc_id}, message={request.message[:50]}...")

    async def generate():
        try:
            # 초기화 이벤트
            yield f"data: {json.dumps({'type': 'init', 'doc_id': request.doc_id})}\n\n"

            agent = get_document_writing_agent(
                document_content=request.document_content or ""
            )

            tools_used = []
            seen_tools = set()
            full_response = ""

            result = Runner.run_streamed(agent, input=request.message)

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

@router.post("/read/chat", response_model=DocumentReadResponse)
async def document_read_chat(request: DocumentReadRequest):
    """
    업로드 문서 읽기 채팅 API (비스트리밍)

    업로드된 문서에 대한 질의응답을 지원합니다.
    """
    logger.info(f"문서 읽기 채팅: doc_id={request.doc_id}, message={request.message[:50]}...")

    try:
        agent = get_read_document_agent(
            document_id=request.doc_id,
            document_name=request.document_name or f"문서_{request.doc_id}",
            document_type=request.document_type or "unknown"
        )
        result = await Runner.run(agent, input=request.message)

        tools_used = extract_tools_used(result)

        return DocumentReadResponse(
            doc_id=request.doc_id,
            message=result.final_output,
            tools_used=tools_used
        )

    except Exception as e:
        logger.error(f"문서 읽기 채팅 오류: {e}")
        raise


@router.post("/read/chat/stream")
async def document_read_chat_stream(request: DocumentReadStreamRequest):
    """
    업로드 문서 읽기 스트리밍 채팅 API

    SSE 형식으로 실시간 응답을 스트리밍합니다.
    """
    logger.info(f"문서 읽기 스트리밍: doc_id={request.doc_id}, message={request.message[:50]}...")

    async def generate():
        try:
            # 초기화 이벤트
            yield f"data: {json.dumps({'type': 'init', 'doc_id': request.doc_id})}\n\n"

            agent = get_read_document_agent(
                document_id=request.doc_id,
                document_name=request.document_name or f"문서_{request.doc_id}",
                document_type=request.document_type or "unknown"
            )

            tools_used = []
            seen_tools = set()
            full_response = ""

            result = Runner.run_streamed(agent, input=request.message)

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
