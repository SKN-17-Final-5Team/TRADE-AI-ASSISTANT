"""외부 서비스 클라이언트"""

from functools import lru_cache
from openai import OpenAI
from qdrant_client import QdrantClient

from .settings import get_settings


@lru_cache
def get_openai_client() -> OpenAI:
    """OpenAI 클라이언트 (싱글톤)"""
    settings = get_settings()
    return OpenAI(api_key=settings.OPENAI_API_KEY)


@lru_cache
def get_qdrant_client() -> QdrantClient:
    """Qdrant 클라이언트 (싱글톤)"""
    settings = get_settings()

    if settings.QDRANT_URL and settings.QDRANT_API_KEY:
        return QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY,
            timeout=60
        )
    return QdrantClient(
        host=settings.QDRANT_HOST,
        port=settings.QDRANT_PORT,
        timeout=60
    )


# 편의를 위한 직접 접근 (기존 코드 호환)
def get_clients():
    """클라이언트 튜플 반환 (qdrant, openai)"""
    return get_qdrant_client(), get_openai_client()
