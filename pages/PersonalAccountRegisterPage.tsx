import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Check, Phone, Mail, Loader2 } from 'lucide-react';
import { dashboardAPI, authAPI } from '../utils/authUtils';
import StashtLogo from '../components/StashtLogo';
import CountrySelect from '../components/CountrySelect';
import { toast } from 'sonner';

interface InviteInfo {
  owner_name?: string;
  owner_avatar?: string | null;
}

export default function PersonalAccountRegisterPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
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
  const checkDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // OTP verification step — new users prove ownership of the phone/email via
  // OTP instead of setting a password (passwordless, like SignupPage.tsx).
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpCountdown, setOtpCountdown] = useState(0);

  useEffect(() => {
    if (!token) {
      setError('Invalid registration link.');
      setIsLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await dashboardAPI.getPersonalInviteInfo(token);
        if (res.success && res.data) {
          const d = res.data.data || res.data;
          setInviteInfo({ owner_name: d.owner_name || d.name || 'Someone', owner_avatar: d.owner_avatar || d.profile_image || null });
        } else {
          setError(res.error || 'This invite link is invalid or has expired.');
        }
      } catch {
        setError('Failed to load invite details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    })();
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

  const triggerUserCheck = (value: string, method: 'phone' | 'email') => {
    if (checkDebounceRef.current) clearTimeout(checkDebounceRef.current);
    if (!value.trim()) { setIsExistingUser(false); return; }

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
          setFirstName(d.first_name || d.user?.first_name || d.name?.split(' ')[0] || '');
          setLastName(d.last_name || d.user?.last_name || d.name?.split(' ').slice(1).join(' ') || '');
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

  const getInitials = (name?: string) => {
    if (!name?.trim()) return 'U';
    const clean = name.trim();
    return clean.length === 1 ? clean.toUpperCase() : (clean[0] + clean[clean.length - 1]).toUpperCase();
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!isExistingUser) {
      if (!firstName.trim() || firstName.trim().length < 2) errors.firstName = 'First name must be at least 2 characters';
      if (!lastName.trim() || lastName.trim().length < 2) errors.lastName = 'Last name must be at least 2 characters';
    }
    if (signUpMethod === 'phone') {
      if (!phoneNumber.trim() || phoneNumber.trim().length < 10) errors.phone = 'Please enter a valid phone number';
    } else {
      if (!emailAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) errors.email = 'Please enter a valid email address';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !token) return;

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
        toast.error('This account already exists — click Join Account to continue.');
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
    if (!token) return;

    setIsSubmitting(true);
    setFormErrors({});

    try {
      let response;
      if (isExistingUser) {
        const payload: any = { invite_token: token };
        if (signUpMethod === 'phone') {
          payload.phone_number = `${countryCode}${phoneNumber}`;
        } else {
          payload.email = emailAddress;
        }
        response = await dashboardAPI.joinViaInvite(payload);
      } else {
        const fullName = lastName.trim() ? `${firstName.trim()} ${lastName.trim()}` : firstName.trim();
        const payload: any = {
          invite_token: token,
          name: fullName,
          ...credentials,
        };
        if (signUpMethod === 'phone') {
          payload.phone_number = `${countryCode}${phoneNumber}`;
        } else {
          payload.email = emailAddress;
        }
        response = await dashboardAPI.registerViaPersonalInvite(payload);
      }
      if (response.success) {
        setRegistrationComplete(true);
        const msg = response.data?.message || response.data?.data?.message ||
          (signUpMethod === 'phone'
            ? 'Registration successful! Please verify your phone number with the OTP sent.'
            : 'Registration successful! Please check your email to activate your account.');
        setSuccessMessage(msg);
        toast.success(response.data?.message || 'Registration successful!');
        setTimeout(() => {
          localStorage.removeItem('stasht_token');
          localStorage.removeItem('stasht_user');
          localStorage.removeItem('admin_switch_data');
          localStorage.removeItem('selected_property');
          if (signUpMethod === 'email' && emailAddress) {
            window.location.href = '/?prefill_email=' + encodeURIComponent(emailAddress);
          } else if (signUpMethod === 'phone' && phoneNumber) {
            window.location.href = '/?prefill_phone=' + encodeURIComponent(phoneNumber) + '&prefill_country_code=' + encodeURIComponent(countryCode);
          } else {
            window.location.href = '/';
          }
        }, 3000);
      } else {
        if (response.errors) {
          const errs: Record<string, string> = {};
          Object.keys(response.errors).forEach(f => {
            if (Array.isArray(response.errors[f]) && response.errors[f].length > 0) errs[f] = response.errors[f][0];
          });
          setFormErrors(errs);
        }
        toast.error(response.error || 'Registration failed. Please try again.');
      }
    } catch {
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

  if (error || !inviteInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-red-600 mb-4">{error || 'Invalid invite link'}</div>
          <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center relative p-4">
      {/* Background SVG */}
      <div className="absolute inset-0 flex items-stretch justify-end pointer-events-none z-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="807" height="1080" viewBox="0 0 807 1080" fill="none" preserveAspectRatio="none" className="opacity-40" style={{ width: '50%', height: '100%', minWidth: '500px' }}>
          <path d="M1105 868.88C1105 1019.68 1053.62 1133.51 951.226 1210.36C848.831 1287.21 701.57 1326 509.805 1326C405.601 1326 315.146 1320.56 238.078 1309.32C161.01 1298.09 82.4951 1277.79 2.53274 1247.7V858.73C77.7914 891.718 160.286 919.268 250.018 940.656C339.75 962.044 419.712 972.919 489.905 972.919C594.833 972.919 647.297 948.994 647.297 900.78C647.297 875.767 632.462 853.654 603.155 834.442C573.847 814.866 488.458 777.166 346.986 720.615C218.178 667.689 127.723 607.513 76.706 539.724C25.3274 472.298 0 386.746 0 283.07C0 152.205 50.2931 50.3406 151.241 -22.5231C252.189 -95.3869 394.746 -132 578.913 -132C671.539 -132 758.376 -121.85 839.786 -101.549C921.195 -81.2491 1005.86 -51.5236 1093.42 -12.7354L962.081 300.47C897.677 271.469 829.293 246.819 757.652 226.519C685.65 206.218 627.035 196.068 581.446 196.068C502.207 196.068 462.407 215.644 462.407 254.432C462.407 278.357 476.156 299.02 504.016 316.058C531.876 333.096 611.839 367.534 743.903 419.735C842.318 460.335 915.768 500.211 963.89 538.999C1012.37 577.787 1047.83 623.826 1070.63 676.389C1093.42 728.952 1104.64 793.116 1104.64 868.155L1105 868.88Z" fill="url(#paint0_linear_account_register)" fillOpacity="0.3"/>
          <defs>
            <linearGradient id="paint0_linear_account_register" x1="552.5" y1="-132" x2="552.5" y2="1326" gradientUnits="userSpaceOnUse">
              <stop stopColor="#60B6FF" stopOpacity="0.54"/>
              <stop offset="0.710504" stopColor="#6979FF" stopOpacity="0.31"/>
              <stop offset="1" stopColor="#6C60FF"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Centered Content */}
      <div className="w-full max-w-md relative z-10">
        {/* Owner Profile */}
        <div className="text-center mb-6">
          <div className="mb-4">
            <div className="w-24 h-24 rounded-full bg-gray-200 mx-auto mb-3 overflow-hidden">
              {inviteInfo.owner_avatar ? (
                <img src={inviteInfo.owner_avatar} alt={inviteInfo.owner_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-semibold text-gray-600">
                  {getInitials(inviteInfo.owner_name)}
                </div>
              )}
            </div>
            <div className="text-gray-900 font-medium">{inviteInfo.owner_name}</div>
          </div>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {registrationComplete && successMessage ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-green-600 mb-2">Registration Successful!</h2>
                <p className="text-base text-gray-600">Your account has been created</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-base text-green-700 ml-3">{successMessage}</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-base text-gray-600">Redirecting to login...</p>
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
                <p className="text-base text-gray-600 text-center">Join {inviteInfo.owner_name}'s account to start creating campaigns</p>
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-4">
                {/* First Name & Last Name — hidden for existing users */}
                {!isExistingUser && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-base font-medium text-gray-700 mb-3">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={e => { setFirstName(e.target.value); setFormErrors(p => ({ ...p, firstName: '' })); }}
                        placeholder="First Name"
                        autoComplete="off"
                        disabled={isSubmitting}
                        className={`w-full px-4 py-3 text-base border rounded-lg bg-[#F3F3F5] focus:outline-none focus:border-black ${formErrors.firstName ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                      />
                      {formErrors.firstName && <p className="mt-2 text-sm text-red-600">{formErrors.firstName}</p>}
                    </div>
                    <div>
                      <label className="block text-base font-medium text-gray-700 mb-3">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={e => { setLastName(e.target.value); setFormErrors(p => ({ ...p, lastName: '' })); }}
                        placeholder="Last Name"
                        autoComplete="off"
                        disabled={isSubmitting}
                        className={`w-full px-4 py-3 text-base border rounded-lg bg-[#F3F3F5] focus:outline-none focus:border-black ${formErrors.lastName ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                      />
                      {formErrors.lastName && <p className="mt-2 text-sm text-red-600">{formErrors.lastName}</p>}
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

                {/* Phone or Email */}
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
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g, '');
                          setPhoneNumber(v);
                          setFormErrors(p => ({ ...p, phone: '' }));
                          triggerUserCheck(v, 'phone');
                        }}
                        placeholder="(555) 123-4567"
                        autoComplete="off"
                        disabled={isSubmitting}
                        className={`flex-1 min-w-0 h-12 px-4 text-base border rounded-lg bg-[#F3F3F5] focus:outline-none focus:border-black ${formErrors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                      />
                    </div>
                    {formErrors.phone && <p className="mt-2 text-sm text-red-600">{formErrors.phone}</p>}
                    {isCheckingUser && <p className="mt-2 text-sm text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Checking...</p>}
                  </div>
                ) : (
                  <div>
                    <label className="block text-base font-medium text-gray-700 mb-3">
                      Email address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={emailAddress}
                      onChange={e => {
                        setEmailAddress(e.target.value);
                        setFormErrors(p => ({ ...p, email: '' }));
                        triggerUserCheck(e.target.value, 'email');
                      }}
                      placeholder="your.email@example.com"
                      autoComplete="off"
                      disabled={isSubmitting}
                      className={`w-full px-4 py-3 text-base border rounded-lg bg-[#F3F3F5] focus:outline-none focus:border-black ${formErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                    />
                    {formErrors.email && <p className="mt-2 text-sm text-red-600">{formErrors.email}</p>}
                    {isCheckingUser && <p className="mt-2 text-sm text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Checking...</p>}
                  </div>
                )}

                {/* Existing user banner */}
                {isExistingUser && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3">
                    <Check className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Welcome back, {firstName}!</p>
                      <p className="text-xs text-blue-600 mt-0.5">We found your account. Just click below to join.</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 text-base bg-[#8B7EFF] hover:bg-[#7A6DED] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-5 h-5 animate-spin" />{isExistingUser ? 'Joining...' : 'Sending code...'}</>
                    ) : (
                      isExistingUser ? 'Join Account' : 'Continue'
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
