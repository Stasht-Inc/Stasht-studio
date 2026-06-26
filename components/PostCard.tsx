import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import GooglePlacesInput from "./ui/google-places-input";
import { MapPin, Calendar, FileText, Eye, MessageSquare, MoreHorizontal, Edit, Save, X, Trash2, MoreVertical, Linkedin, Facebook, Mail, ChevronLeft, ChevronRight, Heart, Share2, UserCheck, ExternalLink } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { MockPost } from "../data/mockPosts";
import { dashboardAPI, userUtils, userDisplayUtils } from "../utils/authUtils";
import { toast } from "sonner";
import ToneSelectionModal from "./ToneSelectionModal";
import { EditMediaItemPopover } from "./EditMediaItemPopover";
import { aiCreditsAPI } from "../services/aiCreditsAPI";
import { recheckMemoryLimit } from "../hooks/useMemoryLimit";

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
  const backgroundColor = userDisplayUtils.getUserDisplayColor(user);
  const backgroundStyle = { backgroundColor };

  const fallbackClassName = `${size} rounded-full text-white font-medium text-xs flex items-center justify-center flex-shrink-0 ${className}`;

  if (user?.avatar) {
    return (
      <div className={`${size} rounded-full overflow-hidden bg-gray-100 flex-shrink-0 ${className}`}>
        <img
          src={user.avatar}
          alt={user.name || 'User'}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
        <div className={fallbackClassName} style={backgroundStyle}>
          {initials}
        </div>
      </div>
    );
  }

  return (
    <div className={fallbackClassName} style={backgroundStyle}>
      {initials}
    </div>
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
  role: 'view' | 'edit' | 'admin' | 'contributor';
  status: 'active' | 'pending' | 'invited';
}

interface SubImage {
  id: string;
  src: string;
  alt: string;
  title?: string;
  description?: string;
  location?: string;
  dateTaken?: string;
}

interface MemoryImage {
  id: string;
  src: string;
  title?: string;
  subImages?: MemoryImage[];
}

interface PostCardProps {
  post: MockPost;
  variant?: 'card' | 'thumbnail';
  onContentUpdate?: (postId: string, newContent: string) => void;
  onImageClick?: (src: string, alt: string, title?: string, subtitle?: string, imageId?: string, focusComments?: boolean) => void;
  memoryOwnerId?: string; // ID of the memory owner
  onPostDelete?: (postId: string) => void; // Callback when post is deleted
  onUpdateItem?: (id: string, updates: any) => void; // Callback for updating moment
  activeCollaborators?: Collaborator[]; // Active collaborators for mentions
  subImageCount?: number; // Count of sub-images for this post
  subImages?: SubImage[]; // Array of sub-images for this post
  memoryTitle?: string;
  memoryThumbnail?: string;
  memoryCreatedDate?: string;
  memoryImages?: MemoryImage[];
  onRefresh?: () => void; // Callback to refresh memory data after description updates
  memoryPublished?: number; // Memory published status: 1 = public, 2 = view only, 3 = private
  memoryId?: string; // Memory ID for generating post share links
  memorySlug?: string; // Memory slug for published memory links
  searchHighlight?: string; // Search query to highlight in description
  storyTags?: string[];
  onInsufficientCredits?: (availableCredits: number) => void; // Callback when credits are insufficient
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  docusignDocument?: {
    envelope_id: string;
    document_name: string;
    status: string;
    signed_document_url: string;
  };
}

export default function PostCard({ post, variant = 'thumbnail', onContentUpdate, onImageClick, memoryOwnerId, onPostDelete, onUpdateItem, activeCollaborators = [], subImageCount = 0, subImages = [], memoryTitle, memoryThumbnail, memoryCreatedDate, memoryImages = [], onRefresh, memoryPublished, memoryId, memorySlug, searchHighlight, storyTags = [], onInsufficientCredits, docusignDocument, onMoveUp, onMoveDown }: PostCardProps) {
  // Debug log to check title in PostCard
  console.log(`📝 PostCard received post ${post.id}: title="${post.title}", name="${post.name}"`);

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

  const [isAddingDescription, setIsAddingDescription] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [isEditPopoverOpen, setIsEditPopoverOpen] = useState(false);
  const [isTimelineMenuOpen, setIsTimelineMenuOpen] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(post.content || "");
  const [currentContent, setCurrentContent] = useState(post.content || "");
  const [localSubImages, setLocalSubImages] = useState(subImages);
  const [isEditingDescriptionLoading, setIsEditingDescriptionLoading] = useState(false);
  const [imageOrientation, setImageOrientation] = useState<'landscape' | 'portrait' | 'square'>('landscape');
  const [isAISuggesting, setIsAISuggesting] = useState(false);
  const [isToneModalOpen, setIsToneModalOpen] = useState(false);
  const [selectedTone, setSelectedTone] = useState<string>('personal');
  const [isRetryingAI, setIsRetryingAI] = useState(false);
  const [hasAISuggestion, setHasAISuggestion] = useState(false);
  const [isCaptionHidden, setIsCaptionHidden] = useState(
    (post as any).hide_caption === 1 || (post as any).hide_caption === true
  );
  const [isEditMomentOpen, setIsEditMomentOpen] = useState(false);
  // Keep caption-hidden state in sync with the (refreshed) post data
  useEffect(() => {
    setIsCaptionHidden((post as any).hide_caption === 1 || (post as any).hide_caption === true);
  }, [(post as any).hide_caption]);
  const [imageDimensions, setImageDimensions] = useState<string>('');
  const [imageSize, setImageSize] = useState<string>('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isAddingDescriptionLoading, setIsAddingDescriptionLoading] = useState(false);
  const aiSuggestButtonRef = useRef<HTMLButtonElement>(null);

  // States for edit description mentions
  const [showEditMentionDropdown, setShowEditMentionDropdown] = useState(false);
  const [editMentionSearch, setEditMentionSearch] = useState('');
  const [editCursorPosition, setEditCursorPosition] = useState(0);
  const editDescriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Like and Share states
  const [likesCount, setLikesCount] = useState(post.likes || post.likes_count || 0);
  const [isLiked, setIsLiked] = useState(post.isLiked || post.is_liked || false);
  const [sharesCount, setSharesCount] = useState(post.shares_count || 0);
  const [isSharePopoverOpen, setIsSharePopoverOpen] = useState(false);

  // Add Media (replace no-image placeholder)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const isNoImagePlaceholder = !!(
    post.image && (
      post.image.includes('no-image-placeholder') ||
      /\.svg(\?.*)?$/i.test(post.image)
    )
  );

  const handleAddMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateItem) return;

    setIsUploadingMedia(true);
    try {
      await onUpdateItem(String(post.id), { newPhoto: file });
    } finally {
      setIsUploadingMedia(false);
      e.target.value = '';
    }
  };

  // Helper function to increment share count
  const handleIncrementShareCount = async () => {
    try {
      const response = await dashboardAPI.post('/memory-images/increment-share', {
        post_id: post.id
      });

      console.log('Share API Response:', response);

      if (response.success === true) {
        // Update share count from server
        setSharesCount(response.data.share_count);
      }
    } catch (error) {
      console.error('Error incrementing share count:', error);
      // Still increment locally even if API fails
      setSharesCount(prev => prev + 1);
    }
  };

  // Load crop settings from localStorage
  const [cropData, setCropData] = useState<{x: number; y: number; width: number; height: number; zoom: number; imageWidth?: number; imageHeight?: number} | null>(null);

  useEffect(() => {
    console.log('🔍 PostCard crop check for post:', post.id, {
      hasCropDataProp: !!post.crop_data,
      cropDataValue: post.crop_data,
      postObject: post
    });

    try {
      // 1. Check if post has crop_data from database
      if (post.crop_data) {
        console.log('📊 Loading crop data from DATABASE for post:', post.id);
        console.log('📊 Crop coordinates:', {
          x: post.crop_data.x,
          y: post.crop_data.y,
          width: post.crop_data.width,
          height: post.crop_data.height,
          zoom: post.crop_data.zoom,
          imageWidth: post.crop_data.imageWidth,
          imageHeight: post.crop_data.imageHeight
        });
        setCropData(post.crop_data);

        // 2. Sync database crop data to localStorage (so all components have it)
        const savedCrops = JSON.parse(localStorage.getItem('imageCropSettings') || '{}');
        savedCrops[post.id] = post.crop_data;
        localStorage.setItem('imageCropSettings', JSON.stringify(savedCrops));
        console.log('✅ Synced database crop to localStorage for post:', post.id);
      } else {
        // 3. Fallback to localStorage if no database crop data
        console.log('⚠️ No crop_data in post object, checking localStorage for post:', post.id);
        const savedCrops = JSON.parse(localStorage.getItem('imageCropSettings') || '{}');
        if (savedCrops[post.id]) {
          console.log('📦 Loading crop data from localStorage for post:', post.id, savedCrops[post.id]);
          setCropData(savedCrops[post.id]);
        } else {
          console.log('❌ No crop data found anywhere for post:', post.id);
        }
      }
    } catch (error) {
      console.error('❌ Error loading crop settings:', error);
    }
  }, [post.id, post.crop_data]);

  // State for sub-image navigation
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Reorganize images: if a sub-image is featured, show it first instead of parent
  const [reorganizedImages, setReorganizedImages] = useState<any[]>([]);
  const [parentImageIndex, setParentImageIndex] = useState(0);

  // Sync localSubImages with prop changes and reorganize if needed
  useEffect(() => {
    setLocalSubImages(subImages);

    // Check if any sub-image is featured
    const featuredSubImage = subImages.find((img: any) => img.is_featured === 1 || img.is_featured === true);

    if (featuredSubImage) {
      // Featured sub-image found - put it first, then parent, then other sub-images
      const otherSubImages = subImages.filter((img: any) => img.id !== featuredSubImage.id);
      setReorganizedImages([featuredSubImage, { src: post.image, description: post.content, location: post.location, id: post.id, title: post.title, date: post.date, tags: post.tags || [] }, ...otherSubImages]);
      setParentImageIndex(1); // Parent is now at index 1
    } else {
      // No featured sub-image - parent comes first (default behavior)
      setReorganizedImages([{ src: post.image, description: post.content, location: post.location, id: post.id, title: post.title, date: post.date, tags: post.tags || [] }, ...subImages]);
      setParentImageIndex(0); // Parent is at index 0
    }
  }, [subImages, post.image, post.content, post.location, post.id]);

  const totalImages = 1 + localSubImages.length;

  // Get current image data based on reorganized array
  const currentImageData = reorganizedImages[currentImageIndex] || { src: post.image, description: post.content, location: post.location };

  // Sync currentContent with current image data when image changes or data updates
  useEffect(() => {
    const newContent = currentImageData?.description || post.content;
    setCurrentContent(newContent || "");
    setEditedDescription(newContent || "");
  }, [currentImageIndex, post.content, currentImageData, reorganizedImages]);

  // Navigation handlers
  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex(prev => (prev === 0 ? totalImages - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex(prev => (prev === totalImages - 1 ? 0 : prev + 1));
  };

  // Update content display when navigating through sub-images
  useEffect(() => {
    setCurrentContent(currentImageData?.description || post.content || "");
  }, [currentImageIndex, post.content, currentImageData, reorganizedImages]);

  // Get current image ID and details for editing
  const currentImageId = currentImageData?.id || post.id;
  const currentImageTitle = currentImageData?.title || post.title;
  const currentImageLocation = currentImageData?.location || post.location;
  const currentImageDate = currentImageData?.dateTaken || currentImageData?.date || post.date;

  const newDescriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [editData, setEditData] = useState({
    title: post.title,
    location: post.location,
    date: post.date,
    content: post.content || ""
  });

  // Get current logged-in user to check post ownership
  const currentUser = userUtils.getStoredUser();

  // Use external_user_id as the actual user ID (id field is admin_id)
  const currentUserId = currentUser?.external_user_id || currentUser?.id;

  // Check if current user is the post author
  const isPostAuthor = currentUser ? (
    (post.author.id && currentUserId && String(currentUserId) === String(post.author.id)) ||
    (post.author.email && currentUser.email && post.author.email === currentUser.email) ||
    (post.author.name && currentUser.name && post.author.name === currentUser.name)
  ) : false;

  // Check if current user is the memory owner
  const isMemoryOwner = currentUser && memoryOwnerId && String(currentUserId) === String(memoryOwnerId);

  // Check if current user is a collaborator with edit/admin permissions
  const currentUserCollaborator = activeCollaborators.find(collab =>
    (collab.userId && String(collab.userId) === String(currentUserId)) ||
    (collab.id && String(collab.id) === String(currentUserId)) ||
    (currentUser?.email && collab.email === currentUser.email)
  );
  const hasEditPermission = currentUserCollaborator?.role === 'edit' || currentUserCollaborator?.role === 'admin' || currentUserCollaborator?.role === 'contributor';

  // Check if user can add descriptions (memory owner OR collaborator with edit/admin/contributor role)
  const canAddDescription = isMemoryOwner || hasEditPermission;

  // Menu visibility logic:
  // - Memory owner sees menu on ALL posts (can edit and delete any post)
  // - Post author sees menu on their own posts (can edit and delete)
  // - Other users see menu on posts by others (to claim the moment)
  // Result: Menu shows on ALL posts for everyone
  const shouldShowMenu = true; // Always show menu - different options based on permissions
  const canEdit = isPostAuthor || isMemoryOwner; // Post author OR memory owner can edit
  const canDelete = isPostAuthor || isMemoryOwner; // Delete own posts OR memory owner can delete any

  // Check if post is already claimed - handle multiple data types
  const isAlreadyClaimed = (
    post.is_claim == 1 || // Use loose equality to match both 1 and "1"
    post.is_claim === true ||
    (post.claim_user_id !== null && post.claim_user_id !== undefined && post.claim_user_id !== '')
  );

  // Debug logging for claim status
  console.log(`🔍 Post ${post.id} claim status:`, {
    is_claim: post.is_claim,
    claim_user_id: post.claim_user_id,
    isAlreadyClaimed,
    'is_claim == 1': post.is_claim == 1,
    'is_claim === 1': post.is_claim === 1,
    'typeof is_claim': typeof post.is_claim
  });

  // Auto-resize textarea when newDescription changes
  const handleTextareaResize = useCallback(() => {
    if (newDescriptionTextareaRef.current) {
      const textarea = newDescriptionTextareaRef.current;
      // Reset height to 0 to get accurate scrollHeight
      textarea.style.height = '0px';
      // Set height to scrollHeight to show all content
      const newHeight = Math.max(80, textarea.scrollHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (isAddingDescription) {
      // Force resize when content changes or dialog opens
      // Use multiple attempts for mobile compatibility
      const resizeAttempts = [0, 16, 50, 100, 200, 300];
      resizeAttempts.forEach(delay => {
        setTimeout(() => {
          handleTextareaResize();
        }, delay);
      });
    }
  }, [newDescription, isAddingDescription, handleTextareaResize]);

  // Auto-resize edit description textarea
  const handleEditTextareaResize = useCallback(() => {
    if (editDescriptionTextareaRef.current) {
      const textarea = editDescriptionTextareaRef.current;
      // Reset height to 0 to get accurate scrollHeight
      textarea.style.height = '0px';
      // Set height to scrollHeight to show all content
      const newHeight = Math.max(80, textarea.scrollHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (isEditingDescription) {
      const resizeAttempts = [0, 16, 50, 100, 200, 300];
      resizeAttempts.forEach(delay => {
        setTimeout(() => {
          handleEditTextareaResize();
        }, delay);
      });
    }
  }, [editedDescription, isEditingDescription, handleEditTextareaResize]);

  // Handle @ mention trigger
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;

    setNewDescription(value);
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

    handleTextareaResize();
  };

  // Handle mention selection
  const handleMentionSelect = (collaborator: Collaborator) => {
    const textBeforeCursor = newDescription.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const before = newDescription.substring(0, lastAtIndex);
      const after = newDescription.substring(cursorPosition);
      const newValue = `${before}@${collaborator.name} ${after}`;

      setNewDescription(newValue);
      setShowMentionDropdown(false);
      setMentionSearch('');

      // Set cursor position after the mention
      setTimeout(() => {
        if (newDescriptionTextareaRef.current) {
          const newCursorPos = lastAtIndex + collaborator.name.length + 2;
          newDescriptionTextareaRef.current.focus();
          newDescriptionTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  // Handle edit description change with mentions
  const handleEditDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;

    setEditedDescription(value);
    setEditCursorPosition(cursorPos);

    // Check if user typed @
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1 && lastAtIndex === cursorPos - 1) {
      // Just typed @
      setShowEditMentionDropdown(true);
      setEditMentionSearch('');
    } else if (lastAtIndex !== -1 && cursorPos > lastAtIndex) {
      // Typing after @
      const searchText = textBeforeCursor.substring(lastAtIndex + 1);
      // Allow spaces in names - check if we hit a newline or another @ instead
      if (!searchText.includes('\n') && !searchText.includes('@')) {
        setShowEditMentionDropdown(true);
        setEditMentionSearch(searchText);
      } else {
        setShowEditMentionDropdown(false);
      }
    } else {
      setShowEditMentionDropdown(false);
    }

    handleEditTextareaResize();
  };

  // Handle edit mention selection
  const handleEditMentionSelect = (collaborator: Collaborator) => {
    const textBeforeCursor = editedDescription.substring(0, editCursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const before = editedDescription.substring(0, lastAtIndex);
      const after = editedDescription.substring(editCursorPosition);
      const newValue = `${before}@${collaborator.name} ${after}`;

      setEditedDescription(newValue);
      setShowEditMentionDropdown(false);
      setEditMentionSearch('');

      // Set cursor position after the mention
      setTimeout(() => {
        if (editDescriptionTextareaRef.current) {
          const newCursorPos = lastAtIndex + collaborator.name.length + 2;
          editDescriptionTextareaRef.current.focus();
          editDescriptionTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  // Filter collaborators based on search
  const filteredCollaborators = activeCollaborators.filter(collab =>
    collab.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    collab.email.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Filter collaborators for edit description
  const filteredEditCollaborators = activeCollaborators.filter(collab =>
    collab.name.toLowerCase().includes(editMentionSearch.toLowerCase()) ||
    collab.email.toLowerCase().includes(editMentionSearch.toLowerCase())
  );

  // Function to check if description has content beyond just mentions
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

  // Function to render description with highlighted mentions
  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query || !text) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase()
            ? <mark key={i} style={{ background: '#FDE047', color: 'inherit', borderRadius: '2px', padding: '0 1px' }}>{part}</mark>
            : part
        )}
      </>
    );
  };

  const renderDescriptionWithMentions = (text: string) => {
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

                  {/* Connect section */}
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">Connect</p>

                    {/* Email and Social media icons inline */}
                    <div className="flex gap-3 items-center">
                      {/* Email display */}
                      {collaborator.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-gray-500" />
                          <a
                            href={`mailto:${collaborator.email}`}
                            className="text-gray-700 hover:text-[#6C60FF] hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {collaborator.email}
                          </a>
                        </div>
                      )}

                      {/* LinkedIn Icon */}
                      <Button
                        size="sm"
                        variant="outline"
                        className={`w-8 h-8 p-0 border-gray-300 ${
                          collaborator.linkedin_url
                            ? 'text-blue-700 hover:bg-blue-50 hover:border-blue-300'
                            : 'text-gray-400 cursor-not-allowed opacity-50'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (collaborator.linkedin_url) {
                            window.open(collaborator.linkedin_url, '_blank');
                          }
                        }}
                        disabled={!collaborator.linkedin_url}
                      >
                        <Linkedin className="w-3.5 h-3.5" />
                      </Button>

                      {/* Facebook Icon */}
                      <Button
                        size="sm"
                        variant="outline"
                        className={`w-8 h-8 p-0 border-gray-300 ${
                          collaborator.facebook_url
                            ? 'text-blue-600 hover:bg-blue-50 hover:border-blue-300'
                            : 'text-gray-400 cursor-not-allowed opacity-50'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (collaborator.facebook_url) {
                            window.open(collaborator.facebook_url, '_blank');
                          }
                        }}
                        disabled={!collaborator.facebook_url}
                      >
                        <Facebook className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          );
      }

      // Regular text (not a mention)
      return <span key={index}>{part.text}</span>;
    });
  };

  // Handle image load to determine orientation and dimensions
  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.target as HTMLImageElement;
    const aspectRatio = img.naturalWidth / img.naturalHeight;

    if (aspectRatio > 1.1) {
      setImageOrientation('landscape');
    } else if (aspectRatio < 0.9) {
      setImageOrientation('portrait');
    } else {
      setImageOrientation('square');
    }

    // Set dimensions
    setImageDimensions(`${img.naturalWidth}×${img.naturalHeight}`);
    console.log('📸 Image loaded with dimensions:', `${img.naturalWidth}×${img.naturalHeight}`);
  }, []);

  const handleAddDescription = async () => {
    if (newDescription.trim()) {
      try {
        setIsAddingDescriptionLoading(true);
        console.log('Adding description to post:', post.id, newDescription);

        console.log('🔍 handleAddDescription - Start');
        console.log('📝 Description text:', newDescription);
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
          while ((match = mentionPattern.exec(newDescription)) !== null) {
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

        const response = await dashboardAPI.addPostDescription(
          currentImageId,
          newDescription,
          mentionedEmails.length > 0 ? mentionedEmails : undefined,
          mentionedPhones.length > 0 ? mentionedPhones : undefined
        );

        if (response.success) {
          toast.success("Description added successfully!");
          setIsAddingDescription(false);
          setNewDescription("");
          setHasAISuggestion(false);

          // Call onRefresh to reload memory data without full page refresh
          if (onRefresh) {
            onRefresh();
          }
        } else {
          toast.error(response.error || "Failed to add description");
        }
      } catch (error) {
        console.error('Error adding description:', error);
        toast.error("Failed to add description");
      } finally {
        setIsAddingDescriptionLoading(false);
      }
    }
  };

  const handleEditSave = () => {
    // In a real app, this would update the post via API
    console.log('Saving edit:', editData);
    setIsEditPopoverOpen(false);
    // You would update the post data here
  };

  const handleEditCancel = () => {
    // Reset edit data to original values
    setEditData({
      title: post.title,
      location: post.location,
      date: post.date,
      content: post.content || ""
    });
    setIsEditPopoverOpen(false);
  };

  const handleAISuggest = async () => {
    if (!post.image || isAISuggesting) return;

    // Check credits before opening tone modal
    try {
      const creditCheck = await aiCreditsAPI.checkSufficientCredits('ai_captions', 1);
      console.log('Credit check response:', creditCheck);

      if (creditCheck && creditCheck.has_sufficient_credits) {
        // Open tone selection modal
        setIsToneModalOpen(true);
      } else {
        const available = creditCheck?.total_available ?? 0;
        if (onInsufficientCredits) {
          onInsufficientCredits(available);
        }
      }
    } catch (error) {
      console.error('Error checking credits:', error);
      // On error, still allow opening the modal (fallback behavior)
      setIsToneModalOpen(true);
    }
  };

  const handleToneSelect = async (tone: string) => {
    if (!post.image) return;

    setSelectedTone(tone); // Save the selected tone
    setIsAISuggesting(true);

    try {
      console.log('Getting AI suggestion for image:', post.image, 'with tone:', tone, 'and memory_id:', post.memoryId);
      // Pass the selected tone and memory_id to the API call
      const response = await dashboardAPI.getSuggestedDescription(post.image, tone, post.memoryId);

      if (response.success && response.data?.description) {
        setNewDescription(response.data.description);
        setIsAddingDescription(true);
        setHasAISuggestion(true);
        toast.success("AI suggestion generated!");
        recheckMemoryLimit();
      } else {
        toast.error(response.error || "Failed to get AI suggestion");
      }
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
      toast.error("Failed to get AI suggestion");
    } finally {
      setIsAISuggesting(false);
    }
  };

  // Handle retrying AI suggestion with no_credit = 0
  const handleRetryAISuggestion = async () => {
    if (!post.image || isRetryingAI) return;

    setIsRetryingAI(true);

    try {
      console.log('Retrying AI suggestion with no_credit=0, tone:', selectedTone, 'and memory_id:', post.memoryId);
      // Call API with no_credit = true (sends no_credit: 0 in payload)
      const response = await dashboardAPI.getSuggestedDescription(post.image, selectedTone, post.memoryId, true);

      if (response.success && response.data?.description) {
        setNewDescription(response.data.description);
        setHasAISuggestion(true);
        toast.success("New AI suggestion generated!");
        recheckMemoryLimit();
      } else {
        toast.error(response.error || "Failed to retry AI suggestion");
      }
    } catch (error) {
      console.error('Error retrying AI suggestion:', error);
      toast.error("Failed to retry AI suggestion");
    } finally {
      setIsRetryingAI(false);
    }
  };

  const handleEditDescription = () => {
    setEditedDescription(currentContent || "");
    setIsEditingDescription(true);
    setIsTimelineMenuOpen(false);
  };

  const handleSaveEditedDescription = async () => {
    if (editedDescription.trim()) {
      setIsEditingDescriptionLoading(true);
      try {
        console.log('Editing description for post:', post.id, editedDescription);

        console.log('🔍 handleSaveEditedDescription - Start');
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
          currentImageId,
          editedDescription,
          mentionedEmails.length > 0 ? mentionedEmails : undefined,
          mentionedPhones.length > 0 ? mentionedPhones : undefined
        );

        if (response.success) {
          toast.success("Description updated successfully!");
          setIsEditingDescription(false);

          // Call onRefresh to reload memory data without full page refresh
          if (onRefresh) {
            onRefresh();
          }
        } else {
          toast.error(response.error || "Failed to update description");
        }
      } catch (error) {
        console.error('Error editing description:', error);
        toast.error("Failed to update description");
      } finally {
        setIsEditingDescriptionLoading(false);
      }
    }
  };

  // Toggle + persist caption visibility. Optimistic local update for instant feedback,
  // then save to the backend and refresh so the left timeline reflects it too.
  const handleToggleCaptionHidden = async () => {
    const newHidden = !isCaptionHidden;
    setIsCaptionHidden(newHidden);
    setIsTimelineMenuOpen(false);
    try {
      const response = await dashboardAPI.setCaptionHidden(currentImageId, newHidden);
      if (response.success) {
        if (onRefresh) onRefresh();
      } else {
        setIsCaptionHidden(!newHidden); // revert on failure
        toast.error(response.error || "Failed to update caption visibility");
      }
    } catch (error) {
      console.error('Error toggling caption visibility:', error);
      setIsCaptionHidden(!newHidden); // revert on failure
      toast.error("Failed to update caption visibility");
    }
  };

  const handleDeleteDescription = async () => {
    try {
      console.log('Deleting description for post:', currentImageId);

      const response = await dashboardAPI.deletePostDescription(currentImageId);

      if (response.success) {
        toast.success("Description deleted successfully!");
        setIsTimelineMenuOpen(false);

        // Call onRefresh to reload memory data without full page refresh
        if (onRefresh) {
          onRefresh();
        }
      } else {
        toast.error(response.error || "Failed to delete description");
      }
    } catch (error) {
      console.error('Error deleting description:', error);
      toast.error("Failed to delete description");
    }
  };

  const handleDeletePost = async () => {
    try {
      console.log('Deleting post:', post.id);

      const response = await dashboardAPI.deletePost(post.id);

      if (response.success) {
        toast.success("Post deleted successfully!");
        setIsTimelineMenuOpen(false);

        // Notify parent component to remove this post
        if (onPostDelete) {
          onPostDelete(post.id);
        }
      } else {
        toast.error(response.error || "Failed to delete post");
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error("Failed to delete post");
    }
  };

  const handleClaimMoment = async () => {
    // Show loading toast
    const toastId = toast.loading("Processing Claim Request...");

    try {
      console.log('Claiming moment:', post.id);
      setIsTimelineMenuOpen(false);

      // Call API endpoint
      const response = await dashboardAPI.claimPostRequest(post.id);

      console.log('Claim request API response:', response);

      if (response.success) {
        // Show the actual message from API - update the loading toast
        const message = response.message || response.data?.message || "Ownership request sent successfully!";
        toast.success(message, { id: toastId });
      } else {
        // Show the actual error message from API - update the loading toast
        const errorMessage = response.error || response.message || response.data?.message || "Failed to send claim request";
        toast.error(errorMessage, { id: toastId });
      }
    } catch (error) {
      console.error('Error claiming moment:', error);
      toast.error("Failed to send claim request", { id: toastId });
    }
  };

  return (
    <div className={`bg-white border border-gray-100 hover:border-gray-200 transition-all duration-200 hover:shadow-sm overflow-hidden group cursor-pointer ${
      variant === 'card'
        ? 'rounded-[14px] md:rounded-xl lg:rounded-2xl hover:shadow-md w-full lg:max-w-lg lg:mx-auto' // Timeline view: 14px on mobile, rounded-xl md, rounded-2xl lg
        : 'rounded-xl lg:rounded-2xl' // Thumbnail view: Keep original styling
    }`}>
      {/* Media First */}
      {post.image && (
        <div
          className={`relative overflow-hidden bg-gray-50 cursor-pointer ${imageOrientation === 'portrait' ? 'aspect-square' : 'aspect-[4/3]'} group/image`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onImageClick) {
              onImageClick(
                currentImageData?.src || post.image || '',
                'Post content',
                post.title,
                `${post.author.name} • ${post.date}`,
                post.id
              );
            }
          }}
        >
          {cropData && cropData.imageWidth && cropData.imageHeight ? (
            // Precise crop display - show only the cropped area
            <div
              className="w-full h-full overflow-hidden"
              style={{
                transform: `rotate(${post.rotation_angle || 0}deg)`,
                transition: 'transform 0.3s ease',
              }}
            >
              <ImageWithFallback
                src={currentImageData?.src || post.image}
                alt="Post content"
                onLoad={(e) => {
                  handleImageLoad(e);
                  console.log('🎨 CROP APPLIED for post:', post.id, {
                    cropData,
                    calculatedStyles: {
                      width: `${(cropData.imageWidth / cropData.width) * 100}%`,
                      height: `${(cropData.imageHeight / cropData.height) * 100}%`,
                      left: `${-(cropData.x / cropData.width) * 100}%`,
                      top: `${-(cropData.y / cropData.height) * 100}%`,
                    }
                  });
                }}
                style={{
                  position: 'absolute',
                  // Scale image so the crop area fills the container
                  width: `${(cropData.imageWidth / cropData.width) * 100}%`,
                  height: `${(cropData.imageHeight / cropData.height) * 100}%`,
                  // Position image so crop area is centered
                  left: `${-(cropData.x / cropData.width) * 100}%`,
                  top: `${-(cropData.y / cropData.height) * 100}%`,
                  maxWidth: 'none',
                  transition: 'transform 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                className="object-cover"
              />
            </div>
          ) : (
            <ImageWithFallback
              src={currentImageData?.src || post.image}
              alt="Post content"
              onLoad={handleImageLoad}
              style={{
                transform: `rotate(${post.rotation_angle || 0}deg)`,
                transition: 'transform 0.3s ease',
              }}
              // onMouseEnter={(e) => {
              //   e.currentTarget.style.transform = `rotate(${post.rotation_angle || 0}deg) scale(1.02)`;
              // }}
              // onMouseLeave={(e) => {
              //   e.currentTarget.style.transform = `rotate(${post.rotation_angle || 0}deg) scale(1)`;
              // }}
              className="w-full h-full object-cover"
            />
          )}
          {/* Add Media button — shown only on no-image placeholder moments */}
          {isNoImagePlaceholder && onUpdateItem && (
            <label
              htmlFor={`add-media-${post.id}`}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
            >
              <input
                id={`add-media-${post.id}`}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAddMedia}
                disabled={isUploadingMedia}
              />
              {isUploadingMedia ? (
                <div className="bg-white border border-gray-300 rounded-xl px-6 py-2.5 flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-gray-500">Uploading...</span>
                </div>
              ) : (
                <div className="bg-[#9CA3AF] hover:bg-[#8fa0b0] rounded-full px-8 py-3 transition-colors flex items-center gap-2">
                  <span className="text-[16px] font-semibold text-white flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 1V15M1 8H15" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                    Add Media
                  </span>
                </div>
              )}
            </label>
          )}

          {/* Navigation arrows for sub-images */}
          {totalImages > 1 && (
            <>
              {/* Left arrow - Always visible on mobile, hover on desktop */}
              <button
                onClick={handlePrevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white p-2 rounded-full md:opacity-0 md:group-hover/image:opacity-100 transition-all duration-200 z-0 md:z-10"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Right arrow - Always visible on mobile, hover on desktop */}
              <button
                onClick={handleNextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white p-2 rounded-full md:opacity-0 md:group-hover/image:opacity-100 transition-all duration-200 z-0 md:z-10"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Image counter - Visible on both mobile and desktop */}
              <div className="absolute top-2 right-2 bg-black/80 text-white text-xs md:text-xs font-medium px-2.5 py-1.5 md:px-2 md:py-1 rounded shadow-lg z-0 md:z-20">
                {currentImageIndex + 1} / {totalImages}
              </div>
            </>
          )}

          {/* Sub-image count badge (bottom right) */}
          {subImageCount > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none"/>
                <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>{subImageCount}</span>
            </div>
          )}

          {/* Tags overlay - top left */}
          {(() => {
            const tags = Array.isArray(post.tags)
              ? post.tags.map((t) => typeof t === 'string' ? t : t?.name).filter(Boolean)
              : [];
            if (tags.length === 0) return null;
            return (
              <div className="absolute top-2 left-2 flex items-center gap-1 flex-wrap z-10" style={{ maxWidth: 'calc(100% - 16px)' }}>
                {tags.slice(0, 2).map((tag: string) => (
                  <span key={tag} className="inline-flex items-center px-3.5 py-2 rounded-xl bg-gray-100 text-gray-900 text-[12px] font-medium leading-none shadow-md border border-gray-200">
                    {searchHighlight ? highlightText(tag, searchHighlight) : tag}
                  </span>
                ))}
                {tags.length > 2 && (
                  <span className="inline-flex items-center px-3.5 py-2 rounded-xl bg-gray-100 text-gray-900 text-[12px] font-medium leading-none shadow-md border border-gray-200">
                    +{tags.length - 2}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Content Section */}
      <div className={`${
        variant === 'card'
          ? 'space-y-3 p-[22px] lg:p-6' // Timeline view: 22px on mobile (matches SVG), lg:p-6
          : 'space-y-2 p-4' // Thumbnail view: Original padding
      }`}>
        {/* User Info */}
        <div className="flex items-center gap-3">
          <Avatar className="h-[30px] w-[30px]">
            <AvatarImage src={post.author.avatar} className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-[#6C60FF] to-purple-600 text-white text-sm">
              {post.author.name.split(' ').map((n: string) => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className={`font-medium truncate ${variant === 'card' ? 'text-[#364153] text-lg md:text-base' : 'text-sm text-gray-900'}`}>{post.author.name}</p>
          </div>
          
          {/* Conditional: More button for thumbnail, Interaction icons + menu for card */}
          {variant === 'card' ? (
            // Heart, Comment, Share icons + three-dot menu for Timeline View
            <div className="flex items-center gap-3">
              {/* Heart Icon + Like Count */}
              <div
                className="flex items-center gap-1 text-[15px] md:text-sm text-gray-600 cursor-pointer hover:text-red-500 transition-colors"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  const newIsLiked = !isLiked;
                  const newLikesCount = newIsLiked ? likesCount + 1 : likesCount - 1;

                  // Optimistic update
                  setIsLiked(newIsLiked);
                  setLikesCount(newLikesCount);

                  try {
                    // Call API to toggle like
                    const response = await dashboardAPI.post('/memory-images/toggle-like', {
                      post_id: post.id,
                      is_like: newIsLiked ? 1 : 0
                    });

                    console.log('Like API Response:', response);

                    // The response structure is: { success, message, data: { post_id, likes_count, is_like } }
                    // dashboardAPI returns the response directly (not response.data)
                    if (response.success === true) {
                      // Update with actual count from server
                      setLikesCount(response.data.likes_count);
                      toast.success(newIsLiked ? "Liked!" : "Unliked!");
                    } else {
                      console.error('API returned success=false');
                      // Revert on failure
                      setIsLiked(!newIsLiked);
                      setLikesCount(likesCount);
                      toast.error(response.message || "Failed to update like");
                    }
                  } catch (error: any) {
                    console.error('Error toggling like:', error);
                    // Revert on error
                    setIsLiked(!newIsLiked);
                    setLikesCount(likesCount);
                    toast.error("Failed to update like. Please try again.");
                  }
                }}
              >
                <Heart
                  className={`h-5 w-5 md:h-4 md:w-4 flex-shrink-0 ${isLiked ? 'fill-red-500 text-red-500' : ''}`}
                />
                <span className={isLiked ? 'text-red-500 font-medium' : ''}>{likesCount}</span>
              </div>

              {/* Comment Icon + Count */}
              <div
                className="flex items-center gap-1 text-[15px] md:text-sm text-gray-600 cursor-pointer hover:text-[#6C60FF] transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onImageClick) {
                    onImageClick(
                      post.image || '',
                      'Post content',
                      post.title,
                      `${post.author.name} • ${post.date}`,
                      post.id,
                      true // focusComments - scroll to comments on mobile
                    );
                  }
                }}
              >
                <MessageSquare className="h-5 w-5 md:h-4 md:w-4 flex-shrink-0" />
                <span>{post.comments}</span>
              </div>

              {/* Share Icon + Count with Popover - hidden on mobile (not in mobile SVG design) */}
              <div className="hidden md:block">
              <Popover open={isSharePopoverOpen} onOpenChange={setIsSharePopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer hover:text-[#6C60FF] transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <Share2 className="h-4 w-4 flex-shrink-0" />
                    <span>{sharesCount}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2 bg-white border border-gray-200 shadow-lg" align="start" side="bottom">
                  <div className="flex flex-col gap-1">
                      {/* Facebook Share */}
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded transition-colors text-left"
                        onClick={async (e) => {
                          e.stopPropagation();

                          const postTitle = post.title || post.name || 'Check out this memory';
                          const postDescription = currentContent || post.content || '';
                          const postLocation = post.location || '';
                          const postDate = post.date || post.dateTaken || '';
                          const authorName = post.author?.name || '';
                          const imageUrl = post.image || '';

                          // Create post-specific URL - use published memory slug if memory is published
                          console.log('🔗 Share - memoryId:', memoryId, 'memorySlug:', memorySlug, 'memoryPublished:', memoryPublished, 'postId:', post.id);
                          const postLink = (memoryPublished === 1 || memoryPublished === 2) && memorySlug
                            ? `${window.location.origin}/published-memory/${memorySlug}?post_id=${post.id}`
                            : memoryId
                              ? `${window.location.origin}/stories?memory_id=${memoryId}&post_id=${post.id}`
                              : `${window.location.origin}/stories?post_id=${post.id}`;

                          console.log('🔗 Generated post link:', postLink);
                          const shareText = `${postTitle}${postDescription ? `\n\n${postDescription}` : ''}${postLocation ? `\n\n📍 ${postLocation}` : ''}${postDate ? `\n📅 ${postDate}` : ''}${authorName ? `\n✍️ By ${authorName}` : ''}\n\n🔗 View Post: ${postLink}`;

                          try {
                            console.log('📘 Facebook share started:', { postTitle, imageUrl, postLink });

                            // Copy share text to clipboard
                            await navigator.clipboard.writeText(shareText);
                            console.log('✅ Share text copied to clipboard');

                            // Download image - use direct link approach to bypass CORS
                            if (imageUrl) {
                              try {
                                const a = document.createElement('a');
                                a.href = imageUrl;
                                a.download = `${postTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpg`;
                                a.target = '_blank';
                                a.rel = 'noopener noreferrer';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                console.log('✅ Image download triggered');
                              } catch (imgError) {
                                console.error('❌ Image download failed:', imgError);
                                // Continue even if image download fails
                              }
                            } else {
                              console.warn('⚠️ No image URL available for download');
                            }

                            toast.success("Ready to share on Facebook!", {
                              description: "Image download started & caption copied. Upload the image and paste the caption."
                            });

                            setTimeout(() => {
                              // Open Facebook share dialog with post link for preview
                              const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postLink)}`;
                              window.open(facebookShareUrl, 'facebook-share-dialog', 'width=800,height=600');
                              console.log('✅ Facebook share dialog opened with link:', postLink);
                            }, 1000);

                            // Increment share count via API
                            await handleIncrementShareCount();
                            console.log('✅ Share count incremented');
                          } catch (error) {
                            console.error('❌ Facebook share failed:', error);
                            toast.error("Failed to prepare share", {
                              description: error instanceof Error ? error.message : "Please try again"
                            });
                          }

                          setIsSharePopoverOpen(false);
                        }}
                      >
                        <Facebook className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="text-sm text-gray-900">Facebook</span>
                      </button>

                      {/* Twitter/X Share */}
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded transition-colors text-left"
                        onClick={async (e) => {
                          e.stopPropagation();

                          const postTitle = post.title || post.name || 'Check out this memory';
                          const postDescription = currentContent || post.content || '';
                          const postLocation = post.location || (typeof currentImageLocation === 'string' ? currentImageLocation : currentImageLocation?.displayName) || '';
                          const imageUrl = post.image || currentImageData?.src || '';

                          // Create post-specific URL - use published memory slug if memory is published
                          const postLink = (memoryPublished === 1 || memoryPublished === 2) && memorySlug
                            ? `${window.location.origin}/published-memory/${memorySlug}?post_id=${post.id}`
                            : memoryId
                              ? `${window.location.origin}/stories?memory_id=${memoryId}&post_id=${post.id}`
                              : `${window.location.origin}/stories?post_id=${post.id}`;

                          // Twitter has character limit, keep it concise
                          const shareText = `${postTitle}${postDescription ? `\n\n${postDescription.substring(0, 150)}${postDescription.length > 150 ? '...' : ''}` : ''}${postLocation ? `\n📍 ${postLocation}` : ''}\n\n🔗 ${postLink}`;

                          try {
                            await navigator.clipboard.writeText(shareText);

                            // Download image - use direct link approach to bypass CORS
                            if (imageUrl) {
                              const a = document.createElement('a');
                              a.href = imageUrl;
                              a.download = `${postTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpg`;
                              a.target = '_blank';
                              a.rel = 'noopener noreferrer';
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }

                            toast.success("Ready to share on X!", {
                              description: "Image download started & tweet text copied. Upload the image and paste the text."
                            });

                            setTimeout(() => {
                              window.open('https://twitter.com/compose/tweet', '_blank');
                            }, 1000);

                            // Increment share count via API
                            await handleIncrementShareCount();
                          } catch (error) {
                            toast.error("Failed to prepare share");
                          }

                          setIsSharePopoverOpen(false);
                        }}
                      >
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span className="text-sm text-gray-900">X (Twitter)</span>
                      </button>

                      {/* LinkedIn Share */}
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded transition-colors text-left"
                        onClick={async (e) => {
                          e.stopPropagation();

                          // Prepare post data
                          const postTitle = post.title || post.name || 'Check out this memory';
                          const postDescription = currentContent || post.content || '';
                          const postLocation = post.location || (typeof currentImageLocation === 'string' ? currentImageLocation : currentImageLocation?.displayName) || '';
                          const postDate = post.date || post.dateTaken || '';
                          const authorName = post.author?.name || '';

                          // Create post-specific URL - use published memory slug if memory is published
                          const postLink = (memoryPublished === 1 || memoryPublished === 2) && memorySlug
                            ? `${window.location.origin}/published-memory/${memorySlug}?post_id=${post.id}`
                            : memoryId
                              ? `${window.location.origin}/stories?memory_id=${memoryId}&post_id=${post.id}`
                              : `${window.location.origin}/stories?post_id=${post.id}`;

                          // Create professional LinkedIn share text with proper formatting
                          let shareText = `✨ ${postTitle}\n\n`;

                          if (postDescription) {
                            // Limit description to 200 characters for better readability
                            const description = postDescription.length > 200
                              ? postDescription.substring(0, 200) + '...'
                              : postDescription;
                            shareText += `${description}\n\n`;
                          }

                          if (postLocation) {
                            shareText += `📍 ${postLocation}\n`;
                          }

                          if (postDate) {
                            shareText += `📅 ${postDate}\n`;
                          }

                          if (authorName) {
                            shareText += `\n👤 By: ${authorName}\n`;
                          }

                          shareText += `\n🔗 View full post:\n${postLink}`;

                          try {
                            // Check if this is a localhost URL
                            const isLocalhost = postLink.includes('localhost') ||
                                              postLink.includes('127.0.0.1') ||
                                              postLink.includes('192.168.');

                            // Use LinkedIn's share URL with text parameter
                            // LinkedIn will fetch Open Graph tags from the post link
                            const linkedInUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(shareText)}`;

                            window.open(linkedInUrl, '_blank');

                            if (isLocalhost) {
                              toast.warning("Sharing from localhost", {
                                description: "LinkedIn cannot preview localhost URLs. The post content is ready, but deploy to production to see the preview card with image.",
                                duration: 6000
                              });
                            } else {
                              toast.success("Opening LinkedIn!", {
                                description: "Post content and links are ready. LinkedIn will preview the image automatically."
                              });
                            }

                            // Increment share count via API
                            await handleIncrementShareCount();
                          } catch (error) {
                            console.error('Error sharing to LinkedIn:', error);
                            toast.error("Failed to open LinkedIn", {
                              description: "Please try again"
                            });
                          }

                          setIsSharePopoverOpen(false);
                        }}
                      >
                        <Linkedin className="w-4 h-4 text-blue-700 flex-shrink-0" />
                        <span className="text-sm text-gray-900">LinkedIn</span>
                      </button>
                  </div>
                </PopoverContent>
              </Popover>
              </div>{/* end hidden md:block share wrapper */}

              {/* Three-dot menu for timeline - on mobile only show when user can edit/delete */}
              {shouldShowMenu && (
              <div className={!canEdit && !canDelete ? 'hidden md:block' : ''}>

                <Popover open={isTimelineMenuOpen} onOpenChange={setIsTimelineMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-gray-100 rounded-full transition-all duration-200">
                      <MoreVertical className="h-4 w-4 text-gray-500" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2 bg-white border border-gray-200 shadow-lg" align="end">
                    <div className="flex flex-col gap-1">
                      {/* Claim Moment - show on ALL posts uploaded by OTHER people (in both own and shared memories) */}
                      {!isPostAuthor && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClaimMoment}
                            disabled={isAlreadyClaimed}
                            className={`justify-start text-sm h-auto py-2 px-2 ${
                              isAlreadyClaimed
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-gray-100'
                            } bg-white`}
                          >
                            <UserCheck className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                            <div className="flex flex-col items-start">
                              <span className="font-medium">
                                {isAlreadyClaimed ? 'Already Claimed' : 'Claim Moment'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {isAlreadyClaimed ? 'Ownership requested' : 'Request ownership'}
                              </span>
                            </div>
                          </Button>
                          {/* Only show separator if there are more menu items below */}
                          {(currentContent || canEdit || canDelete) && (
                            <div className="border-t border-gray-200 my-1"></div>
                          )}
                        </>
                      )}

                      {/* Description actions - only show if there's content */}
                      {currentContent && (
                        <>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleEditDescription}
                              className="justify-start text-sm h-8 px-2 hover:bg-gray-100 bg-white"
                            >
                              <Edit className="h-3.5 w-3.5 mr-2" />
                              Edit Caption
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleCaptionHidden()}
                              className="justify-start text-sm h-8 px-2 hover:bg-gray-100 bg-white"
                            >
                              <Eye className="h-3.5 w-3.5 mr-2" />
                              {isCaptionHidden ? 'Show Caption' : 'Hide Caption'}
                            </Button>
                          )}
                          {/* Delete Caption - only the uploader (post author) can delete their own caption */}
                          {isPostAuthor && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleDeleteDescription}
                              className="justify-start text-sm h-8 px-2 hover:bg-red-50 hover:text-red-600 bg-white"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Delete Caption
                            </Button>
                          )}
                          {/* Separator */}
                          <div className="border-t border-gray-200 my-1"></div>
                        </>
                      )}

                      {/* Edit Moment - always show if user has permission */}
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            console.log('📸 Post data for edit modal:', post);
                            console.log('📸 Size:', (post as any).size, (post as any).file_size);
                            console.log('📸 Dimensions:', (post as any).dimensions, (post as any).resolution);
                            console.log('📸 onUpdateItem prop exists?', !!onUpdateItem);
                            console.log('📸 onUpdateItem function:', onUpdateItem);
                            setIsEditMomentOpen(true);
                            setIsTimelineMenuOpen(false);
                          }}
                          className="justify-start text-sm h-8 px-2 hover:bg-gray-100 bg-white"
                        >
                          <Edit className="h-3.5 w-3.5 mr-2" />
                          Edit Moment
                        </Button>
                      )}

                      {/* Move up / Move down */}
                      {(onMoveUp || onMoveDown) && (
                        <div className="border-t border-gray-200 my-1"></div>
                      )}
                      {onMoveUp && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { onMoveUp(); setIsTimelineMenuOpen(false); }}
                          className="justify-start text-sm h-8 px-2 hover:bg-gray-100 bg-white font-semibold"
                        >
                          <ChevronLeft className="h-3.5 w-3.5 mr-2 rotate-90 text-[#6C60FF]" strokeWidth={3} />
                          Move up
                        </Button>
                      )}
                      {onMoveDown && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { onMoveDown(); setIsTimelineMenuOpen(false); }}
                          className="justify-start text-sm h-8 px-2 hover:bg-gray-100 bg-white font-semibold"
                        >
                          <ChevronRight className="h-3.5 w-3.5 mr-2 rotate-90 text-[#6C60FF]" strokeWidth={3} />
                          Move down
                        </Button>
                      )}

                      {/* Delete Moment - always show if user has permission */}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDeletePost}
                          className="justify-start text-sm h-8 px-2 hover:bg-red-50 hover:text-red-600 bg-white"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete Moment
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              )}
            </div>
          ) : (
            // More button for thumbnail view - only show for posts authored by current user
            canEdit && (
              <Popover open={isEditPopoverOpen} onOpenChange={setIsEditPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 bg-gray-50/50 hover:bg-gray-100 hover:scale-105 rounded-full transition-all duration-200">
                    <MoreHorizontal className="h-3 w-3 text-gray-500 hover:text-gray-700 transition-colors duration-200" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm text-gray-900">Edit Post</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEditCancel}
                        className="h-6 w-6 p-0 hover:bg-gray-100 rounded-full"
                      >
                        <X className="h-3 w-3 text-gray-400" />
                      </Button>
                    </div>

                    {/* Edit Form */}
                    <div className="space-y-3">
                      {/* Title */}
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Title
                        </label>
                        <Input
                          value={editData.title}
                          onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Enter post title..."
                          className="text-sm"
                        />
                      </div>

                      {/* Location */}
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Location
                        </label>
                        <GooglePlacesInput
                          value={editData.location}
                          onChange={(value) => setEditData(prev => ({ ...prev, location: value }))}
                          placeholder="Enter location..."
                          className="text-sm"
                          onPlaceSelect={(place) => {
                            console.log('Selected place in PostCard:', place);
                            // You can add additional logic here when a place is selected
                          }}
                        />
                      </div>

                      {/* Date */}
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Date
                        </label>
                        <Input
                          value={editData.date}
                          onChange={(e) => setEditData(prev => ({ ...prev, date: e.target.value }))}
                          placeholder="Enter date..."
                          className="text-sm"
                        />
                      </div>

                      {/* Content */}
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Content
                        </label>
                        <Textarea
                          value={editData.content}
                          onChange={(e) => setEditData(prev => ({ ...prev, content: e.target.value }))}
                          placeholder="Add a description for this memory..."
                          rows={3}
                          className="text-sm resize-none"
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEditCancel}
                        className="text-gray-500 hover:text-gray-700 text-xs h-8 px-3"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleEditSave}
                        className="bg-[#6C60FF] hover:bg-[#6C60FF]/90 text-white text-xs h-8 px-3"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )
          )}
        </div>


        
        {/* Location and Date - Conditional Layout */}
        {variant === 'card' ? (
          // Card view: Location left, Date right (justified)
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[15px] md:text-sm text-[#6A7282]">
              <div className="flex items-center gap-1.5 min-w-0 flex-1 max-w-[65%]">
                <MapPin className="h-5 w-5 md:h-4 md:w-4 flex-shrink-0 text-[#6A7282]" />
                <span
                  className="md:truncate"
                  title={currentImageLocation}
                  style={{ cursor: currentImageLocation && currentImageLocation.length > 30 ? 'help' : 'default' }}
                >
                  {currentImageLocation}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Calendar className="h-5 w-5 md:h-4 md:w-4 flex-shrink-0 text-[#6A7282]" />
                <span className="whitespace-nowrap">{currentImageDate ? new Date(currentImageDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : currentImageDate}</span>
              </div>
            </div>
            {/* Title - shown below location if exists and is different from name */}
            {currentImageTitle && currentImageTitle.trim() !== '' && currentImageTitle !== post.name && currentImageTitle !== currentImageData?.name && (
              <p
                className="truncate"
                style={{
                  color: '#393131',
                  fontSize: '16px',
                  fontStyle: 'normal',
                  fontWeight: 600,
                }}
                title={currentImageTitle}
              >
                {searchHighlight ? highlightText(currentImageTitle, searchHighlight) : currentImageTitle}
              </p>
            )}
          </div>
        ) : (
          // Thumbnail view: All on separate lines
          <div className="space-y-1 text-[13px] md:text-xs text-gray-500">
            {/* Title (if exists) */}
            {post.title && (
              <div className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 md:h-3 md:w-3 flex-shrink-0" />
                <span className="font-medium text-gray-900 truncate" title={post.title}>
                  {searchHighlight ? highlightText(post.title, searchHighlight) : post.title}
                </span>
              </div>
            )}

            {/* Date */}
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 md:h-3 md:w-3 flex-shrink-0" />
              <span>{currentImageDate ? new Date(currentImageDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : currentImageDate}</span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 md:h-3 md:w-3 flex-shrink-0" />
              <span
                className="truncate"
                title={currentImageLocation}
                style={{ cursor: currentImageLocation && currentImageLocation.length > 30 ? 'help' : 'default' }}
              >
                {currentImageLocation}
              </span>
            </div>

            {/* Comments */}
            <div
              className="flex items-center gap-1 text-black cursor-pointer hover:text-[#6C60FF] transition-colors"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onImageClick) {
                  onImageClick(
                    post.image || '',
                    'Post content',
                    post.title,
                    `${post.author.name} • ${post.date}`,
                    post.id,
                    true // focusComments - scroll to comments on mobile
                  );
                }
              }}
            >
              <MessageSquare className="h-3.5 w-3.5 md:h-3 md:w-3 flex-shrink-0" />
              <span>{post.comments} comments</span>
            </div>
          </div>
        )}

        {/* Content/Description */}
        {!isAddingDescription && !isEditingDescription ? (
          <div className={`${variant === 'card' ? 'text-[#101828] text-[17px] md:text-base' : 'text-gray-700 text-sm'}`}>
            {currentContent ? (
              !isCaptionHidden && (
                <p>
                  {searchHighlight
                    ? highlightText(currentContent, searchHighlight)
                    : renderDescriptionWithMentions(currentContent)
                  }
                </p>
              )
            ) : canAddDescription ? (
              // Show "Add description" and "AI suggest" buttons when content is empty and user has edit permission (memory owner or collaborator with edit/admin role)
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddingDescription(true)}
                  disabled={isAISuggesting}
                  className="text-[15px] md:text-sm h-auto p-0 font-normal flex items-center gap-1.5 hover:bg-transparent"
                  style={{ color: isAISuggesting ? '#9CA3AF' : '#6C60FF' }}
                >
                  <span className="text-lg md:text-base">+</span>
                  Add description
                </Button>
                <Button
                  ref={aiSuggestButtonRef}
                  variant="ghost"
                  size="sm"
                  onClick={handleAISuggest}
                  disabled={isAISuggesting}
                  className="text-[15px] md:text-sm h-auto p-0 font-normal flex items-center gap-1.5 hover:bg-transparent"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles w-4 h-4 mr-2 flex-shrink-0"
                    style={{ color: 'rgb(108, 96, 255)' }}><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path><path d="M20 3v4"></path><path d="M22 5h-4"></path><path d="M4 17v2"></path><path d="M5 18H3"></path></svg>
                  <span
                    className="text-[15px] md:text-sm font-normal"
                    style={{
                      background: 'linear-gradient(136deg, #FF60E0 9.11%, #6C60FF 58.79%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    {isAISuggesting ? 'Suggesting...' : 'AI suggest'}
                  </span>
                </Button>
              </div>
            ) : null}
          </div>
        ) : isAddingDescription ? (
          <div className="space-y-3">
            {/* Textarea for adding description with mention support */}
            <div className="relative">
              <Textarea
                ref={newDescriptionTextareaRef}
                value={newDescription}
                onChange={handleDescriptionChange}
                placeholder="Write a description for this moment... (Type @ to mention collaborators)"
                className={`${variant === 'card' ? 'text-base lg:text-base' : 'text-sm'} resize-none border-gray-300 focus:border-black placeholder:text-gray-400 text-gray-900 !field-sizing-normal`}
                style={{
                  minHeight: '120px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  outline: 'none',
                  boxShadow: 'none'
                }}
                autoFocus
              />

              {/* Custom mention dropdown */}
              {showMentionDropdown && filteredCollaborators.length > 0 && (
                <div className="absolute top-8 left-0 mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {filteredCollaborators.map((collaborator, index) => (
                    <div
                      key={collaborator.id}
                      onClick={() => handleMentionSelect(collaborator)}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{
                        borderBottom: index < filteredCollaborators.length - 1 ? '1px solid #f3f4f6' : 'none'
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
                              // Hide image on error and show initials
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : null}
                        <span className={collaborator.avatar && collaborator.avatar.trim() !== '' ? 'hidden' : ''}>
                          {collaborator.name?.slice(0, 2).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {collaborator.name}
                        </span>
                        <span className="text-xs text-gray-500 truncate">
                          {collaborator.email || collaborator.phone_number || ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              {/* Retry AI Assist button on the left - only show after AI suggestion was used */}
              {newDescription.trim() && hasAISuggestion ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRetryAISuggestion}
                  disabled={isRetryingAI || isAddingDescriptionLoading}
                  className="text-[#6C60FF] hover:text-[#6C60FF]/80 text-base h-6 px-2 flex items-center gap-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={isRetryingAI ? 'animate-spin' : ''}
                  >
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                  </svg>
                  {isRetryingAI ? 'Retrying...' : 'Retry AI Assist'}
                </Button>
              ) : <div />}

              {/* Cancel and Add buttons on the right */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAddingDescription(false);
                    setNewDescription("");
                    setHasAISuggestion(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-base h-6 px-2"
                  disabled={isAddingDescriptionLoading}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddDescription}
                  disabled={!hasContentBeyondMentions(newDescription) || isAddingDescriptionLoading}
                  className="bg-[#6C60FF] hover:bg-[#6C60FF]/90 text-white text-base h-6 px-4"
                  style={{padding: "13px 10px"}}
                >
                  {isAddingDescriptionLoading ? 'Adding...' : 'Add'}
                </Button>
              </div>
            </div>
          </div>
        ) : isEditingDescription ? (
          <div className="space-y-3">
            {/* Textarea for editing description with mention support */}
            <div className="relative">
              <Textarea
                ref={editDescriptionTextareaRef}
                value={editedDescription}
                onChange={handleEditDescriptionChange}
                placeholder="Edit your description... (Use @ to mention collaborators)"
                className={`${variant === 'card' ? 'text-sm lg:text-base' : 'text-sm'} resize-none border-gray-300 focus:border-black placeholder:text-gray-400 text-gray-900 !field-sizing-normal`}
                style={{
                  minHeight: '80px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  outline: 'none',
                  boxShadow: 'none'
                }}
                autoFocus
              />

              {/* Mention Dropdown for Edit Description */}
              {showEditMentionDropdown && filteredEditCollaborators.length > 0 && (
                <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredEditCollaborators.map((collaborator) => (
                    <button
                      key={collaborator.id}
                      onClick={() => handleEditMentionSelect(collaborator)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 last:border-0"
                    >
                      <div
                        className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                        style={{ backgroundColor: formatProfileColor(collaborator.profileColor) }}
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
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{collaborator.name}</div>
                        <div className="text-xs text-gray-500 truncate">{collaborator.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditingDescription(false);
                  setEditedDescription(currentContent || "");
                }}
                className="text-gray-500 hover:text-gray-700 text-xs h-6 px-2"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEditedDescription}
                disabled={!editedDescription.trim() || isEditingDescriptionLoading}
                className="bg-[#6C60FF] hover:bg-[#6C60FF]/90 text-white text-xs h-6 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-3 w-3 mr-1" />
                {isEditingDescriptionLoading ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : null}




      </div>

      {/* Tone Selection Modal */}
      <ToneSelectionModal
        isOpen={isToneModalOpen}
        onClose={() => setIsToneModalOpen(false)}
        onToneSelect={handleToneSelect}
        buttonRef={aiSuggestButtonRef}
      />

      {/* Edit Moment Modal - Centered on screen for timeline */}
      {isEditMomentOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[100] bg-black/50 hidden md:block"
            onClick={() => setIsEditMomentOpen(false)}
          />
          {/* Centered trigger point for Popover */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101]">
            <EditMediaItemPopover
              item={{
                id: currentImageId,
                name: currentImageData?.name || post.name || '',
                title: currentImageTitle,
                thumbnail: currentImageData?.src || post.image || '',
                image: currentImageData?.src || post.image || '',
                type: 'image',
                size: (post as any).size || (post as any).file_size || imageSize || '0',
                date: currentImageDate,
                location: typeof currentImageLocation === 'string' ? { displayName: currentImageLocation } : currentImageLocation,
                author: post.author,
                content: currentContent,
                description: currentContent,
                dimensions: (() => {
                  // Check for dimensions in various formats
                  if ((post as any).dimensions) return (post as any).dimensions;
                  if ((post as any).width && (post as any).height) return `${(post as any).width}×${(post as any).height}`;
                  if ((post as any).resolution) return (post as any).resolution;
                  if (imageDimensions) return imageDimensions;
                  // Default fallback
                  if (post.image) return '4032×3024';
                  return '';
                })(),
                labels: currentImageData?.tags || currentImageData?.labels || (post as any).tags || (post as any).labels || [],
                parent_id: (post as any).parent_id || (currentImageIndex > 0 ? post.id : undefined)
              }}
              trigger={<button className="w-0 h-0 opacity-0" />}
              onSave={(itemId, updates) => {
                console.log('🔵 PostCard onSave called with itemId:', itemId);
                console.log('🔵 Current image index:', currentImageIndex);
                console.log('🔵 Is sub-image?:', currentImageIndex > 0);
                console.log('🔵 PostCard onSave updates:', updates);
                console.log('🔵 onUpdateItem exists?', !!onUpdateItem);
                console.log('🔵 onUpdateItem type:', typeof onUpdateItem);
                if (onUpdateItem) {
                  console.log('🔵 Calling onUpdateItem now...');
                  // Use currentImageId to ensure we're updating the correct image (parent or sub-image)
                  onUpdateItem(currentImageId, updates);
                  console.log('🔵 onUpdateItem called successfully');

                  // Update local state if editing parent image
                  if (currentImageIndex === 0) {
                    if (updates.description !== undefined) {
                      setCurrentContent(updates.description);
                    }
                  }
                } else {
                  console.error('🔴 onUpdateItem is NOT defined! Cannot save changes.');
                }
                setIsEditMomentOpen(false);
              }}
              open={isEditMomentOpen}
              onOpenChange={setIsEditMomentOpen}
              memoryOwnerId={memoryOwnerId}
              memoryTitle={memoryTitle}
              memoryThumbnail={memoryThumbnail}
              memoryCreatedDate={memoryCreatedDate}
              memoryImages={memoryImages}
              storyTags={storyTags}
            />
          </div>
        </>
      )}

      {/* Share popover is now integrated above in the icon section */}
      {false && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[100] bg-black/50"
            onClick={() => setShowShareModal(false)}
          />

          {/* Modal */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-md">
            <div className="bg-white rounded-lg shadow-xl p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Share Post</h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Alert: Memory must be published - Only show if memory is NOT published */}
              {(!memoryPublished || memoryPublished === 3) && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> To share individual posts, the memory must be published first.
                    Please publish your memory to enable post sharing.
                  </p>
                </div>
              )}

              {/* Share Options - Disabled if memory is not published */}
              <div className={`space-y-2 ${(!memoryPublished || memoryPublished === 3) ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* Facebook Share */}
                <button
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
                  onClick={() => {
                    const postUrl = `${window.location.origin}/post/${post.id}`; // TODO: Use actual post URL
                    const shareText = `${post.title || 'Check out this post'}\n\n${currentContent || ''}\n\nBy ${post.author.name}${post.location ? ` • ${post.location}` : ''}`;

                    // Copy to clipboard for Facebook (since it doesn't support pre-filled text)
                    navigator.clipboard.writeText(shareText + '\n\n' + postUrl).then(() => {
                      toast.success("Post details copied!", {
                        description: "Paste in your Facebook post"
                      });
                      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`, '_blank');
                    });
                    setSharesCount(sharesCount + 1);
                    setShowShareModal(false);
                  }}
                >
                  <Facebook className="w-6 h-6 text-blue-600" />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900">Facebook</p>
                    <p className="text-xs text-gray-500">Share on Facebook</p>
                  </div>
                </button>

                {/* Twitter/X Share */}
                <button
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
                  onClick={() => {
                    const postUrl = `${window.location.origin}/post/${post.id}`; // TODO: Use actual post URL
                    const shareText = `${post.title || 'Check out this post'}${currentContent ? `\n\n${currentContent.substring(0, 200)}${currentContent.length > 200 ? '...' : ''}` : ''}`;

                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(postUrl)}`, '_blank');
                    setSharesCount(sharesCount + 1);
                    setShowShareModal(false);
                  }}
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900">X (Twitter)</p>
                    <p className="text-xs text-gray-500">Share on X</p>
                  </div>
                </button>

                {/* LinkedIn Share */}
                <button
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
                  onClick={() => {
                    const postUrl = `${window.location.origin}/post/${post.id}`; // TODO: Use actual post URL
                    const shareText = `${post.title || 'Check out this post'}${currentContent ? `\n\n${currentContent.substring(0, 250)}` : ''}\n\nBy ${post.author.name}`;

                    window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(shareText + '\n\n' + postUrl)}`, '_blank');
                    setSharesCount(sharesCount + 1);
                    setShowShareModal(false);
                  }}
                >
                  <Linkedin className="w-6 h-6 text-blue-700" />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900">LinkedIn</p>
                    <p className="text-xs text-gray-500">Share on LinkedIn</p>
                  </div>
                </button>
              </div>

              {/* Action Button */}
              <div className="mt-6">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}