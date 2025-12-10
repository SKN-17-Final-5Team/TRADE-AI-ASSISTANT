from django.apps import AppConfig


class ChatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chat'

    # Note: Qdrant 초기화는 AI Server에서 담당합니다
