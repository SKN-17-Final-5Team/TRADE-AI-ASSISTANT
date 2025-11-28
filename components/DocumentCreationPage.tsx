import { useState, useRef } from 'react';
import { ArrowLeft, Sparkles, User, LogOut, Plus, FileText, MousePointerClick, Save, Download } from 'lucide-react';
import { PageType, DocumentData } from '../App';
import ContractEditor, { ContractEditorRef } from './editor/ContractEditor';
import ChatAssistant from './ChatAssistant';
import { offerSheetTemplateHTML } from '../templates/offerSheet';

import { proformaInvoiceTemplateHTML } from '../templates/proformaInvoice';
import { packingListTemplateHTML } from '../templates/packingList';
import { saleContractTemplateHTML } from '../templates/saleContract';
import { commercialInvoiceTemplateHTML } from '../templates/commercialInvoice';


interface DocumentCreationPageProps {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  documentData: DocumentData;
  setDocumentData: (data: DocumentData) => void;
  onNavigate: (page: PageType) => void;
  userEmployeeId: string;
  onLogout: () => void;
  onSave: (data: DocumentData, step: number) => void;
}

const stepShortNames = [
  'Offer (HFD)',
  'Proforma Invoice (PI)',
  'Sales Contract',
  'Commercial Invoice (CI)',
  'Packing List'
];

export default function DocumentCreationPage({
  currentStep,
  setCurrentStep,
  documentData,
  setDocumentData,
  onNavigate,
  userEmployeeId,
  onLogout,
  onSave
}: DocumentCreationPageProps) {
  const editorRef = useRef<ContractEditorRef>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(documentData.title || '');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(400);
  const [showMyPageModal, setShowMyPageModal] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    setPasswordSuccess(true);
    setPasswordError('');
    setTimeout(() => {
      setShowPasswordChange(false);
      setPasswordSuccess(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }, 1500);
  };

  const handleTitleSave = () => {
    setDocumentData({
      ...documentData,
      title: tempTitle
    });
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setTempTitle(documentData.title || '');
      setIsEditingTitle(false);
    }
  };

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const handleSave = () => {
    onSave(documentData, currentStep);
    setIsDirty(false); // Reset dirty state after save
  };

  const handleDownload = () => {
    if (!editorRef.current) return;

    const content = editorRef.current.getContent();

    // Create a temporary DOM element to manipulate the content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    // Remove all <mark> tags and their content (highlighted placeholders)
    const marks = tempDiv.querySelectorAll('mark');
    marks.forEach(mark => {
      mark.remove(); // Removes the element AND its content
    });

    // Get the cleaned HTML
    const cleanContent = tempDiv.innerHTML;

    // Create a Blob and trigger download
    const blob = new Blob([`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${documentData.title || 'Document'}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid black; padding: 8px; }
          .contract-table { width: 100%; }
        </style>
      </head>
      <body>
        ${cleanContent}
      </body>
      </html>
    `], { type: 'text/html' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentData.title || 'document'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm flex-shrink-0">
        <div className="px-8 py-4 flex items-center justify-between">
          {/* Left: Back button and Title */}
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => {
                if (isDirty) {
                  setShowExitConfirm(true);
                } else {
                  onNavigate('main');
                }
              }}
              className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              {isEditingTitle ? (
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={handleTitleKeyDown}
                  placeholder="제목을 입력하세요. (예: USA-Fashion-20251126)"
                  className="text-gray-900 font-bold border-b-2 border-blue-500 outline-none focus:border-blue-600 bg-transparent w-80 py-1"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    setIsEditingTitle(true);
                    setTempTitle(documentData.title || '');
                  }}
                  className="text-gray-900 font-bold hover:text-blue-600 transition-colors text-left"
                >
                  {documentData.title || '제목을 입력하세요. (클릭)'}
                </button>
              )}
              <p className="text-gray-500 text-sm">문서 작성</p>
            </div>
          </div>
          {/* Right: User Info */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              className="text-gray-600 hover:text-blue-600 text-sm flex items-center gap-1 transition-colors"
              title="전체 저장"
            >
              <Save className="w-4 h-4" />
              저장
            </button>
            <button
              onClick={handleDownload}
              className="text-gray-600 hover:text-blue-600 text-sm flex items-center gap-1 transition-colors"
              title="현재 문서 다운로드"
            >
              <Download className="w-4 h-4" />
              다운로드
            </button>
            <div className="w-px h-4 bg-gray-300 mx-2"></div>
            <span className="text-gray-600 text-sm">{userEmployeeId}</span>
            <button
              onClick={() => setShowMyPageModal(!showMyPageModal)}
              className="text-gray-600 hover:text-gray-900 text-sm transition-colors"
            >
              마이페이지
            </button>
            <button
              onClick={onLogout}
              className="text-gray-600 hover:text-gray-900 text-sm transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Split Layout (includes tabs and editor) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left side: Tabs + Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Navigation */}
          <div className="px-8 py-2 bg-gray-50 border-b flex-shrink-0">
            <div className="flex items-center justify-between max-w-6xl mx-auto">
              {stepShortNames.map((name, index) => {
                const stepNumber = index + 1;
                const isActive = currentStep === stepNumber;

                return (
                  <button
                    key={index}
                    onClick={() => setCurrentStep(stepNumber)}
                    className="flex flex-col items-center gap-1.5 relative group flex-shrink-0"
                  >
                    {/* Circle */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isActive
                        ? 'bg-blue-600 shadow-lg shadow-blue-200 scale-110'
                        : 'bg-white border-2 border-gray-300 group-hover:border-blue-400 group-hover:scale-105'
                        }`}
                    >
                      {isActive ? (
                        <div className="w-2.5 h-2.5 bg-white rounded-full" />
                      ) : (
                        <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors" />
                      )}
                    </div>

                    {/* Label */}
                    <span
                      className={`text-xs whitespace-nowrap transition-colors font-medium ${isActive
                        ? 'text-blue-600 font-semibold'
                        : 'text-gray-600 group-hover:text-blue-500'
                        }`}
                    >
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Document Editor or Empty State */}
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            {currentStep === 0 ? (
              <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                  <div className="absolute top-10 left-10 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-60 animate-pulse" />
                  <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-50 rounded-full blur-3xl opacity-60 animate-pulse delay-1000" />
                </div>

                <div className="relative z-10 text-center p-8 max-w-lg mx-auto">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner transform rotate-3 hover:rotate-6 transition-transform duration-500">
                    <FileText className="w-12 h-12 text-blue-600" />
                  </div>

                  <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">
                    무역 서류 작성을<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                      시작해보세요
                    </span>
                  </h2>

                  <p className="text-gray-500 text-lg mb-10 leading-relaxed">
                    상단의 <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 rounded-full mx-1"><Plus className="w-3 h-3 text-gray-600" /></span> 버튼을 클릭하여<br />
                    원하는 서류 템플릿을 선택해주세요.
                  </p>

                  <div className="flex items-center justify-center gap-2 text-sm text-blue-600 font-medium bg-blue-50 py-2 px-4 rounded-full inline-flex animate-bounce">
                    <MousePointerClick className="w-4 h-4" />
                    <span>위쪽의 동그라미를 클릭하세요!</span>
                  </div>
                </div>
              </div>
            ) : (
              <ContractEditor
                key={currentStep}
                ref={editorRef}
                initialContent={
                  documentData[currentStep] || (
                    currentStep === 1 ? offerSheetTemplateHTML :
                      currentStep === 2 ? proformaInvoiceTemplateHTML :
                        currentStep === 3 ? saleContractTemplateHTML :
                          currentStep === 4 ? commercialInvoiceTemplateHTML :
                            currentStep === 5 ? packingListTemplateHTML :
                              undefined
                  )
                }
                onChange={(content) => {
                  setDocumentData({
                    ...documentData,
                    [currentStep]: content
                  });
                  setIsDirty(true);
                }}
              />
            )}
          </div>
        </div>

        {/* Chat Assistant - Slide in from right with resize handle */}
        <div
          className={`flex-shrink-0 border-l flex flex-col overflow-hidden bg-white relative transition-all duration-300 ease-in-out ${isChatOpen ? 'opacity-100' : 'w-0 opacity-0 border-0'}`}
          style={{ width: isChatOpen ? `${chatWidth}px` : '0', minWidth: isChatOpen ? '300px' : '0' }}
        >
          {/* Resize Handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 bg-gray-300 transition-colors z-10"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startWidth = chatWidth;

              const handleMouseMove = (moveEvent: MouseEvent) => {
                const diff = startX - moveEvent.clientX;
                const newWidth = Math.min(Math.max(300, startWidth + diff), 800);
                setChatWidth(newWidth);
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />
          <ChatAssistant currentStep={currentStep} onClose={toggleChat} editorRef={editorRef} />
        </div>

        {/* Floating Chat Button */}
        {!isChatOpen && (
          <button
            onClick={toggleChat}
            className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 z-40"
            title="AI 챗봇 열기"
          >
            <Sparkles className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* My Page Modal */}
      {showMyPageModal && !showPasswordChange && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[200]"
          onClick={() => setShowMyPageModal(false)}
        >
          <div
            className="bg-gradient-to-b from-gray-100 to-white rounded-3xl shadow-2xl w-80 overflow-hidden border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gray-100 px-6 py-4 flex items-center justify-between border-b border-gray-200">
              <span className="text-gray-700 text-sm">{userEmployeeId}</span>
              <button
                onClick={() => setShowMyPageModal(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full mb-4 border-4 border-blue-100">
                <User className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-gray-900 mb-2">안녕하세요, {userEmployeeId}님</h3>
              <p className="text-gray-500 text-sm mb-6">Trade Copilot <br />무역서류작성 시스템에 오신 걸 환영합니다 :)</p>
              <button
                onClick={() => setShowPasswordChange(true)}
                className="w-full max-w-xs mx-auto bg-white hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-full border border-gray-300 transition-colors text-sm"
              >
                비밀번호 변경
              </button>
            </div>

            <div className="border-t border-gray-200">
              <button
                onClick={onLogout}
                className="w-full px-6 py-4 text-gray-700 hover:bg-gray-50 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordChange && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[200]"
          onClick={() => {
            setShowPasswordChange(false);
            setPasswordError('');
            setPasswordSuccess(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
          }}
        >
          <div
            className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-gray-900">비밀번호 변경</h2>
              <button
                onClick={() => {
                  setShowPasswordChange(false);
                  setPasswordError('');
                  setPasswordSuccess(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2" htmlFor="docCurrentPassword">
                  현재 비밀번호
                </label>
                <input
                  type="password"
                  id="docCurrentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3"
                  placeholder="현재 비밀번호를 입력하세요"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2" htmlFor="docNewPassword">
                  새 비밀번호
                </label>
                <input
                  type="password"
                  id="docNewPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3"
                  placeholder="새 비밀번호를 입력하세요 (8자 이상)"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2" htmlFor="docConfirmPassword">
                  새 비밀번호 확인
                </label>
                <input
                  type="password"
                  id="docConfirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3"
                  placeholder="새 비밀번호를 다시 입력하세요"
                />
              </div>

              {passwordError && (
                <div className="text-red-500 text-sm">{passwordError}</div>
              )}

              {passwordSuccess && (
                <div className="text-green-500 text-sm">비밀번호가 성공적으로 변경되었습니다!</div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition-colors"
              >
                비밀번호 변경
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200]">
          <div className="bg-white rounded-xl p-6 w-96 shadow-2xl transform transition-all scale-100">
            <h3 className="text-lg font-bold text-gray-900 mb-2">저장하지 않고 나가시겠습니까?</h3>
            <p className="text-gray-500 text-sm mb-6">
              작성 중인 내용이 저장되지 않았습니다.<br />
              정말 나가시겠습니까?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  onNavigate('main');
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}