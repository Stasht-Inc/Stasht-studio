// Custom hook for handling QR code collaborator invite flow
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { dashboardAPI } from '../utils/authUtils';
import {
  isQrInviteLink,
  getQrInviteParams,
  clearQrInviteParams,
  QrInviteParams
} from '../utils/inviteUtils';

export interface UseQrInviteFlowReturn {
  isQrInviteFlow: boolean;
  qrInviteParams: Partial<QrInviteParams> | null;
  isProcessingQrInvite: boolean;
}

const QR_INVITE_STORAGE_KEY = 'pendingQrInvite';

export function useQrInviteFlow(): UseQrInviteFlowReturn {
  const { user, isAuthenticated } = useAuth();
  const [isQrInviteFlow, setIsQrInviteFlow] = useState(false);
  const [qrInviteParams, setQrInviteParams] = useState<Partial<QrInviteParams> | null>(null);
  const [isProcessingQrInvite, setIsProcessingQrInvite] = useState(false);

  // Process QR/self invite - add user as collaborator
  const processQrInvite = useCallback(async (params: Partial<QrInviteParams>) => {
    if (!params.memory_id || !params.role) {
      console.error('❌ Invalid invite params:', params);
      toast.error('Invalid invite link');
      return false;
    }

    console.log('🔄 Processing self invite:', {
      memory_id: params.memory_id,
      role: params.role,
    });

    setIsProcessingQrInvite(true);

    try {
      const response = await dashboardAPI.addSelfAsCollaborator(
        params.memory_id,
        params.role
      );

      if (response.success) {
        console.log('✅ Successfully joined memory as collaborator');
        toast.success('You have been added as a collaborator!');

        // Clear stored invite from BOTH sessionStorage AND localStorage
        sessionStorage.removeItem(QR_INVITE_STORAGE_KEY);
        localStorage.removeItem(QR_INVITE_STORAGE_KEY);
        clearQrInviteParams();
        setIsQrInviteFlow(false);
        setQrInviteParams(null);

        // Redirect to stories page
        window.location.replace('/stories');
        return true;
      } else {
        console.error('❌ Failed to join memory:', response.message);
        toast.error(response.message || 'Failed to add you as collaborator');
        return false;
      }
    } catch (error) {
      console.error('❌ Error processing invite:', error);
      toast.error('An error occurred while processing the invite');
      return false;
    } finally {
      setIsProcessingQrInvite(false);
    }
  }, []);

  // Initialize QR invite flow on component mount
  useEffect(() => {
    const checkQrInviteFlow = async () => {
      console.log('🔍 Checking QR invite flow...');
      console.log('🔍 Current URL:', window.location.href);
      console.log('🔍 Is QR invite link?', isQrInviteLink());
      console.log('🔍 isAuthenticated:', isAuthenticated);
      console.log('🔍 user:', user);

      // Check if URL has QR invite parameters
      if (isQrInviteLink()) {
        const params = getQrInviteParams();
        console.log('🔗 QR invite link detected:', params);

        if (params && params.memory_id && params.role) {
          setIsQrInviteFlow(true);
          setQrInviteParams(params);

          // If user is authenticated, process immediately
          if (isAuthenticated && user?.id) {
            console.log('✅ User is logged in, processing invite immediately');
            await processQrInvite(params);
          } else {
            console.log('⏳ User not logged in, storing QR invite for after login/signup');
            // Store in BOTH sessionStorage AND localStorage (persists through activation flow)
            sessionStorage.setItem(QR_INVITE_STORAGE_KEY, JSON.stringify(params));
            localStorage.setItem(QR_INVITE_STORAGE_KEY, JSON.stringify(params));
            console.log('💾 Stored QR invite in sessionStorage and localStorage');
            toast.info('Please login or signup to join this memory as a collaborator');
          }
        }
      } else {
        // Check if there's a pending QR invite in sessionStorage OR localStorage
        const pendingQrInviteSession = sessionStorage.getItem(QR_INVITE_STORAGE_KEY);
        const pendingQrInviteLocal = localStorage.getItem(QR_INVITE_STORAGE_KEY);
        const storedQrInvite = pendingQrInviteSession || pendingQrInviteLocal;

        if (storedQrInvite && isAuthenticated && user?.id) {
          const storageType = pendingQrInviteSession ? 'sessionStorage' : 'localStorage';
          console.log(`🔗 Found pending QR invite in ${storageType}`);

          try {
            const params = JSON.parse(storedQrInvite);
            setIsQrInviteFlow(true);
            setQrInviteParams(params);

            console.log('✅ User logged in, processing stored invite');
            await processQrInvite(params);
          } catch (error) {
            console.error('❌ Failed to parse stored QR invite:', error);
            sessionStorage.removeItem(QR_INVITE_STORAGE_KEY);
            localStorage.removeItem(QR_INVITE_STORAGE_KEY);
          }
        }
      }
    };

    checkQrInviteFlow();
  }, [isAuthenticated, user?.id, processQrInvite]);

  return {
    isQrInviteFlow,
    qrInviteParams,
    isProcessingQrInvite
  };
}
