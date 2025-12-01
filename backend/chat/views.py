import asyncio
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from agents import Runner
from agents.items import ToolCallItem
from agent_core.trade_agent import trade_agent


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
                Runner.run(trade_agent, input=full_input)
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
