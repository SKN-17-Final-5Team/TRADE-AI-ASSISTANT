# 🚀 Langfuse 프롬프트 버전 관리 가이드

## 📌 개요

이 프로젝트는 Langfuse를 통해 프롬프트를 버전 관리합니다.
**서버 재시작 없이** Langfuse UI에서 프롬프트를 수정하면 즉시 반영됩니다!

---

## 🎯 버전 관리 방법

### 1️⃣ Langfuse UI에서 프롬프트 수정

#### **새 버전 생성**
```
1. https://cloud.langfuse.com 접속
2. 왼쪽 메뉴 Prompts 클릭
3. trade_assistant_v1 선택
4. "+ New version" 버튼 클릭
5. 프롬프트 내용 수정
6. Save 클릭 → 새 버전 생성됨!
```

#### **라벨 설정**
생성된 버전에 라벨을 설정하여 용도를 구분합니다:

- **`production`** - 운영 환경에서 사용할 안정 버전
- **`latest`** - 최신 개발/테스트 버전
- **`staging`** - 스테이징 테스트용
- 커스텀 라벨 직접 생성 가능

---

### 2️⃣ 환경 변수로 버전 제어

`.env` 파일에서 사용할 프롬프트 버전을 제어할 수 있습니다:

#### **기본 설정 (production 라벨 사용)**
```env
# 아무 설정 안 하면 자동으로 production 라벨 사용
```

#### **latest 버전으로 테스트**
```env
PROMPT_LABEL=latest
```

#### **특정 버전 고정**
```env
PROMPT_VERSION=5
# 버전 5로 고정 (라벨 무시)
```

#### **Langfuse 비활성화 (로컬 파일 사용)**
```env
USE_LANGFUSE=false
# backend/agent_core/prompts/trade_instructions.txt 파일 사용
```

---

## 🔄 실전 시나리오

### 시나리오 1: 프롬프트 개선 후 배포

**상황:** 답변 품질을 높이기 위해 새로운 규칙 추가

```
[현재 상태]
버전 1 (production) - 현재 운영 중

[목표]
새 규칙 추가: "답변 시 반드시 출처를 명시하라"
```

**단계:**

1. **Langfuse UI에서 새 버전 생성**
   - Prompts → trade_assistant_v1
   - "+ New version" 클릭
   - 프롬프트 수정 (규칙 추가)
   - Save → **버전 2 생성됨**

2. **테스트 라벨 설정**
   - 버전 2에 **"latest"** 라벨 설정
   - (버전 1은 계속 "production" 유지)

3. **테스트 환경에서 검증**
   ```env
   # .env 파일에 추가
   PROMPT_LABEL=latest
   ```
   - 서버 재시작
   - 테스트 수행 → 버전 2 사용됨

4. **검증 완료 후 배포**
   - Langfuse UI에서 버전 2의 라벨을 **"production"**으로 변경
   - 버전 1의 "production" 라벨은 자동 해제
   - `.env`에서 `PROMPT_LABEL=latest` 제거 (또는 주석)
   - 서버 재시작
   - **완료!** 이제 운영 환경도 버전 2 사용

---

### 시나리오 2: 긴급 롤백

**상황:** 새 버전(v3)에서 문제 발견! 즉시 이전 버전으로 복구 필요

```
[문제 상황]
버전 3 (production) - 답변 품질 저하 발견!

[복구 목표]
안정적이었던 버전 2로 즉시 롤백
```

**즉시 롤백 (30초 컷):**

1. Langfuse UI 접속
2. 버전 2 선택
3. 라벨을 **"production"**으로 변경
4. **완료!** (코드 변경 없음, 서버 재시작 불필요)

또는 긴급 상황 시:
```env
# .env 파일 수정
PROMPT_VERSION=2
```
- 서버 재시작
- 버전 2로 즉시 고정

---

### 시나리오 3: A/B 테스트

**상황:** 두 가지 프롬프트 스타일 성능 비교

```
[목표]
스타일 A (친절한 톤) vs 스타일 B (전문적인 톤)
어느 쪽이 사용자 만족도가 높은지 테스트
```

**설정:**

1. **Langfuse UI에서 2개 버전 생성**
   - 버전 4 생성 → "style_a" 라벨 설정 (친절한 톤)
   - 버전 5 생성 → "style_b" 라벨 설정 (전문적인 톤)

2. **서버 A/B 분리**
   ```env
   # 서버 A
   PROMPT_LABEL=style_a

   # 서버 B
   PROMPT_LABEL=style_b
   ```

3. **성능 측정 후 승자를 production으로 설정**

---

## 📊 버전 관리 Best Practices

### ✅ 권장 워크플로우

```
개발 → 테스트 → 스테이징 → 배포

1. [개발] latest 라벨로 새 버전 생성
2. [테스트] 로컬/개발 환경에서 테스트
   PROMPT_LABEL=latest
3. [스테이징] staging 라벨로 변경 후 스테이징 테스트
   PROMPT_LABEL=staging
4. [배포] production 라벨로 변경
   (기본값이므로 .env 설정 불필요)
```

### 🏷️ 라벨 컨벤션

- **production** - 운영 배포 버전 (항상 안정적이어야 함)
- **latest** - 최신 개발 버전 (실험적 기능 포함 가능)
- **staging** - 배포 전 최종 검증용
- **rollback** - 긴급 롤백용 안전 버전 (이전 안정 버전에 설정)

### 📝 버전 설명 작성

Langfuse UI에서 각 버전에 설명을 작성하여 변경 사항 추적:

```
버전 2: "출처 명시 규칙 추가"
버전 3: "HS CODE 질문 규칙 개선"
버전 4: "웹 검색 조건 확대"
```

---

## 🛠️ 코드 레벨 사용법

일반적으로 환경 변수로 제어하지만, 특수한 경우 코드에서 직접 지정 가능:

### 기본 사용
```python
from agent_core.trade_agent import get_trade_agent

# production 라벨 사용 (기본값)
agent = get_trade_agent()
```

### 특정 라벨 사용
```python
# latest 버전으로 테스트
agent = get_trade_agent(prompt_label="latest")

# 커스텀 라벨
agent = get_trade_agent(prompt_label="experiment_v1")
```

### 특정 버전 번호 고정
```python
# 항상 버전 5 사용 (라벨 무시)
agent = get_trade_agent(prompt_version=5)
```

### Langfuse 비활성화
```python
# 로컬 파일 사용
agent = get_trade_agent(use_langfuse=False)
```

---

## 🔍 트러블슈팅

### ❓ 프롬프트가 변경되지 않아요

**원인:** 환경 변수로 특정 버전이 고정되어 있을 수 있습니다.

**해결:**
```env
# .env 파일 확인
PROMPT_VERSION=5  # ← 이 줄 주석 처리
# PROMPT_VERSION=5
```

### ❓ Langfuse 연결 실패

**원인:** API 키가 잘못되었거나 네트워크 문제

**해결:**
1. `.env` 파일에서 API 키 확인
2. 테스트 스크립트 실행:
   ```bash
   cd backend
   python test_langfuse_simple.py
   ```
3. 실패 시 로컬 파일 모드로 전환:
   ```env
   USE_LANGFUSE=false
   ```

### ❓ 어떤 버전을 사용 중인지 확인하려면?

서버 시작 시 로그에 출력됩니다:
```
✅ Langfuse에서 프롬프트 로드: trade_assistant_v1 (label: production, 버전: 3)
```

---

## 📚 참고 자료

- [Langfuse 공식 문서](https://langfuse.com/docs)
- [Langfuse Prompt Management](https://langfuse.com/docs/prompts)
- 프로젝트 파일:
  - `backend/agent_core/trade_agent.py` - Agent 정의
  - `backend/chat/views.py` - API 뷰
  - `backend/chat/config.py` - 프롬프트 설정

---

## 💡 팁

1. **프롬프트 변경은 작은 단위로**
   - 한 번에 여러 규칙을 바꾸지 말고, 하나씩 변경하여 효과 측정

2. **안전 버전 유지**
   - 안정적인 버전에 "rollback" 라벨을 설정해두면 긴급 상황에 유용

3. **버전 설명 필수**
   - 무엇을 바꿨는지 Langfuse UI에서 설명 작성

4. **로컬 파일 백업**
   - Langfuse 장애에 대비해 `trade_instructions.txt`도 Git에 유지

5. **주기적인 버전 정리**
   - 오래된/사용하지 않는 버전은 주기적으로 정리
