import { useState, useRef, useEffect } from 'react';
import { Check, X, Move, Trash2, Archive, FolderOpen, Download, Tag, Share, MoreHorizontal, Play, Image as ImageIcon, Plus, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { ImageWithFallback } from './figma/ImageWithFallback';
import MemorySelectionDialog from './MemorySelectionDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { dashboardAPI } from '../utils/authUtils';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface BatchActionsProps {
  selectedItems: string[];
  allItems: any[];
  onSelectionChange: (items: string[]) => void;
  onDeleteItems: (items: string[]) => void;
  onMoveItems: (items: string[], category: string) => void;
  onAddToMemory: (items: string[], memoryIds?: string[], memoryTitles?: string[], category?: string) => void;
  availableCategories: string[];
  memories: any[];
  onRefresh?: () => void;
  onAddToMoment?: () => void;
  onDownload?: (items: string[]) => void;
}

export default function BatchActions({
  selectedItems,
  allItems = [], // Add default empty array
  onSelectionChange,
  onDeleteItems,
  onMoveItems,
  onAddToMemory,
  availableCategories,
  memories,
  onRefresh,
  onAddToMoment,
  onDownload
}: BatchActionsProps) {
  // Debug memories data
  console.log('🔍 BatchActions Debug:');
  console.log('memories prop:', memories);
  console.log('memories length:', memories?.length);
  console.log('memories content:', JSON.stringify(memories, null, 2));
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isMoving, setIsMoving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMemoryDialog, setShowMemoryDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddTagsDialog, setShowAddTagsDialog] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [isAddingTags, setIsAddingTags] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    const container = thumbnailContainerRef.current;
    if (!container) return;
    const calculate = () => {
      const thumbWidth = window.innerWidth >= 640 ? 80 : 56; // w-20 sm / w-14 mobile
      const gap = 6; // gap-1.5
      const count = Math.floor((container.offsetWidth + gap) / (thumbWidth + gap));
      setVisibleCount(Math.max(1, count));
    };
    calculate();
    const observer = new ResizeObserver(calculate);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Filter out categories that users can't move items to
  const editableCategories = availableCategories.filter(category => 
    category !== 'Shared With' && category !== 'Published'
  );

  const handleSelectAll = () => {
    if (selectedItems.length === allItems.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allItems.map(item => item.id));
    }
  };

  const handleClearSelection = () => {
    onSelectionChange([]);
  };

  const handleMoveToCategory = async () => {
    if (!selectedCategory || selectedItems.length === 0) return;
    
    setIsMoving(true);
    try {
      await onMoveItems(selectedItems, selectedCategory);
      setSelectedCategory('');
      onSelectionChange([]);
    } catch (error) {
      console.error('Error moving items:', error);
    } finally {
      setIsMoving(false);
    }
  };

  const handleDeleteItems = async () => {
    console.log('🔵 BatchActions: handleDeleteItems called');
    console.log('🔵 BatchActions: selectedItems:', selectedItems);

    if (selectedItems.length === 0) return;

    // Show custom confirmation dialog instead of browser confirm
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    console.log('🔵 BatchActions: handleDeleteConfirm called');
    console.log('🔵 BatchActions: Calling onDeleteItems with:', selectedItems);

    setIsDeleting(true);
    try {
      await onDeleteItems(selectedItems);
      onSelectionChange([]);
      setShowDeleteDialog(false);
      console.log('🔵 BatchActions: Delete completed successfully');
    } catch (error) {
      console.error('🔵 BatchActions: Error deleting items:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddTagFromInput = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    const newTags = trimmed.split(',').map(t => t.trim()).filter(t => t && !pendingTags.includes(t));
    if (newTags.length > 0) setPendingTags(prev => [...prev, ...newTags]);
    setTagInput('');
    tagInputRef.current?.focus();
  };

  const handleApplyTags = async () => {
    if (pendingTags.length === 0) {
      toast.error('Please add at least one tag');
      return;
    }
    setIsAddingTags(true);
    try {
      const res = await dashboardAPI.bulkUpdateTags(selectedItems, pendingTags);
      if (res.success) {
        toast.success(`Tags added to ${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''}`);
        setShowAddTagsDialog(false);
        setPendingTags([]);
        setTagInput('');
        onSelectionChange([]);
        if (onRefresh) onRefresh();
      } else {
        toast.error(res.error || 'Failed to add tags');
      }
    } catch (error) {
      toast.error('Failed to add tags');
    } finally {
      setIsAddingTags(false);
    }
  };

  const handleAddToMemoryClick = () => {
    setShowMemoryDialog(true);
  };

  const handleMemorySelection = (memoryIds: string[], memoryTitles?: string[], category?: string) => {
    onAddToMemory(selectedItems, memoryIds, memoryTitles, category);
    setShowMemoryDialog(false);
    onSelectionChange([]);
  };

  const getSelectedItemsInfo = () => {
    // Guard against undefined or null allItems
    if (!Array.isArray(allItems)) {
      return { imageCount: 0, videoCount: 0, totalCount: selectedItems.length, selectedItemsData: [] };
    }

    const selectedSet = new Set(selectedItems.map(id => String(id)));
    const selectedItemsData = allItems.filter(item => selectedSet.has(String(item.id)));
    const imageCount = selectedItemsData.filter(item => item.type === 'image').length;
    const videoCount = selectedItemsData.filter(item => item.type === 'video').length;
    
    return { 
      imageCount, 
      videoCount, 
      totalCount: selectedItems.length, 
      selectedItemsData: selectedItemsData.map(item => ({
        id: item.id,
        name: item.name,
        thumbnail: item.thumbnail,
        type: item.type
      }))
    };
  };

  const { imageCount, videoCount, totalCount, selectedItemsData } = getSelectedItemsInfo();

  // Create category objects for the dialog - also filter out restricted categories
  const categoryObjects = editableCategories.map(cat => ({
    name: cat,
    color: '#6C60FF', // Default purple color
    count: 0
  }));

  if (selectedItems.length === 0) {
    return null;
  }

  return (
    <>
      <div className="sticky top-16 z-50 bg-white border-b border-gray-200 px-3 py-3 sm:px-6 sm:py-4 space-y-3 shadow-sm">

        {/* Row 1: X + count + badges + actions */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: clear + count + badges */}
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>

            <span className="text-sm font-medium whitespace-nowrap">
              {totalCount} item{totalCount !== 1 ? 's' : ''} selected
            </span>

            <div className="hidden sm:flex items-center gap-2">
              {imageCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <ImageIcon className="w-3 h-3 mr-1" />
                  {imageCount} image{imageCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {videoCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Play className="w-3 h-3 mr-1" />
                  {videoCount} video{videoCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="h-8 text-xs px-2 sm:px-3"
            >
              <Check className="w-3 h-3 sm:mr-1" />
              <span className="hidden sm:inline">
                {selectedItems.length === allItems.length ? 'Deselect All' : 'Select All'}
              </span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleAddToMemoryClick}
              className="h-8 text-xs px-2 sm:px-3"
            >
              <FolderOpen className="w-3 h-3 sm:mr-1" />
              <span className="hidden sm:inline">Add to Campaign</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white border border-gray-200">
                {onAddToMoment && (
                  <>
                    <DropdownMenuItem onClick={onAddToMoment} className="cursor-pointer">
                      <Star className="w-4 h-4 mr-2 text-gray-900" />
                      Add to Moment
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => onDownload?.(selectedItems)} className="cursor-pointer">
                  <Download className="w-4 h-4 mr-2" />
                  Download Selected
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Tag className="w-4 h-4 mr-2" />
                  Add Labels
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setPendingTags([]); setTagInput(''); setShowAddTagsDialog(true); }}>
                  <Tag className="w-4 h-4 mr-2" />
                  Add Tags
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Share className="w-4 h-4 mr-2" />
                  Share Selected
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive Selected
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDeleteItems}
                  disabled={isDeleting}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isDeleting ? 'Deleting...' : 'Remove Selected'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Row 2: Thumbnail preview — fills available width, no overflow */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-500 font-medium whitespace-nowrap flex-shrink-0">Selected:</span>
          <div ref={thumbnailContainerRef} className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
            {(() => {
              const hasOverflow = selectedItemsData.length > visibleCount;
              const displayCount = hasOverflow ? visibleCount - 1 : selectedItemsData.length;
              const remaining = selectedItemsData.length - displayCount;
              return (
                <>
                  {selectedItemsData.slice(0, displayCount).map((item) => (
                    <div key={item.id} className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                      <ImageWithFallback
                        src={item.thumbnail}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      {item.type === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-black/70 text-white p-0.5 rounded">
                            <Play className="w-2 h-2" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {remaining > 0 && (
                    <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 border border-gray-200 flex-shrink-0">
                      +{remaining}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

      </div>

      {/* Memory Selection Dialog */}
      <MemorySelectionDialog
        isOpen={showMemoryDialog}
        onClose={() => setShowMemoryDialog(false)}
        onSelectMemory={handleMemorySelection}
        memories={memories}
        availableCategories={categoryObjects}
        selectedItems={selectedItemsData}
        onRefresh={onRefresh}
        onClearSelection={() => onSelectionChange([])}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-white border-0">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Images</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {totalCount} image{totalCount !== 1 ? 's' : ''}? This action cannot be undone and will permanently remove the selected images from your media library.
              <br /><br />
              <strong>Images to delete: {totalCount} image{totalCount !== 1 ? 's' : ''}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Tags Dialog */}
      <Dialog open={showAddTagsDialog} onOpenChange={(open) => { if (!isAddingTags) { setShowAddTagsDialog(open); if (!open) { setPendingTags([]); setTagInput(''); } } }}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#6C60FF]" />
              Add Tags to {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Tag input with autocomplete */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTagFromInput(); } }}
                  placeholder="Search or add tags..."
                  className="w-full bg-white border border-gray-200 focus:border-[#6C60FF] focus:ring-0"
                />
                {tagInput.trim() && (() => {
                  const allTagsFromItems: string[] = Array.from(
                    new Set(
                      allItems.flatMap((item: any) =>
                        (item.tags || []).map((t: any) => typeof t === 'string' ? t : t?.name).filter(Boolean)
                      )
                    )
                  );
                  const matches = allTagsFromItems.filter(
                    t => t.toLowerCase().includes(tagInput.trim().toLowerCase()) && !pendingTags.includes(t)
                  );
                  return matches.length > 0 ? (
                    <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-md mt-1 overflow-hidden">
                      {matches.slice(0, 6).map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (!pendingTags.includes(tag)) setPendingTags(prev => [...prev, tag]);
                            setTagInput('');
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Tag className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          {tag}
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
              <Button
                type="button"
                onClick={handleAddTagFromInput}
                disabled={!tagInput.trim()}
                className="bg-[#6C60FF] hover:bg-[#5B4FE8] text-white disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Pending tags */}
            {pendingTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pendingTags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-gray-200 text-gray-900 text-[14px] rounded-full border border-gray-300">
                    <span className="leading-none">{tag}</span>
                    <button
                      type="button"
                      onClick={() => setPendingTags(prev => prev.filter(t => t !== tag))}
                      className="hover:text-red-500 flex-shrink-0 inline-flex items-center justify-center rounded-full w-4 h-4 leading-none"
                    >
                      <X className="w-3 h-3" strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {pendingTags.length === 0 && (
              <p className="text-xs text-gray-400">Type a tag and press Enter or click + to add it</p>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setShowAddTagsDialog(false)} disabled={isAddingTags}>
                Cancel
              </Button>
              <Button
                onClick={handleApplyTags}
                disabled={pendingTags.length === 0 || isAddingTags}
                className="bg-[#6C60FF] hover:bg-[#5B4FE8] text-white disabled:opacity-40"
              >
                {isAddingTags ? 'Applying...' : `Apply to ${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}