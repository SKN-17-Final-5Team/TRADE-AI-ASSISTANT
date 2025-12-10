"""
AI Server - FastAPI 메인 엔트리포인트

무역 AI 어시스턴트 AI 서버
"""

import os
import logging
from contextlib import asynccontextmanager

# 환경변수 로드 (.env 파일)
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.settings import get_settings
from api import (
    health_router,
    trade_router,
    document_router,
    memory_router,
    ingest_router,
)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 수명주기 관리"""
    # 시작 시
    settings = get_settings()
    logger.info("🚀 AI Server 시작")
    logger.info(f"   환경: {settings.ENVIRONMENT}")
    logger.info(f"   디버그: {settings.DEBUG}")

    yield

    # 종료 시
    logger.info("👋 AI Server 종료")


# FastAPI 앱 생성
app = FastAPI(
    title="Trade AI Assistant - AI Server",
    description="무역 AI 어시스턴트 AI 서버 API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 설정 (지연 로딩을 위해 함수로 래핑)
def setup_cors(app: FastAPI):
    """CORS 미들웨어 설정"""
    try:
        settings = get_settings()
        origins = settings.CORS_ORIGINS
    except Exception:
        origins = ["*"]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

setup_cors(app)

# 라우터 등록
app.include_router(health_router)
app.include_router(trade_router, prefix="/api")
app.include_router(document_router, prefix="/api")
app.include_router(memory_router, prefix="/api")
app.include_router(ingest_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.DEBUG
    )
