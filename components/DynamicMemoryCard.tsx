import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Calendar, Image } from 'lucide-react';

interface DynamicMemoryCardProps {
  title: string;
  location: string;
  date: string;
  imageCount: number;
  thumbnail?: string;
  onClick?: () => void;
}

/**
 * DynamicMemoryCard - A memory card component with intelligent text truncation
 * 
 * Features:
 * - Only truncates location text when it actually overflows
 * - Shows tooltip only for truncated text
 * - Responsive to container size changes
 * - Preserves full text for short locations
 */
export default function DynamicMemoryCard({
  title,
  location,
  date,
  imageCount,
  thumbnail,
  onClick
}: DynamicMemoryCardProps) {
  const [isLocationTruncated, setIsLocationTruncated] = useState(false);
  const locationRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if location text overflows its container
  useEffect(() => {
    const checkOverflow = () => {
      if (locationRef.current) {
        const element = locationRef.current;
        // Compare scroll width with client width to detect overflow
        const isOverflowing = element.scrollWidth > element.clientWidth;
        setIsLocationTruncated(isOverflowing);
      }
    };

    // Initial check
    checkOverflow();

    // Create ResizeObserver for responsive checking
    const resizeObserver = new ResizeObserver(checkOverflow);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Also check on window resize as fallback
    window.addEventListener('resize', checkOverflow);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', checkOverflow);
    };
  }, [location, imageCount]); // Re-check when location or imageCount changes

  return (
    <div 
      ref={containerRef}
      className="relative bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-300 w-full max-w-sm"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative h-48 bg-gradient-to-br from-purple-400 to-blue-500">
        {thumbnail ? (
          <img 
            src={thumbnail} 
            alt={title} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-16 h-16 text-white/50" />
          </div>
        )}
        
        {/* Image count badge - positioned absolute */}
        {imageCount > 0 && (
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-lg text-sm font-medium">
            {imageCount} {imageCount === 1 ? 'image' : 'images'}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
          {title}
        </h3>

        {/* Location and Date Container */}
        <div className="space-y-2">
          {/* Location with dynamic truncation */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 flex-shrink-0 text-gray-400" />
            <span
              ref={locationRef}
              className="overflow-hidden text-ellipsis whitespace-nowrap"
              title={isLocationTruncated ? location : undefined}
              style={{
                maxWidth: imageCount > 0 ? 'calc(100% - 100px)' : '100%',
                cursor: isLocationTruncated ? 'help' : 'default'
              }}
            >
              {location}
            </span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 flex-shrink-0 text-gray-400" />
            <span>{date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Example usage and demo component
 */
export function DynamicMemoryCardDemo() {
  const sampleMemories = [
    {
      title: "Summer Vacation 2024",
      location: "Paris, France",
      date: "July 15-22, 2024",
      imageCount: 45
    },
    {
      title: "Beach Day",
      location: "Santa Monica Beach, Los Angeles, California, United States",
      date: "Aug 5, 2024",
      imageCount: 12
    },
    {
      title: "Mountain Hiking",
      location: "Yosemite National Park, California",
      date: "Sep 10-12, 2024",
      imageCount: 78
    },
    {
      title: "City Tour",
      location: "NYC",
      date: "Oct 1, 2024",
      imageCount: 23
    },
    {
      title: "Family Reunion",
      location: "Grandma's House, 123 Very Long Street Name That Goes On Forever, Smalltown, State, Country",
      date: "Nov 25, 2024",
      imageCount: 156
    }
  ];

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Dynamic Memory Cards - Intelligent Truncation Demo
        </h1>
        
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="font-semibold text-blue-900 mb-2">How it works:</h2>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>• Short locations (like "NYC" or "Paris, France") display fully without truncation</li>
            <li>• Long locations that overflow get truncated with "..."</li>
            <li>• Hover over truncated locations to see the full text in a tooltip</li>
            <li>• The truncation adjusts based on whether there's an image count badge</li>
            <li>• Responsive - try resizing your window!</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sampleMemories.map((memory, index) => (
            <DynamicMemoryCard
              key={index}
              {...memory}
              onClick={() => console.log(`Clicked: ${memory.title}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}