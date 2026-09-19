import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import CountrySelect from './CountrySelect';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Plus,
  Users,
  Eye,
  Edit,
  Shield,
  Folder
} from 'lucide-react';
import { dashboardAPI } from '../utils/authUtils';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useMemoryLimit } from '../hooks/useMemoryLimit';

interface Memory {
  id: string;
  title: string;
  category: string;
  thumbnail?: string;
  image_count?: number;
}

interface User {
  id: string;
  name: string | null | undefined;
  email: string;
  phone_number?: string;
  profile_image?: string;
  role?: string;
}

interface InviteToMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSuccess?: () => void;
}

const generateInitials = (name: string | null | undefined): string => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const MemoryThumbnail = ({ thumbnail, title, profileImage, name, size }: {
  thumbnail?: string | null;
  title: string;
  profileImage?: string | null;
  name?: string | null;
  size: 'sm' | 'md';
}) => {
  const [src, setSrc] = React.useState<string | null>(thumbnail || profileImage || null);
  const [triedProfile, setTriedProfile] = React.useState(!thumbnail);
  const sizeClass = size === 'md' ? 'w-10 h-10 rounded-lg' : 'w-9 h-9 rounded-md';

  React.useEffect(() => {
    if (thumbnail) {
      setSrc(thumbnail);
      setTriedProfile(false);
    } else if (profileImage) {
      setSrc(profileImage);
      setTriedProfile(true);
    } else {
      setSrc(null);
    }
  }, [thumbnail, profileImage]);

  const handleError = () => {
    if (!triedProfile && profileImage) {
      setSrc(profileImage);
      setTriedProfile(true);
    } else {
      setSrc(null);
    }
  };

  return (
    <div className={`${sizeClass} overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center border border-gray-200`}>
      {src ? (
        <img src={src} alt={title} className="w-full h-full object-cover" onError={handleError} />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
          <span className={`text-white font-semibold ${size === 'md' ? 'text-xs' : 'text-[10px]'}`}>{generateInitials(name)}</span>
        </div>
      )}
    </div>
  );
};

const getRoleIcon = (role: string) => {
  switch (role.toLowerCase()) {
    case 'admin':
      return <Shield className="w-3 h-3" />;
    case 'edit':
    case 'contributor':
      return <Edit className="w-3 h-3" />;
    case 'view':
    case 'viewer':
      return <Eye className="w-3 h-3" />;
    default:
      return <Users className="w-3 h-3" />;
  }
};

const getRoleColor = (role: string) => {
  switch (role.toLowerCase()) {
    case 'admin':
      return 'bg-red-100 text-red-800';
    case 'edit':
    case 'contributor':
      return 'bg-blue-100 text-blue-800';
    case 'view':
    case 'viewer':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-purple-100 text-purple-800';
  }
};

export default function InviteToMemoryModal({ isOpen, onClose, onInviteSuccess }: InviteToMemoryModalProps) {
  const { user } = useAuth();
  const { adminLimitData, isAdminLimitExceeded } = useMemoryLimit();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemories, setSelectedMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  const [selectedCollaborators, setSelectedCollaborators] = useState<User[]>([]);
  const [recentCollaborators, setRecentCollaborators] = useState<User[]>([]);
  const [selectedRole, setSelectedRole] = useState('Contributor');
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [personalMessage, setPersonalMessage] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'email' | 'phone'>('email');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [userSuggestions, setUserSuggestions] = useState<User[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPartialMemories, setSelectedPartialMemories] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [availableCategories, setAvailableCategories] = useState<{ name: string; color: string }[]>([]);

  // Auto-switch from Admin/Partial Admin role if limit is exceeded
  useEffect(() => {
    if (isAdminLimitExceeded && (selectedRole === 'Admin' || selectedRole === 'Partial Admin')) {
      setSelectedRole('Contributor');
      toast.warning('Admin limit reached. Role changed to Contributor.');
    }
  }, [isAdminLimitExceeded, selectedRole]);

  // Fetch memories when modal opens (get all memories by default)
  useEffect(() => {
    if (isOpen) {
      fetchMemories(); // This will fetch all memories by default
      fetchRecentCollaborators();
      // Fetch categories
      dashboardAPI.getUserCategories().then((res: any) => {
        const responseData = res?.data?.data || res?.data;
        const cats: any[] = responseData?.categories || responseData || [];
        const items = (Array.isArray(cats) ? cats : [])
          .filter((c: any) => {
            const name = c.name || c;
            return name && name !== 'Shared With' && name !== 'Published';
          })
          .map((c: any) => ({ name: c.name || c, color: c.color || '#6C60FF' }));
        setAvailableCategories(items);
      }).catch(() => {});
    } else {
      setSelectedPartialMemories(new Set());
      setExpandedCategories(new Set());
    }
  }, [isOpen]);

  // Search memories when search query changes
  useEffect(() => {
    if (isOpen) {
      const timeoutId = setTimeout(() => {
        searchMemories(searchQuery);
      }, 300); // Debounce search by 300ms

      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, isOpen]);

  // Search users when email input changes
  useEffect(() => {
    const searchUserSuggestions = async () => {
      if (!emailInput.trim() || emailInput.trim().length < 2) {
        setUserSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoadingSuggestions(true);
      try {
        const response = await dashboardAPI.searchUsers(emailInput.trim(), 'email');
        console.log('🔍 Full User suggestions response:', JSON.stringify(response, null, 2));

        // Extract users from response - handle multiple possible structures
        let users = [];

        if (response && typeof response === 'object') {
          // Check if response itself is the array
          if (Array.isArray(response)) {
            users = response;
          }
          // Check response.data paths
          else if (response.data) {
            if (Array.isArray(response.data)) {
              users = response.data;
            } else if (response.data.data) {
              if (Array.isArray(response.data.data)) {
                users = response.data.data;
              } else if (response.data.data.users && Array.isArray(response.data.data.users)) {
                users = response.data.data.users;
              }
            } else if (response.data.users && Array.isArray(response.data.users)) {
              users = response.data.users;
            }
          }
          // Check direct users property
          else if (response.users && Array.isArray(response.users)) {
            users = response.users;
          }
        }

        console.log('🔍 Extracted users:', users);
        console.log('🔍 Number of users:', users.length);

        if (users.length > 0) {
          setUserSuggestions(users);
          setShowSuggestions(true);
        } else {
          setUserSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error('Error fetching user suggestions:', error);
        setUserSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    const timeoutId = setTimeout(() => {
      searchUserSuggestions();
    }, 300); // Debounce by 300ms

    return () => clearTimeout(timeoutId);
  }, [emailInput]);

  // Search users when phone input changes
  useEffect(() => {
    const searchUserSuggestions = async () => {
      if (!phoneInput.trim() || phoneInput.trim().length < 2) {
        setUserSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoadingSuggestions(true);
      try {
        const response = await dashboardAPI.searchUsers(phoneInput.trim(), 'phone');
        console.log('🔍 Phone search response:', JSON.stringify(response, null, 2));

        // Extract users from response - handle multiple possible structures
        let users = [];

        if (response && typeof response === 'object') {
          // Check if response itself is the array
          if (Array.isArray(response)) {
            users = response;
          }
          // Check response.data paths
          else if (response.data) {
            if (Array.isArray(response.data)) {
              users = response.data;
            } else if (response.data.data) {
              if (Array.isArray(response.data.data)) {
                users = response.data.data;
              } else if (response.data.data.users && Array.isArray(response.data.data.users)) {
                users = response.data.data.users;
              }
            } else if (response.data.users && Array.isArray(response.data.users)) {
              users = response.data.users;
            }
          }
          // Check direct users property
          else if (response.users && Array.isArray(response.users)) {
            users = response.users;
          }
        }

        console.log('🔍 Extracted users from phone search:', users);
        console.log('🔍 Number of users:', users.length);

        if (users.length > 0) {
          setUserSuggestions(users);
          setShowSuggestions(true);
        } else {
          setUserSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error('Error fetching phone user suggestions:', error);
        setUserSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    const timeoutId = setTimeout(() => {
      searchUserSuggestions();
    }, 300); // Debounce by 300ms

    return () => clearTimeout(timeoutId);
  }, [phoneInput]);

  const transformMemoriesData = (memoriesData: any[]): Memory[] =>
    memoriesData.map((memory: any) => ({
      id: memory.id?.toString() || memory.memory_id?.toString(),
      title: memory.title || memory.name || 'Untitled Campaign',
      category: memory.category?.name || memory.category || 'Uncategorized',
      thumbnail: memory.last_update_img || memory.photos?.preview_images?.[0]?.url || memory.posts?.[0]?.image_link || memory.image_link?.replace(/\\\//g, '/') || memory.cover_image || memory.thumbnail || null,
      image_count: memory.images_count || memory.image_count || memory.photos?.count || memory.images?.length || 0
    }));

  // Fetch all memories using getExistingMemories (returns thumbnails via posts[0].image_link)
  const fetchMemories = useCallback(async () => {
    setIsSearching(true);
    try {
      const response = await dashboardAPI.getExistingMemories();
      if (response.success && response.data) {
        const raw = response.data.memories || response.data.data?.memories || response.data.data || response.data;
        const memoriesData: any[] = Array.isArray(raw) ? raw : [];
        setMemories(transformMemoriesData(memoriesData));
      }
    } catch (error) {
      console.error('Error fetching memories:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Search memories using the search API (for typed queries)
  const searchMemories = useCallback(async (query?: string) => {
    if (!query) {
      await fetchMemories();
      return;
    }
    setIsSearching(true);
    try {
      const response = await dashboardAPI.searchMemories(query);
      if (response.success && response.data) {
        let memoriesData: any[] = [];
        if (response.data.memories && Array.isArray(response.data.memories)) {
          memoriesData = response.data.memories;
        } else if (response.data.data?.memories && Array.isArray(response.data.data.memories)) {
          memoriesData = response.data.data.memories;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          memoriesData = response.data.data;
        } else if (Array.isArray(response.data)) {
          memoriesData = response.data;
        }
        setMemories(transformMemoriesData(memoriesData));
      }
    } catch (error) {
      console.error('Error searching memories:', error);
    } finally {
      setIsSearching(false);
    }
  }, [fetchMemories]);

  const fetchRecentCollaborators = async () => {
    try {
      const response = await dashboardAPI.getUsersCollaboratorsAndNonCollaborators();
      if (response.success && response.data) {
        const collaborators = response.data.data?.collaborators || response.data.collaborators || [];
        setRecentCollaborators(collaborators.slice(0, 4)); // Show top 4 recent collaborators
      } else {
        setRecentCollaborators([]);
      }
    } catch (error) {
      console.error('Error fetching collaborators:', error);
      setRecentCollaborators([]);
    }
  };

  // No need for client-side filtering since we're filtering on the server-side
  const filteredMemories = memories;

  const [isCheckingAdminEmail, setIsCheckingAdminEmail] = useState(false);

  const handleAddEmail = async () => {
    if (emailInput.trim()) {
      // Check if email is already added
      const existingCollaborator = selectedCollaborators.find(c => c.email.toLowerCase() === emailInput.trim().toLowerCase());
      if (existingCollaborator) {
        toast.error('This email is already added');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailInput.trim())) {
        toast.error('Please enter a valid email address');
        return;
      }

      // Check if email is already an admin (for all roles)
      setIsCheckingAdminEmail(true);
      try {
        const response = await dashboardAPI.checkAdminEmail(emailInput.trim());
        console.log('checkAdminEmail response:', response);

        // Check if the response indicates email is already an admin
        const data = response.data?.data || response.data;
        if (data?.is_admin === true) {
          toast.error(data?.message || 'This email is already an admin. Please add another email.');
          setIsCheckingAdminEmail(false);
          return;
        }
      } catch (error) {
        console.error('Error checking admin email:', error);
        // If API fails, allow adding (will be caught during invite)
      } finally {
        setIsCheckingAdminEmail(false);
      }

      const newUser: User = {
        id: `email-${Date.now()}`,
        name: emailInput ? emailInput.split('@')[0] : 'User',
        email: emailInput ? emailInput.trim() : ''
      };
      setSelectedCollaborators([...selectedCollaborators, newUser]);
      setEmailInput('');
      toast.success(`${emailInput.trim()} added as user`);
    }
  };

  const handleAddPhone = async () => {
    if (phoneInput.trim()) {
      // Validate phone format (basic validation - at least 7 digits)
      const digitsOnly = phoneInput.trim().replace(/[^0-9]/g, '');
      if (digitsOnly.length < 7) {
        toast.error('Please enter a valid phone number');
        return;
      }

      // Full number = selected country/area code + the entered national digits.
      const fullPhone = `${phoneCountryCode}${digitsOnly}`;

      // Check if phone is already added
      const existingCollaborator = selectedCollaborators.find(c => c.phone_number === fullPhone);
      if (existingCollaborator) {
        toast.error('This phone number is already added');
        return;
      }

      const newUser: User = {
        id: `phone-${Date.now()}`,
        name: fullPhone,
        email: '',
        phone_number: fullPhone
      };
      setSelectedCollaborators([...selectedCollaborators, newUser]);
      setPhoneInput('');
      toast.success(`${fullPhone} added as user`);
    }
  };

  const handleAddCollaborator = async (user: User) => {
    // Check by email or phone to avoid duplicates
    const existingCollaborator = selectedCollaborators.find(c => {
      if (activeTab === 'email' && user.email) {
        return c.email.toLowerCase() === user.email.toLowerCase();
      } else if (activeTab === 'phone' && user.phone_number) {
        return c.phone_number === user.phone_number;
      }
      return false;
    });

    if (existingCollaborator) {
      toast.error(`${activeTab === 'email' ? user.email : user.phone_number} is already added`);
      return;
    }

    // Check if email is already an admin (only for email tab)
    if (activeTab === 'email' && user.email) {
      setIsCheckingAdminEmail(true);
      try {
        const response = await dashboardAPI.checkAdminEmail(user.email);
        console.log('checkAdminEmail response for recent collaborator:', response);

        // Check if the response indicates email is already an admin
        const data = response.data?.data || response.data;
        if (data?.is_admin === true) {
          toast.error(data?.message || 'This email is already an admin. Please add another email.');
          setIsCheckingAdminEmail(false);
          return;
        }
      } catch (error) {
        console.error('Error checking admin email:', error);
        // If API fails, allow adding (will be caught during invite)
      } finally {
        setIsCheckingAdminEmail(false);
      }
    }

    setSelectedCollaborators([...selectedCollaborators, user]);
    toast.success(`${user.name || (activeTab === 'email' ? user.email : user.phone_number)} added as user`);
  };

  const handleSelectSuggestion = async (user: User) => {
    if (activeTab === 'email') {
      setEmailInput(user.email);
    } else {
      setPhoneInput(user.phone_number || '');
    }
    setShowSuggestions(false);
    await handleAddCollaborator(user);
    // Clear input after adding
    if (activeTab === 'email') {
      setEmailInput('');
    } else {
      setPhoneInput('');
    }
  };

  const handleRemoveCollaborator = (userId: string) => {
    setSelectedCollaborators(selectedCollaborators.filter(c => c.id !== userId));
  };

  const handleSendInvite = async () => {
    if (selectedRole === 'Partial Admin' && selectedPartialMemories.size === 0) {
      toast.error('Please select at least one campaign');
      return;
    }
    if (selectedRole !== 'Admin' && selectedRole !== 'Partial Admin' && selectedMemories.length === 0) {
      toast.error('Please select at least one campaign');
      return;
    }

    if (selectedCollaborators.length === 0) {
      toast.error('Please add at least one user');
      return;
    }

    setIsLoading(true);
    try {
      // Map role names to API values
      const roleMap: { [key: string]: 'view' | 'edit' | 'admin' } = {
        'Viewer': 'view',
        'Contributor': 'edit',
        'Admin': 'admin'
      };

      // Create collaborators array with email and role for each collaborator
      const collaborators = selectedCollaborators.map(collaborator => ({
        email: collaborator.email,
        role: roleMap[selectedRole] || 'view'
      }));

      // For Admin, call the addAccountAdmin API (email or phone)
      if (selectedRole === 'Admin') {
        let successCount = 0;
        let totalCount = selectedCollaborators.length;

        // Separate email and phone collaborators
        const emailCollaborators = selectedCollaborators.filter(c => c.email && c.email.trim());
        const phoneCollaborators = selectedCollaborators.filter(c => c.phone_number && c.phone_number.trim());

        // Send email admin invitations
        if (emailCollaborators.length > 0) {
          const adminEmailCollaborators = emailCollaborators.map(collaborator => ({
            email: collaborator.email
          }));

          console.log('🚀 Sending Admin invitation via addAccountAdmin API (Email)');
          console.log('🚀 Email Collaborators:', adminEmailCollaborators);

          const response = await dashboardAPI.addAccountAdmin({
            collaborators: adminEmailCollaborators
          });

          if (response.success) {
            successCount += emailCollaborators.length;
          } else {
            toast.error(response.error || 'Failed to send email invitations');
          }
        }

        // Send phone admin invitations
        if (phoneCollaborators.length > 0) {
          const adminPhoneCollaborators = phoneCollaborators.map(collaborator => ({
            phone_number: collaborator.phone_number!
          }));

          console.log('🚀 Sending Admin invitation via addAccountAdminByPhone API (Phone)');
          console.log('🚀 Phone Collaborators:', adminPhoneCollaborators);

          const response = await dashboardAPI.addAccountAdminByPhone({
            collaborators: adminPhoneCollaborators
          });

          if (response.success) {
            successCount += phoneCollaborators.length;
          } else {
            toast.error(response.error || 'Failed to send phone invitations');
          }
        }

        // Show success message if any invitations were sent successfully
        if (successCount > 0) {
          toast.success(
            `Successfully invited ${successCount} collaborator${successCount > 1 ? 's' : ''} as Admin!`
          );
          if (onInviteSuccess) {
            onInviteSuccess();
          }
          handleClose();
        } else if (successCount === 0 && totalCount > 0) {
          toast.error('Failed to send admin invitations');
        }
      } else if (selectedRole === 'Partial Admin') {
        const emails = selectedCollaborators.map(c => c.email).filter(Boolean) as string[];
        const phoneNumbers = selectedCollaborators.map(c => c.phone_number).filter(Boolean) as string[];
        const memoryIds = Array.from(selectedPartialMemories);
        const response = await dashboardAPI.addPartialAdmin(emails, memoryIds, phoneNumbers);
        if (response.success) {
          const totalInvited = emails.length + phoneNumbers.length;
          toast.success(
            `Successfully invited ${totalInvited} collaborator${totalInvited > 1 ? 's' : ''} with partial admin access to ${memoryIds.length} campaign${memoryIds.length > 1 ? 's' : ''}!`
          );
          if (onInviteSuccess) onInviteSuccess();
          handleClose();
        } else {
          toast.error(response.error || 'Failed to send partial admin invitations');
        }
      } else {
        // For Viewer/Contributor, send invites to each selected memory
        let successCount = 0;
        let failCount = 0;

        for (const memory of selectedMemories) {
          console.log('🚀 Sending invitation to memory:', memory.id);
          console.log('🚀 Collaborators:', collaborators);

          const response = await dashboardAPI.addCollaboratorsToMemory(memory.id, {
            collaborators,
            message: personalMessage.trim() || undefined
          });

          if (response.success) {
            successCount++;
          } else {
            failCount++;
          }
        }

        if (successCount > 0) {
          const memoryCount = selectedMemories.length;
          const collabCount = collaborators.length;
          toast.success(
            `Successfully invited ${collabCount} collaborator${collabCount > 1 ? 's' : ''} to ${memoryCount} campaign${memoryCount > 1 ? 's' : ''} with ${selectedRole.toLowerCase()} access!`
          );
          if (onInviteSuccess) {
            onInviteSuccess();
          }
          handleClose();
        }

        if (failCount > 0) {
          toast.error(`Failed to send invitations to ${failCount} campaign${failCount > 1 ? 's' : ''}`);
        }
      }
    } catch (error) {
      console.error('Error sending invitations:', error);
      toast.error('Failed to send invitations');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset search when modal closes
  const handleClose = () => {
    setSearchQuery('');
    setSelectedMemories([]);
    setSelectedCollaborators([]);
    setEmailInput('');
    setPhoneInput('');
    setPersonalMessage('');
    setSelectedRole('Contributor');
    setActiveTab('email');
    setFocusedInput(null);
    onClose();
  };

  // Toggle memory selection (for multiple selection)
  const handleToggleMemory = (memory: Memory) => {
    setSelectedMemories(prev => {
      const isSelected = prev.some(m => m.id === memory.id);
      if (isSelected) {
        return prev.filter(m => m.id !== memory.id);
      } else {
        return [...prev, memory];
      }
    });
  };

  // Only real recent collaborators (has a name, email, or phone) — filters out the
  // empty placeholder entries so the "Recent users" section is hidden when there are none.
  const validRecentUsers = recentCollaborators.filter(
    (u) => (u.name && u.name.trim()) || u.email || u.phone_number
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="flex flex-col gap-0 w-screen h-[100dvh] max-w-none max-h-[100dvh] top-0 left-0 translate-x-0 translate-y-0 rounded-none sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-full sm:max-w-lg sm:h-auto sm:max-h-[90vh] sm:rounded-xl bg-white shadow-xl border-0 p-0 overflow-hidden focus:outline-none [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Invite to Campaign
                </DialogTitle>
                <p className="text-gray-500 text-sm">
                  Share a campaign with others
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="px-6 space-y-4 overflow-y-auto flex-1 min-h-0 sm:flex-none sm:max-h-[calc(90vh-140px)]">
          {/* Admin Limit Warning */}
          {isAdminLimitExceeded && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm text-yellow-800">
                <span className="font-semibold">Admin Limit Reached</span> — To add admin{' '}
                <button
                  onClick={() => { sessionStorage.setItem('billing_open_upgrade', 'true'); window.dispatchEvent(new CustomEvent('app-navigate', { detail: 'billing' })); }}
                  className="font-semibold underline text-yellow-800 hover:text-yellow-900 bg-transparent border-none p-0 cursor-pointer"
                >
                  Please upgrade your account
                </button>
              </p>
            </div>
          )}

          {/* Default Role - FIRST */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Default Role</h3>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white flex items-center justify-between cursor-pointer hover:border-gray-400 transition-colors focus:outline-none focus:ring-0 focus:border-gray-400"
                style={{ outline: 'none' }}
              >
                <div className="flex items-center gap-2">
                  {selectedRole === 'Viewer' && <Eye className="w-4 h-4 text-gray-600" />}
                  {selectedRole === 'Contributor' && <Edit className="w-4 h-4 text-gray-600" />}
                  {selectedRole === 'Partial Admin' && <Shield className="w-4 h-4 text-gray-600" />}
                  {selectedRole === 'Admin' && <Shield className="w-4 h-4 text-gray-600" />}
                  <span className="text-gray-900">
                    {selectedRole === 'Viewer' && 'Viewer - Can view content'}
                    {selectedRole === 'Contributor' && 'Contributor - Can add content'}
                    {selectedRole === 'Partial Admin' && 'Admin - Partial Access'}
                    {selectedRole === 'Admin' && 'Admin - Full Access'}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isRoleDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isRoleDropdownOpen && (
                <>
                  {/* Backdrop to close dropdown when clicking outside */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsRoleDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                    <div
                      onClick={() => { setSelectedRole('Viewer'); setIsRoleDropdownOpen(false); }}
                      className={`px-3 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-gray-50 ${selectedRole === 'Viewer' ? 'bg-blue-50' : ''}`}
                    >
                      <Eye className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-900">Viewer - Can view content</span>
                    </div>
                    <div
                      onClick={() => { setSelectedRole('Contributor'); setIsRoleDropdownOpen(false); }}
                      className={`px-3 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-gray-50 ${selectedRole === 'Contributor' ? 'bg-blue-50' : ''}`}
                    >
                      <Edit className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-900">Contributor - Can add content</span>
                    </div>
                    <div
                      onClick={() => {
                        if (!isAdminLimitExceeded) {
                          setSelectedRole('Partial Admin');
                          setIsRoleDropdownOpen(false);
                        }
                      }}
                      className={`px-3 py-2.5 flex items-center gap-2 ${
                        isAdminLimitExceeded
                          ? 'cursor-not-allowed opacity-50 bg-gray-100'
                          : `cursor-pointer hover:bg-gray-50 ${selectedRole === 'Partial Admin' ? 'bg-blue-50' : ''}`
                      }`}
                      title={isAdminLimitExceeded ? `Admin limit reached (${adminLimitData?.current_admins}/${adminLimitData?.max_allowed})` : ''}
                    >
                      <Shield className={`w-4 h-4 ${isAdminLimitExceeded ? 'text-gray-400' : 'text-gray-600'}`} />
                      <span className={`text-sm ${isAdminLimitExceeded ? 'text-gray-400' : 'text-gray-900'}`}>Admin - Partial Access</span>
                    </div>
                    <div
                      onClick={() => {
                        if (!isAdminLimitExceeded) {
                          setSelectedRole('Admin');
                          setIsRoleDropdownOpen(false);
                        }
                      }}
                      className={`px-3 py-2.5 flex items-center gap-2 ${
                        isAdminLimitExceeded
                          ? 'cursor-not-allowed opacity-50 bg-gray-100'
                          : `cursor-pointer hover:bg-gray-50 ${selectedRole === 'Admin' ? 'bg-blue-50' : ''}`
                      }`}
                      title={isAdminLimitExceeded ? `Admin limit reached (${adminLimitData?.current_admins}/${adminLimitData?.max_allowed})` : ''}
                    >
                      <Shield className={`w-4 h-4 ${isAdminLimitExceeded ? 'text-gray-400' : 'text-gray-600'}`} />
                      <div className="flex flex-col flex-1">
                        <span className={`text-sm ${isAdminLimitExceeded ? 'text-gray-400' : 'text-gray-900'}`}>
                          Admin - Full Access
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Categories checklist for Partial Admin */}
          {selectedRole === 'Partial Admin' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-medium text-gray-900">Select Campaigns</h3>
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  {selectedPartialMemories.size} selected
                </span>
              </div>
              {availableCategories.length === 0 ? (
                <p className="text-xs text-gray-400">No categories available</p>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {availableCategories.map((cat) => {
                    const catMemories = memories.filter(m => m.category === cat.name);
                    const selectedInCat = catMemories.filter(m => selectedPartialMemories.has(m.id));
                    const allSelected = catMemories.length > 0 && selectedInCat.length === catMemories.length;
                    const someSelected = selectedInCat.length > 0 && !allSelected;
                    const isExpanded = expandedCategories.has(cat.name);
                    return (
                      <div key={cat.name} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Category header row */}
                        <div className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${allSelected ? 'bg-[#6C60FF]/5' : someSelected ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'}`}>
                          {/* Expand/collapse chevron */}
                          <button
                            type="button"
                            onClick={() => setExpandedCategories(prev => {
                              const next = new Set(prev);
                              if (next.has(cat.name)) next.delete(cat.name); else next.add(cat.name);
                              return next;
                            })}
                            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          {/* Category checkbox */}
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => { if (el) el.indeterminate = someSelected; }}
                            onChange={() => {
                              setSelectedPartialMemories(prev => {
                                const next = new Set(prev);
                                if (allSelected) {
                                  catMemories.forEach(m => next.delete(m.id));
                                } else {
                                  catMemories.forEach(m => next.add(m.id));
                                }
                                return next;
                              });
                            }}
                            className="w-4 h-4 rounded border-gray-300 accent-[#6C60FF] cursor-pointer flex-shrink-0"
                          />
                          <Folder className="w-4 h-4 flex-shrink-0" style={{ color: cat.color }} />
                          <span className="text-sm font-medium text-gray-900 flex-1">{cat.name}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {selectedInCat.length}/{catMemories.length} {catMemories.length === 1 ? 'campaign' : 'campaigns'}
                          </span>
                        </div>
                        {/* Memory list (expanded) */}
                        {isExpanded && (
                          <div className="border-t border-gray-100">
                            {catMemories.length === 0 ? (
                              <div className="px-10 py-3 text-xs text-gray-400 text-center">No campaigns in this category</div>
                            ) : (
                              <div className="divide-y divide-gray-50">
                                {catMemories.map(memory => {
                                  const isMemSelected = selectedPartialMemories.has(memory.id);
                                  return (
                                    <div
                                      key={memory.id}
                                      onClick={() => {
                                        setSelectedPartialMemories(prev => {
                                          const next = new Set(prev);
                                          if (next.has(memory.id)) next.delete(memory.id); else next.add(memory.id);
                                          return next;
                                        });
                                      }}
                                      className={`flex items-center gap-3 pl-10 pr-3 py-2 cursor-pointer transition-colors ${isMemSelected ? 'bg-[#6C60FF]/5' : 'hover:bg-gray-50'}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isMemSelected}
                                        onChange={() => {}}
                                        className="w-4 h-4 rounded border-gray-300 accent-[#6C60FF] cursor-pointer flex-shrink-0 pointer-events-none"
                                      />
                                      <MemoryThumbnail thumbnail={memory.thumbnail} title={memory.title} profileImage={user?.profile_image} name={user?.name} size="sm" />
                                      <span className="text-sm text-gray-800 flex-1 truncate">{memory.title}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Select Memory Section - Hidden for Admin and Partial Admin */}
          {selectedRole !== 'Admin' && selectedRole !== 'Partial Admin' && (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium text-gray-900">Select Campaigns</h3>
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                {isSearching ? 'Searching...' : `${selectedMemories.length} selected`}
              </span>
            </div>

            <div className="relative mb-3">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                isSearching ? 'text-blue-500 animate-pulse' : 'text-gray-400'
              }`} />
              <Input
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!focusedInput) setFocusedInput('search');
                }}
                onFocus={() => setFocusedInput('search')}
                onBlur={() => setFocusedInput(null)}
                className={`pl-10 bg-gray-50 text-sm transition-all focus:outline-none placeholder:text-gray-500 ${
                  searchQuery.trim()
                    ? 'border-black ring-1 ring-black'
                    : 'border-gray-300 focus:border-gray-400 focus:ring-1 focus:ring-gray-300'
                }`}
                disabled={isSearching}
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            {/* Selected Memories Display */}
            {selectedMemories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedMemories.map((memory) => (
                  <Badge
                    key={memory.id}
                    variant="secondary"
                    className="bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer"
                    onClick={() => handleToggleMemory(memory)}
                  >
                    {memory.title}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">Searching campaigns...</p>
                  </div>
                </div>
              ) : filteredMemories.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Search className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      {searchQuery ? `No campaigns found for "${searchQuery}"` : 'No campaigns available'}
                    </p>
                    {searchQuery && (
                      <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
                    )}
                  </div>
                </div>
              ) : (
                filteredMemories.map((memory) => {
                  const isSelected = selectedMemories.some(m => m.id === memory.id);
                  return (
                <div
                  key={memory.id}
                  onClick={() => handleToggleMemory(memory)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* Checkbox */}
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <MemoryThumbnail thumbnail={memory.thumbnail} title={memory.title} profileImage={user?.profile_image} name={user?.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 text-sm truncate">{memory.title}</h4>
                      <p className="text-xs text-gray-500">
                        {memory.category} • {memory.image_count || 0} images
                      </p>
                    </div>
                  </div>
                </div>
                  );
                })
              )}
            </div>
          </div>
          )}
          {/* Invite Collaborators Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-medium text-gray-900">Invite Users</h3>
              <span className="text-xs text-gray-500">(optional)</span>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              Share this campaign with specific people by adding their email addresses, phone numbers, or selecting from your contacts.
            </p>

            {/* Input Tabs */}
            <div className="flex mb-3">
              <button
                onClick={() => setActiveTab('email')}
                className={`px-3 py-1 text-xs font-medium rounded-l border-r border-white ${
                  activeTab === 'email'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Email
              </button>
              <button
                onClick={() => setActiveTab('phone')}
                className={`px-3 py-1 text-xs font-medium rounded-r ${
                  activeTab === 'phone'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Phone
              </button>
            </div>

            {/* Email Input */}
            {activeTab === 'email' && (
              <div className="mb-3 relative">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. name@example.com"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      if (!focusedInput) setFocusedInput('email');
                    }}
                    onFocus={() => setFocusedInput('email')}
                    onBlur={() => {
                      // Delay hiding suggestions to allow click events to fire
                      setTimeout(() => {
                        setFocusedInput(null);
                        setShowSuggestions(false);
                      }, 200);
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
                    className={`flex-1 bg-gray-50 text-sm transition-all focus:outline-none placeholder:text-gray-500 ${
                      emailInput.trim()
                        ? 'border-black ring-1 ring-black'
                        : 'border-gray-300 focus:border-gray-400 focus:ring-1 focus:ring-gray-300'
                    }`}
                  />
                  <Button
                    variant="outline"
                    onClick={handleAddEmail}
                    disabled={!emailInput.trim() || isCheckingAdminEmail}
                    size="sm"
                    className="text-xs px-3 focus:outline-none transition-colors bg-[#F6339A] text-white border-[#F6339A] hover:bg-[#e02d8a] hover:border-[#e02d8a] hover:text-white"
                  >
                    {isCheckingAdminEmail ? 'Checking...' : 'Add'}
                  </Button>
                </div>

                {/* User Suggestions Dropdown */}
                {showSuggestions && userSuggestions.length > 0 && (
                  <div className="absolute left-0 right-12 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {isLoadingSuggestions ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <div className="py-1">
                        {userSuggestions.map((user) => (
                          <div
                            key={user.id}
                            onClick={() => handleSelectSuggestion(user)}
                            className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <Avatar className="h-8 w-8">
                              {user.profile_image ? (
                                <AvatarImage src={user.profile_image} />
                              ) : null}
                              <AvatarFallback className="text-xs bg-purple-100 text-purple-600">
                                {generateInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {user.name || 'Unknown User'}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Phone Input */}
            {activeTab === 'phone' && (
              <div className="mb-3 relative">
                <div className="flex gap-2">
                  <CountrySelect
                    value={phoneCountryCode}
                    onChange={setPhoneCountryCode}
                    className="w-28 h-9 flex-shrink-0 border border-gray-300 rounded-md bg-gray-50 text-sm focus:outline-none focus:border-gray-400"
                  />
                  <Input
                    placeholder="e.g. 4163028755"
                    inputMode="tel"
                    value={phoneInput}
                    onChange={(e) => {
                      setPhoneInput(e.target.value);
                      if (!focusedInput) setFocusedInput('phone');
                    }}
                    onFocus={() => setFocusedInput('phone')}
                    onBlur={() => {
                      // Delay hiding suggestions to allow click events to fire
                      setTimeout(() => {
                        setFocusedInput(null);
                        setShowSuggestions(false);
                      }, 200);
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddPhone()}
                    className={`flex-1 bg-gray-50 text-sm transition-all focus:outline-none placeholder:text-gray-500 ${
                      phoneInput.trim()
                        ? 'border-black ring-1 ring-black'
                        : 'border-gray-300 focus:border-gray-400 focus:ring-1 focus:ring-gray-300'
                    }`}
                  />
                  <Button
                    variant="outline"
                    onClick={handleAddPhone}
                    disabled={!phoneInput.trim() || isCheckingAdminEmail}
                    size="sm"
                    className="text-xs px-3 focus:outline-none transition-colors bg-[#F6339A] text-white border-[#F6339A] hover:bg-[#e02d8a] hover:border-[#e02d8a] hover:text-white"
                  >
                    {isCheckingAdminEmail ? 'Checking...' : 'Add'}
                  </Button>
                </div>

                {/* User Suggestions Dropdown for Phone */}
                {showSuggestions && userSuggestions.length > 0 && (
                  <div className="absolute left-0 right-12 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {isLoadingSuggestions ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <div className="py-1">
                        {userSuggestions.map((user) => (
                          <div
                            key={user.id}
                            onClick={() => handleSelectSuggestion(user)}
                            className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <Avatar className="h-8 w-8">
                              {user.profile_image ? (
                                <AvatarImage src={user.profile_image} />
                              ) : null}
                              <AvatarFallback className="text-xs bg-purple-100 text-purple-600">
                                {generateInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {user.name || 'Unknown User'}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{user.phone_number || user.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Selected Collaborators - Show if any are selected */}
            {selectedCollaborators.length > 0 && (
              <div className="space-y-2 mb-4">
                <h4 className="text-sm font-medium text-gray-700">Selected Users</h4>
                {selectedCollaborators.map((collaborator) => (
                  <div key={collaborator.id} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-7 w-7">
                        {collaborator.profile_image ? (
                          <AvatarImage src={collaborator.profile_image} />
                        ) : null}
                        <AvatarFallback className="text-xs bg-blue-100 text-blue-600">
                          {generateInitials(collaborator.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{collaborator.name}</p>
                        <p className="text-xs text-gray-500">{collaborator.email || collaborator.phone_number}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCollaborator(collaborator.id)}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Frequent users section removed per request. */}
          </div>

          {/* Recent Collaborators Grid — only shown when there are valid recent users */}
          {validRecentUsers.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Recent users</h4>
            <div className="grid grid-cols-2 gap-3">
              {validRecentUsers.slice(0, 4).map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleAddCollaborator(user)}
                  className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 cursor-pointer transition-all"
                >
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-8 w-8">
                      {user.profile_image ? (
                        <AvatarImage src={user.profile_image} />
                      ) : null}
                      <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                        {generateInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email || user.phone_number}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Personal Message */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Personal Message (Optional)</h3>
            <textarea
              placeholder="Add a personal message to your invitation..."
              value={personalMessage}
              onChange={(e) => {
                setPersonalMessage(e.target.value);
                if (!focusedInput) setFocusedInput('message');
              }}
              onFocus={() => setFocusedInput('message')}
              onBlur={() => setFocusedInput(null)}
              className={`w-full p-3 rounded-lg resize-none h-16 text-sm bg-gray-50 placeholder:text-gray-500 transition-all focus:outline-none ${
                personalMessage.trim()
                  ? 'border border-black ring-1 ring-black'
                  : 'border border-gray-300 focus:border-gray-400 focus:ring-1 focus:ring-gray-300'
              }`}
              maxLength={200}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{personalMessage.length}/200 characters</p>
          </div>
        </div>

        {/* Footer - Fixed positioning inside modal */}
        <div className="sticky bottom-0 px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl">
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 h-10 text-sm border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors focus:outline-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendInvite}
              disabled={
                selectedCollaborators.length === 0 || isLoading ||
                (selectedRole === 'Partial Admin' && selectedPartialMemories.size === 0) ||
                (selectedRole !== 'Admin' && selectedRole !== 'Partial Admin' && selectedMemories.length === 0)
              }
              className="flex-1 h-10 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending...
                </>
              ) : (
                <>
                  Send Invites
                  <Users className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}