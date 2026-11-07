import { memo, type CSSProperties, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Copy, LayoutGrid, Trash2, X } from 'lucide-react';
import { BUTTON_SMALL_PRIMARY } from './lib/ui';
import { IMAGE_SHADE, type SectionLook } from './lib/sectionStyle';

/** Room above and below a section (NewsletterRenderer::section): 12 px as always, 24 on a band, 40 on a picture. */
const PAD_Y: Record<number, string> = { 12: 'py-3', 24: 'py-6', 40: 'py-10' };

function IconButton({ label, onClick, disabled, danger, hint, children }: { label: string; onClick(): void; disabled?: boolean; danger?: boolean; hint?: string; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={hint ?? label} disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex h-7 w-7 items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40 disabled:opacity-30 ${danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-600 hover:bg-gray-100'}`}>
      {children}
    </button>
  );
}

/** One section in the preview: purple outline when selected, with move up / move down / delete. A tab stop of its
 *  own (Enter or Space selects it), so sections with no field of their own (a picture, a button, a divider) can be
 *  reached without a mouse. */
function BlockFrame({ blockId, label, index, count, canUp, canDown, selected, readOnly, problem, padClass, onSelect, onMoveUp, onMoveDown, onDelete, onDuplicate, duplicateBlocked = null, onEdit, editLabel, onDone, look, bleed = false, padY, children }: {
  /** The section's id (data-block-id), so focus can come back to it. */
  blockId?: string;
  label: string;
  index: number;
  count: number;
  /** Move up / down allowed (default: not past the ends). */
  canUp?: boolean;
  canDown?: boolean;
  selected: boolean;
  readOnly: boolean;
  problem: string | null;
  /** Side padding of the email column. */
  padClass: string;
  onSelect(): void;
  onMoveUp(): void;
  onMoveDown(): void;
  onDelete(): void;
  /** Duplicate (Chris, 6 Nov): copy the section right below it. Left out for the Message section. */
  onDuplicate?(): void;
  /** Why Duplicate is switched off (the email is full: the same words the "+" buttons show), or null. */
  duplicateBlocked?: string | null;
  /** A section with a picker of its own (Campaigns): its button in the toolbar. */
  onEdit?(): void;
  editLabel?: string;
  /** Done / × : close the editor (changes are already saved). */
  onDone(): void;
  /** A Title or Text section's style (Chris, 5 Nov): its background colour or picture fills the whole section. */
  look?: SectionLook | null;
  /** An Image section with its picture (Chris, 6 Nov): no padding, so the picture goes edge to edge as in the email
   *  (emails/newsletter/image-row.blade.php). Its controls, Done and any problem keep the usual side padding. The
   *  hover / selected outline is drawn outside the picture (above and below it; the card clips the sides), never on
   *  the photo, so it can't read as a frame. */
  bleed?: boolean;
  /** A Button, Divider or Campaigns section's room above and below, px (Chris, 7 Nov; Title and Text: look.padY). */
  padY?: number;
  children: ReactNode;
}) {
  // On a band (even one in Studio's purple) the selection shows as the purple line with a white edge inside it, and Done
  // has a white ring.
  const surface: CSSProperties | undefined = look?.image
    ? { backgroundColor: look.fallback ?? undefined, backgroundImage: `url(${JSON.stringify(look.image)})`, backgroundSize: 'cover', backgroundPosition: 'center center', backgroundRepeat: 'no-repeat' }
    : look?.bg ? { backgroundColor: look.bg } : undefined;
  // Room above and below: the usual classes, or exact px for a padding choice (Chris, 7 Nov).
  const pad = look?.padY ?? padY ?? 12;
  const padStyle: CSSProperties | undefined = bleed || PAD_Y[pad] ? undefined : { paddingTop: pad, paddingBottom: pad };
  return (
    <div role="group" aria-label={`${label} section`} data-block-id={blockId} data-nl-selected={selected && !readOnly ? 'true' : undefined} data-nl-invalid={problem ? 'true' : undefined} tabIndex={readOnly ? -1 : 0} onClick={readOnly ? undefined : onSelect} onFocusCapture={readOnly ? undefined : onSelect}
      onKeyDown={readOnly ? undefined : (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(); } }}
      data-nl-section-bg={surface ? (look?.image ? 'image' : 'color') : undefined} style={padStyle ? { ...surface, ...padStyle } : surface}
      className={`relative ${bleed ? '' : `${padClass} ${PAD_Y[pad] ?? ''}`} ${surface && selected && !readOnly ? 'shadow-[inset_0_0_0_4px_#fff]' : ''} outline outline-2 ${bleed ? 'outline-offset-0' : '-outline-offset-2'} transition-[outline-color] focus-visible:outline-[#6C60FF]/60 ${selected ? 'outline-[#6C60FF]' : problem ? 'outline-red-300' : readOnly ? 'outline-transparent' : 'outline-transparent hover:outline-[#6C60FF]/30'}`}>
      {selected && !readOnly ? (
        <div role="toolbar" aria-label={`${label} section actions`} className="absolute -top-3.5 right-3 z-10 flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
          {onEdit && editLabel ? <IconButton label={editLabel} onClick={onEdit}><LayoutGrid className="h-4 w-4" /></IconButton> : null}
          <IconButton label="Move up" disabled={canUp === undefined ? index === 0 : !canUp} onClick={onMoveUp}><ArrowUp className="h-4 w-4" /></IconButton>
          <IconButton label="Move down" disabled={canDown === undefined ? index === count - 1 : !canDown} onClick={onMoveDown}><ArrowDown className="h-4 w-4" /></IconButton>
          {onDuplicate ? <IconButton label="Duplicate" disabled={duplicateBlocked !== null} hint={duplicateBlocked ?? undefined} onClick={onDuplicate}><Copy className="h-4 w-4" /></IconButton> : null}
          <IconButton label="Delete section" danger onClick={onDelete}><Trash2 className="h-4 w-4" /></IconButton>
          <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-gray-200" />
          <IconButton label="Close editor" onClick={onDone}><X className="h-4 w-4" /></IconButton>
        </div>
      ) : null}
      {/* On a picture: the header's dark layer, under the words and controls. */}
      {look?.image ? <div aria-hidden="true" data-nl-shade="" className="pointer-events-none absolute inset-0" style={{ backgroundColor: IMAGE_SHADE }} /> : null}
      <div className="relative">{children}</div>
      {selected && !readOnly ? (
        // With little padding, Done keeps 12 px clear of the section's bottom edge (Chris, 7 Nov).
        <div className={`relative flex justify-end pt-3 ${bleed ? `${padClass} pb-3` : ''}`} style={!bleed && pad < 12 ? { paddingBottom: 12 - pad } : undefined}>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDone(); }} className={`${BUTTON_SMALL_PRIMARY} ${surface ? 'ring-2 ring-white' : ''}`}>Done</button>
        </div>
      ) : null}
      {problem ? <p role="alert" className={`relative pt-2 text-xs ${bleed ? `${padClass} pb-3` : ''} ${surface ? 'font-medium text-red-600 [text-shadow:0_0_2px_#fff]' : 'text-red-600'}`}>{problem}</p> : null}
    </div>
  );
}

export default memo(BlockFrame);
