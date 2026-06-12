import React, { useState } from 'react';
import { X, User, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { dashboardAPI, clearPartialAdminFlags } from '../utils/authUtils';
import { toast } from 'sonner';
import { useProperty } from '../contexts/PropertyContext';

// Collaborator type for admin access
export interface AdminCollaborator {
  owner_id: string;
  memory_id: string | null;
  role: string;
  user_id: string;
  owner_name?: string;
  owner_email?: string;
  location?: string;
  isPartialAdmin?: boolean;
  owner?: {
    id: number;
    external_user_id: number;
    name: string;
    email: string;
    profile_image: string | null;
    location?: string;
  };
}

// Admin switch data structure for localStorage
export interface AdminSwitchData {
  has_admin_access: boolean;
  current_mode: 'admin' | 'personal';
  current_admin_owner_id?: string;  // Track which admin is currently active
  personal_account: {
    user: any;
    token: string;
  };
  admin_accounts: Array<{  // Changed to array to support multiple admins
    owner_id: string;
    user: any;
    token: string;
    isPartialAdmin?: boolean;
  }>;
}

interface AccountChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminCollaborators: AdminCollaborator[];  // Changed to array
  personalUser: any;
  personalToken: string;
  onComplete: () => void;
  ownedProperties?: any[];  // NEW: Properties owned by the user
  sharedProperties?: any[];  // NEW: Properties shared with the user
}

// Helper function to check if user has admin collaborators
// Handles both array and single object from API response
// Returns ALL admin collaborators, not just the first one
export const getAdminCollaborator = (collaborators: any): AdminCollaborator[] => {
  if (!collaborators) {
    console.log('getAdminCollaborator: No collaborators data');
    return [];
  }

  // If it's a single object (not an array), check it directly
  if (!Array.isArray(collaborators)) {
    console.log('getAdminCollaborator: Single object received:', collaborators);
    console.log('getAdminCollaborator: Role value:', collaborators.role);

    // STRICT CHECK: Only return if role is exactly 'admin' (case-insensitive)
    const role = String(collaborators.role || '').toLowerCase();
    if (role === 'admin') {
      console.log('getAdminCollaborator: ✅ Admin role confirmed');
      return [collaborators as AdminCollaborator];
    }

    console.log('getAdminCollaborator: ❌ Not admin role, skipping. Role was:', collaborators.role);
    return [];
  }

  // If it's an array, filter ALL admin collaborators
  console.log('getAdminCollaborator: Array received with', collaborators.length, 'items');

  const adminCollabs = collaborators.filter((c) => {
    const role = String(c.role || '').toLowerCase();
    console.log('getAdminCollaborator: Checking collaborator with role:', c.role, '(normalized:', role, ')');
    return role === 'admin';
  });

  if (adminCollabs.length > 0) {
    console.log('getAdminCollaborator: ✅ Found', adminCollabs.length, 'admin collaborator(s):', adminCollabs);
  } else {
    console.log('getAdminCollaborator: ❌ No admin collaborators found in array');
  }

  return adminCollabs;
};

// Helper function to store admin switch data
export const storeAdminSwitchData = (data: AdminSwitchData) => {
  localStorage.setItem('admin_switch_data', JSON.stringify(data));
};

// Helper function to get admin switch data
export const getAdminSwitchData = (): AdminSwitchData | null => {
  const data = localStorage.getItem('admin_switch_data');
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

// Helper function to clear admin switch data
export const clearAdminSwitchData = () => {
  localStorage.removeItem('admin_switch_data');
};

// Helper function to switch account (used by ProfileDdwn)
// Returns a Promise - needs to be awaited
// If owner_id is provided, switches to that specific admin account
// If owner_id is null/undefined, switches to personal account
export const switchAccount = async (owner_id?: string | null): Promise<boolean> => {
  const switchData = getAdminSwitchData();

  if (!switchData || !switchData.has_admin_access) {
    console.log('switchAccount: No admin switch data found');
    return false;
  }

  console.log('switchAccount: Current mode:', switchData.current_mode);
  console.log('switchAccount: Target owner_id:', owner_id);

  // If owner_id is null/undefined, switch to personal
  if (!owner_id) {
    console.log('switchAccount: Switching to Personal account');
    localStorage.setItem('stasht_user', JSON.stringify(switchData.personal_account.user));
    localStorage.setItem('stasht_token', switchData.personal_account.token);
    switchData.current_mode = 'personal';
    switchData.current_admin_owner_id = undefined;
    localStorage.setItem('admin_switch_data', JSON.stringify(switchData));
    clearPartialAdminFlags();
    return true;
  }

  // Switch to specific Admin account
  console.log('switchAccount: Switching to Admin account with owner_id:', owner_id);

  // Find the admin account in the array
  const adminAccount = switchData.admin_accounts.find(acc => acc.owner_id === owner_id);

  if (!adminAccount) {
    console.error('switchAccount: Admin account not found for owner_id:', owner_id);
    return false;
  }

  // Check if admin account data exists (user and token cached)
  if (adminAccount.user && adminAccount.token) {
    // Admin data already exists, just switch
    console.log('switchAccount: Admin data exists, switching directly');
    console.log('switchAccount: Cached admin user:', adminAccount.user);
    console.log('switchAccount: Cached admin user location:', adminAccount.user.location);
    localStorage.setItem('stasht_user', JSON.stringify(adminAccount.user));
    localStorage.setItem('stasht_token', adminAccount.token);
    switchData.current_mode = 'admin';
    switchData.current_admin_owner_id = owner_id;
    localStorage.setItem('admin_switch_data', JSON.stringify(switchData));
    // Set or clear partial admin flags
    if (adminAccount.isPartialAdmin) {
      const personalEmail = switchData.personal_account.user?.email || '';
      localStorage.setItem('is_partial_admin', 'true');
      localStorage.setItem('partial_admin_email', personalEmail);
      console.log('switchAccount: Set partial admin flags, email:', personalEmail);
    } else {
      clearPartialAdminFlags();
    }
    console.log('switchAccount: User stored in localStorage:', JSON.parse(localStorage.getItem('stasht_user') || '{}'));
    return true;
  } else {
    // Admin data doesn't exist, need to call API
    const isPartial = adminAccount.isPartialAdmin || false;
    console.log('switchAccount: Admin data not found, calling', isPartial ? 'loginAsPartialAdmin' : 'loginAsAdmin', 'API...');

    try {
      // Need personal token in localStorage so apiRequest can authenticate
      const personalToken = switchData.personal_account.token;
      const personalUser = switchData.personal_account.user;
      localStorage.setItem('stasht_token', personalToken);
      localStorage.setItem('stasht_user', JSON.stringify(personalUser));

      const ownerEmail = adminAccount.user?.email || '';
      const response = isPartial
        ? await dashboardAPI.loginAsPartialAdmin(owner_id, ownerEmail)
        : await dashboardAPI.loginAsAdmin(owner_id);
      console.log('switchAccount: API response:', response);

      // Handle nested data structure
      const responseData = response.data?.data || response.data;

      if (response.success && responseData?.user && responseData?.token) {
        const adminUser = responseData.user;
        const adminToken = responseData.token;

        console.log('switchAccount: Admin user from API:', adminUser);
        console.log('switchAccount: Admin user location:', adminUser.location);

        // If location is missing from API response, try to get it from cached admin account
        const accountIndex = switchData.admin_accounts.findIndex(acc => acc.owner_id === owner_id);
        if (accountIndex !== -1) {
          const cachedUser = switchData.admin_accounts[accountIndex].user;
          console.log('switchAccount: Cached user data:', cachedUser);

          // If API response is missing location but we have it cached, merge it
          if (!adminUser.location && cachedUser?.location) {
            console.log('switchAccount: Adding location from cached data:', cachedUser.location);
            adminUser.location = cachedUser.location;
          }

          // Update admin account data in the array with complete user object
          switchData.admin_accounts[accountIndex].user = adminUser;
          switchData.admin_accounts[accountIndex].token = adminToken;
        }

        switchData.current_mode = 'admin';
        switchData.current_admin_owner_id = owner_id;

        // Store updated switch data
        localStorage.setItem('admin_switch_data', JSON.stringify(switchData));

        // Set admin as current user
        localStorage.setItem('stasht_user', JSON.stringify(adminUser));
        localStorage.setItem('stasht_token', adminToken);

        // Set or clear partial admin flags
        if (isPartial) {
          const personalEmail = switchData.personal_account.user?.email || '';
          localStorage.setItem('is_partial_admin', 'true');
          localStorage.setItem('partial_admin_email', personalEmail);
          console.log('switchAccount: Set partial admin flags, email:', personalEmail);
        } else {
          clearPartialAdminFlags();
        }

        console.log('switchAccount: Successfully fetched and switched to admin account');
        console.log('switchAccount: Stored user in localStorage:', JSON.parse(localStorage.getItem('stasht_user') || '{}'));
        return true;
      } else {
        console.error('switchAccount: loginAsAdmin failed:', response.error);
        return false;
      }
    } catch (error) {
      console.error('switchAccount: Error calling loginAsAdmin:', error);
      return false;
    }
  }
};

export function AccountChoiceModal({
  isOpen,
  onClose,
  adminCollaborators,  // Changed to array
  personalUser,
  personalToken,
  onComplete,
  ownedProperties = [],  // NEW: Default to empty array
  sharedProperties = []  // NEW: Default to empty array
}: AccountChoiceModalProps) {
  const { switchToProperty } = useProperty();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<string | null>(null);  // Changed to string to handle multiple admin IDs
  const [selectedAdminOwnerId, setSelectedAdminOwnerId] = useState<string | null>(null);
  const [isAdminSectionExpanded, setIsAdminSectionExpanded] = useState(false);
  const [isPropertiesSectionExpanded, setIsPropertiesSectionExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // Debug: Log all admin collaborators and properties
  console.log('🔍 AccountChoiceModal: Total adminCollaborators:', adminCollaborators.length);
  console.log('🔍 AccountChoiceModal: adminCollaborators:', adminCollaborators);
  console.log('🔍 AccountChoiceModal: ownedProperties:', ownedProperties);
  console.log('🔍 AccountChoiceModal: sharedProperties:', sharedProperties);

  // Separate admin collaborators from properties
  const adminAccounts = adminCollaborators.filter(admin => {
    const ownerId = String(admin.owner_id || '');
    const isProperty = ownerId.startsWith('property_');
    console.log('🔍 Checking owner_id:', ownerId, 'isProperty:', isProperty);
    return !isProperty;
  });

  // Use new owned/shared properties if provided, otherwise fallback to old method
  const ownedPropertyAccounts = ownedProperties.length > 0 ? ownedProperties : [];
  const sharedPropertyAccounts = sharedProperties.length > 0 ? sharedProperties : [];

  // Fallback: If no owned/shared properties provided, use old method (filter from adminCollaborators)
  const propertyAccounts = ownedPropertyAccounts.length === 0 && sharedPropertyAccounts.length === 0
    ? adminCollaborators.filter(admin => {
        const ownerId = String(admin.owner_id || '');
        return ownerId.startsWith('property_');
      })
    : [...ownedPropertyAccounts, ...sharedPropertyAccounts];

  const totalPropertiesCount = ownedPropertyAccounts.length + sharedPropertyAccounts.length;

  console.log('🔍 AccountChoiceModal: adminAccounts count:', adminAccounts.length);
  console.log('🔍 AccountChoiceModal: ownedPropertyAccounts count:', ownedPropertyAccounts.length);
  console.log('🔍 AccountChoiceModal: sharedPropertyAccounts count:', sharedPropertyAccounts.length);
  console.log('🔍 AccountChoiceModal: totalPropertiesCount:', totalPropertiesCount);

  // Filter admin accounts based on search query
  const filteredAdminCollaborators = adminAccounts.filter(admin => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const name = (admin.owner?.name || admin.owner_name || '').toLowerCase();
    const email = (admin.owner?.email || admin.owner_email || '').toLowerCase();
    const location = (admin.owner?.location || admin.location || '').toLowerCase();

    return name.includes(query) || email.includes(query) || location.includes(query);
  });

  // Filter owned properties based on search query
  const filteredOwnedProperties = ownedPropertyAccounts.filter((property: any) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const name = (property.name || '').toLowerCase();
    const location = (property.location || '').toLowerCase();

    return name.includes(query) || location.includes(query);
  });

  // Filter shared properties based on search query
  const filteredSharedProperties = sharedPropertyAccounts.filter((property: any) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const name = (property.name || '').toLowerCase();
    const location = (property.location || '').toLowerCase();

    return name.includes(query) || location.includes(query);
  });

  const showSearchBar = adminCollaborators.length > 6;

  const handleLoginAsAdmin = async (adminCollaborator: AdminCollaborator) => {
    setIsLoading(true);
    setLoadingType(adminCollaborator.owner_id);
    setSelectedAdminOwnerId(adminCollaborator.owner_id);

    try {
      const ownerId = String(adminCollaborator.owner_id || '');
      console.log('AccountChoiceModal: Processing selection...');
      console.log('AccountChoiceModal: Owner ID:', ownerId);

      // Check if this is a property account
      const isPropertyAccount = ownerId.startsWith('property_');

      if (isPropertyAccount) {
        // Handle property selection - login to personal first, then switch to property
        console.log('AccountChoiceModal: Property selected, logging in to personal then switching to property...');

        try {
          // Extract property ID from owner_id (format: "property_123")
          const propertyId = ownerId.replace('property_', '');
          console.log('AccountChoiceModal: Selected property ID:', propertyId);

          // STEP 1: Store admin switch data with personal account
          const adminAccountsArray = adminCollaborators.map(collab => {
            const collabName = collab.owner?.name || collab.owner_name || '';
            const collabEmail = collab.owner?.email || collab.owner_email || '';
            const collabLocation = collab.owner?.location || collab.location || '';

            return {
              owner_id: collab.owner_id,
              user: collabName || collabEmail ? { name: collabName, email: collabEmail, location: collabLocation } : null,
              token: ''
            };
          });

          const switchData: AdminSwitchData = {
            has_admin_access: true,
            current_mode: 'personal',
            current_admin_owner_id: undefined,
            personal_account: {
              user: personalUser,
              token: personalToken
            },
            admin_accounts: adminAccountsArray
          };

          storeAdminSwitchData(switchData);
          console.log('AccountChoiceModal: Admin switch data stored');

          // STEP 2: Login to personal account first (set in localStorage)
          localStorage.setItem('stasht_user', JSON.stringify(personalUser));
          localStorage.setItem('stasht_token', personalToken);
          console.log('AccountChoiceModal: Personal account set in localStorage');

          // STEP 3: Store the selected property ID for post-login redirect
          console.log('AccountChoiceModal: Storing property ID for post-login switch:', propertyId);
          localStorage.setItem('pending_property_switch', propertyId);

          toast.success(`Logging in to ${adminCollaborator.owner_name || 'property'}...`);

          // STEP 4: Complete the flow (redirect will happen, then page will switch to property)
          setIsLoading(false);
          setLoadingType(null);
          onComplete();
          return;
        } catch (error) {
          console.error('AccountChoiceModal: Error switching to property:', error);
          toast.error('Failed to switch to property');
          setIsLoading(false);
          setLoadingType(null);
          return;
        }
      }

      // Handle admin collaborator login
      console.log('AccountChoiceModal: Logging in as admin collaborator...');

      if (!ownerId) {
        console.error('AccountChoiceModal: No owner_id found');
        toast.error('Unable to login as admin. Missing owner information.');
        setIsLoading(false);
        setLoadingType(null);
        setSelectedAdminOwnerId(null);
        return;
      }

      console.log('AccountChoiceModal: Using Owner ID:', ownerId);

      // The personal token is not yet in localStorage (login page delays storing it until
      // account choice is made). Set it temporarily so apiRequest can authenticate.
      const hadExistingToken = !!localStorage.getItem('stasht_token');
      localStorage.setItem('stasht_token', personalToken);
      localStorage.setItem('stasht_user', JSON.stringify(personalUser));

      // Call loginAsAdmin or loginAsPartialAdmin API
      const ownerEmail = adminCollaborator.owner?.email || adminCollaborator.owner_email || '';
      const response = adminCollaborator.isPartialAdmin
        ? await dashboardAPI.loginAsPartialAdmin(ownerId, ownerEmail)
        : await dashboardAPI.loginAsAdmin(ownerId);

      // If the API call failed and we didn't have a token before, clean up
      if (!response.success && !hadExistingToken) {
        localStorage.removeItem('stasht_token');
        localStorage.removeItem('stasht_user');
      }

      console.log('AccountChoiceModal: loginAsAdmin response:', response);
      console.log('AccountChoiceModal: response.success:', response.success);
      console.log('AccountChoiceModal: response.data:', response.data);

      // Handle nested data structure - API may return data.data or just data
      const responseData = response.data?.data || response.data;
      console.log('AccountChoiceModal: responseData:', responseData);

      if (response.success && responseData) {
        const adminUser = responseData.user;
        const adminToken = responseData.token;

        console.log('AccountChoiceModal: adminUser:', adminUser);
        console.log('AccountChoiceModal: adminUser.location:', adminUser.location);
        console.log('AccountChoiceModal: adminToken:', adminToken ? 'exists' : 'missing');

        // Get location from current collaborator if API doesn't return it
        const currentCollab = adminCollaborators.find(c => c.owner_id === ownerId);
        const currentCollabLocation = currentCollab?.owner?.location || currentCollab?.location || '';

        if (!adminUser.location && currentCollabLocation) {
          console.log('AccountChoiceModal: Adding location from collaborator to adminUser:', currentCollabLocation);
          adminUser.location = currentCollabLocation;
        }

        // Store ALL admin accounts in admin_switch_data (not just the clicked one)
        const adminAccountsArray = adminCollaborators.map(collab => {
          const collabName = collab.owner?.name || collab.owner_name || '';
          const collabEmail = collab.owner?.email || collab.owner_email || '';
          const collabLocation = collab.owner?.location || collab.location || '';

          console.log('AccountChoiceModal: Mapping collaborator:', {
            owner_id: collab.owner_id,
            name: collabName,
            email: collabEmail,
            location: collabLocation,
            rawCollab: collab
          });

          return {
            owner_id: collab.owner_id,
            // For the clicked admin: store full user object and token
            // For other admins: store basic info (name/email/location) for display purposes
            user: collab.owner_id === ownerId
              ? adminUser  // adminUser now has location merged in
              : (collabName || collabEmail ? { name: collabName, email: collabEmail, location: collabLocation } : null),
            token: collab.owner_id === ownerId ? adminToken : '',
            isPartialAdmin: collab.isPartialAdmin || false
          };
        });

        console.log('AccountChoiceModal: Final adminAccountsArray:', adminAccountsArray);

        const switchData: AdminSwitchData = {
          has_admin_access: true,
          current_mode: 'admin',
          current_admin_owner_id: ownerId,  // Track which admin is currently active
          personal_account: {
            user: personalUser,
            token: personalToken
          },
          admin_accounts: adminAccountsArray  // Store ALL admin accounts
        };

        storeAdminSwitchData(switchData);

        // Set admin as current user
        localStorage.setItem('stasht_user', JSON.stringify(adminUser));
        localStorage.setItem('stasht_token', adminToken);

        // Store partial admin flags if applicable
        if (adminCollaborator.isPartialAdmin) {
          localStorage.setItem('is_partial_admin', 'true');
          localStorage.setItem('partial_admin_email', personalUser.email || '');
        } else {
          clearPartialAdminFlags();
        }

        console.log('AccountChoiceModal: Switched to admin account successfully');
        console.log('AccountChoiceModal: Final adminUser stored:', adminUser);
        console.log('AccountChoiceModal: Final adminUser.location:', adminUser.location);
        console.log('AccountChoiceModal: Stored in localStorage:', JSON.parse(localStorage.getItem('stasht_user') || '{}'));
        toast.success(`Logged in as ${adminUser.name || adminUser.email}`);

        onComplete();
      } else {
        console.error('AccountChoiceModal: loginAsAdmin failed:', response.error);
        toast.error(response.error || 'Failed to login as admin');
      }
    } catch (error) {
      console.error('AccountChoiceModal: Error logging in as admin:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
      setSelectedAdminOwnerId(null);
    }
  };

  const handleLoginAsPersonal = () => {
    setIsLoading(true);
    setLoadingType('personal');

    try {
      console.log('AccountChoiceModal: Logging in as personal...');

      // Store ALL admin accounts (not just the first one)
      const adminAccountsArray = adminCollaborators.map(collab => {
        const adminName = collab.owner?.name || collab.owner_name || '';
        const adminEmail = collab.owner?.email || collab.owner_email || '';
        const adminLocation = collab.owner?.location || collab.location || '';

        console.log('AccountChoiceModal (personal login): Mapping collaborator:', {
          owner_id: collab.owner_id,
          name: adminName,
          email: adminEmail,
          location: adminLocation
        });

        return {
          owner_id: collab.owner_id || collab.user_id || '',
          user: adminName || adminEmail ? { name: adminName, email: adminEmail, location: adminLocation } : null,
          token: '',
          isPartialAdmin: collab.isPartialAdmin || false
        };
      });

      console.log('AccountChoiceModal (personal login): Final adminAccountsArray:', adminAccountsArray);

      // Store both personal account and ALL admin accounts in admin_switch_data (for future switching)
      const switchData: AdminSwitchData = {
        has_admin_access: true,
        current_mode: 'personal',
        current_admin_owner_id: undefined,  // Not logged in as admin yet
        personal_account: {
          user: personalUser,
          token: personalToken
        },
        admin_accounts: adminAccountsArray  // Store ALL admin accounts
      };

      storeAdminSwitchData(switchData);

      // Keep personal user as current (already stored)
      localStorage.setItem('stasht_user', JSON.stringify(personalUser));
      localStorage.setItem('stasht_token', personalToken);

      console.log('AccountChoiceModal: Continuing with personal account');
      toast.success('Logged in to your personal account');

      onComplete();
    } catch (error) {
      console.error('AccountChoiceModal: Error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const personalDisplayName = personalUser?.name || personalUser?.email || 'Personal Account';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      >
        {/* Modal */}
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="p-6">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-[#6C60FF] to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Choose Account
              </h2>
              <p className="text-sm text-gray-600">
                {adminAccounts.length > 0 && totalPropertiesCount > 0 ? (
                  <>Select from {adminAccounts.length} admin account{adminAccounts.length > 1 ? 's' : ''} or {totalPropertiesCount} propert{totalPropertiesCount > 1 ? 'ies' : 'y'}.</>
                ) : adminAccounts.length > 0 ? (
                  <>You have admin access to {adminAccounts.length} account{adminAccounts.length > 1 ? 's' : ''}.</>
                ) : totalPropertiesCount > 0 ? (
                  <>You have access to {totalPropertiesCount} propert{totalPropertiesCount > 1 ? 'ies' : 'y'}.</>
                ) : null}
              </p>
            </div>

            {/* Account Options */}
            <div className="space-y-3 mb-6">
              {/* Personal Account Option - Always shown first */}
              <button
                onClick={handleLoginAsPersonal}
                disabled={isLoading}
                className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-[#FF51E2] hover:bg-pink-50 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center gap-4">
                  {personalUser?.profile_image ? (
                    <Avatar className="w-12 h-12 flex-shrink-0">
                      <AvatarImage
                        src={personalUser.profile_image}
                        alt={personalUser.name || personalUser.email}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-gradient-to-br from-[#FF51E2] to-[#FF51E2] text-white">
                        <User className="w-6 h-6" />
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-[#FF51E2] to-[#FF51E2] rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-black transition-colors">
                      {personalDisplayName}
                    </h3>
                    {personalUser?.email && (
                      <p className="text-xs text-gray-600 mt-0.5 truncate">
                        {personalUser.email}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">
                      Your Personal Account - Access your own campaigns
                    </p>
                  </div>
                  {loadingType === 'personal' && (
                    <Loader2 className="w-5 h-5 text-[#FF51E2] animate-spin flex-shrink-0" />
                  )}
                </div>
              </button>

              {/* Admin Accounts Section - Collapsible */}
              {adminAccounts.length > 0 && (
                <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
                {/* Admin Accounts Header */}
                <button
                  onClick={() => setIsAdminSectionExpanded(!isAdminSectionExpanded)}
                  disabled={isLoading}
                  className="w-full p-4 hover:bg-gray-50 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#6C60FF] to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">{adminAccounts.length}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Admin Accounts ({adminAccounts.length})
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        View and manage other users' campaigns
                      </p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isAdminSectionExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Admin Accounts List */}
                {isAdminSectionExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    {/* Search Bar - Only show if more than 6 accounts */}
                    {showSearchBar && (
                      <div className="p-3 bg-white border-b border-gray-200">
                        <div className="relative">
                          <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}

                    {/* Admin Accounts List - Scrollable */}
                    <div className="max-h-[300px] overflow-y-auto">
                      {filteredAdminCollaborators.length > 0 ? (
                        filteredAdminCollaborators.map((adminCollab, index) => {
                          const ownerName = adminCollab.owner?.name || adminCollab.owner_name || '';
                          const ownerEmail = adminCollab.owner?.email || adminCollab.owner_email || '';
                          const ownerDisplayName = ownerName || ownerEmail || `Admin Account ${index + 1}`;
                          const isCurrentLoading = loadingType === adminCollab.owner_id;

                          return (
                            <button
                              key={adminCollab.owner_id || index}
                              onClick={() => handleLoginAsAdmin(adminCollab)}
                              disabled={isLoading}
                              className="w-full p-3 hover:bg-white transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed border-b border-gray-200 last:border-b-0"
                            >
                              <div className="flex items-center gap-3">
                                {adminCollab.owner?.profile_image ? (
                                  <Avatar className="w-10 h-10 flex-shrink-0">
                                    <AvatarImage
                                      src={adminCollab.owner.profile_image}
                                      alt={adminCollab.owner.name}
                                      className="object-cover"
                                    />
                                    <AvatarFallback className="bg-gradient-to-br from-[#6C60FF] to-purple-600 text-white text-xs">
                                      {ownerDisplayName.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                ) : (
                                  <div className="w-10 h-10 bg-gradient-to-br from-[#6C60FF] to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-white font-semibold text-xs">
                                      {ownerDisplayName.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm font-medium text-gray-900 truncate">
                                      {ownerDisplayName}
                                    </h3>
                                    {adminCollab.isPartialAdmin && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-600 border border-orange-200 flex-shrink-0">
                                        Partial Access
                                      </span>
                                    )}
                                  </div>
                                  {ownerEmail && ownerName && (
                                    <p className="text-xs text-gray-500 truncate mt-0.5">
                                      {ownerEmail}
                                    </p>
                                  )}
                                  {(adminCollab.location || adminCollab.owner?.location) && (
                                    <p className="text-xs text-gray-400 truncate mt-0.5">
                                      {adminCollab.location || adminCollab.owner?.location}
                                    </p>
                                  )}
                                </div>
                                {isCurrentLoading && (
                                  <Loader2 className="w-4 h-4 text-[#6C60FF] animate-spin flex-shrink-0" />
                                )}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-6 text-center text-gray-500 text-sm">
                          No admin accounts found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Properties Section - Collapsible */}
              {totalPropertiesCount > 0 ? (
                <>
                  {console.log('🔍 Rendering Properties Section with', totalPropertiesCount, 'properties')}
                  <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
                  {/* Properties Header */}
                  <button
                    onClick={() => setIsPropertiesSectionExpanded(!isPropertiesSectionExpanded)}
                    disabled={isLoading}
                    className="w-full p-4 hover:bg-gray-50 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">{totalPropertiesCount}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900">
                          Properties ({totalPropertiesCount})
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {ownedPropertyAccounts.length} owned, {sharedPropertyAccounts.length} shared
                        </p>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isPropertiesSectionExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded Properties List */}
                  {isPropertiesSectionExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50">
                      {/* Properties List - Scrollable */}
                      <div className="max-h-[300px] overflow-y-auto">
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
                              const isCurrentLoading = loadingType === `property_${property.id}`;

                              return (
                                <button
                                  key={property.id || index}
                                  onClick={() => {
                                    // Create a fake admin collaborator object for owned property
                                    const fakeCollab = {
                                      owner_id: `property_${property.id}`,
                                      owner_name: propertyName,
                                      location: propertyLocation,
                                      properties: [property]
                                    };
                                    handleLoginAsAdmin(fakeCollab as any);
                                  }}
                                  disabled={isLoading}
                                  className="w-full p-3 hover:bg-white transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed border-b border-gray-200 last:border-b-0"
                                >
                                  <div className="flex items-center gap-3">
                                    {property.image ? (
                                      <Avatar className="w-10 h-10 flex-shrink-0">
                                        <AvatarImage
                                          src={property.image}
                                          alt={propertyName}
                                          className="object-cover"
                                        />
                                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500">
                                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                          </svg>
                                        </AvatarFallback>
                                      </Avatar>
                                    ) : (
                                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <h3 className="text-sm font-medium text-gray-900 truncate">
                                        {propertyName}
                                      </h3>
                                      {propertyLocation && (
                                        <p className="text-xs text-gray-400 truncate mt-0.5">
                                          {propertyLocation}
                                        </p>
                                      )}
                                    </div>
                                    {isCurrentLoading && (
                                      <Loader2 className="w-4 h-4 text-purple-600 animate-spin flex-shrink-0" />
                                    )}
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
                              const isCurrentLoading = loadingType === `property_${property.id}`;

                              return (
                                <button
                                  key={property.id || index}
                                  onClick={() => {
                                    // Create a fake admin collaborator object for shared property
                                    const fakeCollab = {
                                      owner_id: `property_${property.id}`,
                                      owner_name: propertyName,
                                      location: propertyLocation,
                                      properties: [property]
                                    };
                                    handleLoginAsAdmin(fakeCollab as any);
                                  }}
                                  disabled={isLoading}
                                  className="w-full p-3 hover:bg-white transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed border-b border-gray-200 last:border-b-0"
                                >
                                  <div className="flex items-center gap-3">
                                    {property.image ? (
                                      <Avatar className="w-10 h-10 flex-shrink-0">
                                        <AvatarImage
                                          src={property.image}
                                          alt={propertyName}
                                          className="object-cover"
                                        />
                                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500">
                                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                          </svg>
                                        </AvatarFallback>
                                      </Avatar>
                                    ) : (
                                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <h3 className="text-sm font-medium text-gray-900 truncate">
                                        {propertyName}
                                      </h3>
                                      {propertyLocation && (
                                        <p className="text-xs text-gray-400 truncate mt-0.5">
                                          {propertyLocation}
                                        </p>
                                      )}
                                    </div>
                                    {isCurrentLoading && (
                                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </>
                        )}

                        {/* No properties found */}
                        {filteredOwnedProperties.length === 0 && filteredSharedProperties.length === 0 && (
                          <div className="p-6 text-center text-gray-500 text-sm">
                            No properties found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                </>
              ) : (
                console.log('🔍 Properties Section NOT rendering - totalPropertiesCount:', totalPropertiesCount)
              )}
            </div>

            {/* Info note */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs text-blue-800 text-center">
                You can switch between accounts anytime from your profile menu
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default AccountChoiceModal;
