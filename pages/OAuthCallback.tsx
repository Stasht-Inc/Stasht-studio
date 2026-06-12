import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { dashboardAPI } from '../utils/authUtils';
import { googleAuthAPI } from '../utils/googleAuthAPI';
import SessionValidator from '../utils/sessionValidator';
import { toast } from 'sonner';
import { useSyncProgress } from '../contexts/SyncProgressContext';
import { openGooglePhotosPicker } from '../utils/googlePhotosPickerUtils';

export default function OAuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { service } = useParams<{ service: string }>();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Connecting...');
  const { startSync, updateProgress, completeSync, failSync } = useSyncProgress();

  // Prevent duplicate API calls
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Only run once
    if (!hasProcessed.current) {
      hasProcessed.current = true;
      handleOAuthCallback();
    }
  }, []); // Empty dependency array - run only on mount

  const handleGooglePhotosSignupCallback = async (
    code: string | null,
    state: string | null,
    error: string | null,
    errorDescription: string | null,
    pendingSignupStr: string
  ) => {
    console.log('📸 Processing Google Photos callback during signup...');

    // Parse pending signup data
    let pendingData;
    try {
      pendingData = JSON.parse(pendingSignupStr);
    } catch (e) {
      console.error('❌ Failed to parse pending signup data:', e);
      toast.error('Failed to complete signup. Please try again.');
      navigate('/');
      return;
    }

    if (error) {
      console.log('❌ Google Photos authorization failed:', error, errorDescription);
      toast.error('Google Photos connection failed. Completing signup...');
      // Still complete the signup without Google Photos
      completeSignupWithoutGooglePhotos(pendingData);
      return;
    }

    if (!code) {
      console.log('❌ No authorization code received');
      toast.error('Google Photos connection failed. Completing signup...');
      completeSignupWithoutGooglePhotos(pendingData);
      return;
    }

    try {
      console.log('📸 Connecting Google Photos...');
      setMessage('Connecting Google Photos...');

      // Temporarily store token to use in the API call
      const tempToken = pendingData.token;
      localStorage.setItem('stasht_token', tempToken);

      // Send code to backend to save Google Photos connection
      const response = await googleAuthAPI.googlePhotosCallback(code);
      console.log('📸 Google Photos callback response:', response);

      if (response.success) {
        console.log('✅ Google Photos connected successfully');
        toast.success('Google Photos connected successfully!');

        // Check if we should open picker after OAuth
        const shouldOpenPicker = sessionStorage.getItem('open_google_photos_picker_after_oauth');
        if (shouldOpenPicker === 'true') {
          console.log('📸 Setting flag to open picker after redirect...');
          sessionStorage.setItem('open_google_photos_picker_now', 'true');
          sessionStorage.removeItem('open_google_photos_picker_after_oauth');
        }
      } else {
        console.log('❌ Failed to connect Google Photos:', response.error);
        toast.error('Failed to connect Google Photos');
      }
    } catch (error) {
      console.error('❌ Error connecting Google Photos:', error);
      toast.error('Failed to connect Google Photos');
    }

    // Complete signup regardless of Google Photos result
    completeSignupWithoutGooglePhotos(pendingData);
  };

  const completeSignupWithoutGooglePhotos = (pendingData: any) => {
    console.log('✅ Completing signup...');

    // Store auth data
    localStorage.setItem('stasht_user', JSON.stringify(pendingData.user));
    localStorage.setItem('stasht_token', pendingData.token);

    // Initialize session validator
    const userIdentifier = pendingData.user.email || pendingData.user.phone_number;
    if (pendingData.user.id && userIdentifier) {
      SessionValidator.initSession(pendingData.user.id, userIdentifier, pendingData.token);
    }

    // Trigger session change event
    const sessionChangeData = {
      userId: pendingData.user.id,
      email: pendingData.user.email,
      phone_number: pendingData.user.phone_number,
      timestamp: Date.now()
    };
    localStorage.setItem('stasht_session_change', JSON.stringify(sessionChangeData));

    // Clear pending signup data
    sessionStorage.removeItem('pending_google_signup');

    // Clear pending invite params
    sessionStorage.removeItem('pendingInvite');
    localStorage.removeItem('pendingInvite');
    sessionStorage.removeItem('just_logged_out_for_invite');

    toast.success('Successfully signed up with Google!');
    setStatus('success');
    setMessage('Signup complete! Redirecting...');

    // Redirect to home (will trigger authentication)
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  };

  const handleOAuthCallback = async () => {
    // Parse URL parameters
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    console.log('📡 OAuth Callback received:', { service, code, state, error });

    // Check if this is a Google Photos callback during signup flow
    const pendingSignup = sessionStorage.getItem('pending_google_signup');
    if (pendingSignup && service === 'google') {
      console.log('📸 Google Photos callback during signup flow detected');
      handleGooglePhotosSignupCallback(code, state, error, errorDescription, pendingSignup);
      return;
    }

    if (error) {
      // OAuth error occurred
      console.error('❌ OAuth error:', error, errorDescription);
      setStatus('error');
      setMessage(errorDescription || error || 'Authorization failed');
      toast.error(`Connection failed: ${errorDescription || error}`);

      // Redirect back after delay
      setTimeout(() => {
        navigate('/media');
      }, 3000);
      return;
    }

    if (!code) {
      console.error('❌ No authorization code received');
      setStatus('error');
      setMessage('No authorization code received');
      toast.error('Authorization failed: No code received');

      setTimeout(() => {
        navigate('/media');
      }, 3000);
      return;
    }

    if (!service) {
      console.error('❌ No service specified');
      setStatus('error');
      setMessage('No service specified');
      toast.error('Authorization failed: No service specified');

      setTimeout(() => {
        navigate('/media');
      }, 3000);
      return;
    }

    // Exchange code for token
    try {
      console.log(`🔑 Exchanging authorization code for ${service}...`);
      setMessage('Exchanging authorization code...');

      const tokenResponse = await dashboardAPI.exchangeServiceToken(service, code, state || '');
      console.log('🔑 Token exchange response:', tokenResponse);

      if (tokenResponse.success) {
        console.log(`✅ Successfully connected to ${service}`);
        setStatus('success');
        setMessage('Connected successfully!');
        toast.success(`Successfully connected to ${service}!`);

        // Check if we should trigger sync or open picker
        const returnAction = sessionStorage.getItem('oauth_return_action');
        const storedServiceId = sessionStorage.getItem('oauth_service');
        const returnPage = sessionStorage.getItem('oauth_return_page');
        sessionStorage.removeItem('oauth_service');
        sessionStorage.removeItem('oauth_return_action');
        sessionStorage.removeItem('oauth_return_page');

        // Special handling for Google Photos picker
        if (returnAction === 'open_picker' && service === 'google') {
          console.log('📸 Opening Google Photos Picker after OAuth...');

          // Store the access token from the response
          if (tokenResponse.data?.access_token) {
            sessionStorage.setItem('google_access_token', tokenResponse.data.access_token);
            console.log('✅ Google access token stored');
          }

          // Navigate to media page
          navigate('/media');

          // Wait a bit for navigation, then open picker
          setTimeout(async () => {
            console.log('📸 Auto-opening Google Photos Picker...');
            await openGooglePhotosPicker((importResult) => {
              if (importResult && importResult.success) {
                console.log('📸 Photos imported successfully:', importResult.count);
                toast.success(`Imported ${importResult.count} photos!`);
                // Refresh the page to show new photos
                window.location.reload();
              }
            });
          }, 1000);

          return;
        }

        if (returnAction === 'sync') {
          // Store the service ID to activate that tab
          sessionStorage.setItem('activeServiceTab', storedServiceId || service);
          sessionStorage.setItem('service_just_connected', 'true');

          // Navigate to media page immediately
          navigate('/media');

          // Start the sync process with progress bar in sidebar
          const serviceName = service.charAt(0).toUpperCase() + service.slice(1);
          startSync(storedServiceId || service, serviceName, service);
          updateProgress(0, 'Initiating sync...');

          // Simulate realistic progress while API is working
          let currentProgress = 0;
          const progressInterval = setInterval(() => {
            currentProgress += Math.random() * 15;
            if (currentProgress > 90) currentProgress = 90;

            const messages = [
              'Connecting to service...',
              'Fetching media list...',
              'Downloading thumbnails...',
              'Processing items...',
              'Almost done...'
            ];
            const messageIndex = Math.floor((currentProgress / 90) * messages.length);
            updateProgress(Math.floor(currentProgress), messages[Math.min(messageIndex, messages.length - 1)]);
          }, 800);

          // Trigger sync in background
          setTimeout(async () => {
            console.log(`🔄 Triggering sync for ${service}...`);

            try {
              const syncResponse = await dashboardAPI.syncService(service);
              console.log('🔄 Sync response:', syncResponse);

              clearInterval(progressInterval);

              if (syncResponse.success) {
                const count = syncResponse.data?.synced_count || 0;
                completeSync(count);
                toast.success(`Successfully synced ${count} items from ${serviceName}!`);
              } else {
                failSync(syncResponse.error || 'Sync failed');
                toast.error(`Sync failed: ${syncResponse.error}`);
              }
            } catch (error) {
              clearInterval(progressInterval);
              console.error('❌ Error in sync:', error);
              failSync('An error occurred during sync');
              toast.error('An error occurred. Please try again.');
            }
          }, 100);
        } else {
          // No sync needed, just redirect and refresh
          sessionStorage.setItem('activeServiceTab', storedServiceId || service);
          sessionStorage.setItem('service_just_connected', 'true');

          setTimeout(() => {
            navigate('/media');
          }, 1500);
        }
      } else {
        console.error('❌ Token exchange failed:', tokenResponse.error);
        setStatus('error');
        setMessage(tokenResponse.error || 'Failed to connect');
        toast.error(`Connection failed: ${tokenResponse.error}`);

        setTimeout(() => {
          navigate('/media');
        }, 3000);
      }
    } catch (error) {
      console.error('❌ Error in OAuth callback:', error);
      setStatus('error');
      setMessage('An error occurred during connection');
      toast.error('An error occurred. Please try again.');

      setTimeout(() => {
        navigate('/media');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#6C60FF] to-[#8B7FFF]">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          {/* Spinner */}
          {status === 'processing' && (
            <div className="w-16 h-16 border-4 border-gray-200 border-t-[#6C60FF] rounded-full animate-spin mx-auto mb-6"></div>
          )}

          {/* Success Icon */}
          {status === 'success' && (
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {/* Error Icon */}
          {status === 'error' && (
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {status === 'processing' && 'Connecting...'}
            {status === 'success' && 'Connected!'}
            {status === 'error' && 'Connection Failed'}
          </h2>

          {/* Message */}
          <p className="text-gray-600 mb-4">{message}</p>

          {/* Service Info */}
          {service && (
            <div className="inline-flex items-center px-4 py-2 bg-gray-100 rounded-full">
              <span className="text-sm text-gray-700 capitalize">{service}</span>
            </div>
          )}

          {/* Auto-redirect notice */}
          <p className="text-xs text-gray-500 mt-6">
            {status === 'error' ? 'Redirecting in 3 seconds...' : 'Redirecting shortly...'}
          </p>
        </div>
      </div>
    </div>
  );
}
