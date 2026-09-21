import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Cloud, RefreshCw, AlertCircle, CheckCircle, Info, Unplug } from 'lucide-react';
import { dashboardAPI } from '../utils/authUtils';
import { toast } from 'sonner';
import { useSyncProgress } from '../contexts/SyncProgressContext';
import { openGooglePhotosPicker, retryPickerWithSession } from '../utils/googlePhotosPickerUtils';
import { PopupBlockedGuideModal } from './PopupBlockedGuideModal';
import { DisconnectServiceModal } from './DisconnectServiceModal';
import { getFacebookAuthUrl, getFacebookToken } from '../utils/facebookAuthAPI';

interface SyncService {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'connected' | 'sync_again' | 'not_connected';
  lastSync?: string;
}

interface SyncMediaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSync?: (serviceId: string) => Promise<void>;
  onSyncAll?: () => Promise<void>;
  anchorRef?: React.RefObject<HTMLElement>;
  isDropboxSyncing?: boolean;
  hiddenServices?: Set<string>;
  onToggleServiceVisibility?: (serviceId: string) => void;
  onDisconnect?: (serviceId: string, serviceName: string, itemCount: number) => void;
}

export function SyncMediaDialog({ isOpen, onClose, onSync, onSyncAll, anchorRef, isDropboxSyncing = false, hiddenServices = new Set(), onToggleServiceVisibility, onDisconnect }: SyncMediaDialogProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingService, setSyncingService] = useState<string | null>(null);
  const [connectedServices, setConnectedServices] = useState<any[]>([]);
  const [showPopupGuide, setShowPopupGuide] = useState(false);
  const [blockedSessionInfo, setBlockedSessionInfo] = useState<any>(null);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [hoveredService, setHoveredService] = useState<string | null>(null);
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [serviceToDisconnect, setServiceToDisconnect] = useState<{id: string, name: string, itemCount: number} | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { startSync, updateProgress, completeSync, failSync } = useSyncProgress();

  // Fetch connected services when dialog opens
  useEffect(() => {
    const fetchConnectedServices = async () => {
      if (!isOpen) return;

      setIsLoadingServices(true);
      try {
        console.log('🔍 SyncMediaDialog: Fetching connected services...');
        const response = await dashboardAPI.getConnectedServices();
        console.log('🔍 SyncMediaDialog: API response:', response);

        if (response.success) {
          let services = [];
          if (response.data?.services) {
            services = response.data.services;
          } else if (response.services) {
            services = response.services;
          } else if (Array.isArray(response.data)) {
            services = response.data;
          }

          console.log('🔍 SyncMediaDialog: Extracted services:', services);
          setConnectedServices(services);
        }
      } catch (error) {
        console.error('❌ SyncMediaDialog: Error fetching services:', error);
      } finally {
        setIsLoadingServices(false);
      }
    };

    fetchConnectedServices();
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Base service definitions
  const baseServices = [
    // iCloud hidden for now
    /*{
      id: 'icloud',
      name: 'iCloud Photos',
      icon: (
        <div className="w-7 h-7 bg-[#54C1F0] rounded-md flex items-center justify-center flex-shrink-0">
          <Cloud className="w-3.5 h-3.5 text-white" />
        </div>
      )
    },*/
    {
      id: 'google',
      name: 'Google Photos',
      icon: (
        <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center flex-shrink-0 border border-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 26 26" fill="none">
            <g clipPath="url(#clip0_google_photos)">
              <path d="M1.08337 13.0002C1.08337 4.3335 4.33337 1.0835 13 1.0835C21.6667 1.0835 24.9167 4.3335 24.9167 13.0002C24.9167 21.6668 21.6667 24.9168 13 24.9168C4.33337 24.9168 1.08337 21.6668 1.08337 13.0002Z" fill="white"/>
              <path d="M3.90002 12.9998H10.92C11.477 12.9988 12.0108 12.7767 12.4042 12.3823L8.45003 8.31982L3.90002 12.9998Z" fill="#FFC400"/>
              <path d="M12.4041 12.3823C12.7873 11.9921 13.0013 11.4667 13 10.9198V8.31982H8.44995L12.4041 12.3823Z" fill="#FFA300"/>
              <path d="M22.1 13H15.08C14.523 13.001 13.9892 13.2231 13.5958 13.6175L17.55 17.68L22.1 13Z" fill="#0089FF"/>
              <path d="M13.5958 13.6177C13.2127 14.0079 12.9986 14.5333 13 15.0802V17.6802H17.55L13.5958 13.6177Z" fill="#0069E4"/>
              <path d="M13 3.8999V10.9199C13.001 11.4769 13.2231 12.0107 13.6175 12.4041L17.68 8.4499L13 3.8999Z" fill="#FF4834"/>
              <path d="M13.6176 12.4044C14.0078 12.7875 14.5332 13.0016 15.0801 13.0002H17.6801V8.4502L13.6176 12.4044Z" fill="#FF025F"/>
              <path d="M12.9999 22.0999V15.0799C12.9989 14.5229 12.7768 13.9891 12.3824 13.5957L8.31995 17.5499L12.9999 22.0999Z" fill="#00C800"/>
              <path d="M12.3824 13.5958C11.9922 13.2127 11.4668 12.9986 10.9199 13H8.31995V17.55L12.3824 13.5958Z" fill="#00A44C"/>
            </g>
            <defs>
              <clipPath id="clip0_google_photos">
                <rect width="26" height="26" fill="white"/>
              </clipPath>
            </defs>
          </svg>
        </div>
      )
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: (
        <div className="w-7 h-7 bg-[#1877F2] rounded-md flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="white">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </div>
      )
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      icon: (
        <div className="w-7 h-7 bg-[#0061FF] rounded-md flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="white">
            <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z"/>
          </svg>
        </div>
      )
    }
  ];

  // Merge base services with connected services from API
  const services: SyncService[] = baseServices.map(baseService => {
    // Find matching connected service from API (trim to handle trailing spaces)
    const connectedService = connectedServices.find(cs =>
      cs.service_type?.trim() === baseService.id ||
      cs.type?.trim() === baseService.id
    );

    console.log(`🔍 SyncMediaDialog - Checking ${baseService.name}:`, {
      baseServiceId: baseService.id,
      foundConnectedService: !!connectedService,
      connectedServiceData: connectedService,
      status: connectedService?.status,
      service_type: connectedService?.service_type,
      type: connectedService?.type
    });

    // Check if service is truly connected (has status 'connected')
    const isConnected = connectedService && connectedService.status === 'connected';

    if (isConnected) {
      // Service is connected
      return {
        ...baseService,
        status: 'connected' as const,
        lastSync: connectedService.last_sync || undefined
      };
    } else {
      // Service not connected
      return {
        ...baseService,
        status: 'not_connected' as const
      };
    }
  });

  const handleSyncService = async (serviceId: string) => {
    console.log(`🔄 Sync clicked for service: ${serviceId}`);

    // Find the service to check its current status
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    setSyncingService(serviceId);

    try {
      // ===== ROLE 3 SYNC LIMIT CHECK =====
      // Check if trying to connect NEW service when already at limit
      if (service.status === 'not_connected' || service.status === 'sync_again') {
        // Get user role from localStorage
        const userDataStr = localStorage.getItem('stasht_user');
        const userData = userDataStr ? JSON.parse(userDataStr) : null;
        const userRole = userData?.role;

        console.log('👤 Role 3 check - Trying to connect new service:', { userRole, serviceId, status: service.status });

        // Count how many social media services are currently connected
        const socialMediaServices = ['facebook', 'google', 'dropbox', 'icloud'];
        const connectedSocialCount = connectedServices.filter(s => {
          const serviceType = (s.service_type || s.type || '').toLowerCase().trim();
          return socialMediaServices.includes(serviceType) && s.status === 'connected';
        }).length;

        console.log('📊 Connected services count:', {
          connectedSocialCount,
          allServices: connectedServices.map(s => ({ type: s.service_type || s.type, status: s.status })),
          connectedOnly: connectedServices.filter(s => s.status === 'connected').map(s => s.service_type || s.type)
        });

        // If role 3 AND already have 1+ services → BLOCK
        // Handle both string '3' and number 3
        if ((userRole === 3 || userRole === '3') && connectedSocialCount >= 1) {
          console.log('🚫 BLOCKED: Role 3 user trying to add new service when already at limit');
          toast.error('Your account sync limit is reached. Please disconnect your current service to connect a different one.', {
            duration: 5000,
          });
          setSyncingService(null);
          return; // Stop - don't proceed with OAuth/connection
        }

        console.log('✅ Connection allowed - proceeding...');
      }
      // ===== END ROLE 3 CHECK =====

      // Special handling for Google Photos - use picker instead of OAuth/sync API
      if (serviceId === 'google') {
        console.log('📸 Google Photos selected - using picker flow');

        // Check if we have Google access token
        let accessToken = sessionStorage.getItem('google_access_token');

        if (!accessToken) {
          console.log('🔗 No Google access token, need to get one...');

          // Check if user is logged in to our app
          const userToken = localStorage.getItem('stasht_token');
          const userData = localStorage.getItem('stasht_user');

          if (!userToken || !userData) {
            console.error('❌ User not logged in!');
            toast.error('Please log in first');
            setSyncingService(null);
            return;
          }

          console.log('✅ User is logged in, requesting Google Photos permission...');

          // User is logged in, just need Google Photos permission
          // Use SAME Google OAuth flow as signup page
          const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
          const redirectUri = import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI;

          const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
          authUrl.searchParams.append('client_id', clientId);
          authUrl.searchParams.append('redirect_uri', redirectUri);
          authUrl.searchParams.append('response_type', 'token'); // Implicit flow
          authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly');
          authUrl.searchParams.append('state', 'photos_from_media_sync');
          authUrl.searchParams.append('include_granted_scopes', 'true');
          authUrl.searchParams.append('prompt', 'consent');

          console.log('📸 Redirecting to Google OAuth for Photos permission...');
          toast.info('Redirecting to Google Photos authorization...');

          // Redirect to Google OAuth
          window.location.href = authUrl.toString();
          return;
        }

        // We have token, open picker directly (calls the 3 APIs)
        console.log('✅ Access token found, opening picker (will call 3 APIs)...');
        setSyncingService(null);
        onClose(); // Close the sync dialog

        // Open the picker - this calls:
        // 1. createPickerSession
        // 2. getPickerSessionStatus (polling)
        // 3. getPickerMediaItems
        const result = await openGooglePhotosPicker((importResult) => {
          if (importResult && importResult.success) {
            // Go to All Media tab after sync (not google-specific tab)
            sessionStorage.setItem('activeServiceTab', 'all');
            sessionStorage.setItem('service_just_connected', 'true');
            window.location.reload();
          }
        });

        // Check if popup was blocked
        if (result && result.popupBlocked) {
          console.log('🚫 Popup was blocked, showing guide...');
          // Store session info for retry
          setBlockedSessionInfo(result);
          setShowPopupGuide(true);
          return;
        }

        // Check if we need to re-authenticate (token was invalid)
        if (result && result.needsAuth) {
          console.log('🔄 Token was invalid, re-requesting permission...');

          const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
          const redirectUri = import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI;

          const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
          authUrl.searchParams.append('client_id', clientId);
          authUrl.searchParams.append('redirect_uri', redirectUri);
          authUrl.searchParams.append('response_type', 'token');
          authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly');
          authUrl.searchParams.append('state', 'photos_from_media_sync');
          authUrl.searchParams.append('include_granted_scopes', 'true');
          authUrl.searchParams.append('prompt', 'consent');

          toast.info('Redirecting to Google Photos authorization...');
          window.location.href = authUrl.toString();
        }
        return;
      }

      // Special handling for Facebook Photos - check connection status first
      if (serviceId === 'facebook') {
        console.log('📸 Facebook Photos selected - checking connection status...');

        // Check connection status like Dropbox does
        if (service.status === 'not_connected' || service.status === 'sync_again') {
          console.log('📸 Facebook not connected - initiating OAuth...');

          // Check if user is logged in to our app
          const userToken = localStorage.getItem('stasht_token');
          const userData = localStorage.getItem('stasht_user');

          if (!userToken || !userData) {
            console.error('❌ User not logged in!');
            toast.error('Please log in first');
            setSyncingService(null);
            return;
          }

          console.log('✅ User is logged in, initiating Facebook OAuth...');

          // Store state to indicate we're syncing from media page
          sessionStorage.setItem('facebook_sync_from', 'media_page');

          // Get Facebook OAuth URL and redirect
          const facebookAuthUrl = getFacebookAuthUrl('facebook_photos_sync');

          console.log('📸 Redirecting to Facebook OAuth...');
          toast.info('Redirecting to Facebook authorization...');

          // Redirect to Facebook OAuth
          window.location.href = facebookAuthUrl;
        } else if (service.status === 'connected') {
          // Already connected, just sync (like Dropbox!)
          console.log('📸 Facebook already connected - calling sync API directly');
          await triggerSync('facebook');
          setSyncingService(null);
        }
        return;
      }

      // For other services, use the existing flow
      if (service.status === 'not_connected' || service.status === 'sync_again') {
        console.log(`🔗 Service ${serviceId} not connected, initiating OAuth...`);

        // Call connect API to get OAuth URL
        const connectResponse = await dashboardAPI.connectService(serviceId);
        console.log('🔗 Connect response:', connectResponse);

        if (connectResponse.success && connectResponse.data?.auth_url) {
          // Store the current page state before redirecting
          sessionStorage.setItem('oauth_service', serviceId);
          sessionStorage.setItem('oauth_return_action', 'sync');

          // Direct redirect to OAuth URL
          toast.info(`Redirecting to ${service.name} authorization...`);
          window.location.href = connectResponse.data.auth_url;
        } else {
          toast.error(connectResponse.error || 'Failed to initiate connection');
          setSyncingService(null);
        }
      } else if (service.status === 'connected') {
        // Already connected, just sync
        await triggerSync(serviceId);
        setSyncingService(null);
      }
    } catch (error) {
      console.error('❌ Error in handleSyncService:', error);
      toast.error('An error occurred. Please try again.');
      setSyncingService(null);
    }
  };

  // Helper function to trigger sync
  const triggerSync = async (serviceId: string) => {
    console.log(`🔄 Triggering sync for ${serviceId}...`);

    // Find the service to get the full name
    const service = services.find(s => s.id === serviceId);
    const serviceName = service?.name || serviceId;

    // Start the sync progress in sidebar
    startSync(serviceId, serviceName, serviceId);
    updateProgress(0, 'Initiating sync...');

    // Simulate realistic progress while API is working
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += Math.random() * 15; // Random increment between 0-15%
      if (currentProgress > 90) currentProgress = 90; // Cap at 90% until we get response

      const messages = [
        'Connecting to service...',
        'Fetching media list...',
        'Downloading thumbnails...',
        'Processing items...',
        'Almost done...'
      ];
      const messageIndex = Math.floor((currentProgress / 90) * messages.length);
      updateProgress(Math.floor(currentProgress), messages[Math.min(messageIndex, messages.length - 1)]);
    }, 800); // Update every 800ms

    try {
      const syncResponse = await dashboardAPI.syncService(serviceId);
      console.log('🔄 Sync response:', syncResponse);

      // Clear the progress interval
      clearInterval(progressInterval);

      if (syncResponse.success) {
        const count = syncResponse.data?.synced_count || 0;

        // Complete sync with the count
        completeSync(count);
        toast.success(`Successfully synced ${count} items from ${serviceName}!`);

        // Call the parent's onSync callback if provided
        if (onSync) {
          await onSync(serviceId);
        }
      } else {
        // Check if error is due to expired/invalid token
        const errorMsg = syncResponse.error || '';
        const isTokenExpired = errorMsg.toLowerCase().includes('token') ||
                              errorMsg.toLowerCase().includes('expired') ||
                              errorMsg.toLowerCase().includes('unauthorized') ||
                              errorMsg.toLowerCase().includes('invalid') ||
                              syncResponse.data?.status === 'sync_again';

        if (isTokenExpired) {
          console.log('🔄 Token expired for', serviceId, '- auto-redirecting to re-authenticate...');
          failSync('Token expired. Redirecting to re-authenticate...');
          toast.info(`${serviceName} token expired. Redirecting to re-authenticate...`);

          // Auto-redirect to OAuth for re-authentication
          setTimeout(async () => {
            if (serviceId === 'facebook') {
              // Facebook OAuth
              const facebookAuthUrl = getFacebookAuthUrl('facebook_photos_sync');
              sessionStorage.setItem('facebook_sync_from', 'media_page');
              window.location.href = facebookAuthUrl;
            } else {
              // Other services use connectService API
              try {
                const connectResponse = await dashboardAPI.connectService(serviceId);
                if (connectResponse.success && connectResponse.data?.auth_url) {
                  sessionStorage.setItem('oauth_service', serviceId);
                  sessionStorage.setItem('oauth_return_action', 'sync');
                  window.location.href = connectResponse.data.auth_url;
                }
              } catch (err) {
                console.error('Failed to get auth URL:', err);
                toast.error('Failed to reconnect. Please try manually.');
              }
            }
          }, 1500);
        } else {
          failSync(syncResponse.error || 'Sync failed');
          toast.error(`Sync failed: ${syncResponse.error}`);
        }
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error('❌ Error in triggerSync:', error);
      failSync('An error occurred during sync');
      toast.error('An error occurred. Please try again.');
    }
  };

  const handleSyncAll = async () => {
    if (!onSyncAll) return;

    setSyncing(true);
    try {
      await onSyncAll();
    } finally {
      setSyncing(false);
    }
  };

  const getStatusDisplay = (service: SyncService) => {
    switch (service.status) {
      case 'connected':
        return (
          <div className="flex items-center gap-0.5">
            <CheckCircle className="w-2.5 h-2.5 text-[#10B981]" />
            <span className="text-[#10B981] font-medium">Connected</span>
            {service.lastSync && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500">{service.lastSync}</span>
              </>
            )}
          </div>
        );
      case 'sync_again':
        return (
          <div className="flex items-center gap-0.5">
            <AlertCircle className="w-2.5 h-2.5 text-[#F59E0B]" />
            <span className="text-[#F59E0B] font-medium">Sync Again</span>
          </div>
        );
      case 'not_connected':
        return (
          <div className="flex items-center gap-0.5">
            <Info className="w-2.5 h-2.5 text-gray-400" />
            <span className="text-gray-500">Not connected</span>
          </div>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Dropdown */}
      <div
        ref={dropdownRef}
        className="absolute right-0 top-full mt-2 w-[260px] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 max-h-[480px] flex flex-col"
      >
        <div className="p-3 pb-2 flex-shrink-0">
          {/* Header */}
          <div className="flex items-center gap-2 pb-2">
            <div className="w-7 h-7 bg-[#F3F4F6] rounded-full flex items-center justify-center">
              <Cloud className="w-3.5 h-3.5 text-[#6B7280]" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">Sync Media</h2>
          </div>

          {/* Grey line below Sync Media */}
          <div className="border-t border-gray-200 mb-2"></div>

          {/* Sync All Section */}
          <div
            className="bg-[#F9FAFB] rounded-lg p-2 flex items-center gap-2 cursor-pointer hover:bg-gray-100 transition-colors mb-2"
            onClick={handleSyncAll}
          >
            <div className="w-7 h-7 bg-[#6C60FF] rounded-full flex items-center justify-center flex-shrink-0">
              <RefreshCw className={`w-3.5 h-3.5 text-white ${syncing ? 'animate-spin' : ''}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-900 leading-tight">Sync All</div>
              <div className="text-[12px] text-gray-500 leading-tight">Sync all connected services</div>
            </div>
          </div>

          {/* Grey line below Sync All */}
          <div className="border-t border-gray-200 mb-2"></div>
        </div>

        {/* Services List - Scrollable */}
        <div className="overflow-y-auto px-3 pb-3">
          <div className="space-y-1.5">
            {services.map((service) => {
              // Check if user is Role 3 and has reached sync limit
              const userDataStr = localStorage.getItem('stasht_user');
              const userData = userDataStr ? JSON.parse(userDataStr) : null;
              const userRole = userData?.role;

              console.log('🔍 User role from localStorage:', { userRole, type: typeof userRole, userData });

              // Count connected services for Role 3 check
              const socialMediaServices = ['facebook', 'google', 'dropbox', 'icloud'];
              const connectedSocialCount = connectedServices.filter(s => {
                const serviceType = (s.service_type || s.type || '').toLowerCase().trim();
                return socialMediaServices.includes(serviceType) && s.status === 'connected';
              }).length;

              // Disable not_connected services for Role 3 users who have reached limit
              // Handle both string '3' and number 3
              const isRole3LimitReached = (userRole === 3 || userRole === '3') &&
                                          connectedSocialCount >= 1 &&
                                          (service.status === 'not_connected' || service.status === 'sync_again');

              if (service.status === 'not_connected' || service.status === 'sync_again') {
                console.log(`🔒 ${service.name} disable check:`, {
                  userRole,
                  isRole3: userRole === 3 || userRole === '3',
                  connectedCount: connectedSocialCount,
                  serviceStatus: service.status,
                  willDisable: isRole3LimitReached
                });
              }

              const isDisabled = (service.id === 'dropbox' && isDropboxSyncing) || isRole3LimitReached;

              // Find the actual connected service to get its real ID (trim to handle trailing spaces)
              const connectedService = connectedServices.find(cs =>
                cs.service_type?.trim() === service.id || cs.type?.trim() === service.id
              );
              const serviceIdentifier = connectedService?.id?.toString() || service.id;
              const isHidden = hiddenServices.has(serviceIdentifier);

              return (
                <div
                  key={service.id}
                  className={`relative group flex items-center gap-2 p-1.5 rounded-lg transition-colors ${
                    isDisabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-gray-50'
                  }`}
                  title={isRole3LimitReached ? 'Account sync limit reached. Please disconnect your current service first.' : ''}
                  onMouseEnter={() => setHoveredService(service.id)}
                  onMouseLeave={() => setHoveredService(null)}
                >
                  <div
                    className={`flex-1 flex items-center gap-2 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => !isDisabled && handleSyncService(service.id)}
                  >
                    {service.icon}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 leading-tight">{service.name}</div>
                      <div className="flex items-center gap-1 text-[12px] leading-tight mt-0.5">
                        {getStatusDisplay(service)}
                      </div>
                    </div>
                  </div>

                  {/* Disconnect icon - Visible on hover */}
                  {service.status === 'connected' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();

                        // Get item count
                        let itemCount = 0;
                        const connectedSvc = connectedServices.find(cs =>
                          cs.service_type?.trim() === service.id || cs.type?.trim() === service.id
                        );
                        if (connectedSvc) {
                          itemCount = connectedSvc.synced_count || connectedSvc.media_count || connectedSvc.item_count || connectedSvc.count || 0;
                        }

                        // Use parent disconnect handler if provided (MediaPage's working disconnect)
                        if (onDisconnect) {
                          onDisconnect(service.id, service.name, itemCount);
                          onClose();
                          return;
                        }

                        setServiceToDisconnect({
                          id: service.id,
                          name: service.name,
                          itemCount: itemCount
                        });
                        setDisconnectModalOpen(true);
                      }}
                      className="ml-2 p-1.5 rounded-md transition-all hover:bg-red-50 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                      title="Disconnect service"
                    >
                      <Unplug className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Popup Blocked Guide Modal */}
      <PopupBlockedGuideModal
        isOpen={showPopupGuide}
        onClose={() => {
          setShowPopupGuide(false);
          setBlockedSessionInfo(null);
        }}
        onRetry={async () => {
          setShowPopupGuide(false);

          if (!blockedSessionInfo) {
            console.error('❌ No session info available for retry');
            toast.error('Session expired. Please try syncing again.');
            return;
          }

          // Retry opening the picker with the existing session
          console.log('🔄 Retrying with session:', blockedSessionInfo.sessionId);
          const result = await retryPickerWithSession(
            blockedSessionInfo.sessionId,
            blockedSessionInfo.pickerUri,
            blockedSessionInfo.accessToken,
            (importResult) => {
              if (importResult && importResult.success) {
                console.log('📸 Photos imported successfully:', importResult.count);
                toast.success(`Imported ${importResult.count} photos!`);
                window.location.reload();
              }
            }
          );

          // Check if popup is still blocked
          if (result && result.popupBlocked) {
            console.log('🚫 Popup still blocked after retry');
            setBlockedSessionInfo(result);
            setShowPopupGuide(true);
          } else if (result && result.success) {
            // Success! Clear the session info
            setBlockedSessionInfo(null);
          }
        }}
      />

      {/* Disconnect Service Confirmation Modal */}
      <DisconnectServiceModal
        isOpen={disconnectModalOpen}
        onClose={() => {
          if (!isDisconnecting) {
            setDisconnectModalOpen(false);
            setServiceToDisconnect(null);
          }
        }}
        onConfirm={async () => {
          if (!serviceToDisconnect) return;

          setIsDisconnecting(true);
          try {
            // Get user ID from localStorage
            const userData = localStorage.getItem('stasht_user');
            if (!userData) {
              toast.error('User not logged in');
              return;
            }

            const user = JSON.parse(userData);
            const userId = user.id;

            console.log('🔌 Disconnecting service:', {
              userId,
              serviceName: serviceToDisconnect.id
            });

            // Call disconnect API
            const response = await dashboardAPI.disconnectService(userId, serviceToDisconnect.id);

            if (response.success) {
              toast.success(`${serviceToDisconnect.name} disconnected successfully`);

              // Close modal
              setDisconnectModalOpen(false);
              setServiceToDisconnect(null);

              // Refresh connected services
              const servicesResponse = await dashboardAPI.getConnectedServices();
              if (servicesResponse.success) {
                const services = servicesResponse.data?.services || servicesResponse.services || [];
                setConnectedServices(services);
              }
            } else {
              toast.error(response.error || 'Failed to disconnect service');
            }
          } catch (error) {
            console.error('❌ Error disconnecting service:', error);
            toast.error('An error occurred while disconnecting');
          } finally {
            setIsDisconnecting(false);
          }
        }}
        serviceName={serviceToDisconnect?.name || ''}
        itemCount={serviceToDisconnect?.itemCount || 0}
        isDisconnecting={isDisconnecting}
      />
    </>
  );
}
