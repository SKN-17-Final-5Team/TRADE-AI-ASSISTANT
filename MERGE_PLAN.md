# 브랜치 머지 계획서

> **작성일**: 2025-12-03
> **목적**: `feature/version_control_v1` 브랜치를 `temp/version-control-merge` 브랜치에 통합
> **작성자**: AI Assistant

---

## 1. 개요

### 1.1 브랜치 정보

| 구분 | 브랜치명 | 공통 조상 커밋 |
|------|---------|---------------|
| 현재 브랜치 (BASE) | `temp/version-control-merge` | `deb11c8` |
| 원격 브랜치 (MERGE) | `origin/feature/version_control_v1` | `deb11c8` |

### 1.2 각 브랜치의 목적

| 브랜치 | 주요 작업 내용 |
|--------|---------------|
| **temp/version-control-merge** | Langfuse 프롬프트 관리, S3 문서 업로드, PDF 파싱, 에이전트/챗봇 기능 |
| **feature/version_control_v1** | 문서 버전 히스토리 UI, 에디터 확장, UI 개선 |

### 1.3 머지 원칙

1. **백엔드 전체**: 현재 브랜치 기준 (원격 브랜치는 백엔드 변경 없음)
2. **S3 업로드/PDF 뷰어**: 현재 브랜치 기준
3. **에이전트/챗봇**: 현재 브랜치 기준
4. **버전 히스토리 UI**: 원격 브랜치에서 가져옴
5. **충돌 파일**: 수동으로 양쪽 기능 통합

---

## 2. 파일별 상세 분석

### 2.1 충돌 없이 그대로 유지할 파일 (현재 브랜치)

백엔드 및 핵심 기능 파일들 - **변경 없이 유지**

```
backend/
├── agent_core/
│   ├── __init__.py
│   ├── agents.py              # 에이전트 로직
│   ├── collection_manager.py
│   ├── config.py
│   ├── langfuse_config.py     # Langfuse 프롬프트 관리 (신규)
│   ├── pdf_parser.py          # PDF 파싱 (신규)
│   ├── s3_utils.py            # S3 업로드 (신규)
│   ├── trade_agent.py
│   ├── prompts/
│   │   ├── fallback.py        # (신규)
│   │   └── trade_instructions.txt
│   └── tools/
│       ├── search_tool.py     # (신규)
│       └── web_search_tool.py
├── chat/
│   ├── apps.py
│   ├── config.py              # (신규)
│   └── views.py
├── documents/
│   ├── migrations/0001_initial.py
│   ├── models.py
│   ├── serializers.py         # (신규)
│   ├── services.py            # (신규)
│   ├── urls.py                # (신규)
│   └── views.py
├── config/
│   ├── settings.py
│   └── urls.py
├── requirements.txt           # (신규)
├── scripts/setup_s3_cors.py   # (신규)
└── test_prompt_version.py     # (신규)

frontend/
├── components/
│   ├── ChatAssistant.tsx      # 에이전트 연동 (documentId prop 포함)
│   └── PdfViewer.tsx          # PDF 뷰어 (신규)
├── utils/
│   └── documentApi.ts         # S3 업로드 API (신규)
├── package-lock.json
└── vite.config.ts
```

### 2.2 원격 브랜치에서 가져올 파일 (신규 파일)

```
frontend/components/VersionHistorySidebar.tsx  # 버전 히스토리 사이드바 (264줄)
```

### 2.3 충돌 예상 파일 (수동 머지 필요)

| 파일 | 현재 브랜치 변경 | 원격 브랜치 변경 | 머지 방향 |
|------|-----------------|-----------------|----------|
| `frontend/components/DocumentCreationPage.tsx` | +210/-61 | +515/-309 | 수동 통합 |
| `frontend/App.tsx` | 변경 없음 | +99줄 (버전 관리) | 원격 기준 + 검증 |
| `frontend/package-lock.json` | 변경됨 | 변경됨 | npm install로 재생성 |

---

## 3. DocumentCreationPage.tsx 상세 머지 가이드

### 3.1 현재 브랜치에서 유지해야 할 코드

#### Import 섹션
```tsx
// 반드시 유지
import { uploadDocumentFlow, DocumentStatus } from '../utils/documentApi';
import PdfViewer from './PdfViewer';
import { AlertCircle, Loader2 } from 'lucide-react';  // 아이콘
```

#### State 섹션 (반드시 유지)
```tsx
// S3 업로드 상태 관리 - 반드시 유지
const [uploadedDocumentIds, setUploadedDocumentIds] = useState<Record<number, number | null>>({});
const [uploadedDocumentUrls, setUploadedDocumentUrls] = useState<Record<number, string | null>>({});
const [uploadStatus, setUploadStatus] = useState<Record<number, 'idle' | 'uploading' | 'processing' | 'ready' | 'error'>>({});
const [uploadError, setUploadError] = useState<Record<number, string | null>>({});
const [uploadUnsubscribe, setUploadUnsubscribe] = useState<Record<number, (() => void) | null>>({});
```

#### 함수 섹션 (반드시 유지)
```tsx
// handleFileUpload 함수 전체 (583-623줄)
const handleFileUpload = async (step: number, file: File) => {
  setUploadedFiles(prev => ({ ...prev, [step]: file }));
  setUploadStatus(prev => ({ ...prev, [step]: 'uploading' }));
  setUploadError(prev => ({ ...prev, [step]: null }));

  const documentType = step === 1 ? 'offer_sheet' : 'sales_contract';

  try {
    const unsubscribe = await uploadDocumentFlow(file, documentType, {
      onPresignedUrl: (data) => {
        setUploadedDocumentIds(prev => ({ ...prev, [step]: data.document_id }));
      },
      onS3UploadComplete: () => {},
      onProcessingStart: () => {
        setUploadStatus(prev => ({ ...prev, [step]: 'processing' }));
      },
      onStatus: (status: DocumentStatus) => {
        console.log(`Document ${status.document_id} status: ${status.status} - ${status.message}`);
      },
      onComplete: (status: DocumentStatus) => {
        setUploadStatus(prev => ({ ...prev, [step]: 'ready' }));
        setUploadedDocumentUrls(prev => ({ ...prev, [step]: status.s3_url || null }));
      },
      onError: (error: string) => {
        setUploadStatus(prev => ({ ...prev, [step]: 'error' }));
        setUploadError(prev => ({ ...prev, [step]: error }));
      }
    });
    setUploadUnsubscribe(prev => ({ ...prev, [step]: unsubscribe }));
  } catch (error) {
    setUploadStatus(prev => ({ ...prev, [step]: 'error' }));
    setUploadError(prev => ({ ...prev, [step]: error instanceof Error ? error.message : '업로드 실패' }));
  }
};

// removeUploadedFile 함수 전체 (625-641줄)
const removeUploadedFile = (step: number) => {
  if (uploadUnsubscribe[step]) {
    uploadUnsubscribe[step]?.();
    setUploadUnsubscribe(prev => ({ ...prev, [step]: null }));
  }
  setUploadedFiles(prev => {
    const newFiles = { ...prev };
    delete newFiles[step];
    return newFiles;
  });
  setUploadedDocumentIds(prev => ({ ...prev, [step]: null }));
  setUploadedDocumentUrls(prev => ({ ...prev, [step]: null }));
  setUploadStatus(prev => ({ ...prev, [step]: 'idle' }));
  setUploadError(prev => ({ ...prev, [step]: null }));
};
```

#### 챗봇 버튼 표시 조건 (반드시 유지)
```tsx
const shouldShowChatButton = !isChatOpen && currentStep >= 1 && currentStep <= 5 && (
  (currentStep === 2) ||
  ((currentStep === 1 || currentStep === 3) && stepModes[currentStep] && stepModes[currentStep] !== 'skip' && (
    (stepModes[currentStep] === 'manual') ||
    (stepModes[currentStep] === 'upload' && uploadStatus[currentStep] === 'ready')  // 'ready' 상태 체크
  )) ||
  (currentStep === 4 && activeShippingDoc)
);
```

#### Upload UI 렌더링 (반드시 유지 - 786-940줄)
```tsx
// 2. Upload UI
if ((currentStep === 1 || currentStep === 3) && stepModes[currentStep] === 'upload') {
  const file = uploadedFiles[currentStep];
  const status = uploadStatus[currentStep] || 'idle';
  const documentUrl = uploadedDocumentUrls[currentStep];
  const error = uploadError[currentStep];

  // ready 상태: PdfViewer 렌더링
  if (status === 'ready' && documentUrl) {
    return (
      <div className="h-full flex flex-col">
        {/* ... 헤더 버튼 ... */}
        <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
          <PdfViewer fileUrl={documentUrl} className="h-full" />
        </div>
      </div>
    );
  }

  // uploading/processing 상태: 로딩 스피너
  if (status === 'uploading' || status === 'processing') {
    return (
      <div className="h-full flex flex-col p-4">
        {/* Loader2 스피너 + 상태 메시지 */}
      </div>
    );
  }

  // error 상태: 오류 메시지 + 재시도
  if (status === 'error') {
    return (
      <div className="h-full flex flex-col p-4">
        {/* AlertCircle + 오류 메시지 */}
      </div>
    );
  }

  // idle 상태: 파일 업로드 UI
  // ...
}
```

#### ChatAssistant 컴포넌트 (반드시 유지)
```tsx
<ChatAssistant
  currentStep={currentStep}
  onClose={toggleChat}
  editorRef={editorRef}
  onApply={handleChatApply}
  documentId={stepModes[currentStep] === 'upload' ? uploadedDocumentIds[currentStep] : null}  // 필수!
/>
```

### 3.2 원격 브랜치에서 가져와야 할 코드

#### Import 추가
```tsx
import VersionHistorySidebar, { Version } from './VersionHistorySidebar';
import { Clock } from 'lucide-react';
```

#### Props 확장
```tsx
interface DocumentCreationPageProps {
  // 기존 props...
  onSave: (data: DocumentData, step: number, activeShippingDoc?: 'CI' | 'PL' | null) => void;  // 수정
  versions?: Version[];           // 추가
  onRestore?: (version: Version) => void;  // 추가
  initialActiveShippingDoc?: 'CI' | 'PL' | null;  // 추가
}
```

#### State 추가
```tsx
const [showVersionHistory, setShowVersionHistory] = useState(false);
const [uploadedFileNames, setUploadedFileNames] = useState<Record<number, string>>({});
```

#### VersionHistorySidebar 컴포넌트 추가 (JSX)
```tsx
{/* Version History Sidebar - MappedDataConfirmBanner 다음에 추가 */}
<VersionHistorySidebar
  isOpen={showVersionHistory}
  onClose={() => setShowVersionHistory(false)}
  versions={versions}
  currentStep={currentStep}
  onRestore={(version) => {
    if (onRestore) {
      onRestore(version);
      setShowVersionHistory(false);
      const step = version.step;
      if (step <= 3) {
        setCurrentStep(step);
        setStepModes(prev => ({ ...prev, [step]: 'manual' }));
      } else {
        setCurrentStep(4);
        if (step === 4) setActiveShippingDoc('CI');
        if (step === 5) setActiveShippingDoc('PL');
      }
    }
  }}
/>
```

#### 버전 기록 버튼 추가 (헤더에)
```tsx
{/* Version History Button - 다운로드 버튼 다음에 추가 */}
<button
  onClick={() => setShowVersionHistory(true)}
  className="text-gray-600 hover:text-blue-600 text-sm flex items-center gap-1 transition-colors group relative"
  title="버전 기록"
>
  <Clock className="w-4 h-4" />
  버전 기록
  {versions.filter(v => v.step === currentStep).length > 0 && (
    <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />
  )}
</button>
```

#### handleSave 함수 수정
```tsx
const handleSave = () => {
  if (editorRef.current) {
    const content = editorRef.current.getContent();
    const extractedData = extractData(content);
    const currentSharedData = { ...sharedData, ...extractedData };

    let saveKey = -1;
    if (currentStep <= 3) saveKey = currentStep;
    else {
      saveKey = getDocKeyForStep(currentStep);
    }

    const updatedDocData = {
      ...documentData,
      [saveKey]: content,
      stepModes: stepModes,
      uploadedFileNames: Object.entries(uploadedFiles).reduce((acc, [key, file]) => {
        if (file) acc[Number(key)] = file.name;
        return acc;
      }, {} as Record<number, string>)
    };

    setDocumentData(updatedDocData);
    onSave(updatedDocData, currentStep, activeShippingDoc);  // activeShippingDoc 추가
  } else {
    onSave(documentData, currentStep, activeShippingDoc);
  }
  setIsDirty(false);
  setShowSaveSuccessModal(true);
};
```

---

## 4. App.tsx 머지 가이드

### 4.1 원격 브랜치 기준으로 교체 후 검증

원격 브랜치의 App.tsx는 버전 관리 기능이 추가되어 있음. 주요 변경사항:

#### SavedDocument 인터페이스 확장
```tsx
export interface SavedDocument {
  id: string;
  name: string;
  date: string;
  completedSteps: number;
  totalSteps: number;
  progress: number;
  status: 'completed' | 'in-progress';
  content?: DocumentData;
  lastStep?: number;
  lastActiveShippingDoc?: 'CI' | 'PL' | null;  // 추가
  versions?: {                                   // 추가
    id: string;
    timestamp: number;
    data: DocumentData;
    step: number;
  }[];
}
```

#### handleSaveDocument 함수 수정
저장 시 버전 히스토리에 새 버전 추가하는 로직 포함

#### DocumentCreationPage에 전달하는 props 추가
```tsx
<DocumentCreationPage
  // 기존 props...
  versions={currentDocId ? savedDocuments.find(d => d.id === currentDocId)?.versions : undefined}
  onRestore={(version) => {
    setDocumentData(prev => ({
      ...prev,
      [version.step]: version.data[version.step]
    }));
    if (currentStep !== version.step) {
      setCurrentStep(version.step);
    }
  }}
  initialActiveShippingDoc={currentActiveShippingDoc}
/>
```

---

## 5. 실행 단계별 명령어

### 5.1 사전 준비

```bash
# 1. 현재 브랜치 확인
git branch

# 2. 작업 전 백업 브랜치 생성
git checkout -b backup/temp-version-control-merge-$(date +%Y%m%d)
git checkout temp/version-control-merge

# 3. 원격 브랜치 최신화
git fetch origin feature/version_control_v1
```

### 5.2 머지 실행

```bash
# 4. 머지 시작 (충돌 발생 예상)
git merge origin/feature/version_control_v1 --no-commit

# 충돌 파일 확인
git status
```

### 5.3 충돌 해결

#### DocumentCreationPage.tsx
```bash
# 현재 브랜치 버전을 기준으로 시작
git checkout --ours frontend/components/DocumentCreationPage.tsx

# 수동으로 원격 브랜치의 버전 히스토리 코드 추가 (섹션 3.2 참조)
# 에디터에서 직접 편집
```

#### App.tsx
```bash
# 원격 브랜치 버전 사용 (버전 관리 로직 포함)
git checkout --theirs frontend/App.tsx

# 검증 필요: 현재 브랜치와 충돌하는 부분 없는지 확인
```

#### package-lock.json
```bash
# 충돌 무시하고 재생성
git checkout --ours frontend/package-lock.json
cd frontend && npm install && cd ..
```

#### VersionHistorySidebar.tsx (신규 파일)
```bash
# 자동으로 추가됨, 확인만 필요
git add frontend/components/VersionHistorySidebar.tsx
```

### 5.4 머지 완료

```bash
# 5. 모든 파일 스테이징
git add .

# 6. 빌드 테스트
cd frontend && npm run build && cd ..

# 7. 머지 커밋
git commit -m "Merge feature/version_control_v1: 버전 히스토리 UI 통합

- VersionHistorySidebar 컴포넌트 추가
- App.tsx 버전 관리 로직 통합
- DocumentCreationPage.tsx 버전 히스토리 UI 추가
- S3 업로드/PDF 뷰어/에이전트 기능 유지"
```

---

## 6. 검증 체크리스트

### 6.1 기능 검증

- [ ] **S3 업로드**: Offer Sheet/Sales Contract 파일 업로드 동작
- [ ] **PDF 뷰어**: 업로드된 PDF가 PdfViewer로 렌더링
- [ ] **업로드 상태**: uploading → processing → ready 상태 전환
- [ ] **에이전트 연동**: ChatAssistant에 documentId 전달 확인
- [ ] **버전 히스토리**: 버전 기록 버튼 클릭 시 사이드바 표시
- [ ] **버전 복원**: 이전 버전 선택 시 문서 복원
- [ ] **저장**: stepModes, uploadedFileNames 포함하여 저장

### 6.2 빌드 검증

```bash
# Frontend 빌드
cd frontend && npm run build

# Backend 실행 테스트
cd backend && python manage.py check
```

---

## 7. 롤백 방법

문제 발생 시:

```bash
# 머지 취소 (커밋 전)
git merge --abort

# 머지 커밋 후 롤백
git reset --hard backup/temp-version-control-merge-$(date +%Y%m%d)
```

---

## 8. 참고: 파일 위치 요약

| 기능 | 파일 경로 |
|------|----------|
| S3 업로드 API | `frontend/utils/documentApi.ts` |
| PDF 뷰어 | `frontend/components/PdfViewer.tsx` |
| 챗봇/에이전트 | `frontend/components/ChatAssistant.tsx` |
| 문서 작성 페이지 | `frontend/components/DocumentCreationPage.tsx` |
| 버전 히스토리 사이드바 | `frontend/components/VersionHistorySidebar.tsx` |
| 앱 라우팅/상태 | `frontend/App.tsx` |
| 에이전트 백엔드 | `backend/agent_core/agents.py` |
| Langfuse 설정 | `backend/agent_core/langfuse_config.py` |

---

## 9. 문의사항

이 계획서에 대한 질문이나 수정이 필요한 경우, 다음 정보를 참고하세요:

- 공통 조상 커밋: `deb11c8`
- 현재 브랜치 최신 커밋: `d5557a7`
- 원격 브랜치 최신 커밋: `d533db3`
