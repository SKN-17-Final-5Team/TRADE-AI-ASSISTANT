import { FileText, Plus, ChevronDown, LogOut, CheckCircle, Clock, Search, Filter, User, Sparkles } from 'lucide-react';
import { PageType, SavedDocument } from '../App';
import { useState } from 'react';

interface MainPageProps {
  onNavigate: (page: PageType) => void;
  savedDocuments: SavedDocument[];
  userEmployeeId: string;
  onLogout: () => void;
  onLogoClick: (logoRect: DOMRect) => void;
}

// 샘플 작업 데이터 (진행중 작업 최우선, 그 다음 최신순 정렬)
const sampleTasks = [
  {
    id: '1',
    title: '수출 계약서 작성',
    date: '2025. 11. 23.',
    timestamp: new Date('2025-11-23T10:00:00'),
    description: '7가 무역 서류 작성 (전략적 포럼)',
    type: 'document' as const,
    status: 'completed' as const,
    icon: FileText,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600'
  },
  {
    id: '3',
    title: 'PI 작성 프로젝트',
    date: '2025. 11. 15.',
    timestamp: new Date('2025-11-15T15:00:00'),
    description: 'Proforma Invoice 문서 작업',
    type: 'document' as const,
    status: 'completed' as const,
    icon: FileText,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600'
  }
];

export default function MainPage({ onNavigate, savedDocuments, userEmployeeId, onLogout, onLogoClick }: MainPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in-progress'>('all');
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [showMyPageModal, setShowMyPageModal] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    // 유효성 검사
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('모든 필드를 입력해주세요.');
      return;
    }

    if (currentPassword !== 'a123456!') {
      setPasswordError('현재 비밀번호가 올바르지 않습니다.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('새 비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    // Mock 비밀번호 변경 성공
    setPasswordSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    setTimeout(() => {
      setShowPasswordChange(false);
      setShowMyPageModal(false);
      setPasswordSuccess(false);
    }, 2000);
  };

  const handleLogout = () => {
    // 로그아웃 로직
    onLogout();
  };

  // 필터링 및 검색 로직
  const filteredTasks = sampleTasks.filter(task => {
    // 검색 필터
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase());

    // 상태 필터
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 shadow-sm">
        <div className="px-8 py-4 flex items-center justify-between">
          {/* Left: Logo and Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onLogoClick(rect);
              }}
              className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-all hover:scale-110 cursor-pointer"
              title="일반 채팅 열기"
            >
              <Sparkles className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-gray-900 font-bold">Trade Copilot</h1>
              <p className="text-gray-500 text-sm">일반 채팅을 하려면 로고를 클릭하세요</p>
            </div>
          </div>

          {/* Right: User Info and Logout */}
          <div className="flex items-center gap-4">
            <span className="text-gray-600 text-sm">{userEmployeeId}</span>
            <button
              onClick={() => setShowMyPageModal(!showMyPageModal)}
              className="text-gray-600 hover:text-gray-900 text-sm flex items-center gap-1 transition-colors"
            >
              마이페이지
            </button>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900 text-sm flex items-center gap-1 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-8 py-8 max-w-7xl mx-auto">
        {/* Title Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">내 작업</h1>
        </div>

        {/* Floating Action Button - 우측 하단 고정 */}
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => onNavigate('documents')}
            className="bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full flex items-center justify-center transition-colors shadow-lg"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Filter and Search Section */}
        <div className="mb-4 flex items-center gap-4">
          {/* Status Filter */}
          <div className="relative">
            <button
              onClick={() => setShowStatusFilter(!showStatusFilter)}
              className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
            >
              <Filter className="w-5 h-5" />
              <span>상태 필터</span>
              <ChevronDown className="w-5 h-5" />
            </button>
            {showStatusFilter && (
              <div className="absolute top-14 left-0 w-40 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden z-10">
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setShowStatusFilter(false);
                  }}
                  className="w-full p-2 text-left hover:bg-gray-50 transition-colors"
                >
                  전체
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('completed');
                    setShowStatusFilter(false);
                  }}
                  className="w-full p-2 text-left hover:bg-gray-50 transition-colors"
                >
                  완료된 작업
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('in-progress');
                    setShowStatusFilter(false);
                  }}
                  className="w-full p-2 text-left hover:bg-gray-50 transition-colors"
                >
                  진행중인 작업
                </button>
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="relative w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 text-gray-700 px-4 py-2 pl-10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="작업 검색..."
            />
            <Search className="absolute top-2.5 left-3 w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* Task Cards */}
        <div className="grid grid-cols-3 gap-4 items-start">
          {filteredTasks.map(task => (
            <div
              key={task.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow h-full"
            >
              <div className="flex items-start gap-4 h-full">
                <div
                  className={`w-12 h-12 ${task.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
                >
                  <task.icon className={`w-6 h-6 ${task.iconColor}`} />
                </div>
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-gray-900">{task.title}</h3>
                    {task.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-md text-xs">
                        <CheckCircle className="w-3 h-3" />
                        완료
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded-md text-xs">
                        <Clock className="w-3 h-3" />
                        진행중
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm mb-3">{task.date}</p>
                  <p className="text-gray-600 text-sm mb-4">{task.description}</p>
                  <div className="flex justify-end mt-auto">
                    <button
                      onClick={() => onNavigate('documents')}
                      className="text-blue-600 hover:text-blue-700 text-sm transition-colors"
                    >
                      열기
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

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
                onClick={handleLogout}
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
                <label className="block text-gray-700 mb-2" htmlFor="currentPassword">
                  현재 비밀번호
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3"
                  placeholder="현재 비밀번호를 입력하세요"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2" htmlFor="newPassword">
                  새 비밀번호
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3"
                  placeholder="새 비밀번호를 입력하세요 (8자 이상)"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2" htmlFor="confirmPassword">
                  새 비밀번호 확인
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3"
                  placeholder="새 비밀번호를 다시 입력하세요"
                />
              </div>

              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                  비밀번호가 성공적으로 변경되었습니다!
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChange(false);
                    setPasswordError('');
                    setPasswordSuccess(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition-colors"
                >
                  변경하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}