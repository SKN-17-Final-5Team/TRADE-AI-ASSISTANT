import { useState, useRef, useEffect, RefObject } from 'react';
import { Sparkles, Send, X, Wand2 } from 'lucide-react';
import { ContractEditorRef } from './editor/ContractEditor';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  hasApply?: boolean;
  applyContent?: string;
}

interface ChatAssistantProps {
  currentStep: number;
  onClose?: () => void;
  editorRef: RefObject<ContractEditorRef>;
}

export default function ChatAssistant({ currentStep, onClose, editorRef }: ChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: '안녕하세요! 문서 작성을 도와드리겠습니다. 문서 수정을 원하시면 "~로 수정해줘"라고 말씀해주세요.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

  // OpenAI API 호출
  const callOpenAI = async (userMessage: string, documentContent: string): Promise<{ message: string; updatedHTML?: string }> => {
    if (!OPENAI_API_KEY) {
      return { message: 'API 키가 설정되지 않았습니다. .env 파일에 VITE_OPENAI_API_KEY를 설정해주세요.' };
    }

    const systemPrompt = `당신은 무역 문서 작성을 돕는 AI 어시스턴트입니다.
사용자가 문서 수정을 요청하면, 수정된 HTML을 JSON 형식으로 반환해주세요.

현재 문서 내용:
${documentContent}

응답 형식:
- 일반 질문: { "type": "chat", "message": "답변 내용" }
- 문서 수정 요청: { "type": "edit", "message": "수정 설명", "html": "수정된 전체 HTML" }

중요: 문서 수정 시 기존 HTML 구조와 스타일을 유지하면서 요청된 부분만 수정하세요.`;

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
          temperature: 0.7
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
          return { message: parsed.message, updatedHTML: parsed.html };
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

  // 에디터에 내용 적용
  const applyToEditor = (html: string) => {
    if (editorRef.current) {
      editorRef.current.setContent(html);
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

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    // 현재 에디터 내용 가져오기
    const documentContent = editorRef.current?.getContent() || '';

    // OpenAI API 호출
    const response = await callOpenAI(currentInput, documentContent);

    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'ai',
      content: response.message,
      hasApply: !!response.updatedHTML,
      applyContent: response.updatedHTML
    };

    setMessages(prev => [...prev, aiMessage]);
    setIsLoading(false);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 text-white">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5" />
            <h2 className="font-semibold text-base">AI 어시스턴트</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              title="챗봇 닫기"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-blue-100 text-xs">문서 작성 도우미</p>
      </div>

      {/* Quick Suggestions */}
      <div className="p-4 border-b bg-gray-50">
        <p className="text-xs text-gray-600 mb-2">빠른 제안</p>
        <div className="flex gap-2">
          {quickSuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleQuickSuggestion(suggestion.text)}
              className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              <span>{suggestion.icon}</span>
              <span className="text-gray-700">{suggestion.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.type === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800'
                }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              {message.hasApply && message.applyContent && (
                <button
                  onClick={() => applyToEditor(message.applyContent!)}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  문서에 적용하기
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-white">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="질문을 입력하세요..."
            className="flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}