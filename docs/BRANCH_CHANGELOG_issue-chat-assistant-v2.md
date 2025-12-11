# Branch Changelog: issue/chat-assistant-v2

---
## Metadata
```yaml
branch_name: issue/chat-assistant-v2
base_branch: main
created_from: merge/editor-memory
last_commit: c7920a3 (Tel./Fax 매핑 오류 수정)
total_commits_from_main: 130
total_files_changed: 182
document_created: 2025-12-11
document_author: AI Agent (Claude)
status: UNCOMMITTED_CHANGES_PRESENT
```

---

## CRITICAL: Merge Priority Rules

> **이 섹션은 충돌 발생 시 반드시 참조해야 합니다.**

### 1. 이 브랜치가 최신인 파일 (이 브랜치 코드 채택)
| 파일 | 이유 |
|------|------|
| `frontend/components/ChatAssistant.tsx` | Step 4 CI/PL 채팅 분리 기능 추가 (activeShippingDoc 지원) |
| `frontend/components/document-creation/index.tsx` | ChatAssistant에 activeShippingDoc prop 전달 추가 |

### 2. 충돌 시 주의사항
- **ChatAssistant.tsx**: `activeShippingDoc` prop과 `currentDocId` 계산 로직이 핵심 변경사항
- **document-creation/index.tsx**: ChatAssistant 호출 부분에 `activeShippingDoc={activeShippingDoc}` 1줄 추가됨

---

## Session Changes (2025-12-11) - UNCOMMITTED

### Summary
Step 4 선적서류(CI/PL) 화면에서 채팅이 서류별로 분리되지 않는 버그 수정

### Problem
- Step 4에서 CI와 PL 두 서류가 있을 때, 서류를 전환해도 동일한 채팅 히스토리가 표시됨
- 원인: `ChatAssistant.tsx`에서 `currentDocId` 계산 시 `activeShippingDoc` 상태를 반영하지 않고 `currentStep`만으로 고정값('CI')을 사용

### Solution
- `ChatAssistant`에 `activeShippingDoc` prop 추가
- `currentDocId` 계산 로직에서 `activeShippingDoc` 반영
- `currentDocId` 변경 시 채팅 히스토리 자동 리로드

---

### File 1: `frontend/components/ChatAssistant.tsx`

#### Changes Summary
- **Lines Changed**: 40 (21 insertions, 20 deletions)
- **Type**: Bug Fix + Feature Enhancement

#### Detailed Diff

```diff
@@ -56,9 +56,10 @@ interface ChatAssistantProps {
   documentId?: number | null;
   userEmployeeId?: string;
   getDocId?: (step: number, shippingDoc?: 'CI' | 'PL' | null) => number | null;
+  activeShippingDoc?: 'CI' | 'PL' | null; // 현재 활성화된 선적서류 타입 (Step 4에서 CI/PL 구분용)
 }

-export default function ChatAssistant({ currentStep, onClose, editorRef, onApply, documentId, userEmployeeId, getDocId }: ChatAssistantProps) {
+export default function ChatAssistant({ currentStep, onClose, editorRef, onApply, documentId, userEmployeeId, getDocId, activeShippingDoc }: ChatAssistantProps) {
```

**Line 59**: Props interface에 `activeShippingDoc` 추가
**Line 62**: 함수 파라미터에 `activeShippingDoc` 추가

```diff
@@ -76,21 +77,22 @@ export default function ChatAssistant({ ... }) {
   const [isConnected, setIsConnected] = useState(true);
   const messagesEndRef = useRef<HTMLDivElement>(null);

-  // 이전 step 추적 (변경 감지용)
-  const prevStepRef = useRef<number>(currentStep);
-
   // 현재 step에 해당하는 doc_id 가져오기 (getDocId 함수 사용)
   const currentDocId = useMemo(() => {
     if (documentId) return documentId;
     if (getDocId) {
-      // Step 4는 CI, Step 5는 PL
-      const shippingDoc = currentStep === 4 ? 'CI' : currentStep === 5 ? 'PL' : null;
-      return getDocId(currentStep <= 3 ? currentStep : (currentStep === 4 ? 4 : 5), shippingDoc);
+      // Step 4에서는 activeShippingDoc 사용 (CI 또는 PL)
+      const shippingDoc = currentStep === 4 ? (activeShippingDoc || 'CI') : null;
+      return getDocId(currentStep <= 3 ? currentStep : 4, shippingDoc);
     }
     return null;
-  }, [documentId, getDocId, currentStep]);
+  }, [documentId, getDocId, currentStep, activeShippingDoc]);
+
+  // 이전 doc_id 추적 (변경 감지용)
+  const prevDocIdRef = useRef<number | null>(null);
```

**Line 80-92**: `currentDocId` 계산 로직 변경
- 기존: `currentStep === 4 ? 'CI'` (항상 CI 고정)
- 수정: `currentStep === 4 ? (activeShippingDoc || 'CI')` (activeShippingDoc 반영)
- 의존성 배열에 `activeShippingDoc` 추가

**Line 95**: `prevStepRef` 제거, `prevDocIdRef` 추가

```diff
@@ -299,21 +301,19 @@ export default function ChatAssistant({ ... }) {
     scrollToBottom();
   }, [messages]);

-  // currentStep 변경 감지: 문서가 바뀌면 새 채팅 시작
+  // currentDocId 변경 감지: 문서가 바뀌면 새 채팅 시작
+  // Step 4에서 CI↔PL 전환 시에도 currentDocId가 변경되어 채팅이 리프레시됨
   useEffect(() => {
-    const stepChanged = prevStepRef.current !== currentStep;
-
-    if (stepChanged) {
-      prevStepRef.current = currentStep;
+    if (prevDocIdRef.current === currentDocId) return;
+    prevDocIdRef.current = currentDocId;

-      if (currentDocId) {
-        loadChatHistory(currentDocId);
-      } else {
-        resetChat();
-      }
+    if (currentDocId) {
+      console.log(`[ChatAssistant] 채팅 리로드: docId=${currentDocId}`);
+      loadChatHistory(currentDocId);
+    } else {
+      resetChat();
     }
-  }, [currentStep, currentDocId]);
+  }, [currentDocId]);
```

**Line 304-316**: useEffect 로직 간소화
- 기존: `currentStep` 변경 감지
- 수정: `currentDocId` 변경 감지 (더 정확함)

---

### File 2: `frontend/components/document-creation/index.tsx`

#### Changes Summary
- **Lines Changed**: 1 insertion
- **Type**: Props Passing

#### Detailed Diff

```diff
@@ -1418,6 +1418,7 @@ export default function DocumentCreationPage({ ... }) {
             }
             userEmployeeId={userEmployeeId}
             getDocId={getDocId}
+            activeShippingDoc={activeShippingDoc}
           />
         </div>
       </div>
```

**Line 1421**: ChatAssistant 호출 시 `activeShippingDoc` prop 전달 추가

---

## Commit History (Recent 30 commits)

| Hash | Message | Date | Author |
|------|---------|------|--------|
| c7920a3 | Tel./Fax 매핑 오류 수정 | 2025-12-11 | CHUH00 |
| 6863f6d | mem0 임베딩 모델 수정 | 2025-12-11 | - |
| 1056606 | Merge branch 'merge/text-editor-chat' into merge/editor-memory | 2025-12-11 | - |
| 22ecf36 | mem0 메모리 수정 | 2025-12-11 | - |
| 71ed006 | CI랑 PL 토글 버튼 디자인 개선 | 2025-12-10 | - |
| 316a24b | 버전 기록 창 UI 수정 | 2025-12-10 | - |
| 8917151 | Sales Contract 옵션 선택시 다음 문서 넘어가는 기준 변경 | 2025-12-10 | - |
| 40f1cb1 | 다운로드 중 빈 공백 페이지 제거 | 2025-12-10 | - |
| 42579e4 | Merge branch 'issue/chat-assistant' into merge/text-editor-chat | 2025-12-10 | - |
| cde2ba0 | 파일업로드 오류 메시지 수정 | 2025-12-10 | - |
| d62389a | 문서 이동 오류 수정 | 2025-12-10 | - |
| 2db887b | Sales Contract 합계 -> TOTAL: 변경 | 2025-12-10 | - |
| 3426389 | 개별 PDF 문서로 다운로드 기능 변경 | 2025-12-10 | - |
| bd91669 | AI 채팅 편집 메시지 오류 해결 | 2025-12-10 | - |

---

## Feature Summary by Category

### 1. Chat Assistant (채팅 어시스턴트)
- `bd91669`: AI 채팅 편집 메시지 오류 해결
- **UNCOMMITTED**: Step 4 CI/PL 채팅 분리 기능

### 2. Document Editor (문서 에디터)
- `c7920a3`: Tel./Fax 매핑 오류 수정
- `71ed006`: CI/PL 토글 버튼 디자인 개선
- `40f1cb1`: 다운로드 중 빈 공백 페이지 제거
- `3426389`: 개별 PDF 문서로 다운로드 기능 변경

### 3. Memory System (메모리 시스템)
- `6863f6d`: mem0 임베딩 모델 수정
- `22ecf36`: mem0 메모리 수정

### 4. Bug Fixes
- `d62389a`: 문서 이동 오류 수정
- `cde2ba0`: 파일업로드 오류 메시지 수정

---

## Conflict Risk Analysis

### High Risk Files
| File | Risk Level | Reason |
|------|------------|--------|
| `frontend/components/ChatAssistant.tsx` | **HIGH** | 핵심 로직 변경, 다른 브랜치에서도 수정 가능성 |
| `frontend/components/document-creation/index.tsx` | **MEDIUM** | 자주 변경되는 파일, 1줄 추가만 있음 |

### Conflict Resolution Guide

#### ChatAssistant.tsx 충돌 시
```typescript
// 반드시 포함해야 하는 코드:

// 1. Props interface (Line 59)
activeShippingDoc?: 'CI' | 'PL' | null;

// 2. Function parameter (Line 62)
export default function ChatAssistant({ ..., activeShippingDoc }: ChatAssistantProps) {

// 3. currentDocId 계산 (Line 88)
const shippingDoc = currentStep === 4 ? (activeShippingDoc || 'CI') : null;

// 4. useMemo 의존성 (Line 92)
}, [documentId, getDocId, currentStep, activeShippingDoc]);

// 5. useEffect 의존성 (Line 316)
}, [currentDocId]);  // currentStep 제거됨
```

#### document-creation/index.tsx 충돌 시
```typescript
// ChatAssistant 호출 부분에 아래 prop 추가 필요:
activeShippingDoc={activeShippingDoc}
```

---

## Merge Guide

### Pre-merge Checklist
- [ ] Uncommitted 변경사항 커밋 완료
- [ ] 빌드 테스트 통과 (`npm run build`)
- [ ] 기능 테스트 완료 (Step 4에서 CI/PL 전환 시 채팅 분리 확인)

### Merge Commands

```bash
# 1. 현재 변경사항 커밋
git add frontend/components/ChatAssistant.tsx frontend/components/document-creation/index.tsx
git commit -m "fix: Step 4 CI/PL 채팅 분리 기능 추가 (activeShippingDoc 지원)"

# 2. 원격에 푸시
git push origin issue/chat-assistant-v2

# 3. main으로 merge (또는 PR 생성)
git checkout main
git pull origin main
git merge issue/chat-assistant-v2

# 충돌 발생 시:
# - ChatAssistant.tsx: 이 브랜치의 activeShippingDoc 관련 코드 유지
# - document-creation/index.tsx: activeShippingDoc prop 추가 확인
```

---

## Files Modified in This Branch (Uncommitted)

| File Path | Status | Lines Changed |
|-----------|--------|---------------|
| `frontend/components/ChatAssistant.tsx` | Modified | +21 / -20 |
| `frontend/components/document-creation/index.tsx` | Modified | +1 |

---

## Technical Notes for AI Agents

### Key Variables to Preserve
```typescript
// ChatAssistant.tsx
activeShippingDoc  // prop - 'CI' | 'PL' | null
currentDocId       // useMemo - activeShippingDoc 의존
prevDocIdRef       // useRef - 변경 감지용
```

### Logic Flow
```
DocumentCreationPage
  └─ activeShippingDoc state (CI or PL)
      └─ ChatAssistant prop
          └─ currentDocId = getDocId(step, activeShippingDoc)
              └─ useEffect: loadChatHistory(currentDocId)
```

### Test Scenarios
1. Step 4 진입 → CI 채팅 로드 확인
2. CI → PL 전환 → PL 채팅 로드 확인 (다른 히스토리)
3. PL → CI 전환 → CI 채팅 다시 로드 확인
4. 각 서류에서 메시지 전송 → 해당 서류의 doc_id로 저장 확인

---

*Generated by AI Agent on 2025-12-11*
