import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

// Types for Google Picker API
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  sizeBytes?: number;
}

interface UseGoogleDrivePickerReturn {
  openDrivePicker: (onFilesSelected: (files: File[]) => void) => Promise<void>;
  isPickerLoading: boolean;
}

export const useGoogleDrivePicker = (): UseGoogleDrivePickerReturn => {
  const [isPickerLoading, setIsPickerLoading] = useState(false);
  const [pickerApiLoaded, setPickerApiLoaded] = useState(false);

  // Load Google Picker API script
  useEffect(() => {
    const loadPickerApi = () => {
      // Check if already loaded
      if (window.google?.picker) {
        setPickerApiLoaded(true);
        return;
      }

      // Check if gapi is already loaded
      if (window.gapi) {
        window.gapi.load('picker', () => {
          setPickerApiLoaded(true);
          console.log('📁 Google Drive Picker API loaded successfully');
        });
        return;
      }

      // Load the picker API
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('picker', () => {
          setPickerApiLoaded(true);
          console.log('📁 Google Drive Picker API loaded successfully');
        });
      };
      script.onerror = () => {
        console.error('❌ Failed to load Google Drive Picker API');
        toast.error('Failed to load Google Drive picker');
      };
      document.body.appendChild(script);
    };

    loadPickerApi();
  }, []);

  // Download file from Google Drive and convert to File object
  const downloadDriveFile = async (fileId: string, fileName: string, mimeType: string, accessToken: string): Promise<File | null> => {
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        console.error(`Failed to download file ${fileName}:`, response.status);
        return null;
      }

      const blob = await response.blob();
      return new File([blob], fileName, { type: mimeType });
    } catch (error) {
      console.error(`Error downloading file ${fileName}:`, error);
      return null;
    }
  };

  // Open Google Drive Picker
  const openDrivePicker = useCallback(async (onFilesSelected: (files: File[]) => void) => {
    if (!pickerApiLoaded) {
      toast.error('Google Drive picker is still loading. Please try again.');
      return;
    }

    setIsPickerLoading(true);

    try {
      // Get Google access token from backend
      console.log('📁 Getting Google Drive access token...');
      const token = localStorage.getItem('stasht_token');

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/react'}/google-photos/access-token`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      console.log('📁 Access token response:', data);

      if (!data.success || !data.data?.access_token) {
        toast.error('Failed to get Google Drive access. Please connect your Google account first.');
        setIsPickerLoading(false);
        return;
      }

      const accessToken = data.data.access_token;

      // Picker callback function
      const pickerCallback = async (pickerData: any) => {
        console.log('📁 Drive Picker callback:', pickerData);

        if (pickerData.action === window.google.picker.Action.PICKED) {
          const docs = pickerData.docs || [];
          console.log('📁 Selected files from Drive:', docs);

          // Filter only image files
          const imageFiles = docs.filter((doc: any) => {
            const mimeType = doc.mimeType?.toLowerCase() || '';
            return mimeType === 'image/jpeg' || mimeType === 'image/jpg' || mimeType === 'image/png';
          });

          if (imageFiles.length === 0) {
            toast.error('Please select only JPG, JPEG, or PNG image files.');
            return;
          }

          if (imageFiles.length !== docs.length) {
            toast.warning(`Only ${imageFiles.length} of ${docs.length} files are valid images (JPG, JPEG, PNG).`);
          }

          toast.info(`Downloading ${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''} from Google Drive...`);

          // Download all selected images
          const downloadedFiles: File[] = [];
          for (const doc of imageFiles) {
            const file = await downloadDriveFile(doc.id, doc.name, doc.mimeType, accessToken);
            if (file) {
              downloadedFiles.push(file);
            }
          }

          if (downloadedFiles.length > 0) {
            toast.success(`Successfully loaded ${downloadedFiles.length} image${downloadedFiles.length > 1 ? 's' : ''} from Google Drive`);
            onFilesSelected(downloadedFiles);
          } else {
            toast.error('Failed to download images from Google Drive');
          }
        } else if (pickerData.action === window.google.picker.Action.CANCEL) {
          console.log('📁 User cancelled Drive picker');
        }
      };

      // Create Google Drive view for images only
      const driveView = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setMimeTypes('image/jpeg,image/png,image/jpg');

      // Create and render the Picker object
      const picker = new window.google.picker.PickerBuilder()
        .addView(driveView)
        .setOAuthToken(accessToken)
        .setDeveloperKey(import.meta.env.VITE_GOOGLE_PICKER_API_KEY || '')
        .setCallback(pickerCallback)
        .setTitle('Select images from Google Drive')
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .build();

      picker.setVisible(true);
      setIsPickerLoading(false);
    } catch (error) {
      console.error('❌ Error opening Google Drive picker:', error);
      toast.error('Failed to open Google Drive picker');
      setIsPickerLoading(false);
    }
  }, [pickerApiLoaded]);

  return {
    openDrivePicker,
    isPickerLoading,
  };
};
