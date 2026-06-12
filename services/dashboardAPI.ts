// Dashboard API service functions
import { apiRequest } from '../utils/authUtils';

// Dashboard API response interfaces
export interface DashboardData {
  totalMemories: number;
  totalMedia: number;
  totalUsers: number;
  publishedMemories: number;
  storageUsed: string;
  storageLimit: string;
  recentActivity: ActivityItem[];
  growthRate: number;
}

export interface UserEngagementData {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  avgSessionDuration: string;
  engagementRate: number;
  chartData: EngagementChartData[];
}

export interface EngagementChartData {
  date: string;
  users: number;
  sessions: number;
  duration: number;
}

export interface ActivityMetricsData {
  totalViews: number;
  totalShares: number;
  totalComments: number;
  totalLikes: number;
  growthMetrics: {
    views: number;
    shares: number;
    comments: number;
    likes: number;
  };
  chartData: ActivityChartData[];
}

export interface ActivityChartData {
  date: string;
  views: number;
  shares: number;
  comments: number;
  likes: number;
}

export interface PublishedMemoriesData {
  totalPublished: number;
  publishedToday: number;
  publishedThisWeek: number;
  publishedThisMonth: number;
  popularCategories: CategoryData[];
  recentPublished: PublishedMemory[];
}

export interface CategoryData {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface PublishedMemory {
  id: string;
  title: string;
  category: string;
  publishedAt: string;
  views: number;
  likes: number;
  thumbnail?: string;
}

export interface ActivityItem {
  id: string;
  type: 'memory_created' | 'memory_published' | 'user_joined' | 'media_uploaded' | 'comment_added' | 'memory_shared';
  title: string;
  description: string;
  user: {
    name: string;
    avatar?: string;
  };
  timestamp: string;
  metadata?: {
    memoryId?: string;
    memoryTitle?: string;
    mediaCount?: number;
    [key: string]: any;
  };
}

// Dashboard API service
export const dashboardAPI = {
  // Get main dashboard data
  getDashboard: async (): Promise<DashboardData | null> => {
    try {
      const response = await apiRequest<DashboardData>('/dashboard');
      return response.success ? response.data || null : null;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      return null;
    }
  },

  // Get user engagement data
  getUserEngagement: async (): Promise<UserEngagementData | null> => {
    try {
      const response = await apiRequest<UserEngagementData>('/dashboard/user-engagement');
      return response.success ? response.data || null : null;
    } catch (error) {
      console.error('Error fetching user engagement data:', error);
      return null;
    }
  },

  // Get activity metrics
  getActivityMetrics: async (): Promise<ActivityMetricsData | null> => {
    try {
      const response = await apiRequest<ActivityMetricsData>('/dashboard/activity-metrics');
      return response.success ? response.data || null : null;
    } catch (error) {
      console.error('Error fetching activity metrics:', error);
      return null;
    }
  },

  // Get published memories data
  getPublishedMemories: async (): Promise<PublishedMemoriesData | null> => {
    try {
      const response = await apiRequest<PublishedMemoriesData>('/dashboard/published-memories');
      return response.success ? response.data || null : null;
    } catch (error) {
      console.error('Error fetching published memories:', error);
      return null;
    }
  },

  // Get recent activity
  getRecentActivity: async (): Promise<ActivityItem[] | null> => {
    try {
      const response = await apiRequest<ActivityItem[]>('/dashboard/recent-activity');
      return response.success ? response.data || null : null;
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      return null;
    }
  },

  // Get all dashboard data at once
  getAllDashboardData: async () => {
    try {
      const [
        dashboard,
        userEngagement,
        activityMetrics,
        publishedMemories,
        recentActivity
      ] = await Promise.all([
        dashboardAPI.getDashboard(),
        dashboardAPI.getUserEngagement(),
        dashboardAPI.getActivityMetrics(),
        dashboardAPI.getPublishedMemories(),
        dashboardAPI.getRecentActivity()
      ]);

      return {
        dashboard,
        userEngagement,
        activityMetrics,
        publishedMemories,
        recentActivity
      };
    } catch (error) {
      console.error('Error fetching all dashboard data:', error);
      return {
        dashboard: null,
        userEngagement: null,
        activityMetrics: null,
        publishedMemories: null,
        recentActivity: null
      };
    }
  }
};

// Utility functions for data formatting
export const formatters = {
  // Format numbers with K/M suffixes
  formatNumber: (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  },

  // Format percentage with + or - sign
  formatGrowth: (growth: number): string => {
    const sign = growth > 0 ? '+' : '';
    return `${sign}${growth.toFixed(1)}%`;
  },

  // Format date for display
  formatDate: (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  // Format time for display
  formatTime: (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Format relative time (e.g., "2 hours ago")
  formatRelativeTime: (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }

    return formatters.formatDate(dateString);
  },

  // Get activity icon based on type
  getActivityIcon: (type: ActivityItem['type']): string => {
    const iconMap = {
      memory_created: '📝',
      memory_published: '🚀',
      user_joined: '👋',
      media_uploaded: '📷',
      comment_added: '💬',
      memory_shared: '🔗'
    };
    return iconMap[type] || '📋';
  },

  // Get activity color based on type
  getActivityColor: (type: ActivityItem['type']): string => {
    const colorMap = {
      memory_created: 'bg-blue-100 text-blue-800',
      memory_published: 'bg-green-100 text-green-800',
      user_joined: 'bg-purple-100 text-purple-800',
      media_uploaded: 'bg-orange-100 text-orange-800',
      comment_added: 'bg-pink-100 text-pink-800',
      memory_shared: 'bg-indigo-100 text-indigo-800'
    };
    return colorMap[type] || 'bg-gray-100 text-gray-800';
  }
};

export default dashboardAPI;