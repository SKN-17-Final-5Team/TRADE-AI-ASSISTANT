"""
무역 채팅 API

Trade Agent를 사용한 무역 상담 엔드포인트 (스트리밍 전용)
"""

import json
import logging

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from agents import Runner
from agents.items import ToolCallItem

from schemas.request import TradeChatRequest
from agent_runners import get_trade_agent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trade", tags=["trade"])


# 툴 표시 정보
TOOL_DISPLAY_INFO = {
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


@router.post("/chat/stream")
async def trade_chat_stream(request: TradeChatRequest):
    """
    무역 채팅 스트리밍 API

    SSE 형식으로 실시간 응답을 스트리밍합니다.
    """
    logger.info(f"무역 채팅 스트리밍 요청: message={request.message[:50]}...")

    async def generate():
        try:
            agent = get_trade_agent()
            tools_used = []
            seen_tools = set()

            result = Runner.run_streamed(agent, input=request.message)

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
            logger.error(f"무역 채팅 스트리밍 오류: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )
