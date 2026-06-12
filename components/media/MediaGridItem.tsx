import React, { useState, useEffect, useRef } from "react";
import { Play, Image as ImageIcon, FolderOpen, MapPin, MessageSquare, Calendar, Tag } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { MediaItem } from "../../types/mediaTypes";
import { getCategoryColor, getLabelColor } from "../../constants/mediaConstants";
import { FacebookIcon } from "../icons/FacebookIcon";
import { InstagramIcon } from "../icons/InstagramIcon";

interface MediaGridItemProps {
  item: MediaItem;
  isSelected: boolean;
  onToggleSelect: (item: MediaItem) => void;
  onView: (item: MediaItem) => void;
  onViewImage: (src: string, alt: string, title?: string, subtitle?: string, imageId?: string) => void;
  categories?: any[];
}

function TagOverlay({ tags }: { tags: string[] }) {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const firstTag = tags[0];
  const remaining = tags.slice(1);

  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPopover]);

  if (!firstTag) return null;

  return (
    <div className="absolute top-2 right-2 z-[2] flex items-center gap-1" ref={popoverRef}>
      <span className="bg-gray-500/80 backdrop-blur-sm text-white text-[11px] font-medium px-2 py-0.5 rounded-full truncate max-w-[90px]">
        {firstTag}
      </span>
      {remaining.length > 0 && (
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowPopover(p => !p); }}
            className="bg-gray-500/80 backdrop-blur-sm text-white text-[11px] font-medium px-1.5 py-0.5 rounded-full hover:bg-gray-600/90 transition-colors"
          >
            +{remaining.length}
          </button>
          {showPopover && (
            <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[120px] z-50">
              <div className="flex flex-wrap gap-1">
                {remaining.map(tag => (
                  <span key={tag} className="bg-gray-100 text-gray-700 text-[11px] px-2 py-0.5 rounded-full font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MediaGridItem({
  item,
  isSelected,
  onToggleSelect,
  onView,
  onViewImage,
  categories = []
}: MediaGridItemProps) {
  // Load crop settings from localStorage
  const [cropData, setCropData] = useState<{x: number; y: number; width: number; height: number; zoom: number; imageWidth?: number; imageHeight?: number} | null>(null);

  useEffect(() => {
    try {
      // 1. Check if item has crop_data from database
      if (item.crop_data) {
        setCropData(item.crop_data);

        // 2. Sync database crop data to localStorage
        const savedCrops = JSON.parse(localStorage.getItem('imageCropSettings') || '{}');
        savedCrops[item.id] = item.crop_data;
        localStorage.setItem('imageCropSettings', JSON.stringify(savedCrops));
      } else {
        // 3. Fallback to localStorage if no database crop data
        const savedCrops = JSON.parse(localStorage.getItem('imageCropSettings') || '{}');
        if (savedCrops[item.id]) {
          setCropData(savedCrops[item.id]);
        }
      }
    } catch (error) {
      console.error('Error loading crop settings:', error);
    }
  }, [item.id, item.crop_data]);

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
  return (
    <div className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-200">
      {/* Selection checkbox */}
      <div
        className="absolute top-3 left-3 z-[1]"
        onClick={(e) => { e.stopPropagation(); onToggleSelect(item); }}
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

      {/* Type indicator */}
      {item.type === 'video' && (
        <div className="absolute top-2 right-2 z-[1]">
          <div className="bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
            <Play className="w-3 h-3" />
            Video
          </div>
        </div>
      )}

      {/* Thumbnail */}
      <div className="aspect-square w-full overflow-hidden bg-gray-100 relative">
        {cropData && cropData.imageWidth && cropData.imageHeight ? (
          // Precise crop display
          <div
            className="w-full h-full overflow-hidden cursor-pointer"
            style={{
              transform: `rotate(${item.rotation_angle || 0}deg)`,
            }}
            onClick={() => {
              console.log('🔥 MediaGridItem image clicked:', item);
              onViewImage(
                item.thumbnail,
                item.name,
                item.name,
                `${item.size} • ${new Date(item.date).toLocaleDateString()}`,
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
              fallback={
                <div className="w-full h-full bg-gray-200 flex items-center justify-center cursor-pointer" onClick={() => onView(item)}>
                  <ImageIcon className="w-8 h-8 text-gray-400" />
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
                console.log('🔥 MediaGridItem image clicked:', item);
                onViewImage(
                  item.thumbnail,
                  item.name,
                  item.name,
                  `${item.size} • ${new Date(item.date).toLocaleDateString()}`,
                  item.id
                );
              }}
              fallback={
                <div className="w-full h-full bg-gray-200 flex items-center justify-center cursor-pointer" onClick={() => onView(item)}>
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                </div>
              }
            />
          </div>
        )}

        {/* Source Platform Badge (Facebook, Instagram) */}
        {item.source && (item.source.toLowerCase() === 'facebook' || item.source.toLowerCase() === 'fb' || item.source.toLowerCase() === 'instagram' || item.source.toLowerCase() === 'ig') && (
          <div className="absolute bottom-2 left-2">
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
        {item.source && (item.source.toLowerCase() === 'google_photos' || item.source.toLowerCase() === 'google') && (
          <div className="absolute bottom-2 left-2" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>
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

        {/* Tags overlay */}
        {item.tags && item.tags.length > 0 && (
          <TagOverlay tags={item.tags} />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="space-y-2">
          {/* 1. Category badge with memory title (only show for memories or unassigned, not for service names) */}
          {item.memory && (
            <div
              className="text-xs px-3 py-2 rounded-md flex items-center gap-2"
              style={{
                backgroundColor: getCategoryColor(item.memory.category, categories),
                color: '#FFFFFF'
              }}
            >
              <FolderOpen className="w-4 h-4 flex-shrink-0" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate font-medium text-sm">
                  {item.memory.category}
                </span>
                <span className="truncate text-xs opacity-90">
                  {item.memory.title}
                </span>
              </div>
            </div>
          )}
          {!item.memory && item.category === 'Unassigned' && (
            <div
              className="text-xs px-3 py-2 rounded-md flex items-center gap-2"
              style={{
                backgroundColor: '#9CA3AF',
                color: '#FFFFFF'
              }}
            >
              <FolderOpen className="w-4 h-4 flex-shrink-0" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate font-medium text-sm">
                  Unassigned
                </span>
              </div>
            </div>
          )}

          {/* 2. Date with calendar icon */}
          <div className="flex items-center gap-1.5 text-sm text-gray-700">
            <Calendar className="w-4 h-4" />
            <span>{new Date(item.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</span>
          </div>

          {/* 3. Filename - show hierarchical name for sub-images */}
          <h3 className="text-base font-medium text-gray-900 truncate" title={(item as any).displayName || item.name}>
            {(item as any).displayName || item.name}
          </h3>

          {/* 3.1 Description - shown below filename if exists and different from name */}
          {item.description && item.description.trim() !== '' && item.description !== item.name && (
            <p className="text-sm text-gray-600 line-clamp-2" title={item.description}>
              {item.description}
            </p>
          )}

          {/* 4. Size and Dimensions row with comments badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{item.size}</span>
              {item.dimensions && <span>{item.dimensions}</span>}
            </div>

            {/* Comments Count Badge (if exists) */}
            {item.comments_count !== undefined && item.comments_count > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-[#6C60FF] text-white font-medium">
                <MessageSquare className="w-4 h-4" />
                {item.comments_count}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <Button 
            size="sm" 
            variant="secondary" 
            className="bg-white hover:bg-gray-100"
            onClick={() => onViewImage(
              item.thumbnail, 
              item.name, 
              item.name, 
              `${item.size} • ${new Date(item.date).toLocaleDateString()}`,
              item.id
            )}
          >
            View
          </Button>
        </div>
      </div>
    </div>
  );
}