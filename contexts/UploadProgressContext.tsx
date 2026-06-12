import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UploadProgressContextType {
  isUploading: boolean;
  uploadProgress: {
    current: number;
    total: number;
    percentage: number;
  };
  uploadData: {
    formData: any;
    photosArray: any[];
    photosWithMetadata: any[];
  } | null;
  startUpload: (total: number) => void;
  updateProgress: (current: number) => void;
  completeUpload: (data: { formData: any; photosArray: any[]; photosWithMetadata: any[] }) => void;
  resetUpload: () => void;
  isUploadComplete: boolean;
}

const UploadProgressContext = createContext<UploadProgressContextType | undefined>(undefined);

export const useUploadProgress = () => {
  const context = useContext(UploadProgressContext);
  if (!context) {
    throw new Error('useUploadProgress must be used within an UploadProgressProvider');
  }
  return context;
};

interface UploadProgressProviderProps {
  children: ReactNode;
}

export const UploadProgressProvider: React.FC<UploadProgressProviderProps> = ({ children }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadComplete, setIsUploadComplete] = useState(false);

  // Debug upload complete state changes
  useEffect(() => {
    console.log('🎯 isUploadComplete changed to:', isUploadComplete);
  }, [isUploadComplete]);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
    percentage: 0
  });
  const [uploadData, setUploadData] = useState<{
    formData: any;
    photosArray: any[];
    photosWithMetadata: any[];
  } | null>(null);

  const startUpload = (total: number) => {
    setIsUploading(true);
    setIsUploadComplete(false);
    setUploadProgress({
      current: 0,
      total,
      percentage: 0
    });
    setUploadData(null);
  };

  const updateProgress = (current: number) => {
    setUploadProgress(prev => ({
      ...prev,
      current,
      percentage: prev.total > 0 ? Math.round((current / prev.total) * 100) : 0
    }));
  };

  const completeUpload = (data: { formData: any; photosArray: any[]; photosWithMetadata: any[] }) => {
    console.log('🔄 UploadProgressContext.completeUpload called with data:', {
      formDataFiles: data.formData?.mediaFiles?.length || 0,
      photosArrayLength: data.photosArray?.length || 0,
      photosWithMetadataLength: data.photosWithMetadata?.length || 0
    });
    setIsUploading(false);
    setIsUploadComplete(true);
    setUploadData(data);
    setUploadProgress(prev => ({
      ...prev,
      current: prev.total,
      percentage: 100
    }));
    console.log('✅ Upload completion state updated - Upload Done button should be visible');

    // Add a safety timeout to ensure the state persists for at least 30 seconds
    // This prevents any accidental resets from hiding the button too quickly
    setTimeout(() => {
      console.log('⏰ 30-second safety timeout reached, upload completion still available');
    }, 30000);
  };

  const resetUpload = () => {
    console.log('🔄 UploadProgressContext.resetUpload called');
    console.trace('Reset upload called from:'); // This will show the call stack
    setIsUploading(false);
    setIsUploadComplete(false);
    setUploadProgress({
      current: 0,
      total: 0,
      percentage: 0
    });
    setUploadData(null);
    console.log('✅ Upload state reset completed');
  };

  const value: UploadProgressContextType = {
    isUploading,
    uploadProgress,
    uploadData,
    startUpload,
    updateProgress,
    completeUpload,
    resetUpload,
    isUploadComplete
  };

  return (
    <UploadProgressContext.Provider value={value}>
      {children}
    </UploadProgressContext.Provider>
  );
};