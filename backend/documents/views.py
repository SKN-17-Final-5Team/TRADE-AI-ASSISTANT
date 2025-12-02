"""
Document Upload and Management Views
"""

import asyncio
import json
import time
import logging
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import StreamingHttpResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from agents import Runner
from agents.items import ToolCallItem

from .models import UserDocument, DocumentChatSession, DocumentChatMessage
from .serializers import (
    UserDocumentSerializer,
    PresignedUploadRequestSerializer,
    PresignedUploadResponseSerializer,
    UploadCompleteRequestSerializer,
    DocumentChatSessionSerializer,
    DocumentChatRequestSerializer,
    DocumentChatResponseSerializer,
)
from agent_core.s3_utils import s3_manager
from agent_core import get_read_document_agent
from chat.config import PROMPT_VERSION, PROMPT_LABEL, USE_LANGFUSE

logger = logging.getLogger(__name__)


# 툴 이름 → 표시 정보 매핑
TOOL_DISPLAY_INFO = {
    'search_user_document': {
        'name': '문서 검색',
        'icon': 'document',
        'description': '현재 문서에서 관련 내용을 검색했습니다.'
    },
    'search_trade_documents': {
        'name': '무역 지식 검색',
        'icon': 'database',
        'description': '무역 문서 데이터베이스에서 관련 정보를 검색했습니다.'
    },
    'search_web': {
        'name': '웹 검색',
        'icon': 'web',
        'description': '최신 정보를 위해 웹 검색을 수행했습니다.'
    }
}


def extract_tools_used(result) -> list:
    """Agent 실행 결과에서 사용된 툴 정보 추출"""
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


class DocumentUploadView(APIView):
    """
    문서 업로드를 위한 Presigned URL 생성
    """

    def post(self, request):
        """
        Presigned URL 생성

        Request Body:
        {
            "document_type": "offer_sheet" | "sales_contract",
            "filename": "example.pdf",
            "file_size": 102400,
            "mime_type": "application/pdf"
        }

        Response:
        {
            "document_id": 1,
            "upload_url": "https://s3.amazonaws.com/...",
            "s3_key": "documents/uuid-filename.pdf",
            "expires_in": 3600
        }
        """
        serializer = PresignedUploadRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        document_type = data['document_type']
        filename = data['filename']
        file_size = data['file_size']
        mime_type = data['mime_type']

        try:
            # 1. Presigned URL 생성
            presigned_data = s3_manager.generate_presigned_upload_url(
                file_name=filename,
                file_type=mime_type,
                expiration=3600  # 1시간
            )

            # 2. UserDocument 레코드 생성 (status: uploading)
            document = UserDocument.objects.create(
                document_type=document_type,
                original_filename=filename,
                s3_key=presigned_data['s3_key'],
                s3_url=presigned_data['file_url'],
                file_size=file_size,
                mime_type=mime_type,
                status='uploading'
            )

            logger.info(f"Created document {document.id} for upload: {filename}")

            # 3. 응답
            response_serializer = PresignedUploadResponseSerializer(data={
                'document_id': document.id,
                'upload_url': presigned_data['upload_url'],
                's3_key': presigned_data['s3_key'],
                'expires_in': 3600
            })
            response_serializer.is_valid(raise_exception=True)

            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            return Response(
                {'error': 'Failed to generate upload URL', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DocumentUploadCompleteView(APIView):
    """
    업로드 완료 후 호출되는 Webhook

    클라이언트가 S3에 직접 업로드 완료 후 이 API를 호출하면
    백엔드가 PDF 파싱 → 임베딩 생성 → Qdrant 저장을 수행합니다.
    """

    def post(self, request):
        """
        업로드 완료 알림

        Request Body:
        {
            "document_id": 1,
            "s3_key": "documents/uuid-filename.pdf"
        }

        Response:
        {
            "status": "processing",
            "document_id": 1,
            "message": "Document processing started"
        }
        """
        serializer = UploadCompleteRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document_id = serializer.validated_data['document_id']
        s3_key = serializer.validated_data['s3_key']

        try:
            # 1. 문서 조회
            document = UserDocument.objects.get(id=document_id, s3_key=s3_key)

            if document.status != 'uploading':
                return Response(
                    {'error': f'Document is already {document.status}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 2. 상태 업데이트: processing
            document.status = 'processing'
            document.save()

            # 3. 비동기로 PDF 처리 시작 (향후 Celery 등으로 대체 가능)
            # 지금은 동기적으로 처리
            from documents.services import process_uploaded_document
            process_uploaded_document(document.id)

            logger.info(f"Started processing document {document.id}")

            return Response({
                'status': 'processing',
                'document_id': document.id,
                'message': 'Document processing started'
            }, status=status.HTTP_202_ACCEPTED)

        except UserDocument.DoesNotExist:
            return Response(
                {'error': 'Document not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Failed to start document processing: {e}")
            return Response(
                {'error': 'Failed to process document', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserDocumentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    사용자 문서 조회 ViewSet
    """

    queryset = UserDocument.objects.all()
    serializer_class = UserDocumentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # 필터링: document_type
        document_type = self.request.query_params.get('document_type')
        if document_type:
            queryset = queryset.filter(document_type=document_type)

        # 필터링: status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset

    @action(detail=True, methods=['get'])
    def refresh_url(self, request, pk=None):
        """
        S3 Presigned URL 갱신

        GET /api/documents/{id}/refresh_url/
        """
        document = self.get_object()

        try:
            new_url = s3_manager.generate_presigned_download_url(
                s3_key=document.s3_key,
                expiration=3600 * 24  # 24시간
            )

            document.s3_url = new_url
            document.save()

            return Response({
                's3_url': new_url,
                'expires_in': 3600 * 24
            })

        except Exception as e:
            logger.error(f"Failed to refresh URL for document {pk}: {e}")
            return Response(
                {'error': 'Failed to refresh URL', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DocumentChatSessionViewSet(viewsets.ModelViewSet):
    """
    문서 채팅 세션 ViewSet
    """

    queryset = DocumentChatSession.objects.all()
    serializer_class = DocumentChatSessionSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # 필터링: document_id
        document_id = self.request.query_params.get('document_id')
        if document_id:
            queryset = queryset.filter(document_id=document_id)

        return queryset


class DocumentChatView(APIView):
    """
    문서 기반 채팅 API

    POST /api/documents/chat/
    {
        "document_id": 1,
        "message": "이 계약서의 가격은?",
        "session_id": 123  (optional, 없으면 새로 생성)
    }
    """

    def post(self, request):
        serializer = DocumentChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document_id = serializer.validated_data['document_id']
        message = serializer.validated_data['message']
        session_id = serializer.validated_data.get('session_id')

        try:
            # 1. 문서 조회
            document = UserDocument.objects.get(id=document_id)

            if document.status != 'ready':
                return Response(
                    {'error': f'문서가 아직 준비되지 않았습니다 (현재 상태: {document.status})'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 2. 세션 조회 또는 생성
            if session_id:
                try:
                    session = DocumentChatSession.objects.get(id=session_id, document_id=document_id)
                except DocumentChatSession.DoesNotExist:
                    return Response(
                        {'error': '세션을 찾을 수 없습니다'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            else:
                session = DocumentChatSession.objects.create(document=document)

            # 3. 사용자 메시지 저장
            user_message = DocumentChatMessage.objects.create(
                session=session,
                role='user',
                content=message
            )

            # 4. Agent 생성 및 실행
            agent = get_read_document_agent(
                document_id=document.id,
                document_name=document.original_filename,
                document_type=document.get_document_type_display(),
                use_langfuse=USE_LANGFUSE,
                prompt_version=PROMPT_VERSION,
                prompt_label=PROMPT_LABEL
            )

            result = asyncio.run(
                Runner.run(agent, input=message)
            )

            # 5. 사용된 툴 추출
            tools_used = extract_tools_used(result)

            # 6. AI 응답 저장
            ai_message = DocumentChatMessage.objects.create(
                session=session,
                role='assistant',
                content=result.final_output,
                metadata={'tools_used': [tool['id'] for tool in tools_used]}
            )

            logger.info(
                f"Document chat completed: document_id={document_id}, "
                f"session_id={session.id}, tools={[t['id'] for t in tools_used]}"
            )

            # 7. 응답
            return Response({
                'session_id': session.id,
                'message': result.final_output,
                'tools_used': tools_used
            })

        except UserDocument.DoesNotExist:
            return Response(
                {'error': '문서를 찾을 수 없습니다'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Document chat error: {e}")
            return Response(
                {'error': f'채팅 처리 중 오류가 발생했습니다: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@method_decorator(csrf_exempt, name='dispatch')
class DocumentChatStreamView(View):
    """
    문서 기반 스트리밍 채팅 API (Server-Sent Events)

    POST /api/documents/chat/stream/
    {
        "document_id": 1,
        "message": "이 계약서의 가격은?",
        "session_id": 123  (optional)
    }
    """

    def post(self, request):
        try:
            data = json.loads(request.body)
            document_id = data.get('document_id')
            message = data.get('message')
            session_id = data.get('session_id')
        except json.JSONDecodeError:
            return StreamingHttpResponse(
                f"data: {json.dumps({'type': 'error', 'error': 'Invalid JSON'})}\n\n",
                content_type='text/event-stream'
            )

        if not document_id or not message:
            return StreamingHttpResponse(
                f"data: {json.dumps({'type': 'error', 'error': '문서 ID와 메시지가 필요합니다.'})}\n\n",
                content_type='text/event-stream'
            )

        response = StreamingHttpResponse(
            self.stream_response(document_id, message, session_id),
            content_type='text/event-stream'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    def stream_response(self, document_id, message, session_id):
        """문서 Agent 스트리밍 응답 생성기"""

        # 1. 동기 ORM 호출 (비동기 컨텍스트 밖에서 처리)
        try:
            document = UserDocument.objects.get(id=document_id)
        except UserDocument.DoesNotExist:
            yield f"data: {json.dumps({'type': 'error', 'error': '문서를 찾을 수 없습니다'})}\n\n"
            return

        if document.status != 'ready':
            yield f"data: {json.dumps({'type': 'error', 'error': f'문서가 아직 준비되지 않았습니다 (현재 상태: {document.status})'})}\n\n"
            return

        # 2. 세션 조회 또는 생성
        if session_id:
            try:
                session = DocumentChatSession.objects.get(id=session_id, document_id=document_id)
            except DocumentChatSession.DoesNotExist:
                yield f"data: {json.dumps({'type': 'error', 'error': '세션을 찾을 수 없습니다'})}\n\n"
                return
        else:
            session = DocumentChatSession.objects.create(document=document)

        # 세션 ID 먼저 전송
        yield f"data: {json.dumps({'type': 'session', 'session_id': session.id})}\n\n"

        # 3. 사용자 메시지 저장
        DocumentChatMessage.objects.create(
            session=session,
            role='user',
            content=message
        )

        # 4. Agent 생성
        agent = get_read_document_agent(
            document_id=document.id,
            document_name=document.original_filename,
            document_type=document.get_document_type_display(),
            use_langfuse=USE_LANGFUSE,
            prompt_version=PROMPT_VERSION,
            prompt_label=PROMPT_LABEL
        )

        # 5. 비동기 스트리밍 (Agent 실행만)
        async def run_agent_stream():
            tools_used = []
            seen_tools = set()
            full_response = ""

            try:
                result = Runner.run_streamed(agent, input=message)

                async for event in result.stream_events():
                    # 텍스트 델타 이벤트
                    if event.type == "raw_response_event":
                        data = event.data
                        if hasattr(data, 'type') and data.type == 'response.output_text.delta':
                            if hasattr(data, 'delta') and data.delta:
                                full_response += data.delta
                                yield ('text', data.delta)

                    # 툴 호출 이벤트
                    elif event.type == "run_item_stream_event":
                        item = event.item
                        if isinstance(item, ToolCallItem):
                            try:
                                tool_name = item.raw_item.name
                            except AttributeError:
                                tool_name = getattr(item, 'name', None)

                            if tool_name and tool_name not in seen_tools:
                                seen_tools.add(tool_name)
                                tool_info = TOOL_DISPLAY_INFO.get(tool_name, {
                                    'name': tool_name,
                                    'icon': 'tool',
                                    'description': f'{tool_name} 도구를 사용했습니다.'
                                })
                                tool_data = {'id': tool_name, **tool_info}
                                tools_used.append(tool_data)
                                yield ('tool', tool_data)

                # 완료
                yield ('done', {'full_response': full_response, 'tools_used': tools_used})

            except Exception as e:
                import traceback
                traceback.print_exc()
                yield ('error', str(e))

        # 비동기 제너레이터를 동기로 변환
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        tools_used = []
        full_response = ""

        try:
            async_gen = run_agent_stream()
            while True:
                try:
                    event_type, event_data = loop.run_until_complete(async_gen.__anext__())

                    if event_type == 'text':
                        full_response += event_data
                        yield f"data: {json.dumps({'type': 'text', 'content': event_data})}\n\n"
                    elif event_type == 'tool':
                        tools_used.append(event_data)
                        yield f"data: {json.dumps({'type': 'tool', 'tool': event_data})}\n\n"
                    elif event_type == 'done':
                        full_response = event_data['full_response']
                        tools_used = event_data['tools_used']
                        yield f"data: {json.dumps({'type': 'done', 'tools_used': tools_used})}\n\n"
                    elif event_type == 'error':
                        yield f"data: {json.dumps({'type': 'error', 'error': event_data})}\n\n"

                except StopAsyncIteration:
                    break
        finally:
            loop.close()

        # 6. AI 응답 저장 (동기 ORM - 스트리밍 완료 후)
        try:
            DocumentChatMessage.objects.create(
                session=session,
                role='assistant',
                content=full_response,
                metadata={'tools_used': [tool['id'] for tool in tools_used]}
            )
            logger.info(
                f"Document chat stream completed: document_id={document_id}, "
                f"session_id={session.id}, tools={[t['id'] for t in tools_used]}"
            )
        except Exception as e:
            logger.error(f"Failed to save AI response: {e}")


@method_decorator(csrf_exempt, name='dispatch')
class DocumentProcessingStatusView(View):
    """
    문서 처리 상태 SSE 스트림

    GET /api/documents/{document_id}/status/stream/

    이벤트 타입:
    - status: 현재 처리 상태 (uploading, processing)
    - complete: 처리 완료 (s3_url 포함)
    - error: 오류 발생
    - timeout: 5분 초과
    """

    def get(self, request, document_id):
        response = StreamingHttpResponse(
            self.stream_status(document_id),
            content_type='text/event-stream'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    def stream_status(self, document_id):
        """문서 처리 상태 스트리밍"""

        max_wait_time = 300  # 최대 5분 대기
        poll_interval = 2  # 2초 간격 폴링
        elapsed = 0

        while elapsed < max_wait_time:
            try:
                document = UserDocument.objects.get(id=document_id)

                status_data = {
                    'status': document.status,
                    'document_id': document.id,
                    'filename': document.original_filename,
                }

                if document.status == 'uploading':
                    status_data['message'] = '파일 업로드 대기 중...'
                    status_data['progress'] = 10

                elif document.status == 'processing':
                    chunk_count = len(document.qdrant_point_ids)
                    status_data['message'] = f'문서 분석 중... ({chunk_count}개 청크 처리됨)'
                    status_data['progress'] = min(30 + chunk_count * 5, 90)

                elif document.status == 'ready':
                    # URL 갱신
                    new_url = s3_manager.generate_presigned_download_url(
                        s3_key=document.s3_key,
                        expiration=3600 * 24
                    )
                    document.s3_url = new_url
                    document.save()

                    status_data['message'] = '처리 완료!'
                    status_data['progress'] = 100
                    status_data['s3_url'] = new_url
                    status_data['total_chunks'] = document.get_total_chunks()
                    yield f"data: {json.dumps({'type': 'complete', **status_data})}\n\n"
                    return

                elif document.status == 'error':
                    status_data['message'] = document.error_message or '처리 중 오류 발생'
                    status_data['error'] = document.error_message
                    yield f"data: {json.dumps({'type': 'error', **status_data})}\n\n"
                    return

                yield f"data: {json.dumps({'type': 'status', **status_data})}\n\n"

            except UserDocument.DoesNotExist:
                yield f"data: {json.dumps({'type': 'error', 'error': '문서를 찾을 수 없습니다', 'document_id': document_id})}\n\n"
                return

            time.sleep(poll_interval)
            elapsed += poll_interval

        # 타임아웃
        yield f"data: {json.dumps({'type': 'timeout', 'message': '처리 시간이 초과되었습니다', 'document_id': document_id})}\n\n"
