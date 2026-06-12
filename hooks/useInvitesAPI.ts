import { useState, useEffect, useCallback } from 'react';
import { Invite, InvitesAPI, InvitesResponse } from '../services/invitesAPI';

export function useInvitesAPI() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitesData, setInvitesData] = useState<InvitesResponse | null>(null);

  // Load invites from API
  const loadInvites = useCallback(async () => {
    try {
      console.log('🔄 useInvitesAPI: Starting to load invites...');
      setIsLoading(true);
      setError(null);
      const response = await InvitesAPI.getInvites();
      
      console.log('🎉 useInvitesAPI: Invites loaded successfully');
      console.log('🔍 useInvitesAPI: Raw response:', response);
      
      // Handle different response formats
      let invitesArray = [];
      
      if (Array.isArray(response)) {
        // Direct array response
        console.log('📋 useInvitesAPI: Response is direct array');
        invitesArray = response;
      } else if (response?.data?.invites) {
        // Nested response with data.invites
        console.log('📋 useInvitesAPI: Response has data.invites structure');
        invitesArray = response.data.invites;
      } else if (response?.invites) {
        // Response with direct invites property
        console.log('📋 useInvitesAPI: Response has direct invites property');
        invitesArray = response.invites;
      } else {
        console.log('📋 useInvitesAPI: No recognizable invites structure found');
        invitesArray = [];
      }
      
      setInvitesData(response);
      setInvites(invitesArray);
      
      // Filter pending invites (accept_reject = "0")
      const pending = invitesArray.filter(invite => invite.accept_reject === "0");
      setPendingInvites(pending);
      
      console.log('📊 useInvitesAPI: Total invites:', invitesArray.length);
      console.log('⏳ useInvitesAPI: Pending invites found:', pending.length);
      
      if (pending.length > 0) {
        console.log('✅ useInvitesAPI: Found pending invites - "Invited" category will show!');
        pending.forEach((invite, index) => {
          console.log(`  📬 Pending Invite ${index + 1}:`, {
            id: invite.id,
            memory_title: invite.memory?.title,
            sender_name: invite.sender?.name,
            accept_reject: invite.accept_reject,
            fullInvite: invite
          });
        });
      } else {
        console.log('🚫 useInvitesAPI: No pending invites - "Invited" category will not appear');
      }
      
    } catch (error) {
      console.error('❌ useInvitesAPI: Error loading invites:', error);
      // Don't treat invites API failure as a critical error that should cause logout
      // Just log the error and set empty state
      setError('Invites unavailable');
      setInvites([]);
      setPendingInvites([]);
      setInvitesData(null);
    } finally {
      setIsLoading(false);
      console.log('🏁 useInvitesAPI: Loading finished');
    }
  }, []);

  // Accept an invite
  const acceptInvite = useCallback(async (inviteId: number) => {
    try {
      await InvitesAPI.acceptInvite(inviteId);
      // Reload invites to get updated data
      await loadInvites();
    } catch (error) {
      console.error('Error accepting invite:', error);
      throw error;
    }
  }, [loadInvites]);

  // Reject an invite
  const rejectInvite = useCallback(async (inviteId: number) => {
    try {
      await InvitesAPI.rejectInvite(inviteId);
      // Reload invites to get updated data
      await loadInvites();
    } catch (error) {
      console.error('Error rejecting invite:', error);
      throw error;
    }
  }, [loadInvites]);

  // Remove invite from local state (optimistic update)
  const removeInviteFromState = useCallback((inviteId: number) => {
    setInvites(prev => prev.filter(invite => invite.id !== inviteId));
    setPendingInvites(prev => prev.filter(invite => invite.id !== inviteId));
  }, []);

  // Load invites on mount
  useEffect(() => {
    console.log('🔄 useInvitesAPI: Attempting to load invites...');
    loadInvites();
  }, [loadInvites]);

  // Computed values
  const hasPendingInvites = pendingInvites.length > 0;
  const pendingCount = pendingInvites.length;
  const totalCount = invites.length;

  return {
    // Data
    invites,
    pendingInvites,
    invitesData,
    
    // Computed
    hasPendingInvites,
    pendingCount,
    totalCount,
    
    // States
    isLoading,
    error,
    
    // Actions
    loadInvites,
    acceptInvite,
    rejectInvite,
    removeInviteFromState
  };
}