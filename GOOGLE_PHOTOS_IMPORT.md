# Google Photos Import - Implementation Guide

## Overview

This guide explains how to implement Google Photos import functionality using the Google Photos Picker API with the `photospicker.mediaitems.readonly` scope.

---

## 🎯 What's Implemented

### 1. **Backend API** (`/api/google-photos/save`)
✅ Already implemented on your backend (as confirmed)

### 2. **Frontend Components**
✅ **Created:**
- `hooks/useGooglePhotosPicker.ts` - Custom hook to handle Google Photos Picker
- `components/GooglePhotosImportButton.tsx` - Ready-to-use import button component
- `utils/googleAuthAPI.ts` - Added `saveGooglePhotos()` function

---

## 📋 Setup Requirements

### 1. Environment Variables

Add these to your `.env` file:

```env
# Google Photos Picker API Key (from Google Cloud Console)
VITE_GOOGLE_PICKER_API_KEY=your_picker_api_key_here

# Your existing API base URL
VITE_API_BASE_URL=https://restapi-stasht.wd-projects.online/api/react
```

### 2. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Google Picker API**
3. Create API Key (for Picker API)
4. Add OAuth 2.0 scopes:
   - `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`

---

## 🔧 Backend API Endpoint

Your backend already has this implemented. Here's what it expects:

### Request Structure

```javascript
POST /api/google-photos/save
Authorization: Bearer {user_token}
Content-Type: application/json

{
  "photos": [
    {
      "google_photo_id": "UNIQUE_GOOGLE_PHOTO_ID",
      "service_id": "photos",
      "name": "IMG_20231225_143022.jpg",
      "description": "Christmas party photo",
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
```

### Response Structure

```javascript
// Success
{
  "success": true,
  "message": "Photos saved successfully",
  "data": {
    "saved_count": 5,
    "failed_count": 0,
    "photos": [...]
  }
}

// Error
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error"
}
```

---

## 💻 Frontend Usage

### Option 1: Use the Ready-Made Button Component

```tsx
import { GooglePhotosImportButton } from '../components/GooglePhotosImportButton';

// In your component
<GooglePhotosImportButton
  onImportComplete={() => {
    console.log('Import completed! Refresh your media list.');
    // Refresh your media data here
    onFetchMediaData();
  }}
  variant="default"
  className="w-full"
/>
```

### Option 2: Use the Hook Directly (Custom Implementation)

```tsx
import { useGooglePhotosPicker } from '../hooks/useGooglePhotosPicker';

function MyComponent() {
  const {
    openPicker,
    isPickerLoading,
    selectedPhotos,
    savePhotosToDatabase,
    isSaving,
  } = useGooglePhotosPicker();

  const handleImport = async () => {
    // Open picker
    await openPicker();

    // Photos are automatically saved after selection
    // Or manually save:
    // const success = await savePhotosToDatabase();
  };

  return (
    <button onClick={handleImport} disabled={isPickerLoading || isSaving}>
      {isSaving ? 'Importing...' : 'Import from Google Photos'}
    </button>
  );
}
```

---

## 🔑 Required Backend Endpoint

Your backend needs one additional endpoint to provide the Google Photos access token:

```javascript
GET /api/react/auth/google/photos/access-token
Authorization: Bearer {user_token}

// Response:
{
  "success": true,
  "data": {
    "access_token": "ya29.a0AfB_..."
  }
}
```

This endpoint should:
1. Get the user's stored Google Photos OAuth token
2. Refresh it if expired
3. Return the valid access token

---

## 📊 Data Flow

```
1. User clicks "Import from Google Photos" button
   ↓
2. Hook loads Google Picker API script
   ↓
3. Hook fetches Google Photos access token from backend
   ↓
4. Google Photos Picker opens (user selects photos)
   ↓
5. Picker returns photo data (URLs, metadata, etc.)
   ↓
6. Hook automatically calls savePhotosToDatabase()
   ↓
7. Frontend sends formatted data to /api/google-photos/save
   ↓
8. Backend saves photos to database
   ↓
9. Success toast notification
   ↓
10. onImportComplete callback triggers (refresh media)
```

---

## 🎨 Integration Example (MediaPage)

Add the import button to your MediaPage:

```tsx
// At the top of MediaPage.tsx
import { GooglePhotosImportButton } from '../components/GooglePhotosImportButton';

// In your render/return section, add the button where you want it
<div className="flex gap-2">
  {/* Existing upload buttons */}
  <GooglePhotosImportButton
    onImportComplete={async () => {
      // Refresh media data after import
      if (onFetchMediaData) {
        await onFetchMediaData();
      }
      toast.success('Media library refreshed!');
    }}
    variant="outline"
  />
</div>
```

---

## 🗄️ Database Schema

Your backend should store these fields:

```sql
CREATE TABLE google_photos_media (
    id                  BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id             BIGINT NOT NULL,
    google_photo_id     VARCHAR(255) UNIQUE NOT NULL,
    service_id          VARCHAR(50) DEFAULT 'photos',
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    mime_type           VARCHAR(100),
    url                 TEXT NOT NULL,
    thumbnail_url       TEXT,
    size_bytes          BIGINT,
    width               INT,
    height              INT,
    capture_time        DATETIME,
    last_edited_utc     BIGINT,
    source              VARCHAR(50) DEFAULT 'google_photos',
    synced_at           DATETIME NOT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          DATETIME,

    INDEX idx_user_id (user_id),
    INDEX idx_google_photo_id (google_photo_id),
    INDEX idx_capture_time (capture_time)
);
```

---

## 🧪 Testing

1. **Test Picker Opens:**
   - Click import button
   - Google Photos picker should open
   - You can select multiple photos

2. **Test Photo Selection:**
   - Select 1-5 photos
   - Click "Select" in picker
   - Toast notification should appear

3. **Test Database Save:**
   - Check browser console for API logs
   - Verify backend receives correct data structure
   - Check database for saved photos

4. **Test Error Handling:**
   - Try without Google Photos connected
   - Try with expired token
   - Verify error messages appear

---

## ⚠️ Important Notes

1. **Access Token Required:** User must have connected Google Photos account first
2. **Picker API Key:** Must be set in environment variables
3. **Auto-Save:** Photos are automatically saved after selection (no extra click needed)
4. **Multi-Select:** Users can select multiple photos at once
5. **URLs from Google:** Photo URLs come from Google's CDN (`lh3.googleusercontent.com`)

---

## 🐛 Troubleshooting

### Picker doesn't open
- Check console for errors
- Verify `VITE_GOOGLE_PICKER_API_KEY` is set
- Check Google Cloud Console - Picker API enabled?

### "Failed to get Google Photos access"
- Backend endpoint `/auth/google/photos/access-token` not implemented
- User hasn't connected Google Photos
- Access token expired and refresh failed

### Photos not saving
- Check network tab for API errors
- Verify backend endpoint `/api/google-photos/save` is working
- Check request body format matches expected structure

---

## 🚀 Next Steps

1. Add `VITE_GOOGLE_PICKER_API_KEY` to your `.env` file
2. Implement `/auth/google/photos/access-token` endpoint on backend
3. Add `GooglePhotosImportButton` to your MediaPage
4. Test the complete flow
5. Handle edge cases (expired tokens, network errors, etc.)

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Check network tab for failed API calls
3. Verify all environment variables are set
4. Ensure backend endpoints are implemented correctly
