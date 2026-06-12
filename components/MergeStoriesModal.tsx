import { useState, useEffect } from "react";
import { GitMerge, Check } from "lucide-react";
import { Dialog, DialogContent } from "./ui/dialog";

interface MergeStoriesModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (title: string, deleteOnMerge: boolean) => Promise<void>;
  selectedCount: number;
}

export default function MergeStoriesModal({ open, onClose, onConfirm, selectedCount }: MergeStoriesModalProps) {
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteOnMerge, setDeleteOnMerge] = useState(true);
  // Snapshot count when modal opens — prevents warning flash during close animation
  const [count, setCount] = useState(selectedCount);
  useEffect(() => { if (open) setCount(selectedCount); }, [open]);

  const handleConfirm = async () => {
    const trimmed = title.trim();
    if (!trimmed) { setError('Please enter a title for the merged campaign'); return; }
    if (count < 2) { setError('Please select at least 2 campaigns to merge'); return; }
    setError('');
    setIsLoading(true);
    try {
      await onConfirm(trimmed, deleteOnMerge);
      setTitle('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to merge campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setError('');
    setDeleteOnMerge(true);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl border-0 bg-white p-0 overflow-hidden shadow-2xl">
        {/* Single wrapper — prevents DialogContent grid gap-4 from adding space */}
        <div>
          {/* Header */}
          <div className="flex items-center gap-2 px-6 pt-6 pb-5">
            <GitMerge className="w-5 h-5 text-[#6C60FF] flex-shrink-0" />
            <h2 className="text-lg font-semibold text-gray-900">Merge Campaigns</h2>
          </div>

          {/* Body */}
          <div className="px-6 pb-5">
            {count < 2 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                Please select at least 2 campaigns to merge.
              </div>
            )}
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              New Campaign Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              placeholder="Enter title for the merged campaign..."
              autoFocus
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#6C60FF] transition-colors bg-gray-50"
            />
            {error && <p className="text-sm text-red-500 mt-1.5">{error}</p>}
            <label className="flex items-center gap-2 mt-3 cursor-pointer w-fit" onClick={() => setDeleteOnMerge(v => !v)}>
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${deleteOnMerge ? 'bg-[#6C60FF]' : 'border border-gray-300 bg-white'}`}>
                {deleteOnMerge && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </div>
              <span className="text-sm text-gray-700">Delete once merged</span>
            </label>
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
              disabled={isLoading || count < 2 || !title.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-[#6C60FF] rounded-full hover:bg-[#5B52FF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Merging...' : 'Merge Campaigns'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
