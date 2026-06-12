import React from 'react';
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

interface MemoryLimitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  memoryCount?: number;
  memoryLimit?: number;
  limitType?: 'memory' | 'ai_credits';
  onGoToAccount?: () => void;
  onDeleteMemories?: () => void;
}

export function MemoryLimitDialog({
  isOpen,
  onClose,
  memoryCount,
  memoryLimit,
  limitType = 'memory',
  onGoToAccount,
  onDeleteMemories
}: MemoryLimitDialogProps) {
  // Use actual values if available, otherwise show loading state
  const displayLimit = memoryLimit || 0;
  const displayCount = memoryCount || 0;

  const isAICreditsLimit = limitType === 'ai_credits';

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-md bg-white border-0 shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full ${isAICreditsLimit ? 'bg-purple-100' : 'bg-amber-100'} flex items-center justify-center`}>
              {isAICreditsLimit ? (
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              )}
            </div>
            {isAICreditsLimit ? 'AI Credits Limit Reached' : 'Campaign Limit Reached'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-600 leading-relaxed">
            {isAICreditsLimit ? (
              <>
                Your AI credits have been exhausted. You have <strong>0 AI credits</strong> remaining.
                Go to account to upgrade your plan and get more AI credits.
              </>
            ) : (
              <>
                Your plan limit has been reached. You have reached your campaign limit of <strong>{displayLimit} campaigns</strong>.
                Go to account to upgrade your plan or delete some campaigns.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel
            onClick={onClose}
            className="border-gray-200 hover:bg-gray-50"
          >
            Cancel
          </AlertDialogCancel>
          {!isAICreditsLimit && onDeleteMemories && (
            <AlertDialogAction
              onClick={onDeleteMemories}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Campaigns
            </AlertDialogAction>
          )}
          {onGoToAccount && (
            <AlertDialogAction
              onClick={onGoToAccount}
              className="bg-[#6C60FF] hover:bg-[#5B4FE8] text-white"
            >
              Go to Account
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}