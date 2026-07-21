import React, { useState } from 'react';
import { X, Image, Calendar, Users, Lock, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';

interface GooglePhotosConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
  onMaybeLater: () => void;
}

export function GooglePhotosConnectModal({
  isOpen,
  onClose,
  onConnect,
  onMaybeLater
}: GooglePhotosConnectModalProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  if (!isOpen) return null;

  const handleMaybeLater = () => {
    if (dontAskAgain) {
      // Store preference in localStorage
      localStorage.setItem('google_photos_dont_ask', 'true');
    }
    onMaybeLater();
  };

  const handleConnect = () => {
    if (dontAskAgain) {
      // Store preference in localStorage
      localStorage.setItem('google_photos_dont_ask', 'true');
    }
    onConnect();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full relative"
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
            {/* Header with Google Photos icon */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 26 26" fill="none">
                  <g clipPath="url(#clip0_google_photos)">
                    <path d="M1.08337 13.0002C1.08337 4.3335 4.33337 1.0835 13 1.0835C21.6667 1.0835 24.9167 4.3335 24.9167 13.0002C24.9167 21.6668 21.6667 24.9168 13 24.9168C4.33337 24.9168 1.08337 21.6668 1.08337 13.0002Z" fill="white"/>
                    <path d="M3.90002 12.9998H10.92C11.477 12.9988 12.0108 12.7767 12.4042 12.3823L8.45003 8.31982L3.90002 12.9998Z" fill="#FFC400"/>
                    <path d="M12.4041 12.3823C12.7873 11.9921 13.0013 11.4667 13 10.9198V8.31982H8.44995L12.4041 12.3823Z" fill="#FFA300"/>
                    <path d="M22.1 13H15.08C14.523 13.001 13.9892 13.2231 13.5958 13.6175L17.55 17.68L22.1 13Z" fill="#0089FF"/>
                    <path d="M13.5958 13.6177C13.2127 14.0079 12.9986 14.5333 13 15.0802V17.6802H17.55L13.5958 13.6177Z" fill="#0069E4"/>
                    <path d="M13 3.8999V10.9199C13.001 11.4769 13.2231 12.0107 13.6175 12.4041L17.68 8.4499L13 3.8999Z" fill="#FF4834"/>
                    <path d="M13.6176 12.4044C14.0078 12.7875 14.5332 13.0016 15.0801 13.0002H17.6801V8.4502L13.6176 12.4044Z" fill="#FF025F"/>
                    <path d="M12.9999 22.0999V15.0799C12.9989 14.5229 12.7768 13.9891 12.3824 13.5957L8.31995 17.5499L12.9999 22.0999Z" fill="#00C800"/>
                    <path d="M12.3824 13.5958C11.9922 13.2127 11.4668 12.9986 10.9199 13H8.31995V17.55L12.3824 13.5958Z" fill="#00A44C"/>
                  </g>
                  <defs>
                    <clipPath id="clip0_google_photos">
                      <rect width="26" height="26" fill="white"/>
                    </clipPath>
                  </defs>
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  Connect Google Photos?
                </h2>
                <p className="text-sm text-gray-600">
                  Enhance your Stasht experience with your Google Photos
                </p>
              </div>
            </div>

            {/* Features list */}
            <div className="space-y-3 mb-6">
              {/* Auto-import */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Image className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
                    Auto-import your photos
                  </h3>
                  <p className="text-xs text-gray-600">
                    Seamlessly bring in your existing photo library
                  </p>
                </div>
              </div>

              {/* Automatic date detection */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
                    Automatic date detection
                  </h3>
                  <p className="text-xs text-gray-600">
                    Photos are organized by their original date and time
                  </p>
                </div>
              </div>

              {/* Preserve shared albums */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
                    Preserve shared albums
                  </h3>
                  <p className="text-xs text-gray-600">
                    Keep your shared campaigns in one place
                  </p>
                </div>
              </div>

              {/* Secure & private */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
                    Secure & private
                  </h3>
                  <p className="text-xs text-gray-600">
                    Your photos remain private and encrypted
                  </p>
                </div>
              </div>
            </div>

            {/* Info note */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-800">
                <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                We'll only access photos you choose to import. You can disconnect at any time from your settings.
              </p>
            </div>

            {/* Don't ask me again checkbox */}
            <div className="flex items-center gap-2 mb-6">
              <Checkbox
                id="dont-ask-again"
                checked={dontAskAgain}
                onCheckedChange={(checked) => setDontAskAgain(checked as boolean)}
              />
              <label
                htmlFor="dont-ask-again"
                className="text-sm text-gray-700 cursor-pointer select-none"
              >
                Don't ask me again
              </label>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleMaybeLater}
                className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Maybe Later
              </Button>
              <Button
                onClick={handleConnect}
                className="flex-1 bg-[#6C60FF] hover:bg-[#5850E5] text-white flex items-center justify-center gap-2.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 26 26" fill="none" className="flex-shrink-0">
                  <g clipPath="url(#clip0_google_photos_btn)">
                    <path d="M1.08337 13.0002C1.08337 4.3335 4.33337 1.0835 13 1.0835C21.6667 1.0835 24.9167 4.3335 24.9167 13.0002C24.9167 21.6668 21.6667 24.9168 13 24.9168C4.33337 24.9168 1.08337 21.6668 1.08337 13.0002Z" fill="white"/>
                    <path d="M3.90002 12.9998H10.92C11.477 12.9988 12.0108 12.7767 12.4042 12.3823L8.45003 8.31982L3.90002 12.9998Z" fill="#FFC400"/>
                    <path d="M12.4041 12.3823C12.7873 11.9921 13.0013 11.4667 13 10.9198V8.31982H8.44995L12.4041 12.3823Z" fill="#FFA300"/>
                    <path d="M22.1 13H15.08C14.523 13.001 13.9892 13.2231 13.5958 13.6175L17.55 17.68L22.1 13Z" fill="#0089FF"/>
                    <path d="M13.5958 13.6177C13.2127 14.0079 12.9986 14.5333 13 15.0802V17.6802H17.55L13.5958 13.6177Z" fill="#0069E4"/>
                    <path d="M13 3.8999V10.9199C13.001 11.4769 13.2231 12.0107 13.6175 12.4041L17.68 8.4499L13 3.8999Z" fill="#FF4834"/>
                    <path d="M13.6176 12.4044C14.0078 12.7875 14.5332 13.0016 15.0801 13.0002H17.6801V8.4502L13.6176 12.4044Z" fill="#FF025F"/>
                    <path d="M12.9999 22.0999V15.0799C12.9989 14.5229 12.7768 13.9891 12.3824 13.5957L8.31995 17.5499L12.9999 22.0999Z" fill="#00C800"/>
                    <path d="M12.3824 13.5958C11.9922 13.2127 11.4668 12.9986 10.9199 13H8.31995V17.55L12.3824 13.5958Z" fill="#00A44C"/>
                  </g>
                  <defs>
                    <clipPath id="clip0_google_photos_btn">
                      <rect width="26" height="26" fill="white"/>
                    </clipPath>
                  </defs>
                </svg>
                <span>Connect Google Photos</span>
              </Button>
            </div>

            {/* Footer note */}
            <p className="text-xs text-center text-gray-500 mt-4">
              You can always connect Google Photos later from your profile settings
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
