import { useState, useEffect, useCallback } from 'react';
import { dashboardAPI } from '../utils/authUtils';
import { useAuth } from '../contexts/AuthContext';

interface MemoryLimitData {
  status: 'limit_exceeded' | 'within_limit' | null;
  current_memories: number;
  memory_limit: number;
  message?: string;
  ai_connects?: number;
}

interface AdminLimitData {
  status: 'limit_exceeded' | 'within_limit' | null;
  current_admins: number;
  max_allowed: number;
  remaining_slots: number;
  message?: string;
}

interface ServiceSyncLimitData {
  status: 'limit_exceeded' | 'within_limit' | null;
  current_connected_services: number;
  max_allowed: number;
  remaining_slots: number;
  message?: string;
}

// Global state and listeners for real-time sync
let globalLimitData: MemoryLimitData | null = null;
let globalAdminLimitData: AdminLimitData | null = null;
let globalServiceSyncLimitData: ServiceSyncLimitData | null = null;
let globalPendingPropertiesCount: number = 0;
let isChecking = false;
const listeners = new Set<(data: MemoryLimitData, adminData: AdminLimitData | null, serviceSyncData: ServiceSyncLimitData | null, pendingPropertiesCount: number) => void>();

export const useMemoryLimit = () => {
  const { isAuthenticated } = useAuth();
  const [limitData, setLimitData] = useState<MemoryLimitData>(() =>
    globalLimitData || {
      status: null,
      current_memories: 0,
      memory_limit: 0,
    }
  );
  const [adminLimitData, setAdminLimitData] = useState<AdminLimitData | null>(() =>
    globalAdminLimitData || null
  );
  const [serviceSyncLimitData, setServiceSyncLimitData] = useState<ServiceSyncLimitData | null>(() =>
    globalServiceSyncLimitData || null
  );
  const [pendingPropertiesCount, setPendingPropertiesCount] = useState<number>(() => globalPendingPropertiesCount);
  const [isLoading, setIsLoading] = useState(false);

  const checkLimit = useCallback(async () => {
    if (!isAuthenticated || isChecking) return;

    try {
      isChecking = true;
      setIsLoading(true);

      const response = await dashboardAPI.checkMemoryLimit();

      if (response.success && response.data) {
        const data = response.data.data || response.data;
        const limitStatus = data.limit_status || data;

        const newLimitData: MemoryLimitData = {
          status: limitStatus.status,
          current_memories: limitStatus.current_memories || limitStatus.memory_limit || 0,
          memory_limit: limitStatus.memory_limit || 0,
          message: limitStatus.message,
          ai_connects: data.ai_connects || limitStatus.ai_connects || 0,
        };

        globalLimitData = newLimitData;
        setLimitData(newLimitData);

        // Check for admin_limit_status
        const adminLimitStatus = data.admin_limit_status;
        console.log('🔍 useMemoryLimit: admin_limit_status from API:', adminLimitStatus);

        if (adminLimitStatus) {
          const newAdminLimitData: AdminLimitData = {
            status: adminLimitStatus.status,
            current_admins: adminLimitStatus.current_admins || 0,
            max_allowed: adminLimitStatus.max_allowed || 0,
            remaining_slots: adminLimitStatus.remaining_slots || 0,
            message: adminLimitStatus.message,
          };
          globalAdminLimitData = newAdminLimitData;
          setAdminLimitData(newAdminLimitData);
        } else {
          globalAdminLimitData = null;
          setAdminLimitData(null);
        }

        // Check for service_sync_limit_status
        const serviceSyncLimitStatus = data.service_sync_limit_status;
        console.log('🔍 useMemoryLimit: service_sync_limit_status from API:', serviceSyncLimitStatus);

        if (serviceSyncLimitStatus) {
          const newServiceSyncLimitData: ServiceSyncLimitData = {
            status: serviceSyncLimitStatus.status,
            current_connected_services: serviceSyncLimitStatus.current_connected_services || 0,
            max_allowed: serviceSyncLimitStatus.max_allowed || 0,
            remaining_slots: serviceSyncLimitStatus.remaining_slots || 0,
            message: serviceSyncLimitStatus.message,
          };
          globalServiceSyncLimitData = newServiceSyncLimitData;
          setServiceSyncLimitData(newServiceSyncLimitData);
        } else {
          globalServiceSyncLimitData = null;
          setServiceSyncLimitData(null);
        }

        // Check for pending_properties_count
        globalPendingPropertiesCount = data.pending_properties_count || 0;
        setPendingPropertiesCount(globalPendingPropertiesCount);

        // Notify all components about the update
        listeners.forEach(listener => listener(newLimitData, globalAdminLimitData, globalServiceSyncLimitData, globalPendingPropertiesCount));
      }
    } catch (error) {
      console.error('Error checking memory limit:', error);
    } finally {
      isChecking = false;
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Subscribe to global state changes
  useEffect(() => {
    const handleUpdate = (data: MemoryLimitData, adminData: AdminLimitData | null, serviceSyncData: ServiceSyncLimitData | null, pendingCount: number) => {
      setLimitData(data);
      setAdminLimitData(adminData);
      setServiceSyncLimitData(serviceSyncData);
      setPendingPropertiesCount(pendingCount);
    };

    listeners.add(handleUpdate);

    // Set initial data if available
    if (globalLimitData) {
      setLimitData(globalLimitData);
    }
    if (globalAdminLimitData) {
      setAdminLimitData(globalAdminLimitData);
    }
    if (globalServiceSyncLimitData) {
      setServiceSyncLimitData(globalServiceSyncLimitData);
    }
    setPendingPropertiesCount(globalPendingPropertiesCount);

    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  // Check immediately when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      checkLimit();
    }
  }, [isAuthenticated, checkLimit]);

  const isLimitExceeded = limitData.status === 'limit_exceeded';
  const isAdminLimitExceeded = adminLimitData?.status === 'limit_exceeded';
  const isServiceSyncLimitExceeded = serviceSyncLimitData?.status === 'limit_exceeded';
  const isAICreditsExceeded = limitData.ai_connects !== undefined && limitData.ai_connects === 0;

  return {
    limitData,
    adminLimitData,
    serviceSyncLimitData,
    pendingPropertiesCount,
    isLimitExceeded,
    isAdminLimitExceeded,
    isServiceSyncLimitExceeded,
    isAICreditsExceeded,
    isLoading,
    checkLimit,
  };
};

// Function to trigger check after memory operations
export const recheckMemoryLimit = async () => {
  if (isChecking) return;

  try {
    isChecking = true;

    const response = await dashboardAPI.checkMemoryLimit();

    if (response.success && response.data) {
      const data = response.data.data || response.data;
      const limitStatus = data.limit_status || data;

      const newLimitData: MemoryLimitData = {
        status: limitStatus.status,
        current_memories: limitStatus.current_memories || limitStatus.memory_limit || 0,
        memory_limit: limitStatus.memory_limit || 0,
        message: limitStatus.message,
        ai_connects: data.ai_connects || limitStatus.ai_connects || 0,
      };

      globalLimitData = newLimitData;

      // Check for admin_limit_status
      const adminLimitStatus = data.admin_limit_status;
      if (adminLimitStatus) {
        globalAdminLimitData = {
          status: adminLimitStatus.status,
          current_admins: adminLimitStatus.current_admins || 0,
          max_allowed: adminLimitStatus.max_allowed || 0,
          remaining_slots: adminLimitStatus.remaining_slots || 0,
          message: adminLimitStatus.message,
        };
      } else {
        globalAdminLimitData = null;
      }

      // Check for service_sync_limit_status
      const serviceSyncLimitStatus = data.service_sync_limit_status;
      if (serviceSyncLimitStatus) {
        globalServiceSyncLimitData = {
          status: serviceSyncLimitStatus.status,
          current_connected_services: serviceSyncLimitStatus.current_connected_services || 0,
          max_allowed: serviceSyncLimitStatus.max_allowed || 0,
          remaining_slots: serviceSyncLimitStatus.remaining_slots || 0,
          message: serviceSyncLimitStatus.message,
        };
      } else {
        globalServiceSyncLimitData = null;
      }

      // Check for pending_properties_count
      globalPendingPropertiesCount = data.pending_properties_count || 0;

      // Notify all components to update immediately
      listeners.forEach(listener => listener(newLimitData, globalAdminLimitData, globalServiceSyncLimitData, globalPendingPropertiesCount));
    }
  } catch (error) {
    console.error('Error rechecking memory limit:', error);
  } finally {
    isChecking = false;
  }
};