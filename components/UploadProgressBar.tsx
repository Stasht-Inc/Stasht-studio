import React from 'react';
import { Button } from './ui/button';
import { CheckCircle, Upload } from 'lucide-react';
import { useUploadProgress } from '../contexts/UploadProgressContext';

interface UploadProgressBarProps {
  onUploadComplete: () => void;
}

export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({ onUploadComplete }) => {
  const { isUploading, uploadProgress, isUploadComplete, resetUpload, uploadData } = useUploadProgress();

  console.log('🔍 UploadProgressBar render:', {
    isUploading,
    isUploadComplete,
    uploadProgress,
    willRender: isUploading || isUploadComplete
  });

  if (!isUploading && !isUploadComplete) {
    console.log('❌ UploadProgressBar returning null - no upload in progress or complete');
    return null;
  }

  const handleUploadDone = () => {
    console.log('🎯 User clicked Upload Done button!');
    console.log('📦 Current upload data available:', {
      uploadProgress,
      isUploadComplete,
      uploadDataExists: !!uploadData
    });
    onUploadComplete();
    console.log('📌 Opening Create Memory modal with uploaded data...');
    // Don't reset upload data here - let the modal handle it after restoration
  };

  return (
    <div className="w-full bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {isUploading ? (
            <Upload className="w-5 h-5 text-blue-600 animate-pulse" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-600" />
          )}

          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-900">
                {isUploading
                  ? `Uploading images... ${uploadProgress.current} / ${uploadProgress.total}`
                  : `Upload complete! ${uploadProgress.total} images processed`
                }
              </span>
              <span className="text-sm" style={{ color: '#6C60FF' }}>
                {uploadProgress.percentage}%
              </span>
            </div>

            <div className="w-full bg-gray-200 rounded-full" style={{ height: '7px', flexShrink: 0, alignSelf: 'stretch' }}>
              <div
                className="rounded-full transition-all duration-300"
                style={{
                  height: '7px',
                  width: `${uploadProgress.percentage}%`,
                  background: '#6C60FF',
                  flexShrink: 0,
                  alignSelf: 'stretch'
                }}
              />
            </div>
          </div>
        </div>

        {(() => {
          console.log('🎯 Upload Done button visibility:', {
            isUploadComplete,
            willShowButton: isUploadComplete
          });
          return isUploadComplete;
        })() && (
          <Button
            onClick={handleUploadDone}
            className="ml-4 bg-green-600 hover:bg-green-700 text-white"
            size="sm"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Upload Done
          </Button>
        )}
      </div>
    </div>
  );
};