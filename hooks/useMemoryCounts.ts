import { useState, useEffect, useCallback } from 'react';
import { dashboardAPI, isPartialAdmin } from '../utils/authUtils';
import { useAuth } from '../contexts/AuthContext';

interface MemoryCounts {
  total_memories: number;
  total_memory_images: number;
  published_memories: number;
  total_library_people: number;
}

interface UseMemoryCountsReturn {
  memoryCounts: MemoryCounts | null;
  isLoading: boolean;
  error: string | null;
  refreshMemoryCounts: () => Promise<void>;
}

// Global state for memory counts to share across components
let globalMemoryCounts: MemoryCounts | null = null;
let globalIsLoading = false;
let globalError: string | null = null;
// When true, personal account API counts will not override property account counts
let propertyModeActive = false;

// Subscribers that need to be notified when memory counts change
const subscribers = new Set<() => void>();

// Central memory counts manager
const memoryCountsManager = {
  // Subscribe to memory counts changes
  subscribe: (callback: () => void) => {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  },

  // Notify all subscribers of changes
  notify: () => {
    subscribers.forEach(callback => callback());
  },

  // Update global state and notify subscribers
  updateState: (counts: MemoryCounts | null, loading: boolean, error: string | null) => {
    globalMemoryCounts = counts;
    globalIsLoading = loading;
    globalError = error;
    memoryCountsManager.notify();
  },

  // Get current global state
  getState: (): MemoryCounts | null => {
    return globalMemoryCounts;
  },

  // Enable/disable property mode — prevents personal API counts from overriding property counts
  setPropertyMode: (active: boolean) => {
    propertyModeActive = active;
  },

  // Fetch memory counts from API
  fetchMemoryCounts: async (): Promise<void> => {
    // Partial admin counts are set directly from the memories API response — skip this
    if (isPartialAdmin()) return;
    // In property mode, personal account counts must not be fetched
    if (propertyModeActive) return;

    if (globalIsLoading) {
      console.log('Memory counts already loading, skipping duplicate request');
      return;
    }

    try {
      console.log('🔄 Fetching memory counts from API...');
      memoryCountsManager.updateState(globalMemoryCounts, true, null);

      const [response, libraryResponse] = await Promise.all([
        dashboardAPI.getMemoryCounts(),
        dashboardAPI.getLibraryFaces(),
      ]);

      // By the time the response arrives the view may have switched to property — check again
      if (propertyModeActive) {
        memoryCountsManager.updateState(globalMemoryCounts, false, null);
        return;
      }

      if (response.success && response.data) {
        // Handle double-nested response structure
        let counts: MemoryCounts;
        if (response.data.data?.memory_counts) {
          counts = response.data.data.memory_counts;
        } else if (response.data.memory_counts) {
          counts = response.data.memory_counts;
        } else {
          throw new Error('Invalid response structure');
        }

        // Get library people count from faces API
        const libraryPayload = libraryResponse?.data?.data ?? libraryResponse?.data;
        const facesArray = libraryPayload?.faces ?? [];
        counts.total_library_people = libraryPayload?.total_unique_faces ?? facesArray.length ?? 0;

        console.log('✅ Memory counts fetched successfully:', counts);
        memoryCountsManager.updateState(counts, false, null);
      } else {
        throw new Error(response.error || 'Failed to fetch memory counts');
      }
    } catch (error) {
      console.error('❌ Error fetching memory counts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      memoryCountsManager.updateState(globalMemoryCounts, false, errorMessage);
    }
  }
};

// Hook for components to use memory counts
export const useMemoryCounts = (): UseMemoryCountsReturn => {
  const { isAuthenticated } = useAuth();
  const [, forceUpdate] = useState({});

  // Force component re-render when global state changes
  const rerender = useCallback(() => {
    forceUpdate({});
  }, []);

  // Subscribe to memory counts changes
  useEffect(() => {
    const unsubscribe = memoryCountsManager.subscribe(rerender);
    return unsubscribe;
  }, [rerender]);

  // Fetch memory counts when authenticated
  useEffect(() => {
    if (isAuthenticated && !globalMemoryCounts && !globalIsLoading) {
      memoryCountsManager.fetchMemoryCounts();
    }
  }, [isAuthenticated]);

  // Set up periodic refresh of memory counts (every 30 seconds when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(async () => {
      // Only refresh if user is actively using the app (document is visible)
      if (!document.hidden) {
        await memoryCountsManager.fetchMemoryCounts();
      }
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const refreshMemoryCounts = useCallback(async () => {
    if (!isAuthenticated) {
      console.log('User not authenticated, skipping memory counts refresh');
      return;
    }
    await memoryCountsManager.fetchMemoryCounts();
  }, [isAuthenticated]);

  return {
    memoryCounts: globalMemoryCounts,
    isLoading: globalIsLoading,
    error: globalError,
    refreshMemoryCounts
  };
};

// Export the manager for external triggers
export { memoryCountsManager };

// Helper function to trigger memory counts refresh from anywhere in the app
export const triggerMemoryCountsRefresh = async (): Promise<void> => {
  console.log('🔄 Triggering memory counts refresh...');
  await memoryCountsManager.fetchMemoryCounts();
};