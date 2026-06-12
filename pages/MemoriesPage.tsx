"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { flushSync } from "react-dom";
import { ChevronDown, ChevronUp, MoreHorizontal, MoreVertical, Search, Filter, ArrowUpDown, Plus, Grid3X3, List, X, Image as ImageIcon, Globe, Pencil, Tag, Copy, GitMerge, Trash2, Sparkles, Calendar, ChevronLeft, BookOpen, ArrowLeft, Share2, QrCode, Mail, Facebook, Linkedin, Instagram, Zap } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast as sonnerToast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import MemoryCard from "../components/MemoryCard";
import CreateMemory, { CreateMemoryHandle } from "../components/CreateMemory";
import { dashboardAPI, isPartialAdmin, apiRequest } from '../utils/authUtils';
import { aiCreditsAPI } from '../services/aiCreditsAPI';
import { mediaAPI } from '../services/mediaAPI';
import { useAuth } from '../contexts/AuthContext';
import { useProperty } from '../contexts/PropertyContext';
import { useMemoryLimit, recheckMemoryLimit } from '../hooks/useMemoryLimit';
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import EmptyMemoriesState from "../components/EmptyMemoriesState";
import AllMemoriesEmptyState from "../components/AllMemoriesEmptyState";
import MemoryActionMenu from "../components/MemoryActionMenu";
import { MemoryLimitDialog } from "../components/MemoryLimitDialog";
import { useNotificationsRefresh } from '../hooks/useNotificationsRefresh';
import CategoryNav from "../components/CategoryNav";
import { memoryCountsManager } from '../hooks/useMemoryCounts';
import PublishMemoriesModal from "../components/PublishMemoriesModal";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import AddTagsModal from "../components/AddTagsModal";
import MergeStoriesModal from "../components/MergeStoriesModal";
const imgSunnyBeach = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop';

interface ApiMemory {
  id: number;
  title: string;
  description: string | null;
  notification_id?: string | number; // For invited memories
  category: {
    id: number;
    name: string;
    color: string;
    badge_style: {
      bg: string;
      text: string;
      hex_color: string;
    };
  };
  sub_category: {
    id: number;
    name: string;
  } | null;
  suggested_category?: {
    id: number;
    name: string;
    color?: string;
  } | null;
  author: {
    id: number;
    name: string;
    email: string;
    avatar: string | null;
    initials: string;
  };
  collaborators: any[];
  collaborators_count: number;
  photos: {
    count: number;
    preview_images: {
      id: number;
      url: string;
      type: string;
    }[];
  };
  dates: {
    start_date: string;
    end_date: string;
    formatted_range: string;
  };
  location: {
    city: string | null;
    state: string | null;
    country: string | null;
    formatted: string | null;
  };
  published: any;
  created_at: string;
  last_updated: string;
  tags?: { id: number; name: string }[];
}

interface Memory {
  id: string;
  category: string;
  author: string;
  label: string;
  tags: string[];
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
    tags: [],
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
    tags: [],
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
    tags: [],
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
    tags: [],
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
    tags: [],
    photos: 42,
    title: "Corporate Team Building - Toronto Office",
    startDate: "Sep 10/24",
    endDate: "Sep 12/24",
    lastVisited: "1 day ago",
    isSelected: false
  },
  {
    id: "6",
    category: "BC",
    author: "Emma Wilson",
    label: "Travel",
    tags: [],
    photos: 18,
    title: "Whistler Skiing Adventure",
    startDate: "Feb 05/24",
    endDate: "Feb 12/24",
    lastVisited: "2 weeks ago",
    isSelected: false
  },
  {
    id: "7",
    category: "Alberta",
    author: "David Smith",
    label: "Events",
    tags: [],
    photos: 31,
    title: "Calgary Stampede Experience",
    startDate: "Jul 08/24",
    endDate: "Jul 17/24",
    lastVisited: "1 month ago",
    isSelected: false
  },
  {
    id: "8",
    category: "Ontario",
    author: "Lisa Brown",
    label: "Family",
    tags: [],
    photos: 22,
    title: "Niagara Falls Family Trip",
    startDate: "May 20/24",
    endDate: "May 23/24",
    lastVisited: "6 days ago",
    isSelected: false
  }
];

const authors = ["All Authors", "PedalHeads", "Sarah Johnson", "Mike Chen", "Emma Wilson", "David Smith", "Lisa Brown"];
const labels = ["All Labels", "Mexico", "Family", "Corporate", "Travel", "Events"];

interface SortConfig {
  key: keyof Memory | null;
  direction: 'asc' | 'desc';
}

interface MediaMemory {
  id: string;
  title: string;
  category: string;
  labels?: string[];
  thumbnail: string;
  imageCount: number;
  date: string;
  type: 'personal' | 'shared';
  author?: string;
  images?: any[];
}

interface Category {
  name: string;
  count: number;
  isUserCreated?: boolean;
  color?: string;
}

interface MemoriesPageProps {
  onMemorySelect: (memoryId: string, options?: boolean | string | { openComments?: boolean; commentId?: string; openImageModal?: boolean; imageId?: string | number; openModerationTab?: boolean; openCollaboratorsTab?: boolean }) => void;
  selectedCategory?: string | null;
  onCategorySelect?: (categoryName: string | null) => void;
  memories?: MediaMemory[];
  categories?: Category[];
  apiMemoriesData?: any;
  isLoadingMemories?: boolean;
  onRefreshMemories?: () => void;
  expandedCategories?: string[]; // Categories that are expanded in sidebar
  onNavigate?: (page: string) => void;
  showMobileSidebar?: boolean;
  onCloseMobileSidebar?: () => void;
  onToggleMobileSidebar?: () => void;
  createMemoryTrigger?: { category?: string; timestamp: number } | null;
  onClearCreateMemoryTrigger?: () => void;
  onPublishedEntryViewChange?: (isViewing: boolean) => void;
  onAIWizardProgress?: (progress: number) => void;
  onAIWizardDone?: () => void;
}

function MemoriesPageContent({
  onMemorySelect,
  selectedCategory,
  onCategorySelect,
  memories: propMemories = [],
  categories = [],
  apiMemoriesData,
  isLoadingMemories = false,
  onRefreshMemories,
  expandedCategories = [],
  onNavigate,
  showMobileSidebar = false,
  onCloseMobileSidebar,
  onToggleMobileSidebar,
  createMemoryTrigger,
  onClearCreateMemoryTrigger,
  onPublishedEntryViewChange,
  onAIWizardProgress,
  onAIWizardDone,
}: MemoriesPageProps) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { viewType, currentProperty, switchToProperty } = useProperty();
  const { isLimitExceeded, isAdminLimitExceeded, isServiceSyncLimitExceeded, isAICreditsExceeded, limitData, adminLimitData, serviceSyncLimitData, pendingPropertiesCount, checkLimit } = useMemoryLimit();
  const triggerNotificationsRefresh = useNotificationsRefresh();

  // Check if user is property owner (admin) or visitor (read-only)
  const isPropertyOwner = useMemo(() => {
    if (isPartialAdmin()) return false; // Partial admin - restricted access
    if (viewType === 'personal') return true; // Personal account - full access
    if (!currentProperty || !user) return false; // No property or user - no access
    return currentProperty.user_id === user.external_user_id; // Check if user's external_user_id matches property user_id
  }, [viewType, currentProperty, user]);

  console.log('🔐 Access Control:', {
    viewType,
    currentPropertyId: currentProperty?.id,
    currentPropertyOwnerId: currentProperty?.user_id,
    userId: user?.id,
    userExternalUserId: user?.external_user_id,
    isPropertyOwner,
    accessLevel: isPropertyOwner ? 'ADMIN (Full Access)' : 'VISITOR (Read-Only)'
  });

  // View mode and filter states
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterTab, setSelectedFilterTab] = useState('All Categories');
  const [showCreateMemory, setShowCreateMemory] = useState(false);
  const createMemoryRef = useRef<CreateMemoryHandle>(null);
  const proxyInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategoryForCreate, setSelectedCategoryForCreate] = useState<string | undefined>(undefined);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [memoryToDelete, setMemoryToDelete] = useState<any>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishedEntryData, setPublishedEntryData] = useState<any>(null);
  const [showAuthorPopover, setShowAuthorPopover] = useState(false);
  const [selectedPublishedEntry, setSelectedPublishedEntry] = useState<any>(null);
  const [isLoadingPublishedEntry, setIsLoadingPublishedEntry] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [shouldOpenLatestPublished, setShouldOpenLatestPublished] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrShareUrl, setQrShareUrl] = useState('');
  const [showAddTagsModal, setShowAddTagsModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [editActionLoading, setEditActionLoading] = useState(false);

  // AI credits modal state
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
  const [availableCredits, setAvailableCredits] = useState(0);

  // AI Campaign Wizard state
  const [isAIResultsModalOpen, setIsAIResultsModalOpen] = useState(false);
  const [selectedAnalysisOption, setSelectedAnalysisOption] = useState<number | null>(null);
  const [aiActiveTab, setAiActiveTab] = useState<'suggestions' | 'prompt'>('suggestions');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGeneratingFromPrompt, setIsGeneratingFromPrompt] = useState(false);
  const [isApplyingTask, setIsApplyingTask] = useState(false);
  const [aiWizardProgress, setAiWizardProgress] = useState(0);
  const [isAIWizardModalOpen, setIsAIWizardModalOpen] = useState(false);
  const [aiWizardAnimatingOut, setAiWizardAnimatingOut] = useState(false);
  const [aiWizardMinimized, setAiWizardMinimized] = useState(false);

  // Auto-minimize AI wizard modal after 20 seconds
  useEffect(() => {
    if (!isAIWizardModalOpen) {
      setAiWizardMinimized(false);
      return;
    }
    const timer = setTimeout(() => setAiWizardMinimized(true), 20000);
    return () => clearTimeout(timer);
  }, [isAIWizardModalOpen]);

  // Sync progress to sidebar when minimized
  useEffect(() => {
    if (aiWizardMinimized && isAIWizardModalOpen) {
      onAIWizardProgress?.(Math.round(aiWizardProgress));
    }
  }, [aiWizardProgress, aiWizardMinimized, isAIWizardModalOpen]);

  // Media Library states for CreateMemory
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [mediaLibrarySearchTerm, setMediaLibrarySearchTerm] = useState("");
  const [mediaLibraryCategory, setMediaLibraryCategory] = useState("All Categories");
  const [mediaLibrarySelectedItems, setMediaLibrarySelectedItems] = useState<string[]>([]);
  const [allMediaLibraryImages, setAllMediaLibraryImages] = useState<any[]>([]);
  const [isLoadingMediaLibrary, setIsLoadingMediaLibrary] = useState(false);
  const [mediaLibraryCategories, setMediaLibraryCategories] = useState<string[]>([]);
  const [selectedMediaLibraryImagesForCreate, setSelectedMediaLibraryImagesForCreate] = useState<any[]>([]);

  // Loading states for accept/reject actions
  const [loadingMemoryActions, setLoadingMemoryActions] = useState<Record<string, boolean>>({});

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Clear selected category when switching to list view
  useEffect(() => {
    if (viewMode === 'list' && selectedCategory && onCategorySelect) {
      onCategorySelect(null);
    }
  }, [viewMode, selectedCategory, onCategorySelect]);

  // Fetch all media library images when modal opens
  useEffect(() => {
    if (isMediaLibraryOpen && allMediaLibraryImages.length === 0) {
      fetchAllMediaLibraryImages();
    }
  }, [isMediaLibraryOpen]);

  // Clear selected media library images when CreateMemory modal closes
  useEffect(() => {
    if (!showCreateMemory && selectedMediaLibraryImagesForCreate.length > 0) {
      console.log('🧹 Clearing selected media library images after modal close');
      setSelectedMediaLibraryImagesForCreate([]);
    }
  }, [showCreateMemory]);

  // Watch for create memory trigger from CategoryNav in App.tsx
  useEffect(() => {
    if (createMemoryTrigger) {
      console.log('🎯 Create memory trigger received:', createMemoryTrigger);
      handleCreateMemory(createMemoryTrigger.category);
      // Clear the trigger after handling it to prevent re-opening on navigation
      if (onClearCreateMemoryTrigger) {
        onClearCreateMemoryTrigger();
      }
    }
  }, [createMemoryTrigger]);

  // Restore author collection view when user navigates back from PublishedMemoryPage
  useEffect(() => {
    const saved = sessionStorage.getItem('restorePublishedEntry');
    if (saved) {
      try {
        const { publishedEntryData: savedData, selectedPublishedEntry: savedEntry } = JSON.parse(saved);
        sessionStorage.removeItem('restorePublishedEntry');
        if (savedData) {
          setPublishedEntryData(savedData);
          setSelectedPublishedEntry(savedEntry);
        }
      } catch (e) {
        sessionStorage.removeItem('restorePublishedEntry');
      }
    }
  }, []);

  // Notify App.tsx when entering/leaving published entry view (to hide sub-sidebar)
  // Also scroll to top when entering the view
  useEffect(() => {
    onPublishedEntryViewChange?.(!!publishedEntryData);
    if (publishedEntryData) {
      window.scrollTo(0, 0);
    }
  }, [publishedEntryData]);

  // Check for pending property switch after login
  useEffect(() => {
    const checkPendingPropertySwitch = async () => {
      const pendingPropertySwitch = localStorage.getItem('pending_property_switch');

      if (pendingPropertySwitch && isAuthenticated && !authLoading) {
        console.log('🏠 MemoriesPage: Found pending property switch flag:', pendingPropertySwitch);

        try {
          // Add a small delay to ensure user data is fully loaded
          await new Promise(resolve => setTimeout(resolve, 500));

          // Fetch properties from API
          console.log('🏠 MemoriesPage: Fetching properties from API...');
          const propertiesResponse = await dashboardAPI.getProperties();
          console.log('🏠 MemoriesPage: Properties API response:', propertiesResponse);

          if (propertiesResponse.success && propertiesResponse.data) {
            const d = propertiesResponse.data.data || propertiesResponse.data;
            const allProperties = [
              ...(d.owned_properties || []),
              ...(d.shared_properties || []),
              ...(d.all_properties || d.properties || [])
            ];
            console.log('🏠 MemoriesPage: All properties count:', allProperties.length);
            console.log('🏠 MemoriesPage: All properties:', allProperties);

            if (pendingPropertySwitch === 'first') {
              // Switch to the FIRST property from the list
              console.log('🏠 MemoriesPage: Property mode enabled, switching to first property...');

              const validProperties = allProperties.filter((p: any) => p != null);
              if (validProperties.length > 0) {
                const firstProperty = validProperties[0];
                console.log('🏠 MemoriesPage: First property:', firstProperty);
                console.log('🏠 MemoriesPage: Switching to property:', firstProperty.name);

                switchToProperty(firstProperty);

                // Clear the pending flag
                localStorage.removeItem('pending_property_switch');
                console.log('🏠 MemoriesPage: Property switch completed and flag cleared');
              } else {
                console.error('🏠 MemoriesPage: No properties found for this user');
                console.error('🏠 MemoriesPage: User might not have access to any properties yet');
                // Don't clear the flag - maybe retry later
              }
            } else {
              // Legacy support: if it's a specific property ID
              const selectedProperty = allProperties.find((prop: any) => String(prop.id) === String(pendingPropertySwitch));

              if (selectedProperty) {
                console.log('🏠 MemoriesPage: Switching to property ID:', pendingPropertySwitch);
                switchToProperty(selectedProperty);
                localStorage.removeItem('pending_property_switch');
                console.log('🏠 MemoriesPage: Property switch completed and flag cleared');
              } else {
                console.error('🏠 MemoriesPage: Property ID', pendingPropertySwitch, 'not found');
              }
            }
          } else {
            console.error('🏠 MemoriesPage: Failed to fetch properties:', propertiesResponse);
            // Don't clear the flag - retry later
          }
        } catch (error) {
          console.error('🏠 MemoriesPage: Error during property switch:', error);
          // Don't clear the flag - retry later
        }
      } else {
        if (pendingPropertySwitch) {
          console.log('🏠 MemoriesPage: Pending property switch exists but waiting for auth:', {
            pendingPropertySwitch,
            isAuthenticated,
            authLoading
          });
        }
      }
    };

    checkPendingPropertySwitch();
  }, [isAuthenticated, authLoading, switchToProperty]);

  const fetchAllMediaLibraryImages = async () => {
    setIsLoadingMediaLibrary(true);
    try {
      const response = await mediaAPI.getMemoryImages();
      if (response?.success && response.data) {
        const memoriesData = response.data.memories || response.data.data?.memories || [];
        const allImages: any[] = [];
        const categoriesSet = new Set<string>();

        memoriesData.forEach((memory: any) => {
          const memoryCategory = memory.category?.name || memory.property_category?.name || 'Unknown';
          categoriesSet.add(memoryCategory);

          if (memory.images && Array.isArray(memory.images)) {
            memory.images.forEach((img: any) => {
              allImages.push({
                ...img,
                memory_id: memory.id,
                memory_title: memory.title,
                memory_category: memoryCategory
              });
            });
          }
        });

        setAllMediaLibraryImages(allImages);
        setMediaLibraryCategories(Array.from(categoriesSet).sort());
        console.log('Fetched all media library images:', allImages.length);
      }
    } catch (error) {
      console.error('Error fetching media library images:', error);
    } finally {
      setIsLoadingMediaLibrary(false);
    }
  };

  // Filter media library images based on search and category
  const filteredMediaLibraryImages = useMemo(() => {
    let filtered = allMediaLibraryImages;

    // Filter by category
    if (mediaLibraryCategory !== "All Categories") {
      filtered = filtered.filter(img => img.memory_category === mediaLibraryCategory);
    }

    // Filter by search term
    if (mediaLibrarySearchTerm.trim()) {
      const searchLower = mediaLibrarySearchTerm.toLowerCase();
      filtered = filtered.filter(img =>
        img.name?.toLowerCase().includes(searchLower) ||
        img.memory_title?.toLowerCase().includes(searchLower) ||
        img.location?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [allMediaLibraryImages, mediaLibraryCategory, mediaLibrarySearchTerm]);

  // Extract data from API props - check both direct access and nested in .data
  const latestMemories = apiMemoriesData?.latest_memories || apiMemoriesData?.data?.latest_memories || [];
  const allMemories = apiMemoriesData?.all_memories?.data || apiMemoriesData?.data?.all_memories?.data || [];
  const sharedWithMemories = apiMemoriesData?.sharedWith || apiMemoriesData?.data?.sharedWith || [];
  const publishedEntries = apiMemoriesData?.published || apiMemoriesData?.data?.published || [];

  // After publish: auto-open the newly created published entry's detail view
  useEffect(() => {
    if (shouldOpenLatestPublished && publishedEntries.length > 0) {
      setShouldOpenLatestPublished(false);
      const latestEntry = publishedEntries[0];
      if (latestEntry?.short_url) {
        handlePublishedEntryClick(latestEntry.short_url, latestEntry);
      }
    }
  }, [shouldOpenLatestPublished, publishedEntries]);

  const sidebarData = apiMemoriesData?.sidebar || apiMemoriesData?.data?.sidebar || null;
  
  // Table-related state (only used when no category is selected)
  const [memories, setMemories] = useState<Memory[]>(mockMemories);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState("All Categories");
  const [selectedAuthor, setSelectedAuthor] = useState("All Authors");
  const [selectedLabel, setSelectedLabel] = useState("All Labels");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
  const [selectAll, setSelectAll] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Extract category names from API data, fallback to props if no API data
  const categoryNames = sidebarData?.categories?.items
    ? ["All Categories", ...sidebarData.categories.items.filter((cat: any) => cat != null).map((cat: any) => cat.name)]
    : categories && categories.length > 0
      ? ["All Categories", ...categories.filter(cat => cat != null).map(cat => cat.name)]
      : ["All Categories", "BC", "Alberta", "Ontario"];

  // Extract author names from API data
  const apiAuthors = (apiMemoriesData?.filters?.authors || apiMemoriesData?.data?.filters?.authors)
    ? ["All Authors", ...(apiMemoriesData?.filters?.authors || apiMemoriesData?.data?.filters?.authors).filter((author: any) => author != null).map((author: any) => author.name)]
    : authors;

  // Extract label names from API data
  const apiLabels = sidebarData?.labels?.items
    ? ["All Labels", ...sidebarData.labels.items.filter((label: any) => label != null).map((label: any) => label.name)]
    : labels;

  // Count published memories and update global memory counts
  useEffect(() => {
    // Only run if we have actual data loaded
    if (!apiMemoriesData) {
      console.log('⏳ [MemoriesPage] Waiting for apiMemoriesData to load...');
      return;
    }

    // Combine all memories from different sources
    const allMemoriesFromData = [
      ...(latestMemories || []),
      ...(allMemories || []),
      ...(sharedWithMemories || [])
    ];

    // Remove duplicates by id
    const uniqueMemories = Array.from(
      new Map(allMemoriesFromData.map((mem: any) => [mem.id, mem])).values()
    );

    // Only proceed if we have actual memories data
    if (uniqueMemories.length === 0) {
      console.log('⏳ [MemoriesPage] No memories loaded yet, skipping count update');
      return;
    }

    // Count published memories: Public (1) and View Only (2)
    // published values: 1 = Public (green badge), 2 = View Only (orange badge), 3 = Private
    // For Get Started, count both Public and View Only as "published"
    const publishedCount = uniqueMemories.filter((mem: any) =>
      mem.published === 1 || mem.published === 2
    ).length;

    console.log('📊 [MemoriesPage] Analyzing published memories:', {
      totalMemories: uniqueMemories.length,
      publishedCount: publishedCount,
      publicCount: uniqueMemories.filter((m: any) => m.published === 1).length,
      viewOnlyCount: uniqueMemories.filter((m: any) => m.published === 2).length,
      sampleData: uniqueMemories.slice(0, 3).map((m: any) => ({
        id: m.id,
        title: m.title,
        published: m.published,
        status: m.published === 1 ? 'Public' : m.published === 2 ? 'View Only' : 'Private'
      }))
    });

    // Get current memory counts
    const currentCounts = memoryCountsManager.getState();

    // Always update with the actual count from data (including 0)
    memoryCountsManager.updateState(
      {
        total_memories: currentCounts?.total_memories || uniqueMemories.length,
        total_memory_images: currentCounts?.total_memory_images || 0,
        published_memories: publishedCount, // Count from actual data
        total_library_people: currentCounts?.total_library_people || 0,
      },
      false,
      null
    );
    console.log('✅ [MemoriesPage] Updated published_memories count to:', publishedCount);
  }, [apiMemoriesData, latestMemories, allMemories, sharedWithMemories]);

  const filteredMemories = memories.filter(memory => {
    const matchesSearch = memory.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         memory.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         memory.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "All Categories" || memory.category === filterCategory;
    const matchesAuthor = selectedAuthor === "All Authors" || memory.author === selectedAuthor;
    const matchesLabel = selectedLabel === "All Labels" || memory.label === selectedLabel;
    
    return matchesSearch && matchesCategory && matchesAuthor && matchesLabel;
  });

  const sortedMemories = [...filteredMemories].sort((a, b) => {
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

  const handleSearch = () => {
    console.log('Search executed with query:', searchQuery);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterCategory("All Categories");
    setSelectedAuthor("All Authors");
    setSelectedLabel("All Labels");
    setSortConfig({ key: null, direction: 'asc' });
  };

  const handleCreateMemory = async (categoryName?: string) => {
    // Open modal + focus synchronously (before any await) — only way to open keyboard on iOS
    if (categoryName) {
      setSelectedCategoryForCreate(categoryName);
    } else {
      setSelectedCategoryForCreate(undefined);
    }
    proxyInputRef.current?.focus();
    flushSync(() => setShowCreateMemory(true));
    createMemoryRef.current?.focusTitle();

    // Check limit in background — close modal if exceeded
    try {
      await checkLimit();
      const response = await dashboardAPI.checkMemoryLimit();
      if (response.success && response.data) {
        const data = response.data.data || response.data;
        const limitStatus = data.limit_status || data;
        if (limitStatus.status === 'limit_exceeded') {
          setShowCreateMemory(false);
          setShowLimitDialog(true);
        }
      }
    } catch (error) {
      console.error('❌ Error checking memory limit:', error);
      // Modal stays open on error — better than silently failing
    }
  };

  const handleMemoryCreated = async () => {
    console.log('🎯 Memory created from memories page - triggering refresh');

    // Refresh memory limit state immediately after creation
    console.log('🔄 Refreshing memory limit state after creation');
    await checkLimit();
    console.log('✅ Memory limit state refreshed after creation');

    // Memory limit will be rechecked automatically by the CreateMemory component

    // Refresh memories data after creation using parent function
    if (onRefreshMemories) {
      console.log('🔄 Calling onRefreshMemories to update memories list');
      await onRefreshMemories();
      console.log('✅ Memories refresh completed');
    } else {
      console.warn('⚠️ onRefreshMemories function not provided');
    }
  };

  const handleViewDetails = (memory: any) => {
    console.log('Navigating to memory details:', memory.id);
    onMemorySelect(memory.id.toString());
  };

  const handleEditMemory = (memory: any) => {
    console.log('Opening edit for memory:', memory.id);
    // Navigate to memory details page with edit context
    onMemorySelect(memory.id.toString(), "edit" as any);
  };

  const handleDeleteMemory = (memory: any) => {
    console.log('Initiating delete for memory:', memory.id);
    setMemoryToDelete(memory);
    setShowDeleteDialog(true);
  };

  const confirmDeleteMemory = async () => {
    if (!memoryToDelete) return;

    try {
      console.log('Deleting memory:', memoryToDelete.id);
      const response = await dashboardAPI.deleteMemory(memoryToDelete.id.toString());

      if (response.success) {
        console.log('Memory deleted successfully');

        // Recheck memory limit and refresh page
        await recheckMemoryLimit();

        // Refresh the memories list
        if (onRefreshMemories) {
          console.log('🔄 Calling onRefreshMemories after memory deletion from list view');
          await onRefreshMemories();
          console.log('✅ Memory list refresh completed');
        } else {
          console.warn('⚠️ onRefreshMemories function not available');
        }

        // Also trigger memory count refresh to update sidebar
        try {
          await triggerNotificationsRefresh();
          console.log('✅ Notifications refresh completed');
        } catch (error) {
          console.error('Error refreshing notifications:', error);
        }

        // Force immediate secondary refresh for real-time updates
        console.log('🔄 Secondary refresh attempt for real-time updates');
        await checkLimit();
        if (onRefreshMemories) {
          await onRefreshMemories();
        }

        // Close dialog and reset state
        setShowDeleteDialog(false);
        setMemoryToDelete(null);

        // Show success message (you can import toast if needed)
        console.log(`Memory "${memoryToDelete.title}" deleted successfully`);
      } else {
        console.error('Failed to delete memory:', response.error);
        alert(`Failed to delete campaign: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting memory:', error);
      alert('An error occurred while deleting the campaign');
    }
  };

  const handleAcceptInvite = async (memoryId: string, notificationId?: string | number) => {
    console.log('🤝 Accepting invite for memory:', memoryId, 'notification_id:', notificationId);

    try {
      // Call API to accept invitation (status: 1) with notification_id
      const response = await dashboardAPI.actionOnInvitation(memoryId.toString(), 1, notificationId?.toString());

      if (response.success) {
        console.log('✅ Invitation accepted successfully');
        // Refresh memories to update the UI
        if (onRefreshMemories) {
          await onRefreshMemories();
        }
        // Refresh the notification list
        triggerNotificationsRefresh();

        // Navigate to the memory detail page
        onMemorySelect(memoryId.toString());
      } else {
        console.error('❌ Failed to accept invitation:', response.error);
        // Still refresh to check if there were changes
        if (onRefreshMemories) {
          await onRefreshMemories();
        }
        // Still refresh notifications to sync state
        triggerNotificationsRefresh();
      }
    } catch (error) {
      console.error('❌ Error accepting invitation:', error);
      // Still refresh to check if there were changes
      if (onRefreshMemories) {
        await onRefreshMemories();
      }
    }
  };

  const handleRejectInvite = async (memoryId: string, notificationId?: string | number) => {
    console.log('❌ Rejecting invite for memory:', memoryId, 'notification_id:', notificationId);

    try {
      // Call API to reject invitation (status: 0) with notification_id
      const response = await dashboardAPI.actionOnInvitation(memoryId.toString(), 0, notificationId?.toString());

      if (response.success) {
        console.log('✅ Invitation rejected successfully');
        // Refresh memories to update the UI
        if (onRefreshMemories) {
          await onRefreshMemories();
        }
        // Refresh the notification list
        triggerNotificationsRefresh();
      } else {
        console.error('❌ Failed to reject invitation:', response.error);
        // Still refresh to check if there were changes
        if (onRefreshMemories) {
          await onRefreshMemories();
        }
        // Still refresh notifications to sync state
        triggerNotificationsRefresh();
      }
    } catch (error) {
      console.error('❌ Error rejecting invitation:', error);
      // Still refresh to check if there were changes
      if (onRefreshMemories) {
        await onRefreshMemories();
      }
    }
  };

  const handleAcceptSuggestedCategory = async (memoryId: string) => {
    console.log('✅ Accepting suggested category for memory:', memoryId);

    // Set loading state for this specific memory
    setLoadingMemoryActions(prev => ({ ...prev, [memoryId]: true }));

    try {
      const response = await dashboardAPI.acceptSuggestedCategory(memoryId.toString());

      if (response.success) {
        console.log('✅ Suggested category accepted successfully');

        // Show success message
        setToast({
          message: response.message || 'Suggested category accepted successfully!',
          type: 'success'
        });

        // Refresh memories to update the UI
        if (onRefreshMemories) {
          await onRefreshMemories();
        }
      } else {
        console.error('❌ Failed to accept suggested category:', response.error);

        // Show error message
        setToast({
          message: response.error || 'Failed to accept suggested category',
          type: 'error'
        });

        // Still refresh to check if there were changes
        if (onRefreshMemories) {
          await onRefreshMemories();
        }
      }
    } catch (error) {
      console.error('❌ Error accepting suggested category:', error);

      // Show error message
      setToast({
        message: 'An error occurred while accepting the suggestion',
        type: 'error'
      });

      // Still refresh to check if there were changes
      if (onRefreshMemories) {
        await onRefreshMemories();
      }
    } finally {
      // Clear loading state
      setLoadingMemoryActions(prev => {
        const newState = { ...prev };
        delete newState[memoryId];
        return newState;
      });
    }
  };

  const handleRejectSuggestedCategory = async (memoryId: string) => {
    console.log('❌ Rejecting suggested category for memory:', memoryId);

    // Set loading state for this specific memory
    setLoadingMemoryActions(prev => ({ ...prev, [memoryId]: true }));

    try {
      const response = await dashboardAPI.rejectSuggestedCategory(memoryId.toString());

      if (response.success) {
        console.log('✅ Suggested category rejected successfully');

        // Show success message
        setToast({
          message: response.message || 'Suggested category rejected successfully',
          type: 'success'
        });

        // Refresh memories to update the UI
        if (onRefreshMemories) {
          await onRefreshMemories();
        }
      } else {
        console.error('❌ Failed to reject suggested category:', response.error);

        // Show error message
        setToast({
          message: response.error || 'Failed to reject suggested category',
          type: 'error'
        });

        // Still refresh to check if there were changes
        if (onRefreshMemories) {
          await onRefreshMemories();
        }
      }
    } catch (error) {
      console.error('❌ Error rejecting suggested category:', error);

      // Show error message
      setToast({
        message: 'An error occurred while rejecting the suggestion',
        type: 'error'
      });

      // Still refresh to check if there were changes
      if (onRefreshMemories) {
        await onRefreshMemories();
      }
    } finally {
      // Clear loading state
      setLoadingMemoryActions(prev => {
        const newState = { ...prev };
        delete newState[memoryId];
        return newState;
      });
    }
  };

  // Handle add tags to selected campaigns
  const handleAddTags = async (tags: string[]) => {
    const ids = Array.from(selectedCardIds);
    const response = await dashboardAPI.addTagsToMemories(ids, tags);
    if (response.success) {
      setToast({ message: 'Tags added successfully', type: 'success' });
      setSelectedCardIds(new Set());
      setIsEditMode(false);
      if (onRefreshMemories) await onRefreshMemories();
    } else {
      throw new Error(response.error || 'Failed to add tags');
    }
  };

  // Handle merge selected campaigns
  const handleMergeStories = async (title: string, deleteOnMerge: boolean) => {
    const ids = Array.from(selectedCardIds);
    const response = await dashboardAPI.mergeMemories(ids, title, deleteOnMerge);
    if (response.success) {
      setToast({ message: 'Campaigns merged successfully', type: 'success' });
      // Delay reset until after modal close animation finishes
      setTimeout(() => {
        setSelectedCardIds(new Set());
        setIsEditMode(false);
      }, 300);
      if (onRefreshMemories) await onRefreshMemories();
    } else {
      throw new Error(response.error || 'Failed to merge campaigns');
    }
  };

  // Handle duplicate selected campaigns
  const handleDuplicate = async () => {
    const ids = Array.from(selectedCardIds);
    if (ids.length === 0) return;
    setEditActionLoading(true);
    try {
      await Promise.all(ids.map(id => dashboardAPI.duplicateMemory(id)));
      setToast({ message: `${ids.length} ${ids.length === 1 ? 'campaign' : 'campaigns'} duplicated`, type: 'success' });
      setSelectedCardIds(new Set());
      setIsEditMode(false);
      if (onRefreshMemories) await onRefreshMemories();
    } catch {
      setToast({ message: 'Failed to duplicate campaigns', type: 'error' });
    } finally {
      setEditActionLoading(false);
    }
  };

  // Handle delete selected campaigns
  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedCardIds);
    if (ids.length === 0) return;
    setEditActionLoading(true);
    try {
      await Promise.all(ids.map(id => dashboardAPI.deleteMemory(id)));
      setToast({ message: `${ids.length} ${ids.length === 1 ? 'campaign' : 'campaigns'} deleted`, type: 'success' });
      setSelectedCardIds(new Set());
      setIsEditMode(false);
      await recheckMemoryLimit();
      if (onRefreshMemories) await onRefreshMemories();
    } catch {
      setToast({ message: 'Failed to delete campaigns', type: 'error' });
    } finally {
      setEditActionLoading(false);
    }
  };

  // Handle publish memories
  const handlePublishMemories = async (selectedMemoryIds: number[], visibility: string, wallpaperBase64: string | null) => {
    console.log('📤 Publishing memories as author:', { selectedMemoryIds, visibility, hasWallpaper: !!wallpaperBase64 });

    try {
      // Call POST /memories/publish with all selected memory IDs at once
      const response = await dashboardAPI.publishMemoryAsAuthor(selectedMemoryIds, visibility, wallpaperBase64);

      console.log('📤 Publish response:', response);

      if (response.success) {
        setToast({
          message: response.data?.message || `Successfully published ${selectedMemoryIds.length} ${selectedMemoryIds.length === 1 ? 'memory' : 'memories'}`,
          type: 'success'
        });

        // Close publish modal
        setShowPublishModal(false);

        // Refresh memories to get the newly created published entry
        if (onRefreshMemories) {
          await onRefreshMemories();
        }

        // Auto-open the latest published entry's detail view (author campaigns list)
        setShouldOpenLatestPublished(true);
      } else {
        throw new Error(response.error || 'Failed to publish memories');
      }
    } catch (error) {
      console.error('❌ Error publishing memories:', error);
      setToast({
        message: 'Failed to publish memories',
        type: 'error'
      });
    }
  };

  // Handle click on published author card — fetch short_url
  const handlePublishedEntryClick = async (shortUrl: string, entry: any) => {
    setSelectedPublishedEntry(entry);
    setIsLoadingPublishedEntry(true);
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const response = await fetch(shortUrl, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      const data = await response.json();
      console.log('📖 Published entry data:', data);
      setPublishedEntryData(data);
    } catch (error) {
      console.error('❌ Error fetching published entry:', error);
    } finally {
      setIsLoadingPublishedEntry(false);
    }
  };

  // Transform all memories data to table format for compatibility
  useEffect(() => {
    // Combine all memories including sharedWith for list view
    const memoriesToTransform = [
      ...(allMemories || []),
      ...(latestMemories || []),
      ...(sharedWithMemories.map(mem => ({...mem, category: {name: 'Shared With', ...mem.category}})) || []),
      ...(propMemories || [])
    ].filter((memory, index, arr) => 
      // Remove duplicates based on memory id
      arr.findIndex(m => m.id === memory.id) === index
    );
        
    if (memoriesToTransform.length > 0) {
      const transformedMemories = memoriesToTransform.map((mem: any) => {
        // Check if this is a shared memory from the sharedWith array
        const isFromSharedWith = sharedWithMemories.some(shared => shared.id === mem.id);
        
        return {
          id: mem.id?.toString() || Math.random().toString(),
          category: isFromSharedWith ? 'Shared With' : (mem.category?.name || mem.category || 'Unknown'),
          author: mem.author?.name || mem.author || 'Unknown',
          label: mem.sub_category?.name || (typeof mem.label === 'object' ? mem.label?.name : mem.label) || '',
          tags: Array.isArray(mem.tags) ? mem.tags.map((t: any) => typeof t === 'string' ? t : t.name).filter(Boolean) : [],
          photos: mem.photos?.count || mem.photos_count || mem.media_count || 0,
          title: mem.title || 'Untitled',
          startDate: mem.dates?.start_date || mem.starting_date || mem.start_date || '',
          endDate: mem.dates?.end_date || mem.ending_date || mem.end_date || '',
          lastVisited: mem.last_updated || mem.last_visited || 'Never',
          isSelected: false
        };
      });
      setMemories(transformedMemories);
    } else {
      // Clear memories when no data is available
      setMemories([]);
    }
  }, [allMemories, latestMemories, sharedWithMemories, propMemories]);

  const SortButton = ({ column, children }: { column: keyof Memory, children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(column)}
      className="flex items-center gap-1 hover:text-[#6C60FF] transition-colors font-medium"
    >
      {children}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  // Filter memories based on selected category or label from CategoryNav
  // Use ALL memories (not just latest) when filtering by category
  const memoriesToFilter = allMemories.length > 0 ? allMemories : (latestMemories.length > 0 ? latestMemories : propMemories);
  console.log('Latest Memories count:', latestMemories.length);
  console.log('Memories to filter count:', memoriesToFilter.length);
  console.log('Using data source:', allMemories.length > 0 ? 'allMemories' : (latestMemories.length > 0 ? 'latestMemories' : 'propMemories'));
  console.log('Full API Memories Data structure:', apiMemoriesData);
  if (selectedCategory) {
    console.log('Sidebar categories:', sidebarData?.categories?.items);
    const selectedCategoryData = sidebarData?.categories?.items?.find((cat: any) => cat?.name === selectedCategory);
    console.log('Selected category data from sidebar:', selectedCategoryData);
    console.log('Expected memories count from sidebar:', selectedCategoryData?.count);
  }
  
  const filteredCategoryMemories = selectedCategory 
    ? memoriesToFilter.filter(memory => {
        console.log('Filtering memory:', memory.title);
        console.log('Selected category:', selectedCategory);
        console.log('Memory category:', memory.category?.name);
        console.log('Memory label:', memory.label);
        console.log('Memory sub_category:', memory.sub_category?.name);
        
        // Check if it's a category from sidebar categories
        const sidebarCategory = sidebarData?.categories?.items?.find((cat: any) => cat?.name === selectedCategory);
        console.log('Sidebar category found:', sidebarCategory);
        
        if (sidebarCategory) {
          // It's a category filter - check exact category name match
          const matchesCategory = memory.category?.name === selectedCategory || memory.category === selectedCategory;
          console.log('Matches category:', matchesCategory);
          return matchesCategory;
        }
        
        // Check if it's a label from sidebar labels
        const sidebarLabel = sidebarData?.labels?.items?.find((label: any) => label?.name === selectedCategory);
        console.log('Sidebar label found:', sidebarLabel);
        
        if (sidebarLabel) {
          // It's a label filter - check multiple fields for label matches
          const matchesLabel = memory.label === selectedCategory ||
                             memory.sub_category?.name === selectedCategory ||
                             (Array.isArray(memory.labels) && memory.labels.includes(selectedCategory)) ||
                             (memory.labels && typeof memory.labels === 'string' && memory.labels === selectedCategory);
          console.log('Matches label:', matchesLabel);
          return matchesLabel;
        }
        
        // Fallback: check both category and label matching
        const matchesCategory = memory.category?.name === selectedCategory || memory.category === selectedCategory;
        const matchesLabel = memory.label === selectedCategory ||
                           memory.sub_category?.name === selectedCategory ||
                           (Array.isArray(memory.labels) && memory.labels.includes(selectedCategory)) ||
                           (memory.labels && typeof memory.labels === 'string' && memory.labels === selectedCategory);
        
        console.log('Fallback - Matches category:', matchesCategory);
        console.log('Fallback - Matches label:', matchesLabel);
        return matchesCategory || matchesLabel;
      })
    : memoriesToFilter;

  // Apply search query filter on top of category filter
  const searchFilteredMemories = searchQuery.trim()
    ? filteredCategoryMemories.filter(memory => {
        const q = searchQuery.toLowerCase();
        const titleMatch = memory.title?.toLowerCase().includes(q);
        const authorMatch = memory.author?.name?.toLowerCase().includes(q) ||
                           (typeof memory.author === 'string' && memory.author.toLowerCase().includes(q));
        const categoryMatch = memory.category?.name?.toLowerCase().includes(q) ||
                             (typeof memory.category === 'string' && memory.category.toLowerCase().includes(q));
        return titleMatch || authorMatch || categoryMatch;
      })
    : filteredCategoryMemories;

  // Sorted version of searchFilteredMemories for the table/list view
  const sortedSearchMemories = [...searchFilteredMemories].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    }
    return 0;
  });

  // Calculate filtered memories count for display
  const filteredMemoriesCount = useMemo(() => {
    const memoriesToCount = allMemories.length > 0 ? allMemories : (latestMemories.length > 0 ? latestMemories : propMemories);
    return memoriesToCount.filter((memory) => {
      // Filter based on selectedCategory (filter dropdown) first
      if (selectedCategory) {
        const matchesSelectedCategory = memory.category?.name === selectedCategory || memory.category === selectedCategory;
        if (!matchesSelectedCategory) return false;
      }
      // In property view show all memories
      if (viewType === 'property') return true;
      // Then filter memories based on expanded categories in sidebar
      if (expandedCategories.length === 0) return true;
      return expandedCategories.includes(memory.category?.name || memory.property_category?.name || '');
    }).length;
  }, [allMemories, latestMemories, propMemories, selectedCategory, expandedCategories, viewType]);

  const handleOpenAIWizard = async () => {
    try {
      const creditCheck = await aiCreditsAPI.checkSufficientCredits('ai_memory_wizard', 2);
      if (creditCheck && creditCheck.has_sufficient_credits) {
        setSelectedAnalysisOption(null);
        setAiActiveTab('prompt');
        setCustomPrompt('');
        setIsAIResultsModalOpen(true);
      } else {
        setAvailableCredits(creditCheck?.total_available ?? 0);
        setShowAddCreditsModal(true);
      }
    } catch {
      toast({ message: 'Failed to check credits. Please try again.', type: 'error' });
    }
  };

  const handleAIWizardApply = async () => {
    if (aiActiveTab === 'prompt') {
      if (!customPrompt.trim()) return;
      setIsGeneratingFromPrompt(true);
      setIsAIResultsModalOpen(false);
      setIsAIWizardModalOpen(true);
      setAiWizardProgress(0);
      const promptProgressInterval = setInterval(() => {
        setAiWizardProgress(prev => prev >= 95 ? 95 : prev + 0.15);
      }, 100);
      try {
        // Step 1: Fetch all memory images
        const mediaResponse = await mediaAPI.getMemoryImages();
        let photoUrls: string[] = [];

        if (mediaResponse?.success && mediaResponse.data) {
          const categoriesMedia = mediaResponse.data.categories_media;
          if (categoriesMedia && typeof categoriesMedia === 'object') {
            const excludedCategories = ['sharedwith', 'shared with', 'suggested'];
            Object.entries(categoriesMedia).forEach(([categoryName, items]: [string, any]) => {
              if (excludedCategories.includes(categoryName.toLowerCase())) return;
              if (Array.isArray(items)) {
                items.forEach((item: any) => {
                  if (item.media_url) photoUrls.push(item.media_url);
                });
              }
            });
          }
        }

        // Step 2: Call detect-labels API (max 100 images)
        let memoryData: { file: string; labels: string[] }[] = [];
        const limitedPhotoUrls = photoUrls.slice(0, 100);
        if (limitedPhotoUrls.length > 0) {
          const labelsResponse = await dashboardAPI.detectLabels(limitedPhotoUrls);
          if (labelsResponse.success && labelsResponse.data?.results) {
            memoryData = labelsResponse.data.results.map((r: any) => ({
              file: r.file,
              labels: r.labels || [],
            }));
          } else {
            // Fallback: send URLs with empty labels
            memoryData = limitedPhotoUrls.map(url => ({ file: url, labels: [] }));
          }
        }

        // Step 3: Create memory from sentence
        const response = await dashboardAPI.createMemoryFromSentence(customPrompt.trim(), memoryData);
        if (response.success) {
          const createResponse = await dashboardAPI.createMemoryFromAIResponse(response.data);
          clearInterval(promptProgressInterval);
          setAiWizardProgress(100);
          if (createResponse.success) {
            setCustomPrompt('');
            setSelectedAnalysisOption(null);
            setTimeout(() => {
              setIsAIWizardModalOpen(false); onAIWizardDone?.();
              window.location.href = '/stories';
            }, 800);
          } else {
            setIsAIWizardModalOpen(false); onAIWizardDone?.();
            toast({ message: createResponse.error || 'Failed to create campaign from AI response', type: 'error' });
          }
        } else {
          clearInterval(promptProgressInterval);
          setIsAIWizardModalOpen(false); onAIWizardDone?.();
          toast({ message: response.error || 'Failed to process custom prompt', type: 'error' });
        }
      } catch {
        clearInterval(promptProgressInterval);
        setIsAIWizardModalOpen(false); onAIWizardDone?.();
        toast({ message: 'Failed to process custom prompt. Please try again.', type: 'error' });
      } finally {
        setIsGeneratingFromPrompt(false);
      }
      return;
    }

    if (selectedAnalysisOption === null) return;
    const summaryItems = [
      { type: 'faces' },
      { type: 'moments' },
      { type: 'objects' },
    ];
    const selectedTask = summaryItems[selectedAnalysisOption];
    if (!selectedTask) return;
    const type = selectedTask.type as 'faces' | 'moments' | 'objects';
    setIsApplyingTask(true);
    setIsAIResultsModalOpen(false);
    setIsAIWizardModalOpen(true);
    setAiWizardProgress(0);
    const progressInterval = setInterval(() => {
      setAiWizardProgress(prev => prev >= 95 ? 95 : prev + 0.15);
    }, 100);
    try {
      const analysisResponse = await dashboardAPI.analyzeUploadedPhotos([], type, undefined);
      if (!analysisResponse.success || !analysisResponse.data) {
        toast({ message: analysisResponse.error || 'AI analysis failed', type: 'error' });
        clearInterval(progressInterval);
        setIsAIWizardModalOpen(false); onAIWizardDone?.();
        setIsApplyingTask(false);
        return;
      }
      let analysisData = analysisResponse.data;
      if (analysisResponse.data.data?.summary) analysisData = analysisResponse.data.data;
      const groupData = analysisData?.clusters?.[type];
      if (!groupData || !Array.isArray(groupData) || groupData.length === 0) {
        toast({ message: `No ${type} clusters found in the analysis`, type: 'error' });
        clearInterval(progressInterval);
        setIsAIWizardModalOpen(false); onAIWizardDone?.();
        setIsApplyingTask(false);
        return;
      }
      const createResponse = await dashboardAPI.createMemoriesFromGroups(groupData, type);
      clearInterval(progressInterval);
      if (createResponse.success) {
        setAiWizardProgress(100);
        setSelectedAnalysisOption(null);
        setTimeout(() => {
          setIsAIWizardModalOpen(false); onAIWizardDone?.();
          window.location.reload();
        }, 1500);
      } else {
        toast({ message: createResponse.error || `Failed to create campaigns from ${type}`, type: 'error' });
        setIsAIWizardModalOpen(false); onAIWizardDone?.();
      }
    } catch {
      clearInterval(progressInterval);
      toast({ message: 'Something went wrong. Please try again.', type: 'error' });
      setIsAIWizardModalOpen(false); onAIWizardDone?.();
    } finally {
      setIsApplyingTask(false);
    }
  };

  // Published Entry Detail View — early return, same level as MemoryDetailsPage (no nested wrappers)
  if (publishedEntryData) {
    return (
      <div className="relative w-full min-h-screen bg-white pb-20 lg:pb-0">
        {/* Hero Section — same as MemoryDetailsPage collaborator view */}
        <div className="relative w-full h-[196px] sm:h-56 md:h-80">
          {selectedPublishedEntry?.wallpaper_image ? (
            <img
              src={selectedPublishedEntry.wallpaper_image}
              alt="Published"
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: '#9333EA' }}
            >
              <span className="text-white font-bold text-6xl md:text-8xl uppercase">
                {selectedPublishedEntry?.author_name?.charAt(0) || 'P'}
              </span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Back to Campaigns — same style as MemoryDetailsPage */}
          <div className="absolute top-0 left-0 right-0 z-20">
            <div className="max-w-7xl mx-auto px-0 sm:px-4 py-3 sm:py-4">
              <div className="flex items-center mx-4 md:mx-0 my-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setPublishedEntryData(null); setSelectedPublishedEntry(null); }}
                  className="bg-gray-200/80 hover:bg-gray-300/80 text-gray-700 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg backdrop-blur-sm"
                >
                  <ArrowLeft className="w-6 h-6 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Back to Campaigns</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom overlay: Published badge + author name + date */}
          <div className="absolute bottom-0 left-0 right-0 z-10 pb-3 sm:pb-4 md:pb-6 pt-20 md:pt-0">
            <div className="max-w-7xl mx-auto px-3 sm:px-4">
              <div className="flex items-center gap-1.5 sm:gap-2 md:mb-3">
                <Badge className="bg-[#9333EA] text-white font-medium px-3 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 text-[12px] sm:text-xs md:text-sm">
                  Published
                </Badge>
              </div>
              <div className="flex items-center gap-3 mb-2 md:mb-4">
                <Avatar className="w-10 h-10 md:w-14 md:h-14 flex-shrink-0">
                  <AvatarImage
                    src={publishedEntryData.author?.profile_image || undefined}
                    alt={publishedEntryData.author?.name || selectedPublishedEntry?.author_name}
                  />
                  <AvatarFallback
                    className="text-sm md:text-lg font-bold text-white"
                    style={{ backgroundColor: publishedEntryData.author?.profile_color ? (publishedEntryData.author.profile_color.startsWith('#') ? publishedEntryData.author.profile_color : `#${publishedEntryData.author.profile_color}`) : '#6C60FF' }}
                  >
                    {(publishedEntryData.author?.name || selectedPublishedEntry?.author_name || 'P').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Popover open={showAuthorPopover} onOpenChange={setShowAuthorPopover}>
                  <PopoverTrigger asChild>
                    <h1
                      className="font-bold text-white text-2xl sm:text-3xl md:text-[42px] leading-[30px] md:leading-[52px] cursor-pointer hover:underline decoration-white/60"
                      onMouseEnter={() => setShowAuthorPopover(true)}
                      onMouseLeave={() => setTimeout(() => setShowAuthorPopover(false), 100)}
                    >
                      {publishedEntryData.author?.name || selectedPublishedEntry?.author_name || 'Published Memories'}
                    </h1>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-72 rounded-2xl shadow-xl border border-gray-100 p-0 overflow-hidden bg-white"
                    align="start"
                    sideOffset={8}
                    onMouseEnter={() => setShowAuthorPopover(true)}
                    onMouseLeave={() => setShowAuthorPopover(false)}
                  >
                    {(() => {
                      const author = publishedEntryData.author || {};
                      const profileColor = author.profile_color
                        ? (author.profile_color.startsWith('#') ? author.profile_color : `#${author.profile_color}`)
                        : '#6C60FF';
                      const totalMemories = (publishedEntryData.data || []).length;
                      const socials = [
                        { url: author.facebook_url, icon: <Facebook className="w-4 h-4" />, label: 'Facebook' },
                        { url: author.linkedin_url, icon: <Linkedin className="w-4 h-4" />, label: 'LinkedIn' },
                        { url: author.instagram_url, icon: <Instagram className="w-4 h-4" />, label: 'Instagram' },
                        { url: author.tiktok_url, icon: (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/>
                          </svg>
                        ), label: 'TikTok' },
                      ].filter(s => s.url);
                      return (
                        <div>
                          {/* Header */}
                          <div className="flex items-center justify-between p-4 pb-2">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-10 h-10 flex-shrink-0">
                                <AvatarImage src={author.profile_image || undefined} alt={author.name} />
                                <AvatarFallback className="text-sm font-bold text-white" style={{ backgroundColor: profileColor }}>
                                  {(author.name || 'P').charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-sm text-gray-900">{author.name}</p>
                                <p className="text-xs text-gray-500">{author.location || 'Location not set'}</p>
                              </div>
                            </div>
                            <button onClick={() => setShowAuthorPopover(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="border-t border-gray-100 mx-4" />

                          {/* Stats */}
                          <div className="px-4 py-3 flex items-center justify-between">
                            <span className="text-sm text-gray-600">Total Campaigns</span>
                            <span className="text-sm font-semibold text-gray-900">{totalMemories}</span>
                          </div>

                          {/* Connect */}
                          <div className="px-4 pb-4 space-y-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Connect</p>
                            <button className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <Mail className="w-4 h-4" />
                              Send Email
                            </button>
                            {socials.length > 0 && (
                              <div className="flex items-center gap-2">
                                {socials.map((s) => (
                                  <a
                                    key={s.label}
                                    href={s.url!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center w-9 h-9 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                                    title={s.label}
                                  >
                                    {s.icon}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </PopoverContent>
                </Popover>
              </div>
              {selectedPublishedEntry?.published_at && (
                <div className="flex items-center gap-1 text-white/90 text-xs sm:text-sm">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{new Date(selectedPublishedEntry.published_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Memories Timeline Section */}
        <div className="bg-white shadow-sm border-t border-b border-gray-200">
          <div className="max-w-7xl mx-auto md:px-3 px-0">
            <div className="flex items-center justify-between gap-4 py-3 px-4 md:px-0 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <div className="hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 bg-[#9333EA]/10 rounded-full items-center justify-center">
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-[#9333EA]" />
                </div>
                <div>
                  <h2 className="text-[21px] sm:text-lg font-semibold text-gray-900 leading-tight">Campaigns</h2>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {(publishedEntryData.data || []).length} {(publishedEntryData.data || []).length === 1 ? 'campaign' : 'campaigns'} shared
                  </p>
                </div>
              </div>

              {/* Share Link Card — adjacent to Memories heading */}
              {(() => {
                const apiUrl = selectedPublishedEntry?.short_url;
                if (!apiUrl) return null;
                // Extract the slug (last path segment) from the API URL and build the frontend page URL
                const slug = apiUrl.split('/').pop();
                if (!slug) return null;
                const shareUrl = `${window.location.origin}/published-author-memory/${slug}`;
                const visibilityLabel = selectedPublishedEntry?.visibility === 'view_only' ? 'View Only'
                  : selectedPublishedEntry?.visibility === 'private' ? 'Private'
                  : 'Public';
                const visibilityColor = selectedPublishedEntry?.visibility === 'view_only' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                  : selectedPublishedEntry?.visibility === 'private' ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-blue-100 text-blue-700 border border-blue-200';
                return (
                  <div className="flex-1 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-4 py-3 flex flex-col gap-2 min-w-0">
                    {/* Row 1: icon + label + badges */}
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[#16a34a] flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-800">Published Campaign</span>
                      <span className="text-[11px] font-medium bg-[#dcfce7] text-[#16a34a] border border-[#86efac] px-2 py-0.5 rounded-full">Live</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${visibilityColor}`}>{visibilityLabel}</span>
                    </div>
                    {/* Row 2: URL + action buttons */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 min-w-0">
                        <span className="text-xs text-gray-500 truncate block">{shareUrl}</span>
                      </div>
                      <button
                        onClick={() => {
                          const fallbackCopy = (text: string) => {
                            const el = document.createElement('textarea');
                            el.value = text;
                            el.style.position = 'fixed';
                            el.style.opacity = '0';
                            document.body.appendChild(el);
                            el.focus();
                            el.select();
                            try {
                              document.execCommand('copy');
                              sonnerToast.success('Link copied!');
                            } catch {
                              sonnerToast.error('Failed to copy link');
                            }
                            document.body.removeChild(el);
                          };
                          if (navigator.clipboard && window.isSecureContext) {
                            navigator.clipboard.writeText(shareUrl)
                              .then(() => sonnerToast.success('Link copied!'))
                              .catch(() => fallbackCopy(shareUrl));
                          } else {
                            fallbackCopy(shareUrl);
                          }
                        }}
                        className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                      <button
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({ url: shareUrl, title: 'Published Campaign' });
                          } else {
                            const el = document.createElement('textarea');
                            el.value = shareUrl;
                            el.style.position = 'fixed';
                            el.style.opacity = '0';
                            document.body.appendChild(el);
                            el.focus();
                            el.select();
                            try { document.execCommand('copy'); sonnerToast.success('Link copied!'); } catch { sonnerToast.error('Failed to copy'); }
                            document.body.removeChild(el);
                          }
                        }}
                        className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        Share
                      </button>
                      <button
                        onClick={() => { setQrShareUrl(shareUrl); setShowQRModal(true); }}
                        className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        QR Code
                      </button>
                      <button
                        disabled={isUnpublishing}
                        onClick={async () => {
                          const memoryIds = (publishedEntryData?.data || []).map((m: any) => m.id).filter(Boolean);
                          if (memoryIds.length === 0) {
                            sonnerToast.error('No memories to unpublish');
                            return;
                          }
                          setIsUnpublishing(true);
                          try {
                            const res = await apiRequest('/memories/unpublish', {
                              method: 'DELETE',
                              body: JSON.stringify({ memory_ids: memoryIds }),
                            });
                            if (res.success) {
                              sonnerToast.success(res.data?.message || 'Unpublished successfully');
                              setSelectedPublishedEntry(null);
                              setPublishedEntryData(null);
                            } else {
                              sonnerToast.error(res.error || 'Failed to unpublish');
                            }
                          } catch {
                            sonnerToast.error('Failed to unpublish');
                          } finally {
                            setIsUnpublishing(false);
                          }
                        }}
                        className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
                      >
                        {isUnpublishing ? (
                          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Unpublish
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Memory cards */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          {isLoadingPublishedEntry ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-lg animate-pulse">
                  <div className="w-full aspect-square bg-gray-200 rounded-t-lg" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (publishedEntryData.data || []).length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
              {(publishedEntryData.data || []).map((mem: any) => {
                const thumbnailUrl = mem.last_update_img || mem.wallpaper_image || null;
                return (
                  <div key={mem.id} className="relative z-0">
                    <MemoryCard
                      image={thumbnailUrl}
                      title={mem.title}
                      dateRange={mem.created_at ? new Date(mem.created_at).toLocaleDateString() : 'Date not specified'}
                      location={mem.location || ''}
                      category=""
                      categoryColor="#9333EA"
                      label=""
                      photosCount={mem.post_count || mem.photos?.count || 0}
                      imagesCount={mem.post_count || mem.photos?.count || 0}
                      avatar={publishedEntryData.author?.profile_image || mem.author?.avatar || undefined}
                      fullName={publishedEntryData.author?.name || mem.author?.name}
                      profileColor={mem.author?.profile_color}
                      tags={[]}
                      isEditMode={false}
                      isSelected={false}
                      categories={sidebarData?.categories?.items || categories}
                      isSharedWith={false}
                      onClick={() => {
                        // Save author collection state so we can restore it when user hits back
                        sessionStorage.setItem('restorePublishedEntry', JSON.stringify({
                          publishedEntryData,
                          selectedPublishedEntry,
                        }));
                        // Use slug/token if available, fallback to id (same pattern as App.tsx line 1457)
                        const slug = mem.slug || mem.token || mem.id;
                        window.location.href = `/published-memory/${slug}`;
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 text-sm">No memories found</div>
          )}
        </div>

        {/* QR Code Modal */}
        {showQRModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowQRModal(false)}>
            <div className="bg-white rounded-2xl p-6 shadow-xl flex flex-col items-center gap-4 w-[280px]" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-gray-900">Scan QR Code</h3>
              <QRCodeSVG value={qrShareUrl} size={200} />
              <p className="text-xs text-gray-500 text-center break-all">{qrShareUrl}</p>
              <button
                onClick={() => setShowQRModal(false)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Hidden proxy input — focused first on mobile to open keyboard before portal renders */}
      <input ref={proxyInputRef} type="text" style={{ position: 'fixed', top: 0, left: 0, width: 1, height: 1, border: 'none', outline: 'none', background: 'transparent', color: 'transparent', caretColor: 'transparent', padding: 0, zIndex: -1, pointerEvents: 'none' }} aria-hidden="true" tabIndex={-1} />
      {/* Memory Limit Warning */}
      {isLimitExceeded && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-start gap-3 mr-4">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">
                Campaign Limit Reached
              </h3>
              <p className="text-sm text-yellow-700">
                You have reached your campaign limit {limitData?.current_memories || 0}/{limitData?.memory_limit || 0} memories for this plan.
                <button
                  onClick={() => onNavigate?.('profile-settings')}
                  className="font-medium text-yellow-800 hover:text-yellow-900 underline ml-1 cursor-pointer bg-transparent border-none p-0"
                >
                  Please upgrade your account here
                </button>
              </p>
            </div>
          </div>
      )}

      {/* Admin Memory Limit Info - Yellow warning box */}
      {isAdminLimitExceeded && adminLimitData && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-start gap-3 mr-4">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">
                Admin Limit Reached
              </h3>
              <p className="text-sm text-yellow-700">
                You have reached your admin limit {Math.min(adminLimitData?.current_admins || 0, adminLimitData?.max_allowed || 0)}/{adminLimitData?.max_allowed || 0} for this plan.
                <button
                  onClick={() => { sessionStorage.setItem('billing_open_upgrade', 'true'); onNavigate?.('billing'); }}
                  className="font-medium text-yellow-800 hover:text-yellow-900 underline ml-1 cursor-pointer bg-transparent border-none p-0"
                >
                  Please upgrade your account here
                </button>
              </p>
            </div>
          </div>
      )}

      {/* Service Sync Limit Info - Yellow warning box */}
      {isServiceSyncLimitExceeded && serviceSyncLimitData && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-start gap-3 mr-4">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">
                Account Sync Limit Reached
              </h3>
              <p className="text-sm text-yellow-700">
                {serviceSyncLimitData?.message || 'You have reached the limit of account sync'}. You have {serviceSyncLimitData?.current_connected_services || 0}/{serviceSyncLimitData?.max_allowed || 0} services connected.
                <button
                  onClick={() => onNavigate?.('profile-settings')}
                  className="font-medium text-yellow-800 hover:text-yellow-900 underline ml-1 cursor-pointer bg-transparent border-none p-0"
                >
                  Please upgrade your account here
                </button>
              </p>
            </div>
          </div>
      )}

      {/* AI Credits Limit Info - Yellow warning box */}
      {isAICreditsExceeded && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-start gap-3 mr-4">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">
                AI Credits Limit Reached
              </h3>
              <p className="text-sm text-yellow-700">
                Your AI credits have been exhausted. You have 0 AI credits remaining.
                <button
                  onClick={() => {
                    sessionStorage.setItem('openPurchaseCreditsModal', 'true');
                    onNavigate?.('billing');
                  }}
                  className="font-medium text-yellow-800 hover:text-yellow-900 underline ml-1 cursor-pointer bg-transparent border-none p-0"
                >
                  Please purchase AI credits here
                </button>
              </p>
            </div>
          </div>
      )}

      {/* Pending Properties Payment Warning */}
      {pendingPropertiesCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-start gap-3 mr-4">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-yellow-800 mb-1">
              Properties Pending Payment
            </h3>
            <p className="text-sm text-yellow-700">
              You have {pendingPropertiesCount} {pendingPropertiesCount === 1 ? 'property' : 'properties'} pending payment. Please complete your payment to activate {pendingPropertiesCount === 1 ? 'it' : 'them'}.
              <button
                onClick={() => { sessionStorage.setItem('users_open_tab', 'properties'); onNavigate?.('users'); }}
                className="font-medium text-yellow-800 hover:text-yellow-900 underline ml-1 cursor-pointer bg-transparent border-none p-0"
              >
                Go to Properties
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Conditional Content Based on Category Selection */}
      {false && selectedCategory ? (
        // Disabled: Show category-filtered memories when a category is selected in filter dropdown
        <div className="space-y-6">
          {/* Filtered Memory Cards */}
          <div className="w-full">
            {searchFilteredMemories.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 mx-0 md:mx-4 py-4">
                {searchFilteredMemories.map((memory) => {
                  console.log('Memory data:', memory);
                  console.log('last_update_img:', memory.last_update_img);
                  console.log('preview_images:', memory.photos?.preview_images);
                  const imageUrl = memory.last_update_img || memory.photos?.preview_images?.[0]?.url || memory.thumbnail || (viewType === 'property' ? currentProperty?.image : undefined);
                  console.log('Final image URL:', imageUrl);

                  const categoryName = memory.category?.name || memory.property_category?.name || 'Unknown Category';
                  const isSuggestedCategory = categoryName === 'Suggested';
                  const isSharedWithCategory = categoryName === 'Shared With';

                  return (
                  <div key={memory.id}>
                    <MemoryCard
                      image={imageUrl}
                      title={memory.title}
                      dateRange={(() => {
                        // Format date range like "Aug 11/25" or "Aug 11 - Aug 15/25"
                        if (memory.starting_date && memory.ending_date) {
                          return `${memory.starting_date} - ${memory.ending_date}`;
                        } else if (memory.starting_date) {
                          return memory.starting_date;
                        } else if (memory.dates?.formatted_range) {
                          return memory.dates.formatted_range;
                        } else {
                          return '';
                        }
                      })()}
                      location={memory.location?.formatted || 'Location not specified'}
                      category={categoryName}
                      categoryColor={memory.category?.badge_style?.hex_color || memory.category?.color}
                      label={isSharedWithCategory ? '' : (memory.sub_category?.name || memory.labels?.[0] || (typeof memory.label === 'object' ? memory.label?.name : memory.label) || '')}
                      photosCount={memory.photos?.count || memory.photos_count || 0}
                      imagesCount={memory.photos?.count || memory.photos_count || 0}
                      avatar={memory.author?.avatar || (memory.type === 'shared' && memory.author ?
                        "https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=100&h=100&fit=crop&crop=face" : undefined)}
                      fullName={memory.author?.name || (memory.type === 'shared' ? memory.author : undefined)}
                      profileColor={memory.author?.profile_color}
                      tags={Array.isArray(memory.tags) ? memory.tags.map((t: any) => typeof t === 'string' ? t : t.name).filter(Boolean) : []}
                      isEditMode={isEditMode}
                      isSelected={selectedCardIds.has(memory.id.toString())}
                      onSelectToggle={() => setSelectedCardIds(prev => { const next = new Set(prev); next.has(memory.id.toString()) ? next.delete(memory.id.toString()) : next.add(memory.id.toString()); return next; })}
                      contributors={memory.collaborators?.map((collab: any) => {
                        // Check if this collaborator is the logged-in user
                        const isCurrentUser = user && (
                          collab.name === user.name ||
                          collab.id?.toString() === user.id?.toString() ||
                          collab.id?.toString() === user.external_user_id?.toString()
                        );

                        return {
                          name: collab.name || collab.user?.name || 'Unknown',
                          avatar: collab.avatar || collab.user?.avatar || collab.user?.profile_image,
                          profile_color: isCurrentUser ? user.profile_color : (collab.profile_color || collab.user?.profile_color)
                        };
                      }) || []}
                      onClick={() => onMemorySelect(memory.id.toString())}
                      onAddMedia={() => onMemorySelect(memory.id.toString(), true)}
                      categories={sidebarData?.categories?.items || categories}
                      property={memory.property ? { id: memory.property.id, name: memory.property.name } : undefined}
                      properties={memory.properties?.map((p: any) => ({ id: p.id, name: p.name }))}
                      suggestedCategory={isSuggestedCategory ? categoryName : undefined}
                      onAcceptSuggestion={isSuggestedCategory ? () => handleAcceptSuggestedCategory(memory.id.toString()) : undefined}
                      published={memory.published}
                      onRejectSuggestion={isSuggestedCategory ? () => handleRejectSuggestedCategory(memory.id.toString()) : undefined}
                      isAcceptingOrRejecting={loadingMemoryActions[memory.id.toString()]}
                    />
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <div className="text-gray-400 mb-4">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No memories {sidebarData?.categories?.items?.some((cat: any) => cat?.name === selectedCategory) || categories.some(cat => cat?.name === selectedCategory) ? 'in' : 'with'} {selectedCategory}</h3>
                <p className="text-gray-600 mb-4">{isPropertyOwner ? 'Start creating campaigns' : 'No campaigns available'} {sidebarData?.categories?.items?.some((cat: any) => cat?.name === selectedCategory) || categories.some(cat => cat?.name === selectedCategory) ? 'in this category' : 'with this label'}</p>
                {isPropertyOwner && (
                  <div className="flex gap-3 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setShowPublishModal(true)}
                      className="border-[#6C60FF] text-[#6C60FF] hover:bg-[#6C60FF] hover:text-white transition-colors"
                    >
                      <Globe className="w-4 h-4 mr-2" />
                      Publish
                    </Button>
                    <Button
                      onClick={isLimitExceeded ? undefined : () => handleCreateMemory()}
                      disabled={isLimitExceeded}
                      className={isLimitExceeded
                        ? "bg-gray-300 text-gray-500 hover:bg-gray-300 cursor-not-allowed"
                        : "bg-[#6C60FF] hover:bg-[#6C60FF]/90 text-white"
                      }
                      style={isLimitExceeded ? { backgroundColor: '#EFEFEF', color: '#9CA3AF' } : undefined}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create a Campaign
                    </Button>
                  </div>
                )}    

              </div>
            )}
          </div>
        </div>
      ) : (
        // Show latest memories cards and memory table when no category is selected
        <>
      {/* Memory Table Header - Using original with grid/list toggle and Create Memory button */}
          <div className="bg-white md:rounded-xl md:border md:border-gray-100 md:shadow-sm">
            {/* Sticky wrapper — contains header row + edit action bar so both stick together */}
            <div className={`sticky top-20 bg-white z-10${isEditMode ? ' pb-[6px]' : ''}`}>
            {/* Header */}
               <div className="flex sm:flex-row items-center sm:items-center justify-between gap-3 sm:gap-0 py-4 px-0 lg:px-4">
                {/* Mobile: Icon + Title */}
                <div className="md:hidden flex items-center gap-3 flex-1">
                  {/* Mobile Menu Icon - Only show on mobile and when sidebar is not visible */}
                  {onToggleMobileSidebar && !showMobileSidebar && (
                    <button
                      onClick={onToggleMobileSidebar}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      aria-label="Open sidebar"
                    >
                      <img
                        src="/Icon.svg"
                        alt="Menu"
                        className="w-5 h-5"
                      />
                    </button>
                  )}
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-gray-900">All Campaigns</h2>
                    <p className="text-sm-md text-gray-600">{filteredMemoriesCount} campaigns found</p>
                  </div>
                </div>

                {/* Desktop: Title only */}
                <div className="hidden md:block">
                  <h2 className="text-xl font-bold text-gray-900">All Campaigns</h2>
                  <p className="text-gray-600 mt-1">{filteredMemoriesCount} campaigns found</p>
                </div>

                <div className="flex items-center gap-2 md:gap-3 md:w-auto">
                  {/* AI Campaign Wizard Button */}
                  {isPropertyOwner && <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenAIWizard}
                    className="hidden lg:flex h-9 px-3 relative overflow-hidden items-center justify-center"
                    style={{
                      background: 'linear-gradient(white, white) padding-box, linear-gradient(to right, #6C60FF, #EC4899) border-box',
                      border: '1px solid transparent'
                    }}
                  >
                    <Sparkles className="w-4 h-4 mr-0 flex-shrink-0" style={{ color: '#6C60FF' }} />
                    <span style={{
                      background: 'linear-gradient(to right, #6C60FF, #EC4899)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      display: 'inline-block'
                    }}>
                      AI Campaign Wizard
                    </span>
                  </Button>}

                  {/* Grid/List Toggle - Hidden on mobile */}
                  <div className="hidden lg:flex items-center bg-gray-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-md transition-colors ${
                        viewMode === 'grid'
                          ? 'bg-[#6C60FF] text-white'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-md transition-colors ${
                        viewMode === 'list'
                          ? 'bg-[#6C60FF] text-white'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Publish and Create Memory Buttons - Only show for property owners */}
                  {isPropertyOwner && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setShowPublishModal(true)}
                        className="border-[#6C60FF] text-[#6C60FF] hover:bg-[#6C60FF] hover:text-white transition-colors md:flex-initial"
                      >
                        <Globe className="w-4 h-4 -mr-1" />
                        <span className="sm:hidden">Publish</span>
                        <span className="hidden sm:inline">Publish</span>
                      </Button>
                      <Button
                        onClick={(isLimitExceeded ) ? undefined : () => handleCreateMemory()}
                        disabled={isLimitExceeded }
                        className={(isLimitExceeded )
                          ? "bg-gray-300 text-gray-500 hover:bg-gray-300 cursor-not-allowed md:flex-initial"
                          : "bg-[#6C60FF] text-white hover:bg-[#5B52FF] focus:ring-2 focus:ring-[#6C60FF] focus:ring-opacity-50 active:bg-[#6C60FF] md:flex-initial"
                        }
                        style={isLimitExceeded ? { backgroundColor: '#EFEFEF', color: '#9CA3AF' } : undefined}
                      >
                        <Plus className="w-4 h-4 -mr-1" />
                        <span className="sm:hidden">Create</span>
                        <span className="hidden sm:inline">Create a Campaign</span>
                      </Button>
                    </>
                  )}

                  {/* Edit Button */}
                  <Button
                    variant="outline"
                    onClick={() => { setIsEditMode(prev => { if (prev) setSelectedCardIds(new Set()); return !prev; }); }}
                    className={`hidden md:inline-flex focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none transition-colors ${
                      isEditMode
                        ? 'bg-black text-white border-black hover:bg-black hover:text-white'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Pencil className={`w-4 h-4 mr-0 ${isEditMode ? 'text-white' : ''}`} />
                    Edit
                  </Button>
                </div>
              </div>

              {/* Edit Mode Action Bar */}
              {isEditMode && (
                <div className="hidden md:flex items-center justify-between gap-2 px-4 py-3 rounded-xl mx-4 mb-3" style={{ backgroundColor: '#F3F4F6', border: '1px solid #BFBFBF' }}>
                  {/* Left: selected count */}
                  <span className="text-sm font-medium text-gray-600">
                    {selectedCardIds.size} {selectedCardIds.size === 1 ? 'campaign' : 'campaigns'} selected
                  </span>
                  {/* Right: actions */}
                  <div className="flex items-center gap-2">
                    <button
                      disabled={selectedCardIds.size === 0 || editActionLoading}
                      onClick={() => setShowAddTagsModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none"
                    >
                      <Tag className="w-4 h-4" />
                      Add tags
                    </button>
                    <button
                      disabled={selectedCardIds.size === 0 || editActionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none"
                    >
                      <Tag className="w-4 h-4" />
                      Add label
                    </button>
                    <button
                      onClick={() => { setSelectedCardIds(new Set()); setIsEditMode(false); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors focus:outline-none"
                    >
                      Cancel
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          disabled={editActionLoading}
                          className="flex items-center justify-center w-8 h-8 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 focus:outline-none"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 bg-white border border-gray-100 shadow-lg rounded-lg">
                        <DropdownMenuItem
                          disabled={selectedCardIds.size === 0}
                          onClick={handleDuplicate}
                          className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Copy className="w-4 h-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={selectedCardIds.size < 2}
                          onClick={() => setShowMergeModal(true)}
                          className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <GitMerge className="w-4 h-4" />
                          Merge campaigns
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={selectedCardIds.size === 0}
                          onClick={handleDeleteSelected}
                          className="flex items-center gap-2 cursor-pointer text-sm text-red-500 hover:bg-red-50 focus:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )}
            </div>{/* end sticky wrapper */}

            {!isEditMode && <div className="bg-white border-b border-gray-100 md:shadow-sm">
              <div className="px-0 pt-2 pb-4 md:p-4 md:p-6">

              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search campaigns, authors, or categories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 bg-gray-50 border-gray-200 focus:bg-white focus:border-[#6C60FF] transition-colors"
                    style={{ outline: 'none', boxShadow: 'none' }}
                  />
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="flex-1 sm:flex-none sm:w-[100px] md:w-[140px] bg-gray-50 border-gray-200 hover:border-gray-300 focus:bg-gray-50 focus:border-gray-300 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 outline-none transition-colors">
                      <SelectValue>
                        <span className="md:hidden">
                          {filterCategory === "All Categories" ? "Categories" : filterCategory}
                        </span>
                        <span className="hidden md:inline">
                          {filterCategory}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="focus:outline-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0">
                      {categoryNames.map((categoryName, index) => (
                        <SelectItem
                          key={`category-${index}-${categoryName}`}
                          value={categoryName}
                          className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 focus:outline-none"
                        >
                          {categoryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedAuthor} onValueChange={setSelectedAuthor}>
                    <SelectTrigger className="flex-1 sm:flex-none sm:w-[100px] md:w-[130px] bg-gray-50 border-gray-200 hover:border-gray-300 focus:bg-gray-50 focus:border-gray-300 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 outline-none transition-colors">
                      <SelectValue>
                        <span className="md:hidden">
                          {selectedAuthor === "All Authors" ? "Authors" : selectedAuthor}
                        </span>
                        <span className="hidden md:inline">
                          {selectedAuthor}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="focus:outline-none outline-none focus-visible:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                      {apiAuthors.map((author, index) => (
                        <SelectItem
                          key={`author-${index}-${author}`}
                          value={author}
                          className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 focus:outline-none"
                        >
                          {author}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedLabel} onValueChange={setSelectedLabel}>
                    <SelectTrigger className="flex-1 sm:flex-none sm:w-[100px] md:w-[130px] bg-gray-50 border-gray-200 hover:border-gray-300 focus:bg-gray-50 focus:border-gray-300 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 outline-none transition-colors">
                      <SelectValue>
                        <span className="md:hidden">
                          {selectedLabel === "All Labels" ? "Labels" : selectedLabel}
                        </span>
                        <span className="hidden md:inline">
                          {selectedLabel}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="focus:outline-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0">
                      {apiLabels.map((label, index) => (
                        <SelectItem
                          key={`label-${index}-${label}`}
                          value={label}
                          className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 focus:outline-none"
                        >
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Clear Filters */}
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="hidden md:inline-flex hover:bg-[#6C60FF]/5 hover:border-[#6C60FF] hover:text-[#6C60FF] border-gray-200 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none"
                  >
                    Clear filters
                  </Button>
                </div>
                </div>
              </div>
            </div>}

            {/* Table/Grid Content */}
            <div className="overflow-x-auto">
              {viewMode === 'grid' ? (
                <div className=" md:p-6 relative z-0 pt-[1rem]">
                  {isLoadingMemories ? (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {[...Array(4)].map((_, index) => (
                        <div key={index} className="bg-gray-100 rounded-lg animate-pulse">
                          <div className="w-full aspect-square bg-gray-200 rounded-t-lg"></div>
                          <div className="p-4 space-y-3">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : allMemories.length > 0 || sharedWithMemories.length > 0 || publishedEntries.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                      {/* Combine and sort all memories by latest update */}
                      {(() => {
                        const combined = [...allMemories.map(mem => ({...mem, isShared: false})), ...sharedWithMemories.map(mem => ({...mem, isShared: true}))];

                        // Debug: Log to see date fields in both types
                        console.log('🔍 DEBUG: Own memories sample:', allMemories.slice(0, 2).map(m => ({
                          id: m.id,
                          title: m.title,
                          last_updated: m.last_updated,
                          updated_at: m.updated_at,
                          created_at: m.created_at,
                          allFields: Object.keys(m).filter(k => k.includes('date') || k.includes('time') || k.includes('update') || k.includes('created') || k.includes('invite'))
                        })));

                        console.log('🔍 DEBUG: Shared memories sample:', sharedWithMemories.slice(0, 2).map(m => ({
                          id: m.id,
                          title: m.title,
                          last_updated: m.last_updated,
                          invited_at: m.invited_at,
                          updated_at: m.updated_at,
                          created_at: m.created_at,
                          notification_id: m.notification_id,
                          allFields: Object.keys(m).filter(k => k.includes('date') || k.includes('time') || k.includes('update') || k.includes('created') || k.includes('invite'))
                        })));

                        console.log('🔍 DEBUG: Check Invites category:', allMemories.filter(m => m.category?.name === 'Invites').slice(0, 2).map(m => ({
                          id: m.id,
                          title: m.title,
                          invited_at: m.invited_at,
                          last_updated: m.last_updated,
                          created_at: m.created_at,
                          allFields: Object.keys(m).filter(k => k.includes('date') || k.includes('time') || k.includes('update') || k.includes('created') || k.includes('invite'))
                        })));

                        const sorted = combined.sort((a, b) => {
                          // For Invites category, use invited_at; for own/shared memories, use updated_at (not last_updated which is "X minutes ago")
                          const isAInvite = a.category?.name === 'Invites' || a.category === 'Invites';
                          const isBInvite = b.category?.name === 'Invites' || b.category === 'Invites';

                          // Get date string with fallbacks
                          // Note: last_updated contains "2 minutes ago" format, so we use updated_at or created_at instead
                          const aDateStr = isAInvite ? (a.invited_at || a.created_at) : (a.updated_at || a.created_at);
                          const bDateStr = isBInvite ? (b.invited_at || b.created_at) : (b.updated_at || b.created_at);

                          // Parse dates safely, default to 0 if invalid
                          const aDate = aDateStr ? new Date(aDateStr).getTime() : 0;
                          const bDate = bDateStr ? new Date(bDateStr).getTime() : 0;

                          // Check for invalid dates and default to 0
                          const aTime = isNaN(aDate) ? 0 : aDate;
                          const bTime = isNaN(bDate) ? 0 : bDate;

                          const aType = isAInvite ? 'invite' : (a.isShared ? 'shared' : 'own');
                          const bType = isBInvite ? 'invite' : (b.isShared ? 'shared' : 'own');

                          if (aTime && bTime) {
                            console.log(`📅 Comparing: ${a.title} (${aType}: ${new Date(aTime).toISOString()}) vs ${b.title} (${bType}: ${new Date(bTime).toISOString()})`);
                          }

                          return bTime - aTime; // Descending order (newest first)
                        });


                        const filtered = sorted.filter((memory) => {
                          // Include all memories in sorted list (removed Invites exclusion)
                          // const isInvitesCategory = memory.category?.name === 'Invites' || memory.category === 'Invites';
                          // if (isInvitesCategory) return false;

                          // Filter based on selectedCategory (filter dropdown) first
                          if (selectedCategory) {
                            // For shared memories, check if "Shared With" is selected
                            if (memory.isShared && selectedCategory !== 'Shared With') return false;
                            // Check if memory matches the selected category from filter dropdown
                            const matchesSelectedCategory = memory.category?.name === selectedCategory || memory.category === selectedCategory;
                            if (!matchesSelectedCategory) return false;
                          }

                          // Apply "All Categories" filter
                          if (filterCategory !== "All Categories") {
                            // For shared memories, only show when "Shared With" is selected
                            if (memory.isShared && filterCategory !== "Shared With") return false;
                            const matchesFilterCategory = memory.category?.name === filterCategory || memory.category === filterCategory;
                            if (!matchesFilterCategory && !memory.isShared) return false;
                          }

                          // Apply "All Authors" filter
                          if (selectedAuthor !== "All Authors") {
                            const matchesAuthor = memory.author?.name === selectedAuthor || memory.author === selectedAuthor;
                            if (!matchesAuthor) return false;
                          }

                          // Apply "All Labels" filter
                          if (selectedLabel !== "All Labels") {
                            const matchesLabel = memory.sub_category?.name === selectedLabel ||
                                               memory.label === selectedLabel ||
                                               (Array.isArray(memory.labels) && memory.labels.includes(selectedLabel));
                            if (!matchesLabel) return false;
                          }

                          // In property view show all memories — category sidebar is for navigation only
                          if (viewType === 'property') return true;
                          // Then filter memories based on expanded categories in sidebar
                          // If no categories are expanded, show all memories (unless filtered by selectedCategory)
                          if (expandedCategories.length === 0) return true;
                          // Show memory if its category is expanded in sidebar, or if it's shared and "Shared With" is expanded
                          if (memory.isShared) {
                            return expandedCategories.includes('Shared With');
                          }
                          return expandedCategories.includes(memory.category?.name || memory.property_category?.name || '');
                        }).filter(memory => {
                          if (!searchQuery.trim()) return true;
                          const q = searchQuery.toLowerCase();
                          return (
                            memory.title?.toLowerCase().includes(q) ||
                            memory.author?.name?.toLowerCase().includes(q) ||
                            (typeof memory.author === 'string' && memory.author.toLowerCase().includes(q)) ||
                            memory.category?.name?.toLowerCase().includes(q) ||
                            (typeof memory.category === 'string' && memory.category.toLowerCase().includes(q))
                          );
                        });


                        return filtered.map((memory) => {
                      const thumbnailUrl = memory.last_update_img || memory.photos?.preview_images?.[0]?.url || (viewType === 'property' ? currentProperty?.image : undefined);
                      const contributors = (memory.collaborators || []).map((collab: any) => {
                        // Check if this collaborator is the logged-in user
                        const isCurrentUser = user && (
                          collab.name === user.name ||
                          collab.id?.toString() === user.id?.toString() ||
                          collab.id?.toString() === user.external_user_id?.toString()
                        );

                        return {
                          name: collab.name || collab.user?.name || 'Unknown',
                          avatar: collab.avatar || collab.user?.avatar || collab.user?.profile_image,
                          profile_color: isCurrentUser ? user.profile_color : (collab.profile_color || collab.user?.profile_color)
                        };
                      });

                      // Debug suggested category
                      const memoryCategoryName = memory.category?.name || memory.property_category?.name || '';
                      const isSuggestedCategory = memoryCategoryName === 'Suggested';
                      const isSharedWithCategory = memory.isShared || memoryCategoryName === 'Shared With';
                      const isInvitesCategory = memoryCategoryName === 'Invites';

                      if (isSuggestedCategory) {
                        console.log('📋 Memory with Suggested category:', {
                          id: memory.id,
                          title: memory.title,
                          category: memoryCategoryName
                        });
                      }

                      // Get color for memories
                      const categoryColor = memory.isShared
                        ? (sidebarData?.categories?.items?.find((cat: any) => cat?.name === 'Shared With')?.color || '#10B981')
                        : isInvitesCategory
                        ? (memory.category?.color || memory.category?.badge_style?.hex_color || '#EC4899')
                        : (memory.category?.badge_style?.hex_color || memory.category?.color);

                      return (
                        <div key={memory.isShared ? `shared-${memory.id}` : memory.id} className="relative z-0">
                          <MemoryCard
                            image={thumbnailUrl}
                            title={memory.title}
                            dateRange={memory.dates?.formatted_range || 'Date not specified'}
                            location={memory.location?.formatted || 'Location not specified'}
                            category={memory.isShared ? 'Shared With' : memoryCategoryName}
                            categoryColor={categoryColor}
                            label={isSharedWithCategory || isInvitesCategory ? '' : (memory.sub_category?.name || (typeof memory.label === 'object' ? memory.label?.name : memory.label) || '')}
                            photosCount={memory.photos?.count || 0}
                            imagesCount={memory.photos?.count || 0}
                            avatar={memory.author?.avatar}
                            fullName={memory.author?.name}
                            profileColor={memory.author?.profile_color}
                            contributors={contributors}
                            tags={Array.isArray(memory.tags) ? memory.tags.map((t: any) => typeof t === 'string' ? t : t?.name).filter(Boolean) : []}
                            isEditMode={isEditMode}
                            isSelected={selectedCardIds.has(memory.id.toString())}
                            onSelectToggle={() => setSelectedCardIds(prev => { const next = new Set(prev); next.has(memory.id.toString()) ? next.delete(memory.id.toString()) : next.add(memory.id.toString()); return next; })}
                            onClick={isInvitesCategory ? undefined : () => onMemorySelect(memory.id.toString())}
                            onAddMedia={isInvitesCategory ? undefined : () => onMemorySelect(memory.id.toString(), true)}
                            categories={sidebarData?.categories?.items || categories}
                            property={memory.property ? { id: memory.property.id, name: memory.property.name } : undefined}
                      properties={memory.properties?.map((p: any) => ({ id: p.id, name: p.name }))}
                            isSharedWith={memory.isShared}
                            isInvite={isInvitesCategory}
                            notificationId={memory.notification_id}
                            onAcceptInvite={isInvitesCategory ? (notificationId) => handleAcceptInvite(memory.id, notificationId) : undefined}
                            onRejectInvite={isInvitesCategory ? (notificationId) => handleRejectInvite(memory.id, notificationId) : undefined}
                            suggestedCategory={isSuggestedCategory ? memoryCategoryName : undefined}
                            onAcceptSuggestion={isSuggestedCategory ? () => handleAcceptSuggestedCategory(memory.id.toString()) : undefined}
                            onRejectSuggestion={isSuggestedCategory ? () => handleRejectSuggestedCategory(memory.id.toString()) : undefined}
                            isAcceptingOrRejecting={loadingMemoryActions[memory.id.toString()]}
                            published={memory.published}
                          />
                        </div>
                      );
                        });
                      })()}

                      {/* Published Author Entries */}
                      {(() => {
                        const visibilityMap: {[key: string]: number} = { public: 1, view_only: 2, private: 3 };
                        // Show published author entries when:
                        // - Published category is explicitly selected, OR
                        // - No category filter is active (All view) with no conflicting dropdown filter
                        const showPublished =
                          (selectedCategory === 'Published') ||
                          (!selectedCategory && (filterCategory === 'All Categories' || filterCategory === 'Published') && (expandedCategories.length === 0 || expandedCategories.includes('Published')));

                        if (!showPublished || publishedEntries.length === 0) return null;

                        const filteredPublished = searchQuery.trim()
                          ? publishedEntries.filter((entry: any) => {
                              const q = searchQuery.toLowerCase();
                              return (
                                entry.author_name?.toLowerCase().includes(q) ||
                                entry.title?.toLowerCase().includes(q) ||
                                'published'.includes(q)
                              );
                            })
                          : publishedEntries;

                        return filteredPublished.map((entry: any, idx: number) => (
                          <div key={`published-author-${idx}`} className="relative z-0">
                            <MemoryCard
                              image={entry.wallpaper_image || null}
                              title={entry.author_name}
                              dateRange={entry.published_at ? new Date(entry.published_at).toLocaleDateString() : ''}
                              location=""
                              category="Published"
                              categoryColor="#9333EA"
                              photosCount={entry.memories_count || 0}
                              imagesCount={entry.memories_count || 0}
                              countLabel="campaigns"
                              published={visibilityMap[entry.visibility] || 1}
                              label=""
                              tags={[]}
                              onClick={() => handlePublishedEntryClick(entry.short_url, entry)}
                            />
                          </div>
                        ));
                      })()}

                    </div>
                  ) : (
                    <div className="py-12 flex justify-center">
                      <AllMemoriesEmptyState
                        onCreateMemory={isPropertyOwner ? handleCreateMemory : undefined}
                        isLimitExceeded={isLimitExceeded}
                        onClearFilters={clearFilters}
                      />
                    </div>
                  )}
                </div>
              ) : (
                // List View - Use original table structure
                <div>
                  {/* Header Row - Hidden on mobile */}
                  <div className="hidden md:block px-6 py-4 bg-gray-50 border-b border-gray-100">
                    <div className="grid grid-cols-[auto_90px_90px_110px_120px_70px_1fr_90px_90px_110px_auto] gap-2 items-center text-sm font-medium text-gray-600">
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
                      <div className="font-medium">Tags</div>
                      <SortButton column="photos">Photos</SortButton>
                      <SortButton column="title">Campaign</SortButton>
                      <SortButton column="startDate">Start Date</SortButton>
                      <SortButton column="endDate">End Date</SortButton>
                      <SortButton column="lastVisited">Last Visited</SortButton>
                      <div>Actions</div>
                    </div>
                  </div>
                  
                  {/* Table Body */}
                  <div className="divide-y divide-gray-100">
                    {sortedSearchMemories.length > 0 ? (
                      sortedSearchMemories
                        .slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
                        .map((memory) => (
                          <div key={memory.id} className="px-4 md:px-6 py-4 hover:bg-gray-50 transition-colors">
                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1">
                                  <Checkbox
                                    checked={memory.isSelected}
                                    onCheckedChange={(checked) => handleSelectMemory(memory.id, checked)}
                                    className="data-[state=checked]:bg-[#6C60FF] data-[state=checked]:border-[#6C60FF] mt-1"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-2">{memory.title}</h3>
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gray-500 w-16">Category:</span>
                                        <span className="text-gray-900">{memory.category}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gray-500 w-16">Author:</span>
                                        <span className="text-gray-900">{memory.author}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gray-500 w-16">Label:</span>
                                        <Badge
                                          variant="secondary"
                                          className="bg-yellow-200 text-black px-2 py-0.5 rounded-full text-xs font-medium"
                                        >
                                          {memory.label}
                                        </Badge>
                                      </div>
                                      {memory.tags.length > 0 && (
                                        <div className="flex items-start gap-2 text-xs">
                                          <span className="text-gray-500 w-16 shrink-0">Tags:</span>
                                          <div className="flex flex-wrap gap-1">
                                            {memory.tags.map((tag, i) => (
                                              <span key={i} className="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-xs font-medium border border-gray-200">
                                                {tag}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gray-500 w-16">Photos:</span>
                                        <span className="bg-yellow-50 text-black px-2 py-0.5 rounded text-xs font-medium">
                                          {memory.photos}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gray-500 w-16">Dates:</span>
                                        <span className="text-gray-600">{memory.startDate} - {memory.endDate}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gray-500 w-16">Visited:</span>
                                        <span className="text-gray-600">{memory.lastVisited}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
                                      <MoreHorizontal className="h-4 w-4 text-gray-500" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48 bg-white border border-gray-200 shadow-lg rounded-md">
                                    <DropdownMenuItem
                                      className="cursor-pointer hover:bg-[#6C60FF]/5"
                                      onClick={() => handleViewDetails(memory)}
                                    >
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="cursor-pointer hover:bg-[#6C60FF]/5"
                                      onClick={() => handleEditMemory(memory)}
                                    >
                                      Edit Memory
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="cursor-pointer hover:bg-[#6C60FF]/5"
                                      onClick={() => {
                                        console.log('Share clicked for memory:', memory.id);
                                        // TODO: Open share dialog
                                      }}
                                    >
                                      Share
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="cursor-pointer text-red-600 hover:bg-red-50"
                                      onClick={() => handleDeleteMemory(memory)}
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:grid grid-cols-[auto_90px_90px_110px_120px_70px_1fr_90px_90px_110px_auto] gap-2 items-center text-sm">
                              <div>
                                <Checkbox
                                  checked={memory.isSelected}
                                  onCheckedChange={(checked) => handleSelectMemory(memory.id, checked)}
                                  className="data-[state=checked]:bg-[#6C60FF] data-[state=checked]:border-[#6C60FF]"
                                />
                              </div>
                              <div className="text-gray-900 truncate">{memory.category}</div>
                              <div className="text-gray-900 truncate">{memory.author}</div>
                              <div>
                                <Badge
                                  variant="secondary"
                                  className="bg-yellow-200 text-black px-2 py-1 rounded-full text-xs font-medium"
                                >
                                  {memory.label}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {memory.tags.length > 0 ? memory.tags.map((tag, i) => (
                                  <span key={i} className="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-xs font-medium border border-gray-200">
                                    {tag}
                                  </span>
                                )) : <span className="text-gray-400 text-xs">—</span>}
                              </div>
                              <div>
                                <span className="bg-yellow-50 text-black px-2 py-1 rounded text-sm font-medium inline-block">
                                  {memory.photos}
                                </span>
                              </div>
                              <div className="text-gray-900 font-medium truncate">{memory.title}</div>
                              <div className="text-gray-600">{memory.startDate}</div>
                              <div className="text-gray-600">{memory.endDate}</div>
                              <div className="text-gray-600">{memory.lastVisited}</div>
                              <div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
                                      <MoreHorizontal className="h-4 w-4 text-gray-500" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48 bg-white border border-gray-200 shadow-lg rounded-md">
                                    <DropdownMenuItem
                                      className="cursor-pointer hover:bg-[#6C60FF]/5"
                                      onClick={() => handleViewDetails(memory)}
                                    >
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="cursor-pointer hover:bg-[#6C60FF]/5"
                                      onClick={() => handleEditMemory(memory)}
                                    >
                                      Edit Memory 
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="cursor-pointer hover:bg-[#6C60FF]/5"
                                      onClick={() => {
                                        console.log('Share clicked for memory:', memory.id);
                                        // TODO: Open share dialog
                                      }}
                                    >
                                      Share
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="cursor-pointer text-red-600 hover:bg-red-50"
                                      onClick={() => handleDeleteMemory(memory)}
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="py-12 flex justify-center">
                        <AllMemoriesEmptyState
                          onCreateMemory={isPropertyOwner ? handleCreateMemory : undefined}
                          isLimitExceeded={isLimitExceeded}
                          onClearFilters={clearFilters}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Pagination */}
                  <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs md:text-sm text-gray-600">Rows per page:</span>
                        <Select value={rowsPerPage.toString()} onValueChange={(value) => setRowsPerPage(Number(value))}>
                          <SelectTrigger className="w-16 md:w-20 h-8 bg-white border-gray-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-xs md:text-sm text-gray-600">
                          {((currentPage - 1) * rowsPerPage) + 1}-{Math.min(currentPage * rowsPerPage, sortedSearchMemories.length)} of {sortedSearchMemories.length}
                        </span>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="h-8 w-8 p-0 hover:bg-gray-200"
                          >
                            <ChevronDown className="h-4 w-4 rotate-90" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="h-8 w-8 p-0 hover:bg-gray-200"
                          >
                            <ChevronDown className="h-4 w-4 rotate-180" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPage(Math.min(Math.ceil(sortedSearchMemories.length / rowsPerPage), currentPage + 1))}
                            disabled={currentPage === Math.ceil(sortedSearchMemories.length / rowsPerPage)}
                            className="h-8 w-8 p-0 hover:bg-gray-200"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPage(Math.ceil(sortedSearchMemories.length / rowsPerPage))}
                            disabled={currentPage === Math.ceil(sortedSearchMemories.length / rowsPerPage)}
                            className="h-8 w-8 p-0 hover:bg-gray-200"
                          >
                            <ChevronDown className="h-4 w-4 -rotate-90" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Create Memory Dialog */}
      <CreateMemory
        ref={createMemoryRef}
        open={showCreateMemory}
        onOpenChange={(open) => {
          setShowCreateMemory(open);
          // Clear selected category when modal closes
          if (!open) {
            setSelectedCategoryForCreate(undefined);
          }
        }}
        onMemoryCreated={handleMemoryCreated}
        onOpenMediaLibrary={() => {
          console.log('📸 Opening media library modal ON TOP of Create Memory modal');
          console.log('📸 Current isMediaLibraryOpen:', isMediaLibraryOpen);
          console.log('📸 Current showCreateMemory:', showCreateMemory);

          // Keep Create Memory modal open, just open Media Library on top
          console.log('📸 Opening Media Library modal (Create Memory stays open)');
          setIsMediaLibraryOpen(true);
          console.log('✅ Media library modal opened on top');
        }}
        selectedMediaLibraryImages={selectedMediaLibraryImagesForCreate}
        defaultCategory={selectedCategoryForCreate}
        categories={sidebarData?.categories?.items || categories}
      />

      {/* Memory Limit Dialog */}
      <MemoryLimitDialog
        isOpen={showLimitDialog}
        onClose={() => setShowLimitDialog(false)}
        memoryCount={limitData?.current_memories}
        memoryLimit={limitData?.memory_limit}
      />

      {/* Mobile Sidebar Drawer */}
      {showMobileSidebar && (
        <div className="fixed top-12 left-0 right-0 bottom-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={onCloseMobileSidebar}
          />

          {/* Sidebar Drawer */}
          <aside className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-xl overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Campaigns Library</h2>
              <button
                onClick={onCloseMobileSidebar}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* CategoryNav Content */}
            <div className="p-4">
              {sidebarData?.categories?.items ? (
                <CategoryNav
                  isStacked={false}
                  onToggleExpansion={() => {}}
                  canToggle={false}
                  categories={sidebarData.categories.items.filter((cat: any) => cat != null).map((cat: any) => ({
                    id: cat.id?.toString(),
                    name: cat.name,
                    count: cat.memory_count,
                    isUserCreated: cat.admin_id !== null,
                    admin_id: cat.admin_id,
                    color: cat.color,
                    suggested: cat.suggested || false
                  }))}
                  labels={sidebarData?.labels?.items?.filter((label: any) => label != null).map((label: any) => ({
                    id: label.id?.toString(),
                    name: label.name,
                    count: label.memory_count,
                    isUserCreated: label.admin_id !== null,
                    admin_id: label.admin_id
                  })) || []}
                  onCategoriesChange={() => {}}
                  onLabelsChange={() => {}}
                  memories={apiMemoriesData ? allMemories : []}
                  apiMemoriesData={apiMemoriesData}
                  onMemorySelect={(memoryId, options) => {
                    if (memoryId.startsWith('pa-')) {
                      const idx = parseInt(memoryId.replace('pa-', ''), 10);
                      const entry = publishedEntries[idx];
                      if (entry?.short_url) handlePublishedEntryClick(entry.short_url, entry);
                    } else {
                      onMemorySelect(memoryId, options);
                    }
                    if (onCloseMobileSidebar) onCloseMobileSidebar();
                  }}
                  selectedCategory={selectedCategory}
                  onCategorySelect={(categoryName) => {
                    if (onCategorySelect) {
                      onCategorySelect(categoryName);
                    }
                    if (onCloseMobileSidebar) onCloseMobileSidebar();
                  }}
                  expandedCategories={expandedCategories}
                  onFilterChange={() => {}}
                  onRefreshData={onRefreshMemories}
                  onCreateMemory={isPropertyOwner ? (categoryName) => {
                    handleCreateMemory(categoryName);
                    if (onCloseMobileSidebar) onCloseMobileSidebar();
                  } : undefined}
                  isPropertyOwner={isPropertyOwner}
                />
              ) : (
                <div className="text-center text-gray-500 py-4">
                  <p>Loading categories...</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && memoryToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Delete Memory
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{memoryToDelete.title}"? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setMemoryToDelete(null);
                }}
                className="border-gray-200 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteMemory}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg border ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {toast.type === 'success' ? (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <p className="font-medium text-sm">{toast.message}</p>
            <button
              onClick={() => setToast(null)}
              className="ml-2 flex-shrink-0 hover:opacity-70 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Media Library Modal */}
      {isMediaLibraryOpen && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => {
            setIsMediaLibraryOpen(false);
            setMediaLibrarySelectedItems([]);
          }} />
          <div className="relative z-[1051] max-w-3xl max-h-[90vh] w-full mx-4 bg-white flex flex-col rounded-lg overflow-hidden border border-gray-200 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#7B68EE]/10 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-[#7B68EE]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Add Moments from Library</h2>
                  <p className="text-xs text-gray-500">Select photos to add as moments</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsMediaLibraryOpen(false);
                  setMediaLibrarySelectedItems([]);
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search and Filter */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white flex gap-3 flex-shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search your media library..."
                  value={mediaLibrarySearchTerm}
                  onChange={(e) => setMediaLibrarySearchTerm(e.target.value)}
                  className="pl-10 border-gray-300 focus:border-gray-400 focus:ring-gray-400"
                />
              </div>
              <Select value={mediaLibraryCategory} onValueChange={setMediaLibraryCategory}>
                <SelectTrigger className="w-48 border-gray-300 focus:border-gray-400 focus:ring-gray-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="All Categories">All Categories</SelectItem>
                  {mediaLibraryCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selection Info */}
            <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">
                  <span className="text-[#6C60FF]">{mediaLibrarySelectedItems.length} of</span> {filteredMediaLibraryImages.length} selected
                </span>
                <button
                  onClick={() => {
                    setMediaLibrarySelectedItems(filteredMediaLibraryImages.map(p => p.id));
                  }}
                  className="text-sm text-[#6C60FF] hover:text-[#5850E5] font-medium"
                >
                  Select All
                </button>
              </div>
              <button
                onClick={() => setMediaLibrarySelectedItems([])}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                <X className="w-4 h-4" />
                Clear Selection
              </button>
            </div>

            {/* Media Grid */}
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-white">
              {isLoadingMediaLibrary ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6C60FF]"></div>
                </div>
              ) : filteredMediaLibraryImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ImageIcon className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-gray-600 font-medium">No images found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {mediaLibrarySearchTerm || mediaLibraryCategory !== "All Categories"
                      ? "Try adjusting your search or filter"
                      : "Upload some images to get started"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredMediaLibraryImages.map((post) => {
                    const isSelected = mediaLibrarySelectedItems.includes(post.id);
                    return (
                      <div
                        key={post.id}
                        onClick={() => {
                          setMediaLibrarySelectedItems(prev =>
                            prev.includes(post.id)
                              ? prev.filter(id => id !== post.id)
                              : [...prev, post.id]
                          );
                        }}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-all ${
                          isSelected ? 'ring-4 ring-[#6C60FF]' : 'hover:ring-2 hover:ring-gray-300'
                        }`}
                      >
                        <img
                          src={post.image}
                          alt={post.name || 'Media item'}
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-[#6C60FF] rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                          <p className="text-white text-xs truncate">{post.name || 'Untitled'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => {
                  setIsMediaLibraryOpen(false);
                  setMediaLibrarySelectedItems([]);
                }}
                className="border-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const selectedImages = filteredMediaLibraryImages.filter(img =>
                    mediaLibrarySelectedItems.includes(img.id)
                  );
                  console.log('Selected images from library:', selectedImages);
                  setSelectedMediaLibraryImagesForCreate(selectedImages);
                  setIsMediaLibraryOpen(false);
                  setMediaLibrarySelectedItems([]);
                  setShowCreateMemory(true);
                }}
                disabled={mediaLibrarySelectedItems.length === 0}
                className="bg-[#6C60FF] hover:bg-[#5850E5] text-white"
              >
                Add to Campaign ({mediaLibrarySelectedItems.length})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Memories Modal */}
      <PublishMemoriesModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        memories={allMemories || []}
        categories={sidebarData?.categories?.items || []}
        onPublish={(ids, visibility, wallpaper) => handlePublishMemories(ids, visibility, wallpaper)}
        userProfileImage={(user as any)?.avatar || (user as any)?.profile_image}
        userProfileColor={(user as any)?.profile_color}
      />

      {/* Add Tags Modal */}
      <AddTagsModal
        open={showAddTagsModal}
        onClose={() => setShowAddTagsModal(false)}
        onConfirm={handleAddTags}
        selectedCount={selectedCardIds.size}
        existingTags={Array.from(new Set(
          [...allMemories, ...latestMemories, ...sharedWithMemories]
            .flatMap((m: any) => Array.isArray(m.tags) ? m.tags.map((t: any) => typeof t === 'string' ? t : t.name) : [])
            .filter(Boolean)
        ))}
      />

      {/* Merge Campaigns Modal */}
      <MergeStoriesModal
        open={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        onConfirm={handleMergeStories}
        selectedCount={selectedCardIds.size}
      />

      {/* Add More AI Credits Modal */}
      {showAddCreditsModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[380px] p-5 relative">
            {/* Close */}
            <button
              onClick={() => setShowAddCreditsModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header row: icon + title + subtitle */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-[#F3E8FF] flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-[#9333EA]" fill="#9333EA" />
              </div>
              <div>
                <h2 className="text-base font-medium text-gray-900 leading-tight">Add more AI Credits</h2>
                <p className="text-sm text-gray-500 mt-0.5">{availableCredits} Credits</p>
              </div>
            </div>

            {/* Body */}
            <p className="text-gray-700 text-sm leading-relaxed mb-5">
              You have run out of Ai credits. Please purchase more to continue.
            </p>

            {/* Button */}
            <button
              onClick={() => {
                setShowAddCreditsModal(false);
                sessionStorage.setItem('openPurchaseCreditsModal', 'true');
                onNavigate?.('billing');
              }}
              className="w-full h-12 rounded-xl bg-[#9333EA] hover:bg-[#7E22CE] text-white font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Zap className="w-4 h-4" fill="white" />
              Buy more Credits
            </button>
          </div>
        </div>
      )}

      {/* AI Campaign Wizard Results Modal */}
      {isAIResultsModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center md:p-4">
          <div className="bg-white md:rounded-2xl rounded-none shadow-xl md:max-w-2xl w-full h-full md:h-auto md:max-h-[90vh] flex flex-col relative">
            {/* Mobile Header */}
            <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <h4 className="font-semibold text-[18px] text-gray-900">AI Campaign Wizard</h4>
              <button
                onClick={() => { setIsAIResultsModalOpen(false); setSelectedAnalysisOption(null); setCustomPrompt(''); }}
                className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="!w-[28px] !h-[28px] text-black" />
              </button>
            </div>
            {/* Desktop Close button */}
            <button
              onClick={() => { setIsAIResultsModalOpen(false); setSelectedAnalysisOption(null); setCustomPrompt(''); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10 hidden md:flex"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Desktop Header */}
            <div className="hidden md:block p-6 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100">
                    <Sparkles className="w-5 h-5" style={{ color: '#6C60FF' }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">AI Campaign Wizard</h2>
                    <p className="text-sm text-gray-600">AI-powered campaign organisation</p>
                  </div>
                </div>
                <div className="bg-white rounded-full px-4 py-2 shadow-sm border border-gray-200 flex items-center gap-2 mr-8">
                  <Sparkles className="w-4 h-4 text-[#6C60FF]" />
                  <span className="text-gray-900 font-medium text-sm">2 credits</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-4">Custom Prompt</h3>
                  <div className="relative">
                    <textarea
                      className="w-full h-40 p-4 bg-gray-100 border-0 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-700"
                      placeholder="Describe how you'd like the AI to help you create your next campaign..."
                      maxLength={1000}
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                    />
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-sm text-gray-500">{customPrompt.length}/1000 characters</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 p-4 md:p-6 pb-[50px] md:pb-6 border-t border-gray-100 bg-gray-50">
              <div className="flex justify-end items-center">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsAIResultsModalOpen(false)}
                    className="h-12 md:h-9 px-6 text-[14px] md:text-sm border-gray-300"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAIWizardApply}
                    disabled={isGeneratingFromPrompt || !customPrompt.trim()}
                    className="h-12 md:h-9 px-6 text-[14px] md:text-sm bg-[#6C60FF] text-white hover:bg-[#5B52FF] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingFromPrompt ? 'Processing...' : 'Apply'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Campaign Wizard Progress Modal */}
      {isAIWizardModalOpen && (
        <>
          {/* Backdrop — only when not minimized */}
          {!aiWizardMinimized && (
            <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          )}

          {/* Modal card — only show when not minimized (sidebar handles minimized state) */}
          {!aiWizardMinimized && <div
            className="fixed z-50 bg-white transition-all duration-700 ease-in-out"
            style={aiWizardMinimized ? {
              bottom: '24px',
              left: '24px',
              top: 'auto',
              right: 'auto',
              transform: 'none',
              borderRadius: '20px',
              width: '300px',
              padding: '14px 16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
              border: '1px solid rgba(0,0,0,0.06)',
            } : {
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              borderRadius: '16px',
              width: '480px',
              padding: '32px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            {/* Full view */}
            {!aiWizardMinimized && (
              <>
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100">
                    <Sparkles className="w-7 h-7" style={{ color: '#6C60FF' }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-base">AI Campaign Wizard</h3>
                    <p className="text-sm text-gray-500">Analysing the moments with AI...</p>
                  </div>
                </div>
                <div className="flex justify-center my-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-gray-200 animate-pulse"></div>
                    <div
                      className="absolute inset-0 w-20 h-20 rounded-full border-4 border-t-transparent animate-spin"
                      style={{ borderColor: '#6C60FF', borderTopColor: 'transparent' }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-8 h-8" style={{ color: '#EC4899' }} />
                    </div>
                  </div>
                </div>
                <p className="text-center text-sm text-gray-600 mb-6">Understanding your memories, emotions, and campaign themes to craft the best narrative.</p>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${aiWizardProgress}%`, background: 'linear-gradient(to right, #6C60FF, #EC4899)' }}
                  />
                </div>
                <p className="text-sm text-center text-gray-500 mt-3">Analysing moments... {Math.round(aiWizardProgress)}%</p>
              </>
            )}

          </div>}
        </>
      )}
    </div>
  );
}

// Main export - provider now at App level
export default function MemoriesPage(props: MemoriesPageProps) {
  return <MemoriesPageContent {...props} />;
}
