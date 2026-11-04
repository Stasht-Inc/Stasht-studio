import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import type { AudienceCount, AudienceItem, NewsletterAllowance, NewsletterChannel } from '../../services/newslettersAPI';
import { storeelBroadcastAPI } from '../../services/storeelBroadcastAPI';
import ComposerDialog from '../newsletters/ComposerDialog';
import { SendCountRows, SendNote } from '../newsletters/SendSummary';
import { formatCount, skippedSummary } from '../newsletters/lib/audience';
import { allowanceLine, sendAllowance, sendBlockedReason } from '../newsletters/lib/sendChecks';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '../newsletters/lib/ui';
import { newIdempotencyKey, sendPayload } from './lib/storeelFlow';
import { sendFailure, type SendFailure, type StoreelLimit, type StoreelSendSummary } from './lib/storeelSend';

export interface StoreelSendConfirmDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  memoryId: number;
  /** memories.published: 0 → sending publishes it (Public); 3 (private link) → the API refuses. */
  published: number;
  audience: AudienceItem[];
  channels: NewsletterChannel[];
  message: string;
  counts: AudienceCount | null;
  countsLoading: boolean;
  smsParts: number;
  limit: StoreelLimit | null;
  allowance: NewsletterAllowance | null;
  onSent(summary: StoreelSendSummary): void;
  /** Field errors (message, audience, …) and anything else the dialog can't show itself. */
  onFailed(f: SendFailure): void;
  /** Over the plan's monthly allowance: close the flow and open the plans. */
  onSeePlans(): void;
}

/** "Send this Storeel now?" — who gets it, the plan's allowance (shared with newsletters), the per-send cap, and that
 *  sending publishes an unpublished campaign. One idempotency key per press of Send now, reused if it is retried. */
export default function StoreelSendConfirmDialog({
  open, onOpenChange, memoryId, published, audience, channels, message, counts, countsLoading, smsParts, limit, allowance, onSent, onFailed, onSeePlans,
}: StoreelSendConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowanceError, setAllowanceError] = useState<string | null>(null);
  const keyRef = useRef<string>('');

  useEffect(() => {
    if (!open) return;
    keyRef.current = newIdempotencyKey();
    setError(null);
    setAllowanceError(null);
  }, [open]);

  const check = sendAllowance(allowance, counts, channels, smsParts);
  const privateLink = published === 3 ? 'This campaign is shared by private link only. Publish it as Public or View Only on the campaign page, then send it.' : null;
  const problem = allowanceError ?? check.problem ?? privateLink;
  const skipNote = allowanceError ? null : check.note;
  const blockedReason = sendBlockedReason({ busy, countsLoading, problem, saved: true });
  const atButton = blockedReason ?? skipNote;
  const aboutAllowance = blockedReason ? blockedReason === (allowanceError ?? check.problem) : Boolean(skipNote);
  const skipped = skippedSummary(counts, channels);
  const messages = limit ? limit.needed : null;

  const confirm = async () => {
    setError(null);
    setBusy(true);
    const res = await storeelBroadcastAPI.send(memoryId, sendPayload({ audience, channels, message, idempotencyKey: keyRef.current }));
    setBusy(false);
    if (res.ok && res.data) { onSent(res.data); return; }
    const f = sendFailure(res);
    if (f.allowance) { setAllowanceError(f.allowance); return; }
    // Refusals about the steps (the message, a typed person, nobody reachable) go back to the step, under their fields.
    if (Object.keys(f.fieldErrors).length || f.unavailable || f.forbidden) { onFailed(f); return; }
    setError(f.message);
  };

  const footer = (
    <>
      {atButton ? <SendNote id="st-send-note" text={atButton} alert={Boolean(blockedReason && aboutAllowance)} amber={aboutAllowance} onSeePlans={onSeePlans} /> : null}
      <button type="button" onClick={() => onOpenChange(false)} disabled={busy} className={BUTTON_OUTLINE}>Back</button>
      <button type="button" onClick={confirm} disabled={busy || Boolean(blockedReason)} aria-describedby={atButton ? 'st-send-note' : undefined} className={BUTTON_PRIMARY}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        Send Now
      </button>
    </>
  );

  return (
    <ComposerDialog
      open={open}
      onOpenChange={(o) => { if (!busy) onOpenChange(o); }}
      title="Send this Storeel now?"
      description="Each person gets your message with their own link to the campaign."
      footer={footer}
    >
      <SendCountRows channels={channels} counts={counts} countsLoading={countsLoading} smsParts={smsParts} />
      {skipped ? <p className="mt-3 text-sm text-gray-600">{skipped}</p> : null}
      {allowance ? <p className="mt-3 text-sm text-gray-600">{allowanceLine(allowance, channels)}</p> : null}
      {messages !== null && limit ? (
        <p className="mt-3 text-sm text-gray-600">{`${formatCount(messages)} ${messages === 1 ? 'message' : 'messages'} (up to ${formatCount(limit.max_messages)} per send).`}</p>
      ) : null}
      {published === 0 ? <p className="mt-3 text-sm text-gray-600">Sending publishes your campaign (Public), so people can open it.</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </ComposerDialog>
  );
}
