import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, Phone, Mail, Loader2, ChevronDown, MapPin, Search } from 'lucide-react';
import { dashboardAPI, authAPI } from '../utils/authUtils';
import StashtLogo from '../components/StashtLogo';
import CountrySelect from '../components/CountrySelect';
import { toast, Toaster } from 'sonner';

interface PropertyData {
  id?: number;
  name?: string;
  location?: string;
  image?: string;
  creator?: {
    id?: number;
    name?: string;
    email?: string;
    profile_image?: string | null;
  };
}

export default function PropertyRegisterPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [propertyData, setPropertyData] = useState<PropertyData | null>(null);
  const [propertiesWithInvite, setPropertiesWithInvite] = useState<any[]>([]);
  const [selectedInviteProperty, setSelectedInviteProperty] = useState<any>(null);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signUpMethod, setSignUpMethod] = useState<'phone' | 'email'>('phone');
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');

  // Existing user detection
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [alreadyHasAccess, setAlreadyHasAccess] = useState(false);
  const checkDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // OTP verification step — new users prove ownership of the phone/email via
  // OTP instead of setting a password (passwordless, like SignupPage.tsx).
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Fetch property data on mount
  useEffect(() => {
    const fetchPropertyData = async () => {
      if (!token) {
        setError('Invalid registration link');
        setIsLoading(false);
        return;
      }

      try {
        const response = await dashboardAPI.getPropertyByToken(token);
        console.log('Property registration API response:', response);

        if (response.success && response.data) {
          // API returns: { status: "success", data: { property: {...}, invite: {...} } }
          // Extract the property object from the nested structure
          const actualData = response.data.data || response.data;
          const propertyInfo = actualData.property;
          console.log('Property info:', propertyInfo);

          if (propertyInfo) {
            setPropertyData(propertyInfo);
          } else {
            setError('Property information not found');
          }

          // Extract properties_with_invite list
          const inviteList = actualData.properties_with_invite || [];
          if (inviteList.length > 0) {
            setPropertiesWithInvite(inviteList);
            // Do not auto-select — user must choose manually
          }
        } else {
          setError(response.error || 'Failed to load property information');
        }
      } catch (err) {
        console.error('Error fetching property data:', err);
        setError('An error occurred while loading property information');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPropertyData();
  }, [token]);

  // OTP expiry countdown (10 minutes)
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  // Resend-OTP cooldown (60s)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Check if user exists (debounced)
  const triggerUserCheck = (value: string, method: 'phone' | 'email') => {
    if (checkDebounceRef.current) clearTimeout(checkDebounceRef.current);

    // Reset if field is cleared
    if (!value.trim()) {
      setIsExistingUser(false);
      return;
    }

    // Only check when value is long enough to be valid
    const isReady = method === 'email'
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      : value.replace(/\D/g, '').length >= 10;

    if (!isReady) return;

    checkDebounceRef.current = setTimeout(async () => {
      setIsCheckingUser(true);
      try {
        const payload = method === 'email'
          ? { email: value }
          : { phone_number: `${countryCode}${value.replace(/\D/g, '')}` };

        const response = await dashboardAPI.checkUserExists(payload);

        if (response.success && response.data?.exists) {
          const d = response.data;
          const first = d.first_name || d.user?.first_name || d.name?.split(' ')[0] || d.user?.name?.split(' ')[0] || '';
          const last = d.last_name || d.user?.last_name || d.name?.split(' ').slice(1).join(' ') || d.user?.name?.split(' ').slice(1).join(' ') || '';
          setFirstName(first);
          setLastName(last);
          setIsExistingUser(true);
        } else {
          setIsExistingUser(false);
        }
      } catch {
        setIsExistingUser(false);
      } finally {
        setIsCheckingUser(false);
      }
    }, 600);
  };

  // Helper function to get initials from name (first and last letter)
  const getInitials = (name: string | undefined) => {
    if (!name) return 'U';
    const cleanName = name.trim();
    if (cleanName.length === 0) return 'U';
    if (cleanName.length === 1) return cleanName.charAt(0).toUpperCase();
    // Get first and last letter
    return (cleanName.charAt(0) + cleanName.charAt(cleanName.length - 1)).toUpperCase();
  };

  const handleBack = () => {
    navigate(-1);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Property selection validation
    if (propertiesWithInvite.length > 0 && !selectedInviteProperty) {
      errors.property = 'Please select a property';
    }

    // Name validation only for new users (existing users have names auto-filled from backend)
    if (!isExistingUser) {
      if (!firstName.trim()) {
        errors.firstName = 'First name is required';
      } else if (firstName.trim().length < 2) {
        errors.firstName = 'First name must be at least 2 characters long';
      }

      if (!lastName.trim()) {
        errors.lastName = 'Last name is required';
      } else if (lastName.trim().length < 2) {
        errors.lastName = 'Last name must be at least 2 characters long';
      }
    }

    // Phone/Email validation based on selected method
    if (signUpMethod === 'phone') {
      if (!phoneNumber || !phoneNumber.trim()) {
        errors.phone = 'Phone number is required';
      } else if (phoneNumber.trim().length < 10) {
        errors.phone = 'Please enter a valid phone number';
      }
    } else if (signUpMethod === 'email') {
      if (!emailAddress) {
        errors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
        errors.email = 'Please enter a valid email address';
      }
    }

    setFormErrors(errors);

    const errorMessages = Object.values(errors);
    if (errorMessages.length > 0) {
      toast.error(errorMessages[0]);
    }

    return errorMessages.length === 0;
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!token) {
      toast.error('Invalid registration link');
      return;
    }

    // Existing users need no credentials at all — join immediately, unchanged.
    if (isExistingUser) {
      await completeRegistration({});
      return;
    }

    // New users prove ownership of the phone/email via OTP instead of a
    // password. Account creation happens later, in handleVerifyOtp.
    setIsSubmitting(true);
    setFormErrors({});

    try {
      const identifier = signUpMethod === 'phone'
        ? { phone_number: `${countryCode}${phoneNumber}` }
        : { email: emailAddress };

      const res = await authAPI.sendOtp(identifier, 'register');

      if (res.success) {
        setShowOtpScreen(true);
        setOtp('');
        setOtpError('');
        setOtpCountdown(600);
        setResendCooldown(60);
      } else if (res.alreadyRegistered) {
        setIsExistingUser(true);
        toast.error('This account already exists — click Join Property to continue.');
      } else {
        toast.error(res.error || 'Failed to send OTP. Please try again.');
      }
    } catch (err) {
      console.error('Send OTP error:', err);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.trim().length < 4) {
      setOtpError('Please enter a valid OTP');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError('');

    const identifier = signUpMethod === 'phone'
      ? { phone_number: `${countryCode}${phoneNumber}` }
      : { email: emailAddress };

    try {
      const verifyRes = await authAPI.verifyOtp({ ...identifier, otp: otp.trim() });

      if (!verifyRes.success || !verifyRes.verification_token) {
        setOtpError(verifyRes.error || 'Invalid OTP. Please try again.');
        return;
      }

      await completeRegistration({ verification_token: verifyRes.verification_token });
    } catch (err) {
      console.error('Verify OTP error:', err);
      setOtpError('An error occurred. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;

    setIsResendingOtp(true);
    setOtpError('');

    try {
      const identifier = signUpMethod === 'phone'
        ? { phone_number: `${countryCode}${phoneNumber}` }
        : { email: emailAddress };

      const res = await authAPI.sendOtp(identifier, 'register');

      if (res.success) {
        setOtp('');
        setOtpCountdown(600);
        setResendCooldown(60);
        toast.success('A new code has been sent.');
      } else {
        setOtpError(res.error || 'Failed to resend OTP.');
      }
    } catch (err) {
      console.error('Resend OTP error:', err);
      setOtpError('An error occurred. Please try again.');
    } finally {
      setIsResendingOtp(false);
    }
  };

  const completeRegistration = async (credentials: { password?: string; verification_token?: string }) => {
    if (!token) {
      toast.error('Invalid registration link');
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});
    setSuccessMessage('');

    try {
      // Prepare registration data with all fields - combine first and last name
      const fullName = lastName.trim()
        ? `${firstName.trim()} ${lastName.trim()}`
        : firstName.trim();

      const registrationData: {
        invite_token: string;
        property_id?: number;
        name: string;
        email?: string;
        phone_number?: string;
        password?: string;
        verification_token?: string;
      } = {
        invite_token: token,
        ...(selectedInviteProperty?.id && { property_id: selectedInviteProperty.id }),
        name: fullName,
        ...credentials,
      };

      if (signUpMethod === 'phone') {
        registrationData.phone_number = `${countryCode}${phoneNumber}`;
      } else {
        registrationData.email = emailAddress;
      }

      console.log('Registering property user with:', registrationData);

      const response = await dashboardAPI.registerPropertyUser(token, registrationData);
      console.log('Property registration response:', response);

      if (response.success) {
        setRegistrationComplete(true);

        // apiRequest wraps backend JSON under response.data
        // Backend sends: { success, message, data: { property_access: {...} } }
        const backendMessage = response.data?.message;
        // alreadyHasAccess is true only when user was already a member (collaborators array is non-empty)
        const hasAccess = Array.isArray(response.data?.data?.collaborators) && response.data.data.collaborators.length > 0;

        setAlreadyHasAccess(hasAccess);
        setSuccessMessage(
          backendMessage || (
            signUpMethod === 'phone'
              ? 'Registration successful! Please verify your phone number with the OTP sent.'
              : 'Registration successful! Please check your email to activate your account.'
          )
        );

        toast.success(backendMessage || 'Registration successful!');

        // Logout current user and redirect to login after 3 seconds
        setTimeout(() => {
          console.log('🏠 PropertyRegister: Logging out current user before redirect...');

          // Clear all authentication data
          localStorage.removeItem('stasht_token');
          localStorage.removeItem('stasht_user');
          localStorage.removeItem('admin_switch_data');
          localStorage.removeItem('selected_property');

          console.log('🏠 PropertyRegister: Current user logged out, redirecting to login...');

          // Navigate to login page with email/phone pre-filled via URL params
          // Uses prefill_* names to avoid conflicting with magic link ?email= handler
          if (signUpMethod === 'email' && emailAddress) {
            window.location.href = '/?prefill_email=' + encodeURIComponent(emailAddress);
          } else if (signUpMethod === 'phone' && phoneNumber) {
            window.location.href = '/?prefill_phone=' + encodeURIComponent(phoneNumber) + '&prefill_country_code=' + encodeURIComponent(countryCode);
          } else {
            window.location.href = '/';
          }
        }, 3000);
      } else {
        // Handle validation errors
        if (response.errors) {
          const newErrors: Record<string, string> = {};
          Object.keys(response.errors).forEach(field => {
            if (Array.isArray(response.errors[field]) && response.errors[field].length > 0) {
              newErrors[field] = response.errors[field][0];
            }
          });
          setFormErrors(newErrors);
        }

        toast.error(response.error || response.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Property registration error:', err);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error || !propertyData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-red-600 mb-4">{error || 'Property not found'}</div>
          <button
            onClick={handleBack}
            className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center relative p-4">
      <Toaster position="top-right" richColors />
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
          <path d="M1105 868.88C1105 1019.68 1053.62 1133.51 951.226 1210.36C848.831 1287.21 701.57 1326 509.805 1326C405.601 1326 315.146 1320.56 238.078 1309.32C161.01 1298.09 82.4951 1277.79 2.53274 1247.7V858.73C77.7914 891.718 160.286 919.268 250.018 940.656C339.75 962.044 419.712 972.919 489.905 972.919C594.833 972.919 647.297 948.994 647.297 900.78C647.297 875.767 632.462 853.654 603.155 834.442C573.847 814.866 488.458 777.166 346.986 720.615C218.178 667.689 127.723 607.513 76.706 539.724C25.3274 472.298 0 386.746 0 283.07C0 152.205 50.2931 50.3406 151.241 -22.5231C252.189 -95.3869 394.746 -132 578.913 -132C671.539 -132 758.376 -121.85 839.786 -101.549C921.195 -81.2491 1005.86 -51.5236 1093.42 -12.7354L962.081 300.47C897.677 271.469 829.293 246.819 757.652 226.519C685.65 206.218 627.035 196.068 581.446 196.068C502.207 196.068 462.407 215.644 462.407 254.432C462.407 278.357 476.156 299.02 504.016 316.058C531.876 333.096 611.839 367.534 743.903 419.735C842.318 460.335 915.768 500.211 963.89 538.999C1012.37 577.787 1047.83 623.826 1070.63 676.389C1093.42 728.952 1104.64 793.116 1104.64 868.155L1105 868.88Z" fill="url(#paint0_linear_property_register)" fillOpacity="0.3"/>
          <defs>
            <linearGradient id="paint0_linear_property_register" x1="552.5" y1="-132" x2="552.5" y2="1326" gradientUnits="userSpaceOnUse">
              <stop stopColor="#60B6FF" stopOpacity="0.54"/>
              <stop offset="0.710504" stopColor="#6979FF" stopOpacity="0.31"/>
              <stop offset="1" stopColor="#6C60FF"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Centered Content */}
      <div className="w-full max-w-md relative z-10">
        {/* Creator Profile */}
        <div className="text-center mb-6">
          {propertyData.creator && (
            <div className="mb-4">
              <div className="w-24 h-24 rounded-full bg-gray-200 mx-auto mb-3 overflow-hidden">
                {propertyData.creator.profile_image ? (
                  <img
                    src={propertyData.creator.profile_image}
                    alt={propertyData.creator.name || 'Creator'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-semibold text-gray-600">
                    {getInitials(propertyData.creator.name)}
                  </div>
                )}
              </div>
              <div className="text-gray-900 font-medium">{propertyData.creator.name || 'Property Creator'}</div>
            </div>
          )}
        </div>

        {/* Property Card — hidden when dropdown handles selection */}
        {propertiesWithInvite.length === 0 && <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            {propertyData.image ? (
              <img
                src={propertyData.image}
                alt={propertyData.name || 'Property'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-semibold text-gray-600">
                {propertyData.name ? propertyData.name.charAt(0).toUpperCase() : 'P'}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900">{propertyData.name || 'Property'}</div>
            {propertyData.location && (
              <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {propertyData.location}
              </div>
            )}
          </div>
        </div>}

        {/* Registration Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {registrationComplete && successMessage ? (
            /* Registration Success Screen */
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-green-600 mb-2">
                  {alreadyHasAccess ? 'Already a Member!' : 'Registration Successful!'}
                </h2>
                <p className="text-base text-gray-600">
                  {alreadyHasAccess ? 'You already have access to this property.' : 'Your account has been created'}
                </p>
              </div>

              {/* Success Message */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-base text-green-700">{successMessage}</p>
                  </div>
                </div>
              </div>

              {/* Redirecting message */}
              <div className="text-center">
                <p className="text-base text-gray-600">
                  {alreadyHasAccess ? 'Redirecting to login to access the property...' : 'Redirecting to login...'}
                </p>
              </div>
            </div>
          ) : showOtpScreen ? (
            /* OTP Verification Screen */
            <div className="space-y-4">
              <div className="mb-2">
                <h2 className="text-2xl font-semibold text-center mb-2">Verify your {signUpMethod === 'phone' ? 'phone number' : 'email'}</h2>
                <p className="text-base text-gray-600 text-center">
                  We sent a code to {signUpMethod === 'phone' ? `${countryCode}${phoneNumber}` : emailAddress}
                </p>
                {otpCountdown > 0 && (
                  <p className="text-sm text-gray-400 text-center mt-1">
                    Code expires in {Math.floor(otpCountdown / 60)}:{String(otpCountdown % 60).padStart(2, '0')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-base font-medium text-gray-700 mb-3">
                  Verification code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); if (otpError) setOtpError(''); }}
                  placeholder="Enter 6-digit code"
                  className={`w-full px-4 py-3 text-base text-center tracking-widest border rounded-lg bg-[#F3F3F5] focus:outline-none focus:border-black ${
                    otpError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  autoComplete="one-time-code"
                  disabled={isVerifyingOtp}
                  autoFocus
                />
                {otpError && (
                  <p className="mt-2 text-sm text-red-600">{otpError}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowOtpScreen(false); setOtp(''); setOtpError(''); }}
                  className="flex-1 px-6 py-3 text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  disabled={isVerifyingOtp}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  className="flex-1 px-6 py-3 text-base bg-[#8B7EFF] hover:bg-[#7A6DED] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={isVerifyingOtp || isSubmitting}
                >
                  {isVerifyingOtp || isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Create Account'
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="text-sm text-[#8B7EFF] hover:text-[#7A6DED] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isResendingOtp || resendCooldown > 0}
                >
                  {isResendingOtp
                    ? 'Resending...'
                    : resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : 'Resend code'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-center mb-2">Sign Up</h2>
                <p className="text-base text-gray-600 text-center">Join the property to start creating campaigns</p>
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-4">
            {/* Property Selection Dropdown — shown when multiple properties are available */}
            {propertiesWithInvite.length > 0 && (
              <div className="relative">
                <label className="block text-base font-medium text-gray-700 mb-3">
                  Select Property <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setShowPropertyDropdown(prev => !prev); setPropertySearch(''); }}
                  className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg bg-[#F3F3F5] focus:outline-none focus:border-black flex items-center justify-between disabled:opacity-60"
                  disabled={isSubmitting}
                >
                  {selectedInviteProperty ? (
                    <span className="flex items-center gap-3 min-w-0 flex-1 text-left">
                      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                        {selectedInviteProperty.image ? (
                          <img src={selectedInviteProperty.image} alt={selectedInviteProperty.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-gray-600">
                            {selectedInviteProperty.name?.charAt(0).toUpperCase() || 'P'}
                          </div>
                        )}
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-900 truncate text-left">{selectedInviteProperty.name}</span>
                        {selectedInviteProperty.location && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{selectedInviteProperty.location}</span>
                          </span>
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm text-left">Select a property</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 ml-2 transition-transform ${showPropertyDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showPropertyDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                    {propertiesWithInvite.length > 6 && (
                      <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            value={propertySearch}
                            onChange={(e) => setPropertySearch(e.target.value)}
                            placeholder="Search property..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md bg-[#F3F3F5] focus:outline-none focus:border-black"
                            autoFocus
                          />
                        </div>
                      </div>
                    )}
                    <div className="max-h-56 overflow-y-auto">
                    {propertiesWithInvite
                      .filter((prop: any) =>
                        !propertySearch.trim() ||
                        prop.name?.toLowerCase().includes(propertySearch.toLowerCase()) ||
                        prop.location?.toLowerCase().includes(propertySearch.toLowerCase())
                      )
                      .map((prop: any, index: number) => (
                      <button
                        key={prop.id ?? index}
                        type="button"
                        onClick={() => {
                          setSelectedInviteProperty(prop);
                          setShowPropertyDropdown(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                          selectedInviteProperty?.id === prop.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                          {prop.image ? (
                            <img src={prop.image} alt={prop.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-gray-600">
                              {prop.name?.charAt(0).toUpperCase() || 'P'}
                            </div>
                          )}
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm font-medium truncate ${selectedInviteProperty?.id === prop.id ? 'text-blue-700' : 'text-gray-900'}`}>
                            {prop.name || `Property ${index + 1}`}
                          </span>
                          {prop.location && (
                            <span className="flex items-center gap-1 text-xs text-gray-500 truncate">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{prop.location}</span>
                            </span>
                          )}
                        </span>
                        {selectedInviteProperty?.id === prop.id && (
                          <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                    {propertiesWithInvite.filter((prop: any) =>
                      !propertySearch.trim() ||
                      prop.name?.toLowerCase().includes(propertySearch.toLowerCase()) ||
                      prop.location?.toLowerCase().includes(propertySearch.toLowerCase())
                    ).length === 0 && (
                      <div className="px-4 py-6 text-sm text-gray-400 text-center">No properties found</div>
                    )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* First Name and Last Name Fields — hidden for existing users */}
            {!isExistingUser && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label htmlFor="firstName" className="block text-base font-medium text-gray-700 mb-3">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (formErrors.firstName) {
                        setFormErrors(prev => ({ ...prev, firstName: '' }));
                      }
                    }}
                    className={`w-full px-4 py-3 text-base border rounded-lg bg-[#F3F3F5] focus:outline-none focus:border-black ${
                      formErrors.firstName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="First Name"
                    autoComplete="off"
                    disabled={isSubmitting}
                  />
                  {formErrors.firstName && (
                    <p className="mt-2 text-sm text-red-600">{formErrors.firstName}</p>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label htmlFor="lastName" className="block text-base font-medium text-gray-700 mb-3">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      if (formErrors.lastName) {
                        setFormErrors(prev => ({ ...prev, lastName: '' }));
                      }
                    }}
                    className={`w-full px-4 py-3 text-base border rounded-lg bg-[#F3F3F5] focus:outline-none focus:border-black ${
                      formErrors.lastName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="Last Name"
                    autoComplete="off"
                    disabled={isSubmitting}
                  />
                  {formErrors.lastName && (
                    <p className="mt-2 text-sm text-red-600">{formErrors.lastName}</p>
                  )}
                </div>
              </div>
            )}

            {/* Sign Up Method */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-3">
                How would you like to sign up? <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center space-x-6">
                <label className={`flex items-center ${isSubmitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                  <input
                    type="radio"
                    name="signUpMethod"
                    checked={signUpMethod === 'phone'}
                    onChange={() => { setSignUpMethod('phone'); setIsExistingUser(false); setPhoneNumber(''); setEmailAddress(''); }}
                    className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                    disabled={isSubmitting}
                  />
                  <Phone className="ml-2 h-4 w-4 text-gray-500" />
                  <span className="ml-2 text-base text-gray-700">Phone number</span>
                </label>
                <label className={`flex items-center ${isSubmitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                  <input
                    type="radio"
                    name="signUpMethod"
                    checked={signUpMethod === 'email'}
                    onChange={() => { setSignUpMethod('email'); setIsExistingUser(false); setPhoneNumber(''); setEmailAddress(''); }}
                    className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                    disabled={isSubmitting}
                  />
                  <Mail className="ml-2 h-4 w-4 text-gray-500" />
                  <span className="ml-2 text-base text-gray-700">Email address</span>
                </label>
              </div>
            </div>

            {/* Phone/Email Input */}
            {signUpMethod === 'phone' ? (
              <div>
                <label className="block text-base font-medium text-gray-700 mb-3">
                  Phone number <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <CountrySelect
                    value={countryCode}
                    onChange={setCountryCode}
                    className="w-24 sm:w-32 h-12 border border-gray-300 rounded-lg focus:outline-none focus:border-black bg-[#F3F3F5] text-base flex-shrink-0"
                    disabled={isSubmitting}
                  />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      const numericValue = e.target.value.replace(/\D/g, '');
                      setPhoneNumber(numericValue);
                      if (formErrors.phone) {
                        setFormErrors(prev => ({ ...prev, phone: '' }));
                      }
                      triggerUserCheck(numericValue, 'phone');
                    }}
                    placeholder="(555) 123-4567"
                    className={`flex-1 min-w-0 h-12 px-4 text-base border rounded-lg bg-[#F3F3F5] focus:outline-none focus:border-black ${
                      formErrors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    autoComplete="off"
                    disabled={isSubmitting}
                  />
                </div>
                {formErrors.phone && (
                  <p className="mt-2 text-sm text-red-600">{formErrors.phone}</p>
                )}
                {isCheckingUser && (
                  <p className="mt-2 text-sm text-gray-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-base font-medium text-gray-700 mb-3">
                  Email address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => {
                    setEmailAddress(e.target.value);
                    if (formErrors.email) {
                      setFormErrors(prev => ({ ...prev, email: '' }));
                    }
                    triggerUserCheck(e.target.value, 'email');
                  }}
                  placeholder="your.email@example.com"
                  className={`w-full px-4 py-3 text-base border rounded-lg bg-[#F3F3F5] focus:outline-none focus:border-black ${
                    formErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  autoComplete="off"
                  disabled={isSubmitting}
                />
                {formErrors.email && (
                  <p className="mt-2 text-sm text-red-600">{formErrors.email}</p>
                )}
                {isCheckingUser && (
                  <p className="mt-2 text-sm text-gray-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                  </p>
                )}
              </div>
            )}

            {/* Existing user banner */}
            {isExistingUser && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3">
                <Check className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Welcome back, {firstName}!</p>
                  <p className="text-xs text-blue-600 mt-0.5">We found your account. Just click below to join the property.</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 px-6 py-3 text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={isSubmitting}
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 text-base bg-[#8B7EFF] hover:bg-[#7A6DED] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isExistingUser ? 'Joining...' : 'Sending code...'}
                  </>
                ) : (
                  isExistingUser ? 'Join Property' : 'Continue'
                )}
              </button>
            </div>
          </form>
            </>
          )}
        </div>

        {/* Powered by Stasht */}
        <div className="text-center mt-6">
          <div className="text-xs text-gray-500">
            Powered by <span className="font-semibold text-purple-600">stasht</span>
          </div>
        </div>
      </div>
    </div>
  );
}
