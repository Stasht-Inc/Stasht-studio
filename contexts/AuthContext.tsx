import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI, tokenUtils, userUtils, dashboardAPI } from '../utils/authUtils';
import { initializeAccountCreation } from '../utils/passwordSecurityStorage';
import SessionValidator from '../utils/sessionValidator';
import { resetMediaCache } from '../services/mediaAPI';
import { crossTabAuth } from '../utils/crossTabAuth';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  profile_color?: string;
  role?: string;
  phone_number?: string;
  bio?: string;
  location?: string;
  change_password?: number;
  is_internal?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, phone_number?: string, oauthToken?: string, oauthUser?: any) => Promise<boolean>;
  register: (name: string, email: string, password: string, phone_number?: string) => Promise<{success: boolean, message?: string, errors?: any, collaborators?: any[]}>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);

  // CRITICAL FIX: Fast-path for invite links with login=1 - skip initial loading
  const urlParams = new URLSearchParams(window.location.search);
  const isInviteLoginPage = urlParams.get('invite') === '1' && urlParams.get('login') === '1';
  const [isLoading, setIsLoading] = useState(!isInviteLoginPage); // Skip loading if invite+login

  useEffect(() => {
    // FAST PATH: If this is an invite login page, skip LOADING SPINNER but still check auth
    // CRITICAL: We must still check localStorage in case user just logged in
    if (isInviteLoginPage) {
      console.log('⚡ AuthContext: FAST PATH - Invite login page detected');

      // Check if user is already logged in (after successful login)
      const storedUser = localStorage.getItem('stasht_user');
      const storedToken = localStorage.getItem('stasht_token');

      if (storedUser && storedToken) {
        console.log('✅ User already logged in on invite page - loading user');
        // User is logged in, proceed with normal auth check
        // Fall through to checkStoredAuth below
      } else {
        console.log('⚡ No user in storage - showing login page immediately');
        setIsLoading(false);
        // Still need to set up storage listener for cross-tab auth
        const handleStorageChange = (e: StorageEvent) => {
          if (e.key === 'stasht_token' || e.key === 'stasht_user') {
            if (e.newValue !== null && e.oldValue === null) {
              // User logged in in another tab, reload this tab
              window.location.reload();
            }
          }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => {
          window.removeEventListener('storage', handleStorageChange);
        };
      }
    }

    // Check for stored authentication on app load
    const checkStoredAuth = () => {
      console.log('🔵 AuthContext: checkStoredAuth STARTED');

      try {
        const storedUser = localStorage.getItem('stasht_user');
        const storedToken = localStorage.getItem('stasht_token');

        console.log('🔵 Stored user exists:', !!storedUser);
        console.log('🔵 Stored token exists:', !!storedToken);

        if (storedUser && storedToken) {
          try {
            const parsedUser = JSON.parse(storedUser);
            console.log('✅ User authenticated from localStorage:', parsedUser.email || parsedUser.phone_number);
            setUser(parsedUser);
            dashboardAPI.autoMarkImagesSeen().catch(() => {});
          } catch (parseError) {
            console.error('❌ Error parsing stored user:', parseError);
            localStorage.removeItem('stasht_user');
            localStorage.removeItem('stasht_token');
            setUser(null);
          }
        } else {
          console.log('⚠️ No stored auth data found');
          setUser(null);
        }
      } catch (error) {
        console.error('❌ Error in checkStoredAuth:', error);
        setUser(null);
      } finally {
        console.log('🔵 Setting isLoading to false');
        setIsLoading(false);
        console.log('🔵 AuthContext: checkStoredAuth COMPLETED');
      }
    };

    checkStoredAuth();

    // CRITICAL FIX: Safeguard timeout to ensure isLoading is set to false
    // even if something goes wrong with the checkStoredAuth function
    const timeoutId = setTimeout(() => {
      console.log('⏰ AuthContext: Timeout safeguard - ensuring isLoading is false');
      console.log('⏰ Current isLoading state:', isLoading);
      setIsLoading(false);
      console.log('⏰ isLoading forcefully set to false by timeout');
    }, 500); // 500ms timeout for instant response

    // Cross-tab session management - listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      // Only handle changes to auth-related storage
      if (e.key === 'stasht_session_change') {
        const currentSessionUser = SessionValidator.getCurrentSessionUser();
        const storedSessionData = e.newValue ? JSON.parse(e.newValue) : null;

        // If a new session is created by a different user, log out current session
        if (storedSessionData && currentSessionUser) {
          // Compare using identifier (can be email or phone_number)
          const storedIdentifier = storedSessionData.email || storedSessionData.phone_number;
          if (currentSessionUser.identifier !== storedIdentifier) {
            console.log('Different user login detected in another tab, logging out current session');
            performCrossTabLogout();
          }
        }
      }

      // Handle direct token/user changes for immediate logout
      if (e.key === 'stasht_token' || e.key === 'stasht_user') {
        // If token or user was removed by another tab, logout locally
        if (e.newValue === null && e.oldValue !== null) {
          console.log('Auth data cleared in another tab, logging out locally');
          setUser(null);
          SessionValidator.clearSession();
          resetMediaCache();
        }
      }
    };

    // Function to perform cross-tab logout without triggering storage events
    const performCrossTabLogout = () => {
      userUtils.clearAuthData();
      SessionValidator.clearSession();
      resetMediaCache();
      setUser(null);
      // Redirect to login without causing storage event loops
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
    };

    // Add storage event listener
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const login = async (email: string, password: string, phone_number?: string, oauthToken?: string, oauthUser?: any): Promise<boolean> => {
    setIsLoading(true);
    console.log('AuthContext: Starting login process...');
    console.log('AuthContext: Login parameters:', { email, phone_number, isOAuth: !!oauthToken });

    // Clear any existing auth data before login (IMPORTANT: clears old expired tokens)
    userUtils.clearAuthData();
    resetMediaCache();
    setUser(null);

    try {
      // If OAuth token and user are provided, use them directly (Google/Facebook signup/login)
      if (oauthToken && oauthUser) {
        console.log('✅ AuthContext: OAuth login - using provided token and user');

        // Store auth data
        localStorage.setItem('stasht_user', JSON.stringify(oauthUser));
        localStorage.setItem('stasht_token', oauthToken);

        setUser(oauthUser);

        console.log('✅ OAuth Token saved:', oauthToken.substring(0, 20) + '...');
        console.log('✅ OAuth User authenticated:', oauthUser.email);
        setIsLoading(false);
        return true;
      }

      // Regular login flow (email/password)
      // Use actual API call
      const response = await authAPI.login({ email, password, phone_number });
      console.log('🔍 AuthContext: Login API response:', response);

      // Check if account needs activation - DON'T throw, just check requiresActivation flag
      if (response.requiresActivation === true) {
        console.log('🎯 AuthContext: Account needs activation - throwing error for LoginPage to catch');
        const errorMessage = response.message || response.error || 'Please activate your account before logging in. Check your email or phone for the activation link/OTP.';
        throw new Error(errorMessage);
      }

      // Check if device verification is required - NEW
      if (response.requires_verification === true && response.attempt_id) {
        console.log('🔐 AuthContext: Device verification required - throwing special error for LoginPage to catch');
        const error: any = new Error(response.message || 'Device verification required');
        error.requiresDeviceVerification = true;
        error.attemptId = response.attempt_id;
        error.deviceInfo = response.device_info;
        throw error;
      }

      // If we have user and token, login is successful
      if (response.success && response.user && response.token) {
        console.log('✅ AuthContext: Login successful! Found user and token');

        // Store auth data
        localStorage.setItem('stasht_user', JSON.stringify(response.user));
        localStorage.setItem('stasht_token', response.token);

        setUser(response.user);
        dashboardAPI.autoMarkImagesSeen().catch(() => {});

        console.log('✅ Token saved:', response.token.substring(0, 20) + '...');
        console.log('✅ User authenticated:', response.user.email);
        return true;
      }

      // If login failed, throw error
      if (response.success === false && response.error) {
        console.log('❌ AuthContext: Login failed:', response.error);
        throw new Error(response.error);
      }

      // If we get here, something is wrong with the response
      console.log('❌ AuthContext: Unexpected response format');
      throw new Error('Login failed - unexpected response from server');

    } catch (error) {
      console.error('❌ Login error:', error);
      setIsLoading(false); // CRITICAL: Stop the full-page spinner
      console.log('✅ AuthContext: setIsLoading(false) called after error');
      throw error; // Always re-throw so LoginPage can catch it
    }
  };

  const register = async (name: string, email: string, password: string, phone_number?: string): Promise<{success: boolean, message?: string, errors?: any, collaborators?: any[]}> => {
    // DON'T set global isLoading here - SignupPage has its own isSubmitting state
    console.log('AuthContext: Starting registration process...');

    try {
      // Use actual API call
      const response = await authAPI.register({ name, email, password, phone_number });
      console.log('AuthContext: Registration API response:', response);

      // Extract collaborators from response
      const collaborators = (response as any).collaborators || [];
      console.log('AuthContext: Collaborators in registration response:', collaborators);

      if (response.success) {
        console.log('🔍 Registration response debug:', {
          hasMessage: !!response.message,
          hasUser: !!response.user,
          hasToken: !!response.token,
          userActivated: response.user?.is_activated,
          requiresActivation: (response as any).requiresActivation,
          message: response.message,
          collaborators: collaborators
        });

        // Check if this is activation flow (user needs activation)
        if (response.message && response.user?.is_activated === false) {
          console.log('AuthContext: Registration successful, activation required');
          console.log('Returning activation message:', response.message);
          console.log('Returning collaborators:', collaborators);
          return { success: true, message: response.message, collaborators: collaborators };
        }

        // Check if user is activated and has token - direct login
        else if (response.user && response.token && response.user.is_activated !== false) {
          console.log('AuthContext: Registration successful with direct login');
          // Store auth data
          localStorage.setItem('stasht_user', JSON.stringify(response.user));
          localStorage.setItem('stasht_token', response.token);

          setUser(response.user);

          return { success: true, collaborators: collaborators };
        }

        // If we have a message and requiresActivation flag, return the message
        else if (response.message && (response as any).requiresActivation) {
          console.log('AuthContext: Activation flow detected, returning message:', response.message);
          console.log('Returning collaborators:', collaborators);
          return { success: true, message: response.message, collaborators: collaborators };
        }
      }

      // Handle validation errors
      if ((response as any).errors) {
        console.log('🔍 AuthContext: Found validation errors:', (response as any).errors);
        const result = {
          success: false,
          message: response.error || 'Registration failed',
          errors: (response as any).errors
        };
        console.log('🔍 AuthContext: Returning error result:', result);
        return result;
      }

      return { success: false, message: response.error || 'Registration failed' };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Registration failed' };
    }
  };

  const logout = async () => {
    console.log('AuthContext: Logging out user');

    // Call the logout API endpoint
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout API error:', error);
    }

    // Clear authentication data
    userUtils.clearAuthData();
    resetMediaCache();

    // Force a hard page reload BEFORE setting user to null
    // This prevents React from re-rendering with null user (which causes ErrorBoundary to trigger)
    // The user state will be reset when the page reloads
    window.location.href = '/login';

    // Note: setUser(null) removed - not needed since we're doing a hard redirect
    // Setting it would trigger a re-render that causes components to crash before redirect happens
  };

  const updateUser = (userData: Partial<User>) => {
    console.log('🔄 AuthContext.updateUser: Called with data:', userData);
    console.log('🔄 AuthContext.updateUser: Current user:', user);
    if (user) {
      const updatedUser = { ...user, ...userData };
      console.log('🔄 AuthContext.updateUser: New merged user:', updatedUser);
      console.log('🔄 AuthContext.updateUser: New location:', updatedUser.location);
      setUser(updatedUser);
      localStorage.setItem('stasht_user', JSON.stringify(updatedUser));
      console.log('🔄 AuthContext.updateUser: User state and localStorage updated');
      console.log('🔄 AuthContext.updateUser: Stored in localStorage:', JSON.parse(localStorage.getItem('stasht_user') || '{}'));
    } else {
      console.log('🔄 AuthContext.updateUser: No user to update');
    }
  };

  const isAuthenticated = !!user;
  
  // Debug logging for authentication state changes
  useEffect(() => {
    console.log('AuthContext: Authentication state changed:', {
      user: user ? { id: user.id, email: user.email } : null,
      isAuthenticated,
      isLoading
    });
  }, [user, isAuthenticated, isLoading]);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;