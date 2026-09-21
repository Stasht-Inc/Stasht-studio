import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Download, Trash2, Edit, Eye, EyeOff, ImageIcon, Play, FileText, Calendar, MapPin, User } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Badge } from './ui/badge';
import { EditMediaItemPopover } from './EditMediaItemPopover';
import { FacebookIcon } from './icons/FacebookIcon';
import { InstagramIcon } from './icons/InstagramIcon';

interface MediaItem {
  id: string;
  name: string;
  title?: string; // Post title from API
  thumbnail: string;
  image: string;
  type: 'image' | 'video' | 'text';
  size: string;
  date: string;
  location?: {
    displayName?: string;
    city?: string;
    country?: string;
    coordinates?: { lat: number; lng: number };
  };
  author: {
    name: string;
    avatar: string;
    id?: string; // User ID of the author
  };
  content?: string;
  description?: string;
  dimensions?: string;
  labels?: string[];
  rotation_angle?: number;
  source?: string; // Source platform like 'facebook', 'instagram', etc.
  parent_id?: string; // For sub-images
  is_new?: number | boolean; // New image flag from API
}

interface MemoryImage {
  id: string;
  src: string;
  title?: string;
  subImages?: MemoryImage[];
}

interface MemoryDetailsMediaItemProps {
  item: MediaItem;
  isSelected: boolean;
  onToggleSelect?: (id: string) => void;
  onView: (item: MediaItem) => void;
  onViewImage: (src: string, alt: string, title?: string, subtitle?: string, imageId?: string) => void;
  onUpdateItem?: (id: string, updates: Partial<MediaItem>) => void;
  onDeleteItem?: (id: string) => void;
  memoryOwnerId?: string; // ID of the memory owner
  memoryTitle?: string;
  memoryThumbnail?: string;
  memoryCreatedDate?: string;
  memoryImages?: MemoryImage[];
  index?: number; // Sequential number to display on the card
  isHidden?: boolean; // Person hidden from media
  isCar?: boolean; // Car media has no real capture date — hide the date row
}

export default function MemoryDetailsMediaItem({
  item,
  isSelected,
  onToggleSelect,
  onView,
  onViewImage,
  onUpdateItem,
  onDeleteItem,
  memoryOwnerId,
  memoryTitle,
  memoryThumbnail,
  memoryCreatedDate,
  memoryImages = [],
  index,
  isHidden = false,
  isCar = false
}: MemoryDetailsMediaItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Load crop settings from localStorage
  const [cropData, setCropData] = useState<{x: number; y: number; width: number; height: number; zoom: number; imageWidth?: number; imageHeight?: number} | null>(null);

  useEffect(() => {
    try {
      // 1. Check if item has crop_data from database
      if (item.crop_data) {
        console.log('📊 Loading crop data from database for item:', item.id, item.crop_data);
        setCropData(item.crop_data);

        // 2. Sync database crop data to localStorage
        const savedCrops = JSON.parse(localStorage.getItem('imageCropSettings') || '{}');
        savedCrops[item.id] = item.crop_data;
        localStorage.setItem('imageCropSettings', JSON.stringify(savedCrops));
        console.log('✅ Synced database crop to localStorage');
      } else {
        // 3. Fallback to localStorage if no database crop data
        const savedCrops = JSON.parse(localStorage.getItem('imageCropSettings') || '{}');
        if (savedCrops[item.id]) {
          console.log('📦 Loading crop data from localStorage for item:', item.id);
          setCropData(savedCrops[item.id]);
        }
      }
    } catch (error) {
      console.error('Error loading crop settings:', error);
    }
  }, [item.id, item.crop_data]);

  // Debug logging for source
  console.log(`🎯 MemoryDetailsMediaItem ${item.id}:`, {
    hasSource: !!item.source,
    sourceValue: item.source,
    sourceType: typeof item.source,
    itemType: item.type,
    willShowSourceBadge: !!item.source,
    willShowTypeBadge: !item.source && item.type !== 'image'
  });

  const handleDeleteClick = async () => {
    setIsDeleting(true);
    try {
      await onDeleteItem(item.id);
    } catch (error) {
      console.error('Error deleting item:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (sizeInBytes: string | number) => {
    const bytes = typeof sizeInBytes === 'string' ? parseInt(sizeInBytes) : sizeInBytes;
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      // Format as "M/D/YYYY" to match the screenshot
      return date.toLocaleDateString('en-US', { 
        month: 'numeric', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  const getMediaIcon = () => {
    switch (item.type) {
      case 'video':
        return <Play className="w-3 h-3" />;
      case 'text':
        return <FileText className="w-3 h-3" />;
      default:
        return <ImageIcon className="w-3 h-3" />;
    }
  };

  return (
    <div className={`group relative bg-white rounded-lg border transition-all duration-200 hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-1 ${
      isSelected ? 'border-[#6C60FF] ring-2 ring-[#6C60FF]/20' : 'border-gray-200 hover:border-gray-300'
    }`}>
      {/* Selection Checkbox - Only show if onToggleSelect is provided */}
      {onToggleSelect && (
        <div
          className="absolute top-2 left-2 z-[1] w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all duration-150 cursor-pointer"
          style={{
            backgroundColor: isSelected ? '#0075FF' : 'white',
            borderColor: isSelected ? '#0075FF' : '#d1d5db',
          }}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(item.id); }}
        >
          {isSelected && (
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      )}


      {/* Media Preview */}
      <div className="group aspect-square relative overflow-hidden rounded-t-lg bg-gray-100">
        {cropData && cropData.imageWidth && cropData.imageHeight ? (
          // Precise crop display
          <div
            className="w-full h-full overflow-hidden cursor-pointer"
            style={{
              transform: `rotate(${item.rotation_angle || 0}deg)`,
            }}
            onClick={() => {
              console.log('🎬 Image clicked, calling onViewImage with:', {
                src: item.image,
                alt: item.name,
                title: item.name,
                subtitle: `${formatFileSize(item.size)} • ${formatDate(item.date)}`,
                id: item.id
              });
              onViewImage(
                item.image,
                item.name,
                item.name,
                `${formatFileSize(item.size)} • ${formatDate(item.date)}`,
                item.id
              );
            }}
          >
            <ImageWithFallback
              src={item.thumbnail}
              alt={item.name}
              className="object-cover transition-transform duration-200"
              style={{
                position: 'absolute',
                width: `${(cropData.imageWidth / cropData.width) * 100}%`,
                height: `${(cropData.imageHeight / cropData.height) * 100}%`,
                left: `${-(cropData.x / cropData.width) * 100}%`,
                top: `${-(cropData.y / cropData.height) * 100}%`,
                maxWidth: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              fallback={
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  {getMediaIcon()}
                </div>
              }
            />
          </div>
        ) : (
          <div
            className="w-full h-full overflow-hidden"
            style={{
              transform: `rotate(${item.rotation_angle || 0}deg)`,
            }}
          >
            <ImageWithFallback
              src={item.thumbnail}
              alt={item.name}
              className="w-full h-full object-cover cursor-pointer transition-transform duration-200"

              onClick={() => {
                console.log('🎬 Image clicked, calling onViewImage with:', {
                  src: item.image,
                  alt: item.name,
                  title: item.name,
                  subtitle: `${formatFileSize(item.size)} • ${formatDate(item.date)}`,
                  id: item.id
                });
                onViewImage(
                  item.image,
                  item.name,
                  item.name,
                  `${formatFileSize(item.size)} • ${formatDate(item.date)}`,
                  item.id
                );
              }}
              fallback={
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  {getMediaIcon()}
                </div>
              }
            />
          </div>
        )}
        
        {/* Central View Button Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation();
                console.log('🎬 View button clicked, calling onViewImage with:', {
                  src: item.image,
                  alt: item.name,
                  title: item.name,
                  subtitle: `${formatFileSize(item.size)} • ${formatDate(item.date)}`,
                  id: item.id
                });
                onViewImage(
                  item.image,
                  item.name,
                  item.name,
                  `${formatFileSize(item.size)} • ${formatDate(item.date)}`,
                  item.id
                );
              }}
            >
              View
            </Button>
          </div>
        </div>

        {/* Hover Overlay with Edit and Delete Buttons - Only show if handlers are provided */}
        {(onUpdateItem || onDeleteItem) && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 flex gap-1 z-20">
            {onUpdateItem && (
              <EditMediaItemPopover
                item={item}
                onSave={onUpdateItem}
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                memoryOwnerId={memoryOwnerId}
                memoryTitle={memoryTitle}
                memoryThumbnail={memoryThumbnail}
                memoryCreatedDate={memoryCreatedDate}
                memoryImages={memoryImages}
                trigger={
                  <Button
                    size="sm"
                    className="w-8 h-8 p-0 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800 shadow-sm border"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditOpen(true);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                }
              />
            )}
            {onDeleteItem && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick();
                }}
                disabled={isDeleting}
                className="w-8 h-8 p-0 bg-white hover:bg-gray-50 text-red-600 hover:text-red-700 shadow-sm border"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
        
        {/* Number Badge */}
        {index != null && (
          <div className="absolute bottom-2 left-2 z-[1]">
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md bg-[#FFFFFFE5] text-black text-xs font-bold shadow-sm">
              {index}
            </span>
          </div>
        )}

        {/* Source Platform Badge (Facebook, Instagram) */}
        {item.source && (item.source.toLowerCase() === 'facebook' || item.source.toLowerCase() === 'fb' || item.source.toLowerCase() === 'instagram' || item.source.toLowerCase() === 'ig') && (
          <div className={`absolute bottom-2 ${index != null ? 'left-9' : 'left-2'}`}>
            <Badge variant="secondary" className="bg-white/95 backdrop-blur-sm border-0 text-gray-700 text-xs font-medium flex items-center justify-center p-1.5 shadow-md rounded-md">
              {(item.source.toLowerCase() === 'facebook' || item.source.toLowerCase() === 'fb') && (
                <FacebookIcon className="w-5 h-5" />
              )}
              {(item.source.toLowerCase() === 'instagram' || item.source.toLowerCase() === 'ig') && (
                <InstagramIcon className="w-5 h-5" />
              )}
            </Badge>
          </div>
        )}

        {/* Google Photos icon — no background, drop shadow for visibility */}
        {item.source && item.source.toLowerCase() === 'google_photos' && (
          <div className={`absolute bottom-2 ${index != null ? 'left-9' : 'left-2'}`} style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26" fill="none">
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
        )}

        {/* Media Type Badge (only if no source and not an image) */}
        {!item.source && item.type !== 'image' && (
          <div className={`absolute bottom-2 ${index != null ? 'left-9' : 'left-2'}`}>
            <Badge variant="secondary" className="bg-black/70 text-white border-0 text-xs">
              {getMediaIcon()}
              <span className="ml-1 capitalize">{item.type}</span>
            </Badge>
          </div>
        )}

        {/* New Badge */}
        {(item.is_new == 1 || item.is_new === true) && (
          <div className="absolute bottom-2 right-2 z-10">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-yellow-50 border border-yellow-300 text-yellow-700 text-[12px] font-semibold">
              New
            </span>
          </div>
        )}

        {/* Hidden from Media overlay */}
        {isHidden && (
          <>
            {/* Blocking overlay — intercepts all clicks and drags, adds red tint on hover */}
            <div
              className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/20 transition-colors duration-200 z-20 cursor-not-allowed rounded-t-lg"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
            {/* Eye icon centered */}
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-white border border-red-200 flex items-center justify-center shadow-sm">
                <EyeOff className="w-6 h-6 text-red-500" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Media Info */}
      <div className="p-3 space-y-2">
        {/* File Name */}
        <h4 className="font-medium text-sm text-gray-900 truncate" title={item.name}>
          {item.name}
        </h4>

        {/* Title - shown below file name if exists and is different from name */}
        {item.title && item.title.trim() !== '' && item.title !== item.name && (
          <p className="text-xs text-gray-700 font-medium truncate" title={item.title}>
            {item.title}
          </p>
        )}

        {/* Description */}
        {item.description && item.description !== item.name && (
          <p className="text-xs text-gray-600 line-clamp-2" title={item.description}>
            {item.description}
          </p>
        )}

        {/* Location */}
        {(item.location?.displayName || (item.location?.city && item.location?.country)) && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="w-3 h-3" />
            <span className="truncate">
              {item.location.displayName || `${item.location.city}, ${item.location.country}`}
            </span>
          </div>
        )}

        {/* Meta Information */}
        <div className="space-y-1.5">
          {/* Size and Dimensions */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{formatFileSize(item.size)}</span>
            {item.dimensions && (
              <>
                <span>•</span>
                <span>{item.dimensions}</span>
              </>
            )}
          </div>

          {/* Date — hidden for cars (their capture date is synthetic) */}
          {!isCar && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="w-3 h-3" />
            <span>{formatDate(item.date)}</span>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}