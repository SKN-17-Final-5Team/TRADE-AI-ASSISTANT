# TRADE-AI-ASSISTANT
[로그인페이지데모](./img/login_small.gif)

AI 기반 무역 문서 관리 및 생성 시스템

## 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| Framework | React | 18.2.0 |
| Language | TypeScript | 5.2.2 |
| Build Tool | Vite | 4.x |
| Styling | Tailwind CSS | 3.3.3 |
| UI Components | shadcn/ui | - |
| Rich Text Editor | Tiptap | 3.11.0 |
| PDF Viewer | react-pdf | 10.2.0 |
| Icons | lucide-react | 0.554.0 |

## 프로젝트 구조

```
TRADE-AI-ASSISTANT/
├── src/
│   └── main.tsx              # React 앱 진입점
├── components/
│   ├── editor/               # 리치 텍스트 에디터
│   │   ├── ContractEditor.tsx    # Tiptap 기반 문서 에디터
│   │   ├── EditorToolbar.tsx     # 에디터 툴바
│   │   └── editor.css            # 에디터 스타일
│   ├── ui/                   # shadcn/ui 컴포넌트 (60+)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── App.tsx               # 루트 컴포넌트 (인증, 라우팅)
│   ├── LoginPage.tsx         # 로그인 페이지
│   ├── MainPage.tsx          # 대시보드 (메인 페이지)
│   ├── ChatPage.tsx          # AI 채팅 페이지
│   ├── ChatAssistant.tsx     # 사이드바 AI 어시스턴트
│   ├── DocumentCreationPage.tsx  # 문서 생성 페이지
│   ├── StepSelector.tsx      # 단계 선택 컴포넌트
│   ├── OthersDocumentViewer.tsx  # PDF 뷰어/업로더
│   ├── SalesContractTemplate.tsx # 매매계약서 템플릿
│   └── CommercialInvoiceTemplate.tsx # 상업송장 템플릿
├── templates/
│   └── saleContract.ts       # HTML 기반 계약서 템플릿
├── styles/
│   └── globals.css           # 전역 스타일 (Tailwind + CSS 변수)
├── index.html                # HTML 진입점
├── vite.config.ts            # Vite 설정
├── tailwind.config.cjs       # Tailwind 설정
├── tsconfig.json             # TypeScript 설정
└── package.json              # 의존성 및 스크립트
```

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:5173)
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 미리보기
npm run preview

# node_modules 삭제
rm -rf node_modules package-lock.json && npm install

# npm install 후 다시 실행
npm run dev
```

## 주요 기능

### 1. 로그인
- 사번 기반 인증
- 초기 비밀번호: `a123456!`
- 마이페이지에서 비밀번호 변경 가능

### 2. 대시보드 (MainPage)
- 작업 목록 조회 (완료/진행중 상태)
- 검색 및 필터링 (상태, 유형별)
- 새 작업 생성 (문서 또는 채팅)

### 3. AI 채팅 (ChatPage)
- 무역 관련 질의응답
- LC (신용장), BL (선하증권), PI (견적송장) 등 지원
- 웹 검색 시뮬레이션

### 4. 문서 생성 (DocumentCreationPage)
7단계 + 기타 문서 워크플로우:

| 단계 | 문서 유형 |
|------|----------|
| 1 | Offer Sheet (Offer) |
| 2 | Purchase Order (PO) |
| 3 | Proforma Invoice (PI) |
| 4 | Sales Contract (매매계약서) |
| 5 | Commercial Invoice (CI) |
| 6 | Packing List |
| 7 | Bill of Lading (BL) |
| 8 | Letter of Credit (LC) |
| 9 | Others (기타 문서) |

### 5. 리치 텍스트 에디터
- 테이블 생성 및 편집
- 텍스트 서식 (굵게, 기울임, 밑줄, 하이라이트)
- 텍스트 정렬
- 제목 레벨 (H1-H4)

### 6. PDF 뷰어
- PDF 파일 업로드
- 문서 미리보기
- 파일 관리 (업로드/삭제)

## 페이지 흐름

```
LoginPage → MainPage ─┬→ ChatPage (AI 채팅)
                      └→ DocumentCreationPage (문서 생성)
                           ├→ ContractEditor + ChatAssistant (1-8단계)
                           └→ OthersDocumentViewer (9단계: PDF)
```

## 컴포넌트 계층 구조

```
App (Root)
├── LoginPage
└── [Authenticated]
    ├── MainPage
    │   ├── Header (로고, 사용자 정보)
    │   ├── TaskCards (작업 목록)
    │   └── Filters & Search
    ├── ChatPage
    │   ├── MessageList
    │   └── InputForm
    └── DocumentCreationPage
        ├── StepSelector (단계 탭)
        ├── ContractEditor (좌측)
        │   ├── EditorToolbar
        │   └── TiptapEditor
        ├── ChatAssistant (우측, 리사이즈 가능)
        └── OthersDocumentViewer (9단계)
```

## 참고 사항

- **Frontend-only**: 현재 백엔드 API 미연동 상태
- **Mock 데이터**: 모든 데이터는 하드코딩 또는 시뮬레이션
- **데이터 비영속성**: 페이지 새로고침 시 데이터 초기화
- **AI 응답**: 템플릿 기반 시뮬레이션 (실제 AI 미연동)

## AI 문서 수정 기능 (기술 구현)

ChatAssistant에서 "문서에 적용하기" 버튼을 누르면 AI가 제안한 내용이 에디터에 반영됩니다.

### 작동 원리

```
┌─────────────────────────────────────────────────────────┐
│                  DocumentCreationPage                    │
│                                                         │
│   const editorRef = useRef<ContractEditorRef>(null)     │
│                                                         │
│   ┌─────────────────┐      ┌─────────────────┐         │
│   │ ContractEditor  │      │  ChatAssistant  │         │
│   │   ref={editorRef}│      │ editorRef={...} │         │
│   └────────┬────────┘      └────────┬────────┘         │
│            │                        │                   │
└────────────│────────────────────────│───────────────────┘
             │                        │
             ▼                        ▼
        에디터 인스턴스 ◄─────── AI가 조작
```

### 핵심 코드

**1. 에디터 인스턴스 공유 (ref)**

```typescript
// DocumentCreationPage.tsx
const editorRef = useRef<ContractEditorRef>(null);

<ContractEditor ref={editorRef} />
<ChatAssistant editorRef={editorRef} />
```

**2. Tiptap Programmatic API**

```typescript
// ContractEditor.tsx - useImperativeHandle로 외부에 API 노출
useImperativeHandle(ref, () => ({
  getContent: () => editor?.getHTML(),        // 현재 내용 가져오기
  setContent: (html) => editor?.commands.setContent(html),  // 내용 교체
  insertContent: (html) => editor?.commands.insertContent(html),  // 삽입
}));
```

**3. AI 응답 → 에디터 적용**

```typescript
// ChatAssistant.tsx
const applyToEditor = (html: string) => {
  editorRef.current?.setContent(html);  // AI가 생성한 HTML을 에디터에 적용
};
```

### 데이터 흐름

```
1. 사용자: "Buyer를 삼성전자로 바꿔줘"
           │
           ▼
2. ChatAssistant: editorRef.current.getContent()로 현재 문서 가져옴
           │
           ▼
3. OpenAI API: 현재 문서 + 사용자 요청 → 수정된 HTML 반환
           │
           ▼
4. "문서에 적용하기" 버튼 클릭
           │
           ▼
5. applyToEditor(html) → editorRef.current.setContent(html)
           │
           ▼
6. ContractEditor: 화면에 수정된 내용 반영
```

### 환경 설정

```bash
# .env 파일 생성
VITE_OPENAI_API_KEY=sk-your-api-key
```

## 라이선스

- UI 컴포넌트: [shadcn/ui](https://ui.shadcn.com/)
- 이미지: [Unsplash](https://unsplash.com/)
