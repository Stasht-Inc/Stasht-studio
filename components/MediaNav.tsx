import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

// Basic debug log to confirm this file loads
console.log('🚀 MediaNav.tsx file loaded at:', new Date().toISOString());
import { Plus, Filter, ChevronLeft, Folder, FolderOpen, Menu, ChevronRight, Image, Upload, HardDrive, Users, Globe, Lock, Archive, UserCheck, ChevronDown, Check, Pencil } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import ImageHoverPopover from "./ImageHoverPopover";
import { useAuth } from "../contexts/AuthContext";

import UploadProgress, { UploadProgressItem } from "./UploadProgress";
import { compressImage, processVideo, formatFileSize, generateFileId, isSupportedFileType, getFileCategory } from "../utils/fileProcessing";
import { getCategoryColor } from "../constants/mediaConstants";
import { dashboardAPI, userDisplayUtils } from "../utils/authUtils";
import { recheckMemoryLimit } from "../hooks/useMemoryLimit";
import { updateCategoryColor } from "../utils/categoryColorManager";
import AddMediaToMemoryModal from "./AddMediaToMemoryModal";
import { mapLimit, uploadLimit } from "../utils/requestLimit";

interface MediaImage {
  id: string;
  name: string;
  thumbnail: string;
  date: string;
  size: string;
  type: 'image' | 'video';
  dimensions?: string;
  parent_id?: string | number | null;
  subImages?: MediaImage[];
}

interface MediaMemory {
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

interface MediaCategory {
  id?: string | number | null;
  name: string;
  count: number;
  memories: MediaMemory[];
  isExpanded?: boolean;
  admin_id?: string | number | null;
}

interface MediaNavProps {
  isStacked?: boolean;
  onToggleExpansion?: () => void;
  canToggle?: boolean;
  onFilterChange?: (expandedCategories: string[]) => void;
  expandedCategories?: string[];
  selectedCategory?: string | null;
  onCategorySelect?: (categoryName: string | null) => void;
  mediaMemories?: MediaMemory[];
  onMediaMemoriesChange?: (memories: MediaMemory[]) => void;
  unassignedImages?: MediaImage[];
  onUnassignedImagesChange?: (images: MediaImage[]) => void;
  showUnassignedImages?: boolean;
  onUnassignedToggle?: (show: boolean) => void;
  categories?: any[];
  selectedMediaItems?: string[];
  onMediaItemSelect?: (itemId: string, selected: boolean) => void;
  apiMediaNavData?: any[];
  onUploadStateChange?: (isUploading: boolean) => void;
  onUploadProgressChange?: (progress: any[]) => void;
  highlightedImageId?: string; // Image currently open in modal
  onMemorySelect?: (memoryId: string, shouldOpenAddModal?: boolean) => void;
  onImageClick?: (src: string, alt: string, title?: string, subtitle?: string, imageId?: string) => void;
  apiMemoriesData?: any; // Add memories API data for categories
  onCategoriesUpdate?: () => void; // Callback to notify parent to refresh categories data
  onFetchMediaData?: () => void | Promise<void>; // Callback to refresh main media grid
  onCategoryRenamed?: (oldName: string, newName: string) => void; // Callback when category is renamed
  activeServiceTab?: string; // Current active service tab ('all', or service ID)
  serviceSyncedMedia?: any; // Synced media data from services
  connectedServices?: any[]; // List of connected services
  dropboxSyncProgress?: number; // Dropbox sync progress (0-100)
  showDropboxProgress?: boolean; // Whether to show Dropbox sync progress bar
  onViewDropboxResult?: () => void; // Callback to switch to Dropbox tab after sync
  onFilesUpload?: (files: File[]) => Promise<void>; // Parallel upload handler from parent
  isPropertyOwner?: boolean; // Whether user is property owner (admin) or visitor (read-only)
}

// Special Empty State Component for Shared With, Published, Personal, and new categories
function SpecialEmptyState({ categoryName }: { categoryName: string }) {
  const getEmptyStateConfig = (category: string) => {
    switch (category) {
      case 'Personal':
        return {
          centerIcon: <Folder className="w-8 h-8" style={{ color: '#6C60FF' }} />,
          title: 'No personal campaigns',
          description: 'Your personal campaigns will appear here.',
          centerIconBgColor: '#6C60FF1A', // Very light purple background (10% opacity)
          bgColor: 'transparent', // Transparent background
        };
      case 'new':
        return {
          centerIcon: <Folder className="w-8 h-8" style={{ color: '#6C60FF' }} />,
          title: 'No new campaigns',
          description: 'Your new campaigns will appear here.',
          centerIconBgColor: '#6C60FF1A', // Light purple background (10% opacity) 
          bgColor: 'transparent', // Transparent background
        };
      case 'Shared With':
        return {
          centerIcon: <Users className="w-8 h-8 text-orange-400" />,
          title: 'No shared campaigns',
          description: 'Campaigns shared with you by others will appear here.',
          centerIconBgColor: '#FED7AA', // Orange circle
          bgColor: 'transparent', // Transparent background
        };
      case 'Published':
        return {
          centerIcon: (
            <div className="relative">
              <Globe className="w-8 h-8 text-purple-600" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 flex items-center justify-center">
                  <div className="absolute w-2 h-[1px] bg-purple-600"></div>
                  <div className="absolute w-[1px] h-2 bg-purple-600"></div>
                </div>
              </div>
            </div>
          ),
          title: 'No published campaigns',
          description: 'Campaigns you\'ve published publicly will appear here.',
          centerIconBgColor: '#E9D5FF', // Light teal circle
          bgColor: 'transparent', // Transparent background
        };
      default:
        return null;
    }
  };

  const config = getEmptyStateConfig(categoryName);
  if (!config) return null;

  return (
    <div 
      className="px-6 py-8 text-center rounded-lg"
      style={{ backgroundColor: config.bgColor }}
    >
      <div className="flex flex-col items-center space-y-4">
        <div 
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: config.centerIconBgColor }}
        >
          {config.centerIcon}
        </div>
        <div>
          <h3 className="text-base font-medium text-gray-900 mb-2 whitespace-nowrap">
            {config.title}
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed max-w-[200px]">
            {config.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// User Fallback Avatar Component for when no media images are available
function UserFallbackAvatar({ 
  user, 
  size = 'w-8 h-8', 
  className = '',
  fillContainer = false 
}: { 
  user?: { name?: string; avatar?: string; profile_color?: string };
  size?: string;
  className?: string;
  fillContainer?: boolean; // When true, fills the entire parent container
}) {
  const initials = userDisplayUtils.generateInitials(user?.name || '');
  const profileColor = userDisplayUtils.formatProfileColor(user?.profile_color);
  
  // Use profile_color if available, otherwise use default gradient (matching header)
  const backgroundStyle = profileColor 
    ? { backgroundColor: profileColor }
    : undefined;
  
  // Choose size classes based on fillContainer prop
  const sizeClasses = fillContainer ? 'w-full h-full' : size;
  const roundingClasses = fillContainer ? '' : 'rounded-full'; // Parent container handles rounding when filling
  
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
  
  // Fallback to generic user icon if no name available
  return (
    <div className={`${sizeClasses} ${roundingClasses} bg-gray-200 flex items-center justify-center flex-shrink-0 ${className}`}>
      <Users className="w-4 h-4 text-gray-400" />
    </div>
  );
}

// Category icon mapping
const getCategoryIcon = (category: string) => {
  const iconMap: { [key: string]: any } = {
    'Unassigned': HardDrive,
    'Personal': Lock,
    'Shared With': Users,
    'Published': Globe,
  };
  
  return iconMap[category] || FolderOpen;
};

// Individual Image Item Component
function ImageTreeItem({
  image,
  categoryColor = '#6C60FF',
  isSelected = false,
  onToggleSelection,
  highlightedImageId,
  user,
  onImageClick,
  depth = 0,
  selectedMediaItems = []
}: {
  image: MediaImage & { subImages?: any[] };
  categoryColor?: string;
  isSelected?: boolean;
  onToggleSelection?: (imageId: string) => void;
  highlightedImageId?: string;
  user?: { name?: string; avatar?: string; profile_color?: string };
  onImageClick?: (src: string, alt: string, title?: string, subtitle?: string, imageId?: string) => void;
  depth?: number;
  selectedMediaItems?: string[];
}) {
  const [isExpanded, setIsExpanded] = useState(true); // Expand by default
  const hasSubImages = image.subImages && image.subImages.length > 0;

  const handleItemClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Image clicked:', image.id);
    if (onImageClick) {
      onImageClick(image.thumbnail, image.name, image.name, undefined, image.id);
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const isHighlighted = highlightedImageId === image.id;
  const paddingLeft = depth === 0 ? 'pl-6' : 'pl-12';

  return (
    <>
      <div
        className={`${paddingLeft} pr-2 flex items-center gap-2 py-2 rounded-lg transition-all duration-200 group w-full relative cursor-pointer overflow-hidden ${
          isHighlighted ? 'pl-4' : ''
        }`}
        style={{
          backgroundColor: isHighlighted ? `${categoryColor}1A` : '',
          borderLeft: isHighlighted ? `2px solid ${categoryColor}` : '',
        }}
        onMouseEnter={(e) => {
          if (!isHighlighted) {
            const target = e.currentTarget;
            target.style.backgroundColor = `${categoryColor}1A`;
          }
        }}
        onMouseLeave={(e) => {
          if (!isHighlighted) {
            const target = e.currentTarget;
            target.style.backgroundColor = isSelected ? `${categoryColor}1A` : '';
          }
        }}
        onClick={handleItemClick}
      >
        {/* Selection checkbox */}
        {onToggleSelection && (
          <input
            type="checkbox"
            checked={isSelected}
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleSelection) {
                onToggleSelection(image.id);
              }
            }}
            onChange={() => {}} // Controlled component, handle state in onClick
            className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-600/20 shadow-sm"
            title={isSelected ? 'Deselect image' : 'Select image'}
          />
        )}

        {/* Chevron or Tree connector line - Always show if has sub-images */}
        {hasSubImages ? (
          <button
            onClick={handleChevronClick}
            className="w-4 h-4 flex items-center justify-center text-gray-500 transition-colors rounded hover:bg-gray-100"
            style={{ zIndex: 10 }}
          >
            {isExpanded
              ? <ChevronDown className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3" />
            }
          </button>
        ) : !onToggleSelection ? (
          <div className="w-4 h-4 flex items-center justify-center">
            <div
              className="w-3 h-0.5 bg-gray-300 transition-colors rounded-sm"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${categoryColor}80`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#d1d5db';
              }}
            />
          </div>
        ) : null}

        {/* Small thumbnail */}
        <ImageHoverPopover src={image.thumbnail} alt={image.name}>
          <div
            className={`w-8 h-8 rounded-md overflow-hidden bg-gray-100 flex-shrink-0 transition-all duration-200 relative ${
              isHighlighted ? 'ring-2 ring-blue-400' : ''
            }`}
            onMouseEnter={(e) => {
              if (!isHighlighted) {
                e.currentTarget.style.boxShadow = `inset 0 0 0 2px ${categoryColor}80`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isHighlighted) {
                e.currentTarget.style.boxShadow = '';
              }
            }}
          >
            <img
              src={image.thumbnail}
              alt={image.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="w-full h-full" style={{display: 'none'}}>
              <UserFallbackAvatar user={user} fillContainer={true} />
            </div>
          </div>
        </ImageHoverPopover>

        {/* Image details */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate transition-colors ${
            isHighlighted
              ? 'text-blue-700 font-semibold'
              : 'text-gray-700 font-medium'
          }`}>
            {image.name}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500 group-hover:text-gray-600 transition-colors">
            <span>{new Date(image.date).toLocaleDateString()}</span>
            {image.type === 'video' && (
              <>
                <span>•</span>
                <Badge variant="secondary" className="text-xs px-1 py-0">Video</Badge>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Render sub-images when expanded */}
      {hasSubImages && isExpanded && (
        <div className="space-y-1">
          {image.subImages!.map((subImage: any) => (
            <ImageTreeItem
              key={subImage.id}
              image={subImage}
              categoryColor={categoryColor}
              isSelected={selectedMediaItems.includes(subImage.id)}
              onToggleSelection={onToggleSelection}
              highlightedImageId={highlightedImageId}
              user={user}
              onImageClick={onImageClick}
              depth={depth + 1}
              selectedMediaItems={selectedMediaItems}
            />
          ))}
        </div>
      )}
    </>
  );
}

// Memory Tree Item Component
function MemoryTreeItem({ 
  memory, 
  categoryName,
  categoryColor = '#6C60FF',
  onToggleExpansion,
  selectedMediaItems = [],
  onMediaItemSelect,
  highlightedImageId,
  user,
  onImageClick,
  onMemorySelect
}: { 
  memory: MediaMemory; 
  categoryName: string;
  categoryColor?: string;
  onToggleExpansion: (categoryName: string, memoryId: string) => void;
  selectedMediaItems?: string[];
  onMediaItemSelect?: (itemId: string, selected: boolean) => void;
  highlightedImageId?: string;
  user?: { name?: string; avatar?: string; profile_color?: string };
  onImageClick?: (src: string, alt: string, title?: string, subtitle?: string, imageId?: string) => void;
  onMemorySelect?: (memoryId: string, shouldOpenAddModal?: boolean) => void;
}) {
  const hasImages = memory.images && memory.images.length > 0;
  
  const handleChevronClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleExpansion(categoryName, memory.id);
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Check if we have a memory select handler (for navigation)
    if (onMemorySelect) {
      onMemorySelect(memory.id);
    } else {
      // Fallback to expansion toggle
      onToggleExpansion(categoryName, memory.id);
    }
  };
  
  return (
    <div>
      <div className="flex items-center gap-2 p-2 rounded-lg transition-all duration-200">
        {/* Expand/collapse chevron for memories with images */}
        {hasImages ? (
          <button
            onClick={handleChevronClick}
            className="w-4 h-4 flex items-center justify-center text-gray-500 transition-colors rounded hover:bg-gray-100"
            style={{
              zIndex: 10
            }}
            title={`${memory.isExpanded ? 'Collapse' : 'Expand'} images`}
          >
            <ChevronRight 
              className={`w-3 h-3 transition-transform duration-200 ${
                memory.isExpanded ? 'rotate-90' : ''
              }`} 
              style={{
                color: memory.isExpanded ? categoryColor : ''
              }}
            />
          </button>
        ) : (
          <div className="w-4 h-4" />
        )}
        
        {/* Thumbnail */}
        <ImageHoverPopover src={memory.thumbnail} alt={memory.title}>
          <div 
            className="w-10 h-10 rounded-md overflow-hidden bg-gray-100 flex-shrink-0 transition-all duration-200"
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 2px ${categoryColor}33`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <img
              src={memory.thumbnail}
              alt={memory.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="w-full h-full" style={{display: 'none'}}>
              <UserFallbackAvatar user={user} fillContainer={true} />
            </div>
          </div>
        </ImageHoverPopover>
        
        {/* Memory details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              {/* Memory title with hover underline */}
              <button
                onClick={handleTitleClick}
                className="text-sm font-medium text-gray-900 truncate w-full text-left transition-all duration-200 hover:underline hover:decoration-2 hover:underline-offset-2 hover:decoration-current"
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
              
              {/* Special layout for "Shared with" category */}
              {categoryName === "Shared with" ? (
                <div className="mt-1 space-y-0.5">
                  <div className="flex items-center">
                    <div className="bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
                      <div className="text-gray-600 text-[12px] font-medium">
                        {memory.images?.length || 0} image{(memory.images?.length || 0) !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Standard layout for other categories */
                <div className="flex items-center gap-2 mt-1">
                  <div className="bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
                    <div className="text-gray-600 text-[12px] font-medium">
                      {memory.images?.length || 0} item{(memory.images?.length || 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Individual Images */}
      {hasImages && memory.isExpanded && (
        <div className="mt-1 space-y-1">
          {memory.images!.map((image) => (
            <ImageTreeItem
              key={image.id}
              image={image}
              categoryColor={categoryColor}
              isSelected={selectedMediaItems?.includes(image.id)}
              onToggleSelection={onMediaItemSelect ? (imageId: string) => {
                const isCurrentlySelected = selectedMediaItems?.includes(imageId) || false;
                onMediaItemSelect(imageId, !isCurrentlySelected);
              } : undefined}
              highlightedImageId={highlightedImageId}
              user={user}
              onImageClick={onImageClick}
              selectedMediaItems={selectedMediaItems || []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Memory Tree View Component
function MemoryTreeView({ 
  categoryName, 
  memories, 
  onToggleExpansion,
  isStacked = false,
  categoryColor = '#6C60FF',
  categories,
  selectedMediaItems = [],
  onMediaItemSelect,
  highlightedImageId,
  user,
  onImageClick,
  onMemorySelect
}: { 
  categoryName: string; 
  memories: MediaMemory[];
  onToggleExpansion: (categoryName: string, memoryId: string) => void;
  isStacked?: boolean;
  categoryColor?: string;
  categories?: any[];
  selectedMediaItems?: string[];
  onMediaItemSelect?: (itemId: string, selected: boolean) => void;
  highlightedImageId?: string;
  user?: { name?: string; avatar?: string; profile_color?: string };
  onImageClick?: (src: string, alt: string, title?: string, subtitle?: string, imageId?: string) => void;
  onMemorySelect?: (memoryId: string, shouldOpenAddModal?: boolean) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const finalCategoryColor = categoryColor !== '#6C60FF' ? categoryColor : getCategoryColor(categoryName, categories);

  if (isStacked) {
    return (
      <div className="space-y-2">
        {memories.map((memory) => {
          const handleStackedClick = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            // Check if we have a memory select handler (for navigation)
            if (onMemorySelect) {
              onMemorySelect(memory.id);
            } else {
              // Fallback to expansion toggle
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
                title={`${memory.title} (${memory.images?.length || 0} images)`}
              >
                <ImageHoverPopover src={memory.thumbnail} alt={memory.title}>
                  <div 
                    className="w-8 h-8 rounded-md overflow-hidden bg-gray-100 transition-all duration-200"
                    style={{
                      boxShadow: memory.isExpanded ? `0 0 0 2px ${finalCategoryColor}4D` : ''
                    }}
                  >
                    <img
                      src={memory.thumbnail}
                      alt={memory.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="w-full h-full" style={{display: 'none'}}>
                      <UserFallbackAvatar user={user} fillContainer={true} />
                    </div>
                  </div>
                </ImageHoverPopover>
                <span 
                  className="text-xs mt-1 text-center leading-tight transition-colors font-medium"
                  style={{
                    color: memory.isExpanded ? finalCategoryColor : ''
                  }}
                >
                  {memory.images?.length || 0}
                </span>
              </button>
              
              {/* Expanded images in stacked mode */}
              {memory.isExpanded && memory.images && (
                <div className="mt-2 space-y-1 pl-1">
                  {memory.images.slice(0, 3).map((image) => (
                    <button
                      key={image.id}
                      className={`flex items-center gap-1 p-1 rounded transition-all duration-200 group w-full text-left ${
                        highlightedImageId === image.id 
                          ? 'pl-2 font-medium' 
                          : ''
                      }`}
                      style={{
                        backgroundColor: highlightedImageId === image.id ? `${finalCategoryColor}1A` : '',
                        borderLeft: highlightedImageId === image.id ? `2px solid ${finalCategoryColor}` : '',
                      }}
                      title={image.name}
                      onMouseEnter={(e) => {
                        if (highlightedImageId !== image.id) {
                          e.currentTarget.style.backgroundColor = `${finalCategoryColor}1A`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (highlightedImageId !== image.id) {
                          e.currentTarget.style.backgroundColor = '';
                        }
                      }}
                    >
                      <ImageHoverPopover src={image.thumbnail} alt={image.name}>
                        <div 
                          className={`w-4 h-4 rounded overflow-hidden bg-gray-100 flex-shrink-0 ${
                            highlightedImageId === image.id ? 'ring-2' : ''
                          }`}
                          style={{
                            '--tw-ring-color': highlightedImageId === image.id ? finalCategoryColor : '',
                          } as React.CSSProperties}
                        >
                          <img
                            src={image.thumbnail}
                            alt={image.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center" style={{display: 'none'}}>
                            <Image className="w-2 h-2 text-gray-400" />
                          </div>
                        </div>
                      </ImageHoverPopover>
                      <span 
                        className={`text-xs transition-colors truncate ${
                          highlightedImageId === image.id 
                            ? 'font-medium' 
                            : 'text-gray-600'
                        }`}
                        style={{
                          color: highlightedImageId === image.id ? finalCategoryColor : '',
                        }}
                      >
                        {image.name}
                      </span>
                    </button>
                  ))}
                  {memory.images.length > 3 && (
                    <div className="text-xs text-gray-500 text-center py-1">
                      +{memory.images.length - 3} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  
  const displayedMemories = isExpanded ? memories : memories.slice(0, 3);
  
  return (
    <div className="space-y-1">
      {displayedMemories.map((memory) => (
        <MemoryTreeItem
          key={memory.id}
          memory={memory}
          categoryName={categoryName}
          categoryColor={finalCategoryColor}
          onToggleExpansion={onToggleExpansion}
          selectedMediaItems={selectedMediaItems}
          onMediaItemSelect={onMediaItemSelect}
          highlightedImageId={highlightedImageId}
          user={user}
          onImageClick={onImageClick}
          onMemorySelect={onMemorySelect}
        />
      ))}
      {memories.length > 3 && (
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-xs text-gray-500 hover:text-gray-700 transition-colors text-center py-2 w-full hover:bg-gray-50 rounded cursor-pointer"
        >
          {isExpanded 
            ? 'Show less'
            : `+${memories.length - 3} more campaigns`
          }
        </button>
      )}
    </div>
  );
}

// Unassigned Images Display Component
function UnassignedImagesView({ 
  images,
  categoryColor = '#9CA3AF',
  isStacked = false,
  selectedItems = [],
  onToggleSelection,
  highlightedImageId,
  user,
  onImageClick
}: { 
  images: MediaImage[];
  categoryColor?: string;
  isStacked?: boolean;
  selectedItems?: string[];
  onToggleSelection?: (imageId: string) => void;
  highlightedImageId?: string;
  user?: { name?: string; avatar?: string; profile_color?: string };
  onImageClick?: (src: string, alt: string, title?: string, subtitle?: string, imageId?: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (isStacked) {
    return (
      <div className="space-y-2 overflow-hidden">
        {images.map((image) => {
          const isImageSelected = selectedItems.includes(image.id);
          const isHighlighted = highlightedImageId === image.id;
          
          return (
            <div
              key={image.id}
              className={`relative flex flex-col items-center py-2 px-1 transition-all duration-200 rounded-lg group w-full cursor-pointer overflow-hidden`}
              style={{
                backgroundColor: isHighlighted ? `${categoryColor}1A` : '',
                borderLeft: isHighlighted ? `2px solid ${categoryColor}` : '',
              }}
              onMouseEnter={(e) => {
                if (!isHighlighted) {
                  e.currentTarget.style.backgroundColor = `${categoryColor}1A`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isHighlighted) {
                  e.currentTarget.style.backgroundColor = isImageSelected ? `${categoryColor}1A` : '';
                }
              }}
              title={`${image.name} (${image.size})`}
            >
              <ImageHoverPopover src={image.thumbnail} alt={image.name}>
                <div 
                  className={`w-8 h-8 rounded-md overflow-hidden bg-gray-100 transition-all duration-200 relative ${
                    isHighlighted ? 'ring-2 ring-blue-400' : ''
                  }`}
                  onMouseEnter={(e) => {
                    if (!isHighlighted) {
                      e.currentTarget.style.boxShadow = `inset 0 0 0 2px ${categoryColor}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isHighlighted) {
                      e.currentTarget.style.boxShadow = '';
                    }
                  }}
                >
                  <img
                    src={image.thumbnail}
                    alt={image.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="w-full h-full" style={{display: 'none'}}>
                    <UserFallbackAvatar user={user} fillContainer={true} />
                  </div>
                </div>
              </ImageHoverPopover>
              <span 
                className={`text-xs mt-1 text-center leading-tight transition-colors ${
                  isHighlighted 
                    ? 'text-blue-700 font-semibold' 
                    : 'font-medium text-gray-600'
                }`}
              >
                {image.type === 'video' ? 'Video' : 'Photo'}
              </span>
              
              {/* Selection checkbox for stacked mode */}
              {onToggleSelection && (
                <input
                  type="checkbox"
                  checked={isImageSelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelection(image.id);
                  }}
                  onChange={() => {}} // Controlled component, handle state in onClick
                  className="absolute top-1 right-1 w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-600/20 shadow-sm"
                  title={isImageSelected ? 'Deselect image' : 'Select image'}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }
  
  const displayedImages = isExpanded ? images : images.slice(0, 3);
  
  return (
    <div className="space-y-1 overflow-hidden relative">
      {displayedImages.map((image) => (
        <ImageTreeItem
          key={image.id}
          image={image}
          categoryColor={categoryColor}
          isSelected={selectedItems.includes(image.id)}
          onToggleSelection={onToggleSelection}
          highlightedImageId={highlightedImageId}
          user={user}
          onImageClick={onImageClick}
          selectedMediaItems={selectedItems}
        />
      ))}
      {images.length > 3 && (
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-xs text-gray-500 hover:text-gray-700 transition-colors text-center py-2 w-full hover:bg-gray-50 rounded cursor-pointer"
        >
          {isExpanded 
            ? 'Show less'
            : `+${images.length - 3} more items`
          }
        </button>
      )}
    </div>
  );
}

// Category Card Component
function CategoryCard({ 
  id,
  name, 
  count, 
  isActive = false, 
  onClick, 
  hasMemories = false, 
  children,
  categories,
  onRightClick,
  onEdit,
  admin_id = null,
  onCategoriesChange,
  handleInlineEditCategory
}: { 
  id?: string;
  name: string; 
  count: number; 
  isActive?: boolean; 
  onClick?: () => void; 
  hasMemories?: boolean; 
  children?: React.ReactNode;
  categories?: any[];
  onRightClick?: () => void;
  onEdit?: (newName: string) => void;
  admin_id?: string | number | null;
  onCategoriesChange?: (categories: any[]) => void;
  handleInlineEditCategory?: (categoryId: string, oldName: string, newName: string) => Promise<void>;
}) {
  const categoryColor = getCategoryColor(name, categories);
  
  
  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const isHandlingBlur = useRef(false);
  
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
      const handleDocumentClick = (event: MouseEvent) => {
        if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
          if (!isHandlingBlur.current) {
            isHandlingBlur.current = true;
            setTimeout(() => {
              setIsEditing(false);
              setEditValue(name); // Reset to original name on outside click
              isHandlingBlur.current = false;
            }, 0);
          }
        }
      };

      document.addEventListener('click', handleDocumentClick);
      return () => document.removeEventListener('click', handleDocumentClick);
    }
  }, [isEditing, name]);
  
  
  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🖊️ MediaNav Edit button clicked for category:', name);
    setIsEditing(true);
    setEditValue(name);
  };
  
  const handleSaveEdit = async () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== name) {
      // Debug: Check what ID we have
      console.log('🔍 CategoryCard handleSaveEdit debug:', { 
        id, 
        name, 
        idType: typeof id, 
        hasId: id !== null && id !== undefined 
      });
      
      // Use category ID - if no ID available, this is an error
      if (!id) {
        console.error('❌ MediaNav: No category ID available for editing!', { name });
        alert('Cannot edit category: No category ID available');
        return;
      }
      
      if (handleInlineEditCategory) {
        await handleInlineEditCategory(id, name, trimmedValue);
      } else {
        console.error('❌ MediaNav: No handleInlineEditCategory function provided');
      }
    }
    setIsEditing(false);
  };
  
  const handleCancelEdit = () => {
    setEditValue(name);
    setIsEditing(false);
  };
  
  const handleBlur = () => {
    if (!isHandlingBlur.current) {
      isHandlingBlur.current = true;
      setTimeout(() => {
        if (editValue.trim() && editValue.trim() !== name) {
          handleSaveEdit();
        } else {
          handleCancelEdit();
        }
        isHandlingBlur.current = false;
      }, 150);
    }
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

  const handleCategoryClick = (e: React.MouseEvent) => {
    // Only trigger onClick if the click is not on a checkbox or other interactive element
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('input[type="checkbox"]')) {
      return;
    }
    // Don't trigger if clicking on a button inside the category (like "show more" buttons)
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    if (onClick) {
      onClick();
    }
  };

  return (
    <div 
      className={`group w-full rounded-lg transition-all duration-200 ${isEditing ? 'cursor-default' : 'cursor-pointer'} relative`}
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
      onClick={isEditing ? undefined : handleCategoryClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onRightClick?.();
      }}
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
              <Folder className="w-4 h-4 text-muted-foreground" />
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
            {/* Edit button for user-created categories only - visible on hover only */}
            {onEdit && !isEditing && name !== 'Published' && name !== 'Shared With' && name !== 'Unassigned' && (
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
              className="text-xs px-2 py-1 rounded-full transition-all duration-200 text-black flex-shrink-0 inline-block"
              style={{
                backgroundColor: isActive ? `${categoryColor}33` : '',
                color: 'black'
              }}
            >
              {count}
            </span>
          </div>
        </div>
      </div>
      
      {/* Expanded content within the card */}
      {isActive && children && (
        <div className="px-3 pb-3 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

// Upload area component
function UploadArea({ onFilesUpload }: { onFilesUpload: (files: File[]) => void | Promise<void> }) {
  console.log('🟡🟡🟡 UploadArea component rendered');
  console.log('🟡 UploadArea received onFilesUpload:', typeof onFilesUpload);
  console.log('🟡 Is MediaPage handler (2-step)?', onFilesUpload.toString().includes('PARALLEL') || onFilesUpload.toString().includes('uploadImageWithMetadata'));
  console.log('🟡 Handler function length:', onFilesUpload.toString().length, 'chars');
  console.log('🟡 UploadArea render time:', new Date().toISOString());
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Use useEffect to verify component mounted
  React.useEffect(() => {
    console.log('🟡 UploadArea useEffect - Component mounted');
    console.log('🟡 DOM check - upload input exists:', !!document.getElementById('upload-files-input-upload-area'));
  }, []);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    console.log('🟣 UploadArea handleDrop called');

    const allDroppedFiles = Array.from(e.dataTransfer.files);
    const droppedFiles = allDroppedFiles.filter(f => f.type.startsWith('image/'));
    console.log('🟣 Dropped files (images only):', droppedFiles.length, '/', allDroppedFiles.length);

    if (droppedFiles.length > 0) {
      console.log('🟣 Calling onFilesUpload prop with dropped files');
      setIsProcessing(true);
      try {
        await onFilesUpload(droppedFiles);
      } catch (error) {
        console.error('🔴 Error in onFilesUpload for dropped files:', error);
      } finally {
        setIsProcessing(false);
      }
    } else {
      console.log('🟡 No dropped files');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('═══════════════════════════════════════════════');
    console.log('🟦🟦🟦 UploadArea SELECT FILES CLICKED');
    const allFiles = Array.from(e.target.files || []);
    const selectedFiles = allFiles.filter(f => f.type.startsWith('image/'));
    console.log('🟦 Selected files (images only):', selectedFiles.map(f => f.name));
    console.log('🟦 Selected files count:', selectedFiles.length);
    console.log('🟦 onFilesUpload type:', typeof onFilesUpload);
    console.log('🟦 Handler toString preview:', onFilesUpload.toString().substring(0, 200));
    console.log('🟦 Is MediaPage handler?', onFilesUpload.toString().includes('MediaPage') || onFilesUpload.toString().includes('uploadImageWithMetadata'));
    console.log('═══════════════════════════════════════════════');

    if (selectedFiles.length > 0) {
      console.log('🟦 NOW CALLING onFilesUpload handler...');
      setIsProcessing(true);
      try {
        await onFilesUpload(selectedFiles);
      } catch (error) {
        console.error('🔴 Error in onFilesUpload:', error);
      } finally {
        setIsProcessing(false);
        console.log('🟦 UploadArea processing complete');
      }
    } else {
      console.log('🟡 No files selected in UploadArea');
    }
    
    // Clear the input value
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  return (
    <div 
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
        isDragOver 
          ? 'border-[#6C60FF] bg-[#6C60FF]/10 scale-[1.02]' 
          : 'border-gray-300 hover:border-[#6C60FF]/50 hover:bg-[#6C60FF]/5'
      } ${isProcessing ? 'opacity-75' : ''} bg-white`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <Upload className={`w-8 h-8 mx-auto mb-2 transition-all duration-200 ${
        isDragOver ? 'text-[#6C60FF] scale-110' : 'text-gray-400'
      } ${isProcessing ? 'animate-pulse' : ''}`} />
      
      <p className={`text-sm mb-2 transition-colors ${
        isDragOver ? 'text-[#6C60FF] font-medium' : 'text-gray-600'
      }`}>
        {isProcessing 
          ? 'Processing files...' 
          : isDragOver 
            ? 'Drop files here!' 
            : 'Drag & drop photos/videos here or click to browse'
        }
      </p>
      
      <p className="text-xs text-gray-500 mb-3">
        Supports: JPG, PNG, GIF, WebP
      </p>
      
      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,image/bmp,image/tiff,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.bmp,.tiff"
        onChange={handleFileSelect}
        onClick={() => {
          console.log('🟠 File input clicked');
          console.log('🟠 Date/Time:', new Date().toISOString());
        }}
        onFocus={() => {
          console.log('🟠 File input focused');
          console.log('🟠 Date/Time:', new Date().toISOString());
        }}
        onInput={() => {
          console.log('🟠 File input onInput event');
          console.log('🟠 Date/Time:', new Date().toISOString());
        }}
        className="hidden"
        id="upload-files-input-upload-area"
        disabled={isProcessing}
      />
      
      <Label htmlFor="upload-files-input-upload-area" className="cursor-pointer">
        <Button 
          variant="outline" 
          size="sm" 
          className={`w-full cursor-pointer transition-all duration-200 ${
            isDragOver ? 'border-[#6C60FF] text-[#6C60FF] bg-[#6C60FF]/5' : ''
          }`}
          disabled={isProcessing}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            console.log('🔴 UploadArea button clicked!');
            console.log('🔴 Date/Time:', new Date().toISOString());
            const inputElement = document.getElementById('upload-files-input-upload-area') as HTMLInputElement;
            console.log('🔴 Input element:', inputElement);
            console.log('🔴 Input element exists:', !!inputElement);
            if (inputElement) {
              console.log('🔴 Manually triggering click on input');
              inputElement.click();
            } else {
              console.log('🔴 ERROR: Input element not found!');
            }
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          {isProcessing ? 'Processing...' : 'Select Files'}
        </Button>
      </Label>
     
    </div>
  );
}

// Dropbox Folder Tree View Component matching the exact design from screenshot
function DropboxFolderTreeView({
  activeServiceTab,
  serviceSyncedMedia,
  connectedServices,
  selectedMediaItems = [],
  onMediaItemSelect
}: {
  activeServiceTab: string;
  serviceSyncedMedia: any;
  connectedServices: any[];
  selectedMediaItems?: string[];
  onMediaItemSelect?: (itemId: string, selected: boolean) => void;
}) {
  const [expandedFolders, setExpandedFolders] = useState<string[]>(['root']); // Expand root by default
  const [expandedSubFolders, setExpandedSubFolders] = useState<string[]>([]);

  // Get the current service - match by either ID or service type
  const currentService = connectedServices.find(s => {
    const serviceId = s.id?.toString();
    const serviceType = s.service_type || s.type;
    return serviceId === activeServiceTab || serviceType === activeServiceTab;
  });
  const serviceType = currentService?.service_type || currentService?.type || '';

  console.log('🔍 MediaNav DropboxFolderTreeView Debug:');
  console.log('  activeServiceTab:', activeServiceTab);
  console.log('  currentService:', currentService);
  console.log('  serviceType:', serviceType);

  // Get proper service display name
  const getServiceDisplayName = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'google':
      case 'google_photos':
        return 'Google Photos';
      case 'dropbox':
        return 'Dropbox';
      case 'icloud':
      case 'icloud_photos':
        return 'iCloud Photos';
      case 'facebook':
        return 'Facebook';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const serviceName = getServiceDisplayName(serviceType);

  // Get media for this service
  const mediaData = serviceSyncedMedia[activeServiceTab];
  const mediaArray = Array.isArray(mediaData) ? mediaData : (mediaData?.media || mediaData?.items || mediaData?.data || []);


  // Build folder structure from media paths - FLAT LIST (all files in root)
  const folderStructure = React.useMemo(() => {
    // Show all files in a flat list under root '/' - no folder organization
    return {
      '/': mediaArray
    };
  }, [mediaArray]);

  const folderPaths = Object.keys(folderStructure).sort();

  const toggleRootFolder = () => {
    setExpandedFolders(prev =>
      prev.includes('root')
        ? prev.filter(p => p !== 'root')
        : [...prev, 'root']
    );
  };

  const toggleSubFolder = (folderPath: string) => {
    setExpandedSubFolders(prev =>
      prev.includes(folderPath)
        ? prev.filter(p => p !== folderPath)
        : [...prev, folderPath]
    );
  };

  const isRootExpanded = expandedFolders.includes('root');

  // Get service-specific color and icon
  const getServiceConfig = () => {
    switch (serviceType?.toLowerCase()) {
      case 'dropbox':
        return {
          color: '#000000',
          icon: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z"/>
            </svg>
          )
        };
      case 'google':
      case 'google_photos':
        return {
          color: '#000000',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 26 26" fill="none">
              <path d="M3.90002 12.9998H10.92C11.477 12.9988 12.0108 12.7767 12.4042 12.3823L8.45003 8.31982L3.90002 12.9998Z" fill="#000000"/>
              <path d="M12.4041 12.3823C12.7873 11.9921 13.0013 11.4667 13 10.9198V8.31982H8.44995L12.4041 12.3823Z" fill="#000000"/>
              <path d="M22.1 13H15.08C14.523 13.001 13.9892 13.2231 13.5958 13.6175L17.55 17.68L22.1 13Z" fill="#000000"/>
              <path d="M13.5958 13.6177C13.2127 14.0079 12.9986 14.5333 13 15.0802V17.6802H17.55L13.5958 13.6177Z" fill="#000000"/>
              <path d="M13 3.8999V10.9199C13.001 11.4769 13.2231 12.0107 13.6175 12.4041L17.68 8.4499L13 3.8999Z" fill="#000000"/>
              <path d="M13.6176 12.4044C14.0078 12.7875 14.5332 13.0016 15.0801 13.0002H17.6801V8.4502L13.6176 12.4044Z" fill="#000000"/>
              <path d="M12.9999 22.0999V15.0799C12.9989 14.5229 12.7768 13.9891 12.3824 13.5957L8.31995 17.5499L12.9999 22.0999Z" fill="#000000"/>
              <path d="M12.3824 13.5958C11.9922 13.2127 11.4668 12.9986 10.9199 13H8.31995V17.55L12.3824 13.5958Z" fill="#000000"/>
            </svg>
          )
        };
      case 'facebook':
        return {
          color: '#000000',
          icon: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          )
        };
      default:
        return {
          color: '#000000',
          icon: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 4h16v16H4z"/>
            </svg>
          )
        };
    }
  };

  const serviceConfig = getServiceConfig();
  const serviceColor = serviceConfig.color;
  const ServiceIcon = serviceConfig.icon;

  // Check if all items are in root (no subfolders)
  const hasOnlyRootItems = folderPaths.length === 1 && folderPaths[0] === '/';

  return (
    <div className="p-4 space-y-3">
      {/* Root Dropbox Folder - Always visible */}
      <div
        className={`rounded-lg transition-all duration-200 ${
          isRootExpanded ? 'bg-[#D6EEFF]' : ''
        }`}
      >
        {/* Main Dropbox folder card */}
        <div
          className={`group w-full rounded-lg transition-all duration-200 cursor-pointer relative ${
            !isRootExpanded ? 'bg-gray-100' : ''
          }`}
          onClick={toggleRootFolder}
        >
          <div className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Chevron */}
                <ChevronRight
                  className={`w-3 h-3 transition-all duration-200 ${
                    isRootExpanded ? 'rotate-90' : ''
                  }`}
                  style={{ color: serviceColor }}
                />
                {/* Service Icon */}
                {ServiceIcon}
                {/* Service Name */}
                <span className="text-sm font-medium text-gray-900">
                  {serviceName}
                </span>
              </div>
              {/* Total count badge */}
              <Badge
                variant="secondary"
                className="text-xs ml-2 px-2.5 py-0.5 rounded-md font-medium"
                style={{
                  backgroundColor: '#B8DDFF',
                  color: '#1a1a1a',
                  border: 'none'
                }}
              >
                {mediaArray.length}
              </Badge>
            </div>
          </div>
        </div>

        {/* Expanded content - show items directly or subfolders */}
        {isRootExpanded && (
          <div className="mt-2 ml-4">
            {mediaArray.length === 0 ? (
              <div className="text-center py-8">
                <FolderOpen className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                <p className="text-xs text-gray-500">No media found</p>
              </div>
            ) : hasOnlyRootItems ? (
              /* If all items are in root, show them directly without subfolder */
              <div className="space-y-1 pr-2">
                {folderStructure['/'].map((item: any, idx: number) => {
                  const fileName = item.file_name || item.name || item.filename || item.dropbox_path?.split('/').pop() || 'Untitled';
                  const itemDate = item.capture_date || item.created_at || item.client_modified || item.server_modified || new Date().toISOString();
                  const formattedDate = new Date(itemDate).toLocaleDateString('en-US', {
                    month: 'numeric',
                    day: 'numeric',
                    year: 'numeric'
                  });
                  const itemId = item.id || item.media_id || `root-${idx}`;
                  const isSelected = selectedMediaItems?.includes(itemId.toString());

                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-[#A8D4FF] transition-colors cursor-pointer"
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (onMediaItemSelect) {
                            onMediaItemSelect(itemId.toString(), !isSelected);
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {/* Thumbnail */}
                      <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                        {item.thumbnail_url || item.media_url ? (
                          <img
                            src={item.thumbnail_url || item.media_url}
                            alt={fileName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Image className="w-6 h-6 m-2 text-gray-400" />
                        )}
                      </div>
                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 truncate">
                          {fileName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formattedDate}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Show subfolders when items are organized in folders */
              <div className="space-y-2">
                {folderPaths.filter(path => path !== '/').map((folderPath) => {
                  const items = folderStructure[folderPath];
                  const isSubExpanded = expandedSubFolders.includes(folderPath);
                  const displayName = folderPath.split('/').pop() || folderPath;

                  return (
                    <div key={folderPath}>
                      {/* Subfolder card */}
                      <div
                        className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleSubFolder(folderPath)}
                      >
                        <ChevronRight
                          className={`w-3 h-3 mt-1 transition-all duration-200 flex-shrink-0 ${
                            isSubExpanded ? 'rotate-90' : ''
                          }`}
                          style={{ color: '#666' }}
                        />
                        <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-gray-200">
                          {items[0]?.thumbnail_url || items[0]?.media_url ? (
                            <img
                              src={items[0].thumbnail_url || items[0].media_url}
                              alt={displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Folder className="w-6 h-6 m-2 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {displayName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {items.length} items
                          </div>
                        </div>
                      </div>

                      {/* Expanded subfolder - show individual images */}
                      {isSubExpanded && (
                        <div className="ml-6 mt-2 space-y-1 pr-2">
                          {items.map((item: any, idx: number) => {
                            const fileName = item.file_name || item.name || item.filename || item.dropbox_path?.split('/').pop() || 'Untitled';
                            const itemDate = item.capture_date || item.created_at || item.client_modified || item.server_modified || new Date().toISOString();
                            const formattedDate = new Date(itemDate).toLocaleDateString('en-US', {
                              month: 'numeric',
                              day: 'numeric',
                              year: 'numeric'
                            });
                            const itemId = item.id || item.media_id || `${folderPath}-${idx}`;
                            const isSelected = selectedMediaItems?.includes(itemId.toString());

                            return (
                              <div
                                key={idx}
                                className="flex items-center gap-2 p-2 rounded-md hover:bg-[#A8D4FF] transition-colors cursor-pointer"
                              >
                                {/* Checkbox */}
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    if (onMediaItemSelect) {
                                      onMediaItemSelect(itemId.toString(), !isSelected);
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                {/* Thumbnail */}
                                <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                                  {item.thumbnail_url || item.media_url ? (
                                    <img
                                      src={item.thumbnail_url || item.media_url}
                                      alt={fileName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Image className="w-6 h-6 m-2 text-gray-400" />
                                  )}
                                </div>
                                {/* File info */}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm text-gray-900 truncate">
                                    {fileName}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {formattedDate}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Show root level items if any exist alongside folders */}
                {folderStructure['/'] && folderStructure['/'].length > 0 && (
                  <div className="space-y-1 pt-2 pr-2">
                    {folderStructure['/'].map((item: any, idx: number) => {
                      const fileName = item.file_name || item.name || item.filename || item.dropbox_path?.split('/').pop() || 'Untitled';
                      const itemDate = item.capture_date || item.created_at || item.client_modified || item.server_modified || new Date().toISOString();
                      const formattedDate = new Date(itemDate).toLocaleDateString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric'
                      });
                      const itemId = item.id || item.media_id || `root-${idx}`;
                      const isSelected = selectedMediaItems?.includes(itemId.toString());

                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-[#A8D4FF] transition-colors cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (onMediaItemSelect) {
                                onMediaItemSelect(itemId.toString(), !isSelected);
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                            {item.thumbnail_url || item.media_url ? (
                              <img
                                src={item.thumbnail_url || item.media_url}
                                alt={fileName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Image className="w-6 h-6 m-2 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900 truncate">
                              {fileName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formattedDate}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MediaNav({
  isStacked = false,
  onToggleExpansion,
  canToggle = false,
  onFilterChange,
  expandedCategories: propExpandedCategories = [],
  selectedCategory,
  onCategorySelect,
  mediaMemories: propMediaMemories = [],
  onMediaMemoriesChange,
  unassignedImages: propUnassignedImages = [],
  onUnassignedImagesChange,
  showUnassignedImages = true,
  onUnassignedToggle,
  categories: propCategories = [],
  selectedMediaItems = [],
  onMediaItemSelect,
  apiMediaNavData = [],
  onUploadStateChange,
  onUploadProgressChange,
  highlightedImageId,
  onImageClick,
  onMemorySelect,
  apiMemoriesData,
  onCategoriesUpdate,
  onFetchMediaData,
  onCategoryRenamed,
  activeServiceTab = 'all',
  serviceSyncedMedia = {},
  connectedServices = [],
  dropboxSyncProgress = 0,
  showDropboxProgress = false,
  onViewDropboxResult,
  onFilesUpload,
  isPropertyOwner = true
}: MediaNavProps) {
  console.log('🟨 MediaNav rendered - isStacked:', isStacked, 'activeSection will be:', "media");
  console.log('🟨 BASIC FUNCTION TEST - MediaNav main function executed');
  console.log('🟨 Date/Time:', new Date().toISOString());
  console.log('🔍 MediaNav activeServiceTab:', activeServiceTab);
  console.log('🟨 MediaNav received onFilesUpload prop:', !!onFilesUpload);
  console.log('🟨 onFilesUpload is parent handler:', onFilesUpload ? 'YES - Will use parallel 2-step upload' : 'NO - Will use local sequential');
  console.log('🔍 MediaNav activeServiceTab type:', typeof activeServiceTab);
  console.log('🔍 MediaNav should show Dropbox view?', activeServiceTab !== 'all');
  
  // Get user context for profile image and initials fallback
  const { user } = useAuth();
  
  const [activeSection, setActiveSection] = useState<string | null>("media");
  const [expandedCategories, setExpandedCategories] = useState<string[]>(propExpandedCategories);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [localUploadProgress, setLocalUploadProgress] = useState<UploadProgressItem[]>([]);
  const [showAddMediaModal, setShowAddMediaModal] = useState(false);
  const [selectedCategoryForUpload, setSelectedCategoryForUpload] = useState<{ name: string; memories: any[] } | null>(null);

  // Sync localUploadProgress to uploadProgress so parent gets notified
  useEffect(() => {
    setUploadProgress(localUploadProgress);
  }, [localUploadProgress]);

  const [localCategories, setLocalCategories] = useState<any[]>(propCategories || []);

  // Use complete categories from local state if available (includes all categories even empty ones), 
  // otherwise fall back to API media nav data (which only includes categories with media)
  const useCompleteCategories = localCategories && localCategories.length > 0;
  
  // Legacy variable for backward compatibility with existing code
  const useApiData = apiMediaNavData && apiMediaNavData.length > 0;
  console.log('🎯 MediaNav categories logic:', { 
    useCompleteCategories, 
    propCategoriesLength: propCategories?.length || 0,
    apiMediaNavDataLength: apiMediaNavData?.length || 0,
    propCategories: propCategories?.map(c => c.name) || [],
    apiMediaNavDataNames: apiMediaNavData?.map(c => c.name) || []
  });
  
  
  
  // Extract categories - prioritize complete categories list over API media nav data
  const mediaCategories = useCompleteCategories 
    ? localCategories.map(cat => ({
        ...cat,
        // Ensure basic categories get colors from predefined mapping
        color: cat.color || (() => {
          const predefinedMap = {
            'Unassigned': '#9CA3AF',
            'Personal': '#6C60FF',
            'Shared With': '#F59E0B',
            'Published': '#10B981',
          };
          return predefinedMap[cat.name as keyof typeof predefinedMap] || '#6C60FF';
        })(),
        memories: [],
        type: 'media'
      }))
    : (apiMediaNavData && apiMediaNavData.length > 0) ? apiMediaNavData.map(cat => ({
        name: cat.name,
        color: cat.color,
        id: cat.id,
        count: cat.count,
        memories: cat.memories || [],
        type: 'media'
      })) : [];

  // Extract memory categories from memories API data (similar to CategoryNav)
  const memoryCategories = apiMemoriesData?.data?.sidebar?.categories?.items?.map((cat: any) => ({
    name: cat.name,
    color: cat.color,
    id: cat.id,
    count: cat.memory_count,
    memories: cat.memories || [],
    type: 'memory',
    isExpanded: false
  })) || [];

  // Combine both media and memory categories
  const categoriesWithColors = [...mediaCategories, ...memoryCategories];
  
  console.log('🔍 MediaNav Debug:', {
    apiMediaNavData: apiMediaNavData,
    apiDataLength: apiMediaNavData?.length,
    useApiData: useApiData,
    propMediaMemories: propMediaMemories.length,
    localCategories: localCategories.length,
    categoriesWithColors: categoriesWithColors
  });
  
  // Generate all available category names including 'Unassigned'
  const allCategoryNames = useApiData 
    ? apiMediaNavData.map(cat => cat.name)
    : ['Unassigned', ...localCategories.map(cat => cat.name)];

  // Local state for media data
  const [mediaMemories, setMediaMemories] = useState<MediaMemory[]>(propMediaMemories);
  const [unassignedImages, setUnassignedImages] = useState<MediaImage[]>(propUnassignedImages);
  
  // Local state for API memory expansion (track which memories are expanded)
  const [apiMemoryExpansions, setApiMemoryExpansions] = useState<{[key: string]: boolean}>({});

  // Notify parent when upload progress changes
  useEffect(() => {
    if (onUploadProgressChange) {
      onUploadProgressChange(uploadProgress);
    }
  }, [uploadProgress, onUploadProgressChange]);

  // Debug API data
  useEffect(() => {
    if (useApiData) {
      console.log('🔄 MediaNav using API data:', apiMediaNavData);
      console.log('🔄 allCategoryNames from API:', allCategoryNames);
    } else {
      console.log('🔄 MediaNav using static data');
      console.log('🔄 allCategoryNames static:', allCategoryNames);
    }
  }, [useApiData, apiMediaNavData, allCategoryNames]);

  // Update local state when props change
  useEffect(() => {
    setMediaMemories(propMediaMemories);
  }, [propMediaMemories]);

  useEffect(() => {
    setUnassignedImages(propUnassignedImages);
  }, [propUnassignedImages]);

  useEffect(() => {
    setExpandedCategories(propExpandedCategories);
  }, [propExpandedCategories]);

  // Debug: Track when propCategories changes and sync with local state
  useEffect(() => {
    console.log('🔄 MediaNav propCategories changed:', propCategories.map(cat => ({name: cat.name, id: cat.id})));
    const previousLocal = localCategories.map(cat => ({name: cat.name, id: cat.id}));
    console.log('🔄 Previous localCategories:', previousLocal);
    setLocalCategories(propCategories || []);
    console.log('🔄 Setting localCategories to match propCategories');
  }, [propCategories]);
  
  // Debug: Track when localCategories state changes
  useEffect(() => {
    console.log('🏠 MediaNav localCategories state changed:', localCategories.map(cat => ({name: cat.name, id: cat.id})));
  }, [localCategories]);

  // Expand only non-empty categories by default on media page
  useEffect(() => {
    if (useCompleteCategories && localCategories && localCategories.length > 0) {
      // Only auto-expand categories that have items; empty categories stay collapsed
      const nonEmptyCategoryNames = localCategories
        .filter(cat => {
          // Unassigned count comes from unassignedImages state, not cat.count
          if (cat.name === 'Unassigned') return unassignedImages.length > 0;
          return (cat.count ?? 0) > 0;
        })
        .map(cat => cat.name);

      // If Unassigned is not in localCategories but has images, include it
      const hasUnassignedInList = localCategories.some(cat => cat.name === 'Unassigned');
      if (!hasUnassignedInList && unassignedImages.length > 0) {
        nonEmptyCategoryNames.push('Unassigned');
      }

      setExpandedCategories(nonEmptyCategoryNames);
      console.log('🎯 Auto-expanding non-empty categories on media page:', nonEmptyCategoryNames);
    } else if (apiMediaNavData && apiMediaNavData.length > 0) {
      // Fallback: expand only non-empty API categories
      const nonEmptyApiCategoryNames = apiMediaNavData
        .filter(cat => (cat.count ?? 0) > 0)
        .map(cat => cat.name);
      setExpandedCategories(nonEmptyApiCategoryNames);
      console.log('🎯 Auto-expanding non-empty API categories on media page:', nonEmptyApiCategoryNames);
    }
  }, [useCompleteCategories, localCategories, apiMediaNavData, unassignedImages]);

  // Generate media categories with memory data - filter by selectedCategory if one is chosen
  // Define default categories that should always be visible
  const defaultCategories = ['Unassigned', 'Personal', 'Shared With', 'Published'];
  
  // Process media categories with memories
  const processedMediaCategories: MediaCategory[] = useCompleteCategories
    ? (() => {
        // Start with complete categories from local state (includes all categories, even empty ones)
        const allCategories = (localCategories || [])
          .filter(category => {
            // Filter out Uncategorized categories
            if (category && category.name === 'Uncategorized') {
              return false;
            }
            // Always show all categories in the sidebar regardless of selectedCategory
            return category && category.name;
          })
          .map(category => {
            // Special handling for Unassigned category
            if (category.name === 'Unassigned') {
              return {
                id: category.id, // Include category ID for edit functionality
                name: 'Unassigned',
                count: unassignedImages.length,
                admin_id: category.admin_id, // Include admin_id for edit functionality
                memories: [], // Unassigned uses unassignedImages, not memories
                isExpanded: expandedCategories.includes('Unassigned'),
                type: 'media',
                color: category.color
              };
            }
            
            // Find corresponding API data for this category (if it exists)
            const apiCategoryData = apiMediaNavData?.find(apiCat => apiCat.name === category.name);
            
            return {
              id: category.id, // Include category ID for edit functionality  
              name: category.name,
              count: category.count || 0,
              admin_id: category.admin_id, // Include admin_id for edit functionality
              // Use memories from API data if available, otherwise empty array
              memories: apiCategoryData?.memories ? apiCategoryData.memories.map((memory: any) => {
                if (!memory || !memory.id) {
                  console.warn('⚠️ Invalid memory object:', memory);
                  return memory;
                }
                const memoryKey = `${category.name}-${memory.id}`;
                const isExpanded = apiMemoryExpansions[memoryKey] ?? true; // Default to expanded
                return {
                  ...memory,
                  isExpanded: isExpanded
                };
              }) : [],
              isExpanded: expandedCategories.includes(category.name || ''),
              type: 'media',
              color: category.color || apiCategoryData?.color
            };
          });
        
        // Add Unassigned category only if there are actual unassigned items or upload is in progress
        const hasUnassigned = allCategories.some(cat => cat.name === 'Unassigned');
        if (!hasUnassigned) {
          // Check if we should show Unassigned category based on actual content
          const shouldShowUnassigned = (() => {
            // Only show if showUnassignedImages is true
            if (!showUnassignedImages) {
              return false;
            }
            
            // 1. When media is currently being uploaded, always show
            if (isUploading) {
              return true;
            }
            
            // 2. Check if there are any actual unassigned items
            const hasUnassignedItems = unassignedImages.length > 0;
            
            // 3. Only show if there are actually unassigned items to display
            return hasUnassignedItems;
          })();
          
          if (shouldShowUnassigned) {
            allCategories.unshift({
              name: 'Unassigned',
              count: unassignedImages.length,
              admin_id: null, // Unassigned category is not user-created
              memories: [],
              isExpanded: expandedCategories.includes('Unassigned'),
              type: 'media',
              color: '#9CA3AF'
            });
          }
        }
        
        // Show all categories (both with and without memories)
        console.log('🎯 Using complete categories - showing ALL categories:', allCategories.map(c => `${c.name} (count: ${c.count}, memories: ${c.memories.length})`));
        return allCategories;
      })()
    : (() => {
        // Ensure default categories are always included
        const categoriesToShow = [...new Set([...defaultCategories, ...allCategoryNames])];
        
        return categoriesToShow
          .filter(categoryName => {
            // Filter out Uncategorized categories
            if (categoryName === 'Uncategorized') {
              return false;
            }
            // Always show all categories in the sidebar regardless of selectedCategory
            return true;
          })
          .map(categoryName => {
            if (categoryName === 'Unassigned') {
              return {
                id: null, // Unassigned category has no ID - it's a special system category
                name: 'Unassigned',
                count: unassignedImages.length,
                admin_id: null, // Unassigned category is not user-created
                memories: [],
                isExpanded: expandedCategories.includes('Unassigned')
              };
            }
            
            const categoryMemories = mediaMemories.filter(memory => memory.category === categoryName);
            const originalCategory = localCategories?.find(cat => cat.name === categoryName);
            return {
              id: originalCategory?.id || null, // Look up id from original categories
              name: categoryName,
              count: categoryMemories.length,
              admin_id: originalCategory?.admin_id || null, // Look up admin_id from original categories
              memories: categoryMemories,
              isExpanded: expandedCategories.includes(categoryName)
            };
          });
      })();

  // Process memory categories with memories
  const processedMemoryCategories: MediaCategory[] = (() => {
    if (!apiMemoriesData?.data?.sidebar?.categories?.items) {
      return [];
    }
    
    return apiMemoriesData.data.sidebar.categories.items
      .filter((category: any) => {
        // Always show all categories in the sidebar regardless of selectedCategory
        return category && category.name;
      })
      .map((category: any) => {
        return {
          id: category.id, // Include category ID for edit functionality
          name: category.name,
          count: category.memory_count || 0,
          admin_id: category.admin_id, // Include admin_id for edit functionality
          memories: (category.memories || []).map((memory: any) => ({
            id: memory.id.toString(),
            title: memory.title,
            category: category.name,
            thumbnail: (memory.image_link ? memory.image_link.replace(/\\\//g, '/') : null) || (memory.memory_images?.[0]?.image_link ? memory.memory_images[0].image_link.replace(/\\\//g, '/') : null) || '',
            imageCount: memory.memory_images?.length || 0,
            date: new Date().toISOString(),
            type: 'memory' as const,
            author: memory.user?.name,
            images: memory.memory_images?.map((img: any) => ({
              id: img.id.toString(),
              name: memory.title,
              thumbnail: img.image_link ? img.image_link.replace(/\\\//g, '/') : null,
              date: img.capture_date || new Date().toISOString(),
              size: '0 MB',
              type: 'image' as const
            })) || [],
            isExpanded: false
          })),
          isExpanded: expandedCategories.includes(category.name)
        };
      });
  })();


  // Unfiltered categories for dropdown - always shows all categories
  // Use categoriesWithColors which is already built from API data without filtering by selectedCategory
  // Deduplicate categories by name to avoid showing duplicates
  const allCategoriesForDropdown = (() => {
    const categories = categoriesWithColors.reduce((acc: any[], category: any) => {
      // Check if category with this name already exists
      if (!acc.find(c => c.name === category.name)) {
        acc.push(category);
      }
      return acc;
    }, []);

    // Check if we should add Unassigned category to dropdown
    const shouldShowUnassigned = (() => {
      // Only show if showUnassignedImages is true
      if (!showUnassignedImages) {
        return false;
      }

      // When media is currently being uploaded, always show
      if (isUploading) {
        return true;
      }

      // Check if there are any actual unassigned items
      const hasUnassignedItems = unassignedImages.length > 0;

      // Only show if there are actually unassigned items to display
      return hasUnassignedItems;
    })();

    // Add Unassigned to dropdown if conditions are met and it's not already there
    if (shouldShowUnassigned && !categories.find(c => c.name === 'Unassigned')) {
      categories.unshift({
        name: 'Unassigned',
        count: unassignedImages.length,
        color: '#9CA3AF',
        type: 'media'
      });
    }

    return categories;
  })();

  // Combine both media and memory categories
  // When using complete categories (useCompleteCategories), only use processedMediaCategories to avoid duplicates
  const allFinalCategories = useCompleteCategories
    ? processedMediaCategories
    : [...processedMediaCategories, ...processedMemoryCategories];

  // Filter sidebar list by selected category — dropdown always keeps all options
  const finalCategories = selectedCategory
    ? allFinalCategories.filter(cat => cat.name === selectedCategory)
    : allFinalCategories;

  // Debug final categories
  console.log('🎯 Category Processing Debug:');
  console.log('🎯 useCompleteCategories:', useCompleteCategories);
  console.log('🎯 processedMediaCategories count:', processedMediaCategories.length);
  console.log('🎯 processedMemoryCategories count:', processedMemoryCategories.length);
  console.log('🎯 Final finalCategories count:', finalCategories.length);
  console.log('🎯 allCategoriesForDropdown count:', allCategoriesForDropdown.length);
  console.log('🎯 allCategoriesForDropdown names:', allCategoriesForDropdown.map(cat => cat.name));
  console.log('🎯 finalCategories names:', finalCategories.map(cat => cat.name));
  console.log('🎯 finalCategories with memory counts:', finalCategories.map(cat => ({
    name: cat.name,
    id: cat.id,
    memoriesCount: cat.memories?.length || 0,
    isExpanded: cat.isExpanded
  })));

  // Calculate counts for tabs
  const mediaCount = finalCategories.reduce((acc, cat) => acc + cat.count, 0);
  const archiveCount = 0; // Placeholder for archive count

  // Handle category selection from dropdown
  const handleCategoryFilterChange = (value: string) => {
    if (value === 'all') {
      onCategorySelect?.(null);
    } else {
      onCategorySelect?.(value);
    }
  };

  // Handle category expansion/collapse
  const handleCategoryToggle = (categoryName: string) => {
    const isCurrentlyExpanded = expandedCategories.includes(categoryName);
    const newExpandedCategories = isCurrentlyExpanded
      ? expandedCategories.filter(cat => cat !== categoryName)
      : [...expandedCategories, categoryName];

    setExpandedCategories(newExpandedCategories);

    if (onFilterChange) {
      onFilterChange(newExpandedCategories);
    }
  };

  // Handle memory expansion within categories
  const handleMemoryToggle = (categoryName: string, memoryId: string) => {
    console.log('🔄 handleMemoryToggle called for:', categoryName, memoryId);
    console.log('🔄 useApiData:', useApiData);
    
    if (useApiData && apiMediaNavData.length > 0) {
      // Update API memory expansion state
      const memoryKey = `${categoryName}-${memoryId}`;
      const currentExpansion = apiMemoryExpansions[memoryKey] ?? true; // Default to expanded
      
      console.log('🔄 Updating API memory expansion for key:', memoryKey, 'from', currentExpansion, 'to', !currentExpansion);
      
      setApiMemoryExpansions(prev => ({
        ...prev,
        [memoryKey]: !currentExpansion
      }));
      
    } else {
      // Update static data memories
      console.log('🔄 Updating static data memories');
      const updatedMemories = mediaMemories.map(memory => {
        if (memory.id === memoryId && memory.category === categoryName) {
          return { ...memory, isExpanded: !memory.isExpanded };
        }
        return memory;
      });
      
      setMediaMemories(updatedMemories);
      
      if (onMediaMemoriesChange) {
        onMediaMemoriesChange(updatedMemories);
      }
    }
  };

  // Handle category inline editing
  const handleInlineEditCategory = async (categoryId: string, oldName: string, newName: string) => {
    try {
      console.log('🖊️ MediaNav handleInlineEditCategory:', { categoryId, oldName, newName });
      console.log('🔍 Before edit - propCategories:', propCategories.map(cat => ({name: cat.name, id: cat.id})));
      
      const response = await dashboardAPI.editCategory(categoryId, newName);
      if (response.success) {
        console.log('✅ MediaNav Category edited successfully');

        // Update persistent color storage for renamed category
        updateCategoryColor(oldName, newName);

        // Immediate optimistic update to local categories
        setLocalCategories(prevCategories =>
          prevCategories.map(cat =>
            cat.id === categoryId || cat.name === oldName
              ? { ...cat, name: newName }
              : cat
          )
        );
        console.log('🚀 MediaNav: Applied optimistic update for category name change');

        // Notify parent component about category rename for media data updates
        if (onCategoryRenamed) {
          console.log('🔄 MediaNav calling onCategoryRenamed to update media data');
          onCategoryRenamed(oldName, newName);
        }

        // Note: NOT calling onCategoriesUpdate() to avoid refetching stale server data
        // The server is already updated by the API call above, and onCategoryRenamed
        // updates all the local data structures, so no need to refetch immediately
        console.log('✅ MediaNav: Skipping server refetch to prevent data loss during state transition');

        toast.success(`Category renamed to "${newName}"`);
      } else {
        console.error('❌ MediaNav Failed to edit category:', response.error);
        toast.error(`Failed to rename category: ${response.error}`);
      }
    } catch (error) {
      console.error('🔥 MediaNav Error editing category:', error);
      toast.error('An error occurred while renaming the category');
    }
  };

  // Handle Add Media button click
  const handleAddMediaClick = (categoryName: string, memories: any[]) => {
    console.log('🎬 Add Media clicked for category:', categoryName, 'with memories:', memories.length);

    // Check if category has memories
    if (memories && memories.length > 0) {
      // Category has memories - show modal
      console.log('✅ Category has memories - opening modal');
      setSelectedCategoryForUpload({ name: categoryName, memories });
      setShowAddMediaModal(true);
    } else {
      // No memories - trigger direct file upload (current behavior)
      console.log('📁 No memories - triggering direct file upload');
      const inputElement = document.getElementById('upload-files-input-upload-area') || document.getElementById('upload-files-input');
      if (inputElement) {
        (inputElement as HTMLInputElement).click();
      }
    }
  };

  // Handle upload from modal
  const handleModalUpload = async (files: File[], selectedMemoryId: string, parentImageId?: string) => {
    console.log('📤 Modal upload:', {
      filesCount: files.length,
      memoryId: selectedMemoryId,
      parentImageId
    });

    try {
      // TODO: Implement actual upload to specific memory with optional parent image
      // For now, we'll use the existing upload mechanism
      // You'll need to modify this based on your backend API structure

      if (onFilesUpload) {
        // Use parent's upload handler if available
        await onFilesUpload(files);
      } else {
        // Fallback to local upload handler
        await handleFilesUpload(files);
      }

      console.log('✅ Upload successful');
      toast.success(`Successfully uploaded ${files.length} file${files.length > 1 ? 's' : ''} to memory`);
    } catch (error) {
      console.error('❌ Upload failed:', error);
      toast.error('Failed to upload files. Please try again.');
      throw error;
    }
  };

  // File upload handlers - copied from MediaPage
  const handleFilesUpload = async (files: File[]) => {
    setIsUploading(true);

    if (onUploadStateChange) {
      onUploadStateChange(true);
    }

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
      // Concurrency-capped at 5 in flight, matching the BATCH_SIZE already used by
      // AddMomentModal/CreateMemory. Each item makes several sequential API calls,
      // so an unbounded fan-out here is a large multiple of the file count.
      await mapLimit(
        newUploadItems,
        async (item, i) => {
          try {
            setLocalUploadProgress(prev => prev.map(upload =>
              upload.id === item.id ? { ...upload, progress: 10 } : upload
            ));

            // Step 1: Extract metadata from image
            const metadataResponse = await dashboardAPI.uploadImageWithMetadata(
              item.originalFile,
              item.name
            );

            let location = '';
            let captureDate = '';

            if (metadataResponse.success && metadataResponse.data) {
              const responseData = metadataResponse.data?.data || metadataResponse.data;
              const rawLocation = responseData.location;
              const rawCaptureDate = responseData.capture_date || responseData.date_taken;
              location = rawLocation !== null && rawLocation !== undefined ? String(rawLocation) : '';
              captureDate = rawCaptureDate !== null && rawCaptureDate !== undefined ? String(rawCaptureDate) : '';
            }

            setLocalUploadProgress(prev => prev.map(upload =>
              upload.id === item.id ? { ...upload, progress: 50 } : upload
            ));

            // Step 2: Upload the photo with extracted metadata
            const uploadResponse = await dashboardAPI.uploadPhotosFromMediaWithOutMemory(
              item.originalFile,
              item.name,
              location,
              captureDate
            );

            if (uploadResponse.success) {
              await recheckMemoryLimit();

              setLocalUploadProgress(prev => prev.map(upload =>
                upload.id === item.id ? { ...upload, progress: 100 } : upload
              ));

              const newImage: MediaImage = {
                id: uploadResponse.data?.id || `upload-${Date.now()}-${i}`,
                name: item.name,
                thumbnail: URL.createObjectURL(item.originalFile),
                date: captureDate || new Date().toISOString(),
                size: item.size,
                type: item.originalFile.type.startsWith('video/') ? 'video' : 'image',
                dimensions: item.originalFile.type.startsWith('video/') ? '1920×1080' : '4032×3024'
              };

              const updatedUnassignedImages = [newImage, ...unassignedImages];
              setUnassignedImages(updatedUnassignedImages);

              if (onUnassignedImagesChange) {
                onUnassignedImagesChange(updatedUnassignedImages);
              }

              setLocalUploadProgress(prev => prev.map(upload =>
                upload.id === item.id ? { ...upload, status: 'complete' } : upload
              ));

              // Show success toast
              toast.success(`Successfully uploaded ${item.name}${location ? ` from ${location}` : ''}`);

            } else {
              setLocalUploadProgress(prev => prev.map(upload =>
                upload.id === item.id
                  ? { ...upload, status: 'error', error: uploadResponse.error || 'Upload failed' }
                  : upload
              ));
              toast.error(`Failed to upload ${item.name}: ${uploadResponse.error || 'Unknown error'}`);
            }
          } catch (error) {
            setLocalUploadProgress(prev => prev.map(upload =>
              upload.id === item.id
                ? { ...upload, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
                : upload
            ));
            toast.error(`Failed to upload ${item.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        },
        uploadLimit
      );

      // Reload entire page after local upload completes
      console.log('🔄 Local upload complete - Reloading page...');
      setTimeout(() => {
        window.location.reload();
      }, 1000); // 1 second delay to ensure upload is fully processed

      setTimeout(() => {
        setLocalUploadProgress(prev => prev.filter(item => item.status !== 'complete'));
      }, 3000);

    } catch (error) {
      // Upload process error
    } finally {
      setIsUploading(false);

      if (onUploadStateChange) {
        onUploadStateChange(false);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🟠 handleFileUpload called in stacked mode!');
    const allFiles = Array.from(e.target.files || []);
    const files = allFiles.filter(f => f.type.startsWith('image/'));
    console.log('🟠 Files selected (images only):', files.length);
    if (files.length > 0) {
      // Use parent's parallel upload handler if available, otherwise fall back to local
      if (onFilesUpload) {
        console.log('🟠 Using PARENT parallel upload handler');
        await onFilesUpload(files);

        // Reload entire page after upload completes
        console.log('🔄 Upload complete - Reloading page...');
        setTimeout(() => {
          window.location.reload();
        }, 1000); // 1 second delay to ensure upload is fully processed
      } else {
        console.log('🟠 Using LOCAL sequential upload (fallback)');
        handleFilesUpload(files);
      }
    }
    e.target.value = '';
  };

  
  // Stacked mode rendering
  if (isStacked) {
    return (
      <div className="h-full flex flex-col bg-white relative">

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
            onClick={() => setActiveSection("media")}
            className={`flex flex-col items-center py-2 px-1 transition-all duration-200 rounded-lg group ${
              activeSection === "media" ? 'bg-[#6C60FF]/10' : ''
            }`}
            title={`Media (${mediaCount} items)`}
          >
            <div className={`w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200 ${
              activeSection === "media" ? 'bg-[#6C60FF]/20' : 'bg-gray-100'
            }`}>
              <Image className={`w-4 h-4 ${activeSection === "media" ? 'text-[#6C60FF]' : 'text-gray-500'}`} />
            </div>
            <span className={`text-xs mt-1 text-center leading-tight transition-colors font-medium ${
              activeSection === "media" ? 'text-[#6C60FF]' : 'text-gray-600'
            }`}>
              {mediaCount}
            </span>
          </button>
          
          <button
            onClick={() => setActiveSection("archive")}
            className={`flex flex-col items-center py-2 px-1 transition-all duration-200 rounded-lg group ${
              activeSection === "archive" ? 'bg-gray-500/10' : ''
            }`}
            title={`Archive (${archiveCount} items)`}
          >
            <div className={`w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200 ${
              activeSection === "archive" ? 'bg-gray-500/20' : 'bg-gray-100'
            }`}>
              <Archive className={`w-4 h-4 ${activeSection === "archive" ? 'text-gray-600' : 'text-gray-500'}`} />
            </div>
            <span className={`text-xs mt-1 text-center leading-tight transition-colors font-medium ${
              activeSection === "archive" ? 'text-gray-600' : 'text-gray-600'
            }`}>
              {archiveCount}
            </span>
          </button>
        </div>

        {/* Content based on active section */}
        {activeSection === "media" && (
          <div className="space-y-2">
            {/* Regular categories (excluding special ones) */}
            {categoriesWithColors
              .filter(category => category.name !== 'Shared With' && category.name !== 'Published')
              .map((category) => (
              <div key={category.name} className="flex flex-col items-center">
                <div
                  className="w-full flex flex-col items-center py-2 px-1 transition-all duration-200 rounded-lg cursor-pointer relative group"
                  style={{
                    backgroundColor: category.isExpanded ? `${getCategoryColor(category.name, categoriesWithColors)}26` : '',
                    border: category.isExpanded ? `1px solid ${getCategoryColor(category.name, categoriesWithColors)}33` : ''
                  }}
                  onMouseEnter={(e) => {
                    if (!category.isExpanded) {
                      e.currentTarget.style.backgroundColor = `${getCategoryColor(category.name, categoriesWithColors)}1A`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!category.isExpanded) {
                      e.currentTarget.style.backgroundColor = '';
                    }
                  }}
                  onClick={() => handleCategoryToggle(category.name)}
                  title={`${category.name} (${category.count} items)`}
                >
                  <div 
                    className="w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200 relative"
                    style={{
                      backgroundColor: `${getCategoryColor(category.name, categoriesWithColors)}33`,
                      color: getCategoryColor(category.name, categoriesWithColors)
                    }}
                  >
                    {React.createElement(getCategoryIcon(category.name), { className: "w-4 h-4" })}
                  </div>
                  <span 
                    className="text-xs mt-1 text-center leading-tight transition-colors font-medium"
                    style={{
                      color: category.isExpanded ? getCategoryColor(category.name, categoriesWithColors) : ''
                    }}
                  >
                    {category.count}
                  </span>
                  
                  {/* Edit button for all categories in stacked mode - visible on hover only */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🖊️ Stacked view pencil clicked for:', category.name);
                      // TODO: Add inline editing for stacked view
                      alert(`Edit functionality for "${category.name}" - Coming soon!`);
                    }}
                    className="absolute top-1 right-1 p-0.5 rounded hover:bg-gray-200/70 transition-all opacity-0 group-hover:opacity-100"
                    title={`Edit ${category.name}`}
                  >
                    <Pencil className="w-3 h-3 text-gray-500 hover:text-gray-700" />
                  </button>
                </div>
                
                {/* Stacked Memories - including Shared With and Published when they have data */}
                {category.isExpanded && category.name !== 'Unassigned' && category.memories.length > 0 && (
                  <div className="mt-2 space-y-1 w-full">
                    <MemoryTreeView
                      categoryName={category.name}
                      memories={category.memories}
                      onToggleExpansion={handleMemoryToggle}
                      isStacked={true}
                      categoryColor={getCategoryColor(category.name, categoriesWithColors)}
                      categories={categoriesWithColors}
                      selectedMediaItems={selectedMediaItems}
                      onMediaItemSelect={onMediaItemSelect}
                      highlightedImageId={highlightedImageId}
                      user={user}
                      onImageClick={onImageClick}
                      onMemorySelect={onMemorySelect}
                    />
                    {/* Add Media button below the list - exclude Shared With, Published, Suggested */}
                    {isPropertyOwner && !['Shared With', 'Published', 'Suggested'].includes(category.name) && (
                      <div className="mx-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleAddMediaClick(category.name, category.memories || []);
                          }}
                          className="w-full px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 hover:bg-opacity-5"
                          style={{
                            borderColor: getCategoryColor(category.name, categoriesWithColors),
                            color: getCategoryColor(category.name, categoriesWithColors)
                          }}
                        >
                          <Plus className="w-4 h-4" />
                          Add Media
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state for categories (except Unassigned) when no memories */}
                {category.isExpanded && category.name !== 'Unassigned' && category.memories.length === 0 && (
                  <div className="mx-2 my-3 p-4 rounded-lg text-center">
                    {(category.name === 'Personal' || category.name === 'new') ? (
                      <SpecialEmptyState categoryName={category.name} />
                    ) : (
                      <div className="flex flex-col items-center space-y-2">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: `${getCategoryColor(category.name, categoriesWithColors)}1A` }}
                        >
                          {React.createElement(getCategoryIcon(category.name), {
                            className: "w-5 h-5",
                            style: { color: getCategoryColor(category.name, categoriesWithColors) }
                          })}
                        </div>
                        <div>
                          <h3 className="text-xs font-medium text-gray-700">
                            No {category.name.toLowerCase()} campaigns
                          </h3>
                          <p className="text-[12px] text-gray-500 mt-1">
                            Your {category.name.toLowerCase()} campaigns will appear here.
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Add Media button - exclude Shared With, Published, Suggested */}
                    {isPropertyOwner && !['Shared With', 'Published', 'Suggested'].includes(category.name) && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleAddMediaClick(category.name, category.memories || []);
                        }}
                        className="w-full mt-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 hover:bg-opacity-5"
                        style={{
                          borderColor: getCategoryColor(category.name, categoriesWithColors),
                          color: getCategoryColor(category.name, categoriesWithColors)
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Add Media
                      </button>
                    )}
                  </div>
                )}
                
                {/* Stacked Unassigned Images */}
                {category.isExpanded && category.name === 'Unassigned' && unassignedImages.length > 0 && (
                  <div className="mt-2 space-y-1 w-full">
                    <UnassignedImagesView
                      images={unassignedImages}
                      isStacked={true}
                      selectedItems={selectedMediaItems}
                      onToggleSelection={onMediaItemSelect ? (imageId: string) => {
                        const isCurrentlySelected = selectedMediaItems?.includes(imageId) || false;
                        onMediaItemSelect(imageId, !isCurrentlySelected);
                      } : undefined}
                      highlightedImageId={highlightedImageId}
                      user={user}
                      onImageClick={onImageClick}
                    />
                    {/* Add Media button below the list */}
                    {isPropertyOwner && (
                      <div className="mx-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            // Try both possible input IDs to ensure compatibility
                            const inputElement = document.getElementById('upload-files-input-upload-area') || document.getElementById('upload-files-input');
                            if (inputElement) {
                              (inputElement as HTMLInputElement).click();
                            }
                          }}
                          className="w-full px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 hover:bg-opacity-5"
                          style={{
                            borderColor: getCategoryColor('Unassigned', categoriesWithColors),
                            color: getCategoryColor('Unassigned', categoriesWithColors)
                          }}
                        >
                          <Plus className="w-4 h-4" />
                          Add Media
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty State for Unassigned when no images */}
                {category.isExpanded && category.name === 'Unassigned' && unassignedImages.length === 0 && (
                  <div className="mx-2 my-3 p-6 rounded-lg text-center">
                    <div className="flex flex-col items-center space-y-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${getCategoryColor('Unassigned', categoriesWithColors)}1A` }}
                      >
                        <HardDrive
                          className="w-6 h-6"
                          style={{ color: getCategoryColor('Unassigned', categoriesWithColors) }}
                        />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-1">
                          No unassigned media
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Media not assigned to any campaign will appear here.
                        </p>
                      </div>
                      {isPropertyOwner && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            // Try both possible input IDs to ensure compatibility
                            const inputElement = document.getElementById('upload-files-input-upload-area') || document.getElementById('upload-files-input');
                            if (inputElement) {
                              (inputElement as HTMLInputElement).click();
                            }
                          }}
                          className="w-full mt-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 hover:bg-opacity-5"
                          style={{
                            borderColor: getCategoryColor('Unassigned', categoriesWithColors),
                            color: getCategoryColor('Unassigned', categoriesWithColors)
                          }}
                        >
                          <Plus className="w-4 h-4" />
                          Add Media
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Special Categories - Shared With and Published at the end */}
            {finalCategories
              .filter(category => category.name === 'Shared With' || category.name === 'Published')
              .map((category) => (
              <div key={category.name} className="flex flex-col items-center">
                <div
                  className="w-full flex flex-col items-center py-2 px-1 transition-all duration-200 rounded-lg cursor-pointer relative group"
                  style={{
                    backgroundColor: category.isExpanded ? `${getCategoryColor(category.name, categoriesWithColors)}26` : '',
                    border: category.isExpanded ? `1px solid ${getCategoryColor(category.name, categoriesWithColors)}33` : ''
                  }}
                  onMouseEnter={(e) => {
                    if (!category.isExpanded) {
                      e.currentTarget.style.backgroundColor = `${getCategoryColor(category.name, categoriesWithColors)}1A`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!category.isExpanded) {
                      e.currentTarget.style.backgroundColor = '';
                    }
                  }}
                  onClick={() => handleCategoryToggle(category.name)}
                  title={`${category.name} (${category.count} items)`}
                >
                  <div 
                    className="w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200 relative"
                    style={{
                      backgroundColor: `${getCategoryColor(category.name, categoriesWithColors)}33`,
                      color: getCategoryColor(category.name, categoriesWithColors)
                    }}
                  >
                    {React.createElement(getCategoryIcon(category.name), { className: "w-4 h-4" })}
                    {/* Small chevron indicator */}
                    <ChevronRight 
                      className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 transition-all duration-200 bg-white rounded-full p-0.5 ${
                        category.isExpanded ? 'rotate-90' : ''
                      }`}
                      style={{
                        color: getCategoryColor(category.name, categoriesWithColors),
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                      }}
                    />
                  </div>
                  <span 
                    className="text-xs mt-1 text-center leading-tight transition-colors font-medium"
                    style={{
                      color: category.isExpanded ? getCategoryColor(category.name, categoriesWithColors) : ''
                    }}
                  >
                    {category.count}
                  </span>
                  
                  {/* Edit button for all categories in stacked mode - visible on hover only */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🖊️ Stacked special category pencil clicked for:', category.name);
                      // TODO: Add inline editing for stacked view
                      alert(`Edit functionality for "${category.name}" - Coming soon!`);
                    }}
                    className="absolute top-1 right-1 p-0.5 rounded hover:bg-gray-200/70 transition-all opacity-0 group-hover:opacity-100"
                    title={`Edit ${category.name}`}
                  >
                    <Pencil className="w-3 h-3 text-gray-500 hover:text-gray-700" />
                  </button>
                </div>
                
                {/* Special Categories Content */}
                {category.isExpanded && (
                  <div className="mt-2 space-y-1 w-full">
                    {category.memories.length > 0 ? (
                      <MemoryTreeView
                        categoryName={category.name}
                        memories={category.memories}
                        onToggleExpansion={handleMemoryToggle}
                        isStacked={true}
                        categoryColor={getCategoryColor(category.name, categoriesWithColors)}
                        categories={categoriesWithColors}
                        selectedMediaItems={selectedMediaItems}
                        onMediaItemSelect={onMediaItemSelect}
                        highlightedImageId={highlightedImageId}
                        user={user}
                        onImageClick={onImageClick}
                        onMemorySelect={onMemorySelect}
                      />
                    ) : (
                      <div className="mx-2 my-3 p-4 rounded-lg text-center">
                        <SpecialEmptyState categoryName={category.name} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
            }
          </div>
        )}

        {activeSection === "archive" && (
          <div className="text-center py-8 text-gray-500">
            <Archive className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">Archive is empty</p>
          </div>
        )}
        
        {/* Upload Area - simplified for stacked mode */}
        {activeSection === "media" && (
          <div className="mt-4">
            <Button
              onClick={(e) => {
                e.preventDefault();
                console.log('🔵 Stacked mode upload button clicked!');
                const inputElement = document.getElementById('upload-files-input') as HTMLInputElement;
                console.log('🔵 Input element:', inputElement);
                if (inputElement) {
                  inputElement.click();
                } else {
                  console.log('🔵 ERROR: Input element not found!');
                }
              }}
              variant="outline"
              size="sm"
              className="w-full h-12 text-xs"
              title="Upload media files"
            >
              <Upload className="w-4 h-4 mb-1" />
              <span className="text-[12px]">Select Files</span>
            </Button>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,image/bmp,image/tiff,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.bmp,.tiff"
              onChange={handleFileUpload}
              className="hidden"
              id="upload-files-input"
              style={{ display: 'none' }}
            />
          </div>
        )}
        </div>
      </div>
    );
  }

  // Expanded mode rendering
  
  return (
    <div className="h-full flex flex-col bg-white relative">

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

      {/* Tab Header with Toggle Button */}
      <div className="flex items-center p-3 border-b border-gray-200 bg-white">
        {/* Toggle Button on the LEFT */}
        {canToggle && onToggleExpansion && (
          <div className="flex-shrink-0 mr-2">
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
        
        <div className="flex space-x-3 flex-1">
          <button
            onClick={() => setActiveSection("media")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
              activeSection === "media"
                ? 'bg-[#6C60FF]/10 text-[#6C60FF] font-medium'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Image className="w-4 h-4" />
            <span className="text-sm">Media</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full transition-all duration-200 text-black ${
              activeSection === "media" ? 'bg-[#6C60FF]/20' : 'bg-gray-200'
            }`}>
              {mediaCount}
            </span>
          </button>
          
          <button
            onClick={() => setActiveSection("archive")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
              activeSection === "archive"
                ? 'bg-gray-500/10 text-gray-700 font-medium'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span className="text-sm">Archive</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full transition-all duration-200 text-black ${
              activeSection === "archive" ? 'bg-gray-500/20' : 'bg-gray-200'
            }`}>
              {archiveCount}
            </span>
          </button>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <UploadProgress
            uploads={uploadProgress}
            onDismiss={(id) => {
              setUploadProgress(prev => prev.filter(item => item.id !== id));
            }}
            onClearCompleted={() => {
              setUploadProgress(prev => prev.filter(item => item.status !== 'complete'));
            }}
          />
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === "media" && (
          <>
            {/* Show different content based on active service tab */}
            {(() => {
              return activeServiceTab !== 'all' ? (
                /* Dropbox/Service Folder Tree View */
                <DropboxFolderTreeView
                  activeServiceTab={activeServiceTab}
                  serviceSyncedMedia={serviceSyncedMedia}
                  connectedServices={connectedServices}
                  selectedMediaItems={selectedMediaItems}
                  onMediaItemSelect={onMediaItemSelect}
                />
              ) : (
                /* Default Category Tree View */
                <>

            {/* Simple Category Filter Dropdown */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-900">Category Filter</span>
              </div>
              
              <Select 
                value={selectedCategory || 'all'} 
                onValueChange={handleCategoryFilterChange}
              >
                <SelectTrigger className="w-full h-9 text-sm bg-gray-50 border-gray-200 hover:border-gray-300 focus:bg-gray-50 focus:border-gray-300 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 outline-none">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg">
                  <SelectItem value="all" className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 focus:outline-none">All Categories</SelectItem>
                  {allCategoriesForDropdown
                    .filter(category => category.name !== 'Uncategorized')
                    .map((category) => (
                    <SelectItem key={category.name} value={category.name} className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 focus:outline-none">
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 space-y-3">
              {/* Upload Area - use parent's parallel upload handler if available - Only show for property owners */}
              {isPropertyOwner && (
                <>
                  {console.log('🔵 Passing to UploadArea - using parent handler?', !!onFilesUpload)}
                  <UploadArea onFilesUpload={onFilesUpload || handleFilesUpload} />
                </>
              )}
              
              {/* Regular Categories (excluding special ones) */}
              {finalCategories
                .filter(category => category.name !== 'Shared With' && category.name !== 'Published')
                .map((category) => {
                // Debug: Check category data before passing to CategoryCard
                console.log('🔍 MediaNav Category data:', { 
                  name: category.name, 
                  id: category.id, 
                  idType: typeof category.id,
                  hasId: category.id !== null && category.id !== undefined,
                  fullCategory: category 
                });
                
                return <CategoryCard
                  key={category.name}
                  id={category.id}
                  name={category.name}
                  count={category.count}
                  isActive={category.isExpanded}
                  onClick={() => handleCategoryToggle(category.name)}
                  hasMemories={category.name !== 'Unassigned' && category.memories.length > 0}
                  categories={categoriesWithColors}
                  admin_id={category.admin_id}
                  onEdit={(newName: string) => {
                    console.log('📝 MediaNav Category edit requested:', { oldName: category.name, newName });
                    // This will be handled by the inline editing logic in CategoryCard itself
                  }}
                  onCategoriesChange={(updatedCategories: any[]) => {
                    console.log('📝 MediaNav Categories updated:', updatedCategories);
                    // Handle categories update in parent if needed
                  }}
                  handleInlineEditCategory={handleInlineEditCategory}
                >
                  {category.isExpanded && (
                    <div className="space-y-2">
                      {category.name === 'Unassigned' ? (
                        unassignedImages.length > 0 ? (
                          <>
                            <UnassignedImagesView
                              images={unassignedImages}
                              selectedItems={selectedMediaItems}
                              onToggleSelection={onMediaItemSelect ? (imageId: string) => {
                                const isCurrentlySelected = selectedMediaItems?.includes(imageId) || false;
                                onMediaItemSelect(imageId, !isCurrentlySelected);
                              } : undefined}
                              highlightedImageId={highlightedImageId}
                              user={user}
                              onImageClick={onImageClick}
                            />
                            {/* Add Media button below the list */}
                            {isPropertyOwner && (
                              <div className="mx-2 mt-3">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    // Try both possible input IDs to ensure compatibility
                                    const inputElement = document.getElementById('upload-files-input-upload-area') || document.getElementById('upload-files-input');
                                    if (inputElement) {
                                      (inputElement as HTMLInputElement).click();
                                    }
                                  }}
                                  className="w-full px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 hover:bg-opacity-5"
                                  style={{
                                    borderColor: getCategoryColor('Unassigned', categoriesWithColors),
                                    color: getCategoryColor('Unassigned', categoriesWithColors)
                                  }}
                                >
                                  <Plus className="w-4 h-4" />
                                  Add Media
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="p-6 rounded-lg text-center">
                            <div className="flex flex-col items-center space-y-3">
                              <div
                                className="w-12 h-12 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: `${getCategoryColor('Unassigned', categoriesWithColors)}1A` }}
                              >
                                <HardDrive
                                  className="w-8 h-8"
                                  style={{ color: getCategoryColor('Unassigned', categoriesWithColors) }}
                                />
                              </div>
                              <div>
                                <h3 className="text-sm font-medium text-gray-700 mb-1">
                                  No unassigned media
                                </h3>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                  Media not assigned to any campaign will appear here.
                                </p>
                              </div>
                              {isPropertyOwner && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    // Try both possible input IDs to ensure compatibility
                                    const inputElement = document.getElementById('upload-files-input-upload-area') || document.getElementById('upload-files-input');
                                    if (inputElement) {
                                      (inputElement as HTMLInputElement).click();
                                    }
                                  }}
                                  className="w-full mt-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 hover:bg-opacity-5"
                                  style={{
                                    borderColor: getCategoryColor('Unassigned', categoriesWithColors),
                                    color: getCategoryColor('Unassigned', categoriesWithColors)
                                  }}
                                >
                                  <Plus className="w-4 h-4" />
                                  Add Media
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      ) : (
                        category.memories.length > 0 ? (
                          <>
                            <MemoryTreeView
                              categoryName={category.name}
                              memories={category.memories}
                              onToggleExpansion={handleMemoryToggle}
                              isStacked={false}
                              categoryColor={getCategoryColor(category.name, categoriesWithColors)}
                              categories={categoriesWithColors}
                              selectedMediaItems={selectedMediaItems}
                              onMediaItemSelect={onMediaItemSelect}
                              highlightedImageId={highlightedImageId}
                              user={user}
                              onImageClick={onImageClick}
                              onMemorySelect={onMemorySelect}
                            />
                            {/* Add Media button below the list - exclude Shared With, Published, Suggested */}
                            {isPropertyOwner && !['Shared With', 'Published', 'Suggested'].includes(category.name) && (
                              <div className="mx-2 mt-3">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleAddMediaClick(category.name, category.memories || []);
                                  }}
                                  className="w-full px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 hover:bg-opacity-5"
                                  style={{
                                    borderColor: getCategoryColor(category.name, categoriesWithColors),
                                    color: getCategoryColor(category.name, categoriesWithColors)
                                  }}
                                >
                                  <Plus className="w-4 h-4" />
                                  Add Media
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          // Use SpecialEmptyState for Personal and new categories, generic for others
                          (category.name === 'Personal' || category.name === 'new') ? (
                            <SpecialEmptyState categoryName={category.name} />
                          ) : (
                            <div className="p-6 rounded-lg text-center">
                              <div className="flex flex-col items-center space-y-3">
                                <div
                                  className="w-12 h-12 rounded-full flex items-center justify-center"
                                  style={{ backgroundColor: `${getCategoryColor(category.name, categoriesWithColors)}1A` }}
                                >
                                  {React.createElement(getCategoryIcon(category.name), {
                                    className: "w-6 h-6",
                                    style: { color: getCategoryColor(category.name, categoriesWithColors) }
                                  })}
                                </div>
                                <div>
                                  <h3 className="text-sm font-medium text-gray-700 mb-1">
                                    No {category.name.toLowerCase()} campaigns
                                  </h3>
                                  <p className="text-xs text-gray-500 leading-relaxed">
                                    Your {category.name.toLowerCase()} campaigns will appear here.
                                  </p>
                                </div>
                                {/* Add Media button - exclude Shared With, Published, Suggested */}
                                {isPropertyOwner && !['Shared With', 'Published', 'Suggested'].includes(category.name) && (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleAddMediaClick(category.name, category.memories || []);
                                    }}
                                    className="w-full mt-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 hover:bg-opacity-5"
                                    style={{
                                      borderColor: getCategoryColor(category.name, categoriesWithColors),
                                      color: getCategoryColor(category.name, categoriesWithColors)
                                    }}
                                  >
                                    <Plus className="w-4 h-4" />
                                    Add Media
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        )
                      )}
                    </div>
                  )}
                </CategoryCard>
              })}

              {/* Special Categories - Shared With and Published at the end */}
              {finalCategories
                .filter(category => category.name === 'Shared With' || category.name === 'Published')
                .map((category) => (
                  <CategoryCard
                    key={category.name}
                    id={category.id}
                    name={category.name}
                    count={category.count}
                    isActive={category.isExpanded}
                    onClick={() => handleCategoryToggle(category.name)}
                    hasMemories={true} // Always show chevron for special categories
                    categories={categoriesWithColors}
                    admin_id={category.admin_id}
                    onEdit={(newName: string) => {
                      console.log('📝 MediaNav Special Category edit requested:', { oldName: category.name, newName });
                      // This will be handled by the inline editing logic in CategoryCard itself
                    }}
                    onCategoriesChange={(updatedCategories: any[]) => {
                      console.log('📝 MediaNav Special Categories updated:', updatedCategories);
                      // Handle categories update in parent if needed
                    }}
                    handleInlineEditCategory={handleInlineEditCategory}
                  >
                    {category.isExpanded && (
                      <div className="space-y-2">
                        {category.memories.length > 0 ? (
                          <MemoryTreeView
                            categoryName={category.name}
                            memories={category.memories}
                            onToggleExpansion={handleMemoryToggle}
                            isStacked={false}
                            categoryColor={getCategoryColor(category.name, categoriesWithColors)}
                            categories={categoriesWithColors}
                            selectedMediaItems={selectedMediaItems}
                            onMediaItemSelect={onMediaItemSelect}
                            highlightedImageId={highlightedImageId}
                            user={user}
                            onImageClick={onImageClick}
                            onMemorySelect={onMemorySelect}
                          />
                        ) : (
                          <SpecialEmptyState categoryName={category.name} />
                        )}
                      </div>
                    )}
                  </CategoryCard>
                ))
              }
            </div>
                </>
              );
            })()}
          </>
        )}

        {activeSection === "archive" && (
          <div className="p-4">
            <div className="text-center py-12">
              <Archive className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Archive is empty</h3>
              <p className="text-gray-500">Archived media will appear here</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Media to Memory Modal */}
      {showAddMediaModal && selectedCategoryForUpload && (
        <AddMediaToMemoryModal
          isOpen={showAddMediaModal}
          onClose={() => {
            setShowAddMediaModal(false);
            setSelectedCategoryForUpload(null);
          }}
          categoryName={selectedCategoryForUpload.name}
          memories={selectedCategoryForUpload.memories}
          onUpload={handleModalUpload}
        />
      )}
    </div>
  );
}