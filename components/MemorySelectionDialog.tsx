import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Folder, FolderOpen, Plus, Check, X, Image as ImageIcon, Tag, Search, Users } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { getCategoryColor } from '../constants/mediaConstants';
import { dashboardAPI, userDisplayUtils } from '../utils/authUtils';
import { useAuth } from '../contexts/AuthContext';

type ActiveTab = 'existing' | 'new' | 'library';

interface BBox { top: number; left: number; width: number; height: number; }

function FaceCropFill({ src, bbox, fallback }: { src: string; bbox: BBox | null; fallback: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (errored) return <>{fallback}</>;

  const hasValidBbox = bbox && bbox.width && bbox.height && size > 0;
  let imgStyle: React.CSSProperties = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' };

  if (hasValidBbox) {
    const { left, top, width, height } = bbox;
    const PADDING = 0.25;
    const cx = left + width / 2;
    const cy = top + height / 2;
    const S = 1 / (Math.max(width, height) * (1 + 2 * PADDING));
    const translateX = size * (0.5 - cx * S);
    const translateY = size * (0.5 - cy * S);
    imgStyle = { position: 'absolute', width: size, height: size, objectFit: 'cover', transformOrigin: '0 0', transform: `translate(${translateX}px, ${translateY}px) scale(${S})` };
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <img src={src} alt="" style={imgStyle} onError={() => setErrored(true)} />
    </div>
  );
}

interface SelectedMediaItem {
  id: string;
  name: string;
  thumbnail: string;
  type: 'image' | 'video';
}

interface ExistingMemory {
  id: string;
  title: string;
  category: string;
  thumbnail: string;
  imageCount: number;
  date: string;
  type: 'personal' | 'shared';
  author?: string;
  tags?: string[];
}

interface CategoryInfo {
  name: string;
  color: string;
  count: number;
  isUserCreated?: boolean;
}

interface MemorySelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMemory: (memoryIds: string[], memoryTitles?: string[], category?: string) => void;
  memories: ExistingMemory[];
  availableCategories: CategoryInfo[];
  selectedItems: SelectedMediaItem[];
  onRefresh?: () => void;
  onClearSelection?: () => void;
}

// User Fallback Avatar Component for memory thumbnails
function UserFallbackAvatar({ 
  user, 
  size = 'w-8 h-8', 
  className = '',
  fillContainer = false 
}: { 
  user?: { name?: string; avatar?: string; profile_color?: string };
  size?: string;
  className?: string;
  fillContainer?: boolean;
}) {
  const initials = userDisplayUtils.generateInitials(user?.name || '');
  const profileColor = userDisplayUtils.formatProfileColor(user?.profile_color);
  
  // Use profile_color if available, otherwise use default gradient (matching header)
  const backgroundStyle = profileColor 
    ? { backgroundColor: profileColor }
    : undefined;
  
  // Choose size classes based on fillContainer prop
  const sizeClasses = fillContainer ? 'w-full h-full' : size;
  const roundingClasses = fillContainer ? '' : 'rounded-full';
  
  const fallbackClassName = profileColor 
    ? `${sizeClasses} ${roundingClasses} text-white font-medium text-xs flex items-center justify-center flex-shrink-0 ${className}`
    : `${sizeClasses} ${roundingClasses} bg-gradient-to-br from-[#6C60FF] to-purple-600 text-white font-medium text-xs flex items-center justify-center flex-shrink-0 ${className}`;
  
  if (user?.avatar) {
    // Show user profile image if available
    return (
      <div className={`${sizeClasses} ${roundingClasses} overflow-hidden bg-gray-100 flex-shrink-0 ${className}`}>
        <img
          src={user.avatar}
          alt={user.name || 'User'}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to initials if profile image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
        <div 
          className={fallbackClassName}
          style={{
            ...backgroundStyle,
            display: 'none'
          }}
        >
          {initials}
        </div>
      </div>
    );
  }
  
  // Show user initials if no profile image
  if (initials) {
    return (
      <div 
        className={fallbackClassName}
        style={backgroundStyle}
      >
        {initials}
      </div>
    );
  }
  
  // Fallback to generic folder icon for memories if no name available
  return (
    <div className={`${sizeClasses} ${roundingClasses} bg-gray-200 flex items-center justify-center flex-shrink-0 ${className}`}>
      <Folder className="w-4 h-4 text-gray-400" />
    </div>
  );
}

export default function MemorySelectionDialog({
  isOpen,
  onClose,
  onSelectMemory,
  memories = [], // Add default empty array
  availableCategories = [], // Add default empty array
  selectedItems = [], // Add default empty array
  onRefresh,
  onClearSelection
}: MemorySelectionDialogProps) {
  // Get user context for profile image and initials fallback
  const { user } = useAuth();
  
  // Debug memories data
  console.log('🔍 MemorySelectionDialog Debug:');
  console.log('memories prop:', memories);
  console.log('memories length:', memories?.length);
  console.log('availableMemories after filter:', memories.filter(memory => memory.category !== 'Published'));
  console.log('isOpen:', isOpen);
  console.log('availableCategories prop:', availableCategories);
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('existing');
  const [newMemoryTitle, setNewMemoryTitle] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiCategories, setApiCategories] = useState<CategoryInfo[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categoryMapping, setCategoryMapping] = useState<{[key: string]: string}>({});
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('all');
  const [filterCategories, setFilterCategories] = useState<CategoryInfo[]>([]);
  const [filterMode, setFilterMode] = useState<'none' | 'category' | 'tags'>('none');
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  // Library tab state
  const [libraryFaces, setLibraryFaces] = useState<any[]>([]);
  const [isLoadingFaces, setIsLoadingFaces] = useState(false);
  const [selectedFaceIds, setSelectedFaceIds] = useState<string[]>([]);

  // Fetch categories for filtering when dialog opens (for both tabs)
  useEffect(() => {
    const fetchFilterCategories = async () => {
      if (isOpen && filterCategories.length === 0) {
        console.log('🔍 Fetching categories for memory filtering...');
        try {
          const response = await dashboardAPI.getUserCategories();
          console.log('📊 Filter Categories API response:', response);
          
          const responseData = response.data?.data || response.data;
          if (response.success && responseData && responseData.categories) {
            const transformedCategories = responseData.categories.map((cat: any) => ({
              name: cat.name,
              color: cat.color || getCategoryColor(cat.name),
              count: cat.memory_count || 0,
              id: cat.id?.toString(),
              isUserCreated: !cat.is_default
            }));
            
            setFilterCategories(transformedCategories);
            console.log('✅ Filter categories loaded:', transformedCategories);
          }
        } catch (error) {
          console.error('❌ Error fetching filter categories:', error);
        }
      }
    };

    fetchFilterCategories();
  }, [isOpen]);

  // Fetch library faces when Library tab is opened
  useEffect(() => {
    const fetchFaces = async () => {
      if (isOpen && activeTab === 'library' && libraryFaces.length === 0) {
        setIsLoadingFaces(true);
        try {
          const response = await dashboardAPI.getLibraryFaces();
          if (response.success && response.data) {
            const payload = response.data?.data ?? response.data;
            const faces: any[] = payload?.faces ?? [];
            setLibraryFaces(faces);
          }
        } catch (error) {
          console.error('Error fetching library faces:', error);
        } finally {
          setIsLoadingFaces(false);
        }
      }
    };
    fetchFaces();
  }, [isOpen, activeTab]);

  // Fetch categories when user switches to Create New Memory tab
  useEffect(() => {
    console.log('🔄 useEffect triggered with:', { isOpen, activeTab, apiCategoriesLength: apiCategories.length });

    const fetchCategories = async () => {
      console.log('🔍 fetchCategories function called');

      if (isOpen && activeTab === 'new' && apiCategories.length === 0) {
        console.log('✅ Condition met, starting API call...');
        setIsLoadingCategories(true);
        try {
          console.log('🚀 Fetching categories for Create New Memory...');
          const response = await dashboardAPI.getUserCategories();
          console.log('📊 Categories API response:', response);
          console.log('📊 Response success:', response?.success);
          console.log('📊 Response data:', response?.data);
          console.log('📊 Response error:', response?.error);
          
          // Handle nested response structure
          const responseData = response.data?.data || response.data;
          console.log('📊 Response data after extraction:', responseData);
          
          if (response.success && responseData && responseData.categories) {
            console.log('📊 Processing categories data...');
            // Transform API response to match CategoryInfo interface
            const transformedCategories = responseData.categories.map((cat: any) => ({
              name: cat.name,
              color: cat.color || getCategoryColor(cat.name),
              count: cat.memory_count || 0,
              id: cat.id?.toString(),
              isUserCreated: !cat.is_default, // Use is_default to determine if user created
              admin_id: cat.is_default ? null : cat.id // Set admin_id for non-default categories
            }));
            
            // Create mapping of category name to category ID
            const mapping = responseData.categories.reduce((acc: any, cat: any) => {
              acc[cat.name] = cat.id;
              return acc;
            }, {});
            
            setApiCategories(transformedCategories);
            setCategoryMapping(mapping);
            console.log('✅ Categories loaded and set:', transformedCategories);
            console.log('✅ Category mapping created:', mapping);
          } else {
            console.log('❌ API call failed or no data:', response);
          }
        } catch (error) {
          console.error('❌ Error fetching categories:', error);
          console.error('❌ Error details:', error);
        } finally {
          setIsLoadingCategories(false);
        }
      }
    };

    fetchCategories();
  }, [isOpen, activeTab]);

  const handleClose = () => {
    setSelectedMemoryIds([]);
    setActiveTab('existing');
    setNewMemoryTitle('');
    setNewMemoryCategory('');
    setSelectedFilterCategory('all');
    setFilterMode('none');
    setTagSearchQuery('');
    setSelectedTagFilter('all');
    setSelectedFaceIds([]);
    setIsProcessing(false);
    onClose();
  };

  const handleAssignToFaces = async () => {
    if (selectedFaceIds.length === 0) return;
    setIsProcessing(true);
    try {
      const mediaIds = selectedItems.map(item => parseInt(item.id)).filter(id => !isNaN(id));
      const response = await dashboardAPI.assignMediaToFaces({ face_ids: selectedFaceIds, media_ids: mediaIds });
      if (response.success) {
        toast.success(`Assigned ${mediaIds.length} image${mediaIds.length !== 1 ? 's' : ''} to ${selectedFaceIds.length} person${selectedFaceIds.length !== 1 ? 's' : ''}!`);
        handleClose();
        if (onClearSelection) onClearSelection();
        if (onRefresh) onRefresh();
      } else {
        toast.error(response.error || 'Failed to assign media to faces');
      }
    } catch (error) {
      console.error('Error assigning media to faces:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddToExisting = async () => {
    if (selectedMemoryIds.length === 0) return;

    setIsProcessing(true);
    try {
      const titles = selectedMemoryIds.map(id => memories.find(m => m.id === id)?.title).filter(Boolean) as string[];
      await onSelectMemory(selectedMemoryIds, titles);
      handleClose();
    } catch (error) {
      console.error('Failed to add items to memory:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleMemorySelection = (memoryId: string) => {
    setSelectedMemoryIds(prev =>
      prev.includes(memoryId) ? prev.filter(id => id !== memoryId) : [...prev, memoryId]
    );
  };

  const handleCreateNew = async () => {
    if (!newMemoryTitle.trim() || !newMemoryCategory) return;
    
    setIsProcessing(true);
    try {
      // Get the category ID from our mapping
      const categoryId = categoryMapping[newMemoryCategory];
      console.log('🔍 Selected category:', newMemoryCategory, 'ID:', categoryId);
      
      // Pass category in format "name:id" so MediaPage can extract the ID
      const categoryWithId = categoryId ? `${newMemoryCategory}:${categoryId}` : newMemoryCategory;
      console.log('🔍 Passing category to MediaPage:', categoryWithId);
      
      await onSelectMemory(undefined, newMemoryTitle.trim(), categoryWithId);
      handleClose();
    } catch (error) {
      console.error('Failed to create new memory:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Add null checks for safety
  const selectedMemory = Array.isArray(memories) ? memories.find(m => m.id === selectedMemoryIds[0]) : undefined;

  // Collect all unique tags from memories
  const allTags = Array.isArray(memories)
    ? [...new Set(memories.flatMap(m => m.tags || []))]
    : [];

  // Split comma-separated tag search terms
  const tagSearchTerms = tagSearchQuery.split(',').map(t => t.trim().toLowerCase()).filter(t => t);

  // Filtered tags based on search query (matches any of the comma-separated terms)
  const filteredTagOptions = tagSearchTerms.length > 0
    ? allTags.filter(t => tagSearchTerms.some(term => t.toLowerCase().includes(term)))
    : allTags;

  // Filter out published memories (read-only) with null checks and apply category + tag filters
  const availableMemories = Array.isArray(memories) ?
    memories
      .filter(memory => memory.category !== 'Published')
      .filter(memory => filterMode !== 'category' || selectedFilterCategory === 'all' || memory.category === selectedFilterCategory)
      .filter(memory => filterMode !== 'tags' || (selectedTagFilter === 'all' && tagSearchTerms.length === 0) || (memory.tags || []).some(t => {
        const tLower = t.toLowerCase();
        return tagSearchTerms.some(term => tLower.includes(term)) || t === selectedTagFilter;
      }))
    : [];
  
  // For Create New Memory tab, use API categories if loaded, otherwise show loading/dummy
  const categoriesToUse = activeTab === 'new' && apiCategories.length > 0 ? apiCategories : availableCategories;
  const filteredCategories = Array.isArray(categoriesToUse) ? categoriesToUse.filter(cat => cat.name !== 'Published') : [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden bg-white rounded-xl shadow-lg border-0 p-0">
        <div className="overflow-y-auto max-h-[80vh] p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#6C60FF]" />
            Add {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} to Campaign
          </DialogTitle>
          <DialogDescription>
            Choose an existing campaign to add your selected items to, or create a new campaign with them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Selected Items Preview */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">Selected items:</Label>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-1">
                {selectedItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="relative w-24 h-24 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                    <ImageWithFallback
                      src={item.thumbnail}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      fallback={
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-gray-400" />
                        </div>
                      }
                    />
                  </div>
                ))}
                {selectedItems.length > 6 && (
                  <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 border border-gray-200">
                    +{selectedItems.length - 6}
                  </div>
                )}
              </div>
              <span className="text-sm text-gray-600 ml-2">
                {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
              </span>
            </div>
          </div>

          {/* Memory Selection Tabs */}
          <div className="flex items-center gap-2 border-b border-gray-200">
            {(['existing', 'new', 'library'] as ActiveTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-[#6C60FF] text-[#6C60FF]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'existing' ? 'Existing Campaign' : tab === 'new' ? 'Create New Campaign' : 'Library'}
              </button>
            ))}
          </div>

          {/* Content based on selected tab */}
          {activeTab === 'existing' ? (
            /* Add to Existing Campaign */
            <div className="space-y-4">
              {/* Filter Radio Buttons */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="filterCategory"
                    name="filterMode"
                    checked={filterMode === 'category'}
                    onChange={() => setFilterMode(filterMode === 'category' ? 'none' : 'category')}
                    className="w-4 h-4 accent-[#6C60FF] cursor-pointer"
                  />
                  <label htmlFor="filterCategory" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Filter by category:
                  </label>
                </div>
                <div className="w-px h-4 bg-gray-300" />
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="filterTags"
                    name="filterMode"
                    checked={filterMode === 'tags'}
                    onChange={() => setFilterMode(filterMode === 'tags' ? 'none' : 'tags')}
                    className="w-4 h-4 accent-[#6C60FF] cursor-pointer"
                  />
                  <label htmlFor="filterTags" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Filter by Tags
                  </label>
                </div>
              </div>

              {/* Category Filter Dropdown */}
              {filterMode === 'category' && (
                <div className="space-y-2">
                  <Select value={selectedFilterCategory} onValueChange={setSelectedFilterCategory}>
                    <SelectTrigger className="border-gray-200">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-200">
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gray-400" />
                          All Categories
                        </div>
                      </SelectItem>
                      {filterCategories.map((category) => (
                        <SelectItem key={category.name} value={category.name}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                            {category.name}
                            {category.count > 0 && (
                              <span className="text-xs text-gray-500 ml-1">({category.count})</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tags Filter Section */}
              {filterMode === 'tags' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Tags</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        value={tagSearchQuery}
                        onChange={e => { setTagSearchQuery(e.target.value); if (!e.target.value.trim()) setSelectedTagFilter('all'); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') e.preventDefault();
                        }}
                        placeholder="Search tags (e.g. beach, summer)"
                        className="pl-8 h-9 text-sm bg-white border-gray-200"
                      />
                    </div>
                    <Select value={selectedTagFilter} onValueChange={setSelectedTagFilter}>
                      <SelectTrigger className="w-32 h-9 text-sm border-gray-200">
                        <SelectValue placeholder="All Tags" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200">
                        <SelectItem value="all">All Tags</SelectItem>
                        {filteredTagOptions.map(tag => (
                          <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {availableMemories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Folder className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>
                    {selectedFilterCategory === 'all'
                      ? 'No available campaigns found.'
                      : `No campaigns found in "${selectedFilterCategory}" category.`
                    }
                  </p>
                  <p className="text-sm mt-1">
                    {selectedFilterCategory !== 'all'
                      ? 'Try selecting a different category or create a new campaign.'
                      : 'Create a new campaign to get started.'
                    }
                  </p>
                </div>
              ) : (
                <>
                  <Label className="text-sm font-medium text-gray-700">
                    Select a campaign{filterMode === 'category' && selectedFilterCategory !== 'all' && ` in ${selectedFilterCategory}`}:
                    {selectedMemoryIds.length > 0 && (
                      <span className="ml-2 text-[#6C60FF] font-normal">{selectedMemoryIds.length} selected</span>
                    )}
                  </Label>
                  <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
                    {availableMemories.map((memory) => {
                      const isChecked = selectedMemoryIds.includes(memory.id);
                      return (
                        <div
                          key={memory.id}
                          onClick={() => toggleMemorySelection(memory.id)}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            isChecked
                              ? 'border-[#6C60FF] bg-[#6C60FF]/5 shadow-sm'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {/* Checkbox */}
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isChecked ? 'bg-[#6C60FF] border-[#6C60FF]' : 'border-gray-300 bg-white'
                          }`}>
                            {isChecked && <Check className="w-3 h-3 text-white" />}
                          </div>

                          {/* Campaign Thumbnail */}
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <ImageWithFallback
                              src={memory.thumbnail}
                              alt={memory.title}
                              className="w-full h-full object-cover"
                              fallback={
                                <UserFallbackAvatar user={user} fillContainer={true} />
                              }
                            />
                          </div>

                          {/* Campaign Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 truncate">{memory.title}</h3>
                            <div className="flex items-center flex-wrap gap-2 mt-1">
                              <Badge
                                className="text-xs text-white"
                                style={{ backgroundColor: getCategoryColor(memory.category) }}
                              >
                                {typeof memory.category === 'string' ? memory.category : 'Uncategorized'}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {memory.imageCount} item{memory.imageCount !== 1 ? 's' : ''}
                              </span>
                              {filterMode === 'tags' && (memory.tags || []).length > 0 && (
                                <>
                                  <span className="text-xs text-gray-300">·</span>
                                  {(memory.tags || []).slice(0, 2).map((tag, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs text-gray-600">
                                      <X className="w-2.5 h-2.5" />
                                      {tag}
                                    </span>
                                  ))}
                                  {(memory.tags || []).length > 2 && (
                                    <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs text-gray-600">
                                      + {(memory.tags || []).length - 2} more
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : activeTab === 'new' ? (
            /* Create New Campaign */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="memory-title" className="text-sm font-medium text-gray-700">
                  Campaign Title
                </Label>
                <Input
                  id="memory-title"
                  placeholder="Enter campaign title..."
                  value={newMemoryTitle}
                  onChange={(e) => setNewMemoryTitle(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="memory-category" className="text-sm font-medium text-gray-700">
                  Category
                </Label>
                <Select value={newMemoryCategory} onValueChange={setNewMemoryCategory} disabled={isLoadingCategories}>
                  <SelectTrigger id="memory-category">
                    <SelectValue placeholder={isLoadingCategories ? "Loading categories..." : "Select a category..."} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200">
                    {isLoadingCategories ? (
                      <div className="p-3 text-sm text-gray-500 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-300 animate-pulse" />
                        Loading categories...
                      </div>
                    ) : filteredCategories.length > 0 ? (
                      filteredCategories.map((category) => (
                        <SelectItem key={category.name} value={category.name}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            {category.name}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-3 text-sm text-gray-500">
                        No categories available
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {newMemoryCategory && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-blue-800">
                    <Plus className="w-4 h-4" />
                    <span>
                      New campaign "{newMemoryTitle || 'Untitled'}" will be created in{' '}
                      <Badge 
                        className="text-xs text-white ml-1"
                        style={{ backgroundColor: getCategoryColor(newMemoryCategory) }}
                      >
                        {typeof newMemoryCategory === 'string' ? newMemoryCategory : 'Uncategorized'}
                      </Badge>
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Library Tab */
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">
                Select a campaign:
                {selectedFaceIds.length > 0 && (
                  <span className="ml-2 text-[#6C60FF] font-normal">{selectedFaceIds.length} selected</span>
                )}
              </Label>
              {isLoadingFaces ? (
                <div className="flex items-center justify-center py-10 text-gray-400">
                  <div className="w-5 h-5 border-2 border-[#6C60FF] border-t-transparent rounded-full animate-spin mr-2" />
                  Loading library...
                </div>
              ) : libraryFaces.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No faces found in your library.</p>
                  <p className="text-sm mt-1">Upload photos and run AI scan to build your face library.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
                  {libraryFaces.map((face: any, idx: number) => {
                    const faceId = (face.face_id ?? face.cluster_id ?? face.person_id ?? idx).toString();
                    const faceName = face.name || `Person ${idx + 1}`;
                    const faceThumbnail = face.thumbnail || '';
                    const representativePhoto = face.representative_photo || '';
                    const bbox: BBox | null = face.thumbnail
                      ? null
                      : (face.representative_bbox ?? face.memories?.[0]?.photos?.[0]?.bounding_box ?? null);
                    const faceTags: string[] = face.tags || [];
                    const isChecked = selectedFaceIds.includes(faceId);
                    const initials = faceName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
                    const avatarFallback = (
                      <div className="w-full h-full bg-gradient-to-br from-[#6C60FF] to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                        {initials}
                      </div>
                    );
                    return (
                      <div
                        key={faceId}
                        onClick={() => setSelectedFaceIds(prev => prev.includes(faceId) ? prev.filter(id => id !== faceId) : [...prev, faceId])}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isChecked
                            ? 'border-[#6C60FF] bg-[#6C60FF]/5 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isChecked ? 'bg-[#6C60FF] border-[#6C60FF]' : 'border-gray-300 bg-white'
                        }`}>
                          {isChecked && <Check className="w-3 h-3 text-white" />}
                        </div>
                        {/* Face Thumbnail */}
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          {faceThumbnail ? (
                            <ImageWithFallback
                              src={faceThumbnail}
                              alt={faceName}
                              className="w-full h-full object-cover"
                              fallback={avatarFallback}
                            />
                          ) : representativePhoto ? (
                            <FaceCropFill src={representativePhoto} bbox={bbox} fallback={avatarFallback} />
                          ) : avatarFallback}
                        </div>
                        {/* Face Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">{faceName}</h3>
                          {faceTags.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {faceTags.slice(0, 1).map((tag, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 border border-yellow-200 rounded text-xs text-gray-700">
                                  <X className="w-2.5 h-2.5" />
                                  {tag}
                                </span>
                              ))}
                              {faceTags.length > 1 && (
                                <span className="inline-flex items-center px-2 py-0.5 bg-yellow-100 border border-yellow-200 rounded text-xs text-gray-700">
                                  + {faceTags.length - 1} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center gap-2 pt-4 mt-2 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>

          {activeTab === 'existing' ? (
            <Button
              onClick={handleAddToExisting}
              disabled={selectedMemoryIds.length === 0 || isProcessing}
              className="bg-[#6C60FF] hover:bg-[#5951E6] text-white"
            >
              {isProcessing ? 'Adding...' : (
                <><Plus className="w-4 h-4 mr-1" />Add to {selectedMemoryIds.length > 1 ? `${selectedMemoryIds.length} Campaigns` : 'Campaign'}</>
              )}
            </Button>
          ) : activeTab === 'new' ? (
            <Button
              onClick={handleCreateNew}
              disabled={!newMemoryTitle.trim() || !newMemoryCategory || isProcessing}
              className="bg-[#6C60FF] hover:bg-[#5951E6] text-white"
            >
              {isProcessing ? 'Creating...' : (
                <><Plus className="w-4 h-4 mr-1" />Create Campaign</>
              )}
            </Button>
          ) : (
            <Button
              disabled={selectedFaceIds.length === 0 || isProcessing}
              className="bg-[#6C60FF] hover:bg-[#5951E6] text-white"
              onClick={handleAssignToFaces}
            >
              {isProcessing ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />Assigning...</>
              ) : (
                <><Check className="w-4 h-4 mr-1" />Assign to {selectedFaceIds.length > 0 ? `${selectedFaceIds.length} Person${selectedFaceIds.length !== 1 ? 's' : ''}` : 'Person'}</>
              )}
            </Button>
          )}
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}