import type { AudienceCount, NewsletterChannel } from '../../services/newslettersAPI';
import { formatCount } from './lib/audience';
import { LINK_BUTTON } from './lib/ui';

/** The confirm dialogs' "Email · N people" / "Text message · N people · P parts each" rows (newsletter Send and the
 *  Storeel flow's Send now). */
export function SendCountRows({ channels, counts, countsLoading = false, smsParts = 1 }: {
  channels: NewsletterChannel[];
  counts: AudienceCount | null;
  countsLoading?: boolean;
  smsParts?: number;
}) {
  return (
    <dl className="space-y-2 text-sm">
      {channels.includes('email') ? (
        <div className="flex justify-between gap-3"><dt className="text-gray-600">Email</dt><dd className="font-semibold text-gray-900">{counts && !countsLoading ? `${formatCount(counts.email)} people` : countsLoading ? 'Counting…' : '—'}</dd></div>
      ) : null}
      {channels.includes('sms') ? (
        <div className="flex justify-between gap-3"><dt className="text-gray-600">Text message</dt><dd className="text-right font-semibold text-gray-900">{counts && !countsLoading ? `${formatCount(counts.sms)} people${smsParts > 1 ? ` · ${smsParts} parts each` : ''}` : countsLoading ? 'Counting…' : '—'}</dd></div>
      ) : null}
    </dl>
  );
}

/** Said right at the Send button: why it is off, or what won't go out. Amber (with See plans) when it is the plan's
 *  monthly allowance. */
export function SendNote({ id, text, alert, amber, onSeePlans }: {
  id: string;
  text: string;
  alert: boolean;
  amber: boolean;
  onSeePlans?(): void;
}) {
  return (
    <div id={id} role={alert ? 'alert' : 'status'}
      className={`flex basis-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-sm ${amber ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-700'}`}>
      <p className="min-w-0 flex-1 basis-56">{text}</p>
      {amber && onSeePlans ? <button type="button" onClick={onSeePlans} className={`${LINK_BUTTON} whitespace-nowrap`}>See plans</button> : null}
    </div>
  );
}
