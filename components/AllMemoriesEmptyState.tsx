import { Search, Plus } from "lucide-react";
import { Button } from "./ui/button";

interface AllMemoriesEmptyStateProps {
  onClearFilters?: () => void;
  onCreateMemory?: () => void;
  isLimitExceeded?: boolean;
}

export default function AllMemoriesEmptyState({ onClearFilters, onCreateMemory, isLimitExceeded }: AllMemoriesEmptyStateProps) {
  return (
    <div className="px-6 py-12 text-center">
      {/* Search Icon */}
      <div className="flex justify-center mb-4">
        <Search className="w-12 h-12 text-gray-400" strokeWidth={1.5} />
      </div>

      {/* Heading */}
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        No campaigns found
      </h3>

      {/* Subtitle */}
      <p className="text-gray-600 mb-6">
        Try adjusting your search or filter criteria
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
        {onCreateMemory && (
          <Button
            onClick={isLimitExceeded ? undefined : onCreateMemory}
            disabled={isLimitExceeded}
            className={isLimitExceeded
              ? "bg-gray-400 text-white hover:bg-gray-400 cursor-not-allowed opacity-60"
              : "bg-[#6C60FF] text-white hover:bg-[#5B52FF]"
            }
            title={isLimitExceeded ? "Campaign limit reached - cannot create new campaigns" : "Create Campaign"}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        )}

        {onClearFilters && (
          <Button
            variant="outline"
            onClick={onClearFilters}
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Clear all filters
          </Button>
        )}
      </div>
    </div>
  );
}