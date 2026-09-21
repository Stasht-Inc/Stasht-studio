import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Save, X, MapPin, FileImage, Tag, Plus, Upload, Camera, User, Calendar, ChevronDown, ImageIcon, Type } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Checkbox } from "./ui/checkbox";
import GooglePlacesInput from "./ui/google-places-input";
import ToneSelectionModal from "./ToneSelectionModal";
import { useAuth } from "../contexts/AuthContext";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface MediaItem {
  id: string;
  name: string;
  title?: string; // Post title from API
  originalName?: string; // Original name without parent prefix (for sub-images)
  thumbnail: string;
  image: string;
  type: 'image' | 'video' | 'text';
  size: string;
  date: string;
  location?: {
    displayName?: string;
    city?: string;
    country?: string;
    coordinates?: { lat: number; lng: number };
  };
  author: {
    name: string;
    avatar: string;
    id?: string; // User ID of the author
  };
  content?: string;
  description?: string;
  dimensions?: string;
  labels?: string[];
  parent_id?: string; // For sub-images
}

interface MemoryImage {
  id: string;
  src: string;
  title?: string;
  subImages?: MemoryImage[];
}

interface EditMediaItemPopoverProps {
  item: MediaItem;
  trigger: React.ReactNode;
  onSave: (itemId: string, updates: Partial<MediaItem>) => void;
  onPhotoChange?: (itemId: string, newPhotoFile: File) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  memoryOwnerId?: string; // ID of the memory owner to check if uploader is the owner
  memoryId?: string; // Memory ID for AI operations
  memoryTitle?: string;
  memoryThumbnail?: string;
  memoryCreatedDate?: string;
  memoryImages?: MemoryImage[];
  storyTags?: string[];
}

export function EditMediaItemPopover({
  item,
  trigger,
  onSave,
  onPhotoChange,
  open,
  onOpenChange,
  memoryOwnerId,
  memoryId,
  memoryTitle,
  memoryThumbnail,
  memoryCreatedDate,
  memoryImages = [],
  storyTags = []
}: EditMediaItemPopoverProps) {
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const profileColor = user?.profile_color
    ? (user.profile_color.startsWith('#') ? user.profile_color : `#${user.profile_color}`)
    : '#7B68EE';
  const userInitial = user?.name?.charAt(0) || user?.email?.charAt(0) || 'U';

  // Check if title is valid (exists, not empty, and different from name)
  const itemName = item.originalName || item.name;
  const hasValidTitle = item.title && item.title.trim() !== '' && item.title !== itemName && item.title !== item.name;

  const [formData, setFormData] = useState({
    name: itemName, // Use originalName for sub-images, otherwise use name
    title: hasValidTitle ? item.title : '',
    description: item.description || '',
    captureDate: item.date || '',
    location: item.location?.displayName || (item.location?.city && item.location?.country ? `${item.location.city}, ${item.location.country}` : ''),
    tags: item.labels || []
  });

  // State for title checkbox - checked only if title is valid (different from name)
  const [isTitleEnabled, setIsTitleEnabled] = useState(!!hasValidTitle);

  const [selectedPlaceData, setSelectedPlaceData] = useState<any>(null);
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<{
    file: File;
    url: string;
    name: string;
    size: string;
    dimensions: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Suggest states
  const [isToneModalOpen, setIsToneModalOpen] = useState(false);
  const [isAISuggesting, setIsAISuggesting] = useState(false);
  const aiSuggestButtonRef = useRef<HTMLButtonElement>(null);

  // Choose a Moment state
  const [isMemoryDropdownOpen, setIsMemoryDropdownOpen] = useState(false);
  const [selectedParentImageId, setSelectedParentImageId] = useState<string | undefined>(
    item.parent_id ? String(item.parent_id) : undefined
  );

  // Cleanup effect to revoke object URL when component unmounts
  useEffect(() => {
    return () => {
      if (selectedPhoto) {
        URL.revokeObjectURL(selectedPhoto.url);
      }
    };
  }, [selectedPhoto]);

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper function to get image dimensions
  const getImageDimensions = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve(`${img.width}×${img.height}`);
      };
      img.onerror = () => {
        resolve('Unknown dimensions');
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleToneSelect = async (selectedTone: string) => {
    if (!item.image) return;

    setIsAISuggesting(true);

    try {
      console.log('Getting AI suggestion for image:', item.image, 'with tone:', selectedTone, 'and memory_id:', memoryId);
      const { dashboardAPI } = await import('../utils/authUtils');
      const { toast } = await import('sonner');

      const response = await dashboardAPI.getSuggestedDescription(item.image, selectedTone, memoryId);

      if (response.success && response.data?.description) {
        setFormData(prev => ({
          ...prev,
          description: response.data.description
        }));
        toast.success("AI suggestion generated!");
      } else {
        toast.error(response.error || "Failed to get AI suggestion");
      }
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
      const { toast } = await import('sonner');
      toast.error("Failed to get AI suggestion");
    } finally {
      setIsAISuggesting(false);
    }
  };

  const handleSave = async () => {
    console.log('🟡 EditMediaItemPopover handleSave called');
    console.log('🟡 Item ID:', item.id);
    console.log('🟡 Form data:', formData);
    setIsLoading(true);

    try {
      // Prepare location data with Google Places information
      let locationData = {
        ...item.location,
        displayName: formData.location
      };

      // If user selected a place from Google Places, use that data
      if (selectedPlaceData) {
        locationData = {
          displayName: selectedPlaceData.formatted_address,
          city: selectedPlaceData.address_components?.find((comp: any) => comp.types.includes('locality'))?.long_name || '',
          country: selectedPlaceData.address_components?.find((comp: any) => comp.types.includes('country'))?.long_name || '',
          coordinates: selectedPlaceData.coordinates,
          place_id: selectedPlaceData.place_id,
          name: selectedPlaceData.name
        };
      } else if (formData.location !== (item.location?.displayName || '')) {
        // User manually typed location, keep existing coordinates if available
        locationData = {
          ...item.location,
          displayName: formData.location,
          coordinates: item.location?.coordinates || { lat: 0, lng: 0 }
        };
      }

      // Prepare all update data including photo if selected
      const updates: Partial<MediaItem> & { newPhoto?: File; parent_image_id?: string | null; title?: string } = {
        name: formData.name,
        title: isTitleEnabled ? formData.title : '', // Send empty string to clear title if checkbox is unchecked
        description: formData.description,
        capture_date: formData.captureDate,
        location: locationData,
        labels: formData.tags
      };

      // Always include parent_image_id in the payload
      // Send the selected parent ID, or null if no parent is selected
      updates.parent_image_id = selectedParentImageId ? selectedParentImageId : null;
      console.log('🔵 EditMediaItemPopover: Sending parent_image_id in payload:', {
        selectedParentImageId,
        sendingToAPI: updates.parent_image_id,
        originalParentId: item.parent_id
      });

      // Add photo if one was selected
      if (selectedPhoto) {
        console.log('Including new photo in update:', selectedPhoto.name);
        updates.newPhoto = selectedPhoto.file;
      }

      console.log('🟡 About to call onSave with:');
      console.log('🟡 Item ID:', item.id);
      console.log('🟡 Updates:', updates);
      console.log('🟡 onSave exists?', !!onSave);

      // Call the save function with all updates including photo
      await onSave(item.id, updates);

      console.log('🟡 onSave completed successfully');
      
      // Close the popup after successful save
      onOpenChange?.(false);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original values
    setFormData({
      name: itemName, // Use originalName for sub-images
      title: hasValidTitle ? item.title : '',
      description: item.description || '',
      captureDate: item.date || '',
      location: item.location?.displayName || (item.location?.city && item.location?.country ? `${item.location.city}, ${item.location.country}` : ''),
      tags: item.labels || []
    });
    setNewTag('');
    setSelectedPlaceData(null);
    setIsTitleEnabled(!!hasValidTitle); // Reset title checkbox state

    // Clear selected photo and its URL
    if (selectedPhoto) {
      URL.revokeObjectURL(selectedPhoto.url);
      setSelectedPhoto(null);
    }

    // Reset selected parent image to original
    setSelectedParentImageId(item.parent_id ? String(item.parent_id) : undefined);

    onOpenChange?.(false);
  };

  const hasChanges = () => {
    const originalLocation = item.location?.displayName || (item.location?.city && item.location?.country ? `${item.location.city}, ${item.location.country}` : '');
    const originalTags = item.labels || [];
    const originalParentId = item.parent_id ? String(item.parent_id) : undefined;
    const originalTitle = hasValidTitle ? item.title : '';
    const currentTitle = isTitleEnabled ? formData.title : '';

    return (
      formData.name !== itemName ||
      currentTitle !== originalTitle || // Title has changed
      formData.description !== (item.description || '') ||
      formData.captureDate !== (item.date || '') ||
      formData.location !== originalLocation ||
      JSON.stringify(formData.tags.sort()) !== JSON.stringify(originalTags.sort()) ||
      selectedPhoto !== null || // Photo has been changed
      String(selectedParentImageId || '') !== String(originalParentId || '') // Parent image has changed
    );
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      const newTags = newTag.split(',').map(t => t.trim()).filter(t => t && !formData.tags.includes(t));
      if (newTags.length > 0) {
        setFormData(prev => ({ ...prev, tags: [...prev.tags, ...newTags] }));
      }
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleChangePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB.');
      return;
    }

    setIsUploadingPhoto(true);
    
    try {
      // Create preview URL and get dimensions
      const url = URL.createObjectURL(file);
      const dimensions = await getImageDimensions(file);
      
      // Clear previous selected photo URL if it exists
      if (selectedPhoto) {
        URL.revokeObjectURL(selectedPhoto.url);
      }
      
      // Set the selected photo preview data
      setSelectedPhoto({
        file,
        url,
        name: file.name,
        size: formatFileSize(file.size),
        dimensions
      });
      
      // Don't upload immediately - wait for user to click Save
      // This just shows the preview for now
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Shared content renderer for both mobile and desktop
  const renderContent = (isMobileView: boolean) => (
        <div className={isMobileView ? "flex flex-col h-full bg-white overflow-hidden" : "flex flex-col max-h-[80vh] bg-white rounded-xl overflow-hidden"}>
          {/* Mobile Header */}
          {isMobileView && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <h4 className="font-semibold text-[18px] text-gray-900">Edit Moments</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-10 w-10 p-0 hover:bg-gray-100 rounded-full"
            >
              <X className="!w-[28px] !h-[28px] text-black" />
            </Button>
          </div>
          )}
          {/* Desktop Header */}
          {!isMobileView && (
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <FileImage className="w-4 h-4 text-[#6C60FF]" />
              <h3 className="text-sm sm:text-base font-medium text-gray-900">Edit Moments</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          )}

          {/* Author Info - Top Section */}
          {item.author && (
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={item.author.avatar} alt={item.author.name} />
                  <AvatarFallback className="text-xs bg-[#6C60FF] text-white">
                    {item.author.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{item.author.name}</p>
                    {/* Show Admin badge if author is the memory owner, otherwise show Collaborator */}
                    {memoryOwnerId && item.author.id && item.author.id === memoryOwnerId ? (
                      <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-red-100 text-red-700 border-red-200">
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 border-blue-200">
                        Collaborator
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Owner Badge for Personal Photos */}
          {!item.author && (
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-[#6C60FF] text-white">
                    Y
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">You</p>
                    <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-green-100 text-green-700 border-green-200">
                      Owner
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-[30px] md:pb-3 space-y-4 sm:space-y-6">
            {/* Change Photo */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 md:w-4 md:h-4 text-gray-500" />
                <h4 className="text-[14px] md:text-sm font-medium text-gray-700">Photo</h4>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                    <ImageWithFallback
                      src={selectedPhoto ? selectedPhoto.url : item.thumbnail}
                      alt={selectedPhoto ? selectedPhoto.name : item.name}
                      className="w-full h-full object-cover"
                      fallback={
                        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: profileColor }}>
                          <span className="text-white font-bold text-lg uppercase">{userInitial}</span>
                        </div>
                      }
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {selectedPhoto ? selectedPhoto.name : (item.originalName || item.name)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedPhoto ? `${selectedPhoto.size} • ${selectedPhoto.dimensions}` : `${item.size} • ${item.dimensions}`}
                    </p>
                  </div>
                  {selectedPhoto && (
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-green-500 rounded-full" title="New photo selected" />
                    </div>
                  )}
                </div>
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleChangePhoto}
                  disabled={isUploadingPhoto}
                  className="w-full justify-center text-[14px] md:text-sm min-h-[38px]"
                >
                  {isUploadingPhoto ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Change Photo
                    </>
                  )}
                </Button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Choose a Moment */}
            {memoryImages && memoryImages.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileImage className="w-5 h-5 md:w-4 md:h-4 text-gray-500" />
                  <h4 className="text-[14px] md:text-sm font-medium text-gray-700">Choose a Moment</h4>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setIsMemoryDropdownOpen(!isMemoryDropdownOpen)}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    {(() => {
                      // Find the selected parent image if one is selected
                      const selectedImage = selectedParentImageId
                        ? memoryImages.find(img => String(img.id) === String(selectedParentImageId))
                        : null;

                      return (
                        <>
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                            {selectedImage ? (
                              <ImageWithFallback
                                src={selectedImage.src}
                                alt={selectedImage.title || 'Selected image'}
                                className="w-full h-full object-cover"
                                fallback={
                                  <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: profileColor }}>
                                    <span className="text-white font-bold text-lg uppercase">{userInitial}</span>
                                  </div>
                                }
                              />
                            ) : memoryThumbnail ? (
                              <ImageWithFallback
                                src={memoryThumbnail}
                                alt={memoryTitle}
                                className="w-full h-full object-cover"
                                fallback={
                                  <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: profileColor }}>
                                    <span className="text-white font-bold text-lg uppercase">{userInitial}</span>
                                  </div>
                                }
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: profileColor }}>
                                <span className="text-white font-bold text-lg uppercase">{userInitial}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            {selectedImage ? (
                              <>
                                <h3 className="text-sm font-medium text-gray-900 truncate">
                                  {selectedImage.title || 'Untitled'}
                                </h3>
                                <p className="text-xs text-purple-600">
                                  Selected parent image
                                </p>
                              </>
                            ) : (
                              <>
                                <h3 className="text-sm font-medium text-gray-900 truncate">
                                  {memoryTitle || 'Campaign'}
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-xs text-gray-500">
                                    {memoryCreatedDate ? new Date(memoryCreatedDate).toLocaleDateString('en-US', {
                                      month: 'short',
                                      year: 'numeric'
                                    }) : 'No date'}
                                  </p>
                                  <span className="text-xs text-gray-400">•</span>
                                  <span className="text-xs text-gray-500">
                                    {memoryImages.reduce((total, img) => total + 1 + (img.subImages?.length || 0), 0)} images
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                          <ChevronDown
                            className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                              isMemoryDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </>
                      );
                    })()}
                  </button>

                  {isMemoryDropdownOpen && (
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                      {memoryImages.map((image) => (
                        <div key={image.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedParentImageId(String(image.id));
                              setIsMemoryDropdownOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                              String(selectedParentImageId) === String(image.id) ? 'bg-purple-50' : ''
                            }`}
                          >
                            <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                              <ImageWithFallback
                                src={image.src}
                                alt={image.title || 'Image'}
                                className="w-full h-full object-cover"
                                fallback={
                                  <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: profileColor }}>
                                    <span className="text-white font-bold text-sm uppercase">{userInitial}</span>
                                  </div>
                                }
                              />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {image.title || 'Untitled'}
                              </p>
                              {image.subImages && image.subImages.length > 0 && (
                                <p className="text-xs text-gray-500">
                                  {image.subImages.length} sub-image{image.subImages.length > 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                            {String(selectedParentImageId) === String(image.id) && (
                              <div className="w-2 h-2 bg-purple-600 rounded-full flex-shrink-0" />
                            )}
                          </button>

                          {image.subImages && image.subImages.length > 0 && (
                            <div className="bg-gray-50">
                              {image.subImages.map((subImage) => (
                                <div
                                  key={subImage.id}
                                  className="flex items-center gap-3 p-3 pl-10 border-b border-gray-100 opacity-60 cursor-not-allowed"
                                >
                                  <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                                    <ImageWithFallback
                                      src={subImage.src}
                                      alt={subImage.title || 'Sub-image'}
                                      className="w-full h-full object-cover"
                                      fallback={
                                        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: profileColor }}>
                                          <span className="text-white font-bold text-xs uppercase">{userInitial}</span>
                                        </div>
                                      }
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-600 truncate">
                                      {subImage.title || 'Untitled'}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-[16px] md:text-sm font-medium text-gray-700">Basic Information</h4>
              
              <div className="space-y-2">
                <Label htmlFor="photo-name" className="text-[14px]">Photo Name</Label>
                <Input
                  id="photo-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    name: e.target.value
                  }))}
                  placeholder="Enter photo name..."
                  className="bg-gray-100 border-gray-300 focus:bg-gray-100 focus:border-gray-400 min-h-[38px]"
                  style={{
                    outline: 'none',
                    boxShadow: 'none',
                    border: '1px solid #d1d5db'
                  }}
                  onFocus={(e) => {
                    e.target.style.outline = 'none';
                    e.target.style.boxShadow = 'none';
                    e.target.style.border = '1px solid #9ca3af';
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '1px solid #d1d5db';
                  }}
                />
              </div>

              {/* Add a Title - with checkbox */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="add-title"
                    checked={isTitleEnabled}
                    onCheckedChange={(checked) => {
                      setIsTitleEnabled(!!checked);
                      if (!checked) {
                        setFormData(prev => ({ ...prev, title: '' }));
                      }
                    }}
                    className="data-[state=checked]:bg-[#6C60FF] data-[state=checked]:border-[#6C60FF]"
                  />
                  <label
                    htmlFor="add-title"
                    className="flex items-center gap-1.5 text-[14px] md:text-sm font-medium text-gray-700 cursor-pointer"
                  >
                    <Type className="w-4 h-4" />
                    Add a title
                    <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                </div>

                {isTitleEnabled && (
                  <Input
                    id="photo-title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Add a short title"
                    className="bg-gray-100 border-gray-300 focus:bg-gray-100 focus:border-gray-400 min-h-[38px]"
                    style={{
                      outline: 'none',
                      boxShadow: 'none',
                      border: '1px solid #d1d5db'
                    }}
                    onFocus={(e) => {
                      e.target.style.outline = 'none';
                      e.target.style.boxShadow = 'none';
                      e.target.style.border = '1px solid #9ca3af';
                    }}
                    onBlur={(e) => {
                      e.target.style.border = '1px solid #d1d5db';
                    }}
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="photo-description" className="text-[14px]">Description</Label>
                  <Button
                    ref={aiSuggestButtonRef}
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsToneModalOpen(true)}
                    disabled={isAISuggesting}
                    className="text-[14px] md:text-sm h-auto p-0 font-normal flex items-center gap-1.5 hover:bg-transparent"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles w-4 h-4 flex-shrink-0"
                      style={{ color: 'rgb(108, 96, 255)' }}>
                      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
                      <path d="M20 3v4"></path>
                      <path d="M22 5h-4"></path>
                      <path d="M4 17v2"></path>
                      <path d="M5 18H3"></path>
                    </svg>
                    <span
                      className="text-[14px] md:text-sm font-normal"
                      style={{
                        background: 'linear-gradient(136deg, #FF60E0 9.11%, #6C60FF 58.79%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}
                    >
                      {isAISuggesting ? 'Suggesting...' : 'AI suggest'}
                    </span>
                  </Button>
                </div>
                <Textarea
                  id="photo-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  placeholder="Add a description..."
                  className="resize-none h-20 bg-gray-100 border-gray-300 focus:bg-gray-100 focus:border-gray-400"
                  style={{
                    outline: 'none',
                    boxShadow: 'none',
                    border: '1px solid #d1d5db'
                  }}
                  onFocus={(e) => {
                    e.target.style.outline = 'none';
                    e.target.style.boxShadow = 'none';
                    e.target.style.border = '1px solid #9ca3af';
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '1px solid #d1d5db';
                  }}
                />
              </div>
            </div>

            {/* Capture Date */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 md:w-4 md:h-4 text-gray-500" />
                <h4 className="text-[14px] md:text-sm font-medium text-gray-700">Capture Date</h4>
              </div>

              <Input
                id="capture-date"
                type="date"
                value={formData.captureDate}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  captureDate: e.target.value
                }))}
                className="bg-gray-100 border-gray-300 focus:bg-gray-100 focus:border-gray-400 min-h-[38px]"
                style={{
                  outline: 'none',
                  boxShadow: 'none',
                  border: '1px solid #d1d5db'
                }}
                onFocus={(e) => {
                  e.target.style.outline = 'none';
                  e.target.style.boxShadow = 'none';
                  e.target.style.border = '1px solid #9ca3af';
                }}
                onBlur={(e) => {
                  e.target.style.border = '1px solid #d1d5db';
                }}
              />
            </div>

            {/* Location */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 md:w-4 md:h-4 text-gray-500" />
                <h4 className="text-[14px] md:text-sm font-medium text-gray-700">Location</h4>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location" className="text-[14px]">Location</Label>
                <GooglePlacesInput
                  value={formData.location}
                  onChange={(value) => {
                    setFormData(prev => ({ 
                      ...prev, 
                      location: value 
                    }));
                  }}
                  onPlaceSelect={(place) => {
                    console.log('Place selected in EditMediaItemPopover:', place);
                    // Create placeData compatible with existing code
                    const placeData = {
                      place_id: place.place_id,
                      formatted_address: place.description,
                      name: place.structured_formatting.main_text,
                      // Add coordinates if available (would need additional API call)
                      coordinates: { lat: 0, lng: 0 }
                    };
                    setSelectedPlaceData(placeData);
                  }}
                  placeholder="Enter location..."
                  className="bg-gray-100 border-gray-300 focus:bg-gray-100 focus:border-gray-400 min-h-[38px]"
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 md:w-4 md:h-4 text-gray-500" />
                <h4 className="text-[14px] md:text-sm font-medium text-gray-700">Tags</h4>
              </div>

              <div className="space-y-3">
                {/* Add new tag */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={handleTagKeyPress}
                      placeholder="Add tags separated by commas (e.g. beach, summer, 2024)"
                      className="w-full bg-gray-100 border-gray-300 focus:bg-gray-100 focus:border-gray-400 min-h-[38px]"
                      style={{ outline: 'none', boxShadow: 'none', border: '1px solid #d1d5db' }}
                      onFocus={(e) => { e.target.style.outline = 'none'; e.target.style.boxShadow = 'none'; e.target.style.border = '1px solid #9ca3af'; }}
                      onBlur={(e) => { e.target.style.border = '1px solid #d1d5db'; }}
                    />
                    {newTag.trim() && (() => {
                      const matches = storyTags.filter(t => t.toLowerCase().includes(newTag.trim().toLowerCase()) && !formData.tags.includes(t));
                      return matches.length > 0 ? (
                        <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-md mt-1 overflow-hidden">
                          {matches.slice(0, 5).map(tag => (
                            <button key={tag} type="button" onMouseDown={(e) => { e.preventDefault(); const newTags = tag.split(',').map(t => t.trim()).filter(t => t && !formData.tags.includes(t)); if (newTags.length > 0) setFormData(prev => ({ ...prev, tags: [...prev.tags, ...newTags] })); setNewTag(''); }} className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 flex items-center gap-2">
                              <Tag className="w-3 h-3 text-gray-400 flex-shrink-0" />{tag}
                            </button>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddTag}
                    disabled={!newTag.trim()}
                    className={`border-0 shadow-none h-9 min-h-[38px] text-sm font-medium px-3 disabled:opacity-40 disabled:cursor-not-allowed ${newTag.trim() ? 'bg-[#6C60FF] hover:bg-[#5A52E6] text-white hover:text-white' : 'bg-gray-200 hover:bg-gray-300 text-black'}`}
                  >
                    Add
                  </Button>
                </div>

                {/* Existing tags */}
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-gray-200 text-gray-900 text-[14px] font-normal rounded-full border border-gray-300"
                      >
                        <span className="leading-none">{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-red-500 flex-shrink-0 inline-flex items-center justify-center rounded-full w-4 h-4 leading-none"
                        >
                          <X className="w-3 h-3" strokeWidth={2.5} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Suggested tags */}
                {(() => {
                  const suggestions = storyTags.filter(t => !formData.tags.includes(t)).slice(0, 4);
                  return suggestions.length > 0 ? (
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5">Suggested</p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map(tag => (
                          <button key={tag} type="button" onClick={() => { if (!formData.tags.includes(tag)) setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] })); }} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[14px] bg-gray-100 text-gray-700 rounded-full border border-gray-200 hover:bg-gray-200 transition-colors">
                            {tag}<span className="text-gray-400 font-medium">+</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 flex items-center justify-start md:justify-between px-5 md:px-3 py-3 pb-[50px] md:pb-3 sm:p-4 sm:pb-4 border-t border-gray-200 bg-gray-50">
            <div className="text-[12px] sm:text-xs text-gray-500 hidden md:block">
              <span className="hidden sm:inline">{hasChanges() ? 'You have unsaved changes' : 'No changes made'}</span>
              <span className="sm:hidden">{hasChanges() ? 'Unsaved' : 'No changes'}</span>
            </div>
            <div className="flex items-center gap-3 md:gap-1.5 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isLoading}
                className="h-12 md:h-8 px-6 md:px-2.5 text-[14px] md:text-xs sm:text-sm sm:h-9 sm:px-3"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges() || isLoading}
                className="bg-[#6C60FF] hover:bg-[#5A52E6] text-white h-12 md:h-8 px-6 md:px-2.5 text-[14px] md:text-xs sm:text-sm sm:h-9 sm:px-3"
              >
                {isLoading ? (
                  <>
                    <div className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="hidden sm:inline">Saving...</span>
                    <span className="sm:hidden">Save</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-white" />
                    <span className="hidden sm:inline">Save Changes</span>
                    <span className="sm:hidden">Save</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
  );

  return (
    <>
    {/* Mobile: Full-screen overlay via portal to bypass parent transforms */}
    {isMobile && open && createPortal(
      <div className="fixed inset-0 z-[200] bg-white flex flex-col">
        {renderContent(true)}
      </div>,
      document.body
    )}

    {/* Desktop: Popover */}
    {!isMobile && (
    <Popover
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && isToneModalOpen) {
          console.log('Preventing popover close because tone modal is open');
          return;
        }
        onOpenChange(isOpen);
      }}
    >
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        className="w-96 max-w-md p-0 border-0 shadow-lg rounded-xl z-[100]"
        side="right"
        align="start"
      >
        {renderContent(false)}
      </PopoverContent>
    </Popover>
    )}

    {/* Tone Selection Modal - Render outside Popover to avoid z-index issues */}
    {isToneModalOpen && (
      <ToneSelectionModal
        isOpen={isToneModalOpen}
        onClose={() => {
          setIsToneModalOpen(false);
        }}
        onToneSelect={handleToneSelect}
        buttonRef={aiSuggestButtonRef}
      />
    )}
  </>
  );
}