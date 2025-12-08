# TRADE-AI-ASSISTANT 시스템 아키텍처 V2

> **목적**: 이 문서는 리팩토링 후 아키텍처와 개발자 상세 가이드를 통합한 **완전한 참조 문서**입니다.
> 현재 구조는 [README.md](./README.md)를, 본 문서는 **V2 구조 + 변경점 + 개발 가이드**를 기술합니다.

---

## 목차

### Part 1: 시스템 아키텍처 (리팩토링 후)
1. [전체 시스템 구성도](#1-전체-시스템-구성도)
2. [프로젝트 디렉토리 구조](#2-프로젝트-디렉토리-구조)
3. [파일 이동/리네임 매핑](#3-파일-이동리네임-매핑)
4. [네이밍 컨벤션](#4-네이밍-컨벤션)

### Part 2: 개발자 상세 가이드 (V2 구조 기준)
5. [프론트엔드 상세](#5-프론트엔드-상세)
6. [백엔드 상세](#6-백엔드-상세)
7. [AI Agent 시스템](#7-ai-agent-시스템)
8. [데이터 흐름 및 상태 관리](#8-데이터-흐름-및-상태-관리)
9. [API 엔드포인트 매핑](#9-api-엔드포인트-매핑)
10. [컴포넌트 의존성 맵](#10-컴포넌트-의존성-맵)
11. [스타일링 시스템](#11-스타일링-시스템)
12. [문서 템플릿 시스템](#12-문서-템플릿-시스템)

### Part 3: 마이그레이션 & 운영
13. [환경 변수 설정](#13-환경-변수-설정)
14. [마이그레이션 계획](#14-마이그레이션-계획)
15. [Docker Compose 예시](#15-docker-compose-예시)
16. [보안 고려사항](#16-보안-고려사항)
17. [에러 핸들링 전략](#17-에러-핸들링-전략)
18. [UI 수정 가이드](#18-ui-수정-가이드)
19. [디버깅 가이드](#19-디버깅-가이드)
20. [README 원본과의 변경 비교](#20-readme-원본과의-변경-비교)
21. [파일별 한줄 요약](#21-파일별-한줄-요약)

---

# Part 1: 시스템 아키텍처 (리팩토링 후)

---

## 1. 전체 시스템 구성도

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                        AWS Cloud                                        │
│                                                                                         │
│   ┌─────────────┐     ┌─────────────────────────────────┐                               │
│   │             │     │                                 │                               │
│   │  Amazon S3  │◀────│─────────────────────────────────│───────────┐                   │
│   │             │     │                                 │           │                   │
│   └─────────────┘     │      EC2 #1 (Backend)           │           │                   │
│                       │  ┌───────────────────────────┐  │           │                   │
│   ┌─────────────┐     │  │         Docker            │  │           │                   │
│   │             │     │  │  ┌─────────────────────┐  │  │           │                   │
│   │  AWS RDS    │◀────│──│──│       Nginx         │  │  │           │                   │
│   │  (MySQL)    │     │  │  └──────────┬──────────┘  │  │           │                   │
│   │             │     │  │             │             │  │           │                   │
│   └─────────────┘     │  │             ▼             │  │           │                   │
│                       │  │  ┌─────────────────────┐  │  │           │ presigned URL     │
│                       │  │  │  Django + Gunicorn  │  │  │           │                   │
│                       │  │  │                     │  │  │           │                   │
│                       │  │  │  • accounts/        │  │  │           │                   │
│                       │  │  │  • trades/          │  │  │           │                   │
│                       │  │  │  • chat/            │──│──│───┐       │                   │
│                       │  │  │  • utils/           │  │  │   │       │                   │
│                       │  │  │                     │  │  │   │       │                   │
│                       │  │  └─────────────────────┘  │  │   │       │                   │
│                       │  └───────────────────────────┘  │   │       │                   │
│                       └─────────────────────────────────┘   │       │                   │
│                                      │                      │       │                   │
│                                      │ HTTP API             │       │                   │
│                                      ▼                      │       │                   │
│                       ┌─────────────────────────────────┐   │       │                   │
│                       │      EC2 #2 (AI Agents)         │   │       │                   │
│                       │  ┌───────────────────────────┐  │   │       │                   │
│                       │  │         Docker            │  │   │       │                   │
│                       │  │  ┌─────────────────────┐  │  │   │       │                   │
│                       │  │  │  FastAPI + Uvicorn  │  │  │   │       │                   │
│                       │  │  │                     │  │  │   │       │                   │
│                       │  │  │  • api/             │  │  │   │       │                   │
│                       │  │  │  • agents/          │  │  │   │       │                   │
│                       │  │  │  • services/        │  │  │   │       │                   │
│                       │  │  │                     │  │  │   │       │                   │
│                       │  │  └─────────────────────┘  │  │   │       │                   │
│                       │  └───────────────────────────┘  │   │       │                   │
│                       └─────────────────────────────────┘   │       │                   │
│                                      │                      │       │                   │
└──────────────────────────────────────│──────────────────────│───────│───────────────────┘
                                       │                      │       │
                                       │ API Calls            │       │
                                       ▼                      │       │
┌──────────────────────────────────────────────────────────┐  │       │
│                    External Services                      │  │       │
│                                                          │  │       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │  │       │
│  │ OpenAI   │ │  Qdrant  │ │  Tavily  │ │ Langfuse │    │  │       │
│  │ (LLM)    │ │ (Vector) │ │  (Web)   │ │(Monitor) │    │  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │  │       │
│                                                          │  │       │
│  ┌────────────────────────────┐                          │  │       │
│  │  RunPod (mxbai-reranker)   │                          │  │       │
│  └────────────────────────────┘                          │  │       │
│                                                          │  │       │
└──────────────────────────────────────────────────────────┘  │       │
                                                              │       │
              ┌───────────────────────────────────────────────┘       │
              │                                                       │
              │  ┌─────────────────────┐                              │
              │  │                     │                              │
              └──│      Vercel         │◀─────────────────────────────┘
                 │   (Frontend)        │
                 │                     │
                 │  React + Vite       │
                 │                     │
                 └──────────┬──────────┘
                            │
                 ┌──────────▼──────────┐
                 │   User (Browser)    │
                 └─────────────────────┘
```

### 서버별 역할

| 서버 | 역할 | 기술 스택 | 포트 |
|------|------|----------|------|
| **EC2 #1** | API Gateway, 인증, DB/S3 접근 | Django + Gunicorn + Nginx | 80/443 |
| **EC2 #2** | AI 에이전트, RAG, 메모리 관리 | FastAPI + Uvicorn | 8001 |
| **Vercel** | 사용자 인터페이스, SSE 스트리밍 | React + Vite | - |

### 서버별 외부 서비스 접근

```
EC2 #1 (Django)          EC2 #2 (AI Server)
     │                         │
     ├── AWS RDS (MySQL)       ├── OpenAI API
     ├── AWS S3                ├── Qdrant Cloud
     └── EC2 #2 ───────────────├── Tavily API
                               ├── RunPod (Reranker)
                               └── Langfuse
```

---

## 2. 프로젝트 디렉토리 구조

### 2.1 EC2 #1: Django Backend Server

> **아키텍처**: Django 표준 컨벤션 (앱 기반 모듈화, 단일 책임 원칙)
>
> **역할**: API 게이트웨이, 인증, DB/S3 접근, AI Server로 요청 중계

```
trade_backend/
│
├── manage.py                         # Django CLI 진입점 (runserver, migrate 등)
│
├── trade_backend/                    # 🔧 Django 프로젝트 설정
│   ├── __init__.py                   # PyMySQL 드라이버 초기화
│   ├── settings.py                   # 환경설정 (DB 연결, AWS 키, AGENT_SERVER_URL 등)
│   ├── urls.py                       # 최상위 URL 라우터 (각 앱 URL include)
│   ├── wsgi.py                       # Gunicorn 배포용 WSGI 애플리케이션
│   └── asgi.py                       # 비동기 서버용 ASGI 애플리케이션
│
├── accounts/                         # 👤 사용자/인증 앱
│   ├── models.py                     # Department(부서), User(사원) 모델
│   ├── views.py                      # 로그인 API, 사용자/부서 CRUD API
│   ├── serializers.py                # User, Department JSON 직렬화
│   ├── urls.py                       # /api/auth/*, /api/users/*, /api/departments/*
│   ├── admin.py                      # Django Admin 사용자 관리 화면
│   └── tests.py                      # 인증/사용자 테스트
│
├── trades/                           # 📋 무역 거래 앱
│   ├── models.py                     # TradeFlow(거래), Document(문서),
│   │                                 # DocVersion(버전), DocMessage(채팅기록) 모델
│   ├── views.py                      # 거래 생성/조회, 문서 CRUD, 버전 관리 API
│   ├── serializers.py                # Trade, Document 등 JSON 직렬화
│   ├── services.py                   # PDF 업로드 처리 (→ Agent Server로 벡터화 요청)
│   ├── urls.py                       # /api/trades/*, /api/documents/*
│   ├── admin.py                      # Django Admin 거래/문서 관리 화면
│   └── tests.py                      # 거래/문서 테스트
│
├── chat/                             # 💬 AI 채팅 앱
│   ├── models.py                     # GenChat(채팅방), GenMessage(메시지),
│   │                                 # GenUploadFile(첨부파일, 구현 예정) 모델
│   ├── views.py                      # 일반채팅, 문서채팅 API (→ Agent Server 호출)
│   │                                 # - ChatStreamView: 일반 무역 Q&A (SSE 스트리밍)
│   │                                 # - DocumentChatStreamView: 문서 작성 지원 채팅
│   ├── utils.py                      # 채팅 유틸리티 (parse_edit_response 등)
│   ├── constants.py                  # 채팅 상수 (TOOL_DISPLAY_INFO, STEP_TO_DOC_TYPE)
│   ├── serializers.py                # 채팅 메시지 JSON 직렬화
│   ├── urls.py                       # /api/chat/*, /api/documents/chat/*
│   ├── admin.py                      # Django Admin 채팅 관리 화면
│   └── tests.py                      # 채팅 테스트
│
├── utils/                            # 🛠️ 공통 유틸리티 모듈 (앱 아님)
│   ├── __init__.py
│   ├── s3.py                         # AWS S3 Presigned URL 생성 (파일 업로드/다운로드)
│   ├── pdf.py                        # PDF 텍스트 추출 (PyMuPDF)
│   ├── auth.py                       # 사용자 조회 헬퍼 (get_user_by_id_or_emp_no)
│   └── agent_client.py               # Agent Server HTTP 클라이언트
│                                     # - 재시도 로직, 타임아웃, 에러 핸들링 포함
│                                     # - POST /api/agent/trade, /write, /read 호출
│
├── scripts/                          # 📜 관리용 스크립트
│   └── setup_s3_cors.py              # S3 버킷 CORS 설정 (최초 1회 실행)
│
├── requirements.txt                  # Python 패키지 의존성
├── Dockerfile                        # Docker 이미지 빌드 설정
├── .env                              # 환경변수 (DB 비밀번호, API 키 등)
└── .env.example                      # 환경변수 템플릿
```

#### 앱별 책임 (단일 책임 원칙)

| 앱 | 책임 | 주요 모델 | 주요 API |
|----|------|----------|----------|
| **accounts** | 사용자 인증, 부서 관리 | Department, User | 로그인, 사용자 CRUD |
| **trades** | 무역 거래/문서 관리 | TradeFlow, Document, DocVersion, DocMessage | 거래 생성, 문서 CRUD, 버전 저장 |
| **chat** | AI 채팅 요청 중계 | GenChat, GenMessage, GenUploadFile | 일반채팅, 문서채팅 (SSE 스트리밍) |
| **utils** | 공통 유틸리티 | (없음) | S3, PDF, Agent 통신 |

> **Note**: 메모리 관리(Mem0)는 Agent Server(EC2 #2)에서 담당합니다.

---

### 2.2 EC2 #2: AI Agent Server (FastAPI)

> **아키텍처**: FastAPI 표준 컨벤션 + 도메인 특화 (AI Agent)
>
> **역할**: AI 에이전트 실행, RAG 검색, 메모리 관리, 외부 AI 서비스 호출

```
ai-server/                            # (현재 backend/agent_core/ 기반)
│
├── main.py                           # FastAPI 앱 진입점 + 라우터 등록
│
├── api/                              # 🌐 API 엔드포인트
│   ├── __init__.py
│   ├── trade.py                      # POST /api/agent/trade (무역 Q&A)
│   ├── write.py                      # POST /api/agent/write (문서 작성 지원)
│   ├── read.py                       # POST /api/agent/read (문서 분석)
│   └── ingest.py                     # POST /api/ingest (업로드 문서 벡터화 저장)
│
├── agents/                           # 🤖 AI 에이전트 정의
│   ├── __init__.py
│   ├── trade_agent.py                # Trade Compliance Analyst (일반 무역 Q&A 에이전트)
│   ├── write_agent.py                # Document Writing Assistant (문서 작성 지원 에이전트)
│   └── read_agent.py                 # Document Reader Assistant (업로드 문서 분석 에이전트)
│
├── services/                         # ⚙️ 비즈니스 로직
│   ├── __init__.py
│   ├── rag/                          # RAG 파이프라인 (Qdrant 통합)
│   │   ├── __init__.py
│   │   ├── search.py                 # Qdrant 벡터 검색 (Read)
│   │   ├── ingest.py                 # 업로드 문서 Qdrant 벡터 저장 (Write)
│   │   ├── reranker.py               # RunPod Reranker 호출
│   │   └── query_transformer.py      # 쿼리 변환
│   │
│   ├── memory.py                     # Mem0 메모리 관리
│   │
│   └── web_search.py                 # Tavily 웹 검색
│
├── schemas/                          # Pydantic 스키마
│   ├── __init__.py
│   ├── request.py                    # API 요청 스키마
│   └── response.py                   # API 응답 스키마
│
├── config/                           # 설정 + 클라이언트 초기화
│   ├── __init__.py
│   ├── settings.py                   # 환경변수 로드
│   ├── clients.py                    # OpenAI, Qdrant 클라이언트 초기화
│   ├── monitoring.py                 # Langfuse 모니터링 설정
│   └── fallback_prompts.py           # Langfuse 장애 시 fallback 프롬프트
│
├── requirements.txt                  # Python 의존성
├── Dockerfile                        # FastAPI 컨테이너 설정
├── .env                              # 환경 변수
└── .env.example                      # 환경 변수 예시
```

---

### 2.3 Vercel: Frontend (React + Vite)

> **아키텍처**: Vite/React 표준 컨벤션 (src/ 기반, 페이지/컴포넌트 분리)
>
> **역할**: 사용자 인터페이스, Backend API 호출, SSE 스트리밍 처리

```
frontend/
├── src/
│   ├── main.tsx                      # 앱 진입점
│   ├── App.tsx                       # 메인 앱 컴포넌트
│   │
│   ├── pages/                        # 📄 페이지 컴포넌트
│   │   ├── LoginPage.tsx             # 로그인 페이지
│   │   ├── MainPage.tsx              # 메인 페이지 (거래 목록)
│   │   └── ChatPage.tsx              # 일반 채팅 페이지
│   │
│   ├── components/
│   │   ├── common/                   # 🔧 공통 컴포넌트
│   │   │   └── ShootingStarIntro.tsx # 인트로 애니메이션
│   │   │
│   │   ├── chat/                     # 💬 채팅 관련
│   │   │   └── ChatAssistant.tsx     # AI 채팅 어시스턴트 (사이드바)
│   │   │
│   │   ├── document/                 # 📋 문서 뷰어 관련
│   │   │   ├── PdfViewer.tsx         # PDF 뷰어
│   │   │   └── VersionHistorySidebar.tsx # 버전 히스토리
│   │   │
│   │   ├── documentCreation/         # ✏️ 문서 생성 모듈
│   │   │   ├── index.tsx             # 모듈 진입점
│   │   │   ├── types.ts              # 타입 정의
│   │   │   ├── hooks/                # 커스텀 훅
│   │   │   │   ├── index.ts
│   │   │   │   ├── useDocumentState.ts
│   │   │   │   └── useSharedData.ts
│   │   │   ├── layout/               # 레이아웃
│   │   │   │   ├── index.ts
│   │   │   │   ├── DocumentHeader.tsx
│   │   │   │   └── StepNavigation.tsx
│   │   │   ├── modals/               # 모달
│   │   │   │   ├── index.ts
│   │   │   │   ├── DownloadModal.tsx
│   │   │   │   ├── ExitConfirmModal.tsx
│   │   │   │   ├── LogoutConfirmModal.tsx
│   │   │   │   ├── MyPageModal.tsx
│   │   │   │   ├── PasswordChangeModal.tsx
│   │   │   │   └── SaveSuccessModal.tsx
│   │   │   └── steps/                # 문서 작성 단계별 뷰
│   │   │       ├── index.ts
│   │   │       ├── EditorView.tsx
│   │   │       ├── EmptyState.tsx
│   │   │       ├── FileUploadView.tsx
│   │   │       ├── ModeSelector.tsx
│   │   │       └── SkipState.tsx
│   │   │
│   │   ├── editor/                   # 📝 에디터 모듈
│   │   │   ├── DocumentEditor.tsx    # 문서 에디터 (← ContractEditor 리네임)
│   │   │   └── EditorToolbar.tsx     # 에디터 툴바
│   │   │
│   │   └── ui/                       # 🎨 UI 컴포넌트 (shadcn/ui)
│   │
│   ├── utils/                        # 🛠️ 유틸리티
│   │   ├── api.ts                    # 메인 API 클라이언트 (싱글톤)
│   │   │                             # - 인증, 거래, 문서, 버전, 메시지 CRUD
│   │   │                             # - SSE 스트리밍 (채팅, 문서 상태)
│   │   │                             # - 타입 정의 (User, Trade, Document 등)
│   │   │
│   │   ├── documentApi.ts            # S3 업로드 전용 유틸리티
│   │   │                             # - Presigned URL 요청 → S3 PUT → 완료 알림
│   │   │                             # - uploadDocumentFlow(): 전체 업로드 플로우 통합
│   │   │                             # - subscribeToDocumentStatus(): 처리 상태 SSE 구독
│   │   │
│   │   └── documentUtils.ts          # HTML 템플릿 처리 유틸리티
│   │                                 # - hydrateTemplate(): 템플릿 → 편집 가능 필드 변환
│   │                                 # - extractDataFromContent(): HTML에서 필드 값 추출
│   │                                 # - updateContentWithSharedData(): 공유 데이터 동기화
│   │                                 # - checkStepCompletion(): 단계 완료 여부 확인
│   │
│   ├── templates/                    # 📑 문서 데이터 템플릿 (TS)
│   │   ├── commercialInvoice.ts
│   │   ├── offerSheet.ts
│   │   ├── packingList.ts
│   │   ├── proformaInvoice.ts
│   │   └── saleContract.ts
│   │
│   └── styles/                       # 🎨 스타일 (CSS)
│       └── globals.css               # 전역 CSS + 문서 템플릿 스타일
│
├── public/                           # 정적 파일
│   └── doc_templates/                # HTML 문서 템플릿
│
├── package.json                      # 의존성 관리
├── vite.config.ts                    # Vite 설정
├── tsconfig.json                     # TypeScript 설정
├── tailwind.config.cjs               # Tailwind 설정
└── .env                              # 환경 변수 (VITE_API_URL)
```

#### 디렉토리별 책임

| 디렉토리 | 책임 | 주요 파일 |
|----------|------|----------|
| **pages/** | 라우팅 페이지 | LoginPage, MainPage, ChatPage |
| **components/common/** | 재사용 공통 UI | ShootingStarIntro |
| **components/chat/** | 채팅 기능 | ChatAssistant (사이드바 AI) |
| **components/document/** | 문서 뷰어 | PdfViewer, VersionHistorySidebar |
| **components/documentCreation/** | 문서 생성 워크플로우 | 단계별 뷰, 모달, 훅 |
| **components/editor/** | 텍스트 에디터 | DocumentEditor, EditorToolbar |
| **utils/** | API 통신 및 템플릿 처리 | api.ts (메인 API), documentApi.ts (S3 업로드), documentUtils.ts (HTML 템플릿) |

---

## 3. 파일 이동/리네임 매핑

### 3.1 Django (backend/) 변경사항

#### 신규 생성

| 파일/디렉토리 | 용도 |
|--------------|------|
| `accounts/` 앱 전체 | 사용자/인증 관리 (User, Department 분리) |
| `utils/agent_client.py` | Agent Server HTTP 클라이언트 |

#### 이동/리네임

| 현재 | 변경 후 | 이유 |
|------|---------|------|
| `config/` | `trade_backend/` | Django 표준 컨벤션 (프로젝트명과 동일) |
| `documents/` | `trades/` | 직관적 네이밍 (무역 거래 중심) |
| `documents/models.py` (User, Department) | `accounts/models.py` | 사용자 모델 분리 |
| `documents/views.py` (LoginView, UserViewSet) | `accounts/views.py` | 인증 관련 분리 |
| `chat/trade_views.py` | `chat/views.py`에 통합 | Django 컨벤션 (단일 파일) |
| `chat/config.py` | `trade_backend/settings.py` | 설정은 settings에 통합 |
| `agent_core/s3_utils.py` | `utils/s3.py` | 공통 모듈로 이동 |
| `agent_core/pdf_parser.py` | `utils/pdf.py` | 공통 모듈로 이동 |

#### 삭제 (EC2 #2로 분리)

| 현재 | 이유 |
|------|------|
| `agent_core/` 전체 | AI Server (EC2 #2)로 분리 |

#### 중복 제거

| 파일 | 이유 |
|------|------|
| `chat/trade_views.py`의 TradeFlowViewSet | `trades/views.py`와 중복 |
| `chat/trade_views.py`의 DocumentViewSet | `trades/views.py`와 중복 |
| `documents/views.py`의 DocumentChatView | `chat/views.py`로 통합 |
| `get_user_by_id_or_emp_no()` 함수 (3곳 중복) | `utils/auth.py`로 통합 |
| `TOOL_DISPLAY_INFO` 상수 (3곳 중복) | `chat/constants.py`로 통합 |

### 3.2 agent_core/ → ai-server/ 분리

| 현재 위치 | 분리 후 위치 | 변경 사항 |
|----------|-------------|----------|
| `chat/memory_service.py` | `ai-server/services/memory.py` | Django → Agent Server 이동 |
| `documents/services.py` (Qdrant 저장) | `ai-server/services/rag/ingest.py` | ⭐ Qdrant Write → Agent Server 이동 |
| `documents/services.py` (S3 다운로드) | `ai-server/services/rag/ingest.py` | ⭐ S3 다운로드도 Agent Server에서 수행 |
| `agent_core/agents.py` | `ai-server/agents/trade_agent.py`, `write_agent.py`, `read_agent.py` | 에이전트별 파일 분리 + `_agent` 접미사 |
| `agent_core/tools/search_tool.py` | `ai-server/services/rag/search.py` | RAG 서비스로 통합 |
| `agent_core/tools/web_search_tool.py` | `ai-server/services/web_search.py` | services로 이동 |
| `agent_core/services/query_transformer_service.py` | `ai-server/services/rag/query_transformer.py` | RAG 하위로 |
| `agent_core/services/reranker_service.py` | `ai-server/services/rag/reranker.py` | RAG 하위로 |
| `agent_core/models/*.py` | `ai-server/schemas/*.py` | FastAPI 컨벤션 |
| `agent_core/config.py` | `ai-server/config/clients.py` | 클라이언트 초기화 |
| `agent_core/langfuse_config.py` | `ai-server/config/monitoring.py` | 모니터링 설정 |
| `agent_core/collection_manager.py` | `ai-server/services/rag/search.py` | RAG search에 통합 |
| `agent_core/prompts/*` | `ai-server/config/fallback_prompts.py` | fallback 프롬프트로 통합 |

> **⭐ 핵심 변경**: Qdrant 접근(Read/Write)이 모두 Agent Server로 통합됨.
> Django는 `POST /api/ingest` 호출로 문서 벡터화 요청만 함.

### 3.3 Frontend 변경사항

#### src/로 이동

| 현재 위치 | V2 위치 | 비고 |
|----------|---------|------|
| `App.tsx` | `src/App.tsx` | 표준 위치로 이동 |
| `components/` | `src/components/` | 표준 위치로 이동 |
| `utils/` | `src/utils/` | 표준 위치로 이동 |
| `templates/` | `src/templates/` | 표준 위치로 이동 |
| `styles/` | `src/styles/` | 표준 위치로 이동 |
| `doc_templates/` | `public/doc_templates/` | 정적 파일로 분류 |

#### 페이지 분리 (components → pages)

| 현재 위치 | V2 위치 | 비고 |
|----------|---------|------|
| `components/LoginPage.tsx` | `src/pages/LoginPage.tsx` | 페이지 컴포넌트 분리 |
| `components/MainPage.tsx` | `src/pages/MainPage.tsx` | 페이지 컴포넌트 분리 |
| `components/ChatPage.tsx` | `src/pages/ChatPage.tsx` | 페이지 컴포넌트 분리 |

#### 컴포넌트 그룹화

| 현재 위치 | V2 위치 | 비고 |
|----------|---------|------|
| `components/ChatAssistant.tsx` | `src/components/chat/ChatAssistant.tsx` | 채팅 그룹 |
| `components/PdfViewer.tsx` | `src/components/document/PdfViewer.tsx` | 문서 뷰어 그룹 |
| `components/VersionHistorySidebar.tsx` | `src/components/document/VersionHistorySidebar.tsx` | 문서 뷰어 그룹 |
| `components/ShootingStarIntro.tsx` | `src/components/common/ShootingStarIntro.tsx` | 공통 컴포넌트 |

#### 리네임

| 현재 | V2 | 이유 |
|------|-----|------|
| `components/document-creation/` | `src/components/documentCreation/` | React 컨벤션 (camelCase) |
| `editor/ContractEditor.tsx` | `editor/DocumentEditor.tsx` | 범용 에디터 이름 |
| `ContractEditorRef` (타입) | `DocumentEditorRef` | 타입명 일치 |

#### 삭제 대상

| 파일 | 이유 |
|------|------|
| `components/DocumentCreationPage.tsx` | 빈 wrapper, `documentCreation/index.tsx`로 대체됨 |
| `components/CommercialInvoiceTemplate.tsx` | 미사용 (어디서도 import되지 않음) |
| `components/SalesContractTemplate.tsx` | 미사용 (어디서도 import되지 않음) |
| `components/OthersDocumentViewer.tsx` | 미사용 (어디서도 import되지 않음) |
| `components/StepSelector.tsx` | 미사용 (어디서도 import되지 않음) |
| `components/figma/` | 미사용 디렉토리 (ImageWithFallback.tsx가 import되지 않음) |
| `src/index.css` | 미사용 (globals.css만 import됨) |

#### 설정 파일 수정

**vite.config.ts** - 경로 alias 추가:
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

**tsconfig.json** - paths 설정:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

## 4. 네이밍 컨벤션

### 4.1 Django (backend/)

| 용도 | 위치 | 예시 |
|------|------|------|
| 프로젝트 설정 | `trade_backend/settings.py` | DB, AWS, AGENT_SERVER_URL |
| 앱 설정 | `앱명/apps.py` | 앱 초기화 |
| 모델 | `앱명/models.py` | Django ORM 모델 |
| 뷰 | `앱명/views.py` | API 엔드포인트 (단일 파일) |
| 시리얼라이저 | `앱명/serializers.py` | DRF 시리얼라이저 |
| 서비스 | `앱명/services.py` | 비즈니스 로직 |
| URL | `앱명/urls.py` | URL 라우팅 |
| 공통 유틸 | `utils/*.py` | s3.py, pdf.py, agent_client.py |
| 스크립트 | `scripts/*.py` | setup_s3_cors.py |

### 4.2 FastAPI (ai-server/)

| 용도 | 위치 | 예시 |
|------|------|------|
| API 엔드포인트 | `api/*.py` | trade.py, write.py, read.py, ingest.py |
| 에이전트 정의 | `agents/*_agent.py` | trade_agent.py, write_agent.py, read_agent.py |
| RAG 서비스 | `services/rag/*.py` | search.py, ingest.py, reranker.py |
| 기타 서비스 | `services/*.py` | memory.py, web_search.py |
| Pydantic 스키마 | `schemas/*.py` | request.py, response.py |
| 설정/클라이언트 | `config/*.py` | settings.py, clients.py |
| Fallback 프롬프트 | `config/fallback_prompts.py` | Langfuse 장애 시 사용 |

> **Note**: `agents/` 파일은 `*_agent.py` 접미사를 사용하여 `api/` 파일과 구분합니다.

### 4.3 React (frontend/)

| 용도 | 위치 | 예시 |
|------|------|------|
| 페이지 | `src/pages/*.tsx` | LoginPage.tsx, MainPage.tsx |
| 컴포넌트 | `src/components/**/*.tsx` | ChatAssistant.tsx |
| 훅 | `src/**/hooks/*.ts` | useDocumentState.ts |
| 유틸리티 | `src/utils/*.ts` | api.ts, documentUtils.ts |
| 타입 | `src/**/types.ts` | 모듈별 타입 정의 |
| 스타일 | `src/styles/*.css` | globals.css |
| UI 컴포넌트 | `src/components/ui/*.tsx` | shadcn/ui |

---

# Part 2: 개발자 상세 가이드 (V2 구조 기준)

---

## 5. 프론트엔드 상세

### 5.1 페이지 컴포넌트 계층

```
App.tsx (루트)
├── LoginPage.tsx          # /login
├── MainPage.tsx           # / (메인 대시보드)
├── ChatPage.tsx           # /chat (일반 AI 채팅)
└── DocumentCreationPage   # /document (문서 작성)
    └── documentCreation/index.tsx
```

### 5.2 DocumentCreationPage 상세 구조 (★ 가장 복잡)

```
src/components/documentCreation/
├── index.tsx                    # ★ 메인 컴포넌트 (상태 통합)
├── types.ts                     # 타입 정의
│
├── layout/                      # 레이아웃 컴포넌트
│   ├── index.ts                 # export 모음
│   ├── DocumentHeader.tsx       # 상단 헤더 (로고, 유저 메뉴)
│   └── StepNavigation.tsx       # 스텝 네비게이션 바
│
├── modals/                      # 모달 컴포넌트
│   ├── index.ts                 # export 모음
│   ├── DownloadModal.tsx        # 다운로드 모달
│   ├── ExitConfirmModal.tsx     # 나가기 확인 모달
│   ├── LogoutConfirmModal.tsx   # 로그아웃 확인 모달
│   ├── MyPageModal.tsx          # 마이페이지 모달
│   ├── PasswordChangeModal.tsx  # 비밀번호 변경 모달
│   └── SaveSuccessModal.tsx     # 저장 성공 모달
│
├── steps/                       # Step별 뷰 컴포넌트
│   ├── index.ts                 # export 모음
│   ├── ModeSelector.tsx         # manual/upload/skip 선택 UI
│   ├── EditorView.tsx           # 에디터 뷰 (manual 모드)
│   ├── FileUploadView.tsx       # 파일 업로드 뷰 (upload 모드)
│   ├── SkipState.tsx            # 건너뛰기 상태 뷰 (skip 모드)
│   ├── EmptyState.tsx           # 빈 상태 뷰
│   └── ShippingDocsDashboard.tsx # Step 4 CI/PL 대시보드
│
└── hooks/                       # 커스텀 훅
    ├── useDocumentState.ts      # ★ 문서 상태 관리
    ├── useSharedData.ts         # ★ 필드 데이터 공유/동기화
    ├── useSaveDocument.ts       # 저장 로직
    └── useUpload.ts             # 파일 업로드 로직
```

### 5.3 DocumentCreationPage 하위 파일 역할

| 파일 | 역할 | UI 수정 시 참고 |
|------|------|----------------|
| `layout/DocumentHeader.tsx` | 상단 로고, 유저 아바타, 메뉴 버튼 | 헤더 UI 수정 |
| `layout/StepNavigation.tsx` | 1-4 스텝 진행 표시 바 | 스텝 바 스타일 수정 |
| `modals/DownloadModal.tsx` | PDF/Word 다운로드 선택 | 다운로드 UI 수정 |
| `modals/SaveSuccessModal.tsx` | 저장 완료 알림 | 저장 완료 메시지 수정 |
| `steps/ModeSelector.tsx` | 수동작성/업로드/건너뛰기 선택 버튼 | 모드 선택 UI 수정 |
| `steps/EditorView.tsx` | 에디터 + AI 채팅 레이아웃 | 에디터 영역 레이아웃 |
| `steps/FileUploadView.tsx` | 파일 드래그앤드롭, 업로드 진행률 | 업로드 UI 수정 |
| `steps/ShippingDocsDashboard.tsx` | CI/PL 선택 대시보드 (Step 4) | Step 4 대시보드 UI |

### 5.4 에디터 컴포넌트 구조

```
src/components/editor/
├── DocumentEditor.tsx     # ★ 핵심 Tiptap 에디터 (← ContractEditor 리네임)
├── EditorToolbar.tsx      # 툴바 (볼드, 정렬 등)
└── editor.css             # 에디터 전용 스타일

DocumentEditor 주요 기능:
- DataField 노드: <span data-field-id="xxx"> 형태의 편집 가능 필드
- Checkbox/Radio 노드: 체크박스, 라디오 버튼
- applyFieldChanges(): AI가 제안한 변경사항 적용
- 같은 fieldId 필드 자동 동기화
```

### 5.5 shadcn/ui 컴포넌트 (46개)

#### 자주 사용되는 컴포넌트

| 컴포넌트 | 파일 | 용도 |
|----------|------|------|
| Button | `button.tsx` | 버튼 (variants: default, destructive, outline, ghost 등) |
| Input | `input.tsx` | 텍스트 입력 |
| Dialog | `dialog.tsx` | 모달 다이얼로그 |
| Select | `select.tsx` | 드롭다운 선택 |
| Card | `card.tsx` | 카드 컨테이너 |
| Tabs | `tabs.tsx` | 탭 UI |
| Table | `table.tsx` | 테이블 |
| Badge | `badge.tsx` | 배지/태그 |
| Alert | `alert.tsx` | 알림 메시지 |
| Progress | `progress.tsx` | 진행률 표시 |
| Tooltip | `tooltip.tsx` | 툴팁 |

#### 전체 컴포넌트 목록

```
accordion, alert-dialog, alert, aspect-ratio, avatar, badge,
breadcrumb, button, calendar, card, carousel, chart, checkbox,
collapsible, command, context-menu, dialog, drawer, dropdown-menu,
form, hover-card, input-otp, input, label, menubar, navigation-menu,
pagination, popover, progress, radio-group, resizable, scroll-area,
select, separator, sheet, sidebar, skeleton, slider, sonner, switch,
table, tabs, textarea, toggle-group, toggle, tooltip
```

---

## 6. 백엔드 상세

### 6.1 Django 앱 구조

```
trade_backend/
├── trade_backend/       # 프로젝트 설정
├── accounts/            # 사용자/인증 앱 (User, Department)
├── trades/              # 무역 거래 앱 (TradeFlow, Document, DocVersion, DocMessage)
├── chat/                # 채팅 앱 (GenChat, GenMessage, GenUploadFile)
└── utils/               # 공통 유틸리티
```

### 6.2 핵심 모델 (trades/models.py)

```python
TradeFlow       # 거래 플로우 (여러 문서 포함)
Document        # 문서 (doc_type: offer/pi/contract/ci/pl)
DocVersion      # 문서 버전 (저장 히스토리)
DocMessage      # 문서별 채팅 메시지
```

**모델 관계:**
```
User (1) ─────> (N) TradeFlow
TradeFlow (1) ─> (N) Document
Document (1) ──> (N) DocVersion
Document (1) ──> (N) DocMessage
```

### 6.3 인증 모델 (accounts/models.py)

```python
Department      # 부서
User            # 사용자 (emp_no 로그인)
```

### 6.4 채팅 모델 (chat/models.py)

```python
GenChat         # 일반 채팅 세션
GenMessage      # 일반 채팅 메시지
GenUploadFile   # 일반 채팅 첨부 파일 (구현 예정)
```

---

## 7. AI Agent 시스템

### 7.1 에이전트 구성

| 에이전트 | 파일 | 용도 | 사용 도구 |
|----------|------|------|-----------|
| **Trade Compliance Analyst** | `agents/trade_agent.py` | 일반 무역 Q&A | rag/search, web_search |
| **Document Writing Assistant** | `agents/write_agent.py` | 문서 작성/편집 지원 | rag/search, web_search |
| **Document Reader Assistant** | `agents/read_agent.py` | 업로드 문서 분석 | rag/search, web_search |

### 7.2 doc_mode에 따른 에이전트 자동 선택

채팅 API에서 `Document.doc_mode`에 따라 적절한 에이전트를 자동 선택:

| doc_mode | upload_status | 선택 에이전트 | 용도 |
|----------|---------------|--------------|------|
| `upload` | `ready` | `Document Reader Assistant` | 업로드 문서 내용 검색/질의 |
| `manual` | - | `Document Writing Assistant` | 문서 편집/작성 지원 |
| 그 외 | - | `Document Writing Assistant` | 기본값 |

**모드 전환 시 DB 업데이트:**
- 프론트엔드에서 모드 선택 시 `PATCH /api/documents/documents/{id}/` 호출
- `doc_mode` 필드 업데이트 → 다음 채팅 시 올바른 에이전트 선택

### 7.3 API 엔드포인트 (Agent Server)

| 메서드 | 경로 | 설명 | 파일 |
|--------|------|------|------|
| POST | `/api/agent/trade` | Trade Compliance Analyst 호출 | `api/trade.py` |
| POST | `/api/agent/write` | Document Writing Assistant 호출 | `api/write.py` |
| POST | `/api/agent/read` | Document Reader Assistant 호출 | `api/read.py` |
| POST | `/api/ingest` | 문서 벡터화 저장 (Qdrant Write) | `api/ingest.py` |
| GET | `/health` | 헬스체크 | `main.py` |

### 7.4 RAG 파이프라인 흐름

```
사용자 질문
    ↓
[Query Transformer] 쿼리 개선 + 복합 질문 분해
    ↓
[Multi Search] 병렬 임베딩 + 병렬 Qdrant 검색
    ↓
[Reranker] 관련도 재정렬 (선택적)
    ↓
[Agent] GPT-4o로 답변 생성
```

### 7.5 Qdrant 컬렉션 구조

| 컬렉션 | 변수명 | 용도 |
|--------|--------|------|
| `collection_trade` | `COLLECTION_KNOWLEDGE` | 공통 무역 지식 (법령, 매뉴얼) |
| `collection_trade_user_documents` | `COLLECTION_USER_DOCS` | 사용자 업로드 문서 |
| `trade_memory` | - | Mem0 메모리 저장 |

**벡터 설정:**
```python
EMBEDDING_MODEL = "text-embedding-3-large"
VECTOR_SIZE = 3072
```

### 7.6 Mem0 메모리 서비스 (services/memory.py)

```python
TradeMemoryService:
├── 단기 메모리 (doc_id 기반)
│   └── 현재 문서 대화 컨텍스트
└── 장기 메모리 (user_id 기반)
    └── 사용자 선호도, 패턴
```

**메모리 저장 위치:**
- RDS (MySQL): 전체 대화 히스토리 (DocMessage 테이블)
- Qdrant: 중요 정보 벡터 (trade_memory 컬렉션)

---

## 8. 데이터 흐름 및 상태 관리

### 8.1 프론트엔드 상태 흐름

```
App.tsx (전역 상태)
│
├── documentData: Record<number, string>  # Step별 문서 HTML
├── currentStep: number                    # 현재 Step (1-4)
├── tradeId: number                        # 백엔드 TradeFlow ID
└── docIds: Record<string, number>         # doc_type → doc_id 매핑

    ↓ Props로 전달

DocumentCreationPage
│
├── useDocumentState()    # stepModes, modifiedSteps, isDirty
├── useSharedData()       # sharedData, hydrateTemplate, extractData
└── useSaveDocument()     # 저장 로직

    ↓ Props로 전달

DocumentEditor (에디터)  ←→  ChatAssistant (AI 채팅)
    │                              │
    └─ editorRef ─────────────────┘
       (getContent, applyFieldChanges)
```

### 8.2 필드 데이터 동기화 흐름

```
1. 사용자가 필드 수정
   └─> DocumentEditor.onUpdate()
       └─> 같은 fieldId 필드 자동 동기화
       └─> data-source="user" 설정

2. AI가 필드 수정 제안
   └─> ChatAssistant에서 "적용" 클릭
       └─> editorRef.applyFieldChanges(changes)
           └─> data-source="agent" 설정

3. 다른 Step으로 이동
   └─> useSharedData.extractData() → sharedData 저장
   └─> 새 Step 로드 시 hydrateTemplate() → sharedData 주입
       └─> data-source="mapped" 설정
```

### 8.3 Step 전환 시 데이터 흐름 상세

```
Step 1 (Offer Sheet)
    │
    ├─ 사용자가 seller_name = "ABC Corp" 입력
    │   └─ data-source="user"
    │
    ├─ useSharedData.extractData() 호출
    │   └─ sharedData = { seller_name: "ABC Corp" }
    │
    └─ Step 2로 이동
        │
        ├─ PI 템플릿 로드
        │   └─ <mark>[seller_name]</mark>
        │
        └─ hydrateTemplate() 적용
            └─ <span data-field-id="seller_name" data-source="mapped">ABC Corp</span>
```

### 8.4 data-source 값 의미

| 값 | 의미 | 배경색 (에디터) |
|----|------|----------------|
| `user` | 사용자가 직접 입력 | 파란색 (`bg-blue-100`) |
| `agent` | AI가 제안하여 적용 | 노란색 (`bg-yellow-100`) |
| `mapped` | 다른 Step에서 동기화 | 초록색 (`bg-green-100`) |
| `null` | 플레이스홀더 상태 | 회색 (`bg-gray-50`) |

---

## 9. API 엔드포인트 매핑

### 9.1 문서 API (`/api/documents/`)

| Method | Endpoint | 용도 | 프론트엔드 호출 위치 |
|--------|----------|------|---------------------|
| POST | `/auth/login/` | 로그인 | `LoginPage.tsx` |
| GET | `/trades/` | 거래 목록 | `MainPage.tsx` |
| POST | `/trades/` | 거래 생성 | `MainPage.tsx` |
| GET | `/trades/{id}/` | 거래 상세 | `App.tsx` |
| GET | `/documents/` | 문서 목록 | - |
| PUT | `/documents/{id}/` | 문서 수정 | `useSaveDocument.ts` |
| PATCH | `/documents/{id}/` | 문서 부분 수정 (doc_mode 등) | `index.tsx` |
| POST | `/documents/{id}/upload_request/` | S3 업로드 URL | `useFileUpload.ts` |
| POST | `/documents/{id}/upload_complete/` | 업로드 완료 | `useFileUpload.ts` |
| GET | `/documents/{id}/status/stream/` | 처리 상태 SSE | `useFileUpload.ts` |
| GET | `/versions/` | 버전 목록 | `VersionHistorySidebar.tsx` |

### 9.2 채팅 API (`/api/`)

| Method | Endpoint | 용도 | 프론트엔드 호출 위치 |
|--------|----------|------|---------------------|
| POST | `/chat/` | 일반 채팅 | `ChatPage.tsx` |
| POST | `/chat/stream/` | 일반 채팅 (스트림) | `ChatPage.tsx` |
| POST | `/documents/chat/stream/` | 문서 채팅 (스트림) | `ChatAssistant.tsx` |
| GET | `/documents/{id}/chat/history/` | 채팅 히스토리 | `ChatAssistant.tsx` |
| POST | `/trades/init/` | 거래 초기화 | - |

### 9.3 V2 URL 변경사항

| 현재 (README) | V2 (리팩토링 후) | 비고 |
|---------------|------------------|------|
| `/api/trade/init/` | `/api/trades/init/` | trades 앱으로 이동 |
| `/api/trade/{id}/` | `/api/trades/{id}/` | trades 앱으로 이동 |
| `/api/documents/chat/stream/` | `/api/chat/documents/stream/` | chat 앱으로 이동 |

> **Note**: `/api/documents/` 경로는 Frontend 호환성을 위해 유지합니다.

### 9.4 프론트엔드 → 백엔드 연동 파일

| 프론트엔드 파일 | 호출하는 API |
|----------------|-------------|
| `src/utils/api.ts` | 공통 API 유틸리티 |
| `src/components/chat/ChatAssistant.tsx` | `/api/documents/chat/stream/` |
| `src/components/documentCreation/hooks/useSaveDocument.ts` | `/api/documents/{id}/` |
| `src/components/documentCreation/hooks/useFileUpload.ts` | 업로드 관련 API |
| `src/components/documentCreation/index.tsx` | `/api/documents/{id}/` (doc_mode 업데이트) |

---

## 10. 컴포넌트 의존성 맵

### 10.1 DocumentCreationPage 의존성

```
DocumentCreationPage (index.tsx)
├── imports from './types'
│   └── StepMode, UploadStatus, ShippingDocType, DocumentCreationPageProps
├── imports from './hooks/*'
│   ├── useDocumentState
│   ├── useSharedData
│   ├── useSaveDocument
│   └── useUpload
├── imports from './layout/*'
│   ├── DocumentHeader
│   └── StepNavigation
├── imports from './steps/*'
│   ├── ModeSelector
│   ├── EditorView
│   ├── FileUploadView
│   └── ShippingDocsDashboard
├── imports from './modals/*'
│   └── DownloadModal, SaveSuccessModal, etc.
├── imports from '../editor/*'
│   └── DocumentEditor, DocumentEditorRef, FieldChange
├── imports from '../chat/*'
│   └── ChatAssistant
└── imports from '../document/*'
    └── VersionHistorySidebar
```

### 10.2 DocumentEditor 의존성

```
DocumentEditor.tsx
├── @tiptap/react (useEditor, EditorContent, Node, Extension...)
├── @tiptap/extension-* (Table, Highlight, FontFamily...)
├── ./EditorToolbar
├── ./editor.css
└── ../../templates/saleContract (기본 템플릿)
```

### 10.3 ChatAssistant 의존성

```
ChatAssistant.tsx
├── react (useState, useRef, useEffect, useMemo)
├── lucide-react (아이콘)
├── ../editor/DocumentEditor (DocumentEditorRef 타입)
└── react-markdown (마크다운 렌더링)
```

---

## 11. 스타일링 시스템

### 11.1 스타일 파일 위치

| 파일 | 용도 |
|------|------|
| `src/styles/globals.css` | 전역 CSS, CSS 변수, 문서 스타일 |
| `src/components/editor/editor.css` | 에디터 전용 스타일 |
| `tailwind.config.js` | Tailwind 설정 |

### 11.2 CSS 변수 (globals.css)

```css
:root {
  --font-size: 16px;
  --background: #ffffff;
  --foreground: oklch(0.145 0 0);
  --primary: #030213;
  --muted: #ececf0;
  --border: rgba(0, 0, 0, 0.1);
  --radius: 0.625rem;
  /* ... */
}
```

### 11.3 문서별 CSS 클래스

| 클래스 | 문서 타입 | 위치 |
|--------|----------|------|
| `.offer-sheet-wrapper` | Offer Sheet | `globals.css` |
| `.po-wrapper` | Purchase Order | `globals.css` |
| `.pi-wrapper` | Proforma Invoice | `globals.css` |
| `.pl-wrapper` | Packing List | `globals.css` |
| `.ci-wrapper` | Commercial Invoice | `globals.css` |
| `.sc-wrapper` | Sales Contract | `globals.css` |

### 11.4 UI 수정 시 주의사항

1. **Tailwind 클래스**: 대부분의 UI는 Tailwind 유틸리티 클래스 사용
2. **문서 스타일**: 문서 렌더링 스타일은 `globals.css`의 wrapper 클래스
3. **shadcn/ui**: `src/components/ui/` 폴더의 컴포넌트 수정
4. **다크모드**: `.dark` 클래스로 다크모드 스타일 정의됨

---

## 12. 문서 템플릿 시스템

### 12.1 템플릿 파일 위치

```
src/templates/
├── offerSheet.ts       # Offer Sheet HTML
├── proformaInvoice.ts  # Proforma Invoice HTML
├── saleContract.ts     # Sales Contract HTML
├── commercialInvoice.ts # Commercial Invoice HTML
└── packingList.ts      # Packing List HTML
```

### 12.2 템플릿 필드 문법

```html
<!-- 편집 가능 필드 -->
<mark>[fieldId]</mark>

<!-- 예시 -->
<mark>[seller_name]</mark>
<mark>[buyer_name]</mark>
<mark>[offer_date]</mark>
```

**변환 과정:**
```
템플릿: <mark>[seller_name]</mark>
    ↓ hydrateTemplate()
에디터: <span data-field-id="seller_name">[seller_name]</span>
    ↓ 사용자 입력
에디터: <span data-field-id="seller_name" data-source="user">ABC Corp</span>
```

### 12.3 공통 필드 ID 목록

| Field ID | 설명 | 사용 문서 |
|----------|------|----------|
| `seller_name` | 판매자명 | 전체 |
| `buyer_name` | 구매자명 | 전체 |
| `offer_date` | 오퍼 날짜 | Offer, PI |
| `offer_no` | 오퍼 번호 | Offer, PI |
| `quantity` | 수량 | 전체 |
| `unit_price` | 단가 | 전체 |
| `total_amount` | 총액 | 전체 |
| `payment_terms` | 결제 조건 | PI, Contract |
| `delivery_terms` | 인도 조건 | PI, Contract |

### 12.4 문서 타입 및 Step 매핑

| Step | 문서 타입 | doc_type (DB) | 설명 |
|------|----------|---------------|------|
| 1 | Offer Sheet | `offer` | 견적서 |
| 2 | Proforma Invoice (PI) | `pi` | 견적 송장 |
| 3 | Sales Contract | `contract` | 매매 계약서 |
| 4 | Commercial Invoice (CI) | `ci` | 상업 송장 |
| 4 | Packing List (PL) | `pl` | 포장 명세서 |

---

# Part 3: 마이그레이션 & 운영

---

## 13. 환경 변수 설정

### 13.1 EC2 #1: Django Backend (.env)

```bash
# Django
DEBUG=False
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=api.trade-ai.com,localhost

# Database (AWS RDS)
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_PORT=3306
DB_NAME=trade_db
DB_USER=admin
DB_PASSWORD=your-db-password

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_STORAGE_BUCKET_NAME=trade-ai-documents
AWS_S3_REGION_NAME=ap-northeast-2

# Agent Server 연결 (신규)
AGENT_SERVER_URL=http://<EC2-#2-Private-IP>:8001
AGENT_SERVER_TIMEOUT=30
AGENT_SERVER_RETRY_COUNT=3
```

### 13.2 EC2 #2: AI Agent Server (.env)

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Qdrant
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-qdrant-key
QDRANT_COLLECTION_NAME=trade_documents

# Tavily (웹 검색)
TAVILY_API_KEY=tvly-...

# RunPod (Reranker)
RUNPOD_API_URL=https://api.runpod.ai/v2/...
RUNPOD_API_KEY=your-runpod-key

# Langfuse (모니터링)
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
LANGFUSE_HOST=https://cloud.langfuse.com

# AWS S3 (문서 다운로드용)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_REGION_NAME=ap-northeast-2
```

### 13.3 Frontend (.env)

```bash
VITE_OPENAI_API_KEY=sk-xxx          # OpenAI API 키 (직접 호출 테스트용)
VITE_USE_DJANGO=true                 # Django 백엔드 사용 여부
VITE_DJANGO_API_URL=http://localhost:8000  # 백엔드 URL
```

### 13.4 개발 서버 실행

```bash
# Frontend
cd frontend
npm install
npm run dev  # localhost:5173

# Backend
cd backend
pip install -r requirements.txt
python manage.py runserver  # localhost:8000
```

---

## 14. 마이그레이션 계획

### Phase 1: accounts 앱 분리 (Day 1-2)

```bash
# 1. accounts 앱 생성
python manage.py startapp accounts

# 2. 모델 이동 (documents/models.py → accounts/models.py)
#    - Department, User 모델 이동
#    - ForeignKey 참조 업데이트

# 3. 뷰 이동 (documents/views.py → accounts/views.py)
#    - LoginView, UserViewSet, DepartmentViewSet 이동

# 4. URL 라우팅 업데이트
#    - trade_backend/urls.py에 accounts.urls include

# 5. 마이그레이션 실행
python manage.py makemigrations accounts
python manage.py migrate
```

### Phase 2: documents → trades 리네임 (Day 3-4)

```bash
# 1. trades 앱 생성
python manage.py startapp trades

# 2. 모델 이동 (documents/models.py → trades/models.py)
#    - TradeFlow, Document, DocVersion, DocMessage 이동

# 3. ForeignKey 참조 업데이트
#    - User → accounts.User로 변경

# 4. 뷰/시리얼라이저 이동

# 5. URL 라우팅 업데이트 (하위 호환성 유지)
#    - /api/documents/ 경로 유지

# 6. 마이그레이션
python manage.py makemigrations trades
python manage.py migrate

# 7. documents 앱 삭제 (확인 후)
```

### Phase 3: agent_core → ai-server 분리 (Day 5-7)

```bash
# 1. ai-server 디렉토리 생성 (별도 레포지토리 권장)

# 2. 코드 이동
#    - agent_core/agents.py → ai-server/agents/
#    - agent_core/tools/ → ai-server/services/
#    - chat/memory_service.py → ai-server/services/memory.py

# 3. FastAPI 앱 구성
#    - main.py 작성
#    - 라우터 등록

# 4. utils/agent_client.py 작성
#    - HTTP 클라이언트 구현

# 5. chat/views.py 수정
#    - Python 함수 호출 → agent_client 호출로 변경

# 6. 통합 테스트

# 7. EC2 #2 배포
```

### Phase 4: Frontend 정리 (Day 8-9)

```bash
# 1. src/ 구조로 이동
#    - App.tsx → src/App.tsx
#    - components/ → src/components/

# 2. pages/ 분리
#    - LoginPage, MainPage, ChatPage → src/pages/

# 3. 컴포넌트 그룹화
#    - chat/, document/, common/ 디렉토리 생성

# 4. 미사용 파일 삭제
#    - CommercialInvoiceTemplate.tsx
#    - SalesContractTemplate.tsx 등

# 5. vite.config.ts, tsconfig.json 경로 alias 설정

# 6. import 경로 업데이트
```

### 롤백 계획

| Phase | 롤백 방법 |
|-------|----------|
| Phase 1 | Git revert + `migrate accounts zero` |
| Phase 2 | Git revert + `migrate trades zero` |
| Phase 3 | EC2 #2 종료, Django agent_core 복원 |
| Phase 4 | Git revert |

---

## 15. Docker Compose 예시

### 15.1 EC2 #1 (Django Backend)

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - django

  django:
    build: .
    command: gunicorn trade_backend.wsgi:application --bind 0.0.0.0:8000 --workers 4
    expose:
      - "8000"
    environment:
      - AGENT_SERVER_URL=http://<EC2-#2-IP>:8001
    env_file:
      - .env
```

### 15.2 EC2 #2 (AI Agent Server)

```yaml
version: '3.8'

services:
  agent:
    build: .
    command: uvicorn main:app --host 0.0.0.0 --port 8001 --workers 4
    ports:
      - "8001:8001"
    env_file:
      - .env
```

---

## 16. 보안 고려사항

### 16.1 EC2 간 통신 보안

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS VPC                               │
│                                                             │
│   ┌─────────────────┐         ┌─────────────────┐          │
│   │   EC2 #1        │         │   EC2 #2        │          │
│   │   (Django)      │◀───────▶│   (AI Server)   │          │
│   │                 │  Private │                 │          │
│   │   SG: web-sg    │   IP    │   SG: agent-sg  │          │
│   └─────────────────┘         └─────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 16.2 Security Group 설정

**web-sg (EC2 #1)**
| Type | Port | Source | 설명 |
|------|------|--------|------|
| HTTP | 80 | 0.0.0.0/0 | 외부 접근 |
| HTTPS | 443 | 0.0.0.0/0 | 외부 접근 |
| SSH | 22 | My IP | 관리자 접근 |

**agent-sg (EC2 #2)**
| Type | Port | Source | 설명 |
|------|------|--------|------|
| Custom TCP | 8001 | web-sg | EC2 #1에서만 접근 |
| SSH | 22 | My IP | 관리자 접근 |

### 16.3 API 인증 (선택사항)

```python
# ai-server/api/dependencies.py
from fastapi import Header, HTTPException

async def verify_internal_token(x_internal_token: str = Header(...)):
    if x_internal_token != settings.INTERNAL_API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid token")
```

```python
# backend/utils/agent_client.py
headers = {
    "X-Internal-Token": settings.INTERNAL_API_TOKEN,
    "Content-Type": "application/json"
}
```

### 16.4 민감 정보 관리

- `.env` 파일은 절대 Git에 커밋하지 않음
- AWS Secrets Manager 또는 Parameter Store 사용 권장
- 환경별 `.env.example` 템플릿 유지

---

## 17. 에러 핸들링 전략

### 17.1 Agent Client 재시도 로직

```python
# backend/utils/agent_client.py
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

class AgentClient:
    def __init__(self):
        self.base_url = settings.AGENT_SERVER_URL
        self.timeout = settings.AGENT_SERVER_TIMEOUT  # 30초
        self.client = httpx.AsyncClient(timeout=self.timeout)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10)
    )
    async def call_agent(self, endpoint: str, payload: dict) -> dict:
        try:
            response = await self.client.post(
                f"{self.base_url}{endpoint}",
                json=payload,
                headers={"X-Internal-Token": settings.INTERNAL_API_TOKEN}
            )
            response.raise_for_status()
            return response.json()
        except httpx.TimeoutException:
            raise AgentTimeoutError("Agent Server 응답 시간 초과")
        except httpx.HTTPStatusError as e:
            raise AgentAPIError(f"Agent Server 오류: {e.response.status_code}")
```

### 17.2 Fallback 응답 전략

```python
# backend/chat/views.py
async def chat_stream(request):
    try:
        response = await agent_client.call_agent("/api/agent/trade", payload)
        return StreamingResponse(response)
    except AgentTimeoutError:
        return JsonResponse({
            "error": "AI 서버 응답 지연",
            "fallback": True,
            "message": "잠시 후 다시 시도해주세요."
        }, status=503)
    except AgentAPIError:
        return JsonResponse({
            "error": "AI 서버 일시적 오류",
            "fallback": True,
            "message": "문서 CRUD는 정상 작동합니다."
        }, status=503)
```

### 17.3 헬스체크

```python
# ai-server/main.py
@app.get("/health")
async def health_check():
    checks = {
        "openai": await check_openai(),
        "qdrant": await check_qdrant(),
        "langfuse": await check_langfuse()
    }
    all_healthy = all(checks.values())
    return {
        "status": "healthy" if all_healthy else "degraded",
        "checks": checks
    }
```

### 17.4 에러 상태 정의

| 상황 | HTTP Status | 사용자 메시지 | CRUD 영향 |
|------|-------------|--------------|-----------|
| Agent Server 다운 | 503 | "AI 기능 일시 중단" | ❌ 없음 |
| Agent 응답 지연 | 504 | "응답 시간 초과" | ❌ 없음 |
| OpenAI API 오류 | 502 | "AI 서비스 오류" | ❌ 없음 |
| Qdrant 연결 실패 | 503 | "검색 기능 제한" | ❌ 없음 |

---

## 18. UI 수정 가이드

### 18.1 수정 위치 빠른 참조

| 수정 대상 | 파일 경로 |
|----------|----------|
| 로그인 화면 | `src/pages/LoginPage.tsx` |
| 메인 대시보드 | `src/pages/MainPage.tsx` |
| 상단 헤더 | `src/components/documentCreation/layout/DocumentHeader.tsx` |
| 상단 스텝 바 | `src/components/documentCreation/layout/StepNavigation.tsx` |
| 모드 선택 UI | `src/components/documentCreation/steps/ModeSelector.tsx` |
| 파일 업로드 UI | `src/components/documentCreation/steps/FileUploadView.tsx` |
| 에디터 툴바 | `src/components/editor/EditorToolbar.tsx` |
| 에디터 본문 스타일 | `src/components/editor/editor.css` |
| AI 채팅 UI | `src/components/chat/ChatAssistant.tsx` |
| 버튼 스타일 | `src/components/ui/button.tsx` |
| 입력창 스타일 | `src/components/ui/input.tsx` |
| 문서 인쇄 스타일 | `src/styles/globals.css` |
| 전역 색상/폰트 | `src/styles/globals.css` (CSS 변수) |

### 18.2 자주 수정하는 UI 요소

#### 버튼 스타일 변경
```
파일: src/components/ui/button.tsx
위치: buttonVariants 객체 내부
```

#### 에디터 필드 하이라이트 색상
```
파일: src/components/editor/DocumentEditor.tsx
위치: DataField NodeView 내부 (bgClass 변수)
```

#### 채팅 메시지 스타일
```
파일: src/components/chat/ChatAssistant.tsx
위치: messages.map() 내부 JSX
```

#### 문서 인쇄 레이아웃
```
파일: src/styles/globals.css
위치: 각 문서 wrapper 클래스 (.offer-sheet-wrapper 등)
```

### 18.3 의존성 주의사항

| 컴포넌트 수정 시 | 영향받는 곳 |
|-----------------|-----------|
| `DocumentEditor` | `DocumentCreationPage`, `ChatAssistant` |
| `ChatAssistant` | `DocumentCreationPage` |
| `useSharedData` | 모든 Step 간 데이터 동기화 |
| `types.ts` | 문서 관련 모든 컴포넌트 |
| `globals.css` 변수 | 전체 앱 스타일 |

### 18.4 파일 수정 시 영향 범위 체크리스트

#### DocumentEditor.tsx 수정 시
- [ ] DataField 노드 렌더링 확인
- [ ] 필드 동기화 로직 확인 (onUpdate)
- [ ] applyFieldChanges 동작 확인
- [ ] 모든 문서 템플릿에서 테스트

#### useSharedData.ts 수정 시
- [ ] Step 1→2→3→4 순차 이동 테스트
- [ ] 역방향 이동 (3→2→1) 테스트
- [ ] 필드 값 동기화 확인
- [ ] data-source 속성 확인

#### globals.css 문서 스타일 수정 시
- [ ] 웹 브라우저 렌더링 확인
- [ ] PDF 다운로드 후 레이아웃 확인
- [ ] 인쇄 미리보기 확인

#### ChatAssistant.tsx 수정 시
- [ ] 메시지 전송/수신 테스트
- [ ] 스트리밍 응답 확인
- [ ] "적용" 버튼 동작 확인
- [ ] Step 전환 시 채팅 초기화 확인

---

## 19. 디버깅 가이드

### 19.1 프론트엔드 디버깅

```javascript
// ChatAssistant.tsx - API 호출 디버깅
console.log('🔍 Chat API 호출 정보:', { documentId, currentDocId, effectiveDocId, ... });

// ChatAssistant.tsx - 에이전트 정보 (SSE 응답)
📋 Chat Session 초기화: {doc_id: 81, trade_id: 17}
🤖 Agent 정보
   📄 Mode: 업로드 모드 (upload)      // 또는 ✏️ Mode: 작성 모드 (manual)
   Name: Document Reader Assistant   // 또는 Document Writing Assistant
   Model: gpt-4o
   Tools: search_user_document, search_trade_documents, search_web
-----------------------------------
🧠 Mem0 컨텍스트: 이전 대화 N개 참조

// index.tsx - 모드 변경 시
📝 doc_mode 업데이트: doc_id=81, mode=manual
```

### 19.2 백엔드 디버깅

```bash
# Django 로그 확인
python manage.py runserver --verbosity=2

# Agent 검색 로그 (자동 출력)
🔍 검색 시작: 'xxx' (초기 검색: 25개, 최종 선정: 10개)
📌 검색 수행 (단일 쿼리)
✓ 최종 N개 문서 수집
🎯 Reranker로 선정된 최종 N개 문서
🤖 모델이 위 문서를 기반으로 답변 생성 중...
```

### 19.3 자주 발생하는 문제

| 문제 | 원인 | 해결 |
|------|------|------|
| "문서 ID가 없습니다" | docIds 매핑 누락 | App.tsx에서 docIds 전달 확인 |
| AI 응답 없음 | OPENAI_API_KEY 미설정 | .env 확인 |
| 검색 결과 없음 | Qdrant 컬렉션 비어있음 | 데이터 임베딩 확인 |
| CORS 에러 | CORS_ALLOWED_ORIGINS 미설정 | settings.py 확인 |
| 필드 동기화 안됨 | fieldId 불일치 | 템플릿 fieldId 확인 |
| 스트리밍 끊김 | 네트워크 타임아웃 | 프록시/방화벽 확인 |
| 잘못된 에이전트 호출 | doc_mode가 DB에 반영 안됨 | 콘솔에서 `📝 doc_mode 업데이트` 로그 확인 |
| 업로드 후에도 Writing Agent | upload_status가 ready 아님 | Document.upload_status 확인 |

### 19.4 주의해야 할 파일

| 파일 | 주의사항 |
|------|---------|
| `DocumentEditor.tsx` | Tiptap 확장 구조 복잡, 노드 타입 수정 시 주의 |
| `useSharedData.ts` | 필드 동기화 로직, 버그 발생 시 다른 Step에 영향 |
| `globals.css` | 문서 스타일 수정 시 인쇄 결과 확인 필요 |
| `App.tsx` | 전역 상태 변경 시 모든 페이지에 영향 |
| `memory.py` | Mem0 설정 변경 시 메모리 손실 가능 |

---

## 20. README 원본과의 변경 비교

> 이 섹션은 `README.md`의 현재 구조와 V2의 차이점을 상세히 비교합니다.

### 20.1 디렉토리 구조 비교

#### README 원본 (현재)
```
backend/
├── config/                    # Django 설정
├── chat/                      # 채팅 앱 (views + trade_views 혼재)
│   ├── models.py              # documents 모델 re-export + GenChat
│   ├── views.py
│   ├── trade_views.py         # 문서 채팅 + Trade 관리 (혼재)
│   ├── memory_service.py      # Mem0 메모리 (→ Agent Server로 이동)
│   └── config.py
├── documents/                 # 문서 앱 (모든 모델 + 인증)
│   ├── models.py              # User, Department, TradeFlow, Document...
│   └── views.py               # CRUD + 채팅 (중복)
├── agent_core/                # AI 에이전트 (Backend 내부)
│   ├── agents.py
│   ├── tools/
│   ├── services/
│   └── ...
└── scripts/
```

#### V2 (리팩토링 후)
```
trade_backend/                 # EC2 #1
├── trade_backend/             # Django 설정 (프로젝트명과 동일)
├── accounts/                  # ✨ 신규: 사용자/인증 분리
│   └── models.py              # User, Department
├── trades/                    # ✨ 리네임: documents → trades
│   └── models.py              # TradeFlow, Document, DocVersion, DocMessage
├── chat/                      # ✨ 정리: 채팅 전용
│   ├── models.py              # GenChat, GenMessage, GenUploadFile
│   ├── views.py               # 모든 채팅 뷰 통합 (Agent Server HTTP 호출)
│   ├── utils.py               # 채팅 유틸리티 (parse_edit_response)
│   └── constants.py           # 채팅 상수 (TOOL_DISPLAY_INFO)
├── utils/                     # ✨ 신규: 공통 유틸
│   ├── agent_client.py        # Agent Server HTTP 클라이언트
│   └── auth.py                # 사용자 조회 헬퍼
└── scripts/

ai-server/                     # EC2 #2 (← agent_core + memory + Qdrant 통합)
├── api/                       # API 엔드포인트 (trade, write, read, ingest)
├── agents/                    # 에이전트 정의
├── services/                  # 비즈니스 로직
│   ├── rag/                   # RAG 파이프라인
│   │   ├── search.py          # Qdrant 검색 (Read)
│   │   └── ingest.py          # ⭐ Qdrant 저장 (Write) - Django에서 이동
│   ├── memory.py              # ← chat/memory_service.py 이동
│   └── web_search.py
├── schemas/                   # Pydantic 스키마
└── config/                    # 설정 + fallback 프롬프트
```

### 20.2 통신 흐름 변경

#### README 원본 (현재)
```
Frontend → Backend (Django)
                ↓
           agent_core (Python 함수 호출, 같은 프로세스)
                ↓
           External Services
```

#### V2 (리팩토링 후)
```
Frontend → Backend (Django, EC2 #1)
                ↓
           utils/agent_client.py (HTTP 클라이언트)
                ↓
           AI Server (FastAPI, EC2 #2)
                ↓
           External Services
```

### 20.3 변경 이유 요약

| 변경 | 이유 |
|------|------|
| `accounts/` 앱 신규 | Django 권장: User 모델은 별도 앱 |
| `documents/` → `trades/` | 직관적 네이밍 (무역 거래 중심) |
| `chat/trade_views.py` 통합 | Django 컨벤션: views.py 단일 파일 |
| ViewSet 중복 제거 | 앱 간 책임 명확화 |
| `agent_core/` 분리 | 서버 분리로 독립 스케일링 가능 |
| `memory_service.py` → Agent Server | 모든 AI 작업(LLM, RAG, Memory) 한 곳에서 관리 |
| ⭐ Qdrant 접근 → Agent Server 통합 | Django 순수화, AI 서버만 Qdrant/OpenAI 접근 |
| `utils/agent_client.py` 신규 | Agent Server HTTP 통신 추상화 |

---

## 21. 파일별 한줄 요약

### 21.1 Frontend

| 파일 | 역할 |
|------|------|
| `src/App.tsx` | 라우팅, 전역 상태 (documentData, tradeId) |
| `src/pages/LoginPage.tsx` | 로그인 UI, 인증 처리 |
| `src/pages/MainPage.tsx` | 거래 목록, 새 거래 생성 |
| `src/pages/ChatPage.tsx` | 일반 AI 채팅 (문서 무관) |
| `src/components/documentCreation/index.tsx` | 문서 작성 페이지 통합 |
| `src/components/documentCreation/layout/DocumentHeader.tsx` | 상단 헤더 (로고, 유저 메뉴) |
| `src/components/documentCreation/layout/StepNavigation.tsx` | 스텝 진행 바 |
| `src/components/documentCreation/steps/ModeSelector.tsx` | 모드 선택 UI |
| `src/components/documentCreation/steps/EditorView.tsx` | 에디터 + 채팅 레이아웃 |
| `src/components/documentCreation/steps/FileUploadView.tsx` | 파일 업로드 UI |
| `src/components/documentCreation/hooks/useDocumentState.ts` | 문서 상태 관리 |
| `src/components/documentCreation/hooks/useSharedData.ts` | 필드 데이터 공유 |
| `src/components/editor/DocumentEditor.tsx` | Tiptap 에디터, 필드 노드 |
| `src/components/editor/EditorToolbar.tsx` | 에디터 상단 툴바 |
| `src/components/chat/ChatAssistant.tsx` | 문서 작성 중 AI 채팅 |
| `src/components/document/VersionHistorySidebar.tsx` | 버전 히스토리 사이드바 |
| `src/templates/*.ts` | 각 문서 HTML 템플릿 |
| `src/utils/api.ts` | API 호출 유틸리티 |
| `src/styles/globals.css` | 전역 CSS, 문서 인쇄 스타일 |

### 21.2 Backend (EC2 #1)

| 파일 | 역할 |
|------|------|
| `trade_backend/settings.py` | Django 설정 (DB, AWS, CORS) |
| `trade_backend/urls.py` | 루트 URL 라우팅 |
| `accounts/models.py` | 사용자/부서 모델 (User, Department) |
| `accounts/views.py` | 로그인, 사용자 CRUD API |
| `trades/models.py` | 핵심 모델 (TradeFlow, Document, DocVersion, DocMessage) |
| `trades/views.py` | 거래/문서 CRUD, 업로드 API |
| `trades/urls.py` | 거래/문서 앱 URL |
| `chat/models.py` | 일반 채팅 모델 (GenChat, GenMessage) |
| `chat/views.py` | 모든 채팅 API (일반 + 문서, Agent Server 호출) |
| `chat/utils.py` | 채팅 유틸리티 (parse_edit_response) |
| `chat/constants.py` | 채팅 상수 (TOOL_DISPLAY_INFO) |
| `utils/agent_client.py` | Agent Server HTTP 클라이언트 |
| `utils/s3.py` | AWS S3 Presigned URL 생성 |
| `utils/pdf.py` | PDF 텍스트 추출 |
| `utils/auth.py` | 사용자 조회 헬퍼 |

### 21.3 AI Server (EC2 #2)

| 파일 | 역할 |
|------|------|
| `main.py` | FastAPI 앱 진입점 |
| `api/trade.py` | POST /api/agent/trade (무역 Q&A) |
| `api/write.py` | POST /api/agent/write (문서 작성 지원) |
| `api/read.py` | POST /api/agent/read (문서 분석) |
| `api/ingest.py` | POST /api/ingest (문서 벡터화) |
| `agents/trade_agent.py` | Trade Compliance Analyst 에이전트 |
| `agents/write_agent.py` | Document Writing Assistant 에이전트 |
| `agents/read_agent.py` | Document Reader Assistant 에이전트 |
| `services/rag/search.py` | Qdrant 벡터 검색 |
| `services/rag/ingest.py` | Qdrant 벡터 저장 |
| `services/rag/reranker.py` | RunPod Reranker 호출 |
| `services/rag/query_transformer.py` | 쿼리 변환 |
| `services/memory.py` | Mem0 메모리 관리 |
| `services/web_search.py` | Tavily 웹 검색 |
| `config/settings.py` | 환경변수 로드 |
| `config/clients.py` | OpenAI, Qdrant 클라이언트 |
| `config/monitoring.py` | Langfuse 모니터링 |
| `config/fallback_prompts.py` | Langfuse 장애 시 fallback |

---

## 핵심 설계 원칙

1. **서버 분리**: Django(API/DB) ↔ FastAPI(AI) 워커 블로킹 방지
2. **비동기 처리**: Agent Server는 Uvicorn(ASGI)으로 외부 API 호출 최적화
3. **독립 스케일링**: AI 트래픽 증가 시 EC2 #2만 스케일 아웃
4. **장애 격리**: Agent Server 장애 시에도 문서 CRUD는 정상 동작
5. **네이밍 일관성**: Django/FastAPI 각각의 컨벤션 준수

---

*문서 최종 업데이트: 2025-12-08*
