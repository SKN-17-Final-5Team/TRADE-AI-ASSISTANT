import { useState, useEffect } from 'react';
import MainPage from './components/MainPage';
import ChatPage from './components/ChatPage';
import DocumentCreationPage from './components/DocumentCreationPage';
import LoginPage from './components/LoginPage';

export type PageType = 'main' | 'chat' | 'documents';
export type TransitionType = 'none' | 'expanding' | 'shrinking';

export interface DocumentData {
  title?: string;
  [key: string]: any;
}

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
  lastActiveShippingDoc?: 'CI' | 'PL' | null;
  versions?: {
    id: string;
    timestamp: number;
    data: DocumentData;
    step: number;
  }[];
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [currentPage, setCurrentPage] = useState<PageType>('main');
  const [currentStep, setCurrentStep] = useState(0);
  const [documentData, setDocumentData] = useState<DocumentData>({});
  const [transition, setTransition] = useState<TransitionType>('none');
  const [logoPosition, setLogoPosition] = useState({ x: 0, y: 0 });

  const handleNavigate = (page: PageType) => {
    if (page === 'main') {
      setCurrentDocId(null);
    }

    if (page === 'documents') {
      // If we are navigating to documents and don't have an ID, it's a new document
      // (handleOpenDocument sets the ID before navigating)
      if (!currentDocId) {
        setCurrentStep(1);
        setCurrentStep(1);
        setDocumentData({});
        setCurrentActiveShippingDoc(null);
      }
    }
    setCurrentPage(page);
  };

  const handleOpenDocument = (doc: SavedDocument) => {
    setCurrentDocId(doc.id);
    // Resume Document: Load content and go to Step 1
    if (doc.content) {
      setDocumentData(doc.content);
    }
    setCurrentStep(doc.lastStep || 1); // Resume from last step or default to 1
    const shippingDoc = doc.lastActiveShippingDoc || null;
    setCurrentActiveShippingDoc(shippingDoc);

    // Use setTimeout to ensure state is set before navigation
    setTimeout(() => {
      setCurrentPage('documents');
    }, 0);
  };

  // 로고 클릭으로 채팅 열기 (확장 애니메이션)
  const handleOpenChat = (logoRect: DOMRect) => {
    setLogoPosition({
      x: logoRect.left + logoRect.width / 2,
      y: logoRect.top + logoRect.height / 2
    });
    setTransition('expanding');

    // 애니메이션 완료 후 상태 정리
    setTimeout(() => {
      setTransition('none');
      setCurrentPage('chat');
    }, 500);
  };

  // 로고 클릭으로 채팅 닫기 (축소 애니메이션)
  const handleCloseChat = (logoRect: DOMRect) => {
    setLogoPosition({
      x: logoRect.left + logoRect.width / 2,
      y: logoRect.top + logoRect.height / 2
    });
    setTransition('shrinking');

    // 애니메이션 완료 후 상태 정리
    setTimeout(() => {
      setTransition('none');
      setCurrentPage('main');
    }, 500);
  };
  const [savedDocuments, setSavedDocuments] = useState<SavedDocument[]>([
    {
      id: '1',
      name: 'Samsung Electronics - Offer Sheet',
      date: '2025.11.20',
      completedSteps: 1,
      totalSteps: 5,
      progress: 20,
      status: 'in-progress',
      content: {}
    },
    {
      id: '2',
      name: 'LG Display - Complete Set',
      date: '2025.11.18',
      completedSteps: 5,
      totalSteps: 5,
      progress: 100,
      status: 'completed',
      content: {}
    },
    {
      id: '3',
      name: 'Hyundai Motors - PI & SC',
      date: '2025.11.15',
      completedSteps: 2,
      totalSteps: 5,
      progress: 40,
      status: 'in-progress',
      content: {}
    }
  ]);

  // Track the ID of the document currently being edited
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [currentActiveShippingDoc, setCurrentActiveShippingDoc] = useState<'CI' | 'PL' | null>(null);

  const handleSaveDocument = (data: DocumentData, step: number, activeShippingDoc?: 'CI' | 'PL' | null) => {
    // Update currentActiveShippingDoc if provided
    if (activeShippingDoc) {
      setCurrentActiveShippingDoc(activeShippingDoc);
    }

    // Normalize step to visual step (1-4), not docKey (1-5)
    // If step is 5 (PL docKey), it should be saved as step 4
    const visualStep = step > 4 ? 4 : step;

    const completedStepsCount = Object.keys(data)
      .filter(k => k !== 'title')
      .map(Number)
      .filter(step => step >= 1 && step <= 5)
      .length;
    const progress = Math.round((completedStepsCount / 5) * 100);
    const now = Date.now();

    // Determine the document ID to use
    let docId = currentDocId;
    if (!docId) {
      docId = now.toString();
      setCurrentDocId(docId);
    }

    // Create new version object
    const newVersion = {
      id: now.toString(),
      timestamp: now,
      data: { ...data },
      step: visualStep  // Use visualStep for version history
    };

    setSavedDocuments(prev => {
      const existingDocIndex = prev.findIndex(d => d.id === docId);

      if (existingDocIndex !== -1) {
        // Update existing document
        const existingDoc = prev[existingDocIndex];

        const updatedDoc: SavedDocument = {
          ...existingDoc,
          name: data.title || 'Untitled Document',
          date: new Date().toLocaleDateString('ko-KR').replace(/\. /g, '.').slice(0, -1),
          completedSteps: completedStepsCount,
          totalSteps: 5,
          progress: progress,
          status: progress === 100 ? 'completed' : 'in-progress',
          content: data,
          lastStep: visualStep,  // Use visualStep
          lastActiveShippingDoc: activeShippingDoc || existingDoc.lastActiveShippingDoc,
          versions: [newVersion, ...(existingDoc.versions || [])]
        };

        // Move updated doc to top
        const finalDocs = prev.filter(d => d.id !== docId);
        finalDocs.unshift(updatedDoc);
        return finalDocs;
      } else {
        // Create new document
        const newDoc: SavedDocument = {
          id: docId!, // We know docId is set
          name: data.title || 'Untitled Document',
          date: new Date().toLocaleDateString('ko-KR').replace(/\. /g, '.').slice(0, -1),
          completedSteps: completedStepsCount,
          totalSteps: 5,
          progress: progress,
          status: 'in-progress',
          content: data,
          lastStep: visualStep,  // Use visualStep
          lastActiveShippingDoc: activeShippingDoc || null,
          versions: [newVersion]
        };
        return [newDoc, ...prev];
      }
    });
  };

  // 컴포넌트 마운트 시 localStorage에서 인증 상태 복원
  useEffect(() => {
    const savedAuth = localStorage.getItem('isAuthenticated');
    const savedEmail = localStorage.getItem('userEmail');

    if (savedAuth === 'true' && savedEmail) {
      setIsAuthenticated(true);
      setUserEmail(savedEmail);
    }
  }, []);

  const handleLogin = (employeeId: string) => {
    // Mock 로그인 처리
    setUserEmail(employeeId);
    setIsAuthenticated(true);

    // localStorage에 인증 상태 저장
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userEmail', employeeId);
  };

  const handleLogout = () => {
    // 로그아웃 처리
    setIsAuthenticated(false);
    setUserEmail('');
    setCurrentPage('main');

    // localStorage에서 인증 상태 제거
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
  };

  // 로그인하지 않은 경우 로그인 페이지 표시
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // clip-path 원의 중심 위치 계산 (% 단위)
  const clipOriginX = logoPosition.x ? (logoPosition.x / window.innerWidth) * 100 : 50;
  const clipOriginY = logoPosition.y ? (logoPosition.y / window.innerHeight) * 100 : 50;

  const handleDeleteDocument = (docId: string) => {
    setSavedDocuments(prev => prev.filter(doc => doc.id !== docId));
  };

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      {/* 메인 페이지 (항상 뒤에) */}
      {(currentPage === 'main' || transition === 'expanding') && (
        <div className={transition === 'expanding' ? 'pointer-events-none' : ''}>
          <MainPage
            onNavigate={handleNavigate}
            savedDocuments={savedDocuments}
            userEmployeeId={userEmail}
            onLogout={handleLogout}
            onOpenDocument={handleOpenDocument}
            onLogoClick={handleOpenChat}
            onDeleteDocument={handleDeleteDocument}
          />
        </div>
      )}

      {/* 채팅 페이지 (확장 시 원형으로 나타남) */}
      {transition === 'expanding' && (
        <>
          {/* 글로우 효과 원 */}
          <div
            className="fixed z-40 rounded-full animate-glow-expand pointer-events-none"
            style={{
              left: logoPosition.x,
              top: logoPosition.y,
              transform: 'translate(-50%, -50%)',
              width: '40px',
              height: '40px',
              background: 'rgba(37, 99, 235, 0.3)',
              boxShadow: '0 0 30px 15px rgba(37, 99, 235, 0.5), 0 0 60px 30px rgba(37, 99, 235, 0.3)'
            }}
          />
          {/* 채팅 페이지 */}
          <div
            className="fixed inset-0 z-50 animate-clip-expand"
            style={{
              clipPath: `circle(0% at ${clipOriginX}% ${clipOriginY}%)`
            }}
          >
            <ChatPage
              onNavigate={handleNavigate}
              onLogoClick={handleCloseChat}
              userEmployeeId={userEmail}
              onLogout={handleLogout}
            />
          </div>
        </>
      )}

      {/* 축소 시 메인 페이지와 글로우 효과 */}
      {transition === 'shrinking' && (
        <>
          <MainPage
            onNavigate={handleNavigate}
            savedDocuments={savedDocuments}
            userEmployeeId={userEmail}
            onLogout={handleLogout}
            onOpenDocument={handleOpenDocument}
            onLogoClick={handleOpenChat}
            onDeleteDocument={handleDeleteDocument}
          />
          {/* 글로우 효과 원 */}
          <div
            className="fixed z-40 rounded-full animate-glow-shrink pointer-events-none"
            style={{
              left: logoPosition.x,
              top: logoPosition.y,
              transform: 'translate(-50%, -50%)',
              width: '300vmax',
              height: '300vmax',
              background: 'transparent',
              boxShadow: '0 0 30px 15px rgba(37, 99, 235, 0.5), 0 0 60px 30px rgba(37, 99, 235, 0.3)'
            }}
          />
        </>
      )}

      {/* 일반 채팅 페이지 (축소 애니메이션 포함) */}
      {(currentPage === 'chat' || transition === 'shrinking') && transition !== 'expanding' && (
        <div
          className={transition === 'shrinking' ? 'fixed inset-0 z-50 animate-clip-shrink' : ''}
          style={transition === 'shrinking' ? {
            clipPath: `circle(150% at ${clipOriginX}% ${clipOriginY}%)`
          } : undefined}
        >
          <ChatPage
            onNavigate={handleNavigate}
            onLogoClick={handleCloseChat}
            userEmployeeId={userEmail}
            onLogout={handleLogout}
          />
        </div>
      )}

      {/* 문서 페이지 */}
      {currentPage === 'documents' && (
        <DocumentCreationPage
          key={currentDocId || 'new'}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          documentData={documentData}
          setDocumentData={setDocumentData}
          onNavigate={handleNavigate}
          userEmployeeId={userEmail}
          onLogout={handleLogout}
          onSave={handleSaveDocument}
          versions={savedDocuments.find(d => d.id === currentDocId)?.versions || []}
          onRestore={(version) => {
            setDocumentData(prev => ({
              ...prev,
              [version.step]: version.data[version.step]
            }));
            // We don't need to set current step as we are already on it (filtered view), 
            // but if we want to be safe or if we change filtering logic later:
            if (currentStep !== version.step) {
              setCurrentStep(version.step);
            }
          }}
          initialActiveShippingDoc={currentActiveShippingDoc}
        />
      )}

      {/* 전환 애니메이션 스타일 */}
      <style>{`
        @keyframes clip-expand {
          0% {
            clip-path: circle(0% at ${clipOriginX}% ${clipOriginY}%);
          }
          100% {
            clip-path: circle(150% at ${clipOriginX}% ${clipOriginY}%);
          }
        }

        @keyframes clip-shrink {
          0% {
            clip-path: circle(150% at ${clipOriginX}% ${clipOriginY}%);
          }
          100% {
            clip-path: circle(0% at ${clipOriginX}% ${clipOriginY}%);
          }
        }

        @keyframes glow-expand {
          0% {
            width: 40px;
            height: 40px;
            opacity: 1;
          }
          100% {
            width: 300vmax;
            height: 300vmax;
            opacity: 0;
          }
        }

        @keyframes glow-shrink {
          0% {
            width: 300vmax;
            height: 300vmax;
            opacity: 0;
          }
          100% {
            width: 40px;
            height: 40px;
            opacity: 1;
          }
        }

        .animate-clip-expand {
          animation: clip-expand 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .animate-clip-shrink {
          animation: clip-shrink 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .animate-glow-expand {
          animation: glow-expand 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .animate-glow-shrink {
          animation: glow-shrink 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
}

export default App;