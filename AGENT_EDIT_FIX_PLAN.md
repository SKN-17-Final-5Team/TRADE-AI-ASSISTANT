# AI 에이전트 문서 수정 방식 개선 계획서

> **작성일**: 2025-12-03
> **완료일**: 2025-12-03
> **상태**: ✅ 구현 완료
> **목적**: 에이전트 문서 수정 시 전체 HTML 교체 방식의 문제점 해결

---

## 1. 현재 상황 분석

### 1.1 현재 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              사용자 요청                                      │
│                    "가격을 50000달러로 수정해줘"                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Backend: Agent 처리                                  │
│                                                                             │
│  1. 현재 문서 HTML 전체를 프롬프트에 포함                                      │
│     document_content = editor.getHTML()  (약 10KB~50KB)                     │
│                                                                             │
│  2. Agent가 문서 전체를 수정하고 전체 HTML 반환                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Agent 응답 (JSON)                                    │
│                                                                             │
│  {                                                                          │
│    "type": "edit",                                                          │
│    "message": "가격을 USD 50,000으로 수정했습니다",                            │
│    "changes": [                                                             │
│      {"field": "price", "before": "[price]", "after": "USD 50,000"}         │
│    ],                                                                       │
│    "html": "<!DOCTYPE html>...<전체 문서 HTML>..."  ← 문제의 핵심!            │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Frontend: 적용 처리                                     │
│                                                                             │
│  handleChatApply(content, step):                                            │
│    1. content = Agent가 반환한 전체 HTML                                     │
│    2. data-source="agent" 속성 주입                                         │
│    3. extractData() - sharedData 업데이트                                   │
│    4. setDocumentData({ [step]: content })  ← 전체 교체!                    │
│    5. editorRef.setContent(content)         ← 전체 교체!                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 관련 파일 및 코드 위치

| 파일 | 위치 | 역할 |
|------|------|------|
| `backend/agent_core/prompts/fallback.py` | 11-75 | DOCUMENT_WRITING_PROMPT 정의 |
| `backend/agent_core/agents.py` | 60-117 | get_document_writing_agent() |
| `frontend/components/ChatAssistant.tsx` | 140-147 | Agent 응답 파싱 |
| `frontend/components/ChatAssistant.tsx` | 403-415 | edit 타입 응답 처리 |
| `frontend/components/DocumentCreationPage.tsx` | 380-420 | handleChatApply() |

### 1.3 현재 프롬프트 (문제 부분)

```python
# backend/agent_core/prompts/fallback.py (52-64행)

**문서 수정 시 응답 형식**
문서 수정 요청 시 반드시 아래 JSON 형식으로만 응답:

```json
{
  "type": "edit",
  "message": "수정 내용 설명",
  "changes": [
    {"field": "변경된 필드명", "before": "변경 전 값", "after": "변경 후 값"}
  ],
  "html": "수정된 전체 HTML"  ← 문제!
}
```
```

---

## 2. 문제점 상세

### 2.1 치명적 문제

#### 문제 1: 동시 편집 손실 (Critical)

```
Timeline:
─────────────────────────────────────────────────────────────────────────
T0: 사용자가 "가격 수정해줘" 요청
    └─ 이 시점의 HTML이 Agent에게 전달됨

T1: Agent가 처리 중... (2-5초 소요)
    └─ 사용자가 이 동안 seller_name을 "ABC Corp"로 수정

T2: Agent 응답 도착
    └─ T0 시점 HTML 기준으로 가격만 수정된 전체 HTML 반환
    └─ seller_name은 여전히 placeholder!

T3: 사용자가 "적용" 클릭
    └─ T2의 HTML로 전체 교체
    └─ 결과: seller_name 수정이 사라짐! ← 데이터 손실
─────────────────────────────────────────────────────────────────────────
```

#### 문제 2: 공통 필드 동기화 충돌 (Critical)

```
현재 구조:
- Offer Sheet에서 buyer_name = "Global Import Co." 입력
- sharedData에 저장됨
- PI로 이동 시 buyer_name이 자동 매핑됨

문제 시나리오:
1. PI에서 AI에게 "가격 수정해줘" 요청
2. AI가 받은 PI HTML에는 buyer_name = "Global Import Co."
3. AI가 가격만 수정하고 전체 HTML 반환
4. 그런데 사용자가 그 사이 Offer Sheet에서 buyer_name을 "New Corp"로 변경했다면?
5. 적용 시 PI의 buyer_name이 "Global Import Co."로 롤백됨
6. sharedData와 불일치 발생
```

#### 문제 3: Placeholder 원복 위험 (High)

```
시나리오:
1. 사용자가 여러 필드를 수동으로 채움
2. AI에게 특정 필드 수정 요청
3. AI가 응답하는 동안 LLM의 토큰 제한이나 실수로
   일부 필드가 다시 placeholder로 표시될 수 있음
4. 전체 교체 시 수동 입력값 손실
```

### 2.2 부수적 문제

| 문제 | 설명 | 심각도 |
|------|------|--------|
| 비효율성 | 한 필드만 수정해도 전체 HTML 전송 (10KB~50KB) | Medium |
| 토큰 낭비 | LLM이 전체 HTML을 출력해야 함 (비용 증가) | Medium |
| 응답 지연 | 전체 HTML 생성에 시간 소요 | Low |
| 파싱 에러 | 큰 HTML에서 JSON 파싱 실패 가능성 | Low |

---

## 3. 해결 방안 비교

### 3.1 방안 A: 필드 단위 업데이트 (권장)

**개념**: Agent가 변경된 필드의 ID와 값만 반환

```json
{
  "type": "edit",
  "message": "가격을 수정했습니다",
  "changes": [
    {
      "fieldId": "price",
      "value": "USD 50,000"
    },
    {
      "fieldId": "total_amount",
      "value": "USD 50,000"
    }
  ]
}
```

**프론트엔드 처리**:
```typescript
changes.forEach(({ fieldId, value }) => {
  // 에디터에서 해당 fieldId를 가진 노드만 찾아서 업데이트
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'dataField' && node.attrs.fieldId === fieldId) {
      // 해당 노드의 텍스트만 교체
      tr.replaceWith(pos + 1, pos + node.nodeSize - 1, schema.text(value));
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, source: 'agent' });
    }
  });
});
```

| 장점 | 단점 |
|------|------|
| 동시 편집 안전 | 프롬프트 수정 필요 |
| 효율적 (작은 페이로드) | 프론트엔드 적용 로직 수정 필요 |
| 토큰 절약 | fieldId 기반이므로 data-field-id가 없는 텍스트는 수정 불가 |
| 빠른 응답 | |

### 3.2 방안 B: Diff/Patch 방식

**개념**: 변경 전/후 차이만 전송

```json
{
  "type": "edit",
  "message": "가격을 수정했습니다",
  "patches": [
    {
      "op": "replace",
      "path": "//*[@data-field-id='price']/text()",
      "value": "USD 50,000"
    }
  ]
}
```

| 장점 | 단점 |
|------|------|
| 유연함 (모든 텍스트 수정 가능) | 구현 복잡도 높음 |
| 정밀한 변경 추적 | XPath/CSS 선택자 파싱 필요 |
| | LLM이 정확한 패치 생성해야 함 |

### 3.3 방안 C: 3-way Merge

**개념**: 원본, AI 수정본, 현재 문서를 비교하여 병합

```
Original (T0) ──────┬────── AI Modified (T2)
                    │
                    └────── User Modified (T1~T3)

                    ▼

              3-way Merge

                    ▼

            Final Result
```

| 장점 | 단점 |
|------|------|
| 동시 편집 완벽 지원 | 구현 매우 복잡 |
| 충돌 시 사용자에게 선택권 | 병합 라이브러리 필요 |
| | 충돌 해결 UI 필요 |

### 3.4 방안 선택: A (필드 단위 업데이트)

**선택 이유**:
1. 현재 구조(data-field-id 기반)와 가장 잘 맞음
2. 구현 복잡도가 낮음
3. 대부분의 수정 요청이 특정 필드 대상
4. 기존 동기화 로직(onUpdate)과 자연스럽게 연동

---

## 4. 상세 구현 계획

### 4.1 수정 대상 파일

| 파일 | 수정 내용 |
|------|----------|
| `backend/agent_core/prompts/fallback.py` | 프롬프트에서 html 필드 제거, changes 형식 변경 |
| `backend/api/chat.py` | (필요시) 응답 처리 로직 |
| `frontend/components/ChatAssistant.tsx` | edit 응답 처리 방식 변경 |
| `frontend/components/DocumentCreationPage.tsx` | handleChatApply() 로직 변경 |

### 4.2 Phase 1: 프롬프트 수정

**Before (fallback.py)**:
```python
**문서 수정 시 응답 형식**
```json
{
  "type": "edit",
  "message": "수정 내용 설명",
  "changes": [
    {"field": "변경된 필드명", "before": "변경 전 값", "after": "변경 후 값"}
  ],
  "html": "수정된 전체 HTML"
}
```
```

**After**:
```python
**문서 수정 시 응답 형식**
```json
{
  "type": "edit",
  "message": "수정 내용 설명",
  "changes": [
    {
      "fieldId": "data-field-id 속성값",
      "value": "새로운 값"
    }
  ]
}
```

**중요**:
- html 필드는 반환하지 마세요
- 변경이 필요한 필드의 data-field-id만 정확히 지정하세요
- 같은 값을 가져야 하는 공통 필드(예: seller_name이 여러 곳에 있는 경우)는
  하나만 changes에 포함하면 됩니다 (프론트엔드에서 자동 동기화)
```

### 4.3 Phase 2: 프론트엔드 수정

#### 4.3.1 ChatAssistant.tsx 수정

```typescript
// 기존 (삭제)
if (parsed.type === 'edit' && parsed.html) {
  return {
    message: parsed.message,
    updatedHTML: parsed.html,  // ← 삭제
    changes: parsed.changes || []
  };
}

// 변경 후
if (parsed.type === 'edit' && parsed.changes) {
  return {
    message: parsed.message,
    changes: parsed.changes  // fieldId, value 배열
  };
}
```

#### 4.3.2 DocumentCreationPage.tsx 수정

```typescript
// 기존 handleChatApply
const handleChatApply = (content: string, step: number) => {
  // content = 전체 HTML
  // ... 전체 교체 로직
};

// 변경 후
const handleChatApply = (changes: { fieldId: string; value: string }[], step: number) => {
  if (!editorRef.current) return;

  const editor = editorRef.current.getEditor(); // Tiptap editor 인스턴스
  const { state, view } = editor;
  const tr = state.tr;
  let modified = false;

  // 변경할 필드들 수집
  const fieldsToUpdate = new Map(changes.map(c => [c.fieldId, c.value]));

  // 문서 순회하며 해당 필드만 업데이트
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'dataField') {
      const fieldId = node.attrs.fieldId;
      if (fieldsToUpdate.has(fieldId)) {
        const newValue = fieldsToUpdate.get(fieldId)!;

        // 텍스트 교체
        tr.replaceWith(pos + 1, pos + node.nodeSize - 1, state.schema.text(newValue));

        // source를 'agent'로 설정
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, source: 'agent' });

        modified = true;
      }
    }
  });

  if (modified) {
    view.dispatch(tr);

    // sharedData 업데이트
    changes.forEach(({ fieldId, value }) => {
      setSharedData(prev => ({ ...prev, [fieldId]: value }));
    });
  }
};
```

### 4.4 Phase 3: 인터페이스 업데이트

```typescript
// ChatAssistant.tsx
interface Change {
  fieldId: string;
  value: string;
}

interface Message {
  // ...
  hasApply?: boolean;
  changes?: Change[];  // applyContent 대신 changes 사용
}

// props 변경
interface ChatAssistantProps {
  // ...
  onApply: (changes: Change[], step: number) => void;  // 시그니처 변경
}
```

### 4.5 Phase 4: 미리보기 수정

현재 미리보기는 전체 HTML before/after 비교인데,
필드 단위로 변경하면 다음과 같이 수정:

```typescript
// 미리보기에서 변경 사항 표시
const PreviewChanges = ({ changes }: { changes: Change[] }) => (
  <div className="space-y-2">
    {changes.map((change, i) => (
      <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
        <span className="font-mono text-sm text-gray-500">{change.fieldId}</span>
        <span className="text-green-600">→ {change.value}</span>
      </div>
    ))}
  </div>
);
```

---

## 5. 테스트 케이스

### 5.1 기본 기능

```
TC-1: 단일 필드 수정
1. "가격을 50000달러로 수정해줘"
2. 확인: price 필드만 변경, 다른 필드 유지

TC-2: 여러 필드 수정
1. "seller 정보를 ABC Corp, 서울로 수정해줘"
2. 확인: seller_name, seller_address만 변경

TC-3: 예시로 채우기
1. "모든 필드를 예시로 채워줘"
2. 확인: 모든 placeholder 필드에 적절한 값
```

### 5.2 동시 편집 안전성

```
TC-4: 동시 수정 보존
1. AI에게 "가격 수정해줘" 요청
2. 응답 기다리는 동안 buyer_name을 수동으로 "Test Corp"로 변경
3. AI 응답 적용
4. 확인: buyer_name = "Test Corp" 유지, price만 변경

TC-5: sharedData 동기화
1. Offer Sheet에서 seller_name 설정
2. PI로 이동 (자동 매핑)
3. PI에서 AI에게 가격 수정 요청
4. 적용 후 확인: seller_name 유지, 동기화 정상
```

### 5.3 엣지 케이스

```
TC-6: 존재하지 않는 fieldId
1. AI가 없는 fieldId 반환 시
2. 확인: 에러 없이 무시, 있는 것만 적용

TC-7: 빈 changes 배열
1. AI가 changes: [] 반환 시
2. 확인: 아무 변경 없이 메시지만 표시
```

---

## 6. 롤백 계획

문제 발생 시:

```bash
# 프롬프트 롤백
git checkout HEAD~1 -- backend/agent_core/prompts/fallback.py

# 프론트엔드 롤백
git checkout HEAD~1 -- frontend/components/ChatAssistant.tsx
git checkout HEAD~1 -- frontend/components/DocumentCreationPage.tsx
```

---

## 7. 예상 위험 및 대응

| 위험 | 가능성 | 대응 |
|------|--------|------|
| LLM이 잘못된 fieldId 반환 | 중간 | 존재하지 않는 fieldId 무시, 로그 기록 |
| 기존 html 방식 응답 (캐시) | 낮음 | 양쪽 형식 모두 처리하도록 fallback |
| changes가 빈 배열 | 낮음 | 빈 배열 처리 로직 추가 |
| Langfuse 프롬프트 동기화 | 중간 | Langfuse 프롬프트도 같이 업데이트 |

---

## 8. 구현 순서

```
1. [Backend] fallback.py 프롬프트 수정
2. [Backend] Langfuse 프롬프트 업데이트 (있는 경우)
3. [Frontend] ChatAssistant.tsx - 응답 파싱 로직 변경
4. [Frontend] DocumentCreationPage.tsx - handleChatApply 변경
5. [Frontend] ContractEditor.tsx - getEditor() 메서드 노출 (필요시)
6. [Frontend] 미리보기 UI 수정
7. [Test] 테스트 케이스 수행
8. [Build] 빌드 및 배포
```

---

*계획서 작성 완료*
