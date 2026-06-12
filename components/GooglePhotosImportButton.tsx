import React, { useEffect } from 'react';
import { Button } from './ui/button';
import { useGooglePhotosPicker } from '../hooks/useGooglePhotosPicker';
import { Loader2 } from 'lucide-react';

interface GooglePhotosImportButtonProps {
  onImportComplete?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
}

export const GooglePhotosImportButton: React.FC<GooglePhotosImportButtonProps> = ({
  onImportComplete,
  variant = 'default',
  className = '',
}) => {
  const {
    openPicker,
    isPickerLoading,
    selectedPhotos,
    savePhotosToDatabase,
    isSaving,
  } = useGooglePhotosPicker();

  // Auto-save when photos are selected
  useEffect(() => {
    if (selectedPhotos.length > 0 && !isSaving) {
      console.log('📸 Auto-saving selected photos...', selectedPhotos.length);
      savePhotosToDatabase().then((success) => {
        if (success && onImportComplete) {
          onImportComplete();
        }
      });
    }
  }, [selectedPhotos, isSaving, savePhotosToDatabase, onImportComplete]);

  const handleClick = async () => {
    await openPicker();
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isPickerLoading || isSaving}
      variant={variant}
      className={className}
    >
      {(isPickerLoading || isSaving) && (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      )}
      {isSaving ? (
        'Importing photos...'
      ) : isPickerLoading ? (
        'Loading picker...'
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 26 26"
            fill="none"
            className="mr-2"
          >
            <g clipPath="url(#clip0_google_photos_import)">
              <path
                d="M3.90002 12.9998H10.92C11.477 12.9988 12.0108 12.7767 12.4042 12.3823L8.45003 8.31982L3.90002 12.9998Z"
                fill="currentColor"
              />
              <path
                d="M12.4041 12.3823C12.7873 11.9921 13.0013 11.4667 13 10.9198V8.31982H8.44995L12.4041 12.3823Z"
                fill="currentColor"
              />
              <path
                d="M22.1 13H15.08C14.523 13.001 13.9892 13.2231 13.5958 13.6175L17.55 17.68L22.1 13Z"
                fill="currentColor"
              />
              <path
                d="M13.5958 13.6177C13.2127 14.0079 12.9986 14.5333 13 15.0802V17.6802H17.55L13.5958 13.6177Z"
                fill="currentColor"
              />
              <path
                d="M13 3.8999V10.9199C13.001 11.4769 13.2231 12.0107 13.6175 12.4041L17.68 8.4499L13 3.8999Z"
                fill="currentColor"
              />
              <path
                d="M13.6176 12.4044C14.0078 12.7875 14.5332 13.0016 15.0801 13.0002H17.6801V8.4502L13.6176 12.4044Z"
                fill="currentColor"
              />
              <path
                d="M12.9999 22.0999V15.0799C12.9989 14.5229 12.7768 13.9891 12.3824 13.5957L8.31995 17.5499L12.9999 22.0999Z"
                fill="currentColor"
              />
              <path
                d="M12.3824 13.5958C11.9922 13.2127 11.4668 12.9986 10.9199 13H8.31995V17.55L12.3824 13.5958Z"
                fill="currentColor"
              />
            </g>
            <defs>
              <clipPath id="clip0_google_photos_import">
                <rect width="26" height="26" fill="white" />
              </clipPath>
            </defs>
          </svg>
          Import from Google Photos
        </>
      )}
    </Button>
  );
};
