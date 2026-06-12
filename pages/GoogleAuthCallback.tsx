import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { googleAuthAPI } from '../utils/googleAuthAPI';
import SessionValidator from '../utils/sessionValidator';
import { toast } from 'sonner';
import { PopupBlockedGuideModal } from '../components/PopupBlockedGuideModal';

interface GoogleAuthCallbackProps {
  onLoginSuccess: (token: string, user: any) => void;
  onShowGooglePhotosModal?: () => void;
}

export default function GoogleAuthCallback({ onLoginSuccess, onShowGooglePhotosModal }: GoogleAuthCallbackProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Connecting with Google...');

  // Prevent duplicate API calls
  const hasProcessed = useRef(false);

  // Popup blocked guide modal state
  const [showPopupGuide, setShowPopupGuide] = useState(false);

  useEffect(() => {
    // Only run once
    if (!hasProcessed.current) {
      hasProcessed.current = true;
      handleGoogleAuthCallback();
    }
  }, []);

  const handleSignupWithPhotosToken = async (accessToken: string, scope: string) => {
    try {
      console.log('📸 Processing signup with Photos token...');
      setMessage('Getting your information from Google...');

      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to get user info from Google');
      }

      const googleUserInfo = await userInfoResponse.json();
      console.log('👤 Google user info:', googleUserInfo);

      // Send user data to backend to save
      const response = await googleAuthAPI.saveGoogleUser({
        name: googleUserInfo.name,
        email: googleUserInfo.email,
        google_id: googleUserInfo.sub,
        profile_picture: googleUserInfo.picture,
        access_token: accessToken,
        intent: 'signup',
      });

      console.log('📡 Backend save response:', response);

      if (response.success && response.user && response.token) {
        console.log('✅ User saved successfully!');

        // Store user data
        localStorage.setItem('stasht_user', JSON.stringify(response.user));
        localStorage.setItem('stasht_token', response.token);

        // Store Google access token for Photos Picker
        sessionStorage.setItem('google_access_token', accessToken);
        console.log('📸 Stored Google access token with Photos scope!');
        console.log('📸 Scope includes photoslibrary:', scope.includes('photoslibrary'));

        // Initialize session
        const userIdentifier = response.user.email || response.user.phone_number;
        if (response.user.id && userIdentifier) {
          SessionValidator.initSession(response.user.id, userIdentifier, response.token);
        }

        // Set flag to open picker
        sessionStorage.setItem('open_google_photos_picker_on_load', 'true');

        setStatus('success');
        setMessage('Signup successful! Redirecting...');
        toast.success('Successfully signed up! Opening Google Photos...');

        // Redirect to home (picker will open automatically)
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } else {
        console.error('❌ Backend save failed:', response.error);
        const errorMessage = response.message || response.error || 'Failed to sign up with Google';
        setStatus('error');
        setMessage(errorMessage);
        toast.error(errorMessage);
        setTimeout(() => {
          navigate('/signup');
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Error in signup with photos:', error);
      toast.error('Failed to complete signup. Please try again.');
      setTimeout(() => {
        navigate('/signup');
      }, 2000);
    }
  };

  const handleGoogleAuthCallback = async () => {
    console.log('🔐 Google Auth Callback starting...');

    // Check if this is an implicit flow response (token in URL hash)
    const hash = location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get('access_token');
    const hashState = hashParams.get('state');
    const tokenType = hashParams.get('token_type');
    const expiresIn = hashParams.get('expires_in');
    const scope = hashParams.get('scope');

    console.log('🔐 Callback state:', hashState);
    console.log('🔐 Has access token:', !!accessToken);

    // DON'T clear localStorage if this is Photos permission (user is already logged in!)
    const isPhotosFlow = hashState === 'photos_after_signup' || hashState === 'photos_from_media_sync';
    if (!isPhotosFlow) {
      console.log('🧹 Clearing old auth data...');
      localStorage.removeItem('stasht_token');
      localStorage.removeItem('stasht_user');
    } else {
      console.log('📸 Photos callback - keeping user logged in');
    }

    // Save the intent before clearing sessionStorage
    const savedIntent = sessionStorage.getItem('google_auth_intent') || 'login';

    // If we have an access token in the hash, this is an implicit flow response
    if (accessToken && hashState === 'signup_with_photos') {
      console.log('📸 Implicit flow callback with Photos scope detected!');
      console.log('📸 Access token received:', accessToken.substring(0, 20) + '...');
      console.log('📸 Scope granted:', scope);
      console.log('📸 Expires in:', expiresIn);

      // Handle signup with Photos scope
      await handleSignupWithPhotosToken(accessToken, scope || '');
      return;
    }

    // If this is Photos permission from Media page sync
    if (accessToken && hashState === 'photos_from_media_sync') {
      console.log('📸 Photos permission granted from media page sync!');
      console.log('📸 Access token received:', accessToken.substring(0, 20) + '...');
      console.log('📸 Full scope granted:', scope);

      // Verify the token has Photos Picker scope
      if (!scope || !scope.includes('photospicker')) {
        console.error('❌ Token does NOT have Photos Picker scope!');
        console.error('❌ Scope received:', scope);
        console.error('❌ Expected: https://www.googleapis.com/auth/photospicker.mediaitems.readonly');
        toast.error('Google Photos permission was not granted properly. Please try again.');
        setStatus('error');
        setMessage('Photos permission not granted');
        setTimeout(() => {
          navigate('/media');
        }, 3000);
        return;
      }

      console.log('✅ Token HAS Photos scope!');

      // Store the Photos token and set flag to open picker
      sessionStorage.setItem('google_access_token', accessToken);
      sessionStorage.setItem('google_photos_scope', scope);
      sessionStorage.setItem('open_google_photos_picker_on_media', 'true');

      console.log('📸 Stored token and flag for media page');
      console.log('📸 Redirecting to media page...');

      setStatus('success');
      setMessage('Google Photos connected! Opening picker...');
      toast.success('Google Photos connected! Opening picker...');

      // Hard redirect (not soft navigate) so App.tsx initializes fresh at /media.
      // This prevents the role-based initial redirect logic from overriding the destination.
      setTimeout(() => {
        window.location.href = '/media';
      }, 1000);
      return;
    }

    // If this is Photos permission AFTER signup
    if (accessToken && hashState === 'photos_after_signup') {
      console.log('📸 Photos permission granted after signup!');
      console.log('📸 Access token received:', accessToken.substring(0, 20) + '...');
      console.log('📸 Full scope granted:', scope);
      console.log('📸 Scope includes photospicker:', scope?.includes('photospicker'));
      console.log('📸 Scope includes photos:', scope?.includes('photos'));

      // CRITICAL CHECK: Verify the token has Photos Picker scope
      // Note: We use photospicker.mediaitems.readonly (not photoslibrary)
      if (!scope || !scope.includes('photospicker')) {
        console.error('❌ CRITICAL: Token does NOT have Photos Picker scope!');
        console.error('❌ Scope received:', scope);
        console.error('❌ Expected: https://www.googleapis.com/auth/photospicker.mediaitems.readonly');

        toast.error('Google Photos permission was not granted properly. Please try again.');

        setStatus('error');
        setMessage('Photos permission not granted');

        setTimeout(() => {
          navigate('/');
        }, 3000);
        return;
      }

      console.log('✅ Token HAS Photos scope!');

      // Check if user is still logged in
      const userToken = localStorage.getItem('stasht_token');
      const userData = localStorage.getItem('stasht_user');

      console.log('📸 User still logged in:', !!userToken && !!userData);

      if (!userToken || !userData) {
        console.error('❌ User not logged in! Redirecting to signup...');
        toast.error('Session expired. Please sign up again.');
        setTimeout(() => {
          navigate('/signup');
        }, 2000);
        return;
      }

      // User is already logged in, just store the Photos token and open picker
      sessionStorage.setItem('google_access_token', accessToken);
      sessionStorage.setItem('google_photos_scope', scope); // Store scope for debugging
      sessionStorage.setItem('open_google_photos_picker_on_load', 'true');

      console.log('📸 Stored token, scope, and flag');
      console.log('📸 Redirecting to home...');

      setStatus('success');
      setMessage('Google Photos connected! Opening picker...');
      toast.success('Google Photos connected! Opening picker...');

      // Redirect to home
      setTimeout(() => {
        console.log('📸 Redirecting to home page...');
        window.location.href = '/';
      }, 1500);
      return;
    }

    // Parse URL parameters for authorization code flow
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    console.log('🔐 Google Auth Callback received:', { code: !!code, state, error });

    // Handle OAuth error
    if (error) {
      console.error('❌ Google OAuth error:', error, errorDescription);
      setStatus('error');
      setMessage(errorDescription || error || 'Authorization failed');
      toast.error(`Google authorization failed: ${errorDescription || error}`);

      setTimeout(() => {
        navigate('/login');
      }, 3000);
      return;
    }

    // Check if we have the authorization code
    if (!code) {
      console.error('❌ No authorization code received from Google');
      setStatus('error');
      setMessage('No authorization code received');
      toast.error('Google authorization failed: No code received');

      setTimeout(() => {
        navigate('/login');
      }, 3000);
      return;
    }

    // Use the saved intent
    const intent = savedIntent;
    sessionStorage.removeItem('google_auth_intent');

    try {
      console.log(`🔑 Exchanging Google authorization code for token (intent: ${intent})...`);
      setMessage('Completing Google authentication...');

      // Call the backend callback API
      const response = await googleAuthAPI.googleAuthCallback(code, state || '');
      console.log('🔑 Google auth callback response:', response);
      console.log('🔑 Response success:', response.success);
      console.log('🔑 Response error:', response.error);
      console.log('🔑 Response message:', response.message);
      console.log('🔑 Response user:', response.user);
      console.log('🔑 Response token exists:', !!response.token);

      if (response.success) {
        console.log(`✅ Successfully authenticated with Google`);
        setStatus('success');
        setMessage(response.message || 'Successfully logged in!');

        // Extract user and token from response
        const { user, token, has_memory } = response;

        // Store authentication data
        if (token && user) {
          // Let App.tsx handle the login
          onLoginSuccess(token, user);

          toast.success(response.message || 'Successfully logged in with Google!');

          // Check if this is a new user (signup) and should show Google Photos modal
          const isNewUser = intent === 'signup' || has_memory === 0;
          const dontAskAgain = localStorage.getItem('google_photos_dont_ask') === 'true';

          if (isNewUser && !dontAskAgain && onShowGooglePhotosModal) {
            // Show Google Photos connection modal
            console.log('📸 New user - showing Google Photos connection modal');
            console.log('📸 Setting flag to show modal, NOT navigating automatically');
            // Set a flag to show the modal - modal will handle navigation after user chooses
            sessionStorage.setItem('show_google_photos_modal', 'true');
            // DON'T navigate automatically - let the modal handle it
          } else {
            // Not a new user or user already dismissed - navigate automatically
            console.log('📸 Not showing modal, navigating automatically');
            setTimeout(() => {
              navigate(has_memory > 0 ? '/stories' : '/');
            }, 1500);
          }
        } else {
          throw new Error('Invalid response: missing token or user data');
        }
      } else {
        console.error('❌ Google auth callback failed:', response.error);
        console.error('❌ Full error response:', JSON.stringify(response, null, 2));

        // Check if this is a backend session error
        if (response.error && response.error.toLowerCase().includes('session')) {
          console.error('🚨 BACKEND RETURNED SESSION ERROR - This is a backend issue, not frontend!');
          console.error('🚨 The backend /auth/google/callback endpoint should NOT check for existing sessions');
        }

        setStatus('error');
        setMessage(response.error || 'Authentication failed');
        toast.error(`Google authentication failed: ${response.error}`);

        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (error) {
      console.error('❌ Error in Google auth callback:', error);
      setStatus('error');
      setMessage('An error occurred during authentication');
      toast.error('An error occurred. Please try again.');

      setTimeout(() => {
        navigate('/login');
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

          {/* Google Icon */}
          <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-full shadow-lg mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {status === 'processing' && 'Connecting with Google...'}
            {status === 'success' && 'Welcome!'}
            {status === 'error' && 'Authentication Failed'}
          </h2>

          {/* Message */}
          <p className="text-gray-600 mb-4">{message}</p>

          {/* Auto-redirect notice */}
          <p className="text-xs text-gray-500 mt-6">
            {status === 'error' ? 'Redirecting to login...' : status === 'success' ? 'Redirecting...' : 'Please wait...'}
          </p>
        </div>
      </div>

      {/* Popup Blocked Guide Modal */}
      <PopupBlockedGuideModal
        isOpen={showPopupGuide}
        onClose={() => setShowPopupGuide(false)}
        onRetry={() => {
          setShowPopupGuide(false);
          // Retry logic would go here if needed
        }}
      />
    </div>
  );
}
