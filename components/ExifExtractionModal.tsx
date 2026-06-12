import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, Calendar, MapPin, Image } from 'lucide-react';
import { Button } from './ui/button';

interface ExifExtractionModalProps {
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

export function ExifExtractionModal({ isOpen, onClose, extractionResults }: ExifExtractionModalProps) {
  if (!isOpen) return null;

  // Force re-render using a counter that increments with changes
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [extractionResults]);

  // Recalculate statistics every time
  const totalFiles = extractionResults.length;
  const completedFiles = extractionResults.filter(file => file.isCompleted).length;

  // More explicit filtering for debugging
  const filesWithDates = extractionResults.filter(file => {
    const hasDateAndCompleted = file.hasDate === true && file.isCompleted === true;
    return hasDateAndCompleted;
  }).length;

  const filesWithLocations = extractionResults.filter(file => {
    const hasLocationAndCompleted = file.hasLocation === true && file.isCompleted === true;
    return hasLocationAndCompleted;
  }).length;

  // Detailed debugging for each file
  const debugInfo = extractionResults.map((r, index) => ({
    index,
    fileName: r.fileName,
    hasDate: r.hasDate,
    hasLocation: r.hasLocation,
    isCompleted: r.isCompleted,
    isProcessing: r.isProcessing,
    passesDateFilter: r.hasDate === true && r.isCompleted === true,
    passesLocationFilter: r.hasLocation === true && r.isCompleted === true
  }));

  // Debug logging with detailed breakdown
  console.log(`📊 [RENDER ${renderKey}] EXIF Modal Debug:`, {
    totalFiles,
    completedFiles,
    filesWithDates,
    filesWithLocations,
    debugInfo,
    dateFilterResults: debugInfo.filter(d => d.passesDateFilter),
    locationFilterResults: debugInfo.filter(d => d.passesLocationFilter),
    rawExtractionResults: extractionResults
  });

  // Simple manual calculation - count immediately
  let manualDateCount = 0;
  let manualLocationCount = 0;

  extractionResults.forEach((result) => {
    if (result.isCompleted === true) {
      if (result.hasDate === true) manualDateCount++;
      if (result.hasLocation === true) manualLocationCount++;
    }
  });

  console.log(`🎯 MODAL RENDER - Counts:`, {
    renderKey,
    totalFiles,
    completedFiles,
    manualDateCount,
    manualLocationCount,
    allResults: extractionResults.map(r => ({
      fileName: r.fileName.slice(0, 10),
      hasDate: r.hasDate,
      hasLocation: r.hasLocation,
      isCompleted: r.isCompleted
    }))
  });

  return (
    <div
      className="mt-3 bg-white rounded-lg border border-gray-200 p-4 w-full"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-green-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Processing Images...</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Files List with Progress Bars */}
      <div className="space-y-2">
        {extractionResults.map((file, index) => (
          <div key={index} className="flex items-center gap-2">
            <Image className="w-4 h-4 text-gray-400 flex-shrink-0" />
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

      {/* Progress Status */}
      <div className="mt-3 text-center">
        <p className="text-xs text-gray-600">
          {completedFiles === totalFiles
            ? '✅ All images processed!'
            : `⏳ Processing ${completedFiles}/${totalFiles} images...`
          }
        </p>
      </div>
    </div>
  );
}