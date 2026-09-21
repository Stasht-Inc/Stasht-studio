"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, LayoutDashboard, BookOpen, FolderOpen, Users, Grid3x3, CheckCircle, Circle, ChevronRight, Upload, FileText, UserPlus, Share, PanelLeft, Plug, Target } from "lucide-react";
import CreateMemory from "./CreateMemory";
import { useMemoryLimit } from "../hooks/useMemoryLimit";
import { dashboardAPI, isPartialAdmin, apiRequest } from "../utils/authUtils";
import { leadsAPI } from '../services/leadsAPI';
import { runWhenIdle } from "../utils/deferIdle";
import { useAuth } from "../contexts/AuthContext";
import { useMemoryCounts } from "../hooks/useMemoryCounts";
import { MemoryLimitDialog } from "./MemoryLimitDialog";
import { useUploadProgress } from "../contexts/UploadProgressContext";
import { useSyncProgress } from "../contexts/SyncProgressContext";
import { useProperty } from "../contexts/PropertyContext";

// Navigation item component
function NavItem({
  icon,
  label,
  isActive,
  onClick,
  count,
  unreadCount
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  count?: number;
  unreadCount?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 text-left ${
        isActive
          ? 'bg-[#6C60FF]/10 text-[#6C60FF] border border-[#6C60FF]/20'
          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <div className="flex items-center gap-0">
        <div className={`w-8 h-8 flex items-center justify-center ${
          isActive ? 'text-[#6C60FF]' : 'text-gray-500'
        }`}>
          {icon}
        </div>
        <span className="font-medium text-base">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {unreadCount !== undefined && unreadCount > 0 && (
          <span className="flex items-center justify-center min-w-[22px] h-5 px-1 rounded-lg bg-red-500 text-white text-[12px] font-bold">
            {unreadCount}
          </span>
        )}
        {count !== undefined && (
          <span className={`text-sm px-2 py-1 rounded-full ${
            isActive
              ? 'bg-[#6C60FF]/20 text-[#6C60FF]'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {count}
          </span>
        )}
      </div>
    </button>
  );
}

// Video Modal
const VIDEO_STEPS = [
  { step: 1, title: "Upload/Sync Media", nextLabel: "Create a Campaign", embedUrl: "https://www.youtube.com/embed/SibZc7okVyU" },
  { step: 2, title: "Create a Campaign",    nextLabel: "Invite Users",   embedUrl: "https://www.youtube.com/embed/O3PA3deEJSA" },
  { step: 3, title: "Invite Users",      nextLabel: "Publish Campaign",  embedUrl: "https://www.youtube.com/embed/Fi6iZpcdrEk" },
  { step: 4, title: "Publish Campaign",     nextLabel: null,             embedUrl: "https://www.youtube.com/embed/R47D2pY5ZNo" },
];

function VideoModal({ initialStep, onClose, onWatched }: { initialStep: number; onClose: () => void; onWatched: (steps: number[]) => void }) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const data = VIDEO_STEPS.find(s => s.step === currentStep)!;

  const handleClose = () => {
    const watched = Array.from({ length: currentStep - initialStep + 1 }, (_, i) => initialStep + i);
    onWatched(watched);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={handleClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[620px] max-w-[95vw] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Step {data.step} - {data.title}</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video area */}
        <div className="bg-black" style={{ height: 360 }}>
          <iframe
            key={data.step}
            src={data.embedUrl}
            width="100%"
            height="100%"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="border-0"
          />
        </div>

        {/* Footer */}
        {(data.nextLabel || currentStep > 1) && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <div className="flex items-center gap-3">
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-4 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-full hover:bg-gray-50 transition-all duration-200 flex items-center gap-1"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" />
                  Back
                </button>
              )}
              {data.nextLabel && (
                <span className="text-sm text-gray-500">
                  Watch Next: <span className="font-medium text-gray-700">{data.nextLabel}</span>
                </span>
              )}
            </div>
            {data.nextLabel ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-4 py-1.5 text-sm font-medium text-[#6C60FF] border border-[#6C60FF] rounded-full hover:bg-[#6C60FF] hover:text-white transition-all duration-200 flex items-center gap-1"
              >
                Next Video
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={handleClose}
                className="px-6 py-1.5 text-sm font-medium text-white bg-[#6C60FF] rounded-full hover:bg-[#5a4fe0] transition-all duration-200"
              >
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// Get Started Task Item
function TaskItem({
  icon,
  title,
  subtitle,
  completed,
  primaryAction,
  secondaryAction
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  completed: boolean;
  primaryAction?: {
    text: string;
    onClick: () => void;
  };
  secondaryAction?: {
    text: string;
    onClick: () => void;
  };
}) {
  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg ${
      completed ? 'opacity-60' : ''
    }`} style={{ backgroundColor: '#F9FAFB' }}>
      <div className={`w-6 h-6 flex-shrink-0 flex items-center justify-center ${
        completed ? 'text-gray-400' : 'text-gray-500'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`font-semibold text-base mb-1.5 ${
          completed ? 'text-gray-500' : 'text-gray-900'
        }`}>
          {title}
        </h4>
        <p className={`text-sm mb-2.5 ${
          completed ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {subtitle}
        </p>
        {!completed && (primaryAction || secondaryAction) && (
          <div className="flex items-center gap-1.5 flex-nowrap">
            {primaryAction && (
              <button
                onClick={primaryAction.onClick}
                className="px-3 py-1 text-[12px] font-medium text-[#6C60FF] border border-[#6C60FF] rounded-full hover:bg-[#6C60FF] hover:text-white transition-all duration-200 flex items-center gap-0.5 whitespace-nowrap"
              >
                {primaryAction.text}
                <ChevronRight className="w-2.5 h-2.5 flex-shrink-0" />
              </button>
            )}
            {secondaryAction && (
              <button
                onClick={secondaryAction.onClick}
                className="px-3 py-1 text-[12px] font-medium text-gray-700 border border-gray-300 rounded-full hover:bg-gray-50 transition-all duration-200 flex items-center gap-0.5 whitespace-nowrap"
              >
                {secondaryAction.text}
                <ChevronRight className="w-2.5 h-2.5 flex-shrink-0" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Main Sidebar Component
export default function Sidebar({
  isMinimized = false,
  onToggleMinimize,
  activeItem = 'dashboard',
  onNavigate,
  onMemoryLimitRefresh,
  aiProcessing,
  onClearAiProcessing,
  onShowAiResults,
  isPropertyOwner = true
}: {
  isMinimized?: boolean;
  isPropertyOwner?: boolean;
  onToggleMinimize?: () => void;
  activeItem?: string;
  onNavigate?: (itemId: string) => void;
  onMemoryLimitRefresh?: () => void;
  aiProcessing?: {
    memoryId: string;
    status: 'processing' | 'completed' | 'failed';
    startTime: number;
    result?: any;
    progress?: number;
    title?: string;
    subtitle?: string;
    navigateTo?: string;
    personId?: string;
  } | null;
  onClearAiProcessing?: () => void;
  onShowAiResults?: (memoryId: string) => void;
}) {
  const { isAuthenticated, user } = useAuth();
  const { viewType, currentProperty } = useProperty();
  const { isLimitExceeded, limitData, checkLimit } = useMemoryLimit();
  const { memoryCounts, refreshMemoryCounts } = useMemoryCounts();
  const { isUploading } = useUploadProgress();
  const { syncProgress, clearSync } = useSyncProgress();
  const [showMemoryLimitAlert, setShowMemoryLimitAlert] = useState(false);
  const [showCreateMemory, setShowCreateMemory] = useState(false);
  const [videoStep, setVideoStep] = useState<number | null>(null);
  const [watchedSteps, setWatchedSteps] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('stasht_watched_videos') || '[]'); } catch { return []; }
  });
  const [usersCount, setUsersCount] = useState<number | undefined>(undefined);
  const [leadsUnreadCount, setLeadsUnreadCount] = useState<number>(0);
  const [leadsCount, setLeadsCount] = useState<number | undefined>(undefined);
  const [appsCount, setAppsCount] = useState<number | undefined>(undefined);
  const [connectorsCount, setConnectorsCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!isAuthenticated) return;
    dashboardAPI.getUsersCollaboratorsAndNonCollaborators().then((response) => {
      if (response.success && response.data) {
        const d = response.data.data ?? response.data;
        const paginationTotal = d?.pagination?.total;
        if (typeof paginationTotal === 'number') {
          setUsersCount(paginationTotal);
        } else {
          const collaborators = d?.collaborators ?? [];
          const nonCollaborators = d?.non_collaborators ?? [];
          setUsersCount(collaborators.length + nonCollaborators.length);
        }
      }
    }).catch(() => {});
  }, [isAuthenticated]);

  // Connectors badge = number of connectors currently connected (DocuSign + Shopify).
  // Same two status endpoints the Connectors/Marketplace page uses. This is a purely
  // decorative count, so it's deferred to browser-idle time to keep the two status
  // calls off the initial-load critical path (PERFORMANCE_OPTIMIZATION_PLAN.md #4).
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const cancelIdle = runWhenIdle(() => {
      Promise.all([
        dashboardAPI.docuSignGetStatus().then(r => (r?.success && r.data?.connected ? 1 : 0)).catch(() => 0),
        dashboardAPI.shopifyGetStatus().then(r => (r?.success && r.data?.connected ? 1 : 0)).catch(() => 0),
      ]).then(([docusign, shopify]) => {
        if (!cancelled) setConnectorsCount(docusign + shopify);
      });
    });
    return () => { cancelled = true; cancelIdle(); };
  }, [isAuthenticated]);

  const fetchLeadsUnreadCount = () => {
    if (!isAuthenticated) return;
    apiRequest('/leads/unread-count', { method: 'GET' }).then((data) => {
      const unread = data?.data?.total_unread ?? data?.total_unread ?? 0;
      setLeadsUnreadCount(typeof unread === 'number' ? unread : 0);
    }).catch(() => {});
  };

  // Total leads, shown as the grey counter like Campaigns/Media/Users (Chris, 2026-09-21:
  // "why is there no counter??"). Same total the Leads page's "Total Leads" card shows. Asks
  // for ONE row via page/per_page — without `page` the endpoint returns the whole list.
  const fetchLeadsCount = () => {
    if (!isAuthenticated) return;
    leadsAPI.getLeads({ page: 1, per_page: 1 }).then((res) => {
      const total = res?.success ? res.data?.total : undefined;
      if (typeof total === 'number') setLeadsCount(total);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchLeadsUnreadCount();
  }, [isAuthenticated]);

  // Purely decorative, so deferred to browser-idle time like the Apps/Connectors counts,
  // then refreshed when leads are read/opened and once a minute.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const cancelIdle = runWhenIdle(() => { if (!cancelled) fetchLeadsCount(); });
    const interval = setInterval(fetchLeadsCount, 60000);
    window.addEventListener('leads-unread-count-refresh', fetchLeadsCount);
    return () => {
      cancelled = true;
      cancelIdle();
      clearInterval(interval);
      window.removeEventListener('leads-unread-count-refresh', fetchLeadsCount);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    window.addEventListener('leads-unread-count-refresh', fetchLeadsUnreadCount);
    return () => window.removeEventListener('leads-unread-count-refresh', fetchLeadsUnreadCount);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(fetchLeadsUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Apps badge = number of partner API-key "apps". Decorative count for the Apps nav
  // item, so it's deferred to browser-idle time to keep /user/api-keys off the
  // initial-load critical path (PERFORMANCE_OPTIMIZATION_PLAN.md #4).
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const cancelIdle = runWhenIdle(() => {
      apiRequest('/user/api-keys', { method: 'GET' }).then((data) => {
        if (cancelled) return;
        const appsData = data.data?.data?.apps || data.data?.apps || [];
        setAppsCount(appsData.length);
      }).catch(() => {});
    });
    return () => { cancelled = true; cancelIdle(); };
  }, [isAuthenticated]);

  // Note: Memory limit updates now handled by global event system in useMemoryLimit hook

  const handleAddMemory = async () => {
    // Check latest memory limit before opening create dialog
    await checkLimit();

    // Get fresh limit data after the check
    const response = await dashboardAPI.checkMemoryLimit();
    if (response.success && response.data) {
      const data = response.data.data || response.data;
      const limitStatus = data.limit_status || data;

      if (limitStatus.status === 'limit_exceeded') {
        setShowMemoryLimitAlert(true);
        return;
      }
    }

    setShowCreateMemory(true);
  };

  const handleMemoryCreated = async () => {
    await checkLimit();
    await refreshMemoryCounts();
    console.log('Memory created from sidebar');

    // Automatically navigate to memories page after successful creation
    handleNavigation('memories');
  };

  const handleNavigation = (itemId: string) => {
    if (onNavigate) {
      onNavigate(itemId);
    } else {
      console.log(`Navigating to: ${itemId}`);
    }
  };

  // Navigation items based on user role and view type
  const getNavigationItems = () => {
    const items = [];

    // If viewing a property account, only show Memories and Media
    if (viewType === 'property') {
      items.push(
        {
          id: 'memories',
          label: 'Campaigns',
          icon: <BookOpen className="w-5 h-5" />,
          count: memoryCounts?.total_memories || 0
        },
        {
          id: 'media',
          label: 'Media',
          icon: <FolderOpen className="w-5 h-5" />,
          count: memoryCounts?.total_memory_images || 0
        }
      );
      return items;
    }

    // Personal account navigation (existing logic)
    // Only show Dashboard if user role is NOT 3
    if (user?.role !== '3' && user?.role !== 3) {
      items.push({
        id: 'dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard className="w-5 h-5" />,
      });
    }

    // Campaigns, then Leads right under it (Chris, 2026-09-21), then Media. Leads is shown
    // for every role, partial admins included (the Leads API is partial-admin aware).
    items.push(
      {
        id: 'memories',
        label: 'Campaigns',
        icon: <BookOpen className="w-5 h-5" />,
        count: memoryCounts?.total_memories || 0
      },
      {
        id: 'leads',
        label: 'Leads',
        icon: <Target className="w-5 h-5" />,
        count: leadsCount,
        unreadCount: leadsUnreadCount,
      },
      {
        id: 'media',
        label: 'Media',
        icon: <FolderOpen className="w-5 h-5" />,
        count: memoryCounts?.total_memory_images || 0
      }
    );

    // Hide Library for partial admin
    if (!isPartialAdmin()) {
      items.push({
        id: 'library',
        label: 'Library',
        icon: <PanelLeft className="w-5 h-5" />,
        count: memoryCounts?.total_library_people ?? 0,
      });
    }

    // Hide Users, Apps, Connectors for partial admin
    if (!isPartialAdmin()) {
      items.push({
        id: 'users',
        label: 'Users',
        icon: <Users className="w-5 h-5" />,
        count: usersCount,
      });

      // Only show Apps section if user role is NOT 3
      if (user?.role !== '3' && user?.role !== 3) {
        items.push({
          id: 'apps',
          label: 'Apps',
          icon: <Grid3x3 className="w-5 h-5" />,
          count: appsCount,
        });
      }

      items.push({
        id: 'marketplace',
        label: 'Connectors',
        icon: <Plug className="w-5 h-5" />,
        count: connectorsCount,
      });
    }

    return items;
  };

  // Dynamic header content based on active section
  const getHeaderContent = () => {
    switch (activeItem) {
      case 'dashboard':
        return {
          icon: <LayoutDashboard className="w-5 h-5 text-white" />,
          title: 'Dashboard',
          subtitle: 'Overview & Analytics'
        };
      case 'memories':
        return {
          icon: <BookOpen className="w-5 h-5 text-white" />,
          title: 'Campaigns',
          subtitle: 'Manage Storeels'
        };
      case 'media':
        return {
          icon: <FolderOpen className="w-5 h-5 text-white" />,
          title: 'Media',
          subtitle: 'Upload and Manage'
        };
      case 'library':
        return {
          icon: <PanelLeft className="w-5 h-5 text-white" />,
          title: 'Library',
          subtitle: 'Browse People'
        };
      case 'leads':
        return {
          icon: <Target className="w-5 h-5 text-white" />,
          title: 'Leads',
          subtitle: 'Manage Leads & Conversations'
        };
      case 'users':
        return {
          icon: <Users className="w-5 h-5 text-white" />,
          title: 'Users',
          subtitle: 'Manage All User Types'
        };
      case 'apps':
        return {
          icon: <Grid3x3 className="w-5 h-5 text-white" />,
          title: 'Apps',
          subtitle: 'Integrations and Tools'
        };
      case 'marketplace':
        return {
          icon: <Plug className="w-5 h-5 text-white" />,
          title: 'Connectors',
          subtitle: 'Widgets'
        };
      default:
        return {
          icon: <LayoutDashboard className="w-5 h-5 text-white" />,
          title: 'Dashboard',
          subtitle: 'Overview & Analytics'
        };
    }
  };

  // Get Started tasks based on real user activity
  const getStartedTasks = [
    {
      icon: <Upload className="w-6 h-6" />,
      title: "Upload/Sync Media",
      subtitle: "Add your first photos to your library",
      completed: (memoryCounts?.total_memory_images || 0) > 0,
      primaryAction: (memoryCounts?.total_memory_images || 0) > 0 ? undefined : {
        text: "Upload Now",
        onClick: () => handleNavigation('media')
      },
      secondaryAction: (memoryCounts?.total_memory_images || 0) > 0 || watchedSteps.includes(1) ? undefined : {
        text: "Watch Video",
        onClick: () => setVideoStep(1)
      }
    },
    {
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      title: "Create a Campaign",
      subtitle: "Organize your moments into campaigns",
      completed: (memoryCounts?.total_memories || 0) > 0,
      primaryAction: (memoryCounts?.total_memories || 0) > 0 ? undefined : {
        text: "Create Now",
        onClick: () => {
          if (!isLimitExceeded) {
            handleAddMemory();
          }
        }
      },
      secondaryAction: (memoryCounts?.total_memories || 0) > 0 || watchedSteps.includes(2) ? undefined : {
        text: "Watch Video",
        onClick: () => setVideoStep(2)
      }
    },
    {
      icon: <UserPlus className="w-6 h-6" />,
      title: "Invite Users",
      subtitle: "Invite people to view, contribute or edit campaigns",
      completed: (memoryCounts?.active_collaborators || 0) > 0,
      primaryAction: (memoryCounts?.active_collaborators || 0) > 0 ? undefined : {
        text: "Invite Now",
        onClick: () => handleNavigation('memories')
      },
      secondaryAction: (memoryCounts?.active_collaborators || 0) > 0 || watchedSteps.includes(3) ? undefined : {
        text: "Watch Video",
        onClick: () => setVideoStep(3)
      }
    },
    {
      icon: (
        <svg
          className="w-6 h-6"
          fill="currentColor"
          viewBox="0 0 448 512"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M352 224c53 0 96-43 96-96s-43-96-96-96s-96 43-96 96c0 4 .2 8 .7 11.9l-94.1 47C145.4 170.2 121.9 160 96 160c-53 0-96 43-96 96s43 96 96 96c25.9 0 49.4-10.2 66.6-26.9l94.1 47c-.5 3.9-.7 7.8-.7 11.9c0 53 43 96 96 96s96-43 96-96s-43-96-96-96c-25.9 0-49.4 10.2-66.6 26.9l-94.1-47c.5-3.9 .7-7.8 .7-11.9s-.2-8-.7-11.9l94.1-47C302.6 213.8 326.1 224 352 224z"/>
        </svg>
      ),
      title: "Publish Campaign",
      subtitle: "Publish and share with friends, family and colleagues",
      completed: (memoryCounts?.published_memories || 0) > 0,
      primaryAction: (memoryCounts?.published_memories || 0) > 0 ? undefined : {
        text: "Choose Campaign",
        onClick: () => handleNavigation('memories')
      },
      secondaryAction: (memoryCounts?.published_memories || 0) > 0 || watchedSteps.includes(4) ? undefined : {
        text: "Watch Video",
        onClick: () => setVideoStep(4)
      }
    }
  ];

  const completedTasks = getStartedTasks.filter(task => task.completed).length;
  const totalTasks = getStartedTasks.length;
  const remainingTasks = totalTasks - completedTasks;

  if (isMinimized) {
    return (
      <div className="bg-white h-full w-16 border-r border-gray-200 flex flex-col items-center py-4 gap-4">
        {/* Minimized Create Button - Only show for property owners */}
        {isPropertyOwner && (
          <button
            onClick={isLimitExceeded ? undefined : handleAddMemory}
            disabled={isLimitExceeded}
            className={
              isLimitExceeded
                ? "w-10 h-10 rounded-lg bg-gray-300 text-gray-500 cursor-not-allowed flex items-center justify-center"
                : "w-10 h-10 rounded-lg bg-[#6C60FF] hover:bg-[#5A4FE5] text-white flex items-center justify-center transition-colors"
            }
            style={isLimitExceeded ? { backgroundColor: '#EFEFEF', color: '#9CA3AF' } : undefined}
            title={isLimitExceeded ? "Campaign limit reached" : "Create a Campaign"}
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
        
        {/* Minimized Navigation */}
        <div className="flex flex-col gap-2 w-full px-2">
          {getNavigationItems().map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                activeItem === item.id 
                  ? 'bg-[#6C60FF]/10 text-[#6C60FF]' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              title={item.label}
            >
              {item.icon}
            </button>
          ))}
        </div>
        
        {/* Toggle Button */}
        <div className="mt-auto">
          <button
            onClick={onToggleMinimize}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
    );
  }

  const headerContent = getHeaderContent();

  return (
    <div className="bg-white h-full w-full border-r border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className={`${isPropertyOwner ? 'p-6' : 'px-6 py-4'} border-b border-gray-100 flex-shrink-0`}>
        <div className={`flex items-center gap-3 ${isPropertyOwner ? 'mb-6' : 'mb-0'}`}>
          <div className="w-10 h-10 bg-[#6C60FF] rounded-lg flex items-center justify-center">
            {headerContent.icon}
          </div>
          <div>
            <h1 className="font-semibold text-lg text-gray-900">{headerContent.title}</h1>
            <p className="text-sm text-gray-600">{headerContent.subtitle}</p>
          </div>
        </div>

        {/* Create Memory Button - Only show for property owners */}
        {isPropertyOwner && (
          <button
            onClick={(isLimitExceeded || isUploading) ? undefined : handleAddMemory}
            disabled={isLimitExceeded || isUploading}
            className={
              (isLimitExceeded || isUploading)
                ? "w-full py-3 px-4 rounded-lg font-medium text-sm bg-gray-300 text-gray-500 cursor-not-allowed flex items-center justify-center gap-2"
                : "w-full py-3 px-4 rounded-lg font-medium text-sm bg-[#6C60FF] hover:bg-[#5B52FF] text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
            }
            style={(isLimitExceeded || isUploading) ? { backgroundColor: '#EFEFEF', color: '#9CA3AF' } : undefined}
          >
            <Plus className="w-4 h-4" />
            {isUploading ? 'Uploading...' : 'Create a Campaign'}
          </button>
        )}

      </div>

      {/* Body: scrollable nav + fixed bottom — wrapped in a single flex-1 container */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Navigation */}
        <div className="px-6 py-4 space-y-1">
          {getNavigationItems().map((item) => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={activeItem === item.id}
              onClick={() => handleNavigation(item.id)}
              count={item.count}
              unreadCount={(item as any).unreadCount}
            />
          ))}
        </div>

        {/* Spacer to push content below */}
        <div className="flex-1 min-h-[20px]" />

        {/* Get Started Section - Hide when all tasks are completed or when viewing as visitor */}
        {isPropertyOwner && remainingTasks > 0 && (
          <div className="p-6 border-t border-gray-100">
            <div className="mb-5">
              <h3 className="font-semibold text-base text-gray-900 mb-2">Get Started</h3>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#6C60FF] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600 font-medium">
                  {completedTasks}/{totalTasks}
                </span>
              </div>
              <p className="text-xs text-gray-600">
                {remainingTasks} tasks remaining
              </p>
            </div>

            <div className="space-y-3">
              {getStartedTasks.map((task, index) => (
                <TaskItem
                  key={index}
                  icon={task.icon}
                  title={task.title}
                  subtitle={task.subtitle}
                  completed={task.completed}
                  primaryAction={task.primaryAction}
                  secondaryAction={task.secondaryAction}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom section — always visible, never scrolls */}
      <div className="flex-shrink-0">

      {/* Sync Progress - Fixed at bottom, ABOVE AI processing */}
      {syncProgress && syncProgress.status === 'syncing' && (
        <div className="border-t border-gray-100 flex-shrink-0">
          <div className="bg-blue-50 p-4">
            <div className="flex items-start gap-3 mb-3">
              {/* Service-specific icon */}
              {syncProgress.serviceType === 'facebook' ? (
                <div className="w-10 h-10 bg-[#1877F2] rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
              ) : syncProgress.serviceType === 'dropbox' ? (
                <div className="w-10 h-10 bg-[#0061FF] rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                    <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z"/>
                  </svg>
                </div>
              ) : syncProgress.serviceType === 'google' ? (
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 26 26" fill="none">
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
              ) : (
                <div className="w-10 h-10 bg-[#6C60FF] rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white animate-spin" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-gray-900 mb-1">
                  Syncing {syncProgress.serviceName} ({syncProgress.progress}%)
                </h3>
                <p className="text-xs text-gray-600">
                  {syncProgress.message || 'Importing your media...'}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="w-full bg-[#6C60FF]/20 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#6C60FF] h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${syncProgress.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-end">
                <span className="text-xs font-semibold text-[#6C60FF]">{syncProgress.progress}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Complete */}
      {syncProgress && syncProgress.status === 'completed' && (
        <div className="border-t border-gray-100 flex-shrink-0">
          <div className="bg-green-50 p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-green-900 mb-1">Sync Complete! ✨</h3>
                <p className="text-xs text-green-700">{syncProgress.message}</p>
              </div>
            </div>

            {/* View Media Button */}
            <button
              onClick={() => {
                console.log('📱 View Media clicked for service:', syncProgress.serviceId);

                // Store the service ID to activate that tab - IMPORTANT: Set this first!
                const serviceId = syncProgress.serviceId;
                sessionStorage.setItem('activeServiceTab', serviceId);
                console.log('💾 Saved to sessionStorage - activeServiceTab:', serviceId);

                // Clear sync progress BEFORE navigation
                clearSync();

                // Navigate to media page
                if (onNavigate) {
                  onNavigate('media');
                }

                // Wait a bit longer for navigation to complete, then reload
                setTimeout(() => {
                  // Verify sessionStorage before reload
                  const saved = sessionStorage.getItem('activeServiceTab');
                  console.log('✅ Before reload - sessionStorage has:', saved);

                  // Reload to refresh media data and show new photos
                  window.location.reload();
                }, 500);
              }}
              className="w-full py-2.5 px-4 rounded-lg font-medium text-sm bg-[#6C60FF] hover:bg-[#5A4FE5] text-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              View Media
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sync Failed */}
      {syncProgress && syncProgress.status === 'failed' && (
        <div className="border-t border-gray-100 flex-shrink-0">
          <div className="bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-red-900 mb-1">Sync Failed</h3>
                <p className="text-xs text-red-700">{syncProgress.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Memory Analysis Progress - Fixed at bottom, ABOVE toggle button */}
      {aiProcessing && aiProcessing.status === 'processing' && (
        <div className="border-t border-gray-100 flex-shrink-0">
          <div className="bg-purple-50 p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
                  <path d="M20 3v4"></path>
                  <path d="M22 5h-4"></path>
                  <path d="M4 17v2"></path>
                  <path d="M5 18H3"></path>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-gray-900 mb-1">{aiProcessing.title ?? 'AI Campaign Analysis'}</h3>
                <p className="text-xs text-gray-600">{aiProcessing.subtitle ?? 'Processing your campaigns...'}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Progress</span>
                <span className="font-semibold text-purple-600">{aiProcessing.progress || 0}%</span>
              </div>
              <div className="w-full bg-purple-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${aiProcessing.progress || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Complete - Fixed at bottom, ABOVE toggle button */}
      {aiProcessing && aiProcessing.status === 'completed' && (
        <div className="border-t border-gray-100 flex-shrink-0">
          <div className="bg-green-50 p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-green-900 mb-1">{aiProcessing.title ? `${aiProcessing.title} Complete!` : 'Analysis Complete!'}</h3>
                <p className="text-xs text-green-700">Ready to view results</p>
              </div>
            </div>

            {/* Show Results Button */}
            <button
              onClick={() => {
                if (onShowAiResults) {
                  onShowAiResults(aiProcessing?.memoryId ?? '');
                }
              }}
              className="w-full py-2.5 px-4 rounded-lg font-medium text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              Show Results
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toggle Button - Fixed at bottom */}
      <div className="p-4 border-t border-gray-100 flex-shrink-0">
        <button
          onClick={onToggleMinimize}
          className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors ml-auto"
          title="Minimize sidebar"
        >
          <ChevronRight className="w-4 h-4 text-gray-600 rotate-180" />
        </button>
      </div>

      </div> {/* end fixed bottom section */}
      </div> {/* end body wrapper */}

      {/* Dialogs */}
      <CreateMemory
        open={showCreateMemory}
        onOpenChange={setShowCreateMemory}
        onMemoryCreated={handleMemoryCreated}
        onOpenMediaLibrary={() => {
          console.log('📸 Opening media library from Sidebar - navigating to media page');
          setShowCreateMemory(false);
          handleNavigation('media');
        }}
      />

      <MemoryLimitDialog
        isOpen={showMemoryLimitAlert}
        onClose={() => setShowMemoryLimitAlert(false)}
        memoryCount={limitData?.current_memories}
        memoryLimit={limitData?.memory_limit}
      />

      {videoStep !== null && (
        <VideoModal
          initialStep={videoStep}
          onClose={() => setVideoStep(null)}
          onWatched={(steps) => {
            setWatchedSteps(prev => {
              const merged = Array.from(new Set([...prev, ...steps]));
              localStorage.setItem('stasht_watched_videos', JSON.stringify(merged));
              return merged;
            });
          }}
        />
      )}
    </div>
  );
}