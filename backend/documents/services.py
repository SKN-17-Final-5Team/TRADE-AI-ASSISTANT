"""
Document Processing Services

PDF 다운로드 → 파싱 → 임베딩 → Qdrant 저장 파이프라인
"""

import logging
import tempfile
import uuid
from pathlib import Path
from typing import List, Dict

import boto3
from django.conf import settings


from .models import Document
from agent_core.config import (
    qdrant_client,
    openai_client,
    COLLECTION_USER_DOCS,
    EMBEDDING_MODEL,
)

logger = logging.getLogger(__name__)


def download_from_s3(s3_key: str, file_ext: str = '.pdf') -> str:
    """
    S3에서 파일 다운로드 → 임시 파일로 저장

    Args:
        s3_key: S3 파일 키
        file_ext: 파일 확장자 (예: '.pdf', '.docx')

    Returns:
        str: 임시 파일 경로
    """
    s3_client = boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME,
    )

    # 임시 파일 생성 (확장자 유지)
    if not file_ext.startswith('.'):
        file_ext = '.' + file_ext
        
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_ext)
    temp_path = temp_file.name
    temp_file.close()

    # S3에서 다운로드
    s3_client.download_file(
        settings.AWS_STORAGE_BUCKET_NAME,
        s3_key,
        temp_path
    )

    logger.info(f"Downloaded S3 file {s3_key} to {temp_path}")
    return temp_path




def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    OpenAI API로 텍스트 배치 임베딩 생성

    Args:
        texts: 텍스트 리스트

    Returns:
        List[List[float]]: 임베딩 벡터 리스트
    """
    try:
        response = openai_client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=texts
        )

        embeddings = [item.embedding for item in response.data]
        logger.info(f"Generated {len(embeddings)} embeddings")

        return embeddings

    except Exception as e:
        logger.error(f"Failed to generate embeddings: {e}")
        raise


def store_chunks_in_qdrant(
    document_id: int,
    chunks: List[Dict],
    embeddings: List[List[float]]
) -> List[str]:
    """
    청크와 임베딩을 Qdrant에 저장

    Args:
        document_id: UserDocument ID
        chunks: 페이지별 청크 리스트
        embeddings: 임베딩 벡터 리스트

    Returns:
        List[str]: 생성된 Qdrant point ID 리스트
    """
    from qdrant_client.models import PointStruct

    points = []

    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        point_id = str(uuid.uuid4())

        point = PointStruct(
            id=point_id,
            vector=embedding,
            payload={
                'document_id': document_id,
                'page': chunk['page'],
                'text': chunk['text'],
                'char_count': chunk['char_count'],
                'chunk_index': i,
                **chunk['metadata']
            }
        )

        points.append(point)

    # Qdrant에 batch upsert
    qdrant_client.upsert(
        collection_name=COLLECTION_USER_DOCS,
        points=points
    )

    point_ids = [p.id for p in points]
    logger.info(f"Stored {len(points)} points in Qdrant collection '{COLLECTION_USER_DOCS}'")

    return point_ids


def process_uploaded_document(document_id: int):
    """
    업로드된 문서 처리 메인 파이프라인

    1. S3에서 PDF 다운로드
    2. PDF 파싱 (페이지별)
    3. 임베딩 생성
    4. Qdrant 저장
    5. Document 상태 업데이트

    Args:
        document_id: Document ID (doc_id)
    """
    temp_pdf_path = None

    try:
        # 1. 문서 조회
        document = Document.objects.get(doc_id=document_id)
        logger.info(f"Processing document {document_id}: {document.original_filename}")

        # 2. S3에서 다운로드
        import os
        file_ext = os.path.splitext(document.original_filename)[1].lower()
        if not file_ext:
            file_ext = '.pdf' # Default
            
        temp_pdf_path = download_from_s3(document.s3_key, file_ext)

        # 3. 문서 파싱 (확장자에 따른 분기)
        from agent_core.parsers import parse_document
        chunks = parse_document(temp_pdf_path, document.original_filename)

        if not chunks:
            raise ValueError("No valid content extracted from document")

        # 4. 임베딩 생성 (배치 처리)
        texts = [chunk['text'] for chunk in chunks]
        embeddings = generate_embeddings_batch(texts)

        # 5. Qdrant 저장
        point_ids = store_chunks_in_qdrant(document_id, chunks, embeddings)

        # 6. Document 업데이트: ready
        document.qdrant_point_ids = point_ids
        document.upload_status = 'ready'
        document.error_message = None
        document.save()

        logger.info(
            f"✓ Document {document_id} processed successfully: "
            f"{len(chunks)} chunks, {len(point_ids)} vectors"
        )

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

    finally:
        # 임시 파일 삭제
        if temp_pdf_path and Path(temp_pdf_path).exists():
            Path(temp_pdf_path).unlink()
            logger.debug(f"Deleted temporary file: {temp_pdf_path}")
