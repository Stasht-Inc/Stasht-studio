import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppleAuthCallback from './AppleAuthCallback';

export default function AppleAuthCallbackWrapper() {
  const { login } = useAuth();

  const handleLoginSuccess = async (token: string, user: any) => {
    console.log('🍎 AppleAuthCallbackWrapper: handleLoginSuccess called');
    console.log('🍎 User:', user);
    console.log('🍎 Token exists:', !!token);

    // Call the login function from AuthContext with OAuth parameters
    // Pass empty string for password, undefined for phone_number, then token and user
    await login(user.email || user.phone_number, '', undefined, token, user);

    console.log('🍎 Login completed');
  };

  return (
    <AppleAuthCallback onLoginSuccess={handleLoginSuccess} />
  );
}
