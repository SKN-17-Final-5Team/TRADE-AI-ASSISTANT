from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChatStreamView, GenChatDeleteView
from .trade_views import (
    TradeInitView,
    TradeFlowViewSet,
    DocumentViewSet,
    DocChatHistoryView,
)
# V2: AI Server Client 사용 (스트리밍 전용)
from .trade_views_v2 import DocumentChatStreamViewV2 as DocumentChatStreamView

# DRF Router for ViewSets
router = DefaultRouter()
router.register(r'trade', TradeFlowViewSet, basename='trade')
router.register(r'documents', DocumentViewSet, basename='documents')

urlpatterns = [
    # 일반 채팅 스트리밍 API
    path('chat/stream/', ChatStreamView.as_view(), name='chat-stream'),

    # 일반 채팅 삭제
    path('chat/general/<int:gen_chat_id>/', GenChatDeleteView.as_view(), name='chat-general-delete'),

    # 무역 거래 초기화
    path('trade/init/', TradeInitView.as_view(), name='trade-init'),

    # 문서 채팅 API (스트리밍 전용)
    path('documents/chat/stream/', DocumentChatStreamView.as_view(), name='document-chat-stream'),
    path('documents/<int:doc_id>/chat/history/', DocChatHistoryView.as_view(), name='document-chat-history'),

    # ViewSet routes (trade/, documents/)
    path('', include(router.urls)),
]
