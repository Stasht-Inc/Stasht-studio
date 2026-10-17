import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Database, Users, Image, Activity } from 'lucide-react';
import { dashboardAPI } from '../utils/authUtils';
import { useAuth } from '../contexts/AuthContext';

// Mock data generation for realistic stats
const generateStatsData = () => {
  const baseMemories = 1249;
  const baseMedia = 8567;
  const baseUsers = 426;
  const baseDataUsage = 3560;
  
  return {
    memories: {
      current: baseMemories + Math.floor(Math.random() * 50 - 25),
      change: (Math.random() * 20 - 10).toFixed(1),
      trend: Math.random() > 0.3 ? 'up' : 'down'
    },
    media: {
      current: baseMedia + Math.floor(Math.random() * 200 - 100),
      change: (Math.random() * 15 - 5).toFixed(1),
      trend: Math.random() > 0.4 ? 'up' : 'down'
    },
    users: {
      current: baseUsers + Math.floor(Math.random() * 20 - 10),
      change: (Math.random() * 8 - 4).toFixed(1),
      trend: Math.random() > 0.4 ? 'up' : 'down'
    },
    dataUsage: {
      current: baseDataUsage + Math.floor(Math.random() * 100 - 50),
      max: 5,
      maxUnit: 'G',
      change: (Math.random() * 10 - 5).toFixed(1),
      trend: Math.random() > 0.5 ? 'up' : 'down'
    }
  };
};

// "this week" / "last week" etc. for the selected dashboard period.
const PERIOD_WORDS: Record<string, { current: string; previous: string }> = {
  daily: { current: 'today', previous: 'yesterday' },
  weekly: { current: 'this week', previous: 'last week' },
  monthly: { current: 'this month', previous: 'last month' },
  annually: { current: 'this year', previous: 'last year' },
};
const periodWords = (timePeriod: string) => PERIOD_WORDS[timePeriod] ?? { current: 'this period', previous: 'last period' };

// The value each "Total" card shows is all-time (ClickUp S7). The secondary line is what was
// added in the selected period ("+3 this week"), plus — when there is a previous period to
// compare with — the % change in additions vs that period.
function PeriodLine({
  added,
  previous,
  change,
  trend,
  timePeriod,
}: {
  added: string; // already formatted, e.g. "3" or "12.5 MB"
  previous?: number;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  timePeriod: string;
}) {
  const words = periodWords(timePeriod);
  const isZero = parseFloat(added) === 0;
  const showChange = (previous ?? 0) > 0 && trend !== 'neutral';

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
      <span
        className={`text-xs md:text-sm font-medium ${isZero ? 'text-gray-500' : 'text-green-600'}`}
        data-testid="stat-period-added"
      >
        +{added} {words.current}
      </span>
      {showChange && (
        <span
          className={`flex items-center gap-1 text-xs md:text-sm ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}
          title={`Added ${words.current} compared with ${words.previous}`}
        >
          {trend === 'up' ? <TrendingUp className="w-3 h-3 shrink-0" /> : <TrendingDown className="w-3 h-3 shrink-0" />}
          <span>
            {trend === 'up' ? '+' : '-'}{change}% <span className="text-gray-500">vs {words.previous}</span>
          </span>
        </span>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subValue,
  change,
  trend,
  icon,
  iconColor,
  iconBg,
  isStorage = false,
  availableFormatted,
  timePeriod = 'weekly',
  periodAdded,
  previousCount,
}: {
  title: string;
  value: string;
  subValue?: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  isStorage?: boolean;
  availableFormatted?: string;
  timePeriod?: string;
  // Present when the API sends period figures (ClickUp S7); older API responses fall back to
  // the legacy "% from last week" line.
  periodAdded?: string;
  previousCount?: number;
}) {
  const changeNum = parseFloat(change);

  if (periodAdded !== undefined) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 md:p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-gray-200 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-3 md:mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-1 md:mb-2">{title}</h3>
            <div className="flex flex-wrap items-baseline gap-x-1 min-w-0">
              <span className="text-xl md:text-2xl font-semibold text-gray-900 whitespace-nowrap" data-testid="stat-total">{value}</span>
              {subValue && (
                <span className="text-xs md:text-sm text-gray-500 shrink-0">/{subValue}</span>
              )}
            </div>
          </div>
          <div className={`p-2 md:p-3 rounded-lg shrink-0 ${iconBg}`}>
            <div className={`w-5 h-5 md:w-6 md:h-6 ${iconColor}`}>
              {icon}
            </div>
          </div>
        </div>

        <PeriodLine
          added={periodAdded}
          previous={previousCount}
          change={change}
          trend={trend}
          timePeriod={timePeriod}
        />
        {isStorage && availableFormatted && (
          <div className="flex items-center gap-1 text-gray-500 mt-1">
            <Database className="w-3 h-3 shrink-0" />
            <span className="text-xs md:text-sm">{availableFormatted} available</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 md:p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-gray-200 flex-1">
      <div className="flex items-start justify-between mb-3 md:mb-4">
        <div className="flex-1">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-1 md:mb-2">{title}</h3>
          <div className="flex items-baseline gap-1">
            <span className="text-xl md:text-2xl font-semibold text-gray-900">{value}</span>
            {subValue && (
              <span className="text-xs md:text-sm text-gray-500">/{subValue}</span>
            )}
          </div>
        </div>
        <div className={`p-2 md:p-3 rounded-lg ${iconBg}`}>
          <div className={`w-5 h-5 md:w-6 md:h-6 ${iconColor}`}>
            {icon}
          </div>
        </div>
      </div>

      {isStorage ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-green-600">
            <Database className="w-3 h-3" />
            <span className="text-xs md:text-sm font-medium">
              {availableFormatted ? `${availableFormatted} available` : '1.4GB available'}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 ${
            trend === 'up'
              ? changeNum >= 0
                ? 'text-green-600'
                : 'text-red-600'
              : changeNum >= 0
                ? 'text-red-600'
                : 'text-green-600'
          }`}>
            {trend === 'up' ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span className="text-xs md:text-sm font-medium">
              {changeNum >= 0 ? '+' : ''}{change}%
            </span>
          </div>
          <span className="text-xs md:text-sm text-gray-500 hidden md:inline">from last {timePeriod === 'daily' ? 'day' : timePeriod === 'weekly' ? 'week' : timePeriod === 'monthly' ? 'month' : timePeriod === 'annually' ? 'year' : 'period'}</span>
          <span className="text-xs text-gray-500 md:hidden">Live data</span>
        </div>
      )}
    </div>
  );
}

export default function Frame192({ timePeriod = 'weekly' }: { timePeriod?: string }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Function to fetch live dashboard data
  const fetchDashboardData = async () => {
    try {
      setIsUpdating(true);
      console.log('=== MAIN DASHBOARD API CALL ===');
      console.log('Time Period:', timePeriod);
      console.log('API URL:', `/dashboard?type=${timePeriod}`);
      
      const response = await dashboardAPI.getDashboard(timePeriod);
      console.log('Raw Dashboard API Response:', response);
      
      if (response.success && response.data) {
        // Handle double nesting: apiRequest wraps the API response
        const actualData = response.data.data || response.data;
        console.log('Processed Dashboard Data:', actualData);
        const apiData = actualData.statistics;
        console.log('Statistics Data from API:', apiData);
        console.log('Storage Data from API:', apiData?.storage);
        
        if (apiData) {
          // Transform API data to match component structure
          // `count` is the all-time total; `period_count` / `previous_period_count` are what was
          // added in the selected period and the one before (absent on older API builds).
          const card = (c: any) => ({
            current: c.count,
            change: String(c.percentage?.value ?? 0),
            trend: c.percentage?.trend === 'up' ? 'up' : c.percentage?.trend === 'neutral' ? 'neutral' : 'down',
            periodCount: typeof c.period_count === 'number' ? c.period_count : undefined,
            previousCount: typeof c.previous_period_count === 'number' ? c.previous_period_count : undefined,
          });
          const transformedStats = {
          memories: card(apiData.total_memories),
          media: card(apiData.total_media),
          users: card(apiData.total_users),
          dataUsage: {
            periodFormatted: apiData.storage.period_formatted as string | undefined,
            current: apiData.storage.formatted || Math.round(apiData.storage.used), // Show formatted value (like '37.72 B')
            max: apiData.storage.limit_formatted ? apiData.storage.limit_formatted.replace(/[^0-9.]/g, '') : 5, // Extract number from limit_formatted
            maxUnit: apiData.storage.limit_formatted ? apiData.storage.limit_formatted.replace(/[0-9.]/g, '') : 'G', // Extract unit from limit_formatted
            change: apiData.storage.percentage?.value?.toString() || "0",
            trend: apiData.storage.percentage?.trend === 'up' ? 'up' : 'down',
            availableFormatted: apiData.storage.available_formatted // Keep for green text display
          }
          };
          
          console.log('Transformed Stats for UI:', transformedStats);
          setStats(transformedStats);
        } else {
          console.log('No statistics found in API response, using fallback generated data');
          // Fallback if statistics not in response
          setStats(generateStatsData());
        }
      } else {
        console.log('Dashboard API call failed - Response:', response);
        console.log('Using fallback generated data for failed API call');
        // Fallback to mock data if API fails
        setStats(generateStatsData());
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      console.log('Using fallback generated data due to error');
      // Fallback to mock data on error
      setStats(generateStatsData());
    } finally {
      setIsUpdating(false);
      setIsLoading(false);
      console.log('=== END MAIN DASHBOARD API CALL ===');
    }
  };

  // Fetch data on component mount and when timePeriod changes, but only if authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchDashboardData();
    }
  }, [timePeriod, isAuthenticated, authLoading]);

  // Auto-refresh stats every 15 seconds, but only if authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      const interval = setInterval(() => {
        fetchDashboardData();
      }, 15000);

      return () => clearInterval(interval);
    }
  }, [timePeriod, isAuthenticated, authLoading]);

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toLocaleString();
  };

  // Show loading state while fetching initial data
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 w-full">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 md:p-6 shadow-sm animate-pulse">
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-200 rounded-lg"></div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 w-full transition-opacity duration-300 px-0 md:px-4 ${
      isUpdating ? 'opacity-75' : 'opacity-100'
    }`}>
      <StatCard
        title="Total Campaigns"
        value={formatNumber(stats.memories.current)}
        change={stats.memories.change}
        trend={stats.memories.trend}
        icon={<Activity />}
        iconColor="text-green-600"
        iconBg="bg-green-50"
        timePeriod={timePeriod}
        periodAdded={stats.memories.periodCount !== undefined ? formatNumber(stats.memories.periodCount) : undefined}
        previousCount={stats.memories.previousCount}
      />

      <StatCard
        title="Total Media"
        value={formatNumber(stats.media.current)}
        change={stats.media.change}
        trend={stats.media.trend}
        icon={<Image />}
        iconColor="text-pink-600"
        iconBg="bg-pink-50"
        timePeriod={timePeriod}
        periodAdded={stats.media.periodCount !== undefined ? formatNumber(stats.media.periodCount) : undefined}
        previousCount={stats.media.previousCount}
      />

      <StatCard
        title="Total Users"
        value={formatNumber(stats.users.current)}
        change={stats.users.change}
        trend={stats.users.trend}
        icon={<Users />}
        iconColor="text-blue-600"
        iconBg="bg-blue-50"
        timePeriod={timePeriod}
        periodAdded={stats.users.periodCount !== undefined ? formatNumber(stats.users.periodCount) : undefined}
        previousCount={stats.users.previousCount}
      />

      <StatCard
        title="Storage"
        value={typeof stats.dataUsage.current === 'string' ? stats.dataUsage.current : formatNumber(stats.dataUsage.current)}
        subValue={`${stats.dataUsage.max}${stats.dataUsage.maxUnit}`}
        change="0"
        trend="neutral"
        icon={<Database />}
        iconColor="text-purple-600"
        iconBg="bg-purple-50"
        isStorage={true}
        availableFormatted={stats.dataUsage.availableFormatted}
        timePeriod={timePeriod}
        periodAdded={stats.dataUsage.periodFormatted}
      />
      
      {isUpdating && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white bg-opacity-90 rounded-lg px-3 py-2 shadow-md">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#54CC8B]"></div>
              <span className="text-sm text-gray-600">Updating...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}