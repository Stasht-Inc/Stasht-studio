// Cross-tab authentication communication utility
// Prevents multiple users from logging in on the same browser

import React from 'react';

export interface AuthState {
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
  name?: string;
  timestamp: number;
}

export interface LoginBlockMessage {
  type: 'LOGIN_BLOCKED' | 'LOGOUT_DETECTED' | 'LOGIN_SUCCESS' | 'AUTH_CHECK';
  currentUser?: {
    id: string;
    email: string;
    name: string;
  };
  timestamp: number;
}

class CrossTabAuthManager {
  private broadcastChannel: BroadcastChannel | null = null;
  private storageKey = 'stasht_cross_tab_auth';
  private listeners: ((message: LoginBlockMessage) => void)[] = [];

  constructor() {
    this.init();
  }

  private init() {
    // Try to use BroadcastChannel if available, fallback to localStorage
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('stasht_auth_channel');
      this.broadcastChannel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } else {
      // Fallback to localStorage events for older browsers
      window.addEventListener('storage', this.handleStorageChange.bind(this));
    }
  }

  private handleMessage(message: LoginBlockMessage) {
    console.log('CrossTabAuth: Received message:', message);
    this.listeners.forEach(listener => listener(message));
  }

  private handleStorageChange(event: StorageEvent) {
    if (event.key === this.storageKey && event.newValue) {
      try {
        const message: LoginBlockMessage = JSON.parse(event.newValue);
        this.handleMessage(message);
      } catch (error) {
        console.error('CrossTabAuth: Error parsing storage message:', error);
      }
    }
  }

  // Send message to all tabs
  public sendMessage(message: LoginBlockMessage) {
    console.log('CrossTabAuth: Sending message:', message);

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(message);
    } else {
      // Fallback to localStorage
      localStorage.setItem(this.storageKey, JSON.stringify(message));
      // Clear after a short delay to allow other tabs to receive it
      setTimeout(() => {
        localStorage.removeItem(this.storageKey);
      }, 1000);
    }
  }

  // Get current auth state across tabs
  public getCurrentAuthState(): AuthState | null {
    try {
      const authData = localStorage.getItem('stasht_user');
      const tokenData = localStorage.getItem('stasht_token');

      if (authData && tokenData) {
        const user = JSON.parse(authData);
        return {
          isAuthenticated: true,
          userId: user.id,
          email: user.email,
          name: user.name,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.error('CrossTabAuth: Error getting auth state:', error);
    }

    return null;
  }

  // Check if someone is already logged in
  public isAnyUserLoggedIn(): { isLoggedIn: boolean; currentUser?: any } {
    const authState = this.getCurrentAuthState();

    if (authState && authState.isAuthenticated) {
      return {
        isLoggedIn: true,
        currentUser: {
          id: authState.userId,
          email: authState.email,
          name: authState.name
        }
      };
    }

    return { isLoggedIn: false };
  }

  // Block login attempt if someone else is logged in
  public attemptLogin(newUserEmail: string): { allowed: boolean; currentUser?: any; message?: string } {
    const currentState = this.isAnyUserLoggedIn();

    if (currentState.isLoggedIn && currentState.currentUser) {
      // Check if it's the same user trying to login
      if (currentState.currentUser.email === newUserEmail) {
        return { allowed: true };
      }

      // Different user - block the login
      const message = `Already logged in as ${currentState.currentUser.name || currentState.currentUser.email}, please logout first.`;

      // Notify other tabs about the blocked login attempt
      this.sendMessage({
        type: 'LOGIN_BLOCKED',
        currentUser: currentState.currentUser,
        timestamp: Date.now()
      });

      return {
        allowed: false,
        currentUser: currentState.currentUser,
        message
      };
    }

    return { allowed: true };
  }

  // Notify about successful login
  public notifyLoginSuccess(user: any) {
    this.sendMessage({
      type: 'LOGIN_SUCCESS',
      currentUser: user,
      timestamp: Date.now()
    });
  }

  // Notify about logout
  public notifyLogout() {
    this.sendMessage({
      type: 'LOGOUT_DETECTED',
      timestamp: Date.now()
    });
  }

  // Add event listener for cross-tab messages
  public onMessage(listener: (message: LoginBlockMessage) => void) {
    this.listeners.push(listener);

    // Return cleanup function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Cleanup
  public destroy() {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    window.removeEventListener('storage', this.handleStorageChange.bind(this));
    this.listeners = [];
  }
}

// Export singleton instance
export const crossTabAuth = new CrossTabAuthManager();

// React hook for easy integration
export function useCrossTabAuth() {
  const [authState, setAuthState] = React.useState<AuthState | null>(
    crossTabAuth.getCurrentAuthState()
  );

  const [lastMessage, setLastMessage] = React.useState<LoginBlockMessage | null>(null);

  React.useEffect(() => {
    // Listen for cross-tab messages
    const cleanup = crossTabAuth.onMessage((message) => {
      setLastMessage(message);

      // Update auth state based on message type
      if (message.type === 'LOGOUT_DETECTED') {
        setAuthState(null);
      } else if (message.type === 'LOGIN_SUCCESS' && message.currentUser) {
        setAuthState({
          isAuthenticated: true,
          userId: message.currentUser.id,
          email: message.currentUser.email,
          name: message.currentUser.name,
          timestamp: message.timestamp
        });
      }
    });

    // Cleanup on unmount
    return cleanup;
  }, []);

  return {
    authState,
    lastMessage,
    isAnyUserLoggedIn: () => crossTabAuth.isAnyUserLoggedIn(),
    attemptLogin: (email: string) => crossTabAuth.attemptLogin(email),
    notifyLoginSuccess: (user: any) => crossTabAuth.notifyLoginSuccess(user),
    notifyLogout: () => crossTabAuth.notifyLogout()
  };
}

export default crossTabAuth;