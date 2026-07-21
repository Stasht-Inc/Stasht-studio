// Media API service functions
import { apiRequest } from '../utils/authUtils';

// Cache buster for media API to prevent stale data
let mediaCacheBuster = Date.now();

export const resetMediaCache = () => {
  mediaCacheBuster = Date.now();
  console.log('Media cache reset with buster:', mediaCacheBuster);
};

// Media API response interfaces
export interface MediaAPIResponse {
  success: boolean;
  data?: {
    categories_media?: MediaCategory[];
    unassigned_media?: UnassignedMediaItem[];
  };
  error?: string;
  message?: string;
  status?: boolean;
}

export interface MediaCategory {
  category_name: string;
  memories: MediaMemory[];
}

export interface MediaMemory {
  id: string;
  title: string;
  category: string;
  media: MediaItem[];
}

export interface MediaItem {
  id: string;
  image_url: string;
  name: string;
  location?: string;
  size?: string;
  dimensions?: string;
  capture_date?: string;
  created_at: string;
  updated_at: string;
  rotation_angle?: number;
}

export interface UnassignedMediaItem {
  id: string;
  image_url: string;
  name: string;
  location?: string;
  size?: string;
  dimensions?: string;
  capture_date?: string;
  created_at: string;
  updated_at: string;
  rotation_angle?: number;
}

// Comment API interfaces
export interface CommentUser {
  id: number;
  role: string;
  name: string;
  email: string;
  phone_number?: string | null;
  location?: string | null;
  bio?: string | null;
  email_verified_at?: string | null;
  user_name?: string | null;
  status: number;
  profile_image?: string;
  profile_color?: string | null;
  plan_id?: number;
  notifications_count?: number;
  instagram_synced?: string | null;
  facebook_synced?: string | null;
  google_drive_synced?: string | null;
  google_photo_synced?: string | null;
  device_type?: string | null;
  device_token?: string | null;
  app_version?: string | null;
  google_id?: string | null;
  apple_id?: string | null;
  created_at?: string | null;
  updated_at?: string;
  deleted_at?: string | null;
  admin_id?: number;
  app_id?: number;
}

export interface Comment {
  id: number;
  user_id: number;
  comment_id?: number | null;
  media_id: number;
  memory_id: number;
  parent_id: number | null;
  description: string;
  likes_count?: number; // Made optional in case API doesn't provide it
  like_count?: number; // Alternative field name
  is_liked: boolean; // Whether current user has liked this comment
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  user: CommentUser;
  replies: Comment[];
}

export interface CommentAPIResponse {
  success: boolean;
  data?: Comment | Comment[];
  message?: string;
  error?: string;
}

// Search API interfaces
export interface SearchResult {
  id: string | number;
  title?: string;
  name?: string;
  type: 'memory' | 'media' | 'user';
  thumbnail?: string;
  avatar?: string;
  category?: string;
  location?: string;
  date?: string;
}

export interface SearchAPIResponse {
  success: boolean;
  data?: {
    recent_searches?: string[];
    memories?: any[];
    media?: any[];
    users?: any[];
    results?: SearchResult[];
  };
  error?: string;
}

// Search API service
export const searchAPI = {
  // Get search results and recent searches
  search: async (params: {
    search_term: string;
    filter?: 'all' | 'memories' | 'users' | 'media' | 'published';
  }): Promise<SearchAPIResponse | null> => {
    try {
      // Prepare request body for POST
      const requestBody = {
        search_term: params.search_term,
        ...(params.filter && params.filter !== 'all' && { filter: params.filter })
      };
      
      const endpoint = `/user/recent-search`;
      console.log('🌐 searchAPI.search: Making POST request to', endpoint);
      console.log('🌐 searchAPI.search: Request body:', requestBody);
      console.log('🌐 searchAPI.search: Request method: POST');
      
      const response = await apiRequest<SearchAPIResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      console.log('🌐 searchAPI.search: Raw API Response:', response);
      console.log('🌐 searchAPI.search: Response type:', typeof response);
      console.log('🌐 searchAPI.search: Response keys:', response ? Object.keys(response) : 'null');
      console.log('🌐 searchAPI.search: Full API Response (stringified):', JSON.stringify(response, null, 2));
      
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data
        };
      }
      
      return {
        success: false,
        error: response.error || 'Search failed'
      };
    } catch (error) {
      console.error('🌐 searchAPI.search: Error during search:', error);
      console.error('🌐 searchAPI.search: Error type:', typeof error);
      console.error('🌐 searchAPI.search: Error stack:', error instanceof Error ? error.stack : 'no stack');
      console.error('🌐 searchAPI.search: Error message:', error instanceof Error ? error.message : String(error));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }
};

// Media API service
export const mediaAPI = {
  // Get all media with categories and unassigned media  
  getMemoryImages: async (params?: {
    search?: string;
    sort_by?: 'name' | 'location' | 'date' | 'memory' | 'size' | 'upload_latest' | 'upload_oldest';
    order?: 'asc' | 'desc';
  }): Promise<MediaAPIResponse | null> => {
    try {
      // Build query string from parameters
      const queryParams = new URLSearchParams();
      if (params?.search) {
        queryParams.append('search', params.search);
      }
      if (params?.sort_by) {
        queryParams.append('sort_by', params.sort_by);
      }
      if (params?.order) {
        queryParams.append('order', params.order);
      }
      
      // Add cache buster to prevent stale data
      queryParams.append('_cb', mediaCacheBuster.toString());

      const queryString = queryParams.toString();
      const endpoint = `/memory-images?${queryString}`;
      
      console.log('🚀🚀🚀 SIDEBAR MEDIA API ENDPOINT:', endpoint);
      console.log('🚨🚨🚨 mediaAPI.getMemoryImages: Fetching from', endpoint);
      const response = await apiRequest<MediaAPIResponse>(endpoint);
      
      console.log('🚨🚨🚨 mediaAPI.getMemoryImages: Response received');
      console.log('🚨🚨🚨 mediaAPI.getMemoryImages: Response success:', response?.success);
      console.log('🚨🚨🚨 mediaAPI.getMemoryImages: Response data exists:', !!response?.data);
      console.log('🚨🚨🚨 mediaAPI.getMemoryImages: Full API Response:', JSON.stringify(response, null, 2));
      
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data
        };
      }
      
      return {
        success: false,
        error: response.error || 'Failed to fetch media data'
      };
    } catch (error) {
      console.error('Error fetching memory images:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  // Move images to existing memory
  moveImagesToMemory: async (params: {
    image_ids: number[];
    target_memory_ids: number[];
  }): Promise<MediaAPIResponse | null> => {
    try {
      const endpoint = '/memory-images/move-to-memory';
      
      console.log('🚀 mediaAPI.moveImagesToMemory: Making POST request to', endpoint);
      console.log('🚀 mediaAPI.moveImagesToMemory: Request body:', params);
      
      const response = await apiRequest<MediaAPIResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify(params)
      });
      
      console.log('🚀 mediaAPI.moveImagesToMemory: Response received:', response);
      
      if (response.success) {
        return {
          success: true,
          data: response.data,
          message: response.message || 'Images moved to campaign successfully'
        };
      }
      
      return {
        success: false,
        error: response.error || 'Failed to move images to campaign'
      };
    } catch (error) {
      console.error('Error moving images to memory:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  // Create new memory with selected images
  createMemoryWithSelectedImages: async (params: {
    title: string;
    category_id: number;
    image_ids: number[];
  }): Promise<MediaAPIResponse | null> => {
    try {
      const endpoint = '/memories/create-with-images';
      
      console.log('🚀 mediaAPI.createMemoryWithSelectedImages: Making POST request to', endpoint);
      console.log('🚀 mediaAPI.createMemoryWithSelectedImages: Request body:', params);
      
      const response = await apiRequest<MediaAPIResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify(params)
      });
      
      console.log('🚀 mediaAPI.createMemoryWithSelectedImages: Response received:', response);
      
      if (response.success) {
        return {
          success: true,
          data: response.data,
          message: response.message || 'Campaign created successfully with selected images'
        };
      }
      
      return {
        success: false,
        error: response.error || 'Failed to create campaign with selected images'
      };
    } catch (error) {
      console.error('Error creating memory with selected images:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  // Update image location
  updateImageLocation: async (imageId: string, location: string): Promise<{success: boolean; data?: any; error?: string}> => {
    try {
      console.log('📍 Updating location for image:', imageId, 'to:', location);

      const response = await apiRequest(`/memory-images/${imageId}`, {
        method: 'PUT',
        body: JSON.stringify({ location })
      });

      console.log('📍 Update location response:', response);

      if (response.success) {
        return {
          success: true,
          data: response.data
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to update image location'
      };
    } catch (error) {
      console.error('Error updating image location:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  // Update image tags
  updateImageTags: async (imageId: string, tags: string[]): Promise<{success: boolean; data?: any; error?: string}> => {
    try {
      console.log('🏷️ Updating tags for image:', imageId, 'to:', tags);

      const response = await apiRequest(`/memory-images/${imageId}`, {
        method: 'PUT',
        body: JSON.stringify({ tags })
      });

      console.log('🏷️ Update tags response:', response);

      if (response.success) {
        return {
          success: true,
          data: response.data
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to update image tags'
      };
    } catch (error) {
      console.error('Error updating image tags:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  // Update image crop settings
  updateImageCrop: async (imageId: string, cropData: {x: number; y: number; width: number; height: number; zoom: number; imageWidth: number; imageHeight: number}): Promise<{success: boolean; data?: any; error?: string}> => {
    try {
      console.log('✂️ Updating crop settings for image:', imageId, 'with data:', cropData);

      const response = await apiRequest(`/memory-images/${imageId}/crop`, {
        method: 'PUT',
        body: JSON.stringify({ crop_data: cropData })
      });

      console.log('✂️ Update crop response:', response);

      if (response.success) {
        return {
          success: true,
          data: response.data
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to update image crop settings'
      };
    } catch (error) {
      console.error('Error updating image crop:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  // Add moment with files using uploadphotosaftercreate API
  addMoment: async (params: {
    memoryId: string;
    files: File[];
    imageDetails: { [key: number]: { description: string; date: string; location: string; title?: string; tags?: string[] } };
    mediaLibraryImages?: Array<{
      image_url: string;
      media_id: string;
      title: string;
      description: string;
      capture_date: string;
      location: string;
      tags?: string[];
    }>;
    userRole?: 'contributor' | 'viewer' | 'admin' | undefined;
    parentImageId?: string;
    afterPostId?: string;
    s3Urls?: { [index: number]: string };
    sizes?: { [index: number]: number };
    isProperty?: boolean;
  }): Promise<MediaAPIResponse | null> => {
    try {
      const formData = new FormData();

      // Required field - memory_id for all images
      formData.append('memory_id', params.memoryId);

      // Send is_property=1 when on property account
      if (params.isProperty) {
        formData.append('is_property', '1');
      }

      // Add parent image ID if provided (for sub-images)
      if (params.parentImageId) {
        formData.append('parent_image_id', params.parentImageId);
        console.log('🎯 mediaAPI.addMoment: Adding sub-image with parent_image_id:', params.parentImageId);
      }

      // Add after_post_id if provided (for positional insertion)
      console.log('🎯 mediaAPI.addMoment: afterPostId received:', params.afterPostId, typeof params.afterPostId);
      if (params.afterPostId != null && params.afterPostId !== '') {
        formData.append('after_post_id', String(params.afterPostId));
        console.log('🎯 mediaAPI.addMoment: Inserting after post_id:', params.afterPostId);
      }

      // Add user role if provided (for contributor review flow)
      if (params.userRole) {
        formData.append('user_role', params.userRole);
      }

      let currentIndex = 0;

      // Process desktop files according to API specification
      params.files.forEach((file, index) => {
        const imageDetail = params.imageDetails[index];

        if (currentIndex === 0) {
          // First image uses base keys
          const s3Url = params.s3Urls?.[index];
          formData.append('file', s3Url || file);
          formData.append('name', file.name.split('.')[0] || 'Image'); // File name without extension
          if (params.sizes?.[index] != null) formData.append('size', String(params.sizes[index]));
          formData.append('location', imageDetail?.location || '');
          formData.append('capture_date', imageDetail?.date || new Date().toISOString().split('T')[0]);
          formData.append('description', imageDetail?.description || '');
          // Add title as separate field if provided
          if (imageDetail?.title) {
            formData.append('title', imageDetail.title);
            console.log('📝 mediaAPI.addMoment: Adding title for image 0:', imageDetail.title);
          }
          // Add tags if provided
          if (imageDetail?.tags && imageDetail.tags.length > 0) {
            imageDetail.tags.forEach((tag, i) => {
              formData.append(`tags[${i}]`, tag);
            });
          }
        } else {
          // Subsequent images use indexed keys (file_1, file_2, etc.)
          const s3Url = params.s3Urls?.[index];
          formData.append(`file_${currentIndex}`, s3Url || file);
          formData.append(`name_${currentIndex}`, file.name.split('.')[0] || `Image ${currentIndex + 1}`); // File name without extension
          if (params.sizes?.[index] != null) formData.append(`size_${currentIndex}`, String(params.sizes[index]));
          formData.append(`location_${currentIndex}`, imageDetail?.location || '');
          formData.append(`capture_date_${currentIndex}`, imageDetail?.date || new Date().toISOString().split('T')[0]);
          formData.append(`description_${currentIndex}`, imageDetail?.description || '');
          // Add title as separate field if provided
          if (imageDetail?.title) {
            formData.append(`title_${currentIndex}`, imageDetail.title);
            console.log(`📝 mediaAPI.addMoment: Adding title_${currentIndex}:`, imageDetail.title);
          }
          // Add tags if provided
          if (imageDetail?.tags && imageDetail.tags.length > 0) {
            imageDetail.tags.forEach((tag, i) => {
              formData.append(`tags_${currentIndex}[${i}]`, tag);
            });
          }
        }
        currentIndex++;
      });

      // Image-less moment: no desktop files and no media library images. Send the
      // moment's details (title/description/date/location/tags) without a file so the
      // backend still receives them, regardless of which field the user filled.
      if (currentIndex === 0 && params.files.length === 0 && !(params.mediaLibraryImages && params.mediaLibraryImages.length > 0)) {
        const imageDetail = params.imageDetails[0] || {} as { description?: string; date?: string; location?: string; title?: string; tags?: string[] };
        formData.append('name', imageDetail.title || 'Moment');
        formData.append('description', imageDetail.description || '');
        formData.append('capture_date', imageDetail.date || new Date().toISOString().split('T')[0]);
        formData.append('location', imageDetail.location || '');
        if (imageDetail.title) {
          formData.append('title', imageDetail.title);
        }
        if (imageDetail.tags && imageDetail.tags.length > 0) {
          imageDetail.tags.forEach((tag, i) => {
            formData.append(`tags[${i}]`, tag);
          });
        }
      }

      // Process media library images
      if (params.mediaLibraryImages && params.mediaLibraryImages.length > 0) {
        params.mediaLibraryImages.forEach((mlImage) => {
          if (currentIndex === 0) {
            // First image uses base keys
            formData.append('media_id', mlImage.media_id);
            formData.append('image_url', mlImage.image_url);
            formData.append('name', 'Media Library Image'); // Default name
            formData.append('location', mlImage.location || '');
            formData.append('capture_date', mlImage.capture_date || new Date().toISOString().split('T')[0]);
            formData.append('description', mlImage.description || '');
            // Add title as separate field if provided
            if (mlImage.title) {
              formData.append('title', mlImage.title);
              console.log('📝 mediaAPI.addMoment: Adding title for media library image 0:', mlImage.title);
            }
            // Add tags if provided
            if (mlImage.tags && mlImage.tags.length > 0) {
              mlImage.tags.forEach((tag, i) => {
                formData.append(`tags[${i}]`, tag);
              });
            }
          } else {
            // Subsequent images use indexed keys
            formData.append(`media_id_${currentIndex}`, mlImage.media_id);
            formData.append(`image_url_${currentIndex}`, mlImage.image_url);
            formData.append(`name_${currentIndex}`, `Media Library Image ${currentIndex + 1}`); // Default name
            formData.append(`location_${currentIndex}`, mlImage.location || '');
            formData.append(`capture_date_${currentIndex}`, mlImage.capture_date || new Date().toISOString().split('T')[0]);
            formData.append(`description_${currentIndex}`, mlImage.description || '');
            // Add title as separate field if provided
            if (mlImage.title) {
              formData.append(`title_${currentIndex}`, mlImage.title);
              console.log(`📝 mediaAPI.addMoment: Adding title_${currentIndex} for media library:`, mlImage.title);
            }
            // Add tags if provided
            if (mlImage.tags && mlImage.tags.length > 0) {
              mlImage.tags.forEach((tag, i) => {
                formData.append(`tags_${currentIndex}[${i}]`, tag);
              });
            }
          }
          currentIndex++;
        });
      }

      const endpoint = '/memories/upload-photos-after-creation';
      console.log('🚀 mediaAPI.addMoment: Making POST request to', endpoint);
      console.log('🚀 mediaAPI.addMoment: FormData contents:', {
        memory_id: params.memoryId,
        desktopFilesCount: params.files.length,
        mediaLibraryImagesCount: params.mediaLibraryImages?.length || 0,
        totalImagesCount: currentIndex,
        files: params.files.map((f, i) => ({
          name: f.name,
          index: i,
          details: params.imageDetails[i]
        })),
        mediaLibraryImages: params.mediaLibraryImages || []
      });

      // Get token for auth headers
      const token = localStorage.getItem('stasht_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      // Note: Don't set Content-Type for FormData, browser will set it automatically with boundary

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/react'}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData
      });

      const data = await response.json();
      console.log('🚀 mediaAPI.addMoment: Response received:', data);

      if (response.ok && (data.success || data.status)) {
        return {
          success: true,
          data: data.data,
          message: data.message || 'Moment added successfully'
        };
      }

      return {
        success: false,
        error: data.error || data.message || 'Failed to add moment'
      };
    } catch (error) {
      console.error('Error adding moment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  // Get comments for a specific media item
  getComments: async (mediaId: string | number): Promise<any> => {
    try {
      const endpoint = `/memory-images/${mediaId}/comments?_cb=${mediaCacheBuster}`;
      console.log('🔥🔥 getComments API - Calling endpoint:', endpoint);
      
      const response = await apiRequest<any>(endpoint, {
        method: 'GET'
      });
      
      console.log('🔥🔥 getComments API - Raw response from apiRequest:', response);
      
      if (response.success) {
        // Handle the new API response structure with media data
        if (response.data && typeof response.data === 'object') {
          // New structure: { comments: [], media: {...} }
          if (response.data.comments !== undefined && response.data.media !== undefined) {
            console.log('🔥🔥 getComments API - Found comments and media in response.data:', response.data);
            const returnValue = {
              success: true,
              data: response.data  // Just return response.data directly
            };
            console.log('🔥🔥 getComments API - Returning to fetchComments:', returnValue);
            return returnValue;
          }
          // Handle nested data structure: response.data.data  
          else if (response.data.data) {
            console.log('🔥🔥 getComments API - Found nested data.data structure:', response.data.data);
            const nestedData = response.data.data;
            
            // Check if the nested data has comments and media
            if (nestedData.comments !== undefined && nestedData.media !== undefined) {
              console.log('🔥🔥 getComments API - Nested structure has comments and media');
              const returnValue = {
                success: true,
                data: nestedData  // Return the nested data directly (contains comments and media)
              };
              console.log('🔥🔥 getComments API - Returning nested comments and media:', returnValue);
              return returnValue;
            }
            
            // Fallback if nested data is just an array
            const returnValue = {
              success: true,
              data: Array.isArray(nestedData) ? nestedData : []
            };
            console.log('🔥🔥 getComments API - Returning nested array:', returnValue);
            return returnValue;
          }
        }
        
        // Fallback for old structure: direct array
        console.log('🔥🔥 getComments API - Using fallback for old structure');
        const commentsData = response.data || [];
        const returnValue = {
          success: true,
          data: Array.isArray(commentsData) ? commentsData : []
        };
        console.log('🔥🔥 getComments API - Returning fallback:', returnValue);
        return returnValue;
      }
      
      console.log('🔥🔥 getComments API - Response not successful:', response);
      return {
        success: false,
        error: response.error || 'Failed to fetch comments'
      };
    } catch (error) {
      console.error('🔥🔥 getComments API - Caught error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  // Add a new comment or reply
  addComment: async (params: {
    image_id: string | number;
    comment: string;
    parent_id?: string | number | null;
    mentioned_emails?: string[];
    mentioned_phones?: string[];
  }): Promise<any> => {
    try {
      const endpoint = `/memory-images/comments`;

      // Build request body exactly as specified in API
      const requestBody: any = {
        image_id: parseInt(params.image_id.toString()),
        comment: params.comment
      };

      // Only add parent_id if it exists (for replies)
      if (params.parent_id) {
        requestBody.parent_id = parseInt(params.parent_id.toString());
      }

      // Add mentioned_emails if provided
      if (params.mentioned_emails && params.mentioned_emails.length > 0) {
        requestBody.mentioned_emails = params.mentioned_emails;
      }

      // Add mentioned_phones if provided
      if (params.mentioned_phones && params.mentioned_phones.length > 0) {
        requestBody.mentioned_phones = params.mentioned_phones;
      }

      console.log('📧 addComment - Request body:', requestBody);

      const response = await apiRequest<any>(endpoint, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      if (response && response.success) {
        return {
          success: true,
          data: response.data,
          message: response.message || 'Comment added successfully'
        };
      }

      return {
        success: false,
        error: response?.error || response?.message || 'Failed to add comment'
      };
    } catch (error) {
      console.error('Error adding comment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  // Like a comment
  likeComment: async (commentId: string | number): Promise<any> => {
    try {
      const endpoint = `/memory-images/comments/${commentId}/like`;
      
      const response = await apiRequest<any>(endpoint, {
        method: 'POST'
      });
      
      if (response.success) {
        return {
          success: true,
          data: response.data,
          message: response.message || 'Comment liked successfully'
        };
      }
      
      return {
        success: false,
        error: response.error || 'Failed to like comment'
      };
    } catch (error) {
      console.error('Error liking comment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  // Unlike a comment
  unlikeComment: async (commentId: string | number): Promise<any> => {
    try {
      const endpoint = `/memory-images/comments/${commentId}/unlike`;
      
      const response = await apiRequest<any>(endpoint, {
        method: 'POST'
      });
      
      if (response.success) {
        return {
          success: true,
          data: response.data,
          message: response.message || 'Comment unliked successfully'
        };
      }
      
      return {
        success: false,
        error: response.error || 'Failed to unlike comment'
      };
    } catch (error) {
      console.error('Error unliking comment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  // Delete multiple images
  deleteImages: async (imageIds: number[]): Promise<{success: boolean; data?: any; error?: string}> => {
    try {
      console.log('🗑️ Deleting images with IDs:', imageIds);
      
      const endpoint = '/memory-images/delete-multiple';
      
      const response = await apiRequest<any>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ image_ids: imageIds })
      });
      
      console.log('🗑️ Delete images response:', response);
      
      if (response.success) {
        return {
          success: true,
          data: response.data,
          message: response.message || 'Images deleted successfully'
        };
      }
      
      return {
        success: false,
        error: response.error || 'Failed to delete images'
      };
    } catch (error) {
      console.error('Error deleting images:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  // Mark new images as seen
  markImagesSeen: async (imageIds: (string | number)[]): Promise<{success: boolean; data?: any; error?: string}> => {
    try {
      const response = await apiRequest<any>('/memory-images/mark-seen', {
        method: 'POST',
        body: JSON.stringify({ image_ids: imageIds.map(id => Number(id)) }),
      });
      return { success: !!response?.success, data: response?.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // Delete single image by ID
  deleteImage: async (imageId: string | number): Promise<{success: boolean; data?: any; error?: string}> => {
    try {
      console.log('🗑️ Deleting single image with ID:', imageId);
      
      const endpoint = `/memory-images/${imageId}`;
      
      const response = await apiRequest<any>(endpoint, {
        method: 'DELETE'
      });
      
      console.log('🗑️ Delete single image response:', response);
      
      if (response.success) {
        return {
          success: true,
          data: response.data,
          message: response.message || 'Image deleted successfully'
        };
      }
      
      return {
        success: false,
        error: response.error || 'Failed to delete image'
      };
    } catch (error) {
      console.error('Error deleting single image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  // Unpublish a memory
  unpublishMemory: async (memoryId: string | number): Promise<{success: boolean; data?: any; error?: string}> => {
    try {
      console.log('📝 Unpublishing memory with ID:', memoryId);

      const endpoint = '/memories/memory-unpublished';

      const response = await apiRequest<any>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ memory_id: memoryId })
      });

      console.log('📝 Unpublish memory response:', response);

      if (response.success) {
        return {
          success: true,
          data: response.data,
          message: response.message || 'Campaign unpublished successfully'
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to unpublish campaign'
      };
    } catch (error) {
      console.error('Error unpublishing memory:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  // Save image rotation to database
  rotateImage: async (imageId: string | number, rotationAngle: number): Promise<{success: boolean; data?: any; error?: string}> => {
    try {
      console.log('🔄 Saving image rotation for ID:', imageId, 'angle:', rotationAngle);

      const endpoint = `/memory-images/${imageId}/rotate`;

      const response = await apiRequest<any>(endpoint, {
        method: 'PUT',
        body: JSON.stringify({ rotation_angle: rotationAngle })
      });

      console.log('🔄 Save rotation response:', response);

      if (response.success) {
        return {
          success: true,
          data: response.data,
          message: response.message || 'Image rotation saved successfully'
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to save image rotation'
      };
    } catch (error) {
      console.error('Error saving image rotation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }
};

// Utility functions for transforming API data to component format
export const mediaTransformers = {
  // Transform API categories to component format
  transformCategoriesToMediaMemories: (categories: MediaCategory[]) => {
    return categories.flatMap((category, categoryIndex) => 
      category.memories.map((memory, memoryIndex) => ({
        id: memory.id || `cat_${categoryIndex}_mem_${memoryIndex}`,
        title: memory.title,
        category: memory.category,
        thumbnail: memory.media[0]?.image_url || '',
        imageCount: memory.media.length,
        date: memory.media[0]?.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        type: 'personal' as const,
        author: 'Unknown',
        isExpanded: false,
        images: memory.media.map((item, index) => ({
          id: item.id || `mem_${memory.id}_img_${index}`,
          name: item.name || `Image ${item.id || index}`,
          thumbnail: item.image_url,
          date: item.created_at || new Date().toISOString(),
          size: item.size || 'Unknown',
          type: 'image' as const,
          dimensions: item.dimensions || 'Unknown',
          location: item.location,
          captureDate: item.capture_date,
          metadata: {
            location: item.location,
            captureDate: item.capture_date,
            camera: 'Unknown',
            dimensions: item.dimensions || 'Unknown'
          }
        }))
      }))
    );
  },

  // Transform API unassigned media to component format
  transformUnassignedMedia: (unassignedMedia: any[]) => {
    console.log('🔧 transformUnassignedMedia input:', unassignedMedia);
    console.log('🔧 Sample unassigned item:', unassignedMedia[0]);
    
    return unassignedMedia.map((item, index) => {
      console.log('🔧 Processing legacy unassigned item:', index, item);
      console.log('🔧 Available fields:', Object.keys(item));
      
      return {
        id: item.media_id || `unassigned_${index}`,
        name: item.name || `IMG_${item.media_id || index}.jpg`,
        thumbnail: item.media_url || item.image_url || item.url, // Try multiple field names
        date: item.capture_date || item.created_at || new Date().toISOString(),
        size: item.size || item.media_size || item.file_size || 'Unknown', // Try multiple size fields
        type: 'image' as const,
        dimensions: 'Unknown', // Not provided in your API structure
        location: item.location,
        captureDate: item.capture_date || item.created_at,
        category: 'Unassigned',
        rotation_angle: item.rotation_angle || 0,
        metadata: {
          location: item.location,
          captureDate: item.capture_date || item.created_at,
          camera: 'Unknown',
          dimensions: 'Unknown'
        }
      };
    });
  },

  // Transform API data to individual media items for MediaPage
  transformToMediaItems: (apiData: any, onMetadataUpdate?: (itemId: string, metadata: {size: string, dimensions: string}) => void, selectedCategory?: string | null) => {
    const allMediaItems: any[] = [];

    // Shared helpers
    const formatSize = (mediaSize: any) => {
      if (!mediaSize) return 'Unknown';
      if (typeof mediaSize === 'string') {
        if (mediaSize.includes('MB') || mediaSize.includes('KB') || mediaSize.includes('GB') || mediaSize.includes('B')) return mediaSize;
        const num = parseFloat(mediaSize);
        if (!isNaN(num)) return `${num.toFixed(2)} MB`;
        return mediaSize;
      }
      if (typeof mediaSize === 'number') return mediaTransformers.formatFileSize(mediaSize);
      return 'Unknown';
    };

    const getSourceAndType = (item: any): { source?: string; mediaType: 'image' | 'video' } => {
      let source: string | undefined = undefined;
      let mediaType: 'image' | 'video' = 'image';
      if (item.type) {
        const t = item.type.toLowerCase();
        if (t === 'fb' || t === 'facebook') { source = 'facebook'; }
        else if (t === 'instagram' || t === 'ig') { source = 'instagram'; }
        else if (t === 'google_photos' || t === 'google') { source = 'google_photos'; }
        else if (t === 'video') { mediaType = 'video'; }
      }
      return { source, mediaType };
    };

    // NEW: Handle flat all_media array (memory_id present = assigned, null/0 = unassigned)
    if (apiData.all_media && Array.isArray(apiData.all_media)) {
      console.log('🎯 Using all_media flat array:', apiData.all_media.length, 'items');

      apiData.all_media.forEach((item: any) => {
        if (!item.media_id || !item.media_url) return;

        const isAssigned = !!item.memory_id;
        const { source, mediaType } = getSourceAndType(item);

        const categoryName = isAssigned
          ? (item.category_name || item.category || 'Uncategorized')
          : 'Unassigned';

        const memoryInfo = isAssigned
          ? { id: item.memory_id, title: item.memory_title || '', category: categoryName }
          : null;

        const mediaItem = {
          id: item.media_id,
          name: item.name || `IMG_${item.media_id}.jpg`,
          thumbnail: item.media_url,
          date: item.capture_date || item.created_at || new Date().toISOString(),
          uploadedAt: item.created_at || item.capture_date || new Date().toISOString(),
          size: formatSize(item.media_size || item.size),
          type: mediaType,
          dimensions: 'Loading...',
          location: item.location,
          captureDate: item.capture_date,
          category: categoryName,
          is_new: item.is_new || 0,
          memory: memoryInfo,
          rotation_angle: item.rotation_angle || 0,
          comments_count: item.comments_count || item.comment_count || 0,
          parent_id: item.parent_id || null,
          isFromUnassignedArray: !isAssigned,
          tags: (Array.isArray(item.tags) ? item.tags : []).map((t: any) => typeof t === 'string' ? t : t?.name).filter(Boolean),
          ...(source && { source }),
          ...(item.is_shared && {
            isShared: true,
            originalCategory: item.original_category,
            sharedBy: item.shared_by,
            user_name: item.shared_by?.name,
            description: item.description,
          }),
          metadata: {
            location: item.location,
            captureDate: item.capture_date,
            camera: 'Unknown',
            dimensions: 'Loading...',
          },
        };

        allMediaItems.push(mediaItem);

        if (item.media_url && onMetadataUpdate) {
          mediaTransformers.calculateImageDimensions(item.media_url).then(dimensions => {
            onMetadataUpdate(mediaItem.id, { size: mediaItem.size, dimensions });
          }).catch(() => {
            onMetadataUpdate(mediaItem.id, { size: mediaItem.size, dimensions: 'Unknown' });
          });
        }
      });
    }

    // LEGACY: Handle separate categories_media + unassigned_media format
    // CRITICAL: Build a Set of all unassigned media IDs first
    // This prevents items in unassigned_media from being added as "Shared With" or other categories
    const unassignedMediaIds = new Set<string>();
    if (!apiData.all_media && apiData.unassigned_media && Array.isArray(apiData.unassigned_media)) {
      apiData.unassigned_media.forEach((item: any) => {
        if (item.media_id) {
          unassignedMediaIds.add(item.media_id.toString());
        }
      });
      console.log('🎯 Found unassigned media IDs:', Array.from(unassignedMediaIds));
    }

    // Extract media items from categories_media (assigned media)
    if (!apiData.all_media && apiData.categories_media && typeof apiData.categories_media === 'object') {
      const categoryNames = Object.keys(apiData.categories_media);
      
      categoryNames.forEach((categoryName: string) => {
        // Normalize category name for consistent display
        const normalizedCategoryName = categoryName === 'sharedwith' ? 'Shared With' : categoryName;
        const categoryItems = apiData.categories_media[categoryName];
        
        if (Array.isArray(categoryItems)) {
          let currentMemoryInfo = null;
          
          categoryItems.forEach((item: any, index: number) => {
            // Update current memory info when we encounter memory metadata
            if (item.memory_id && item.memory_title && !item.media_id) {
              currentMemoryInfo = {
                id: item.memory_id,
                title: item.memory_title,
                category: normalizedCategoryName
              };
            }
            // Process media items
            else if (item.media_id && item.media_url) {
              // CRITICAL: Skip this item if it's in the unassigned_media array
              // Unassigned items should ONLY appear in the "Unassigned" category, not in any other category
              if (unassignedMediaIds.has(item.media_id.toString())) {
                console.log('🎯 Skipping item from category', normalizedCategoryName, 'because it is in unassigned_media:', item.media_id, item.name);
                return; // Skip this item - it will be added from unassigned_media instead
              }

              const { source, mediaType } = getSourceAndType(item);

              const mediaItem = {
                id: item.media_id,
                name: item.name || `IMG_${item.media_id}.jpg`,
                thumbnail: item.media_url,
                date: item.capture_date || new Date().toISOString(),
                uploadedAt: item.created_at || item.capture_date || new Date().toISOString(),
                size: formatSize(item.media_size || item.size), // Use API provided size first
                type: mediaType,
                dimensions: 'Loading...', // Will be calculated dynamically for dimensions only
                location: item.location, // Get location from $media->location
                captureDate: item.capture_date,
                category: normalizedCategoryName,
                is_new: item.is_new || 0,
                memory: currentMemoryInfo,
                rotation_angle: item.rotation_angle || 0,
                comments_count: item.comments_count || item.comment_count || 0, // Add comments count
                parent_id: item.parent_id || null, // Track parent_id for hierarchy
                tags: (Array.isArray(item.tags) ? item.tags : []).map((t: any) => typeof t === 'string' ? t : t?.name).filter(Boolean),
                ...(source && { source }), // Add source field only if it exists
                metadata: {
                  location: item.location, // Get location from $media->location
                  captureDate: item.capture_date,
                  camera: 'Unknown',
                  dimensions: 'Loading...' // Will be calculated dynamically
                },
                // Add SharedWith specific fields if this is a shared item
                ...(item.is_shared && {
                  isShared: true,
                  originalCategory: item.original_category,
                  sharedBy: item.shared_by,
                  user_name: item.shared_by?.name,
                  description: item.description
                })
              };

              allMediaItems.push(mediaItem);

              // Only calculate dimensions if not provided, keep the API size
              if (item.media_url && onMetadataUpdate) {
                mediaTransformers.calculateImageDimensions(item.media_url).then(dimensions => {
                  console.log(`📏 Calculated dimensions for ${mediaItem.name}: ${dimensions}`);
                  onMetadataUpdate(mediaItem.id, { size: mediaItem.size, dimensions });
                }).catch(error => {
                  console.warn('Failed to calculate dimensions for', mediaItem.name, error);
                  onMetadataUpdate(mediaItem.id, { size: mediaItem.size, dimensions: 'Unknown' });
                });
              }
            }
          });
        }
      });
    }

    // Add unassigned media items (legacy format only)
    // ONLY include unassigned when: no category selected OR "Unassigned" category selected
    const shouldIncludeUnassigned = !selectedCategory || selectedCategory === 'Unassigned';
    if (!apiData.all_media && shouldIncludeUnassigned && apiData.unassigned_media && Array.isArray(apiData.unassigned_media)) {
      apiData.unassigned_media.forEach((item: any, index: number) => {
        const { source, mediaType } = getSourceAndType(item);

        const unassignedItem = {
          id: item.media_id || `unassigned_${index}`,
          name: item.name || `IMG_${item.media_id || index}.jpg`,
          thumbnail: item.media_url || item.image_url || item.url,
          date: item.capture_date || item.created_at || new Date().toISOString(),
          uploadedAt: item.created_at || item.capture_date || new Date().toISOString(),
          size: formatSize(item.media_size || item.size || item.file_size),
          type: mediaType,
          dimensions: 'Loading...', // Will be calculated dynamically
          location: item.location,
          captureDate: item.capture_date || item.created_at,
          category: 'Unassigned',
          rotation_angle: item.rotation_angle || 0,
          comments_count: item.comments_count || item.comment_count || 0, // Add comments count
          isFromUnassignedArray: true, // Mark this item as from unassigned array
          is_new: item.is_new || 0,
          tags: (Array.isArray(item.tags) ? item.tags : []).map((t: any) => typeof t === 'string' ? t : t?.name).filter(Boolean),
          ...(source && { source }), // Add source field only if it exists
          metadata: {
            location: item.location,
            captureDate: item.capture_date,
            camera: 'Unknown',
            dimensions: 'Loading...'
          }
        };

        allMediaItems.push(unassignedItem);

        // Only calculate dimensions for unassigned items, keep API size
        if (item.media_url && onMetadataUpdate) {
          mediaTransformers.calculateImageDimensions(item.media_url).then(dimensions => {
            console.log(`📏 Calculated dimensions for unassigned ${unassignedItem.name}: ${dimensions}`);
            onMetadataUpdate(unassignedItem.id, { size: unassignedItem.size, dimensions });
          }).catch(error => {
            console.warn('Failed to calculate dimensions for unassigned', unassignedItem.name, error);
            onMetadataUpdate(unassignedItem.id, { size: unassignedItem.size, dimensions: 'Unknown' });
          });
        }
      });
    }

    // Process hierarchical names for sub-images
    // Build a map of parent images by ID
    const parentImageMap = new Map();
    allMediaItems.forEach(item => {
      if (!item.parent_id) {
        // This is a parent or standalone image
        parentImageMap.set(item.id.toString(), {
          name: item.name,
          memoryName: item.memory?.title || null,
          memoryCategory: item.memory?.category || item.category
        });
      }
    });

    // Update sub-image names with hierarchy
    allMediaItems.forEach(item => {
      if (item.parent_id) {
        // This is a sub-image
        const parentInfo = parentImageMap.get(item.parent_id.toString());
        if (parentInfo) {
          // Build hierarchical name: Parent Image Name / Sub Image Name
          // Trim parent name if too long (keep first 20 chars + "...")
          let parentName = parentInfo.name;
          if (parentName.length > 20) {
            parentName = parentName.substring(0, 20) + '...';
          }

          item.displayName = `${parentName} / ${item.name}`;
          console.log(`🌳 Created hierarchical name for sub-image ${item.id}: ${item.displayName}`);
        }
      }
    });

    return allMediaItems;
  },

  // Transform API data for MediaNav sidebar (categories with memories and media)
  transformForMediaNav: (apiData: any) => {
    console.log('🚀🚀🚀 SIDEBAR MEDIA TEST NAV - Complete API Response:');
    console.log('🚀🚀🚀 Full API Data:', JSON.stringify(apiData, null, 2));
    console.log('🚀🚀🚀 API Data Keys:', Object.keys(apiData || {}));
    console.log('🚀🚀🚀 categories_media exists:', !!apiData?.categories_media);
    console.log('🚀🚀🚀 categories_media structure:', apiData?.categories_media);
    console.log('🚀🚀🚀 unassigned_media exists:', !!apiData?.unassigned_media);
    console.log('🚀🚀🚀 unassigned_media count:', apiData?.unassigned_media?.length || 0);
    
    console.log('🔧 transformForMediaNav input:', apiData);
    const categories: any[] = [];
    
    if (apiData.categories_media && typeof apiData.categories_media === 'object') {
      const categoryNames = Object.keys(apiData.categories_media);
      console.log('🔧 Processing categories_media object with keys:', categoryNames);
      
      categoryNames.forEach((categoryName: string) => {
        // Normalize category name for consistent display
        const normalizedCategoryName = categoryName === 'sharedwith' ? 'Shared With' : categoryName;
        const categoryItems = apiData.categories_media[categoryName];
        console.log('🔧 Processing category:', categoryName, 'with', categoryItems?.length, 'items');
        console.log('🔧 Category items type:', typeof categoryItems);
        console.log('🔧 Category items is array:', Array.isArray(categoryItems));
        console.log('🔧 Category items content:', categoryItems);
        
        // Handle both array categories and empty categories
        if (Array.isArray(categoryItems) || (categoryItems === null || categoryItems === undefined)) {
          const memories: any[] = [];
          const memoriesMap = new Map();
          
          // If categoryItems is null/undefined, treat as empty array
          const items = Array.isArray(categoryItems) ? categoryItems : [];
          const currentMemoryData = new Map(); // To store memory metadata
          
          console.log('🔧 Processing', items.length, 'items for category:', categoryName);
          
          // First pass: separate memory metadata from media items
          items.forEach((item: any, index: number) => {
            console.log('🔧 Item', index, ':', item);
            
            // Check if this is memory metadata (has memory_id, memory_title, etc.)
            if (item.memory_id && item.memory_title && !item.media_id) {
              console.log('🔧 Found memory metadata:', item.memory_id, item.memory_title);
              currentMemoryData.set(item.memory_id, {
                id: item.memory_id,
                title: item.memory_title,
                thumbnail: item.memory_image || '', // Use memory_image for thumbnail
                size: item.memory_size || 'Unknown'
              });
            }
            // Check if this is a media item (has media_id, media_url)
            else if (item.media_id && item.media_url) {
              console.log('🔧 Found media item:', item.media_id, item.name);
              // For now, we'll process media items in the second pass
              // when we know which memory they belong to
            }
          });
          
          // Second pass: process media items and group them by memory
          let currentMemoryId = null;
          
          items.forEach((item: any, index: number) => {
            // Update current memory when we encounter memory metadata
            if (item.memory_id && item.memory_title && !item.media_id) {
              currentMemoryId = item.memory_id;
              
              // Initialize memory if not exists
              if (!memoriesMap.has(currentMemoryId)) {
                const memData = currentMemoryData.get(currentMemoryId);
                memoriesMap.set(currentMemoryId, {
                  id: currentMemoryId,
                  title: memData.title,
                  category: normalizedCategoryName,
                  thumbnail: memData.thumbnail, // Use memory_image from API
                  imageCount: 0,
                  date: new Date().toISOString().split('T')[0],
                  type: 'personal' as const,
                  author: 'Unknown',
                  isExpanded: true,
                  images: []
                });
              }
            }
            // Process media items
            else if (item.media_id && item.media_url && currentMemoryId) {
              console.log('🔧 Processing media item:', item.media_id, 'location:', item.location);
              const memory = memoriesMap.get(currentMemoryId);
              if (memory) {
                // Format size if available from API, otherwise use default
                const formatSize = (mediaSize: any) => {
                  if (!mediaSize) return 'Unknown';
                  if (typeof mediaSize === 'string') {
                    // If string already has units (MB, KB, etc), return as is
                    if (mediaSize.includes('MB') || mediaSize.includes('KB') || mediaSize.includes('GB') || mediaSize.includes('B')) {
                      return mediaSize;
                    }
                    // If string is just a number, assume it's MB and add unit
                    const num = parseFloat(mediaSize);
                    if (!isNaN(num)) {
                      return `${num.toFixed(2)} MB`;
                    }
                    return mediaSize;
                  }
                  if (typeof mediaSize === 'number') {
                    return mediaTransformers.formatFileSize(mediaSize);
                  }
                  return 'Unknown';
                };

                // Determine source platform from type field
                let source: string | undefined = undefined;
                let mediaType: 'image' | 'video' = 'image';

                if (item.type) {
                  const itemType = item.type.toLowerCase();
                  // Check if type indicates a social media platform
                  if (itemType === 'fb' || itemType === 'facebook') {
                    source = 'facebook';
                    mediaType = 'image'; // Facebook posts are typically images
                  } else if (itemType === 'instagram' || itemType === 'ig') {
                    source = 'instagram';
                    mediaType = 'image'; // Instagram posts are typically images
                  } else if (itemType === 'google_photos' || itemType === 'google') {
                    source = 'google_photos';
                    mediaType = 'image';
                  } else if (itemType === 'video') {
                    mediaType = 'video';
                  } else if (itemType === 'image') {
                    mediaType = 'image';
                  }
                }

                const imageItem: any = {
                  id: item.media_id,
                  name: item.name || `IMG_${item.media_id}.jpg`,
                  thumbnail: item.media_url,
                  date: item.capture_date || new Date().toISOString(),
                  size: formatSize(item.media_size || item.size), // Use API provided size first
                  type: mediaType,
                  dimensions: 'Loading...', // Will be calculated dynamically
                  location: item.location, // Get location from $media->location
                  captureDate: item.capture_date,
                  rotation_angle: item.rotation_angle || 0,
                  comments_count: item.comments_count || item.comment_count || 0, // Add comments count
                  parent_id: item.parent_id || null, // Track parent_id for hierarchical structure
                  subImages: [], // Array to hold sub-images
                  ...(source && { source }) // Add source field only if it exists
                };

                memory.images.push(imageItem);

                // Only calculate dimensions, keep the API size
                if (item.media_url) {
                  mediaTransformers.calculateImageDimensions(item.media_url).then(dimensions => {
                    imageItem.dimensions = dimensions;
                    console.log(`📏 Updated dimensions for ${imageItem.name}: ${dimensions}`);
                  }).catch(error => {
                    console.warn('Failed to calculate dimensions for', imageItem.name, error);
                    imageItem.dimensions = 'Unknown';
                  });
                }
                memory.imageCount = memory.images.length;
                
                // Update memory date to latest media date
                const mediaDate = new Date(item.capture_date || 0);
                const currentDate = new Date(memory.date);
                if (mediaDate > currentDate) {
                  memory.date = item.capture_date?.split('T')[0] || memory.date;
                }
              }
            }
          });

          // Convert map to array
          memoriesMap.forEach(memory => memories.push(memory));

          // Organize images hierarchically based on parent_id
          memories.forEach(memory => {
            if (memory.images && memory.images.length > 0) {
              const parentImages: any[] = [];
              const subImageMap = new Map(); // Map of parent_id -> array of sub-images

              // First pass: separate parent images from sub-images
              memory.images.forEach((img: any) => {
                if (img.parent_id) {
                  // This is a sub-image
                  const parentId = img.parent_id.toString();
                  if (!subImageMap.has(parentId)) {
                    subImageMap.set(parentId, []);
                  }
                  subImageMap.get(parentId).push(img);
                } else {
                  // This is a parent image (or standalone image)
                  parentImages.push(img);
                }
              });

              // Second pass: attach sub-images to their parent images and add metadata
              parentImages.forEach((parentImg: any) => {
                const parentId = parentImg.id.toString();
                if (subImageMap.has(parentId)) {
                  const subImagesArray = subImageMap.get(parentId) || [];
                  // Add parent name and memory name to each sub-image
                  subImagesArray.forEach((subImg: any) => {
                    subImg.parentImageName = parentImg.name;
                    subImg.memoryName = memory.title;
                    subImg.memoryCategory = memory.category;
                  });
                  parentImg.subImages = subImagesArray;
                }
              });

              // Replace memory.images with only parent images (sub-images are now nested)
              memory.images = parentImages;
              console.log(`🌳 Organized memory "${memory.title}" hierarchically - ${parentImages.length} parent images with sub-images`);
            }
          });

          // Create category structure (even if it has no memories)
          const category = {
            name: normalizedCategoryName,
            count: memories.length,
            isExpanded: true, // Default expanded
            memories: memories
          };
          
          console.log('🔧 Created category:', category.name, 'with', category.count, 'memories');
          console.log('🔧 Category will be added to final array');
          categories.push(category);
        } else {
          // Handle non-array categories (might be objects or other types)
          console.log('🔧 Category', categoryName, 'is not an array, creating empty category');
          const emptyCategory = {
            name: normalizedCategoryName,
            count: 0,
            isExpanded: true,
            memories: []
          };
          console.log('🔧 Created empty category:', emptyCategory.name);
          categories.push(emptyCategory);
        }
      });
    } else {
      console.log('🔧 categories_media is not an object or not found');
    }
    
    // Add Unassigned category if there's unassigned media
    if (apiData.unassigned_media && Array.isArray(apiData.unassigned_media) && apiData.unassigned_media.length > 0) {
      console.log('🔧 Adding Unassigned category with', apiData.unassigned_media.length, 'items');
      categories.unshift({
        name: 'Unassigned',
        count: apiData.unassigned_media.length,
        isExpanded: true,
        isUnassigned: true,
        memories: [], // Unassigned items don't have memories
        images: apiData.unassigned_media.map((item: any, index: number) => {
          // Format size if available from API, otherwise use default
          const formatSize = (mediaSize: any) => {
            if (!mediaSize) return 'Unknown';
            if (typeof mediaSize === 'string') {
              // If string already has units (MB, KB, etc), return as is
              if (mediaSize.includes('MB') || mediaSize.includes('KB') || mediaSize.includes('GB') || mediaSize.includes('B')) {
                return mediaSize;
              }
              // If string is just a number, assume it's MB and add unit
              const num = parseFloat(mediaSize);
              if (!isNaN(num)) {
                return `${num.toFixed(2)} MB`;
              }
              return mediaSize;
            }
            if (typeof mediaSize === 'number') {
              return mediaTransformers.formatFileSize(mediaSize);
            }
            return 'Unknown';
          };

          console.log('🔧 Processing transformForMediaNav unassigned item:', index, item);
          console.log('🔧 Available fields:', Object.keys(item));
          
          const imageItem = {
            id: item.media_id || `unassigned_${index}`,
            name: item.name || `IMG_${item.media_id || index}.jpg`,
            thumbnail: item.media_url || item.image_url || item.url, // Try multiple field names
            date: item.capture_date || item.created_at || new Date().toISOString(),
            size: formatSize(item.media_size || item.size || item.file_size), // Try multiple size fields
            type: 'image' as const,
            dimensions: 'Loading...', // Will be calculated dynamically
            location: item.location,
            captureDate: item.capture_date || item.created_at,
            rotation_angle: item.rotation_angle || 0
          };

          // Only calculate dimensions, keep the API size
          const imageUrl = item.media_url || item.image_url || item.url;
          if (imageUrl) {
            mediaTransformers.calculateImageDimensions(imageUrl).then(dimensions => {
              imageItem.dimensions = dimensions;
              console.log(`📏 Updated unassigned dimensions for ${imageItem.name}: ${dimensions}`);
            }).catch(error => {
              console.warn('Failed to calculate dimensions for unassigned', imageItem.name, error);
              imageItem.dimensions = 'Unknown';
            });
          }

          return imageItem;
        })
      });
    }
    
    console.log('🔧 Final transformed categories:', categories.length, 'categories');
    console.log('🔧 Categories:', categories.map(c => `${c.name} (${c.count})`));
    return categories;
  },

  // Calculate dimensions from image URL (if needed)
  calculateImageDimensions: async (imageUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve(`${img.naturalWidth}×${img.naturalHeight}`);
      };
      img.onerror = () => {
        resolve('Unknown');
      };
      img.src = imageUrl;
    });
  },

  // Format file size with appropriate units
  formatFileSize: (sizeInBytes: number): string => {
    if (sizeInBytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let size = sizeInBytes;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  },

  // Calculate file size from image URL (approximate)
  calculateImageSize: async (imageUrl: string): Promise<string> => {
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const sizeInBytes = parseInt(contentLength);
        return mediaTransformers.formatFileSize(sizeInBytes);
      }
    } catch (error) {
      console.warn('Could not calculate image size:', error);
    }
    return 'Unknown';
  },

  // Calculate both size and dimensions for an image
  calculateImageMetadata: async (imageUrl: string): Promise<{size: string, dimensions: string}> => {
    try {
      // Calculate size
      const sizePromise = mediaTransformers.calculateImageSize(imageUrl);
      
      // Calculate dimensions
      const dimensionsPromise = mediaTransformers.calculateImageDimensions(imageUrl);
      
      // Wait for both to complete
      const [size, dimensions] = await Promise.all([sizePromise, dimensionsPromise]);
      
      return { size, dimensions };
    } catch (error) {
      console.warn('Could not calculate image metadata:', error);
      return { size: 'Unknown', dimensions: 'Unknown' };
    }
  },

  // Enhanced image processing with metadata calculation
  processImageWithMetadata: async (item: any, categoryName: string, index: number) => {
    const baseItem = {
      id: item.media_id || `${categoryName}_${index}`,
      name: item.name || `IMG_${item.media_id || index}.jpg`,
      thumbnail: item.media_url,
      date: item.capture_date || new Date().toISOString(),
      type: 'image' as const,
      location: item.location,
      captureDate: item.capture_date,
      size: 'Calculating...', // Temporary while calculating
      dimensions: 'Calculating...', // Temporary while calculating
      rotation_angle: item.rotation_angle || 0
    };

    // Calculate actual size and dimensions in background
    if (item.media_url) {
      setTimeout(async () => {
        try {
          const metadata = await mediaTransformers.calculateImageMetadata(item.media_url);
          // Update the item with real metadata
          console.log(`📏 Calculated metadata for ${item.name}: ${metadata.size}, ${metadata.dimensions}`);
        } catch (error) {
          console.warn('Failed to calculate metadata for', item.name, error);
        }
      }, 0);
    }

    return baseItem;
  },

};

export default mediaAPI;