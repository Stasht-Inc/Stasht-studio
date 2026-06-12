import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import GoogleAuthCallback from './GoogleAuthCallback';
import { GooglePhotosConnectModal } from '../components/GooglePhotosConnectModal';
import { googleAuthAPI } from '../utils/googleAuthAPI';
import { toast } from 'sonner';

export default function GoogleAuthCallbackWrapper() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showGooglePhotosModal, setShowGooglePhotosModal] = useState(false);

  const handleLoginSuccess = async (token: string, user: any) => {
    console.log('🔐 GoogleAuthCallbackWrapper: handleLoginSuccess called');
    console.log('🔐 User:', user);
    console.log('🔐 Token exists:', !!token);

    // Call the login function from AuthContext with OAuth parameters
    // Pass empty string for password, empty string for phone_number, then token and user
    await login(user.email || user.phone_number, '', undefined, token, user);

    console.log('🔐 Login completed');

    // Check if we should show the Google Photos modal
    const shouldShow = sessionStorage.getItem('show_google_photos_modal');
    console.log('📸 Should show Google Photos modal?', shouldShow);

    if (shouldShow === 'true') {
      console.log('📸 ✅ Showing Google Photos modal now!');
      sessionStorage.removeItem('show_google_photos_modal');

      // Wait a bit to ensure login state is fully updated
      setTimeout(() => {
        setShowGooglePhotosModal(true);
        console.log('📸 Modal state set to true');
      }, 500);
    } else {
      console.log('📸 ❌ Not showing modal, shouldShow =', shouldShow);
    }
  };

  const handleGooglePhotosConnect = async () => {
    try {
      console.log('📸 User clicked Connect Google Photos');
      console.log('📸 Calling getGooglePhotosAuthUrl API...');

      const response = await googleAuthAPI.getGooglePhotosAuthUrl();

      console.log('📸 Google Photos API response:', response);
      console.log('📸 Response success:', response.success);
      console.log('📸 Response auth_url:', response.auth_url);
      console.log('📸 Response error:', response.error);

      if (response.success && response.auth_url) {
        console.log('📸 ✅ Got auth URL, redirecting to Google Photos authorization...');
        // Store intent for after OAuth
        sessionStorage.setItem('oauth_service', 'google_photos');
        sessionStorage.setItem('oauth_return_action', 'sync');

        // Redirect to Google Photos authorization
        window.location.href = response.auth_url;
      } else {
        console.error('❌ Failed to get Google Photos auth URL:', response.error);
        toast.error(response.error || 'Failed to initiate Google Photos connection');
        setShowGooglePhotosModal(false);
        // Navigate to home after error
        navigate('/');
      }
    } catch (error) {
      console.error('❌ Error connecting Google Photos:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
      toast.error('An error occurred. Please try again.');
      setShowGooglePhotosModal(false);
      // Navigate to home after error
      navigate('/');
    }
  };

  const handleMaybeLater = () => {
    console.log('📸 User clicked Maybe Later');
    console.log('📸 Closing modal and navigating to home page');
    setShowGooglePhotosModal(false);
    // Navigate to home page
    setTimeout(() => {
      navigate('/');
    }, 300);
  };

  return (
    <>
      <GoogleAuthCallback
        onLoginSuccess={handleLoginSuccess}
        onShowGooglePhotosModal={() => setShowGooglePhotosModal(true)}
      />

      <GooglePhotosConnectModal
        isOpen={showGooglePhotosModal}
        onClose={() => setShowGooglePhotosModal(false)}
        onConnect={handleGooglePhotosConnect}
        onMaybeLater={handleMaybeLater}
      />
    </>
  );
}
