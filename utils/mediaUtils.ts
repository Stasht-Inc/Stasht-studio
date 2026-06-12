import { MediaItem, MediaMemory, MediaImage, ExistingMemory } from "../types/mediaTypes";

// Convert MediaMemory data to MediaItem format for the main content
export const convertMemoriesToMediaItems = (
  mediaMemories: MediaMemory[],
  expandedCategories: string[],
  selectedCategory: string | null = null
): MediaItem[] => {
  const items: MediaItem[] = [];

  mediaMemories.forEach(memory => {
    // If a specific category is selected, ONLY process that category
    // Otherwise, process all expanded categories
    const shouldProcess = selectedCategory
      ? memory.category === selectedCategory
      : expandedCategories.includes(memory.category);

    // Only process memories that match the filter
    if (shouldProcess) {
      memory.images.forEach(image => {
        const item: MediaItem = {
          id: image.id,
          name: image.name,
          thumbnail: image.thumbnail,
          date: image.date,
          size: image.size,
          type: image.type,
          dimensions: image.dimensions,
          category: memory.category || 'Unassigned',
          memory: {
            id: memory.id,
            title: memory.title,
            category: memory.category || 'Unassigned'
          },
          metadata: {
            camera: image.type === 'video' ? 'Video Camera' : 'Digital Camera',
            dimensions: image.dimensions
          }
        };
        
        // Add mock locations for variety
        const categoryName = memory.category || 'Unassigned';
        if (categoryName === 'Unassigned') {
          item.label = { name: 'Unsorted', color: '#EAB308' };
        } else if (categoryName === 'Personal') {
          if (memory.title.includes('Vacation')) {
            item.location = { city: 'Paris', country: 'France' };
            item.label = { name: 'Family', color: '#EAB308' };
          } else if (memory.title.includes('Birthday')) {
            item.location = { city: 'Mexico City', country: 'Mexico' };
            item.label = { name: 'Events', color: '#EAB308' };
          }
        } else if (categoryName === 'Shared With') {
          item.location = { city: 'New York', country: 'USA' };
          item.label = { name: 'Corporate', color: '#EAB308' };
        } else if (categoryName === 'Published') {
          item.location = { city: 'London', country: 'UK' };
        }
        
        items.push(item);
      });
    }
  });
  
  return items;
};

// Convert unassigned images to MediaItem format
export const convertUnassignedToMediaItems = (
  unassignedImages: MediaImage[], 
  showUnassignedImages: boolean
): MediaItem[] => {
  if (!showUnassignedImages) {
    return [];
  }
  
  return unassignedImages.map(image => ({
    id: image.id,
    name: image.name,
    thumbnail: image.thumbnail,
    date: image.date,
    size: image.size,
    type: image.type,
    dimensions: image.dimensions,
    category: 'Unassigned',
    metadata: {
      camera: image.type === 'video' ? 'Video Camera' : 'Digital Camera',
      dimensions: image.dimensions
    }
  }));
};

// Filter items based on categories and search
export const filterMediaItems = (
  mediaItems: MediaItem[],
  expandedCategories: string[],
  showUnassignedImages: boolean,
  searchQuery: string,
  selectedCategory: string | null = null
): MediaItem[] => {
  // Track seen IDs to prevent duplicates when a specific category is selected
  const seenIds = new Set<string>();

  return mediaItems.filter(item => {
    // CRITICAL: Exclude unassigned items from ALL categories except "Unassigned"
    // Even if they appear in other categories (duplicates), treat them as unassigned only
    if ((item as any).isFromUnassignedArray && selectedCategory && selectedCategory !== 'Unassigned') {
      console.log('🎯 Excluding unassigned item from category filter:', item.id, item.name);
      return false;
    }

    // De-duplicate: if we've seen this ID before, skip it
    if (selectedCategory && seenIds.has(item.id)) {
      console.log('🎯 Skipping duplicate ID:', item.id, 'category:', item.memory?.category || item.category);
      return false;
    }
    // 1. Handle unassigned images (no memory association)
    if (!item.memory && item.category === 'Unassigned') {
      // isFromUnassignedArray items are explicitly unassigned — no need to check expandedCategories
      const isUnassignedExpanded = (item as any).isFromUnassignedArray || expandedCategories.includes('Unassigned');
      const matchesSelected = !selectedCategory || selectedCategory === 'Unassigned';
      const shouldShow = isUnassignedExpanded && showUnassignedImages && matchesSelected;
      if (shouldShow && selectedCategory) seenIds.add(item.id);
      return shouldShow;
    }

    // 2. Handle uploaded items (no memory, no category)
    if (!item.memory && !item.category) {
      // If a specific category is selected, don't show uploaded items
      // Only show them when viewing all categories
      const shouldShow = !selectedCategory;
      if (shouldShow && selectedCategory) seenIds.add(item.id);
      return shouldShow;
    }

    // 3. Handle items with memories
    if (item.memory) {
      const itemCategory = item.memory.category;

      // If a specific category is selected, STRICT match - must have that exact category
      if (selectedCategory) {
        const shouldShow = itemCategory === selectedCategory;
        if (shouldShow) {
          seenIds.add(item.id);
          console.log('🎯 Including item ID:', item.id, 'from category:', itemCategory);
        }
        return shouldShow;
      }

      // Otherwise, check if category is expanded
      const isCategoryExpanded = expandedCategories.includes(itemCategory);
      if (!isCategoryExpanded) {
        return false; // Category not expanded, don't show
      }

      // Apply search filter if there's a query
      if (searchQuery.trim()) {
        const matchesSearch =
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.memory.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          itemCategory.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
      }

      return true; // Category expanded, no search, show item
    }

    // 4. Fallback for other items
    return false;
  });
};

// Sort media items
export const sortMediaItems = (
  items: MediaItem[], 
  sortBy: string, 
  sortOrder: 'asc' | 'desc'
): MediaItem[] => {
  const sortedItems = [...items].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'size':
        // Convert sizes to MB for consistent comparison
        const getSizeInMB = (sizeStr: string): number => {
          const size = parseFloat(sizeStr.replace(/[^\d.]/g, ''));
          if (sizeStr.includes('KB')) {
            return size / 1024; // Convert KB to MB
          }
          return size; // Already in MB
        };
        const sizeA = getSizeInMB(a.size);
        const sizeB = getSizeInMB(b.size);
        comparison = sizeA - sizeB;
        break;
      case 'location':
        const locationA = a.location ? `${a.location.city}, ${a.location.country}` : 'Unknown';
        const locationB = b.location ? `${b.location.city}, ${b.location.country}` : 'Unknown';
        comparison = locationA.localeCompare(locationB);
        break;
      case 'memory':
        const memoryA = a.memory?.title || 'No memory';
        const memoryB = b.memory?.title || 'No memory';
        comparison = memoryA.localeCompare(memoryB);
        break;
      case 'upload_latest':
        const uploadLatestA = new Date((a as any).uploadedAt || a.date).getTime();
        const uploadLatestB = new Date((b as any).uploadedAt || b.date).getTime();
        return uploadLatestB - uploadLatestA; // DESC — newest upload first
      case 'upload_oldest':
        const uploadOldestA = new Date((a as any).uploadedAt || a.date).getTime();
        const uploadOldestB = new Date((b as any).uploadedAt || b.date).getTime();
        return uploadOldestA - uploadOldestB; // ASC — oldest upload first
      case 'date':
      default:
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        comparison = dateA - dateB;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  return sortedItems;
};

// Get memories for a specific category
export const getMemoriesForCategory = (existingMemories: ExistingMemory[], category: string): ExistingMemory[] => {
  return existingMemories.filter(memory => memory.category === category);
};

// Calculate total file size
export const calculateTotalSize = (items: MediaItem[]): string => {
  const totalMB = items.reduce((acc, item) => {
    // Ensure size is a string before using string methods
    if (!item.size || typeof item.size !== 'string') {
      return acc;
    }

    const size = parseFloat(item.size.replace(/[^\d.]/g, ''));
    if (isNaN(size)) {
      return acc;
    }

    return acc + (item.size.includes('KB') ? size / 1024 : size);
  }, 0);
  return totalMB.toFixed(1);
};