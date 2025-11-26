import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
}

interface ChatAssistantProps {
  currentStep: number;
  onClose?: () => void;
}

export default function ChatAssistant({ currentStep, onClose }: ChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: '안녕하세요! 문서 작성을 도와드리겠습니다. 궁금한 점이 있으시면 언제든 물어보세요.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'help' | 'format'>('help');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    setInput('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `"${input}"에 대한 답변입니다. 무역 문서 작성 시 이 부분을 참고하세요.`
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1000);
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