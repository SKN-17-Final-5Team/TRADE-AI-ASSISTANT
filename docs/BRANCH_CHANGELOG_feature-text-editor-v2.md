---
branch: feature/text-editor-v2
author: Antigravity (AI Assistant)
date: 2025-12-05
target_merge_branch: merge/trade-ai-assistant
related_docs: docs/BRANCH_CHANGELOG_issue-document-upload.md
---

# Branch Changelog: feature/text-editor-v2

이 문서는 `feature/text-editor-v2` 브랜치의 모든 변경 사항, 작업 내역, 그리고 Merge 시 충돌 해결 가이드를 포함합니다.

## 1. 핵심 규칙 (CRITICAL)

Merge 시 다음 규칙을 **반드시** 따라야 합니다.

> [!IMPORTANT]
> **충돌 해결 우선순위**
>
> 1.  **에디터 관련 파일** (`ContractEditor.tsx`, `editor.css`, `templates/*.ts`)
>     *   👉 **`feature/text-editor-v2` (Current) 채택**
>     *   이유: 행 동기화, 자동 계산, 안정성 패치가 이 브랜치에 포함됨.
> 2.  **문서 생성 로직** (`frontend/components/document-creation/index.tsx`)
>     *   👉 **Manual Merge 필수**
>     *   `feature/text-editor-v2`: `addRowToDocument`, `handleRowDeleted`, `calculateTotals`, `handleEditorChange` 로직 유지.
>     *   `issue/document-upload`: 채팅, 버전 히스토리, UI 레이아웃 관련 로직 유지.
> 3.  **공유 데이터 훅** (`useSharedData.ts`)
>     *   👉 **`feature/text-editor-v2` (Current) 채택**
>     *   이유: 템플릿 Hydration 및 데이터 추출 로직이 개선됨.
> 4.  **채팅/백엔드 파일**
>     *   👉 **`issue/document-upload` (Incoming) 채택**
>     *   이유: 이 브랜치에서는 해당 파일을 건드리지 않음.

---

## 2. 오늘/최근 세션 변경사항 (상세 Diff)

최근 작업에서 **행 동기화(Row Sync)** 및 **자동 계산(Auto-Calculation)** 기능이 완성되었습니다.

### A. 행 동기화 로직 개선 (`index.tsx`)

`addRowToDocument` 함수가 대폭 수정되었습니다.

```typescript
// frontend/components/document-creation/index.tsx

// [변경 전] 인덱스 기반 매핑, 단순 insertBefore
// [변경 후] 이름 기반 매핑, 템플릿 행 감지 개선, insertAfter

const addRowToDocument = (htmlContent: string, fieldIds: string[]): string => {
  // ... (DOMParser 초기화)

  // 1. 템플릿 행 감지 (헤더/Total 행 제외)
  for (let i = rows.length - 1; i >= 0; i--) {
    const text = row.textContent || '';
    const isHeaderRow = text.includes('SENT BY') || text.includes('Bill of Lading') ...;
    const isTotalRow = text.includes('Total ');
    
    if (dataFields.length >= 4 && !isTotalRow && !isHeaderRow) {
      templateRow = row;
      break;
    }
  }

  // 2. 이름 기반 필드 매핑 (Name-Based Mapping)
  fieldIds.forEach(fieldId => {
    const baseName = fieldId.replace(/_\d+$/, '');
    fieldMap.set(baseName, fieldId);
  });

  // 3. 행 삽입 위치 수정 (Append After)
  if (templateRow.nextSibling) {
    templateRow.parentNode?.insertBefore(newRow, templateRow.nextSibling);
  } else {
    templateRow.parentNode?.appendChild(newRow);
  }
  
  // ...
};
```

### B. 자동 계산 로직 (`index.tsx`)

ProseMirror Extension 대신 DOM 기반의 안전한 계산 로직을 구현했습니다.

```typescript
// frontend/components/document-creation/index.tsx

const handleEditorChange = (content: string) => {
  // 1. 자동 계산 실행
  const updatedContent = calculateTotals(content);
  
  // 2. 변경 사항이 있을 경우에만 에디터 업데이트 (무한 루프 방지)
  if (updatedContent !== content && editorRef.current) {
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.setContent(updatedContent);
      }
    }, 0);
  }
  
  // ... (상태 저장)
};

const calculateTotals = (htmlContent: string): string => {
  // DOMParser를 사용하여 quantity, sub_total_price 합산
  // total_quantity, total_price 필드 업데이트
  // ...
};
```

### C. 템플릿 수정 (`templates/*.ts`)

**Offer Sheet (`offerSheet.ts`)**:
- `<tfoot>` 섹션 복구 (Total 행 표시).
- `[total_quantity]`, `[total_price]` 필드 추가.

**Proforma Invoice (`proformaInvoice.ts`)**:
- "Number of pieces" 필드를 `[quantity]` -> `[total_quantity]`로 변경하여 Offer Sheet 총계와 동기화.

---

## 3. 전체 변경 히스토리 (파일별)

### `frontend/components/document-creation/index.tsx`
- **기능:** 문서 생성 페이지 메인 로직.
- **변경 사항:**
  - `initialContent` Memoization 적용 (에디터 리로드 방지).
  - `addRowToDocument`: 행 추가 로직 완전 재작성 (동기화, 매핑, 순서 수정).
  - `handleRowDeleted`: 행 삭제 동기화 핸들러 추가.
  - `handleEditorChange`: 자동 계산(`calculateTotals`) 로직 통합.
  - `handleRowAdded`: 초기 동기화 시 타겟 문서가 없으면 템플릿 Hydrate 후 추가하도록 수정.

### `frontend/components/editor/ContractEditor.tsx`
- **기능:** Tiptap 에디터 컴포넌트.
- **변경 사항:**
  - `createRowDeletionDetector`: 행 삭제 감지 ProseMirror 플러그인 추가.
  - `hasInitialized` Ref 추가: 초기 마운트 시에만 `setContent` 실행 (커서 튐 방지).
  - `AutoCalculation` Extension 제거 (안정성 문제로 `index.tsx`로 이동).

### `frontend/templates/offerSheet.ts`
- **기능:** Offer Sheet 템플릿.
- **변경 사항:**
  - 손상된 HTML 구조 복구.
  - Total 행(`<tfoot>`) 및 하단 Detail Block(`Country of Origin` 등) 복구.

### `frontend/templates/proformaInvoice.ts`
- **기능:** PI 템플릿.
- **변경 사항:**
  - `total_quantity` 필드 매핑 적용.

### `frontend/components/document-creation/hooks/useSharedData.ts`
- **기능:** 데이터 공유 훅.
- **변경 사항:**
  - `hydrateTemplate`: 템플릿 초기화 로직 개선.

---

## 4. 주요 기능별 요약

| 기능 | 상태 | 설명 |
| :--- | :--- | :--- |
| **행 동기화** | ✅ 완료 | Offer Sheet ↔ PI 간 행 추가/삭제가 완벽하게 동기화됨. |
| **자동 계산** | ✅ 완료 | 수량 및 금액 변경 시 Total 행이 즉시 업데이트됨. |
| **에디터 안정성** | ✅ 완료 | 탭 전환 시 내용 초기화, 커서 튐 현상 해결. |
| **템플릿 복구** | ✅ 완료 | Offer Sheet의 깨진 레이아웃 및 누락된 필드 복구. |

---

## 5. 충돌 위험도 분석

| 파일 | 위험도 | 분석 및 해결 가이드 |
| :--- | :--- | :--- |
| `index.tsx` | 🔴 **HIGH** | 두 브랜치 모두 핵심 로직을 수정함. <br> **해결:** `addRowToDocument`, `handleRowDeleted` 등 함수 단위로 `feature/text-editor-v2`의 코드를 덮어씌워야 함. `return` 문이나 UI 렌더링 부분은 `issue/document-upload`를 유지. |
| `ContractEditor.tsx` | 🟡 **MID** | `issue/document-upload` 변경 사항 확인 필요. 기본적으로 이 브랜치 코드를 사용하면 됨. |
| `templates/*.ts` | 🟢 **LOW** | 충돌 가능성 낮음. 이 브랜치 내용 사용. |

---

## 6. Merge 가이드

### 1. Merge 실행
```bash
git checkout merge/trade-ai-assistant
git pull origin merge/trade-ai-assistant
git merge feature/text-editor-v2
```

### 2. 충돌 해결 체크리스트
- [ ] **`index.tsx`**:
    - `addRowToDocument` 함수가 최신 버전(이름 기반 매핑, 헤더 제외 로직)인지 확인.
    - `handleEditorChange` 내부에 `calculateTotals` 호출이 있는지 확인.
    - `handleRowAdded`에서 `hydrateTemplate` 호출 로직이 있는지 확인.
- [ ] **`ContractEditor.tsx`**:
    - `createRowDeletionDetector`가 `extensions` 배열에 포함되어 있는지 확인.
    - `useEffect` 내 `hasInitialized` 체크 로직 확인.
- [ ] **`offerSheet.ts`**:
    - `<tfoot>` 태그가 존재하는지 확인.

### 3. 검증 테스트
1.  Offer Sheet에서 행 추가 -> PI에 반영되는지 확인.
2.  수량/단가 입력 -> Total 자동 계산 확인.
3.  탭 전환 시 데이터 유지 확인.

---

## 7. 전체 커밋 목록 (최신순)

*   `Fix: Improved template row detection and insertion order` (Local)
*   `Fix: Initial row sync issue by hydrating template` (Local)
*   `Fix: Auto-calculation using DOM manipulation` (Local)
*   `Fix: Restored Offer Sheet template structure` (Local)
*   ... (이전 커밋들은 git log 참조)

## 8. 전체 파일 목록
- `frontend/components/document-creation/index.tsx`
- `frontend/components/editor/ContractEditor.tsx`
- `frontend/templates/offerSheet.ts`
- `frontend/templates/proformaInvoice.ts`
- `frontend/components/document-creation/hooks/useSharedData.ts`
