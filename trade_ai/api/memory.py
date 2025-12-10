"""
메모리 서비스 API

Mem0 기반 메모리 관리 엔드포인트
(실제 로직은 Phase 9에서 services/memory.py로 구현)
"""

import logging

from fastapi import APIRouter, HTTPException

from schemas.request import (
    MemorySearchRequest,
    MemorySaveRequest,
    MemoryDeleteRequest,
    MemoryBuildContextRequest,
    GenChatMemoryDeleteRequest,
)
from schemas.response import (
    MemorySearchResponse,
    MemorySaveResponse,
    MemoryDeleteResponse,
    MemoryContextResponse,
    MemoryItem,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/memory", tags=["memory"])


def get_memory_service():
    """메모리 서비스 인스턴스 (지연 로딩)"""
    try:
        from services.memory import get_memory_service as _get_service
        return _get_service()
    except ImportError:
        logger.warning("메모리 서비스 미구현 상태")
        return None


@router.post("/search", response_model=MemorySearchResponse)
async def search_memory(request: MemorySearchRequest):
    """
    메모리 검색

    사용자/문서/거래처 메모리에서 관련 정보를 검색합니다.
    """
    service = get_memory_service()
    if not service:
        return MemorySearchResponse(memories=[], count=0)

    try:
        memories = []

        # 사용자 메모리 검색
        if request.user_id:
            user_mems = service.search_user_memory(
                user_id=request.user_id,
                query=request.query,
                limit=request.limit
            )
            memories.extend([
                MemoryItem(id=m.get('id', ''), memory=m.get('memory', ''), score=m.get('score'))
                for m in user_mems
            ])

        # 문서 메모리 검색
        if request.doc_id:
            doc_mems = service.search_doc_memory(
                doc_id=request.doc_id,
                query=request.query,
                limit=request.limit
            )
            memories.extend([
                MemoryItem(id=m.get('id', ''), memory=m.get('memory', ''), score=m.get('score'))
                for m in doc_mems
            ])

        return MemorySearchResponse(memories=memories, count=len(memories))

    except Exception as e:
        logger.error(f"메모리 검색 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save", response_model=MemorySaveResponse)
async def save_memory(request: MemorySaveRequest):
    """
    메모리 저장

    대화 내용을 사용자/문서/거래처 메모리에 저장합니다.
    """
    service = get_memory_service()
    if not service:
        return MemorySaveResponse(success=False, saved_count=0)

    try:
        result = service.save_memory_smart(
            messages=request.messages,
            user_id=request.user_id,
            doc_id=request.doc_id,
            buyer_name=request.buyer_name,
            save_user=request.save_user,
            save_doc=request.save_doc,
            save_buyer=request.save_buyer
        )

        return MemorySaveResponse(
            success=True,
            saved_count=result.get('total', 0),
            user_memories=result.get('user', 0),
            doc_memories=result.get('doc', 0),
            buyer_memories=result.get('buyer', 0)
        )

    except Exception as e:
        logger.error(f"메모리 저장 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/context", response_model=MemoryContextResponse)
async def build_context(request: MemoryBuildContextRequest):
    """
    문서 컨텍스트 빌드

    문서 작성 시 필요한 컨텍스트 정보를 조합합니다.
    """
    service = get_memory_service()
    if not service:
        return MemoryContextResponse(
            user_memories=[],
            doc_memories=[],
            buyer_memories=[],
            context_summary=""
        )

    try:
        context = service.build_doc_context(
            doc_id=request.doc_id,
            user_id=request.user_id,
            query=request.query
        )

        return MemoryContextResponse(
            user_memories=[
                MemoryItem(id=m.get('id', ''), memory=m.get('memory', ''))
                for m in context.get('user_memories', [])
            ],
            doc_memories=[
                MemoryItem(id=m.get('id', ''), memory=m.get('memory', ''))
                for m in context.get('doc_memories', [])
            ],
            buyer_memories=[
                MemoryItem(id=m.get('id', ''), memory=m.get('memory', ''))
                for m in context.get('buyer_memories', [])
            ],
            context_summary=context.get('context_summary', '')
        )

    except Exception as e:
        logger.error(f"컨텍스트 빌드 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=MemoryDeleteResponse)
async def delete_memory(request: MemoryDeleteRequest):
    """
    거래 메모리 삭제

    거래(TradeFlow) 삭제 시 관련 메모리를 정리합니다.
    """
    service = get_memory_service()
    if not service:
        return MemoryDeleteResponse(success=False, deleted_count=0)

    try:
        deleted = service.delete_trade_memory(
            trade_id=request.trade_id,
            doc_ids=request.doc_ids
        )

        return MemoryDeleteResponse(
            success=True,
            deleted_count=deleted
        )

    except Exception as e:
        logger.error(f"메모리 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete/gen-chat", response_model=MemoryDeleteResponse)
async def delete_gen_chat_memory(request: GenChatMemoryDeleteRequest):
    """
    일반채팅 메모리 삭제

    일반채팅(GenChat) 삭제 시 관련 메모리를 정리합니다.
    """
    service = get_memory_service()
    if not service:
        return MemoryDeleteResponse(success=False, deleted_count=0)

    try:
        success = service.delete_gen_chat_memory(request.gen_chat_id)
        return MemoryDeleteResponse(
            success=success,
            deleted_count=1 if success else 0
        )

    except Exception as e:
        logger.error(f"일반채팅 메모리 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))
