# 에이전트 서버 분리 계획

> **목표**: `backend/agent_core/`를 별도 FastAPI 서버(`ai-server/`)로 분리
> **범위**: 에이전트 서버 분리만 (프론트엔드, 모델, 앱 구조 변경 없음)
> **예상 일정**: 약 5일

---

## 현재 구조

```
backend/
├── agent_core/           # ← 이것을 분리
│   ├── agents.py         # Agent 팩토리
│   ├── config.py         # Qdrant, OpenAI 클라이언트
│   ├── tools/            # RAG 검색, 웹 검색
│   └── services/         # Reranker, Query Transformer
├── chat/
│   ├── trade_views.py    # ← Agent 직접 호출 → HTTP 호출로 변경
│   └── memory_service.py # ← AI Server로 이동
└── documents/
    └── services.py       # ← Qdrant 접근 → AI Server 호출로 변경
```

## 목표 구조

```
backend/                  # Django (그대로 유지)
├── chat/
│   ├── trade_views.py    # HTTP로 AI Server 호출
│   └── memory_service.py # 프록시 또는 삭제
├── documents/
│   └── services.py       # HTTP로 AI Server 호출
└── utils/
    └── agent_client.py   # 신규: AI Server HTTP 클라이언트

ai-server/                # FastAPI (신규)
├── main.py
├── api/
│   ├── trade.py          # POST /api/agent/trade
│   ├── write.py          # POST /api/agent/write
│   ├── read.py           # POST /api/agent/read
│   └── ingest.py         # POST /api/ingest
├── agents/               # agent_core/agents.py 이동
├── tools/                # agent_core/tools/ 이동
├── services/
│   ├── rag/              # agent_core/services/ 이동
│   └── memory.py         # chat/memory_service.py 이동
└── config/               # agent_core/config.py 이동
```

---

## Phase 0: 버그 수정 (선행 필수) - 0.5일

### 문제
`trade_views.py:636`에서 `mem_service.save_memory_smart()` 호출하지만 함수가 없음

### 해결
`backend/chat/memory_service.py`에 함수 추가:

```python
def save_memory_smart(self, messages, user_id, doc_id=None, buyer_name=None,
                      save_doc=True, save_user=True, save_buyer=False) -> Dict:
    result = {"doc": None, "user": None, "buyer": None}
    if save_doc and doc_id:
        result["doc"] = self.add_doc_memory(doc_id, user_id, messages)
    if save_user:
        result["user"] = self.add_user_memory(user_id, messages)
    if save_buyer and buyer_name:
        result["buyer"] = self.add_buyer_memory(user_id, buyer_name, messages)
    return result
```

---

## Phase 1: FastAPI 서버 생성 - 1일

### 파일 생성

```
ai-server/
├── main.py               # FastAPI 앱
├── config/
│   └── settings.py       # 환경변수, Qdrant/OpenAI 클라이언트
├── api/
│   └── health.py         # GET /api/health
└── requirements.txt
```

### 의존성 (requirements.txt)
```
fastapi>=0.109.0
uvicorn>=0.27.0
openai>=2.8.1
openai-agents>=0.6.1
qdrant-client>=1.16.1
mem0ai>=0.1.0
langfuse>=2.0.0
tavily-python>=0.7.13
boto3>=1.35.0
pymupdf>=1.24.0
httpx>=0.27.0
python-dotenv>=1.0.0
```

---

## Phase 2: Agent 엔드포인트 - 1.5일

### 이동할 파일
- `backend/agent_core/agents.py` → `ai-server/agents/factory.py`
- `backend/agent_core/tools/` → `ai-server/tools/`
- `backend/agent_core/langfuse_config.py` → `ai-server/config/langfuse.py`
- `backend/agent_core/prompts/` → `ai-server/config/prompts/`

### API 엔드포인트
| 엔드포인트 | 설명 |
|-----------|------|
| `POST /api/agent/trade` | 무역 Q&A |
| `POST /api/agent/trade/stream` | 무역 Q&A (SSE) |
| `POST /api/agent/write` | 문서 작성 |
| `POST /api/agent/write/stream` | 문서 작성 (SSE) |
| `POST /api/agent/read` | 문서 읽기 |
| `POST /api/agent/read/stream` | 문서 읽기 (SSE) |

---

## Phase 3: Django HTTP 클라이언트 - 1일

### 신규 파일
`backend/utils/agent_client.py`:

```python
class AIAgentClient:
    def __init__(self):
        self.base_url = os.getenv("AI_SERVER_URL", "http://localhost:8001")

    async def call_write_agent(self, message, doc_id, ...) -> Dict:
        response = await httpx.AsyncClient().post(
            f"{self.base_url}/api/agent/write", json={...}
        )
        return response.json()

    def stream_write_agent(self, ...) -> Generator:
        # Django StreamingHttpResponse 호환 (동기)
```

### 수정할 파일
`backend/chat/trade_views.py`:

**변경 전:**
```python
from agents import Runner
from agent_core import get_document_writing_agent

result = asyncio.run(Runner.run(agent, input=...))
```

**변경 후:**
```python
from utils.agent_client import get_agent_client

client = get_agent_client()
result = asyncio.run(client.call_write_agent(...))
```

---

## Phase 4: Ingest & Memory 이동 - 1일

### Ingest (문서 벡터화)
- `backend/documents/services.py` → `ai-server/services/rag/ingest.py`
- Django에서는 `POST /api/ingest` 호출

### Memory (Mem0)
- `backend/chat/memory_service.py` → `ai-server/services/memory.py`
- Django에서는 환경변수로 로컬/원격 선택 가능

---

## 롤백 계획

### 환경변수 스위치
```python
# backend/chat/trade_views.py
USE_AI_SERVER = os.getenv("USE_AI_SERVER", "false").lower() == "true"

if USE_AI_SERVER:
    from utils.agent_client import get_agent_client
    # HTTP 호출
else:
    from agents import Runner
    from agent_core import get_document_writing_agent
    # 기존 직접 호출
```

---

## 수정 파일 목록

| 파일 | 작업 |
|------|------|
| `backend/chat/memory_service.py` | `save_memory_smart()` 추가 |
| `backend/chat/trade_views.py` | Agent 호출 → HTTP 호출 |
| `backend/documents/services.py` | Qdrant 직접 → HTTP 호출 |
| `backend/utils/agent_client.py` | **신규** |
| `ai-server/` | **신규** 전체 |

---

## 예상 일정

| Phase | 작업 | 일수 |
|-------|------|------|
| 0 | 버그 수정 | 0.5 |
| 1 | FastAPI 기본 구조 | 1 |
| 2 | Agent 엔드포인트 | 1.5 |
| 3 | Django HTTP 클라이언트 | 1 |
| 4 | Ingest & Memory 이동 | 1 |
| **총계** | | **5일** |
