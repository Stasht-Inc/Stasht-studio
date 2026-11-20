import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, X } from 'lucide-react';
import StepCard from '../newsletters/StepCard';
import { BUTTON_SECONDARY, LINK_BUTTON } from '../newsletters/lib/ui';
import { Textarea } from '../ui/textarea';
import { momentsLabel } from './storeelPreview';
import { stepNumber } from './lib/storeelFlow';
import type { PreviewMoment } from './lib/previewMoments';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { AddWidgetMenu, ADD_WIDGET_PANEL, type AddWidgetKind, type AddWidgetOption } from '../widgets/AddWidgetChooser';
import { campaignPill, productsPill } from '../leads/CampaignPickButtons';

// Chris, 20 Nov 2026 (I9): "+ Products" (green) and "+ Campaigns" (purple) beside Add a Moment — the message composer's
// pair (CampaignPickButtons), both with a stroke (I8: "They need the same pattern!"). The purple pill gets its border
// here until the composer's own pill has one (then the replace finds nothing and the shared look applies as is).
const PRODUCTS_BUTTON = productsPill();
const CAMPAIGNS_BUTTON = campaignPill().replace('border-transparent', 'border-purple-200');

export const MOMENTS_STEP_ID = 'st-step-moments';

/** One moment in the card, and what can be done to it here. */
export interface MomentRow {
  moment: PreviewMoment;
  /** Save its caption (memory_images.description): locally before the campaign exists, else on the campaign. */
  onSaveCaption?(caption: string): Promise<boolean> | boolean;
  /** Open the original Add a Moment UI on it (title, caption, place, date, tags). */
  onEdit?(): void;
  onRemove?(): void;
  /**
   * Phones only (< md; Chris, 11 Nov 2026): the preview's Move up / Move down, since phones have no preview.
   * Same handler as the preview's moment menu (CreateMemory's moveMoment).
   */
  onMoveUp?(): void;
  onMoveDown?(): void;
  moveBusy?: boolean;
  /** Why it can't be edited here (a picked product's caption comes from the website). */
  note?: string;
}

/**
 * Step 2 Moments (Chris, 4 Nov 2026: "You need to be able to add moments, and captions here... use the original UI"):
 * every moment the campaign will have, in order — picked catalogue products / vehicles / campaigns, then photos and
 * videos — with each caption edited the way the campaign page edits it (Write a caption…, Cancel / Save), the original
 * moment editor on the pencil, and "Add a Moment", which opens the original Add a Moment UI (AddMomentModal).
 * Photos can be dropped on the card, as on the old Media box.
 */
export default function StoreelMomentsCard({ rows, onAddMoment, onAddProducts, onAddCampaigns, onDropFiles, busy = false, note = null, captionRequest = null, addChooser }: {
  rows: MomentRow[];
  /** The preview's Edit Moment on a saved moment (Chris, 7 Nov 2026): open this row's caption editor, scrolled to. */
  captionRequest?: { key: string; n: number } | null;
  /** On a saved campaign: "Moments and captions save straight to your campaign." */
  note?: string | null;
  onAddMoment(): void;
  /** I9: Add a Moment's Products list (the same picker), straight away. */
  onAddProducts?(): void;
  /** I9: Add a Moment's Campaigns list (the same picker), straight away. */
  onAddCampaigns?(): void;
  onDropFiles?(files: FileList): void;
  busy?: boolean;
  /** Chris, 8 Nov 2026 (point 1): "Add a Moment" opens the campaign page's Add Widget chooser (at the end). */
  addChooser?: { options: ReadonlyArray<AddWidgetOption>; onPick(kind: AddWidgetKind): void };
}) {
  const addButton = (
    <button type="button" onClick={addChooser ? undefined : onAddMoment} disabled={busy} className={BUTTON_SECONDARY} data-testid="storeel-moments-add">
      <Plus className="h-4 w-4" aria-hidden="true" />Add a Moment
    </button>
  );
  return (
    <StepCard number={stepNumber('moments')} title="Moments" id={MOMENTS_STEP_ID} aside={momentsLabel(rows.length)}>
      <div
        onDragOver={(e) => { if (onDropFiles) { e.preventDefault(); e.stopPropagation(); } }}
        onDrop={(e) => { if (!onDropFiles) return; e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files?.length) onDropFiles(e.dataTransfer.files); }}
        className="space-y-3"
      >
        {note ? <p className="text-sm text-gray-500">{note}</p> : null}
        {rows.length ? (
          <ul aria-label="Moments" className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {rows.map((row) => <MomentRowItem key={row.moment.key} row={row} captionRequest={captionRequest?.key === row.moment.key ? captionRequest.n : 0} />)}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No moments yet. Add photos or videos with Add a Moment, or pick items in step 1.</p>
        )}
        <div className="flex flex-wrap items-center gap-2" data-testid="storeel-moments-actions">
          {addChooser ? (
            <Popover>
              <PopoverTrigger asChild>{addButton}</PopoverTrigger>
              {/* Above the Storeel page (z 99999). */}
              <PopoverContent side="top" align="start" className={ADD_WIDGET_PANEL} style={{ zIndex: 100002 }} sideOffset={8}>
                <AddWidgetMenu options={addChooser.options} onPick={addChooser.onPick} />
              </PopoverContent>
            </Popover>
          ) : addButton}
          {onAddProducts ? (
            <button type="button" onClick={onAddProducts} disabled={busy} className={`${PRODUCTS_BUTTON} disabled:opacity-50`} data-testid="storeel-moments-products">
              <Plus className="h-4 w-4" aria-hidden="true" />Products
            </button>
          ) : null}
          {onAddCampaigns ? (
            <button type="button" onClick={onAddCampaigns} disabled={busy} className={`${CAMPAIGNS_BUTTON} disabled:opacity-50`} data-testid="storeel-moments-campaigns">
              <Plus className="h-4 w-4" aria-hidden="true" />Campaigns
            </button>
          ) : null}
        </div>
      </div>
    </StepCard>
  );
}

const VIDEO_FRAME = (src: string) => `${src}#t=0.1`;

function MomentRowItem({ row, captionRequest = 0 }: { row: MomentRow; captionRequest?: number }) {
  const { moment } = row;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const caption = moment.kind === 'photo' ? moment.caption : '';
  const itemRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!captionRequest || !row.onSaveCaption) return;
    setDraft(caption);
    setEditing(true);
    itemRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => itemRef.current?.querySelector('textarea')?.focus(), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captionRequest]);
  const meta = moment.kind === 'product' ? moment.price
    : moment.kind === 'vehicle' ? [moment.price, ...moment.tags].filter(Boolean).join(' · ')
    : moment.kind === 'campaign' ? moment.meta : '';
  const label = moment.title || (moment.kind === 'photo' ? caption.split('\n')[0] : '') || 'Moment';

  const save = async () => {
    if (!row.onSaveCaption || !draft.trim()) return;
    setSaving(true);
    try {
      if (await row.onSaveCaption(draft.trim())) setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li ref={itemRef} className="flex gap-3 p-3" data-moment-row={moment.kind} data-moment-key={moment.key}>
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
        {moment.image
          ? (moment.kind === 'photo' && moment.video
            ? <video src={VIDEO_FRAME(moment.image)} muted playsInline preload="metadata" className="h-full w-full object-cover" />
            : <img src={moment.image} alt="" className="h-full w-full object-cover" />)
          : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {moment.title ? <p className="truncate text-sm font-medium text-gray-900">{moment.title}</p> : null}
            {meta ? <p className="truncate text-sm text-gray-500">{meta}</p> : null}
          </div>
          {row.onMoveUp || row.onMoveDown ? (
            <div className="flex flex-shrink-0 items-center md:hidden" data-testid="storeel-moment-reorder">
              <button type="button" onClick={row.onMoveUp} disabled={!row.onMoveUp || row.moveBusy} aria-label={`Move ${label} up`} className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-[#6C60FF] disabled:opacity-30">
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={row.onMoveDown} disabled={!row.onMoveDown || row.moveBusy} aria-label={`Move ${label} down`} className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-[#6C60FF] disabled:opacity-30">
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          {row.onEdit ? (
            <button type="button" onClick={row.onEdit} aria-label={`Edit ${label}`} className="flex-shrink-0 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-[#6C60FF]">
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          {row.onRemove ? (
            <button type="button" onClick={row.onRemove} aria-label={`Remove ${label}`} className="flex-shrink-0 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-red-500">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {/* The caption, edited the way the campaign page edits it (MemoryDetailsPage: Write a caption…, Cancel / Save). */}
        {editing ? (
          <div className="mt-1">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Write a caption..." aria-label={`Caption for ${label}`} className="resize-none text-sm" />
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button type="button" onClick={() => { void save(); }} disabled={saving || !draft.trim()} className="rounded-md bg-[#6C60FF] px-3 py-1.5 text-sm text-white hover:bg-[#5B50E0] disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        ) : (
          <>
            {caption ? <p className="mt-0.5 line-clamp-3 whitespace-pre-line break-words text-sm text-gray-700">{caption}</p> : null}
            {row.onSaveCaption ? (
              <button type="button" onClick={() => { setDraft(caption); setEditing(true); }} className={`${LINK_BUTTON} mt-1`}>
                {caption ? 'Edit caption' : 'Add caption'}
              </button>
            ) : row.note ? <p className="mt-0.5 text-xs text-gray-500">{row.note}</p> : null}
          </>
        )}
      </div>
    </li>
  );
}
