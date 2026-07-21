import Frame192 from "../imports/Frame192";
import WeeklyEngCard from "../imports/WeeklyEngCard";
import Frame732 from "../imports/Frame732";
import Frame189 from "../imports/Frame189";
import TimePeriodSelector from "./TimePeriodSelector";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { AlertTriangle, CheckCircle, Circle, ChevronRight, Upload, FileText, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useState, useEffect } from 'react';
import { dashboardAPI } from '../utils/authUtils';
import { useAuth } from '../contexts/AuthContext';
import { useProperty } from '../contexts/PropertyContext';
import { useMemoryLimit } from '../hooks/useMemoryLimit';
import { useMemoryCounts } from '../hooks/useMemoryCounts';

interface DashboardProps {
  timePeriod: string;
  onTimePeriodChange: (period: string) => void;
  onNavigate: (page: string) => void;
  onMemorySelect: (memoryId: string) => void;
}

// Color mapping function to ensure consistent colors that match User Activity Metrics
const getActivityColor = (action: string): string => {
  const actionLower = action.toLowerCase();
  
  // Memories Created - #4AD991 (green)
  if (actionLower.includes('memory created') || actionLower.includes('memory added')) {
    return 'bg-[#4AD991]';
  }
  
  // Media Uploaded - #ED697B (red/pink)
  if (actionLower.includes('media') || actionLower.includes('upload') || actionLower.includes('file') || actionLower.includes('data export')) {
    return 'bg-[#ED697B]';
  }
  
  // Memories Published - #FEC53D (yellow/orange)
  if (actionLower.includes('publish') || actionLower.includes('share') || actionLower.includes('collection')) {
    return 'bg-[#FEC53D]';
  }
  
  // Total Users - #6C60FF (purple) - user related activities
  if (actionLower.includes('user') || actionLower.includes('register') || actionLower.includes('collaboration') || actionLower.includes('settings')) {
    return 'bg-[#6C60FF]';
  }
  
  // System activities - use Memories Created color (green) for positive system actions
  if (actionLower.includes('system') || actionLower.includes('backup') || actionLower.includes('optimization')) {
    return 'bg-[#4AD991]';
  }
  
  // Default to Memories Created color
  return 'bg-[#4AD991]';
};

// Mock user data with avatars - colors match User Activity Metrics
const activityData = [
  {
    action: "New campaign created",
    user: "Sarah Johnson",
    avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=100&h=100&fit=crop&crop=face",
    color: "bg-[#4AD991]", // Matches Memories Created metric
    initials: "SJ"
  },
  {
    action: "3 media files uploaded",
    user: "Mike Chen",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    color: "bg-[#ED697B]", // Matches Media Uploaded metric
    initials: "MC"
  },
  {
    action: "Campaign published",
    user: "Emma Wilson",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    color: "bg-[#FEC53D]", // Matches Memories Published metric
    initials: "EW"
  },
  {
    action: "New user registered",
    user: "Alex Johnson",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    color: "bg-[#6C60FF]", // Matches Total Users metric
    initials: "AJ"
  },
  {
    action: "Campaign collection shared",
    user: "David Smith",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    color: "bg-[#FEC53D]", // Matches Memories Published metric (sharing related)
    initials: "DS"
  },
  {
    action: "Storage optimization completed",
    user: "System",
    avatar: null,
    color: "bg-[#4AD991]", // Use green for positive system actions
    initials: "SY"
  },
  {
    action: "Backup completed",
    user: "System",
    avatar: null,
    color: "bg-[#4AD991]", // Use green for positive system actions
    initials: "SY"
  },
  {
    action: "User settings updated",
    user: "Lisa Brown",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face",
    color: "bg-[#6C60FF]", // Matches Total Users metric (user-related action)
    initials: "LB"
  },
  {
    action: "Data export completed",
    user: "Tom Wilson",
    avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop&crop=face",
    color: "bg-[#ED697B]", // Matches Media Uploaded metric (data-related activity)
    initials: "TW"
  },
  {
    action: "New collaboration request",
    user: "Rachel Davis",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    color: "bg-[#6C60FF]", // Matches Total Users metric (user-related activity)
    initials: "RD"
  }
];

// Get Started Task Item Component
function TaskItem({
  icon,
  title,
  subtitle,
  completed,
  actionText,
  onClick
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  completed: boolean;
  actionText?: string;
  onClick?: () => void;
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${
      completed ? 'bg-green-50' : 'bg-gray-50'
    }`}>
      <div className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
        completed ? 'text-green-500' : 'text-gray-400'
      }`}>
        {completed ? <CheckCircle className="w-5 h-5" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`font-medium text-sm ${
          completed ? 'text-green-700' : 'text-gray-900'
        }`}>
          {title}
        </h4>
        <p className={`text-xs mt-1 ${
          completed ? 'text-green-600' : 'text-gray-600'
        }`}>
          {subtitle}
        </p>
        {actionText && onClick && (
          <button
            onClick={onClick}
            className="text-xs text-[#6C60FF] hover:text-[#5A4FE5] font-medium mt-2 flex items-center gap-1"
          >
            {actionText}
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({
  timePeriod,
  onTimePeriodChange,
  onNavigate,
  onMemorySelect
}: DashboardProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { switchToProperty } = useProperty();
  const { limitData, isLimitExceeded, isAICreditsExceeded } = useMemoryLimit();
  const { memoryCounts } = useMemoryCounts();

  const [recentActivity, setRecentActivity] = useState<any[]>(
    activityData.map(activity => ({
      ...activity,
      color: getActivityColor(activity.action)
    }))
  );
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  // Get actual memory count from the centralized hook
  const actualMemoryCount = memoryCounts?.total_memories || 0;

  // Check for pending property switch after login
  useEffect(() => {
    const checkPendingPropertySwitch = async () => {
      const pendingPropertySwitch = localStorage.getItem('pending_property_switch');

      if (pendingPropertySwitch && isAuthenticated && !authLoading) {
        console.log('🏠 Dashboard: Found pending property switch flag:', pendingPropertySwitch);

        try {
          // Add a small delay to ensure user data is fully loaded
          await new Promise(resolve => setTimeout(resolve, 500));

          // Fetch properties from API
          console.log('🏠 Dashboard: Fetching properties from API...');
          const propertiesResponse = await dashboardAPI.getProperties();
          console.log('🏠 Dashboard: Properties API response:', propertiesResponse);

          if (propertiesResponse.success && propertiesResponse.data) {
            const d = propertiesResponse.data.data || propertiesResponse.data;
            const allProperties = [
              ...(d.owned_properties || []),
              ...(d.shared_properties || []),
              ...(d.all_properties || d.properties || [])
            ];
            console.log('🏠 Dashboard: All properties count:', allProperties.length);
            console.log('🏠 Dashboard: All properties:', allProperties);

            if (pendingPropertySwitch === 'first') {
              // Switch to the FIRST property from the list
              console.log('🏠 Dashboard: Property mode enabled, switching to first property...');

              if (allProperties.length > 0) {
                const firstProperty = allProperties[0];
                console.log('🏠 Dashboard: First property:', firstProperty);
                console.log('🏠 Dashboard: Switching to property:', firstProperty.name);

                switchToProperty(firstProperty);

                // Clear the pending flag
                localStorage.removeItem('pending_property_switch');
                console.log('🏠 Dashboard: Property switch completed and flag cleared');
              } else {
                console.error('🏠 Dashboard: No properties found for this user');
                console.error('🏠 Dashboard: User might not have access to any properties yet');
                // Don't clear the flag - maybe retry later
              }
            } else {
              // Legacy support: if it's a specific property ID
              const selectedProperty = allProperties.find((prop: any) => String(prop.id) === String(pendingPropertySwitch));

              if (selectedProperty) {
                console.log('🏠 Dashboard: Switching to property ID:', pendingPropertySwitch);
                switchToProperty(selectedProperty);
                localStorage.removeItem('pending_property_switch');
                console.log('🏠 Dashboard: Property switch completed and flag cleared');
              } else {
                console.error('🏠 Dashboard: Property ID', pendingPropertySwitch, 'not found');
              }
            }
          } else {
            console.error('🏠 Dashboard: Failed to fetch properties:', propertiesResponse);
            // Don't clear the flag - retry later
          }
        } catch (error) {
          console.error('🏠 Dashboard: Error during property switch:', error);
          // Don't clear the flag - retry later
        }
      } else {
        if (pendingPropertySwitch) {
          console.log('🏠 Dashboard: Pending property switch exists but waiting for auth:', {
            pendingPropertySwitch,
            isAuthenticated,
            authLoading
          });
        }
      }
    };

    checkPendingPropertySwitch();
  }, [isAuthenticated, authLoading, switchToProperty]);

  // Get Started tasks based on real user activity
  const getStartedTasks = [
    {
      icon: <Upload className="w-5 h-5" />,
      title: "Upload Media",
      subtitle: "Add your first photos and videos",
      completed: (memoryCounts?.total_memory_images || 0) > 0,
    },
    {
      icon: <FileText className="w-5 h-5" />,
      title: "Create Campaign",
      subtitle: "Organize your media into campaigns",
      completed: (memoryCounts?.total_memories || 0) > 0,
    },
    {
      icon: <UserPlus className="w-5 h-5" />,
      title: "Invite Collaborators",
      subtitle: "Share campaigns with friends and family",
      completed: (memoryCounts?.active_collaborators || 0) > 0,
      actionText: (memoryCounts?.active_collaborators || 0) > 0 ? undefined : "Find Campaigns",
      onClick: (memoryCounts?.active_collaborators || 0) > 0 ? undefined : () => onNavigate('memories')
    },
    {
      icon: (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 448 512"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M352 224c53 0 96-43 96-96s-43-96-96-96s-96 43-96 96c0 4 .2 8 .7 11.9l-94.1 47C145.4 170.2 121.9 160 96 160c-53 0-96 43-96 96s43 96 96 96c25.9 0 49.4-10.2 66.6-26.9l94.1 47c-.5 3.9-.7 7.8-.7 11.9c0 53 43 96 96 96s96-43 96-96s-43-96-96-96c-25.9 0-49.4 10.2-66.6 26.9l-94.1-47c.5-3.9 .7-7.8 .7-11.9s-.2-8-.7-11.9l94.1-47C302.6 213.8 326.1 224 352 224z"/>
        </svg>
      ),
      title: "Publish Campaign",
      subtitle: "Make a campaign publicly available",
      completed: (memoryCounts?.published_memories || 0) > 0,
      actionText: (memoryCounts?.published_memories || 0) > 0 ? undefined : "View Campaigns",
      onClick: (memoryCounts?.published_memories || 0) > 0 ? undefined : () => onNavigate('memories')
    }
  ];

  const completedTasks = getStartedTasks.filter(task => task.completed).length;
  const totalTasks = getStartedTasks.length;
  const remainingTasks = totalTasks - completedTasks;

  // Fetch recent activity data from API
  const fetchRecentActivity = async () => {
    try {
      setIsLoadingActivity(true);
      const response = await dashboardAPI.getRecentActivity(timePeriod);
      
      if (response.success && response.data) {
        // Handle double nesting: apiRequest wraps the API response
        const actualData = response.data.data || response.data;
        // Apply consistent color mapping to API data
        const colorMappedData = actualData.map((activity: any) => ({
          ...activity,
          color: getActivityColor(activity.action)
        }));
        setRecentActivity(colorMappedData);
      } else {
        // Fallback to mock data with consistent colors
        const colorMappedMockData = activityData.map(activity => ({
          ...activity,
          color: getActivityColor(activity.action)
        }));
        setRecentActivity(colorMappedMockData);
      }
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      // Fallback to mock data with consistent colors
      const colorMappedMockData = activityData.map(activity => ({
        ...activity,
        color: getActivityColor(activity.action)
      }));
      setRecentActivity(colorMappedMockData);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  // Fetch activity data when timePeriod changes, but only if authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchRecentActivity();
      // Memory counts are now handled by the useMemoryCounts hook automatically
    }
  }, [timePeriod, isAuthenticated, authLoading]);

  return (
    <div className="w-full space-y-4 md:space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3 px-0 md:px-4">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden md:block text-sm text-gray-500 italic">
            [Last updated: {new Date().toLocaleTimeString()}]
          </div>
          <div className="flex items-center gap-2">
            {/* <span className="text-sm text-gray-600">Time period:</span> */}
            <TimePeriodSelector
              defaultValue="weekly"
              onValueChange={onTimePeriodChange}
            />
          </div>
        </div>
      </div>

      {/* Memory Limit Alert - Only show when limit is exceeded */}
      {isLimitExceeded && (
        <div className="w-full px-0 md:px-4">
          <Alert className="border-amber-200 bg-amber-50 text-amber-800 !justify-start !text-left w-full">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900 font-semibold !text-left">Campaign Storage Limit Reached</AlertTitle>
            <AlertDescription className="text-amber-700 !text-left">
              You have reached your campaign limit {actualMemoryCount}/{limitData.memory_limit || 0} for this plan
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* AI Credits Limit Alert - Only show when AI credits are exhausted */}
      {isAICreditsExceeded && (
        <div className="w-full px-0 md:px-4">
          <Alert className="border-amber-200 bg-amber-50 text-amber-800 !justify-start !text-left w-full">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900 font-semibold !text-left">AI Credits Limit Reached</AlertTitle>
            <AlertDescription className="text-amber-700 !text-left">
              Your AI credits have been exhausted. You have 0 AI credits remaining.
              <button
                onClick={() => onNavigate?.('billing')}
                className="font-medium text-amber-800 hover:text-amber-900 underline ml-1 cursor-pointer bg-transparent border-none p-0"
              >
                Please purchase AI credits here
              </button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Stats Cards */}
      <div className="relative">
        <Frame192 timePeriod={timePeriod} />
      </div>

      {/* Get Started Section - Mobile Only - Hide when all tasks are completed */}
      {remainingTasks > 0 && (
        <div className="md:hidden bg-white rounded-xl border border-gray-100 p-4 sm:p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="font-medium text-sm text-gray-900 mb-1">Get Started</h3>
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
              {remainingTasks} {remainingTasks === 1 ? 'task' : 'tasks'} remaining
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
                actionText={task.actionText}
                onClick={task.onClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid - Hidden on mobile */}
      <div className="hidden md:grid grid-cols-1 xl:grid-cols-4 gap-8 px-0 md:px-4">
        {/* Weekly Engagement Chart - Takes 3/4 of width */}
        <div className="xl:col-span-3">
          <div className="h-96 w-full">
            <WeeklyEngCard globalTimePeriod={timePeriod} />
          </div>
        </div>

        {/* Side Panel */}
        <div className="h-96">
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm h-full flex flex-col">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 flex-shrink-0">Recent Activity</h2>
            <div className="space-y-4 flex-1 overflow-y-auto">
              {isLoadingActivity ? (
                // Loading skeleton
                [...Array(6)].map((_, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-gray-200 rounded-full flex-shrink-0 mt-3 animate-pulse"></div>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-7 h-7 bg-gray-200 rounded-full flex-shrink-0 animate-pulse"></div>
                      <div className="flex-1 min-w-0">
                        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 mt-1 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className={`w-2 h-2 ${activity.color} rounded-full flex-shrink-0 mt-3`}></div>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="w-7 h-7 flex-shrink-0">
                        {activity.avatar ? (
                          <AvatarImage src={activity.avatar} alt={activity.user} />
                        ) : null}
                        <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                          {activity.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {activity.action}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {activity.user === "System" ? "System" : `by ${activity.user}`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User Activity Metrics Section */}
      <div className="w-full">
        <Frame732 timePeriod={timePeriod} />
      </div>

      {/* Memories Section */}
      <div className="w-full">
        <Frame189 onNavigate={onNavigate} onMemorySelect={onMemorySelect} />
      </div>
    </div>
  );
}