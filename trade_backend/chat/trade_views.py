"""
Trade and Document Management Views with Mem0 Integration

V2로 이전된 View:
- DocumentChatView → trade_views_v2.py
- DocumentChatStreamView → trade_views_v2.py (DocumentChatStreamViewV2)
"""

import asyncio
import logging
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    User, TradeFlow, Document, DocMessage, DocVersion, Department
)
from .serializers import (
    TradeFlowSerializer, DocumentSerializer, DocMessageSerializer,
    DocVersionSerializer
)
from .ai_client import get_ai_client

logger = logging.getLogger(__name__)


# Step 번호 → doc_type 매핑
STEP_TO_DOC_TYPE = {
    1: 'offer',
    2: 'pi',
    3: 'contract',
    4: 'ci',
    5: 'pl'
}

# doc_type → Step 번호 매핑
DOC_TYPE_TO_STEP = {v: k for k, v in STEP_TO_DOC_TYPE.items()}


def get_user_by_id_or_emp_no(user_id):
    """user_id(숫자) 또는 emp_no(사원번호)로 사용자 조회"""
    if user_id is None:
        return None
    try:
        # 먼저 emp_no로 조회 시도 (사원번호가 숫자로만 되어 있어도 emp_no로 먼저 찾기)
        try:
            return User.objects.get(emp_no=str(user_id))
        except User.DoesNotExist:
            pass

        # emp_no로 못 찾으면 user_id(정수)로 조회
        if isinstance(user_id, int) or (isinstance(user_id, str) and user_id.isdigit()):
            return User.objects.get(user_id=int(user_id))

        return None
    except User.DoesNotExist:
        logger.warning(f"User not found: user_id={user_id}")
        return None


# ==================== Trade Flow Initialization ====================

class TradeInitView(APIView):
    """
    새 무역 거래(TradeFlow) 초기화 API

    POST /api/trade/init/
    {
        "user_id": "emp001" 또는 1,
        "title": "거래 제목" (선택)
    }

    Returns:
    {
        "trade_id": 1,
        "doc_ids": {
            "offer": 10,
            "pi": 11,
            "contract": 12,
            "ci": 13,
            "pl": 14
        }
    }
    """

    def post(self, request):
        user_id = request.data.get('user_id')
        title = request.data.get('title', 'untitled document')

        logger.info(f"TradeInitView: user_id={user_id}, title={title}")

        # 사용자 조회
        user = get_user_by_id_or_emp_no(user_id)
        if not user:
            # 사용자가 없으면 자동 생성 (개발/테스트용)
            if user_id:
                try:
                    # 기본 부서 가져오기 또는 생성
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
                except Exception as e:
                    logger.error(f"사용자 자동 생성 실패: {e}")
                    import traceback
                    traceback.print_exc()
                    return Response(
                        {'error': f'사용자 생성 실패: {str(e)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                return Response(
                    {'error': 'user_id가 필요합니다.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        try:
            # 1. TradeFlow 생성
            trade = TradeFlow.objects.create(
                user=user,
                title=title
            )
            logger.info(f"TradeFlow 생성: trade_id={trade.trade_id}")

            # 2. Document 5개 생성 (각 doc_type)
            doc_ids = {}
            for step, doc_type in STEP_TO_DOC_TYPE.items():
                doc = Document.objects.create(
                    trade=trade,
                    doc_type=doc_type
                )
                doc_ids[doc_type] = doc.doc_id
                logger.info(f"Document 생성: doc_id={doc.doc_id}, doc_type={doc_type}")

            return Response({
                'trade_id': trade.trade_id,
                'doc_ids': doc_ids
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"TradeFlow 초기화 실패: {e}")
            return Response(
                {'error': f'초기화 중 오류가 발생했습니다: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ==================== Trade Flow Management ====================

class TradeFlowViewSet(viewsets.ModelViewSet):
    """무역 플로우 관리 ViewSet"""
    queryset = TradeFlow.objects.all()
    serializer_class = TradeFlowSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        return queryset

    def destroy(self, request, *args, **kwargs):
        """
        무역 플로우 삭제 + Mem0 메모리 정리

        DELETE /api/trade/{trade_id}/
        """
        trade = self.get_object()
        trade_id = trade.trade_id

        # 관련 문서 ID 목록 가져오기
        doc_ids = list(trade.documents.values_list('doc_id', flat=True))

        try:
            # 1. Mem0 메모리 삭제 (AI Server API 호출)
            if doc_ids:
                try:
                    client = get_ai_client()
                    asyncio.run(client.memory_delete(trade_id, doc_ids))
                    logger.info(f"Deleted mem0 memories for trade_id={trade_id}, docs={doc_ids}")
                except Exception as mem_err:
                    logger.warning(f"Mem0 메모리 삭제 실패 (계속 진행): {mem_err}")

            # 2. RDS에서 삭제 (CASCADE로 관련 데이터 자동 삭제)
            trade.delete()

            logger.info(f"Successfully deleted trade_id={trade_id} with {len(doc_ids)} documents")

            return Response({
                'message': '무역 플로우가 삭제되었습니다.',
                'trade_id': trade_id,
                'deleted_doc_count': len(doc_ids)
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Failed to delete trade: {e}")
            return Response(
                {'error': f'삭제 중 오류가 발생했습니다: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ==================== Document Management ====================

class DocumentViewSet(viewsets.ModelViewSet):
    """문서 관리 ViewSet"""
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        trade_id = self.request.query_params.get('trade_id')
        if trade_id:
            queryset = queryset.filter(trade_id=trade_id)
        return queryset

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """
        문서의 모든 대화 메시지 조회

        GET /api/documents/{doc_id}/messages/
        """
        document = self.get_object()
        messages = document.messages.all()
        serializer = DocMessageSerializer(messages, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """
        문서의 모든 버전 조회

        GET /api/documents/{doc_id}/versions/
        """
        document = self.get_object()
        versions = document.versions.all()
        serializer = DocVersionSerializer(versions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def save_version(self, request, pk=None):
        """
        현재 문서 상태를 버전으로 저장 + Mem0에 문서 내용 저장 (Step간 참조용)

        POST /api/documents/{doc_id}/save_version/
        {
            "content": {...},
            "user_id": "emp001"  # 선택
        }
        """
        document = self.get_object()
        content = request.data.get('content')
        user_id = request.data.get('user_id')

        if not content:
            return Response(
                {'error': 'content가 필요합니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 1. RDS에 버전 저장
            version = DocVersion.objects.create(
                doc=document,
                content=content
            )
            serializer = DocVersionSerializer(version)
            logger.info(f"Saved version {version.version_id} for doc_id={document.doc_id}")

            # 2. TradeFlow title 업데이트 (content에 title이 있으면)
            trade_id = document.trade_id
            if trade_id and isinstance(content, dict):
                title = content.get('title', '').strip()
                if title:
                    try:
                        trade_flow = TradeFlow.objects.get(trade_id=trade_id)
                        if trade_flow.title != title:
                            trade_flow.title = title
                            trade_flow.save(update_fields=['title', 'updated_at'])
                            logger.info(f"Updated TradeFlow title: trade_id={trade_id}, title={title}")
                    except TradeFlow.DoesNotExist:
                        logger.warning(f"TradeFlow not found: trade_id={trade_id}")

            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Failed to save version: {e}")
            return Response(
                {'error': f'버전 저장 중 오류가 발생했습니다: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def update_upload(self, request, pk=None):
        """
        문서의 업로드 정보 업데이트

        POST /api/documents/{doc_id}/update_upload/
        {
            "doc_mode": "upload",
            "s3_key": "uploads/2024/01/abc123.pdf",
            "s3_url": "https://s3.../uploads/2024/01/abc123.pdf",
            "original_filename": "contract.pdf",
            "file_size": 123456,
            "mime_type": "application/pdf",
            "upload_status": "ready"
        }
        """
        document = self.get_object()

        try:
            # 업로드 관련 필드 업데이트
            document.doc_mode = request.data.get('doc_mode', document.doc_mode)
            document.s3_key = request.data.get('s3_key', document.s3_key)
            document.s3_url = request.data.get('s3_url', document.s3_url)
            document.original_filename = request.data.get('original_filename', document.original_filename)
            document.file_size = request.data.get('file_size', document.file_size)
            document.mime_type = request.data.get('mime_type', document.mime_type)
            document.upload_status = request.data.get('upload_status', document.upload_status)
            document.error_message = request.data.get('error_message', document.error_message)
            document.save()

            logger.info(f"Updated upload info for doc_id={document.doc_id}")

            serializer = DocumentSerializer(document)
            return Response(serializer.data)

        except Exception as e:
            logger.error(f"Failed to update upload info: {e}")
            return Response(
                {'error': f'업로드 정보 업데이트 중 오류가 발생했습니다: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ==================== Document Chat History API ====================

class DocChatHistoryView(APIView):
    """
    문서 채팅 히스토리 조회 API

    GET /api/documents/{doc_id}/chat/history/

    Returns:
    {
        "doc_id": 1,
        "messages": [
            {"role": "user", "content": "...", "created_at": "..."},
            {"role": "agent", "content": "...", "created_at": "..."}
        ]
    }
    """

    def get(self, request, doc_id):
        try:
            document = Document.objects.get(doc_id=doc_id)
            messages = DocMessage.objects.filter(doc=document).order_by('created_at')

            message_list = [
                {
                    'doc_message_id': msg.doc_message_id,
                    'role': msg.role,
                    'content': msg.content,
                    'metadata': msg.metadata,
                    'created_at': msg.created_at.isoformat()
                }
                for msg in messages
            ]

            return Response({
                'doc_id': doc_id,
                'trade_id': document.trade_id,
                'doc_type': document.doc_type,
                'messages': message_list
            })

        except Document.DoesNotExist:
            return Response({
                'doc_id': doc_id,
                'messages': []
            })
        except Exception as e:
            logger.error(f"DocChatHistoryView 오류: {e}")
            return Response(
                {'error': f'대화 히스토리 조회 중 오류가 발생했습니다: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
