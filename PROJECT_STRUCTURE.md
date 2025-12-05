# TRADE-AI-ASSISTANT 프로젝트 구조 문서

> **목적**: AI 에이전트 및 개발자가 빠르게 작업 위치를 파악하고 효율적으로 협업할 수 있도록 프로젝트 구조를 상세히 문서화

---

## 목차
1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [디렉토리 구조](#3-디렉토리-구조)
4. [프론트엔드 상세](#4-프론트엔드-상세)
5. [백엔드 상세](#5-백엔드-상세)
6. [AI Agent 시스템](#6-ai-agent-시스템)
7. [데이터 흐름 및 상태 관리](#7-데이터-흐름-및-상태-관리)
8. [API 엔드포인트 매핑](#8-api-엔드포인트-매핑)
9. [컴포넌트 의존성 맵](#9-컴포넌트-의존성-맵)
10. [스타일링 시스템](#10-스타일링-시스템)
11. [문서 템플릿 시스템](#11-문서-템플릿-시스템)
12. [UI 수정 가이드](#12-ui-수정-가이드)
13. [환경 변수](#13-환경-변수)
14. [디버깅 가이드](#14-디버깅-가이드)
15. [파일별 한줄 요약](#15-파일별-한줄-요약)

---

## 1. 프로젝트 개요

**TRADE-AI-ASSISTANT**는 무역 문서 작성을 AI가 보조하는 웹 애플리케이션입니다.

### 핵심 기능
- **무역 문서 자동 생성**: Offer Sheet → PI → Sales Contract → CI/PL 순차 작성
- **AI 채팅 어시스턴트**: 문서 작성 중 실시간 AI 지원
- **문서 업로드 및 RAG**: PDF 업로드 후 벡터 검색 기반 Q&A
- **버전 관리**: 문서 저장 시 버전 히스토리 유지
- **필드 자동 동기화**: 같은 fieldId를 가진 필드 간 값 자동 동기화

### 문서 타입 및 Step 매핑
| Step | 문서 타입 | doc_type (DB) | 설명 |
|------|----------|---------------|------|
| 1 | Offer Sheet | `offer` | 견적서 |
| 2 | Proforma Invoice (PI) | `pi` | 견적 송장 |
| 3 | Sales Contract | `contract` | 매매 계약서 |
| 4 | Commercial Invoice (CI) | `ci` | 상업 송장 |
| 4 | Packing List (PL) | `pl` | 포장 명세서 |

---

## 2. 기술 스택

### 프론트엔드
| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19.x | UI 프레임워크 |
| TypeScript | 5.x | 타입 안정성 |
| Vite | 6.x | 빌드 도구 |
| Tailwind CSS | 4.x | 유틸리티 CSS |
| shadcn/ui | - | UI 컴포넌트 라이브러리 (46개 컴포넌트) |
| Tiptap | 2.x | 리치 텍스트 에디터 |
| Lucide React | - | 아이콘 |

### 백엔드
| 기술 | 버전 | 용도 |
|------|------|------|
| Django | 5.2 | 웹 프레임워크 |
| Django REST Framework | - | REST API |
| OpenAI Agents SDK | - | AI 에이전트 |
| Qdrant | - | 벡터 DB (RAG) |
| MySQL (RDS) | - | 관계형 DB |
| AWS S3 | - | 파일 저장소 |
| Mem0 | - | AI 메모리 관리 |
| Langfuse | - | 프롬프트 관리/모니터링 |
| Tavily | - | 웹 검색 API |

---

## 3. 디렉토리 구조

```
TRADE-AI-ASSISTANT/
├── frontend/                    # React 프론트엔드
│   ├── components/              # React 컴포넌트
│   │   ├── document-creation/   # ★ 문서 작성 페이지 (핵심)
│   │   ├── editor/              # ★ Tiptap 에디터 관련
│   │   ├── ui/                  # shadcn/ui 기본 컴포넌트 (46개)
│   │   ├── ChatAssistant.tsx    # ★ AI 채팅 컴포넌트
│   │   ├── ChatPage.tsx         # 일반 채팅 페이지
│   │   ├── MainPage.tsx         # 메인/대시보드 페이지
│   │   ├── LoginPage.tsx        # 로그인 페이지
│   │   └── VersionHistorySidebar.tsx  # 버전 히스토리
│   ├── templates/               # ★ 문서 HTML 템플릿
│   ├── styles/                  # 글로벌 CSS
│   ├── utils/                   # 유틸리티 함수
│   ├── lib/                     # 라이브러리 설정
│   ├── App.tsx                  # ★ 앱 루트 (라우팅, 전역 상태)
│   └── main.tsx                 # 엔트리 포인트
│
├── backend/                     # Django 백엔드
│   ├── config/                  # Django 설정
│   │   ├── settings.py          # ★ 환경 설정
│   │   └── urls.py              # 루트 URL 라우팅
│   ├── chat/                    # 채팅 앱
│   │   ├── views.py             # 일반 채팅 뷰
│   │   ├── trade_views.py       # ★ 무역 문서 채팅 뷰
│   │   ├── memory_service.py    # ★ Mem0 메모리 서비스
│   │   ├── models.py            # GenChat, GenMessage 모델
│   │   └── urls.py              # 채팅 URL
│   ├── documents/               # 문서 앱
│   │   ├── views.py             # ★ 문서 CRUD, 업로드
│   │   ├── models.py            # ★ 핵심 DB 모델
│   │   └── urls.py              # 문서 URL
│   └── agent_core/              # AI 에이전트 코어
│       ├── agents.py            # ★ Agent 팩토리
│       ├── config.py            # ★ Qdrant/OpenAI 설정
│       ├── tools/               # Agent 도구들
│       │   ├── search_tool.py   # RAG 검색
│       │   └── web_search_tool.py # 웹 검색
│       └── prompts/             # 프롬프트 템플릿
│
└── docs/                        # 문서
```

---

## 4. 프론트엔드 상세

### 4.1 페이지 컴포넌트 계층

```
App.tsx (루트)
├── LoginPage.tsx          # /login
├── MainPage.tsx           # / (메인 대시보드)
├── ChatPage.tsx           # /chat (일반 AI 채팅)
└── DocumentCreationPage   # /document (문서 작성)
    └── document-creation/index.tsx
```

### 4.2 DocumentCreationPage 상세 구조 (★ 가장 복잡)

```
frontend/components/document-creation/
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

### 4.3 DocumentCreationPage 하위 파일 역할

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

### 4.4 에디터 컴포넌트 구조

```
frontend/components/editor/
├── ContractEditor.tsx     # ★ 핵심 Tiptap 에디터
├── EditorToolbar.tsx      # 툴바 (볼드, 정렬 등)
└── editor.css             # 에디터 전용 스타일

ContractEditor 주요 기능:
- DataField 노드: <span data-field-id="xxx"> 형태의 편집 가능 필드
- Checkbox/Radio 노드: 체크박스, 라디오 버튼
- applyFieldChanges(): AI가 제안한 변경사항 적용
- 같은 fieldId 필드 자동 동기화
```

### 4.5 shadcn/ui 컴포넌트 (46개)

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

### 4.6 주요 컴포넌트 파일 위치

| 기능 | 파일 경로 |
|------|----------|
| 로그인 UI | `frontend/components/LoginPage.tsx` |
| 메인 대시보드 | `frontend/components/MainPage.tsx` |
| 문서 작성 전체 | `frontend/components/document-creation/index.tsx` |
| 상단 헤더 | `frontend/components/document-creation/layout/DocumentHeader.tsx` |
| 스텝 네비게이션 | `frontend/components/document-creation/layout/StepNavigation.tsx` |
| 문서 에디터 | `frontend/components/editor/ContractEditor.tsx` |
| 에디터 툴바 | `frontend/components/editor/EditorToolbar.tsx` |
| AI 채팅 | `frontend/components/ChatAssistant.tsx` |
| 버전 히스토리 | `frontend/components/VersionHistorySidebar.tsx` |

---

## 5. 백엔드 상세

### 5.1 Django 앱 구조

```
backend/
├── config/          # 프로젝트 설정
├── documents/       # 문서 관리 앱 (핵심 모델 정의)
├── chat/            # 채팅 앱 (일반 채팅 + 문서 채팅)
└── agent_core/      # AI 에이전트 로직
```

### 5.2 핵심 모델 (documents/models.py)

```python
Department      # 부서
User            # 사용자 (emp_no 로그인)
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

### 5.3 채팅 모델 (chat/models.py)

```python
GenChat         # 일반 채팅 세션
GenMessage      # 일반 채팅 메시지
GenUploadFile   # 일반 채팅 첨부 파일
```

---

## 6. AI Agent 시스템

### 6.1 Agent 팩토리 (agent_core/agents.py)

```python
get_trade_agent()           # 일반 무역 Q&A
get_document_writing_agent() # 문서 작성/편집 (수동 작성 모드)
get_read_document_agent()    # 업로드 문서 Q&A (업로드 모드)
```

### 6.2 doc_mode에 따른 에이전트 자동 선택

채팅 API (`chat/trade_views.py`)에서 `Document.doc_mode`에 따라 적절한 에이전트를 자동 선택:

| doc_mode | upload_status | 선택 에이전트 | 용도 |
|----------|---------------|--------------|------|
| `upload` | `ready` | `Document Reader Assistant` | 업로드 문서 내용 검색/질의 |
| `manual` | - | `Document Writing Assistant` | 문서 편집/작성 지원 |
| 그 외 | - | `Document Writing Assistant` | 기본값 |

**모드 전환 시 DB 업데이트:**
- 프론트엔드에서 모드 선택 시 `PATCH /api/documents/documents/{id}/` 호출
- `doc_mode` 필드 업데이트 → 다음 채팅 시 올바른 에이전트 선택

### 6.3 Agent Tools

| Tool | 파일 | 기능 |
|------|------|------|
| `search_trade_documents` | `agent_core/tools/search_tool.py` | 무역 지식 RAG 검색 |
| `search_user_document` | `agent_core/tools/search_tool.py` | 업로드 문서 내 검색 |
| `search_web` | `agent_core/tools/web_search_tool.py` | Tavily 웹 검색 |

### 6.4 RAG 파이프라인 흐름

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

### 6.5 Qdrant 컬렉션 구조

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

### 6.6 Mem0 메모리 서비스 (chat/memory_service.py)

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

## 7. 데이터 흐름 및 상태 관리

### 7.1 프론트엔드 상태 흐름

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

ContractEditor (에디터)  ←→  ChatAssistant (AI 채팅)
    │                              │
    └─ editorRef ─────────────────┘
       (getContent, applyFieldChanges)
```

### 7.2 필드 데이터 동기화 흐름

```
1. 사용자가 필드 수정
   └─> ContractEditor.onUpdate()
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

### 7.3 Step 전환 시 데이터 흐름 상세

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

### 7.4 data-source 값 의미

| 값 | 의미 | 배경색 (에디터) |
|----|------|----------------|
| `user` | 사용자가 직접 입력 | 파란색 (`bg-blue-100`) |
| `agent` | AI가 제안하여 적용 | 노란색 (`bg-yellow-100`) |
| `mapped` | 다른 Step에서 동기화 | 초록색 (`bg-green-100`) |
| `null` | 플레이스홀더 상태 | 회색 (`bg-gray-50`) |

---

## 8. API 엔드포인트 매핑

### 8.1 문서 API (`/api/documents/`)

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

### 8.2 채팅 API (`/api/`)

| Method | Endpoint | 용도 | 프론트엔드 호출 위치 |
|--------|----------|------|---------------------|
| POST | `/chat/` | 일반 채팅 | `ChatPage.tsx` |
| POST | `/chat/stream/` | 일반 채팅 (스트림) | `ChatPage.tsx` |
| POST | `/documents/chat/stream/` | 문서 채팅 (스트림) | `ChatAssistant.tsx` |
| GET | `/documents/{id}/chat/history/` | 채팅 히스토리 | `ChatAssistant.tsx` |
| POST | `/trade/init/` | 거래 초기화 | - |

### 8.3 프론트엔드 → 백엔드 연동 파일

| 프론트엔드 파일 | 호출하는 API |
|----------------|-------------|
| `frontend/utils/api.ts` | 공통 API 유틸리티 |
| `frontend/components/ChatAssistant.tsx` | `/api/documents/chat/stream/` |
| `frontend/components/document-creation/hooks/useSaveDocument.ts` | `/api/documents/{id}/` |
| `frontend/components/document-creation/hooks/useFileUpload.ts` | 업로드 관련 API |
| `frontend/components/document-creation/index.tsx` | `/api/documents/{id}/` (doc_mode 업데이트) |

---

## 9. 컴포넌트 의존성 맵

### 9.1 DocumentCreationPage 의존성

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
│   └── ContractEditor, ContractEditorRef, FieldChange
├── imports from '../ChatAssistant'
└── imports from '../VersionHistorySidebar'
```

### 9.2 ContractEditor 의존성

```
ContractEditor.tsx
├── @tiptap/react (useEditor, EditorContent, Node, Extension...)
├── @tiptap/extension-* (Table, Highlight, FontFamily...)
├── ./EditorToolbar
├── ./editor.css
└── ../../templates/saleContract (기본 템플릿)
```

### 9.3 ChatAssistant 의존성

```
ChatAssistant.tsx
├── react (useState, useRef, useEffect, useMemo)
├── lucide-react (아이콘)
├── ./editor/ContractEditor (ContractEditorRef 타입)
└── react-markdown (마크다운 렌더링)
```

---

## 10. 스타일링 시스템

### 10.1 스타일 파일 위치

| 파일 | 용도 |
|------|------|
| `frontend/styles/globals.css` | 전역 CSS, CSS 변수, 문서 스타일 |
| `frontend/components/editor/editor.css` | 에디터 전용 스타일 |
| `frontend/tailwind.config.js` | Tailwind 설정 |

### 10.2 CSS 변수 (globals.css)

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

### 10.3 문서별 CSS 클래스

| 클래스 | 문서 타입 | 위치 |
|--------|----------|------|
| `.offer-sheet-wrapper` | Offer Sheet | `globals.css:256` |
| `.po-wrapper` | Purchase Order | `globals.css:362` |
| `.pi-wrapper` | Proforma Invoice | `globals.css:502` |
| `.pl-wrapper` | Packing List | `globals.css:612` |
| `.ci-wrapper` | Commercial Invoice | `globals.css:706` |
| `.sc-wrapper` | Sales Contract | `globals.css:780` |

### 10.4 UI 수정 시 주의사항

1. **Tailwind 클래스**: 대부분의 UI는 Tailwind 유틸리티 클래스 사용
2. **문서 스타일**: 문서 렌더링 스타일은 `globals.css`의 wrapper 클래스
3. **shadcn/ui**: `frontend/components/ui/` 폴더의 컴포넌트 수정
4. **다크모드**: `.dark` 클래스로 다크모드 스타일 정의됨

---

## 11. 문서 템플릿 시스템

### 11.1 템플릿 파일 위치

```
frontend/templates/
├── offerSheet.ts       # Offer Sheet HTML
├── proformaInvoice.ts  # Proforma Invoice HTML
├── saleContract.ts     # Sales Contract HTML
├── commercialInvoice.ts # Commercial Invoice HTML
└── packingList.ts      # Packing List HTML
```

### 11.2 템플릿 필드 문법

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

### 11.3 공통 필드 ID 목록

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

---

## 12. UI 수정 가이드

### 12.1 수정 위치 빠른 참조

| 수정 대상 | 파일 경로 |
|----------|----------|
| 로그인 화면 | `frontend/components/LoginPage.tsx` |
| 메인 대시보드 | `frontend/components/MainPage.tsx` |
| 상단 헤더 | `frontend/components/document-creation/layout/DocumentHeader.tsx` |
| 상단 스텝 바 | `frontend/components/document-creation/layout/StepNavigation.tsx` |
| 모드 선택 UI | `frontend/components/document-creation/steps/ModeSelector.tsx` |
| 파일 업로드 UI | `frontend/components/document-creation/steps/FileUploadView.tsx` |
| 에디터 툴바 | `frontend/components/editor/EditorToolbar.tsx` |
| 에디터 본문 스타일 | `frontend/components/editor/editor.css` |
| AI 채팅 UI | `frontend/components/ChatAssistant.tsx` |
| 버튼 스타일 | `frontend/components/ui/button.tsx` |
| 입력창 스타일 | `frontend/components/ui/input.tsx` |
| 문서 인쇄 스타일 | `frontend/styles/globals.css` |
| 전역 색상/폰트 | `frontend/styles/globals.css` (CSS 변수) |

### 12.2 자주 수정하는 UI 요소

#### 버튼 스타일 변경
```
파일: frontend/components/ui/button.tsx
위치: buttonVariants 객체 내부
```

#### 에디터 필드 하이라이트 색상
```
파일: frontend/components/editor/ContractEditor.tsx
위치: DataField NodeView 내부 (bgClass 변수)
```

#### 채팅 메시지 스타일
```
파일: frontend/components/ChatAssistant.tsx
위치: messages.map() 내부 JSX
```

#### 문서 인쇄 레이아웃
```
파일: frontend/styles/globals.css
위치: 각 문서 wrapper 클래스 (.offer-sheet-wrapper 등)
```

### 12.3 의존성 주의사항

| 컴포넌트 수정 시 | 영향받는 곳 |
|-----------------|-----------|
| `ContractEditor` | `DocumentCreationPage`, `ChatAssistant` |
| `ChatAssistant` | `DocumentCreationPage` |
| `useSharedData` | 모든 Step 간 데이터 동기화 |
| `types.ts` | 문서 관련 모든 컴포넌트 |
| `globals.css` 변수 | 전체 앱 스타일 |

### 12.4 파일 수정 시 영향 범위 체크리스트

#### ContractEditor.tsx 수정 시
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

## 13. 환경 변수

### 13.1 Frontend (.env)

```env
VITE_OPENAI_API_KEY=sk-xxx          # OpenAI API 키 (직접 호출 테스트용)
VITE_USE_DJANGO=true                 # Django 백엔드 사용 여부
VITE_DJANGO_API_URL=http://localhost:8000  # 백엔드 URL
```

### 13.2 Backend (.env)

```env
# Django
DJANGO_SECRET_KEY=xxx
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
FRONTEND_URL=http://localhost:5173

# MySQL (RDS)
MYSQL_HOST=xxx.rds.amazonaws.com
MYSQL_PORT=3306
MYSQL_DATABASE=ragodb
MYSQL_USER=admin
MYSQL_PASSWORD=xxx

# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_STORAGE_BUCKET_NAME=xxx
AWS_S3_REGION_NAME=ap-northeast-2

# OpenAI
OPENAI_API_KEY=sk-xxx

# Qdrant (Cloud)
QDRANT_URL=https://xxx.qdrant.io
QDRANT_API_KEY=xxx

# Qdrant (Local - 대체)
QDRANT_HOST=localhost
QDRANT_PORT=6333

# Tavily (웹 검색)
TAVILY_API_KEY=tvly-xxx

# Langfuse (프롬프트 관리)
LANGFUSE_SECRET_KEY=xxx
LANGFUSE_PUBLIC_KEY=xxx
LANGFUSE_HOST=https://cloud.langfuse.com

# Reranker (선택적)
RERANKER_API_URL=http://your-runpod-server/rerank
```

### 13.3 개발 서버 실행

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

## 14. 디버깅 가이드

### 14.1 프론트엔드 디버깅

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

### 14.2 백엔드 디버깅

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

### 14.3 자주 발생하는 문제

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

### 14.4 주의해야 할 파일

| 파일 | 주의사항 |
|------|---------|
| `ContractEditor.tsx` | Tiptap 확장 구조 복잡, 노드 타입 수정 시 주의 |
| `useSharedData.ts` | 필드 동기화 로직, 버그 발생 시 다른 Step에 영향 |
| `globals.css` | 문서 스타일 수정 시 인쇄 결과 확인 필요 |
| `App.tsx` | 전역 상태 변경 시 모든 페이지에 영향 |
| `memory_service.py` | Mem0 설정 변경 시 메모리 손실 가능 |

---

## 15. 파일별 한줄 요약

### Frontend

| 파일 | 역할 |
|------|------|
| `App.tsx` | 라우팅, 전역 상태 (documentData, tradeId) |
| `LoginPage.tsx` | 로그인 UI, 인증 처리 |
| `MainPage.tsx` | 거래 목록, 새 거래 생성 |
| `ChatPage.tsx` | 일반 AI 채팅 (문서 무관) |
| `document-creation/index.tsx` | 문서 작성 페이지 통합 |
| `document-creation/layout/DocumentHeader.tsx` | 상단 헤더 (로고, 유저 메뉴) |
| `document-creation/layout/StepNavigation.tsx` | 스텝 진행 바 |
| `document-creation/steps/ModeSelector.tsx` | 모드 선택 UI |
| `document-creation/steps/EditorView.tsx` | 에디터 + 채팅 레이아웃 |
| `document-creation/steps/FileUploadView.tsx` | 파일 업로드 UI |
| `document-creation/hooks/useDocumentState.ts` | 문서 상태 관리 |
| `document-creation/hooks/useSharedData.ts` | 필드 데이터 공유 |
| `editor/ContractEditor.tsx` | Tiptap 에디터, 필드 노드 |
| `editor/EditorToolbar.tsx` | 에디터 상단 툴바 |
| `ChatAssistant.tsx` | 문서 작성 중 AI 채팅 |
| `VersionHistorySidebar.tsx` | 버전 히스토리 사이드바 |
| `templates/*.ts` | 각 문서 HTML 템플릿 |
| `utils/api.ts` | API 호출 유틸리티 |
| `styles/globals.css` | 전역 CSS, 문서 인쇄 스타일 |

### Backend

| 파일 | 역할 |
|------|------|
| `config/settings.py` | Django 설정 (DB, AWS, CORS) |
| `config/urls.py` | 루트 URL 라우팅 |
| `documents/models.py` | 핵심 모델 (User, Trade, Document) |
| `documents/views.py` | 문서 CRUD, 업로드 API |
| `documents/urls.py` | 문서 앱 URL |
| `chat/models.py` | 일반 채팅 모델 |
| `chat/views.py` | 일반 채팅 API |
| `chat/trade_views.py` | 문서 채팅 API (스트리밍) |
| `chat/memory_service.py` | Mem0 메모리 관리 |
| `chat/urls.py` | 채팅 앱 URL |
| `agent_core/agents.py` | AI Agent 팩토리 |
| `agent_core/config.py` | Qdrant/OpenAI 클라이언트 설정 |
| `agent_core/tools/search_tool.py` | RAG 검색 (무역 지식 + 업로드 문서) |
| `agent_core/tools/web_search_tool.py` | Tavily 웹 검색 |

---

*문서 최종 업데이트: 2025-12-05*
