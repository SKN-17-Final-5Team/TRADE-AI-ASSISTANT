// useFileUpload.ts - 파일 업로드 상태 관리 훅
import { useState, useCallback } from 'react';
import { uploadDocumentFlow, DocumentStatus } from '../../../utils/documentApi';
import type { UploadStatus } from '../types';

interface UseFileUploadReturn {
  uploadedFiles: Record<number, File | null>;
  uploadStatus: Record<number, UploadStatus>;
  uploadError: Record<number, string | null>;
  uploadedDocumentIds: Record<number, number | null>;
  uploadedDocumentUrls: Record<number, string | null>;
  handleFileUpload: (step: number, file: File) => Promise<void>;
  removeUploadedFile: (step: number) => void;
  retryUpload: (step: number) => void;
}

export function useFileUpload(): UseFileUploadReturn {
  const [uploadedFiles, setUploadedFiles] = useState<Record<number, File | null>>({});
  const [uploadedDocumentIds, setUploadedDocumentIds] = useState<Record<number, number | null>>({});
  const [uploadedDocumentUrls, setUploadedDocumentUrls] = useState<Record<number, string | null>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<number, UploadStatus>>({});
  const [uploadError, setUploadError] = useState<Record<number, string | null>>({});
  const [uploadUnsubscribe, setUploadUnsubscribe] = useState<Record<number, (() => void) | null>>({});

  const handleFileUpload = useCallback(async (step: number, file: File) => {
    // 파일 저장
    setUploadedFiles(prev => ({ ...prev, [step]: file }));
    setUploadStatus(prev => ({ ...prev, [step]: 'uploading' }));
    setUploadError(prev => ({ ...prev, [step]: null }));

    const documentType = step === 1 ? 'offer_sheet' : 'sales_contract';

    try {
      const unsubscribe = await uploadDocumentFlow(file, documentType, {
        onPresignedUrl: (data) => {
          setUploadedDocumentIds(prev => ({ ...prev, [step]: data.document_id }));
        },
        onS3UploadComplete: () => {
          // S3 업로드 완료
        },
        onProcessingStart: () => {
          setUploadStatus(prev => ({ ...prev, [step]: 'processing' }));
        },
        onStatus: (_status: DocumentStatus) => {
          // 처리 중 상태 업데이트 (progress 등) - 필요시 구현
        },
        onComplete: (status: DocumentStatus) => {
          setUploadStatus(prev => ({ ...prev, [step]: 'ready' }));
          setUploadedDocumentUrls(prev => ({ ...prev, [step]: status.s3_url || null }));
        },
        onError: (error: string) => {
          setUploadStatus(prev => ({ ...prev, [step]: 'error' }));
          setUploadError(prev => ({ ...prev, [step]: error }));
        }
      });

      // 구독 취소 함수 저장
      setUploadUnsubscribe(prev => ({ ...prev, [step]: unsubscribe }));

    } catch (error) {
      setUploadStatus(prev => ({ ...prev, [step]: 'error' }));
      setUploadError(prev => ({ ...prev, [step]: error instanceof Error ? error.message : '업로드 실패' }));
    }
  }, []);

  const removeUploadedFile = useCallback((step: number) => {
    // SSE 구독 취소
    setUploadUnsubscribe(prev => {
      if (prev[step]) {
        prev[step]?.();
      }
      return { ...prev, [step]: null };
    });

    // 상태 초기화
    setUploadedFiles(prev => {
      const newFiles = { ...prev };
      delete newFiles[step];
      return newFiles;
    });
    setUploadedDocumentIds(prev => ({ ...prev, [step]: null }));
    setUploadedDocumentUrls(prev => ({ ...prev, [step]: null }));
    setUploadStatus(prev => ({ ...prev, [step]: 'idle' }));
    setUploadError(prev => ({ ...prev, [step]: null }));
  }, []);

  const retryUpload = useCallback((step: number) => {
    const file = uploadedFiles[step];
    if (file) {
      handleFileUpload(step, file);
    }
  }, [uploadedFiles, handleFileUpload]);

  return {
    uploadedFiles,
    uploadStatus,
    uploadError,
    uploadedDocumentIds,
    uploadedDocumentUrls,
    handleFileUpload,
    removeUploadedFile,
    retryUpload,
  };
}
