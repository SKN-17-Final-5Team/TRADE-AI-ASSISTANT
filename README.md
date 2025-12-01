# TRADE-AI-ASSISTANT

AI 기반 무역 문서 관리 및 생성 시스템

## 프로젝트 구조

```
TRADE-AI-ASSISTANT/
├── frontend/                 # React 프론트엔드
│   ├── components/           # React 컴포넌트
│   ├── src/                  # 소스 코드
│   ├── package.json
│   └── .env                  # 프론트엔드 환경변수
│
├── backend/                  # Django 백엔드
│   ├── config/               # Django 설정
│   ├── chat/                 # 채팅 API 앱
│   ├── documents/            # 문서 관리 앱
│   ├── agent_core/           # AI 에이전트 코어
│   │   ├── tools/            # 에이전트 도구들
│   │   ├── services/         # 서비스 레이어
│   │   ├── prompts/          # 프롬프트 파일
│   │   └── trade_agent.py    # 메인 에이전트
│   ├── manage.py
│   └── .env                  # 백엔드 환경변수
│
└── README.md
```

## 기술 스택

### Frontend
| 기술 | 버전 |
|------|------|
| React | 18.2.0 |
| TypeScript | 5.2.2 |
| Vite | 4.x |
| Tailwind CSS | 3.3.3 |
| shadcn/ui | - |
| Tiptap (Rich Text Editor) | 3.11.0 |
| react-pdf | 10.2.0 |

### Backend
| 기술 | 버전 |
|------|------|
| Python | 3.11+ |
| Django | 5.2.8 |
| Django REST Framework | 3.15+ |
| OpenAI Agents SDK | 최신 |
| Qdrant (Vector DB) | Cloud |

---

## 설치 및 실행

### 1. 저장소 클론

```bash
git clone https://github.com/SKN-17-Final-5Team/TRADE-AI-ASSISTANT.git
cd TRADE-AI-ASSISTANT
```

---

### 2. Backend 설정

#### 2-1. Python 가상환경 생성 (권장: conda 또는 venv)

```bash
# conda 사용 시
conda create -n trade-assistant python=3.12
conda activate trade-assistant

# 또는 venv 사용 시
python -m venv venv
source venv/bin/activate  # Mac/Linux
venv\Scripts\activate     # Windows
```

#### 2-2. 패키지 설치

```bash
cd backend
pip install django djangorestframework django-cors-headers python-dotenv
pip install openai openai-agents qdrant-client tavily-python
pip install mysqlclient  # MySQL 사용 시
```

#### 2-3. 환경변수 설정

`backend/.env` 파일 생성:

```env
# Django
DJANGO_SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Qdrant Vector DB
QDRANT_URL=https://your-qdrant-url
QDRANT_API_KEY=your-qdrant-api-key

# Reranker API (선택)
RERANKER_API_URL=https://your-reranker-url/rerank

# Tavily (웹 검색)
TAVILY_API_KEY=tvly-your-tavily-key
```

#### 2-4. 데이터베이스 설정

MySQL 사용 시 `config/settings.py`의 DATABASES 설정 확인:

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'trade_assistant',
        'USER': 'your_username',
        'PASSWORD': 'your_password',
        'HOST': '127.0.0.1',
        'PORT': '3306',
    }
}
```

MySQL에서 데이터베이스 생성:
```sql
CREATE DATABASE trade_assistant CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### 2-5. 마이그레이션 및 서버 실행

```bash
cd backend
python manage.py migrate
python manage.py runserver
```

백엔드 서버: http://localhost:8000

---

### 3. Frontend 설정

#### 3-1. 패키지 설치

```bash
cd frontend
npm install
```

#### 3-2. 환경변수 설정

`frontend/.env` 파일 생성:

```env
# Django 백엔드 연결
VITE_USE_DJANGO=true
VITE_DJANGO_API_URL=http://localhost:8000

# 테스트용 (VITE_USE_DJANGO=false 일 때만 사용)
VITE_OPENAI_API_KEY=sk-your-openai-api-key
```

#### 3-3. 개발 서버 실행

```bash
npm run dev
```

프론트엔드 서버: http://localhost:5173

---

## 실행 순서 요약

```bash
# 터미널 1: 백엔드
cd backend
conda activate trade-assistant  # 또는 source venv/bin/activate
python manage.py runserver

# 터미널 2: 프론트엔드
cd frontend
npm run dev
```

---

## API 엔드포인트

### POST /api/chat/

AI 에이전트와 대화

**Request:**
```json
{
  "message": "사용자 질문",
  "document": "문서 내용 (선택)"
}
```

**Response:**
```json
{
  "message": "AI 응답",
  "tools_used": [
    {
      "id": "search_trade_documents",
      "name": "문서 검색",
      "icon": "document",
      "description": "무역 문서 데이터베이스에서 관련 정보를 검색했습니다."
    }
  ],
  "html": null,
  "changes": []
}
```

---

## AI 에이전트 도구

| 도구 | 설명 |
|------|------|
| `search_trade_documents` | Qdrant 벡터 DB에서 무역 관련 문서 검색 (RAG) |
| `search_web` | Tavily API를 이용한 실시간 웹 검색 |

---

## 주요 기능

### 1. 로그인
- 사번 기반 인증
- 초기 비밀번호: `a123456!`

### 2. AI 채팅 (ChatPage)
- 무역 관련 질의응답
- 웹 검색 및 문서 검색 도구 사용
- 사용된 도구 표시 (UI 배지)
- 마크다운 렌더링 (링크 클릭 가능)

### 3. 문서 생성 (DocumentCreationPage)
- 7단계 무역 문서 워크플로우
- AI 어시스턴트와 실시간 협업
- 리치 텍스트 에디터 (Tiptap)

### 4. 문서 유형
| 단계 | 문서 |
|------|------|
| 1 | Offer Sheet |
| 2 | Purchase Order (PO) |
| 3 | Proforma Invoice (PI) |
| 4 | Sales Contract |
| 5 | Commercial Invoice (CI) |
| 6 | Packing List |
| 7 | Bill of Lading (BL) |
| 8 | Letter of Credit (LC) |
| 9 | Others (PDF) |

---

## 트러블슈팅

### CORS 에러
`backend/config/settings.py`에서 프론트엔드 URL이 CORS_ALLOWED_ORIGINS에 포함되어 있는지 확인:
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
```

### MySQL 연결 오류
- MySQL 서버가 실행 중인지 확인
- 데이터베이스 이름, 사용자명, 비밀번호 확인
- `mysqlclient` 패키지 설치 확인

### OpenAI API 오류
- API 키가 올바른지 확인
- 크레딧 잔액 확인

---

## 라이선스

- UI 컴포넌트: [shadcn/ui](https://ui.shadcn.com/)
