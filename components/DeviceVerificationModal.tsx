import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Shield, Smartphone, MapPin, Globe, Clock, RefreshCw } from 'lucide-react';
import { authAPI } from '../utils/authUtils';
import { toast } from 'sonner';

interface DeviceVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  attemptId: number;
  deviceInfo?: {
    location?: string;
    ip?: string;
    browser?: string;
    os?: string;
    timestamp?: string;
  };
  onVerified: (user: any, token: string, collaborators?: any[]) => void;
  loginMethod?: 'email' | 'phone';
}

export function DeviceVerificationModal({
  isOpen,
  onClose,
  attemptId,
  deviceInfo,
  onVerified,
  loginMethod = 'email'
}: DeviceVerificationModalProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Auto-focus first input when modal opens
  useEffect(() => {
    if (isOpen) {
      inputRefs.current[0]?.focus();
    }
  }, [isOpen]);

  const handleOtpChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (value && index === 5 && newOtp.every(digit => digit !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // If current input is empty, focus previous and clear it
        inputRefs.current[index - 1]?.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
      } else {
        // Clear current input
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();

    // Check if pasted data is 6 digits
    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      inputRefs.current[5]?.focus();

      // Auto-submit
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (otpCode?: string) => {
    const otpToVerify = otpCode || otp.join('');

    if (otpToVerify.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const response = await authAPI.verifyDeviceOtp({
        attempt_id: attemptId,
        otp: otpToVerify,
        device_name: `${navigator.platform} - ${navigator.userAgent.split(' ').pop()}`
      });

      console.log('🔍 DeviceVerificationModal: ===== FULL RESPONSE =====');
      console.log('🔍 DeviceVerificationModal: response:', response);
      console.log('🔍 DeviceVerificationModal: response.success:', response.success);
      console.log('🔍 DeviceVerificationModal: response.data:', response.data);
      console.log('🔍 DeviceVerificationModal: ==========================================');

      if (response.success) {
        // Extract data - handle both flattened and nested structures
        const user = response.user || response.data?.user;
        const token = response.token || response.data?.token;
        const collaborators = response.collaborators || response.data?.collaborators || [];
        const properties = response.properties || response.data?.properties || [];

        console.log('🔍 DeviceVerificationModal: ===== EXTRACTED DATA =====');
        console.log('🔍 DeviceVerificationModal: User:', user);
        console.log('🔍 DeviceVerificationModal: Token exists:', !!token);
        console.log('🔍 DeviceVerificationModal: Collaborators count:', collaborators.length);
        console.log('🔍 DeviceVerificationModal: Properties count:', properties.length);
        console.log('🔍 DeviceVerificationModal: ==========================================');

        if (user && token) {
          toast.success('Device verified successfully!');

          // Pass user, token, collaborators, and the full response data including properties
          const responseData = {
            ...(response.data || response),
            owned_properties: response.owned_properties || response.data?.owned_properties || [],
            shared_properties: response.shared_properties || response.data?.shared_properties || [],
            partial_admin_access: response.partial_admin_access || response.data?.partial_admin_access || [],
          };
          onVerified(user, token, collaborators, responseData);
          onClose();
        } else {
          console.error('🔍 DeviceVerificationModal: Missing user or token!');
          setError(response.error || 'Invalid OTP. Please try again.');
          setOtp(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        }
      } else {
        setError(response.error || 'Invalid OTP. Please try again.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setError('Failed to verify OTP. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;

    setIsResending(true);
    setError(null);

    try {
      const response = await authAPI.resendDeviceOtp({ attempt_id: attemptId });

      if (response.success) {
        toast.success(`New OTP sent to your ${loginMethod === 'phone' ? 'phone number' : 'email'}`);
        setResendTimer(60); // 60 second cooldown
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        toast.error(response.error || 'Failed to resend OTP');
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      toast.error('Failed to resend OTP');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white border-0">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">New Device Detected</DialogTitle>
          <DialogDescription className="text-center">
            We've sent a verification code to your {loginMethod === 'phone' ? 'phone number' : 'email'} to confirm this login attempt.
          </DialogDescription>
        </DialogHeader>

        {/* Device Info */}
        {deviceInfo && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            {/* Handle both string and object formats */}
            {typeof deviceInfo === 'string' ? (
              <div className="flex items-center gap-2 text-gray-600">
                <Smartphone className="w-4 h-4" />
                <span>{deviceInfo}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-gray-600">
                  <Smartphone className="w-4 h-4" />
                  <span>{deviceInfo.browser || 'Unknown Browser'} on {deviceInfo.os || 'Unknown OS'}</span>
                </div>
                {deviceInfo.location && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{deviceInfo.location}</span>
                  </div>
                )}
                {deviceInfo.ip && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Globe className="w-4 h-4" />
                    <span>{deviceInfo.ip}</span>
                  </div>
                )}
                {deviceInfo.timestamp && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{deviceInfo.timestamp}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* OTP Input */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-3 text-center">
              Enter 6-digit code
            </label>
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
              {otp.map((digit, index) => (
                <Input
                  key={index}
                  ref={el => inputRefs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(index, e.target.value)}
                  onKeyDown={e => handleKeyDown(index, e)}
                  className="w-12 h-14 text-center text-xl font-semibold"
                  disabled={isVerifying}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          {/* Verify Button */}
          <Button
            onClick={() => handleVerify()}
            disabled={isVerifying || otp.some(d => !d)}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {isVerifying ? 'Verifying...' : 'Verify Device'}
          </Button>

          {/* Resend OTP */}
          <div className="text-center">
            <button
              onClick={handleResend}
              disabled={isResending || resendTimer > 0}
              className="text-sm text-[#6C60FF] hover:text-[#5A4FE5] disabled:text-gray-400 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
              {resendTimer > 0
                ? `Resend code in ${resendTimer}s`
                : isResending
                ? 'Sending...'
                : 'Resend code'}
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <p className="font-medium mb-1">Not you?</p>
          <p className="text-xs">If you didn't attempt to log in, please close this window and change your password immediately.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
