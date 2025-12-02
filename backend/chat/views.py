import asyncio
import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import StreamingHttpResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from agents import Runner
from agents.items import ToolCallItem
from agent_core.trade_agent import get_trade_agent


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
            # ToolCallItem의 실제 속성 확인
            # raw_item.name 또는 tool_call 내부에서 이름 추출
            try:
                # OpenAI Agents SDK의 ToolCallItem 구조에 맞게 접근
                tool_name = item.raw_item.name
            except AttributeError:
                try:
                    tool_name = item.tool_call.function.name
                except AttributeError:
                    # 디버깅: 실제 속성 출력
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


class ChatView(APIView):
    """
    채팅 API 엔드포인트

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
            # 문서 컨텍스트가 있으면 메시지에 포함
            if document:
                full_input = f"[현재 문서 내용]\n{document}\n\n[사용자 질문]\n{message}"
            else:
                full_input = message

            # Agent 실행 (비동기 → 동기 변환)
            result = asyncio.run(
                Runner.run(get_trade_agent(), input=full_input)
            )

            # 사용된 툴 정보 추출
            tools_used = extract_tools_used(result)

            return Response({
                'message': result.final_output,
                'tools_used': tools_used,
                'html': None,
                'changes': []
            })

        except Exception as e:
            import traceback
            traceback.print_exc()  # 터미널에 전체 에러 출력
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
    """

    def post(self, request):
        try:
            data = json.loads(request.body)
            message = data.get('message')
            document = data.get('document', '')
        except json.JSONDecodeError:
            return StreamingHttpResponse(
                f"data: {json.dumps({'error': 'Invalid JSON'})}\n\n",
                content_type='text/event-stream'
            )

        if not message:
            return StreamingHttpResponse(
                f"data: {json.dumps({'error': '메시지가 필요합니다.'})}\n\n",
                content_type='text/event-stream'
            )

        # 문서 컨텍스트가 있으면 메시지에 포함
        if document:
            full_input = f"[현재 문서 내용]\n{document}\n\n[사용자 질문]\n{message}"
        else:
            full_input = message

        response = StreamingHttpResponse(
            self.stream_response(full_input),
            content_type='text/event-stream'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    def stream_response(self, full_input):
        """
        Agent 스트리밍 응답 생성기
        """
        async def run_stream():
            tools_used = []
            seen_tools = set()

            try:
                result = Runner.run_streamed(get_trade_agent(), input=full_input)

                async for event in result.stream_events():
                    # 텍스트 델타 이벤트 처리
                    if event.type == "raw_response_event":
                        data = event.data

                        # ResponseTextDeltaEvent만 처리 (도구 호출 인자 제외)
                        if hasattr(data, 'type') and data.type == 'response.output_text.delta':
                            if hasattr(data, 'delta') and data.delta:
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
