# Google Photos Import on Signup - Setup Guide

## ✅ What I've Implemented

When a user signs up with Google OAuth, they now see a modal asking to "Connect Google Photos". When they click "Connect", the **Google Photos Picker** opens where they can select photos to import immediately!

---

## 🔄 Complete Flow

```
1. User signs up with Google OAuth
   ↓
2. Modal appears: "Connect Google Photos?"
   ↓
3a. User clicks "Maybe Later"
    → Complete signup without importing photos

3b. User clicks "Connect Google Photos"
    ↓
4. Complete signup (user is logged in)
   ↓
5. Google Photos Picker opens (after 1 second delay)
   ↓
6. User selects photos from their Google Photos library
   ↓
7. Frontend transforms photo data to backend format
   ↓
8. POST to: /api/google-photos/save
   ↓
9. Backend saves photos to database
   ↓
10. Success toast: "Successfully imported 5 photos from Google Photos!"
   ↓
DONE ✅
```

---

## 📝 Setup Requirements

### 1. Add Google Picker API Key to `.env`

I've already added the placeholder. Replace it with your actual API key:

```env
VITE_GOOGLE_PICKER_API_KEY=YOUR_ACTUAL_API_KEY_HERE
```

**How to get the API key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **API Key**
5. Copy the API key
6. (Optional) Restrict the API key to only "Google Picker API"

---

### 2. Enable Google Picker API

In Google Cloud Console:
1. Go to **APIs & Services** → **Library**
2. Search for **"Google Picker API"**
3. Click **Enable**

---

### 3. Backend Requirements

Your backend needs these endpoints:

#### A) Get Google Photos Access Token
```
GET /api/react/auth/google/photos/access-token
Authorization: Bearer {user_token}

Response:
{
  "success": true,
  "data": {
    "access_token": "ya29.a0AfB_..."
  }
}
```

**Purpose:** This endpoint retrieves the user's Google Photos OAuth token. If the token is expired, it should refresh it.

**Implementation:**
- Check if user has connected Google Photos (stored OAuth tokens in DB)
- If no tokens, return error (picker will redirect to OAuth flow)
- If tokens exist, check if expired
- If expired, refresh using refresh_token
- Return valid access_token

---

#### B) Save Google Photos (Already Implemented ✅)
```
POST /api/react/google-photos/save
Authorization: Bearer {user_token}

Request Body:
{
  "photos": [
    {
      "google_photo_id": "AF1QipN12345...",
      "service_id": "photos",
      "name": "IMG_20231225_143022.jpg",
      "description": "Christmas party",
      "mime_type": "image/jpeg",
      "url": "https://lh3.googleusercontent.com/...",
      "thumbnail_url": "https://lh3.googleusercontent.com/...=s220",
      "size_bytes": 2457600,
      "width": 4032,
      "height": 3024,
      "capture_time": "2023-12-25T14:30:22Z",
      "last_edited_utc": 1703516422000
    }
  ],
  "source": "google_photos",
  "synced_at": "2025-01-14T10:30:00Z"
}

Response:
{
  "success": true,
  "message": "Photos saved successfully",
  "data": {
    "saved_count": 5,
    "failed_count": 0,
    "photos": [...]
  }
}
```

**Purpose:** Saves the selected photos from Google Photos Picker to your database.

---

## 🎯 What Happens in Each Case

### Case 1: User Has Already Connected Google Photos
```
1. User clicks "Connect Google Photos"
2. Signup completes
3. Picker opens immediately
4. User selects photos
5. Photos saved to database ✅
```

### Case 2: User Hasn't Connected Google Photos Yet
```
1. User clicks "Connect Google Photos"
2. Signup completes
3. Picker tries to get access token
4. Backend returns error (no tokens)
5. Frontend redirects to OAuth flow:
   GET /auth/google/photos/url
6. User authorizes Google Photos
7. OAuth callback saves tokens
8. User can try again (or use sync from Media page)
```

---

## 📊 Frontend Implementation Details

### Files Modified:

**1. `pages/SignupPage.tsx`**
- Added `handleConnectGooglePhotos()` - Opens picker after signup
- Added `loadGooglePickerAndImport()` - Loads Picker API and opens picker
- Added `handlePickerCallback()` - Handles photo selection and saves to DB

**2. `utils/googleAuthAPI.ts`**
- Added `saveGooglePhotos()` - Sends photos to backend API

**3. `.env`**
- Added `VITE_GOOGLE_PICKER_API_KEY` placeholder

---

## 🔑 Google Photos Data Structure

### What the Picker Returns:
```javascript
{
  "action": "picked",
  "docs": [
    {
      "id": "AF1QipN12345...",           // Google's unique ID
      "name": "IMG_20231225.jpg",        // Filename
      "mimeType": "image/jpeg",           // File type
      "sizeBytes": "2457600",             // Size (STRING!)
      "url": "https://lh3...",            // Full URL
      "thumbnails": [{
        "url": "https://lh3...=s220"
      }],
      "serviceId": "photos",
      "photoMetadata": {
        "width": 4032,
        "height": 3024,
        "captureTime": "2023-12-25T14:30:22.000Z"
      },
      "lastEditedUtc": 1703516422000
    }
  ]
}
```

### How It's Transformed for Backend:
```javascript
{
  google_photo_id: doc.id,                               // ✅
  service_id: doc.serviceId || 'photos',                 // ✅
  name: doc.name,                                        // ✅
  description: doc.description,                          // ❌ Optional
  mime_type: doc.mimeType,                               // ✅
  url: doc.url,                                          // ✅
  thumbnail_url: doc.thumbnails?.[0]?.url,               // ❌ Optional
  size_bytes: parseInt(doc.sizeBytes || "0"),           // ❌ Optional (convert to number!)
  width: doc.photoMetadata?.width,                       // ❌ Optional
  height: doc.photoMetadata?.height,                     // ❌ Optional
  capture_time: doc.photoMetadata?.captureTime || now(), // ✅
  last_edited_utc: doc.lastEditedUtc                     // ❌ Optional
}
```

---

## 🧪 Testing the Flow

### 1. Test with Google Photos Already Connected
1. Sign up with Google OAuth
2. Modal appears
3. Click "Connect Google Photos"
4. Picker should open immediately
5. Select 2-3 photos
6. Click "Select"
7. Check console for logs
8. Should see success toast
9. Check database for saved photos

### 2. Test without Google Photos Connected
1. Sign up with Google OAuth
2. Modal appears
3. Click "Connect Google Photos"
4. Should redirect to Google Photos OAuth
5. Authorize Google Photos
6. Complete signup
7. Try importing from Media page later

### 3. Test "Maybe Later"
1. Sign up with Google OAuth
2. Modal appears
3. Click "Maybe Later"
4. Should complete signup immediately
5. No picker opens

---

## 🐛 Troubleshooting

### Picker doesn't open
**Check:**
- Browser console for errors
- `VITE_GOOGLE_PICKER_API_KEY` is set in `.env`
- Google Picker API is enabled in Google Cloud Console
- No CORS errors

### "Failed to get Google Photos access"
**Reason:** User hasn't connected Google Photos account

**Solution:**
- Frontend redirects to OAuth flow automatically
- Or user connects from Settings later

### Photos don't save
**Check:**
- Network tab for failed POST request
- Backend endpoint `/api/google-photos/save` exists
- Request body matches expected format
- User is authenticated (token valid)

---

## 🔒 Security Notes

1. **Access Token:** The picker needs a valid Google Photos access token. This should:
   - Be stored securely in database (encrypted)
   - Be refreshed when expired
   - Never be exposed to client (only returned in API response)

2. **Photo URLs:** Google Photo URLs are public CDN URLs. They:
   - Can be stored directly in your database
   - Don't require authentication to view
   - Are permanent (unless user deletes from Google Photos)

3. **API Key:** The Picker API key should:
   - Be restricted to only "Google Picker API" in Google Console
   - Not be used for other Google APIs
   - Be different from OAuth Client ID

---

## 📚 Next Steps

1. ✅ Get Google Picker API Key from Google Cloud Console
2. ✅ Add to `.env` file
3. ✅ Implement `/auth/google/photos/access-token` endpoint in backend
4. ✅ Verify `/google-photos/save` endpoint works
5. ✅ Test the complete signup flow
6. ✅ Check database to see saved photos

---

## 🎉 Summary

When user signs up and clicks "Connect Google Photos":
1. Frontend opens Google Photos Picker
2. User selects photos
3. Frontend sends to `POST /api/google-photos/save`
4. Backend saves to database
5. Done! ✅

**No file uploads, no data transformation on backend - just save the URLs and metadata!**
