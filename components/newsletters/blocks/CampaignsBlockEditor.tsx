import { LayoutGrid } from 'lucide-react';
import type { CampaignColumns, CampaignItem, CampaignsBlockData } from '../../../services/newslettersAPI';
import SegmentedSwitch from '../SegmentedSwitch';
import { contrastInk } from '../lib/colors';
import { CAMPAIGNS_MAX, EDIT_ITEMS_LABEL, campaignButtonColor, campaignColumns, itemButtonLabel, missingItemsNote, previewColumns, resolveCampaignItems } from '../lib/campaignsBlock';
import { campaignSelections } from '../lib/blocks';
import { BUTTON_SMALL, LINK_BUTTON } from '../lib/ui';
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
 * email, one column on phones (the phone view, and screens under 640 px).
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
        {cards.map((c) => (
          <li key={`${c.kind}-${c.id}`} className="min-w-0 overflow-hidden rounded-xl border border-[#ECEDF3] bg-white">
            {c.cover_url ? <img src={c.cover_url} alt={c.title} className="block h-auto max-h-80 w-full object-cover" /> : null}
            <div className={`px-5 pb-5 pt-4 ${two ? 'sm:px-4 sm:pb-4' : ''}`}>
              <p className="mb-1.5 break-words text-lg font-bold leading-6 text-gray-900">{c.title}</p>
              {c.price_text ? <p className="mb-1 break-words text-[0.9375rem] font-bold leading-[1.375rem] text-gray-900">{c.price_text}</p> : null}
              {c.meta ? <p className="mb-2 break-words text-[0.8125rem] leading-5 text-gray-500">{c.meta}</p> : null}
              {c.description ? <p className="mb-3.5 break-words text-[0.9375rem] leading-[1.375rem] text-gray-600">{c.description}</p> : null}
              <span className={`inline-block rounded-[10px] px-6 py-3 text-[0.9375rem] font-bold leading-5 ${c.description ? '' : 'mt-2'}`} style={{ backgroundColor: color, color: ink }}>{itemButtonLabel(c.kind)}</span>
            </div>
          </li>
        ))}
      </ul>
      {cards.length < selections.length ? (
        <p className="mt-2 text-xs text-gray-500">
          {serverItems ? missingItemsNote(selections, cards) : 'Getting your picks…'}
        </p>
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
