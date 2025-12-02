import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Sparkles,
  User,
  LogOut,
  Plus,
  FileText,
  MousePointerClick,
  Save,
  Download,
  CheckCircle,
  Check,
  Lock,
  Upload,
  PenTool,
  Paperclip,
  X,
  File,
  MinusCircle,
  Ban,
  Package
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { motion, AnimatePresence } from 'framer-motion';
import { PageType, DocumentData } from '../App';
import ContractEditor, { ContractEditorRef } from './editor/ContractEditor';
import ChatAssistant from './ChatAssistant';
import { MappedDataConfirmBanner } from './MappedDataConfirmBanner';
import { ShootingStarIntro } from './ShootingStarIntro';
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  // Track which steps have been actually modified or already existed
  const [modifiedSteps, setModifiedSteps] = useState<Set<number>>(() => {
    const initialSteps = Object.keys(documentData)
      .filter(k => k !== 'title')
      .map(Number);
    return new Set(initialSteps);
  });

  const [sharedData, setSharedData] = useState<Record<string, string>>({});
  const [shippingOrder, setShippingOrder] = useState<('CI' | 'PL')[] | null>(null);
  const [activeShippingDoc, setActiveShippingDoc] = useState<'CI' | 'PL' | null>(null);
  const [hasMappedFields, setHasMappedFields] = useState(false);
  const [showConfirmBanner, setShowConfirmBanner] = useState(false);
  const [reviewCompleted, setReviewCompleted] = useState(false);

  // New state for Upload vs Manual
  const [stepModes, setStepModes] = useState<Record<number, 'manual' | 'upload' | 'skip' | null>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<number, File | null>>({});

  // Download Modal State
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedDownloadSteps, setSelectedDownloadSteps] = useState<Set<number>>(new Set());

  // Intro Animation State
  const [hasShownIntro, setHasShownIntro] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const chatButtonRef = useRef<HTMLButtonElement>(null);

  // Calculate visibility for chatbot button
  const shouldShowChatButton = !isChatOpen && currentStep >= 1 && currentStep <= 5 && (
    // Step 2 (PI): Always show (direct entry)
    (currentStep === 2) ||
    // Step 1, 3: Mode selected (Manual or Upload+File)
    ((currentStep === 1 || currentStep === 3) && stepModes[currentStep] && stepModes[currentStep] !== 'skip' && (
      (stepModes[currentStep] === 'manual') ||
      (stepModes[currentStep] === 'upload' && uploadedFiles[currentStep])
    )) ||
    // Step 4: Shipping Doc selected
    (currentStep === 4 && activeShippingDoc)
  );

  // Trigger Intro Animation
  useEffect(() => {
    if (shouldShowChatButton && !hasShownIntro && !showIntro) {
      setShowIntro(true);
    }
  }, [shouldShowChatButton, hasShownIntro, showIntro]);

  // Dynamic step names based on shippingOrder
  const stepShortNames = [
    'Offer Sheet',
    'Proforma Invoice (PI)',
    'Sales Contract',
    'Shipping Documents'
  ];

  // Helper to map visual step number to document data key
  // Step 1 -> 1 (Offer)
  // Step 2 -> 2 (PI)
  // Step 3 -> 3 (Contract)
  // Step 4 -> 4 (CI) or 5 (PL) based on activeShippingDoc
  const getDocKeyForStep = (step: number): number => {
    if (step <= 3) return step;
    if (step === 4) {
      if (activeShippingDoc === 'CI') return 4;
      if (activeShippingDoc === 'PL') return 5;
      return -1; // Dashboard mode
    }
    return -1;
  };

  const hydrateTemplate = (template: string) => {
    if (!template) return '';

    // Replace <mark>[key]</mark> with <span data-field-id="key">...</span>
    return template.replace(/<mark>\[(.*?)\]<\/mark>/g, (match, key) => {
      const value = sharedData[key];
      // If we have a value, use it. Otherwise keep the placeholder [key]
      const content = value || `[${key}]`;
      // If we have a value, it's mapped data.
      const sourceAttr = value ? ' data-source="mapped"' : '';
      return `<span data-field-id="${key}"${sourceAttr}>${content}</span>`;
    });
  };

  // Helper to extract data from current content
  const extractData = (content: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const fields = doc.querySelectorAll('span[data-field-id]');

    const newData: Record<string, string> = {};
    fields.forEach(field => {
      const key = field.getAttribute('data-field-id');
      const value = field.textContent;

      // Only save if it's not the placeholder itself
      if (key && value && value !== `[${key}]`) {
        newData[key] = value;
      }
    });

    if (Object.keys(newData).length > 0) {
      setSharedData(prev => ({ ...prev, ...newData }));
    }
  };

  // Helper to update existing content with latest shared data
  const updateContentWithSharedData = (content: string) => {
    if (!content) return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const fields = doc.querySelectorAll('span[data-field-id]');

    let modified = false;
    fields.forEach(field => {
      const key = field.getAttribute('data-field-id');
      if (key && sharedData[key]) {
        // If the field content is different from sharedData (and sharedData is not empty), update it
        // Also update if the field is currently a placeholder
        if (field.textContent !== sharedData[key]) {
          field.textContent = sharedData[key];
          // Mark as mapped since it's coming from shared data
          field.setAttribute('data-source', 'mapped');
          modified = true;
        }
      }
    });

    return modified ? doc.body.innerHTML : content;
  };

  // Helper to check if a step is complete (all placeholders filled)
  const checkStepCompletion = (content: string) => {
    if (!content) return false;
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const fields = doc.querySelectorAll('span[data-field-id]');

    // Check if any field still has the placeholder value [fieldId]
    // We iterate through all fields and return false if ANY field is still a placeholder
    for (const field of fields) {
      const key = field.getAttribute('data-field-id');
      const value = field.textContent;
      if (key && value === `[${key}]`) {
        return false;
      }
    }

    // If we have fields and none are placeholders, it's complete.
    // Also check if there are any fields at all (if no fields, maybe it's not "complete" in the sense of filling forms, but let's assume it is if it's not empty)
    return fields.length > 0;
  };

  const handleStepChange = (newStep: number) => {
    // Save current step's data before moving
    if (editorRef.current) {
      const content = editorRef.current.getContent();

      // Determine save key
      let saveKey = -1;
      if (currentStep <= 3) saveKey = currentStep;
      else if (shippingOrder) {
        saveKey = getDocKeyForStep(currentStep);
      }

      if (saveKey !== -1) {
        const newDocData = {
          ...documentData,
          [saveKey]: content
        };
        setDocumentData(newDocData);
        extractData(content);
      }
    }
    setCurrentStep(newStep);
  };

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
    // Extract data before saving
    if (editorRef.current) {
      const content = editorRef.current.getContent();
      extractData(content);

      let saveKey = -1;
      if (currentStep <= 3) saveKey = currentStep;
      else if (shippingOrder) {
        saveKey = getDocKeyForStep(currentStep);
      }

      // Update local state first
      const newDocData = {
        ...documentData,
        [saveKey]: content
      };
      setDocumentData(newDocData);

      // Then call parent save
      onSave(newDocData, currentStep); // Note: onSave might need update if it relies on step number strictly
    } else {
      onSave(documentData, currentStep);
    }
    setIsDirty(false);
    setShowSaveSuccessModal(true);
  };

  const handleChatApply = (content: string, step: number) => {
    // Inject data-source="agent" into the content
    // We parse the content, find all data fields that are NOT placeholders, and add source="agent"
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const fields = doc.querySelectorAll('span[data-field-id]');

    fields.forEach(field => {
      const key = field.getAttribute('data-field-id');
      const value = field.textContent;
      // If it has a value and is not a placeholder
      if (key && value && value !== `[${key}]`) {
        field.setAttribute('data-source', 'agent');
      }
    });

    const contentWithSource = doc.body.innerHTML;

    // 1. Extract data to update sharedData
    extractData(contentWithSource);

    // 2. Update documentData for the specific step
    setDocumentData((prev: DocumentData) => ({
      ...prev,
      [step]: contentWithSource
    }));

    // 3. Mark as modified
    setModifiedSteps(prev => {
      const newSet = new Set(prev);
      newSet.add(step);
      return newSet;
    });

    setIsDirty(true);

    // 4. Navigation logic for chat apply
    // If step is 4 (CI) or 5 (PL), we need to handle it
    // This is tricky with dynamic steps. We might need to force a shippingOrder if not set.
    // For now, let's assume if user asks for CI, we set order to [CI, PL] if not set.
    if (step === 4 || step === 5) {
      if (!shippingOrder) {
        if (step === 4) setShippingOrder(['CI', 'PL']);
        else setShippingOrder(['PL', 'CI']);
      }
      // Find which visual step corresponds to this doc key
      // If shippingOrder is [CI, PL]: CI=4, PL=5. Visual 4->CI, 5->PL.
      // If shippingOrder is [PL, CI]: PL=5, CI=4. Visual 4->PL, 5->CI.

      let targetVisualStep = -1;
      if (shippingOrder) {
        if (shippingOrder[0] === (step === 4 ? 'CI' : 'PL')) targetVisualStep = 4;
        else targetVisualStep = 5;
      } else {
        // If we just set it, it will be 4
        targetVisualStep = 4;
      }

      if (targetVisualStep !== -1) setCurrentStep(targetVisualStep);
    } else {
      if (currentStep !== step) setCurrentStep(step);
    }

    if (editorRef.current) {
      editorRef.current.setContent(contentWithSource);
    }
  };

  const handleMappedFieldsDetected = (hasMapped: boolean) => {
    setHasMappedFields(hasMapped);
    if (hasMapped && !showConfirmBanner) {
      setShowConfirmBanner(true);
    }
  };

  const handleConfirmMapped = async () => {
    if (reviewCompleted) {
      // If already reviewed, this is the final confirmation
      handleFinalConfirm();
    } else {
      // First click: review all mapped fields (scroll through groups)
      await editorRef.current?.reviewMappedFields();
      setReviewCompleted(true);
    }
  };

  const handleFinalConfirm = () => {
    // Remove all highlights when user confirms
    editorRef.current?.confirmMappedData();

    setShowConfirmBanner(false);
    setHasMappedFields(false);
    setReviewCompleted(false);
  };

  const handleDismissBanner = () => {
    setShowConfirmBanner(false);
    setReviewCompleted(false);
  };

  // Check for mapped fields on document entry
  useEffect(() => {
    if (!editorRef.current) return;

    // Check if current document has mapped fields
    const checkForMappedFields = () => {
      const content = editorRef.current?.getContent();
      if (!content) return;

      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      const mappedFields = doc.querySelectorAll('span[data-field-id][data-source="mapped"]');

      if (mappedFields.length > 0) {
        setHasMappedFields(true);
        setShowConfirmBanner(true);
      }
    };

    // Small delay to ensure editor is fully loaded
    const timer = setTimeout(checkForMappedFields, 300);
    return () => clearTimeout(timer);
  }, [currentStep, activeShippingDoc]);

  const handleDownload = () => {
    // 1. Sync current editor content to documentData before opening modal
    if (editorRef.current) {
      const content = editorRef.current.getContent();
      extractData(content);

      let saveKey = -1;
      if (currentStep <= 3) saveKey = currentStep;
      else if (shippingOrder) {
        saveKey = getDocKeyForStep(currentStep);
      }

      if (saveKey !== -1) {
        setDocumentData({
          ...documentData,
          [saveKey]: content
        });
      }
    }

    // 2. Initialize selection with all available steps (that have content)
    // We filter out 'title' and ensure we only pick steps that have actual content string
    const availableSteps = Object.keys(documentData)
      .filter(k => k !== 'title')
      .map(Number)
      .filter(step => documentData[step] && typeof documentData[step] === 'string' && documentData[step].length > 0);

    setSelectedDownloadSteps(new Set(availableSteps));
    setShowDownloadModal(true);
  };

  const handleBatchDownload = async () => {
    // Hide modal first
    setShowDownloadModal(false);

    for (const stepIndex of selectedDownloadSteps) {
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

      // Create a container for PDF rendering
      // We use a fixed width to ensure consistent PDF output (A4 width approx)
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '210mm'; // A4 width
      container.style.padding = '20mm'; // A4 margins
      container.style.backgroundColor = 'white';
      container.style.color = 'black';
      container.style.fontFamily = 'sans-serif';
      container.style.fontSize = '12pt';
      container.style.lineHeight = '1.5';

      // Add some basic styles for tables to match the editor/template
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
        // Generate Canvas
        const canvas = await html2canvas(container, {
          scale: 2, // Higher scale for better quality
          useCORS: true,
          logging: false
        });

        // Generate PDF
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
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

        // Get document name
        const docName = stepShortNames[stepIndex - 1] || `Document_${stepIndex}`;
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

  const handleFileUpload = (step: number, file: File) => {
    setUploadedFiles(prev => ({ ...prev, [step]: file }));
    // Auto-complete step if needed, or just let the state update trigger it
  };

  const removeUploadedFile = (step: number) => {
    setUploadedFiles(prev => {
      const newFiles = { ...prev };
      delete newFiles[step];
      return newFiles;
    });
  };

  // Helper to check completion status for a specific step index (1-based)
  const getStepCompletionStatus = (stepNumber: number) => {
    // Check for uploaded file first
    if (uploadedFiles[stepNumber]) return true;

    // Check for skip mode
    if (stepModes[stepNumber] === 'skip') return true;

    if (stepNumber <= 3) {
      // If mode is upload but no file, it's incomplete (handled by first check)
      // If mode is manual or null, check content
      if (stepModes[stepNumber] === 'upload' && !uploadedFiles[stepNumber]) return false;

      const stepContent = documentData[stepNumber] || hydrateTemplate(
        stepNumber === 1 ? offerSheetTemplateHTML :
          stepNumber === 2 ? proformaInvoiceTemplateHTML :
            stepNumber === 3 ? saleContractTemplateHTML : ''
      );
      return checkStepCompletion(stepContent);
    } else {
      // Shipping Documents Hub (Step 4)
      if (stepNumber === 4) {
        const ciContent = documentData[4] || hydrateTemplate(commercialInvoiceTemplateHTML);
        const plContent = documentData[5] || hydrateTemplate(packingListTemplateHTML);

        const isCiComplete = checkStepCompletion(ciContent);
        const isPlComplete = checkStepCompletion(plContent);

        return isCiComplete && isPlComplete;
      }
      return false;
    }
  };

  // Calculate the furthest step that is either current or completed
  let maxProgressStep = currentStep;
  for (let i = 1; i <= stepShortNames.length; i++) {
    if (getStepCompletionStatus(i)) {
      if (i > maxProgressStep) maxProgressStep = i;
    }
  }

  const renderStepContent = () => {
    // 0. Initial Empty State
    if (currentStep === 0) {
      return (
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
      );
    }

    // 1. Offer Sheet (Step 1) and Sales Contract (Step 3) Choice Logic
    if ((currentStep === 1 || currentStep === 3) && !stepModes[currentStep]) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            {currentStep === 1 ? 'Offer Sheet' : 'Sales Contract'} 작성 방식 선택
          </h2>
          <p className="text-gray-500 mb-12 text-lg">원하시는 작성 방식을 선택해주세요.</p>

          <div className="flex gap-8">
            {/* Manual Entry Option */}
            <motion.button
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStepModes(prev => ({ ...prev, [currentStep]: 'manual' }))}
              className="w-64 h-80 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border-2 border-blue-100 flex flex-col items-center justify-center p-6 shadow-lg hover:shadow-xl transition-all group"
            >
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-md group-hover:scale-110 transition-transform">
                <PenTool className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">직접 작성</h3>
              <p className="text-sm text-gray-500 text-center leading-relaxed">
                템플릿을 사용하여<br />직접 내용을 입력합니다.
              </p>
            </motion.button>

            {/* File Upload Option */}
            <motion.button
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStepModes(prev => ({ ...prev, [currentStep]: 'upload' }))}
              className="w-64 h-80 bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl border-2 border-purple-100 flex flex-col items-center justify-center p-6 shadow-lg hover:shadow-xl transition-all group"
            >
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-md group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">파일 업로드</h3>
              <p className="text-sm text-gray-500 text-center leading-relaxed">
                이미 작성된 파일을<br />업로드합니다.
              </p>
            </motion.button>

            {/* Skip Option */}
            <motion.button
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStepModes(prev => ({ ...prev, [currentStep]: 'skip' }))}
              className="w-64 h-80 bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl border-2 border-gray-200 flex flex-col items-center justify-center p-6 shadow-lg hover:shadow-xl transition-all group"
            >
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-md group-hover:scale-110 transition-transform">
                <Ban className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">건너뛰기</h3>
              <p className="text-sm text-gray-500 text-center leading-relaxed">
                이 단계는 작성하지 않고<br />넘어갑니다.
              </p>
            </motion.button>
          </div>
        </div>
      );
    }

    // 2. Upload UI
    if ((currentStep === 1 || currentStep === 3) && stepModes[currentStep] === 'upload') {
      const file = uploadedFiles[currentStep];

      return (
        <div className="h-full flex flex-col p-4">
          <div className="mb-4 flex-shrink-0">
            <button
              onClick={() => {
                setStepModes(prev => ({ ...prev, [currentStep]: null }));
                removeUploadedFile(currentStep);
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-medium">다시 선택하기</span>
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden p-8">
            {file ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center"
              >
                <div className="w-32 h-32 bg-green-50 rounded-full flex items-center justify-center mb-6 relative">
                  <File className="w-16 h-16 text-green-600" />
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -right-2 -bottom-2 bg-green-500 text-white p-2 rounded-full shadow-lg"
                  >
                    <Check className="w-6 h-6" />
                  </motion.div>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{file.name}</h3>
                <p className="text-gray-500 mb-8">{(file.size / 1024 / 1024).toFixed(2)} MB</p>

                <button
                  onClick={() => removeUploadedFile(currentStep)}
                  className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors font-medium"
                >
                  <X className="w-5 h-5" />
                  파일 삭제하고 다시 올리기
                </button>
              </motion.div>
            ) : (
              <div className="w-full max-w-2xl">
                <label
                  className="flex flex-col items-center justify-center w-full h-96 border-3 border-dashed border-gray-300 rounded-3xl cursor-pointer bg-gray-50 hover:bg-blue-50 hover:border-blue-400 transition-all group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex flex-col items-center justify-center pt-5 pb-6 relative z-10">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <Upload className="w-10 h-10 text-gray-400 group-hover:text-blue-500" />
                    </div>
                    <p className="mb-2 text-xl text-gray-600 font-medium">
                      <span className="font-bold text-blue-600">클릭하여 업로드</span> 또는 파일을 여기로 드래그하세요
                    </p>
                    <p className="text-sm text-gray-500">PDF, Word, Excel, Image (최대 10MB)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(currentStep, e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 3. Skipped State UI
    if ((currentStep === 1 || currentStep === 3) && stepModes[currentStep] === 'skip') {
      return (
        <div className="h-full flex flex-col p-4">
          <div className="mb-4 flex-shrink-0">
            <button
              onClick={() => setStepModes(prev => ({ ...prev, [currentStep]: null }))}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-medium">다시 선택하기</span>
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center"
            >
              <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mb-6 relative">
                <Ban className="w-16 h-16 text-gray-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">이 단계는 건너뛰었습니다</h3>
              <p className="text-gray-500 mb-8">필요한 경우 다시 선택하기를 눌러 작성할 수 있습니다.</p>
            </motion.div>
          </div>
        </div>
      );
    }

    // 4. Shipping Documents Hub (Step 4) Dashboard
    if (currentStep === 4 && !activeShippingDoc) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden p-8">
          {/* Background Decor */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-20 left-20 w-72 h-72 bg-blue-50 rounded-full blur-3xl opacity-50 animate-pulse" />
            <div className="absolute bottom-20 right-20 w-80 h-80 bg-indigo-50 rounded-full blur-3xl opacity-50 animate-pulse delay-700" />
          </div>

          <div className="relative z-10 text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">선적 서류 작성</h2>
            <p className="text-gray-500 text-lg">
              Commercial Invoice와 Packing List를<br />
              자유롭게 오가며 작성할 수 있습니다.
            </p>
          </div>

          <div className="relative z-10 flex gap-8">
            {/* Commercial Invoice Card */}
            <motion.button
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveShippingDoc('CI')}
              className="w-72 h-80 bg-white/80 backdrop-blur-xl rounded-3xl border border-blue-100 flex flex-col items-center justify-center p-6 shadow-xl hover:shadow-2xl hover:border-blue-300 transition-all group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform relative z-10">
                <FileText className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 relative z-10">Commercial Invoice</h3>
              <p className="text-sm text-gray-500 text-center leading-relaxed relative z-10">
                상업 송장을<br />작성합니다.
              </p>

              {/* Status Indicator */}
              {documentData[4] && (
                <div className="absolute top-4 right-4 bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  작성됨
                </div>
              )}
            </motion.button>

            {/* Packing List Card */}
            <motion.button
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveShippingDoc('PL')}
              className="w-72 h-80 bg-white/80 backdrop-blur-xl rounded-3xl border border-indigo-100 flex flex-col items-center justify-center p-6 shadow-xl hover:shadow-2xl hover:border-indigo-300 transition-all group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform relative z-10">
                <Package className="w-10 h-10 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 relative z-10">Packing List</h3>
              <p className="text-sm text-gray-500 text-center leading-relaxed relative z-10">
                포장 명세서를<br />작성합니다.
              </p>

              {/* Status Indicator */}
              {documentData[5] && (
                <div className="absolute top-4 right-4 bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  작성됨
                </div>
              )}
            </motion.button>
          </div>
        </div>
      );
    }

    // 4. Default Editor (Manual Entry)
    return (
      <div className="flex flex-col h-full">
        {/* Back to Selection Button (Only for Step 1 & 3 in Manual Mode) */}
        {(currentStep === 1 || currentStep === 3) && stepModes[currentStep] === 'manual' && (
          <div className="mb-4 flex-shrink-0">
            <button
              onClick={() => setStepModes(prev => ({ ...prev, [currentStep]: null }))}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-medium">작성 방식 다시 선택하기</span>
            </button>
          </div>
        )}

        {/* Quick Switcher for Shipping Documents (Step 4) */}
        {currentStep === 4 && activeShippingDoc && (
          <div className="flex justify-center mb-6">
            <div className="bg-gray-100 p-1.5 rounded-full flex items-center shadow-inner gap-1">
              <button
                onClick={() => setActiveShippingDoc('CI')}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activeShippingDoc === 'CI'
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                  }`}
              >
                <FileText className="w-4 h-4" />
                Commercial Invoice
              </button>
              <button
                onClick={() => setActiveShippingDoc('PL')}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activeShippingDoc === 'PL'
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                  }`}
              >
                <Package className="w-4 h-4" />
                Packing List
              </button>
            </div>
          </div>
        )}

        <ContractEditor
          key={`${currentStep}-${activeShippingDoc || 'default'}`}
          ref={editorRef}
          className="flex-1 min-h-0"
          initialContent={
            updateContentWithSharedData(
              (() => {
                const docKey = getDocKeyForStep(currentStep);
                if (docKey === -1) return '';

                const template =
                  docKey === 1 ? offerSheetTemplateHTML :
                    docKey === 2 ? proformaInvoiceTemplateHTML :
                      docKey === 3 ? saleContractTemplateHTML :
                        docKey === 4 ? commercialInvoiceTemplateHTML :
                          docKey === 5 ? packingListTemplateHTML : '';

                return documentData[docKey] || hydrateTemplate(template);
              })()
            )
          }
          onChange={(content) => {
            const saveKey = getDocKeyForStep(currentStep);
            if (saveKey !== -1) {
              setDocumentData({
                ...documentData,
                [saveKey]: content
              });

              // Mark as modified
              if (!modifiedSteps.has(saveKey)) {
                setModifiedSteps(prev => new Set(prev).add(saveKey));
              }

              setIsDirty(true);
            }
          }}
          onMappedFieldsDetected={handleMappedFieldsDetected}
        />
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Mapped Data Confirmation Banner */}
      {showConfirmBanner && hasMappedFields && (
        <MappedDataConfirmBanner
          onConfirm={handleConfirmMapped}
          onDismiss={handleDismissBanner}
          isChatOpen={isChatOpen}
          chatWidth={chatWidth}
          reviewCompleted={reviewCompleted}
        />
      )}

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
              onClick={() => setShowLogoutConfirm(true)}
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
          <div className="px-8 py-4 bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm flex-shrink-0 z-10 relative">
            <div className="max-w-6xl mx-auto relative">
              {/* Progress Line Background */}
              <div
                className="absolute top-[15px] h-1 bg-gray-200 rounded-full overflow-hidden"
                style={{
                  left: `calc(100% / ${stepShortNames.length * 2})`,
                  width: `calc(100% * ${(stepShortNames.length - 1) / stepShortNames.length})`
                }}
              >
                {/* Animated Progress Line */}
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${((maxProgressStep - 1) / (stepShortNames.length - 1)) * 100}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              </div>

              <div
                className="grid items-center relative"
                style={{ gridTemplateColumns: `repeat(${stepShortNames.length}, 1fr)` }}
              >
                {stepShortNames.map((name, index) => {
                  const stepNumber = index + 1;
                  const isActive = currentStep === stepNumber;

                  // Determine completion status
                  const isComplete = getStepCompletionStatus(stepNumber);

                  // Check accessibility
                  let isAccessible = true;
                  if (stepNumber > 1) {
                    const prevStepNumber = stepNumber - 1;
                    const prevStepComplete = getStepCompletionStatus(prevStepNumber);
                    isAccessible = prevStepComplete;
                  }

                  return (
                    <div key={index} className="flex flex-col items-center gap-2 relative group z-10">
                      <motion.button
                        onClick={() => isAccessible && handleStepChange(stepNumber)}
                        disabled={!isAccessible}
                        initial={false}
                        animate={{
                          scale: isActive ? 1.2 : isAccessible ? 1 : 0.9,
                          opacity: !isAccessible ? 0.6 : 1,
                        }}
                        whileHover={isAccessible ? { scale: isActive ? 1.25 : 1.1 } : {}}
                        whileTap={isAccessible ? { scale: 0.95 } : {}}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-colors duration-300 relative ${isActive
                          ? 'bg-blue-600 ring-4 ring-blue-100'
                          : isComplete
                            ? 'bg-green-500'
                            : !isAccessible
                              ? 'bg-gray-200'
                              : 'bg-white border-2 border-gray-300 hover:border-blue-400'
                          }`}
                      >
                        <AnimatePresence mode="wait">
                          {isActive ? (
                            <motion.div
                              key="active"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="w-2.5 h-2.5 bg-white rounded-full"
                            />
                          ) : isComplete ? (
                            <motion.div
                              key="complete"
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0, rotate: 180 }}
                            >
                              {/* Show Paperclip if uploaded, MinusCircle if skipped, otherwise Check */}
                              {uploadedFiles[stepNumber] ? (
                                <Paperclip className="w-4 h-4 text-white" />
                              ) : stepModes[stepNumber] === 'skip' ? (
                                <MinusCircle className="w-4 h-4 text-white" />
                              ) : (
                                <Check className="w-4 h-4 text-white" />
                              )}
                            </motion.div>
                          ) : !isAccessible ? (
                            <motion.div
                              key="locked"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <Lock className="w-3.5 h-3.5 text-gray-400" />
                            </motion.div>
                          ) : (
                            <motion.div
                              key="next"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                            >
                              <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-400" />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Pulse effect for next accessible step */}
                        {isAccessible && !isComplete && !isActive && (
                          <span className="absolute inset-0 rounded-full animate-ping bg-blue-400 opacity-20" />
                        )}
                      </motion.button>

                      {/* Label */}
                      <motion.span
                        animate={{
                          y: isActive ? 0 : 0,
                          opacity: isActive ? 1 : isAccessible ? 0.8 : 0.5,
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? '#2563EB' : isAccessible ? '#4B5563' : '#9CA3AF'
                        }}
                        className="text-xs whitespace-nowrap flex items-center gap-1"
                      >
                        {name}
                        {/* Show small icon next to name if mode is selected */}
                        {stepModes[stepNumber] === 'upload' && <Paperclip className="w-3 h-3" />}
                        {(stepModes[stepNumber] === 'manual' || stepNumber === 2 || stepNumber === 4) && <PenTool className="w-3 h-3" />}
                        {stepModes[stepNumber] === 'skip' && <Ban className="w-3 h-3" />}
                      </motion.span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

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
          <ChatAssistant currentStep={currentStep} onClose={toggleChat} editorRef={editorRef} onApply={handleChatApply} />
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
          onClick={toggleChat}
          className={`fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform transition-colors duration-200 hover:scale-110 z-40 ${!hasShownIntro ? 'opacity-0 pointer-events-none' : ''}`}
          title="AI 챗봇 열기"
        >
          {/* Show icon only after intro is finished */}
          <Sparkles className="w-6 h-6" />
        </button>
      )}


      {/* My Page Modal */}
      {
        showMyPageModal && !showPasswordChange && (
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
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full px-6 py-4 text-gray-700 hover:bg-gray-50 transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Password Change Modal */}
      {
        showPasswordChange && (
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
        )
      }

      {/* Exit Confirmation Modal */}
      {
        showExitConfirm && (
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
        )
      }

      {/* Save Success Modal */}
      {
        showSaveSuccessModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 w-[420px] shadow-2xl transform transition-all scale-100 animate-bounce-in relative overflow-hidden border border-white/20">
              {/* Background Decor */}
              <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full blur-3xl opacity-50" />
                <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-gradient-to-tr from-purple-100 to-pink-100 rounded-full blur-3xl opacity-50" />
              </div>

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-200 animate-pulse">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>

                <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-700 mb-2">저장 완료!</h3>
                <p className="text-gray-500 mb-8 leading-relaxed">
                  문서가 성공적으로 저장되었습니다.<br />
                  <span className="text-sm text-gray-400">작성 중인 내용은 언제든 다시 불러올 수 있습니다.</span>
                </p>

                <div className="w-full bg-white/60 backdrop-blur-sm rounded-2xl border border-white/50 shadow-inner p-5 mb-8 text-left relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-b from-white/50 to-transparent pointer-events-none"></div>
                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      저장된 문서
                    </p>
                    <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Saved</span>
                  </div>

                  <div className="space-y-2 relative z-10">
                    {Object.keys(documentData)
                      .filter(k => k !== 'title')
                      .map(Number)
                      .filter(stepIndex => modifiedSteps.has(stepIndex)) // Only show modified steps
                      .sort((a, b) => a - b) // Sort by step number
                      .map((stepIndex) => {
                        return (
                          <div key={stepIndex} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/50 transition-colors">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                            <span className="text-sm text-gray-700 font-medium">{stepShortNames[stepIndex - 1]}</span>
                          </div>
                        );
                      })}
                    {Object.keys(documentData).filter(k => k !== 'title').map(Number).filter(s => modifiedSteps.has(s)).length === 0 && (
                      <p className="text-sm text-gray-400 italic text-center py-2">저장된 내용이 없습니다.</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setShowSaveSuccessModal(false)}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3.5 rounded-xl transition-all duration-200 font-semibold shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5 active:translate-y-0"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Download Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white/90 backdrop-blur-xl rounded-3xl w-[500px] overflow-hidden shadow-2xl border border-white/20 relative"
          >
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full blur-3xl opacity-50" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-gradient-to-tr from-purple-100 to-pink-100 rounded-full blur-3xl opacity-50" />
            </div>

            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/30 shadow-inner">
                  <Download className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">문서 다운로드</h3>
                  <p className="text-blue-100 text-xs font-medium mt-0.5">다운로드할 문서를 선택해주세요</p>
                </div>
              </div>
              <button
                onClick={() => setShowDownloadModal(false)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  선택된 문서: <span className="text-blue-600">{selectedDownloadSteps.size}개</span>
                </span>
                <button
                  onClick={() => {
                    const allSteps = Object.keys(documentData)
                      .filter(k => k !== 'title')
                      .map(Number)
                      .filter(step => documentData[step] && typeof documentData[step] === 'string' && documentData[step].length > 0);

                    if (selectedDownloadSteps.size === allSteps.length) {
                      setSelectedDownloadSteps(new Set());
                    } else {
                      setSelectedDownloadSteps(new Set(allSteps));
                    }
                  }}
                  className="text-xs text-gray-500 hover:text-blue-600 font-medium px-3 py-1.5 bg-white rounded-full border border-gray-200 hover:border-blue-200 hover:shadow-sm transition-all"
                >
                  {selectedDownloadSteps.size === Object.keys(documentData).filter(k => k !== 'title' && documentData[k]).length ? '전체 해제' : '전체 선택'}
                </button>
              </div>

              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.keys(documentData)
                  .filter(k => k !== 'title')
                  .map(Number)
                  .filter(step => documentData[step] && typeof documentData[step] === 'string' && documentData[step].length > 0)
                  .sort((a, b) => a - b)
                  .map((stepIndex) => (
                    <div
                      key={stepIndex}
                      onClick={() => {
                        const newSet = new Set(selectedDownloadSteps);
                        if (newSet.has(stepIndex)) newSet.delete(stepIndex);
                        else newSet.add(stepIndex);
                        setSelectedDownloadSteps(newSet);
                      }}
                      className={`
                        flex items-center p-3.5 rounded-xl border cursor-pointer transition-all duration-200 group relative overflow-hidden
                        ${selectedDownloadSteps.has(stepIndex)
                          ? 'bg-blue-50/50 border-blue-200 shadow-sm'
                          : 'bg-white/60 border-gray-200 hover:border-blue-300 hover:bg-white/80 hover:shadow-md'}
                      `}
                    >
                      <div className={`
                        w-5 h-5 rounded-md border flex items-center justify-center mr-3.5 transition-all duration-200 relative z-10
                        ${selectedDownloadSteps.has(stepIndex)
                          ? 'bg-blue-600 border-blue-600 shadow-sm scale-110'
                          : 'border-gray-300 bg-white group-hover:border-blue-400'}
                      `}>
                        {selectedDownloadSteps.has(stepIndex) && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="flex-1 relative z-10">
                        <p className={`text-sm font-semibold transition-colors ${selectedDownloadSteps.has(stepIndex) ? 'text-blue-900' : 'text-gray-700 group-hover:text-gray-900'}`}>
                          {stepShortNames[stepIndex - 1] || `Step ${stepIndex}`}
                        </p>
                      </div>
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-200 relative z-10
                        ${selectedDownloadSteps.has(stepIndex)
                          ? 'bg-white border-blue-100 text-blue-600 shadow-sm'
                          : 'bg-gray-50 border-gray-100 text-gray-400 group-hover:bg-white group-hover:border-blue-100 group-hover:text-blue-500'}
                      `}>
                        <FileText className="w-4 h-4" />
                      </div>

                      {/* Selection Highlight */}
                      {selectedDownloadSteps.has(stepIndex) && (
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 pointer-events-none" />
                      )}
                    </div>
                  ))}

                {Object.keys(documentData).filter(k => k !== 'title' && documentData[k]).length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500 text-sm font-medium">저장된 문서가 없습니다.</p>
                    <p className="text-gray-400 text-xs mt-1">문서를 먼저 작성해주세요.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 bg-white/60 backdrop-blur-md border-t border-white/50 flex justify-end gap-3 relative z-10">
              <button
                onClick={() => setShowDownloadModal(false)}
                className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-xl transition-colors text-sm font-medium"
              >
                취소
              </button>
              <button
                onClick={handleBatchDownload}
                disabled={selectedDownloadSteps.size === 0}
                className={`
                  px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg transition-all duration-200
                  ${selectedDownloadSteps.size === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5 active:translate-y-0'}
                `}
              >
                <Download className="w-4 h-4" />
                {selectedDownloadSteps.size}개 문서 다운로드
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white/90 backdrop-blur-xl rounded-3xl w-[400px] overflow-hidden shadow-2xl border border-white/20 relative"
          >
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br from-red-100 to-orange-100 rounded-full blur-3xl opacity-50" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-gradient-to-tr from-orange-100 to-yellow-100 rounded-full blur-3xl opacity-50" />
            </div>

            <div className="p-8 text-center relative z-10">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner transform rotate-3">
                <LogOut className="w-8 h-8 text-red-500" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">작성 중인 문서가 있습니다</h3>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                로그아웃하면 작성 중인 내용이 저장되지 않을 수 있습니다.<br />
                정말 로그아웃 하시겠습니까?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-medium text-sm shadow-sm"
                >
                  취소
                </button>
                <button
                  onClick={onLogout}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-red-200 hover:-translate-y-0.5 transition-all font-bold text-sm shadow-md"
                >
                  로그아웃
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}