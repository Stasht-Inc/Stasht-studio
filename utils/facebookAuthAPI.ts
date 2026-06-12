// Facebook OAuth and Graph API utilities

const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID;
const FACEBOOK_REDIRECT_URI = import.meta.env.VITE_FACEBOOK_REDIRECT_URI;
const FACEBOOK_GRAPH_API_VERSION = 'v18.0';
const FACEBOOK_GRAPH_API_BASE = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}`;

/**
 * Generate Facebook OAuth URL for photo access
 */
export function getFacebookAuthUrl(state?: string): string {
  const scopes = [
    'public_profile',
    'email',
    'user_photos'  // Required for accessing user's photos
  ];

  const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
  authUrl.searchParams.append('client_id', FACEBOOK_APP_ID);
  authUrl.searchParams.append('redirect_uri', FACEBOOK_REDIRECT_URI);
  authUrl.searchParams.append('scope', scopes.join(','));
  authUrl.searchParams.append('response_type', 'token'); // Implicit flow for frontend
  authUrl.searchParams.append('state', state || 'facebook_photos_sync');

  return authUrl.toString();
}

/**
 * Fetch user's Facebook photo albums
 */
export async function fetchFacebookAlbums(accessToken: string): Promise<any> {
  try {
    const url = `${FACEBOOK_GRAPH_API_BASE}/me/albums?fields=id,name,photo_count,cover_photo&access_token=${accessToken}`;

    console.log('📸 Fetching Facebook albums...');
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Failed to fetch albums:', error);
      throw new Error(error.error?.message || 'Failed to fetch albums');
    }

    const data = await response.json();
    console.log('✅ Albums fetched:', data);
    return data;
  } catch (error) {
    console.error('❌ Error fetching Facebook albums:', error);
    throw error;
  }
}

/**
 * Fetch photos from a specific album
 */
export async function fetchPhotosFromAlbum(albumId: string, accessToken: string): Promise<any> {
  try {
    const url = `${FACEBOOK_GRAPH_API_BASE}/${albumId}/photos?fields=id,name,picture,images,created_time,width,height&limit=100&access_token=${accessToken}`;

    console.log(`📸 Fetching photos from album ${albumId}...`);
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Failed to fetch photos:', error);
      throw new Error(error.error?.message || 'Failed to fetch photos');
    }

    const data = await response.json();
    console.log(`✅ Photos fetched from album ${albumId}:`, data.data?.length || 0);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching photos from album ${albumId}:`, error);
    throw error;
  }
}

/**
 * Fetch all user uploaded photos (without album selection)
 */
export async function fetchAllUserPhotos(accessToken: string): Promise<any> {
  try {
    // This endpoint gets all photos uploaded by the user
    const url = `${FACEBOOK_GRAPH_API_BASE}/me/photos/uploaded?fields=id,name,picture,images,created_time,width,height,album&limit=100&access_token=${accessToken}`;

    console.log('📸 Fetching all user uploaded photos...');
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Failed to fetch photos:', error);
      throw new Error(error.error?.message || 'Failed to fetch photos');
    }

    const data = await response.json();
    console.log('✅ User photos fetched:', data.data?.length || 0);
    return data;
  } catch (error) {
    console.error('❌ Error fetching user photos:', error);
    throw error;
  }
}

/**
 * Fetch all photos with pagination support
 */
export async function fetchAllPhotosWithPagination(accessToken: string): Promise<any[]> {
  let allPhotos: any[] = [];
  let nextPageUrl: string | null = `${FACEBOOK_GRAPH_API_BASE}/me/photos/uploaded?fields=id,name,picture,images,created_time,width,height,album&limit=100&access_token=${accessToken}`;

  console.log('📸 Starting paginated photo fetch...');

  while (nextPageUrl) {
    try {
      console.log(`📸 Fetching page... (Total so far: ${allPhotos.length})`);
      const response = await fetch(nextPageUrl);

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Failed to fetch photos page:', error);
        break;
      }

      const data = await response.json();

      if (data.data && data.data.length > 0) {
        allPhotos = allPhotos.concat(data.data);
        console.log(`✅ Added ${data.data.length} photos (Total: ${allPhotos.length})`);
      }

      // Check for next page
      nextPageUrl = data.paging?.next || null;

    } catch (error) {
      console.error('❌ Error during pagination:', error);
      break;
    }
  }

  console.log(`✅ Total photos fetched: ${allPhotos.length}`);
  return allPhotos;
}

/**
 * Transform Facebook photo data to our media format
 */
export function transformFacebookPhoto(fbPhoto: any): any {
  // Facebook returns images array sorted by size in DESCENDING order (largest first)
  const images = fbPhoto.images || [];

  // Get the highest resolution image (first in array - largest size)
  const highestResImage = images.length > 0 ? images[0] : null;

  // Get a medium resolution image for thumbnail (to save bandwidth)
  // Use middle of array, or smallest if array is small
  let thumbnailImage = null;
  if (images.length > 2) {
    // Use middle-sized image for thumbnail
    thumbnailImage = images[Math.floor(images.length / 2)];
  } else if (images.length > 0) {
    // Use last image (smallest) for thumbnail if only 1-2 images
    thumbnailImage = images[images.length - 1];
  }

  // IMPORTANT: Always prioritize images[0].source for original quality
  // The 'picture' field is only a low-res thumbnail (typically 130x130)
  const originalUrl = highestResImage?.source || fbPhoto.picture || '';
  const thumbnailUrl = thumbnailImage?.source || highestResImage?.source || fbPhoto.picture || '';

  console.log(`📸 Transform FB Photo ${fbPhoto.id}: Original=${highestResImage?.width}x${highestResImage?.height}, Thumbnail=${thumbnailImage?.width}x${thumbnailImage?.height}`);

  // Facebook's 'name' field is actually the caption/description, not the file name
  // So we use it as description and try to extract file name from URL
  const caption = fbPhoto.name || '';

  // Try to extract file name from the image URL
  let fileName = '';
  try {
    const urlPath = new URL(originalUrl).pathname;
    const urlFileName = urlPath.split('/').pop() || '';
    // Clean up the file name (remove query params if any)
    fileName = urlFileName.split('?')[0];
  } catch (e) {
    fileName = '';
  }

  // Use extracted file name, or fallback to Facebook Photo + ID
  const photoName = fileName || `Facebook_Photo_${fbPhoto.id}.jpg`;

  return {
    id: fbPhoto.id,
    name: photoName, // File name extracted from URL or generated
    description: caption, // Facebook caption goes to description
    thumbnail: thumbnailUrl,
    original: originalUrl,
    width: highestResImage?.width || fbPhoto.width || 0,
    height: highestResImage?.height || fbPhoto.height || 0,
    created_time: fbPhoto.created_time || new Date().toISOString(),
    source: 'facebook',
    album: fbPhoto.album?.name || 'Facebook Photos'
  };
}

/**
 * Validate Facebook access token
 */
export async function validateFacebookToken(accessToken: string): Promise<boolean> {
  try {
    const url = `${FACEBOOK_GRAPH_API_BASE}/me?access_token=${accessToken}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('❌ Token validation failed');
      return false;
    }

    console.log('✅ Facebook token is valid');
    return true;
  } catch (error) {
    console.error('❌ Error validating token:', error);
    return false;
  }
}

/**
 * Store Facebook access token in sessionStorage with timestamp
 */
export function storeFacebookToken(accessToken: string): void {
  const timestamp = Date.now();
  sessionStorage.setItem('facebook_access_token', accessToken);
  sessionStorage.setItem('facebook_token_timestamp', timestamp.toString());
  console.log('💾 Facebook access token stored at:', new Date(timestamp).toLocaleString());
}

/**
 * Get Facebook access token from sessionStorage
 */
export function getFacebookToken(): string | null {
  return sessionStorage.getItem('facebook_access_token');
}

/**
 * Check if Facebook token is expired (12 hours)
 * Returns true if expired or no token exists
 */
export function isFacebookTokenExpired(): boolean {
  const token = sessionStorage.getItem('facebook_access_token');
  const timestampStr = sessionStorage.getItem('facebook_token_timestamp');

  // If no token or timestamp, consider expired
  if (!token || !timestampStr) {
    console.log('⏰ No Facebook token found - needs authentication');
    return true;
  }

  const timestamp = parseInt(timestampStr);
  const now = Date.now();
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

  const ageMs = now - timestamp;
  const isExpired = ageMs > TWELVE_HOURS_MS;

  if (isExpired) {
    const hoursAgo = Math.floor(ageMs / (60 * 60 * 1000));
    console.log(`⏰ Facebook token EXPIRED (${hoursAgo} hours old) - re-authentication needed`);
  } else {
    const hoursRemaining = Math.floor((TWELVE_HOURS_MS - ageMs) / (60 * 60 * 1000));
    const minutesRemaining = Math.floor(((TWELVE_HOURS_MS - ageMs) % (60 * 60 * 1000)) / (60 * 1000));
    console.log(`✅ Facebook token VALID (${hoursRemaining}h ${minutesRemaining}m remaining)`);
  }

  return isExpired;
}

/**
 * Clear Facebook access token from sessionStorage
 */
export function clearFacebookToken(): void {
  sessionStorage.removeItem('facebook_access_token');
  sessionStorage.removeItem('facebook_token_timestamp');
  console.log('🗑️ Facebook access token and timestamp cleared');
}
