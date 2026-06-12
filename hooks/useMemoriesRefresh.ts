import { useCallback } from 'react';

// Global refresh callbacks storage
let globalMemoriesRefreshCallback: (() => void) | null = null;

// Global memories refresh manager
export const memoriesRefreshManager = {
  // Register the refresh callback (from App.tsx)
  register: (callback: () => void) => {
    globalMemoriesRefreshCallback = callback;
  },
  
  // Unregister the refresh callback
  unregister: () => {
    globalMemoriesRefreshCallback = null;
  },
  
  // Trigger memories refresh
  refresh: () => {
    if (globalMemoriesRefreshCallback) {
      console.log('🔄 Triggering memories refresh from manager');
      globalMemoriesRefreshCallback();
    } else {
      console.warn('⚠️ No memories refresh callback registered');
    }
  }
};

// Hook for components to register refresh callback (used by App.tsx)
export const useMemoriesRefreshProvider = (refreshCallback: () => void) => {
  return useCallback(() => {
    memoriesRefreshManager.register(refreshCallback);
    return () => {
      memoriesRefreshManager.unregister();
    };
  }, [refreshCallback]);
};

// Hook for components to trigger refresh (used by NotificationDropdown)
export const useMemoriesRefresh = () => {
  return useCallback(() => {
    memoriesRefreshManager.refresh();
  }, []);
};

// Helper function to trigger refresh from anywhere
export const triggerMemoriesRefresh = () => {
  memoriesRefreshManager.refresh();
};