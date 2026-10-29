import { useEffect, useRef } from 'react';
import { Image as ImageIcon, RotateCcw, X } from 'lucide-react';
import type { CampaignItem, CardOverride } from '../../../services/newslettersAPI';
import { useImageUpload } from '../hooks/useImageUpload';
import { CARD_LIMITS, cardEditNote, cardHasEdits, displayCard, itemButtonLabel, oneParagraph } from '../lib/campaignsBlock';
import { httpsUrl } from '../lib/urls';
import { BUTTON_SMALL, LABEL, inputClass, textareaClass } from '../lib/ui';

/**
 * One card's edits for this newsletter only (Chris, 29 Oct round 2): its image (upload, replace, back to the
 * original), title, description and button text. An empty box keeps the item's own value, shown as the placeholder.
 * The card's link can't be changed. "Reset to original" drops every edit of this card.
 */
export default function CampaignCardEditor({ blockId, item, override, onChange, onReset, onClose }: {
  blockId: string;
  item: CampaignItem;
  override: CardOverride | undefined;
  /** Some of the card's fields, as typed ('' or null: back to the item's own value). */
  onChange(patch: CardOverride): void;
  onReset(): void;
  onClose(): void;
}) {
  const id = `${blockId}-card-${item.kind}-${item.id}`;
  const { uploading, choose, input } = useImageUpload((url) => onChange({ image_url: url }), `${blockId}-card-image-input`);
  const shown = displayCard(item, override);
  const imageEdited = Boolean(httpsUrl(override?.image_url ?? ''));
  const edited = cardHasEdits(override);
  // Opening the editor puts the cursor in the title.
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  return (
    <div role="group" aria-label={`Edit card: ${item.title}`} data-nl-card-editor className="mt-3 grid gap-3 rounded-lg border border-[#6C60FF]/40 bg-gray-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Edit card</p>
          <p className="text-xs text-gray-500">{cardEditNote(item.kind)}</p>
        </div>
        <button type="button" aria-label="Close card editor" title="Close card editor" onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div>
        <p className={LABEL}>Image</p>
        <div className="flex items-center gap-3">
          {shown.image
            ? <img src={shown.image} alt="" className="h-14 w-14 flex-shrink-0 rounded-md border border-gray-200 bg-white object-cover" />
            : <span aria-hidden="true" className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white"><ImageIcon className="h-5 w-5 text-gray-400" /></span>}
          <div className="flex min-w-0 flex-wrap gap-2">
            <button type="button" onClick={(e) => { e.stopPropagation(); choose(); }} disabled={uploading} className={BUTTON_SMALL} aria-live="polite">
              {uploading ? 'Uploading…' : shown.image ? 'Replace image' : 'Add image'}
            </button>
            {imageEdited ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onChange({ image_url: null }); }} disabled={uploading} className={BUTTON_SMALL}>Use original image</button>
            ) : null}
          </div>
        </div>
        {input}
      </div>

      <div>
        <label htmlFor={`${id}-title`} className={LABEL}>Title</label>
        <input ref={titleRef} id={`${id}-title`} type="text" value={override?.title ?? ''} maxLength={CARD_LIMITS.title} placeholder={item.title}
          onChange={(e) => onChange({ title: e.target.value })} className={inputClass()} />
      </div>
      <div>
        <label htmlFor={`${id}-description`} className={LABEL}>Description</label>
        <textarea id={`${id}-description`} rows={3} value={override?.description ?? ''} maxLength={CARD_LIMITS.description}
          placeholder={item.description || 'Add a short description'}
          onChange={(e) => onChange({ description: oneParagraph(e.target.value) })} className={`${textareaClass()} resize-y`} />
      </div>
      <div>
        <label htmlFor={`${id}-button`} className={LABEL}>Button text</label>
        <input id={`${id}-button`} type="text" value={override?.button_text ?? ''} maxLength={CARD_LIMITS.button_text} placeholder={itemButtonLabel(item.kind)}
          onChange={(e) => onChange({ button_text: e.target.value })} className={inputClass()} />
      </div>

      <div>
        <button type="button" onClick={(e) => { e.stopPropagation(); onReset(); }} disabled={!edited} className={BUTTON_SMALL}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Reset to original
        </button>
      </div>
    </div>
  );
}
