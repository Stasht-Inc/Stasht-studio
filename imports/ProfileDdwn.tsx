import { useState, useRef, useEffect } from "react";
import svgPaths from "./svg-zb173jafvj";
const imgFemaleAvatar = 'https://images.unsplash.com/photo-1494790108755-2616b612b5bc?w=100&h=100&fit=crop';
import { imgFemaleAvatar1 } from "./svg-2rf14";
import { useAuth } from "../contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { getAdminSwitchData, switchAccount, clearAdminSwitchData } from "../components/AccountChoiceModal";
import { dashboardAPI } from "../utils/authUtils";
import { useProperty } from "../contexts/PropertyContext";

function MaskGroup({ user }: { user?: { name?: string; email?: string; phone_number?: string; profile_image?: string; avatar?: string; profile_color?: string; plan_name?: string; credits?: number; location?: string } }) {
  const getInitials = (name?: string, email?: string, phone_number?: string) => {
    if (name) {
      return name.split(' ').map(word => word.charAt(0)).join('').slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    if (phone_number) {
      return phone_number.charAt(phone_number.length - 1).toUpperCase();
    }
    return 'U';
  };

  // Check for valid image URL (not null, undefined, or empty string)
  const profileImage = (user?.avatar || user?.profile_image) &&
                      (user?.avatar || user?.profile_image) !== 'null' ?
                      (user?.avatar || user?.profile_image) : null;

  const initials = getInitials(user?.name, user?.email, user?.phone_number);
  
  // Format profile_color - add # if missing
  const formatColor = (color?: string) => {
    if (!color) return null;
    return color.startsWith('#') ? color : `#${color}`;
  };
  
  const profileColor = formatColor(user?.profile_color);
  
  // Use profile_color if available, otherwise use default gradient
  const backgroundStyle = profileColor 
    ? { backgroundColor: profileColor }
    : undefined;
  
  const fallbackClassName = profileColor 
    ? "text-white text-sm font-medium flex items-center justify-center w-full h-full"
    : "bg-gradient-to-br from-[#6C60FF] to-purple-600 text-white text-sm font-medium flex items-center justify-center w-full h-full";

  console.log('Avatar Debug:', {
    user,
    profileImage,
    profileColor,
    initials,
    hasProfileColor: !!profileColor
  });

  return (
    <Avatar className="w-[44px] h-[44px]">
      {profileImage && (
        <AvatarImage 
          src={profileImage} 
          alt={user?.name || user?.email || 'User'} 
          className="object-cover"
        />
      )}
      <AvatarFallback 
        className={fallbackClassName}
        style={backgroundStyle}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

function Frame193({ user }: { user?: { name?: string; email?: string; phone_number?: string; profile_image?: string; avatar?: string; profile_color?: string; plan_name?: string; credits?: number; location?: string } }) {
  return (
    <div className="box-border content-stretch flex flex-row items-center justify-center p-0 relative shrink-0 w-11">
      <MaskGroup user={user} />
    </div>
  );
}

// Resolve a property's avatar: when the property was invited by a different
// user/org (e.g. BMW), prefer the inviter's logo from invited_by; otherwise
// fall back to the property's own image. invited_by may be an object or array.
function resolvePropertyAvatar(property: any, user?: any) {
  const invitedByRaw = property?.invited_by;
  const invitedBy = Array.isArray(invitedByRaw) ? invitedByRaw[0] : invitedByRaw;
  const showInvitedBy = !!invitedBy &&
    String(user?.external_user_id ?? '') !== String(invitedBy.external_user_id ?? '');
  const avatarImage = (showInvitedBy && invitedBy?.profile_image)
    ? invitedBy.profile_image
    : property?.image;
  return { invitedBy, avatarImage };
}

function PropertyHeaderInfo({ property, user }: { property: any; user?: any }) {
  const displayName = property?.name || 'Property Account';
  const location = property?.location;
  const { invitedBy, avatarImage } = resolvePropertyAvatar(property, user);

  return (
    <div className="flex items-center gap-3 justify-start">
      <div className="box-border content-stretch flex flex-row items-center justify-center p-0 relative shrink-0 w-11">
        <div className="w-[44px] h-[44px] rounded-full overflow-hidden bg-purple-100 flex items-center justify-center">
          {avatarImage ? (
            <img src={avatarImage} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          )}
        </div>
      </div>
      <div className="text-[#202224] text-left flex flex-col">
        <div className="flex items-baseline gap-2">
          <p className="block leading-[normal] whitespace-nowrap font-medium">{displayName}</p>
        </div>
        {invitedBy?.name && (
          <p className="text-xs text-gray-600 leading-[normal] truncate mt-0.5" title={invitedBy.name}>{invitedBy.name}</p>
        )}
        <div className="flex items-center gap-1.5 sm:gap-1 mt-1 sm:mt-0.5">
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10.5px] font-medium rounded-full">Property</span>
        </div>
      </div>
    </div>
  );
}

function ProfileInfo({ user }: { user?: { name?: string; email?: string; phone_number?: string; profile_image?: string; avatar?: string; profile_color?: string; plan_name?: string; credits?: number; location?: string } }) {
  const displayName = user?.name || user?.email || user?.phone_number || 'User';
  const planName = user?.plan_name || 'free';
  const credits = user?.credits ?? 0;
  const [isNewUser, setIsNewUser] = useState(() => localStorage.getItem('is_new_user') === 'true');
  useEffect(() => {
    const handler = () => setIsNewUser(false);
    window.addEventListener('is_new_user_removed', handler);
    return () => window.removeEventListener('is_new_user_removed', handler);
  }, []);

  // Get plan badge styling
  const getPlanBadge = (plan: string) => {
    const planLower = plan.toLowerCase();
    if (planLower === 'professional') {
      return { label: 'Professional', className: 'bg-purple-100 text-purple-700', show: true };
    } else if (planLower === 'intermediate') {
      return { label: 'Intermediate', className: 'bg-pink-100 text-pink-700', show: true };
    } else {
      return { label: '', className: '', show: false };
    }
  };

  const badge = getPlanBadge(planName);

  return (
    <div className="flex items-center gap-3 justify-start">
      <Frame193 user={user} />
      <div className="text-[#202224] text-left flex flex-col">
        <div className="flex items-baseline gap-2">
          <p className="block leading-[normal] whitespace-nowrap font-medium">{displayName}</p>
        </div>
        {!isNewUser ? (
          <div className="flex items-center gap-1.5 sm:gap-1 mt-1 sm:mt-0.5 bg-[#F5F4FF] sm:bg-transparent px-2 sm:px-0 py-1 sm:py-0 rounded-full sm:rounded-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-[13px] sm:h-[13px]" viewBox="0 0 13 13" fill="none">
              <g clipPath="url(#clip0_10034_11794)">
                <path d="M4.08333 7.14581C5.7747 7.14581 7.14583 5.77469 7.14583 4.08331C7.14583 2.39194 5.7747 1.02081 4.08333 1.02081C2.39196 1.02081 1.02083 2.39194 1.02083 4.08331C1.02083 5.77469 2.39196 7.14581 4.08333 7.14581Z" stroke="#6C60FF" strokeWidth="1.02083" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9.23342 5.29303C9.71593 5.47291 10.1453 5.77156 10.4818 6.16135C10.8183 6.55114 11.0511 7.01948 11.1586 7.52307C11.2661 8.02667 11.2449 8.54924 11.097 9.04247C10.949 9.5357 10.6791 9.98367 10.3122 10.3449C9.9452 10.7062 9.49308 10.9691 8.9976 11.1093C8.50212 11.2496 7.97928 11.2626 7.47743 11.1472C6.97558 11.0319 6.51092 10.7918 6.12643 10.4493C5.74194 10.1067 5.45003 9.67276 5.27769 9.18751" stroke="#6C60FF" strokeWidth="1.02083" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3.57292 3.0625H4.08334V5.10417" stroke="#6C60FF" strokeWidth="1.02083" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8.52904 7.08459L8.88634 7.44699L7.44696 8.88637" stroke="#6C60FF" strokeWidth="1.02083" strokeLinecap="round" strokeLinejoin="round"/>
              </g>
              <defs>
                <clipPath id="clip0_10034_11794">
                  <rect width="12.25" height="12.25" fill="white"/>
                </clipPath>
              </defs>
            </svg>
            <span className="text-[#4A5565] font-medium sm:font-normal text-xs sm:text-[10.5px] leading-4 sm:leading-[14px]">{credits} credits</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 mt-1 sm:mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="text-[10px] text-amber-600 font-medium leading-none">Select a plan to unlock</span>
          </div>
        )}

      </div>
    </div>
  );
}

function ChevronRight24Dp5F6368Fill0Wght400Grad0Opsz242({ isOpen }: { isOpen: boolean }) {
  return (
    <div
      className="overflow-clip relative size-full"
      data-name="chevron_right_24dp_5F6368_FILL0_wght400_GRAD0_opsz24 2"
    >
      <div
        className={`absolute bottom-1/4 left-[33.33%] right-[35.83%] top-1/4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        data-name="Vector"
      >
        <svg
          className="block size-full"
          fill="none"
          preserveAspectRatio="none"
          role="presentation"
          viewBox="0 0 8 12"
        >
          <path
            d={svgPaths.p33166380}
            fill="var(--fill-0, #393131)"
            id="Vector"
          />
        </svg>
      </div>
    </div>
  );
}

function LabelPrimary({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <div
      className="absolute contents left-0 right-0 top-0 cursor-pointer"
      data-name="Label / Primary"
      onClick={onClick}
    >
      <div
        className="absolute inset-0 opacity-20 rounded-[3px] hover:opacity-30 transition-opacity"
        data-name="Rectangle"
      />
      <div className="absolute flex h-5 items-center justify-center left-[20%] right-[20%] top-1/2 translate-y-[-50%]">
        <div className="flex-none rotate-[90deg] size-5">
          <ChevronRight24Dp5F6368Fill0Wght400Grad0Opsz242 isOpen={isOpen} />
        </div>
      </div>
    </div>
  );
}

function Dropdown({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <div
      className="bg-[#ffffff] h-7 relative rounded-lg shadow-[1px_1px_14px_0px_rgba(0,0,0,0.15)] shrink-0 w-8 hover:shadow-[1px_1px_18px_0px_rgba(0,0,0,0.2)] transition-all duration-200 hover:border hover:border-[#6C60FF]/20"
      data-name="Dropdown"
    >
      <LabelPrimary isOpen={isOpen} onClick={onClick} />
    </div>
  );
}

export function ProfileDropdownMenu({ isOpen, onClose, user, onShowProfileSettings, onShowBillingPayment, viewType, currentProperty, switchToPersonal }: { isOpen: boolean; onClose: () => void; user?: { name?: string; email?: string; phone_number?: string; profile_image?: string; avatar?: string; profile_color?: string; plan_name?: string; credits?: number; location?: string }; onShowProfileSettings?: () => void; onShowBillingPayment?: () => void; viewType?: string; currentProperty?: any; switchToPersonal?: () => void }) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { logout, updateUser } = useAuth();
  const { switchToProperty } = useProperty();
  const [isNewUser, setIsNewUser] = useState(() => localStorage.getItem('is_new_user') === 'true');
  useEffect(() => {
    const handler = () => setIsNewUser(false);
    window.addEventListener('is_new_user_removed', handler);
    return () => window.removeEventListener('is_new_user_removed', handler);
  }, []);
  const [freshUserData, setFreshUserData] = useState<any>(null);
  const [isLoadingFresh, setIsLoadingFresh] = useState(false);
  const [ownedProperties, setOwnedProperties] = useState<any[]>([]);
  const [sharedProperties, setSharedProperties] = useState<any[]>([]);
  const [propertyCounts, setPropertyCounts] = useState({ owned: 0, shared: 0, total: 0 });
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [isPropertySectionExpanded, setIsPropertySectionExpanded] = useState(false);

  // Check for admin switch data
  const adminSwitchData = getAdminSwitchData();
  const hasAdminAccess = adminSwitchData?.has_admin_access || false;
  const currentMode = adminSwitchData?.current_mode || 'personal';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleSignOut = async () => {
    console.log('ProfileDropdownMenu: Sign out clicked');
    // Clear admin switch data on logout
    clearAdminSwitchData();
    await logout();
    onClose();
  };

  const handleProfileSettings = () => {
    console.log('ProfileDropdownMenu: Profile Settings clicked');
    console.log('onShowProfileSettings function:', onShowProfileSettings);
    if (onShowProfileSettings) {
      console.log('Calling onShowProfileSettings...');
      onShowProfileSettings();
    } else {
      console.log('onShowProfileSettings is not defined!');
    }
    onClose();
  };

  const handleBillingPayment = () => {
    console.log('ProfileDropdownMenu: Billing & Payment clicked');
    if (onShowBillingPayment) {
      onShowBillingPayment();
    }
    onClose();
  };

  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [isAdminSectionExpanded, setIsAdminSectionExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [propertySearchQuery, setPropertySearchQuery] = useState('');

  // Separate admin collaborators from properties
  const actualAdminAccounts = adminSwitchData?.admin_accounts?.filter(admin =>
    !String(admin.owner_id || '').startsWith('property_')
  ) || [];

  // Filter admin accounts based on search query
  const filteredAdminAccounts = actualAdminAccounts.filter(admin => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const name = (admin.user?.name || '').toLowerCase();
    const email = (admin.user?.email || '').toLowerCase();
    const location = (admin.user?.location || '').toLowerCase();

    return name.includes(query) || email.includes(query) || location.includes(query);
  });

  const showSearchBar = actualAdminAccounts.length > 6;

  const filteredOwnedProperties = ownedProperties.filter(p => {
    if (!propertySearchQuery.trim()) return true;
    const q = propertySearchQuery.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q);
  });

  const filteredSharedProperties = sharedProperties.filter(p => {
    if (!propertySearchQuery.trim()) return true;
    const q = propertySearchQuery.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q);
  });

  const handleSwitchToPersonal = async () => {
    console.log('ProfileDropdownMenu: Switch to Personal clicked');

    setSwitchingAccountId('personal');
    try {
      const success = await switchAccount(null);  // null = switch to personal
      if (success) {
        console.log('Switching to personal account, reloading page...');
        onClose();
        window.location.reload();
      } else {
        console.log('Switch account failed - no admin switch data or API error');
        setSwitchingAccountId(null);
      }
    } catch (error) {
      console.error('Switch account error:', error);
      setSwitchingAccountId(null);
    }
  };

  const handleSwitchToAdmin = async (ownerId: string) => {
    console.log('ProfileDropdownMenu: Switch to Admin clicked, owner_id:', ownerId);

    setSwitchingAccountId(ownerId);
    try {
      const success = await switchAccount(ownerId);  // Pass specific owner_id
      if (success) {
        console.log('Switching to admin account, reloading page...');
        onClose();
        window.location.reload();
      } else {
        console.log('Switch account failed - no admin switch data or API error');
        setSwitchingAccountId(null);
      }
    } catch (error) {
      console.error('Switch account error:', error);
      setSwitchingAccountId(null);
    }
  };

  // 📍 DEBUG: Track user prop changes ALWAYS (regardless of dropdown state)
  useEffect(() => {
    console.log('📍 ProfileDropdownMenu: User prop changed from ProfileSection:', user);
    console.log('📍 ProfileDropdownMenu: User location:', user?.location);
    console.log('📍 ProfileDropdownMenu: User email:', user?.email);
  }, [user]);

  // 🔄 FETCH FRESH USER DATA: When dropdown opens, fetch latest data from server
  useEffect(() => {
    if (isOpen) {
      console.log('🔄 ProfileDropdownMenu: Dropdown opened - fetching fresh user data from API');
      setIsLoadingFresh(true);

      // Fetch fresh user profile data from server
      const fetchData = async () => {
        try {
          const response = await dashboardAPI.getUserProfile();
          console.log('🔄 ProfileDropdownMenu: ===== API RESPONSE RECEIVED =====');
          console.log('🔄 ProfileDropdownMenu: Full response:', JSON.stringify(response, null, 2));

          // CRITICAL FIX: API response is double-nested
          // response.data.data.user (not response.data.user)
          const apiUser = response.data?.data?.user || response.data?.user;
          console.log('🔄 ProfileDropdownMenu: Extracted apiUser:', apiUser);

          if (response.success && apiUser) {
            console.log('✅ ProfileDropdownMenu: ===== SUCCESS =====');
            console.log('✅ ProfileDropdownMenu: Fresh user data received:', apiUser);
            console.log('📍 ProfileDropdownMenu: Fresh location from API:', apiUser.location);

            // CRITICAL: ONLY store the location, don't touch anything else
            // This prevents messing up profile picture, badges, or any other data
            setFreshUserData({ location: apiUser.location });
            console.log('✅ ProfileDropdownMenu: Stored only location in freshUserData');

            setIsLoadingFresh(false);
          } else {
            console.error('❌ ProfileDropdownMenu: API response not successful:', response);
            setIsLoadingFresh(false);
          }
        } catch (error) {
          console.error('❌ ProfileDropdownMenu: Exception during API call:', error);
          setIsLoadingFresh(false);
        }
      };

      fetchData();
    } else {
      // Reset fresh data when dropdown closes so next open fetches fresh
      console.log('🔄 ProfileDropdownMenu: Dropdown closed - resetting fresh data');
      setFreshUserData(null);
      setIsLoadingFresh(false);
    }
  }, [isOpen, updateUser]);

  // Fetch properties when dropdown opens
  useEffect(() => {
    if (isOpen) {
      console.log('🏠 ProfileDropdownMenu: Fetching properties');
      setIsLoadingProperties(true);

      const fetchProperties = async () => {
        try {
          const response = await dashboardAPI.getProperties();
          console.log('🏠 ProfileDropdown: Full API response:', JSON.stringify(response, null, 2));
          console.log('🏠 ProfileDropdown: response.data:', response.data);
          console.log('🏠 ProfileDropdown: response.status:', response.status);
          console.log('🏠 ProfileDropdown: response.success:', response.success);

          if ((response.success || response.status === 'success') && response.data) {
            // Handle nested response structures
            // Try: response.data.owned_properties or response.data.data.owned_properties
            let ownedProps = [];
            let sharedProps = [];
            let counts = { owned: 0, shared: 0, total: 0 };

            // Check different possible structures
            if (response.data.owned_properties !== undefined) {
              // Direct: response.data.owned_properties
              ownedProps = response.data.owned_properties || [];
              sharedProps = response.data.shared_properties || [];
              counts = {
                owned: response.data.owned_count || ownedProps.length,
                shared: response.data.shared_count || sharedProps.length,
                total: response.data.total_count || (ownedProps.length + sharedProps.length)
              };
              console.log('🏠 ProfileDropdown: Using direct structure (response.data.owned_properties)');
            } else if (response.data.data?.owned_properties !== undefined) {
              // Nested: response.data.data.owned_properties
              ownedProps = response.data.data.owned_properties || [];
              sharedProps = response.data.data.shared_properties || [];
              counts = {
                owned: response.data.data.owned_count || ownedProps.length,
                shared: response.data.data.shared_count || sharedProps.length,
                total: response.data.data.total_count || (ownedProps.length + sharedProps.length)
              };
              console.log('🏠 ProfileDropdown: Using nested structure (response.data.data.owned_properties)');
            } else {
              // Fallback: Old structure
              const allProps = response.data.properties || response.data.data?.properties || response.data.data?.all_properties || response.data.all_properties || [];
              ownedProps = allProps.filter((p: any) => p.is_creator === true);
              sharedProps = allProps.filter((p: any) => p.is_creator === false);
              counts = {
                owned: ownedProps.length,
                shared: sharedProps.length,
                total: allProps.length
              };
              console.log('🏠 ProfileDropdown: Using fallback structure, filtering by is_creator');
            }

            console.log('🏠 ProfileDropdown: Owned properties:', ownedProps);
            console.log('🏠 ProfileDropdown: Shared properties:', sharedProps);
            console.log('🏠 ProfileDropdown: Counts:', counts);

            setOwnedProperties(ownedProps);
            setSharedProperties(sharedProps);
            setPropertyCounts(counts);
          } else {
            console.error('❌ ProfileDropdown: Invalid response structure');
          }
        } catch (error) {
          console.error('❌ ProfileDropdown: Error fetching properties:', error);
        } finally {
          setIsLoadingProperties(false);
        }
      };

      fetchProperties();
    } else {
      // Reset properties when dropdown closes
      setOwnedProperties([]);
      setSharedProperties([]);
      setPropertyCounts({ owned: 0, shared: 0, total: 0 });
      setIsPropertySectionExpanded(false);
      setPropertySearchQuery('');
    }
  }, [isOpen]);

  // Debug: Check localStorage and log user data when dropdown opens
  // MUST be called before any conditional returns
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 ProfileDropdownMenu: OPENED - User object:', user);
      console.log('🔍 ProfileDropdownMenu: OPENED - User location:', user?.location);
      console.log('🔍 ProfileDropdownMenu: OPENED - User name:', user?.name);
      console.log('🔍 ProfileDropdownMenu: OPENED - User email:', user?.email);

      // If location is missing, check localStorage
      if (!user?.location) {
        const storedUser = localStorage.getItem('stasht_user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            console.log('🔍 ProfileDropdownMenu: Stored user in localStorage:', parsedUser);
            console.log('🔍 ProfileDropdownMenu: Stored location:', parsedUser.location);
          } catch (e) {
            console.error('Error parsing stored user:', e);
          }
        }
      }
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  // IMPORTANT: Only use fresh location from API, keep everything else from user prop
  // This prevents UI changes to badges and other elements
  const displayLocation = freshUserData?.location || user?.location;

  console.log('🎨 ===== ProfileDropdownMenu RENDER =====');
  console.log('🎨 freshUserData?.location:', freshUserData?.location);
  console.log('🎨 user?.location:', user?.location);
  console.log('🎨 displayLocation (FINAL):', displayLocation);
  console.log('🎨 =====================================');

  const displayName = user?.name || 'User';
  const displayEmail = user?.email || user?.phone_number || 'No contact info';

  // Resolve the current property's avatar (inviter's logo via invited_by, else its own image)
  const { invitedBy: currentPropertyInvitedBy, avatarImage: currentPropertyAvatar } =
    resolvePropertyAvatar(currentProperty, user);

  return (
    <div
      ref={dropdownRef}
      className="absolute right-3 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-3 z-50"
    >
      {/* Property or User Info Section */}
      {viewType === 'property' && currentProperty ? (
        /* Property Info Section */
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg overflow-hidden bg-purple-100 flex items-center justify-center flex-shrink-0">
              {currentPropertyAvatar ? (
                <img src={currentPropertyAvatar} alt={currentProperty.name} className="w-full h-full object-cover" />
              ) : (
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{currentProperty.name || 'Property Account'}</p>
              {currentProperty.location && (
                <p className="text-xs text-gray-500 truncate">{currentProperty.location}</p>
              )}
              {/* Show the name of the user who invited / created this property */}
              {currentPropertyInvitedBy?.name && (
                <p className="text-xs text-gray-600 mt-0.5 truncate">
                  {currentPropertyInvitedBy.name}
                </p>
              )}
              {/* Show creator name for shared properties only */}
              {currentProperty.is_creator === false && currentProperty.creator && (
                <p className="text-xs text-gray-600 mt-0.5 truncate">
                  <span className="font-medium">Created by:</span> {currentProperty.creator.name}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* User Info Section */
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <MaskGroup user={user} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
              {displayLocation && (
                <p className="text-xs text-gray-400 mt-0.5 truncate" title={displayLocation}>{displayLocation}</p>
              )}
              {/* Credits - Mobile only (hidden for new users) */}
              {!isNewUser && (
                <div className="flex items-center gap-1.5 mt-1.5 md:hidden">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 13 13" fill="none">
                    <g clipPath="url(#clip0_dropdown_credits)">
                      <path d="M4.08333 7.14581C5.7747 7.14581 7.14583 5.77469 7.14583 4.08331C7.14583 2.39194 5.7747 1.02081 4.08333 1.02081C2.39196 1.02081 1.02083 2.39194 1.02083 4.08331C1.02083 5.77469 2.39196 7.14581 4.08333 7.14581Z" stroke="#6C60FF" strokeWidth="1.02083" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9.23342 5.29303C9.71593 5.47291 10.1453 5.77156 10.4818 6.16135C10.8183 6.55114 11.0511 7.01948 11.1586 7.52307C11.2661 8.02667 11.2449 8.54924 11.097 9.04247C10.949 9.5357 10.6791 9.98367 10.3122 10.3449C9.9452 10.7062 9.49308 10.9691 8.9976 11.1093C8.50212 11.2496 7.97928 11.2626 7.47743 11.1472C6.97558 11.0319 6.51092 10.7918 6.12643 10.4493C5.74194 10.1067 5.45003 9.67276 5.27769 9.18751" stroke="#6C60FF" strokeWidth="1.02083" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3.57292 3.0625H4.08334V5.10417" stroke="#6C60FF" strokeWidth="1.02083" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8.52904 7.08459L8.88634 7.44699L7.44696 8.88637" stroke="#6C60FF" strokeWidth="1.02083" strokeLinecap="round" strokeLinejoin="round"/>
                    </g>
                    <defs>
                      <clipPath id="clip0_dropdown_credits">
                        <rect width="12.25" height="12.25" fill="white"/>
                      </clipPath>
                    </defs>
                  </svg>
                  <span className="text-[#6C60FF] font-medium text-xs">{user?.credits ?? 0} credits</span>
                </div>
              )}

              {/* Lock badge for new users */}
              {isNewUser && (
                <div className="flex items-center gap-1 mt-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span className="text-amber-600 font-medium text-xs">Select a plan to unlock</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div className="py-1">
        {/* Back to Primary Account - Only show when viewing property */}
        {viewType === 'property' && switchToPersonal ? (
          <button
            onClick={() => {
              switchToPersonal();
              onClose();
            }}
            className="w-full px-4 py-2 text-left hover:bg-purple-50 transition-all duration-200 text-purple-700 hover:text-purple-800 flex items-center gap-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            <span className="font-medium">Back to {displayName}</span>
          </button>
        ) : (
          <>
            {/* Personal Account Menu - Only show when NOT viewing property */}
            <button
              onClick={handleBillingPayment}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-all duration-200 text-gray-700 hover:text-gray-900 flex items-center gap-3"
            >
              {/* Credit Card Icon */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={2}/>
                <path d="M2 10h20" strokeWidth={2}/>
              </svg>
              Billing & Payment
            </button>

            <button
              onClick={handleProfileSettings}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-all duration-200 text-gray-700 hover:text-gray-900 flex items-center gap-3"
            >
              {/* User Icon with Circle Background */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth={2}/>
                <circle cx="12" cy="8" r="3" strokeWidth={2}/>
                <path d="M6.168 18.849A6 6 0 0 1 12 16a6 6 0 0 1 5.832 2.849" strokeWidth={2} strokeLinecap="round"/>
              </svg>
              Profile Settings
            </button>

            {/* Property Accounts Section */}
            {propertyCounts.total > 0 && (
          <div className="border-t border-gray-100">
            {/* Property Accounts Header - Collapsible */}
            <button
              onClick={() => setIsPropertySectionExpanded(!isPropertySectionExpanded)}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-all duration-200 flex items-center gap-3"
            >
              <svg className="w-4 h-4 text-[#6C60FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-gray-900 font-medium text-sm">
                  Property Accounts ({propertyCounts.total})
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {propertyCounts.owned} internal, {propertyCounts.shared} external
                </div>
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isPropertySectionExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded Property Accounts Section */}
            {isPropertySectionExpanded && (
              <div className="bg-gray-50 border-t border-gray-100">
                {/* Search Bar */}
                <div className="px-3 py-2">
                  <div className="relative">
                    <svg
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search properties..."
                      value={propertySearchQuery}
                      onChange={(e) => setPropertySearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#6C60FF] focus:border-transparent bg-white"
                    />
                  </div>
                </div>

                {/* Property Accounts List - Scrollable */}
                <div className="max-h-[240px] overflow-y-auto">
                  {/* Owned Properties */}
                  {filteredOwnedProperties.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-purple-50 border-b border-gray-200">
                        <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                          Internal ({filteredOwnedProperties.length})
                        </div>
                      </div>
                      {filteredOwnedProperties.map((property, index) => {
                        const propertyName = property.name || `Property ${index + 1}`;
                        const propertyLocation = property.location || '';
                        const { invitedBy, avatarImage } = resolvePropertyAvatar(property, user);

                        return (
                          <button
                            key={property.id || index}
                            onClick={() => {
                              console.log('🏠 Switching to owned property:', property);
                              localStorage.setItem('view_type', 'property');
                              localStorage.setItem('selected_property', JSON.stringify(property));
                              switchToProperty(property);
                              onClose();
                              window.location.reload();
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-white transition-all duration-200 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg overflow-hidden bg-purple-100 flex items-center justify-center flex-shrink-0">
                                {avatarImage ? (
                                  <img src={avatarImage} alt={propertyName} className="w-full h-full object-cover" />
                                ) : (
                                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-gray-900 font-medium text-sm truncate">
                                  {propertyName}
                                </div>
                                {propertyLocation && (
                                  <div className="text-xs text-gray-500 truncate mt-0.5" title={propertyLocation}>{propertyLocation}</div>
                                )}
                                {invitedBy?.name && (
                                  <div className="text-xs text-gray-600 truncate mt-0.5" title={invitedBy.name}>{invitedBy.name}</div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* Shared Properties */}
                  {filteredSharedProperties.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-blue-50 border-b border-gray-200">
                        <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                          External ({filteredSharedProperties.length})
                        </div>
                      </div>
                      {filteredSharedProperties.map((property, index) => {
                        const propertyName = property.name || `Property ${index + 1}`;
                        const propertyLocation = property.location || '';
                        const userRole = property.user_role || 'viewer';

                        return (
                          <button
                            key={property.id || index}
                            onClick={() => {
                              console.log('🏠 Switching to shared property:', property);
                              localStorage.setItem('view_type', 'property');
                              localStorage.setItem('selected_property', JSON.stringify(property));
                              switchToProperty(property);
                              onClose();
                              window.location.reload();
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-white transition-all duration-200 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg overflow-hidden bg-blue-100 flex items-center justify-center flex-shrink-0">
                                {property.image ? (
                                  <img src={property.image} alt={propertyName} className="w-full h-full object-cover" />
                                ) : (
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-gray-900 font-medium text-sm truncate">
                                  {propertyName}
                                </div>
                                {propertyLocation && (
                                  <div className="text-xs text-gray-500 truncate mt-0.5" title={propertyLocation}>{propertyLocation}</div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* No results */}
                  {filteredOwnedProperties.length === 0 && filteredSharedProperties.length === 0 && (
                    <div className="px-4 py-3 text-center text-gray-500 text-xs">
                      No properties found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Switch Account Buttons - Show all admin accounts if user has admin access */}
        {hasAdminAccess && adminSwitchData && (
          <>
            {currentMode === 'admin' ? (
              // Currently logged in as admin - show "Switch to Personal" button
              <button
                onClick={handleSwitchToPersonal}
                disabled={switchingAccountId === 'personal'}
                className="w-full px-4 py-2 text-left hover:bg-purple-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  {switchingAccountId === 'personal' ? (
                    <svg className="w-4 h-4 animate-spin text-[#6C60FF]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-[#6C60FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[#6C60FF] hover:text-[#5850E5] font-medium text-sm">
                      {switchingAccountId === 'personal'
                        ? 'Switching...'
                        : `Switch to ${adminSwitchData.personal_account?.user?.name || adminSwitchData.personal_account?.user?.email || 'Personal Account'}`
                      }
                    </div>
                    {switchingAccountId !== 'personal' && adminSwitchData.personal_account?.user?.email && adminSwitchData.personal_account?.user?.name && (
                      <div className="text-xs text-gray-500 truncate mt-0.5" title={adminSwitchData.personal_account.user.email}>{adminSwitchData.personal_account.user.email}</div>
                    )}
                    {switchingAccountId !== 'personal' && adminSwitchData.personal_account?.user?.location && (
                      <div className="text-xs text-gray-400 truncate mt-0.5" title={adminSwitchData.personal_account.user.location}>{adminSwitchData.personal_account.user.location}</div>
                    )}
                  </div>
                </div>
              </button>
            ) : (
              // Currently logged in as personal - show collapsible admin accounts section
              <>
                {actualAdminAccounts.length > 0 && (
                  <div className="border-t border-gray-100">
                    {/* Admin Accounts Header - Collapsible */}
                    <button
                      onClick={() => setIsAdminSectionExpanded(!isAdminSectionExpanded)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-all duration-200 flex items-center gap-3"
                    >
                      <svg className="w-4 h-4 text-[#6C60FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-900 font-medium text-sm">
                          Admin Accounts ({actualAdminAccounts.length})
                        </div>
                      </div>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isAdminSectionExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded Admin Accounts Section */}
                    {isAdminSectionExpanded && (
                      <div className="bg-gray-50 border-t border-gray-100">
                        {/* Search Bar - Only show if more than 6 accounts */}
                        {showSearchBar && (
                          <div className="px-4 py-2">
                            <div className="relative">
                              <svg
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <input
                                type="text"
                                placeholder="Search admin accounts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#6C60FF] focus:border-transparent"
                              />
                            </div>
                          </div>
                        )}

                        {/* Admin Accounts List - Scrollable */}
                        <div className="max-h-[240px] overflow-y-auto">
                          {filteredAdminAccounts.length > 0 ? (
                            filteredAdminAccounts.map((adminAccount, index) => {
                              const adminName = adminAccount.user?.name || '';
                              const adminEmail = adminAccount.user?.email || '';
                              const adminDisplayName = adminName || adminEmail || `Admin Account ${index + 1}`;
                              const isCurrentlySwitching = switchingAccountId === adminAccount.owner_id;

                              return (
                                <button
                                  key={adminAccount.owner_id || index}
                                  onClick={() => handleSwitchToAdmin(adminAccount.owner_id)}
                                  disabled={isCurrentlySwitching}
                                  className="w-full px-4 py-2 text-left hover:bg-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="flex items-center gap-3">
                                    {isCurrentlySwitching ? (
                                      <svg className="w-4 h-4 animate-spin text-[#6C60FF]" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4 text-[#6C60FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                      </svg>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <div className="text-gray-900 font-medium text-sm truncate">
                                          {adminDisplayName}
                                        </div>
                                        {adminAccount.isPartialAdmin && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-600 border border-orange-200 flex-shrink-0">
                                            Partial Access
                                          </span>
                                        )}
                                      </div>
                                      {!isCurrentlySwitching && adminEmail && adminName && (
                                        <div className="text-xs text-gray-500 truncate mt-0.5" title={adminEmail}>{adminEmail}</div>
                                      )}
                                      {!isCurrentlySwitching && adminAccount.user?.location && (
                                        <div className="text-xs text-gray-400 truncate mt-0.5" title={adminAccount.user.location}>{adminAccount.user.location}</div>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-4 py-3 text-center text-gray-500 text-xs">
                              No admin accounts found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
          </>
        )}

        {/* Separator and Sign Out - Only show when NOT viewing property */}
        {viewType !== 'property' && (
          <>
            {/* Separator */}
            <div className="border-t border-gray-100 my-1 mx-4"></div>

            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-all duration-200 text-red-600 hover:text-red-700 flex items-center gap-3"
            >
              {/* Sign Out Icon */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ProfileDdwn({ user, onShowProfileSettings, onShowBillingPayment, viewType, currentProperty, switchToPersonal }: { user?: { name?: string; email?: string; phone_number?: string; profile_image?: string; avatar?: string; profile_color?: string; plan_name?: string; credits?: number; location?: string }; onShowProfileSettings?: () => void; onShowBillingPayment?: () => void; viewType?: string; currentProperty?: any; switchToPersonal?: () => void }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // Show property info in the header if viewing property
  const displayInfo = viewType === 'property' && currentProperty ? {
    name: currentProperty.name,
    image: currentProperty.image,
    location: currentProperty.location,
    isProperty: true
  } : {
    ...user,
    isProperty: false
  };

  return (
    <div className="relative size-full" data-name="Profile-ddwn">
      <div
        aria-hidden="true"
        className="absolute border-[0px_1px] border-[rgba(217,218,255,0.56)] border-solid inset-0 pointer-events-none"
      />
      <div className="flex flex-row items-center relative size-full">
        <div className="box-border content-stretch flex flex-row gap-6 items-center justify-start px-8 py-0 relative size-full">
          {viewType === 'property' && currentProperty ? (
            /* Show Property Info in Header */
            <PropertyHeaderInfo property={currentProperty} user={user} />
          ) : (
            /* Show User Info in Header */
            <ProfileInfo user={user} />
          )}
          <Dropdown isOpen={isDropdownOpen} onClick={toggleDropdown} />
        </div>
      </div>
      <ProfileDropdownMenu isOpen={isDropdownOpen} onClose={() => setIsDropdownOpen(false)} user={user} onShowProfileSettings={onShowProfileSettings} onShowBillingPayment={onShowBillingPayment} viewType={viewType} currentProperty={currentProperty} switchToPersonal={switchToPersonal} />
    </div>
  );
}