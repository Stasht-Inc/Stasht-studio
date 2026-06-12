import { useState } from "react";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { dashboardAPI } from "../utils/authUtils";
import { triggerMemoryCountsRefresh } from '../hooks/useMemoryCounts';
import { recheckMemoryLimit } from '../hooks/useMemoryLimit';

interface MemoryActionMenuProps {
  memoryId: string;
  memoryTitle?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onRefresh?: () => void;
}

export default function MemoryActionMenu({ 
  memoryId, 
  memoryTitle = "this campaign",
  onEdit,
  onDelete,
  onRefresh
}: MemoryActionMenuProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = () => {
    console.log('Edit button clicked for memory:', memoryId);
    if (onEdit) {
      onEdit();
    } else {
      // Default edit behavior - could navigate to edit page
      console.log('No onEdit handler provided');
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      console.log(`Deleting memory ${memoryId}...`);
      const response = await dashboardAPI.deleteMemory(memoryId);
      
      if (response.success) {
        console.log('Memory deleted successfully');
        setShowDeleteDialog(false);

        // Recheck memory limit and refresh page
        await recheckMemoryLimit();
        
        // Call custom delete handler if provided
        if (onDelete) {
          onDelete();
        }
        
        // Refresh the page/list if refresh handler provided
        if (onRefresh) {
          onRefresh();
        }
      } else {
        console.error('Failed to delete memory:', response.error);
        alert(`Failed to delete campaign: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting memory:', error);
      alert('An error occurred while deleting the campaign');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-gray-100"
            onClick={(e) => {
              e.stopPropagation();
              console.log('Action menu button clicked for memory:', memoryId);
            }}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-48 bg-white border border-gray-200 shadow-lg"
        >
          <DropdownMenuItem 
            onClick={(e) => {
              e.stopPropagation();
              console.log('Edit menu item clicked');
              handleEdit();
            }}
            className="cursor-pointer"
          >
            <Edit className="w-4 h-4 mr-2" />
            View/Edit Campaign
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              console.log('Delete menu item clicked');
              handleDeleteClick();
            }}
            className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Campaign
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone and will permanently remove the campaign and all its associated photos.
              <br /><br />
              <strong>Campaign to delete: {memoryTitle}</strong>
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
    </>
  );
}