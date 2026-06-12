import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { appleAuthAPI, getAppleErrorMessage } from '../utils/appleAuthAPI';
import SessionValidator from '../utils/sessionValidator';
import { toast } from 'sonner';

interface AppleAuthCallbackProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export default function AppleAuthCallback({ onLoginSuccess }: AppleAuthCallbackProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Connecting with Apple...');

  // Prevent duplicate API calls
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Only run once
    if (!hasProcessed.current) {
      hasProcessed.current = true;
      handleAppleAuthCallback();
    }
  }, []);

  const handleAppleAuthCallback = async () => {
    console.log('🍎 Apple Auth Callback starting...');

    // Clear old auth data (new login)
    console.log('🧹 Clearing old auth data...');
    localStorage.removeItem('stasht_token');
    localStorage.removeItem('stasht_user');

    // Parse URL parameters - Backend redirects here with session_token
    const params = new URLSearchParams(location.search);
    const sessionToken = params.get('session_token');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    console.log('🍎 Apple Auth Callback received:');
    console.log('🍎 Full URL:', window.location.href);
    console.log('🍎 Session Token:', sessionToken ? 'present' : 'missing');
    console.log('🍎 Error:', error);
    console.log('🍎 Error Description:', errorDescription);

    // Handle OAuth error from backend
    if (error) {
      console.error('❌ Apple OAuth error:', error, errorDescription);
      const friendlyMessage = errorDescription || getAppleErrorMessage(error);
      setStatus('error');
      setMessage(friendlyMessage);
      toast.error(friendlyMessage);

      setTimeout(() => {
        navigate('/login');
      }, 3000);
      return;
    }

    // Check if we have session token from backend redirect
    if (!sessionToken) {
      console.error('❌ Missing session token from backend');
      setStatus('error');
      setMessage('Missing session token. Please try again.');
      toast.error('Apple authentication failed: Missing session data');

      setTimeout(() => {
        navigate('/login');
      }, 3000);
      return;
    }

    try {
      console.log('🍎 Fetching auth data from backend using session token...');
      setMessage('Completing Apple authentication...');

      // Fetch auth data from backend using session token
      const response = await appleAuthAPI.getAppleAuthSession(sessionToken);

      console.log('🍎 Backend response:', response);

      if (response.status === 1 && response.user && response.token) {
        console.log('✅ Successfully authenticated with Apple');
        setStatus('success');
        setMessage(response.message || 'Successfully logged in!');

        // Let App.tsx handle the login via callback
        onLoginSuccess(response.token, response.user);

        toast.success(response.message || 'Successfully logged in with Apple!');

        // Clear state from sessionStorage
        sessionStorage.removeItem('apple_auth_state');
        sessionStorage.removeItem('apple_auth_intent');

        // Navigate based on whether user has stories
        setTimeout(() => {
          navigate(response.has_memory > 0 ? '/stories' : '/');
        }, 1500);

      } else {
        throw new Error(response.message || response.error || 'Apple authentication failed');
      }

    } catch (error) {
      console.error('❌ Exception in Apple auth:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete Apple authentication';
      setStatus('error');
      setMessage(errorMessage);
      toast.error(errorMessage);

      setTimeout(() => {
        navigate('/login');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#6C60FF] to-[#8B7FFF]">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          {/* Loading Spinner */}
          {status === 'processing' && (
            <div className="w-16 h-16 border-4 border-gray-200 border-t-[#6C60FF] rounded-full animate-spin mx-auto mb-6"></div>
          )}

          {/* Success Checkmark */}
          {status === 'success' && (
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {/* Error X */}
          {status === 'error' && (
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}

          {/* Apple Icon */}
          <div className="inline-flex items-center justify-center w-12 h-12 bg-black rounded-full shadow-lg mb-4">
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
          </div>

          {/* Status Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {status === 'processing' && 'Connecting with Apple...'}
            {status === 'success' && 'Welcome!'}
            {status === 'error' && 'Authentication Failed'}
          </h2>

          {/* Status Message */}
          <p className="text-gray-600 mb-4">{message}</p>

          {/* Footer Text */}
          <p className="text-xs text-gray-500 mt-6">
            {status === 'error' ? 'Redirecting to login...' : status === 'success' ? 'Redirecting...' : 'Please wait...'}
          </p>
        </div>
      </div>
    </div>
  );
}
