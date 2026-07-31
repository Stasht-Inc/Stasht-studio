import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import JSZip from "jszip";
import { Upload, Grid, List, Search, SortAsc, SortDesc, Play, Image as ImageIcon, Download, Share, Trash2, FolderPlus, Move, MapPin, Calendar, HardDrive, FileText, FolderOpen, X, ArrowRight, Check, Folder, Users, Globe, Lock, ChevronDown, UserCheck, RefreshCw, Menu, MoreVertical, Unlink, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { ImageViewer } from "../components/ImageViewer";
import { MediaGridItem } from "../components/media/MediaGridItem";
import { MainUploadArea } from "../components/media/MainUploadArea";
import BatchActions from "../components/BatchActions";
import UploadProgress, { UploadProgressItem } from "../components/UploadProgress";
import { SyncMediaDialog } from "../components/SyncMediaDialog";
import MediaNav from "../components/MediaNav";
import { DisconnectServiceModal } from "../components/DisconnectServiceModal";
import { CategoryInfo, MediaItem, MediaMemory, MediaImage, ExistingMemory } from "../types/mediaTypes";
import { getCategoryColor, getCategoryIcon } from "../constants/mediaConstants";
import {
  convertMemoriesToMediaItems,
  convertUnassignedToMediaItems,
  filterMediaItems,
  sortMediaItems,
  getMemoriesForCategory,
  calculateTotalSize
} from "../utils/mediaUtils";
import { mediaTransformers, mediaAPI } from "../services/mediaAPI";
import { useMemoryLimit } from '../hooks/useMemoryLimit';
import { triggerMemoryCountsRefresh } from '../hooks/useMemoryCounts';
import { dashboardAPI, servicesAPI, isLastSyncOlderThan } from "../utils/authUtils";
import { formatFileSize, generateFileId } from "../utils/fileProcessing";
import { getFacebookAuthUrl } from "../utils/facebookAuthAPI";
import { openGooglePhotosPicker } from "../utils/googlePhotosPickerUtils";
import { mapLimit, uploadLimit } from "../utils/requestLimit";

// Helper function to format relative time like "Just now", "5 minutes ago", etc.
const formatRelativeTime = (dateString?: string): string => {
  if (!dateString) return 'Just now';

  // If it's already a formatted relative time string (contains "ago", "just now", "yesterday"), return it as-is
  const lowerCaseDate = dateString.toLowerCase();
  if (lowerCaseDate.includes('ago') || lowerCaseDate.includes('just now') || lowerCaseDate.includes('yesterday')) {
    // Capitalize first letter if needed
    return dateString.charAt(0).toUpperCase() + dateString.slice(1);
  }

  try {
    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Just now';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Handle negative differences (future dates)
    if (diffMs < 0) return 'Just now';

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffMs / 604800000);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffWeeks === 1) return '1 week ago';
    if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
    if (diffMonths === 1) return '1 month ago';
    if (diffMonths < 12) return `${diffMonths} months ago`;

    const diffYears = Math.floor(diffMonths / 12);
    if (diffYears === 1) return '1 year ago';
    return `${diffYears} years ago`;
  } catch (error) {
    return 'Just now';
  }
};

export default function MediaPage({
  categories,
  expandedCategories = [],
  mediaMemories = [],
  unassignedImages = [],
  showUnassignedImages = false,
  selectedCategory = null,
  selectedMediaItems = [],
  onMediaItemSelect,
  onClearSelection,
  isLoadingMediaData = false,
  apiMediaData = null,
  onFetchMediaData,
  isUploadingMedia = false,
  uploadProgress = [],
  onHighlightedImageChange,
  imageViewerRef,
  showMobileSidebar = false,
  onCloseMobileSidebar,
  onToggleMobileSidebar,
  onFilterChange,
  onCategorySelect,
  onMediaMemoriesChange,
  onUnassignedImagesChange,
  onUnassignedToggle,
  apiMediaNavData,
  onUploadStateChange,
  onUploadProgressChange,
  onMemorySelect,
  apiMemoriesData,
  onCategoriesUpdate,
  onCategoryRenamed,
  onServiceTabChange,
  onServiceSyncedMediaChange,
  onConnectedServicesChange,
  onDropboxProgressChange,
  showDropboxProgress,
  activeServiceTab,
  onRefreshConnectedServicesReady,
  pendingUploadFiles = [],
  onUploadFilesProcessed,
  isPropertyOwner = true,
  onNewMediaPending,
  dismissedNewMediaIds = new Set<string>()
}: {
  categories: CategoryInfo[];
  expandedCategories?: string[];
  mediaMemories?: MediaMemory[];
  unassignedImages?: MediaImage[];
  showUnassignedImages?: boolean;
  selectedCategory?: string | null;
  selectedMediaItems?: string[];
  onMediaItemSelect?: (itemId: string, selected: boolean) => void;
  onClearSelection?: () => void;
  isLoadingMediaData?: boolean;
  apiMediaData?: any;
  onFetchMediaData?: (params?: {
    search?: string;
    sort_by?: 'name' | 'location' | 'date' | 'memory' | 'size' | 'upload_latest' | 'upload_oldest';
    order?: 'asc' | 'desc';
  }) => Promise<void>;
  isUploadingMedia?: boolean;
  uploadProgress?: any[];
  onHighlightedImageChange?: (imageId: string | null) => void;
  imageViewerRef?: React.MutableRefObject<((src: string, alt: string, title?: string, subtitle?: string, imageId?: string) => void) | null>;
  showMobileSidebar?: boolean;
  onCloseMobileSidebar?: () => void;
  onToggleMobileSidebar?: () => void;
  onFilterChange?: (expandedCategories: string[]) => void;
  onCategorySelect?: (categoryName: string | null) => void;
  onMediaMemoriesChange?: (memories: MediaMemory[]) => void;
  onUnassignedImagesChange?: (images: MediaImage[]) => void;
  onUnassignedToggle?: (show: boolean) => void;
  apiMediaNavData?: any[];
  onUploadStateChange?: (isUploading: boolean) => void;
  onUploadProgressChange?: (progress: any[]) => void;
  onMemorySelect?: (memoryId: string, shouldOpenAddModal?: boolean) => void;
  apiMemoriesData?: any;
  onCategoriesUpdate?: () => void;
  onCategoryRenamed?: (oldName: string, newName: string) => void;
  onServiceTabChange?: (tab: string) => void;
  onServiceSyncedMediaChange?: (media: {[key: string]: any[]}) => void;
  onConnectedServicesChange?: (services: any[]) => void;
  onDropboxProgressChange?: (progress: number, show: boolean, serviceId: string, itemCount?: number) => void;
  showDropboxProgress?: boolean;
  activeServiceTab?: string;
  onRefreshConnectedServicesReady?: (refreshFn: () => Promise<void>) => void;
  pendingUploadFiles?: File[];
  onUploadFilesProcessed?: () => void;
  isPropertyOwner?: boolean;
  onNewMediaPending?: (ids: (string | number)[]) => void;
  dismissedNewMediaIds?: Set<string>;
}) {
  console.log('🎯 MediaPage rendered, pendingUploadFiles:', pendingUploadFiles?.length || 0);

  const { isLimitExceeded } = useMemoryLimit();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [hasInitialized, setHasInitialized] = useState(false);
  const pendingAutoSelectRef = useRef<string[]>([]);

  // Add to Moment modal state
  const [showAddToMomentModal, setShowAddToMomentModal] = useState(false);
  const [addToMomentSelectedParentId, setAddToMomentSelectedParentId] = useState<string | null>(null);
  const [addToMomentSubmitting, setAddToMomentSubmitting] = useState(false);
  const [expandedMemories, setExpandedMemories] = useState<Set<string>>(new Set());
  const [memoryImagesMap, setMemoryImagesMap] = useState<Record<string, any[]>>({});
  const [loadingMemoryIds, setLoadingMemoryIds] = useState<Set<string>>(new Set());
  const [expandedImageIds, setExpandedImageIds] = useState<Set<string>>(new Set());

  
  // Comprehensive reload function - reloads BOTH media page AND sidebar
  const reloadMediaPageAndSidebar = useCallback(async () => {
    console.log('🔄 RELOADING ENTIRE MEDIA PAGE & SIDEBAR');
    try {
      // Reload media data
      if (onFetchMediaData) {
        await onFetchMediaData();
        console.log('✅ Media data reloaded');
      }

      // Reload sidebar/categories
      if (onCategoriesUpdate) {
        await onCategoriesUpdate();
        console.log('✅ Sidebar/categories reloaded');
      }

      // Trigger memory counts refresh for the sidebar
      triggerMemoryCountsRefresh();
      console.log('✅ Memory counts refreshed');
    } catch (error) {
      console.error('❌ Error reloading media page and sidebar:', error);
    }
  }, [onFetchMediaData, onCategoriesUpdate]);

  // Update local selection when external selection changes
  useEffect(() => {
    setSelectedItems(new Set(selectedMediaItems));
  }, [selectedMediaItems]);

  // Initialize flag after first render
  useEffect(() => {
    const timer = setTimeout(() => setHasInitialized(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Process pending upload files from nav bar
  useEffect(() => {
    if (pendingUploadFiles && pendingUploadFiles.length > 0) {
      console.log('🎯 MediaPage: Processing pending upload files:', pendingUploadFiles.length);

      // Use a short delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        // Call the existing handleFilesUpload function with the files
        handleFilesUpload(pendingUploadFiles);

        // Clear the pending files
        if (onUploadFilesProcessed) {
          onUploadFilesProcessed();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [pendingUploadFiles, onUploadFilesProcessed]);

  // Debounced API call when search or sort parameters change (only after initialization)
  useEffect(() => {
    console.log('🔍 API Effect triggered:', { 
      hasInitialized, 
      searchQuery: searchQuery.trim(), 
      sortBy, 
      sortOrder,
      onFetchMediaData: !!onFetchMediaData 
    });

    if (!onFetchMediaData || !hasInitialized) {
      console.log('🚫 Skipping API call - not ready');
      return;
    }

    // Only call API if user has actually changed something from defaults
    const hasUserChanges = searchQuery.trim() !== '' || sortBy !== 'date' || sortOrder !== 'desc';
    
    if (!hasUserChanges) {
      console.log('🚫 Skipping API call - no user changes from defaults');
      return;
    }

    console.log('⏳ Setting up debounced API call...');
    const delayedApiCall = setTimeout(() => {
      const params: any = {};
      
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      
      // Always send sort_by and order to API (even if default values)
      params.sort_by = sortBy as 'name' | 'location' | 'date' | 'memory' | 'size' | 'upload_latest' | 'upload_oldest';
      params.order = sortOrder as 'asc' | 'desc';

      console.log('📡 Executing API call with params:', params);
      onFetchMediaData(params);
    }, 500); // 500ms debounce

    return () => {
      console.log('🧹 Cleaning up debounced API call');
      clearTimeout(delayedApiCall);
    };
  }, [searchQuery, sortBy, sortOrder, hasInitialized, onFetchMediaData]);
  
  // Image viewer state
  const [imageViewer, setImageViewer] = useState<{
    isOpen: boolean;
    src: string;
    alt: string;
    title?: string;
    subtitle?: string;
    images: Array<{
      src: string;
      alt: string;
      title?: string;
      subtitle?: string;
      id?: string;
    }>;
    currentIndex: number;
    imageId?: string;
    location?: string;
    dateTaken?: string;
    camera?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    description?: string;
    user_name?: string;
    user_profile?: string;
    rotation_angle?: number;
    tags?: string[];
  }>({
    isOpen: false,
    src: '',
    alt: '',
    title: '',
    subtitle: '',
    images: [],
    currentIndex: 0,
    imageId: '',
    location: undefined,
    dateTaken: undefined,
    camera: undefined,
    coordinates: undefined,
    rotation_angle: 0
  });

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [uploadedItems, setUploadedItems] = useState<MediaItem[]>([]);
  const [localMediaMemories, setMediaMemories] = useState<MediaMemory[]>(mediaMemories);
  const [apiMediaItems, setApiMediaItems] = useState<MediaItem[]>([]);
  const [isUploadingInPage, setIsUploadingInPage] = useState(false);
  const [localUploadProgress, setLocalUploadProgress] = useState<UploadProgressItem[]>([]);

  // Sync uploadProgress prop from parent (MediaNav uploads) to local state
  useEffect(() => {
    if (uploadProgress && uploadProgress.length > 0) {
      setLocalUploadProgress(uploadProgress as UploadProgressItem[]);
    }
  }, [uploadProgress]);

  // Auto-close upload modal after all uploads complete
  useEffect(() => {
    if (localUploadProgress.length > 0 && localUploadProgress.every(item => item.status === 'complete')) {
      const timer = setTimeout(() => {
        setLocalUploadProgress([]);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [localUploadProgress]);

  const [apiExistingMemories, setApiExistingMemories] = useState<ExistingMemory[]>([]);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const syncButtonRef = useRef<HTMLButtonElement>(null);
  const [isLoadingExistingMemories, setIsLoadingExistingMemories] = useState(false);

  // Service tabs state - NOTE: activeServiceTab is now passed as prop from App.tsx
  const [connectedServices, setConnectedServices] = useState<any[]>([]);
  const [serviceSyncedMedia, setServiceSyncedMedia] = useState<{[key: string]: any[]}>({});
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isLoadingSyncedMedia, setIsLoadingSyncedMedia] = useState(false);
  const [isResyncingDropbox, setIsResyncingDropbox] = useState(false);
  const [hoveredServiceTab, setHoveredServiceTab] = useState<string | null>(null);
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [serviceToDisconnect, setServiceToDisconnect] = useState<{id: string, name: string, itemCount: number} | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [allMediaCount, setAllMediaCount] = useState(0);

  // Track hidden services - Load from localStorage on mount
  const [hiddenServices, setHiddenServices] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('hiddenServices');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (error) {
      console.error('Error loading hidden services:', error);
      return new Set();
    }
  });

  // Pagination state for infinite scroll
  const [servicePagination, setServicePagination] = useState<{[key: string]: {currentPage: number, lastPage: number, hasMore: boolean}}>({});
  const [isLoadingMoreMedia, setIsLoadingMoreMedia] = useState(false);

  // Dropbox-specific states for new pagination flow
  const [isDropboxSyncing, setIsDropboxSyncing] = useState(false); // Overlay loader state
  const [dropboxSyncPercentage, setDropboxSyncPercentage] = useState(0); // Progress percentage
  const [syncingService, setSyncingService] = useState<string | null>(null); // Track which service is currently syncing (for modal display)
  const [isDropboxMinimized, setIsDropboxMinimized] = useState(false); // Animation state for left corner
  const [dropboxCurrentPage, setDropboxCurrentPage] = useState(1);
  const [dropboxTotalPages, setDropboxTotalPages] = useState(1);
  const [dropboxSyncProgress, setDropboxSyncProgress] = useState<number>(0); // Progress percentage (0-100)
  // NOTE: showDropboxProgress is now passed as prop from App.tsx - no local state needed
  const [dropboxSyncStartTime, setDropboxSyncStartTime] = useState<number>(0); // Track sync start time
  const [dropboxServiceIdAfterSync, setDropboxServiceIdAfterSync] = useState<string>(''); // Store service ID for redirect
  const [jumpToPageInput, setJumpToPageInput] = useState<string>(''); // Input for jump to page

  // Toggle service visibility
  const toggleServiceVisibility = (serviceId: string) => {
    setHiddenServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }

      // Save to localStorage
      try {
        localStorage.setItem('hiddenServices', JSON.stringify(Array.from(newSet)));
        console.log('💾 Saved hidden services to localStorage:', Array.from(newSet));
      } catch (error) {
        console.error('Error saving hidden services:', error);
      }

      return newSet;
    });
  };

  // Handle View Result click - switch to Dropbox tab with synced data
  const handleViewDropboxResult = useCallback(() => {
    console.log('🎯 View Result clicked - switching to Dropbox tab');
    console.log('🎯 Current serviceSyncedMedia keys:', Object.keys(serviceSyncedMedia));
    console.log('🎯 Dropbox data available?', serviceSyncedMedia[dropboxServiceIdAfterSync] ? 'YES' : 'NO');

    // Switch to the Dropbox service tab FIRST
    if (dropboxServiceIdAfterSync) {
      console.log('✅ Switching to Dropbox tab:', dropboxServiceIdAfterSync);

      // Ensure state has propagated by using requestAnimationFrame
      requestAnimationFrame(() => {
        if (onServiceTabChange) {
          onServiceTabChange(dropboxServiceIdAfterSync);
        }

        // Wait a bit longer to ensure both sidebar and main area sync
        setTimeout(() => {
          // Notify App to hide progress bar
          if (onDropboxProgressChange) {
            onDropboxProgressChange(0, false, dropboxServiceIdAfterSync);
          }
          setDropboxSyncProgress(0);
          console.log('✅ Progress bar hidden, Dropbox content should be visible in both sidebar and main area');
        }, 200);
      });
    }
  }, [dropboxServiceIdAfterSync, serviceSyncedMedia, onServiceTabChange, onDropboxProgressChange]);

  // Update local memories when prop changes
  useEffect(() => {
    console.log('🔍 MediaPage useEffect - mediaMemories prop changed:');
    console.log('New mediaMemories prop:', mediaMemories);
    console.log('mediaMemories length:', mediaMemories?.length);
    setMediaMemories(mediaMemories);
  }, [mediaMemories]);

  // Handle Dropbox sync progress animation and minimize after 10 seconds
  useEffect(() => {
    if (isDropboxSyncing) {
      // Reset states when sync starts
      setDropboxSyncPercentage(0);
      setIsDropboxMinimized(false);

      // Simulate progress - slower pace: increment by 2% every 5 seconds
      const progressInterval = setInterval(() => {
        setDropboxSyncPercentage(prev => {
          if (prev >= 95) return 95; // Cap at 95% until actual sync completes
          return prev + 2; // Increment by 2% every 5 seconds (10% every 25 seconds)
        });
      }, 5000);

      // After 10 seconds, minimize to bottom-left corner
      const minimizeTimer = setTimeout(() => {
        setIsDropboxMinimized(true);
      }, 10000);

      // Cleanup on unmount or when sync completes
      return () => {
        clearInterval(progressInterval);
        clearTimeout(minimizeTimer);
      };
    } else {
      // Reset states when sync ends
      setDropboxSyncPercentage(0);
      setIsDropboxMinimized(false);
    }
  }, [isDropboxSyncing]);

  // Process API data into individual media items
  useEffect(() => {
    console.log('🔥 MediaPage component loaded, checking for errors...');
    if (apiMediaData) {
      console.log('🔄 Processing API data into individual media items:', apiMediaData);
      console.log('🔄 Checking for filtered_categories:', apiMediaData.filtered_categories);
      
      // Debug: Check for user fields in raw API data
      if (apiMediaData.categories_media) {
        Object.keys(apiMediaData.categories_media).forEach(categoryName => {
          const categoryData = apiMediaData.categories_media[categoryName];
          if (Array.isArray(categoryData)) {
            const itemWithUserData = categoryData.find(item => item.user_name || item.description);
            if (itemWithUserData) {
              console.log('🔄 Found item with user data in raw API:', itemWithUserData);
            }
          }
        });
      }
      
      // Check for empty categories in filtered_categories (for sidebar display only)
      if (apiMediaData.filtered_categories && Array.isArray(apiMediaData.filtered_categories)) {
        console.log('🔄 Found filtered_categories in API:', apiMediaData.filtered_categories);
        // This data will be handled by MediaNav sidebar, not main page
      }
      
      // Callback to update metadata when async calculation completes
      const handleMetadataUpdate = (itemId: string, metadata: {size: string, dimensions: string}) => {
        setApiMediaItems(prevItems => 
          prevItems.map(item => 
            item.id === itemId 
              ? { 
                  ...item, 
                  size: metadata.size, 
                  dimensions: metadata.dimensions,
                  metadata: { ...item.metadata, dimensions: metadata.dimensions }
                }
              : item
          )
        );
      };

      const transformedItems = mediaTransformers.transformToMediaItems(apiMediaData, handleMetadataUpdate, selectedCategory);
      console.log('🔄 Transformed to', transformedItems.length, 'individual media items:', transformedItems);
      console.log('🔄 Sample transformed item with user fields:', transformedItems.find(item => item.user_name || item.description));
      setApiMediaItems(transformedItems);

      // Auto-select items flagged as new (is_new === 1) — skip items the user already dismissed
      const newItems = transformedItems.filter((item: any) =>
        item.is_new === 1 && !dismissedNewMediaIds.has(String(item.id))
      );
      if (newItems.length > 0) {
        setTimeout(() => setSelectedItems(new Set(newItems.map((item: any) => item.id))), 0);
        onNewMediaPending?.(newItems.map((item: any) => item.id));
      }

      // Apply pending auto-selection from upload (must be inside here so items are available)
      if (pendingAutoSelectRef.current.length > 0) {
        const idsToSelect = pendingAutoSelectRef.current;
        pendingAutoSelectRef.current = [];
        setTimeout(() => setSelectedItems(new Set(idsToSelect)), 0);
      }
    } else {
      setApiMediaItems([]);
    }
  }, [apiMediaData, selectedCategory]);


  // Function to fetch existing memories from API
  const fetchExistingMemories = useCallback(async () => {
    setIsLoadingExistingMemories(true);
    try {
      console.log('🔍 MediaPage: Fetching existing memories from API...');
      const response = await dashboardAPI.getExistingMemories();
      console.log('🔍 MediaPage: API response for existing memories:', response);
        
        if (response.success && response.data) {
          // Handle the nested response structure
          const responseData = response.data.data || response.data;
          
          if (responseData && Array.isArray(responseData.memories)) {
            console.log('🔍 MediaPage: Raw memories from API:', responseData.memories);
            
            const transformedMemories: ExistingMemory[] = responseData.memories.map((memory: any) => {
              // Debug each memory object
              console.log('🔍 MediaPage: Processing memory:', memory);
              console.log('🔍 MediaPage: memory.category:', memory.category);
              console.log('🔍 MediaPage: typeof memory.category:', typeof memory.category);
              
              // Ensure category is always a string, handle both object and string cases
              let categoryName = 'Uncategorized';
              if (memory.category_name) {
                categoryName = memory.category_name;
              } else if (memory.category) {
                // If category is an object, extract the name property
                if (typeof memory.category === 'object' && memory.category.name) {
                  categoryName = memory.category.name;
                } else if (typeof memory.category === 'string') {
                  categoryName = memory.category;
                }
              }
              
              // Handle thumbnail image - try multiple possible field names
              let thumbnailUrl = '';
              const possibleThumbnails = [
                // First check the photos.preview_images array (most likely for your API)
                memory.photos && memory.photos.preview_images && memory.photos.preview_images.length > 0 ? memory.photos.preview_images[0] : null,
                // Then check for last_update_img
                memory.last_update_img,
                // Fallback to other possible field names
                memory.thumbnail,
                memory.featured_image,
                memory.image,
                memory.cover_image,
                memory.first_image,
                memory.latest_image,
                memory.posts && memory.posts.length > 0 ? memory.posts[0].image : null,
                memory.posts && memory.posts.length > 0 ? memory.posts[0].url : null,
                memory.media && memory.media.length > 0 ? memory.media[0].url : null,
                memory.media && memory.media.length > 0 ? memory.media[0].path : null,
                memory.media && memory.media.length > 0 ? memory.media[0].src : null
              ];
              
              // Find the first valid thumbnail URL
              for (const url of possibleThumbnails) {
                if (url && typeof url === 'string' && url.trim()) {
                  thumbnailUrl = url.trim();
                  break;
                }
              }
              
              // If thumbnail is a relative path, make it absolute using the API base URL
              if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
                // Remove leading slash if present to avoid double slashes
                const cleanPath = thumbnailUrl.startsWith('/') ? thumbnailUrl.substring(1) : thumbnailUrl;
                
                // Get the base domain from the API URL (remove /api/react part)
                let baseUrl = '';
                if (import.meta.env.VITE_API_BASE_URL) {
                  // Production: use environment variable and extract base domain
                  baseUrl = import.meta.env.VITE_API_BASE_URL.replace('/api/react', '');
                } else if (import.meta.env.DEV) {
                  // Development: use localhost with proxy
                  baseUrl = window.location.origin;
                } else {
                  // Fallback: use current domain
                  baseUrl = window.location.origin;
                }
                
                thumbnailUrl = `${baseUrl}/${cleanPath}`;
              }
              
              // Handle image/photo count - try multiple possible field names
              let photoCount = 0;
              if (memory.photos && memory.photos.count !== undefined) {
                // First check photos.count (most likely for your API)
                photoCount = memory.photos.count;
              } else if (memory.posts_count !== undefined) {
                photoCount = memory.posts_count;
              } else if (memory.imageCount !== undefined) {
                photoCount = memory.imageCount;
              } else if (memory.images_count !== undefined) {
                photoCount = memory.images_count;
              } else if (memory.media_count !== undefined) {
                photoCount = memory.media_count;
              } else if (memory.photos_count !== undefined) {
                photoCount = memory.photos_count;
              } else if (memory.items_count !== undefined) {
                photoCount = memory.items_count;
              } else if (memory.posts && Array.isArray(memory.posts)) {
                photoCount = memory.posts.length;
              } else if (memory.media && Array.isArray(memory.media)) {
                photoCount = memory.media.length;
              } else if (memory.images && Array.isArray(memory.images)) {
                photoCount = memory.images.length;
              } else if (memory.photos && memory.photos.preview_images && Array.isArray(memory.photos.preview_images)) {
                // Fallback to preview_images array length
                photoCount = memory.photos.preview_images.length;
              }
              
              console.log(`🔍 MediaPage: Memory "${memory.title || memory.name}"`);
              console.log(`  - photos object:`, memory.photos);
              console.log(`  - photos.count:`, memory.photos?.count);
              console.log(`  - photos.preview_images:`, memory.photos?.preview_images);
              console.log(`  - last_update_img:`, memory.last_update_img);
              console.log(`  - final thumbnail: "${thumbnailUrl}"`);
              console.log(`  - final count: ${photoCount}`);
              
              return {
                id: memory.id?.toString() || '',
                title: memory.title || memory.name || 'Untitled',
                category: categoryName,
                thumbnail: thumbnailUrl,
                imageCount: photoCount,
                date: memory.created_at || memory.date || new Date().toISOString(),
                type: memory.type || 'personal',
                author: memory.author || memory.user?.name,
                tags: Array.isArray(memory.tags)
                  ? memory.tags.map((t: any) => typeof t === 'string' ? t : t.name).filter(Boolean)
                  : []
              };
            });
            
            console.log('🔍 MediaPage: Transformed existing memories:', transformedMemories);
            setApiExistingMemories(transformedMemories);
          } else {
            console.log('🔍 MediaPage: No memories found in API response');
            setApiExistingMemories([]);
          }
        } else {
          console.error('🔍 MediaPage: Failed to fetch existing memories:', response.error);
          setApiExistingMemories([]);
        }
      } catch (error) {
        console.error('🔍 MediaPage: Error fetching existing memories:', error);
        setApiExistingMemories([]);
      } finally {
        setIsLoadingExistingMemories(false);
      }
  }, []);

  // Fetch existing memories when component mounts
  useEffect(() => {
    fetchExistingMemories();
  }, [fetchExistingMemories]);

  // Function to fetch connected services
  const fetchConnectedServices = useCallback(async () => {
    setIsLoadingServices(true);
    try {
      console.log('🔍 MediaPage: Fetching connected services...');
      const response = await dashboardAPI.getConnectedServices();
      console.log('🔍 MediaPage: Full API response:', response);
      console.log('🔍 MediaPage: response.success:', response.success);
      console.log('🔍 MediaPage: response.data:', response.data);

      if (response.success) {
        // Handle different response structures
        let services = [];

        if (response.data?.services) {
          services = response.data.services;
        } else if (response.services) {
          services = response.services;
        } else if (Array.isArray(response.data)) {
          services = response.data;
        }

        console.log('🔍 MediaPage: Extracted services:', services);
        console.log('🔍 MediaPage: Services count:', services.length);

        if (services.length > 0) {
          setConnectedServices(services);
          console.log('✅ MediaPage: Set connected services:', services);
        } else {
          console.log('⚠️ MediaPage: No connected services found in response');
          setConnectedServices([]);
        }
      } else {
        console.log('❌ MediaPage: API response was not successful');
        setConnectedServices([]);
      }
    } catch (error) {
      console.error('❌ MediaPage: Error fetching connected services:', error);
      setConnectedServices([]);
    } finally {
      setIsLoadingServices(false);
    }
  }, []);

  // Expose fetchConnectedServices to parent via callback
  useEffect(() => {
    if (onRefreshConnectedServicesReady) {
      onRefreshConnectedServicesReady(fetchConnectedServices);
    }
  }, [onRefreshConnectedServicesReady, fetchConnectedServices]);

  // Helper function to get image dimensions from URL
  const getImageDimensions = useCallback((imageUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const dimensions = `${img.width} × ${img.height}`;
        resolve(dimensions);
      };
      img.onerror = () => {
        resolve(''); // Return empty string if image fails to load
      };
      // Set a timeout to prevent hanging
      setTimeout(() => resolve(''), 5000);
      img.src = imageUrl;
    });
  }, []);

  // Function to fetch synced media for a specific service
  const fetchSyncedMedia = useCallback(async (serviceType?: string, serviceId?: string, page?: number, skipLoadingState?: boolean) => {
    console.log('🚀🚀🚀 MediaPage: fetchSyncedMedia CALLED!');
    console.log('🚀 Service Type:', serviceType);
    console.log('🚀 Service ID:', serviceId);

    if (!skipLoadingState) {
      setIsLoadingSyncedMedia(true);
    }
    try {
      console.log('🔍 MediaPage: Fetching synced media for service type:', serviceType);
      console.log('🔍 MediaPage: Will store with serviceId:', serviceId);
      console.log('🔍 MediaPage: Fetching page:', page || 1);

      // Fetch specified page (default to page 1 if not provided)
      const requestedPage = page || 1;
      const firstResponse = await dashboardAPI.getSyncedMedia(serviceType, requestedPage);
      console.log('🔍 MediaPage: First page response:', firstResponse);
      console.log('🔍 MediaPage: firstResponse.success:', firstResponse.success);
      console.log('🔍 MediaPage: firstResponse.data type:', typeof firstResponse.data);
      console.log('🔍 MediaPage: firstResponse.data:', firstResponse.data);

      // CRITICAL: Check if response has data, even if success is not explicitly true
      // Some APIs might return data without a success flag
      if (!firstResponse.data && !firstResponse.success) {
        console.log('❌ MediaPage: No synced media found or request failed');
        console.log('Response details:', { success: firstResponse.success, hasData: !!firstResponse.data, error: firstResponse.error });
        setIsLoadingSyncedMedia(false);
        return;
      }

      // Log the complete response structure
      console.log('🔍 MediaPage: ========== FULL RESPONSE START ==========');
      console.log('🔍 MediaPage: firstResponse:', JSON.stringify(firstResponse, null, 2));
      console.log('🔍 MediaPage: ========== FULL RESPONSE END ==========');

      let allMediaData: any[] = [];
      let pagination = null;

      // CRITICAL DEBUG: Check every possible location for the data
      console.log('🔍 MediaPage: Response.data type:', typeof firstResponse.data);
      console.log('🔍 MediaPage: Is Response.data an array?', Array.isArray(firstResponse.data));
      console.log('🔍 MediaPage: Response keys:', Object.keys(firstResponse));
      if (firstResponse.data && typeof firstResponse.data === 'object') {
        console.log('🔍 MediaPage: Response.data keys:', Object.keys(firstResponse.data));
      }

      // Log response structure details
      console.log('📋 Response structure - Keys:', Object.keys(firstResponse).join(', '));
      console.log('📋 Response structure - data type:', typeof firstResponse.data);
      console.log('📋 Response structure - data is array:', Array.isArray(firstResponse.data));
      if (firstResponse.data && typeof firstResponse.data === 'object') {
        console.log('📋 Response structure - data keys:', Object.keys(firstResponse.data).join(', '));
      }

      if (Array.isArray(firstResponse.data)) {
        // Case 1: response.data is directly an array
        console.log('🔍 MediaPage: Case 1 - Response.data is an array');
        allMediaData = [...firstResponse.data];
        // Check if pagination is at response level
        pagination = firstResponse.pagination || (firstResponse as any).meta?.pagination;
      } else if (firstResponse.data && typeof firstResponse.data === 'object') {
        console.log('🔍 MediaPage: Response.data is an object with keys:', Object.keys(firstResponse.data));

        // Case 2: Laravel-style pagination with nested data property
        // { data: { data: [...items...], pagination: {...} } }
        if (firstResponse.data.data && Array.isArray(firstResponse.data.data)) {
          console.log('🔍 MediaPage: Case 2 - Found nested data.data array');
          allMediaData = [...firstResponse.data.data];
          pagination = firstResponse.data.pagination || firstResponse.data.meta?.pagination;
        }
        // Case 3: Direct data property with separate pagination
        // { data: [...items...], pagination: {...} } but accessed as response.data
        else if (Array.isArray(firstResponse.data.items)) {
          console.log('🔍 MediaPage: Case 3 - Found data.items array');
          allMediaData = [...firstResponse.data.items];
          pagination = firstResponse.data.pagination;
        }
        // Case 4: Pagination at the data level
        else if (firstResponse.data.pagination) {
          console.log('🔍 MediaPage: Case 4 - Found pagination at data level');
          pagination = firstResponse.data.pagination;

          // Extract items - filter out pagination and other metadata
          const allKeys = Object.keys(firstResponse.data);
          console.log('🔍 MediaPage: All keys in response.data:', allKeys);

          const filteredKeys = allKeys.filter(key => !['pagination', 'meta', 'links'].includes(key));
          console.log('🔍 MediaPage: Filtered keys (after removing metadata):', filteredKeys);

          const mappedItems = filteredKeys.map(key => {
            const item = firstResponse.data[key];
            console.log(`🔍 MediaPage: Checking key "${key}":`, typeof item, item);

            // Check what properties the item has
            if (item && typeof item === 'object') {
              console.log(`🔍 MediaPage: Item "${key}" has properties:`, Object.keys(item));
              console.log(`🔍 MediaPage: Item "${key}" has id?`, 'id' in item, item.id);
              console.log(`🔍 MediaPage: Item "${key}" has file_name?`, 'file_name' in item, item.file_name);
            }

            return item;
          });

          const items = mappedItems.filter(item => {
            const hasId = item && typeof item === 'object' && item.id;
            const hasFileName = item && typeof item === 'object' && item.file_name;
            const isValid = item && typeof item === 'object' && (item.id || item.file_name);
            console.log('🔍 MediaPage: Item validity check - hasId:', hasId, 'hasFileName:', hasFileName, 'isValid:', isValid);
            if (item && typeof item === 'object') {
              console.log('🔍 MediaPage: Sample item keys:', Object.keys(item).slice(0, 10));
            }
            return isValid;
          });

          console.log('🔍 MediaPage: Final extracted items count:', items.length);
          allMediaData = items;
        }
        // Case 5: Object with numeric keys (indexed array-like object)
        else {
          console.log('🔍 MediaPage: Case 5 - Extracting from object keys');
          const allKeys = Object.keys(firstResponse.data);
          console.log('🔍 MediaPage: All keys in response.data:', allKeys);

          const filteredKeys = allKeys.filter(key => !['pagination', 'meta', 'links'].includes(key));
          console.log('🔍 MediaPage: Filtered keys (after removing metadata):', filteredKeys);

          const items = filteredKeys
            .map(key => firstResponse.data[key])
            .filter(item => item && typeof item === 'object' && (item.id || item.file_name));

          console.log('🔍 MediaPage: Final extracted items count:', items.length);
          allMediaData = items;
        }
      }

      // FALLBACK: If we still have 0 items, try to find ANY array in the response
      if (allMediaData.length === 0) {
        console.log('⚠️ MediaPage: No items extracted yet, trying fallback extraction...');

        // Check if response itself is an array
        if (Array.isArray(firstResponse)) {
          console.log('🔍 MediaPage: FALLBACK - firstResponse itself is an array');
          allMediaData = firstResponse;
          pagination = null;
        }
        // Look for any array property in the response
        else if (firstResponse && typeof firstResponse === 'object') {
          for (const key of Object.keys(firstResponse)) {
            if (Array.isArray(firstResponse[key]) && firstResponse[key].length > 0) {
              console.log(`🔍 MediaPage: FALLBACK - Found array at firstResponse.${key}`);
              allMediaData = firstResponse[key];
              break;
            }
          }

          // If still nothing, look inside response.data
          if (allMediaData.length === 0 && firstResponse.data && typeof firstResponse.data === 'object') {
            for (const key of Object.keys(firstResponse.data)) {
              if (Array.isArray(firstResponse.data[key]) && firstResponse.data[key].length > 0) {
                console.log(`🔍 MediaPage: FALLBACK - Found array at firstResponse.data.${key}`);
                allMediaData = firstResponse.data[key];
                // Check for pagination at same level
                if (firstResponse.data.pagination) {
                  pagination = firstResponse.data.pagination;
                }
                break;
              }
            }
          }
        }

        console.log('🔍 MediaPage: After fallback extraction, items count:', allMediaData.length);
      }

      console.log('🔍 MediaPage: Page items count:', allMediaData.length);
      console.log('🔍 MediaPage: First 3 items:', allMediaData.slice(0, 3));
      console.log('🔍 MediaPage: Pagination info:', pagination);

      // Log extraction results
      console.log(`✅ Extracted ${allMediaData.length} items from page ${requestedPage}`);
      if (pagination) {
        console.log(`✅ Pagination: ${pagination.current_page}/${pagination.last_page}`);
      }

      // Store pagination info for infinite scroll (instead of loading all pages at once)
      const storageKey = serviceId || serviceType;
      console.log('═══════════════════════════════════════════════════');
      console.log('💾 STORAGE KEY COMPUTATION');
      console.log('💾 serviceId param:', serviceId);
      console.log('💾 serviceType param:', serviceType);
      console.log('💾 FINAL storageKey:', storageKey);
      console.log('═══════════════════════════════════════════════════');
      if (pagination && storageKey) {
        console.log('💾 Storing pagination info for infinite scroll:', {
          currentPage: pagination.current_page || 1,
          lastPage: pagination.last_page || 1,
          hasMore: (pagination.current_page || 1) < (pagination.last_page || 1)
        });

        setServicePagination(prev => ({
          ...prev,
          [storageKey]: {
            currentPage: pagination.current_page || 1,
            lastPage: pagination.last_page || 1,
            hasMore: (pagination.current_page || 1) < (pagination.last_page || 1)
          }
        }));

        // Also set Dropbox-specific pagination state for UI display
        setDropboxCurrentPage(pagination.current_page || 1);
        setDropboxTotalPages(pagination.last_page || 1);
        console.log('💾 Set Dropbox pagination state:', {
          currentPage: pagination.current_page || 1,
          totalPages: pagination.last_page || 1
        });
      }

      // REMOVED: No longer fetch all pages at once - will load on scroll instead
      console.log('📜 Infinite scroll enabled - additional pages will load on scroll');

      console.log('🔍 MediaPage: Total synced media items across all pages:', allMediaData.length);
      console.log('🔍 MediaPage: Sample of all items:', allMediaData.slice(0, 5));

      // storageKey already declared above on line 704, no need to redeclare
      console.log('🔍 MediaPage: Storing with key:', storageKey);

      // Log total extraction
      console.log(`✅ Total items extracted: ${allMediaData.length}`);
      console.log(`✅ Storing with key: ${storageKey}`);

      // If fetching for a specific service, update that service's data
      if (storageKey) {
        setServiceSyncedMedia(prev => {
          const updated = {
            ...prev,
            [storageKey]: allMediaData
          };
          console.log('✅ MediaPage: Updated serviceSyncedMedia state:', updated);
          console.log(`✅ Stored ${allMediaData.length} items for ${storageKey}`);
          return updated;
        });
        console.log('✅ MediaPage: Stored synced media for:', storageKey);

        // Load dimensions asynchronously for images
        setTimeout(async () => {
          console.log('🔍 MediaPage: Starting to load dimensions for synced media...');
          const updatedMediaData = await Promise.all(
            allMediaData.map(async (item: any) => {
              if (item.media_type === 'image') {
                const imageUrl = item.thumbnail_url || item.media_url;
                if (imageUrl) {
                  const dimensions = await getImageDimensions(imageUrl);
                  if (dimensions) {
                    return { ...item, dimensions };
                  }
                }
              }
              return item;
            })
          );

          console.log('✅ MediaPage: Loaded dimensions for synced media');
          setServiceSyncedMedia(prev => ({
            ...prev,
            [storageKey]: updatedMediaData
          }));
        }, 100); // Small delay to avoid blocking UI
      } else {
        // If fetching all, update all services
        setServiceSyncedMedia(allMediaData);
      }
    } catch (error) {
      console.error('❌ MediaPage: Error fetching synced media:', error);
    } finally {
      if (!skipLoadingState) {
        setIsLoadingSyncedMedia(false);
      }
    }
  }, [getImageDimensions]);

  // Function to resync Dropbox paths
  // Function to load more synced media (for infinite scroll)
  const loadMoreSyncedMedia = useCallback(async (serviceType: string, serviceId?: string) => {
    const storageKey = serviceId || serviceType;
    const paginationInfo = servicePagination[storageKey];

    console.log('📜 loadMoreSyncedMedia called for:', storageKey);
    console.log('📜 Current pagination:', paginationInfo);

    if (!paginationInfo || !paginationInfo.hasMore || isLoadingMoreMedia) {
      console.log('📜 Cannot load more:', {
        noPagination: !paginationInfo,
        noMore: !paginationInfo?.hasMore,
        alreadyLoading: isLoadingMoreMedia
      });
      return;
    }

    setIsLoadingMoreMedia(true);

    try {
      const nextPage = paginationInfo.currentPage + 1;
      console.log(`📜 Loading page ${nextPage} of ${paginationInfo.lastPage}`);

      const response = await dashboardAPI.getSyncedMedia(serviceType, nextPage);

      if (response.success && response.data) {
        console.log('📜 Page loaded successfully:', response);
        console.log('📜 Full response:', JSON.stringify(response, null, 2));

        // Extract media from response using EXACT same logic as fetchSyncedMedia
        let pageData: any[] = [];

        // Case 1: response.data is directly an array
        if (Array.isArray(response.data)) {
          console.log('📜 Case 1: response.data is array');
          pageData = response.data;
        }
        // Case 2: Laravel-style pagination with nested data property
        else if (response.data && typeof response.data === 'object') {
          if (response.data.data && Array.isArray(response.data.data)) {
            console.log('📜 Case 2: nested data.data array');
            pageData = response.data.data;
          }
          // Case 3: Direct data property with separate pagination
          else if (Array.isArray(response.data.items)) {
            console.log('📜 Case 3: data.items array');
            pageData = response.data.items;
          }
          // Case 4 & 5: Extract from object keys
          else {
            console.log('📜 Case 4/5: extracting from object keys');
            const allKeys = Object.keys(response.data);
            console.log('📜 All keys:', allKeys);

            const filteredKeys = allKeys.filter(key => !['pagination', 'meta', 'links'].includes(key));
            console.log('📜 Filtered keys:', filteredKeys);

            const items = filteredKeys
              .map(key => response.data[key])
              .filter(item => item && typeof item === 'object' && (item.id || item.file_name));

            pageData = items;
          }
        }

        // FALLBACK: If still no data, try to find ANY array
        if (pageData.length === 0) {
          console.log('⚠️ No items extracted yet, trying fallback...');

          // Check if response itself is an array
          if (Array.isArray(response)) {
            console.log('📜 FALLBACK - response itself is array');
            pageData = response;
          }
          // Look for any array in response
          else if (response && typeof response === 'object') {
            for (const key of Object.keys(response)) {
              if (Array.isArray(response[key]) && response[key].length > 0) {
                console.log(`📜 FALLBACK - Found array at response.${key}`);
                pageData = response[key];
                break;
              }
            }

            // Look inside response.data
            if (pageData.length === 0 && response.data && typeof response.data === 'object') {
              for (const key of Object.keys(response.data)) {
                if (Array.isArray(response.data[key]) && response.data[key].length > 0) {
                  console.log(`📜 FALLBACK - Found array at response.data.${key}`);
                  pageData = response.data[key];
                  break;
                }
              }
            }
          }
        }

        console.log(`📜 Extracted ${pageData.length} items from page ${nextPage}`);
        console.log(`📜 Sample items:`, pageData.slice(0, 2));

        // Append new items to existing data
        console.log(`📜 Current items in storage for ${storageKey}:`, serviceSyncedMedia[storageKey]?.length || 0);
        console.log(`📜 Adding ${pageData.length} new items`);

        setServiceSyncedMedia(prev => {
          const currentItems = prev[storageKey] || [];
          const newItems = [...currentItems, ...pageData];
          console.log(`📜 Total items after merge: ${newItems.length} (was: ${currentItems.length}, added: ${pageData.length})`);
          return {
            ...prev,
            [storageKey]: newItems
          };
        });

        // Update pagination info
        setServicePagination(prev => ({
          ...prev,
          [storageKey]: {
            currentPage: nextPage,
            lastPage: paginationInfo.lastPage,
            hasMore: nextPage < paginationInfo.lastPage
          }
        }));

        console.log(`📜 Successfully loaded page ${nextPage}. Has more: ${nextPage < paginationInfo.lastPage}`);
      } else {
        console.error('📜 Failed to load more media:', response);
      }
    } catch (error) {
      console.error('📜 Error loading more media:', error);
    } finally {
      setIsLoadingMoreMedia(false);
    }
  }, [servicePagination, isLoadingMoreMedia]);

  // Function to refresh media URLs for a service
  const refreshServiceMediaUrls = useCallback(async (serviceId: string, serviceType: string) => {
    console.log('🔄 refreshServiceMediaUrls called for:', serviceType, serviceId);

    // Only refresh URLs for Dropbox
    if (serviceType !== 'dropbox') {
      console.log('ℹ️ Skipping URL refresh for non-Dropbox service');
      return;
    }

    // Show loader
    setIsDropboxSyncing(true);
    setSyncingService('dropbox'); // Track that Dropbox is syncing

    try {
      // Get current media for this service
      const currentMedia = serviceSyncedMedia[serviceId];
      console.log('📊 Current media for service:', currentMedia);

      if (!currentMedia) {
        console.log('ℹ️ No media found for service, fetching...');
        return;
      }

      // Extract media array
      let mediaArray = [];
      if (Array.isArray(currentMedia)) {
        mediaArray = currentMedia;
      } else if (currentMedia?.media) {
        mediaArray = currentMedia.media;
      } else if (currentMedia?.items) {
        mediaArray = currentMedia.items;
      } else if (currentMedia?.data) {
        mediaArray = currentMedia.data;
      }

      console.log('📊 Media array length:', mediaArray.length);

      if (mediaArray.length > 0) {
        // Extract media IDs
        const mediaIds = mediaArray.map((item: any) => {
          const id = item.id || item.media_id || item.service_media_id;
          return id?.toString();
        }).filter(Boolean);

        console.log('🔑 Extracted media IDs:', mediaIds);

        if (mediaIds.length > 0) {
          console.log('🔄 Calling getFreshMediaUrls with', mediaIds.length, 'IDs');
          const freshUrlsResponse = await dashboardAPI.getFreshMediaUrls(mediaIds);
          console.log('📦 Fresh URLs response:', freshUrlsResponse);

          if (freshUrlsResponse.success) {
            console.log('✅ Fresh URLs fetched successfully');

            // Refresh the media to show updated URLs
            await fetchSyncedMedia(serviceType, serviceId, undefined, true); // skipLoadingState = true
          } else {
            console.error('❌ Failed to get fresh URLs:', freshUrlsResponse.error);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error refreshing media URLs:', error);
      toast.error('Failed to refresh media URLs');
    } finally {
      setIsDropboxSyncing(false);
      setSyncingService(null); // Clear syncing service tracker
    }
  }, [serviceSyncedMedia, fetchSyncedMedia]);

  // NEW: Sequential API flow for Dropbox resync with pagination
  const handleDropboxResyncFlow = useCallback(async (serviceId: string) => {
    console.log('🚀🚀🚀 Starting Dropbox Resync Flow 🚀🚀🚀');
    setIsDropboxSyncing(true); // Show overlay loader
    setSyncingService('dropbox'); // Track that Dropbox is syncing (for modal display)
    setDropboxServiceIdAfterSync(serviceId); // Store service ID for "View Result" redirect

    // Declare timer variables outside try block so they can be accessed in finally
    let progressCheckTimer: NodeJS.Timeout | null = null;
    let progressInterval: NodeJS.Timeout | null = null;

    try {
      // Step 1: Resync Dropbox paths
      console.log('📍 Step 1: Resyncing Dropbox paths...');
      const resyncResponse = await dashboardAPI.resyncDropboxPaths();

      if (!resyncResponse.success) {
        throw new Error('Resync failed: ' + (resyncResponse.error || 'Unknown error'));
      }
      console.log('✅ Step 1 complete:', resyncResponse);

      // Step 2: Get Dropbox media IDs
      console.log('📍 Step 2: Getting Dropbox media IDs...');
      const mediaIdsResponse = await dashboardAPI.getDropboxMediaIds();

      if (!mediaIdsResponse.success || !mediaIdsResponse.data?.data?.media_ids) {
        throw new Error('Failed to get media IDs: ' + (mediaIdsResponse.error || 'No media_ids in response'));
      }

      const mediaIds = mediaIdsResponse.data.data.media_ids;
      console.log('✅ Step 2 complete: Got', mediaIds.length, 'media IDs');

      // Step 3: Get fresh media URLs - TRACK THIS API SPECIFICALLY
      console.log('📍 Step 3: Getting fresh media URLs...');
      console.log('⏰ Starting timer for /services/get-fresh-media-urls API');

      // Start timer ONLY for getFreshMediaUrls API
      const freshUrlsStartTime = Date.now();

      // Set up 10-second timer for THIS specific API
      progressCheckTimer = setTimeout(() => {
        const elapsed = Date.now() - freshUrlsStartTime;
        console.log(`🔥🔥🔥 10-SECOND TIMER FIRED! 🔥🔥🔥`);
        console.log(`⏰ Elapsed time: ${elapsed}ms - API still running`);
        console.log(`⏰ About to hide overlay spinner and show progress bar`);

        // Hide the overlay spinner and show progress bar in sidebar
        console.log(`🔴 Setting isDropboxSyncing = false`);
        setIsDropboxSyncing(false);

        console.log(`📊 Setting dropboxSyncProgress = 10%`);
        setDropboxSyncProgress(10); // Start at 10%

        // Notify parent component to show progress bar (this will also switch to Media tab)
        console.log(`📞 Calling onDropboxProgressChange:`, { exists: !!onDropboxProgressChange });
        if (onDropboxProgressChange) {
          console.log(`📞 onDropboxProgressChange(10, true, ${serviceId})`);
          onDropboxProgressChange(10, true, serviceId);
        } else {
          console.error(`❌ onDropboxProgressChange is NOT defined!`);
        }

        console.log('✅ Switched from overlay spinner to sidebar progress bar');

        // Gradually increase progress - slower speed (2% every 8 seconds)
        progressInterval = setInterval(() => {
          setDropboxSyncProgress(prev => {
            const newProgress = prev >= 90 ? 90 : prev + 2;
            console.log(`📊 Progress bar update: ${prev}% → ${newProgress}%`);

            // Notify parent component of progress update
            if (onDropboxProgressChange) {
              onDropboxProgressChange(newProgress, true, serviceId);
            }

            return newProgress;
          });
        }, 8000); // Every 8 seconds for slower progression
      }, 10000); // 10 seconds

      console.log('🌐 Calling /services/get-fresh-media-urls with', mediaIds.length, 'media IDs...');
      // Call the API
      const freshUrlsResponse = await dashboardAPI.getFreshMediaUrls(mediaIds);

      // Clear the timer since API completed
      if (progressCheckTimer) {
        console.log('✅ API completed, clearing timer');
        clearTimeout(progressCheckTimer);
        progressCheckTimer = null;
      }
      if (progressInterval) {
        console.log('✅ Clearing progress interval');
        clearInterval(progressInterval);
        progressInterval = null;
      }

      const freshUrlsElapsed = Date.now() - freshUrlsStartTime;
      console.log(`⏱️ /services/get-fresh-media-urls took ${freshUrlsElapsed}ms (${(freshUrlsElapsed/1000).toFixed(1)}s)`);

      // Check if API took more than 10 seconds (progress bar would have been shown)
      const progressWasShown = freshUrlsElapsed >= 10000;
      console.log(`⏱️ Was progress bar shown? ${progressWasShown ? 'YES' : 'NO'}`);

      // If progress bar was shown, we'll complete it after Step 4 when we have the item count
      if (progressWasShown) {
        console.log('📊 Progress bar will be completed after Step 4 with item count');
      }

      if (!freshUrlsResponse.success) {
        console.warn('⚠️ Step 3 warning: Fresh URLs partially failed:', freshUrlsResponse.error);
        // Continue anyway - URLs might be partially refreshed
      }
      console.log('✅ Step 3 complete:', freshUrlsResponse);

      // Step 4: Load page 1 of synced media with fresh URLs
      console.log('📍 Step 4: Loading page 1 of synced media with fresh URLs...');
      const syncedMediaResponse = await dashboardAPI.getSyncedMedia('dropbox', 1);

      if (!syncedMediaResponse.success) {
        throw new Error('Failed to load synced media: ' + (syncedMediaResponse.error || 'Unknown error'));
      }

      // Extract data and pagination info
      let pageData: any[] = [];
      let pagination: any = null;

      console.log('🔍 Step 4 - Raw syncedMediaResponse:', {
        success: syncedMediaResponse.success,
        dataType: typeof syncedMediaResponse.data,
        isArray: Array.isArray(syncedMediaResponse.data),
        dataKeys: syncedMediaResponse.data && typeof syncedMediaResponse.data === 'object' ? Object.keys(syncedMediaResponse.data) : []
      });

      // Extract using comprehensive logic
      if (Array.isArray(syncedMediaResponse.data)) {
        console.log('✅ Case 1: response.data is array');
        pageData = syncedMediaResponse.data;
        pagination = syncedMediaResponse.pagination;
      } else if (syncedMediaResponse.data?.data && Array.isArray(syncedMediaResponse.data.data)) {
        console.log('✅ Case 2: response.data.data is array');
        pageData = syncedMediaResponse.data.data;
        pagination = syncedMediaResponse.data.pagination;
      } else if (syncedMediaResponse.data?.items && Array.isArray(syncedMediaResponse.data.items)) {
        console.log('✅ Case 3: response.data.items is array');
        pageData = syncedMediaResponse.data.items;
        pagination = syncedMediaResponse.data.pagination;
      } else if (syncedMediaResponse.data?.media && Array.isArray(syncedMediaResponse.data.media)) {
        console.log('✅ Case 4: response.data.media is array');
        pageData = syncedMediaResponse.data.media;
        pagination = syncedMediaResponse.data.pagination;
      } else if (syncedMediaResponse.data && typeof syncedMediaResponse.data === 'object') {
        console.log('⚠️ Case 5: Extracting from object keys');
        // Try to extract pagination
        pagination = syncedMediaResponse.data.pagination;

        // Extract media array - try numbered keys or other properties
        const filteredKeys = Object.keys(syncedMediaResponse.data).filter(key =>
          !['pagination', 'meta', 'links', 'success', 'message', 'current_page', 'last_page', 'per_page', 'total'].includes(key)
        );
        console.log('🔍 Filtered keys for extraction:', filteredKeys);

        const items = filteredKeys
          .map(key => syncedMediaResponse.data[key])
          .filter(item => item && typeof item === 'object' && (item.id || item.file_name || item.name));

        console.log('🔍 Extracted items count:', items.length);
        pageData = items;
      }

      console.log('✅ Step 4 complete: Loaded', pageData.length, 'items');
      console.log('📊 Pagination info:', pagination);
      console.log('📦 Sample data item:', pageData[0]);

      console.log('📦 About to update state with pageData:', {
        serviceId,
        pageDataLength: pageData.length,
        pageDataSample: pageData.slice(0, 2),
        pagination
      });

      // Update state with page 1 data - Use flushSync to ensure immediate update
      console.log('📦 Setting serviceSyncedMedia for serviceId:', serviceId, 'with', pageData.length, 'items');
      setServiceSyncedMedia(prev => {
        const newState = {
          ...prev,
          [serviceId]: pageData
        };
        console.log('📦 New serviceSyncedMedia state:', Object.keys(newState), newState[serviceId]?.length);
        return newState;
      });

      // Update pagination state
      if (pagination) {
        setDropboxCurrentPage(pagination.current_page || 1);
        setDropboxTotalPages(pagination.last_page || 1);

        // Also update servicePagination for consistency
        setServicePagination(prev => ({
          ...prev,
          [serviceId]: {
            currentPage: pagination.current_page || 1,
            lastPage: pagination.last_page || 1,
            hasMore: (pagination.current_page || 1) < (pagination.last_page || 1)
          }
        }));
      } else {
        // If no pagination, set defaults
        setDropboxCurrentPage(1);
        setDropboxTotalPages(1);
      }

      // Wait a tick to ensure state updates have propagated
      await new Promise(resolve => setTimeout(resolve, 50));

      console.log('✅✅✅ Dropbox Resync Flow Complete ✅✅✅');
      console.log('✅ Final state:', {
        serviceId,
        pageDataCount: pageData.length,
        currentPage: pagination?.current_page || 1,
        totalPages: pagination?.last_page || 1
      });
      console.log('✅ serviceSyncedMedia should now contain Dropbox data for both sidebar and main area');

      // Complete the progress bar to 100% and show it if API took > 10s
      if (freshUrlsElapsed >= 10000) {
        console.log('📊 Final completion: Setting progress to 100%');
        setDropboxSyncProgress(100);

        // Notify parent component of final completion with item count
        if (onDropboxProgressChange) {
          console.log('📊 Sending completion to parent with item count:', pageData.length);
          onDropboxProgressChange(100, true, serviceId, pageData.length);
        }
        // Keep progress bar visible with "View Result" button
        // User will click it to go to Dropbox tab
      }

      toast.success(`Dropbox synced successfully! Loaded ${pageData.length} items`);

    } catch (error) {
      console.error('❌ Dropbox resync flow error:', error);
      toast.error('Failed to sync Dropbox: ' + (error instanceof Error ? error.message : 'Unknown error'));

      // Hide progress bar on error
      if (showDropboxProgress) {
        if (onDropboxProgressChange) {
          onDropboxProgressChange(0, false, serviceId);
        }
        setDropboxSyncProgress(0);
      }
    } finally {
      // Clean up timers and intervals - these are now accessible
      if (progressCheckTimer) {
        clearTimeout(progressCheckTimer);
      }
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      setIsDropboxSyncing(false); // Hide overlay loader
      setSyncingService(null); // Clear syncing service tracker
    }
  }, [showDropboxProgress, onDropboxProgressChange]);

  // Handle Dropbox page change (REPLACE data, not append)
  const handleDropboxPageChange = useCallback(async (serviceId: string, serviceType: string, newPage: number) => {
    console.log('📄 Dropbox page change:', { serviceId, serviceType, newPage });

    setIsDropboxSyncing(true); // Show overlay loader
    setSyncingService('dropbox'); // Track that Dropbox is syncing

    try {
      // Fetch the specific page
      const response = await dashboardAPI.getSyncedMedia(serviceType, newPage);

      if (!response.success) {
        throw new Error('Failed to load page: ' + (response.error || 'Unknown error'));
      }

      // Extract data and pagination info
      let pageData: any[] = [];
      let pagination: any = null;

      console.log('🔍 Raw response structure:', {
        success: response.success,
        dataType: typeof response.data,
        isDataArray: Array.isArray(response.data),
        dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : [],
        fullResponse: JSON.stringify(response, null, 2)
      });

      // Extract using same logic as fetchSyncedMedia
      if (Array.isArray(response.data)) {
        console.log('✅ Case 1: response.data is array');
        pageData = response.data;
        pagination = response.pagination;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        console.log('✅ Case 2: response.data.data is array');
        pageData = response.data.data;
        pagination = response.data.pagination;
      } else if (response.data?.items && Array.isArray(response.data.items)) {
        console.log('✅ Case 3: response.data.items is array');
        pageData = response.data.items;
        pagination = response.data.pagination;
      } else if (response.data?.media && Array.isArray(response.data.media)) {
        console.log('✅ Case 4: response.data.media is array');
        pageData = response.data.media;
        pagination = response.data.pagination;
      } else if (response.data && typeof response.data === 'object') {
        console.log('⚠️ Case 5: Trying to extract from object keys');
        // Try to extract pagination
        pagination = response.data.pagination;

        // Extract media array from numbered keys or other properties
        const filteredKeys = Object.keys(response.data).filter(key => !['pagination', 'meta', 'links', 'success', 'message'].includes(key));
        console.log('🔍 Filtered keys:', filteredKeys);

        const items = filteredKeys
          .map(key => response.data[key])
          .filter(item => item && typeof item === 'object' && (item.id || item.file_name || item.name));

        console.log('🔍 Extracted items:', items.length);
        pageData = items;
      }

      console.log('✅ Page', newPage, 'loaded:', pageData.length, 'items');
      console.log('📊 Pagination info:', pagination);
      console.log('📦 Sample item:', pageData[0]);

      // Warn if no data found
      if (pageData.length === 0) {
        console.warn('⚠️ No data found in pagination response for page', newPage);
        console.warn('⚠️ This might indicate an API issue or empty page');
      }

      // REPLACE data (not append) - this is key for pagination
      setServiceSyncedMedia(prev => ({
        ...prev,
        [serviceId]: pageData
      }));

      // Update pagination state
      if (pagination) {
        setDropboxCurrentPage(pagination.current_page || newPage);
        setDropboxTotalPages(pagination.last_page || 1);

        // Also update servicePagination for consistency
        setServicePagination(prev => ({
          ...prev,
          [serviceId]: {
            currentPage: pagination.current_page || newPage,
            lastPage: pagination.last_page || 1,
            hasMore: (pagination.current_page || newPage) < (pagination.last_page || 1)
          }
        }));
      } else {
        // If no pagination info, just update page number
        setDropboxCurrentPage(newPage);
      }

      toast.success(`Page ${newPage} loaded`);

    } catch (error) {
      console.error('❌ Page change error:', error);
      toast.error('Failed to load page: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsDropboxSyncing(false); // Hide overlay loader
      setSyncingService(null); // Clear syncing service tracker
    }
  }, []);

  // Handle jump to specific page
  const handleJumpToPage = useCallback(() => {
    const pageNum = parseInt(jumpToPageInput);

    // Validation
    if (!jumpToPageInput.trim()) {
      toast.error('Please enter a page number');
      return;
    }

    if (isNaN(pageNum)) {
      toast.error('Please enter a valid number');
      return;
    }

    if (pageNum < 1 || pageNum > dropboxTotalPages) {
      toast.error(`Please enter a page between 1 and ${dropboxTotalPages}`);
      return;
    }

    if (pageNum === dropboxCurrentPage) {
      toast.info(`Already on page ${pageNum}`);
      setJumpToPageInput('');
      return;
    }

    // Find the active service
    const service = connectedServices.find(s => s.id?.toString() === activeServiceTab);
    if (service) {
      handleDropboxPageChange(activeServiceTab, service.service_type || service.type, pageNum);
      setJumpToPageInput(''); // Clear input after successful jump
    }
  }, [jumpToPageInput, dropboxTotalPages, dropboxCurrentPage, activeServiceTab, connectedServices, handleDropboxPageChange]);

  // Generate page numbers for pagination display
  const getPageNumbers = useCallback(() => {
    const pages: (number | string)[] = [];
    const current = dropboxCurrentPage;
    const total = dropboxTotalPages;

    if (total <= 7) {
      // Show all pages if total is 7 or less
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (current <= 3) {
        // Near the start: [1] [2] [3] ... [86]
        pages.push(2, 3, '...', total);
      } else if (current >= total - 2) {
        // Near the end: [1] ... [84] [85] [86]
        pages.push('...', total - 2, total - 1, total);
      } else {
        // In the middle: [1] ... [42] [43] [44] ... [86]
        pages.push('...', current - 1, current, current + 1, '...', total);
      }
    }

    return pages;
  }, [dropboxCurrentPage, dropboxTotalPages]);

  const handleResyncDropbox = useCallback(async () => {
    console.log('🚀 handleResyncDropbox called');
    setIsResyncingDropbox(true);
    setIsLoadingSyncedMedia(true); // Show loading on Dropbox tab

    try {
      console.log('🔄 MediaPage: Step 1 - Resyncing Dropbox paths...');
      const resyncResponse = await dashboardAPI.resyncDropboxPaths();

      console.log('📦 Full resync response:', JSON.stringify(resyncResponse, null, 2));

      if (resyncResponse.success) {
        console.log('✅ Dropbox resync successful');

        // Extract media data - try multiple possible structures
        let mediaData = [];
        if (resyncResponse.data?.media) {
          mediaData = resyncResponse.data.media;
        } else if (resyncResponse.data?.data) {
          mediaData = resyncResponse.data.data;
        } else if (Array.isArray(resyncResponse.data)) {
          mediaData = resyncResponse.data;
        } else if (resyncResponse.media) {
          mediaData = resyncResponse.media;
        }

        console.log('📊 Extracted media data:', mediaData);
        console.log('📊 Media data length:', mediaData.length);

        // Step 2: Get fresh media URLs if we have media
        if (mediaData.length > 0) {
          console.log('🔄 MediaPage: Step 2 - Getting fresh media URLs...');

          const mediaIds = mediaData.map((item: any) => {
            const id = item.id || item.media_id || item.service_media_id;
            return id?.toString();
          }).filter(Boolean);

          console.log('🔑 Extracted media IDs:', mediaIds);

          if (mediaIds.length > 0) {
            console.log('🔄 Calling getFreshMediaUrls with', mediaIds.length, 'IDs');
            const freshUrlsResponse = await dashboardAPI.getFreshMediaUrls(mediaIds);
            console.log('📦 Fresh URLs response:', JSON.stringify(freshUrlsResponse, null, 2));

            if (freshUrlsResponse.success) {
              console.log('✅ Fresh URLs fetched successfully');
              toast.success('Dropbox media resynced successfully!');
            } else {
              console.error('❌ Failed to get fresh URLs:', freshUrlsResponse.error);
              toast.warning('Media resynced but some URLs may be outdated');
            }
          } else {
            console.warn('⚠️ No valid media IDs found');
            toast.success('Dropbox resynced but no media IDs found');
          }
        } else {
          console.log('ℹ️ No media data to refresh URLs for');
          toast.success('Dropbox media resynced successfully!');
        }

        // Step 3: Refresh the synced media for Dropbox tab
        console.log('🔄 MediaPage: Step 3 - Refreshing Dropbox tab...');
        const service = connectedServices.find(s => s.service_type === 'dropbox');
        console.log('🔍 Found Dropbox service:', service);

        if (service) {
          const serviceId = service.id?.toString();
          console.log('🆔 Service ID:', serviceId);

          // Clear cached data to force refetch
          setServiceSyncedMedia(prev => {
            const updated = { ...prev };
            delete updated[serviceId];
            return updated;
          });

          console.log('🔄 Fetching fresh synced media...');
          // Fetch fresh data with updated URLs
          await fetchSyncedMedia('dropbox', serviceId, undefined, true); // skipLoadingState = true
          console.log('✅ Dropbox tab refreshed');
        } else {
          console.error('❌ Dropbox service not found in connectedServices');
        }
      } else {
        console.error('❌ Dropbox resync failed:', resyncResponse);
        toast.error(resyncResponse.error || 'Failed to resync Dropbox media');
      }
    } catch (error) {
      console.error('❌ Error resyncing Dropbox:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      toast.error('Failed to resync Dropbox media');
    } finally {
      console.log('🏁 Resync complete, clearing loading states');
      setIsResyncingDropbox(false);
      setIsLoadingSyncedMedia(false);
    }
  }, [connectedServices, fetchSyncedMedia]);

  // Fetch connected services on component mount
  useEffect(() => {
    fetchConnectedServices();
  }, [fetchConnectedServices]);

  // Auto-refresh connected services when on a service tab (like Dropbox)
  useEffect(() => {
    // Only auto-refresh if we're on a service tab (not 'all')
    if (activeServiceTab !== 'all') {
      console.log('🔄 Auto-refresh: Starting connected services refresh interval for tab:', activeServiceTab);

      // Refresh immediately
      fetchConnectedServices();

      // Set up interval to refresh every 30 seconds while on service tab
      const refreshInterval = setInterval(() => {
        console.log('🔄 Auto-refresh: Refreshing connected services (30s interval)');
        fetchConnectedServices();
      }, 10000); // 30 seconds

      // Cleanup interval when leaving service tab or component unmounts
      return () => {
        console.log('🔄 Auto-refresh: Clearing connected services refresh interval');
        clearInterval(refreshInterval);
      };
    }
  }, [activeServiceTab, fetchConnectedServices]);

  // Notify parent when activeServiceTab changes
  useEffect(() => {
    if (onServiceTabChange) {
      onServiceTabChange(activeServiceTab);
    }
  }, [activeServiceTab, onServiceTabChange]);

  // Notify parent when serviceSyncedMedia changes
  useEffect(() => {
    if (onServiceSyncedMediaChange) {
      onServiceSyncedMediaChange(serviceSyncedMedia);
    }
  }, [serviceSyncedMedia, onServiceSyncedMediaChange]);

  // Notify parent when connectedServices changes
  useEffect(() => {
    if (onConnectedServicesChange) {
      onConnectedServicesChange(connectedServices);
    }
  }, [connectedServices, onConnectedServicesChange]);

  // Check for service connection from OAuth callback and refresh data
  useEffect(() => {
    const checkOAuthReturn = async () => {
      const activeService = sessionStorage.getItem('activeServiceTab');
      const justConnected = sessionStorage.getItem('service_just_connected');

      if (activeService && justConnected) {
        console.log('🔄 Service just connected, refreshing data...');

        // Clear the flags
        sessionStorage.removeItem('service_just_connected');

        // Refresh connected services to get updated list
        await fetchConnectedServices();

        // Set the active tab to the newly connected service
        onServiceTabChange?.(activeService);

        toast.success('Service connected! Refreshing data...');
      }
    };

    checkOAuthReturn();
  }, [fetchConnectedServices, onServiceTabChange]);

  // Fetch synced media when active tab changes
  useEffect(() => {
    if (activeServiceTab !== 'all' && connectedServices.length > 0) {
      console.log('🔍 Active tab changed to:', activeServiceTab);
      console.log('🔍 Connected services:', connectedServices);

      // Find the service by ID or type
      const service = connectedServices.find(s => {
        const serviceId = s.id?.toString();
        const serviceType = s.service_type || s.type;
        return serviceId === activeServiceTab || serviceType === activeServiceTab;
      });

      console.log('🔍 Found service:', service);
      console.log('🔍 Current synced media cache:', serviceSyncedMedia);

      if (service) {
        const serviceType = service.service_type || service.type;
        const serviceId = activeServiceTab;
        console.log('🔍 Service type for API call:', serviceType);
        console.log('🔍 Service ID for storage:', serviceId);

        // Skip Dropbox auto-fetch ONLY if we already have data
        // If no data exists, fetch it (this handles navigation from other pages)
        if (serviceType === 'dropbox' && serviceSyncedMedia[serviceId]) {
          console.log('🔍 Dropbox data already loaded, skipping auto-fetch');
          return;
        }

        // Check if we already have synced media for this service
        if (!serviceSyncedMedia[serviceId]) {
          console.log('🔍 Fetching synced media for service type:', serviceType);
          // Pass both serviceType for API and serviceId for storage
          fetchSyncedMedia(serviceType, serviceId);
        } else {
          console.log('🔍 Already have synced media cached for:', serviceId);

          // Auto-refresh URLs if last sync was more than 3 hours ago
          const checkAndRefreshUrls = async () => {
            console.log('⚠️ Auto-refresh temporarily disabled - API endpoint not ready');
            return;
            // DISABLED CODE BELOW
            console.log('🔍 Checking if URLs need refresh for service:', service);

            // Parse the last_sync_time from service (could be a timestamp or relative time string)
            // Check multiple possible field names for the timestamp
            const lastSyncTime = service.last_sync_time || service.last_synced_at || service.synced_at || service.updated_at || service.connected_at;

            console.log('🕒 Found lastSyncTime field:', lastSyncTime);
            console.log('🕒 Available service fields:', Object.keys(service));
            console.log('🕒 service.connected_at:', service.connected_at);
            console.log('🕒 service.last_sync:', service.last_sync);

            if (lastSyncTime) {
              const lastSync = new Date(lastSyncTime);
              const now = new Date();
              const threeHoursAgo = new Date(now.getTime() - (3 * 60 * 60 * 1000));

              console.log('🕒 Last sync time:', lastSync);
              console.log('🕒 Last sync time ISO:', lastSync.toISOString());
              console.log('🕒 Current time:', now);
              console.log('🕒 Three hours ago:', threeHoursAgo);
              console.log('🕒 Is older than 3 hours?', lastSync < threeHoursAgo);

              if (lastSync < threeHoursAgo) {
                console.log('🔄 Last sync was more than 3 hours ago, refreshing URLs...');
              } else {
                console.log('⏰ Last sync was within 3 hours, skipping refresh');
              }

              if (lastSync < threeHoursAgo) {

                // Get all media IDs from cached data
                const cachedMedia = serviceSyncedMedia[serviceId];
                const mediaArray = Array.isArray(cachedMedia) ? cachedMedia : (cachedMedia?.media || cachedMedia?.items || cachedMedia?.data || []);

                if (Array.isArray(mediaArray) && mediaArray.length > 0) {
                  const mediaIds = mediaArray.map((item: any) => item.id?.toString()).filter(Boolean);

                  console.log('🔄 Refreshing URLs for', mediaIds.length, 'media items');

                  try {
                    const response = await dashboardAPI.getFreshMediaUrls(mediaIds);

                    if (response.success && response.data) {
                      console.log('✅ Fresh URLs received:', response.data);

                      // Extract results array from response
                      const freshResults = response.data.results || response.data;
                      console.log('✅ Fresh results array:', freshResults);

                      // Update the cached media with fresh URLs
                      const updatedMedia = mediaArray.map((item: any) => {
                        const freshData = Array.isArray(freshResults) ? freshResults.find((fresh: any) => fresh.media_id?.toString() === item.id?.toString()) : null;
                        if (freshData) {
                          return {
                            ...item,
                            thumbnail_url: freshData.thumbnail_url || freshData.media_url || item.thumbnail_url,
                            media_url: freshData.media_url || item.media_url,
                          };
                        }
                        return item;
                      });

                      // Update state with refreshed URLs
                      setServiceSyncedMedia(prev => ({
                        ...prev,
                        [serviceId]: updatedMedia
                      }));

                      console.log('✅ URLs refreshed successfully');
                    }
                  } catch (error) {
                    console.error('❌ Error refreshing URLs:', error);
                  }
                }
              } else {
                console.log('❌ Last sync time is within 3 hours or not found');
              }
            } else {
              console.log('❌ No lastSyncTime field found in service object');
            }
          };

          checkAndRefreshUrls();
        }
      } else {
        console.warn('⚠️ Could not find service for active tab:', activeServiceTab);
      }
    }
  }, [activeServiceTab, connectedServices, serviceSyncedMedia, fetchSyncedMedia]);

  // Use API existing memories if available, otherwise fall back to local data
  const existingMemories: ExistingMemory[] = apiExistingMemories.length > 0 
    ? apiExistingMemories 
    : localMediaMemories.map(memory => ({
        id: memory.id,
        title: memory.title,
        category: memory.category,
        thumbnail: memory.thumbnail,
        imageCount: memory.imageCount,
        date: memory.date,
        type: memory.type,
        author: memory.author
      }));

  // Debug memory data
  console.log('🔍 MediaPage Memory Debug:');
  console.log('Original mediaMemories prop:', mediaMemories);
  console.log('localMediaMemories state:', localMediaMemories);
  console.log('apiExistingMemories from API:', apiExistingMemories);
  console.log('Final existingMemories for dialog:', existingMemories);
  console.log('isLoadingExistingMemories:', isLoadingExistingMemories);
  
  console.log('🔄 Real user memories for BatchActions:', existingMemories);

  // Convert data using utility functions
  const convertedMemoryItems = useCallback(() =>
    convertMemoriesToMediaItems(localMediaMemories, expandedCategories, selectedCategory),
    [localMediaMemories, expandedCategories, selectedCategory]
  );

  const convertedUnassignedItems = useCallback(() => 
    convertUnassignedToMediaItems(unassignedImages, showUnassignedImages), 
    [unassignedImages, showUnassignedImages]
  );

  // Update media items when dependencies change
  useEffect(() => {
    let allItems: MediaItem[] = [];

    // If we have API data, use it instead of static data
    // DON'T filter here - let filterMediaItems handle all filtering in useMemo
    if (apiMediaItems.length > 0) {
      console.log('🎯 Using API media items:', apiMediaItems.length);
      allItems = [...uploadedItems, ...apiMediaItems];
    } else {
      // Fallback to static data conversion
      console.log('🎯 Using static data conversion');
      const convertedItems = convertedMemoryItems();
      const unassignedItems = convertedUnassignedItems();
      allItems = [...uploadedItems, ...unassignedItems, ...convertedItems];
    }

    console.log('🎯 Final media items count:', allItems.length);
    setMediaItems(allItems);
  }, [localMediaMemories, unassignedImages, showUnassignedImages, uploadedItems, expandedCategories, convertedMemoryItems, convertedUnassignedItems, apiMediaItems]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    console.log('═══════════════════════════════════════════════════');
    console.log('🎯 FILTERED ITEMS COMPUTATION');
    console.log('═══════════════════════════════════════════════════');
    console.log('🎯 activeServiceTab:', activeServiceTab);
    console.log('🎯 serviceSyncedMedia keys:', Object.keys(serviceSyncedMedia));
    console.log('🎯 serviceSyncedMedia full state:', serviceSyncedMedia);

    // If a service tab is active (not 'all'), ONLY show synced media from that service
    // Don't fall back to regular media - return empty array if synced media not loaded yet
    if (activeServiceTab !== 'all') {
      console.log('🎯 Service tab is active:', activeServiceTab);
      console.log('🎯 Looking for key:', activeServiceTab);
      console.log('🎯 Available keys:', Object.keys(serviceSyncedMedia));
      console.log('🎯 serviceSyncedMedia[activeServiceTab] exists?:', !!serviceSyncedMedia[activeServiceTab]);
      console.log('🎯 serviceSyncedMedia[activeServiceTab] value:', serviceSyncedMedia[activeServiceTab]);

      // If no synced media for this tab yet, return empty array (don't show regular media)
      if (!serviceSyncedMedia[activeServiceTab]) {
        console.log('⏳ No synced media loaded yet for tab, returning empty array');
        console.log('⏳ This is why you see "No Media Found"');
        console.log('═══════════════════════════════════════════════════');
        return [];
      }
      console.log('🎯 Service tab is active, fetching synced media for:', activeServiceTab);
      const syncedMedia = serviceSyncedMedia[activeServiceTab];
      console.log('🎯 Synced media for tab:', syncedMedia);
      console.log('🎯 Is array?', Array.isArray(syncedMedia));
      console.log('🎯 Length:', Array.isArray(syncedMedia) ? syncedMedia.length : 'N/A');

      // Check if syncedMedia is an array
      if (!Array.isArray(syncedMedia)) {
        console.warn('🔍 Synced media is not an array:', syncedMedia);
        // If it's an object with a media or items property, use that
        const mediaArray = syncedMedia?.media || syncedMedia?.items || syncedMedia?.data || [];
        if (!Array.isArray(mediaArray)) {
          console.warn('🔍 Could not find media array in response, returning empty');
          return [];
        }
        // Transform synced media to MediaItem format based on actual API response
        const transformedSyncedMedia: MediaItem[] = mediaArray.map((item: any, index: number) => {
          // Convert file_size from bytes to readable format
          let size = 'Unknown';
          if (item.file_size) {
            const bytes = typeof item.file_size === 'number' ? item.file_size : parseInt(item.file_size);
            if (!isNaN(bytes)) {
              if (bytes < 1024) {
                size = `${bytes} B`;
              } else if (bytes < 1024 * 1024) {
                size = `${(bytes / 1024).toFixed(1)} KB`;
              } else {
                size = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
              }
            }
          } else if (item.size) {
            size = typeof item.size === 'string' ? item.size : `${item.size} MB`;
          }

          // Get dimensions - try multiple fields
          let dimensions = '';
          if (item.dimensions) {
            dimensions = item.dimensions;
          } else if (item.resolution) {
            dimensions = item.resolution;
          } else if (item.width && item.height) {
            dimensions = `${item.width} × ${item.height}`;
          } else if (item.metadata?.width && item.metadata?.height) {
            dimensions = `${item.metadata.width} × ${item.metadata.height}`;
          } else if (item.metadata?.dimensions) {
            dimensions = item.metadata.dimensions;
          } else if (item.image_width && item.image_height) {
            dimensions = `${item.image_width} × ${item.image_height}`;
          }

          // Get the service name for display
          const serviceName = item.connected_service?.service_type || activeServiceTab;

          return {
            id: item.id?.toString() || `synced-${activeServiceTab}-${index}`,
            name: item.file_name || item.name || item.filename || item.title || 'Untitled',
            description: item.description || '', // Facebook caption/description
            thumbnail: item.thumbnail_url || item.media_url || item.thumbnail || item.url || '',
            date: item.capture_date || item.synced_at || item.created_at || item.date || new Date().toISOString(),
            size: size,
            type: item.media_type === 'video' ? 'video' : 'image',
            dimensions: dimensions,
            location: item.location,
            metadata: {
              camera: item.camera || item.device || 'Unknown',
              dimensions: dimensions,
              location: item.location,
              captureDate: item.capture_date
            },
            category: serviceName,
            service: serviceName,
            source: item.type || serviceName,
            // Additional fields from API
            external_id: item.external_id,
            service_id: item.service_id
          };
        });

        // Apply search filter to synced media
        const filtered = searchQuery
          ? transformedSyncedMedia.filter(item =>
              item.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
          : transformedSyncedMedia;

        return sortMediaItems(filtered, sortBy, sortOrder);
      }

      // Transform synced media to MediaItem format based on actual API response
      const transformedSyncedMedia: MediaItem[] = syncedMedia.map((item: any, index: number) => {
        // Convert file_size from bytes to readable format
        let size = 'Unknown';
        if (item.file_size) {
          const bytes = typeof item.file_size === 'number' ? item.file_size : parseInt(item.file_size);
          if (!isNaN(bytes)) {
            if (bytes < 1024) {
              size = `${bytes} B`;
            } else if (bytes < 1024 * 1024) {
              size = `${(bytes / 1024).toFixed(1)} KB`;
            } else {
              size = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
            }
          }
        } else if (item.size) {
          size = typeof item.size === 'string' ? item.size : `${item.size} MB`;
        }

        // Get dimensions - try multiple fields
        let dimensions = '';
        if (item.dimensions) {
          dimensions = item.dimensions;
        } else if (item.resolution) {
          dimensions = item.resolution;
        } else if (item.width && item.height) {
          dimensions = `${item.width} × ${item.height}`;
        } else if (item.metadata?.width && item.metadata?.height) {
          dimensions = `${item.metadata.width} × ${item.metadata.height}`;
        } else if (item.metadata?.dimensions) {
          dimensions = item.metadata.dimensions;
        } else if (item.image_width && item.image_height) {
          dimensions = `${item.image_width} × ${item.image_height}`;
        }

        // Get the service name for display
        const serviceName = item.connected_service?.service_type || activeServiceTab;

        return {
          id: item.id?.toString() || `synced-${activeServiceTab}-${index}`,
          name: item.file_name || item.name || item.filename || item.title || 'Untitled',
          description: item.description || '', // Facebook caption/description
          thumbnail: item.thumbnail_url || item.media_url || item.thumbnail || item.url || '',
          date: item.capture_date || item.synced_at || item.created_at || item.date || new Date().toISOString(),
          size: size,
          type: item.media_type === 'video' ? 'video' : 'image',
          dimensions: dimensions,
          location: item.location,
          metadata: {
            camera: item.camera || item.device || 'Unknown',
            dimensions: dimensions,
            location: item.location,
            captureDate: item.capture_date
          },
          category: serviceName,
          service: serviceName,
          source: item.type || serviceName,
          // Additional fields from API
          external_id: item.external_id,
          service_id: item.service_id
        };
      });

      // Apply search filter to synced media
      const filtered = searchQuery
        ? transformedSyncedMedia.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : transformedSyncedMedia;

      return sortMediaItems(filtered, sortBy, sortOrder);
    }

    // Default: show regular media items
    const filtered = filterMediaItems(mediaItems, expandedCategories, showUnassignedImages, searchQuery, selectedCategory);
    return sortMediaItems(filtered, sortBy, sortOrder);
  }, [mediaItems, expandedCategories, showUnassignedImages, searchQuery, selectedCategory, sortBy, sortOrder, activeServiceTab, serviceSyncedMedia]);

  // Keep all-media count updated — always tracks total items, not filtered
  useEffect(() => {
    setAllMediaCount(mediaItems.length);
  }, [mediaItems.length]);

  // Get expanded category names for display
  const expandedCategoryNames = expandedCategories.filter(category => category !== 'Unassigned');
  
  // Check if we should show Unassigned category by checking raw data (before filtering)
  const shouldShowUnassigned = (() => {
    // Only show if showUnassignedImages is true
    if (!showUnassignedImages) {
      return false;
    }
    
    // 1. When media is currently being uploaded, always show
    if (isUploadingMedia) {
      return true;
    }
    
    // 2. Check if there are any actual unassigned items in the raw mediaItems
    // that would be displayed when Unassigned category is expanded
    const hasUnassignedItems = mediaItems.some(item => 
      (!item.memory && (!item.category || item.category === 'Unassigned'))
    );
    
    // 3. Only show if there are actually unassigned items to display
    return hasUnassignedItems;
  })();
  
  if (shouldShowUnassigned) {
    expandedCategoryNames.unshift('Unassigned');
  }

  // Create display title based on selected category or expanded categories
  const getDisplayTitle = () => {
    if (selectedCategory) {
      return (
        <span className="ml-2 text-lg font-normal text-gray-600">
          • {selectedCategory}
        </span>
      );
    } else if (expandedCategoryNames.length > 0 && expandedCategoryNames.length < 4) {
      return (
        <span className="ml-2 text-lg font-normal text-gray-600">
          • {expandedCategoryNames.join(', ')}
        </span>
      );
    }
    return null;
  };

  const getDisplaySubtitle = () => {
    if (selectedCategory) {
      return `Showing media from ${selectedCategory} category only`;
    } else if (expandedCategoryNames.length === 0) {
      return 'No categories expanded. Expand categories in the sidebar to view media.';
    } else if (expandedCategoryNames.length < 4) {
      return `Showing media from ${expandedCategoryNames.length === 1 ? expandedCategoryNames[0] + ' category' : expandedCategoryNames.length + ' categories'}`;
    } else {
      return 'Upload, organize, and manage your photos and videos';
    }
  };

  // Helper function to get location display string
  const getLocationDisplay = (location?: string | { city?: string; country?: string; coordinates?: { lat: number; lng: number } }) => {
    if (!location) return null;
    if (typeof location === 'string') return location;
    if (typeof location === 'object') {
      if (location.city && location.country) return `${location.city}, ${location.country}`;
      if (location.city) return location.city;
      if (location.country) return location.country;
    }
    return null;
  };

  // Helper function to get service icon
  const getServiceIcon = (serviceType?: string) => {
    const className = "w-6 h-6";

    switch (serviceType?.toLowerCase()) {
      case 'icloud':
      case 'icloud_photos':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.762 4.29a6.51 6.51 0 0 0-5.668 3.332 3.571 3.571 0 0 0-1.52-.334 3.571 3.571 0 0 0-3.514 3A3.571 3.571 0 0 0 0 13.857a3.571 3.571 0 0 0 3.571 3.571h16.071a2.857 2.857 0 0 0 0-5.714c0-3.714-3.429-6.857-6.857-6.857a4.5 4.5 0 0 0-2.024.571z"/>
          </svg>
        );
      case 'google':
      case 'google_photos':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 26 26" fill="none">
            <g clipPath="url(#clip0_google_photos)">
              <path d="M1.08337 13.0002C1.08337 4.3335 4.33337 1.0835 13 1.0835C21.6667 1.0835 24.9167 4.3335 24.9167 13.0002C24.9167 21.6668 21.6667 24.9168 13 24.9168C4.33337 24.9168 1.08337 21.6668 1.08337 13.0002Z" fill="white"/>
              <path d="M3.90002 12.9998H10.92C11.477 12.9988 12.0108 12.7767 12.4042 12.3823L8.45003 8.31982L3.90002 12.9998Z" fill="#FFC400"/>
              <path d="M12.4041 12.3823C12.7873 11.9921 13.0013 11.4667 13 10.9198V8.31982H8.44995L12.4041 12.3823Z" fill="#FFA300"/>
              <path d="M22.1 13H15.08C14.523 13.001 13.9892 13.2231 13.5958 13.6175L17.55 17.68L22.1 13Z" fill="#0089FF"/>
              <path d="M13.5958 13.6177C13.2127 14.0079 12.9986 14.5333 13 15.0802V17.6802H17.55L13.5958 13.6177Z" fill="#0069E4"/>
              <path d="M13 3.8999V10.9199C13.001 11.4769 13.2231 12.0107 13.6175 12.4041L17.68 8.4499L13 3.8999Z" fill="#FF4834"/>
              <path d="M13.6176 12.4044C14.0078 12.7875 14.5332 13.0016 15.0801 13.0002H17.6801V8.4502L13.6176 12.4044Z" fill="#FF025F"/>
              <path d="M12.9999 22.0999V15.0799C12.9989 14.5229 12.7768 13.9891 12.3824 13.5957L8.31995 17.5499L12.9999 22.0999Z" fill="#00C800"/>
              <path d="M12.3824 13.5958C11.9922 13.2127 11.4668 12.9986 10.9199 13H8.31995V17.55L12.3824 13.5958Z" fill="#00A44C"/>
            </g>
            <defs>
              <clipPath id="clip0_google_photos">
                <rect width="26" height="26" fill="white"/>
              </clipPath>
            </defs>
          </svg>
        );
      case 'dropbox':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452 0 13.274zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z" fill="#0061FF"/>
          </svg>
        );
      case 'facebook':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="12" fill="#1877F2"/>
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="white"/>
          </svg>
        );
      default:
        return <ImageIcon className={className} />;
    }
  };

  // Event handlers
  const handleToggleSelect = (item: MediaItem) => {
    const isCurrentlySelected = selectedItems.has(item.id);
    const newSelected = !isCurrentlySelected;
    
    // Update external selection if handler exists
    if (onMediaItemSelect) {
      onMediaItemSelect(item.id, newSelected);
    }
    
    // Always update local state for consistency
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item.id)) {
        newSet.delete(item.id);
      } else {
        newSet.add(item.id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allSelected = selectedItems.size === filteredItems.length;
    
    if (onMediaItemSelect) {
      // Use external selection handler
      filteredItems.forEach(item => {
        onMediaItemSelect(item.id, !allSelected);
      });
    }
    
    // Always update local state for consistency
    if (allSelected) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  const handleView = (item: MediaItem) => {
    // Handle item view
  };

  // Handle comment count updates from ImageViewer
  const handleCommentCountChange = useCallback((imageId: string, newCount: number) => {
    console.log('🔥 Comment count changed for image:', imageId, 'new count:', newCount);

    // Update the mediaItems state to reflect the new comment count
    // This will cause a re-render and update the badge
    setMediaItems(prevItems =>
      prevItems.map(item =>
        item.id === imageId
          ? { ...item, comments_count: newCount }
          : item
      )
    );
  }, []);

  const handleViewImage = (src: string, alt: string, title?: string, subtitle?: string, imageId?: string) => {
    console.log('🔥 MediaPage handleViewImage called with:', { src, alt, title, subtitle, imageId });
    // Build the images array from current filtered items for carousel functionality
    const allImages = filteredItems.map(item => ({
      src: item.thumbnail,
      alt: item.name,
      title: item.name,
      subtitle: `${item.size} • ${new Date(item.date).toLocaleDateString()}`,
      id: item.id
    }));
    
    // Find the current image index
    const currentIndex = allImages.findIndex(img => img.src === src || img.id === imageId);
    
    const finalImageId = imageId || allImages[Math.max(0, currentIndex)]?.id;
    
    // Find the actual media item to get its location and metadata
    const currentMediaItem = filteredItems.find(item => item.id === finalImageId || item.thumbnail === src);
    
    console.log('🔥 MediaPage handleViewImage - currentMediaItem:', currentMediaItem);
    
    // Extract location data from the media item
    let locationAddress: string | undefined;
    let coordinates: { lat: number; lng: number } | undefined;
    
    if (currentMediaItem?.location) {
      if (typeof currentMediaItem.location === 'string') {
        locationAddress = currentMediaItem.location;
      } else {
        if (currentMediaItem.location.city || currentMediaItem.location.country) {
          locationAddress = `${currentMediaItem.location.city || ''}${currentMediaItem.location.city && currentMediaItem.location.country ? ', ' : ''}${currentMediaItem.location.country || ''}`;
        }
        coordinates = currentMediaItem.location.coordinates;
      }
    }
    
    setImageViewer({
      isOpen: true,
      src,
      alt,
      title,
      subtitle,
      images: allImages,
      currentIndex: Math.max(0, currentIndex),
      imageId: finalImageId,
      location: locationAddress || currentMediaItem?.metadata?.location,
      dateTaken: currentMediaItem?.metadata?.captureDate || currentMediaItem?.date || new Date().toISOString(),
      camera: currentMediaItem?.metadata?.camera || 'Unknown Camera',
      coordinates: coordinates,
      description: currentMediaItem?.description,
      user_name: currentMediaItem?.user_name,
      user_profile: currentMediaItem?.user_profile,
      rotation_angle: currentMediaItem?.rotation_angle || 0,
      tags: (currentMediaItem?.tags || []).map((t: any) => typeof t === 'string' ? t : t?.name).filter(Boolean)
    });
    
    // Notify parent about highlighted image
    if (onHighlightedImageChange && finalImageId) {
      onHighlightedImageChange(finalImageId);
    }
  };

  // Set the image viewer function reference for MediaNav
  useEffect(() => {
    if (imageViewerRef) {
      imageViewerRef.current = handleViewImage;
    }
  }, [imageViewerRef]);

  const handleCloseImageViewer = () => {
    setImageViewer({
      isOpen: false,
      src: '',
      alt: '',
      title: '',
      subtitle: '',
      images: [],
      currentIndex: 0,
      imageId: '',
      location: undefined,
      dateTaken: undefined,
      camera: undefined,
      coordinates: undefined,
      rotation_angle: 0
    });
    
    // Clear highlighted image
    if (onHighlightedImageChange) {
      onHighlightedImageChange(null);
    }
  };

  const handleNextImage = () => {
    if (imageViewer.currentIndex < imageViewer.images.length - 1) {
      const nextIndex = imageViewer.currentIndex + 1;
      const nextImage = imageViewer.images[nextIndex];
      
      // Find the actual media item to get its location and metadata
      const currentMediaItem = filteredItems.find(item => item.id === nextImage.id || item.thumbnail === nextImage.src);
      
      // Extract location data from the media item
      let locationAddress: string | undefined;
      let coordinates: { lat: number; lng: number } | undefined;
      
      if (currentMediaItem?.location) {
        if (typeof currentMediaItem.location === 'string') {
          locationAddress = currentMediaItem.location;
        } else {
          if (currentMediaItem.location.city || currentMediaItem.location.country) {
            locationAddress = `${currentMediaItem.location.city || ''}${currentMediaItem.location.city && currentMediaItem.location.country ? ', ' : ''}${currentMediaItem.location.country || ''}`;
          }
          coordinates = currentMediaItem.location.coordinates;
        }
      }
      
      setImageViewer(prev => ({
        ...prev,
        src: nextImage.src,
        alt: nextImage.alt,
        title: nextImage.title,
        subtitle: nextImage.subtitle,
        currentIndex: nextIndex,
        imageId: nextImage.id,
        location: locationAddress || currentMediaItem?.metadata?.location,
        dateTaken: currentMediaItem?.metadata?.captureDate || currentMediaItem?.date || new Date().toISOString(),
        camera: currentMediaItem?.metadata?.camera || 'Unknown Camera',
        coordinates: coordinates,
        description: currentMediaItem?.description,
        user_name: currentMediaItem?.user_name,
        user_profile: currentMediaItem?.user_profile,
        rotation_angle: currentMediaItem?.rotation_angle || 0
      }));
      
      // Update highlighted image
      if (onHighlightedImageChange && nextImage.id) {
        onHighlightedImageChange(nextImage.id);
      }
    }
  };

  const handlePrevImage = () => {
    if (imageViewer.currentIndex > 0) {
      const prevIndex = imageViewer.currentIndex - 1;
      const prevImage = imageViewer.images[prevIndex];
      
      // Find the actual media item to get its location and metadata
      const currentMediaItem = filteredItems.find(item => item.id === prevImage.id || item.thumbnail === prevImage.src);
      
      // Extract location data from the media item
      let locationAddress: string | undefined;
      let coordinates: { lat: number; lng: number } | undefined;
      
      if (currentMediaItem?.location) {
        if (typeof currentMediaItem.location === 'string') {
          locationAddress = currentMediaItem.location;
        } else {
          if (currentMediaItem.location.city || currentMediaItem.location.country) {
            locationAddress = `${currentMediaItem.location.city || ''}${currentMediaItem.location.city && currentMediaItem.location.country ? ', ' : ''}${currentMediaItem.location.country || ''}`;
          }
          coordinates = currentMediaItem.location.coordinates;
        }
      }
      
      setImageViewer(prev => ({
        ...prev,
        src: prevImage.src,
        alt: prevImage.alt,
        title: prevImage.title,
        subtitle: prevImage.subtitle,
        currentIndex: prevIndex,
        imageId: prevImage.id,
        location: locationAddress || currentMediaItem?.metadata?.location,
        dateTaken: currentMediaItem?.metadata?.captureDate || currentMediaItem?.date || new Date().toISOString(),
        camera: currentMediaItem?.metadata?.camera || 'Unknown Camera',
        coordinates: coordinates,
        description: currentMediaItem?.description,
        user_name: currentMediaItem?.user_name,
        user_profile: currentMediaItem?.user_profile,
        rotation_angle: currentMediaItem?.rotation_angle || 0
      }));
      
      // Update highlighted image
      if (onHighlightedImageChange && prevImage.id) {
        onHighlightedImageChange(prevImage.id);
      }
    }
  };

  const handleToggleImageSelection = (imageId?: string) => {
    if (imageId) {
      const item = filteredItems.find(item => item.id === imageId);
      if (item) {
        handleToggleSelect(item);
      }
    }
  };

  const handleFilesUpload = async (files: File[]) => {
    // Silently remove any non-image files (videos, etc.) before upload starts
    files = files.filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    console.log('🟢🟢🟢 MediaPage handleFilesUpload called with files:', files.length);
    console.log('🟢 THIS IS THE CORRECT PARALLEL UPLOAD WITH 2-STEP METADATA EXTRACTION');
    console.log('🟢 Starting PARALLEL upload with progress tracking');

    // Create upload progress items
    const newUploadItems: UploadProgressItem[] = files.map((file, index) => ({
      id: generateFileId(),
      fileName: file.name,
      fileType: file.type,
      progress: 0,
      status: 'uploading' as const,
      name: file.name,
      size: formatFileSize(file.size),
      position: index + 1,
      originalFile: file
    }));

    setLocalUploadProgress(prev => [...prev, ...newUploadItems]);

    try {
      // Upload all files in parallel using Promise.all
      const startTime = Date.now();
      const uploadedIds: string[] = [];
      console.log('⚡⚡⚡ PARALLEL UPLOAD START - All files will start NOW:', new Date().toISOString());
      console.log(`⚡ Total files to upload in parallel: ${newUploadItems.length}`);

      // Concurrency-capped at 5 in flight, matching the BATCH_SIZE already used by
      // AddMomentModal/CreateMemory. Each item makes several sequential API calls,
      // so an unbounded fan-out here is a large multiple of the file count.
      await mapLimit(
        newUploadItems,
        async (item, i) => {
          const fileStartTime = Date.now();
          console.log(`🚀🚀🚀 [${fileStartTime - startTime}ms] File ${i + 1} STARTED: ${item.name}`);

          try {
            // Update progress to show upload starting
            setLocalUploadProgress(prev => prev.map(upload =>
              upload.id === item.id ? { ...upload, progress: 10 } : upload
            ));

            // Step 1: Extract metadata from image using uploadImageWithMetadata API
            console.log(`🔍 Step 1: Extracting metadata for ${item.name}`);

            const metadataResponse = await dashboardAPI.uploadImageWithMetadata(
              item.originalFile,
              item.name
            );

            console.log(`🔍 FULL METADATA RESPONSE for ${item.name}:`, {
              success: metadataResponse.success,
              hasData: !!metadataResponse.data,
              fullResponse: metadataResponse,
              dataKeys: metadataResponse.data ? Object.keys(metadataResponse.data) : 'No data object'
            });

            let location = '';
            let captureDate = '';

            if (metadataResponse.success && metadataResponse.data) {
              console.log(`🔍 EXTRACTING METADATA for ${item.name}:`);
              console.log(`🔍 metadataResponse.data:`, metadataResponse.data);

              // Handle nested data structure like AddMomentModal does
              const responseData = metadataResponse.data?.data || metadataResponse.data;
              console.log(`🔍 responseData (actual metadata):`, responseData);
              console.log(`🔍 responseData.location:`, responseData.location);
              console.log(`🔍 responseData.capture_date:`, responseData.capture_date);
              console.log(`🔍 typeof responseData.location:`, typeof responseData.location);
              console.log(`🔍 typeof responseData.capture_date:`, typeof responseData.capture_date);

              // Extract location and capture_date from the proper data source
              const rawLocation = responseData.location;
              const rawCaptureDate = responseData.capture_date || responseData.date_taken;

              // Ensure we have strings, not null/undefined
              location = rawLocation !== null && rawLocation !== undefined ? String(rawLocation) : '';
              captureDate = rawCaptureDate !== null && rawCaptureDate !== undefined ? String(rawCaptureDate) : '';

              console.log(`🔍 AFTER EXTRACTION:`);
              console.log(`🔍 extracted location:`, location);
              console.log(`🔍 extracted captureDate:`, captureDate);
              console.log(`🔍 typeof extracted location:`, typeof location);
              console.log(`🔍 typeof extracted captureDate:`, typeof captureDate);

              console.log(`✅ Metadata extracted for ${item.name}:`, {
                rawResponse: metadataResponse.data,
                actualData: responseData,
                location: location,
                captureDate: captureDate,
                locationIsEmpty: location === '',
                captureDateIsEmpty: captureDate === ''
              });
            } else {
              console.warn(`⚠️ Failed to extract metadata for ${item.name}:`, metadataResponse.error);
              // Continue with empty metadata
            }

            // Update progress after metadata extraction
            setLocalUploadProgress(prev => prev.map(upload =>
              upload.id === item.id ? { ...upload, progress: 50 } : upload
            ));

            // Step 2: Upload the photo with extracted metadata using the second API
            console.log(`🚀 Step 2: Uploading ${item.name} with metadata`);
            console.log(`🔧 DETAILED PARAMETER DEBUGGING:`);
            console.log(`🔧 location variable:`, location);
            console.log(`🔧 captureDate variable:`, captureDate);
            console.log(`🔧 typeof location:`, typeof location);
            console.log(`🔧 typeof captureDate:`, typeof captureDate);
            console.log(`🔧 location === undefined:`, location === undefined);
            console.log(`🔧 captureDate === undefined:`, captureDate === undefined);
            console.log(`🔧 location === null:`, location === null);
            console.log(`🔧 captureDate === null:`, captureDate === null);
            console.log(`🔧 location === '':`, location === '');
            console.log(`🔧 captureDate === '':`, captureDate === '');
            console.log(`🔧 JSON.stringify(location):`, JSON.stringify(location));
            console.log(`🔧 JSON.stringify(captureDate):`, JSON.stringify(captureDate));

            console.log(`🔧 FINAL CHECK BEFORE API CALL:`);
            console.log(`🔧 Calling uploadPhotosFromMediaWithOutMemory with:`);
            console.log(`🔧   file:`, item.originalFile);
            console.log(`🔧   name:`, item.name);
            console.log(`🔧   location:`, location);
            console.log(`🔧   captureDate:`, captureDate);
            console.log(`🔧   typeof location:`, typeof location);
            console.log(`🔧   typeof captureDate:`, typeof captureDate);
            console.log(`🔧   location.length:`, location?.length);
            console.log(`🔧   captureDate.length:`, captureDate?.length);

            const uploadResponse = await dashboardAPI.uploadPhotosFromMediaWithOutMemory(
              item.originalFile,
              item.name,
              location,
              captureDate
            );

            if (uploadResponse.success) {
              const fileEndTime = Date.now();
              console.log(`✅✅✅ [${fileEndTime - startTime}ms] File ${i + 1} COMPLETED: ${item.name}`);
              console.log(`✅ Successfully uploaded ${item.name}:`, uploadResponse.data);

              // Collect the uploaded item ID for auto-selection
              if (uploadResponse.data?.id) {
                uploadedIds.push(String(uploadResponse.data.id));
              }

              // Update progress to 100%
              setLocalUploadProgress(prev => prev.map(upload =>
                upload.id === item.id ? { ...upload, progress: 100 } : upload
              ));

              // Create local media item for immediate UI feedback
              const newItem: MediaItem = {
                id: uploadResponse.data?.id || `upload-${Date.now()}-${i}`,
                name: item.name,
                thumbnail: URL.createObjectURL(item.originalFile),
                date: captureDate || new Date().toISOString(),
                size: item.size,
                type: item.originalFile.type.startsWith('video/') ? 'video' : 'image',
                dimensions: item.originalFile.type.startsWith('video/') ? '1920×1080' : '4032×3024',
                metadata: {
                  camera: 'Uploaded Device',
                  dimensions: item.originalFile.type.startsWith('video/') ? '1920×1080' : '4032×3024',
                  location: location || undefined,
                  captureDate: captureDate || undefined
                }
              };

              setUploadedItems(prev => [newItem, ...prev]);

              // Mark as complete
              setLocalUploadProgress(prev => prev.map(upload =>
                upload.id === item.id ? { ...upload, status: 'complete' } : upload
              ));

              // Show success toast for each uploaded file
              toast.success(`Successfully uploaded ${item.name}${location ? ` from ${location}` : ''}`);

            } else {
              console.error(`❌ Upload failed for ${item.name}:`, uploadResponse.error);
              setLocalUploadProgress(prev => prev.map(upload =>
                upload.id === item.id
                  ? { ...upload, status: 'error', error: uploadResponse.error || 'Upload failed' }
                  : upload
              ));

              // Show error toast
              toast.error(`Failed to upload ${item.name}: ${uploadResponse.error || 'Unknown error'}`);
            }
          } catch (error) {
            console.error(`Upload error for ${item.name}:`, error);
            setLocalUploadProgress(prev => prev.map(upload =>
              upload.id === item.id
                ? { ...upload, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
                : upload
            ));

            // Show error toast
            toast.error(`Failed to upload ${item.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        },
        uploadLimit
      );

      console.log('✅ All parallel uploads completed');

      // Trigger memory counts refresh after successful uploads
      await triggerMemoryCountsRefresh();

      // Clear completed uploads after a delay
      setTimeout(() => {
        setLocalUploadProgress(prev => prev.filter(item => item.status !== 'complete'));
      }, 3000);

      // Force refresh of media page data
      try {
        // Clear current state to force fresh data load
        setApiMediaItems([]);
        setUploadedItems([]);

        // Set pending auto-select BEFORE reload so the useEffect intercepts it
        if (uploadedIds.length > 0) {
          pendingAutoSelectRef.current = uploadedIds;
        }

        // Reload entire media page and sidebar
        await reloadMediaPageAndSidebar();
      } catch (error) {
        console.error('Error refreshing media data:', error);
      }

    } catch (error) {
      console.error('❌ Upload process error:', error);
    }
  };



  // Bulk action handlers
  const handleMoveToCategory = (itemIds: string[], categoryName: string) => {
    setMediaItems(prev => prev.map(item => {
      if (itemIds.includes(item.id)) {
        return {
          ...item,
          category: categoryName,
          memory: undefined // Clear memory association when moving to a different category
        };
      }
      return item;
    }));
  };

  const handleDeleteItems = async (itemIds: string[]) => {
    try {
      console.log('🔍 handleDeleteItems called with:', itemIds);
      console.log('🔍 Current activeServiceTab:', activeServiceTab);

      // Convert string IDs to numbers for the API
      const imageIds = itemIds.map(id => parseInt(id)).filter(id => !isNaN(id));

      if (imageIds.length === 0) {
        console.error('Invalid image IDs for deletion:', itemIds);
        alert('Unable to delete images: Invalid data format');
        return;
      }

      // Check if we're deleting synced media from a connected service (e.g., Dropbox)
      const isDeletingSyncedMedia = activeServiceTab !== 'all';
      console.log('🔍 isDeletingSyncedMedia:', isDeletingSyncedMedia);

      if (isDeletingSyncedMedia) {
        console.log('🗑️ Deleting synced media from service:', activeServiceTab, 'Media IDs:', imageIds);
        console.log('🗑️ Calling servicesAPI.deleteSyncedMediaBatch...');

        // Call the synced media delete API
        const response = await servicesAPI.deleteSyncedMediaBatch(imageIds);

        if (response?.success) {
          // Remove items from synced media state
          setServiceSyncedMedia(prev => {
            const updatedMedia = { ...prev };
            if (updatedMedia[activeServiceTab]) {
              const mediaArray = Array.isArray(updatedMedia[activeServiceTab])
                ? updatedMedia[activeServiceTab]
                : (updatedMedia[activeServiceTab]?.media || updatedMedia[activeServiceTab]?.items || updatedMedia[activeServiceTab]?.data || []);

              const filteredMedia = mediaArray.filter((item: any) => !itemIds.includes(item.id?.toString()));
              updatedMedia[activeServiceTab] = filteredMedia;
            }
            return updatedMedia;
          });

          console.log(`✅ Successfully deleted ${imageIds.length} synced media items`);
          toast.success(`Successfully deleted ${imageIds.length} item${imageIds.length !== 1 ? 's' : ''}!`);

          // Clear selection
          handleClearSelection();

          // Refresh synced media data
          fetchSyncedMedia(activeServiceTab);
        } else {
          console.error('❌ Failed to delete synced media:', response?.error);
          toast.error(`Failed to delete items: ${response?.error || 'Unknown error'}`);
        }
      } else {
        console.log('🗑️ Deleting regular images:', imageIds);

        // Call the regular delete API for uploaded media
        const response = await mediaAPI.deleteImages(imageIds);

        if (response?.success) {
          // Trigger memory counts refresh since deleting images may affect counts
          await triggerMemoryCountsRefresh();

          // Remove items from local state
          setMediaItems(prev => prev.filter(item => !itemIds.includes(item.id)));
          setUploadedItems(prev => prev.filter(item => !itemIds.includes(item.id)));

          console.log(`✅ Successfully deleted ${imageIds.length} images`);
          toast.success(`Successfully deleted ${imageIds.length} image${imageIds.length !== 1 ? 's' : ''}!`);

          // Clear selection
          handleClearSelection();

          // Reload entire media page and sidebar to ensure consistency
          await reloadMediaPageAndSidebar();
        } else {
          console.error('❌ Failed to delete images:', response?.error);
          toast.error(`Failed to delete images: ${response?.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('❌ Error deleting items:', error);
      toast.error('Failed to delete items. Please try again.');
    }
  };

  const handleClearSelection = () => {
    // Clear local state
    setSelectedItems(new Set());
    onNewMediaPending?.([]);
    
    // Clear external selection state if handler exists
    if (onClearSelection) {
      onClearSelection();
    }
  };

  const handleDownloadItems = async (itemIds: string[]) => {
    const selectedItemsData = filteredItems.filter(item => itemIds.includes(item.id));
    if (selectedItemsData.length === 0) return;

    const fetchImageAsUint8 = async (item: MediaItem): Promise<{ uint8: Uint8Array; filename: string }> => {
      const cleanUrl = item.thumbnail.replace(/['"]/g, '').trim();
      const res = await fetch(cleanUrl, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) throw new Error(`Failed to download ${item.name}`);
      const buffer = await res.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const ext = cleanUrl.split('?')[0].split('.').pop() || 'jpg';
      const base = item.name || `image_${item.id}`;
      const filename = base.includes('.') ? base : `${base}.${ext}`;
      return { uint8, filename };
    };

    if (selectedItemsData.length === 1) {
      const item = selectedItemsData[0];
      toast.info('Downloading image...');
      try {
        const { uint8, filename } = await fetchImageAsUint8(item);
        const mimeType = item.thumbnail.toLowerCase().includes('.png') ? 'image/png' : item.thumbnail.toLowerCase().includes('.gif') ? 'image/gif' : 'image/jpeg';
        const blob = new Blob([uint8], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Download complete');
      } catch (err) {
        console.error('Download error:', err);
        toast.error('Failed to download image');
      }
    } else {
      toast.info(`Preparing ZIP of ${selectedItemsData.length} images...`);
      try {
        const zip = new JSZip();
        const usedNames = new Map<string, number>();
        await Promise.all(
          selectedItemsData.map(async (item) => {
            const { uint8, filename: rawFilename } = await fetchImageAsUint8(item);
            let filename = rawFilename;
            const count = usedNames.get(rawFilename) ?? 0;
            if (count > 0) {
              const dotIdx = filename.lastIndexOf('.');
              filename = dotIdx > -1
                ? `${filename.slice(0, dotIdx)}_${count}${filename.slice(dotIdx)}`
                : `${filename}_${count}`;
            }
            usedNames.set(rawFilename, count + 1);
            zip.file(filename, uint8);
          })
        );
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        const rawName = (() => { try { return JSON.parse(localStorage.getItem('stasht_user') || '{}')?.name || ''; } catch { return ''; } })();
        const safeName = rawName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'selected-media';
        a.download = `${safeName}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${selectedItemsData.length} images as ZIP`);
      } catch (err) {
        console.error('ZIP download error:', err);
        toast.error('Failed to create ZIP download');
      }
    }
  };

  const handleShareItems = (itemIds: string[]) => {
    const selectedItemsData = filteredItems.filter(item => itemIds.includes(item.id));
    console.log('Sharing items:', selectedItemsData);
    
    // In a real app, this would open a share dialog
    toast.info(`Preparing to share ${selectedItemsData.length} item${selectedItemsData.length !== 1 ? 's' : ''}...`);
  };

  const handleArchiveItems = (itemIds: string[]) => {
    setMediaItems(prev => prev.map(item => {
      if (itemIds.includes(item.id)) {
        return {
          ...item,
          archived: true,
          category: 'Archived'
        };
      }
      return item;
    }));
    
    console.log('Archived items:', itemIds);
    toast.success(`Archived ${itemIds.length} item${itemIds.length !== 1 ? 's' : ''}`);
  };

  const handleAddToMemory = async (
    itemIds: string[],
    memoryIds?: string[],
    memoryTitles?: string[],
    category?: string
  ) => {
    const selectedItemsData = filteredItems.filter(item => itemIds.includes(item.id));

    if (memoryIds && memoryIds.length > 0) {
      // Add items to existing memory/memories via API
      try {
        const imageIds = itemIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        const targetMemoryIds = memoryIds.map(id => parseInt(id)).filter(id => !isNaN(id));

        if (imageIds.length === 0 || targetMemoryIds.length === 0) {
          console.error('Invalid image IDs or memory IDs:', { imageIds, targetMemoryIds });
          alert('Unable to move images: Invalid data format');
          return;
        }

        console.log('🚀 Moving images to memories:', { image_ids: imageIds, target_memory_ids: targetMemoryIds });

        const response = await mediaAPI.moveImagesToMemory({
          image_ids: imageIds,
          target_memory_ids: targetMemoryIds
        });

        if (response?.success) {
          // Update local state to reflect the change (use first selected memory for display)
          const firstMemory = existingMemories.find(m => memoryIds!.includes(m.id));
          setMediaItems(prev => prev.map(item => {
            if (itemIds.includes(item.id) && firstMemory) {
              return {
                ...item,
                memory: { id: firstMemory.id, title: firstMemory.title, category: firstMemory.category },
                category: firstMemory.category
              };
            }
            return item;
          }));

          // Update each selected memory's image count
          setMediaMemories(prev => prev.map(memory => {
            if (memoryIds!.includes(memory.id)) {
              return {
                ...memory,
                imageCount: memory.imageCount + selectedItemsData.length,
                images: [
                  ...memory.images,
                  ...selectedItemsData.map(item => ({
                    id: item.id,
                    name: item.name,
                    thumbnail: item.thumbnail,
                    date: new Date().toISOString(),
                    size: '2.0 MB',
                    type: item.type,
                    dimensions: '4032×3024'
                  }))
                ]
              };
            }
            return memory;
          }));

          console.log(`✅ Successfully moved ${selectedItemsData.length} images to memories:`, memoryIds);

          // Show success toast
          toast.success(`Successfully moved ${selectedItemsData.length} image${selectedItemsData.length !== 1 ? 's' : ''} to campaign!`);

          // Refresh existing memories list to update counts
          await fetchExistingMemories();

          // Reload entire media page and sidebar to get updated state from server
          await reloadMediaPageAndSidebar();
        } else {
          console.error('❌ Failed to move images to memory:', response?.error);
          alert(`Failed to move images to campaign: ${response?.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('❌ Error moving images to memory:', error);
        alert('Failed to move images to campaign. Please try again.');
      }
      
    } else if (memoryTitles?.[0] && category) {
      // Check memory limit before creating new memory
      if (isLimitExceeded) {
        toast.error('Campaign limit exceeded. Please upgrade your plan or delete some campaigns before creating new ones.');
        return;
      }
      
      // Create new memory with selected images via API
      try {
        const imageIds = itemIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        
        if (imageIds.length === 0) {
          console.error('Invalid image IDs:', itemIds);
          alert('Unable to create campaign: Invalid image data format');
          return;
        }

        // Check if category contains ID in format "name:id" (from API) or just name (from prop)
        let categoryId;
        let categoryName = category;
        
        if (category.includes(':')) {
          // Category from API dialog contains "name:id" format
          const [name, id] = category.split(':');
          categoryName = name;
          categoryId = parseInt(id);
          console.log('🔍 Using API category ID:', { name: categoryName, id: categoryId });
        } else {
          // Fallback to finding in categories prop
          const categoryData = categories.find(cat => cat.name === category);
          categoryId = categoryData?.id ? parseInt(categoryData.id) : 1;
          console.log('🔍 Using prop category ID:', { name: categoryName, id: categoryId, categoryData });
        }
        
        if (!categoryId || isNaN(categoryId)) {
          console.error('Invalid category ID for category:', category, { categoryName, categoryId });
          alert('Unable to create campaign: Invalid category');
          return;
        }

        console.log('🚀 Creating new memory with images:', { 
          title: memoryTitles?.[0], 
          category_id: categoryId, 
          image_ids: imageIds 
        });
        
        const response = await mediaAPI.createMemoryWithSelectedImages({
          title: memoryTitles?.[0],
          category_id: categoryId,
          image_ids: imageIds
        });

        if (response?.success) {
          // Create new memory object for local state
          const newMemoryId = response.data?.id || `mem_${Date.now()}`;
          const newMemory = {
            id: newMemoryId,
            title: memoryTitles?.[0],
            category: categoryName,
            thumbnail: selectedItemsData[0]?.thumbnail || '',
            imageCount: selectedItemsData.length,
            date: new Date().toISOString().split('T')[0],
            type: 'personal' as const,
            isExpanded: true,
            images: selectedItemsData.map(item => ({
              id: item.id,
              name: item.name,
              thumbnail: item.thumbnail,
              date: new Date().toISOString(),
              size: '2.0 MB', // Default size
              type: item.type,
              dimensions: '4032×3024' // Default dimensions
            }))
          };

          // Add new memory to the list
          setMediaMemories(prev => [newMemory, ...prev]);

          // Update items to belong to the new memory
          setMediaItems(prev => prev.map(item => {
            if (itemIds.includes(item.id)) {
              return {
                ...item,
                memory: {
                  id: newMemory.id,
                  title: newMemory.title,
                  category: categoryName
                },
                category: categoryName
              };
            }
            return item;
          }));

          console.log(`✅ Successfully created new memory "${memoryTitles?.[0]}" with ${selectedItemsData.length} images`);

          // Trigger memory counts refresh
          await triggerMemoryCountsRefresh();

          // Show success toast
          toast.success(`Successfully created "${memoryTitles?.[0]}" campaign with ${selectedItemsData.length} image${selectedItemsData.length !== 1 ? 's' : ''}!`);

          // Refresh existing memories list so the new memory appears in the modal
          await fetchExistingMemories();

          // Reload entire media page and sidebar to get updated state from server
          await reloadMediaPageAndSidebar();
        } else {
          console.error('❌ Failed to create memory with images:', response?.error);
          alert(`Failed to create campaign: ${response?.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('❌ Error creating memory with images:', error);
        alert('Failed to create campaign. Please try again.');
      }
    }

    // Clear selection after successful operation
    handleClearSelection();
  };

  const hasSelectedItems = selectedItems.size > 0;
  const selectedItemsArray = Array.from(selectedItems);
  const availableCategories = categories.map(cat => cat.name);

  // Keyboard shortcuts for bulk actions
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (selectedItems.size === 0) return;
      
      // Only handle shortcuts when not typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (event.key) {
        case 'Delete':
        case 'Backspace':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            handleDeleteItems(selectedItemsArray);
          }
          break;
        case 'd':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            handleDownloadItems(selectedItemsArray);
          }
          break;
        case 'Escape':
          event.preventDefault();
          handleClearSelection();
          break;
        case 'a':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            handleSelectAll();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems.size, selectedItemsArray, handleDeleteItems, handleDownloadItems, handleClearSelection, handleSelectAll]);

  const handleOpenAddToMoment = () => {
    setAddToMomentSelectedParentId(null);
    setExpandedMemories(new Set());
    setExpandedImageIds(new Set());
    setShowAddToMomentModal(true);
  };

  const handleToggleMemory = async (memoryId: string) => {
    const isExpanded = expandedMemories.has(memoryId);
    if (isExpanded) {
      setExpandedMemories(prev => { const s = new Set(prev); s.delete(memoryId); return s; });
      return;
    }
    setExpandedMemories(prev => new Set(prev).add(memoryId));
    if (memoryImagesMap[memoryId]) return; // already loaded
    setLoadingMemoryIds(prev => new Set(prev).add(memoryId));
    try {
      const response = await dashboardAPI.getMemoryDetails(memoryId);
      if (response.success && response.data) {
        // Same parsing logic as MemoryDetailsPage
        const rawData = response.data.data || response.data;
        const memoryData = rawData?.memory || rawData;
        const posts = memoryData?.posts || rawData?.posts || [];
        setMemoryImagesMap(prev => ({ ...prev, [memoryId]: posts }));
      } else {
        toast.error('Failed to load memory images');
      }
    } catch {
      toast.error('Failed to load memory images');
    } finally {
      setLoadingMemoryIds(prev => { const s = new Set(prev); s.delete(memoryId); return s; });
    }
  };

  const handleAddToMomentSubmit = async () => {
    if (!addToMomentSelectedParentId) return;
    setAddToMomentSubmitting(true);
    try {
      const token = localStorage.getItem('stasht_token');
      const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api/react' : `${window.location.origin}/api/react`);
      const res = await fetch(`${apiBase}/memory-images/set-sub-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          image_ids: selectedItemsArray.map(id => parseInt(id)),
          parent_image_id: parseInt(addToMomentSelectedParentId)
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Added to moment successfully');
        setShowAddToMomentModal(false);
        handleClearSelection();
        await reloadMediaPageAndSidebar();
      } else {
        toast.error(data.error || 'Failed to add to moment');
      }
    } catch {
      toast.error('Failed to add to moment');
    } finally {
      setAddToMomentSubmitting(false);
    }
  };

  return (
    <div className="w-full relative -mt-6">
      {/* Black Overlay for Dropbox Sync - Covers media sidebar and content area only (not main left sidebar), only during first 10 seconds */}
      {isDropboxSyncing && !isDropboxMinimized && (
        <div className="fixed top-20 left-0 md:left-[20rem] right-0 bottom-0 bg-black/50 z-[9998]" />
      )}

      {/* Image Viewer Modal */}
      <ImageViewer
        isOpen={imageViewer.isOpen}
        onClose={handleCloseImageViewer}
        storyTags={Array.from(new Set(mediaItems.flatMap(item => item.tags || []).map((t: any) => typeof t === 'string' ? t : t?.name).filter(Boolean)))}
        imageSrc={imageViewer.src}
        imageAlt={imageViewer.alt}
        title={imageViewer.title}
        subtitle={imageViewer.subtitle}
        filename={imageViewer.alt} // Use alt as filename since it often contains the filename
        dateTaken={imageViewer.dateTaken}
        location={imageViewer.location}
        description={imageViewer.description}
        user_name={imageViewer.user_name}
        user_profile={imageViewer.user_profile}
        coverContentOnly={true}
        images={imageViewer.images}
        currentImageIndex={imageViewer.currentIndex}
        onNextImage={handleNextImage}
        onPrevImage={handlePrevImage}
        isSelected={imageViewer.imageId ? selectedItems.has(imageViewer.imageId) : false}
        onToggleSelection={handleToggleImageSelection}
        imageId={imageViewer.imageId}
        initialRotation={imageViewer.rotation_angle}
        initialTags={imageViewer.tags}
        mediumSize={true}
        locationData={{
          address: imageViewer.location || undefined,
          exifData: {
            dateTaken: imageViewer.dateTaken || new Date().toISOString(),
            camera: imageViewer.camera || 'Unknown Camera',
            coordinates: imageViewer.coordinates
          }
        }}
        onEditLocation={() => {
          console.log('Edit location clicked for image:', imageViewer.imageId);
          // TODO: Implement location editing functionality
        }}
        onRefreshData={() => {
          console.log('Refreshing page data after location update');
          // Store current image viewer state
          const currentImageId = imageViewer.imageId;
          const currentImageSrc = imageViewer.src;

          // Reload entire media page and sidebar
          reloadMediaPageAndSidebar();

          // After a short delay, reopen the modal with the same image
          setTimeout(() => {
            if (currentImageId && currentImageSrc) {
              // Find the updated image and reopen the modal
              const currentMediaItem = filteredItems.find(item =>
                item.id === currentImageId ||
                (item.type === 'image' && item.src === currentImageSrc)
              );

              if (currentMediaItem) {
                handleMediaClick(currentMediaItem, currentImageId);
              }
            }
          }, 1000); // Wait for data refresh to complete
        }}
        onCommentCountChange={handleCommentCountChange}
      />

      {/* Upload Progress - Screenshot Style */}
      {localUploadProgress.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-start justify-end pt-20 pr-6">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setLocalUploadProgress([])} />
          <div className="relative bg-white rounded-lg shadow-lg w-96 max-w-[90vw]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-900">
                    {localUploadProgress.every(item => item.status === 'complete') ? 'Upload Successful!' : 'Uploading Files...'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {localUploadProgress.filter(item => item.status === 'complete').length} files added to Unassigned
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLocalUploadProgress([])}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            {/* Files List */}   
            <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
              <div className="text-sm font-medium text-gray-700 mb-3">Files:</div>
              {localUploadProgress.map((upload) => (
                <div key={upload.id} className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-4 h-4 flex-shrink-0">
                    {upload.fileType?.startsWith('image/') ? (
                      <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                    )}
                  </div>
                  <span className="flex-1 truncate">{upload.fileName}</span>
                  {upload.status === 'complete' && (
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {upload.status === 'uploading' && (
                    <svg className="w-4 h-4 text-[#6C60FF] animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {upload.status === 'error' && (
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              ))}
              {localUploadProgress.length > 3 && (
                <div className="text-sm text-gray-500 italic">
                  +{localUploadProgress.length - 3} more files...
                </div>
              )}
            </div>
            
            {/* Progress Bar */}
            <div className="px-4 pb-4">
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-[#6C60FF] transition-all duration-300 ease-out"
                  style={{
                    width: `${Math.round((localUploadProgress.filter(item => item.status === 'complete').length / Math.max(localUploadProgress.length, 1)) * 100)}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Tabs - Moved to top */}
      {(connectedServices.length > 0 || isLoadingServices) && (
        <div className="w-full border-b border-gray-200 bg-white mb-0" style={{ maxWidth: '96vw', overflowX: 'clip' }}>
          <div className="flex items-center gap-2 md:gap-3 px-3 md:px-0 py-2 md:py-0 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* All Media Tab */}
          <button
            onClick={() => {
              // Only switch if not already on this tab
              if (activeServiceTab !== 'all') {
                console.log('🔄 Switching to All Media tab...');
                onServiceTabChange?.('all');
              }
            }}
            className={`flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 md:py-3 whitespace-nowrap transition-all border-b-2 flex-shrink-0 ${
              activeServiceTab === 'all'
                ? 'border-[#6C60FF] text-[#6C60FF]'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <svg className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <div className="flex flex-col items-start">
              <span className="font-semibold text-xs md:text-sm">{connectedServices.length > 0 ? 'All Media' : 'Media'}</span>
              <span className="text-[10px] md:text-xs text-gray-500">{allMediaCount} items</span>
            </div>
          </button>

          {/* Connected Service Tabs */}
          {isLoadingServices ? (
            <div className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 md:py-3 flex-shrink-0">
              <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs md:text-sm text-gray-500">Loading...</span>
            </div>
          ) : (
            connectedServices
              .filter(service => !hiddenServices.has(service.id?.toString() || service.service_type || service.type))
              .map((service) => {
              // Use service_type from API response
              const serviceType = service.service_type || service.type;
              const serviceId = service.id?.toString() || serviceType;

              // Format service name nicely
              let serviceName = service.name || serviceType || 'Unknown Service';
              if (!service.name && serviceType) {
                // Capitalize and format service type
                serviceName = serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
                if (serviceType === 'dropbox') serviceName = 'Dropbox';
                if (serviceType === 'icloud' || serviceType === 'icloud_photos') serviceName = 'iCloud Photos';
                if (serviceType === 'google_photos' || serviceType === 'google') serviceName = 'Google Photos';
                if (serviceType === 'facebook') serviceName = 'Facebook';
              }

              const serviceIcon = getServiceIcon(serviceType);

              // Get item count from synced media or from service object
              let itemCount = 0;
              if (serviceSyncedMedia[serviceId]) {
                const syncedData = serviceSyncedMedia[serviceId];
                if (Array.isArray(syncedData)) {
                  itemCount = syncedData.length;
                } else if (syncedData?.length) {
                  itemCount = syncedData.length;
                } else if (syncedData?.media?.length) {
                  itemCount = syncedData.media.length;
                } else if (syncedData?.items?.length) {
                  itemCount = syncedData.items.length;
                }
              } else if (service.synced_count !== undefined) {
                itemCount = service.synced_count;
              } else if (service.media_count !== undefined) {
                itemCount = service.media_count;
              } else if (service.item_count !== undefined) {
                itemCount = service.item_count;
              } else if (service.count !== undefined) {
                itemCount = service.count;
              }

              console.log('🔍 Rendering service tab:', { serviceId, serviceName, serviceType, itemCount, service });

              // Check if this tab is active (match by either serviceId or serviceType)
              const isActiveTab = activeServiceTab === serviceId || activeServiceTab === serviceType;
              const isHovered = hoveredServiceTab === serviceId;

              return (
                <div
                  key={serviceId}
                  className="relative group"
                  onMouseEnter={() => setHoveredServiceTab(serviceId)}
                  onMouseLeave={() => setHoveredServiceTab(null)}
                >
                  <button
                    disabled={serviceType === 'dropbox' && showDropboxProgress}
                    onClick={async () => {
                      console.log('🔍 Service tab clicked:', { serviceId, serviceType });

                      // Skip if already on this tab
                      if (isActiveTab) {
                        console.log('⏭️ Already on this tab, skipping reload');
                        return;
                      }

                      // Handle Dropbox tab with 4-hour check
                      if (serviceType === 'dropbox') {
                        console.log('═══════════════════════════════════════════════════');
                        console.log('🔄 DROPBOX TAB CLICKED - CHECKING SYNC REQUIREMENTS');
                        console.log('═══════════════════════════════════════════════════');

                        // Check if last_sync is older than 4 hours
                        const needsResync = isLastSyncOlderThan(service.last_sync, 4);

                        console.log('⏰ SYNC CHECK DETAILS:');
                        console.log('  └─ service.last_sync:', service.last_sync);
                        console.log('  └─ needsResync:', needsResync);
                        console.log('  └─ threshold:', '4 hours');
                        console.log('═══════════════════════════════════════════════════');

                        if (needsResync) {
                          // Execute full resync flow (4 sequential APIs)
                          // DON'T switch to Dropbox tab yet - progress callback will switch to Media tab
                          console.log('🔴 LAST SYNC > 4 HOURS - EXECUTING FULL RESYNC FLOW');
                          console.log('  ⚠️  NOT switching to Dropbox tab yet');
                          console.log('  ⚠️  Progress callback will switch to Media tab after 30s');
                          console.log('  ⚠️  "View Result" button will switch to Dropbox tab when done');
                          console.log('📋 WILL CALL 4 APIS:');
                          console.log('  1️⃣  /services/resync-dropbox-paths');
                          console.log('  2️⃣  /services/get-dropbox-media-ids');
                          console.log('  3️⃣  /services/get-fresh-media-urls');
                          console.log('  4️⃣  /services/synced-media');
                          console.log('═══════════════════════════════════════════════════');
                          await handleDropboxResyncFlow(serviceId);
                        } else {
                          // Direct load of page 1 with overlay loader - NO OTHER APIS
                          // Switch to Dropbox tab immediately since no resync needed
                          console.log('🟢 LAST SYNC < 4 HOURS - LOADING DIRECTLY');
                          console.log('  ✅ Switching to Dropbox tab immediately');
                          onServiceTabChange?.(serviceId);
                          console.log('📋 WILL CALL ONLY 1 API:');
                          console.log('  ✅ /services/synced-media (page 1)');
                          console.log('  ❌ Will NOT call resync-dropbox-paths');
                          console.log('  ❌ Will NOT call get-dropbox-media-ids');
                          console.log('  ❌ Will NOT call get-fresh-media-urls');
                          console.log('═══════════════════════════════════════════════════');

                          // Clear cache and fetch fresh data
                          setServiceSyncedMedia(prev => {
                            const newData = { ...prev };
                            delete newData[serviceId];
                            return newData;
                          });

                          setIsDropboxSyncing(true);
                          setSyncingService('dropbox'); // Track that Dropbox is syncing
                          try {
                            console.log('📞 CALLING: getSyncedMedia(dropbox, 1)...');
                            await fetchSyncedMedia(serviceType, serviceId, 1, true);
                            console.log('✅ COMPLETED: getSyncedMedia(dropbox, 1)');
                            console.log('═══════════════════════════════════════════════════');
                            console.log('✅ DROPBOX MEDIA LOADED SUCCESSFULLY');
                            console.log('✅ Pagination state updated by fetchSyncedMedia');
                            console.log('═══════════════════════════════════════════════════');
                          } catch (error) {
                            console.error('❌ Error loading Dropbox page 1:', error);
                            toast.error('Failed to load Dropbox media');
                          } finally {
                            setIsDropboxSyncing(false);
                            setSyncingService(null); // Clear syncing service tracker
                          }
                        }
                      } else if (serviceType === 'facebook') {
                        // Handle Facebook tab with 24-hour (1 day) check
                        console.log('═══════════════════════════════════════════════════');
                        console.log('🔵 FACEBOOK TAB CLICKED - CHECKING AUTH REQUIREMENTS');
                        console.log('═══════════════════════════════════════════════════');

                        // Check if last_sync is older than 24 hours (1 day)
                        const needsReauth = isLastSyncOlderThan(service.last_sync, 24);

                        console.log('⏰ AUTH CHECK DETAILS:');
                        console.log('  └─ service.last_sync:', service.last_sync);
                        console.log('  └─ needsReauth:', needsReauth);
                        console.log('  └─ threshold:', '24 hours (1 day)');
                        console.log('═══════════════════════════════════════════════════');

                        if (needsReauth) {
                          // Re-authenticate with Facebook OAuth
                          console.log('🔴 LAST SYNC > 24 HOURS - RE-AUTHENTICATION REQUIRED');
                          console.log('  ⚠️  Redirecting to Facebook OAuth...');
                          console.log('  ⚠️  User will re-authorize Facebook access');
                          console.log('  ⚠️  After auth, will redirect back to /media page');
                          console.log('═══════════════════════════════════════════════════');

                          // Get Facebook OAuth URL and redirect
                          const facebookAuthUrl = getFacebookAuthUrl('facebook_photos_sync');

                          toast.info('Facebook authentication expired. Redirecting to re-authorize...');

                          // Redirect to Facebook OAuth (same flow as initial connection)
                          setTimeout(() => {
                            window.location.href = facebookAuthUrl;
                          }, 1000);

                        } else {
                          // Direct load - no re-authentication needed
                          console.log('🟢 LAST SYNC < 24 HOURS - LOADING DIRECTLY');
                          console.log('  ✅ Switching to Facebook tab immediately');
                          onServiceTabChange?.(serviceId);
                          console.log('📋 WILL CALL ONLY 1 API:');
                          console.log('  ✅ /services/synced-media (facebook)');
                          console.log('  ❌ Will NOT trigger re-authentication');
                          console.log('═══════════════════════════════════════════════════');

                          // Clear cache for this service
                          setServiceSyncedMedia(prev => {
                            const newData = { ...prev };
                            delete newData[serviceId];
                            return newData;
                          });

                          // Fetch fresh data
                          try {
                            await fetchSyncedMedia(serviceType, serviceId);
                            console.log('✅ Facebook media loaded successfully');
                            console.log('═══════════════════════════════════════════════════');
                          } catch (error) {
                            console.error('❌ Error loading Facebook data:', error);
                            toast.error('Failed to load Facebook media');
                          }
                        }
                      } else {
                        // For other non-Dropbox, non-Facebook services, clear cache and fetch fresh data
                        console.log('🔄 Other service clicked, fetching fresh data...');
                        onServiceTabChange?.(serviceId);

                        // Clear cache for this service
                        setServiceSyncedMedia(prev => {
                          const newData = { ...prev };
                          delete newData[serviceId];
                          return newData;
                        });

                        // Fetch fresh data
                        try {
                          await fetchSyncedMedia(serviceType, serviceId);
                          console.log(`✅ Fresh data loaded for ${serviceName}`);
                        } catch (error) {
                          console.error(`❌ Error loading ${serviceName} data:`, error);
                          toast.error(`Failed to load ${serviceName} media`);
                        }
                      }
                    }}
                    className={`flex items-center gap-2 md:gap-4 px-2.5 md:px-4 py-2 md:py-3.5 pr-7 md:pr-12 whitespace-nowrap transition-all rounded-lg md:rounded-xl flex-shrink-0 ${
                      serviceType === 'dropbox' && showDropboxProgress
                        ? 'text-gray-400 cursor-not-allowed opacity-50'
                        : isActiveTab
                        ? 'bg-gray-50 text-gray-900 border-2 border-gray-400'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-transparent'
                    }`}
                  >
                    <div className="flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4 md:[&>svg]:w-5 md:[&>svg]:h-5">{serviceIcon}</div>
                    <div className="flex flex-col items-start gap-0 md:gap-0.5">
                      <div className="flex items-center gap-1 md:gap-1.5">
                        <span className="font-medium text-xs md:text-sm">{serviceName}</span>
                        {service.status === 'connected' && (
                          <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-[#34D399] flex items-center justify-center">
                            <Check className="w-2 h-2 md:w-2.5 md:h-2.5 text-white" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] md:text-xs text-gray-500">
                        {itemCount} items
                      </span>
                    </div>
                  </button>

                  {/* Disconnect icon - Visible on tab hover */}
                  {service.status === 'connected' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setServiceToDisconnect({
                          id: serviceType, // Use service type (google, facebook, dropbox) not numeric ID
                          name: serviceName,
                          itemCount: itemCount
                        });
                        setDisconnectModalOpen(true);
                      }}
                      className="ml-2 p-1.5 rounded-md transition-all hover:bg-red-50 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 absolute right-3 top-1/2 -translate-y-1/2"
                      title="Disconnect service"
                    >
                      <Unplug className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
        </div>
      )}

      {/* Page Header */}
      <div className="sticky top-20 relative bg-white z-10 pb-2 pt-2 flex sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 px-0 md:px-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
              Media
            </h1>
            <p className="hidden sm:block text-sm sm:text-base text-gray-600 mt-1 line-clamp-1">
              Upload, organize, and manage your photos and videos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
          {/* Pagination Controls - Show only for service tabs */}
          {activeServiceTab !== 'all' && activeServiceTab && dropboxTotalPages > 1 && (
            <div className="flex items-center justify-end gap-3 flex-wrap">
              {/* Prev/Next with Page Numbers */}
              <div className="flex items-center gap-1.5">
                {/* Prev Button */}
                <button
                  onClick={() => {
                    const service = connectedServices.find(s => s.id?.toString() === activeServiceTab);
                    if (service && dropboxCurrentPage > 1) {
                      handleDropboxPageChange(activeServiceTab, service.service_type || service.type, dropboxCurrentPage - 1);
                    }
                  }}
                  disabled={dropboxCurrentPage <= 1 || isDropboxSyncing}
                  className={`px-2.5 py-1.5 flex items-center gap-1 rounded-lg border text-sm font-medium transition-all ${
                    dropboxCurrentPage <= 1 || isDropboxSyncing
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                      : 'border-gray-300 text-gray-700 hover:border-[#6C60FF] hover:text-[#6C60FF] hover:bg-[#6C60FF]/5'
                  }`}
                  title="Previous page"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">Prev</span>
                </button>

                {/* Page Number Buttons */}
                <div className="flex items-center gap-1">
                  {getPageNumbers().map((page, index) => {
                    if (page === '...') {
                      return (
                        <span key={`ellipsis-${index}`} className="px-2 py-1 text-gray-400 text-sm">
                          ...
                        </span>
                      );
                    }

                    const pageNum = page as number;
                    const isActive = pageNum === dropboxCurrentPage;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => {
                          if (!isActive && !isDropboxSyncing) {
                            const service = connectedServices.find(s => s.id?.toString() === activeServiceTab);
                            if (service) {
                              handleDropboxPageChange(activeServiceTab, service.service_type || service.type, pageNum);
                            }
                          }
                        }}
                        disabled={isActive || isDropboxSyncing}
                        className={`min-w-[32px] h-8 px-2 flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-[#6C60FF] text-white border border-[#6C60FF] shadow-sm'
                            : isDropboxSyncing
                            ? 'border border-gray-200 text-gray-300 cursor-not-allowed'
                            : 'border border-gray-300 text-gray-700 hover:border-[#6C60FF] hover:text-[#6C60FF] hover:bg-[#6C60FF]/5'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => {
                    const service = connectedServices.find(s => s.id?.toString() === activeServiceTab);
                    if (service && dropboxCurrentPage < dropboxTotalPages) {
                      handleDropboxPageChange(activeServiceTab, service.service_type || service.type, dropboxCurrentPage + 1);
                    }
                  }}
                  disabled={dropboxCurrentPage >= dropboxTotalPages || isDropboxSyncing}
                  className={`px-2.5 py-1.5 flex items-center gap-1 rounded-lg border text-sm font-medium transition-all ${
                    dropboxCurrentPage >= dropboxTotalPages || isDropboxSyncing
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                      : 'border-gray-300 text-gray-700 hover:border-[#6C60FF] hover:text-[#6C60FF] hover:bg-[#6C60FF]/5'
                  }`}
                  title="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Separator */}
              <div className="hidden sm:block w-px h-6 bg-gray-300"></div>

              {/* Jump to Page Input */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 hidden sm:inline">Jump to:</span>
                <input
                  type="text"
                  value={jumpToPageInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Only allow numbers
                    if (value === '' || /^\d+$/.test(value)) {
                      setJumpToPageInput(value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleJumpToPage();
                    }
                  }}
                  placeholder="Page"
                  disabled={isDropboxSyncing}
                  className="w-16 px-2 py-1.5 text-sm text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleJumpToPage}
                  disabled={!jumpToPageInput || isDropboxSyncing}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                    !jumpToPageInput || isDropboxSyncing
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-[#6C60FF] text-white hover:bg-[#5850E5] active:scale-95'
                  }`}
                >
                  Go
                </button>
              </div>

              {/* Page Info */}
              <div className="hidden lg:flex items-center gap-1 px-2 py-1 text-xs text-gray-500">
                <span>of</span>
                <span className="font-semibold text-gray-700">{dropboxTotalPages}</span>
                <span>pages</span>
              </div>
            </div>
          )}

          {/* Grid/List View Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#6C60FF] text-white'
                  : 'text-gray-600 hover:text-[#6C60FF] hover:bg-[#6C60FF]/10'
              }`}
              title="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-[#6C60FF] text-white'
                  : 'text-gray-600 hover:text-[#6C60FF] hover:bg-[#6C60FF]/10'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,image/bmp,image/tiff,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.bmp,.tiff"
            onChange={(e) => {
              const allFiles = Array.from(e.target.files || []);
              const files = allFiles.filter(f => f.type.startsWith('image/'));
              if (files.length > 0) {
                handleFilesUpload(files);
              }
            }}
            className="hidden"
            id="header-upload"
            style={{ display: 'none' }}
          />
          <div className="relative hidden sm:block">
            <Button
              ref={syncButtonRef}
              variant="outline"
              onClick={() => setShowSyncDialog(!showSyncDialog)}
              className="border-gray-300 hover:bg-gray-50 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden md:inline">Sync</span>
            </Button>

            {/* Sync Dropdown */}
            <SyncMediaDialog
              isOpen={showSyncDialog}
              onClose={() => setShowSyncDialog(false)}
              anchorRef={syncButtonRef}
              isDropboxSyncing={isDropboxSyncing || dropboxSyncProgress > 0}
              hiddenServices={hiddenServices}
              onToggleServiceVisibility={toggleServiceVisibility}
              onDisconnect={(serviceId, serviceName, itemCount) => {
                setServiceToDisconnect({ id: serviceId, name: serviceName, itemCount });
                setDisconnectModalOpen(true);
              }}
              onSync={async (serviceId) => {
                console.log('Syncing service:', serviceId);
                toast.info(`Syncing ${serviceId}...`);
              }}
              onSyncAll={async () => {
                console.log('Syncing all services');
                toast.info('Syncing all services...');
              }}
            />
          </div>

          <label htmlFor="header-upload" className="cursor-pointer">
            <Button
              className="bg-[#6C60FF] hover:bg-[#5951E6] text-white cursor-pointer"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                const fileInput = document.getElementById('header-upload') as HTMLInputElement;
                if (fileInput) {
                  fileInput.click();
                }
              }}
            >
              <Upload className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Upload Files</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          </label>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white rounded-lg border border-gray-200 mx-0 my-4 lg:my-0 lg:mx-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search media files, campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-50 border-gray-200 focus:border-gray-300 focus:ring-0"
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-48 bg-gray-50 border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Sort by Date
              </div>
            </SelectItem>
            <SelectItem value="name">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Sort by Name
              </div>
            </SelectItem>
            <SelectItem value="size">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                Sort by Size
              </div>
            </SelectItem>
            <SelectItem value="location">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Sort by Location
              </div>
            </SelectItem>
            <SelectItem value="memory">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Sort by Campaign
              </div>
            </SelectItem>
            <SelectItem value="upload_latest">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Uploaded Date (Latest)
              </div>
            </SelectItem>
            <SelectItem value="upload_oldest">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Uploaded Date (Oldest)
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="border-gray-200 hover:bg-gray-50 flex-shrink-0"
        >
          {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
        </Button>

        {filteredItems.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleSelectAll} className="hidden sm:inline-flex border-gray-200 hover:bg-gray-50">
            {selectedItems.size === filteredItems.length ? 'Deselect All' : 'Select All'}
          </Button>
        )}
        </div>
      </div>

      {/* Batch Actions - Show when items are selected */}
      {hasSelectedItems && (
        <div className="sticky top-20 z-30 bg-gray-50">
          <BatchActions
            selectedItems={selectedItemsArray}
            allItems={filteredItems}
            onSelectionChange={(items) => {
              // Update local state
              setSelectedItems(new Set(items));
              
              // Also update external selection state if handlers exist
              if (items.length === 0) {
                // Clear all selections
                if (onClearSelection) {
                  onClearSelection();
                }
              } else if (onMediaItemSelect) {
                // Update external selection for each item
                // First clear existing selections
                if (onClearSelection) {
                  onClearSelection();
                }
                // Then set new selections
                items.forEach(itemId => {
                  onMediaItemSelect(itemId, true);
                });
              }
            }}
            onDeleteItems={handleDeleteItems}
            onMoveItems={handleMoveToCategory}
            onAddToMemory={handleAddToMemory}
            availableCategories={availableCategories}
            memories={existingMemories}
            onRefresh={reloadMediaPageAndSidebar}
            onAddToMoment={handleOpenAddToMoment}
            onDownload={handleDownloadItems}
          />
        </div>
      )}

      {/* Content Area with Overlay Loader */}
      <div className="relative">
        {/* Content Area */}
        {(isLoadingMediaData || (activeServiceTab !== 'all' && isLoadingSyncedMedia && !isDropboxSyncing)) ? (
        <div className="border border-gray-200 rounded-xl p-12 text-center bg-white">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {activeServiceTab !== 'all' ? 'Loading Synced Media' : 'Loading Media'}
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {activeServiceTab !== 'all'
              ? 'Fetching media from connected service...'
              : 'Fetching your media files from the server...'}
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        activeServiceTab !== 'all' ? (
          <div className="border border-gray-200 rounded-xl p-12 text-center bg-white">
            <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Media Found
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              No synced media found from this service. Try syncing your media to see content here.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={async () => {
                  const service = connectedServices.find(s => {
                    const serviceId = s.id?.toString();
                    const serviceType = s.service_type || s.type;
                    return serviceId === activeServiceTab || serviceType === activeServiceTab;
                  });

                  const serviceType = service?.service_type || service?.type || '';

                  // Google Photos: re-trigger picker flow
                  // Also check via connectedServices lookup in case service wasn't found by tab id
                  const isGooglePhotos = serviceType === 'google' ||
                    serviceType === 'google_photos' ||
                    serviceType?.toLowerCase().includes('google') ||
                    connectedServices.some(s =>
                      s.id?.toString() === activeServiceTab &&
                      (s.service_type || s.type)?.toLowerCase()?.includes('google')
                    );
                  if (isGooglePhotos) {
                    const goToOAuth = () => {
                      const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
                      const redirectUri = import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI;
                      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
                      authUrl.searchParams.append('client_id', clientId);
                      authUrl.searchParams.append('redirect_uri', redirectUri);
                      authUrl.searchParams.append('response_type', 'token');
                      authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly');
                      authUrl.searchParams.append('state', 'photos_from_media_sync');
                      authUrl.searchParams.append('include_granted_scopes', 'true');
                      authUrl.searchParams.append('prompt', 'consent');
                      window.location.href = authUrl.toString();
                    };

                    const accessToken = sessionStorage.getItem('google_access_token');
                    if (accessToken) {
                      const result = await openGooglePhotosPicker((importResult) => {
                        if (importResult && importResult.success) {
                          sessionStorage.setItem('activeServiceTab', 'all');
                          sessionStorage.setItem('service_just_connected', 'true');
                          window.location.reload();
                        }
                      });
                      if (result?.popupBlocked) {
                        toast.error('Popup was blocked. Please allow popups and try again.');
                      } else if (result?.needsAuth) {
                        goToOAuth();
                      }
                    } else {
                      goToOAuth();
                    }
                    return;
                  }

                  // Other services: regular refresh
                  if (!service) return;
                  console.log('🔍 Refresh button clicked - fetching synced media');
                  fetchSyncedMedia(serviceType, activeServiceTab);
                }}
                className="border-gray-300 hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Synced Media
              </Button>
            </div>
          </div>
        ) : isPropertyOwner ? (
          <MainUploadArea onFilesUpload={handleFilesUpload} />
        ) : (
          <div className="border border-gray-200 rounded-xl p-12 text-center bg-white">
            <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Media Found
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              This property has no media yet.
            </p>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {/* Stats */}
          <div className="flex sm:flex-row items-start sm:items-center justify-between text-xs sm:text-sm text-gray-600 gap-2 sm:gap-0 px-0 md:px-4 md:py-2 bg-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4"> 
              <span>
                {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
                {searchQuery && ` matching "${searchQuery}"`}
              </span>
              <span className="text-xs bg-white border border-gray-300 px-2 py-1 rounded whitespace-nowrap">
                Sorted by {sortBy} ({sortOrder === 'asc' ? 'asc' : 'desc'})
              </span>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
              <span className="hidden sm:inline">
                {filteredItems.filter(item => item.memory).length} with campaigns
              </span>
              <span className="whitespace-nowrap">
                Total: {calculateTotalSize(filteredItems)} MB
              </span>
            </div>
          </div>

          {/* Media Grid/List */}
          {viewMode === 'grid' ? (
            <div className="bg-white grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mx-0 md:mx-4">
              {filteredItems.map((item) => (
                <MediaGridItem
                  key={item.id}
                  item={item}
                  isSelected={selectedItems.has(item.id)}
                  onToggleSelect={handleToggleSelect}
                  onView={handleView}
                  onViewImage={handleViewImage}
                  categories={categories}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-2 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-2 md:gap-4">
                    {/* Selection checkbox */}
                    <div
                      className="w-8 h-8 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 cursor-pointer"
                      style={{
                        backgroundColor: selectedItems.has(item.id) ? '#0075FF' : 'white',
                        borderColor: selectedItems.has(item.id) ? '#0075FF' : '#d1d5db',
                      }}
                      onClick={() => handleToggleSelect(item)}
                    >
                      {selectedItems.has(item.id) && (
                        <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                          <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    
                    {/* Thumbnail */}
                    <div className="relative w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      <ImageWithFallback
                        src={item.thumbnail}
                        alt={item.name}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => {
                          console.log('🔥 List view image clicked:', item);
                          handleViewImage(
                            item.thumbnail, 
                            item.name, 
                            item.name, 
                            `${item.size} • ${new Date(item.date).toLocaleDateString()}`,
                            item.id
                          );
                        }}
                        fallback={
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center cursor-pointer">
                            <ImageIcon className="w-6 h-6 text-gray-400" />
                          </div>
                        }
                      />
                      {item.type === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-black/70 text-white p-1 rounded">
                            <Play className="w-3 h-3" />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium text-gray-900 truncate">{item.name}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-gray-500">{item.size}</span>
                            {item.dimensions && (
                              <>
                                <span className="text-xs text-gray-300">•</span>
                                <span className="text-xs text-gray-500">{item.dimensions}</span>
                              </>
                            )}
                            {getLocationDisplay(item.location) && (
                              <>
                                <span className="text-xs text-gray-300">•</span>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {getLocationDisplay(item.location)}
                                </span>
                              </>
                            )}
                            <span className="text-xs text-gray-300">•</span>
                            <span className="text-xs text-gray-500">
                              {(item as any).captureDate ? new Date((item as any).captureDate).toLocaleDateString() : new Date(item.date).toLocaleDateString()}
                            </span>
                          </div>
                          
                          {/* Memory/Category info */}
                          <div className="flex items-center gap-2 mt-2">
                            {item.memory ? (
                              <Badge
                                className="text-xs text-white"
                                style={{ backgroundColor: getCategoryColor(item.memory.category || 'Uncategorized') }}
                              >
                                <FolderOpen className="w-3 h-3 mr-1" />
                                {item.memory.category} • {item.memory.title}
                              </Badge>
                            ) : item.category === 'Unassigned' ? (
                              <Badge variant="secondary" className="text-xs">
                                Unassigned
                              </Badge>
                            ) : null}
                            
                            {item.type === 'video' && (
                              <Badge variant="outline" className="text-xs">
                                <Play className="w-3 h-3 mr-1" />
                                Video
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-1 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleViewImage(
                              item.thumbnail, 
                              item.name, 
                              item.name, 
                              `${item.size} • ${new Date(item.date).toLocaleDateString()}`,
                              item.id
                            )}
                          >
                            <ImageIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleDownloadItems([item.id])}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleShareItems([item.id])}
                          >
                            <Share className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Load More / Infinite Scroll Indicator */}
          {activeServiceTab !== 'all' && servicePagination[activeServiceTab]?.hasMore && (
            <div className="flex justify-center items-center py-8">
              {isLoadingMoreMedia ? (
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-2 border-[#6C60FF] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-600">Loading more items...</span>
                </div>
              ) : (
                <Button
                  onClick={() => {
                    const service = connectedServices.find(s => s.id?.toString() === activeServiceTab);
                    if (service) {
                      loadMoreSyncedMedia(service.service_type || service.type, activeServiceTab);
                    }
                  }}
                  variant="outline"
                  className="border-[#6C60FF] text-[#6C60FF] hover:bg-[#6C60FF] hover:text-white"
                >
                  Load More ({servicePagination[activeServiceTab]?.currentPage || 1} / {servicePagination[activeServiceTab]?.lastPage || 1})
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      </div>

      {/* Mobile Sidebar Drawer */}
      {showMobileSidebar && (
        <div className="fixed top-12 left-0 right-0 bottom-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={onCloseMobileSidebar}
          />

          {/* Sidebar Drawer */}
          <aside className="absolute left-0 top-8 bottom-0 w-80 bg-white shadow-xl overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Media Library</h2>
              <button
                onClick={onCloseMobileSidebar}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* MediaNav Content */}
            <div className="p-4">
              <MediaNav
                isStacked={false}
                onToggleExpansion={() => {}}
                canToggle={false}
                onFilterChange={(categories) => {
                  if (onFilterChange) {
                    onFilterChange(categories);
                  }
                  if (onCloseMobileSidebar) onCloseMobileSidebar();
                }}
                expandedCategories={expandedCategories}
                selectedCategory={selectedCategory}
                onCategorySelect={(categoryName) => {
                  if (onCategorySelect) {
                    onCategorySelect(categoryName);
                  }
                  if (onCloseMobileSidebar) onCloseMobileSidebar();
                }}
                mediaMemories={mediaMemories}
                onMediaMemoriesChange={onMediaMemoriesChange}
                unassignedImages={unassignedImages}
                onUnassignedImagesChange={onUnassignedImagesChange}
                showUnassignedImages={showUnassignedImages}
                onUnassignedToggle={onUnassignedToggle}
                categories={categories}
                selectedMediaItems={selectedMediaItems}
                onMediaItemSelect={onMediaItemSelect}
                apiMediaNavData={apiMediaNavData}
                onUploadStateChange={onUploadStateChange}
                onUploadProgressChange={onUploadProgressChange}
                highlightedImageId={imageViewer.imageId}
                onMemorySelect={(memoryId) => {
                  if (onMemorySelect) {
                    onMemorySelect(memoryId);
                  }
                  if (onCloseMobileSidebar) onCloseMobileSidebar();
                }}
                onImageClick={handleViewImage}
                apiMemoriesData={apiMemoriesData}
                onCategoriesUpdate={onCategoriesUpdate}
                onFetchMediaData={onFetchMediaData}
                activeServiceTab={activeServiceTab}
                serviceSyncedMedia={serviceSyncedMedia}
                connectedServices={connectedServices}
                onCategoryRenamed={onCategoryRenamed}
                dropboxSyncProgress={dropboxSyncProgress}
                showDropboxProgress={showDropboxProgress}
                onViewDropboxResult={handleViewDropboxResult}
                onFilesUpload={handleFilesUpload}
              />
            </div>
          </aside>
        </div>
      )}

      {/* Dropbox Syncing Progress Notification */}
      {isDropboxSyncing && (
        <div
          className={`fixed z-[9999] transition-all duration-500 ease-in-out ${
            isDropboxMinimized
              ? 'bottom-4 left-4 w-72'
              : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96'
          }`}
        >
            <div className="bg-white rounded-xl shadow-2xl p-6 border border-gray-100">
              {/* Header with Service Icon and Title */}
              <div className="flex items-center gap-3 mb-4">
                {/* Service Icon - Dynamic based on which service is actually syncing */}
                {syncingService === 'facebook' ? (
                  <div className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                ) : syncingService === 'google' || syncingService === 'google_photos' ? (
                  <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 26 26" fill="none">
                      <path d="M3.90002 12.9998H10.92C11.477 12.9988 12.0108 12.7767 12.4042 12.3823L8.45003 8.31982L3.90002 12.9998Z" fill="#FFC400"/>
                      <path d="M12.4041 12.3823C12.7873 11.9921 13.0013 11.4667 13 10.9198V8.31982H8.44995L12.4041 12.3823Z" fill="#FFA300"/>
                      <path d="M22.1 13H15.08C14.523 13.001 13.9892 13.2231 13.5958 13.6175L17.55 17.68L22.1 13Z" fill="#0089FF"/>
                      <path d="M13.5958 13.6177C13.2127 14.0079 12.9986 14.5333 13 15.0802V17.6802H17.55L13.5958 13.6177Z" fill="#0069E4"/>
                      <path d="M13 3.8999V10.9199C13.001 11.4769 13.2231 12.0107 13.6175 12.4041L17.68 8.4499L13 3.8999Z" fill="#FF4834"/>
                      <path d="M13.6176 12.4044C14.0078 12.7875 14.5332 13.0016 15.0801 13.0002H17.6801V8.4502L13.6176 12.4044Z" fill="#FF025F"/>
                      <path d="M12.9999 22.0999V15.0799C12.9989 14.5229 12.7768 13.9891 12.3824 13.5957L8.31995 17.5499L12.9999 22.0999Z" fill="#00C800"/>
                      <path d="M12.3824 13.5958C11.9922 13.2127 11.4668 12.9986 10.9199 13H8.31995V17.55L12.3824 13.5958Z" fill="#00A44C"/>
                    </svg>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#0061FF] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z"/>
                    </svg>
                  </div>
                )}

                {/* Title and Percentage */}
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900">
                    Syncing {syncingService === 'facebook' ? 'Facebook' :
                             syncingService === 'google' || syncingService === 'google_photos' ? 'Google Photos' :
                             syncingService === 'dropbox' ? 'Dropbox' : 'Media'} {dropboxSyncPercentage > 0 && `(${Math.round(dropboxSyncPercentage)}%)`}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Importing your media...
                  </p>
                </div>
              </div>

              {/* Progress Bar - Dynamic color based on service */}
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ease-out ${
                    syncingService === 'facebook' ? 'bg-[#1877F2]' :
                    syncingService === 'google' || syncingService === 'google_photos' ? 'bg-[#4285F4]' :
                    'bg-[#0061FF]'
                  }`}
                  style={{ width: `${dropboxSyncPercentage}%` }}
                ></div>
              </div>

              {/* Percentage Text */}
              <div className="mt-2 text-right">
                <span className="text-sm font-medium text-gray-600">
                  {Math.round(dropboxSyncPercentage)}%
                </span>
              </div>
            </div>
          </div>
      )}

      {/* Disconnect Service Confirmation Modal */}
      <DisconnectServiceModal
        isOpen={disconnectModalOpen}
        onClose={() => {
          if (!isDisconnecting) {
            setDisconnectModalOpen(false);
            setServiceToDisconnect(null);
          }
        }}
        onConfirm={async () => {
          if (!serviceToDisconnect) return;

          setIsDisconnecting(true);
          try {
            // Get user ID from localStorage
            const userData = localStorage.getItem('stasht_user');
            if (!userData) {
              toast.error('User not logged in');
              return;
            }

            const user = JSON.parse(userData);
            const userId = user.id;

            console.log('🔌 Disconnecting service:', {
              userId,
              serviceName: serviceToDisconnect.id
            });

            // Call disconnect API
            const response = await dashboardAPI.disconnectService(userId, serviceToDisconnect.id);

            if (response.success) {
              toast.success(`${serviceToDisconnect.name} disconnected successfully`);

              // Close modal
              setDisconnectModalOpen(false);
              const disconnectedId = serviceToDisconnect.id;
              setServiceToDisconnect(null);

              // If on the disconnected service tab, switch to "all" tab first
              // activeServiceTab may be numeric DB id ('5') while disconnectedId is service name ('google')
              const isOnDisconnectedTab = activeServiceTab === disconnectedId ||
                connectedServices.some(s =>
                  s.id?.toString() === activeServiceTab &&
                  (s.service_type || s.type) === disconnectedId
                );
              if (isOnDisconnectedTab) {
                onServiceTabChange?.('all');
              }

              // Refresh connected services
              const servicesResponse = await dashboardAPI.getConnectedServices();
              if (servicesResponse.success) {
                const services = servicesResponse.data?.services || servicesResponse.services || [];
                setConnectedServices(services);
                onConnectedServicesChange?.(services);
              }

              // Fully reload media page and sidebar to clear removed service media
              await reloadMediaPageAndSidebar();
            } else {
              toast.error(response.error || 'Failed to disconnect service');
            }
          } catch (error) {
            console.error('❌ Error disconnecting service:', error);
            toast.error('An error occurred while disconnecting');
          } finally {
            setIsDisconnecting(false);
          }
        }}
        serviceName={serviceToDisconnect?.name || ''}
        itemCount={serviceToDisconnect?.itemCount || 0}
        isDisconnecting={isDisconnecting}
      />

      {/* Add to Moment — Hierarchy Modal */}
      {showAddToMomentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddToMomentModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Add to Moment</h2>
              <button onClick={() => setShowAddToMomentModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Hierarchy Body */}
            <div className="overflow-y-auto flex-1 py-2">
              {existingMemories.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">No campaigns found</div>
              ) : (
                existingMemories.map((mem: any) => {
                  const memId = String(mem.id || mem.memory_id);
                  const isMemExpanded = expandedMemories.has(memId);
                  const isLoadingMem = loadingMemoryIds.has(memId);
                  const allPosts: any[] = memoryImagesMap[memId] || [];
                  // parent_id can be null, 0, or "0" from raw API — all mean "no parent"
                  const isParent = (p: any) => !p.parent_id || p.parent_id === 0 || p.parent_id === '0';
                  const parentPosts = allPosts.filter(isParent);

                  return (
                    <div key={memId} className="border-b border-gray-100 last:border-0">
                      {/* Memory row */}
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                        onClick={() => handleToggleMemory(memId)}
                      >
                        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isMemExpanded ? '' : '-rotate-90'}`} />
                        {mem.thumbnail ? (
                          <img src={mem.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gray-200 flex-shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-gray-800 truncate">{mem.title || mem.name || 'Untitled Campaign'}</span>
                        {isLoadingMem && <div className="ml-auto w-4 h-4 border-2 border-[#6C60FF] border-t-transparent rounded-full animate-spin flex-shrink-0" />}
                      </button>

                      {/* Memory images */}
                      {isMemExpanded && !isLoadingMem && (
                        parentPosts.length === 0 ? (
                          <p className="pl-14 pr-4 py-2 text-xs text-gray-400">No images in this campaign</p>
                        ) : (
                          parentPosts.map((post: any) => {
                            const postId = String(post.id);
                            const isPostExpanded = expandedImageIds.has(postId);
                            const subImages = allPosts.filter((p: any) => !isParent(p) && String(p.parent_id) === postId);
                            const isChosen = addToMomentSelectedParentId === postId;

                            return (
                              <div key={postId}>
                                {/* Parent image row */}
                                <div className="flex items-center gap-2 pl-10 pr-4 py-2 hover:bg-gray-50 transition-colors">
                                  {/* Expand sub-images toggle */}
                                  {subImages.length > 0 ? (
                                    <button
                                      onClick={() => setExpandedImageIds(prev => {
                                        const s = new Set(prev);
                                        s.has(postId) ? s.delete(postId) : s.add(postId);
                                        return s;
                                      })}
                                      className="p-0.5"
                                    >
                                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isPostExpanded ? '' : '-rotate-90'}`} />
                                    </button>
                                  ) : (
                                    <span className="w-5 flex-shrink-0" />
                                  )}
                                  {/* Select radio */}
                                  <button
                                    className="flex items-center gap-2.5 flex-1 text-left"
                                    onClick={() => setAddToMomentSelectedParentId(isChosen ? null : postId)}
                                  >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isChosen ? 'border-[#6C60FF] bg-[#6C60FF]' : 'border-gray-300'}`}>
                                      {isChosen && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                    <img
                                      src={post.image_link || post.image || post.photo_url || post.url || ''}
                                      alt=""
                                      className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-gray-100"
                                    />
                                    <span className="text-sm text-gray-700 truncate">{post.title || post.description || post.name || 'Untitled'}</span>
                                    {subImages.length > 0 && (
                                      <span className="text-xs text-gray-400 flex-shrink-0">{subImages.length} sub</span>
                                    )}
                                  </button>
                                </div>

                                {/* Sub-images */}
                                {isPostExpanded && subImages.map((sub: any) => {
                                  const subId = String(sub.id);
                                  const isSubChosen = addToMomentSelectedParentId === subId;
                                  return (
                                    <button
                                      key={subId}
                                      className="w-full flex items-center gap-2.5 pl-16 pr-4 py-2 hover:bg-gray-50 transition-colors text-left"
                                      onClick={() => setAddToMomentSelectedParentId(isSubChosen ? null : subId)}
                                    >
                                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSubChosen ? 'border-[#6C60FF] bg-[#6C60FF]' : 'border-gray-300'}`}>
                                        {isSubChosen && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                      </div>
                                      <img
                                        src={sub.image_link || sub.image || sub.photo_url || sub.url || ''}
                                        alt=""
                                        className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-gray-100"
                                      />
                                      <span className="text-xs text-gray-600 truncate">{sub.title || sub.description || sub.name || 'Untitled'}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })
                        )
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowAddToMomentModal(false)}
                className="flex-1 h-10 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!addToMomentSelectedParentId || addToMomentSubmitting}
                onClick={handleAddToMomentSubmit}
                className={`flex-1 h-10 rounded-lg text-sm font-medium text-white transition-colors ${!addToMomentSelectedParentId || addToMomentSubmitting ? 'bg-[#6C60FF]/40 cursor-not-allowed' : 'bg-[#6C60FF] hover:bg-[#5B52FF]'}`}
              >
                {addToMomentSubmitting ? 'Adding...' : 'Add Moment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}