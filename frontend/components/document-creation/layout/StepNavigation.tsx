// StepNavigation.tsx - 스텝 탭 네비게이션
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Lock, Plus, Paperclip, MinusCircle, PenTool, Ban } from 'lucide-react';
import { STEP_SHORT_NAMES, StepMode } from '../types';

interface StepNavigationProps {
  currentStep: number;
  maxProgressStep: number;
  stepModes: Record<number, StepMode>;
  uploadedFiles: Record<number, File | null>;
  getStepCompletionStatus: (stepNumber: number) => boolean;
  onStepChange: (step: number) => void;
}

export default function StepNavigation({
  currentStep,
  maxProgressStep,
  stepModes,
  uploadedFiles,
  getStepCompletionStatus,
  onStepChange
}: StepNavigationProps) {
  return (
    <div className="px-8 py-4 bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm flex-shrink-0 z-10 relative">
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
            const isComplete = getStepCompletionStatus(stepNumber);

            // Check accessibility
            let isAccessible = true;
            if (stepNumber > 1) {
              const prevStepComplete = getStepCompletionStatus(stepNumber - 1);
              isAccessible = prevStepComplete;
            }

            return (
              <div key={index} className="flex flex-col items-center gap-2 relative group z-10">
                <motion.button
                  onClick={() => isAccessible && onStepChange(stepNumber)}
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
                        {uploadedFiles[stepNumber] ? (
                          <Paperclip className="w-4 h-4 text-white" />
                        ) : stepModes[stepNumber] === 'skip' ? (
                          <MinusCircle className="w-4 h-4 text-white" />
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
  );
}
