import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Sparkles, Search } from 'lucide-react';
import { PageType } from '../App';

interface ChatPageProps {
  onNavigate: (page: PageType) => void;
}

interface Message {
  id: string;
  type: 'user' | 'ai' | 'search';
  content: string;
  timestamp: Date;
}

export default function ChatPage({ onNavigate }: ChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: '안녕하세요! 무역 관련 질문이나 최신 동향에 대해 도움을 드리겠습니다. 무엇이 궁금하신가요?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Check if web search is needed
    const needsWebSearch = /최근|동향|현재|뉴스|트렌드/i.test(input);

    if (needsWebSearch) {
      // Simulate web search
      setTimeout(() => {
        const searchMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'search',
          content: '웹 검색을 통해 최신 정보를 찾고 있습니다...',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, searchMessage]);

        setTimeout(() => {
          const aiResponse: Message = {
            id: (Date.now() + 2).toString(),
            type: 'ai',
            content: `최근 무역 동향에 대한 정보입니다:\n\n• 2025년 글로벌 무역량은 전년 대비 3.2% 증가 예상\n• 디지털 무역 문서화가 빠르게 확산 중\n• 친환경 제품에 대한 수출입 규제 강화\n• 전자 신용장(e-LC) 사용이 증가하는 추세\n\n더 궁금하신 사항이 있으시면 말씀해주세요.`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, aiResponse]);
          setIsLoading(false);
        }, 1500);
      }, 800);
    } else {
      // Regular response
      setTimeout(() => {
        let response = '';
        
        if (/LC|신용장/i.test(input)) {
          response = 'LC(Letter of Credit, 신용장)는 수입업자의 거래은행이 수출업자에게 대금 지급을 보증하는 문서입니다.\n\n주요 종류:\n• Irrevocable LC - 취소불능 신용장\n• Revocable LC - 취소가능 신용장\n• Confirmed LC - 확인 신용장\n\n신용장은 무역 거래의 안전성을 보장하는 중요한 결제 수단입니다.';
        } else if (/BL|선하증권/i.test(input)) {
          response = 'BL(Bill of Lading, 선하증권)은 운송인이 화물을 수령했다는 증거이자 물품 인도 청구권을 나타내는 유가증권입니다.\n\n주요 기능:\n• 화물 수령증\n• 운송 계약서\n• 물품 소유권 증서\n\n종류: Original BL, Sea Waybill, Surrender BL 등이 있습니다.';
        } else if (/PI|Proforma Invoice/i.test(input)) {
          response = 'PI(Proforma Invoice, 견적송장)는 정식 계약 전에 발행하는 견적서 형태의 송장입니다.\n\n주요 내용:\n• 상품 명세 및 수량\n• 단가 및 총액\n• 거래 조건\n• 유효 기간\n\nPI를 바탕으로 바이어가 구매를 결정하고 LC를 개설합니다.';
        } else if (/작성|생성|도와/i.test(input)) {
          response = '무역 문서 작성을 도와드리겠습니다!\n\n메인 페이지의 "문서 작성" 버튼을 클릭하시면 7단계 프로세스를 통해 체계적으로 문서를 작성할 수 있습니다.\n\n• 기존 문서 업로드 및 검토\n• AI 어시스턴트와 함께 직접 작성\n• 자동 양식 채우기\n• 오류 검토 및 수정 제안\n\n지금 시작해보시겠어요?';
        } else {
          response = `"${input}"에 대한 질문 감사합니다.\n\n무역 관련 더 구체적인 질문을 해주시면 상세한 답변을 드리겠습니다. 예를 들어:\n\n• 특정 무역 용어 설명 (LC, BL, PI 등)\n• 무역 문서 작성 방법\n• 최근 무역 동향\n• 수출입 절차\n\n어떤 것이 궁금하신가요?`;
        }

        const aiResponse: Message = {
          id: (Date.now() + 2).toString(),
          type: 'ai',
          content: response,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiResponse]);
        setIsLoading(false);
      }, 1000);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <button
            onClick={() => onNavigate('main')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <Sparkles className="w-12 h-12 text-blue-600" />
          <div>
            <h1 className="text-gray-900 font-bold">일반 채팅</h1>
            <p className="text-gray-600 text-sm">무역 AI 어시스턴트</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'user' ? (
                <div className="bg-blue-600 text-white rounded-2xl px-6 py-4 max-w-2xl">
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ) : message.type === 'search' ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-6 py-4 max-w-2xl flex items-center gap-3">
                  <Search className="w-5 h-5 text-yellow-600 animate-pulse" />
                  <p className="text-yellow-900">{message.content}</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4 max-w-2xl shadow-sm">
                  <p className="text-gray-800 whitespace-pre-wrap">{message.content}</p>
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4">
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
      </div>

      {/* Input */}
      <div className="bg-white border-t px-8 py-6">
        <div className="max-w-5xl mx-auto flex gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="무역 관련 질문을 입력하세요..."
            className="flex-1 px-6 py-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
