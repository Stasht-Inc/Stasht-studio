import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download, MapPin, Calendar, Heart, MessageCircle, Send, ChevronDown, MoreVertical, Edit, Trash2, Save, Linkedin, Facebook, Mail, Plus, Crop, Star, Tag } from "lucide-react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { Textarea } from "./ui/textarea";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { LocationInfoDialog } from "./LocationInfoDialog";
import { AddMomentModal } from "./AddMomentModal";
import { mediaAPI, Comment } from "../services/mediaAPI";
import { userDisplayUtils, dashboardAPI } from "../utils/authUtils";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

// User Avatar Component with Profile Image and Initials Fallback
function UserFallbackAvatar({
  user,
  size = 'w-8 h-8',
  className = ''
}: {
  user?: { name?: string; avatar?: string; profile_color?: string };
  size?: string;
  className?: string;
}) {
  const initials = userDisplayUtils.generateInitials(user?.name || '');

  // Use getUserDisplayColor which handles profile_color or generates consistent color based on name
  const backgroundColor = userDisplayUtils.getUserDisplayColor(user);
  const backgroundStyle = { backgroundColor };

  // Use consistent class for all avatars
  const fallbackClassName = `${size} rounded-full text-white font-medium text-xs flex items-center justify-center flex-shrink-0 ${className}`;

  if (user?.avatar) {
    // Show user profile image if available
    return (
      <div className={`${size} rounded-full overflow-hidden bg-gray-100 flex-shrink-0 ${className}`}>
        <img
          src={user.avatar}
          alt={user.name || 'User'}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to initials if profile image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
        <div
          className={fallbackClassName}
          style={backgroundStyle}
          // Initially hidden, shown only if image fails
        >
          {initials}
        </div>
      </div>
    );
  }

  // Show initials with consistent background color
  return (
    <div
      className={fallbackClassName}
      style={backgroundStyle}
    >
      {initials}
    </div>
  );
}

// Helper: extract memory share link from comment text
// Matches URLs like https://studio.stasht.com/memories?memory_id=2081&role=viewer&invite=1
const SHARE_LINK_PATTERN = /https?:\/\/[^\s]*\/memories\?[^\s]*memory_id=(\d+)[^\s]*/i;

function extractMemoryShareLink(text: string): { url: string; memoryId: string } | null {
  if (!text) return null;
  const match = text.match(SHARE_LINK_PATTERN);
  if (match) return { url: match[0], memoryId: match[1] };
  return null;
}

// Memory Link Preview Card – shown when a share link is pasted in a comment
function MemoryLinkPreview({ memoryId, url, dark = true }: { memoryId: string; url: string; dark?: boolean }) {
  const [data, setData] = useState<{ title: string; thumbnail: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.getShareLinkInfo(memoryId)
      .then((res: any) => {
        if (res?.success && res?.data) {
          setData({
            title: res.data.title || res.data.name || 'Untitled Campaign',
            thumbnail: res.data.last_update_img || res.data.thumbnail || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [memoryId]);

  if (loading || !data) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 flex items-center gap-0 rounded-xl border overflow-hidden cursor-pointer transition-opacity hover:opacity-90 no-underline ${
        dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {data.thumbnail ? (
        <img
          src={data.thumbnail}
          alt={data.title}
          className="w-16 h-16 object-cover flex-shrink-0"
        />
      ) : (
        <div className={`w-16 h-16 flex-shrink-0 flex items-center justify-center ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <span className="text-2xl">🗂️</span>
        </div>
      )}
      <div className="flex-1 py-2 px-3 min-w-0">
        <p className={`text-xs truncate ${dark ? 'text-gray-400' : 'text-gray-500'}`}>stasht.app · Campaign</p>
        <p className={`text-sm font-semibold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>{data.title}</p>
      </div>
    </a>
  );
}

interface Collaborator {
  id: string;
  userId?: string;
  name: string;
  email: string;
  phone_number?: string;
  avatar?: string;
  profileColor?: string;
  role: 'view' | 'edit' | 'admin';
  status: 'active' | 'pending' | 'invited';
}

interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  imageAlt: string;
  title?: string;
  subtitle?: string;
  coverContentOnly?: boolean; // New prop to cover only content area, not sidebar
  hideCheckbox?: boolean; // New prop to hide the checkbox
  largeSize?: boolean; // New prop for Memory Details page to show larger images
  mediumSize?: boolean; // New prop for medium-sized images on Media page
  // Additional metadata props
  filename?: string;
  dateTaken?: string;
  location?: string;
  description?: string;
  user_name?: string;
  user_profile?: string;
  // Carousel props
  images?: Array<{
    src: string;
    alt: string;
    title?: string;
    subtitle?: string;
    id?: string;
  }>;
  currentImageIndex?: number;
  onNextImage?: () => void;
  onPrevImage?: () => void;
  // Selection props
  isSelected?: boolean;
  onToggleSelection?: (imageId?: string) => void;
  imageId?: string;
  // Location props
  locationData?: {
    address?: string;
    exifData?: {
      dateTaken?: string;
      camera?: string;
      coordinates?: {
        lat: number;
        lng: number;
      };
    };
  };
  onEditLocation?: () => void;
  onRefreshData?: () => void;
  onLocationChange?: (newLocation: string) => void;
  onCommentCountChange?: (imageId: string, newCount: number) => void;
  onDescriptionUpdate?: (imageId: string, newDescription: string) => void;
  initialRotation?: number;
  activeCollaborators?: Collaborator[]; // Active collaborators for mentions
  memoryId?: string; // Memory ID for adding sub-images
  memoryTitle?: string; // Memory title for AddMomentModal
  memoryThumbnail?: string; // Memory thumbnail for AddMomentModal
  memoryCreatedDate?: string; // Memory created date for AddMomentModal
  memoryImages?: Array<{
    id: string;
    src: string;
    title?: string;
    subImages?: Array<{
      id: string;
      src: string;
      title?: string;
    }>;
  }>; // Memory images with sub-images for AddMomentModal dropdown
  userRole?: 'viewer' | 'edit' | 'admin' | 'contributor'; // Current user's role in the memory
  onSubImageAdded?: () => void; // Callback when sub-image is added
  onGetSubImages?: (parentImageId: string) => Array<{
    id: string;
    src: string;
    alt: string;
    title?: string;
    description?: string;
    location?: string;
    dateTaken?: string;
    filename?: string;
  }>; // Callback to get sub-images with full details
  initialSubImageId?: string; // ID of sub-image to select when viewer opens
  onDeleteSubImage?: (subImageId: string) => Promise<void>; // Callback to delete a sub-image
  onFeaturedImageSet?: () => void; // Callback when featured image is set to refresh the page
  parentImageIsFeatured?: boolean; // Whether the parent/main image is featured
  focusComments?: boolean; // Scroll to comments section on mobile when true
  initialTags?: string[]; // Pre-populate tags from parent data
  storyTags?: string[]; // All tags in the story for suggestions/autocomplete
  isPdf?: boolean; // Whether the current src is a PDF document
}

export function ImageViewer({
  isOpen,
  onClose,
  imageSrc,
  imageAlt,
  title,
  subtitle,
  coverContentOnly = false,
  hideCheckbox = false,
  largeSize = false,
  mediumSize = false,
  filename,
  dateTaken,
  location,
  description,
  user_name,
  user_profile,
  images = [],
  currentImageIndex = 0,
  onNextImage,
  onPrevImage,
  isSelected = false,
  onToggleSelection,
  imageId,
  locationData,
  onEditLocation,
  onRefreshData,
  onLocationChange,
  onCommentCountChange,
  onDescriptionUpdate,
  initialRotation = 0,
  activeCollaborators = [],
  memoryId,
  memoryTitle,
  memoryThumbnail,
  memoryCreatedDate,
  memoryImages = [],
  userRole,
  onSubImageAdded,
  onGetSubImages,
  initialSubImageId,
  onDeleteSubImage,
  onFeaturedImageSet,
  parentImageIsFeatured = false,
  focusComments = false,
  initialTags = [],
  storyTags = [],
  isPdf = false
}: ImageViewerProps) {

  // Helper function to format profile color
  const formatProfileColor = (profileColor?: string): string => {
    if (!profileColor) return '#6C60FF'; // Default purple color
    // If it's a 6-character hex without #, add it
    if (profileColor.match(/^[0-9a-fA-F]{6}$/)) {
      return `#${profileColor}`;
    }
    // If it already has #, return as is
    if (profileColor.startsWith('#')) {
      return profileColor;
    }
    // Default fallback
    return '#6C60FF';
  };

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showTagsPanel, setShowTagsPanel] = useState(false);
  const [imageTags, setImageTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState('');
  const [isSavingTags, setIsSavingTags] = useState(false);
  const tagsPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTagsPanel) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (tagsPanelRef.current && !tagsPanelRef.current.contains(e.target as Node)) {
        setShowTagsPanel(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showTagsPanel]);

  // Sync tags when imageId changes (e.g. opening a new image)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setImageTags(initialTags);
  }, [imageId]);

  const [isPortraitImage, setIsPortraitImage] = useState(false);

  // Cropping states
  const [isCropping, setIsCropping] = useState(false);
  const [cropPosition, setCropPosition] = useState<Point>({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSavingCrop, setIsSavingCrop] = useState(false);

  // Reset crop state when navigating to a different image
  useEffect(() => {
    setIsCropping(false);
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
    setCroppedAreaPixels(null);
  }, [imageId, currentImageIndex]);

  // On mobile, sidebar starts closed; on desktop, it starts open
  const [showSidebar, setShowSidebar] = useState(typeof window !== 'undefined' && window.innerWidth >= 768);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [mediaData, setMediaData] = useState<{
    description?: string;
    user_name?: string;
    user_profile?: string;
  }>({});
  const [currentLocation, setCurrentLocation] = useState<string | undefined>(location);
  
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const { user: authUser } = useAuth();
  const [likedComments, setLikedComments] = useState<Set<number>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [hasRotated, setHasRotated] = useState(false); // Track if rotation happened
  const lastFetchedImageId = useRef<string | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mention functionality states
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const newCommentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // State for description editing
  const [isDescriptionMenuOpen, setIsDescriptionMenuOpen] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const [currentDescription, setCurrentDescription] = useState("");
  const [hasDescriptionChanged, setHasDescriptionChanged] = useState(false);
  const [isSavingDescription, setIsSavingDescription] = useState(false);

  // Mention functionality for description editing
  const [showDescEditMentionDropdown, setShowDescEditMentionDropdown] = useState(false);
  const [descEditMentionSearch, setDescEditMentionSearch] = useState('');
  const [descEditCursorPosition, setDescEditCursorPosition] = useState(0);
  const descEditTextareaRef = useRef<HTMLTextAreaElement>(null);

  // State for sub-images functionality
  const [subImages, setSubImages] = useState<Array<{
    id: string;
    src: string;
    alt: string;
    title?: string;
    description?: string;
    location?: string;
    dateTaken?: string;
    filename?: string;
    is_featured?: boolean;
  }>>([]);
  const [isAddMomentModalOpen, setIsAddMomentModalOpen] = useState(false);
  const [currentSubImageIndex, setCurrentSubImageIndex] = useState(0);
  const [featuredImageId, setFeaturedImageId] = useState<string | null>(null);
  const [manualFeaturedUpdate, setManualFeaturedUpdate] = useState(false);

  // Ref to track which image ID we manually set as featured
  const manuallyFeaturedImageRef = useRef<string | null>(null);

  // Ref for mobile comments section (for scrolling when focusComments is true)
  const mobileCommentsRef = useRef<HTMLDivElement>(null);

  // State for touch/swipe gestures (mobile only)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  // Fetch sub-images when modal opens and imageId changes
  useEffect(() => {
    if (isOpen && imageId && onGetSubImages) {
      console.log('🔍 Fetching sub-images for parent imageId:', imageId);
      console.log('🌟 parentImageIsFeatured prop:', parentImageIsFeatured);
      console.log('🌟 manualFeaturedUpdate flag:', manualFeaturedUpdate);

      const fetchedSubImages = onGetSubImages(imageId);
      console.log('📸 Found sub-images:', fetchedSubImages);
      console.log('🗑️ Delete callback available:', !!onDeleteSubImage);

      // Sort sub-images: featured image first, then rest
      const sortedSubImages = [...fetchedSubImages].sort((a, b) => {
        if (a.is_featured === 1 || a.is_featured === true) return -1;
        if (b.is_featured === 1 || b.is_featured === true) return 1;
        return 0;
      });

      console.log('🌟 Sorted sub-images (featured first):', sortedSubImages);
      setSubImages(sortedSubImages);

      // Only update featured state if not manually updating
      if (!manualFeaturedUpdate) {
        // Check if any sub-image is featured
        const featuredSubImage = sortedSubImages.find(img => img.is_featured === 1 || img.is_featured === true);
        if (featuredSubImage) {
          setFeaturedImageId(featuredSubImage.id);
          manuallyFeaturedImageRef.current = featuredSubImage.id;
          console.log('🌟 Featured image ID set to sub-image:', featuredSubImage.id);
        } else if (manuallyFeaturedImageRef.current === imageId) {
          // We manually set this parent as featured, trust our ref
          setFeaturedImageId(imageId || null);
          console.log('🌟 Parent featured from manual ref:', imageId);
        } else if (parentImageIsFeatured) {
          // Parent image is featured according to prop
          setFeaturedImageId(imageId || null);
          manuallyFeaturedImageRef.current = imageId;
          console.log('🌟 Featured image ID set to parent from prop:', imageId);
        } else {
          // No sub-image is featured, and parent is not featured
          setFeaturedImageId(null);
          manuallyFeaturedImageRef.current = null;
          console.log('🌟 No featured image');
        }
      } else {
        console.log('⏭️ Skipping featured state initialization due to manual update flag');
      }

      // If initialSubImageId is provided, find its index and set it as current
      if (initialSubImageId) {
        const subImageIndex = fetchedSubImages.findIndex(img => img.id === initialSubImageId);
        if (subImageIndex !== -1) {
          // Add 1 because index 0 is the parent image
          const targetIndex = subImageIndex + 1;
          console.log(`🎯 Setting initial sub-image: ${initialSubImageId} at index ${targetIndex}`);
          setCurrentSubImageIndex(targetIndex);
        } else {
          console.log(`⚠️ Could not find sub-image with id ${initialSubImageId}, showing parent instead`);
          setCurrentSubImageIndex(0); // Fallback to parent if sub-image not found
        }
      } else {
        setCurrentSubImageIndex(0); // Reset to main image when opening
      }
    } else if (!isOpen) {
      // Clear sub-images when modal closes
      setSubImages([]);
      setCurrentSubImageIndex(0);
      setFeaturedImageId(null);
      setManualFeaturedUpdate(false);
      // Don't clear manuallyFeaturedImageRef - let it persist to remember user's choice
    }
  }, [isOpen, imageId, onGetSubImages, initialSubImageId, parentImageIsFeatured]);

  // Update featured image ID when parent featured status changes
  // This useEffect should NOT override manual updates or interfere with user actions
  useEffect(() => {
    // Only run on initial mount or when modal reopens (not during manual updates)
    if (isOpen && imageId && !manualFeaturedUpdate) {
      // If parent is featured and no sub-images have featured status
      const hasFeaturedSubImage = subImages.some(img => img.is_featured === 1 || img.is_featured === true);

      // Trust the parentImageIsFeatured prop for initial state
      if (!hasFeaturedSubImage && parentImageIsFeatured) {
        setFeaturedImageId(imageId);
        console.log('🌟 Parent image featured status updated from prop:', imageId);
      }
    }
  }, [parentImageIsFeatured, imageId, isOpen]);

  // Separate useEffect to reset the manual update flag
  useEffect(() => {
    if (manualFeaturedUpdate) {
      // Reset after next render
      const timer = setTimeout(() => {
        console.log('🌟 Resetting manual update flag');
        setManualFeaturedUpdate(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [manualFeaturedUpdate]);

  // Get current image data based on sub-image index
  const currentSubImage = currentSubImageIndex === 0 ? null : subImages[currentSubImageIndex - 1];

  // Get the actual image ID to use for fetching comments/data
  // If viewing a sub-image, use the sub-image ID; otherwise use the parent ID
  const currentImageId = currentSubImageIndex === 0 ? imageId : (currentSubImage?.id || imageId);

  // When viewing a sub-image, use ONLY sub-image data (no fallback to parent)
  // When viewing parent (index 0), use parent data
  const currentImageSrc = currentSubImageIndex === 0 ? imageSrc : (currentSubImage?.src || imageSrc);
  const isPdfSrc = isPdf || /\.pdf(\?.*)?$/i.test(currentImageSrc || '');
  const currentImageAlt = currentSubImageIndex === 0 ? imageAlt : (currentSubImage?.alt || '');

  // For PDFs: fetch via s3-proxy and create a blob URL so Chrome renders inline
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isPdfSrc || !currentImageSrc) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    async function loadPdf() {
      try {
        let fetchUrl = currentImageSrc;
        const res = await fetch(fetchUrl);
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(`${objectUrl}#toolbar=0&navpanes=0&view=FitH&page=1`);
      } catch {}
    }
    setPdfBlobUrl(null);
    loadPdf();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isPdfSrc, currentImageSrc]);
  const currentTitle = currentSubImageIndex === 0 ? title : (currentSubImage?.title || '');
  const currentFilename = currentSubImageIndex === 0 ? filename : (currentSubImage?.filename || '');
  const currentDateTaken = currentSubImageIndex === 0 ? dateTaken : (currentSubImage?.dateTaken || '');
  const displayLocation = currentSubImageIndex === 0 ? location : (currentSubImage?.location || '');
  const displayDescription = currentSubImageIndex === 0 ? description : (currentSubImage?.description || '');


  // Update state variables when switching between parent and sub-images
  useEffect(() => {
    if (currentSubImageIndex > 0) {
      // Viewing a sub-image - update states with sub-image data
      setCurrentLocation(displayLocation);
      setCurrentDescription(displayDescription || '');
      setEditedDescription(displayDescription || '');
    } else {
      // Viewing parent - use parent data
      setCurrentLocation(location);
      setCurrentDescription(mediaData.description || description || '');
      setEditedDescription(mediaData.description || description || '');
    }
  }, [currentSubImageIndex, displayLocation, displayDescription, location, description, mediaData.description]);

  // Detect portrait orientation when currentImageSrc changes (for sub-images)
  useEffect(() => {
    if (currentImageSrc && isOpen) {
      const img = new Image();
      img.onload = () => {
        const isPortrait = img.height > img.width;
        setIsPortraitImage(isPortrait);
      };
      img.onerror = () => {
        setIsPortraitImage(false);
      };
      img.src = currentImageSrc;
    }
  }, [currentImageSrc, isOpen]);

  // Reset zoom when image changes and set initial rotation
  useEffect(() => {
    // Detect image orientation and set appropriate zoom
    if (imageSrc && isOpen) {
      const img = new Image();
      img.onload = () => {
        const isLandscape = img.width > img.height;
        const isPortrait = img.height > img.width;

        // Set portrait state for mobile blur effect
        setIsPortraitImage(isPortrait);

        if (isLandscape) {
          setZoom(0.75); // 75% for landscape
          console.log('🖼️ Landscape image detected, setting zoom to 75%');
        } else if (isPortrait) {
          setZoom(0.5); // 50% for portrait
          console.log('🖼️ Portrait image detected, setting zoom to 50%');
        } else {
          setZoom(1); // 100% for square images
          console.log('🖼️ Square image detected, setting zoom to 100%');
        }
      };
      img.onerror = () => {
        setZoom(1); // Default to 100% if image fails to load
        setIsPortraitImage(false);
      };
      img.src = imageSrc;
    } else {
      setZoom(1);
      setIsPortraitImage(false);
    }

    setHasRotated(false); // Reset rotation flag when modal opens/image changes
    setHasDescriptionChanged(false); // Reset description change flag when modal opens/image changes
    // Set initial rotation from prop if provided
    if (initialRotation !== undefined) {
      console.log('🔄 Setting initial rotation from prop:', initialRotation);
      setRotation(initialRotation);
    }
    // Reset sidebar state based on screen size when modal opens
    if (isOpen) {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      setShowSidebar(!isMobile);
    }
    // Don't reset mediaData here as it will be fetched by fetchComments
  }, [imageSrc, initialRotation, isOpen]);
  
  // Update location whenever the location prop changes
  useEffect(() => {
    setCurrentLocation(location);
  }, [location]);

  // Update currentDescription when mediaData or description changes
  useEffect(() => {
    const desc = mediaData.description || description || "";
    setCurrentDescription(desc);
    setEditedDescription(desc);
  }, [mediaData.description, description]);

  // Handle modal close effect - refresh data if rotation or description changed
  useEffect(() => {
    // When modal closes and rotation or description changed, refresh the data
    if (!isOpen && (hasRotated || hasDescriptionChanged) && onRefreshData) {
      if (hasDescriptionChanged) {
        console.log('📝 Modal closed after description change, refreshing memory page data...');
      }
      if (hasRotated) {
        console.log('🔄 Modal closed after rotation, refreshing memory page data...');
      }

      onRefreshData();
      console.log('✅ Memory page data refresh triggered');
      setHasRotated(false); // Reset the flag
      setHasDescriptionChanged(false); // Reset the flag
    }
  }, [isOpen, hasRotated, hasDescriptionChanged, onRefreshData]);

  // Debug: Log user props when they change
  useEffect(() => {
    console.log('🔥 ImageViewer props changed:', { user_name, user_profile, description, imageId });
  }, [user_name, user_profile, description, imageId]);
  
  // Monitor mediaData state changes
  useEffect(() => {
    console.log('🔥🔥🔥 ImageViewer mediaData state updated:', mediaData);
    console.log('🔥🔥🔥 Should display user:', mediaData.user_name || user_name || 'Emma Wilson');
    console.log('🔥🔥🔥 Should display description:', mediaData.description || description || 'Default description');
  }, [mediaData]);

  // Helper function to get current user data compatible with UserFallbackAvatar
  const getCurrentUserForAvatar = () => {
    if (!authUser) {
      console.log('⚠️ getCurrentUserForAvatar: No authUser, using fallback');
      return { name: 'You', avatar: undefined, profile_color: undefined };
    }

    // Check if current user has any comments and use their profile_color for consistency
    const findUserInComments = (commentsList: Comment[]): string | undefined => {
      for (const comment of commentsList) {
        if (comment.user.name === authUser.name || String(comment.user.id) === String(authUser.id)) {
          return comment.user.profile_color;
        }
        // Check replies recursively
        if (comment.replies && comment.replies.length > 0) {
          const colorFromReplies = findUserInComments(comment.replies);
          if (colorFromReplies) return colorFromReplies;
        }
      }
      return undefined;
    };

    // Try to find profile_color from existing comments by this user
    const profileColorFromComments = findUserInComments(comments);

    const userData = {
      name: authUser.name || 'User',
      avatar: authUser.avatar,
      // Use profile_color from comments if found, otherwise use authUser's profile_color
      profile_color: profileColorFromComments || authUser.profile_color
    };

    console.log('👤 getCurrentUserForAvatar:', userData);
    console.log('👤 Generated color:', userDisplayUtils.getUserDisplayColor(userData));

    return userData;
  };

  // Fetch comments when modal opens or imageId changes
  useEffect(() => {
    console.log('🔥 ImageViewer useEffect - isOpen:', isOpen, 'currentImageId:', currentImageId, 'currentSubImageIndex:', currentSubImageIndex);

    // Clear any pending fetch
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    if (isOpen && currentImageId) {
      console.log('🔥 ImageViewer - Scheduling fetch for currentImageId:', currentImageId);

      // Debounce the API call by 500ms
      fetchTimeoutRef.current = setTimeout(() => {
        console.log('🔥 ImageViewer - Executing fetch for currentImageId:', currentImageId);
        fetchComments();
      }, 500);
    } else if (isOpen && isPdf) {
      // PDF has no imageId — seed mediaData directly from props so user info shows
      setMediaData({
        user_name: user_name || '',
        user_profile: user_profile || null,
        description: description || '',
      });
    } else if (!isOpen) {
      // Clear mediaData when modal closes
      console.log('🔥 ImageViewer - Modal closed, clearing mediaData');
      setMediaData({});
      setComments([]);
      lastFetchedImageId.current = null;
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, [isOpen, currentImageId, currentSubImageIndex, isPdf, user_name, user_profile]);

  // Initialize all comments as expanded when comments load
  useEffect(() => {
    const allCommentIds = new Set<number>();
    const userLikedCommentIds = new Set<number>();
    
    const collectCommentIds = (comments: Comment[]) => {
      comments.forEach(comment => {
        // Check if current user has liked this comment (for all levels)
        if (comment.is_liked) {
          userLikedCommentIds.add(comment.id);
        }
        
        // Add to expanded comments if it has replies
        if (comment.replies && comment.replies.length > 0) {
          allCommentIds.add(comment.id);
          collectCommentIds(comment.replies); // Recursively process replies
        }
      });
    };
    
    collectCommentIds(comments);
    setExpandedComments(allCommentIds);
    setLikedComments(userLikedCommentIds);
  }, [comments]);

  // Open mobile comments bottom sheet when focusComments is true
  useEffect(() => {
    if (isOpen && focusComments) {
      // Small delay to ensure the modal is fully rendered
      const showCommentsTimeout = setTimeout(() => {
        setShowSidebar(true);
      }, 300);
      return () => clearTimeout(showCommentsTimeout);
    }
  }, [isOpen, focusComments]);

  const toggleCommentExpansion = (commentId: number) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const fetchComments = async () => {
    if (!currentImageId) return;

    // Prevent duplicate calls while already loading
    if (isLoadingComments) {
      console.log('🔥 fetchComments - Already loading, skipping duplicate call');
      return;
    }

    // Skip if we already fetched this currentImageId
    if (lastFetchedImageId.current === currentImageId && mediaData.user_name) {
      console.log('🔥 fetchComments - Already fetched data for currentImageId:', currentImageId);
      return;
    }

    setIsLoadingComments(true);
    lastFetchedImageId.current = currentImageId;

    try {
      console.log('🔥🔥 fetchComments - Calling mediaAPI.getComments with currentImageId:', currentImageId);
      const response = await mediaAPI.getComments(currentImageId);
      console.log('🔥🔥 fetchComments - Received response:', response);
      console.log('🔥🔥 fetchComments - Response type:', typeof response);
      console.log('🔥🔥 fetchComments - Response keys:', response ? Object.keys(response) : 'null');
      
      if (response.success && response.data) {
        // Handle the new API structure with media data
        // Check if response.data has comments and media directly
        if (response.data.comments !== undefined && response.data.media !== undefined) {
          // Direct structure: { comments: [], media: {...} }
          const { comments: commentsData, media: mediaInfo } = response.data;
          console.log('🔥 Direct structure - commentsData:', commentsData);
          console.log('🔥 Direct structure - mediaInfo:', mediaInfo);
          
          console.log('🔥 Media data from getComments API:', mediaInfo);
          const newMediaData = {
            description: mediaInfo?.description || '',
            user_name: mediaInfo?.user_name || '',
            user_profile: mediaInfo?.user_profile || null
          };
          console.log('🔥 Setting mediaData state to:', newMediaData);
          setMediaData(newMediaData);

          // Load tags from API
          if (Array.isArray(mediaInfo?.tags)) {
            setImageTags(mediaInfo.tags.map((t: any) => typeof t === 'string' ? t : t.name).filter(Boolean));
          }

          // Update location if it's available from the API
          if (mediaInfo?.location) {
            console.log('🔥 Updating location from API:', mediaInfo.location);
            setCurrentLocation(mediaInfo.location);
          }

          // Update rotation if it's available from the API
          if (mediaInfo?.rotation_angle !== undefined) {
            console.log('🔄 Loading rotation from API:', mediaInfo.rotation_angle);
            setRotation(mediaInfo.rotation_angle);
          } else {
            // Keep initial rotation if API doesn't provide rotation data
            console.log('🔄 API has no rotation data, keeping initial rotation:', initialRotation);
          }
          
          const finalCommentsData = Array.isArray(commentsData) ? commentsData : [];
          
          // Debug: Log first comment's user data to see available fields
          if (finalCommentsData.length > 0) {
            console.log('🔥🔥 First comment user data:', finalCommentsData[0].user);
            console.log('🔥🔥 Available user fields:', Object.keys(finalCommentsData[0].user || {}));
          }
          
          setComments(finalCommentsData);
        } 
        // Check for nested structure: { data: { comments: [], media: {...} } }
        else if (response.data.data) {
          const { comments: commentsData, media: mediaInfo } = response.data.data;
          console.log('🔥 Nested structure - commentsData:', commentsData);
          console.log('🔥 Nested structure - mediaInfo:', mediaInfo);
          
          console.log('🔥 Media data from getComments API (nested):', mediaInfo);
          const newMediaData = {
            description: mediaInfo?.description || '',
            user_name: mediaInfo?.user_name || '',
            user_profile: mediaInfo?.user_profile || null
          };
          console.log('🔥 Setting mediaData state to (nested):', newMediaData);
          setMediaData(newMediaData);

          // Update location if it's available from the API
          if (mediaInfo?.location) {
            console.log('🔥 Updating location from API (nested):', mediaInfo.location);
            setCurrentLocation(mediaInfo.location);
          }

          // Update rotation if it's available from the API
          if (mediaInfo?.rotation_angle !== undefined) {
            console.log('🔄 Loading rotation from API (nested):', mediaInfo.rotation_angle);
            setRotation(mediaInfo.rotation_angle);
          } else {
            // Keep initial rotation if API doesn't provide rotation data
            console.log('🔄 API (nested) has no rotation data, keeping initial rotation:', initialRotation);
          }
          
          const finalCommentsData = Array.isArray(commentsData) ? commentsData : [];
          
          // Debug: Log first comment's user data to see available fields
          if (finalCommentsData.length > 0) {
            console.log('🔥🔥 First comment user data (nested):', finalCommentsData[0].user);
            console.log('🔥🔥 Available user fields (nested):', Object.keys(finalCommentsData[0].user || {}));
          }
          
          setComments(finalCommentsData);
        }
        else {
          // Fallback to old structure: direct array or comments array
          const commentsData = Array.isArray(response.data) ? response.data : [];
          console.log('🔥 Comments loaded (old structure):', commentsData);

          // Debug: Log first comment's user data to see available fields
          if (commentsData.length > 0) {
            console.log('🔥🔥 First comment user data (old structure):', commentsData[0].user);
            console.log('🔥🔥 Available user fields (old structure):', Object.keys(commentsData[0].user || {}));
          }

          setComments(commentsData);
          setMediaData({}); // Clear media data if not available
          // Keep initial rotation for old structure if no API rotation data
          console.log('🔄 Old API structure, keeping initial rotation:', initialRotation);
        }
      } else {
        console.error('Failed to fetch comments:', response.error);
        setComments([]);
        setMediaData({});
        // Keep initial rotation on API error
        console.log('🔄 API error, keeping initial rotation:', initialRotation);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
      setMediaData({});
      // Keep initial rotation on fetch error
      console.log('🔄 Fetch error, keeping initial rotation:', initialRotation);
    } finally {
      setIsLoadingComments(false);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';
      
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (!isInputField) {
            e.preventDefault();
            if (onPrevImage && images.length > 1) {
              onPrevImage();
            }
          }
          break;
        case 'ArrowRight':
          if (!isInputField) {
            e.preventDefault();
            if (onNextImage && images.length > 1) {
              onNextImage();
            }
          }
          break;
        case '+':
        case '=':
          if (!isInputField) {
            e.preventDefault();
            setZoom(prev => Math.min(prev + 0.25, 3));
          }
          break;
        case '-':
          if (!isInputField) {
            e.preventDefault();
            setZoom(prev => Math.max(prev - 0.25, 0.5));
          }
          break;
        case 'r':
        case 'R':
          // Only rotate if user is NOT typing in an input field
          if (!isInputField) {
            e.preventDefault();
            handleRotation();
          }
          break;
        case '0':
          if (!isInputField) {
            e.preventDefault();
            setZoom(1);
            setRotation(0);
          }
          break;
        case ' ':
          // Only use space for selection if user is NOT typing in an input field
          if (!isInputField) {
            e.preventDefault();
            if (onToggleSelection && imageId) {
              onToggleSelection(imageId);
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNextImage, onPrevImage, images.length, onToggleSelection, imageId]);

  // Prevent body scroll when modal is open (only for full screen mode)
  useEffect(() => {
    if (isOpen && !coverContentOnly) {
      document.body.style.overflow = 'hidden';
    } else if (!coverContentOnly) {
      document.body.style.overflow = 'unset';
      
    }
    
    return () => {
      if (!coverContentOnly) {
        document.body.style.overflow = 'unset';
      }
    };
  }, [isOpen, coverContentOnly]);

  // Crop completion callback - Must be before early return!
  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Save crop settings to localStorage (frontend only - no API call)
  const handleSaveCrop = useCallback(() => {
    if (!croppedAreaPixels || !imageId) {
      toast.error('Unable to save crop settings');
      return;
    }

    // Load image to get natural dimensions
    const img = new Image();
    img.onload = () => {
      const cropData = {
        x: croppedAreaPixels.x,
        y: croppedAreaPixels.y,
        width: croppedAreaPixels.width,
        height: croppedAreaPixels.height,
        zoom: cropZoom,
        imageWidth: img.naturalWidth,
        imageHeight: img.naturalHeight
      };

      // Save to localStorage AND database
      const saveCropSettings = async () => {
        try {
          // 1. Save to localStorage for immediate use
          const existingCrops = JSON.parse(localStorage.getItem('imageCropSettings') || '{}');
          existingCrops[imageId] = cropData;
          localStorage.setItem('imageCropSettings', JSON.stringify(existingCrops));

          console.log('✂️ Saved crop to localStorage:', cropData);

          // 2. Save to database via API
          console.log('✂️ Saving crop to database for image:', imageId);
          const apiResponse = await mediaAPI.updateImageCrop(imageId, cropData);

          if (apiResponse.success) {
            console.log('✅ Crop saved to database successfully');
            toast.success('Crop settings saved');
          } else {
            console.warn('⚠️ Failed to save crop to database:', apiResponse.error);
            toast.success('Crop saved locally (database sync failed)');
          }

          setIsCropping(false);

          // Notify parent to refresh display
          if (onRefreshData) {
            onRefreshData();
          }
        } catch (error) {
          console.error('❌ Error saving crop:', error);
          // Even if API fails, crop is saved in localStorage
          toast.success('Crop saved locally');
          setIsCropping(false);
        }
      };

      saveCropSettings();
    };

    img.onerror = () => {
      toast.error('Failed to load image dimensions');
    };

    img.src = currentImageSrc;
  }, [croppedAreaPixels, imageId, cropZoom, onRefreshData, currentImageSrc]);

  // Cancel cropping
  const handleCancelCrop = useCallback(() => {
    setIsCropping(false);
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
    setCroppedAreaPixels(null);
  }, []);

  // Start cropping with saved crop data if available
  const handleStartCrop = useCallback(() => {
    // Try to load saved crop data if imageId exists
    if (imageId) {
      try {
        const savedCrops = JSON.parse(localStorage.getItem('imageCropSettings') || '{}');
        if (savedCrops[imageId]) {
          const cropData = savedCrops[imageId];
          // Set the saved zoom
          setCropZoom(cropData.zoom || 1);
          // For react-easy-crop, we need to calculate the position based on the crop area
          // The position is relative to the center of the image
          if (cropData.imageWidth && cropData.imageHeight && cropData.width && cropData.height) {
            // Calculate the center of the crop area relative to image center
            const cropCenterX = cropData.x + cropData.width / 2;
            const cropCenterY = cropData.y + cropData.height / 2;
            const imageCenterX = cropData.imageWidth / 2;
            const imageCenterY = cropData.imageHeight / 2;

            // The crop position in react-easy-crop is the offset from center
            // Negative values move the image (showing different part of crop)
            const offsetX = imageCenterX - cropCenterX;
            const offsetY = imageCenterY - cropCenterY;

            setCropPosition({ x: offsetX, y: offsetY });
          }
        } else {
          // No saved crop, reset to defaults
          setCropPosition({ x: 0, y: 0 });
          setCropZoom(1);
        }
      } catch (error) {
        console.error('Error loading saved crop:', error);
        setCropPosition({ x: 0, y: 0 });
        setCropZoom(1);
      }
    } else {
      // No imageId, reset to defaults
      setCropPosition({ x: 0, y: 0 });
      setCropZoom(1);
    }

    setIsCropping(true);
  }, [imageId]);

  // Touch/swipe handlers for mobile navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    // Only enable on mobile devices
    if (typeof window !== 'undefined' && window.innerWidth >= 768) return;

    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Only enable on mobile devices
    if (typeof window !== 'undefined' && window.innerWidth >= 768) return;

    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const handleTouchEnd = () => {
    // Only enable on mobile devices
    if (typeof window !== 'undefined' && window.innerWidth >= 768) return;

    if (!touchStart || !touchEnd) return;

    const deltaX = touchStart.x - touchEnd.x;
    const deltaY = touchStart.y - touchEnd.y;
    const minSwipeDistance = 50;

    // Determine swipe direction
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX);

    if (isHorizontalSwipe && Math.abs(deltaX) > minSwipeDistance) {
      // Horizontal swipe - navigate between images
      if (deltaX > 0 && onNextImage && images.length > 1 && currentImageIndex < images.length - 1) {
        // Swipe left - next image
        onNextImage();
      } else if (deltaX < 0 && onPrevImage && images.length > 1 && currentImageIndex > 0) {
        // Swipe right - previous image
        onPrevImage();
      }
    } else if (isVerticalSwipe && Math.abs(deltaY) > minSwipeDistance && deltaY < 0) {
      // Swipe up - close modal
      onClose();
    }

    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (!isOpen) return null;

  const handleSaveTags = async (tagsToSave: string[]) => {
    if (!imageId) return;
    setIsSavingTags(true);
    try {
      const result = await mediaAPI.updateImageTags(imageId, tagsToSave);
      if (result.success) {
        setImageTags(tagsToSave);
        toast.success('Tags updated');
        if (onRefreshData) onRefreshData();
      } else {
        toast.error(result.error || 'Failed to update tags');
      }
    } catch (error) {
      toast.error('Failed to update tags');
    } finally {
      setIsSavingTags(false);
    }
  };

  const handleAddTag = () => {
    const newTags = tagInput.split(',').map(t => t.trim()).filter(t => t && !imageTags.includes(t));
    if (newTags.length === 0) return;
    const updated = [...imageTags, ...newTags];
    setTagInput('');
    handleSaveTags(updated);
  };

  const handleRemoveTag = (tag: string) => {
    const updated = imageTags.filter(t => t !== tag);
    handleSaveTags(updated);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = imageAlt || 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetView = () => {
    setZoom(1);
    setRotation(0);
  };

  // Save rotation to database
  const saveRotationToDatabase = async (newRotation: number) => {
    if (!imageId) {
      console.warn('🔄 Cannot save rotation: imageId is not provided');
      return;
    }

    try {
      console.log('🔄 Saving rotation to database:', { imageId, rotation: newRotation });
      const response = await mediaAPI.rotateImage(imageId, newRotation);

      if (response.success) {
        console.log('🔄 ✅ Rotation saved successfully');
        setHasRotated(true); // Mark that rotation happened
      } else {
        console.error('🔄 ❌ Failed to save rotation:', response.error);
      }
    } catch (error) {
      console.error('🔄 ❌ Error saving rotation:', error);
    }
  };

  // Handle rotation with database save
  const handleRotation = () => {
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);

    // Save to database in the background
    saveRotationToDatabase(newRotation);
  };

  const handleToggleFeatured = async (e: React.MouseEvent, subImageId: string) => {
    e.stopPropagation();

    try {
      // Toggle featured state
      const isFeatured = featuredImageId === subImageId;
      const newFeaturedState = !isFeatured;

      console.log('🌟 Toggling featured image:', subImageId, 'New state:', newFeaturedState);

      // Call API to set featured image
      const response = await dashboardAPI.setImageFeatured(subImageId, newFeaturedState);

      if (response.success) {
        // Set manual update flag to prevent useEffect from overriding
        setManualFeaturedUpdate(true);

        // Update the ref to remember this choice
        manuallyFeaturedImageRef.current = newFeaturedState ? subImageId : null;
        console.log('🌟 Updated manuallyFeaturedImageRef to:', manuallyFeaturedImageRef.current);

        // Update local state only after successful API call
        setFeaturedImageId(newFeaturedState ? subImageId : null);
        console.log('🌟 Featured image ID manually set to:', newFeaturedState ? subImageId : null);

        // Check if this is the parent image (imageId) or a sub-image
        const isParentImage = subImageId === imageId;
        console.log('🔍 Comparing IDs - subImageId:', subImageId, 'type:', typeof subImageId, 'imageId:', imageId, 'type:', typeof imageId, 'isParentImage:', isParentImage);

        if (isParentImage && newFeaturedState) {
          // Setting parent as featured - unfeature all sub-images
          setSubImages(prev => prev.map(img => ({
            ...img,
            is_featured: false
          })));
        } else {
          // Update sub-images state
          setSubImages(prev => prev.map(img => ({
            ...img,
            is_featured: img.id === subImageId && newFeaturedState
          })));
        }

        toast.success(newFeaturedState ? "Set as featured image" : "Removed from featured");

        // Log state before refresh
        console.log('🌟 State before refresh - featuredImageId:', newFeaturedState ? subImageId : null, 'ref:', manuallyFeaturedImageRef.current);

        // Call the callback to refresh the page
        if (onFeaturedImageSet) {
          await onFeaturedImageSet();
        }

        // Log state after refresh
        console.log('🌟 State after refresh - featuredImageId:', featuredImageId, 'ref:', manuallyFeaturedImageRef.current);

        // Force re-confirm the featured state after refresh
        if (newFeaturedState) {
          setFeaturedImageId(subImageId);
          console.log('🌟 Re-confirmed featured state after refresh');
        }
      } else {
        toast.error(response.error || "Failed to update featured image");
      }
    } catch (error) {
      console.error('❌ Error toggling featured:', error);
      toast.error("Failed to update featured image");
    }
  };

  // Handle @ mention trigger for comments
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;

    setNewComment(value);
    setCursorPosition(cursorPos);

    // Check if user typed @
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1 && lastAtIndex === cursorPos - 1) {
      // Just typed @
      setShowMentionDropdown(true);
      setMentionSearch('');
    } else if (lastAtIndex !== -1 && cursorPos > lastAtIndex) {
      // Typing after @
      const searchText = textBeforeCursor.substring(lastAtIndex + 1);
      // Allow spaces in names - check if we hit a newline or another @ instead
      if (!searchText.includes('\n') && !searchText.includes('@')) {
        setShowMentionDropdown(true);
        setMentionSearch(searchText);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  // Handle mention selection
  const handleMentionSelect = (collaborator: Collaborator) => {
    const textBeforeCursor = newComment.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const before = newComment.substring(0, lastAtIndex);
      const after = newComment.substring(cursorPosition);
      const newValue = `${before}@${collaborator.name} ${after}`;

      setNewComment(newValue);
      setShowMentionDropdown(false);
      setMentionSearch('');

      // Set cursor position after the mention
      setTimeout(() => {
        if (newCommentTextareaRef.current) {
          const newCursorPos = lastAtIndex + collaborator.name.length + 2;
          newCommentTextareaRef.current.focus();
          newCommentTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  // Filter collaborators based on search
  const filteredCollaborators = activeCollaborators.filter(collab =>
    collab.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    collab.email.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Handle @ mention trigger for description editing
  const handleDescEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;

    setEditedDescription(value);
    setDescEditCursorPosition(cursorPos);

    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1 && lastAtIndex === cursorPos - 1) {
      // Just typed @
      setShowDescEditMentionDropdown(true);
      setDescEditMentionSearch('');
    } else if (lastAtIndex !== -1 && cursorPos > lastAtIndex) {
      // Typing after @
      const searchText = textBeforeCursor.substring(lastAtIndex + 1);
      // Allow spaces in names - check if we hit a newline or another @ instead
      if (!searchText.includes('\n') && !searchText.includes('@')) {
        setShowDescEditMentionDropdown(true);
        setDescEditMentionSearch(searchText);
      } else {
        setShowDescEditMentionDropdown(false);
      }
    } else {
      setShowDescEditMentionDropdown(false);
    }
  };

  // Handle mention selection for description editing
  const handleDescEditMentionSelect = (collaborator: Collaborator) => {
    const textBeforeCursor = editedDescription.substring(0, descEditCursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const before = editedDescription.substring(0, lastAtIndex);
      const after = editedDescription.substring(descEditCursorPosition);
      const newValue = `${before}@${collaborator.name} ${after}`;

      setEditedDescription(newValue);
      setShowDescEditMentionDropdown(false);
      setDescEditMentionSearch('');

      // Set cursor position after the mention
      setTimeout(() => {
        if (descEditTextareaRef.current) {
          const newCursorPos = lastAtIndex + collaborator.name.length + 2;
          descEditTextareaRef.current.focus();
          descEditTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  // Filter collaborators for description editing based on search
  const filteredDescEditCollaborators = activeCollaborators.filter(collab =>
    collab.name.toLowerCase().includes(descEditMentionSearch.toLowerCase()) ||
    collab.email.toLowerCase().includes(descEditMentionSearch.toLowerCase())
  );

  // Function to check if comment has content beyond just mentions
  const hasContentBeyondMentions = (text: string): boolean => {
    if (!text || text.trim().length === 0) return false;

    // Remove all @mentions from the text (only actual collaborator names)
    let textWithoutMentions = text;

    if (activeCollaborators.length > 0) {
      const escapedNames = activeCollaborators.map(c =>
        c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      );
      const sortedNames = escapedNames.sort((a, b) => b.length - a.length);
      const mentionPattern = new RegExp(`@(${sortedNames.join('|')})`, 'gi');
      textWithoutMentions = text.replace(mentionPattern, '');
    }

    textWithoutMentions = textWithoutMentions.trim();

    // Check if there's any content left after removing mentions
    return textWithoutMentions.length > 0;
  };

  // Function to render comments with highlighted mentions
  const renderCommentWithMentions = (text: string) => {
    if (!text) return null;

    // Build regex pattern from actual collaborator names to avoid capturing unwanted text
    const collaboratorNames = activeCollaborators.map(c => c.name);
    if (collaboratorNames.length === 0) {
      return <span>{text}</span>;
    }

    // Escape special regex characters and create pattern for each name
    const escapedNames = collaboratorNames.map(name =>
      name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    // Sort by length (longest first) to match longer names before shorter ones
    const sortedNames = escapedNames.sort((a, b) => b.length - a.length);
    const pattern = new RegExp(`(@(?:${sortedNames.join('|')}))(?=\\s|$|[^a-zA-Z0-9])`, 'gi');

    const parts: Array<{text: string, isMention: boolean, collaborator?: any}> = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push({text: text.substring(lastIndex, match.index), isMention: false});
      }

      // Add mention
      const mentionText = match[1];
      const username = mentionText.substring(1); // Remove @ symbol
      const collaborator = activeCollaborators.find(
        c => c.name.toLowerCase() === username.toLowerCase()
      );

      parts.push({text: mentionText, isMention: true, collaborator});
      lastIndex = match.index + mentionText.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({text: text.substring(lastIndex), isMention: false});
    }

    return parts.map((part, index) => {
      if (part.isMention && part.collaborator) {
        const collaborator = part.collaborator;
        // Render mention with hover card
        return (
          <HoverCard key={index} openDelay={300} closeDelay={100}>
            <HoverCardTrigger asChild>
              <span
                className="font-medium cursor-pointer hover:underline inline-block"
                style={{ color: '#6C60FF' }}
              >
                {part.text}
              </span>
            </HoverCardTrigger>
              <HoverCardContent
                className="w-80 p-4 bg-white border border-gray-200 shadow-lg z-[100001]"
                side="top"
                align="start"
                sideOffset={8}
              >
                <div className="flex flex-col gap-4">
                  {/* User info header */}
                  <div className="flex items-center gap-3">
                    <UserFallbackAvatar
                      user={{
                        name: collaborator.name,
                        avatar: collaborator.avatar,
                        profile_color: collaborator.profileColor
                      }}
                      size="w-12 h-12"
                    />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-gray-900">{collaborator.name}</h4>
                      {/* Location - placeholder for now, can be added if available */}
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        <span>Location not available</span>
                      </p>
                    </div>
                  </div>

                  {/* Stats - Total Stories placeholder - Hidden for now
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium text-gray-900">0</span>
                    <span>Total Stories</span>
                  </div>
                  */}

                  {/* Connect buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs h-8 border-gray-300 text-gray-700 hover:bg-gray-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (collaborator.email) {
                          window.location.href = `mailto:${collaborator.email}`;
                        }
                      }}
                    >
                      <Mail className="w-3 h-3 mr-1.5" />
                      Request Email
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-8 h-8 p-0 border-gray-300 text-gray-700 hover:bg-gray-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        // LinkedIn action - placeholder
                        toast.info("LinkedIn connection coming soon!");
                      }}
                    >
                      <Linkedin className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-8 h-8 p-0 border-gray-300 text-gray-700 hover:bg-gray-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Facebook action - placeholder
                        toast.info("Facebook connection coming soon!");
                      }}
                    >
                      <Facebook className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          );
      }

      // Regular text (not a mention) – detect URLs and make them clickable
      const urlPattern = /(https?:\/\/[^\s]+)/g;
      const textParts = part.text.split(urlPattern);
      return (
        <span key={index}>
          {textParts.map((segment, si) =>
            /^https?:\/\//.test(segment) ? (
              <a
                key={si}
                href={segment}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline break-all"
                onClick={(e) => e.stopPropagation()}
              >
                {segment}
              </a>
            ) : (
              <span key={si}>{segment}</span>
            )
          )}
        </span>
      );
    });
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !imageId) {
      return;
    }

    try {
      setIsAddingComment(true);

      console.log('🔍 handleAddComment - Start');
      console.log('💬 Comment text:', newComment);
      console.log('👥 Active collaborators:', activeCollaborators);

      // Extract mentioned emails and phone numbers from comment - only match actual collaborator names
      const mentionedEmails: string[] = [];
      const mentionedPhones: string[] = [];

      if (activeCollaborators.length > 0) {
        // Build regex pattern from actual collaborator names
        const escapedNames = activeCollaborators.map(c =>
          c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        );
        const sortedNames = escapedNames.sort((a, b) => b.length - a.length);
        const mentionPattern = new RegExp(`@(${sortedNames.join('|')})(?=\\s|$|[^a-zA-Z0-9])`, 'gi');

        console.log('🔎 Mention pattern:', mentionPattern.toString());

        let match;
        let matchCount = 0;
        while ((match = mentionPattern.exec(newComment)) !== null) {
          matchCount++;
          const mentionedName = match[1];
          console.log(`✅ Match ${matchCount}: Found mention "${mentionedName}"`);

          const collaborator = activeCollaborators.find(
            c => c.name.toLowerCase() === mentionedName.toLowerCase()
          );

          if (collaborator) {
            console.log(`👤 Found collaborator:`, {
              name: collaborator.name,
              email: collaborator.email,
              phone_number: collaborator.phone_number
            });

            // Add email if exists
            if (collaborator.email && !mentionedEmails.includes(collaborator.email)) {
              mentionedEmails.push(collaborator.email);
              console.log(`📧 Added email: ${collaborator.email}`);
            }
            // Add phone number if exists
            if (collaborator.phone_number && !mentionedPhones.includes(collaborator.phone_number)) {
              mentionedPhones.push(collaborator.phone_number);
              console.log(`📱 Added phone: ${collaborator.phone_number}`);
            }
          } else {
            console.log(`❌ No collaborator found for "${mentionedName}"`);
          }
        }

        console.log(`🎯 Total matches found: ${matchCount}`);
      } else {
        console.log('⚠️ No active collaborators available');
      }

      console.log('📧 Final mentioned emails:', mentionedEmails);
      console.log('📱 Final mentioned phones:', mentionedPhones);

      const response = await mediaAPI.addComment({
        image_id: imageId,
        comment: newComment.trim(),
        mentioned_emails: mentionedEmails.length > 0 ? mentionedEmails : undefined,
        mentioned_phones: mentionedPhones.length > 0 ? mentionedPhones : undefined
      });

      if (response && response.success) {
        setNewComment("");
        setShowMentionDropdown(false);
        // Force refresh by resetting cache
        lastFetchedImageId.current = null;
        await fetchComments(); // Refresh comments

        // Update comment count in parent (MediaPage)
        if (onCommentCountChange && imageId) {
          const newCount = (comments.length + 1); // Increment count
          onCommentCountChange(imageId, newCount);
        }
        toast.success("Comment added successfully!");
      } else {
        const errorMsg = response?.error || response?.message || 'Unknown error';
        console.error('Failed to add comment:', errorMsg);
        toast.error("Failed to add comment");
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error("Failed to add comment");
    } finally {
      setIsAddingComment(false);
    }
  };

  const handleAddReply = async (parentId: number) => {
    if (!replyText.trim() || !imageId) return;

    try {
      const response = await mediaAPI.addComment({
        image_id: imageId,
        comment: replyText.trim(),
        parent_id: parentId
      });

      if (response.success) {
        setReplyText("");
        setReplyingTo(null);
        // Force refresh by resetting cache
        lastFetchedImageId.current = null;
        await fetchComments(); // Refresh comments

        // Update comment count in parent (MediaPage)
        if (onCommentCountChange && imageId) {
          const newCount = (comments.length + 1); // Increment count
          onCommentCountChange(imageId, newCount);
        }
      } else {
        console.error('Failed to add reply:', response.error);
      }
    } catch (error) {
      console.error('Error adding reply:', error);
    }
  };

  const handleEditDescription = () => {
    setIsEditingDescription(true);
    setEditedDescription(currentDescription);
    setIsDescriptionMenuOpen(false);
  };

  const handleSaveDescription = async () => {
    if (!imageId) return;

    setIsSavingDescription(true);
    try {
      console.log('🔍 handleSaveDescription - Start');
      console.log('📝 Description text:', editedDescription);
      console.log('👥 Active collaborators:', activeCollaborators);

      // Extract mentioned emails and phone numbers from description - only match actual collaborator names
      const mentionedEmails: string[] = [];
      const mentionedPhones: string[] = [];

      if (activeCollaborators.length > 0) {
        // Build regex pattern from actual collaborator names
        const escapedNames = activeCollaborators.map(c =>
          c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        );
        const sortedNames = escapedNames.sort((a, b) => b.length - a.length);
        const mentionPattern = new RegExp(`@(${sortedNames.join('|')})(?=\\s|$|[^a-zA-Z0-9])`, 'gi');

        console.log('🔎 Mention pattern:', mentionPattern.toString());

        let match;
        let matchCount = 0;
        while ((match = mentionPattern.exec(editedDescription)) !== null) {
          matchCount++;
          const mentionedName = match[1];
          console.log(`✅ Match ${matchCount}: Found mention "${mentionedName}"`);

          const collaborator = activeCollaborators.find(
            c => c.name.toLowerCase() === mentionedName.toLowerCase()
          );

          if (collaborator) {
            console.log(`👤 Found collaborator:`, {
              name: collaborator.name,
              email: collaborator.email,
              phone_number: collaborator.phone_number
            });

            // Add email if exists
            if (collaborator.email && !mentionedEmails.includes(collaborator.email)) {
              mentionedEmails.push(collaborator.email);
              console.log(`📧 Added email: ${collaborator.email}`);
            }
            // Add phone number if exists
            if (collaborator.phone_number && !mentionedPhones.includes(collaborator.phone_number)) {
              mentionedPhones.push(collaborator.phone_number);
              console.log(`📱 Added phone: ${collaborator.phone_number}`);
            }
          } else {
            console.log(`❌ No collaborator found for "${mentionedName}"`);
          }
        }

        console.log(`🎯 Total matches found: ${matchCount}`);
      } else {
        console.log('⚠️ No active collaborators available');
      }

      console.log('📧 Final mentioned emails:', mentionedEmails);
      console.log('📱 Final mentioned phones:', mentionedPhones);

      const response = await dashboardAPI.editPostDescription(
        imageId,
        editedDescription,
        mentionedEmails.length > 0 ? mentionedEmails : undefined,
        mentionedPhones.length > 0 ? mentionedPhones : undefined
      );
      if (response.success) {
        toast.success("Description updated successfully!");
        setIsEditingDescription(false);
        setCurrentDescription(editedDescription);
        setHasDescriptionChanged(true); // Mark that description was changed
        // Update mediaData to reflect the change
        setMediaData(prev => ({
          ...prev,
          description: editedDescription
        }));
        // Notify parent component to update timeline
        if (onDescriptionUpdate && imageId) {
          onDescriptionUpdate(imageId, editedDescription);
        }
      } else {
        toast.error("Failed to update description");
      }
    } catch (error) {
      console.error('Error updating description:', error);
      toast.error("Failed to update description");
    } finally {
      setIsSavingDescription(false);
    }
  };

  const handleDeleteDescription = async () => {
    if (!imageId) return;

    try {
      const response = await dashboardAPI.deletePostDescription(imageId);
      if (response.success) {
        toast.success("Description deleted successfully!");
        setIsDescriptionMenuOpen(false);
        setCurrentDescription("");
        setEditedDescription("");
        setHasDescriptionChanged(true); // Mark that description was changed
        // Update mediaData to reflect the change
        setMediaData(prev => ({
          ...prev,
          description: ""
        }));
        // Notify parent component to update timeline
        if (onDescriptionUpdate && imageId) {
          onDescriptionUpdate(imageId, "");
        }
      } else {
        toast.error("Failed to delete description");
      }
    } catch (error) {
      console.error('Error deleting description:', error);
      toast.error("Failed to delete description");
    }
  };

  const handleLikeComment = async (commentId: number) => {
    const isCurrentlyLiked = likedComments.has(commentId);
    console.log('🔥 handleLikeComment:', { commentId, isCurrentlyLiked });
    
    try {
      // Optimistically update the heart color immediately
      setLikedComments(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyLiked) {
          newSet.delete(commentId);
        } else {
          newSet.add(commentId);
        }
        return newSet;
      });

      // Call the appropriate API
      const response = isCurrentlyLiked 
        ? await mediaAPI.unlikeComment(commentId)
        : await mediaAPI.likeComment(commentId);
      
      console.log('🔥 Like/Unlike API response:', response);
      
      if (response.success) {
        // Refresh comments from API to get accurate counts and states
        console.log('🔥 Refreshing comments from API...');
        // Force refresh by resetting cache
        lastFetchedImageId.current = null;
        await fetchComments();
      } else {
        console.error(`Failed to ${isCurrentlyLiked ? 'unlike' : 'like'} comment:`, response.error);
        // Revert the optimistic heart color update on error
        setLikedComments(prev => {
          const newSet = new Set(prev);
          if (isCurrentlyLiked) {
            newSet.add(commentId);
          } else {
            newSet.delete(commentId);
          }
          return newSet;
        });
      }
    } catch (error) {
      console.error(`Error ${isCurrentlyLiked ? 'unliking' : 'liking'} comment:`, error);
      // Revert the optimistic heart color update on error
      setLikedComments(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyLiked) {
          newSet.add(commentId);
        } else {
          newSet.delete(commentId);
        }
        return newSet;
      });
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Recursive comment renderer
  const renderComment = (comment: Comment, depth = 0) => {
    const marginLeftPx = depth > 0 ? Math.min(depth * 44, 176) : 0; // 44px per level, max 176px (4 levels)
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedComments.has(comment.id);

    console.log(`💬 Rendering comment by ${comment.user.name}:`, {
      profile_color: comment.user.profile_color,
      generated_color: userDisplayUtils.getUserDisplayColor({
        name: comment.user.name,
        profile_color: comment.user.profile_color
      })
    });

    return (
      <div key={comment.id} style={depth > 0 ? { marginLeft: `${marginLeftPx}px` } : {}}>
        <div className="flex gap-3 items-start">
          <UserFallbackAvatar
            user={{
              name: comment.user.name,
              avatar: comment.user.profile_image,
              profile_color: comment.user.profile_color
            }}
            size={depth > 0 ? 'w-7 h-7' : 'w-8 h-8'}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{comment.user.name}</span>
              <span className="text-xs text-gray-500">{formatTimeAgo(comment.created_at)}</span>
              {/* Chevron icon for comments with replies */}
              {hasReplies && (
                <button
                  onClick={() => toggleCommentExpansion(comment.id)}
                  className="text-gray-400 hover:text-gray-200 transition-colors ml-auto flex items-center gap-1"
                  title={isExpanded ? "Collapse replies" : "Expand replies"}
                >
                  <span className="text-xs">
                    {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isExpanded ? 'transform rotate-0' : 'transform -rotate-90'
                    }`}
                  />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-300">
              {renderCommentWithMentions(comment.description)}
            </p>
            {extractMemoryShareLink(comment.description || '') && (
              <MemoryLinkPreview
                memoryId={extractMemoryShareLink(comment.description || '')!.memoryId}
                url={extractMemoryShareLink(comment.description || '')!.url}
                dark={true}
              />
            )}
            <div className="flex items-center gap-4 mt-2">
              <button
                onClick={() => handleLikeComment(comment.id)}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  likedComments.has(comment.id)
                    ? 'text-red-500 hover:text-red-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Heart className={`w-3 h-3 ${
                  likedComments.has(comment.id) ? 'fill-red-500 text-red-500' : ''
                }`} />
                <span className="font-medium min-w-[1rem] text-center">
                  {comment.likes_count ?? comment.like_count ?? 0}
                </span>
              </button>
              <button
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Reply
              </button>
            </div>
          </div>
        </div>

        {/* Reply Input - separate row with logged-in user avatar */}
        {replyingTo === comment.id && (
          <div className="mt-3 flex gap-3 items-start pl-11">
            <UserFallbackAvatar
              user={getCurrentUserForAvatar()}
              size="w-7 h-7"
            />
            <div className="flex-1 space-y-2">
              <textarea
                placeholder={`Reply to ${comment.user.name}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500"
                rows={2}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {setReplyingTo(null); setReplyText("");}}
                  className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAddReply(comment.id)}
                  disabled={!replyText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-xs px-3 py-1 rounded-lg"
                >
                  Reply
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Render nested replies recursively - only when expanded */}
        {hasReplies && isExpanded && (
          <div className="mt-3 space-y-3">
            {comment.replies.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={coverContentOnly ?
      "fixed z-[99999] bg-black flex" :
      "fixed inset-0 z-[99999] bg-black flex flex-col md:flex-row"
    } style={coverContentOnly ?
      { left: '0', right: '0', top: '0', bottom: '0' } :
      undefined
    }>
      {/* Left Side - Image Area */}
      <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden md:overflow-visible">
        {/* Header - Desktop */}
        <div className={`hidden md:flex items-center justify-between text-white bg-black/50 ${
          coverContentOnly ? 'p-4' : 'p-6'
        }`}>
          <div className="flex items-center gap-3">
            {/* Checkbox and Image Name */}
            <div className="flex items-center gap-2">
              {!hideCheckbox && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelection && onToggleSelection(imageId)}
                  className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                />
              )}
              <div>
                {/* Filename */}
                {(currentFilename || currentTitle) && (
                  <h2 className="text-lg font-medium">
                    {currentFilename || currentTitle}
                  </h2>
                )}

                {/* Date and Location */}
                <div className="flex items-center gap-4 text-sm text-white/80">
                  {currentDateTaken && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(currentDateTaken).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}</span>
                    </div>
                  )}
                  {displayLocation && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{displayLocation}</span>
                    </div>
                  )}
                </div>
                
                {/* Image counter */}
                {images.length > 1 && (
                  <p className="text-xs text-white/60 mt-1">
                    {currentImageIndex + 1} of {images.length}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Tags Icon - Before Location icon */}
            <div className="relative" ref={tagsPanelRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setShowTagsPanel(!showTagsPanel); }}
                className={`text-white hover:bg-white/20 ${showTagsPanel ? 'bg-white/20' : ''}`}
                title="Tags"
              >
                <Tag className="w-4 h-4" />
              </Button>
              {showTagsPanel && (
                <div
                  className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-xl p-4 space-y-3"
                  style={{ zIndex: 100002 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-sm font-semibold text-gray-900">Tags</p>

                  {/* Existing tags */}
                  {imageTags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {imageTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-gray-200 text-gray-900 text-[13px] rounded-full border border-gray-300"
                        >
                          <span className="leading-none">{tag}</span>
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            disabled={isSavingTags}
                            className="hover:text-red-500 flex-shrink-0 inline-flex items-center justify-center rounded-full w-4 h-4 leading-none disabled:opacity-40"
                          >
                            <X className="w-3 h-3" strokeWidth={2.5} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No tags yet</p>
                  )}

                  {/* Add new tag input with autocomplete */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                        placeholder="Add tags (comma separated)"
                        className="w-full h-8 text-xs border border-gray-200 rounded px-2.5 focus:outline-none focus:ring-1 focus:ring-[#6C60FF] focus:border-[#6C60FF] text-gray-900"
                        disabled={isSavingTags}
                      />
                      {tagInput.trim() && (() => {
                        const matches = storyTags.filter(t => t.toLowerCase().includes(tagInput.trim().toLowerCase()) && !imageTags.includes(t));
                        return matches.length > 0 ? (
                          <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-md mt-1 overflow-hidden">
                            {matches.slice(0, 5).map(tag => (
                              <button key={tag} type="button" onMouseDown={(e) => { e.preventDefault(); const newTags = tag.split(',').map(t => t.trim()).filter(t => t && !imageTags.includes(t)); if (newTags.length > 0) handleSaveTags([...imageTags, ...newTags]); setTagInput(''); }} className="w-full text-left px-3 py-2 text-xs text-gray-900 hover:bg-gray-50 flex items-center gap-2">
                                <Tag className="w-3 h-3 text-gray-400 flex-shrink-0" />{tag}
                              </button>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <button
                      onClick={handleAddTag}
                      disabled={!tagInput.trim() || isSavingTags}
                      className="h-8 px-3 text-xs font-medium bg-gray-200 hover:bg-gray-300 rounded border-0 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900"
                    >
                      {isSavingTags ? '...' : 'Add'}
                    </button>
                  </div>

                  {/* Suggested tags */}
                  {storyTags.length > 0 && (() => {
                    const suggestions = storyTags.filter(t => !imageTags.includes(t)).slice(0, 4);
                    return suggestions.length > 0 ? (
                      <div>
                        <p className="text-xs text-gray-400 mb-1.5">Suggested</p>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestions.map(tag => (
                            <button key={tag} type="button" disabled={isSavingTags} onClick={() => { if (!imageTags.includes(tag)) handleSaveTags([...imageTags, tag]); }} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[13px] bg-gray-100 text-gray-700 rounded-full border border-gray-200 hover:bg-gray-200 transition-colors disabled:opacity-40">
                              {tag}<span className="text-gray-400 font-medium">+</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </div>

            {/* Location Icon */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLocationDialog(true)}
              className={`text-white hover:bg-white/20 ${showLocationDialog ? 'bg-white/20' : ''}`}
              title="Location Information"
            >
              <MapPin className="w-4 h-4" />
            </Button>

            {/* Comments Icon with count */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
              className={`text-white hover:bg-white/20 relative ${showSidebar ? 'bg-white/20' : ''}`}
              title={showSidebar ? "Hide Comments" : "Show Comments"}
            >
              <svg width="16" height="16" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.70919 17.862C9.37851 18.7184 11.2988 18.9503 13.124 18.5161C14.9492 18.0818 16.5593 17.01 17.6641 15.4937C18.7689 13.9774 19.2959 12.1163 19.15 10.2458C19.004 8.37538 18.1949 6.61855 16.8682 5.29192C15.5416 3.96529 13.7848 3.1561 11.9143 3.01018C10.0439 2.86426 8.18278 3.3912 6.66647 4.49605C5.15015 5.60089 4.0783 7.21098 3.64407 9.03617C3.20984 10.8614 3.44178 12.7816 4.2981 14.451L2.54883 19.6113L7.70919 17.862Z" stroke="currentColor" strokeWidth="1.74928" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {comments.reduce((total, comment) => total + 1 + (comment.replies?.length || 0), 0) > 0 && (
                <span className="absolute -top-1 -right-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center" style={{ backgroundColor: '#6C60FF' }}>
                  {comments.reduce((total, comment) => total + 1 + (comment.replies?.length || 0), 0)}
                </span>
              )}
            </Button>

            {/* Zoom Controls */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
              className="text-white hover:bg-white/20"
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            
            <span className="text-white text-sm min-w-[4rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(prev => Math.min(prev + 0.25, 3))}
              className="text-white hover:bg-white/20"
              disabled={zoom >= 3}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>

            {/* Rotate */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRotation}
              className="text-white hover:bg-white/20"
              title="Rotate image"
            >
              <RotateCw className="w-4 h-4" />
            </Button>

            {/* Crop for Timeline */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartCrop}
              className="text-white hover:bg-white/20"
              title="Adjust for Timeline"
            >
              <Crop className="w-4 h-4" />
            </Button>

            {/* Download */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="text-white hover:bg-white/20"
              title="Download image"
            >
              <Download className="w-4 h-4" />
            </Button>

            {/* Close */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Header - Mobile */}
        <div className="md:hidden flex items-center gap-3 p-4 text-white bg-black">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-medium leading-tight truncate">
              {currentFilename || currentTitle}
            </h2>
            {subtitle && (
              <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>
            )}
          </div>
          {/* Image Counter - Mobile only, displayed in header */}
          {imageId && memoryId && (subImages.length > 0) && (
            <div className="flex items-center justify-center bg-white/10 rounded-full px-3 py-1.5">
              <span className="text-xs text-white font-medium whitespace-nowrap">
                {currentSubImageIndex + 1}/{subImages.length + 1}
              </span>
            </div>
          )}
        </div>

        {/* Main Content Area with Sub-images Sidebar and Image Container */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
          {/* Sidebar - Sub-images Thumbnails (Top on Mobile, Left on Desktop) */}
          {imageId && memoryId && (
            <div className="flex flex-row md:flex-col w-full md:w-[180px] h-[100px] md:h-auto flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-800 bg-black px-3 py-2 md:p-4 gap-2 md:gap-3 overflow-x-auto md:overflow-x-visible md:overflow-y-auto">
              {/* Add Button - Only show if user role is not 'view' (viewer) */}
              {userRole !== 'viewer' && (
                <div className="flex flex-col items-center flex-shrink-0">
                  {/* Mobile Add Button */}
                  <button
                    onClick={() => setIsAddMomentModalOpen(true)}
                    className="md:hidden w-[70px] h-[70px] rounded-full bg-gray-800 border border-gray-600 hover:border-[#6C60FF] hover:bg-gray-700 transition-colors cursor-pointer flex items-center justify-center"
                  >
                    <Plus className="w-10 h-10 text-gray-400" />
                  </button>
                  {/* Desktop Add Button */}
                  <button
                    onClick={() => setIsAddMomentModalOpen(true)}
                    className="hidden md:flex flex-col items-center justify-center w-[80px] h-[80px] md:w-full md:aspect-square rounded-lg border-2 border-dashed border-gray-600 hover:border-[#6C60FF] hover:bg-gray-900 transition-colors cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-full bg-gray-800 group-hover:bg-[#6C60FF] flex items-center justify-center transition-colors">
                      <Plus className="w-6 h-6 text-gray-400 group-hover:text-white" />
                    </div>
                    <span className="text-xs text-gray-400 group-hover:text-white mt-2">Add</span>
                  </button>
                  {/* Mobile Add Label */}
                  <span className="md:hidden text-[9px] text-gray-400 mt-1">Add</span>
                </div>
              )}

              {/* Image Counter - Desktop only (mobile shows in header) */}
              <div className="hidden md:flex items-center justify-center text-center py-2">
                <span className="text-sm text-white font-medium">
                  Image {currentSubImageIndex + 1} of {subImages.length + 1}
                </span>
              </div>

              {/* Current/Main Image Thumbnail */}
              <div
                className={`group relative cursor-pointer rounded-full md:rounded-lg overflow-hidden border-2 transition-all w-[70px] h-[70px]  md:w-[120px] md:h-[120px] md:w-full md:aspect-square flex-shrink-0 ${
                  currentSubImageIndex === 0 ? 'border-[#6C60FF] shadow-lg shadow-[#6C60FF]/30' : 'border-gray-700 hover:border-gray-500'
                }`}
                onClick={() => setCurrentSubImageIndex(0)}
              >
                <img
                  src={imageSrc}
                  alt={imageAlt}
                  className="w-full h-full object-cover"
                  style={{ transform: `rotate(${rotation}deg)` }}
                />
                {currentSubImageIndex === 0 && (
                  <div className="absolute inset-0 bg-[#6C60FF]/20"></div>
                )}

                {/* Star icon for featured image - Only show when sub-images exist */}
                {imageId && subImages.length > 0 && (
                  <button
                    onClick={(e) => {
                      console.log('⭐ Parent star clicked - imageId:', imageId, 'featuredImageId:', featuredImageId);
                      handleToggleFeatured(e, imageId);
                    }}
                    className={`absolute top-1 left-1 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full shadow-lg transition-all z-50 ${
                      featuredImageId === imageId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    title={featuredImageId === imageId ? "Remove from featured" : "Set as featured image"}
                  >
                    <Star
                      className="w-3 h-3 md:w-4 md:h-4"
                      fill={featuredImageId === imageId ? "#FCD34D" : "none"}
                      stroke={featuredImageId === imageId ? "#FCD34D" : "white"}
                      strokeWidth={2}
                    />
                  </button>
                )}
                {void console.log('🎨 Rendering parent star - imageId:', imageId, 'featuredImageId:', featuredImageId, 'Match:', featuredImageId === imageId)}
              </div>

              {/* Sub-images Thumbnails */}
              {subImages.map((subImage, index) => (
                <div
                  key={subImage.id}
                  className={`group relative cursor-pointer rounded-full md:rounded-lg overflow-hidden border-2 transition-all w-[70px] h-[70px] md:w-[120px] md:h-[120px] md:w-full md:aspect-square flex-shrink-0 ${
                    currentSubImageIndex === index + 1 ? 'border-[#6C60FF] shadow-lg shadow-[#6C60FF]/30' : 'border-gray-700 hover:border-gray-500'
                  }`}
                  onClick={() => setCurrentSubImageIndex(index + 1)}
                >
                  <img
                    src={subImage.src}
                    alt={subImage.alt}
                    className="w-full h-full object-cover"
                  />
                  {currentSubImageIndex === index + 1 && (
                    <div className="absolute inset-0 bg-[#6C60FF]/20"></div>
                  )}

                  {/* Star icon for featured image - Visible on hover or if featured */}
                  <button
                    onClick={(e) => handleToggleFeatured(e, subImage.id)}
                    className={`absolute top-1 left-1 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full shadow-lg transition-all z-50 ${
                      featuredImageId === subImage.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    title={featuredImageId === subImage.id ? "Remove from featured" : "Set as featured image"}
                  >
                    <Star
                      className="w-3 h-3 md:w-4 md:h-4"
                      fill={featuredImageId === subImage.id ? "#FCD34D" : "none"}
                      stroke={featuredImageId === subImage.id ? "#FCD34D" : "white"}
                      strokeWidth={2}
                    />
                  </button>

                  {/* Delete button for sub-images - Only visible on hover */}
                  {onDeleteSubImage && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent selecting the image when clicking delete
                        console.log('🗑️ Delete button clicked for sub-image:', subImage.id);
                        if (window.confirm('Are you sure you want to delete this sub-image?')) {
                          onDeleteSubImage(subImage.id);
                        }
                      }}
                      className="absolute top-1 right-1 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-all z-50 opacity-0 group-hover:opacity-100"
                      title="Delete sub-image"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Image Container */}
          <div
            className="md:flex-1 flex items-center justify-center relative overflow-hidden md:cursor-grab md:active:cursor-grabbing md:p-8 h-[50vh] md:h-auto md:min-h-0 md:max-h-none flex-shrink-0 md:flex-shrink"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
          >
          {/* Blurred Background for Mobile Images (not for PDFs) */}
          {!isPdfSrc && (
            <>
              <div
                className="md:hidden absolute inset-0 z-0"
                style={{
                  backgroundImage: `url(${currentImageSrc})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(20px)',
                  transform: 'scale(1.1)',
                }}
              />
              <div className="md:hidden absolute inset-0 z-0 bg-black/30" />
            </>
          )}

          {/* PDF Viewer — full size using blob URL (no Content-Disposition issues) */}
          {isPdfSrc ? (
            <div className="relative w-full z-10 flex items-center justify-center" style={{ height: '75vh' }}>
              {!pdfBlobUrl ? (
                <div className="flex flex-col items-center justify-center text-white/60 gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm">Loading PDF…</span>
                </div>
              ) : (
                <iframe
                  key={pdfBlobUrl}
                  src={pdfBlobUrl}
                  className="h-full rounded-lg border-0"
                  title={currentImageAlt || 'PDF Document'}
                  style={{ minHeight: '70vh', width: '75%' }}
                />
              )}
            </div>
          ) : (
            /* Image */
            <div
              className="relative transition-transform duration-200 ease-out w-full md:w-auto z-10"
              style={{
                transform: `scale(${typeof window !== 'undefined' && window.innerWidth < 768 ? 1 : zoom}) rotate(${rotation}deg)`,
                maxWidth: '100%',
              }}
            >
              <ImageWithFallback
                src={currentImageSrc}
                alt={currentImageAlt}
                className="w-full h-full object-contain"
                key={currentImageSrc}
                fallback={
                  <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
                    <div className="text-center text-white/60">
                      <div className="w-16 h-16 mx-auto mb-2 opacity-50">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                        </svg>
                      </div>
                      <p className="text-sm">Image could not be loaded</p>
                      <p className="text-xs text-white/40 mt-1">Source: {currentImageSrc}</p>
                    </div>
                  </div>
                }
              />
            </div>
          )}

          {/* Cropping Interface Overlay */}
          {isCropping && (
            <div className="absolute inset-0 z-50 bg-black">
              {/* Cropper */}
              <div className="absolute inset-0">
                <Cropper
                  image={currentImageSrc}
                  crop={cropPosition}
                  zoom={cropZoom}
                  aspect={4 / 3}
                  rotation={rotation}
                  onCropChange={setCropPosition}
                  onZoomChange={setCropZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              {/* Crop Controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-4 flex items-center justify-between gap-4 z-60">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-white text-sm">Zoom:</span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={cropZoom}
                    onChange={(e) => setCropZoom(Number(e.target.value))}
                    className="flex-1 max-w-xs"
                  />
                  <span className="text-white text-sm min-w-[3rem]">{Math.round(cropZoom * 100)}%</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelCrop}
                    disabled={isSavingCrop}
                    className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveCrop}
                    disabled={isSavingCrop}
                    className="bg-[#6C60FF] text-white hover:bg-[#5850CC]"
                  >
                    {isSavingCrop ? 'Saving...' : 'Save for Timeline'}
                  </Button>
                </div>
              </div>

              {/* Instructions */}
              <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-lg text-sm z-60">
                Drag to reposition • Scroll or use slider to zoom
              </div>
            </div>
          )}

          {/* Carousel Navigation - Visible on all devices */}
          {images.length > 1 && (
            <>
              {/* Previous Image Button */}
              <Button
                variant="ghost"
                size="lg"
                onClick={onPrevImage}
                disabled={currentImageIndex === 0}
                className="flex absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 disabled:hover:bg-black/50 transition-all duration-200"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>

              {/* Next Image Button */}
              <Button
                variant="ghost"
                size="lg"
                onClick={onNextImage}
                disabled={currentImageIndex === images.length - 1}
                className="flex absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 disabled:hover:bg-black/50 transition-all duration-200"
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </>
          )}
          </div>

          {/* Mobile Description Section - Below Image (inside scrollable area) */}
          <div className="md:hidden bg-black text-white flex-shrink-0 pb-20">
            <div className="p-4 space-y-4">
              {/* User Info - Only show when we have actual data */}
              {(mediaData.user_name || user_name) && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium overflow-hidden flex-shrink-0">
                    {(mediaData.user_profile || user_profile) ? (
                      <img
                        src={mediaData.user_profile || user_profile}
                        alt={mediaData.user_name || user_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white">
                        {getInitials(mediaData.user_name || user_name || '')}
                      </div>
                    )}
                  </div>
                  <div className="font-medium text-sm">{mediaData.user_name || user_name}</div>
                </div>
              )}

              {/* Description */}
              {currentDescription && (
                <p className="text-sm text-gray-300 leading-relaxed">
                  {renderCommentWithMentions(currentDescription)}
                </p>
              )}

              {/* Date and Location */}
              <div className="flex items-center gap-4 text-xs text-gray-400">
                {dateTaken && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(dateTaken).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}</span>
                  </div>
                )}
                {currentLocation && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{currentLocation}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Comments Button - Mobile (Fixed at bottom right) */}
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="md:hidden fixed bottom-2 right-6 text-white rounded-full p-3 shadow-lg z-50 flex items-center justify-center"
        >
          <svg width="30" height="30" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7.70919 17.862C9.37851 18.7184 11.2988 18.9503 13.124 18.5161C14.9492 18.0818 16.5593 17.01 17.6641 15.4937C18.7689 13.9774 19.2959 12.1163 19.15 10.2458C19.004 8.37538 18.1949 6.61855 16.8682 5.29192C15.5416 3.96529 13.7848 3.1561 11.9143 3.01018C10.0439 2.86426 8.18278 3.3912 6.66647 4.49605C5.15015 5.60089 4.0783 7.21098 3.64407 9.03617C3.20984 10.8614 3.44178 12.7816 4.2981 14.451L2.54883 19.6113L7.70919 17.862Z" stroke="currentColor" strokeWidth="1.74928" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {comments.reduce((total, comment) => total + 1 + (comment.replies?.length || 0), 0) > 0 && (
            <span className="absolute -top-1 -right-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center" style={{ backgroundColor: '#6C60FF' }}>
              {comments.reduce((total, comment) => total + 1 + (comment.replies?.length || 0), 0)}
            </span>
          )}
        </button>

        {/* Footer/Help - Desktop only */}
        <div className="hidden md:block p-4 bg-black/50">
          <div className="text-center text-white/60 text-sm">
            <p>
              <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">Esc</kbd> to close •
              <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">+/-</kbd> to zoom •
              <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">R</kbd> to rotate •
              <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">0</kbd> to reset
              {images.length > 1 && (
                <> • <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">←/→</kbd> navigate</>
              )}
              {onToggleSelection && (
                <> • <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">Space</kbd> select</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Backdrop for mobile bottom sheet */}
      {showSidebar && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-[99999]"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Right Sidebar - Description and Comments */}
      {showSidebar && (
        <div className="fixed bottom-0 left-0 right-0 md:relative md:inset-auto md:w-96 bg-white md:bg-black text-white flex flex-col h-[60vh] md:h-full md:border-l border-gray-800 z-[100000] rounded-t-3xl md:rounded-none">
          {/* Mobile Header for Comments */}
          <div className="md:hidden bg-white rounded-t-3xl">
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
            </div>
            <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Comments ({comments.reduce((total, comment) => total + 1 + (comment.replies?.length || 0), 0)})</h3>
              <button onClick={() => setShowSidebar(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        <div className="flex-1 overflow-y-auto md:bg-black bg-white">
          {/* Description Section - Mobile shows at top of comment sheet */}
          <div className="md:hidden p-4 border-b border-gray-200 bg-white">
            {/* User Info */}
            <div className="mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium overflow-hidden flex-shrink-0">
                  {(mediaData.user_profile || user_profile) ? (
                    <img
                      src={mediaData.user_profile || user_profile}
                      alt={mediaData.user_name || user_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-purple-500 flex items-center justify-center text-white">
                      {getInitials(mediaData.user_name || user_name || 'User')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">{mediaData.user_name || user_name || 'User'}</span>
                  <span className="text-xs text-gray-500">1w ago</span>
                </div>
              </div>
              {currentDescription && (
                <div className="flex gap-3 mt-2">
                  <div className="w-10 flex-shrink-0" />
                  <p className="text-base text-gray-700 leading-relaxed flex-1">
                    {renderCommentWithMentions(currentDescription)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Description Section - Desktop only */}
          <div className="hidden md:block p-6 border-b border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Description</h3>
              {currentDescription && (
                <Popover open={isDescriptionMenuOpen} onOpenChange={setIsDescriptionMenuOpen}>
                  <PopoverTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDescriptionMenuOpen(!isDescriptionMenuOpen);
                      }}
                      className="h-6 w-6 p-0 hover:bg-gray-800 rounded-full flex items-center justify-center"
                    >
                      <MoreVertical className="h-4 w-4 text-gray-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-40 p-2 bg-white border border-gray-200 shadow-lg z-[100000]"
                    align="end"
                    sideOffset={5}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditDescription();
                        }}
                        className="flex items-center justify-start text-sm h-8 px-2 hover:bg-gray-100 bg-white text-gray-900 rounded w-full"
                      >
                        <Edit className="h-3.5 w-3.5 mr-2" />Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDescription();
                        }}
                        className="flex items-center justify-start text-sm h-8 px-2 hover:bg-red-50 hover:text-red-600 bg-white text-gray-900 rounded w-full"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            
            {/* User Info - Only show when we have actual data */}
            {(mediaData.user_name || user_name) && (
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium overflow-hidden">
                  {(mediaData.user_profile || user_profile) ? (
                    <img
                      src={mediaData.user_profile || user_profile}
                      alt={mediaData.user_name || user_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white">
                      {getInitials(mediaData.user_name || user_name || 'U')}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium">{mediaData.user_name || user_name}</div>
                </div>
              </div>
            )}
            
            {/* Description Text */}
            {isEditingDescription ? (
              <div className="mb-4 space-y-2">
                <div className="relative">
                  <Textarea
                    ref={descEditTextareaRef}
                    value={editedDescription}
                    onChange={handleDescEditChange}
                    placeholder="Write a description for this moment... (Use @ to mention collaborators)"
                    className="bg-gray-900 border border-gray-700 text-white resize-none"
                    style={{
                      minHeight: '80px',
                      height: 'auto',
                      maxHeight: '400px',
                      overflowY: editedDescription.split('\n').length > 10 ? 'auto' : 'hidden'
                    }}
                    rows={Math.max(3, Math.min(15, editedDescription.split('\n').length || 3))}
                    autoFocus
                  />

                  {/* Mention dropdown for description editing */}
                  {showDescEditMentionDropdown && filteredDescEditCollaborators.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                      {filteredDescEditCollaborators.map((collaborator, index) => (
                        <div
                          key={collaborator.id}
                          onClick={() => handleDescEditMentionSelect(collaborator)}
                          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-700 transition-colors"
                          style={{
                            borderBottom: index < filteredDescEditCollaborators.length - 1 ? '1px solid #374151' : 'none'
                          }}
                        >
                          <div
                            className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                            style={{
                              backgroundColor: formatProfileColor(collaborator.profileColor)
                            }}
                          >
                            {collaborator.avatar && collaborator.avatar.trim() !== '' ? (
                              <img
                                src={collaborator.avatar}
                                alt={collaborator.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : null}
                            <span className={collaborator.avatar && collaborator.avatar.trim() !== '' ? 'hidden' : ''}>
                              {getInitials(collaborator.name)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium text-sm truncate">
                              {collaborator.name}
                            </div>
                            <div className="text-gray-400 text-xs truncate">
                              {collaborator.email}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => {
                      setIsEditingDescription(false);
                      setEditedDescription(currentDescription);
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white hover:bg-gray-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveDescription}
                    size="sm"
                    disabled={isSavingDescription}
                    className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="h-3.5 w-3.5 mr-2" />
                    {isSavingDescription ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : currentDescription ? (
              <p className="text-gray-300 leading-relaxed mb-4 break-words whitespace-pre-wrap">
                {renderCommentWithMentions(currentDescription)}
              </p>
            ) : null}
            
            {/* Metadata */}
            <div className="space-y-2 text-sm text-gray-400">
              {dateTaken && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(dateTaken).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}</span>
                </div>
              )}
              {currentLocation && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{currentLocation}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Comments Section */}
          <div className="p-6 md:block hidden">
            <div className="flex items-center gap-2 mb-6">
              <svg width="20" height="20" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.70919 17.862C9.37851 18.7184 11.2988 18.9503 13.124 18.5161C14.9492 18.0818 16.5593 17.01 17.6641 15.4937C18.7689 13.9774 19.2959 12.1163 19.15 10.2458C19.004 8.37538 18.1949 6.61855 16.8682 5.29192C15.5416 3.96529 13.7848 3.1561 11.9143 3.01018C10.0439 2.86426 8.18278 3.3912 6.66647 4.49605C5.15015 5.60089 4.0783 7.21098 3.64407 9.03617C3.20984 10.8614 3.44178 12.7816 4.2981 14.451L2.54883 19.6113L7.70919 17.862Z" stroke="currentColor" strokeWidth="1.74928" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h3 className="text-lg font-semibold">Comments ({comments.reduce((total, comment) => total + 1 + (comment.replies?.length || 0), 0)})</h3>
            </div>

            {/* Comments List */}
            <div className="space-y-4 mb-6">
              {isLoadingComments ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto"></div>
                  <p className="text-sm text-gray-400 mt-2">Loading comments...</p>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No comments yet. Be the first to comment!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map(comment => renderComment(comment, 0))}
                </div>
              )}
            </div>

            {/* Add Comment Input */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <UserFallbackAvatar
                  user={getCurrentUserForAvatar()}
                  size="w-8 h-8"
                />
                <div className="flex-1 relative">
                  <textarea
                    ref={newCommentTextareaRef}
                    placeholder="Add a comment... (Type @ to mention collaborators)"
                    value={newComment}
                    onChange={handleCommentChange}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500"
                    rows={3}
                  />

                  {/* Mention dropdown */}
                  {showMentionDropdown && filteredCollaborators.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                      {filteredCollaborators.map((collaborator, index) => (
                        <div
                          key={collaborator.id}
                          onClick={() => handleMentionSelect(collaborator)}
                          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-700 transition-colors"
                          style={{
                            borderBottom: index < filteredCollaborators.length - 1 ? '1px solid #374151' : 'none'
                          }}
                        >
                          <div
                            className="w-9 h-9 flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-semibold"
                            style={{
                              backgroundColor: formatProfileColor(collaborator.profileColor)
                            }}
                          >
                            {collaborator.avatar && collaborator.avatar.trim() !== '' ? (
                              <img
                                src={collaborator.avatar}
                                alt={collaborator.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : null}
                            <span className={collaborator.avatar && collaborator.avatar.trim() !== '' ? 'hidden' : ''}>
                              {collaborator.name?.slice(0, 2).toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-semibold text-white truncate">
                              {collaborator.name}
                            </span>
                            <span className="text-xs text-gray-400 truncate">
                              {collaborator.email || collaborator.phone_number || ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end items-center gap-2">
                <button
                  onClick={() => {
                    setNewComment("");
                    setShowMentionDropdown(false);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1"
                  disabled={isAddingComment}
                >
                  Cancel
                </button>

                <button
                  onClick={handleAddComment}
                  disabled={!hasContentBeyondMentions(newComment) || isAddingComment}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg font-medium"
                >
                  <Send className="w-4 h-4" />
                  {isAddingComment ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </div>

          {/* Comments Section - Mobile */}
          <div ref={mobileCommentsRef} className="md:hidden p-4 bg-white pb-24">

            {/* Comments List */}
            <div className="space-y-4 mb-20">
              {isLoadingComments ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Loading comments...</p>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No comments yet. Be the first to comment!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map(comment => {
                    const hasReplies = comment.replies && comment.replies.length > 0;
                    const isExpanded = expandedComments.has(comment.id);

                    return (
                      <div key={comment.id} className="space-y-3">
                        <div className="flex gap-3 items-start">
                          <UserFallbackAvatar
                            user={{
                              name: comment.user.name,
                              avatar: comment.user.profile_image,
                              profile_color: comment.user.profile_color
                            }}
                            size="w-9 h-9"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm text-gray-900">{comment.user.name}</span>
                              <span className="text-xs text-gray-500">{formatTimeAgo(comment.created_at)}</span>
                            </div>
                            <p className="text-base text-gray-800 leading-relaxed mb-2">
                              {renderCommentWithMentions(comment.description)}
                            </p>
                            {extractMemoryShareLink(comment.description || '') && (
                              <MemoryLinkPreview
                                memoryId={extractMemoryShareLink(comment.description || '')!.memoryId}
                                url={extractMemoryShareLink(comment.description || '')!.url}
                                dark={false}
                              />
                            )}
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => handleLikeComment(comment.id)}
                                className={`flex items-center gap-1 text-xs ${
                                  likedComments.has(comment.id)
                                    ? 'text-red-500'
                                    : 'text-gray-500'
                                }`}
                              >
                                <Heart className={`w-3.5 h-3.5 ${
                                  likedComments.has(comment.id) ? 'fill-red-500' : ''
                                }`} />
                                <span>{comment.likes_count ?? comment.like_count ?? 0}</span>
                              </button>
                              <button
                                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                                className="text-xs text-gray-600"
                              >
                                Reply
                              </button>
                              {hasReplies && (
                                <button
                                  onClick={() => toggleCommentExpansion(comment.id)}
                                  className="text-xs text-gray-600 flex items-center gap-1"
                                >
                                  <span>{comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}</span>
                                  <ChevronDown
                                    className={`w-3 h-3 transition-transform ${
                                      isExpanded ? 'rotate-0' : '-rotate-90'
                                    }`}
                                  />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Reply Input - separate row with logged-in user avatar */}
                        {replyingTo === comment.id && (
                          <div className="flex gap-3 items-start pl-12">
                            <UserFallbackAvatar
                              user={getCurrentUserForAvatar()}
                              size="w-8 h-8"
                            />
                            <div className="flex-1 space-y-2">
                              <textarea
                                placeholder={`Reply to ${comment.user.name}...`}
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:border-purple-400"
                                rows={2}
                                autoFocus
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => {setReplyingTo(null); setReplyText("");}}
                                  className="text-xs text-gray-600 px-3 py-1.5"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleAddReply(comment.id)}
                                  disabled={!replyText.trim()}
                                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white text-xs px-3 py-1.5 rounded-lg"
                                >
                                  Reply
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Render nested replies - only when expanded */}
                        {hasReplies && isExpanded && (
                          <div className="ml-12 space-y-3">
                            {comment.replies.map(reply => (
                              <div key={reply.id} className="flex gap-3">
                                <UserFallbackAvatar
                                  user={{
                                    name: reply.user.name,
                                    avatar: reply.user.profile_image,
                                    profile_color: reply.user.profile_color
                                  }}
                                  size="w-8 h-8"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-sm text-gray-900">{reply.user.name}</span>
                                    <span className="text-xs text-gray-500">{formatTimeAgo(reply.created_at)}</span>
                                  </div>
                                  <p className="text-base text-gray-800 leading-relaxed mb-2">
                                    {renderCommentWithMentions(reply.description)}
                                  </p>
                                  {extractMemoryShareLink(reply.description || '') && (
                                    <MemoryLinkPreview
                                      memoryId={extractMemoryShareLink(reply.description || '')!.memoryId}
                                      url={extractMemoryShareLink(reply.description || '')!.url}
                                      dark={false}
                                    />
                                  )}
                                  <div className="flex items-center gap-4">
                                    <button
                                      onClick={() => handleLikeComment(reply.id)}
                                      className={`flex items-center gap-1 text-xs ${
                                        likedComments.has(reply.id)
                                          ? 'text-red-500'
                                          : 'text-gray-500'
                                      }`}
                                    >
                                      <Heart className={`w-3.5 h-3.5 ${
                                        likedComments.has(reply.id) ? 'fill-red-500' : ''
                                      }`} />
                                      <span>{reply.likes_count ?? reply.like_count ?? 0}</span>
                                    </button>
                                    <button className="text-xs text-gray-600">
                                      Reply
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Fixed Input Section - Mobile */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-[100001]">
            <div className="flex gap-2 items-center">
              <UserFallbackAvatar
                user={getCurrentUserForAvatar()}
                size="w-9 h-9"
              />
              <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-full px-4 py-2 border border-gray-200">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!hasContentBeyondMentions(newComment)}
                  className="p-1.5 rounded-full bg-purple-600 disabled:bg-gray-300 text-white"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}
      
      {/* Location Information Dialog */}
      <LocationInfoDialog
        isOpen={showLocationDialog}
        onClose={() => setShowLocationDialog(false)}
        imageId={imageId}
        locationData={{
          ...locationData,
          address: currentLocation || locationData?.address
        }}
        isCommentSectionOpen={showSidebar}
        onEditLocation={() => {
          setShowLocationDialog(false);
          onEditLocation?.();
        }}
        onLocationUpdated={(newLocation) => {
          // Update the current location state to immediately reflect the change
          setCurrentLocation(newLocation);
          // Update the locationData to reflect the new location
          if (locationData) {
            locationData.address = newLocation;
          }
          // Notify parent component about the location change
          onLocationChange?.(newLocation);
          // Force refresh comments to get updated location from API
          lastFetchedImageId.current = null; // Reset cache to force refresh
          fetchComments();
          // Trigger refresh if callback provided
          onRefreshData?.();
        }}
        onRefreshData={onRefreshData}
      />

      {/* Add Moment Modal for Sub-images */}
      {memoryId && imageId && (
        <AddMomentModal
          isOpen={isAddMomentModalOpen}
          onClose={() => setIsAddMomentModalOpen(false)}
          memoryId={memoryId}
          memoryTitle={memoryTitle}
          memoryThumbnail={memoryThumbnail}
          memoryCreatedDate={memoryCreatedDate}
          memoryImages={memoryImages}
          parentImageId={imageId}
          userRole={userRole === 'view' ? 'viewer' : userRole === 'edit' ? 'contributor' : userRole as 'contributor' | 'viewer' | 'admin' | undefined}
          onAddMoment={(momentData) => {
            console.log('Sub-image added:', momentData);

            // Don't show toast here - AddMomentModal already shows the appropriate message
            // Just refresh the sub-images list

            // Refresh sub-images list
            if (imageId && onGetSubImages) {
              const fetchedSubImages = onGetSubImages(imageId);
              setSubImages(fetchedSubImages);
              console.log('📸 Refreshed sub-images after add:', fetchedSubImages);
            }
            if (onSubImageAdded) {
              onSubImageAdded();
            }
          }}
        />
      )}
    </div>
  );
}