# AI Server 분리 계획 

> **목표**: `backend/agent_core/`를 별도 FastAPI 서버(`ai-server/`)로 분리
> **범위**: 에이전트 서버 분리만 (프론트엔드, 모델, 앱 구조 변경 없음)
---

## 현재 구조 (실제 코드 기준)

```
backend/
├── agent_core/                    # ← 이것을 분리
│   ├── __init__.py
│   ├── agents.py                  # Agent 팩토리 (3개 에이전트) - Langfuse 연동
│   ├── config.py                  # Qdrant, OpenAI 클라이언트 + 설정 상수
│   ├── langfuse_config.py         # Langfuse SDK 클라이언트 + 프롬프트 로딩
│   ├── pdf_parser.py              # PDF 파싱 (PyMuPDF)
│   ├── s3_utils.py                # S3 유틸리티
│   ├── collection_manager.py      # Qdrant 컬렉션 관리
│   ├── utils.py                   # 디버그 유틸리티 (print_retrieved_documents)
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── search_tool.py         # RAG 검색 (쿼리변환 + 병렬검색 + Reranking)
│   │   └── web_search_tool.py     # 웹 검색 (Tavily)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── reranker_service.py    # RunPod Reranker API 호출
│   │   └── query_transformer_service.py  # 쿼리 변환/분해 (LLM 기반)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── query_transformer.py   # QueryTransformResult
│   │   └── reranker.py            # RerankRequest/Response/Result
│   └── prompts/
│       ├── __init__.py
│       ├── fallback.py            # 로컬 fallback 프롬프트 (DOCUMENT_WRITING/READ)
│       └── trade_instructions.txt # 무역 전문가 프롬프트 (196줄) ← 누락됐던 파일!
├── chat/
│   ├── trade_views.py             # Agent 직접 호출 → HTTP 호출로 변경
│   ├── views.py                   # Agent 직접 호출 → HTTP 호출로 변경
│   ├── config.py                  # PROMPT_VERSION, PROMPT_LABEL 설정
│   └── memory_service.py          # Mem0 메모리 서비스 → AI Server로 이동
└── documents/
    └── services.py                # Qdrant 접근 → HTTP 호출로 변경
```

---

## 목표 구조

### Django Backend (수정)

```
backend/
├── chat/
│   ├── trade_views.py             # HTTP로 AI Server 호출
│   ├── views.py                   # HTTP로 AI Server 호출
│   ├── config.py                  # PROMPT_VERSION, PROMPT_LABEL (유지)
│   └── memory_service.py          # 프록시 또는 삭제
├── documents/
│   └── services.py                # HTTP로 AI Server 호출
└── utils/
    └── ai_client.py               # [신규] AI Server HTTP 클라이언트
```

### AI Server

```
ai-server/
├── main.py                        # FastAPI 앱 진입점
├── api/                           # API 라우터
│   ├── __init__.py
│   ├── health.py                  # GET /health, /ready
│   ├── trade.py                   # POST /api/agent/trade[/stream]
│   ├── write.py                   # POST /api/agent/write[/stream]
│   ├── read.py                    # POST /api/agent/read[/stream]
│   ├── ingest.py                  # POST /api/ingest
│   └── memory.py                  # POST /api/memory/*
├── agents/                        # Agent 정의
│   ├── __init__.py
│   ├── trade_agent.py             # 무역 Q&A Agent (Langfuse 연동)
│   ├── write_agent.py             # 문서 작성 Agent (Langfuse 연동)
│   └── read_agent.py              # 문서 읽기 Agent (Langfuse 연동)
├── tools/                         # Agent 도구 + 헬퍼 (플랫 구조)
│   ├── __init__.py
│   ├── search_tool.py             # @function_tool - RAG 검색 (async)
│   ├── web_search_tool.py         # @function_tool - Tavily 웹 검색
│   ├── reranker.py                # RunPod Reranker API 클라이언트
│   └── query_transformer.py       # 쿼리 변환/분해 서비스
├── services/                      # API에서 직접 호출하는 서비스
│   ├── __init__.py
│   ├── memory.py                  # Mem0 메모리 서비스
│   └── ingest.py                  # 문서 벡터화 파이프라인
├── schemas/                       # API 요청/응답 스키마
│   ├── __init__.py
│   ├── request.py                 # 요청 모델
│   └── response.py                # 응답 모델
├── models/                        # Pydantic 데이터 모델
│   ├── __init__.py
│   ├── query_transformer.py       # QueryTransformResult
│   └── reranker.py                # RerankRequest/Response/Result
├── utils/                         # 유틸리티
│   ├── __init__.py
│   ├── pdf_parser.py              # PDF 파싱
│   ├── s3.py                      # S3 다운로드
│   ├── collection_manager.py      # Qdrant 컬렉션 관리
│   └── debug.py                   # 디버그 출력 (print_retrieved_documents)
├── config/                        # 설정
│   ├── __init__.py
│   ├── settings.py                # pydantic-settings 환경변수
│   ├── clients.py                 # Qdrant, OpenAI 클라이언트
│   ├── langfuse.py                # Langfuse SDK + 프롬프트 로딩
│   └── prompts/                   # 프롬프트 상수
│       ├── __init__.py
│       ├── fallback.py            # DOCUMENT_WRITING_PROMPT, DOCUMENT_READ_PROMPT
│       └── trade_instructions.txt # 무역 전문가 프롬프트 (196줄)
├── requirements.txt
└── .env.example
```

---

## Phase 1: 프로젝트 기본 구조 생성

### 1.1 디렉토리 및 기본 파일 생성

```bash
mkdir -p ai-server/{api,agents,tools,services,schemas,models,utils,config/prompts}
touch ai-server/{api,agents,tools,services,schemas,models,utils,config}/__init__.py
touch ai-server/config/prompts/__init__.py
```

### 1.2 requirements.txt

```
# Web Framework
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
sse-starlette>=2.0.0

# OpenAI & Agents
openai>=1.58.0
openai-agents>=0.0.7

# Vector Database
qdrant-client>=1.12.0

# Memory
mem0ai>=0.1.38

# Monitoring
langfuse>=2.56.0

# Web Search
tavily-python>=0.5.0

# AWS
boto3>=1.35.0

# PDF Processing
pymupdf>=1.24.0

# HTTP Client
httpx>=0.27.0

# Settings
pydantic-settings>=2.2.0
python-dotenv>=1.0.0
```

### 1.3 config/settings.py

```python
"""환경변수 설정 (pydantic-settings) - 실제 config.py 기준"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """AI Server 설정"""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    DEBUG: bool = False

    # OpenAI
    OPENAI_API_KEY: str

    # Qdrant
    QDRANT_URL: str | None = None
    QDRANT_API_KEY: str | None = None
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333

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
```

### 1.4 config/clients.py

```python
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
```

### 1.5 config/langfuse.py

```python
"""Langfuse 설정 및 프롬프트 로딩 유틸리티 - 실제 langfuse_config.py 기준"""

import os
from functools import lru_cache
from pathlib import Path

from .settings import get_settings

# Langfuse 활성화 여부
_settings = get_settings()
LANGFUSE_ENABLED = bool(_settings.LANGFUSE_PUBLIC_KEY and _settings.LANGFUSE_SECRET_KEY)

# Langfuse 클라이언트 싱글톤
_langfuse_client = None


def get_langfuse_client():
    """Langfuse 클라이언트 싱글톤 반환"""
    global _langfuse_client
    if _langfuse_client is None and LANGFUSE_ENABLED:
        from langfuse import Langfuse
        settings = get_settings()
        _langfuse_client = Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            host=settings.LANGFUSE_BASE_URL
        )
        print("✅ Langfuse SDK 클라이언트 초기화 완료")
    return _langfuse_client


def load_prompt_from_langfuse(
    prompt_name: str,
    version: int | None = None,
    label: str = "latest",
    **variables
) -> str:
    """
    Langfuse SDK를 통해 프롬프트를 가져오고 변수 치환

    Args:
        prompt_name: Langfuse에 등록된 프롬프트 이름
        version: 특정 버전 번호 (None이면 label 기준)
        label: 버전 레이블 ("production", "latest" 등)
        **variables: 프롬프트 템플릿 변수들

    Returns:
        변수가 치환된 프롬프트 문자열
    """
    client = get_langfuse_client()
    if not client:
        raise Exception("Langfuse가 비활성화되어 있습니다")

    try:
        if version is not None:
            prompt = client.get_prompt(prompt_name, version=version)
            print(f"✅ Langfuse 프롬프트 로드: {prompt_name} (버전: {version})")
        else:
            prompt = client.get_prompt(prompt_name, label=label)
            print(f"✅ Langfuse 프롬프트 로드: {prompt_name} (label: {label})")

        if variables:
            return prompt.compile(**variables)
        else:
            return prompt.compile()

    except Exception as e:
        raise Exception(f"Langfuse 프롬프트 로드 실패: {e}")


def load_prompt_from_file(filename: str = "trade_instructions.txt") -> str:
    """
    로컬 파일에서 프롬프트 로드 (Fallback용)

    Args:
        filename: 프롬프트 파일명 (prompts/ 디렉토리 내)

    Returns:
        파일 내용 (프롬프트 문자열)
    """
    current_dir = Path(__file__).parent
    prompts_dir = current_dir / "prompts"
    file_path = prompts_dir / filename

    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()
```

### 1.6 .env.example

```bash
# OpenAI
OPENAI_API_KEY=sk-xxx

# Qdrant (Cloud)
QDRANT_URL=https://xxx.qdrant.io
QDRANT_API_KEY=xxx

# Qdrant (Local - QDRANT_URL 없을 때)
# QDRANT_HOST=localhost
# QDRANT_PORT=6333

# Langfuse (프롬프트 버전 관리)
LANGFUSE_PUBLIC_KEY=pk-xxx
LANGFUSE_SECRET_KEY=sk-xxx
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# Tavily (웹 검색)
TAVILY_API_KEY=tvly-xxx

# Reranker (RunPod)
RERANKER_API_URL=http://your-runpod-server/rerank

# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_REGION_NAME=ap-northeast-2
AWS_STORAGE_BUCKET_NAME=xxx

# Reranker 설정
USE_RERANKER=true
USE_PER_QUERY_RERANK=true

# Server
DEBUG=false
```

### 1.7 main.py (FastAPI 앱 진입점)

```python
"""AI Server - FastAPI 진입점

이 파일은 AI Server의 메인 엔트리포인트입니다.
모든 라우터를 등록하고 앱을 초기화합니다.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import health, trade, write, read, ingest, memory
from config.settings import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 리소스 관리"""
    settings = get_settings()
    # Startup
    print(f"🚀 AI Server starting... (debug={settings.DEBUG})")
    yield
    # Shutdown
    print("👋 AI Server shutting down...")


app = FastAPI(
    title="AI Server",
    description="무역 AI 에이전트 서버",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(health.router, tags=["Health"])
app.include_router(trade.router, prefix="/api/agent", tags=["Trade Agent"])
app.include_router(write.router, prefix="/api/agent", tags=["Write Agent"])
app.include_router(read.router, prefix="/api/agent", tags=["Read Agent"])
app.include_router(ingest.router, prefix="/api", tags=["Ingest"])
app.include_router(memory.router, prefix="/api", tags=["Memory"])


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.DEBUG,
    )
```

---

## Phase 2: Models (Pydantic 데이터 모델)

**그대로 복사** (import 경로 변경 불필요):

| 원본 | 대상 |
|------|------|
| `agent_core/models/query_transformer.py` | `models/query_transformer.py` |
| `agent_core/models/reranker.py` | `models/reranker.py` |

**models/__init__.py** 생성:
```python
from .query_transformer import QueryTransformResult
from .reranker import RerankRequest, RerankResult, RerankResponse
__all__ = ["QueryTransformResult", "RerankRequest", "RerankResult", "RerankResponse"]
```

---

## Phase 3: Tools (검색 도구)

### 파일 매핑

| 원본 | 대상 | 수정 사항 |
|------|------|----------|
| `agent_core/services/reranker_service.py` | `tools/reranker.py` | import 경로만 변경 |
| `agent_core/services/query_transformer_service.py` | `tools/query_transformer.py` | import 경로만 변경 |
| `agent_core/tools/search_tool.py` | `tools/search_tool.py` | import 경로 변경 (아래 참조) |
| `agent_core/tools/web_search_tool.py` | `tools/web_search_tool.py` | 변경 없음 |

### 주의사항

#### 3.1 search_tool.py 변경사항

**import 변경**:
```python
# 원본
from agent_core.config import qdrant_client, openai_client, COLLECTION_NAME, ...

# 변경
from config.clients import get_qdrant_client, get_openai_client
from config.settings import get_settings
from tools.reranker import call_reranker_api
from tools.query_transformer import rewrite_and_decompose_query
```

**함수 내부 변경** - 전역 변수 → 함수 호출:
```python
# 원본: 전역 변수 직접 사용
qdrant_client.query_points(...)
openai_client.embeddings.create(...)

# 변경: 함수 시작 부분에서 클라이언트/설정 획득
settings = get_settings()
qdrant = get_qdrant_client()
openai = get_openai_client()

# 이후 사용
qdrant.query_points(collection_name=settings.COLLECTION_NAME, ...)
openai.embeddings.create(model=settings.EMBEDDING_MODEL, ...)
```

#### 3.2 reranker.py, query_transformer.py import 변경

```python
# reranker.py
from config.settings import get_settings  # RERANKER_API_URL 대신
from models.reranker import RerankRequest, RerankResponse

# query_transformer.py  
from config.clients import get_openai_client  # openai_client 대신
from models.query_transformer import QueryTransformResult
```

#### 3.3 COLLECTION_NAME 별칭

`settings.COLLECTION_NAME`은 `settings.COLLECTION_KNOWLEDGE`의 property 별칭 (settings.py에 이미 정의됨)

#### 3.4 tools/__init__.py

```python
from .search_tool import search_trade_documents, search_user_document
from .web_search_tool import search_web
from .reranker import call_reranker_api
from .query_transformer import rewrite_and_decompose_query
__all__ = ["search_trade_documents", "search_user_document", "search_web", "call_reranker_api", "rewrite_and_decompose_query"]
```

---

## Phase 4: Utils (유틸리티)

### 파일 매핑

| 원본 | 대상 | 수정 사항 |
|------|------|----------|
| `agent_core/utils.py` | `utils/debug.py` | 변경 없음 |
| `agent_core/pdf_parser.py` | `utils/pdf_parser.py` | 변경 없음 |
| `agent_core/s3_utils.py` | `utils/s3.py` | **Django 의존성 제거** (아래 참조) |
| `agent_core/collection_manager.py` | `utils/collection_manager.py` | 변경 없음 |

### 주의사항

#### 4.1 utils/s3.py (신규 작성)

실제 `s3_utils.py`는 Django 의존성이 있는 `S3Manager` 클래스입니다.
AI Server에서는 **다운로드 기능만 필요**하므로 간단한 함수로 작성:

```python
"""S3 다운로드 유틸리티"""

import os
import tempfile
import boto3
from botocore.config import Config

from config.settings import get_settings


def download_from_s3(s3_key: str) -> str:
    """
    S3에서 파일을 다운로드하여 임시 경로 반환
    
    Args:
        s3_key: S3 파일 키 (예: "documents/xxx.pdf")
    
    Returns:
        str: 다운로드된 임시 파일 경로
    """
    settings = get_settings()
    
    s3_client = boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME,
        config=Config(signature_version='s3v4')
    )
    
    # 임시 파일 생성
    suffix = os.path.splitext(s3_key)[1] or '.pdf'
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_path = temp_file.name
    temp_file.close()
    
    # S3에서 다운로드
    s3_client.download_file(
        Bucket=settings.AWS_STORAGE_BUCKET_NAME,
        Key=s3_key,
        Filename=temp_path
    )
    
    return temp_path
```

#### 4.2 utils/__init__.py

```python
from .debug import print_retrieved_documents, dedup_consecutive_lines
from .pdf_parser import production_pdf_pipeline, parse_pdf_for_rag_enhanced
from .s3 import download_from_s3
from .collection_manager import CollectionManager
```

---

## Phase 5: Agents (Langfuse 연동 포함)

### 5.1 agents/trade_agent.py

```python
"""무역 Q&A Agent - 실제 agents.py 기준 (Langfuse 연동)

주의: 실제 코드에서는 model="gpt-4o" 하드코딩을 사용함!
ai-server에서는 settings.AGENT_MODEL 사용을 권장하지만,
실제 코드와 동일하게 유지하려면 하드코딩 패턴을 따를 것.
"""

from agents import Agent

from tools import search_trade_documents, search_web
from config.langfuse import (
    LANGFUSE_ENABLED,
    load_prompt_from_langfuse,
    load_prompt_from_file,
)


def get_trade_agent(
    prompt_version: int | None = None,
    prompt_label: str = "latest"
) -> Agent:
    """
    무역 전문가 Agent 생성

    일반 무역 관련 질의응답을 처리하는 Agent
    Langfuse 우선 로드, 실패 시 로컬 프롬프트 사용

    Args:
        prompt_version: Langfuse 프롬프트 특정 버전 (None이면 label 기준)
        prompt_label: Langfuse 프롬프트 레이블 ("production", "latest" 등)

    Returns:
        Agent 인스턴스
    """
    if LANGFUSE_ENABLED:
        try:
            instructions = load_prompt_from_langfuse(
                prompt_name="trade_assistant_v1",
                version=prompt_version,
                label=prompt_label
            )
        except Exception as e:
            print(f"⚠️ Langfuse 로드 실패, 로컬 프롬프트로 대체: {e}")
            instructions = load_prompt_from_file()
    else:
        print("📁 Langfuse 비활성화, 로컬 프롬프트 사용")
        instructions = load_prompt_from_file()

    return Agent(
        name="Trade Compliance Analyst",
        model="gpt-4o",  # 실제 코드: 하드코딩 (settings.AGENT_MODEL 아님!)
        instructions=instructions,
        tools=[search_trade_documents, search_web],
    )
```

### 5.2 agents/write_agent.py

```python
"""문서 작성 Agent - 실제 agents.py 기준 (Langfuse 연동)"""

from agents import Agent

from tools import search_trade_documents, search_web
from config.langfuse import (
    LANGFUSE_ENABLED,
    load_prompt_from_langfuse,
)
from config.prompts.fallback import DOCUMENT_WRITING_PROMPT


def get_document_writing_agent(
    document_content: str,
    prompt_version: int | None = None,
    prompt_label: str = "latest"
) -> Agent:
    """
    문서 작성 Agent 생성 (읽기 + 수정 기능)

    trade_agent의 모든 기능 + 문서 편집 기능
    Langfuse 우선 로드, 실패 시 로컬 프롬프트 사용

    Args:
        document_content: 현재 에디터의 HTML 내용
        prompt_version: Langfuse 프롬프트 특정 버전
        prompt_label: Langfuse 프롬프트 레이블

    Returns:
        Agent 인스턴스
    """
    if LANGFUSE_ENABLED:
        try:
            instructions = load_prompt_from_langfuse(
                prompt_name="writing_assistant_v1",
                version=prompt_version,
                label=prompt_label,
                document_content=document_content
            )
        except Exception as e:
            print(f"⚠️ Langfuse 로드 실패, 로컬 프롬프트로 대체: {e}")
            instructions = DOCUMENT_WRITING_PROMPT.format(
                document_content=document_content
            )
    else:
        print("📁 Langfuse 비활성화, 로컬 프롬프트 사용")
        instructions = DOCUMENT_WRITING_PROMPT.format(
            document_content=document_content
        )

    return Agent(
        name="Document Writing Assistant",
        model="gpt-4o",  # 실제 코드: 하드코딩 (settings.AGENT_MODEL 아님!)
        instructions=instructions,
        tools=[search_trade_documents, search_web],
    )
```

### 5.3 agents/read_agent.py

```python
"""문서 읽기 Agent - 실제 agents.py 기준 (Langfuse 연동)"""

from agents import Agent

from tools import search_user_document, search_trade_documents, search_web
from config.langfuse import (
    LANGFUSE_ENABLED,
    load_prompt_from_langfuse,
)
from config.prompts.fallback import DOCUMENT_READ_PROMPT


def get_read_document_agent(
    document_id: int,
    document_name: str,
    document_type: str = "문서",
    prompt_version: int | None = None,
    prompt_label: str = "latest"
) -> Agent:
    """
    업로드 문서 전용 Agent 생성

    일반 무역 질의 + 현재 문서 내용 질의를 모두 처리하는 하이브리드 Agent
    Langfuse 우선 로드, 실패 시 로컬 프롬프트 사용

    Args:
        document_id: 현재 문서 ID
        document_name: 문서 파일명 (예: "Sales_Contract_ABC.pdf")
        document_type: 문서 타입 (예: "Offer Sheet", "Sales Contract")
        prompt_version: Langfuse 프롬프트 특정 버전
        prompt_label: Langfuse 프롬프트 레이블

    Returns:
        Agent 인스턴스
    """
    if LANGFUSE_ENABLED:
        try:
            instructions = load_prompt_from_langfuse(
                prompt_name="document_assistant_v1",
                version=prompt_version,
                label=prompt_label,
                document_id=document_id,
                document_name=document_name,
                document_type=document_type
            )
        except Exception as e:
            print(f"⚠️ Langfuse 로드 실패, 로컬 프롬프트로 대체: {e}")
            instructions = DOCUMENT_READ_PROMPT.format(
                document_id=document_id,
                document_name=document_name,
                document_type=document_type
            )
    else:
        print("📁 Langfuse 비활성화, 로컬 프롬프트 사용")
        instructions = DOCUMENT_READ_PROMPT.format(
            document_id=document_id,
            document_name=document_name,
            document_type=document_type
        )

    return Agent(
        name="Document Reader Assistant",
        model="gpt-4o",  # 실제 코드: 하드코딩 (settings.AGENT_MODEL 아님!)
        instructions=instructions,
        tools=[search_user_document, search_trade_documents, search_web],
    )
```

### 5.4 agents/__init__.py

```python
"""Agent Factories"""

from .trade_agent import get_trade_agent
from .write_agent import get_document_writing_agent
from .read_agent import get_read_document_agent

__all__ = [
    "get_trade_agent",
    "get_document_writing_agent",
    "get_read_document_agent",
]
```

---

## Phase 6: Prompts (로컬 Fallback)

### 6.1 config/prompts/fallback.py

`backend/agent_core/prompts/fallback.py` → `ai-server/config/prompts/fallback.py` (그대로 복사)

**주의**: 이 파일은 115줄의 `DOCUMENT_WRITING_PROMPT`와 85줄의 `DOCUMENT_READ_PROMPT`를 포함합니다.

### 6.2 config/prompts/trade_instructions.txt

`backend/agent_core/prompts/trade_instructions.txt` → `ai-server/config/prompts/trade_instructions.txt` (그대로 복사)

**주의**: 이 파일은 **196줄**의 상세 무역 전문가 프롬프트입니다. 절대 누락하면 안 됩니다!

---

## Phase 7: API 스키마 (수정)

### 7.1 schemas/request.py

```python
"""API 요청 스키마 - 실제 Django View 및 TradeMemoryService 호환

주의: 메모리 관련 스키마는 실제 memory_service.py의 메서드 시그니처와 일치해야 함!
"""

from pydantic import BaseModel
from typing import List, Dict, Optional


class AgentRequest(BaseModel):
    """Agent 호출 요청 (공통)"""
    message: str
    conversation_history: List[Dict] = []
    user_id: int

    # 문서 관련 (선택)
    document_id: Optional[int] = None
    document_content: Optional[str] = None

    # 문서 읽기용 추가 필드
    document_name: Optional[str] = None
    document_type: Optional[str] = None

    # 컨텍스트 (선택)
    user_context: Optional[str] = None
    buyer_name: Optional[str] = None

    # Langfuse 프롬프트 버전 관리 (중요!)
    prompt_version: Optional[int] = None
    prompt_label: str = "latest"


class IngestRequest(BaseModel):
    """문서 벡터화 요청"""
    s3_key: str
    document_id: int
    collection: Optional[str] = None


# ==================== 메모리 요청 스키마 (실제 코드 기준) ====================

class MemorySaveRequest(BaseModel):
    """개별 메모리 저장 요청 (단일 타입)"""
    messages: List[Dict]
    user_id: int
    doc_id: Optional[int] = None
    gen_chat_id: Optional[int] = None
    buyer_name: Optional[str] = None


class MemorySmartSaveRequest(BaseModel):
    """
    스마트 메모리 저장 요청 - save_memory_smart() 메서드용
    
    실제 시그니처:
    save_memory_smart(messages, user_id, doc_id, gen_chat_id, buyer_name,
                      save_doc, save_user, save_buyer)
    """
    messages: List[Dict]
    user_id: int
    doc_id: Optional[int] = None
    gen_chat_id: Optional[int] = None
    buyer_name: Optional[str] = None
    save_doc: bool = True
    save_user: bool = True
    save_buyer: bool = False


class MemoryQueryRequest(BaseModel):
    """
    메모리 조회 요청
    
    실제 시그니처:
    - get_doc_memory(doc_id, query, limit) ← user_id 없음!
    - get_gen_chat_memory(gen_chat_id, query, limit)
    - get_user_memory(user_id, query, limit)
    - get_buyer_memory(user_id, buyer_name, query, limit)
    """
    user_id: Optional[int] = None  # user/buyer 메모리 조회 시 필요
    doc_id: Optional[int] = None
    gen_chat_id: Optional[int] = None
    buyer_name: Optional[str] = None
    query: Optional[str] = None
    limit: int = 5


class MemoryContextRequest(BaseModel):
    """
    컨텍스트 빌드 요청 - build_doc_context() / build_gen_chat_context() 메서드용
    
    실제 시그니처:
    - build_doc_context(doc_id, user_id, query, buyer_name)
    - build_gen_chat_context(gen_chat_id, user_id, query, is_first_message)
    """
    user_id: int
    doc_id: Optional[int] = None
    gen_chat_id: Optional[int] = None
    query: str
    buyer_name: Optional[str] = None
    is_first_message: bool = False
```

### 7.2 schemas/response.py

```python
"""API 응답 스키마 - 실제 TradeMemoryService 반환값 기준"""

from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class AgentResponse(BaseModel):
    """Agent 응답 (비스트리밍)"""
    content: str
    tools_used: List[Dict] = []
    usage: Optional[Dict] = None


class IngestResponse(BaseModel):
    """문서 벡터화 응답"""
    status: str
    chunks: Optional[int] = None
    point_ids: Optional[List[str]] = None
    error: Optional[str] = None


# ==================== 메모리 응답 스키마 (실제 코드 기준) ====================

class MemoryResponse(BaseModel):
    """
    메모리 저장 응답
    
    save_memory_smart() 반환값:
    {"doc": {...}, "gen_chat": {...}, "user": {...}, "buyer": {...}}
    
    개별 add_* 메서드 반환값: Dict (Mem0 응답)
    """
    result: Optional[Dict] = None  # 개별 저장 시
    doc: Optional[Dict] = None     # 스마트 저장 시
    gen_chat: Optional[Dict] = None
    user: Optional[Dict] = None
    buyer: Optional[Dict] = None


class MemoryQueryResponse(BaseModel):
    """
    메모리 조회 응답
    
    get_*_memory() 반환값: List[Dict]
    """
    memories: List[Dict] = []


class MemoryContextResponse(BaseModel):
    """
    컨텍스트 빌드 응답
    
    build_doc_context() 반환값:
    {
        "doc_memories": [...],
        "user_memories": [...],
        "buyer_memories": [...],
        "context_summary": "문서 이력 3건, 사용자 선호 2건"
    }
    
    build_gen_chat_context() 반환값:
    {
        "chat_memories": [...],
        "user_memories": [...],
        "context_summary": "대화 이력 2건, 사용자 선호 1건"
    }
    """
    doc_memories: List[Dict] = []
    chat_memories: List[Dict] = []
    user_memories: List[Dict] = []
    buyer_memories: List[Dict] = []
    context_summary: str = ""
```

---

## Phase 8: API 엔드포인트 (수정)

### 8.1 api/trade.py

```python
"""무역 Q&A API - Langfuse 버전 관리 지원"""

import logging
from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from agents import Runner
from agents import get_trade_agent
from schemas.request import AgentRequest
from schemas.response import AgentResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/trade", response_model=AgentResponse)
async def trade_chat(request: AgentRequest):
    """무역 Q&A (비스트리밍)"""
    agent = get_trade_agent(
        prompt_version=request.prompt_version,
        prompt_label=request.prompt_label
    )

    messages = request.conversation_history + [
        {"role": "user", "content": request.message}
    ]

    result = await Runner.run(agent, messages)

    return AgentResponse(
        content=result.final_output,
        tools_used=[],
        usage=None
    )


@router.post("/trade/stream")
async def trade_chat_stream(request: AgentRequest):
    """무역 Q&A (SSE 스트리밍)"""
    agent = get_trade_agent(
        prompt_version=request.prompt_version,
        prompt_label=request.prompt_label
    )

    messages = request.conversation_history + [
        {"role": "user", "content": request.message}
    ]

    async def event_generator():
        result = Runner.run_streamed(agent, messages)

        async for event in result.stream_events():
            if event.type == "raw_response_event":
                if hasattr(event.data, 'delta') and event.data.delta:
                    yield {"event": "message", "data": event.data.delta}
            elif event.type == "run_item_stream_event":
                if hasattr(event.item, 'tool_call'):
                    yield {"event": "tool_call", "data": str(event.item.tool_call)}

        yield {"event": "done", "data": "[DONE]"}

    return EventSourceResponse(event_generator())
```

### 8.2 api/write.py

```python
"""문서 작성 API - Langfuse 버전 관리 지원"""

import logging
from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from agents import Runner
from agents import get_document_writing_agent
from schemas.request import AgentRequest
from schemas.response import AgentResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/write", response_model=AgentResponse)
async def write_document(request: AgentRequest):
    """문서 작성 (비스트리밍)"""
    agent = get_document_writing_agent(
        document_content=request.document_content or "",
        prompt_version=request.prompt_version,
        prompt_label=request.prompt_label
    )

    messages = request.conversation_history + [
        {"role": "user", "content": request.message}
    ]

    result = await Runner.run(agent, messages)

    return AgentResponse(
        content=result.final_output,
        tools_used=[],
        usage=None
    )


@router.post("/write/stream")
async def write_document_stream(request: AgentRequest):
    """문서 작성 (SSE 스트리밍)"""
    agent = get_document_writing_agent(
        document_content=request.document_content or "",
        prompt_version=request.prompt_version,
        prompt_label=request.prompt_label
    )

    messages = request.conversation_history + [
        {"role": "user", "content": request.message}
    ]

    async def event_generator():
        result = Runner.run_streamed(agent, messages)

        async for event in result.stream_events():
            if event.type == "raw_response_event":
                if hasattr(event.data, 'delta') and event.data.delta:
                    yield {"event": "message", "data": event.data.delta}
            elif event.type == "run_item_stream_event":
                if hasattr(event.item, 'tool_call'):
                    yield {"event": "tool_call", "data": str(event.item.tool_call)}

        yield {"event": "done", "data": "[DONE]"}

    return EventSourceResponse(event_generator())
```

### 8.3 api/read.py

```python
"""문서 읽기 API - Langfuse 버전 관리 지원"""

import logging
from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from agents import Runner
from agents import get_read_document_agent
from schemas.request import AgentRequest
from schemas.response import AgentResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/read", response_model=AgentResponse)
async def read_document(request: AgentRequest):
    """문서 읽기 (비스트리밍)"""
    agent = get_read_document_agent(
        document_id=request.document_id,
        document_name=request.document_name or f"문서_{request.document_id}",
        document_type=request.document_type or "문서",
        prompt_version=request.prompt_version,
        prompt_label=request.prompt_label
    )

    messages = request.conversation_history + [
        {"role": "user", "content": request.message}
    ]

    result = await Runner.run(agent, messages)

    return AgentResponse(
        content=result.final_output,
        tools_used=[],
        usage=None
    )


@router.post("/read/stream")
async def read_document_stream(request: AgentRequest):
    """문서 읽기 (SSE 스트리밍)"""
    agent = get_read_document_agent(
        document_id=request.document_id,
        document_name=request.document_name or f"문서_{request.document_id}",
        document_type=request.document_type or "문서",
        prompt_version=request.prompt_version,
        prompt_label=request.prompt_label
    )

    messages = request.conversation_history + [
        {"role": "user", "content": request.message}
    ]

    async def event_generator():
        result = Runner.run_streamed(agent, messages)

        async for event in result.stream_events():
            if event.type == "raw_response_event":
                if hasattr(event.data, 'delta') and event.data.delta:
                    yield {"event": "message", "data": event.data.delta}
            elif event.type == "run_item_stream_event":
                if hasattr(event.item, 'tool_call'):
                    yield {"event": "tool_call", "data": str(event.item.tool_call)}

        yield {"event": "done", "data": "[DONE]"}

    return EventSourceResponse(event_generator())
```

### 8.4 api/health.py

```python
"""Health Check API - Kubernetes, Docker, 로드밸런서 호환"""

from fastapi import APIRouter

from config.clients import get_qdrant_client, get_openai_client

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """
    기본 헬스 체크

    서버가 살아있는지만 확인 (의존성 체크 X)
    Docker HEALTHCHECK, 로드밸런서 기본 체크에 사용
    """
    return {"status": "healthy"}


@router.get("/ready")
async def readiness_check():
    """
    상세 준비 상태 체크

    모든 의존성(Qdrant, OpenAI) 연결 상태 확인
    Kubernetes readinessProbe, 서비스 배포 전 검증에 사용
    """
    checks = {}

    # Qdrant 연결 체크
    try:
        qdrant = get_qdrant_client()
        collections = qdrant.get_collections()
        checks["qdrant"] = {
            "status": "connected",
            "collections": len(collections.collections)
        }
    except Exception as e:
        checks["qdrant"] = {"status": "error", "error": str(e)}

    # OpenAI API 체크 (간단한 모델 목록 조회)
    try:
        openai = get_openai_client()
        # 가벼운 API 호출로 연결 확인
        models = openai.models.list()
        checks["openai"] = {"status": "connected"}
    except Exception as e:
        checks["openai"] = {"status": "error", "error": str(e)}

    # 전체 상태 결정
    all_healthy = all(
        c.get("status") == "connected"
        for c in checks.values()
    )

    return {
        "status": "ready" if all_healthy else "degraded",
        "checks": checks
    }
```

### 8.5 api/ingest.py

```python
"""문서 벡터화 API"""

import logging
from fastapi import APIRouter, HTTPException

from schemas.request import IngestRequest
from schemas.response import IngestResponse
from services.ingest import ingest_document

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Ingest"])


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document_endpoint(request: IngestRequest):
    """
    S3 문서를 벡터화하여 Qdrant에 저장

    Args:
        request: IngestRequest (s3_key, document_id, collection)

    Returns:
        IngestResponse (status, chunks, point_ids, error)
    """
    try:
        result = await ingest_document(
            s3_key=request.s3_key,
            document_id=request.document_id,
            collection=request.collection
        )
        return IngestResponse(
            status="success",
            chunks=result.get("chunks"),
            point_ids=result.get("point_ids")
        )
    except Exception as e:
        logger.exception(f"Ingest failed: {e}")
        return IngestResponse(
            status="error",
            error=str(e)
        )
```

### 8.6 api/memory.py

```python
"""메모리 API - 실제 TradeMemoryService 메서드 시그니처 기준

주의: 실제 backend/chat/memory_service.py의 메서드 시그니처와 정확히 일치해야 함!
- add_doc_memory(doc_id, user_id, messages) ← 파라미터 순서 주의
- get_doc_memory(doc_id, query, limit) ← user_id 없음
- save_memory_smart() ← 통합 저장 메서드
- build_doc_context() ← 컨텍스트 빌더
"""

import logging
from fastapi import APIRouter, HTTPException

from schemas.request import (
    MemorySaveRequest,
    MemorySmartSaveRequest,
    MemoryQueryRequest,
    MemoryContextRequest,
)
from schemas.response import MemoryResponse, MemoryQueryResponse, MemoryContextResponse
from services.memory import TradeMemoryService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/memory", tags=["Memory"])

# 메모리 서비스 싱글톤 (TradeMemoryService 자체가 싱글톤이지만 명시적으로 관리)
_memory_service = None


def get_memory_service() -> TradeMemoryService:
    """메모리 서비스 싱글톤 반환"""
    global _memory_service
    if _memory_service is None:
        _memory_service = TradeMemoryService()
    return _memory_service


# ==================== 저장 API ====================

@router.post("/save/doc", response_model=MemoryResponse)
async def save_doc_memory(request: MemorySaveRequest):
    """문서 세션 메모리 저장"""
    try:
        service = get_memory_service()
        # 실제 시그니처: add_doc_memory(doc_id, user_id, messages)
        result = service.add_doc_memory(
            doc_id=request.doc_id,
            user_id=request.user_id,
            messages=request.messages
        )
        return MemoryResponse(result=result)
    except Exception as e:
        logger.exception(f"Doc memory save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save/gen_chat", response_model=MemoryResponse)
async def save_gen_chat_memory(request: MemorySaveRequest):
    """일반채팅 세션 메모리 저장"""
    try:
        service = get_memory_service()
        # 실제 시그니처: add_gen_chat_memory(gen_chat_id, user_id, messages)
        result = service.add_gen_chat_memory(
            gen_chat_id=request.gen_chat_id,
            user_id=request.user_id,
            messages=request.messages
        )
        return MemoryResponse(result=result)
    except Exception as e:
        logger.exception(f"Gen chat memory save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save/user", response_model=MemoryResponse)
async def save_user_memory(request: MemorySaveRequest):
    """사용자 선호도 메모리 저장"""
    try:
        service = get_memory_service()
        # 실제 시그니처: add_user_memory(user_id, messages)
        result = service.add_user_memory(
            user_id=request.user_id,
            messages=request.messages
        )
        return MemoryResponse(result=result)
    except Exception as e:
        logger.exception(f"User memory save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save/buyer", response_model=MemoryResponse)
async def save_buyer_memory(request: MemorySaveRequest):
    """거래처 메모 저장"""
    try:
        service = get_memory_service()
        # 실제 시그니처: add_buyer_memory(user_id, buyer_name, messages)
        result = service.add_buyer_memory(
            user_id=request.user_id,
            buyer_name=request.buyer_name,
            messages=request.messages
        )
        return MemoryResponse(result=result)
    except Exception as e:
        logger.exception(f"Buyer memory save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save/smart", response_model=MemoryResponse)
async def save_memory_smart(request: MemorySmartSaveRequest):
    """
    스마트 메모리 저장 - 조건에 따라 자동 분배 (실제 코드의 save_memory_smart 사용)
    
    doc_id 있으면 → 문서 단기 메모리
    gen_chat_id 있으면 → 일반채팅 단기 메모리
    save_user=True → 사용자 장기 메모리
    save_buyer=True + buyer_name → 거래처 메모리
    """
    try:
        service = get_memory_service()
        # 실제 시그니처 그대로 사용
        result = service.save_memory_smart(
            messages=request.messages,
            user_id=request.user_id,
            doc_id=request.doc_id,
            gen_chat_id=request.gen_chat_id,
            buyer_name=request.buyer_name,
            save_doc=request.save_doc,
            save_user=request.save_user,
            save_buyer=request.save_buyer
        )
        return MemoryResponse(
            doc=result.get("doc"),
            gen_chat=result.get("gen_chat"),
            user=result.get("user"),
            buyer=result.get("buyer")
        )
    except Exception as e:
        logger.exception(f"Smart memory save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 조회 API ====================

@router.post("/query/doc", response_model=MemoryQueryResponse)
async def query_doc_memory(request: MemoryQueryRequest):
    """문서 세션 메모리 조회"""
    try:
        service = get_memory_service()
        # 실제 시그니처: get_doc_memory(doc_id, query, limit)
        memories = service.get_doc_memory(
            doc_id=request.doc_id,
            query=request.query,
            limit=request.limit
        )
        return MemoryQueryResponse(memories=memories)
    except Exception as e:
        logger.exception(f"Doc memory query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query/gen_chat", response_model=MemoryQueryResponse)
async def query_gen_chat_memory(request: MemoryQueryRequest):
    """일반채팅 세션 메모리 조회"""
    try:
        service = get_memory_service()
        # 실제 시그니처: get_gen_chat_memory(gen_chat_id, query, limit)
        memories = service.get_gen_chat_memory(
            gen_chat_id=request.gen_chat_id,
            query=request.query,
            limit=request.limit
        )
        return MemoryQueryResponse(memories=memories)
    except Exception as e:
        logger.exception(f"Gen chat memory query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query/user", response_model=MemoryQueryResponse)
async def query_user_memory(request: MemoryQueryRequest):
    """사용자 선호도 메모리 조회"""
    try:
        service = get_memory_service()
        # 실제 시그니처: get_user_memory(user_id, query, limit)
        memories = service.get_user_memory(
            user_id=request.user_id,
            query=request.query,
            limit=request.limit
        )
        return MemoryQueryResponse(memories=memories)
    except Exception as e:
        logger.exception(f"User memory query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query/buyer", response_model=MemoryQueryResponse)
async def query_buyer_memory(request: MemoryQueryRequest):
    """거래처 메모 조회"""
    try:
        service = get_memory_service()
        # 실제 시그니처: get_buyer_memory(user_id, buyer_name, query, limit)
        memories = service.get_buyer_memory(
            user_id=request.user_id,
            buyer_name=request.buyer_name,
            query=request.query,
            limit=request.limit
        )
        return MemoryQueryResponse(memories=memories)
    except Exception as e:
        logger.exception(f"Buyer memory query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 컨텍스트 빌더 API ====================

@router.post("/context/doc", response_model=MemoryContextResponse)
async def build_doc_context(request: MemoryContextRequest):
    """
    문서 채팅용 컨텍스트 빌드 (실제 코드의 build_doc_context 사용)
    
    병렬로 문서/사용자/거래처 메모리를 조회하여 컨텍스트 구성
    """
    try:
        service = get_memory_service()
        # 실제 시그니처: build_doc_context(doc_id, user_id, query, buyer_name)
        context = service.build_doc_context(
            doc_id=request.doc_id,
            user_id=request.user_id,
            query=request.query,
            buyer_name=request.buyer_name
        )
        return MemoryContextResponse(
            doc_memories=context.get("doc_memories", []),
            user_memories=context.get("user_memories", []),
            buyer_memories=context.get("buyer_memories", []),
            context_summary=context.get("context_summary", "")
        )
    except Exception as e:
        logger.exception(f"Build doc context failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/context/gen_chat", response_model=MemoryContextResponse)
async def build_gen_chat_context(request: MemoryContextRequest):
    """
    일반채팅용 컨텍스트 빌드 (실제 코드의 build_gen_chat_context 사용)
    """
    try:
        service = get_memory_service()
        # 실제 시그니처: build_gen_chat_context(gen_chat_id, user_id, query, is_first_message)
        context = service.build_gen_chat_context(
            gen_chat_id=request.gen_chat_id,
            user_id=request.user_id,
            query=request.query,
            is_first_message=request.is_first_message
        )
        return MemoryContextResponse(
            chat_memories=context.get("chat_memories", []),
            user_memories=context.get("user_memories", []),
            context_summary=context.get("context_summary", "")
        )
    except Exception as e:
        logger.exception(f"Build gen_chat context failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 삭제 API ====================

@router.delete("/doc/{doc_id}")
async def delete_doc_memory(doc_id: int):
    """문서 메모리 삭제"""
    try:
        service = get_memory_service()
        # 실제 시그니처: delete_doc_memory(doc_id)
        success = service.delete_doc_memory(doc_id=doc_id)
        return {"status": "deleted" if success else "failed", "doc_id": doc_id}
    except Exception as e:
        logger.exception(f"Doc memory delete failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/gen_chat/{gen_chat_id}")
async def delete_gen_chat_memory(gen_chat_id: int):
    """일반채팅 메모리 삭제"""
    try:
        service = get_memory_service()
        # 실제 시그니처: delete_gen_chat_memory(gen_chat_id)
        success = service.delete_gen_chat_memory(gen_chat_id=gen_chat_id)
        return {"status": "deleted" if success else "failed", "gen_chat_id": gen_chat_id}
    except Exception as e:
        logger.exception(f"Gen chat memory delete failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/trade/{trade_id}")
async def delete_trade_memory(trade_id: int, doc_ids: str):
    """
    Trade 삭제 시 관련 문서 메모리 일괄 삭제
    
    Args:
        trade_id: Trade ID
        doc_ids: 콤마로 구분된 문서 ID 목록 (예: "1,2,3")
    """
    try:
        service = get_memory_service()
        doc_id_list = [int(x.strip()) for x in doc_ids.split(",") if x.strip()]
        # 실제 시그니처: delete_trade_memory(trade_id, doc_ids)
        success = service.delete_trade_memory(trade_id=trade_id, doc_ids=doc_id_list)
        return {"status": "deleted" if success else "partial", "trade_id": trade_id, "doc_ids": doc_id_list}
    except Exception as e:
        logger.exception(f"Trade memory delete failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### 8.7 api/__init__.py

```python
"""API Routers"""

from api import health, trade, write, read, ingest, memory

__all__ = ["health", "trade", "write", "read", "ingest", "memory"]
```

---

## Phase 9: Services (Memory, Ingest)

### 9.1 services/memory.py

`backend/chat/memory_service.py` → `ai-server/services/memory.py`

**주요 변경사항**: import 경로만 수정 (나머지는 그대로 복사)

> **중요**: 아래는 실제 메서드 시그니처 요약입니다. API 작성 시 반드시 참조하세요!

```python
"""메모리 서비스 - Mem0 기반 대화/문서/사용자 메모리 관리

이 파일은 backend/chat/memory_service.py에서 이동됨.
import 경로만 수정하여 사용.

전체 코드(약 390줄)는 backend/chat/memory_service.py를 복사 후 
아래 import만 수정:
  - from agent_core.config import ... → 삭제 (사용 안함)
"""

import os
import re
import logging
import concurrent.futures
from typing import List, Dict, Any, Optional
from mem0 import Memory

logger = logging.getLogger(__name__)


# ==================== 메서드 시그니처 요약 (API 작성 시 참조) ====================

class TradeMemoryService:
    """무역 AI 메모리 서비스 (싱글톤)
    
    메모리 구조:
    1. 단기 메모리 - 세션별:
       - 문서별 (doc_{doc_id})
       - 일반채팅별 (gen_chat_{gen_chat_id})
    
    2. 장기 메모리 - 영구:
       - 사용자 선호도 (user_{user_id})
       - 거래처별 메모 (buyer_{user_id}_{buyer_name})
    """

    _instance = None

    def __new__(cls):
        """싱글톤 패턴"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._init_memory()

    def _init_memory(self):
        """Mem0 초기화 (Qdrant 연동)"""
        # ... 실제 코드 참조 ...
        pass

    # ===== 문서 메모리 (단기) =====
    
    def add_doc_memory(self, doc_id: int, user_id: int, messages: List[Dict]) -> Dict:
        """문서 세션 메모리 저장
        
        주의: 파라미터 순서가 (doc_id, user_id, messages)
        """
        pass

    def get_doc_memory(self, doc_id: int, query: str = None, limit: int = 5) -> List[Dict]:
        """문서 세션 메모리 조회
        
        주의: user_id 파라미터 없음!
        """
        pass

    def delete_doc_memory(self, doc_id: int) -> bool:
        """문서 메모리 삭제"""
        pass

    def delete_trade_memory(self, trade_id: int, doc_ids: List[int]) -> bool:
        """Trade 삭제 시 관련 문서 메모리 일괄 삭제"""
        pass

    # ===== 사용자 메모리 (장기) =====
    
    def add_user_memory(self, user_id: int, messages: List[Dict]) -> Dict:
        """사용자 선호도 저장"""
        pass

    def get_user_memory(self, user_id: int, query: str = None, limit: int = 5) -> List[Dict]:
        """사용자 선호도 조회"""
        pass

    # ===== 거래처 메모리 (장기) =====
    
    def add_buyer_memory(self, user_id: int, buyer_name: str, messages: List[Dict]) -> Dict:
        """거래처 메모 저장
        
        주의: 파라미터 순서가 (user_id, buyer_name, messages)
        """
        pass

    def get_buyer_memory(self, user_id: int, buyer_name: str, query: str = None, limit: int = 5) -> List[Dict]:
        """거래처 메모 조회"""
        pass

    # ===== 일반채팅 메모리 (단기) =====
    
    def add_gen_chat_memory(self, gen_chat_id: int, user_id: int, messages: List[Dict]) -> Dict:
        """일반채팅 세션 메모리 저장"""
        pass

    def get_gen_chat_memory(self, gen_chat_id: int, query: str = None, limit: int = 5) -> List[Dict]:
        """일반채팅 세션 메모리 조회
        
        주의: user_id 파라미터 없음!
        """
        pass

    def delete_gen_chat_memory(self, gen_chat_id: int) -> bool:
        """일반채팅 메모리 삭제"""
        pass

    # ===== 스마트 저장 (통합) =====
    
    def save_memory_smart(
        self,
        messages: List[Dict],
        user_id: int,
        doc_id: int = None,
        gen_chat_id: int = None,
        buyer_name: str = None,
        save_doc: bool = True,
        save_user: bool = True,
        save_buyer: bool = False
    ) -> Dict[str, Any]:
        """스마트 메모리 저장 - 조건에 따라 자동 분배
        
        Returns:
            {"doc": {...}, "gen_chat": {...}, "user": {...}, "buyer": {...}}
        """
        pass

    # ===== 컨텍스트 빌더 (병렬 조회) =====
    
    def build_doc_context(
        self,
        doc_id: int,
        user_id: int,
        query: str,
        buyer_name: str = None
    ) -> Dict[str, Any]:
        """문서 채팅용 컨텍스트 (병렬 조회)
        
        Returns:
            {
                "doc_memories": [...],
                "user_memories": [...],
                "buyer_memories": [...],
                "context_summary": "문서 이력 3건, 사용자 선호 2건"
            }
        """
        pass

    def build_gen_chat_context(
        self,
        gen_chat_id: int,
        user_id: int,
        query: str,
        is_first_message: bool = False
    ) -> Dict[str, Any]:
        """일반채팅용 컨텍스트
        
        Returns:
            {
                "chat_memories": [...],
                "user_memories": [...],
                "context_summary": "대화 이력 2건, 사용자 선호 1건"
            }
        """
        pass


# ==================== 싱글톤 인스턴스 반환 ====================

def get_memory_service() -> Optional[TradeMemoryService]:
    """메모리 서비스 인스턴스 반환"""
    try:
        return TradeMemoryService()
    except Exception as e:
        logger.warning(f"TradeMemoryService disabled: {e}")
        return None
```

> **참고**: 전체 구현(약 390줄)은 `backend/chat/memory_service.py`를 그대로 복사
> 
> **변경 필요한 import**: 
> - `from qdrant_client import QdrantClient` (삭제 시 delete 메서드 내부에서만 import)

### 9.2 services/ingest.py

```python
"""문서 벡터화 서비스 - S3 → PDF 파싱 → Qdrant 저장

실제 backend/documents/services.py 기준 작성.
주의: production_pdf_pipeline 사용!
"""

import logging
import asyncio
import uuid
from pathlib import Path
from typing import List, Dict, Any

from config.settings import get_settings
from config.clients import get_qdrant_client, get_openai_client
from utils.s3 import download_from_s3
from utils.pdf_parser import production_pdf_pipeline  # 실제 코드 기준!

logger = logging.getLogger(__name__)


async def ingest_document(
    s3_key: str,
    document_id: int,
    collection: str = None
) -> Dict[str, Any]:
    """
    S3 문서를 벡터화하여 Qdrant에 저장

    Args:
        s3_key: S3 파일 경로
        document_id: Django 문서 ID
        collection: Qdrant 컬렉션명 (기본값: COLLECTION_USER_DOCS)

    Returns:
        {"chunks": int, "point_ids": List[str]}
    """
    settings = get_settings()
    qdrant = get_qdrant_client()
    openai = get_openai_client()
    
    target_collection = collection or settings.COLLECTION_USER_DOCS
    
    logger.info(f"📄 문서 벡터화 시작: s3_key={s3_key}, doc_id={document_id}")
    
    # 1. S3에서 파일 다운로드
    local_path = download_from_s3(s3_key)
    logger.info(f"✓ S3 다운로드 완료: {local_path}")
    
    # 2. PDF 파싱 → 청크 리스트 (production_pdf_pipeline 사용)
    result = production_pdf_pipeline(local_path, min_chunk_chars=50)
    
    if result['status'] == 'error':
        logger.error(f"❌ PDF 파싱 실패: {result.get('error')}")
        raise ValueError(result.get('error', 'PDF parsing failed'))
    
    if result['status'] == 'needs_ocr':
        logger.warning(f"⚠️ OCR 필요: {result.get('message')}")
    
    # production_pdf_pipeline 결과를 청크 리스트로 변환
    chunks = []
    for chunk in result.get('chunks', []):
        chunks.append({
            'page': chunk['page_num'],
            'text': chunk['text'],
            'char_count': len(chunk['text']),
            'metadata': chunk.get('metadata', {})
        })
    
    # 경고 메시지 로깅
    for warning in result.get('warnings', []):
        logger.warning(f"PDF 파싱 경고: {warning}")
    
    logger.info(f"✓ PDF 파싱 완료: {len(chunks)}개 청크")
    
    if not chunks:
        logger.warning("⚠️ 파싱된 청크가 없습니다")
        return {"chunks": 0, "point_ids": []}
    
    # 3. 청크 텍스트 추출
    texts = [chunk['text'] for chunk in chunks]
    
    # 4. 임베딩 생성 (배치 처리)
    logger.info(f"🔄 임베딩 생성 중... ({len(texts)}개 텍스트)")
    
    # OpenAI 임베딩 API는 동기이므로 to_thread로 감싸기
    embedding_response = await asyncio.to_thread(
        openai.embeddings.create,
        model=settings.EMBEDDING_MODEL,
        input=texts
    )
    
    embeddings = [e.embedding for e in embedding_response.data]
    logger.info(f"✓ 임베딩 생성 완료: {len(embeddings)}개")
    
    # 5. Qdrant에 저장
    logger.info(f"🔄 Qdrant 저장 중... (collection: {target_collection})")
    
    points = []
    point_ids = []
    
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        point_id = str(uuid.uuid4())
        point_ids.append(point_id)
        
        points.append({
            "id": point_id,
            "vector": embedding,
            "payload": {
                "document_id": document_id,
                "text": chunk['text'],
                "page": chunk['page'],
                "char_count": chunk['char_count'],
                "chunk_index": i,
                "s3_key": s3_key,
                **chunk.get('metadata', {})  # 추가 메타데이터
            }
        })
    
    # 배치 업서트
    await asyncio.to_thread(
        qdrant.upsert,
        collection_name=target_collection,
        points=points
    )
    
    # 6. 임시 파일 정리 (실제 코드는 try-finally로 구현)
    try:
        if Path(local_path).exists():
            Path(local_path).unlink()
            logger.debug(f"임시 파일 삭제: {local_path}")
    except Exception as cleanup_error:
        logger.warning(f"임시 파일 삭제 실패: {cleanup_error}")
    
    logger.info(f"✅ 벡터화 완료: {len(points)}개 포인트 저장")
    
    return {
        "chunks": len(chunks),
        "point_ids": point_ids
    }


async def delete_document_vectors(
    document_id: int,
    collection: str = None
) -> int:
    """
    문서의 모든 벡터 삭제

    Args:
        document_id: Django 문서 ID
        collection: Qdrant 컬렉션명

    Returns:
        삭제된 포인트 수
    """
    from qdrant_client.models import Filter, FieldCondition, MatchValue
    
    settings = get_settings()
    qdrant = get_qdrant_client()
    
    target_collection = collection or settings.COLLECTION_USER_DOCS
    
    logger.info(f"🗑️ 벡터 삭제: doc_id={document_id}, collection={target_collection}")
    
    # 해당 document_id의 모든 포인트 삭제
    result = await asyncio.to_thread(
        qdrant.delete,
        collection_name=target_collection,
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=document_id)
                )
            ]
        )
    )
    
    logger.info(f"✅ 벡터 삭제 완료")
    return result
```

### 9.3 services/__init__.py

```python
"""Services"""

from services.memory import TradeMemoryService
from services.ingest import ingest_document, delete_document_vectors

__all__ = [
    "TradeMemoryService",
    "ingest_document",
    "delete_document_vectors",
]
```

---

## Phase 10: Django 클라이언트

`backend/utils/ai_client.py` 생성 - AI Server HTTP 클라이언트

> **참고**: 필수 메서드는 Phase 13.3 참조

```python
"""AI Server HTTP 클라이언트"""
import httpx
from typing import Dict, List, Generator, Optional

class AIServerClient:
    def __init__(self):
        self.base_url = os.getenv("AI_SERVER_URL", "http://localhost:8001")
        self.timeout = httpx.Timeout(60.0, connect=10.0)

    # Agent APIs - call_trade_agent, call_write_agent, call_read_agent
    # Streaming APIs - stream_trade_agent, stream_write_agent, stream_read_agent
    # Memory APIs - get_doc_context, get_gen_chat_context, save_memory_smart, ...
    # Ingest APIs - ingest_document
    
    # 전체 메서드 시그니처는 Phase 13.3 참조

_client: Optional[AIServerClient] = None

def get_ai_client() -> AIServerClient:
    global _client
    if _client is None:
        _client = AIServerClient()
    return _client
```

---

## 파일 매핑 요약 (수정본)

| 원본 위치 | 이동 위치 | 비고 |
|-----------|-----------|------|
| `agent_core/agents.py` | `agents/{trade,write,read}_agent.py` | Langfuse 연동 유지 |
| `agent_core/config.py` | `config/{settings,clients}.py` | 설정값 정확히 이동 |
| `agent_core/langfuse_config.py` | `config/langfuse.py` | 프롬프트 로딩 함수 포함 |
| `agent_core/prompts/fallback.py` | `config/prompts/fallback.py` | 115줄 + 85줄 프롬프트 |
| `agent_core/prompts/trade_instructions.txt` | `config/prompts/trade_instructions.txt` | **196줄 - 누락 금지!** |
| `agent_core/tools/search_tool.py` | `tools/search_tool.py` | **async 함수 + 병렬검색** |
| `agent_core/tools/web_search_tool.py` | `tools/web_search_tool.py` | 동일 |
| `agent_core/services/reranker_service.py` | `tools/reranker.py` | **RunPod API 호출** |
| `agent_core/services/query_transformer_service.py` | `tools/query_transformer.py` | 250줄 프롬프트 포함 |
| `agent_core/models/query_transformer.py` | `models/query_transformer.py` | 동일 |
| `agent_core/models/reranker.py` | `models/reranker.py` | **RerankResult 포함** |
| `agent_core/utils.py` | `utils/debug.py` | print_retrieved_documents |
| `agent_core/pdf_parser.py` | `utils/pdf_parser.py` | 동일 |
| `agent_core/s3_utils.py` | `utils/s3.py` | 동일 |
| `agent_core/collection_manager.py` | `utils/collection_manager.py` | 동일 |
| `chat/memory_service.py` | `services/memory.py` | import 경로만 수정 |
| (신규) | `backend/utils/ai_client.py` | HTTP 클라이언트 |

---

## 주요 수정사항 요약

### 이전 계획서 대비 수정된 항목:

1. **누락 파일 추가**:
   - `prompts/trade_instructions.txt` (196줄)
   - `utils/debug.py` (print_retrieved_documents, **dedup_consecutive_lines**)

2. **config/settings.py**:
   - `COLLECTION_NAME` → `collection_trade` (실제 이름)
   - `COLLECTION_USER_DOCS` → `collection_trade_user_documents`
   - `EMBEDDING_MODEL` → `text-embedding-3-large`
   - `VECTOR_SIZE` = 3072 추가
   - `RERANKER_API_URL` 추가
   - `USE_RERANKER`, `USE_PER_QUERY_RERANK` 추가

3. **Reranker**:
   - GPT 직접 호출 → **RunPod 외부 API 호출**로 수정
   - `RerankResult` 클래스 추가

4. **search_tool.py**:
   - 동기 → **async 함수**로 수정
   - `_multi_search`, `_rerank_per_query` 헬퍼 함수 추가
   - 병렬 검색 + 개별 Reranking 로직 추가
   - **전역 import 패턴 사용** (함수 파라미터 아님!)

5. **Agent 생성**:
   - `prompt_version`, `prompt_label` 파라미터 추가
   - Langfuse 연동 로직 추가
   - **model="gpt-4o" 하드코딩** (settings.AGENT_MODEL 아님!)

6. **API 스키마**:
   - `prompt_version`, `prompt_label` 필드 추가
   - `document_name`, `document_type` 필드 추가

7. **tools/__init__.py**:
   - 실제 코드는 `search_user_document`를 export하지 않음
   - agents.py에서 직접 search_tool.py에서 import
   - ai-server에서는 모두 export 권장 (패턴 일관성)

---

## API 엔드포인트 요약 (실제 코드 기준)

### Health
| 엔드포인트 | 메소드 | 설명 |
|-----------|--------|------|
| `/health` | GET | 기본 헬스체크 |
| `/ready` | GET | 준비 상태 체크 (Qdrant, OpenAI 연결 확인) |

### Agent
| 엔드포인트 | 메소드 | 설명 |
|-----------|--------|------|
| `/api/agent/trade` | POST | 무역 Q&A (비스트리밍) |
| `/api/agent/trade/stream` | POST | 무역 Q&A (SSE) |
| `/api/agent/write` | POST | 문서 작성 (비스트리밍) |
| `/api/agent/write/stream` | POST | 문서 작성 (SSE) |
| `/api/agent/read` | POST | 문서 읽기 (비스트리밍) |
| `/api/agent/read/stream` | POST | 문서 읽기 (SSE) |

### Ingest
| 엔드포인트 | 메소드 | 설명 |
|-----------|--------|------|
| `/api/ingest` | POST | 문서 벡터화 |

### Memory (실제 TradeMemoryService 메서드 기준)
| 엔드포인트 | 메소드 | 설명 | 매핑 메서드 |
|-----------|--------|------|-------------|
| `/api/memory/save/doc` | POST | 문서 세션 메모리 저장 | `add_doc_memory(doc_id, user_id, messages)` |
| `/api/memory/save/gen_chat` | POST | 일반채팅 세션 메모리 저장 | `add_gen_chat_memory(gen_chat_id, user_id, messages)` |
| `/api/memory/save/user` | POST | 사용자 선호도 저장 | `add_user_memory(user_id, messages)` |
| `/api/memory/save/buyer` | POST | 거래처 메모 저장 | `add_buyer_memory(user_id, buyer_name, messages)` |
| `/api/memory/save/smart` | POST | 스마트 저장 (자동 분배) | `save_memory_smart(...)` |
| `/api/memory/query/doc` | POST | 문서 메모리 조회 | `get_doc_memory(doc_id, query, limit)` |
| `/api/memory/query/gen_chat` | POST | 일반채팅 메모리 조회 | `get_gen_chat_memory(gen_chat_id, query, limit)` |
| `/api/memory/query/user` | POST | 사용자 메모리 조회 | `get_user_memory(user_id, query, limit)` |
| `/api/memory/query/buyer` | POST | 거래처 메모 조회 | `get_buyer_memory(user_id, buyer_name, query, limit)` |
| `/api/memory/context/doc` | POST | 문서 채팅 컨텍스트 빌드 | `build_doc_context(doc_id, user_id, query, buyer_name)` |
| `/api/memory/context/gen_chat` | POST | 일반채팅 컨텍스트 빌드 | `build_gen_chat_context(gen_chat_id, user_id, query, is_first_message)` |
| `/api/memory/doc/{doc_id}` | DELETE | 문서 메모리 삭제 | `delete_doc_memory(doc_id)` |
| `/api/memory/gen_chat/{gen_chat_id}` | DELETE | 일반채팅 메모리 삭제 | `delete_gen_chat_memory(gen_chat_id)` |
| `/api/memory/trade/{trade_id}` | DELETE | Trade 관련 문서 일괄 삭제 | `delete_trade_memory(trade_id, doc_ids)` |

---

## 롤백 전략

### 환경변수 스위치

```bash
# .env
USE_AI_SERVER=false  # 기존 방식 (직접 호출)
USE_AI_SERVER=true   # AI Server 호출
```

### 점진적 전환

1. `USE_AI_SERVER=false`로 시작
2. AI Server 배포 후 테스트 환경에서 `USE_AI_SERVER=true`
3. 검증 후 프로덕션 전환

---

## Phase 11: __init__.py 파일들

모든 패키지 폴더에 `__init__.py` 파일 필요 (각 모듈에서 export할 항목 정의):

| 패키지 | Export 항목 |
|--------|-------------|
| `config/` | `get_settings`, `Settings`, `get_qdrant_client`, `get_openai_client`, `LANGFUSE_ENABLED`, `load_prompt_from_*` |
| `config/prompts/` | `DOCUMENT_WRITING_PROMPT`, `DOCUMENT_READ_PROMPT` |
| `models/` | `QueryTransformResult`, `RerankRequest`, `RerankResponse`, `RerankResult` |
| `schemas/` | `AgentRequest`, `IngestRequest`, `MemoryRequest`, `*Response` 등 |
| `utils/` | `print_retrieved_documents`, `dedup_consecutive_lines`, `download_from_s3`, `parse_pdf` |
| `tools/` | `search_trade_documents`, `search_user_document`, `search_web` |
| `agents/` | `get_trade_agent`, `get_document_writing_agent`, `get_read_document_agent` |
| `services/` | `TradeMemoryService`, `ingest_document`, `delete_document_vectors` |
| `api/` | `health`, `trade`, `write`, `read`, `ingest`, `memory` (라우터들) |

---

## Phase 12: Django View HTTP 호출 전환 가이드

> **핵심 원칙**: Django에서는 DB 저장/조회만, AI Server에서는 Agent/Memory/Ingest 처리만

### 13.1 전환 패턴 요약

**변경 전 (직접 호출)**:
```python
from agent_core import get_trade_agent, get_document_writing_agent
from agents import Runner
from .memory_service import get_memory_service

# Agent 직접 실행
agent = get_trade_agent(prompt_version=PROMPT_VERSION, prompt_label=PROMPT_LABEL)
result = asyncio.run(Runner.run(agent, input_items))

# Memory 직접 호출
mem_service = get_memory_service()
context = mem_service.build_doc_context(doc_id, user_id, message)
mem_service.save_memory_smart(messages, user_id, doc_id, buyer_name, ...)
```

**변경 후 (HTTP 호출)**:
```python
from utils.ai_client import get_ai_client

client = get_ai_client()

# AI Server API 호출
context = await client.get_doc_context(doc_id, user_id, message, buyer_name)
result = await client.call_write_agent(message, user_id, document_content, ...)

# 스트리밍
for chunk in client.stream_write_agent(message=message, ...):
    yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"

# Memory 저장
await client.save_memory_smart(messages, user_id, doc_id, buyer_name, ...)
```

### 13.2 전환 대상 View 목록

| View | 파일 | 변경 내용 |
|------|------|----------|
| `DocumentChatView` | `chat/trade_views.py` | Agent 호출 + Memory → AI Server |
| `DocumentChatStreamView` | `chat/trade_views.py` | 스트리밍 Agent → AI Server |
| `ChatStreamView` | `chat/views.py` | Trade/Write Agent + Memory → AI Server |
| `GenChatDeleteView` | `chat/views.py` | Memory 삭제 → AI Server |
| `TradeFlowViewSet.destroy` | `trades/views.py` | Trade 메모리 삭제 → AI Server |
| `process_uploaded_document` | `documents/services.py` | S3→Qdrant 벡터화 → AI Server |

### 13.3 ai_client.py 필수 메서드

```python
class AIServerClient:
    # Agent 호출
    async def call_trade_agent(message, user_id, conversation_history, prompt_version, prompt_label)
    async def call_write_agent(message, user_id, document_content, conversation_history, ...)
    async def call_read_agent(message, user_id, document_id, document_name, document_type, ...)
    
    # 스트리밍
    def stream_trade_agent(message, conversation_history, user_context, ...) -> Generator
    def stream_write_agent(message, document_content, conversation_history, ...) -> Generator
    def stream_read_agent(message, document_id, ...) -> Generator
    
    # Memory - 컨텍스트 조회
    async def get_doc_context(doc_id, user_id, query, buyer_name)
    async def get_gen_chat_context(gen_chat_id, user_id, query, is_first_message)
    
    # Memory - 저장/삭제
    async def save_memory_smart(messages, user_id, doc_id, gen_chat_id, buyer_name, ...)
    async def save_gen_chat_memory(gen_chat_id, user_id, messages)
    async def save_user_memory(user_id, messages)
    async def delete_gen_chat_memory(gen_chat_id)
    async def delete_trade_memory(trade_id, doc_ids)
    
    # Ingest
    async def ingest_document(s3_key, document_id, collection)
```

### 13.4 환경변수 추가

`backend/.env`:

```bash
# AI Server URL (추가)
AI_SERVER_URL=http://localhost:8001
```

`backend/.env.example`:

```bash
# AI Server
AI_SERVER_URL=http://localhost:8001
```

### 13.10 분리 경계 요약

| 항목 | Django (유지) | AI Server (이동) |
|------|--------------|------------------|
| Document CRUD | ✅ | |
| DocMessage 저장/조회 | ✅ | |
| GenChat/GenMessage 저장/조회 | ✅ | |
| 대화 히스토리 로드 | ✅ | |
| User 조회/생성 | ✅ | |
| Agent 생성/실행 | | ✅ |
| Mem0 컨텍스트 조회 | | ✅ |
| Mem0 메모리 저장/삭제 | | ✅ |
| S3 다운로드 | | ✅ |
| PDF 파싱 | | ✅ |
| 임베딩 생성 | | ✅ |
| Qdrant 저장/검색 | | ✅ |
| Langfuse 연동 | | ✅ |
| Reranker API 호출 | | ✅ |
| 쿼리 변환/분해 | | ✅ |
| 웹 검색 (Tavily) | | ✅ |

---

## Phase 13: 로컬 테스트

```bash
# 서버 실행
cd ai-server
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# 테스트
curl http://localhost:8001/health
curl -X POST http://localhost:8001/api/agent/trade \
  -H "Content-Type: application/json" \
  -d '{"message": "수출 절차가 궁금합니다", "user_id": 1}'
```

---

## 최종 디렉토리 구조 (완성본)

```
ai-server/
├── main.py                        # FastAPI 앱 진입점
├── requirements.txt               # Python 의존성
├── .env.example                       # 환경변수 예시
│
├── api/                           # API 라우터
│   ├── __init__.py
│   ├── health.py                  # GET /health, /ready
│   ├── trade.py                   # POST /api/agent/trade[/stream]
│   ├── write.py                   # POST /api/agent/write[/stream]
│   ├── read.py                    # POST /api/agent/read[/stream]
│   ├── ingest.py                  # POST /api/ingest
│   └── memory.py                  # POST /api/memory/*
│
├── agents/                        # Agent 정의
│   ├── __init__.py
│   ├── trade_agent.py             # 무역 Q&A Agent
│   ├── write_agent.py             # 문서 작성 Agent
│   └── read_agent.py              # 문서 읽기 Agent
│
├── tools/                         # Agent 도구
│   ├── __init__.py
│   ├── search_tool.py             # RAG 검색 (쿼리변환+병렬검색+Reranking)
│   ├── web_search_tool.py         # Tavily 웹 검색
│   ├── reranker.py                # RunPod Reranker API
│   └── query_transformer.py       # 쿼리 변환/분해
│
├── services/                      # 서비스 레이어
│   ├── __init__.py
│   ├── memory.py                  # Mem0 메모리 서비스
│   └── ingest.py                  # 문서 벡터화 파이프라인
│
├── schemas/                       # API 스키마
│   ├── __init__.py
│   ├── request.py                 # 요청 모델
│   └── response.py                # 응답 모델
│
├── models/                        # Pydantic 데이터 모델
│   ├── __init__.py
│   ├── query_transformer.py       # QueryTransformResult
│   └── reranker.py                # RerankRequest/Response/Result
│
├── config/                        # 설정
│   ├── __init__.py
│   ├── settings.py                # Pydantic Settings
│   ├── clients.py                 # Qdrant, OpenAI 클라이언트
│   ├── langfuse.py                # Langfuse SDK + 프롬프트 로딩
│   └── prompts/
│       ├── __init__.py
│       ├── fallback.py            # 로컬 fallback 프롬프트
│       └── trade_instructions.txt # 무역 전문가 프롬프트 (196줄)
│
├── utils/                         # 유틸리티
│   ├── __init__.py
│   ├── debug.py                   # 디버그 출력
│   ├── s3.py                      # S3 다운로드
│   ├── pdf_parser.py              # PDF 파싱
│   └── collection_manager.py      # Qdrant 컬렉션 관리
│
└── tests/                         # 테스트
    ├── __init__.py
    ├── test_agents.py
    ├── test_api.py
    └── test_tools.py
```

---

## 작업 완료 체크리스트

- [ ] Phase 1: Config (settings.py, clients.py, langfuse.py, .env.example, main.py)
- [ ] Phase 2: Models (query_transformer.py, reranker.py)
- [ ] Phase 3: Tools (reranker.py, query_transformer.py, search_tool.py, web_search_tool.py)
- [ ] Phase 4: Utils (debug.py, pdf_parser.py, s3.py, collection_manager.py)
- [ ] Phase 5: Agents (trade_agent.py, write_agent.py, read_agent.py)
- [ ] Phase 6: Prompts (fallback.py, trade_instructions.txt)
- [ ] Phase 7: Schemas (request.py, response.py)
- [ ] Phase 8: API (trade.py, write.py, read.py, health.py, ingest.py, memory.py)
- [ ] Phase 9: Services (memory.py, ingest.py)
- [ ] Phase 10: Django Client (ai_client.py)
- [ ] Phase 11: __init__.py 파일들
- [ ] Phase 12: Django View 전환 가이드
- [ ] Phase 13: 로컬 테스트


