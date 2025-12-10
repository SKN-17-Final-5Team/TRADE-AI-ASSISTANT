"""
헬스체크 API

서버 상태 및 의존성 상태 확인
"""

from fastapi import APIRouter

from schemas.response import HealthResponse
from config.settings import get_settings
from config.langfuse import is_langfuse_enabled
from config.clients import get_qdrant_client

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    서버 헬스체크

    Returns:
        서버 상태 및 의존성 상태
    """
    settings = get_settings()

    # 서비스 상태 체크
    services = {
        "langfuse": is_langfuse_enabled(),
        "qdrant": False,
        "openai": bool(settings.OPENAI_API_KEY),
        "tavily": bool(settings.TAVILY_API_KEY),
    }

    # Qdrant 연결 체크
    try:
        client = get_qdrant_client()
        if client:
            client.get_collections()
            services["qdrant"] = True
    except Exception:
        pass

    return HealthResponse(
        status="ok",
        version="1.0.0",
        services=services
    )


@router.get("/")
async def root():
    """루트 엔드포인트"""
    return {"message": "AI Server is running", "version": "1.0.0"}
