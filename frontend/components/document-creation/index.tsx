// DocumentCreationPage - 메인 컴포넌트
import { useState, useRef, useEffect } from 'react';
import { Sparkles, Paperclip, MinusCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
import type { DocumentCreationPageProps, StepMode, ShippingDocType } from './types';
import { STEP_SHORT_NAMES } from './types';

// Hooks
import { useFileUpload } from './hooks/useFileUpload';
import { useSharedData } from './hooks/useSharedData';
import { useDocumentState } from './hooks/useDocumentState';

// Layout Components
import { DocumentHeader, StepNavigation } from './layout';

// Step Components
import {
  EmptyState,
  ModeSelector,
  FileUploadView,
  SkipState,
  ShippingDocsDashboard,
  EditorView
} from './steps';

// Modal Components
import {
  MyPageModal,
  PasswordChangeModal,
  ExitConfirmModal,
  SaveSuccessModal,
  DownloadModal,
  LogoutConfirmModal
} from './modals';

// External Components
import VersionHistorySidebar, { Version } from '../VersionHistorySidebar';
import ContractEditor, { ContractEditorRef, FieldChange } from '../editor/ContractEditor';
import ChatAssistant from '../ChatAssistant';
import { ShootingStarIntro } from '../ShootingStarIntro';

// Templates
import { offerSheetTemplateHTML } from '../../templates/offerSheet';
import { proformaInvoiceTemplateHTML } from '../../templates/proformaInvoice';
import { packingListTemplateHTML } from '../../templates/packingList';
import { saleContractTemplateHTML } from '../../templates/saleContract';
import { commercialInvoiceTemplateHTML } from '../../templates/commercialInvoice';

// Utils
import { checkStepCompletion } from '../../utils/documentUtils';
import { DocumentData } from '../../App';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function DocumentCreationPage({
  currentStep,
  setCurrentStep,
  documentData,
  setDocumentData,
  onNavigate,
  userEmployeeId,
  onLogout,
  onSave,
  versions = [],
  onRestore,
  initialActiveShippingDoc
}: DocumentCreationPageProps) {
  const editorRef = useRef<ContractEditorRef>(null);
  const chatButtonRef = useRef<HTMLButtonElement>(null);

  // Custom Hooks
  const {
    uploadedFiles,
    uploadStatus,
    uploadError,
    uploadedDocumentIds,
    uploadedDocumentUrls,
    handleFileUpload,
    removeUploadedFile,
    retryUpload
  } = useFileUpload();

  const {
    sharedData,
    setSharedData,
    hydrateTemplate,
    extractData,
    updateContentWithSharedData
  } = useSharedData();

  const {
    stepModes,
    setStepModes,
    modifiedSteps,
    markStepModified,
    isDirty,
    setIsDirty,
    activeShippingDoc,
    setActiveShippingDoc,
    shippingOrder,
    setShippingOrder,
    getDocKeyForStep
  } = useDocumentState(documentData, initialActiveShippingDoc);

  // UI State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(400);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Modal State
  const [showMyPageModal, setShowMyPageModal] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Intro Animation State
  const [hasShownIntro, setHasShownIntro] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  // Calculate visibility for chatbot button
  const shouldShowChatButton = !isChatOpen && currentStep >= 1 && currentStep <= 5 && (
    (currentStep === 2) ||
    ((currentStep === 1 || currentStep === 3) && stepModes[currentStep] && stepModes[currentStep] !== 'skip' && (
      (stepModes[currentStep] === 'manual') ||
      (stepModes[currentStep] === 'upload' && uploadStatus[currentStep] === 'ready')
    )) ||
    (currentStep === 4 && activeShippingDoc)
  );

  // Trigger Intro Animation
  useEffect(() => {
    if (shouldShowChatButton && !hasShownIntro && !showIntro) {
      setShowIntro(true);
    }
  }, [shouldShowChatButton, hasShownIntro, showIntro]);

  // Get template for step
  const getTemplateForStep = (step: number): string => {
    switch (step) {
      case 1: return offerSheetTemplateHTML;
      case 2: return proformaInvoiceTemplateHTML;
      case 3: return saleContractTemplateHTML;
      case 4: return commercialInvoiceTemplateHTML;
      case 5: return packingListTemplateHTML;
      default: return '';
    }
  };

  // Helper to check completion status for a specific step
  const getStepCompletionStatus = (stepNumber: number): boolean => {
    if (uploadedFiles[stepNumber]) return true;
    if (stepModes[stepNumber] === 'skip') return true;

    if (stepNumber <= 3) {
      if (stepModes[stepNumber] === 'upload' && !uploadedFiles[stepNumber]) return false;
      const stepContent = documentData[stepNumber] || hydrateTemplate(getTemplateForStep(stepNumber));
      return checkStepCompletion(stepContent);
    } else {
      if (stepNumber === 4) {
        const ciContent = documentData[4] || hydrateTemplate(commercialInvoiceTemplateHTML);
        const plContent = documentData[5] || hydrateTemplate(packingListTemplateHTML);
        return checkStepCompletion(ciContent) && checkStepCompletion(plContent);
      }
      return false;
    }
  };

  // Calculate max progress step
  let maxProgressStep = currentStep;
  for (let i = 1; i <= STEP_SHORT_NAMES.length; i++) {
    if (getStepCompletionStatus(i)) {
      if (i > maxProgressStep) maxProgressStep = i;
    }
  }

  // Handlers
  const handleStepChange = (newStep: number) => {
    if (editorRef.current) {
      const content = editorRef.current.getContent();
      let saveKey = -1;
      if (currentStep <= 3) saveKey = currentStep;
      else if (shippingOrder) saveKey = getDocKeyForStep(currentStep);

      if (saveKey !== -1) {
        const newDocData = { ...documentData, [saveKey]: content };
        setDocumentData(newDocData);
        extractData(content);
      }
    }
    setCurrentStep(newStep);
  };

  const handleSave = () => {
    if (editorRef.current) {
      const content = editorRef.current.getContent();
      extractData(content);
      let saveKey = -1;
      if (currentStep <= 3) saveKey = currentStep;
      else if (shippingOrder) saveKey = getDocKeyForStep(currentStep);

      const newDocData = { ...documentData, [saveKey]: content };
      setDocumentData(newDocData);
      onSave(newDocData, currentStep, activeShippingDoc);
    } else {
      onSave(documentData, currentStep, activeShippingDoc);
    }
    setIsDirty(false);
    setShowSaveSuccessModal(true);
  };

  const handleDownload = () => {
    if (editorRef.current) {
      const content = editorRef.current.getContent();
      extractData(content);
      let saveKey = -1;
      if (currentStep <= 3) saveKey = currentStep;
      else if (shippingOrder) saveKey = getDocKeyForStep(currentStep);

      if (saveKey !== -1) {
        setDocumentData({ ...documentData, [saveKey]: content });
      }
    }
    setShowDownloadModal(true);
  };

  const handleBatchDownload = async (selectedSteps: Set<number>) => {
    // Close modal first
    setShowDownloadModal(false);

    for (const stepIndex of selectedSteps) {
      const content = documentData[stepIndex];
      if (!content) continue;

      // Clean content (remove marks)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const marks = tempDiv.querySelectorAll('mark');
      marks.forEach(mark => {
        const span = document.createElement('span');
        span.innerHTML = mark.innerHTML;
        mark.parentNode?.replaceChild(span, mark);
      });

      // Create a container for PDF rendering with A4 dimensions
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '210mm';
      container.style.padding = '20mm';
      container.style.backgroundColor = 'white';
      container.style.color = 'black';
      container.style.fontFamily = 'sans-serif';
      container.style.fontSize = '12pt';
      container.style.lineHeight = '1.5';

      // Add styles for tables
      const style = document.createElement('style');
      style.textContent = `
        table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
        th, td { border: 1px solid black; padding: 8px; text-align: left; font-size: 10pt; }
        h1, h2, h3 { margin-top: 0; }
        .contract-table { width: 100%; }
        img { max-width: 100%; }
      `;
      container.appendChild(style);

      const contentWrapper = document.createElement('div');
      contentWrapper.innerHTML = tempDiv.innerHTML;
      container.appendChild(contentWrapper);

      document.body.appendChild(container);

      try {
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        const pdf = new jsPDF('p', 'mm', 'a4');
        let heightLeft = imgHeight;
        let position = 0;

        // Add first page
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Add extra pages if content is long
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        const docName = STEP_SHORT_NAMES[stepIndex - 1] || `Document_${stepIndex}`;
        const fileName = `${documentData.title || 'Document'}_${docName}.pdf`;
        pdf.save(fileName);

      } catch (error) {
        console.error('PDF Generation Error:', error);
        alert('PDF 생성 중 오류가 발생했습니다.');
      } finally {
        document.body.removeChild(container);
      }
    }
  };

  const handleChatApply = (changes: FieldChange[], step: number) => {
    if (!editorRef.current || changes.length === 0) return;
    editorRef.current.applyFieldChanges(changes);

    const newSharedData: Record<string, string> = {};
    changes.forEach(({ fieldId, value }) => { newSharedData[fieldId] = value; });
    setSharedData(prev => ({ ...prev, ...newSharedData }));

    const updatedContent = editorRef.current.getContent();
    setDocumentData((prev: DocumentData) => ({ ...prev, [step]: updatedContent }));
    markStepModified(step);
    setIsDirty(true);

    if (step === 4 || step === 5) {
      if (!shippingOrder) {
        if (step === 4) setShippingOrder(['CI', 'PL']);
        else setShippingOrder(['PL', 'CI']);
      }
      let targetVisualStep = -1;
      if (shippingOrder) {
        if (shippingOrder[0] === (step === 4 ? 'CI' : 'PL')) targetVisualStep = 4;
        else targetVisualStep = 5;
      } else {
        targetVisualStep = 4;
      }
      if (targetVisualStep !== -1) setCurrentStep(targetVisualStep);
    } else {
      if (currentStep !== step) setCurrentStep(step);
    }
  };

  const handleEditorChange = (content: string) => {
    const saveKey = getDocKeyForStep(currentStep);
    if (saveKey !== -1) {
      setDocumentData((prev: DocumentData) => ({
        ...prev,
        [saveKey]: content
      }));

      // Mark as modified
      markStepModified(saveKey);
      setIsDirty(true);
    }
  };

  const handleModeSelect = (mode: StepMode) => {
    setStepModes(prev => ({ ...prev, [currentStep]: mode }));
    if (mode === 'manual') setIsDirty(true);
  };

  const handleShippingDocChange = (doc: ShippingDocType) => {
    // Save current doc content before switching
    if (editorRef.current && activeShippingDoc) {
      const content = editorRef.current.getContent();
      const saveKey = activeShippingDoc === 'CI' ? 4 : 5;
      setDocumentData((prev: DocumentData) => ({ ...prev, [saveKey]: content }));
      extractData(content);
    }
    setActiveShippingDoc(doc);
  };

  const handleVersionRestore = (version: Version) => {
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
  };

  // Get initial content for editor
  const getInitialContent = (): string => {
    const docKey = getDocKeyForStep(currentStep);
    if (docKey === -1) return '';
    const content = documentData[docKey] || hydrateTemplate(getTemplateForStep(docKey));
    return updateContentWithSharedData(content);
  };

  // Render step content
  const renderStepContent = () => {
    // Step 0: Empty State
    if (currentStep === 0) {
      return <EmptyState />;
    }

    // Step 1 & 3: Mode Selection or Content
    if ((currentStep === 1 || currentStep === 3) && !stepModes[currentStep]) {
      return (
        <ModeSelector
          currentStep={currentStep}
          onSelectMode={handleModeSelect}
        />
      );
    }

    // Skip State
    if (stepModes[currentStep] === 'skip') {
      return (
        <SkipState
          onBack={() => setStepModes(prev => ({ ...prev, [currentStep]: null }))}
        />
      );
    }

    // Upload Mode
    if (stepModes[currentStep] === 'upload') {
      return (
        <FileUploadView
          file={uploadedFiles[currentStep] || null}
          status={uploadStatus[currentStep] || 'idle'}
          documentUrl={uploadedDocumentUrls[currentStep] || null}
          error={uploadError[currentStep] || null}
          onBack={() => {
            removeUploadedFile(currentStep);
            setStepModes(prev => ({ ...prev, [currentStep]: null }));
          }}
          onUpload={(file) => handleFileUpload(currentStep, file)}
          onRetry={() => retryUpload(currentStep)}
        />
      );
    }

    // Step 4: Shipping Docs Dashboard or Editor
    if (currentStep === 4) {
      if (!activeShippingDoc) {
        return (
          <ShippingDocsDashboard
            documentData={documentData}
            onSelectDoc={setActiveShippingDoc}
          />
        );
      }
    }

    // Editor View (Manual mode or Step 2/4 with doc selected)
    return (
      <EditorView
        currentStep={currentStep}
        stepModes={stepModes}
        activeShippingDoc={activeShippingDoc}
        editorRef={editorRef}
        initialContent={getInitialContent()}
        onBack={() => {
          if (currentStep === 4 && activeShippingDoc) {
            // Save before going back to dashboard
            if (editorRef.current) {
              const content = editorRef.current.getContent();
              const saveKey = activeShippingDoc === 'CI' ? 4 : 5;
              setDocumentData((prev: DocumentData) => ({ ...prev, [saveKey]: content }));
              extractData(content);
            }
            setActiveShippingDoc(null);
          } else {
            setStepModes(prev => ({ ...prev, [currentStep]: null }));
          }
        }}
        onShippingDocChange={handleShippingDocChange}
        onChange={handleEditorChange}
      />
    );
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Version History Sidebar */}
      <VersionHistorySidebar
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        versions={versions}
        currentStep={currentStep}
        onRestore={handleVersionRestore}
      />

      {/* Header */}
      <DocumentHeader
        documentData={documentData}
        isDirty={isDirty}
        versions={versions}
        currentStep={currentStep}
        onTitleChange={(title) => setDocumentData({ ...documentData, title })}
        onBackClick={() => {
          if (isDirty) setShowExitConfirm(true);
          else onNavigate('main');
        }}
        onSave={handleSave}
        onDownload={handleDownload}
        onVersionHistoryClick={() => setShowVersionHistory(true)}
        onMyPageClick={() => setShowMyPageModal(!showMyPageModal)}
        onLogoutClick={() => setShowLogoutConfirm(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Tabs + Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Step Navigation */}
          <StepNavigation
            currentStep={currentStep}
            stepModes={stepModes}
            uploadedFiles={uploadedFiles}
            maxProgressStep={maxProgressStep}
            getStepCompletionStatus={getStepCompletionStatus}
            onStepChange={handleStepChange}
          />

          {/* Document Editor or Empty State */}
          <div className="flex-1 flex flex-col overflow-hidden p-4 mt-2">
            {renderStepContent()}
          </div>
        </div>

        {/* Chat Assistant - Slide in from right with resize handle */}
        <div
          className={`flex-shrink-0 border-l border-gray-100 flex flex-col overflow-hidden bg-white relative transition-all duration-300 ease-in-out shadow-2xl z-30 ${isChatOpen ? 'opacity-100' : 'w-0 opacity-0 border-0'} `}
          style={{ width: isChatOpen ? `${chatWidth}px` : '0', minWidth: isChatOpen ? '300px' : '0' }}
        >
          {/* Resize Handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize group z-50 flex items-center justify-center hover:w-2 transition-all duration-200"
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
          >
            {/* Handle Visual Line */}
            <div className="w-[1px] h-full bg-gradient-to-b from-transparent via-gray-300 to-transparent group-hover:bg-blue-400 transition-colors" />
          </div>
          <ChatAssistant
            currentStep={currentStep}
            onClose={() => setIsChatOpen(false)}
            editorRef={editorRef}
            onApply={handleChatApply}
            documentId={stepModes[currentStep] === 'upload' ? uploadedDocumentIds[currentStep] : null}
          />
        </div>
      </div>

      {/* Intro Animation */}
      {showIntro && (
        <ShootingStarIntro
          onComplete={() => {
            setShowIntro(false);
            setHasShownIntro(true);
          }}
          targetRect={chatButtonRef.current?.getBoundingClientRect()}
        />
      )}

      {/* Floating Chat Button */}
      {shouldShowChatButton && (hasShownIntro || showIntro) && (
        <button
          ref={chatButtonRef}
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform transition-colors duration-200 hover:scale-110 z-40 ${!hasShownIntro ? 'opacity-0 pointer-events-none' : ''}`}
          title="AI 챗봇 열기"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {/* Modals */}
      <MyPageModal
        isOpen={showMyPageModal && !showPasswordChange}
        userEmployeeId={userEmployeeId}
        onClose={() => setShowMyPageModal(false)}
        onPasswordChange={() => setShowPasswordChange(true)}
        onLogout={() => setShowLogoutConfirm(true)}
      />

      <PasswordChangeModal
        isOpen={showPasswordChange}
        onClose={() => setShowPasswordChange(false)}
      />

      <ExitConfirmModal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onExit={() => {
          setShowExitConfirm(false);
          onNavigate('main');
        }}
      />

      <SaveSuccessModal
        isOpen={showSaveSuccessModal}
        documentData={documentData}
        modifiedSteps={modifiedSteps}
        onClose={() => setShowSaveSuccessModal(false)}
      />

      <DownloadModal
        isOpen={showDownloadModal}
        documentData={documentData}
        onClose={() => setShowDownloadModal(false)}
        onDownload={handleBatchDownload}
      />

      <LogoutConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onLogout={onLogout}
      />
    </div>
  );
}
