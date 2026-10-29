import { LayoutGrid } from 'lucide-react';
import type { CampaignItem, CampaignsBlockData } from '../../../services/newslettersAPI';
import { contrastInk } from '../lib/colors';
import { CAMPAIGNS_MAX, CHANGE_ITEMS_LABEL, campaignButtonColor, itemButtonLabel, missingItemsNote, resolveCampaignItems } from '../lib/campaignsBlock';
import { campaignSelections } from '../lib/blocks';
import { BUTTON_SMALL, LINK_BUTTON } from '../lib/ui';
import type { BlockEditorProps } from './types';

/**
 * [wdy2xh2t3w] A Campaigns section, drawn like the email (one card per campaign, product or vehicle, stacked): the
 * cover across the card with rounded top corners, the title in bold, the price (bold) and details (small grey)
 * when there are any, the description and a "View campaign" / "View product" / "View vehicle" button in the brand
 * colour. The cards come from the API's snapshot after a save, and from the picked items until then.
 */
export default function CampaignsBlockEditor({ data, selected, readOnly, serverItems, accent, onPick }: BlockEditorProps<CampaignsBlockData> & {
  /** The saved copy's cards for this section (the API's snapshot). */
  serverItems?: CampaignItem[];
  /** The header's background colour: the button colour. */
  accent?: string | null;
  onPick?(): void;
}) {
  // The email leaves out a card with no link (blocks/campaigns.blade.php via NewsletterRenderer::campaignItems).
  const selections = campaignSelections(data);
  const cards = resolveCampaignItems(selections, serverItems, data.items).filter((c) => c.url);
  const color = campaignButtonColor(accent);
  const ink = contrastInk(color);
  const canPick = !readOnly && Boolean(onPick);

  if (!selections.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
        <LayoutGrid className="h-6 w-6 text-[#6C60FF]" aria-hidden="true" />
        <p className="text-sm text-gray-600">{readOnly ? 'No campaigns' : 'Show your campaigns in this email.'}</p>
        {canPick ? <button type="button" onClick={(e) => { e.stopPropagation(); onPick?.(); }} className={LINK_BUTTON}>Choose campaigns</button> : null}
      </div>
    );
  }

  return (
    <div>
      <ul aria-label="Campaigns in this section" className="space-y-4">
        {cards.map((c) => (
          <li key={`${c.kind}-${c.id}`} className="overflow-hidden rounded-xl border border-[#ECEDF3] bg-white">
            {c.cover_url ? <img src={c.cover_url} alt={c.title} className="block h-auto w-full" /> : null}
            <div className="px-5 pb-5 pt-4">
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
          {serverItems ? missingItemsNote(selections, cards) : 'Getting your campaigns…'}
        </p>
      ) : null}
      {selected && canPick ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <button type="button" aria-label={CHANGE_ITEMS_LABEL} onClick={(e) => { e.stopPropagation(); onPick?.(); }} className={BUTTON_SMALL}>
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />Change
          </button>
          <span className="text-xs text-gray-500">Up to {CAMPAIGNS_MAX}. Each card opens its own page.</span>
        </div>
      ) : null}
    </div>
  );
}
