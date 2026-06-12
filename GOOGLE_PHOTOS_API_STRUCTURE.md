# Google Photos Picker API - Data Structure Reference

## 📸 What Google Photos Picker Returns

When a user selects photos from Google Photos Picker, you receive this data:

---

## 🔍 Complete Response Object

```javascript
{
  "action": "picked", // User action: "picked" or "cancel"
  "docs": [
    {
      // IDENTIFIERS
      "id": "AF1QipN1234567890abcdefg",           // Google Photos unique ID
      "serviceId": "photos",                      // Always "photos" for Google Photos
      "type": "photo",                            // "photo" or "video"

      // FILE INFORMATION
      "name": "IMG_20231225_143022.jpg",         // Original filename
      "description": "Christmas party 2023",      // Photo description (if set)
      "mimeType": "image/jpeg",                   // MIME type (image/jpeg, image/png, etc.)
      "sizeBytes": "2457600",                     // File size in bytes (as string)

      // URLS
      "url": "https://lh3.googleusercontent.com/pw/...",              // Full resolution URL
      "embedUrl": "https://photos.google.com/share/...",              // Embeddable URL
      "iconUrl": "https://drive-thirdparty.googleusercontent.com/...", // Icon URL

      // THUMBNAILS
      "thumbnails": [
        {
          "url": "https://lh3.googleusercontent.com/...=s220",  // Small thumbnail (220px)
          "width": 220,
          "height": 165
        },
        {
          "url": "https://lh3.googleusercontent.com/...=s512",  // Medium thumbnail (512px)
          "width": 512,
          "height": 384
        }
      ],

      // PHOTO METADATA
      "photoMetadata": {
        "width": 4032,                            // Original image width (pixels)
        "height": 3024,                           // Original image height (pixels)
        "captureTime": "2023-12-25T14:30:22.000Z" // When photo was taken (ISO 8601)
      },

      // TIMESTAMPS
      "lastEditedUtc": 1703516422000,             // Last edit timestamp (Unix milliseconds)
      "createdDate": 1703516422000                // Creation timestamp (Unix milliseconds)
    }
    // ... more photos if multi-select
  ]
}
```

---

## 🎯 Field Descriptions

### Required Fields (Always Present)
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Google's unique identifier | `"AF1QipN12345..."` |
| `name` | string | Original filename | `"IMG_20231225_143022.jpg"` |
| `mimeType` | string | File MIME type | `"image/jpeg"` |
| `url` | string | Full resolution photo URL | `"https://lh3.googleusercontent.com/..."` |
| `serviceId` | string | Always "photos" | `"photos"` |

### Optional Fields (May Be Missing)
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `description` | string | User-added description | `"Christmas party"` |
| `sizeBytes` | string | File size (as string!) | `"2457600"` |
| `thumbnails` | array | Array of thumbnail objects | See structure above |
| `photoMetadata` | object | Dimensions and capture time | See structure above |
| `lastEditedUtc` | number | Last edit time (Unix ms) | `1703516422000` |

---

## 🔄 How to Transform for Your API

```javascript
// What Google gives you
const googlePhoto = {
  id: "AF1QipN12345...",
  name: "IMG_20231225_143022.jpg",
  mimeType: "image/jpeg",
  sizeBytes: "2457600",
  url: "https://lh3.googleusercontent.com/pw/...",
  thumbnails: [
    { url: "https://lh3.googleusercontent.com/...=s220", width: 220, height: 165 }
  ],
  serviceId: "photos",
  photoMetadata: {
    width: 4032,
    height: 3024,
    captureTime: "2023-12-25T14:30:22.000Z"
  },
  lastEditedUtc: 1703516422000
};

// Transform to your backend API format
const photoForBackend = {
  google_photo_id: googlePhoto.id,                        // Required
  service_id: googlePhoto.serviceId,                     // Required
  name: googlePhoto.name,                                // Required
  description: googlePhoto.description || undefined,      // Optional
  mime_type: googlePhoto.mimeType,                       // Required
  url: googlePhoto.url,                                  // Required
  thumbnail_url: googlePhoto.thumbnails?.[0]?.url,       // Optional (first thumbnail)
  size_bytes: parseInt(googlePhoto.sizeBytes || "0"),    // Optional (convert to number!)
  width: googlePhoto.photoMetadata?.width,               // Optional
  height: googlePhoto.photoMetadata?.height,             // Optional
  capture_time: googlePhoto.photoMetadata?.captureTime || new Date().toISOString(), // Required
  last_edited_utc: googlePhoto.lastEditedUtc             // Optional
};
```

---

## ⚠️ Important Notes

### 1. **Size is a String!**
```javascript
// ❌ WRONG
size_bytes: googlePhoto.sizeBytes  // This is a string "2457600"

// ✅ CORRECT
size_bytes: parseInt(googlePhoto.sizeBytes || "0")  // Convert to number
```

### 2. **Thumbnail URL Selection**
```javascript
// Get the first (smallest) thumbnail
thumbnail_url: googlePhoto.thumbnails?.[0]?.url

// Or get a specific size
const mediumThumb = googlePhoto.thumbnails?.find(t => t.width === 512);
thumbnail_url: mediumThumb?.url || googlePhoto.thumbnails?.[0]?.url
```

### 3. **Missing Metadata**
```javascript
// Always provide fallbacks
capture_time: googlePhoto.photoMetadata?.captureTime || new Date().toISOString()
width: googlePhoto.photoMetadata?.width || undefined
description: googlePhoto.description || undefined
```

### 4. **Google Photo URLs**
- URLs are from Google's CDN: `lh3.googleusercontent.com`
- URLs are permanent and publicly accessible
- You can store these URLs directly in your database
- No need to download and re-upload (unless you want to)

---

## 📦 Example: Batch Processing Multiple Photos

```javascript
function transformGooglePhotosForBackend(docs) {
  return docs.map(doc => ({
    google_photo_id: doc.id,
    service_id: doc.serviceId || 'photos',
    name: doc.name,
    description: doc.description,
    mime_type: doc.mimeType,
    url: doc.url,
    thumbnail_url: doc.thumbnails?.[0]?.url,
    size_bytes: doc.sizeBytes ? parseInt(doc.sizeBytes) : undefined,
    width: doc.photoMetadata?.width,
    height: doc.photoMetadata?.height,
    capture_time: doc.photoMetadata?.captureTime || new Date().toISOString(),
    last_edited_utc: doc.lastEditedUtc
  }));
}

// Usage
const selectedPhotos = pickerResponse.docs;
const photosForBackend = transformGooglePhotosForBackend(selectedPhotos);

// Send to your API
await fetch('/api/google-photos/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    photos: photosForBackend,
    source: 'google_photos',
    synced_at: new Date().toISOString()
  })
});
```

---

## 🧪 Real Example Data

Here's what actual data from Google Photos Picker looks like:

```javascript
{
  "action": "picked",
  "docs": [
    {
      "id": "AF1QipNx7Yg_Example123",
      "name": "PXL_20231225_143022456.jpg",
      "description": "",
      "mimeType": "image/jpeg",
      "sizeBytes": "2457600",
      "url": "https://lh3.googleusercontent.com/pw/AP1GczM_exampleURL",
      "embedUrl": "https://photos.google.com/share/example",
      "iconUrl": "https://drive-thirdparty.googleusercontent.com/example",
      "serviceId": "photos",
      "type": "photo",
      "thumbnails": [
        {
          "url": "https://lh3.googleusercontent.com/example=s220",
          "width": 220,
          "height": 165
        }
      ],
      "photoMetadata": {
        "width": 4032,
        "height": 3024,
        "captureTime": "2023-12-25T14:30:22.456Z"
      },
      "lastEditedUtc": 1703516422456,
      "createdDate": 1703516422456
    }
  ]
}
```

---

## 🎨 Database Field Mapping

| Google Picker Field | Your Database Field | Type | Notes |
|---------------------|---------------------|------|-------|
| `id` | `google_photo_id` | VARCHAR(255) | Unique constraint |
| `serviceId` | `service_id` | VARCHAR(50) | Always "photos" |
| `name` | `name` | VARCHAR(255) | Original filename |
| `description` | `description` | TEXT | May be empty |
| `mimeType` | `mime_type` | VARCHAR(100) | e.g., "image/jpeg" |
| `url` | `url` | TEXT | Full resolution URL |
| `thumbnails[0].url` | `thumbnail_url` | TEXT | Smallest thumbnail |
| `sizeBytes` | `size_bytes` | BIGINT | Convert to number |
| `photoMetadata.width` | `width` | INT | Image width |
| `photoMetadata.height` | `height` | INT | Image height |
| `photoMetadata.captureTime` | `capture_time` | DATETIME | When photo taken |
| `lastEditedUtc` | `last_edited_utc` | BIGINT | Unix milliseconds |
| - | `source` | VARCHAR(50) | Set to "google_photos" |
| - | `synced_at` | DATETIME | Current timestamp |

---

## ✅ Validation Checklist

Before sending to backend, validate:

- ✅ `google_photo_id` is present and not empty
- ✅ `name` is present and not empty
- ✅ `url` is present and starts with `https://`
- ✅ `mime_type` is present
- ✅ `capture_time` is valid ISO 8601 format
- ✅ `size_bytes` is converted to number (not string)
- ✅ `width` and `height` are numbers (if present)

---

This structure is based on the official Google Picker API with `photospicker.mediaitems.readonly` scope.
