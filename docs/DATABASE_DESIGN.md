# TRADE-AI-ASSISTANT 데이터베이스 설계 문서

## 작성일: 2025-12-04
## 상태: 설계 완료

---

## 1. 현재 구조 (AS-IS)

### 테이블 목록
| 테이블명 | 설명 |
|----------|------|
| user_documents | 사용자 업로드 문서 메타데이터 |
| document_chat_sessions | 문서별 채팅 세션 |
| document_chat_messages | 채팅 메시지 |

### 현재 관계도
```
UserDocument (1) ──▶ (N) DocumentChatSession (1) ──▶ (N) DocumentChatMessage
```

### 현재 구조의 특징
- 사용자(User) 모델 미연동 (주석 처리됨)
- 문서 중심 설계
- 벡터 DB(Qdrant)와 분리 운영

---

## 2. 새로운 요구사항

### 2.1 다중 사용자 지원
- USER 테이블 추가 필요
- 모든 데이터는 사용자별로 분리되어야 함

### 2.2 거래 플로우 단위 관리
- 하나의 거래(Trade)에 여러 문서가 포함됨
- 문서 유형: Offer Sheet, PI, Contract, CI, PL

### 2.3 문서 버전 관리
- 저장 시마다 새 버전 생성
- 버전 복원 기능 지원

### 2.4 LLM 메모리 관리
- Mem0를 활용한 LLM 메모리 관리
- 채팅 기록은 화면 표시용으로만 DB 저장

---

## 3. 새로운 구조 (TO-BE)

### 3.1 DEPARTMENT (부서)

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| dept_id | BIGINT | PK, AUTO_INCREMENT | 부서 고유 ID |
| dept_name | VARCHAR | NOT NULL | 부서명 |

### 3.2 USER (사용자)

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| user_id | BIGINT | PK, AUTO_INCREMENT | 사용자 고유 ID |
| emp_no | VARCHAR | UNIQUE, NOT NULL | 사원번호 |
| name | VARCHAR | NOT NULL | 이름 |
| dept_id | BIGINT | FK → DEPARTMENT | 부서 ID |
| activation | BOOLEAN | DEFAULT TRUE | 활성 상태 |
| user_role | ENUM | 'user', 'admin' | 사용자 역할 |
| password | VARCHAR | NOT NULL | 비밀번호 (해시) |
| created_at | DATETIME | AUTO | 생성일시 |
| updated_at | DATETIME | AUTO | 수정일시 |

### 3.3 TRADE_FLOW (거래 플로우)

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| trade_id | BIGINT | PK, AUTO_INCREMENT | 거래 고유 ID |
| user_id | BIGINT | FK → USER | 생성한 사용자 |
| title | VARCHAR | NOT NULL | 거래 제목 |
| status | ENUM | 'in_progress', 'completed' | 진행 상태 |
| created_at | DATETIME | AUTO | 생성일시 |
| updated_at | DATETIME | AUTO | 수정일시 |

**비즈니스 규칙:**
- 생성 시 status = 'in_progress' (기본값)
- 모든 문서 완료 시 status = 'completed'
- 삭제 시 레코드 자체 삭제 (cancelled 상태 불필요)

### 3.4 DOCUMENT (문서)

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| doc_id | BIGINT | PK, AUTO_INCREMENT | 문서 고유 ID |
| trade_id | BIGINT | FK → TRADE_FLOW | 거래 플로우 ID |
| doc_type | ENUM | 'offer', 'pi', 'contract', 'ci', 'pl' | 문서 유형 |
| doc_mode | ENUM | 'manual', 'upload', 'skip' | 작성 모드 |
| s3_key | VARCHAR | NULL | S3 저장 경로 (upload일 때) |
| s3_url | VARCHAR | NULL | S3 URL (upload일 때) |
| original_filename | VARCHAR | NULL | 원본 파일명 (upload일 때) |
| file_size | BIGINT | NULL | 파일 크기 (bytes, upload일 때) |
| mime_type | VARCHAR(100) | NULL | MIME 타입 (upload일 때) |
| upload_status | ENUM | 'uploading', 'processing', 'ready', 'error' | 업로드 처리 상태 |
| error_message | TEXT | NULL | 에러 메시지 |
| qdrant_point_ids | JSON | DEFAULT [] | RAG용 벡터 ID 목록 |
| created_at | DATETIME | AUTO | 생성일시 |
| updated_at | DATETIME | AUTO | 수정일시 |

**비즈니스 규칙:**
- `doc_mode = 'manual'`: DOC_VERSION에 content 저장
- `doc_mode = 'upload'`: s3 관련 필드 + file_size, mime_type 사용
- `doc_mode = 'skip'`: 아무것도 저장 안함
- `upload_status`: upload 모드일 때 처리 상태 추적 (SSE로 프론트에 전달)
- `qdrant_point_ids`: AI 채팅에서 문서 검색용
- 기존 user_documents 테이블 역할을 완전히 흡수

### 3.5 DOC_VERSION (문서 버전)

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| version_id | BIGINT | PK, AUTO_INCREMENT | 버전 고유 ID |
| doc_id | BIGINT | FK → DOCUMENT | 문서 ID |
| content | JSON | NOT NULL | 문서 내용 |
| created_at | DATETIME | AUTO | 버전 생성일시 |

**비즈니스 규칙:**
- 저장할 때마다 새 버전 생성
- 버전 1개 이상 = 작성됨, 0개 = 미작성
- 최신 버전 = created_at 기준 최신

### 3.6 DOC_MESSAGE (문서 채팅 메시지)

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| doc_message_id | BIGINT | PK, AUTO_INCREMENT | 메시지 고유 ID |
| doc_id | BIGINT | FK → DOCUMENT | 문서 ID |
| role | ENUM | 'user', 'agent' | 발신자 역할 |
| content | TEXT | NOT NULL | 메시지 내용 |
| metadata | JSON | DEFAULT {} | 도구 사용 결과, 검색 결과 등 |
| created_at | DATETIME | AUTO | 생성일시 |

**비즈니스 규칙:**
- 화면에 채팅 기록 표시용
- LLM 메모리 관리는 Mem0가 user_id + doc_id로 처리
- 세션(session) 개념 없이 문서 단위로 채팅

---

### 3.7 ERD (Entity Relationship Diagram)

```
┌────────────┐       ┌────────────┐       ┌────────────┐
│ DEPARTMENT │◀──────│    USER    │──────▶│ TRADE_FLOW │
└────────────┘  (N:1)└────────────┘ (1:N) └────────────┘
                                                │
                                                │ (1:N)
                                                ▼
                                          ┌────────────┐
                                          │  DOCUMENT  │
                                          └────────────┘
                                            │        │
                                     (1:N)  │        │  (1:N)
                                            ▼        ▼
                                    ┌─────────┐  ┌─────────────┐
                                    │DOC_     │  │DOC_         │
                                    │VERSION  │  │MESSAGE      │
                                    └─────────┘  └─────────────┘
```

**테이블 요약:**
| 테이블 | 설명 | 주요 FK |
|--------|------|---------|
| DEPARTMENT | 부서 정보 | - |
| USER | 사용자 정보 | dept_id → DEPARTMENT |
| TRADE_FLOW | 거래 플로우 | user_id → USER |
| DOCUMENT | 문서 정보 | trade_id → TRADE_FLOW |
| DOC_VERSION | 문서 버전 | doc_id → DOCUMENT |
| DOC_MESSAGE | 채팅 메시지 | doc_id → DOCUMENT |

---

## 4. 프론트엔드 수정 사항

### 4.1 USER 연동

**현재 (AS-IS):**
- `localStorage`에 `isAuthenticated`, `userEmail` 저장
- 파일: `frontend/App.tsx`

**변경 (TO-BE):**
- 백엔드 인증 API 연동
- `user_id` 상태 관리 추가
- 로그인 시 `emp_no`, `password`로 인증 → `user_id` 반환받아 저장

**수정 파일:**
- `frontend/App.tsx` - 인증 상태 관리
- `frontend/components/Login.tsx` - 로그인 API 호출

---

### 4.2 TRADE_FLOW 연동

**현재 (AS-IS):**
- `savedDocuments` 배열로 로컬 메모리 관리
- `SavedDocument` 인터페이스 사용
- 파일: `frontend/App.tsx`

**변경 (TO-BE):**
- TRADE_FLOW CRUD API 연동
- `trade_id` 관리
- 메인 페이지에서 거래 목록 API로 조회

**수정 파일:**
- `frontend/App.tsx` - `savedDocuments` → API 연동
- `frontend/components/MainPage.tsx` - 거래 목록 API 조회

**매핑:**
| 프론트 (현재) | DB (새로운) |
|--------------|-------------|
| savedDocuments[].id | trade_id |
| savedDocuments[].name | title |
| savedDocuments[].status | status |

---

### 4.3 DOCUMENT 연동

**현재 (AS-IS):**
- `documentData` 객체로 step 1-5 관리
- `stepModes` (manual/upload/skip) 로컬 관리
- 파일: `frontend/components/document-creation/hooks/useDocumentState.ts`

**변경 (TO-BE):**
- DOCUMENT CRUD API 연동
- `doc_id`, `doc_type`, `doc_mode` 관리
- step → doc_type 매핑

**Step ↔ doc_type 매핑:**
| Step | doc_type |
|------|----------|
| 1 | offer |
| 2 | pi |
| 3 | contract |
| 4 | ci |
| 5 | pl |

**수정 파일:**
- `frontend/components/document-creation/index.tsx` - API 연동
- `frontend/components/document-creation/hooks/useDocumentState.ts` - stepModes → doc_mode API 저장
- `frontend/components/document-creation/hooks/useFileUpload.ts` - 업로드 완료 시 DOCUMENT 테이블 업데이트

---

### 4.4 DOC_VERSION 연동

**현재 (AS-IS):**
- `SavedDocument.versions[]` 배열로 로컬 관리
- 저장 시 프론트에서 버전 객체 생성
- 파일: `frontend/App.tsx`, `frontend/components/VersionHistorySidebar.tsx`

**변경 (TO-BE):**
- DOC_VERSION API 연동
- 저장 시 백엔드에서 버전 생성
- `version_id` 관리

**수정 파일:**
- `frontend/App.tsx` - `handleSaveDocument()` → API 호출로 변경
- `frontend/components/VersionHistorySidebar.tsx` - 버전 목록 API 조회
- `frontend/components/document-creation/index.tsx` - 버전 복원 API 연동

**Version 인터페이스 변경:**
```typescript
// AS-IS
interface Version {
  id: string;
  timestamp: number;
  data: DocumentData;
  step: number;
}

// TO-BE
interface Version {
  version_id: number;
  doc_id: number;
  content: object;  // JSON
  created_at: string;
}
```

---

### 4.5 DOC_MESSAGE 연동

**현재 (AS-IS):**
- `document_chat_sessions`, `document_chat_messages` API 사용
- session 기반 채팅
- 파일: `frontend/utils/documentApi.ts`

**변경 (TO-BE):**
- DOC_MESSAGE API로 변경
- session 개념 제거, `doc_id` 기반 채팅
- Mem0가 `user_id` + `doc_id`로 LLM 메모리 관리

**수정 파일:**
- `frontend/utils/documentApi.ts` - API 엔드포인트 변경
- 채팅 컴포넌트 - session_id 제거, doc_id 사용

**API 변경:**
| AS-IS | TO-BE |
|-------|-------|
| POST /api/documents/{id}/chat/sessions/ | 제거 |
| GET /api/documents/{id}/chat/sessions/ | 제거 |
| POST /api/documents/sessions/{id}/messages/ | POST /api/documents/{doc_id}/messages/ |
| GET /api/documents/sessions/{id}/messages/ | GET /api/documents/{doc_id}/messages/ |

---

### 4.6 기존 user_documents 제거

**현재 (AS-IS):**
- `user_documents` 테이블 및 API 사용
- 파일 업로드 정보 별도 관리

**변경 (TO-BE):**
- DOCUMENT 테이블로 흡수됨
- 업로드 관련 필드: `s3_key`, `s3_url`, `original_filename`, `file_size`, `mime_type`, `upload_status`, `error_message`, `qdrant_point_ids`

**수정 파일:**
- `frontend/utils/documentApi.ts` - API 엔드포인트 변경
- `frontend/components/document-creation/hooks/useFileUpload.ts` - 응답 구조 변경

**API 변경:**
| AS-IS | TO-BE |
|-------|-------|
| POST /api/documents/upload/request/ | POST /api/documents/{doc_id}/upload/request/ |
| POST /api/documents/upload/complete/ | POST /api/documents/{doc_id}/upload/complete/ |
| GET /api/documents/{id}/status/stream/ | GET /api/documents/{doc_id}/status/stream/ |

---

## 5. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-04 | 문서 생성, 현재 구조 분석 완료 |
| 2025-12-04 | USER, DEPARTMENT, TRADE_FLOW, DOCUMENT, DOC_VERSION, DOC_MESSAGE 테이블 설계 |
| 2025-12-04 | 프론트엔드 수정 사항 정리 |
| 2025-12-04 | 문서 검토 및 최종 정리 완료 |
