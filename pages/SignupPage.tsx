import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, User, Mail, Lock, ArrowRight, Loader2, Phone } from 'lucide-react';
import { validationUtils, authAPI } from '../utils/authUtils';
import { googleAuthAPI } from '../utils/googleAuthAPI';
import { appleAuthAPI } from '../utils/appleAuthAPI';
import { useGoogleLogin } from '@react-oauth/google';
import SessionValidator from '../utils/sessionValidator';
import StashtLogo from '../components/StashtLogo';
import CountrySelect from '../components/CountrySelect';
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getInviteParams, isEmail, isPhoneNumber } from '../utils/inviteUtils';
import { toast } from 'sonner';
import { GooglePhotosConnectModal } from '../components/GooglePhotosConnectModal';
import { PopupBlockedGuideModal } from '../components/PopupBlockedGuideModal';
import { AccountChoiceModal, getAdminCollaborator, AdminCollaborator } from '../components/AccountChoiceModal';

// Google Picker API type declarations
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface SignupPageProps {
  onSignup: (name: string, email: string, password: string, phone_number?: string) => Promise<{success: boolean, message?: string, errors?: any, collaborators?: any[]}>;
  onSwitchToLogin: () => void;
}

export default function SignupPage({ onSignup, onSwitchToLogin }: SignupPageProps) {
  const [formData, setFormData] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryEmail = urlParams.get('email');
    return {
      name: '',
      email: queryEmail ? decodeURIComponent(queryEmail) : '',
      password: '',
      confirmPassword: ''
    };
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activationMessage, setActivationMessage] = useState<string>('');
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [method, setMethod] = useState<"phone" | "email">(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('email') ? 'email' : 'phone';
  });
  // True when email was pre-filled from ?email= URL param — locks method to email
  const isEmailPrefilled = !!(new URLSearchParams(window.location.search).get('email'));
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otp, setOtp] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState("");
  const [isResendingActivation, setIsResendingActivation] = useState(false);
  const [resendActivationCooldown, setResendActivationCooldown] = useState(0);
  const [resendActivationMessage, setResendActivationMessage] = useState("");
  // Auth method: passwordless (OTP-only) for now. Kept as a constant so the password
  // path can be re-enabled later by restoring the toggle.
  const [authMode] = useState<"password" | "otp">("otp");
  // Seconds left before the current OTP expires (10 min). 0 = no active OTP.
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Locked collaborator state for invite links
  const [lockedCollaborator, setLockedCollaborator] = useState<string | null>(null);
  const [isCollaboratorLocked, setIsCollaboratorLocked] = useState(false);

  // Google Photos connect modal state
  const [showGooglePhotosModal, setShowGooglePhotosModal] = useState(false);
  const [pendingUserData, setPendingUserData] = useState<any>(null);

  // Popup blocked guide modal state
  const [showPopupGuide, setShowPopupGuide] = useState(false);

  // Account choice modal state (for admin collaborators)
  const [showAccountChoice, setShowAccountChoice] = useState(false);
  const [adminCollaborators, setAdminCollaborators] = useState<AdminCollaborator[]>([]);  // Changed to array
  const [pendingSignupUser, setPendingSignupUser] = useState<any>(null);
  const [pendingSignupToken, setPendingSignupToken] = useState<string>('');

  // Debug effect to track email state
  useEffect(() => {
    console.log('🔍 [SignupPage] State Update - email:', formData.email, 'phone:', phoneNumber, 'method:', method, 'isCollaboratorLocked:', isCollaboratorLocked);
  }, [formData.email, phoneNumber, method, isCollaboratorLocked]);

  // Check for magic link email prefill or ?email= query param
  useEffect(() => {
    // Check URL query param first: /signup?email=john@example.com
    const urlParams = new URLSearchParams(window.location.search);
    const queryEmail = urlParams.get('email');
    if (queryEmail) {
      const decoded = decodeURIComponent(queryEmail);
      setFormData(prev => ({ ...prev, email: decoded }));
      setMethod('email');
      return;
    }

    // Fallback: check magic link email from sessionStorage
    const magicLinkEmail = sessionStorage.getItem('magic_link_email');
    if (magicLinkEmail) {
      setFormData(prev => ({ ...prev, email: magicLinkEmail }));
      setMethod('email');
      sessionStorage.removeItem('magic_link_email');
    }
  }, []);

  // Check for collaborator invite parameter on mount
  useEffect(() => {
    // ============================================================
    // STEP 1: Check for logged-in user vs invite mismatch
    // ============================================================
    console.log('🔍 [SignupPage] === MISMATCH CHECK START ===');

    // Get current logged-in user from localStorage
    const loggedInUserStr = localStorage.getItem('stasht_user');
    let loggedInUser = null;
    if (loggedInUserStr) {
      try {
        loggedInUser = JSON.parse(loggedInUserStr);
        console.log('🔍 [SignupPage] Found logged-in user:', loggedInUser?.email || loggedInUser?.phone_number);
      } catch (e) {
        console.error('Failed to parse logged-in user:', e);
      }
    }

    // Get invite params from URL or storage
    let inviteCollaborator = null;
    const urlInviteParams = getInviteParams();
    if (urlInviteParams && urlInviteParams.collaborator) {
      inviteCollaborator = urlInviteParams.collaborator;
      console.log('🔍 [SignupPage] Found invite in URL:', inviteCollaborator);
    } else {
      // Check storage
      const storedInvite = sessionStorage.getItem('pendingInvite') || localStorage.getItem('pendingInvite');
      if (storedInvite) {
        try {
          const parsed = JSON.parse(storedInvite);
          inviteCollaborator = parsed.collaborator;
          console.log('🔍 [SignupPage] Found invite in storage:', inviteCollaborator);
        } catch (e) {
          console.error('Failed to parse stored invite:', e);
        }
      }
    }

    // If both exist, check for mismatch
    if (loggedInUser && inviteCollaborator) {
      const loggedInIdentifier = loggedInUser.email || loggedInUser.phone_number;
      const isMismatch = loggedInIdentifier.toLowerCase() !== inviteCollaborator.toLowerCase();

      console.log('🔍 [SignupPage] Comparing:', {
        loggedIn: loggedInIdentifier,
        invited: inviteCollaborator,
        mismatch: isMismatch
      });

      if (isMismatch) {
        console.log('🚪 [SignupPage] MISMATCH DETECTED - Auto-logout wrong user');

        // Clear user session but KEEP invite params
        localStorage.removeItem('stasht_user');
        localStorage.removeItem('stasht_token');
        sessionStorage.removeItem('stasht_session');

        // Ensure invite params are in localStorage for persistence
        if (urlInviteParams && urlInviteParams.collaborator) {
          localStorage.setItem('pendingInvite', JSON.stringify(urlInviteParams));
          console.log('💾 [SignupPage] Saved invite params to localStorage');
        }

        // Set flag to prevent clearing
        sessionStorage.setItem('just_logged_out_for_invite', 'true');

        console.log('✅ [SignupPage] Auto-logout complete - user can now signup with invited credentials');
        // Don't reload, just let the page continue to prefill
      }
    }

    console.log('🔍 [SignupPage] === MISMATCH CHECK END ===');

    // ============================================================
    // STEP 2: Normal invite flow logic
    // ============================================================
    const isInviteUrl = urlInviteParams && urlInviteParams.invite === '1';
    const justLoggedOutForInvite = sessionStorage.getItem('just_logged_out_for_invite') === 'true';

    console.log('🔍 [SignupPage] Is invite URL?', isInviteUrl);
    console.log('🔍 [SignupPage] Just logged out for invite?', justLoggedOutForInvite);

    // If NO invite params in URL, clear stored invite data UNLESS flag is set
    // The flag means user was just logged out for wrong invite (active invite flow)
    // This allows users to "escape" by typing fresh URL, but preserves invite during logout flow
    if (!isInviteUrl && !justLoggedOutForInvite) {
      const hasPendingInvite = sessionStorage.getItem('pendingInvite') || localStorage.getItem('pendingInvite');
      if (hasPendingInvite) {
        console.log('🗑️ [SignupPage] No invite in URL and no flag - clearing stored invite params (user escaped)');
        sessionStorage.removeItem('pendingInvite');
        localStorage.removeItem('pendingInvite');
      }
    } else if (justLoggedOutForInvite) {
      console.log('🚩 [SignupPage] Flag is set - keeping stored invite params (just logged out for invite)');
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

    console.log('🔍 [SignupPage] Checking invite params from', source, ':', inviteParams);

    if (inviteParams && inviteParams.collaborator) {
      const collaboratorValue = inviteParams.collaborator;
      console.log('🔒 [SignupPage] Invite detected - locking collaborator field:', collaboratorValue);
      console.log('🔒 [SignupPage] Collaborator value type check - contains @?', collaboratorValue.includes('@'));

      // CRITICAL: Set lock state FIRST before changing method/values
      // This prevents other effects from clearing the fields
      setLockedCollaborator(collaboratorValue);
      setIsCollaboratorLocked(true);

      // Use setTimeout to ensure isCollaboratorLocked is set before method changes
      setTimeout(() => {
        // Determine if it's email or phone and set the appropriate method and value
        if (isEmail(collaboratorValue)) {
          console.log('🔒 [SignupPage] Detected as EMAIL, setting method to email');
          setMethod('email');
          setFormData(prev => ({ ...prev, email: collaboratorValue }));
          console.log('🔒 [SignupPage] Locked to EMAIL:', collaboratorValue);
        } else if (isPhoneNumber(collaboratorValue)) {
          console.log('🔒 [SignupPage] Detected as PHONE, setting method to phone');
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
            console.log('🔒 [SignupPage] Locked to PHONE (known country code):', foundCountryCode, phoneNumberPart);
          } else {
            // Fallback: Try generic regex for other country codes
            const phoneMatch = collaboratorValue.match(/^(\+\d{1,4})(\d+)$/);
            if (phoneMatch) {
              setCountryCode(phoneMatch[1]);
              setPhoneNumber(phoneMatch[2]);
              console.log('🔒 [SignupPage] Locked to PHONE (regex fallback):', phoneMatch[1], phoneMatch[2]);
            } else {
              // No country code, use as-is (remove any + if present)
              const cleanPhone = collaboratorValue.replace(/^\+/, '');
              setPhoneNumber(cleanPhone);
              console.log('🔒 [SignupPage] Locked to PHONE (no country code):', cleanPhone);
            }
          }
        }

        // DON'T clear flag here - keep it until successful signup
        // This protects invite params when navigating between login/signup pages
      }, 0);
    }
  }, []);

  // Debug errors state whenever it changes
  useEffect(() => {
    console.log('🔍 Errors state changed:', errors);
    console.log('🔍 Email error specifically:', errors.email);
    console.log('🔍 Submit error specifically:', errors.submit);
  }, [errors]);

  // Resend OTP cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Resend activation link cooldown timer
  useEffect(() => {
    if (resendActivationCooldown > 0) {
      const timer = setTimeout(() => {
        setResendActivationCooldown(resendActivationCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendActivationCooldown]);

  // OTP expiry countdown (10 minutes)
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Username is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Username must be at least 2 characters';
    } else if (formData.name.trim().length > 20) {
      newErrors.name = 'Username must not exceed 20 characters';
    }

    // Email or Phone validation based on selected method
    if (method === "email") {
      // Email validation
      if (!formData.email) {
        newErrors.email = 'Email is required';
      } else if (!validationUtils.isValidEmail(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    } else if (method === "phone") {
      // Phone validation
      if (!phoneNumber || !phoneNumber.trim()) {
        newErrors.phone = 'Phone number is required';
      } else if (phoneNumber.trim().length < 10) {
        newErrors.phone = 'Please enter a valid phone number';
      }
    }

    // Password validation — skipped entirely in passwordless (OTP) mode
    if (authMode === "password") {
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters long';
      }

      // Confirm Password validation
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    // Terms agreement validation
    if (!agreedToTerms) {
      newErrors.terms = 'You must agree to the Terms of Service and Privacy Policy';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Passwordless signup: validate -> send OTP -> show OTP screen.
  // Account is actually created later in handleVerifyOtp (with the verification_token).
  const handleSendOtpForSignup = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const identifier = method === "email"
        ? { email: formData.email }
        : { phone_number: `${countryCode}${phoneNumber}` };

      const res = await authAPI.sendOtp(identifier, 'register');

      if (res.success) {
        setShowOtpScreen(true);
        setOtp('');
        setOtpError('');
        setActivationMessage('');
        setOtpCountdown(600);      // 10 minute expiry
        setResendCooldown(60);     // 60s before resend allowed
      } else if (res.alreadyRegistered) {
        // 409 → account exists. Stay on signup and show the error under the field.
        if (method === "email") {
          setErrors({ email: res.error || 'The email has already been taken.' });
        } else {
          setErrors({ phone: res.error || 'The phone number has already been taken.' });
        }
      } else {
        setErrors({ submit: res.error || 'Failed to send OTP. Please try again.' });
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      setErrors({ submit: 'An error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Passwordless path — no password, verify via OTP instead
    if (authMode === "otp") {
      await handleSendOtpForSignup();
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setActivationMessage(''); // Clear any previous message
    setRegistrationComplete(false); // Reset registration complete state
    console.log('🔍 Clearing errors at start of submit');
    setErrors({}); // Clear any previous errors

    try {
      // Send phone_number only when method is "phone"
      const phoneParam = method === "phone" ? `${countryCode}${phoneNumber}` : undefined;
      // When using phone method, send empty string for email (or you can generate a dummy email)
      const emailParam = method === "email" ? formData.email : "";
      console.log('🔍 SignupPage: About to call onSignup with:', { name: formData.name, email: emailParam, method, phoneParam });
      const result = await onSignup(formData.name.trim(), emailParam, formData.password, phoneParam);
      console.log('🔍 SignupPage: Registration result:', JSON.stringify(result, null, 2));
      console.log('🔍 SignupPage: result.success:', result.success);
      console.log('🔍 SignupPage: result.message:', result.message);
      console.log('🔍 SignupPage: result.errors:', result.errors);

      if (result.success) {
        console.log('✅ SignupPage: Registration SUCCESS');

        // Clear any old Google tokens from previous sessions (prevents token conflicts)
        sessionStorage.removeItem('google_access_token');
        console.log('🧹 Cleared old Google tokens for fresh start');

        // Check for collaborators in response and store for later use
        // API may return single object or array
        const collaboratorsRaw = result.collaborators;
        console.log('🔍 SignupPage: Collaborators in signup response (raw):', collaboratorsRaw);

        const adminCollabs = getAdminCollaborator(collaboratorsRaw);  // Returns array now
        console.log('🔍 SignupPage: Admin collaborator(s) check result:', adminCollabs.length, 'admin(s)');

        if (adminCollabs.length > 0) {
          console.log('🔐 SignupPage: Admin collaborator(s) found, storing for activation:', adminCollabs);
          // Store as array for consistency in AccountActivationPage
          const collaboratorsToStore = Array.isArray(collaboratorsRaw) ? collaboratorsRaw : [collaboratorsRaw];
          localStorage.setItem('pending_admin_collaborators', JSON.stringify(collaboratorsToStore));
          console.log('🔐 SignupPage: Stored in localStorage:', localStorage.getItem('pending_admin_collaborators'));
        }

        if (result.message) {
          console.log('✅ SignupPage: Has message:', result.message);
          // Check if OTP verification is required
          if (result.message.includes('OTP') && method === 'phone') {
            console.log('✅ SignupPage: OTP flow - showing OTP screen');
            setShowOtpScreen(true);
            setActivationMessage(result.message);
            setRegistrationComplete(true);
          } else {
            // Email activation flow - show message and don't redirect
            console.log('✅ SignupPage: Email activation flow - setting activation message');
            console.log('✅ SignupPage: Setting activationMessage to:', result.message);
            setActivationMessage(result.message);
            setRegistrationComplete(true);
            console.log('✅ SignupPage: activationMessage state should now be set');
          }
        } else {
          // Legacy flow - direct login (user will be automatically redirected)
          console.log('✅ SignupPage: Legacy flow - direct login, no message');
        }
      } else {
        console.log('❌ SignupPage: Registration FAILED');
        // Handle validation errors
        if (result.errors) {
          console.log('🚨 Validation errors received:', result.errors);
          console.log('🚨 Raw errors object keys:', Object.keys(result.errors));
          console.log('🚨 Email error value:', result.errors.email);
          console.log('🚨 Password error value:', result.errors.password);
          const newErrors: Record<string, string> = {};
          
          // Map API validation errors to form errors - only for specific fields
          const validFields = ['name', 'email', 'password'];
          Object.keys(result.errors).forEach(field => {
            if (validFields.includes(field) && Array.isArray(result.errors[field]) && result.errors[field].length > 0) {
              newErrors[field] = result.errors[field][0]; // Take first error message
              console.log(`🚨 Setting error for field ${field}:`, result.errors[field][0]);
            }
          });
          
          // Only set general submit error if there are no field-specific errors
          if (result.message && Object.keys(newErrors).length === 0) {
            newErrors.submit = result.message;
            console.log('🚨 Setting general submit error:', result.message);
          }
          
          console.log('🚨 Final errors object:', newErrors);
          setErrors(newErrors);
          console.log('🚨 Setting isSubmitting to false after validation errors');
        } else {
          // General error without specific field validation
          setErrors({ submit: result.message || 'Registration failed. Please try again.' });
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ submit: 'An error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Basic Google signup (without Photos scope)
  const googleSignup = useGoogleLogin({
    flow: 'implicit',
    scope: 'openid email profile',
    onSuccess: async (tokenResponse) => {
      try {
        console.log('🔐 Google OAuth success! Token response:', tokenResponse);
        setIsSubmitting(true);

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

        // Send user data to backend to save
        const response = await googleAuthAPI.saveGoogleUser({
          name: googleUserInfo.name,
          email: googleUserInfo.email,
          google_id: googleUserInfo.sub,
          profile_picture: googleUserInfo.picture,
          access_token: tokenResponse.access_token,
          intent: 'signup',
        });

        console.log('📡 Backend save response:', response);

        if (response.success && response.user && response.token) {
          console.log('✅ User saved successfully!');

          // Store user data and token temporarily (don't reload yet)
          setPendingUserData({
            user: response.user,
            token: response.token
          });

          // Don't store token yet - will get it when user clicks "Connect Google Photos"
          console.log('✅ User saved, showing Google Photos modal');

          // Show Google Photos connect modal
          setShowGooglePhotosModal(true);
          setIsSubmitting(false);
        } else {
          console.error('❌ Backend save failed:', response.error);
          const errorMessage = response.message || response.error || 'Failed to sign up with Google';
          toast.error(errorMessage);
          setErrors({ submit: errorMessage });
          setIsSubmitting(false);
        }
      } catch (err) {
        console.error('❌ Google signup error:', err);
        toast.error('Failed to sign up with Google. Please try again.');
        setIsSubmitting(false);
      }
    },
    onError: (error) => {
      console.error('❌ Google OAuth error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));

      // More specific error messages
      let errorMessage = 'Failed to sign up with Google. Please try again.';
      if (error && typeof error === 'object') {
        if ('error' in error && error.error === 'popup_closed_by_user') {
          errorMessage = 'Google sign-up was cancelled.';
        } else if ('error' in error && error.error === 'access_denied') {
          errorMessage = 'Access denied. Please try again.';
        } else if ('error' in error) {
          errorMessage = `Google sign-up failed: ${error.error}`;
        }
      }

      toast.error(errorMessage);
      setIsSubmitting(false);
    },
    onNonOAuthError: (error) => {
      console.error('❌ Non-OAuth error:', error);
      console.error('❌ Error type:', error.type);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      toast.error('An error occurred with Google authentication. Please try again.');
      setIsSubmitting(false);
    },
  });

  const handleGoogleSignup = () => {
    console.log('🔐 Initiating frontend Google signup flow (basic scope only)...');
    googleSignup(); // Use the basic OAuth from @react-oauth/google
  };

  // Apple signup handler
  const handleAppleSignup = async () => {
    try {
      setIsSubmitting(true);
      console.log('🍎 Starting Apple Sign-Up flow...');

      // Get Apple OAuth URL from backend
      const response = await appleAuthAPI.getAppleAuthUrl('signup');

      if (response.success && response.auth_url) {
        console.log('🍎 Redirecting to Apple Sign-In...');
        // Redirect to Apple OAuth
        window.location.href = response.auth_url;
      } else {
        throw new Error(response.error || 'Failed to initiate Apple Sign-Up');
      }
    } catch (error) {
      console.error('🍎 Apple Sign-Up error:', error);
      toast.error('Failed to start Apple Sign-Up. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Complete login after Google Photos modal interaction
  const completeGoogleSignup = () => {
    if (!pendingUserData) return;

    console.log('✅ Completing Google signup...');

    // Store auth data
    localStorage.setItem('stasht_user', JSON.stringify(pendingUserData.user));
    localStorage.setItem('stasht_token', pendingUserData.token);

    // Initialize session validator
    const userIdentifier = pendingUserData.user.email || pendingUserData.user.phone_number;
    if (pendingUserData.user.id && userIdentifier) {
      SessionValidator.initSession(pendingUserData.user.id, userIdentifier, pendingUserData.token);
    }

    // Trigger session change event
    const sessionChangeData = {
      userId: pendingUserData.user.id,
      email: pendingUserData.user.email,
      phone_number: pendingUserData.user.phone_number,
      timestamp: Date.now()
    };
    localStorage.setItem('stasht_session_change', JSON.stringify(sessionChangeData));

    // Clear pending invite params
    sessionStorage.removeItem('pendingInvite');
    localStorage.removeItem('pendingInvite');
    sessionStorage.removeItem('just_logged_out_for_invite');

    toast.success('Successfully signed up with Google!');

    // Reload to trigger authentication
    window.location.reload();
  };

  // Handle "Maybe Later" - just complete the login without connecting Google Photos
  const handleGooglePhotosMaybeLater = () => {
    console.log('📸 User chose "Maybe Later" for Google Photos');
    setShowGooglePhotosModal(false);
    completeGoogleSignup();
  };

  // Handle "Connect Google Photos" - Request OAuth permission for Photos
  const handleConnectGooglePhotos = async () => {
    console.log('📸 User chose to connect Google Photos');
    setShowGooglePhotosModal(false);

    try {
      // Complete signup and save user data FIRST
      console.log('📸 Completing signup...');
      localStorage.setItem('stasht_user', JSON.stringify(pendingUserData.user));
      localStorage.setItem('stasht_token', pendingUserData.token);

      // Initialize session validator
      const userIdentifier = pendingUserData.user.email || pendingUserData.user.phone_number;
      if (pendingUserData.user.id && userIdentifier) {
        SessionValidator.initSession(pendingUserData.user.id, userIdentifier, pendingUserData.token);
      }

      console.log('📸 User saved! Now requesting Google Photos permission...');
      toast.success('Redirecting to Google Photos...');

      // Build Google OAuth URL with Photos scope using implicit flow
      const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
      const redirectUri = import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI;

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.append('client_id', clientId);
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('response_type', 'token'); // Implicit flow
      authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly');
      authUrl.searchParams.append('state', 'photos_after_signup');
      authUrl.searchParams.append('include_granted_scopes', 'true');
      authUrl.searchParams.append('prompt', 'consent'); // Force consent to ensure token is returned

      console.log('📸 Redirecting to Google for Photos permission...');
      console.log('📸 Auth URL:', authUrl.toString());

      // Redirect to Google OAuth
      window.location.href = authUrl.toString();

    } catch (error) {
      console.error('❌ Error:', error);
      toast.error('Failed to complete signup. Please try again.');
      window.location.reload();
    }
  };


  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.trim().length < 4) {
      setOtpError('Please enter a valid OTP');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError('');

    // ===== Passwordless flow: verify-otp -> register with verification_token =====
    if (authMode === "otp") {
      try {
        const identifier = method === "email"
          ? { email: formData.email }
          : { phone_number: `${countryCode}${phoneNumber}` };

        const verifyRes = await authAPI.verifyOtp({ ...identifier, otp: otp.trim() });

        if (!verifyRes.success || !verifyRes.verification_token) {
          setOtpError(verifyRes.error || 'Invalid OTP. Please try again.');
          setIsVerifyingOtp(false);
          return;
        }

        // Create the account (already activated) using the single-use token.
        const result = await authAPI.register({
          name: formData.name.trim(),
          email: method === "email" ? formData.email : "",
          phone_number: method === "phone" ? `${countryCode}${phoneNumber}` : undefined,
          // password omitted → OTP-only account
          verification_token: verifyRes.verification_token,
        } as any);

        const newUser = (result as any).user;
        const newToken = (result as any).token;

        if (result.success && newUser && newToken) {
          // Account created and logged in
          localStorage.setItem('stasht_user', JSON.stringify(newUser));
          localStorage.setItem('stasht_token', newToken);
          localStorage.setItem('is_new_user', 'true');

          const userIdentifier = newUser.email || newUser.phone_number;
          SessionValidator.initSession(newUser.id, userIdentifier, newToken);

          localStorage.setItem('stasht_session_change', JSON.stringify({
            userId: newUser.id,
            email: newUser.email,
            phone_number: newUser.phone_number,
            timestamp: Date.now(),
          }));

          sessionStorage.removeItem('pendingInvite');
          localStorage.removeItem('pendingInvite');
          sessionStorage.removeItem('just_logged_out_for_invite');

          window.location.reload();
        } else if (result.success) {
          // Account created but backend didn't return a session — send to login
          setShowOtpScreen(false);
          setRegistrationComplete(true);
          setActivationMessage(result.message || 'Account created successfully! Please sign in.');
        } else {
          setOtpError((result as any).error || 'Failed to create account. Please try again.');
        }
      } catch (error) {
        console.error('Passwordless signup error:', error);
        setOtpError('An error occurred. Please try again.');
      } finally {
        setIsVerifyingOtp(false);
      }
      return;
    }

    try {
      const phoneNumberWithCode = `${countryCode}${phoneNumber}`;
      console.log('🔍🔍🔍 ===== OTP VERIFICATION STARTED =====');
      console.log('📞 Phone number with country code:', phoneNumberWithCode);
      console.log('🔢 OTP entered:', otp.trim());
      console.log('⏰ Timestamp:', new Date().toISOString());

      const response = await authAPI.verifyPhoneOtp(phoneNumberWithCode, otp.trim());

      console.log('📡📡📡 ===== /verify-phone-otp API RESPONSE =====');
      console.log('🔍 Full Response Object:', JSON.stringify(response, null, 2));
      console.log('✅ response.success:', response.success);
      console.log('👤 response.user:', response.user);
      console.log('🔑 response.token:', response.token);
      console.log('❌ response.error:', response.error);
      console.log('📄 response.message:', response.message);
      console.log('🗂️ response.data:', response.data);
      console.log('🔍 Response keys:', Object.keys(response));

      if (response.user) {
        console.log('👤 User object details:');
        console.log('  - user.id:', response.user.id);
        console.log('  - user.email:', response.user.email);
        console.log('  - user.name:', response.user.name);
        console.log('  - user.role:', response.user.role);
        console.log('  - Full user object:', JSON.stringify(response.user, null, 2));
      }

      if (response.success && response.user && response.token) {
        console.log('✅✅✅ OTP VERIFICATION SUCCESSFUL');
        console.log('📦 Storing authentication data...');

        // Store auth data in localStorage
        localStorage.setItem('stasht_user', JSON.stringify(response.user));
        console.log('✅ localStorage: stasht_user saved');

        localStorage.setItem('stasht_token', response.token);
        console.log('✅ localStorage: stasht_token saved');

        localStorage.setItem('is_new_user', 'true');

        // Initialize session validation (use email OR phone_number as identifier)
        const userIdentifier = response.user.email || response.user.phone_number;
        SessionValidator.initSession(response.user.id, userIdentifier, response.token);
        console.log('✅ SessionValidator initialized with user:', response.user.id, 'identifier:', userIdentifier);

        // Trigger session change event for cross-tab detection
        const sessionChangeData = {
          userId: response.user.id,
          email: response.user.email,
          phone_number: response.user.phone_number,
          timestamp: Date.now()
        };
        localStorage.setItem('stasht_session_change', JSON.stringify(sessionChangeData));
        console.log('✅ localStorage: stasht_session_change saved:', sessionChangeData);

        // Verify localStorage contents
        console.log('🔍 Verifying localStorage contents:');
        console.log('  - stasht_user:', localStorage.getItem('stasht_user'));
        console.log('  - stasht_token:', localStorage.getItem('stasht_token'));
        console.log('  - stasht_session_change:', localStorage.getItem('stasht_session_change'));

        // Clear pending invite params and flag from storage (if they exist)
        sessionStorage.removeItem('pendingInvite');
        localStorage.removeItem('pendingInvite');
        sessionStorage.removeItem('just_logged_out_for_invite');
        console.log('🗑️ Cleared pending invite params and flag from storage');

        // Check for admin collaborators (from signup response stored earlier or from OTP response)
        const storedCollaborators = localStorage.getItem('pending_admin_collaborators');
        const responseCollaborators = (response as any).collaborators || [];
        const collaborators = storedCollaborators ? JSON.parse(storedCollaborators) : responseCollaborators;
        console.log('🔍 SignupPage: Checking collaborators after OTP verification:', collaborators);

        const adminCollabs = getAdminCollaborator(collaborators);  // Returns array now
        if (adminCollabs.length > 0) {
          console.log('🔐 SignupPage: Admin collaborator(s) found, showing account choice modal:', adminCollabs.length, 'admin(s)');
          // Clear stored collaborators
          localStorage.removeItem('pending_admin_collaborators');

          // Show account choice modal instead of reloading
          setPendingSignupUser(response.user);
          setPendingSignupToken(response.token);
          setAdminCollaborators(adminCollabs);  // Store array
          setShowAccountChoice(true);
          return;
        }

        // Clear stored collaborators if any
        localStorage.removeItem('pending_admin_collaborators');

        console.log('🔄 Reloading page to trigger authentication...');
        console.log('📍 Expected behavior: App should authenticate user and route to memories page based on user role');

        // Reload the page to trigger authentication check
        // The app will then handle routing based on user role
        window.location.reload();
      } else {
        console.log('❌❌❌ OTP VERIFICATION FAILED');
        console.log('📍 Failure reason:');
        console.log('  - response.success:', response.success);
        console.log('  - response.user exists:', !!response.user);
        console.log('  - response.token exists:', !!response.token);
        console.log('  - response.error:', response.error);
        console.log('  - response.message:', response.message);

        setOtpError(response.error || response.message || 'Invalid OTP. Please try again.');
      }
    } catch (error) {
      console.error('❌❌❌ OTP VERIFICATION EXCEPTION');
      console.error('🔥 Error type:', typeof error);
      console.error('🔥 Error message:', error instanceof Error ? error.message : String(error));
      console.error('🔥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('🔥 Full error object:', error);

      setOtpError('An error occurred. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
      console.log('🔍 OTP verification process completed (finally block)');
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) {
      return; // Still in cooldown, don't allow resend
    }

    setIsResendingOtp(true);
    setResendMessage('');
    setOtpError('');
    setOtp(''); // Clear the OTP input for fresh entry

    // Passwordless flow: resend = request a fresh OTP via /send-otp (overwrites old code)
    if (authMode === "otp") {
      try {
        const identifier = method === "email"
          ? { email: formData.email }
          : { phone_number: `${countryCode}${phoneNumber}` };

        const res = await authAPI.sendOtp(identifier, 'register');

        if (res.success) {
          setResendMessage(res.message || `OTP has been resent to your ${method === "email" ? "email" : "phone number"}`);
          setResendCooldown(60);
          setOtpCountdown(600);
          setTimeout(() => setResendMessage(''), 5000);
        } else {
          setOtpError(res.error || 'Failed to resend OTP. Please try again.');
        }
      } catch (error) {
        console.error('Resend OTP (passwordless) error:', error);
        setOtpError('An error occurred while resending OTP. Please try again.');
      } finally {
        setIsResendingOtp(false);
      }
      return;
    }

    try {
      const phoneNumberWithCode = `${countryCode}${phoneNumber}`;
      console.log('🔄🔄🔄 ===== RESEND OTP STARTED =====');
      console.log('📞 Phone number with country code:', phoneNumberWithCode);

      const response = await authAPI.resendPhoneOtp(phoneNumberWithCode);

      console.log('📡📡📡 ===== /resend-phone-otp API RESPONSE =====');
      console.log('🔍 Full Response:', JSON.stringify(response, null, 2));
      console.log('✅ response.success:', response.success);
      console.log('📄 response.message:', response.message);
      console.log('❌ response.error:', response.error);

      if (response.success) {
        console.log('✅✅✅ OTP RESENT SUCCESSFULLY');
        setResendMessage(response.message || 'OTP has been resent to your phone number');
        setResendCooldown(60); // 60 second cooldown

        // Clear the success message after 5 seconds
        setTimeout(() => {
          setResendMessage('');
        }, 5000);
      } else {
        console.log('❌ RESEND OTP FAILED');
        setOtpError(response.error || 'Failed to resend OTP. Please try again.');
      }
    } catch (error) {
      console.error('❌❌❌ RESEND OTP EXCEPTION');
      console.error('🔥 Error:', error);
      setOtpError('An error occurred while resending OTP. Please try again.');
    } finally {
      setIsResendingOtp(false);
      console.log('🔍 Resend OTP process completed');
    }
  };

  const handleResendActivation = async () => {
    if (resendActivationCooldown > 0) {
      return; // Still in cooldown, don't allow resend
    }

    setIsResendingActivation(true);
    setResendActivationMessage('');

    try {
      console.log('📧📧📧 ===== RESEND ACTIVATION LINK STARTED =====');
      console.log('📧 Email:', formData.email);

      const response = await authAPI.resendActivationLink(formData.email);

      console.log('📡📡📡 ===== /resend-activation API RESPONSE =====');
      console.log('🔍 Full Response:', JSON.stringify(response, null, 2));
      console.log('✅ response.success:', response.success);
      console.log('📄 response.message:', response.message);
      console.log('❌ response.error:', response.error);

      if (response.success) {
        console.log('✅✅✅ ACTIVATION LINK RESENT SUCCESSFULLY');
        setResendActivationMessage(response.message || 'Activation link has been resent to your email');
        setResendActivationCooldown(60); // 60 second cooldown

        // Clear the success message after 5 seconds
        setTimeout(() => {
          setResendActivationMessage('');
        }, 5000);
      } else {
        console.log('❌ RESEND ACTIVATION FAILED');
        setResendActivationMessage(response.error || 'Failed to resend activation link. Please try again.');
      }
    } catch (error) {
      console.error('❌❌❌ RESEND ACTIVATION EXCEPTION');
      console.error('🔥 Error:', error);
      setResendActivationMessage('An error occurred while resending activation link. Please try again.');
    } finally {
      setIsResendingActivation(false);
      console.log('🔍 Resend activation process completed');
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center relative p-4">
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
          <path d="M1105 868.88C1105 1019.68 1053.62 1133.51 951.226 1210.36C848.831 1287.21 701.57 1326 509.805 1326C405.601 1326 315.146 1320.56 238.078 1309.32C161.01 1298.09 82.4951 1277.79 2.53274 1247.7V858.73C77.7914 891.718 160.286 919.268 250.018 940.656C339.75 962.044 419.712 972.919 489.905 972.919C594.833 972.919 647.297 948.994 647.297 900.78C647.297 875.767 632.462 853.654 603.155 834.442C573.847 814.866 488.458 777.166 346.986 720.615C218.178 667.689 127.723 607.513 76.706 539.724C25.3274 472.298 0 386.746 0 283.07C0 152.205 50.2931 50.3406 151.241 -22.5231C252.189 -95.3869 394.746 -132 578.913 -132C671.539 -132 758.376 -121.85 839.786 -101.549C921.195 -81.2491 1005.86 -51.5236 1093.42 -12.7354L962.081 300.47C897.677 271.469 829.293 246.819 757.652 226.519C685.65 206.218 627.035 196.068 581.446 196.068C502.207 196.068 462.407 215.644 462.407 254.432C462.407 278.357 476.156 299.02 504.016 316.058C531.876 333.096 611.839 367.534 743.903 419.735C842.318 460.335 915.768 500.211 963.89 538.999C1012.37 577.787 1047.83 623.826 1070.63 676.389C1093.42 728.952 1104.64 793.116 1104.64 868.155L1105 868.88Z" fill="url(#paint0_linear_7972_17265_signup)" fillOpacity="0.3"/>
          <defs>
            <linearGradient id="paint0_linear_7972_17265_signup" x1="552.5" y1="-132" x2="552.5" y2="1326" gradientUnits="userSpaceOnUse">
              <stop stopColor="#60B6FF" stopOpacity="0.54"/>
              <stop offset="0.710504" stopColor="#6979FF" stopOpacity="0.31"/>
              <stop offset="1" stopColor="#6C60FF"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Centered Content */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo and Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 flex justify-center items-center">
            <StashtLogo className="h-16 w-auto max-w-[200px] object-contain" fill="#6C60FF" style={{ aspectRatio: 'auto' }} />
          </div>
        
        </div>

        {/* OTP Verification Screen or Signup Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {showOtpScreen ? (
            <>
            {/* OTP Verification Screen */}
            <div>
              <CardHeader className="space-y-1 mb-6 p-0">
                <CardTitle className="text-2xl font-semibold text-center">
                  {method === "email" ? "Verify Your Email" : "Verify Your Phone"}
                </CardTitle>
                <CardDescription className="text-center">
                  {activationMessage || `Enter the OTP sent to ${method === "email" ? formData.email : `${countryCode} ${phoneNumber}`}`}
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

              <div className="space-y-6">
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
                    disabled={isVerifyingOtp}
                  />
                  {otpError && (
                    <p className="mt-2 text-sm text-red-600">{otpError}</p>
                  )}
                </div>

                {/* Verify Button */}
                <button
                  onClick={handleVerifyOtp}
                  disabled={isVerifyingOtp || otp.length < 4}
                  className="w-full bg-[#8B7EFF] hover:bg-[#7A6DED] text-white py-3 px-4 rounded-lg focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 font-medium"
                >
                  {isVerifyingOtp ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify OTP
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>

                {/* Success Message */}
                {resendMessage && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-600 text-center">{resendMessage}</p>
                  </div>
                )}

                {/* Resend OTP Link */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className={`text-sm font-medium transition-colors ${
                      resendCooldown > 0 || isResendingOtp
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-blue-600 hover:text-blue-700'
                    }`}
                    disabled={isVerifyingOtp || isResendingOtp || resendCooldown > 0}
                  >
                    {isResendingOtp ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Resending...
                      </span>
                    ) : resendCooldown > 0 ? (
                      `Resend OTP in ${resendCooldown}s`
                    ) : (
                      "Didn't receive OTP? Resend"
                    )}
                  </button>
                </div>

                {/* Back to Signup */}
                <div className="text-center pt-4">
                  <button
                    onClick={() => {
                      setShowOtpScreen(false);
                      setOtp('');
                      setOtpError('');
                    }}
                    className="text-sm text-gray-600 hover:text-gray-700 font-medium transition-colors"
                    disabled={isVerifyingOtp}
                  >
                    ← Back to Signup
                  </button>
                </div>
              </div>
            </div>
            </>
          ) : (
            <>
            {/* Show success message if registration complete, otherwise show form */}
            {registrationComplete && activationMessage ? (
              /* Registration Success Screen */
              <div className="space-y-6">
                <CardHeader className="space-y-1 mb-6 p-0">
                  <CardTitle className="text-2xl font-semibold text-center text-green-600">Registration Successful!</CardTitle>
                  <CardDescription className="text-center">
                    Your account has been created
                  </CardDescription>
                </CardHeader>

                {/* Success Message Banner */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm text-green-700">{activationMessage}</p>
                    </div>
                  </div>
                </div>

                {/* Resend Activation Link - Only for email method */}
                {method === "email" && (
                  <div className="space-y-3">
                    {/* Resend Success/Error Message */}
                    {resendActivationMessage && (
                      <div className={`border rounded-lg p-3 ${
                        resendActivationMessage.includes('error') || resendActivationMessage.includes('Failed')
                          ? 'bg-red-50 border-red-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}>
                        <p className={`text-sm text-center ${
                          resendActivationMessage.includes('error') || resendActivationMessage.includes('Failed')
                            ? 'text-red-600'
                            : 'text-blue-600'
                        }`}>{resendActivationMessage}</p>
                      </div>
                    )}

                    {/* Resend Button */}
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-2">Didn't receive the email?</p>
                      <button
                        type="button"
                        onClick={handleResendActivation}
                        className={`text-sm font-medium transition-colors ${
                          resendActivationCooldown > 0 || isResendingActivation
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-blue-600 hover:text-blue-700'
                        }`}
                        disabled={isResendingActivation || resendActivationCooldown > 0}
                      >
                        {isResendingActivation ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Resending activation link...
                          </span>
                        ) : resendActivationCooldown > 0 ? (
                          `Resend activation link in ${resendActivationCooldown}s`
                        ) : (
                          "Resend activation link"
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Back to Login */}
                <div className="text-center pt-4">
                  <p className="text-gray-600 text-sm">
                    Already activated?{' '}
                    <button
                      onClick={onSwitchToLogin}
                      className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              </div>
            ) : (
              /* Signup Form */
            <div>
              <CardHeader className="space-y-1 mb-3 p-0">
                {/* Desktop only - Mobile shows this in logo section */}
                <CardTitle className="hidden md:block text-2xl font-semibold text-center">Create Account</CardTitle>
                <CardDescription className="hidden md:block text-center">
                  Join Stasht and start preserving your campaigns securely
                </CardDescription>
              </CardHeader>

          {/* Social Login Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button
              type="button"
              variant="outline"
              className="h-11 border-gray-200 hover:bg-gray-50"
              onClick={handleGoogleSignup}
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
              onClick={handleAppleSignup}
              disabled={isSubmitting}
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
              <span className="bg-white px-2 text-gray-500">or sign in with</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 signup-form text-selectable">
            {/* Username Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleInputChange}
                autoComplete="off"
                maxLength={20}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                  errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-[#F3F3F5]'
                }`}
                placeholder="Choose a unique username"
                disabled={isSubmitting}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Sign up method selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How would you like to sign up? <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center space-x-6">
                <label className={`flex items-center ${(isCollaboratorLocked && method !== "phone") || isEmailPrefilled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                  <input
                    type="radio"
                    name="signUpMethod"
                    value="phone"
                    checked={method === "phone"}
                    onChange={() => setMethod("phone")}
                    disabled={(isCollaboratorLocked && method !== "phone") || isEmailPrefilled}
                    className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <Phone className="ml-2 h-4 w-4 text-gray-500" />
                  <span className="ml-2 text-[12px] md:text-[14px] text-gray-700">Phone number</span>
                </label>

                <label className={`flex items-center ${isCollaboratorLocked && method !== "email" ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                  <input
                    type="radio"
                    name="signUpMethod"
                    value="email"
                    checked={method === "email"}
                    onChange={() => setMethod("email")}
                    disabled={isCollaboratorLocked && method !== "email"}
                    className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <Mail className="ml-2 h-4 w-4 text-gray-500" />
                  <span className="ml-2 text-[12px] md:text-[14px] text-gray-700">Email address</span>
                </label>
              </div>
            </div>

            {/* Phone/Email Field */}
            {method === "phone" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone number <span className="text-red-500">*</span>
                  {isCollaboratorLocked && <span className="text-xs text-gray-500 ml-1">(locked for invite)</span>}
                </label>
                <div className="flex gap-1 sm:gap-2">
                  <CountrySelect
                    value={countryCode}
                    onChange={setCountryCode}
                    disabled={isCollaboratorLocked}
                    className="w-24 sm:w-32 h-11 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-[#F3F3F5] text-sm flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <input
                    id="signup-phone-input"
                    name="phone-number-signup"
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter your phone number"
                    value={phoneNumber}
                    onChange={(e) => {
                      if (!isCollaboratorLocked) {
                        const numericValue = e.target.value.replace(/\D/g, '');
                        setPhoneNumber(numericValue);
                        // Clear phone error when user starts typing
                        if (errors.phone) {
                          setErrors(prev => ({ ...prev, phone: '' }));
                        }
                      }
                    }}
                    autoComplete="new-password"
                    readOnly={isCollaboratorLocked}
                    className={`flex-1 min-w-0 h-11 px-4 border rounded-lg bg-[#F3F3F5] focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 text-sm ${
                      errors.phone ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    } ${isCollaboratorLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email address <span className="text-red-500">*</span>
                  {isCollaboratorLocked && <span className="text-xs text-gray-500 ml-1">(locked for invite)</span>}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    if (!isCollaboratorLocked) {
                      handleInputChange(e);
                    }
                  }}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                    errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-[#F3F3F5]'
                  } ${isCollaboratorLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  placeholder="Enter your email"
                  disabled={isSubmitting}
                  readOnly={isCollaboratorLocked}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>
            )}

            {/* Password Field */}
            {authMode === "password" && (
            <>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2.5 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                    errors.password ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-[#F3F3F5]'
                  }`}
                  placeholder="Create a strong password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 transition-colors"
                  disabled={isSubmitting}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}

              {/* Password requirements checklist */}
              {formData.password.length > 0 && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Password requirements:</p>
                  <ul className="space-y-1">
                    {[
                      { label: 'At least 8 characters', met: formData.password.length >= 8 },
                      { label: 'One uppercase letter', met: /[A-Z]/.test(formData.password) },
                      { label: 'One number', met: /[0-9]/.test(formData.password) },
                      { label: 'Passwords match', met: formData.password === formData.confirmPassword && formData.confirmPassword.length > 0 },
                    ].map(({ label, met }) => (
                      <li key={label} className="flex items-center gap-2 text-xs">
                        <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${met ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                        <span className={`transition-colors ${met ? 'text-green-600 font-medium' : 'text-gray-500'}`}>{label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2.5 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                    errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-[#F3F3F5]'
                  }`}
                  placeholder="Re-enter your password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 transition-colors"
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>
            </>
            )}


            {/* Terms Checkbox */}
            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                className="mt-0.5"
              />
              <label htmlFor="terms" className="text-sm text-gray-600">
                I agree to the{' '}
                <a href="https://www.stasht.com/terms-conditions" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="https://www.stasht.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Privacy Policy</a>
                <span className="text-red-500">*</span>
              </label>
            </div>
            {errors.terms && (
              <p className="text-sm text-red-600">{errors.terms}</p>
            )}

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || registrationComplete}
              className="w-full bg-[#8B7EFF] hover:bg-[#7A6DED] text-white py-2.5 px-4 rounded-lg focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {authMode === "otp" ? "Sending OTP..." : "Creating Account..."}
                </>
              ) : registrationComplete ? (
                <>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Registration Complete
                </>
              ) : authMode === "otp" ? (
                <>
                  <ArrowRight className="h-5 w-5" />
                  Send OTP
                </>
              ) : (
                <>
                  <User className="h-5 w-5" />
                  Create Account
                </>
              )}
            </button>

            {/* SMS/Email consent disclaimer */}
            {authMode === "otp" && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-700">
                  {method === "phone" ? (
                    <>
                      By requesting this code, you agree to receive a one-time transactional SMS from Stasht to verify your account. No password needed. Msg &amp; data rates may apply. Message frequency varies. Reply STOP to opt out, HELP for help. View our{" "}
                      <a href="https://www.stasht.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>
                      {" "}and{" "}
                      <a href="https://www.stasht.com/terms-conditions" target="_blank" rel="noopener noreferrer" className="underline">Terms</a>.
                    </>
                  ) : (
                    <>We'll send a 6-digit code to your email to verify your account. No password needed.</>
                  )}
                </p>
              </div>
            )}

          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Already have an account?{' '}
              <button
                onClick={onSwitchToLogin}
                className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                disabled={isSubmitting}
              >
                Sign-in
              </button>
            </p>
          </div>
        </div>
            )}
        </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-gray-500">
          <p>
            By continuing, you agree to our{' '}
            <a href="https://www.stasht.com/terms-conditions" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="https://www.stasht.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>

      {/* Google Photos Connect Modal */}
      <GooglePhotosConnectModal
        isOpen={showGooglePhotosModal}
        onClose={() => setShowGooglePhotosModal(false)}
        onConnect={handleConnectGooglePhotos}
        onMaybeLater={handleGooglePhotosMaybeLater}
      />

      {/* Popup Blocked Guide Modal */}
      <PopupBlockedGuideModal
        isOpen={showPopupGuide}
        onClose={() => setShowPopupGuide(false)}
        onRetry={handleConnectGooglePhotos}
      />

      {/* Account Choice Modal (for admin collaborators) */}
      {adminCollaborators.length > 0 && pendingSignupUser && (
        <AccountChoiceModal
          isOpen={showAccountChoice}
          onClose={() => {
            setShowAccountChoice(false);
            // If user closes modal without choosing, just reload with personal account
            window.location.reload();
          }}
          adminCollaborators={adminCollaborators}  // Pass array
          personalUser={pendingSignupUser}
          personalToken={pendingSignupToken}
          onComplete={() => {
            setShowAccountChoice(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}