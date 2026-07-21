import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useProperty } from "./contexts/PropertyContext";
import InteractiveNav from "./components/InteractiveNav";
import Sidebar from "./components/Sidebar";
import CategoryNav, { Category, Label } from "./components/CategoryNav";
import MediaNav from "./components/MediaNav";
import ProfileSettingsNav from "./components/ProfileSettingsNav";
import BillingNav from "./components/BillingNav";
import Dashboard from "./components/Dashboard";
import MemoriesPage from "./pages/MemoriesPage";
import MediaPage from "./pages/MediaPage";
import MemoryDetailsPage from "./pages/MemoryDetailsPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";
import BillingPage from "./pages/BillingPage";
import UsersPage from "./pages/UsersPage";
import LibraryPage from "./pages/LibraryPage";
import AccountActivationPage from "./pages/AccountActivationPage";
import AppsPage from "./pages/AppsPage";
import MarketplacePage from "./pages/MarketplacePage";
import CsvUploadPage from "./pages/CsvUploadPage";
import { useAppNavigation } from "./hooks/useAppNavigation";
import { categoriesData, labelsData } from "./constants/appData";
import { dashboardAPI, authAPI, userUtils, isPartialAdmin, getPartialAdminEmail } from './utils/authUtils';
import { googleAuthAPI } from './utils/googleAuthAPI';
import { openGooglePhotosPicker, retryPickerWithSession } from './utils/googlePhotosPickerUtils';
import { PopupBlockedGuideModal } from './components/PopupBlockedGuideModal';
import UpgradePlanModal from './components/UpgradePlanModal';
import { mediaAPI, mediaTransformers, resetMediaCache } from './services/mediaAPI';
import { initializeCategoryColors } from './utils/categoryColorManager';
import { useMemoriesRefreshProvider } from './hooks/useMemoriesRefresh';
import { useInviteFlow } from './hooks/useInviteFlow';
import { useQrInviteFlow } from './hooks/useQrInviteFlow';
import { CollaboratorInviteModal } from './components/CollaboratorInviteModal';
import { isCorrectCollaborator } from './utils/inviteUtils';
import { useMemoryLimit } from './hooks/useMemoryLimit';
import { memoryCountsManager } from './hooks/useMemoryCounts';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster, toast } from 'sonner';
import { UploadProgressProvider } from './contexts/UploadProgressContext';
import { SyncProgressProvider } from './contexts/SyncProgressContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LayoutDashboard, FolderOpen, Camera, Users, Grid3x3, Plus, BookOpen, ScanLine, X as XIcon, Clock } from 'lucide-react';
import { CameraInterface } from './components/CameraInterface';
import { AddMomentModal } from './components/AddMomentModal';
import exifr from 'exifr';

// CAPTURE EMAIL PARAMETER IMMEDIATELY (before React even starts)
// This runs as soon as the file is loaded, before any component mounts
console.log('🔗🔗🔗 [MagicLink GLOBAL] Capturing email param IMMEDIATELY on file load...');
console.log('🔗 [MagicLink GLOBAL] window.location.href:', window.location.href);
console.log('🔗 [MagicLink GLOBAL] window.location.search:', window.location.search);

const urlParams = new URLSearchParams(window.location.search);
const emailParam = urlParams.get('collaborator');

if (emailParam) {
  console.log('🔗 [MagicLink GLOBAL] ✅ Found email param on file load, storing:', emailParam);
  sessionStorage.setItem('pending_magic_link_email', emailParam);
} else {
  console.log('🔗 [MagicLink GLOBAL] ❌ No email param found on file load');
}

// CAPTURE PROPERTY REGISTRATION LINK PARAMETERS
console.log('🏠 [PropertyLink GLOBAL] Checking for property registration link params...');
const propertyToken = urlParams.get('token');
const propertyParam = urlParams.get('property');

if (propertyToken && propertyParam === '1') {
  console.log('🏠 [PropertyLink GLOBAL] ✅ Found property registration link with property=1');

  // Store flag to switch to first property after login
  localStorage.setItem('pending_property_switch', 'first');
  console.log('🏠 [PropertyLink GLOBAL] Stored flag to switch to first property after login');

  // Check if user is currently logged in - if yes, logout
  const currentToken = localStorage.getItem('stasht_token');
  if (currentToken) {
    console.log('🏠 [PropertyLink GLOBAL] User is logged in, logging out before registration...');
    localStorage.removeItem('stasht_token');
    localStorage.removeItem('stasht_user');
    localStorage.removeItem('admin_switch_data');
    localStorage.removeItem('selected_property');
    console.log('🏠 [PropertyLink GLOBAL] Logged out current user');
  }
} else {
  console.log('🏠 [PropertyLink GLOBAL] ❌ No property registration link params found');
}

// CAPTURE DEEP LINK PARAMETERS - Runs BEFORE React component mounts
console.log('🔗 [DEEP LINK GLOBAL] Checking for deep link params...');
const pathname = window.location.pathname;
const memoryMatch = pathname.match(/\/memories\/(\d+)/);
const deepLinkImageId = urlParams.get('image');
const deepLinkUserId = urlParams.get('userId');
const deepLinkEmail = urlParams.get('email');
const deepLinkPhone = urlParams.get('phone');

if (memoryMatch && deepLinkImageId && deepLinkUserId && (deepLinkEmail || deepLinkPhone)) {
  const memoryId = memoryMatch[1];
  const credential = deepLinkEmail ? decodeURIComponent(deepLinkEmail) : deepLinkPhone ? decodeURIComponent(deepLinkPhone) : '';
  const credentialType = deepLinkEmail ? 'email' : 'phone';

  console.log('🔗 [DEEP LINK GLOBAL] ✅ Deep link detected:', { memoryId, imageId: deepLinkImageId, userId: deepLinkUserId, credential });

  // Store deep link data for after authentication
  const deepLinkData = {
    memoryId,
    imageId: deepLinkImageId,
    userId: deepLinkUserId,
    credential,
    credentialType,
    timestamp: Date.now()
  };

  sessionStorage.setItem('pendingDeepLink', JSON.stringify(deepLinkData));
  console.log('🔗 [DEEP LINK GLOBAL] Stored in sessionStorage');

  // Store credential for login prefill
  if (deepLinkEmail) {
    sessionStorage.setItem('pending_magic_link_email', credential);
    console.log('🔗 [DEEP LINK GLOBAL] Stored email for prefill');
  } else if (deepLinkPhone) {
    sessionStorage.setItem('pending_magic_link_phone', credential);
    console.log('🔗 [DEEP LINK GLOBAL] Stored phone for prefill');
  }

  // Just log - don't logout here, let the useEffect handle it after React loads
  const currentUser = localStorage.getItem('stasht_user');
  if (currentUser) {
    try {
      const userData = JSON.parse(currentUser);
      const currentExternalUserId = userData.external_user_id || userData.id;
      console.log('🔗 [DEEP LINK GLOBAL] User logged in:', currentExternalUserId, '- target:', deepLinkUserId);
    } catch (err) {
      console.error('🔗 [DEEP LINK GLOBAL] Error parsing user data:', err);
    }
  } else {
    console.log('🔗 [DEEP LINK GLOBAL] No user logged in - will show login page');
  }
} else {
  console.log('🔗 [DEEP LINK GLOBAL] ❌ No deep link params found');
}

// GLOBAL URL PROTECTION FOR POST LINKS - Runs BEFORE React component mounts
console.log('🔥 [POST LINK GLOBAL] Checking for post link params...');
const postLinkMemoryId = urlParams.get('memory_id');
const postLinkPostId = urlParams.get('post_id');

if (postLinkMemoryId && postLinkPostId) {
  const currentUrl = window.location.href;
  console.log('🔥 [POST LINK GLOBAL] ✅ Post link detected at page load:', currentUrl);
  console.log('🔥 [POST LINK GLOBAL] Params:', { memory_id: postLinkMemoryId, post_id: postLinkPostId });

  const pendingData = {
    memory_id: postLinkMemoryId,
    post_id: postLinkPostId,
    timestamp: Date.now(),
    originalUrl: currentUrl
  };

  sessionStorage.setItem('pendingPostView', JSON.stringify(pendingData));
  sessionStorage.setItem('preservePostUrl', currentUrl);
  sessionStorage.setItem('globalProtectedUrl', currentUrl);
  console.log('🔥 [POST LINK GLOBAL] Stored in sessionStorage');

  // Install IMMEDIATE URL protection - blocks ALL URL changes until cleared
  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  window.history.pushState = function(...args) {
    const protectedUrl = sessionStorage.getItem('globalProtectedUrl');
    if (protectedUrl) {
      console.log('🛑 [GLOBAL BLOCK] pushState BLOCKED');
      console.log('  Attempted URL:', args[2]);
      console.trace('Stack trace:');
      return; // BLOCK THE CHANGE
    }
    return originalPushState(...args);
  };

  window.history.replaceState = function(...args) {
    const protectedUrl = sessionStorage.getItem('globalProtectedUrl');
    if (protectedUrl) {
      console.log('🛑 [GLOBAL BLOCK] replaceState BLOCKED');
      console.log('  Attempted URL:', args[2]);
      console.trace('Stack trace:');
      return; // BLOCK THE CHANGE
    }
    return originalReplaceState(...args);
  };

  console.log('🔥 [POST LINK GLOBAL] URL protection installed - ALL URL changes blocked');
} else {
  console.log('🔥 [POST LINK GLOBAL] ❌ No post link params found');
}

// MediaNav data types
interface MediaImage {
  id: string;
  name: string;
  thumbnail: string;
  date: string;
  size: string;
  type: 'image' | 'video';
  dimensions?: string;
}

interface MediaMemory {
  id: string;
  title: string;
  category: string;
  labels?: string[];
  thumbnail: string;
  imageCount: number;
  date: string;
  type: 'personal' | 'shared';
  author?: string;
  images: MediaImage[];
  isExpanded?: boolean;
}

// Main App Component with Authentication
function MainApp() {
  // IMMEDIATELY store URL params BEFORE anything else runs
  const currentUrl = window.location.href;
  const urlParams = new URLSearchParams(window.location.search);
  const urlMemoryId = urlParams.get('memory_id');
  const urlPostId = urlParams.get('post_id');

  if (urlMemoryId && urlPostId) {
    console.log('🚨 IMMEDIATE: Detected post link params, storing NOW:', { urlMemoryId, urlPostId });
    sessionStorage.setItem('pendingPostView', JSON.stringify({
      memory_id: urlMemoryId,
      post_id: urlPostId,
      timestamp: Date.now(),
      originalUrl: currentUrl
    }));
    sessionStorage.setItem('preservePostUrl', currentUrl);
    sessionStorage.setItem('originalPostLinkUrl', currentUrl); // Triple backup
  }

  const { isAuthenticated, isLoading, login, register, user } = useAuth();
  const { limitData, checkLimit } = useMemoryLimit();
  const { viewType, currentProperty, switchToProperty: switchToPropertyCtx, isPendingPropertySwitch } = useProperty();

  // Check if user is property owner (admin) or visitor (read-only)
  const isPropertyOwner = useMemo(() => {
    if (isPartialAdmin()) return false; // Partial admin - restricted access
    if (viewType === 'personal') return true; // Personal account - full access
    if (!currentProperty || !user) return false; // No property or user - no access
    return currentProperty.user_id === user.external_user_id; // Check if user's external_user_id matches property user_id
  }, [viewType, currentProperty, user]);

  // 📍 DEBUG: Track user changes from AuthContext
  useEffect(() => {
    console.log('📍 App.tsx: User state changed from AuthContext:', user);
    console.log('📍 App.tsx: User location:', user?.location);
    console.log('📍 App.tsx: User email:', user?.email);
  }, [user]);
  const [showSignup, setShowSignup] = useState(() => {
    // Check if login=0 in URL or force_show_signup flag is set
    const urlParams = new URLSearchParams(window.location.search);
    const loginParam = urlParams.get('login');
    const forceSignup = sessionStorage.getItem('force_show_signup') === 'true';

    if (loginParam === '0' || forceSignup) {
      console.log('🔍 [App] Initializing with signup page (login=0 or force flag)');
      // Clear the flag after using it
      if (forceSignup) {
        sessionStorage.removeItem('force_show_signup');
      }
      return true;
    }
    return false;
  });
  const [activationToken, setActivationToken] = useState<string | null>(null);
  const [hasInitialRedirectHappened, setHasInitialRedirectHappened] = useState(false);
  const [isCheckingPublishedMemory, setIsCheckingPublishedMemory] = useState(false);
  const isCheckingRef = useRef(false); // Prevent multiple simultaneous checks

  // Popup blocked guide modal state
  const [showPopupGuide, setShowPopupGuide] = useState(false);
  const [blockedSessionInfo, setBlockedSessionInfo] = useState<any>(null);

  // New user upgrade modal state
  const [showNewUserUpgradeModal, setShowNewUserUpgradeModal] = useState(false);
  const [newUserHasProperties, setNewUserHasProperties] = useState(false);

  useEffect(() => {
    if (isAuthenticated && localStorage.getItem('is_new_user') === 'true') {
      // Check if account has any properties before showing the modal
      // If yes → hide Starter (show only Intermediate + Professional)
      dashboardAPI.getProperties()
        .then(res => {
          if (res.success && res.data) {
            const d = res.data.data || res.data;
            const owned = d.owned_properties || d.properties || [];
            setNewUserHasProperties(Array.isArray(owned) && owned.length > 0);
          }
        })
        .catch(() => {
          // On error fall back to false (show all plans)
          setNewUserHasProperties(false);
        })
        .finally(() => {
          setShowNewUserUpgradeModal(true);
        });
    }
  }, [isAuthenticated]);

  // Handle pending property switch immediately when authenticated — prevents personal account flash
  useEffect(() => {
    if (!isAuthenticated) return;
    const pendingId = localStorage.getItem('pending_property_switch');
    if (!pendingId) return;

    const handlePendingSwitch = async () => {
      try {
        const response = await dashboardAPI.getProperties();
        if (response.success && response.data) {
          const d = response.data.data || response.data;
          const allProperties = [
            ...(d.owned_properties || []),
            ...(d.shared_properties || []),
            ...(d.all_properties || d.properties || [])
          ];

          const target = pendingId === 'first'
            ? allProperties[0]
            : allProperties.find((p: any) => String(p.id) === String(pendingId));

          if (target) {
            switchToPropertyCtx(target);
            localStorage.removeItem('pending_property_switch');
          }
        }
      } catch (e) {
        console.error('Failed to handle pending property switch:', e);
      }
    };

    handlePendingSwitch();
  }, [isAuthenticated]);

  // Initialize invite flow hook
  const {
    isInviteFlow,
    inviteParams,
    showInviteModal,
    handleInviteAccept,
    handleInviteReject,
    handleLoginComplete,
  } = useInviteFlow();

  // Initialize QR invite flow hook (for anyone who scans QR code)
  const {
    isQrInviteFlow,
    qrInviteParams,
    isProcessingQrInvite
  } = useQrInviteFlow();

  // Handle /signup path when user is already authenticated — log them out so signup can proceed
  useEffect(() => {
    if (!isLoading && isAuthenticated && window.location.pathname === '/signup') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('email')) {
        localStorage.removeItem('stasht_user');
        localStorage.removeItem('stasht_token');
        sessionStorage.removeItem('stasht_session');
        window.location.reload();
      }
    }
  }, [isLoading, isAuthenticated]);

  // CRITICAL FIX: Force clear loading state for invite links with login=1
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteParam = urlParams.get('invite');
    const loginParam = urlParams.get('login');

    if (inviteParam === '1' && loginParam === '1') {
      console.log('🔧 FORCE FIX: Detected invite link with login=1, ensuring loading clears');
      console.log('🔧 Current isLoading:', isLoading);
      console.log('🔧 Current isAuthenticated:', isAuthenticated);

      // Force clear any stuck loading states after a short delay
      const timeoutId = setTimeout(() => {
        console.log('🔧 FORCE FIX: Timeout reached, checking if we need to force clear loading');
        if (isLoading) {
          console.error('⚠️ WARNING: isLoading still true after timeout - this indicates an issue with AuthContext');
          console.error('⚠️ User should see login page by now. Check AuthContext logs.');
        }
      }, 3000); // 3 second check

      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, isAuthenticated]);

  // CRITICAL PROTECTION: Force signup page when login=0 is in URL
  // This ensures nothing else can override the showSignup state
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const loginParam = urlParams.get('login');

    if (loginParam === '0' && !showSignup) {
      console.log('🛡️ PROTECTION: login=0 detected but showSignup is false - forcing showSignup=true');
      setShowSignup(true);
    }
  }, [showSignup]); // Run whenever showSignup changes

  // CRITICAL: Check for logged-in user vs invite collaborator mismatch
  // This runs in App.tsx so it catches the mismatch BEFORE routing happens
  useEffect(() => {
    // Only run this check if user is authenticated
    if (!isAuthenticated || !user) return;

    const urlParams = new URLSearchParams(window.location.search);
    const loginParam = urlParams.get('login');

    // ========================================================================
    // EARLIEST CHECK: login=0 invite link
    // Must run BEFORE all skip flags because SKIP_ALL_MISMATCH_CHECKS can be
    // permanently stuck in localStorage from a previous invite login.
    // login=0 means a NEW collaborator is being invited — if a different user
    // is currently logged in they must be logged out so the correct person can
    // sign up.  The only exception is if this user JUST completed the invite
    // signup (invite_login_completed within the last 5 minutes).
    // ========================================================================
    if (loginParam === '0') {
      const collaboratorParam = urlParams.get('collaborator');
      if (collaboratorParam) {
        const loggedInIdentifier = user.email || user.phone_number;

        // Only skip logout if this user JUST signed up via this exact invite
        const inviteCompletionStr = localStorage.getItem('invite_login_completed') || sessionStorage.getItem('invite_login_completed');
        let justCompletedThisInvite = false;
        if (inviteCompletionStr) {
          try {
            const ic = JSON.parse(inviteCompletionStr);
            if (ic.completed && ic.userIdentifier === loggedInIdentifier && (Date.now() - ic.timestamp) < 300000) {
              justCompletedThisInvite = true;
              console.log('🔒 [App] login=0 skipped — user just completed invite signup');
            }
          } catch (e) { /* ignore */ }
        }

        if (!justCompletedThisInvite) {
          const isCorrect = loggedInIdentifier ? isCorrectCollaborator(loggedInIdentifier, collaboratorParam) : false;

          console.log('🔍 [App] login=0 mismatch check:', {
            loggedIn: loggedInIdentifier,
            collaborator: collaboratorParam,
            isCorrect
          });

          if (!isCorrect) {
            // Wrong user is logged in — logout and redirect back to this URL
            // SignupPage will then show with collaborator email pre-filled
            console.log('🚪 [App] login=0 MISMATCH — logging out wrong user, redirecting to signup');

            // Save all invite params so SignupPage can read them after logout
            const inviteData = {
              invite: urlParams.get('invite'),
              memory_id: urlParams.get('memory_id'),
              title: urlParams.get('title'),
              image_link: urlParams.get('image_link'),
              user_name: urlParams.get('user_name'),
              profile_image: urlParams.get('profile_image'),
              email: urlParams.get('email'),
              collaborator: collaboratorParam,
              login: '0'
            };
            localStorage.setItem('pendingInvite', JSON.stringify(inviteData));
            sessionStorage.setItem('just_logged_out_for_invite', 'true');

            // Also clear the stale SKIP flag so it doesn't block future invite checks
            localStorage.removeItem('SKIP_ALL_MISMATCH_CHECKS');
            sessionStorage.removeItem('SKIP_ALL_MISMATCH_CHECKS');

            // Clear session (use userUtils.clearAuthData for a thorough clear)
            userUtils.clearAuthData();

            toast.warning('Please sign up with the invited email address');

            // Redirect to same URL — app sees login=0 + no auth → shows SignupPage
            window.location.href = window.location.pathname + window.location.search;
            return;
          }
        }
      }
      // Correct user or no collaborator param — skip rest of checks
      return;
    }

    // ========================================================================
    // ABSOLUTE FIRST CHECK: SKIP flag (highest priority) — for non-login=0
    // ========================================================================
    const skipFlag = localStorage.getItem('SKIP_ALL_MISMATCH_CHECKS') || sessionStorage.getItem('SKIP_ALL_MISMATCH_CHECKS');
    if (skipFlag === 'true') {
      console.log('🚫🚫🚫 [App] SKIP_ALL_MISMATCH_CHECKS = true');
      console.log('🚫🚫🚫 [App] COMPLETELY SKIPPING ALL MISMATCH CHECKS');
      return; // EXIT IMMEDIATELY - NO CHECKS AT ALL
    }

    // SECOND CHECK: Completed invite login (PERMANENT protection for this user)
    const inviteCompletionStr = localStorage.getItem('invite_login_completed') || sessionStorage.getItem('invite_login_completed');
    if (inviteCompletionStr) {
      try {
        const inviteCompletion = JSON.parse(inviteCompletionStr);
        const userIdentifier = user.email || user.phone_number;

        // If this user just completed invite login, NEVER check for mismatch
        if (inviteCompletion.completed && inviteCompletion.userIdentifier === userIdentifier) {
          const timeSinceCompletion = Date.now() - inviteCompletion.timestamp;

          // Keep protection for 5 minutes (300,000 ms)
          if (timeSinceCompletion < 300000) {
            console.log('🔒🔒🔒 [App] INVITE COMPLETION PROTECTION - This user completed invite login', timeSinceCompletion, 'ms ago');
            console.log('🔒🔒🔒 [App] User:', userIdentifier, '| Collaborator:', inviteCompletion.collaborator);
            console.log('🔒🔒🔒 [App] SKIPPING ALL CHECKS - Invite completion protection active');
            return; // EXIT - Absolutely NO checks for users who completed invite login
          } else {
            console.log('🔒 [App] Invite completion protection expired, clearing flag');
            localStorage.removeItem('invite_login_completed');
            sessionStorage.removeItem('invite_login_completed');
          }
        }
      } catch (e) {
        console.error('[App] Error parsing invite completion data:', e);
      }
    }

    // SECOND CHECK: Recent login timestamp (60 second protection window)
    const lastLoginTimestamp = localStorage.getItem('last_successful_login_timestamp');
    if (lastLoginTimestamp) {
      const timeSinceLogin = Date.now() - parseInt(lastLoginTimestamp);
      const withinProtectionWindow = timeSinceLogin < 60000; // 60 seconds

      if (withinProtectionWindow) {
        console.log('🔒 [App] LOGIN TIMESTAMP PROTECTION - User logged in', timeSinceLogin, 'ms ago');
        console.log('🔒 [App] SKIPPING ALL CHECKS - Protection window active for', (60000 - timeSinceLogin)/1000, 'more seconds');
        return; // EXIT - Absolutely NO checks within 60 seconds of login
      } else {
        console.log('🔒 [App] Protection window expired, clearing timestamp');
        localStorage.removeItem('last_successful_login_timestamp');
      }
    }

    // SECOND: Check for from_invite_login URL parameter
    const fromInviteLogin = urlParams.get('from_invite_login');

    if (fromInviteLogin === '1') {
      console.log('🔍 [App] ✅ from_invite_login=1 DETECTED IN URL - SKIPPING ALL CHECKS');
      console.log('🔍 [App] User just completed invite login - allowing access');

      // Clean the URL to remove the parameter
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      console.log('🔍 [App] Cleaned URL, removed from_invite_login parameter');

      // Clear all flags
      sessionStorage.removeItem('invite_login_success');
      sessionStorage.removeItem('invite_login_timestamp');
      sessionStorage.removeItem('just_completed_invite_login');
      return; // EXIT - Do NOT run ANY mismatch checks
    }

    // BACKUP: Check sessionStorage flags
    const inviteLoginSuccess = sessionStorage.getItem('invite_login_success');
    const inviteLoginTimestamp = sessionStorage.getItem('invite_login_timestamp');
    const justCompletedInviteLogin = sessionStorage.getItem('just_completed_invite_login');

    // Check flag OR timestamp (within last 10 seconds) as backup
    const isRecentInviteLogin = inviteLoginTimestamp &&
      (Date.now() - parseInt(inviteLoginTimestamp)) < 10000; // 10 second window

    if (inviteLoginSuccess === 'true' || justCompletedInviteLogin === 'true' || isRecentInviteLogin) {
      console.log('🔍 [App] INVITE LOGIN DETECTED via flags - SKIPPING ALL MISMATCH CHECKS');
      console.log('🔍 [App] Flags:', { inviteLoginSuccess, justCompletedInviteLogin, isRecentInviteLogin });
      console.log('🔍 [App] Clearing flags and allowing user to proceed');

      // Clear all flags
      sessionStorage.removeItem('invite_login_success');
      sessionStorage.removeItem('invite_login_timestamp');
      sessionStorage.removeItem('just_completed_invite_login');
      return; // EXIT - Do NOT run mismatch check
    }

    // SKIP this check if login=1 - LoginPage handles the mismatch check on mount
    if (loginParam === '1') {
      console.log('🔍 [App] login=1 detected - LoginPage handles mismatch check');
      return;
    }

    let inviteCollaborator = urlParams.get('collaborator');

    if (!inviteCollaborator) {
      // Check storage
      const storedInvite = sessionStorage.getItem('pendingInvite') || localStorage.getItem('pendingInvite');
      if (storedInvite) {
        try {
          const parsed = JSON.parse(storedInvite);
          inviteCollaborator = parsed.collaborator;
        } catch (e) {
          console.error('[App] Failed to parse stored invite:', e);
        }
      }
    }

    // If there's an invite collaborator, check for mismatch
    if (inviteCollaborator) {
      const loggedInIdentifier = user.email || user.phone_number;

      // Use isCorrectCollaborator for proper email/phone comparison with decoding
      const isCorrect = loggedInIdentifier ? isCorrectCollaborator(loggedInIdentifier, inviteCollaborator) : false;
      const isMismatch = !isCorrect;

      console.log('🔍 [App] Mismatch check:', {
        loggedIn: loggedInIdentifier,
        invited: inviteCollaborator,
        isCorrect,
        mismatch: isMismatch
      });

      if (isMismatch) {
        console.log('🚪 [App] MISMATCH DETECTED - Logging out wrong user and redirecting to login');

        // Store invite params before logout
        if (urlParams.get('invite') === '1') {
          const inviteData = {
            invite: urlParams.get('invite'),
            memory_id: urlParams.get('memory_id'),
            title: urlParams.get('title'),
            image_link: urlParams.get('image_link'),
            user_name: urlParams.get('user_name'),
            profile_image: urlParams.get('profile_image'),
            email: urlParams.get('email'),
            collaborator: urlParams.get('collaborator'),
            login: urlParams.get('login')
          };
          localStorage.setItem('pendingInvite', JSON.stringify(inviteData));
          console.log('💾 [App] Saved invite params to localStorage');
        }

        // Set flag to prevent clearing
        sessionStorage.setItem('just_logged_out_for_invite', 'true');

        // Clear user session
        localStorage.removeItem('stasht_user');
        localStorage.removeItem('stasht_token');
        sessionStorage.removeItem('stasht_session');

        // Show toast
        toast.warning('Please login with the invited email address');

        // PRESERVE URL parameters when redirecting
        const redirectUrl = window.location.pathname + window.location.search;
        window.location.href = redirectUrl;
      }
    }
  }, [isAuthenticated, user]);

  // Delete old notifications (older than 1 week) when user is authenticated
  useEffect(() => {
    const deleteOldNotifications = async () => {
      if (!isAuthenticated || !user) return;

      try {
        console.log('🗑️ [App] Deleting old notifications (older than 1 week)...');
        const response = await dashboardAPI.deleteOldNotifications();

        if (response.success) {
          console.log('✅ [App] Successfully deleted old notifications:', response);
        } else {
          console.log('⚠️ [App] Failed to delete old notifications:', response.error);
        }
      } catch (error) {
        console.error('❌ [App] Error deleting old notifications:', error);
      }
    };

    deleteOldNotifications();
  }, [isAuthenticated, user]);

  // MAGIC LINK: Store email parameter IMMEDIATELY on mount (before routing strips it)
  useEffect(() => {
    console.log('🔗 [MagicLink INIT] Checking for email param on mount...');
    console.log('🔗 [MagicLink INIT] window.location.search:', window.location.search);

    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('collaborator');

    if (emailParam) {
      console.log('🔗 [MagicLink INIT] Found email param, storing it:', emailParam);
      // Store email in sessionStorage IMMEDIATELY before it gets lost
      sessionStorage.setItem('pending_magic_link_email', emailParam);
    }
  }, []); // Run ONCE on mount with empty dependency array

  // MAGIC LINK HANDLER: Process stored email parameter
  useEffect(() => {
    // CRITICAL FIX: Skip magic link handler for ALL invite links (login=1 OR login=0)
    // This prevents conflicts with invite flow
    const urlParams = new URLSearchParams(window.location.search);
    const inviteParam = urlParams.get('invite');
    const loginParam = urlParams.get('login');

    if (inviteParam === '1' && (loginParam === '1' || loginParam === '0')) {
      console.log('🔗 [MagicLink] SKIPPING - invite link with login=' + loginParam + ' detected');
      return;
    }

    // Skip magic link handler on /signup or /login path when ?email= is directly in the URL.
    // Those pages read the email from the URL themselves — running the handler would strip
    // the param and trigger an unnecessary reload/redirect loop.
    const currentPath = window.location.pathname;
    if ((currentPath === '/signup' || currentPath === '/login') && urlParams.get('email')) {
      console.log('🔗 [MagicLink] SKIPPING - ' + currentPath + ' with ?email= param, page handles it directly');
      return;
    }

    console.log('🔗🔗🔗 [MagicLink] useEffect RUNNING');
    console.log('🔗 [MagicLink] window.location.href:', window.location.href);
    console.log('🔗 [MagicLink] window.location.pathname:', window.location.pathname);
    console.log('🔗 [MagicLink] window.location.search:', window.location.search);
    console.log('🔗 [MagicLink] isAuthenticated:', isAuthenticated);
    console.log('🔗 [MagicLink] user:', user);

    const handleMagicLink = async () => {
      // Check BOTH URL params AND stored param
      let emailParam = urlParams.get('collaborator');

      console.log('🔗 [MagicLink] URL params:', urlParams.toString());
      console.log('🔗 [MagicLink] Email param from URL:', emailParam);

      // Check ALL possible storage locations
      const pendingEmail = sessionStorage.getItem('pending_magic_link_email');
      const magicEmail = sessionStorage.getItem('magic_link_email');

      console.log('🔗 [MagicLink] sessionStorage.pending_magic_link_email:', pendingEmail);
      console.log('🔗 [MagicLink] sessionStorage.magic_link_email:', magicEmail);

      // Use any available email source
      if (!emailParam) {
        emailParam = pendingEmail || magicEmail;
        console.log('🔗 [MagicLink] Email not in URL, using storage:', emailParam);
      }

      // If no email parameter, skip
      if (!emailParam) {
        console.log('🔗 [MagicLink] ❌ No email parameter found anywhere, exiting');
        return;
      }

      console.log('🔗 [MagicLink] Found email parameter:', emailParam);

      // Decode the email (in case it's URL encoded)
      const decodedEmail = decodeURIComponent(emailParam);
      console.log('🔗 [MagicLink] Decoded email:', decodedEmail);

      // Check current path to determine if login or signup flow
      const currentPath = window.location.pathname;
      const isSignupFlow = currentPath.includes('/signup') || currentPath.includes('signup');

      console.log('🔗 [MagicLink] Current path:', currentPath);
      console.log('🔗 [MagicLink] Is signup flow:', isSignupFlow);

      // SIGNUP FLOW: Always logout and go to signup with prefilled email
      if (isSignupFlow) {
        console.log('🔗 [MagicLink] SIGNUP FLOW detected');

        // Logout current user
        localStorage.removeItem('stasht_user');
        localStorage.removeItem('stasht_token');
        sessionStorage.removeItem('stasht_session');

        // Store email for prefill
        sessionStorage.setItem('magic_link_email', decodedEmail);

        // Remove email param from URL and storage
        urlParams.delete('email');
        sessionStorage.removeItem('pending_magic_link_email');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);

        // Reload to show signup page with prefilled email
        window.location.reload();
        return;
      }

      // LOGIN FLOW: Check if user is logged in
      if (!isAuthenticated || !user) {
        console.log('🔗 [MagicLink] User not logged in');

        // Store email for prefill so LoginPage can read it
        sessionStorage.setItem('magic_link_email', decodedEmail);
        sessionStorage.removeItem('pending_magic_link_email');

        // If already on /login, don't redirect — LoginPage is already showing and will
        // read magic_link_email from sessionStorage to prefill the form.
        // Redirecting here would cause an infinite loop because on each reload the
        // handler would find magic_link_email in sessionStorage and redirect again.
        if (window.location.pathname === '/login') {
          console.log('🔗 [MagicLink] Already on /login — skipping redirect to avoid loop');
          return;
        }

        // Remove email param from URL
        urlParams.delete('email');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);

        // Redirect to login
        window.location.href = '/login';
        return;
      }

      // User is logged in, check if emails match
      const loggedInEmail = user.email || user.phone_number;
      const emailsMatch = loggedInEmail?.toLowerCase() === decodedEmail.toLowerCase();

      console.log('🔗 [MagicLink] Logged in email:', loggedInEmail);
      console.log('🔗 [MagicLink] Emails match:', emailsMatch);

      if (!emailsMatch) {
        // MISMATCH: Logout and redirect to login with prefilled email
        console.log('🔗 [MagicLink] Email mismatch, logging out and redirecting');

        // Logout current user
        localStorage.removeItem('stasht_user');
        localStorage.removeItem('stasht_token');
        sessionStorage.removeItem('stasht_session');

        // Store email for prefill
        sessionStorage.setItem('magic_link_email', decodedEmail);

        // Remove email param from URL and storage
        urlParams.delete('email');
        sessionStorage.removeItem('pending_magic_link_email');

        // Show toast
        toast.warning('Please login with the correct email address');

        // Redirect to login
        window.location.href = '/login';
        return;
      }

      // MATCH: User is logged in with correct email
      console.log('🔗 [MagicLink] Email matches logged-in user!');
      console.log('🔗 [MagicLink] Calling collaborators API...');

      try {
        // Call API to get collaborators data
        const response = await authAPI.getCollaboratorsForMagicLink(decodedEmail, 'admin');

        console.log('🔗 [MagicLink] API response:', response);

        if (response.success && response.data) {
          const collaboratorsData = response.data.collaborators || [];
          console.log('🔗 [MagicLink] Collaborators:', collaboratorsData);

          // Check for admin collaborator
          const adminCollab = collaboratorsData.find((c: any) => c.role === 'admin');

          if (adminCollab) {
            console.log('🔗 [MagicLink] Admin collaborator found!');
            console.log('🔗 [MagicLink] Admin collaborator:', adminCollab);

            // Store collaborators in localStorage for AccountChoiceModal
            localStorage.setItem('magic_link_admin_collaborator', JSON.stringify(adminCollab));
            localStorage.setItem('magic_link_show_modal', 'true');

            console.log('🔗 [MagicLink] ✅ Data stored! AccountChoiceModal will be shown on memories page');

            toast.success('Admin access detected! Redirecting...');
          } else {
            console.log('🔗 [MagicLink] No admin collaborator found, continuing normally');
          }

          // Clean up URL (remove email parameter) WITHOUT refreshing page
          urlParams.delete('email');
          sessionStorage.removeItem('pending_magic_link_email');
          const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
          window.history.replaceState({}, '', newUrl);

          console.log('🔗 [MagicLink] URL cleaned, no redirect needed');
        }
      } catch (error) {
        console.error('🔗 [MagicLink] Error calling collaborators API:', error);
        toast.error('Failed to load collaborator information');

        // Clean up URL even on error
        urlParams.delete('email');
        sessionStorage.removeItem('pending_magic_link_email');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
      }
    };

    handleMagicLink();
  }, [isAuthenticated, user]);

  // Check if we should import Google Photos after signup
  useEffect(() => {
    console.log('📸 Checking for import flag... isAuthenticated:', isAuthenticated);

    if (!isAuthenticated) {
      console.log('📸 User not authenticated, skipping');
      return;
    }

    const shouldImport = sessionStorage.getItem('open_google_photos_picker_on_load');
    console.log('📸 Import flag value:', shouldImport);

    if (shouldImport === 'true') {
      console.log('📸 ✅ Flag found! Importing Google Photos...');
      sessionStorage.removeItem('open_google_photos_picker_on_load');

      // Small delay to ensure page is fully loaded
      setTimeout(async () => {
        console.log('📸 Starting import...');
        await importGooglePhotosAfterAuth();
      }, 2000);
    } else {
      console.log('📸 No import flag found, skipping');
    }
  }, [isAuthenticated]);

  // Check if we should open Google Photos picker from media page sync
  useEffect(() => {
    console.log('📸 Checking for media page picker flag... isAuthenticated:', isAuthenticated);

    if (!isAuthenticated) {
      console.log('📸 User not authenticated, skipping');
      return;
    }

    const shouldOpenPicker = sessionStorage.getItem('open_google_photos_picker_on_media');
    console.log('📸 Media picker flag value:', shouldOpenPicker);

    if (shouldOpenPicker === 'true') {
      console.log('📸 ✅ Media picker flag found! Opening Google Photos picker...');
      sessionStorage.removeItem('open_google_photos_picker_on_media');

      // Small delay to ensure page is fully loaded
      setTimeout(async () => {
        console.log('📸 Starting picker from media page...');
        const result = await openGooglePhotosPicker((importResult) => {
          if (importResult && importResult.success) {
            console.log('📸 Photos imported successfully:', importResult.count);
            toast.success(`Imported ${importResult.count} photos!`);
            // Go to All Media tab after sync
            sessionStorage.setItem('activeServiceTab', 'all');
            sessionStorage.setItem('service_just_connected', 'true');
            window.location.reload();
          }
        });

        // Check if popup was blocked
        if (result && result.popupBlocked) {
          console.log('🚫 Popup was blocked, showing guide...');
          setBlockedSessionInfo(result);
          setShowPopupGuide(true);
        }
      }, 2000);
    } else {
      console.log('📸 No media picker flag found, skipping');
    }
  }, [isAuthenticated]);

  // Check if we're coming back from the picker and should poll for results
  useEffect(() => {
    const pollingActive = sessionStorage.getItem('google_photos_polling_active');
    const sessionId = sessionStorage.getItem('google_photos_session_id');
    const accessToken = sessionStorage.getItem('google_photos_access_token') || sessionStorage.getItem('google_access_token');

    if (pollingActive === 'true' && sessionId && accessToken && isAuthenticated) {
      console.log('📸 Returned from picker! Starting to poll for results...');
      sessionStorage.removeItem('google_photos_polling_active');

      // Start polling
      let pollInterval = 2000;
      let pollAttempts = 0;
      const maxAttempts = 60;

      const pollSession = async () => {
        pollAttempts++;
        console.log(`📸 Polling attempt ${pollAttempts}/${maxAttempts}...`);

        const statusResult = await googleAuthAPI.getPickerSessionStatus(sessionId, accessToken);

        if (statusResult.error) {
          console.error('❌ Error polling session:', statusResult.error);
          toast.error('Failed to check photo selection status');
          return;
        }

        if (statusResult.pollingConfig?.pollInterval) {
          pollInterval = statusResult.pollingConfig.pollInterval;
        }

        console.log('📸 Media items set:', statusResult.mediaItemsSet);

        if (statusResult.mediaItemsSet) {
          console.log('📸 User finished selection! Getting media items...');
          toast.info('Getting selected photos...');

          const mediaResult = await googleAuthAPI.getPickerMediaItems(sessionId, accessToken);

          if (mediaResult.error) {
            console.error('❌ Error getting media items:', mediaResult.error);
            toast.error('Failed to get selected photos');
            sessionStorage.removeItem('google_photos_session_id');
            sessionStorage.removeItem('google_photos_access_token');
            return;
          }

          const mediaItems = mediaResult.mediaItems || [];
          console.log('📸 ✅ Got media items:', mediaItems.length);

          if (mediaItems.length > 0) {
            const formattedResult = {
              photos: mediaItems.map((item: any) => ({
                id: item.id,
                name: item.filename || 'Untitled',
                url: item.baseUrl,
                mimeType: item.mimeType,
                width: item.mediaMetadata?.width,
                height: item.mediaMetadata?.height,
                description: item.description,
                creationTime: item.mediaMetadata?.creationTime,
              }))
            };
            await handlePhotoPickerResult(formattedResult);
          } else {
            toast.info('No photos selected');
          }

          sessionStorage.removeItem('google_photos_session_id');
          sessionStorage.removeItem('google_photos_access_token');
        } else if (pollAttempts < maxAttempts) {
          setTimeout(pollSession, pollInterval);
        } else {
          console.log('📸 Polling timeout');
          toast.info('Photo selection timed out');
          sessionStorage.removeItem('google_photos_session_id');
          sessionStorage.removeItem('google_photos_access_token');
        }
      };

      setTimeout(pollSession, pollInterval);
    }
  }, [isAuthenticated]);

  // NOTE: Google Photos Picker functions have been moved to utils/googlePhotosPickerUtils.ts
  // They are now reusable across signup and media sync flows

  // Auto-trigger picker after signup (replaces OAuth flow)
  const importGooglePhotosAfterAuth = async () => {
    // Simply call the picker - it handles everything
    const result = await openGooglePhotosPicker();

    // Check if popup was blocked
    if (result && result.popupBlocked) {
      console.log('🚫 Popup was blocked after signup, showing guide...');
      setBlockedSessionInfo(result);
      setShowPopupGuide(true);
    }
  };


  // Initialize app navigation hook (moved up to fix dependency order)
  const {
    currentPage,
    selectedMemoryId,
    memoriesNavKey,
    isSubSidebarExpanded,
    shouldShowSubSidebar,
    shouldOpenAddMoments,
    setShouldOpenAddMoments,
    shouldOpenEdit,
    setShouldOpenEdit,
    shouldOpenComments,
    setShouldOpenComments,
    commentId,
    shouldOpenImageModal,
    setShouldOpenImageModal,
    imageId,
    shouldOpenModerationTab,
    setShouldOpenModerationTab,
    shouldOpenCollaboratorsTab,
    setShouldOpenCollaboratorsTab,
    forceSharedView,
    handleNavigation,
    handleMemorySelect,
    handleLinkedMemorySelect,
    handleBackFromMemory,
    toggleSubSidebarExpansion,
  } = useAppNavigation();

  // Deep-link target for opening a "My Conversations" thread from a
  // lead_message notification. Consumed (and cleared) by UsersPage.
  const [pendingConversationLeadId, setPendingConversationLeadId] = useState<number | null>(null);
  const handleOpenConversation = useCallback((leadId: number) => {
    setPendingConversationLeadId(leadId);
    handleNavigation('users');
  }, [handleNavigation]);

  // State variables (moved up to fix dependency order)
  const [selectedMemoryCategory, setSelectedMemoryCategory] = useState<string | null>(null);
  const [createMemoryTrigger, setCreateMemoryTrigger] = useState<{ category?: string; timestamp: number } | null>(null);
  const [createCategorySignal, setCreateCategorySignal] = useState(0); // bump to open the sidebar's "New Category" popover
  const [openPublishedEntrySignal, setOpenPublishedEntrySignal] = useState<{ entry: any; nonce: number } | null>(null); // set to open a published-author entry from the desktop sidebar
  const [showPlusPopover, setShowPlusPopover] = useState(false);
  const [showAddMomentModal, setShowAddMomentModal] = useState(false);
  const [showBottomNavCamera, setShowBottomNavCamera] = useState(false);
  const scanPhotoInputRef = useRef<HTMLInputElement>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    const dismissed = localStorage.getItem('pwa-install-dismissed') === '1';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.matchMedia('(max-width: 768px)').matches;
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    // If native prompt already fired before React mounted, pick it up and show banner
    if ((window as any).deferredInstallPrompt) {
      setInstallPrompt((window as any).deferredInstallPrompt);
      if (!isStandalone && !dismissed && isMobile) {
        setShowInstallBanner(true);
      }
    } else if (isIOS && !isStandalone && !dismissed) {
      // iOS never fires beforeinstallprompt — show banner with manual instructions as fallback
      setShowInstallBanner(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      (window as any).deferredInstallPrompt = e;
      setInstallPrompt(e);
      // Show banner only now that native prompt is confirmed available
      if (!isStandalone && !dismissed && isMobile) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setShowInstallBanner(false);
      localStorage.setItem('pwa-install-dismissed', '1');
      (window as any).deferredInstallPrompt = null;
    });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const [notificationCount, setNotificationCount] = useState(0); // Initialize with 0, will fetch actual count
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [timePeriod, setTimePeriod] = useState("weekly");
  const [categories, setCategories] = useState<Category[]>(categoriesData);
  const [labels, setLabels] = useState<Label[]>(labelsData);

  // AI Processing state for background processing
  const [aiProcessing, setAiProcessing] = useState<{
    memoryId: string;
    status: 'processing' | 'completed' | 'failed';
    startTime: number;
    result?: any;
    progress?: number;
    title?: string;
    subtitle?: string;
    navigateTo?: string;
    personId?: string;
  } | null>(null);
  const [pendingFacePersonId, setPendingFacePersonId] = useState<string | null>(null);
  const [shouldOpenAIResults, setShouldOpenAIResults] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const [pendingNewMediaIds, setPendingNewMediaIds] = useState<(string | number)[]>([]);
  const [dismissedNewMediaIds, setDismissedNewMediaIds] = useState<Set<string>>(new Set());
  const [pendingNavPage, setPendingNavPage] = useState<string | null>(null);
  const [showLeaveMediaDialog, setShowLeaveMediaDialog] = useState(false);
  const [isViewingPublishedEntry, setIsViewingPublishedEntry] = useState(false);

  // Check URL for memory and image parameters on mount
  useEffect(() => {
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);

    // Check if URL matches /stories/{memoryId}?image={imageId}
    const memoryMatch = pathname.match(/\/stories\/(\d+)/);
    const imageParam = searchParams.get('image');

    if (memoryMatch && imageParam) {
      const memoryId = memoryMatch[1];
      console.log('🔗 URL contains memory and image parameters:', { memoryId, imageId: imageParam });

      // Open the memory with the specific image
      handleMemorySelect(memoryId, {
        openImageModal: true,
        imageId: imageParam
      });
    }
  }, []); // Run only once on mount

  // Deep link handler - restore after authentication completes
  useEffect(() => {
    // Only run after authentication is loaded
    if (isLoading) {
      console.log('🔗 Deep link check: Still loading, waiting...');
      return;
    }

    const pendingDeepLinkStr = sessionStorage.getItem('pendingDeepLink');
    if (!pendingDeepLinkStr) {
      return; // No pending deep link
    }

    // Protection: Check if we're already processing this deep link
    const isProcessingDeepLink = sessionStorage.getItem('isProcessingDeepLink');
    if (isProcessingDeepLink === 'true') {
      console.log('🔗 Deep link handler: Already processing, skipping...');
      return;
    }

    try {
      const deepLinkData = JSON.parse(pendingDeepLinkStr);
      console.log('🔗 Deep link handler: Found pending deep link:', deepLinkData);

      // Check if user is authenticated
      if (isAuthenticated && user) {
        const currentExternalUserId = user.external_user_id || user.id;
        console.log('🔗 Deep link handler: User authenticated, checking userId match:', {
          currentExternalUserId,
          currentType: typeof currentExternalUserId,
          targetUserId: deepLinkData.userId,
          targetType: typeof deepLinkData.userId
        });

        // FIX: Convert both to strings to avoid type mismatch (string "772" vs number 772)
        if (String(currentExternalUserId) === String(deepLinkData.userId)) {
          // User ID matches - open memory with image modal
          console.log('🔗 Deep link handler: ✅ User ID matches - opening memory with image modal');

          // Set processing flag to prevent double-processing
          sessionStorage.setItem('isProcessingDeepLink', 'true');

          // Clear the pending deep link
          sessionStorage.removeItem('pendingDeepLink');

          // Navigate to memory page and open image modal
          handleNavigation('memories');
          handleMemorySelect(deepLinkData.memoryId, {
            openImageModal: true,
            imageId: deepLinkData.imageId
          });

          // Clear processing flag after a short delay
          setTimeout(() => {
            sessionStorage.removeItem('isProcessingDeepLink');
          }, 2000);
        } else {
          // User ID doesn't match - logout and redirect
          console.log('🔗 Deep link handler: ❌ User ID mismatch - logging out');
          console.log('🔗 Deep link handler: Current user:', String(currentExternalUserId), '| Target:', String(deepLinkData.userId));

          // Don't clear pendingDeepLink - keep it for after re-login
          userUtils.clearAuthData();
          resetMediaCache();
          window.location.href = '/login';
        }
      } else {
        // User not authenticated - login page will handle redirect after login
        console.log('🔗 Deep link handler: User not authenticated - login page will handle redirect');
      }
    } catch (err) {
      console.error('🔗 Deep link handler: Error parsing pending deep link:', err);
      sessionStorage.removeItem('pendingDeepLink');
      sessionStorage.removeItem('isProcessingDeepLink');
    }
  }, [isAuthenticated, isLoading, user]); // Minimal dependencies

  // Monitor URL changes and store post params whenever they appear
  useEffect(() => {
    let lastUrl = window.location.href;

    const checkAndStoreParams = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const postId = searchParams.get('post_id');
      const memoryId = searchParams.get('memory_id');

      console.log('🌐 URL CHECK:', { postId, memoryId, url: window.location.href });

      if (postId && memoryId) {
        const pendingData = {
          memory_id: memoryId,
          post_id: postId,
          timestamp: Date.now(),
          originalUrl: window.location.href // Store the complete URL
        };
        sessionStorage.setItem('pendingPostView', JSON.stringify(pendingData));
        sessionStorage.setItem('preservePostUrl', window.location.href); // Extra backup
        console.log('💾 STORED params from URL:', pendingData);
        console.log('🔒 URL PROTECTION: Will preserve this URL:', window.location.href);
      }
    };

    // Check immediately
    checkAndStoreParams();

    // Detect ANY URL change including direct assignment
    const urlChangeDetector = setInterval(() => {
      if (window.location.href !== lastUrl) {
        console.log('⚠️ URL CHANGED DETECTED!');
        console.log('  FROM:', lastUrl);
        console.log('  TO:', window.location.href);
        console.trace('URL change stack trace');

        const preserveUrl = sessionStorage.getItem('preservePostUrl');
        if (preserveUrl && !isAuthenticated) {
          console.log('🚨 UNAUTHORIZED URL CHANGE! Restoring:', preserveUrl);
          window.history.replaceState({}, '', preserveUrl);
        }

        lastUrl = window.location.href;
        checkAndStoreParams();
      }
    }, 100); // Check every 100ms

    // Listen for URL changes (back/forward navigation)
    window.addEventListener('popstate', checkAndStoreParams);

    // Listen for app navigation events from deep components
    const handleAppNavigate = (e: Event) => {
      const page = (e as CustomEvent).detail;
      if (page) handleNavigation(page);
    };
    window.addEventListener('app-navigate', handleAppNavigate);

    // PREVENT URL changes when there are post params
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(...args) {
      const preserveUrl = sessionStorage.getItem('preservePostUrl');
      if (preserveUrl && !isAuthenticated) {
        console.log('🛑 BLOCKED URL change to preserve post link:', args);
        return; // Block the URL change
      }
      return originalPushState.apply(this, args);
    };

    window.history.replaceState = function(...args) {
      const preserveUrl = sessionStorage.getItem('preservePostUrl');
      if (preserveUrl && !isAuthenticated) {
        console.log('🛑 BLOCKED URL change to preserve post link:', args);
        return; // Block the URL change
      }
      return originalReplaceState.apply(this, args);
    };

    return () => {
      clearInterval(urlChangeDetector);
      window.removeEventListener('popstate', checkAndStoreParams);
      window.removeEventListener('app-navigate', handleAppNavigate);
      // Restore original functions
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [isAuthenticated]); // Re-run when auth state changes

  // Detect initial page from URL pathname on mount (for /media, /memories, etc.)
  useEffect(() => {
    const pathname = window.location.pathname;
    console.log('🔍 Initial URL pathname detection:', pathname);

    // Only set initial page if we're on a recognized route
    // This runs ONCE on mount to sync URL with currentPage state
    if (pathname === '/media' || pathname.startsWith('/media/')) {
      console.log('🔍 Detected /media URL - setting currentPage to media');
      handleNavigation('media');

      // Check if there's an activeServiceTab in sessionStorage (from sync)
      const sessionTab = sessionStorage.getItem('activeServiceTab');
      if (sessionTab && sessionTab !== 'all') {
        console.log('🔍 Found activeServiceTab in session:', sessionTab);
        setActiveServiceTab(sessionTab);
      }
    } else if (pathname === '/memories' || pathname.startsWith('/memories/')) {
      console.log('🔍 Detected /memories URL - setting currentPage to memories');
      // Deep link will be handled by the separate deep link useEffect
      // Just set the page to memories so it's not stuck on loading
      handleNavigation('memories');
    } else if (pathname === '/stories' || pathname.startsWith('/stories/')) {
      console.log('🔍 Detected /stories URL - setting currentPage to memories');

      // Check for post_id parameter to auto-open image modal
      const searchParams = new URLSearchParams(window.location.search);
      const postId = searchParams.get('post_id');
      const paramMemoryId = searchParams.get('memory_id');

      // Store post params if present (will be handled by separate effect after auth loads)
      if (postId && paramMemoryId) {
        console.log('🔍🔍🔍 DETECTED post_id and memory_id in URL:', { postId, memoryId: paramMemoryId, isAuthenticated });

        // Store params for later use
        const pendingData = {
          memory_id: paramMemoryId,
          post_id: postId,
          timestamp: Date.now()
        };
        sessionStorage.setItem('pendingPostView', JSON.stringify(pendingData));
        console.log('💾💾💾 STORED pendingPostView in sessionStorage:', pendingData);
        console.log('✅ Verification - can read back:', sessionStorage.getItem('pendingPostView'));

        // If authenticated, use normal flow
        if (isAuthenticated) {
          console.log('✅ User IS authenticated - opening modal immediately');
          handleNavigation('memories');
          handleMemorySelect(paramMemoryId, { openImageModal: true, imageId: postId });
        } else {
          // For non-authenticated users, DON'T call handleNavigation to preserve URL parameters
          // Just let the login page show, and after login the restore effect will handle it
          console.log('🔒🔒🔒 User NOT authenticated - will restore after login');
          console.log('🔒 Current URL:', window.location.href);
          console.log('🔒 SessionStorage has pendingPostView:', !!sessionStorage.getItem('pendingPostView'));
        }
      } else if (paramMemoryId) {
        console.log('🔍 Detected memory_id in URL - auto-selecting memory:', paramMemoryId);
        handleNavigation('memories');
        if (isAuthenticated) {
          handleMemorySelect(paramMemoryId);
        }
      } else {
        handleNavigation('memories');
      }
    } else if (pathname === '/profile' || pathname.startsWith('/profile')) {
      console.log('🔍 Detected /profile URL - setting currentPage to profile');
      handleNavigation('profile');
    } else if (pathname === '/users' || pathname.startsWith('/users')) {
      console.log('🔍 Detected /users URL - setting currentPage to users');
      handleNavigation('users');
    } else if (pathname === '/csv-upload') {
      console.log('🔍 Detected /csv-upload URL - setting currentPage to csv-upload');
      handleNavigation('csv-upload');
    } else if (pathname === '/marketplace' || pathname.startsWith('/marketplace/')) {
      console.log('🔍 Detected /marketplace URL - setting currentPage to marketplace');
      handleNavigation('marketplace');
    }
    // If pathname is '/' or '/dashboard', do nothing - let default 'dashboard' stay
  }, []); // Run only once on mount

  // Media page navigation - activeServiceTab is now automatically preserved via sessionStorage
  // No need to reset since state initializes from sessionStorage and syncs automatically

  // Navigation wrapper - no longer needs special handling since activeServiceTab auto-syncs
  const handleNavigationWithReset = (page: string) => {
    console.log('🔄 Navigation to:', page, '- current activeServiceTab:', activeServiceTab);
    if (currentPage === 'media' && pendingNewMediaIds.length > 0 && page !== 'media') {
      setPendingNavPage(page);
      setShowLeaveMediaDialog(true);
      return;
    }
    handleNavigation(page);
  };

  const handleLeaveMediaConfirm = async () => {
    setShowLeaveMediaDialog(false);
    const ids = pendingNewMediaIds;
    setPendingNewMediaIds([]);
    setSelectedMediaItems([]);
    if (ids.length > 0) {
      setDismissedNewMediaIds(prev => new Set([...prev, ...ids.map(String)]));
    }
    try {
      if (ids.length > 0) await mediaAPI.markImagesSeen(ids);
    } catch (e) {
      // non-blocking
    }
    if (pendingNavPage) {
      handleNavigation(pendingNavPage);
      setPendingNavPage(null);
    }
  };

  const handleLeaveMediaCancel = () => {
    setShowLeaveMediaDialog(false);
    setPendingNavPage(null);
  };

  // Initialize colors for static categories on component mount
  useEffect(() => {
    initializeCategoryColors(categoriesData.map(cat => ({
      name: cat.name,
      color: cat.color 
    })));
  }, []);

  // Fetch initial notification count when app loads and user is authenticated
  useEffect(() => {
    const fetchInitialNotificationCount = async () => {
      if (isAuthenticated && !isLoading) {
        try {
          const response = await dashboardAPI.getUserNotifications();
          if (response.success && response.data) {
            let notificationsData = response.data.notifications || response.data.data || response.data;
            if (Array.isArray(notificationsData)) {
              const unreadCount = notificationsData.filter((n: any) => 
                n.is_read === false || n.is_read === 0 || n.is_read === undefined || n.is_read === null
              ).length;
              setNotificationCount(unreadCount);
              console.log('📊 Initial notification count:', unreadCount);
            }
          }
        } catch (error) {
          console.error('Error fetching initial notification count:', error);
        }
      }
    };

    fetchInitialNotificationCount();
  }, [isAuthenticated, isLoading]);

  // Check for pending redirect after login (from published memory page)
  useEffect(() => {
    if (isAuthenticated && user && !isLoading && !hasInitialRedirectHappened) {
      const pendingRedirect = localStorage.getItem('pendingRedirectAfterLogin') ||
                             sessionStorage.getItem('redirectAfterLogin');

      if (pendingRedirect) {
        try {
          const { url, timestamp } = JSON.parse(pendingRedirect);
          const isRecent = timestamp && (Date.now() - timestamp < 5 * 60 * 1000);

          if (isRecent && url) {
            console.log('🔄 Found pending redirect after login:', url);

            // Mark that redirect happened to prevent role-based redirect
            setHasInitialRedirectHappened(true);

            // Navigate to the published memory page
            // DO NOT clear the redirect data here - let PublishedMemoryPage handle it
            console.log('🔄 Redirecting to:', url);
            window.location.href = url;
            return;
          } else {
            // Clean up stale redirect data
            console.log('⚠️ Redirect data is stale or invalid, clearing...');
            localStorage.removeItem('pendingRedirectAfterLogin');
            sessionStorage.removeItem('redirectAfterLogin');
          }
        } catch (error) {
          console.error('Error parsing pending redirect:', error);
          localStorage.removeItem('pendingRedirectAfterLogin');
          sessionStorage.removeItem('redirectAfterLogin');
        }
      }
    }
  }, [isAuthenticated, user, isLoading, hasInitialRedirectHappened]);

  // Handle post viewing for non-authenticated users (check if memory is published)
  // DISABLED - Just show login page directly without checking published status
  useEffect(() => {
    // Always clear the loading state
    setIsCheckingPublishedMemory(false);
    isCheckingRef.current = false;
    console.log('✅ Published check DISABLED - will show login page directly');
    return; // Exit early - don't check anything

    const checkPublishedMemory = async () => {
      const pendingPost = sessionStorage.getItem('pendingPostView');

      console.log('🔍 checkPublishedMemory effect running:', {
        hasPendingPost: !!pendingPost,
        isAuthenticated,
        isLoading,
        isAlreadyChecking: isCheckingRef.current
      });

      // Check if memory is published when user is not authenticated (regardless of isLoading)
      if (pendingPost && !isAuthenticated) {
        // Prevent multiple simultaneous checks
        if (isCheckingRef.current) {
          console.log('⏸️ Already checking - skipping duplicate check');
          return;
        }

        console.log('🔍 Will check if memory is published...');
        isCheckingRef.current = true;

        // Set checking state to show loading screen
        setIsCheckingPublishedMemory(true);

        // Add timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          console.log('⏰ Timeout - taking too long, showing login page');
          setIsCheckingPublishedMemory(false);
          isCheckingRef.current = false;
        }, 5000); // 5 second timeout

        try {
          const { memory_id, post_id, timestamp } = JSON.parse(pendingPost);

          // Check if stored data is recent (within 5 minutes)
          const isRecent = timestamp && (Date.now() - timestamp < 5 * 60 * 1000);

          console.log('📊 Pending post data:', { memory_id, post_id, isRecent });

          if (isRecent) {
            console.log('🔍 Fetching memory details to check if published:', memory_id);

            // Check if memory is published by fetching memory details
            const response = await dashboardAPI.getMemoryDetails(memory_id);

            console.log('📊 Memory details response:', response);

            const memoryData = response.data?.data?.memory || response.data?.memory || response.data;

            console.log('📊 Extracted memoryData:', memoryData);
            console.log('📊 memoryData.published:', memoryData?.published);

            const isPublished = memoryData?.published === 1 || memoryData?.published === '1';
            const slug = memoryData?.slug || memoryData?.token || memory_id;

            console.log('📊 Memory status:', { isPublished, slug });

            if (isPublished) {
              console.log('✅ Memory is published - redirecting to published page');

              clearTimeout(timeoutId);
              isCheckingRef.current = false;

              // Clear pendingPostView
              sessionStorage.removeItem('pendingPostView');

              // Store the post_id to auto-open modal after redirect
              sessionStorage.setItem('autoOpenPostModal', post_id);

              // Redirect to published memory page (no need to clear loading state - we're redirecting)
              console.log('🔗 Redirecting to /published-memory/' + slug);
              window.location.href = `/published-memory/${slug}`;
            } else {
              console.log('🔒 Memory is NOT published - showing login page');

              clearTimeout(timeoutId);
              isCheckingRef.current = false;
              setIsCheckingPublishedMemory(false);
              setShowSignup(false);
            }
          } else {
            console.log('⏰ Pending post data is stale - clearing');

            clearTimeout(timeoutId);
            isCheckingRef.current = false;
            sessionStorage.removeItem('pendingPostView');
            setIsCheckingPublishedMemory(false);
          }
        } catch (error) {
          console.error('❌ Error checking memory published status:', error);
          console.log('⚠️ Will show login page');

          clearTimeout(timeoutId);
          isCheckingRef.current = false;
          setIsCheckingPublishedMemory(false);
          setShowSignup(false);
        }
      } else {
        // No pending post or user is authenticated - make sure loading state is clear
        isCheckingRef.current = false;
        setIsCheckingPublishedMemory(false);

        if (!pendingPost) {
          console.log('ℹ️ No pendingPostView in storage');
        }
        if (isAuthenticated) {
          console.log('ℹ️ User is authenticated - skipping published check');
        }
      }
    };

    checkPublishedMemory();
  }, [isAuthenticated, isLoading]);

  // Role-based redirect effect - redirect users with role 3 or 4 to memories page (only once after login)
  useEffect(() => {
    console.log('🔴 ROLE REDIRECT EFFECT FIRED:', {
      isAuthenticated,
      hasUser: !!user,
      isLoading,
      hasInitialRedirectHappened,
      currentPage
    });

    // Only run this check once when the user first authenticates
    // Don't run if hasInitialRedirectHappened is already true
    if (isAuthenticated && user && !isLoading && !hasInitialRedirectHappened && currentPage === 'dashboard') {
      // Check if user just completed an invite login - redirect to /stories instead of dashboard
      const urlParams = new URLSearchParams(window.location.search);
      const fromInviteLogin = urlParams.get('from_invite_login') === '1';
      const inviteLoginCompleted = sessionStorage.getItem('invite_login_completed') || localStorage.getItem('invite_login_completed');
      const inviteRedirectFlag = sessionStorage.getItem('invite_redirect_to_stories');

      if (fromInviteLogin || inviteLoginCompleted || inviteRedirectFlag) {
        console.log('🎯 Invite login detected - redirecting to /stories instead of dashboard');
        sessionStorage.removeItem('invite_redirect_to_stories');
        setHasInitialRedirectHappened(true);
        handleNavigation('memories');
        return;
      }

      const userRole = user.role;
      console.log('🔍 Checking user role for initial redirect:', userRole, typeof userRole);

      // Check if user has role 3 or 4 (handle both string and number types)
      const roleValue = typeof userRole === 'string' ? userRole : String(userRole);
      if (roleValue === '3' || roleValue === '4') {
        console.log('🚀 User has role', roleValue, '- redirecting to memories page (one-time)');
        handleNavigation('memories');
        // Mark that initial redirect has happened immediately
        setHasInitialRedirectHappened(true);
      } else {
        console.log('👤 User has role', roleValue, '- staying on dashboard');
        // Also mark as happened so we don't check again
        setHasInitialRedirectHappened(true);
      }
    }
  }, [isAuthenticated, user?.id, isLoading, hasInitialRedirectHappened, currentPage, handleNavigation]);

  // Debug: Log auth state and URL on every render
  console.log('🔴 APP RENDER:', {
    isAuthenticated,
    isLoading,
    url: window.location.href,
    hasMemoryId: new URLSearchParams(window.location.search).has('memory_id'),
    hasPostId: new URLSearchParams(window.location.search).has('post_id'),
  });

  // Restore post view after login - SIMPLIFIED VERSION
  useEffect(() => {
    console.log('🔵 RESTORE EFFECT TRIGGERED:', { isAuthenticated, isLoading });

    // Only run when user just logged in
    if (isAuthenticated && !isLoading) {
      console.log('✅ User is authenticated - checking for post link...');

      // Check current URL for memory_id and post_id parameters
      const urlParams = new URLSearchParams(window.location.search);
      const memoryId = urlParams.get('memory_id');
      const postId = urlParams.get('post_id');

      console.log('📍 Current URL params:', { memoryId, postId, url: window.location.href });

      if (memoryId && postId) {
        console.log('🎯 Found post link params in URL - opening modal!');
        console.log('🎯 Will call handleMemorySelect with:', { memoryId, postId });

        // Mark that this modal was opened from a post link
        sessionStorage.setItem('openedFromPostLink', 'true');

        // Clear URL protection now that we're logged in
        sessionStorage.removeItem('preservePostUrl');
        sessionStorage.removeItem('globalProtectedUrl');
        console.log('🔓 Cleared URL protection - user is authenticated');

        // Clear URL params immediately to prevent re-opening
        window.history.replaceState({}, '', '/stories');
        console.log('🧹 Cleared URL params to prevent re-opening modal');

        // Open the memory with the post modal - increase timeout to ensure page is ready
        setTimeout(() => {
          console.log('🚀 CALLING handleMemorySelect NOW:', { memoryId, postId });
          console.log('🚀 Options:', { openImageModal: true, imageId: postId });
          handleMemorySelect(memoryId, { openImageModal: true, imageId: postId });
          console.log('✅ handleMemorySelect CALLED SUCCESSFULLY');

          // Verify state was set
          setTimeout(() => {
            console.log('🔍 Verifying navigation state after 500ms...');
          }, 500);
        }, 1000); // Increased to 1 second
      } else if (memoryId && !postId) {
        // INVITE FLOW: Just memory_id without post_id (from invite link after login)
        console.log('🎯 Found invite memory_id in URL - navigating to memory!');
        console.log('🎯 Memory ID:', memoryId);

        // Clear URL params to prevent re-navigation
        window.history.replaceState({}, '', '/stories');
        console.log('🧹 Cleared URL params');

        // Navigate to the invited memory
        setTimeout(() => {
          console.log('🚀 CALLING handleMemorySelect for invite:', memoryId);
          handleMemorySelect(memoryId);
          console.log('✅ handleMemorySelect CALLED for invite');
        }, 500);
      } else {
        console.log('❌ No memory_id in URL, checking sessionStorage...');
        // Also check sessionStorage as fallback
        const pendingPost = sessionStorage.getItem('pendingPostView');
        console.log('📦 pendingPostView from storage:', pendingPost);

        if (pendingPost) {
          try {
            const { memory_id, post_id, timestamp } = JSON.parse(pendingPost);
            const isRecent = timestamp && (Date.now() - timestamp < 5 * 60 * 1000);

            if (isRecent) {
              console.log('📦 Found post link in sessionStorage - opening modal!');
              sessionStorage.removeItem('pendingPostView');
              sessionStorage.setItem('openedFromPostLink', 'true');

              setTimeout(() => {
                console.log('🚀 CALLING handleMemorySelect from storage:', { memory_id, post_id });
                handleMemorySelect(memory_id, { openImageModal: true, imageId: post_id });
                console.log('✅ handleMemorySelect CALLED');
              }, 300);
            } else {
              console.log('⏰ Data in sessionStorage is too old');
              sessionStorage.removeItem('pendingPostView');
            }
          } catch (error) {
            console.error('❌ Error parsing pendingPostView:', error);
            sessionStorage.removeItem('pendingPostView');
          }
        } else {
          console.log('ℹ️ No pendingPostView in sessionStorage either');
        }
      }
    } else {
      console.log('⏸️ Skipping - not authenticated or still loading');
    }
  }, [isAuthenticated, isLoading, handleMemorySelect]);

  // AI Processing notification effect - show toast when AI analysis is completed
  const hasShownToastRef = useRef<string | null>(null);

  useEffect(() => {
    if (aiProcessing?.status === 'completed' && aiProcessing.memoryId) {
      // Prevent showing multiple toasts for the same completion
      const completionKey = `${aiProcessing.memoryId}-${aiProcessing.startTime}`;

      if (hasShownToastRef.current === completionKey) {
        console.log('🚫 Toast already shown for this completion, skipping');
        return;
      }

      console.log('🎉 AI Processing completed, showing notification');
      hasShownToastRef.current = completionKey;

      // Show notification - user can click "Show Results" from sidebar
      const completionTitle = aiProcessing.title ?? 'AI Campaign Wizard';
      toast.success(`${completionTitle} analysis is ready!`, {
        duration: 5000,
        dismissible: true,
        closeButton: true
      });

      // DON'T auto-clear the processing state
      // Keep it in sidebar until user clicks "Show Results"
      // The sidebar will handle clearing it
    } else if (aiProcessing?.status === 'failed') {
      toast.error('AI analysis failed. Please try again.', {
        duration: 5000
      });
      setAiProcessing(null);
      hasShownToastRef.current = null;
    }
  }, [aiProcessing?.status, aiProcessing?.memoryId, aiProcessing?.startTime, handleMemorySelect]);

  // Check for password change requirement after login
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      // Check sessionStorage flag (set during login)
      const requirePasswordChange = sessionStorage.getItem('require_password_change');

      // Also check the actual user object's change_password field
      const storedUser = localStorage.getItem('stasht_user');
      let userNeedsPasswordChange = false;

      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          userNeedsPasswordChange = user.change_password === 1;
          console.log('🔑 User change_password flag:', user.change_password);
        } catch (e) {
          console.error('Failed to parse user object:', e);
        }
      }

      if (requirePasswordChange === 'true' || userNeedsPasswordChange) {
        console.log('🔑 Password change required, redirecting to profile settings');
        handleNavigation('profile-settings');
        // Remove the sessionStorage flag so it doesn't redirect again
        sessionStorage.removeItem('require_password_change');
        // Note: The change_password flag in user object will be cleared after successful password change
      }
    }
  }, [isAuthenticated, isLoading, handleNavigation]);

  // Block navigation away from profile-settings if user needs to change password
  useEffect(() => {
    if (isAuthenticated && !isLoading && currentPage !== 'profile-settings') {
      // Check if user needs to change password
      const storedUser = localStorage.getItem('stasht_user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          if (user.change_password === 1) {
            console.log('🚫 Navigation blocked - user must change password first');
            console.log('🚫 Attempted to navigate to:', currentPage, '- forcing back to profile-settings');
            handleNavigation('profile-settings');
          }
        } catch (e) {
          console.error('Failed to parse user object:', e);
        }
      }
    }
  }, [currentPage, isAuthenticated, isLoading, handleNavigation]);

  // Handle invite flow after login
  useEffect(() => {
    if (isAuthenticated && !isLoading && isInviteFlow) {
      console.log('🔗 User logged in during invite flow, checking collaborator...');
      handleLoginComplete();
    }
  }, [isAuthenticated, isLoading, isInviteFlow, handleLoginComplete]);

  const [expandedMediaCategories, setExpandedMediaCategories] = useState<string[]>(['Unassigned']); // Will be updated with API categories
  const [selectedMediaCategory, setSelectedMediaCategory] = useState<string | null>(null); // Selected category for filtering
  const [showUnassignedImages, setShowUnassignedImages] = useState(true);
  const [selectedMediaItems, setSelectedMediaItems] = useState<string[]>([]);
  const [expandedMemoryCategories, setExpandedMemoryCategories] = useState<string[]>([]); // Expanded categories in memories page sidebar
  const [showMemoriesMobileSidebar, setShowMemoriesMobileSidebar] = useState(false);
  const [showMediaMobileSidebar, setShowMediaMobileSidebar] = useState(false);

  // Service tabs state for MediaNav sidebar - Initialize from sessionStorage
  const [activeServiceTab, setActiveServiceTab] = useState<string>(() => {
    const savedTab = sessionStorage.getItem('activeServiceTab');
    console.log('🔄 Initializing activeServiceTab from sessionStorage:', savedTab || 'all');
    return savedTab || 'all';
  });
  const [serviceSyncedMedia, setServiceSyncedMedia] = useState<{[key: string]: any[]}>({});
  const [connectedServices, setConnectedServices] = useState<any[]>([]);

  // Sync activeServiceTab to sessionStorage whenever it changes
  useEffect(() => {
    if (activeServiceTab) {
      sessionStorage.setItem('activeServiceTab', activeServiceTab);
      console.log('💾 Saved activeServiceTab to sessionStorage:', activeServiceTab);
    }
  }, [activeServiceTab]);

  // Dropbox sync progress states
  const [dropboxSyncProgress, setDropboxSyncProgress] = useState<number>(0);
  const [showDropboxProgress, setShowDropboxProgress] = useState<boolean>(false);
  const [dropboxServiceIdAfterSync, setDropboxServiceIdAfterSync] = useState<string>('');
  const [dropboxSyncedItemCount, setDropboxSyncedItemCount] = useState<number>(0);
  const [refreshConnectedServices, setRefreshConnectedServices] = useState<(() => Promise<void>) | null>(null);


  // Image viewer ref to share handleViewImage function between MediaPage and MediaNav
  const imageViewerRef = useRef<((src: string, alt: string, title?: string, subtitle?: string, imageId?: string) => void) | null>(null);

  // API memories data state
  const [apiMemoriesData, setApiMemoriesData] = useState<any>(null);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [hasApiData, setHasApiData] = useState(false);
  // Tracks the latest fetch request — stale responses with an older ID are discarded
  const memoriesFetchIdRef = useRef(0);
  // Always holds the current viewType — used in effects with stale closures
  const viewTypeRef = useRef(viewType);
  
  // API media data state
  const [apiMediaData, setApiMediaData] = useState<any>(null);
  const [isLoadingMediaData, setIsLoadingMediaData] = useState(false);
  const [apiMediaNavData, setApiMediaNavData] = useState<any[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<any[]>([]);
  const [highlightedImageId, setHighlightedImageId] = useState<string | null>(null);



  // Standalone unassigned images (not part of any memory) - start empty, load from API
  const [unassignedImages, setUnassignedImages] = useState<MediaImage[]>([]);

  // Shared media data for both MediaNav and MediaPage - start empty, load from API
  const [mediaMemories, setMediaMemories] = useState<MediaMemory[]>([]);
  
  // Debug mediaMemories whenever it changes
  
  // Check for activation token in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    // Also check for activation token in URL path (e.g., /activate-account/{token})
    const pathMatch = window.location.pathname.match(/\/activate-account\/([^\/]+)/);
    const pathToken = pathMatch ? pathMatch[1] : null;
    
    const activationTokenFromUrl = token || pathToken;
    
    if (activationTokenFromUrl) {
      console.log('Activation token found in URL:', activationTokenFromUrl);
      setActivationToken(activationTokenFromUrl);
      // Clean the URL without reloading the page
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  
  useEffect(() => {
    console.log('🚨 MEDIA MEMORIES STATE CHANGED:', {
      count: mediaMemories.length,
      memories: mediaMemories,
      timestamp: new Date().toISOString()
    });
    
    if (mediaMemories.length > 0) {
      console.log('✅ mediaMemories is populated with', mediaMemories.length, 'memories');
      console.log('First memory:', mediaMemories[0]);
    } else {
      console.log('⚠️ mediaMemories is EMPTY');
    }
  }, [mediaMemories]);

  // Debug current page
  console.log('🟩 App render - currentPage:', currentPage, 'selectedMemoryId:', selectedMemoryId);

  // Function to reset all user-specific state
  const resetApplicationState = useCallback(() => {
    console.log('🔄 Resetting application state for user change...');
    
    // Reset all user-specific data
    setApiMemoriesData(null);
    setApiMediaData(null);
    setApiMediaNavData([]);
    setMediaMemories([]);
    setUnassignedImages([]);
    setSelectedMediaItems([]);
    setSelectedMediaCategory(null);
    setSelectedMemoryCategory(null);
    setExpandedMediaCategories(['Unassigned']);
    setExpandedMemoryCategories([]);
    setNotificationCount(0);
    setHighlightedImageId(null);
    setUploadProgress([]);
    setIsUploadingMedia(false);
    setIsLoadingMemories(false);
    setIsLoadingMediaData(false);
    setHasApiData(false);
    setHasLoadedMemoriesPage(false); // Reset memories page load tracking

    // Reset categories and labels to default
    setCategories(categoriesData);
    setLabels(labelsData);
    
    // Reset navigation state
    handleNavigation('dashboard');

    // Reset initial redirect flag for next login
    setHasInitialRedirectHappened(false);

    console.log('✅ Application state reset completed');
  }, [handleNavigation]);

  // Update category and label counts when mediaMemories changes
  useEffect(() => {
    // Partial admin categories are set directly from their assigned memories — skip this
    if (isPartialAdmin()) return;

    const updatedCategories = categories.map(category => {
      const memoryCount = mediaMemories.filter(memory => memory.category === category.name).length;
      return { ...category, count: memoryCount }; // Preserve existing properties like color
    });
    setCategories(updatedCategories);

    const updatedLabels = labels.map(label => {
      const memoryCount = mediaMemories.filter(memory =>
        memory.labels && memory.labels.includes(label.name)
      ).length;
      return { ...label, count: memoryCount };
    });
    setLabels(updatedLabels);
  }, [mediaMemories]);

  // Debug sub-sidebar state
  console.log('📱 App.tsx - isSubSidebarExpanded:', isSubSidebarExpanded, 'shouldShowSubSidebar:', shouldShowSubSidebar, 'currentPage:', currentPage);

  const clearNotifications = () => {
    setNotificationCount(0);
  };

  const toggleSidebar = () => {
    console.log('toggleSidebar called! Current state:', isSidebarMinimized);
    setIsSidebarMinimized(prev => {
      console.log('Setting sidebar minimized from', prev, 'to', !prev);
      return !prev;
    });
  };


  const handleTimePeriodChange = (period: string) => {
    setTimePeriod(period);
  };

  const handleCategoriesChange = (newCategories: Category[]) => {
    // Update counts based on actual memories and maintain proper order
    const updatedCategories = newCategories.map(category => {
      const memoryCount = mediaMemories.filter(memory => memory.category === category.name).length;
      return { ...category, count: memoryCount }; // Preserve color and other properties
    });
    
    // Ensure proper category order: Personal first, then user-created, then system categories
    const orderedCategories = updatedCategories.sort((a, b) => {
      // Personal always first
      if (a.name === 'Personal') return -1;
      if (b.name === 'Personal') return 1;
      
      // User-created categories come after Personal but before system categories
      if (a.isUserCreated && !b.isUserCreated) return -1;
      if (!a.isUserCreated && b.isUserCreated) return 1;
      
      // Within user-created categories, maintain current order (no additional sorting)
      if (a.isUserCreated && b.isUserCreated) {
        const aIndex = newCategories.findIndex(cat => cat.name === a.name);
        const bIndex = newCategories.findIndex(cat => cat.name === b.name);
        return aIndex - bIndex;
      }
      
      // System categories maintain their original order
      const systemOrder = ['Shared With', 'Published'];
      const aSystemIndex = systemOrder.indexOf(a.name);
      const bSystemIndex = systemOrder.indexOf(b.name);
      
      if (aSystemIndex !== -1 && bSystemIndex !== -1) {
        return aSystemIndex - bSystemIndex;
      }
      
      return 0;
    });
    
    // Initialize colors for new categories
    initializeCategoryColors(orderedCategories.map(cat => ({ 
      name: cat.name, 
      color: cat.color 
    })));
    
    setCategories(orderedCategories);
  };

  const handleLabelsChange = (newLabels: Label[]) => {
    setLabels(newLabels);
  };

  const handleMediaFilterChange = (expandedCategories: string[]) => {
    setExpandedMediaCategories(expandedCategories);
  };

  const handleMediaCategorySelect = (categoryName: string | null) => {
    setSelectedMediaCategory(categoryName);
  };

  const handleMediaMemoriesChange = (updatedMemories: MediaMemory[]) => {
    setMediaMemories(updatedMemories);
  };

  const handleUnassignedImagesChange = (updatedImages: MediaImage[]) => {
    setUnassignedImages(updatedImages);
  };

  const handleUnassignedToggle = (show: boolean) => {
    setShowUnassignedImages(show);
  };

  const handleMediaItemSelect = (itemId: string, selected: boolean) => {
    setSelectedMediaItems(prev => 
      selected 
        ? [...prev, itemId]
        : prev.filter(id => id !== itemId)
    );
  };

  const handleClearMediaSelection = () => {
    setSelectedMediaItems([]);
  };

  const handleDropboxProgressChange = (progress: number, show: boolean, serviceId: string, itemCount?: number) => {
    console.log('🟦🟦🟦 App.tsx handleDropboxProgressChange CALLED! 🟦🟦🟦');
    console.log('🟦 Progress:', progress);
    console.log('🟦 Show:', show);
    console.log('🟦 ServiceId:', serviceId);
    console.log('🟦 ItemCount:', itemCount);
    console.log('🟦 Current activeServiceTab:', activeServiceTab);

    // Store the service ID for "View Result" button
    console.log('🟦 Setting dropboxServiceIdAfterSync =', serviceId);
    setDropboxServiceIdAfterSync(serviceId);

    // Store item count for completion message
    if (itemCount !== undefined) {
      setDropboxSyncedItemCount(itemCount);
    }

    // When progress bar first appears (show=true and progress is low), switch to "Media" tab FIRST
    if (show && progress <= 10 && activeServiceTab !== 'all') {
      console.log('🔄🔄🔄 SWITCHING FROM DROPBOX TAB TO MEDIA TAB! 🔄🔄🔄');
      console.log('🔄 Current tab:', activeServiceTab);
      console.log('🔄 Switching to: all');
      setActiveServiceTab('all');
    } else {
      console.log('🔄 NOT switching tabs. Conditions:', {
        show,
        progressLessThanOrEqual10: progress <= 10,
        notOnMediaTab: activeServiceTab !== 'all'
      });
    }

    // Update progress state AFTER tab switch to ensure smooth transition
    console.log('🟦 Setting dropboxSyncProgress =', progress);
    setDropboxSyncProgress(progress);

    console.log('🟦 Setting showDropboxProgress =', show);
    setShowDropboxProgress(show);
  };

  const handleViewDropboxResult = async () => {
    console.log('🎯 handleViewDropboxResult called - switching to Dropbox tab:', dropboxServiceIdAfterSync);

    if (dropboxServiceIdAfterSync) {
      // Navigate to Media page first if not already there
      if (currentPage !== 'media') {
        console.log('🎯 Step 0: Navigating to Media page first');
        handleNavigation('media');
        // Wait for navigation to complete
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Refresh connected services to update last_sync time in Dropbox tab header
      console.log('🎯 Step 1: Refreshing connected services to update last_sync time');
      try {
        if (refreshConnectedServices) {
          await refreshConnectedServices();
          console.log('✅ Connected services refreshed via MediaPage - last_sync time updated');
        } else {
          // Fallback: call API directly
          const response = await dashboardAPI.getConnectedServices();
          if (response.success && Array.isArray(response.data)) {
            setConnectedServices(response.data);
            console.log('✅ Connected services refreshed via direct API - last_sync time updated');
          }
        }
      } catch (error) {
        console.error('⚠️ Failed to refresh connected services:', error);
        // Continue anyway - not critical
      }

      // Switch to Dropbox tab FIRST
      console.log('🎯 Step 2: Switching to Dropbox tab:', dropboxServiceIdAfterSync);
      setActiveServiceTab(dropboxServiceIdAfterSync);

      // Wait for tab to switch and data to load
      console.log('🎯 Step 3: Waiting for media data to load...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if we have the media data
      console.log('🎯 Step 4: Checking if Dropbox media data is available...');
      console.log('🎯 serviceSyncedMedia keys:', Object.keys(serviceSyncedMedia));
      console.log('🎯 Dropbox data available?', serviceSyncedMedia[dropboxServiceIdAfterSync] ? 'YES' : 'NO');

      if (serviceSyncedMedia[dropboxServiceIdAfterSync]) {
        console.log('✅ Dropbox media data found:', serviceSyncedMedia[dropboxServiceIdAfterSync].length, 'items');
      } else {
        console.log('⚠️ Dropbox media data not yet available');
      }

      // Hide progress bar AFTER everything is loaded and visible
      console.log('🎯 Step 5: Hiding progress bar');
      setShowDropboxProgress(false);
      setDropboxSyncProgress(0);
      setDropboxSyncedItemCount(0);
    }
  };

  const handleMemoryCategorySelect = (categoryName: string | null) => {
    try {
      // If clicking the same category, close it (set to null)
      if (categoryName === selectedMemoryCategory) {
        setSelectedMemoryCategory(null);
        // Remove from expanded categories when deselecting
        if (categoryName && expandedMemoryCategories) {
          setExpandedMemoryCategories(prev => (prev || []).filter(cat => cat !== categoryName));
        }
      } else {
        setSelectedMemoryCategory(categoryName);
        // Auto-expand the selected category
        if (categoryName && expandedMemoryCategories && !expandedMemoryCategories.includes(categoryName)) {
          setExpandedMemoryCategories(prev => [...(prev || []), categoryName]);
        }
      }
    } catch (error) {
      console.error('Error in handleMemoryCategorySelect:', error);
    }
  };

  const handleExpandedMemoryCategoriesChange = (expandedCategories: string[]) => {
    setExpandedMemoryCategories(expandedCategories);
  };

  const handleCreateMemoryRequest = (categoryName?: string) => {
    console.log('🎯 Create memory requested for category:', categoryName);
    setCreateMemoryTrigger({ category: categoryName, timestamp: Date.now() });
  };

  const handleClearCreateMemoryTrigger = () => {
    console.log('🧹 Clearing create memory trigger');
    setCreateMemoryTrigger(null);
  };

  const handleBottomNavCameraCapture = async (files: File[]) => {
    if (files.length === 0) return;
    setShowBottomNavCamera(false);

    const uploadToastId = toast.loading(`Uploading ${files.length > 1 ? `${files.length} photos` : 'photo'}...`);

    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
      try {
        const fileName = file.name.replace(/\.[^/.]+$/, '');
        const exif = await exifr.parse(file, ['Orientation']).catch(() => null);
        const orientation = exif?.Orientation ?? 1;

        // Step 1: Upload with metadata extraction
        const metaResponse = await dashboardAPI.uploadImageWithMetadata(file, fileName, orientation);
        const metaData = metaResponse.success ? (metaResponse.data?.data || metaResponse.data) : null;

        const location = metaData?.location || '';
        const captureDate = metaData?.capture_date || '';

        // Step 2: Save to media library via /memory-images/upload
        const uploadResponse = await dashboardAPI.uploadPhotosFromMediaWithOutMemory(file, fileName, location, captureDate);

        if (uploadResponse.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    toast.dismiss(uploadToastId);

    if (successCount > 0) {
      toast.success(successCount > 1 ? `${successCount} photos saved to Media Library` : 'Photo saved to Media Library');
      handleNavigationWithReset('media');
    }
    if (failCount > 0) {
      toast.error(`${failCount} photo${failCount > 1 ? 's' : ''} failed to upload. Please try again.`);
    }
  };

  // Clear create memory trigger when navigating away from memories page
  useEffect(() => {
    if (currentPage !== 'memories' && createMemoryTrigger) {
      console.log('🧹 Clearing create memory trigger on page navigation');
      setCreateMemoryTrigger(null);
    }
  }, [currentPage, createMemoryTrigger]);

  // Signup handlers
  const handleSignup = async (name: string, email: string, password: string, phone_number?: string): Promise<{success: boolean, message?: string, errors?: any, collaborators?: any[]}> => {
    const result = await register(name, email, password, phone_number);
    if (result.success && !result.message) {
      // Legacy flow - direct login successful

      // Check if this was an invite signup (login=0 flow)
      const urlParams = new URLSearchParams(window.location.search);
      const isInviteSignup = urlParams.get('invite') === '1' && urlParams.get('login') === '0';
      const inviteMemoryId = urlParams.get('memory_id');
      const inviteCollaborator = urlParams.get('collaborator');

      if (isInviteSignup && inviteMemoryId) {
        // Mirror the same flow as LoginPage does for login=1 invites
        console.log('🎉 [handleSignup] Invite signup completed, redirecting to memory:', inviteMemoryId);

        const protectionData = {
          completed: true,
          timestamp: Date.now(),
          userIdentifier: inviteCollaborator || email,
          collaborator: inviteCollaborator,
          memoryId: inviteMemoryId,
        };

        localStorage.setItem('invite_login_completed', JSON.stringify(protectionData));
        localStorage.setItem('SKIP_ALL_MISMATCH_CHECKS', 'true');

        window.location.replace('/stories?from_invite_login=1');
        return result;
      }

      setShowSignup(false); // Hide signup page on success
    }
    // For activation flow, we keep the signup page visible to show the message
    // Pass through collaborators for admin login choice feature
    return result;
  };

  const handleSwitchToSignup = () => {
    setShowSignup(true);
  };

  const handleSwitchToLogin = () => {
    setShowSignup(false);
  };

  const handleShowProfileSettings = () => {
    handleNavigation('profile-settings');
  };

  const handleShowBillingPayment = () => {
    handleNavigation('billing');
  };

  const handleUploadMedia = (files: File[]) => {
    console.log('🎯 Upload Media - Files received:', files.length);
    // Store the files
    setPendingUploadFiles(files);
    // Navigate to media page
    handleNavigation('media');
  };

  // Login handler
  const handleLogin = async (email: string, password: string, phone_number?: string): Promise<boolean> => {
    try {
      const success = await login(email, password, phone_number);
      return success;
    } catch (error) {
      // Re-throw the error so LoginPage can handle it (e.g., activation errors)
      throw error;
    }
  };

  // Social login handler
  const handleSocialLogin = async (
    provider: 'google' | 'apple',
    providerId: string,
    email?: string,
    name?: string,
    accessToken?: string
  ): Promise<boolean> => {
    try {
      console.log('App: Social login initiated', { provider, providerId, email, name });

      // The actual API call is already done in LoginPage, so we just need to trigger
      // the auth context refresh. The token and user data are already stored.

      // Reload the page to trigger authentication check
      window.location.reload();
      return true;
    } catch (error) {
      console.error('App: Social login error:', error);
      return false;
    }
  };

  // Activation completion handler
  const handleActivationComplete = (redirectUrl?: string) => {
    console.log('Account activation completed, redirect URL:', redirectUrl);
    setActivationToken(null); // Clear activation state
    
    if (redirectUrl) {
      // Handle frontend route navigation
      if (redirectUrl === '/dashboard') {
        handleNavigation('dashboard');
      } else if (redirectUrl === '/stories') {
        handleNavigation('memories');
      } else if (redirectUrl === '/media') {
        handleNavigation('media');
      } else if (redirectUrl === '/profile') {
        handleNavigation('profile');
      } else if (redirectUrl === '/login') {
        // Just clear activation token, will show login page by default
        console.log('Redirecting to login page');
        return; // Exit early, login page will show
      } else {
        // Default to dashboard for any other route
        handleNavigation('dashboard');
      }
    } else {
      // Default: go to dashboard
      handleNavigation('dashboard');
    }
  };

  // Function to fetch media data from API
  const fetchMediaData = useCallback(async (params?: {
    search?: string;
    sort_by?: 'name' | 'location' | 'date' | 'memory' | 'size' | 'upload_latest' | 'upload_oldest';
    order?: 'asc' | 'desc';
  }) => {
    console.log('🚨🚨🚨 fetchMediaData CALLED at:', new Date().toISOString());
    try {
      setIsLoadingMediaData(true);
      console.log('=== MEDIA API CALL (App Level) ===');
      console.log('API URL: /memory-images');
      
      let response;
      if (isPartialAdmin()) {
        const [rawResponse, memoriesResponse] = await Promise.all([
          dashboardAPI.getPartialAdminMedia(getPartialAdminEmail()),
          dashboardAPI.getPartialAdminMemories(getPartialAdminEmail()),
        ]);

        if (rawResponse.success && rawResponse.data) {
          const items: any[] = rawResponse.data.data || rawResponse.data || [];

          // Build memory_id → category_name map from memories data
          const memoryCategories = new Map<number, string>();
          const memoriesArr: any[] = memoriesResponse.success
            ? (memoriesResponse.data?.data || memoriesResponse.data || [])
            : [];
          memoriesArr.forEach((mem: any) => {
            if (mem.id && mem.category?.name) {
              memoryCategories.set(mem.id, mem.category.name);
            }
          });

          // Group media by category name (falling back to memory_title if no category found)
          const categories_media: Record<string, any[]> = {};
          const seenMemories = new Set<number>();

          items.forEach((item: any) => {
            const catName = memoryCategories.get(item.memory_id) || item.memory_title || 'Uncategorized';
            if (!categories_media[catName]) categories_media[catName] = [];

            // Prepend memory metadata header once per memory (no media_id so transformer detects it)
            if (!seenMemories.has(item.memory_id)) {
              seenMemories.add(item.memory_id);
              categories_media[catName].push({
                memory_id: item.memory_id,
                memory_title: item.memory_title,
                memory_image: null,
                memory_size: null,
              });
            }

            // Add the media item with all original fields intact
            categories_media[catName].push(item);
          });

          response = { success: true, data: { categories_media, unassigned_media: [] } };
        } else {
          response = rawResponse;
        }
      } else {
        response = await mediaAPI.getMemoryImages(params);
      }
      console.log('Raw Media API Response:', response);

      if (response && response.success && response.data) {
        console.log('🚀 Media API Response:', response.data);

        setApiMediaData(response.data);
        
        // Transform API structure for MediaNav sidebar
        const transformedNavData = mediaTransformers.transformForMediaNav(response.data);
        console.log('🔄 Transformed MediaNav Data from API:', transformedNavData);
        
        setApiMediaNavData(transformedNavData);
        
        // Auto-expand all categories
        const categoryNames = transformedNavData.map((cat: any) => cat.name).filter((name: string) => name);
        setExpandedMediaCategories(categoryNames);
        console.log('🔄 Auto-expanded categories from API:', categoryNames);
        
        // Handle unassigned media
        if (response.data.all_media && Array.isArray(response.data.all_media)) {
          // Flat array format — unassigned items are those without memory_id
          const unassignedFromFlat = response.data.all_media.filter((item: any) => !item.memory_id);
          if (unassignedFromFlat.length > 0) {
            const transformedUnassigned = mediaTransformers.transformUnassignedMedia(unassignedFromFlat);
            setUnassignedImages(transformedUnassigned);
          } else {
            setUnassignedImages([]);
          }
        } else if (response.data.unassigned_media && response.data.unassigned_media.length > 0) {
          const transformedUnassigned = mediaTransformers.transformUnassignedMedia(response.data.unassigned_media);
          console.log('🔄 Setting Transformed Unassigned Media:', transformedUnassigned);
          setUnassignedImages(transformedUnassigned);
        } else {
          console.log('⚠️ No unassigned media found in API response - clearing unassigned images');
          setUnassignedImages([]);
        }
        
      } else {
        console.log('Media API call failed - Response:', response);
        
        // Don't overwrite memories if they already exist from /memories API
        if (mediaMemories.length === 0) {
          console.log('🚨 Media API failed and no existing memories, keeping empty array');
          setMediaMemories([]);
        } else {
          console.log('🚨 Media API failed but keeping existing memories:', mediaMemories.length);
        }
      }
    } catch (error) {
      console.error('Error fetching media data:', error);
      // Don't overwrite memories if they already exist from /memories API
      if (mediaMemories.length === 0) {
        console.log('🚨 Media API error and no existing memories, keeping empty array');
        setMediaMemories([]);
      } else {
        console.log('🚨 Media API error but keeping existing memories:', mediaMemories.length);
      }
    } finally {
      setIsLoadingMediaData(false);
      console.log('=== END MEDIA API CALL (App Level) ===');
    }
  }, []); // Empty dependency array since this function doesn't depend on any state/props

  // Stable callback for updating media sidebar after changes
  const handleMediaSidebarUpdate = useCallback(async () => {
    console.log('🔄🔄🔄 handleMediaSidebarUpdate CALLED - Refreshing sidebar data');
    try {
      // Fetch fresh media data which updates apiMediaNavData
      await fetchMediaData();
      console.log('✅ fetchMediaData completed');

      // Fetch all categories including empty ones
      await fetchAllCategoriesForMedia();
      console.log('✅ fetchAllCategoriesForMedia completed');

      // Fetch memories data
      await fetchMemoriesData();
      console.log('✅ fetchMemoriesData completed');

      console.log('✅✅✅ All sidebar updates completed');
    } catch (error) {
      console.error('❌ Error in handleMediaSidebarUpdate:', error);
    }
  }, [fetchMediaData]); // Only depends on fetchMediaData which is stable

  // Extract all memories from apiMediaNavData for Add to Memory dialog
  const extractMemoriesFromNavData = () => {
    console.log('📌 Extracting memories from apiMediaNavData...');
    
    if (!apiMediaNavData || apiMediaNavData.length === 0) {
      console.log('⚠️ No apiMediaNavData available');
      return;
    }
    
    console.log('📌 apiMediaNavData has', apiMediaNavData.length, 'categories');
    
    // Extract all memories from all categories
    const allMemories = [];
    
    apiMediaNavData.forEach((category) => {
      console.log(`📌 Processing category: ${category.name}, memories count: ${category.memories?.length || 0}`);
      
      if (category.memories && Array.isArray(category.memories)) {
        category.memories.forEach((memory) => {
          // Transform to MediaMemory format
          allMemories.push({
            id: memory.id?.toString() || Date.now().toString(),
            title: memory.title || 'Untitled Memory',
            category: memory.category || category.name || 'Personal',
            thumbnail: memory.thumbnail || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop',
            imageCount: memory.imageCount || 0,
            date: memory.date || new Date().toISOString(),
            type: memory.type || 'personal',
            author: memory.author || 'User',
            isExpanded: false,
            images: memory.images || []
          });
        });
      }
    });
    
    console.log('📌 Total memories extracted from apiMediaNavData:', allMemories.length);
    console.log('📌 Setting mediaMemories with extracted data:', allMemories);
    setMediaMemories(allMemories);
  };
  
  // Effect to extract memories when apiMediaNavData changes
  useEffect(() => {
    if (apiMediaNavData && apiMediaNavData.length > 0) {
      console.log('📌 apiMediaNavData updated, extracting memories...');
      extractMemoriesFromNavData();
    }
  }, [apiMediaNavData]);

  // Function to fetch existing memories for Add to Memory dialog
  const fetchExistingMemories = async () => {
    try {
      console.log('📌📌📌 fetchExistingMemories STARTED at:', new Date().toISOString());
      const response = await dashboardAPI.getExistingMemories();
      
      console.log('📌📌📌 FULL /existing-memory response:', response);
      console.log('📌📌📌 response.success:', response?.success);
      console.log('📌📌📌 response.data exists:', !!response?.data);
      
      if (response.success && response.data) {
        console.log('📌📌📌 response.data structure:', response.data);
        console.log('📌📌📌 response.data keys:', Object.keys(response.data));
        
        // Try different possible locations for memories
        const memoriesData = response.data.memories || 
                            response.data.data?.memories || 
                            response.data.data || 
                            response.data;
                            
        console.log('📌📌📌 Extracted memoriesData:', memoriesData);
        console.log('📌📌📌 Is memoriesData an array?', Array.isArray(memoriesData));
        
        if (Array.isArray(memoriesData)) {
          console.log('📌📌📌 Found', memoriesData.length, 'existing memories');
          
          if (memoriesData.length > 0) {
            console.log('📌📌📌 First memory structure:', memoriesData[0]);
          }
          
          // Transform memories to our MediaMemory format
          const transformedMemories = memoriesData.map((mem: any) => ({
            id: mem.id?.toString() || Date.now().toString(),
            title: mem.title || 'Untitled Memory',
            category: mem.category?.name || mem.property_category?.name || mem.category || 'Personal',
            thumbnail: mem.last_update_img ||
                      mem.photos?.preview_images?.[0]?.url ||
                      mem.posts?.[0]?.image_link ||
                      mem.thumbnail ||
                      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop',
            imageCount: mem.posts_count || mem.posts?.length || mem.photos?.count || mem.photos_count || mem.media_count || 0,
            date: mem.created_at || mem.date || new Date().toISOString(),
            type: (mem.visibility === 'public' || mem.type === 'shared') ? 'shared' as const : 'personal' as const,
            author: mem.user?.name || mem.author?.name || mem.user_name || 'User',
            isExpanded: false,
            images: []
          }));
          
          console.log('📌📌📌 Setting mediaMemories with existing memories:', transformedMemories);
          setMediaMemories(transformedMemories);
          console.log('📌📌📌 DONE - mediaMemories should now have', transformedMemories.length, 'memories');
        } else {
          console.log('⚠️⚠️⚠️ memoriesData is NOT an array!');
          console.log('⚠️⚠️⚠️ Type of memoriesData:', typeof memoriesData);
          console.log('⚠️⚠️⚠️ memoriesData value:', memoriesData);
          
          // Try to handle if it's an object with memories inside
          if (memoriesData && typeof memoriesData === 'object') {
            console.log('⚠️⚠️⚠️ Checking if memoriesData is an object with memories field...');
            const possibleFields = ['memories', 'data', 'items', 'results'];
            for (const field of possibleFields) {
              if (memoriesData[field] && Array.isArray(memoriesData[field])) {
                console.log(`📌📌📌 Found memories in field "${field}"!`);
                const memories = memoriesData[field];
                const transformedMemories = memories.map((mem: any) => ({
                  id: mem.id?.toString() || Date.now().toString(),
                  title: mem.title || 'Untitled Memory',
                  category: mem.category?.name || mem.property_category?.name || mem.category || 'Personal',
                  thumbnail: mem.last_update_img ||
                            mem.photos?.preview_images?.[0]?.url ||
                            mem.posts?.[0]?.image_link ||
                            mem.thumbnail ||
                            'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop',
                  imageCount: mem.posts_count || mem.posts?.length || mem.photos?.count || mem.photos_count || mem.media_count || 0,
                  date: mem.created_at || mem.date || new Date().toISOString(),
                  type: (mem.visibility === 'public' || mem.type === 'shared') ? 'shared' as const : 'personal' as const,
                  author: mem.user?.name || mem.author?.name || mem.user_name || 'User',
                  isExpanded: false,
                  images: []
                }));
                console.log('📌📌📌 Setting mediaMemories from object field:', transformedMemories);
                setMediaMemories(transformedMemories);
                return;
              }
            }
          }
        }
      } else {
        console.log('⚠️⚠️⚠️ API call failed or no data!');
        console.log('⚠️⚠️⚠️ Response:', response);
      }
    } catch (error) {
      console.error('❌❌❌ Error fetching existing memories:', error);
      console.error('❌❌❌ Error details:', error);
    }
  };

  // Function to fetch ALL categories (including empty ones) for media page
  const fetchAllCategoriesForMedia = async () => {
    // Partial admin only sees their assigned categories — skip the full owner categories fetch
    if (isPartialAdmin()) return;

    console.log('🎯 fetchAllCategoriesForMedia FUNCTION ENTRY');
    try {
      console.log('🎯 Calling /memories/categories-labels to get ALL categories...');
      const response = await dashboardAPI.getCategoriesLabels();
      console.log('🎯 Categories-labels API response:', response);
      
      if (response.success && response.data?.data) {
        // Get categories from categories-labels endpoint
        if (response.data.data.categories?.items) {
          const allApiCategories = response.data.data.categories.items
            .map((cat: any) => ({
              id: cat.id?.toString(),
              name: cat.name,
              count: cat.memory_count || 0,
              isUserCreated: cat.admin_id !== null,
              admin_id: cat.admin_id,
              color: cat.color,
              suggested: cat.suggested || false
            }));
          setCategories(allApiCategories);
          console.log('🎯 Updated Categories (showing ALL categories including 0-count):', allApiCategories);
        }
      } else {
        console.log('🎯 Failed to fetch all categories:', response.error);
      }
    } catch (error) {
      console.error('🎯 Error fetching all categories:', error);
    }
  };

  // Function to fetch memories data from API and update sidebar
  const fetchMemoriesData = async () => {
    console.log('🚀🚀🚀 fetchMemoriesData FUNCTION ENTRY');
    console.log('🏠 Current view type:', viewType);
    console.log('🏠 Current property:', currentProperty);

    const fetchId = ++memoriesFetchIdRef.current;
    // Capture whether this is a property fetch at start time
    const isPropertyFetch = !isPartialAdmin() && viewType === 'property' && !!currentProperty;

    try {
      setIsLoadingMemories(true);
      console.log('=== MEMORIES API CALL (App Level) ===');
      console.log('🚨 fetchMemoriesData called at:', new Date().toISOString());

      // Check if we're viewing a property or personal account
      let response;
      if (isPartialAdmin()) {
        response = await dashboardAPI.getPartialAdminMemories(getPartialAdminEmail());
      } else if (viewType === 'property' && currentProperty) {
        response = await dashboardAPI.getPropertyMemories(currentProperty.id);
      } else {
        response = await dashboardAPI.getMemories();
      }
      
      if (response.success && response.data) {
        // IMPORTANT: API returns { status: "success", data: {...} }
        // apiRequest wraps it as { success: true, data: <parsed_JSON> }
        // So response.data.data contains the actual data!
        let actualData = response.data.data || response.data;

        // Normalize partial admin memories response (flat array) into expected structure
        if (isPartialAdmin() && Array.isArray(actualData)) {
          const memoriesArray = actualData;

          // Extract unique categories and sub_categories (labels) from memories
          const categoriesMap = new Map<number, any>();
          const labelsMap = new Map<number, any>();

          memoriesArray.forEach((memory: any) => {
            if (memory.category?.id) {
              if (!categoriesMap.has(memory.category.id)) {
                categoriesMap.set(memory.category.id, {
                  id: memory.category.id,
                  name: memory.category.name,
                  color: memory.category.color || null,
                  memory_count: 0,
                  admin_id: null,
                });
              }
              categoriesMap.get(memory.category.id)!.memory_count++;
            }
            if (memory.sub_category?.id) {
              if (!labelsMap.has(memory.sub_category.id)) {
                labelsMap.set(memory.sub_category.id, {
                  id: memory.sub_category.id,
                  name: memory.sub_category.name,
                  memory_count: 0,
                  admin_id: null,
                });
              }
              labelsMap.get(memory.sub_category.id)!.memory_count++;
            }
          });

          const sidebarData = {
            categories: { items: Array.from(categoriesMap.values()) },
            labels: { items: Array.from(labelsMap.values()) },
          };

          // Calculate correct counts for partial admin
          const totalImages = memoriesArray.reduce((sum: number, m: any) => sum + (m.photos?.count || 0), 0);
          memoryCountsManager.updateState({
            total_memories: memoriesArray.length,
            total_memory_images: totalImages,
            published_memories: 0,
            total_library_people: 0,
          }, false, null);

          actualData = {
            all_memories: { data: memoriesArray },
            data: {
              all_memories: { data: memoriesArray },
              sidebar: sidebarData,
            },
            sidebar: sidebarData,
          };
        }

        // Normalize data structure for both personal and property views
        // Ensure sidebar is available at both root and nested in .data for consistency
        if (!actualData.data) {
          const wrappedData = {
            ...actualData,
            data: {
              ...actualData
            }
          };
          actualData = wrappedData;
        }

        // Handle property memories response structure differently
        if (viewType === 'property' && currentProperty) {
          const propertyInfo = actualData.property;
          const userRole = actualData.user_role;
          const rawPropertyMemories = actualData.memories?.data || [];
          const sidebarData = actualData.sidebar || {};

          // Normalize property memories to match the structure MemoriesPage expects
          const propertyMemories = rawPropertyMemories.map((memory: any) => {
            // location: API returns plain string, MemoriesPage expects { formatted: string }
            const locationStr = typeof memory.location === 'string' ? memory.location : memory.location?.formatted;

            // dates: API returns min/max date strings, MemoriesPage expects { formatted_range: string }
            let formattedRange = '';
            if (memory.min_uploaded_img_date) {
              const minDate = new Date(memory.min_uploaded_img_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              if (memory.max_uploaded_img_date && memory.max_uploaded_img_date !== memory.min_uploaded_img_date) {
                const maxDate = new Date(memory.max_uploaded_img_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                formattedRange = `${minDate} - ${maxDate}`;
              } else {
                formattedRange = minDate;
              }
            }

            return {
              ...memory,
              location: locationStr ? { formatted: locationStr } : memory.location,
              dates: formattedRange ? { formatted_range: formattedRange } : (memory.dates || null),
              // Only substitute property_category when category is null
              category: memory.category || (memory.property_category ? { ...memory.property_category } : null),
              // Story owner: surface memory.user as the author so cards show the real
              // story creator (e.g. "BMW - Toronto" with its logo) instead of falling
              // back to the logged-in property account ("Becks").
              author: memory.author || (memory.user ? {
                id: memory.user.id,
                name: memory.user.name,
                avatar: memory.user.profile_image,
                profile_image: memory.user.profile_image,
                profile_color: memory.user.profile_color,
              } : memory.author),
            };
          });

          // Calculate counts from property memories
          let totalImages = 0;
          let publishedCount = 0;

          propertyMemories.forEach((memory: any) => {
            // Count images
            if (memory.memory_images && Array.isArray(memory.memory_images)) {
              totalImages += memory.memory_images.length;
            } else if (memory.images_count) {
              totalImages += memory.images_count;
            }

            // Count published memories
            if (memory.is_published === 1 || memory.is_published === true) {
              publishedCount++;
            }
          });

          // Extract property categories from sidebar.categories.items
          // Show all property categories (including those with 0 memories for new properties)
          // For property user accounts: sort so categories with memories appear first
          // Count memories per category from actual memories data (API memory_count may be 0)
          const memoriesPerCategory: Record<number, number> = {};
          rawPropertyMemories.forEach((mem: any) => {
            const catId = mem.property_category_id || mem.category_id;
            if (catId) memoriesPerCategory[catId] = (memoriesPerCategory[catId] || 0) + 1;
          });

          const sidebarCategoryIds = new Set(
            (sidebarData.categories?.items || []).map((cat: any) => cat.id)
          );

          // Find categories present in memories but missing from sidebar (e.g. viewer role)
          // Also track whether the logged-in user owns any memory in each category.
          const extraCategoriesMap: Record<number, any> = {};
          const ownedByCatId: Record<number, boolean> = {};
          rawPropertyMemories.forEach((mem: any) => {
            const catId = mem.property_category?.id ?? mem.property_category_id ?? mem.category_id;
            if (catId != null && mem.is_owner === true) ownedByCatId[catId] = true;
            if (mem.property_category && !sidebarCategoryIds.has(mem.property_category.id)) {
              extraCategoriesMap[mem.property_category.id] = mem.property_category;
            }
          });

          const extraCategories = Object.values(extraCategoriesMap).map((cat: any) => ({
            id: cat.id?.toString(),
            name: cat.name,
            memory_count: memoriesPerCategory[cat.id] || 0,
            isUserCreated: false,
            admin_id: null,
            color: '#6C60FF',
            suggested: false,
            expanded: false,
            is_owner: typeof cat.is_owner === 'boolean' ? cat.is_owner : ownedByCatId[cat.id] === true,
            can_add_story: cat.can_add_story
          }));

          // The API provides per-category ownership directly: is_owner === true means the
          // category belongs to the logged-in user. Carry it (and can_add_story) through —
          // this works for empty categories too, which memory-derivation cannot.
          const propertyCategories = [
            ...(sidebarData.categories?.items || []).map((cat: any) => ({
              id: cat.id?.toString(),
              name: cat.name,
              memory_count: memoriesPerCategory[cat.id] || cat.memory_count || 0,
              isUserCreated: cat.admin_id !== null,
              admin_id: cat.admin_id,
              color: cat.color || null,
              suggested: false,
              expanded: cat.expanded || false,
              is_owner: cat.is_owner,
              can_add_story: cat.can_add_story
            })),
            ...extraCategories
          ].sort((a: any, b: any) => (b.memory_count > 0 ? 1 : 0) - (a.memory_count > 0 ? 1 : 0));

          // Extract property labels from sidebar.labels.items only
          const propertyLabels = (sidebarData.labels?.items || [])
            .map((label: any) => ({
              id: label.id?.toString(),
              name: label.name,
              memory_count: label.memory_count || 0,
              isUserCreated: label.admin_id !== null,
              admin_id: label.admin_id,
              color: label.color || null,
              memories: label.memories || []
            }));

          // NOTE: Memories from API already have correct category data, no need to remap
          // The API provides complete category objects with id, name, color, etc.

          // Transform to match personal memories structure
          // IMPORTANT: MemoriesPage expects all_memories.data (object with data property), not direct array
          actualData = {
            all_memories: {
              data: propertyMemories
            },
            data: {
              all_memories: {
                data: propertyMemories
              },
              property: propertyInfo,
              user_role: userRole,
              sidebar: {
                categories: {
                  items: propertyCategories
                },
                labels: {
                  items: propertyLabels
                }
              }
            },
            property: propertyInfo,
            user_role: userRole,
            sidebar: {
              categories: {
                items: propertyCategories
              },
              labels: {
                items: propertyLabels
              }
            },
            // Add calculated counts for property view
            property_counts: {
              total_memories: propertyMemories.length,
              total_memory_images: totalImages,
              published_memories: publishedCount,
              total_library_people: 0
            }
          };
        }

        // Discard only when: personal data arrives while user is in property view
        if (!isPropertyFetch && viewTypeRef.current === 'property') {
          console.log('🚫 Discarding personal data — currently in property view');
          return;
        }

        setApiMemoriesData(actualData);
        setHasApiData(true);

        // Update global memory counts for property view
        if (viewType === 'property' && actualData.property_counts) {
          memoryCountsManager.updateState(actualData.property_counts, false, null);
        }

        // Transform memories for MediaPage BatchActions
        let memoriesToTransform = null;
        if (actualData.all_memories?.data && Array.isArray(actualData.all_memories.data)) {
          memoriesToTransform = actualData.all_memories.data;
        } else if (actualData.all_memories && Array.isArray(actualData.all_memories)) {
          memoriesToTransform = actualData.all_memories;
        } else {
          if (actualData.memories && actualData.memories.length > 0) {
            memoriesToTransform = actualData.memories;
          } else if (actualData.user_memories && actualData.user_memories.length > 0) {
            memoriesToTransform = actualData.user_memories;
          } else if (actualData.latest_memories && actualData.latest_memories.length > 0) {
            memoriesToTransform = actualData.latest_memories;
          }
        }
        
        // Update categories from API data using memory_count from API
        if (actualData.sidebar?.categories?.items) {
          const apiCategories = actualData.sidebar.categories.items
            .map((cat: any) => ({
              id: cat.id?.toString(),
              name: cat.name,
              count: cat.memory_count, // Use API's memory_count directly
              isUserCreated: cat.admin_id !== null, // If admin_id is null, it's system category; otherwise, it's user-created
              admin_id: cat.admin_id, // Pass the admin_id directly from API
              color: cat.color,
              suggested: cat.suggested || false,
              // Carry ownership flags through so the "Create a Campaign" gate works for property
              // accounts. The properties API provides these; personal API does not, so they are
              // simply undefined for personal accounts (unchanged behavior).
              is_owner: cat.is_owner,
              can_add_story: cat.can_add_story
            }));

          initializeCategoryColors(apiCategories.map(cat => ({
            name: cat.name,
            color: cat.color
          })));

          setCategories(apiCategories);

          // Expand all categories by default — always include Published and Shared With
          const allCategoryNames = apiCategories.map(cat => cat.name);
          const allCategoriesToExpand = [...new Set([...allCategoryNames, 'Published', 'Shared With'])];
          setExpandedMemoryCategories(allCategoriesToExpand);
        }
        
        // Update labels from API data using memory_count from API
        if (actualData.sidebar?.labels?.items) {
          const apiLabels = actualData.sidebar.labels.items.map((label: any) => ({
            id: label.id?.toString(),
            name: label.name,
            count: label.memory_count, // Use API's memory_count directly
            isUserCreated: label.admin_id !== null, // If admin_id is null, it's system label; otherwise, it's user-created
            admin_id: label.admin_id // Pass the admin_id directly from API
          }));
          setLabels(apiLabels);
          console.log('Updated Labels with API memory_count:', apiLabels);
        }
        
        console.log('API Categories Count:', actualData.sidebar?.categories?.count);
        console.log('API Labels Count:', actualData.sidebar?.labels?.count);
      } else {
        console.log('API call failed - Response:', response);
        // Keep using fallback static data
      }
    } catch (error) {
      console.error('🔥🔥🔥 ERROR in fetchMemoriesData:', error);
      console.error('🔥🔥🔥 Error type:', typeof error);
      console.error('🔥🔥🔥 Error message:', error instanceof Error ? error.message : String(error));
      console.error('🔥🔥🔥 Error stack:', error instanceof Error ? error.stack : 'No stack');
      // Keep using fallback static data
    } finally {
      setIsLoadingMemories(false);
      console.log('=== END MEMORIES API CALL (App Level) ===');
    }
  };

  // Wrapper function to refresh memories when going back from memory details
  const handleBackFromMemoryWithRefresh = useCallback(() => {
    handleBackFromMemory();
    // Refresh memories data when going back to memories list
    fetchMemoriesData();
  }, [handleBackFromMemory]);

  // Re-fetch memories whenever the sidebar Memories button is clicked
  // (memoriesNavKey increments on every click, even if already on memories page)
  useEffect(() => {
    if (memoriesNavKey === 0) return; // skip initial mount
    fetchMemoriesData();
  }, [memoriesNavKey]);

  // Register memories refresh provider hook (after fetchMemoriesData is defined)
  const registerMemoriesRefresh = useMemoriesRefreshProvider(fetchMemoriesData);
  
  // Register the memories refresh callback
  useEffect(() => {
    const unregister = registerMemoriesRefresh();
    return unregister;
  }, [registerMemoriesRefresh]);

  // Function to update media data when category names change
  const updateMediaDataForCategoryRename = (oldCategoryName: string, newCategoryName: string) => {
    console.log('🔄 Updating media data for category rename:', { oldCategoryName, newCategoryName });
    
    // First, update the categories state itself
    console.log('📊 Before categories update:', {
      totalCategories: categories.length,
      oldCategory: categories.find(cat => cat.name === oldCategoryName),
      categoriesNames: categories.map(cat => cat.name)
    });
    
    const updatedCategories = categories.map(category => 
      category.name === oldCategoryName 
        ? { ...category, name: newCategoryName }
        : category
    );
    setCategories(updatedCategories);
    
    console.log('📊 After categories update:', {
      totalCategories: updatedCategories.length,
      newCategory: updatedCategories.find(cat => cat.name === newCategoryName),
      categoriesNames: updatedCategories.map(cat => cat.name)
    });
    
    // Update apiMediaData
    if (apiMediaData) {
      console.log('📊 Before apiMediaData update:', {
        oldCategoryExists: !!apiMediaData.categories_media?.[oldCategoryName],
        oldCategoryCount: apiMediaData.categories_media?.[oldCategoryName]?.length || 0,
        allCategories: Object.keys(apiMediaData.categories_media || {})
      });
      
      const updatedApiMediaData = { ...apiMediaData };
      
      // Update categories_media object keys and values
      if (updatedApiMediaData.categories_media && updatedApiMediaData.categories_media[oldCategoryName]) {
        const oldCategoryData = updatedApiMediaData.categories_media[oldCategoryName];
        console.log('📦 Moving category data:', { 
          from: oldCategoryName, 
          to: newCategoryName, 
          itemCount: oldCategoryData.length 
        });
        
        updatedApiMediaData.categories_media[newCategoryName] = oldCategoryData;
        delete updatedApiMediaData.categories_media[oldCategoryName];
        
        // Update each media item's category reference within the moved category
        if (updatedApiMediaData.categories_media[newCategoryName]) {
          updatedApiMediaData.categories_media[newCategoryName] = updatedApiMediaData.categories_media[newCategoryName].map((item: any) => ({
            ...item,
            category: newCategoryName
          }));
        }
        
        console.log('📊 After apiMediaData update:', {
          newCategoryExists: !!updatedApiMediaData.categories_media[newCategoryName],
          newCategoryCount: updatedApiMediaData.categories_media[newCategoryName]?.length || 0,
          allCategories: Object.keys(updatedApiMediaData.categories_media || {})
        });
      } else {
        console.warn('⚠️ Old category not found in apiMediaData:', oldCategoryName);
      }
      
      setApiMediaData(updatedApiMediaData);
      console.log('✅ Updated apiMediaData for category rename');
    }
    
    // Update mediaMemories
    console.log('📊 Before mediaMemories update:', {
      totalMemories: mediaMemories.length,
      oldCategoryMemories: mediaMemories.filter(m => m.category === oldCategoryName).length,
      memoriesByCategory: mediaMemories.reduce((acc: any, m) => {
        acc[m.category] = (acc[m.category] || 0) + 1;
        return acc;
      }, {})
    });
    
    const updatedMediaMemories = mediaMemories.map(memory => 
      memory.category === oldCategoryName 
        ? { ...memory, category: newCategoryName }
        : memory
    );
    
    console.log('📊 After mediaMemories update:', {
      totalMemories: updatedMediaMemories.length,
      newCategoryMemories: updatedMediaMemories.filter(m => m.category === newCategoryName).length,
      memoriesByCategory: updatedMediaMemories.reduce((acc: any, m) => {
        acc[m.category] = (acc[m.category] || 0) + 1;
        return acc;
      }, {})
    });
    
    setMediaMemories(updatedMediaMemories);
    console.log('✅ Updated mediaMemories for category rename');
    
    // Update apiMemoriesData if it exists
    if (apiMemoriesData) {
      const updatedApiMemoriesData = { ...apiMemoriesData };

      // Helper to remap a single memory's category name
      const remapMemory = (memory: any) => ({
        ...memory,
        category: memory.category && memory.category.name === oldCategoryName
          ? { ...memory.category, name: newCategoryName }
          : memory.category
      });

      // Update all_memories — handle both {data:[]} object and direct array formats
      if (updatedApiMemoriesData.all_memories) {
        if (updatedApiMemoriesData.all_memories.data && Array.isArray(updatedApiMemoriesData.all_memories.data)) {
          updatedApiMemoriesData.all_memories = {
            ...updatedApiMemoriesData.all_memories,
            data: updatedApiMemoriesData.all_memories.data.map(remapMemory)
          };
        } else if (Array.isArray(updatedApiMemoriesData.all_memories)) {
          updatedApiMemoriesData.all_memories = updatedApiMemoriesData.all_memories.map(remapMemory);
        }
      }

      // Update data.all_memories as well (same dual-format handling)
      if (updatedApiMemoriesData.data?.all_memories) {
        if (updatedApiMemoriesData.data.all_memories.data && Array.isArray(updatedApiMemoriesData.data.all_memories.data)) {
          updatedApiMemoriesData.data = {
            ...updatedApiMemoriesData.data,
            all_memories: {
              ...updatedApiMemoriesData.data.all_memories,
              data: updatedApiMemoriesData.data.all_memories.data.map(remapMemory)
            }
          };
        } else if (Array.isArray(updatedApiMemoriesData.data.all_memories)) {
          updatedApiMemoriesData.data = {
            ...updatedApiMemoriesData.data,
            all_memories: updatedApiMemoriesData.data.all_memories.map(remapMemory)
          };
        }
      }

      // Update sidebar.categories.items so MemoriesPage sidebar shows the renamed category
      if (updatedApiMemoriesData.sidebar?.categories?.items) {
        updatedApiMemoriesData.sidebar = {
          ...updatedApiMemoriesData.sidebar,
          categories: {
            ...updatedApiMemoriesData.sidebar.categories,
            items: updatedApiMemoriesData.sidebar.categories.items.map((cat: any) =>
              cat.name === oldCategoryName ? { ...cat, name: newCategoryName } : cat
            )
          }
        };
      }

      // Update data.sidebar.categories.items (nested path used by MemoriesPage)
      if (updatedApiMemoriesData.data?.sidebar?.categories?.items) {
        updatedApiMemoriesData.data = {
          ...updatedApiMemoriesData.data,
          sidebar: {
            ...updatedApiMemoriesData.data.sidebar,
            categories: {
              ...updatedApiMemoriesData.data.sidebar.categories,
              items: updatedApiMemoriesData.data.sidebar.categories.items.map((cat: any) =>
                cat.name === oldCategoryName ? { ...cat, name: newCategoryName } : cat
              )
            }
          }
        };
      }

      setApiMemoriesData(updatedApiMemoriesData);
      console.log('✅ Updated apiMemoriesData for category rename');
    }
    
    // Update apiMediaNavData if it exists
    if (apiMediaNavData) {
      console.log('📊 Before apiMediaNavData update:', {
        totalCategories: apiMediaNavData.length,
        oldCategoryData: apiMediaNavData.find((cat: any) => cat.name === oldCategoryName),
        oldCategoryMemoriesCount: apiMediaNavData.find((cat: any) => cat.name === oldCategoryName)?.memories?.length || 0
      });
      
      const updatedApiMediaNavData = apiMediaNavData.map((category: any) => 
        category.name === oldCategoryName 
          ? { 
              ...category, 
              name: newCategoryName,
              // Update all memories within this category
              memories: category.memories?.map((memory: any) => ({
                ...memory,
                category: newCategoryName
              })) || []
            }
          : category
      );
      
      console.log('📊 After apiMediaNavData update:', {
        totalCategories: updatedApiMediaNavData.length,
        newCategoryData: updatedApiMediaNavData.find((cat: any) => cat.name === newCategoryName),
        newCategoryMemoriesCount: updatedApiMediaNavData.find((cat: any) => cat.name === newCategoryName)?.memories?.length || 0
      });
      
      setApiMediaNavData(updatedApiMediaNavData);
      console.log('✅ Updated apiMediaNavData for category rename');
    }
    
    // Update selectedMediaCategory if it matches the old name
    if (selectedMediaCategory === oldCategoryName) {
      console.log('📊 Updating selectedMediaCategory from', oldCategoryName, 'to', newCategoryName);
      setSelectedMediaCategory(newCategoryName);
    }
    
    // Update expandedMediaCategories to replace old name with new name
    const updatedExpandedCategories = expandedMediaCategories.map(catName => 
      catName === oldCategoryName ? newCategoryName : catName
    );
    if (JSON.stringify(updatedExpandedCategories) !== JSON.stringify(expandedMediaCategories)) {
      console.log('📊 Updating expandedMediaCategories:', { old: expandedMediaCategories, new: updatedExpandedCategories });
      setExpandedMediaCategories(updatedExpandedCategories);
    }
  };

  // Transform API memories data to match CategoryNav expectations
  const transformApiMemoriesForCategoryNav = (apiMemories: any[]) => {
    if (!apiMemories || !Array.isArray(apiMemories)) {
      return [];
    }

    const results = apiMemories.map((mem: any) => {
      const thumbnail = mem.last_update_img ||
                       mem.photos?.preview_images?.[0]?.url ||
                       mem.posts?.[0]?.image_link ||
                       mem.thumbnail ||
                       'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop';

      const imageCount = mem.posts_count ||
                        mem.posts?.length ||
                        mem.photos?.count ||
                        mem.photos_count ||
                        mem.media_count ||
                        0;

      const author = mem.user?.name ||
                    mem.author?.name ||
                    'Unknown';

      const category = mem.category?.name ||
                      mem.property_category?.name ||
                      'Uncategorized';

      // Transform posts or photos to images array
      let images: any[] = [];
      if (mem.posts && Array.isArray(mem.posts)) {
        images = mem.posts.map((post: any) => ({
          id: post.id?.toString() || '',
          name: post.name || `Image ${post.id}`,
          thumbnail: post.image_link || post.master_image_link || '',
          date: post.capture_date || mem.created_at
        }));
      } else if (mem.photos?.preview_images && Array.isArray(mem.photos.preview_images)) {
        images = mem.photos.preview_images.map((img: any) => ({
          id: img.id?.toString() || '',
          name: `Image ${img.id}`,
          thumbnail: img.url,
          date: mem.created_at
        }));
      }

      // Keep all original fields and only override/add specific fields
      const transformed = {
        ...mem, // Spread original memory to keep all fields
        id: mem.id?.toString() || '',
        title: mem.title || 'Untitled',
        thumbnail,
        imageCount,
        date: mem.created_at || new Date().toISOString(),
        type: 'personal' as const,
        author,
        category,
        labels: mem.sub_category ? [mem.sub_category.name] : mem.label ? [mem.label.name] : [],
        images,
        // Ensure collaborators is always an array
        collaborators: mem.collaborators || []
      };

      return transformed;
    });

    return results;
  };

  // Track previous user to detect user changes
  const [previousUserId, setPreviousUserId] = useState<string | null>(null);
  
  // Monitor user changes and reset state when user changes
  useEffect(() => {
    const currentUserId = user?.id || null;
    
    // If user changed (including logout), reset application state
    if (previousUserId !== null && previousUserId !== currentUserId) {
      console.log('👤 User changed from', previousUserId, 'to', currentUserId);
      resetApplicationState();
    }
    
    setPreviousUserId(currentUserId);
  }, [user?.id, previousUserId, resetApplicationState]);

  // Fetch memories and media data when user is authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      // Fetch media data (this will populate apiMediaNavData which we use for memories)
      fetchMediaData();

      // Fetch existing memories for Add to Memory dialog
      console.log('🚨🚨🚨 About to call fetchExistingMemories...');
      fetchExistingMemories();

      // Only fetch memories here if NOT in property view.
      // Use viewTypeRef (not closure viewType) to get the actual current value.
      // Property view fetching is handled by the viewType useEffect.
      if (viewTypeRef.current !== 'property') {
        console.log('🚨🚨🚨 About to call fetchMemoriesData...');
        fetchMemoriesData();
      }
    } else {
      console.log('🚨 AUTH CHECK: Not authenticated or still loading', { isAuthenticated, isLoading });
    }
  }, [isAuthenticated, isLoading]);

  // Fetch memories data when navigating to memories page or coming back from memory detail
  // NOTE: This is disabled because viewType useEffect handles all fetching now
  // Keeping this would cause double-fetch and overwrite property data with personal data
  // useEffect(() => {
  //   if (isAuthenticated && currentPage === "memories" && !selectedMemoryId && !isLoadingMemories) {
  //     console.log('🔄 On memories page (back from detail or navigation) - fetching data from API...');
  //     fetchMemoriesData();
  //   }
  // }, [currentPage, isAuthenticated, selectedMemoryId]);

  // Refetch memories when switching between personal and property view
  useEffect(() => {
    // Keep ref in sync so stale closures can read current viewType
    viewTypeRef.current = viewType;

    if (isAuthenticated) {
      // Set property mode BEFORE any async calls to prevent personal counts overriding property counts
      memoryCountsManager.setPropertyMode(viewType === 'property');

      setApiMemoriesData(null);
      setHasApiData(false);

      if (viewType === 'property' && currentPage !== 'memories' && currentPage !== 'media') {
        handleNavigation('memories');
      }

      if (viewType === 'personal') {
        memoryCountsManager.fetchMemoryCounts();
      }

      fetchMemoriesData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewType, currentProperty, isAuthenticated]);

  // Fetch ALL categories and media data when navigating to media page
  useEffect(() => {
    if (isAuthenticated && currentPage === "media") {
      // Fetch ALL categories for media page sidebar
      fetchAllCategoriesForMedia();

      // Refresh media data to show updated content
      fetchMediaData();
    }
  }, [currentPage, isAuthenticated]);

  // Debug: Log when apiMediaNavData changes to track sidebar updates
  useEffect(() => {
    console.log('🔔🔔🔔 apiMediaNavData STATE CHANGED:', {
      timestamp: new Date().toISOString(),
      length: apiMediaNavData.length,
      categoryNames: apiMediaNavData.map((cat: any) => cat.name),
      data: apiMediaNavData
    });
  }, [apiMediaNavData]);

  // Show loading spinner only during initial authentication check
  // SKIP loading spinner for invite links with login=1 (user should see login page immediately)
  // SKIP loading spinner for /signup path (user should see signup page immediately)
  const currentUrlParams = new URLSearchParams(window.location.search);
  const isInviteLoginPage = currentUrlParams.get('invite') === '1' && currentUrlParams.get('login') === '1';
  const isSignupPath = window.location.pathname === '/signup';

  if (isLoading && !isInviteLoginPage && !isSignupPath) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mb-4">
            <div className="text-white text-2xl font-bold">S</div>
          </div>
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Stasht Studio...</p>
        </div>
      </div>
    );
  }

  // Show activation page if activation token is present
  if (activationToken) {
    return (
      <AccountActivationPage 
        token={activationToken}
        onActivationComplete={handleActivationComplete}
      />
    );
  }

  // If authenticated user is on /signup path, return null while useEffect handles logout+reload
  if (isAuthenticated && isSignupPath && currentUrlParams.get('email')) {
    return null;
  }

  // SPECIAL CASE: Check if we're on /login route with email parameter while authenticated
  // If the email is DIFFERENT from logged-in user, logout and show login page
  // SKIP for invite links: email= is the owner's email, not the collaborator's
  if (isAuthenticated && window.location.pathname === '/login') {
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('invite') === '1') {
      // Invite link — email param is the memory owner's email, not the person being invited.
      // Do NOT run the magic-link email mismatch check here.
      console.log('🔗 [App] On /login invite link while authenticated - skipping email mismatch check');
    } else {
    const emailParam = urlParams.get('email');
    const storedEmail = sessionStorage.getItem('pending_magic_link_email') || sessionStorage.getItem('magic_link_email');

    console.log('🔗 [App] On /login route while authenticated');
    console.log('🔗 [App] emailParam:', emailParam);
    console.log('🔗 [App] storedEmail:', storedEmail);

    if (emailParam || storedEmail) {
      const emailToCheck = emailParam || storedEmail;
      const currentEmail = user?.email || user?.phone_number;
      const decodedEmailToCheck = decodeURIComponent(emailToCheck);

      console.log('🔗 [App] Comparing emails - current:', currentEmail, 'target:', decodedEmailToCheck);

      // If emails don't match, logout and show login page
      if (currentEmail?.toLowerCase() !== decodedEmailToCheck.toLowerCase()) {
        console.log('🔗 [App] ❌ Email MISMATCH - logging out to show login page');

        // Logout immediately (without redirect)
        localStorage.removeItem('stasht_user');
        localStorage.removeItem('stasht_token');
        sessionStorage.removeItem('stasht_session');

        // Force reload to show login page
        window.location.reload();
        return null; // Return null while reloading
      } else {
        // Emails match! Call collaborator API directly
        console.log('🔗 [App] ✅ Email MATCHES - calling collaborator API');

        // Call API asynchronously
        (async () => {
          try {
            const response = await authAPI.getCollaboratorsForMagicLink(decodedEmailToCheck, 'admin');
            console.log('🔗 [App/Login] API response:', response);

            if (response.success && response.data) {
              const collaboratorsData = response.data.collaborators || [];
              console.log('🔗 [App/Login] Collaborators:', collaboratorsData);

              // Check for admin collaborator
              const adminCollab = collaboratorsData.find((c: any) => c.role === 'admin');

              if (adminCollab) {
                console.log('🔗 [App/Login] Admin collaborator found!');
                console.log('🔗 [App/Login] Admin collaborator:', adminCollab);

                // Store collaborators in localStorage for AccountChoiceModal
                localStorage.setItem('magic_link_admin_collaborator', JSON.stringify(adminCollab));
                localStorage.setItem('magic_link_show_modal', 'true');

                console.log('🔗 [App/Login] ✅ Data stored! Redirecting to memories...');
                toast.success('Admin access detected! Redirecting...');
              } else {
                console.log('🔗 [App/Login] No admin collaborator found');
              }
            }
          } catch (error) {
            console.error('🔗 [App/Login] Error calling collaborators API:', error);
            toast.error('Failed to load collaborator information');
          }

          // Clean up sessionStorage
          sessionStorage.removeItem('pending_magic_link_email');
          sessionStorage.removeItem('magic_link_email');

          // Navigate to home
          window.location.href = '/';
        })();

        // Return null while API is being called and redirect happens
        return null;
      }
    }
    } // end else (non-invite link)
  }

  // Show loading screen ONLY if actively checking published memory
  if (isCheckingPublishedMemory) {
    console.log('🔄 Showing loading screen - checking if memory is published');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-[#6C60FF] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">Loading campaign...</p>
        </div>
      </div>
    );
  }

  // Show login/signup page if not authenticated
  if (!isAuthenticated) {
    // SIMPLE & DIRECT: Check URL parameter RIGHT HERE at render time
    const urlParams = new URLSearchParams(window.location.search);
    const loginParam = urlParams.get('login');

    // login=0 means SIGNUP, login=1 or no param means LOGIN, /signup path always shows signup
    const shouldShowSignup = loginParam === '0' || (loginParam !== '1' && showSignup) || isSignupPath;

    console.log('🔍 [App Render] loginParam:', loginParam, '| shouldShowSignup:', shouldShowSignup);

    if (shouldShowSignup) {
      return (
        <SignupPage
          onSignup={handleSignup}
          onSwitchToLogin={handleSwitchToLogin}
        />
      );
    } else {
      const googleClientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;

      return (
        <GoogleOAuthProvider clientId={googleClientId || 'jjjj'}>
          <LoginPage
            onLogin={handleLogin}
            onSwitchToSignup={handleSwitchToSignup}
            onSocialLogin={handleSocialLogin}
          />
        </GoogleOAuthProvider>
      );
    }
  }

  const renderMainContent = () => {
    if (currentPage === "dashboard") {
      return (
        <Dashboard 
          timePeriod={timePeriod}
          onTimePeriodChange={handleTimePeriodChange}
          onNavigate={handleNavigation}
          onMemorySelect={handleMemorySelect}
        />
      );
    }

    if (currentPage === "memories" && !selectedMemoryId) {
      return (
        <MemoriesPage
          onMemorySelect={handleMemorySelect}
          selectedCategory={selectedMemoryCategory}
          onCategorySelect={handleMemoryCategorySelect}
          memories={(() => {
            if (apiMemoriesData) {
              const allMemoriesRaw = apiMemoriesData?.all_memories?.data || apiMemoriesData?.data?.all_memories?.data || apiMemoriesData?.all_memories || apiMemoriesData?.data?.all_memories || apiMemoriesData?.latest_memories || apiMemoriesData?.data?.latest_memories || [];
              const memoriesToUse = Array.isArray(allMemoriesRaw) ? allMemoriesRaw : (allMemoriesRaw?.data || []);
              return transformApiMemoriesForCategoryNav(memoriesToUse);
            } else {
              return mediaMemories;
            }
          })()}
          categories={categories}
          apiMemoriesData={apiMemoriesData}
          isLoadingMemories={isLoadingMemories}
          onRefreshMemories={fetchMemoriesData}
          expandedCategories={expandedMemoryCategories}
          onNavigate={handleNavigation}
          showMobileSidebar={showMemoriesMobileSidebar}
          onCloseMobileSidebar={() => setShowMemoriesMobileSidebar(false)}
          createMemoryTrigger={createMemoryTrigger}
          onClearCreateMemoryTrigger={handleClearCreateMemoryTrigger}
          onPublishedEntryViewChange={setIsViewingPublishedEntry}
          onAIWizardProgress={(progress) => setAiProcessing(prev => prev ? { ...prev, progress } : { memoryId: 'wizard', status: 'processing', startTime: Date.now(), progress })}
          onAIWizardDone={() => setAiProcessing(null)}
          createCategorySignal={createCategorySignal}
          onRequestCreateCategory={() => setCreateCategorySignal((c) => c + 1)}
          openPublishedEntrySignal={openPublishedEntrySignal}
        />
      );
    }


    if (selectedMemoryId) {
      console.log('🔍 App.tsx - Rendering MemoryDetailsPage with selectedMemoryId:', selectedMemoryId);
      return <MemoryDetailsPage
        key={selectedMemoryId}
        memoryId={selectedMemoryId}
        onBack={handleBackFromMemoryWithRefresh}
        forceSharedView={forceSharedView}
        categories={categories}
        onRefresh={fetchMemoriesData}
        onRefreshMedia={fetchMediaData}
        shouldOpenAddMoments={shouldOpenAddMoments}
        setShouldOpenAddMoments={setShouldOpenAddMoments}
        shouldOpenEdit={shouldOpenEdit}
        setShouldOpenEdit={setShouldOpenEdit}
        shouldOpenAIResults={shouldOpenAIResults}
        setShouldOpenAIResults={setShouldOpenAIResults}
        shouldOpenComments={shouldOpenComments}
        setShouldOpenComments={setShouldOpenComments}
        commentId={commentId}
        shouldOpenImageModal={shouldOpenImageModal}
        setShouldOpenImageModal={setShouldOpenImageModal}
        imageId={imageId}
        shouldOpenModerationTab={shouldOpenModerationTab}
        setShouldOpenModerationTab={setShouldOpenModerationTab}
        shouldOpenCollaboratorsTab={shouldOpenCollaboratorsTab}
        setShouldOpenCollaboratorsTab={setShouldOpenCollaboratorsTab}
        aiProcessingData={aiProcessing}
        setAiProcessing={setAiProcessing}
        onNavigate={handleNavigation}
        onMemorySelect={handleLinkedMemorySelect}
        initialProperties={(() => {
          const allMems = apiMemoriesData?.data?.all_memories?.data || apiMemoriesData?.all_memories?.data || apiMemoriesData?.data?.all_memories || apiMemoriesData?.all_memories || [];
          const arr = Array.isArray(allMems) ? allMems : (allMems?.data || []);
          const mem = arr.find((m: any) => String(m.id) === String(selectedMemoryId));
          return mem?.properties?.map((p: any) => ({ id: p.id, name: p.name })) || [];
        })()}
      />;
    }

    if (currentPage === "media") {
      console.log('📱 Rendering MediaPage with:', {
        mediaMemoriesCount: mediaMemories.length,
        unassignedImagesCount: unassignedImages.length,
        isLoadingMediaData,
        apiMediaData: apiMediaData ? 'loaded' : 'null'
      });
      console.log('🚨 DEBUG EMPTY MEMORY DIALOG - mediaMemories being passed to MediaPage:', mediaMemories);
      console.log('🚨 DEBUG EMPTY MEMORY DIALOG - apiMemoriesData state:', apiMemoriesData);
      
      return (
        <MediaPage
          categories={categories}
          expandedCategories={selectedMediaCategory ? [selectedMediaCategory] : expandedMediaCategories}
          mediaMemories={mediaMemories}
          unassignedImages={unassignedImages}
          showUnassignedImages={selectedMediaCategory === 'Unassigned' ? true : (selectedMediaCategory ? false : showUnassignedImages)}
          selectedCategory={selectedMediaCategory}
          selectedMediaItems={selectedMediaItems}
          onMediaItemSelect={handleMediaItemSelect}
          onClearSelection={handleClearMediaSelection}
          isLoadingMediaData={isLoadingMediaData}
          apiMediaData={apiMediaData}
          apiMediaNavData={apiMediaNavData}
          onFetchMediaData={fetchMediaData}
          isUploadingMedia={isUploadingMedia}
          uploadProgress={uploadProgress}
          onHighlightedImageChange={setHighlightedImageId}
          imageViewerRef={imageViewerRef}
          onServiceTabChange={setActiveServiceTab}
          onServiceSyncedMediaChange={setServiceSyncedMedia}
          onConnectedServicesChange={setConnectedServices}
          onDropboxProgressChange={handleDropboxProgressChange}
          showDropboxProgress={showDropboxProgress}
          activeServiceTab={activeServiceTab}
          onRefreshConnectedServicesReady={setRefreshConnectedServices}
          pendingUploadFiles={pendingUploadFiles}
          onUploadFilesProcessed={() => setPendingUploadFiles([])}
          isPropertyOwner={isPropertyOwner}
          apiMemoriesData={apiMemoriesData}
          onCategoriesUpdate={handleMediaSidebarUpdate}
          onCategoryRenamed={updateMediaDataForCategoryRename}
          showMobileSidebar={showMediaMobileSidebar}
          onCloseMobileSidebar={() => setShowMediaMobileSidebar(false)}
          onToggleMobileSidebar={() => setShowMediaMobileSidebar(prev => !prev)}
          onNewMediaPending={(ids) => setPendingNewMediaIds(ids)}
          dismissedNewMediaIds={dismissedNewMediaIds}
        />
      );
    }

    if (currentPage === "profile-settings") {
      return <ProfileSettingsPage />;
    }

    if (currentPage === "billing") {
      return <BillingPage onNavigateToMemory={handleMemorySelect} />;
    }

    if (currentPage === "users") {
      return <UsersPage openConversationLeadId={pendingConversationLeadId} onConversationOpened={() => setPendingConversationLeadId(null)} />;
    }

    if (currentPage === "library") {
      return <LibraryPage
        onNavigate={handleNavigation}
        pendingFacePersonId={pendingFacePersonId}
        onClearPendingFace={() => setPendingFacePersonId(null)}
        onAIScanProgress={(progress, status, personId) => {
          if (status === 'failed') {
            setAiProcessing(null);
          } else if (status === 'completed') {
            // Store personId in aiProcessing — will be used when user clicks "Show Results"
            setAiProcessing(prev => prev ? { ...prev, status: 'completed', progress: 100, personId } : null);
          } else {
            setAiProcessing(prev => prev ? { ...prev, progress } : {
              memoryId: 'ai-scan',
              status: 'processing',
              startTime: Date.now(),
              progress,
              title: 'AI Scan',
              subtitle: 'Scanning campaigns for face matches...',
              navigateTo: 'library',
            });
          }
        }}
      />;
    }

    if (currentPage === "apps") {
      return <AppsPage />;
    }

    if (currentPage === "marketplace") {
      return <MarketplacePage />;
    }

    if (currentPage === "csv-upload") {
      return <CsvUploadPage />;
    }

    // Default fallback for other pages
    return (
      <div className="w-full space-y-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}
          </h1>
          <p className="text-gray-600">This page is coming soon...</p>
        </div>
      </div>
    );
  };

  // Force exact main sidebar width - ALWAYS the same regardless of page
  const mainSidebarWidth = isSidebarMinimized ? 'w-20' : 'w-80';
  const mainSidebarClasses = `bg-white shadow-sm transition-all duration-300 border-r border-gray-100 fixed top-20 h-[calc(100vh-5rem)] z-10 ${mainSidebarWidth} overflow-hidden`;

  // Block render until pending property switch resolves — prevents personal account flash
  if (isAuthenticated && isPendingPropertySwitch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mb-4">
            <div className="text-white text-2xl font-bold">S</div>
          </div>
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Stasht Studio...</p>
        </div>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallBanner(false);
        localStorage.setItem('pwa-install-dismissed', '1');
      }
      setInstallPrompt(null);
    } else {
      setShowInstallInstructions(true);
    }
  };

  const handleDismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa-install-dismissed', '1');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="sticky top-0 z-[9999] flex items-center justify-between gap-3 px-4 py-3 bg-[#6C60FF] text-white">
          <div className="flex items-center gap-3">
            <img src="/pwa-icon-192.png" alt="Stasht" className="w-8 h-8 rounded-lg" />
            <div>
              <p className="text-sm font-semibold leading-tight">Install Stasht</p>
              <p className="text-xs opacity-80 leading-tight">Add to your home screen</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="bg-white text-[#6C60FF] text-xs font-semibold px-3 py-1.5 rounded-full"
            >
              Install
            </button>
            <button
              onClick={handleDismissInstallBanner}
              className="opacity-70 hover:opacity-100 p-1"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* PWA Manual Install Instructions (when native prompt not available) */}
      {showInstallInstructions && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/50" onClick={() => setShowInstallInstructions(false)}>
          <div className="w-full max-w-md bg-white rounded-t-2xl p-6 pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-semibold text-gray-900">Install Stasht</p>
              <button onClick={() => setShowInstallInstructions(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            {/iPhone|iPad|iPod/.test(navigator.userAgent) ? (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-2"><span className="font-bold text-[#6C60FF]">1.</span> Tap the <span className="font-semibold">Share</span> button at the bottom of Safari</li>
                <li className="flex gap-2"><span className="font-bold text-[#6C60FF]">2.</span> Scroll down and tap <span className="font-semibold">"Add to Home Screen"</span></li>
                <li className="flex gap-2"><span className="font-bold text-[#6C60FF]">3.</span> Tap <span className="font-semibold">Add</span> to confirm</li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-2"><span className="font-bold text-[#6C60FF]">1.</span> Tap the <span className="font-semibold">⋮ menu</span> (top right of Chrome)</li>
                <li className="flex gap-2"><span className="font-bold text-[#6C60FF]">2.</span> Tap <span className="font-semibold">"Add to Home screen"</span> or <span className="font-semibold">"Install app"</span></li>
                <li className="flex gap-2"><span className="font-bold text-[#6C60FF]">3.</span> Tap <span className="font-semibold">Add</span> to confirm</li>
              </ol>
            )}
          </div>
        </div>
      )}
      {/* Top Navigation */}
      <header className={`h-20 bg-white shadow-sm z-50 border-b border-gray-100 sticky top-0 ${selectedMemoryId ? 'hidden md:block' : ''}`}>
        <InteractiveNav
          notificationCount={notificationCount}
          onNotificationsClear={clearNotifications}
          onMemorySelect={handleMemorySelect}
          onOpenConversation={handleOpenConversation}
          onShowProfileSettings={handleShowProfileSettings}
          onShowBillingPayment={handleShowBillingPayment}
          user={user ? { ...user, credits: limitData.ai_connects || 0 } : undefined}
          onOpenMobileSidebar={currentPage === 'memories' ? () => setShowMemoriesMobileSidebar(true) : currentPage === 'media' ? () => setShowMediaMobileSidebar(true) : undefined}
          hideMemoryDetailsIcons={!!selectedMemoryId}
          onUploadMedia={handleUploadMedia}
          isPropertyOwner={isPropertyOwner}
        />
      </header>
      
      {/* Main Content Area with Sidebar */}
      <div className="flex flex-1 min-h-full bg-white">
        {/* Main Sidebar - Hidden on mobile, visible on desktop */}
        <aside className={`${mainSidebarClasses} hidden md:block`} style={{
          minWidth: isSidebarMinimized ? '5rem' : '21.5rem',
          maxWidth: isSidebarMinimized ? '5rem' : '21.5rem',
          width: isSidebarMinimized ? '5rem' : '21.5rem',
          left: 0
        }}>
          <div className="h-full w-full">
            <Sidebar
              isMinimized={isSidebarMinimized}
              onToggleMinimize={toggleSidebar}
              activeItem={currentPage}
              onNavigate={handleNavigationWithReset}
              onMemoryLimitRefresh={fetchMemoriesData}
              aiProcessing={aiProcessing}
              viewType={viewType}
              currentProperty={currentProperty}
              isPropertyOwner={isPropertyOwner}
              onClearAiProcessing={() => {
                console.log('🧹 Clearing AI processing state from sidebar');
                setAiProcessing(null);
                hasShownToastRef.current = null;
              }}
              onShowAiResults={(memoryId) => {
                const target = aiProcessing?.navigateTo ?? 'memories';
                if (target === 'library') {
                  // AI Scan — navigate to library and open the scanned person's face detail
                  if (aiProcessing?.personId) {
                    setPendingFacePersonId(aiProcessing.personId);
                  }
                  handleNavigation('library');
                } else {
                  // AI Campaign Wizard — navigate to the memory and open results modal
                  handleMemorySelect(memoryId);
                  setShouldOpenAIResults(true);
                }
                setAiProcessing(null);
                hasShownToastRef.current = null;
              }}
            />
          </div>
        </aside>

        {/* Dropbox Sync Progress Bar - Fixed below main sidebar */}
        {showDropboxProgress && (
          <div
            className="hidden md:block fixed bg-white border border-gray-200 rounded-xl shadow-lg z-20 transition-all duration-300 animate-slideUpFadeIn"
            style={{
              top: 'calc(100vh - 9rem)',
              left: isSidebarMinimized ? '1.25rem' : '1.25rem',
              width: isSidebarMinimized ? 'calc(5rem - 2.5rem)' : 'calc(20rem - 2.5rem)',
              animation: 'slideUpFadeIn 0.5s ease-out forwards'
            }}
          >
            <div className="p-4">
              {dropboxSyncProgress < 100 ? (
                // Syncing state - matches Dropbox brand UI
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {/* Dropbox Icon - Blue circle with white logo */}
                    <div className="w-10 h-10 rounded-full bg-[#0061FF] flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
                        <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">Syncing Dropbox</h3>
                        <span className="text-xs font-medium text-gray-500">({Math.round(dropboxSyncProgress)}%)</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Importing your media...
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0061FF] transition-all duration-1000 ease-out"
                      style={{ width: `${dropboxSyncProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <span className="text-xs font-medium text-gray-500">{Math.round(dropboxSyncProgress)}%</span>
                  </div>
                </div>
              ) : (
                // Complete state - matches Screenshot 2
                <div className="space-y-3">
                  <div className="flex items-start gap-3 px-3 py-2 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                        Sync Complete!
                        <span className="text-base">✨</span>
                      </h3>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {dropboxSyncedItemCount} {dropboxSyncedItemCount === 1 ? 'item' : 'items'} imported successfully
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleViewDropboxResult}
                    className="w-full px-4 py-2.5 bg-[#6C60FF] hover:bg-[#5850E5] text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    View Media
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sub-Sidebar - Hidden on mobile, visible on desktop */}
        <aside className={`${shouldShowSubSidebar && !isViewingPublishedEntry ? 'hidden md:block' : 'hidden'} bg-white shadow-sm border-r border-gray-100 transition-all duration-300 fixed top-20 h-[calc(100vh-5rem)] z-10 flex-shrink-0 overflow-hidden ${
            isSubSidebarExpanded ? 'w-72' : 'w-20'
          }`} style={{
            minWidth: isSubSidebarExpanded ? '18rem' : '5rem',
            maxWidth: isSubSidebarExpanded ? '18rem' : '5rem',
            width: isSubSidebarExpanded ? '18rem' : '5rem',
            left: isSidebarMinimized ? '5rem' : '20rem'
          }}>
            <div className="h-full w-full overflow-y-auto">
              {currentPage === "memories" ? (
                apiMemoriesData?.data?.sidebar?.categories?.items ? (
                  <CategoryNav
                    isStacked={!isSubSidebarExpanded}
                    onToggleExpansion={toggleSubSidebarExpansion}
                    canToggle={true}
                    openCreateCategorySignal={createCategorySignal}
                    categories={(() => {
                      // Map categories from API
                      const mappedCategories = apiMemoriesData.data.sidebar.categories.items
                        .map((cat: any) => ({
                          id: cat.id?.toString(),
                          name: cat.name,
                          count: cat.memory_count,
                          isUserCreated: cat.admin_id !== null,
                          admin_id: cat.admin_id,
                          color: cat.color,
                          suggested: cat.suggested || false,
                          // is_owner === true means the category belongs to the logged-in user.
                          is_owner: cat.is_owner,
                          can_add_story: cat.can_add_story
                        }));

                      // Filter out Suggested category if count is 0
                      const filteredCategories = mappedCategories.filter((cat: any) => {
                        if (cat.name === 'Suggested' && cat.count === 0) {
                          return false; // Don't show Suggested if count is 0
                        }
                        return true;
                      });

                      // Sort categories: Suggested first, Published last (on property account)
                      const sortedCategories = filteredCategories.sort((a: any, b: any) => {
                        // Suggested always first if it has count > 0
                        if (a.name === 'Suggested' && a.count > 0) return -1;
                        if (b.name === 'Suggested' && b.count > 0) return 1;

                        // On property account, Published always last
                        if (viewType === 'property') {
                          if (a.name === 'Published') return 1;
                          if (b.name === 'Published') return -1;
                        }

                        // Keep original order for other categories
                        return 0;
                      });

                      return sortedCategories;
                    })()}
                    labels={apiMemoriesData?.data?.sidebar?.labels?.items?.map((label: any) => ({
                      id: label.id?.toString(),
                      name: label.name,
                      count: label.memory_count,
                      isUserCreated: label.admin_id !== null,
                      admin_id: label.admin_id
                    })) || []}
                    onCategoriesChange={handleCategoriesChange}
                    onLabelsChange={handleLabelsChange}
                    memories={apiMemoriesData ? transformApiMemoriesForCategoryNav(
                      (() => { const raw = apiMemoriesData.data?.all_memories?.data || apiMemoriesData.data?.all_memories || apiMemoriesData.data?.latest_memories || []; return Array.isArray(raw) ? raw : (raw?.data || []); })()
                    ) : mediaMemories}
                    apiMemoriesData={apiMemoriesData}
                    onMemorySelect={(memoryId, options) => {
                      // Published-author entries carry a `pa-<index>` id — route them to the
                      // MemoriesPage published-entry viewer (same as the main-grid card) instead
                      // of the normal memory open. Resolve the entry here and pass it through so
                      // the viewer opens the exact same short_url the grid card would.
                      if (typeof memoryId === 'string' && memoryId.startsWith('pa-')) {
                        const idx = parseInt(memoryId.replace('pa-', ''), 10);
                        const entries = apiMemoriesData?.published || apiMemoriesData?.data?.published || [];
                        const entry = !Number.isNaN(idx) ? entries[idx] : undefined;
                        if (entry?.short_url) setOpenPublishedEntrySignal({ entry, nonce: Date.now() });
                        return;
                      }
                      handleMemorySelect(memoryId, options);
                    }}
                    selectedCategory={selectedMemoryCategory}
                    onCategorySelect={handleMemoryCategorySelect}
                    expandedCategories={expandedMemoryCategories}
                    onFilterChange={handleExpandedMemoryCategoriesChange}
                    onRefreshData={fetchMemoriesData}
                    onCreateMemory={isPropertyOwner ? handleCreateMemoryRequest : undefined}
                    isPropertyOwner={isPropertyOwner}
                    currentPropertyId={currentProperty?.id}
                  />
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    <div className="animate-pulse">Loading categories...</div>
                  </div>
                )
              ) : currentPage === "media" ? (
                console.log('🟦 Rendering MediaNav - currentPage is media, isSubSidebarExpanded:', isSubSidebarExpanded),
                <MediaNav
                  isStacked={!isSubSidebarExpanded}
                  onToggleExpansion={toggleSubSidebarExpansion}
                  canToggle={true}
                  onFilterChange={handleMediaFilterChange}
                  expandedCategories={selectedMediaCategory ? [selectedMediaCategory] : expandedMediaCategories}
                  selectedCategory={selectedMediaCategory}
                  onCategorySelect={handleMediaCategorySelect}
                  mediaMemories={apiMediaNavData.length > 0 ? [] : mediaMemories}
                  onMediaMemoriesChange={handleMediaMemoriesChange}
                  unassignedImages={unassignedImages}
                  onUnassignedImagesChange={handleUnassignedImagesChange}
                  showUnassignedImages={showUnassignedImages}
                  onUnassignedToggle={handleUnassignedToggle}
                  categories={categories}
                  selectedMediaItems={selectedMediaItems}
                  onMediaItemSelect={handleMediaItemSelect}
                  apiMediaNavData={apiMediaNavData}
                  onUploadStateChange={setIsUploadingMedia}
                  onUploadProgressChange={setUploadProgress}
                  highlightedImageId={highlightedImageId}
                  onImageClick={imageViewerRef.current}
                  onMemorySelect={handleMemorySelect}
                  apiMemoriesData={apiMemoriesData}
                  onCategoriesUpdate={fetchMemoriesData}
                  onCategoryRenamed={updateMediaDataForCategoryRename}
                  activeServiceTab={activeServiceTab}
                  serviceSyncedMedia={serviceSyncedMedia}
                  connectedServices={connectedServices}
                  dropboxSyncProgress={dropboxSyncProgress}
                  showDropboxProgress={showDropboxProgress}
                  onViewDropboxResult={handleViewDropboxResult}
                  isPropertyOwner={isPropertyOwner}
                />
              ) : currentPage === "profile-settings" ? (
                <ProfileSettingsNav
                  isStacked={!isSubSidebarExpanded}
                  onToggleExpansion={toggleSubSidebarExpansion}
                  canToggle={true}
                />
              ) : currentPage === "billing" ? (
                <BillingNav
                  isStacked={!isSubSidebarExpanded}
                  onToggleExpansion={toggleSubSidebarExpansion}
                  canToggle={true}
                />
              ) : null}
            </div>
          </aside>

        {/* Main Content */}
<main className={`flex-1 bg-white min-h-[calc(100dvh-5rem)] relative mx-4 md:mx-0 ${
          currentPage === "users" || currentPage === "apps" || currentPage === "library" || currentPage === "Media" || currentPage === "Dashboard" || currentPage === "memories" || currentPage === "marketplace" ? "" : "py-5 md:py-6"
        } ${shouldShowSubSidebar && !isViewingPublishedEntry
          ? (isSubSidebarExpanded
              ? (isSidebarMinimized ? 'md:ml-[23rem]' : 'md:ml-[39.5rem]')
              : (isSidebarMinimized ? 'md:ml-[10rem]' : 'md:ml-[26.5rem]'))
          : (isSidebarMinimized ? 'md:ml-[5rem]' : 'md:ml-[21.5rem]')
        }`}>
          {renderMainContent()}
        </main>
      </div>

      {/* Mobile Bottom Navigation - Only visible on mobile */}
      {!selectedMemoryId && (
        <>
          {/* Hidden file input for Scan Photo */}
          <input
            ref={scanPhotoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) {
                handleNavigation("memories");
                handleCreateMemoryRequest();
              }
              e.target.value = '';
            }}
          />

          {/* Plus Popover Backdrop */}
          {showPlusPopover && (
            <div
              className="md:hidden fixed inset-0 z-[9998]"
              onClick={() => setShowPlusPopover(false)}
            />
          )}

          {/* Plus Popover Card */}
          {showPlusPopover && (
            <div className="md:hidden fixed bottom-[163px] left-1/2 -translate-x-1/2 z-[9999] bg-gray-100/75 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/60 w-72 overflow-hidden">
              {/* Create a Campaign */}
              <button
                className="flex items-center gap-4 w-full px-4 py-4 hover:bg-white/40 active:bg-white/60 transition-colors"
                onClick={() => {
                  setShowPlusPopover(false);
                  handleNavigation("memories");
                  handleCreateMemoryRequest();
                }}
              >
                <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900">Create a Campaign</p>
                  <p className="text-xs text-gray-500">Add to collection</p>
                </div>
              </button>


              <div className="h-px bg-white mx-4" />

              {/* Take a Photo/Video */}
              <button
                className="flex items-center gap-4 w-full px-4 py-4 hover:bg-white/40 active:bg-white/60 transition-colors"
                onClick={() => {
                  setShowPlusPopover(false);
                  setShowBottomNavCamera(true);
                }}
              >
                <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-6 h-6 text-gray-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900">Take a Photo/Video</p>
                  <p className="text-xs text-gray-500">Add to collection</p>
                </div>
              </button>
            </div>
          )}

          {/* Add a Moment Modal — library mode (no memory required) */}
          <AddMomentModal
            isOpen={showAddMomentModal}
            onClose={() => setShowAddMomentModal(false)}
            libraryMode={true}
          />

          <nav className="md:hidden sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-inset-bottom overflow-visible relative">
            {/* Center FAB — protrudes above the nav bar */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-20 z-[10000]">
              <button
                onClick={() => setShowPlusPopover(prev => !prev)}
                className="w-24 h-24 rounded-full bg-[#6C60FF] hover:bg-[#5B4FE8] flex items-center justify-center shadow-lg active:scale-95 transition-all"
              >
                <Plus className="w-12 h-12 text-white" strokeWidth={1} />
              </button>
            </div>

            <div className="flex items-center justify-around h-24">
              {/* Only show Dashboard if user role is NOT 3 */}
              {user?.role !== '3' && user?.role !== 3 && (
                <button
                  onClick={() => {
                    handleNavigation("dashboard");
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`flex flex-col items-center justify-center flex-1 py-2 px-3 rounded-lg transition-colors ${
                    currentPage === "dashboard" ? "text-[#6C60FF] bg-[#6C60FF]/10" : "text-gray-500"
                  }`}
                >
                  <LayoutDashboard className="w-8 h-8 mb-1" />
                  <span className="text-xs font-medium">Dashboard</span>
                </button>
              )}

              <button
                onClick={() => {
                  handleNavigation("memories");
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex flex-col items-center justify-center flex-1 py-2 px-3 rounded-lg transition-colors ${
                  currentPage === "memories" ? "text-[#6C60FF] bg-[#6C60FF]/10" : "text-gray-500"
                }`}
              >
                <FolderOpen className="w-8 h-8 mb-1" />
                <span className="text-xs font-medium">Campaigns</span>
              </button>

              <button
                onClick={() => {
                  handleNavigationWithReset("media");
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex flex-col items-center justify-center flex-1 py-2 px-3 rounded-lg transition-colors ${
                  currentPage === "media" ? "text-[#6C60FF] bg-[#6C60FF]/10" : "text-gray-500"
                }`}
              >
                <Camera className="w-8 h-8 mb-1" />
                <span className="text-xs font-medium">Media</span>
              </button>

              {/* Users tab - visible for all roles */}
              <button
                onClick={() => {
                  handleNavigation("users");
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex flex-col items-center justify-center flex-1 py-2 px-3 rounded-lg transition-colors ${
                  currentPage === "users" ? "text-[#6C60FF] bg-[#6C60FF]/10" : "text-gray-500"
                }`}
              >
                <Users className="w-8 h-8 mb-1" />
                <span className="text-xs font-medium">Users</span>
              </button>

              {/* Only show Apps if user role is NOT 3 */}
              {user?.role !== '3' && user?.role !== 3 && (
                <button
                  onClick={() => {
                    handleNavigation("apps");
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`flex flex-col items-center justify-center flex-1 py-2 px-3 rounded-lg transition-colors ${
                    currentPage === "apps" ? "text-[#6C60FF] bg-[#6C60FF]/10" : "text-gray-500"
                  }`}
                >
                  <Grid3x3 className="w-8 h-8 mb-1" />
                  <span className="text-xs font-medium">Apps</span>
                </button>
              )}
            </div>
          </nav>

          {/* Bottom Nav Camera Interface */}
          <CameraInterface
            isOpen={showBottomNavCamera}
            onClose={() => setShowBottomNavCamera(false)}
            onCapture={handleBottomNavCameraCapture}
          />
        </>
      )}

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        expand={true}
        richColors
        duration={4000}
        toastOptions={{
          unstyled: false,
          classNames: {
            error: 'border-red-400',
            success: 'border-green-400',
          },
          style: {
            background: 'white',
            color: '#374151',
            border: '1px solid #E5E7EB',
          },
        }}
      />

      {/* Leave Media Page Confirmation Dialog */}
      {showLeaveMediaDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={handleLeaveMediaCancel} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 mx-4 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Unsaved Changes</h3>
            <p className="text-sm text-gray-500 mb-6">You have pending changes. If you leave, you will lose the changes.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleLeaveMediaCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Stay
              </button>
              <button
                onClick={handleLeaveMediaConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collaborator Invite Modal - REMOVED */}

      {/* New User Upgrade Modal - shown once after activation until plan is selected */}
      <UpgradePlanModal
        isOpen={showNewUserUpgradeModal}
        onClose={() => {}}
        canClose={false}
        hideStarter={newUserHasProperties || !!currentProperty}
        onSuccess={() => {
          localStorage.removeItem('is_new_user');
          window.dispatchEvent(new Event('is_new_user_removed'));
          setShowNewUserUpgradeModal(false);
          checkLimit();
        }}
      />

      {/* Popup Blocked Guide Modal */}
      <PopupBlockedGuideModal
        isOpen={showPopupGuide}
        onClose={() => {
          setShowPopupGuide(false);
          setBlockedSessionInfo(null);
        }}
        onRetry={async () => {
          setShowPopupGuide(false);

          if (!blockedSessionInfo) {
            console.error('❌ No session info available for retry');
            toast.error('Session expired. Please try syncing again.');
            return;
          }

          // Retry opening the picker with the existing session
          console.log('🔄 Retrying with session:', blockedSessionInfo.sessionId);
          const result = await retryPickerWithSession(
            blockedSessionInfo.sessionId,
            blockedSessionInfo.pickerUri,
            blockedSessionInfo.accessToken,
            (importResult) => {
              if (importResult && importResult.success) {
                console.log('📸 Photos imported successfully:', importResult.count);
                toast.success(`Imported ${importResult.count} photos!`);
                window.location.reload();
              }
            }
          );

          // Check if popup is still blocked
          if (result && result.popupBlocked) {
            console.log('🚫 Popup still blocked after retry');
            setBlockedSessionInfo(result);
            setShowPopupGuide(true);
          } else if (result && result.success) {
            // Success! Clear the session info
            setBlockedSessionInfo(null);
          }
        }}
      />
    </div>
  );
}

// App wrapper (providers are now in main.tsx)
function PWAUpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;
    const id = setTimeout(() => {
      if (window.confirm('A new version of Stasht is available. Reload now to get the latest updates?')) {
        updateServiceWorker(true);
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [needRefresh, updateServiceWorker]);

  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <PWAUpdatePrompt />
      <MainApp />
    </ErrorBoundary>
  );
}