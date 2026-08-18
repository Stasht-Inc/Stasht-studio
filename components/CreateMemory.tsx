import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Calendar, MapPin, Tag, Users, Plus, Camera, Image as ImageIcon, CheckCircle, Loader2, File as FileIcon, Search, Video, Pencil, Globe, Eye, Lock } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import GooglePlacesInput from './ui/google-places-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import * as Popover from '@radix-ui/react-popover';
import { dashboardAPI, getApiBaseUrl } from '../utils/authUtils';
import exifr from 'exifr';
import { getCategoryColor } from '../constants/mediaConstants';
import { SHOPIFY_COLOR } from '../utils/categoryColorManager';
import { useAuth } from '../contexts/AuthContext';
import { useProperty } from '../contexts/PropertyContext';
import { useMemoryLimit, recheckMemoryLimit } from '../hooks/useMemoryLimit';
import { triggerMemoryCountsRefresh } from '../hooks/useMemoryCounts';
import { MemoryCreatedDialog } from "./MemoryCreatedDialog";
import { MemoryLimitDialog } from "./MemoryLimitDialog";
import { ExifProgressModal } from "./ExifProgressModal";
import MediaLibrarySelectionModal from "./MediaLibrarySelectionModal";
import { AddMomentModal } from "./AddMomentModal";
import { VideoRecorderModal } from "./VideoRecorderModal";
import { useGoogleDrivePicker } from '../hooks/useGoogleDrivePicker';

interface CreateMemoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemoryCreated?: () => void;
  onOpenMediaLibrary?: () => void;
  selectedMediaLibraryImages?: any[];
  defaultCategory?: string; // Default category to pre-select when creating a memory
  categories?: any[]; // Pre-loaded categories from parent (avoids redundant fetch)
}

export interface CreateMemoryHandle {
  focusTitle: () => void;
}

// Detect video URLs (same set the stories cards use)
const isCampaignVideoUrl = (url?: string): boolean => {
  if (!url) return false;
  const exts = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v'];
  const lower = url.toLowerCase();
  return exts.some(ext => lower.includes(ext));
};

// Shows a still frame of a video (no playback) — same approach as the stories cover cards
function CampaignVideoThumbnail({ src, className }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => { setFrameReady(false); }, [src]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        src={`${src}#t=0.1`}
        className={`${className} ${frameReady ? 'opacity-100' : 'opacity-0'}`}
        preload="metadata"
        muted
        playsInline
        onLoadedData={() => {
          if (videoRef.current && videoRef.current.currentTime === 0) videoRef.current.currentTime = 0.1;
          setFrameReady(true);
        }}
        onSeeked={() => setFrameReady(true)}
      />
      {!frameReady && <div className="absolute inset-0 bg-gray-200" />}
    </div>
  );
}

const CreateMemory = forwardRef<CreateMemoryHandle, CreateMemoryProps>(function CreateMemory({ open, onOpenChange, onMemoryCreated, onOpenMediaLibrary, selectedMediaLibraryImages, defaultCategory, categories: categoriesProp }, ref) {
  const { isAuthenticated, user } = useAuth();
  const { viewType, currentProperty } = useProperty();
  const { isLimitExceeded, limitData, checkLimit } = useMemoryLimit();
  const { openDrivePicker, isPickerLoading: isDrivePickerLoading } = useGoogleDrivePicker();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const introVideoInputRef = useRef<HTMLInputElement>(null);
  const [introVideo, setIntroVideo] = useState<File | null>(null);
  const [introVideoUrl, setIntroVideoUrl] = useState<string | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [isAddMomentOpen, setIsAddMomentOpen] = useState(false);
  const [momentFiles, setMomentFiles] = useState<FileList | null>(null);
  const [isVideoRecorderOpen, setIsVideoRecorderOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    focusTitle: () => titleInputRef.current?.focus(),
  }));

  const [currentTag, setCurrentTag] = useState('');
  const [currentCollaborator, setCurrentCollaborator] = useState('');
  const [collaboratorError, setCollaboratorError] = useState('');
  const [collaboratorMethod, setCollaboratorMethod] = useState<'phone' | 'email'>('phone');
  // Live user-search dropdown for the collaborator input (matches AddCollaboratorDialog's search UX)
  const [collaboratorSearchResults, setCollaboratorSearchResults] = useState<any[]>([]);
  const [isSearchingCollaborators, setIsSearchingCollaborators] = useState(false);
  const collaboratorSearchRef = useRef<HTMLDivElement>(null);
  // Editable part of the personalized invite message (the author name prefix is fixed/non-editable)
  const [personalizedMessage, setPersonalizedMessage] = useState('wants to share this with you!');
  // "Set as my default message" — when checked, personalizedMessage is saved as the user's master
  // message (via is_master on the create-campaign call) and pre-fills this box on future opens.
  const [isMasterMessage, setIsMasterMessage] = useState(false);
  // The master message as last fetched from the profile API — restored into the box whenever the
  // checkbox is re-checked, so toggling it off and back on doesn't lose the saved text.
  const [savedMasterMessage, setSavedMasterMessage] = useState('');
  // Width of the author-name prefix, used to indent only the first line of the message textarea
  const personalizedNameRef = useRef<HTMLSpanElement>(null);
  const [personalizedNameWidth, setPersonalizedNameWidth] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Popover and Media Library states
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isMediaLibraryModalOpen, setIsMediaLibraryModalOpen] = useState(false);
  
  // Typing states for black outline
  const [isTypingTitle, setIsTypingTitle] = useState(false);
  const [highlightTitle, setHighlightTitle] = useState(false);
  const [isTypingLocation, setIsTypingLocation] = useState(false);
  const [isTypingTag, setIsTypingTag] = useState(false);
  const [isTypingCollaborator, setIsTypingCollaborator] = useState(false);
  const [isTypingDate, setIsTypingDate] = useState(false);
  const [isTypingEndDate, setIsTypingEndDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);

  // Error state
  const [titleError, setTitleError] = useState<string>('');
  
  // API data state
  const [apiCategories, setApiCategories] = useState<any[]>([]);
  const [apiLabels, setApiLabels] = useState<any[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [apiFrequentCollaborators, setApiFrequentCollaborators] = useState<any[]>([]);
  const [apiRecentCollaborators, setApiRecentCollaborators] = useState<any[]>([]);
  const [apiProperties, setApiProperties] = useState<any[]>([]);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');

  // Success dialog state
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdMemoryDetails, setCreatedMemoryDetails] = useState<{
    title: string;
    category: string;
    location?: string;
  } | null>(null);

  // Limit exceeded dialog state
  const [showLimitDialog, setShowLimitDialog] = useState(false);

  // Photos with metadata state
  const [photosWithMetadata, setPhotosWithMetadata] = useState<Array<{
    file: File;
    name: string;
    location?: string;
    capture_date?: string;
    capture_time?: string;
    fileUrl?: string;
    imageName?: string;
    originalSizeMB?: number;
    metadata_extracted: boolean;
  }>>([]);
  const [isExtractingMetadata, setIsExtractingMetadata] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFilesCount, setUploadedFilesCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<Array<{
    id: string; fileName: string; fileType: string; progress: number; status: 'uploading' | 'complete' | 'error';
  }>>([]);

  // EXIF extraction modal state
  const [showExifModal, setShowExifModal] = useState(false);
  const [exifExtractionResults, setExifExtractionResults] = useState<Array<{
    fileName: string;
    hasDate: boolean;
    hasLocation: boolean;
    isProcessing: boolean;
    isCompleted: boolean;
  }>>([]);

  // Main photos array to store all uploaded photos with metadata
  const [mainPhotosArray, setMainPhotosArray] = useState<Array<{
    name: string;
    location: string;
    capture_date: string;
    capture_time?: string;
    fileUrl?: string;
    imageName?: string;
    originalSizeMB?: number;
    title?: string;
    description?: string;
    tags?: string[];
  }>>([]);

  const [formData, setFormData] = useState({
    title: '',
    category: 'Personal', // Default to Personal
    label: '', // Label (sub_category) ID
    property: [] as string[], // Property IDs (multi-select)
    mediaFiles: [] as File[],
    date: new Date().toISOString().split('T')[0],
    endDate: '',
    location: '',
    tags: [] as string[],
    collaborators: [] as string[]
  });

  // Measure the author-name prefix width whenever it (or the box's visibility) changes,
  // so the first line of the message can be indented past the name.
  useEffect(() => {
    if (personalizedNameRef.current) {
      setPersonalizedNameWidth(personalizedNameRef.current.offsetWidth + 6); // + small gap
    }
  }, [user?.name, formData.collaborators.length]);

  const [deviceLocation, setDeviceLocation] = useState<string>(''); // Store device location

  const [publishPopoverOpen, setPublishPopoverOpen] = useState(false);

  // Select from Existing Campaigns
  const [selectFromExisting, setSelectFromExisting] = useState(false);
  const [existingMemories, setExistingMemories] = useState<any[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memorySearch, setMemorySearch] = useState('');
  const [memoryCategoryFilter, setMemoryCategoryFilter] = useState('All Categories');
  // Controls the live suggestions dropdown under the "Search campaigns" box.
  const [isMemorySearchFocused, setIsMemorySearchFocused] = useState(false);
  const memorySearchBoxRef = useRef<HTMLDivElement>(null);
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);
  // Shopify: when a store is connected we offer a synthetic "Shopify" category.
  // Choosing it turns the "existing campaigns" picker into a list of the store's
  // Shopify collections (from shopifyGetCatalog), all pre-selected.
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [shopifyCollections, setShopifyCollections] = useState<any[]>([]);
  const [shopifyCollectionsLoading, setShopifyCollectionsLoading] = useState(false);
  const wasShopifyCategoryRef = useRef(false);
  // Cars: when the read-only /cars catalog has listings, we offer a synthetic
  // "Cars" category (same idea as Shopify) so a new campaign can be tagged under it.
  const [carsAvailable, setCarsAvailable] = useState(false);
  // Choosing the Cars category turns the "existing campaigns" picker into a list
  // of the /cars catalog listings, all pre-selected — mirrors shopifyCollections.
  const [carsForPicker, setCarsForPicker] = useState<any[]>([]);
  const [carsForPickerLoading, setCarsForPickerLoading] = useState(false);
  const wasCarsCategoryRef = useRef(false);
  // How many campaigns are rendered in the "Select from Existing Campaigns" list —
  // grows as the user scrolls near the bottom (infinite scroll) instead of paging.
  const CAMPAIGNS_LOAD_BATCH = 10;
  const [visibleCampaignsCount, setVisibleCampaignsCount] = useState(CAMPAIGNS_LOAD_BATCH);

  // Add custom scrollbar styles
  useEffect(() => {
    if (!document.getElementById('modal-scrollbar-styles')) {
      const style = document.createElement('style');
      style.id = 'modal-scrollbar-styles';
      style.textContent = `
        .modal-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #9CA3AF #F3F4F6;
        }
        .modal-scrollbar::-webkit-scrollbar {
          width: 8px !important;
        }
        .modal-scrollbar::-webkit-scrollbar-track {
          background: #F3F4F6 !important;
          border-radius: 4px;
        }
        .modal-scrollbar::-webkit-scrollbar-thumb {
          background: #9CA3AF !important;
          border-radius: 4px;
        }
        .modal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6B7280 !important;
        }
        .modal-scrollbar::-webkit-scrollbar-thumb:active {
          background: #4B5563 !important;
        }
        
        /* Date input calendar popup styling */
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          border-radius: 4px;
          margin-left: 8px;
          opacity: 0.6;
          width: 16px;
          height: 16px;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3crect x='3' y='4' width='18' height='18' rx='2' ry='2'%3e%3c/rect%3e%3cline x1='16' y1='2' x2='16' y2='6'%3e%3c/line%3e%3cline x1='8' y1='2' x2='8' y2='6'%3e%3c/line%3e%3cline x1='3' y1='10' x2='21' y2='10'%3e%3c/line%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: center;
          background-size: contain;
        }
        
        input[type="date"]::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23374151' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3crect x='3' y='4' width='18' height='18' rx='2' ry='2'%3e%3c/rect%3e%3cline x1='16' y1='2' x2='16' y2='6'%3e%3c/line%3e%3cline x1='8' y1='2' x2='8' y2='6'%3e%3c/line%3e%3cline x1='3' y1='10' x2='21' y2='10'%3e%3c/line%3e%3c/svg%3e");
        }
        
        input[type="date"]::-webkit-datetime-edit {
          color: #374151;
        }
        input[type="date"]::-webkit-datetime-edit-text {
          color: #6B7280;
        }
        input[type="date"]::-webkit-datetime-edit-month-field,
        input[type="date"]::-webkit-datetime-edit-day-field,
        input[type="date"]::-webkit-datetime-edit-year-field {
          color: #374151;
        }
        
        /* Remove default focus ring from date inputs */
        input[type="date"]:focus {
          outline: none !important;
          box-shadow: none !important;
        }
        
        /* Set purple accent color for calendar popup selection */
        input[type="date"] {
          color-scheme: light;
          accent-color: #7C3AED !important;
        }

        /* Some mobile browsers (Android WebView / Samsung Internet) size the native
           date picker control by its own content instead of respecting the Tailwind
           width classes, so it can render wider than the box above it and overflow
           the screen. Force it to match its container like every other input. */
        input[type="date"] {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        /* Override select trigger focus styles */
        .create-memory-select [data-slot="select-trigger"]:focus-visible {
          border-color: #d1d5db !important;
          box-shadow: 0 0 0 2px rgba(209, 213, 219, 0.5) !important;
        }

        .create-memory-select [data-slot="select-trigger"]:focus {
          border-color: #d1d5db !important;
          box-shadow: 0 0 0 2px rgba(209, 213, 219, 0.5) !important;
        }

        /* Override select content dropdown styles - remove black border */
        .create-memory-select [data-slot="select-content"],
        .create-memory-select [data-radix-select-content],
        .create-memory-select [role="listbox"],
        [data-radix-popper-content-wrapper] [data-slot="select-content"],
        [data-radix-select-content] {
          border: 1px solid #e5e7eb !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          outline: none !important;
        }

        /* Additional targeting for Radix UI select content */
        [data-radix-popper-content-wrapper] {
          border: 1px solid #e5e7eb !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          outline: none !important;
        }
        
        /* Additional styling for webkit browsers to ensure purple selection */
        input[type="date"]::-webkit-inner-spin-button,
        input[type="date"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        /* Force purple selection in calendar popup */
        input[type="date"]:focus,
        input[type="date"]:active {
          accent-color: #7C3AED !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    return () => {
      const existingStyle = document.getElementById('modal-scrollbar-styles');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, [open]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  // Detect device location when modal opens
  useEffect(() => {
    if (open && !deviceLocation) {
      console.log('🌍 Detecting device location...');

      // Check if geolocation is available
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            console.log('📍 Device coordinates:', { latitude, longitude });

            try {
              // Reverse geocode to get location name
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`
              );
              const data = await response.json();

              // Extract city and country
              const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county;
              const country = data.address?.country;

              let locationString = '';
              if (city && country) {
                locationString = `${city}, ${country}`;
              } else if (city) {
                locationString = city;
              } else if (country) {
                locationString = country;
              } else {
                locationString = data.display_name?.split(',').slice(0, 2).join(',').trim() || '';
              }

              console.log('✅ Device location detected:', locationString);
              setDeviceLocation(locationString);

              // Set as default location only if location field is empty
              if (locationString && !formData.location) {
                setFormData(prev => ({ ...prev, location: locationString }));
                console.log('✅ Set default location:', locationString);
              }
            } catch (error) {
              console.error('❌ Error reverse geocoding:', error);
            }

            // Re-focus title input after permission popup closes (keyboard restore)
            setTimeout(() => titleInputRef.current?.focus(), 300);
          },
          (error) => {
            console.log('⚠️ Geolocation error:', error.message);
            // Re-focus title input after permission popup closes (keyboard restore)
            setTimeout(() => titleInputRef.current?.focus(), 300);
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 0
          }
        );
      } else {
        console.log('⚠️ Geolocation not available in this browser');
      }
    }
  }, [open, deviceLocation]);

  // ── Shopify category ──────────────────────────────────────────────────────
  // Sentinel id sent to the backend as category_id when the user picks Shopify.
  // (The backend resolves it; it is not a real category row.) Match on backend.
  const SHOPIFY_CATEGORY_NAME = 'Shopify';
  const SHOPIFY_CATEGORY_ID = 'shopify';
  const isShopifyCategory = formData.category === SHOPIFY_CATEGORY_NAME;
  // Sentinel id sent to the backend as category_id when the user picks Cars.
  // (Mirrors the Shopify sentinel above — not a real category row.)
  const CARS_CATEGORY_NAME = 'Cars';
  const CARS_CATEGORY_ID = 'cars';
  const isCarsCategory = formData.category === CARS_CATEGORY_NAME;
  // The synthetic Shopify/Cars entries are appended only while available, so they
  // appear in the dropdown and are findable at submit for their category_id.
  const categoriesForDropdown = [
    ...apiCategories,
    ...(shopifyConnected ? [{ id: SHOPIFY_CATEGORY_ID, name: SHOPIFY_CATEGORY_NAME, __isShopify: true }] : []),
    ...(carsAvailable ? [{ id: CARS_CATEGORY_ID, name: CARS_CATEGORY_NAME }] : []),
  ];

  // Shared by the "Select from Existing Campaigns" list and its search-suggestions dropdown.
  // "All Categories" merges every source (real campaigns + Cars + Shopify) since those two
  // are pulled from separate catalog APIs, not from the regular campaigns list — without this
  // they'd never show up unless the user filters specifically to "Cars"/picks it as the category.
  const existingCampaignsPickerSource = isShopifyCategory
    ? shopifyCollections
    : (isCarsCategory || memoryCategoryFilter === CARS_CATEGORY_NAME)
    ? carsForPicker
    : memoryCategoryFilter === 'All Categories'
    ? [...existingMemories, ...carsForPicker, ...shopifyCollections]
    : existingMemories;
  const memorySearchSuggestions = memorySearch.trim()
    ? existingCampaignsPickerSource.filter((m: any) => {
        const locStr = typeof m.location === 'string' ? m.location : (m.location?.formatted || m.location?.address || '');
        const matchSearch = (m.title || '').toLowerCase().includes(memorySearch.toLowerCase()) || locStr.toLowerCase().includes(memorySearch.toLowerCase());
        const matchCat = memoryCategoryFilter === 'All Categories' || (m.category?.name || m.category || '') === memoryCategoryFilter;
        return matchSearch && matchCat;
      }).slice(0, 20)
    : [];

  // Detect a connected store when the modal opens, to gate the Shopify option.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await dashboardAPI.shopifyGetStatus();
        if (!cancelled) setShopifyConnected(res?.data?.connected === true);
      } catch { if (!cancelled) setShopifyConnected(false); }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Detect whether the Cars catalog has any listings, to gate the Cars option.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await dashboardAPI.carsGetCatalog();
        const list = res?.data?.data?.cars || (res?.data as any)?.cars || [];
        if (!cancelled) setCarsAvailable(res?.success === true && Array.isArray(list) && list.length > 0);
      } catch { if (!cancelled) setCarsAvailable(false); }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Pull the user's existing campaigns for the "Select from Existing Campaigns" picker.
  const loadExistingMemories = async () => {
    setMemoriesLoading(true);
    try {
      const res = await dashboardAPI.getMemories();
      const actualData = res?.data?.data || res?.data || {};
      const list =
        actualData?.all_memories?.data ||
        (Array.isArray(actualData?.all_memories) ? actualData.all_memories : null) ||
        actualData?.memories ||
        actualData?.user_memories ||
        [];
      setExistingMemories(Array.isArray(list) ? list : []);
    } catch {}
    setMemoriesLoading(false);
  };

  // "Select from Existing Campaigns" starts unchecked whenever the modal opens —
  // still preloads the list in the background so it's ready the moment the user checks it.
  useEffect(() => {
    if (!open) return;
    setSelectFromExisting(false);
    if (existingMemories.length === 0) loadExistingMemories();
  }, [open]);

  // Pull the store's collections. Normalised into the same shape the existing-campaigns
  // picker already renders (id/title/count/thumb). Pre-ticks them all only when explicitly
  // switching into Shopify as the category — a background load for the "All Categories"
  // merge (see existingCampaignsPickerSource) must NOT silently select everything.
  const loadShopifyCollections = async (autoSelectAll = true) => {
    setShopifyCollectionsLoading(true);
    try {
      const res = await dashboardAPI.shopifyGetCatalog();
      const data: any = (res?.data as any)?.data || res?.data || {};
      const raw = data.collections || data.catalog?.collections || [];
      const list = (Array.isArray(raw) ? raw : [])
        .filter((c: any) => c?.id != null)
        .map((c: any) => ({
          id: c.id,
          title: c.title || 'Untitled collection',
          location: '',
          category: { name: SHOPIFY_CATEGORY_NAME },
          last_update_img: c.cover?.image || c.cover?.images?.[0] || c.image || (Array.isArray(c.products) ? c.products[0]?.image : '') || '',
          posts_count: c.products_count ?? (Array.isArray(c.products) ? c.products.length : 0),
        }));
      setShopifyCollections(list);
      if (autoSelectAll) setSelectedMemoryIds(list.map((c: any) => String(c.id)));
    } catch { /* leave list empty */ }
    setShopifyCollectionsLoading(false);
  };

  // React to the Shopify category being chosen / deselected.
  useEffect(() => {
    if (!open) return;
    if (isShopifyCategory) {
      setSelectFromExisting(true);
      if (shopifyCollections.length === 0) loadShopifyCollections();
      else setSelectedMemoryIds(shopifyCollections.map((c: any) => String(c.id)));
    } else if (wasShopifyCategoryRef.current) {
      // Leaving Shopify: the selection held collection ids, not memory ids — drop it.
      setSelectedMemoryIds([]);
      setSelectFromExisting(false);
    }
    wasShopifyCategoryRef.current = isShopifyCategory;
  }, [isShopifyCategory, open]);

  // Pull the /cars catalog. Normalised into the same shape the existing-campaigns picker
  // already renders (id/title/count/thumb). Pre-ticks all listings only when explicitly
  // switching into Cars as the category — a background load for the "All Categories" merge
  // (see existingCampaignsPickerSource) must NOT silently select everything.
  const loadCarsForPicker = async (autoSelectAll = true) => {
    setCarsForPickerLoading(true);
    try {
      const res = await dashboardAPI.carsGetCatalog();
      const raw = res?.data?.data?.cars || (res?.data as any)?.cars || [];
      const list = (Array.isArray(raw) ? raw : [])
        .filter((c: any) => c?.id != null)
        .map((c: any) => ({
          id: c.id,
          title: c.title || 'Untitled car',
          location: c.location || '',
          category: { name: CARS_CATEGORY_NAME },
          last_update_img: c.main_image || '',
          posts_count: c.images_count || 0,
        }));
      setCarsForPicker(list);
      if (autoSelectAll) setSelectedMemoryIds(list.map((c: any) => String(c.id)));
    } catch { /* leave list empty */ }
    setCarsForPickerLoading(false);
  };

  // React to the Cars category being chosen / deselected. Picking Cars just switches the
  // picker to show the Cars catalog — it doesn't pre-select any of them anymore.
  useEffect(() => {
    if (!open) return;
    if (isCarsCategory) {
      setSelectFromExisting(true);
      if (carsForPicker.length === 0) loadCarsForPicker(false);
    } else if (wasCarsCategoryRef.current) {
      // Leaving Cars: the selection held car ids, not memory ids — drop it.
      setSelectedMemoryIds([]);
      setSelectFromExisting(false);
    }
    wasCarsCategoryRef.current = isCarsCategory;
  }, [isCarsCategory, open]);

  // Also load the Cars catalog when picked from the existing-campaigns filter
  // (not just the main Category field) so the picker has something to show.
  useEffect(() => {
    if (!open) return;
    if (memoryCategoryFilter === CARS_CATEGORY_NAME && carsForPicker.length === 0 && !carsForPickerLoading) {
      loadCarsForPicker(false);
    }
  }, [memoryCategoryFilter, open]);

  // Background-load Cars/Shopify (without pre-selecting them) as soon as the
  // existing-campaigns picker is open, so the "All Categories" merge has them ready
  // without waiting for the user to specifically switch into either category.
  useEffect(() => {
    if (!open || !selectFromExisting) return;
    if (carsAvailable && carsForPicker.length === 0 && !carsForPickerLoading) loadCarsForPicker(false);
    if (shopifyConnected && shopifyCollections.length === 0 && !shopifyCollectionsLoading) loadShopifyCollections(false);
  }, [open, selectFromExisting, carsAvailable, shopifyConnected]);

  // Fetch categories, labels and collaborators from API
  const fetchCategoriesLabels = async (skipCategories = false) => {
    try {
      setIsLoading(true);

      // On property account use the property memories endpoint so we get property-specific categories
      const response = (viewType === 'property' && currentProperty)
        ? await dashboardAPI.getPropertyMemories(currentProperty.id)
        : await dashboardAPI.getCategoriesLabels();

      if (response.success && response.data) {
        // Same unwrapping as App.tsx fetchMemoriesData
        const actualData = response.data?.data || response.data;

        // Try every known path to find the categories array
        let categoriesArray: any[] = [];

        const candidates = [
          actualData?.sidebar?.categories?.items,
          actualData?.data?.sidebar?.categories?.items,
          actualData?.data?.categories?.items,
          actualData?.categories?.items,
          Array.isArray(actualData?.categories) ? actualData.categories : null,
          Array.isArray(actualData?.data?.categories) ? actualData.data.categories : null,
          Array.isArray(actualData) ? actualData : null,
        ];

        for (const candidate of candidates) {
          if (Array.isArray(candidate) && candidate.length > 0 && candidate[0]?.name) {
            categoriesArray = candidate;
            break;
          }
        }

        if (categoriesArray.length > 0 && !skipCategories) {
          const uniqueCategories = categoriesArray
            .filter(cat => {
              const name = (cat.name || '').toLowerCase().trim();
              return !['shared with', 'published', 'shared', 'invites'].includes(name) && !name.includes('shared');
            })
            .filter(cat => cat.is_owner !== false && cat.can_add_story !== false)
            .filter((cat, i, self) => self.findIndex(c => c.name === cat.name) === i);

          setApiCategories(uniqueCategories);
        }

        // Extract labels/tags — use direct labels path first, NOT sidebar (sidebar has historical/stale labels)
        const labelCandidates = [
          actualData?.data?.labels?.items,
          actualData?.labels?.items,
          Array.isArray(actualData?.data?.labels) ? actualData.data.labels : null,
          Array.isArray(actualData?.labels) ? actualData.labels : null,
        ];
        let labelsSet = false;
        for (const candidate of labelCandidates) {
          if (Array.isArray(candidate) && candidate.length > 0) {
            setApiLabels(candidate);
            console.log('Labels loaded:', candidate);
            labelsSet = true;
            break;
          }
        }
        if (!labelsSet) setApiLabels([]);
        
        // Extract collaborators - check multiple possible structures
        console.log('Full actualData structure:', actualData);
        console.log('actualData.data structure:', actualData.data);
        
        // Try different possible paths for collaborators
        // Path 1: actualData.data.frequent_collaborators and actualData.data.recent_collaborators
        if (actualData.data?.frequent_collaborators) {
          const frequentCollab = Array.isArray(actualData.data.frequent_collaborators) 
            ? actualData.data.frequent_collaborators 
            : actualData.data.frequent_collaborators.items || [];
          setApiFrequentCollaborators(frequentCollab);
          console.log('Frequent collaborators loaded (path 1):', frequentCollab);
        }
        
        if (actualData.data?.recent_collaborators) {
          const recentCollab = Array.isArray(actualData.data.recent_collaborators)
            ? actualData.data.recent_collaborators
            : actualData.data.recent_collaborators.items || [];
          setApiRecentCollaborators(recentCollab);
          console.log('Recent collaborators loaded (path 1):', recentCollab);
        }
        
        // Path 2: actualData.data.collaborators as single array
        if (actualData.data?.collaborators && Array.isArray(actualData.data.collaborators)) {
          // If collaborators is a single array, use it for both recent and frequent
          setApiRecentCollaborators(actualData.data.collaborators);
          setApiFrequentCollaborators(actualData.data.collaborators);
          console.log('Collaborators loaded (path 2):', actualData.data.collaborators);
        }
        
        // Path 3: Original nested structure (kept as fallback)
        if (actualData.data?.collaborators && !Array.isArray(actualData.data.collaborators)) {
          if (actualData.data.collaborators.frequent?.items) {
            setApiFrequentCollaborators(actualData.data.collaborators.frequent.items);
            console.log('Frequent collaborators loaded (path 3):', actualData.data.collaborators.frequent.items);
          }
          
          if (actualData.data.collaborators.recent?.items) {
            setApiRecentCollaborators(actualData.data.collaborators.recent.items);
            console.log('Recent collaborators loaded (path 3):', actualData.data.collaborators.recent.items);
          }
        }
      } else {
        console.error('Failed to fetch categories and labels:', response);
      }
    } catch (error) {
      console.error('Error fetching categories and labels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch properties owned by the user
  const fetchProperties = async () => {
    try {
      console.log('🏠 Fetching properties for create memory...');
      const response = await dashboardAPI.getProperties();

      if (response.success || response.status === 'success') {
        const responseData = response.data || response;
        const properties = responseData.properties || responseData.data?.properties || [];

        // Filter to only show properties where user is creator/owner
        const ownedProperties = properties.filter((prop: any) => prop.is_creator === true);

        setApiProperties(ownedProperties);
        console.log('🏠 Owned properties loaded:', ownedProperties);

        // Leave property unselected — user picks it optionally
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  // Fetch the user's saved "master" personalized message from the profile API,
  // and pre-fill the Personalized Message box with it if one was set.
  const fetchMasterMessage = async () => {
    try {
      const response = await dashboardAPI.getUserProfile();
      if (response.success && response.data) {
        const profile = (response.data as any)?.data?.user || (response.data as any)?.user || response.data;
        if (profile?.is_master && profile?.message) {
          setSavedMasterMessage(profile.message);
          setPersonalizedMessage(profile.message);
          setIsMasterMessage(true);
        }
      }
    } catch (error) {
      console.error('Error fetching master message:', error);
    }
  };

  // Fetch data when modal opens
  useEffect(() => {
    if (open && isAuthenticated) {
      // Use categories from prop if available, otherwise fetch from API
      let resolvedCategories: any[] = [];
      if (categoriesProp && categoriesProp.length > 0) {
        const filtered = categoriesProp.filter((cat: any) => {
          const name = (cat.name || '').toLowerCase().trim();
          return !['shared with', 'published', 'shared', 'invites'].includes(name) && !name.includes('shared') && cat.is_owner !== false && cat.can_add_story !== false;
        });
        if (filtered.length > 0) {
          setApiCategories(filtered);
          resolvedCategories = filtered;
          // Still fetch labels even though categories come from prop
          fetchCategoriesLabels(true);
        } else {
          // Prop had only system categories after filtering — fetch from correct endpoint
          fetchCategoriesLabels();
        }
      } else {
        fetchCategoriesLabels();
      }
      fetchProperties();

      // Pick default category: prefer a specific defaultCategory when supplied (the
      // sidebar's per-category "+" button). The generic "Create a Campaign" button
      // passes no defaultCategory — it falls back to "Personal" (every account's
      // standard category) so users aren't forced to pick one for the common case,
      // unless a pinned preference from Profile Settings > Categories is loaded below.
      const categoryExists = resolvedCategories.some((c: any) => c.name === defaultCategory);
      const personalCategory = resolvedCategories.find((c: any) => c.name === 'Personal')?.name || '';
      const resolvedCategory = categoryExists ? defaultCategory! : (defaultCategory && resolvedCategories.length === 0 ? defaultCategory : personalCategory);

      // Reset all states when modal opens fresh
      setFormData({
        title: '',
        category: resolvedCategory,
        label: '',
        property: [] as string[],
        mediaFiles: [],
        date: new Date().toISOString().split('T')[0],
        endDate: '',
        location: '',
        tags: [],
        collaborators: []
      });
      setLabelInput('');
      setShowPropertyDropdown(false);
      setPropertySearch('');
      setMainPhotosArray([]);
      setPhotosWithMetadata([]);
      setExifExtractionResults([]);
      setShowExifModal(false);
      setShowEndDate(false);
      setCurrentTag('');
      setCurrentCollaborator('');
      setCollaboratorMethod('phone');
      setCollaboratorSearchResults([]);
      setPersonalizedMessage('wants to share this with you!');
      setIsMasterMessage(false);
      setSavedMasterMessage('');
      fetchMasterMessage();
      setIntroVideo(null);
      setIntroVideoUrl(null);
      setIsUploadingVideo(false);
      setVideoUploadProgress(0);

      // Default the new-campaign category (and the existing-campaigns filter) to whatever
      // category the user pinned in Profile Settings > Categories, overriding the reset
      // above — but only when a preference is actually set; if the user hasn't pinned one,
      // the defaultCategory/first-category logic above stands. Fetched here (inside the
      // same effect as the reset, instead of a separate effect keyed only on [open,
      // isAuthenticated]) so a mid-session `user` object change — which re-runs this whole
      // effect — can't re-apply the plain reset without also re-applying this override.
      let cancelled = false;
      (async () => {
        try {
          const res = await dashboardAPI.getNotificationPreferences();
          if (cancelled || !res?.success || !res.data) return;

          // apiRequest returns the whole server payload as `data` (i.e. { status, data: {...} }),
          // it doesn't unwrap the inner `data` — so the real fields are one level deeper.
          const prefsData = (res.data as any)?.data || res.data;

          const rawCategoryId = prefsData.category_id;
          let preferredName: string | null = null;
          if (rawCategoryId === 'shopify') preferredName = SHOPIFY_CATEGORY_NAME;
          else if (rawCategoryId === 'cars') preferredName = CARS_CATEGORY_NAME;
          else if (prefsData.category?.name) preferredName = prefsData.category.name;

          if (preferredName) {
            setFormData(prev => ({ ...prev, category: preferredName as string }));
            setMemoryCategoryFilter(preferredName);
            // Per the "Add from Campaigns Selector" spec: pinning a category as
            // "always visible" in Profile Settings should also turn on "Select
            // from Existing Campaigns" here, pre-filtered to that category.
            setSelectFromExisting(true);
          }
        } catch { /* keep the existing default */ }
      })();
      return () => { cancelled = true; };
    }
  }, [open, isAuthenticated, defaultCategory, categoriesProp, user]);

  // Completes the category resolution once apiCategories loads asynchronously — the
  // synchronous pass above only sees categories already available via categoriesProp,
  // so when that prop is empty (categories come from fetchCategoriesLabels() instead,
  // which resolves after this effect runs), formData.category is still '' at that
  // point and needs to be filled in here once the fetch actually completes.
  useEffect(() => {
    if (open && apiCategories.length > 0 && !formData.category) {
      const matchName = defaultCategory || 'Personal';
      const matched = apiCategories.find((c: any) => c.name === matchName);
      if (matched) {
        setFormData(prev => ({ ...prev, category: matched.name }));
      }
    }
  }, [apiCategories, open, defaultCategory]);

  // Removed the complex useEffect - now completing upload directly

  // Effect to monitor photosWithMetadata changes
  useEffect(() => {
    console.log('📸 PHOTOS WITH METADATA CHANGED:', {
      length: photosWithMetadata.length,
      data: photosWithMetadata,
      trigger: 'useEffect dependency change'
    });

    // If this change happened after modal opened and we have data, it might be the restoration
    if (open && photosWithMetadata.length > 0) {
      console.log('🎉 PHOTOS WITH METADATA RESTORED IN MODAL:', {
        length: photosWithMetadata.length,
        photos: photosWithMetadata.map(p => ({
          name: p.name,
          location: p.location,
          date: p.capture_date,
          metadata_extracted: p.metadata_extracted
        }))
      });
    }
  }, [photosWithMetadata, open]);

  // Handle selected media library images
  useEffect(() => {
    if (selectedMediaLibraryImages && selectedMediaLibraryImages.length > 0 && open) {
      console.log('📚 PROCESSING SELECTED MEDIA LIBRARY IMAGES:', selectedMediaLibraryImages);

      // Convert selected media library images to the format used by mainPhotosArray
      const libraryPhotos = selectedMediaLibraryImages.map(img => ({
        name: img.name || 'Untitled',
        location: img.location || '',
        capture_date: img.capture_date || img.captureDate || '',
        capture_time: img.capture_time || img.captureTime || '',
        fileUrl: img.image || img.url || img.fileUrl || '',
        imageName: img.imageName || img.name || '',
        originalSizeMB: img.originalSizeMB || 0
      }));

      // Add to mainPhotosArray
      setMainPhotosArray(prev => [...prev, ...libraryPhotos]);

      console.log('✅ Added media library images to mainPhotosArray:', libraryPhotos);
    }
  }, [selectedMediaLibraryImages, open]);

  // Debounced live search for the collaborator input — looks up existing users by
  // phone/email as you type, same API AddCollaboratorDialog uses (dashboardAPI.searchUsers).
  useEffect(() => {
    const query = currentCollaborator.trim();
    if (query.length < 2) {
      setCollaboratorSearchResults([]);
      setIsSearchingCollaborators(false);
      return;
    }

    setIsSearchingCollaborators(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await dashboardAPI.searchUsers(query, collaboratorMethod);
        const users = response.success ? (response.data?.data?.users || []) : [];
        const filtered = users.filter((user: any) => {
          const value = collaboratorMethod === 'email' ? user.email : user.phone_number;
          return value && !formData.collaborators.includes(value);
        });
        setCollaboratorSearchResults(filtered);
      } catch (error) {
        console.error('Error searching collaborators:', error);
        setCollaboratorSearchResults([]);
      } finally {
        setIsSearchingCollaborators(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [currentCollaborator, collaboratorMethod, formData.collaborators]);

  // Click outside the search input/dropdown closes the results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (collaboratorSearchRef.current && !collaboratorSearchRef.current.contains(event.target as Node)) {
        setCollaboratorSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Click outside the "Search campaigns" box closes its suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (memorySearchBoxRef.current && !memorySearchBoxRef.current.contains(event.target as Node)) {
        setIsMemorySearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't return null if we have a success dialog to show
  if (!open && !showSuccessDialog) return null;

  // Debug current state when modal is open
  if (open) {
    console.log('🖼️ MODAL IS OPEN - Current state:', {
      formDataMediaFilesLength: formData.mediaFiles.length,
      photosWithMetadataLength: photosWithMetadata.length,
      mainPhotosArrayLength: mainPhotosArray.length,
      photosWithMetadataData: photosWithMetadata,
      formDataDetail: formData
    });
  }

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleModalClose();
    }
  };

  // Handle backdrop click
  const handleModalClose = () => {
    setTitleError('');
    setDeviceLocation('');
    setSelectFromExisting(false);
    setExistingMemories([]);
    setMemorySearch('');
    setMemoryCategoryFilter('All Categories');
    setSelectedMemoryIds([]);
    setShopifyCollections([]);
    wasShopifyCategoryRef.current = false;
    setCarsForPicker([]);
    wasCarsCategoryRef.current = false;
    setVisibleCampaignsCount(CAMPAIGNS_LOAD_BATCH);
    onOpenChange(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    console.log(`🔄 FILE INPUT CHANGE:`, {
      totalFilesSelected: files.length,
      fileNames: files.map(f => `${f.name} (${(f.size / 1024).toFixed(2)}KB)`)
    });

    const validFiles = files.filter(file => {
      const fileType = file.type.toLowerCase();
      const isValid = fileType === 'image/jpeg' || fileType === 'image/jpg' || fileType === 'image/png';
      if (!isValid) {
        console.log(`❌ Invalid file type: ${file.name} (${fileType})`);
      }
      return isValid;
    });

    console.log(`✅ VALID FILES:`, {
      validCount: validFiles.length,
      invalidCount: files.length - validFiles.length,
      validFileNames: validFiles.map(f => f.name)
    });

    if (validFiles.length !== files.length) {
      alert('Please select only JPG, JPEG, or PNG files.');
    }

    if (validFiles.length > 0) {
      const dt = new DataTransfer();
      validFiles.forEach(f => dt.items.add(f));
      setMomentFiles(dt.files);
      setIsAddMomentOpen(true);
    }

    // Reset the input to allow selecting the same files again if needed
    event.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      const fileType = file.type.toLowerCase();
      return fileType === 'image/jpeg' || fileType === 'image/jpg' || fileType === 'image/png';
    });

    if (validFiles.length !== files.length) {
      alert('Please select only JPG, JPEG, or PNG files.');
    }

    if (validFiles.length > 0) {
      const dt = new DataTransfer();
      validFiles.forEach(f => dt.items.add(f));
      setMomentFiles(dt.files);
      setIsAddMomentOpen(true);
    }
  };

  // Process files and extract metadata ONE BY ONE
  const processFilesWithMetadata = async (files: File[]) => {
    console.log(`🚀 PROCESSING FILES WITH METADATA:`, {
      incomingFilesCount: files.length,
      currentMediaFilesCount: formData.mediaFiles.length,
      incomingFileNames: files.map(f => f.name)
    });
    setIsExtractingMetadata(true);
    setIsUploading(true);
    setUploadedFilesCount(0);
    const uploadItems = files.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      fileName: file.name,
      fileType: file.type,
      progress: 0,
      status: 'uploading' as const
    }));
    setUploadProgress(uploadItems);

    // DON'T clear arrays if we're adding more photos to existing batch
    // Only clear if this is the first upload in the session
    if (formData.mediaFiles.length === 0) {
      setMainPhotosArray([]);
      setPhotosWithMetadata([]);
      console.log(`🧹 CLEARED ARRAYS - Starting fresh upload session`);
    } else {
      console.log(`➕ ADDING MORE PHOTOS - Current array has ${mainPhotosArray.length} photos`);
    }

    // Initialize extraction results for modal
    const initialResults = files.map(file => ({
      fileName: file.name,
      hasDate: false,
      hasLocation: false,
      isProcessing: false,
      isCompleted: false
    }));
    setExifExtractionResults(initialResults);

    const newPhotosWithMetadata: Array<{
      file: File;
      name: string;
      location?: string;
      capture_date?: string;
      capture_time?: string;
      fileUrl?: string;
      imageName?: string;
      originalSizeMB?: number;
      metadata_extracted: boolean;
    }> = [];

    // Track successfully processed files - ADD ALL FILES IMMEDIATELY
    const successfullyProcessedFiles: File[] = [...files]; // Copy all files immediately
    console.log(`🔒 GUARANTEED FILE LIST: ${successfullyProcessedFiles.length} files locked in`);

    // Small concurrent batches, not all at once — the backend's PHP-FPM pool runs in
    // "ondemand" mode (no pre-warmed workers), so a burst of simultaneous uploads
    // forces several cold worker forks at once; whichever request draws the short
    // straw can exceed the connection timeout and fail with a raw network error
    // before any response comes back. A small batch size keeps bursts short.
    const BATCH_SIZE = 2;

    try {
      // Process files in batches of 2 — each batch uploads in parallel
      for (let batchStart = 0; batchStart < files.length; batchStart += BATCH_SIZE) {
        const batch = files.slice(batchStart, batchStart + BATCH_SIZE);
        console.log(`🚀 Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: files ${batchStart + 1}–${batchStart + batch.length} of ${files.length}`);

        // Mark all files in this batch as processing
        setExifExtractionResults(prev =>
          prev.map((result, index) =>
            index >= batchStart && index < batchStart + batch.length
              ? { ...result, isProcessing: true }
              : result
          )
        );
        setUploadProgress(prev => prev.map((item, index) =>
          index >= batchStart && index < batchStart + batch.length
            ? { ...item, progress: 10, status: 'uploading' }
            : item
        ));

        // Upload all 5 in parallel
        const batchResults = await Promise.all(
          batch.map(async (file, batchIndex) => {
            const globalIndex = batchStart + batchIndex;
            const fileName = file.name;
            let metadataExtracted = false;
            let location = '';
            let capture_date = '';
            let capture_time = '';
            let fileUrl = '';
            let imageName = '';
            let originalSizeMB = 0;

            try {
              const fileNameForAPI = file.name
                .replace(/\.[^/.]+$/, '')   // remove extension
                .replace(/\s+/g, '_')       // spaces → underscores
                .replace(/[^a-zA-Z0-9\-_]/g, ''); // remove all other special chars
              const exif = await exifr.parse(file, ['Orientation']).catch(() => null);
              const orientation = exif?.Orientation ?? 1;
              const response = await dashboardAPI.uploadImageWithMetadata(file, fileNameForAPI, orientation);

              if (response.success && response.data) {
                const apiData = response.data.data || response.data;
                location = apiData.location || '';
                capture_date = apiData.capture_date || '';
                capture_time = apiData.capture_time || '';
                fileUrl = apiData.fileUrl || '';
                imageName = apiData.imageName || '';
                originalSizeMB = apiData.originalSizeMB || 0;
                metadataExtracted = true;
                console.log(`✅ Metadata extracted for file ${globalIndex + 1}: ${file.name}`);
              } else {
                console.log(`⚠️ No metadata for file ${globalIndex + 1}: ${file.name} - continuing anyway`);
              }
              setUploadProgress(prev => prev.map((item, i) =>
                i === globalIndex ? { ...item, progress: 100, status: 'complete' } : item
              ));
              setUploadedFilesCount(prev => prev + 1);
            } catch (metadataError) {
              console.log(`⚠️ Metadata extraction failed for file ${globalIndex + 1}: ${file.name} - file still included`, metadataError);
              setUploadProgress(prev => prev.map((item, i) =>
                i === globalIndex ? { ...item, status: 'error' } : item
              ));
            }

            return { file, fileName, globalIndex, metadataExtracted, location, capture_date, capture_time, fileUrl, imageName, originalSizeMB };
          })
        );

        // Apply results for all files in the batch
        for (const result of batchResults) {
          const { file, fileName, globalIndex, metadataExtracted, location, capture_date, capture_time, fileUrl, imageName, originalSizeMB } = result;
          const hasValidDate = !!(capture_date && capture_date.trim() !== '');
          const hasValidLocation = !!(location && location.trim() !== '');

          const photoData = {
            file,
            name: fileName,
            location,
            capture_date,
            capture_time,
            fileUrl,
            imageName,
            originalSizeMB,
            metadata_extracted: metadataExtracted
          };
          newPhotosWithMetadata.push(photoData);

          setMainPhotosArray(prev => {
            const updated = [...prev, { name: fileName, location, capture_date, capture_time, fileUrl, imageName, originalSizeMB }];
            console.log(`📸 Added photo ${globalIndex + 1}/${files.length}: ${fileName} (metadata: ${metadataExtracted})`);
            return updated;
          });

          setExifExtractionResults(prev =>
            prev.map((r, index) =>
              index === globalIndex ? { ...r, hasDate: hasValidDate, hasLocation: hasValidLocation, isProcessing: false, isCompleted: true } : r
            )
          );
        }

        console.log(`✅ Batch ${Math.floor(batchStart / BATCH_SIZE) + 1} complete`);
      }

      console.log(`🏁 LOOP COMPLETED: Processed ${successfullyProcessedFiles.length} out of ${files.length} files`);
      console.log(`📋 SUCCESS LIST:`, successfullyProcessedFiles.map(f => f.name));

      // Check if all files made it
      if (successfullyProcessedFiles.length !== files.length) {
        const missingFiles = files.filter(f => !successfullyProcessedFiles.includes(f)).map(f => f.name);
        console.error(`❌ MISSING FILES FROM SUCCESS LIST:`, missingFiles);
      }

      // Update all states after processing - USE successfullyProcessedFiles NOT original files
      setPhotosWithMetadata(prev => [...prev, ...newPhotosWithMetadata]);
      setFormData(prev => {
        const updatedFiles = [...prev.mediaFiles, ...successfullyProcessedFiles];
        console.log(`📎 UPDATING MEDIA FILES WITH SUCCESSFULLY PROCESSED FILES:`, {
          previousCount: prev.mediaFiles.length,
          originalFilesCount: files.length,
          successfullyProcessedCount: successfullyProcessedFiles.length,
          totalFiles: updatedFiles.length,
          processedFileNames: successfullyProcessedFiles.map(f => f.name),
          missingFiles: files.filter(f => !successfullyProcessedFiles.includes(f)).map(f => f.name)
        });

        if (successfullyProcessedFiles.length !== files.length) {
          console.warn(`⚠️ WARNING: Only ${successfullyProcessedFiles.length} of ${files.length} files were successfully processed!`);
        }

        return {
          ...prev,
          mediaFiles: updatedFiles
        };
      });

      // Auto-fill form from metadata
      autoFillFromMetadata(newPhotosWithMetadata);

      // Auto-close modal after completion
      setTimeout(() => {
        setShowExifModal(false);
      }, 2000);

      console.log(`🎉 Completed processing all ${files.length} files`);

      // Complete upload with the data we know is current
      const finalFormData = {
        ...formData,
        mediaFiles: [...formData.mediaFiles, ...successfullyProcessedFiles]
      };

      const finalPhotosArray = [...mainPhotosArray, ...newPhotosWithMetadata.map(p => ({
        name: p.name,
        location: p.location || '',
        capture_date: p.capture_date || '',
        capture_time: p.capture_time || '',
        fileUrl: p.fileUrl || '',
        imageName: p.imageName || '',
        originalSizeMB: p.originalSizeMB || 0
      }))];

      const finalPhotosWithMetadata = [...photosWithMetadata, ...newPhotosWithMetadata];

      console.log('🔍 DETAILED DATA CHECK:', {
        originalPhotosWithMetadata: photosWithMetadata,
        newPhotosWithMetadata: newPhotosWithMetadata,
        finalPhotosWithMetadata: finalPhotosWithMetadata,
        originalMainPhotosArray: mainPhotosArray,
        newPhotosForMainArray: newPhotosWithMetadata.map(p => ({
          name: p.name,
          location: p.location || '',
          capture_date: p.capture_date || '',
          capture_time: p.capture_time || '',
          fileUrl: p.fileUrl || '',
          imageName: p.imageName || '',
          originalSizeMB: p.originalSizeMB || 0
        })),
        finalPhotosArray: finalPhotosArray
      });

      console.log('🔄 COMPLETING UPLOAD WITH KNOWN CURRENT DATA');
      console.log('📊 Upload completion data:', {
        finalFormDataFiles: finalFormData.mediaFiles.length,
        finalPhotosArrayLength: finalPhotosArray.length,
        finalPhotosWithMetadataLength: finalPhotosWithMetadata.length,
        actualData: {
          finalFormData,
          finalPhotosArray,
          finalPhotosWithMetadata
        }
      });


      // Final summary of photos array - use current state
      setTimeout(() => {
        setMainPhotosArray(currentArray => {
          console.log(`🏁 FINAL PHOTOS ARRAY SUMMARY:`);
          console.log(`📊 Photos processed in this batch: ${files.length}`);
          console.log(`📸 Total photos in array: ${currentArray.length}`);
          console.log(`🎯 FINAL COMPLETE PHOTOS ARRAY:`, currentArray);
          console.table(currentArray);

          return currentArray; // Don't change the array, just log it
        });
      }, 100);

    } catch (error) {
      console.error('❌ CRITICAL ERROR processing files:', error);

      // FALLBACK: If processing completely fails, still add all files to ensure they're not lost
      console.log(`🔄 FALLBACK: Adding all ${files.length} files without metadata`);

      // Ensure successfullyProcessedFiles has all files
      if (successfullyProcessedFiles.length !== files.length) {
        console.log(`🔧 FIXING successfullyProcessedFiles: had ${successfullyProcessedFiles.length}, adding missing files`);
        successfullyProcessedFiles.length = 0; // Clear it
        successfullyProcessedFiles.push(...files); // Add all files
      }

      const fallbackPhotosWithMetadata = files.map(file => ({
        file,
        name: file.name,
        location: '',
        capture_date: '',
        capture_time: '',
        fileUrl: '',
        imageName: '',
        originalSizeMB: 0,
        metadata_extracted: false
      }));

      setPhotosWithMetadata(prev => [...prev, ...fallbackPhotosWithMetadata]);
      setFormData(prev => {
        const updatedFiles = [...prev.mediaFiles, ...successfullyProcessedFiles];
        console.log(`📎 FALLBACK - UPDATING MEDIA FILES:`, {
          previousCount: prev.mediaFiles.length,
          newFilesCount: successfullyProcessedFiles.length,
          totalFiles: updatedFiles.length,
          allFileNames: successfullyProcessedFiles.map(f => f.name)
        });
        return {
          ...prev,
          mediaFiles: updatedFiles
        };
      });
    } finally {
      setIsExtractingMetadata(false);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress([]);
        // Scroll to title input and focus it
        titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => titleInputRef.current?.focus(), 300);
      }, 1500);
    }
  };

  // Auto-fill form fields from extracted metadata
  const autoFillFromMetadata = (photos: Array<{
    file: File;
    name: string;
    location?: string;
    capture_date?: string;
    capture_time?: string;
    fileUrl?: string;
    imageName?: string;
    originalSizeMB?: number;
    metadata_extracted: boolean;
  }>) => {
    console.log('🔍 AUTO-FILL METADATA - Processing photos:', photos);

    // Auto-fill location from photos with valid location metadata
    const photosWithLocation = photos.filter(photo =>
      photo.location &&
      photo.location.trim() !== '' &&
      photo.metadata_extracted
    );

    console.log('📍 Photos with location:', photosWithLocation);

    // Set location from first photo that has location metadata
    // This will override device location or any existing location
    if (photosWithLocation.length > 0) {
      const location = photosWithLocation[0].location;
      if (location && location.trim() !== '') {
        setFormData(prev => {
          console.log('🔄 Updating location from image metadata:', {
            oldLocation: prev.location,
            newLocation: location
          });
          return { ...prev, location };
        });
        console.log('✅ Auto-filled location from image metadata:', location);
      }
    } else {
      console.log('ℹ️ No location in uploaded images - keeping existing location');
    }

    // Auto-fill dates from current batch of photos
    const photosWithDates = photos.filter(photo =>
      photo.capture_date &&
      photo.capture_date.trim() !== '' &&
      photo.metadata_extracted
    );

    console.log('📅 Photos with valid dates:', photosWithDates);

    if (photosWithDates.length > 0) {
      // Get all valid dates from photos with metadata
      const validDates = photosWithDates.map(photo => {
        try {
          const date = new Date(photo.capture_date!);
          return date.toISOString().split('T')[0];
        } catch {
          return null;
        }
      }).filter(date => date !== null) as string[];

      if (validDates.length > 0) {
        // Remove duplicates and sort
        const uniqueDates = [...new Set(validDates)].sort();
        const minDate = uniqueDates[0];
        const maxDate = uniqueDates[uniqueDates.length - 1];

        console.log('📅 Date analysis from current batch:', {
          photosWithDates: photosWithDates.length,
          validDates: validDates,
          uniqueDates: uniqueDates,
          minDate,
          maxDate,
          differentDates: minDate !== maxDate
        });

        // Update form with dates from photos
        setFormData(prev => ({
          ...prev,
          date: minDate,
          endDate: minDate !== maxDate ? maxDate : ''
        }));

        // Show end date checkbox if we have different dates
        setShowEndDate(minDate !== maxDate);

        console.log('✅ Auto-filled dates from images:', {
          startDate: minDate,
          endDate: minDate !== maxDate ? maxDate : 'Same date - no end date',
          endDateCheckboxVisible: minDate !== maxDate
        });
      }
    }

  };

  const handleAddTag = () => {
    if (currentTag.trim()) {
      const newTags = currentTag
        .split(',')
        .map(t => t.trim())
        .filter(t => t && !formData.tags.includes(t));
      if (newTags.length > 0) {
        setFormData(prev => ({
          ...prev,
          tags: [...prev.tags, ...newTags]
        }));
      }
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleAddCollaborator = () => {
    const value = currentCollaborator.trim();
    if (!value) return;

    if (collaboratorMethod === 'phone') {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 10) {
        setCollaboratorError('Please enter a valid phone number (at least 10 digits).');
        return;
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        setCollaboratorError('Please enter a valid email address.');
        return;
      }
    }

    if (!formData.collaborators.includes(value)) {
      setFormData(prev => ({
        ...prev,
        collaborators: [...prev.collaborators, value]
      }));
    }
    setCurrentCollaborator('');
    setCollaboratorError('');
  };

  const handleRemoveCollaborator = (collaboratorToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      collaborators: prev.collaborators.filter(c => c !== collaboratorToRemove)
    }));
  };

  const handleRemoveMediaFile = (indexToRemove: number) => {
    // Remove from all three arrays to keep them in sync
    setFormData(prev => ({
      ...prev,
      mediaFiles: prev.mediaFiles.filter((_, index) => index !== indexToRemove)
    }));

    setPhotosWithMetadata(prev =>
      prev.filter((_, index) => index !== indexToRemove)
    );

    setMainPhotosArray(prev =>
      prev.filter((_, index) => index !== indexToRemove)
    );
  };

  // Typing handlers for black outline
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, title: e.target.value }));
    setIsTypingTitle(true);
    // Clear error when user starts typing
    if (titleError) {
      setTitleError('');
    }
    // Clear typing state after a brief delay
    setTimeout(() => setIsTypingTitle(false), 500);
  };

  const handleLocationChange = (value: string) => {
    setFormData(prev => ({ ...prev, location: value }));
    setIsTypingLocation(true);
    setTimeout(() => setIsTypingLocation(false), 500);
  };

  const handleTagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTag(e.target.value);
    setIsTypingTag(true);
    setTimeout(() => setIsTypingTag(false), 500);
  };

  const handleCollaboratorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (collaboratorMethod === 'phone') {
      if (/^[0-9+\-() ]*$/.test(value)) {
        setCurrentCollaborator(value);
      }
    } else {
      if (/^[a-zA-Z0-9@._\-]*$/.test(value)) {
        setCurrentCollaborator(value);
      }
    }
    if (collaboratorError) setCollaboratorError('');
    setIsTypingCollaborator(true);
    setTimeout(() => setIsTypingCollaborator(false), 500);
  };

  const handleSelectCollaboratorFromSearch = (user: any) => {
    const value = collaboratorMethod === 'email' ? user.email : user.phone_number;
    if (!value) return;
    if (!formData.collaborators.includes(value)) {
      setFormData(prev => ({
        ...prev,
        collaborators: [...prev.collaborators, value]
      }));
    }
    setCurrentCollaborator('');
    setCollaboratorSearchResults([]);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, date: e.target.value }));
    setIsTypingDate(true);
    setTimeout(() => setIsTypingDate(false), 500);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, endDate: e.target.value }));
    setIsTypingEndDate(true);
    setTimeout(() => setIsTypingEndDate(false), 500);
  };


  const handleSubmit = async (publish = false, publishType: 1 | 2 | 3 = 1) => {
    // Validate required fields
    if (!formData.title.trim()) {
      setTitleError('Title is required');
      return;
    }

    // Log current state before submission
    console.log(`🚀 SUBMIT BUTTON CLICKED - Current state:`, {
      mediaFilesCount: formData.mediaFiles.length,
      mainPhotosArrayCount: mainPhotosArray.length,
      photosWithMetadataCount: photosWithMetadata.length,
      isExtractingMetadata: isExtractingMetadata
    });

    // Wait if metadata extraction is still in progress
    if (isExtractingMetadata) {
      console.warn('⏳ Metadata extraction still in progress, waiting...');
      alert('Please wait for file processing to complete before submitting.');
      return;
    }

    // Check latest memory limit before creating
    await checkLimit();

    if (isLimitExceeded) {
      setShowLimitDialog(true);
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Find the selected category data
      const selectedCategoryData = categoriesForDropdown.find((cat: any) => cat.name === formData.category);
      
      if (!selectedCategoryData) {
        console.error('Selected category not found in API categories');
        alert('Invalid category selected. Please try again.');
        return;
      }
      
      // Helper function to format date to "MMM dd, yyyy" format
      const formatDateForAPI = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: '2-digit', 
          year: 'numeric' 
        });
      };

      // Prepare photos array with proper date handling
      const photosArray = mainPhotosArray.map((photo) => {
        const todayDate = new Date().toISOString().split('T')[0];

        // Use capture_date if available, otherwise use today's date
        let photoDate = todayDate;
        if (photo.capture_date && photo.capture_date.trim() !== '') {
          try {
            const parsedDate = new Date(photo.capture_date);
            photoDate = parsedDate.toISOString().split('T')[0];
          } catch {
            photoDate = todayDate;
          }
        }

        return {
          name: photo.name,
          title: photo.title || '',
          description: photo.description || '',
          location: photo.location || '',
          capture_date: photoDate,
          capture_time: photo.capture_time || '',
          fileUrl: photo.fileUrl || '',
          imageName: photo.imageName || '',
          originalSizeMB: photo.originalSizeMB || 0,
          tags: photo.tags || []
        };
      });

      // Prepare the memory data for API
      const memoryData: any = {
        title: formData.title.trim(),
        category_id: selectedCategoryData.id,
        min_uploaded_img_date: formatDateForAPI(formData.date),
        max_uploaded_img_date: formatDateForAPI(formData.endDate || formData.date),
        location: formData.location || '',
        tags: formData.tags,
        collaborators: formData.collaborators,
        // Personalized invite message — only relevant when collaborators are added
        ...(formData.collaborators.length > 0 && {
          personalize_message: personalizedMessage.trim(),
          is_master: isMasterMessage
        }),
        photos_count: photosArray.length,
        photos: photosArray,
        ...(introVideoUrl && { last_update_img: introVideoUrl })
      };

      // Publish immediately if requested
      if (publish) {
        memoryData.published = publishType;
      }

      // Selected items: Shopify collection ids / Cars listing ids go to their own
      // field (they are not real memory rows); normal campaigns stay on linked_memory_ids.
      if (selectedMemoryIds.length > 0) {
        if (isShopifyCategory) {
          memoryData.shopify_collection_ids = selectedMemoryIds;
        } else if (isCarsCategory) {
          memoryData.car_ids = selectedMemoryIds;
        } else {
          memoryData.linked_memory_ids = selectedMemoryIds.map(id => parseInt(id, 10));
        }
      }

      // Add sub_category as array of label names
      if (formData.label) {
        memoryData.sub_category = [formData.label];
      }

      // Add property_id when in property account view, or when user selected a property on personal account
      if (viewType === 'property' && currentProperty) {
        memoryData.property_id = currentProperty.id;
        console.log(`🏠 Creating memory for property: ${currentProperty.name} (ID: ${currentProperty.id})`);
      } else if (viewType !== 'property' && formData.property.length > 0) {
        memoryData.property_id = formData.property.map(id => parseInt(id, 10));
        console.log(`🏠 Creating memory for selected property IDs: ${formData.property.join(', ')}`);
      }

      console.log('Creating memory with data:', memoryData);
      console.log('Photos array:', photosArray);

      let response;

      console.log('Creating memory with JSON data (no media files):', memoryData);
      console.log('Photos array with metadata:', photosArray);

      // Call the regular API to create the memory with just the JSON data (no files)
      response = await dashboardAPI.createMemory(memoryData);
      
      if (response.success) {
        console.log('Memory created successfully:', response.data);

        // Recheck memory limit and refresh page
        await recheckMemoryLimit();

        // Store memory details before resetting form
        const memoryDetails = {
          title: formData.title,
          category: formData.category,
          location: formData.location || undefined
        };

        // Show success dialog with memory details
        setCreatedMemoryDetails(memoryDetails);
        
        // Reset form and all photo-related states
        setFormData({
          title: '',
          category: apiCategories.length > 0 ? apiCategories[0].name : 'Personal',
          label: '',
          property: '',
          mediaFiles: [],
          date: new Date().toISOString().split('T')[0],
          endDate: '',
          location: '',
          tags: [],
          collaborators: []
        });
        setLabelInput('');
        setPersonalizedMessage('wants to share this with you!'); // Reset personalized message
        setIsMasterMessage(false); // Re-derived from user data next time the modal opens
        setMainPhotosArray([]); // Clear the photos metadata array
        setPhotosWithMetadata([]); // Clear photos with metadata
        setCurrentTag('');
        setCurrentCollaborator('');
        setCollaboratorMethod('phone');
        setCollaboratorSearchResults([]);
        setShowEndDate(false); // Reset end date visibility
        setDeviceLocation(''); // Reset device location for fresh detection on next open
        setIntroVideo(null);
        setIntroVideoUrl(null);

        
        // Trigger memory counts refresh
        await triggerMemoryCountsRefresh();
        
        // Call the callback to refresh parent component and wait for it
        console.log('🔄 Calling onMemoryCreated callback to refresh memories');
        if (onMemoryCreated) {
          await onMemoryCreated();
        }
        console.log('✅ Memory refresh callback completed');
        
        // Close the create modal first
        onOpenChange(false);
        
        // Show success dialog after a short delay to ensure smooth transition
        setTimeout(() => {
          console.log('Setting showSuccessDialog to true with details:', memoryDetails);
          console.log('Current createdMemoryDetails state:', createdMemoryDetails);
          setShowSuccessDialog(true);
        }, 100);
      } else {
        console.error('Failed to create memory:', response);

        // Check if the error is about title validation
        if (response.errors && response.errors.title) {
          // Display title-specific error
          setTitleError(response.errors.title[0] || 'This title is already taken.');
        } else if (response.message && response.message.toLowerCase().includes('title')) {
          // Fallback for different error response format
          setTitleError(response.message);
        } else {
          // Generic error - use alert for non-title errors
          alert(`Failed to create campaign: ${response.error || response.message || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error creating memory:', error);
      alert('An error occurred while creating the campaign. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };


  const modalContent = (
    <div 
      className="fixed inset-0 md:bg-black md:bg-opacity-50 flex items-center justify-center  p-0 md:p-4"
      style={{ zIndex: 99999 }}
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white md:rounded-lg md:shadow-2xl w-full md:max-w-md relative flex flex-col h-full md:h-[85vh] md:max-h-[85vh] overflow-x-hidden"
        style={{
          zIndex: 100000
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#7B68EE] rounded-full flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Create New Campaign</h2>
          </div>
          <button
            onClick={handleModalClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden modal-scrollbar">
          <div className="p-4 space-y-3">

            {/* Memory Title */}
            <div>
              <label className="block text-base md:text-sm font-medium text-gray-700 mb-1">
                Campaign Title *
              </label>
              <Input
                ref={titleInputRef}
                type="text"
                autoFocus
                value={formData.title}
                onChange={handleTitleChange}
                placeholder="Give your campaign a meaningful title"
                className="w-full h-12 md:h-10 text-base md:text-sm bg-gray-50 outline-none focus:outline-none focus-visible:outline-none transition-all duration-300"
                style={
                  titleError
                    ? { borderColor: 'rgb(239,68,68)', boxShadow: '0 0 0 3px rgba(239,68,68,0.2)', ['--tw-ring-shadow' as any]: '0 0 #0000', ['--tw-ring-offset-shadow' as any]: '0 0 #0000' }
                    : !formData.title
                    ? { borderColor: '#7B68EE', boxShadow: '0 0 0 4px rgba(123,104,238,0.2)', ['--tw-ring-shadow' as any]: '0 0 #0000', ['--tw-ring-offset-shadow' as any]: '0 0 #0000' }
                    : { borderColor: '#e5e7eb', ['--tw-ring-shadow' as any]: '0 0 #0000', ['--tw-ring-offset-shadow' as any]: '0 0 #0000' }
                }
                required
              />
              {titleError && (
                <p className="mt-1 text-sm text-red-600">
                  {titleError}
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-base md:text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <div className="create-memory-select">
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  disabled={isLoading}
                >
                <SelectTrigger className="w-full h-12 md:h-10 text-base md:text-sm bg-gray-50 border-gray-200 outline-none transition-colors [&:focus-visible]:!border-gray-300 [&:focus-visible]:!ring-gray-300/50 [&:focus-visible]:!ring-2 [&:focus]:!border-gray-300 [&:focus]:!ring-gray-300/50 [&:focus]:!ring-2">
                  <SelectValue placeholder={isLoading ? "Loading categories..." : "Select category"} />
                </SelectTrigger>
                <SelectContent
                  style={{
                    zIndex: 100001,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    outline: 'none'
                  }}
                  className="!border-gray-200 !shadow-md"
                >
                  {isLoading ? (
                    <SelectItem value="loading" disabled>Loading categories...</SelectItem>
                  ) : categoriesForDropdown.length > 0 ? (
                    categoriesForDropdown.map((category: any) => (
                      <SelectItem key={category.id || category.name} value={category.name}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.__isShopify ? SHOPIFY_COLOR : getCategoryColor(category.name) }}
                          />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    // No categories of your own — don't show fake placeholders
                    <SelectItem value="__no_category__" disabled>No categories — create one first</SelectItem>
                  )}
                </SelectContent>
                </Select>
              </div>
            </div>

            {/* Select from Existing Campaigns */}
            <div className="!mt-6 !mb-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectFromExisting}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSelectFromExisting(checked);
                    setVisibleCampaignsCount(CAMPAIGNS_LOAD_BATCH);
                    if (checked && existingMemories.length === 0) loadExistingMemories();
                  }}
                  className="w-5 h-5 md:w-4 md:h-4 bg-gray-100 border-gray-300 rounded focus:ring-2 focus:ring-[#6C60FF] accent-[#6C60FF]"
                />
                <span className="text-base md:text-sm font-medium text-gray-700">Select from Existing Campaigns</span>
              </label>

              {selectFromExisting && (
                <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden">
                  {/* Search + Category filter */}
                  <div className="flex gap-2 p-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex-1 min-w-0 relative" ref={memorySearchBoxRef}>
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search campaigns..."
                        value={memorySearch}
                        onChange={(e) => { setMemorySearch(e.target.value); setVisibleCampaignsCount(CAMPAIGNS_LOAD_BATCH); }}
                        onFocus={() => setIsMemorySearchFocused(true)}
                        className="w-full h-12 pl-10 pr-3 text-base border border-gray-200 rounded-lg bg-white outline-none focus:border-[#6C60FF]"
                      />
                      {isMemorySearchFocused && memorySearch.trim() && (
                        <div
                          className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 md:max-h-72 overflow-y-auto modal-scrollbar"
                          style={{ zIndex: 100002 }}
                        >
                          {memorySearchSuggestions.length === 0 ? (
                            <div className="px-3 py-3 text-sm text-gray-400">No campaigns found</div>
                          ) : (
                            memorySearchSuggestions.map((m: any) => {
                              const id = String(m.id);
                              const isChecked = selectedMemoryIds.includes(id);
                              const loc = typeof m.location === 'string' ? m.location : (m.location?.formatted || m.location?.address || '');
                              const thumb = m.image_link || m.last_update_img || m.thumbnail || '';
                              // No campaign image → fall back to the author's profile, same as the list below.
                              const profile = m.author || m.user || user || {};
                              const profileImg = profile.profile_image || profile.avatar || '';
                              const rawColor = profile.profile_color;
                              const profileColor = rawColor ? (rawColor.startsWith('#') ? rawColor : `#${rawColor}`) : '#6C60FF';
                              const profileInitial = (profile.name || m.title || 'U').charAt(0).toUpperCase();
                              return (
                                <button
                                  type="button"
                                  key={id}
                                  onClick={() => {
                                    setSelectedMemoryIds(prev =>
                                      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                                    );
                                    setIsMemorySearchFocused(false);
                                  }}
                                  className={`w-full flex items-center gap-3 md:gap-2.5 px-5 py-5 md:px-3 md:py-2.5 text-left border-b border-gray-100 last:border-b-0 transition-colors ${
                                    isChecked ? 'bg-[#6C60FF]/5' : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <input type="checkbox" checked={isChecked} readOnly className="w-5 h-5 md:w-4 md:h-4 rounded accent-[#6C60FF] flex-shrink-0" />
                                  <div className="w-14 h-14 md:w-9 md:h-9 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                                    {thumb ? (
                                      isCampaignVideoUrl(thumb)
                                        ? <CampaignVideoThumbnail src={thumb} className="w-full h-full object-cover" />
                                        : <img src={thumb} alt={m.title} className="w-full h-full object-cover" />
                                    ) : profileImg ? (
                                      <img src={profileImg} alt={profile.name || m.title} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: profileColor }}>
                                        <span className="text-white font-bold text-base md:text-xs uppercase">{profileInitial}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-base md:text-sm font-medium text-gray-900 truncate">{m.title || 'Untitled'}</p>
                                    {loc && <p className="text-sm md:text-xs text-gray-500 truncate">{loc}</p>}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                    <div className="create-memory-select w-[22%] max-w-[76px] shrink-0">
                      <Select
                        value={memoryCategoryFilter}
                        onValueChange={(value) => { setMemoryCategoryFilter(value); setVisibleCampaignsCount(CAMPAIGNS_LOAD_BATCH); }}
                      >
                        <SelectTrigger className="!h-12 text-base bg-gray-50 border-gray-200 outline-none transition-colors [&:focus-visible]:!border-gray-300 [&:focus-visible]:!ring-gray-300/50 [&:focus-visible]:!ring-2 [&:focus]:!border-gray-300 [&:focus]:!ring-gray-300/50 [&:focus]:!ring-2">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent style={{ zIndex: 100001, border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} className="!border-gray-200 !shadow-md">
                          <SelectItem value="All Categories">All</SelectItem>
                          {apiCategories.map((c: any) => (
                            <SelectItem key={c.id || c.name} value={c.name}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryColor(c.name) }} />
                                {c.name}
                              </div>
                            </SelectItem>
                          ))}
                          {carsAvailable && (
                            <SelectItem value={CARS_CATEGORY_NAME}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryColor(CARS_CATEGORY_NAME) }} />
                                {CARS_CATEGORY_NAME}
                              </div>
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(memoriesLoading || shopifyCollectionsLoading || carsForPickerLoading) ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-[#6C60FF]" />
                    </div>
                  ) : (() => {
                    const pickerSource = existingCampaignsPickerSource;
                    const filtered = pickerSource.filter((m: any) => {
                      const locStr = typeof m.location === 'string' ? m.location : (m.location?.formatted || m.location?.address || '');
                      const matchSearch = !memorySearch || (m.title || '').toLowerCase().includes(memorySearch.toLowerCase()) || locStr.toLowerCase().includes(memorySearch.toLowerCase());
                      const matchCat = memoryCategoryFilter === 'All Categories' || (m.category?.name || m.category || '') === memoryCategoryFilter;
                      return matchSearch && matchCat;
                    });
                    const visibleItems = filtered.slice(0, visibleCampaignsCount);
                    const allSelected = filtered.length > 0 && filtered.every((m: any) => selectedMemoryIds.includes(String(m.id)));

                    return (
                      <>
                        {/* Select All / Deselect All */}
                        <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-100">
                          <span className="text-xs font-medium text-[#6C60FF] bg-[#6C60FF]/10 px-2 py-0.5 rounded-full">
                            {selectedMemoryIds.length} selected
                          </span>
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => setSelectedMemoryIds(filtered.map((m: any) => String(m.id)))}
                              className="text-[#6C60FF] font-medium hover:underline"
                            >Select All</button>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => setSelectedMemoryIds([])}
                              className="text-gray-500 font-medium hover:underline"
                            >Deselect All</button>
                          </div>
                        </div>

                        {/* Memory list — each campaign is its own bordered card. Fixed-height,
                            internally scrollable; more items load in as you near the bottom. */}
                        {visibleItems.length === 0 ? (
                          <div className="py-6 text-center text-sm text-gray-400">No campaigns found</div>
                        ) : (
                          <div
                            className="space-y-2 p-3 bg-white max-h-80 overflow-y-auto modal-scrollbar"
                            onScroll={(e) => {
                              const el = e.currentTarget;
                              if (
                                visibleCampaignsCount < filtered.length &&
                                el.scrollTop + el.clientHeight >= el.scrollHeight - 80
                              ) {
                                setVisibleCampaignsCount(prev => Math.min(prev + CAMPAIGNS_LOAD_BATCH, filtered.length));
                              }
                            }}
                          >
                            {visibleItems.map((m: any) => {
                              const id = String(m.id);
                              const isChecked = selectedMemoryIds.includes(id);
                              const thumb = m.image_link || m.last_update_img || m.thumbnail || '';
                              const loc = typeof m.location === 'string' ? m.location : (m.location?.formatted || m.location?.address || 'Unknown location');
                              const count = m.posts_count || m.photos?.count || m.photos_count || m.media_count || m.new_images || 0;
                              // No campaign image → fall back to the author's profile (choice A:
                              // campaign owner, else the logged-in user). Profile image first,
                              // otherwise a colored box with the author's initial.
                              const profile = m.author || m.user || user || {};
                              const profileImg = profile.profile_image || profile.avatar || '';
                              const rawColor = profile.profile_color;
                              const profileColor = rawColor ? (rawColor.startsWith('#') ? rawColor : `#${rawColor}`) : '#6C60FF';
                              const profileInitial = (profile.name || m.title || 'U').charAt(0).toUpperCase();
                              return (
                                <div
                                  key={id}
                                  className={`flex items-center gap-4 px-3 py-3.5 rounded-xl border cursor-pointer transition-colors ${
                                    isChecked
                                      ? 'border-[#6C60FF] bg-[#6C60FF]/5'
                                      : 'border-gray-200 bg-white hover:bg-gray-50'
                                  }`}
                                  onClick={() => setSelectedMemoryIds(prev =>
                                    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    readOnly
                                    className="w-5 h-5 rounded accent-[#6C60FF] flex-shrink-0"
                                  />
                                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                    {thumb ? (
                                      isCampaignVideoUrl(thumb)
                                        ? <CampaignVideoThumbnail src={thumb} className="w-full h-full object-cover" />
                                        : <img src={thumb} alt={m.title} className="w-full h-full object-cover" />
                                    ) : profileImg ? (
                                      <img src={profileImg} alt={profile.name || m.title} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: profileColor }}>
                                        <span className="text-white font-bold text-xl uppercase">{profileInitial}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-base font-medium text-gray-900 truncate">{m.title || 'Untitled'}</p>
                                    <p className="text-sm text-gray-500 truncate">{loc} · {count} images</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Intro Video */}
            <div>
              <label className="flex items-center gap-2 text-base md:text-sm font-medium text-gray-700 mb-1">
                <Video className="w-4 h-4 text-black" />
                Intro Video
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                ref={introVideoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0] || null;
                  e.target.value = '';
                  if (!file) return;
                  setIntroVideo(file);
                  setIntroVideoUrl(null);
                  setIsUploadingVideo(true);
                  setVideoUploadProgress(0);
                  try {
                    const token = localStorage.getItem('stasht_token');
                    const uploadFormData = new FormData();
                    uploadFormData.append('video', file);
                    // Tick 1% per second up to 90%, wait for server to reach 100%
                    let currentProgress = 0;
                    const timer = setInterval(() => {
                      currentProgress = Math.min(90, currentProgress + 1);
                      setVideoUploadProgress(currentProgress);
                    }, 1000);

                    await new Promise<void>((resolve, reject) => {
                      const xhr = new XMLHttpRequest();
                      xhr.onload = () => {
                        clearInterval(timer);
                        try {
                          setVideoUploadProgress(100);
                          const data = JSON.parse(xhr.responseText);
                          if (data?.fileUrl) setIntroVideoUrl(data.fileUrl);
                          resolve();
                        } catch { reject(new Error('Invalid response')); }
                      };
                      xhr.onerror = () => { clearInterval(timer); reject(new Error('Upload failed')); };
                      xhr.open('POST', `${getApiBaseUrl()}/memories/upload-video`);
                      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                      xhr.send(uploadFormData);
                    });
                  } catch (err) {
                    console.error('Intro video upload failed:', err);
                  } finally {
                    setIsUploadingVideo(false);
                    setVideoUploadProgress(0);
                  }
                }}
              />
              {introVideo ? (
                <div className="flex items-center justify-between gap-2 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2 min-w-0">
                    {isUploadingVideo ? (
                      <Loader2 className="w-4 h-4 text-[#6C60FF] flex-shrink-0" style={{ animation: 'spin 2s linear infinite' }} />
                    ) : (
                      <Video className="w-4 h-4 text-[#6C60FF] flex-shrink-0" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-gray-700 truncate">{introVideo.name}</span>
                      {isUploadingVideo && (
                        <span className="text-xs text-[#6C60FF]">Uploading... {videoUploadProgress}%</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setIntroVideo(null); setIntroVideoUrl(null); }}
                    className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
                    if (isMobile) {
                      setIsVideoRecorderOpen(true);
                    } else {
                      introVideoInputRef.current?.click();
                    }
                  }}
                  className="w-full h-12 md:h-10 border border-gray-300 rounded-lg text-base md:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Add Intro Video
                </button>
              )}
            </div>

            {/* Media Upload */}
            <div>
              <label className="flex items-center gap-2 text-base md:text-sm font-medium text-gray-700 mb-1">
                <Camera className="w-4 h-4 text-black" />
                Media
              </label>
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-gray-300 transition-colors"
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.heic,.heif"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="create-memory-file-upload"
                />

                {!isUploading && !(formData.mediaFiles.length > 0 || photosWithMetadata.length > 0 || mainPhotosArray.length > 0) && (
                  <>
                    <div className="w-12 h-12 mx-auto mb-3 text-gray-400">
                      <Upload className="w-full h-full" />
                    </div>

                    {/* Mobile: Direct file picker button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mb-2 h-9 px-4 text-sm bg-white border-[#7B68EE] text-[#7B68EE] hover:bg-[#7B68EE]/5 md:hidden"
                      disabled={isExtractingMetadata}
                      onClick={() => document.getElementById('create-memory-file-upload')?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Choose Files
                    </Button>

                    {/* Desktop: Popover menu */}
                    <Popover.Root open={isFileMenuOpen} onOpenChange={setIsFileMenuOpen}>
                      <Popover.Trigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mb-2 h-9 px-4 text-sm bg-white border-[#7B68EE] text-[#7B68EE] hover:bg-[#7B68EE]/5 hidden md:inline-flex"
                          disabled={isExtractingMetadata}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Choose Files
                        </Button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content
                          className="w-64 p-2 bg-white border border-gray-200 shadow-lg rounded-lg z-[100001]"
                          align="center"
                          sideOffset={5}
                        >
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => {
                                setIsFileMenuOpen(false);
                                document.getElementById('create-memory-file-upload')?.click();
                              }}
                              className="flex items-start gap-3 px-3 py-3 hover:bg-gray-100 rounded-lg text-left transition-colors"
                            >
                              <div className="flex-shrink-0 mt-0.5">
                                <Upload className="w-5 h-5 text-[#7B68EE]" />
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">Upload from Desktop</div>
                                <div className="text-xs text-gray-500 mt-0.5">Choose files from your computer</div>
                              </div>
                            </button>
                            <button
                              onClick={() => {
                                setIsFileMenuOpen(false);
                                setIsMediaLibraryModalOpen(true);
                              }}
                              className="flex items-start gap-3 px-3 py-3 hover:bg-gray-100 rounded-lg text-left transition-colors"
                            >
                              <div className="flex-shrink-0 mt-0.5">
                                <ImageIcon className="w-5 h-5 text-[#7B68EE]" />
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">Add from Media Library</div>
                                <div className="text-xs text-gray-500 mt-0.5">Choose from uploaded media</div>
                              </div>
                            </button>
                          </div>
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  </>
                )}

                {isUploading && uploadProgress.length > 0 ? (
                  <div className="text-left mt-1">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        uploadProgress.every(i => i.status === 'complete') ? 'bg-green-100' :
                        uploadProgress.some(i => i.status === 'error') ? 'bg-red-100' : 'bg-blue-100'
                      }`}>
                        {uploadProgress.every(i => i.status === 'complete') ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : uploadProgress.some(i => i.status === 'error') ? (
                          <X className="w-5 h-5 text-red-600" />
                        ) : (
                          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          {uploadProgress.every(i => i.status === 'complete') ? 'Upload Complete' : 'Uploading Files...'}
                        </h3>
                        <p className="text-xs text-gray-500">{uploadedFilesCount} files processed</p>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-500">
                          {uploadProgress.filter(i => i.status === 'complete').length} of {uploadProgress.length} files uploaded
                        </span>
                        <span className="text-xs text-gray-500">
                          {Math.round((uploadProgress.filter(i => i.status === 'complete').length / uploadProgress.length) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${(uploadProgress.filter(i => i.status === 'complete').length / uploadProgress.length) * 100}%` }}
                        />
                      </div>
                    </div>
                    {/* Files List */}
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-2">Files:</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {uploadProgress.map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="text-xs text-gray-700 truncate">{item.fileName}</span>
                            </div>
                            <div className="flex-shrink-0 ml-2">
                              {item.status === 'uploading' && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
                              {item.status === 'complete' && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                              {item.status === 'error' && <X className="w-3.5 h-3.5 text-red-500" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {!(formData.mediaFiles.length > 0 || photosWithMetadata.length > 0 || mainPhotosArray.length > 0) && (
                      <>
                        <p className="text-xs text-gray-500">Upload photos or drag and drop</p>
                        <p className="text-xs text-gray-500">JPG, JPEG, PNG up to 10MB</p>
                      </>
                    )}
                  </>
                )}
                {/* Selected files list — shown inside the upload box */}
                {(formData.mediaFiles.length > 0 || photosWithMetadata.length > 0 || mainPhotosArray.length > 0) && (
                  <div className="mt-3 hidden md:block text-left">
                    <p className="text-xs text-gray-600 mb-1">
                      {Math.max(formData.mediaFiles.length, photosWithMetadata.length, mainPhotosArray.length)} files selected
                      {photosWithMetadata.filter(p => p.metadata_extracted).length > 0 && (
                        <span className="text-green-600 ml-1">
                          • {photosWithMetadata.filter(p => p.metadata_extracted).length} with EXIF data
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(() => {
                        let photosToDisplay: any[] = [];
                        if (photosWithMetadata.length > 0) {
                          photosToDisplay = photosWithMetadata;
                        } else if (mainPhotosArray.length > 0) {
                          photosToDisplay = mainPhotosArray.map(photo => ({
                            ...photo,
                            metadata_extracted: true,
                            file: null
                          }));
                        }
                        return photosToDisplay.map((photo, index) => {
                          const hasMetadata = photo?.metadata_extracted;
                          const hasLocation = photo?.location && photo.location.trim() !== '';
                          const hasDate = photo?.capture_date && photo.capture_date.trim() !== '';
                          return (
                            <div key={index} className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded relative">
                              <span>{photo.name}</span>
                              {hasMetadata && (
                                <div className="flex gap-1 ml-1">
                                  {hasLocation && <span className="text-blue-600" title="Location available">📍</span>}
                                  {hasDate && <span className="text-green-600" title="Date available">📅</span>}
                                </div>
                              )}
                              {mainPhotosArray.length > 0 && mainPhotosArray[index] && (
                                <button
                                  type="button"
                                  onClick={() => { setEditingPhotoIndex(index); setIsAddMomentOpen(true); }}
                                  className="text-[#6C60FF] hover:text-[#5B52FF] ml-1"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveMediaFile(index)}
                                className="text-gray-600 hover:text-gray-800 ml-1"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    {/* Add Media button — desktop */}
                    <div className="mt-3">
                      <Popover.Root open={isFileMenuOpen} onOpenChange={setIsFileMenuOpen}>
                        <Popover.Trigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 px-4 text-sm bg-white border-[#7B68EE] text-[#7B68EE] hover:bg-[#7B68EE]/5"
                            disabled={isExtractingMetadata}
                          >
                            Add Media
                          </Button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            className="w-64 p-2 bg-white border border-gray-200 shadow-lg rounded-lg z-[100001]"
                            align="start"
                            sideOffset={5}
                          >
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => { setIsFileMenuOpen(false); document.getElementById('create-memory-file-upload')?.click(); }}
                                className="flex items-start gap-3 px-3 py-3 hover:bg-gray-100 rounded-lg text-left transition-colors"
                              >
                                <Upload className="w-5 h-5 text-[#7B68EE] flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">Upload from Desktop</div>
                                  <div className="text-xs text-gray-500 mt-0.5">Choose files from your computer</div>
                                </div>
                              </button>
                              <button
                                onClick={() => { setIsFileMenuOpen(false); setIsMediaLibraryModalOpen(true); }}
                                className="flex items-start gap-3 px-3 py-3 hover:bg-gray-100 rounded-lg text-left transition-colors"
                              >
                                <ImageIcon className="w-5 h-5 text-[#7B68EE] flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">Add from Media Library</div>
                                  <div className="text-xs text-gray-500 mt-0.5">Choose from uploaded media</div>
                                </div>
                              </button>
                            </div>
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile-only Image Preview Grid */}
              {(formData.mediaFiles.length > 0 || photosWithMetadata.length > 0 || mainPhotosArray.length > 0) && (
                <div className="mt-3 md:hidden">
                  <div className="grid grid-cols-3 gap-2">
                    {(() => {
                      // Get images to display
                      let imagesToDisplay: Array<{ file?: File; fileUrl?: string; name: string }> = [];

                      if (photosWithMetadata.length > 0) {
                        imagesToDisplay = photosWithMetadata.map(p => ({
                          file: p.file,
                          fileUrl: p.fileUrl,
                          name: p.name
                        }));
                      } else if (mainPhotosArray.length > 0) {
                        imagesToDisplay = mainPhotosArray.map(p => ({
                          fileUrl: p.fileUrl,
                          name: p.name
                        }));
                      } else if (formData.mediaFiles.length > 0) {
                        imagesToDisplay = formData.mediaFiles.map(f => ({
                          file: f,
                          name: f.name
                        }));
                      }

                      return imagesToDisplay.map((img, index) => {
                        // Create preview URL from file or use existing fileUrl
                        const previewUrl = img.file ? URL.createObjectURL(img.file) : img.fileUrl;

                        return (
                          <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                            {previewUrl ? (
                              <img
                                src={previewUrl}
                                alt={img.name}
                                className="w-full h-full object-cover"
                                onLoad={() => {
                                  // Revoke object URL after image loads to free memory (only for blob URLs)
                                  if (img.file && previewUrl.startsWith('blob:')) {
                                    // Don't revoke immediately, let it render first
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                            {/* Edit button — only for Add Moment uploaded images */}
                            {mainPhotosArray.length > 0 && mainPhotosArray[index] && (
                              <button
                                type="button"
                                onClick={() => { setEditingPhotoIndex(index); setIsAddMomentOpen(true); }}
                                className="absolute top-1 left-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-[#6C60FF]/90"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </button>
                            )}
                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveMediaFile(index)}
                              className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    {Math.max(formData.mediaFiles.length, photosWithMetadata.length, mainPhotosArray.length)} photo(s) selected
                  </p>
                  {/* Add Media button — mobile */}
                  <div className="mt-3 flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 px-4 text-sm bg-white border-[#7B68EE] text-[#7B68EE] hover:bg-[#7B68EE]/5"
                      disabled={isExtractingMetadata}
                      onClick={() => document.getElementById('create-memory-file-upload')?.click()}
                    >
                      Add Media
                    </Button>
                  </div>
                </div>
              )}

            </div>

            {/* Property (optional, only on personal account) */}
            {viewType !== 'property' && apiProperties.length > 0 && (
              <div>
                <label className="block text-base md:text-sm font-medium text-gray-700 mb-1">
                  Property <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  {/* Click-outside overlay */}
                  {showPropertyDropdown && (
                    <div className="fixed inset-0" style={{ zIndex: 100001 }} onClick={() => setShowPropertyDropdown(false)} />
                  )}
                  {/* Trigger */}
                  <button
                    type="button"
                    onClick={() => { setShowPropertyDropdown(prev => !prev); setPropertySearch(''); }}
                    className="w-full h-12 md:h-10 px-3 border border-gray-200 rounded-lg bg-gray-50 hover:bg-white hover:border-gray-300 transition-colors text-left flex items-center gap-2"
                  >
                    {formData.property.length === 0 ? (
                      <span className="text-sm text-gray-400">Select property</span>
                    ) : formData.property.length === 1 ? (() => {
                      const sel = apiProperties.find(p => p.id.toString() === formData.property[0]);
                      return sel ? (
                        <>
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                            {sel.image ? (
                              <img src={sel.image} alt={sel.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-[#6C60FF] text-white text-xs font-semibold">
                                {sel.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="text-sm text-gray-900 truncate">{sel.name}</span>
                        </>
                      ) : null;
                    })() : (
                      <span className="text-sm text-gray-900 font-medium">{formData.property.length} properties selected</span>
                    )}
                  </button>

                  {/* Dropdown */}
                  {showPropertyDropdown && (
                    <div className="relative w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden flex flex-col" style={{ zIndex: 100002 }}>
                      {/* Search + Select All */}
                      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                        {/* Select All checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const allIds = apiProperties.map(p => p.id.toString());
                            const allSelected = allIds.every(id => formData.property.includes(id));
                            setFormData(prev => ({ ...prev, property: allSelected ? [] : allIds }));
                          }}
                          className="flex-shrink-0"
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${apiProperties.length > 0 && apiProperties.every(p => formData.property.includes(p.id.toString())) ? 'bg-[#6C60FF] border-[#6C60FF]' : 'border-gray-300 bg-white'}`}>
                            {apiProperties.length > 0 && apiProperties.every(p => formData.property.includes(p.id.toString())) && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            )}
                          </div>
                        </button>
                        {/* Search */}
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search properties..."
                            value={propertySearch}
                            onChange={(e) => setPropertySearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#6C60FF] bg-white"
                          />
                        </div>
                      </div>

                      {/* List */}
                      <div className="overflow-y-auto max-h-48">
                        {(() => {
                          const filtered = apiProperties.filter(p => !propertySearch.trim() || p.name.toLowerCase().includes(propertySearch.toLowerCase()));
                          if (filtered.length === 0) return <div className="px-3 py-4 text-center text-sm text-gray-400">No properties found</div>;
                          return filtered.map((property) => {
                            const isChecked = formData.property.includes(property.id.toString());
                            return (
                              <button
                                key={property.id}
                                type="button"
                                onClick={() => {
                                  const id = property.id.toString();
                                  setFormData(prev => ({
                                    ...prev,
                                    property: prev.property.includes(id)
                                      ? prev.property.filter(x => x !== id)
                                      : [...prev.property, id]
                                  }));
                                }}
                                className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 text-left ${isChecked ? 'bg-purple-50' : ''}`}
                              >
                                {/* Checkbox */}
                                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${isChecked ? 'bg-[#6C60FF] border-[#6C60FF]' : 'border-gray-300 bg-white'}`}>
                                  {isChecked && (
                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  )}
                                </div>
                                {/* Image */}
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                  {property.image ? (
                                    <img src={property.image} alt={property.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-[#6C60FF] text-white text-sm font-semibold">
                                      {property.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                {/* Name + location */}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">{property.name}</div>
                                  {property.location && (
                                    <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                      <MapPin className="w-3 h-3" />{property.location}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Date */}
            <div>
              <label className="flex items-center gap-2 text-base md:text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 text-black" />
                Date
              </label>
              <Input
                type="date"
                value={formData.date}
                onChange={handleDateChange}
                className={`h-12 md:h-10 text-base md:text-sm bg-gray-50 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 transition-colors ${
                  isTypingDate 
                    ? 'border-black focus:border-black focus-visible:border-black' 
                    : 'border-gray-200 focus:border-gray-200 focus-visible:border-gray-200'
                }`}
              />
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="endDateCheckbox"
                  checked={showEndDate}
                  onChange={(e) => {
                    setShowEndDate(e.target.checked);
                    if (!e.target.checked) {
                      setFormData(prev => ({ ...prev, endDate: '' }));
                    }
                  }}
                  className="w-5 h-5 md:w-4 md:h-4 bg-gray-100 border-gray-300 rounded focus:ring-2 focus:ring-[#6C60FF] accent-[#6C60FF]"
                />
                <label htmlFor="endDateCheckbox" className="text-base md:text-xs text-gray-600 cursor-pointer">
                  Add end date
                </label>
              </div>
              
              {/* End Date Field */}
              {showEndDate && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={handleEndDateChange}
                    className={`text-sm bg-gray-50 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 transition-colors ${
                      isTypingEndDate 
                        ? 'border-black focus:border-black focus-visible:border-black' 
                        : 'border-gray-200 focus:border-gray-200 focus-visible:border-gray-200'
                    }`}
                    min={formData.date || undefined}
                  />
                </div>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="flex items-center gap-2 text-base md:text-sm font-medium text-gray-700 mb-1">
                <MapPin className="w-4 h-4 text-black" />
                Location <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <GooglePlacesInput
                value={formData.location}
                onChange={handleLocationChange}
                placeholder="Enter location (e.g. Paris, France or Home)"
                className={`h-12 md:h-10 text-base md:text-sm bg-gray-50 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-1 focus-visible:ring-1 transition-colors ${
                  isTypingLocation 
                    ? 'border-black focus:border-black focus:ring-black focus-visible:border-black focus-visible:ring-black' 
                    : 'border-gray-200 focus:border-gray-200 focus:ring-gray-200 focus-visible:border-gray-200 focus-visible:ring-gray-200'
                }`}
                onPlaceSelect={(place) => {
                  console.log('Selected place in CreateMemory:', place);
                  // You can add additional logic here when a place is selected
                }}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="flex items-center gap-2 text-base md:text-sm font-medium text-gray-700 mb-1">
                <Tag className="w-4 h-4 text-black" />
                Tags <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {formData.tags.map((tag, index) => (
                    <span key={index} className="flex items-center gap-1 px-2.5 py-1 bg-gray-200 text-gray-900 text-[10.5px] font-normal rounded-full border border-gray-300">
                      {tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-red-500 leading-none ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={currentTag}
                  onChange={handleTagChange}
                  placeholder="Add tags separated by commas (e.g. beach, summer, 2024)"
                  className={`flex-1 h-12 md:h-10 text-base md:text-sm bg-gray-50 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-1 focus-visible:ring-1 transition-colors ${
                    isTypingTag
                      ? 'border-black focus:border-black focus:ring-black focus-visible:border-black focus-visible:ring-black'
                      : 'border-gray-200 focus:border-gray-200 focus:ring-gray-200 focus-visible:border-gray-200 focus-visible:ring-gray-200'
                  }`}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button
                  type="button"
                  onClick={handleAddTag}
                  size="sm"
                  disabled={!currentTag.trim()}
                  className="text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add
                </Button>
              </div>
            </div>


            {/* Label */}
            <div>
              <label className="flex items-center gap-2 text-base md:text-sm font-medium text-gray-700 mb-1">
                <Tag className="w-4 h-4 text-black" />
                Labels <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const trimmed = labelInput.trim();
                      if (trimmed) {
                        setFormData(prev => ({ ...prev, label: trimmed }));
                        setLabelInput('');
                      }
                    }
                  }}
                  placeholder="Add a label..."
                  className="flex-1 h-12 md:h-10 px-3 text-base md:text-sm bg-gray-50 border border-gray-200 rounded-md outline-none focus:border-gray-300 transition-colors"
                />
                <button
                  type="button"
                  disabled={!labelInput.trim()}
                  onClick={() => {
                    const trimmed = labelInput.trim();
                    if (trimmed) {
                      setFormData(prev => ({ ...prev, label: trimmed }));
                      setLabelInput('');
                    }
                  }}
                  className="px-4 h-12 md:h-10 text-base md:text-sm font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              {apiLabels.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs text-gray-500 font-medium">Existing:</span>
                  {apiLabels.map((lbl: any) => (
                    <button
                      key={lbl.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, label: prev.label === lbl.name ? '' : lbl.name }))}
                      className={`px-3 py-1 text-xs rounded-full border border-[#FEC53D] text-black transition-colors ${
                        formData.label === lbl.name ? 'ring-2 ring-offset-1 ring-[#FEC53D]' : ''
                      }`}
                      style={{ backgroundColor: '#FFD46033' }}
                    >
                      {lbl.name}
                    </button>
                  ))}
                </div>
              )}
              {formData.label && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-gray-500">Selected:</span>
                  <span className="px-2 py-0.5 text-xs border border-[#FEC53D] text-black rounded-full font-medium" style={{ backgroundColor: '#FFD46033' }}>{formData.label}</span>
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, label: '' }))} className="text-gray-400 hover:text-gray-600 ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Collaborators */}
            <div>
              <label className="flex items-center gap-2 text-base md:text-sm font-medium text-gray-700 mb-1">
                <Users className="w-4 h-4 text-black" />
                Add Users <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <p className="text-sm text-gray-600 mb-3">
                Share this campaign with specific people by adding their phone numbers or email addresses.
              </p>
              {/* Phone / Email tab switcher */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                  <button
                    type="button"
                    className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                      collaboratorMethod === 'phone'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => {
                      setCollaboratorMethod('phone');
                      setCurrentCollaborator('');
                      setCollaboratorError('');
                    }}
                  >
                    Phone
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                      collaboratorMethod === 'email'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => {
                      setCollaboratorMethod('email');
                      setCurrentCollaborator('');
                      setCollaboratorError('');
                    }}
                  >
                    Email
                  </button>
                </div>
                <span className="text-sm text-gray-500">
                  · {collaboratorMethod === 'phone' ? 'Add by phone number' : 'Add by email address'}
                </span>
              </div>
              <div className="flex items-stretch gap-2 mb-3">
                <div className="relative flex-1" ref={collaboratorSearchRef}>
                  <Input
                    type={collaboratorMethod === 'phone' ? 'tel' : 'email'}
                    value={currentCollaborator}
                    onChange={handleCollaboratorChange}
                    placeholder={collaboratorMethod === 'phone' ? '+1-493-944-0939' : 'Enter email address...'}
                    className={`w-full text-sm bg-gray-100 border-0 rounded-lg h-10 px-4 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-2 focus-visible:ring-2 transition-all ${
                      collaboratorError
                        ? 'focus:ring-red-400 focus-visible:ring-red-400'
                        : 'focus:ring-gray-300 focus-visible:ring-gray-300'
                    }`}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCollaborator()}
                  />

                  {/* Live search dropdown of matching users */}
                  {currentCollaborator.trim().length >= 2 && (isSearchingCollaborators || collaboratorSearchResults.length > 0) && (
                    <div className="absolute top-full left-0 right-0 mt-1 border border-gray-200 rounded-lg max-h-60 overflow-y-auto bg-white shadow-lg z-50">
                      {isSearchingCollaborators ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          Searching...
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {collaboratorSearchResults.map((user: any) => (
                            <div
                              key={user.id}
                              className="p-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => handleSelectCollaboratorFromSearch(user)}
                            >
                              <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0">
                                {user.name ? user.name.charAt(0).toUpperCase() : (collaboratorMethod === 'email' ? user.email?.charAt(0).toUpperCase() : user.phone_number?.charAt(0))}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 text-sm truncate">{user.name || 'User'}</p>
                                <p className="text-xs text-gray-600 truncate">
                                  {collaboratorMethod === 'email' ? user.email : user.phone_number}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={handleAddCollaborator}
                  disabled={!currentCollaborator.trim()}
                  className="text-sm font-semibold bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-lg h-10 px-5 shadow-sm"
                >
                  Add
                </Button>
              </div>
              {collaboratorError && (
                <p className="text-xs text-red-500 mb-2 -mt-1">{collaboratorError}</p>
              )}

              {/* Recent collaborators - Show first */}
              {apiRecentCollaborators.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Recent collaborators</p>
                  <div className="grid grid-cols-2 gap-2">
                    {apiRecentCollaborators.slice(0, 2).map((contact) => (
                      <div key={contact.id || contact.user_id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
                        <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {contact.name ? contact.name.charAt(0).toUpperCase() : contact.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{contact.name || 'User'}</p>
                          <p className="text-xs text-gray-500 truncate">{contact.email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!formData.collaborators.includes(contact.email)) {
                              setFormData(prev => ({
                                ...prev,
                                collaborators: [...prev.collaborators, contact.email]
                              }));
                            }
                          }}
                          disabled={formData.collaborators.includes(contact.email)}
                          className="w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 text-gray-600 disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {apiRecentCollaborators.length > 2 && (
                    <div className="mt-2">
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
                        <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {apiRecentCollaborators[2].name ? apiRecentCollaborators[2].name.charAt(0).toUpperCase() : apiRecentCollaborators[2].email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{apiRecentCollaborators[2].name || 'User'}</p>
                          <p className="text-xs text-gray-500 truncate">{apiRecentCollaborators[2].email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!formData.collaborators.includes(apiRecentCollaborators[2].email)) {
                              setFormData(prev => ({
                                ...prev,
                                collaborators: [...prev.collaborators, apiRecentCollaborators[2].email]
                              }));
                            }
                          }}
                          disabled={formData.collaborators.includes(apiRecentCollaborators[2].email)}
                          className="w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 text-gray-600 disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Frequent collaborators - Show after recent */}
              {apiFrequentCollaborators.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Frequent collaborators</p>
                  <div className="grid grid-cols-2 gap-2">
                    {apiFrequentCollaborators.slice(0, 2).map((contact) => (
                      <div key={contact.id || contact.user_id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
                        <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {contact.name ? contact.name.charAt(0).toUpperCase() : contact.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{contact.name || 'User'}</p>
                          <p className="text-xs text-gray-500 truncate">{contact.email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!formData.collaborators.includes(contact.email)) {
                              setFormData(prev => ({
                                ...prev,
                                collaborators: [...prev.collaborators, contact.email]
                              }));
                            }
                          }}
                          disabled={formData.collaborators.includes(contact.email)}
                          className="w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 text-gray-600 disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {apiFrequentCollaborators.length > 2 && (
                    <div className="mt-2">
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
                        <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {apiFrequentCollaborators[2].name ? apiFrequentCollaborators[2].name.charAt(0).toUpperCase() : apiFrequentCollaborators[2].email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{apiFrequentCollaborators[2].name || 'User'}</p>
                          <p className="text-xs text-gray-500 truncate">{apiFrequentCollaborators[2].email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!formData.collaborators.includes(apiFrequentCollaborators[2].email)) {
                              setFormData(prev => ({
                                ...prev,
                                collaborators: [...prev.collaborators, apiFrequentCollaborators[2].email]
                              }));
                            }
                          }}
                          disabled={formData.collaborators.includes(apiFrequentCollaborators[2].email)}
                          className="w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 text-gray-600 disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {formData.collaborators.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Selected collaborators</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.collaborators.map((collaborator, index) => (
                      <div key={index} className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                        <Users className="w-3 h-3" />
                        {collaborator}
                        <button
                          type="button"
                          onClick={() => handleRemoveCollaborator(collaborator)}
                          className="ml-1 text-green-600 hover:text-green-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Personalized message — appears once a collaborator is added.
                      The author name is a fixed (non-editable) prefix; the rest is editable. */}
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Personalized Message<span className="text-red-500">*</span>
                    </p>
                    <div className={`relative border border-gray-300 rounded-lg px-3 py-3 focus-within:border-gray-400 ${isMasterMessage ? 'bg-gray-100' : 'bg-white'}`}>
                      {/* Author name: non-editable overlay sitting on the first line */}
                      <span
                        ref={personalizedNameRef}
                        className="absolute left-3 top-3 text-sm font-semibold text-gray-900 whitespace-nowrap pointer-events-none"
                      >
                        {user?.name || 'You'}
                      </span>
                      <textarea
                        value={personalizedMessage}
                        onChange={(e) => setPersonalizedMessage(e.target.value.slice(0, 200))}
                        onBlur={() => {
                          // Don't let the message be left empty — restore the default text
                          if (!personalizedMessage.trim()) {
                            setPersonalizedMessage('wants to share this with you!');
                          }
                        }}
                        placeholder="Pre-written message goes here."
                        rows={4}
                        maxLength={200}
                        disabled={isMasterMessage}
                        style={{ textIndent: personalizedNameWidth ? `${personalizedNameWidth}px` : undefined }}
                        className={`w-full h-28 p-0 resize-none text-sm bg-transparent outline-none border-0 focus:ring-0 placeholder:text-gray-400 ${isMasterMessage ? 'text-gray-500 cursor-not-allowed' : 'text-gray-800'}`}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-right">{personalizedMessage.length}/200 characters</p>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isMasterMessage}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsMasterMessage(checked);
                          if (checked) {
                            // Only restore the previously saved master message if the box still shows
                            // the plain default (i.e. the user hasn't typed a new message since unchecking).
                            // If they typed something new, keep it — that becomes the new master on save.
                            if (savedMasterMessage && personalizedMessage === 'wants to share this with you!') {
                              setPersonalizedMessage(savedMasterMessage);
                            }
                          } else {
                            // Turning off the master message reverts the box to the plain default
                            setPersonalizedMessage('wants to share this with you!');
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-[#6C60FF] focus:ring-[#6C60FF]"
                      />
                      <span className="text-sm text-gray-700">Set as my default message</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex flex-col gap-2 p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0 rounded-b-lg">
          {/* Row 1: Cancel + Save */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleModalClose}
              className="flex-1 text-sm text-gray-900 border-2 border-gray-400 hover:bg-gray-50 focus:ring-0 focus:outline-none !h-auto !py-4 md:!py-2"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={!formData.title.trim() || !formData.category || isSubmitting || isUploadingVideo}
              className="flex-1 text-sm text-gray-900 border-2 border-gray-900 hover:bg-gray-50 focus:ring-0 focus:outline-none disabled:border-gray-300 !h-auto !py-4 md:!py-2"
            >
              {isSubmitting ? (
                <><div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2"></div>Saving...</>
              ) : 'Create Campaign'}
            </Button>
          </div>
          {/* Row 2: Publish full width */}
          <Popover.Root open={publishPopoverOpen} onOpenChange={setPublishPopoverOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                disabled={!formData.title.trim() || !formData.category || isSubmitting || isUploadingVideo}
                className="w-full bg-[#7B68EE] hover:bg-[#6B5DD3] disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-medium rounded-md flex items-center justify-center gap-2 py-4 md:py-2"
              >
                <Globe className="w-4 h-4" />
                Publish
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="top"
                align="center"
                sideOffset={8}
                style={{ zIndex: 100002 }}
                className="w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 outline-none"
              >
                {[
                  { type: 2 as const, icon: <Eye className="w-5 h-5 text-gray-700" />, label: 'View Only', desc: 'Users can only view the campaign, no comments allowed' },
                  { type: 1 as const, icon: <Globe className="w-5 h-5 text-[#7B68EE]" />, label: 'Public', desc: 'Anyone can view and leave comments' },
                  { type: 3 as const, icon: <Lock className="w-5 h-5 text-orange-500" />, label: 'Private', desc: 'Only visible with a valid access token' },
                ].map(({ type, icon, label, desc }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { setPublishPopoverOpen(false); handleSubmit(true, type); }}
                    className="w-full flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="mt-0.5 flex-shrink-0">{icon}</div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Render modal in portal only when open */}
      {open && createPortal(modalContent, document.body)}

      {/* Success Dialog */}
      {createPortal(
        <MemoryCreatedDialog
          isOpen={showSuccessDialog && !!createdMemoryDetails}
          onClose={() => {
            setShowSuccessDialog(false);
            setCreatedMemoryDetails(null);
          }}
          memoryTitle={createdMemoryDetails?.title || ''}
          categoryName={createdMemoryDetails?.category || ''}
          location={createdMemoryDetails?.location}
        />,
        document.body
      )}
      
      {/* Memory Limit Dialog */}
      {createPortal(
        <MemoryLimitDialog
          isOpen={showLimitDialog}
          onClose={() => setShowLimitDialog(false)}
          memoryCount={limitData.current_memories}
          memoryLimit={limitData.memory_limit}
        />,
        document.body
      )}

      {/* EXIF Progress Modal - Separate Modal on Right Side */}
      <ExifProgressModal
        isOpen={showExifModal}
        onClose={() => setShowExifModal(false)}
        extractionResults={exifExtractionResults}
      />

      {/* Add Moment Modal - opens with selected images from media block */}
      {createPortal(
        <AddMomentModal
          isOpen={isAddMomentOpen}
          onClose={() => { setIsAddMomentOpen(false); setMomentFiles(null); setEditingPhotoIndex(null); }}
          capturedFiles={editingPhotoIndex !== null ? null : momentFiles}
          memoryTitle={formData.title || 'New Campaign'}
          memoryLocation={formData.location}
          editPhotoData={editingPhotoIndex !== null && mainPhotosArray[editingPhotoIndex] ? {
            index: editingPhotoIndex,
            name: mainPhotosArray[editingPhotoIndex].imageName || mainPhotosArray[editingPhotoIndex].name,
            fileUrl: mainPhotosArray[editingPhotoIndex].fileUrl || '',
            title: mainPhotosArray[editingPhotoIndex].title || '',
            description: mainPhotosArray[editingPhotoIndex].description || '',
            capture_date: mainPhotosArray[editingPhotoIndex].capture_date || '',
            location: mainPhotosArray[editingPhotoIndex].location || '',
            tags: mainPhotosArray[editingPhotoIndex].tags || [],
            originalSizeMB: mainPhotosArray[editingPhotoIndex].originalSizeMB || 0
          } : undefined}
          onAddMoment={(momentData) => {
            if (momentData?.editIndex !== undefined) {
              // Edit mode — update existing photo in mainPhotosArray
              if (momentData?.photos?.[0]) {
                setMainPhotosArray(prev => prev.map((photo, i) =>
                  i === momentData.editIndex ? { ...photo, ...momentData.photos[0] } : photo
                ));
              }
            } else if (momentData?.photos?.length > 0) {
              // Add mode — append new photos
              setMainPhotosArray(prev => [...prev, ...momentData.photos]);
            }
            setIsAddMomentOpen(false);
            setMomentFiles(null);
            setEditingPhotoIndex(null);
          }}
        />,
        document.body
      )}

      {/* Video Recorder Modal — mobile only */}
      {createPortal(
        <VideoRecorderModal
          isOpen={isVideoRecorderOpen}
          onClose={() => setIsVideoRecorderOpen(false)}
          onVideoReady={(fileUrl, fileName) => {
            // VideoRecorderModal already uploaded to S3 — just store display name + URL
            const fakeFile = Object.assign(new Blob([''], { type: 'video/mp4' }), { name: fileName, lastModified: Date.now() }) as any;
            setIntroVideo(fakeFile);
            setIntroVideoUrl(fileUrl);
            setIsVideoRecorderOpen(false);
          }}
        />,
        document.body
      )}

      {/* Media Library Selection Modal */}
      <MediaLibrarySelectionModal
        isOpen={isMediaLibraryModalOpen}
        onClose={() => setIsMediaLibraryModalOpen(false)}
        onConfirm={(selectedItems) => {
          console.log('📚 Selected items from media library:', selectedItems);

          // Convert selected media library images to the format used by mainPhotosArray
          const libraryPhotos = selectedItems.map(img => ({
            name: img.name || 'Untitled',
            location: img.location || '',
            capture_date: img.capture_date || img.captureDate || '',
            capture_time: img.capture_time || img.captureTime || '',
            fileUrl: img.image || img.fileUrl || '',
            imageName: img.imageName || img.name || '',
            originalSizeMB: img.originalSizeMB || 0
          }));

          // Add to mainPhotosArray
          setMainPhotosArray(prev => [...prev, ...libraryPhotos]);

          console.log('✅ Added media library images to mainPhotosArray:', libraryPhotos);
        }}
      />


    </>
  );
});

export default CreateMemory;