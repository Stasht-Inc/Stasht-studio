# Google Photos Connect During Signup - Implementation Guide

## Overview
After a user signs up with Google OAuth, they are presented with a modal asking if they want to connect their Google Photos account.

## User Flow

### 1. User Signs Up with Google
```
User clicks "Google" button → Google OAuth popup → Select account → Success
```

### 2. Google Photos Connect Modal Appears
The modal displays:
- **Title**: "Connect Google Photos?"
- **Features**:
  - Auto-import your photos
  - Automatic date detection
  - Preserve shared albums
  - Secure & private
- **Options**:
  - "Connect Google Photos" button (primary)
  - "Maybe Later" button (secondary)
  - "Don't ask me again" checkbox

### 3. User Choice A: "Maybe Later"
```
Click "Maybe Later" → Complete signup → Redirect to app → Logged in
```
- User data is stored in localStorage
- Session is initialized
- User is logged in immediately
- Google Photos can be connected later from profile settings

### 4. User Choice B: "Connect Google Photos"
```
Click "Connect Google Photos" → Redirect to Google OAuth → Authorize → Callback → Connect Google Photos → Complete signup → Logged in
```
- User data is temporarily stored in sessionStorage
- User is redirected to Google Photos authorization
- After authorization, user returns to callback page
- Google Photos connection is completed
- User data is moved from sessionStorage to localStorage
- Session is initialized
- User is logged in with Google Photos connected

## Technical Implementation

### Files Modified

#### 1. **SignupPage.tsx** (Lines 14, 54-55, 471-594, 1343-1349)
- Import `GooglePhotosConnectModal` component
- Add modal state: `showGooglePhotosModal`, `pendingUserData`
- After Google signup success, show modal instead of immediate login
- Add handlers:
  - `completeGoogleSignup()` - Store auth data and complete login
  - `handleGooglePhotosMaybeLater()` - Complete login without Google Photos
  - `handleConnectGooglePhotos()` - Get Google Photos auth URL and redirect
- Render modal component

#### 2. **OAuthCallback.tsx** (Lines 4-5, 28-125, 137-142)
- Import `googleAuthAPI` and `SessionValidator`
- Add `handleGooglePhotosSignupCallback()` function
- Add `completeSignupWithoutGooglePhotos()` helper function
- Check for `pending_google_signup` in sessionStorage
- Handle Google Photos authorization callback
- Complete signup after Google Photos connection (success or failure)

#### 3. **GooglePhotosConnectModal.tsx** (Already existed)
- Modal component with Google Photos branding
- Features list with icons
- "Don't ask me again" checkbox functionality
- Two action buttons with callbacks

### Data Flow

#### Session Storage Keys Used:
- `pending_google_signup` - Stores user data during Google Photos OAuth flow
  ```json
  {
    "user": { "id": 123, "email": "...", ... },
    "token": "jwt_token_here"
  }
  ```

#### Local Storage Keys:
- `stasht_user` - User object after signup complete
- `stasht_token` - JWT token after signup complete
- `stasht_session_change` - Session change event for cross-tab sync
- `google_photos_dont_ask` - User preference to not show modal again

### API Calls

#### 1. Get Google Photos Auth URL
```typescript
googleAuthAPI.getGooglePhotosAuthUrl()
// Returns: { success: true, auth_url: "https://..." }
```

#### 2. Google Photos Callback
```typescript
googleAuthAPI.googlePhotosCallback(code)
// Params: code (from OAuth redirect)
// Returns: { success: true, message: "...", service: {...} }
```

## Backend Requirements

### Expected API Endpoints:

#### 1. GET `/api/react/auth/google/photos/url`
**Purpose**: Get Google Photos OAuth authorization URL
**Headers**: `Authorization: Bearer {token}`
**Response**:
```json
{
  "success": true,
  "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

#### 2. POST `/api/react/auth/google/photos/callback`
**Purpose**: Exchange OAuth code for Google Photos access token
**Headers**: `Authorization: Bearer {token}`
**Body**:
```json
{
  "code": "authorization_code_from_google"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Google Photos connected successfully",
  "service": {
    "id": 1,
    "name": "google_photos",
    "status": "connected"
  }
}
```

### Google Cloud Console Configuration

The backend needs to configure:
1. **OAuth Scopes**:
   - `https://www.googleapis.com/auth/photoslibrary.readonly`
   - `https://www.googleapis.com/auth/photoslibrary.sharing`

2. **Redirect URIs**:
   - `http://localhost:5173/auth/callback/google` (development)
   - `https://your-domain.com/auth/callback/google` (production)

## Testing Checklist

### Scenario 1: "Maybe Later"
- [ ] Sign up with Google
- [ ] Modal appears
- [ ] Click "Maybe Later"
- [ ] User is logged in immediately
- [ ] No Google Photos connection in profile

### Scenario 2: "Connect Google Photos" - Success
- [ ] Sign up with Google
- [ ] Modal appears
- [ ] Click "Connect Google Photos"
- [ ] Redirect to Google authorization
- [ ] Authorize Google Photos
- [ ] Return to app
- [ ] User is logged in
- [ ] Google Photos shows as connected in profile
- [ ] Toast message: "Google Photos connected successfully!"

### Scenario 3: "Connect Google Photos" - User Denies
- [ ] Sign up with Google
- [ ] Modal appears
- [ ] Click "Connect Google Photos"
- [ ] Redirect to Google authorization
- [ ] Click "Cancel" on Google page
- [ ] Return to app
- [ ] User is still logged in (signup completes)
- [ ] Toast message: "Google Photos connection failed. Completing signup..."

### Scenario 4: "Don't ask me again"
- [ ] Sign up with Google
- [ ] Modal appears
- [ ] Check "Don't ask me again"
- [ ] Click "Maybe Later"
- [ ] User is logged in
- [ ] `localStorage.getItem('google_photos_dont_ask')` === 'true'

### Scenario 5: Close Modal (X button)
- [ ] Sign up with Google
- [ ] Modal appears
- [ ] Click X button to close
- [ ] Modal closes
- [ ] User can still interact with signup page (modal doesn't auto-reopen)

## Error Handling

### 1. Google Photos Auth URL Fails
- **What happens**: Backend doesn't return auth URL
- **Behavior**: Show error toast, complete signup without Google Photos
- **User experience**: "Failed to connect Google Photos. Completing signup..."

### 2. Google Photos Callback Fails
- **What happens**: Backend returns error on callback
- **Behavior**: Show error toast, complete signup without Google Photos
- **User experience**: "Failed to connect Google Photos"

### 3. User Denies Google Photos Permission
- **What happens**: User clicks "Cancel" on Google authorization
- **Behavior**: Return with error parameter, complete signup without Google Photos
- **User experience**: "Google Photos connection failed. Completing signup..."

## Future Enhancements

1. **Progress Indicator**: Show sync progress after Google Photos connection
2. **Reconnect Option**: If connection fails, offer to retry
3. **Partial Import**: Allow user to select specific albums to import
4. **Background Sync**: Start syncing photos in background after connection
5. **Preference Management**: Add setting to control when modal appears

## Related Files
- `/components/GooglePhotosConnectModal.tsx` - Modal UI component
- `/pages/SignupPage.tsx` - Signup page with modal integration
- `/pages/OAuthCallback.tsx` - OAuth callback handler
- `/utils/googleAuthAPI.ts` - Google API wrapper functions
- `/utils/sessionValidator.ts` - Session management utilities
