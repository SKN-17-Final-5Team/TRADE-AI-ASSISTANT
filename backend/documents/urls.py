"""
Documents App URLs
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    DocumentUploadView,
    DocumentUploadCompleteView,
    UserDocumentViewSet,
    DocumentChatSessionViewSet,
    DocumentChatView,
    DocumentChatStreamView,
    DocumentProcessingStatusView,
)

# Router for ViewSets
router = DefaultRouter()
router.register(r'', UserDocumentViewSet, basename='document')
router.register(r'sessions', DocumentChatSessionViewSet, basename='chat-session')

urlpatterns = [
    # Presigned URL 생성
    path('upload/request/', DocumentUploadView.as_view(), name='document-upload-request'),

    # 업로드 완료 알림
    path('upload/complete/', DocumentUploadCompleteView.as_view(), name='document-upload-complete'),

    # 문서 채팅 (비스트리밍)
    path('chat/', DocumentChatView.as_view(), name='document-chat'),

    # 문서 채팅 (스트리밍)
    path('chat/stream/', DocumentChatStreamView.as_view(), name='document-chat-stream'),

    # 문서 처리 상태 SSE 스트림
    path('<int:document_id>/status/stream/', DocumentProcessingStatusView.as_view(), name='document-status-stream'),

    # ViewSet routes
    path('', include(router.urls)),
]
