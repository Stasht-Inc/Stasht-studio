import { useState, useCallback, useEffect } from 'react';
import { googleAuthAPI } from '../utils/googleAuthAPI';
import { toast } from 'sonner';

// Types for Google Picker API
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface GooglePhotoPickerResult {
  id: string;
  name: string;
  description?: string;
  mimeType: string;
  sizeBytes?: string;
  url: string;
  thumbnailUrl?: string;
  serviceId: string;
  type: string;
  photoMetadata?: {
    width: number;
    height: number;
    captureTime: string;
  };
  lastEditedUtc?: number;
}

interface UseGooglePhotosPickerReturn {
  openPicker: () => Promise<void>;
  isPickerLoading: boolean;
  selectedPhotos: GooglePhotoPickerResult[];
  savePhotosToDatabase: () => Promise<boolean>;
  isSaving: boolean;
}

export const useGooglePhotosPicker = (): UseGooglePhotosPickerReturn => {
  const [isPickerLoading, setIsPickerLoading] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<GooglePhotoPickerResult[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [pickerApiLoaded, setPickerApiLoaded] = useState(false);

  // Load Google Picker API script
  useEffect(() => {
    const loadPickerApi = () => {
      // Check if already loaded
      if (window.google?.picker) {
        setPickerApiLoaded(true);
        return;
      }

      // Load the picker API
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('picker', () => {
          setPickerApiLoaded(true);
          console.log('📸 Google Picker API loaded successfully');
        });
      };
      script.onerror = () => {
        console.error('❌ Failed to load Google Picker API');
        toast.error('Failed to load Google Photos picker');
      };
      document.body.appendChild(script);
    };

    loadPickerApi();
  }, []);

  // Open Google Photos Picker
  const openPicker = useCallback(async () => {
    if (!pickerApiLoaded) {
      toast.error('Google Photos picker is still loading. Please try again.');
      return;
    }

    setIsPickerLoading(true);

    try {
      // Get Google Photos service info (which includes access token)
      console.log('📸 Getting Google Photos access token...');
      const token = localStorage.getItem('stasht_token');

      // Call your backend to get the Google Photos access token
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/react'}/google-photos/access-token`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      console.log('📸 Access token response:', data);

      if (!data.success || !data.data?.access_token) {
        toast.error('Failed to get Google Photos access. Please reconnect your account.');
        setIsPickerLoading(false);
        return;
      }

      const accessToken = data.data.access_token;

      // Create and render the Picker object
      const picker = new window.google.picker.PickerBuilder()
        .addView(window.google.picker.ViewId.PHOTOS)
        .setOAuthToken(accessToken)
        .setDeveloperKey(import.meta.env.VITE_GOOGLE_PICKER_API_KEY || '') // Add this to your .env
        .setCallback(pickerCallback)
        .setTitle('Select photos from Google Photos')
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .build();

      picker.setVisible(true);
      setIsPickerLoading(false);
    } catch (error) {
      console.error('❌ Error opening Google Photos picker:', error);
      toast.error('Failed to open Google Photos picker');
      setIsPickerLoading(false);
    }
  }, [pickerApiLoaded]);

  // Picker callback function
  const pickerCallback = useCallback((data: any) => {
    console.log('📸 Picker callback:', data);

    if (data.action === window.google.picker.Action.PICKED) {
      const docs = data.docs || [];
      console.log('📸 Selected photos:', docs);

      const photos: GooglePhotoPickerResult[] = docs.map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        description: doc.description,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        url: doc.url,
        thumbnailUrl: doc.thumbnails?.[0]?.url,
        serviceId: doc.serviceId || 'photos',
        type: doc.type || 'photo',
        photoMetadata: doc.photoMetadata ? {
          width: doc.photoMetadata.width,
          height: doc.photoMetadata.height,
          captureTime: doc.photoMetadata.captureTime,
        } : undefined,
        lastEditedUtc: doc.lastEditedUtc,
      }));

      setSelectedPhotos(photos);
      toast.success(`Selected ${photos.length} photo${photos.length > 1 ? 's' : ''} from Google Photos`);
    } else if (data.action === window.google.picker.Action.CANCEL) {
      console.log('📸 User cancelled picker');
      toast.info('Photo selection cancelled');
    }
  }, []);

  // Save selected photos to database
  const savePhotosToDatabase = useCallback(async (): Promise<boolean> => {
    if (selectedPhotos.length === 0) {
      toast.error('No photos selected to save');
      return false;
    }

    setIsSaving(true);

    try {
      console.log('📸 Saving photos to database...', selectedPhotos);

      // Transform photos to match backend API structure
      const photosToSave = selectedPhotos.map(photo => ({
        google_photo_id: photo.id,
        service_id: photo.serviceId,
        name: photo.name,
        description: photo.description,
        mime_type: photo.mimeType,
        url: photo.url,
        thumbnail_url: photo.thumbnailUrl,
        size_bytes: photo.sizeBytes ? parseInt(photo.sizeBytes) : undefined,
        width: photo.photoMetadata?.width,
        height: photo.photoMetadata?.height,
        capture_time: photo.photoMetadata?.captureTime || new Date().toISOString(),
        last_edited_utc: photo.lastEditedUtc,
      }));

      const response = await googleAuthAPI.saveGooglePhotos(photosToSave);

      if (response.success) {
        const savedCount = response.data?.saved_count || 0;
        toast.success(`Successfully saved ${savedCount} photo${savedCount > 1 ? 's' : ''} to your library!`);

        // Clear selected photos
        setSelectedPhotos([]);
        setIsSaving(false);
        return true;
      } else {
        toast.error(response.error || 'Failed to save photos');
        setIsSaving(false);
        return false;
      }
    } catch (error) {
      console.error('❌ Error saving photos to database:', error);
      toast.error('An error occurred while saving photos');
      setIsSaving(false);
      return false;
    }
  }, [selectedPhotos]);

  return {
    openPicker,
    isPickerLoading,
    selectedPhotos,
    savePhotosToDatabase,
    isSaving,
  };
};
