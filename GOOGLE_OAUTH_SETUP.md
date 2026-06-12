# Google OAuth Setup Guide

## Issue: Google OAuth Popup Stuck on "One moment please..."

This happens when your Google Cloud Console OAuth configuration doesn't have the correct origins.

## Solution: Configure Google Cloud Console

### Step 1: Access Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services > Credentials**

### Step 2: Edit OAuth 2.0 Client ID
1. Find your OAuth Client ID: `1049890183663-e6mjba0utnkv597rdf18ca8igrbbl8md`
2. Click the **Edit** (pencil) icon

### Step 3: Configure Authorized JavaScript Origins
Add these origins:
```
http://localhost:5173
https://localhost:5173
```

For production, also add:
```
https://your-production-domain.com
```

### Step 4: Configure Authorized Redirect URIs (Optional for implicit flow)
Add these URIs:
```
http://localhost:5173
http://localhost:5173/auth/google/callback
```

For production, also add:
```
https://your-production-domain.com
https://your-production-domain.com/auth/google/callback
```

### Step 5: Save Changes
Click the **SAVE** button at the bottom

### Step 6: Wait for Propagation
- Changes may take 5-10 minutes to propagate
- Clear your browser cache
- Try the Google login again

## Technical Details

### Current Configuration
- **OAuth Client ID**: `1049890183663-e6mjba0utnkv597rdf18ca8igrbbl8md`
- **Flow**: Implicit (popup-based, no redirects)
- **App**: Running on `http://localhost:5173`

### Why This Happens
The Google OAuth popup gets stuck because:
1. Your OAuth client configuration doesn't include `http://localhost:5173` as an authorized origin
2. Google blocks the OAuth flow for security reasons
3. The popup never receives the authorization token

### How It Works After Fix
1. User clicks "Google" button
2. Popup opens → Google checks if `http://localhost:5173` is authorized
3. User selects account → Google sends token to popup
4. Popup closes → Token passed to your app
5. App authenticates user → Login complete

## Testing After Configuration

1. **Clear browser cache** (important!)
2. Close all browser tabs with your app
3. Open a new tab and navigate to `http://localhost:5173`
4. Click the Google sign-in button
5. The popup should now work and close automatically

## Common Issues

### Issue: Still stuck after configuration
**Solution**: Wait 10 minutes for Google's changes to propagate, then clear cache

### Issue: "redirect_uri_mismatch" error
**Solution**: Double-check that `http://localhost:5173` is in the authorized origins list

### Issue: "idpiframe_initialization_failed"
**Solution**: Make sure you're accessing the app via `http://localhost:5173` (not `127.0.0.1`)

## Support
If you still have issues after following these steps, check the browser console for specific error messages.
