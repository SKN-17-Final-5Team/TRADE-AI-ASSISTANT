import { useState, useRef, useEffect, RefObject } from 'react';
import { Sparkles, Send, X, Wand2, Eye, Undo2, Check, XCircle } from 'lucide-react';
import { ContractEditorRef } from './editor/ContractEditor';

interface Change {
  field: string;
  before: string;
  after: string;
}

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  hasApply?: boolean;
  applyContent?: string;
  changes?: Change[];
  step?: number;
}

interface PreviewState {
  isOpen: boolean;
  changes: Change[];
  newHTML: string;
  beforeHTML: string;
  step?: number;
}

interface ChatAssistantProps {
  currentStep: number;
  onClose?: () => void;
  editorRef: RefObject<ContractEditorRef>;
  onApply: (content: string, step: number) => void;
}

export default function ChatAssistant({ currentStep, onClose, editorRef, onApply }: ChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: '안녕하세요! 문서 작성을 도와드리겠습니다. 문서 수정을 원하시면 "~로 수정해줘"라고 말씀해주세요.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({
    isOpen: false,
    changes: [],
    newHTML: '',
    beforeHTML: ''
  });
  const [history, setHistory] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
  const USE_DJANGO = import.meta.env.VITE_USE_DJANGO === 'true';
  const DJANGO_API_URL = import.meta.env.VITE_DJANGO_API_URL || 'http://localhost:8000';

  // Django Agent API 호출
  const callDjangoAgent = async (userMessage: string, documentContent: string): Promise<{
    message: string;
    updatedHTML?: string;
    changes?: Change[];
  }> => {
    try {
      const response = await fetch(`${DJANGO_API_URL}/api/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          document: documentContent
        })
      });

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const data = await response.json();
      return {
        message: data.message,
        updatedHTML: data.html,
        changes: data.changes
      };
    } catch (error) {
      console.error('Django Agent API 오류:', error);
      return { message: `오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}` };
    }
  };

  // OpenAI API 직접 호출 (테스트용)
  const callOpenAI = async (userMessage: string, documentContent: string): Promise<{
    message: string;
    updatedHTML?: string;
    changes?: Change[];
  }> => {
    if (!OPENAI_API_KEY) {
      return { message: 'API 키가 설정되지 않았습니다. .env 파일에 VITE_OPENAI_API_KEY를 설정해주세요.' };
    }

    const systemPrompt = `당신은 무역 문서 작성을 돕는 AI 어시스턴트입니다.
사용자가 문서 수정을 요청하면, 변경 사항을 명확히 구분하여 JSON 형식으로 반환해주세요.

현재 문서 내용:
${documentContent}

응답 형식:
- 일반 질문: { "type": "chat", "message": "답변 내용" }
- 문서 수정 요청: {
    "type": "edit",
    "message": "수정 설명",
    "changes": [
      { "field": "변경 필드명", "before": "변경 전 값", "after": "변경 후 값" }
    ],
    "html": "수정된 전체 HTML"
  }

중요 규칙:
1. 사용자가 요청한 부분만 정확히 수정하세요
2. 요청하지 않은 다른 필드는 절대 변경하지 마세요
3. HTML 구조와 스타일은 그대로 유지하세요
4. changes 배열에 실제로 변경된 부분만 포함하세요`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.3 // 낮은 temperature로 더 정확한 수정
        })
      });

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';

      try {
        const parsed = JSON.parse(content);
        if (parsed.type === 'edit' && parsed.html) {
          return {
            message: parsed.message,
            updatedHTML: parsed.html,
            changes: parsed.changes || []
          };
        }
        return { message: parsed.message || content };
      } catch {
        return { message: content };
      }
    } catch (error) {
      console.error('OpenAI API 오류:', error);
      return { message: `오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}` };
    }
  };

  // 미리보기 열기
  const openPreview = (newHTML: string, changes: Change[], step: number) => {
    const beforeHTML = editorRef.current?.getContent() || '';
    setPreview({
      isOpen: true,
      changes,
      newHTML,
      beforeHTML,
      step
    });
  };

  // 미리보기에서 적용
  const applyFromPreview = () => {
    if (preview.newHTML && preview.step !== undefined) {
      // 현재 상태를 히스토리에 저장 (Undo용)
      setHistory(prev => [...prev, preview.beforeHTML]);
      onApply(preview.newHTML, preview.step);
    }
    setPreview({ isOpen: false, changes: [], newHTML: '', beforeHTML: '' });
  };

  // 미리보기 닫기
  const closePreview = () => {
    setPreview({ isOpen: false, changes: [], newHTML: '', beforeHTML: '' });
  };

  // 되돌리기 (Undo)
  const handleUndo = () => {
    if (history.length > 0 && editorRef.current) {
      const previousContent = history[history.length - 1];
      editorRef.current.setContent(previousContent);
      setHistory(prev => prev.slice(0, -1));
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const quickSuggestions = [
    { icon: '📝', text: '작성 도움' },
    { icon: '✨', text: '표준 형식' }
  ];

  const handleQuickSuggestion = (text: string) => {
    setInput(text);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Capture the step when the request is made
    const requestStep = currentStep;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      step: requestStep
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    const documentContent = editorRef.current?.getContent() || '';
    const response = USE_DJANGO
      ? await callDjangoAgent(currentInput, documentContent)
      : await callOpenAI(currentInput, documentContent);

    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'ai',
      content: response.message,
      hasApply: !!response.updatedHTML,
      applyContent: response.updatedHTML,
      changes: response.changes,
      step: requestStep // Propagate the step to the AI message
    };

    setMessages(prev => [...prev, aiMessage]);
    setIsLoading(false);
  };

  return (
    <div className="h-full flex flex-col bg-white relative">
      {/* 미리보기 모달 */}
      {preview.isOpen && (
        <div className="absolute inset-0 bg-white z-50 flex flex-col">
          <div className="bg-amber-500 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                <h3 className="font-semibold">변경 미리보기</h3>
              </div>
              <button onClick={closePreview} className="p-1 hover:bg-white/20 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-amber-100 text-xs mt-1">적용 전 변경 내용을 확인하세요</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {preview.changes.length > 0 ? (
                preview.changes.map((change, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-gray-50">
                    <div className="text-xs font-medium text-gray-500 mb-2">{change.field}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-red-50 border border-red-200 rounded p-2">
                        <div className="text-xs text-red-600 mb-1">변경 전</div>
                        <div className="text-sm line-through text-red-700">{change.before || '(비어있음)'}</div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded p-2">
                        <div className="text-xs text-green-600 mb-1">변경 후</div>
                        <div className="text-sm text-green-700 font-medium">{change.after}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <p className="text-sm">변경 사항 상세 정보가 없습니다.</p>
                  <p className="text-xs mt-1">전체 문서가 업데이트됩니다.</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t bg-gray-50 flex gap-2">
            <button
              onClick={closePreview}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-xl hover:bg-gray-100 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              <span>취소</span>
            </button>
            <button
              onClick={applyFromPreview}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>적용하기</span>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-blue-500 p-5 text-white shadow-lg z-10 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full blur-xl -ml-10 -mb-10 pointer-events-none"></div>

        <div className="flex items-center justify-between mb-1 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/30 shadow-inner">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base tracking-tight">AI 어시스턴트</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                <p className="text-blue-100 text-[11px] font-medium">Online</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {history.length > 0 && (
              <button
                onClick={handleUndo}
                className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200 text-blue-50 hover:text-white"
                title={`되돌리기 (${history.length})`}
              >
                <Undo2 className="w-4 h-4" />
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200 text-blue-50 hover:text-white"
                title="챗봇 닫기"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Suggestions */}
      <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100 backdrop-blur-sm">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {quickSuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleQuickSuggestion(suggestion.text)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-100 rounded-full hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-xs whitespace-nowrap group"
            >
              <span className="group-hover:scale-110 transition-transform">{suggestion.icon}</span>
              <span className="text-gray-600 font-medium group-hover:text-blue-600">{suggestion.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/30">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-end gap-2 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {/* AI Avatar */}
            {message.type === 'ai' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md flex-shrink-0 mb-1">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}

            <div
              className={`max-w-[85%] px-5 py-3.5 shadow-sm relative group transition-all duration-200 hover:shadow-md ${message.type === 'user'
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm'
                  : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-sm'
                }`}
            >
              <p className={`text-sm whitespace-pre-wrap leading-relaxed ${message.type === 'ai' ? 'text-gray-700' : 'text-blue-50'}`}>
                {message.content}
              </p>

              {message.hasApply && message.applyContent && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                  <button
                    onClick={() => openPreview(message.applyContent!, message.changes || [], message.step!)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    미리보기
                  </button>
                  <button
                    onClick={() => {
                      const beforeHTML = editorRef.current?.getContent() || '';
                      setHistory(prev => [...prev, beforeHTML]);
                      onApply(message.applyContent!, message.step!);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    바로 적용
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start items-end gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md flex-shrink-0 mb-1">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white/80 backdrop-blur-md relative z-20">
        <form onSubmit={handleSubmit} className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="AI에게 무엇이든 물어보세요..."
            className="w-full px-6 py-3.5 pr-14 rounded-full border border-gray-200 bg-white/90 shadow-[0_2px_10px_rgba(0,0,0,0.03)] focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 focus:shadow-[0_4px_20px_rgba(37,99,235,0.1)] transition-all duration-300 text-sm relative z-10 placeholder:text-gray-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-blue-200 hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 z-20"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
