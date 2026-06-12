"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Clock, Command, X, Filter } from "lucide-react";
import { searchAPI } from "../services/mediaAPI";
import { recentSearchUtils, RecentSearch } from "../utils/searchUtils";

interface SearchSuggestion {
  id: string;
  text: string;
  category: string;
  type: 'suggestion' | 'recent';
  filter?: 'all' | 'memories' | 'users' | 'media' | 'published';
}

interface EnhancedSearchProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearch: (query: string, filter?: 'all' | 'memories' | 'users' | 'media' | 'published') => void;
  onItemSelect?: (item: { id: string; type: 'memory' | 'media' | 'user' | 'published'; text: string }) => void;
}

type SearchFilter = 'all' | 'memories' | 'users' | 'media' | 'published';

export default function EnhancedSearch({ searchQuery, setSearchQuery, onSearch, onItemSelect }: EnhancedSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<SearchSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Load recent searches from localStorage on component mount
  useEffect(() => {
    const loadedRecentSearches = recentSearchUtils.getRecentSearches();
    setRecentSearches(loadedRecentSearches);
  }, []);

  // Debounced search suggestions
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim() === '') {
      // Show recent searches when empty
      const recentSuggestions: SearchSuggestion[] = recentSearches.map((search, index) => ({
        id: `recent-${index}`,
        text: search.term,
        category: getFilterDisplayName(search.filter || 'all'),
        type: 'recent',
        filter: search.filter
      }));
      setFilteredSuggestions(recentSuggestions);
      setSelectedIndex(-1);
    } else {
      // Debounced search for suggestions
      searchTimeoutRef.current = setTimeout(async () => {
        await fetchSearchSuggestions(searchQuery.trim());
      }, 300);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, recentSearches, activeFilter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Global Cmd+K or Ctrl+K to focus search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => prev > -1 ? prev - 1 : -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
          const selected = filteredSuggestions[selectedIndex];
          handleSuggestionClick(selected);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Fetch search suggestions from API
  const fetchSearchSuggestions = async (searchTerm: string) => {
    try {
      console.log('🔍 Fetching suggestions for:', searchTerm);
      
      // Call the actual search API
      const response = await searchAPI.search({
        search_term: searchTerm,
        filter: activeFilter !== 'all' ? activeFilter : undefined
      });

      console.log('🔍 =================================');
      console.log('🔍 SEARCH SUGGESTIONS API RESPONSE:');
      console.log('🔍 =================================');
      console.log('🔍 Full Response:', response);
      console.log('🔍 Response Success:', response?.success);
      console.log('🔍 Response Data:', response?.data);
      
      // Handle nested data structure - your API returns data.data
      const actualData = response?.data?.data || response?.data;
      console.log('🔍 Actual Data (after unwrapping):', actualData);
      
      // The search results are in recent_searches field
      const searchResults = actualData?.recent_searches || actualData;
      console.log('🔍 Search Results Data:', searchResults);
      
      if (searchResults) {
        console.log('🔍 Search Results Keys:', Object.keys(searchResults));
        console.log('🔍 Memories:', searchResults.memories);
        console.log('🔍 Media:', searchResults.media);  
        console.log('🔍 Users:', searchResults.users);
        console.log('🔍 Published Memories:', searchResults.published_memories);
      }
      console.log('🔍 =================================');

      const suggestions: SearchSuggestion[] = [];

      if (response && response.success && searchResults) {
        // Process memories
        if (searchResults.memories && Array.isArray(searchResults.memories)) {
          console.log('🧠 Processing', searchResults.memories.length, 'memories');
          console.log('🧠 First memory sample:', searchResults.memories[0]);
          searchResults.memories.forEach((memory, index) => {
            // Check all possible title fields
            const memoryTitle = memory.title || memory.memory_title || memory.name || memory.memory_name || `Memory ${memory.id || index}`;
            console.log(`🧠 Memory ${index}:`, {
              id: memory.id,
              title: memory.title,
              memory_title: memory.memory_title,
              name: memory.name,
              memory_name: memory.memory_name,
              extracted: memoryTitle
            });
            
            // Always add memories, even if title is empty - show first few chars of description
            const displayText = memoryTitle !== `Memory ${memory.id || index}` 
              ? memoryTitle 
              : (memory.description ? memory.description.substring(0, 50) + '...' : `Memory ${memory.id || index}`);
              
            suggestions.push({
              id: `memory-${memory.id || index}`,
              text: displayText,
              category: 'Campaigns',
              type: 'suggestion',
              filter: 'memories'
            });
          });
        }

        // Process media
        if (searchResults.media && Array.isArray(searchResults.media)) {
          console.log('📸 Processing', searchResults.media.length, 'media items');
          console.log('📸 First media sample:', searchResults.media[0]);
          searchResults.media.forEach((media, index) => {
            // Extract media name - same pattern as memories (use 'name' field)
            const mediaName = media.name || `Media ${media.id || index}`;
            console.log(`📸 Media ${index}:`, {
              id: media.id,
              name: media.name,
              extracted: mediaName
            });
            
            // Always add media - show name or fallback
            const displayText = mediaName !== `Media ${media.id || index}` 
              ? mediaName 
              : `Media ${media.id || index}`;
              
            suggestions.push({
              id: `media-${media.id || media.media_id || index}`,
              text: displayText,
              category: 'Media',
              type: 'suggestion',
              filter: 'media'
            });
          });
        }

        // Process users
        if (searchResults.users && Array.isArray(searchResults.users)) {
          console.log('👤 Processing', searchResults.users.length, 'users');
          console.log('👤 First user sample:', searchResults.users[0]);
          searchResults.users.forEach((user, index) => {
            // Extract user name - same pattern as memories and media (use 'name' field)
            const userName = user.name || `User ${user.id || index}`;
            console.log(`👤 User ${index}:`, {
              id: user.id,
              name: user.name,
              extracted: userName
            });
            
            // Always add users - show name or fallback
            const displayText = userName !== `User ${user.id || index}` 
              ? userName 
              : `User ${user.id || index}`;
              
            suggestions.push({
              id: `user-${user.id || user.user_id || index}`,
              text: displayText,
              category: 'Users',
              type: 'suggestion',
              filter: 'users'
            });
          });
        }

        // Process published memories if available  
        if (searchResults.published_memories && Array.isArray(searchResults.published_memories) && searchResults.published_memories.length > 0) {
          console.log('🌐 Processing', searchResults.published_memories.length, 'published memories');
          console.log('🌐 First published sample:', searchResults.published_memories[0]);
          searchResults.published_memories.forEach((published, index) => {
            // Extract published title - same pattern as memories (use 'title' field)
            const publishedTitle = published.title || `Published ${published.id || index}`;
            console.log(`🌐 Published ${index}:`, {
              id: published.id,
              title: published.title,
              extracted: publishedTitle
            });
            
            // Always add published - show title or fallback
            const displayText = publishedTitle !== `Published ${published.id || index}` 
              ? publishedTitle 
              : `Published ${published.id || index}`;
              
            suggestions.push({
              id: `published-${published.id || index}`,
              text: displayText,
              category: 'Published',
              type: 'suggestion',
              filter: 'published'
            });
          });
        }

        // Process generic results if available
        if (searchResults.results && Array.isArray(searchResults.results)) {
          console.log('📋 Processing', searchResults.results.length, 'generic results');
          searchResults.results.forEach((result, index) => {
            suggestions.push({
              id: `result-${result.id || index}`,
              text: result.title || result.name || `Result ${index}`,
              category: result.type === 'memory' ? 'Memories' : 
                       result.type === 'media' ? 'Media' : 
                       result.type === 'user' ? 'Users' : 'All',
              type: 'suggestion',
              filter: result.type === 'memory' ? 'memories' : 
                      result.type === 'media' ? 'media' : 
                      result.type === 'user' ? 'users' : 'all'
            });
          });
        }
      }

      console.log('🔍 Final suggestions:', suggestions.length, 'items');
      console.log('🔍 Suggestions:', suggestions);

      // Also include matching recent searches
      const matchingRecent = recentSearches
        .filter(search => search.term.toLowerCase().includes(searchTerm.toLowerCase()))
        .slice(0, 2)
        .map((search, index) => ({
          id: `recent-${index}`,
          text: search.term,
          category: getFilterDisplayName(search.filter || 'all'),
          type: 'recent' as const,
          filter: search.filter
        }));

      const allSuggestions = [...matchingRecent, ...suggestions].slice(0, 8);
      setFilteredSuggestions(allSuggestions);
      setSelectedIndex(-1);

    } catch (error) {
      console.error('❌ Error fetching search suggestions:', error);
      setFilteredSuggestions([]);
    }
  };

  const handleSearch = async (customFilter?: SearchFilter) => {
    const searchTerm = searchQuery.trim();
    if (!searchTerm) return;

    const filterToUse = customFilter || activeFilter;
    setIsSearching(true);
    
    try {
      // Save to recent searches
      recentSearchUtils.addRecentSearch(searchTerm, filterToUse);
      
      // Update local recent searches state
      const updatedRecentSearches = recentSearchUtils.getRecentSearches();
      setRecentSearches(updatedRecentSearches);

      // Call the API
      console.log('📡 Making API call to /user/recent-search with params:', {
        search_term: searchTerm,
        filter: filterToUse !== 'all' ? filterToUse : undefined
      });
      console.log('📡 EnhancedSearch: Using POST method (should see POST logs below)');

      const response = await searchAPI.search({
        search_term: searchTerm,
        filter: filterToUse !== 'all' ? filterToUse : undefined
      });

      console.log('📡 Full API Response:', response);
      console.log('📡 Response Type:', typeof response);
      console.log('📡 Response Keys:', response ? Object.keys(response) : 'null response');

      if (response && response.success) {
        console.log('✅ Search API successful!');
        console.log('📊 Response Data:', response.data);
        console.log('📊 Data Type:', typeof response.data);
        console.log('📊 Data Keys:', response.data ? Object.keys(response.data) : 'null data');
        
        // Update recent searches from API if provided
        if (response.data?.recent_searches) {
          console.log('📥 Server recent searches found:', response.data.recent_searches);
          console.log('📥 Recent searches type:', typeof response.data.recent_searches);
          console.log('📥 Recent searches length:', Array.isArray(response.data.recent_searches) ? response.data.recent_searches.length : 'not array');
          console.log('📥 Recent searches content:', JSON.stringify(response.data.recent_searches, null, 2));
        } else {
          console.log('⚠️ No recent_searches found in response data');
        }
      } else {
        console.log('❌ Search API failed or returned unsuccessful response');
        console.log('❌ Response:', response);
        if (response?.error) {
          console.log('❌ API Error:', response.error);
        }
      }

      // Call parent onSearch handler
      onSearch(searchTerm, filterToUse);
      setIsOpen(false);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSuggestionClick = async (suggestion: SearchSuggestion) => {
    setSearchQuery(suggestion.text);
    
    // If it's a suggestion (not recent search) and we have onItemSelect, handle navigation
    if (suggestion.type === 'suggestion' && onItemSelect) {
      const itemType = suggestion.filter === 'memories' ? 'memory' : 
                      suggestion.filter === 'media' ? 'media' :
                      suggestion.filter === 'users' ? 'user' : 'published';
      
      onItemSelect({
        id: suggestion.id,
        type: itemType,
        text: suggestion.text
      });
      setIsOpen(false);
    } else {
      // For recent searches or when no onItemSelect, do regular search
      await handleSearch(suggestion.filter || 'all');
    }
  };

  const handleFilterClick = (filter: SearchFilter) => {
    setActiveFilter(filter);
    if (searchQuery.trim()) {
      handleSearch(filter);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    inputRef.current?.focus();
  };

  const getFilterDisplayName = (filter: string) => {
    switch (filter) {
      case 'memories': return 'Campaigns';
      case 'media': return 'Media';
      case 'users': return 'Users';
      case 'published': return 'Published';
      default: return 'All';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'memories': return '📖';
      case 'campaigns': return '📖';
      case 'media': return '📸';
      case 'users': return '👤';
      case 'published': return '🌐';
      case 'all': return '🔍';
      default: return '🔍';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'recent': return <Clock className="w-4 h-4 text-gray-400" />;
      default: return <Search className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="relative w-full max-w-2xl">
      {/* Search Input Container */}
      <div className="relative">
        <div className={`flex items-center bg-gray-50 rounded-xl border-2 transition-all duration-200 ${
          isOpen ? 'border-[#6C60FF] bg-white shadow-lg' : 'border-gray-200 hover:border-gray-300'
        }`}>
          <div className="pl-4 pr-3">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search campaigns, media, users..."
            className="flex-1 py-3 px-1 bg-transparent border-none outline-none placeholder-gray-400 text-gray-900"
          />
          
          <div className="flex items-center gap-2 pr-3">
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors duration-200"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1 hover:bg-gray-200 rounded-full transition-all duration-200 ${
                showFilters ? 'bg-[#6C60FF]/10 text-[#6C60FF]' : 'text-gray-400'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
            
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md text-xs text-gray-500">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          </div>
        </div>
        
        {/* Filters Bar */}
        {showFilters && (
          <div className="absolute top-full left-0 right-0 mt-1 p-3 bg-white rounded-lg border border-gray-200 shadow-lg z-50">
            <div className="flex flex-wrap gap-2">
              {(['all', 'memories', 'media', 'users', 'published'] as SearchFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => handleFilterClick(filter)}
                  className={`px-3 py-1 text-sm rounded-full transition-all duration-200 ${
                    activeFilter === filter
                      ? 'bg-[#6C60FF]/10 text-[#6C60FF]'
                      : 'bg-gray-100 text-gray-700 hover:bg-[#6C60FF]/10 hover:text-[#6C60FF]'
                  }`}
                >
                  {getFilterDisplayName(filter)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-xl z-50 max-h-96 overflow-y-auto"
        >
          {filteredSuggestions.length > 0 ? (
            <div className="py-2">
              {searchQuery.trim() === '' && (
                <div className="px-4 py-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <Clock className="w-4 h-4" />
                    <span>Recent searches</span>
                  </div>
                </div>
              )}
              
              {filteredSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={`w-full px-4 py-3 text-left hover:bg-[#6C60FF]/10 transition-all duration-200 flex items-center gap-3 mx-1 my-0.5 rounded-md ${
                    index === selectedIndex ? 'bg-[#6C60FF]/10 border-r-2 border-[#6C60FF]' : ''
                  }`}
                >
                  <div className="flex-shrink-0">
                    {getTypeIcon(suggestion.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium truncate transition-colors duration-200 ${
                        index === selectedIndex ? 'text-[#6C60FF]' : 'text-gray-900'
                      }`}>
                        {suggestion.text}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full flex-shrink-0">
                        {getCategoryIcon(suggestion.category)} {suggestion.category}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
              
              {searchQuery.trim() && (
                <div className="border-t border-gray-100 mt-2 pt-2">
                  <button
                    onClick={() => handleSearch()}
                    disabled={isSearching}
                    className={`w-full px-4 py-3 text-left hover:bg-[#6C60FF]/10 transition-all duration-200 flex items-center gap-3 mx-1 my-0.5 rounded-md disabled:opacity-50 ${
                      selectedIndex === filteredSuggestions.length ? 'bg-[#6C60FF]/10 border-r-2 border-[#6C60FF]' : ''
                    }`}
                  >
                    {isSearching ? (
                      <div className="w-4 h-4 border-2 border-[#6C60FF] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 text-[#6C60FF]" />
                    )}
                    <span className={`transition-colors duration-200 ${
                      selectedIndex === filteredSuggestions.length ? 'text-[#6C60FF]' : 'text-gray-900'
                    }`}>
                      {isSearching ? 'Searching...' : (
                        <>Search for "<span className="font-semibold">{searchQuery}</span>"</>
                      )}
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>No suggestions found</p>
              <p className="text-sm">Try searching for campaigns, media, or users</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}