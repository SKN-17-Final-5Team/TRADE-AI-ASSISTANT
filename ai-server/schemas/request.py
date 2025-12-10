"""
API 요청 스키마

FastAPI 엔드포인트에서 사용하는 Pydantic Request 모델 (스트리밍 전용)
"""

from pydantic import BaseModel, Field


# ==================== Trade Agent ====================

class TradeChatRequest(BaseModel):
    """무역 채팅 스트리밍 API 요청"""
    message: str = Field(..., description="사용자 메시지")
    user_id: int | None = Field(None, description="사용자 ID")
    context: str = Field("", description="컨텍스트")
    history: list[dict] = Field(default_factory=list, description="대화 히스토리")


# ==================== Document Writing Agent ====================

class DocumentChatRequest(BaseModel):
    """문서 작성 스트리밍 채팅 API 요청"""
    doc_id: int = Field(..., description="문서 ID")
    message: str = Field(..., description="사용자 메시지")
    document_content: str = Field("", description="현재 에디터 문서 내용 HTML")
    history: list[dict] = Field(default_factory=list, description="대화 히스토리")


# ==================== Document Read Agent ====================

class DocumentReadRequest(BaseModel):
    """업로드 문서 읽기 스트리밍 채팅 API 요청"""
    doc_id: int = Field(..., description="문서 ID")
    message: str = Field(..., description="사용자 메시지")
    document_name: str = Field("", description="문서 파일명")
    document_type: str = Field("", description="문서 타입 (offer, pi, contract 등)")
    history: list[dict] = Field(default_factory=list, description="대화 히스토리")


# ==================== Memory Service ====================

class MemorySearchRequest(BaseModel):
    """메모리 검색 API 요청"""
    query: str = Field(..., description="검색 쿼리")
    user_id: int | None = Field(None, description="사용자 ID")
    doc_id: int | None = Field(None, description="문서 ID")
    buyer_name: str | None = Field(None, description="거래처명")
    limit: int = Field(5, description="결과 개수 제한")


class MemorySaveRequest(BaseModel):
    """메모리 저장 API 요청"""
    messages: list[dict] = Field(..., description="저장할 대화 메시지 목록")
    user_id: int | None = Field(None, description="사용자 ID")
    doc_id: int | None = Field(None, description="문서 ID")
    buyer_name: str | None = Field(None, description="거래처명")
    save_user: bool = Field(True, description="사용자 메모리 저장 여부")
    save_doc: bool = Field(True, description="문서 메모리 저장 여부")
    save_buyer: bool = Field(False, description="거래처 메모리 저장 여부")


class MemoryDeleteRequest(BaseModel):
    """메모리 삭제 API 요청"""
    trade_id: int = Field(..., description="거래 ID")
    doc_ids: list[int] = Field(..., description="삭제할 문서 ID 목록")


class MemoryBuildContextRequest(BaseModel):
    """메모리 컨텍스트 빌드 API 요청"""
    doc_id: int = Field(..., description="문서 ID")
    user_id: int = Field(..., description="사용자 ID")
    query: str = Field(..., description="검색 쿼리")


# ==================== Ingest (문서 색인) ====================

class IngestRequest(BaseModel):
    """문서 색인 API 요청"""
    doc_id: int = Field(..., description="문서 ID")
    s3_key: str = Field(..., description="S3 파일 경로")
    collection_name: str = Field("user_documents", description="Qdrant 컬렉션명")


class IngestDeleteRequest(BaseModel):
    """문서 색인 삭제 API 요청"""
    doc_id: int = Field(..., description="삭제할 문서 ID")
    collection_name: str = Field("user_documents", description="Qdrant 컬렉션명")
