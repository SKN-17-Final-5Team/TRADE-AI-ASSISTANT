"""
Chat Views - AI Server Client 사용

스트리밍 전용:
- ChatStreamView → AI Server Client 사용
- GenChatDeleteView → DB 삭제
"""

import asyncio
import json
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import StreamingHttpResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .ai_client import get_ai_client
from .models import User, GenChat, GenMessage, Department
from .memory_service import get_memory_service

logger = logging.getLogger(__name__)


def get_or_create_user(user_id):
    """user_id(숫자) 또는 emp_no(사원번호)로 사용자 조회 또는 생성"""
    if user_id is None:
        return None
    try:
        # 먼저 emp_no로 조회 시도
        try:
            return User.objects.get(emp_no=str(user_id))
        except User.DoesNotExist:
            pass

        # emp_no로 못 찾으면 user_id(정수)로 조회
        if isinstance(user_id, int) or (isinstance(user_id, str) and user_id.isdigit()):
            try:
                return User.objects.get(user_id=int(user_id))
            except User.DoesNotExist:
                pass

        # 사용자가 없으면 자동 생성 (개발/테스트용)
        default_dept, _ = Department.objects.get_or_create(
            dept_name="Default",
            defaults={"dept_name": "Default"}
        )
        user = User.objects.create(
            emp_no=str(user_id),
            name=f"User_{user_id}",
            password="temp_password",
            dept=default_dept
        )
        logger.info(f"새 사용자 자동 생성: emp_no={user_id}, user_id={user.user_id}")
        return user

    except Exception as e:
        logger.error(f"사용자 조회/생성 실패: {e}")
        return None


@method_decorator(csrf_exempt, name='dispatch')
class ChatStreamView(View):
    """
    스트리밍 채팅 API 엔드포인트 (Server-Sent Events) - AI Server Client 사용

    POST /api/chat/stream/
    {
        "message": "사용자 메시지",
        "user_id": "emp001",     # 선택: 메모리 기능에 사용
        "gen_chat_id": 1         # 선택: 기존 채팅 세션 ID
    }
    """

    def post(self, request):
        try:
            data = json.loads(request.body)
            message = data.get('message')
            user_id = data.get('user_id')
            gen_chat_id = data.get('gen_chat_id')
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
            self.stream_response(message, user_id, gen_chat_id),
            content_type='text/event-stream'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    def stream_response(self, message: str, user_id=None, gen_chat_id=None):
        """AI Server 스트리밍 응답 중계 + DB 저장"""

        # 1. 사용자 및 채팅 세션 관리
        user = None
        gen_chat = None
        user_msg = None

        if user_id:
            user = get_or_create_user(user_id)
            if user:
                if gen_chat_id:
                    try:
                        gen_chat = GenChat.objects.get(gen_chat_id=gen_chat_id)
                    except GenChat.DoesNotExist:
                        gen_chat = GenChat.objects.create(user=user, title="일반 채팅")
                else:
                    gen_chat = GenChat.objects.create(user=user, title="일반 채팅")

                user_msg = GenMessage.objects.create(
                    gen_chat=gen_chat,
                    sender_type='U',
                    content=message
                )

        # 2. 이전 대화 히스토리 로드
        message_history = []
        if gen_chat and user_msg:
            prev_messages = GenMessage.objects.filter(gen_chat=gen_chat).exclude(
                gen_message_id=user_msg.gen_message_id
            ).order_by('created_at')
            message_count = prev_messages.count()
            start_index = max(0, message_count - 10)
            recent_messages = list(prev_messages[start_index:])
            message_history = [
                {"role": "user" if msg.sender_type == 'U' else "assistant", "content": msg.content}
                for msg in recent_messages
            ]

        # gen_chat_id 전송
        gen_chat_id_to_send = gen_chat.gen_chat_id if gen_chat else None
        if gen_chat_id_to_send:
            yield f"data: {json.dumps({'type': 'init', 'gen_chat_id': gen_chat_id_to_send})}\n\n"

        # 3. AI Server 스트리밍 호출
        client = get_ai_client()
        full_response = ""
        tools_used = []

        async def stream_from_ai_server():
            nonlocal full_response, tools_used

            async for event in client.trade_chat_stream(
                message=message,
                user_id=user.user_id if user else 0,
                context="",
                history=message_history
            ):
                event_type = event.get('type')

                if event_type == 'text':
                    content = event.get('content', '')
                    full_response += content
                    yield ('text', content)

                elif event_type == 'tool':
                    tool_info = event.get('tool', {})
                    tools_used.append(tool_info)
                    yield ('tool', tool_info)

                elif event_type == 'done':
                    tools_used_final = event.get('tools_used', tools_used)
                    yield ('done', {'tools_used': tools_used_final})

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
                    elif event_type == 'done':
                        yield f"data: {json.dumps({'type': 'done', 'tools_used': event_data['tools_used']})}\n\n"
                    elif event_type == 'error':
                        yield f"data: {json.dumps({'type': 'error', 'error': event_data})}\n\n"

                except StopAsyncIteration:
                    break
        finally:
            loop.close()

        # 4. AI 응답 저장
        if gen_chat and full_response:
            try:
                GenMessage.objects.create(
                    gen_chat=gen_chat,
                    sender_type='A',
                    content=full_response
                )
            except Exception as e:
                logger.error(f"AI 응답 저장 실패: {e}")


class GenChatDeleteView(APIView):
    """
    일반 채팅 삭제 API (Mem0 메모리도 함께 삭제)

    DELETE /api/chat/general/<gen_chat_id>/
    """

    def delete(self, request, gen_chat_id):
        try:
            gen_chat = GenChat.objects.get(gen_chat_id=gen_chat_id)

            # Mem0 단기 메모리 삭제
            try:
                memory_service = get_memory_service()
                if memory_service:
                    memory_service.delete_gen_chat_memory(gen_chat_id)
                    logger.info(f"✅ Mem0 메모리 삭제 완료: gen_chat_id={gen_chat_id}")
            except Exception as mem_err:
                logger.warning(f"⚠️ Mem0 메모리 삭제 실패 (계속 진행): {mem_err}")

            # DB에서 채팅 삭제
            gen_chat.delete()
            logger.info(f"✅ GenChat 삭제 완료: gen_chat_id={gen_chat_id}")

            return Response({"message": "삭제 완료"}, status=status.HTTP_200_OK)

        except GenChat.DoesNotExist:
            return Response(
                {"error": "채팅을 찾을 수 없습니다."},
                status=status.HTTP_404_NOT_FOUND
            )
