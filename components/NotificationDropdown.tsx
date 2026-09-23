import React, { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { dashboardAPI } from '../utils/authUtils';
import mediaAPI from '../services/mediaAPI';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { useMemoriesRefresh } from '../hooks/useMemoriesRefresh';
import { useNotificationsRefreshProvider } from '../hooks/useNotificationsRefresh';
import { notificationStore } from '../utils/notificationStore';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { mapLimit } from '../utils/requestLimit';

export interface NotificationItem {
  id: string | number;
  type: 'invitation' | 'share' | 'comment' | 'mention' | 'like' | 'join' | 'moment' | 'full_access_request' | 'claim_request' | 'lead_message' | 'lead_unassigned' | 'lead_assigned';
  description: string; // Main notification text
  lead_id?: number; // For lead_message notifications — the conversation to open
  sender: {
    id: string | number;
    name: string;
    email?: string;
    profile_image?: string | null;
    profile_color?: string;
  };
  created_at: string;
  read?: boolean;
  image_id?: number; // For moment type notifications - directly on notification object
  post_id?: string | number; // For claim_request notifications
  is_memory?: number; // 0 = memory not associated, 1 = memory associated
  data?: {
    memory_id?: string;
    memory_title?: string;
    comment_id?: string;
    action_type?: string;
  };
}

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  onNotificationCountChange?: (count: number) => void;
  onMemorySelect?: (memoryId: string, options?: any) => void;
  onOpenConversation?: (leadId: number) => void;
  // lead_unassigned / lead_assigned (spec 2026-09-23) → open that lead in Leads.
  onOpenLead?: (leadId: number) => void;
  onMarkAllAsReadRef?: (fn: () => Promise<void>) => void;
}

export function NotificationDropdown({ isOpen, onClose, anchorRef, onNotificationCountChange, onMemorySelect, onOpenConversation, onOpenLead, onMarkAllAsReadRef }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { logout } = useAuth();

  // Hook to trigger memories refresh
  const triggerMemoriesRefresh = useMemoriesRefresh();

  // Register the refresh callback when component mounts
  const registerRefreshCallback = useNotificationsRefreshProvider(() => {
    console.log('🔔 Notifications refresh triggered');
    fetchNotifications();
  });

  useEffect(() => {
    const unregister = registerRefreshCallback();
    return unregister;
  }, [registerRefreshCallback]);

  // Register the mark all as read function with parent
  useEffect(() => {
    if (onMarkAllAsReadRef) {
      onMarkAllAsReadRef(markAllAsReadOnClose);
    }
  }, [onMarkAllAsReadRef, notifications]);

  // Mark all notifications as read when dropdown closes
  const markAllAsReadOnClose = async () => {
    console.log('🔔 Dropdown closing - marking all unread notifications as read...');

    const unreadNotifications = notifications.filter((n: any) =>
      n.is_read === false || n.is_read === 0 || n.is_read === undefined || n.is_read === null
    );

    if (unreadNotifications.length > 0) {
      console.log('🔔 Marking', unreadNotifications.length, 'notifications as read');

      // Mark all as read, concurrency-capped — a user with a long unread list
      // would otherwise fire one POST per notification in the same tick.
      await mapLimit(unreadNotifications, async (notification: any) => {
        try {
          await dashboardAPI.markNotificationAsRead(notification.id.toString());
          console.log(`✅ Marked notification ${notification.id} as read on close`);
          return notification.id;
        } catch (error) {
          console.error(`❌ Failed to mark notification ${notification.id} as read:`, error);
          return null;
        }
      });

      // Update local state to mark all as read
      const updatedNotifications = notifications.map((n: any) => ({
        ...n,
        is_read: true,
        read: true
      }));

      setNotifications(updatedNotifications);
      notificationStore.setNotifications(updatedNotifications);

      // Update count to 0 since all are now read
      console.log('🔔 All notifications marked as read on close, updating count to 0');
      if (onNotificationCountChange) {
        onNotificationCountChange(0);
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        markAllAsReadOnClose();
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef, notifications, onNotificationCountChange]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await dashboardAPI.getUserNotifications();
      console.log('Notifications API response:', response);

      if (response.success && response.data) {
        // Handle different possible response structures
        let notificationsData = response.data.notifications || response.data.data || response.data;

        console.log('🔔 Notifications data received:', notificationsData);

        if (Array.isArray(notificationsData)) {
          // Process notifications - detect type from description first, preserve integer for invitations
          const processedNotifications = notificationsData.map((notification: any) => {
            const desc = notification.description?.toLowerCase() || '';

            // Lead-message notifications keep their type (the body may contain
            // words like "comment"/"like" that would otherwise mis-detect them).
            if (notification.type === 'lead_message' || notification.type === 'lead_unassigned' || notification.type === 'lead_assigned') {
              return { ...notification, originalType: notification.type };
            }

            // First, check if type is explicitly "moment"
            if (notification.type === 'moment') {
              console.log(`🔔 Found moment notification:`, {
                description: notification.description?.substring(0, 50),
                image_id: notification.image_id,
                is_read: notification.is_read
              });
              return {
                ...notification,
                type: 'moment',
                originalType: notification.type
              };
            }

            // Then, try to detect specific notification types from description
            // This takes priority over integer type detection
            if (desc.includes('comment')) {
              console.log(`🔔 Found comment notification:`, {
                description: notification.description?.substring(0, 50),
                original_type: notification.type,
                is_read: notification.is_read
              });
              return {
                ...notification,
                type: 'comment',
                originalType: notification.type // Preserve original type
              };
            } else if (desc.includes('mention') || desc.includes('@')) {
              return {
                ...notification,
                type: 'mention',
                originalType: notification.type
              };
            } else if (desc.includes('joined') || desc.includes('join')) {
              return {
                ...notification,
                type: 'join',
                originalType: notification.type
              };
            } else if (desc.includes('like')) {
              return {
                ...notification,
                type: 'like',
                originalType: notification.type
              };
            } else if (desc.includes('full access') || desc.includes('access request') || notification.type === 'full_access_request') {
              console.log(`🔔 Found full access request notification:`, {
                description: notification.description?.substring(0, 50),
                original_type: notification.type,
                is_read: notification.is_read
              });
              return {
                ...notification,
                type: 'full_access_request',
                originalType: notification.type
              };
            } else if (desc.includes('claim') || desc.includes('ownership') || notification.type === 'claim_request') {
              console.log(`🔔 Found claim request notification:`, {
                description: notification.description?.substring(0, 50),
                original_type: notification.type,
                post_id: notification.post_id,
                is_read: notification.is_read
              });
              return {
                ...notification,
                type: 'claim_request',
                originalType: notification.type
              };
            }

            // If type is an integer and not a comment/mention/like/join, it's an invitation
            if (!isNaN(Number(notification.type)) && Number.isInteger(Number(notification.type))) {
              console.log(`🔔 Found invitation notification with integer type ${notification.type}:`, {
                description: notification.description?.substring(0, 50),
                accept_reject: notification.accept_reject,
                is_read: notification.is_read
              });
              return {
                ...notification,
                type: notification.type, // Keep the integer type for invitations
              };
            }

            // For other types, use the provided type or default to general
            let displayType = notification.type || 'general';

            return {
              ...notification,
              type: displayType
            };
          });

          setNotifications(processedNotifications);
          console.log('🔔 Set notifications state:', processedNotifications);

          // Update global notification store for other components
          notificationStore.setNotifications(processedNotifications);

          // Calculate unread notifications
          const unreadNotifications = processedNotifications.filter((n: any) =>
            n.is_read === false || n.is_read === 0 || n.is_read === undefined || n.is_read === null
          );

          console.log('🔔 Unread notification count:', unreadNotifications.length);
          console.log('🔔 All notifications with is_read status:', processedNotifications.map(n => ({ id: n.id, is_read: (n as any).is_read, description: n.description?.substring(0, 50) })));

          // Update unread count (but don't auto-mark as read)
          if (onNotificationCountChange) {
            onNotificationCountChange(unreadNotifications.length);
          }
        } else {
          console.warn('Unexpected notifications data structure:', response.data);
          setNotifications([]);
          if (onNotificationCountChange) {
            onNotificationCountChange(0);
          }
        }
      } else {
        console.error('Failed to fetch notifications:', response.error);
        setNotifications([]);
        if (onNotificationCountChange) {
          onNotificationCountChange(0);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
      if (onNotificationCountChange) {
        onNotificationCountChange(0);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationAction = async (notificationId: string, action: 'accept' | 'deny', notification?: NotificationItem) => {
    try {
      console.log(`${action} notification:`, notificationId);
      console.log('Notification details:', notification);
      console.log('Notification type field:', notification?.type);

      // IMMEDIATELY mark the notification as "actioned" to hide buttons
      setNotifications(prev => {
        console.log('🔄 Setting actioned=true for notification:', notificationId);
        const updated = prev.map(n => {
          if ((n.id || '').toString() === notificationId) {
            const updatedNotification = { ...n, actioned: true } as any;
            console.log(`🔄 Updated notification ${notificationId}:`, updatedNotification);
            return updatedNotification;
          }
          return n;
        });
        console.log('🔄 All notifications after actioned update:', updated.map(n => ({ id: n.id, actioned: (n as any).actioned, description: n.description?.substring(0, 30) })));
        return updated;
      });

      let response;

      // Check if this is a "moment" type notification (moment approval)
      const isMomentType = notification && notification.type === 'moment';

      // Check if this is an invitation type (integer type contains memory_id)
      const isInvitationType = notification && !isNaN(Number(notification.type)) && Number.isInteger(Number(notification.type));

      // Check if this is a claim request type
      const isClaimRequestType = notification && (notification.type === 'claim_request' ||
                                  notification.description?.toLowerCase().includes('claim') ||
                                  notification.description?.toLowerCase().includes('ownership'));

      if (isClaimRequestType) {
        // For claim request notifications, use the accept-reject-claim API
        const postId = (notification as any).post_id || (notification as any).image_id;

        console.log(`Using memory-images/accept-reject-claim API for post ${postId} with is_accept=${action === 'accept' ? 1 : 0}`);

        // Get API base URL
        const getApiBaseUrl = () => {
          if (import.meta.env.VITE_API_BASE_URL) {
            return import.meta.env.VITE_API_BASE_URL;
          }
          if (import.meta.env.DEV) {
            return '/api/react';
          }
          return `${window.location.origin}/api/react`;
        };

        const token = localStorage.getItem('stasht_token');
        const apiBaseUrl = getApiBaseUrl();
        const apiUrl = `${apiBaseUrl}/memory-images/accept-reject-claim`;

        console.log('API URL:', apiUrl);
        console.log('Request body:', { post_id: postId, is_accept: action === 'accept' ? 1 : 0, notification_id: notificationId });

        const fetchResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            post_id: parseInt(postId),
            is_accept: action === 'accept' ? 1 : 0,
            notification_id: parseInt(notificationId)
          })
        });

        response = await fetchResponse.json();

        // Normalize response format
        if (fetchResponse.ok && response.success) {
          response = { success: true, message: response.message };
        } else {
          response = { success: false, error: response.message || response.error };
        }
      } else if (isMomentType) {
        // For moment notifications, use the approve-image/deny-image API
        const imageId = (notification as any).image_id;

        console.log(`Using memory-images/${action === 'accept' ? 'approve' : 'deny'}-image API for image ${imageId}`);

        // Get API base URL
        const getApiBaseUrl = () => {
          if (import.meta.env.VITE_API_BASE_URL) {
            return import.meta.env.VITE_API_BASE_URL;
          }
          if (import.meta.env.DEV) {
            return '/api/react';
          }
          return `${window.location.origin}/api/react`;
        };

        const token = localStorage.getItem('stasht_token');
        const apiBaseUrl = getApiBaseUrl();
        const apiUrl = action === 'accept'
          ? `${apiBaseUrl}/memory-images/approve-image`
          : `${apiBaseUrl}/memory-images/deny-image`;

        console.log('API URL:', apiUrl);

        const fetchResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ image_id: imageId })
        });

        response = await fetchResponse.json();

        // Normalize response format
        if (fetchResponse.ok && response.success) {
          response = { success: true, message: response.message };
        } else {
          response = { success: false, error: response.message || response.error };
        }
      } else if (isInvitationType) {
        // For invitation notifications, use the memory invitation API
        const memoryId = notification.type?.toString();
        const status = action === 'accept' ? 1 : 0;

        console.log(`Using memories/invitation/action API for memory ${memoryId} with status ${status} and notification_id ${notificationId}`);
        response = await dashboardAPI.actionOnInvitation(memoryId, status, notificationId);
      } else {
        // Use the generic notification accept/decline API for other notifications
        console.log(`Using generic notification API for ${action}`);
        if (action === 'accept') {
          response = await dashboardAPI.acceptNotification(notificationId);
        } else {
          response = await dashboardAPI.declineNotification(notificationId);
        }
      }
      
      // Check for success based on actual API response structure
      // Response format: {"status":1,"message":"Invitation accepted successfully"} or {"status":0,"message":"Invitation rejected"}
      const isSuccessful = response.success || 
                          (response.data && (response.data.status === 1 || response.data.status === 0)) ||
                          (response.status === 1 || response.status === 0) ||
                          (response.message && (response.message.includes('accepted') || response.message.includes('rejected')));
      
      console.log('🔔 API Response:', response);
      console.log('🔔 Full response object:', JSON.stringify(response, null, 2));
      console.log('🔔 Is successful?', isSuccessful);
      console.log('🔔 Response.data:', response.data);
      console.log('🔔 Response.status:', response.status);
      console.log('🔔 Response.message:', response.message);
      
      if (isSuccessful) {
        if (action === 'accept') {
          // Trigger memories refresh when invitation is accepted
          console.log('🔄 Invitation accepted - triggering memories refresh');
          triggerMemoriesRefresh();
          
          // Remove accepted invitations from the list completely
          setNotifications(prev => {
            const updated = prev.filter(n => (n.id || '').toString() !== notificationId);
            // Update the count after removing the notification - only count is_read = false
            const unreadCount = updated.filter((n: any) => 
              n.is_read === false || n.is_read === 0 || n.is_read === undefined || n.is_read === null
            ).length;
            if (onNotificationCountChange) {
              onNotificationCountChange(unreadCount);
            }
            console.log(`✅ Notification ${action}ed successfully, new count: ${unreadCount}`);
            return updated;
          });
        } else if (action === 'deny') {
          // Keep rejected invitations but mark them as handled and read
          setNotifications(prev => {
            const updated = prev.map(n => {
              if ((n.id || '').toString() === notificationId) {
                const updatedNotification = { ...n, actioned: true, is_read: true, read: true, status: 'rejected' } as any;
                console.log(`🔄 Updated rejected notification ${notificationId}:`, updatedNotification);
                return updatedNotification;
              }
              return n;
            });
            // Update the count after marking as read - only count is_read = false
            const unreadCount = updated.filter((n: any) => 
              n.is_read === false || n.is_read === 0 || n.is_read === undefined || n.is_read === null
            ).length;
            if (onNotificationCountChange) {
              onNotificationCountChange(unreadCount);
            }
            console.log(`✅ Notification ${action}ed successfully, new count: ${unreadCount}`);
            return updated;
          });
        }
      } else {
        console.error(`❌ Failed to ${action} notification:`, response.error);
        console.error('Full response:', response);

        // If backend says the logged-in user is the memory owner, they cannot
        // be added as a collaborator. Log them out so the right person can sign in.
        const errorMsg = (response.error || response.message || '') as string;
        if (action === 'accept' && errorMsg.toLowerCase().includes('owner')) {
          console.log('🚪 [NotificationDropdown] Memory owner detected — logging out');
          toast.warning('Please sign up or log in with the invited account.');
          sessionStorage.setItem('just_logged_out_for_invite', 'true');
          onClose();
          logout();
          setTimeout(() => {
            window.location.reload();
          }, 300);
          return;
        }

        // Check if this looks like it might actually be successful based on message content
        const mightBeSuccessful = response.message &&
                                 (response.message.includes('accepted') ||
                                  response.message.includes('rejected') ||
                                  response.message.includes('successfully'));

        if (mightBeSuccessful) {
          console.log('🔔 Treating as successful based on message content');
          // Keep the buttons hidden and handle as success
          if (action === 'accept') {
            // Trigger memories refresh for accepted invitations (fallback case)
            console.log('🔄 Invitation accepted (fallback) - triggering memories refresh');
            triggerMemoriesRefresh();

            // Remove accepted invitations
            setNotifications(prev => prev.filter(n => (n.id || '').toString() !== notificationId));
          } else {
            // Mark rejected invitations as handled
            setNotifications(prev => prev.map(n =>
              (n.id || '').toString() === notificationId
                ? { ...n, actioned: true, is_read: true, read: true, status: 'rejected' } as any
                : n
            ));
          }
        } else {
          // DON'T restore buttons - once clicked, they should stay hidden
          console.log('🔄 Keeping buttons hidden even though API response was unclear');
        }
      }
    } catch (error) {
      // Don't restore buttons even on error - once clicked, they should stay hidden
      console.error(`Error ${action}ing notification:`, error);
      console.log('🔄 Keeping buttons hidden despite error');
      // You could show a toast error here
    }
  };

  const handleNotificationClick = async (notificationId: string | number, isRead?: boolean | number, notification?: NotificationItem) => {
    // Don't mark as read on click - only mark as read when closing dropdown
    console.log('🔔 Notification clicked:', notificationId, 'Will be marked as read on close');

    // Lead-message notification → open the My Conversations thread for this lead.
    // New-lead / assigned-to-you notification → open that lead in Leads.
    if (notification?.type === 'lead_unassigned' || notification?.type === 'lead_assigned') {
      const leadId = (notification as any).lead_id;
      if (leadId != null && onOpenLead) {
        onOpenLead(Number(leadId));
      }
      onClose();
      return;
    }

    if (notification?.type === 'lead_message') {
      const leadId = (notification as any).lead_id;
      if (leadId != null && onOpenConversation) {
        onOpenConversation(Number(leadId));
      }
      onClose();
      return;
    }

    // Navigate based on notification type and data
    console.log('🔔 After marking as read - checking navigation');
    console.log('🔔 Notification object:', notification);
    console.log('🔔 onMemorySelect available:', !!onMemorySelect);

    if (notification && onMemorySelect) {
      console.log('🔔 Starting navigation for notification:', notification);
      console.log('🔔 Notification data:', notification.data);
      console.log('🔔 Notification type:', notification.type);

      // Get memory ID from notification (check multiple possible locations)
      // Priority: notification.memory_id (root level) > notification.data.memory_id > notification.type (if integer)
      let memoryId = (notification as any).memory_id?.toString() ||
                     notification.data?.memory_id ||
                     (notification.type && !isNaN(Number(notification.type)) ? notification.type.toString() : null);

      console.log('🔔 Checking memory_id sources:');
      console.log('  - Root level memory_id:', (notification as any).memory_id);
      console.log('  - Data.memory_id:', notification.data?.memory_id);
      console.log('  - Type as integer:', notification.type);
      console.log('  - Final memoryId:', memoryId);

      // If no memory_id found, try to get it from image_id for moment notifications
      if (!memoryId && notification.type === 'moment' && (notification as any).image_id) {
        console.log('🔔 Moment notification with image_id:', (notification as any).image_id);
        console.log('🔔 Fetching memory_id from image comments API...');

        try {
          // Fetch the image comments which includes memory_id
          const imageId = (notification as any).image_id;
          const response = await mediaAPI.getComments(imageId);

          console.log('🔔 Image comments API response:', response);

          // Extract memory_id from the response
          if (response && response.media && response.media.memory_id) {
            memoryId = response.media.memory_id.toString();
            console.log('🔔 Found memory_id from image API:', memoryId);
          } else if (response && response.data && response.data.media && response.data.media.memory_id) {
            memoryId = response.data.media.memory_id.toString();
            console.log('🔔 Found memory_id from nested data:', memoryId);
          } else {
            console.log('🔔 Could not find memory_id in API response');
            return; // Exit if we can't find memory_id
          }
        } catch (error) {
          console.error('🔔 Error fetching memory_id from image API:', error);
          return; // Exit on error
        }
      }

      console.log('🔔 Extracted memory ID:', memoryId);
      console.log('🔔 About to check if memoryId exists...');

      // Check if this is an invitation notification - if so, just mark as read and don't navigate
      const desc = notification.description?.toLowerCase() || '';
      const isInvitationNotification = notification.type === 'invitation' ||
                                       notification.type === 'invite' ||
                                       desc.includes('invited you to collaborate') ||
                                       desc.includes('invited you to') ||
                                       desc.includes('wants to share this with you');

      if (isInvitationNotification) {
        console.log('🔔 Invitation notification - only marking as read, not navigating');
        onClose(); // Just close the dropdown
        return; // Don't navigate anywhere
      }

      if (memoryId) {
        console.log('🔔 Memory ID found:', memoryId);
        console.log('🔔 Notification is_memory value:', (notification as any).is_memory);

        // Check if memory is still associated with user (is_memory = 1)
        // If is_memory = 0, memory is not associated anymore
        if ((notification as any).is_memory === 0) {
          console.log('🔔 Memory is NOT associated (is_memory=0) - showing error message');
          toast.error('Campaign is not associated with your account now', {
            duration: 4000,
            description: 'This campaign may have been deleted or you no longer have access to it.'
          });
          return; // Exit without navigating
        }

        console.log('🔔 Memory is associated (is_memory=1) - proceeding with navigation');

        // Navigate based on notification type
        const isCommentNotification = notification.type === 'comment' || desc.includes('comment');
        const isMomentNotification = notification.type === 'moment';
        const isMentionNotification = notification.type === 'mention' || desc.includes('mentioned you');
        const isFullAccessRequest = notification.type === 'full_access_request' || desc.includes('full access') || desc.includes('access request');

        console.log('🔔 Is comment notification?', isCommentNotification, 'Type:', notification.type, 'Desc includes comment:', desc.includes('comment'));
        console.log('🔔 Is moment notification?', isMomentNotification);
        console.log('🔔 Is mention notification?', isMentionNotification);
        console.log('🔔 Is full access request?', isFullAccessRequest);

        if (isCommentNotification) {
          // For comments, navigate to memory and open image modal with comments
          const imageId = (notification as any).image_id || (notification as any).media_id || notification.data?.media_id;
          const commentId = (notification as any).comment_id || notification.data?.comment_id;

          console.log('🔔 Comment notification - full notification object:', notification);
          console.log('🔔 Memory ID:', memoryId);
          console.log('🔔 Image ID from notification:', imageId);
          console.log('🔔 Comment ID:', commentId);

          // If we have imageId, open the image modal
          if (imageId) {
            console.log('🔔 Calling onMemorySelect with image modal:', memoryId, { openImageModal: true, imageId, commentId });
            onMemorySelect(memoryId, { openImageModal: true, imageId, commentId });
          } else {
            // If no imageId, just navigate to the memory and open comments tab
            console.log('🔔 No imageId found, just opening memory with comments tab');
            onMemorySelect(memoryId, { openComments: true, commentId });
          }
          onClose(); // Close the dropdown after navigation
        } else if (isMentionNotification) {
          // For mention notifications, navigate to memory and open the specific post with image modal
          const imageId = (notification as any).image_id || (notification as any).post_id || (notification as any).media_id || notification.data?.image_id || notification.data?.post_id || notification.data?.media_id;

          console.log('🔔 Mention notification - full notification object:', notification);
          console.log('🔔 Memory ID:', memoryId);
          console.log('🔔 Image/Post ID from notification:', imageId);

          // If we have imageId/postId, open the image modal
          if (imageId) {
            console.log('🔔 Calling onMemorySelect with image modal for mention:', memoryId, { openImageModal: true, imageId });
            onMemorySelect(memoryId, { openImageModal: true, imageId });
          } else {
            // If no imageId, just navigate to the memory
            console.log('🔔 No imageId found for mention, just opening memory');
            onMemorySelect(memoryId);
          }
          onClose(); // Close the dropdown after navigation
        } else if (isMomentNotification) {
          // For moment notifications, navigate to memory and open Moderation tab
          console.log('🔔 Moment notification - opening Moderation tab');
          onMemorySelect(memoryId, { openModerationTab: true });
          onClose();
        } else if (isFullAccessRequest) {
          // For full access request notifications, navigate to memory and open Collaborators tab
          console.log('🔔 Full access request notification - opening Collaborators tab');
          onMemorySelect(memoryId, { openCollaboratorsTab: true });
          onClose();
        } else {
          // For all other notification types (invitation, collaboration, like, join, etc.)
          // Just navigate to the memory
          console.log('🔔 Navigating to memory for notification type:', notification.type);
          onMemorySelect(memoryId);
          onClose();
        }
      } else {
        console.log('🔔 No memory ID found - cannot navigate');
      }
    } else {
      if (!notification) {
        console.log('🔔 No notification object provided');
      }
      if (!onMemorySelect) {
        console.log('🔔 onMemorySelect function not provided');
      }
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    
    const diffInDays = Math.floor(diffInSeconds / 86400);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)}mo ago`;
    return `${Math.floor(diffInDays / 365)}y ago`;
  };

  const generateInitials = (name: string): string => {
    if (!name) return 'U';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatProfileColor = (profileColor?: string): string => {
    if (!profileColor) return '';
    if (profileColor.match(/^[0-9a-fA-F]{6}$/)) {
      return `#${profileColor}`;
    }
    if (profileColor.startsWith('#')) {
      return profileColor;
    }
    return '';
  };

  // Generate a color based on name for consistent avatar colors
  const generateAvatarColor = (name: string): string => {
    const colors = [
      '#E74C3C', // Dark Red
      '#27AE60', // Dark Green
      '#3498DB', // Dark Blue
      '#9B59B6', // Dark Purple
      '#F39C12', // Dark Orange
      '#1ABC9C', // Dark Teal
      '#2C3E50', // Dark Blue Gray
      '#8E44AD', // Dark Violet
      '#16A085', // Dark Turquoise
      '#2980B9', // Dark Cerulean
      '#C0392B', // Dark Crimson
      '#D35400', // Dark Pumpkin
      '#7F8C8D', // Dark Gray
      '#34495E', // Dark Slate
      '#8B4513'  // Dark Saddle Brown
    ];
    
    if (!name) return colors[0];
    
    // Create a simple hash from the name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Use the hash to pick a color
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const getNotificationIcon = (type: string): string => {
    switch (type) {
      case 'invitation': return '👋';
      case 'share': return '📤';
      case 'comment': return '💬';
      case 'mention': return '@';
      case 'like': return '❤️';
      case 'join': return '📁';
      case 'claim_request': return '🏷️';
      default: return '🔔';
    }
  };

  // Get notification badge icon and color based on type
  const getNotificationBadge = (type: string) => {
    switch (type) {
      case 'comment':
        return {
          icon: (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.96605 6.64302C2.01965 6.77825 2.03159 6.92642 2.00032 7.06849L1.61204 8.26797C1.59952 8.3288 1.60276 8.39181 1.62143 8.45104C1.64011 8.51027 1.6736 8.56375 1.71874 8.6064C1.76387 8.64905 1.81916 8.67947 1.87935 8.69477C1.93954 8.71006 2.00264 8.70973 2.06266 8.6938L3.30698 8.32995C3.44105 8.30335 3.57988 8.31498 3.70766 8.36349C4.48619 8.72706 5.36811 8.80398 6.19782 8.58068C7.02753 8.35738 7.75172 7.8482 8.2426 7.143C8.73349 6.43779 8.95953 5.58187 8.88084 4.72624C8.80216 3.87061 8.4238 3.07027 7.81253 2.46642C7.20126 1.86257 6.39635 1.49402 5.53983 1.42579C4.68331 1.35756 3.83021 1.59404 3.13105 2.09351C2.43189 2.59297 1.9316 3.32332 1.71846 4.1557C1.50531 4.98808 1.59299 5.86899 1.96605 6.64302Z" stroke="#F54900" strokeWidth="0.727155" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ),
          color: '#FFFFFF' // White background for custom comment icon
        };
      case 'mention':
        return {
          icon: (
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2C5.589 2 2 5.589 2 10s3.589 8 8 8c1.111 0 2-.889 2-2 0-.552-.224-1.056-.586-1.414-.362-.362-.866-.586-1.414-.586-.256 0-.512.049-.756.146C8.537 14.693 8 15.289 8 16c0 .552-.448 1-1 1s-1-.448-1-1c0-1.654 1.346-3 3-3 .827 0 1.5-.673 1.5-1.5S9.827 11 9 11s-1.5-.673-1.5-1.5S8.173 8 9 8s1.5.673 1.5 1.5.673 1.5 1.5 1.5 1.5.673 1.5 1.5-.673 1.5-1.5 1.5c-.827 0-1.5.673-1.5 1.5s.673 1.5 1.5 1.5c2.481 0 4.5-2.019 4.5-4.5S12.481 5.5 10 5.5 5.5 7.519 5.5 10s2.019 4.5 4.5 4.5"/>
              <text x="10" y="14" textAnchor="middle" className="text-xs font-bold fill-white">@</text>
            </svg>
          ),
          color: '#8B5CF6' // Purple for mentions
        };
      case 'join':
        return {
          icon: (
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
            </svg>
          ),
          color: '#F59E0B' // Orange for joining
        };
      case 'invitation':
      case 'share':
        return {
          icon: (
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
            </svg>
          ),
          color: '#3B82F6' // Blue for invitations/sharing
        };
      case 'like':
        return {
          icon: (
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/>
            </svg>
          ),
          color: '#EF4444' // Red for likes
        };
      case 'moment':
        return {
          icon: (
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
            </svg>
          ),
          color: '#8B5CF6' // Purple for moment
        };
      case 'full_access_request':
        return {
          icon: (
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
            </svg>
          ),
          color: '#F59E0B' // Orange for access request
        };
      case 'claim_request':
        return {
          icon: (
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
            </svg>
          ),
          color: '#10B981' // Green for claim requests
        };
      case 'lead_message':
      case 'lead_unassigned':
      case 'lead_assigned':
        return {
          icon: (
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd"/>
            </svg>
          ),
          color: '#6C60FF' // Purple for lead messages
        };
      default:
        return {
          icon: (
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
          ),
          color: '#6B7280' // Gray for default
        };
    }
  };

  const renderNotificationContent = (notification: NotificationItem & { isInvitation?: boolean; actioned?: boolean }) => {
    // Check notification type and description to determine if it's a comment
    const description = notification.description?.toLowerCase() || '';
    const isCommentType = notification.type === 'comment' || description.includes('comment');
    const isMentionType = notification.type === 'mention' || description.includes('mention') || description.includes('@');
    const isLikeType = notification.type === 'like' || description.includes('like');
    const isJoinType = notification.type === 'join' || description.includes('joined') || description.includes('join');
    const isMomentType = notification.type === 'moment'; // Check for moment type

    // Check if notification type is an integer (invitation type)
    const isInvitationType = !isNaN(Number(notification.type)) && Number.isInteger(Number(notification.type));
    const isActioned = (notification as any).actioned === true;
    const acceptRejectField = (notification as any).accept_reject;

    // Hide buttons if accept_reject field is 1 (already handled)
    const isAlreadyHandledByAPI = acceptRejectField === 1;

    // Show buttons ONLY if:
    // 1. (Type is integer (invitation) OR Type is "moment" OR Type is "claim_request") AND
    // 2. Not a comment/mention/like/join notification AND
    // 3. Not already actioned AND
    // 4. Not already handled by API
    const isClaimRequestType = notification.type === 'claim_request' || description.includes('claim') || description.includes('ownership');
    const needsActionButtons = (isInvitationType || isMomentType || isClaimRequestType) &&
                               !isCommentType &&
                               !isMentionType &&
                               !isLikeType &&
                               !isJoinType &&
                               !isActioned &&
                               !isAlreadyHandledByAPI;

    console.log(`🔍 Button visibility check for ${notification.id}:`, {
      type: notification.type,
      isInvitationType,
      isMomentType,
      isCommentType,
      isMentionType,
      isLikeType,
      isJoinType,
      isActioned,
      accept_reject: acceptRejectField,
      isAlreadyHandledByAPI,
      needsActionButtons,
      description: notification.description?.substring(0, 50)
    });

    // Check if notification is read for styling
    const isRead = (notification as any).is_read === true || (notification as any).is_read === 1 ||
                   notification.read === true || notification.read === 1;

    // Determine display type for badge
    let badgeType = notification.type;
    if (isCommentType) {
      badgeType = 'comment';
    } else if (isMentionType) {
      badgeType = 'mention';
    } else if (isLikeType) {
      badgeType = 'like';
    } else if (isJoinType) {
      badgeType = 'join';
    } else if (isMomentType) {
      badgeType = 'moment'; // Use moment badge for moment approval notifications
    } else if (notification.type === 'claim_request' || description.includes('claim') || description.includes('ownership')) {
      badgeType = 'claim_request'; // Use claim request badge
    } else if (notification.type === 'full_access_request' || description.includes('full access') || description.includes('access request')) {
      badgeType = 'full_access_request'; // Use access request badge
    } else if (isInvitationType) {
      badgeType = 'share'; // Use share badge for invitations (when type is integer)
    }
    
    return (
      <div className={`flex items-start gap-3 ${isRead ? 'opacity-60' : ''}`}>
        <div className="relative flex-shrink-0">
          <Avatar className="w-10 h-10">
            {notification.sender?.profile_image ? (
              <AvatarImage src={notification.sender.profile_image} alt={notification.sender.name} />
            ) : null}
            <AvatarFallback 
              className="text-white font-medium text-sm"
              style={{
                backgroundColor: notification.sender?.profile_color 
                  ? formatProfileColor(notification.sender.profile_color)
                  : generateAvatarColor(notification.sender?.name || 'User')
              }}
            >
              {generateInitials(notification.sender?.name || 'User')}
            </AvatarFallback>
          </Avatar>
          
          {/* Small notification icon overlay - always show for specific notification types */}
          {(() => {
            const badge = getNotificationBadge(badgeType);
            // Show badge for all notifications with recognized types
            if (badgeType === 'invitation' || badgeType === 'share' ||
                badgeType === 'comment' || badgeType === 'mention' ||
                badgeType === 'join' || badgeType === 'like' ||
                badgeType === 'moment' || badgeType === 'full_access_request' ||
                badgeType === 'lead_message' || badgeType === 'lead_unassigned' || badgeType === 'lead_assigned' ||
                (notification as any).isInvitation) {
              return (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full border border-gray-200 flex items-center justify-center shadow-sm">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: badge.color }}
                  >
                    {badge.icon}
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Main notification text */}
          {(() => {
            // Parse comment notifications specially
            if (isCommentType && notification.description) {
              // Example: "ppp11 has commented on the memory 'qwerty test'. Comment: hi lady"
              // Should become: "ppp11" (bold) "commented on" (light) "'qwerty test'" (bold) + newline + "hi lady" (normal)

              const desc = notification.description;

              // Try to extract: Name + "commented on" + Memory Title + Comment text
              // Pattern 1: "Name has commented on the memory 'Title'. Comment: Text"
              let match = desc.match(/^(.+?)\s+has commented on the memory\s+'(.+?)'\.\s*Comment:\s*(.+)$/);

              if (!match) {
                // Pattern 2: "Name commented on 'Title'"
                match = desc.match(/^(.+?)\s+commented on\s+"(.+?)"$/);
              }

              if (match && match.length >= 3) {
                const senderName = match[1];
                const memoryTitle = match[2];
                const commentText = match[3] || '';

                return (
                  <>
                    <p className={`text-sm leading-relaxed mb-2 ${isRead ? 'text-gray-500' : 'text-gray-900'}`}>
                      <span className="font-semibold">{senderName}</span>
                      <span className="text-gray-500"> commented on </span>
                      <span className="font-semibold">"{memoryTitle}"</span>
                    </p>
                    {commentText && (
                      <p className={`text-sm leading-relaxed mb-2 ${isRead ? 'text-gray-400' : 'text-gray-600'}`}>
                        {commentText}
                      </p>
                    )}
                  </>
                );
              }
            }

            // Default rendering for non-comment or unparseable notifications
            return (
              <p className={`text-sm leading-relaxed mb-2 ${isRead ? 'text-gray-500' : 'text-gray-900'}`}>
                {notification.description}
              </p>
            );
          })()}

          {/* Image and description for moment type notifications */}
          {isMomentType && (notification as any).image_link && (
            <div className="mt-2 mb-2">
              <img
                src={(notification as any).image_link}
                alt="Moment"
                className="w-full h-32 object-cover rounded-lg"
              />
              {(notification as any).image_desc && (
                <p className={`text-sm mt-2 ${isRead ? 'text-gray-400' : 'text-gray-600'}`}>
                  {(notification as any).image_desc}
                </p>
              )}
            </div>
          )}

          {/* Image for claim request notifications */}
          {notification.type === 'claim_request' && (notification as any).image_link && (
            <div className="mt-2 mb-2">
              <img
                src={(notification as any).image_link}
                alt="Claimed post"
                className="w-full h-32 object-cover rounded-lg border border-gray-200"
              />
            </div>
          )}

          {/* Timestamp and read indicator */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {formatTimeAgo(notification.created_at)}
            </span>
            {!isRead && (
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            )}
          </div>
          
          {/* Action buttons for invitations and share notifications */}
          {needsActionButtons && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent notification click event
                  handleNotificationAction(notification.id.toString(), 'accept', notification);
                }}
                className="bg-[#6C60FF] hover:bg-[#5A52E6] text-white text-xs px-3 py-1 h-7"
              >
                <Check className="w-3 h-3 mr-1" />
                Accept
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent notification click event
                  handleNotificationAction(notification.id.toString(), 'deny', notification);
                }}
                className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs px-3 py-1 h-7"
              >
                <X className="w-3 h-3 mr-1" />
                Deny
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n: any) => 
    n.is_read === false || n.is_read === 0 || n.is_read === undefined || n.is_read === null
  ).length;

  return (
    <div 
      ref={dropdownRef}
      className="absolute right-0 top-[52px] w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden"
      // style={{
      //   transform: 'translateX(-100px)', // Adjust positioning relative to notification icon
      // }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Notifications</h3>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                {unreadCount} new
              </span>
            )}
            <button
              onClick={async () => {
                await markAllAsReadOnClose();
                onClose();
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              title="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center">
            <div className="w-6 h-6 border-2 border-[#6C60FF] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-gray-500">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              🔔
            </div>
            <p className="text-sm text-gray-500 mb-1">No notifications</p>
            <p className="text-xs text-gray-400">You're all caught up!</p>
          </div>
        ) : (
          <div className="py-2">
            {notifications.map((notification, index) => {
              // Check if notification is read using is_read parameter from API
              const isRead = (notification as any).is_read === true || (notification as any).is_read === 1 || 
                             notification.read === true || notification.read === 1;
              return (
                <div
                  key={notification.id}
                  className={`px-4 py-3 transition-colors cursor-pointer ${
                    index !== notifications.length - 1 ? 'border-b border-gray-100' : ''
                  } ${!isRead ? 'bg-blue-50/30 hover:bg-blue-50/40' : 'hover:bg-gray-50'}`}
                  onClick={() => handleNotificationClick(notification.id, (notification as any).is_read || notification.read, notification)}
                >
                  {renderNotificationContent(notification)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}