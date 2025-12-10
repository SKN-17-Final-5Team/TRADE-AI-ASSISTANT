"""
Document Processing Services - AI Server Client 사용

PDF 처리 및 Qdrant 저장은 AI Server의 /api/ingest 엔드포인트로 위임됩니다.
"""

import logging
import asyncio
from chat.ai_client import get_ai_client
from .models import Document

logger = logging.getLogger(__name__)


def process_uploaded_document(document_id: int):
    """
    업로드된 문서 처리 - AI Server /api/ingest 호출

    Args:
        document_id: Document ID (doc_id)
    """
    try:
        # 1. 문서 조회
        document = Document.objects.get(doc_id=document_id)
        logger.info(f"Processing document {document_id}: {document.original_filename}")

        # 2. AI Server Ingest API 호출
        client = get_ai_client()

        async def call_ingest():
            return await client.ingest_document(
                doc_id=document_id,
                s3_key=document.s3_key,
                doc_type=document.doc_type or "general",
                metadata={
                    "original_filename": document.original_filename,
                    "file_size": document.file_size,
                    "mime_type": document.mime_type,
                }
            )

        result = asyncio.run(call_ingest())

        if result.get("success"):
            # 성공: Document 상태 업데이트
            document.upload_status = 'ready'
            document.error_message = None
            document.save()

            logger.info(
                f"✓ Document {document_id} processed successfully: "
                f"{result.get('chunks_count', 0)} chunks"
            )
        else:
            raise ValueError(result.get("error", "Ingest failed"))

    except Exception as e:
        logger.error(f"Failed to process document {document_id}: {e}")

        # 상태 업데이트: error
        try:
            document = Document.objects.get(doc_id=document_id)
            document.upload_status = 'error'
            document.error_message = str(e)
            document.save()
        except Exception as update_error:
            logger.error(f"Failed to update document status: {update_error}")

        raise
