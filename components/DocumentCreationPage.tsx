import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { PageType, DocumentData } from '../App';
import StepSelector from './StepSelector';
import ContractEditor from './editor/ContractEditor';
import ChatAssistant from './ChatAssistant';
import OthersDocumentViewer from './OthersDocumentViewer';


interface DocumentCreationPageProps {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  documentData: DocumentData;
  setDocumentData: (data: DocumentData) => void;
  onNavigate: (page: PageType) => void;
}

const stepNames = [
  'Offer Sheet',
  'Purchase Order',
  'Proforma Invoice',
  'Sales Contract',
  'Commercial Invoice',
  'Packing List',
  'Bill of Lading',
  'Letter of Credit',
  'Others'
];

const stepShortNames = [
  'Offer (HFD)',
  'Purchase Order (PO)',
  'Proforma Invoice (PI)',
  'Sales Contract',
  'Commercial Invoice (CI)',
  'Packing List',
  'Bill of Lading (BL)',
  'Letter of Credit (LC)',
  'Others'
];

export default function DocumentCreationPage({
  currentStep,
  setCurrentStep,
  documentData,
  setDocumentData,
  onNavigate
}: DocumentCreationPageProps) {
  const [editorPhase, setEditorPhase] = useState<'select' | 'analyzing' | 'review' | 'editing'>('editing');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(documentData.title || '');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedPDF, setSelectedPDF] = useState<string | null>(null);

  // Open chat with animation on initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsChatOpen(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < 7) {
      setCurrentStep(currentStep + 1);
    }
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

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => onNavigate('main')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1">
            {isEditingTitle ? (
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                placeholder="제목을 입력하세요. (예: USA-Fashion-20251126)"
                className="text-gray-800 text-lg font-semibold border-b-2 border-blue-500 outline-none focus:border-blue-600 bg-transparent w-full py-1"
                autoFocus
              />
            ) : (
              <button
                onClick={() => {
                  setIsEditingTitle(true);
                  setTempTitle(documentData.title || '');
                }}
                className="text-gray-800 text-lg font-semibold hover:text-blue-600 transition-colors text-left w-full"
              >
                {documentData.title || '제목을 입력하세요. (클릭)'}
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-8 py-2 bg-gray-50 border-b">
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
                    {/* Empty circle - no number */}
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
      </header>

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Document Editor - Adjusts width when chat is open */}
        <div
          className="flex flex-col overflow-hidden p-4 transition-all duration-500 ease-in-out w-full"
          style={{ marginRight: isChatOpen ? '400px' : '0' }}
        >
          {currentStep === 9 ? (
            <OthersDocumentViewer
              onFileSelect={setSelectedPDF}
              selectedFile={selectedPDF}
              onBackToList={() => setSelectedPDF(null)}
            />
          ) : (
            <ContractEditor
              onChange={(content) => {
                setDocumentData({ ...documentData, content });
              }}
            />
          )}
        </div>

        {/* Chat Assistant - Slide in from right with resize handle */}
        <div className={`absolute right-0 top-0 h-full w-[400px] border-l flex flex-col overflow-hidden bg-white transition-transform duration-500 ease-in-out ${isChatOpen ? 'translate-x-0' : 'translate-x-full'
          }`}>
          {/* Resize Handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 bg-gray-300 transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startWidth = 400;

              const handleMouseMove = (moveEvent: MouseEvent) => {
                const diff = startX - moveEvent.clientX;
                const newWidth = Math.min(Math.max(300, startWidth + diff), 800);
                const chatPanel = (e.target as HTMLElement).parentElement;
                if (chatPanel) {
                  chatPanel.style.width = `${newWidth}px`;
                  const editor = chatPanel.previousElementSibling as HTMLElement;
                  if (editor) {
                    editor.style.marginRight = `${newWidth}px`;
                  }
                }
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />
          <ChatAssistant currentStep={currentStep} onClose={toggleChat} />
        </div>

        {/* Floating Chat Button */}
        {!isChatOpen && (
          <button
            onClick={toggleChat}
            className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 z-50"
            title="AI 챗봇 열기"
          >
            <Sparkles className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  );
}