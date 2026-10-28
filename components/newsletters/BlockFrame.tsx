import { memo, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, LayoutGrid, Trash2 } from 'lucide-react';

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick(): void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex h-7 w-7 items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40 disabled:opacity-30 ${danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-600 hover:bg-gray-100'}`}>
      {children}
    </button>
  );
}

/** One section in the preview: purple outline when selected, with move up / move down / delete. A tab stop of its
 *  own (Enter or Space selects it), so sections with no field of their own (a picture, a button, a divider) can be
 *  reached without a mouse. */
function BlockFrame({ blockId, label, index, count, selected, readOnly, problem, padClass, onSelect, onMoveUp, onMoveDown, onDelete, onEdit, editLabel, children }: {
  /** The section's id (data-block-id), so focus can come back to it. */
  blockId?: string;
  label: string;
  index: number;
  count: number;
  selected: boolean;
  readOnly: boolean;
  problem: string | null;
  /** Side padding of the email column. */
  padClass: string;
  onSelect(): void;
  onMoveUp(): void;
  onMoveDown(): void;
  onDelete(): void;
  /** A section with a picker of its own (Campaigns): its button in the toolbar. */
  onEdit?(): void;
  editLabel?: string;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={`${label} section`} data-block-id={blockId} tabIndex={readOnly ? -1 : 0} onClick={readOnly ? undefined : onSelect} onFocusCapture={readOnly ? undefined : onSelect}
      onKeyDown={readOnly ? undefined : (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(); } }}
      className={`relative ${padClass} py-3 outline outline-2 -outline-offset-2 transition-[outline-color] focus-visible:outline-[#6C60FF]/60 ${selected ? 'outline-[#6C60FF]' : problem ? 'outline-red-300' : readOnly ? 'outline-transparent' : 'outline-transparent hover:outline-[#6C60FF]/30'}`}>
      {selected && !readOnly ? (
        <div role="toolbar" aria-label={`${label} section actions`} className="absolute -top-3.5 right-3 z-10 flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
          {onEdit && editLabel ? <IconButton label={editLabel} onClick={onEdit}><LayoutGrid className="h-4 w-4" /></IconButton> : null}
          <IconButton label="Move up" disabled={index === 0} onClick={onMoveUp}><ArrowUp className="h-4 w-4" /></IconButton>
          <IconButton label="Move down" disabled={index === count - 1} onClick={onMoveDown}><ArrowDown className="h-4 w-4" /></IconButton>
          <IconButton label="Delete section" danger onClick={onDelete}><Trash2 className="h-4 w-4" /></IconButton>
        </div>
      ) : null}
      {children}
      {problem ? <p role="alert" className="pt-2 text-xs text-red-600">{problem}</p> : null}
    </div>
  );
}

export default memo(BlockFrame);
