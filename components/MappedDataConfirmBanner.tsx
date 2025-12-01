import React from 'react';
import { Sparkles, Check, X } from 'lucide-react';

interface MappedDataConfirmBannerProps {
    onConfirm: () => void;
    onDismiss: () => void;
    isChatOpen?: boolean;
    chatWidth?: number;
}

export const MappedDataConfirmBanner: React.FC<MappedDataConfirmBannerProps> = ({
    onConfirm,
    onDismiss,
    isChatOpen = false,
    chatWidth = 400
}) => {
    // Calculate right position based on chat state
    const rightPosition = isChatOpen ? `${chatWidth + 24}px` : '6rem'; // 6rem = 24 in Tailwind

    return (
        <div
            className="fixed bottom-6 z-50 animate-slide-up-fade-in transition-all duration-300"
            style={{ right: rightPosition }}
        >
            <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 border-2 border-green-200 rounded-2xl shadow-2xl backdrop-blur-sm w-auto">
                <div className="px-5 py-3 flex items-center gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                        <div className="relative">
                            <div className="absolute inset-0 bg-green-400 rounded-full blur-md opacity-50 animate-pulse"></div>
                            <div className="relative bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-2">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        <h3 className="text-base font-bold text-gray-900 mb-0.5">
                            자동 매핑된 데이터가 있습니다
                        </h3>
                        <p className="text-xs text-gray-600">
                            다른 필드에서 입력한 내용이 자동으로 반영되었습니다. 적용하시겠습니까?
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        {/* Confirm Button */}
                        <button
                            onClick={onConfirm}
                            className="group relative px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
                            <div className="relative flex items-center gap-1.5">
                                <Check className="w-4 h-4" />
                                <span className="text-sm">적용하기</span>
                            </div>
                        </button>

                        {/* Dismiss Button */}
                        <button
                            onClick={onDismiss}
                            className="px-2 py-2 bg-white border-2 border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 rounded-b-2xl"></div>
            </div>
        </div>
    );
};
