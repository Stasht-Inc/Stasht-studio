import { useState, useEffect, useCallback } from 'react';
import { InvitedMemory, invitedMemoriesStorage } from '../utils/invitedMemoriesStorage';

export function useInvitedMemories() {
  const [invitedMemories, setInvitedMemories] = useState<InvitedMemory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load invited memories from localStorage
  const loadInvitedMemories = useCallback(() => {
    try {
      setIsLoading(true);
      const memories = invitedMemoriesStorage.getInvitedMemories();
      setInvitedMemories(memories);
      console.log('Loaded invited memories:', memories.length);
    } catch (error) {
      console.error('Error loading invited memories:', error);
      setInvitedMemories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add a new invited memory
  const addInvitedMemory = useCallback((memory: InvitedMemory) => {
    try {
      invitedMemoriesStorage.addInvitedMemory(memory);
      loadInvitedMemories(); // Reload to get updated list
    } catch (error) {
      console.error('Error adding invited memory:', error);
    }
  }, [loadInvitedMemories]);

  // Remove an invited memory
  const removeInvitedMemory = useCallback((memoryId: string) => {
    try {
      invitedMemoriesStorage.removeInvitedMemory(memoryId);
      loadInvitedMemories(); // Reload to get updated list
    } catch (error) {
      console.error('Error removing invited memory:', error);
    }
  }, [loadInvitedMemories]);

  // Remove invited memory by notification ID
  const removeByNotificationId = useCallback((notificationId: string) => {
    try {
      invitedMemoriesStorage.removeByNotificationId(notificationId);
      loadInvitedMemories(); // Reload to get updated list
    } catch (error) {
      console.error('Error removing invited memory by notification ID:', error);
    }
  }, [loadInvitedMemories]);

  // Handle accept from notification
  const handleNotificationAccept = useCallback((notificationId: string) => {
    console.log('Handling notification accept for:', notificationId);
    removeByNotificationId(notificationId);
  }, [removeByNotificationId]);

  // Handle reject from notification
  const handleNotificationReject = useCallback((notificationId: string) => {
    console.log('Handling notification reject for:', notificationId);
    removeByNotificationId(notificationId);
  }, [removeByNotificationId]);

  // Create sample data for testing
  const addSampleData = useCallback(() => {
    invitedMemoriesStorage.addSampleData();
    loadInvitedMemories();
  }, [loadInvitedMemories]);

  // Clear all invited memories
  const clearAll = useCallback(() => {
    invitedMemoriesStorage.clearAllInvitedMemories();
    loadInvitedMemories();
  }, [loadInvitedMemories]);

  // Check if invited category should be shown
  const hasInvitedMemories = invitedMemories.length > 0;
  
  // Get count
  const invitedCount = invitedMemories.length;

  // Load memories on mount
  useEffect(() => {
    loadInvitedMemories();
  }, [loadInvitedMemories]);

  // Listen for storage changes (if multiple tabs are open)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'stash_invited_memories') {
        loadInvitedMemories();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadInvitedMemories]);

  return {
    invitedMemories,
    isLoading,
    hasInvitedMemories,
    invitedCount,
    addInvitedMemory,
    removeInvitedMemory,
    removeByNotificationId,
    handleNotificationAccept,
    handleNotificationReject,
    loadInvitedMemories,
    addSampleData,
    clearAll
  };
}