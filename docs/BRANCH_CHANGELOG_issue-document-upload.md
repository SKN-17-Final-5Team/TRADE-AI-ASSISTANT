# Branch Changelog: issue/document-upload

> **이 문서는 AI 에이전트가 읽고 Merge 작업을 수행할 수 있도록 작성되었습니다.**
> **이 문서만 읽으면 브랜치의 모든 변경사항을 파악하고 충돌 없이 merge할 수 있어야 합니다.**

---

## 메타데이터

```yaml
문서_작성일: 2024-12-05
브랜치명: issue/document-upload
Base_브랜치: main
Merge_대상_브랜치: feature/text-editor-v2
총_커밋_수: 59개
총_변경_파일_수: 184개
추가된_코드: +35,697줄
```

---

## 핵심 규칙 (CRITICAL)

```
규칙 1: 에디터 관련 파일 충돌 시
        → feature/text-editor-v2 코드를 채택하세요.
        → 에디터 관련 파일: ContractEditor.tsx, EditorToolbar.tsx, editor.css,
          doc_templates/*.html, templates/*.ts

규칙 2: 채팅 관련 파일 충돌 시
        → issue/document-upload 코드를 채택하세요.
        → 채팅 관련 파일: ChatAssistant.tsx, ChatPage.tsx

규칙 3: 백엔드 파일 충돌 시
        → issue/document-upload 코드를 채택하세요.
        → feature/text-editor-v2는 백엔드 작업을 하지 않음

규칙 4: TOOL_DISPLAY_INFO는 3개 파일이 반드시 동일해야 함
        → backend/documents/views.py
        → backend/chat/views.py
        → backend/chat/trade_views.py
```

---

# PART 1: 오늘 세션 변경사항 (2024-12-05)

## 1.1 변경 파일 목록

| 파일 | 변경 라인 | 목적 |
|------|----------|------|
| `frontend/components/ChatAssistant.tsx` | 2, 21-22, 660, 744-747 | 로딩 UI 버그 수정 |
| `frontend/components/ChatPage.tsx` | 301, 354-357 | 로딩 UI 버그 수정 |
| `backend/documents/views.py` | 444-460 | Tool 표시명 변경 |
| `backend/chat/views.py` | 61-77 | Tool 표시명 변경 |
| `backend/chat/trade_views.py` | 51-67 | Tool 표시명 변경 |

## 1.2 ChatAssistant.tsx 변경 상세

### 변경 1: FileSearch 아이콘 import (Line 2)

```diff
- import { Sparkles, Send, X, Wand2, Eye, Undo2, Check, XCircle, Globe, Database, Wrench } from 'lucide-react';
+ import { Sparkles, Send, X, Wand2, Eye, Undo2, Check, XCircle, Globe, Database, Wrench, FileSearch } from 'lucide-react';
```

### 변경 2: getToolIcon에 file-search 케이스 추가 (Line 21-22)

```diff
  const getToolIcon = (iconName: string) => {
    switch (iconName) {
      case 'web':
        return Globe;
      case 'document':
        return Database;
+     case 'file-search':
+       return FileSearch;
      default:
        return Wrench;
    }
  };
```

### 변경 3: 빈 AI 메시지 필터링 (Line 660)

**목적**: 스트리밍 시작 전 빈 AI 메시지 박스가 렌더링되는 버그 수정

```diff
- {messages.map((message) => (
+ {messages.filter(msg => !(msg.type === 'ai' && !msg.content)).map((message) => (
```

### 변경 4: 로딩 인디케이터 조건 수정 (Line 744-747)

**목적**: 빈 AI 메시지 추가 후에도 "답변 생성중..." 로딩이 계속 표시되도록 수정

```diff
- {isLoading && messages.length > 0 && messages[messages.length - 1].type === 'user' && (
+ {isLoading && messages.length > 0 && (
+   messages[messages.length - 1].type === 'user' ||
+   (messages[messages.length - 1].type === 'ai' && !messages[messages.length - 1].content)
+ ) && (
```

## 1.3 ChatPage.tsx 변경 상세

### 변경 1: 빈 AI 메시지 필터링 (Line 301)

```diff
- {messages.map((message) => (
+ {messages.filter(msg => !(msg.type === 'ai' && !msg.content)).map((message) => (
```

### 변경 2: 로딩 인디케이터 조건 수정 (Line 354-357)

```diff
- {isLoading && messages.length > 0 && messages[messages.length - 1].type === 'user' && (
+ {isLoading && messages.length > 0 && (
+   messages[messages.length - 1].type === 'user' ||
+   (messages[messages.length - 1].type === 'ai' && !messages[messages.length - 1].content)
+ ) && (
```

## 1.4 백엔드 TOOL_DISPLAY_INFO 변경 (3개 파일 동일)

**변경된 파일:**
- `backend/documents/views.py` (Line 444-460)
- `backend/chat/views.py` (Line 61-77)
- `backend/chat/trade_views.py` (Line 51-67)

**변경 전:**
```python
TOOL_DISPLAY_INFO = {
    'search_trade_documents': {
        'name': '문서 검색',
        'icon': 'document',
        ...
    },
    'search_web': {...}
}
```

**변경 후:**
```python
TOOL_DISPLAY_INFO = {
    'search_user_document': {
        'name': '업로드 문서 검색',
        'icon': 'file-search',
        'description': '업로드한 문서에서 관련 내용을 검색했습니다.'
    },
    'search_trade_documents': {
        'name': '무역 지식 검색',
        'icon': 'document',
        'description': '무역 문서 데이터베이스에서 관련 정보를 검색했습니다.'
    },
    'search_web': {
        'name': '웹 검색',
        'icon': 'web',
        'description': '최신 정보를 위해 웹 검색을 수행했습니다.'
    }
}
```

---

# PART 2: 프론트엔드 채팅 변경 히스토리 (22개 커밋)

> **중요**: 이 파일들은 feature/text-editor-v2에서 작업하지 않음. 충돌 시 issue/document-upload 코드 채택.

## ChatAssistant.tsx 변경 히스토리 (14개 커밋)

| 커밋 | 작업 내용 | 변경 사항 |
|------|----------|----------|
| `1359d1e` | 답변 생성중 위에 빈 박스 제거 | messages.filter 추가 |
| `757bac0` | 업로드 문서 검색 명시화 | FileSearch 아이콘, 로딩 조건 수정 |
| `626d1c8` | 모델메모리 문서 매핑 오류 해결 | 메모리 관련 로직 수정 |
| `86daf7a` | 작성/업로드 모드별 에이전트 라우팅 | API 호출 분기 처리 |
| `d3d3695` | 모델메모리 병합 | Mem0 메모리 기능 통합 |
| `21cfc17` | RDS 연동 및 문서 업로드 오류 해결 | API 엔드포인트 수정 |
| `d5a4278` | 챗봇 UI 수정 | 스타일 및 레이아웃 개선 |
| `a0c5aa4` | 에이전트 문서 부분 수정 가능하게 | 에이전트 응답 처리 로직 |
| `5b17224` | 프롬프트 langfuse 관리 | Langfuse 연동 |
| `20202bb` | 업로드 후 에이전트 질의응답 구현 | 문서 업로드 채팅 기능 전체 |
| `2ab6474` | 응답 형식 스트리밍 처리 | 스트리밍 응답 파싱 로직 |
| `1641eb9` | 에이전트 사용 툴 표기 | toolsUsed UI 표시 기능 |
| `dd0be7e` | 프로젝트 구조 분리 및 AI 에이전트 통합 | 초기 컴포넌트 생성 |

## ChatPage.tsx 변경 히스토리 (8개 커밋)

| 커밋 | 작업 내용 | 변경 사항 |
|------|----------|----------|
| `1359d1e` | 답변 생성중 위에 빈 박스 제거 | messages.filter 추가 |
| `757bac0` | 답변 생성중 메세지 표시 | 로딩 조건 수정 |
| `0eb2a82` | 모델메모리 병합 | 일반 채팅 메모리 기능 |
| `d3d3695` | 모델메모리 병합 | Mem0 통합 |
| `5d78179` | 저장/다운로드/버전 기록 기능 | 다양한 기능 추가 |
| `158a1d6` | header 사원번호 삭제 | UI 정리 |
| `2ab6474` | 응답 형식 스트리밍 처리 | 스트리밍 로직 |
| `dd0be7e` | 프로젝트 구조 분리 | 초기 컴포넌트 생성 |

---

# PART 3: 프론트엔드 에디터 변경 히스토리 (11개 커밋)

> **중요**: feature/text-editor-v2가 최신입니다. 충돌 시 feature/text-editor-v2 코드를 채택하세요.
> 아래 내용은 참고용으로만 제공됩니다.

## ContractEditor.tsx 변경 히스토리 (10개 커밋)

| 커밋 | 작업 내용 | 비고 |
|------|----------|------|
| `dd6f4d2` | 표 행/열 추가 및 삭제, 폰트/사이즈 기능 | **feature/text-editor-v2에서 최신 작업** |
| `a0c5aa4` | 에이전트 문서 부분 수정 가능하게 | 필드 편집 기능 |
| `ad332b6` | 매핑 하이라이트 1차 수정 | 버그 있음 |
| `ff4b5da` | 필드 매핑 오류 해결 | 매핑 로직 |
| `e15d8a4` | 코드 정리 및 개선 | 리팩토링 |
| `01512a2` | PDF 수정 | PDF 관련 |
| `fc5918a` | 버전 히스토리 사이드바 | 사이드바 연동 |
| `67e2a32` | 에디터 정렬 문제 해결 | 레이아웃 |
| `a4a6710` | 에디터 반응형 레이아웃 | 반응형 |
| `dd0be7e` | 초기 에디터 생성 | 프로젝트 초기 |

## EditorToolbar.tsx 변경 히스토리 (2개 커밋)

| 커밋 | 작업 내용 | 비고 |
|------|----------|------|
| `dd6f4d2` | 폰트/사이즈 기능 추가 | **feature/text-editor-v2에서 최신 작업** |
| `dd0be7e` | 초기 툴바 생성 | 프로젝트 초기 |

## editor.css 변경 히스토리 (3개 커밋)

| 커밋 | 작업 내용 | 비고 |
|------|----------|------|
| `ad332b6` | 하이라이트 스타일 | CSS |
| `67e2a32` | 정렬 스타일 | CSS |
| `a4a6710` | 반응형 스타일 | CSS |

## 템플릿 파일 변경

**doc_templates/*.html** (6개 파일):
- `dd0be7e`에서 초기 생성
- Commercial_Invoice.html, Offer_Sheet.html, PI.html, PL.html, PO.html, Sales_Contract.html

**templates/*.ts** (5개 파일):
- `dd0be7e`에서 초기 생성, `5d78179`에서 packingList.ts 수정
- commercialInvoice.ts, offerSheet.ts, packingList.ts, proformaInvoice.ts, saleContract.ts

---

# PART 4: 백엔드 변경 히스토리

> **중요**: feature/text-editor-v2는 백엔드 작업을 하지 않습니다. 충돌 시 issue/document-upload 코드를 채택하세요.

## 4.1 agent_core/ - AI 에이전트 시스템

**디렉토리 구조:**
```
backend/agent_core/
├── __init__.py          # 에이전트 초기화
├── agents.py            # 에이전트 정의 (Document Reader, Trade Assistant 등)
├── collection_manager.py # ChromaDB 컬렉션 관리
├── config.py            # OpenAI, ChromaDB 설정
├── langfuse_config.py   # Langfuse 프롬프트 버전 관리
├── pdf_parser.py        # PDF 파싱 (PyMuPDF)
├── s3_utils.py          # AWS S3 파일 업로드/다운로드
├── utils.py             # 유틸리티 함수
├── models/
│   ├── query_transformer.py  # 쿼리 변환 모델
│   └── reranker.py           # 검색 결과 재순위화
├── prompts/
│   ├── fallback.py           # 폴백 프롬프트 (Langfuse 실패 시)
│   └── trade_instructions.txt # 무역 에이전트 지시사항
├── services/
│   ├── query_transformer_service.py
│   └── reranker_service.py
└── tools/
    ├── search_tool.py        # 문서 검색 도구 (search_user_document, search_trade_documents)
    └── web_search_tool.py    # 웹 검색 도구 (Tavily API)
```

**주요 커밋:**
| 커밋 | 작업 내용 |
|------|----------|
| `dd0be7e` | 초기 에이전트 시스템 구축 |
| `5b17224` | Langfuse 프롬프트 버전 관리 연동 |
| `d5557a7` | Langfuse 설정 업데이트 |
| `20202bb` | 문서 업로드 에이전트 질의응답 구현 |
| `b79a418` | 프롬프트 고도화 |
| `a0c5aa4` | 문서 부분 수정 기능 프롬프트 |
| `d5a4278` | 폴백 프롬프트 수정 |

## 4.2 chat/ - 채팅 API

**디렉토리 구조:**
```
backend/chat/
├── __init__.py
├── admin.py
├── apps.py
├── config.py            # 채팅 설정
├── memory_service.py    # Mem0 메모리 서비스 (사용자별 대화 기억)
├── models.py            # GenChat, GenChatHistory, ModelMemory 모델
├── serializers.py       # DRF 시리얼라이저
├── trade_views.py       # 문서 작성 채팅 API (스트리밍)
├── urls.py              # URL 라우팅
├── views.py             # 일반 채팅 API (스트리밍)
└── migrations/
```

**주요 커밋:**
| 커밋 | 작업 내용 |
|------|----------|
| `757bac0` | TOOL_DISPLAY_INFO 수정 (오늘) |
| `626d1c8` | 모델메모리 문서 매핑 오류 해결 |
| `86daf7a` | 작성/업로드 모드별 에이전트 라우팅 |
| `d3d3695` | Mem0 메모리 서비스 통합 |
| `a0c5aa4` | 에이전트 문서 부분 수정 기능 |
| `2ab6474` | 스트리밍 응답 처리 |
| `dd0be7e` | 초기 채팅 API 구축 |

## 4.3 documents/ - 문서 관리 API

**디렉토리 구조:**
```
backend/documents/
├── __init__.py
├── admin.py             # Django Admin 설정
├── apps.py
├── models.py            # User, Document, DocumentVersion, DocMessage 모델
├── serializers.py       # DRF 시리얼라이저
├── services.py          # 문서 처리 서비스
├── urls.py              # URL 라우팅
├── views.py             # 문서 CRUD + 채팅 API
└── migrations/
```

**주요 커밋:**
| 커밋 | 작업 내용 |
|------|----------|
| `757bac0` | TOOL_DISPLAY_INFO 수정 (오늘) |
| `d3d3695` | 문서 채팅 기능 확장 |
| `20202bb` | 문서 업로드 후 채팅 기능 구현 |
| `dcb65fc` | 백엔드 연동 attempt 1 |
| `c9beaeb` | 업로드 URL 문제 해결 |
| `21cfc17` | RDS 연동 |

## 4.4 config/ - Django 설정

**주요 파일:**
- `settings.py`: Django 설정 (DB, CORS, S3, 등)
- `urls.py`: 전체 URL 라우팅

**주요 커밋:**
| 커밋 | 작업 내용 |
|------|----------|
| `21cfc17` | RDS (PostgreSQL) 연동 설정 |
| `0edb540` | 설정 수정 |
| `dd0be7e` | 초기 Django 프로젝트 설정 |

---

# PART 5: 주요 기능별 요약

## 5.1 문서 업로드 기능
- 사용자가 PDF 문서 업로드
- S3에 저장, PDF 파싱 후 ChromaDB에 벡터 저장
- AI 에이전트가 문서 내용 기반 질의응답

**관련 파일:**
- `backend/agent_core/pdf_parser.py`
- `backend/agent_core/s3_utils.py`
- `backend/agent_core/tools/search_tool.py`
- `backend/documents/views.py`
- `frontend/components/ChatAssistant.tsx`

## 5.2 AI 에이전트 시스템
- OpenAI Agents SDK 기반
- 3가지 도구: search_user_document, search_trade_documents, search_web
- Langfuse로 프롬프트 버전 관리

**관련 파일:**
- `backend/agent_core/agents.py`
- `backend/agent_core/langfuse_config.py`
- `backend/agent_core/tools/*.py`

## 5.3 Mem0 메모리 서비스
- 사용자별 대화 기억 (장기 메모리)
- 이전 대화 컨텍스트 유지

**관련 파일:**
- `backend/chat/memory_service.py`
- `backend/chat/models.py` (ModelMemory)

## 5.4 스트리밍 응답
- Server-Sent Events (SSE) 기반 실시간 응답
- 프론트엔드에서 청크 단위 렌더링

**관련 파일:**
- `backend/chat/views.py`
- `backend/chat/trade_views.py`
- `frontend/components/ChatAssistant.tsx`
- `frontend/components/ChatPage.tsx`

## 5.5 버전 히스토리
- 문서 버전 관리
- 사이드바에서 히스토리 조회

**관련 파일:**
- `frontend/components/VersionHistorySidebar.tsx`
- `backend/documents/models.py` (DocumentVersion)

---

# PART 6: 충돌 위험도 분석

## 6.1 충돌 없음 (확실)

| 파일/디렉토리 | 이유 |
|--------------|------|
| `backend/` 전체 | feature/text-editor-v2는 백엔드 작업 안 함 |
| `frontend/components/ChatAssistant.tsx` | 채팅 전용 컴포넌트 |
| `frontend/components/ChatPage.tsx` | 채팅 전용 컴포넌트 |
| `frontend/components/VersionHistorySidebar.tsx` | 버전 히스토리 전용 |
| `frontend/utils/*.ts` | API 유틸리티 |

## 6.2 충돌 가능성 높음 (feature/text-editor-v2 우선)

| 파일 | 충돌 시 처리 |
|------|-------------|
| `frontend/components/editor/ContractEditor.tsx` | **feature/text-editor-v2 채택** |
| `frontend/components/editor/EditorToolbar.tsx` | **feature/text-editor-v2 채택** |
| `frontend/components/editor/editor.css` | **feature/text-editor-v2 채택** |
| `frontend/doc_templates/*.html` | **feature/text-editor-v2 채택** |
| `frontend/templates/*.ts` | **feature/text-editor-v2 채택** |

---

# PART 7: Merge 가이드

## 7.1 권장 Merge 순서

```bash
# 1. 최신 main 가져오기
git checkout main
git pull origin main

# 2. issue/document-upload를 main에 머지
git merge issue/document-upload
# 충돌 없을 것으로 예상 (main에 큰 변경 없다면)

# 3. main을 feature/text-editor-v2에 머지
git checkout feature/text-editor-v2
git pull origin feature/text-editor-v2
git merge main

# 4. 충돌 해결
# - 에디터 관련 파일: feature/text-editor-v2 코드 유지
# - 채팅 관련 파일: main (=issue/document-upload) 코드 유지
# - 백엔드 파일: main 코드 유지

# 5. feature/text-editor-v2를 main에 머지
git checkout main
git merge feature/text-editor-v2
```

## 7.2 충돌 해결 명령어

```bash
# 에디터 파일 충돌 시 - feature/text-editor-v2 버전 사용
git checkout --theirs frontend/components/editor/ContractEditor.tsx
git checkout --theirs frontend/components/editor/EditorToolbar.tsx
git checkout --theirs frontend/components/editor/editor.css

# 채팅 파일 충돌 시 - main (issue/document-upload) 버전 사용
git checkout --ours frontend/components/ChatAssistant.tsx
git checkout --ours frontend/components/ChatPage.tsx
```

## 7.3 Merge 후 검증

```bash
# 프론트엔드 빌드
cd frontend && npm run build

# 백엔드 검증
cd backend && python manage.py check

# TOOL_DISPLAY_INFO 동기화 확인
grep -A 15 "TOOL_DISPLAY_INFO" backend/documents/views.py
grep -A 15 "TOOL_DISPLAY_INFO" backend/chat/views.py
grep -A 15 "TOOL_DISPLAY_INFO" backend/chat/trade_views.py
```

## 7.4 필수 보존 코드 체크리스트

### ChatAssistant.tsx
- [ ] Line 2: `FileSearch` import 포함
- [ ] Line 21-22: `case 'file-search': return FileSearch;` 포함
- [ ] Line 660: `messages.filter(msg => !(msg.type === 'ai' && !msg.content))` 포함
- [ ] Line 744-747: 로딩 조건에 `|| (msg.type === 'ai' && !msg.content)` 포함

### ChatPage.tsx
- [ ] Line 301: `messages.filter(...)` 포함
- [ ] Line 354-357: 로딩 조건 수정 포함

### 백엔드 TOOL_DISPLAY_INFO (3개 파일)
- [ ] `search_user_document` 항목 존재
- [ ] `icon: 'file-search'` 설정
- [ ] 3개 파일 내용 동일

---

# PART 8: 전체 커밋 목록 (59개)

```
1359d1e 답변 생성중 위에 빈 박스 제거 (UI 개선)
757bac0 업로드 문서 검색 명시화 및 답변 생성중 메세지 표시
6b37a53 Merge remote-tracking branch 'origin/temp/memory-merge_v5.0' into issue/document-upload
dc4ca4a 프로젝트 구조 설명 업데이트
626d1c8 모델메모리 문서 매핑 오류 해결
ac65131 작성/업로드 모드 에이전트 라우팅 오류 수정
86daf7a 문서 작성/업로드 모드별로 다른 에이전트 호출되게 수정
c9beaeb 업로드 문제 해결
0eb2a82 모델메모리 병합
d3d3695 모델메모리 병합
21cfc17 RDS 연동 및 문서 업로드 오류 해결
6934c24 문서 업로드 API URL 및 필드명 수정
dcb65fc 백엔드 연동 attempt 1
c667011 에디터 오류 수정
dd6f4d2 텍스트 에디터에 표 행/열 추가 및 삭제 기능 추가, 글자 폰트 및 사이즈 기능 추가
5d78179 저장 버튼, 다운로드 버튼, 공통 필드 및 AI 답변 버튼, 버전 기록 기능, 파일 업로드 및 건너뛰기 시 오류 수정
4a1f247 다운로드 기능 수정
6515923 문서 작성 숨김 버튼 기능 수정 최종
8d67d69 문서 작성 숨김 버튼 기능 추가 v2
ceb70f3 문서 작성 숨김 버튼 기능 추가 v1
23b92ab DocumentCreationPage.tsx 리팩토링
f4891da 메인페이지 UI 수정
158a1d6 header 사원번호 삭제
d5a4278 챗봇 ui 수정
a0c5aa4 에이전트 문서 부분 수정 가능하게 업데이트
ad332b6 매핑 하이라이트 1차 수정: 버그 남음
ff4b5da 필드 매핑 오류 해결
e2e7daf 불필요 .md 제거
e15d8a4 chore: 코드 정리 및 개선
c672f95 Merge feature/version_control_v1: 버전 히스토리 UI 통합
d5557a7 lanfuse 프롬프트 관리 업데이트
5b17224 프롬프트 langfuse로 관리되게 수정 + 에이전트 3개 코드 리팩토링
0edb540 -
d533db3 에디터 확장 기능 추가
19048e1 Merge feature/trade-ai-assistant-prompt: Langfuse 프롬프트 버전 관리 기능 통합
b79a418 프롬프트 고도화
20202bb 업로드 후 에이전트롸 질의응답 기능 구현
01512a2 pdf 수정
1789181 프롬프트 고도화
f61205d 완료 체크 2차 수정
4fe833f 완료 체크 1차 수정
3f15e0f Packing List 편집 화면 로드 수정
a3b0308 프롬프트 수정
f2068ab 로직 오류 수정(저장, 다운로드, 버전정보)
ead62ed 필터링 기본값 수정
994addc 프롬프트 오전 수정
fc5918a 버전 히스토리 사이드바 기능 추가
5743540 개발 서버 재시작 README 수정
3a7a6fe fix: Resolve Rollup native module dependency issue
f650cf0 프롬프트 수정
deb11c8 PDF 다운로드 기능 및 문서 작성 이모지 추가
2ab6474 응답 형식 스트리밍 처리
1641eb9 문서 작성 챗봇 에이전트 사용 툴 표기하게 수정
67e2a32 사이드바 챗봇 초기 효과 적용 및 에디터 정렬 문제 해결
a4a6710 fix: Make editor layout responsive across different screen sizes
5b58a53 feat: Apply teammate's simplified chatbot intro animation
a55fad5 실행 가능한 내용 포함하게 README 수정
2f3bb84 docs: Update README with frontend/backend setup instructions
dd0be7e feat: Restructure project with frontend/backend separation and integrate AI agent
```

---

# PART 9: 변경된 전체 파일 목록 (184개)

<details>
<summary>백엔드 파일 (54개)</summary>

```
backend/agent_core/__init__.py
backend/agent_core/agents.py
backend/agent_core/collection_manager.py
backend/agent_core/config.py
backend/agent_core/langfuse_config.py
backend/agent_core/models/__init__.py
backend/agent_core/models/query_transformer.py
backend/agent_core/models/reranker.py
backend/agent_core/pdf_parser.py
backend/agent_core/prompts/fallback.py
backend/agent_core/prompts/trade_instructions.txt
backend/agent_core/s3_utils.py
backend/agent_core/services/__init__.py
backend/agent_core/services/query_transformer_service.py
backend/agent_core/services/reranker_service.py
backend/agent_core/tools/__init__.py
backend/agent_core/tools/search_tool.py
backend/agent_core/tools/web_search_tool.py
backend/agent_core/utils.py
backend/chat/__init__.py
backend/chat/admin.py
backend/chat/apps.py
backend/chat/config.py
backend/chat/memory_service.py
backend/chat/migrations/0001_initial.py
backend/chat/migrations/__init__.py
backend/chat/models.py
backend/chat/serializers.py
backend/chat/tests.py
backend/chat/trade_views.py
backend/chat/urls.py
backend/chat/views.py
backend/config/__init__.py
backend/config/asgi.py
backend/config/settings.py
backend/config/urls.py
backend/config/wsgi.py
backend/documents/__init__.py
backend/documents/admin.py
backend/documents/apps.py
backend/documents/migrations/0001_initial.py
backend/documents/migrations/0002_remove_user_username.py
backend/documents/migrations/__init__.py
backend/documents/models.py
backend/documents/serializers.py
backend/documents/services.py
backend/documents/tests.py
backend/documents/urls.py
backend/documents/views.py
backend/manage.py
backend/memory_readme.md
backend/requirements.txt
backend/scripts/setup_s3_cors.py
backend/test_prompt_version.py
```

</details>

<details>
<summary>프론트엔드 파일 (118개)</summary>

```
frontend/App.tsx
frontend/Attributions.md
frontend/background.mp4
frontend/components/ChatAssistant.tsx
frontend/components/ChatPage.tsx
frontend/components/CommercialInvoiceTemplate.tsx
frontend/components/DocumentCreationPage.tsx
frontend/components/LoginPage.tsx
frontend/components/MainPage.tsx
frontend/components/OthersDocumentViewer.tsx
frontend/components/PdfViewer.tsx
frontend/components/SalesContractTemplate.tsx
frontend/components/ShootingStarIntro.tsx
frontend/components/StepSelector.tsx
frontend/components/VersionHistorySidebar.tsx
frontend/components/document-creation/hooks/index.ts
frontend/components/document-creation/hooks/useDocumentState.ts
frontend/components/document-creation/hooks/useFileUpload.ts
frontend/components/document-creation/hooks/useSharedData.ts
frontend/components/document-creation/index.tsx
frontend/components/document-creation/layout/DocumentHeader.tsx
frontend/components/document-creation/layout/StepNavigation.tsx
frontend/components/document-creation/layout/index.ts
frontend/components/document-creation/modals/DownloadModal.tsx
frontend/components/document-creation/modals/ExitConfirmModal.tsx
frontend/components/document-creation/modals/LogoutConfirmModal.tsx
frontend/components/document-creation/modals/MyPageModal.tsx
frontend/components/document-creation/modals/PasswordChangeModal.tsx
frontend/components/document-creation/modals/SaveSuccessModal.tsx
frontend/components/document-creation/modals/index.ts
frontend/components/document-creation/steps/EditorView.tsx
frontend/components/document-creation/steps/EmptyState.tsx
frontend/components/document-creation/steps/FileUploadView.tsx
frontend/components/document-creation/steps/ModeSelector.tsx
frontend/components/document-creation/steps/ShippingDocsDashboard.tsx
frontend/components/document-creation/steps/SkipState.tsx
frontend/components/document-creation/steps/index.ts
frontend/components/document-creation/types.ts
frontend/components/editor/ContractEditor.tsx
frontend/components/editor/EditorToolbar.tsx
frontend/components/editor/editor.css
frontend/components/figma/ImageWithFallback.tsx
frontend/components/ui/accordion.tsx
frontend/components/ui/alert-dialog.tsx
frontend/components/ui/alert.tsx
frontend/components/ui/aspect-ratio.tsx
frontend/components/ui/avatar.tsx
frontend/components/ui/badge.tsx
frontend/components/ui/breadcrumb.tsx
frontend/components/ui/button.tsx
frontend/components/ui/calendar.tsx
frontend/components/ui/card.tsx
frontend/components/ui/carousel.tsx
frontend/components/ui/chart.tsx
frontend/components/ui/checkbox.tsx
frontend/components/ui/collapsible.tsx
frontend/components/ui/command.tsx
frontend/components/ui/context-menu.tsx
frontend/components/ui/dialog.tsx
frontend/components/ui/drawer.tsx
frontend/components/ui/dropdown-menu.tsx
frontend/components/ui/form.tsx
frontend/components/ui/hover-card.tsx
frontend/components/ui/input-otp.tsx
frontend/components/ui/input.tsx
frontend/components/ui/label.tsx
frontend/components/ui/menubar.tsx
frontend/components/ui/navigation-menu.tsx
frontend/components/ui/pagination.tsx
frontend/components/ui/popover.tsx
frontend/components/ui/progress.tsx
frontend/components/ui/radio-group.tsx
frontend/components/ui/resizable.tsx
frontend/components/ui/scroll-area.tsx
frontend/components/ui/select.tsx
frontend/components/ui/separator.tsx
frontend/components/ui/sheet.tsx
frontend/components/ui/sidebar.tsx
frontend/components/ui/skeleton.tsx
frontend/components/ui/slider.tsx
frontend/components/ui/sonner.tsx
frontend/components/ui/switch.tsx
frontend/components/ui/table.tsx
frontend/components/ui/tabs.tsx
frontend/components/ui/textarea.tsx
frontend/components/ui/toggle-group.tsx
frontend/components/ui/toggle.tsx
frontend/components/ui/tooltip.tsx
frontend/components/ui/use-mobile.ts
frontend/components/ui/utils.ts
frontend/doc_templates/Commercial_Invoice.html
frontend/doc_templates/Offer_Sheet.html
frontend/doc_templates/PI.html
frontend/doc_templates/PL.html
frontend/doc_templates/PO.html
frontend/doc_templates/Sales_Contract.html
frontend/guidelines/Guidelines.md
frontend/img/login_small.gif
frontend/index.html
frontend/package-lock.json
frontend/package.json
frontend/postcss.config.cjs
frontend/src/index.css
frontend/src/main.tsx
frontend/src/vite-env.d.ts
frontend/styles/globals.css
frontend/tailwind.config.cjs
frontend/templates/commercialInvoice.ts
frontend/templates/offerSheet.ts
frontend/templates/packingList.ts
frontend/templates/proformaInvoice.ts
frontend/templates/saleContract.ts
frontend/tsconfig.json
frontend/utils/api.ts
frontend/utils/documentApi.ts
frontend/utils/documentUtils.ts
frontend/vite.config.ts
```

</details>

<details>
<summary>루트 파일 (12개)</summary>

```
.claude/settings.local.json
.gitattributes
.gitignore
AGENT_EDIT_FIX_PLAN.md
FIELD_MAPPING_FIX_PLAN.md
LANGFUSE_GUIDE.md
MERGE_PLAN.md
PROJECT_STRUCTURE.md
README.md
docs/DATABASE_DESIGN.md
docs/bugfix-loading-indicator.md
package-lock.json
package.json
```

</details>

---

# 요약

이 브랜치(`issue/document-upload`)의 핵심 변경사항:

1. **문서 업로드 + AI 채팅 기능** 전체 구현
2. **AI 에이전트 시스템** (OpenAI Agents SDK + Langfuse)
3. **Mem0 메모리 서비스** (사용자별 대화 기억)
4. **스트리밍 응답** (SSE 기반)
5. **버전 히스토리** 기능
6. **로딩 인디케이터 버그 수정** (오늘)

Merge 시 핵심 규칙:
- **에디터 파일** → feature/text-editor-v2 우선
- **채팅/백엔드 파일** → issue/document-upload 우선
- **TOOL_DISPLAY_INFO** → 3개 파일 동기화 필수
