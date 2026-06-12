import React, { useState, useEffect, useCallback } from 'react';
import { X, User, Mail, Phone, Shield, Edit3, Eye, ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { dashboardAPI } from '../utils/authUtils';
import { useAuth } from '../contexts/AuthContext';

// Thumbnail with profile-image fallback
const MemoryThumb = ({ thumbnail, profileImage, title }: { thumbnail?: string | null; profileImage?: string | null; title: string }) => {
  const [src, setSrc] = React.useState<string | null>(thumbnail || profileImage || null);
  const [usedProfile, setUsedProfile] = React.useState(!thumbnail);

  React.useEffect(() => {
    if (thumbnail) { setSrc(thumbnail); setUsedProfile(false); }
    else if (profileImage) { setSrc(profileImage); setUsedProfile(true); }
    else { setSrc(null); }
  }, [thumbnail, profileImage]);

  const handleError = () => {
    if (!usedProfile && profileImage) { setSrc(profileImage); setUsedProfile(true); }
    else { setSrc(null); }
  };

  if (src) {
    return (
      <img
        src={src}
        alt={title}
        className="w-9 h-9 rounded-md object-cover flex-shrink-0 border border-gray-200"
        onError={handleError}
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-md bg-gradient-to-br from-[#6C60FF] to-purple-500 flex items-center justify-center flex-shrink-0">
      <span className="text-white text-[10px] font-semibold">{title?.charAt(0)?.toUpperCase()}</span>
    </div>
  );
};

interface EditCollaboratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  collaborator: {
    id: number;
    collaborator_id?: number; // Add collaborator_id field
    collaborator_type?: string;
    name: string;
    email: string;
    phone_number?: string;
    profile_image?: string;
    role: string;
    status: number;
    created_at: string;
    memory?: {
      id: number;
      title: string;
    };
    memories?: {
      access_id: number;
      memory_id: number;
      memory_title: string;
      cover_image?: string;
    }[];
  } | null;
  onSave: (collaboratorId: number, updates: {
    name: string;
    email: string;
    role: string;
    message?: string;
    collaborator_type?: string;
    memory_ids?: (string | number)[];
    phone_number?: string;
  }) => Promise<void>;
}

export default function EditCollaboratorModal({
  isOpen,
  onClose,
  collaborator,
  onSave
}: EditCollaboratorModalProps) {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedRole, setSelectedRole] = useState('view');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailChanged, setEmailChanged] = useState(false);
  // Partial admin state
  const [memories, setMemories] = useState<{ id: string; title: string; category: string; thumbnail?: string }[]>([]);
  const [availableCategories, setAvailableCategories] = useState<{ name: string; color: string }[]>([]);
  const [selectedPartialMemories, setSelectedPartialMemories] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Initialize form data when collaborator changes
  useEffect(() => {
    if (collaborator) {
      setFullName(collaborator.name || '');
      setEmailAddress(collaborator.email || '');
      setPhoneNumber(collaborator.phone_number || '');
      const userRole = collaborator.collaborator_role || collaborator.role || 'view';
      setSelectedRole(userRole.toLowerCase());
      setNotificationMessage('');
      setEmailChanged(false);
      setSelectedPartialMemories(new Set());
      setExpandedCategories(new Set());
    }
  }, [collaborator]);

  // Fetch memories, categories and pre-select assigned memories when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // Fetch all memories
    dashboardAPI.getExistingMemories().then((res: any) => {
      const raw = res?.data?.memories || res?.data?.data?.memories || res?.data?.data || res?.data;
      const list: any[] = Array.isArray(raw) ? raw : [];
      setMemories(list.map((m: any) => ({
        id: m.id?.toString() || m.memory_id?.toString(),
        title: m.title || m.name || 'Untitled',
        category: m.category?.name || m.category || 'Uncategorized',
        thumbnail: m.last_update_img || m.cover_image || m.thumbnail || null,
      })));
    }).catch(() => {});

    // Fetch categories
    dashboardAPI.getUserCategories().then((res: any) => {
      const responseData = res?.data?.data || res?.data;
      const cats: any[] = responseData?.categories || responseData || [];
      setAvailableCategories(
        (Array.isArray(cats) ? cats : [])
          .filter((c: any) => {
            const name = c.name || c;
            return name && name !== 'Shared With' && name !== 'Published';
          })
          .map((c: any) => ({ name: c.name || c, color: c.color || '#6C60FF' }))
      );
    }).catch(() => {});

    // If user is already a partial admin, pre-select their assigned memories from the response
    const currentRole = (collaborator?.collaborator_role || collaborator?.role || '').toLowerCase();
    if (currentRole === 'partial_admin' && Array.isArray(collaborator?.memories) && collaborator.memories.length > 0) {
      const preSelected = new Set<string>(
        collaborator.memories.map((m) => m.memory_id?.toString()).filter(Boolean)
      );
      setSelectedPartialMemories(preSelected);
    }
  }, [isOpen, collaborator]);

  // Handle email change detection
  const handleEmailChange = (newEmail: string) => {
    setEmailAddress(newEmail);
    setEmailChanged(newEmail !== (collaborator?.email || ''));
  };

  const handleSave = async () => {
    if (!collaborator) return;

    // Use collaborator_id if available, otherwise fall back to id
    const collaboratorIdToUse = collaborator.collaborator_id || collaborator.id;

    setIsLoading(true);
    try {
      await onSave(collaboratorIdToUse, {
        name: fullName,
        email: emailAddress,
        phone_number: phoneNumber || undefined,
        role: selectedRole,
        message: notificationMessage.trim() || undefined,
        collaborator_type: collaborator.collaborator_type,
        memory_ids: selectedRole === 'partial_admin' ? Array.from(selectedPartialMemories) : undefined
      });
      // Show success toast
      toast.success('Role updated successfully!');
      onClose();
    } catch (error: any) {
      console.error('Error saving collaborator role:', error);
      // Extract and show the actual error message from the API using toast
      const errorMessage = error?.message || error?.error || 'Failed to update collaborator role. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    if (collaborator) {
      setFullName(collaborator.name || '');
      setEmailAddress(collaborator.email || '');
      setSelectedRole(collaborator.role?.toLowerCase() || 'view');
      setNotificationMessage('');
      setEmailChanged(false);
    }
    onClose();
  };

  const generateInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!isOpen || !collaborator) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-[#6C60FF]" />
            <h2 className="text-lg font-semibold text-gray-900">Edit Role</h2>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Description */}
          <p className="text-sm text-gray-600">
            Update collaborator role and permissions. Name and email changes are not available through this interface.
          </p>

          {/* User Info Card */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                {collaborator.profile_image ? (
                  <AvatarImage src={collaborator.profile_image} alt={collaborator.name} />
                ) : null}
                <AvatarFallback className="bg-purple-100 text-purple-600">
                  {generateInitials(collaborator.name || collaborator.email || 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{collaborator.name}</span>
                  <Badge className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5">
                    {(() => {
                      const actualRole = collaborator.collaborator_role || collaborator.role || 'view';
                      const role = actualRole.toLowerCase();
                      if (role === 'collaborator') return 'CONTRIBUTOR';
                      if (role === 'user') return 'VIEW';
                      return actualRole.toUpperCase();
                    })()}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{collaborator.email}</p>
                <p className="text-xs text-gray-500">Added {formatDate(collaborator.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Full Name Field */}
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              Full Name
            </Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter full name"
              className="w-full bg-gray-100 border-gray-300 text-gray-500 h-11"
              disabled
              title="Name editing is not available through this interface"
            />
          </div>

          {/* Email Address Field */}
          <div className="space-y-2">
            <Label htmlFor="emailAddress" className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-500" />
              Email Address
            </Label>
            <Input
              id="emailAddress"
              type="email"
              value={emailAddress}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="Enter email address"
              className="w-full bg-gray-100 border-gray-300 text-gray-500 h-11"
              disabled
              title="Email editing is not available through this interface"
            />
            {emailChanged && (
              <p className="text-xs text-orange-600">
                Changing the email will send a notification to the new address.
              </p>
            )}
          </div>

          {/* Phone Number Field — only shown if user has a phone number */}
          {collaborator?.phone_number && (
            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-500" />
                Phone Number
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                readOnly
                placeholder="No phone number"
                className="w-full bg-gray-100 border-gray-300 text-gray-500 h-11"
                disabled
                title="Phone number editing is not available through this interface"
              />
            </div>
          )}

          {/* Role & Permissions */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-500" />
              Role & Permissions
            </Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-full bg-white border-gray-300 focus:border-gray-400 focus:ring-gray-200 h-11">
                <SelectValue placeholder="Select a role">
                  {selectedRole && (
                    <div className="flex items-center gap-2">
                      {selectedRole === 'admin' && <Shield className="w-4 h-4 text-red-600" />}
                      {selectedRole === 'view' && <Eye className="w-4 h-4 text-gray-600" />}
                      {selectedRole === 'collaborator' && <User className="w-4 h-4 text-blue-600" />}
                      {selectedRole === 'partial_admin' && <Shield className="w-4 h-4 text-orange-500" />}
                      <span className="capitalize font-medium">
                        {selectedRole === 'collaborator' ? 'Contributor' : selectedRole === 'partial_admin' ? 'Partial Admin' : selectedRole}
                      </span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 rounded-md shadow-lg z-[60] w-[var(--radix-select-trigger-width)]" position="popper" sideOffset={4}>
                <SelectItem value="admin" className="!bg-transparent hover:!bg-gray-50 focus:!bg-gray-50 data-[highlighted]:!bg-gray-50 data-[state=checked]:!bg-gray-50 focus:!text-gray-900 data-[highlighted]:!text-gray-900 !outline-none !border-0 cursor-pointer">
                  <div className="flex items-center gap-3 py-1">
                    <Shield className="w-4 h-4 text-red-600" />
                    <div>
                      <div className="font-medium text-gray-900">Admin</div>
                      <div className="text-xs text-gray-500">Full access and management</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="view" className="!bg-transparent hover:!bg-gray-50 focus:!bg-gray-50 data-[highlighted]:!bg-gray-50 data-[state=checked]:!bg-gray-50 focus:!text-gray-900 data-[highlighted]:!text-gray-900 !outline-none !border-0 cursor-pointer">
                  <div className="flex items-center gap-3 py-1">
                    <Eye className="w-4 h-4 text-gray-600" />
                    <div>
                      <div className="font-medium text-gray-900">View</div>
                      <div className="text-xs text-gray-500">Can see the campaign and its content</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="collaborator" className="!bg-transparent hover:!bg-gray-50 focus:!bg-gray-50 data-[highlighted]:!bg-gray-50 data-[state=checked]:!bg-gray-50 focus:!text-gray-900 data-[highlighted]:!text-gray-900 !outline-none !border-0 cursor-pointer">
                  <div className="flex items-center gap-3 py-1">
                    <User className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="font-medium text-gray-900">Contributor</div>
                      <div className="text-xs text-gray-500">Can add moments to the timeline but cannot edit existing content</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="partial_admin" className="!bg-transparent hover:!bg-gray-50 focus:!bg-gray-50 data-[highlighted]:!bg-gray-50 data-[state=checked]:!bg-gray-50 focus:!text-gray-900 data-[highlighted]:!text-gray-900 !outline-none !border-0 cursor-pointer">
                  <div className="flex items-center gap-3 py-1">
                    <Shield className="w-4 h-4 text-orange-500" />
                    <div>
                      <div className="font-medium text-gray-900">Partial Admin</div>
                      <div className="text-xs text-gray-500">Can only access selected categories and campaigns</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Categories checklist — shown only for Partial Admin */}
          {selectedRole === 'partial_admin' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-gray-500" />
                  Select Campaigns
                </Label>
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  {selectedPartialMemories.size} selected
                </span>
              </div>
              {availableCategories.length === 0 ? (
                <p className="text-xs text-gray-400">No categories available</p>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {availableCategories.map((cat) => {
                    const catMemories = memories.filter(m => m.category === cat.name);
                    const selectedInCat = catMemories.filter(m => selectedPartialMemories.has(m.id));
                    const allSelected = catMemories.length > 0 && selectedInCat.length === catMemories.length;
                    const someSelected = selectedInCat.length > 0 && !allSelected;
                    const isCatExpanded = expandedCategories.has(cat.name);
                    return (
                      <div key={cat.name} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${allSelected ? 'bg-[#6C60FF]/5' : someSelected ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'}`}>
                          <button
                            type="button"
                            onClick={() => setExpandedCategories(prev => {
                              const next = new Set(prev);
                              if (next.has(cat.name)) next.delete(cat.name); else next.add(cat.name);
                              return next;
                            })}
                            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                          >
                            {isCatExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
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
                        {isCatExpanded && (
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
                                      <MemoryThumb
                                        thumbnail={memory.thumbnail}
                                        profileImage={user?.avatar}
                                        title={memory.title}
                                      />
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

          {/* Notification Message */}
          <div className="space-y-2">
            <Label htmlFor="notificationMessage" className="text-sm font-medium text-gray-700">
              Notification Message (Optional)
            </Label>
            <Textarea
              id="notificationMessage"
              value={notificationMessage}
              onChange={(e) => setNotificationMessage(e.target.value)}
              placeholder="Add a message to include with the update notification..."
              className="min-h-[80px] resize-none bg-gray-50 border-gray-300 focus:border-gray-400 focus:ring-gray-200"
              maxLength={500}
            />
            <p className="text-xs text-gray-500">
              This message will be sent with the update notification email.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || !selectedRole || (selectedRole === 'partial_admin' && selectedPartialMemories.size === 0)}
            className="bg-[#6C60FF] hover:bg-[#5A4FE5] text-white flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}