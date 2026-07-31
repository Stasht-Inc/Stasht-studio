import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Shield, Check, X, UserPlus, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import { dashboardAPI } from "../utils/authUtils";
import { useAuth } from "../contexts/AuthContext";
import { mapLimit } from "../utils/requestLimit";

// Default editable body of the personalized invite message (author-name prefix is fixed/non-editable)
const DEFAULT_INVITE_MESSAGE = "invited you to collaborate on campaign";

interface Collaborator {
  id: string;
  userId?: string;  // The actual user ID needed for API calls
  name: string;
  email: string;
  phone_number?: string;
  avatar?: string;
  role: 'view' | 'edit' | 'admin' | 'partial_admin';
  status: 'active' | 'pending' | 'invited';
  addedDate: string;
}

interface AddCollaboratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCollaborator: (collaborator: Collaborator) => void;
  existingCollaborators?: Collaborator[];
  memoryId: string;
  categories?: { name: string }[];
  hasProperty?: boolean;
  propertyId?: number;
  memoryProperties?: { id: number; name: string; image?: string | null }[];
}

// User interface for API responses
interface ApiUser {
  id: number | string;
  name: string;
  email: string;
  phone_number?: string;
  profile_image?: string;
  avatar?: string;
}

export default function AddCollaboratorDialog({
  isOpen,
  onClose,
  onAddCollaborator,
  existingCollaborators = [],
  memoryId,
  categories = [],
  hasProperty = false,
  propertyId,
  memoryProperties = []
}: AddCollaboratorDialogProps) {
  const { user } = useAuth();
  // Measure the fixed author-name prefix width (via callback ref, reliable inside the portal dialog)
  // so the message's first line indents past it instead of overlapping.
  const [personalizedNameWidth, setPersonalizedNameWidth] = useState(0);
  const measureNameRef = useCallback((node: HTMLSpanElement | null) => {
    if (node) setPersonalizedNameWidth(node.offsetWidth + 6); // + small gap
  }, [user?.name]);
  const [inviteMethod, setInviteMethod] = useState<'email' | 'phone'>('email');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmailCollaborators, setSelectedEmailCollaborators] = useState<ApiUser[]>([]);
  const [selectedPhoneCollaborators, setSelectedPhoneCollaborators] = useState<ApiUser[]>([]);
  const [defaultRole, setDefaultRole] = useState<'view' | 'edit' | 'admin' | 'partial_admin' | 'property_collaborator'>('edit');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customMessage, setCustomMessage] = useState(DEFAULT_INVITE_MESSAGE);
  const [isInviting, setIsInviting] = useState(false);
  const [searchResults, setSearchResults] = useState<ApiUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [frequentCollaborators, setFrequentCollaborators] = useState<ApiUser[]>([]);
  const [recentCollaborators, setRecentCollaborators] = useState<ApiUser[]>([]);
  const [isCheckingAdminEmail, setIsCheckingAdminEmail] = useState(false);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);

  // Get current selected collaborators based on active tab
  const selectedCollaborators = inviteMethod === 'email' ? selectedEmailCollaborators : selectedPhoneCollaborators;
  const setSelectedCollaborators = inviteMethod === 'email' ? setSelectedEmailCollaborators : setSelectedPhoneCollaborators;

  // Ref for the search container to detect clicks outside
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Debounced search effect
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        setSearchError(null);
        return;
      }

      setIsSearching(true);
      setSearchError(null);

      try {
        console.log('🔍 Searching users with query:', searchQuery, 'using method:', inviteMethod);
        const response = await dashboardAPI.searchUsers(searchQuery.trim(), inviteMethod);

        console.log('🔍 Search response:', response);
        console.log('🔍 Response data structure:', {
          hasData: !!response.data,
          hasUsers: !!(response.data && response.data.data.users),
          usersIsArray: !!(response.data && response.data.data.users && Array.isArray(response.data.data.users)),
          usersLength: response.data && response.data.data.users ? response.data.data.users.length : 0
        });

        if (response.success && response.data) {
          // Handle the API response structure - Direct extraction
          let users: ApiUser[] = [];

          // Directly access response.data.data.users since we know the structure
          if (response.data.data && response.data.data.users && Array.isArray(response.data.data.users)) {
            users = response.data.data.users;
            console.log('✅ Successfully extracted users from response.data.data.users:', users.length);
          } else {
            console.warn('🔍 Users not found in expected location');
            console.warn('🔍 Available keys in response.data:', Object.keys(response.data || {}));
            users = [];
          }

          console.log('🔍 Raw extracted users:', users);

          // Filter out existing collaborators and already selected collaborators
          const filteredUsers = users.filter((user: ApiUser) => {
            const isExisting = existingCollaborators.some(collab => collab.email === user.email);
            const isSelected = selectedCollaborators.some(c =>
              inviteMethod === 'email' ? c.email === user.email : c.phone_number === user.phone_number
            );
            return !isExisting && !isSelected;
          });

          console.log('🔍 Filtered users (after removing existing and selected):', filteredUsers.length);

          setSearchError(null);
          setSearchResults(filteredUsers);

        } else {
          console.error('❌ Search failed:', response.error);
          setSearchError(response.error || 'Search failed');
          setSearchResults([]);
        }
      } catch (error) {
        console.error('🔥 Search error:', error);
        setSearchError('Failed to search users');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    // Debounce search by 300ms
    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, inviteMethod, selectedCollaborators, existingCollaborators]);

  // Debug effect to track searchResults changes
  useEffect(() => {
    console.log('🔍 searchResults state changed. New length:', searchResults.length);
    console.log('🔍 Current searchResults:', searchResults.map(u => ({ id: u.id, name: u.name, email: u.email })));
  }, [searchResults]);

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (!isOpen) {
      // Reset all state when modal is closed
      setSearchQuery("");
      setSelectedEmailCollaborators([]);
      setSelectedPhoneCollaborators([]);
      setCustomMessage(DEFAULT_INVITE_MESSAGE);
      setSearchResults([]);
      setSearchError(null);
      setInviteMethod('email');
      setSelectedCategories([]);
      setSelectedPropertyIds([]);
    }
  }, [isOpen]);

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);



  // Function to add collaborator from search or frequent/recent lists
  const handleAddCollaborator = async (user: ApiUser) => {
    // Check if already selected
    const isAlreadySelected = selectedCollaborators.some(c =>
      inviteMethod === 'email' ? c.email === user.email : c.phone_number === user.phone_number
    );

    if (isAlreadySelected) {
      toast.error("This user is already added");
      return;
    }

    // Check if email is already an admin (only for email invites)
    if (inviteMethod === 'email' && user.email) {
      setIsCheckingAdminEmail(true);
      try {
        const response = await dashboardAPI.checkAdminEmail(user.email);
        console.log('checkAdminEmail response in AddCollaboratorDialog:', response);

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

    // Add to selected collaborators
    setSelectedCollaborators(prev => [...prev, user]);

    // Clear search query
    setSearchQuery("");
    setSearchResults([]);

    toast.success(`Added ${user.name || user.email || user.phone_number}`);
  };

  // Function to add collaborator from manual input
  const handleAddFromInput = async () => {
    const input = searchQuery.trim();

    if (!input) {
      toast.error("Please enter an email or phone number");
      return;
    }

    // Validate email format
    if (inviteMethod === 'email') {
      const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{1,}$/;
      if (!emailRegex.test(input)) {
        toast.error("Please enter a valid email address");
        return;
      }
    }

    // Validate phone format (must have at least 7 digits)
    if (inviteMethod === 'phone') {
      const digitsOnly = input.replace(/[^0-9]/g, '');
      if (digitsOnly.length < 7) {
        toast.error("Please enter a valid phone number");
        return;
      }
    }

    // Check if already selected
    const isAlreadySelected = selectedCollaborators.some(c =>
      inviteMethod === 'email' ? c.email === input : c.phone_number === input
    );

    if (isAlreadySelected) {
      toast.error("This user is already added");
      return;
    }

    // Check if email is already an admin (only for email invites)
    if (inviteMethod === 'email') {
      setIsCheckingAdminEmail(true);
      try {
        const response = await dashboardAPI.checkAdminEmail(input);
        console.log('checkAdminEmail response in handleAddFromInput:', response);

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

    // First, check if input matches current search results
    let matchedUser = searchResults.find(u =>
      inviteMethod === 'email' ? u.email === input : u.phone_number === input
    );

    // If not in current results, do a fresh search to get user data
    if (!matchedUser && input.length >= 2) {
      try {
        const response = await dashboardAPI.searchUsers(input, inviteMethod);
        if (response.success && response.data?.data?.users) {
          const users = response.data.data.users;
          matchedUser = users.find((u: ApiUser) =>
            inviteMethod === 'email' ? u.email === input : u.phone_number === input
          );
        }
      } catch (error) {
        console.error('Error searching for user:', error);
      }
    }

    if (matchedUser) {
      // Add user with full profile data
      setSelectedCollaborators(prev => [...prev, matchedUser!]);
      setSearchQuery("");
      setSearchResults([]);
      toast.success(`Added ${matchedUser.name || input}`);
    } else {
      // Create a temporary user object for unknown email/phone
      const tempUser: ApiUser = {
        id: `temp_${Date.now()}`,
        name: '',
        email: inviteMethod === 'email' ? input : '',
        phone_number: inviteMethod === 'phone' ? input : ''
      };

      setSelectedCollaborators(prev => [...prev, tempUser]);
      setSearchQuery("");
      setSearchResults([]);
      toast.success(`Added ${input}`);
    }
  };

  // Function to remove collaborator from selected list
  const handleRemoveCollaborator = (userId: string | number) => {
    setSelectedCollaborators(prev => prev.filter(c => String(c.id) !== String(userId)));
  };

  const handleEmailInvite = async () => {
    if (selectedCollaborators.length === 0) {
      toast.error("Please add at least one collaborator");
      return;
    }

    setIsInviting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      console.log(`=== ADDING COLLABORATORS VIA API ===`);
      console.log(`Memory ID: ${memoryId}`);
      console.log(`Selected Collaborators: ${selectedCollaborators.length}`);
      console.log(`Default Role: ${defaultRole}`);
      console.log(`Custom Message: ${customMessage}`);

      // Extract emails from selected collaborators
      const emails = selectedCollaborators
        .map(c => c.email)
        .filter(email => email && email.includes('@'));

      if (emails.length > 0) {
        try {
          console.log(`📧 Sending batch invitation for ${emails.length} emails:`, emails);

          let response;
          if (defaultRole === 'property_collaborator') {
            if (!propertyId) {
              toast.error('Property information is missing. Cannot add collaborator to property.');
              setIsInviting(false);
              return;
            }
            // For existing users with property_collaborator role, use /properties/register
            const results = await Promise.all(
              emails.map(email => dashboardAPI.addUserToProperty({ property_id: propertyId, email }))
            );
            response = results.every(r => r.success)
              ? { success: true }
              : { success: false, error: 'Failed to add some users to property' };
          } else {
            response = await dashboardAPI.addMemoryCollaborator(memoryId, {
              emails: emails,
              role: defaultRole,
              personalize_message: customMessage.trim() || undefined
            });
          }

          if (response.success) {
            successCount = emails.length;
            console.log(`✅ Successfully sent invitations to all ${emails.length} emails`);

            // Create collaborators for local UI update
            selectedCollaborators.forEach(user => {
              const newCollaborator: Collaborator = {
                id: `collab_${Date.now()}_${user.email}`,
                name: user.name || user.email.split('@')[0],
                email: user.email,
                avatar: user.profile_image || user.avatar,
                role: defaultRole,
                status: 'invited',
                addedDate: new Date().toISOString()
              };
              onAddCollaborator(newCollaborator);
            });
          } else {
            errorCount = emails.length;
            console.error(`❌ Failed to send batch invitation:`, response);
            // Display specific error message from API
            const errorMessage = response.message || response.error || 'Failed to send invitations';
            toast.error(errorMessage);
          }
        } catch (error) {
          errorCount = emails.length;
          console.error(`🔥 Error sending batch invitation:`, error);
        }
      }

      // Show results
      if (successCount > 0) {
        toast.success(`Successfully invited ${successCount} collaborator${successCount === 1 ? '' : 's'}!`);
      }
      // Error toast already shown in the try-catch block above

      if (successCount > 0) {
        // Reset form and close dialog on success
        setSearchQuery("");
        setSelectedEmailCollaborators([]);
        setCustomMessage(DEFAULT_INVITE_MESSAGE);
        setSearchResults([]);
        onClose();
      }

      console.log(`=== END ADDING COLLABORATORS ===`);
      console.log(`Success: ${successCount}, Errors: ${errorCount}`);

    } catch (error) {
      console.error('🔥 Unexpected error during invitation process:', error);
      toast.error("An unexpected error occurred while sending invitations");
    } finally {
      setIsInviting(false);
    }
  };

  const handlePhoneInvite = async () => {
    if (selectedCollaborators.length === 0) {
      toast.error("Please add at least one collaborator");
      return;
    }

    setIsInviting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      console.log(`=== ADDING COLLABORATORS BY PHONE VIA API ===`);
      console.log(`Memory ID: ${memoryId}`);
      console.log(`Selected Collaborators: ${selectedCollaborators.length}`);
      console.log(`Default Role: ${defaultRole}`);
      console.log(`Custom Message: ${customMessage}`);

      // Extract phones from selected collaborators
      const phones = selectedCollaborators
        .map(c => c.phone_number)
        .filter(phone => phone);

      if (phones.length > 0) {
        try {
          console.log(`📱 Sending batch invitation for ${phones.length} phone numbers:`, phones);

          let response;
          if (defaultRole === 'property_collaborator') {
            if (!propertyId) {
              toast.error('Property information is missing. Cannot add collaborator to property.');
              setIsInviting(false);
              return;
            }
            // For existing users with property_collaborator role, use /properties/register
            const results = await Promise.all(
              phones.map(phone => dashboardAPI.addUserToProperty({ property_id: propertyId, phone_number: phone! }))
            );
            response = results.every(r => r.success)
              ? { success: true }
              : { success: false, error: 'Failed to add some users to property' };
          } else {
            response = await dashboardAPI.addMemoryCollaboratorByPhone(memoryId, {
              phones: phones,
              role: defaultRole,
              personalize_message: customMessage.trim() || undefined
            });
          }

          if (response.success) {
            successCount = phones.length;
            console.log(`✅ Successfully sent invitations to all ${phones.length} phone numbers`);

            // Create collaborators for local UI update
            selectedCollaborators.forEach(user => {
              const newCollaborator: Collaborator = {
                id: `collab_${Date.now()}_${user.phone_number}`,
                name: user.name || user.phone_number || '',
                email: user.email || '',
                phone_number: user.phone_number,
                avatar: user.profile_image || user.avatar,
                role: defaultRole,
                status: 'invited',
                addedDate: new Date().toISOString()
              };
              onAddCollaborator(newCollaborator);
            });
          } else {
            errorCount = phones.length;
            console.error(`❌ Failed to send batch invitation:`, response);
            // Display specific error message from API
            const errorMessage = response.message || response.error || 'Failed to send invitations';
            toast.error(errorMessage);
          }
        } catch (error) {
          errorCount = phones.length;
          console.error(`🔥 Error sending batch invitation:`, error);
        }
      }

      // Show results
      if (successCount > 0) {
        toast.success(`Successfully invited ${successCount} collaborator${successCount === 1 ? '' : 's'}!`);
      }
      // Error toast already shown in the try-catch block above

      if (successCount > 0) {
        // Reset form and close dialog on success
        setSearchQuery("");
        setSelectedPhoneCollaborators([]);
        setCustomMessage(DEFAULT_INVITE_MESSAGE);
        setSearchResults([]);
        onClose();
      }

      console.log(`=== END ADDING COLLABORATORS BY PHONE ===`);
      console.log(`Success: ${successCount}, Errors: ${errorCount}`);

    } catch (error) {
      console.error('🔥 Unexpected error during phone invitation process:', error);
      toast.error("An unexpected error occurred while sending invitations");
    } finally {
      setIsInviting(false);
    }
  };

  // Combined handler that calls both email and phone APIs if both have entries
  const handleSendInvitations = async () => {
    const hasEmails = selectedEmailCollaborators.length > 0;
    const hasPhones = selectedPhoneCollaborators.length > 0;

    if (!hasEmails && !hasPhones) {
      toast.error("Please add at least one collaborator");
      return;
    }

    setIsInviting(true);
    let emailSuccess = 0;
    let emailError = 0;
    let phoneSuccess = 0;
    let phoneError = 0;

    try {
      console.log(`=== ADDING COLLABORATORS (COMBINED) ===`);
      console.log(`Memory ID: ${memoryId}`);
      console.log(`Email Collaborators: ${selectedEmailCollaborators.length}`);
      console.log(`Phone Collaborators: ${selectedPhoneCollaborators.length}`);

      // Call email API if there are email collaborators
      if (hasEmails) {
        const emails = selectedEmailCollaborators
          .map(c => c.email)
          .filter(email => email && email.includes('@'));

        if (emails.length > 0) {
          try {
            console.log(`📧 Sending batch invitation for ${emails.length} emails:`, emails);
            console.log(`📧 Role: ${defaultRole}, PropertyId: ${propertyId}`);

            let response;
            if (defaultRole === 'property_collaborator') {
              const targetPropertyIds = memoryProperties.length > 1
                ? selectedPropertyIds
                : (propertyId ? [propertyId] : []);

              if (targetPropertyIds.length === 0) {
                toast.error(memoryProperties.length > 1
                  ? 'Please select at least one property.'
                  : 'Property information is missing.');
                setIsInviting(false);
                return;
              }
              // Concurrency-capped: this is a cartesian product of collaborators ×
              // properties, so it grows fast enough to trip the rate limiter.
              const results = await mapLimit(
                selectedEmailCollaborators.flatMap(user =>
                  targetPropertyIds.map(pid => ({ pid, email: user.email }))
                ),
                ({ pid, email }) =>
                  dashboardAPI.inviteToMemory(pid, {
                    memory_id: parseInt(memoryId, 10),
                    email
                  })
              );
              response = results.every(r => r.success)
                ? { success: true }
                : { success: false, error: 'Failed to invite some users' };
            } else {
              response = await dashboardAPI.addMemoryCollaborator(memoryId, {
                emails: emails,
                role: defaultRole,
                personalize_message: customMessage.trim() || undefined
              });
            }

            if (response.success) {
              emailSuccess = emails.length;
              console.log(`✅ Successfully sent invitations to all ${emails.length} emails`);

              selectedEmailCollaborators.forEach(user => {
                const newCollaborator: Collaborator = {
                  id: `collab_${Date.now()}_${user.email}`,
                  name: user.name || user.email.split('@')[0],
                  email: user.email,
                  avatar: user.profile_image || user.avatar,
                  role: defaultRole,
                  status: 'invited',
                  addedDate: new Date().toISOString()
                };
                onAddCollaborator(newCollaborator);
              });
            } else {
              emailError = emails.length;
              console.error(`❌ Failed to send email invitations:`, response);
              // Display specific error message from API
              const errorMessage = response.message || response.error || 'Failed to send email invitations';
              toast.error(errorMessage);
            }
          } catch (error) {
            emailError = emails.length;
            console.error(`🔥 Error sending email invitations:`, error);
          }
        }
      }

      // Call phone API if there are phone collaborators
      if (hasPhones) {
        const phones = selectedPhoneCollaborators
          .map(c => c.phone_number)
          .filter(phone => phone);

        if (phones.length > 0) {
          try {
            console.log(`📱 Sending batch invitation for ${phones.length} phone numbers:`, phones);
            console.log(`📱 Role: ${defaultRole}, PropertyId: ${propertyId}`);

            let response;
            if (defaultRole === 'property_collaborator') {
              const targetPropertyIds = memoryProperties.length > 1
                ? selectedPropertyIds
                : (propertyId ? [propertyId] : []);

              if (targetPropertyIds.length === 0) {
                toast.error(memoryProperties.length > 1
                  ? 'Please select at least one property.'
                  : 'Property information is missing.');
                setIsInviting(false);
                return;
              }
              // Concurrency-capped, same cartesian shape as the email path above.
              const results = await mapLimit(
                selectedPhoneCollaborators.flatMap(user =>
                  targetPropertyIds.map(pid => ({ pid, phone_number: user.phone_number }))
                ),
                ({ pid, phone_number }) =>
                  dashboardAPI.inviteToMemory(pid, {
                    memory_id: parseInt(memoryId, 10),
                    phone_number
                  })
              );
              response = results.every(r => r.success)
                ? { success: true }
                : { success: false, error: 'Failed to invite some users' };
            } else {
              response = await dashboardAPI.addMemoryCollaboratorByPhone(memoryId, {
                phones: phones,
                role: defaultRole,
                personalize_message: customMessage.trim() || undefined
              });
            }

            if (response.success) {
              phoneSuccess = phones.length;
              console.log(`✅ Successfully sent invitations to all ${phones.length} phone numbers`);

              selectedPhoneCollaborators.forEach(user => {
                const newCollaborator: Collaborator = {
                  id: `collab_${Date.now()}_${user.phone_number}`,
                  name: user.name || user.phone_number || '',
                  email: user.email || '',
                  phone_number: user.phone_number,
                  avatar: user.profile_image || user.avatar,
                  role: defaultRole,
                  status: 'invited',
                  addedDate: new Date().toISOString()
                };
                onAddCollaborator(newCollaborator);
              });
            } else {
              phoneError = phones.length;
              console.error(`❌ Failed to send phone invitations:`, response);
              // Display specific error message from API
              const errorMessage = response.message || response.error || 'Failed to send phone invitations';
              toast.error(errorMessage);
            }
          } catch (error) {
            phoneError = phones.length;
            console.error(`🔥 Error sending phone invitations:`, error);
          }
        }
      }

      // Show results
      const totalSuccess = emailSuccess + phoneSuccess;
      const totalError = emailError + phoneError;

      if (totalSuccess > 0) {
        toast.success(`Successfully invited ${totalSuccess} collaborator${totalSuccess === 1 ? '' : 's'}!`);
      }
      // Error toast already shown in the try-catch blocks above

      if (totalSuccess > 0) {
        // Reset form and close dialog on success
        setSearchQuery("");
        setSelectedEmailCollaborators([]);
        setSelectedPhoneCollaborators([]);
        setCustomMessage(DEFAULT_INVITE_MESSAGE);
        setSearchResults([]);
        onClose();
      }

      console.log(`=== END ADDING COLLABORATORS (COMBINED) ===`);
      console.log(`Email Success: ${emailSuccess}, Email Errors: ${emailError}`);
      console.log(`Phone Success: ${phoneSuccess}, Phone Errors: ${phoneError}`);

    } catch (error) {
      console.error('🔥 Unexpected error during invitation process:', error);
      toast.error("An unexpected error occurred while sending invitations");
    } finally {
      setIsInviting(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#6C60FF]" />
            Add Users
          </DialogTitle>
          <DialogDescription>
            Invite people to users on this campaign. They'll receive an email invitation with access based on the role you assign.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs for Email and Phone */}
        <div className="flex gap-2 border-b border-gray-200 mb-4">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              inviteMethod === 'email'
                ? 'text-[#6C60FF] border-b-2 border-[#6C60FF]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => {
              setInviteMethod('email');
              setSearchQuery("");
              setSearchResults([]);
            }}
          >
            Email
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              inviteMethod === 'phone'
                ? 'text-[#6C60FF] border-b-2 border-[#6C60FF]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => {
              setInviteMethod('phone');
              setSearchQuery("");
              setSearchResults([]);
            }}
          >
            Phone
          </button>
          {inviteMethod === 'phone' && (
            <span className="ml-auto self-center text-xs text-gray-500">Add by phone number</span>
          )}
        </div>

        <div className="space-y-6">
          {/* Input with Add Button and Search Dropdown */}
          <div className="relative" ref={searchContainerRef}>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  placeholder={inviteMethod === 'email' ? "john@example.com" : "+1 (555) 123-4567"}
                  value={searchQuery}
                  type={inviteMethod === 'email' ? 'email' : 'tel'}
                  onChange={(e) => {
                    const value = e.target.value;
                    // If phone tab, only allow numbers, +, -, (, ), and spaces
                    if (inviteMethod === 'phone') {
                      const phoneRegex = /^[0-9+\-() ]*$/;
                      if (phoneRegex.test(value)) {
                        setSearchQuery(value);
                      }
                    } else {
                      // Email tab - allow valid email characters
                      const emailRegex = /^[a-zA-Z0-9@._\-]*$/;
                      if (emailRegex.test(value)) {
                        setSearchQuery(value);
                      }
                    }
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddFromInput();
                    }
                  }}
                  className="bg-gray-50 border-gray-200"
                />

                {/* Search Results Dropdown */}
                {searchQuery && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 border border-gray-200 rounded-lg max-h-60 overflow-y-auto bg-white shadow-lg z-50">
                    {isSearching ? (
                      <div className="p-4 text-center text-gray-500">
                        <div className="w-5 h-5 border-2 border-[#6C60FF] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Searching...
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {searchResults.map((user) => (
                          <div
                            key={user.id}
                            className="p-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => {
                              // Fill input with selected email/phone
                              if (inviteMethod === 'email') {
                                setSearchQuery(user.email);
                              } else {
                                setSearchQuery(user.phone_number || '');
                              }
                              setSearchResults([]);
                            }}
                          >
                            <Avatar className="w-8 h-8 shrink-0">
                              <AvatarImage src={user.profile_image || user.avatar} alt={user.name} />
                              <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">{user.name}</p>
                              <p className="text-xs text-gray-600 truncate">
                                {inviteMethod === 'email' ? user.email : user.phone_number}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button
                onClick={handleAddFromInput}
                disabled={!searchQuery.trim()}
                className={`transition-all ${
                  searchQuery.trim()
                    ? 'bg-[#6C60FF] hover:bg-[#5951E6] text-white border-[#6C60FF]'
                    : 'bg-white border border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Add
              </Button>
            </div>

          </div>

          {/* Selected Collaborators List */}
          {selectedCollaborators.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">
                Selected ({selectedCollaborators.length})
                {(selectedEmailCollaborators.length > 0 && selectedPhoneCollaborators.length > 0) && (
                  <span className="text-xs text-gray-500 ml-2">
                    (Total: {selectedEmailCollaborators.length} email, {selectedPhoneCollaborators.length} phone)
                  </span>
                )}
              </label>
              <div className="space-y-2">
                {selectedCollaborators.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage src={user.profile_image || user.avatar} alt={user.name || 'User'} />
                        <AvatarFallback className="bg-gray-200 text-gray-600">
                          {user.name?.charAt(0)?.toUpperCase() || (inviteMethod === 'email' ? user.email?.charAt(0)?.toUpperCase() : user.phone_number?.charAt(0)) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        {user.name ? (
                          <>
                            <p className="font-medium text-gray-900 text-sm truncate">{user.name}</p>
                            <p className="text-xs text-gray-600 truncate">
                              {inviteMethod === 'email' ? user.email : user.phone_number}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-gray-900 truncate">
                            {inviteMethod === 'email' ? user.email : user.phone_number}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCollaborator(user.id)}
                      className="ml-2 h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Frequent Collaborators */}
          {frequentCollaborators.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Frequent collaborators</label>
              <div className="grid grid-cols-2 gap-3">
                {frequentCollaborators.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage src={user.profile_image || user.avatar} alt={user.name} />
                        <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{user.name}</p>
                        <p className="text-xs text-gray-600 truncate">
                          {inviteMethod === 'email' ? user.email : user.phone_number}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddCollaborator(user)}
                      className="ml-2 h-8 w-8 p-0 text-gray-600 hover:text-[#6C60FF] hover:bg-[#6C60FF]/10 shrink-0"
                    >
                      <UserPlus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Collaborators */}
          {recentCollaborators.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Recent collaborators</label>
              <div className="grid grid-cols-2 gap-3">
                {recentCollaborators.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage src={user.profile_image || user.avatar} alt={user.name} />
                        <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{user.name}</p>
                        <p className="text-xs text-gray-600 truncate">
                          {inviteMethod === 'email' ? user.email : user.phone_number}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddCollaborator(user)}
                      className="ml-2 h-8 w-8 p-0 text-gray-600 hover:text-[#6C60FF] hover:bg-[#6C60FF]/10 shrink-0"
                    >
                      <UserPlus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Default Role Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Default Role</label>
            <Select value={defaultRole} onValueChange={(value: 'view' | 'edit' | 'admin' | 'partial_admin' | 'property_collaborator') => setDefaultRole(value)}>
              <SelectTrigger 
                className="w-full bg-gray-50 border-gray-200 focus:border-gray-400 focus:ring-1 focus:ring-gray-300 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:border-gray-400 focus-visible:ring-gray-300 hover:bg-gray-50 hover:border-gray-200 !bg-gray-50 !hover:bg-gray-50 !focus:bg-gray-50"
                style={{ 
                  backgroundColor: '#f9fafb !important',
                  borderColor: '#e5e7eb !important'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
                onFocus={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = '#9ca3af';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 shadow-lg outline-none focus:outline-none focus-visible:outline-none [&_*]:!text-gray-900 [&_*[data-highlighted]]:!bg-gray-100 [&_*[data-highlighted]]:!text-gray-900 [&_*[data-state=checked]]:!bg-gray-200 [&_*[data-state=checked]]:!text-gray-900">
                <SelectItem
                  value="view"
                  className="hover:bg-gray-50 focus:bg-gray-100 focus:text-gray-900 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-900 data-[state=checked]:bg-gray-200 data-[state=checked]:text-gray-900 outline-none focus:outline-none cursor-pointer [&]:!bg-white [&:hover]:!bg-gray-50 [&[data-highlighted]]:!bg-gray-100 [&[data-state=checked]]:!bg-gray-200"
                  style={{
                    backgroundColor: 'white !important',
                    color: '#374151 !important'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.setProperty('background-color', '#f9fafb', 'important');
                    e.currentTarget.style.setProperty('color', '#374151', 'important');
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.setProperty('background-color', 'white', 'important');
                    e.currentTarget.style.setProperty('color', '#374151', 'important');
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    <span>Viewer</span>
                    <span className="text-xs text-gray-500 ml-auto">- Can view and comment</span>
                  </div>
                </SelectItem>
                <SelectItem
                  value="edit"
                  className="hover:bg-gray-50 focus:bg-gray-100 focus:text-gray-900 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-900 data-[state=checked]:bg-gray-200 data-[state=checked]:text-gray-900 outline-none focus:outline-none cursor-pointer [&]:!bg-white [&:hover]:!bg-gray-50 [&[data-highlighted]]:!bg-gray-100 [&[data-state=checked]]:!bg-gray-200"
                  style={{
                    backgroundColor: 'white !important',
                    color: '#374151 !important'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.setProperty('background-color', '#f9fafb', 'important');
                    e.currentTarget.style.setProperty('color', '#374151', 'important');
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.setProperty('background-color', 'white', 'important');
                    e.currentTarget.style.setProperty('color', '#374151', 'important');
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <span>Contributor</span>
                    <span className="text-xs text-gray-500 ml-auto">- Can add moments and comment</span>
                  </div>
                </SelectItem>
                <SelectItem
                  value="partial_admin"
                  className="hover:bg-gray-50 focus:bg-gray-100 focus:text-gray-900 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-900 data-[state=checked]:bg-gray-200 data-[state=checked]:text-gray-900 outline-none focus:outline-none cursor-pointer [&]:!bg-white [&:hover]:!bg-gray-50 [&[data-highlighted]]:!bg-gray-100 [&[data-state=checked]]:!bg-gray-200"
                  style={{
                    backgroundColor: 'white !important',
                    color: '#374151 !important'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.setProperty('background-color', '#f9fafb', 'important');
                    e.currentTarget.style.setProperty('color', '#374151', 'important');
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.setProperty('background-color', 'white', 'important');
                    e.currentTarget.style.setProperty('color', '#374151', 'important');
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                    <span>Admin - Partial Access</span>
                    <span className="text-xs text-gray-500 ml-auto">- Selected categories</span>
                  </div>
                </SelectItem>
                <SelectItem
                  value="admin"
                  className="hover:bg-gray-50 focus:bg-gray-100 focus:text-gray-900 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-900 data-[state=checked]:bg-gray-200 data-[state=checked]:text-gray-900 outline-none focus:outline-none cursor-pointer [&]:!bg-white [&:hover]:!bg-gray-50 [&[data-highlighted]]:!bg-gray-100 [&[data-state=checked]]:!bg-gray-200"
                  style={{
                    backgroundColor: 'white !important',
                    color: '#374151 !important'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.setProperty('background-color', '#f9fafb', 'important');
                    e.currentTarget.style.setProperty('color', '#374151', 'important');
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.setProperty('background-color', 'white', 'important');
                    e.currentTarget.style.setProperty('color', '#374151', 'important');
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400"></div>
                    <span>Admin - Full Access</span>
                    <span className="text-xs text-gray-500 ml-auto">- Full access</span>
                  </div>
                </SelectItem>
                {hasProperty && (
                  <SelectItem
                    value="property_collaborator"
                    className="hover:bg-gray-50 focus:bg-gray-100 focus:text-gray-900 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-900 data-[state=checked]:bg-gray-200 data-[state=checked]:text-gray-900 outline-none focus:outline-none cursor-pointer [&]:!bg-white [&:hover]:!bg-gray-50 [&[data-highlighted]]:!bg-gray-100 [&[data-state=checked]]:!bg-gray-200"
                    style={{ backgroundColor: 'white !important', color: '#374151 !important' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.setProperty('background-color', '#f9fafb', 'important');
                      e.currentTarget.style.setProperty('color', '#374151', 'important');
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.setProperty('background-color', 'white', 'important');
                      e.currentTarget.style.setProperty('color', '#374151', 'important');
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                      <span>Collaborator</span>
                      <span className="text-xs text-gray-500 ml-auto">- Added to this property</span>
                    </div>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-500 space-y-1">
              <p><strong>Viewer:</strong> Can view and comment on moments</p>
              <p><strong>Contributor:</strong> Can add moments and comment</p>
              <p><strong>Admin - Partial Access:</strong> Access to selected categories only</p>
              <p><strong>Admin - Full Access:</strong> Full access to manage collaborators and campaign settings</p>
              {hasProperty && <p><strong>Collaborator:</strong> Added to this property</p>}
            </div>

            {/* Property selector for Collaborator role — shown when story has multiple properties */}
            {defaultRole === 'property_collaborator' && memoryProperties.length > 1 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Select Property <span className="text-red-500">*</span>
                </p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Select All row */}
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = memoryProperties.map(p => p.id);
                      const allSelected = allIds.every(id => selectedPropertyIds.includes(id));
                      setSelectedPropertyIds(allSelected ? [] : allIds);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200 text-left"
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${memoryProperties.every(p => selectedPropertyIds.includes(p.id)) ? 'bg-[#6C60FF] border-[#6C60FF]' : 'border-gray-300 bg-white'}`}>
                      {memoryProperties.every(p => selectedPropertyIds.includes(p.id)) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-700">All Properties</span>
                  </button>
                  {/* Individual property rows */}
                  {memoryProperties.map((property, idx) => {
                    const isChecked = selectedPropertyIds.includes(property.id);
                    return (
                      <button
                        key={property.id}
                        type="button"
                        onClick={() => setSelectedPropertyIds(prev =>
                          prev.includes(property.id)
                            ? prev.filter(id => id !== property.id)
                            : [...prev, property.id]
                        )}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left ${idx < memoryProperties.length - 1 ? 'border-b border-gray-100' : ''} ${isChecked ? 'bg-purple-50' : 'bg-white'}`}
                      >
                        {/* Checkbox */}
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isChecked ? 'bg-[#6C60FF] border-[#6C60FF]' : 'border-gray-300 bg-white'}`}>
                          {isChecked && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        {/* Property image */}
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                          {property.image ? (
                            <img src={property.image} alt={property.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#6C60FF] text-white text-xs font-semibold">
                              {property.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        {/* Property name */}
                        <span className="text-sm text-gray-800 truncate">{property.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Categories checklist for Partial Access */}
            {defaultRole === 'partial_admin' && (
              <div className="mt-3 space-y-2">
                <label className="text-sm font-medium text-gray-700">Select Categories</label>
                {categories.filter(c => c.name !== 'Shared With' && c.name !== 'Published').length === 0 ? (
                  <p className="text-xs text-gray-400">No categories available</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                    {categories
                      .filter(c => c.name !== 'Shared With' && c.name !== 'Published')
                      .map((cat) => (
                        <label
                          key={cat.name}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(cat.name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategories(prev => [...prev, cat.name]);
                              } else {
                                setSelectedCategories(prev => prev.filter(c => c !== cat.name));
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300 accent-[#6C60FF] cursor-pointer"
                          />
                          <span className="text-sm text-gray-800 group-hover:text-gray-900">{cat.name}</span>
                        </label>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Personalized Message — author name is a fixed (non-editable) prefix; the rest is editable */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Custom Message (Optional)</label>
            <div className="relative border border-gray-300 rounded-lg px-3 py-3 bg-white focus-within:border-gray-400">
              {/* Author name: non-editable overlay sitting on the first line */}
              <span
                ref={measureNameRef}
                className="absolute left-3 top-3 text-sm font-semibold text-gray-900 whitespace-nowrap pointer-events-none"
              >
                {user?.name || 'You'}
              </span>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value.slice(0, 200))}
                onBlur={() => {
                  // If the user clears the message, restore the default pre-written text
                  if (!customMessage.trim()) {
                    setCustomMessage(DEFAULT_INVITE_MESSAGE);
                  }
                }}
                placeholder="Add a personal message to the invitation..."
                rows={4}
                maxLength={200}
                style={{ textIndent: personalizedNameWidth ? `${personalizedNameWidth}px` : undefined }}
                className="w-full h-28 p-0 resize-none text-sm text-gray-800 bg-transparent outline-none border-0 focus:ring-0 placeholder:text-gray-400"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1 text-right">{customMessage.length}/200 characters</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="ghost" onClick={onClose} disabled={isInviting}>
              Cancel
            </Button>
            <Button
              onClick={handleSendInvitations}
              disabled={isInviting || (selectedEmailCollaborators.length === 0 && selectedPhoneCollaborators.length === 0)}
              className="bg-[#6C60FF] hover:bg-[#5951E6] text-white"
            >
              {isInviting ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending Invitations...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Invitations
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}