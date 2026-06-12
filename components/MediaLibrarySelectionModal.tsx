import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Image as ImageIcon, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { dashboardAPI } from '../utils/authUtils';
import { Badge } from './ui/badge';
import { mediaAPI } from '../services/mediaAPI';

interface MediaLibraryItem {
  id: string;
  name: string;
  image: string;
  category?: string;
  location?: string;
  capture_date?: string;
  captureDate?: string;
  capture_time?: string;
  captureTime?: string;
  fileUrl?: string;
  imageName?: string;
  originalSizeMB?: number;
}

interface MediaLibrarySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedItems: MediaLibraryItem[]) => void;
}

export default function MediaLibrarySelectionModal({
  isOpen,
  onClose,
  onConfirm
}: MediaLibrarySelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [mediaItems, setMediaItems] = useState<MediaLibraryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Fetch media library data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchMediaLibrary();
    }
  }, [isOpen]);

  const fetchMediaLibrary = async () => {
    setIsLoading(true);
    try {
      console.log('📚 Fetching media library data...');
      const response = await mediaAPI.getMemoryImages();
      console.log('📚 Media library response:', response);

      if (response && response.success && response.data) {
        const data = response.data;
        console.log('📚 Processing media data:', data);

        // Transform the data to match our interface
        const items: MediaLibraryItem[] = [];
        const categorySet = new Set<string>();

        // Process categories_media (same structure as MediaPage)
        if (data.categories_media && typeof data.categories_media === 'object') {
          const categoryNames = Object.keys(data.categories_media);
          console.log('📚 Processing categories:', categoryNames);

          categoryNames.forEach(categoryName => {
            const categoryData = data.categories_media[categoryName];
            console.log(`📚 Processing category: ${categoryName}`, categoryData);

            // Normalize category name
            const normalizedCategoryName = categoryName === 'sharedwith' ? 'Shared With' : categoryName;

            if (Array.isArray(categoryData)) {
              categoryData.forEach((item: any) => {
                // Only process media items (not memory metadata)
                if (item.media_id && item.media_url) {
                  categorySet.add(normalizedCategoryName);
                  items.push({
                    id: item.media_id?.toString() || '',
                    name: item.name || `IMG_${item.media_id}.jpg`,
                    image: item.media_url,
                    category: normalizedCategoryName,
                    location: item.location || '',
                    capture_date: item.capture_date || '',
                    captureDate: item.capture_date || '',
                    capture_time: '',
                    captureTime: '',
                    fileUrl: item.media_url,
                    imageName: item.name || '',
                    originalSizeMB: parseFloat(item.media_size) || 0
                  });
                }
              });
            }
          });
        }

        // Process unassigned_media (not unassigned_images)
        if (data.unassigned_media && Array.isArray(data.unassigned_media)) {
          console.log('📚 Processing unassigned media:', data.unassigned_media.length);
          categorySet.add('Unassigned');

          data.unassigned_media.forEach((item: any) => {
            if (item.media_id && item.media_url) {
              items.push({
                id: item.media_id?.toString() || '',
                name: item.name || `IMG_${item.media_id}.jpg`,
                image: item.media_url,
                category: 'Unassigned',
                location: item.location || '',
                capture_date: item.capture_date || '',
                captureDate: item.capture_date || '',
                capture_time: '',
                captureTime: '',
                fileUrl: item.media_url,
                imageName: item.name || '',
                originalSizeMB: parseFloat(item.media_size) || 0
              });
            }
          });
        }

        console.log('📚 Final items count:', items.length);
        console.log('📚 Categories:', Array.from(categorySet));
        setMediaItems(items);
        setCategories(['All Categories', ...Array.from(categorySet)]);
        console.log('📚 Loaded media items:', items.length);
      } else {
        console.error('📚 Failed to fetch media library:', response?.error);
      }
    } catch (error) {
      console.error('📚 Error fetching media library:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter items based on search and category
  const filteredItems = mediaItems.filter(item => {
    const matchesSearch = searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.location && item.location.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' ||
      selectedCategory === 'All Categories' ||
      item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleToggleSelect = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedItems(new Set());
  };

  const handleConfirm = () => {
    const selected = mediaItems.filter(item => selectedItems.has(item.id));
    console.log('📚 Confirming selection:', selected);
    onConfirm(selected);
    handleClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedItems(new Set());
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
      style={{ zIndex: 100001 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-3xl relative flex flex-col"
        style={{
          zIndex: 100002,
          height: '80vh',
          maxHeight: '80vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#7B68EE] rounded-full flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Add Moments from Library</h2>
              <p className="text-xs text-gray-500">Select photos to add as moments</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search your media library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-50 border-gray-200"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48 bg-gray-50 border-gray-200">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent style={{ zIndex: 100003 }}>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.filter(cat => cat !== 'All Categories').map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selection Info Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="text-sm text-gray-700">
            <span className="text-[#7B68EE] font-medium">{selectedItems.size}</span> of <span className="font-medium">{filteredItems.length}</span> selected
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="text-sm text-[#7B68EE] hover:text-[#6B5DD3] font-medium"
            >
              {selectedItems.size === filteredItems.length && filteredItems.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
            {selectedItems.size > 0 && (
              <button
                onClick={handleClearSelection}
                className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear Selection
              </button>
            )}
          </div>
        </div>

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-[#7B68EE] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Loading media library...</p>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {searchQuery ? `No media found matching "${searchQuery}"` : 'No media in library'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const isSelected = selectedItems.has(item.id);
                return (
                  <div
                    key={item.id}
                    className="flex flex-col"
                  >
                    <div
                      onClick={() => handleToggleSelect(item.id)}
                      className={`relative rounded-lg overflow-hidden cursor-pointer transition-all border-2 ${
                        isSelected
                          ? 'border-[#7B68EE]'
                          : 'border-transparent hover:border-gray-300'
                      }`}
                      style={{ aspectRatio: '4/3' }}
                    >
                      <ImageWithFallback
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        fallback={
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-gray-400" />
                          </div>
                        }
                      />

                      {/* Category Badge - Top Left */}
                      {item.category && (
                        <div className="absolute top-2 left-2">
                          <Badge
                            className="text-xs px-2 py-0.5 bg-[#7B68EE] text-white border-0 font-medium"
                          >
                            {item.category}
                          </Badge>
                        </div>
                      )}

                      {/* Selection Checkmark - Top Right */}
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md">
                            <Check className="w-4 h-4 text-[#7B68EE]" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Image Info Below */}
                    <div className="mt-2 px-1">
                      <p className="text-sm text-gray-900 font-medium truncate">{item.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.originalSizeMB ? `${item.originalSizeMB.toFixed(1)} MB` : 'Unknown size'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center justify-between p-4">
            <div className="text-sm text-gray-700">
              <span className="font-medium">{selectedItems.size}</span> photo{selectedItems.size !== 1 ? 's' : ''} selected
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="text-sm border-gray-300 hover:bg-gray-50 px-6"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={selectedItems.size === 0}
                className="bg-[#7B68EE] hover:bg-[#6B5DD3] text-white text-sm px-6 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Add {selectedItems.size} Moment{selectedItems.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
