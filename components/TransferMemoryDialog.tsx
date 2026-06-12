import { useState, useEffect } from 'react';
import { X, ArrowRight, Image as ImageIcon, MapPin, Calendar, Loader2, Search } from 'lucide-react';
import { dashboardAPI } from '../utils/authUtils';
import { toast } from 'sonner';

interface Memory {
  id: number;
  title: string;
  last_update_img?: string; // Thumbnail from API
  updated_at?: string; // Last updated date
  photos?: {
    count?: number;
    preview_images?: {
      id: number;
      url: string;
      type: string;
    }[];
  };
  last_updated?: string;
  last_updated_image?: string;
  thumbnail?: string;
  image?: string;
  category?: {
    id?: number;
    name: string;
    color?: string;
    badge_style?: {
      bg: string;
      text: string;
      hex_color: string;
    };
  };
  author?: {
    id: number;
    name: string;
    email: string;
    avatar?: string | null;
    profile_image?: string | null;
    initials?: string;
  };
}

interface Property {
  id: number;
  name: string;
  username: string;
  unique_id: string;
  image?: string;
  location?: string;
}

interface TransferMemoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  memories: Memory[];
  properties: Property[];
  currentPropertyId?: number;
  onTransferSuccess?: () => void;
  currentUserAvatar?: string;
  currentUserProfileColor?: string;
}

export default function TransferMemoryDialog({
  isOpen,
  onClose,
  memories,
  properties,
  currentPropertyId,
  onTransferSuccess,
  currentUserAvatar,
  currentUserProfileColor
}: TransferMemoryDialogProps) {
  const [selectedMemories, setSelectedMemories] = useState<Memory[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<Property[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);
  const [showMemoryDropdown, setShowMemoryDropdown] = useState(false);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [memorySearch, setMemorySearch] = useState('');
  const [propertySearch, setPropertySearch] = useState('');

  // Filter out current property from the list
  const availableProperties = properties.filter(p => p.id !== currentPropertyId);

  // Filtered lists based on search
  const filteredMemories = memories.filter(m => {
    if (!memorySearch.trim()) return true;
    const q = memorySearch.toLowerCase();
    return (m.title || '').toLowerCase().includes(q) || (m.category?.name || '').toLowerCase().includes(q);
  });

  const filteredProperties = availableProperties.filter(p => {
    if (!propertySearch.trim()) return true;
    const q = propertySearch.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q);
  });

  // Helper function to get user initials
  const getUserInitials = (name: string | undefined): string => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  // Toggle memory selection
  const toggleMemorySelection = (memory: Memory) => {
    setSelectedMemories(prev => {
      const isSelected = prev.some(m => m.id === memory.id);
      if (isSelected) {
        return prev.filter(m => m.id !== memory.id);
      } else {
        return [...prev, memory];
      }
    });
  };

  // Check if memory is selected
  const isMemorySelected = (memoryId: number) => {
    return selectedMemories.some(m => m.id === memoryId);
  };

  // Reset selections when dialog opens
  useEffect(() => {
    if (isOpen) {
      console.log('🔄 Transfer Dialog opened');
      console.log('🔄 Memories available:', memories?.length || 0);
      console.log('🔄 Properties available:', properties?.length || 0);
      console.log('🔄 Sample memory:', memories?.[0]);
      if (memories?.[0]) {
        console.log('🔄 Memory thumbnail fields:', {
          last_update_img: memories[0].last_update_img,
          last_updated_image: memories[0].last_updated_image,
          preview_images: memories[0].photos?.preview_images?.[0]?.url,
          thumbnail: memories[0].thumbnail,
          image: memories[0].image,
          author_profile: memories[0].author?.profile_image,
          author_avatar: memories[0].author?.avatar,
          updated_at: memories[0].updated_at
        });
      }

      setSelectedMemories([]);
      setSelectedProperties([]);
      setShowMemoryDropdown(false);
      setShowPropertyDropdown(false);
      setMemorySearch('');
      setPropertySearch('');
    }
  }, [isOpen, memories, properties]);

  const handleTransfer = async () => {
    if (selectedMemories.length === 0 || selectedProperties.length === 0) {
      toast.error('Please select at least one campaign and a property');
      return;
    }

    setIsTransferring(true);

    try {
      const memoryIds = selectedMemories.map(m => m.id);

      console.log('🔄 Transferring campaigns:', memoryIds);
      console.log('🔄 To properties:', selectedProperties.map(p => p.id));

      // Transfer to each selected property
      const results = await Promise.all(
        selectedProperties.map(property => dashboardAPI.transferMemoriesToProperty(memoryIds, property.id))
      );

      const allSuccess = results.every(r => r.success);

      if (allSuccess) {
        const memoryText = selectedMemories.length === 1 ? `"${selectedMemories[0].title}"` : `${selectedMemories.length} campaigns`;
        const propertyText = selectedProperties.length === 1 ? `"${selectedProperties[0].name}"` : `${selectedProperties.length} properties`;
        toast.success(`${memoryText} successfully transferred to ${propertyText}`);
        onTransferSuccess?.();
        onClose();
      } else {
        toast.error('Failed to transfer to some properties. Please try again.');
      }
    } catch (error: any) {
      console.error('Error transferring campaigns:', error);
      toast.error(error?.message || 'Failed to transfer campaigns. Please try again.');
    } finally {
      setIsTransferring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#6C60FF] to-[#8B7EFF] px-6 py-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Transfer Campaigns</h2>
            <p className="text-white/90 text-sm">Move one or more campaigns from one property to another</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Campaign Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select Campaigns <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <button
                onClick={() => {
                  setShowMemoryDropdown(!showMemoryDropdown);
                  setShowPropertyDropdown(false);
                }}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-[#6C60FF] focus:border-[#6C60FF] focus:outline-none transition-all text-left bg-gray-50 hover:bg-white"
              >
                {selectedMemories.length > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">
                      {selectedMemories.length} {selectedMemories.length === 1 ? 'campaign' : 'campaigns'} selected
                    </span>
                    <span className="text-sm text-[#6C60FF] font-medium">
                      Click to change
                    </span>
                  </div>
                ) : (
                  <div className="text-gray-400 flex items-center justify-between">
                    <span>Choose campaigns to transfer...</span>
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
              </button>

              {/* Campaign Dropdown */}
              {showMemoryDropdown && (
                <div className="w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-96 overflow-hidden flex flex-col">
                  {memories.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No campaigns available
                    </div>
                  ) : (
                    <>
                      {/* Header with search and close */}
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 sticky top-0 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            {selectedMemories.length} selected
                          </span>
                          <button
                            onClick={() => setShowMemoryDropdown(false)}
                            className="text-sm text-[#6C60FF] hover:text-[#5A4FE5] font-medium"
                          >
                            Done
                          </button>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search campaigns..."
                            value={memorySearch}
                            onChange={(e) => setMemorySearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#6C60FF] bg-white"
                          />
                        </div>
                      </div>

                      {/* Scrollable list */}
                      <div className="overflow-y-auto max-h-72">
                        {filteredMemories.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 text-sm">No campaigns found</div>
                        ) : filteredMemories.map((memory) => {
                          const isSelected = isMemorySelected(memory.id);
                          return (
                            <button
                              key={memory.id}
                              onClick={() => toggleMemorySelection(memory)}
                              className={`w-full p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${
                                isSelected ? 'bg-purple-50' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {/* Checkbox */}
                                <div className="flex-shrink-0">
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                    isSelected
                                      ? 'bg-[#6C60FF] border-[#6C60FF]'
                                      : 'border-gray-300 bg-white'
                                  }`}>
                                    {isSelected && (
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                </div>

                                {/* Campaign image or user profile */}
                                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                                  {(() => {
                                    const imageUrl =
                                      memory.last_update_img ||
                                      memory.last_updated_image ||
                                      memory.photos?.preview_images?.[0]?.url ||
                                      memory.thumbnail ||
                                      memory.image;

                                    if (imageUrl) {
                                      return (
                                        <img
                                          src={imageUrl}
                                          alt={memory.title}
                                          className="w-full h-full object-cover"
                                        />
                                      );
                                    } else if (memory.author?.profile_image || memory.author?.avatar || currentUserAvatar) {
                                      return (
                                        <img
                                          src={memory.author?.profile_image || memory.author?.avatar || currentUserAvatar || ''}
                                          alt={memory.title}
                                          className="w-full h-full object-cover"
                                        />
                                      );
                                    } else {
                                      const bgColor = currentUserProfileColor
                                        ? (currentUserProfileColor.startsWith('#') ? currentUserProfileColor : `#${currentUserProfileColor}`)
                                        : '#6C60FF';
                                      return (
                                        <div
                                          className="w-full h-full flex items-center justify-center font-semibold text-lg text-white"
                                          style={{ backgroundColor: bgColor }}
                                        >
                                          {memory.author?.initials || getUserInitials(memory.author?.name)}
                                        </div>
                                      );
                                    }
                                  })()}
                                </div>

                                {/* Campaign details */}
                                <div className="flex-1 min-w-0 text-left">
                                  <div className="font-semibold text-gray-900 truncate">{memory.title || 'Untitled Campaign'}</div>
                                  {(memory.updated_at || memory.last_updated) && (
                                    <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                      <Calendar className="w-3.5 h-3.5" />
                                      {(() => {
                                        const dateStr = memory.updated_at || memory.last_updated || '';
                                        try {
                                          const date = new Date(dateStr);
                                          return date.toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                          });
                                        } catch {
                                          return dateStr;
                                        }
                                      })()}
                                    </div>
                                  )}
                                  {memory.category?.name && (
                                    <div className="text-xs text-gray-400 mt-1">
                                      <span
                                        className="inline-block px-2 py-0.5 rounded-full"
                                        style={{
                                          backgroundColor: memory.category?.badge_style?.hex_color ? `${memory.category.badge_style.hex_color}20` : '#e5e7eb',
                                          color: memory.category?.badge_style?.hex_color || '#6b7280'
                                        }}
                                      >
                                        {memory.category.name}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Selected Campaigns Display */}
            {selectedMemories.length > 0 && (
              <div className="mt-4 space-y-2">
                {selectedMemories.map((memory) => {
                  const imageUrl =
                    memory.last_update_img ||
                    memory.last_updated_image ||
                    memory.photos?.preview_images?.[0]?.url ||
                    memory.thumbnail ||
                    memory.image;

                  return (
                    <div
                      key={memory.id}
                      className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg"
                    >
                      {/* Campaign Image */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={memory.title}
                            className="w-full h-full object-cover"
                          />
                        ) : memory.author?.profile_image || memory.author?.avatar || currentUserAvatar ? (
                          <img
                            src={memory.author?.profile_image || memory.author?.avatar || currentUserAvatar || ''}
                            alt={memory.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center font-semibold text-sm text-white"
                            style={{ backgroundColor: currentUserProfileColor ? (currentUserProfileColor.startsWith('#') ? currentUserProfileColor : `#${currentUserProfileColor}`) : '#6C60FF' }}
                          >
                            {memory.author?.initials || getUserInitials(memory.author?.name)}
                          </div>
                        )}
                      </div>

                      {/* Campaign Title */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{memory.title || 'Untitled Campaign'}</p>
                        {memory.category?.name && (
                          <p className="text-xs text-gray-500 mt-0.5">{memory.category.name}</p>
                        )}
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => toggleMemorySelection(memory)}
                        className="flex-shrink-0 p-1.5 hover:bg-purple-100 rounded-lg transition-colors"
                        title="Remove campaign"
                      >
                        <X className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Property Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Transfer To Property <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <button
                onClick={() => {
                  setShowPropertyDropdown(!showPropertyDropdown);
                  setShowMemoryDropdown(false);
                }}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-[#6C60FF] focus:border-[#6C60FF] focus:outline-none transition-all text-left bg-gray-50 hover:bg-white"
              >
                {selectedProperties.length === 0 ? (
                  <div className="text-gray-400 flex items-center justify-between">
                    <span>Choose destination property...</span>
                    <MapPin className="w-5 h-5" />
                  </div>
                ) : selectedProperties.length === 1 ? (
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                      {selectedProperties[0].image ? (
                        <img src={selectedProperties[0].image} alt={selectedProperties[0].name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-semibold text-lg">
                          {selectedProperties[0].name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{selectedProperties[0].name}</div>
                      {selectedProperties[0].location && (
                        <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {selectedProperties[0].location}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {selectedProperties.slice(0, 3).map(p => (
                        <div key={p.id} className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 border-2 border-white flex-shrink-0">
                          {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : (
                            <div className="w-full h-full flex items-center justify-center bg-[#6C60FF] text-white text-xs font-semibold">{p.name.charAt(0).toUpperCase()}</div>
                          )}
                        </div>
                      ))}
                    </div>
                    <span className="font-semibold text-gray-900">{selectedProperties.length} properties selected</span>
                  </div>
                )}
              </button>

              {/* Property Dropdown */}
              {showPropertyDropdown && (
                <div className="w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-hidden flex flex-col">
                  {/* Search + Select All */}
                  <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 sticky top-0 flex items-center gap-2">
                    {/* Select All checkbox */}
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = availableProperties.every(p => selectedProperties.some(sp => sp.id === p.id));
                        setSelectedProperties(allSelected ? [] : [...availableProperties]);
                      }}
                      className="flex-shrink-0"
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${availableProperties.length > 0 && availableProperties.every(p => selectedProperties.some(sp => sp.id === p.id)) ? 'bg-[#6C60FF] border-[#6C60FF]' : 'border-gray-300 bg-white'}`}>
                        {availableProperties.length > 0 && availableProperties.every(p => selectedProperties.some(sp => sp.id === p.id)) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                    {/* Search */}
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search properties..."
                        value={propertySearch}
                        onChange={(e) => setPropertySearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#6C60FF] bg-white"
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto">
                  {filteredProperties.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No properties found
                    </div>
                  ) : (
                    filteredProperties.map((property) => {
                      const isSelected = selectedProperties.some(p => p.id === property.id);
                      return (
                        <button
                          key={property.id}
                          onClick={() => {
                            setSelectedProperties(prev =>
                              isSelected ? prev.filter(p => p.id !== property.id) : [...prev, property]
                            );
                          }}
                          className={`w-full p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${isSelected ? 'bg-purple-50' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Checkbox */}
                            <div className="flex-shrink-0">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-[#6C60FF] border-[#6C60FF]' : 'border-gray-300 bg-white'}`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                              {property.image ? (
                                <img
                                  src={property.image}
                                  alt={property.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 font-semibold text-lg">
                                  {property.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <div className="font-semibold text-gray-900 truncate">{property.name}</div>
                              {property.location && (
                                <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3.5 h-3.5" />
                                  {property.location}
                                </div>
                              )}
                              <div className="text-xs text-gray-400 mt-1">
                                @{property.username}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info Box */}
          {selectedMemories.length > 0 && selectedProperties.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 text-sm mb-1">Ready to Transfer</h4>
                  <p className="text-blue-700 text-sm">
                    {selectedMemories.length === 1 ? (
                      <>
                        <span className="font-medium">{selectedMemories[0].title}</span> will be moved to{' '}
                        <span className="font-medium">{selectedProperties.length === 1 ? selectedProperties[0].name : `${selectedProperties.length} properties`}</span>.
                      </>
                    ) : (
                      <>
                        <span className="font-medium">{selectedMemories.length} campaigns</span> will be moved to{' '}
                        <span className="font-medium">{selectedProperties.length === 1 ? selectedProperties[0].name : `${selectedProperties.length} properties`}</span>.
                      </>
                    )}
                    {' '}This action can be reversed later if needed.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isTransferring}
            className="px-5 py-2.5 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={selectedMemories.length === 0 || selectedProperties.length === 0 || isTransferring}
            className="px-6 py-2.5 bg-gradient-to-r from-[#6C60FF] to-[#8B7EFF] text-white font-semibold rounded-lg hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
          >
            {isTransferring ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                Transfer {selectedMemories.length > 0 ? `(${selectedMemories.length})` : 'Campaigns'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
