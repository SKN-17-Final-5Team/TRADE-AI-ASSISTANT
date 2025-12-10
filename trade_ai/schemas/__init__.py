"""Schemas 패키지 - API 요청/응답 Pydantic 모델 (스트리밍 전용)"""

from .request import (
    # Trade Agent
    TradeChatRequest,
    # Document Writing Agent
    DocumentChatRequest,
    # Document Read Agent
    DocumentReadRequest,
    # Memory Service
    MemorySearchRequest,
    MemorySaveRequest,
    MemoryDeleteRequest,
    MemoryBuildContextRequest,
    # Ingest
    IngestRequest,
    IngestDeleteRequest,
)

from .response import (
    # 공통
    ErrorResponse,
    HealthResponse,
    ToolUsedInfo,
    EditChange,
    # Streaming 이벤트
    StreamInitEvent,
    StreamTextEvent,
    StreamToolEvent,
    StreamEditEvent,
    StreamDoneEvent,
    StreamErrorEvent,
    # Memory Service
    MemoryItem,
    MemorySearchResponse,
    MemorySaveResponse,
    MemoryContextResponse,
    MemoryDeleteResponse,
    # Ingest
    IngestResponse,
    IngestDeleteResponse,
)

__all__ = [
    # Request
    "TradeChatRequest",
    "DocumentChatRequest",
    "DocumentReadRequest",
    "MemorySearchRequest",
    "MemorySaveRequest",
    "MemoryDeleteRequest",
    "MemoryBuildContextRequest",
    "IngestRequest",
    "IngestDeleteRequest",
    # Response
    "ErrorResponse",
    "HealthResponse",
    "ToolUsedInfo",
    "EditChange",
    "StreamInitEvent",
    "StreamTextEvent",
    "StreamToolEvent",
    "StreamEditEvent",
    "StreamDoneEvent",
    "StreamErrorEvent",
    "MemoryItem",
    "MemorySearchResponse",
    "MemorySaveResponse",
    "MemoryContextResponse",
    "MemoryDeleteResponse",
    "IngestResponse",
    "IngestDeleteResponse",
]
