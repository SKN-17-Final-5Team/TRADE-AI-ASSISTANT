"""환경변수 설정 (pydantic-settings) - 실제 config.py 기준"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """AI Server 설정"""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # OpenAI
    OPENAI_API_KEY: str

    # Qdrant
    QDRANT_URL: str | None = None
    QDRANT_API_KEY: str | None = None
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333

    # Mem0
    MEM0_API_KEY: str | None = None

    # Langfuse
    LANGFUSE_PUBLIC_KEY: str | None = None
    LANGFUSE_SECRET_KEY: str | None = None
    LANGFUSE_BASE_URL: str = "https://cloud.langfuse.com"

    # Tavily
    TAVILY_API_KEY: str | None = None

    # AWS S3
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_S3_REGION_NAME: str = "ap-northeast-2"
    AWS_STORAGE_BUCKET_NAME: str | None = None

    # Reranker (RunPod)
    RERANKER_API_URL: str = "http://your-runpod-server/rerank"

    # Collections (실제 이름 기준)
    COLLECTION_KNOWLEDGE: str = "collection_trade"
    COLLECTION_USER_DOCS: str = "collection_trade_user_documents"

    # 하위 호환성 별칭
    @property
    def COLLECTION_NAME(self) -> str:
        return self.COLLECTION_KNOWLEDGE

    # Models
    EMBEDDING_MODEL: str = "text-embedding-3-large"
    VECTOR_SIZE: int = 3072
    AGENT_MODEL: str = "gpt-4o"

    # Reranker 설정
    USE_RERANKER: bool = True
    USE_PER_QUERY_RERANK: bool = True

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
