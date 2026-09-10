// Auth utility functions for API integration

// Dev-only logging. Silenced in production builds so the app ships without the
// heavy per-request debug spew described in PERFORMANCE_OPTIMIZATION_PLAN.md #5
// (every apiRequest was decoding the JWT and emitting ~10 console lines). Function
// declaration (hoisted) so it's safe to call from anywhere in this module.
// NOTE: console.error / console.warn are intentionally left as-is — real error
// reporting should still surface in production.
function devLog(...args: any[]): void {
  // eslint-disable-next-line no-console
  if (import.meta.env.DEV) console.log(...args);
}

export interface LoginCredentials {
  email?: string;
  password?: string;          // optional — passwordless login uses verification_token instead
  phone_number?: string;
  verification_token?: string; // from /verify-otp, for passwordless login
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
  password?: string;          // optional — OTP-only signup omits it
  name: string;
  phone_number?: string;
  // Single-use token returned by /verify-otp. When present, backend creates the
  // account already-activated (no activation email / phone OTP step).
  verification_token?: string;
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
    devLog('🔍 Development mode: Using proxy for API requests');
    return '/api/react';
  }

  // Production fallback: assume same domain with /api prefix
  return `${window.location.origin}/api/react`;
};

export const API_BASE_URL = getApiBaseUrl();

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
// Rate-limit (429) retry policy, shared by every call that goes through apiRequest.
const RATE_LIMIT_STATUS = 429;
const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_RATE_LIMIT_BACKOFF_MS = 30000;

// Separate, smaller retry budget for raw network-level failures (connection
// dropped mid-upload, DNS hiccup, etc.) — these throw before any Response
// exists, so they can't be told apart from a real outage by status code.
// A short, capped retry catches the common transient case (slow/flaky mobile
// upload getting cut off) without masking a genuine, sustained failure.
const MAX_NETWORK_RETRIES = 2;
const NETWORK_RETRY_BACKOFF_MS = [1000, 3000];

// Browsers report a dropped/failed fetch with different messages: Chrome/Edge
// throw "Failed to fetch", Firefox "NetworkError when attempting to fetch
// resource", Safari "Load failed". None of these are HTTP statuses — the
// request never got a response — so they're matched on the thrown error text.
const isRetryableNetworkError = (error: unknown): boolean => {
  if (!(error instanceof TypeError)) return false;
  const message = error.message.toLowerCase();
  return message.includes('failed to fetch') ||
         message.includes('network error') ||
         message.includes('load failed') ||
         message.includes('network request failed');
};

// A 429 comes from the throttle middleware, which rejects the request before it
// reaches the controller — nothing was processed, so retrying is safe even for
// writes. Honour Retry-After when the server sends it, otherwise back off
// exponentially with a little jitter so a burst of parallel callers doesn't
// retry in lockstep. Capped, so a sustained limit still fails rather than hanging.
//
// Also retries genuine network-level failures (connection dropped before any
// response arrived — e.g. a slow mobile upload getting cut off mid-transfer).
// Safe to retry even for writes: no response means the server either never
// received the request or the client never learned the outcome either way,
// and re-sending the same FormData is a no-op on the wire until it succeeds.
//
// Exported so raw fetch() calls that can't go through apiRequest — multipart
// FormData uploads, where apiRequest's JSON-only body handling doesn't fit
// (uploadImageWithMetadata, mediaAPI.addMoment) — get the same retry behavior
// instead of failing outright on a transient rate-limit hit or dropped connection.
export const fetchWithRateLimitRetry = async (url: string, init: RequestInit): Promise<Response> => {
  let response: Response;
  for (let attempt = 0; ; attempt++) {
    try {
      response = await fetch(url, init);
    } catch (error) {
      if (!isRetryableNetworkError(error) || attempt >= MAX_NETWORK_RETRIES) throw error;

      const waitMs = NETWORK_RETRY_BACKOFF_MS[attempt] ?? NETWORK_RETRY_BACKOFF_MS[NETWORK_RETRY_BACKOFF_MS.length - 1];
      console.warn(`⚠️ Network error on ${url} (${(error as Error).message}) — retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_NETWORK_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    if (response.status !== RATE_LIMIT_STATUS || attempt >= MAX_RATE_LIMIT_RETRIES) break;

    const retryAfterSec = Number(response.headers.get('Retry-After'));
    const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
      ? Math.min(retryAfterSec * 1000, MAX_RATE_LIMIT_BACKOFF_MS)
      : Math.min(1000 * 2 ** attempt, MAX_RATE_LIMIT_BACKOFF_MS) + Math.random() * 250;

    console.warn(`⏳ 429 from ${url} — retrying in ${Math.round(waitMs)}ms (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return response;
};

// ── GET de-duplication + short-TTL response cache ─────────────────────────
// A single navigation mounts several components that each independently fetch
// the same shared data (e.g. the sidebar, the page, and a modal all GET
// /user/collaborators-and-non-collaborators), so one page load fires the same
// GET 2-3x. Against the server's per-minute throttle that burns the budget fast
// and surfaces as "Invalid response format from server (429)". Two transparent,
// read-only optimisations collapse the waste without changing any call site:
//   1. In-flight de-duplication — identical GETs issued while one is already
//      pending share that single network request (kills the concurrent 3x/2x).
//   2. Short-TTL cache — a GET repeated within GET_CACHE_TTL_MS (a quick tab
//      switch back, a staggered second mount) is served from memory.
// Only GETs are ever cached/de-duped; every successful write clears the cache so
// mutations are reflected immediately on the next read. Cache keys are namespaced
// by a fingerprint of the auth token so a login/logout or "log in as user" switch
// can never serve one user data cached for another.
const GET_CACHE_TTL_MS = 15000;

type CachedGet = { response: ApiResponse<any>; expiresAt: number };

const inFlightGets = new Map<string, Promise<ApiResponse<any>>>();
const getCache = new Map<string, CachedGet>();

const cacheKeyFor = (endpoint: string): string => {
  const token = tokenUtils.getToken();
  const ns = token ? token.slice(-16) : 'anon';
  return `${ns}::${endpoint}`;
};

// Return a copy so a caller mutating the result can't corrupt the shared cached
// object (and thus the next caller's data). API payloads are JSON, so a
// structured/JSON clone is always safe.
const cloneResponse = <T>(res: ApiResponse<T>): ApiResponse<T> => {
  try {
    return structuredClone(res);
  } catch {
    try { return JSON.parse(JSON.stringify(res)); } catch { return res; }
  }
};

// Exported so writes elsewhere (and logout) can force subsequent reads to be
// fresh. Called automatically after every successful non-GET request below.
export const clearApiCache = (): void => {
  getCache.clear();
};

export const apiRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  // Opt-out for callers that must always hit the wire (e.g. an explicit
  // "refresh" with no preceding write). Ignored by fetch itself.
  const skipCache = (options as any).skipCache === true;

  // Writes never come from cache and invalidate it so the next read is fresh.
  if (!isGet) {
    const result = await performApiRequest<T>(endpoint, options);
    if (result.success) clearApiCache();
    return result;
  }

  if (skipCache) {
    return performApiRequest<T>(endpoint, options);
  }

  const key = cacheKeyFor(endpoint);

  const cached = getCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cloneResponse(cached.response) as ApiResponse<T>;
  }

  const pending = inFlightGets.get(key);
  if (pending) {
    return cloneResponse(await pending) as ApiResponse<T>;
  }

  const promise = performApiRequest<T>(endpoint, options)
    .then((result) => {
      // Only successful reads are cached — never errors, 401s or 429s.
      if (result.success) {
        getCache.set(key, { response: result, expiresAt: Date.now() + GET_CACHE_TTL_MS });
      }
      return result;
    })
    .finally(() => {
      inFlightGets.delete(key);
    });

  inFlightGets.set(key, promise);
  return cloneResponse(await promise) as ApiResponse<T>;
};

const performApiRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  try {
    // Check if token is expired before making the request
    const token = tokenUtils.getToken();
    devLog(`🔍 API Request to ${endpoint}:`, {
      endpoint,
      tokenExists: !!token,
      tokenLength: token?.length || 0,
      fullURL: `${API_BASE_URL}${endpoint}`,
      headers: getAuthHeaders()
    });

    if (token && tokenUtils.isTokenExpired(token)) {
      devLog('Token expired, clearing auth data');
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

    const response = await fetchWithRateLimitRetry(`${API_BASE_URL}${finalEndpoint}`, {
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
      devLog(`🔍 API Response Text for ${endpoint}:`, responseText);
      devLog(`🔍 Response Status: ${response.status} ${response.statusText}`);
      devLog(`🔍 Response OK: ${response.ok}`);

      if (responseText.trim() === '') {
        devLog('🔍 Empty response received');
        // Handle specific HTTP error codes
        if (response.status === 500) {
          devLog('🔍 HTTP 500 with empty response - likely backend server unavailable');
          const isDevelopment = import.meta.env.DEV;
          const devMessage = isDevelopment
            ? ' (Development: Check if the Laravel backend server is running at localhost/stasht-for-multiple-admins/public)'
            : '';

          data = {
            success: false,
            error: `Backend server is currently unavailable. Please try again later or contact support.${devMessage}`
          };
        } else if (response.status >= 400 && response.status < 500) {
          devLog('🔍 HTTP 4xx with empty response - client error');
          data = {
            success: false,
            error: `Request failed (${response.status}). Please check your input and try again.`
          };
        } else if (response.ok) {
          devLog('🔍 Empty response with OK status - treating as successful empty response');
          data = { success: true };
        } else {
          devLog('🔍 Empty response with error status - treating as error');
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
            devLog('🔍 Response is not JSON but status is OK, treating as plain text data');
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
        devLog('🔒 Authentication error detected:', data);
        devLog('Automatically logging out user due to authentication failure');

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
      devLog('Received 401 Unauthorized for endpoint:', endpoint);

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
        devLog('Critical endpoint failed, clearing auth data and reloading');
        userUtils.clearAuthData();
        // Force page reload to clear all state and redirect to login
        setTimeout(() => {
          window.location.href = '/login'; // Redirect directly to login page
        }, 100);
      } else {
        devLog('Optional endpoint or OAuth callback failed, not triggering logout');
      }

      return {
        success: false,
        error: isOAuthCallback ? 'OAuth authentication failed' : 'Authentication failed. Please log in again.',
      };
    }

    if (!response.ok) {
      // Still throttled after every retry — say so plainly rather than "HTTP 429",
      // which reads as a crash to the user.
      if (response.status === RATE_LIMIT_STATUS) {
        console.warn(`🚦 Rate limited on ${endpoint} after ${MAX_RATE_LIMIT_RETRIES} retries`);
        return {
          success: false,
          error: 'Too many requests right now. Please wait a moment and try again.',
          message: data?.message,
          rateLimited: true,
          statusCode: RATE_LIMIT_STATUS,
        } as ApiResponse<T>;
      }

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
      devLog('authAPI.login: Sending request to /login with credentials:', {
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

      devLog('authAPI.login: Full API Response:', JSON.stringify(response, null, 2));

      // NEW DEVICE VERIFICATION: Check if OTP is required before any other checks
      // Check both top level and nested data structure
      const requiresVerification = response.requires_verification === true || response.data?.requires_verification === true;
      const attemptId = response.attempt_id || response.data?.attempt_id;

      if (requiresVerification && attemptId) {
        devLog('🔐 authAPI.login: Device verification required - OTP sent');
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

        const ownedProperties = data.owned_properties || data.data?.owned_properties || (response as any).owned_properties || [];

        const sharedProperties = data.shared_properties || data.data?.shared_properties || [];

        if (user && token) {
          devLog('✅ authAPI.login: Found user and token in response!');
          devLog('✅ authAPI.login: Collaborators found:', collaborators);
          devLog('✅ authAPI.login: User object:', user);
          devLog('✅ authAPI.login: User location:', user.location);

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
        devLog('authAPI.login: Conflict detected - user already logged in');
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
      devLog('🔍 authAPI.login: Checking activation error...');
      devLog('🔍 authAPI.login: Full response structure:', JSON.stringify(response, null, 2));
      devLog('🔍 authAPI.login: activationError found:', activationError);
      devLog('🔍 authAPI.login: response.success:', response.success);

      // Check for activation error - handle cases where success is not explicitly false
      if (activationError) {
        devLog('🎯 authAPI.login: Account activation required -', activationError);
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
          devLog('authAPI.login: Found user and token in response.data.data');
          const collaborators = apiData.collaborators || response.data.collaborators || response.collaborators || [];
          devLog('authAPI.login: Collaborators found:', collaborators);
          return {
            success: true,
            user: apiData.user,
            token: apiData.token,
            collaborators: collaborators,
            owned_properties: apiData.owned_properties || response.data.owned_properties || (response as any).owned_properties || [],
          };
        }
      }

      // Handle your API's response structure (single nested)
      if (response.success && response.data && response.data.token && response.data.user) {
        devLog('authAPI.login: Found user and token in response.data');
        const collaborators = response.data.collaborators || response.collaborators || [];
        devLog('authAPI.login: Collaborators found:', collaborators);
        return {
          success: true,
          user: response.data.user,
          token: response.data.token,
          collaborators: collaborators,
          owned_properties: response.data.owned_properties || (response as any).owned_properties || [],
        };
      }

      // Handle direct response (not wrapped in data) - cast to any for legacy support
      const responseAny = response as any;
      if (responseAny.token && responseAny.user) {
        devLog('authAPI.login: Found user and token at root level');
        const collaborators = responseAny.collaborators || [];
        devLog('authAPI.login: Collaborators found:', collaborators);
        return {
          success: true,
          user: responseAny.user,
          token: responseAny.token,
          collaborators: collaborators,
          owned_properties: responseAny.owned_properties || [],
        };
      }

      // Handle success flag with data (fallback)
      if (response.success && response.data) {
        devLog('authAPI.login: Using fallback - returning response.data');
        const dataToCheck = response.data.data || response.data;
        if (dataToCheck.token && dataToCheck.user) {
          const collaborators = dataToCheck.collaborators || response.data.collaborators || response.collaborators || [];
          devLog('authAPI.login: Collaborators found:', collaborators);
          return {
            success: true,
            user: dataToCheck.user,
            token: dataToCheck.token,
            collaborators: collaborators,
            owned_properties: dataToCheck.owned_properties || response.data.owned_properties || (response as any).owned_properties || [],
          };
        }
      }

      // Handle response with status - cast to any for legacy support
      if (responseAny.status === 'success' && responseAny.token) {
        const collaborators = responseAny.collaborators || [];
        devLog('authAPI.login: Collaborators found:', collaborators);
        return {
          success: true,
          user: responseAny.user || {
            id: '1',
            email: credentials.email,
            name: credentials.email.split('@')[0],
          },
          token: responseAny.token,
          collaborators: collaborators,
          owned_properties: responseAny.owned_properties || [],
        };
      }

      // Last resort: If response looks successful but we couldn't parse it, log and return failure
      devLog('❌ authAPI.login: Could not parse login response!');
      devLog('❌ None of the expected response formats matched');
      devLog('❌ Response keys:', Object.keys(response));
      devLog('❌ Response.success:', response.success);
      devLog('❌ Response.data keys:', response.data ? Object.keys(response.data) : 'no data');

      // Emergency fallback: Try to find user and token anywhere in the response
      if (response.success) {
        devLog('⚠️ Attempting emergency fallback parsing...');
        devLog('⚠️ response.data full object:', JSON.stringify(response.data, null, 2));

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

        devLog('⚠️ Emergency search results:');
        devLog('⚠️ - Found token:', !!foundToken);
        devLog('⚠️ - Found user:', !!foundUser);

        if (foundToken && foundUser) {
          devLog('✅ Emergency fallback succeeded! Found token and user');
          // Try to find collaborators in the response
          const collaborators = response.data?.collaborators || response.collaborators || [];
          devLog('authAPI.login: Collaborators found:', collaborators);
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
      devLog('authAPI.register: Sending request to /signup with credentials:', { 
        name: credentials.name, 
        email: credentials.email 
      });
      
      const response = await apiRequest<any>('/signup', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      devLog('authAPI.register: Full API Response:', JSON.stringify(response, null, 2));

      // Robust extraction first — token/user may sit at any of these locations
      // (covers OTP-verified signup that returns a session token, same as /login)
      {
        const d: any = response.data || {};
        const u = d.user || d.data?.user || (response as any).user;
        const t = d.token || d.access_token || d.data?.token || d.data?.access_token || (response as any).token;
        if (response.success && u && t) {
          devLog('authAPI.register: Found user and token (robust extraction)');
          return { success: true, user: u, token: t };
        }
      }

      // Handle your API's specific response structure (same as login)
      if (response.success && response.data && response.data.success && response.data.data) {
        const apiData = response.data.data;
        if (apiData.token && apiData.user) {
          devLog('authAPI.register: Found user and token in response.data.data');
          return {
            success: true,
            user: apiData.user,
            token: apiData.token,
          };
        }
      }

      // Handle your API's response structure (single nested)
      if (response.success && response.data && response.data.token && response.data.user) {
        devLog('authAPI.register: Found user and token in response.data');
        return {
          success: true,
          user: response.data.user,
          token: response.data.token,
        };
      }

      // Handle direct response (not wrapped in data) - cast to any for legacy support
      const responseAny = response as any;
      if (responseAny.token && responseAny.user) {
        devLog('authAPI.register: Found user and token at root level');
        return {
          success: true,
          user: responseAny.user,
          token: responseAny.token,
        };
      }

      // Handle activation flow (no token, just message)
      if (response.success && response.data && response.data.message) {
        devLog('authAPI.register: Activation flow detected - user needs to activate account');
        const userData = response.data.data?.user || response.data.user;
        // Extract collaborators from response
        const collaborators = response.data.collaborators || response.data.data?.collaborators || response.collaborators || [];
        devLog('authAPI.register: Collaborators found:', collaborators);
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
        devLog('authAPI.register: Success with no data - likely activation flow');
        return {
          success: true,
          message: 'Registration successful! Please check your email for activation instructions.',
          requiresActivation: true
        } as any;
      }

      // Handle success flag with data (fallback for direct login)
      if (response.success && response.data) {
        devLog('authAPI.register: Using fallback - returning response.data');
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
        devLog('authAPI.register: Validation errors detected:', response.errors);
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
      devLog('authAPI.checkAuth: Checking authentication status');
      const response = await apiRequest<{ isAuthenticated: boolean; user?: any }>('/auth/check', {
        method: 'GET',
      });

      devLog('authAPI.checkAuth: Server response:', response);
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
      devLog('authAPI.logout: Calling logout API endpoint');
      devLog('authAPI.logout: Request details:', {
        url: '/user/logout',
        method: 'POST',
        headers: getAuthHeaders(),
      });

      // Create a timeout promise that resolves after 3 seconds
      const timeoutPromise = new Promise<ApiResponse>((resolve) => {
        setTimeout(() => {
          devLog('authAPI.logout: Request timed out after 3 seconds, proceeding with local logout');
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

      devLog('authAPI.logout: Server response:', response);

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
    devLog('authAPI.changePassword: Sending PUT request to /user/change-password');
    devLog('Request data:', {
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
      devLog('🚀 authAPI.activateAccount: Starting activation process');
      devLog('🔑 Token:', token);
      devLog('🔑 Token length:', token.length);
      devLog('🌐 API Base URL:', API_BASE_URL);
      devLog('🌐 Full URL:', `${API_BASE_URL}/activate-account/${token}`);
      
      const response = await fetch(`${API_BASE_URL}/activate-account/${token}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      devLog('📡 HTTP Response Status:', response.status);
      devLog('📡 HTTP Response OK:', response.ok);
      devLog('📡 HTTP Response Status Text:', response.statusText);

      const data = await response.json();
      devLog('📦 authAPI.activateAccount: Full response received:', JSON.stringify(data, null, 2));
      
      if (data.success && data.data) {
        // Successful activation with user data and token
        devLog('authAPI.activateAccount: Activation successful');
        // Extract collaborators from response
        const collaborators = data.data.collaborators || data.collaborators || [];
        devLog('authAPI.activateAccount: Collaborators found:', collaborators);
        // Extract partial admin access — same field the login API returns
        const partialAdminAccess = data.data.partial_admin_access || data.partial_admin_access || [];
        devLog('authAPI.activateAccount: Partial admin access found:', partialAdminAccess);
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
      devLog('🚀🚀🚀 ===== authAPI.verifyPhoneOtp: STARTING OTP VERIFICATION =====');
      devLog('📞 Phone number:', phone_number);
      devLog('🔢 OTP:', otp);
      devLog('🌐 API URL:', `${API_BASE_URL}/verify-phone-otp`);
      devLog('📤 Request body:', JSON.stringify({ phone_number, otp }, null, 2));

      const response = await apiRequest<any>('/verify-phone-otp', {
        method: 'POST',
        body: JSON.stringify({ phone_number, otp }),
      });

      devLog('📡📡📡 ===== authAPI.verifyPhoneOtp: RAW API RESPONSE =====');
      devLog('🔍 Full Response Object:', JSON.stringify(response, null, 2));
      devLog('✅ response.success:', response.success);
      devLog('🗂️ response.data:', response.data);
      devLog('❌ response.error:', response.error);
      devLog('📄 response.message:', response.message);
      devLog('🔍 Response keys:', Object.keys(response));

      // Handle successful verification with token and user
      if (response.success && response.data) {
        devLog('✅ Response has success=true and data field');
        const data = response.data.data || response.data;
        devLog('📦 Extracted data:', JSON.stringify(data, null, 2));
        devLog('🔑 data.token:', data.token);
        devLog('👤 data.user:', data.user);

        if (data.token && data.user) {
          devLog('✅✅✅ OTP VERIFIED SUCCESSFULLY');
          devLog('👤 User ID:', data.user.id);
          devLog('👤 User Email:', data.user.email);
          devLog('👤 User Name:', data.user.name);
          devLog('👤 User Role:', data.user.role);
          devLog('🔑 Token length:', data.token.length);
          devLog('📤 Returning success response with user and token');

          return {
            success: true,
            user: data.user,
            token: data.token,
          };
        } else {
          devLog('❌ Missing token or user in data');
          devLog('  - data.token exists:', !!data.token);
          devLog('  - data.user exists:', !!data.user);
        }
      } else {
        devLog('❌ Response does not have success=true or missing data');
        devLog('  - response.success:', response.success);
        devLog('  - response.data exists:', !!response.data);
      }

      // Handle error response
      devLog('❌❌❌ OTP VERIFICATION FAILED');
      const errorMsg = response.error || response.message || 'OTP verification failed';
      devLog('📤 Returning error response:', errorMsg);

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
      devLog('🚀🚀🚀 ===== authAPI.resendPhoneOtp: STARTING RESEND OTP =====');
      devLog('📞 Phone number:', phone_number);
      devLog('🌐 API URL:', `${API_BASE_URL}/resend-phone-otp`);
      devLog('📤 Request body:', JSON.stringify({ phone_number }, null, 2));

      const response = await apiRequest<any>('/resend-phone-otp', {
        method: 'POST',
        body: JSON.stringify({ phone_number }),
      });

      devLog('📡📡📡 ===== authAPI.resendPhoneOtp: RAW API RESPONSE =====');
      devLog('🔍 Full Response Object:', JSON.stringify(response, null, 2));
      devLog('✅ response.success:', response.success);
      devLog('📄 response.message:', response.message);
      devLog('❌ response.error:', response.error);

      if (response.success) {
        devLog('✅✅✅ OTP RESENT SUCCESSFULLY');
        return {
          success: true,
          message: response.message || 'OTP has been resent to your phone number',
        };
      }

      devLog('❌ RESEND OTP FAILED');
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

  // ============================================================
  // Verified signup / OTP-based auth (public endpoints)
  // Flow: sendOtp -> verifyOtp (returns verification_token) -> register/login
  // ============================================================

  // Send a 6-digit OTP. Pass ONLY one identifier — { email } or { phone_number } (E.164).
  // purpose: "register" (signup screen) or "login" (login screen).
  sendOtp: async (
    identifier: { email?: string; phone_number?: string },
    purpose: 'register' | 'login' = 'register'
  ): Promise<{ success: boolean; message?: string; channel?: string; error?: string; alreadyRegistered?: boolean; noAccount?: boolean }> => {
    try {
      devLog('📨 authAPI.sendOtp: requesting OTP for', identifier, 'purpose:', purpose);
      const response: any = await apiRequest<any>('/send-otp', {
        method: 'POST',
        body: JSON.stringify({ ...identifier, purpose }),
      });
      devLog('📨 authAPI.sendOtp: response', JSON.stringify(response, null, 2));

      if (response.success) {
        return {
          success: true,
          message: response.message,
          channel: response.channel || response.data?.channel,
        };
      }

      const msg = (response.message || response.error || '').toLowerCase();
      // 409 (register) → already registered → caller should switch to login
      const alreadyRegistered = msg.includes('already registered');
      // 404 (login) → no account → caller should switch to registration
      const noAccount = msg.includes('no account') || msg.includes('not registered') || msg.includes('not found');

      return {
        success: false,
        error: response.message || response.error || 'Failed to send OTP. Please try again.',
        alreadyRegistered,
        noAccount,
      };
    } catch (error) {
      console.error('❌ authAPI.sendOtp: exception', error);
      return { success: false, error: 'Network error occurred' };
    }
  },

  // Exchange an SSO code (from /sso#code=...) for a session.
  // Uses the SAME base URL as every other API (route lives under /api/react).
  ssoExchange: async (
    code: string
  ): Promise<{ success: boolean; user?: any; token?: string; error?: string }> => {
    try {
      devLog('🔑 authAPI.ssoExchange: exchanging SSO code');
      // PUBLIC endpoint on the SSO backend — must NOT send an Authorization header
      // (a stale stasht_token Bearer makes the backend 401 the exchange).
      // NOTE: this backend returns the USER ONLY (no token). We then run that user
      // through the normal /login API to obtain a real session token.
      // Call the SSO backend directly. It returns CORS headers (Access-Control-Allow-Origin: *),
      // so a direct cross-origin request works in both dev and production. We intentionally do
      // NOT proxy this through nginx/Apache — that vhost can't reverse-proxy to an HTTPS target
      // and returns 500.
      const res = await fetch('https://mobile-api.stasht.com/public/api/sso/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const response: any = await res.json().catch(() => ({}));
      devLog('🔑 authAPI.ssoExchange: response', JSON.stringify(response, null, 2));

      // Exchange returns the user only (may sit flat or nested) — no token here.
      const user = response.user || response.data?.user || response.data || response;
      const email = user?.email;

      if (!email) {
        console.error('❌ authAPI.ssoExchange: no user/email in exchange response');
        return {
          success: false,
          error: response.message || response.error || 'SSO exchange failed: no user',
        };
      }

      // Step 2: convert the SSO-verified user into a real session via the normal
      // login API (fixed SSO password agreed with backend).
      devLog('🔑 authAPI.ssoExchange: logging in SSO user via /login:', email);
      const loginRes: any = await authAPI.login({ email, password: 'WorksDelight@2025' });

      if (loginRes.success && loginRes.user && loginRes.token) {
        return { success: true, user: loginRes.user, token: loginRes.token };
      }

      return {
        success: false,
        error: loginRes.error || loginRes.message || 'SSO login failed',
      };
    } catch (error) {
      console.error('❌ authAPI.ssoExchange: exception', error);
      return { success: false, error: 'Network error occurred' };
    }
  },

  // NEW SSO (single-call): exchange a one-time SSO code for a full session.
  // POST /api/react/sso/exchange { code } → the standard login-success payload
  // (same shape as /login: token + user + collaborators + properties). Persist
  // the returned token exactly like a normal login.
  //
  // Uses a RAW fetch (not apiRequest) on purpose: apiRequest auto-redirects to
  // /login on any 401, but an expired/invalid code returns 401 and we must surface
  // that to the caller (show an error, no redirect loop). No Authorization header —
  // the single-use code alone authenticates the exchange.
  ssoLoginExchange: async (code: string): Promise<LoginResponse> => {
    try {
      devLog('🔑 authAPI.ssoLoginExchange: exchanging SSO code (single-call)');

      const res = await fetch(`${API_BASE_URL}/exchange-code-app`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      let response: any = {};
      try {
        response = await res.json();
      } catch {
        response = {};
      }
      devLog('🔑 authAPI.ssoLoginExchange: status', res.status, 'response', JSON.stringify(response, null, 2));

      // Locate user + token wherever the standard payload places them
      // (mirrors authAPI.login's extraction).
      const data = response.data || response;
      const user = data.user || data.data?.user || response.user;
      const token =
        data.token || data.access_token || data.data?.token || data.data?.access_token || response.token;

      if (res.ok && user && token) {
        const collaborators =
          data.collaborators || data.data?.collaborators || response.collaborators || [];
        const ownedProperties =
          data.owned_properties || data.data?.owned_properties || (response as any).owned_properties || [];
        const sharedProperties =
          data.shared_properties || data.data?.shared_properties || [];

        devLog('✅ authAPI.ssoLoginExchange: found user and token');
        return {
          success: true,
          user,
          token,
          collaborators,
          owned_properties: ownedProperties,
          shared_properties: sharedProperties,
        };
      }

      // Failure: 401 expired/invalid code, or an unparseable payload.
      console.warn('❌ authAPI.ssoLoginExchange: exchange failed', res.status);
      return {
        success: false,
        error: response.message || response.error || 'Invalid or expired login link.',
      };
    } catch (error) {
      console.error('❌ authAPI.ssoLoginExchange: exception', error);
      return { success: false, error: 'Network error occurred' };
    }
  },

  // Verify the OTP code. Send the SAME identifier used in sendOtp plus the otp.
  // On success returns a single-use verification_token (and user/token if the
  // backend chooses to log the user in directly).
  verifyOtp: async (
    payload: { email?: string; phone_number?: string; otp: string }
  ): Promise<{ success: boolean; message?: string; channel?: string; verification_token?: string; user?: any; token?: string; error?: string }> => {
    try {
      devLog('🔐 authAPI.verifyOtp: verifying', { ...payload, otp: '******' });
      const response: any = await apiRequest<any>('/verify-otp', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      devLog('🔐 authAPI.verifyOtp: response', JSON.stringify(response, null, 2));

      const data = response.data?.data || response.data || response;
      const verification_token = response.verification_token || data?.verification_token;

      if (response.success && verification_token) {
        return {
          success: true,
          message: response.message,
          channel: response.channel || data?.channel,
          verification_token,
          user: data?.user,
          token: data?.token,
        };
      }

      return {
        success: false,
        error: response.message || response.error || 'OTP verification failed',
      };
    } catch (error) {
      console.error('❌ authAPI.verifyOtp: exception', error);
      return { success: false, error: 'Network error occurred' };
    }
  },

  // Resend activation link
  resendActivationLink: async (email: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      devLog('🚀🚀🚀 ===== authAPI.resendActivationLink: STARTING RESEND ACTIVATION =====');
      devLog('📧 Email:', email);
      devLog('🌐 API URL:', `${API_BASE_URL}/resend-activation`);
      devLog('📤 Request body:', JSON.stringify({ email }, null, 2));

      const response = await apiRequest<any>('/resend-activation', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      devLog('📡📡📡 ===== authAPI.resendActivationLink: RAW API RESPONSE =====');
      devLog('🔍 Full Response Object:', JSON.stringify(response, null, 2));
      devLog('✅ response.success:', response.success);
      devLog('📄 response.message:', response.message);
      devLog('❌ response.error:', response.error);

      if (response.success) {
        devLog('✅✅✅ ACTIVATION LINK RESENT SUCCESSFULLY');
        return {
          success: true,
          message: response.message || 'Activation link has been resent to your email',
        };
      }

      devLog('❌ RESEND ACTIVATION LINK FAILED');
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
      devLog('authAPI.socialLogin: Sending request to /social/login with data:', {
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

      devLog('authAPI.socialLogin: Full API Response:', JSON.stringify(response, null, 2));

      // Handle conflict (user already logged in)
      if (response.success === false && response.error && response.error.includes('Already logged in')) {
        devLog('authAPI.socialLogin: Conflict detected - user already logged in');
        return {
          success: false,
          error: response.error,
          conflict: true,
          currentUser: response.currentUser || null
        } as any;
      }

      if (!response.success) {
        devLog('authAPI.socialLogin: Social login failed:', response.error || response.message);
        return {
          success: false,
          error: response.error || response.message || 'Social login failed',
        };
      }

      // Extract user data and token from successful response
      const userData = response.data?.user || response.data;
      const token = response.data?.token || response.token;

      devLog('authAPI.socialLogin: Login successful');
      devLog('authAPI.socialLogin: User data:', userData);
      devLog('authAPI.socialLogin: Token present:', !!token);

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
      devLog('authAPI.verifyDeviceOtp: Verifying OTP for attempt:', data.attempt_id);

      const response = await apiRequest<any>('/verify-device-otp', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      devLog('authAPI.verifyDeviceOtp: Response:', response);

      if (response.success && response.data) {
        const user = response.data.user || response.data.data?.user;
        const token = response.data.token || response.data.access_token || response.data.data?.token;
        // Extract collaborators from response
        const collaborators = response.data.collaborators || response.data.data?.collaborators || response.collaborators || [];

        if (user && token) {
          devLog('authAPI.verifyDeviceOtp: Collaborators found:', collaborators);
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
      devLog('authAPI.resendDeviceOtp: Resending OTP for attempt:', data.attempt_id);

      const response = await apiRequest<any>('/resend-device-otp', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      devLog('authAPI.resendDeviceOtp: Response:', response);

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
      devLog('authAPI.getTrustedDevices: Fetching trusted devices');

      const response = await apiRequest<any>('/user/trusted-devices', {
        method: 'GET',
      });

      devLog('authAPI.getTrustedDevices: Response:', response);

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
      devLog('authAPI.deleteAccount: Sending request to /user/account');

      const response = await apiRequest<any>('/user/account', {
        method: 'DELETE',
        body: JSON.stringify(credentials),
      });

      devLog('authAPI.deleteAccount: Response:', response);
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

    devLog('🔑🔑🔑 ===== tokenUtils.isTokenExpired STARTED =====');
    devLog('🔑 Token to check (first 30 chars):', tokenToCheck?.substring(0, 30));
    devLog('🔑 Token length:', tokenToCheck?.length);

    if (!tokenToCheck) {
      devLog('❌ No token found - considering expired');
      return true;
    }

    try {
      // Basic JWT token expiry check (decode payload)
      const parts = tokenToCheck.split('.');
      devLog('🔑 Token parts count:', parts.length);

      if (parts.length !== 3) {
        devLog('❌❌❌ CRITICAL: Token is NOT a valid JWT format (expected 3 parts, got ' + parts.length + ')');
        devLog('🔑 This might be a session token, not a JWT - treating as non-expiring');
        devLog('🔑 If backend uses session tokens instead of JWT, we should NOT consider them expired');

        // IMPORTANT FIX: If token is not JWT format, assume it's a session token that doesn't expire
        // The backend will reject it if it's invalid
        devLog('✅ Treating non-JWT token as VALID (not expired)');
        return false; // Changed from true to false!
      }

      const payload = JSON.parse(atob(parts[1]));
      devLog('🔑 Decoded JWT payload:', { exp: payload.exp, iat: payload.iat });

      const currentTime = Date.now() / 1000;
      devLog('🔑 Current time (seconds):', currentTime);
      devLog('🔑 Token expiry (seconds):', payload.exp);
      devLog('🔑 Time until expiry (seconds):', payload.exp - currentTime);
      devLog('🔑 Time until expiry (minutes):', ((payload.exp - currentTime) / 60).toFixed(2));

      // Add a buffer of 60 seconds to account for clock skew
      const isExpired = payload.exp < (currentTime + 60);

      if (isExpired) {
        devLog('❌ Token expired or about to expire (within 60 seconds)');
      } else {
        devLog('✅ Token is valid and not expired');
      }

      devLog('🔑🔑🔑 ===== tokenUtils.isTokenExpired RESULT:', isExpired, '=====');
      return isExpired;
    } catch (error) {
      console.error('❌ Error checking token expiry:', error);
      console.error('🔥 Error details:', error);
      // IMPORTANT: If token can't be decoded as JWT, it might be a session token
      // Don't assume it's expired - let the backend validate it
      devLog('⚠️ Treating unparseable token as VALID (backend will validate)');
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
    devLog('🧹🧹🧹 ===== userUtils.clearAuthData STARTED =====');

    // Drop any cached GET responses so a following login can't read stale data.
    clearApiCache();

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

    devLog('🧹 Clearing localStorage keys:', localStorageKeysToRemove);
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

    devLog('🧹 Clearing sessionStorage keys:', sessionStorageKeysToRemove);
    sessionStorageKeysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
    });

    // DON'T call sessionStorage.clear() as it would remove SessionValidator data
    // The SessionValidator will manage its own cleanup via SessionValidator.clearSession()
    devLog('🧹 Preserved SessionValidator sessionStorage data');

    // Clear any cached data
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }

    devLog('🧹🧹🧹 ===== userUtils.clearAuthData COMPLETED =====');
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
    devLog('🚨 DEBUG: Calling /memories API with per_page=50');
    const response = await apiRequest('/memories?per_page=50&page=1', {
      method: 'GET',
    });
    devLog('🚨 DEBUG: /memories API raw response:', response);
    return response;
  },

  // Get user categories for memory creation
  getUserCategories: async (): Promise<ApiResponse<any>> => {
    devLog('🚨 DEBUG: Calling /memory-images/categories API');
    const response = await apiRequest('/memory-images/categories', {
      method: 'GET',
    });
    devLog('🚨 DEBUG: /memory-images/categories API raw response:', response);
    return response;
  },
  
  // Get existing memories for Add to Memory dialog
  getExistingMemories: async (): Promise<ApiResponse<any>> => {
    devLog('📌📌📌 Calling /existing-memories API endpoint...');
    try {
      const response = await apiRequest('/existing-memories', {
        method: 'GET',
      });
      devLog('📌📌📌 /existing-memories API RAW response:', response);
      devLog('📌📌📌 Response type:', typeof response);
      devLog('📌📌📌 Response keys:', response ? Object.keys(response) : 'null');
      return response;
    } catch (error) {
      console.error('❌❌❌ Error calling /existing-memories:', error);
      throw error;
    }
  },

  // Get transferable memories for property transfer
  getTransferableMemories: async (): Promise<ApiResponse<any>> => {
    devLog('🔄 DEBUG: Calling /memories/transferable API');
    try {
      const response = await apiRequest('/memories/transferable', {
        method: 'GET',
      });
      devLog('🔄 DEBUG: /memories/transferable API raw response:', response);
      devLog('🔄 DEBUG: Response data structure:', response?.data);
      devLog('🔄 DEBUG: Sample memory:', response?.data?.data?.[0] || response?.data?.[0]);
      return response;
    } catch (error) {
      console.error('❌ Error calling /memories/transferable:', error);
      throw error;
    }
  },

  // Transfer memories to property
  transferMemoriesToProperty: async (memoryIds: number[], propertyId: number): Promise<ApiResponse<any>> => {
    devLog('🔄 DEBUG: Calling /memories/transfer-to-property API');
    devLog('🔄 Memory IDs:', memoryIds);
    devLog('🔄 Property ID:', propertyId);
    try {
      const response = await apiRequest('/memories/transfer-to-property', {
        method: 'POST',
        body: JSON.stringify({
          memory_ids: memoryIds,
          property_id: propertyId
        }),
      });
      devLog('🔄 DEBUG: /memories/transfer-to-property API response:', response);
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
    devLog('🏠 DEBUG: Calling /user/storage-overview API');
    const response = await apiRequest('/user/storage-overview', {
      method: 'GET',
    });
    devLog('🏠 DEBUG: /user/storage-overview API raw response:', response);
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
    devLog('📝 DEBUG: Calling /user/update-profile API');
    
    // Debug: Log FormData contents
    devLog('📝 DEBUG: FormData contents being sent:');
    for (let [key, value] of profileData.entries()) {
      devLog(`📝 ${key}:`, value instanceof File ? `File: ${value.name} (${value.size} bytes)` : value);
    }
    
    // For FormData uploads, we need to handle headers specially
    const token = localStorage.getItem('stasht_token');
    devLog('📝 DEBUG: Token exists:', !!token);
    
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Don't set Content-Type for FormData - let browser set it with boundary
    
    devLog('📝 DEBUG: Request headers:', headers);
    devLog('📝 DEBUG: API URL:', `${API_BASE_URL}/user/update-profile`);
    
    // Check if FormData is actually populated
    const hasEntries = Array.from(profileData.entries()).length > 0;
    devLog('📝 DEBUG: FormData has entries:', hasEntries);
    
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
      devLog('📝 DEBUG: Sending POST request with FormData...');
      const response = await fetch(`${API_BASE_URL}/user/update-profile`, {
        method: 'POST',
        headers,
        body: profileData,
      });

      devLog('📝 DEBUG: Response status:', response.status);
      devLog('📝 DEBUG: Response headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();
      devLog('📝 DEBUG: Response data:', data);

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}`,
          data: data
        };
      }

      devLog('📝 DEBUG: /user/update-profile API successful response:', data);
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
    devLog(`dashboardAPI.getMemoryDetails: Fetching details for memory ID ${memoryId}`);
    return await apiRequest(`/memories/${memoryId}?per_page=500`, {
      method: 'GET',
    });
  },

  // Update memory by ID
  updateMemory: async (memoryId: string, memoryData: any): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.updateMemory: Updating memory ID ${memoryId}`);
    devLog('Update Data:', JSON.stringify(memoryData, null, 2));
    
    return await apiRequest(`/memories/${memoryId}`, {
      method: 'PUT',
      body: JSON.stringify(memoryData),
    });
  },

  // Publish memory by ID
  publishMemory: async (memoryId: string, role?: number): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.publishMemory: Publishing memory ID ${memoryId} with role ${role}`);
    devLog(`API URL: /memories/${memoryId}/publish`);

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

  // Update the per-campaign social share message (OG description on shared links).
  // Empty string clears it → the default "View this published storeel on stasht." is used.
  updateShareMessage: async (memoryId: number | string, shareMessage: string): Promise<ApiResponse<any>> => {
    return await apiRequest('/memories/published/share-message', {
      method: 'POST',
      body: JSON.stringify({ memory_id: Number(memoryId), share_message: shareMessage }),
    });
  },

  // Unpublish memory by ID
  unpublishMemory: async (memoryId: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.unpublishMemory: Unpublishing memory ID ${memoryId}`);
    devLog(`API URL: /memory-unpublished`);

    return await apiRequest('/memory-unpublished', {
      method: 'POST',
      body: JSON.stringify({ memory_id: memoryId }),
    });
  },

  // Get published memory by slug (public endpoint - no auth required)
  getPublishedMemory: async (slug: string, accessToken?: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.getPublishedMemory: Fetching published memory with slug: ${slug}`);

    // Build URL with optional access_token parameter
    const url = accessToken
      ? `/published-memories?token=${slug}&access_token=${encodeURIComponent(accessToken)}`
      : `/published-memories?token=${slug}`;

    devLog(`API URL: ${url}`);

    return await apiRequest(url, {
      method: 'GET',
    });
  },

  // Create new category
  createCategory: async (name: string, propertyId?: number): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.createCategory: Creating category with name "${name}"${propertyId ? `, property_id: ${propertyId}` : ''}`);
    devLog(`API URL: /create-category`);

    const body: Record<string, any> = { name };
    if (propertyId) body.property_id = propertyId;

    return await apiRequest('/create-category', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Create new label
  createLabel: async (name: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.createLabel: Creating label with name "${name}"`);
    devLog(`API URL: /create-label`);
    
    return await apiRequest('/create-label', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  // Edit category by ID
  editCategory: async (categoryId: string, name: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.editCategory: Editing category with ID "${categoryId}" to name "${name}"`);
    devLog(`API URL: /edit-category/${categoryId}`);
    
    return await apiRequest(`/edit-category/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  },

  // Delete category by ID
  deleteCategory: async (categoryId: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.deleteCategory: Deleting category with ID "${categoryId}"`);
    devLog(`API URL: /delete-category/${categoryId}`);
    
    return await apiRequest(`/delete-category/${categoryId}`, {
      method: 'GET',
    });
  },

  // Delete label (sub-category) by ID
  deleteLabel: async (subCategoryId: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.deleteLabel: Deleting label with ID "${subCategoryId}"`);
    devLog(`API URL: /delete-sub-category/${subCategoryId}`);
    
    return await apiRequest(`/delete-sub-category/${subCategoryId}`, {
      method: 'GET',
    });
  },

  // Edit label by ID
  editLabel: async (labelId: string, name: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.editLabel: Editing label with ID "${labelId}" to name "${name}"`);
    devLog(`API URL: /edit-label/${labelId}`);

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
    devLog(`dashboardAPI.updateMemoryImages: Updating post ID "${postId}"`);
    devLog(`API URL: /memory-images/${postId}`);
    devLog('Update Data:', updateData);
    
    // Create FormData for multipart request
    const formData = new FormData();
    
    // Add Laravel method override for PUT request with FormData
    formData.append('_method', 'PUT');
    
    // Add image file if provided
    if (updateData.image) {
      formData.append('image', updateData.image);
      devLog('Added image to FormData:', updateData.image.name, updateData.image.size);
    }
    
    // Add other fields if provided
    if (updateData.name !== undefined) {
      formData.append('name', updateData.name || '');
      devLog('Added name to FormData:', updateData.name);
    }

    if (updateData.title !== undefined) {
      formData.append('title', updateData.title || '');
      devLog('Added title to FormData:', updateData.title);
    }

    if (updateData.description !== undefined) {
      formData.append('description', updateData.description || '');
      devLog('Added description to FormData:', updateData.description);
    }

    if (updateData.capture_date !== undefined) {
      formData.append('capture_date', updateData.capture_date || '');
      devLog('Added capture_date to FormData:', updateData.capture_date);
    }

    if (updateData.location !== undefined) {
      formData.append('location', updateData.location || '');
      devLog('Added location to FormData:', updateData.location);
    }
    
    if (updateData.tags !== undefined) {
      updateData.tags.forEach((tag, index) => {
        formData.append(`tags[${index}]`, tag);
      });
      devLog('Added tags to FormData:', updateData.tags);
    }

    // Add parent_image_id if provided (can be string or null)
    if (updateData.parent_image_id !== undefined) {
      formData.append('parent_image_id', updateData.parent_image_id || '');
      devLog('Added parent_image_id to FormData:', updateData.parent_image_id);
    }

    // Debug FormData contents
    devLog('FormData entries:');
    for (let [key, value] of formData.entries()) {
      devLog(`${key}:`, value instanceof File ? `File(${value.name})` : value);
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
        devLog('Received 401 Unauthorized, clearing auth data and reloading');
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

      devLog('dashboardAPI.updateMemoryImages: Full API Response:', { success: true, data });
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
    devLog('dashboardAPI.createMemory: Sending POST request to /memories');
    devLog('Request Headers:', getAuthHeaders());
    devLog('Request Body:', JSON.stringify(memoryData, null, 2));
    
    const response = await apiRequest('/memories', {
      method: 'POST',
      body: JSON.stringify(memoryData),
    });
    
    devLog('dashboardAPI.createMemory: Full API Response:', response);
    return response;
  },

  // Add description to a post
  addPostDescription: async (postId: string, description: string, mentionedEmails?: string[], mentionedPhones?: string[]): Promise<ApiResponse<any>> => {
    devLog('dashboardAPI.addPostDescription: Sending POST request to /memories/add-description');
    devLog('Post ID:', postId);
    devLog('Description:', description);
    devLog('Mentioned Emails:', mentionedEmails);
    devLog('Mentioned Phones:', mentionedPhones);

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

    devLog('📦 Final request body:', JSON.stringify(body));

    return await apiRequest('/memories/add-description', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Edit post description
  editPostDescription: async (postId: string, description: string, mentionedEmails?: string[], mentionedPhones?: string[]): Promise<ApiResponse<any>> => {
    devLog('dashboardAPI.editPostDescription: Sending PUT request to /memories/edit-description');
    devLog('Post ID:', postId);
    devLog('Description:', description);
    devLog('Mentioned Emails:', mentionedEmails);
    devLog('Mentioned Phones:', mentionedPhones);

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
    devLog('dashboardAPI.deletePostDescription: Sending DELETE request to /memories/delete-description');
    devLog('Post ID:', postId);

    return await apiRequest('/memories/delete-description', {
      method: 'DELETE',
      body: JSON.stringify({
        post_id: postId
      }),
    });
  },

  // Set image as featured
  setImageFeatured: async (imageId: string, isFeatured: boolean): Promise<ApiResponse<any>> => {
    devLog('dashboardAPI.setImageFeatured: Sending POST request to /memory-images/set-featured');
    devLog('Image ID:', imageId, 'Is Featured:', isFeatured);

    return await apiRequest('/memory-images/set-featured', {
      method: 'POST',
      body: JSON.stringify({
        image_id: imageId,
        is_featured: isFeatured ? 1 : 0
      }),
    });
  },

  // Hide/show a post's caption (persisted)
  setCaptionHidden: async (imageId: string, hidden: boolean): Promise<ApiResponse<any>> => {
    devLog('dashboardAPI.setCaptionHidden: Sending POST request to /memory-images/hide-caption');
    devLog('Image ID:', imageId, 'Hidden:', hidden);

    return await apiRequest('/memory-images/hide-caption', {
      method: 'POST',
      body: JSON.stringify({
        image_id: imageId,
        hide_caption: hidden ? 1 : 0
      }),
    });
  },

  // Delete entire post
  deletePost: async (postId: string): Promise<ApiResponse<any>> => {
    devLog('dashboardAPI.deletePost: Sending DELETE request to /memory-images/' + postId);
    devLog('Post ID:', postId);

    return await apiRequest(`/memory-images/${postId}`, {
      method: 'DELETE',
    });
  },

  // Claim post - request ownership
  claimPostRequest: async (postId: string): Promise<ApiResponse<any>> => {
    devLog('dashboardAPI.claimPostRequest: Sending POST request to /memory-images/claim-post');
    devLog('Post ID:', postId);

    return await apiRequest('/memory-images/claim-post', {
      method: 'POST',
      body: JSON.stringify({
        post_id: postId
      }),
    });
  },

  // Delete multiple posts
  deleteMultiplePosts: async (imageIds: string[]): Promise<ApiResponse<any>> => {
    devLog('dashboardAPI.deleteMultiplePosts: Sending POST request to /memory-images/delete-multiple');
    devLog('Image IDs:', imageIds);

    return await apiRequest('/memory-images/delete-multiple', {
      method: 'POST',
      body: JSON.stringify({
        image_ids: imageIds
      }),
    });
  },

  // Add comment to a post
  addPostComment: async (postId: string, comment: string, parentId?: string): Promise<ApiResponse<any>> => {
    devLog('dashboardAPI.addPostComment: Sending POST request to add comment');
    devLog('Post ID (image_id):', postId);
    devLog('Comment:', comment);
    devLog('Parent ID:', parentId);

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
    devLog('dashboardAPI.createMemoryMultipart: Sending POST request to /memories with multipart data');

    // Count files in FormData before sending
    let fileCount = 0;
    const fileNames = [];
    for (let [key, value] of formData.entries()) {
      if (key === 'media_files[]' && value instanceof File) {
        fileCount++;
        fileNames.push(value.name);
      }
    }
    devLog(`📤 API CALL: Sending ${fileCount} files to backend:`, fileNames);

    // Get auth token for headers (don't include Content-Type, let browser set it for FormData)
    const token = localStorage.getItem('stasht_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    try {
      devLog(`🌐 MAKING FETCH REQUEST with ${fileCount} files...`);
      devLog(`📤 Request URL: ${API_BASE_URL}/memories`);
      devLog(`📋 Request Headers:`, headers);

      // Log the total size of the FormData
      let totalFormDataSize = 0;
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          totalFormDataSize += value.size;
        } else if (typeof value === 'string') {
          totalFormDataSize += value.length;
        }
      }
      devLog(`📦 Total FormData size: ${(totalFormDataSize / 1024 / 1024).toFixed(2)}MB`);

      const response = await fetch(`${API_BASE_URL}/memories`, {
        method: 'POST',
        headers: headers, // No Content-Type header - browser will set multipart/form-data with boundary
        body: formData,
      });

      devLog(`📨 FETCH RESPONSE received:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      const data = await response.json();

      // Handle 401 Unauthorized responses
      if (response.status === 401) {
        devLog('Received 401 Unauthorized, clearing auth data and reloading');
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

      devLog('dashboardAPI.createMemoryMultipart: Full API Response:', { success: true, data });
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
    devLog('dashboardAPI.checkMemoryLimit: Sending GET request to /user/check-memory-limit');
    devLog('Request Headers:', getAuthHeaders());
    
    const response = await apiRequest('/user/check-memory-limit', {
      method: 'GET',
    });
    
    devLog('dashboardAPI.checkMemoryLimit: Full API Response:', response);
    return response;
  },

  // Get memory counts (total memories, media, published)
  getMemoryCounts: async (): Promise<ApiResponse<any>> => {
    devLog('dashboardAPI.getMemoryCounts: Sending GET request to /user/memory-counts');
    devLog('Request Headers:', getAuthHeaders());
    
    const response = await apiRequest('/user/memory-counts', {
      method: 'GET',
    });
    
    devLog('dashboardAPI.getMemoryCounts: Full API Response:', response);
    return response;
  },

  // Delete memory by ID
  deleteMemory: async (memoryId: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.deleteMemory: Deleting memory ID ${memoryId}`);
    devLog('Request Headers:', getAuthHeaders());
    
    const response = await apiRequest(`/memories/${memoryId}`, {
      method: 'DELETE',
    });
    
    devLog('dashboardAPI.deleteMemory: Full API Response:', response);
    return response;
  },

  // Upload photo to media without memory
  uploadPhotoToMedia: async (file: File, name: string, position: number): Promise<ApiResponse<any>> => {
    devLog(`🔧 dashboardAPI.uploadPhotoToMedia: Starting upload for "${name}" at position ${position}`);
    devLog('🔧 File details:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      position
    });
    
    // Check authentication
    const token = tokenUtils.getToken();
    devLog('🔧 Auth token exists:', !!token);
    devLog('🔧 Auth token length:', token?.length || 0);
    
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

    devLog('=== API REQUEST DETAILS ===');
    devLog('Endpoint:', `${getApiBaseUrl()}/memory-images/upload`);
    devLog('Method: POST');
    devLog('Headers:', getAuthHeaders());
    devLog('FormData Contents:');
    devLog('- name:', name);
    devLog('- file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });
    devLog('- position:', position.toString());
    
    // Log all FormData entries (for debugging)
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        devLog(`FormData[${key}]:`, {
          name: value.name,
          size: value.size,
          type: value.type
        });
      } else {
        devLog(`FormData[${key}]:`, value);
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

    devLog('=== API RESPONSE STATUS ===');
    devLog('Status:', response.status);
    devLog('Status Text:', response.statusText);
    devLog('OK:', response.ok);
    devLog('Headers:', Object.fromEntries(response.headers.entries()));

    let responseData;
    try {
      responseData = await response.json();
      devLog('=== API RESPONSE DATA (PARSED JSON) ===');
      devLog('Full Response Object:', responseData);
      devLog('Response Type:', typeof responseData);
      devLog('Response Keys:', Object.keys(responseData || {}));
      
      // Log each property of the response
      if (responseData && typeof responseData === 'object') {
        Object.entries(responseData).forEach(([key, value]) => {
          devLog(`Response.${key}:`, value);
        });
      }
    } catch (jsonError) {
      devLog('=== FAILED TO PARSE JSON ===');
      console.error('JSON Parse Error:', jsonError);
      const responseText = await response.text();
      devLog('Raw Response Text:', responseText);
      responseData = { error: 'Invalid JSON response', rawText: responseText };
    }
    
    const result = {
      success: response.ok,
      data: responseData,
      error: response.ok ? undefined : responseData?.message || responseData?.error || 'Upload failed'
    };

    devLog('=== FINAL UPLOAD RESULT ===');
    devLog('Success:', result.success);
    devLog('Data:', result.data);
    devLog('Error:', result.error);
    devLog('=== END UPLOAD PROCESS ===');

    return result;
  },

  // Upload multiple photos to media (calls the single upload API multiple times)
  uploadMultiplePhotosToMedia: async (files: File[]): Promise<ApiResponse<any>[]> => {
    devLog(`dashboardAPI.uploadMultiplePhotosToMedia: Uploading ${files.length} files`);
    
    const results: ApiResponse<any>[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const position = i + 1; // Position starts from 1
      const name = file.name;
      
      try {
        devLog(`Uploading file ${i + 1}/${files.length}: ${name} at position ${position}`);
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
    
    devLog(`dashboardAPI.uploadMultiplePhotosToMedia: Completed ${results.length} uploads`);
    return results;
  },

  // Get memory collaborators
  getMemoryCollaborators: async (memoryId: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.getMemoryCollaborators: Getting collaborators for memory ID ${memoryId}`);
    devLog(`API URL: /memories/${memoryId}/collaborators`);
    
    return await apiRequest(`/memories/${memoryId}/collaborators`, {
      method: 'GET',
    });
  },

  // Add collaborators to memory (sends emails array and single role) - for memory description page
  addMemoryCollaborator: async (memoryId: string, collaboratorData: {
    emails: string[];
    role: 'view' | 'edit' | 'admin';
    personalize_message?: string;
  }): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.addMemoryCollaborator: Adding collaborator(s) to memory ID ${memoryId}`);
    devLog('Collaborator Data:', collaboratorData);
    devLog(`API URL: /memories/${memoryId}/add-collabarators`);

    // Map role values to API expected format
    const roleMapping: Record<string, string> = {
      'view': 'viewer',
      'edit': 'contributor',
      'admin': 'admin'
    };

    // Prepare request body in the exact format expected by the API
    const requestBody: any = {
      emails: collaboratorData.emails,
      role: roleMapping[collaboratorData.role] || collaboratorData.role
    };

    // Include optional personalized invite message when provided
    if (collaboratorData.personalize_message) {
      requestBody.personalize_message = collaboratorData.personalize_message;
    }

    devLog('Final request body:', requestBody);

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
    personalize_message?: string;
  }): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.addMemoryCollaboratorByPhone: Adding collaborator(s) by phone to memory ID ${memoryId}`);
    devLog('Collaborator Data:', collaboratorData);
    devLog(`API URL: /memories/${memoryId}/add-collaborator-by-phone`);

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

    // Include optional personalized invite message when provided
    if (collaboratorData.personalize_message) {
      requestBody.personalize_message = collaboratorData.personalize_message;
    }

    // Add optional message if provided
    if (collaboratorData.message) {
      requestBody.message = collaboratorData.message;
    }

    devLog('Final request body:', requestBody);

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
    devLog(`dashboardAPI.addCollaboratorsToMemory: Adding collaborators to memory ID ${memoryId}`);
    devLog('Collaborator Data:', collaboratorData);
    devLog(`API URL: /memories/${memoryId}/add-collaborators-new`);

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
      devLog('Adding custom message to request:', collaboratorData.message.trim());
    }

    devLog('Final request body:', requestBody);

    return await apiRequest(`/memories/${memoryId}/add-collaborators-new`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  // Add account admin (for InviteToMemoryModal when Admin role is selected)
  addAccountAdmin: async (collaboratorData: {
    collaborators: Array<{email: string}>;
  }): Promise<ApiResponse<any>> => {
    devLog('dashboardAPI.addAccountAdmin: Adding account admin(s)');
    devLog('Collaborator Data:', collaboratorData);
    devLog('API URL: /memories/add-account-admin');

    const requestBody = {
      collaborators: collaboratorData.collaborators
    };

    devLog('Final request body:', requestBody);

    return await apiRequest('/memories/add-account-admin', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  // Add account admin by phone number (for InviteToMemoryModal when Admin role is selected with phone tab)
  addAccountAdminByPhone: async (collaboratorData: {
    collaborators: Array<{phone_number: string}>;
  }): Promise<ApiResponse<any>> => {
    devLog('dashboardAPI.addAccountAdminByPhone: Adding account admin(s) by phone');
    devLog('Collaborator Data:', collaboratorData);
    devLog('API URL: /memories/add-account-admin-by-phone');

    const requestBody = {
      collaborators: collaboratorData.collaborators
    };

    devLog('Final request body:', requestBody);

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
    devLog('dashboardAPI.checkAdminEmail: Checking if email is already admin');
    devLog('Email:', email);
    devLog('API URL: /user/check-admin-email');

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
    devLog('dashboardAPI.loginAsAdmin: Logging in as admin');
    devLog('Owner ID:', ownerId);
    devLog('API URL: /login-as-admin');

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
    devLog(`dashboardAPI.removeMemoryCollaborators: Removing collaborators from memory ID ${memoryId}`);
    devLog('User IDs to remove:', userIds);
    devLog(`Is property user: ${!!isPropertyUser}`);
    devLog(`API URL: /memories/${memoryId}/remove-collaborators`);

    const payload: Record<string, any> = { user_id: userIds };
    if (isPropertyUser) payload.property = 1;

    return await apiRequest(`/memories/${memoryId}/remove-collaborators`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Edit collaborator role
  editCollaboratorRole: async (memoryId: string, userId: string, role: 'view' | 'edit' | 'admin'): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.editCollaboratorRole: Editing collaborator role for memory ID ${memoryId}`);
    devLog('User ID:', userId);
    devLog('New Role:', role);
    devLog(`API URL: /memories/${memoryId}/edit-collaborator-role`);
    
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
    devLog(`dashboardAPI.editNonUserCollaboratorRole: Editing non-user collaborator role for email ${email}`);
    devLog('Memory ID:', memoryId);
    devLog('New Role (frontend):', role);
    devLog(`API URL: /memories/non-user-collaborator/${email}`);

    // Map frontend role values to backend role values
    const roleMapping: { [key: string]: string } = {
      'view': 'viewer',
      'edit': 'contributor',
      'admin': 'admin'
    };

    const backendRole = roleMapping[role] || role;
    devLog('Mapped Role (backend):', backendRole);

    return await apiRequest(`/memories/non-user-collaborator?email=${encodeURIComponent(email)}`, {
      method: 'PUT',
      body: JSON.stringify({
        memory_id: memoryId,
        role: backendRole
      }),
    });
  },

  // Add collaborator by QR code (for anyone who scans the QR code)
  addCollaboratorByQrCode: async (memoryId: string, externalUserId: string, role: 'view' | 'edit' | 'admin'): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.addCollaboratorByQrCode: Adding collaborator via QR code to memory ID ${memoryId}`);
    devLog('External User ID:', externalUserId);
    devLog('Role (frontend):', role);
    devLog(`API URL: /memories/add-collaborator-by-qr-code`);

    // Map frontend role values to backend role values
    const roleMapping: { [key: string]: string } = {
      'view': 'viewer',
      'edit': 'contributor',
      'admin': 'admin'
    };

    const backendRole = roleMapping[role] || role;
    devLog('Mapped Role (backend):', backendRole);

    const requestBody = {
      memory_id: memoryId,
      user_id: externalUserId,
      role: backendRole
    };

    devLog('Final request body:', requestBody);

    return await apiRequest(`/memories/add-collaborator-by-qr-code`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  addSelfAsCollaborator: async (memoryId: string, role: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.addSelfAsCollaborator: Joining memory ID ${memoryId} as ${role}`);
    return await apiRequest(`/memories/add-self-as-collaborator`, {
      method: 'POST',
      body: JSON.stringify({ memory_id: memoryId, role }),
    });
  },

  // Edit non-user collaborator role by phone
  editNonUserCollaboratorRoleByPhone: async (phone: string, memoryId: string, role: 'view' | 'edit' | 'admin'): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.editNonUserCollaboratorRoleByPhone: Editing non-user collaborator role for phone ${phone}`);
    devLog('Memory ID:', memoryId);
    devLog('New Role (frontend):', role);
    devLog(`API URL: /memories/non-user-collaborator-by-phone/${encodeURIComponent(phone)}`);

    // Map frontend role values to backend role values
    const roleMapping: { [key: string]: string } = {
      'view': 'viewer',
      'edit': 'contributor',
      'admin': 'admin'
    };

    const backendRole = roleMapping[role] || role;
    devLog('Mapped Role (backend):', backendRole);

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
    devLog(`dashboardAPI.resendInvitation: Resending invitation for invite ID ${inviteId}`);
    devLog(`API URL: /invites/${inviteId}/resend`);

    return await apiRequest(`/invites/${inviteId}/resend`, {
      method: 'POST',
    });
  },

  // Remove non-user collaborator
  removeNonUserCollaborator: async (email: string, memoryId: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.removeNonUserCollaborator: Removing non-user collaborator ${email}`);
    devLog('Memory ID:', memoryId);
    devLog(`API URL: /memories/non-user-collaborator/${email}`);

    return await apiRequest(`/memories/non-user-collaborator?email=${encodeURIComponent(email)}`, {
      method: 'DELETE',
      body: JSON.stringify({
        memory_id: memoryId
      }),
    });
  },

  // Remove non-user collaborator by phone
  removeNonUserCollaboratorByPhone: async (phone: string, memoryId: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.removeNonUserCollaboratorByPhone: Removing non-user collaborator ${phone}`);
    devLog('Memory ID:', memoryId);
    devLog(`API URL: /memories/non-user-collaborator-by-phone/${encodeURIComponent(phone)}`);

    return await apiRequest(`/memories/non-user-collaborator-by-phone/${encodeURIComponent(phone)}`, {
      method: 'DELETE',
      body: JSON.stringify({
        memory_id: memoryId
      }),
    });
  },

  // Generate share link for QR code
  generateShareLink: async (memoryId: string, role: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.generateShareLink: Generating share link for memory ID ${memoryId}`);
    devLog('Role:', role);
    devLog(`API URL: /share-qr/${memoryId}/${role}`);

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
    devLog('dashboardAPI.getUserNotifications: Getting user notifications');
    devLog('API URL: /user/notifications');
    
    return await apiRequest('/user/notifications', {
      method: 'GET',
    });
  },

  // Accept notification (for invitations, etc.)
  acceptNotification: async (notificationId: string): Promise<ApiResponse<any>> => {
    devLog('dashboardAPI.acceptNotification: Accepting notification', notificationId);
    devLog(`API URL: /user/notifications/${notificationId}/accept`);
    
    return await apiRequest(`/user/notifications/${notificationId}/accept`, {
      method: 'POST',
    });
  },

  // Decline notification (for invitations, etc.)
  declineNotification: async (notificationId: string): Promise<ApiResponse<any>> => {
    devLog('dashboardAPI.declineNotification: Declining notification', notificationId);
    devLog(`API URL: /user/notifications/${notificationId}/decline`);
    
    return await apiRequest(`/user/notifications/${notificationId}/decline`, {
      method: 'POST',
    });
  },

  // Mark notification as read
  markNotificationAsRead: async (notificationId: string): Promise<ApiResponse<any>> => {
    devLog('dashboardAPI.markNotificationAsRead: Marking notification as read', notificationId);
    devLog(`API URL: /user/notifications/${notificationId}/read`);

    return await apiRequest(`/user/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },

  // Delete old notifications (older than 1 week)
  deleteOldNotifications: async (): Promise<ApiResponse<any>> => {
    devLog('dashboardAPI.deleteOldNotifications: Deleting notifications older than 1 week');
    devLog('API URL: /user/notifications/delete-old');

    return await apiRequest('/user/notifications/delete-old', {
      method: 'DELETE',
    });
  },

  // Update collaborator role
  updateCollaboratorRole: async (memoryId: string, collaboratorId: string, role: 'view' | 'edit' | 'admin'): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.updateCollaboratorRole: Updating collaborator role for memory ID ${memoryId}, collaborator ID ${collaboratorId}`);
    devLog('New Role:', role);
    devLog(`API URL: /memories/${memoryId}/collaborators/${collaboratorId}`);

    return await apiRequest(`/memories/${memoryId}/collaborators/${collaboratorId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  // Update user collaborator role (correct API endpoint for Users page)
  editUserCollaboratorRole: async (collaboratorId: number, role: string, collaboratorType: string = 'user', memoryIds?: (string | number)[], phoneNumber?: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.editUserCollaboratorRole: Updating user collaborator role for ID ${collaboratorId}`);
    devLog('Role:', role);
    devLog('Collaborator Type:', collaboratorType);
    devLog(`API URL: /user/edit-collaborator-role`);

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
    devLog(`dashboardAPI.updateCollaborator: Updating collaborator ID ${collaboratorId}`);
    devLog('Updates:', updates);
    devLog(`API URL: /user/collaborators/${collaboratorId}`);

    return await apiRequest(`/user/collaborators/${collaboratorId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Deactivate user
  deactivateUser: async (userId: number): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.deactivateUser: Deactivating user ID ${userId}`);
    devLog(`API URL: /users/${userId}/deactivate`);

    return await apiRequest(`/users/${userId}/deactivate`, {
      method: 'PUT',
      body: JSON.stringify({ status: 0 }),
    });
  },

  // Remove user
  removeUser: async (userId: number): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.removeUser: Removing user ID ${userId}`);
    devLog(`API URL: /users/${userId}`);

    return await apiRequest(`/users/${userId}`, {
      method: 'DELETE',
    });
  },

  // Remove collaborator from memory
  removeMemoryCollaborator: async (memoryId: string, collaboratorId: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.removeMemoryCollaborator: Removing collaborator from memory ID ${memoryId}, collaborator ID ${collaboratorId}`);
    devLog(`API URL: /memories/${memoryId}/collaborators/${collaboratorId}`);
    
    return await apiRequest(`/memories/${memoryId}/collaborators/${collaboratorId}`, {
      method: 'DELETE',
    });
  },

  // Get memory activity data
  getMemoryActivity: async (memoryId: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.getMemoryActivity: Getting activity for memory ID ${memoryId}`);
    devLog(`API URL: /memories/${memoryId}/activity`);
    
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

  // Track a click on a CTA widget (public endpoint — increments the widget's click_count)
  trackWidgetClick: async (memoryId: string | number, widgetId: string | number): Promise<ApiResponse<any>> => {
    return await apiRequest(`/memories/${memoryId}/widgets/${widgetId}/track-click`, {
      method: 'POST',
    });
  },

  // Per-rep / per-Storeel report (spec Plan #4). from/to are ISO dates
  // (YYYY-MM-DD); omit either to use the backend's default (last 30 days).
  getStoreelReport: async (params: {
    propertyId: number | string;
    from?: string;
    to?: string;
    groupBy?: 'rep' | 'memory';
  }): Promise<ApiResponse<any>> => {
    const query = new URLSearchParams({ property_id: String(params.propertyId) });
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.groupBy) query.set('group_by', params.groupBy);
    return await apiRequest(`/storeels/report?${query.toString()}`, {
      method: 'GET',
    });
  },

  // Lightweight property list for the report screen's picker — see the
  // matching endpoint's own comment for why this isn't the full Properties
  // tab fetch.
  getStoreelMyProperties: async (): Promise<ApiResponse<any>> => {
    return await apiRequest('/storeels/my-properties', { method: 'GET' });
  },

  // Search users for collaborator invite
  searchUsers: async (searchQuery: string, searchType: 'email' | 'phone' = 'email'): Promise<ApiResponse<any>> => {
    const paramName = searchType === 'phone' ? 'phone' : 'search';
    devLog(`dashboardAPI.searchUsers: Searching users with ${searchType} query "${searchQuery}"`);
    devLog(`API URL: /user/list-of-users?${paramName}=${encodeURIComponent(searchQuery)}`);

    return await apiRequest(`/user/list-of-users?${paramName}=${encodeURIComponent(searchQuery)}`, {
      method: 'GET',
    });
  },

  // Upload image with metadata to get location and capture date
  uploadImageWithMetadata: async (file: File, name: string, orientation?: number): Promise<ApiResponse<any>> => {
    devLog(`🔧 dashboardAPI.uploadImageWithMetadata: Starting upload for "${name}"`);
    devLog('🔧 File details:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });
    
    // Check authentication
    const token = tokenUtils.getToken();
    devLog('🔧 Auth token exists:', !!token);
    
    const formData = new FormData();
    formData.append('name', name);
    // The backend only reads $request->file('image') — an earlier defensive
    // duplicate append('file', file) was silently doubling every upload's
    // multipart body size for no functional benefit, removed.
    formData.append('image', file);
    formData.append('is_memory', '1'); // Add is_memory=1 parameter for create memory modal
    if (orientation !== undefined && orientation > 0) {
      formData.append('orientation', String(orientation));
    }
    
    // Add more file details for debugging
    devLog('=== DETAILED FILE OBJECT ===');
    devLog('File is valid object:', file && typeof file === 'object');
    devLog('File constructor name:', file.constructor ? file.constructor.name : 'unknown');
    devLog('File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });

    devLog('=== API REQUEST DETAILS ===');
    const endpoint = `${getApiBaseUrl()}/user/upload-image-with-metadata`;
    devLog('Endpoint:', endpoint);
    devLog('Full API Base URL:', getApiBaseUrl());
    devLog('Method: POST');
    devLog('FormData Contents:');
    devLog('- name:', name);
    devLog('- image (file object):', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    // Log FormData entries for debugging
    devLog('=== FORMDATA ENTRIES ===');
    for (let [key, value] of formData.entries()) {
      if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'File') {
        devLog(`FormData[${key}]:`, {
          name: value.name,
          size: value.size,
          type: value.type,
          isFile: true
        });
      } else {
        devLog(`FormData[${key}]:`, value);
      }
    }

    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    devLog('Request Headers:', headers);
    
    // Use fetch directly for FormData upload to avoid JSON content-type header.
    // Goes through fetchWithRateLimitRetry (not the plain fetch apiRequest itself
    // uses) so a transient 429 from the throttle middleware doesn't fail the
    // upload outright — this raw call bypasses apiRequest entirely and would
    // otherwise get none of its retry behavior.
    const response = await fetchWithRateLimitRetry(endpoint, {
      method: 'POST',
      headers: headers,
      body: formData
    });

    devLog('🔧 Response status:', response.status, response.statusText);
    devLog('🔧 Response headers:', Object.fromEntries(response.headers.entries()));

    let responseData;
    const responseText = await response.text();
    devLog('🔧 Raw response text:', responseText);

    try {
      responseData = JSON.parse(responseText);
      devLog('🔧 Parsed response data:', responseData);
    } catch (e) {
      console.error('🔧 Failed to parse JSON response:', e);
      return {
        success: false,
        data: null,
        error: 'Invalid response format from server'
      };
    }

    devLog('=== FINAL API RESPONSE ===');
    devLog('dashboardAPI.uploadImageWithMetadata: Full API Response:', responseData);
    devLog('Response OK:', response.ok);
    devLog('Response Status:', response.status);
    devLog('Response Status Text:', response.statusText);

    const result = {
      success: response.ok,
      data: responseData,
      error: response.ok ? undefined : responseData?.message || responseData?.error || `HTTP ${response.status}: ${response.statusText}`,
      statusCode: response.status,
      statusText: response.statusText,
      rawResponse: responseData
    };

    devLog('🔧 Final result:', result);
    return result;
  },

  // Public variant of uploadImageWithMetadata, used by the published memory page
  // where the visitor may not be signed in. Same FormData payload and same
  // response shape ({ fileUrl, location, capture_date, originalSizeMB }); only the
  // route differs, and no Authorization header is ever sent — a stale token would
  // only risk turning a valid anonymous upload into a 401.
  // Deliberately separate from uploadImageWithMetadata so the normal-memory
  // callers of that function are unaffected.
  uploadImageWithMetadataPublic: async (file: File, name: string, orientation?: number): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('image', file);
    formData.append('file', file);
    formData.append('is_memory', '1');
    if (orientation !== undefined && orientation > 0) {
      formData.append('orientation', String(orientation));
    }

    const endpoint = `${getApiBaseUrl()}/public/upload-image-with-metadata`;
    devLog('🌐 uploadImageWithMetadataPublic ->', endpoint, { fileName: file.name, size: file.size, type: file.type });

    try {
      // No headers at all: the browser sets the multipart boundary itself, and
      // setting Content-Type manually would break the upload. Still goes through
      // fetchWithRateLimitRetry — this route sits behind the same throttle:api
      // middleware (keyed by IP here, since there's no authenticated user).
      const response = await fetchWithRateLimitRetry(endpoint, { method: 'POST', body: formData });
      const responseText = await response.text();

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        console.error('🌐 uploadImageWithMetadataPublic: non-JSON response:', responseText);
        return { success: false, data: null, error: 'Invalid response format from server' };
      }

      const result = {
        success: response.ok,
        data: responseData,
        error: response.ok ? undefined : responseData?.message || responseData?.error || `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
        statusText: response.statusText,
      };
      return result;
    } catch (err: any) {
      console.error('🌐 uploadImageWithMetadataPublic: request failed:', err);
      return { success: false, data: null, error: err?.message || 'Upload failed' };
    }
  },

  // Upload photo to media without memory (using Laravel route /upload)
  uploadPhotoToMediaWithoutMemory: async (file: File, name: string): Promise<ApiResponse<any>> => {
    devLog(`🔧 dashboardAPI.uploadPhotoToMediaWithoutMemory: Starting upload for "${name}"`);
    devLog('🔧 File details:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });
    
    // Check authentication
    const token = tokenUtils.getToken();
    devLog('🔧 Auth token exists:', !!token);
    devLog('🔧 Auth token length:', token?.length || 0);
    
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

    devLog('=== API REQUEST DETAILS ===');
    devLog('Endpoint:', `${getApiBaseUrl()}/memory-images/upload`);
    devLog('Method: POST');
    devLog('FormData Contents:');
    devLog('- name:', name);
    devLog('- file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });
    
    // Log all FormData entries (for debugging)
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        devLog(`FormData[${key}]:`, {
          name: value.name,
          size: value.size,
          type: value.type
        });
      } else {
        devLog(`FormData[${key}]:`, value);
      }
    }
    
    // Create headers without Content-Type for FormData
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    devLog('Request Headers:', headers);
    
    // Use fetch directly for FormData upload to avoid JSON content-type header
    const response = await fetch(`${getApiBaseUrl()}/memory-images/upload`, {
      method: 'POST',
      headers: headers, // Only Authorization header, no Content-Type
      body: formData
    });

    devLog('=== API RESPONSE STATUS ===');
    devLog('Status:', response.status);
    devLog('Status Text:', response.statusText);
    devLog('OK:', response.ok);
    devLog('Headers:', Object.fromEntries(response.headers.entries()));

    let responseData;
    try {
      const responseText = await response.text();
      devLog('🔧 Raw response text:', responseText);
      
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

    devLog('=== FINAL API RESPONSE ===');
    devLog('dashboardAPI.uploadPhotoToMediaWithoutMemory: Full API Response:', responseData);

    const result = {
      success: response.ok,
      data: responseData,
      error: response.ok ? undefined : responseData?.message || responseData?.error || `HTTP ${response.status}: ${response.statusText}`
    };

    devLog('🔧 Final result:', result);
    return result;
  },

  // Get user profile data
  getUserProfile: async (): Promise<ApiResponse<any>> => {
    devLog('🔍 DEBUG: Calling /user/profile API');
    try {
      const response = await apiRequest('/user/profile', {
        method: 'GET',
      });
      devLog('🔍 DEBUG: /user/profile API response:', response);
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
    devLog(`🔧 dashboardAPI.uploadPhotosFromMediaWithOutMemory: Starting upload for "${name}"`);
    devLog('🔧 File details:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      location: location || 'Not provided',
      captureDate: captureDate || 'Not provided'
    });
    
    // Check authentication
    const token = tokenUtils.getToken();
    devLog('🔧 Auth token exists:', !!token);
    
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
    
    devLog('🔧 DEBUGGING PARAMETER ADDITION:');
    devLog('🔧 Original location parameter:', location);
    devLog('🔧 Original captureDate parameter:', captureDate);
    devLog('🔧 locationToSend:', locationToSend);
    devLog('🔧 dateTimeToSend:', dateTimeToSend);
    devLog('🔧 typeof location:', typeof location);
    devLog('🔧 typeof captureDate:', typeof captureDate);
    devLog('🔧 location === undefined:', location === undefined);
    devLog('🔧 captureDate === undefined:', captureDate === undefined);
    devLog('🔧 location === null:', location === null);
    devLog('🔧 captureDate === null:', captureDate === null);

    devLog('=== API REQUEST DETAILS ===');
    devLog('Endpoint:', `${getApiBaseUrl()}/memory-images/upload`);
    devLog('Method: POST');
    devLog('FormData Contents:');
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        devLog(`FormData[${key}]:`, {
          name: value.name,
          size: value.size,
          type: value.type
        });
      } else {
        devLog(`FormData[${key}]:`, value);
      }
    }
    
    // Create headers without Content-Type for FormData
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    devLog('Request Headers:', headers);
    
    try {
      // Use fetch directly for FormData upload to avoid JSON content-type header
      const response = await fetch(`${getApiBaseUrl()}/memory-images/upload`, {
        method: 'POST',
        headers: headers, // Only Authorization header, no Content-Type
        body: formData
      });

      devLog('=== API RESPONSE STATUS ===');
      devLog('Status:', response.status);
      devLog('Status Text:', response.statusText);
      devLog('OK:', response.ok);
      devLog('Headers:', Object.fromEntries(response.headers.entries()));

      let responseData;
      try {
        const responseText = await response.text();
        devLog('🔧 Raw response text:', responseText);
        
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

      devLog('=== FINAL API RESPONSE ===');
      devLog('dashboardAPI.uploadPhotosFromMediaWithOutMemory: Full API Response:', responseData);

      const result = {
        success: response.ok,
        data: responseData,
        error: response.ok ? undefined : responseData?.message || responseData?.error || `HTTP ${response.status}: ${response.statusText}`
      };

      devLog('🔧 Final result:', result);
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
    devLog('🔍 DEBUG: Adding moment with data:', momentData);
    
    try {
      const formData = new FormData();
      formData.append('description', momentData.description);
      formData.append('date', momentData.date);
      formData.append('location', momentData.location);
      formData.append('memory_id', momentData.memory_id);
      
      if (momentData.image) {
        formData.append('image', momentData.image);
      }

      devLog('🔍 DEBUG: FormData contents:');
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          devLog(`  ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
        } else {
          devLog(`  ${key}: "${value}"`);
        }
      }

      // For FormData, we need to manually handle headers to avoid Content-Type conflicts
      const token = tokenUtils.getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      // Do NOT set Content-Type for FormData - browser will set it with boundary

      devLog('🔍 DEBUG: Making request to:', `${API_BASE_URL}/memories/upload-photos-after-creation`);
      devLog('🔍 DEBUG: Request headers:', headers);
      devLog('🔍 DEBUG: FormData size:', Array.from(formData.entries()).length, 'entries');

      const response = await fetch(`${API_BASE_URL}/memories/upload-photos-after-creation`, {
        method: 'POST',
        headers,
        body: formData,
      });

      devLog('🔍 DEBUG: Response status:', response.status, response.statusText);
      devLog('🔍 DEBUG: Response headers:', Object.fromEntries(response.headers.entries()));

      const responseData = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: responseData.message || responseData.error || `HTTP ${response.status}`,
        };
      }

      devLog('🔍 DEBUG: Add moment API response:', responseData);
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
    devLog(`dashboardAPI.actionOnInvitation: ${status === 1 ? 'Accepting' : 'Rejecting'} invitation for memory ID ${memoryId}`);
    devLog('Memory ID:', memoryId);
    devLog('Status:', status, status === 1 ? '(Accept)' : '(Reject)');
    devLog('Notification ID:', notificationId);
    devLog(`API URL: /memories/invitation/action/${memoryId}`);

    const requestBody = {
      status: status,
      notification_id: notificationId
    };

    devLog('Request body:', requestBody);

    return await apiRequest(`/memories/invitation/action/${memoryId}`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  // Request full access to a memory
  requestFullAccess: async (memoryId: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.requestFullAccess: Requesting full access for memory ID ${memoryId}`);
    devLog(`API URL: /memories/${memoryId}/request-full-access`);

    return await apiRequest(`/memories/${memoryId}/request-full-access`, {
      method: 'POST',
    });
  },

  // Remove shared memory from current user's collection
  removeSharedWithMemory: async (memoryId: string, userId: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.removeSharedWithMemory: Removing memory ID ${memoryId} for user ID ${userId}`);
    devLog(`API URL: /memories/${memoryId}/remove-shared-user`);

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
    devLog('🚨 DEBUG: Calling /user/collaborators-and-non-collaborators API');

    // Build URL with search and property_id parameters if provided
    let url = '/user/collaborators-and-non-collaborators';
    const params = new URLSearchParams();

    if (searchQuery && searchQuery.trim()) {
      params.append('search', searchQuery.trim());
      devLog('🔍 Adding search parameter:', searchQuery.trim());
    }

    if (propertyId) {
      params.append('property_id', propertyId.toString());
      devLog('🏠 Adding property_id parameter:', propertyId);
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await apiRequest(url, {
      method: 'GET',
    });
    devLog('🚨 DEBUG: /user/collaborators-and-non-collaborators API raw response:', response);
    return response;
  },

  // Get collaborators for magic link flow (with email and role)
  getCollaboratorsForMagicLink: async (email: string, role: string = 'admin'): Promise<ApiResponse<any>> => {
    devLog('🔗 DEBUG: Calling magic link collaborators API');
    devLog('🔗 Email:', email, 'Role:', role);

    const params = new URLSearchParams({
      email: email,
      role: role
    });

    const url = `/user/collaborators-and-non-collaborators?${params.toString()}`;

    const response = await apiRequest(url, {
      method: 'GET',
    });

    devLog('🔗 DEBUG: Magic link collaborators API response:', response);
    return response;
  },

  // Get my collaboration associations (memories where I'm a collaborator)
  getMyCollaborationAssociations: async (): Promise<ApiResponse<any>> => {
    devLog('🤝 DEBUG: Calling /memories/my-collaboration-associations API');
    const response = await apiRequest('/user/my-collaboration-associations', {
      method: 'GET',
    });
    devLog('🤝 DEBUG: /memories/my-collaboration-associations API raw response:', response);
    return response;
  },

  // Remove collaboration association (remove user from shared memory)
  removeCollaborationAssociation: async (collaborationId: number): Promise<ApiResponse<any>> => {
    devLog('🗑️ DEBUG: Removing collaboration association:', collaborationId);
    const response = await apiRequest(`/user/collaboration-associations/${collaborationId}`, {
      method: 'DELETE',
    });
    devLog('🗑️ DEBUG: Remove collaboration association response:', response);
    return response;
  },

  // Search memories with optional search query
  searchMemories: async (searchQuery?: string): Promise<ApiResponse<any>> => {
    const url = searchQuery
      ? `/memories/search?search_memory=${encodeURIComponent(searchQuery)}`
      : '/memories/search';

    devLog('🔍 DEBUG: Calling memories search API:', url);
    const response = await apiRequest(url, {
      method: 'GET',
    });
    devLog('🔍 DEBUG: Memories search API response:', response);
    return response;
  },

  // Delete user collaborator (for Users page)
  deleteUserCollaborator: async (collaboratorUserId?: number, collaboratorEmail?: string, collaboratorType?: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.deleteUserCollaborator: Deleting user collaborator`);
    devLog('Collaborator User ID:', collaboratorUserId);
    devLog('Collaborator Email:', collaboratorEmail);
    devLog('Collaborator Type:', collaboratorType);

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

    devLog('API Request Body:', requestBody);
    devLog(`API URL: /user/delete-user-collaborator`);

    return await apiRequest('/user/delete-user-collaborator', {
      method: 'DELETE',
      body: JSON.stringify(requestBody),
    });
  },

  // Get AI suggested description for image
  getSuggestedDescription: async (imageUrl: string, tone?: string, memoryId?: string, noCredit?: boolean): Promise<ApiResponse<any>> => {
    devLog('🤖 Calling AI suggested description API for image:', imageUrl, 'with tone:', tone, 'memoryId:', memoryId, 'and noCredit:', noCredit);

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
    devLog(`dashboardAPI.analyzeUploadedPhotos: Analyzing ${photos.length} photos with cluster_type: ${cluster_type || 'all'} and memoryId: ${memoryId}`);

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
    devLog(`dashboardAPI.createMemoryFromSentence: Creating memory from prompt with ${memory.length} files`);

    return await apiRequest('/ai/create-memory-from-sentence', {
      method: 'POST',
      body: JSON.stringify({ prompt, memory }),
    });
  },

  // AI Memory Wizard - Create memory from AI response
  createMemoryFromAIResponse: async (ai_response: any): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.createMemoryFromAIResponse: Creating memory from AI response`);
    devLog('AI Response data being sent:', ai_response);

    return await apiRequest('/ai/create-memory-from-ai-response', {
      method: 'POST',
      body: JSON.stringify({ ai_response }),
    });
  },

  // AI Memory Wizard - Create memories from photo groups (faces, moments, objects)
  createMemoriesFromGroups: async (groupData: any, type: 'faces' | 'moments' | 'objects'): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.createMemoriesFromGroups: Creating memories from ${type} groups`);
    devLog('Group data being sent:', groupData);

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
    devLog(`dashboardAPI.acceptSuggestedCategory: Accepting suggested category for memory ${memoryId}`);
    devLog('API URL: /ai/suggested/accept');
    devLog('Request body:', { memory_id: memoryId });

    return await apiRequest('/ai/suggested/accept', {
      method: 'POST',
      body: JSON.stringify({ memory_id: memoryId }),
    });
  },

  // Reject suggested category for a memory
  rejectSuggestedCategory: async (memoryId: string): Promise<ApiResponse<any>> => {
    devLog(`dashboardAPI.rejectSuggestedCategory: Rejecting suggested category for memory ${memoryId}`);
    devLog('API URL: /ai/suggested/reject');
    devLog('Request body:', { memory_id: memoryId });

    return await apiRequest('/ai/suggested/reject', {
      method: 'POST',
      body: JSON.stringify({ memory_id: memoryId }),
    });
  },

  // Get AI Library faces (grouped face clusters)
  getLibraryFaces: async (): Promise<ApiResponse<any>> => {
    devLog('📚 dashboardAPI.getLibraryFaces: Fetching library faces');
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
    devLog('🔗 dashboardAPI.assignMediaToFaces:', params);
    return await apiRequest('/ai/library/faces/assign-media', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // Get media library data (all images from all categories and unassigned)
  getMediaLibraryData: async (): Promise<ApiResponse<any>> => {
    devLog('📚 dashboardAPI.getMediaLibraryData: Fetching media library data');
    devLog('📚 API URL: /media');

    return await apiRequest('/media', {
      method: 'GET',
    });
  },

  // ============= Service Sync APIs =============

  // Initiate OAuth connection for a service
  connectService: async (serviceType: string): Promise<ApiResponse<{ auth_url: string }>> => {
    devLog(`🔗 dashboardAPI.connectService: Initiating connection for ${serviceType}`);
    return await apiRequest(`/services/connect/${serviceType}`, {
      method: 'GET',
    });
  },

  // Exchange OAuth token after callback
  exchangeServiceToken: async (serviceType: string, code: string, state?: string): Promise<ApiResponse<any>> => {
    devLog(`🔑 dashboardAPI.exchangeServiceToken: Exchanging token for ${serviceType}`);
    return await apiRequest(`/services/exchange-token/${serviceType}`, {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    });
  },

  // Disconnect a service
  disconnectService: async (userId: number, serviceName: string): Promise<ApiResponse<any>> => {
    devLog(`🔌 dashboardAPI.disconnectService: Disconnecting ${serviceName} for user ${userId}`);
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
    devLog(`🔄 dashboardAPI.syncService: Syncing ${serviceType}`);
    return await apiRequest(`/services/sync/${serviceType}`, {
      method: 'POST',
    });
  },

  // Get connected services status
  getConnectedServices: async (): Promise<ApiResponse<{ services: any[] }>> => {
    devLog('📡 dashboardAPI.getConnectedServices: Fetching connected services');
    return await apiRequest('/user/connected-services', {
      method: 'GET',
    });
  },

  // Get synced media from connected services
  getSyncedMedia: async (serviceType?: string, page: number = 1): Promise<ApiResponse<any>> => {
    devLog('📡 dashboardAPI.getSyncedMedia: Fetching synced media', serviceType ? `for ${serviceType}` : 'for all services', `page ${page}`);
    let url = serviceType ? `/services/synced-media?service=${serviceType}` : '/services/synced-media';
    url += `${serviceType ? '&' : '?'}page=${page}`;
    return await apiRequest(url, {
      method: 'GET',
    });
  },

  // Get fresh media URLs for expired Dropbox/service links
  getFreshMediaUrls: async (mediaIds: string[]): Promise<ApiResponse<any>> => {
    devLog('🔄 dashboardAPI.getFreshMediaUrls: Refreshing URLs for', mediaIds.length, 'media items');
    return await apiRequest('/services/get-fresh-media-urls', {
      method: 'POST',
      body: JSON.stringify({ media_ids: mediaIds }),
    });
  },

  // Resync Dropbox paths (re-fetch all media from Dropbox)
  resyncDropboxPaths: async (): Promise<ApiResponse<any>> => {
    devLog('🔄 dashboardAPI.resyncDropboxPaths: Re-syncing Dropbox media...');
    return await apiRequest('/services/resync-dropbox-paths', {
      method: 'POST',
    });
  },

  // Get Dropbox media IDs
  getDropboxMediaIds: async (): Promise<ApiResponse<any>> => {
    devLog('🔄 dashboardAPI.getDropboxMediaIds: Fetching Dropbox media IDs...');
    return await apiRequest('/services/dropbox-media-ids', {
      method: 'GET',
    });
  },

  // Save synced media from external service (Facebook, etc.)
  saveSyncedMedia: async (data: { service: string; photos: any[]; access_token?: string }): Promise<ApiResponse<any>> => {
    devLog(`💾 dashboardAPI.saveSyncedMedia: Saving ${data.photos.length} photos from ${data.service}`);
    return await apiRequest('/services/save-synced-media', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getNotificationPreferences: async (): Promise<ApiResponse<any>> => {
    devLog('📩 Fetching notification preferences');
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
    // Real category id, or the literal "shopify"/"cars". Omit or pass null to
    // leave the previously saved value untouched (the backend won't overwrite it).
    category_id?: number | string | null;
  }): Promise<ApiResponse<any>> => {
    devLog('📩 Updating notification preferences:', preferences);
    return await apiRequest('/user/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  },

  // Get all properties
  getProperties: async (): Promise<ApiResponse<any>> => {
    devLog('🏠 dashboardAPI.getProperties: Fetching properties');
    return await apiRequest('/properties', {
      method: 'GET',
    });
  },

  // Search properties by name
  searchProperties: async (searchQuery: string): Promise<ApiResponse<any>> => {
    devLog('🔍 dashboardAPI.searchProperties: Searching properties with query:', searchQuery);
    return await apiRequest(`/properties?search=${encodeURIComponent(searchQuery)}`, {
      method: 'GET',
    });
  },

  // Create a new property
  createProperty: async (formData: FormData): Promise<ApiResponse<any>> => {
    devLog('🏠 dashboardAPI.createProperty: Creating new property');
    try {
      const token = localStorage.getItem('stasht_token');

      // Log form data for debugging
      devLog('📝 Form data entries:');
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          devLog(`  ${key}:`, value.name, `(${value.size} bytes)`);
        } else {
          devLog(`  ${key}:`, value);
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
      devLog('📥 Create property response:', data);

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
    devLog(`🔗 dashboardAPI.createPropertyInviteLink: Creating invite link for property ${propertyId}`);
    return await apiRequest(`/properties/${propertyId}/invite-link`, {
      method: 'GET',
    });
  },

  // Get property memories
  getPropertyMemories: async (propertyId: number, page: number = 1): Promise<ApiResponse<any>> => {
    devLog(`🏠 dashboardAPI.getPropertyMemories: Fetching memories for property ${propertyId}, page ${page}`);
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
  registerPropertyUser: async (token: string, data: { invite_token: string; name: string; email?: string; phone_number?: string; password?: string; verification_token?: string }): Promise<ApiResponse<any>> => {
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

  joinViaInvite: async (data: { invite_token: string; email?: string; phone_number?: string }): Promise<ApiResponse<any>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/account/join-via-invite`, {
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
    devLog(`🏠 inviteToMemory: POST /properties/${propertyId}/invite-to-memory`);
    devLog('Payload:', data);
    return await apiRequest(`/properties/${propertyId}/invite-to-memory`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Send invite to non-existing user to join a property
  sendPropertyInvite: async (propertyId: number, data: { email?: string; phone_number?: string }): Promise<ApiResponse<any>> => {
    devLog(`🏠 sendPropertyInvite: POST /properties/${propertyId}/send-invite`);
    devLog('Payload:', data);
    return await apiRequest(`/properties/${propertyId}/send-invite`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Add user (existing or new) to property as collaborator
  addUserToProperty: async (data: { property_id: number; email?: string; phone_number?: string }): Promise<ApiResponse<any>> => {
    devLog('🏠 addUserToProperty: Calling /properties/register');
    devLog('Payload:', data);
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
    devLog(`🔄 dashboardAPI.updateProperty: Updating property ${propertyId}`);
    try {
      const token = localStorage.getItem('stasht_token');

      if (!token) {
        return {
          success: false,
          error: 'No authentication token found',
        };
      }

      // Log form data for debugging
      devLog('📝 Form data entries:');
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          devLog(`  ${key}:`, value.name, `(${value.size} bytes)`);
        } else {
          devLog(`  ${key}:`, value);
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
      devLog('📥 Update property response:', data);

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
    devLog(`🗑️ dashboardAPI.deleteProperty: Deleting property ${propertyId}`);
    return await apiRequest(`/properties/${propertyId}`, {
      method: 'DELETE',
    });
  },

  // Update property status (activate/deactivate)
  updatePropertyStatus: async (propertyId: number, status: boolean): Promise<ApiResponse<any>> => {
    devLog(`🔄 dashboardAPI.updatePropertyStatus: Updating status for property ${propertyId} to ${status}`);
    return await apiRequest(`/properties/${propertyId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  // Purchase property — creates payment intent (Flow 1: multipart with property data, Flow 2: JSON with property_id)
  purchaseProperty: async (data: FormData | { quantity: number; property_id: number }): Promise<ApiResponse<any>> => {
    devLog('💳 dashboardAPI.purchaseProperty: Creating property payment intent');
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
      devLog('💳 purchaseProperty response:', json);

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
    devLog('✅ dashboardAPI.confirmPropertyPayment:', paymentIntentId);
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

  // ============= Shopify API =============

  // Kick off the OAuth flow — returns the Shopify authorize URL to redirect the user to.
  shopifyGetAuthUrl: async (shop: string): Promise<ApiResponse<{ auth_url: string }>> => {
    return await apiRequest(`/auth/shopify?shop=${encodeURIComponent(shop)}`, { method: 'GET' });
  },

  shopifyGetStatus: async (): Promise<ApiResponse<{ connected: boolean; shop_domain?: string; connected_at?: string }>> => {
    return await apiRequest('/integrations/shopify/status', { method: 'GET' });
  },

  shopifyDisconnect: async (): Promise<ApiResponse<{ success: boolean; message: string }>> => {
    return await apiRequest('/integrations/shopify/disconnect', { method: 'DELETE' });
  },

  // Synced products from Stasht's DB (fast). Optional filters: category, search, status.
  shopifyGetProducts: async (filters?: { category?: string; search?: string; status?: string }): Promise<ApiResponse<{ success: boolean; count: number; products: any[] }>> => {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();
    return await apiRequest(`/shopify/products${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  // Shopify collections (used as category filters).
  shopifyGetListings: async (): Promise<ApiResponse<{ success: boolean; collections: any[] }>> => {
    return await apiRequest('/shopify/listings', { method: 'GET' });
  },

  // Full catalog: collections each with their nested products. Used to render the read-only
  // "Shopify" box in the memories-page category sidebar (collection = campaign, product = moment).
  shopifyGetCatalog: async (): Promise<ApiResponse<{ success: boolean; count: number; collections: any[] }>> => {
    return await apiRequest('/shopify/catalog', { method: 'GET' });
  },

  // Single collection's detail (its products) — parallel to getMemoryDetail. Used to render
  // a Shopify collection in the memory-detail page layout (collection = campaign/memory).
  shopifyGetCatalogDetail: async (collectionId: string): Promise<ApiResponse<{ success: boolean; collection: any }>> => {
    return await apiRequest(`/shopify/catalog/${encodeURIComponent(collectionId)}`, { method: 'GET' });
  },

  // Pull new/updated products from Shopify into Stasht. Empty body.
  shopifySync: async (): Promise<ApiResponse<{ success: boolean; message: string; added: number; updated: number; total: number }>> => {
    return await apiRequest('/shopify/sync', { method: 'POST' });
  },

  // ============= Cars API =============

  // Read-only car inventory feed. Used to render the "Cars" box in the memories-page
  // category sidebar and the Cars cards on the main grid, both grouped by each car's
  // `category` field (e.g. preowned/hybrid). per_page=100 pulls the whole inventory in one
  // call since /cars paginates at 20/page by default and grouping needs the full set.
  carsGetCatalog: async (): Promise<ApiResponse<{ status: number; data: { cars: any[]; pagination: any; filters: any } }>> => {
    return await apiRequest('/cars?per_page=100', { method: 'GET' });
  },

  // Single car's detail (full spec + images) — accepts either car.id or car.stock_number.
  // Used to render a car in the memory-detail page layout (car = campaign, image = post).
  carsGetDetail: async (id: string | number): Promise<ApiResponse<{ status: number; data: any }>> => {
    return await apiRequest(`/cars/${encodeURIComponent(String(id))}`, { method: 'GET' });
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
    devLog('⏰ No last_sync value, treating as outdated');
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
      devLog('⏰ Last sync was "just now", treating as < 4 hours');
    } else if (relativeTimeMatch) {
      // Parse relative time string
      const value = parseInt(relativeTimeMatch[1], 10);
      const unit = relativeTimeMatch[2].toLowerCase();

      devLog('⏰ Parsing relative time:', { value, unit });

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

      devLog('⏰ Relative time check:', {
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

      devLog('⏰ Timestamp check:', {
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
      devLog('📡 servicesAPI.deleteSyncedMediaBatch called with:', mediaIds);

      const token = tokenUtils.getToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const requestBody = { media_ids: mediaIds };
      devLog('📡 Request URL:', `${API_BASE_URL}/services/synced-media/delete-multiple`);
      devLog('📡 Request body:', requestBody);

      const response = await fetch(`${API_BASE_URL}/services/synced-media/delete-multiple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      devLog('📡 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('📡 Error response:', errorData);
        throw new Error(errorData.message || `Failed to delete synced media: ${response.status}`);
      }

      const data = await response.json();
      devLog('📡 Success response:', data);
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
    devLog(`🔐 dashboardAPI.getGoogleAuthUrl: Getting Google auth URL for ${intent}`);
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
    devLog('🔐 dashboardAPI.googleAuthCallback: Handling Google OAuth callback');
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
    devLog('🔗 dashboardAPI.linkGoogleAccount: Linking Google account');
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
    devLog('🔗 dashboardAPI.unlinkGoogleAccount: Unlinking Google account');
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
    devLog('📸 dashboardAPI.getGooglePhotosAuthUrl: Getting Google Photos auth URL');
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
    devLog('📸 dashboardAPI.googlePhotosCallback: Handling Google Photos callback');
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