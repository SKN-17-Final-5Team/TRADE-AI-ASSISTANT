"""
API 응답 스키마

FastAPI 엔드포인트에서 사용하는 Pydantic Response 모델
"""

from pydantic import BaseModel, Field


# ==================== 공통 응답 ====================

class ErrorResponse(BaseModel):
    """에러 응답"""
    error: str = Field(..., description="에러 메시지")
    detail: str | None = Field(None, description="상세 에러 정보")


class HealthResponse(BaseModel):
    """헬스체크 응답"""
    status: str = Field(..., description="서버 상태")
    version: str = Field(..., description="API 버전")
    services: dict = Field(default_factory=dict, description="서비스 상태")


# ==================== Tool 정보 ====================

class ToolUsedInfo(BaseModel):
    """사용된 도구 정보"""
    id: str = Field(..., description="도구 ID")
    name: str = Field(..., description="도구 표시명")
    icon: str = Field(..., description="아이콘 이름")
    description: str = Field(..., description="도구 설명")


# ==================== Trade Agent 응답 ====================

class TradeChatResponse(BaseModel):
    """무역 채팅 API 응답"""
    message: str = Field(..., description="AI 응답 메시지")
    tools_used: list[ToolUsedInfo] = Field(default_factory=list, description="사용된 도구 목록")
    context_used: str | None = Field(None, description="사용된 컨텍스트 요약")


# ==================== Document Writing Agent 응답 ====================

class EditChange(BaseModel):
    """문서 편집 변경 사항"""
    fieldId: str = Field(..., description="필드 ID (data-field-id 값)")
    value: str = Field(..., description="새로운 값")


class DocumentChatResponse(BaseModel):
    """문서 작성 채팅 API 응답"""
    doc_id: int = Field(..., description="문서 ID")
    message: str = Field(..., description="AI 응답 메시지")
    tools_used: list[ToolUsedInfo] = Field(default_factory=list, description="사용된 도구 목록")
    context_used: str | None = Field(None, description="사용된 컨텍스트 요약")
    # 편집 응답인 경우
    is_edit: bool = Field(False, description="편집 응답 여부")
    changes: list[EditChange] | None = Field(None, description="편집 변경 목록")


# ==================== Document Read Agent 응답 ====================

class DocumentReadResponse(BaseModel):
    """업로드 문서 읽기 채팅 API 응답"""
    doc_id: int = Field(..., description="문서 ID")
    message: str = Field(..., description="AI 응답 메시지")
    tools_used: list[ToolUsedInfo] = Field(default_factory=list, description="사용된 도구 목록")
    context_used: str | None = Field(None, description="사용된 컨텍스트 요약")


# ==================== Streaming 이벤트 ====================

class StreamInitEvent(BaseModel):
    """스트림 초기화 이벤트"""
    type: str = Field("init", description="이벤트 타입")
    doc_id: int | None = Field(None, description="문서 ID")
    trade_id: int | None = Field(None, description="거래 ID")


class StreamTextEvent(BaseModel):
    """스트림 텍스트 이벤트"""
    type: str = Field("text", description="이벤트 타입")
    content: str = Field(..., description="텍스트 청크")


class StreamToolEvent(BaseModel):
    """스트림 도구 사용 이벤트"""
    type: str = Field("tool", description="이벤트 타입")
    tool: ToolUsedInfo = Field(..., description="사용된 도구 정보")


class StreamEditEvent(BaseModel):
    """스트림 편집 이벤트"""
    type: str = Field("edit", description="이벤트 타입")
    message: str = Field(..., description="편집 설명")
    changes: list[EditChange] = Field(..., description="편집 변경 목록")


class StreamDoneEvent(BaseModel):
    """스트림 완료 이벤트"""
    type: str = Field("done", description="이벤트 타입")
    tools_used: list[ToolUsedInfo] = Field(default_factory=list, description="사용된 도구 목록")


class StreamErrorEvent(BaseModel):
    """스트림 에러 이벤트"""
    type: str = Field("error", description="이벤트 타입")
    error: str = Field(..., description="에러 메시지")


# ==================== Memory Service 응답 ====================

class MemoryItem(BaseModel):
    """메모리 항목"""
    id: str = Field(..., description="메모리 ID")
    memory: str = Field(..., description="메모리 내용")
    score: float | None = Field(None, description="관련도 점수")


class MemorySearchResponse(BaseModel):
    """메모리 검색 응답"""
    memories: list[MemoryItem] = Field(default_factory=list, description="검색된 메모리 목록")
    count: int = Field(0, description="결과 개수")


class MemorySaveResponse(BaseModel):
    """메모리 저장 응답"""
    success: bool = Field(..., description="저장 성공 여부")
    saved_count: int = Field(0, description="저장된 메모리 수")
    user_memories: int = Field(0, description="사용자 메모리 수")
    doc_memories: int = Field(0, description="문서 메모리 수")
    buyer_memories: int = Field(0, description="거래처 메모리 수")


class MemoryContextResponse(BaseModel):
    """메모리 컨텍스트 빌드 응답"""
    user_memories: list[MemoryItem] = Field(default_factory=list, description="사용자 메모리")
    doc_memories: list[MemoryItem] = Field(default_factory=list, description="문서 메모리")
    buyer_memories: list[MemoryItem] = Field(default_factory=list, description="거래처 메모리")
    context_summary: str = Field("", description="컨텍스트 요약")


class MemoryDeleteResponse(BaseModel):
    """메모리 삭제 응답"""
    success: bool = Field(..., description="삭제 성공 여부")
    deleted_count: int = Field(0, description="삭제된 메모리 수")


# ==================== Ingest (문서 색인) 응답 ====================

class IngestResponse(BaseModel):
    """문서 색인 응답"""
    success: bool = Field(..., description="색인 성공 여부")
    doc_id: int = Field(..., description="문서 ID")
    chunks_count: int = Field(0, description="생성된 청크 수")
    collection: str = Field(..., description="저장된 컬렉션명")


class IngestDeleteResponse(BaseModel):
    """문서 색인 삭제 응답"""
    success: bool = Field(..., description="삭제 성공 여부")
    doc_id: int = Field(..., description="삭제된 문서 ID")
    deleted_count: int = Field(0, description="삭제된 청크 수")
