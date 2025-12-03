// SkipState.tsx - 건너뛰기 상태
import { motion } from 'framer-motion';
import { Ban, ArrowLeft } from 'lucide-react';

interface SkipStateProps {
  onBack: () => void;
}

export default function SkipState({ onBack }: SkipStateProps) {
  return (
    <div className="h-full flex flex-col p-4">
      <div className="mb-4 flex-shrink-0">
        <button
          onClick={onBack}
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
