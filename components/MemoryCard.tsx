import React, { useState, useEffect, useRef } from "react";
import * as Popover from '@radix-ui/react-popover';
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Plus, MapPin, Check, X, Loader2, Camera, Calendar, Home, Globe, Eye, Lock } from "lucide-react";
import { getCategoryColor } from "../constants/mediaConstants";
import { useAuth } from "../contexts/AuthContext";
import { userDisplayUtils } from "../utils/authUtils";

const isVideoUrl = (url?: string): boolean => {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
};

const getYoutubeVideoId = (url: string): string | null => {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
};

const isYoutubeUrl = (url?: string): boolean => {
  if (!url) return false;
  return !!getYoutubeVideoId(url);
};

function VideoThumbnail({ src, className }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => {
    setFrameReady(false);
  }, [src]);

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
      {!frameReady && (
        <div className="absolute inset-0 bg-gray-200" />
      )}
    </div>
  );
}

// Generate a consistent color based on the user's name
const generateAvatarColor = (name: string): string => {
  const colors = [
    '#6C60FF', // Purple
    '#EF4444', // Red
    '#10B981', // Green
    '#F59E0B', // Amber
    '#3B82F6', // Blue
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#14B8A6', // Teal
    '#6366F1', // Indigo
  ];

  // Create a simple hash from the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Use the hash to select a color
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
};

// Remove local getCategoryColor function - now using the consistent one from mediaConstants

// User Fallback Avatar Component for memory card backgrounds
function UserFallbackAvatar({
  user,
  className = ''
}: {
  user?: { name?: string; avatar?: string; profile_color?: string };
  className?: string;
}) {
  const initials = userDisplayUtils.generateInitials(user?.name || '');
  const profileColor = userDisplayUtils.formatProfileColor(user?.profile_color);

  // Use profile_color if available, otherwise use default gradient (matching header)
  const backgroundStyle = profileColor
    ? { backgroundColor: profileColor }
    : undefined;

  const fallbackClassName = profileColor
    ? `w-full h-full text-white font-bold text-4xl flex items-center justify-center ${className}`
    : `w-full h-full bg-gradient-to-br from-[#6C60FF] to-purple-600 text-white font-bold text-4xl flex items-center justify-center ${className}`;

  if (user?.avatar) {
    // Show user profile image if available
    return (
      <div className={`w-full h-full overflow-hidden ${className}`}>
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
          style={{
            ...backgroundStyle,
            display: 'none'
          }}
        >
          {initials}
        </div>
      </div>
    );
  }

  // Show user initials if no profile image
  if (initials) {
    return (
      <div
        className={fallbackClassName}
        style={backgroundStyle}
      >
        {initials}
      </div>
    );
  }

  // Fallback to default gradient if no name available
  return (
    <div className={`w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-bold text-4xl ${className}`}>
      ?
    </div>
  );
}

interface Contributor {
  name: string;
  avatar?: string;
  profile_color?: string;
}

interface MemoryCardProps {
  image: string | null | undefined;
  title: string;
  dateRange: string;
  location?: string; // Location where the memory was created
  category?: string;
  categoryColor?: string;
  label?: string; // Yellow label for memory classification
  suggestedCategory?: string; // Suggested category from AI
  photosCount: number;
  imagesCount?: number; // New prop for total images in memory
  avatar?: string;
  fullName?: string;
  profileColor?: string; // Author's profile color
  contributors?: Contributor[];
  tags?: string[];
  onClick?: () => void;
  onAddMedia?: () => void;
  categories?: any[];
  isSharedWith?: boolean; // Flag to indicate if this is a shared memory
  isInvite?: boolean; // Flag to indicate if this is an invite memory
  notificationId?: string | number; // Notification ID for invite actions
  onAcceptInvite?: (notificationId?: string | number) => void; // Callback for accepting invite
  onRejectInvite?: (notificationId?: string | number) => void; // Callback for rejecting invite
  onAcceptSuggestion?: () => void; // Callback for accepting suggested category
  onRejectSuggestion?: () => void; // Callback for rejecting suggested category
  isAcceptingOrRejecting?: boolean; // Loading state for accept/reject actions
  property?: { id: number; name: string }; // Property data if memory belongs to a property
  properties?: { id: number; name: string }[]; // All properties this memory belongs to
  published?: number; // Publication status: 1 = Public, 2 = View Only, 3 = Private
  countLabel?: string; // Override "moments" label (e.g. "stories")
  isEditMode?: boolean;
  isSelected?: boolean;
  onSelectToggle?: () => void;
  actionButton?: React.ReactNode;
  whiteFooter?: boolean;
}

export default function MemoryCard({
  image,
  title,
  dateRange,
  location,
  category,
  categoryColor,
  label,
  suggestedCategory,
  photosCount,
  imagesCount = 0,
  avatar,
  fullName,
  profileColor,
  contributors = [],
  tags = [],
  onClick,
  onAddMedia,
  categories = [],
  isSharedWith = false,
  isInvite = false,
  notificationId,
  onAcceptInvite,
  onRejectInvite,
  onAcceptSuggestion,
  onRejectSuggestion,
  isAcceptingOrRejecting = false,
  property,
  properties,
  published,
  countLabel = 'moments',
  isEditMode = false,
  isSelected = false,
  onSelectToggle,
  actionButton,
  whiteFooter = false,
}: MemoryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(true);
  const [isLocationTruncated, setIsLocationTruncated] = useState(false);
  const locationRef = useRef<HTMLParagraphElement>(null);
  const { user } = useAuth();

  // Use the getCategoryColor function to match sidebar exactly
  const getInvitesCategoryColor = () => {
    if (category === 'Suggested' || suggestedCategory) {
      return '#9CA3AF'; // Grey color for Suggested
    }

    if (category === 'Invites') {
      return '#EC4899'; // Pink color for Invites
    }

    return category ? getCategoryColor(category, categories) : '#6C60FF';
  };

  const finalCategoryColor = getInvitesCategoryColor();

  // Debug logging for suggested category
  useEffect(() => {
    if (suggestedCategory) {
      console.log('MemoryCard with suggested category:', {
        title,
        suggestedCategory,
        currentCategory: category,
        isInvite,
        hasAcceptHandler: !!onAcceptSuggestion,
        hasRejectHandler: !!onRejectSuggestion
      });
    }
  }, [suggestedCategory, title, category, isInvite, onAcceptSuggestion, onRejectSuggestion]);

  // Check if background image loads successfully
  useEffect(() => {
    if (!image) {
      setImageLoaded(false);
      return;
    }

    // Video/YouTube URLs can't be loaded via Image() — treat them as always loaded
    if (isVideoUrl(image) || isYoutubeUrl(image)) {
      setImageLoaded(true);
      return;
    }

    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.onerror = () => {
      console.warn(`⚠️ MemoryCard: cover image failed to load for "${title}", falling back to avatar. URL: ${image}`);
      setImageLoaded(false);
    };
    img.src = image;
  }, [image, title]);

  // Calculate precise truncation based on available space
  useEffect(() => {
    const calculateTruncation = () => {
      if (locationRef.current && location) {
        const locationElement = locationRef.current;
        const cardContainer = locationElement.closest('.memory-card-container');

        if (!cardContainer) {
          setIsLocationTruncated(false);
          return;
        }

        const imageCountContainer = cardContainer.querySelector('.image-count-container');

        if (!imageCountContainer || imagesCount === 0) {
          setIsLocationTruncated(false);
          return;
        }

        locationElement.style.maxWidth = 'none';
        locationElement.style.overflow = 'visible';
        locationElement.style.textOverflow = 'unset';
        locationElement.style.whiteSpace = 'nowrap';

        const locationRect = locationElement.getBoundingClientRect();
        const imageCountRect = imageCountContainer.getBoundingClientRect();

        const locationLeft = locationRect.left;
        const imageCountLeft = imageCountRect.left;
        const availableWidth = imageCountLeft - locationLeft - 15;

        const locationNaturalWidth = locationElement.scrollWidth;
        const needsTruncation = locationNaturalWidth > availableWidth;

        if (needsTruncation) {
          locationElement.style.maxWidth = `${availableWidth}px`;
          locationElement.style.overflow = 'hidden';
          locationElement.style.textOverflow = 'ellipsis';
          locationElement.style.whiteSpace = 'nowrap';
          setIsLocationTruncated(true);
        } else {
          locationElement.style.maxWidth = 'none';
          locationElement.style.overflow = 'visible';
          locationElement.style.textOverflow = 'unset';
          locationElement.style.whiteSpace = 'nowrap';
          setIsLocationTruncated(false);
        }
      }
    };

    const timeoutId = setTimeout(calculateTruncation, 100);
    window.addEventListener('resize', calculateTruncation);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', calculateTruncation);
    };
  }, [location, imagesCount]);

  // Always show author - use passed author data or fall back to logged-in user
  const displayName = fullName || user?.name || '';
  const displayAvatar = avatar || user?.avatar || '';
  // Own campaigns → use the logged-in user's own profile_color (from their profile) for the initials.
  // Shared campaigns → use the memory author/owner's profile_color.
  const displayProfileColor = isSharedWith
    ? (profileColor || user?.profile_color || '')
    : (user?.profile_color || profileColor || '');
  const hasFooterContent = !!displayName || contributors.length > 0 || tags.length > 0;

  return (
    <div
      className={`memory-card-container box-border flex flex-col gap-0 items-stretch justify-start p-0 relative transition-all duration-200 ease-out w-full ${
        isInvite
          ? 'cursor-default'
          : 'cursor-pointer hover:scale-[1.02]'
      }`}
      onClick={isInvite ? undefined : onClick}
      role={isInvite ? undefined : "button"}
      tabIndex={isInvite ? undefined : 0}
      onKeyDown={isInvite ? undefined : (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label={isInvite ? `${title} campaign invitation` : `View ${title} campaign details`}
    >
      {/* Image Section with overlay content */}
      <div className="relative bg-gray-200 overflow-hidden rounded-2xl aspect-[3/4] md:aspect-square w-full shadow-[0px_2px_12px_0px_rgba(0,0,0,0.10)]">
        {imageLoaded && image ? (
          isYoutubeUrl(image) ? (
            <img
              src={`https://img.youtube.com/vi/${getYoutubeVideoId(image)}/hqdefault.jpg`}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : isVideoUrl(image) ? (
            <VideoThumbnail src={image} className="w-full h-full object-cover" />
          ) : (
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover"
            />
          )
        ) : (
          // Empty cover → show the memory author/owner's profile image, else their initials + color
          // (falls back to the logged-in user for own memories via displayName/Avatar/Color)
          <UserFallbackAvatar user={{ name: displayName, avatar: displayAvatar, profile_color: displayProfileColor }} />
        )}

        {/* Dark gradient overlay at bottom for text readability */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 30%, rgba(0,0,0,0) 55%)' }}
        />

        {/* Edit Mode Checkbox - Top Left */}
        {isEditMode && !isSharedWith && (
          <div
            className="absolute top-3 left-3 z-20"
            onClick={e => { e.stopPropagation(); onSelectToggle?.(); }}
          >
            <div
              className="w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all duration-150 cursor-pointer"
              style={{
                backgroundColor: isSelected ? '#0075FF' : 'white',
                borderColor: isSelected ? '#0075FF' : '#d1d5db',
              }}
            >
              {isSelected && (
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Published Badge - Top Left */}
        {published && !isEditMode && (
          <div className="absolute top-3 left-3 z-10">
            <div
              className="shadow-md flex items-center gap-1.5 bg-white"
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                color: '#000000',
                fontSize: '12px',
                fontWeight: 600,
                lineHeight: '16px'
              }}
            >
              {published === 1 ? (
                <>
                  <Globe className="w-3.5 h-3.5" />
                  <span>Public</span>
                </>
              ) : published === 2 ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Only</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Private</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Right side badges column */}
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
          {/* Moments Count Badge */}
          {imagesCount > 0 && (
            <>
              {/* Desktop: "X moments" text badge */}
              <div
                className="hidden md:flex shadow-md items-center gap-1.5 bg-white"
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  color: '#000000',
                  fontSize: '12px',
                  fontWeight: 600,
                  lineHeight: '16px'
                }}
              >
                {imagesCount} {countLabel}
              </div>
              {/* Mobile: compact clock icon + number */}
              <div
                className="flex md:hidden shadow-md items-center gap-1 bg-white"
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  color: '#000000',
                  fontSize: '12px',
                  fontWeight: 600,
                  lineHeight: '16px'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{imagesCount}</span>
              </div>
            </>
          )}

          {/* Category Badge */}
          {category && (
            <div
              className="shadow-lg"
              style={{
                display: 'flex',
                padding: '6px 12px',
                alignItems: 'center',
                gap: '10px',
                borderRadius: '6px',
                backgroundColor: (category === 'Suggested' || suggestedCategory) ? '#ffffff' : finalCategoryColor,
                color: (category === 'Suggested' || suggestedCategory) ? '#6B7280' : '#ffffff',
                fontSize: '12px',
                fontWeight: 500,
                lineHeight: '16px'
              }}
            >
              {category}
            </div>
          )}

          {/* Label Badge (yellow - e.g. Keepsakes) */}
          {label && (
            <div
              className="text-gray-900 shadow-md"
              style={{
                display: 'flex',
                padding: '6px 12px',
                alignItems: 'center',
                gap: '10px',
                borderRadius: '6px',
                background: '#FCD34D',
                fontSize: '12px',
                fontWeight: 500,
                lineHeight: '16px'
              }}
            >
              {label}
            </div>
          )}
        </div>

        {/* Title, Location, Date - Overlaid on image bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10 flex items-end gap-3">
          {/* Left: Text content */}
          <div className="flex-1 min-w-0">
            {/* Property Name */}
            {(property || (properties && properties.length > 0)) && (() => {
              const propList = properties && properties.length > 0 ? properties : (property ? [property] : []);
              const isMultiple = propList.length > 1;
              return (
                <div className="flex items-center gap-2 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M4.375 5.25H6.125" stroke="rgba(255,255,255,0.8)" strokeWidth="0.875" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4.375 3.5H6.125" stroke="rgba(255,255,255,0.8)" strokeWidth="0.875" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6.125 9.1875V7.875C6.125 7.64294 6.03281 7.42038 5.86872 7.25628C5.70462 7.09219 5.48206 7 5.25 7C5.01794 7 4.79538 7.09219 4.63128 7.25628C4.46719 7.42038 4.375 7.64294 4.375 7.875V9.1875" stroke="rgba(255,255,255,0.8)" strokeWidth="0.875" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2.625 4.375H1.75C1.51794 4.375 1.29538 4.46719 1.13128 4.63128C0.967187 4.79538 0.875 5.01794 0.875 5.25V8.3125C0.875 8.54456 0.967187 8.76712 1.13128 8.93122C1.29538 9.09531 1.51794 9.1875 1.75 9.1875H8.75C8.98206 9.1875 9.20462 9.09531 9.36872 8.93122C9.53281 8.76712 9.625 8.54456 9.625 8.3125V3.9375C9.625 3.70544 9.53281 3.48288 9.36872 3.31878C9.20462 3.15469 8.98206 3.0625 8.75 3.0625H7.875" stroke="rgba(255,255,255,0.8)" strokeWidth="0.875" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2.625 9.1875V2.1875C2.625 1.95544 2.71719 1.73288 2.88128 1.56878C3.04538 1.40469 3.26794 1.3125 3.5 1.3125H7C7.23206 1.3125 7.45462 1.40469 7.61872 1.56878C7.78281 1.73288 7.875 1.95544 7.875 2.1875V3.0625" stroke="rgba(255,255,255,0.8)" strokeWidth="0.875" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {isMultiple ? (
                    <div className="relative group/proптip">
                      <span className="text-white/80 text-sm font-medium cursor-default underline decoration-dotted">
                        {propList.length} Properties
                      </span>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/proптip:block z-50 pointer-events-none">
                        <div className="bg-gray-900/90 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                          {propList.map(p => (
                            <div key={p.id} className="py-0.5">{p.name}</div>
                          ))}
                        </div>
                        <div className="w-2 h-2 bg-gray-900/90 rotate-45 ml-3 -mt-1" />
                      </div>
                    </div>
                  ) : (
                    <span className="text-white/80 text-sm font-medium">{propList[0].name}</span>
                  )}
                </div>
              );
            })()}

            {/* Title */}
            <h3
              className="font-bold text-white line-clamp-2 mb-1.5"
              style={{ fontSize: '24px', lineHeight: '28px', letterSpacing: '-0.44px' }}
            >
              {title}
            </h3>

            {/* Location */}
            {location && (
              <div className="flex items-center gap-1.5 mb-0.5">
                <MapPin className="w-3.5 h-3.5 text-white/90 flex-shrink-0" />
                <p
                  ref={locationRef}
                  className="text-white/90 truncate"
                  style={{ fontSize: '14px', fontWeight: 400, lineHeight: '18px' }}
                  title={isLocationTruncated ? location : undefined}
                >
                  {location}
                </p>
              </div>
            )}

            {/* Date — hidden entirely when there's no date to show (e.g. car listings,
                which have no upload-date range) rather than rendering a bare icon. */}
            {dateRange && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-white/90 flex-shrink-0" />
                <span className="text-white/90" style={{ fontSize: '14px', fontWeight: 400, lineHeight: '18px' }}>
                  {dateRange}
                </span>
              </div>
            )}
          </div>

          {/* Right: Add Media button */}
          {!isInvite && !suggestedCategory && onAddMedia && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddMedia(); }}
              className="flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-lg hover:scale-110 active:scale-95 cursor-pointer flex-shrink-0"
              style={{ width: '35px', height: '35px', borderRadius: '10px', background: '#FFFFFF' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#d92c87'; const icon = e.currentTarget.querySelector('svg') as SVGElement; if (icon) icon.style.color = '#FFFFFF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; const icon = e.currentTarget.querySelector('svg') as SVGElement; if (icon) icon.style.color = '#F6339A'; }}
              title="Add media to this campaign"
            >
              <Plus style={{ width: '20px', height: '20px', flexShrink: 0, color: '#F6339A' }} />
            </button>
          )}
        </div>
      </div>

      {/* Footer Section - Author + Contributors */}
      {hasFooterContent && (
        <div className={`p-3 ${whiteFooter ? 'bg-white' : ''}`}>
          {/* Desktop layout: single row */}
          <div className="hidden md:flex flex-col gap-1">
            {/* Row 1: Author info */}
            <div className="flex items-center gap-2.5 min-w-0">
              {displayName && (
                <>
                  <Avatar className="w-[30px] h-[30px] flex-shrink-0">
                    <AvatarImage src={displayAvatar} alt={displayName} className="object-cover" />
                    <AvatarFallback
                      className="text-xs text-white"
                      style={{
                        backgroundColor: displayProfileColor
                          ? userDisplayUtils.formatProfileColor(displayProfileColor)
                          : generateAvatarColor(displayName)
                      }}
                    >
                      {displayName?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-[15px] text-gray-700 line-clamp-1 leading-tight flex-1">{displayName}</span>
                </>
              )}
              {actionButton && (
                <div className="ml-auto flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {actionButton}
                </div>
              )}
            </div>

            {/* Row 2: Contributors (left) + Tags (far right) */}
            {(contributors.length > 0 || tags.length > 0) && (
              <div className="flex items-center justify-between ml-0.5">
                {/* Contributors */}
                {contributors.length > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1.5">
                      {contributors.slice(0, 2).map((contributor, index) => {
                        const backgroundColor = contributor.profile_color
                          ? userDisplayUtils.formatProfileColor(contributor.profile_color)
                          : generateAvatarColor(contributor.name);
                        return (
                          <Avatar key={index} className="border-2 border-white" style={{ height: '26px', width: '26px', flexShrink: 0 }}>
                            <AvatarImage src={contributor.avatar} alt={contributor.name} />
                            <AvatarFallback className="text-[9px] text-white" style={{ backgroundColor }}>
                              {contributor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                        );
                      })}
                    </div>
                    {contributors.length > 2 && (
                      <span className="text-xs text-gray-500 font-medium">+{contributors.length - 2}</span>
                    )}
                  </div>
                ) : <span />}
                {/* Tags — far right */}
                {tags.length > 0 && (
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <span className="text-[13px] font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">{tags[0]}</span>
                    {tags.length > 1 && (
                      <Popover.Root>
                        <Popover.Trigger asChild>
                          <button className="text-[13px] font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 cursor-pointer">+{tags.length - 1}</button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            side="top"
                            align="end"
                            sideOffset={4}
                            className="bg-white rounded-lg shadow-lg border border-gray-100 p-2 z-50 max-w-[180px]"
                            style={{ zIndex: 9999 }}
                          >
                            <div className="flex flex-wrap gap-1.5">
                              {tags.slice(1).map((tag, i) => (
                                <span key={i} className="text-[13px] font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">{tag}</span>
                              ))}
                            </div>
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile layout: stacked */}
          <div className="flex md:hidden flex-col gap-2">
            {/* Author info row */}
            {displayName && (
              <div className="flex items-center gap-2">
                <Avatar className="w-[30px] h-[30px] flex-shrink-0">
                  <AvatarImage src={displayAvatar} alt={displayName} className="object-cover" />
                  <AvatarFallback
                    className="text-xs text-white"
                    style={{
                      backgroundColor: displayProfileColor
                        ? userDisplayUtils.formatProfileColor(displayProfileColor)
                        : generateAvatarColor(displayName)
                    }}
                  >
                    {displayName?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold text-[14px] text-gray-700 line-clamp-2 leading-tight">{displayName}</span>
              </div>
            )}

            {/* Contributors + Tags row */}
            {(contributors.length > 0 || tags.length > 0) && (
              <div className="flex items-center justify-between">
                {contributors.length > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1.5">
                      {contributors.slice(0, 2).map((contributor, index) => {
                        const backgroundColor = contributor.profile_color
                          ? userDisplayUtils.formatProfileColor(contributor.profile_color)
                          : generateAvatarColor(contributor.name);
                        return (
                          <Avatar key={index} className="border-2 border-white" style={{ height: '24px', width: '24px', flexShrink: 0 }}>
                            <AvatarImage src={contributor.avatar} alt={contributor.name} />
                            <AvatarFallback className="text-[8px] text-white" style={{ backgroundColor }}>
                              {contributor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                        );
                      })}
                    </div>
                    {contributors.length > 2 && (
                      <span className="text-[11px] text-gray-500 font-medium">+{contributors.length - 2}</span>
                    )}
                  </div>
                ) : <span />}
                {tags.length > 0 && (
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <span className="text-[13px] font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">{tags[0]}</span>
                    {tags.length > 1 && (
                      <Popover.Root>
                        <Popover.Trigger asChild>
                          <button className="text-[13px] font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 cursor-pointer">+{tags.length - 1}</button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content side="top" align="end" sideOffset={4} className="bg-white rounded-lg shadow-lg border border-gray-100 p-2 z-50 max-w-[160px]" style={{ zIndex: 9999 }}>
                            <div className="flex flex-wrap gap-1.5">
                              {tags.slice(1).map((tag, i) => (
                                <span key={i} className="text-[13px] font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">{tag}</span>
                              ))}
                            </div>
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accept/No Buttons for Suggested Category - overlay on image */}
      {suggestedCategory && !isInvite && (onAcceptSuggestion || onRejectSuggestion) && (
        <div className="absolute top-14 right-3 md:top-3 md:right-auto md:left-1/2 md:-translate-x-1/2 flex gap-1 z-20">
          {/* Accept Button */}
          {onAcceptSuggestion && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isAcceptingOrRejecting) {
                  onAcceptSuggestion();
                }
              }}
              disabled={isAcceptingOrRejecting}
              className="flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-800 text-white text-xs font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed w-[71px] md:w-[87px]"
              style={{ height: '34px', padding: '4px', borderRadius: '8px' }}
              title="Accept suggested category"
              aria-label="Accept suggested category"
            >
              {isAcceptingOrRejecting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              <span style={{ fontSize: '12px', fontWeight: 500, lineHeight: '18px' }}>Accept</span>
            </button>
          )}

          {/* No Button */}
          {onRejectSuggestion && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isAcceptingOrRejecting) {
                  onRejectSuggestion();
                }
              }}
              disabled={isAcceptingOrRejecting}
              className="flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-800 text-white text-xs font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed w-[71px] md:w-[87px]"
              style={{ height: '34px', padding: '4px', borderRadius: '8px' }}
              title="Decline suggested category"
              aria-label="Decline suggested category"
            >
              {isAcceptingOrRejecting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <X className="w-3 h-3" />
              )}
              <span style={{ fontSize: '12px', fontWeight: 500, lineHeight: '18px' }}>Deny</span>
            </button>
          )}
        </div>
      )}

      {/* Accept/No Buttons for Invites - overlay on image */}
      {isInvite && (onAcceptInvite || onRejectInvite) && (
        <div className="absolute top-14 right-3 md:top-3 md:right-auto md:left-1/2 md:-translate-x-1/2 flex gap-1 z-20">
          {/* Accept Button */}
          {onAcceptInvite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAcceptInvite?.(notificationId);
              }}
              className="flex items-center justify-center gap-1 bg-[#F9FAFB] hover:bg-white text-gray-800 text-xs font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed w-[71px] md:w-[87px]"
              style={{ height: '34px', padding: '4px', borderRadius: '8px' }}
              title="Accept invitation"
              aria-label="Accept invitation"
            >
              <Check className="w-3 h-3" />
              <span style={{ fontSize: '12px', fontWeight: 500, lineHeight: '18px' }}>Accept</span>
            </button>
          )}

          {/* No/Reject Button */}
          {onRejectInvite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRejectInvite?.(notificationId);
              }}
              className="flex items-center justify-center gap-1 bg-[#F9FAFB] hover:bg-white text-gray-800 text-xs font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed w-[71px] md:w-[87px]"
              style={{ height: '34px', padding: '4px', borderRadius: '8px' }}
              title="Decline invitation"
              aria-label="Decline invitation"
            >
              <X className="w-3 h-3" />
              <span style={{ fontSize: '12px', fontWeight: 500, lineHeight: '18px' }}>Deny</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
