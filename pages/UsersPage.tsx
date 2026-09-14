import React, { useState, useEffect, useRef } from 'react';
import { Search, Upload, Plus, MoreHorizontal, UserPlus, Download, Trash2, Eye, Edit, Shield, User, Users, Crown, UserX, MapPin, Link, TrendingUp, Filter, Copy, ArrowRightLeft, UserCog, Ban, Home, CreditCard, Share2, QrCode } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useProperty } from '../contexts/PropertyContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { dashboardAPI, apiRequest, userDisplayUtils } from '../utils/authUtils';
import { useAuth } from '../contexts/AuthContext';
import { useMemoryCounts } from '../hooks/useMemoryCounts';
import InviteToMemoryModal from '../components/InviteToMemoryModal';
import EditCollaboratorModal from '../components/EditCollaboratorModal';
import { RemoveCollaborationModal } from '../components/RemoveCollaborationModal';
import CreatePropertyModal, { PropertyFormData } from '../components/CreatePropertyModal';
import { StripePaymentForm } from '../components/StripePaymentForm';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
import PublishLandingPagesModal from '../components/PublishLandingPagesModal';
import TransferMemoryDialog from '../components/TransferMemoryDialog';
import LeadsTab from '../components/LeadsTab';
import LeadDetailDrawer from '../components/LeadDetailDrawer';
import GroupDetailDrawer from '../components/GroupDetailDrawer';
import ConversationDrawer from '../components/ConversationDrawer';
import { Lead, CommentaryTarget, Conversation, leadsAPI } from '../services/leadsAPI';
import { toast } from 'sonner';

interface User {
  id: number;
  collaborator_id?: number; // Add collaborator_id from API response
  collaborator_type?: string; // Add collaborator_type from API response
  name: string;
  email: string;
  phone_number?: string;
  profile_image?: string;
  role: string;
  collaborator_role?: string;
  status: number;
  created_at: string;
  last_active_at?: string;
  is_user_collaborator: boolean;
  memory_count?: number; // Add memory_count from API response
  shared_memory_count?: number; // Add shared_memory_count from API response
  memory?: {
    id: number;
    title: string;
  };
  memories?: {
    access_id: number;
    memory_id: number;
    memory_title: string;
    cover_image?: string;
    status: number;
    created_at: string;
  }[];
  property?: {
    id: number;
    name: string;
  };
}

interface ApiResponse {
  success: boolean;
  data: {
    collaborators: User[];
    non_collaborators?: User[];
  };
}

// Transform API status to display status
const getDisplayStatus = (status: number): string => {
  switch (status) {
    case 1: return 'active';
    case 0: return 'pending';
    default: return 'pending';
  }
};

// Format date for display
const formatDate = (dateString?: string): string => {
  if (!dateString) return 'Not available';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Calculate time ago
const getTimeAgo = (dateString?: string): string => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 30) return `${diffInDays} days ago`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
  return `${Math.floor(diffInDays / 365)} years ago`;
};

interface UsersPageProps {
  openConversationLeadId?: number | null;
  onConversationOpened?: () => void;
  onNavigate?: (page: string) => void;
  onViewStoreelReport?: (propertyId: number | string, propertyName: string) => void;
}

export default function UsersPage({ openConversationLeadId, onConversationOpened, onNavigate, onViewStoreelReport }: UsersPageProps = {}) {
  const { isAuthenticated, user: currentUser } = useAuth();
  const { switchToProperty } = useProperty();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharedMemoriesCount, setSharedMemoriesCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('All Roles');
  const [selectedStatus, setSelectedStatus] = useState<string>('All Status');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<User | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Lead profile panel state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadsUnreadCount, setLeadsUnreadCount] = useState<number>(0);
  // Full breakdown from the same /leads/unread-count call, threaded down to
  // LeadsTab for the Groups sub-tab's unread summary cards (Task M4) — avoids
  // a second call for data this page already fetches for the tab badge.
  const [leadsUnreadBreakdown, setLeadsUnreadBreakdown] = useState<{ total_unread_messages: number; total_unread_comments: number; total_unread: number } | null>(null);
  const [leadsRefreshTrigger, setLeadsRefreshTrigger] = useState(0);
  const [leadsStatusFilter, setLeadsStatusFilter] = useState('all');
  const [commentaryTarget, setCommentaryTarget] = useState<CommentaryTarget | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  // Tab state and shared memories data
  const [activeTab, setActiveTab] = useState<'users' | 'shared-with' | 'properties' | 'leads'>(
    () => sessionStorage.getItem('users_open_tab') === 'properties' ? 'properties' : 'users'
  );

  // Close any open lead/group drawer when leaving the Leads tab, so it doesn't
  // auto-reopen (via the persisted selection) when returning to the tab.
  useEffect(() => {
    if (activeTab !== 'leads') {
      setSelectedLead(null);
      setSelectedGroupId(null);
      setSelectedConversation(null);
    }
  }, [activeTab]);

  // Fetch the unread leads count for the red badge on the Leads tab (same
  // source as the Sidebar's Users badge). Refreshes on the shared event so
  // both stay in sync when leads are read.
  const fetchLeadsUnreadCount = () => {
    if (!isAuthenticated) return;
    apiRequest('/leads/unread-count', { method: 'GET' }).then((data: any) => {
      const payload = data?.data ?? data ?? {};
      const unread = payload?.total_unread ?? 0;
      setLeadsUnreadCount(typeof unread === 'number' ? unread : 0);
      setLeadsUnreadBreakdown({
        total_unread_messages: typeof payload?.total_unread_messages === 'number' ? payload.total_unread_messages : 0,
        total_unread_comments: typeof payload?.total_unread_comments === 'number' ? payload.total_unread_comments : 0,
        total_unread: typeof unread === 'number' ? unread : 0,
      });
    }).catch(() => {});
  };

  useEffect(() => {
    fetchLeadsUnreadCount();
  }, [isAuthenticated]);

  useEffect(() => {
    window.addEventListener('leads-unread-count-refresh', fetchLeadsUnreadCount);
    return () => window.removeEventListener('leads-unread-count-refresh', fetchLeadsUnreadCount);
  }, [isAuthenticated]);

  // Deep-link from a lead_message notification: open the Leads tab and the
  // matching conversation thread, then clear the pending id so it doesn't reopen.
  useEffect(() => {
    if (!openConversationLeadId) return;
    let cancelled = false;
    (async () => {
      setActiveTab('leads');
      setSelectedLead(null);
      setSelectedGroupId(null);
      try {
        const res = await leadsAPI.getMyConversations();
        if (!cancelled && res.success && res.data) {
          const match = (res.data.conversations ?? []).find((c) => c.lead_id === openConversationLeadId);
          if (match) setSelectedConversation(match);
        }
      } catch {
        // ignore — nothing to open
      } finally {
        onConversationOpened?.();
      }
    })();
    return () => { cancelled = true; };
  }, [openConversationLeadId]);
  const [sharedMemories, setSharedMemories] = useState<any[]>([]);
  const [isRemovingCollaboration, setIsRemovingCollaboration] = useState(false);
  const [isLoadingShared, setIsLoadingShared] = useState(false);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [collaborationToRemove, setCollaborationToRemove] = useState<{id: number, title: string} | null>(null);

  // Properties state and data
  const [propertiesSearchQuery, setPropertiesSearchQuery] = useState('');
  const [showCreatePropertyModal, setShowCreatePropertyModal] = useState(false);
  const [showPublishLandingPagesModal, setShowPublishLandingPagesModal] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);
  const getUrlButtonRef = React.useRef<HTMLButtonElement>(null);
  const [propertyToEdit, setPropertyToEdit] = useState<any>(null);
  const [propertyToDelete, setPropertyToDelete] = useState<any>(null);
  const [showDeletePropertyModal, setShowDeletePropertyModal] = useState(false);
  const [isDeletingProperty, setIsDeletingProperty] = useState(false);

  // Property payment state (uses StripePaymentForm — same as billing page)
  const [propertyPaymentState, setPropertyPaymentState] = useState<{
    clientSecret: string;
    paymentIntentId: string;
    cart: PropertyFormData[];
  } | null>(null);

  // Single property complete-payment state (for pending_payment properties)
  const [singlePropertyPaymentState, setSinglePropertyPaymentState] = useState<{
    clientSecret: string;
    paymentIntentId: string;
    propertyId: number;
    propertyName: string;
  } | null>(null);

  // Personal account invite link state
  const [personalInviteLink, setPersonalInviteLink] = useState<string | null>(null);
  const [isLoadingPersonalInviteLink, setIsLoadingPersonalInviteLink] = useState(false);
  const [isCopyingPersonalLink, setIsCopyingPersonalLink] = useState(false);
  const personalQrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Transfer Memory state
  const [showTransferMemoryDialog, setShowTransferMemoryDialog] = useState(false);
  const [memoriesForTransfer, setMemoriesForTransfer] = useState<any[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);

  // Property filter state (for Manage Users)
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | undefined>(undefined);

  // Use the same memory counts hook as sidebar
  const { memoryCounts } = useMemoryCounts();

  const [planName, setPlanName] = useState<string>('starter');

  // Fetch users data from API
  const fetchUsers = async (searchQuery?: string, propertyId?: number) => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      setError(null);

      console.log('📊 Fetching users data...', searchQuery ? `with search: "${searchQuery}"` : '', propertyId ? `for property: ${propertyId}` : '');
      const response = await dashboardAPI.getUsersCollaboratorsAndNonCollaborators(searchQuery, propertyId);

      console.log('📊 ===== FULL API RESPONSE =====');
      console.log('📊 response:', JSON.stringify(response, null, 2));
      console.log('📊 response.success:', response.success);
      console.log('📊 response.data:', response.data);
      console.log('📊 response.data.users:', response.data?.users);
      console.log('📊 response.data.property_name:', response.data?.property_name);
      console.log('📊 ==============================');

      if (response.success && response.data) {
        let allUsers = [];

        // Check if this is a property-filtered response (double nested)
        if (response.data.data?.users && Array.isArray(response.data.data.users)) {
          // Property filter response - has users array with property_name at data.data level
          console.log('✅ Using property filter response: response.data.data.users');
          console.log('📊 Raw users from API:', response.data.data.users);

          allUsers = response.data.data.users.map((user: any) => {
            const mappedUser = {
              ...user,
              // Map created_memories_count to memory_count for consistency
              memory_count: user.created_memories_count || user.memory_count || 0,
              // Map shared_memories_count
              shared_memory_count: user.shared_memories_count || user.shared_memory_count || 0,
              // Add property info
              property: response.data.data.property_name ? {
                id: response.data.data.property_id,
                name: response.data.data.property_name
              } : undefined,
              // Ensure is_user_collaborator is set
              is_user_collaborator: user.is_user_collaborator !== undefined ? user.is_user_collaborator : true,
              // Map role to collaborator_role if needed
              collaborator_role: user.role || user.collaborator_role
            };
            console.log('📊 Mapped user:', mappedUser);
            return mappedUser;
          });

          console.log('✅ Property-filtered users count:', allUsers.length);
          console.log('✅ All mapped users:', allUsers);
        } else {
          // Regular response - extract collaborators from nested structure
          let collaborators = [];
          let nonCollaborators = [];

          // Try different possible paths for the data
          if (response.data.data && response.data.data.collaborators) {
            // Data is nested under response.data.data.collaborators
            collaborators = response.data.data.collaborators || [];
            nonCollaborators = response.data.data.non_collaborators || [];
            console.log('📊 Using nested path: response.data.data.collaborators');
          } else if (response.data.collaborators) {
            // Data is directly under response.data.collaborators
            collaborators = response.data.collaborators || [];
            nonCollaborators = response.data.non_collaborators || [];
            console.log('📊 Using direct path: response.data.collaborators');
          }

          // Combine collaborators and non-collaborators
          allUsers = [
            ...collaborators,
            ...nonCollaborators
          ];

          console.log('📊 Extracted collaborators:', collaborators.length);
          console.log('📊 Extracted non-collaborators:', nonCollaborators.length);
        }

        console.log('📊 Total users loaded:', allUsers.length);
        console.log('📊 Users data:', allUsers);

        // Debug: Check if collaborator_id, collaborator_type, memory counts, and last_active_at are present in the data
        allUsers.forEach((user, index) => {
          console.log(`📊 User ${index}:`, {
            id: user.id,
            collaborator_id: user.collaborator_id,
            collaborator_type: user.collaborator_type,
            name: user.name,
            email: user.email,
            role: user.role,
            collaborator_role: user.collaborator_role,
            is_user_collaborator: user.is_user_collaborator,
            memory_count: user.memory_count,
            shared_memory_count: user.shared_memory_count,
            last_active_at: user.last_active_at,
            created_at: user.created_at,
            property: user.property,
            memory: user.memory
          });
        });

        console.log('🎯 SETTING USERS STATE with', allUsers.length, 'users');
        setUsers(allUsers);
        console.log('✅ Users state has been set');
        
        // Also fetch shared memories count
        await fetchSharedMemoriesCount();
      } else {
        console.error('📊 Failed to fetch users:', response.error);
        setError(response.error || 'Failed to fetch users');
      }
    } catch (err) {
      console.error('📊 Error fetching users:', err);
      setError('An error occurred while fetching users');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch shared memories count from memories API (same as MemoriesPage)
  const fetchSharedMemoriesCount = async () => {
    try {
      console.log('📊 Fetching shared memories count...');
      const response = await dashboardAPI.getMemories();
      
      if (response.success && response.data) {
        // Extract sharedWith memories count (same logic as MemoriesPage)
        let sharedCount = 0;
        
        if (response.data.sharedWith && Array.isArray(response.data.sharedWith)) {
          sharedCount = response.data.sharedWith.length;
        } else if (response.data.data?.sharedWith && Array.isArray(response.data.data.sharedWith)) {
          sharedCount = response.data.data.sharedWith.length;
        }
        
        console.log('📊 Shared memories count:', sharedCount);
        setSharedMemoriesCount(sharedCount);
      }
    } catch (err) {
      console.error('📊 Error fetching shared memories count:', err);
      // Keep default count of 0 if fails
    }
  };

  // Fetch collaboration associations (memories where I'm a collaborator)
  const fetchSharedMemories = async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoadingShared(true);
      setSharedError(null);

      console.log('🤝 Fetching collaboration associations...');
      const response = await dashboardAPI.getMyCollaborationAssociations();

      console.log('🤝 Collaboration associations response:', response);

      if (response.success && response.data) {
        const associations = response.data.data?.associations || response.data.associations || [];
        console.log('🤝 Associations loaded:', associations.length);
        setSharedMemories(associations);
      } else {
        setSharedError(response.error || 'Failed to load shared campaigns');
      }
    } catch (err: any) {
      console.error('🤝 Error fetching collaboration associations:', err);
      setSharedError(err.message || 'An error occurred while loading shared campaigns');
    } finally {
      setIsLoadingShared(false);
    }
  };

  // Fetch properties
  const fetchProperties = async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoadingProperties(true);
      setPropertiesError(null);

      console.log('🏠 Fetching properties...');
      const response = await dashboardAPI.getProperties();

      console.log('🏠 Properties response:', response);

      if (response.success || response.status === 'success') {
        const responseData = response.data || response;
        // Updated to match new API structure: data.properties
        const allProperties = responseData.properties || responseData.data?.properties || responseData.data?.all_properties || responseData.all_properties || [];

        console.log('🏠 Raw properties:', allProperties);

        // Transform API data to match UI structure
        const transformedProperties = allProperties.map((prop: any) => {
          // Log label color for debugging
          if (prop.labels?.length) {
            prop.labels.forEach((l: any) => console.log('🏷️ Label from API:', l.name, '->', l.color));
          }

          // Log invite_link for debugging
          if (prop.invite_link) {
            console.log('🔗 Invite link from API:', prop.invite_link);
          }

          // Transform invited users data
          const invitedUsers = prop.invited_users || [];

          // Log the invited users for debugging
          if (invitedUsers.length > 0) {
            console.log('👥 Invited users for property:', prop.name, invitedUsers);
          }

          const displayUsers = invitedUsers.slice(0, 3).map((user: any) => {
            // Get initials from name (e.g., "John Doe" -> "JD", "tarush" -> "TT")
            const getInitials = (fullName: string) => {
              if (!fullName) return 'U';

              const nameParts = fullName.trim().split(/\s+/);

              if (nameParts.length >= 2) {
                // Has first and last name
                const first = nameParts[0][0]?.toUpperCase() || '';
                const last = nameParts[nameParts.length - 1][0]?.toUpperCase() || '';
                return first + last;
              } else if (nameParts.length === 1 && nameParts[0].length >= 2) {
                // Single name - use first two letters
                return (nameParts[0][0] + nameParts[0][1]).toUpperCase();
              } else if (nameParts.length === 1) {
                // Single character name
                const char = nameParts[0][0]?.toUpperCase() || 'U';
                return char + char;
              }

              return 'U';
            };

            const initials = getInitials(user.name);
            const profileImage = user.profile_image || null;

            console.log('👤 User:', {
              name: user.name,
              initials,
              profileImage,
              role: user.role
            });

            return {
              name: initials,
              image: profileImage
            };
          });

          const additionalUsersCount = Math.max(0, invitedUsers.length - 3);

          return {
            id: prop.id,
            name: prop.name,
            code: prop.unique_id,
            username: prop.username,
            image: prop.image,
            location: prop.location || 'No location',
            memories: prop.memories_count || 0,
            users: displayUsers,
            additionalUsers: additionalUsersCount,
            totalUsersCount: prop.users_count || 0, // Total including invited users
            labels: Array.isArray(prop.labels) && prop.labels.length > 0
              ? prop.labels.map((l: any) => ({ name: l.name, color: l.color }))
              : (prop.label ? [{ name: prop.label.name, color: prop.label.color }] : []),
            propertyType: prop.property_type || null,
            url: prop.invite_link || null,
            inviteExpiresAt: prop.invite_expires_at,
            inviteUsedCount: prop.invite_used_count || 0,
            userRole: prop.user_role,
            isCreator: prop.is_creator,
            canEdit: prop.can_edit,
            status: prop.status,
            created: new Date(prop.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })
          };
        });

        console.log('🏠 Transformed properties:', transformedProperties);
        console.log('📊 Properties summary:', {
          total: transformedProperties.length,
          withUsers: transformedProperties.filter(p => p.users.length > 0).length,
          totalUsers: transformedProperties.reduce((sum, p) => sum + p.users.length + p.additionalUsers, 0)
        });
        setProperties(transformedProperties);
      } else {
        setPropertiesError(response.error || 'Failed to load properties');
      }
    } catch (err: any) {
      console.error('🏠 Error fetching properties:', err);
      setPropertiesError(err.message || 'An error occurred while loading properties');
    } finally {
      setIsLoadingProperties(false);
    }
  };

  // Handle removing collaboration
  const handleRemoveCollaboration = async () => {
    if (!collaborationToRemove) return;

    setIsRemovingCollaboration(true);
    try {
      console.log('🗑️ Removing collaboration:', collaborationToRemove.id);

      const response = await dashboardAPI.removeCollaborationAssociation(collaborationToRemove.id);

      if (response.success) {
        toast.success('User removed successfully');

        // Close modal
        setShowRemoveModal(false);
        setCollaborationToRemove(null);

        // Refresh the shared memories list
        await fetchSharedMemories();

        // Update shared memories count
        await fetchSharedMemoriesCount();
      } else {
        toast.error(response.error || 'Failed to remove collaboration');
      }
    } catch (error) {
      console.error('❌ Error removing collaboration:', error);
      toast.error('An error occurred while removing collaboration');
    } finally {
      setIsRemovingCollaboration(false);
    }
  };

  // Build FormData from PropertyFormData
  const buildPropertyFormData = (propertyData: PropertyFormData): FormData => {
    const formData = new FormData();
    formData.append('name', propertyData.propertyName);
    if (propertyData.id) formData.append('unique_id', propertyData.id);
    formData.append('username', propertyData.username);
    if (propertyData.location) formData.append('location', propertyData.location);
    if (propertyData.labels && propertyData.labels.length > 0) {
      formData.append('label', propertyData.labels.join(', '));
    }
    if (propertyData.image) formData.append('image', propertyData.image);
    return formData;
  };

  // Internal users: direct create from cart (one property at a time)
  const handleCreateProperty = async (propertyData: PropertyFormData) => {
    if (!propertyData.propertyName || !propertyData.username) {
      toast.error('Please fill in all required fields');
      return;
    }
    const formData = buildPropertyFormData(propertyData);
    const response = await dashboardAPI.createProperty(formData);
    if (response.success) {
      toast.success('Property created successfully');
      setShowCreatePropertyModal(false);
      await fetchProperties();
    } else {
      if (response.errors) {
        const err: any = new Error(response.error || 'Validation failed');
        err.fieldErrors = response.errors;
        throw err;
      }
      throw new Error(response.error || 'Failed to create property');
    }
  };

  // Cart checkout: called when user clicks "Checkout" with N properties
  const handleCheckout = async (cart: PropertyFormData[]) => {
    if (cart.length === 0) return;

    try {
      const formData = new FormData();
      formData.append('quantity', String(cart.length));
      cart.forEach((property, i) => {
        formData.append(`properties[${i}][name]`, property.propertyName);
        formData.append(`properties[${i}][username]`, property.username);
        if (property.location) formData.append(`properties[${i}][location]`, property.location);
        if (property.labels?.length) formData.append(`properties[${i}][label]`, property.labels.join(', '));
        if (property.image) formData.append(`properties[${i}][image]`, property.image);
      });

      const payRes = await dashboardAPI.purchaseProperty(formData);
      if (!payRes.success) throw new Error(payRes.error || 'Failed to initiate payment');

      const clientSecret = payRes.data?.client_secret || payRes.data?.data?.client_secret;
      const paymentIntentId = payRes.data?.payment_intent_id || payRes.data?.data?.payment_intent_id;

      if (!clientSecret || !paymentIntentId) throw new Error('Invalid payment response from server');

      setPropertyPaymentState({ clientSecret, paymentIntentId, cart });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to initiate checkout');
      throw error;
    }
  };

  // Called after Stripe confirms payment — backend confirm + create remaining + activate all
  const handlePropertyPaymentSuccess = async (_paymentMethodId: string) => {
    if (!propertyPaymentState) return;
    const { paymentIntentId, cart } = propertyPaymentState;

    try {
      // Confirm with backend — first property is created here
      const confirmRes = await dashboardAPI.confirmPropertyPayment(paymentIntentId);
      const firstPropertyId =
        confirmRes.data?.data?.property?.id || confirmRes.data?.property?.id;

      const allPropertyIds: number[] = firstPropertyId ? [firstPropertyId] : [];

      // Create remaining properties (index 1+)
      for (let i = 1; i < cart.length; i++) {
        const fd = buildPropertyFormData(cart[i]);
        const res = await dashboardAPI.createProperty(fd);
        const id = res.data?.data?.id || res.data?.id;
        if (id) allPropertyIds.push(id);
      }

      // Activate all via invite-link
      for (const id of allPropertyIds) {
        await dashboardAPI.createPropertyInviteLink(id);
      }

      toast.success(`${cart.length > 1 ? cart.length + ' properties' : 'Property'} created and activated successfully`);
    } catch {
      toast.success('Payment received — properties being activated');
    } finally {
      setPropertyPaymentState(null);
      setShowCreatePropertyModal(false);
      await fetchProperties();
    }
  };

  // Complete payment for an existing pending_payment property
  const handleCompletePayment = async (property: any) => {
    try {
      const payRes = await dashboardAPI.purchaseProperty({ quantity: 1, property_id: property.id });
      if (!payRes.success) throw new Error(payRes.error || 'Failed to initiate payment');

      const clientSecret = payRes.data?.client_secret || payRes.data?.data?.client_secret;
      const paymentIntentId = payRes.data?.payment_intent_id || payRes.data?.data?.payment_intent_id;

      if (!clientSecret || !paymentIntentId) throw new Error('Invalid payment response from server');

      setSinglePropertyPaymentState({ clientSecret, paymentIntentId, propertyId: property.id, propertyName: property.name });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to initiate payment');
    }
  };

  // Called after Stripe confirms payment for a single pending_payment property
  const handleSinglePropertyPaymentSuccess = async (_paymentMethodId: string) => {
    if (!singlePropertyPaymentState) return;
    const { paymentIntentId, propertyId } = singlePropertyPaymentState;

    try {
      await dashboardAPI.confirmPropertyPayment(paymentIntentId);
      await dashboardAPI.createPropertyInviteLink(propertyId);
      toast.success('Payment complete — property activated successfully');
    } catch {
      toast.success('Payment received — property being activated');
    } finally {
      setSinglePropertyPaymentState(null);
      await fetchProperties();
    }
  };

  // Handle updating a property
  const handleUpdateProperty = async (propertyData: PropertyFormData) => {
    if (!propertyToEdit) return;

    console.log('Updating property:', propertyToEdit.id, propertyData);

    try {
      // Validate required fields
      if (!propertyData.propertyName || !propertyData.username) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Create FormData for API
      const formData = new FormData();
      formData.append('name', propertyData.propertyName);
      if (propertyData.id) {
        formData.append('unique_id', propertyData.id);
      }
      formData.append('username', propertyData.username);

      // Add optional fields
      if (propertyData.location) {
        formData.append('location', propertyData.location);
      }

      // Add labels
      if (propertyData.labels && propertyData.labels.length > 0) {
        const labelsString = propertyData.labels.join(', ');
        formData.append('label', labelsString);
      }

      // Handle image update/removal
      if (propertyData.image) {
        formData.append('image', propertyData.image);
      }

      // If image was removed (check if there's a way to detect this)
      // formData.append('remove_image', 'true');

      // Call API
      const response = await dashboardAPI.updateProperty(propertyToEdit.id, formData);

      if (response.success || response.status === 'success') {
        toast.success('Property updated successfully');
        setPropertyToEdit(null);
        setShowCreatePropertyModal(false);

        // Refresh properties list
        await fetchProperties();
      } else {
        toast.error(response.error || response.message || 'Failed to update property');
      }
    } catch (error: any) {
      console.error('Error updating property:', error);
      toast.error(error.message || 'An error occurred while updating the property');
    }
  };

  const handleExportUsers = () => {
    if (users.length === 0) {
      toast.info('No users to export');
      return;
    }
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };
    const headers = ['Name', 'Email', 'Phone', 'Role', 'Status', 'Property', 'Campaigns', 'Joined'];
    const rows = users.map(u => [
      u.name || '',
      u.email || '',
      u.phone_number || '',
      u.collaborator_role || u.role || '',
      getDisplayStatus(u.status),
      u.property?.name || '',
      u.memory?.title || '',
      formatDate(u.created_at)
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${users.length} user${users.length !== 1 ? 's' : ''}`);
  };

  // Handle deleting a property
  const handleDeleteProperty = async () => {
    if (!propertyToDelete) return;

    setIsDeletingProperty(true);
    try {
      console.log('🗑️ Deleting property:', propertyToDelete.id);

      const response = await dashboardAPI.deleteProperty(propertyToDelete.id);

      if (response.success || response.status === 'success') {
        toast.success('Property deleted successfully');

        // Close modal
        setShowDeletePropertyModal(false);
        setPropertyToDelete(null);

        // Refresh properties list
        await fetchProperties();
      } else {
        toast.error(response.error || response.message || 'Failed to delete property');
      }
    } catch (error: any) {
      console.error('❌ Error deleting property:', error);
      toast.error(error.message || 'An error occurred while deleting property');
    } finally {
      setIsDeletingProperty(false);
    }
  };

  // Handle updating property status (activate/deactivate)
  const handleUpdatePropertyStatus = async (property: any) => {
    try {
      const newStatus = !property.status;
      console.log('🔄 Updating property status:', property.id, 'Current status:', property.status, 'New status:', newStatus);

      const response = await dashboardAPI.updatePropertyStatus(property.id, newStatus);

      if (response.success || response.status === 'success') {
        toast.success(`Property ${newStatus ? 'activated' : 'deactivated'} successfully`);

        // Refresh properties list
        await fetchProperties();
      } else {
        toast.error(response.error || response.message || 'Failed to update property status');
      }
    } catch (error: any) {
      console.error('❌ Error updating property status:', error);
      toast.error(error.message || 'An error occurred while updating property status');
    }
  };

  // Handle viewing property (switch to property account)
  const handleViewProperty = (property: any) => {
    console.log('👁️ Viewing property:', property.name, property.id);

    // Prepare property data in the format expected by PropertyContext
    const propertyData = {
      id: property.id,
      name: property.name,
      username: property.username,
      unique_id: property.code,
      image: property.image,
      location: property.location
    };

    // Store property data in localStorage for persistence across page navigation
    localStorage.setItem('selected_property', JSON.stringify(propertyData));

    // Set a flag to indicate pending property switch
    localStorage.setItem('pending_property_switch', 'first');

    // Switch to the property account
    switchToProperty(propertyData);

    // Show success message
    toast.success(`Switching to ${property.name}...`);

    // Navigate to memories page with the property context
    // Small delay to ensure context is set before navigation
    setTimeout(() => {
      window.location.href = '/';
    }, 100);
  };

  // Handle publishing landing pages
  const handlePublishLandingPages = async (selectedPropertyIds: number[]): Promise<{ success: boolean; links?: any[] }> => {
    console.log('Publishing landing pages for properties:', selectedPropertyIds);

    try {
      const links = [];

      // Call API for each selected property
      for (const propertyId of selectedPropertyIds) {
        try {
          const response = await dashboardAPI.createPropertyInviteLink(propertyId);

          console.log(`✅ Full response for property ${propertyId}:`, JSON.stringify(response, null, 2));

          if (response.success && response.data) {
            // The API returns: { success: true, data: { status, message, data: { invite, link, expires_at } } }
            // So we need to access response.data.data for the actual invite data
            const inviteData = response.data.data || response.data;

            console.log('📝 Extracted invite data:', JSON.stringify(inviteData, null, 2));
            console.log('🔗 Link value:', inviteData.link);
            console.log('⏰ Expires at:', inviteData.expires_at);

            if (inviteData.link) {
              links.push({
                propertyId,
                link: inviteData.link,
                expires_at: inviteData.expires_at,
                token: inviteData.invite?.token
              });
              console.log(`✅ Successfully added link for property ${propertyId}`);
            } else {
              console.error(`❌ No link found in invite data for property ${propertyId}`);
            }
          } else {
            console.error(`❌ Response not successful for property ${propertyId}:`, response);
          }
        } catch (error) {
          console.error(`❌ Error creating invite link for property ${propertyId}:`, error);
        }
      }

      console.log('All links generated:', links);

      if (links.length > 0) {
        return { success: true, links };
      } else {
        toast.error('Failed to create invite links');
        return { success: false };
      }
    } catch (error) {
      console.error('Error publishing landing pages:', error);
      toast.error('An error occurred while publishing landing pages');
      return { success: false };
    }
  };


  // Clear the tab-redirect flag from sessionStorage on mount
  useEffect(() => {
    sessionStorage.removeItem('users_open_tab');
  }, []);

  // Fetch personal invite link when properties tab is active
  useEffect(() => {
    if (activeTab === 'properties' && isAuthenticated && !personalInviteLink) {
      setIsLoadingPersonalInviteLink(true);
      dashboardAPI.getPersonalInviteLink()
        .then(res => {
          const d = res.data?.data || res.data;
          if (res.success && d?.invite_link) setPersonalInviteLink(d.invite_link);
        })
        .catch(() => {})
        .finally(() => setIsLoadingPersonalInviteLink(false));
    }
  }, [activeTab, isAuthenticated]);

  // Load users when component mounts, tab changes, or property filter changes
  useEffect(() => {
    if (activeTab === 'users' && isAuthenticated) {
      // Only fetch if not searching (search has its own debounced effect)
      if (!searchQuery.trim()) {
        fetchUsers(undefined, selectedPropertyId);
      }
    }
  }, [isAuthenticated, selectedPropertyId, activeTab]);

  // Debounced search effect - trigger API call when typing
  useEffect(() => {
    if (activeTab !== 'users') return; // Only search when on users tab

    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        console.log('🔍 Debounced search triggered for:', searchQuery);
        // Clear property filter when searching
        setSelectedPropertyId(undefined);
        fetchUsers(searchQuery.trim());
      } else {
        // If search is cleared, fetch all users (with property filter if set)
        fetchUsers(undefined, selectedPropertyId);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isAuthenticated, activeTab]);

  // Handle tab changes for shared-with and properties
  useEffect(() => {
    if (activeTab === 'shared-with') {
      setSelectedPropertyId(undefined);
      fetchSharedMemories();
    } else if (activeTab === 'properties') {
      setSelectedPropertyId(undefined);
    }
  }, [activeTab, isAuthenticated]);

  // Fetch properties when properties tab is active
  useEffect(() => {
    if (activeTab === 'properties') {
      fetchProperties();
    }
  }, [activeTab, isAuthenticated]);

  // Fetch plan name on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    dashboardAPI.getStorageOverview().then((res) => {
      const overview = res?.data?.data?.storage_overview;
      if (overview?.plan_name) {
        setPlanName(overview.plan_name.toLowerCase());
      }
    }).catch(() => {});
  }, [isAuthenticated]);

  // Fetch memories for transfer dropdown
  const fetchMemoriesForTransfer = async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoadingMemories(true);
      console.log('🔄 Fetching transferable memories...');

      const response = await dashboardAPI.getTransferableMemories();
      console.log('🔄 Full API response:', response);

      if (response.success && response.data) {
        // Handle nested response structure
        const data = response.data.data || response.data;
        console.log('🔄 Data layer:', data);
        console.log('🔄 Is data an array?', Array.isArray(data));

        let memoriesList = [];

        // Check if data is directly an array
        if (Array.isArray(data)) {
          memoriesList = data;
          console.log('🔄 Data is array, total memories:', memoriesList.length);
        }
        // Or if data has a memories property
        else if (data.memories && Array.isArray(data.memories)) {
          memoriesList = data.memories;
          console.log('🔄 Found memories in data.memories:', memoriesList.length);
        }
        // Or if data has items property
        else if (data.items && Array.isArray(data.items)) {
          memoriesList = data.items;
          console.log('🔄 Found memories in data.items:', memoriesList.length);
        }

        console.log('🔄 Total transferable memories:', memoriesList.length);
        if (memoriesList.length > 0) {
          console.log('🔄 Sample memory structure:', memoriesList[0]);
          console.log('🔄 Sample memory fields:', {
            id: memoriesList[0]?.id,
            title: memoriesList[0]?.title,
            last_update_img: memoriesList[0]?.last_update_img,
            updated_at: memoriesList[0]?.updated_at,
            last_updated_image: memoriesList[0]?.last_updated_image,
            thumbnail: memoriesList[0]?.thumbnail,
            photos: memoriesList[0]?.photos,
            author: memoriesList[0]?.author
          });
        }
        setMemoriesForTransfer(memoriesList);
      } else {
        console.error('🔄 Failed response:', response);
        toast.error('Failed to load memories');
      }
    } catch (error) {
      console.error('Error fetching memories:', error);
      toast.error('Failed to load memories');
    } finally {
      setIsLoadingMemories(false);
    }
  };

  // Fetch memories when transfer dialog opens
  useEffect(() => {
    if (showTransferMemoryDialog) {
      fetchMemoriesForTransfer();
    }
  }, [showTransferMemoryDialog, isAuthenticated]);

  // Stats calculations
  const totalUsers = users.length;
  const activeUsers = users.filter(user => user.status === 1).length;
  const pendingInvites = users.filter(user => user.status === 0).length;
  const collaborators = users.filter(user => user.is_user_collaborator).length;
  const adminCount = users.filter(user => ['admin', 'partial_admin'].includes(user.collaborator_role || user.role || '')).length;
  const adminLimit = planName === 'professional' ? 5 : planName === 'intermediate' ? 3 : 1;
  
  // Use the same memory count source as sidebar + add shared memories count
  // Total memories = sidebar total_memories + shared memories count
  const totalMemories = (memoryCounts?.total_memories || 0) + sharedMemoriesCount;
  const collaborations = collaborators;

  // Filter users based on role and status filters (search is handled by API)
  const filteredUsers = users.filter(user => {
    const userRole = user.collaborator_role || user.role || 'user';
    // Normalize role names (viewer -> view)
    const normalizedUserRole = userRole.toLowerCase() === 'viewer' ? 'view' : userRole.toLowerCase();
    const normalizedSelectedRole = selectedRole.toLowerCase();
    const matchesRole = selectedRole === 'All Roles' || normalizedUserRole === normalizedSelectedRole;
    const userStatus = getDisplayStatus(user.status);
    const matchesStatus = selectedStatus === 'All Status' || userStatus === selectedStatus.toLowerCase();

    const matches = matchesRole && matchesStatus;

    if (!matches) {
      console.log('❌ User filtered out:', {
        name: user.name,
        userRole,
        normalizedUserRole,
        selectedRole,
        matchesRole,
        userStatus,
        selectedStatus,
        matchesStatus
      });
    }

    return matches;
  });

  console.log('🔍 FILTER RESULTS:', {
    totalUsers: users.length,
    filteredUsers: filteredUsers.length,
    selectedRole,
    selectedStatus
  });

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedRole('All Roles');
    setSelectedStatus('All Status');
  };

  const getRoleColor = (role: string) => {
    const lowerRole = role.toLowerCase();
    switch (lowerRole) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'edit':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'collaborator':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'contributor':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'view':
      case 'viewer':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'user':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleIcon = (role: string) => {
    const lowerRole = role.toLowerCase();
    switch (lowerRole) {
      case 'admin':
        return <Crown className="w-3 h-3" />;
      case 'edit':
        return <Edit className="w-3 h-3" />;
      case 'collaborator':
        return <Users className="w-3 h-3" />;
      case 'contributor':
        return <UserPlus className="w-3 h-3" />;
      case 'view':
      case 'viewer':
        return <Eye className="w-3 h-3" />;
      case 'user':
        return <User className="w-3 h-3" />;
      default:
        return <User className="w-3 h-3" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const generateInitials = (name: string | null | undefined): string => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleEditUser = (user: User) => {
    // Only allow editing if the user has a collaborator_id (is a collaborator)
    if (!user.collaborator_id) {
      alert('This user is not a collaborator and cannot be edited through this interface.');
      return;
    }

    setSelectedCollaborator(user);
    setShowEditModal(true);
  };

  const handleDeactivateUser = async (user: User) => {
    try {
      console.log('Deactivating user:', user.name);

      // Show confirmation dialog
      const confirmed = window.confirm(`Are you sure you want to deactivate ${user.name}?`);
      if (!confirmed) return;

      // Call the API to deactivate the user
      const response = await dashboardAPI.deactivateUser(user.id);

      if (response.success) {
        // Update the local state
        setUsers(prevUsers =>
          prevUsers.map(u =>
            u.id === user.id
              ? { ...u, status: 0 } // Set status to 0 (deactivated)
              : u
          )
        );

        console.log('User deactivated successfully');
      } else {
        console.error('Failed to deactivate user:', response.error);
        alert('Failed to deactivate user. Please try again.');
      }
    } catch (error) {
      console.error('Error deactivating user:', error);
      alert('An error occurred while deactivating the user.');
    }
  };

  const handleRemoveUser = (user: User) => {
    // Show custom confirmation modal
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const confirmRemoveUser = async () => {
    if (!userToDelete) return;

    try {
      console.log('Removing user collaborator:', userToDelete.name);
      console.log('User data:', {
        id: userToDelete.id,
        collaborator_id: userToDelete.collaborator_id,
        collaborator_type: userToDelete.collaborator_type,
        email: userToDelete.email
      });

      // Determine which parameters to send based on collaborator_type and available data
      let collaboratorUserId: number | undefined;
      let collaboratorEmail: string | undefined;
      const collaboratorType = userToDelete.collaborator_type || 'user';

      if (collaboratorType === 'user' && userToDelete.id) {
        // For user type collaborators, send collaborator_user_id (use user.id)
        collaboratorUserId = userToDelete.id;
      } else if (userToDelete.email) {
        // For non-user collaborators or when no user.id, send email
        collaboratorEmail = userToDelete.email;
      } else if (userToDelete.id) {
        // Fallback to user.id if email not available
        collaboratorUserId = userToDelete.id;
      }

      console.log('API call parameters:', {
        collaboratorUserId,
        collaboratorEmail,
        collaboratorType
      });

      // Call the new API to delete user collaborator
      const response = await dashboardAPI.deleteUserCollaborator(
        collaboratorUserId,
        collaboratorEmail,
        collaboratorType
      );

      if (response.success) {
        // Update the local state
        setUsers(prevUsers => prevUsers.filter(u => u.id !== userToDelete.id));

        console.log('User collaborator removed successfully');
        const userName = userToDelete.name || userToDelete.email || 'User';
        toast.success(`${userName} has been removed successfully`);

        // Close modal
        setShowDeleteModal(false);
        setUserToDelete(null);
      } else {
        console.error('Failed to remove user collaborator:', response.error);
        toast.error(response.error || 'Failed to remove user collaborator. Please try again.');
      }
    } catch (error) {
      console.error('Error removing user collaborator:', error);
      toast.error('An error occurred while removing the user collaborator.');
    }
  };

  const handleSaveCollaborator = async (collaboratorId: number, updates: {
    name: string;
    email: string;
    role: string;
    message?: string;
    collaborator_type?: string;
    memory_ids?: (string | number)[];
    phone_number?: string;
  }) => {
    try {
      console.log('Saving collaborator updates:', { collaboratorId, updates });

      // Map frontend role values to backend API values
      const roleMapping: Record<string, string> = {
        'view': 'viewer',
        'collaborator': 'contributor',
        'admin': 'admin',
        'partial_admin': 'partial_admin'
      };

      const backendRole = roleMapping[updates.role.toLowerCase()] || updates.role;
      console.log('Mapped role:', updates.role, '->', backendRole);

      const collaboratorType = updates.collaborator_type || 'user';
      console.log('Using collaborator_type:', collaboratorType);

      const response = await dashboardAPI.editUserCollaboratorRole(collaboratorId, backendRole, collaboratorType, updates.memory_ids, updates.phone_number);

      if (response.success) {
        console.log('Collaborator role updated successfully');
        window.location.reload();
      } else {
        console.error('Failed to update collaborator role:', response.error || response.message);
        // Throw error with the actual message from API response
        const errorMessage = response.message || response.error || 'Failed to update collaborator role';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error updating collaborator role:', error);
      // Re-throw the error to be caught by the modal
      throw error;
    }
  };

  const isPanelOpen = activeTab === 'leads' && (!!selectedLead || !!selectedGroupId || !!selectedConversation);


  return (
    <div className="flex bg-white min-h-screen">

      {/* LEFT: entire page content — shrinks when lead panel open */}
      <div className={`transition-all duration-300 ${isPanelOpen ? 'hidden sm:block sm:w-[70%]' : 'w-full'}`}>
      <div className="py-2 sm:p-3 md:p-4">
      <div className="w-full sm:px-3 bg-white">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">Users</h1>
              <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-0.5 sm:mt-1">Manage team members and their access permissions</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-3 md:gap-4">
            <div className="bg-white rounded-md sm:rounded-lg p-2.5 sm:p-3 md:p-4 border border-gray-200 shadow-sm">
              <div className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Total Users</div>
              <div className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">{totalUsers}</div>
              <div className="text-[10px] sm:text-xs text-blue-600 mt-0.5 sm:mt-1 md:mt-2">+{activeUsers} active</div>
            </div>
            <div className="bg-white rounded-md sm:rounded-lg p-2.5 sm:p-3 md:p-4 border border-gray-200 shadow-sm">
              <div className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Active Users</div>
              <div className="text-lg sm:text-xl md:text-2xl font-semibold text-green-600">{activeUsers}</div>
              <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 md:mt-2">{totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0}% of total</div>
            </div>
            <div className="bg-white rounded-md sm:rounded-lg p-2.5 sm:p-3 md:p-4 border border-gray-200 shadow-sm">
              <div className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Pending Invites</div>
              <div className="text-lg sm:text-xl md:text-2xl font-semibold text-orange-600">{pendingInvites}</div>
              <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 md:mt-2">Awaiting acceptance</div>
            </div>
            <div className="bg-white rounded-md sm:rounded-lg p-2.5 sm:p-3 md:p-4 border border-gray-200 shadow-sm">
              <div className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Total Campaigns</div>
              <div className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">{totalMemories}</div>
              <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 md:mt-2">Across all users</div>
            </div>
            <div className="bg-white rounded-md sm:rounded-lg p-2.5 sm:p-3 md:p-4 border border-gray-200 shadow-sm">
              <div className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Collaborations</div>
              <div className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">{collaborations}</div>
              <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 md:mt-2">Shared campaigns</div>
            </div>
            <div className="bg-white rounded-md sm:rounded-lg p-2.5 sm:p-3 md:p-4 border border-gray-200 shadow-sm">
              <div className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Shared With</div>
              <div className="text-lg sm:text-xl md:text-2xl font-semibold text-purple-600">{sharedMemories.length}</div>
              <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 md:mt-2">As collaborator</div>
            </div>
            <div className="bg-white rounded-md sm:rounded-lg p-2.5 sm:p-3 md:p-4 border border-gray-200 shadow-sm">
              <div className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Admins</div>
              <div className={`text-lg sm:text-xl md:text-2xl font-semibold ${adminCount >= adminLimit ? 'text-red-600' : 'text-green-600'}`}>{adminCount}/{adminLimit}</div>
              <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 md:mt-2">By plan limit</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 sm:mb-6">
          {/* Mobile-only action buttons row */}
          {(activeTab === 'users' || (activeTab === 'properties' && (currentUser?.role === 2 || currentUser?.role === '2' || currentUser?.role === 4 || currentUser?.role === '4'))) && (
            <div className="flex sm:hidden items-center justify-end gap-2 px-3 py-2 border-b border-gray-100">
              {activeTab === 'users' && (
                <>
                  <Button
                    onClick={handleExportUsers}
                    variant="outline"
                    className="flex items-center gap-1.5 text-xs h-8 px-2.5 border-gray-300 text-gray-700 hover:bg-[#6C60FF] hover:text-white hover:border-[#6C60FF]"
                  >
                    <Download className="w-3 h-3" />
                    Export
                  </Button>
                  <Button
                    onClick={() => setShowInviteModal(true)}
                    className="bg-[#6C60FF] hover:bg-[#5A4FE5] text-white flex items-center gap-1.5 text-xs h-8 px-2.5"
                  >
                    <UserPlus className="w-3 h-3" />
                    Invite
                  </Button>
                </>
              )}
              {activeTab === 'properties' && (currentUser?.role === 2 || currentUser?.role === '2' || currentUser?.role === 4 || currentUser?.role === '4') && (
                <>
                  <span className="text-xs text-gray-600 mr-1">{properties.length} properties</span>
                  <Button
                    ref={getUrlButtonRef}
                    onClick={() => setShowPublishLandingPagesModal(true)}
                    variant="outline"
                    className="flex items-center gap-1.5 text-xs h-8 px-2.5 border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <Link className="w-3 h-3" />
                    Get URL
                  </Button>
                  <Button
                    onClick={() => setShowCreatePropertyModal(true)}
                    className="bg-[#6C60FF] hover:bg-[#5A4FE5] text-white flex items-center gap-1.5 text-xs h-8 px-2.5"
                  >
                    <Plus className="w-3 h-3" />
                    Create
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Tabs row + desktop buttons */}
          <div className="flex items-center justify-between border-b border-gray-200">
            <div className="flex overflow-x-auto scrollbar-hide flex-1">
              <button
                onClick={() => setActiveTab('users')}
                className={`flex-1 sm:flex-none px-3 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap text-center ${
                  activeTab === 'users'
                    ? 'text-[#6C60FF] border-b-2 border-[#6C60FF] -mb-[1px]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Users
              </button>
              <button
                onClick={() => setActiveTab('leads')}
                className={`flex-1 sm:flex-none px-3 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap text-center ${
                  activeTab === 'leads'
                    ? 'text-[#6C60FF] border-b-2 border-[#6C60FF] -mb-[1px]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  Leads
                  {leadsUnreadCount > 0 && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-lg bg-red-500 text-white text-[10px] font-bold leading-none">
                      {leadsUnreadCount}
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('shared-with')}
                className={`flex-1 sm:flex-none px-3 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap text-center ${
                  activeTab === 'shared-with'
                    ? 'text-[#6C60FF] border-b-2 border-[#6C60FF] -mb-[1px]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Shared with
              </button>
              {planName !== 'starter' && (currentUser?.role === 2 || currentUser?.role === '2' || currentUser?.role === 4 || currentUser?.role === '4' || planName === 'intermediate' || planName === 'professional' || currentUser?.is_internal) && (
                <button
                  onClick={() => setActiveTab('properties')}
                  className={`flex-1 sm:flex-none px-3 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap text-center ${
                    activeTab === 'properties'
                      ? 'text-[#6C60FF] border-b-2 border-[#6C60FF] -mb-[1px]'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Properties
                </button>
              )}
            </div>
            {/* Desktop-only action buttons */}
            <div className="hidden sm:flex items-center gap-2 sm:gap-3 px-3 sm:px-4 shrink-0">
              {activeTab === 'users' && (
                <>
                  <Button
                    onClick={handleExportUsers}
                    variant="outline"
                    className="flex items-center gap-2 text-sm h-9 px-3 border-gray-300 text-gray-700 hover:bg-[#6C60FF] hover:text-white hover:border-[#6C60FF]"
                  >
                    <Download className="w-4 h-4" />
                    Export Users
                  </Button>
                  <Button
                    onClick={() => setShowInviteModal(true)}
                    className="bg-[#6C60FF] hover:bg-[#5A4FE5] text-white flex items-center gap-2 text-sm h-9 px-3"
                  >
                    <UserPlus className="w-4 h-4" />
                    Invite User
                  </Button>
                </>
              )}
              {activeTab === 'properties' && (currentUser?.role === 2 || currentUser?.role === '2' || currentUser?.role === 4 || currentUser?.role === '4') && (
                <>
                  <span className="text-sm text-gray-600">{properties.length} properties</span>
                  <Button
                    ref={getUrlButtonRef}
                    onClick={() => setShowPublishLandingPagesModal(true)}
                    variant="outline"
                    className="flex items-center gap-2 text-sm h-9 px-3 border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <Link className="w-4 h-4" />
                    Get URL
                  </Button>
                  <Button
                    onClick={() => setShowCreatePropertyModal(true)}
                    className="bg-[#6C60FF] hover:bg-[#5A4FE5] text-white flex items-center gap-2 text-sm h-9 px-3"
                  >
                    <Plus className="w-4 h-4" />
                    Create Property
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Personal Account Invite Link Card */}
        {activeTab === 'properties' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 mb-4 sm:mb-6">
            {isLoadingPersonalInviteLink ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-[#6C60FF] rounded-full animate-spin" />
                Loading invite link...
              </div>
            ) : personalInviteLink ? (
              <>
                {/* Hidden QR canvas for download */}
                <div className="hidden">
                  <QRCodeCanvas
                    ref={personalQrCanvasRef}
                    value={personalInviteLink}
                    size={512}
                    marginSize={2}
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  {/* Label + URL */}
                  <div className="flex items-center gap-2 flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                    <span className="text-xs font-semibold text-gray-600 whitespace-nowrap flex-shrink-0">Main Property:</span>
                    <input
                      readOnly
                      value={personalInviteLink}
                      className="flex-1 min-w-0 text-xs text-gray-500 bg-transparent focus:outline-none truncate"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Copy URL */}
                    <button
                      onClick={async () => {
                        setIsCopyingPersonalLink(true);
                        try {
                          await navigator.clipboard.writeText(personalInviteLink);
                          toast.success('Link copied!');
                        } catch {
                          toast.error('Failed to copy link');
                        } finally {
                          setTimeout(() => setIsCopyingPersonalLink(false), 1500);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                      <Link className="w-3.5 h-3.5" />
                      {isCopyingPersonalLink ? 'Copied!' : 'Copy URL'}
                    </button>

                    {/* Share */}
                    <button
                      onClick={async () => {
                        if (navigator.share) {
                          try {
                            await navigator.share({ title: 'Join my account', url: personalInviteLink });
                          } catch {}
                        } else {
                          await navigator.clipboard.writeText(personalInviteLink);
                          toast.success('Link copied to clipboard!');
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Share
                    </button>

                    {/* Get QR Code */}
                    <button
                      onClick={() => {
                        const canvas = personalQrCanvasRef.current;
                        if (!canvas) return;
                        const url = canvas.toDataURL('image/png');
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'invite-qr-code.png';
                        a.click();
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Get QR Code
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <span className="text-xs text-gray-400 py-1 block">Could not load invite link</span>
            )}
          </div>
        )}

        {/* Filters and Search - Single Row Layout */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 w-full">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <Input
                placeholder="Search users or emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 sm:pl-10 w-full bg-white border-gray-300 placeholder:text-gray-500 h-8 sm:h-9 text-xs sm:text-sm"
              />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 sm:ml-6">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-full sm:w-28 bg-gray-50 border-gray-200 h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Roles">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="collaborator">Contributor</SelectItem>
                  <SelectItem value="view">View</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full sm:w-28 bg-gray-50 border-gray-200 h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Status">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" onClick={handleClearFilters} className="text-xs sm:text-sm text-gray-600 hover:text-gray-900 whitespace-nowrap h-8 sm:h-9 px-2 sm:px-3">
                Clear
              </Button>
            </div>
          </div>
        </div>
        )}

        {/* Users Table */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm md:text-base font-medium text-gray-900">All Users</h3>
              <span className="text-[10px] sm:text-xs md:text-sm text-gray-500">{filteredUsers.length} of {totalUsers} users</span>
            </div>
          </div>

          {/* Desktop Table View - Hidden on mobile */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaigns</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6C60FF]"></div>
                        <span className="ml-2 text-gray-500">Loading users...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="text-red-600">{error}</div>
                      <Button 
                        onClick={fetchUsers} 
                        variant="outline" 
                        className="mt-2"
                      >
                        Retry
                      </Button>
                    </td>
                  </tr>
                ) : filteredUsers.map((user, index) => {
                  const displayRole = user.collaborator_role || user.role || 'view';
                  let displayRoleName = displayRole.toUpperCase();
                  if (displayRole.toLowerCase() === 'user') {
                    displayRoleName = 'VIEW';
                  } else if (displayRole.toLowerCase() === 'viewer') {
                    displayRoleName = 'VIEW';
                  }
                  const displayStatus = getDisplayStatus(user.status);

                  return (
                    <tr key={`user-${user.id}-${index}`} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Avatar className="h-8 w-8">
                            {user.profile_image ? (
                              <AvatarImage src={user.profile_image} alt={user.name} />
                            ) : null}
                            <AvatarFallback
                              className="text-sm text-white"
                              style={{ backgroundColor: userDisplayUtils.getUserDisplayColor(user) }}
                            >
                              {generateInitials(user.name || user.email || 'User')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            {user.property?.name && (
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <Home className="h-3 w-3" />
                                Property: {user.property.name}
                              </div>
                            )}
                            {user.memory?.title && !user.property?.name && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                Campaign: {user.memory.title}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <Badge className={`text-xs font-medium px-2 py-1 rounded border ${getRoleColor(displayRole)} flex items-center gap-1`}>
                          {getRoleIcon(displayRole)}
                          {displayRoleName}
                        </Badge>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <Badge className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(displayStatus)}`}>
                          {displayStatus.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex flex-col">
                          <span className="text-gray-700">{user.memory_count || 0} created</span>
                          <span className="text-gray-500">{user.shared_memory_count || 0} shared</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getTimeAgo(user.last_active_at)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-white">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white border border-gray-200 shadow-lg rounded-md">
                            <DropdownMenuItem onClick={() => handleEditUser(user)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeactivateUser(user)}
                              className="text-orange-600"
                            >
                              <UserX className="w-4 h-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleRemoveUser(user)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View - Visible only on mobile */}
          <div className="md:hidden">
            {isLoading ? (
              <div className="p-6 text-center">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6C60FF]"></div>
                  <span className="ml-2 text-gray-500 text-sm">Loading users...</span>
                </div>
              </div>
            ) : error ? (
              <div className="p-6 text-center">
                <div className="text-red-600 text-sm">{error}</div>
                <Button
                  onClick={fetchUsers}
                  variant="outline"
                  className="mt-2 text-xs"
                >
                  Retry
                </Button>
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {filteredUsers.map((user, index) => {
                  const displayRole = user.collaborator_role || user.role || 'view';
                  let displayRoleName = displayRole.toUpperCase();
                  if (displayRole.toLowerCase() === 'user') {
                    displayRoleName = 'VIEW';
                  } else if (displayRole.toLowerCase() === 'viewer') {
                    displayRoleName = 'VIEW';
                  }
                  const displayStatus = getDisplayStatus(user.status);

                  return (
                    <div key={`user-mobile-${user.id}-${index}`} className="p-3 hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            {user.profile_image ? (
                              <AvatarImage src={user.profile_image} alt={user.name} />
                            ) : null}
                            <AvatarFallback
                              className="text-xs text-white"
                              style={{ backgroundColor: userDisplayUtils.getUserDisplayColor(user) }}
                            >
                              {generateInitials(user.name || user.email || 'User')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-medium text-gray-900 truncate">{user.name}</h4>
                              <Badge className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getStatusColor(displayStatus)}`}>
                                {displayStatus.toUpperCase()}
                              </Badge>
                            </div>
                            {user.property?.name && (
                              <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                                <Home className="h-3 w-3" />
                                Property: {user.property.name}
                              </p>
                            )}
                            {user.memory?.title && !user.property?.name && (
                              <p className="text-xs text-gray-500 mb-1">
                                Campaign: {user.memory.title}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 truncate mb-2">{user.email}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${getRoleColor(displayRole)} flex items-center gap-1`}>
                                {getRoleIcon(displayRole)}
                                {displayRoleName}
                              </Badge>
                              <span className="text-[10px] text-gray-500">
                                {user.memory_count || 0} created • {user.shared_memory_count || 0} shared
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-[10px] text-gray-500">
                                Active: {getTimeAgo(user.last_active_at)}
                              </span>
                              <span className="text-[10px] text-gray-400">•</span>
                              <span className="text-[10px] text-gray-500">
                                Joined: {formatDate(user.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white border border-gray-200 shadow-lg rounded-md">
                            <DropdownMenuItem onClick={() => handleEditUser(user)} className="text-xs">
                              <Edit className="w-3.5 h-3.5 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeactivateUser(user)}
                              className="text-orange-600 text-xs"
                            >
                              <UserX className="w-3.5 h-3.5 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleRemoveUser(user)}
                              className="text-red-600 text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              Remove User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {filteredUsers.length === 0 && !isLoading && !error && (
            <div className="text-center py-12">
              <div className="text-gray-500 text-xs sm:text-sm">No users found matching your filters</div>
            </div>
          )}
        </div>
        )}

        {/* Shared Memories Table */}
        {activeTab === 'shared-with' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm md:text-base font-medium text-gray-900">Shared With Me</h3>
                <span className="text-[10px] sm:text-xs md:text-sm text-gray-500">{sharedMemories.length} campaigns</span>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added By</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added Date</th>
                    <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoadingShared ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6C60FF]"></div>
                          <span className="ml-2 text-gray-500">Loading shared campaigns...</span>
                        </div>
                      </td>
                    </tr>
                  ) : sharedError ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="text-red-600">{sharedError}</div>
                      </td>
                    </tr>
                  ) : sharedMemories.length > 0 ? (
                    sharedMemories.map((memory) => {
                      const displayRole = memory.role || 'viewer';
                      let displayRoleName = displayRole.toUpperCase();
                      if (displayRole.toLowerCase() === 'contributor') {
                        displayRoleName = 'CONTRIBUTOR';
                      } else if (displayRole.toLowerCase() === 'viewer') {
                        displayRoleName = 'VIEW';
                      }
                      const displayStatus = memory.status === 1 ? 'active' : 'pending';

                      return (
                        <tr key={memory.collaboration_id} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{memory.memory_title || ''}</div>
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                            <Badge className={`text-xs font-medium px-2 py-1 rounded border ${
                              displayRole.toLowerCase() === 'admin'
                                ? 'bg-red-100 text-red-800 border-red-200'
                                : displayRole.toLowerCase() === 'contributor'
                                ? 'bg-purple-100 text-purple-800 border-purple-200'
                                : 'bg-blue-100 text-blue-800 border-blue-200'
                            }`}>
                              {displayRoleName}
                            </Badge>
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                            <Badge className={`text-xs font-medium px-2 py-1 rounded ${
                              displayStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {displayStatus.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Avatar className="h-8 w-8">
                                {memory.added_by?.profile_image ? (
                                  <AvatarImage src={memory.added_by.profile_image} alt={memory.added_by.name} />
                                ) : null}
                                <AvatarFallback className="text-sm bg-purple-100 text-purple-600">
                                  {memory.added_by?.name?.charAt(0)?.toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">{memory.added_by?.name || 'Unknown'}</div>
                                <div className="text-sm text-gray-500">{memory.added_by?.email || ''}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {memory.added_at ? new Date(memory.added_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-center">
                            <button
                              onClick={() => {
                                setCollaborationToRemove({
                                  id: memory.collaboration_id,
                                  title: memory.memory_title
                                });
                                setShowRemoveModal(true);
                              }}
                              disabled={isRemovingCollaboration}
                              className="p-2 rounded-lg hover:bg-red-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Remove from campaign"
                            >
                              <UserX className="w-4 h-4 text-gray-400 group-hover:text-red-600 transition-colors" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="text-gray-500 text-sm">No shared campaigns found</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden">
              {isLoadingShared ? (
                <div className="p-6 text-center">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6C60FF]"></div>
                    <span className="ml-2 text-gray-500 text-sm">Loading...</span>
                  </div>
                </div>
              ) : sharedError ? (
                <div className="p-6 text-center">
                  <div className="text-red-600 text-sm">{sharedError}</div>
                </div>
              ) : sharedMemories.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {sharedMemories.map((memory) => {
                    const displayRole = memory.role || 'viewer';
                    let displayRoleName = displayRole.toUpperCase();
                    if (displayRole.toLowerCase() === 'contributor') {
                      displayRoleName = 'CONTRIBUTOR';
                    } else if (displayRole.toLowerCase() === 'viewer') {
                      displayRoleName = 'VIEW';
                    }
                    const displayStatus = memory.status === 1 ? 'active' : 'pending';

                    return (
                      <div key={memory.collaboration_id} className="p-3">
                        <div className="mb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-gray-900">{memory.memory_title || 'Untitled'}</h4>
                            <Badge className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              displayStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {displayStatus.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                              displayRole.toLowerCase() === 'admin'
                                ? 'bg-red-100 text-red-800 border-red-200'
                                : displayRole.toLowerCase() === 'contributor'
                                ? 'bg-purple-100 text-purple-800 border-purple-200'
                                : 'bg-blue-100 text-blue-800 border-blue-200'
                            }`}>
                              {displayRoleName}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Avatar className="h-6 w-6">
                            {memory.added_by?.profile_image ? (
                              <AvatarImage src={memory.added_by.profile_image} alt={memory.added_by.name} />
                            ) : null}
                            <AvatarFallback className="text-xs bg-purple-100 text-purple-600">
                              {memory.added_by?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-xs text-gray-600">
                            Added by {memory.added_by?.name || 'Unknown'} on {memory.added_at ? new Date(memory.added_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-500 text-xs sm:text-sm">No shared campaigns found</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Properties Table - only visible for users with role 2 or 4 */}
        {activeTab === 'properties' && (currentUser?.role === 2 || currentUser?.role === '2' || currentUser?.role === 4 || currentUser?.role === '4') && (
          <>
            {/* Search and Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4 mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 w-full">
                <div className="relative flex-1 sm:max-w-sm">
                  <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <Input
                    placeholder="Search properties..."
                    value={propertiesSearchQuery}
                    onChange={(e) => setPropertiesSearchQuery(e.target.value)}
                    className="pl-8 sm:pl-10 w-full bg-white border-gray-300 placeholder:text-gray-500 h-8 sm:h-9 text-xs sm:text-sm"
                  />
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
                  <Button variant="outline" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-3 border-gray-300 text-gray-700 hover:bg-gray-50">
                    <Filter className="w-3 h-3 sm:w-4 sm:h-4" />
                    Status
                  </Button>
                  <Button variant="outline" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-3 border-gray-300 text-gray-700 hover:bg-gray-50">
                    <Filter className="w-3 h-3 sm:w-4 sm:h-4" />
                    Labels
                  </Button>
                  <Button
                    onClick={() => setShowTransferMemoryDialog(true)}
                    className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-3 bg-white border-2 border-[#6C60FF] text-[#6C60FF] hover:bg-[#6C60FF] hover:text-white transition-all"
                  >
                    <ArrowRightLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Transfer Campaigns</span>
                    <span className="sm:hidden">Transfer</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {isLoadingProperties && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <p className="mt-4 text-gray-600">Loading properties...</p>
              </div>
            )}

            {/* Error State */}
            {propertiesError && !isLoadingProperties && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <p className="text-red-600">{propertiesError}</p>
                <Button
                  onClick={fetchProperties}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            )}

            {/* Properties Table */}
            {!isLoadingProperties && !propertiesError && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                        <th className="px-2 sm:px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Campaigns</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Labels</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {properties.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-3 sm:px-6 py-12 text-center">
                            <p className="text-gray-600 mb-4">No properties found</p>
                            <Button
                              onClick={() => setShowCreatePropertyModal(true)}
                              className="bg-[#6C60FF] hover:bg-[#5A4FE5] text-white"
                            >
                              Create Your First Property
                            </Button>
                          </td>
                        </tr>
                      ) : (
                        properties.map((property) => (
                      <tr key={property.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                              {property.image ? (
                                <img src={property.image} alt={property.name} className="h-full w-full object-cover" />
                              ) : (
                                <Shield className="h-5 w-5 text-purple-600" />
                              )}
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">{property.name}</div>
                              <div className="text-sm text-gray-500">{property.code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                            <span title={property.location}>
                              {property.location?.length > 12 ? property.location.substring(0, 12) + '...' : property.location}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 sm:px-3 py-4 whitespace-nowrap w-20">
                          <div className="flex items-center text-sm text-purple-600 font-medium">
                            {property.memories}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {property.users && property.users.length > 0 ? (
                              <>
                                {property.users.map((user, idx) => (
                                  <Avatar key={idx} className="h-6 w-6 -ml-1 first:ml-0 border-2 border-white">
                                    {user.image && <AvatarImage src={user.image} alt={user.name} />}
                                    <AvatarFallback className="text-xs bg-purple-100 text-purple-600 font-semibold">
                                      {user.name || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                                {property.additionalUsers > 0 && (
                                  <span className="ml-2 text-xs text-gray-500">+{property.additionalUsers}</span>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-gray-400">No users</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1 flex-wrap">
                            {property.labels.length > 0 ? (
                              property.labels.map((label: any, idx: number) => (
                                <Badge
                                  key={idx}
                                  className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 border-0"
                                >
                                  {label.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-gray-400">No labels</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          {property.propertyType ? (
                            <Badge
                              className={`text-xs px-2.5 py-1 font-medium border-0 capitalize ${
                                String(property.propertyType).toLowerCase() === 'internal'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {property.propertyType}
                            </Badge>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          {property.status && property.url ? (
                            <div className="flex items-center gap-1.5">
                              <Link className="w-3.5 h-3.5 text-green-600" />
                              <a
                                href={property.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-green-600 hover:text-green-700"
                              >
                                /signup
                              </a>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(property.url);
                                  toast.success('Link copied to clipboard');
                                }}
                                className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                                title="Copy link"
                              >
                                <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No URL</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <Badge
                            className={`text-xs px-2.5 py-1 font-medium border-0 ${
                              String(property.status).toLowerCase() === 'active'
                                ? 'bg-green-100 text-green-800'
                                : String(property.status).toLowerCase() === 'inactive'
                                ? 'bg-red-100 text-red-800'
                                : String(property.status).toLowerCase() === 'pending_payment'
                                ? 'bg-orange-100 text-orange-800'
                                : String(property.status) === '1'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {String(property.status).toLowerCase() === 'pending_payment'
                              ? 'Pending Payment'
                              : String(property.status) === '1'
                              ? 'Internal'
                              : property.status}
                          </Badge>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {property.created}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white border border-gray-200 shadow-lg rounded-md p-1 min-w-[180px]">
                              {property.status === 'pending_payment' && (
                                <DropdownMenuItem
                                  onClick={() => handleCompletePayment(property)}
                                  className="cursor-pointer hover:bg-green-50 text-green-700 rounded px-3 py-2 flex items-center"
                                >
                                  <CreditCard className="mr-2 h-4 w-4" />
                                  Complete Payment
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => {
                                  setPropertyToEdit(property);
                                  setShowCreatePropertyModal(true);
                                }}
                                className="cursor-pointer hover:bg-gray-100 rounded px-3 py-2 flex items-center"
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Property
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  console.log('Manage Users for property:', property.id);
                                  // Reset filters when managing users for a property
                                  setSelectedRole('All Roles');
                                  setSelectedStatus('All Status');
                                  setSearchQuery('');
                                  setSelectedPropertyId(property.id);
                                  setActiveTab('users');
                                }}
                                className="cursor-pointer hover:bg-gray-100 rounded px-3 py-2 flex items-center"
                              >
                                <UserCog className="mr-2 h-4 w-4" />
                                Manage Users
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onViewStoreelReport?.(property.id, property.name)}
                                className="cursor-pointer hover:bg-gray-100 rounded px-3 py-2 flex items-center"
                              >
                                <TrendingUp className="mr-2 h-4 w-4" />
                                Storeel Report
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleViewProperty(property)}
                                className="cursor-pointer hover:bg-gray-100 rounded px-3 py-2 flex items-center"
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Property
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleUpdatePropertyStatus(property)}
                                className="cursor-pointer hover:bg-red-50 text-red-600 rounded px-3 py-2 flex items-center"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                {property.status ? 'Deactivate' : 'Activate'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setPropertyToDelete(property);
                                  setShowDeletePropertyModal(true);
                                }}
                                className="cursor-pointer hover:bg-red-50 text-red-600 rounded px-3 py-2 flex items-center"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Property
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden">
                  {properties.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-gray-600 mb-4">No properties found</p>
                      <Button
                        onClick={() => setShowCreatePropertyModal(true)}
                        className="bg-[#6C60FF] hover:bg-[#5A4FE5] text-white"
                      >
                        Create Your First Property
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {properties.map((property) => (
                  <div key={property.id} className="p-3 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <div className="h-12 w-12 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                          {property.image ? (
                            <img src={property.image} alt={property.name} className="h-full w-full object-cover" />
                          ) : (
                            <Shield className="h-6 w-6 text-purple-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-gray-900">{property.name}</h4>
                            <span className="text-xs text-gray-500">{property.code}</span>
                            <Badge
                              className={`text-[10px] px-1.5 py-0.5 font-medium border-0 ${
                                property.status
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {property.status ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <div className="flex items-center text-xs text-gray-600 mb-2">
                            <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                            <span className="truncate">{property.location}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <div className="flex items-center text-xs text-purple-600 font-medium">
                              {property.memories}
                            </div>
                            <div className="flex items-center">
                              {property.users && property.users.length > 0 ? (
                                <>
                                  {property.users.map((user, idx) => (
                                    <Avatar key={idx} className="h-5 w-5 -ml-1 first:ml-0 border border-white">
                                      {user.image && <AvatarImage src={user.image} alt={user.name} />}
                                      <AvatarFallback className="text-[10px] bg-purple-100 text-purple-600 font-semibold">
                                        {user.name || 'U'}
                                      </AvatarFallback>
                                    </Avatar>
                                  ))}
                                  {property.additionalUsers > 0 && (
                                    <span className="ml-1 text-xs text-gray-500">+{property.additionalUsers}</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs text-gray-400">No users</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap mb-1">
                            {property.labels.length > 0 ? (
                              property.labels.map((label: any, idx: number) => (
                                <Badge
                                  key={idx}
                                  className="text-[10px] px-1.5 py-0.5 bg-yellow-100 text-yellow-800 border-0"
                                >
                                  {label.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">No labels</span>
                            )}
                            {property.propertyType && (
                              <Badge
                                className={`text-[10px] px-1.5 py-0.5 font-medium border-0 capitalize ${
                                  String(property.propertyType).toLowerCase() === 'internal'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {property.propertyType}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-2">
                            {property.status && property.url ? (
                              <>
                                <Link className="w-3 h-3 text-green-600" />
                                <a
                                  href={property.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-green-600 hover:text-green-700"
                                >
                                  /signup
                                </a>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(property.url);
                                    toast.success('Link copied to clipboard');
                                  }}
                                  className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                                  title="Copy link"
                                >
                                  <Copy className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">{property.status ? 'No URL' : '-'}</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Created: {property.created}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white border border-gray-200 shadow-lg rounded-md p-1 min-w-[180px]">
                          <DropdownMenuItem
                            onClick={() => {
                              setPropertyToEdit(property);
                              setShowCreatePropertyModal(true);
                            }}
                            className="cursor-pointer hover:bg-gray-100 rounded px-3 py-2 flex items-center"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Property
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              console.log('Manage Users for property:', property.id);
                              // Reset filters when managing users for a property
                              setSelectedRole('All Roles');
                              setSelectedStatus('All Status');
                              setSearchQuery('');
                              setSelectedPropertyId(property.id);
                              setActiveTab('users');
                            }}
                            className="cursor-pointer hover:bg-gray-100 rounded px-3 py-2 flex items-center"
                          >
                            <UserCog className="mr-2 h-4 w-4" />
                            Manage Users
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onViewStoreelReport?.(property.id, property.name)}
                            className="cursor-pointer hover:bg-gray-100 rounded px-3 py-2 flex items-center"
                          >
                            <TrendingUp className="mr-2 h-4 w-4" />
                            Storeel Report
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleViewProperty(property)}
                            className="cursor-pointer hover:bg-gray-100 rounded px-3 py-2 flex items-center"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Property
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleUpdatePropertyStatus(property)}
                            className="cursor-pointer hover:bg-red-50 text-red-600 rounded px-3 py-2 flex items-center"
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            {property.status ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setPropertyToDelete(property);
                              setShowDeletePropertyModal(true);
                            }}
                            className="cursor-pointer hover:bg-red-50 text-red-600 rounded px-3 py-2 flex items-center"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Property
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Leads Tab */}
        {activeTab === 'leads' && (
          <LeadsTab
            selectedLead={selectedLead}
            onLeadSelect={(lead) => { setSelectedLead(lead); if (lead) { setSelectedGroupId(null); setSelectedConversation(null); } }}
            selectedGroupId={selectedGroupId}
            onGroupSelect={(id) => { setSelectedGroupId(id); if (id) { setSelectedLead(null); setSelectedConversation(null); } }}
            selectedConversationId={selectedConversation?.lead_id ?? null}
            onConversationSelect={(conv) => { setSelectedConversation(conv); if (conv) { setSelectedLead(null); setSelectedGroupId(null); } }}
            refreshTrigger={leadsRefreshTrigger}
            compact={isPanelOpen}
            unreadBreakdown={leadsUnreadBreakdown}
            onLeadsRefreshed={(leads) => {
              if (selectedLead) {
                const updated = leads.find((l) => l.id === selectedLead.id);
                if (updated) setSelectedLead(updated);
              }
            }}
            onFilterChange={setLeadsStatusFilter}
            onCommentaryJump={(lead, target) => {
              setSelectedLead(lead);
              setCommentaryTarget(target);
            }}
          />
        )}
      </div>{/* closes w-full sm:px-3 */}
      </div>{/* closes py-2 padding */}
      </div>{/* closes LEFT panel */}

      {/* RIGHT: lead profile panel */}
      {isPanelOpen && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col sm:static sm:inset-auto sm:z-auto sm:w-[30%] sm:border-l sm:border-gray-200 sm:sticky sm:top-0 sm:h-screen sm:overflow-hidden">
          {selectedLead ? (
            <LeadDetailDrawer
              lead={selectedLead}
              open={true}
              highlightTarget={commentaryTarget}
              onTargetHandled={() => setCommentaryTarget(null)}
              onNavigate={onNavigate}
              onClose={() => {
                setSelectedLead(null);
                setCommentaryTarget(null);
                setLeadsRefreshTrigger((t) => t + 1);
                window.dispatchEvent(new CustomEvent('leads-unread-count-refresh'));
              }}
              onRefreshLead={async () => {
                setLeadsRefreshTrigger((t) => t + 1);
              }}
              isArchived={leadsStatusFilter === 'archived'}
            />
          ) : selectedGroupId ? (
            <GroupDetailDrawer
              groupId={selectedGroupId}
              open={true}
              onClose={() => setSelectedGroupId(null)}
            />
          ) : (
            <ConversationDrawer
              conversation={selectedConversation}
              open={true}
              onClose={() => setSelectedConversation(null)}
            />
          )}
        </div>
      )}

      {/* Modals — inside flex root so JSX has single root */}
      {/* Invite to Memory Modal */}
      <InviteToMemoryModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInviteSuccess={fetchUsers}
      />

      {/* Edit Collaborator Modal */}
      <EditCollaboratorModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedCollaborator(null);
        }}
        collaborator={selectedCollaborator}
        onSave={handleSaveCollaborator}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Remove User
            </h3>
            <p className="text-sm text-gray-600 text-center mb-6">
              Are you sure you want to permanently remove <span className="font-semibold">{userToDelete.name || userToDelete.email || 'this user'}</span> from collaborations? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmRemoveUser}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Remove User
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Collaboration Modal */}
      <RemoveCollaborationModal
        isOpen={showRemoveModal}
        onClose={() => {
          if (!isRemovingCollaboration) {
            setShowRemoveModal(false);
            setCollaborationToRemove(null);
          }
        }}
        onConfirm={handleRemoveCollaboration}
        memoryTitle={collaborationToRemove?.title || ''}
        isRemoving={isRemovingCollaboration}
      />

      {/* Create Property Modal */}
      <CreatePropertyModal
        isOpen={showCreatePropertyModal}
        onClose={() => {
          setShowCreatePropertyModal(false);
          setPropertyToEdit(null);
          fetchProperties();
        }}
        onCreateProperty={propertyToEdit ? handleUpdateProperty : handleCreateProperty}
        onCheckout={!propertyToEdit ? handleCheckout : undefined}
        propertyToEdit={propertyToEdit}
        isInternalUser={!!currentUser?.is_internal}
      />

      {/* Delete Property Confirmation Modal */}
      {showDeletePropertyModal && propertyToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Property</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to delete <span className="font-semibold">{propertyToDelete.name}</span>?
                  This action cannot be undone and will remove all associated data.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeletePropertyModal(false);
                      setPropertyToDelete(null);
                    }}
                    disabled={isDeletingProperty}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDeleteProperty}
                    disabled={isDeletingProperty}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isDeletingProperty ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Publish Landing Pages Modal */}
      <PublishLandingPagesModal
        isOpen={showPublishLandingPagesModal}
        onClose={() => setShowPublishLandingPagesModal(false)}
        properties={properties.filter(p => String(p.status).toLowerCase() === 'inactive').map(p => ({
          id: p.id,
          name: p.name,
          location: p.location,
          image: p.image
        }))}
        onPublish={handlePublishLandingPages}
        onSuccess={fetchProperties}
        buttonRef={getUrlButtonRef}
      />

      {/* Transfer Memory Dialog */}
      <TransferMemoryDialog
        isOpen={showTransferMemoryDialog}
        onClose={() => setShowTransferMemoryDialog(false)}
        memories={memoriesForTransfer}
        properties={properties}
        currentUserAvatar={currentUser?.avatar}
        currentUserProfileColor={currentUser?.profile_color}
        onTransferSuccess={() => {
          fetchProperties();
          fetchMemoriesForTransfer();
        }}
      />

      {/* Property Payment — same StripePaymentForm as billing page */}
      {propertyPaymentState && (
        <Elements stripe={stripePromise} options={{ clientSecret: propertyPaymentState.clientSecret }}>
          <StripePaymentForm
            isOpen={true}
            onClose={() => setPropertyPaymentState(null)}
            onBack={() => setPropertyPaymentState(null)}
            planName={`${propertyPaymentState.cart.length} Propert${propertyPaymentState.cart.length === 1 ? 'y' : 'ies'}`}
            planPrice={(propertyPaymentState.cart.length * 2).toFixed(2)}
            isYearly={false}
            clientSecret={propertyPaymentState.clientSecret}
            onPaymentSuccess={handlePropertyPaymentSuccess}
            mode="payment"
          />
        </Elements>
      )}

      {/* Complete Payment — for existing pending_payment property */}
      {singlePropertyPaymentState && (
        <Elements stripe={stripePromise} options={{ clientSecret: singlePropertyPaymentState.clientSecret }}>
          <StripePaymentForm
            isOpen={true}
            onClose={() => setSinglePropertyPaymentState(null)}
            onBack={() => setSinglePropertyPaymentState(null)}
            planName={singlePropertyPaymentState.propertyName}
            planPrice="2.00"
            isYearly={false}
            clientSecret={singlePropertyPaymentState.clientSecret}
            onPaymentSuccess={handleSinglePropertyPaymentSuccess}
            mode="payment"
          />
        </Elements>
      )}

    </div>
  );
}
