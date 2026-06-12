import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SyncProgress {
  serviceId: string;
  serviceName: string;
  serviceType: string;
  progress: number;
  status: 'syncing' | 'completed' | 'failed';
  message?: string;
  startTime: number;
  itemCount?: number;
}

interface SyncProgressContextType {
  syncProgress: SyncProgress | null;
  startSync: (serviceId: string, serviceName: string, serviceType: string) => void;
  updateProgress: (progress: number, message?: string) => void;
  completeSync: (itemCount?: number) => void;
  failSync: (message?: string) => void;
  clearSync: () => void;
}

const SyncProgressContext = createContext<SyncProgressContextType | undefined>(undefined);

export function SyncProgressProvider({ children }: { children: ReactNode }) {
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  const startSync = (serviceId: string, serviceName: string, serviceType: string) => {
    console.log('🔄 SyncProgressContext: Starting sync for', serviceName);
    setSyncProgress({
      serviceId,
      serviceName,
      serviceType,
      progress: 0,
      status: 'syncing',
      startTime: Date.now(),
    });
  };

  const updateProgress = (progress: number, message?: string) => {
    console.log('🔄 SyncProgressContext: Updating progress to', progress, '%');
    setSyncProgress(prev => prev ? {
      ...prev,
      progress: Math.min(100, Math.max(0, progress)),
      message,
    } : null);
  };

  const completeSync = (itemCount?: number) => {
    console.log('✅ SyncProgressContext: Sync completed with', itemCount, 'items');
    setSyncProgress(prev => prev ? {
      ...prev,
      progress: 100,
      status: 'completed',
      message: itemCount ? `${itemCount} items imported successfully` : 'Sync completed successfully!',
      itemCount,
    } : null);

    // Don't auto-clear - let user click "View Media" button
  };

  const failSync = (message?: string) => {
    console.log('❌ SyncProgressContext: Sync failed');
    setSyncProgress(prev => prev ? {
      ...prev,
      status: 'failed',
      message: message || 'Sync failed. Please try again.',
    } : null);

    // Auto-clear after 5 seconds
    setTimeout(() => {
      clearSync();
    }, 5000);
  };

  const clearSync = () => {
    console.log('🗑️ SyncProgressContext: Clearing sync progress');
    setSyncProgress(null);
  };

  return (
    <SyncProgressContext.Provider
      value={{
        syncProgress,
        startSync,
        updateProgress,
        completeSync,
        failSync,
        clearSync,
      }}
    >
      {children}
    </SyncProgressContext.Provider>
  );
}

export function useSyncProgress() {
  const context = useContext(SyncProgressContext);
  if (context === undefined) {
    throw new Error('useSyncProgress must be used within a SyncProgressProvider');
  }
  return context;
}
