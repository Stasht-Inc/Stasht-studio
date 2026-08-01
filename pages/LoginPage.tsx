import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, LogIn, ArrowLeft, ArrowRight, Phone, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Checkbox } from "../components/ui/checkbox";
import StashtLogo from "../components/StashtLogo";
import CountrySelect from "../components/CountrySelect";
import { authAPI } from "../utils/authUtils";
import { googleAuthAPI } from "../utils/googleAuthAPI";
import { appleAuthAPI } from "../utils/appleAuthAPI";
import SessionValidator from "../utils/sessionValidator";
import { useGoogleLogin } from '@react-oauth/google';
import { toast } from 'sonner';
import { DeviceVerificationModal } from '../components/DeviceVerificationModal';
import { PopupBlockedGuideModal } from '../components/PopupBlockedGuideModal';
import { getInviteParams, isEmail, isPhoneNumber, isCorrectCollaborator } from '../utils/inviteUtils';
import { AccountChoiceModal, getAdminCollaborator, AdminCollaborator } from '../components/AccountChoiceModal';

interface LoginPageProps {
  onLogin: (email: string, password: string, phone_number?: string) => Promise<boolean>;
  onSwitchToSignup?: () => void;
  onSocialLogin?: (provider: 'google' | 'apple', providerId: string, email?: string, name?: string, accessToken?: string) => Promise<boolean>;
}

export default function LoginPage({ onLogin, onSwitchToSignup, onSocialLogin }: LoginPageProps) {
  // Track component renders
  console.log('🔄 ===== LoginPage: Component RENDER START =====');
  console.log('🔄 Render timestamp:', new Date().toISOString());

  const [email, setEmail] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const e = p.get('prefill_email') || p.get('email');
    return e ? decodeURIComponent(e) : '';
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [conflictError, setConflictError] = useState<{ message: string; currentUser?: any } | null>(null);
  const [method, setMethod] = useState<"phone" | "email">(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('prefill_email') || p.get('email')) return 'email';
    if (p.get('prefill_phone')) return 'phone';
    return 'phone';
  });
  const [phoneNumber, setPhoneNumber] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('prefill_phone') ? decodeURIComponent(p.get('prefill_phone')!) : '';
  });
  const [countryCode, setCountryCode] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('prefill_country_code') ? decodeURIComponent(p.get('prefill_country_code')!) : '+1';
  });
  const [isSocialLoginLoading, setIsSocialLoginLoading] = useState(false);
  const [showActivationError, setShowActivationError] = useState(false);
  const [isResendingActivation, setIsResendingActivation] = useState(false);
  const [resendActivationMessage, setResendActivationMessage] = useState("");
  const [resendActivationCooldown, setResendActivationCooldown] = useState(0);
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otp, setOtp] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  // Auth method: passwordless (OTP-only) for now. Kept as a constant so the password
  // path can be re-enabled later by restoring the toggle.
  const [authMode] = useState<"password" | "otp">("otp");
  // Seconds left before the current passwordless OTP expires (10 min). 0 = none active.
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [debugResponse, setDebugResponse] = useState<any>(null);

  // Device verification states
  const [showDeviceVerification, setShowDeviceVerification] = useState(false);
  const [verificationAttemptId, setVerificationAttemptId] = useState<number | null>(null);
  const [verificationDeviceInfo, setVerificationDeviceInfo] = useState<any>(null);

  // Locked collaborator state for invite links
  const [lockedCollaborator, setLockedCollaborator] = useState<string | null>(null);
  const [isCollaboratorLocked, setIsCollaboratorLocked] = useState(false);

  // Popup blocked guide modal state
  const [showPopupGuide, setShowPopupGuide] = useState(false);

  // Account choice modal state (for admin collaborators and properties)
  const [showAccountChoice, setShowAccountChoice] = useState(false);
  const [adminCollaborators, setAdminCollaborators] = useState<AdminCollaborator[]>([]);  // Changed to array
  const [ownedProperties, setOwnedProperties] = useState<any[]>([]);  // NEW: Owned properties
  const [sharedProperties, setSharedProperties] = useState<any[]>([]);  // NEW: Shared properties
  const [pendingLoginUser, setPendingLoginUser] = useState<any>(null);
  const [pendingLoginToken, setPendingLoginToken] = useState<string>('');


  // Clean prefill params from URL after they've been read by the lazy initializers
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('prefill_email') || p.get('prefill_phone') || p.get('prefill_country_code')) {
      p.delete('prefill_email');
      p.delete('prefill_phone');
      p.delete('prefill_country_code');
      const newUrl = window.location.pathname + (p.toString() ? '?' + p.toString() : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // DEBUG: Track state changes for account choice modal
  React.useEffect(() => {
    console.log('📊 STATE CHANGE DETECTED:', {
      timestamp: new Date().toISOString(),
      ownedProperties: ownedProperties.length,
      sharedProperties: sharedProperties.length,
      showAccountChoice,
      pendingLoginUser: !!pendingLoginUser,
      adminCollaborators: adminCollaborators.length,
      shouldShowModal: (adminCollaborators.length > 0 || ownedProperties.length > 0 || sharedProperties.length > 0) && !!pendingLoginUser
    });
  }, [ownedProperties, sharedProperties, showAccountChoice, pendingLoginUser, adminCollaborators]);

  // Check for collaborator invite parameter on mount - RUNS FIRST
  // NOTE: This MUST run before magic link check to handle invite flow properly
  React.useEffect(() => {
    // ============================================================
    // STEP 1: Check for logged-in user vs invite mismatch FIRST
    // ============================================================
    console.log('🔍 [LoginPage] === MISMATCH CHECK START ===');

    // ABSOLUTE FIRST CHECK: Recent login timestamp (60 second protection window)
    const lastLoginTimestamp = localStorage.getItem('last_successful_login_timestamp');
    if (lastLoginTimestamp) {
      const timeSinceLogin = Date.now() - parseInt(lastLoginTimestamp);
      const withinProtectionWindow = timeSinceLogin < 60000; // 60 seconds

      if (withinProtectionWindow) {
        console.log('🔒 [LoginPage] LOGIN TIMESTAMP PROTECTION - User logged in', timeSinceLogin, 'ms ago');
        console.log('🔒 [LoginPage] SKIPPING MISMATCH CHECK - Protection window active');
        return; // EXIT - Absolutely NO logout within 60 seconds of login
      }
    }

    // ============================================================
    // PRIORITY CHECK: login=0 should ALWAYS redirect to signup FIRST
    // ============================================================
    const urlParams = new URLSearchParams(window.location.search);
    const loginParam = urlParams.get('login');

    if (loginParam === '0') {
      console.log('🔍 [LoginPage] ⚡ PRIORITY: login=0 detected, immediately redirecting to signup...');

      // Set sessionStorage flag to tell App.tsx to show SignupPage
      sessionStorage.setItem('force_show_signup', 'true');
      console.log('🔍 [LoginPage] Set force_show_signup flag in sessionStorage');

      if (onSwitchToSignup) {
        onSwitchToSignup();
        console.log('🔍 [LoginPage] ✅ onSwitchToSignup() called successfully');
      } else {
        console.warn('🔍 [LoginPage] ⚠️ onSwitchToSignup not available');
      }
      return;
    }

    // Get current logged-in user from localStorage
    const loggedInUserStr = localStorage.getItem('stasht_user');
    let loggedInUser = null;
    if (loggedInUserStr) {
      try {
        loggedInUser = JSON.parse(loggedInUserStr);
        console.log('🔍 [LoginPage] Found logged-in user:', loggedInUser?.email || loggedInUser?.phone_number);
      } catch (e) {
        console.error('Failed to parse logged-in user:', e);
      }
    }

    // Get invite params from URL or storage
    let inviteCollaborator = null;
    const urlInviteParams = getInviteParams();
    if (urlInviteParams && urlInviteParams.collaborator) {
      inviteCollaborator = urlInviteParams.collaborator;
      console.log('🔍 [LoginPage] Found invite in URL:', inviteCollaborator);
    } else {
      // Check storage
      const storedInvite = sessionStorage.getItem('pendingInvite') || localStorage.getItem('pendingInvite');
      if (storedInvite) {
        try {
          const parsed = JSON.parse(storedInvite);
          inviteCollaborator = parsed.collaborator;
          console.log('🔍 [LoginPage] Found invite in storage:', inviteCollaborator);
        } catch (e) {
          console.error('Failed to parse stored invite:', e);
        }
      }
    }

    // If both exist, check for mismatch
    if (loggedInUser && inviteCollaborator) {
      const loggedInIdentifier = loggedInUser.email || loggedInUser.phone_number;

      // Use isCorrectCollaborator for proper email/phone comparison with decoding
      const isCorrect = isCorrectCollaborator(loggedInIdentifier, inviteCollaborator);
      const isMismatch = !isCorrect;

      console.log('🔍 [LoginPage] Comparing:', {
        loggedIn: loggedInIdentifier,
        invited: inviteCollaborator,
        isCorrect,
        mismatch: isMismatch
      });

      if (isMismatch) {
        console.log('🚪 [LoginPage] MISMATCH DETECTED - Auto-logout wrong user');

        // Clear user session but KEEP invite params
        localStorage.removeItem('stasht_user');
        localStorage.removeItem('stasht_token');
        sessionStorage.removeItem('stasht_session');

        // Ensure invite params are in localStorage for persistence
        if (urlInviteParams && urlInviteParams.collaborator) {
          localStorage.setItem('pendingInvite', JSON.stringify(urlInviteParams));
          console.log('💾 [LoginPage] Saved invite params to localStorage');
        }

        // Set flag to prevent clearing
        sessionStorage.setItem('just_logged_out_for_invite', 'true');

        console.log('✅ [LoginPage] Auto-logout complete - user can now login with invited credentials');

        // Don't reload, just let the page continue to prefill
      }
    }

    console.log('🔍 [LoginPage] === MISMATCH CHECK END ===');

    // ============================================================
    // STEP 2: Normal invite flow logic
    // ============================================================
    const isInviteUrl = urlInviteParams && urlInviteParams.invite === '1';
    const justLoggedOutForInvite = sessionStorage.getItem('just_logged_out_for_invite') === 'true';

    console.log('🔍 [LoginPage] Is invite URL?', isInviteUrl);
    console.log('🔍 [LoginPage] Just logged out for invite?', justLoggedOutForInvite);

    // If NO invite params in URL, clear stored invite data UNLESS flag is set
    // The flag means user was just logged out for wrong invite (active invite flow)
    // This allows users to "escape" by typing fresh URL, but preserves invite during logout flow
    if (!isInviteUrl && !justLoggedOutForInvite) {
      const hasPendingInvite = sessionStorage.getItem('pendingInvite') || localStorage.getItem('pendingInvite');
      if (hasPendingInvite) {
        console.log('🗑️ [LoginPage] No invite in URL and no flag - clearing stored invite params (user escaped)');
        sessionStorage.removeItem('pendingInvite');
        localStorage.removeItem('pendingInvite');
      }
    } else if (justLoggedOutForInvite) {
      console.log('🚩 [LoginPage] Flag is set - keeping stored invite params (just logged out for invite)');
    }

    // Check THREE sources in priority order:
    // 1. URL parameters (highest priority - fresh invite link)
    // 2. sessionStorage (active session)
    // 3. localStorage (persists after logout - for wrong user scenario)

    let inviteParams = urlInviteParams;
    let source = 'URL';

    if (!inviteParams || !inviteParams.collaborator) {
      // Try sessionStorage
      const sessionInvite = sessionStorage.getItem('pendingInvite');
      if (sessionInvite) {
        try {
          inviteParams = JSON.parse(sessionInvite);
          source = 'sessionStorage';
        } catch (e) {
          console.error('Failed to parse sessionStorage invite:', e);
        }
      }
    }

    if (!inviteParams || !inviteParams.collaborator) {
      // Try localStorage (critical for post-logout scenario)
      const localInvite = localStorage.getItem('pendingInvite');
      if (localInvite) {
        try {
          inviteParams = JSON.parse(localInvite);
          source = 'localStorage';
        } catch (e) {
          console.error('Failed to parse localStorage invite:', e);
        }
      }
    }

    console.log('🔍 [LoginPage] Checking invite params from', source, ':', inviteParams);

    if (inviteParams && inviteParams.collaborator) {
      const collaboratorValue = inviteParams.collaborator;
      console.log('🔒 [LoginPage] Invite detected - locking collaborator field:', collaboratorValue);
      console.log('🔒 [LoginPage] Collaborator value type check - contains @?', collaboratorValue.includes('@'));

      // CRITICAL: Set lock state FIRST before changing method/values
      // This prevents other effects from clearing the fields
      setLockedCollaborator(collaboratorValue);
      setIsCollaboratorLocked(true);

      // Use setTimeout to ensure isCollaboratorLocked is set before method changes
      setTimeout(() => {
        // Determine if it's email or phone and set the appropriate method and value
        if (isEmail(collaboratorValue)) {
          console.log('🔒 [LoginPage] Detected as EMAIL, setting method to email');
          setMethod('email');
          setEmail(collaboratorValue);
          console.log('🔒 [LoginPage] Locked to EMAIL:', collaboratorValue);
        } else if (isPhoneNumber(collaboratorValue)) {
          console.log('🔒 [LoginPage] Detected as PHONE, setting method to phone');
          setMethod('phone');

          // Parse phone number - extract country code if present
          // List of known country codes (from CountrySelect component)
          const knownCountryCodes = ['+91', '+1', '+44', '+86', '+61', '+33', '+49', '+81'];

          let foundCountryCode = null;
          let phoneNumberPart = collaboratorValue;

          // Try to match against known country codes first (most reliable)
          for (const code of knownCountryCodes) {
            if (collaboratorValue.startsWith(code)) {
              foundCountryCode = code;
              phoneNumberPart = collaboratorValue.slice(code.length);
              break;
            }
          }

          if (foundCountryCode) {
            setCountryCode(foundCountryCode);
            setPhoneNumber(phoneNumberPart);
            console.log('🔒 [LoginPage] Locked to PHONE (known country code):', foundCountryCode, phoneNumberPart);
          } else {
            // Fallback: Try generic regex for other country codes
            const phoneMatch = collaboratorValue.match(/^(\+\d{1,4})(\d+)$/);
            if (phoneMatch) {
              setCountryCode(phoneMatch[1]);
              setPhoneNumber(phoneMatch[2]);
              console.log('🔒 [LoginPage] Locked to PHONE (regex fallback):', phoneMatch[1], phoneMatch[2]);
            } else {
              // No country code, use as-is (remove any + if present)
              const cleanPhone = collaboratorValue.replace(/^\+/, '');
              setPhoneNumber(cleanPhone);
              console.log('🔒 [LoginPage] Locked to PHONE (no country code):', cleanPhone);
            }
          }
        }

        // DON'T clear flag here - keep it until successful login
        // This protects invite params when navigating between login/signup pages
      }, 0);
    } else {
      console.log('🔍 [LoginPage] No invite params found, checking saved preferences...');
      // Only load saved login method preference if NOT an invite flow
      // Try to find any saved login method preference in localStorage
      const savedLoginMethods = Object.keys(localStorage).filter(key =>
        key.startsWith('stasht_login_method_')
      );

      if (savedLoginMethods.length > 0) {
        // Get the most recently used login method
        const lastKey = savedLoginMethods[savedLoginMethods.length - 1];
        const savedMethod = localStorage.getItem(lastKey);

        if (savedMethod === 'email' || savedMethod === 'phone') {
          console.log('🔍 [LoginPage] Setting method from saved preference:', savedMethod);
          setMethod(savedMethod);
        }
      }
    }
  }, []);

  // Check for magic link email/phone prefill - RUNS AFTER INVITE CHECK
  React.useEffect(() => {
    console.log('🔗🔗🔗 [LoginPage] Magic Link Check - START');
    console.log('🔗 [LoginPage] window.location.href:', window.location.href);
    console.log('🔗 [LoginPage] window.location.search:', window.location.search);
    console.log('🔗 [LoginPage] isCollaboratorLocked:', isCollaboratorLocked);

    // Skip if collaborator is already locked from invite flow
    if (isCollaboratorLocked) {
      console.log('🔗 [LoginPage] Collaborator is locked from invite, skipping magic link check');
      return;
    }

    // FIRST: Try to get email directly from URL (most reliable)
    const urlParams = new URLSearchParams(window.location.search);
    const emailFromUrl = urlParams.get('email');
    const phoneFromUrl = urlParams.get('phone');

    console.log('🔗 [LoginPage] Email from URL params:', emailFromUrl);
    console.log('🔗 [LoginPage] Phone from URL params:', phoneFromUrl);

    // SECOND: Try sessionStorage (in case App.tsx or main.tsx already stored it)
    const emailFromStorage = sessionStorage.getItem('pending_magic_link_email') || sessionStorage.getItem('magic_link_email');
    const phoneFromStorage = sessionStorage.getItem('pending_magic_link_phone');

    console.log('🔗 [LoginPage] Email from sessionStorage:', emailFromStorage);
    console.log('🔗 [LoginPage] Phone from sessionStorage:', phoneFromStorage);

    // Use whichever is available (URL takes priority)
    const magicLinkEmail = emailFromUrl || emailFromStorage;
    const magicLinkPhone = phoneFromUrl || phoneFromStorage;

    if (magicLinkEmail) {
      console.log('🔗 [LoginPage] ✅✅✅ FOUND magic link email, prefilling:', magicLinkEmail);

      // Decode if needed (URL might have %40 for @)
      const decodedEmail = decodeURIComponent(magicLinkEmail);
      console.log('🔗 [LoginPage] Decoded email:', decodedEmail);

      setEmail(decodedEmail);
      setMethod('email'); // Switch to email method

      // Store it in sessionStorage for consistency (in case it came from URL)
      if (emailFromUrl) {
        sessionStorage.setItem('pending_magic_link_email', decodedEmail);
      }

      console.log('🔗 [LoginPage] Email field set to:', decodedEmail);
      console.log('🔗 [LoginPage] Method set to: email');
    } else if (magicLinkPhone) {
      console.log('🔗 [LoginPage] ✅✅✅ FOUND magic link phone, prefilling:', magicLinkPhone);

      // Decode if needed
      const decodedPhone = decodeURIComponent(magicLinkPhone);
      console.log('🔗 [LoginPage] Decoded phone:', decodedPhone);

      // Extract country code and phone number if the phone starts with +
      if (decodedPhone.startsWith('+')) {
        // Common country codes (1-3 digits after +)
        const countryCodeMatch = decodedPhone.match(/^(\+\d{1,3})/);
        if (countryCodeMatch) {
          const extractedCountryCode = countryCodeMatch[1];
          const extractedPhoneNumber = decodedPhone.slice(extractedCountryCode.length);

          setCountryCode(extractedCountryCode);
          setPhoneNumber(extractedPhoneNumber);
          console.log('🔗 [LoginPage] Extracted country code:', extractedCountryCode);
          console.log('🔗 [LoginPage] Extracted phone number:', extractedPhoneNumber);
        } else {
          setPhoneNumber(decodedPhone);
        }
      } else {
        setPhoneNumber(decodedPhone);
      }

      setMethod('phone'); // Switch to phone method

      // Store it in sessionStorage for consistency (in case it came from URL)
      if (phoneFromUrl) {
        sessionStorage.setItem('pending_magic_link_phone', decodedPhone);
      }

      console.log('🔗 [LoginPage] Phone field set');
      console.log('🔗 [LoginPage] Method set to: phone');
    } else {
      console.log('🔗 [LoginPage] ❌ No magic link email or phone found');
    }

    console.log('🔗🔗🔗 [LoginPage] Magic Link Check - END');
  }, [isCollaboratorLocked]);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordPhone, setForgotPasswordPhone] = useState("");
  const [forgotPasswordCountryCode, setForgotPasswordCountryCode] = useState("+1");
  const [forgotPasswordMethod, setForgotPasswordMethod] = useState<"email" | "phone">("email");
  const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState("");
  const [forgotPasswordError, setForgotPasswordError] = useState("");

  // Resend activation cooldown timer
  React.useEffect(() => {
    if (resendActivationCooldown > 0) {
      const timer = setTimeout(() => {
        setResendActivationCooldown(resendActivationCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendActivationCooldown]);

  // OTP expiry countdown (10 minutes)
  React.useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  // Clear fields when method changes to prevent autofill contamination (but not when locked)
  React.useEffect(() => {
    if (!isCollaboratorLocked) {
      if (method === "phone") {
        setEmail("");
        // Also clear the phone input field directly in the DOM to prevent autofill
        const phoneInput = document.getElementById('login-phone-input') as HTMLInputElement;
        if (phoneInput) {
          phoneInput.value = '';
        }
      } else {
        setPhoneNumber("");
      }
    }
  }, [method, isCollaboratorLocked]);

  // Additional effect to clear phone field on mount if phone method is selected (but not when locked)
  React.useEffect(() => {
    if (!isCollaboratorLocked && method === "phone") {
      const phoneInput = document.getElementById('login-phone-input') as HTMLInputElement;
      if (phoneInput && phoneInput.value && phoneInput.value.includes('@')) {
        // If the field contains an @ symbol (email), clear it
        phoneInput.value = '';
        setPhoneNumber('');
      }
    }
  }, [method, phoneNumber, isCollaboratorLocked]);

  // Passwordless login: validate identifier -> send OTP -> show OTP screen.
  // Verification happens in handleVerifyOtp.
  const handleSendOtpForLogin = async () => {
    if (method === "phone" ? !phoneNumber : !email) {
      setError(method === "phone" ? "Please enter your phone number" : "Please enter your email");
      return;
    }

    setIsLoading(true);
    setError("");
    setConflictError(null);
    setShowActivationError(false);
    setResendActivationMessage("");

    try {
      const identifier = method === "email"
        ? { email }
        : { phone_number: `${countryCode}${phoneNumber}` };

      const res = await authAPI.sendOtp(identifier, 'login');

      if (res.success) {
        setShowOtpScreen(true);
        setOtp('');
        setOtpError('');
        setOtpCountdown(600);            // 10 minute expiry
        setResendActivationCooldown(60); // 60s before resend allowed
      } else {
        // No account / any failure → stay on login and show the backend message
        setError(res.error || 'Failed to send OTP. Please try again.');
      }
    } catch (err) {
      console.error('Send OTP (login) error:', err);
      setError('Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Shared post-login handling — runs identically for password login and passwordless
  // OTP login (the response shape from authAPI.login is the same either way).
  // Handles: account-choice modal, properties, session setup, change-password,
  // invite-login redirect, deep-link redirect, and the normal redirect.
  const finalizeLoginSuccess = (response: any) => {
        console.log('✅ Login successful, storing auth data...');

        // 1. Get admin collaborators (other users' accounts)
        const collaborators = response.data?.data?.collaborators || response.data?.collaborators || response.collaborators || [];
        const adminCollaboratorsFromAPI = getAdminCollaborator(collaborators);

        // 1b. Get partial admin access entries and convert to AdminCollaborator format
        const partialAdminRaw = response.partial_admin_access || response.data?.partial_admin_access || response.data?.data?.partial_admin_access || [];
        const partialAdminCollaborators: AdminCollaborator[] = partialAdminRaw.map((entry: any) => ({
          owner_id: String(entry.owner_id),
          memory_id: null,
          role: 'partial_admin',
          user_id: String(entry.owner?.id || entry.owner_id),
          owner_name: entry.owner?.name || '',
          owner_email: entry.owner?.email || '',
          owner: entry.owner,
          isPartialAdmin: true,
        }));

        const allAdminCollaborators = [...adminCollaboratorsFromAPI, ...partialAdminCollaborators];

        // 2. Get owned and shared properties from new API structure
        const ownedProperties = response.data?.owned_properties || response.owned_properties || [];
        const sharedProperties = response.data?.shared_properties || response.shared_properties || [];

        // 3. Fallback: Get properties from old structure (if owned/shared not available)
        let allProperties = [...ownedProperties, ...sharedProperties];
        if (allProperties.length === 0) {
          const oldProperties = response.data?.data?.properties || response.data?.properties || response.properties || [];
          allProperties = oldProperties;
        }

        // 4. Check if user should see account choice modal
        const hasAdminCollaborators = allAdminCollaborators.length > 0;
        const hasProperties = ownedProperties.length > 0 || sharedProperties.length > 0;
        const shouldShowAccountChoice = hasAdminCollaborators || hasProperties;

        console.log('🔐 LoginPage: Account choice check:', { hasAdminCollaborators, hasProperties, shouldShowAccountChoice });

        if (shouldShowAccountChoice) {
          // If this is an invite login, save flag so App.tsx redirects to /stories after account choice
          const urlParamsCheck = new URLSearchParams(window.location.search);
          if (urlParamsCheck.get('invite') === '1' && urlParamsCheck.get('memory_id')) {
            sessionStorage.setItem('invite_redirect_to_stories', 'true');
          }
          // DON'T store auth data yet - wait for user to choose account
          setPendingLoginUser(response.user);
          setPendingLoginToken(response.token);
          setAdminCollaborators(allAdminCollaborators);
          setOwnedProperties(ownedProperties);
          setSharedProperties(sharedProperties);
          setShowAccountChoice(true);
          setIsLoading(false);
          setIsVerifyingOtp(false); // stop OTP spinner if we came from the passwordless path
          return;
        }

        // No admin collaborator - normal flow
        // Store auth data directly (same as AuthContext does)
        localStorage.setItem('stasht_user', JSON.stringify(response.user));
        localStorage.setItem('stasht_token', response.token);

        // Initialize session validator
        const userIdentifier = response.user.email || response.user.phone_number;
        if (response.user.id && userIdentifier) {
          SessionValidator.initSession(response.user.id, userIdentifier, response.token);
        }

        // Save login method preference
        const methodIdentifier = method === "email" ? email : `${countryCode}${phoneNumber}`;
        localStorage.setItem(`stasht_login_method_${methodIdentifier}`, method);
        console.log('✅ Saved login method preference:', method);

        // CRITICAL: Set login timestamp in localStorage to prevent ANY logout for 60 seconds
        localStorage.setItem('last_successful_login_timestamp', String(Date.now()));
        console.log('🔒 PROTECTED: Set login timestamp to prevent logout for 60 seconds');

        // Check if user needs to change password (temporary password flow)
        if (response.user.change_password === 1) {
          // Store the current password they just used (temporary password).
          // Passwordless (OTP) login has no typed password — we still set the flag.
          if (password) {
            sessionStorage.setItem('temp_current_password', password);
          }
          sessionStorage.setItem('require_password_change', 'true');
          console.log('🔑 Set require_password_change flag');
        }

        // Check if this is an invite login - navigate to invited memory
        const urlParams = new URLSearchParams(window.location.search);
        const isInviteLogin = urlParams.get('invite') === '1' && urlParams.get('login') === '1';
        const inviteMemoryId = urlParams.get('memory_id');
        const inviteCollaborator = urlParams.get('collaborator');

        // CRITICAL: Clear ALL invite-related data from storage FIRST
        sessionStorage.removeItem('pendingInvite');
        localStorage.removeItem('pendingInvite');
        sessionStorage.removeItem('just_logged_out_for_invite');

        if (isInviteLogin && inviteMemoryId) {
          // CRITICAL: Set IMMEDIATE protection flags BEFORE any redirect
          const protectionData = {
            completed: true,
            timestamp: Date.now(),
            userIdentifier: userIdentifier,
            collaborator: inviteCollaborator,
            memoryId: inviteMemoryId
          };
          localStorage.setItem('invite_login_completed', JSON.stringify(protectionData));
          sessionStorage.setItem('invite_login_completed', JSON.stringify(protectionData));
          localStorage.setItem('SKIP_ALL_MISMATCH_CHECKS', 'true');
          sessionStorage.setItem('SKIP_ALL_MISMATCH_CHECKS', 'true');

          console.log('🔄 Invite login successful - redirecting to campaigns page NOW');
          window.location.replace('/stories?from_invite_login=1');
        } else {
          // Check for pending deep link redirect
          const pendingDeepLink = sessionStorage.getItem('pendingDeepLink');
          if (pendingDeepLink) {
            try {
              const deepLinkData = JSON.parse(pendingDeepLink);
              sessionStorage.removeItem('pending_magic_link_email');
              sessionStorage.removeItem('pending_magic_link_phone');
              const redirectUrl = `/memories/${deepLinkData.memoryId}?image=${deepLinkData.imageId}&userId=${deepLinkData.userId}`;
              window.location.replace(redirectUrl);
            } catch (err) {
              console.error('❌ Failed to parse pending deep link:', err);
              sessionStorage.removeItem('pendingDeepLink');
              window.location.replace('/');
            }
          } else {
            // Regular login - reload page
            window.location.replace('/');
          }
        }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Passwordless path — no password, verify via OTP instead
    if (authMode === "otp") {
      await handleSendOtpForLogin();
      return;
    }

    // Validate based on selected method
    if (method === "phone") {
      if (!phoneNumber || !password) {
        setError("Please fill in all fields");
        return;
      }
    } else {
      if (!email || !password) {
        setError("Please fill in all fields");
        return;
      }
    }

    setIsLoading(true);
    setError("");
    setConflictError(null);
    setShowActivationError(false);
    setResendActivationMessage("");

    try {
      console.log('🔍 LoginPage: Starting login - calling authAPI directly...');

      // Call authAPI directly instead of going through onLogin
      const emailParam = method === "email" ? email : "";
      const phoneParam = method === "phone" ? `${countryCode}${phoneNumber}` : undefined;

      console.log('🔍 LoginPage: Login params:', { email: emailParam, phone_number: phoneParam });

      const response = await authAPI.login({
        email: emailParam,
        password,
        phone_number: phoneParam
      });

      console.log('🔍 LoginPage: API Response:', response);

      // ====== DETAILED LOGIN RESPONSE LOGGING ======
      console.log('🔍 ========================================');
      console.log('🔍 FULL LOGIN API RESPONSE:');
      console.log('🔍 ========================================');
      console.log('🔍 response:', JSON.stringify(response, null, 2));
      console.log('🔍 response.success:', response.success);
      console.log('🔍 response.user:', response.user);
      console.log('🔍 response.token:', response.token ? 'EXISTS' : 'MISSING');
      console.log('🔍 response.data:', response.data);
      console.log('🔍 response.data.data:', response.data?.data);
      console.log('🔍 ========================================');
      console.log('🔍 CHECKING FOR PROPERTIES:');
      console.log('🔍 ========================================');
      console.log('🔍 response.owned_properties:', response.owned_properties);
      console.log('🔍 response.shared_properties:', response.shared_properties);
      console.log('🔍 response.properties:', response.properties);
      console.log('🔍 response.data.owned_properties:', response.data?.owned_properties);
      console.log('🔍 response.data.shared_properties:', response.data?.shared_properties);
      console.log('🔍 response.data.properties:', response.data?.properties);
      console.log('🔍 response.data.data.owned_properties:', response.data?.data?.owned_properties);
      console.log('🔍 response.data.data.shared_properties:', response.data?.data?.shared_properties);
      console.log('🔍 response.data.data.properties:', response.data?.data?.properties);
      console.log('🔍 ========================================');
      console.log('🔍 CHECKING FOR COLLABORATORS:');
      console.log('🔍 ========================================');
      console.log('🔍 response.collaborators:', response.collaborators);
      console.log('🔍 response.data.collaborators:', response.data?.collaborators);
      console.log('🔍 response.data.data.collaborators:', response.data?.data?.collaborators);
      console.log('🔍 ========================================');

      // Check for activation error FIRST
      if (response.requiresActivation === true) {
        console.log('✅✅✅ ACTIVATION REQUIRED - Setting UI states');
        const errorMessage = response.message || response.error || 'Please activate your account before logging in.';

        setIsLoading(false);
        setShowActivationError(true);
        setError(errorMessage);

        console.log('✅ States set:', {
          showActivationError: true,
          error: errorMessage,
          isLoading: false
        });
        return; // Don't continue with login
      }

      // Check for device verification requirement
      if (response.requires_verification === true && response.attempt_id) {
        console.log('🔐 Device verification required - showing OTP modal');
        console.log('🔐 Attempt ID:', response.attempt_id);
        console.log('🔐 Device Info:', response.device_info);

        setVerificationAttemptId(response.attempt_id);
        setVerificationDeviceInfo(response.device_info || {});
        setShowDeviceVerification(true);
        setIsLoading(false);
        return; // Don't continue with login
      }

      // If success, hand off to the shared post-login handler
      // (account choice, properties, redirects) — identical for password & OTP login
      if (response.success && response.user && response.token) {
        finalizeLoginSuccess(response);
      } else {
        // Login failed for other reasons
        console.log('❌ Login failed:', response.error);
        setError(response.error || (method === "phone" ? "Invalid phone number or password" : "Invalid email or password"));
        setIsLoading(false);
      }

    } catch (err) {
      console.log('🔍 LoginPage: Caught exception:', err);
      const errorMessage = err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const handleDeviceVerified = async (user: any, token: string, collaborators?: any[], responseData?: any) => {
    console.log('✅ Device verified successfully, storing auth data...');
    console.log('🔍 LoginPage: Device verification - responseData:', responseData);

    // CRITICAL: Set login timestamp in localStorage to prevent ANY logout for 60 seconds
    const loginTimestamp = Date.now();
    localStorage.setItem('last_successful_login_timestamp', String(loginTimestamp));
    console.log('🔒 PROTECTED: Set login timestamp to prevent logout for 60 seconds');


    // Check if user needs to change password (temporary password flow)
    if (user.change_password === 1) {
      console.log('🔑 [Device Verified] User needs to change password - setting up redirect to profile settings');
      console.log('🔑 [Device Verified] Login method:', method);
      console.log('🔑 [Device Verified] Password value:', password ? `[${password.length} chars]` : 'EMPTY');

      // Store the current password they just used (temporary password)
      if (password) {
        sessionStorage.setItem('temp_current_password', password);
        console.log('🔑 [Device Verified] ✅ Stored temp password in sessionStorage');
      } else {
        console.error('🔑 [Device Verified] ❌ ERROR: Password is empty, cannot store!');
      }

      // Set flag to trigger redirect to profile settings
      sessionStorage.setItem('require_password_change', 'true');
      console.log('🔑 [Device Verified] Set require_password_change flag');

      // Verify it was stored
      const stored = sessionStorage.getItem('temp_current_password');
      console.log('🔑 [Device Verified] Verification - stored password:', stored ? `[${stored.length} chars]` : 'NOT FOUND');
    }

    // Clear pending invite params from storage (if they exist)
    sessionStorage.removeItem('pendingInvite');
    localStorage.removeItem('pendingInvite');
    sessionStorage.removeItem('just_logged_out_for_invite');
    console.log('🗑️ Cleared pending invite params from storage');

    // Close device verification modal
    setShowDeviceVerification(false);

    // 1. Get admin collaborators — same multi-path logic as normal login
    const dvCollaborators = collaborators || responseData?.data?.collaborators || responseData?.collaborators || [];
    const adminCollaboratorsFromAPI = getAdminCollaborator(dvCollaborators);
    console.log('🔍 LoginPage: Admin collaborators after device verification:', adminCollaboratorsFromAPI.length);

    // 1b. Get partial admin access entries
    const partialAdminRawDV = responseData?.partial_admin_access || responseData?.data?.partial_admin_access || [];
    const partialAdminCollaboratorsDV: AdminCollaborator[] = partialAdminRawDV.map((entry: any) => ({
      owner_id: String(entry.owner_id),
      memory_id: null,
      role: 'partial_admin',
      user_id: String(entry.owner?.id || entry.owner_id),
      owner_name: entry.owner?.name || '',
      owner_email: entry.owner?.email || '',
      owner: entry.owner,
      isPartialAdmin: true,
    }));
    const allAdminCollaboratorsDV = [...adminCollaboratorsFromAPI, ...partialAdminCollaboratorsDV];

    // 2. Extract owned/shared properties — same logic as normal login
    const dvOwnedProperties = responseData?.owned_properties || responseData?.data?.owned_properties || [];
    const dvSharedProperties = responseData?.shared_properties || responseData?.data?.shared_properties || [];

    // Fallback to old structure if owned/shared not present
    let dvAllProperties = [...dvOwnedProperties, ...dvSharedProperties];
    if (dvAllProperties.length === 0) {
      dvAllProperties = responseData?.data?.properties || responseData?.properties || [];
    }

    console.log('🔍 LoginPage: DV owned properties:', dvOwnedProperties.length);
    console.log('🔍 LoginPage: DV shared properties:', dvSharedProperties.length);

    // 3. Check if should show account choice — same condition as normal login
    const hasAdminCollaboratorsDV = allAdminCollaboratorsDV.length > 0;
    const hasPropertiesDV = dvOwnedProperties.length > 0 || dvSharedProperties.length > 0;
    const shouldShowAccountChoiceDV = hasAdminCollaboratorsDV || hasPropertiesDV;

    console.log('🔐 LoginPage: Device verification account choice check:', { hasAdminCollaboratorsDV, hasPropertiesDV, shouldShowAccountChoiceDV });

    if (shouldShowAccountChoiceDV) {
      setPendingLoginUser(user);
      setPendingLoginToken(token);
      setAdminCollaborators(allAdminCollaboratorsDV);
      setOwnedProperties(dvOwnedProperties);
      setSharedProperties(dvSharedProperties);
      setShowAccountChoice(true);
      return;
    }

    // No admin accounts - safe to store auth data now (won't trigger redirect before modal)
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('stasht_token', token);

    // Initialize session validator
    const userIdentifier = user.email || user.phone_number;
    if (user.id && userIdentifier) {
      SessionValidator.initSession(user.id, userIdentifier, token);
    }

    // Save login method preference
    const methodIdentifier = method === "email" ? email : `${countryCode}${phoneNumber}`;
    localStorage.setItem(`stasht_login_method_${methodIdentifier}`, method);
    console.log('✅ Saved login method preference:', method);

    // No admin collaborator - check if invite login
    const urlParams = new URLSearchParams(window.location.search);
    const isInviteLogin = urlParams.get('invite') === '1' && urlParams.get('login') === '1';
    const inviteMemoryId = urlParams.get('memory_id');

    if (isInviteLogin && inviteMemoryId) {
      // CRITICAL: Set multiple flags to prevent ANY logout after successful login
      sessionStorage.setItem('invite_login_success', 'true');
      sessionStorage.setItem('invite_login_timestamp', String(Date.now()));
      sessionStorage.setItem('just_completed_invite_login', 'true');
      console.log('🚩 Set invite_login_success flags with timestamp to prevent ANY logout');
      console.log('🚩 Timestamp:', Date.now());

      // Navigate directly to campaigns page with special parameter
      // The from_invite_login parameter tells App to skip ALL logout checks
      console.log('🔄 Invite login successful - redirecting to campaigns page');

      // CRITICAL: Add from_invite_login parameter to URL for guaranteed detection
      setTimeout(() => {
        console.log('🔄 Executing redirect to campaigns page with from_invite_login flag...');
        window.location.replace('/stories?from_invite_login=1');
      }, 200);
    } else {
      // Check for pending deep link redirect
      const pendingDeepLink = sessionStorage.getItem('pendingDeepLink');
      if (pendingDeepLink) {
        try {
          const deepLinkData = JSON.parse(pendingDeepLink);
          console.log('🔗 Deep link found after device verification:', deepLinkData);

          // IMPORTANT: Don't clear pendingDeepLink - let App.tsx useEffect handle it after redirect
          // Only clear the email/phone prefill data
          sessionStorage.removeItem('pending_magic_link_email');
          sessionStorage.removeItem('pending_magic_link_phone');

          // Redirect to the memory page with image parameter
          const redirectUrl = `/memories/${deepLinkData.memoryId}?image=${deepLinkData.imageId}&userId=${deepLinkData.userId}`;
          console.log('🔗 Redirecting to deep link (keeping pendingDeepLink for App.tsx):', redirectUrl);
          window.location.replace(redirectUrl);
        } catch (err) {
          console.error('❌ Failed to parse pending deep link:', err);
          // Clear on error
          sessionStorage.removeItem('pendingDeepLink');
          // Fallback to regular login
          console.log('🔄 Reloading page to complete login...');
          window.location.replace('/');
        }
      } else {
        // Regular login - reload page
        console.log('🔄 Reloading page to complete login...');
        window.location.replace('/');
      }
    }
  };

  const handleMethodChange = (newMethod: "phone" | "email") => {
    setMethod(newMethod);
    // Clear fields when switching methods
    setEmail("");
    setPhoneNumber("");
    setError("");
    setConflictError(null);
    setPassword(""); // Also clear password to prevent cross-contamination
  };

  const handleDemoLogin = () => {
    setEmail("demo@stashtstudio.com");
    setPassword("demo123");
  };

  const handleForgotPasswordClick = () => {
    setShowForgotPassword(true);
    // Pre-fill with current login credentials
    if (method === "email") {
      setForgotPasswordEmail(email);
      setForgotPasswordMethod("email");
    } else {
      setForgotPasswordPhone(phoneNumber);
      setForgotPasswordCountryCode(countryCode);
      setForgotPasswordMethod("phone");
    }
    setForgotPasswordError("");
    setForgotPasswordMessage("");
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setForgotPasswordEmail("");
    setForgotPasswordPhone("");
    setForgotPasswordCountryCode("+1");
    setForgotPasswordMethod("email");
    setForgotPasswordError("");
    setForgotPasswordMessage("");
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate based on selected method
    if (forgotPasswordMethod === "email") {
      if (!forgotPasswordEmail) {
        setForgotPasswordError("Please enter your email address");
        return;
      }
    } else {
      if (!forgotPasswordPhone) {
        setForgotPasswordError("Please enter your phone number");
        return;
      }
    }

    setIsForgotPasswordLoading(true);
    setForgotPasswordError("");
    setForgotPasswordMessage("");

    try {
      let response;

      if (forgotPasswordMethod === "email") {
        response = await authAPI.resetPassword(forgotPasswordEmail);

        if (response.success) {
          setForgotPasswordMessage("A temporary password has been sent to your email address. Please check your inbox.");
        } else {
          setForgotPasswordError(response.error || "Failed to send reset email. Please try again.");
        }
      } else {
        // Phone number reset
        const phoneNumberWithCode = `${forgotPasswordCountryCode}${forgotPasswordPhone}`;
        response = await authAPI.resetPasswordByPhone(phoneNumberWithCode);

        if (response.success) {
          setForgotPasswordMessage("A temporary password has been sent to your phone number via SMS. Please check your messages.");
        } else {
          setForgotPasswordError(response.error || "Failed to send reset SMS. Please try again.");
        }
      }
    } catch (err) {
      setForgotPasswordError("Network error. Please try again.");
    } finally {
      setIsForgotPasswordLoading(false);
    }
  };

  // Resend OTP handler (for phone login method)
  const handleResendOtp = async () => {
    if (resendActivationCooldown > 0) return;

    setIsResendingActivation(true);
    setResendActivationMessage('');
    setError('');
    setOtp(''); // Clear OTP input

    try {
      const phoneNumberWithCode = `${countryCode}${phoneNumber}`;
      console.log('🔄 Resending OTP to:', phoneNumberWithCode);

      const response = await authAPI.resendPhoneOtp(phoneNumberWithCode);
      console.log('📡 Resend OTP response:', response);

      if (response.success) {
        setResendActivationMessage(response.message || 'OTP has been resent to your phone number');
        setResendActivationCooldown(60);
        setShowActivationError(false); // Hide activation error
        setShowOtpScreen(true); // Show OTP input screen

        // Clear message after 5 seconds
        setTimeout(() => setResendActivationMessage(''), 5000);
      } else {
        setError(response.error || 'Failed to resend OTP. Please try again.');
      }
    } catch (err) {
      console.error('Resend OTP error:', err);
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setIsResendingActivation(false);
    }
  };

  // Resend activation link handler (for email login method)
  const handleResendActivationLink = async () => {
    if (resendActivationCooldown > 0) return;

    setIsResendingActivation(true);
    setResendActivationMessage('');
    setError('');

    try {
      console.log('🔄 Resending activation link to:', email);

      const response = await authAPI.resendActivationLink(email);
      console.log('📡 Resend activation link response:', response);

      if (response.success) {
        setResendActivationMessage(response.message || 'Activation link has been resent to your email');
        setResendActivationCooldown(60);
        setShowActivationError(false); // Hide activation error, show success message instead

        // Clear message after 5 seconds
        setTimeout(() => setResendActivationMessage(''), 5000);
      } else {
        setError(response.error || 'Failed to resend activation link. Please try again.');
      }
    } catch (err) {
      console.error('Resend activation link error:', err);
      setError('Failed to resend activation link. Please try again.');
    } finally {
      setIsResendingActivation(false);
    }
  };

  // Handle OTP verification for phone login activation
  const handleVerifyOtp = async () => {
    if (!otp || otp.trim().length < 4) {
      setOtpError('Please enter a valid OTP');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError('');
    setDebugResponse(null);

    // ===== Passwordless login: verify-otp -> /login with verification_token =====
    if (authMode === "otp") {
      try {
        const identifier = method === "email"
          ? { email }
          : { phone_number: `${countryCode}${phoneNumber}` };

        const verifyRes = await authAPI.verifyOtp({ ...identifier, otp: otp.trim() });

        if (!verifyRes.success || !verifyRes.verification_token) {
          setOtpError(verifyRes.error || 'Invalid OTP. Please try again.');
          setIsVerifyingOtp(false);
          return;
        }

        // Exchange the single-use verification_token for a real session
        const loginRes = await authAPI.login({
          ...identifier,
          verification_token: verifyRes.verification_token,
        } as any);

        if (loginRes.success && loginRes.user && loginRes.token) {
          // Same post-login handling as password login (account choice, properties, redirects)
          finalizeLoginSuccess(loginRes);
        } else {
          setOtpError(loginRes.error || 'Failed to sign in. Please try again.');
          setIsVerifyingOtp(false);
        }
      } catch (err) {
        console.error('Passwordless login error:', err);
        setOtpError('An error occurred. Please try again.');
        setIsVerifyingOtp(false);
      }
      return;
    }

    try {
      const phoneNumberWithCode = `${countryCode}${phoneNumber}`;
      console.log('🔍🔍🔍 ===== STARTING OTP VERIFICATION (LOGIN PAGE) =====');
      console.log('📞 Phone number with country code:', phoneNumberWithCode);
      console.log('🔢 OTP entered:', otp.trim());
      console.log('⏰ Timestamp:', new Date().toISOString());

      const response = await authAPI.verifyPhoneOtp(phoneNumberWithCode, otp.trim());

      // Store response for debugging
      setDebugResponse(response);

    

      // Extract user and token from response (try multiple locations)
      const userData = response.user || response.data?.user;
      const tokenData = response.token || response.data?.token;

      console.log('🔍 Extracted userData:', userData);
      console.log('🔍 Extracted tokenData:', tokenData);
      console.log('🔍 response.success value:', response.success);
      console.log('🔍 response.success type:', typeof response.success);

      // Check if we have the necessary data (be flexible with success field)
      if (userData && tokenData) {
        console.log('✅✅✅ LoginPage: Token and User data found! Proceeding with activation...');
        console.log('✅ User data:', JSON.stringify(userData, null, 2));
        console.log('✅ Token (first 30 chars):', tokenData.substring(0, 30));

        // Save login method preference for this user (persists even after logout)
        const phoneNumberWithCode = `${countryCode}${phoneNumber}`;
        localStorage.setItem(`stasht_login_method_${phoneNumberWithCode}`, 'phone');
        console.log('✅ Saved login method preference: phone for user:', phoneNumberWithCode);

        // CRITICAL FIX: Save data in SPECIFIC ORDER to avoid race conditions

        // 1. First, save SessionValidator data (this must be done before AuthContext checks)
        // Use email OR phone_number as identifier
        const userIdentifier = userData.email || userData.phone_number;
        console.log('🔐 User identifier:', userIdentifier, '(email:', !!userData.email, ', phone:', !!userData.phone_number, ')');

        if (userData.id && userIdentifier) {
          console.log('🔐 Step 1: Initializing SessionValidator...');
          SessionValidator.initSession(userData.id, userIdentifier, tokenData);
          console.log('✅ SessionValidator initialized with identifier:', userIdentifier);
          console.log('  - sessionStorage key saved:', !!sessionStorage.getItem('stasht_session_validator'));
          console.log('  - localStorage backup saved:', !!localStorage.getItem('stasht_session_validator_backup'));
        } else {
          console.log('⚠️ Cannot initialize SessionValidator - missing userId or identifier');
          console.log('  - userData.id:', userData.id);
          console.log('  - userIdentifier:', userIdentifier);
        }

        // 2. Save authentication token (AuthContext checks this first)
        console.log('🔐 Step 2: Saving stasht_token...');
        localStorage.setItem('stasht_token', tokenData);
        console.log('✅ stasht_token saved');

        // 3. Save user data
        console.log('🔐 Step 3: Saving stasht_user...');
        localStorage.setItem('stasht_user', JSON.stringify(userData));
        console.log('✅ stasht_user saved');

        // 4. Store session change event (for cross-tab detection)
        console.log('🔐 Step 4: Saving session change event...');
        const sessionChangeData = {
          userId: userData.id,
          email: userData.email,
          timestamp: Date.now()
        };
        localStorage.setItem('stasht_session_change', JSON.stringify(sessionChangeData));
        console.log('✅ stasht_session_change saved');

        // 5. Verify ALL data is properly saved before reloading
        console.log('🔍🔍🔍 FINAL VERIFICATION BEFORE RELOAD:');
        console.log('  - stasht_token exists:', !!localStorage.getItem('stasht_token'));
        console.log('  - stasht_user exists:', !!localStorage.getItem('stasht_user'));
        console.log('  - stasht_session_change exists:', !!localStorage.getItem('stasht_session_change'));
        console.log('  - stasht_session_validator (sessionStorage):', !!sessionStorage.getItem('stasht_session_validator'));
        console.log('  - stasht_session_validator_backup (localStorage):', !!localStorage.getItem('stasht_session_validator_backup'));

        const currentSessionUser = SessionValidator.getCurrentSessionUser();
        console.log('  - SessionValidator can read user:', currentSessionUser);
        console.log('  - SessionValidator userId matches:', currentSessionUser?.userId === userData.id);
        console.log('  - SessionValidator email matches:', currentSessionUser?.email === userData.email);

        // 6. Set UI state
        setIsRedirecting(true);

        // 7. Immediate reload (no setTimeout - localStorage is synchronous)
        console.log('🚀🚀🚀 RELOADING NOW - All data saved successfully');
        console.log('AuthContext will validate session and authenticate user');

        // Use location.replace for a hard reload that clears browser cache
        window.location.replace(window.location.href);
      } else {
        console.log('❌❌❌ LoginPage: OTP verification FAILED - Missing user or token data');
        console.log('🔍 Failure reason analysis:');
        console.log('  - userData extracted:', !!userData);
        console.log('  - tokenData extracted:', !!tokenData);
        console.log('  - response.success:', response.success, '(type:', typeof response.success, ')');
        console.log('  - response.user exists:', !!response.user);
        console.log('  - response.token exists:', !!response.token);
        console.log('  - response.data?.user exists:', !!response.data?.user);
        console.log('  - response.data?.token exists:', !!response.data?.token);
        console.log('  - response.error:', response.error);
        console.log('  - response.message:', response.message);

        // Show detailed error alert
        alert('OTP VERIFICATION FAILED - Missing Data!\n\n' +
          'userData found: ' + !!userData + '\n' +
          'tokenData found: ' + !!tokenData + '\n' +
          'response.user: ' + !!response.user + '\n' +
          'response.token: ' + !!response.token + '\n' +
          'response.data.user: ' + !!response.data?.user + '\n' +
          'response.data.token: ' + !!response.data?.token + '\n\n' +
          'error: ' + (response.error || 'none') + '\n' +
          'message: ' + (response.message || 'none'));

        setOtpError(response.error || response.message || 'Invalid OTP or missing user/token data. Please try again.');
        setIsVerifyingOtp(false);
      }
    } catch (error) {
      console.error('❌❌❌ LoginPage: OTP verification EXCEPTION');
      console.error('🔥 Error type:', typeof error);
      console.error('🔥 Error message:', error instanceof Error ? error.message : String(error));
      console.error('🔥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('🔥 Full error object:', error);

      // Show exception alert
      alert('OTP VERIFICATION EXCEPTION!\n\n' +
        (error instanceof Error ? error.message : String(error)));

      setOtpError('An error occurred. Please try again.');
      setIsVerifyingOtp(false);
    }
  };

  // Resend OTP from OTP screen
  const handleResendOtpFromScreen = async () => {
    if (resendActivationCooldown > 0) return;

    setIsResendingActivation(true);
    setResendActivationMessage('');
    setOtpError('');
    setOtp(''); // Clear OTP input

    // Passwordless flow: resend = request a fresh OTP via /send-otp (overwrites old code)
    if (authMode === "otp") {
      try {
        const identifier = method === "email"
          ? { email }
          : { phone_number: `${countryCode}${phoneNumber}` };

        const res = await authAPI.sendOtp(identifier, 'login');

        if (res.success) {
          setResendActivationMessage(res.message || `OTP has been resent to your ${method === "email" ? "email" : "phone number"}`);
          setResendActivationCooldown(60);
          setOtpCountdown(600);
          setTimeout(() => setResendActivationMessage(''), 5000);
        } else {
          setOtpError(res.error || 'Failed to resend OTP. Please try again.');
        }
      } catch (err) {
        console.error('Resend OTP (passwordless) error:', err);
        setOtpError('Failed to resend OTP. Please try again.');
      } finally {
        setIsResendingActivation(false);
      }
      return;
    }

    try {
      const phoneNumberWithCode = `${countryCode}${phoneNumber}`;
      console.log('🔄 Resending OTP to:', phoneNumberWithCode);

      const response = await authAPI.resendPhoneOtp(phoneNumberWithCode);
      console.log('📡 Resend OTP response:', response);

      if (response.success) {
        setResendActivationMessage(response.message || 'OTP has been resent to your phone number');
        setResendActivationCooldown(60);

        // Clear message after 5 seconds
        setTimeout(() => setResendActivationMessage(''), 5000);
      } else {
        setOtpError(response.error || 'Failed to resend OTP. Please try again.');
      }
    } catch (err) {
      console.error('Resend OTP error:', err);
      setOtpError('Failed to resend OTP. Please try again.');
    } finally {
      setIsResendingActivation(false);
    }
  };

  // NEW: Frontend-handled Google OAuth login
  const googleLogin = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      try {
        console.log('🔐 Google OAuth success! Token response:', tokenResponse);
        setIsSocialLoginLoading(true);
        setError("");
        setConflictError(null);

        // Get user info from Google using the access token
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });

        if (!userInfoResponse.ok) {
          throw new Error('Failed to get user info from Google');
        }

        const googleUserInfo = await userInfoResponse.json();
        console.log('👤 Google user info:', googleUserInfo);

        // Send user data to backend to save/authenticate
        const response = await googleAuthAPI.saveGoogleUser({
          name: googleUserInfo.name,
          email: googleUserInfo.email,
          google_id: googleUserInfo.sub,
          profile_picture: googleUserInfo.picture,
          access_token: tokenResponse.access_token,
          intent: 'login',
        });

        console.log('📡 Backend auth response:', response);

        if (response.success && response.user && response.token) {
          console.log('✅ User authenticated successfully!');

          // Store auth data
          localStorage.setItem('stasht_user', JSON.stringify(response.user));
          localStorage.setItem('stasht_token', response.token);

          // Initialize session validator
          const userIdentifier = response.user.email || response.user.phone_number;
          if (response.user.id && userIdentifier) {
            SessionValidator.initSession(response.user.id, userIdentifier, response.token);
          }

          // Trigger session change event
          const sessionChangeData = {
            userId: response.user.id,
            email: response.user.email,
            phone_number: response.user.phone_number,
            timestamp: Date.now()
          };
          localStorage.setItem('stasht_session_change', JSON.stringify(sessionChangeData));

          // Save login method preference
          const methodIdentifier = response.user.email;
          localStorage.setItem(`stasht_login_method_${methodIdentifier}`, 'email');

          // Clear pending invite params
          sessionStorage.removeItem('pendingInvite');
          localStorage.removeItem('pendingInvite');
          sessionStorage.removeItem('just_logged_out_for_invite');

          toast.success(response.message || 'Successfully logged in with Google!');

          // Check for pending deep link redirect
          const pendingDeepLink = sessionStorage.getItem('pendingDeepLink');
          if (pendingDeepLink) {
            try {
              const deepLinkData = JSON.parse(pendingDeepLink);
              console.log('🔗 Deep link found after Google login:', deepLinkData);

              // IMPORTANT: Don't clear pendingDeepLink - let App.tsx useEffect handle it after redirect
              // Only clear the email/phone prefill data
              sessionStorage.removeItem('pending_magic_link_email');
              sessionStorage.removeItem('pending_magic_link_phone');

              // Redirect to the memory page with image parameter
              const redirectUrl = `/memories/${deepLinkData.memoryId}?image=${deepLinkData.imageId}&userId=${deepLinkData.userId}`;
              console.log('🔗 Redirecting to deep link (keeping pendingDeepLink for App.tsx):', redirectUrl);
              window.location.replace(redirectUrl);
            } catch (err) {
              console.error('❌ Failed to parse pending deep link:', err);
              // Clear on error
              sessionStorage.removeItem('pendingDeepLink');
              // Fallback to regular login
              window.location.reload();
            }
          } else {
            // Reload to trigger authentication
            window.location.reload();
          }
        } else {
          console.error('❌ Backend auth failed:', response.error);
          const errorMessage = response.message || response.error || 'Failed to login with Google';
          setError(errorMessage);
          toast.error(errorMessage);
          setIsSocialLoginLoading(false);
        }
      } catch (err) {
        console.error('❌ Google login error:', err);
        setError('Failed to login with Google. Please try again.');
        setIsSocialLoginLoading(false);
      }
    },
    onError: (error) => {
      console.error('❌ Google OAuth error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));

      // More specific error messages
      let errorMessage = 'Failed to login with Google. Please try again.';
      if (error && typeof error === 'object') {
        if ('error' in error && error.error === 'popup_closed_by_user') {
          errorMessage = 'Google login was cancelled.';
        } else if ('error' in error && error.error === 'access_denied') {
          errorMessage = 'Access denied. Please try again.';
        } else if ('error' in error) {
          errorMessage = `Google login failed: ${error.error}`;
        }
      }

      setError(errorMessage);
      setIsSocialLoginLoading(false);
    },
    onNonOAuthError: (error) => {
      console.error('❌ Non-OAuth error:', error);
      console.error('❌ Error type:', error.type);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      setError('An error occurred with Google authentication. Please try again.');
      setIsSocialLoginLoading(false);
    },
  });

  const handleGoogleLogin = () => {
    console.log('🔐 Initiating frontend Google login flow...');
    googleLogin();
  };

  // Apple login handler
  const handleAppleLogin = async () => {
    try {
      setIsSocialLoginLoading(true);
      console.log('🍎 Starting Apple Sign-In flow...');

      // Get Apple OAuth URL from backend
      const response = await appleAuthAPI.getAppleAuthUrl('login');

      if (response.success && response.auth_url) {
        console.log('🍎 Redirecting to Apple Sign-In...');
        // Redirect to Apple OAuth
        window.location.href = response.auth_url;
      } else {
        throw new Error(response.error || 'Failed to initiate Apple Sign-In');
      }
    } catch (error) {
      console.error('🍎 Apple Sign-In error:', error);
      toast.error('Failed to start Apple Sign-In. Please try again.');
      setIsSocialLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center relative px-4 py-8">
      {/* Background SVG - Behind everything on RIGHT SIDE */}
      <div className="absolute inset-0 flex items-stretch justify-end pointer-events-none z-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="807"
          height="1080"
          viewBox="0 0 807 1080"
          fill="none"
          preserveAspectRatio="none"
          className="opacity-40"
          style={{
            width: '50%',
            height: '100%',
            minWidth: '500px'
          }}
        >
          <path d="M1105 868.88C1105 1019.68 1053.62 1133.51 951.226 1210.36C848.831 1287.21 701.57 1326 509.805 1326C405.601 1326 315.146 1320.56 238.078 1309.32C161.01 1298.09 82.4951 1277.79 2.53274 1247.7V858.73C77.7914 891.718 160.286 919.268 250.018 940.656C339.75 962.044 419.712 972.919 489.905 972.919C594.833 972.919 647.297 948.994 647.297 900.78C647.297 875.767 632.462 853.654 603.155 834.442C573.847 814.866 488.458 777.166 346.986 720.615C218.178 667.689 127.723 607.513 76.706 539.724C25.3274 472.298 0 386.746 0 283.07C0 152.205 50.2931 50.3406 151.241 -22.5231C252.189 -95.3869 394.746 -132 578.913 -132C671.539 -132 758.376 -121.85 839.786 -101.549C921.195 -81.2491 1005.86 -51.5236 1093.42 -12.7354L962.081 300.47C897.677 271.469 829.293 246.819 757.652 226.519C685.65 206.218 627.035 196.068 581.446 196.068C502.207 196.068 462.407 215.644 462.407 254.432C462.407 278.357 476.156 299.02 504.016 316.058C531.876 333.096 611.839 367.534 743.903 419.735C842.318 460.335 915.768 500.211 963.89 538.999C1012.37 577.787 1047.83 623.826 1070.63 676.389C1093.42 728.952 1104.64 793.116 1104.64 868.155L1105 868.88Z" fill="url(#paint0_linear_7972_17265)" fillOpacity="0.3"/>
          <defs>
            <linearGradient id="paint0_linear_7972_17265" x1="552.5" y1="-132" x2="552.5" y2="1326" gradientUnits="userSpaceOnUse">
              <stop stopColor="#60B6FF" stopOpacity="0.54"/>
              <stop offset="0.710504" stopColor="#6979FF" stopOpacity="0.31"/>
              <stop offset="1" stopColor="#6C60FF"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Centered Content */}
      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Logo/Brand Section */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex justify-center items-center">
            <StashtLogo className="h-16 w-auto max-w-[200px] object-contain" fill="#6C60FF" style={{ aspectRatio: 'auto' }} />
          </div>
          <p className="text-indigo-600 mt-2 text-lg">
            {showForgotPassword
              ? "Enter your email to receive a password reset link"
              : ""
            }
          </p>
        </div>

        {/* Login/Forgot Password/OTP Verification Form */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          {showOtpScreen ? (
            // OTP Verification Screen
            <>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-semibold text-center">
                  {method === "email" ? "Verify Your Email" : "Verify Your Phone"}
                </CardTitle>
                <CardDescription className="text-center">
                  Enter the OTP sent to {method === "email" ? email : `${countryCode} ${phoneNumber}`}
                </CardDescription>
                {authMode === "otp" && otpCountdown > 0 && (
                  <p className="text-center text-xs text-gray-500 pt-1">
                    Code expires in {Math.floor(otpCountdown / 60)}:{String(otpCountdown % 60).padStart(2, '0')}
                  </p>
                )}
                {/* Delivery hint. Wording differs by method: an SMS has no junk
                    folder, so pointing phone users at one would just confuse them. */}
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-center text-xs text-amber-800">
                    Can&apos;t find it? Check your {method === "email" ? "spam or junk folder" : "blocked or filtered messages"}.
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Debug Response Display */}
                {debugResponse && (
                  <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-bold text-yellow-900">🔍 API RESPONSE DEBUG:</h3>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(debugResponse, null, 2));
                          alert('Response copied to clipboard!');
                        }}
                        className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="text-xs text-yellow-900 overflow-auto max-h-60 whitespace-pre-wrap break-words">
                      {JSON.stringify(debugResponse, null, 2)}
                    </pre>
                    <div className="mt-3 text-xs text-yellow-800 space-y-1 border-t border-yellow-300 pt-2">
                      <p><strong>success:</strong> {String(debugResponse.success)} (type: {typeof debugResponse.success})</p>
                      <p><strong>user exists:</strong> {String(!!debugResponse.user)}</p>
                      <p><strong>token exists:</strong> {String(!!debugResponse.token)}</p>
                      {debugResponse.user && <p><strong>user.id:</strong> {debugResponse.user.id}</p>}
                      {debugResponse.user && <p><strong>user.email:</strong> {debugResponse.user.email}</p>}
                      {debugResponse.token && <p><strong>token (first 20 chars):</strong> {debugResponse.token.substring(0, 20)}...</p>}
                      <p><strong>error:</strong> {debugResponse.error || 'none'}</p>
                      <p><strong>message:</strong> {debugResponse.message || 'none'}</p>
                    </div>
                  </div>
                )}

                {/* OTP Input */}
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                    Enter OTP <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="otp"
                    type="text"
                    value={otp}
                    onChange={(e) => {
                      // Only allow numbers and limit to 6 digits
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(value);
                      if (otpError) setOtpError('');
                    }}
                    className={`w-full px-4 py-3 text-center text-2xl font-semibold tracking-widest border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      otpError ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-[#F3F3F5]'
                    }`}
                    placeholder="000000"
                    maxLength={6}
                    disabled={isVerifyingOtp || isRedirecting}
                  />
                  {otpError && (
                    <p className="mt-2 text-sm text-red-600">{otpError}</p>
                  )}
                </div>

                {/* Verify Button */}
                <button
                  onClick={handleVerifyOtp}
                  disabled={isVerifyingOtp || isRedirecting || otp.length < 4}
                  className="w-full bg-[#8B7EFF] hover:bg-[#7A6DED] text-white py-3 px-4 rounded-lg focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 font-medium"
                >
                  {isRedirecting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Logging you in...
                    </>
                  ) : isVerifyingOtp ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Verifying OTP...
                    </>
                  ) : authMode === "otp" ? (
                    'Verify & Sign In'
                  ) : (
                    'Verify OTP & Activate Account'
                  )}
                </button>

                {/* Success Message */}
                {resendActivationMessage && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-600 text-center">{resendActivationMessage}</p>
                  </div>
                )}

                {/* Resend OTP Link */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOtpFromScreen}
                    className={`text-sm font-medium transition-colors ${
                      resendActivationCooldown > 0 || isResendingActivation || isRedirecting
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-blue-600 hover:text-blue-700'
                    }`}
                    disabled={isVerifyingOtp || isResendingActivation || resendActivationCooldown > 0 || isRedirecting}
                  >
                    {isResendingActivation ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Resending...
                      </span>
                    ) : resendActivationCooldown > 0 ? (
                      `Resend OTP in ${resendActivationCooldown}s`
                    ) : (
                      "Didn't receive OTP? Resend"
                    )}
                  </button>
                </div>

                {/* Back to Login */}
                <div className="text-center pt-4">
                  <button
                    onClick={() => {
                      setShowOtpScreen(false);
                      setOtp('');
                      setOtpError('');
                      setShowActivationError(false);
                    }}
                    className="text-sm text-gray-600 hover:text-gray-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isVerifyingOtp || isRedirecting}
                  >
                    ← Back to Login
                  </button>
                </div>
              </CardContent>
            </>
          ) : !showForgotPassword ? (
            // Login Form
            <>
              <CardHeader className="space-y-1">
                {/* Desktop only - Mobile shows this in logo section */}
                <CardTitle className="hidden md:block text-2xl font-semibold text-center">Welcome Back!</CardTitle>
                <CardDescription className="hidden md:block text-center">
                  Sign in to your Stasht account
                </CardDescription>
              </CardHeader>


              <CardContent className="space-y-4">
                {/* Social Login Buttons - Mobile Only (Top) */}
                <div className="md:hidden">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 border-gray-200 hover:bg-gray-50"
                      onClick={() => handleGoogleLogin()}
                      disabled={isSocialLoginLoading || isLoading}
                    >
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 border-gray-200 hover:bg-gray-50"
                      onClick={handleAppleLogin}
                      disabled={isSocialLoginLoading || isLoading}
                    >
                      <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      Apple
                    </Button>
                  </div>

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2 text-gray-500">Or sign in with</span>
                    </div>
                  </div>
                </div>

                {/* Social Login Buttons - Desktop Only (Top) */}
                <div className="hidden md:grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 border-gray-200 hover:bg-gray-50"
                    onClick={() => handleGoogleLogin()}
                    disabled={isSocialLoginLoading || isLoading}
                  >
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 border-gray-200 hover:bg-gray-50"
                    onClick={handleAppleLogin}
                    disabled={isSocialLoginLoading || isLoading}
                  >
                    <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    Apple
                  </Button>
                </div>

                {/* Divider - Desktop Only */}
                <div className="relative my-6 hidden md:block">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Or continue with</span>
                  </div>
                </div>

                {/** Login using Email or phone  */}
                <div>
                  <Label className="text-sm md:text-[14px] font-medium text-gray-700">Sign in with</Label>
                  <div className="flex items-center space-x-6 mt-2">
                    <label className={`flex items-center ${isCollaboratorLocked && method !== "phone" ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                      <input
                        type="radio"
                        name="signInMethod"
                        value="phone"
                        checked={method === "phone"}
                        onChange={() => handleMethodChange("phone")}
                        disabled={isCollaboratorLocked && method !== "phone"}
                        className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <Phone className="ml-2 h-4 w-4 text-gray-500" />
                      <span className="ml-2 text-[12px] md:text-[14px] text-gray-700">
                        Phone number
                      </span>
                    </label>

                    <label className={`flex items-center ${isCollaboratorLocked && method !== "email" ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                      <input
                        type="radio"
                        name="signInMethod"
                        value="email"
                        checked={method === "email"}
                        onChange={() => handleMethodChange("email")}
                        disabled={isCollaboratorLocked && method !== "email"}
                        className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <Mail className="ml-2 h-4 w-4 text-gray-500" />
                      <span className="ml-2 text-[12px] md:text-[14px] text-gray-700">
                        Email address
                      </span>
                    </label>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 login-form text-selectable">
                  {/* Phone Number Field */}
                  {method === "phone" && (
                    <div className="space-y-2" key="phone-field">
                      <Label htmlFor="phone" className="text-[14px] font-medium text-gray-700">
                        Phone number {isCollaboratorLocked && <span className="text-xs text-gray-500">(locked for invite)</span>}
                      </Label>
                      <div className="flex space-x-2">
                        <CountrySelect
                          value={countryCode}
                          onChange={setCountryCode}
                          disabled={isCollaboratorLocked}
                          className="w-32 h-11 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-[#F3F3F5] text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        <Input
                          key="phone-input"
                          id="login-phone-input"
                          name="phone-number-login"
                          type="tel"
                          inputMode="numeric"
                          placeholder="Enter your phone number"
                          value={phoneNumber}
                          onChange={(e) => {
                            if (!isCollaboratorLocked) {
                              setPhoneNumber(e.target.value.replace(/\D/g, ''));
                            }
                          }}
                          autoComplete={isCollaboratorLocked ? "off" : "tel"}
                          onFocus={(e) => {
                            // Remove readonly on focus to allow input (only if not locked)
                            if (!isCollaboratorLocked) {
                              e.target.removeAttribute('readonly');
                            }
                          }}
                          data-form-type="other"
                          data-lpignore="true"
                          readOnly={isCollaboratorLocked || true}
                          onMouseDown={(e) => {
                            // Also remove readonly on click (only if not locked)
                            if (!isCollaboratorLocked) {
                              (e.target as HTMLInputElement).removeAttribute('readonly');
                            }
                          }}
                          className={`flex-1 h-11 px-4 border border-gray-200 rounded-lg bg-[#F3F3F5] focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 ${isCollaboratorLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* Email Field */}
                  {method === "email" && (
                    <div className="space-y-2" key="email-field">
                      <Label htmlFor="email" className="text-[14px] font-medium text-gray-700">
                        Email Address {isCollaboratorLocked && <span className="text-xs text-gray-500">(locked for invite)</span>}
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          key="email-input"
                          id="email"
                          name="email-login"
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => {
                            if (!isCollaboratorLocked) {
                              setEmail(e.target.value);
                            }
                          }}
                          autoComplete={isCollaboratorLocked ? "off" : "email"}
                          readOnly={isCollaboratorLocked}
                          className={`pl-10 h-11 border border-gray-200 rounded-lg bg-[#F3F3F5] focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isCollaboratorLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* Password Field */}
                  {authMode === "password" && (
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        id="password"
                        name="password-login"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        className="pl-10 pr-10 h-11 border border-gray-200 rounded-lg bg-[#F3F3F5] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  )}

                  {/* Remember Me & Forgot Password */}
                  {authMode === "password" && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                      />
                      <Label htmlFor="remember" className="text-sm text-gray-600">
                        Remember me
                      </Label>
                    </div>
                    <button
                      type="button"
                      onClick={handleForgotPasswordClick}
                      className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  )}

                  {/* Success Message (Resend Activation) */}
                  {resendActivationMessage && (
                    <Alert className="border-green-200 bg-green-50">
                      <AlertDescription className="text-green-700">
                        {resendActivationMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Conflict Error Message */}
                  {conflictError && (
                    <Alert className="border-orange-200 bg-orange-50">
                      <AlertDescription className="text-orange-700">
                        <div className="space-y-2">
                          <p>{conflictError.message}</p>
                          <p className="text-sm text-orange-600">
                            Please use the logout option in the other tab or window to sign in with a different account.
                          </p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Activation Error with Resend Option */}
                  {showActivationError && error && !conflictError && !resendActivationMessage && (
                    <Alert className="border-orange-200 bg-orange-50">
                      <AlertDescription>
                        <div className="space-y-3">
                          <p className="text-orange-700">{error}</p>

                          {/* Resend button based on login method */}
                          {method === "phone" ? (
                            <Button
                              type="button"
                              onClick={handleResendOtp}
                              disabled={isResendingActivation || resendActivationCooldown > 0}
                              className="w-full h-10 bg-[#6C60FF] text-white hover:bg-[#5A52E6] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isResendingActivation ? (
                                <div className="flex items-center justify-center space-x-2">
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                  <span>Resending OTP...</span>
                                </div>
                              ) : resendActivationCooldown > 0 ? (
                                `Resend OTP in ${resendActivationCooldown}s`
                              ) : (
                                'Resend OTP'
                              )}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              onClick={handleResendActivationLink}
                              disabled={isResendingActivation || resendActivationCooldown > 0}
                              className="w-full h-10 bg-[#6C60FF] text-white hover:bg-[#5A52E6] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isResendingActivation ? (
                                <div className="flex items-center justify-center space-x-2">
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                  <span>Resending Activation Link...</span>
                                </div>
                              ) : resendActivationCooldown > 0 ? (
                                `Resend Activation Link in ${resendActivationCooldown}s`
                              ) : (
                                'Resend Activation Link'
                              )}
                            </Button>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Regular Error Message */}
                  {error && !conflictError && !showActivationError && !resendActivationMessage && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertDescription className="text-red-700">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Login Button */}
                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>{authMode === "otp" ? "Sending OTP..." : "Signing In..."}</span>
                      </div>
                    ) : authMode === "otp" ? (
                      <div className="flex items-center space-x-2">
                        <ArrowRight className="h-4 w-4" />
                        <span>Send OTP</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <LogIn className="h-4 w-4" />
                        <span>Sign In</span>
                      </div>
                    )}
                  </Button>

                  {/* SMS/Email consent disclaimer */}
                  {authMode === "otp" && (
                    <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <Lock className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-700">
                        {method === "phone" ? (
                          <>
                            By requesting this code, you agree to receive a one-time transactional SMS from Stasht to sign you in. No password needed. Msg &amp; data rates may apply. Message frequency varies. Reply STOP to opt out, HELP for help. View our{" "}
                            <a href="https://www.stasht.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>
                            {" "}and{" "}
                            <a href="https://www.stasht.com/terms-conditions" target="_blank" rel="noopener noreferrer" className="underline">Terms</a>.
                          </>
                        ) : (
                          <>We'll send a 6-digit code to your email to sign you in. No password needed.</>
                        )}
                      </p>
                    </div>
                  )}
                </form>

                {/* Signup Link */}
                {onSwitchToSignup && (
                  <div className="text-center mt-6">
                    <p className="text-gray-600">
                      Don't have an account?{' '}
                      <button
                        onClick={onSwitchToSignup}
                        className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                      >
                        Create one here
                      </button>
                    </p>
                  </div>
                )}  
              </CardContent>
            </>
          ) : (
            // Forgot Password Form
            <>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-semibold text-center">Reset Password</CardTitle>
                <CardDescription className="text-center">
                  {forgotPasswordMethod === "email"
                    ? "Enter your email address and we will send you a temporary password for login in account"
                    : "Enter your phone number and we will send you a temporary password via SMS"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 auth-form text-selectable">
                  {/* Method Selector */}
                  <div>
                    <Label className="text-sm md:text-[14px] font-medium text-gray-700">Reset password using</Label>
                    <div className="flex items-center space-x-6 mt-2">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="forgotPasswordMethod"
                          value="email"
                          checked={forgotPasswordMethod === "email"}
                          onChange={() => {
                            setForgotPasswordMethod("email");
                            setForgotPasswordError("");
                          }}
                          className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                        />
                        <Mail className="ml-2 h-4 w-4 text-gray-500" />
                        <span className="ml-2 text-[12px] md:text-[14px] text-gray-700">
                          Email address
                        </span>
                      </label>

                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="forgotPasswordMethod"
                          value="phone"
                          checked={forgotPasswordMethod === "phone"}
                          onChange={() => {
                            setForgotPasswordMethod("phone");
                            setForgotPasswordError("");
                          }}
                          className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                        />
                        <Phone className="ml-2 h-4 w-4 text-gray-500" />
                        <span className="ml-2 text-[12px] md:text-[14px] text-gray-700">
                          Phone number
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Email Field */}
                  {forgotPasswordMethod === "email" && (
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email" className="text-sm font-medium text-gray-700">
                        Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          id="forgot-email"
                          type="email"
                          placeholder="Enter your email"
                          value={forgotPasswordEmail}
                          onChange={(e) => setForgotPasswordEmail(e.target.value)}
                          className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* Phone Number Field */}
                  {forgotPasswordMethod === "phone" && (
                    <div className="space-y-2">
                      <Label htmlFor="forgot-phone" className="text-[14px] font-medium text-gray-700">
                        Phone number
                      </Label>
                      <div className="flex space-x-2">
                        <CountrySelect
                          value={forgotPasswordCountryCode}
                          onChange={setForgotPasswordCountryCode}
                          className="w-32 h-11 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-[#F3F3F5] text-sm"
                        />
                        <Input
                          id="forgot-phone"
                          name="forgot-phone-number"
                          type="tel"
                          inputMode="numeric"
                          placeholder="Enter your phone number"
                          value={forgotPasswordPhone}
                          onChange={(e) => setForgotPasswordPhone(e.target.value.replace(/\D/g, ''))}
                          className="flex-1 h-11 px-4 border border-gray-200 rounded-lg bg-[#F3F3F5] focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* Success Message */}
                  {forgotPasswordMessage && (
                    <Alert className="border-green-200 bg-green-50">
                      <AlertDescription className="text-green-700">
                        {forgotPasswordMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Error Message */}
                  {forgotPasswordError && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertDescription className="text-red-700">
                        {forgotPasswordError}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    {/* Send Reset Link Button */}
                    <Button 
                      type="submit" 
                      className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium"
                      disabled={isForgotPasswordLoading}
                    >
                      {isForgotPasswordLoading ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Sending...</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4" />
                          <span>Send Reset Link</span>
                        </div>
                      )}
                    </Button>

                    {/* Back to Login Button */}
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={handleBackToLogin}
                      className="w-full h-11 border-gray-200 hover:bg-gray-50 text-gray-700"
                      disabled={isForgotPasswordLoading}
                    >
                      <div className="flex items-center space-x-2">
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Sign In</span>
                      </div>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          )}
        </Card>

       

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-6">
          <p>
            By signing in, you agree to our{' '}
            <a href="https://www.stasht.com/terms-conditions" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="https://www.stasht.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>

      {/* Device Verification Modal */}
      <DeviceVerificationModal
        isOpen={showDeviceVerification}
        onClose={() => {
          setShowDeviceVerification(false);
          setIsLoading(false);
        }}
        attemptId={verificationAttemptId || 0}
        deviceInfo={verificationDeviceInfo}
        onVerified={handleDeviceVerified}
        loginMethod={method}
      />

      {/* Popup Blocked Guide Modal */}
      <PopupBlockedGuideModal
        isOpen={showPopupGuide}
        onClose={() => setShowPopupGuide(false)}
        onRetry={() => {
          setShowPopupGuide(false);
          // Google login retry logic would go here if needed
        }}
      />

      {/* Account Choice Modal (for admin collaborators and properties) */}
      {(() => {
        console.log('🔍 Modal render check:', {
          adminCollaborators: adminCollaborators.length,
          ownedProperties: ownedProperties.length,
          sharedProperties: sharedProperties.length,
          pendingLoginUser: !!pendingLoginUser,
          showAccountChoice,
          shouldRender: (adminCollaborators.length > 0 || ownedProperties.length > 0 || sharedProperties.length > 0) && pendingLoginUser
        });
        return null;
      })()}
      {(adminCollaborators.length > 0 || ownedProperties.length > 0 || sharedProperties.length > 0) && pendingLoginUser && (
        <AccountChoiceModal
          isOpen={showAccountChoice}
          onClose={() => {
            // User closed modal without choosing - reset state, don't log in
            setShowAccountChoice(false);
            setPendingLoginUser(null);
            setPendingLoginToken('');
            setAdminCollaborators([]);  // Clear array
            setOwnedProperties([]);  // Clear owned properties
            setSharedProperties([]);  // Clear shared properties
            // Stay on login page - user can try again
          }}
          adminCollaborators={adminCollaborators}  // Pass array
          ownedProperties={ownedProperties}  // NEW: Pass owned properties
          sharedProperties={sharedProperties}  // NEW: Pass shared properties
          personalUser={pendingLoginUser}
          personalToken={pendingLoginToken}
          onComplete={() => {
            setShowAccountChoice(false);

            // Check for pending deep link redirect
            const pendingDeepLink = sessionStorage.getItem('pendingDeepLink');
            if (pendingDeepLink) {
              try {
                const deepLinkData = JSON.parse(pendingDeepLink);
                console.log('🔗 Deep link found after account selection:', deepLinkData);

                // IMPORTANT: Don't clear pendingDeepLink - let App.tsx useEffect handle it after redirect
                // Only clear the email/phone prefill data
                sessionStorage.removeItem('pending_magic_link_email');
                sessionStorage.removeItem('pending_magic_link_phone');

                // Redirect to the memory page with image parameter
                const redirectUrl = `/memories/${deepLinkData.memoryId}?image=${deepLinkData.imageId}&userId=${deepLinkData.userId}`;
                console.log('🔗 Redirecting to deep link (keeping pendingDeepLink for App.tsx):', redirectUrl);
                window.location.replace(redirectUrl);
              } catch (err) {
                console.error('❌ Failed to parse pending deep link:', err);
                // Clear on error
                sessionStorage.removeItem('pendingDeepLink');
                // Fallback to regular login
                window.location.reload();
              }
            } else {
              window.location.reload();
            }
          }}
        />
      )}
    </div>
  );
}