import React, { useState, useEffect, useRef } from "react";
import { Plus, ChevronLeft, Folder, FolderOpen, Menu, ChevronRight, ChevronDown, Image, X, Trash2, Pencil, ChevronUp } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import ImageHoverPopover from "./ImageHoverPopover";
import ShopifyCatalogNav from "./ShopifyCatalogNav";
import CarsCatalogNav from "./CarsCatalogNav";
import { getCategoryColor } from "../constants/mediaConstants";
import { dashboardAPI, userDisplayUtils } from "../utils/authUtils";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { updateCategoryColor } from "../utils/categoryColorManager";
import { triggerMemoryCountsRefresh } from '../hooks/useMemoryCounts';

// ── Video / YouTube thumbnail helpers ─────────────────────────────────────────
const isVideoUrl = (url?: string): boolean => {
  if (!url) return false;
  // Includes the raw-MIME-subtype extensions (.quicktime, .x-msvideo, etc.) that
  // some iPhone/.mov uploads still carry from a since-fixed backend naming bug
  // (ClickUp wdy2xgympv) — without these, those files render as a plain image
  // with no play button. Keep this list in sync with the mobile app's
  // _isVideoFile() in stasht-app-2026/lib/new_development/stories/story_detail_cover.dart.
  const exts = [
    '.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm', '.3gp', '.m4v',
    '.mts', '.m2ts', '.quicktime', '.x-msvideo', '.x-matroska', '.x-ms-wmv', '.3gpp',
  ];
  const lower = url.toLowerCase();
  return exts.some(ext => lower.includes(ext));
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

function SidebarVideoThumbnail({ src, className }: { src: string; className?: string }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [frameReady, setFrameReady] = React.useState(false);

  React.useEffect(() => { setFrameReady(false); }, [src]);

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

/** Renders memory.thumbnail correctly for image, video, or YouTube URLs */
function SidebarMemoryThumbnail({ src, alt, className, fallback }: {
  src: string;
  alt: string;
  className?: string;
  fallback: React.ReactNode;
}) {
  if (isYoutubeUrl(src)) {
    return (
      <img
        src={`https://img.youtube.com/vi/${getYoutubeVideoId(src)}/default.jpg`}
        alt={alt}
        className={className}
      />
    );
  }
  if (isVideoUrl(src)) {
    return <SidebarVideoThumbnail src={src} className={className} />;
  }
  return (
    <ImageWithFallback src={src} alt={alt} className={className} fallback={fallback} />
  );
}
// ──────────────────────────────────────────────────────────────────────────────

interface ImageItem {
  id: string;
  name: string;
  thumbnail: string;
  date: string;
  subImages?: ImageItem[];
}

interface Memory {
  id: string;
  title: string;
  thumbnail: string;
  imageCount: number;
  date: string;
  type: 'personal' | 'shared';
  author?: string;
  images?: ImageItem[];
  isExpanded?: boolean;
}

interface CategoryCardProps {
  name: string;
  count: number;
  isActive?: boolean;
  onClick?: () => void;
  hasMemories?: boolean;
  children?: React.ReactNode;
  colorScheme?: string;
  onDelete?: (name: string) => void;
  onEdit?: (name: string) => void;
  isUserCreated?: boolean;
  admin_id?: string | null;
  categories?: Category[];
  isLabel?: boolean;
  categoryId?: string;
  suggested?: boolean;
}

// User Fallback Avatar Component for memory thumbnails in CategoryNav
function UserFallbackAvatar({ 
  user, 
  size = 'w-8 h-8', 
  className = '',
  fillContainer = false 
}: { 
  user?: { name?: string; avatar?: string; profile_color?: string };
  size?: string;
  className?: string;
  fillContainer?: boolean;
}) {
  const initials = userDisplayUtils.generateInitials(user?.name || '');
  const profileColor = userDisplayUtils.formatProfileColor(user?.profile_color);
  
  // Use profile_color if available, otherwise use default gradient (matching header)
  const backgroundStyle = profileColor 
    ? { backgroundColor: profileColor }
    : undefined;
  
  // Choose size classes based on fillContainer prop
  const sizeClasses = fillContainer ? 'w-full h-full' : size;
  const roundingClasses = fillContainer ? '' : 'rounded-full';
  
  const fallbackClassName = profileColor 
    ? `${sizeClasses} ${roundingClasses} text-white font-medium text-xs flex items-center justify-center flex-shrink-0 ${className}`
    : `${sizeClasses} ${roundingClasses} bg-gradient-to-br from-[#6C60FF] to-purple-600 text-white font-medium text-xs flex items-center justify-center flex-shrink-0 ${className}`;
  
  if (user?.avatar) {
    // Show user profile image if available
    return (
      <div className={`${sizeClasses} ${roundingClasses} overflow-hidden bg-gray-100 flex-shrink-0 ${className}`}>
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
  
  // Fallback to generic folder icon for memories if no name available
  return (
    <div className={`${sizeClasses} ${roundingClasses} bg-gray-200 flex items-center justify-center flex-shrink-0 ${className}`}>
      <Folder className="w-4 h-4 text-gray-400" />
    </div>
  );
}

function CategoryCard({ name, count, isActive = false, onClick, hasMemories = false, children, categories, onEdit, admin_id }: CategoryCardProps) {
  const categoryColor = getCategoryColor(name, categories);

  return (
    <div 
      className="group w-full rounded-lg transition-all duration-200 cursor-pointer"
      style={{
        backgroundColor: isActive ? `${categoryColor}1A` : '#F5F5F5'
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = `${categoryColor}1A`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = '#F5F5F5';
        }
      }}
      onClick={onClick}
    >
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasMemories && (
              <ChevronRight 
                className={`w-3 h-3 transition-all duration-200 ${
                  isActive ? 'rotate-90' : ''
                }`}
                style={{
                  color: isActive ? categoryColor : ''
                }}
              />
            )}
            {isActive ? (
              <FolderOpen 
                className="w-4 h-4" 
                style={{ color: categoryColor }}
              />
            ) : (
              <Folder className="w-4 h-4 text-muted-foreground" />
            )}
            <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'} text-foreground`}>{name}</span>
            {/* Edit button for user-created categories only - visible on hover only */}
            {onEdit && name !== 'Published' && name !== 'Shared With' && (
              <button
                onClick={(e) => {
                  console.log('🖊️ Pencil clicked for:', name, 'onEdit:', !!onEdit);
                  e.stopPropagation();
                  onEdit && onEdit(name);
                }}
                className="ml-1 p-1 rounded hover:bg-gray-200 transition-all opacity-0 group-hover:opacity-100"
                title={`Edit ${name}`}
              >
                <Pencil className="w-3 h-3 text-gray-500 hover:text-gray-700" />
              </button>
            )}
          </div>
          <span 
            className="text-xs px-2 py-1 rounded-full transition-all duration-200 text-black"
            style={{
              backgroundColor: isActive ? `${categoryColor}33` : ''
            }}
          >
            {count}
          </span>
        </div>
      </div>
      
      {isActive && children && (
        <div className="px-3 pb-3 border-border/50 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

function EditableCategoryCard({
  name,
  count,
  isActive = false,
  onClick,
  hasMemories = false,
  children,
  onDelete,
  onEdit,
  admin_id = null,
  categories,
  isLabel = false,
  suggested = false,
  onCreateMemory,
  isOwner,
  canAddStory
}: CategoryCardProps & { onDelete?: (name: string) => void; onEdit?: (name: string) => void; isUserCreated?: boolean; admin_id?: string | null; categories?: Category[]; isLabel?: boolean; suggested?: boolean; onCreateMemory?: (categoryName: string) => void; isOwner?: boolean; canAddStory?: boolean }) {
  // A category is locked for adding campaigns when the API says the user is not the
  // owner OR explicitly cannot add a story to it.
  const cannotAddCampaign = isOwner === false || canAddStory === false;
  const categoryColor = isLabel ? '#eab308' : getCategoryColor(name, categories);
  
  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isHandlingBlur = useRef(false);
  
  // Debug logging for delete button visibility
  // Suggested categories cannot be deleted or edited
  const canDelete = onDelete && count === 0 && !suggested;
  const canEdit = onEdit && !suggested;
  console.log(`EditableCategoryCard "${name}": admin_id=${admin_id} (${typeof admin_id}), suggested=${suggested}, onDelete=${!!onDelete}, count=${count}, canDelete=${canDelete}`);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Add click outside listener to ensure input always closes
  useEffect(() => {
    if (isEditing) {
      const handleClickOutside = (event: MouseEvent) => {
        if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
          console.log('🖱️ Click outside detected, forcing input close');
          const trimmedValue = editValue.trim();
          if (trimmedValue && trimmedValue !== name && trimmedValue.length > 0) {
            handleSaveEdit();
          } else {
            setIsEditing(false);
            setEditValue(name);
          }
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isEditing, editValue, name]);

  // Update editValue when name prop changes (after successful edit)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(name);
    }
  }, [name, isEditing]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(name);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    console.log('✏️ handleEditClick called for:', name);
    e.stopPropagation();
    setEditValue(name);
    setIsEditing(true);
    isHandlingBlur.current = false; // Reset blur handling flag
  };

  const handleSaveEdit = async () => {
    console.log('💾 handleSaveEdit called for:', name, 'new value:', editValue, 'onEdit available:', !!onEdit);
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== name && onEdit) {
      try {
        console.log('🔄 Saving edit:', { oldName: name, newName: trimmedValue });
        await onEdit(trimmedValue);
        console.log('✅ Edit saved successfully');
        setIsEditing(false);
        // Force a small delay to allow parent state to update
        setTimeout(() => {
          console.log('🔄 Category edit UI should be updated now');
        }, 100);
      } catch (error) {
        console.error('❌ Error saving category edit:', error);
        // Reset to original name on error
        setEditValue(name);
        setIsEditing(false);
      }
    } else {
      // Reset to original name if no changes
      setEditValue(name);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    // Prevent multiple blur events
    if (isHandlingBlur.current) {
      console.log('🚫 Already handling blur, ignoring');
      return;
    }
    
    isHandlingBlur.current = true;
    console.log('🔍 Starting blur handling');
    
    // Add a small delay to ensure proper event handling
    setTimeout(() => {
      if (isEditing) { // Only proceed if still in editing mode
        const trimmedValue = editValue.trim();
        console.log('🔍 Blur event - checking for changes:', { current: trimmedValue, original: name, hasChanges: trimmedValue !== name, isEditing });
        
        // Always close the input - save if there are changes, cancel if not
        if (trimmedValue && trimmedValue !== name && trimmedValue.length > 0) {
          console.log('💾 Saving changes on blur');
          handleSaveEdit();
        } else {
          console.log('❌ No changes or empty value, canceling edit and closing input');
          setIsEditing(false);
          setEditValue(name);
        }
      }
      
      // Reset blur handling flag
      isHandlingBlur.current = false;
    }, 50);
  };

  const handleCancelEdit = () => {
    setEditValue(name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  return (
    <div
      className={`w-full rounded-lg transition-all duration-200 ${isEditing ? 'cursor-default' : 'cursor-pointer'} group`}
      style={{
        backgroundColor: isLabel
          ? '#eab3081A'
          : suggested
            ? (isActive ? '#f3f4f6' : 'transparent')
            : `${categoryColor}1A`
      }}
      onMouseEnter={(e) => {
        setIsHovered(true);
        if (!isActive) {
          e.currentTarget.style.backgroundColor = isLabel ? '#eab30826' : (suggested ? '#f9fafb' : `${categoryColor}26`);
        }
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
        if (!isActive) {
          e.currentTarget.style.backgroundColor = isLabel ? '#eab3081A' : (suggested ? 'transparent' : `${categoryColor}1A`);
        }
      }}
      onClick={isEditing ? undefined : onClick}
    >
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {hasMemories && (
              <ChevronRight 
                className={`w-3 h-3 transition-all duration-200 ${
                  isActive ? 'rotate-90' : ''
                }`}
                style={{
                  color: isActive ? categoryColor : ''
                }}
              />
            )}
            {isActive ? (
              <FolderOpen 
                className="w-4 h-4" 
                style={{ color: categoryColor }}
              />
            ) : (
              <Folder className={`w-4 h-4 ${isLabel ? 'text-yellow-500' : 'text-muted-foreground'}`} />
            )}
            {isEditing ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                className="h-6 px-2 py-1 text-sm rounded-md focus:outline-none focus:ring-1 bg-white"
                style={{ 
                  minWidth: '80px',
                  maxWidth: '140px',
                  border: `1px solid ${categoryColor}`,
                  borderRadius: '6px',
                  outline: 'none'
                }}
              />
            ) : (
              <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'} text-foreground`}>{name}</span>
            )}
            {/* Edit button for user-created categories only - visible on hover only, not for suggested categories */}
            {/* Hidden when the category is locked (not owner / cannot add story) */}
            {onEdit && !isEditing && !suggested && name !== 'Published' && name !== 'Shared With' && !cannotAddCampaign && (
              <button
                onClick={handleEditClick}
                className="ml-1 p-1 rounded hover:bg-gray-200 transition-all opacity-0 group-hover:opacity-100"
                title={`Edit ${name}`}
              >
                <Pencil className="w-3 h-3 text-gray-500 hover:text-gray-700" />
              </button>
            )}
          </div>
          <div className="relative flex-shrink-0">
            <span
              className="text-xs px-2 py-1 rounded-full transition-all duration-200 flex-shrink-0 inline-block"
              style={{
                backgroundColor: suggested
                  ? (isActive ? '#e5e7eb' : 'transparent')
                  : (isLabel ? '#eab30833' : `${categoryColor}33`),
                color: 'black',
                opacity: canDelete && isHovered ? 0 : 1
              }}
              onMouseEnter={() => console.log(`📊 Count span hovered for ${name}, canDelete: ${canDelete}, isHovered: ${isHovered}`)}
            >
              {count}
            </span>
            {canDelete && (
              <button
                onClick={handleDeleteClick}
                className="absolute inset-0 w-full h-full rounded-full text-red-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 flex items-center justify-center z-10"
                style={{
                  opacity: isHovered ? 1 : 0
                }}
                title={isLabel ? "Delete label" : "Delete category"}
                onMouseEnter={() => console.log(`🗑️ Trash button hovered for ${name}, isHovered: ${isHovered}`)}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* When expanded, show children first, then button at bottom */}
      {isActive && children && (
        <div className="px-3 pb-3 border-border/50 pt-3">
          {children}
        </div>
      )}

      {/* Add Memory Button - Show for all categories except Shared With, Published, Invites, and Suggested */}
      {/* Shows both when collapsed and expanded (at bottom when expanded) */}
      {/* Hidden when the category is locked (not owner / cannot add story) */}
      {onCreateMemory && name !== 'Shared With' && name !== 'Published' && name !== 'Invites' && !suggested && !cannotAddCampaign && (
        <div className={`px-3 ${isActive ? 'pt-0 pb-3' : 'pt-2 pb-3'}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (cannotAddCampaign) return;
              onCreateMemory(name);
            }}
            disabled={cannotAddCampaign}
            title={cannotAddCampaign ? "You can't add campaigns to this category" : undefined}
            className="w-full py-2 px-3 rounded-lg border-2 bg-white hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:cursor-not-allowed"
            style={cannotAddCampaign ? {
              backgroundColor: '#F3F4F6',
              borderColor: '#D1D5DB',
              color: '#9CA3AF'
            } : {
              backgroundColor: `${categoryColor}0D`,
              borderColor: categoryColor,
              color: categoryColor
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Campaign
          </button>
        </div>
      )}
    </div>
  );
}

export interface Category {
  id?: string;
  name: string;
  count: number;
  isUserCreated?: boolean;
  admin_id?: string | null;
  color?: string;
  suggested?: boolean;
  is_owner?: boolean;
  can_add_story?: boolean;
}

export interface Label {
  id?: string;
  name: string;
  count: number;
  isUserCreated?: boolean;
  admin_id?: string | null;
}

function AddCategoryPopover({ 
  value, 
  onChange, 
  onSave, 
  onCancel,
  onKeyPress,
  existingCategories,
  title = "New Category",
  buttonText = "Create"
}: { 
  value: string; 
  onChange: (value: string) => void; 
  onSave: () => void; 
  onCancel: () => void; 
  onKeyPress?: (e: React.KeyboardEvent) => void;
  existingCategories: Category[];
  title?: string;
  buttonText?: string;
}) {
  const isDuplicate = existingCategories.some(cat => cat.name.toLowerCase() === value.trim().toLowerCase());
  const isValid = value.trim().length > 0 && !isDuplicate;

  return (
    <div className="w-72 p-3 space-y-3 bg-white rounded-xl">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#6C60FF]/10 flex items-center justify-center">
          <Folder className="w-4 h-4 text-[#6C60FF]" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{title === "Edit Category" ? "Rename your category" : "Create a category to organize campaigns"}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyPress}
            placeholder="Category name..."
            className={`h-8 text-sm transition-all duration-200 bg-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus:outline-none ${
              isDuplicate 
                ? 'border-red-300 focus-visible:border-red-500 focus-visible:ring-red-200 focus-visible:ring-2' 
                : value.trim().length > 0 
                  ? 'border-green-300 focus-visible:border-gray-400 focus-visible:ring-gray-200 focus-visible:ring-2' 
                  : 'border-gray-200 focus-visible:border-gray-400 focus-visible:ring-gray-200 focus-visible:ring-2'
            }`}
            autoFocus
          />
        </div>
        
        {isDuplicate && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <X className="w-3 h-3" />
            Category already exists
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          onClick={onCancel}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900"
        >
          Cancel
        </Button>
        <Button
          onClick={onSave}
          disabled={!isValid}
          size="sm"
          className="h-7 px-3 text-xs bg-[#6C60FF] hover:bg-[#5951E6] text-white disabled:bg-gray-300"
        >
          <Plus className="w-3 h-3 mr-1" />
          {buttonText}
        </Button>
      </div>
    </div>
  );
}

function AddLabelPopover({ 
  value, 
  onChange, 
  onSave, 
  onCancel,
  onKeyPress,
  existingLabels
}: { 
  value: string; 
  onChange: (value: string) => void; 
  onSave: () => void; 
  onCancel: () => void; 
  onKeyPress: (e: React.KeyboardEvent) => void;
  existingLabels: Label[];
}) {
  const isDuplicate = existingLabels.some(label => label.name.toLowerCase() === value.trim().toLowerCase());
  const isValid = value.trim().length > 0 && !isDuplicate;

  return (
    <div className="w-72 p-3 space-y-3 bg-white rounded-xl">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-yellow-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 713 12V7a4 4 0 014-4z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-900">New Label</h3>
          <p className="text-xs text-gray-500">Create a label to tag campaigns</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyPress}
            placeholder="Label name..."
            className={`h-8 text-sm transition-all duration-200 bg-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus:outline-none ${
              isDuplicate 
                ? 'border-red-300 focus-visible:border-red-500 focus-visible:ring-red-200 focus-visible:ring-2' 
                : value.trim().length > 0 
                  ? 'border-green-300 focus-visible:border-gray-400 focus-visible:ring-gray-200 focus-visible:ring-2' 
                  : 'border-gray-200 focus-visible:border-gray-400 focus-visible:ring-gray-200 focus-visible:ring-2'
            }`}
            autoFocus
          />
        </div>
        
        {isDuplicate && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <X className="w-3 h-3" />
            Label already exists
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          onClick={onCancel}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900"
        >
          Cancel
        </Button>
        <Button
          onClick={onSave}
          disabled={!isValid}
          size="sm"
          className="h-7 px-3 text-xs bg-yellow-400 hover:bg-yellow-500 text-yellow-900 disabled:bg-gray-300"
        >
          <Plus className="w-3 h-3 mr-1" />
          Create
        </Button>
      </div>
    </div>
  );
}

function ImageTreeItem({
  image,
  categoryColor = '#6C60FF',
  isSubImage = false,
  onMemorySelect,
  memoryId,
  isExpanded = true,
  onToggleSubImages
}: {
  image: ImageItem;
  categoryColor?: string;
  isSubImage?: boolean;
  onMemorySelect?: (memoryId: string, options?: { openImageModal?: boolean; imageId?: string }) => void;
  memoryId?: string;
  isExpanded?: boolean;
  onToggleSubImages?: () => void;
}) {
  const handleImageClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onMemorySelect && memoryId) {
      console.log('🖼️ Image clicked in sidebar, navigating to memory:', memoryId, 'imageId:', image.id);
      onMemorySelect(memoryId, { openImageModal: true, imageId: image.id });
    }
  };

  return (
    <button
      onClick={handleImageClick}
      className={`${isSubImage ? 'ml-2' : 'ml-6'} flex items-center gap-2 p-2 rounded-lg transition-all duration-200 group text-left cursor-pointer`}
      style={{ width: 'calc(100% - 1.5rem)' }}
      onMouseEnter={(e) => {
        const target = e.currentTarget;
        target.style.backgroundColor = `${categoryColor}1A`;
      }}
      onMouseLeave={(e) => {
        const target = e.currentTarget;
        target.style.backgroundColor = '';
      }}
    >
      <div className="w-4 h-4 flex items-center justify-center">
        {(image as any).subImages?.length > 0 ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSubImages?.(); }}
            className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-100"
          >
            {isExpanded
              ? <ChevronDown className="w-3 h-3" style={{ color: categoryColor }} />
              : <ChevronRight className="w-3 h-3" />
            }
          </button>
        ) : (
          <div
            className="w-3 h-0.5 bg-gray-300 transition-colors"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${categoryColor}80`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '';
            }}
          />
        )}
      </div>
      
      <ImageHoverPopover src={image.thumbnail} alt={image.name}>
        <div 
          className="w-8 h-8 rounded-md overflow-hidden bg-gray-100 flex-shrink-0 transition-all duration-200"
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 0 0 2px ${categoryColor}33`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <ImageWithFallback
            src={image.thumbnail}
            alt={image.name}
            className="w-full h-full object-cover"
            fallback={
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <Image className="w-3 h-3 text-gray-400" />
              </div>
            }
          />
        </div>
      </ImageHoverPopover>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 truncate font-medium">
          {image.name}
        </p>
        <p className="text-xs text-gray-500 group-hover:text-gray-600 transition-colors">
          {new Date(image.date).toLocaleDateString()}
        </p>
      </div>
    </button>
  );
}

function MemoryTreeItem({ 
  memory, 
  categoryName,
  categoryColor = '#6C60FF',
  onToggleExpansion,
  isLabel = false,
  onMemorySelect,
  user
}: { 
  memory: Memory; 
  categoryName: string;
  categoryColor?: string;
  onToggleExpansion: (categoryName: string, memoryId: string) => void;
  isLabel?: boolean;
  onMemorySelect?: (memoryId: string, options?: { openImageModal?: boolean; imageId?: string }) => void;
  user?: { name?: string; avatar?: string; profile_color?: string };
}) {
  const hasImages = memory.images && memory.images.length > 0;

  const [expandedImageIds, setExpandedImageIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (memory.images) {
      memory.images.forEach(img => {
        if ((img as any).subImages?.length > 0) set.add(img.id);
      });
    }
    return set;
  });

  const handleChevronClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleExpansion(categoryName, memory.id);
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent clicking for Invites category memories
    if (categoryName === 'Invites') {
      return;
    }
    
    if (onMemorySelect) {
      onMemorySelect(memory.id);
    } else {
      onToggleExpansion(categoryName, memory.id);
    }
  };
  
  return (
    <div>
      <div className="flex items-center gap-2 p-2 rounded-lg transition-all duration-200">
        {hasImages && !isLabel ? (
          <button
            onClick={handleChevronClick}
            className="w-4 h-4 flex items-center justify-center text-gray-500 transition-colors rounded hover:bg-gray-100"
            style={{ zIndex: 10 }}
            title={`${memory.isExpanded ? 'Collapse' : 'Expand'} images`}
          >
            {memory.isExpanded
              ? <ChevronDown className="w-3 h-3" style={{ color: categoryColor }} />
              : <ChevronRight className="w-3 h-3" />
            }
          </button>
        ) : !isLabel ? (
          <div className="w-4 h-4" />
        ) : null}
        
        <ImageHoverPopover src={memory.thumbnail} alt={memory.title}>
          <button
            className="w-10 h-10 rounded-md overflow-hidden bg-gray-100 flex-shrink-0 transition-all duration-200 cursor-pointer"
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 2px ${categoryColor}33`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '';
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              // Prevent clicking for Invites category memories
              if (categoryName === 'Invites') {
                return;
              }

              if (onMemorySelect) {
                // Get the first image ID if available
                const firstImageId = memory.images && memory.images.length > 0
                  ? memory.images[0].id
                  : undefined;

                // Call with openImageModal option if there's an image
                if (firstImageId) {
                  onMemorySelect(memory.id, { openImageModal: true, imageId: firstImageId });
                } else {
                  onMemorySelect(memory.id);
                }
              }
            }}
            title={`Open ${memory.title}`}
          >
            {memory.thumbnail ? (
              <SidebarMemoryThumbnail
                src={memory.thumbnail}
                alt={memory.title}
                className="w-full h-full object-cover"
                fallback={<UserFallbackAvatar user={user} fillContainer={true} />}
              />
            ) : (
              <UserFallbackAvatar user={user} fillContainer={true} />
            )}
          </button>
        </ImageHoverPopover>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              {!isLabel ? (
                <button
                  onClick={handleTitleClick}
                  className="text-sm font-medium text-gray-900 line-clamp-2 w-full text-left transition-all duration-200 hover:underline hover:decoration-2 hover:underline-offset-2 hover:decoration-current"
                  style={{
                    '--hover-color': categoryColor
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = categoryColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '';
                  }}
                  title={`${memory.isExpanded ? 'Collapse' : 'Expand'} ${memory.title}`}
                >
                  {memory.title}
                </button>
              ) : (
                <button
                  onClick={handleTitleClick}
                  className="text-sm font-medium text-gray-900 line-clamp-2 w-full text-left transition-all duration-200 hover:underline hover:decoration-2 hover:underline-offset-2 hover:decoration-current cursor-pointer"
                  style={{
                    '--hover-color': '#eab308'
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#eab308';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '';
                  }}
                  title={`Open ${memory.title}`}
                >
                  {memory.title}
                </button>
              )}
              
              <div className="flex items-center gap-2 mt-1">
                <div className="bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
                  <div className="text-gray-600 text-[10px] font-medium">
                    {memory.imageCount || 0} item{(memory.imageCount || 0) !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {hasImages && memory.isExpanded && !isLabel && (
        <div className="mt-1 space-y-1">
          {memory.images!.map((image) => (
            <React.Fragment key={image.id}>
              <ImageTreeItem
                image={image}
                categoryColor={categoryColor}
                onMemorySelect={onMemorySelect}
                memoryId={memory.id}
                isExpanded={expandedImageIds.has(image.id)}
                onToggleSubImages={() => setExpandedImageIds(prev => {
                  const next = new Set(prev);
                  next.has(image.id) ? next.delete(image.id) : next.add(image.id);
                  return next;
                })}
              />

              {/* Render sub-images only when parent is expanded */}
              {image.subImages && image.subImages.length > 0 && expandedImageIds.has(image.id) && image.subImages.map((subImage: any) => (
                <div key={subImage.id} className="pl-6">
                  <ImageTreeItem
                    image={subImage}
                    categoryColor={categoryColor}
                    isSubImage={true}
                    onMemorySelect={onMemorySelect}
                    memoryId={memory.id}
                  />
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function MemoryTreeView({ 
  categoryName, 
  memories, 
  onToggleExpansion,
  isStacked = false,
  categoryColor = '#6C60FF',
  isLabel = false,
  onMemorySelect,
  user
}: { 
  categoryName: string; 
  memories: Memory[];
  onToggleExpansion: (categoryName: string, memoryId: string) => void;
  isStacked?: boolean;
  categoryColor?: string;
  isLabel?: boolean;
  onMemorySelect?: (memoryId: string, options?: { openImageModal?: boolean; imageId?: string }) => void;
  user?: { name?: string; avatar?: string; profile_color?: string };
}) {
  // For MemoryTreeView, we need to pass the categories array to get the right color
  const finalCategoryColor = categoryColor !== '#6C60FF' ? categoryColor : '#6C60FF';
  const [showAllMemories, setShowAllMemories] = useState(false);

  if (isStacked) {
    // For stacked view, also limit to 3 memories with expand option
    const displayedStackedMemories = showAllMemories ? memories : memories.slice(0, 3);
    const stackedRemainingCount = memories.length - 3;
    
    return (
      <div className="space-y-2">
        {displayedStackedMemories.map((memory) => {
          console.log('🧩 Rendering memory card:', memory.title, 'isExpanded:', memory.isExpanded, 'images:', memory.images?.length, 'hasSubImages:', memory.images?.some((img: any) => img.subImages && img.subImages.length > 0));
          const handleStackedClick = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Prevent clicking for Invites category memories
            if (categoryName === 'Invites') {
              return;
            }
            
            if (onMemorySelect) {
              onMemorySelect(memory.id);
            } else {
              onToggleExpansion(categoryName, memory.id);
            }
          };

          return (
            <div key={memory.id} className="flex flex-col">
              <button
                onClick={handleStackedClick}
                className="flex flex-col items-center py-2 px-1 transition-all duration-200 rounded-lg group"
                style={{
                  backgroundColor: memory.isExpanded ? `${finalCategoryColor}26` : '',
                  border: memory.isExpanded ? `1px solid ${finalCategoryColor}33` : ''
                }}
                onMouseEnter={(e) => {
                  if (!memory.isExpanded) {
                    e.currentTarget.style.backgroundColor = `${finalCategoryColor}1A`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!memory.isExpanded) {
                    e.currentTarget.style.backgroundColor = '';
                  }
                }}
                title={`${memory.title} (${memory.imageCount || 0} images)`}
              >
                <ImageHoverPopover src={memory.thumbnail} alt={memory.title}>
                  <div 
                    className="w-8 h-8 rounded-md overflow-hidden bg-gray-100 transition-all duration-200"
                    style={{
                      boxShadow: memory.isExpanded ? `0 0 0 2px ${finalCategoryColor}4D` : ''
                    }}
                  >
                    {memory.thumbnail ? (
                      <SidebarMemoryThumbnail
                        src={memory.thumbnail}
                        alt={memory.title}
                        className="w-full h-full object-cover"
                        fallback={<UserFallbackAvatar user={user} fillContainer={true} />}
                      />
                    ) : (
                      <UserFallbackAvatar user={user} fillContainer={true} />
                    )}
                  </div>
                </ImageHoverPopover>
                <span 
                  className="text-xs mt-1 text-center leading-tight transition-colors font-medium"
                  style={{
                    color: memory.isExpanded ? finalCategoryColor : ''
                  }}
                >
                  {memory.imageCount || 0}
                </span>
              </button>
              
              {(() => {
                console.log('💡 Memory expanded?', memory.isExpanded, 'Has images?', !!memory.images, 'Image count:', memory.images?.length);
                if (memory.isExpanded && memory.images) {
                  console.log('📋 Full images array:', memory.images);
                  return (
                <div className="mt-2 space-y-1 pl-1">
                  {memory.images.map((image) => {
                    console.log('🎨 Rendering image:', image.name, 'subImages:', image.subImages);
                    return (
                    <React.Fragment key={image.id}>
                      <button
                        className="flex items-center gap-1 p-1 rounded transition-all duration-200 group w-full text-left"
                        title={image.name}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${finalCategoryColor}1A`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '';
                        }}
                      >
                        <ImageHoverPopover src={image.thumbnail} alt={image.name}>
                          <div className="w-4 h-4 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                            <ImageWithFallback
                              src={image.thumbnail}
                              alt={image.name}
                              className="w-full h-full object-cover"
                              fallback={
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                  <Image className="w-2 h-2 text-gray-400" />
                                </div>
                              }
                            />
                          </div>
                        </ImageHoverPopover>
                        <span className="text-xs text-gray-600 transition-colors truncate">
                          {image.name}
                        </span>
                      </button>

                      {/* Render sub-images if they exist */}
                      {(() => {
                        console.log('🔍 Checking subImages for:', image.name, 'subImages:', image.subImages, 'length:', image.subImages?.length);
                        if (image.subImages && image.subImages.length > 0) {
                          console.log('✅ YES! Rendering', image.subImages.length, 'sub-images for parent:', image.name);
                          return image.subImages.map((subImage: any) => (
                        <button
                          key={subImage.id}
                          className="flex items-center gap-1 p-1 pl-3 rounded transition-all duration-200 group w-full text-left"
                          title={subImage.name}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = `${finalCategoryColor}1A`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '';
                          }}
                        >
                          <ImageHoverPopover src={subImage.thumbnail} alt={subImage.name}>
                            <div className="w-4 h-4 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                              <ImageWithFallback
                                src={subImage.thumbnail}
                                alt={subImage.name}
                                className="w-full h-full object-cover"
                                fallback={
                                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                    <Image className="w-2 h-2 text-gray-400" />
                                  </div>
                                }
                              />
                            </div>
                          </ImageHoverPopover>
                          <span className="text-xs text-gray-500 transition-colors truncate">
                            {subImage.name}
                          </span>
                        </button>
                          ));
                        } else {
                          console.log('❌ NO sub-images for:', image.name);
                          return null;
                        }
                      })()}
                    </React.Fragment>
                  );
                  })}
                </div>
                  );
                } else {
                  return null;
                }
              })()}
            </div>
          );
        })}
        
        {/* Show +more button for stacked view */}
        {!showAllMemories && stackedRemainingCount > 0 && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowAllMemories(true);
            }}
            className="flex flex-col items-center py-2 px-1 transition-all duration-200 rounded-lg group hover:bg-gray-100"
            title={`Show ${stackedRemainingCount} more campaigns`}
          >
            <div className="w-8 h-8 rounded-md flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 group-hover:border-gray-400">
              <Plus className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
            </div>
            <span className="text-xs font-medium text-center text-gray-600 group-hover:text-gray-800 mt-1">
              +{stackedRemainingCount} more
            </span>
          </button>
        )}
        
        {/* Show less button for stacked view */}
        {showAllMemories && stackedRemainingCount > 0 && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowAllMemories(false);
            }}
            className="flex flex-col items-center py-2 px-1 transition-all duration-200 rounded-lg group hover:bg-gray-100"
            title="Show less campaigns"
          >
            <div className="w-8 h-8 rounded-md flex items-center justify-center bg-gray-200 border border-gray-300 group-hover:border-gray-400">
              <ChevronUp className="w-4 h-4 text-gray-600 group-hover:text-gray-800" />
            </div>
            <span className="text-xs font-medium text-center text-gray-600 group-hover:text-gray-800 mt-1">
              Show less
            </span>
          </button>
        )}
      </div>
    );
  }
  
  // Show only first 3 memories unless expanded
  const displayedMemories = showAllMemories ? memories : memories.slice(0, 3);
  const remainingCount = memories.length - 3;
  
  // If no memories, show empty state
  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
          style={{
            backgroundColor: `${finalCategoryColor}33`
          }}
        >
          <svg 
            className="w-6 h-6" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
            style={{
              color: finalCategoryColor
            }}
          >
            {categoryName === 'Shared With' ? (
              // Simple users icon for Shared With
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            ) : categoryName === 'Published' ? (
              // Simple globe icon for Published
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              // Default folder icon for other categories
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            )}
          </svg>
        </div>
        <h4 className="text-sm font-medium text-gray-900 mb-1">
          No {categoryName.toLowerCase()} campaigns
        </h4>
        <p className="text-xs text-gray-500 leading-relaxed">
          {categoryName === 'Published' ? 'Campaigns you\'ve published publicly will appear here.' :
           categoryName === 'Personal' ? 'Your private campaigns will appear here.' :
           categoryName === 'Shared With' ? 'Campaigns shared with you will appear here.' :
           `Campaigns in ${categoryName} category will appear here.`}
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-1">
      {displayedMemories.map((memory) => {
        console.log('🌳 Rendering MemoryTreeItem:', memory.title, 'isExpanded:', memory.isExpanded, 'images:', memory.images?.length, 'hasSubImages:', memory.images?.some((img: any) => img.subImages && img.subImages.length > 0));
        return (
        <MemoryTreeItem
          key={memory.id}
          memory={memory}
          categoryName={categoryName}
          categoryColor={finalCategoryColor}
          onToggleExpansion={onToggleExpansion}
          isLabel={isLabel}
          onMemorySelect={onMemorySelect}
          user={user}
        />
      );
      })}
      
      {/* Show +more button for list view */}
      {!showAllMemories && remainingCount > 0 && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowAllMemories(true);
          }}
          className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
        >
          +{remainingCount} more campaigns
        </button>
      )}
      
      {/* Show less button for list view */}
      {showAllMemories && remainingCount > 0 && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowAllMemories(false);
          }}
          className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}

interface CategoryNavProps {
  isStacked?: boolean;
  onToggleExpansion?: () => void;
  canToggle?: boolean;
  categories: Category[];
  labels: Label[];
  onCategoriesChange: (categories: Category[]) => void;
  onLabelsChange: (labels: Label[]) => void;
  memories?: any[]; // Accept memory data from parent
  apiMemoriesData?: any; // API data with categories containing memories
  onMemorySelect?: (memoryId: string, options?: { openImageModal?: boolean; imageId?: string }) => void;
  selectedCategory?: string | null; // Selected category for filtering
  onCategorySelect?: (categoryName: string | null) => void; // Handler for category selection
  expandedCategories?: string[]; // Expanded categories controlled by parent (like MediaNav)
  onFilterChange?: (expandedCategories: string[]) => void; // Handler for expanded categories change (like MediaNav)
  onRefreshData?: () => void; // Handler to refresh memories data after category creation
  onCreateMemory?: (categoryName?: string) => void; // Handler to create a new memory for a specific category
  showUnassignedInFilter?: boolean; // Whether to show Unassigned option in category filter
  hasUnassignedItems?: boolean; // Whether there are unassigned items
  isPropertyOwner?: boolean; // Whether user is property owner (admin) or visitor (read-only)
  currentPropertyId?: number; // Property ID to send when creating a category on a property account
  openCreateCategorySignal?: number; // Increment to programmatically open the "New Category" popover
}

export default function CategoryNav({
  isStacked = false,
  onToggleExpansion,
  canToggle = false,
  categories,
  labels,
  onCategoriesChange,
  onLabelsChange,
  memories = [],
  apiMemoriesData,
  onMemorySelect,
  selectedCategory,
  onCategorySelect,
  expandedCategories: propExpandedCategories = [],
  onFilterChange,
  onRefreshData,
  onCreateMemory,
  showUnassignedInFilter = false,
  hasUnassignedItems = false,
  isPropertyOwner = true,
  currentPropertyId,
  openCreateCategorySignal
}: CategoryNavProps) {
  // Get user context for profile image and initials fallback
  const { user } = useAuth();
  
  // Get invites data
  
  const [activeSection, setActiveSection] = useState<string | null>("categories");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [expandedCategories, setExpandedCategories] = useState<string[]>(propExpandedCategories);
  const [expandedLabels, setExpandedLabels] = useState<Set<string>>(new Set());
  const [expandedMemories, setExpandedMemories] = useState<Set<string>>(new Set());

  // Sync expandedCategories with prop (like MediaNav)
  useEffect(() => {
    setExpandedCategories(propExpandedCategories);
  }, [propExpandedCategories]);

  // Auto-expand only non-empty categories whenever the category set changes (e.g. switching accounts)
  const prevCategoryKeyRef = useRef<string>('');
  useEffect(() => {
    if (categories && categories.length > 0 && onFilterChange) {
      // Build a key representing the current set of categories
      const categoryKey = categories.map(c => c.name).sort().join(',');
      if (categoryKey !== prevCategoryKeyRef.current) {
        prevCategoryKeyRef.current = categoryKey;
        // Only auto-expand categories that have memories; empty categories stay collapsed
        const nonEmptyCategoryNames = categories.filter(cat => (cat.count ?? 0) > 0).map(cat => cat.name);
        console.log('🎯 Auto-expand categories on category set change:', nonEmptyCategoryNames);
        setExpandedCategories(nonEmptyCategoryNames);
        onFilterChange(nonEmptyCategoryNames);
      }
    }
  }, [categories, onFilterChange]);

  // Sync selectedFilter with selectedCategory prop from parent
  useEffect(() => {
    if (selectedCategory) {
      setSelectedFilter(selectedCategory);
    } else {
      setSelectedFilter("all");
    }
  }, [selectedCategory]);
  
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCategoryPopover, setShowCategoryPopover] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [showEditCategoryPopover, setShowEditCategoryPopover] = useState(false);

  // Open the "New Category" popover when the parent increments the signal
  // (used when the user clicks "Create a Campaign" but owns no category yet).
  useEffect(() => {
    if (openCreateCategorySignal && isPropertyOwner) {
      setShowEditCategoryPopover(false);
      setEditingCategory(null);
      setEditCategoryName("");
      setShowCategoryPopover(true);
    }
  }, [openCreateCategorySignal, isPropertyOwner]);
  
  // Debug: Monitor edit popup state changes
  useEffect(() => {
    console.log('🔄 Edit popup state changed:', showEditCategoryPopover, 'editingCategory:', editingCategory);
  }, [showEditCategoryPopover, editingCategory]);
  const [newLabelName, setNewLabelName] = useState("");
  const [showLabelPopover, setShowLabelPopover] = useState(false);
  
  // Delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; type: 'category' | 'label' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Ref for the category navigation container
  const categoryNavRef = useRef<HTMLDivElement>(null);



  // Convert memory data from props into organized structure
  const organizedMemories: Record<string, Memory[]> = {};
  const organizedLabelMemories: Record<string, Memory[]> = {};
  
  // Use API data if available, otherwise fall back to client-side organization
  if (apiMemoriesData) {
    // Create a map of memory_id -> memory_images from sidebar for enrichment
    const sidebarMemoryImagesMap: { [key: number]: any[] } = {};
    // Create a map of memory_id -> image_link (cover) from sidebar. The rendered rows
    // come from all_memories, but the cover image_link lives on the sidebar object.
    const sidebarImageLinkMap: { [key: number]: string } = {};

    // Initialize empty arrays for all categories first
    if (apiMemoriesData.data?.sidebar?.categories?.items) {
      apiMemoriesData.data.sidebar.categories.items.forEach((apiCategory: any) => {
        organizedMemories[apiCategory.name] = [];
        // Collect memory_images from sidebar
        apiCategory.memories?.forEach((mem: any) => {
          if (mem.memory_images) {
            sidebarMemoryImagesMap[mem.id] = mem.memory_images;
          }
          if (mem.image_link) {
            sidebarImageLinkMap[mem.id] = mem.image_link;
          }
        });
      });
    }

    // Use all_memories field to get ALL memories and organize them by category
    const allMemoriesFromAPI = apiMemoriesData.data?.all_memories?.data || apiMemoriesData.all_memories || apiMemoriesData.data?.latest_memories || [];
    console.log('🔍 CategoryNav: Using all_memories from API:', allMemoriesFromAPI.length, 'memories');
    console.log('🔍 Sidebar memory_images map:', Object.keys(sidebarMemoryImagesMap).length, 'memories with image names');
    if (allMemoriesFromAPI.length > 0) {
      allMemoriesFromAPI.forEach((apiMemory: any) => {
        const categoryName = apiMemory.category?.name || apiMemory.category;
        if (categoryName && organizedMemories[categoryName] !== undefined) {
          // Enrich with sidebar memory_images if available (sidebar has actual image_name values)
          const sidebarImages = sidebarMemoryImagesMap[apiMemory.id];
          if (sidebarImages) {
            console.log('✅ Enriching memory', apiMemory.title, 'with', sidebarImages.length, 'images from sidebar');
            apiMemory.memory_images = sidebarImages;
          } else {
            console.log('⚠️  No sidebar images for memory:', apiMemory.title);
          }

          // Prefer the sidebar object's image_link (the all_memories item may not carry it)
          const coverImageLink = sidebarImageLinkMap[apiMemory.id] || apiMemory.image_link;

          const memoryItem = {
            id: apiMemory.id.toString(),
            title: apiMemory.title,
            thumbnail: coverImageLink ? coverImageLink.replace(/\\\//g, '/') : null,
            imageCount: apiMemory.photos?.count || apiMemory.photos_count || apiMemory.memory_images?.filter((img: any) => !img.parent_id).length || 1,
            date: apiMemory.created_at || new Date().toISOString(),
            type: 'personal' as const,
            category: categoryName,
            isExpanded: expandedMemories.has(`${categoryName}-${apiMemory.id}`),
            images: (() => {
              if (apiMemory.memory_images) {
                console.log('🖼️ Processing memory:', apiMemory.title, 'Total images:', apiMemory.memory_images.length);

                // Separate parent and sub images
                const parentImages = apiMemory.memory_images.filter((img: any) => !img.parent_id);
                const subImagesByParent: { [key: string]: any[] } = {};

                // Group sub-images by their parent_id
                const subImages = apiMemory.memory_images.filter((img: any) => img.parent_id);
                console.log('   Parent images:', parentImages.length, 'Sub-images:', subImages.length);

                subImages.forEach((subImg: any) => {
                  const parentId = subImg.parent_id.toString();
                  console.log('   Sub-image:', subImg.image_name, 'parent_id:', parentId);
                  if (!subImagesByParent[parentId]) {
                    subImagesByParent[parentId] = [];
                  }
                  subImagesByParent[parentId].push(subImg);
                });

                // Map parent images with their sub-images
                const result = parentImages.map((memoryImage: any) => {
                  const subImagesForThisParent = subImagesByParent[memoryImage.id.toString()] || [];
                  console.log('   Parent image:', memoryImage.image_name, 'ID:', memoryImage.id, 'has', subImagesForThisParent.length, 'sub-images');

                  return {
                    id: memoryImage.id.toString(),
                    name: memoryImage.image_name || `${apiMemory.title} - Image`,
                    thumbnail: memoryImage.image_link ? memoryImage.image_link.replace(/\\\//g, '/') : null,
                    date: memoryImage.capture_date || new Date().toISOString(),
                    parent_id: null,
                    subImages: subImagesForThisParent.map((subImg: any) => ({
                      id: subImg.id.toString(),
                      name: subImg.image_name || 'Sub-image',
                      thumbnail: subImg.image_link ? subImg.image_link.replace(/\\\//g, '/') : null,
                      date: subImg.capture_date || new Date().toISOString(),
                      parent_id: subImg.parent_id
                    }))
                  };
                });

                return result;
              }

              // Fallback to photos.preview_images if memory_images not available
              return apiMemory.photos?.preview_images?.map((img: any, index: number) => ({
              id: img.id.toString(),
              name: img.image_name || `${apiMemory.title} - Image ${index + 1}`,
              thumbnail: img.url,
              date: img.capture_date || new Date().toISOString()
            })) || (apiMemory.image_link ? [{
              id: apiMemory.id.toString(),
              name: apiMemory.title,
              thumbnail: apiMemory.image_link ? apiMemory.image_link.replace(/\\\//g, '/') : null,
              date: new Date().toISOString()
            }] : [])
          })()
          };
          organizedMemories[categoryName].push(memoryItem);
        }
      });
      
      // Add sharedWith memories to the "Shared With" category
      const sharedWithMemories = apiMemoriesData.data?.sharedWith || apiMemoriesData.sharedWith || [];
      if (sharedWithMemories.length > 0 && organizedMemories['Shared With'] !== undefined) {
        sharedWithMemories.forEach((apiMemory: any) => {
          const memoryItem = {
            id: apiMemory.id.toString(),
            title: apiMemory.title,
            thumbnail: apiMemory.image_link ? apiMemory.image_link.replace(/\\\//g, '/') : null,
            imageCount: apiMemory.photos?.count || apiMemory.photos_count || 0,
            date: apiMemory.created_at || new Date().toISOString(),
            type: 'shared' as const,
            author: apiMemory.author?.name,
            category: 'Shared With',
            isExpanded: expandedMemories.has(`Shared With-${apiMemory.id}`),
            images: apiMemory.photos?.preview_images?.map((img: any, index: number) => ({
              id: img.id.toString(),
              name: `${apiMemory.title} - Image ${index + 1}`,
              thumbnail: img.url,
              date: img.capture_date || new Date().toISOString()
            })) || []
          };
          organizedMemories['Shared With'].push(memoryItem);
        });
      }
      
      // Add Published Author entries to the "Published" category
      const publishedAuthorEntries = apiMemoriesData.published || apiMemoriesData.data?.published || [];
      if (publishedAuthorEntries.length > 0) {
        if (!organizedMemories['Published']) {
          organizedMemories['Published'] = [];
        }
        publishedAuthorEntries.forEach((entry: any, idx: number) => {
          organizedMemories['Published'].push({
            id: `pa-${idx}`,
            title: entry.author_name || 'Published Page',
            thumbnail: entry.wallpaper_image || null,
            imageCount: entry.memories_count || 0,
            date: entry.published_at || new Date().toISOString(),
            type: 'personal' as const,
            category: 'Published',
            isExpanded: false,
            images: []
          });
        });
      }

      console.log('🔍 CategoryNav: Organized memories by category:', Object.keys(organizedMemories).map(cat => `${cat}: ${organizedMemories[cat].length}`));
    } else {
      console.log('⚠️ CategoryNav: No all_memories found, falling back to sidebar embedded memories');
      // Fallback to sidebar embedded memories if all_memories is not available
      if (apiMemoriesData.data?.sidebar?.categories?.items) {
        apiMemoriesData.data.sidebar.categories.items.forEach((apiCategory: any) => {
          const categoryMemories = apiCategory.memories?.map((apiMemory: any) => ({
            id: apiMemory.id.toString(),
            title: apiMemory.title,
            thumbnail: apiMemory.image_link ? apiMemory.image_link.replace(/\\\//g, '/') : null,
            imageCount: apiMemory.photos?.count || apiMemory.photos_count || apiMemory.memory_images?.filter((img: any) => !img.parent_id).length || 1,
            date: new Date().toISOString(),
            type: 'personal' as const,
            category: apiCategory.name,
            isExpanded: expandedMemories.has(`${apiCategory.name}-${apiMemory.id}`),
            images: (() => {
              if (apiMemory.memory_images) {
                console.log('🖼️ Processing memory:', apiMemory.title, 'Total images:', apiMemory.memory_images.length);

                // Separate parent and sub images
                const parentImages = apiMemory.memory_images.filter((img: any) => !img.parent_id);
                const subImagesByParent: { [key: string]: any[] } = {};

                // Group sub-images by their parent_id
                const subImages = apiMemory.memory_images.filter((img: any) => img.parent_id);
                console.log('   Parent images:', parentImages.length, 'Sub-images:', subImages.length);

                subImages.forEach((subImg: any) => {
                  const parentId = subImg.parent_id.toString();
                  console.log('   Sub-image:', subImg.image_name, 'parent_id:', parentId);
                  if (!subImagesByParent[parentId]) {
                    subImagesByParent[parentId] = [];
                  }
                  subImagesByParent[parentId].push(subImg);
                });

                // Map parent images with their sub-images
                const result = parentImages.map((memoryImage: any) => {
                  const subImagesForThisParent = subImagesByParent[memoryImage.id.toString()] || [];
                  console.log('   Parent image:', memoryImage.image_name, 'ID:', memoryImage.id, 'has', subImagesForThisParent.length, 'sub-images');

                  return {
                    id: memoryImage.id.toString(),
                    name: memoryImage.image_name || `${apiMemory.title} - Image`,
                    thumbnail: memoryImage.image_link ? memoryImage.image_link.replace(/\\\//g, '/') : null,
                    date: memoryImage.capture_date || new Date().toISOString(),
                    parent_id: null,
                    subImages: subImagesForThisParent.map((subImg: any) => ({
                      id: subImg.id.toString(),
                      name: subImg.image_name || 'Sub-image',
                      thumbnail: subImg.image_link ? subImg.image_link.replace(/\\\//g, '/') : null,
                      date: subImg.capture_date || new Date().toISOString(),
                      parent_id: subImg.parent_id
                    }))
                  };
                });

                return result;
              }

              // Fallback if no memory_images
              return apiMemory.image_link ? [{
                id: apiMemory.id.toString(),
                name: apiMemory.title,
                thumbnail: apiMemory.image_link ? apiMemory.image_link.replace(/\\\//g, '/') : null,
                date: new Date().toISOString()
              }] : [];
            })()
          })) || [];
          
          organizedMemories[apiCategory.name] = categoryMemories;
        });
      }
    }
  } else {
    // Initialize with empty arrays for all categories
    categories.forEach(category => {
      organizedMemories[category.name] = [];
    });
    
    // Organize memories by category (fallback)
    memories.forEach(memory => {
      const categoryKey = typeof memory.category === 'string'
        ? memory.category
        : memory.category?.name;
      if (categoryKey && organizedMemories[categoryKey]) {
        const memoryWithExpansion = {
          ...memory,
          isExpanded: expandedMemories.has(`${categoryKey}-${memory.id}`),
          images: memory.images?.map((img: any) => ({
            id: img.id,
            name: img.name,
            thumbnail: img.thumbnail,
            date: img.date
          })) || []
        };
        organizedMemories[categoryKey].push(memoryWithExpansion);
      }
    });
  }
  
  // Use API data for labels if available
  if (apiMemoriesData && apiMemoriesData.data?.sidebar?.labels?.items) {
    // Use API labels with their embedded memories
    apiMemoriesData.data.sidebar.labels.items.forEach((apiLabel: any) => {
      const labelMemories = apiLabel.memories?.map((apiMemory: any) => ({
        id: apiMemory.id.toString(),
        title: apiMemory.title,
        thumbnail: apiMemory.image_link ? apiMemory.image_link.replace(/\\\//g, '/') : null,
        imageCount: apiMemory.photos?.count || apiMemory.photos_count || apiMemory.memory_images?.filter((img: any) => !img.parent_id).length || 1,
        date: new Date().toISOString(),
        type: 'personal' as const,
        category: apiLabel.name,
        isExpanded: expandedMemories.has(`${apiLabel.name}-${apiMemory.id}`),
        images: (() => {
          if (apiMemory.memory_images) {
            // Separate parent and sub images
            const parentImages = apiMemory.memory_images.filter((img: any) => !img.parent_id);
            const subImagesByParent: { [key: string]: any[] } = {};

            // Group sub-images by their parent_id
            apiMemory.memory_images.filter((img: any) => img.parent_id).forEach((subImg: any) => {
              const parentId = subImg.parent_id.toString();
              if (!subImagesByParent[parentId]) {
                subImagesByParent[parentId] = [];
              }
              subImagesByParent[parentId].push(subImg);
            });

            // Map parent images with their sub-images
            return parentImages.map((memoryImage: any) => ({
              id: memoryImage.id.toString(),
              name: memoryImage.image_name || `${apiMemory.title} - Image`,
              thumbnail: memoryImage.image_link,
              date: memoryImage.capture_date || new Date().toISOString(),
              parent_id: null,
              subImages: subImagesByParent[memoryImage.id.toString()]?.map((subImg: any) => ({
                id: subImg.id.toString(),
                name: subImg.image_name || 'Sub-image',
                thumbnail: subImg.image_link,
                date: subImg.capture_date || new Date().toISOString(),
                parent_id: subImg.parent_id
              })) || []
            }));
          }

          // Fallback if no memory_images
          return apiMemory.image_link ? [{
            id: apiMemory.id.toString(),
            name: apiMemory.title,
            thumbnail: apiMemory.image_link,
            date: new Date().toISOString()
          }] : [];
        })()
      })) || [];
      
      organizedLabelMemories[apiLabel.name] = labelMemories;
    });
  } else {
    // Initialize with empty arrays for all labels
    labels.forEach(label => {
      organizedLabelMemories[label.name] = [];
    });
    
    // Organize by labels (fallback)
    memories.forEach(memory => {
      if (memory.labels) {
        memory.labels.forEach(labelName => {
          if (organizedLabelMemories[labelName]) {
            const memoryWithExpansion = {
              ...memory,
              isExpanded: expandedMemories.has(`${labelName}-${memory.id}`),
              images: memory.images?.map((img: any) => ({
                id: img.id,
                name: img.name,
                thumbnail: img.thumbnail,
                date: img.date
              })) || []
            };
            organizedLabelMemories[labelName].push(memoryWithExpansion);
          }
        });
      }
    });
  }

  // Color palette for user-created categories
  const colorPalette = [
    '#FF6B6B', // Coral Red
    '#4ECDC4', // Teal
    '#45B7D1', // Sky Blue
    '#96CEB4', // Mint Green
    '#FFEAA7', // Warm Yellow
    '#DDA0DD', // Plum
    '#98D8C8', // Seafoam
    '#F7DC6F', // Golden Yellow
    '#BB8FCE', // Lavender
    '#85C1E9', // Light Blue
    '#F8C471', // Peach
    '#82E0AA', // Light Green
    '#F1948A', // Salmon
    '#AED6F1', // Powder Blue
    '#D7BDE2', // Light Purple
    '#A9DFBF', // Sage Green
    '#F9E79F', // Cream Yellow
    '#D5A6BD', // Dusty Rose
  ];

  const getRandomColor = (): string => {
    // Get colors already used by user-created categories
    const usedColors = categories
      .filter(cat => cat.isUserCreated && cat.color)
      .map(cat => cat.color);
    
    // Get available colors (not yet used)
    const availableColors = colorPalette.filter(color => !usedColors.includes(color));
    
    // If all colors are used, pick a random one from the full palette
    const colorsToChooseFrom = availableColors.length > 0 ? availableColors : colorPalette;
    
    return colorsToChooseFrom[Math.floor(Math.random() * colorsToChooseFrom.length)];
  };

  const handleCreateCategory = async () => {
    const trimmedName = newCategoryName.trim();
    
    if (!trimmedName) {
      toast.error("Please enter a category name");
      return;
    }
    
    if (categories.some(cat => cat.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error("Category name already exists");
      return;
    }

    try {
      console.log('=== CREATING CATEGORY ===');
      console.log('Category Name:', trimmedName);
      
      const response = await dashboardAPI.createCategory(trimmedName, isPropertyOwner && currentPropertyId ? currentPropertyId : undefined);
      console.log('Create Category API Response:', response);
      
      if (response.success) {
        const newCategory: Category = {
          id: response.data?.data?.id?.toString() || response.data?.id?.toString(),
          name: trimmedName,
          count: 0,
          isUserCreated: true,
          color: getRandomColor(),
          // The user just created this category, so they own it and can add campaigns to it.
          // Without these flags the optimistic entry fails isAddableOwnCategory (is_owner === true)
          // in MemoriesPage, so the "Create a Campaign" gate keeps saying "create one first" and
          // the dropdown stays empty until the server refetch lands.
          is_owner: true,
          can_add_story: true,
        };
        
        // Insert new category right after "Personal" category
        const personalIndex = categories.findIndex(cat => cat.name === 'Personal');
        const insertIndex = personalIndex !== -1 ? personalIndex + 1 : 1;
        
        const updatedCategories = [
          ...categories.slice(0, insertIndex),
          newCategory,
          ...categories.slice(insertIndex)
        ];
        onCategoriesChange(updatedCategories);
        
        setNewCategoryName("");
        setShowCategoryPopover(false);
        
        // Keep all categories expanded including the new one
        const updatedExpandedCategories = [...expandedCategories, trimmedName];
        setExpandedCategories(updatedExpandedCategories);
        
        // Notify parent component about the expanded categories
        if (onFilterChange) {
          onFilterChange(updatedExpandedCategories);
        }
        
        toast.success(`Category "${trimmedName}" created successfully!`);
        console.log('✅ Category created successfully:', response.data);
        
        // Refresh the data to get updated categories from server
        if (onRefreshData) {
          console.log('🔄 Refreshing data after category creation...');
          onRefreshData();
        }
      } else {
        toast.error(response.error || "Failed to create category");
        console.error('❌ Failed to create category:', response.error);
      }
    } catch (error) {
      console.error('🔥 Error creating category:', error);
      toast.error("Network error. Please try again.");
    }
  };

  const handleCreateLabel = async () => {
    const trimmedName = newLabelName.trim();
    
    if (!trimmedName) {
      toast.error("Please enter a label name");
      return;
    }
    
    if (labels.some(label => label.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error("Label name already exists");
      return;
    }

    try {
      console.log('=== CREATING LABEL ===');
      console.log('Label Name:', trimmedName);
      
      const response = await dashboardAPI.createLabel(trimmedName);
      console.log('Create Label API Response:', response);
      
      if (response.success) {
        const newLabel: Label = {
          id: response.data?.data?.id?.toString() || response.data?.id?.toString(),
          name: trimmedName,
          count: 0,
          isUserCreated: true
        };
        
        const updatedLabels = [...labels, newLabel];
        onLabelsChange(updatedLabels);

        setNewLabelName("");
        setShowLabelPopover(false);
        setExpandedLabels(prev => new Set([...prev, trimmedName]));

        toast.success(`Label "${trimmedName}" created successfully!`);
        console.log('✅ Label created successfully:', response.data);

        // Refresh the data to get updated labels from server
        if (onRefreshData) {
          console.log('🔄 Refreshing data after label creation...');
          onRefreshData();
        }
      } else {
        toast.error(response.error || "Failed to create label");
        console.error('❌ Failed to create label:', response.error);
      }
    } catch (error) {
      console.error('🔥 Error creating label:', error);
      toast.error("Network error. Please try again.");
    }
  };

  const handleEditCategoryClick = (categoryName: string) => {
    console.log('🖊️ Edit category clicked:', categoryName);
    const category = categories.find(cat => cat.name === categoryName);
    console.log('Found category:', category);
    
    if (category && category.id) {
      console.log('Setting edit state:', { id: category.id, name: category.name });
      
      // Close any existing popovers first
      setShowCategoryPopover(false);
      setNewCategoryName("");
      
      // Set edit state
      setEditingCategory({ id: category.id, name: category.name });
      setEditCategoryName(category.name);
      
      // Open the shared popover in edit mode
      setShowEditCategoryPopover(true);
      
      console.log('Edit popup should be opening...');
    } else {
      console.error('Category not found or missing ID:', { category, id: category?.id });
    }
  };

  const handleInlineEditCategory = async (categoryName: string, newName: string) => {
    const trimmedName = newName.trim();
    
    if (!trimmedName) {
      toast.error("Please enter a category name");
      return;
    }

    if (trimmedName === categoryName) {
      // No change
      return;
    }

    const category = categories.find(cat => cat.name === categoryName);
    
    if (!category || !category.id) {
      toast.error("Category not found");
      return;
    }

    // Check for duplicate names
    const existingCategory = categories.find(cat => 
      cat.name.toLowerCase() === trimmedName.toLowerCase() && cat.id !== category.id
    );
    
    if (existingCategory) {
      toast.error("A category with this name already exists");
      throw new Error("Duplicate category name");
    }

    try {
      console.log('🔄 Updating category:', { id: category.id, oldName: categoryName, newName: trimmedName });
      
      const response = await dashboardAPI.editCategory(category.id, trimmedName);
      
      if (response.success) {
        console.log('✅ Category updated successfully:', response.data);
        
        // Update persistent color storage for renamed category
        updateCategoryColor(categoryName, trimmedName);
        
        // Update local categories state via parent callback
        const updatedCategories = categories.map(cat => 
          cat.id === category.id ? { ...cat, name: trimmedName } : cat
        );
        onCategoriesChange(updatedCategories);
        
        // Update expanded categories if needed
        const updatedExpandedCategories = expandedCategories.map(catName =>
          catName === categoryName ? trimmedName : catName
        );
        setExpandedCategories(updatedExpandedCategories);
        
        if (onFilterChange) {
          onFilterChange(updatedExpandedCategories);
        }
        
        // Refresh data to ensure UI updates
        if (onRefreshData) {
          onRefreshData();
        }
        
        toast.success(`Category renamed to "${trimmedName}"`);
      } else {
        console.error('❌ Failed to update category:', response.error);
        toast.error(response.error || "Failed to update category");
        throw new Error(response.error || "Failed to update category");
      }
    } catch (error) {
      console.error('🔥 Error updating category:', error);
      toast.error("Network error. Please try again.");
      throw error;
    }
  };

  const handleEditCategory = async () => {
    const trimmedName = editCategoryName.trim();
    
    if (!trimmedName) {
      toast.error("Please enter a category name");
      return;
    }
    
    if (!editingCategory) {
      toast.error("No category selected for editing");
      return;
    }
    
    // Check if the new name already exists (excluding the current category)
    if (categories.some(cat => 
      cat.name.toLowerCase() === trimmedName.toLowerCase() && 
      cat.id !== editingCategory.id
    )) {
      toast.error("Category name already exists");
      return;
    }

    try {
      console.log('=== EDITING CATEGORY ===');
      console.log('Category ID:', editingCategory.id);
      console.log('New Name:', trimmedName);
      
      const response = await dashboardAPI.editCategory(editingCategory.id, trimmedName);
      
      if (response.success) {
        // Update the local categories list
        const updatedCategories = categories.map(cat => 
          cat.id === editingCategory.id 
            ? { ...cat, name: trimmedName }
            : cat
        );
        onCategoriesChange(updatedCategories);
        
        // Update expanded categories if needed
        const updatedExpandedCategories = expandedCategories.map(catName =>
          catName === editingCategory.name ? trimmedName : catName
        );
        setExpandedCategories(updatedExpandedCategories);
        if (onFilterChange) {
          onFilterChange(updatedExpandedCategories);
        }
        
        // Reset edit state and close popover
        setEditingCategory(null);
        setEditCategoryName("");
        setShowEditCategoryPopover(false);
        setShowCategoryPopover(false);
        
        toast.success(`Category renamed to "${trimmedName}"`);
        console.log('✅ Category edited successfully:', response.data);
        
        // Refresh the data to get updated categories from server
        if (onRefreshData) {
          console.log('🔄 Refreshing data after category edit...');
          onRefreshData();
        }
      } else {
        toast.error(response.error || "Failed to edit category");
        console.error('❌ Failed to edit category:', response.error);
      }
    } catch (error) {
      console.error('🔥 Error editing category:', error);
      toast.error("Network error. Please try again.");
    }
  };

  const handleInlineEditLabel = async (labelName: string, newName: string) => {
    console.log('🏷️ handleInlineEditLabel called:', { labelName, newName });
    const trimmedName = newName.trim();

    if (!trimmedName) {
      toast.error("Please enter a label name");
      return;
    }

    if (trimmedName === labelName) {
      // No change
      return;
    }

    const label = labels.find(lab => lab.name === labelName);

    if (!label || !label.id) {
      toast.error("Label not found");
      return;
    }

    // Check for duplicate names
    const existingLabel = labels.find(lab =>
      lab.name.toLowerCase() === trimmedName.toLowerCase() && lab.id !== label.id
    );

    if (existingLabel) {
      toast.error("A label with this name already exists");
      throw new Error("Duplicate label name");
    }

    try {
      console.log('🔄 Updating label:', { id: label.id, oldName: labelName, newName: trimmedName });

      const response = await dashboardAPI.editLabel(label.id, trimmedName);

      if (response.success) {
        console.log('✅ Label updated successfully:', response.data);

        // Update the labels array
        const updatedLabels = labels.map(lab =>
          lab.id === label.id ? { ...lab, name: trimmedName } : lab
        );
        onLabelsChange(updatedLabels);

        // Update expanded labels set
        setExpandedLabels(prev => {
          const newSet = new Set(prev);
          if (newSet.has(labelName)) {
            newSet.delete(labelName);
            newSet.add(trimmedName);
          }
          return newSet;
        });

        toast.success(`Label renamed to "${trimmedName}"`);
        console.log('✅ Label edited successfully:', response.data);

        // Refresh the data to get updated labels from server
        if (onRefreshData) {
          console.log('🔄 Refreshing data after label edit...');
          onRefreshData();
        }
      } else {
        toast.error(response.error || "Failed to edit label");
        console.error('❌ Failed to edit label:', response.error);
      }
    } catch (error) {
      console.error('🔥 Error editing label:', error);
      toast.error("Network error. Please try again.");
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    const categoryToDelete = categories.find(cat => cat.name === categoryName);
    
    if (!categoryToDelete || !categoryToDelete.id) {
      toast.error("Cannot delete category: ID not found");
      return;
    }

    // Show custom confirmation modal instead of browser confirm
    setDeleteTarget({ name: categoryName, type: 'category' });
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'category') {
        const categoryToDelete = categories.find(cat => cat.name === deleteTarget.name);
        
        if (!categoryToDelete || !categoryToDelete.id) {
          toast.error("Cannot delete category: ID not found");
          return;
        }

        console.log('=== DELETING CATEGORY ===');
        console.log('Category Name:', deleteTarget.name);
        console.log('Category ID:', categoryToDelete.id);
        
        const response = await dashboardAPI.deleteCategory(categoryToDelete.id);
        console.log('Delete Category API Response:', response);
        
        if (response.success) {
          const updatedCategories = categories.filter(cat => cat.name !== deleteTarget.name);
          onCategoriesChange(updatedCategories);
          
          // Remove deleted category from expanded list
          const updatedExpandedCategories = expandedCategories.filter(cat => cat !== deleteTarget.name);
          setExpandedCategories(updatedExpandedCategories);
          
          // Notify parent component about the updated expanded categories
          if (onFilterChange) {
            onFilterChange(updatedExpandedCategories);
          }
          
          toast.success(`Category "${deleteTarget.name}" deleted successfully!`);
          console.log('✅ Category deleted successfully:', response.data);
          
          // Trigger memory counts refresh
          await triggerMemoryCountsRefresh();
          
          // Refresh the data to get updated categories from server
          if (onRefreshData) {
            console.log('🔄 Refreshing data after category deletion...');
            onRefreshData();
          }
        } else {
          toast.error(response.error || "Failed to delete category");
          console.error('❌ Failed to delete category:', response.error);
        }
      } else if (deleteTarget.type === 'label') {
        const labelToDelete = labels.find(label => label.name === deleteTarget.name);
        
        if (!labelToDelete || !labelToDelete.id) {
          toast.error("Cannot delete label: ID not found");
          return;
        }

        console.log('=== DELETING LABEL ===');
        console.log('Label Name:', deleteTarget.name);
        console.log('Label ID:', labelToDelete.id);
        
        const response = await dashboardAPI.deleteLabel(labelToDelete.id);
        console.log('Delete Label API Response:', response);
        
        if (response.success) {
          const updatedLabels = labels.filter(label => label.name !== deleteTarget.name);
          onLabelsChange(updatedLabels);
          
          setExpandedLabels(prev => {
            const newSet = new Set(prev);
            newSet.delete(deleteTarget.name);
            return newSet;
          });
          
          toast.success(`Label "${deleteTarget.name}" deleted successfully!`);
          console.log('✅ Label deleted successfully:', response.data);
          
          // Trigger memory counts refresh
          await triggerMemoryCountsRefresh();
          
          // Refresh the data to get updated categories from server
          if (onRefreshData) {
            console.log('🔄 Refreshing data after label deletion...');
            onRefreshData();
          }
        } else {
          toast.error(response.error || "Failed to delete label");
          console.error('❌ Failed to delete label:', response.error);
        }
      }
    } catch (error) {
      console.error('🔥 Error deleting:', error);
      toast.error("Network error. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteLabel = async (labelName: string) => {
    const labelToDelete = labels.find(label => label.name === labelName);
    
    if (!labelToDelete || !labelToDelete.id) {
      toast.error("Cannot delete label: ID not found");
      return;
    }

    // Show custom confirmation modal instead of browser confirm
    setDeleteTarget({ name: labelName, type: 'label' });
    setShowDeleteDialog(true);
  };

  const handleCategoryKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateCategory();
    } else if (e.key === 'Escape') {
      setNewCategoryName("");
      setShowCategoryPopover(false);
    }
  };

  const handleLabelKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateLabel();
    } else if (e.key === 'Escape') {
      setNewLabelName("");
      setShowLabelPopover(false);
    }
  };

  const handleToggleCategoryExpansion = (categoryName: string) => {
    console.log('🔄 handleToggleCategoryExpansion called for:', categoryName);
    console.log('🔄 Current expandedCategories:', expandedCategories);
    
    const safeExpandedCategories = Array.isArray(expandedCategories) ? expandedCategories : [];
    const isCurrentlyExpanded = safeExpandedCategories.includes(categoryName);
    const newExpandedCategories = isCurrentlyExpanded
      ? safeExpandedCategories.filter(cat => cat !== categoryName)
      : [...safeExpandedCategories, categoryName];
    
    console.log('🔄 isCurrentlyExpanded:', isCurrentlyExpanded);
    console.log('🔄 newExpandedCategories:', newExpandedCategories);
    
    // Update local state immediately to prevent UI lag/desync
    setExpandedCategories(newExpandedCategories);
    
    // Also notify parent component
    if (onFilterChange) {
      onFilterChange(newExpandedCategories);
    }
  };

  const handleCategoryClick = (categoryName: string) => {
    // Only toggle expansion, like MediaNav
    handleToggleCategoryExpansion(categoryName);
  };

  const handleToggleLabelExpansion = (labelName: string) => {
    setExpandedLabels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(labelName)) {
        newSet.delete(labelName);
      } else {
        newSet.add(labelName);
      }
      return newSet;
    });
  };

  const handleLabelClick = (labelName: string) => {
    // Only toggle expansion, like MediaNav
    handleToggleLabelExpansion(labelName);
  };

  const handleToggleMemoryExpansion = (categoryName: string, memoryId: string) => {
    const key = `${categoryName}-${memoryId}`;
    setExpandedMemories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Stacked mode rendering - EXACTLY matching MediaNav structure
  if (isStacked) {
    return (
      <div ref={categoryNavRef} className="h-full flex flex-col bg-white">
        {/* Toggle button at the very top */}
        {canToggle && onToggleExpansion && (
          <div className="flex justify-center p-2 border-b border-gray-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpansion}
              className="h-8 w-8 p-0"
              title="Expand sidebar"
            >
              <Menu className="w-4 h-4" />
            </Button>
          </div>
        )}
        
        <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        
        {/* Tab Icons for Stacked Mode */}
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => setActiveSection("categories")}
            className={`flex flex-col items-center py-2 px-1 transition-all duration-200 rounded-lg group ${
              activeSection === "categories" ? 'bg-[#6C60FF]/10' : ''
            }`}
            title={`Categories (${categories.length} items)`}
          >
            <div className={`w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200 ${
              activeSection === "categories" ? 'bg-[#6C60FF]/20' : 'bg-gray-100'
            }`}>
              <Folder className={`w-4 h-4 ${activeSection === "categories" ? 'text-[#6C60FF]' : 'text-gray-500'}`} />
            </div>
            <span className={`text-xs mt-1 text-center leading-tight transition-colors font-medium ${
              activeSection === "categories" ? 'text-[#6C60FF]' : 'text-gray-600'
            }`}>
              {categories.length}
            </span>
          </button>
          
          <button
            onClick={() => setActiveSection("labels")}
            className={`flex flex-col items-center py-2 px-1 transition-all duration-200 rounded-lg group ${
              activeSection === "labels" ? 'bg-yellow-500/10' : ''
            }`}
            title={`Labels (${labels.length} items)`}
          >
            <div className={`w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200 ${
              activeSection === "labels" ? 'bg-yellow-500/20' : 'bg-gray-100'
            }`}>
              <svg className={`w-4 h-4 ${activeSection === "labels" ? 'text-yellow-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 713 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <span className={`text-xs mt-1 text-center leading-tight transition-colors font-medium ${
              activeSection === "labels" ? 'text-yellow-600' : 'text-gray-600'
            }`}>
              {labels.length}
            </span>
          </button>
        </div>

        {/* Content based on active section */}
        {activeSection === "categories" && (
          <div className="space-y-2">
            
            {categories
              .filter(category => selectedFilter === "all" || category.name === selectedFilter)
              .map((category) => {
                // Check if category should be expanded based on user's manual toggle state
                const isExpanded = Array.isArray(expandedCategories) && expandedCategories.includes(category.name);
                console.log(`🔍 Category ${category.name}: isExpanded=${isExpanded}, expandedCategories:`, expandedCategories);
                const categoryMemories = organizedMemories[category.name] || [];
                
                // Debug: Log category admin_id
                console.log(`Category "${category.name}" admin_id:`, category.admin_id, typeof category.admin_id);
                
                // Always show categories regardless of memory count - this fixes the media page sidebar display issue
                
                return (
                  <div key={category.name} className="flex flex-col items-center">
                    <div
                      className="w-full flex flex-col items-center py-2 px-1 transition-all duration-200 rounded-lg cursor-pointer relative group"
                      style={{
                        backgroundColor: `${getCategoryColor(category.name, categories)}1A`,
                        border: isExpanded ? `1px solid ${getCategoryColor(category.name, categories)}33` : ''
                      }}
                      onMouseEnter={(e) => {
                        if (!isExpanded) {
                          e.currentTarget.style.backgroundColor = `${getCategoryColor(category.name, categories)}26`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isExpanded) {
                          e.currentTarget.style.backgroundColor = `${getCategoryColor(category.name, categories)}1A`;
                        }
                      }}
                      onClick={() => handleCategoryClick(category.name)}
                      title={`${category.name} (${categoryMemories.length} items}`}
                    >
                      <div 
                        className="w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200"
                        style={{
                          backgroundColor: `${getCategoryColor(category.name, categories)}33`,
                          color: getCategoryColor(category.name, categories)
                        }}
                      >
                        {isExpanded ? (
                          <FolderOpen className="w-4 h-4" />
                        ) : (
                          <Folder className="w-4 h-4" />
                        )}
                      </div>
                      <span 
                        className="text-xs mt-1 text-center leading-tight transition-colors font-medium"
                        style={{
                          color: isExpanded ? getCategoryColor(category.name, categories) : ''
                        }}
                      >
                        {categoryMemories.length}
                      </span>
                      {/* Edit button for user-created categories - Only show for property owners */}
                      {/* Hidden when the category is locked (not owner / cannot add story) */}
                      {(category.admin_id !== null && category.admin_id !== undefined && isPropertyOwner) && !(category.is_owner === false || category.can_add_story === false) && (
                        <button
                          onClick={(e) => {
                            console.log('🖊️ Stacked view pencil clicked for:', category.name);
                            e.stopPropagation();
                            handleEditCategoryClick(category.name);
                          }}
                          className="absolute top-1 right-1 p-0.5 rounded hover:bg-gray-200/70 transition-colors opacity-0 group-hover:opacity-100"
                          title={`Edit ${category.name}`}
                          style={{
                            opacity: isExpanded ? 1 : undefined
                          }}
                        >
                          <Pencil className="w-3 h-3 text-gray-500 hover:text-gray-700" />
                        </button>
                      )}
                    </div>

                    {/* Stacked Memories or Empty State when expanded */}
                    {isExpanded && (
                      <div className="mt-2 space-y-1 w-full">
                        {categoryMemories.length > 0 ? (
                          <MemoryTreeView
                            categoryName={category.name}
                            memories={categoryMemories}
                            onToggleExpansion={handleToggleMemoryExpansion}
                            isStacked={true}
                            categoryColor={getCategoryColor(category.name, categories)}
                            onMemorySelect={onMemorySelect}
                            user={user}
                          />
                        ) : (
                          // Empty state for category with no memories
                          <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                              style={{
                                backgroundColor: `${getCategoryColor(category.name, categories)}33`
                              }}
                            >
                              <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{
                                  color: getCategoryColor(category.name, categories)
                                }}
                              >
                                {category.name === 'Shared With' ? (
                                  // Simple users icon for Shared With
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                ) : category.name === 'Published' ? (
                                  // Simple globe icon for Published
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                ) : (
                                  // Default folder icon for other categories
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                )}
                              </svg>
                            </div>
                            <h4 className="text-sm font-medium text-gray-900 mb-1">
                              No {category.name.toLowerCase()} campaigns
                            </h4>
                            <p className="text-xs text-gray-500 leading-relaxed">
                              {category.name === 'Published' ? 'Campaigns you\'ve published publicly will appear here.' :
                               category.name === 'Personal' ? 'Your private campaigns will appear here.' :
                               category.name === 'Shared With' ? 'Campaigns shared with you will appear here.' :
                               `Campaigns in ${category.name} category will appear here.`}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Add Memory Button - Show for all categories except Shared With, Published, Invites, and Suggested */}
                    {/* Shows both when collapsed and expanded (at bottom when expanded) */}
                    {/* Hidden when the category is locked (not owner / cannot add story) */}
                    {onCreateMemory && category.name !== 'Shared With' && category.name !== 'Published' && category.name !== 'Invites' && !category.suggested && !(category.is_owner === false || category.can_add_story === false) && (
                      <div className={`w-full ${isExpanded ? 'mt-2 px-2' : 'mt-2 px-1'}`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (category.is_owner === false || category.can_add_story === false) return;
                            onCreateMemory(category.name);
                          }}
                          disabled={category.is_owner === false || category.can_add_story === false}
                          title={(category.is_owner === false || category.can_add_story === false) ? "You can't add campaigns to this category" : undefined}
                          className="w-full py-1.5 px-2 rounded-lg border-2 bg-white hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 text-xs font-medium disabled:cursor-not-allowed"
                          style={(category.is_owner === false || category.can_add_story === false) ? {
                            backgroundColor: '#F3F4F6',
                            borderColor: '#D1D5DB',
                            color: '#9CA3AF'
                          } : {
                            backgroundColor: `${getCategoryColor(category.name, categories)}0D`,
                            borderColor: getCategoryColor(category.name, categories),
                            color: getCategoryColor(category.name, categories)
                          }}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Campaign
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {activeSection === "labels" && (
          <div className="space-y-2">
            {labels
              .filter(label => selectedFilter === "all" || label.name === selectedFilter)
              .map((label) => {
                // Auto-expand label if it's specifically selected in filter
                const shouldAutoExpand = selectedFilter !== "all" && selectedFilter === label.name;
                const isExpanded = shouldAutoExpand || expandedLabels.has(label.name);
                const labelMemories = organizedLabelMemories[label.name] || [];
                
                return (
                  <div key={label.name} className="flex flex-col items-center">
                    <div
                      className="w-full flex flex-col items-center py-2 px-1 transition-all duration-200 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: '#eab3081A',
                        border: isExpanded ? '1px solid #eab30833' : ''
                      }}
                      onMouseEnter={(e) => {
                        if (!isExpanded) {
                          e.currentTarget.style.backgroundColor = '#eab30826';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isExpanded) {
                          e.currentTarget.style.backgroundColor = '#eab3081A';
                        }
                      }}
                      onClick={() => handleLabelClick(label.name)}
                      title={`${label.name} (${labelMemories.length} items)`}
                    >
                      <div 
                        className="w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200"
                        style={{
                          backgroundColor: '#eab30833',
                          color: '#eab308'
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 713 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <span 
                        className="text-xs mt-1 text-center leading-tight transition-colors font-medium"
                        style={{
                          color: isExpanded ? '#eab308' : ''
                        }}
                      >
                        {labelMemories.length}
                      </span>
                    </div>
                    
                    {/* Stacked Label Memories */}
                    {isExpanded && labelMemories.length > 0 && (
                      <div className="mt-2 space-y-1 w-full">
                        <MemoryTreeView
                          categoryName={label.name}
                          memories={labelMemories}
                          onToggleExpansion={handleToggleMemoryExpansion}
                          isStacked={true}
                          categoryColor="#eab308"
                          isLabel={true}
                          onMemorySelect={onMemorySelect}
                          user={user}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
        </div>
      </div>
    );
  }

  // Expanded mode rendering - EXACTLY matching MediaNav structure
  return (
    <div ref={categoryNavRef} className="h-full flex flex-col bg-white">
      {/* Tab Header with Toggle Button - EXACT MediaNav structure */}
      <div className="flex items-center p-2 border-b border-gray-200 bg-white">
        {/* Toggle Button on the LEFT */}
        {canToggle && onToggleExpansion && (
          <div className="flex-shrink-0 mr-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpansion}
              className="h-7 w-7 p-0"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        )}
        
        <div className="flex space-x-1.5 flex-1 min-w-0">
          <button
            onClick={() => setActiveSection("categories")}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all duration-200 min-w-0 ${
              activeSection === "categories"
                ? 'bg-[#6C60FF]/10 text-[#6C60FF] font-medium'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Folder className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm truncate">Categories</span>
            <span className={`text-xs px-1 py-0.5 rounded-full transition-all duration-200 text-black flex-shrink-0 ${
              activeSection === "categories" ? 'bg-[#6C60FF]/20' : 'bg-gray-200'
            }`}>
              {categories.length}
            </span>
          </button>
          
          <button
            onClick={() => setActiveSection("labels")}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all duration-200 min-w-0 ${
              activeSection === "labels"
                ? 'bg-yellow-500/10 text-yellow-700 font-medium'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 713 12V7a4 4 0 014-4z" />
            </svg>
            <span className="text-sm truncate">Labels</span>
            <span className={`text-xs px-1 py-0.5 rounded-full transition-all duration-200 text-black flex-shrink-0 ${
              activeSection === "labels" ? 'bg-yellow-500/20' : 'bg-gray-200'
            }`}>
              {labels.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === "categories" && (
          <>
            {/* Category Filter and Add Button Section - STICKY */}
            <div className="sticky top-0 z-10 p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-900">Category Filter</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Select value={selectedFilter} onValueChange={(value) => {
                  setSelectedFilter(value);
                  // Communicate category selection to parent for main window filtering
                  if (onCategorySelect) {
                    onCategorySelect(value === "all" ? null : value);
                  }
                }}>
                  <SelectTrigger className="flex-1 h-9 text-sm bg-gray-50 border-gray-200 hover:border-gray-300 focus:bg-gray-50 focus:border-gray-300 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 outline-none">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-lg">
                    <SelectItem value="all" className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 focus:outline-none">All Categories</SelectItem>
                    {showUnassignedInFilter && hasUnassignedItems && (
                      <SelectItem value="Unassigned" className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 focus:outline-none">
                        Unassigned
                      </SelectItem>
                    )}
                    {categories.map((category) => (
                      <SelectItem key={category.name} value={category.name} className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 focus:outline-none">
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Create Category Button - Only show for property owners */}
                {isPropertyOwner && (
                  <Popover open={showCategoryPopover || showEditCategoryPopover} onOpenChange={(open) => {
                    if (!open) {
                      setShowCategoryPopover(false);
                      setShowEditCategoryPopover(false);
                      setEditingCategory(null);
                      setEditCategoryName("");
                      setNewCategoryName("");
                    }
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 text-sm border-[#6C60FF] text-[#6C60FF] hover:bg-[#6C60FF]/10 flex-shrink-0"
                        title="Add new category"
                        onClick={() => {
                          console.log('+ button clicked for create category');
                          // Ensure edit mode is off
                          setShowEditCategoryPopover(false);
                          setEditingCategory(null);
                          setEditCategoryName("");
                          // Open create mode
                          setShowCategoryPopover(true);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-auto border-0 shadow-lg rounded-xl overflow-hidden" align="end">
                      <AddCategoryPopover
                        value={showEditCategoryPopover ? editCategoryName : newCategoryName}
                        onChange={showEditCategoryPopover ? setEditCategoryName : setNewCategoryName}
                        onSave={showEditCategoryPopover ? handleEditCategory : handleCreateCategory}
                        onCancel={() => {
                          if (showEditCategoryPopover) {
                            setEditingCategory(null);
                            setEditCategoryName("");
                            setShowEditCategoryPopover(false);
                          } else {
                            setNewCategoryName("");
                            setShowCategoryPopover(false);
                          }
                        }}
                        onKeyPress={showEditCategoryPopover ? (e: React.KeyboardEvent) => {
                          if (e.key === 'Enter') {
                            handleEditCategory();
                          } else if (e.key === 'Escape') {
                            setEditingCategory(null);
                            setEditCategoryName("");
                            setShowEditCategoryPopover(false);
                          }
                        } : handleCategoryKeyPress}
                        existingCategories={showEditCategoryPopover ? categories.filter(cat => cat.id !== editingCategory?.id) : categories}
                        title={showEditCategoryPopover ? "Edit Category" : "New Category"}
                        buttonText={showEditCategoryPopover ? "Edit" : "Create"}
                      />
                    </PopoverContent>
                  </Popover>
                )}

              </div>
            </div>

            <div className="p-4 space-y-3">
              
              {/* Regular Categories */}
              {categories
                .filter(category => selectedFilter === "all" || category.name === selectedFilter)
                .map((category) => {
                  // Check if category should be expanded based on user's manual toggle state
                  const isExpanded = Array.isArray(expandedCategories) && expandedCategories.includes(category.name);
                  const categoryMemories = organizedMemories[category.name] || [];
                  // Use local memory count for display, only use category.count for delete logic if it's a newly created category
                  const actualMemoryCount = categoryMemories.length;
                  
                  // Debug: Log category admin_id for non-stacked view
                  console.log(`Non-stacked Category "${category.name}" admin_id:`, category.admin_id, typeof category.admin_id, 'id:', category.id);
                  // Debug: Add Campaign gating — verify is_owner / can_add_story values at runtime
                  console.log(`🛑 AddCampaign gate "${category.name}": is_owner=${category.is_owner} (${typeof category.is_owner}), can_add_story=${category.can_add_story} (${typeof category.can_add_story}) -> disabled=${category.is_owner === false || category.can_add_story === false}`);
                  
                  // Always show categories regardless of memory count - this fixes the media page sidebar display issue
                  return (
                    <EditableCategoryCard
                      key={category.name}
                      name={category.name}
                      count={actualMemoryCount}
                      isActive={selectedCategory === category.name || isExpanded}
                      onClick={() => handleCategoryClick(category.name)}
                      hasMemories={categoryMemories.length > 0}
                      onDelete={category.admin_id !== null && actualMemoryCount === 0 && isPropertyOwner ? handleDeleteCategory : undefined}
                      onEdit={isPropertyOwner ? (newName: string) => handleInlineEditCategory(category.name, newName) : undefined}
                      isUserCreated={category.isUserCreated}
                      admin_id={category.admin_id}
                      categories={categories}
                      categoryId={category.id}
                      suggested={category.suggested || false}
                      onCreateMemory={onCreateMemory}
                      isOwner={category.is_owner}
                      canAddStory={category.can_add_story}
                    >
                      <MemoryTreeView
                        categoryName={category.name}
                        memories={categoryMemories}
                        onToggleExpansion={handleToggleMemoryExpansion}
                        isStacked={false}
                        categoryColor={getCategoryColor(category.name, categories)}
                        onMemorySelect={onMemorySelect}
                        user={user}
                      />
                    </EditableCategoryCard>
                  );
                })}

              {/* Read-only Shopify catalog box — self-contained, only renders when a
                  Shopify store is connected. Collection = campaign, product = moment. */}
              {selectedFilter === "all" && (
                <ShopifyCatalogNav
                  onCollectionSelect={(collectionId) =>
                    onMemorySelect?.(`shopify_collection:${collectionId}`)
                  }
                />
              )}

              {/* Read-only Cars catalog box — self-contained, flat inventory feed from GET /cars. */}
              {selectedFilter === "all" && <CarsCatalogNav />}
            </div>
          </>
        )}

        {activeSection === "labels" && (
          <>
            {/* Label Filter and Add Button Section - STICKY */}
            <div className="sticky top-0 z-10 p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-900">Label Filter</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Select value={selectedFilter} onValueChange={(value) => {
                  setSelectedFilter(value);
                  // Communicate label selection to parent for main window filtering
                  if (onCategorySelect) {
                    onCategorySelect(value === "all" ? null : value);
                  }
                }}>
                  <SelectTrigger className="flex-1 h-9 text-sm bg-gray-50 border-gray-200 hover:border-gray-300 focus:bg-gray-50 focus:border-gray-300 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 outline-none">
                    <SelectValue placeholder="Select a label" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-lg">
                    <SelectItem value="all" className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 focus:outline-none">All Labels</SelectItem>
                    {labels.map((label) => (
                      <SelectItem key={label.name} value={label.name} className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 focus:outline-none">
                        {label.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Add Label Button - Only show for property owners */}
                {isPropertyOwner && (
                  <Popover open={showLabelPopover} onOpenChange={setShowLabelPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 text-sm border-[#6C60FF] text-[#6C60FF] hover:bg-[#6C60FF]/10 flex-shrink-0"
                        title="Add new label"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-auto border-0 shadow-lg rounded-xl overflow-hidden" align="end">
                      <AddLabelPopover
                        value={newLabelName}
                        onChange={setNewLabelName}
                        onSave={handleCreateLabel}
                        onCancel={() => {
                          setNewLabelName("");
                          setShowLabelPopover(false);
                        }}
                        onKeyPress={handleLabelKeyPress}
                        existingLabels={labels}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Labels */}
              {labels
                .filter(label => selectedFilter === "all" || label.name === selectedFilter)
                .map((label) => {
                  // Auto-expand label if it's specifically selected in filter
                  const shouldAutoExpand = selectedFilter !== "all" && selectedFilter === label.name;
                  const isExpanded = shouldAutoExpand || expandedLabels.has(label.name);
                  const labelMemories = organizedLabelMemories[label.name] || [];
                  // Use local memory count for display
                  const actualLabelMemoryCount = labelMemories.length;

                  console.log(`🏷️ Label "${label.name}": API count=${label.count}, actual count=${actualLabelMemoryCount}, admin_id=${label.admin_id}`);

                  return (
                    <EditableCategoryCard
                      key={label.name}
                      name={label.name}
                      count={actualLabelMemoryCount}
                      isActive={selectedCategory === label.name || isExpanded}
                      onClick={() => handleLabelClick(label.name)}
                      hasMemories={labelMemories.length > 0}
                      onDelete={label.admin_id !== null && actualLabelMemoryCount === 0 && isPropertyOwner ? handleDeleteLabel : undefined}
                      onEdit={label.admin_id !== null && isPropertyOwner ? (newName: string) => handleInlineEditLabel(label.name, newName) : undefined}
                      isUserCreated={label.isUserCreated}
                      admin_id={label.admin_id}
                      categories={categories}
                      isLabel={true}
                    >
                      <MemoryTreeView
                        categoryName={label.name}
                        memories={labelMemories}
                        onToggleExpansion={handleToggleMemoryExpansion}
                        isStacked={false}
                        isLabel={true}
                        categoryColor="#eab308"
                        onMemorySelect={onMemorySelect}
                      />
                    </EditableCategoryCard>
                  );
                })}
            </div>
          </>
        )}
      </div>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-white border-0">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === 'category' ? 'Category' : 'Label'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the {deleteTarget?.type === 'category' ? 'category' : 'label'} "{deleteTarget?.name}"? This action cannot be undone.
              <br /><br />
              <strong>
                {deleteTarget?.type === 'category' ? 'Category' : 'Label'} to delete: {deleteTarget?.name}
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}