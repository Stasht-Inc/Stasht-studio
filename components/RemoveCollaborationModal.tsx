import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

interface RemoveCollaborationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  memoryTitle: string;
  isRemoving?: boolean;
}

export function RemoveCollaborationModal({
  isOpen,
  onClose,
  onConfirm,
  memoryTitle,
  isRemoving = false
}: RemoveCollaborationModalProps) {
  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
        onClick={isRemoving ? undefined : onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-gray-900 mb-3 text-center">
            Remove from Memory?
          </h2>

          {/* Message */}
          <p className="text-sm text-gray-600 mb-6 leading-relaxed text-center">
            Are you sure you want to remove yourself from the memory account? This action cannot be undone.
          </p>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isRemoving}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isRemoving}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isRemoving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isRemoving ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
