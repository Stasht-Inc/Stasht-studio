import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { Tag, X } from "lucide-react";
import { Dialog, DialogContent } from "./ui/dialog";

interface AddTagsModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (tags: string[]) => Promise<void>;
  selectedCount: number;
  existingTags?: string[];
}

export default function AddTagsModal({ open, onClose, onConfirm, selectedCount, existingTags = [] }: AddTagsModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentWord = inputValue.split(',').pop()?.trim() ?? '';
  const suggestions = currentWord.length > 0
    ? existingTags.filter(t =>
        t.toLowerCase().includes(currentWord.toLowerCase()) && !tags.includes(t)
      )
    : [];

  useEffect(() => {
    setShowSuggestions(suggestions.length > 0);
  }, [inputValue]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const addTags = (value: string) => {
    const parts = value.split(',').map(s => s.trim()).filter(Boolean);
    setTags(prev => {
      const next = [...prev];
      parts.forEach(p => { if (!next.includes(p)) next.push(p); });
      return next;
    });
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) addTags(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  const selectSuggestion = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev : [...prev, tag]);
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleConfirm = async () => {
    const pending = inputValue.trim();
    const allTags = pending && !tags.includes(pending) ? [...tags, pending] : tags;
    if (allTags.length === 0) return;
    setIsLoading(true);
    try {
      await onConfirm(allTags);
      setTags([]);
      setInputValue('');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setTags([]);
    setInputValue('');
    setShowSuggestions(false);
    onClose();
  };

  const pendingTag = inputValue.trim();
  const hasInput = tags.length > 0 || (pendingTag.length > 0 && !tags.includes(pendingTag));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg rounded-2xl border-0 bg-white p-0 overflow-visible shadow-2xl">
        {/* Single wrapper div — prevents DialogContent's grid gap-4 from adding space */}
        <div>
          {/* Header */}
          <div className="flex items-center gap-2 px-6 pt-6 pb-5">
            <Tag className="w-5 h-5 text-[#6C60FF] flex-shrink-0" />
            <h2 className="text-lg font-semibold text-gray-900">
              Add Tags to {selectedCount} {selectedCount === 1 ? 'campaign' : 'campaigns'}
            </h2>
          </div>

          {/* Input + suggestions */}
          <div className="px-6 pb-4" ref={containerRef}>
            <div className="relative flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Add tags separated by commas..."
                autoFocus
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#6C60FF] transition-colors bg-white"
              />
              <button
                onClick={() => inputValue.trim() && addTags(inputValue)}
                disabled={!inputValue.trim()}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#6C60FF]/15 text-[#6C60FF] hover:bg-[#6C60FF]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xl font-light flex-shrink-0"
              >
                +
              </button>

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-12 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                  {suggestions.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); selectSuggestion(tag); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-[#6C60FF]/5 hover:text-[#6C60FF] transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400 mt-2 px-1">
              Type a tag and press Enter or click + to add it
            </p>

            {/* Added tags chips */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-gray-500 transition-colors text-gray-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100">
            <button
              onClick={handleClose}
              className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || !hasInput}
              className="px-5 py-2 text-sm font-medium text-white bg-[#6C60FF] rounded-full hover:bg-[#5B52FF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Applying...' : `Apply to ${selectedCount} ${selectedCount === 1 ? 'campaign' : 'campaigns'}`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
