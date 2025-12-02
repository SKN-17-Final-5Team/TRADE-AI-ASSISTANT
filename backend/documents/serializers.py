"""
Document API Serializers
"""

from rest_framework import serializers
from .models import UserDocument, DocumentChatSession, DocumentChatMessage


class UserDocumentSerializer(serializers.ModelSerializer):
    """사용자 문서 Serializer"""

    total_chunks = serializers.SerializerMethodField()

    class Meta:
        model = UserDocument
        fields = [
            'id',
            'document_type',
            'original_filename',
            's3_key',
            's3_url',
            'file_size',
            'mime_type',
            'status',
            'error_message',
            'total_chunks',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 's3_key', 's3_url', 'created_at', 'updated_at']

    def get_total_chunks(self, obj):
        return obj.get_total_chunks()


class PresignedUploadRequestSerializer(serializers.Serializer):
    """Presigned URL 요청 Serializer"""

    document_type = serializers.ChoiceField(
        choices=['offer_sheet', 'sales_contract'],
        help_text="문서 타입"
    )
    filename = serializers.CharField(
        max_length=255,
        help_text="원본 파일명"
    )
    file_size = serializers.IntegerField(
        min_value=1,
        help_text="파일 크기 (bytes)"
    )
    mime_type = serializers.CharField(
        default='application/pdf',
        help_text="MIME 타입"
    )


class PresignedUploadResponseSerializer(serializers.Serializer):
    """Presigned URL 응답 Serializer"""

    document_id = serializers.IntegerField(help_text="생성된 문서 ID")
    upload_url = serializers.URLField(help_text="업로드할 Presigned URL (PUT 요청)")
    s3_key = serializers.CharField(help_text="S3 파일 키")
    expires_in = serializers.IntegerField(help_text="URL 만료 시간 (초)")


class UploadCompleteRequestSerializer(serializers.Serializer):
    """업로드 완료 알림 Serializer"""

    document_id = serializers.IntegerField(help_text="문서 ID")
    s3_key = serializers.CharField(help_text="S3 파일 키")


class DocumentChatMessageSerializer(serializers.ModelSerializer):
    """채팅 메시지 Serializer"""

    class Meta:
        model = DocumentChatMessage
        fields = ['id', 'role', 'content', 'metadata', 'created_at']
        read_only_fields = ['id', 'created_at']


class DocumentChatSessionSerializer(serializers.ModelSerializer):
    """채팅 세션 Serializer"""

    messages = DocumentChatMessageSerializer(many=True, read_only=True)
    document = UserDocumentSerializer(read_only=True)

    class Meta:
        model = DocumentChatSession
        fields = ['id', 'document', 'title', 'messages', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class DocumentChatRequestSerializer(serializers.Serializer):
    """문서 채팅 요청 Serializer"""

    document_id = serializers.IntegerField(help_text="문서 ID")
    message = serializers.CharField(help_text="사용자 메시지")
    session_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="기존 세션 ID (없으면 새로 생성)"
    )


class DocumentChatResponseSerializer(serializers.Serializer):
    """문서 채팅 응답 Serializer"""

    session_id = serializers.IntegerField(help_text="채팅 세션 ID")
    message = serializers.CharField(help_text="AI 응답 메시지")
    tools_used = serializers.ListField(
        child=serializers.DictField(),
        help_text="사용된 툴 목록"
    )
