// Auth utility functions for API integration

export interface LoginCredentials {
  email?: string;
  password: string;
  phone_number?: string;
}

export interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    role?: string;
    is_activated?: boolean;
  };
  token?: string;
  error?: string;
  message?: string;
  requiresActivation?: boolean;
  conflict?: boolean;
  currentUser?: any;
  // Device verification fields
  requires_verification?: boolean;
  attempt_id?: number;
  device_info?: DeviceInfo;
  // Collaborators for admin login choice
  collaborators?: Array<{
    owner_id: string;
    memory_id: string | null;
    role: string;
    user_id: string;
  }>;

  owned_properties?: Array<{
    id: number,
    name: string,
    location: string
   }>;

   shared_properties?: Array<{
    id: number,
    name: string,
    location: string
   }>;
  
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  phone_number?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  errors?: any;
  conflict?: boolean;
  currentUser?: any;
  // Collaborators for admin login choice (may be present at root level)
  collaborators?: Array<{
    owner_id: string;
    memory_id: string | null;
    role: string;
    user_id: string;
  }>;

  properties?: Array<{
    id: number,
    name: string,
    location: string

  }>;
}

// Device verification interfaces
export interface DeviceInfo {
  device_fingerprint?: string;
  browser?: string;
  os?: string;
  ip_address?: string;
  location?: string;
}

export interface VerifyDeviceOtpRequest {
  attempt_id: number;
  otp: string;
  device_name?: string;
}

export interface VerifyDeviceOtpResponse {
  success: boolean;
  user?: any;
  token?: string;
  error?: string;
  message?: string;
  // Collaborators for admin login choice
  collaborators?: Array<{
    owner_id: string;
    memory_id: string | null;
    role: string;
    user_id: string;
  }>;
}

export interface ResendDeviceOtpRequest {
  attempt_id: number;
}

export interface TrustedDevice {
  id: number;
  device_name: string;
  browser: string;
  os: string;
  location: string;
  ip_address: string;
  last_used_at: string;
  created_at: string;
}

// Base API configuration - Environment-aware API URL
export const getApiBaseUrl = () => {
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

// Helper function to get auth headers
export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('stasht_token');
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// Generic API request handler
export const apiRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  try {
    // Check if token is expired before making the request
    const token = tokenUtils.getToken();
    console.log(`🔍 API Request to ${endpoint}:`, {
      endpoint,
      tokenExists: !!token,
      tokenLength: token?.length || 0,
      fullURL: `${API_BASE_URL}${endpoint}`,
      headers: getAuthHeaders()
    });

    if (token && tokenUtils.isTokenExpired(token)) {
      console.log('Token expired, clearing auth data');
      userUtils.clearAuthData();
      return {
        success: false,
        error: 'Authentication token has expired. Please log in again.',
      };
    }

    // Add timestamp to prevent caching for GET requests
    let finalEndpoint = endpoint;
    if (options.method === 'GET' || !options.method) {
      const separator = endpoint.includes('?') ? '&' : '?';
      finalEndpoint = `${endpoint}${separator}_t=${Date.now()}`;
    }

    const response = await fetch(`${API_BASE_URL}${finalEndpoint}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
      credentials: 'same-origin', // Ensure cookies are sent with same-origin requests
    });

    let data;
    try {
      const responseText = await response.text();
      console.log(`🔍 API Response Text for ${endpoint}:`, responseText);
      console.log(`🔍 Response Status: ${response.status} ${response.statusText}`);
      console.log(`🔍 Response OK: ${response.ok}`);

      if (responseText.trim() === '') {
        console.log('🔍 Empty response received');
        // Handle specific HTTP error codes
        if (response.status === 500) {
          console.log('🔍 HTTP 500 with empty response - likely backend server unavailable');
          const isDevelopment = import.meta.env.DEV;
          const devMessage = isDevelopment
            ? ' (Development: Check if the Laravel backend server is running at localhost/stasht-for-multiple-admins/public)'
            : '';

          data = {
            success: false,
            error: `Backend server is currently unavailable. Please try again later or contact support.${devMessage}`
          };
        } else if (response.status >= 400 && response.status < 500) {
          console.log('🔍 HTTP 4xx with empty response - client error');
          data = {
            success: false,
            error: `Request failed (${response.status}). Please check your input and try again.`
          };
        } else if (response.ok) {
          console.log('🔍 Empty response with OK status - treating as successful empty response');
          data = { success: true };
        } else {
          console.log('🔍 Empty response with error status - treating as error');
          data = {
            success: false,
            error: `Server returned empty response with status ${response.status}`
          };
        }
      } else {
        try {
          data = JSON.parse(responseText);
        } catch (jsonError) {
          // If JSON parsing fails and response is OK, treat the text as the data itself
          // This handles cases where API returns plain text/URL instead of JSON
          if (response.ok) {
            console.log('🔍 Response is not JSON but status is OK, treating as plain text data');
            data = responseText; // Use the plain text as data
          } else {
            throw jsonError; // Re-throw if response is not OK
          }
        }
      }
    } catch (parseError) {
      console.error(`🔴 JSON Parse Error for ${endpoint}:`, parseError);
      console.error('🔴 Response was not valid JSON, treating as error');

      return {
        success: false,
        error: `Invalid response format from server (${response.status} ${response.statusText})`,
      };
    }

    // Check for authentication errors in response body
    if (!response.ok && data) {
      // Skip authentication error handling for OAuth callback endpoints
      const isOAuthCallback = endpoint.includes('/auth/google/callback') ||
                             endpoint.includes('/auth/facebook/callback') ||
                             endpoint.includes('/oauth/callback');

      // Skip redirect for public endpoints (accessible without login)
      const isPublicEndpoint = endpoint.includes('/published-memories');

      // Check for specific "Unauthenticated" error with "Authentication token is required"
      if (!isOAuthCallback && !isPublicEndpoint &&
          ((data.message === 'Unauthenticated' && data.error === 'Authentication token is required') ||
          (data.success === false && data.message === 'Unauthenticated'))) {
        console.log('🔒 Authentication error detected:', data);
        console.log('Automatically logging out user due to authentication failure');

        // Clear all auth data
        userUtils.clearAuthData();

        // Force page reload to clear all state and redirect to login
        setTimeout(() => {
          window.location.href = '/login'; // Redirect directly to login page
        }, 100);

        return {
          success: false,
          error: 'Your session has expired. Please log in again.',
          message: data.message
        };
      }
    }

    // Handle 401 Unauthorized responses
    if (response.status === 401) {
      console.log('Received 401 Unauthorized for endpoint:', endpoint);

      // Skip authentication error handling for OAuth callback endpoints
      const isOAuthCallback = endpoint.includes('/auth/google/callback') ||
                             endpoint.includes('/auth/facebook/callback') ||
                             endpoint.includes('/oauth/callback');

      // Don't trigger logout for optional endpoints, OAuth callbacks, or public endpoints
      const isOptionalEndpoint = endpoint.includes('/invites') ||
                                endpoint.includes('/memory-limit') ||
                                endpoint.includes('/check-memory-limit') ||
                                endpoint.includes('/published-memories') ||
                                isOAuthCallback;

      if (!isOptionalEndpoint) {
        console.log('Critical endpoint failed, clearing auth data and reloading');
        userUtils.clearAuthData();
        // Force page reload to clear all state and redirect to login
        setTimeout(() => {
          window.location.href = '/login'; // Redirect directly to login page
        }, 100);
      } else {
        console.log('Optional endpoint or OAuth callback failed, not triggering logout');
      }

      return {
        success: false,
        error: isOAuthCallback ? 'OAuth authentication failed' : 'Authentication failed. Please log in again.',
      };
    }

    if (!response.ok) {
      // Handle 409 Conflict specifically for login conflicts
      if (response.status === 409) {
        return {
          success: false,
          error: data.message || data.error || 'Conflict detected',
          message: data.message,
          conflict: true,
          currentUser: data.currentUser,
          ...data // Include all response data
        };
      }

      return {
        success: false,
        error: data.message || data.error || `HTTP ${response.status}`,
        message: data.message,
        errors: data.errors, // Preserve validation errors
        ...data // Include all response data
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('API Request Error:', error);

    // Handle different types of network errors
    let errorMessage = 'Network error';

    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Unable to connect to server. The backend service may be down or your internet connection may be unstable.';
      } else if (error.message.includes('NetworkError')) {
        errorMessage = 'Network error occurred. Please check your internet connection and try again.';
      } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ERR_CONNECTION_REFUSED')) {
        errorMessage = 'Backend server is not responding. Please contact support or try again later.';
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Unable to reach the server. Please check if the backend service is running.';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Authentication API functions
export const authAPI = {
  // Login user
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      console.log('authAPI.login: Sending request to /login with credentials:', {
        email: credentials.email,
        phone_number: credentials.phone_number
      });

      //Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Login request timed out after 10 seconds. Please check if the backend server is running.'));
        }, 40000); // 10 second timeoutmeans 
      });

      // Race between the API call and the timeout
      const apiPromise = apiRequest<any>('/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      const response = await Promise.race([apiPromise, timeoutPromise]);

      console.log('authAPI.login: Full API Response:', JSON.stringify(response, null, 2));

      // NEW DEVICE VERIFICATION: Check if OTP is required before any other checks
      // Check both top level and nested data structure
      const requiresVerification = response.requires_verification === true || response.data?.requires_verification === true;
      const attemptId = response.attempt_id || response.data?.attempt_id;

      if (requiresVerification && attemptId) {
        console.log('🔐 authAPI.login: Device verification required - OTP sent');
        return {
          success: false,
          requires_verification: true,
          attempt_id: attemptId,
          message: response.message || response.data?.message || 'Device verification required',
          device_info: response.device_info || response.data?.device_info || {}
        };
      }

      // PRIORITY FIX: Handle most common Laravel format first
      // Format: { success: true, data: { user: {...}, token: "...", collaborators: [...] } }
      if (response.success && response.data) {
        const data = response.data;

        // Check for user and token at any reasonable location
        const user = data.user || data.data?.user;
        const token = data.token || data.access_token || data.data?.token || data.data?.access_token;
        // Extract collaborators from response
        const collaborators = data.collaborators || data.data?.collaborators || response.collaborators || [];

        const ownedProperties = data.owned_properties || data.data?.owned_properties || [];

        const sharedProperties = data.shared_properties || data.data?.shared_properties || [];

        if (user && token) {
          console.log('✅ authAPI.login: Found user and token in response!');
          console.log('✅ authAPI.login: Collaborators found:', collaborators);
          console.log('✅ authAPI.login: User object:', user);
          console.log('✅ authAPI.login: User location:', user.location);

          // Attach is_internal from wherever it appears in the response
          if (!user.is_internal) {
            const isInternal = data.is_internal ?? data.data?.is_internal;
            if (isInternal) user.is_internal = isInternal;
          }

          const partialAdminAccess = data.partial_admin_access || data.data?.partial_admin_access || [];

          // Extract location from collaborators if not in user object
          if (!user.location && Array.isArray(collaborators) && collaborators.length > 0) {
            const collabWithLocation = collaborators.find((c: any) => c.location || c.owner?.location);
            if (collabWithLocation) {
              user.location = collabWithLocation.location || collabWithLocation.owner?.location;
            }
          }

          return {
            success: true,
            user: user,
            token: token,
            collaborators: collaborators,
            owned_properties: ownedProperties,
            shared_properties: sharedProperties,
            partial_admin_access: partialAdminAccess,
          };
        }
      }

      // Handle 409 Conflict (user already logged in)
      if (response.success === false && response.error && response.error.includes('Already logged in')) {
        console.log('authAPI.login: Conflict detected - user already logged in');
        return {
          success: false,
          error: response.error,
          conflict: true, // Add conflict flag for special handling
          currentUser: response.currentUser || null
        } as any;
      }

      // Check for activation error first before checking success cases
      const checkActivationError = (response: any) => {
        const activationMessage = 'activate your account';

        // Check in response.error field
        if (response.error && response.error.toLowerCase().includes(activationMessage)) {
          return response.error;
        }

        // Check in response.message field
        if (response.message && response.message.toLowerCase().includes(activationMessage)) {
          return response.message;
        }

        // Check in response.errors.email field (Laravel validation format)
        if (response.errors && response.errors.email &&
            Array.isArray(response.errors.email) && response.errors.email.length > 0 &&
            response.errors.email[0].toLowerCase().includes(activationMessage)) {
          return response.errors.email[0];
        }

        // Check in response.errors.account field (Laravel validation format)
        if (response.errors && response.errors.account &&
            Array.isArray(response.errors.account) && response.errors.account.length > 0 &&
            response.errors.account[0].toLowerCase().includes(activationMessage)) {
          return response.errors.account[0];
        }

        return null;
      };

      const activationError = checkActivationError(response);
      console.log('🔍 authAPI.login: Checking activation error...');
      console.log('🔍 authAPI.login: Full response structure:', JSON.stringify(response, null, 2));
      console.log('🔍 authAPI.login: activationError found:', activationError);
      console.log('🔍 authAPI.login: response.success:', response.success);

      // Check for activation error - handle cases where success is not explicitly false
      if (activationError) {
        console.log('🎯 authAPI.login: Account activation required -', activationError);
        return {
          success: false,
          error: activationError,
          requiresActivation: true,
          message: response.message,
          errors: response.errors
        };
      }

      // Handle your API's specific response structure (double nested)
      if (response.success && response.data && response.data.success && response.data.data) {
        const apiData = response.data.data;
        if (apiData.token && apiData.user) {
          console.log('authAPI.login: Found user and token in response.data.data');
          const collaborators = apiData.collaborators || response.data.collaborators || response.collaborators || [];
          console.log('authAPI.login: Collaborators found:', collaborators);
          return {
            success: true,
            user: apiData.user,
            token: apiData.token,
            collaborators: collaborators,
          };
        }
      }

      // Handle your API's response structure (single nested)
      if (response.success && response.data && response.data.token && response.data.user) {
        console.log('authAPI.login: Found user and token in response.data');
        const collaborators = response.data.collaborators || response.collaborators || [];
        console.log('authAPI.login: Collaborators found:', collaborators);
        return {
          success: true,
          user: response.data.user,
          token: response.data.token,
          collaborators: collaborators,
        };
      }

      // Handle direct response (not wrapped in data) - cast to any for legacy support
      const responseAny = response as any;
      if (responseAny.token && responseAny.user) {
        console.log('authAPI.login: Found user and token at root level');
        const collaborators = responseAny.collaborators || [];
        console.log('authAPI.login: Collaborators found:', collaborators);
        return {
          success: true,
          user: responseAny.user,
          token: responseAny.token,
          collaborators: collaborators,
        };
      }

      // Handle success flag with data (fallback)
      if (response.success && response.data) {
        console.log('authAPI.login: Using fallback - returning response.data');
        const dataToCheck = response.data.data || response.data;
        if (dataToCheck.token && dataToCheck.user) {
          const collaborators = dataToCheck.collaborators || response.data.collaborators || response.collaborators || [];
          console.log('authAPI.login: Collaborators found:', collaborators);
          return {
            success: true,
            user: dataToCheck.user,
            token: dataToCheck.token,
            collaborators: collaborators,
          };
        }
      }

      // Handle response with status - cast to any for legacy support
      if (responseAny.status === 'success' && responseAny.token) {
        const collaborators = responseAny.collaborators || [];
        console.log('authAPI.login: Collaborators found:', collaborators);
        return {
          success: true,
          user: responseAny.user || {
            id: '1',
            email: credentials.email,
            name: credentials.email.split('@')[0],
          },
          token: responseAny.token,
          collaborators: collaborators,
        };
      }

      // Last resort: If response looks successful but we couldn't parse it, log and return failure
      console.log('❌ authAPI.login: Could not parse login response!');
      console.log('❌ None of the expected response formats matched');
      console.log('❌ Response keys:', Object.keys(response));
      console.log('❌ Response.success:', response.success);
      console.log('❌ Response.data keys:', response.data ? Object.keys(response.data) : 'no data');

      // Emergency fallback: Try to find user and token anywhere in the response
      if (response.success) {
        console.log('⚠️ Attempting emergency fallback parsing...');
        console.log('⚠️ response.data full object:', JSON.stringify(response.data, null, 2));

        // Try to extract token and user from anywhere in the response
        let foundToken = null;
        let foundUser = null;

        // Search in response.data (any level)
        if (response.data) {
          if (typeof response.data === 'object') {
            // Check direct properties
            foundToken = response.data.token || response.data.access_token;
            foundUser = response.data.user;

            // Check if response.data has a nested structure
            if (!foundToken || !foundUser) {
              for (const key of Object.keys(response.data)) {
                const value = response.data[key];
                if (value && typeof value === 'object') {
                  if (!foundToken) foundToken = value.token || value.access_token;
                  if (!foundUser) foundUser = value.user;
                }
              }
            }
          }
        }

        console.log('⚠️ Emergency search results:');
        console.log('⚠️ - Found token:', !!foundToken);
        console.log('⚠️ - Found user:', !!foundUser);

        if (foundToken && foundUser) {
          console.log('✅ Emergency fallback succeeded! Found token and user');
          // Try to find collaborators in the response
          const collaborators = response.data?.collaborators || response.collaborators || [];
          console.log('authAPI.login: Collaborators found:', collaborators);
          return {
            success: true,
            user: foundUser,
            token: foundToken,
            collaborators: collaborators,
          };
        }
      }

      return {
        success: false,
        error: response.error || response.message || 'Login failed - could not parse response',
      };
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Network error or server unavailable';
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  // Register new user
  register: async (credentials: RegisterCredentials): Promise<LoginResponse> => {
    try {
      console.log('authAPI.register: Sending request to /signup with credentials:', { 
        name: credentials.name, 
        email: credentials.email 
      });
      
      const response = await apiRequest<any>('/signup', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      console.log('authAPI.register: Full API Response:', JSON.stringify(response, null, 2));

      // Handle your API's specific response structure (same as login)
      if (response.success && response.data && response.data.success && response.data.data) {
        const apiData = response.data.data;
        if (apiData.token && apiData.user) {
          console.log('authAPI.register: Found user and token in response.data.data');
          return {
            success: true,
            user: apiData.user,
            token: apiData.token,
          };
        }
      }

      // Handle your API's response structure (single nested)
      if (response.success && response.data && response.data.token && response.data.user) {
        console.log('authAPI.register: Found user and token in response.data');
        return {
          success: true,
          user: response.data.user,
          token: response.data.token,
        };
      }

      // Handle direct response (not wrapped in data) - cast to any for legacy support
      const responseAny = response as any;
      if (responseAny.token && responseAny.user) {
        console.log('authAPI.register: Found user and token at root level');
        return {
          success: true,
          user: responseAny.user,
          token: responseAny.token,
        };
      }

      // Handle activation flow (no token, just message)
      if (response.success && response.data && response.data.message) {
        console.log('authAPI.register: Activation flow detected - user needs to activate account');
        const userData = response.data.data?.user || response.data.user;
        // Extract collaborators from response
        const collaborators = response.data.collaborators || response.data.data?.collaborators || response.collaborators || [];
        console.log('authAPI.register: Collaborators found:', collaborators);
        return {
          success: true,
          message: response.data.message,
          user: userData,
          collaborators: collaborators,
          requiresActivation: true
        } as any;
      }

      // Handle case where response.success is true but no data - activation flow without detailed response
      if (response.success && !response.data) {
        console.log('authAPI.register: Success with no data - likely activation flow');
        return {
          success: true,
          message: 'Registration successful! Please check your email for activation instructions.',
          requiresActivation: true
        } as any;
      }

      // Handle success flag with data (fallback for direct login)
      if (response.success && response.data) {
        console.log('authAPI.register: Using fallback - returning response.data');
        const dataToCheck = response.data.data || response.data;
        if (dataToCheck.token && dataToCheck.user) {
          return {
            success: true,
            user: dataToCheck.user,
            token: dataToCheck.token,
          };
        }
      }

      // Handle validation errors
      if (response.message && response.errors) {
        console.log('authAPI.register: Validation errors detected:', response.errors);
        return {
          success: false,
          error: response.message,
          errors: response.errors
        } as any;
      }

      return {
        success: false,
        error: response.error || response.message || 'Registration failed',
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Network error or server unavailable',
      };
    }
  },

  // Verify token and get user info (TODO: Update route when API is available)
  verifyToken: async (): Promise<LoginResponse> => {
    // const response = await apiRequest<LoginResponse>('/verify-token', {
    //   method: 'GET',
    // });

    return {
      success: false,
      error: 'Token verification API not implemented yet',
    };
  },

  // Check if user is already authenticated in browser session
  checkAuth: async (): Promise<ApiResponse<{ isAuthenticated: boolean; user?: any }>> => {
    try {
      console.log('authAPI.checkAuth: Checking authentication status');
      const response = await apiRequest<{ isAuthenticated: boolean; user?: any }>('/auth/check', {
        method: 'GET',
      });

      console.log('authAPI.checkAuth: Server response:', response);
      return response;
    } catch (error) {
      console.error('authAPI.checkAuth: Error checking auth:', error);
      return {
        success: false,
        error: 'Failed to check authentication status',
      };
    }
  },

  // Logout user
  logout: async (): Promise<ApiResponse> => {
    try {
      console.log('authAPI.logout: Calling logout API endpoint');
      console.log('authAPI.logout: Request details:', {
        url: '/user/logout',
        method: 'POST',
        headers: getAuthHeaders(),
      });

      // Create a timeout promise that resolves after 3 seconds
      const timeoutPromise = new Promise<ApiResponse>((resolve) => {
        setTimeout(() => {
          console.log('authAPI.logout: Request timed out after 3 seconds, proceeding with local logout');
          resolve({
            success: true,
            message: 'Logged out locally (server timeout)',
          });
        }, 3000);
      });

      // Race between the API call and the timeout
      const apiPromise = apiRequest('/user/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await Promise.race([apiPromise, timeoutPromise]);

      console.log('authAPI.logout: Server response:', response);

      // Clear auth data regardless of server response
      userUtils.clearAuthData();

      return response;
    } catch (error) {
      console.error('authAPI.logout: Error during logout:', error);
      // Even if server logout fails, clear client data
      userUtils.clearAuthData();

      return {
        success: true,
        message: 'Logged out successfully',
      };
    }
  },

  // Reset password - Forgot password functionality
  resetPassword: async (email: string): Promise<ApiResponse> => {
    return await apiRequest('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Reset password by phone - Forgot password functionality for phone users
  resetPasswordByPhone: async (phone_number: string): Promise<ApiResponse> => {
    return await apiRequest('/forgot-password-phone', {
      method: 'POST',
      body: JSON.stringify({ phone_number }),
    });
  },

  // Change password
  changePassword: async (passwordData: {
    current_password: string;
    new_password: string;
    new_password_confirmation: string;
  }): Promise<ApiResponse> => {
    console.log('authAPI.changePassword: Sending PUT request to /user/change-password');
    console.log('Request data:', {
      current_password: '[HIDDEN]',
      new_password: '[HIDDEN]', 
      new_password_confirmation: '[HIDDEN]'
    });
    
    return await apiRequest('/user/change-password', {
      method: 'PUT',
      body: JSON.stringify(passwordData),
    });
  },

  // Activate user account
  activateAccount: async (token: string): Promise<any> => {
    try {
      console.log('🚀 authAPI.activateAccount: Starting activation process');
      console.log('🔑 Token:', token);
      console.log('🔑 Token length:', token.length);
      console.log('🌐 API Base URL:', API_BASE_URL);
      console.log('🌐 Full URL:', `${API_BASE_URL}/activate-account/${token}`);
      
      const response = await fetch(`${API_BASE_URL}/activate-account/${token}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      console.log('📡 HTTP Response Status:', response.status);
      console.log('📡 HTTP Response OK:', response.ok);
      console.log('📡 HTTP Response Status Text:', response.statusText);

      const data = await response.json();
      console.log('📦 authAPI.activateAccount: Full response received:', JSON.stringify(data, null, 2));
      
      if (data.success && data.data) {
        // Successful activation with user data and token
        console.log('authAPI.activateAccount: Activation successful');
        // Extract collaborators from response
        const collaborators = data.data.collaborators || data.collaborators || [];
        console.log('authAPI.activateAccount: Collaborators found:', collaborators);
        // Extract partial admin access — same field the login API returns
        const partialAdminAccess = data.data.partial_admin_access || data.partial_admin_access || [];
        console.log('authAPI.activateAccount: Partial admin access found:', partialAdminAccess);
        return {
          success: true,
          message: data.message,
          user: data.data.user,
          token: data.data.token,
          token_type: data.data.token_type,
          expires_at: data.data.expires_at,
          redirect_url: data.data.redirect_url,
          collaborators: collaborators,
          partial_admin_access: partialAdminAccess
        };
      } else if (data.success) {
        // Success without data (fallback)
        return {
          success: true,
          message: data.message || 'Account activated successfully'
        };
      } else {
        // Activation failed
        return {
          success: false,
          error: data.message || data.error || 'Account activation failed'
        };
      }
    } catch (error) {
      console.error('authAPI.activateAccount: Request failed:', error);
      return {
        success: false,
        error: 'Network error occurred'
      };
    }
  },

  // Verify phone OTP
  verifyPhoneOtp: async (phone_number: string, otp: string): Promise<LoginResponse> => {
    try {
      console.log('🚀🚀🚀 ===== authAPI.verifyPhoneOtp: STARTING OTP VERIFICATION =====');
      console.log('📞 Phone number:', phone_number);
      console.log('🔢 OTP:', otp);
      console.log('🌐 API URL:', `${API_BASE_URL}/verify-phone-otp`);
      console.log('📤 Request body:', JSON.stringify({ phone_number, otp }, null, 2));

      const response = await apiRequest<any>('/verify-phone-otp', {
        method: 'POST',
        body: JSON.stringify({ phone_number, otp }),
      });

      console.log('📡📡📡 ===== authAPI.verifyPhoneOtp: RAW API RESPONSE =====');
      console.log('🔍 Full Response Object:', JSON.stringify(response, null, 2));
      console.log('✅ response.success:', response.success);
      console.log('🗂️ response.data:', response.data);
      console.log('❌ response.error:', response.error);
      console.log('📄 response.message:', response.message);
      console.log('🔍 Response keys:', Object.keys(response));

      // Handle successful verification with token and user
      if (response.success && response.data) {
        console.log('✅ Response has success=true and data field');
        const data = response.data.data || response.data;
        console.log('📦 Extracted data:', JSON.stringify(data, null, 2));
        console.log('🔑 data.token:', data.token);
        console.log('👤 data.user:', data.user);

        if (data.token && data.user) {
          console.log('✅✅✅ OTP VERIFIED SUCCESSFULLY');
          console.log('👤 User ID:', data.user.id);
          console.log('👤 User Email:', data.user.email);
          console.log('👤 User Name:', data.user.name);
          console.log('👤 User Role:', data.user.role);
          console.log('🔑 Token length:', data.token.length);
          console.log('📤 Returning success response with user and token');

          return {
            success: true,
            user: data.user,
            token: data.token,
          };
        } else {
          console.log('❌ Missing token or user in data');
          console.log('  - data.token exists:', !!data.token);
          console.log('  - data.user exists:', !!data.user);
        }
      } else {
        console.log('❌ Response does not have success=true or missing data');
        console.log('  - response.success:', response.success);
        console.log('  - response.data exists:', !!response.data);
      }

      // Handle error response
      console.log('❌❌❌ OTP VERIFICATION FAILED');
      const errorMsg = response.error || response.message || 'OTP verification failed';
      console.log('📤 Returning error response:', errorMsg);

      return {
        success: false,
        error: errorMsg,
      };
    } catch (error) {
      console.error('❌❌❌ authAPI.verifyPhoneOtp: EXCEPTION OCCURRED');
      console.error('🔥 Error type:', typeof error);
      console.error('🔥 Error message:', error instanceof Error ? error.message : String(error));
      console.error('🔥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('🔥 Full error object:', error);

      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  },

  // Resend phone OTP
  resendPhoneOtp: async (phone_number: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      console.log('🚀🚀🚀 ===== authAPI.resendPhoneOtp: STARTING RESEND OTP =====');
      console.log('📞 Phone number:', phone_number);
      console.log('🌐 API URL:', `${API_BASE_URL}/resend-phone-otp`);
      console.log('📤 Request body:', JSON.stringify({ phone_number }, null, 2));

      const response = await apiRequest<any>('/resend-phone-otp', {
        method: 'POST',
        body: JSON.stringify({ phone_number }),
      });

      console.log('📡📡📡 ===== authAPI.resendPhoneOtp: RAW API RESPONSE =====');
      console.log('🔍 Full Response Object:', JSON.stringify(response, null, 2));
      console.log('✅ response.success:', response.success);
      console.log('📄 response.message:', response.message);
      console.log('❌ response.error:', response.error);

      if (response.success) {
        console.log('✅✅✅ OTP RESENT SUCCESSFULLY');
        return {
          success: true,
          message: response.message || 'OTP has been resent to your phone number',
        };
      }

      console.log('❌ RESEND OTP FAILED');
      return {
        success: false,
        error: response.error || response.message || 'Failed to resend OTP',
      };
    } catch (error) {
      console.error('❌❌❌ authAPI.resendPhoneOtp: EXCEPTION OCCURRED');
      console.error('🔥 Error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  },

  // Resend activation link
  resendActivationLink: async (email: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      console.log('🚀🚀🚀 ===== authAPI.resendActivationLink: STARTING RESEND ACTIVATION =====');
      console.log('📧 Email:', email);
      console.log('🌐 API URL:', `${API_BASE_URL}/resend-activation`);
      console.log('📤 Request body:', JSON.stringify({ email }, null, 2));

      const response = await apiRequest<any>('/resend-activation', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      console.log('📡📡📡 ===== authAPI.resendActivationLink: RAW API RESPONSE =====');
      console.log('🔍 Full Response Object:', JSON.stringify(response, null, 2));
      console.log('✅ response.success:', response.success);
      console.log('📄 response.message:', response.message);
      console.log('❌ response.error:', response.error);

      if (response.success) {
        console.log('✅✅✅ ACTIVATION LINK RESENT SUCCESSFULLY');
        return {
          success: true,
          message: response.message || 'Activation link has been resent to your email',
        };
      }

      console.log('❌ RESEND ACTIVATION LINK FAILED');
      return {
        success: false,
        error: response.error || response.message || 'Failed to resend activation link',
      };
    } catch (error) {
      console.error('❌❌❌ authAPI.resendActivationLink: EXCEPTION OCCURRED');
      console.error('🔥 Error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  },

  // Social login
  socialLogin: async (socialData: {
    provider: 'google' | 'apple' | 'facebook';
    provider_id: string;
    email?: string;
    name?: string;
    access_token?: string;
    device_token?: string;
    device_type?: string;
    app_version?: string;
  }): Promise<LoginResponse> => {
    try {
      console.log('authAPI.socialLogin: Sending request to /social/login with data:', {
        provider: socialData.provider,
        provider_id: socialData.provider_id,
        email: socialData.email,
        name: socialData.name,
        has_access_token: !!socialData.access_token
      });

      const response = await apiRequest<any>('/social/login', {
        method: 'POST',
        body: JSON.stringify(socialData),
      });

      console.log('authAPI.socialLogin: Full API Response:', JSON.stringify(response, null, 2));

      // Handle conflict (user already logged in)
      if (response.success === false && response.error && response.error.includes('Already logged in')) {
        console.log('authAPI.socialLogin: Conflict detected - user already logged in');
        return {
          success: false,
          error: response.error,
          conflict: true,
          currentUser: response.currentUser || null
        } as any;
      }

      if (!response.success) {
        console.log('authAPI.socialLogin: Social login failed:', response.error || response.message);
        return {
          success: false,
          error: response.error || response.message || 'Social login failed',
        };
      }

      // Extract user data and token from successful response
      const userData = response.data?.user || response.data;
      const token = response.data?.token || response.token;

      console.log('authAPI.socialLogin: Login successful');
      console.log('authAPI.socialLogin: User data:', userData);
      console.log('authAPI.socialLogin: Token present:', !!token);

      return {
        success: true,
        user: {
          id: userData.id?.toString(),
          email: userData.email,
          name: userData.name,
          avatar: userData.avatar || userData.profile_image,
          role: userData.role,
          is_activated: userData.is_activated ?? true,
        },
        token,
      };
    } catch (error) {
      console.error('authAPI.socialLogin: Error during social login:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Social login failed. Please try again.',
      };
    }
  },

  // Verify device OTP
  verifyDeviceOtp: async (data: VerifyDeviceOtpRequest): Promise<VerifyDeviceOtpResponse> => {
    try {
      console.log('authAPI.verifyDeviceOtp: Verifying OTP for attempt:', data.attempt_id);

      const response = await apiRequest<any>('/verify-device-otp', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      console.log('authAPI.verifyDeviceOtp: Response:', response);

      if (response.success && response.data) {
        const user = response.data.user || response.data.data?.user;
        const token = response.data.token || response.data.access_token || response.data.data?.token;
        // Extract collaborators from response
        const collaborators = response.data.collaborators || response.data.data?.collaborators || response.collaborators || [];

        if (user && token) {
          console.log('authAPI.verifyDeviceOtp: Collaborators found:', collaborators);
          return {
            success: true,
            user,
            token,
            message: response.message || 'Device verified successfully',
            collaborators: collaborators,
            data: response.data,
            owned_properties: response.data?.owned_properties || response.data?.data?.owned_properties || [],
            shared_properties: response.data?.shared_properties || response.data?.data?.shared_properties || [],
            partial_admin_access: response.data?.partial_admin_access || response.data?.data?.partial_admin_access || [],
          };
        }
      }

      return {
        success: false,
        error: response.error || response.message || 'Failed to verify OTP'
      };
    } catch (error) {
      console.error('authAPI.verifyDeviceOtp: Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify OTP'
      };
    }
  },

  // Resend device OTP
  resendDeviceOtp: async (data: ResendDeviceOtpRequest): Promise<ApiResponse> => {
    try {
      console.log('authAPI.resendDeviceOtp: Resending OTP for attempt:', data.attempt_id);

      const response = await apiRequest<any>('/resend-device-otp', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      console.log('authAPI.resendDeviceOtp: Response:', response);

      return {
        success: response.success || false,
        message: response.message || (response.success ? 'OTP resent successfully' : 'Failed to resend OTP'),
        error: response.error
      };
    } catch (error) {
      console.error('authAPI.resendDeviceOtp: Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resend OTP'
      };
    }
  },

  // Get trusted devices
  getTrustedDevices: async (): Promise<ApiResponse<TrustedDevice[]>> => {
    try {
      console.log('authAPI.getTrustedDevices: Fetching trusted devices');

      const response = await apiRequest<any>('/user/trusted-devices', {
        method: 'GET',
      });

      console.log('authAPI.getTrustedDevices: Response:', response);

      if (response.success && response.data) {
        const devices = response.data.devices || response.data.data?.devices || response.data;
        return {
          success: true,
          data: Array.isArray(devices) ? devices : []
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to fetch trusted devices',
        data: []
      };
    } catch (error) {
      console.error('authAPI.getTrustedDevices: Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch trusted devices',
        data: []
      };
    }
  },

  // Delete user account
  deleteAccount: async (credentials: { password: string; confirmation: string }): Promise<ApiResponse<any>> => {
    try {
      console.log('authAPI.deleteAccount: Sending request to /user/account');

      const response = await apiRequest<any>('/user/account', {
        method: 'DELETE',
        body: JSON.stringify(credentials),
      });

      console.log('authAPI.deleteAccount: Response:', response);
      return response;
    } catch (error) {
      console.error('authAPI.deleteAccount: Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete account',
      };
    }
  },
};

// Token management utilities
export const tokenUtils = {
  // Get stored token
  getToken: (): string | null => {
    return localStorage.getItem('stasht_token');
  },

  // Store token
  setToken: (token: string): void => {
    localStorage.setItem('stasht_token', token);
  },

  // Remove token
  removeToken: (): void => {
    localStorage.removeItem('stasht_token');
  },

  // Check if token exists
  hasToken: (): boolean => {
    return !!localStorage.getItem('stasht_token');
  },

  // Check if token is expired (basic check)
  isTokenExpired: (token?: string): boolean => {
    const tokenToCheck = token || tokenUtils.getToken();

    console.log('🔑🔑🔑 ===== tokenUtils.isTokenExpired STARTED =====');
    console.log('🔑 Token to check (first 30 chars):', tokenToCheck?.substring(0, 30));
    console.log('🔑 Token length:', tokenToCheck?.length);

    if (!tokenToCheck) {
      console.log('❌ No token found - considering expired');
      return true;
    }

    try {
      // Basic JWT token expiry check (decode payload)
      const parts = tokenToCheck.split('.');
      console.log('🔑 Token parts count:', parts.length);

      if (parts.length !== 3) {
        console.log('❌❌❌ CRITICAL: Token is NOT a valid JWT format (expected 3 parts, got ' + parts.length + ')');
        console.log('🔑 This might be a session token, not a JWT - treating as non-expiring');
        console.log('🔑 If backend uses session tokens instead of JWT, we should NOT consider them expired');

        // IMPORTANT FIX: If token is not JWT format, assume it's a session token that doesn't expire
        // The backend will reject it if it's invalid
        console.log('✅ Treating non-JWT token as VALID (not expired)');
        return false; // Changed from true to false!
      }

      const payload = JSON.parse(atob(parts[1]));
      console.log('🔑 Decoded JWT payload:', { exp: payload.exp, iat: payload.iat });

      const currentTime = Date.now() / 1000;
      console.log('🔑 Current time (seconds):', currentTime);
      console.log('🔑 Token expiry (seconds):', payload.exp);
      console.log('🔑 Time until expiry (seconds):', payload.exp - currentTime);
      console.log('🔑 Time until expiry (minutes):', ((payload.exp - currentTime) / 60).toFixed(2));

      // Add a buffer of 60 seconds to account for clock skew
      const isExpired = payload.exp < (currentTime + 60);

      if (isExpired) {
        console.log('❌ Token expired or about to expire (within 60 seconds)');
      } else {
        console.log('✅ Token is valid and not expired');
      }

      console.log('🔑🔑🔑 ===== tokenUtils.isTokenExpired RESULT:', isExpired, '=====');
      return isExpired;
    } catch (error) {
      console.error('❌ Error checking token expiry:', error);
      console.error('🔥 Error details:', error);
      // IMPORTANT: If token can't be decoded as JWT, it might be a session token
      // Don't assume it's expired - let the backend validate it
      console.log('⚠️ Treating unparseable token as VALID (backend will validate)');
      return false; // Changed from true to false!
    }
  },
};

// User data management utilities
export const userUtils = {
  // Get stored user data
  getStoredUser: () => {
    try {
      const userData = localStorage.getItem('stasht_user');
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  },

  // Store user data
  setStoredUser: (user: any): void => {
    localStorage.setItem('stasht_user', JSON.stringify(user));
  },

  // Remove stored user data
  removeStoredUser: (): void => {
    localStorage.removeItem('stasht_user');
  },

  // Clear all auth data
  clearAuthData: (): void => {
    console.log('🧹🧹🧹 ===== userUtils.clearAuthData STARTED =====');

    // Clear all localStorage items related to the app
    const localStorageKeysToRemove = [
      'stasht_user',
      'stasht_token',
      'stasht_theme',
      'account_creation_timestamp',
      'stasht_session_change',
      'is_partial_admin',
      'partial_admin_email',
    ];

    console.log('🧹 Clearing localStorage keys:', localStorageKeysToRemove);
    localStorageKeysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    // Clear specific sessionStorage keys (not all to preserve SessionValidator data)
    const sessionStorageKeysToRemove = [
      'temp_current_password',
      'require_password_change',
      'stasht_theme',
      // Add other app-specific sessionStorage keys here
    ];

    console.log('🧹 Clearing sessionStorage keys:', sessionStorageKeysToRemove);
    sessionStorageKeysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
    });

    // DON'T call sessionStorage.clear() as it would remove SessionValidator data
    // The SessionValidator will manage its own cleanup via SessionValidator.clearSession()
    console.log('🧹 Preserved SessionValidator sessionStorage data');

    // Clear any cached data
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }

    console.log('🧹🧹🧹 ===== userUtils.clearAuthData COMPLETED =====');
  },
};

// Validation utilities
export const validationUtils = {
  // Validate email format
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email) && !email.includes('..');
  },

  // Validate password strength
  isValidPassword: (password: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  // Validate form data
  validateLoginForm: (email: string, password: string): { isValid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};

    if (!email) {
      errors.email = 'Email is required';
    } else if (!validationUtils.isValidEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  },
};

// Partial admin helpers
export const isPartialAdmin = (): boolean => {
  return localStorage.getItem('is_partial_admin') === 'true';
};

export const getPartialAdminEmail = (): string => {
  return localStorage.getItem('partial_admin_email') || '';
};

export const clearPartialAdminFlags = () => {
  localStorage.removeItem('is_partial_admin');
  localStorage.removeItem('partial_admin_email');
};

// Dashboard API functions
export const dashboardAPI = {
  // Main dashboard overview data
  getDashboard: async (type = 'weekly'): Promise<ApiResponse<any>> => {
    return await apiRequest(`/dashboard?type=${type}`, {
      method: 'GET',
    });
  },

  // User engagement data
  getUserEngagement: async (type = 'weekly', offset = 0): Promise<ApiResponse<any>> => {
    return await apiRequest(`/dashboard/user-engagement?type=${type}&offset=${offset}`, {
      method: 'GET',
    });
  },

  // Activity metrics data
  getActivityMetrics: async (type = 'weekly'): Promise<ApiResponse<any>> => {
    return await apiRequest(`/dashboard/activity-metrics?type=${type}`, {
      method: 'GET',
    });
  },

  // Published memories data
  getPublishedMemories: async (type = 'weekly'): Promise<ApiResponse<any>> => {
    return await apiRequest(`/dashboard/published-memories?type=${type}`, {
      method: 'GET',
    });
  },

  // Recent activity data
  getRecentActivity: async (type = 'weekly'): Promise<ApiResponse<any>> => {
    return await apiRequest(`/dashboard/recent-activity?type=${type}`, {
      method: 'GET',
    });
  },

  // Memories data - fetch memories with reasonable pagination
  getMemories: async (): Promise<ApiResponse<any>> => {
    console.log('🚨 DEBUG: Calling /memories API with per_page=50');
    const response = await apiRequest('/memories?per_page=50&page=1', {
      method: 'GET',
    });
    console.log('🚨 DEBUG: /memories API raw response:', response);
    return response;
  },

  // Get user categories for memory creation
  getUserCategories: async (): Promise<ApiResponse<any>> => {
    console.log('🚨 DEBUG: Calling /memory-images/categories API');
    const response = await apiRequest('/memory-images/categories', {
      method: 'GET',
    });
    console.log('🚨 DEBUG: /memory-images/categories API raw response:', response);
    return response;
  },
  
  // Get existing memories for Add to Memory dialog
  getExistingMemories: async (): Promise<ApiResponse<any>> => {
    console.log('📌📌📌 Calling /existing-memories API endpoint...');
    try {
      const response = await apiRequest('/existing-memories', {
        method: 'GET',
      });
      console.log('📌📌📌 /existing-memories API RAW response:', response);
      console.log('📌📌📌 Response type:', typeof response);
      console.log('📌📌📌 Response keys:', response ? Object.keys(response) : 'null');
      return response;
    } catch (error) {
      console.error('❌❌❌ Error calling /existing-memories:', error);
      throw error;
    }
  },

  // Get transferable memories for property transfer
  getTransferableMemories: async (): Promise<ApiResponse<any>> => {
    console.log('🔄 DEBUG: Calling /memories/transferable API');
    try {
      const response = await apiRequest('/memories/transferable', {
        method: 'GET',
      });
      console.log('🔄 DEBUG: /memories/transferable API raw response:', response);
      console.log('🔄 DEBUG: Response data structure:', response?.data);
      console.log('🔄 DEBUG: Sample memory:', response?.data?.data?.[0] || response?.data?.[0]);
      return response;
    } catch (error) {
      console.error('❌ Error calling /memories/transferable:', error);
      throw error;
    }
  },

  // Transfer memories to property
  transferMemoriesToProperty: async (memoryIds: number[], propertyId: number): Promise<ApiResponse<any>> => {
    console.log('🔄 DEBUG: Calling /memories/transfer-to-property API');
    console.log('🔄 Memory IDs:', memoryIds);
    console.log('🔄 Property ID:', propertyId);
    try {
      const response = await apiRequest('/memories/transfer-to-property', {
        method: 'POST',
        body: JSON.stringify({
          memory_ids: memoryIds,
          property_id: propertyId
        }),
      });
      console.log('🔄 DEBUG: /memories/transfer-to-property API response:', response);
      return response;
    } catch (error) {
      console.error('❌ Error calling /memories/transfer-to-property:', error);
      throw error;
    }
  },

  // Categories and Labels for Create Memory
  getCategoriesLabels: async (): Promise<ApiResponse<any>> => {
    return await apiRequest('/memories/categories-labels', {
      method: 'GET',
    });
  },

  // Get user storage overview
  getStorageOverview: async (): Promise<ApiResponse<any>> => {
    console.log('🏠 DEBUG: Calling /user/storage-overview API');
    const response = await apiRequest('/user/storage-overview', {
      method: 'GET',
    });
    console.log('🏠 DEBUG: /user/storage-overview API raw response:', response);
    return response;
  },

  // Update e-business card visibility
  updateIsBusinessCard: async (isBusiness: boolean): Promise<ApiResponse<any>> => {
    return await apiRequest('/user/is-business', {
      method: 'PUT',
      body: JSON.stringify({ is_business: isBusiness ? 1 : 0 }),
    });
  },

  // Update user profile
  updateProfile: async (profileData: FormData): Promise<ApiResponse<any>> => {
    console.log('📝 DEBUG: Calling /user/update-profile API');
    
    // Debug: Log FormData contents
    console.log('📝 DEBUG: FormData contents being sent:');
    for (let [key, value] of profileData.entries()) {
      console.log(`📝 ${key}:`, value instanceof File ? `File: ${value.name} (${value.size} bytes)` : value);
    }
    
    // For FormData uploads, we need to handle headers specially
    const token = localStorage.getItem('stasht_token');
    console.log('📝 DEBUG: Token exists:', !!token);
    
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Don't set Content-Type for FormData - let browser set it with boundary
    
    console.log('📝 DEBUG: Request headers:', headers);
    console.log('📝 DEBUG: API URL:', `${API_BASE_URL}/user/update-profile`);
    
    // Check if FormData is actually populated
    const hasEntries = Array.from(profileData.entries()).length > 0;
    console.log('📝 DEBUG: FormData has entries:', hasEntries);
    
    if (!hasEntries) {
      console.error('📝 ERROR: FormData is empty, aborting request');
      return {
        success: false,
        error: 'No data to send'
      };
    }
    
    try {
      // Many Laravel APIs expect POST with _method override for file uploads
      // Try POST instead of PUT for FormData uploads
      console.log('📝 DEBUG: Sending POST request with FormData...');
      const response = await fetch(`${API_BASE_URL}/user/update-profile`, {
        method: 'POST',
        headers,
        body: profileData,
      });

      console.log('📝 DEBUG: Response status:', response.status);
      console.log('📝 DEBUG: Response headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();
      console.log('📝 DEBUG: Response data:', data);

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}`,
          data: data
        };
      }

      console.log('📝 DEBUG: /user/update-profile API successful response:', data);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('📝 ERROR: /user/update-profile API error:', error);
      return {
        success: false,
        error: 'Network error occurred'
      };
    }
  },

  // Get single memory details by ID
  getMemoryDetails: async (memoryId: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.getMemoryDetails: Fetching details for memory ID ${memoryId}`);
    return await apiRequest(`/memories/${memoryId}?per_page=500`, {
      method: 'GET',
    });
  },

  // Update memory by ID
  updateMemory: async (memoryId: string, memoryData: any): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.updateMemory: Updating memory ID ${memoryId}`);
    console.log('Update Data:', JSON.stringify(memoryData, null, 2));
    
    return await apiRequest(`/memories/${memoryId}`, {
      method: 'PUT',
      body: JSON.stringify(memoryData),
    });
  },

  // Publish memory by ID
  publishMemory: async (memoryId: string, role?: number): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.publishMemory: Publishing memory ID ${memoryId} with role ${role}`);
    console.log(`API URL: /memories/${memoryId}/publish`);

    return await apiRequest(`/memories/${memoryId}/publish`, {
      method: 'POST',
      body: role !== undefined ? JSON.stringify({ role }) : undefined,
    });
  },

  // Publish memories as author (new endpoint)
  publishMemoryAsAuthor: async (memoryIds: number[], visibility: string, wallpaperImage?: string | null): Promise<ApiResponse<any>> => {
    const body: any = {
      memory_ids: memoryIds,
      visibility: visibility === 'view-only' ? 'view_only' : visibility,
    };
    if (wallpaperImage) {
      body.wallpaper_image = wallpaperImage;
    }
    return await apiRequest('/memories/publish', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Unpublish memory by ID
  unpublishMemory: async (memoryId: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.unpublishMemory: Unpublishing memory ID ${memoryId}`);
    console.log(`API URL: /memory-unpublished`);

    return await apiRequest('/memory-unpublished', {
      method: 'POST',
      body: JSON.stringify({ memory_id: memoryId }),
    });
  },

  // Get published memory by slug (public endpoint - no auth required)
  getPublishedMemory: async (slug: string, accessToken?: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.getPublishedMemory: Fetching published memory with slug: ${slug}`);

    // Build URL with optional access_token parameter
    const url = accessToken
      ? `/published-memories?token=${slug}&access_token=${encodeURIComponent(accessToken)}`
      : `/published-memories?token=${slug}`;

    console.log(`API URL: ${url}`);

    return await apiRequest(url, {
      method: 'GET',
    });
  },

  // Create new category
  createCategory: async (name: string, propertyId?: number): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.createCategory: Creating category with name "${name}"${propertyId ? `, property_id: ${propertyId}` : ''}`);
    console.log(`API URL: /create-category`);

    const body: Record<string, any> = { name };
    if (propertyId) body.property_id = propertyId;

    return await apiRequest('/create-category', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Create new label
  createLabel: async (name: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.createLabel: Creating label with name "${name}"`);
    console.log(`API URL: /create-label`);
    
    return await apiRequest('/create-label', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  // Edit category by ID
  editCategory: async (categoryId: string, name: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.editCategory: Editing category with ID "${categoryId}" to name "${name}"`);
    console.log(`API URL: /edit-category/${categoryId}`);
    
    return await apiRequest(`/edit-category/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  },

  // Delete category by ID
  deleteCategory: async (categoryId: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.deleteCategory: Deleting category with ID "${categoryId}"`);
    console.log(`API URL: /delete-category/${categoryId}`);
    
    return await apiRequest(`/delete-category/${categoryId}`, {
      method: 'GET',
    });
  },

  // Delete label (sub-category) by ID
  deleteLabel: async (subCategoryId: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.deleteLabel: Deleting label with ID "${subCategoryId}"`);
    console.log(`API URL: /delete-sub-category/${subCategoryId}`);
    
    return await apiRequest(`/delete-sub-category/${subCategoryId}`, {
      method: 'GET',
    });
  },

  // Edit label by ID
  editLabel: async (labelId: string, name: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.editLabel: Editing label with ID "${labelId}" to name "${name}"`);
    console.log(`API URL: /edit-label/${labelId}`);

    return await apiRequest(`/edit-label/${labelId}`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  // Bulk update tags for multiple media items
  bulkUpdateTags: async (mediaIds: (string | number)[], tags: string[]): Promise<ApiResponse<any>> => {
    return await apiRequest('/memory-images/bulk-update-tags', {
      method: 'POST',
      body: JSON.stringify({ media_ids: mediaIds.map(Number), tags }),
    });
  },

  addPartialAdmin: async (emails: string[], memoryIds: (string | number)[], phoneNumbers?: string[]): Promise<ApiResponse<any>> => {
    const body: any = { emails, memory_ids: memoryIds.map(Number) };
    if (phoneNumbers && phoneNumbers.length > 0) {
      body.phone_numbers = phoneNumbers;
    }
    return await apiRequest('/memories/add-partial-admin', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Update memory images with multipart form data
  updateMemoryImages: async (postId: string, updateData: {
    image?: File;
    name?: string;
    title?: string;
    description?: string;
    capture_date?: string;
    location?: string;
    tags?: string[];
    parent_image_id?: string | null;
  }): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.updateMemoryImages: Updating post ID "${postId}"`);
    console.log(`API URL: /memory-images/${postId}`);
    console.log('Update Data:', updateData);
    
    // Create FormData for multipart request
    const formData = new FormData();
    
    // Add Laravel method override for PUT request with FormData
    formData.append('_method', 'PUT');
    
    // Add image file if provided
    if (updateData.image) {
      formData.append('image', updateData.image);
      console.log('Added image to FormData:', updateData.image.name, updateData.image.size);
    }
    
    // Add other fields if provided
    if (updateData.name !== undefined) {
      formData.append('name', updateData.name || '');
      console.log('Added name to FormData:', updateData.name);
    }

    if (updateData.title !== undefined) {
      formData.append('title', updateData.title || '');
      console.log('Added title to FormData:', updateData.title);
    }

    if (updateData.description !== undefined) {
      formData.append('description', updateData.description || '');
      console.log('Added description to FormData:', updateData.description);
    }

    if (updateData.capture_date !== undefined) {
      formData.append('capture_date', updateData.capture_date || '');
      console.log('Added capture_date to FormData:', updateData.capture_date);
    }

    if (updateData.location !== undefined) {
      formData.append('location', updateData.location || '');
      console.log('Added location to FormData:', updateData.location);
    }
    
    if (updateData.tags !== undefined) {
      updateData.tags.forEach((tag, index) => {
        formData.append(`tags[${index}]`, tag);
      });
      console.log('Added tags to FormData:', updateData.tags);
    }

    // Add parent_image_id if provided (can be string or null)
    if (updateData.parent_image_id !== undefined) {
      formData.append('parent_image_id', updateData.parent_image_id || '');
      console.log('Added parent_image_id to FormData:', updateData.parent_image_id);
    }

    // Debug FormData contents
    console.log('FormData entries:');
    for (let [key, value] of formData.entries()) {
      console.log(`${key}:`, value instanceof File ? `File(${value.name})` : value);
    }
    
    // Get auth token for headers (don't include Content-Type, let browser set it for FormData)
    const token = localStorage.getItem('stasht_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/memory-images/${postId}`, {
        method: 'POST', // Use POST with _method=PUT for FormData compatibility
        headers: headers, // No Content-Type header - browser will set multipart/form-data with boundary
        body: formData,
      });

      const data = await response.json();

      // Handle 401 Unauthorized responses
      if (response.status === 401) {
        console.log('Received 401 Unauthorized, clearing auth data and reloading');
        userUtils.clearAuthData();
        setTimeout(() => {
          window.location.reload();
        }, 100);
        return {
          success: false,
          error: 'Authentication failed. Please log in again.',
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}`,
        };
      }

      console.log('dashboardAPI.updateMemoryImages: Full API Response:', { success: true, data });
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('API Request Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },

  // Create a new memory (POST to same endpoint as getMemories)
  createMemory: async (memoryData: any): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.createMemory: Sending POST request to /memories');
    console.log('Request Headers:', getAuthHeaders());
    console.log('Request Body:', JSON.stringify(memoryData, null, 2));
    
    const response = await apiRequest('/memories', {
      method: 'POST',
      body: JSON.stringify(memoryData),
    });
    
    console.log('dashboardAPI.createMemory: Full API Response:', response);
    return response;
  },

  // Add description to a post
  addPostDescription: async (postId: string, description: string, mentionedEmails?: string[], mentionedPhones?: string[]): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.addPostDescription: Sending POST request to /memories/add-description');
    console.log('Post ID:', postId);
    console.log('Description:', description);
    console.log('Mentioned Emails:', mentionedEmails);
    console.log('Mentioned Phones:', mentionedPhones);

    const body: any = {
      post_id: postId,
      description: description
    };

    if (mentionedEmails && mentionedEmails.length > 0) {
      body.emails = mentionedEmails;
    }

    if (mentionedPhones && mentionedPhones.length > 0) {
      body.phones = mentionedPhones;
    }

    console.log('📦 Final request body:', JSON.stringify(body));

    return await apiRequest('/memories/add-description', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Edit post description
  editPostDescription: async (postId: string, description: string, mentionedEmails?: string[], mentionedPhones?: string[]): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.editPostDescription: Sending PUT request to /memories/edit-description');
    console.log('Post ID:', postId);
    console.log('Description:', description);
    console.log('Mentioned Emails:', mentionedEmails);
    console.log('Mentioned Phones:', mentionedPhones);

    const body: any = {
      post_id: postId,
      description: description
    };

    if (mentionedEmails && mentionedEmails.length > 0) {
      body.emails = mentionedEmails;
    }

    if (mentionedPhones && mentionedPhones.length > 0) {
      body.phones = mentionedPhones;
    }

    return await apiRequest('/memories/edit-description', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  // Delete post description
  deletePostDescription: async (postId: string): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.deletePostDescription: Sending DELETE request to /memories/delete-description');
    console.log('Post ID:', postId);

    return await apiRequest('/memories/delete-description', {
      method: 'DELETE',
      body: JSON.stringify({
        post_id: postId
      }),
    });
  },

  // Set image as featured
  setImageFeatured: async (imageId: string, isFeatured: boolean): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.setImageFeatured: Sending POST request to /memory-images/set-featured');
    console.log('Image ID:', imageId, 'Is Featured:', isFeatured);

    return await apiRequest('/memory-images/set-featured', {
      method: 'POST',
      body: JSON.stringify({
        image_id: imageId,
        is_featured: isFeatured ? 1 : 0
      }),
    });
  },

  // Delete entire post
  deletePost: async (postId: string): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.deletePost: Sending DELETE request to /memory-images/' + postId);
    console.log('Post ID:', postId);

    return await apiRequest(`/memory-images/${postId}`, {
      method: 'DELETE',
    });
  },

  // Claim post - request ownership
  claimPostRequest: async (postId: string): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.claimPostRequest: Sending POST request to /memory-images/claim-post');
    console.log('Post ID:', postId);

    return await apiRequest('/memory-images/claim-post', {
      method: 'POST',
      body: JSON.stringify({
        post_id: postId
      }),
    });
  },

  // Delete multiple posts
  deleteMultiplePosts: async (imageIds: string[]): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.deleteMultiplePosts: Sending POST request to /memory-images/delete-multiple');
    console.log('Image IDs:', imageIds);

    return await apiRequest('/memory-images/delete-multiple', {
      method: 'POST',
      body: JSON.stringify({
        image_ids: imageIds
      }),
    });
  },

  // Add comment to a post
  addPostComment: async (postId: string, comment: string, parentId?: string): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.addPostComment: Sending POST request to add comment');
    console.log('Post ID (image_id):', postId);
    console.log('Comment:', comment);
    console.log('Parent ID:', parentId);

    const requestBody: any = {
      image_id: postId,
      comment: comment
    };

    // Add parent_id if this is a reply
    if (parentId) {
      requestBody.parent_id = parentId;
    }

    return await apiRequest('/memory-images/comments', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  // Create a new memory with multipart form data (for file uploads)
  createMemoryMultipart: async (formData: FormData): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.createMemoryMultipart: Sending POST request to /memories with multipart data');

    // Count files in FormData before sending
    let fileCount = 0;
    const fileNames = [];
    for (let [key, value] of formData.entries()) {
      if (key === 'media_files[]' && value instanceof File) {
        fileCount++;
        fileNames.push(value.name);
      }
    }
    console.log(`📤 API CALL: Sending ${fileCount} files to backend:`, fileNames);

    // Get auth token for headers (don't include Content-Type, let browser set it for FormData)
    const token = localStorage.getItem('stasht_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    try {
      console.log(`🌐 MAKING FETCH REQUEST with ${fileCount} files...`);
      console.log(`📤 Request URL: ${API_BASE_URL}/memories`);
      console.log(`📋 Request Headers:`, headers);

      // Log the total size of the FormData
      let totalFormDataSize = 0;
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          totalFormDataSize += value.size;
        } else if (typeof value === 'string') {
          totalFormDataSize += value.length;
        }
      }
      console.log(`📦 Total FormData size: ${(totalFormDataSize / 1024 / 1024).toFixed(2)}MB`);

      const response = await fetch(`${API_BASE_URL}/memories`, {
        method: 'POST',
        headers: headers, // No Content-Type header - browser will set multipart/form-data with boundary
        body: formData,
      });

      console.log(`📨 FETCH RESPONSE received:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      const data = await response.json();

      // Handle 401 Unauthorized responses
      if (response.status === 401) {
        console.log('Received 401 Unauthorized, clearing auth data and reloading');
        userUtils.clearAuthData();
        setTimeout(() => {
          window.location.reload();
        }, 100);
        return {
          success: false,
          error: 'Authentication failed. Please log in again.',
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}`,
        };
      }

      console.log('dashboardAPI.createMemoryMultipart: Full API Response:', { success: true, data });
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('API Request Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },

  // Check memory limit status
  checkMemoryLimit: async (): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.checkMemoryLimit: Sending GET request to /user/check-memory-limit');
    console.log('Request Headers:', getAuthHeaders());
    
    const response = await apiRequest('/user/check-memory-limit', {
      method: 'GET',
    });
    
    console.log('dashboardAPI.checkMemoryLimit: Full API Response:', response);
    return response;
  },

  // Get memory counts (total memories, media, published)
  getMemoryCounts: async (): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.getMemoryCounts: Sending GET request to /user/memory-counts');
    console.log('Request Headers:', getAuthHeaders());
    
    const response = await apiRequest('/user/memory-counts', {
      method: 'GET',
    });
    
    console.log('dashboardAPI.getMemoryCounts: Full API Response:', response);
    return response;
  },

  // Delete memory by ID
  deleteMemory: async (memoryId: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.deleteMemory: Deleting memory ID ${memoryId}`);
    console.log('Request Headers:', getAuthHeaders());
    
    const response = await apiRequest(`/memories/${memoryId}`, {
      method: 'DELETE',
    });
    
    console.log('dashboardAPI.deleteMemory: Full API Response:', response);
    return response;
  },

  // Upload photo to media without memory
  uploadPhotoToMedia: async (file: File, name: string, position: number): Promise<ApiResponse<any>> => {
    console.log(`🔧 dashboardAPI.uploadPhotoToMedia: Starting upload for "${name}" at position ${position}`);
    console.log('🔧 File details:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      position
    });
    
    // Check authentication
    const token = tokenUtils.getToken();
    console.log('🔧 Auth token exists:', !!token);
    console.log('🔧 Auth token length:', token?.length || 0);
    
    if (!token) {
      console.error('🔴 No auth token available!');
      return {
        success: false,
        error: 'No authentication token available'
      };
    }
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    formData.append('position', position.toString());

    console.log('=== API REQUEST DETAILS ===');
    console.log('Endpoint:', `${getApiBaseUrl()}/memory-images/upload`);
    console.log('Method: POST');
    console.log('Headers:', getAuthHeaders());
    console.log('FormData Contents:');
    console.log('- name:', name);
    console.log('- file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });
    console.log('- position:', position.toString());
    
    // Log all FormData entries (for debugging)
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`FormData[${key}]:`, {
          name: value.name,
          size: value.size,
          type: value.type
        });
      } else {
        console.log(`FormData[${key}]:`, value);
      }
    }
    
    // Use fetch directly for FormData upload to avoid JSON content-type header
    const response = await fetch(`${getApiBaseUrl()}/memory-images/upload`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders()
        // Don't set Content-Type for FormData - browser will set it with boundary
      },
      body: formData
    });

    console.log('=== API RESPONSE STATUS ===');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('OK:', response.ok);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    let responseData;
    try {
      responseData = await response.json();
      console.log('=== API RESPONSE DATA (PARSED JSON) ===');
      console.log('Full Response Object:', responseData);
      console.log('Response Type:', typeof responseData);
      console.log('Response Keys:', Object.keys(responseData || {}));
      
      // Log each property of the response
      if (responseData && typeof responseData === 'object') {
        Object.entries(responseData).forEach(([key, value]) => {
          console.log(`Response.${key}:`, value);
        });
      }
    } catch (jsonError) {
      console.log('=== FAILED TO PARSE JSON ===');
      console.error('JSON Parse Error:', jsonError);
      const responseText = await response.text();
      console.log('Raw Response Text:', responseText);
      responseData = { error: 'Invalid JSON response', rawText: responseText };
    }
    
    const result = {
      success: response.ok,
      data: responseData,
      error: response.ok ? undefined : responseData?.message || responseData?.error || 'Upload failed'
    };

    console.log('=== FINAL UPLOAD RESULT ===');
    console.log('Success:', result.success);
    console.log('Data:', result.data);
    console.log('Error:', result.error);
    console.log('=== END UPLOAD PROCESS ===');

    return result;
  },

  // Upload multiple photos to media (calls the single upload API multiple times)
  uploadMultiplePhotosToMedia: async (files: File[]): Promise<ApiResponse<any>[]> => {
    console.log(`dashboardAPI.uploadMultiplePhotosToMedia: Uploading ${files.length} files`);
    
    const results: ApiResponse<any>[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const position = i + 1; // Position starts from 1
      const name = file.name;
      
      try {
        console.log(`Uploading file ${i + 1}/${files.length}: ${name} at position ${position}`);
        const result = await dashboardAPI.uploadPhotoToMedia(file, name, position);
        results.push(result);
        
        // Small delay between uploads to avoid overwhelming the server
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Error uploading file ${name}:`, error);
        results.push({
          success: false,
          error: `Failed to upload ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
    
    console.log(`dashboardAPI.uploadMultiplePhotosToMedia: Completed ${results.length} uploads`);
    return results;
  },

  // Get memory collaborators
  getMemoryCollaborators: async (memoryId: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.getMemoryCollaborators: Getting collaborators for memory ID ${memoryId}`);
    console.log(`API URL: /memories/${memoryId}/collaborators`);
    
    return await apiRequest(`/memories/${memoryId}/collaborators`, {
      method: 'GET',
    });
  },

  // Add collaborators to memory (sends emails array and single role) - for memory description page
  addMemoryCollaborator: async (memoryId: string, collaboratorData: {
    emails: string[];
    role: 'view' | 'edit' | 'admin';
  }): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.addMemoryCollaborator: Adding collaborator(s) to memory ID ${memoryId}`);
    console.log('Collaborator Data:', collaboratorData);
    console.log(`API URL: /memories/${memoryId}/add-collabarators`);

    // Map role values to API expected format
    const roleMapping: Record<string, string> = {
      'view': 'viewer',
      'edit': 'contributor',
      'admin': 'admin'
    };

    // Prepare request body in the exact format expected by the API
    const requestBody = {
      emails: collaboratorData.emails,
      role: roleMapping[collaboratorData.role] || collaboratorData.role
    };

    console.log('Final request body:', requestBody);

    return await apiRequest(`/memories/${memoryId}/add-collabarators`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  // Add collaborators to memory by phone (sends phones array and single role)
  addMemoryCollaboratorByPhone: async (memoryId: string, collaboratorData: {
    phones: string[];
    role: 'view' | 'edit' | 'admin';
    message?: string;
  }): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.addMemoryCollaboratorByPhone: Adding collaborator(s) by phone to memory ID ${memoryId}`);
    console.log('Collaborator Data:', collaboratorData);
    console.log(`API URL: /memories/${memoryId}/add-collaborator-by-phone`);

    // Map role values to API expected format
    const roleMapping: Record<string, string> = {
      'view': 'viewer',
      'edit': 'contributor',
      'admin': 'admin'
    };

    // Prepare request body in the exact format expected by the API
    const requestBody: any = {
      phones: collaboratorData.phones,
      role: roleMapping[collaboratorData.role] || collaboratorData.role
    };

    // Include name if provided (from CSV import) — must be a string
    if ((collaboratorData as any).names) {
      requestBody.name = String((collaboratorData as any).names);
    }

    // Add optional message if provided
    if (collaboratorData.message) {
      requestBody.message = collaboratorData.message;
    }

    console.log('Final request body:', requestBody);

    return await apiRequest(`/memories/${memoryId}/add-collaborator-by-phone`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  // Add collaborators to memory (for InviteToMemoryModal on user page) - sends collaborators array with individual roles
  addCollaboratorsToMemory: async (memoryId: string, collaboratorData: {
    collaborators: Array<{email: string; role: 'view' | 'edit' | 'admin'}>;
    message?: string;
  }): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.addCollaboratorsToMemory: Adding collaborators to memory ID ${memoryId}`);
    console.log('Collaborator Data:', collaboratorData);
    console.log(`API URL: /memories/${memoryId}/add-collaborators-new`);

    // Map role values to API expected format
    const roleMapping: Record<string, string> = {
      'view': 'viewer',
      'edit': 'contributor',
      'admin': 'admin'
    };

    // Map collaborators with correct role names
    const mappedCollaborators = collaboratorData.collaborators.map((collab: any) => ({
      ...(collab.name ? { name: collab.name } : {}),
      email: collab.email,
      role: roleMapping[collab.role] || collab.role
    }));

    // Prepare request body in the format expected by add-collaborators-new API
    const requestBody: any = {
      collaborators: mappedCollaborators
    };

    // Add message if provided
    if (collaboratorData.message && collaboratorData.message.trim()) {
      requestBody.message = collaboratorData.message.trim();
      console.log('Adding custom message to request:', collaboratorData.message.trim());
    }

    console.log('Final request body:', requestBody);

    return await apiRequest(`/memories/${memoryId}/add-collaborators-new`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  // Add account admin (for InviteToMemoryModal when Admin role is selected)
  addAccountAdmin: async (collaboratorData: {
    collaborators: Array<{email: string}>;
  }): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.addAccountAdmin: Adding account admin(s)');
    console.log('Collaborator Data:', collaboratorData);
    console.log('API URL: /memories/add-account-admin');

    const requestBody = {
      collaborators: collaboratorData.collaborators
    };

    console.log('Final request body:', requestBody);

    return await apiRequest('/memories/add-account-admin', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  // Add account admin by phone number (for InviteToMemoryModal when Admin role is selected with phone tab)
  addAccountAdminByPhone: async (collaboratorData: {
    collaborators: Array<{phone_number: string}>;
  }): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.addAccountAdminByPhone: Adding account admin(s) by phone');
    console.log('Collaborator Data:', collaboratorData);
    console.log('API URL: /memories/add-account-admin-by-phone');

    const requestBody = {
      collaborators: collaboratorData.collaborators
    };

    console.log('Final request body:', requestBody);

    return await apiRequest('/memories/add-account-admin-by-phone', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  // Check if email is already an admin
  checkAdminEmail: async (email: string): Promise<ApiResponse<{
    is_admin: boolean;
    message?: string;
  }>> => {
    console.log('dashboardAPI.checkAdminEmail: Checking if email is already admin');
    console.log('Email:', email);
    console.log('API URL: /user/check-admin-email');

    return await apiRequest('/user/check-admin-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Login as Admin - Switch to admin account
  // Called when user with admin collaborator role chooses to login as admin
  loginAsAdmin: async (ownerId: string): Promise<ApiResponse<{
    user: any;
    token: string;
    token_type: string;
    expires_at: string;
  }>> => {
    console.log('dashboardAPI.loginAsAdmin: Logging in as admin');
    console.log('Owner ID:', ownerId);
    console.log('API URL: /login-as-admin');

    return await apiRequest('/login-as-admin', {
      method: 'POST',
      body: JSON.stringify({ owner_id: ownerId }),
    });
  },

  loginAsPartialAdmin: async (ownerId: string, email: string): Promise<ApiResponse<any>> => {
    return await apiRequest('/login-as-partial-admin', {
      method: 'POST',
      body: JSON.stringify({ owner_id: Number(ownerId), email }),
    });
  },

  getPartialAdminMemories: async (email: string): Promise<ApiResponse<any>> => {
    return await apiRequest(`/memories/partial-admin-memories?partial_admin_email=${encodeURIComponent(email)}`, {
      method: 'GET',
    });
  },

  getPartialAdminMedia: async (email: string): Promise<ApiResponse<any>> => {
    return await apiRequest(`/memory-images/partial-admin?partial_admin_email=${encodeURIComponent(email)}`, {
      method: 'GET',
    });
  },

  // Remove collaborators from memory
  removeMemoryCollaborators: async (memoryId: string, userIds: string[], isPropertyUser?: boolean): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.removeMemoryCollaborators: Removing collaborators from memory ID ${memoryId}`);
    console.log('User IDs to remove:', userIds);
    console.log(`Is property user: ${!!isPropertyUser}`);
    console.log(`API URL: /memories/${memoryId}/remove-collaborators`);

    const payload: Record<string, any> = { user_id: userIds };
    if (isPropertyUser) payload.property = 1;

    return await apiRequest(`/memories/${memoryId}/remove-collaborators`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Edit collaborator role
  editCollaboratorRole: async (memoryId: string, userId: string, role: 'view' | 'edit' | 'admin'): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.editCollaboratorRole: Editing collaborator role for memory ID ${memoryId}`);
    console.log('User ID:', userId);
    console.log('New Role:', role);
    console.log(`API URL: /memories/${memoryId}/edit-collaborator-role`);
    
    return await apiRequest(`/memories/${memoryId}/edit-collaborator-role`, {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        role: role
      }),
    });
  },

  // Edit non-user collaborator role
  editNonUserCollaboratorRole: async (email: string, memoryId: string, role: 'view' | 'edit' | 'admin'): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.editNonUserCollaboratorRole: Editing non-user collaborator role for email ${email}`);
    console.log('Memory ID:', memoryId);
    console.log('New Role (frontend):', role);
    console.log(`API URL: /memories/non-user-collaborator/${email}`);

    // Map frontend role values to backend role values
    const roleMapping: { [key: string]: string } = {
      'view': 'viewer',
      'edit': 'contributor',
      'admin': 'admin'
    };

    const backendRole = roleMapping[role] || role;
    console.log('Mapped Role (backend):', backendRole);

    return await apiRequest(`/memories/non-user-collaborator/${email}`, {
      method: 'PUT',
      body: JSON.stringify({
        memory_id: memoryId,
        role: backendRole
      }),
    });
  },

  // Add collaborator by QR code (for anyone who scans the QR code)
  addCollaboratorByQrCode: async (memoryId: string, externalUserId: string, role: 'view' | 'edit' | 'admin'): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.addCollaboratorByQrCode: Adding collaborator via QR code to memory ID ${memoryId}`);
    console.log('External User ID:', externalUserId);
    console.log('Role (frontend):', role);
    console.log(`API URL: /memories/add-collaborator-by-qr-code`);

    // Map frontend role values to backend role values
    const roleMapping: { [key: string]: string } = {
      'view': 'viewer',
      'edit': 'contributor',
      'admin': 'admin'
    };

    const backendRole = roleMapping[role] || role;
    console.log('Mapped Role (backend):', backendRole);

    const requestBody = {
      memory_id: memoryId,
      user_id: externalUserId,
      role: backendRole
    };

    console.log('Final request body:', requestBody);

    return await apiRequest(`/memories/add-collaborator-by-qr-code`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  addSelfAsCollaborator: async (memoryId: string, role: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.addSelfAsCollaborator: Joining memory ID ${memoryId} as ${role}`);
    return await apiRequest(`/memories/add-self-as-collaborator`, {
      method: 'POST',
      body: JSON.stringify({ memory_id: memoryId, role }),
    });
  },

  // Edit non-user collaborator role by phone
  editNonUserCollaboratorRoleByPhone: async (phone: string, memoryId: string, role: 'view' | 'edit' | 'admin'): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.editNonUserCollaboratorRoleByPhone: Editing non-user collaborator role for phone ${phone}`);
    console.log('Memory ID:', memoryId);
    console.log('New Role (frontend):', role);
    console.log(`API URL: /memories/non-user-collaborator-by-phone/${encodeURIComponent(phone)}`);

    // Map frontend role values to backend role values
    const roleMapping: { [key: string]: string } = {
      'view': 'viewer',
      'edit': 'contributor',
      'admin': 'admin'
    };

    const backendRole = roleMapping[role] || role;
    console.log('Mapped Role (backend):', backendRole);

    return await apiRequest(`/memories/non-user-collaborator-by-phone/${encodeURIComponent(phone)}`, {
      method: 'PUT',
      body: JSON.stringify({
        memory_id: memoryId,
        role: backendRole
      }),
    });
  },

  // Resend invitation
  resendInvitation: async (inviteId: number): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.resendInvitation: Resending invitation for invite ID ${inviteId}`);
    console.log(`API URL: /invites/${inviteId}/resend`);

    return await apiRequest(`/invites/${inviteId}/resend`, {
      method: 'POST',
    });
  },

  // Remove non-user collaborator
  removeNonUserCollaborator: async (email: string, memoryId: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.removeNonUserCollaborator: Removing non-user collaborator ${email}`);
    console.log('Memory ID:', memoryId);
    console.log(`API URL: /memories/non-user-collaborator/${email}`);

    return await apiRequest(`/memories/non-user-collaborator/${email}`, {
      method: 'DELETE',
      body: JSON.stringify({
        memory_id: memoryId
      }),
    });
  },

  // Remove non-user collaborator by phone
  removeNonUserCollaboratorByPhone: async (phone: string, memoryId: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.removeNonUserCollaboratorByPhone: Removing non-user collaborator ${phone}`);
    console.log('Memory ID:', memoryId);
    console.log(`API URL: /memories/non-user-collaborator-by-phone/${encodeURIComponent(phone)}`);

    return await apiRequest(`/memories/non-user-collaborator-by-phone/${encodeURIComponent(phone)}`, {
      method: 'DELETE',
      body: JSON.stringify({
        memory_id: memoryId
      }),
    });
  },

  // Generate share link for QR code
  generateShareLink: async (memoryId: string, role: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.generateShareLink: Generating share link for memory ID ${memoryId}`);
    console.log('Role:', role);
    console.log(`API URL: /share-qr/${memoryId}/${role}`);

    return await apiRequest(`/share-qr/${memoryId}/${role}`, {
      method: 'GET',
    });
  },

  // Get memory preview info by memory_id for share link preview cards
  getShareLinkInfo: async (memoryId: string): Promise<ApiResponse<any>> => {
    return await apiRequest(`/share-qr/info/${memoryId}`, {
      method: 'GET',
    });
  },

  // Get user notifications
  getUserNotifications: async (): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.getUserNotifications: Getting user notifications');
    console.log('API URL: /user/notifications');
    
    return await apiRequest('/user/notifications', {
      method: 'GET',
    });
  },

  // Accept notification (for invitations, etc.)
  acceptNotification: async (notificationId: string): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.acceptNotification: Accepting notification', notificationId);
    console.log(`API URL: /user/notifications/${notificationId}/accept`);
    
    return await apiRequest(`/user/notifications/${notificationId}/accept`, {
      method: 'POST',
    });
  },

  // Decline notification (for invitations, etc.)
  declineNotification: async (notificationId: string): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.declineNotification: Declining notification', notificationId);
    console.log(`API URL: /user/notifications/${notificationId}/decline`);
    
    return await apiRequest(`/user/notifications/${notificationId}/decline`, {
      method: 'POST',
    });
  },

  // Mark notification as read
  markNotificationAsRead: async (notificationId: string): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.markNotificationAsRead: Marking notification as read', notificationId);
    console.log(`API URL: /user/notifications/${notificationId}/read`);

    return await apiRequest(`/user/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },

  // Delete old notifications (older than 1 week)
  deleteOldNotifications: async (): Promise<ApiResponse<any>> => {
    console.log('dashboardAPI.deleteOldNotifications: Deleting notifications older than 1 week');
    console.log('API URL: /user/notifications/delete-old');

    return await apiRequest('/user/notifications/delete-old', {
      method: 'DELETE',
    });
  },

  // Update collaborator role
  updateCollaboratorRole: async (memoryId: string, collaboratorId: string, role: 'view' | 'edit' | 'admin'): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.updateCollaboratorRole: Updating collaborator role for memory ID ${memoryId}, collaborator ID ${collaboratorId}`);
    console.log('New Role:', role);
    console.log(`API URL: /memories/${memoryId}/collaborators/${collaboratorId}`);

    return await apiRequest(`/memories/${memoryId}/collaborators/${collaboratorId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  // Update user collaborator role (correct API endpoint for Users page)
  editUserCollaboratorRole: async (collaboratorId: number, role: string, collaboratorType: string = 'user', memoryIds?: (string | number)[], phoneNumber?: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.editUserCollaboratorRole: Updating user collaborator role for ID ${collaboratorId}`);
    console.log('Role:', role);
    console.log('Collaborator Type:', collaboratorType);
    console.log(`API URL: /user/edit-collaborator-role`);

    const body: any = {
      collaborator_id: collaboratorId,
      role: role,
      collaborator_type: collaboratorType
    };
    if (memoryIds && memoryIds.length > 0) {
      body.memory_ids = memoryIds;
    }
    if (phoneNumber) {
      body.phone_number = phoneNumber;
    }

    return await apiRequest('/user/edit-collaborator-role', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  // Update collaborator information (deprecated - use editCollaboratorRole for role updates)
  updateCollaborator: async (collaboratorId: number, updates: {
    name: string;
    email: string;
    role: string;
    message?: string;
  }): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.updateCollaborator: Updating collaborator ID ${collaboratorId}`);
    console.log('Updates:', updates);
    console.log(`API URL: /user/collaborators/${collaboratorId}`);

    return await apiRequest(`/user/collaborators/${collaboratorId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Deactivate user
  deactivateUser: async (userId: number): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.deactivateUser: Deactivating user ID ${userId}`);
    console.log(`API URL: /users/${userId}/deactivate`);

    return await apiRequest(`/users/${userId}/deactivate`, {
      method: 'PUT',
      body: JSON.stringify({ status: 0 }),
    });
  },

  // Remove user
  removeUser: async (userId: number): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.removeUser: Removing user ID ${userId}`);
    console.log(`API URL: /users/${userId}`);

    return await apiRequest(`/users/${userId}`, {
      method: 'DELETE',
    });
  },

  // Remove collaborator from memory
  removeMemoryCollaborator: async (memoryId: string, collaboratorId: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.removeMemoryCollaborator: Removing collaborator from memory ID ${memoryId}, collaborator ID ${collaboratorId}`);
    console.log(`API URL: /memories/${memoryId}/collaborators/${collaboratorId}`);
    
    return await apiRequest(`/memories/${memoryId}/collaborators/${collaboratorId}`, {
      method: 'DELETE',
    });
  },

  // Get memory activity data
  getMemoryActivity: async (memoryId: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.getMemoryActivity: Getting activity for memory ID ${memoryId}`);
    console.log(`API URL: /memories/${memoryId}/activity`);
    
    return await apiRequest(`/memories/${memoryId}/activity`, {
      method: 'GET',
    });
  },

  // Get publish history for a memory
  getPublishHistory: async (memoryId: string): Promise<ApiResponse<any>> => {
    return await apiRequest(`/memories/${memoryId}/publish-history`, {
      method: 'GET',
    });
  },

  // Track a view when someone opens a published memory from a shared link
  trackMemoryView: async (memoryId: string | number): Promise<ApiResponse<any>> => {
    return await apiRequest(`/memories/${memoryId}/track-view`, {
      method: 'POST',
    });
  },

  // Search users for collaborator invite
  searchUsers: async (searchQuery: string, searchType: 'email' | 'phone' = 'email'): Promise<ApiResponse<any>> => {
    const paramName = searchType === 'phone' ? 'phone' : 'search';
    console.log(`dashboardAPI.searchUsers: Searching users with ${searchType} query "${searchQuery}"`);
    console.log(`API URL: /user/list-of-users?${paramName}=${encodeURIComponent(searchQuery)}`);

    return await apiRequest(`/user/list-of-users?${paramName}=${encodeURIComponent(searchQuery)}`, {
      method: 'GET',
    });
  },

  // Upload image with metadata to get location and capture date
  uploadImageWithMetadata: async (file: File, name: string, orientation?: number): Promise<ApiResponse<any>> => {
    console.log(`🔧 dashboardAPI.uploadImageWithMetadata: Starting upload for "${name}"`);
    console.log('🔧 File details:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });
    
    // Check authentication
    const token = tokenUtils.getToken();
    console.log('🔧 Auth token exists:', !!token);
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('image', file); // Try 'image' parameter name
    // Also try 'file' parameter as backup (some APIs expect 'file')
    formData.append('file', file);
    formData.append('is_memory', '1'); // Add is_memory=1 parameter for create memory modal
    if (orientation !== undefined && orientation > 0) {
      formData.append('orientation', String(orientation));
    }
    
    // Add more file details for debugging
    console.log('=== DETAILED FILE OBJECT ===');
    console.log('File is valid object:', file && typeof file === 'object');
    console.log('File constructor name:', file.constructor ? file.constructor.name : 'unknown');
    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });

    console.log('=== API REQUEST DETAILS ===');
    const endpoint = `${getApiBaseUrl()}/user/upload-image-with-metadata`;
    console.log('Endpoint:', endpoint);
    console.log('Full API Base URL:', getApiBaseUrl());
    console.log('Method: POST');
    console.log('FormData Contents:');
    console.log('- name:', name);
    console.log('- image (file object):', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    // Log FormData entries for debugging
    console.log('=== FORMDATA ENTRIES ===');
    for (let [key, value] of formData.entries()) {
      if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'File') {
        console.log(`FormData[${key}]:`, {
          name: value.name,
          size: value.size,
          type: value.type,
          isFile: true
        });
      } else {
        console.log(`FormData[${key}]:`, value);
      }
    }

    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    console.log('Request Headers:', headers);
    
    // Use fetch directly for FormData upload to avoid JSON content-type header
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: formData
    });

    console.log('🔧 Response status:', response.status, response.statusText);
    console.log('🔧 Response headers:', Object.fromEntries(response.headers.entries()));

    let responseData;
    const responseText = await response.text();
    console.log('🔧 Raw response text:', responseText);

    try {
      responseData = JSON.parse(responseText);
      console.log('🔧 Parsed response data:', responseData);
    } catch (e) {
      console.error('🔧 Failed to parse JSON response:', e);
      return {
        success: false,
        data: null,
        error: 'Invalid response format from server'
      };
    }

    console.log('=== FINAL API RESPONSE ===');
    console.log('dashboardAPI.uploadImageWithMetadata: Full API Response:', responseData);
    console.log('Response OK:', response.ok);
    console.log('Response Status:', response.status);
    console.log('Response Status Text:', response.statusText);

    const result = {
      success: response.ok,
      data: responseData,
      error: response.ok ? undefined : responseData?.message || responseData?.error || `HTTP ${response.status}: ${response.statusText}`,
      statusCode: response.status,
      statusText: response.statusText,
      rawResponse: responseData
    };

    console.log('🔧 Final result:', result);
    return result;
  },

  // Upload photo to media without memory (using Laravel route /upload)
  uploadPhotoToMediaWithoutMemory: async (file: File, name: string): Promise<ApiResponse<any>> => {
    console.log(`🔧 dashboardAPI.uploadPhotoToMediaWithoutMemory: Starting upload for "${name}"`);
    console.log('🔧 File details:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });
    
    // Check authentication
    const token = tokenUtils.getToken();
    console.log('🔧 Auth token exists:', !!token);
    console.log('🔧 Auth token length:', token?.length || 0);
    
    if (!token) {
      console.error('🔴 No auth token available!');
      return {
        success: false,
        error: 'No authentication token available'
      };
    }
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);

    console.log('=== API REQUEST DETAILS ===');
    console.log('Endpoint:', `${getApiBaseUrl()}/memory-images/upload`);
    console.log('Method: POST');
    console.log('FormData Contents:');
    console.log('- name:', name);
    console.log('- file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });
    
    // Log all FormData entries (for debugging)
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`FormData[${key}]:`, {
          name: value.name,
          size: value.size,
          type: value.type
        });
      } else {
        console.log(`FormData[${key}]:`, value);
      }
    }
    
    // Create headers without Content-Type for FormData
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    console.log('Request Headers:', headers);
    
    // Use fetch directly for FormData upload to avoid JSON content-type header
    const response = await fetch(`${getApiBaseUrl()}/memory-images/upload`, {
      method: 'POST',
      headers: headers, // Only Authorization header, no Content-Type
      body: formData
    });

    console.log('=== API RESPONSE STATUS ===');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('OK:', response.ok);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    let responseData;
    try {
      const responseText = await response.text();
      console.log('🔧 Raw response text:', responseText);
      
      if (responseText) {
        responseData = JSON.parse(responseText);
      } else {
        responseData = {};
      }
    } catch (parseError) {
      console.error('🔴 Error parsing response:', parseError);
      return {
        success: false,
        error: 'Invalid response format from server'
      };
    }

    console.log('=== FINAL API RESPONSE ===');
    console.log('dashboardAPI.uploadPhotoToMediaWithoutMemory: Full API Response:', responseData);

    const result = {
      success: response.ok,
      data: responseData,
      error: response.ok ? undefined : responseData?.message || responseData?.error || `HTTP ${response.status}: ${response.statusText}`
    };

    console.log('🔧 Final result:', result);
    return result;
  },

  // Get user profile data
  getUserProfile: async (): Promise<ApiResponse<any>> => {
    console.log('🔍 DEBUG: Calling /user/profile API');
    try {
      const response = await apiRequest('/user/profile', {
        method: 'GET',
      });
      console.log('🔍 DEBUG: /user/profile API response:', response);
      return response;
    } catch (error) {
      console.error('🔍 ERROR: /user/profile API error:', error);
      return {
        success: false,
        error: 'Failed to fetch user profile data'
      };
    }
  },

  // Upload photos from media without memory (second API call)
  uploadPhotosFromMediaWithOutMemory: async (file: File, name: string, location?: string, captureDate?: string, title?: string, description?: string): Promise<ApiResponse<any>> => {
    console.log(`🔧 dashboardAPI.uploadPhotosFromMediaWithOutMemory: Starting upload for "${name}"`);
    console.log('🔧 File details:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      location: location || 'Not provided',
      captureDate: captureDate || 'Not provided'
    });
    
    // Check authentication
    const token = tokenUtils.getToken();
    console.log('🔧 Auth token exists:', !!token);
    
    if (!token) {
      console.error('🔴 No auth token available!');
      return {
        success: false,
        error: 'No authentication token available'
      };
    }
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    
    // Always add metadata parameters, even if empty
    const locationToSend = location || '';
    const dateTimeToSend = captureDate || '';
    
    formData.append('location', locationToSend);
    formData.append('dateTime', dateTimeToSend);
    formData.append('title', title || '');
    formData.append('description', description || '');
    
    console.log('🔧 DEBUGGING PARAMETER ADDITION:');
    console.log('🔧 Original location parameter:', location);
    console.log('🔧 Original captureDate parameter:', captureDate);
    console.log('🔧 locationToSend:', locationToSend);
    console.log('🔧 dateTimeToSend:', dateTimeToSend);
    console.log('🔧 typeof location:', typeof location);
    console.log('🔧 typeof captureDate:', typeof captureDate);
    console.log('🔧 location === undefined:', location === undefined);
    console.log('🔧 captureDate === undefined:', captureDate === undefined);
    console.log('🔧 location === null:', location === null);
    console.log('🔧 captureDate === null:', captureDate === null);

    console.log('=== API REQUEST DETAILS ===');
    console.log('Endpoint:', `${getApiBaseUrl()}/memory-images/upload`);
    console.log('Method: POST');
    console.log('FormData Contents:');
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`FormData[${key}]:`, {
          name: value.name,
          size: value.size,
          type: value.type
        });
      } else {
        console.log(`FormData[${key}]:`, value);
      }
    }
    
    // Create headers without Content-Type for FormData
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    console.log('Request Headers:', headers);
    
    try {
      // Use fetch directly for FormData upload to avoid JSON content-type header
      const response = await fetch(`${getApiBaseUrl()}/memory-images/upload`, {
        method: 'POST',
        headers: headers, // Only Authorization header, no Content-Type
        body: formData
      });

      console.log('=== API RESPONSE STATUS ===');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('OK:', response.ok);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));

      let responseData;
      try {
        const responseText = await response.text();
        console.log('🔧 Raw response text:', responseText);
        
        if (responseText) {
          responseData = JSON.parse(responseText);
        } else {
          responseData = {};
        }
      } catch (parseError) {
        console.error('🔴 Error parsing response:', parseError);
        return {
          success: false,
          error: 'Invalid response format from server'
        };
      }

      console.log('=== FINAL API RESPONSE ===');
      console.log('dashboardAPI.uploadPhotosFromMediaWithOutMemory: Full API Response:', responseData);

      const result = {
        success: response.ok,
        data: responseData,
        error: response.ok ? undefined : responseData?.message || responseData?.error || `HTTP ${response.status}: ${response.statusText}`
      };

      console.log('🔧 Final result:', result);
      return result;
    } catch (error) {
      console.error('🔧 Network error:', error);
      return {
        success: false,
        error: 'Network error occurred'
      };
    }
  },

  // Upload photos after memory creation (Add Moment)
  uploadPhotosAfterCreation: async (momentData: {
    description: string;
    date: string;
    location: string;
    image?: File;
    memory_id: string;
  }): Promise<ApiResponse<any>> => {
    console.log('🔍 DEBUG: Adding moment with data:', momentData);
    
    try {
      const formData = new FormData();
      formData.append('description', momentData.description);
      formData.append('date', momentData.date);
      formData.append('location', momentData.location);
      formData.append('memory_id', momentData.memory_id);
      
      if (momentData.image) {
        formData.append('image', momentData.image);
      }

      console.log('🔍 DEBUG: FormData contents:');
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
        } else {
          console.log(`  ${key}: "${value}"`);
        }
      }

      // For FormData, we need to manually handle headers to avoid Content-Type conflicts
      const token = tokenUtils.getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      // Do NOT set Content-Type for FormData - browser will set it with boundary

      console.log('🔍 DEBUG: Making request to:', `${API_BASE_URL}/memories/upload-photos-after-creation`);
      console.log('🔍 DEBUG: Request headers:', headers);
      console.log('🔍 DEBUG: FormData size:', Array.from(formData.entries()).length, 'entries');

      const response = await fetch(`${API_BASE_URL}/memories/upload-photos-after-creation`, {
        method: 'POST',
        headers,
        body: formData,
      });

      console.log('🔍 DEBUG: Response status:', response.status, response.statusText);
      console.log('🔍 DEBUG: Response headers:', Object.fromEntries(response.headers.entries()));

      const responseData = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: responseData.message || responseData.error || `HTTP ${response.status}`,
        };
      }

      console.log('🔍 DEBUG: Add moment API response:', responseData);
      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      console.error('🔍 ERROR: Add moment API error:', error);
      return {
        success: false,
        error: 'Failed to add moment'
      };
    }
  },

  // Action on invitation (accept or reject)
  actionOnInvitation: async (memoryId: string, status: 0 | 1, notificationId?: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.actionOnInvitation: ${status === 1 ? 'Accepting' : 'Rejecting'} invitation for memory ID ${memoryId}`);
    console.log('Memory ID:', memoryId);
    console.log('Status:', status, status === 1 ? '(Accept)' : '(Reject)');
    console.log('Notification ID:', notificationId);
    console.log(`API URL: /memories/invitation/action/${memoryId}`);

    const requestBody = {
      status: status,
      notification_id: notificationId
    };

    console.log('Request body:', requestBody);

    return await apiRequest(`/memories/invitation/action/${memoryId}`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  // Request full access to a memory
  requestFullAccess: async (memoryId: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.requestFullAccess: Requesting full access for memory ID ${memoryId}`);
    console.log(`API URL: /memories/${memoryId}/request-full-access`);

    return await apiRequest(`/memories/${memoryId}/request-full-access`, {
      method: 'POST',
    });
  },

  // Remove shared memory from current user's collection
  removeSharedWithMemory: async (memoryId: string, userId: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.removeSharedWithMemory: Removing memory ID ${memoryId} for user ID ${userId}`);
    console.log(`API URL: /memories/${memoryId}/remove-shared-user`);

    return await apiRequest(`/memories/${memoryId}/remove-shared-user`, {
      method: 'DELETE',
      body: JSON.stringify({ user_id: userId }),
    });
  },

  // Generic GET method for invites API
  get: async (endpoint: string): Promise<any> => {
    try {
      const response = await apiRequest(endpoint);
      if (response.success) {
        return response.data;
      }
      
      // For invites endpoint specifically, handle all failures gracefully
      if (endpoint.includes('/invites')) {
        console.warn('Invites endpoint failed, returning empty data:', response.error);
        return {
          success: true,
          data: {
            total_invites: 0,
            invites: [],
            grouped_invites: { pending: [], accepted: [], rejected: [] },
            counts: { pending: 0, accepted: 0, rejected: 0 }
          }
        };
      }
      
      throw new Error(response.error || 'Request failed');
    } catch (error) {
      // For invites endpoint, return empty data instead of throwing
      if (endpoint.includes('/invites')) {
        console.warn('Invites endpoint failed with exception, returning empty data:', error);
        return {
          success: true,
          data: {
            total_invites: 0,
            invites: [],
            grouped_invites: { pending: [], accepted: [], rejected: [] },
            counts: { pending: 0, accepted: 0, rejected: 0 }
          }
        };
      }
      throw error;
    }
  },

  // Add tags to multiple memories
  addTagsToMemories: async (memory_ids: string[], tags: string[]): Promise<ApiResponse> => {
    return apiRequest('/memories/add-tags', {
      method: 'POST',
      body: JSON.stringify({ memory_ids, tags }),
    });
  },

  // Merge multiple memories into one
  mergeMemories: async (memory_ids: string[], title: string, delete_on_merge: boolean = true): Promise<ApiResponse> => {
  return apiRequest('/memories/merge', {
      method: 'POST',
      body: JSON.stringify({ memory_ids, title, is_delete: delete_on_merge ? 1 : 0 }),
    });
  },

  // Duplicate a single memory
  duplicateMemory: async (id: string): Promise<ApiResponse> => {
    return apiRequest(`/memories/${id}/duplicate`, {
      method: 'POST',
    });
  },

  // Generic POST method for invites API
  post: async (endpoint: string, data?: any): Promise<any> => {
    try {
      const response = await apiRequest(endpoint, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      });
      if (response.success) {
        return response.data;
      }
      
      // For invites endpoint specifically, handle failures gracefully
      if (endpoint.includes('/invites')) {
        console.warn('Invites POST endpoint failed, returning empty success:', response.error);
        return { success: false, message: 'Invites feature not available' };
      }
      
      throw new Error(response.error || 'Request failed');
    } catch (error) {
      // For invites endpoint, return graceful failure instead of throwing
      if (endpoint.includes('/invites')) {
        console.warn('Invites POST endpoint failed with exception:', error);
        return { success: false, message: 'Invites feature not available' };
      }
      throw error;
    }
  },

  // Get collaborators and non-collaborators for Users page
  getUsersCollaboratorsAndNonCollaborators: async (searchQuery?: string, propertyId?: number): Promise<ApiResponse<any>> => {
    console.log('🚨 DEBUG: Calling /user/collaborators-and-non-collaborators API');

    // Build URL with search and property_id parameters if provided
    let url = '/user/collaborators-and-non-collaborators';
    const params = new URLSearchParams();

    if (searchQuery && searchQuery.trim()) {
      params.append('search', searchQuery.trim());
      console.log('🔍 Adding search parameter:', searchQuery.trim());
    }

    if (propertyId) {
      params.append('property_id', propertyId.toString());
      console.log('🏠 Adding property_id parameter:', propertyId);
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await apiRequest(url, {
      method: 'GET',
    });
    console.log('🚨 DEBUG: /user/collaborators-and-non-collaborators API raw response:', response);
    return response;
  },

  // Get collaborators for magic link flow (with email and role)
  getCollaboratorsForMagicLink: async (email: string, role: string = 'admin'): Promise<ApiResponse<any>> => {
    console.log('🔗 DEBUG: Calling magic link collaborators API');
    console.log('🔗 Email:', email, 'Role:', role);

    const params = new URLSearchParams({
      email: email,
      role: role
    });

    const url = `/user/collaborators-and-non-collaborators?${params.toString()}`;

    const response = await apiRequest(url, {
      method: 'GET',
    });

    console.log('🔗 DEBUG: Magic link collaborators API response:', response);
    return response;
  },

  // Get my collaboration associations (memories where I'm a collaborator)
  getMyCollaborationAssociations: async (): Promise<ApiResponse<any>> => {
    console.log('🤝 DEBUG: Calling /memories/my-collaboration-associations API');
    const response = await apiRequest('/user/my-collaboration-associations', {
      method: 'GET',
    });
    console.log('🤝 DEBUG: /memories/my-collaboration-associations API raw response:', response);
    return response;
  },

  // Remove collaboration association (remove user from shared memory)
  removeCollaborationAssociation: async (collaborationId: number): Promise<ApiResponse<any>> => {
    console.log('🗑️ DEBUG: Removing collaboration association:', collaborationId);
    const response = await apiRequest(`/user/collaboration-associations/${collaborationId}`, {
      method: 'DELETE',
    });
    console.log('🗑️ DEBUG: Remove collaboration association response:', response);
    return response;
  },

  // Search memories with optional search query
  searchMemories: async (searchQuery?: string): Promise<ApiResponse<any>> => {
    const url = searchQuery
      ? `/memories/search?search_memory=${encodeURIComponent(searchQuery)}`
      : '/memories/search';

    console.log('🔍 DEBUG: Calling memories search API:', url);
    const response = await apiRequest(url, {
      method: 'GET',
    });
    console.log('🔍 DEBUG: Memories search API response:', response);
    return response;
  },

  // Delete user collaborator (for Users page)
  deleteUserCollaborator: async (collaboratorUserId?: number, collaboratorEmail?: string, collaboratorType?: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.deleteUserCollaborator: Deleting user collaborator`);
    console.log('Collaborator User ID:', collaboratorUserId);
    console.log('Collaborator Email:', collaboratorEmail);
    console.log('Collaborator Type:', collaboratorType);

    // Validate that either user ID or email is provided
    if (!collaboratorUserId && !collaboratorEmail) {
      return {
        success: false,
        error: 'Either collaborator_user_id or collaborator_email must be provided'
      };
    }

    // Build request body based on collaborator type and available data
    const requestBody: any = {};

    if (collaboratorType === 'user' && collaboratorUserId) {
      requestBody.collaborator_user_id = collaboratorUserId;
    } else if (collaboratorEmail) {
      requestBody.collaborator_email = collaboratorEmail;
    } else if (collaboratorUserId) {
      // Fallback to user ID if email not available
      requestBody.collaborator_user_id = collaboratorUserId;
    }

    console.log('API Request Body:', requestBody);
    console.log(`API URL: /user/delete-user-collaborator`);

    return await apiRequest('/user/delete-user-collaborator', {
      method: 'DELETE',
      body: JSON.stringify(requestBody),
    });
  },

  // Get AI suggested description for image
  getSuggestedDescription: async (imageUrl: string, tone?: string, memoryId?: string, noCredit?: boolean): Promise<ApiResponse<any>> => {
    console.log('🤖 Calling AI suggested description API for image:', imageUrl, 'with tone:', tone, 'memoryId:', memoryId, 'and noCredit:', noCredit);

    const requestBody: any = {
      image: imageUrl,
      ...(tone && { tone }),
      ...(memoryId && { memory_id: memoryId })
    };

    // Add no_credit parameter when retrying (0 means no credits will be deducted)
    if (noCredit) {
      requestBody.no_credit = 1;
    }

    return await apiRequest('/memory-images/suggested-description', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  // AI Memory Wizard - Analyze uploaded photos
  analyzeUploadedPhotos: async (photos: string[], cluster_type?: 'faces' | 'moments' | 'objects', memoryId?: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.analyzeUploadedPhotos: Analyzing ${photos.length} photos with cluster_type: ${cluster_type || 'all'} and memoryId: ${memoryId}`);

    const requestBody: any = { photos };
    if (cluster_type) {
      requestBody.cluster_type = cluster_type;
    }
    if (memoryId) {
      requestBody.memory_id = memoryId;
    }

    return await apiRequest('/ai/analyze/upload', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  // AI Story Wizard - Detect labels for photos
  detectLabels: async (photos: string[]): Promise<ApiResponse<any>> => {
    return await apiRequest('/ai/detect-labels', {
      method: 'POST',
      body: JSON.stringify({ photos }),
    });
  },

  // AI Memory Wizard - Create memory from custom prompt
  createMemoryFromSentence: async (prompt: string, memory: any[]): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.createMemoryFromSentence: Creating memory from prompt with ${memory.length} files`);

    return await apiRequest('/ai/create-memory-from-sentence', {
      method: 'POST',
      body: JSON.stringify({ prompt, memory }),
    });
  },

  // AI Memory Wizard - Create memory from AI response
  createMemoryFromAIResponse: async (ai_response: any): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.createMemoryFromAIResponse: Creating memory from AI response`);
    console.log('AI Response data being sent:', ai_response);

    return await apiRequest('/ai/create-memory-from-ai-response', {
      method: 'POST',
      body: JSON.stringify({ ai_response }),
    });
  },

  // AI Memory Wizard - Create memories from photo groups (faces, moments, objects)
  createMemoriesFromGroups: async (groupData: any, type: 'faces' | 'moments' | 'objects'): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.createMemoriesFromGroups: Creating memories from ${type} groups`);
    console.log('Group data being sent:', groupData);

    return await apiRequest('/ai/photos/memories', {
      method: 'POST',
      body: JSON.stringify({
        groups: groupData,
        type
      }),
    });
  },

  // Accept suggested category for a memory
  acceptSuggestedCategory: async (memoryId: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.acceptSuggestedCategory: Accepting suggested category for memory ${memoryId}`);
    console.log('API URL: /ai/suggested/accept');
    console.log('Request body:', { memory_id: memoryId });

    return await apiRequest('/ai/suggested/accept', {
      method: 'POST',
      body: JSON.stringify({ memory_id: memoryId }),
    });
  },

  // Reject suggested category for a memory
  rejectSuggestedCategory: async (memoryId: string): Promise<ApiResponse<any>> => {
    console.log(`dashboardAPI.rejectSuggestedCategory: Rejecting suggested category for memory ${memoryId}`);
    console.log('API URL: /ai/suggested/reject');
    console.log('Request body:', { memory_id: memoryId });

    return await apiRequest('/ai/suggested/reject', {
      method: 'POST',
      body: JSON.stringify({ memory_id: memoryId }),
    });
  },

  // Get AI Library faces (grouped face clusters)
  getLibraryFaces: async (): Promise<ApiResponse<any>> => {
    console.log('📚 dashboardAPI.getLibraryFaces: Fetching library faces');
    return await apiRequest('/ai/library/faces', {
      method: 'GET',
    });
  },

  backfillFaceThumbnails: async (): Promise<ApiResponse<any>> => {
    return await apiRequest('/ai/library/faces/backfill-thumbnails', {
      method: 'POST',
    });
  },

  // Assign selected media to face clusters
  assignMediaToFaces: async (params: { face_ids: string[]; media_ids: number[] }): Promise<ApiResponse<any>> => {
    console.log('🔗 dashboardAPI.assignMediaToFaces:', params);
    return await apiRequest('/ai/library/faces/assign-media', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // Get media library data (all images from all categories and unassigned)
  getMediaLibraryData: async (): Promise<ApiResponse<any>> => {
    console.log('📚 dashboardAPI.getMediaLibraryData: Fetching media library data');
    console.log('📚 API URL: /media');

    return await apiRequest('/media', {
      method: 'GET',
    });
  },

  // ============= Service Sync APIs =============

  // Initiate OAuth connection for a service
  connectService: async (serviceType: string): Promise<ApiResponse<{ auth_url: string }>> => {
    console.log(`🔗 dashboardAPI.connectService: Initiating connection for ${serviceType}`);
    return await apiRequest(`/services/connect/${serviceType}`, {
      method: 'GET',
    });
  },

  // Exchange OAuth token after callback
  exchangeServiceToken: async (serviceType: string, code: string, state?: string): Promise<ApiResponse<any>> => {
    console.log(`🔑 dashboardAPI.exchangeServiceToken: Exchanging token for ${serviceType}`);
    return await apiRequest(`/services/exchange-token/${serviceType}`, {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    });
  },

  // Disconnect a service
  disconnectService: async (userId: number, serviceName: string): Promise<ApiResponse<any>> => {
    console.log(`🔌 dashboardAPI.disconnectService: Disconnecting ${serviceName} for user ${userId}`);
    return await apiRequest(`/services/admin/disconnect`, {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        service_name: serviceName
      }),
    });
  },

  // Trigger sync for a specific service
  syncService: async (serviceType: string): Promise<ApiResponse<{ synced_count: number; message: string }>> => {
    console.log(`🔄 dashboardAPI.syncService: Syncing ${serviceType}`);
    return await apiRequest(`/services/sync/${serviceType}`, {
      method: 'POST',
    });
  },

  // Get connected services status
  getConnectedServices: async (): Promise<ApiResponse<{ services: any[] }>> => {
    console.log('📡 dashboardAPI.getConnectedServices: Fetching connected services');
    return await apiRequest('/user/connected-services', {
      method: 'GET',
    });
  },

  // Get synced media from connected services
  getSyncedMedia: async (serviceType?: string, page: number = 1): Promise<ApiResponse<any>> => {
    console.log('📡 dashboardAPI.getSyncedMedia: Fetching synced media', serviceType ? `for ${serviceType}` : 'for all services', `page ${page}`);
    let url = serviceType ? `/services/synced-media?service=${serviceType}` : '/services/synced-media';
    url += `${serviceType ? '&' : '?'}page=${page}`;
    return await apiRequest(url, {
      method: 'GET',
    });
  },

  // Get fresh media URLs for expired Dropbox/service links
  getFreshMediaUrls: async (mediaIds: string[]): Promise<ApiResponse<any>> => {
    console.log('🔄 dashboardAPI.getFreshMediaUrls: Refreshing URLs for', mediaIds.length, 'media items');
    return await apiRequest('/services/get-fresh-media-urls', {
      method: 'POST',
      body: JSON.stringify({ media_ids: mediaIds }),
    });
  },

  // Resync Dropbox paths (re-fetch all media from Dropbox)
  resyncDropboxPaths: async (): Promise<ApiResponse<any>> => {
    console.log('🔄 dashboardAPI.resyncDropboxPaths: Re-syncing Dropbox media...');
    return await apiRequest('/services/resync-dropbox-paths', {
      method: 'POST',
    });
  },

  // Get Dropbox media IDs
  getDropboxMediaIds: async (): Promise<ApiResponse<any>> => {
    console.log('🔄 dashboardAPI.getDropboxMediaIds: Fetching Dropbox media IDs...');
    return await apiRequest('/services/dropbox-media-ids', {
      method: 'GET',
    });
  },

  // Save synced media from external service (Facebook, etc.)
  saveSyncedMedia: async (data: { service: string; photos: any[]; access_token?: string }): Promise<ApiResponse<any>> => {
    console.log(`💾 dashboardAPI.saveSyncedMedia: Saving ${data.photos.length} photos from ${data.service}`);
    return await apiRequest('/services/save-synced-media', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getNotificationPreferences: async (): Promise<ApiResponse<any>> => {
    console.log('📩 Fetching notification preferences');
    return await apiRequest('/user/notification-preferences', {
      method: 'GET',
    });
  },

  // Update user notification preferences
  updateNotificationPreferences: async (preferences: {
    email_notifications: {
      new_memories: boolean;
      comments: boolean;
    };
    push_notifications: {
      new_memories: boolean;
      comments: boolean;
    };
    moderation_enabled?: boolean;
  }): Promise<ApiResponse<any>> => {
    console.log('📩 Updating notification preferences:', preferences);
    return await apiRequest('/user/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  },

  // Get all properties
  getProperties: async (): Promise<ApiResponse<any>> => {
    console.log('🏠 dashboardAPI.getProperties: Fetching properties');
    return await apiRequest('/properties', {
      method: 'GET',
    });
  },

  // Search properties by name
  searchProperties: async (searchQuery: string): Promise<ApiResponse<any>> => {
    console.log('🔍 dashboardAPI.searchProperties: Searching properties with query:', searchQuery);
    return await apiRequest(`/properties?search=${encodeURIComponent(searchQuery)}`, {
      method: 'GET',
    });
  },

  // Create a new property
  createProperty: async (formData: FormData): Promise<ApiResponse<any>> => {
    console.log('🏠 dashboardAPI.createProperty: Creating new property');
    try {
      const token = localStorage.getItem('stasht_token');

      // Log form data for debugging
      console.log('📝 Form data entries:');
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}:`, value.name, `(${value.size} bytes)`);
        } else {
          console.log(`  ${key}:`, value);
        }
      }

      const response = await fetch(`${API_BASE_URL}/properties`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
        body: formData,
      });

      const data = await response.json();
      console.log('📥 Create property response:', data);

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}`,
          errors: data.errors || null,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('❌ Error creating property:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },

  // Create property invite link
  createPropertyInviteLink: async (propertyId: number): Promise<ApiResponse<any>> => {
    console.log(`🔗 dashboardAPI.createPropertyInviteLink: Creating invite link for property ${propertyId}`);
    return await apiRequest(`/properties/${propertyId}/invite-link`, {
      method: 'GET',
    });
  },

  // Get property memories
  getPropertyMemories: async (propertyId: number, page: number = 1): Promise<ApiResponse<any>> => {
    console.log(`🏠 dashboardAPI.getPropertyMemories: Fetching memories for property ${propertyId}, page ${page}`);
    return await apiRequest(`/properties/${propertyId}/memories?per_page=15&page=${page}`, {
      method: 'GET',
    });
  },

  // Get property by registration token
  getPropertyByToken: async (token: string): Promise<ApiResponse<any>> => {
    return await apiRequest(`/properties/view/${token}`, {
      method: 'GET',
    });
  },

  // Register user for property
  registerPropertyUser: async (token: string, data: { invite_token: string; name: string; email?: string; phone_number?: string; password?: string }): Promise<ApiResponse<any>> => {
    return await apiRequest('/properties/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get personal account invite link (protected)
  getPersonalInviteLink: async (): Promise<ApiResponse<any>> => {
    return await apiRequest('/account/invite-link', { method: 'GET' });
  },

  // Get personal invite info by token (public — no auth needed)
  getPersonalInviteInfo: async (token: string): Promise<ApiResponse<any>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/account/invite-info?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await response.json();
      return response.ok ? { success: true, data: json } : { success: false, error: json.message || json.error || `HTTP ${response.status}` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  // Register via personal account invite (public — no auth needed)
  registerViaPersonalInvite: async (data: { invite_token: string; name: string; email?: string; phone_number?: string; password: string }): Promise<ApiResponse<any>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/account/register-via-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await response.json();
      return response.ok ? { success: true, data: json } : { success: false, error: json.message || json.error || `HTTP ${response.status}` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  // Invite user (registered or not) to a specific memory via property
  inviteToMemory: async (propertyId: number, data: { memory_id: number; email?: string; phone_number?: string }): Promise<ApiResponse<any>> => {
    console.log(`🏠 inviteToMemory: POST /properties/${propertyId}/invite-to-memory`);
    console.log('Payload:', data);
    return await apiRequest(`/properties/${propertyId}/invite-to-memory`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Send invite to non-existing user to join a property
  sendPropertyInvite: async (propertyId: number, data: { email?: string; phone_number?: string }): Promise<ApiResponse<any>> => {
    console.log(`🏠 sendPropertyInvite: POST /properties/${propertyId}/send-invite`);
    console.log('Payload:', data);
    return await apiRequest(`/properties/${propertyId}/send-invite`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Add user (existing or new) to property as collaborator
  addUserToProperty: async (data: { property_id: number; email?: string; phone_number?: string }): Promise<ApiResponse<any>> => {
    console.log('🏠 addUserToProperty: Calling /properties/register');
    console.log('Payload:', data);
    return await apiRequest('/properties/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Check if a user already exists by email or phone
  checkUserExists: async (data: { email?: string; phone_number?: string }): Promise<ApiResponse<{ exists: boolean; first_name?: string; last_name?: string }>> => {
    return await apiRequest('/users/check-exists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Scan all memories for new matches for a given person
  scanFaceMatches: async (personId: string, offset = 0, limit = 50): Promise<ApiResponse<any>> => {
    return await apiRequest('/ai/library/faces/scan', {
      method: 'POST',
      body: JSON.stringify({ person_id: personId, offset, limit }),
    });
  },

  // Merge multiple faces into one primary face
  mergeFaces: async (primaryFaceId: string, faceIds: string[]): Promise<ApiResponse<any>> => {
    return await apiRequest('/ai/face/merge', {
      method: 'POST',
      body: JSON.stringify({ primary_face_id: primaryFaceId, face_ids: faceIds }),
    });
  },

  // Delete an entire face/person from the library
  deleteFace: async (faceId: string): Promise<ApiResponse<any>> => {
    return await apiRequest(`/ai/face/${faceId}`, {
      method: 'DELETE',
    });
  },

  // Delete a specific face photo
  deleteFacePhoto: async (photoId: number | string): Promise<ApiResponse<any>> => {
    return await apiRequest(`/ai/face-photo/${photoId}`, {
      method: 'DELETE',
    });
  },

  // Update property
  updateProperty: async (propertyId: number, formData: FormData): Promise<ApiResponse<any>> => {
    console.log(`🔄 dashboardAPI.updateProperty: Updating property ${propertyId}`);
    try {
      const token = localStorage.getItem('stasht_token');

      if (!token) {
        return {
          success: false,
          error: 'No authentication token found',
        };
      }

      // Log form data for debugging
      console.log('📝 Form data entries:');
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}:`, value.name, `(${value.size} bytes)`);
        } else {
          console.log(`  ${key}:`, value);
        }
      }

      const response = await fetch(`${API_BASE_URL}/properties/${propertyId}/update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
        body: formData,
      });

      const data = await response.json();
      console.log('📥 Update property response:', data);

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('❌ Error updating property:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },

  // Delete property
  deleteProperty: async (propertyId: number): Promise<ApiResponse<any>> => {
    console.log(`🗑️ dashboardAPI.deleteProperty: Deleting property ${propertyId}`);
    return await apiRequest(`/properties/${propertyId}`, {
      method: 'DELETE',
    });
  },

  // Update property status (activate/deactivate)
  updatePropertyStatus: async (propertyId: number, status: boolean): Promise<ApiResponse<any>> => {
    console.log(`🔄 dashboardAPI.updatePropertyStatus: Updating status for property ${propertyId} to ${status}`);
    return await apiRequest(`/properties/${propertyId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  // Purchase property — creates payment intent (Flow 1: multipart with property data, Flow 2: JSON with property_id)
  purchaseProperty: async (data: FormData | { quantity: number; property_id: number }): Promise<ApiResponse<any>> => {
    console.log('💳 dashboardAPI.purchaseProperty: Creating property payment intent');
    try {
      const token = localStorage.getItem('stasht_token');
      const isFormData = data instanceof FormData;

      const response = await fetch(`${API_BASE_URL}/billing/purchase-property`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        },
        body: isFormData ? data : JSON.stringify(data),
      });

      const json = await response.json();
      console.log('💳 purchaseProperty response:', json);

      if (!response.ok) {
        return { success: false, error: json.message || json.error || `HTTP ${response.status}` };
      }

      return { success: true, data: json };
    } catch (error: any) {
      console.error('❌ purchaseProperty error:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  },

  // Confirm property payment after Stripe confirms on frontend
  confirmPropertyPayment: async (paymentIntentId: string): Promise<ApiResponse<any>> => {
    console.log('✅ dashboardAPI.confirmPropertyPayment:', paymentIntentId);
    return await apiRequest('/billing/confirm-property-payment', {
      method: 'POST',
      body: JSON.stringify({ payment_intent_id: paymentIntentId }),
    });
  },

  autoMarkImagesSeen: async (): Promise<ApiResponse<any>> => {
    return await apiRequest('/memories/auto-mark-seen', {
      method: 'POST',
    });
  },

  // ============= DocuSign API =============

  docuSignGetAuthUrl: async (): Promise<ApiResponse<{ auth_url: string }>> => {
    return await apiRequest('/auth/docusign', { method: 'GET' });
  },

  docuSignConnect: async (credentials: { integration_key: string; secret_key: string; account_id: string }): Promise<ApiResponse<any>> => {
    return await apiRequest('/integrations/docusign/connect', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  docuSignGetStatus: async (): Promise<ApiResponse<{ connected: boolean; connected_at?: string }>> => {
    return await apiRequest('/integrations/docusign/status', { method: 'GET' });
  },

  docuSignDisconnect: async (): Promise<ApiResponse<{ success: boolean; message: string }>> => {
    return await apiRequest('/integrations/docusign/disconnect', { method: 'DELETE' });
  },

  docuSignSendEnvelope: async (formData: FormData): Promise<ApiResponse<{ success: boolean; envelope_id: string; status: string }>> => {
    const token = localStorage.getItem('stasht_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const response = await fetch(`${getApiBaseUrl()}/docusign/envelopes`, {
        method: 'POST',
        headers,
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.message || `HTTP ${response.status}` };
      }
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message || 'Network error' };
    }
  },

  docuSignGetEnvelope: async (envelopeId: string): Promise<ApiResponse<any>> => {
    return await apiRequest(`/docusign/envelopes/${envelopeId}`, { method: 'GET' });
  },

  docuSignGetEnvelopes: async (memoryId: string): Promise<ApiResponse<{ envelopes: any[] }>> => {
    return await apiRequest(`/docusign/envelopes?memory_id=${memoryId}`, { method: 'GET' });
  },

  removeLinkedMemory: async (memoryId: string, linkedMemoryId: string): Promise<ApiResponse<any>> => {
    return await apiRequest(`/memories/${memoryId}/linked-memories/${linkedMemoryId}`, { method: 'DELETE' });
  },

  getMemoryDetail: async (memoryId: string): Promise<ApiResponse<any>> => {
    return await apiRequest(`/memory-detail/${memoryId}`, { method: 'GET' });
  },

  reorderPost: async (memoryId: string, postId: string, direction: 'up' | 'down'): Promise<ApiResponse<any>> => {
    return await apiRequest(`/memories/${memoryId}/posts/${postId}/reorder`, { method: 'PUT', body: JSON.stringify({ direction }) });
  },

  reorderLinkedMemory: async (memoryId: string, linkedMemoryId: string, direction: 'up' | 'down'): Promise<ApiResponse<any>> => {
    return await apiRequest(`/memories/${memoryId}/linked-memories/${linkedMemoryId}/reorder`, { method: 'PUT', body: JSON.stringify({ direction }) });
  },
};

// Utility function to check if last sync is older than specified hours
export const isLastSyncOlderThan = (lastSync: string | null | undefined, hours: number = 4): boolean => {
  if (!lastSync) {
    console.log('⏰ No last_sync value, treating as outdated');
    return true; // If no last sync, treat as outdated
  }

  try {
    let diffInHours = 0;

    // Check if it's a relative time string like "2 minutes ago", "just now", etc.
    const relativeTimeMatch = lastSync.match(/^(\d+)\s+(second|minute|hour|day|week|month)s?\s+ago$/i);
    const justNowMatch = lastSync.match(/^just now$/i);

    if (justNowMatch) {
      // "just now" = 0 hours
      diffInHours = 0;
      console.log('⏰ Last sync was "just now", treating as < 4 hours');
    } else if (relativeTimeMatch) {
      // Parse relative time string
      const value = parseInt(relativeTimeMatch[1], 10);
      const unit = relativeTimeMatch[2].toLowerCase();

      console.log('⏰ Parsing relative time:', { value, unit });

      // Convert to hours
      switch (unit) {
        case 'second':
          diffInHours = value / 3600;
          break;
        case 'minute':
          diffInHours = value / 60;
          break;
        case 'hour':
          diffInHours = value;
          break;
        case 'day':
          diffInHours = value * 24;
          break;
        case 'week':
          diffInHours = value * 24 * 7;
          break;
        case 'month':
          diffInHours = value * 24 * 30; // Approximate
          break;
      }

      console.log('⏰ Relative time check:', {
        lastSync,
        parsedValue: value,
        parsedUnit: unit,
        diffInHours: diffInHours.toFixed(2),
        threshold: hours,
        isOlder: diffInHours >= hours
      });
    } else {
      // Try parsing as ISO date/timestamp
      const lastSyncDate = new Date(lastSync);

      if (isNaN(lastSyncDate.getTime())) {
        console.warn('⏰ Unable to parse last_sync as date or relative time:', lastSync);
        return true; // Treat as outdated if we can't parse it
      }

      const now = new Date();
      const diffInMs = now.getTime() - lastSyncDate.getTime();
      diffInHours = diffInMs / (1000 * 60 * 60);

      console.log('⏰ Timestamp check:', {
        lastSync,
        lastSyncDate: lastSyncDate.toISOString(),
        now: now.toISOString(),
        diffInHours: diffInHours.toFixed(2),
        threshold: hours,
        isOlder: diffInHours >= hours
      });
    }

    return diffInHours >= hours;
  } catch (error) {
    console.error('⏰ Error parsing last_sync date:', error);
    return true; // On error, treat as outdated to trigger resync
  }
};

// Utility functions for user display
export const userDisplayUtils = {
  // Generate user initials from name
  generateInitials: (name: string): string => {
    if (!name || typeof name !== 'string') {
      return '';
    }
    
    return name
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => word[0].toUpperCase())
      .slice(0, 2) // Take first 2 initials
      .join('');
  },

  // Format profile_color - add # if missing (matching header implementation)
  formatProfileColor: (color?: string): string | null => {
    if (!color) return null;
    return color.startsWith('#') ? color : `#${color}`;
  },

  // Generate a consistent color based on username for avatars
  generateAvatarColor: (name: string): string => {
    const colors = [
      '#E74C3C', // Dark Red
      '#27AE60', // Dark Green
      '#3498DB', // Dark Blue
      '#9B59B6', // Dark Purple
      '#F39C12', // Dark Orange
      '#1ABC9C', // Dark Teal
      '#2C3E50', // Dark Blue Gray
      '#8E44AD', // Dark Violet
      '#16A085', // Dark Turquoise
      '#2980B9', // Dark Cerulean
      '#C0392B', // Dark Crimson
      '#D35400', // Dark Pumpkin
      '#7F8C8D', // Dark Gray
      '#34495E', // Dark Slate
      '#8B4513'  // Dark Saddle Brown
    ];

    if (!name) return colors[0];

    // Create a simple hash from the name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Use the hash to pick a color
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  },

  // Get user display color matching header implementation
  getUserDisplayColor: (user?: { profile_color?: string; name?: string }): string => {
    const profileColor = userDisplayUtils.formatProfileColor(user?.profile_color);
    if (profileColor) {
      return profileColor;
    }

    // Generate consistent color based on username
    if (user?.name) {
      return userDisplayUtils.generateAvatarColor(user.name);
    }

    // Fallback to default primary color (matching header gradient start color)
    return '#6C60FF';
  }
};

// Services API - Connected services (Dropbox, Google Drive, etc.) management
export const servicesAPI = {
  // Delete synced media from connected services (batch delete)
  deleteSyncedMediaBatch: async (mediaIds: number[]) => {
    try {
      console.log('📡 servicesAPI.deleteSyncedMediaBatch called with:', mediaIds);

      const token = tokenUtils.getToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const requestBody = { media_ids: mediaIds };
      console.log('📡 Request URL:', `${API_BASE_URL}/services/synced-media/delete-multiple`);
      console.log('📡 Request body:', requestBody);

      const response = await fetch(`${API_BASE_URL}/services/synced-media/delete-multiple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('📡 Error response:', errorData);
        throw new Error(errorData.message || `Failed to delete synced media: ${response.status}`);
      }

      const data = await response.json();
      console.log('📡 Success response:', data);
      return data;
    } catch (error) {
      console.error('❌ Error deleting synced media:', error);
      throw error;
    }
  },

  // ========================================
  // Google Authentication APIs
  // ========================================

  // Get Google OAuth URL for login/signup
  getGoogleAuthUrl: async (intent: 'login' | 'signup' = 'login'): Promise<ApiResponse<{ auth_url: string }>> => {
    console.log(`🔐 dashboardAPI.getGoogleAuthUrl: Getting Google auth URL for ${intent}`);
    try {
      const response = await fetch(`${API_BASE_URL}/react/auth/google/url?intent=${intent}`, {
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
  googleAuthCallback: async (code: string, state: string): Promise<ApiResponse<{ user: any; token: string; has_memory: number; message: string }>> => {
    console.log('🔐 dashboardAPI.googleAuthCallback: Handling Google OAuth callback');
    try {
      const response = await fetch(`${API_BASE_URL}/react/auth/google/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error in Google auth callback:', error);
      throw error;
    }
  },

  // Link Google account to existing user
  linkGoogleAccount: async (code: string): Promise<ApiResponse<{ message: string }>> => {
    console.log('🔗 dashboardAPI.linkGoogleAccount: Linking Google account');
    try {
      const token = localStorage.getItem('stasht_token');
      const response = await fetch(`${API_BASE_URL}/react/auth/google/link`, {
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
    console.log('🔗 dashboardAPI.unlinkGoogleAccount: Unlinking Google account');
    try {
      const token = localStorage.getItem('stasht_token');
      const response = await fetch(`${API_BASE_URL}/react/auth/google/unlink`, {
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
  getGooglePhotosAuthUrl: async (): Promise<ApiResponse<{ auth_url: string; message: string }>> => {
    console.log('📸 dashboardAPI.getGooglePhotosAuthUrl: Getting Google Photos auth URL');
    try {
      const token = localStorage.getItem('stasht_token');
      const response = await fetch(`${API_BASE_URL}/react/auth/google/photos/url`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error getting Google Photos auth URL:', error);
      throw error;
    }
  },

  // Handle Google Photos OAuth callback
  googlePhotosCallback: async (code: string): Promise<ApiResponse<{ message: string; service: any }>> => {
    console.log('📸 dashboardAPI.googlePhotosCallback: Handling Google Photos callback');
    try {
      const token = localStorage.getItem('stasht_token');
      const response = await fetch(`${API_BASE_URL}/react/auth/google/photos/callback`, {
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

};

export default {
  authAPI,
  dashboardAPI,
  servicesAPI,
  tokenUtils,
  userUtils,
  validationUtils,
  userDisplayUtils,
};