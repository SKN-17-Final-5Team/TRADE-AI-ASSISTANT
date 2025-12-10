"""
문서 색인 서비스 (Ingest Service)

S3에 업로드된 PDF를 파싱하여 Qdrant에 색인합니다.
"""

import os
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class IngestService:
    """문서 색인 서비스 (싱글톤)"""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._init_clients()

    def _init_clients(self):
        """클라이언트 초기화"""
        try:
            # S3 클라이언트
            import boto3
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                region_name=os.getenv("AWS_REGION", "ap-northeast-2")
            )
            self.s3_bucket = os.getenv("AWS_S3_BUCKET_NAME", "trade-ai-documents")

            # Qdrant 클라이언트
            from qdrant_client import QdrantClient

            qdrant_url = os.getenv("QDRANT_URL")
            qdrant_key = os.getenv("QDRANT_API_KEY")

            if qdrant_url and qdrant_key:
                self.qdrant = QdrantClient(url=qdrant_url, api_key=qdrant_key)
            else:
                self.qdrant = QdrantClient(
                    host=os.getenv("QDRANT_HOST", "localhost"),
                    port=int(os.getenv("QDRANT_PORT", 6333))
                )

            # OpenAI Embeddings
            from openai import OpenAI
            self.openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            self.embedding_model = "text-embedding-3-small"

            self._initialized = True
            logger.info("IngestService initialized")

        except Exception as e:
            logger.error(f"IngestService init failed: {e}")
            raise

    def _download_from_s3(self, s3_key: str) -> bytes:
        """S3에서 파일 다운로드"""
        response = self.s3_client.get_object(Bucket=self.s3_bucket, Key=s3_key)
        return response['Body'].read()

    def _parse_pdf(self, pdf_bytes: bytes) -> str:
        """PDF 파싱 (텍스트 추출)"""
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            return text
        except ImportError:
            # fallback: pdfplumber
            import pdfplumber
            import io
            text = ""
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            return text

    def _chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """텍스트 청킹"""
        if not text:
            return []

        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            if chunk.strip():
                chunks.append(chunk.strip())
            start = end - overlap

        return chunks

    def _get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """텍스트 임베딩 생성"""
        if not texts:
            return []

        response = self.openai.embeddings.create(
            model=self.embedding_model,
            input=texts
        )
        return [item.embedding for item in response.data]

    async def ingest_document(
        self,
        doc_id: int,
        s3_key: str,
        collection_name: str = "user_documents"
    ) -> Dict[str, Any]:
        """
        문서 색인

        Args:
            doc_id: 문서 ID
            s3_key: S3 키
            collection_name: Qdrant 컬렉션명

        Returns:
            색인 결과 (chunks_count 등)
        """
        logger.info(f"Ingesting document: doc_id={doc_id}, s3_key={s3_key}")

        try:
            # 1. S3에서 다운로드
            pdf_bytes = self._download_from_s3(s3_key)

            # 2. PDF 파싱
            text = self._parse_pdf(pdf_bytes)
            if not text:
                raise ValueError("PDF 텍스트 추출 실패")

            # 3. 청킹
            chunks = self._chunk_text(text)
            if not chunks:
                raise ValueError("청킹 결과 없음")

            # 4. 임베딩
            embeddings = self._get_embeddings(chunks)

            # 5. Qdrant에 저장
            from qdrant_client.models import PointStruct

            points = []
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                points.append(PointStruct(
                    id=f"{doc_id}_{i}",
                    vector=embedding,
                    payload={
                        "doc_id": doc_id,
                        "chunk_index": i,
                        "text": chunk,
                        "s3_key": s3_key
                    }
                ))

            # 컬렉션 존재 확인/생성
            self._ensure_collection(collection_name, len(embeddings[0]) if embeddings else 1536)

            # 업서트
            self.qdrant.upsert(collection_name=collection_name, points=points)

            logger.info(f"Document indexed: doc_id={doc_id}, chunks={len(chunks)}")
            return {"chunks_count": len(chunks), "doc_id": doc_id}

        except Exception as e:
            logger.error(f"Ingest failed for doc_id={doc_id}: {e}")
            raise

    def _ensure_collection(self, collection_name: str, vector_size: int = 1536):
        """컬렉션 존재 확인/생성"""
        try:
            collections = self.qdrant.get_collections().collections
            if collection_name not in [c.name for c in collections]:
                from qdrant_client.models import VectorParams, Distance
                self.qdrant.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE)
                )
                logger.info(f"Collection created: {collection_name}")
        except Exception as e:
            logger.warning(f"Collection check failed: {e}")

    async def delete_document(
        self,
        doc_id: int,
        collection_name: str = "user_documents"
    ) -> int:
        """
        문서 색인 삭제

        Args:
            doc_id: 문서 ID
            collection_name: Qdrant 컬렉션명

        Returns:
            삭제된 청크 수
        """
        logger.info(f"Deleting document: doc_id={doc_id}")

        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue

            # doc_id로 필터링하여 삭제
            result = self.qdrant.delete(
                collection_name=collection_name,
                points_selector=Filter(
                    must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
                )
            )

            # 삭제된 수 추정 (Qdrant는 정확한 수 반환 안함)
            logger.info(f"Document deleted: doc_id={doc_id}")
            return 1  # 성공 시 1 반환

        except Exception as e:
            logger.error(f"Delete failed for doc_id={doc_id}: {e}")
            raise


# ==================== 싱글톤 인스턴스 반환 ====================

def get_ingest_service() -> Optional[IngestService]:
    """Ingest 서비스 인스턴스 반환"""
    try:
        return IngestService()
    except Exception as e:
        logger.warning(f"IngestService disabled: {e}")
        return None
