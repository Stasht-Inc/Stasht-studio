import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, RotateCcw, X } from 'lucide-react';
import type { CampaignItem, CardOverride } from '../../../services/newslettersAPI';
import { useImageUpload } from '../hooks/useImageUpload';
import { CARD_LIMITS, cardEditNote, cardHasEdits, displayCard, itemButtonLabel, plainCardText } from '../lib/campaignsBlock';
import { httpsUrl } from '../lib/urls';
import { BUTTON_SMALL, LABEL, inputClass, textareaClass } from '../lib/ui';

/**
 * One card's edits for this newsletter only (Chris, 29 Oct round 2): its image (upload, replace, back to the
 * original), title, description and button text. The boxes start filled with what the card shows now, so a few
 * letters can be changed (Deepak, 30 Oct). Text equal to the original, or an emptied box, keeps the item's own value;
 * an emptied box refills with it once left. The card's link can't be changed. "Reset to original" drops every edit.
 */
type TextField = 'title' | 'description' | 'button_text';

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
  const originals: Record<TextField, string> = { title: item.title ?? '', description: item.description ?? '', button_text: itemButtonLabel(item.kind) };
  const startText = (field: TextField) => override?.[field] || originals[field];
  // What each box shows while editing (an emptied box stays empty until it is left).
  const [text, setText] = useState<Record<TextField, string>>(() => ({ title: startText('title'), description: startText('description'), button_text: startText('button_text') }));
  const type = (field: TextField, value: string) => {
    setText((t) => ({ ...t, [field]: value }));
    // Back to the original (ignoring spacing) or empty: no edit for this field.
    const plain = plainCardText(value);
    onChange({ [field]: plain === '' || plain === plainCardText(originals[field]) ? '' : value });
  };
  const leave = (field: TextField, value: string) => {
    const plain = plainCardText(value);
    if (plain === '') setText((t) => ({ ...t, [field]: originals[field] }));
    else if (field === 'description' && plain !== value) type(field, plain);
  };
  const reset = () => {
    setText({ ...originals });
    onReset();
  };
  const { uploading, choose, input } = useImageUpload((url) => onChange({ image_url: url }), `${blockId}-card-image-input`);
  const shown = displayCard(item, override);
  const imageEdited = Boolean(httpsUrl(override?.image_url ?? ''));
  const edited = cardHasEdits(override);
  // Opening the editor puts the cursor in the title and brings the editor into view (only as far as needed).
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    rootRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  return (
    <div ref={rootRef} role="group" aria-label={`Edit card: ${item.title}`} data-nl-card-editor className="grid gap-3 rounded-lg border border-[#6C60FF]/40 bg-gray-50 p-3">
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
        <input ref={titleRef} id={`${id}-title`} type="text" value={text.title} maxLength={CARD_LIMITS.title} placeholder={item.title}
          onChange={(e) => type('title', e.target.value)} onBlur={(e) => leave('title', e.target.value)} className={inputClass()} />
      </div>
      <div>
        <label htmlFor={`${id}-description`} className={LABEL}>Description</label>
        <textarea id={`${id}-description`} rows={3} value={text.description} maxLength={CARD_LIMITS.description}
          placeholder={item.description || 'Add a short description'}
          onChange={(e) => type('description', e.target.value)}
          // Kept as typed (the cursor stays put); one paragraph once the box is left, as it saves.
          onBlur={(e) => leave('description', e.target.value)}
          className={`${textareaClass()} resize-y`} />
      </div>
      <div>
        <label htmlFor={`${id}-button`} className={LABEL}>Button text</label>
        <input id={`${id}-button`} type="text" value={text.button_text} maxLength={CARD_LIMITS.button_text} placeholder={itemButtonLabel(item.kind)}
          onChange={(e) => type('button_text', e.target.value)} onBlur={(e) => leave('button_text', e.target.value)} className={inputClass()} />
      </div>

      <div>
        <button type="button" onClick={(e) => { e.stopPropagation(); reset(); }} disabled={!edited} className={BUTTON_SMALL}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Reset to original
        </button>
      </div>
    </div>
  );
}
