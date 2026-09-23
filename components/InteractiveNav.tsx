"use client";

import { useState, useRef, useEffect } from "react";
import svgPaths from "../imports/svg-nf2tpvishn";
import imgFemaleAvatar from "figma:asset/4028506cbe6fbc605e7fd310ec471c44bcf1a98a.png";
import { imgFemaleAvatar1 } from "../imports/svg-bahio";
import ProfileDdwn, { ProfileDropdownMenu } from "../imports/ProfileDdwn";
import EnhancedSearch from "./EnhancedSearch";
import { NotificationDropdown } from "./NotificationDropdown";
import { Upload, RefreshCw } from "lucide-react";
import { useProperty } from "../contexts/PropertyContext";

function Layer1() {
  return (
    <div
      className="absolute h-8 translate-x-[-50%] translate-y-[-50%] w-32"
      data-name="Layer_1"
      style={{ top: "calc(50% + 0.5px)", left: "calc(50% + 0.5px)" }}
    >
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 160 41"
      >
        <g clipPath="url(#clip0_1_227)" id="Layer_1">
          <path
            d={svgPaths.p2234ac00}
            fill="var(--fill-0, #6C60FF)"
            id="Vector"
          />
          <path
            d={svgPaths.p11dda00}
            fill="var(--fill-0, #6C60FF)"
            id="Vector_2"
          />
          <path
            d={svgPaths.p3c127480}
            fill="var(--fill-0, #6C60FF)"
            id="Vector_3"
          />
          <path
            d={svgPaths.p15b5dc00}
            fill="var(--fill-0, #6C60FF)"
            id="Vector_4"
          />
          <path
            d={svgPaths.p5c0f300}
            fill="var(--fill-0, #6C60FF)"
            id="Vector_5"
          />
          <path
            d={svgPaths.p1fd0ff80}
            fill="var(--fill-0, #6C60FF)"
            id="Vector_6"
          />
          <path
            d={svgPaths.p23020900}
            fill="var(--fill-0, #6C60FF)"
            id="Vector_7"
          />
        </g>
        <defs>
          <clipPath id="clip0_1_227">
            <rect fill="white" height="41" width="160" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Stasht() {
  return (
    <div className="h-20 relative shrink-0 cursor-pointer hover:opacity-80 transition-opacity flex items-end px-4" data-name="Stasht">
      <div className="h-20 relative w-32 md:w-40">
        <Layer1 />
      </div>
      <div className="hidden md:block text-sm text-gray-700 pb-6 -ml-2">
        Studio 1.5
      </div>
    </div>
  );
}

function UploadMediaButton({ onClick }: { onClick?: (files: File[]) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    console.log('🎯 Upload Media button clicked');
    // Trigger the file input
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    console.log('🎯 Files selected:', files.length);

    if (files.length > 0 && onClick) {
      // Pass the files to the handler
      onClick(files);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <button
        onClick={handleClick}
        className="flex items-center gap-2 px-4 py-2 border border-[#6C60FF] text-[#6C60FF] rounded-lg hover:bg-[#6C60FF]/10 transition-all duration-200"
      >
        <Upload className="w-4 h-4" />
        <span className="font-medium text-sm">Upload Media</span>
      </button>
    </>
  );
}

function Frame222({ searchQuery, setSearchQuery, onSearch, onItemSelect }: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearch: (query: string) => void;
  onItemSelect?: (item: { id: string; type: 'memory' | 'media' | 'user' | 'published'; text: string }) => void;
}) {
  return (
    <div className="box-border content-stretch flex flex-row gap-2.5 h-20 items-center justify-center px-5 py-3 relative flex-1 max-w-4xl">
      <EnhancedSearch 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
        onSearch={onSearch}
        onItemSelect={onItemSelect}
      />
    </div>
  );
}

function Notifications() {
  return (
    <div
      className="mr-[-4px] relative shrink-0 size-6 min-[576px]:size-8 md:size-6"
      data-name="notifications"
    >
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 32 32"
      >
        <g id="notifications">
          <path d={svgPaths.p771b200} fill="var(--fill-0, #1D1B20)" id="icon" />
        </g>
      </svg>
    </div>
  );
}

function Badge({ count, onClick }: { count: number; onClick: () => void }) {
  console.log('🔔 Badge component received count:', count);

  // Don't render badge when count is 0
  if (count === 0) {
    return null;
  }

  return (
    <div
      className="box-border content-stretch flex flex-row gap-2 items-center justify-center ml-0 px-1.5 py-0.5 relative rounded-md shrink-0 min-w-[18px] h-[18px] cursor-pointer transition-colors bg-red-600 hover:bg-red-700"
      data-name="Badge"
      onClick={onClick}
    >
      <div className="relative shrink-0 text-white text-[12px] font-semibold text-center text-nowrap">
        <p className="block leading-[14px] whitespace-pre">{count}</p>
      </div>
    </div>
  );
}

// Lets users on the PWA/installed app (where a hard refresh isn't available)
// force-update to the latest deployed build, instead of only picking it up
// whenever the service worker happens to check in the background.
function RefreshAppButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.update()));
      }
    } catch (error) {
      console.warn('Service worker update check failed:', error);
    } finally {
      window.location.reload();
    }
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isRefreshing}
      title="Refresh to get the latest version"
      aria-label="Refresh to get the latest version"
      className="flex items-center justify-center size-6 min-[576px]:size-8 md:size-6 text-gray-700 hover:opacity-70 transition-opacity disabled:opacity-40"
    >
      <RefreshCw className={`size-4 min-[576px]:size-5 md:size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
    </button>
  );
}

function Frame223({ notificationCount, onNotificationClick }: {
  notificationCount: number;
  onNotificationClick: () => void;
}) {
  return (
    <div className="box-border content-stretch flex flex-row items-center justify-start pl-0 pr-1 py-0 relative shrink-0">
      <div className="relative">
        <div
          className="cursor-pointer hover:opacity-70 transition-opacity"
          onClick={onNotificationClick} // Always allow clicking, regardless of count
        >
          <Notifications />
        </div>
        <div className="absolute -top-2 -right-5">
          <Badge count={notificationCount} onClick={onNotificationClick} />
        </div>
      </div>
    </div>
  );
}

function NotifBttn({ notificationCount, onNotificationClick, onMemorySelect, onOpenConversation, onOpenLead }: {
  notificationCount: number;
  onNotificationClick: () => void;
  onMemorySelect?: (memoryId: string, options?: any) => void;
  onOpenConversation?: (leadId: number) => void;
  onOpenLead?: (leadId: number) => void;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dynamicNotificationCount, setDynamicNotificationCount] = useState(notificationCount);
  const notificationRef = useRef<HTMLDivElement>(null);
  const markAllAsReadRef = useRef<(() => Promise<void>) | null>(null);

  // Update dynamic count when prop changes
  useEffect(() => {
    setDynamicNotificationCount(notificationCount);
  }, [notificationCount]);

  const handleNotificationClick = async () => {
    // If dropdown is open and we're closing it, mark all as read
    if (isDropdownOpen && markAllAsReadRef.current) {
      console.log('🔔 Bell icon clicked to close - marking all as read');
      await markAllAsReadRef.current();
    }

    setIsDropdownOpen(!isDropdownOpen);
    onNotificationClick(); // Keep existing functionality
  };

  const handleNotificationCountChange = (count: number) => {
    console.log('🔔 InteractiveNav received count update:', count);
    setDynamicNotificationCount(count);
  };

  const handleClose = async () => {
    // Mark all as read when closing via any method
    if (markAllAsReadRef.current) {
      console.log('🔔 Dropdown closing - marking all as read');
      await markAllAsReadRef.current();
    }
    setIsDropdownOpen(false);
  };

  return (
    <div
      className="box-border content-stretch flex flex-row h-14 min-[576px]:h-20 items-center justify-end px-1 min-[576px]:px-2 md:px-3 lg:px-6 py-0 relative"
      data-name="Notif-bttn"
      ref={notificationRef}
    >
      <Frame223
        notificationCount={dynamicNotificationCount}
        onNotificationClick={handleNotificationClick}
      />
      <NotificationDropdown
        isOpen={isDropdownOpen}
        onClose={handleClose}
        anchorRef={notificationRef}
        onNotificationCountChange={handleNotificationCountChange}
        onMemorySelect={onMemorySelect}
        onOpenConversation={onOpenConversation}
        onOpenLead={onOpenLead}
        onMarkAllAsReadRef={(fn) => { markAllAsReadRef.current = fn; }}
      />
    </div>
  );
}

function SearchIcon({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="cursor-pointer hover:opacity-70 transition-opacity p-1.5 min-[576px]:p-2"
      onClick={onClick}
    >
      <svg
        className="w-6 h-6 min-[576px]:w-8 min-[576px]:h-8 md:w-6 md:h-6 text-gray-700"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>
  );
}

function MobileProfileAvatar({ user, onShowProfileSettings, onShowBillingPayment, viewType, currentProperty, switchToPersonal }: { user?: any; onShowProfileSettings?: () => void; onShowBillingPayment?: () => void; viewType?: string; currentProperty?: any; switchToPersonal?: () => void }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(word => word.charAt(0)).join('').slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const profileImage = (user?.avatar || user?.profile_image) &&
                      (user?.avatar || user?.profile_image) !== 'null' ?
                      (user?.avatar || user?.profile_image) : null;

  const initials = getInitials(user?.name, user?.email);

  const formatColor = (color?: string) => {
    if (!color) return null;
    return color.startsWith('#') ? color : `#${color}`;
  };

  const profileColor = formatColor(user?.profile_color);

  const backgroundStyle = profileColor
    ? { backgroundColor: profileColor }
    : { background: 'linear-gradient(135deg, #E91E63 0%, #C2185B 100%)' };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="w-8 h-8 min-[576px]:w-10 min-[576px]:h-10 md:w-10 md:h-10 rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
        style={backgroundStyle}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        {profileImage ? (
          <img
            src={profileImage}
            alt={user?.name || user?.email || 'User'}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-white text-sm md:text-sm font-semibold">
            {initials}
          </span>
        )}
      </div>
      <ProfileDropdownMenu
        isOpen={isDropdownOpen}
        onClose={() => setIsDropdownOpen(false)}
        user={user}
        onShowProfileSettings={onShowProfileSettings}
        onShowBillingPayment={onShowBillingPayment}
        viewType={viewType}
        currentProperty={currentProperty}
        switchToPersonal={switchToPersonal}
      />
    </div>
  );
}

function ProfileSection({ user, onShowProfileSettings, onShowBillingPayment, viewType, currentProperty, switchToPersonal }: { user?: any; onShowProfileSettings?: () => void; onShowBillingPayment?: () => void; viewType?: string; currentProperty?: any; switchToPersonal?: () => void }) {
  // 📍 DEBUG: Track user prop in ProfileSection
  useEffect(() => {
    console.log('📍 ProfileSection: Received user prop from InteractiveNav:', user);
    console.log('📍 ProfileSection: User location:', user?.location);
    console.log('📍 ProfileSection: User email:', user?.email);
  }, [user]);

  return (
    <div
      className="box-border content-stretch flex flex-row h-20 items-center justify-end px-0 py-0 relative"
      data-name="Profile-section"
    >
      <ProfileDdwn user={user} onShowProfileSettings={onShowProfileSettings} onShowBillingPayment={onShowBillingPayment} viewType={viewType} currentProperty={currentProperty} switchToPersonal={switchToPersonal} />
    </div>
  );
}

export default function InteractiveNav({
  notificationCount = 0,
  onNotificationsClear,
  onMemorySelect,
  onOpenConversation,
  onOpenLead,
  onShowProfileSettings,
  onShowBillingPayment,
  user,
  onOpenMobileSidebar,
  hideMemoryDetailsIcons = false,
  onUploadMedia,
  isPropertyOwner = true
}: {
  notificationCount?: number;
  onNotificationsClear?: () => void;
  onMemorySelect?: (memoryId: string, options?: any) => void;
  onOpenConversation?: (leadId: number) => void;
  onOpenLead?: (leadId: number) => void;
  onShowProfileSettings?: () => void;
  onShowBillingPayment?: () => void;
  user?: any;
  onOpenMobileSidebar?: () => void;
  hideMemoryDetailsIcons?: boolean;
  onUploadMedia?: (files: File[]) => void;
  isPropertyOwner?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const { viewType, currentProperty, switchToPersonal } = useProperty();

  // 📍 DEBUG: Track user prop changes from App.tsx
  useEffect(() => {
    console.log('📍 InteractiveNav: Received user prop from App.tsx:', user);
    console.log('📍 InteractiveNav: User location:', user?.location);
    console.log('📍 InteractiveNav: User email:', user?.email);
  }, [user]);

  const handleSearch = (query: string, filter?: 'all' | 'memories' | 'users' | 'media' | 'published') => {
    console.log('Searching for:', query, 'with filter:', filter);
    // Handle search - currently just logs the search
    // The actual search results are handled in the EnhancedSearch component
  };

  const handleSearchItemSelect = (item: { id: string; type: 'memory' | 'media' | 'user' | 'published'; text: string }) => {
    console.log('🔍 Search item selected:', item);
    console.log('🔍 Item type:', item.type);
    console.log('🔍 Item ID:', item.id);
    console.log('🔍 onMemorySelect available:', !!onMemorySelect);

    if (item.type === 'memory' && onMemorySelect) {
      // Extract memory ID from the suggestion ID (format: "memory-1468")
      const memoryId = item.id.replace('memory-', '');
      console.log('🔍 Extracted memory ID:', memoryId);
      console.log('🔍 Calling onMemorySelect with ID:', memoryId);
      onMemorySelect(memoryId);
    } else if (item.type === 'media') {
      // Handle media navigation - could navigate to media page or specific media
      console.log('Navigate to media:', item.id);
    } else if (item.type === 'user') {
      // Handle user navigation - could show user profile
      console.log('Navigate to user:', item.id);
    } else if (item.type === 'published') {
      // Handle published content navigation
      console.log('Navigate to published:', item.id);
    } else {
      console.log('🔍 No handler for type:', item.type);
    }
  };

  const handleNotificationClick = () => {
    console.log('Notification clicked');
    // Don't clear notifications immediately - let the dropdown handle count updates
    // The NotificationDropdown will update the count based on actual unread notifications
  };

  const handleMobileSearchClick = () => {
    setShowMobileSearch(true);
  };

  return (
    <div
      className="bg-[#ffffff] box-border content-stretch flex flex-row items-center justify-between p-0 relative w-full h-full"
      data-name="Main Nav"
    >
      {/* Logo - left side */}
      <Stasht />

      {/* Desktop Search Bar - hidden on mobile (md: 768px and up) */}
      <div className="hidden md:flex flex-1 justify-center">
        <Frame222
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={handleSearch}
          onItemSelect={handleSearchItemSelect}
        />
      </div>

      {/* Right side icons */}
      <div className="flex items-center gap-4 min-[576px]:gap-9 md:gap-0">
        {/* Refresh — visible on every breakpoint, including the installed PWA,
            where there's no hard-refresh keyboard shortcut available. */}
        <div className="mr-4 md:mr-6">
          <RefreshAppButton />
        </div>
        {/* Upload Media Button - before notifications - Only show for property owners */}
        {onUploadMedia && isPropertyOwner && (
          <div className="hidden md:block mr-4">
            <UploadMediaButton onClick={onUploadMedia} />
          </div>
        )}
        {/* Mobile Sidebar Icon - visible only on mobile, disabled on memory details page */}
        {onOpenMobileSidebar && (
          <div className="md:hidden">
            <button
              onClick={hideMemoryDetailsIcons ? undefined : onOpenMobileSidebar}
              disabled={hideMemoryDetailsIcons}
              className={`p-1.5 min-[576px]:p-2 rounded-lg transition-colors ${hideMemoryDetailsIcons ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100'}`}
            >
              <svg className="w-6 h-6 min-[576px]:w-7 min-[576px]:h-7" width="28" height="28" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.7585 3.15195H4.55355C3.74841 3.15195 3.0957 3.80465 3.0957 4.6098V14.8148C3.0957 15.6199 3.74841 16.2726 4.55355 16.2726H14.7585C15.5637 16.2726 16.2164 15.6199 16.2164 14.8148V4.6098C16.2164 3.80465 15.5637 3.15195 14.7585 3.15195Z" stroke="#4A5565" strokeWidth="1.45785" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7.46924 3.15195V16.2726" stroke="#4A5565" strokeWidth="1.45785" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}

        {/* Mobile Search Icon - visible only on mobile, disabled on memory details page */}
        <div className={`md:hidden ${hideMemoryDetailsIcons ? 'opacity-40 pointer-events-none' : ''}`}>
          <SearchIcon onClick={handleMobileSearchClick} />
        </div>

        {/* Notification Button - modified for mobile */}
        <div className="md:border-l md:border-gray-100">
          <NotifBttn notificationCount={notificationCount} onNotificationClick={handleNotificationClick} onMemorySelect={onMemorySelect} onOpenConversation={onOpenConversation} onOpenLead={onOpenLead} />
        </div>

        {/* Profile Section - desktop version */}
        <div className={`hidden md:block ${hideMemoryDetailsIcons ? 'ml-8' : ''}`}>
          <ProfileSection user={user} onShowProfileSettings={onShowProfileSettings} onShowBillingPayment={onShowBillingPayment} viewType={viewType} currentProperty={currentProperty} switchToPersonal={switchToPersonal} />
        </div>

        {/* Mobile Profile Avatar - visible only on mobile */}
        <div className={`md:hidden pr-2 min-[576px]:pr-4 ${hideMemoryDetailsIcons ? 'ml-3 min-[576px]:ml-6' : 'ml-4'}`}>
          <MobileProfileAvatar user={user} onShowProfileSettings={onShowProfileSettings} onShowBillingPayment={onShowBillingPayment} viewType={viewType} currentProperty={currentProperty} switchToPersonal={switchToPersonal} />
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {showMobileSearch && (
        <div className="fixed inset-0 bg-white z-50 md:hidden">
          <div className="flex items-center p-4 border-b border-gray-200">
            <button
              onClick={() => setShowMobileSearch(false)}
              className="mr-3 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <Frame222
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSearch={handleSearch}
                onItemSelect={(item) => {
                  handleSearchItemSelect(item);
                  setShowMobileSearch(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}