# Device Verification Integration Guide

## ✅ What's Already Done (Without Breaking Existing Code)

1. ✅ Added new TypeScript interfaces for device verification
2. ✅ Added 3 new API functions: `verifyDeviceOtp()`, `resendDeviceOtp()`, `getTrustedDevices()`
3. ✅ Updated `authAPI.login()` to detect and return device verification responses
4. ✅ Updated `AuthContext` to handle device verification (as a fallback)
5. ✅ Created `DeviceVerificationModal` component

## 🔧 Integration Steps for LoginPage.tsx

### Step 1: Import the Modal

Add this import at the top of `LoginPage.tsx`:

```typescript
import { DeviceVerificationModal } from '../components/DeviceVerificationModal';
```

### Step 2: Add State Variables

Add these state variables after your existing `useState` declarations (around line 30-40):

```typescript
// Device verification states
const [showDeviceVerification, setShowDeviceVerification] = useState(false);
const [verificationAttemptId, setVerificationAttemptId] = useState<number | null>(null);
const [verificationDeviceInfo, setVerificationDeviceInfo] = useState<any>(null);
```

### Step 3: Update handleSubmit Function

In your `handleSubmit` function, add this check RIGHT AFTER the activation check (after line 160):

```typescript
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

// NEW: Check for device verification requirement
if (response.requires_verification === true && response.attempt_id) {
  console.log('🔐 Device verification required');
  setVerificationAttemptId(response.attempt_id);
  setVerificationDeviceInfo(response.device_info || {});
  setShowDeviceVerification(true);
  setIsLoading(false);
  return; // Don't continue with login
}

// If success, store auth data and reload
if (response.success && response.user && response.token) {
  // ... existing success handling
}
```

### Step 4: Add Verified Handler Function

Add this function after your `handleSubmit` function (around line 200):

```typescript
const handleDeviceVerified = (user: any, token: string) => {
  console.log('✅ Device verified successfully, storing auth data...');

  // Store auth data (same as successful login)
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

  // Close modal and reload
  setShowDeviceVerification(false);
  console.log('🔄 Reloading page to complete login...');
  window.location.reload();
};
```

### Step 5: Add Modal Component to JSX

Add the modal component at the end of your JSX, right before the closing tags (around line 1000+):

```typescript
      {/* Existing JSX */}

      {/* Device Verification Modal - NEW */}
      <DeviceVerificationModal
        isOpen={showDeviceVerification}
        onClose={() => {
          setShowDeviceVerification(false);
          setIsLoading(false);
        }}
        attemptId={verificationAttemptId || 0}
        deviceInfo={verificationDeviceInfo}
        onVerified={handleDeviceVerified}
      />
    </div>
  );
}
```

## 🧪 Testing

### Test Case 1: New Device Login
1. Clear your browser's localStorage (or use incognito)
2. Try to login with valid credentials
3. You should see the OTP modal
4. Check your email for the OTP code
5. Enter the 6-digit code
6. You should be logged in successfully

### Test Case 2: Trusted Device Login
1. Login from a device you've verified before
2. You should login normally WITHOUT seeing the OTP modal

### Test Case 3: Invalid OTP
1. Trigger device verification
2. Enter wrong OTP code
3. You should see an error message
4. OTP fields should clear and refocus

### Test Case 4: Resend OTP
1. Trigger device verification
2. Click "Resend code"
3. Check email for new OTP
4. 60-second cooldown should prevent spam

## 🔍 Debugging

If the modal doesn't appear:

1. Check browser console for logs:
   - `🔐 authAPI.login: Device verification required`
   - `🔐 Device verification required`

2. Verify backend response format matches:
```json
{
  "success": false,
  "requires_verification": true,
  "attempt_id": 2,
  "message": "New device detected..."
}
```

3. Check state values:
```typescript
console.log('Device verification state:', {
  showDeviceVerification,
  verificationAttemptId,
  verificationDeviceInfo
});
```

## 📱 Optional: Trusted Devices Management Page

To show users their trusted devices, create a new page:

```typescript
import { authAPI, TrustedDevice } from '../utils/authUtils';

const TrustedDevicesPage = () => {
  const [devices, setDevices] = useState<TrustedDevice[]>([]);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    const response = await authAPI.getTrustedDevices();
    if (response.success && response.data) {
      setDevices(response.data);
    }
  };

  return (
    <div>
      <h2>Trusted Devices</h2>
      {devices.map(device => (
        <div key={device.id}>
          <p>{device.device_name}</p>
          <p>{device.location}</p>
          <p>Last used: {device.last_used_at}</p>
        </div>
      ))}
    </div>
  );
};
```

## ❌ What NOT to Do

1. ❌ Don't modify the existing `authAPI.login()` function - it's already updated
2. ❌ Don't change how successful logins work - only add the verification check
3. ❌ Don't remove the activation check - both can coexist
4. ❌ Don't call `AuthContext.login()` if you're using `authAPI.login()` directly

## 🎯 Summary

The implementation is **completely non-breaking**:
- Existing logins work exactly as before
- New device detection only adds an extra step
- All existing error handling remains unchanged
- The modal is a standalone component

Your backend response is perfect! Just add the 5 integration steps to your LoginPage and you're done.
