import { useState, useRef, useEffect } from 'react';
import { X, Calendar as CalendarIcon, MapPin, Upload, Plus, AlignLeft, Image as ImageIcon, Trash2, FileText, CheckCircle, Loader2, File, Save, ChevronDown, Type, Camera, Tag } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import GooglePlacesInput from './ui/google-places-input';
import { mediaAPI } from '../services/mediaAPI';
import { dashboardAPI } from '../utils/authUtils';
import exifr from 'exifr';
import { useAuth } from '../contexts/AuthContext';
import { useProperty } from '../contexts/PropertyContext';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { triggerMemoryCountsRefresh } from '../hooks/useMemoryCounts';
import { format } from 'date-fns';
import { toast } from 'sonner';
import ToneSelectionModal from './ToneSelectionModal';
import AISuggestionModal from './AISuggestionModal';

interface UploadProgressItem {
  id: string;
  fileName: string;
  fileType: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  uploadedImageId?: string;
}

interface MediaLibraryImage {
  id: string;
  image: string;
  title: string;
  category: string;
  date?: string;
  location?: string;
  content?: string;
}

interface MemoryImage {
  id: string;
  src: string;
  title?: string;
  subImages?: MemoryImage[];
}

interface AddMomentModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoryId?: string;
  memoryTitle?: string;
  memoryThumbnail?: string; // Memory thumbnail/last updated image
  memoryCreatedDate?: string; // Memory created date
  memoryLocation?: string; // Memory default location
  onAddMoment?: (momentData: any) => void;
  buttonRef?: React.RefObject<HTMLButtonElement>;
  onOpenMediaLibrary?: () => void;
  selectedMediaLibraryImages?: MediaLibraryImage[];
  userRole?: 'contributor' | 'viewer' | 'admin' | undefined;
  parentImageId?: string; // Parent image ID for sub-images
  capturedFiles?: FileList | null; // Files captured from camera or selected from library
  memoryImages?: MemoryImage[]; // All images in the memory with sub-images
  storyTags?: string[];
  insertAfterPostId?: string | null; // ID of the post this moment should be inserted after
  getInsertAfterPostId?: () => string | null; // Ref-based getter to always get fresh value
  libraryMode?: boolean; // When true, saves directly to media library (no story required)
  editPhotoData?: {
    index: number;
    name: string;
    fileUrl: string;
    title: string;
    description: string;
    capture_date: string;
    location: string;
    tags: string[];
    originalSizeMB: number;
  };
}

// HEIC/HEIF has no browser decoder, so it can never be shown as an <img> preview —
// neither from a local FileReader read nor from the uploaded file's URL. Detect it
// by extension (file.type is unreliable/empty for HEIC across browsers) and skip
// straight to a filename-chip placeholder instead of attempting a broken preview.
const isHeicFile = (file: File): boolean => {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return ext === 'heic' || ext === 'heif';
};

export function AddMomentModal({
  isOpen,
  onClose,
  memoryId,
  memoryTitle = "Campaign",
  memoryThumbnail,
  memoryCreatedDate,
  memoryLocation,
  onAddMoment,
  buttonRef,
  onOpenMediaLibrary,
  selectedMediaLibraryImages,
  userRole,
  parentImageId,
  capturedFiles,
  memoryImages = [],
  storyTags = [],
  insertAfterPostId,
  getInsertAfterPostId,
  libraryMode = false,
  editPhotoData
}: AddMomentModalProps) {
  const { user } = useAuth();
  const { viewType } = useProperty();
  const profileColor = user?.profile_color
    ? (user.profile_color.startsWith('#') ? user.profile_color : `#${user.profile_color}`)
    : '#7B68EE';
  const userInitial = user?.name?.charAt(0) || user?.email?.charAt(0) || 'U';

  const [formData, setFormData] = useState({
    files: [] as File[]
  });
  const [imagePreviews, setImagePreviews] = useState<{ [key: number]: string }>({});
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageDetails, setImageDetails] = useState<{ [key: number]: { description: string; date: string; location: string; title?: string; showTitleInput?: boolean; tags?: string[] } }>({});
  const [newTag, setNewTag] = useState('');
  const [mediaLibraryImages, setMediaLibraryImages] = useState<MediaLibraryImage[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFilesCount, setUploadedFilesCount] = useState(0);
  const [uploadedS3Urls, setUploadedS3Urls] = useState<{ [index: number]: string }>({});
  const [uploadedSizes, setUploadedSizes] = useState<{ [index: number]: number }>({});
  const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 });
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isAddMoreMenuOpen, setIsAddMoreMenuOpen] = useState(false);
  const [isMemoryDropdownOpen, setIsMemoryDropdownOpen] = useState(false);
  const [selectedParentImageId, setSelectedParentImageId] = useState<string | undefined>(parentImageId);

  // AI Suggest states
  const [isAISuggesting, setIsAISuggesting] = useState(false);
  const [isToneModalOpen, setIsToneModalOpen] = useState(false);
  const [selectedTone, setSelectedTone] = useState<'personal' | 'sales_rep'>('personal');
  const aiSuggestButtonRef = useRef<HTMLButtonElement>(null);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);

  // Calculate total images count (desktop files + media library images)
  const totalImagesCount = formData.files.length + mediaLibraryImages.length;

  // Handle media library images when they're passed in
  useEffect(() => {
    if (selectedMediaLibraryImages && selectedMediaLibraryImages.length > 0) {
      console.log('Received media library images:', selectedMediaLibraryImages);

      const currentImageCount = formData.files.length + mediaLibraryImages.length;

      // Add to media library images state
      setMediaLibraryImages(prev => [...prev, ...selectedMediaLibraryImages]);

      // Create previews for media library images
      const newPreviews: { [key: number]: string } = {};
      const newDetails: { [key: number]: { description: string; date: string; location: string; title?: string; showTitleInput?: boolean } } = {};

      selectedMediaLibraryImages.forEach((img, index) => {
        const imageIndex = currentImageCount + index;
        newPreviews[imageIndex] = img.image;
        newDetails[imageIndex] = {
          description: img.content || '',
          date: img.date || new Date().toISOString().split('T')[0],
          location: img.location || memoryLocation || ''
        };
      });

      setImagePreviews(prev => ({ ...prev, ...newPreviews }));
      setImageDetails(prev => ({ ...prev, ...newDetails }));

      // If no images selected yet, select the first one
      if (formData.files.length === 0 && mediaLibraryImages.length === 0) {
        setSelectedImageIndex(0);
      }
    }
  }, [selectedMediaLibraryImages]);

  useEffect(() => {
    const updateModalPosition = () => {
      if (isOpen && buttonRef?.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const modalWidth = 400; // Increased width for better layout
        const viewportWidth = window.innerWidth;
        const timelineSidebarWidth = 448; // 28rem = 448px
        const contentAreaWidth = viewportWidth - timelineSidebarWidth;

        // Position modal to end before timeline sidebar
        const maxRightPosition = contentAreaWidth - modalWidth - 16; // 16px margin
        const leftPosition = Math.min(buttonRect.left, maxRightPosition);

        setModalPosition({
          top: buttonRect.bottom + 8,
          left: Math.max(16, leftPosition) // Ensure minimum 16px from left edge
        });
      }
    };

    // Update position initially
    updateModalPosition();

    // Update position on scroll and resize
    if (isOpen) {
      window.addEventListener('scroll', updateModalPosition, true);
      window.addEventListener('resize', updateModalPosition);

      return () => {
        window.removeEventListener('scroll', updateModalPosition, true);
        window.removeEventListener('resize', updateModalPosition);
      };
    }
  }, [isOpen, buttonRef]);

  // Auto-scroll to show active tab
  useEffect(() => {
    if (tabsContainerRef.current && totalImagesCount > 0) {
      const container = tabsContainerRef.current;
      const activeTab = container.children[0]?.children[selectedImageIndex] as HTMLElement;

      if (activeTab) {
        const containerWidth = container.offsetWidth;
        const tabLeft = activeTab.offsetLeft;
        const tabWidth = activeTab.offsetWidth;
        const scrollLeft = container.scrollLeft;

        // Check if tab is not fully visible
        if (tabLeft < scrollLeft || tabLeft + tabWidth > scrollLeft + containerWidth) {
          // Center the active tab if possible
          const targetScroll = tabLeft - (containerWidth / 2) + (tabWidth / 2);
          container.scrollTo({
            left: Math.max(0, targetScroll),
            behavior: 'smooth'
          });
        }
      }
    }
  }, [selectedImageIndex, totalImagesCount]);

  // Debug: Monitor imageDetails changes
  useEffect(() => {
    console.log('Current imageDetails state:', imageDetails);
    console.log('Selected index:', selectedImageIndex);
    console.log('Current selected image details:', imageDetails[selectedImageIndex]);
  }, [imageDetails, selectedImageIndex]);

  // Auto-process captured files from camera or media library
  const processedFilesRef = useRef<Set<string>>(new Set());
  const isProcessingCapturedFiles = useRef(false);

  useEffect(() => {
    const processCapturedFiles = async () => {
      if (!capturedFiles || capturedFiles.length === 0 || !isOpen) return;
      if (isProcessingCapturedFiles.current) return;

      const files = Array.from(capturedFiles);
      const fileKey = files.map(f => `${f.name}-${f.size}-${f.lastModified}`).join(',');

      // Prevent processing the same files multiple times
      if (processedFilesRef.current.has(fileKey)) return;
      processedFilesRef.current.add(fileKey);
      isProcessingCapturedFiles.current = true;

      console.log('📤 Auto-uploading captured files:', files.map(f => f.name).join(', '));

      try {
        const currentFileCount = formData.files.length;

        // Start upload progress immediately
        setIsUploading(true);
        setUploadedFilesCount(0);

        // Create upload progress items for each file
        const uploadItems: UploadProgressItem[] = files.map((file) => ({
          id: Math.random().toString(36).substr(2, 9),
          fileName: file.name,
          fileType: file.type,
          progress: 0,
          status: 'uploading' as const
        }));

        setUploadProgress(uploadItems);

        // Process files in batches of 5
        const BATCH_SIZE = 5;
        const processedFiles: File[] = [];
        const newPreviews: { [key: number]: string } = { ...imagePreviews };
        const newDetails: { [key: number]: { description: string; date: string; location: string; title?: string; showTitleInput?: boolean } } = { ...imageDetails };

        console.log('🚀 Starting BATCH upload of', files.length, 'files (batch size: 5)');

        for (let batchStart = 0; batchStart < files.length; batchStart += BATCH_SIZE) {
          const batch = files.slice(batchStart, batchStart + BATCH_SIZE);

          // Mark batch items as starting
          const batchItemIds = uploadItems.slice(batchStart, batchStart + batch.length).map(i => i.id);
          setUploadProgress(prev => prev.map(upload =>
            batchItemIds.includes(upload.id) ? { ...upload, progress: 10 } : upload
          ));

          const batchResults = await Promise.all(
            batch.map(async (file, batchIndex) => {
              const globalIndex = batchStart + batchIndex;
              const item = uploadItems[globalIndex];
              const fileIndex = currentFileCount + globalIndex;

              try {
                const exif = await exifr.parse(file, ['Orientation']).catch(() => null);
                const orientation = exif?.Orientation ?? 1;
                const metadataResponse = await dashboardAPI.uploadImageWithMetadata(file, file.name, orientation);

                setUploadProgress(prev => prev.map(upload =>
                  upload.id === item.id ? { ...upload, progress: 100, status: 'complete' } : upload
                ));

                // Extract metadata
                let extractedMetadata = {
                  capture_date: new Date().toISOString().split('T')[0],
                  capture_location: ''
                };

                const apiData = metadataResponse?.data?.data || metadataResponse?.data;

                if (apiData) {
                  if (apiData.capture_date) extractedMetadata.capture_date = apiData.capture_date;
                  if (apiData.capture_location) extractedMetadata.capture_location = apiData.capture_location;
                  if (apiData.fileUrl) {
                    setUploadedS3Urls(prev => ({ ...prev, [fileIndex]: apiData.fileUrl }));
                  }
                  if (apiData.originalSizeMB != null) {
                    setUploadedSizes(prev => ({ ...prev, [fileIndex]: apiData.originalSizeMB }));
                  }
                }

                // Create preview (HEIC/HEIF can't be decoded by the browser, so it
                // skips straight to the filename-chip placeholder in the render)
                if (!isHeicFile(file)) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    newPreviews[fileIndex] = reader.result as string;
                    setImagePreviews({ ...newPreviews });
                  };
                  reader.readAsDataURL(file);
                }

                newDetails[fileIndex] = {
                  description: '',
                  date: extractedMetadata.capture_date,
                  location: extractedMetadata.capture_location || memoryLocation || ''
                };

                setUploadedFilesCount(prev => prev + 1);
                return { file, success: true };

              } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                // Still add file even if metadata extraction failed (common on mobile with poor network)
                setUploadProgress(prev => prev.map(upload =>
                  upload.id === item.id ? { ...upload, progress: 100, status: 'complete' } : upload
                ));
                setUploadedFilesCount(prev => prev + 1);
                if (file.type.startsWith('image/') && !isHeicFile(file)) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setImagePreviews(prev => ({ ...prev, [fileIndex]: reader.result as string }));
                  };
                  reader.readAsDataURL(file);
                }
                setImageDetails(prev => ({
                  ...prev,
                  [fileIndex]: {
                    description: prev[fileIndex]?.description || '',
                    date: new Date().toISOString().split('T')[0],
                    location: memoryLocation || ''
                  }
                }));
                return { file, success: true };
              }
            })
          );

          batchResults.forEach(result => {
            if (result.success && result.file) processedFiles.push(result.file);
          });
        }

        console.log('✅ BATCH upload completed:', processedFiles.length, 'files uploaded successfully');

        // Update form data
        setFormData(prev => ({
          ...prev,
          files: [...prev.files, ...processedFiles]
        }));

        setImageDetails(newDetails);

        // Complete upload
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress([]);
        }, 500);

      } catch (error) {
        console.error('Error in auto-upload:', error);
        setIsUploading(false);
      } finally {
        isProcessingCapturedFiles.current = false;
      }
    };

    processCapturedFiles();
  }, [capturedFiles, isOpen]);

  // Pre-populate modal state when opened in edit mode
  useEffect(() => {
    if (!isOpen || !editPhotoData) return;
    // Create a placeholder so the modal renders the image slot (Blob cast avoids lucide File name conflict)
    const placeholder = Object.assign(new Blob([''], { type: 'image/jpeg' }), { name: editPhotoData.name, lastModified: Date.now() }) as any;
    setFormData({ files: [placeholder] });
    setImagePreviews({ 0: editPhotoData.fileUrl });
    setImageDetails({
      0: {
        title: editPhotoData.title,
        description: editPhotoData.description,
        date: editPhotoData.capture_date,
        location: editPhotoData.location,
        tags: editPhotoData.tags,
        showTitleInput: !!editPhotoData.title
      }
    });
    setUploadedS3Urls({ 0: editPhotoData.fileUrl });
    setUploadedSizes({ 0: editPhotoData.originalSizeMB });
    setSelectedImageIndex(0);
  }, [isOpen, editPhotoData]);

  if (!isOpen) return null;

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const currentFileCount = formData.files.length;
    const currentTotalCount = formData.files.length + mediaLibraryImages.length;

    if (files.length === 0) return;

    // Start upload progress immediately when files are selected
    setIsUploading(true);
    setUploadedFilesCount(0);

    // Create upload progress items for each file
    const uploadItems: UploadProgressItem[] = files.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      fileName: file.name,
      fileType: file.type,
      progress: 0,
      status: 'uploading' as const
    }));

    setUploadProgress(uploadItems);

    // If there are media library images, we need to shift them to make room for new desktop files
    if (mediaLibraryImages.length > 0) {
      const newPreviews: { [key: number]: string } = {};
      const newDetails: { [key: number]: { description: string; date: string; location: string; title?: string; showTitleInput?: boolean } } = {};

      // Keep existing desktop files at their current indices
      for (let i = 0; i < currentFileCount; i++) {
        if (imagePreviews[i]) newPreviews[i] = imagePreviews[i];
        if (imageDetails[i]) newDetails[i] = imageDetails[i];
      }

      // Shift media library images to new indices (after new desktop files will be added)
      const newDesktopFilesCount = currentFileCount + files.length;
      mediaLibraryImages.forEach((img, mlIndex) => {
        const oldIndex = currentFileCount + mlIndex;
        const newIndex = newDesktopFilesCount + mlIndex;
        if (imagePreviews[oldIndex]) newPreviews[newIndex] = imagePreviews[oldIndex];
        if (imageDetails[oldIndex]) newDetails[newIndex] = imageDetails[oldIndex];
      });

      setImagePreviews(newPreviews);
      setImageDetails(newDetails);
    }

    // Process files in batches of 5
    const BATCH_SIZE = 5;
    console.log('🚀 handleFileSelect: Starting BATCH upload of', files.length, 'files (batch size: 5)');

    const processedFiles: File[] = [];

    for (let batchStart = 0; batchStart < files.length; batchStart += BATCH_SIZE) {
      const batch = files.slice(batchStart, batchStart + BATCH_SIZE);

      // Mark batch items as starting
      const batchItemIds = uploadItems.slice(batchStart, batchStart + batch.length).map(i => i.id);
      setUploadProgress(prev => prev.map(upload =>
        batchItemIds.includes(upload.id) ? { ...upload, progress: 10 } : upload
      ));

      const batchResults = await Promise.all(
        batch.map(async (file, batchIndex) => {
          const globalIndex = batchStart + batchIndex;
          const item = uploadItems[globalIndex];
          const fileIndex = currentFileCount + globalIndex;

          try {
            const exif = await exifr.parse(file, ['Orientation']).catch(() => null);
            const orientation = exif?.Orientation ?? 1;
            const metadataResponse = await dashboardAPI.uploadImageWithMetadata(file, file.name, orientation);

            console.log(`EXIF response for ${file.name}:`, metadataResponse);

            setUploadProgress(prev => prev.map(upload =>
              upload.id === item.id ? { ...upload, progress: 100, status: 'complete' } : upload
            ));

            // Extract metadata from response
            let extractedMetadata = {
              capture_date: new Date().toISOString().split('T')[0],
              location: ''
            };

            if (metadataResponse?.success) {
              const responseData = metadataResponse.data?.data || metadataResponse.data;
              if (responseData.capture_date) extractedMetadata.capture_date = responseData.capture_date;
              if (responseData.location) extractedMetadata.location = responseData.location;
              if (responseData.fileUrl) {
                setUploadedS3Urls(prev => ({ ...prev, [fileIndex]: responseData.fileUrl }));
              }
              if (responseData.originalSizeMB != null) {
                setUploadedSizes(prev => ({ ...prev, [fileIndex]: responseData.originalSizeMB }));
              }
              console.log(`Extracted metadata for ${file.name}:`, extractedMetadata);
            }

            setUploadedFilesCount(prev => prev + 1);

            // Create image preview (HEIC/HEIF can't be decoded by the browser, so it
            // skips straight to the filename-chip placeholder in the render)
            if (file.type.startsWith('image/') && !isHeicFile(file)) {
              const reader = new FileReader();
              reader.onloadend = () => {
                setImagePreviews(prev => ({ ...prev, [fileIndex]: reader.result as string }));
              };
              reader.readAsDataURL(file);
            }

            setImageDetails(prev => ({
              ...prev,
              [fileIndex]: {
                ...prev[fileIndex],
                description: prev[fileIndex]?.description || '',
                date: extractedMetadata.capture_date,
                location: extractedMetadata.location || memoryLocation || ''
              }
            }));

            return { file, success: true };

          } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            // Still add file even if metadata extraction failed (common on mobile with poor network)
            setUploadProgress(prev => prev.map(upload =>
              upload.id === item.id ? { ...upload, progress: 100, status: 'complete' } : upload
            ));
            setUploadedFilesCount(prev => prev + 1);
            if (file.type.startsWith('image/') && !isHeicFile(file)) {
              const reader = new FileReader();
              reader.onloadend = () => {
                setImagePreviews(prev => ({ ...prev, [fileIndex]: reader.result as string }));
              };
              reader.readAsDataURL(file);
            }
            setImageDetails(prev => ({
              ...prev,
              [fileIndex]: {
                description: prev[fileIndex]?.description || '',
                date: new Date().toISOString().split('T')[0],
                location: memoryLocation || ''
              }
            }));
            return { file, success: true };
          }
        })
      );

      batchResults.forEach(result => {
        if (result.success && result.file) processedFiles.push(result.file);
      });
    }

    console.log('✅ handleFileSelect: BATCH upload completed:', processedFiles.length, 'files uploaded successfully');
    
    // Add successfully processed files to formData
    setFormData(prev => ({
      ...prev,
      files: [...prev.files, ...processedFiles]
    }));

    // If this is the first set of images (no desktop files and no media library images), set the selected index to 0
    if (currentTotalCount === 0 && processedFiles.length > 0) {
      setSelectedImageIndex(0);
    }
    
    // Complete upload process after a brief delay
    setTimeout(() => {
      setIsUploading(false);
    }, 1000);
  };

  const handleRemoveFile = (index: number) => {
    const desktopFilesCount = formData.files.length;

    if (index < desktopFilesCount) {
      // Removing a desktop file
      const newFiles = formData.files.filter((_, i) => i !== index);
      const newPreviews: { [key: number]: string } = {};
      const newImageDetails: { [key: number]: { description: string; date: string; location: string; title?: string; showTitleInput?: boolean } } = {};
      // uploadedS3Urls / uploadedSizes are keyed by the same desktop-file index, so they
      // must be reindexed in lockstep — otherwise submit picks the wrong (deleted) image's URL.
      const newS3Urls: { [index: number]: string } = {};
      const newSizes: { [index: number]: number } = {};

      // Rebuild previews and details for desktop files with new indices
      newFiles.forEach((file, newIndex) => {
        const oldIndex = newIndex >= index ? newIndex + 1 : newIndex;
        if (imagePreviews[oldIndex]) {
          newPreviews[newIndex] = imagePreviews[oldIndex];
        }
        if (imageDetails[oldIndex]) {
          newImageDetails[newIndex] = imageDetails[oldIndex];
        }
        if (uploadedS3Urls[oldIndex] !== undefined) {
          newS3Urls[newIndex] = uploadedS3Urls[oldIndex];
        }
        if (uploadedSizes[oldIndex] !== undefined) {
          newSizes[newIndex] = uploadedSizes[oldIndex];
        }
      });

      // Re-add media library images with adjusted indices
      mediaLibraryImages.forEach((img, mlIndex) => {
        const oldGlobalIndex = desktopFilesCount + mlIndex;
        const newGlobalIndex = newFiles.length + mlIndex;
        if (imagePreviews[oldGlobalIndex]) {
          newPreviews[newGlobalIndex] = imagePreviews[oldGlobalIndex];
        }
        if (imageDetails[oldGlobalIndex]) {
          newImageDetails[newGlobalIndex] = imageDetails[oldGlobalIndex];
        }
      });

      setFormData(prev => ({
        ...prev,
        files: newFiles
      }));
      setImagePreviews(newPreviews);
      setImageDetails(newImageDetails);
      setUploadedS3Urls(newS3Urls);
      setUploadedSizes(newSizes);
    } else {
      // Removing a media library image
      const mlIndex = index - desktopFilesCount;
      const newMediaLibraryImages = mediaLibraryImages.filter((_, i) => i !== mlIndex);
      const newPreviews: { [key: number]: string } = {};
      const newImageDetails: { [key: number]: { description: string; date: string; location: string; title?: string; showTitleInput?: boolean } } = {};

      // Keep desktop files previews and details
      formData.files.forEach((file, i) => {
        if (imagePreviews[i]) {
          newPreviews[i] = imagePreviews[i];
        }
        if (imageDetails[i]) {
          newImageDetails[i] = imageDetails[i];
        }
      });

      // Rebuild media library images with new indices
      newMediaLibraryImages.forEach((img, newMlIndex) => {
        const oldGlobalIndex = desktopFilesCount + (newMlIndex >= mlIndex ? newMlIndex + 1 : newMlIndex);
        const newGlobalIndex = desktopFilesCount + newMlIndex;
        if (imagePreviews[oldGlobalIndex]) {
          newPreviews[newGlobalIndex] = imagePreviews[oldGlobalIndex];
        }
        if (imageDetails[oldGlobalIndex]) {
          newImageDetails[newGlobalIndex] = imageDetails[oldGlobalIndex];
        }
      });

      setMediaLibraryImages(newMediaLibraryImages);
      setImagePreviews(newPreviews);
      setImageDetails(newImageDetails);
    }

    // Adjust selected index if needed
    const newTotalCount = formData.files.length + mediaLibraryImages.length - 1;
    if (selectedImageIndex >= newTotalCount && newTotalCount > 0) {
      setSelectedImageIndex(newTotalCount - 1);
    } else if (newTotalCount === 0) {
      setSelectedImageIndex(0);
    }
  };

  // AI Suggest handlers
  const handleAISuggest = () => {
    const currentImagePreview = imagePreviews[selectedImageIndex];

    if (!currentImagePreview || isAISuggesting) return;

    // Open tone selection modal first
    setIsToneModalOpen(true);
  };

  const handleToneSelect = async (tone: 'personal' | 'sales_rep') => {
    setSelectedTone(tone);
    setIsToneModalOpen(false);
    setIsAISuggesting(true);

    try {
      const currentImagePreview = imagePreviews[selectedImageIndex];
      console.log('Getting AI suggestion for image with tone:', tone, 'and memory_id:', memoryId);

      // Pass the selected tone and memory_id to the API call
      const response = await dashboardAPI.getSuggestedDescription(currentImagePreview, tone, memoryId);

      if (response.success && response.data?.description) {
        // Directly set the description in the textarea
        setImageDetails(prev => ({
          ...prev,
          [selectedImageIndex]: {
            ...prev[selectedImageIndex],
            description: response.data.description,
            date: prev[selectedImageIndex]?.date || new Date().toISOString().split('T')[0],
            location: prev[selectedImageIndex]?.location || memoryLocation || ''
          }
        }));
        toast.success("AI suggestion added!");
      } else {
        toast.error(response.error || "Failed to get AI suggestion");
      }
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
      toast.error("Failed to get AI suggestion");
    } finally {
      setIsAISuggesting(false);
    }
  };

  // Handle accepting the AI suggestion
  const handleAcceptSuggestion = () => {
    setImageDetails(prev => ({
      ...prev,
      [selectedImageIndex]: {
        ...prev[selectedImageIndex],
        description: currentSuggestion,
        date: prev[selectedImageIndex]?.date || new Date().toISOString().split('T')[0],
        location: prev[selectedImageIndex]?.location || memoryLocation || ''
      }
    }));
    setIsSuggestionModalOpen(false);
    setCurrentSuggestion('');
    toast.success("AI suggestion added!");
  };

  // Handle retrying AI suggestion with no_credit = 0
  const handleRetrySuggestion = async () => {
    setIsRetrying(true);

    try {
      const currentImagePreview = imagePreviews[selectedImageIndex];
      console.log('Retrying AI suggestion with no_credit=0, tone:', selectedTone, 'and memory_id:', memoryId);

      // Call API with no_credit = true (sends no_credit: 0 in payload)
      const response = await dashboardAPI.getSuggestedDescription(currentImagePreview, selectedTone, memoryId, true);

      if (response.success && response.data?.description) {
        // Update the suggestion in the modal
        setCurrentSuggestion(response.data.description);
        toast.success("New AI suggestion generated!");
      } else {
        toast.error(response.error || "Failed to retry AI suggestion");
      }
    } catch (error) {
      console.error('Error retrying AI suggestion:', error);
      toast.error("Failed to retry AI suggestion");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleLibrarySubmit = async () => {
    if (formData.files.length === 0) return;
    setIsSubmitting(true);
    try {
      let successCount = 0;
      for (let i = 0; i < formData.files.length; i++) {
        const file = formData.files[i];
        const details = imageDetails[i] || { description: '', date: new Date().toISOString().split('T')[0], location: '' };
        const response = await dashboardAPI.uploadPhotosFromMediaWithOutMemory(
          file,
          file.name,
          details.location || '',
          details.date,
          details.title || '',
          details.description || ''
        );
        if (response.success) successCount++;
      }
      setIsSubmitting(false);
      if (successCount > 0) {
        toast.success(`${successCount} image${successCount > 1 ? 's' : ''} added to media library!`);
      }
      handleCancel();
    } catch (error) {
      console.error('Error adding to media library:', error);
      setIsSubmitting(false);
      toast.error('Failed to add to media library. Please try again.');
      handleCancel();
    }
  };

  const handleSubmit = async () => {
    if (libraryMode) {
      return handleLibrarySubmit();
    }

    if (!memoryId) {
      if (onAddMoment) {
        const photosData = formData.files.map((file, index) => ({
          name: imageDetails[index]?.title || file.name,
          title: imageDetails[index]?.title || '',
          description: imageDetails[index]?.description || '',
          location: imageDetails[index]?.location || '',
          capture_date: imageDetails[index]?.date || new Date().toISOString().split('T')[0],
          capture_time: '',
          fileUrl: uploadedS3Urls[index] || '',
          imageName: file.name,
          originalSizeMB: uploadedSizes[index] || 0,
          tags: imageDetails[index]?.tags || []
        }));
        onAddMoment({
          photos: photosData,
          ...(editPhotoData !== undefined && { editIndex: editPhotoData.index })
        });
      }
      setFormData({ files: [] });
      setImagePreviews({});
      setImageDetails({});
      setMediaLibraryImages([]);
      setSelectedImageIndex(0);
      setUploadedS3Urls({});
      setUploadedSizes({});
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare desktop files imageDetails (indices 0 to formData.files.length - 1)
      const desktopImageDetails: { [key: number]: { description: string; date: string; location: string; title?: string; tags?: string[] } } = {};
      for (let i = 0; i < formData.files.length; i++) {
        if (imageDetails[i]) {
          desktopImageDetails[i] = {
            description: imageDetails[i].description,
            date: imageDetails[i].date,
            location: imageDetails[i].location,
            title: imageDetails[i].title,
            tags: imageDetails[i].tags || []
          };
        }
      }

      // Image-less moment: no files/media library images, but the user filled in the
      // moment details. Forward index 0 so mediaAPI.addMoment sends them in the payload.
      if (formData.files.length === 0 && mediaLibraryImages.length === 0 && imageDetails[0]) {
        desktopImageDetails[0] = {
          description: imageDetails[0].description,
          date: imageDetails[0].date,
          location: imageDetails[0].location,
          title: imageDetails[0].title,
          tags: imageDetails[0].tags || []
        };
      }

      // Prepare media library images with their details
      const mediaLibraryImagesData = mediaLibraryImages.map((img, index) => {
        const globalIndex = formData.files.length + index;
        const details = imageDetails[globalIndex] || {
          description: img.content || '',
          date: img.date || new Date().toISOString().split('T')[0],
          location: img.location || '',
          title: undefined,
          tags: [] as string[]
        };

        return {
          image_url: img.image,
          media_id: img.id,
          title: details.title || img.title, // Use custom title if provided, otherwise use default
          description: details.description,
          capture_date: details.date,
          location: details.location,
          tags: details.tags || []
        };
      });

      console.log('Submitting moments with:', {
        desktopFiles: formData.files.length,
        mediaLibraryImages: mediaLibraryImagesData.length,
        desktopImageDetails,
        mediaLibraryImagesData
      });

      // Use selectedParentImageId if set, otherwise fall back to parentImageId prop
      const finalParentImageId = selectedParentImageId || parentImageId;
      console.log('🎯 AddMomentModal - Submitting with parentImageId:', finalParentImageId);
      // Use getter (ref-based) if available for fresh value, fallback to prop
      const freshAfterPostId = getInsertAfterPostId ? getInsertAfterPostId() : insertAfterPostId;
      console.log('🎯 AddMomentModal - insertAfterPostId prop:', insertAfterPostId, '| ref value:', freshAfterPostId);

      const finalAfterPostId = freshAfterPostId != null ? String(freshAfterPostId) : undefined;
      console.log('🎯 AddMomentModal - finalAfterPostId being sent:', finalAfterPostId);

      const response = await mediaAPI.addMoment({
        memoryId,
        files: formData.files,
        imageDetails: desktopImageDetails,
        mediaLibraryImages: mediaLibraryImagesData,
        userRole,
        parentImageId: finalParentImageId,
        afterPostId: finalAfterPostId,
        s3Urls: uploadedS3Urls,
        isProperty: viewType === 'property',
        sizes: uploadedSizes
      });

    if (response?.success || response?.status === true) {
        console.log('Moment added successfully:', response);

        // Trigger memory counts refresh since we added media to a memory
        await triggerMemoryCountsRefresh();

        // Reset submitting state
        setIsSubmitting(false);

        // Reset form
        setFormData({
          files: []
        });
        setImagePreviews({});
        setImageDetails({});
        setMediaLibraryImages([]);
        setSelectedImageIndex(0);

        // Show appropriate message based on admin_approval status and whether it's a sub-image
        console.log('🔍 AddMomentModal - userRole:', userRole, 'type:', typeof userRole);
        console.log('🔍 AddMomentModal - finalParentImageId:', finalParentImageId, 'type:', typeof finalParentImageId);
        console.log('🔍 AddMomentModal - Full response:', response);

        // Check if admin_approval is 0 in the response data
        // API returns data as an array with image object inside
        const adminApproval = response.data?.[0]?.image?.admin_approval;
        const needsApproval = adminApproval === 0 || adminApproval === '0';
        console.log('🔍 AddMomentModal - admin_approval:', adminApproval, 'needsApproval:', needsApproval);

        if (finalParentImageId) {
          // For sub-images
          console.log('📸 Adding sub-image, checking approval status...');
          if (needsApproval) {
            console.log('✅ Admin approval needed (admin_approval=0) - showing approval message');
            toast.success('Sub-image added! Waiting for admin approval.', {
              duration: 5000,
            });
          } else {
            console.log('❌ No approval needed (admin_approval!=0) - showing success message');
            toast.success('Sub-image added successfully!');
          }
        } else {
          // For regular moments
          console.log('📝 Adding regular moment, checking approval status...');
          if (needsApproval) {
            console.log('✅ Admin approval needed (admin_approval=0) - showing review message');
            toast.warning('Moment added! It will appear on the timeline after admin review.', {
              duration: 5000,
              style: {
                background: '#FFFBEB',        // amber-50
                color: '#92400E',             // amber-800
                border: '1px solid #FDE68A',  // amber-200
              },
            });
          } else {
            console.log('❌ No approval needed (admin_approval!=0) - showing success message');
            toast.success('Moment added successfully!');
          }
        }

        // Call onAddMoment callback to notify parent
        if (onAddMoment) {
          onAddMoment(response.data);
        }

        // Close the modal
        handleCancel()
        onClose();
      } else {
        console.error('Failed to add moment:', response?.error || response?.message);
        setIsSubmitting(false);
        toast.error('Failed to add moment. Please try again.');
           handleCancel()
        onClose();
        // You might want to show an error message to the user here
      }
    } catch (error) {
      console.error('Error adding moment:', error);
      setIsSubmitting(false);
         handleCancel()
        onClose();
    }
  };

  const handleCancel = () => {
    // Reset form and close
    setFormData({
      files: []
    });
    setImagePreviews({});
    setImageDetails({});
    setMediaLibraryImages([]);
    setSelectedImageIndex(0);
    setUploadProgress([]);
    setIsUploading(false);
    setUploadedFilesCount(0);
    setUploadedS3Urls({});
    setUploadedSizes({});
    onClose();
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    const currentTags = imageDetails[selectedImageIndex]?.tags || [];
    const newTags = newTag.split(',').map(t => t.trim()).filter(t => t && !currentTags.includes(t));
    if (newTags.length === 0) { setNewTag(''); return; }
    setImageDetails(prev => ({
      ...prev,
      [selectedImageIndex]: {
        ...prev[selectedImageIndex],
        description: prev[selectedImageIndex]?.description || '',
        date: prev[selectedImageIndex]?.date || new Date().toISOString().split('T')[0],
        location: prev[selectedImageIndex]?.location || memoryLocation || '',
        tags: [...currentTags, ...newTags]
      }
    }));
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setImageDetails(prev => ({
      ...prev,
      [selectedImageIndex]: {
        ...prev[selectedImageIndex],
        description: prev[selectedImageIndex]?.description || '',
        date: prev[selectedImageIndex]?.date || new Date().toISOString().split('T')[0],
        location: prev[selectedImageIndex]?.location || memoryLocation || '',
        tags: (prev[selectedImageIndex]?.tags || []).filter(t => t !== tagToRemove)
      }
    }));
  };

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Helper function to get file name without extension
  const getFileName = (file: File) => {
    const name = file.name;
    const lastDot = name.lastIndexOf('.');
    return lastDot > 0 ? name.substring(0, lastDot) : name;
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 md:bg-black md:bg-opacity-50 md:flex md:items-center md:justify-center"
        style={{ zIndex: 99999 }}
        onClick={handleBackdropClick}
      >
        {/* Modal content */}
        <div
          className="bg-white h-full md:h-auto md:rounded-xl md:shadow-2xl w-full md:max-w-md md:border md:border-gray-200 relative flex flex-col md:max-h-[85vh]"
          style={{
            zIndex: 100000
          }}
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#7B68EE] rounded-full flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-[18px] md:text-lg font-semibold text-gray-900">Add a Moment</h2>
          </div>
          <button
            onClick={onClose}
            className="text-black hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 h-10 w-10 flex items-center justify-center md:h-auto md:w-auto"
          >
            <X className="!w-[28px] !h-[28px] md:!w-4 md:!h-4" />
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 p-4 md:p-4 space-y-4 overflow-y-auto">
          {/* Photos & Videos */}
          <div>
            <label className="flex items-center gap-2 text-[14px] md:text-sm font-medium text-gray-700 mb-2">
              <ImageIcon className="w-4 h-4" />
              Photos & Videos
            </label>

            {totalImagesCount === 0 && !isUploading ? (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center bg-gray-50/50">
                <div className="w-12 h-12 mx-auto mb-3 text-gray-400">
                  <Upload className="w-full h-full" />
                </div>

                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />

                {/* Mobile: Label-based file picker (more reliable than programmatic .click() on iOS) */}
                <label
                  htmlFor="file-upload"
                  className="mb-2 h-9 px-4 text-sm bg-white border border-[#7B68EE] text-[#7B68EE] hover:bg-[#7B68EE]/5 md:hidden inline-flex items-center rounded-md cursor-pointer"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Files
                </label>

                {/* Desktop: Popover menu */}
                <Popover open={isFileMenuOpen} onOpenChange={setIsFileMenuOpen} modal={true}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mb-2 h-9 px-4 text-sm bg-white border-[#7B68EE] text-[#7B68EE] hover:bg-[#7B68EE]/5 hidden md:inline-flex"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Choose Files
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2 bg-white border border-gray-200 shadow-lg z-[100001]" align="center" sideOffset={5}>
                    {/* Desktop Menu Options */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => {
                          setIsFileMenuOpen(false);
                          document.getElementById('file-upload')?.click();
                        }}
                        className="flex items-start gap-3 px-3 py-3 hover:bg-gray-100 rounded-lg text-left transition-colors"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <Upload className="w-5 h-5 text-[#7B68EE]" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">Upload from Desktop</div>
                          <div className="text-xs text-gray-500 mt-0.5">Choose files from your computer</div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          console.log('🎯 Add from Media Library clicked');
                          console.log('🎯 onOpenMediaLibrary exists?', !!onOpenMediaLibrary);
                          setIsFileMenuOpen(false);
                          onOpenMediaLibrary?.();
                          console.log('🎯 onOpenMediaLibrary called');
                        }}
                        className="flex items-start gap-3 px-3 py-3 hover:bg-gray-100 rounded-lg text-left transition-colors"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <ImageIcon className="w-5 h-5 text-[#7B68EE]" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">Add from Media Library</div>
                          <div className="text-xs text-gray-500 mt-0.5">Choose from uploaded media</div>
                        </div>
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                <p className="text-xs text-gray-500">
                  Upload photos or videos to illustrate this moment
                </p>
              </div>
            ) : isUploading && uploadProgress.length > 0 ? (
              <div className="border-2 border-gray-200 rounded-lg p-6 bg-white">
                {/* Upload Progress Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    uploadProgress.every(item => item.status === 'complete') ? 'bg-green-100' : 
                    uploadProgress.some(item => item.status === 'error') ? 'bg-red-100' : 'bg-blue-100'
                  }`}>
                    {uploadProgress.every(item => item.status === 'complete') ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : uploadProgress.some(item => item.status === 'error') ? (
                      <X className="w-5 h-5 text-red-600" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {uploadProgress.every(item => item.status === 'complete') ? 'Upload Complete' : 'Uploading Files...'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {uploadedFilesCount} files added to Unassigned
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500">
                      {uploadProgress.filter(item => item.status === 'complete').length} of {uploadProgress.length} files uploaded
                    </span>
                    <span className="text-xs text-gray-500">
                      {Math.round((uploadProgress.filter(item => item.status === 'complete').length / uploadProgress.length) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ 
                        width: `${(uploadProgress.filter(item => item.status === 'complete').length / uploadProgress.length) * 100}%` 
                      }}
                    />
                  </div>
                </div>

                {/* Files List */}
                <div>
                  <p className="text-[14px] md:text-sm font-medium text-gray-700 mb-3">Files:</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {uploadProgress.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex-shrink-0">
                            <File className="w-4 h-4 text-gray-400" />
                          </div>
                          <span className="text-sm text-gray-700 truncate">
                            {item.fileName}
                          </span>
                        </div>
                        <div className="flex-shrink-0 ml-3">
                          {item.status === 'uploading' && (
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                          )}
                          {item.status === 'complete' && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                          {item.status === 'error' && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-500">Failed</span>
                              <X className="w-4 h-4 text-red-500" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {/* Tabs for file names */}
                <div
                  ref={tabsContainerRef}
                  className="mb-3 overflow-x-auto"
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitScrollbar: { display: 'none' }
                  }}
                >
                  <div className="flex gap-2 flex-nowrap">
                    {/* Desktop uploaded files */}
                    {formData.files.map((file, index) => (
                      <button
                        key={`file-${index}`}
                        type="button"
                        onClick={() => setSelectedImageIndex(index)}
                        className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors flex-shrink-0 ${
                          index === selectedImageIndex
                            ? 'bg-[#7B68EE] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <FileText className="w-3 h-3" />
                        <span className="max-w-[100px] truncate">
                          {getFileName(file)}
                        </span>
                        {file.type.startsWith('image/') ? '.jpg' : '.mp4'}
                      </button>
                    ))}

                    {/* Media library images */}
                    {mediaLibraryImages.map((img, index) => {
                      const globalIndex = formData.files.length + index;
                      return (
                        <button
                          key={`media-${img.id}`}
                          type="button"
                          onClick={() => setSelectedImageIndex(globalIndex)}
                          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors flex-shrink-0 ${
                            globalIndex === selectedImageIndex
                              ? 'bg-[#7B68EE] text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <FileText className="w-3 h-3" />
                          <span className="max-w-[100px] truncate">
                            {img.title}
                          </span>
                        </button>
                      );
                    })}
                    
                    {/* Add more files button with menu */}
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload-more"
                    />
                    {/* Mobile: Label-based file picker (more reliable than programmatic .click() on iOS) */}
                    <label
                      htmlFor="file-upload-more"
                      className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0 md:hidden cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </label>

                    {/* Desktop: Popover menu */}
                    <Popover open={isAddMoreMenuOpen} onOpenChange={setIsAddMoreMenuOpen} modal={true}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="hidden md:flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                          Add
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2 bg-white border border-gray-200 shadow-lg z-[100001]" align="center" sideOffset={5}>
                        {/* Desktop Menu Options */}
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => {
                              setIsAddMoreMenuOpen(false);
                              document.getElementById('file-upload-more')?.click();
                            }}
                            className="flex items-start gap-3 px-3 py-3 hover:bg-gray-100 rounded-lg text-left transition-colors"
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              <Upload className="w-5 h-5 text-[#7B68EE]" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">Upload from Desktop</div>
                              <div className="text-xs text-gray-500 mt-0.5">Choose files from your computer</div>
                            </div>
                          </button>
                          <button
                            onClick={() => {
                              setIsAddMoreMenuOpen(false);
                              onOpenMediaLibrary?.();
                            }}
                            className="flex items-start gap-3 px-3 py-3 hover:bg-gray-100 rounded-lg text-left transition-colors"
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              <ImageIcon className="w-5 h-5 text-[#7B68EE]" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">Add from Media Library</div>
                              <div className="text-xs text-gray-500 mt-0.5">Choose from uploaded media</div>
                            </div>
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Current image preview */}
                <div className="relative">
                  {(() => {
                    const selectedFile = formData.files[selectedImageIndex];
                    const isHeicSelected = selectedFile ? isHeicFile(selectedFile) : false;
                    const previewSrc = imagePreviews[selectedImageIndex] || uploadedS3Urls[selectedImageIndex];

                    if (previewSrc && !isHeicSelected) {
                      return (
                        <div className="relative group">
                          <img
                            src={previewSrc}
                            alt={`Preview ${selectedImageIndex + 1}`}
                            className="w-1/2 md:w-full h-64 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(selectedImageIndex)}
                            className="absolute top-2 left-[calc(50%-2.5rem)] md:left-auto md:right-2 p-1.5 bg-red-500 text-white rounded-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    }

                    if (selectedFile && isHeicSelected) {
                      // HEIC/HEIF has no browser decoder, so it can never render as an
                      // <img> — show a filename chip instead of a blank/broken box.
                      return (
                        <div className="w-full h-48 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center relative group">
                          <div className="text-center">
                            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">{selectedFile.name}</p>
                            <p className="text-xs text-gray-500 mt-1">Preview unavailable for this format</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(selectedImageIndex)}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    }

                    if (selectedFile && !selectedFile.type.startsWith('image/')) {
                      return (
                        <div className="w-full h-48 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center relative group">
                          <div className="text-center">
                            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">{selectedFile.name}</p>
                            <p className="text-xs text-gray-500 mt-1">Video file</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(selectedImageIndex)}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    }

                    return null;
                  })()}
                </div>

              </div>
            )}
          </div>

          {/* Memory Hierarchy Section */}
          {!libraryMode && memoryId && memoryTitle && (
            <div>
              <label className="flex items-center gap-2 text-[14px] md:text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4" />
                Choose a Moment
              </label>

              <button
                type="button"
                onClick={() => setIsMemoryDropdownOpen(!isMemoryDropdownOpen)}
                className="w-full border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  {/* Memory Thumbnail/Icon or Selected Image */}
                  {selectedParentImageId ? (
                    // Show selected parent image
                    <>
                      {(() => {
                        const selectedImage = memoryImages.find(img => img.id === selectedParentImageId);
                        return selectedImage ? (
                          <ImageWithFallback
                            src={selectedImage.src}
                            alt={selectedImage.title || memoryTitle}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                            fallback={
                              <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: profileColor }}>
                                <span className="text-white font-bold text-lg uppercase">{userInitial}</span>
                              </div>
                            }
                          />
                        ) : (
                          <div className="w-12 h-12 bg-[#7B68EE] rounded-lg flex items-center justify-center flex-shrink-0">
                            <ImageIcon className="w-6 h-6 text-white" />
                          </div>
                        );
                      })()}
                    </>
                  ) : memoryThumbnail ? (
                    // Show default memory thumbnail
                    <ImageWithFallback
                      src={memoryThumbnail}
                      alt={memoryTitle}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      fallback={
                        <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: profileColor }}>
                          <span className="text-white font-bold text-lg uppercase">{userInitial}</span>
                        </div>
                      }
                    />
                  ) : (
                    <div className="w-12 h-12 bg-[#7B68EE] rounded-lg flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-6 h-6 text-white" />
                    </div>
                  )}

                  {/* Memory Details or Selected Image Details */}
                  <div className="flex-1 min-w-0">
                    {selectedParentImageId ? (
                      // Show selected image details
                      <>
                        {(() => {
                          const selectedImage = memoryImages.find(img => img.id === selectedParentImageId);
                          return selectedImage ? (
                            <>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-gray-900 truncate">{selectedImage.title || 'Untitled'}</h3>
                                {selectedImage.subImages && selectedImage.subImages.length > 0 && (
                                  <span className="text-xs text-gray-500">
                                    • {selectedImage.subImages.length} sub-image{selectedImage.subImages.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">Selected</p>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-gray-900 truncate">{memoryTitle}</h3>
                                <span className="text-xs text-gray-500">
                                  • {memoryImages.reduce((total, img) => total + 1 + (img.subImages?.length || 0), 0)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                {memoryCreatedDate ? new Date(memoryCreatedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'No date'}
                              </p>
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      // Show default memory details
                      <>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{memoryTitle}</h3>
                          <span className="text-xs text-gray-500">
                            • {memoryImages.reduce((total, img) => total + 1 + (img.subImages?.length || 0), 0)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {memoryCreatedDate ? new Date(memoryCreatedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'No date'}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Chevron indicator */}
                  <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isMemoryDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Dropdown content - showing hierarchy */}
              {isMemoryDropdownOpen && (
                <div className="mt-2 border border-gray-200 rounded-lg p-3 bg-white max-h-64 overflow-y-auto">
                  {memoryImages.length > 0 ? (
                    <div className="space-y-2">
                      {memoryImages.map((image) => (
                        <div key={image.id} className="space-y-1">
                          {/* Parent Image - Clickable */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedParentImageId(image.id);
                              setIsMemoryDropdownOpen(false);
                              console.log('✅ Selected parent image:', image.id);
                            }}
                            className={`w-full flex items-center gap-2 p-2 rounded transition-colors ${
                              selectedParentImageId === image.id
                                ? 'bg-[#7B68EE]/10 border-2 border-[#7B68EE]'
                                : 'hover:bg-gray-50 border-2 border-transparent'
                            }`}
                          >
                            <ImageWithFallback
                              src={image.src}
                              alt={image.title || 'Image'}
                              className="w-10 h-10 object-cover rounded"
                              fallback={
                                <div className="w-10 h-10 rounded flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: profileColor }}>
                                  <span className="text-white font-bold text-sm uppercase">{userInitial}</span>
                                </div>
                              }
                            />
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
                            {selectedParentImageId === image.id && (
                              <CheckCircle className="w-5 h-5 text-[#7B68EE] flex-shrink-0" />
                            )}
                          </button>

                          {/* Sub-images (non-clickable, indented) */}
                          {image.subImages && image.subImages.length > 0 && (
                            <div className="ml-6 space-y-1">
                              {image.subImages.map((subImage) => (
                                <div
                                  key={subImage.id}
                                  className="flex items-center gap-2 p-2 rounded opacity-60 cursor-not-allowed"
                                >
                                  <ImageWithFallback
                                    src={subImage.src}
                                    alt={subImage.title || 'Sub-image'}
                                    className="w-8 h-8 object-cover rounded"
                                    fallback={
                                      <div className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: profileColor }}>
                                        <span className="text-white font-bold text-xs uppercase">{userInitial}</span>
                                      </div>
                                    }
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-700 truncate">
                                      {subImage.title || 'Untitled sub-image'}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-4">
                      No images in this campaign yet
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Add Title Section */}
          <div>
            <label className="flex items-center gap-2 text-[14px] md:text-sm font-medium text-gray-700 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={imageDetails[selectedImageIndex]?.showTitleInput || false}
                onChange={(e) => {
                  setImageDetails(prev => ({
                    ...prev,
                    [selectedImageIndex]: {
                      ...prev[selectedImageIndex],
                      description: prev[selectedImageIndex]?.description || '',
                      date: prev[selectedImageIndex]?.date || new Date().toISOString().split('T')[0],
                      location: prev[selectedImageIndex]?.location || memoryLocation || '',
                      showTitleInput: e.target.checked,
                      title: e.target.checked ? (prev[selectedImageIndex]?.title || '') : undefined
                    }
                  }));
                }}
                className="w-4 h-4 rounded border-gray-300 text-[#7B68EE] focus:ring-[#7B68EE] focus:ring-offset-0 cursor-pointer"
              />
              <Type className="w-4 h-4" />
              <span>Add a title</span>
              <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>

            {imageDetails[selectedImageIndex]?.showTitleInput && (
              <input
                type="text"
                value={imageDetails[selectedImageIndex]?.title || ''}
                onChange={(e) => setImageDetails(prev => ({
                  ...prev,
                  [selectedImageIndex]: {
                    ...prev[selectedImageIndex],
                    description: prev[selectedImageIndex]?.description || '',
                    date: prev[selectedImageIndex]?.date || new Date().toISOString().split('T')[0],
                    location: prev[selectedImageIndex]?.location || memoryLocation || '',
                    showTitleInput: true,
                    title: e.target.value
                  }
                }))}
                placeholder="Add a short title"
                className="w-full p-3 text-[14px] md:text-sm rounded-lg bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7B68EE]/20 focus:border-[#7B68EE]/30 placeholder:text-gray-400"
              />
            )}
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-[14px] md:text-sm font-medium text-gray-700">
                <AlignLeft className="w-4 h-4" />
                Description
              </label>
              {/* AI Suggest Button */}
              <Button
                ref={aiSuggestButtonRef}
                variant="ghost"
                size="sm"
                onClick={handleAISuggest}
                disabled={isAISuggesting || !imagePreviews[selectedImageIndex]}
                className="text-sm h-auto p-0 font-normal flex items-center gap-1.5 hover:bg-transparent"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles w-4 h-4 mr-2 flex-shrink-0"
                  style={{ color: 'rgb(108, 96, 255)' }}>
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
                  <path d="M20 3v4"></path>
                  <path d="M22 5h-4"></path>
                  <path d="M4 17v2"></path>
                  <path d="M5 18H3"></path>
                </svg>
                <span
                  style={{
                    background: 'linear-gradient(90deg, rgb(108, 96, 255) 0%, rgb(255, 81, 226) 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  {isAISuggesting ? 'Suggesting...' : 'AI suggest'}
                </span>
              </Button>
            </div>
            <textarea
              value={imageDetails[selectedImageIndex]?.description || ''}
              onChange={(e) => setImageDetails(prev => ({
                ...prev,
                [selectedImageIndex]: {
                  ...prev[selectedImageIndex],
                  description: e.target.value,
                  date: prev[selectedImageIndex]?.date || new Date().toISOString().split('T')[0],
                  location: prev[selectedImageIndex]?.location || memoryLocation || ''
                }
              }))}
              placeholder="Describe this moment in detail..."
              className="w-full p-3 text-[14px] md:text-sm rounded-lg resize-none h-28 bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7B68EE]/20 focus:border-[#7B68EE]/30 placeholder:text-gray-400"
            />
          </div>

          {/* Date */}
          <div>
            <label className="flex items-center gap-2 text-[14px] md:text-sm font-medium text-gray-700 mb-2">
              <CalendarIcon className="w-4 h-4" />
              Date
            </label>
            <Popover modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full flex-row-reverse md:flex-row justify-end md:justify-start text-left font-normal p-3 text-sm border border-gray-200 rounded-lg bg-gray-100 hover:bg-gray-50 focus:outline-none focus:ring-0 focus:border-gray-200"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {imageDetails[selectedImageIndex]?.date
                    ? format(new Date(imageDetails[selectedImageIndex].date), "yyyy-MM-dd")
                    : format(new Date(), "yyyy-MM-dd")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white border border-gray-200 shadow-lg z-[100001]" align="start" sideOffset={5}>
                <Calendar
                  mode="single"
                  selected={imageDetails[selectedImageIndex]?.date
                    ? new Date(imageDetails[selectedImageIndex].date)
                    : new Date()}
                  onSelect={(date) => {
                    if (date) {
                      setImageDetails(prev => ({
                        ...prev,
                        [selectedImageIndex]: {
                          ...prev[selectedImageIndex],
                          description: prev[selectedImageIndex]?.description || '',
                          date: format(date, 'yyyy-MM-dd'),
                          location: prev[selectedImageIndex]?.location || ''
                        }
                      }))
                    }
                  }}
                  captionLayout="dropdown-buttons"
                  fromYear={1900}
                  toYear={new Date().getFullYear()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Location */}
          <div>
            <label className="flex items-center gap-2 text-[14px] md:text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4" />
              Location
              <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>
            <GooglePlacesInput
              value={
                (imageDetails[selectedImageIndex]?.location && imageDetails[selectedImageIndex].location.trim() !== '')
                  ? imageDetails[selectedImageIndex].location
                  : (memoryLocation || '')
              }
              onChange={(value) => setImageDetails(prev => ({
                ...prev,
                [selectedImageIndex]: {
                  ...prev[selectedImageIndex],
                  description: prev[selectedImageIndex]?.description || '',
                  date: prev[selectedImageIndex]?.date || new Date().toISOString().split('T')[0],
                  location: value
                }
              }))}
              placeholder="Where did this happen?"
              className="w-full p-3 text-[14px] md:text-sm border border-gray-200 rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#7B68EE]/20 focus:border-[#7B68EE]/30 placeholder:text-gray-400"
              onPlaceSelect={(place) => {
                console.log('Selected place in AddMomentModal:', place);
                // You can add additional logic here when a place is selected
              }}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="flex items-center gap-2 text-[14px] md:text-sm font-medium text-gray-700 mb-2">
              <Tag className="w-4 h-4" />
              Tags
              <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={handleTagKeyPress}
                    placeholder="Add tags separated by commas (e.g. beach, summer, 2024)"
                    className="w-full bg-gray-100 border-gray-300 focus:bg-gray-100 focus:border-gray-400 h-8 text-xs py-0"
                    style={{ outline: 'none', boxShadow: 'none', border: '1px solid #d1d5db' }}
                    onFocus={(e) => { e.target.style.outline = 'none'; e.target.style.boxShadow = 'none'; e.target.style.border = '1px solid #9ca3af'; }}
                    onBlur={(e) => { e.target.style.border = '1px solid #d1d5db'; }}
                  />
                  {newTag.trim() && (() => {
                    const currentTags = imageDetails[selectedImageIndex]?.tags || [];
                    const matches = storyTags.filter(t => t.toLowerCase().includes(newTag.trim().toLowerCase()) && !currentTags.includes(t));
                    return matches.length > 0 ? (
                      <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-md mt-1 overflow-hidden">
                        {matches.slice(0, 5).map(tag => (
                          <button key={tag} type="button" onMouseDown={(e) => { e.preventDefault(); const newTags = tag.split(',').map(t => t.trim()).filter(t => t && !currentTags.includes(t)); if (newTags.length > 0) { setImageDetails(prev => ({ ...prev, [selectedImageIndex]: { ...prev[selectedImageIndex], description: prev[selectedImageIndex]?.description || '', date: prev[selectedImageIndex]?.date || new Date().toISOString().split('T')[0], location: prev[selectedImageIndex]?.location || memoryLocation || '', tags: [...currentTags, ...newTags] } })); } setNewTag(''); }} className="w-full text-left px-3 py-2 text-xs text-gray-900 hover:bg-gray-50 flex items-center gap-2">
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
                  className={`border-0 shadow-none h-8 text-xs font-medium px-3 disabled:opacity-40 disabled:cursor-not-allowed ${newTag.trim() ? 'bg-[#6C60FF] hover:bg-[#5A52E6] text-white hover:text-white' : 'bg-gray-200 hover:bg-gray-300 text-black'}`}
                >
                  Add
                </Button>
              </div>
              {(imageDetails[selectedImageIndex]?.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(imageDetails[selectedImageIndex]?.tags || []).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-gray-200 text-gray-900 text-[13px] font-normal rounded-full border border-gray-300"
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
                const currentTags = imageDetails[selectedImageIndex]?.tags || [];
                const suggestions = storyTags.filter(t => !currentTags.includes(t)).slice(0, 4);
                return suggestions.length > 0 ? (
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">Suggested</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map(tag => (
                        <button key={tag} type="button" onClick={() => { if (!currentTags.includes(tag)) { setImageDetails(prev => ({ ...prev, [selectedImageIndex]: { ...prev[selectedImageIndex], description: prev[selectedImageIndex]?.description || '', date: prev[selectedImageIndex]?.date || new Date().toISOString().split('T')[0], location: prev[selectedImageIndex]?.location || memoryLocation || '', tags: [...currentTags, tag] } })); } }} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[13px] bg-gray-100 text-gray-700 rounded-full border border-gray-200 hover:bg-gray-200 transition-colors">
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
        <div className="flex items-center justify-end md:justify-between p-4 pb-[50px] md:pb-4 border-t border-gray-100 flex-shrink-0 gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="h-12 md:h-10 px-6 text-[14px] md:text-sm font-medium border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </Button>

          <div className="flex gap-2">
            {totalImagesCount > 1 && (
              <Button
                type="button"
                onClick={() => {
                  // Cycle back to first image after last
                  if (selectedImageIndex === totalImagesCount - 1) {
                    setSelectedImageIndex(0);
                  } else {
                    setSelectedImageIndex(selectedImageIndex + 1);
                  }
                }}
                className="h-12 md:h-10 px-6 text-[14px] md:text-sm font-medium bg-[#7B68EE] hover:bg-[#6B5DD3] text-white"
              >
                Next
              </Button>
            )}

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-12 md:h-10 px-6 text-[14px] md:text-sm font-medium bg-[#7B68EE] hover:bg-[#6B5DD3] text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Add all ({totalImagesCount})
                </>
              )}
            </Button>
          </div>
        </div>
        </div>
      </div>

      {/* Tone Selection Modal */}
      <ToneSelectionModal
        isOpen={isToneModalOpen}
        onClose={() => setIsToneModalOpen(false)}
        onToneSelect={handleToneSelect}
        buttonRef={aiSuggestButtonRef}
      />

      {/* AI Suggestion Modal */}
      <AISuggestionModal
        isOpen={isSuggestionModalOpen}
        onClose={() => {
          setIsSuggestionModalOpen(false);
          setCurrentSuggestion('');
        }}
        onAccept={handleAcceptSuggestion}
        onRetry={handleRetrySuggestion}
        suggestion={currentSuggestion}
        isRetrying={isRetrying}
      />
    </>
  );
}