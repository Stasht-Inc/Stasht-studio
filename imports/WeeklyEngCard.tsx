import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart } from 'recharts';
import { TrendingUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { dashboardAPI } from '../utils/authUtils';
import { useAuth } from '../contexts/AuthContext';

// Custom tooltip component for the chart
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 transform-none transition-none">
        <p className="text-sm font-medium text-gray-900">{`${payload[0].payload.day}`}</p>
        <p className="text-sm text-gray-600">
          <span className="inline-block w-3 h-3 bg-[#54CC8B] rounded-full mr-2"></span>
          Views: {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
}

interface WeeklyEngCardProps {
  globalTimePeriod?: string;
}

export default function WeeklyEngCard({ globalTimePeriod = "weekly" }: WeeklyEngCardProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [localTimePeriod, setLocalTimePeriod] = useState<string | null>(null);
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState(0); // 0 = current period, 1 = one period back, etc.
  const [chartData, setChartData] = useState([
    { day: 'Sun', views: 12, date: 'Dec 1' },
    { day: 'Mon', views: 19, date: 'Dec 2' },
    { day: 'Tue', views: 15, date: 'Dec 3' },
    { day: 'Wed', views: 25, date: 'Dec 4' },
    { day: 'Thu', views: 22, date: 'Dec 5' },
    { day: 'Fri', views: 35, date: 'Dec 6' },
    { day: 'Sat', views: 28, date: 'Dec 7' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiData, setApiData] = useState<any>(null);
  const [periodHeading, setPeriodHeading] = useState<string>('');

  // Generate realistic engagement data based on time period and offset
  const generateEngagementData = (period: string, periodOffset: number = 0) => {
    switch (period) {
      case 'daily':
        // 24 hours
        const hours = Array.from({ length: 24 }, (_, i) => {
          const hour = i.toString().padStart(2, '0');
          return `${hour}:00`;
        });
        return hours.map((hour, index) => {
          // Peak hours typically 9-17
          const isPeakHour = index >= 9 && index <= 17;
          const baseValue = isPeakHour ? 30 : 15;
          const periodAdjustment = Math.max(0, 1 - (periodOffset * 0.1));
          const variation = Math.floor(Math.random() * 15) - 7;
          return {
            day: hour,
            views: Math.max(5, Math.round((baseValue + variation) * periodAdjustment)),
            date: hour
          };
        });
      
      case 'weekly':
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() - (periodOffset * 7)); // Go back by weeks
        
        return days.map((day, index) => {
          const currentDate = new Date(baseDate);
          currentDate.setDate(currentDate.getDate() - (6 - index)); // Adjust for each day
          const dateStr = `${currentDate.toLocaleDateString('en-US', { month: 'short' })} ${currentDate.getDate()}`;
          
          const baseValue = day === 'Sun' || day === 'Sat' ? 15 : 25;
          // Add some consistent variation based on the offset (older data tends to be lower)
          const periodAdjustment = Math.max(0, 1 - (periodOffset * 0.1));
          const variation = Math.floor(Math.random() * 20) - 10;
          return {
            day,
            views: Math.max(5, Math.round((baseValue + variation) * periodAdjustment)),
            date: dateStr
          };
        });
      
      case 'monthly':
        // 30 days
        const monthDays = Array.from({ length: 30 }, (_, i) => i + 1);
        const baseMonthDate = new Date();
        baseMonthDate.setMonth(baseMonthDate.getMonth() - periodOffset);
        const monthName = baseMonthDate.toLocaleDateString('en-US', { month: 'short' });
        
        return monthDays.map((dayNum) => {
          const baseValue = 25;
          const periodAdjustment = Math.max(0, 1 - (periodOffset * 0.1));
          const variation = Math.floor(Math.random() * 30) - 15;
          return {
            day: dayNum.toString(),
            views: Math.max(5, Math.round((baseValue + variation) * periodAdjustment)),
            date: `${monthName} ${dayNum}`
          };
        });
      
      case 'annually':
        // 12 months
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const baseYear = new Date().getFullYear() - periodOffset;
        
        return months.map((month, index) => {
          // Summer months typically higher
          const isSummer = index >= 5 && index <= 8;
          const baseValue = isSummer ? 45 : 30;
          const periodAdjustment = Math.max(0, 1 - (periodOffset * 0.1));
          const variation = Math.floor(Math.random() * 25) - 12;
          return {
            day: month,
            views: Math.max(10, Math.round((baseValue + variation) * periodAdjustment)),
            date: `${month} ${baseYear}`
          };
        });
      
      default:
        return [];
    }
  };

  // Get the effective time period (local override or global)
  const effectiveTimePeriod = localTimePeriod || globalTimePeriod;

  // Update data when time period or period index changes
  useEffect(() => {
    const newData = generateEngagementData(effectiveTimePeriod, currentPeriodIndex);
    setChartData(newData);
  }, [effectiveTimePeriod, currentPeriodIndex]);

  const handleTimePeriodChange = (value: string) => {
    setLocalTimePeriod(value);
    setCurrentPeriodIndex(0); // Reset to current period when changing time period
  };

  const handlePreviousPeriod = () => {
    setCurrentPeriodIndex(prev => prev - 1);
  };

  const handleNextPeriod = () => {
    setCurrentPeriodIndex(prev => Math.min(0, prev + 1));
  };

  const getPeriodLabel = (period: string, offset: number) => {
    if (offset === 0) return '';
    
    const periodNames = {
      daily: 'day',
      weekly: 'week', 
      monthly: 'month',
      annually: 'year'
    };
    
    const periodName = periodNames[period as keyof typeof periodNames] || 'period';
    return offset === 1 ? `Last ${periodName}` : `${offset} ${periodName}s ago`;
  };

  // Function to fetch user engagement data from API
  const fetchUserEngagement = async () => {
    try {
      setIsLoading(true);
      const effectivePeriod = localTimePeriod || globalTimePeriod;
      console.log('=== USER ENGAGEMENT API CALL ===');
      console.log('Period Type:', effectivePeriod);
      console.log('API URL:', `/dashboard/user-engagement?type=${effectivePeriod}&offset=${currentPeriodIndex}`);
      
      const response = await dashboardAPI.getUserEngagement(effectivePeriod, currentPeriodIndex);
      console.log('Raw API Response:', response);
      
      if (response.success && response.data) {
        // Handle double nesting: apiRequest wraps the API response
        const actualData = response.data.data || response.data;
        console.log('Processed API Data:', actualData);
        console.log('Chart Data from API:', actualData.chart_data);
        console.log('Period Type from API:', actualData.period_type);
        console.log('Total Views from API:', actualData.total_views);
        console.log('Growth Data from API:', actualData.growth);
        console.log('Period Heading from API:', actualData.period_heading);
        setApiData(actualData);
        
        // Set period heading from API response
        if (actualData.period_heading) {
          setPeriodHeading(actualData.period_heading);
        } else {
          setPeriodHeading(getPeriodLabel(effectivePeriod, Math.abs(currentPeriodIndex)));
        }
        
        // Transform API data to chart format based on period type
        // Use API data when available (for any period)
        if (actualData.chart_data && actualData.chart_data.length > 0) {
          const transformedData = actualData.chart_data.map((item: any, index: number) => {
            let dateLabel = '';
            
            // Create appropriate date labels based on period type
            switch (actualData.period_type) {
              case 'daily':
                // For daily, labels are hours like "00:00", "01:00"
                dateLabel = item.label;
                break;
              case 'weekly':
                // For weekly, labels are days like "Sun", "Mon"
                dateLabel = `${item.label}`;
                break;
              case 'monthly':
                // For monthly, labels are days of month like "1", "2", "3"
                dateLabel = `Day ${item.label}`;
                break;
              case 'annually':
                // For annually, labels are months like "Jan", "Feb"
                dateLabel = item.label;
                break;
              default:
                dateLabel = item.label;
            }
            
            return {
              day: item.label, // Keep original label for chart display
              views: item.view_count,
              date: dateLabel // Formatted date for tooltips
            };
          });
          console.log('Transformed Chart Data for Display:', transformedData);
          setChartData(transformedData);
        } else {
          console.log('Using fallback generated data - Reason:', 
            !actualData.chart_data ? 'No chart_data in API' : 
            actualData.chart_data.length === 0 ? 'Empty chart_data array' :
            currentPeriodIndex !== 0 ? 'Historical period navigation' : 'Unknown');
          const fallbackData = generateEngagementData(effectivePeriod, Math.abs(currentPeriodIndex));
          console.log('Fallback Chart Data:', fallbackData);
          setChartData(fallbackData);
          setPeriodHeading(getPeriodLabel(effectivePeriod, Math.abs(currentPeriodIndex)));
        }
      } else {
        console.log('API call failed - Response:', response);
        console.log('Using fallback generated data for failed API call');
        const fallbackData = generateEngagementData(localTimePeriod || globalTimePeriod, Math.abs(currentPeriodIndex));
        console.log('Fallback Chart Data:', fallbackData);
        setChartData(fallbackData);
        setPeriodHeading(getPeriodLabel(localTimePeriod || globalTimePeriod, Math.abs(currentPeriodIndex)));
      }
    } catch (error) {
      console.error('Error fetching user engagement:', error);
      console.log('Using fallback generated data due to error');
      const fallbackData = generateEngagementData(localTimePeriod || globalTimePeriod, Math.abs(currentPeriodIndex));
      console.log('Error Fallback Chart Data:', fallbackData);
      setChartData(fallbackData);
      setPeriodHeading(getPeriodLabel(localTimePeriod || globalTimePeriod, Math.abs(currentPeriodIndex)));
    } finally {
      setIsLoading(false);
      console.log('=== END USER ENGAGEMENT API CALL ===');
    }
  };

  // Fetch data when period or index changes, but only if authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchUserEngagement();
    }
  }, [globalTimePeriod, localTimePeriod, currentPeriodIndex, isAuthenticated, authLoading]);

  // Reset local override when global period changes
  useEffect(() => {
    setLocalTimePeriod(null);
    setCurrentPeriodIndex(0);
  }, [globalTimePeriod]);

  const getChartTitle = (period: string) => {
    return 'User Engagement';
  };

  // Use API data when available, otherwise calculate from chart data
  const totalViews = (apiData?.total_views !== undefined) 
    ? apiData.total_views 
    : chartData.reduce((sum, item) => sum + item.views, 0);
  
  const peakValue = (apiData?.peak_value !== undefined)
    ? apiData.peak_value
    : Math.max(...chartData.map(item => item.views));
    
  const averageViews = chartData.length > 0 ? Math.round(totalViews / chartData.length) : 0;
  
  const weekGrowth = (apiData?.growth?.percentage !== undefined)
    ? apiData.growth.percentage
    : chartData.length >= 2 
      ? ((chartData[chartData.length - 1].views - chartData[0].views) / (chartData[0].views || 1) * 100)
      : 0;

  // Log final statistics being displayed
  console.log('=== FINAL UI STATISTICS ===');
  console.log('Total Views (displayed):', totalViews);
  console.log('Peak Value (displayed):', peakValue);
  console.log('Average Views (displayed):', averageViews);
  console.log('Growth Percentage (displayed):', weekGrowth);
  console.log('Current Period Index:', currentPeriodIndex);
  console.log('Using API Data:', apiData !== null);
  console.log('================================');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-full transition-all duration-300 hover:shadow-md relative overflow-hidden">
      {/* Left Navigation Arrow */}
      <button
        onClick={handlePreviousPeriod}
        className="absolute left-0 top-1/2 transform -translate-y-1/2 z-20 w-10 h-16 bg-gradient-to-r from-white/95 to-white/80 hover:from-white hover:to-white/90 border-r border-gray-200/50 hover:border-gray-300 transition-all duration-200 flex items-center justify-center group shadow-sm hover:shadow-md"
        title="Previous period"
      >
        <ChevronLeft className="w-5 h-5 text-gray-500 group-hover:text-gray-700 transition-colors" />
      </button>

      {/* Right Navigation Arrow */}
      <button
        onClick={handleNextPeriod}
        disabled={currentPeriodIndex === 0}
        className="absolute right-0 top-1/2 transform -translate-y-1/2 z-20 w-10 h-16 bg-gradient-to-l from-white/95 to-white/80 hover:from-white hover:to-white/90 border-l border-gray-200/50 hover:border-gray-300 transition-all duration-200 flex items-center justify-center group shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-white/95 disabled:hover:to-white/80"
        title="Next period"
      >
        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-gray-700 disabled:text-gray-400 transition-colors" />
      </button>

      <div className="p-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900">{getChartTitle(effectiveTimePeriod)}</h3>
            <span className="text-sm text-gray-500 text-[14px]">
              {periodHeading || getPeriodLabel(effectiveTimePeriod, currentPeriodIndex)}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <div className="w-2 h-2 bg-[#54CC8B] rounded-full"></div>
              <span>Story Views</span>
            </div>
            {localTimePeriod && (
              <button
                onClick={() => setLocalTimePeriod(null)}
                className="text-xs text-[#6C60FF] hover:text-[#5A4FE8] transition-colors px-2 py-1 rounded border border-[#6C60FF]/20 hover:border-[#6C60FF]/40 bg-[#6C60FF]/5 hover:bg-[#6C60FF]/10"
                title="Reset to global time period"
              >
                Reset to Global
              </button>
            )}
            <Select value={effectiveTimePeriod} onValueChange={handleTimePeriodChange}>
              <SelectTrigger className={`w-32 h-8 text-sm bg-transparent border hover:border-gray-300 focus:border-gray-400 focus:ring-0 rounded-md transition-all duration-200 font-medium ${
                localTimePeriod ? 'border-[#6C60FF] text-[#6C60FF] bg-[#6C60FF]/5' : 'border-gray-200 text-gray-600'
              }`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 shadow-xl rounded-lg p-0 min-w-[120px] animate-in slide-in-from-top-2 duration-200">
                <SelectItem value="daily" className="text-sm py-2 px-3 rounded-none hover:bg-gray-50 focus:bg-[#6C60FF]/10 focus:text-[#6C60FF] cursor-pointer border-b border-gray-100 last:border-0">Daily</SelectItem>
                <SelectItem value="weekly" className="text-sm py-2 px-3 rounded-none hover:bg-gray-50 focus:bg-[#6C60FF]/10 focus:text-[#6C60FF] cursor-pointer border-b border-gray-100 last:border-0">Weekly</SelectItem>
                <SelectItem value="monthly" className="text-sm py-2 px-3 rounded-none hover:bg-gray-50 focus:bg-[#6C60FF]/10 focus:text-[#6C60FF] cursor-pointer border-b border-gray-100 last:border-0">Monthly</SelectItem>
                <SelectItem value="annually" className="text-sm py-2 px-3 rounded-none hover:bg-gray-50 focus:bg-[#6C60FF]/10 focus:text-[#6C60FF] cursor-pointer">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1 text-[12px]">Total Views</div>
            <div className="text-lg font-semibold text-gray-900">{totalViews}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1 text-[12px]">{effectiveTimePeriod === 'daily' ? 'Peak Hour' : effectiveTimePeriod === 'annually' ? 'Peak Month' : 'Peak Day'}</div>
            <div className="text-lg font-semibold text-gray-900">{peakValue}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1 text-[12px]">Growth</div>
            <div className={`text-lg font-semibold flex items-center gap-1 ${weekGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className="w-3 h-3" />
              {weekGrowth >= 0 ? '+' : ''}{weekGrowth.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={chartData} 
              margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
            >
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#54CC8B" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#54CC8B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="day" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6B7280' }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6B7280' }}
                width={30}
              />
              <Tooltip 
                content={<CustomTooltip />} 
                animationDuration={0}
                animationEasing="linear"
              />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#54CC8B"
                strokeWidth={2}
                fill="url(#colorViews)"
                dot={{ fill: '#54CC8B', strokeWidth: 2, stroke: '#fff', r: 4 }}
                activeDot={{ 
                  r: 6, 
                  stroke: '#54CC8B', 
                  strokeWidth: 2, 
                  fill: '#fff',
                  strokeDasharray: 0
                }}
                animationDuration={0}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}