# 버그 리포트: "답변 생성중..." 로딩 표시 안 보임

**작성일**: 2024-12-05
**상태**: 수정 예정
**관련 파일**:
- `frontend/components/ChatAssistant.tsx`
- `frontend/components/ChatPage.tsx`

---

## 문제 현상

- **문서 채팅 (ChatAssistant.tsx)**: "답변 생성중..." 로딩이 거의 안 보임
- **일반 채팅 (ChatPage.tsx)**: 잠깐 보이다가 사라짐 (타이밍에 따라 다름)

---

## 원인 분석

### 1. 코드 흐름

```
사용자 메시지 전송
    │
    ├─ 1. setMessages([..., userMessage])  ← 마지막: user
    ├─ 2. setIsLoading(true)
    ├─ 3. await fetch(API)                 ← 서버 응답 대기
    ├─ 4. reader = response.body.getReader()
    └─ 5. setMessages([..., aiMessage])    ← 마지막: ai (빈 content)
              │
              └─ 이 시점부터 로딩 안 보임!
```

### 2. 로딩 표시 조건 (문제)

```javascript
// ChatAssistant.tsx:744, ChatPage.tsx:354
{isLoading && messages.length > 0 && messages[messages.length - 1].type === 'user' && (...)}
```

- 5번 단계에서 빈 AI 메시지가 추가되면 `messages[messages.length - 1].type`이 `'ai'`가 됨
- 조건이 `false`가 되어 로딩이 사라짐
- **실제 AI 응답 텍스트가 오기 전에** 로딩이 사라지는 버그

### 3. 일반 채팅 vs 문서 채팅 차이

| 항목 | 일반 채팅 | 문서 채팅 |
|------|----------|----------|
| init 전송 전 처리 | GenChat 생성, 히스토리, **Mem0 로드** | Document 조회만 |
| 첫 응답까지 시간 | 느림 (Mem0 외부 API 호출) | 빠름 |
| 로딩 보임? | 잠깐 보임 (3번 단계에서) | 거의 안 보임 |

일반 채팅은 Mem0 로드 시간 덕분에 **우연히** 로딩이 보이는 것이고, 본질적으로 **둘 다 같은 버그**가 있음.

---

## 해결 방법

### 수정할 파일

1. `frontend/components/ChatAssistant.tsx` (문서 채팅) - 744번 라인
2. `frontend/components/ChatPage.tsx` (일반 채팅) - 354번 라인

### 수정 내용

**기존 (문제)**
```javascript
{isLoading && messages.length > 0 && messages[messages.length - 1].type === 'user' && (...)}
```

**수정 (해결)**
```javascript
{isLoading && messages.length > 0 && (
  messages[messages.length - 1].type === 'user' ||
  (messages[messages.length - 1].type === 'ai' && !messages[messages.length - 1].content)
) && (...)}
```

### 수정 이유

| 조건 | 상황 | 로딩 표시 |
|------|------|----------|
| 마지막이 `user` | 아직 AI 메시지가 추가 안 됨 | ✅ 표시 |
| 마지막이 `ai` + **content 없음** | 빈 AI 메시지만 추가됨 | ✅ 표시 |
| 마지막이 `ai` + **content 있음** | 실제 응답 수신 중 | ❌ 안 보임 |

---

## 수정 후 예상 동작

```
1. 사용자 메시지 전송 → 로딩 표시 ✅
2. 빈 AI 메시지 추가 → 로딩 계속 표시 ✅
3. 첫 텍스트 수신 (content 채워짐) → 로딩 사라짐, 텍스트 표시 ✅
```

---

## 테스트 체크리스트

- [ ] 문서 채팅에서 "답변 생성중..." 표시 확인
- [ ] 일반 채팅에서 "답변 생성중..." 표시 확인
- [ ] 실제 텍스트 수신 시 로딩 사라지고 텍스트 표시 확인
- [ ] 빠른 응답/느린 응답 모두 테스트
