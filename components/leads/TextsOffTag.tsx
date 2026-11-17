import type { Lead } from '../../services/leadsAPI';

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Why the tag shows (Chris 17 Nov 2026: "how does STOP work? … where is the stop list?"). */
export function textsOffTitle(lead: Pick<Lead, 'texts_stopped_at' | 'opted_out'>): string {
  const at = lead.texts_stopped_at ? new Date(lead.texts_stopped_at) : null;
  const when = at && !Number.isNaN(at.getTime()) ? ` on ${DATE.format(at)}` : '';
  return lead.opted_out
    ? `Replied STOP${when}. Texts and emails are off until they reply START.`
    : `Replied STOP${when}. Texts are off until they reply START.`;
}

/**
 * "Opted out" (Deepak 17 Nov: a STOP blocks texts AND email, so not "Texts off"): the person texted STOP (their number is on the stop list). Gray, same height/radius/type size as
 * CampaignDeletedTag. Goes away when they text START. Renders nothing otherwise.
 */
export default function TextsOffTag({ lead, className = '' }: { lead: Pick<Lead, 'texts_stopped_at' | 'opted_out'>; className?: string }) {
  if (!lead.texts_stopped_at) return null;
  return (
    <span
      title={textsOffTitle(lead)}
      data-texts-off
      className={`shrink-0 inline-flex items-center h-5 px-1.5 rounded border border-gray-200 bg-gray-100 text-[12px] font-medium text-gray-500 whitespace-nowrap ${className}`}
    >
      Opted out
    </span>
  );
}
