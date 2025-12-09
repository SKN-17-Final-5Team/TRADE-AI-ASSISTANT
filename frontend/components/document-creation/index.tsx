// DocumentCreationPage - 메인 컴포넌트
import { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Paperclip, MinusCircle, Check, Lock, Plus, ChevronUp, ChevronDown, Ban, PenTool, ArrowLeft, FileText, Package, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
import type { DocumentCreationPageProps, StepMode, ShippingDocType } from './types';
import { STEP_SHORT_NAMES } from './types';

// Hooks
import { useFileUpload } from './hooks/useFileUpload';
import { useSharedData } from './hooks/useSharedData';
import { useDocumentState } from './hooks/useDocumentState';

// Layout Components
import { DocumentHeader } from './layout';

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


export default function DocumentCreationPage({
  currentStep,
  setCurrentStep,
  documentData,
  setDocumentData,
  onNavigate,
  userEmployeeId,
  onLogout,
  onSave,
  onCreateTrade,
  onExit,
  versions = [],
  onRestore,
  initialActiveShippingDoc,
  getDocId
}: DocumentCreationPageProps) {
  const editorRef = useRef<ContractEditorRef>(null);
  const chatButtonRef = useRef<HTMLButtonElement>(null);

  // Custom Hooks
  const {
    uploadedFiles,
    uploadedFileNames,
    uploadStatus,
    uploadError,
    uploadedDocumentIds,
    uploadedDocumentUrls,
    handleFileUpload,
    removeUploadedFile,
    retryUpload
  } = useFileUpload(
    documentData.uploadedFileNames as Record<number, string>,
    documentData.uploadedFileUrls as Record<number, string>
  );

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
  const [isStepIndicatorVisible, setIsStepIndicatorVisible] = useState(true);
  const [showFieldHighlight, setShowFieldHighlight] = useState(true);
  const [showAgentHighlight, setShowAgentHighlight] = useState(true);
  const [editorKey, setEditorKey] = useState(0); // 에디터 강제 리마운트용


  // Modal State
  const [showMyPageModal, setShowMyPageModal] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // [ADDED] Force update state to trigger re-renders on editor changes
  const [, forceUpdate] = useState({});


  const isLoadingTemplate = useRef(false); // 템플릿 로딩 중 플래그

  // Intro Animation State
  const [hasShownIntro, setHasShownIntro] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  // [ADDED] Handler for immediate editor updates (for validation and sync)
  const handleEditorUpdate = () => {
    if (editorRef.current) {
      const content = editorRef.current.getContent();
      extractData(content); // Extract data in real-time
    }
    forceUpdate({});
  };

  // Calculate visibility for chatbot button
  const shouldShowChatButton = !isChatOpen && currentStep >= 1 && currentStep <= 5 && (
    (currentStep === 2) ||
    ((currentStep === 1 || currentStep === 3) && stepModes[currentStep] && stepModes[currentStep] !== 'skip' && (
      (stepModes[currentStep] === 'manual') ||
      (stepModes[currentStep] === 'upload' && uploadStatus[currentStep] === 'ready')
    )) ||
    (currentStep === 4 && activeShippingDoc)
  );

  // Cleanup invalid document keys (fix for "Document -1" issue)
  useEffect(() => {
    if (documentData['-1' as any] || documentData[-1]) {
      const newDocData = { ...documentData };
      delete (newDocData as any)['-1'];
      delete (newDocData as any)[-1];
      setDocumentData(newDocData);
    }
  }, [documentData, setDocumentData]);

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
    if (uploadedFiles[stepNumber] || uploadedFileNames[stepNumber]) return true;
    if (stepModes[stepNumber] === 'skip') return true;

    if (stepNumber <= 3) {
      if (stepModes[stepNumber] === 'upload' && !uploadedFiles[stepNumber] && !uploadedFileNames[stepNumber]) return false;

      // [CHANGED] Use live editor content if checking the current step
      let stepContent;
      if (stepNumber === currentStep && editorRef.current) {
        stepContent = editorRef.current.getContent();
      } else {
        stepContent = documentData[stepNumber] || hydrateTemplate(getTemplateForStep(stepNumber));
      }

      return checkStepCompletion(stepContent);
    } else {
      if (stepNumber === 4) {
        // For step 4, we might need to check specific docs if active
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

        // [ADDED] Propagate shared data to all other documents immediately
        extractData(content); // Update sharedData state first

        Object.keys(newDocData).forEach(key => {
          const docKey = Number(key);
          if (isNaN(docKey) || key === 'title' || docKey === saveKey) return;

          const originalContent = (newDocData as any)[key];
          if (typeof originalContent === 'string') {
            const newContent = updateContentWithSharedData(originalContent);
            // Only update if content ACTUALLY changed (mapped field update)
            if (newContent !== originalContent) {
              (newDocData as any)[key] = newContent;
            }
          }
        });

        setDocumentData(newDocData);
      }
    }
    setCurrentStep(newStep);
  };

  const handleSave = () => {
    const newDocData: DocumentData = {
      ...documentData,
      stepModes,
      uploadedFileNames,
      uploadedFileUrls: uploadedDocumentUrls
    };

    if (editorRef.current) {
      const content = editorRef.current.getContent();
      extractData(content);

      const saveKey = currentStep <= 3 ? currentStep : (shippingOrder ? getDocKeyForStep(currentStep) : -1);
      if (saveKey !== -1) {
        (newDocData as any)[saveKey] = content;
      }

      // Propagate shared data changes to other documents
      Object.keys(newDocData).forEach(key => {
        const docKey = Number(key);
        if (isNaN(docKey) || key === 'title' || docKey === saveKey) return;

        const originalContent = (newDocData as any)[key];
        if (typeof originalContent === 'string') {
          const updated = updateContentWithSharedData(originalContent);
          if (updated !== originalContent) (newDocData as any)[key] = updated;
        }
      });

      setDocumentData(newDocData);
    }

    onSave(newDocData, currentStep, activeShippingDoc);
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

  const handleExit = async () => {
    // Check if user made actual changes (not just mode selection)
    const hasChanges = isDirty;

    // Call onExit callback and wait for completion (e.g., trade deletion)
    if (onExit) {
      await onExit(hasChanges);
    }

    // Navigate to main page after exit handler completes
    onNavigate('main');
  };

  const handleBatchDownload = async (selectedSteps: Set<number>) => {
    // Close modal first
    setShowDownloadModal(false);

    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    // Get iframe document
    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      return;
    }

    // Collect content
    let combinedContent = '';
    const stepsToPrint = Array.from(selectedSteps).sort((a, b) => a - b);

    stepsToPrint.forEach((stepIndex, index) => {
      const content = documentData[stepIndex];
      if (!content) return;

      // Clean content (remove marks)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const marks = tempDiv.querySelectorAll('mark');
      marks.forEach(mark => {
        const span = document.createElement('span');
        span.innerHTML = mark.innerHTML;
        mark.parentNode?.replaceChild(span, mark);
      });

      // Add page break for subsequent pages
      if (index > 0) {
        combinedContent += '<div style="page-break-before: always;"></div>';
      }

      combinedContent += `<div class="document-page">${tempDiv.innerHTML}</div>`;
    });

    // Write content to iframe
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${documentData.title || 'Trade_Documents'}</title>
          <style>
            @page {
              size: A4;
              margin: 0;
            }
            body {
              font-family: sans-serif;
              font-size: 11pt;
              line-height: 1.5;
              color: black;
              background: white;
              margin: 0;
              padding: 20mm;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin-bottom: 1em;
            }
            th, td {
              border: 1px solid black;
              padding: 6px 8px;
              text-align: left;
              font-size: 10pt;
            }
            .contract-table { width: 100%; }
            img { max-width: 100%; }
            
            span[data-field-id] {
              background-color: transparent !important;
            }
            
            * {
              color: black !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          </style>
        </head>
        <body>
          ${combinedContent}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            }
          </script>
        </body>
      </html>
    `);
    iframeDoc.close();

    // Remove iframe after a delay
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
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

      // Only set isDirty if not loading template
      if (!isLoadingTemplate.current) {
        setIsDirty(true);
      }
    }
  };

  const handleModeSelect = async (mode: StepMode) => {
    // Create Trade if it doesn't exist yet (first mode selection)
    if (onCreateTrade) {
      await onCreateTrade();
    }

    // Set loading flag to prevent isDirty during template load
    isLoadingTemplate.current = true;

    // Explicitly reset isDirty to false (template load shouldn't count as changes)
    setIsDirty(false);

    // 프론트엔드 상태 업데이트
    setStepModes(prev => ({ ...prev, [currentStep]: mode }));

    // Reset loading flag after a short delay (template should be loaded by then)
    setTimeout(() => {
      isLoadingTemplate.current = false;
    }, 500);

    // 백엔드 doc_mode 업데이트
    const docId = getDocId?.(currentStep, null);
    if (docId && mode) {
      try {
        const DJANGO_API_URL = import.meta.env.VITE_DJANGO_API_URL || 'http://localhost:8000';
        await fetch(`${DJANGO_API_URL}/api/documents/documents/${docId}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc_mode: mode })
        });
        console.log(`📝 doc_mode 업데이트: doc_id=${docId}, mode=${mode}`);
      } catch (error) {
        console.error('doc_mode 업데이트 실패:', error);
      }
    }
  };

  const handleRowAdded = (fieldIds: string[]) => {
    console.log('🔄 handleRowAdded called with:', fieldIds, 'from step:', currentStep);

    // Helper to add row to a document's HTML content
    const addRowToDocument = (htmlContent: string, fieldIds: string[]): string => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // Find the template row by searching all tables
      const tables = doc.querySelectorAll('table');
      let templateRow: HTMLElement | null = null;

      for (const table of Array.from(tables)) {
        const rows = Array.from(table.querySelectorAll('tbody tr'));

        for (let i = rows.length - 1; i >= 0; i--) {
          const row = rows[i];
          const dataFields = row.querySelectorAll('[data-field-id]');
          const text = row.textContent || '';

          // Check if it's a data row by looking for specific item fields
          let hasItemField = false;
          dataFields.forEach(field => {
            const fid = field.getAttribute('data-field-id') || '';
            if (fid.startsWith('item_no') ||
              fid.startsWith('unit_price') ||
              fid.startsWith('quantity') ||
              fid.startsWith('description') ||
              fid.startsWith('sub_total_price') ||
              fid.startsWith('marks_and_numbers')) {
              hasItemField = true;
            }
          });

          // Check for Total row (case sensitive "Total " with space to avoid sub_total_price)
          const isTotalRow = text.includes('Total ') || text.includes('TOTAL :');

          // Must have item fields AND multiple fields (to avoid false positives)
          if (hasItemField && dataFields.length >= 3 && !isTotalRow) {
            templateRow = row as HTMLElement;
            break;
          }
        }

        if (templateRow) break; // Found it, stop searching tables
      }

      if (!templateRow) {
        console.warn('⚠️ No template row found in document');
        return htmlContent;
      }

      // Collect all existing field IDs in the document to avoid duplicates
      const existingFieldIds = new Set<string>();
      const allFields = doc.querySelectorAll('[data-field-id]');
      allFields.forEach((f: Element) => {
        const id = f.getAttribute('data-field-id');
        if (id) existingFieldIds.add(id);
      });

      const newRow = templateRow.cloneNode(true) as HTMLElement;

      // Create a map of field names to new field IDs
      const fieldMap = new Map<string, string>();
      fieldIds.forEach(fieldId => {
        const baseName = fieldId.replace(/_\d+$/, '');
        fieldMap.set(baseName, fieldId);
      });

      // Helper to get next available field ID
      const getNextFieldId = (baseName: string): string => {
        let counter = 2;
        let newId = `${baseName}_${counter}`;
        while (existingFieldIds.has(newId)) {
          counter++;
          newId = `${baseName}_${counter}`;
        }
        existingFieldIds.add(newId);
        return newId;
      };

      // Replace field IDs in the new row
      const dataFields = newRow.querySelectorAll('[data-field-id]');
      dataFields.forEach((field) => {
        const currentFieldId = field.getAttribute('data-field-id');
        if (currentFieldId) {
          const baseName = currentFieldId.replace(/_\d+$/, '');
          let newFieldId = fieldMap.get(baseName);

          if (!newFieldId) {
            newFieldId = getNextFieldId(baseName);
          }

          field.setAttribute('data-field-id', newFieldId);
          field.setAttribute('data-source', ''); // Set to empty string (null equivalent in HTML)
          field.textContent = `[${newFieldId}]`;
        }
      });

      // Insert AFTER the template row
      if (templateRow.nextSibling) {
        templateRow.parentNode?.insertBefore(newRow, templateRow.nextSibling);
      } else {
        templateRow.parentNode?.appendChild(newRow);
      }

      return doc.documentElement.outerHTML.replace(/^<html><head><\/head><body>/, '').replace(/<\/body><\/html>$/, '');
    };

    // Update all other documents
    setDocumentData((prev: DocumentData) => {
      const newData = { ...prev };

      // Determine the key of the document currently being edited
      let currentDocKey = currentStep;
      if (currentStep === 4) {
        if (activeShippingDoc === 'CI') currentDocKey = 4;
        else if (activeShippingDoc === 'PL') currentDocKey = 5;
      }

      // Sync to all documents except the current one
      const documentsToSync = [1, 2, 3, 4, 5].filter(key => key !== currentDocKey);

      documentsToSync.forEach(step => {
        // Get existing content or template
        let content = prev[step];
        if (!content) {
          // Document doesn't exist yet, use template
          content = hydrateTemplate(getTemplateForStep(step));
          console.log(`📄 Using template for step ${step} (first sync)`);
        }

        console.log(`📝 Updating document at step ${step}`);
        const updatedContent = addRowToDocument(content, fieldIds);
        newData[step] = updatedContent;
      });

      return newData;
    });

    console.log('✅ Row synchronization complete');
  };

  // Handle row deletion and sync to other documents
  const handleRowDeleted = (fieldIds: string[]) => {
    console.log('🗑️ handleRowDeleted called with:', fieldIds);

    // Helper to delete row from a document's HTML content
    const deleteRowFromDocument = (htmlContent: string, deletedFieldIds: string[]): string => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // Find the table
      const table = doc.querySelector('table');
      if (!table) {
        console.warn('⚠️ No table found in document');
        return htmlContent;
      }

      // Find all rows in tbody only
      const tbody = table.querySelector('tbody');
      if (!tbody) {
        console.warn('⚠️ No tbody found in table');
        return htmlContent;
      }

      const rows = Array.from(tbody.querySelectorAll('tr'));

      // Find and delete rows that contain any of the deleted field IDs
      let deletedCount = 0;
      rows.forEach((row) => {
        const rowFieldIds: string[] = [];
        const dataFields = row.querySelectorAll('[data-field-id]');

        dataFields.forEach((field) => {
          const fieldId = field.getAttribute('data-field-id');
          if (fieldId) {
            rowFieldIds.push(fieldId);
          }
        });

        // Check if this row contains any of the deleted field IDs
        const hasDeletedField = rowFieldIds.some(id => deletedFieldIds.includes(id));

        if (hasDeletedField) {
          console.log(`  🗑️ Deleting row with fields: [${rowFieldIds.join(', ')}]`);
          row.remove();
          deletedCount++;
        }
      });

      if (deletedCount > 0) {
        console.log(`  ✓ Deleted ${deletedCount} row(s)`);
      } else {
        console.log('  ℹ️ No matching rows found to delete');
      }

      return doc.documentElement.outerHTML.replace(/^<html><head><\/head><body>/, '').replace(/<\/body><\/html>$/, '');
    };

    // Update all other documents
    setDocumentData((prev: DocumentData) => {
      const newData = { ...prev };

      // Sync to all documents except the current one
      const documentsToSync = [1, 2, 3, 4, 5].filter(step => step !== currentStep);

      documentsToSync.forEach(step => {
        if (prev[step]) {
          console.log(`📝 Deleting row from document at step ${step}`);
          newData[step] = deleteRowFromDocument(prev[step], fieldIds);
        }
      });

      return newData;
    });

    console.log('✅ Row deletion synchronization complete');
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
      // 먼저 documentData 업데이트 (App.tsx에서 처리)
      onRestore(version);
      setShowVersionHistory(false);

      const step = version.step;

      // step 설정
      if (step <= 3) {
        setCurrentStep(step);
        setStepModes(prev => ({ ...prev, [step]: 'manual' }));
      } else {
        setCurrentStep(4);
        if (step === 4) setActiveShippingDoc('CI');
        if (step === 5) setActiveShippingDoc('PL');
      }

      // documentData 상태 업데이트 후 에디터 리마운트 (React 상태 업데이트는 비동기)
      setTimeout(() => {
        setEditorKey(prev => prev + 1);
      }, 50);
    }
  };

  // Calculate doc key for current step
  const currentDocKey = getDocKeyForStep(currentStep);

  // Get initial content for editor (memoized to prevent unnecessary reloads)
  const initialContent = useMemo((): string => {
    if (currentDocKey === -1) return '';
    const content = documentData[currentDocKey] || hydrateTemplate(getTemplateForStep(currentDocKey));
    return updateContentWithSharedData(content);
  }, [currentDocKey, documentData[currentDocKey], sharedData]);

  const renderStepHeaderControls = () => {
    // 1. Left Side Content (Back Button)
    let leftContent = null;
    // Show back button if any mode is selected for Step 1 or 3
    if ((currentStep === 1 || currentStep === 3) && stepModes[currentStep]) {
      leftContent = (
        <button
          onClick={() => {
            // 모드 전환 시 업로드 정보는 유지 (삭제하지 않음)
            // 업로드된 파일은 백엔드 Document에 저장되어 있으므로,
            // 다시 업로드 모드로 돌아오면 기존 파일을 사용할 수 있음
            setStepModes(prev => ({ ...prev, [currentStep]: null }));
          }}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium">작성 방식 다시 선택하기</span>
        </button>
      );
    }

    // 2. Center Content (Quick Switcher)
    let centerContent = null;
    if (currentStep === 4 && activeShippingDoc) {
      centerContent = (
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
      );
    }

    // 3. Right Side Content (Toggles)
    // Hide toggles if in Upload or Skip mode for Step 1 & 3
    const shouldShowToggles = !((currentStep === 1 || currentStep === 3) && stepModes[currentStep] !== 'manual');

    const rightContent = shouldShowToggles ? (
      <div className="flex items-center gap-2">
        {/* Common Field Highlight Toggle */}
        <button
          onClick={() => setShowFieldHighlight(prev => !prev)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showFieldHighlight
            ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
        >
          {showFieldHighlight ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          <span>공통 필드</span>
        </button>

        {/* Agent Highlight Toggle */}
        <button
          onClick={() => setShowAgentHighlight(prev => !prev)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showAgentHighlight
            ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI 답변</span>
        </button>
      </div>
    ) : null;

    // 4. Return Grid Container
    return (
      <div className="px-8 pb-4 grid grid-cols-3 items-center min-h-[76px]">
        <div className="justify-self-start">{leftContent}</div>
        <div className="justify-self-center">{centerContent}</div>
        <div className="justify-self-end">{rightContent}</div>
      </div>
    );
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
        <SkipState />
      );
    }

    // Upload Mode
    if (stepModes[currentStep] === 'upload') {
      const docId = getDocId?.(currentStep, null);
      return (
        <FileUploadView
          file={uploadedFiles[currentStep] || null}
          fileName={uploadedFileNames[currentStep]}
          status={uploadStatus[currentStep] || 'idle'}
          documentUrl={uploadedDocumentUrls[currentStep] || null}
          error={uploadError[currentStep] || null}
          onUpload={(file) => {
            if (docId) {
              handleFileUpload(currentStep, file, docId);
            } else {
              console.error('Document ID not found for step', currentStep);
            }
          }}
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
        key={`editor-${currentStep}-${activeShippingDoc || 'default'}-${editorKey}`}
        currentStep={currentStep}
        onUpdate={handleEditorUpdate}
        stepModes={stepModes}
        activeShippingDoc={activeShippingDoc}
        editorRef={editorRef}
        initialContent={initialContent}
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
        onRowAdded={handleRowAdded}
        onRowDeleted={handleRowDeleted}
        showFieldHighlight={showFieldHighlight}
        showAgentHighlight={showAgentHighlight}
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
          else handleExit();
        }}
        onSave={handleSave}
        onDownload={handleDownload}
        onVersionHistoryClick={() => setShowVersionHistory(true)}
        onMyPageClick={() => setShowMyPageModal(!showMyPageModal)}
        onLogoutClick={() => setShowLogoutConfirm(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Tabs + Content */}
        <div className="flex-1 flex flex-col relative min-h-0">
          {/* Step Navigation */}
          {/* Tab Navigation */}
          <motion.div
            initial={false}
            animate={{
              height: isStepIndicatorVisible ? 'auto' : 0,
              opacity: isStepIndicatorVisible ? 1 : 0
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm flex-shrink-0 z-10 relative overflow-hidden"
          >
            <div className="px-8 py-4">
              <div className="max-w-6xl mx-auto relative">
                {/* Progress Line Background */}
                <div
                  className="absolute top-[15px] h-1 bg-gray-200 rounded-full overflow-hidden"
                  style={{
                    left: `calc(100% / ${STEP_SHORT_NAMES.length * 2})`,
                    width: `calc(100% * ${(STEP_SHORT_NAMES.length - 1) / STEP_SHORT_NAMES.length})`
                  }}
                >
                  {/* Animated Progress Line */}
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${((maxProgressStep - 1) / (STEP_SHORT_NAMES.length - 1)) * 100}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                </div>

                <div
                  className="grid items-center relative"
                  style={{ gridTemplateColumns: `repeat(${STEP_SHORT_NAMES.length}, 1fr)` }}
                >
                  {STEP_SHORT_NAMES.map((name, index) => {
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
                                  <Ban className="w-4 h-4 text-white" />
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
            {renderStepHeaderControls()}
          </motion.div>

          {/* Toggle Button */}
          <div className="relative z-50 flex justify-center -mt-4 transition-all duration-300">
            <button
              onClick={() => setIsStepIndicatorVisible(!isStepIndicatorVisible)}
              className="group bg-white border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] rounded-full w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-100 hover:shadow-[0_4px_12px_rgba(37,99,235,0.15)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm transition-all duration-300"
              title={isStepIndicatorVisible ? "단계 표시줄 접기" : "단계 표시줄 펼치기"}
            >
              {isStepIndicatorVisible ? (
                <ChevronUp className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
              ) : (
                <ChevronDown className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
              )}
            </button>
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
          <ChatAssistant
            currentStep={currentStep}
            onClose={() => setIsChatOpen(false)}
            editorRef={editorRef}
            onApply={handleChatApply}
            documentId={
              stepModes[currentStep] === 'upload'
                ? uploadedDocumentIds[currentStep]
                : getDocId?.(currentStep, activeShippingDoc) ?? null
            }
            userEmployeeId={userEmployeeId}
            getDocId={getDocId}
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
          onClick={() => {
            setIsChatOpen(!isChatOpen);
            setShowIntro(false);
            setHasShownIntro(true);
          }}
          className={`fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform transition-colors duration-200 hover:scale-110 z-40 ${!hasShownIntro ? 'opacity-0' : ''}`}
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
        empNo={userEmployeeId}
      />

      <ExitConfirmModal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onExit={() => {
          setShowExitConfirm(false);
          handleExit();
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
