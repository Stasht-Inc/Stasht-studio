import React, { useState } from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Users } from 'lucide-react';
import { InviteParams } from '../utils/inviteUtils';
import { userDisplayUtils, dashboardAPI } from '../utils/authUtils';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

// Local UserFallbackAvatar component
function UserFallbackAvatar({ 
  user, 
  size = 'w-8 h-8', 
  className = '' 
}: { 
  user?: { name?: string; avatar?: string; profile_color?: string };
  size?: string;
  className?: string;
}) {
  const initials = userDisplayUtils.generateInitials(user?.name || '');
  const profileColor = userDisplayUtils.formatProfileColor(user?.profile_color);
  
  // Use profile_color if available, otherwise use default gradient
  const backgroundStyle = profileColor 
    ? { backgroundColor: profileColor }
    : undefined;
  
  const fallbackClassName = profileColor 
    ? `${size} rounded-full text-white font-semibold flex items-center justify-center flex-shrink-0 ${className}`
    : `${size} rounded-full bg-gradient-to-br from-[#6C60FF] to-purple-600 text-white font-semibold flex items-center justify-center flex-shrink-0 ${className}`;
  
  if (user?.avatar) {
    // Show user profile image if available
    return (
      <div className={`${size} rounded-full overflow-hidden bg-gray-100 flex-shrink-0 shadow-sm ${className}`}>
        <img
          src={user.avatar}
          alt={user.name || 'User'}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to initials if profile image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
        <div 
          className={fallbackClassName}
          style={backgroundStyle}
          // Initially hidden, shown only if image fails
        >
          {initials}
        </div>
      </div>
    );
  }
  
  // Show initials with profile color if no profile image
  if (initials) {
    return (
      <div 
        className={fallbackClassName}
        style={backgroundStyle}
      >
        {initials}
      </div>
    );
  }
  
  // Fallback to generic user icon if no name available
  return (
    <div className={`${size} rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 ${className}`}>
      <Users className="w-4 h-4 text-gray-400" />
    </div>
  );
}

interface CollaboratorInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteParams: Partial<InviteParams>;
  onAccept: () => void;
  onReject: () => void;
}

export function CollaboratorInviteModal({
  isOpen,
  onClose,
  inviteParams,
  onAccept,
  onReject
}: CollaboratorInviteModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { logout } = useAuth();

  const handleReject = async () => {
    if (!inviteParams.memory_id) {
      toast.error('Invalid invitation data');
      return;
    }

    setIsLoading(true);
    try {
      console.log('=== REJECTING INVITATION ===');
      console.log('Memory ID:', inviteParams.memory_id);
      
      const response = await dashboardAPI.actionOnInvitation(inviteParams.memory_id, 0);
      
      if (response.success) {
        toast.success('Invitation rejected');
        onReject();
        onClose();
      } else {
        toast.error(response.error || 'Failed to reject invitation');
      }
    } catch (error) {
      console.error('Error rejecting invitation:', error);
      toast.error('Failed to reject invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!inviteParams.memory_id) {
      toast.error('Invalid invitation data');
      return;
    }

    setIsLoading(true);
    try {
      console.log('=== ACCEPTING INVITATION ===');
      console.log('Memory ID:', inviteParams.memory_id);
      
      const response = await dashboardAPI.actionOnInvitation(inviteParams.memory_id, 1);
      
      if (response.success) {
        toast.success('Invitation accepted! Welcome to the campaign.');
        onAccept();
        onClose();
      } else {
        const errorMsg = response.error || 'Failed to accept invitation';

        // If the logged-in user is the memory owner, they cannot be a collaborator.
        // Log them out so the correct collaborator can sign up / log in.
        if (errorMsg.toLowerCase().includes('owner')) {
          console.log('🚪 [CollaboratorInviteModal] Memory owner detected — logging out');
          toast.warning('Please sign up or log in with the invited account.');

          // Preserve invite params so the login/signup page can pre-fill details
          if (inviteParams) {
            localStorage.setItem('pendingInvite', JSON.stringify(inviteParams));
          }
          sessionStorage.setItem('just_logged_out_for_invite', 'true');

          onClose();
          logout();

          // Reload the page; because the user is no longer authenticated,
          // the app will show the login/signup page (with any invite URL params intact).
          setTimeout(() => {
            window.location.reload();
          }, 300);
          return;
        }

        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast.error('Failed to accept invitation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-white rounded-2xl shadow-2xl border-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="text-xl font-semibold text-gray-900 text-center">
            Collaboration Invitation
          </DialogTitle>
          <p className="text-gray-600 text-center mt-2">
            You've been invited as a collaborator!
          </p>
        </DialogHeader>
        
        <div className="px-6 py-6 space-y-6">
          {/* Inviter Information */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5">
            <div className="flex items-center space-x-4">
              <UserFallbackAvatar
                user={{
                  name: inviteParams.user_name || 'Unknown User',
                  avatar: inviteParams.profile_image,
                  profile_color: undefined
                }}
                size="w-14 h-14"
                className="text-base shadow-md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-lg">
                  {inviteParams.user_name || 'Unknown User'}
                </p>
                <p className="text-sm text-gray-600 truncate">
                  {inviteParams.email}
                </p>
              </div>
            </div>
            
            <div className="mt-4 text-sm text-gray-700">
              <span className="font-medium text-[#6C60FF]">Invited you to collaborate on:</span>
            </div>
          </div>

          {/* Memory Information */}
          <div className="bg-white border-2 border-gray-100 rounded-xl p-5 hover:border-[#6C60FF]/20 transition-colors">
            <div className="flex items-center space-x-4">
              {inviteParams.image_link && (
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 shadow-sm">
                  <img
                    src={inviteParams.image_link}
                    alt={inviteParams.title || 'Memory'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div 
                    className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs"
                    style={{ display: 'none' }}
                  >
                    No Image
                  </div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 text-lg truncate mb-1">
                  {inviteParams.title || 'Untitled Memory'}
                </h3>
                <p className="text-sm text-gray-500">
                  Memory ID: {inviteParams.memory_id}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 pb-6">
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={isLoading}
              size="sm"
              className="flex-1 flex-shrink-0 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors py-3 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                  Processing...
                </>
              ) : (
                'Reject'
              )}
            </Button>
            <Button
              onClick={handleAccept}
              disabled={isLoading}
              size="sm"
              className="flex-1 flex-shrink-0 bg-[#6C60FF] hover:bg-[#5A4FE5] text-white transition-colors py-3 shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Processing...
                </>
              ) : (
                'Accept'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}