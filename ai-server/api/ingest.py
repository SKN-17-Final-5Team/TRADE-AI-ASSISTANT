"""
문서 색인 API

PDF 문서를 Qdrant에 색인하는 엔드포인트
(실제 로직은 Phase 9에서 services/ingest.py로 구현)
"""

import logging

from fastapi import APIRouter, HTTPException

from schemas.request import IngestRequest, IngestDeleteRequest
from schemas.response import IngestResponse, IngestDeleteResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", tags=["ingest"])


def get_ingest_service():
    """Ingest 서비스 인스턴스 (지연 로딩)"""
    try:
        from services.ingest import get_ingest_service as _get_service
        return _get_service()
    except ImportError:
        logger.warning("Ingest 서비스 미구현 상태")
        return None


@router.post("/document", response_model=IngestResponse)
async def ingest_document(request: IngestRequest):
    """
    문서 색인

    S3에 업로드된 PDF를 파싱하여 Qdrant에 색인합니다.
    """
    logger.info(f"문서 색인 요청: doc_id={request.doc_id}, s3_key={request.s3_key}")

    service = get_ingest_service()
    if not service:
        raise HTTPException(status_code=503, detail="Ingest 서비스를 사용할 수 없습니다")

    try:
        result = await service.ingest_document(
            doc_id=request.doc_id,
            s3_key=request.s3_key,
            collection_name=request.collection_name
        )

        return IngestResponse(
            success=True,
            doc_id=request.doc_id,
            chunks_count=result.get('chunks_count', 0),
            collection=request.collection_name
        )

    except Exception as e:
        logger.error(f"문서 색인 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/document", response_model=IngestDeleteResponse)
async def delete_document(request: IngestDeleteRequest):
    """
    문서 색인 삭제

    Qdrant에서 특정 문서의 모든 청크를 삭제합니다.
    """
    logger.info(f"문서 색인 삭제 요청: doc_id={request.doc_id}")

    service = get_ingest_service()
    if not service:
        raise HTTPException(status_code=503, detail="Ingest 서비스를 사용할 수 없습니다")

    try:
        deleted = await service.delete_document(
            doc_id=request.doc_id,
            collection_name=request.collection_name
        )

        return IngestDeleteResponse(
            success=True,
            doc_id=request.doc_id,
            deleted_count=deleted
        )

    except Exception as e:
        logger.error(f"문서 색인 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))
