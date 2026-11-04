import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { AudienceItem, NewsletterBlock, NewsletterChannel } from '../../services/newslettersAPI';
import { storeelBroadcastAPI } from '../../services/storeelBroadcastAPI';
import AudiencePicker from '../newsletters/AudiencePicker';
import StepCard from '../newsletters/StepCard';
import { useAudienceCount } from '../newsletters/hooks/useAudienceCount';
import { countableAudience } from '../newsletters/lib/person';
import StoreelSendConfirmDialog from './StoreelSendConfirmDialog';
import { stepNumber, type CampaignSeed, type StepStatus } from './lib/storeelFlow';
import { storeelSmsParts, storeelSmsPreview } from './lib/storeelSms';
import { sendProblem, type SendFailure, type StoreelCount, type StoreelSendSummary } from './lib/storeelSend';

export const SEND_STEP_ID = 'st-step-send';
const CANT_SEND = "Only the campaign's owner or its business's admins can send it.";

type Extra = { limit: StoreelCount['limit']; allowance: StoreelCount['allowance']; unavailable?: boolean; forbidden?: boolean; error?: string };
type Patch = { audience?: AudienceItem[]; channels?: NewsletterChannel[]; sms_text?: string; blocks?: NewsletterBlock[] };

export interface StoreelSendStepHandle {
  /** Send Now in the top bar / phone footer: check the step, then ask to confirm. */
  startSend(): void;
}

export interface StoreelSendStepProps {
  /** The saved campaign (null until Set up is saved: the card is not reached yet). */
  campaign: CampaignSeed | null;
  status: StepStatus;
  /** Who the text says it came from (senderLabelFor). */
  sender: string;
  /** Lists and lead suggestions (paid plans only). */
  paid: boolean;
  /** False when this account may not send the campaign (not its owner): the step says so instead. */
  canSend: boolean;
  /** The flow is showing (counts are asked for only then). */
  active: boolean;
  onSent(summary: StoreelSendSummary): void;
  onSeePlans(): void;
  /** The API said this account may not send it (403): the top bar's Send Now goes off. */
  onForbidden?(): void;
}

/**
 * Step 3 Send (Chris, 4 Nov 2026, point 9): the newsletter composer's audience (Single person — email box and/or
 * country-code phone — All leads, lead groups, lists, one or the other), Email and/or Text, a personal message with the
 * text-parts counter, and Estimated recipients from POST /memories/{id}/storeel-audience-count. Send Now (top bar)
 * checks, then asks to confirm (StoreelSendConfirmDialog). Each person gets the message and their own tracked link.
 */
const StoreelSendStep = forwardRef<StoreelSendStepHandle, StoreelSendStepProps>(function StoreelSendStep(
  { campaign, status, sender, paid, canSend, active, onSent, onSeePlans, onForbidden }, ref,
) {
  // Single person first (as newsletters), sent by email and text (Deepak, 4 Nov).
  const [audience, setAudience] = useState<AudienceItem[]>([]);
  const [channels, setChannels] = useState<NewsletterChannel[]>(['email', 'sms']);
  const [message, setMessage] = useState('');
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [serverStepError, setServerStepError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const onForbiddenRef = useRef(onForbidden);
  onForbiddenRef.current = onForbidden;
  useEffect(() => { if (forbidden) onForbiddenRef.current?.(); }, [forbidden]);
  const audienceRef = useRef(audience);
  audienceRef.current = audience;

  const current = status === 'current' && campaign !== null;
  const campaignId = campaign?.id ?? 0;
  const count = useAudienceCount<Extra>(countableAudience(audience), channels, active && current && canSend && !forbidden, async (aud, ch) => {
    const r = await storeelBroadcastAPI.audienceCount(campaignId, aud, ch);
    if (r.forbidden) setForbidden(true);
    return {
      ok: r.ok, data: r.data?.counts, error: r.error,
      extra: { limit: r.data?.limit ?? null, allowance: r.data?.allowance ?? null, unavailable: r.unavailable, forbidden: r.forbidden },
    };
  }, campaignId);
  const limit = count.extra?.limit ?? null;
  const allowance = count.extra?.allowance ?? null;
  const parts = storeelSmsParts({ sender, message, slug: campaign?.slug ?? null, isCar: Boolean(campaign?.isCar), viewOnly: campaign?.published === 2 });

  const change = (patch: Patch | ((latest: { audience: AudienceItem[]; blocks: NewsletterBlock[] }) => Patch | null)) => {
    const p = typeof patch === 'function' ? patch({ audience: audienceRef.current, blocks: [] }) : patch;
    if (!p) return;
    if (p.audience) setAudience(p.audience);
    if (p.channels) setChannels(p.channels);
    if (p.sms_text !== undefined) setMessage(p.sms_text);
    // An answer from the API is about what was sent then: it goes once that part is changed.
    setServerErrors((errors) => Object.fromEntries(Object.entries(errors).filter(([key]) => {
      const root = key.split('.')[0];
      if (p.sms_text !== undefined && root === 'message') return false;
      if ((p.audience || p.channels) && (root === 'audience' || root === 'channels')) return false;
      return true;
    })));
    setServerStepError(null);
  };

  const problem = attempted ? sendProblem({ audience, channels, message, counts: count.counts, smsProblem: parts.problem, limit }) : null;
  const unavailable = count.extra?.unavailable ? count.error : null;

  const showStep = () => {
    const el = document.getElementById(SEND_STEP_ID);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
  };

  useImperativeHandle(ref, () => ({
    startSend: () => {
      setAttempted(true);
      const p = sendProblem({ audience, channels, message, counts: count.counts, smsProblem: parts.problem, limit });
      if (p) {
        showStep();
        toast.error('Finish the step marked in red, then try again.');
        return;
      }
      setConfirmOpen(true);
    },
  }));

  const failed = (f: SendFailure) => {
    setConfirmOpen(false);
    if (f.forbidden) setForbidden(true);
    const fields = { ...f.fieldErrors };
    setServerErrors(fields);
    // The step's own banner for what no field shows (not available yet, nobody can be reached, …).
    const inline = Object.keys(fields).some((k) => /^(message|channels|audience\.\d+\.(email|phone))$/.test(k));
    setServerStepError(inline ? null : f.message);
    showStep();
    toast.error(f.message);
  };

  const title = 'Send';
  if (status === 'locked' || !campaign) {
    return (
      <StepCard number={stepNumber('send')} title={title} id={SEND_STEP_ID}>
        <p className="text-sm text-gray-500">Send your campaign to a person, your leads or your lists. Finish the steps above first.</p>
      </StepCard>
    );
  }
  if (!canSend || forbidden) {
    return (
      <StepCard number={stepNumber('send')} title={title} id={SEND_STEP_ID}>
        <p role="status" className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{CANT_SEND}</p>
      </StepCard>
    );
  }

  // The API's 422 field errors under their fields: `message` is the Message box (sms_text in the newsletter picker).
  const fieldErrors = { ...serverErrors, ...(serverErrors.message ? { sms_text: serverErrors.message } : {}) };
  return (
    <>
      <AudiencePicker
        step={{ number: stepNumber('send'), title, id: SEND_STEP_ID }}
        idPrefix="st"
        paid={paid}
        audience={audience}
        channels={channels}
        smsText={message}
        fromName={sender}
        // Not available yet is said once, on the step (not again under Estimated recipients).
        count={unavailable ? { ...count, error: null } : count}
        readOnly={false}
        enabled={active}
        fieldErrors={fieldErrors}
        stepError={problem ?? serverStepError ?? unavailable ?? undefined}
        onChange={change}
        message={{
          required: true,
          hint: 'Your note to each person. We add their own link to your campaign after it.',
          placeholder: 'Come see our spring open house this weekend.',
          smsHelp: 'We add their link, a YES / NO question and "Reply STOP to unsubscribe."',
          parts,
          preview: storeelSmsPreview(sender, message, campaign.isCar),
        }}
      />
      <StoreelSendConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        memoryId={campaign.id}
        published={campaign.published}
        audience={audience}
        channels={channels}
        message={message}
        counts={count.counts}
        countsLoading={count.loading}
        smsParts={parts.parts}
        limit={limit}
        allowance={allowance}
        onSent={(s) => { setConfirmOpen(false); onSent(s); }}
        onFailed={failed}
        onSeePlans={() => { setConfirmOpen(false); onSeePlans(); }}
      />
    </>
  );
});

export default StoreelSendStep;
