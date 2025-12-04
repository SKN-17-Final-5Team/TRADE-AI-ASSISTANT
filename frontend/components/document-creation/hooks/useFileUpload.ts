// useFileUpload.ts - 파일 업로드 상태 관리 훅
import { useState, useCallback, useRef } from 'react';
import { uploadDocumentFlow, DocumentStatus } from '../../../utils/documentApi';
import type { UploadStatus } from '../types';

interface UseFileUploadReturn {
  uploadedFiles: Record<number, File | null>;
  uploadedFileNames: Record<number, string>;
  uploadStatus: Record<number, UploadStatus>;
  uploadError: Record<number, string | null>;
  uploadedDocumentIds: Record<number, number | null>;
  uploadedDocumentUrls: Record<number, string | null>;
  handleFileUpload: (step: number, file: File, docId: number) => Promise<void>;
  removeUploadedFile: (step: number) => void;
  retryUpload: (step: number) => void;
}

export function useFileUpload(initialUploadedFileNames: Record<number, string> = {}): UseFileUploadReturn {
  const [uploadedFiles, setUploadedFiles] = useState<Record<number, File | null>>({});
  const [uploadedFileNames, setUploadedFileNames] = useState<Record<number, string>>(initialUploadedFileNames);
  const [uploadedDocumentIds, setUploadedDocumentIds] = useState<Record<number, number | null>>({});
  const [uploadedDocumentUrls, setUploadedDocumentUrls] = useState<Record<number, string | null>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<number, UploadStatus>>({});
  const [uploadError, setUploadError] = useState<Record<number, string | null>>({});
  const [uploadUnsubscribe, setUploadUnsubscribe] = useState<Record<number, (() => void) | null>>({});

  // 재시도를 위해 docId 저장
  const docIdRef = useRef<Record<number, number>>({});

  const handleFileUpload = useCallback(async (step: number, file: File, docId: number) => {
    // 파일 및 docId 저장
    setUploadedFiles(prev => ({ ...prev, [step]: file }));
    setUploadedFileNames(prev => ({ ...prev, [step]: file.name }));
    setUploadStatus(prev => ({ ...prev, [step]: 'uploading' }));
    setUploadError(prev => ({ ...prev, [step]: null }));
    docIdRef.current[step] = docId;

    try {
      const unsubscribe = await uploadDocumentFlow(file, docId, {
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
    setUploadedFileNames(prev => {
      const newNames = { ...prev };
      delete newNames[step];
      return newNames;
    });
    setUploadedDocumentIds(prev => ({ ...prev, [step]: null }));
    setUploadedDocumentUrls(prev => ({ ...prev, [step]: null }));
    setUploadStatus(prev => ({ ...prev, [step]: 'idle' }));
    setUploadError(prev => ({ ...prev, [step]: null }));
  }, []);

  const retryUpload = useCallback((step: number) => {
    const file = uploadedFiles[step];
    const docId = docIdRef.current[step];
    if (file && docId) {
      handleFileUpload(step, file, docId);
    }
  }, [uploadedFiles, handleFileUpload]);

  return {
    uploadedFiles,
    uploadedFileNames,
    uploadStatus,
    uploadError,
    uploadedDocumentIds,
    uploadedDocumentUrls,
    handleFileUpload,
    removeUploadedFile,
    retryUpload,
  };
}
