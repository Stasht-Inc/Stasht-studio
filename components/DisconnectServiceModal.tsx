import React from 'react';
import { X, Loader2 } from 'lucide-react';

interface DisconnectServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  serviceName: string;
  itemCount: number;
  isDisconnecting?: boolean;
}

export function DisconnectServiceModal({
  isOpen,
  onClose,
  onConfirm,
  serviceName,
  itemCount,
  isDisconnecting = false
}: DisconnectServiceModalProps) {
  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
        onClick={isDisconnecting ? undefined : onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title */}
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Disconnect {serviceName}?
          </h2>

          {/* Message */}
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            This will remove all {itemCount} items synced from {serviceName} from your media
            library. This action cannot be undone, but you can reconnect and re-sync
            this service later.
          </p>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isDisconnecting}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isDisconnecting}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isDisconnecting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
