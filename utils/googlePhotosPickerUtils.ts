import { toast } from 'sonner';
import { googleAuthAPI } from './googleAuthAPI';

/**
 * Google Photos Picker Utility
 * Handles opening the picker, polling for selection, and downloading photos
 */

// Handle photos selected from Photo Picker
export const handlePhotoPickerResult = async (result: any) => {
  try {
    const photos = result.photos || [];
    const googleAccessToken = result.accessToken;
    const savingToastId = `google-photos-saving-${Date.now()}`;
    toast.loading(`Saving ${photos.length} photo${photos.length !== 1 ? 's' : ''} from Google Photos...`, { id: savingToastId, duration: Infinity });

    // Download photos and convert to base64
    const photosToSave = await Promise.all(
      photos.map(async (photo: any, index: number) => {
        try {
          console.log(`📥 Downloading photo ${index + 1}/${photos.length}: ${photo.name}`);

          // Download photo from Google Photos with authentication
          const downloadUrl = photo.baseUrl ? `${photo.baseUrl}=d` : null;
          const thumbnailUrl = photo.baseUrl ? `${photo.baseUrl}=w400-h400` : null;

          let photoBase64 = null;
          let thumbnailBase64 = null;

          if (downloadUrl) {
            // Download full-size photo
            const photoResponse = await fetch(downloadUrl, {
              headers: {
                'Authorization': `Bearer ${googleAccessToken}`
              }
            });

            if (photoResponse.ok) {
              const photoBlob = await photoResponse.blob();
              photoBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(photoBlob);
              });
            } else {
              console.error(`❌ Failed to download photo ${index + 1}: ${photoResponse.status}`);
            }
          }

          if (thumbnailUrl && photo.baseUrl) {
            // Download thumbnail
            const thumbResponse = await fetch(thumbnailUrl, {
              headers: {
                'Authorization': `Bearer ${googleAccessToken}`
              }
            });

            if (thumbResponse.ok) {
              const thumbBlob = await thumbResponse.blob();
              thumbnailBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(thumbBlob);
              });
            }
          }

          return {
            google_photo_id: photo.id,
            service_id: 'google_photos',
            name: photo.name || photo.filename || 'Untitled',
            description: photo.description || '',
            mime_type: photo.mimeType,
            photo_data: photoBase64, // Base64 encoded photo
            thumbnail_data: thumbnailBase64 || photoBase64, // Base64 encoded thumbnail
            size_bytes: photo.sizeBytes ? parseInt(photo.sizeBytes) : undefined,
            width: photo.width ? parseInt(photo.width) : undefined,
            height: photo.height ? parseInt(photo.height) : undefined,
            capture_time: photo.creationTime || new Date().toISOString(),
            last_edited_utc: photo.creationTime || new Date().toISOString(),
            location: photo.location || undefined,
          };
        } catch (error) {
          console.error(`❌ Error processing photo ${index + 1}:`, error);
          return null;
        }
      })
    );

    // Filter out failed downloads
    const successfulPhotos = photosToSave.filter(photo => photo !== null && photo.photo_data !== null);

    console.log(`✅ Successfully downloaded ${successfulPhotos.length}/${photos.length} photos`);

    if (successfulPhotos.length === 0) {
      toast.error('Failed to download any photos', { id: savingToastId });
      return { success: false, photos: [] };
    }

    // Save to backend
    const token = localStorage.getItem('stasht_token');

    const saveResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/react'}/google-photos/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        photos: successfulPhotos,
        source: 'google_photos',
        synced_at: new Date().toISOString()
      }),
    });

    if (!saveResponse.ok) {
      throw new Error(`Backend API returned ${saveResponse.status}`);
    }

    const saveResult = await saveResponse.json();
    console.log('📸 Backend response:', saveResult);

    if (saveResult.success) {
      const savedCount = saveResult.data?.saved_count || successfulPhotos.length;
      toast.success(`Successfully imported ${savedCount} photo${savedCount > 1 ? 's' : ''} from Google Photos!`, { id: savingToastId });
      return { success: true, count: savedCount };
    } else {
      toast.error(saveResult.error || 'Failed to save photos', { id: savingToastId });
      return { success: false, photos: [] };
    }

  } catch (error) {
    console.error('❌ Error saving photos:', error);
    toast.error('Failed to save photos', { id: savingToastId });
    return { success: false, photos: [] };
  }
};

// Polling function for Google Photos Picker session
//
// Strategy to balance instant Done detection vs avoiding 429 rate-limit errors:
//
//  Phase 1 — Active polling (first 5 minutes):
//    Poll every 5s so Done is detected within seconds after clicking.
//    On 429: back off (double interval, cap at 30s), reset on next success.
//
//  Phase 2 — Slow polling (after 5 minutes, user is still browsing):
//    Switch to 30s interval to stop hammering the server during long sessions.
//
//  Bonus — window.focus event:
//    If the user switches back to the main window, we check immediately regardless
//    of which phase we're in — gives instant detection in that case.
//
//  Bonus — pickerWindow.closed check:
//    Pure .closed property read every 1s (no API call). If picker closes, check once.
export const startPollingForSession = async (
  sessionId: string,
  accessToken: string,
  onComplete?: (result: any) => void,
  pickerWindow?: Window | null
) => {
  let isCompleted = false;
  let isCheckInFlight = false;
  let pollInterval = 5000;           // start at 5s — Google's own recommendation
  const activePhaseDuration = 300000; // 5 minutes of fast polling
  const slowInterval = 30000;         // 30s after 5 minutes
  const sessionStart = Date.now();
  let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let pickerClosedInterval: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    window.removeEventListener('focus', onWindowFocus);
    if (pollTimeoutId !== null) {
      clearTimeout(pollTimeoutId);
      pollTimeoutId = null;
    }
    if (pickerClosedInterval !== null) {
      clearInterval(pickerClosedInterval);
      pickerClosedInterval = null;
    }
  };

  // Process photos once mediaItemsSet is confirmed
  const processCompletion = async () => {
    isCompleted = true;
    cleanup();

    if (pickerWindow && !pickerWindow.closed) {
      pickerWindow.close();
    }

    const mediaResult = await googleAuthAPI.getPickerMediaItems(sessionId, accessToken);

    if (mediaResult.error) {
      console.error('❌ Error getting media items:', mediaResult.error);
      toast.error('Failed to get selected photos');
      return;
    }

    const mediaItems = mediaResult.mediaItems || [];

    if (mediaItems.length > 0) {
      const formattedResult = {
        photos: mediaItems.map((item: any) => {
          const baseUrl = item.mediaFile?.baseUrl;
          const width = item.mediaFile?.mediaFileMetadata?.width;
          const height = item.mediaFile?.mediaFileMetadata?.height;
          const fullUrl = baseUrl ? `${baseUrl}=d` : undefined;
          const thumbnailUrl = baseUrl ? `${baseUrl}=w400-h400` : undefined;

          return {
            id: item.id,
            name: item.mediaFile?.filename || 'Untitled',
            url: fullUrl,
            baseUrl: baseUrl,
            thumbnail: thumbnailUrl,
            mimeType: item.mediaFile?.mimeType,
            sizeBytes: item.mediaFile?.mediaFileMetadata?.height && item.mediaFile?.mediaFileMetadata?.width
              ? String(item.mediaFile.mediaFileMetadata.height * item.mediaFile.mediaFileMetadata.width)
              : undefined,
            width,
            height,
            description: item.description,
            creationTime: item.createTime,
            location: item.location || item.mediaFile?.location || undefined,
          };
        }),
        accessToken: accessToken
      };

      const result = await handlePhotoPickerResult(formattedResult);
      if (onComplete) {
        onComplete(result);
      }
    } else {
      toast.info('No photos selected');
    }
  };

  const schedulePoll = (delay: number) => {
    if (isCompleted) return;
    pollTimeoutId = setTimeout(pollSession, delay);
  };

  const pollSession = async () => {
    if (isCompleted || isCheckInFlight) return;
    isCheckInFlight = true;

    try {
      const statusResult = await googleAuthAPI.getPickerSessionStatus(sessionId, accessToken);

      if (statusResult.error) {
        if (statusResult.statusCode === 429) {
          // Rate limited — back off but keep going
          pollInterval = Math.min(pollInterval * 2, 30000);
        }
        // Schedule next poll regardless of error type
        schedulePoll(pollInterval);
        return;
      }

      // Successful response — reset interval
      pollInterval = 5000;

      if (statusResult.mediaItemsSet) {
        await processCompletion();
        return;
      }

      // Not selected yet — switch to slow interval after active phase
      const elapsed = Date.now() - sessionStart;
      const nextInterval = elapsed >= activePhaseDuration ? slowInterval : pollInterval;
      schedulePoll(nextInterval);

    } catch (e) {
      console.error('❌ Poll error:', e);
      schedulePoll(pollInterval);
    } finally {
      isCheckInFlight = false;
    }
  };

  // window.focus: instant check when user switches back to the main window
  const onWindowFocus = () => {
    if (isCompleted) return;
    // Cancel the scheduled poll and check immediately
    if (pollTimeoutId !== null) {
      clearTimeout(pollTimeoutId);
      pollTimeoutId = null;
    }
    pollSession();
  };

  window.addEventListener('focus', onWindowFocus);

  // pickerWindow.closed: pure .closed property read — no API calls.
  // Catches the case where picker is closed without the user switching windows.
  if (pickerWindow) {
    pickerClosedInterval = setInterval(() => {
      if (isCompleted) {
        cleanup();
        return;
      }
      if (pickerWindow.closed) {
        clearInterval(pickerClosedInterval!);
        pickerClosedInterval = null;
        // Small delay to let Google's API register the selection
        if (pollTimeoutId !== null) {
          clearTimeout(pollTimeoutId);
          pollTimeoutId = null;
        }
        setTimeout(pollSession, 1500);
      }
    }, 1000);
  }

  // Start first poll after 5s
  schedulePoll(pollInterval);
};

// Retry opening picker with existing session
export const retryPickerWithSession = async (
  sessionId: string,
  pickerUri: string,
  accessToken: string,
  onComplete?: (result: any) => void
) => {
  try {
    console.log('📸 ===== RETRYING GOOGLE PHOTO PICKER WITH EXISTING SESSION =====');
    console.log('📸 Session ID:', sessionId);
    toast.info('Opening Photo Picker...');

    // Try to open picker window again with the same session
    const pickerWindow = window.open(
      pickerUri,
      'GooglePhotosPicker',
      'width=800,height=600,menubar=no,toolbar=no,location=no,status=no'
    );

    if (!pickerWindow) {
      console.error('❌ Failed to open picker window - popup still blocked');
      toast.error('Popup is still blocked. Please check your browser settings.');
      return {
        success: false,
        popupBlocked: true,
        sessionId,
        pickerUri,
        accessToken
      };
    }

    toast.success('Photo Picker opened! Select your photos.');

    // Start polling for session status
    await startPollingForSession(sessionId, accessToken, onComplete, pickerWindow);

    return { success: true };
  } catch (error) {
    console.error('❌ Error retrying Photo Picker:', error);
    toast.error('Failed to open Photo Picker');
    return { success: false };
  }
};

// Open Google Photo Picker using REST API
export const openGooglePhotosPicker = async (onComplete?: (result: any) => void) => {
  try {
    console.log('📸 ===== STARTING GOOGLE PHOTO PICKER (REST API) =====');
    toast.info('Opening Photo Picker...');

    // Get the access token from sessionStorage (stored during OAuth)
    const accessToken = sessionStorage.getItem('google_access_token');
    console.log('📸 Access token available:', !!accessToken);
    console.log('📸 Access token (first 50 chars):', accessToken?.substring(0, 50) + '...');

    if (!accessToken) {
      console.error('❌ No access token found');
      toast.error('Please sign in with Google Photos first');
      return { needsAuth: true };
    }

    // Step 1: Create picker session via backend
    console.log('📸 Step 1: Creating picker session...');
    const sessionResponse = await googleAuthAPI.createPickerSession(accessToken);

    if (sessionResponse.error || !sessionResponse.sessionId || !sessionResponse.pickerUri) {
      console.error('❌ Failed to create session:', sessionResponse.error);
      console.error('❌ HTTP Status Code:', sessionResponse.statusCode);

      // Check if error is due to invalid/expired token
      // Check HTTP 401/403 status OR authentication-related error messages
      const statusCode = sessionResponse.statusCode || 0;
      const errorMsg = sessionResponse.error?.toLowerCase() || '';
      const isAuthError = statusCode === 401 ||
                          statusCode === 403 ||
                          errorMsg.includes('401') ||
                          errorMsg.includes('403') ||
                          errorMsg.includes('authentication') ||
                          errorMsg.includes('unauthenticated') ||
                          errorMsg.includes('invalid') ||
                          errorMsg.includes('expired') ||
                          errorMsg.includes('unauthorized');

      if (isAuthError) {
        console.log('🔄 Token appears invalid/expired (Status: ' + statusCode + '), clearing and requiring re-authentication...');
        sessionStorage.removeItem('google_access_token');
        toast.error('Google authentication expired. Please sign in again.');
        return { needsAuth: true };
      }

      toast.error('Failed to create photo picker session');
      return { success: false };
    }

    const { sessionId, pickerUri } = sessionResponse;
    console.log('📸 ✅ Session created:', sessionId);

    // Step 2: Open picker in new window
    console.log('📸 Step 2: Opening picker window...');
    const pickerWindow = window.open(
      pickerUri,
      'GooglePhotosPicker',
      'width=800,height=600,menubar=no,toolbar=no,location=no,status=no'
    );

    if (!pickerWindow) {
      console.error('❌ Failed to open picker window - popup blocked?');
      toast.error('Failed to open Photo Picker. Please allow popups.');
      // Return session info so it can be retried with the same session
      return {
        success: false,
        popupBlocked: true,
        sessionId,
        pickerUri,
        accessToken
      };
    }

    toast.success('Photo Picker opened! Select your photos.');

    // Step 3: Poll for session status
    await startPollingForSession(sessionId, accessToken, onComplete, pickerWindow);

    return { success: true };
  } catch (error) {
    console.error('❌ Error opening Photo Picker:', error);
    toast.error('Failed to open Photo Picker');
    return { success: false };
  }
};
