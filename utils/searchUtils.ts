// Local storage key for recent searches
const RECENT_SEARCHES_KEY = 'stasht_recent_searches';
const MAX_RECENT_SEARCHES = 3;

export interface RecentSearch {
  term: string;
  timestamp: number;
  filter?: 'all' | 'memories' | 'users' | 'media' | 'published';
}

// Local Storage Management for Recent Searches
export const recentSearchUtils = {
  // Get recent searches from localStorage
  getRecentSearches: (): RecentSearch[] => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (!stored) return [];
      
      const searches: RecentSearch[] = JSON.parse(stored);
      // Sort by timestamp (newest first)
      return searches.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error reading recent searches from localStorage:', error);
      return [];
    }
  },

  // Add a new search to recent searches
  addRecentSearch: (term: string, filter: 'all' | 'memories' | 'users' | 'media' | 'published' = 'all'): void => {
    try {
      if (!term.trim()) return;
      
      const currentSearches = recentSearchUtils.getRecentSearches();
      
      // Remove duplicate if exists (same term and filter)
      const filteredSearches = currentSearches.filter(
        search => !(search.term.toLowerCase() === term.toLowerCase().trim() && search.filter === filter)
      );
      
      // Add new search at the beginning
      const newSearch: RecentSearch = {
        term: term.trim(),
        timestamp: Date.now(),
        filter
      };
      
      const updatedSearches = [newSearch, ...filteredSearches].slice(0, MAX_RECENT_SEARCHES);
      
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updatedSearches));
      console.log('✅ Added recent search:', newSearch);
    } catch (error) {
      console.error('Error saving recent search to localStorage:', error);
    }
  },

  // Clear all recent searches
  clearRecentSearches: (): void => {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
      console.log('✅ Cleared all recent searches');
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  },

  // Remove a specific recent search
  removeRecentSearch: (term: string, filter: 'all' | 'memories' | 'users' | 'media' | 'published' = 'all'): void => {
    try {
      const currentSearches = recentSearchUtils.getRecentSearches();
      const filteredSearches = currentSearches.filter(
        search => !(search.term.toLowerCase() === term.toLowerCase().trim() && search.filter === filter)
      );
      
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(filteredSearches));
      console.log('✅ Removed recent search:', term, filter);
    } catch (error) {
      console.error('Error removing recent search:', error);
    }
  },

  // Get recent search terms only (for quick access)
  getRecentSearchTerms: (): string[] => {
    return recentSearchUtils.getRecentSearches().map(search => search.term);
  }
};

// Search result formatting utilities
export const searchResultUtils = {
  // Format search results based on filter type
  formatSearchResults: (results: any[], filter: string) => {
    switch (filter) {
      case 'memories':
        return results.map(item => ({
          id: item.id || item.memory_id,
          title: item.title || item.name,
          type: 'memory',
          thumbnail: item.thumbnail || item.image,
          category: item.category,
          date: item.date || item.created_at,
          description: item.description
        }));
        
      case 'media':
        return results.map(item => ({
          id: item.id || item.media_id,
          title: item.name || item.title,
          type: 'media',
          thumbnail: item.thumbnail || item.media_url || item.image_url,
          size: item.size,
          date: item.date || item.capture_date,
          location: item.location
        }));
        
      case 'users':
        return results.map(item => ({
          id: item.id || item.user_id,
          title: item.name || item.username,
          type: 'user',
          avatar: item.avatar || item.profile_image,
          email: item.email,
          role: item.role
        }));
        
      case 'published':
        return results.map(item => ({
          id: item.id,
          title: item.title || item.name,
          type: 'published',
          thumbnail: item.thumbnail,
          status: item.status,
          date: item.published_at || item.created_at,
          author: item.author
        }));
        
      default:
        // 'all' - mixed results
        return results.map(item => {
          const baseItem = {
            id: item.id,
            title: item.title || item.name,
            thumbnail: item.thumbnail || item.image,
            date: item.date || item.created_at,
          };
          
          // Determine type based on available fields
          if (item.memory_id || item.category) {
            return { ...baseItem, type: 'memory' };
          } else if (item.media_id || item.media_url) {
            return { ...baseItem, type: 'media' };
          } else if (item.user_id || item.username || item.email) {
            return { ...baseItem, type: 'user' };
          } else if (item.published_at || item.status) {
            return { ...baseItem, type: 'published' };
          }
          
          return { ...baseItem, type: 'unknown' };
        });
    }
  }
};