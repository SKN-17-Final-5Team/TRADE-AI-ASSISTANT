import asyncio
import json
import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import StreamingHttpResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from agents import Runner
from agents.items import ToolCallItem
from agent_core import get_trade_agent, get_document_writing_agent
from .config import PROMPT_VERSION, PROMPT_LABEL, USE_LANGFUSE


# 툴 이름 → 표시 정보 매핑
TOOL_DISPLAY_INFO = {
    'search_trade_documents': {
        'name': '문서 검색',
        'icon': 'document',
        'description': '무역 문서 데이터베이스에서 관련 정보를 검색했습니다.'
    },
    'search_web': {
        'name': '웹 검색',
        'icon': 'web',
        'description': '최신 정보를 위해 웹 검색을 수행했습니다.'
    }
}


def extract_tools_used(result) -> list:
    """
    Agent 실행 결과에서 사용된 툴 정보 추출
    """
    tools_used = []
    seen_tools = set()

    for item in result.new_items:
        if isinstance(item, ToolCallItem):
            try:
                tool_name = item.raw_item.name
            except AttributeError:
                try:
                    tool_name = item.tool_call.function.name
                except AttributeError:
                    print(f"ToolCallItem attributes: {dir(item)}")
                    print(f"ToolCallItem: {item}")
                    continue

            if tool_name not in seen_tools:
                seen_tools.add(tool_name)
                tool_info = TOOL_DISPLAY_INFO.get(tool_name, {
                    'name': tool_name,
                    'icon': 'tool',
                    'description': f'{tool_name} 도구를 사용했습니다.'
                })
                tools_used.append({
                    'id': tool_name,
                    **tool_info
                })

    return tools_used


def parse_edit_response(text: str) -> dict | None:
    """
    Agent 응답에서 편집 JSON을 파싱

    Returns:
        편집 정보 dict 또는 None (일반 텍스트인 경우)
    """
    # JSON 블록 추출 시도 (```json ... ``` 형식)
    json_match = re.search(r'```json\s*([\s\S]*?)\s*```', text)
    if json_match:
        json_str = json_match.group(1)
    else:
        # 전체 텍스트가 JSON인지 확인
        json_str = text.strip()

    try:
        parsed = json.loads(json_str)
        if isinstance(parsed, dict) and parsed.get('type') == 'edit':
            return {
                'type': 'edit',
                'message': parsed.get('message', ''),
                'html': parsed.get('html', ''),
                'changes': parsed.get('changes', [])
            }
    except json.JSONDecodeError:
        pass

    return None


class ChatView(APIView):
    """
    채팅 API 엔드포인트 (비스트리밍)

    POST /api/chat/
    {
        "message": "사용자 메시지",
        "document": "문서 내용 (선택)"
    }
    """

    def post(self, request):
        message = request.data.get('message')
        document = request.data.get('document', '')

        if not message:
            return Response(
                {'error': '메시지가 필요합니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 문서가 있으면 document_writing_agent, 없으면 trade_agent
            if document:
                agent = get_document_writing_agent(
                    document_content=document,
                    use_langfuse=USE_LANGFUSE,
                    prompt_version=PROMPT_VERSION,
                    prompt_label=PROMPT_LABEL
                )
                full_input = message  # 문서는 이미 프롬프트에 포함됨
            else:
                agent = get_trade_agent(
                    use_langfuse=USE_LANGFUSE,
                    prompt_version=PROMPT_VERSION,
                    prompt_label=PROMPT_LABEL
                )
                full_input = message

            # Agent 실행
            result = asyncio.run(Runner.run(agent, input=full_input))

            # 사용된 툴 정보 추출
            tools_used = extract_tools_used(result)

            # 편집 응답인지 확인
            edit_response = parse_edit_response(result.final_output)

            if edit_response:
                return Response({
                    'type': 'edit',
                    'message': edit_response['message'],
                    'html': edit_response['html'],
                    'changes': edit_response['changes'],
                    'tools_used': tools_used
                })
            else:
                return Response({
                    'type': 'chat',
                    'message': result.final_output,
                    'html': None,
                    'changes': [],
                    'tools_used': tools_used
                })

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {'error': f'에이전트 실행 오류: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@method_decorator(csrf_exempt, name='dispatch')
class ChatStreamView(View):
    """
    스트리밍 채팅 API 엔드포인트 (Server-Sent Events)

    POST /api/chat/stream/
    {
        "message": "사용자 메시지",
        "document": "문서 내용 (선택)"
    }

    문서가 있으면 document_writing_agent 사용 (수정 기능 포함)
    """

    def post(self, request):
        try:
            data = json.loads(request.body)
            message = data.get('message')
            document = data.get('document', '')
        except json.JSONDecodeError:
            return StreamingHttpResponse(
                f"data: {json.dumps({'type': 'error', 'error': 'Invalid JSON'})}\n\n",
                content_type='text/event-stream'
            )

        if not message:
            return StreamingHttpResponse(
                f"data: {json.dumps({'type': 'error', 'error': '메시지가 필요합니다.'})}\n\n",
                content_type='text/event-stream'
            )

        response = StreamingHttpResponse(
            self.stream_response(message, document),
            content_type='text/event-stream'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    def stream_response(self, message: str, document: str):
        """
        Agent 스트리밍 응답 생성기
        """
        async def run_stream():
            tools_used = []
            seen_tools = set()
            full_response = ""  # 전체 응답 수집 (편집 JSON 파싱용)

            try:
                # 문서가 있으면 document_writing_agent, 없으면 trade_agent
                if document:
                    agent = get_document_writing_agent(
                        document_content=document,
                        use_langfuse=USE_LANGFUSE,
                        prompt_version=PROMPT_VERSION,
                        prompt_label=PROMPT_LABEL
                    )
                    full_input = message
                else:
                    agent = get_trade_agent(
                        use_langfuse=USE_LANGFUSE,
                        prompt_version=PROMPT_VERSION,
                        prompt_label=PROMPT_LABEL
                    )
                    full_input = message

                result = Runner.run_streamed(agent, input=full_input)

                async for event in result.stream_events():
                    # 텍스트 델타 이벤트 처리
                    if event.type == "raw_response_event":
                        data = event.data

                        if hasattr(data, 'type') and data.type == 'response.output_text.delta':
                            if hasattr(data, 'delta') and data.delta:
                                full_response += data.delta
                                yield f"data: {json.dumps({'type': 'text', 'content': data.delta})}\n\n"

                    # 툴 호출 이벤트
                    elif event.type == "run_item_stream_event":
                        item = event.item
                        if isinstance(item, ToolCallItem):
                            try:
                                tool_name = item.raw_item.name
                            except AttributeError:
                                try:
                                    tool_name = getattr(item, 'name', None)
                                except:
                                    continue

                            if tool_name and tool_name not in seen_tools:
                                seen_tools.add(tool_name)
                                tool_info = TOOL_DISPLAY_INFO.get(tool_name, {
                                    'name': tool_name,
                                    'icon': 'tool',
                                    'description': f'{tool_name} 도구를 사용했습니다.'
                                })
                                tool_data = {'id': tool_name, **tool_info}
                                tools_used.append(tool_data)
                                yield f"data: {json.dumps({'type': 'tool', 'tool': tool_data})}\n\n"

                # 스트리밍 완료 후 편집 응답인지 확인
                print(f"[DEBUG] full_response 길이: {len(full_response)}")
                print(f"[DEBUG] full_response 앞 500자: {full_response[:500]}")
                edit_response = parse_edit_response(full_response)
                print(f"[DEBUG] edit_response: {edit_response}")

                if edit_response:
                    # 편집 응답이면 edit 이벤트 전송
                    yield f"data: {json.dumps({'type': 'edit', 'message': edit_response['message'], 'html': edit_response['html'], 'changes': edit_response['changes']})}\n\n"

                # 완료 이벤트
                yield f"data: {json.dumps({'type': 'done', 'tools_used': tools_used})}\n\n"

            except Exception as e:
                import traceback
                traceback.print_exc()
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

        # 비동기 제너레이터를 동기로 변환
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            async_gen = run_stream()
            while True:
                try:
                    chunk = loop.run_until_complete(async_gen.__anext__())
                    yield chunk
                except StopAsyncIteration:
                    break
        finally:
            loop.close()
