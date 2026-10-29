import { useEffect, useRef, useState } from 'react';
import { LayoutGrid, Pencil } from 'lucide-react';
import type { CampaignColumns, CampaignItem, CampaignsBlockData, CardOverride } from '../../../services/newslettersAPI';
import SegmentedSwitch from '../SegmentedSwitch';
import { contrastInk } from '../lib/colors';
import {
  CAMPAIGNS_MAX, EDIT_ITEMS_LABEL, campaignButtonColor, campaignColumns, cardHasEdits, displayCard, missingItemsNote, previewColumns, resetCardOverride,
  resolveCampaignItems, selectionKey, setCardOverride,
} from '../lib/campaignsBlock';
import { campaignSelections } from '../lib/blocks';
import { BUTTON_SMALL, LINK_BUTTON } from '../lib/ui';
import CampaignCardEditor from './CampaignCardEditor';
import type { BlockEditorProps } from './types';

const COLUMN_OPTIONS = [
  { value: '1', label: '1 column' },
  { value: '2', label: '2 columns' },
] as const;

/**
 * [wdy2xh2t3w] A Campaigns section, drawn like the email (one card per campaign, product or vehicle): the cover
 * across the card with rounded top corners (no taller than 320 px, as the email), the title in bold, the price (bold)
 * and details (small grey) when there are any, the description and a "View campaign" / "View product" / "View
 * vehicle" button in the brand colour. The cards come from the API's snapshot after a save, and from the picked
 * items until then. 2 columns (Chris, 29 Oct round 2): two cards a row, an odd last card on the left; like the
 * email, one column on phones (the phone view, and screens under 640 px). Each card can be edited for this newsletter
 * only (data.overrides): the preview shows the edits, the email does too.
 */
export default function CampaignsBlockEditor({ blockId, data, selected, readOnly, onChange, serverItems, accent, onPick, phone = false }: BlockEditorProps<CampaignsBlockData> & {
  /** The saved copy's cards for this section (the API's snapshot). */
  serverItems?: CampaignItem[];
  /** The header's background colour: the button colour. */
  accent?: string | null;
  onPick?(): void;
  /** The preview's phone view: one column, as the email on a phone. */
  phone?: boolean;
}) {
  // The email leaves out a card with no link (blocks/campaigns.blade.php via NewsletterRenderer::campaignItems).
  const selections = campaignSelections(data);
  const cards = resolveCampaignItems(selections, serverItems, data.items).filter((c) => c.url);
  const color = campaignButtonColor(accent);
  const ink = contrastInk(color);
  const canPick = !readOnly && Boolean(onPick);
  const columns = campaignColumns(data);
  const two = previewColumns(data, phone) === 2;
  const editable = selected && !readOnly;
  // The card whose editor is open ("<kind>:<id>"); closed with the section.
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => { if (!editable) setEditing(null); }, [editable]);
  // Edits always start from the latest edits (an upload that finishes later doesn't undo what was typed meanwhile).
  const overridesRef = useRef(data.overrides);
  overridesRef.current = data.overrides;
  const editCard = (key: string, patch: CardOverride) => onChange({ overrides: setCardOverride(overridesRef.current, key, patch) });
  const editingCard = editable && editing ? cards.find((c) => selectionKey(c) === editing) : undefined;

  if (!selections.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
        <LayoutGrid className="h-6 w-6 text-[#6C60FF]" aria-hidden="true" />
        <p className="text-sm text-gray-600">{readOnly ? 'Nothing picked yet' : 'Show campaigns, products or vehicles in this email.'}</p>
        {canPick ? <button type="button" onClick={(e) => { e.stopPropagation(); onPick?.(); }} className={LINK_BUTTON}>Choose</button> : null}
      </div>
    );
  }

  return (
    <div>
      <ul aria-label="Campaigns in this section" data-columns={two ? 2 : 1} className={`grid grid-cols-1 gap-4 ${two ? 'sm:grid-cols-2' : ''}`}>
        {cards.map((c) => {
          const key = selectionKey(c);
          const o = data.overrides?.[key];
          const card = displayCard(c, o);
          const open = editing === key && editable;
          return (
            <li key={key} data-card-key={key} className={`flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white ${open ? 'border-[#6C60FF] ring-2 ring-[#6C60FF]' : 'border-[#ECEDF3]'}`}>
              {card.image ? <img src={card.image} alt={card.title} className="block h-auto max-h-80 w-full object-cover" /> : null}
              <div className={`flex-1 px-5 pb-5 pt-4 ${two ? 'sm:px-4 sm:pb-4' : ''}`}>
                <p className="mb-1.5 break-words text-lg font-bold leading-6 text-gray-900">{card.title}</p>
                {c.price_text ? <p className="mb-1 break-words text-[0.9375rem] font-bold leading-[1.375rem] text-gray-900">{c.price_text}</p> : null}
                {c.meta ? <p className="mb-2 break-words text-[0.8125rem] leading-5 text-gray-500">{c.meta}</p> : null}
                {card.description ? <p className="mb-3.5 break-words text-[0.9375rem] leading-[1.375rem] text-gray-600">{card.description}</p> : null}
                <span className={`inline-block max-w-full break-words rounded-[10px] px-6 py-3 text-[0.9375rem] font-bold leading-5 ${card.description ? '' : 'mt-2'}`} style={{ backgroundColor: color, color: ink }}>{card.button}</span>
              </div>
              {editable ? (
                <div className="flex items-center justify-between gap-2 border-t border-dashed border-gray-200 px-4 py-2">
                  <button type="button" aria-label={`Edit card: ${c.title}`} aria-expanded={open}
                    onClick={(e) => { e.stopPropagation(); setEditing(open ? null : key); }} className={LINK_BUTTON}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit card
                  </button>
                  {cardHasEdits(o) ? <span className="text-xs text-gray-500">Edited</span> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {cards.length < selections.length ? (
        <p className="mt-2 text-xs text-gray-500">
          {serverItems ? missingItemsNote(selections, cards) : 'Getting your picks…'}
        </p>
      ) : null}
      {editingCard ? (
        <CampaignCardEditor key={editing} blockId={blockId} item={editingCard} override={data.overrides?.[editing as string]}
          onChange={(patch) => editCard(selectionKey(editingCard), patch)}
          onReset={() => onChange({ overrides: resetCardOverride(overridesRef.current, selectionKey(editingCard)) })}
          onClose={() => setEditing(null)} />
      ) : null}
      {selected && canPick ? (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          {/* Edit (the picker) with the column choice next to it, on one line down to 360 px screens. */}
          <div className="flex items-center gap-2">
            <button type="button" aria-label={EDIT_ITEMS_LABEL} onClick={(e) => { e.stopPropagation(); onPick?.(); }} className={`${BUTTON_SMALL} flex-shrink-0`}>
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />Edit
            </button>
            <SegmentedSwitch label="Columns" options={COLUMN_OPTIONS} value={String(columns) as '1' | '2'} fill className="max-w-[15rem]"
              onChange={(v) => onChange({ columns: Number(v) as CampaignColumns })} />
          </div>
          <p id={`${blockId}-campaigns-hint`} className="mt-2 text-xs text-gray-500">
            Up to {CAMPAIGNS_MAX}. Each card opens its own page.{columns === 2 ? ' On phones the cards show one under another.' : ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}
