import { useCallback } from 'react';

// Global refresh callbacks storage
let globalNotificationsRefreshCallback: (() => void) | null = null;

// Global notifications refresh manager
export const notificationsRefreshManager = {
  // Register the refresh callback (from NotificationDropdown)
  register: (callback: () => void) => {
    globalNotificationsRefreshCallback = callback;
    console.log('🔔 Notifications refresh callback registered');
  },
  
  // Unregister the refresh callback
  unregister: () => {
    globalNotificationsRefreshCallback = null;
    console.log('🔔 Notifications refresh callback unregistered');
  },
  
  // Trigger notifications refresh
  refresh: () => {
    if (globalNotificationsRefreshCallback) {
      console.log('🔄 Triggering notifications refresh from manager');
      globalNotificationsRefreshCallback();
    } else {
      console.warn('⚠️ No notifications refresh callback registered');
    }
  }
};

// Hook for NotificationDropdown to register refresh callback
export const useNotificationsRefreshProvider = (refreshCallback: () => void) => {
  return useCallback(() => {
    notificationsRefreshManager.register(refreshCallback);
    return () => {
      notificationsRefreshManager.unregister();
    };
  }, [refreshCallback]);
};

// Hook for components to trigger refresh (used by MemoryCard, MemoriesPage, etc.)
export const useNotificationsRefresh = () => {
  return useCallback(() => {
    notificationsRefreshManager.refresh();
  }, []);
};

// Helper function to trigger refresh from anywhere
export const triggerNotificationsRefresh = () => {
  notificationsRefreshManager.refresh();
};