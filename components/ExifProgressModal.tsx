import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, Calendar, MapPin, Image } from 'lucide-react';

interface ExifProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractionResults: Array<{
    fileName: string;
    hasDate: boolean;
    hasLocation: boolean;
    isProcessing: boolean;
    isCompleted: boolean;
  }>;
}

export function ExifProgressModal({ isOpen, onClose, extractionResults }: ExifProgressModalProps) {
  if (!isOpen) return null;

  // Force re-render using a counter that increments with changes
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [extractionResults]);

  // Calculate counts
  const totalFiles = extractionResults.length;
  const completedFiles = extractionResults.filter(file => file.isCompleted).length;

  // Count files with dates and locations (only completed files)
  const filesWithDates = extractionResults.filter(file =>
    file.hasDate === true && file.isCompleted === true
  ).length;

  const filesWithLocations = extractionResults.filter(file =>
    file.hasLocation === true && file.isCompleted === true
  ).length;

  const allCompleted = completedFiles === totalFiles && totalFiles > 0;

  const modalContent = (
    <div
      className="fixed top-4 right-4 pointer-events-auto"
      style={{ zIndex: 100001 }}
    >
      <div
        className="bg-white rounded-lg shadow-2xl border border-gray-200"
        style={{
          width: '280px',
          maxHeight: '350px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              allCompleted ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              <Check className={`w-4 h-4 ${allCompleted ? 'text-green-600' : 'text-blue-600'}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {allCompleted ? 'EXIF Data Extracted:' : 'Extracting EXIF Data...'}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-blue-600">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-semibold">{filesWithDates} with dates</span>
            </div>
            <div className="flex items-center gap-1 text-purple-600">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-semibold">{filesWithLocations} with locations</span>
            </div>
          </div>
        </div>

        {/* Files Section */}
        <div className="p-4">
          <h4 className="text-xs font-medium text-gray-700 mb-3">Files:</h4>

          {/* Files List */}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {extractionResults.map((file, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-shrink-0">
                  <Image className="w-3 h-3 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-900 truncate font-medium mb-1">
                    {file.fileName}
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        file.isCompleted ? 'bg-purple-500' :
                        file.isProcessing ? 'bg-blue-400' : 'bg-gray-300'
                      }`}
                      style={{
                        width: file.isCompleted ? '100%' : file.isProcessing ? '70%' : '0%'
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Progress Summary */}
          {totalFiles > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-600">
                {allCompleted
                  ? `✅ All ${totalFiles} images processed!`
                  : `⏳ Processing ${completedFiles}/${totalFiles}...`
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}