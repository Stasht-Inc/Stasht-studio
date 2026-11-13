import type { Lead } from '../../services/leadsAPI';

// A lead someone else on the team has claimed (Chris 13 Nov 2026): a gray "Claimed" chip, and who in small gray text.
export function claimedTitle(lead: Pick<Lead, 'assignee'>): string {
  const name = lead.assignee?.name?.trim();
  return name ? `Claimed by ${name}` : 'Claimed';
}

export default function ClaimedBadge({ lead, className = '', showName = true }: { lead: Pick<Lead, 'assignee'>; className?: string; showName?: boolean }) {
  const first = lead.assignee?.name?.trim().split(/\s+/)[0];
  return (
    <span title={claimedTitle(lead)} data-claimed-badge className={`min-w-0 inline-flex items-center gap-1.5 ${className}`}>
      <span className="shrink-0 inline-flex items-center h-5 px-2 rounded-full border border-gray-200 bg-gray-100 text-[12px] font-medium text-gray-600 whitespace-nowrap">
        Claimed
      </span>
      {showName && first && <span className="min-w-0 truncate text-[12px] text-gray-500">{first}</span>}
    </span>
  );
}
