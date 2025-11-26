import { useState } from 'react';
import { Lock, User, IdCard } from 'lucide-react';

interface LoginPageProps {
  onLogin: (employeeId: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const INITIAL_PASSWORD = 'a123456!';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // 간단한 유효성 검사
    if (!employeeId || !password) {
      setError('사원번호와 비밀번호를 모두 입력해주세요.');
      setIsLoading(false);
      return;
    }

    // 비밀번호 확인
    if (password !== INITIAL_PASSWORD) {
      setError('비밀번호가 올바르지 않습니다.');
      setIsLoading(false);
      return;
    }

    // Mock 로그인 처리 (프론트엔드 전용)
    setTimeout(() => {
      onLogin(employeeId);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-gray-900 mb-2">무역 서류 작성 시스템</h1>
          <p className="text-gray-600">Trade Document Management System</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="mb-6">
            <h2 className="text-gray-900 mb-1">로그인</h2>
            <p className="text-gray-600">회사 계정으로 로그인하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Employee ID Input */}
            <div>
              <label htmlFor="employeeId" className="block text-gray-700 mb-2">
                사원번호
              </label>
              <div className="relative">
                <IdCard className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="employeeId"
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="사원번호를 입력하세요"
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-gray-700 mb-2">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  로그인 중...
                </>
              ) : (
                '로그인'
              )}
            </button>
          </form>

          {/* Info Text */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-blue-900 text-sm">
              <strong>안내:</strong> 이 시스템은 회사 무역팀 전용입니다. 
              초기 비밀번호는 관리자에게 문의하세요.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-gray-600 text-sm">
          © 2025 Trade Document Management System. All rights reserved.
        </div>
      </div>
    </div>
  );
}