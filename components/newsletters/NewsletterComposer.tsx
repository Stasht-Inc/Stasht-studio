import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { FocusScope } from '@radix-ui/react-focus-scope';
import { ArrowLeft, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ComposerToaster, { composerToast } from './ComposerToaster';
import { useIsStarterPlan } from '../../hooks/usePlan';
import { requestUpgrade } from '../../utils/planEvents';
import { useNewsletterBrand } from './hooks/useNewsletterBrand';
import { useNewsletterDraft } from './hooks/useNewsletterDraft';
import { useSenderProfile } from './hooks/useSenderProfile';
import { useBackToClose } from './hooks/useBackToClose';
import { DRAFT_SAVED_MESSAGE, openNewsletterDraft, openNewsletterResults } from './lib/campaignsView';
import { fieldProblems, type NewsletterDraft } from './lib/draft';
import { GENERIC_ERROR, PLAN_REQUIRED_ERROR, type NlResult } from './lib/apiResult';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_SECONDARY, LAYER, LINK_BUTTON } from './lib/ui';
import StepCard from './StepCard';
import NewsletterEditor from './NewsletterEditor';
import DeviceToggle, { type PreviewDevice } from './DeviceToggle';
import TemplatePicker from './TemplatePicker';
import AudiencePicker from './AudiencePicker';
import { useAudienceCount } from './hooks/useAudienceCount';
import { newslettersAPI, type Newsletter, type NewsletterChannel } from '../../services/newslettersAPI';
import ScheduleStep from './ScheduleStep';
import PreviewDialog from './PreviewDialog';
import SendTestButton from './SendTestButton';
import { formatSendTime, plannedFromSchedule, sameInstant, scheduleFromPlanned, type ScheduleChoice } from './lib/schedule';
import { firstProblemStep, preSendProblems, stepDomId, stepErrorsFrom, type StepKey } from './lib/sendChecks';
import { formatSentTo } from './lib/phoneDisplay';
import { smsPartsInfo } from './lib/smsParts';
import { OFF_SCHEDULE_BANNER, clearUnscheduled, putBackProblem, unscheduledFor } from './lib/editScheduled';
import { ACTION_TOAST_MS, normaliseBlocks } from './lib/blocks';
import SendConfirmDialog from './SendConfirmDialog';
import SaveIndicator from './SaveIndicator';
import DraftNotices from './DraftNotices';
import UpgradeCard from './UpgradeCard';
import ComposerDialog from './ComposerDialog';
import NameStep from './steps/NameStep';
import FromStep from './steps/FromStep';
import SubjectStep from './steps/SubjectStep';

export interface NewsletterComposerHandle {
  focusName(): void;
}

export interface NewsletterComposerProps {
  /** Open this newsletter (a draft is editable; anything else opens read-only). Null starts a new one. */
  newsletterId: number | null;
  /** The Newsletter | Storeel switch, owned by CreateMemory. */
  switcher: ReactNode;
  /** Kept mounted (state kept) while the Storeel tab shows. */
  hidden?: boolean;
  onClose(): void;
  /** A draft was saved, sent or scheduled: lists should refresh. */
  onChanged?(): void;
  onSwitchToStoreel(): void;
}

const STATUS_WORDS: Record<string, string> = { scheduled: 'scheduled', sending: 'being sent', sent: 'sent', failed: 'one that failed to send', cancelled: 'cancelled' };

const PLAN_CHECK_PATIENCE_MS = 20000;

// 422 keys shown under their own field (so the step card doesn't repeat them).
const INLINE_KEYS = new Set(['name', 'from_name', 'reply_to_email', 'subject', 'preview_text', 'audience', 'channels', 'sms_text']);

// Phones: the three buttons share the row; from sm up they keep their natural width.
const ROW_BUTTON = 'min-w-0 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-5';

const NewsletterComposer = forwardRef<NewsletterComposerHandle, NewsletterComposerProps>(function NewsletterComposer(
  { newsletterId, switcher, hidden = false, onClose, onChanged, onSwitchToStoreel },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  // focusName() can arrive while the plan is still loading (no name field yet): focus it once it mounts.
  const focusNamePendingRef = useRef(false);
  const setNameInput = useCallback((el: HTMLInputElement | null) => {
    nameRef.current = el;
    if (el && focusNamePendingRef.current) {
      focusNamePendingRef.current = false;
      el.focus();
    }
  }, []);
  useImperativeHandle(ref, () => ({
    focusName: () => {
      if (nameRef.current) nameRef.current.focus();
      else focusNamePendingRef.current = true;
    },
  }), []);

  // Paid plans only (spec decision 4). No newsletter call until the plan is known to be paid: a Starter
  // account would get 403 plan_required, and the upgrade plans would open under this layer (contract note 1).
  const plan = useIsStarterPlan();
  const { isStarter, known } = plan;
  const enabled = known && !isStarter;
  // The plan check failed, or is taking far too long: say so and offer "Try again" instead of waiting forever.
  const [planSlow, setPlanSlow] = useState(false);
  useEffect(() => {
    if (known || plan.failed) return undefined;
    const timer = window.setTimeout(() => setPlanSlow(true), PLAN_CHECK_PATIENCE_MS);
    return () => window.clearTimeout(timer);
  }, [known, plan.failed]);
  const planStuck = !known && (plan.failed || planSlow);
  const retryPlan = () => { setPlanSlow(false); plan.retry(); };
  const brand = useNewsletterBrand(enabled);
  const state = useNewsletterDraft(newsletterId, enabled, brand.brand?.header ?? null);
  const profile = useSenderProfile(enabled);
  const { draft, update, readOnly } = state;
  // The sections as the API last saved them (a Campaigns section's cards are the server's snapshot).
  const savedBlocks = useMemo(() => normaliseBlocks(state.newsletter?.blocks), [state.newsletter]);
  // The name the API puts before a text when the From name is empty: the owner's name (NewsletterSendCheck::fromNameFor).
  const fallbackFromName = profile?.name?.trim().slice(0, 80) || 'Stasht';
  const smsFromName = draft.from_name.trim() || fallbackFromName;
  const smsParts = smsPartsInfo(smsFromName, draft.sms_text).parts;
  // Live recipient counts only while the Newsletter tab shows on a paid plan (debounced in the hook).
  const audienceCount = useAudienceCount(draft.audience, draft.channels, enabled && !hidden && !state.loading);
  const [closing, setClosing] = useState(false);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  // True after the first Send / Schedule attempt: from then on, unfinished steps and sections show their problems.
  const [attempted, setAttempted] = useState(false);
  // scheduled_at is set only by /schedule (alignment decision 7); the picked time is kept on the draft as
  // planned_send_at (wdy2xh2p3m) so it comes back when the draft is opened again.
  const [schedule, setSchedule] = useState<ScheduleChoice>({ mode: 'now' });
  // The draft's planned time (opening a draft, restoring a kept copy, Reload) shows in the Schedule step, unless
  // the step already says the same moment (or is still being filled in with no whole time yet).
  useEffect(() => {
    if (state.loading || sameInstant(draft.planned_send_at, plannedFromSchedule(schedule))) return;
    if (!draft.planned_send_at && schedule.mode === 'later' && !plannedFromSchedule(schedule)) return;
    setSchedule(scheduleFromPlanned(draft.planned_send_at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.planned_send_at, state.loading]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testing, setTesting] = useState(false);

  // The exact email and the test both render the saved draft, so save first (this also creates a new draft).
  const loadPreview = async (): Promise<NlResult<{ html: string; size_kb?: number }>> => {
    const saved = await state.saveNow();
    if (!saved.newsletter) return { ok: false, error: saved.error ?? GENERIC_ERROR, fieldErrors: {} };
    return newslettersAPI.preview(saved.newsletter.id);
  };

  const sendTest = async (channel: NewsletterChannel) => {
    setTesting(true);
    const saved = await state.saveNow();
    if (!saved.newsletter) {
      setTesting(false);
      composerToast.error(saved.error ?? GENERIC_ERROR);
      return;
    }
    const res = await newslettersAPI.sendTest(saved.newsletter.id, channel);
    setTesting(false);
    if (res.ok && res.data) composerToast.success(`Test sent to ${formatSentTo(res.data.sent_to)}.`);
    else {
      // 422 channel (no email / mobile on the profile) or sms_text; 429 the hourly test limit; 502 not sent.
      if (res.fieldErrors.sms_text) state.setFieldErrors(res.fieldErrors);
      composerToast.error(res.fieldErrors.channel ?? res.fieldErrors.sms_text ?? res.error ?? GENERIC_ERROR);
    }
  };

  const later = schedule.mode === 'later';
  // A time the API refused (422 scheduled_at) stops applying once another time is picked.
  const changeSchedule = (next: ScheduleChoice) => {
    setSchedule(next);
    const planned = plannedFromSchedule(next);
    if (!sameInstant(planned, draft.planned_send_at)) update({ planned_send_at: planned });
    if (state.fieldErrors.scheduled_at) {
      state.setFieldErrors(Object.fromEntries(Object.entries(state.fieldErrors).filter(([key]) => key.split('.')[0] !== 'scheduled_at')));
    }
  };
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  // A 403 plan_required from any call: apiRequest has already asked App to open the upgrade plans, which sit
  // under this layer, so step out of the way.
  useEffect(() => {
    if (state.planRequired) onClose();
  }, [state.planRequired, onClose]);

  // Studio's own checks once Send was pressed, then the API's 422 answer. Keys a step's fields already show
  // (name, from, subject, recipients' audience / channels / text) appear under the field, not twice.
  const problems = attempted ? preSendProblems(draft, audienceCount.counts, schedule, undefined, fallbackFromName) : {};
  const serverSteps = stepErrorsFrom(Object.fromEntries(Object.entries(state.fieldErrors).filter(([key]) => !INLINE_KEYS.has(key.split('.')[0]))));
  const stepError = (key: StepKey): string | undefined => problems[key] ?? serverSteps[key];

  const showStep = (key: StepKey) => {
    const el = document.getElementById(stepDomId(key));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
  };

  const startSend = async () => {
    setAttempted(true);
    const first = firstProblemStep(preSendProblems(draft, audienceCount.counts, schedule, undefined, fallbackFromName));
    if (first) {
      showStep(first);
      composerToast.error('Finish the steps marked in red, then try again.');
      return;
    }
    setStarting(true);
    const saved = await state.saveNow();
    setStarting(false);
    if (!saved.newsletter) {
      composerToast.error(saved.error ?? GENERIC_ERROR);
      return;
    }
    setConfirmOpen(true);
  };

  const onSent = (n: Newsletter) => {
    setConfirmOpen(false);
    clearUnscheduled(n.id);
    state.adopt(n);
    // The composer closes now, so this one goes to App's Toaster.
    toast.success(later ? `Scheduled for ${formatSendTime(n.scheduled_at)}.` : 'Sending now. Follow it in Campaigns › Newsletters.', {
      duration: ACTION_TOAST_MS,
      action: { label: 'View', onClick: () => openNewsletterResults(n.id) },
    });
    onChanged?.();
    onClose();
  };

  // Over the plan's allowance: the plans open once the composer has closed (they sit under this layer).
  const seePlans = async () => {
    setConfirmOpen(false);
    if (await close({ askPutBack: false })) requestUpgrade('Upgrade your plan to send more newsletters this month.');
  };

  const onSendFailed = (res: NlResult<Newsletter>) => {
    setConfirmOpen(false);
    if (res.planRequired) { onClose(); return; }
    if (res.paused) {
      // Sending is switched off (for everyone, or for this account): the draft stays as it is.
      composerToast.error(res.error ?? GENERIC_ERROR);
      return;
    }
    if (res.stale) {
      // The draft kept changing while it was being sent (another tab): it stays a draft here; Reload shows the latest.
      state.markStale(res.error ?? GENERIC_ERROR);
      composerToast.error(res.error ?? GENERIC_ERROR);
      return;
    }
    if (res.conflict) {
      // Sent or scheduled somewhere else meanwhile: show it as it is now (read-only).
      composerToast.error(res.error ?? GENERIC_ERROR);
      const id = state.newsletter?.id;
      if (id) void newslettersAPI.get(id).then((r) => { if (r.ok && r.data) state.adopt(r.data); });
      onChanged?.();
      return;
    }
    state.setFieldErrors(res.fieldErrors);
    const first = firstProblemStep(stepErrorsFrom(res.fieldErrors));
    if (first) {
      showStep(first);
      composerToast.error('Finish the steps marked in red, then try again.');
    } else {
      composerToast.error(res.error ?? GENERIC_ERROR);
    }
  };
  const saveAddress = async (address: string): Promise<boolean> => {
    const res = await brand.saveAddress(address);
    if (!res.ok) composerToast.error(res.error ?? GENERIC_ERROR);
    return res.ok;
  };

  const live = fieldProblems(draft);
  const fieldError = (key: keyof NewsletterDraft): string | undefined => live[key] ?? state.fieldErrors[key];

  // Cancel, Back and Escape. If the last changes can't be saved, ask instead of closing silently.
  const [unsaved, setUnsaved] = useState<string | null>(null);
  // A scheduled newsletter opened with Edit is off the schedule until it is scheduled again (final review).
  const offSchedule = state.newsletter?.status === 'draft' ? unscheduledFor(state.newsletter.id) : null;
  const [putBack, setPutBack] = useState<{ plannedAt: string | null; problem: string | null } | null>(null);
  const [puttingBack, setPuttingBack] = useState(false);
  /** True when the composer closed; false when it stays open (still closing, changes aren't saved, or it asks
   *  whether to put an edited scheduled newsletter back on the schedule). */
  const close = async ({ askPutBack = true }: { askPutBack?: boolean } = {}): Promise<boolean> => {
    if (closing) return false;
    setClosing(true);
    const outcome = await state.flush();
    setClosing(false);
    if (outcome.error) {
      setUnsaved(outcome.error);
      return false;
    }
    if (outcome.newsletter) onChanged?.();
    if (askPutBack && offSchedule && state.newsletter) {
      setPutBack({ plannedAt: draft.planned_send_at, problem: putBackProblem(draft.planned_send_at, draft.channels) });
      return false;
    }
    if (state.newsletter) clearUnscheduled(state.newsletter.id);
    onClose();
    return true;
  };
  const leaveAsDraft = (say = true) => {
    setPutBack(null);
    clearUnscheduled(state.newsletter?.id);
    if (say) toast.info('It\u2019s a draft now. Open it from Campaigns › Newsletters and press Schedule when you\u2019re ready.');
    onChanged?.();
    onClose();
  };
  const scheduleAgain = async () => {
    const id = state.newsletter?.id;
    if (!id || !putBack?.plannedAt) return;
    setPuttingBack(true);
    const res = await newslettersAPI.schedule(id, putBack.plannedAt);
    setPuttingBack(false);
    setPutBack(null);
    clearUnscheduled(id);
    if (res.ok && res.data) {
      toast.success(`Back on the schedule for ${formatSendTime(res.data.scheduled_at)}.`);
    } else {
      toast.error(`${res.error ?? GENERIC_ERROR} It stays a draft.`);
    }
    onChanged?.();
    onClose();
  };
  const discardAndClose = () => {
    setUnsaved(null);
    state.discard();
    clearUnscheduled(state.newsletter?.id);
    if (state.newsletter) onChanged?.();
    onClose();
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  // The browser's Back button works like Cancel (it asks first if the last changes aren't saved).
  useBackToClose(!hidden, () => closeRef.current());

  // aria-modal: Escape works like Cancel. Radix layers (popovers, dialogs) handle their own Escape first and
  // mark it handled (defaultPrevented); while one is open (even just mounting, before its own listener is
  // attached) Escape belongs to it.
  useEffect(() => {
    if (hidden) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      e.preventDefault();
      void closeRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [hidden]);

  // Save Draft: save, close, and show the draft at the top of Campaigns › Newsletters (wdy2xh2t3y). Autosaves only
  // change the small indicator in the top bar.
  const saveDraft = async () => {
    const result = await state.saveNow();
    if (!result.newsletter) {
      composerToast.error(result.error ?? GENERIC_ERROR);
      return;
    }
    const id = result.newsletter.id;
    onChanged?.();
    // An edited scheduled newsletter asks whether to put it back on the schedule first (close() keeps it open).
    if (!(await close())) return;
    toast.success(DRAFT_SAVED_MESSAGE);
    openNewsletterDraft(id);
  };

  const actionButtons = (sendLabel: string, extra = '') => (
    <>
      <button type="button" onClick={() => { void close(); }} disabled={closing} className={`${BUTTON_OUTLINE} ${extra}`}>Cancel</button>
      <button type="button" onClick={saveDraft} disabled={!enabled || readOnly || state.saveState === 'saving'} className={`${BUTTON_SECONDARY} ${extra}`}>Save Draft</button>
      <button type="button" onClick={startSend} disabled={!enabled || readOnly || starting} className={`${BUTTON_PRIMARY} ${extra}`}>
        {starting ? <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" aria-hidden="true" /> : <Globe className={`h-4 w-4 flex-shrink-0 ${extra ? 'hidden min-[400px]:block' : ''}`} aria-hidden="true" />}{sendLabel}
      </button>
    </>
  );

  return (
    // Focus stays inside while the composer shows (Radix popovers and dialogs inside pause this trap).
    <FocusScope
      asChild
      loop
      trapped={!hidden}
      // Don't jump to the first button (Back) with a focus ring: a new draft focuses its name field itself;
      // otherwise the layer itself takes focus.
      onMountAutoFocus={(e) => {
        e.preventDefault();
        if (!rootRef.current?.contains(document.activeElement)) rootRef.current?.focus({ preventScroll: true });
      }}
    >
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nl-composer-title"
      tabIndex={-1}
      className="fixed inset-0 flex flex-col bg-[#F8F8FA] outline-none"
      style={{ zIndex: LAYER.composer, display: hidden ? 'none' : undefined }}
    >
      <header ref={headerRef} className="flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-200 bg-white px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => { void close(); }} aria-label="Back" className="-ml-1.5 rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 id="nl-composer-title" className="truncate text-lg font-semibold text-gray-900">Create Campaign</h2>
        </div>
        <div className="order-3 flex w-full justify-center md:order-none md:w-auto md:flex-1">{switcher}</div>
        <div className="ml-auto flex items-center gap-3">
          <SaveIndicator state={state.saveState} reason={state.saveError} onRetry={state.canRetry ? state.retry : undefined} />
          {enabled ? <div className="hidden items-center gap-2 md:flex">{actionButtons(later ? 'Schedule' : 'Send Now')}</div> : null}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {planStuck ? (
          <div role="alert" className="mx-auto max-w-md px-4 py-16 text-center">
            <p className="text-base font-semibold text-gray-900">We couldn’t check your plan.</p>
            <p className="mt-1 text-sm text-gray-600">Newsletters need a paid plan, and we couldn’t confirm yours just now. Check your connection, then try again.</p>
            <button type="button" onClick={retryPlan} className={`${BUTTON_PRIMARY} mt-4`}>Try again</button>
          </div>
        ) : !known ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Getting things ready…
          </div>
        ) : isStarter ? (
          <UpgradeCard onSeePlans={() => { onClose(); requestUpgrade(PLAN_REQUIRED_ERROR); }} onMakeStoreel={onSwitchToStoreel} />
        ) : state.loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Opening your newsletter…
          </div>
        ) : state.loadError ? (
          <div className="mx-auto max-w-md px-4 py-16 text-center">
            <p className="text-base font-semibold text-gray-900">This newsletter couldn't be opened.</p>
            <p className="mt-1 text-sm text-gray-600">{state.loadError}</p>
            <button type="button" onClick={onClose} className={`${BUTTON_OUTLINE} mt-4`}>Close</button>
          </div>
        ) : (
          <div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-7">
            <div className="min-w-0 space-y-5">
              {readOnly && state.newsletter ? (
                <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  This newsletter is {STATUS_WORDS[state.newsletter.status] ?? state.newsletter.status}, so it can't be changed. To send something similar, duplicate it from Campaigns › Newsletters.
                </p>
              ) : null}

              {readOnly ? null : (
                <>
                {offSchedule ? (
                  <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{OFF_SCHEDULE_BANNER}</p>
                ) : null}
                <DraftNotices saveError={state.saveError} stale={state.stale} canRetry={state.canRetry} restoreOffer={state.restoreOffer}
                  onRetry={state.retry} onReload={() => { void state.reload(); }} onRestore={state.restore} onDismissRestore={state.dismissRestore} />
                </>
              )}

              <NameStep value={draft.name} onChange={(name) => update({ name })} fieldError={fieldError('name')} stepError={stepError('name')} readOnly={readOnly} inputRef={setNameInput} autoFocus={!newsletterId} />

              <AudiencePicker
                audience={draft.audience}
                channels={draft.channels}
                smsText={draft.sms_text}
                fromName={smsFromName}
                count={audienceCount}
                readOnly={readOnly}
                enabled={enabled}
                fieldErrors={{ ...state.fieldErrors, ...live }}
                stepError={stepError('recipients')}
                onChange={update}
              />

              <FromStep fromName={draft.from_name} replyTo={draft.reply_to_email} onChange={update}
                errors={{ from_name: fieldError('from_name'), reply_to_email: fieldError('reply_to_email') }} stepError={stepError('from')} readOnly={readOnly} />

              <SubjectStep subject={draft.subject} previewText={draft.preview_text} onChange={update}
                errors={{ subject: fieldError('subject'), preview_text: fieldError('preview_text') }} stepError={stepError('subject')} readOnly={readOnly} />

              <StepCard number={5} title="Content" id="nl-step-content" error={stepError('content')}>
                <TemplatePicker value={draft.template} readOnly={readOnly} />
              </StepCard>

              <ScheduleStep value={schedule} onChange={changeSchedule} stepError={stepError('schedule')} readOnly={readOnly} texts={draft.channels.includes('sms')} />

              <div className="flex flex-col gap-3 pb-[max(2rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between">
                {readOnly || !enabled ? <span /> : <SendTestButton channels={draft.channels} busy={testing} onSend={sendTest} />}
                <div className="flex items-center justify-end gap-2 sm:gap-3">
                  {actionButtons(later ? 'Schedule' : 'Send Now', ROW_BUTTON)}
                </div>
              </div>
            </div>

            <aside aria-label="Email preview" className="min-w-0 self-start lg:sticky lg:top-6 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overflow-x-hidden">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Email preview</p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setPreviewOpen(true)} className={LINK_BUTTON}>Preview exact email</button>
                  <DeviceToggle value={device} onChange={setDevice} />
                </div>
              </div>
              <NewsletterEditor
                draft={draft}
                readOnly={readOnly}
                device={device}
                profile={profile}
                businessAddress={brand.brand?.business_address ?? null}
                showProblems={attempted}
                fieldErrors={state.fieldErrors}
                onChange={update}
                onHeaderChange={(next) => update((d) => ({ header: typeof next === 'function' ? next(d.header) : next }))}
                onSaveAddress={saveAddress}
                savedBlocks={savedBlocks}
              />
            </aside>
          </div>
        )}
      </div>
      {hidden ? null : <ComposerToaster headerRef={headerRef} />}
      <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} load={loadPreview} />
      <SendConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        newsletterId={state.newsletter?.id ?? null}
        channels={draft.channels}
        counts={audienceCount.counts}
        countsLoading={audienceCount.loading}
        smsParts={smsParts}
        schedule={schedule}
        businessAddress={brand.brand?.business_address ?? null}
        onSaveAddress={saveAddress}
        onSent={onSent}
        onFailed={onSendFailed}
        onSeePlans={() => { void seePlans(); }}
      />
      <ComposerDialog
        open={putBack !== null}
        onOpenChange={(o) => { if (!o && !puttingBack) setPutBack(null); }}
        title={putBack && !putBack.problem ? 'Put it back on the schedule?' : 'It stays a draft'}
        description={putBack
          ? putBack.problem
            ? `${putBack.plannedAt ? `It can't go out ${formatSendTime(putBack.plannedAt)}: ` : ''}${putBack.problem} Open it from Campaigns › Newsletters and press Schedule when you're ready.`
            : `It was set to go out ${formatSendTime(putBack.plannedAt)}. Put it back for that time, or leave it as a draft.`
          : undefined}
        footer={putBack && !putBack.problem ? (
          <>
            <button type="button" onClick={() => leaveAsDraft()} disabled={puttingBack} className={BUTTON_OUTLINE}>Leave it as a draft</button>
            <button type="button" onClick={() => { void scheduleAgain(); }} disabled={puttingBack} className={BUTTON_PRIMARY}>
              {puttingBack ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}Put it back
            </button>
          </>
        ) : (
          <button type="button" onClick={() => leaveAsDraft(false)} className={BUTTON_PRIMARY}>OK</button>
        )}
      />
      <ComposerDialog
        open={unsaved !== null}
        onOpenChange={(o) => { if (!o) setUnsaved(null); }}
        title="Your latest changes aren't saved"
        description={unsaved ?? undefined}
        footer={(
          <>
            <button type="button" onClick={discardAndClose} className={BUTTON_OUTLINE}>Discard changes</button>
            <button type="button" onClick={() => setUnsaved(null)} className={BUTTON_PRIMARY}>Keep editing</button>
          </>
        )}
      />
    </div>
    </FocusScope>
  );
});

export default NewsletterComposer;
