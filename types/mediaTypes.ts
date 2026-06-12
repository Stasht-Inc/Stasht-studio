// Media-related type definitions

export interface MemoryInfo {
  id: string;
  title: string;
  category?: string;
}

export interface CategoryInfo {
  id?: string;
  name: string;
  count: number;
  isUserCreated?: boolean;
  admin_id?: string | null;
  color?: string;
}

export interface ExistingMemory {
  id: string;
  title: string;
  category: string;
  mediaCount: number;
  createdDate: string;
  description?: string;
  thumbnail: string;
  tags?: string[];
}

export interface LabelInfo {
  name: string;
  color: string;
}

export interface MediaItem {
  id: string;
  name: string;
  thumbnail: string;
  date: string;
  size: string;
  type: 'image' | 'video';
  dimensions?: string;
  category?: string;
  selected?: boolean;
  memory?: MemoryInfo;
  label?: LabelInfo;
  location?: string | {
    city?: string;
    country?: string;
    coordinates?: { lat: number; lng: number };
  };
  rotation_angle?: number;
  metadata?: {
    camera?: string;
    settings?: string;
    dimensions?: string;
    location?: string;
    captureDate?: string;
  };
  // User metadata fields from API
  description?: string;
  user_name?: string;
  user_profile?: string;
  // Source platform (e.g., 'facebook', 'instagram')
  source?: string;
  // Comments count
  comments_count?: number;
  // Synced service fields
  service?: string; // Service name/type (dropbox, icloud, etc)
  external_id?: string; // External ID from the service
  service_id?: number; // ID of the connected service
}

// MediaNav data types
export interface MediaImage {
  id: string;
  name: string;
  thumbnail: string;
  date: string;
  size: string;
  type: 'image' | 'video';
  dimensions?: string;
  location?: string;
  captureDate?: string;
  // User metadata fields from API
  description?: string;
  user_name?: string;
  user_profile?: string;
  // Source platform (e.g., 'facebook', 'instagram')
  source?: string;
  // Comments count
  comments_count?: number;
}

export interface MediaMemory {
  id: string;
  title: string;
  category: string;
  thumbnail: string;
  imageCount: number;
  date: string;
  type: 'personal' | 'shared';
  author?: string;
  images: MediaImage[];
  isExpanded?: boolean;
}