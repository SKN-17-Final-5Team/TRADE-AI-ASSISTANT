# Branch Changelog: issue/memory-v2

> **AI Agent 참조용 문서**
> 이 문서는 `issue/memory-v2` 브랜치에서 수행된 모든 작업을 상세히 기록합니다.
> 다른 브랜치와 병합 시 이 문서를 참조하여 충돌을 방지하고 누락 없이 통합할 수 있습니다.

---

## 목차

1. [브랜치 개요](#1-브랜치-개요)
2. [커밋 히스토리 요약](#2-커밋-히스토리-요약)
3. [파일별 변경 상세](#3-파일별-변경-상세)
4. [주요 기능 변경](#4-주요-기능-변경)
5. [API 엔드포인트 변경](#5-api-엔드포인트-변경)
6. [병합 가이드](#6-병합-가이드)

---

## 1. 브랜치 개요

| 항목 | 내용 |
|------|------|
| **브랜치명** | `issue/memory-v2` |
| **주요 작업** | Mem0 장기메모리 시스템 구현, 비밀번호 변경 기능, 일반채팅 메모리 관리 |
| **최신 커밋** | `d142d32` (불필요 파일 제거, 파일 이동 + AI 서버 분리 계획 작성) |
| **작업 기간** | 2025-12-08 ~ 2025-12-09 |

---

## 2. 커밋 히스토리 요약

### 주요 커밋 (시간순, 최신 → 과거)

| 커밋 해시 | 날짜 | 메시지 | 영향 파일 |
|-----------|------|--------|-----------|
| `d142d32` | 2025-12-09 | 불필요 파일 제거, 파일 이동 + AI 서버 분리 계획 작성 | 다수 |
| `124e100` | 2025-12-09 | README 업데이트: 프로젝트 구조 정리 | `README.md` |
| `1a3bdac` | 2025-12-09 11:44 | 장기메모리 업데이트 (Merge) | `backend/chat/trade_views.py` |
| `d6c68ab` | 2025-12-09 11:42 | 장기메모리 업데이트 | `memory_service.py`, `trade_views.py`, `views.py`, `documents/views.py` |
| `0e99034` | 2025-12-09 10:45 | 장기메모리 수정 | `memory_service.py`, `trade_views.py` |
| `f692e3e` | 2025-12-09 09:39 | 일반채팅 내역 삭제 변경 | `frontend/components/ChatPage.tsx` |
| `b0a3d2d` | 2025-12-08 18:18 | 불필요한 문서 삭제 코드 삭제 | `trade_views.py` |
| `6df6f91` | 2025-12-08 17:58 | 문서 단기메모리 삭제 | `trade_views.py` |
| `0d2f3c3` | 2025-12-08 17:57 | 일반채팅 단기메모리 삭제 | `memory_service.py`, `urls.py`, `views.py` |
| `1d8cbde` | 2025-12-08 17:52 | 장기메모리 선호도 수정 | `memory_service.py` |
| `30d727c` | 2025-12-08 17:50 | 일반채팅 db 저장 오류 해결 | `views.py` |
| `15f24be` | 2025-12-08 16:07 | 새로고침 시 화면 유지되도록 수정 | `App.tsx`, `document-creation/index.tsx` |
| `a11b655` | 2025-12-08 15:46 | 업로드된 PDF 파일 로드 상태 유지 | `App.tsx`, `useFileUpload.ts`, `index.tsx` |
| `b8cca20` | 2025-12-08 12:51 | 메모리 저장 시각 Seoul로 변경 (2차) | `settings.py` |
| `0851b9c` | 2025-12-08 12:45 | 메모리 저장 시각 Seoul로 변경 | `memory_service.py`, `settings.py` |
| `2ec75c5` | 2025-12-08 12:17 | 문서 작업 생성 시점 변경 | `App.tsx` |
| `2ce679e` | 2025-12-08 12:00 | 비밀번호 변경 오류 해결 | `MainPage.tsx`, `PasswordChangeModal.tsx` |
| `4ef3ae0` | 2025-12-08 10:43 | 비밀번호 변경 로직 생성 | `documents/urls.py`, `documents/views.py`, `PasswordChangeModal.tsx`, `api.ts` |
| `1c2312d` | 2025-12-08 10:26 | 비밀번호 유효성 검사 추가 | `PasswordChangeModal.tsx`, `package.json` |

---

## 3. 파일별 변경 상세

### 3.1 Backend - 메모리 서비스 (핵심)

#### `backend/chat/memory_service.py` [신규 생성]

Mem0 기반 메모리 관리 서비스 구현 (376줄)

```python
# 파일 위치: backend/chat/memory_service.py

"""
메모리 구조:
1. 단기 메모리 (Short-term) - 세션 요약:
   - 문서별 작업 요약 (doc_{doc_id})
   - 일반채팅 대화 요약 (gen_chat_{gen_chat_id})

2. 장기 메모리 (Long-term) - 영구 보관:
   - 사용자 선호도 (user_{user_id})
   - 거래처별 메모 (buyer_{user_id}_{buyer_name})

3. 영구 기록:
   - RDS (MySQL): 전체 대화 히스토리 (DocMessage, GenMessage 테이블)
"""
```

**주요 클래스 및 메서드:**

| 클래스/메서드 | 설명 |
|--------------|------|
| `TradeMemoryService` | Mem0 메모리 관리 싱글톤 클래스 |
| `_init_memory()` | Mem0 초기화 (Qdrant + OpenAI) |
| `add_doc_memory()` | 문서 세션 메모리 저장 |
| `get_doc_memory()` | 문서 세션 메모리 조회 |
| `delete_doc_memory()` | 문서 메모리 삭제 |
| `add_user_memory()` | 사용자 장기 선호도 저장 |
| `get_user_memory()` | 사용자 선호도 조회 |
| `add_buyer_memory()` | 거래처 메모 저장 |
| `get_buyer_memory()` | 거래처 메모 조회 |
| `add_gen_chat_memory()` | 일반채팅 세션 메모리 저장 |
| `delete_gen_chat_memory()` | 일반채팅 메모리 삭제 |
| `build_doc_context()` | 문서 채팅용 컨텍스트 구성 (병렬 조회) |
| `build_gen_chat_context()` | 일반채팅용 컨텍스트 구성 |
| `get_memory_service()` | 싱글톤 인스턴스 반환 (lazy init) |

**커스텀 프롬프트:**

```python
PROMPTS = {
    "doc": "현재 문서 작업 세션의 핵심 내용만 요약...",
    "gen_chat": "현재 대화 세션의 핵심 내용만 요약...",
    "user": "사용자의 일반적인 선호도와 스타일만 추출...",
    "buyer": "거래처(buyer)에 대한 중요 정보만 추출..."
}
```

---

#### `backend/chat/trade_views.py` [신규 생성]

무역 문서 관리 및 채팅 API (1,096줄)

**주요 View 클래스:**

| 클래스 | 엔드포인트 | 설명 |
|--------|------------|------|
| `TradeInitView` | `POST /api/trade/init/` | 새 TradeFlow + 5개 Document 생성 |
| `TradeFlowViewSet` | `/api/trade/` | TradeFlow CRUD + Mem0 메모리 정리 |
| `DocumentViewSet` | `/api/documents/` | Document 관리 |
| `DocChatHistoryView` | `GET /api/documents/{doc_id}/chat/history/` | 채팅 히스토리 조회 |
| `DocumentChatView` | `POST /api/documents/chat/` | 문서 채팅 (비스트리밍) |
| `DocumentChatStreamView` | `POST /api/documents/chat/stream/` | 문서 채팅 (스트리밍) |
| `GeneralChatView` | `POST /api/chat/general/` | 일반 채팅 |

**핵심 로직 - 문서 채팅 스트리밍:**

```python
def stream_response(self, doc_id, user_id, message, document_content=''):
    # 1. Document 조회
    # 2. 사용자 메시지 저장 (DocMessage)
    # 3. 이전 대화 히스토리 로드 (최근 10개)
    # 4. Mem0 컨텍스트 로드 (build_doc_context)
    # 5. doc_mode에 따라 Agent 선택
    #    - upload: Document Reader Assistant
    #    - manual: Document Writing Assistant
    # 6. 스트리밍 실행 (SSE)
    # 7. AI 응답 저장 + Mem0 메모리 업데이트
```

**doc_mode 기반 에이전트 라우팅:**

```python
if document.doc_mode == 'upload' and document.upload_status == 'ready':
    # 업로드 모드: Document Reader Assistant
    agent = get_read_document_agent(...)
else:
    # 작성 모드: Document Writing Assistant
    agent = get_document_writing_agent(...)
```

---

#### `backend/chat/views.py` [신규 생성]

일반 채팅 관련 View (558줄)

| 클래스 | 설명 |
|--------|------|
| `ChatView` | 비스트리밍 채팅 API |
| `ChatStreamView` | 스트리밍 채팅 API |
| `GenChatDeleteView` | 일반채팅 삭제 (RDS + Mem0) |

**일반채팅 삭제 로직:**

```python
# 커밋: 0d2f3c3 (일반채팅 단기메모리 삭제)
class GenChatDeleteView(APIView):
    def delete(self, request, gen_chat_id):
        # 1. Mem0 메모리 삭제
        mem_service = get_memory_service()
        if mem_service:
            mem_service.delete_gen_chat_memory(gen_chat_id)

        # 2. RDS에서 삭제
        gen_chat.delete()
```

---

#### `backend/chat/urls.py` [신규 생성]

```python
urlpatterns = [
    # 기존 일반 채팅 API
    path('chat/', ChatView.as_view(), name='chat'),
    path('chat/stream/', ChatStreamView.as_view(), name='chat-stream'),

    # 일반 채팅 (Mem0 통합)
    path('chat/general/', GeneralChatView.as_view(), name='chat-general'),
    path('chat/general/<int:gen_chat_id>/', GenChatDeleteView.as_view(), name='chat-general-delete'),

    # 무역 거래 초기화
    path('trade/init/', TradeInitView.as_view(), name='trade-init'),

    # 문서 채팅 API
    path('documents/chat/', DocumentChatView.as_view(), name='document-chat'),
    path('documents/chat/stream/', DocumentChatStreamView.as_view(), name='document-chat-stream'),
    path('documents/<int:doc_id>/chat/history/', DocChatHistoryView.as_view(), name='document-chat-history'),

    # ViewSet routes
    path('', include(router.urls)),
]
```

---

### 3.2 Backend - 비밀번호 변경

#### `backend/documents/views.py` - PasswordChangeView 추가

```python
# 커밋: 4ef3ae0 (비밀번호 변경 로직 생성)

class PasswordChangeView(APIView):
    """비밀번호 변경 API"""

    def post(self, request):
        emp_no = request.data.get('emp_no')
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')

        # 비밀번호 유효성 검사 (8~16자, 영문/숫자/특수문자 조합)
        if len(new_password) < 8 or len(new_password) > 16:
            return Response({'error': '비밀번호는 8~16자 사이여야 합니다.'}, ...)

        has_letter = bool(re.search(r'[A-Za-z]', new_password))
        has_number = bool(re.search(r'[0-9]', new_password))
        has_special = bool(re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?`~]', new_password))

        if not (has_letter and has_number and has_special):
            return Response({'error': '영문, 숫자, 특수문자 각각 1개 이상 포함...'}, ...)

        # 현재 비밀번호 확인 후 변경
        user = User.objects.get(emp_no=emp_no)
        if not user.check_password(current_password):
            return Response({'error': '현재 비밀번호가 올바르지 않습니다.'}, ...)

        user.set_password(new_password)
        user.save()
```

#### `backend/documents/urls.py` - 엔드포인트 추가

```python
# 커밋: 4ef3ae0
path('auth/password-change/', PasswordChangeView.as_view(), name='password-change'),
```

---

### 3.3 Backend - 설정 변경

#### `backend/config/settings.py` - 시간대 설정

```python
# 커밋: 0851b9c, b8cca20 (메모리 저장 시각 Seoul로 변경)

TIME_ZONE = 'Asia/Seoul'
USE_TZ = False  # DB에 로컬 시간으로 저장
```

---

### 3.4 Frontend - 일반채팅

#### `frontend/components/ChatPage.tsx` - 채팅방 삭제 기능

```typescript
// 커밋: f692e3e (일반채팅 내역 삭제 변경)

// 채팅방 삭제 함수 (RDS + Mem0 모두 삭제)
const deleteChat = async () => {
  if (!genChatId) return;

  try {
    const response = await fetch(`${DJANGO_API_URL}/api/chat/general/${genChatId}/`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      // 채팅 내역 초기화
      setMessages([]);
      setGenChatId(null);
    }
  } catch (error) {
    console.error('채팅 삭제 실패:', error);
  }
};
```

---

### 3.5 Frontend - 비밀번호 변경

#### `frontend/components/document-creation/modals/PasswordChangeModal.tsx` [신규 생성]

```typescript
// 커밋: 1c2312d, 4ef3ae0, 2ce679e
// 186줄

// 비밀번호 유효성 검사 함수
function validatePassword(password: string): { isValid: boolean; message: string } {
  // 길이 검사 (8~16자)
  if (password.length < 8 || password.length > 16) {
    return { isValid: false, message: '비밀번호는 8~16자 사이여야 합니다.' };
  }

  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password);

  if (!hasLetter) return { isValid: false, message: '영문자가 포함되어야 합니다.' };
  if (!hasNumber) return { isValid: false, message: '숫자가 포함되어야 합니다.' };
  if (!hasSpecialChar) return { isValid: false, message: '특수문자가 포함되어야 합니다.' };

  return { isValid: true, message: '' };
}

// API 호출
async function handlePasswordChange(e: React.FormEvent) {
  try {
    await api.changePassword(empNo, currentPassword, newPassword);
    setPasswordSuccess(true);
    setTimeout(() => handleClose(), 1500);
  } catch (err) {
    setPasswordError(err.message);
  }
}
```

#### `frontend/components/MainPage.tsx` - 비밀번호 변경 모달 연동

```typescript
// 커밋: 2ce679e (비밀번호 변경 오류 해결)

import PasswordChangeModal from './document-creation/modals/PasswordChangeModal';

<PasswordChangeModal
  isOpen={showPasswordChange}
  onClose={() => setShowPasswordChange(false)}
  empNo={userEmployeeId}
/>
```

---

### 3.6 Frontend - 상태 유지

#### `frontend/App.tsx` - 새로고침 시 화면 유지

```typescript
// 커밋: 15f24be, a11b655, 2ec75c5

// sessionStorage에서 문서 작성 상태 복원
const getSessionState = () => {
  try {
    return {
      currentPage: (sessionStorage.getItem('currentPage') as PageType) || 'main',
      currentStep: Number(sessionStorage.getItem('currentStep')) || 0,
      documentData: JSON.parse(sessionStorage.getItem('documentData') || '{}'),
      currentDocId: sessionStorage.getItem('currentDocId'),
      currentDocIds: JSON.parse(sessionStorage.getItem('currentDocIds') || 'null'),
    };
  } catch {
    return { currentPage: 'main', currentStep: 0, documentData: {}, currentDocId: null, currentDocIds: null };
  }
};
```

---

### 3.7 Frontend - API 클라이언트

#### `frontend/utils/api.ts` - changePassword 추가

```typescript
// 커밋: 4ef3ae0

async changePassword(
  emp_no: string,
  current_password: string,
  new_password: string
): Promise<{ message: string }> {
  return this.request<{ message: string }>('/api/documents/auth/password-change/', {
    method: 'POST',
    body: JSON.stringify({ emp_no, current_password, new_password }),
  });
}
```

---

## 4. 주요 기능 변경

### 4.1 Mem0 장기메모리 시스템

**구조:**

```
┌─────────────────────────────────────────────────────────────────┐
│                         메모리 구조                              │
├─────────────────────────────────────────────────────────────────┤
│  단기 메모리 (Qdrant - 세션 종료 시 삭제 가능)                   │
│  ├── doc_{doc_id}           : 문서 작업 세션 요약               │
│  └── gen_chat_{gen_chat_id} : 일반채팅 대화 요약               │
├─────────────────────────────────────────────────────────────────┤
│  장기 메모리 (Qdrant - 영구 보관)                                │
│  ├── user_{user_id}         : 사용자 선호도                     │
│  └── buyer_{user_id}_{name} : 거래처별 메모                     │
├─────────────────────────────────────────────────────────────────┤
│  영구 기록 (RDS MySQL)                                          │
│  ├── DocMessage             : 문서 채팅 전체 히스토리           │
│  └── GenMessage             : 일반채팅 전체 히스토리           │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 비밀번호 변경 기능

**조건:**
- 8~16자
- 영문(A-Z, a-z) 포함
- 숫자(0-9) 포함
- 특수문자(!@#$%^&* 등) 포함

### 4.3 일반채팅 삭제

**삭제 대상:**
- RDS: `GenChat`, `GenMessage` (CASCADE)
- Qdrant: `gen_chat_{gen_chat_id}` 메모리

---

## 5. API 엔드포인트 변경

### 신규 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/trade/init/` | Trade + 5개 Document 생성 |
| `POST` | `/api/documents/chat/` | 문서 채팅 (비스트리밍) |
| `POST` | `/api/documents/chat/stream/` | 문서 채팅 (SSE 스트리밍) |
| `GET` | `/api/documents/{doc_id}/chat/history/` | 채팅 히스토리 조회 |
| `POST` | `/api/chat/general/` | 일반 채팅 |
| `DELETE` | `/api/chat/general/{gen_chat_id}/` | 일반 채팅 삭제 (RDS+Mem0) |
| `POST` | `/api/documents/auth/password-change/` | 비밀번호 변경 |

---

## 6. 병합 가이드

### 6.1 필수 파일 (반드시 채택)

| 파일 | 이유 |
|------|------|
| `backend/chat/memory_service.py` | 신규 Mem0 서비스 (핵심 기능) |
| `backend/chat/trade_views.py` | 신규 Trade/Document API |
| `backend/chat/views.py` | 일반채팅 삭제 기능 추가 |
| `backend/chat/urls.py` | 신규 URL 라우팅 |
| `backend/config/settings.py` | TIME_ZONE='Asia/Seoul' 설정 |
| `frontend/components/ChatPage.tsx` | 채팅 삭제 기능 |
| `frontend/components/document-creation/modals/PasswordChangeModal.tsx` | 신규 모달 |
| `frontend/utils/api.ts` | changePassword API 추가 |

### 6.2 환경 변수 요구사항

```bash
# Mem0 / Qdrant
MEM0_API_KEY=your_key
QDRANT_URL=https://your-qdrant-instance
QDRANT_API_KEY=your_key

# OpenAI (Mem0 임베딩용)
OPENAI_API_KEY=your_key
```

### 6.3 의존성 추가

`backend/requirements.txt`에 추가된 패키지:
```
mem0ai
qdrant-client
```

### 6.4 테스트 체크리스트

- [ ] 비밀번호 변경 (유효성 검사 8~16자, 영문/숫자/특수문자)
- [ ] 일반채팅 생성 및 삭제
- [ ] 문서 채팅 스트리밍
- [ ] Trade 삭제 시 Mem0 메모리 정리
- [ ] 새로고침 시 문서 작성 화면 유지
- [ ] 업로드된 PDF 상태 복원

---

*문서 생성일: 2025-12-09*
*마지막 커밋: d142d32 (불필요 파일 제거, 파일 이동 + AI 서버 분리 계획 작성)*
