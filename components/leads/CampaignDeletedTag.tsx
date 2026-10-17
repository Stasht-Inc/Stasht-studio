/**
 * Small grey tag for a lead whose campaign was deleted (ClickUp wdy2xh2a38).
 * The lead stays in the list; this tells the rep why its campaign can't be opened.
 * Same height/radius/type size as the status pill in the Leads inbox.
 */
export default function CampaignDeletedTag({ className = '' }: { className?: string }) {
  return (
    <span
      title="This lead's campaign was deleted"
      className={`shrink-0 inline-flex items-center h-5 px-1.5 rounded border border-gray-200 bg-gray-100 text-[12px] font-medium text-gray-500 whitespace-nowrap ${className}`}
    >
      Campaign deleted
    </span>
  );
}
