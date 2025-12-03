# 공통 필드 매핑 버그 수정 계획서

> **작성일**: 2025-12-03
> **목적**: 같은 문서 내 및 다른 문서 간 공통 필드 실시간 동기화 버그 수정

---

## 1. 현상 (Problem)

### 1.1 버그 증상

**같은 문서 내 동일 필드가 서로 다른 값을 가짐**

```
Offer Sheet 예시:
┌─────────────────────────────────────┐
│ [seller_name] → "Hoonie Inc."       │  ← 사용자가 수정
│ ...                                 │
│ ...                                 │
│ [seller_name] → "Korea Trading Co." │  ← 동기화 안 됨!
└─────────────────────────────────────┘
```

### 1.2 기대 동작

```
같은 문서 내:
  - seller_name (위) 수정 → seller_name (아래) 즉시 동일 값

다른 문서 간:
  - Offer Sheet의 buyer_name 수정 → PI, Contract, CI, PL의 buyer_name 동기화
```

---

## 2. 원인 분석 (Root Cause)

### 2.1 현재 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    sharedData (상태)                         │
│         { seller_name: "...", buyer_name: "...", ... }      │
└─────────────────────────────────────────────────────────────┘
        ↑                                    ↓
   extractData()                    updateContentWithSharedData()
   (저장/스텝이동 시)                  (스텝 진입 시 initialContent)
        │                                    │
┌───────┴───────┐                   ┌────────┴────────┐
│ ContractEditor │                   │ ContractEditor  │
│   (현재 스텝)   │                   │   (다음 스텝)    │
└───────────────┘                   └─────────────────┘
```

### 2.2 문제점 상세

#### 문제 1: 같은 문서 내 실시간 동기화 없음

```typescript
// ContractEditor onChange
onChange={(content) => {
  setDocumentData({...});  // 저장만 함
  // 같은 문서 내 동일 필드 동기화 로직 없음!
}}
```

- 사용자가 필드 A를 수정해도, 같은 문서 내 필드 A'는 변경되지 않음
- 에디터가 DOM을 직접 관리하므로 외부에서 개입하기 어려움

#### 문제 2: extractData()의 덮어쓰기 로직

```typescript
// extractData (line 180-199)
fields.forEach(field => {
  const key = field.getAttribute('data-field-id');
  const value = field.textContent;
  if (key && value && value !== `[${key}]`) {
    newData[key] = value;  // 마지막 값으로 덮어씀!
  }
});
```

- 같은 `seller_name`이 2개 있고 값이 다르면, **마지막 값만 저장**
- 어떤 값이 "정답"인지 판단 로직 없음

#### 문제 3: updateContentWithSharedData() 호출 시점

```typescript
// ContractEditor initialContent에서만 호출
initialContent={
  updateContentWithSharedData(...)
}
```

- **스텝 변경 시에만** 동기화 수행
- 같은 스텝 내에서는 동기화 없음
- 에디터가 이미 마운트된 후에는 initialContent 변경이 반영되지 않음

---

## 3. 해결 방안

### 3.1 방안 비교

| 방안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **A. 에디터 레벨 동기화** | Tiptap 트랜잭션에서 동일 필드 동기화 | 실시간, 정확함 | 복잡, 에디터 내부 수정 필요 |
| **B. onChange 디바운스 동기화** | onChange 후 디바운스로 전체 동기화 | 구현 간단 | 약간의 지연, 커서 위치 문제 |
| **C. blur 시점 동기화** | 필드에서 포커스 벗어날 때 동기화 | 자연스러운 UX | blur 이벤트 감지 필요 |
| **D. 하이브리드** | A + 저장 시 검증 | 완벽한 동기화 | 구현 복잡도 높음 |

### 3.2 권장 방안: A. 에디터 레벨 동기화

**이유**:
- 실시간 동기화로 UX 최적
- 커서 위치/선택 영역 유지 가능
- Tiptap의 트랜잭션 시스템 활용

---

## 4. 상세 구현 계획

### 4.1 수정 대상 파일

| 파일 | 수정 내용 |
|------|----------|
| `frontend/components/editor/ContractEditor.tsx` | DataFieldNode 동기화 로직 추가 |
| `frontend/components/DocumentCreationPage.tsx` | extractData 로직 개선 (선택) |

### 4.2 ContractEditor.tsx 수정

#### 4.2.1 DataFieldNode에 동기화 Extension 추가

```typescript
// 새로운 Extension: FieldSyncExtension
const FieldSyncExtension = Extension.create({
  name: 'fieldSync',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, oldState, newState) {
          // 트랜잭션에서 DataFieldNode 변경 감지
          // 같은 fieldId를 가진 모든 노드에 동일 값 적용
        }
      })
    ]
  }
})
```

#### 4.2.2 동기화 로직 상세

```typescript
appendTransaction(transactions, oldState, newState) {
  // 1. 변경된 DataFieldNode 찾기
  let changedFields: { fieldId: string, newValue: string }[] = [];

  transactions.forEach(tr => {
    if (!tr.docChanged) return;

    // 변경된 노드 중 DataFieldNode 찾기
    tr.steps.forEach((step, i) => {
      // step에서 변경된 DataFieldNode의 fieldId와 새 값 추출
    });
  });

  if (changedFields.length === 0) return null;

  // 2. 같은 fieldId를 가진 다른 노드들 찾기
  const tr = newState.tr;
  let modified = false;

  changedFields.forEach(({ fieldId, newValue }) => {
    newState.doc.descendants((node, pos) => {
      if (node.type.name === 'dataFieldNode' &&
          node.attrs.fieldId === fieldId &&
          node.textContent !== newValue) {
        // 3. 값 동기화
        tr.replaceWith(pos + 1, pos + node.nodeSize - 1,
          newState.schema.text(newValue));
        modified = true;
      }
    });
  });

  return modified ? tr : null;
}
```

### 4.3 DocumentCreationPage.tsx 수정 (선택)

#### 4.3.1 extractData 개선

현재: 마지막 값으로 덮어씀
개선: 첫 번째 비어있지 않은 값 사용 (또는 가장 최근 수정된 값)

```typescript
const extractData = (content: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const fields = doc.querySelectorAll('span[data-field-id]');

  const newData: Record<string, string> = {};
  fields.forEach(field => {
    const key = field.getAttribute('data-field-id');
    const value = field.textContent;

    if (key && value && value !== `[${key}]`) {
      // 이미 값이 있으면 덮어쓰지 않음 (첫 번째 값 유지)
      // 또는 에디터에서 이미 동기화되었으므로 모든 값이 같아야 함
      if (!newData[key]) {
        newData[key] = value;
      }
    }
  });

  if (Object.keys(newData).length > 0) {
    setSharedData(prev => ({ ...prev, ...newData }));
  }
};
```

---

## 5. 구현 단계

### Phase 1: 에디터 내 동기화 (핵심)

| 순서 | 작업 | 예상 영향도 |
|------|------|------------|
| 1-1 | FieldSyncExtension 생성 | ContractEditor.tsx |
| 1-2 | DataFieldNode 변경 감지 로직 | ContractEditor.tsx |
| 1-3 | 동일 fieldId 노드 동기화 로직 | ContractEditor.tsx |
| 1-4 | 에디터에 Extension 등록 | ContractEditor.tsx |

### Phase 2: 검증 및 보완

| 순서 | 작업 | 예상 영향도 |
|------|------|------------|
| 2-1 | extractData 첫 번째 값 유지 로직 | DocumentCreationPage.tsx |
| 2-2 | 테스트: 같은 문서 내 동기화 | - |
| 2-3 | 테스트: 다른 문서 간 동기화 | - |

---

## 6. 테스트 케이스

### 6.1 같은 문서 내 동기화

```
TC-1: 기본 동기화
1. Offer Sheet 열기
2. 위쪽 seller_name에 "ABC Company" 입력
3. 확인: 아래쪽 seller_name도 "ABC Company"로 변경됨

TC-2: 역방향 동기화
1. Offer Sheet 열기
2. 아래쪽 seller_name에 "XYZ Corp" 입력
3. 확인: 위쪽 seller_name도 "XYZ Corp"로 변경됨

TC-3: 수정 동기화
1. TC-1 완료 후
2. 위쪽 seller_name을 "New Company"로 수정
3. 확인: 아래쪽도 "New Company"로 변경됨
```

### 6.2 다른 문서 간 동기화

```
TC-4: 스텝 간 동기화
1. Offer Sheet에서 buyer_name = "Global Import" 입력
2. 저장
3. PI로 이동
4. 확인: PI의 buyer_name이 "Global Import"로 매핑됨

TC-5: 역방향 스텝 동기화
1. TC-4 완료 후
2. PI에서 buyer_name을 "Local Import"로 수정
3. 저장 후 Offer Sheet로 이동
4. 확인: Offer Sheet의 buyer_name도 "Local Import"로 변경됨
```

---

## 7. 롤백 계획

문제 발생 시:

```bash
# ContractEditor.tsx만 롤백
git checkout HEAD~1 -- frontend/components/editor/ContractEditor.tsx

# 전체 롤백
git revert HEAD
```

---

## 8. 예상 위험 및 대응

| 위험 | 가능성 | 대응 |
|------|--------|------|
| 무한 루프 (A 변경 → B 변경 → A 변경...) | 중간 | 변경 source 체크로 방지 |
| 커서 위치 이동 | 낮음 | 현재 선택 영역 외 노드만 수정 |
| 성능 저하 (많은 필드) | 낮음 | 디바운스 또는 변경된 fieldId만 처리 |
| Undo/Redo 동작 이상 | 중간 | 트랜잭션 단위로 처리 |

---

## 9. 참고: 현재 코드 위치

| 함수/컴포넌트 | 파일 | 라인 |
|--------------|------|------|
| `extractData` | DocumentCreationPage.tsx | 180-199 |
| `updateContentWithSharedData` | DocumentCreationPage.tsx | 202-225 |
| `hydrateTemplate` | DocumentCreationPage.tsx | 165-177 |
| `DataFieldNode` | ContractEditor.tsx | 14-95 |
| `ContractEditor` | ContractEditor.tsx | 400+ |

---

*계획서 작성 완료*
