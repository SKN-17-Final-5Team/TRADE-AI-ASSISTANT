// EditorView.tsx - 에디터 뷰 (직접 작성 모드)
import { useState, RefObject } from 'react';
import { ArrowLeft, Eye, EyeOff, Sparkles, FileText, Package } from 'lucide-react';
import ContractEditor, { ContractEditorRef } from '../../editor/ContractEditor';
import type { DocumentData, StepMode, ShippingDocType } from '../types';

interface EditorViewProps {
  currentStep: number;
  stepModes: Record<number, StepMode>;
  activeShippingDoc: ShippingDocType | null;
  editorRef: RefObject<ContractEditorRef | null>;
  initialContent: string;
  onBack: () => void;
  onShippingDocChange: (doc: ShippingDocType) => void;
  onChange: (content: string) => void;
}

export default function EditorView({
  currentStep,
  stepModes,
  activeShippingDoc,
  editorRef,
  initialContent,
  onBack,
  onShippingDocChange,
  onChange
}: EditorViewProps) {
  const [showFieldHighlight, setShowFieldHighlight] = useState(true);
  const [showAgentHighlight, setShowAgentHighlight] = useState(true);

  const showBackButton = (currentStep === 1 || currentStep === 3) && stepModes[currentStep] === 'manual';

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar: Back Button (left) + Field Highlight Toggle (right) */}
      <div className="mb-4 flex-shrink-0 flex items-center justify-between">
        {/* Back to Selection Button (Only for Step 1 & 3 in Manual Mode) */}
        {showBackButton ? (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">작성 방식 다시 선택하기</span>
          </button>
        ) : (
          <div /> // Spacer for justify-between
        )}

        {/* Highlight Toggles */}
        <div className="flex items-center gap-2">
          {/* Common Field Highlight Toggle */}
          <button
            onClick={() => setShowFieldHighlight(prev => !prev)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showFieldHighlight
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showAgentHighlight
                ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI 답변</span>
          </button>
        </div>
      </div>

      {/* Quick Switcher for Shipping Documents (Step 4) */}
      {currentStep === 4 && activeShippingDoc && (
        <div className="flex justify-center mb-6">
          <div className="bg-gray-100 p-1.5 rounded-full flex items-center shadow-inner gap-1">
            <button
              onClick={() => onShippingDocChange('CI')}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${
                activeShippingDoc === 'CI'
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              Commercial Invoice
            </button>
            <button
              onClick={() => onShippingDocChange('PL')}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${
                activeShippingDoc === 'PL'
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
        initialContent={initialContent}
        onChange={onChange}
        showFieldHighlight={showFieldHighlight}
        showAgentHighlight={showAgentHighlight}
      />
    </div>
  );
}
