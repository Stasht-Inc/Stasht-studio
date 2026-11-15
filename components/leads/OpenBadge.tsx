import type { Lead } from '../../services/leadsAPI';

// A lead nobody has taken yet — the owner's arrival hold, or unassigned (Chris 11 Nov 2026): a compact "Open" chip,
// the same in every view (owner, Admin, Partial Admin). Released from someone who went offline: still "Open", and the
// tooltip says who.
export function openTitle(lead: Pick<Lead, 'released_from'>): string {
  const first = lead.released_from?.name?.trim().split(/\s+/)[0];
  return first ? `${first} went offline` : 'Waiting to be accepted';
}

export default function OpenBadge({ lead, className = '' }: { lead: Pick<Lead, 'released_from'>; className?: string }) {
  return (
    <span
      title={openTitle(lead)}
      data-open-badge
      className={`shrink-0 inline-flex items-center gap-1.5 h-5 px-2 rounded-full border border-gray-200 bg-white text-[12px] font-medium text-gray-700 whitespace-nowrap ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
      Open
    </span>
  );
}
