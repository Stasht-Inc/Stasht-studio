import { useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import {
  newslettersAPI, type AudienceCount, type Newsletter, type NewsletterAllowance, type NewsletterChannel,
} from '../../services/newslettersAPI';
import ComposerDialog from './ComposerDialog';
import type { NlResult } from './lib/apiResult';
import { formatCount } from './lib/audience';
import { formatSendTime, localDateTimeToIso, timeZoneName, type ScheduleChoice } from './lib/schedule';
import { allowanceLine, allowanceProblem } from './lib/sendChecks';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, LABEL, textareaClass } from './lib/ui';

export interface SendConfirmDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  newsletterId: number | null;
  channels: NewsletterChannel[];
  counts: AudienceCount | null;
  /** The live count is still on its way (shown as "Counting…" rather than "—"). */
  countsLoading?: boolean;
  schedule: ScheduleChoice;
  businessAddress: string | null;
  onSaveAddress(address: string): Promise<boolean>;
  onSent(n: Newsletter): void;
  /** Any other failure (422 on a step, 409, network): the composer shows it on the steps. */
  onFailed(res: NlResult<Newsletter>): void;
}

/** Last check before sending: who gets it, when, the monthly allowance, and the business address on the first send. */
export default function SendConfirmDialog({
  open, onOpenChange, newsletterId, channels, counts, countsLoading = false, schedule, businessAddress, onSaveAddress, onSent, onFailed,
}: SendConfirmDialogProps) {
  const [allowance, setAllowance] = useState<NewsletterAllowance | null>(null);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const later = schedule.mode === 'later';
  const iso = schedule.mode === 'later' ? localDateTimeToIso(schedule.date, schedule.time) : null;
  const needsAddress = !businessAddress;
  const overLimit = allowanceProblem(allowance, counts, channels);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError(null);
    setAddress('');
    newslettersAPI.allowance().then((res) => { if (!cancelled && res.ok && res.data) setAllowance(res.data); });
    return () => { cancelled = true; };
  }, [open]);

  const confirm = async () => {
    if (!newsletterId) return;
    setError(null);
    if (needsAddress) {
      const value = address.trim();
      if (!value) { setError('Add your business address.'); return; }
      setBusy(true);
      if (!(await onSaveAddress(value))) { setBusy(false); setError('Your address could not be saved. Try again.'); return; }
    }
    // Schedule for later with no usable time must never fall back to sending now.
    if (later && !iso) { setBusy(false); setError('Pick a date and time for the newsletter, then try again.'); return; }
    setBusy(true);
    const res = later && iso ? await newslettersAPI.schedule(newsletterId, iso) : await newslettersAPI.send(newsletterId);
    setBusy(false);
    if (res.ok && res.data) { onSent(res.data); return; }
    // The allowance message already has the numbers ("needs N emails, but your plan has M left").
    const inline = res.fieldErrors.allowance ?? res.fieldErrors.business_address ?? res.fieldErrors.scheduled_at;
    if (inline) { setError(inline); return; }
    onFailed(res);
  };

  const footer = (
    <>
      <button type="button" onClick={() => onOpenChange(false)} disabled={busy} className={BUTTON_OUTLINE}>Back</button>
      <button type="button" onClick={confirm} disabled={busy || countsLoading || Boolean(overLimit) || !newsletterId} className={BUTTON_PRIMARY}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        {later ? 'Schedule' : 'Send Now'}
      </button>
    </>
  );

  return (
    <ComposerDialog
      open={open}
      onOpenChange={(o) => { if (!busy) onOpenChange(o); }}
      title={later ? 'Schedule this newsletter?' : 'Send this newsletter now?'}
      description={later ? `It goes out ${formatSendTime(iso)} (${timeZoneName()}).` : 'It starts going out within a minute.'}
      footer={footer}
    >
      <dl className="space-y-2 text-sm">
        {channels.includes('email') ? (
          <div className="flex justify-between gap-3"><dt className="text-gray-600">Email</dt><dd className="font-semibold text-gray-900">{counts && !countsLoading ? `${formatCount(counts.email)} people` : countsLoading ? 'Counting…' : '—'}</dd></div>
        ) : null}
        {channels.includes('sms') ? (
          <div className="flex justify-between gap-3"><dt className="text-gray-600">Text message</dt><dd className="font-semibold text-gray-900">{counts && !countsLoading ? `${formatCount(counts.sms)} people` : countsLoading ? 'Counting…' : '—'}</dd></div>
        ) : null}
      </dl>
      {allowance ? <p className="mt-3 text-sm text-gray-600">{allowanceLine(allowance, channels)}</p> : null}
      {overLimit ? <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{overLimit}</p> : null}
      {needsAddress ? (
        <div className="mt-4">
          <label htmlFor="nl-confirm-address" className={LABEL}>Business address</label>
          <textarea id="nl-confirm-address" rows={2} value={address} placeholder="4505 Steeles Ave W, Toronto, ON M9L 1A1" aria-describedby="nl-confirm-address-help"
            onChange={(e) => setAddress(e.target.value)} className={textareaClass()} />
          <p id="nl-confirm-address-help" className="mt-1.5 text-xs text-gray-500">Email laws require your business address at the bottom of every email. We'll remember it.</p>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </ComposerDialog>
  );
}
