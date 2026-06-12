import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { MapPin, Check, X, Calendar, Image } from "lucide-react";
import { Button } from "./ui/button";
import { InvitedMemory, invitedMemoriesStorage } from "../utils/invitedMemoriesStorage";
import { dashboardAPI } from "../utils/authUtils";

interface InvitedMemoryCardProps {
  memory: InvitedMemory;
  onAccept?: (memoryId: string) => void;
  onReject?: (memoryId: string) => void;
  onCardRemoved?: () => void; // Callback when card is removed
}

export default function InvitedMemoryCard({
  memory,
  onAccept,
  onReject,
  onCardRemoved
}: InvitedMemoryCardProps) {
  const [isLocationTruncated, setIsLocationTruncated] = useState(false);
  const [isLoading, setIsLoading] = useState({ accept: false, reject: false });
  const [isRemoving, setIsRemoving] = useState(false);
  const locationRef = useRef<HTMLSparagraphElement>(null);

  // Check if location text would overlap with image count container
  useEffect(() => {
    const calculateTruncation = () => {
      if (locationRef.current && memory.location) {
        const locationElement = locationRef.current;
        const cardContainer = locationElement.closest('.memory-card-container');
        
        if (!cardContainer) {
          setIsLocationTruncated(false);
          return;
        }

        const imageCountContainer = cardContainer.querySelector('.image-count-container');
        
        if (!imageCountContainer || memory.imagesCount === 0) {
          setIsLocationTruncated(false);
          return;
        }

        // Reset location element to measure natural width
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
  }, [memory.location, memory.imagesCount]);

  // Handle accept invitation
  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(prev => ({ ...prev, accept: true }));

    try {
      // If there's a notification ID, handle the notification
      if (memory.notificationId) {
        const response = await dashboardAPI.acceptNotification(memory.notificationId);
        console.log('Accept notification response:', response);
      }

      // Remove from local storage
      invitedMemoriesStorage.removeInvitedMemory(memory.id);
      
      // Call parent callbacks
      onAccept?.(memory.id);
      
      // Animate removal
      setIsRemoving(true);
      setTimeout(() => {
        onCardRemoved?.();
      }, 300);

      console.log(`Accepted invitation for memory: ${memory.title}`);
    } catch (error) {
      console.error('Error accepting invitation:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, accept: false }));
    }
  };

  // Handle reject invitation
  const handleReject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(prev => ({ ...prev, reject: true }));

    try {
      // If there's a notification ID, handle the notification
      if (memory.notificationId) {
        const response = await dashboardAPI.declineNotification(memory.notificationId);
        console.log('Reject notification response:', response);
      }

      // Remove from local storage
      invitedMemoriesStorage.removeInvitedMemory(memory.id);
      
      // Call parent callbacks
      onReject?.(memory.id);
      
      // Animate removal
      setIsRemoving(true);
      setTimeout(() => {
        onCardRemoved?.();
      }, 300);

      console.log(`Rejected invitation for memory: ${memory.title}`);
    } catch (error) {
      console.error('Error rejecting invitation:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, reject: false }));
    }
  };

  return (
    <div
      className={`memory-card-container bg-center bg-cover bg-no-repeat box-border content-stretch flex flex-col gap-2.5 items-center justify-end p-0 relative rounded-[58px] shadow-[0px_0px_27px_0px_rgba(0,0,0,0.1)] size-full hover:shadow-[0px_0px_30px_0px_rgba(0,0,0,0.2)] hover:ring-2 hover:ring-[#6C60FF]/30 hover:scale-[1.02] transition-all duration-200 ease-out min-w-[210px] max-w-[240px] overflow-hidden ${
        isRemoving ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}
      style={{ 
        backgroundImage: memory.thumbnail ? `url('${memory.thumbnail}')` : 'none',
        backgroundColor: memory.thumbnail ? 'transparent' : '#6C60FF'
      }}
    >
      {/* Fallback background when no image */}
      {!memory.thumbnail && (
        <div className="absolute inset-0 rounded-[58px] bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center">
          <Image className="w-16 h-16 text-white/30" />
        </div>
      )}

      {/* Gradient Overlay */}
      <div className="bg-gradient-to-b from-50% from-[#00000000] h-[280px] relative rounded-[58px] shrink-0 to-[#39313199] to-[95.673%] w-full">
        <div className="flex flex-row items-end justify-center relative size-full">
          <div className="box-border content-stretch flex flex-row gap-1 h-[280px] items-end justify-center px-8 py-6 relative w-full before:absolute before:inset-0 before:bg-gradient-to-t before:from-black/30 before:to-transparent before:pointer-events-none before:rounded-[58px]">
            
            {/* Content */}
            <div className="box-border content-stretch flex flex-col gap-0.5 items-start justify-start p-0 relative shrink-0 w-[228px] z-[1]">
              
              {/* Inviter info */}
              <div className="box-border content-stretch flex flex-row gap-2 items-center justify-start px-2 py-1 relative shrink-0">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={memory.inviter.avatar} alt={memory.inviter.name} />
                  <AvatarFallback className="text-xs">
                    {memory.inviter.name.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-white/90 font-medium text-sm">
                  {memory.inviter.name}
                </span>
              </div>
              
              {/* Title */}
              <div className="relative shrink-0 w-full">
                <div className="flex flex-row items-center justify-center relative size-full">
                  <div className="box-border content-stretch flex flex-row items-center justify-center px-2 py-0 relative w-full">
                    <div className="basis-0 grow min-h-px min-w-px relative shrink-0 text-[#ffffff] text-[21px] text-left">
                      <p className="block font-semibold">{memory.title}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Date Range */}
              <div className="box-border content-stretch flex flex-row gap-2.5 items-center justify-center px-2 py-0 relative rounded-2xl shrink-0">
                <div className="relative shrink-0 flex items-center gap-1 text-[#ffffff] text-[14px]">
                  <Calendar className="w-3 h-3 text-white/80" />
                  <p className="block text-[14px] whitespace-pre">
                    {memory.dateRange}
                  </p>
                </div>
              </div>

              {/* Location */}
              {memory.location && (
                <div className="box-border content-stretch flex flex-row gap-2.5 items-center justify-start px-2 py-0 relative rounded-2xl shrink-0 w-full max-w-full">
                  <div className="relative flex items-center gap-1 text-[#ffffff] text-[14px] min-w-0 w-full">
                    <MapPin className="w-3 h-3 text-white/80 flex-shrink-0" />
                    <p 
                      ref={locationRef}
                      className="block text-[12px] text-white/90"
                      title={isLocationTruncated ? memory.location : undefined}
                      style={{ 
                        cursor: isLocationTruncated ? 'help' : 'default'
                      }}
                    >
                      {memory.location}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invited Category Badge - Top Left */}
      <div className="absolute top-[22px] left-[22px] z-10">
        <div className="bg-pink-500 text-white hover:opacity-90 box-border content-stretch flex flex-row gap-1.5 items-center justify-center px-3 py-1 relative rounded-lg shrink-0 shadow-lg">
          <div className="relative shrink-0 text-white text-[12px] text-nowrap text-center font-medium">
            Invited
          </div>
        </div>
      </div>

      {/* Accept/Reject Buttons - Top Right */}
      <div className="absolute top-[22px] right-[22px] z-10 flex items-center gap-2">
        {/* Accept Button */}
        <Button
          onClick={handleAccept}
          disabled={isLoading.accept || isLoading.reject}
          variant="outline"
          className="!bg-white hover:!bg-gray-100 !text-black px-3 py-1 h-8 text-xs rounded-lg shadow-lg flex items-center gap-1 transition-all duration-200 font-medium !border-gray-200"
        >
          {isLoading.accept ? (
            <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          Accept
        </Button>

        {/* Reject Button */}
        <Button
          onClick={handleReject}
          disabled={isLoading.accept || isLoading.reject}
          variant="outline"
          className="!bg-white hover:!bg-gray-100 !text-black px-3 py-1 h-8 text-xs rounded-lg shadow-lg flex items-center gap-1 transition-all duration-200 font-medium !border-gray-200"
        >
          {isLoading.reject ? (
            <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <X className="w-3 h-3" />
          )}
          No
        </Button>
      </div>

      {/* Images Counter - Bottom Right */}
      {memory.imagesCount > 0 && (
        <div className="image-count-container absolute bottom-[22px] right-[22px] z-20">
          <div className="bg-black/60 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-1 shadow-lg">
            <div className="text-white text-[12px] font-medium whitespace-nowrap">
              {memory.imagesCount} image{memory.imagesCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}