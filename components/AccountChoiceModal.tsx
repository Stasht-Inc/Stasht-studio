import React, { useRef, useState } from 'react';
import { X, User, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { dashboardAPI, clearPartialAdminFlags } from '../utils/authUtils';
import { toast } from 'sonner';
import { useProperty } from '../contexts/PropertyContext';
import { switchDataForPropertyAccount, switchDataIsStale } from '../utils/propertyAccountSwitch';
import { findPropertyRow, needsFullPropertyRow, opensAsFullAccount, propertyRowActions } from '../utils/propertyRows';
import { propertyAvatarImage } from '../utils/propertyImage';
import { adminAccountsAfterChoice, sameOwner } from '../utils/adminSwitchAccounts';
import { externalRowAvatar, groupPropertyAccounts, isOwnExternalProperty, propertyAccountGroups } from '../utils/salespersonLanding';

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
    const parsed: AdminSwitchData = JSON.parse(data);

    // Guard against stale data left behind by a previous account (e.g. signup,
    // SSO, or a login that never hit "Sign out"). If the currently logged-in
    // user doesn't match who this admin data was stored for, discard it.
    // While switched into another account, stasht_user is that account: still this data only while the token in
    // use is the one the switch produced (utils/propertyAccountSwitch.ts).
    const currentUserStr = localStorage.getItem('stasht_user');
    if (currentUserStr) {
      const currentUser = JSON.parse(currentUserStr);
      if (switchDataIsStale(parsed, currentUser, localStorage.getItem('stasht_token'))) {
        console.log('getAdminSwitchData: Stale data for a different user detected, clearing.');
        localStorage.removeItem('admin_switch_data');
        return null;
      }
    }

    return parsed;
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
  const adminAccount = switchData.admin_accounts.find(acc => sameOwner(acc.owner_id, owner_id));

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
        const accountIndex = switchData.admin_accounts.findIndex(acc => sameOwner(acc.owner_id, owner_id));
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

// Open an EXTERNAL property (a separate full account) from the account that is signed in now: login-as-admin
// with the current token, then the same switch the Profile menu does, so the user lands in that account with
// everything it has (Leads, Newsletters, Users…). "Switch to …" in the Profile menu brings them back.
// Internal properties keep the property view (switchToProperty) and never come here.
export const switchIntoPropertyAccount = async (
  property: { user_id?: unknown; name?: unknown },
): Promise<{ ok: boolean; name: string; error: string }> => {
  const ownerId = String(property?.user_id ?? '').trim();
  if (!ownerId) return { ok: false, name: '', error: 'This property has no account to open.' };

  const signedInToken = localStorage.getItem('stasht_token') || '';
  let signedInUser: any = null;
  try {
    signedInUser = JSON.parse(localStorage.getItem('stasht_user') || 'null');
  } catch {
    signedInUser = null;
  }
  const existing = getAdminSwitchData();

  try {
    const response = await dashboardAPI.loginAsAdmin(ownerId);
    const data: any = (response.data as any)?.data || response.data;
    if (!response.success || !data?.user || !data?.token) {
      return { ok: false, name: '', error: response.error || (response as any).message || 'Could not open this account.' };
    }

    storeAdminSwitchData(switchDataForPropertyAccount(existing, { user: signedInUser, token: signedInToken }, ownerId, data.token));
    localStorage.setItem('stasht_user', JSON.stringify(data.user));
    localStorage.setItem('stasht_token', data.token);
    clearPartialAdminFlags();
    // A full account, not the property view.
    localStorage.setItem('view_type', 'personal');
    localStorage.removeItem('selected_property');
    localStorage.removeItem('pending_property_switch');

    const name = String(data.user.name || data.user.email || property?.name || 'the account');
    return { ok: true, name, error: '' };
  } catch (error: any) {
    console.error('switchIntoPropertyAccount failed:', error);
    return { ok: false, name: '', error: error?.message || 'Could not open this account.' };
  }
};

// A lead email's "Open conversation" (/leads?lead=N) opened by an Admin or Partial Admin of the lead's account while
// signed in as themselves (or switched into another account): switch them into the lead's account, as the chooser /
// Profile menu would, keeping the way back. The switch endpoints check the person's OWN token, so the personal one
// is used while switched elsewhere (10 Nov 2026, Chris: "Nobody is even seeing the leads").
// One switch at a time: the Leads list loads several times while opening (each load asks for the linked lead), and
// every /login-as-admin mints a new owner token and revokes the owner's earlier ones, so a second concurrent switch
// would revoke the token the first one saved (the person then lands signed out).
let leadSwitchInFlight: Promise<{ ok: boolean; error: string }> | null = null;

export const switchIntoAccountForLead = (
  ownerId: string,
  partial: boolean,
  ownerEmail: string,
): Promise<{ ok: boolean; error: string }> => {
  if (!leadSwitchInFlight) {
    leadSwitchInFlight = doSwitchIntoAccountForLead(ownerId, partial, ownerEmail)
      .finally(() => { leadSwitchInFlight = null; });
  }
  return leadSwitchInFlight;
};

const doSwitchIntoAccountForLead = async (
  ownerId: string,
  partial: boolean,
  ownerEmail: string,
): Promise<{ ok: boolean; error: string }> => {
  const existing = getAdminSwitchData();
  const currentToken = localStorage.getItem('stasht_token') || '';
  const currentUserRaw = localStorage.getItem('stasht_user');
  let currentUser: any = null;
  try { currentUser = JSON.parse(currentUserRaw || 'null'); } catch { currentUser = null; }
  const personal = existing?.current_mode === 'admin' && existing.personal_account?.token
    ? existing.personal_account
    : { user: currentUser, token: currentToken };
  const restore = () => {
    localStorage.setItem('stasht_token', currentToken);
    if (currentUserRaw) localStorage.setItem('stasht_user', currentUserRaw);
  };

  try {
    localStorage.setItem('stasht_token', personal.token);
    const response = partial
      ? await dashboardAPI.loginAsPartialAdmin(ownerId, ownerEmail)
      : await dashboardAPI.loginAsAdmin(ownerId);
    const data: any = (response.data as any)?.data || response.data;
    if (!response.success || !data?.user || !data?.token) {
      restore();
      return { ok: false, error: response.error || (response as any).message || 'Could not open that account.' };
    }

    const base = switchDataForPropertyAccount(existing, personal, ownerId, data.token);
    const accounts = (base.admin_accounts || []).filter((acc) => !(sameOwner(acc.owner_id, ownerId) && !!acc.isPartialAdmin === partial));
    accounts.push({ owner_id: String(ownerId), user: data.user, token: data.token, isPartialAdmin: partial });
    storeAdminSwitchData({ ...base, admin_accounts: accounts } as AdminSwitchData);
    localStorage.setItem('stasht_user', JSON.stringify(data.user));
    localStorage.setItem('stasht_token', data.token);
    if (partial) {
      localStorage.setItem('is_partial_admin', 'true');
      localStorage.setItem('partial_admin_email', personal.user?.email || '');
    } else {
      clearPartialAdminFlags();
    }
    localStorage.setItem('view_type', 'personal');
    localStorage.removeItem('selected_property');
    localStorage.removeItem('pending_property_switch');
    return { ok: true, error: '' };
  } catch (error: any) {
    restore();
    return { ok: false, error: error?.message || 'Could not open that account.' };
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
  const [isExternalSectionExpanded, setIsExternalSectionExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // One property-account switch at a time (a second click before the first answers would race it).
  const propertySwitchInFlight = useRef(false);

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

  // Use new owned/shared properties if provided, otherwise fallback to old method. A salesperson's own external
  // property is their External account: listed under External, first (utils/salespersonLanding groupPropertyAccounts).
  const groupedProperties = groupPropertyAccounts({ owned: ownedProperties, shared: sharedProperties }, personalUser);
  const ownedPropertyAccounts = groupedProperties.owned;
  const sharedPropertyAccounts = groupedProperties.shared;

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

  // One row of the chooser's Properties card (the account's own properties).
  const renderOwnedPropertyRow = (property: any, index: number) => {
    const propertyName = property.name || `Property ${index + 1}`;
    const propertyLocation = property.location || '';
    const isCurrentLoading = loadingType === `property_${property.id}`;
    // The property's own image first; without one, the inviter's logo when a different
    // user invited the logged-in user (external_user_id mismatch), then the icon
    // (utils/propertyImage).
    const invitedBy = property.invited_by;
    const showInvitedBy = !!invitedBy &&
      String(personalUser?.external_user_id ?? '') !== String(invitedBy.external_user_id ?? '');
    const avatarImage = propertyAvatarImage(property, personalUser).image;

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
          {avatarImage ? (
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage
                src={avatarImage}
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
            {showInvitedBy && invitedBy?.name && (
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {invitedBy.name}
              </p>
            )}
          </div>
          {isCurrentLoading && (
            <Loader2 className="w-4 h-4 text-purple-600 animate-spin flex-shrink-0" />
          )}
        </div>
      </button>
    );
  };

  // One row of the External card (external accounts; a salesperson's own External account first).
  const renderSharedPropertyRow = (property: any, index: number) => {
    const propertyName = property.name || `Property ${index + 1}`;
    const propertyLocation = property.location || '';
    const isCurrentLoading = loadingType === `property_${property.id}`;
    const deactivatedNote = propertyRowActions(property).view.note;
    // The salesperson's own External account represents the main account: its logo (unless the
    // property has an image of its own) and its name, as in the header (utils/propertyImage).
    const ownExternal = isOwnExternalProperty(property, personalUser);
    const ownExternalLook = ownExternal ? propertyAvatarImage(property, personalUser) : null;
    // The Users page rule (property image, then the account's own image), then the main account's logo for the
    // salesperson's own External row (utils/salespersonLanding externalRowAvatar).
    const sharedAvatar = externalRowAvatar(property, personalUser);
    const representing = ownExternalLook?.invitedBy
      && String(personalUser?.external_user_id ?? '') !== String(ownExternalLook.invitedBy.external_user_id ?? '')
      ? ownExternalLook.invitedBy : null;

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
          handleSharedPropertyClick(property, () => handleLoginAsAdmin(fakeCollab as any));
        }}
        disabled={isLoading || !!deactivatedNote}
        className="w-full p-3 hover:bg-white transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed border-b border-gray-200 last:border-b-0"
      >
        <div className="flex items-center gap-3">
          {sharedAvatar ? (
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage
                src={sharedAvatar}
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
            {representing?.name && (
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {representing.name}
              </p>
            )}
          </div>
          {deactivatedNote && (
            <span className="text-xs text-gray-500 flex-shrink-0">{deactivatedNote}</span>
          )}
          {isCurrentLoading && (
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
          )}
        </div>
      </button>
    );
  };

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

      if (response.success && responseData?.user && responseData?.token) {
        const adminUser = responseData.user;
        const adminToken = responseData.token;

        console.log('AccountChoiceModal: adminUser:', adminUser);
        console.log('AccountChoiceModal: adminUser.location:', adminUser.location);
        console.log('AccountChoiceModal: adminToken:', adminToken ? 'exists' : 'missing');

        // Get location from current collaborator if API doesn't return it
        const currentCollab = adminCollaborators.find(c => sameOwner(c.owner_id, ownerId));
        const currentCollabLocation = currentCollab?.owner?.location || currentCollab?.location || '';

        if (!adminUser.location && currentCollabLocation) {
          console.log('AccountChoiceModal: Adding location from collaborator to adminUser:', currentCollabLocation);
          adminUser.location = currentCollabLocation;
        }

        // Store ALL admin accounts in admin_switch_data (not just the clicked one): the clicked one with its user and
        // token (owner ids compared as strings, utils/adminSwitchAccounts), the others with name/email/location.
        const adminAccountsArray = adminAccountsAfterChoice(adminCollaborators, adminCollaborator, adminUser, adminToken);

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

  // External properties (a separate full account) switch into that account; everything else keeps today's
  // property view. Sign-in rows carry account_type / user_id / is_active; an older API's don't, so then the full
  // row is read from /properties first.
  const handleSharedPropertyClick = async (property: any, fallback: () => void) => {
    if (propertySwitchInFlight.current) return;
    propertySwitchInFlight.current = true;
    setIsLoading(true);
    setLoadingType(`property_${property.id}`);
    const hadExistingToken = !!localStorage.getItem('stasht_token');
    const undoSignIn = () => {
      if (!hadExistingToken) {
        localStorage.removeItem('stasht_token');
        localStorage.removeItem('stasht_user');
        clearAdminSwitchData();
      }
    };

    try {
      // apiRequest reads the token from localStorage; the login page has not stored it yet.
      localStorage.setItem('stasht_token', personalToken);
      localStorage.setItem('stasht_user', JSON.stringify(personalUser));

      let row = property;
      if (needsFullPropertyRow(property)) {
        try {
          const response = await dashboardAPI.getProperties();
          row = { ...property, ...(findPropertyRow(response, property.id) || {}) };
        } catch (error) {
          // Without the full row it can't be told apart from an internal one: keep today's property view.
          console.warn('AccountChoiceModal: could not read the property row, using the property view:', error);
        }
      }

      if (!opensAsFullAccount(row)) {
        undoSignIn();
        setIsLoading(false);
        setLoadingType(null);
        propertySwitchInFlight.current = false;
        fallback();
        return;
      }
      if (propertyRowActions(row).view.disabled) {
        undoSignIn();
        toast.error(`${row.name || 'This property'} is deactivated.`);
        return;
      }

      // Keep the user's other admin accounts switchable, as the personal sign-in does.
      storeAdminSwitchData({
        has_admin_access: true,
        current_mode: 'personal',
        current_admin_owner_id: undefined,
        personal_account: { user: personalUser, token: personalToken },
        admin_accounts: adminCollaborators.map(collab => {
          const collabName = collab.owner?.name || collab.owner_name || '';
          const collabEmail = collab.owner?.email || collab.owner_email || '';
          const collabLocation = collab.owner?.location || collab.location || '';
          return {
            owner_id: collab.owner_id || collab.user_id || '',
            user: collabName || collabEmail ? { name: collabName, email: collabEmail, location: collabLocation } : null,
            token: '',
            isPartialAdmin: collab.isPartialAdmin || false,
          };
        }),
      });

      const result = await switchIntoPropertyAccount(row);
      if (result.ok) {
        toast.success(`Logged in as ${result.name}`);
        onComplete();
      } else {
        undoSignIn();
        toast.error(result.error);
      }
    } catch (error) {
      console.error('AccountChoiceModal: Error opening property account:', error);
      undoSignIn();
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
      propertySwitchInFlight.current = false;
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
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-semibold bg-orange-100 text-orange-600 border border-orange-200 flex-shrink-0">
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

              {/* Properties and External: two collapsible cards, each only when it has rows (Chris, 1 Nov 2026: "INTERNAL"
                  reads "PROPERTIES"; was one "Properties (N) · n internal, n external" card). */}
              {propertyAccountGroups({ owned: ownedPropertyAccounts, shared: sharedPropertyAccounts }).map((group) => {
                const isProperties = group.key === 'properties';
                const expanded = isProperties ? isPropertiesSectionExpanded : isExternalSectionExpanded;
                const setExpanded = isProperties ? setIsPropertiesSectionExpanded : setIsExternalSectionExpanded;
                const rows = isProperties ? filteredOwnedProperties : filteredSharedProperties;
                return (
                  <div key={group.key} className="border-2 border-gray-200 rounded-xl overflow-hidden" data-testid={`chooser-${group.key}-section`}>
                  {/* Header */}
                  <button
                    onClick={() => setExpanded(!expanded)}
                    disabled={isLoading}
                    aria-expanded={expanded}
                    className="w-full p-4 hover:bg-gray-50 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">{group.rows.length}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {group.label} ({group.rows.length})
                        </h3>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded list */}
                  {expanded && (
                    <div className="border-t border-gray-200 bg-gray-50">
                      <div className="max-h-[300px] overflow-y-auto">
                        {rows.map((property: any, index: number) => (isProperties ? renderOwnedPropertyRow(property, index) : renderSharedPropertyRow(property, index)))}
                        {rows.length === 0 && (
                          <div className="p-6 text-center text-gray-500 text-sm">
                            {isProperties ? 'No properties found' : 'No external accounts found'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  </div>
                );
              })}
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
