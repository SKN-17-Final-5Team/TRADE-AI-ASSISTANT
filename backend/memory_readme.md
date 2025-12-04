# Memory Feature Implementation

이 문서는 TRADE-AI-ASSISTANT 프로젝트의 **메모리 시스템**을 설명합니다.

---

## 1. 핵심 개념: AI는 어떻게 대화를 기억하는가?

### 문제점
AI(GPT/Claude)는 기본적으로 **대화를 기억하지 못합니다**. 매번 새로운 요청으로 인식합니다.

### 해결책
대화 내용을 저장하고, AI 호출 시 **시스템 프롬프트에 포함**시켜 전달합니다.

```
[사용자 메시지: "가격을 5000달러로 수정해줘"]
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI 호출 시 전달되는 내용                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [시스템 프롬프트]                                            │
│  "당신은 무역 문서 작성을 돕는 AI입니다..."                     │
│                                                             │
│  [최근 대화 히스토리 - RDS에서 10개 조회]                       │
│  User: "Offer Sheet 작성해줘"                                │
│  AI: "네, 작성했습니다..."                                    │
│  User: "상품명을 Widget A로 변경해줘"                         │
│  AI: "Widget A로 변경했습니다..."                             │
│  ... (최근 10개)                                             │
│                                                             │
│  [Mem0 메모리 - 관련 핵심 정보]                               │
│  - "이 사용자는 Widget A 상품을 거래 중"                       │
│  - "이전에 FOB 조건을 선호한다고 함"                           │
│                                                             │
│  [현재 사용자 메시지]                                         │
│  "가격을 5000달러로 수정해줘"                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
        [AI가 컨텍스트를 이해하고 응답]
```

---

## 2. 저장소 구조: RDS vs Mem0

### 왜 두 개의 저장소를 사용하는가?

| 저장소 | 역할 | 비유 |
|--------|------|------|
| **RDS (MySQL)** | 원본 데이터 보관 | 📁 파일 캐비닛 (전체 기록 보관) |
| **Mem0 (Qdrant)** | 핵심 정보 검색 | 🧠 뇌 (중요한 것만 기억) |

### 데이터 흐름

```
[사용자가 메시지 전송]
        │
        ▼
┌───────────────────┐     ┌───────────────────┐
│   RDS (MySQL)     │     │   Mem0 (Qdrant)   │
├───────────────────┤     ├───────────────────┤
│                   │     │                   │
│ 원본 메시지 저장    │     │ AI가 핵심만 추출   │
│ "가격을 5000달러로 │     │ "가격: 5000달러"   │
│  수정해줘"         │     │                   │
│                   │     │ 벡터로 변환해서    │
│ 순서대로 저장      │     │ 저장 (의미 검색용) │
│                   │     │                   │
└───────────────────┘     └───────────────────┘
        │                         │
        │                         │
        ▼                         ▼
┌─────────────────────────────────────────────┐
│           AI 호출 시 조합                     │
├─────────────────────────────────────────────┤
│                                             │
│  RDS에서: 최근 10개 메시지 (대화 흐름)         │
│  Mem0에서: 현재 질문과 관련된 핵심 정보        │
│                                             │
│  → 시스템 프롬프트에 포함하여 AI에 전달        │
│                                             │
└─────────────────────────────────────────────┘
```

### RDS와 Mem0의 차이점

| 항목 | RDS | Mem0 |
|------|-----|------|
| **저장 내용** | 원본 메시지 전체 | AI가 추출한 핵심 정보 |
| **검색 방식** | 최신순 정렬 | 의미 유사도 검색 |
| **예시 저장** | "PI 문서에서 가격을 5000달러로 수정해줘" | "가격: 5000달러로 변경됨" |
| **용도** | 대화 히스토리 재생 | 관련 정보 빠른 검색 |
| **조회 속도** | 빠름 (인덱스) | 빠름 (벡터 검색) |

---

## 3. 문서 채팅 메모리 흐름

문서 작성 페이지(DocumentCreationPage)에서 채팅할 때의 메모리 동작입니다.

### 메시지 전송 시

```
[사용자: "상품명을 Widget A로 변경해줘"]
                │
                ├──► RDS (DocMessage 테이블) 저장
                │    - 원본 메시지 그대로
                │    - doc_id로 문서별 구분
                │
                ├──► Mem0 저장
                │    - AI가 핵심 추출: "상품명: Widget A"
                │    - user_id: "doc_{doc_id}"로 저장
                │
                ▼
        [AI 호출 준비]
                │
                ├──► RDS에서 최근 10개 메시지 조회
                │
                ├──► Mem0에서 관련 메모리 검색
                │    - 현재 질문 "상품명을 Widget A로..."와
                │      유사한 과거 대화 검색
                │
                ├──► RDS (DocVersion)에서 이전 Step 문서 조회
                │    - Step2에서 Step1 문서 내용 참조
                │
                ▼
        [시스템 프롬프트 조합 → AI 호출]
                │
                ▼
        [AI 응답]
                │
                ├──► RDS (DocMessage) 저장
                │
                └──► Mem0 저장
```

### Step 간 문서 참조

Step2(PI)에서 Step1(Offer Sheet) 내용을 참조해야 할 때:

```
[Step2에서 AI 호출 시]
        │
        └──► RDS DocVersion 테이블에서 직접 조회
             │
             ├── Document.objects.filter(trade_id=trade_id)
             │   → 같은 무역의 모든 문서 찾기
             │
             ├── DocVersion.objects.filter(doc=sibling_doc)
             │   → 각 문서의 최신 버전 가져오기
             │
             └── HTML → Text 변환 후 시스템 프롬프트에 포함
```

**왜 Mem0가 아닌 RDS에서 조회하는가?**
- Mem0는 내용을 **요약/추출**하므로 원본이 변형됨
- RDS는 **원본 그대로** 저장되어 정확한 내용 참조 가능

---

## 4. 일반 채팅 메모리 흐름

메인 페이지(MainPage)에서 일반 채팅할 때의 메모리 동작입니다.

```
[사용자: "FOB 조건이 뭐야?"]
                │
                ├──► RDS (GenMessage 테이블) 저장
                │
                ├──► Mem0 저장
                │    - user_id: "gen_chat_{gen_chat_id}"
                │
                ▼
        [AI 호출 준비]
                │
                ├──► Mem0에서 세션 내 대화 메모리 검색
                │    - 이번 채팅 세션에서 나눈 대화
                │
                ├──► Mem0에서 사용자 장기 메모리 검색
                │    - user_id: "user_{user_id}"
                │    - "이 사용자는 FOB 조건을 선호함" 등
                │
                ▼
        [AI 응답]
```

**일반 채팅 특징:**
- 새로고침하면 새 채팅방으로 시작 (gen_chat_id가 새로 생성)
- 하지만 **사용자 장기 메모리**는 유지됨 (user_id 기준)

---

## 5. 메모리 종류 정리

### Mem0에 저장되는 메모리 종류

| 메모리 종류 | Mem0 user_id | 저장 내용 | 수명 |
|------------|--------------|----------|------|
| **문서 대화 메모리** | `doc_{doc_id}` | 해당 문서에서 나눈 대화 핵심 | 문서 삭제 시까지 |
| **일반 채팅 메모리** | `gen_chat_{id}` | 해당 세션에서 나눈 대화 핵심 | 세션 종료 시까지 |
| **사용자 장기 메모리** | `user_{user_id}` | 사용자 선호도, 패턴 | 영구 |

### RDS에 저장되는 데이터

| 테이블 | 저장 내용 | 용도 |
|--------|----------|------|
| `DocMessage` | 문서 채팅 원본 메시지 | 대화 히스토리 표시, AI 컨텍스트 |
| `GenMessage` | 일반 채팅 원본 메시지 | AI 컨텍스트 |
| `DocVersion` | 문서 에디터 내용 (HTML) | Step 간 참조, 버전 관리 |
| `DocUploadFile` | 업로드 파일 파싱 내용 | 파일 내용 참조 |

---

## 6. 파일 구조

### Backend 파일 역할

| 파일 | 역할 | 사용하는 페이지 |
|------|------|----------------|
| `views.py` | 일반 채팅 API | MainPage |
| `trade_views.py` | 문서 채팅/저장 API | DocumentCreationPage |
| `memory_service.py` | Mem0 연동 서비스 | 양쪽 모두 |
| `models.py` | DB 모델 정의 | - |

### API 흐름도

```
[MainPage.tsx]
    │
    └── /api/chat/stream/ ──► views.py (ChatStreamView)
                                  │
                                  └── memory_service.build_gen_chat_context()

[DocumentCreationPage (index.tsx)]
    │
    ├── /api/trade/init/ ──► trade_views.py (TradeInitView)
    │
    ├── /api/documents/chat/stream/ ──► trade_views.py (DocumentChatStreamView)
    │                                       │
    │                                       ├── RDS에서 최근 10개 메시지 조회
    │                                       ├── memory_service.build_context()
    │                                       └── RDS DocVersion에서 이전 Step 조회
    │
    └── /api/documents/{id}/save_version/ ──► trade_views.py
```

---

## 7. 성능 최적화

### 1. 최근 10개 메시지만 전달

```python
# trade_views.py
recent_messages = DocMessage.objects.filter(doc_id=doc_id) \
    .order_by('-created_at')[:10]  # 최신 10개만
```

**이유:** 토큰 절약 + 오래된 대화는 덜 중요

### 2. 병렬 메모리 조회

```python
# memory_service.py
with ThreadPoolExecutor(max_workers=3) as executor:
    doc_future = executor.submit(self.get_doc_memory, ...)
    user_future = executor.submit(self.get_user_memory, ...)

    # 동시에 조회 → 시간 단축
    context["doc_memories"] = doc_future.result()
    context["user_memories"] = user_future.result()
```

### 3. 첫 메시지 최적화

새 채팅방의 첫 메시지는 단기 메모리 조회를 스킵합니다.
(아직 쌓인 대화가 없으므로)

```python
if is_first_message:
    # 장기 메모리(사용자 선호도)만 조회
    context["user_memories"] = self.get_user_memory(...)
```

---

## 8. 주의사항

1. **일반 채팅은 새로고침 시 리셋**
   - gen_chat_id가 새로 생성됨
   - 이전 대화 히스토리 UI에 표시 안 됨
   - 단, 사용자 장기 메모리는 유지

2. **문서 채팅은 영구 유지**
   - doc_id 기준으로 대화 저장
   - 페이지 재진입 시 히스토리 로드

3. **Step 간 문서 참조는 RDS에서**
   - Mem0가 아닌 DocVersion 테이블에서 직접 조회
   - 원본 보존이 중요하기 때문

4. **토큰 제한**
   - AI에 전달되는 대화 히스토리는 최근 10개
   - 전체 히스토리는 RDS에 보관됨

---

## 9. 초기 코드 대비 변경 사항

### 삭제된 기능

| 삭제된 것 | 대체 방법 |
|----------|----------|
| `save_to_memory` API | `save_version` API 사용 |
| Mem0에 문서 내용 저장 | RDS DocVersion에 저장 |
| `trade_{trade_id}` 메모리 | RDS에서 직접 조회 |

### 변경 이유

**Before:** Step 이동 시 Mem0에 문서 내용 저장
```typescript
await fetch('/api/documents/save_to_memory/', {
    body: JSON.stringify({ trade_id, doc_type, content })
})
```

**After:** RDS save_version API 사용
```typescript
await fetch(`/api/documents/${docId}/save_version/`, {
    body: JSON.stringify({ content: { html_content, ... } })
})
```

**이유:** Mem0는 내용을 요약/추출하므로 원본 보존이 안 됨
