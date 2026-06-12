import React from 'react';
import { X, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from './ui/button';

interface InsufficientCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditsNeeded: number;
  creditsAvailable: number;
  onBuyCredits: () => void;
  onUpgradePlan?: () => void;
}

export function InsufficientCreditsModal({
  isOpen,
  onClose,
  creditsNeeded,
  creditsAvailable,
  onBuyCredits,
  onUpgradePlan
}: InsufficientCreditsModalProps) {
  if (!isOpen) return null;

  const shortage = creditsNeeded - creditsAvailable;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Insufficient Credits</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-6">
            You need <span className="font-semibold text-gray-900">{creditsNeeded} {creditsNeeded === 1 ? 'credit' : 'credits'}</span> to perform this operation,
            but you only have <span className="font-semibold text-gray-900">{creditsAvailable} {creditsAvailable === 1 ? 'credit' : 'credits'}</span> available.
          </p>

          {/* Credit Shortage Display */}
          <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-100">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">
                You need {shortage} more {shortage === 1 ? 'credit' : 'credits'}
              </span>
            </div>
            <p className="text-xs text-orange-700">
              Purchase credits to continue using AI features
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={() => {
                onClose();
                onBuyCredits();
              }}
              className="w-full bg-gradient-to-r from-[#6C60FF] to-[#5B52FF] hover:from-[#5B52FF] hover:to-[#4A42E5] text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Buy More Credits
            </Button>

            {onUpgradePlan && (
              <Button
                onClick={() => {
                  onClose();
                  onUpgradePlan();
                }}
                variant="outline"
                className="w-full"
              >
                Upgrade Plan
              </Button>
            )}

            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full"
            >
              Maybe Later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
