import React, { useEffect, useState } from 'react';
import { Check, X, Folder, MapPin } from 'lucide-react';
import { triggerMemoriesRefresh } from '../hooks/useMemoriesRefresh';

interface MemoryCreatedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  memoryTitle: string;
  categoryName: string;
  location?: string;
}

export function MemoryCreatedDialog({
  isOpen,
  onClose,
  memoryTitle,
  categoryName,
  location
}: MemoryCreatedDialogProps) {
  const [countdown, setCountdown] = useState(3);

  // Auto-close after 3 seconds and refresh memories
  useEffect(() => {
    if (!isOpen) return;

    // Reset countdown when dialog opens
    setCountdown(3);

    // Start countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Close dialog and refresh memories when countdown reaches 0
          handleClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup interval on unmount or when dialog closes
    return () => {
      clearInterval(countdownInterval);
    };
  }, [isOpen]);

  const handleClose = () => {
    console.log('🔄 MemoryCreatedDialog: Closing and triggering memories refresh');
    // Trigger memories refresh
    triggerMemoriesRefresh();
    // Close the dialog
    onClose();
  };

  if (!isOpen) return null;

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
      style={{ zIndex: 99999 }}
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative p-6"
        style={{ zIndex: 100000 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
        >
          <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          <span className="sr-only">Close</span>
        </button>

        <div className="flex flex-col items-center text-center space-y-4 pt-2">
          {/* Header with inline checkmark */}
          <div className="flex items-center justify-center gap-3">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white stroke-[3]" />
            </div>
            <h2 className="text-xl font-medium text-gray-900">
              Campaign Created Successfully!
            </h2>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-gray-500 max-w-xs">
              Your campaign has been saved and is now available in your collection.
            </p>
          </div>

          {/* Large Success Icon */}
          <div className="py-6">
            <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center">
              <Check className="w-10 h-10 text-green-600 stroke-[2.5]" />
            </div>
          </div>

          {/* Memory Details */}
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-lg font-medium text-gray-900 mb-1">
                "{memoryTitle}"
              </div>
              <div className="text-sm text-gray-600">
                has been added to your <span className="text-green-600 font-medium">{categoryName}</span> campaigns.
              </div>
            </div>

            {/* Category and Location */}
            <div className="flex items-center justify-center gap-4 text-xs pt-2">
              <div className="flex items-center gap-1.5 text-gray-600">
                <Folder className="w-3.5 h-3.5 text-gray-400" />
                <span>{categoryName}</span>
              </div>
              {location && (
                <div className="flex items-center gap-1.5 text-gray-600">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span>{location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}