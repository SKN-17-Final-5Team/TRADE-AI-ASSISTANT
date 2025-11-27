import { useState, useEffect } from 'react';
import MainPage from './components/MainPage';
import ChatPage from './components/ChatPage';
import DocumentCreationPage from './components/DocumentCreationPage';
import LoginPage from './components/LoginPage';

export type PageType = 'main' | 'chat' | 'documents';

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
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [currentPage, setCurrentPage] = useState<PageType>('main');
  const [currentStep, setCurrentStep] = useState(1);
  const [documentData, setDocumentData] = useState<DocumentData>({});
  const [savedDocuments] = useState<SavedDocument[]>([
    {
      id: '1',
      name: 'Samsung Electronics - Offer Sheet',
      date: '2025.11.20',
      completedSteps: 4,
      totalSteps: 7,
      progress: 57,
      status: 'in-progress'
    },
    {
      id: '2',
      name: 'LG Display - Complete Set',
      date: '2025.11.18',
      completedSteps: 7,
      totalSteps: 7,
      progress: 100,
      status: 'completed'
    },
    {
      id: '3',
      name: 'Hyundai Motors - PI & SC',
      date: '2025.11.15',
      completedSteps: 2,
      totalSteps: 7,
      progress: 28,
      status: 'in-progress'
    }
  ]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      {currentPage === 'main' && (
        <MainPage 
          onNavigate={setCurrentPage}
          savedDocuments={savedDocuments}
          userEmployeeId={userEmail}
          onLogout={handleLogout}
        />
      )}
      {currentPage === 'chat' && (
        <ChatPage onNavigate={setCurrentPage} />
      )}
      {currentPage === 'documents' && (
        <DocumentCreationPage
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          documentData={documentData}
          setDocumentData={setDocumentData}
          onNavigate={setCurrentPage}
        />
      )}
    </div>
  );
}

export default App;