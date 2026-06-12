// Separate Google Authentication API module
import { ApiResponse } from './authUtils';

// Get API base URL - same logic as authUtils.ts
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

export const googleAuthAPI = {
  // Get Google OAuth URL for login/signup
  getGoogleAuthUrl: async (intent: 'login' | 'signup' = 'login'): Promise<ApiResponse & { auth_url?: string }> => {
    console.log(`🔐 googleAuthAPI.getGoogleAuthUrl: Getting Google auth URL for ${intent}`);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google/url?intent=${intent}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error getting Google auth URL:', error);
      throw error;
    }
  },

  // Handle Google OAuth callback (login/signup)
  googleAuthCallback: async (code: string, state: string): Promise<ApiResponse & { user?: any; token?: string; has_memory?: number }> => {
    console.log('🔐 googleAuthAPI.googleAuthCallback: Handling Google OAuth callback');
    console.log('🔐 API_BASE_URL:', API_BASE_URL);
    console.log('🔐 Full URL:', `${API_BASE_URL}/auth/callback/google`);
    console.log('🔐 Request body:', JSON.stringify({ code, state }));
    console.log('🔐 Making POST request to backend...');

    try {
      const requestUrl = `${API_BASE_URL}/auth/callback/google`;
      console.log('🔐 Actual fetch URL:', requestUrl);

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ code, state }),
      });

      console.log('🔐 ✅ Fetch completed!');
      console.log('🔐 Response status:', response.status);
      console.log('🔐 Response ok:', response.ok);
      console.log('🔐 Response headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('🔐 Response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
        console.log('🔐 Response data (parsed):', data);
      } catch (parseError) {
        console.error('❌ Failed to parse response as JSON:', parseError);
        console.error('❌ Response was:', responseText);
        return {
          success: false,
          error: 'Invalid response from server: ' + responseText.substring(0, 100)
        };
      }

      return data;
    } catch (error) {
      console.error('❌ Error in Google auth callback:', error);
      console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  // Link Google account to existing user
  linkGoogleAccount: async (code: string): Promise<ApiResponse<{ message: string }>> => {
    console.log('🔗 googleAuthAPI.linkGoogleAccount: Linking Google account');
    try {
      const token = localStorage.getItem('stasht_token');
      const response = await fetch(`${API_BASE_URL}/auth/google/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error linking Google account:', error);
      throw error;
    }
  },

  // Unlink Google account from user
  unlinkGoogleAccount: async (): Promise<ApiResponse<{ message: string }>> => {
    console.log('🔗 googleAuthAPI.unlinkGoogleAccount: Unlinking Google account');
    try {
      const token = localStorage.getItem('stasht_token');
      const response = await fetch(`${API_BASE_URL}/auth/google/unlink`, {
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
      console.error('❌ Error unlinking Google account:', error);
      throw error;
    }
  },

  // Get Google Photos OAuth URL
  getGooglePhotosAuthUrl: async (): Promise<ApiResponse & { auth_url?: string }> => {
    console.log('📸 googleAuthAPI.getGooglePhotosAuthUrl: Getting Google Photos auth URL');
    console.log('📸 API_BASE_URL:', API_BASE_URL);

    try {
      const token = localStorage.getItem('stasht_token');
      const requestUrl = `${API_BASE_URL}/auth/google/photos/url`;

      console.log('📸 Request URL:', requestUrl);
      console.log('📸 Token exists:', !!token);
      console.log('📸 Token length:', token?.length || 0);
      console.log('📸 Making GET request to backend...');

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('📸 ✅ Fetch completed!');
      console.log('📸 Response status:', response.status);
      console.log('📸 Response ok:', response.ok);
      console.log('📸 Response headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('📸 Response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
        console.log('📸 Response data (parsed):', data);
      } catch (parseError) {
        console.error('❌ Failed to parse response as JSON:', parseError);
        console.error('❌ Response was:', responseText);
        return {
          success: false,
          error: 'Invalid response from server: ' + responseText.substring(0, 100)
        };
      }

      return data;
    } catch (error) {
      console.error('❌ Error getting Google Photos auth URL:', error);
      console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  // Handle Google Photos OAuth callback
  googlePhotosCallback: async (code: string): Promise<ApiResponse<{ message: string; service: any }>> => {
    console.log('📸 googleAuthAPI.googlePhotosCallback: Handling Google Photos callback');
    try {
      const token = localStorage.getItem('stasht_token');
      const response = await fetch(`${API_BASE_URL}/auth/google/photos/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error in Google Photos callback:', error);
      throw error;
    }
  },

  // NEW: Frontend-handled Google OAuth - Save user to database
  saveGoogleUser: async (googleData: {
    name: string;
    email: string;
    google_id: string;
    profile_picture?: string;
    access_token?: string;
    intent: 'login' | 'signup';
  }): Promise<ApiResponse & { user?: any; token?: string; has_memory?: number }> => {
    console.log('🔐 googleAuthAPI.saveGoogleUser: Saving Google user to database');
    console.log('🔐 API_BASE_URL:', API_BASE_URL);
    console.log('🔐 Request body:', JSON.stringify(googleData));
    console.log('🔐 Making POST request to backend...');

    try {
      const requestUrl = `${API_BASE_URL}/auth/google/save-user`;
      console.log('🔐 Actual fetch URL:', requestUrl);

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(googleData),
      });

      console.log('🔐 ✅ Fetch completed!');
      console.log('🔐 Response status:', response.status);
      console.log('🔐 Response ok:', response.ok);
      console.log('🔐 Response headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('🔐 Response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
        console.log('🔐 Response data (parsed):', data);
      } catch (parseError) {
        console.error('❌ Failed to parse response as JSON:', parseError);
        console.error('❌ Response was:', responseText);
        return {
          success: false,
          error: 'Invalid response from server: ' + responseText.substring(0, 100)
        };
      }

      return data;
    } catch (error) {
      console.error('❌ Error saving Google user:', error);
      console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  // Save Google Photos to database
  saveGooglePhotos: async (photos: Array<{
    google_photo_id: string;
    service_id: string;
    name: string;
    description?: string;
    mime_type: string;
    url: string;
    thumbnail_url?: string;
    size_bytes?: number;
    width?: number;
    height?: number;
    capture_time: string;
    last_edited_utc?: number;
  }>): Promise<ApiResponse & { data?: { saved_count: number; failed_count: number; photos: any[] } }> => {
    console.log('📸 googleAuthAPI.saveGooglePhotos: Saving Google Photos to database');
    console.log('📸 API_BASE_URL:', API_BASE_URL);
    console.log('📸 Photos count:', photos.length);

    try {
      const token = localStorage.getItem('stasht_token');
      const requestUrl = `${API_BASE_URL}/google-photos/save`;

      const requestBody = {
        photos: photos,
        source: 'google_photos',
        synced_at: new Date().toISOString()
      };

      console.log('📸 Request URL:', requestUrl);
      console.log('📸 Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📸 ✅ Fetch completed!');
      console.log('📸 Response status:', response.status);
      console.log('📸 Response ok:', response.ok);

      const responseText = await response.text();
      console.log('📸 Response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
        console.log('📸 Response data (parsed):', data);
      } catch (parseError) {
        console.error('❌ Failed to parse response as JSON:', parseError);
        console.error('❌ Response was:', responseText);
        return {
          success: false,
          error: 'Invalid response from server: ' + responseText.substring(0, 100)
        };
      }

      return data;
    } catch (error) {
      console.error('❌ Error saving Google Photos:', error);
      console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  // Google Photos Picker API - Create Session (via backend to avoid CORS)
  createPickerSession: async (accessToken: string): Promise<{ sessionId?: string; pickerUri?: string; error?: string; statusCode?: number }> => {
    console.log('📸 Creating Google Photos Picker session via backend...');

    try {
      const token = localStorage.getItem('stasht_token');

      const response = await fetch(`${API_BASE_URL}/google-photos/picker/create-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          google_access_token: accessToken
        }),
      });

      const data = await response.json();
      const statusCode = response.status;
      console.log('📸 Picker session response:', data, 'Status:', statusCode);

      if (data.success && data.data?.sessionId && data.data?.pickerUri) {
        return {
          sessionId: data.data.sessionId,
          pickerUri: data.data.pickerUri,
        };
      } else {
        return {
          error: data.error || 'Failed to create picker session',
          statusCode: statusCode
        };
      }
    } catch (error) {
      console.error('❌ Error creating picker session:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  // Google Photos Picker API - Get Session Status (via backend to avoid CORS)
  getPickerSessionStatus: async (sessionId: string, accessToken: string): Promise<{ mediaItemsSet?: boolean; pollingConfig?: any; error?: string; statusCode?: number }> => {
    try {
      const token = localStorage.getItem('stasht_token');

      const response = await fetch(`${API_BASE_URL}/google-photos/picker/session-status/${sessionId}?google_access_token=${encodeURIComponent(accessToken)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const statusCode = response.status;

      if (statusCode === 429) {
        return { error: 'rate_limited', statusCode: 429 };
      }

      const data = await response.json();

      if (data.success && data.data) {
        return {
          mediaItemsSet: data.data.mediaItemsSet || false,
          pollingConfig: data.data.pollingConfig,
        };
      } else {
        return {
          error: data.error || 'Failed to get session status',
          statusCode
        };
      }
    } catch (error) {
      console.error('❌ Error getting session status:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  // Google Photos Picker API - Get Selected Media Items (via backend to avoid CORS)
  getPickerMediaItems: async (sessionId: string, accessToken: string): Promise<{ mediaItems?: any[]; error?: string }> => {
    try {
      const token = localStorage.getItem('stasht_token');

      const response = await fetch(`${API_BASE_URL}/google-photos/picker/media-items/${sessionId}?google_access_token=${encodeURIComponent(accessToken)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      console.log('📸 Media items:', data);

      if (data.success && data.data?.mediaItems) {
        return {
          mediaItems: data.data.mediaItems,
        };
      } else {
        return {
          error: data.error || 'Failed to get media items'
        };
      }
    } catch (error) {
      console.error('❌ Error getting media items:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
};
