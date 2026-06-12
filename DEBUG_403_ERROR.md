# Debug 403 Error - Step by Step

## 🔍 **Step 1: Check Browser Console**

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Click "Sign up with Google"
4. Look for error messages
5. Share any error that mentions "403" or "access_denied"

---

## 🔍 **Step 2: Check Network Tab**

1. Open DevTools → **Network** tab
2. Click "Sign up with Google"
3. Look for failed requests (red)
4. Click on the failed request
5. Check the **Request URL** - does it include the scope?
6. Check the **Response** - what does Google say?

---

## 🔍 **Step 3: Verify Google Cloud Console Settings**

### A. OAuth Consent Screen
```
Go to: https://console.cloud.google.com/apis/credentials/consent

Check:
□ Publishing status = "Testing" (at the top)
□ App name = your app name
□ User support email = your email
□ Scopes section shows:
  - openid
  - email
  - profile
  - https://www.googleapis.com/auth/photoslibrary.readonly
□ Test users section has YOUR EMAIL ADDRESS
```

### B. Credentials
```
Go to: https://console.cloud.google.com/apis/credentials

Check:
□ OAuth 2.0 Client IDs section shows your client
□ Click on your client ID
□ Application type = "Web application"
□ Authorized redirect URIs includes:
  http://localhost:5173/auth/google/callback
□ Copy the Client ID and verify it matches your .env file
```

### C. Enabled APIs
```
Go to: https://console.cloud.google.com/apis/library

Search and verify:
□ "Photos Library API" = Enabled
□ "Google Picker API" = Enabled
```

---

## 🔍 **Step 4: Check Your .env File**

```env
# This should match Google Cloud Console
VITE_GOOGLE_OAUTH_CLIENT_ID=1049890183663-e6mjba0utnkv597rdf18ca8igrbbl8md.apps.googleusercontent.com

# This should match your redirect URI
VITE_GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5173/auth/google/callback

# Picker API key
VITE_GOOGLE_PICKER_API_KEY=AIzaSyDzuZkpMob6eIEZ2xBYWkX24Nb4cmqtwZ4
```

---

## 🔍 **Step 5: Test with Different Scope**

If the error persists, try a simpler scope first:

### Option A: Just basic scopes (test)
```typescript
scope: 'openid email profile'
```

If this works → Issue is with Photos scope configuration

### Option B: Add Photos scope one by one
```typescript
// First try:
scope: 'openid email profile https://www.googleapis.com/auth/photoslibrary.readonly'

// If fails, try:
scope: 'openid email profile https://www.googleapis.com/auth/photoslibrary'
```

---

## 🔍 **Step 6: Common Mistakes**

### ❌ Mistake #1: Wrong Project
- You might have multiple Google Cloud projects
- Make sure you're looking at the CORRECT project
- Check project ID in console matches your setup

### ❌ Mistake #2: Scope Typo
```
Wrong: photoslibary.readonly (missing 'r')
Wrong: photos-library.readonly (wrong dash)
Correct: photoslibrary.readonly
```

### ❌ Mistake #3: Test User Email Mismatch
- Test user email must EXACTLY match the email you're signing up with
- Check for typos, extra spaces

### ❌ Mistake #4: App in Production Mode
- If app is in "Production" mode, it needs verification
- Set it back to "Testing" mode

---

## 📸 **What to Share for Help:**

If still not working, share:

1. **Screenshot of OAuth Consent Screen** (sensitive info redacted)
   - Publishing status section
   - Scopes section
   - Test users section

2. **Screenshot of Credentials page**
   - OAuth 2.0 Client ID section
   - Redirect URIs

3. **Browser console errors**
   - Any red errors when clicking signup

4. **Network tab**
   - URL of the failed request
   - Response body

---

## ✅ **Final Checklist:**

Before testing again:

```
□ Cleared browser cookies/cache
□ Closed all browser windows
□ Reopened browser
□ Verified all settings above
□ Used the EXACT email added as test user
□ Waited 1-2 minutes after making changes (Google cache)
```

---

## 🎯 **If Nothing Works:**

Try creating a NEW OAuth Client:

1. Go to Credentials
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Application type = "Web application"
4. Name = "Stasht Test"
5. Authorized redirect URIs:
   - http://localhost:5173/auth/google/callback
6. Click "Create"
7. Copy the NEW Client ID
8. Update your .env file
9. Restart dev server
10. Try again

---

## 🆘 **Still Getting 403?**

The issue is 100% in Google Cloud Console configuration. Re-check:

1. ✅ Test user added
2. ✅ App in Testing mode
3. ✅ Scope configured
4. ✅ API enabled
5. ✅ Redirect URI correct

One of these is wrong. Double-check each one carefully!
