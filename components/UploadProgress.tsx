import React from 'react';
import { CheckCircle, XCircle, Loader2, Image, Video } from 'lucide-react';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

export interface UploadProgressItem {
  id: string;
  fileName: string;
  fileType: string;
  progress: number;
  status: 'uploading' | 'processing' | 'compressing' | 'complete' | 'error';
  name: string;
  size: string;
  position?: number;
  originalFile?: File;
  originalSize?: string;
  compressedSize?: string;
  error?: string;
}

interface UploadProgressProps {
  uploads: UploadProgressItem[];
  onDismiss: (id: string) => void;
  onClearCompleted: () => void;
}

export default function UploadProgress({
  uploads,
  onDismiss,
  onClearCompleted
}: UploadProgressProps) {
  if (uploads.length === 0) return null;

  const completedUploads = uploads.filter(upload => upload.status === 'complete');
  const activeUploads = uploads.filter(upload => upload.status !== 'complete' && upload.status !== 'error');
  const errorUploads = uploads.filter(upload => upload.status === 'error');
  
  // Calculate overall progress
  const totalFiles = uploads.length;
  const completedFiles = completedUploads.length;
  const failedFiles = errorUploads.length;
  const uploadingFiles = activeUploads.length;
  const overallProgress = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-900">
            Upload Progress
          </h3>
          {completedUploads.length > 0 && (
            <button
              onClick={onClearCompleted}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Clear completed
            </button>
          )}
        </div>
        
        {/* Overall Progress Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {completedFiles} of {totalFiles} completed ({overallProgress}%)
            </span>
            <div className="flex items-center gap-3 text-xs">
              {uploadingFiles > 0 && (
                <span className="text-[#6C60FF] flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {uploadingFiles} uploading
                </span>
              )}
              {completedFiles > 0 && (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {completedFiles} done
                </span>
              )}
              {failedFiles > 0 && (
                <span className="text-red-600 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  {failedFiles} failed
                </span>
              )}
            </div>
          </div>
          
          {/* Overall Progress Bar */}
          <Progress value={overallProgress} className="h-2" />
        </div>
      </div>

      {/* Upload items */}
      <div className="max-h-64 overflow-y-auto">
        {uploads.map((upload) => (
          <div key={upload.id} className="p-3 border-b border-gray-100 last:border-b-0">
            <div className="flex items-center gap-3">
              {/* File type icon */}
              <div className="flex-shrink-0">
                {upload.fileType?.startsWith('video/') ? (
                  <Video className="w-4 h-4 text-gray-500" />
                ) : (
                  <Image className="w-4 h-4 text-gray-500" />
                )}
              </div>

              {/* File info and progress */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-gray-900 truncate" title={upload.fileName}>
                    {upload.fileName}
                  </p>
                  
                  <div className="flex items-center gap-2">
                    {/* Status badge */}
                    {upload.status === 'complete' && (
                      <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Complete
                      </Badge>
                    )}
                    {upload.status === 'error' && (
                      <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
                        <XCircle className="w-3 h-3 mr-1" />
                        Error
                      </Badge>
                    )}
                    {(upload.status === 'uploading' || upload.status === 'processing' || upload.status === 'compressing') && (
                      <Badge variant="secondary" className="bg-[#6C60FF]/10 text-[#6C60FF] border-[#6C60FF]/20">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        {upload.status === 'uploading' ? 'Uploading' : upload.status === 'compressing' ? 'Compressing' : 'Processing'}
                      </Badge>
                    )}

                    {/* Dismiss button */}
                    {upload.status === 'complete' || upload.status === 'error' ? (
                      <button
                        onClick={() => onDismiss(upload.id)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Progress bar */}
                {upload.status !== 'complete' && upload.status !== 'error' && (
                  <div className="mb-1">
                    <Progress value={upload.progress} className="h-1" />
                  </div>
                )}

                {/* File size info */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {upload.status === 'complete' && upload.originalSize && upload.compressedSize
                      ? `${upload.originalSize} → ${upload.compressedSize}`
                      : upload.size || upload.originalSize || ''}
                  </span>
                  <span>
                    {upload.status === 'complete' 
                      ? '100%' 
                      : upload.status === 'error'
                        ? 'Failed'
                        : `${upload.progress}%`}
                  </span>
                </div>

                {/* Error message */}
                {upload.status === 'error' && upload.error && (
                  <p className="text-xs text-red-600 mt-1">{upload.error}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}