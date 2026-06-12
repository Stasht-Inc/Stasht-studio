import { Plus } from "lucide-react";
import { Button } from "./ui/button";

interface EmptyMemoriesStateProps {
  onCreateMemory?: () => void;
  isLimitExceeded?: boolean;
}

export default function EmptyMemoriesState({ onCreateMemory, isLimitExceeded }: EmptyMemoriesStateProps) {
  return (
    <div className="text-center max-w-lg mx-auto">
      {/* Folder/Archive Icon */}
      <div className="flex justify-center mb-6">
        <svg 
          className="w-16 h-16 text-gray-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          strokeWidth={1.2}
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M20 6H10l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" 
          />
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M6 10h12" 
          />
        </svg>
      </div>

      {/* Heading */}
      <h3 className="text-xl font-semibold text-gray-900 mb-4">
        No campaigns yet
      </h3>

      {/* Subtitle */}
      <p className="text-gray-600 mb-8 leading-relaxed">
        Start creating your first campaign to capture special moments
      </p>

      {/* Create Campaign Button */}
      <Button
        onClick={isLimitExceeded ? undefined : onCreateMemory}
        disabled={isLimitExceeded}
        className={isLimitExceeded
          ? "bg-gray-400 text-white hover:bg-gray-400 cursor-not-allowed opacity-60 px-6 py-3 rounded-lg font-medium inline-flex items-center gap-2"
          : "bg-[#6C60FF] hover:bg-[#5B4FE8] text-white px-6 py-3 rounded-lg font-medium inline-flex items-center gap-2"
        }
        title={isLimitExceeded ? "Campaign limit reached - cannot create new campaigns" : "Create Campaign"}
      >
        <Plus className="w-4 h-4" />
        Create Campaign
      </Button>
    </div>
  );
}