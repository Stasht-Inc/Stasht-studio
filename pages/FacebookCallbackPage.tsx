import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  storeFacebookToken,
  validateFacebookToken,
  fetchAllPhotosWithPagination,
  transformFacebookPhoto
} from '../utils/facebookAuthAPI';
import { dashboardAPI } from '../utils/authUtils';
import { useSyncProgress } from '../contexts/SyncProgressContext';

export default function FacebookCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing Facebook authorization...');
  const { startSync, updateProgress, completeSync, failSync } = useSyncProgress();

  // Prevent duplicate processing
  const hasProcessed = useRef(false);

  useEffect(() => {
    console.log('🔵 FacebookCallbackPage mounted');
    console.log('🔵 Current URL:', window.location.href);
    console.log('🔵 Hash:', window.location.hash);
    console.log('🔵 Pathname:', window.location.pathname);

    // Only run once to prevent duplicate processing
    if (!hasProcessed.current) {
      hasProcessed.current = true;
      handleFacebookCallback();
    }
  }, []);

  const handleFacebookCallback = async () => {
    try {
      // Check if user is logged in to OUR app first
      const userToken = localStorage.getItem('stasht_token');
      const userData = localStorage.getItem('stasht_user');

      if (!userToken || !userData) {
        console.error('❌ User not logged in to our app');
        setStatus('error');
        setMessage('You must be logged in to sync Facebook photos');
        toast.error('Please log in first');

        // Redirect to login page after 2 seconds
        setTimeout(() => {
          navigate('/media');
        }, 2000);
        return;
      }

      console.log('✅ User is logged in to our app');

      // Facebook returns access token in URL hash (implicit flow)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);

      const accessToken = params.get('access_token');
      const state = params.get('state');
      const error = params.get('error');
      const errorDescription = params.get('error_description');

      // Check for errors
      if (error) {
        console.error('❌ Facebook OAuth error:', error, errorDescription);
        setStatus('error');
        setMessage(errorDescription || 'Authorization failed');
        toast.error(errorDescription || 'Facebook authorization failed');

        // Redirect back to media page after 3 seconds
        setTimeout(() => {
          navigate('/media');
        }, 3000);
        return;
      }

      // Check if we have access token
      if (!accessToken) {
        console.error('❌ No access token received');
        setStatus('error');
        setMessage('No access token received from Facebook');
        toast.error('Authorization failed');

        setTimeout(() => {
          navigate('/media');
        }, 3000);
        return;
      }

      console.log('✅ Facebook access token received');
      setMessage('Validating Facebook token...');

      // Validate the token
      const isValid = await validateFacebookToken(accessToken);
      if (!isValid) {
        setStatus('error');
        setMessage('Invalid Facebook token');
        toast.error('Token validation failed');

        setTimeout(() => {
          navigate('/media');
        }, 3000);
        return;
      }

      // Store the token
      storeFacebookToken(accessToken);
      console.log('💾 Token stored successfully');

      // Store the service to activate Facebook tab on media page
      sessionStorage.setItem('activeServiceTab', 'facebook');
      sessionStorage.setItem('service_just_connected', 'true');

      // Navigate to media page immediately (like Dropbox/Google)
      console.log('🔄 Redirecting to media page...');
      navigate('/media');

      // Start sync progress in sidebar (like OAuthCallback does)
      startSync('facebook', 'Facebook', 'facebook');
      updateProgress(0, 'Initiating Facebook sync...');

      // Simulate realistic progress while API is working
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        currentProgress += Math.random() * 15; // Random increment between 0-15%
        if (currentProgress > 90) currentProgress = 90; // Cap at 90% until we get response

        const messages = [
          'Connecting to Facebook...',
          'Fetching your photos...',
          'Processing images...',
          'Uploading to your library...',
          'Almost done...'
        ];
        const messageIndex = Math.floor((currentProgress / 90) * messages.length);
        updateProgress(Math.floor(currentProgress), messages[Math.min(messageIndex, messages.length - 1)]);
      }, 800); // Update every 800ms

      // Run the actual sync in background
      setTimeout(async () => {
        try {
          console.log('📸 Fetching photos from Facebook...');

          // Fetch all photos from Facebook
          const photos = await fetchAllPhotosWithPagination(accessToken);

          if (!photos || photos.length === 0) {
            console.log('ℹ️ No photos found in Facebook account');
            clearInterval(progressInterval);
            completeSync(0);
            toast.info('No photos found in your Facebook account');
            return;
          }

          console.log(`📸 Fetched ${photos.length} photos from Facebook`);

          // Transform photos to our format
          const transformedPhotos = photos.map(transformFacebookPhoto);

          // Send photos to backend to save (with access token for URL refresh later)
          const response = await dashboardAPI.saveSyncedMedia({
            service: 'facebook',
            photos: transformedPhotos,
            access_token: accessToken  // Include access token for future URL refresh
          });

          clearInterval(progressInterval);

          if (response.success) {
            const savedCount = response.data?.saved_count || transformedPhotos.length;
            console.log(`✅ Successfully saved ${savedCount} photos`);

            // Complete sync with the count (shows in sidebar)
            completeSync(savedCount);
            toast.success(`${savedCount} photos synced from Facebook!`);

            // DON'T reload - let user click "View Media" button in sidebar
            // The View Media button will refresh the media data properly
          } else {
            throw new Error(response.error || 'Failed to save photos');
          }
        } catch (syncError: any) {
          clearInterval(progressInterval);
          console.error('❌ Error during Facebook sync:', syncError);
          failSync(syncError.message || 'Failed to sync Facebook photos');
          toast.error('Failed to sync Facebook photos');
        }
      }, 100);

    } catch (error: any) {
      console.error('❌ Error in Facebook callback:', error);
      setStatus('error');
      setMessage(error.message || 'An error occurred during sync');
      toast.error('Failed to sync Facebook photos');

      setTimeout(() => {
        navigate('/media');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#6C60FF] to-[#5B4FE8] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* Facebook Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#1877F2] rounded-full flex items-center justify-center">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="white">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
        </div>

        {/* Status Message */}
        <h2 className="text-2xl font-bold text-center mb-4 text-gray-900">
          {status === 'processing' && 'Connecting Facebook'}
          {status === 'success' && 'Connected!'}
          {status === 'error' && 'Connection Failed'}
        </h2>

        <p className="text-center text-gray-600 mb-6">{message}</p>

        {/* Status Icon */}
        {status === 'success' && (
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {status === 'processing' && (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1877F2]"></div>
          </div>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          {status === 'processing' && 'Redirecting to Media page...'}
          {status === 'success' && 'Redirecting to Media page...'}
          {status === 'error' && 'Redirecting back...'}
        </p>
      </div>
    </div>
  );
}
