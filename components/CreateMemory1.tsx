"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Calendar as CalendarIcon, Upload, MapPin, Tag, X, Plus, Bookmark, Users, AlertTriangle } from "lucide-react";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "./ui/utils";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { labelsData, existingCollaboratorsData } from "../constants/appData";
import { dashboardAPI } from '../utils/authUtils';
import { useAuth } from '../contexts/AuthContext';
import { useMemoryLimit } from '../hooks/useMemoryLimit';
import { triggerMemoryCountsRefresh } from '../hooks/useMemoryCounts';
import { Alert, AlertDescription } from "./ui/alert";
import { MemoryCreatedDialog } from "./MemoryCreatedDialog";
import { MemoryLimitDialog } from "./MemoryLimitDialog";

interface CreateMemoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemoryCreated?: () => void;
}

interface MemoryFormData {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  isOngoing: boolean;
  hasEndDate: boolean;
  location: string;
  category: string;
  categoryId: number | null;
  subCategoryId: number | null;
  labels: string[];
  tags: string[];
  collaborators: string[]; // All collaborator emails (both existing and new)
  collaboratorIds: number[]; // Keep for backwards compatibility
  images: File[];
  imageLinks: string[];
}

const CATEGORIES = [
  'Personal',
  'Golf Trips', 
  'Travel',
  'Family',
  'Work',
  'Hobbies',
  'Special Events'
];

const SUGGESTED_TAGS = [
  'vacation', 'friends', 'family', 'adventure', 'milestone', 'celebration', 
  'travel', 'nature', 'sports', 'learning', 'achievement', 'memories'
];

export default function CreateMemory({ open, onOpenChange, onMemoryCreated }: CreateMemoryProps) {
  const { isAuthenticated } = useAuth();
  const { isLimitExceeded, limitData, checkLimit } = useMemoryLimit();
  const [apiCategories, setApiCategories] = useState<any[]>([]);
  const [apiLabels, setApiLabels] = useState<any[]>([]);
  const [apiFrequentCollaborators, setApiFrequentCollaborators] = useState<any[]>([]);
  const [apiRecentCollaborators, setApiRecentCollaborators] = useState<any[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  
  // Success dialog state
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdMemoryDetails, setCreatedMemoryDetails] = useState<{
    title: string;
    category: string;
    location?: string;
  } | null>(null);
  
  // Limit exceeded dialog state
  const [showLimitDialog, setShowLimitDialog] = useState(false);

  const [formData, setFormData] = useState<MemoryFormData>({
    title: '',
    description: '',
    startDate: new Date(),
    endDate: new Date(),
    isOngoing: false,
    hasEndDate: false,
    location: '',
    category: 'Personal',
    categoryId: null,
    subCategoryId: null,
    labels: [],
    tags: [],
    collaborators: [],
    collaboratorIds: [],
    images: [],
    imageLinks: []
  });

  const [currentLabel, setCurrentLabel] = useState('');
  const [currentTag, setCurrentTag] = useState('');
  const [currentCollaborator, setCurrentCollaborator] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch categories and labels from API
  const fetchCategoriesLabels = async () => {
    try {
      setIsLoadingCategories(true);
      console.log('=== CATEGORIES LABELS API CALL ===');
      console.log('API URL: /memories/categories-labels');
      
      const response = await dashboardAPI.getCategoriesLabels();
      console.log('Raw API Response:', response);
      
      if (response.success && response.data) {
        const actualData = response.data;
        console.log('Processed API Data:', actualData);
        
        // Extract categories from nested structure: response.data.data.categories.items
        if (actualData.data?.categories?.items && Array.isArray(actualData.data.categories.items)) {
          console.log('=== CATEGORY FILTERING DEBUG ===');
          console.log('Raw Categories from API:', actualData.data.categories.items);
          console.log('Category names:', actualData.data.categories.items.map(c => `"${c.name}"`).join(', '));
          
          // Filter out "Shared with" and "Published" categories at the source
          // Using more robust filtering with toLowerCase and trim
          const filteredCategories = actualData.data.categories.items.filter(cat => {
            const categoryName = (cat.name || '').toLowerCase().trim();
            const shouldExclude = 
              categoryName === 'shared with' || 
              categoryName === 'published' ||
              categoryName.includes('shared') ||
              categoryName === 'shared';
            
            if (shouldExclude) {
              console.log(`Excluding category: "${cat.name}" (normalized: "${categoryName}")`);
            }
            
            return !shouldExclude;
          });
          
          setApiCategories(filteredCategories);
          console.log('Filtered Categories:', filteredCategories);
          console.log('Filtered category names:', filteredCategories.map(c => `"${c.name}"`).join(', '));
          
          // Set correct Personal category ID if found
          const personalCategory = filteredCategories.find(cat => 
            cat.name.toLowerCase().trim() === 'personal'
          );
          if (personalCategory && personalCategory.id) {
            console.log('Setting Personal category ID:', personalCategory.id);
            setFormData(prev => ({
              ...prev,
              categoryId: personalCategory.id
            }));
          }
          
          console.log('=== END CATEGORY FILTERING DEBUG ===');
        }
        
        // Extract labels/tags from nested structure: response.data.data.labels.items
        if (actualData.data?.labels?.items && Array.isArray(actualData.data.labels.items)) {
          setApiLabels(actualData.data.labels.items);
          console.log('Labels/Tags from API:', actualData.data.labels.items);
        }
        
        // Extract collaborators from nested structure
        if (actualData.data?.collaborators) {
          // Frequent collaborators: response.data.data.collaborators.frequent.items
          if (actualData.data.collaborators.frequent?.items && Array.isArray(actualData.data.collaborators.frequent.items)) {
            setApiFrequentCollaborators(actualData.data.collaborators.frequent.items);
            console.log('Frequent Collaborators from API:', actualData.data.collaborators.frequent.items);
          }
          
          // Recent collaborators: response.data.data.collaborators.recent.items
          if (actualData.data.collaborators.recent?.items && Array.isArray(actualData.data.collaborators.recent.items)) {
            setApiRecentCollaborators(actualData.data.collaborators.recent.items);
            console.log('Recent Collaborators from API:', actualData.data.collaborators.recent.items);
          }
        }
      } else {
        console.log('API call failed - Response:', response);
        // Keep using fallback static data
        // Set fallback category ID for Personal (assuming it's the first in static list)
        if (formData.category === 'Personal' && !formData.categoryId) {
          setFormData(prev => ({
            ...prev,
            categoryId: 1 // Fallback ID for Personal
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching categories and labels:', error);
      // Keep using fallback static data
      // Set fallback category ID for Personal
      if (formData.category === 'Personal' && !formData.categoryId) {
        setFormData(prev => ({
          ...prev,
          categoryId: 1 // Fallback ID for Personal
        }));
      }
    } finally {
      setIsLoadingCategories(false);
      console.log('=== END CATEGORIES LABELS API CALL ===');
    }
  };

  // Fetch data when dialog opens and user is authenticated
  useEffect(() => {
    if (open && isAuthenticated) {
      fetchCategoriesLabels();
    }
  }, [open, isAuthenticated]);

  const calculateDuration = (startDate: Date, endDate: Date | string, isOngoing: boolean) => {
    if (isOngoing) {
      const start = startDate;
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 1) return "Started today";
      if (diffDays < 7) return `${diffDays} days so far`;
      if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} so far`;
      }
      if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? 's' : ''} so far`;
      }
      const years = Math.floor(diffDays / 365);
      return `${years} year${years > 1 ? 's' : ''} so far`;
    }
    
    if (startDate.toDateString() === end.toDateString()) return "Single day";
    
    const start = startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    if (diffDays === 1) return "1 day";
    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''}`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years} year${years > 1 ? 's' : ''}`;
  };

  const handleInputChange = (field: keyof MemoryFormData, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Handle hasEndDate toggle
      if (field === 'hasEndDate') {
        if (!value) {
          // If disabling end date, also disable ongoing
          newData.isOngoing = false;
        } else {
          // If enabling end date, set it to start date if empty
          if (!newData.endDate) {
            newData.endDate = newData.startDate;
          }
        }
      }
      
      // Handle ongoing toggle
      if (field === 'isOngoing') {
        if (value) {
          // If setting to ongoing, ensure hasEndDate is true
          newData.hasEndDate = true;
        }
      }
      
      // Validate date range when start or end date changes
      if (field === 'startDate' && newData.hasEndDate && newData.endDate && !newData.isOngoing) {
        // If start date is after end date, adjust end date
        if (value > newData.endDate) {
          newData.endDate = value;
        }
      }
      
      return newData;
    });
  };

  const addLabel = (label: string, isExisting = false, labelId?: number) => {
    if (label.trim()) {
      // Only allow 1 label maximum
      if (formData.labels.length >= 1) {
        return;
      }
      
      if (isExisting && labelId) {
        // If choosing from existing labels, store the ID in subCategoryId
        handleInputChange('labels', [label.trim()]);
        handleInputChange('subCategoryId', labelId);
      } else {
        // If not choosing existing, send to sub_category params (custom label)
        handleInputChange('labels', [label.trim()]);
        handleInputChange('subCategoryId', null); // Will be handled as custom in API
      }
      setCurrentLabel('');
    }
  };

  const removeLabel = (labelToRemove: string) => {
    handleInputChange('labels', formData.labels.filter(label => label !== labelToRemove));
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !formData.tags.includes(tag.trim())) {
      handleInputChange('tags', [...formData.tags, tag.trim()]);
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  const addCollaborator = (collaborator: string) => {
    const trimmedEmail = collaborator.trim();
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (trimmedEmail && !formData.collaborators.includes(trimmedEmail)) {
      // Check if it looks like an email
      if (!emailRegex.test(trimmedEmail)) {
        alert('Please enter a valid email address');
        return;
      }
      handleInputChange('collaborators', [...formData.collaborators, trimmedEmail]);
      setCurrentCollaborator('');
    }
  };

  const addExistingCollaborator = (collaborator: any) => {
    if (!formData.collaborators.includes(collaborator.email)) {
      // Add email to collaborators list
      handleInputChange('collaborators', [...formData.collaborators, collaborator.email]);
      
      // Also track collaborator IDs for backwards compatibility
      if (collaborator.id || collaborator.user_id) {
        const id = collaborator.id || collaborator.user_id;
        if (!formData.collaboratorIds.includes(id)) {
          handleInputChange('collaboratorIds', [...formData.collaboratorIds, id]);
        }
      }
    }
  };

  const removeCollaborator = (collaboratorToRemove: string) => {
    handleInputChange('collaborators', formData.collaborators.filter(c => c !== collaboratorToRemove));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    handleInputChange('images', [...formData.images, ...files]);
  };

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    handleInputChange('images', newImages);
  };

  const formatDateForAPI = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formatDateForDisplay = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Function to upload files to your storage service (placeholder)
  const uploadFilesToStorage = async (files: File[]): Promise<string[]> => {
    // TODO: Replace with your actual file upload implementation
    // This could upload to AWS S3, Cloudinary, or your own server
    
    const uploadPromises = files.map(async (file) => {
      // For demonstration, using a placeholder URL
      // In production, you would upload the file and return the actual URL
      console.log(`Uploading file: ${file.name}, Size: ${file.size} bytes`);
      
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return a placeholder URL - replace with actual upload logic
      return `https://your-storage-service.com/uploads/${Date.now()}-${file.name}`;
    });
    
    return await Promise.all(uploadPromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔴 MEMORY CREATION ATTEMPT');
    console.log('🔴 isLimitExceeded:', isLimitExceeded);
    console.log('🔴 limitData:', limitData);
    
    // Check memory limit before proceeding
    if (isLimitExceeded) {
      console.log('🔴 MEMORY CREATION BLOCKED - LIMIT EXCEEDED');
      setShowLimitDialog(true);
      return;
    }
    
    console.log('🔴 MEMORY CREATION PROCEEDING - LIMIT OK');

    setIsSubmitting(true);

    try {
      // Double-check memory limit right before API call
      console.log('🔴 DOUBLE-CHECKING MEMORY LIMIT BEFORE API CALL');
      const limitResponse = await dashboardAPI.checkMemoryLimit();
      console.log('🔴 FRESH LIMIT CHECK RESPONSE:', limitResponse);
      
      if (limitResponse.success && limitResponse.data) {
        const data = limitResponse.data.data || limitResponse.data;
        const limitStatus = data.limit_status || data;
        
        if (limitStatus.status === 'limit_exceeded') {
          console.log('🔴 MEMORY CREATION BLOCKED - FRESH LIMIT CHECK SHOWS EXCEEDED');
          setIsSubmitting(false);
          setShowLimitDialog(true);
          return;
        }
      }
      // Create FormData for multipart upload
      const multipartFormData = new FormData();
      
      // Add text fields to FormData
      multipartFormData.append('title', formData.title);
      multipartFormData.append('category_id', (formData.categoryId || 1).toString());
      multipartFormData.append('min_uploaded_img_date', formatDateForAPI(formData.startDate));
      
      // Add optional fields
      if (formData.subCategoryId) {
        multipartFormData.append('sub_category_id', formData.subCategoryId.toString());
      } else if (formData.labels.length > 0) {
        // If no existing label ID but has labels, send as custom sub_category
        multipartFormData.append('sub_category', formData.labels[0]);
      }
      if (formData.hasEndDate && !formData.isOngoing) {
        multipartFormData.append('max_uploaded_img_date', formatDateForAPI(formData.endDate));
      }
      if (formData.location) {
        multipartFormData.append('location', formData.location);
      }
      if (formData.description) {
        multipartFormData.append('description', formData.description);
      }
      if (formData.tags.length > 0) {
        multipartFormData.append('feature_tag_id', formData.tags[0]);
      }
      if (formData.collaborators.length > 0) {
        // Send all collaborator emails (both existing and manually added)
        multipartFormData.append('collaborators', JSON.stringify(formData.collaborators));
      }
      
      // Add photos count
      const totalPhotos = formData.images.length + formData.imageLinks.length;
      if (totalPhotos > 0) {
        multipartFormData.append('photos_count', totalPhotos.toString());
        
        // Add image files
        formData.images.forEach((file, index) => {
          multipartFormData.append(`photos[${index}]`, file);
        });
        
        // Add existing image links as JSON if any
        if (formData.imageLinks.length > 0) {
          const imageLinksData = formData.imageLinks.map(link => ({
            image_link: link,
            capture_date: null,
            location: null
          }));
          multipartFormData.append('existing_photos', JSON.stringify(imageLinksData));
        }
      }

      console.log('=== CREATE MEMORY API CALL ===');
      console.log('Form Data (Frontend):', formData);
      console.log('Multipart FormData fields:');
      for (let pair of multipartFormData.entries()) {
        if (pair[1] instanceof File) {
          console.log(`${pair[0]}:`, `[File] ${pair[1].name} (${pair[1].size} bytes)`);
        } else {
          console.log(`${pair[0]}:`, pair[1]);
        }
      }
      console.log('API Endpoint: POST /memories');
      
      // Call the API to create memory with multipart data
      const response = await dashboardAPI.createMemoryMultipart(multipartFormData);
      debugger
      
      console.log('API Response:', response);
      console.log('=== END CREATE MEMORY API CALL ===');
      
      if (response.success) {
        // Reset form
        setFormData({
          title: '',
          description: '',
          startDate: new Date(),
          endDate: new Date(),
          isOngoing: false,
          hasEndDate: false,
          location: '',
          category: '',
          categoryId: null,
          subCategoryId: null,
          labels: [],
          tags: [],
          collaborators: [],
          collaboratorIds: [],
          images: [],
          imageLinks: []
        });

        // Refresh memory limit after successful creation
        await checkLimit();
        
        // Trigger memory counts refresh
        await triggerMemoryCountsRefresh();
        
        onMemoryCreated?.();
        onOpenChange(false);
        
        // Show success dialog
        setCreatedMemoryDetails({
          title: formData.title,
          category: formData.category,
          location: formData.location || undefined
        });
        setShowSuccessDialog(true);
      } else {
        // Check if it's a memory limit error
        const errorMessage = response.error || response.message || 'Failed to create memory';
        
        // Check for limit-related keywords in the error message
        if (errorMessage.toLowerCase().includes('limit') || 
            errorMessage.toLowerCase().includes('maximum') || 
            errorMessage.toLowerCase().includes('exceeded')) {
          // Show the memory limit dialog
          setShowLimitDialog(true);
        } else {
          // For other errors, throw to be caught by the try-catch
          throw new Error(errorMessage);
        }
      }
    } catch (error) {
      console.error('Error creating memory:', error);
      // Only show alert for unexpected errors (not limit errors which are handled above)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create memory. Please try again.';
      if (!errorMessage.toLowerCase().includes('limit') && 
          !errorMessage.toLowerCase().includes('maximum') && 
          !errorMessage.toLowerCase().includes('exceeded')) {
        alert(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.title.trim() && formData.description.trim() && formData.category;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl font-medium">
            <div className="w-8 h-8 rounded-full bg-[#6C60FF] flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </div>
            Create New Campaign
          </DialogTitle>
          <DialogDescription className="text-gray-600 mt-2">
            Create and share your special moments with people you care about.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Campaign Info */}
          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium text-gray-700">Campaign Title *</Label>
              <Input
                id="title"
                placeholder="Enter your campaign title..."
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="h-11 rounded-lg border-gray-300 bg-white placeholder:text-gray-400 focus-visible:border-[#6C60FF] focus-visible:ring-[#6C60FF] focus-visible:ring-2 focus-visible:outline-none focus:outline-none"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-gray-700">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe what happened, how you felt, or why this moment was special..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="min-h-[80px] resize-none rounded-lg border-gray-300 bg-white placeholder:text-gray-400 focus-visible:border-[#6C60FF] focus-visible:ring-[#6C60FF] focus-visible:ring-2 focus-visible:outline-none focus:outline-none"
                rows={3}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-medium text-gray-700">Category *</Label>
              <Select value={formData.category} onValueChange={(value) => {
                handleInputChange('category', value);
                // Find and set category ID
                const selectedCategory = apiCategories.find(cat => cat.name === value);
                if (selectedCategory) {
                  handleInputChange('categoryId', selectedCategory.id);
                }
              }}>
                <SelectTrigger className="h-11 rounded-lg border-gray-300 bg-white focus-visible:border-[#6C60FF] focus-visible:ring-[#6C60FF] focus-visible:ring-2 focus-visible:outline-none focus:outline-none">
                  <SelectValue placeholder={isLoadingCategories ? "Loading categories..." : "Select a category"} className="placeholder-gray-400" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingCategories ? (
                    <SelectItem value="loading" disabled>Loading categories...</SelectItem>
                  ) : (
                    // Use API categories if available (already filtered), otherwise use static categories
                    (apiCategories.length > 0 ? apiCategories
                      .filter(cat => !cat.name.toLowerCase().includes('shared') && cat.name.toLowerCase() !== 'published')
                      .map(cat => (
                      <SelectItem key={cat.id || cat.name} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    )) : CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    )))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Collaborators Section */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                <Users className="w-3 h-3 text-gray-600" />
              </div>
              <h3 className="text-lg font-medium">Add Users</h3>
            </div>
            <p className="text-sm text-gray-600">
              Share this campaign with specific people by adding their email addresses or selecting from your contacts.
            </p>
          {/* Email Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter email or username..."
              value={currentCollaborator}
              onChange={(e) => setCurrentCollaborator(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCollaborator(currentCollaborator))}
              className={`flex-1 h-10 rounded-lg bg-white placeholder:text-gray-400 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-1 focus-visible:ring-1 transition-colors ${
                currentCollaborator.trim() 
                  ? 'border-black focus:border-black focus:ring-black focus-visible:border-black focus-visible:ring-black' 
                  : 'border-gray-300 focus:border-gray-400 focus:ring-gray-300 focus-visible:border-gray-400 focus-visible:ring-gray-300'
              }`}
            />
            <Button
              type="button"
              onClick={() => addCollaborator(currentCollaborator)}
              disabled={!currentCollaborator.trim()}
              variant="outline"
              className="h-10 px-4 rounded-lg border-gray-300 hover:bg-gray-50"
            >
              Add
            </Button>
          </div>

          {/* Frequent Collaborators */}
          {apiFrequentCollaborators.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Frequent collaborators</h3>
              <div className="space-y-2">
                {apiFrequentCollaborators.slice(0, 3).map((collaborator) => (
                  <div key={collaborator.id || collaborator.user_id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {collaborator.name ? collaborator.name.charAt(0).toUpperCase() : 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{collaborator.name || 'User'}</p>
                        <p className="text-xs text-gray-500">{collaborator.email}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => addExistingCollaborator(collaborator)}
                      disabled={formData.collaborators.includes(collaborator.email)}
                      size="sm"
                      variant="outline"
                      className="w-8 h-8 rounded-full p-0 border-gray-300 hover:bg-gray-50"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Collaborators */}
          {apiRecentCollaborators.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Recent collaborators</h3>
              <div className="flex gap-2">
                {apiRecentCollaborators.slice(0, 5).map((collaborator) => (
                  <div key={collaborator.id || collaborator.user_id} className="relative">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {collaborator.name ? collaborator.name.charAt(0).toUpperCase() : 'U'}
                      </span>
                    </div>
                    <Button
                      type="button"
                      onClick={() => addExistingCollaborator(collaborator)}
                      disabled={formData.collaborators.includes(collaborator.email)}
                      size="sm"
                      variant="outline"
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full p-0 border-gray-300 hover:bg-gray-50 bg-white"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Collaborators */}
          {formData.collaborators.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Selected collaborators</h3>
              <div className="flex flex-wrap gap-2">
                {formData.collaborators.map((collaborator, index) => (
                  <Badge key={index} variant="secondary" className="text-xs py-1 px-2 bg-green-100 text-green-700 hover:bg-green-200">
                    {collaborator}
                    <button
                      type="button"
                      onClick={() => removeCollaborator(collaborator)}
                      className="ml-1 text-green-500 hover:text-green-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          </div>

          {/* Photos Section */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                <Upload className="w-3 h-3 text-gray-600" />
              </div>
              <h3 className="text-lg font-medium">Photos</h3>
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#6C60FF] transition-colors">
              <input
                type="file"
                id="image-upload"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <Upload className="h-6 w-6 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#6C60FF]">Click to upload photos or drag and drop</p>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 10MB each</p>
                  </div>
                </div>
              </label>
            </div>
            
            {/* Uploaded images preview */}
            {formData.images.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">{formData.images.length} photo(s) selected</p>
                <div className="grid grid-cols-4 gap-2">
                  {formData.images.map((file, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <ImageWithFallback
                          src={URL.createObjectURL(file)}
                          alt={`Upload ${index + 1}`}
                          className="w-full h-full object-cover"
                          fallback={
                            <div className="w-full h-full flex items-center justify-center bg-gray-200">
                              <span className="text-xs text-gray-500">{file.name}</span>
                            </div>
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="px-6 py-2 rounded-lg border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="bg-[#6C60FF] hover:bg-[#5B4FE8] text-white px-6 py-2 rounded-lg"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </div>
              ) : (
                'Create Campaign'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Success Dialog */}
    {createdMemoryDetails && (
      <MemoryCreatedDialog
        isOpen={showSuccessDialog}
        onClose={() => {
          setShowSuccessDialog(false);
          setCreatedMemoryDetails(null);
        }}
        memoryTitle={createdMemoryDetails.title}
        categoryName={createdMemoryDetails.category}
        location={createdMemoryDetails.location}
      />
    )}
    
    {/* Memory Limit Dialog */}
    <MemoryLimitDialog
      isOpen={showLimitDialog}
      onClose={() => setShowLimitDialog(false)}
      memoryCount={limitData.current_memories}
      memoryLimit={limitData.memory_limit}
    />
    </>
  );
}