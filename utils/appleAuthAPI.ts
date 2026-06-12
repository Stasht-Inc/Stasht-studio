// Separate Apple Authentication API module
import { ApiResponse } from './authUtils';

// Get API base URL - same logic as googleAuthAPI.ts
const getApiBaseUrl = () => {
  // Use environment variable if set
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Development: use proxy
  if (import.meta.env.DEV) {
    console.log('🔍 Development mode: Using proxy for API requests');
    return '/api/react';
  }

  // Production fallback: assume same domain with /api prefix
  return `${window.location.origin}/api/react`;
};

const API_BASE_URL = getApiBaseUrl();

// Apple OAuth response types
export interface AppleAuthResponse {
  code: string;                    // Authorization code
  id_token: string;                // JWT identity token
  state: string;                   // CSRF protection
  user?: {                         // Only on first sign-in
    name?: {
      firstName: string;
      lastName: string;
    };
    email: string;
  };
}

export const appleAuthAPI = {
  // Get Apple OAuth URL for login/signup
  getAppleAuthUrl: async (intent: 'login' | 'signup' = 'login'): Promise<ApiResponse & { auth_url?: string }> => {
    console.log(`🍎 appleAuthAPI.getAppleAuthUrl: Getting Apple auth URL for ${intent}`);

    try {
      // Generate random state token for CSRF protection
      const state = crypto.randomUUID();
      sessionStorage.setItem('apple_auth_state', state);
      sessionStorage.setItem('apple_auth_intent', intent);
      console.log('🍎 Generated state token:', state);

      const response = await fetch(`${API_BASE_URL}/auth/apple/redirect?intent=${intent}&state=${state}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('🍎 Received auth URL response:', data);

      // Normalize backend response to match expected format
      // Backend returns: { status: 1, url: "...", message: "..." }
      // We expect: { success: true, auth_url: "..." }
      return {
        success: data.status === 1,
        auth_url: data.url,
        message: data.message,
        error: data.status !== 1 ? data.message : undefined
      };
    } catch (error) {
      console.error('❌ Error getting Apple auth URL:', error);
      throw error;
    }
  },

  // Handle Apple OAuth callback (login/signup)
  appleAuthCallback: async (authData: {
    code: string;
    id_token: string;
    state: string;
    user?: any;
  }): Promise<any> => {
    console.log('🍎 appleAuthAPI.appleAuthCallback: Handling Apple OAuth callback');
    console.log('🍎 API_BASE_URL:', API_BASE_URL);
    console.log('🍎 Full URL:', `${API_BASE_URL}/auth/apple/callback`);
    console.log('🍎 Request data:', {
      code: authData.code ? '✓ present' : '✗ missing',
      id_token: authData.id_token ? '✓ present' : '✗ missing',
      state: authData.state ? '✓ present' : '✗ missing',
      user: authData.user ? '✓ present' : '✗ not provided',
    });
    console.log('🍎 Making POST request to backend...');

    try {
      const requestUrl = `${API_BASE_URL}/auth/apple/callback`;
      console.log('🍎 Actual fetch URL:', requestUrl);

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          code: authData.code,
          id_token: authData.id_token,
          state: authData.state,
          user: authData.user,
        }),
      });

      console.log('🍎 ✅ Fetch completed!');
      console.log('🍎 Response status:', response.status);
      console.log('🍎 Response ok:', response.ok);

      const responseText = await response.text();
      console.log('🍎 Response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
        console.log('🍎 Response data (parsed):', data);
      } catch (parseError) {
        console.error('❌ Failed to parse response as JSON:', parseError);
        console.error('❌ Response was:', responseText);
        return {
          status: 0,
          error: 'Invalid response from server: ' + responseText.substring(0, 100)
        };
      }

      // Clear state from sessionStorage after successful validation
      if (data.status === 1) {
        sessionStorage.removeItem('apple_auth_state');
        sessionStorage.removeItem('apple_auth_intent');
      }

      return data;
    } catch (error) {
      console.error('❌ Error in Apple auth callback:', error);
      console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  // Link Apple account to existing user
  linkAppleAccount: async (authData: {
    code: string;
    id_token: string;
  }): Promise<ApiResponse<{ message: string }>> => {
    console.log('🔗 appleAuthAPI.linkAppleAccount: Linking Apple account');
    try {
      const token = localStorage.getItem('stasht_token');
      const response = await fetch(`${API_BASE_URL}/auth/apple/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: authData.code,
          id_token: authData.id_token,
        }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error linking Apple account:', error);
      throw error;
    }
  },

  // Unlink Apple account from user
  unlinkAppleAccount: async (): Promise<ApiResponse<{ message: string }>> => {
    console.log('🔗 appleAuthAPI.unlinkAppleAccount: Unlinking Apple account');
    try {
      const token = localStorage.getItem('stasht_token');
      const response = await fetch(`${API_BASE_URL}/auth/apple/unlink`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error unlinking Apple account:', error);
      throw error;
    }
  },

  // Get Apple auth data from session token
  getAppleAuthSession: async (sessionToken: string): Promise<any> => {
    console.log('🍎 appleAuthAPI.getAppleAuthSession: Fetching session data');
    console.log('🍎 Session token:', sessionToken.substring(0, 20) + '...');

    try {
      const requestUrl = `${API_BASE_URL}/auth/apple/session?session_token=${encodeURIComponent(sessionToken)}`;
      console.log('🍎 Request URL:', requestUrl);

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      console.log('🍎 Response status:', response.status);
      console.log('🍎 Response ok:', response.ok);

      const responseText = await response.text();
      console.log('🍎 Response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
        console.log('🍎 Response data (parsed):', data);
      } catch (parseError) {
        console.error('❌ Failed to parse response as JSON:', parseError);
        return {
          status: 0,
          error: 'Invalid response from server'
        };
      }

      return data;
    } catch (error) {
      console.error('❌ Error fetching Apple auth session:', error);
      throw error;
    }
  },
};

// Helper function to get user-friendly error messages for Apple OAuth errors
export function getAppleErrorMessage(errorCode: string): string {
  const APPLE_ERROR_MESSAGES: Record<string, string> = {
    'invalid_request': 'Invalid Apple Sign-In request. Please try again.',
    'invalid_client': 'Apple Sign-In is not properly configured. Please contact support.',
    'invalid_grant': 'Apple authorization code has expired. Please try again.',
    'unauthorized_client': 'This app is not authorized for Apple Sign-In.',
    'access_denied': 'You cancelled the Apple Sign-In process.',
    'user_cancelled_authorize': 'Apple Sign-In was cancelled.',
    'server_error': 'Apple\'s servers are experiencing issues. Please try again later.',
  };

  return APPLE_ERROR_MESSAGES[errorCode] || 'An error occurred with Apple Sign-In. Please try again.';
}
