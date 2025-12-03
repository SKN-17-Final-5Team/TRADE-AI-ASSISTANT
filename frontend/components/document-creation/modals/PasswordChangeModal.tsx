// PasswordChangeModal.tsx - 비밀번호 변경 모달
import { useState } from 'react';

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PasswordChangeModal({
  isOpen,
  onClose
}: PasswordChangeModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleClose = () => {
    setPasswordError('');
    setPasswordSuccess(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
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
      handleClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[200]"
      onClick={handleClose}
    >
      <div
        className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-gray-900">비밀번호 변경</h2>
          <button
            onClick={handleClose}
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
  );
}
