import { useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import {
  newslettersAPI, type AudienceCount, type Newsletter, type NewsletterAllowance, type NewsletterChannel,
} from '../../services/newslettersAPI';
import ComposerDialog from './ComposerDialog';
import type { NlResult } from './lib/apiResult';
import { formatCount } from './lib/audience';
import { formatSendTime, localDateTimeToIso, timeZoneName, type ScheduleChoice } from './lib/schedule';
import { allowanceLine, allowanceProblem, nextMonthLine, usesNextMonthAllowance } from './lib/sendChecks';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, LABEL, LINK_BUTTON, textareaClass } from './lib/ui';

export interface SendConfirmDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  newsletterId: number | null;
  channels: NewsletterChannel[];
  counts: AudienceCount | null;
  /** The live count is still on its way (shown as "Counting…" rather than "—"). */
  countsLoading?: boolean;
  /** Text message parts per person (the text allowance counts parts). */
  smsParts?: number;
  schedule: ScheduleChoice;
  businessAddress: string | null;
  onSaveAddress(address: string): Promise<boolean>;
  onSent(n: Newsletter): void;
  /** Any other failure (422 on a step, 409, network): the composer shows it on the steps. */
  onFailed(res: NlResult<Newsletter>): void;
  /** Over the allowance: close the composer and open the plans. */
  onSeePlans?(): void;
}

/** Last check before sending: who gets it, when, the monthly allowance, and the business address on the first send. */
export default function SendConfirmDialog({
  open, onOpenChange, newsletterId, channels, counts, countsLoading = false, smsParts = 1, schedule, businessAddress, onSaveAddress, onSent, onFailed, onSeePlans,
}: SendConfirmDialogProps) {
  const [allowance, setAllowance] = useState<NewsletterAllowance | null>(null);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The API's 422 allowance answer (its own words, for this month or, after the reset, for next month).
  const [allowanceError, setAllowanceError] = useState<string | null>(null);
  const later = schedule.mode === 'later';
  const iso = schedule.mode === 'later' ? localDateTimeToIso(schedule.date, schedule.time) : null;
  const needsAddress = !businessAddress;
  // A send after the monthly reset uses next month's allowance: only the API can check that (wdy2xh2p3m).
  const nextMonth = usesNextMonthAllowance(allowance, iso);
  const overLimit = allowanceError ?? (nextMonth ? null : allowanceProblem(allowance, counts, channels, smsParts));

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError(null);
    setAllowanceError(null);
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
    // The allowance message already has the numbers ("needs N emails, but your plan has M left"). A refused time
    // (scheduled_at, e.g. texts in quiet hours) goes back to step 6 with the composer's other step errors.
    if (res.fieldErrors.allowance) { setAllowanceError(res.fieldErrors.allowance); return; }
    const inline = res.fieldErrors.business_address;
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
          <div className="flex justify-between gap-3"><dt className="text-gray-600">Text message</dt><dd className="text-right font-semibold text-gray-900">{counts && !countsLoading ? `${formatCount(counts.sms)} people${smsParts > 1 ? ` · ${smsParts} parts each` : ''}` : countsLoading ? 'Counting…' : '—'}</dd></div>
        ) : null}
      </dl>
      {allowance ? <p className="mt-3 text-sm text-gray-600">{nextMonth ? nextMonthLine(allowance) : allowanceLine(allowance, channels)}</p> : null}
      {overLimit ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="min-w-0 flex-1 basis-56">{overLimit}</p>
          {onSeePlans ? <button type="button" onClick={onSeePlans} className={`${LINK_BUTTON} whitespace-nowrap`}>See plans</button> : null}
        </div>
      ) : null}
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
