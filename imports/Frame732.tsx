"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { dashboardAPI } from '../utils/authUtils';
import { useAuth } from '../contexts/AuthContext';

// Dynamic data generation based on time period
const generateActivityData = (timePeriod: string) => {
  const baseData = {
    daily: [
      { date: 'Mon', memories: 12, media: 8, users: 6, published: 4 },
      { date: 'Tue', memories: 8, media: 5, users: 9, published: 3 },
      { date: 'Wed', memories: 15, media: 4, users: 11, published: 2 },
      { date: 'Thu', memories: 7, media: 10, users: 5, published: 8 },
      { date: 'Fri', memories: 11, media: 9, users: 8, published: 6 },
      { date: 'Sat', memories: 18, media: 12, users: 4, published: 9 },
      { date: 'Sun', memories: 14, media: 7, users: 3, published: 5 },
    ],
    weekly: [
      { date: 'Week 1', memories: 64, media: 48, users: 32, published: 24 },
      { date: 'Week 2', memories: 58, media: 42, users: 38, published: 21 },
      { date: 'Week 3', memories: 72, media: 55, users: 45, published: 28 },
      { date: 'Week 4', memories: 68, media: 51, users: 41, published: 26 },
      { date: 'Week 5', memories: 75, media: 59, users: 48, published: 31 },
      { date: 'Week 6', memories: 62, media: 46, users: 35, published: 23 },
      { date: 'Week 7', memories: 69, media: 53, users: 43, published: 29 },
    ],
    monthly: [
      { date: 'Jan', memories: 280, media: 215, users: 165, published: 120 },
      { date: 'Feb', memories: 245, media: 185, users: 142, published: 98 },
      { date: 'Mar', memories: 320, media: 240, users: 188, published: 145 },
      { date: 'Apr', memories: 295, media: 225, users: 172, published: 132 },
      { date: 'May', memories: 340, media: 260, users: 205, published: 158 },
      { date: 'Jun', memories: 285, media: 210, users: 165, published: 125 },
      { date: 'Jul', memories: 305, media: 235, users: 180, published: 140 },
    ],
    annually: [
      { date: '2019', memories: 2800, media: 2100, users: 1200, published: 950 },
      { date: '2020', memories: 3200, media: 2400, users: 1450, published: 1100 },
      { date: '2021', memories: 3600, media: 2700, users: 1680, published: 1250 },
      { date: '2022', memories: 4100, media: 3100, users: 1920, published: 1450 },
      { date: '2023', memories: 4500, media: 3400, users: 2150, published: 1680 },
      { date: '2024', memories: 5200, media: 3900, users: 2480, published: 1920 },
      { date: '2025', memories: 1850, media: 1400, users: 890, published: 720 },
    ]
  };

  return baseData[timePeriod as keyof typeof baseData] || baseData.weekly;
};

// Dynamic data for pie chart based on time period
const generatePublishedData = (timePeriod: string) => {
  const multipliers = {
    daily: 1,
    weekly: 7,
    monthly: 30,
    annually: 365
  };
  
  const multiplier = multipliers[timePeriod as keyof typeof multipliers] || 7;
  const baseViewed = 580 * multiplier;
  const baseUnopened = 280 * multiplier;
  
  return [
    { name: 'Viewed', value: baseViewed, color: '#4AD991' },
    { name: 'Unopened', value: baseUnopened, color: '#D9D9D9' },
  ];
};

const COLORS = ['#4AD991', '#D9D9D9'];

// Custom tooltip component for the bar chart
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200 min-w-[200px]">
        <p className="font-semibold text-gray-900 mb-3 text-sm">{label}</p>
        <div className="space-y-2">
          {payload.slice().reverse().map((entry: any, index: number) => {
            const colors = {
              memories: '#4AD991',
              media: '#ED697B', 
              users: '#6C60FF',
              published: '#FEC53D'
            };
            const labels = {
              memories: 'Memories Created',
              media: 'Media Uploaded',
              users: 'Total Users',
              published: 'Memories Published'
            };
            
            return (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: colors[entry.dataKey as keyof typeof colors] }}
                  ></div>
                  <span className="text-sm text-gray-600">
                    {labels[entry.dataKey as keyof typeof labels]}
                  </span>
                </div>
                <span className="font-semibold text-gray-900 text-sm">
                  {entry.value.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Total</span>
            <span className="font-bold text-gray-900">
              {payload.reduce((sum: number, entry: any) => sum + entry.value, 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

// Custom tooltip component for the pie chart
function PieTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const percentage = ((data.value / (4060 + 1996)) * 100).toFixed(1); // Total based on current data
    
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: data.color }}
          ></div>
          <span className="font-semibold text-gray-900">{data.name}</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Count:</span>
            <span className="font-medium">{data.value.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Percentage:</span>
            <span className="font-medium">{percentage}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function ActivityMetricsCard({ timePeriod }: { timePeriod: string }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Function to fetch activity metrics data
  const fetchActivityMetrics = async () => {
    try {
      setIsLoading(true);
      console.log('=== ACTIVITY METRICS API CALL ===');
      console.log('Time Period:', timePeriod);
      console.log('API URL:', `/dashboard/activity-metrics?type=${timePeriod}`);
      
      const response = await dashboardAPI.getActivityMetrics(timePeriod);
      console.log('Raw Activity Metrics API Response:', response);
      
      if (response.success && response.data) {
        // Handle double nesting: apiRequest wraps the API response
        const actualData = response.data.data || response.data;
        console.log('Processed Activity Metrics Data:', actualData);
        console.log('Chart Data from Activity Metrics API:', actualData.chart_data);
        setApiData(actualData);
      } else {
        console.log('Activity Metrics API call failed - Response:', response);
        console.log('Using fallback generated data for failed API call');
        setApiData(null);
      }
    } catch (error) {
      console.error('Error fetching activity metrics:', error);
      console.log('Using fallback generated data due to error');
      setApiData(null);
    } finally {
      setIsLoading(false);
      console.log('=== END ACTIVITY METRICS API CALL ===');
    }
  };

  // Fetch data when authenticated and time period changes
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchActivityMetrics();
    }
  }, [timePeriod, isAuthenticated, authLoading]);

  // Use API data if available, otherwise fallback to generated data
  const activityData = apiData?.chart_data ? 
    apiData.chart_data.map((item: any) => ({
      date: item.label,
      memories: item.memories_created,
      media: item.media_uploaded,
      users: item.total_users,
      published: item.memories_published
    })) : generateActivityData(timePeriod);
  
  // Show loading state while fetching data
  if (isLoading && (!apiData || authLoading)) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 px-6 pt-6 pb-0 shadow-sm h-[500px] flex-1">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="flex gap-4 mb-6">
            <div className="h-4 bg-gray-200 rounded w-32"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-4 bg-gray-200 rounded w-28"></div>
            <div className="h-4 bg-gray-200 rounded w-36"></div>
          </div>
          <div className="h-80 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 md:px-6 md:pt-6 md:pb-0 shadow-sm md:h-[500px] lg:flex-1">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">
          User Activity Metrics ({timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)})
        </h3>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 md:gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#4AD991]"></div>
            <span className="text-xs md:text-sm text-gray-600">Stories</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#ED697B]"></div>
            <span className="text-xs md:text-sm text-gray-600">Media</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#6C60FF]"></div>
            <span className="text-xs md:text-sm text-gray-600">Users</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#FEC53D]"></div>
            <span className="text-xs md:text-sm text-gray-600">Published</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[250px] md:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={activityData}
            margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6B7280' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6B7280' }}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(108, 96, 255, 0.1)' }}
            />
            <Bar
              dataKey="memories"
              stackId="a"
              fill="#4AD991"
              radius={[0, 0, 0, 0]}
              className="hover:opacity-80 transition-opacity cursor-pointer"
            />
            <Bar
              dataKey="media"
              stackId="a"
              fill="#ED697B"
              radius={[0, 0, 0, 0]}
              className="hover:opacity-80 transition-opacity cursor-pointer"
            />
            <Bar
              dataKey="users"
              stackId="a"
              fill="#6C60FF"
              radius={[0, 0, 0, 0]}
              className="hover:opacity-80 transition-opacity cursor-pointer"
            />
            <Bar
              dataKey="published"
              stackId="a"
              fill="#FEC53D"
              radius={[2, 2, 0, 0]}
              className="hover:opacity-80 transition-opacity cursor-pointer"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PublishedMemoriesCard({ timePeriod }: { timePeriod: string }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Function to fetch published memories data
  const fetchPublishedMemories = async () => {
    try {
      setIsLoading(true);
      console.log('=== PUBLISHED MEMORIES API CALL ===');
      console.log('Time Period:', timePeriod);
      console.log('API URL:', `/dashboard/published-memories?type=${timePeriod}`);
      
      const response = await dashboardAPI.getPublishedMemories(timePeriod);
      console.log('Raw Published Memories API Response:', response);
      
      if (response.success && response.data) {
        // Handle double nesting: apiRequest wraps the API response
        const actualData = response.data.data || response.data;
        console.log('Processed Published Memories Data:', actualData);
        console.log('Viewed Data:', actualData.viewed);
        console.log('Unopened Data:', actualData.unopened);
        console.log('Total Data:', actualData.total);
        setApiData(actualData);
      } else {
        console.log('Published Memories API call failed - Response:', response);
        console.log('Using fallback generated data for failed API call');
        setApiData(null);
      }
    } catch (error) {
      console.error('Error fetching published memories:', error);
      console.log('Using fallback generated data due to error');
      setApiData(null);
    } finally {
      setIsLoading(false);
      console.log('=== END PUBLISHED MEMORIES API CALL ===');
    }
  };

  // Fetch data when authenticated and time period changes
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchPublishedMemories();
    }
  }, [timePeriod, isAuthenticated, authLoading]);

  // Generate chart data from API or fallback to mock data
  const publishedData = apiData ? [
    { name: 'Viewed', value: apiData.viewed.count, color: '#4AD991' },
    { name: 'Unopened', value: apiData.unopened.count, color: '#D9D9D9' },
  ] : generatePublishedData(timePeriod);
  
  const totalViews = publishedData.reduce((sum, item) => sum + item.value, 0);
  const viewedPercentage = totalViews > 0 ? ((publishedData[0].value / totalViews) * 100).toFixed(1) : "0";

  // Get trend information from API
  const trendData = apiData?.total?.trend;
  const getTrendIcon = () => {
    if (trendData?.direction === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trendData?.direction === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };
  
  const getTrendColor = () => {
    if (trendData?.direction === 'up') return 'text-green-500';
    if (trendData?.direction === 'down') return 'text-red-500';
    return 'text-gray-500';
  };

  // Show loading state while fetching data
  if (isLoading && (!apiData || authLoading)) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm h-[500px] flex-1 flex flex-col">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="flex items-center justify-center flex-1">
            <div className="w-48 h-48 bg-gray-200 rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 md:p-6 shadow-sm min-h-[350px] md:h-[500px] lg:flex-1 flex flex-col">
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">
          Published Stories: Viewed vs Unopened ({timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)})
        </h3>

        {/* Main Stat */}
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div>
            <div className="text-xl md:text-2xl font-bold text-gray-900">
              Viewed: {publishedData[0].value.toLocaleString()}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {getTrendIcon()}
              <span className="text-xs md:text-sm">
                <span className={`font-medium ${getTrendColor()}`}>
                  {trendData?.percentage || 0}%
                </span>
                <span className="text-gray-500 ml-1">
                  {trendData?.direction === 'up' ? 'Up from last period' :
                   trendData?.direction === 'down' ? 'Down from last period' :
                   'No change from last period'}
                </span>
              </span>
            </div>
            {apiData && (
              <div className="text-sm text-gray-500 mt-1">
                {/* Total: {apiData.total.count.toLocaleString()} published memories */}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart and Legend */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 flex-1 min-h-0 pt-2 md:pt-4">
        {/* Pie Chart */}
        <div className="flex-shrink-0 w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={publishedData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
                className="cursor-pointer"
              >
                {publishedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
              </Pie>
              <Tooltip
                content={<PieTooltip />}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3 md:gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-[#4AD991]"></div>
            <div>
              <div className="text-sm font-medium text-gray-900">Viewed</div>
              <div className="text-xs text-gray-500">{publishedData[0].value.toLocaleString()}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-[#D9D9D9]"></div>
            <div>
              <div className="text-sm font-medium text-gray-900">Unopened</div>
              <div className="text-xs text-gray-500">{publishedData[1].value.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Frame732({ timePeriod = "weekly" }: { timePeriod?: string }) {
  return (
    <div className="flex flex-col lg:flex-row gap-4 md:gap-8 w-full px-0 md:px-4">
      <ActivityMetricsCard timePeriod={timePeriod} />
      <PublishedMemoriesCard timePeriod={timePeriod} />
    </div>
  );
}