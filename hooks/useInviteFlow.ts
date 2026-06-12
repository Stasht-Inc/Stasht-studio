// Custom hook for handling collaborator invite flow
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import {
  isInviteLink,
  getInviteParams,
  clearInviteParams,
  isCorrectCollaborator,
  InviteParams
} from '../utils/inviteUtils';

export interface UseInviteFlowReturn {
  isInviteFlow: boolean;
  inviteParams: Partial<InviteParams> | null;
  showInviteModal: boolean;
  shouldLogoutUser: boolean;
  handleInviteAccept: () => string | null;
  handleInviteReject: () => void;
  handleLoginComplete: () => void;
  resetInviteFlow: () => void;
}

export function useInviteFlow(): UseInviteFlowReturn {
  const { user, isAuthenticated, logout } = useAuth();
  const [isInviteFlow, setIsInviteFlow] = useState(false);
  const [inviteParams, setInviteParams] = useState<Partial<InviteParams> | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [shouldLogoutUser, setShouldLogoutUser] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false); // Prevent multiple processing

  // Initialize invite flow on component mount
  useEffect(() => {
    // ========================================================================
    // ABSOLUTE FIRST CHECK: SKIP flag (highest priority)
    // ========================================================================
    const skipFlag = localStorage.getItem('SKIP_ALL_MISMATCH_CHECKS') || sessionStorage.getItem('SKIP_ALL_MISMATCH_CHECKS');
    if (skipFlag === 'true') {
      console.log('🚫🚫🚫 [useInviteFlow] SKIP_ALL_MISMATCH_CHECKS = true');
      console.log('🚫🚫🚫 [useInviteFlow] COMPLETELY SKIPPING ALL INVITE FLOW PROCESSING');
      return; // EXIT IMMEDIATELY - NO PROCESSING AT ALL
    }

    // SECOND CHECK: Completed invite login (PERMANENT protection)
    const inviteCompletionStr = localStorage.getItem('invite_login_completed') || sessionStorage.getItem('invite_login_completed');
    if (inviteCompletionStr) {
      try {
        const inviteCompletion = JSON.parse(inviteCompletionStr);
        const timeSinceCompletion = Date.now() - inviteCompletion.timestamp;

        // Keep protection for 5 minutes (300,000 ms) - REGARDLESS of user match
        if (inviteCompletion.completed && timeSinceCompletion < 300000) {
          console.log('🔒🔒🔒 [useInviteFlow] INVITE COMPLETION PROTECTION ACTIVE');
          console.log('🔒🔒🔒 [useInviteFlow] Completed', timeSinceCompletion, 'ms ago');
          console.log('🔒🔒🔒 [useInviteFlow] SKIPPING ALL PROCESSING - User just completed invite login');

          // If user is loaded, verify it matches
          if (user) {
            const userIdentifier = user.email || user.phone_number;
            console.log('🔒🔒🔒 [useInviteFlow] Protected user:', inviteCompletion.userIdentifier, '| Current user:', userIdentifier);
          }

          return; // EXIT - Absolutely NO processing for recent invite completions
        } else if (timeSinceCompletion >= 300000) {
          console.log('🔒 [useInviteFlow] Invite completion protection expired, clearing flag');
          localStorage.removeItem('invite_login_completed');
          sessionStorage.removeItem('invite_login_completed');
        }
      } catch (e) {
        console.error('[useInviteFlow] Error parsing invite completion data:', e);
      }
    }

    // SECOND CHECK: Recent login timestamp (60 second protection window)
    const lastLoginTimestamp = localStorage.getItem('last_successful_login_timestamp');
    if (lastLoginTimestamp) {
      const timeSinceLogin = Date.now() - parseInt(lastLoginTimestamp);
      const withinProtectionWindow = timeSinceLogin < 60000; // 60 seconds

      if (withinProtectionWindow) {
        console.log('🔒 [useInviteFlow] LOGIN TIMESTAMP PROTECTION - User logged in', timeSinceLogin, 'ms ago');
        console.log('🔒 [useInviteFlow] SKIPPING ALL PROCESSING - Protection window active');
        return; // EXIT - Absolutely NO processing within 60 seconds of login
      }
    }

    // SECOND: Check for from_invite_login URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const fromInviteLogin = urlParams.get('from_invite_login');

    if (fromInviteLogin === '1') {
      console.log('🔍 [useInviteFlow] ✅ from_invite_login=1 DETECTED IN URL - SKIPPING ALL PROCESSING');
      console.log('🔍 [useInviteFlow] User just completed invite login - allowing access');
      return; // Exit immediately - do nothing
    }

    // BACKUP: Check sessionStorage flags
    const inviteLoginSuccess = sessionStorage.getItem('invite_login_success');
    const inviteLoginTimestamp = sessionStorage.getItem('invite_login_timestamp');
    const justCompletedInviteLogin = sessionStorage.getItem('just_completed_invite_login');

    // Check flag OR timestamp (within last 10 seconds) as backup
    const isRecentInviteLogin = inviteLoginTimestamp &&
      (Date.now() - parseInt(inviteLoginTimestamp)) < 10000; // 10 second window

    if (inviteLoginSuccess === 'true' || justCompletedInviteLogin === 'true' || isRecentInviteLogin) {
      console.log('🔍 [useInviteFlow] INVITE LOGIN DETECTED via flags - SKIPPING ALL PROCESSING');
      console.log('🔍 [useInviteFlow] Flags:', { inviteLoginSuccess, justCompletedInviteLogin, isRecentInviteLogin });
      console.log('🔍 [useInviteFlow] User just logged in successfully, allowing them to proceed');
      return; // Exit immediately - do nothing
    }

    // CRITICAL FIX: Completely skip invite flow processing when login=1 OR login=0
    // Let LoginPage.tsx/SignupPage.tsx handle the invite params directly (urlParams already defined above)
    const loginParam = urlParams.get('login');

    if (loginParam === '1') {
      console.log('🔍 [useInviteFlow] login=1 detected - SKIPPING ALL PROCESSING');
      console.log('🔍 [useInviteFlow] LoginPage will handle invite params directly');
      return; // Exit immediately - do nothing
    }

    if (loginParam === '0') {
      console.log('🔍 [useInviteFlow] login=0 detected - SKIPPING ALL PROCESSING');
      console.log('🔍 [useInviteFlow] SignupPage should be shown, not interfering');
      return; // Exit immediately - do nothing
    }

    const checkInviteFlow = () => {
      // CRITICAL: Prevent multiple executions for the same state
      if (hasProcessed && !isInviteLink()) {
        console.log('🔍 Already processed invite flow, skipping');
        return;
      }

      console.log('🔍 Checking invite flow...');
      console.log('🔍 Current URL:', window.location.href);
      console.log('🔍 Is invite link?', isInviteLink());
      console.log('🔍 isAuthenticated:', isAuthenticated);
      console.log('🔍 user email:', user?.email);

      // Check for login parameter
      const isExplicitLoginPage = loginParam === '1';

      if (isInviteLink()) {
        const params = getInviteParams();
        console.log('🔗 Invite link detected:', params);

        // Only show toast if not on explicit login page (login=1)
        if (!isExplicitLoginPage) {
          toast.info('Collaboration invite detected!');
        }

        if (params && params.collaborator) {
          setIsInviteFlow(true);
          setInviteParams(params);

          // Store invite params in BOTH sessionStorage AND localStorage
          // sessionStorage: for normal flow
          // localStorage: persists through logout/reload (critical for wrong user scenario)
          sessionStorage.setItem('pendingInvite', JSON.stringify(params));
          localStorage.setItem('pendingInvite', JSON.stringify(params));
          console.log('💾 Stored invite params in sessionStorage and localStorage');
          setHasProcessed(true); // Mark as processed

          // If user is authenticated, check if it's the correct user
          if (isAuthenticated && user?.email) {
            console.log('🔍 Checking if correct collaborator...');
            console.log('🔍 User email:', user.email);
            console.log('🔍 Expected collaborator:', params.collaborator);

            if (!isCorrectCollaborator(user.email, params.collaborator)) {
              console.log('🚪 Wrong user logged in, logging out...');
              console.log('💾 Invite params saved in localStorage - will survive logout');

              // CRITICAL: Set flag to prevent clearing invite params after logout
              sessionStorage.setItem('just_logged_out_for_invite', 'true');
              console.log('🚩 Set flag: just_logged_out_for_invite = true');

              // Only show toast and logout if not on explicit login page
              if (!isExplicitLoginPage) {
                toast.warning('Please login with the invited email address');
                setShouldLogoutUser(true);
              } else {
                console.log('🔍 On explicit login page (login=1), skipping auto-logout');
              }
            } else {
              console.log('✅ Correct user logged in');
              // Only show success toast and clear if not on explicit login page
              if (!isExplicitLoginPage) {
                toast.success('Welcome! You have been invited to collaborate.');
                // Don't show modal, just clear invite params
                clearInviteParams();
                sessionStorage.removeItem('pendingInvite');
                localStorage.removeItem('pendingInvite');
                console.log('🗑️ Cleared invite params from storage');
              }
            }
          } else {
            console.log('⏳ User not authenticated yet, waiting for login...');
            // Only show toast if not on explicit login page
            if (!isExplicitLoginPage) {
              toast.info('Please login to view the invitation');
            }
          }
        }
      } else {
        console.log('ℹ️ Not an invite link');

        // CRITICAL FIX: Check for login parameter here too
        const urlParams = new URLSearchParams(window.location.search);
        const loginParam = urlParams.get('login');
        const isExplicitLoginPage = loginParam === '1';

        // Check if there's a pending invite in sessionStorage OR localStorage
        const pendingInviteSession = sessionStorage.getItem('pendingInvite');
        const pendingInviteLocal = localStorage.getItem('pendingInvite');
        const pendingInvite = pendingInviteSession || pendingInviteLocal;

        if (pendingInvite && isAuthenticated && user?.email) {
          const storageType = pendingInviteSession ? 'sessionStorage' : 'localStorage';
          console.log(`🔗 Found pending invite in ${storageType}`);
          const params = JSON.parse(pendingInvite);
          setIsInviteFlow(true);
          setInviteParams(params);

          if (isCorrectCollaborator(user.email, params.collaborator)) {
            console.log('✅ Correct user logged in after logout');
            // Only show toast and clear if not on explicit login page
            if (!isExplicitLoginPage) {
              toast.success('Welcome! You have been invited to collaborate.');
              clearInviteParams();
              sessionStorage.removeItem('pendingInvite');
              localStorage.removeItem('pendingInvite');
              sessionStorage.removeItem('just_logged_out_for_invite');
              console.log('🗑️ Cleared invite params and flag from storage');
            }
          } else {
            console.log('🚪 Still wrong user, logging out again...');

            // Only logout if not on explicit login page
            if (!isExplicitLoginPage) {
              // CRITICAL: Set flag to prevent clearing invite params after logout
              sessionStorage.setItem('just_logged_out_for_invite', 'true');
              console.log('🚩 Set flag: just_logged_out_for_invite = true');

              toast.warning('Please login with the invited email address');
              setShouldLogoutUser(true);
            } else {
              console.log('🔍 On explicit login page (login=1), skipping auto-logout for wrong user');
            }
          }
        }
      }
    };

    checkInviteFlow();
  }, [isAuthenticated, user?.email]);

  // Handle logout for wrong user
  useEffect(() => {
    if (shouldLogoutUser && isAuthenticated) {
      // ========================================================================
      // ABSOLUTE FIRST CHECK: SKIP flag (highest priority)
      // ========================================================================
      const skipFlag = localStorage.getItem('SKIP_ALL_MISMATCH_CHECKS') || sessionStorage.getItem('SKIP_ALL_MISMATCH_CHECKS');
      if (skipFlag === 'true') {
        console.log('🚫🚫🚫 [useInviteFlow LOGOUT] SKIP_ALL_MISMATCH_CHECKS = true');
        console.log('🚫🚫🚫 [useInviteFlow LOGOUT] PREVENTING LOGOUT - SKIP FLAG ACTIVE');
        setShouldLogoutUser(false); // Clear the flag
        return; // EXIT IMMEDIATELY - NO LOGOUT
      }

      // SECOND CHECK: Completed invite login (PERMANENT protection)
      const inviteCompletionStr = localStorage.getItem('invite_login_completed') || sessionStorage.getItem('invite_login_completed');
      if (inviteCompletionStr) {
        try {
          const inviteCompletion = JSON.parse(inviteCompletionStr);
          const timeSinceCompletion = Date.now() - inviteCompletion.timestamp;

          // Keep protection for 5 minutes (300,000 ms) - REGARDLESS of user match
          if (inviteCompletion.completed && timeSinceCompletion < 300000) {
            console.log('🔒🔒🔒 [useInviteFlow LOGOUT] INVITE COMPLETION PROTECTION ACTIVE');
            console.log('🔒🔒🔒 [useInviteFlow LOGOUT] PREVENTING LOGOUT - User completed invite login', timeSinceCompletion, 'ms ago');
            setShouldLogoutUser(false); // Clear the flag
            return; // EXIT - Absolutely NO logout for recent invite completions
          }
        } catch (e) {
          console.error('[useInviteFlow LOGOUT] Error parsing invite completion data:', e);
        }
      }

      // SECOND CHECK: Timestamp protection
      const lastLoginTimestamp = localStorage.getItem('last_successful_login_timestamp');
      if (lastLoginTimestamp) {
        const timeSinceLogin = Date.now() - parseInt(lastLoginTimestamp);
        const withinProtectionWindow = timeSinceLogin < 60000; // 60 seconds

        if (withinProtectionWindow) {
          console.log('🔒 [useInviteFlow LOGOUT] LOGIN TIMESTAMP PROTECTION - User logged in', timeSinceLogin, 'ms ago');
          console.log('🔒 [useInviteFlow LOGOUT] PREVENTING LOGOUT - Protection window active');
          setShouldLogoutUser(false); // Clear the flag
          return; // EXIT - Absolutely NO logout within 60 seconds of login
        }
      }

      // THIRD CHECK: URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const fromInviteLogin = urlParams.get('from_invite_login');

      if (fromInviteLogin === '1') {
        console.log('🔍 [useInviteFlow LOGOUT] ✅ from_invite_login=1 DETECTED - PREVENTING LOGOUT');
        setShouldLogoutUser(false); // Clear the flag
        return; // EXIT - No logout
      }

      // If no protection, proceed with logout
      console.log('⚠️ [useInviteFlow LOGOUT] No protection detected - proceeding with logout');
      logout();
      setShouldLogoutUser(false);
    }
  }, [shouldLogoutUser, isAuthenticated, logout, user]);

  // Reset invite flow state
  const resetInviteFlow = useCallback(() => {
    setIsInviteFlow(false);
    setInviteParams(null);
    setShowInviteModal(false);
    setShouldLogoutUser(false);
  }, []);

  // Handle login completion during invite flow
  const handleLoginComplete = useCallback(() => {
    if (isInviteFlow && inviteParams && user?.email) {
      if (isCorrectCollaborator(user.email, inviteParams.collaborator || '')) {
        console.log('✅ Login completed with correct user');
        toast.success('Welcome! You have been invited to collaborate.');
        clearInviteParams();
        sessionStorage.removeItem('pendingInvite');
      } else {
        console.log('❌ Login completed with wrong user');
        setShouldLogoutUser(true);
      }
    }
  }, [isInviteFlow, inviteParams, user?.email]);

  // Handle invite acceptance
  const handleInviteAccept = useCallback((): string | null => {
    if (inviteParams?.memory_id) {
      console.log('✅ Invite accepted, navigating to memory:', inviteParams.memory_id);
      setShowInviteModal(false);
      clearInviteParams();
      sessionStorage.removeItem('pendingInvite');

      // Navigate to the memory page
      // This will be handled by the App component via callback
      return inviteParams.memory_id;
    }
    return null;
  }, [inviteParams]);

  // Handle invite rejection
  const handleInviteReject = useCallback(() => {
    console.log('❌ Invite rejected');
    setShowInviteModal(false);
    clearInviteParams();
    sessionStorage.removeItem('pendingInvite');
    resetInviteFlow();
  }, [resetInviteFlow]);

  return {
    isInviteFlow,
    inviteParams,
    showInviteModal,
    shouldLogoutUser,
    handleInviteAccept,
    handleInviteReject,
    handleLoginComplete,
    resetInviteFlow
  };
}