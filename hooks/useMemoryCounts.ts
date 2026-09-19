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
// Cars + Shopify catalog cards aren't real memory records in the backend, so the
// /user/memory-counts response never includes them. We track them separately and add
// both on top of the backend total at read time — that way the 30s background refetch
// of memory-counts can't stomp them back out.
//
// Cars and Shopify are kept in SEPARATE counters on purpose. The cars inventory is
// fetched once on login (fetchCarsCatalogCount) so the sidebar total is complete on
// the dashboard immediately, without waiting for the Campaigns tab. MemoriesPage owns
// only the Shopify count. If MemoriesPage owned a combined count, its first render
// (before its idle /cars fetch resolves) would report 0 cars and briefly stomp the
// login-fetched inventory to 0 — the 49 → 2 → 49 flicker. Splitting them means nothing
// ever resets the cars number to 0.
let globalCarsCatalogCount = 0;
let globalShopifyCatalogCount = 0;
// Guards the one-time login cars fetch so concurrent hook instances don't double-fetch;
// reset on logout so the next user refetches.
let carsCatalogLoaded = false;

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

  // Report the Shopify catalog card count (owned by MemoriesPage).
  setShopifyCatalogCount: (count: number) => {
    if (globalShopifyCatalogCount === count) return;
    globalShopifyCatalogCount = count;
    memoryCountsManager.notify();
  },

  // Report the cars inventory count.
  setCarsCatalogCount: (count: number) => {
    if (globalCarsCatalogCount === count) return;
    globalCarsCatalogCount = count;
    memoryCountsManager.notify();
  },

  // Fetch the read-only cars inventory count once on login so the sidebar Campaigns
  // total includes it before MemoriesPage has ever mounted. Mirrors the /cars fetch
  // MemoriesPage does for its card display; here we only need the count.
  fetchCarsCatalogCount: async (): Promise<void> => {
    if (carsCatalogLoaded) return;
    carsCatalogLoaded = true; // set synchronously so parallel hook instances skip
    try {
      const res: any = await dashboardAPI.carsGetCatalog();
      const list = res?.data?.data?.cars || res?.data?.cars || [];
      if (res?.success && Array.isArray(list)) {
        memoryCountsManager.setCarsCatalogCount(list.length);
      }
    } catch {
      carsCatalogLoaded = false; // allow a later attempt if this one failed
    }
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

  // Fetch memory counts (and the cars inventory count) once when the user becomes
  // authenticated, so the sidebar Campaigns total is complete on the dashboard without
  // waiting for the Campaigns tab to be opened.
  useEffect(() => {
    if (!isAuthenticated) {
      carsCatalogLoaded = false; // next login refetches the cars catalog
      return;
    }
    if (!globalMemoryCounts && !globalIsLoading) {
      memoryCountsManager.fetchMemoryCounts();
    }
    memoryCountsManager.fetchCarsCatalogCount();
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

  const memoryCounts = globalMemoryCounts
    ? {
        ...globalMemoryCounts,
        total_memories:
          globalMemoryCounts.total_memories + globalCarsCatalogCount + globalShopifyCatalogCount,
      }
    : globalMemoryCounts;

  return {
    memoryCounts,
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

// Report the number of Shopify catalog cards currently shown on the Memories page, so
// the sidebar total can include them even though the backend doesn't count them. The
// cars inventory is NOT reported here — it's fetched once on login (fetchCarsCatalogCount)
// so MemoriesPage's initial pre-fetch render can't stomp the cars count to 0.
export const setShopifyCatalogCount = (count: number): void => {
  memoryCountsManager.setShopifyCatalogCount(count);
};