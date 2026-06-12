"use client";

import { useState, useEffect } from "react";
import { MoreHorizontal, ArrowUpDown, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { dashboardAPI } from '../utils/authUtils';
import { useAuth } from '../contexts/AuthContext';
import MemoryActionMenu from "../components/MemoryActionMenu";

interface Memory {
  id: string;
  category: string;
  author: string;
  label: string;
  photos: number;
  title: string;
  startDate: string;
  endDate: string;
  lastVisited: string;
  isSelected: boolean;
}

const mockMemories: Memory[] = [
  {
    id: "1",
    category: "BC",
    author: "PedalHeads",
    label: "Mexico",
    photos: 24,
    title: "Airdrie - Airdrie Christian Academy",
    startDate: "Dec 12/24",
    endDate: "Jan 06/25",
    lastVisited: "2 days ago",
    isSelected: false
  },
  {
    id: "2",
    category: "Alberta",
    author: "PedalHeads",
    label: "Mexico",
    photos: 16,
    title: "Belgravia - Belgravia Community League",
    startDate: "Dec 12/24",
    endDate: "Jan 06/25",
    lastVisited: "1 week ago",
    isSelected: false
  },
  {
    id: "3",
    category: "Alberta",
    author: "PedalHeads",
    label: "Mexico",
    photos: 27,
    title: "Bridlewood - Glenmore Christian Academy",
    startDate: "Dec 12/24",
    endDate: "Jan 06/25",
    lastVisited: "3 days ago",
    isSelected: false
  },
  {
    id: "4",
    category: "BC",
    author: "Sarah Johnson",
    label: "Family",
    photos: 35,
    title: "Summer Family Vacation - Vancouver Island",
    startDate: "Jul 15/24",
    endDate: "Jul 28/24",
    lastVisited: "5 hours ago",
    isSelected: false
  },
  {
    id: "5",
    category: "Ontario",
    author: "Mike Chen",
    label: "Corporate",
    photos: 42,
    title: "Corporate Team Building - Toronto Office",
    startDate: "Sep 10/24",
    endDate: "Sep 12/24",
    lastVisited: "1 day ago",
    isSelected: false
  }
];

interface SortConfig {
  key: keyof Memory | null;
  direction: 'asc' | 'desc';
}

interface Frame189Props {
  onNavigate?: (page: string) => void;
  onMemorySelect?: (memoryId: string) => void;
}

export default function Frame189({ onNavigate, onMemorySelect }: Frame189Props) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [memories, setMemories] = useState<Memory[]>(mockMemories);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Log current memories state on every render
  console.log('Frame189 render - memories count:', memories.length);
  console.log('Frame189 render - first memory:', memories[0]);

  const sortedMemories = [...memories].sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' 
        ? aValue - bValue
        : bValue - aValue;
    }
    
    return 0;
  });

  const handleSort = (key: keyof Memory) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setMemories(prev => prev.map(memory => ({ ...memory, isSelected: checked })));
  };

  const handleSelectMemory = (id: string, checked: boolean) => {
    setMemories(prev => prev.map(memory => 
      memory.id === id ? { ...memory, isSelected: checked } : memory
    ));
  };

  // Helper function to format date as "Aug 12/25"
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    
    console.log('Original date string:', dateStr);
    
    // Handle "Aug 12, 2025" format directly
    if (dateStr.includes(',')) {
      try {
        const parts = dateStr.split(',');
        const monthDay = parts[0].trim(); // "Aug 12"
        const year = parts[1].trim(); // "2025"
        const shortYear = year.slice(-2); // "25"
        const result = `${monthDay}/${shortYear}`;
        console.log('Formatted date:', result);
        return result;
      } catch (error) {
        console.log('Error formatting comma-separated date:', error);
      }
    }
    
    // Fallback: try standard date parsing
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear().toString().slice(-2);
        const result = `${month} ${day}/${year}`;
        console.log('Formatted date (fallback):', result);
        return result;
      }
    } catch (error) {
      console.log('Error with fallback date parsing:', error);
    }
    
    console.log('Date formatting failed, returning empty');
    return '';
  };

  // Helper function to format relative time
  const formatRelativeTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Never';
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      const diffWeeks = Math.floor(diffDays / 7);
      
      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
      return formatDate(dateStr);
    } catch {
      return 'Never';
    }
  };

  // Fetch memories data from API (latest memories, not filtered by time period)
  const fetchMemories = async () => {
    try {
      setIsLoading(true);
      console.log('=== FETCHING LATEST MEMORIES ===');
      console.log('API URL:', '/memories');
      
      const response = await dashboardAPI.getMemories();
      console.log('Raw Memories API Response:', response);
      
      console.log('API Response received:', response);
      
      if (response && response.success && response.data) {
        const actualData = response.data.data || response.data;
        console.log('Actual data:', actualData);
        
        if (actualData && actualData.latest_memories) {
          console.log('Found latest_memories:', actualData.latest_memories);
          
          const apiMemories = actualData.latest_memories;
          const transformedMemories = apiMemories.map((mem: any, index: number) => {
            console.log(`=== MEMORY ${index} ===`);
            console.log('FULL MEMORY OBJECT:', mem);
            console.log('All keys:', Object.keys(mem));
            console.log('mem.starting_date:', mem.starting_date);
            console.log('mem.ending_date:', mem.ending_date);
            console.log('Type of starting_date:', typeof mem.starting_date);
            console.log('Type of ending_date:', typeof mem.ending_date);
            
            const transformedMemory = {
              id: mem.id?.toString() || '1',
              category: mem.category?.name || 'Cat1',
              author: mem.author?.name || 'Christian',
              label: mem.sub_category?.name || '',
              photos: mem.photos?.count || 0,
              title: mem.title || 'czcz',
              startDate: mem.dates?.start_date || 'Aug 11/25', 
              endDate: mem.dates?.end_date || '',     
              lastVisited: mem.last_updated || 'Never',
              isSelected: false
            };
            
            console.log('FINAL startDate:', transformedMemory.startDate);
            console.log('FINAL endDate:', transformedMemory.endDate);
            console.log(`=== END MEMORY ${index} ===`);
            return transformedMemory;
          });
          
          console.log('Setting transformed memories:', transformedMemories);
          setMemories(transformedMemories);
        } else {
          console.log('No latest_memories found in response');
        }
      } else {
        console.log('API response failed or invalid');
      }
    } catch (error) {
      console.error('Error fetching memories:', error);
      setMemories([]); // Set empty array instead of mock data
    } finally {
      setIsLoading(false);
      console.log('=== END FETCHING LATEST MEMORIES ===');
    }
  };

  // Fetch memories when component mounts (not dependent on timePeriod)
  useEffect(() => {
    console.log('useEffect triggered - isAuthenticated:', isAuthenticated, 'authLoading:', authLoading);
    // Force API call to happen regardless of auth status for debugging
    console.log('Calling fetchMemories...');
    fetchMemories();
  }, []);

  const SortButton = ({ column, children }: { column: keyof Memory, children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(column)}
      className="flex items-center gap-1 hover:text-[#6C60FF] transition-colors font-medium"
    >
      {children}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg md:text-2xl font-bold text-gray-900">Latest Campaigns</h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate?.("memories")}
              className="flex items-center gap-1 text-[#6C60FF] hover:text-[#6C60FF]/80 transition-colors font-medium text-sm md:text-base"
            >
              View all
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Table - Hidden on mobile and tablet, shown on large screens */}
      <div className="hidden lg:block overflow-x-auto">
        {/* Header Row */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="grid grid-cols-[auto_120px_120px_120px_80px_1fr_100px_100px_120px_auto] gap-4 items-center text-sm font-medium text-gray-600">
            <div className="flex items-center">
              <Checkbox
                checked={selectAll}
                onCheckedChange={handleSelectAll}
                className="data-[state=checked]:bg-[#6C60FF] data-[state=checked]:border-[#6C60FF]"
              />
            </div>
            <SortButton column="category">Category</SortButton>
            <SortButton column="author">Author</SortButton>
            <SortButton column="label">Label</SortButton>
            <SortButton column="photos">Photos</SortButton>
            <SortButton column="title">Title</SortButton>
            <SortButton column="startDate">Starting</SortButton>
            <SortButton column="endDate">Ending</SortButton>
            <SortButton column="lastVisited">Last Visited</SortButton>
            <div className="text-center">Actions</div>
          </div>
        </div>
        
        {/* Data Rows */}
        <div className="divide-y divide-gray-100">
          {isLoading ? (
            // Loading skeleton
            [...Array(5)].map((_, index) => (
              <div key={index} className="px-6 py-4 animate-pulse">
                <div className="grid grid-cols-[auto_120px_120px_120px_80px_1fr_100px_100px_120px_auto] gap-4 items-center">
                  <div className="w-4 h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="w-8 h-8 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))
          ) : sortedMemories.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No campaigns available
            </div>
          ) : (
            sortedMemories.map((memory) => (
            <div
              key={memory.id}
              className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer group"
              onClick={() => onMemorySelect?.(`mem_${memory.id}`)}
            >
              <div className="grid grid-cols-[auto_120px_120px_120px_80px_1fr_100px_100px_120px_auto] gap-4 items-center text-sm">
                <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={memory.isSelected}
                    onCheckedChange={(checked) => handleSelectMemory(memory.id, checked as boolean)}
                    className="data-[state=checked]:bg-[#6C60FF] data-[state=checked]:border-[#6C60FF]"
                  />
                </div>
                
                <div>
                  <span className="text-gray-700">{memory.category}</span>
                </div>
                
                <div>
                  <span className="text-gray-700">{memory.author}</span>
                </div>
                
                <div>
                  <Badge className="bg-[#ffd460] text-[#393131] hover:bg-[#ffd460]/90">
                    {memory.label}
                  </Badge>
                </div>
                
                <div className="text-center">
                  <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-900 rounded-md text-xs font-medium">
                    {memory.photos}
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-900 font-medium">
                    {memory.title}
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-500">{memory.startDate}</span>
                </div>
                
                <div>
                  <span className="text-gray-500">{memory.endDate}</span>
                </div>
                
                <div>
                  <span className="text-gray-500">{memory.lastVisited}</span>
                </div>
                
                <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                  <MemoryActionMenu
                    memoryId={memory.id}
                    memoryTitle={memory.title}
                    onEdit={() => onMemorySelect?.(`mem_${memory.id}`)}
                    onRefresh={() => {
                      // Refresh memories data after deletion
                      fetchMemories();
                    }}
                  />
                </div>
              </div>
            </div>
            ))
          )}
        </div>
      </div>

      {/* Mobile and Tablet View - Responsive cards */}
      <div className="lg:hidden px-3 py-4 sm:px-4 md:px-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6C60FF]"></div>
          </div>
        ) : sortedMemories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="mb-4">
              <svg className="w-20 h-20 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No campaigns yet</h3>
            <p className="text-sm text-gray-500 max-w-xs">Start creating campaigns to see them here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedMemories.slice(0, 5).map((memory) => (
              <div
                key={memory.id}
                className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-sm active:shadow-md hover:shadow-md transition-all duration-200 cursor-pointer"
                onClick={() => onMemorySelect?.(`mem_${memory.id}`)}
              >
                {/* Title and Badge */}
                <div className="flex items-start gap-3 mb-3">
                  <h4 className="font-semibold text-gray-900 text-base md:text-lg leading-tight flex-1 min-w-0">
                    {memory.title}
                  </h4>
                  <Badge className="bg-[#ffd460] text-[#393131] hover:bg-[#ffd460]/90 text-xs md:text-sm px-2 py-1 flex-shrink-0 whitespace-nowrap">
                    {memory.label}
                  </Badge>
                </div>

                {/* Category and Author */}
                <div className="flex items-center gap-4 md:gap-6 mb-3 text-sm md:text-base flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500">Category:</span>
                    <span className="text-gray-900 font-medium">{memory.category}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500">By:</span>
                    <span className="text-gray-900 font-medium">{memory.author}</span>
                  </div>
                </div>

                {/* Photos, Dates, and Last Visited */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 pt-3 border-t border-gray-100">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Photos</div>
                    <div className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-900 rounded-md text-sm font-semibold">
                      {memory.photos}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Last Visited</div>
                    <div className="text-sm text-gray-700 font-medium truncate">{memory.lastVisited}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Start Date</div>
                    <div className="text-sm text-gray-700 font-medium">{memory.startDate}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">End Date</div>
                    <div className="text-sm text-gray-700 font-medium">{memory.endDate || 'N/A'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}