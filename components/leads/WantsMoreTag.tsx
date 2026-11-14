import type { Lead } from '../../services/leadsAPI';

/**
 * "Wants more" (Chris 14 Nov 2026): the customer texted YES to "Want to see more like this?". Kit status colours
 * (Success / Success BG), same height and type size as CampaignDeletedTag. Renders nothing otherwise.
 */
export default function WantsMoreTag({ lead, className = '' }: { lead: Pick<Lead, 'wants_more'>; className?: string }) {
  if (!lead.wants_more) return null;
  return (
    <span
      title="Replied YES to see more like this"
      data-wants-more
      className={`shrink-0 inline-flex items-center h-5 px-1.5 rounded bg-[#DCFCE7] text-[12px] font-medium text-[#008236] whitespace-nowrap ${className}`}
    >
      Wants more
    </span>
  );
}
