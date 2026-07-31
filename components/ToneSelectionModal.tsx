import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles } from 'lucide-react';

interface ToneSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToneSelect: (tone: string) => void;
  buttonRef?: React.RefObject<HTMLElement>;
}

const toneOptions = [
  { id: 'personal', label: 'Personal', description: 'Casual and friendly tone' },
  { id: 'sales_rep', label: 'Sales Rep', description: 'Professional and persuasive tone' }
];

export default function ToneSelectionModal({ isOpen, onClose, onToneSelect, buttonRef }: ToneSelectionModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && buttonRef?.current && modalRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const modal = modalRef.current;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Modal dimensions
      const modalWidth = 350; // Optimized width
      const modalHeight = 150; // Approximate height

      // Calculate if there's enough space below the button
      const spaceBelow = viewportHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;

      modal.style.position = 'fixed';

      // Position below the button if there's space, otherwise above
      if (spaceBelow >= modalHeight + 16) {
        // Position below with 8px gap
        modal.style.top = `${buttonRect.bottom + 8}px`;
      } else if (spaceAbove >= modalHeight + 16) {
        // Position above with 8px gap
        modal.style.top = `${buttonRect.top - modalHeight - 8}px`;
      } else {
        // Center vertically if not enough space either way
        modal.style.top = `${Math.max(16, (viewportHeight - modalHeight) / 2)}px`;
      }

      // Align to the right edge of the button
      let leftPosition = buttonRect.right - modalWidth;

      // Ensure modal doesn't go off left edge
      if (leftPosition < 16) {
        leftPosition = 16;
      }

      // Ensure modal doesn't go off right edge
      if (leftPosition + modalWidth > viewportWidth - 16) {
        leftPosition = viewportWidth - modalWidth - 16;
      }

      modal.style.left = `${leftPosition}px`;
      modal.style.zIndex = '999999'; // Very high z-index to appear above everything
    }
  }, [isOpen, buttonRef]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToneSelect = (toneId: string) => {
    onToneSelect(toneId);
    onClose();
  };

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30"
        // pointerEvents is forced on because a Radix Dialog sets
        // pointer-events:none on <body> while open, and this portals to <body>.
        style={{ zIndex: 999998, pointerEvents: 'auto' }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl overflow-hidden"
        style={{ position: 'fixed', zIndex: 999999, width: '350px', pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 gap-2">
          <h3 className="text-base font-medium text-gray-900 flex-shrink-0">
            What tone would you like to use?
          </h3>
          {/* AI Credits Display */}
          <div className="bg-white rounded-full px-3 py-1.5 shadow-sm border border-gray-200 flex items-center gap-1.5 flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[#6C60FF] flex-shrink-0" />
            <span className="text-gray-900 font-medium text-xs whitespace-nowrap">
              1 credit
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tone Options */}
        <div className="px-4 pb-4 flex gap-2">
          {toneOptions.map((tone, index) => (
            <button
              key={tone.id}
              onClick={(e) => {
                e.stopPropagation();
                handleToneSelect(tone.id);
              }}
              className={`flex-1 px-4 py-3 text-center transition-colors focus:outline-none ${
                index === 0
                  ? 'border border-[#6C60FF] bg-[rgba(108,96,255,0.10)] text-[#6C60FF] font-medium' // Personal - selected styling
                  : 'bg-transparent text-gray-900 hover:bg-gray-50 border border-gray-300' // Sales Rep - unselected styling
              }`}
              style={{
                borderRadius: index === 0 ? '6.75px' : '6px'
              }}
            >
              <span className="text-sm">
                {tone.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );

  // Use React Portal to render at document.body level to avoid z-index issues
  return isOpen ? createPortal(modalContent, document.body) : null;
}