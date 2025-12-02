from django.db import models
from django.core.validators import FileExtensionValidator


class UserDocument(models.Model):
    """
    사용자가 업로드한 문서 메타데이터

    실제 파일은 S3에 저장되고, 이 모델은 메타데이터만 관리합니다.
    """

    DOCUMENT_TYPE_CHOICES = [
        ('offer_sheet', 'Offer Sheet'),
        ('sales_contract', 'Sales Contract'),
    ]

    STATUS_CHOICES = [
        ('uploading', 'Uploading'),  # S3 업로드 대기 중
        ('processing', 'Processing'),  # 임베딩 생성 중
        ('ready', 'Ready'),  # 사용 가능
        ('error', 'Error'),  # 오류 발생
    ]

    # 기본 정보
    document_type = models.CharField(
        max_length=50,
        choices=DOCUMENT_TYPE_CHOICES,
        help_text="문서 타입 (Offer Sheet or Sales Contract)"
    )
    original_filename = models.CharField(
        max_length=255,
        help_text="원본 파일명"
    )

    # S3 관련
    s3_key = models.CharField(
        max_length=500,
        unique=True,
        help_text="S3에 저장된 파일의 고유 키"
    )
    s3_url = models.URLField(
        max_length=1000,
        blank=True,
        null=True,
        help_text="S3 파일 접근 URL (presigned URL)"
    )

    # 파일 메타데이터
    file_size = models.BigIntegerField(
        help_text="파일 크기 (bytes)"
    )
    mime_type = models.CharField(
        max_length=100,
        default='application/pdf'
    )

    # 처리 상태
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='uploading',
        help_text="문서 처리 상태"
    )
    error_message = models.TextField(
        blank=True,
        null=True,
        help_text="오류 발생 시 메시지"
    )

    # Qdrant 관련
    qdrant_point_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Qdrant에 저장된 벡터 포인트 ID 목록"
    )

    # 타임스탬프
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # 사용자 정보 (향후 확장용)
    # user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)

    class Meta:
        db_table = 'user_documents'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['document_type']),
            models.Index(fields=['status']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"{self.get_document_type_display()} - {self.original_filename}"

    def get_total_chunks(self):
        """임베딩된 청크 개수 반환"""
        return len(self.qdrant_point_ids)


class DocumentChatSession(models.Model):
    """
    문서 기반 채팅 세션

    각 업로드된 문서마다 하나의 채팅 세션이 연결됩니다.
    """

    document = models.ForeignKey(
        UserDocument,
        on_delete=models.CASCADE,
        related_name='chat_sessions',
        help_text="연결된 문서"
    )

    title = models.CharField(
        max_length=200,
        blank=True,
        help_text="세션 제목 (첫 메시지나 문서명 기반)"
    )

    # 타임스탬프
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'document_chat_sessions'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['document', '-updated_at']),
        ]

    def __str__(self):
        return f"Session for {self.document.original_filename}"

    def save(self, *args, **kwargs):
        # 제목이 없으면 문서 파일명으로 설정
        if not self.title:
            self.title = f"Chat: {self.document.original_filename}"
        super().save(*args, **kwargs)


class DocumentChatMessage(models.Model):
    """
    문서 채팅 메시지

    사용자와 AI 간의 대화 내용을 저장합니다.
    """

    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
        ('system', 'System'),
    ]

    session = models.ForeignKey(
        DocumentChatSession,
        on_delete=models.CASCADE,
        related_name='messages',
        help_text="속한 채팅 세션"
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        help_text="메시지 발신자 역할"
    )

    content = models.TextField(
        help_text="메시지 내용"
    )

    # 메타데이터 (툴 사용, 검색 결과 등)
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="추가 메타데이터 (tool calls, search results 등)"
    )

    # 타임스탬프
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'document_chat_messages'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['session', 'created_at']),
        ]

    def __str__(self):
        preview = self.content[:50] + '...' if len(self.content) > 50 else self.content
        return f"{self.role}: {preview}"
