import React from 'react';
import { X, AlertCircle, Chrome, Globe } from 'lucide-react';
import { Button } from './ui/button';

interface PopupBlockedGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
}

export function PopupBlockedGuideModal({
  isOpen,
  onClose,
  onRetry
}: PopupBlockedGuideModalProps) {
  const [isRetrying, setIsRetrying] = React.useState(false);
  const retryTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Auto-retry periodically while modal is open
  React.useEffect(() => {
    if (!isOpen || isRetrying) return;

    console.log('📋 Popup guide modal opened - will check for popup permission every 2 seconds');

    // Check if user has enabled popups by attempting to open a test popup
    const checkPopupPermission = () => {
      if (!isOpen || isRetrying) return;

      console.log('🔍 Checking if popups are now allowed...');

      // Try to open a small test popup to a blank page
      const testPopup = window.open('', '_blank', 'width=1,height=1,left=-1000,top=-1000');

      if (testPopup) {
        console.log('✅ Popup permission detected! Auto-retrying...');
        testPopup.close();
        handleRetry();
      } else {
        console.log('❌ Popups still blocked, will check again in 2 seconds');
        // Schedule next check
        retryTimeoutRef.current = setTimeout(checkPopupPermission, 2000);
      }
    };

    // Start checking after a short delay
    retryTimeoutRef.current = setTimeout(checkPopupPermission, 1000);

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [isOpen, isRetrying]);

  const handleRetry = async () => {
    if (isRetrying) return;
    console.log('🔄 Manual retry triggered');
    setIsRetrying(true);
    await onRetry();
    setIsRetrying(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full relative animate-in fade-in zoom-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="p-6">
            {/* Header with Alert Icon */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  Please Enable Popups
                </h2>
                <p className="text-sm text-gray-600">
                  To connect Google Photos, we need to open a secure authentication window
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-4 mb-6">
              {/* Why we need this */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Why?</strong> Google requires a secure popup window to authenticate your account and protect your privacy.
                </p>
              </div>

              {/* Browser-specific instructions */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Chrome className="w-4 h-4" />
                  How to Enable Popups:
                </h3>

                <div className="space-y-2 pl-6">
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-purple-100 text-purple-700 rounded-full text-xs font-bold flex-shrink-0 mt-0.5">
                      1
                    </span>
                    <p className="text-sm text-gray-700">
                      Look for the popup blocked icon <span className="inline-flex items-center justify-center w-5 h-5 bg-gray-200 rounded text-xs mx-1">🚫</span> in your browser's address bar
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-purple-100 text-purple-700 rounded-full text-xs font-bold flex-shrink-0 mt-0.5">
                      2
                    </span>
                    <p className="text-sm text-gray-700">
                      Click on it and select <strong>"Always allow popups from this site"</strong>
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-purple-100 text-purple-700 rounded-full text-xs font-bold flex-shrink-0 mt-0.5">
                      3
                    </span>
                    <p className="text-sm text-gray-700">
                      Click the <strong>"Try Again"</strong> button below
                    </p>
                  </div>
                </div>
              </div>

              {/* Alternative browsers */}
              <details className="group">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Using a different browser? Click here
                </summary>
                <div className="mt-2 pl-4 space-y-2 text-xs text-gray-600">
                  <p><strong>Firefox:</strong> Click the preferences icon → Allow popups for this site</p>
                  <p><strong>Safari:</strong> Safari menu → Preferences → Websites → Pop-up Windows → Allow for this site</p>
                  <p><strong>Edge:</strong> Click the popup icon in address bar → Always allow popups</p>
                </div>
              </details>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex-1 bg-[#6C60FF] hover:bg-[#5850E5] text-white disabled:opacity-50"
              >
                {isRetrying ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Retrying...
                  </>
                ) : (
                  "I've Enabled Popups - Try Again"
                )}
              </Button>
            </div>

            {/* Footer note */}
            <p className="text-xs text-center text-gray-500 mt-4">
              💡 Tip: We're automatically checking for popup permission. Once enabled, the picker will open automatically within 2 seconds.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
