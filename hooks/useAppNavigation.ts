import { useState, useCallback } from "react";

export function useAppNavigation() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [memoryHistory, setMemoryHistory] = useState<string[]>([]);
  const [memoriesNavKey, setMemoriesNavKey] = useState(0);
  const [isSubSidebarExpanded, setIsSubSidebarExpanded] = useState(true);
  const [shouldOpenAddMoments, setShouldOpenAddMoments] = useState(false);
  const [shouldOpenEdit, setShouldOpenEdit] = useState(false);
  const [shouldOpenComments, setShouldOpenComments] = useState(false);
  const [commentId, setCommentId] = useState<string | undefined>(undefined);
  const [shouldOpenImageModal, setShouldOpenImageModal] = useState(false);
  const [imageId, setImageId] = useState<string | undefined>(undefined);
  const [shouldOpenModerationTab, setShouldOpenModerationTab] = useState(false);
  const [shouldOpenCollaboratorsTab, setShouldOpenCollaboratorsTab] = useState(false);
  const [forceSharedView, setForceSharedView] = useState(false);

  const handleNavigation = useCallback((page: string) => {
    setCurrentPage(page);
    setSelectedMemoryId(null); // Reset memory selection when navigating
    // Always bump memoriesNavKey when navigating to memories so App.tsx
    // can react even when currentPage is already "memories"
    if (page === 'memories') {
      setMemoriesNavKey(prev => prev + 1);
    }
    setShouldOpenAddMoments(false); // Reset Add Moments flag
    setShouldOpenEdit(false); // Reset Edit flag
    setShouldOpenComments(false); // Reset Comments flag
    setCommentId(undefined); // Reset comment ID
    setShouldOpenImageModal(false); // Reset Image Modal flag
    setImageId(undefined); // Reset image ID
    setShouldOpenModerationTab(false); // Reset Moderation Tab flag
    setShouldOpenCollaboratorsTab(false); // Reset Collaborators Tab flag
    console.log('Navigating to:', page);

    // Update browser URL to match the page (without page reload)
    const urlMap: Record<string, string> = {
      'dashboard': '/',
      'memories': '/stories',
      'media': '/media',
      'profile': '/profile',
      'leads': '/leads',
      'users': '/users'
    };

    const newUrl = urlMap[page] || '/';

    // Only update URL if it's different from current URL
    if (window.location.pathname !== newUrl) {
      console.log('🔗 Updating URL from', window.location.pathname, 'to', newUrl);
      window.history.pushState({}, '', newUrl);
    }

    // Set sub-sidebar to expanded when navigating to non-dashboard pages
    if (page !== "dashboard") {
      setIsSubSidebarExpanded(true);
    }
  }, []);

  const handleMemorySelect = useCallback((memoryId: string, options?: boolean | string | { openComments?: boolean; commentId?: string; openImageModal?: boolean; imageId?: string | number; openModerationTab?: boolean; openCollaboratorsTab?: boolean; forceSharedView?: boolean }) => {
    console.log('Memory selected:', memoryId, 'Options:', options);
    setSelectedMemoryId(memoryId);

    // Reset all flags first
    setShouldOpenAddMoments(false);
    setShouldOpenEdit(false);
    setShouldOpenComments(false);
    setCommentId(undefined);
    setShouldOpenImageModal(false);
    setImageId(undefined);
    setShouldOpenModerationTab(false);
    setShouldOpenCollaboratorsTab(false);
    setForceSharedView(false);

    // Handle options parameter
    if (typeof options === 'object' && options !== null) {
      // New object-based options
      if (options.openComments) {
        setShouldOpenComments(true);
        setCommentId(options.commentId);
        console.log('Setting shouldOpenComments to true with commentId:', options.commentId);
      }
      if (options.openImageModal) {
        setShouldOpenImageModal(true);
        setImageId(options.imageId?.toString());
        setCommentId(options.commentId);
        console.log('Setting shouldOpenImageModal with imageId:', options.imageId, 'commentId:', options.commentId);
      }
      if (options.openModerationTab) {
        setShouldOpenModerationTab(true);
        console.log('Setting shouldOpenModerationTab to true');
      }
      if (options.openCollaboratorsTab) {
        setShouldOpenCollaboratorsTab(true);
        console.log('Setting shouldOpenCollaboratorsTab to true');
      }
      if (options.forceSharedView) {
        setForceSharedView(true);
      }
    } else if (options === "edit") {
      // Legacy string option
      setShouldOpenEdit(true);
      console.log('Setting shouldOpenEdit to true');
    } else if (options === true) {
      // Legacy boolean option
      setShouldOpenAddMoments(true);
      console.log('Setting shouldOpenAddMoments to true');
    }

    if (currentPage !== "memories") {
      setCurrentPage("memories");
    }
  }, [currentPage]);

  const handleLinkedMemorySelect = useCallback((newMemoryId: string) => {
    setSelectedMemoryId(prev => {
      if (prev) setMemoryHistory(h => [...h, prev]);
      return newMemoryId;
    });
  }, []);

  const handleBackFromMemory = useCallback(() => {
    // If there's a history stack, pop and go back to previous memory
    setMemoryHistory(prev => {
      if (prev.length > 0) {
        const previousId = prev[prev.length - 1];
        setSelectedMemoryId(previousId);
        return prev.slice(0, -1);
      }

      // No history — original back behaviour
      setSelectedMemoryId(null);
      setShouldOpenAddMoments(false);
      setShouldOpenEdit(false);
      setShouldOpenComments(false);
      setCommentId(undefined);
      setShouldOpenImageModal(false);
      setImageId(undefined);
      setShouldOpenModerationTab(false);
      setShouldOpenCollaboratorsTab(false);
      setForceSharedView(false);

      const closeFromPostLink = sessionStorage.getItem('closeFromPostLink');
      if (closeFromPostLink === 'true') {
        sessionStorage.removeItem('closeFromPostLink');
        setCurrentPage('memories');
        window.history.pushState({}, '', '/stories');
      }

      return prev;
    });
  }, []);

  const toggleSubSidebarExpansion = useCallback(() => {
    console.log('🔄 toggleSubSidebarExpansion called! Current state:', isSubSidebarExpanded);
    setIsSubSidebarExpanded(prev => {
      console.log('📐 Setting sub-sidebar expanded from', prev, 'to', !prev);
      return !prev;
    });
  }, []);


  // Determine if sub-sidebar should be shown
  const shouldShowSubSidebar = currentPage !== "dashboard" && currentPage !== "users" && currentPage !== "leads" && currentPage !== "apps" && currentPage !== "library" && currentPage !== "marketplace" && currentPage !== "storeel-report" && !selectedMemoryId;
  
  console.log('🧭 useAppNavigation - currentPage:', currentPage, 'shouldShowSubSidebar:', shouldShowSubSidebar);

  return {
    currentPage,
    selectedMemoryId,
    memoriesNavKey,
    isSubSidebarExpanded,
    shouldShowSubSidebar,
    shouldOpenAddMoments,
    setShouldOpenAddMoments,
    shouldOpenEdit,
    setShouldOpenEdit,
    shouldOpenComments,
    setShouldOpenComments,
    commentId,
    shouldOpenImageModal,
    setShouldOpenImageModal,
    imageId,
    shouldOpenModerationTab,
    setShouldOpenModerationTab,
    shouldOpenCollaboratorsTab,
    setShouldOpenCollaboratorsTab,
    forceSharedView,
    handleNavigation,
    handleMemorySelect,
    handleLinkedMemorySelect,
    handleBackFromMemory,
    toggleSubSidebarExpansion,
  };
}