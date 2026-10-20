import type { NewsletterStatus, RecipientStatus } from '../../services/newslettersAPI';
import { RECIPIENT_STATUS_META, STATUS_META } from './lib/newsletterList';

/** A newsletter's status (or, with `recipient`, one person's) as a small rounded chip. */
export default function StatusChip({ status, recipient = false }: { status: NewsletterStatus | RecipientStatus; recipient?: boolean }) {
  const meta = recipient ? RECIPIENT_STATUS_META[status as RecipientStatus] : STATUS_META[status as NewsletterStatus];
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${meta?.className ?? 'bg-gray-100 text-gray-700'}`}>
      {meta?.label ?? status}
    </span>
  );
}
