import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Globe, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { useIsStarterPlan } from '../../hooks/usePlan';
import { requestUpgrade } from '../../utils/planEvents';
import { useNewsletterBrand } from './hooks/useNewsletterBrand';
import { useNewsletterDraft } from './hooks/useNewsletterDraft';
import { useSenderProfile } from './hooks/useSenderProfile';
import { fieldProblems, type NewsletterDraft } from './lib/draft';
import { GENERIC_ERROR, PLAN_REQUIRED_ERROR } from './lib/apiResult';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_SECONDARY, LABEL, LAYER } from './lib/ui';
import StepCard from './StepCard';
import NewsletterEditor from './NewsletterEditor';
import DeviceToggle, { type PreviewDevice } from './DeviceToggle';
import TemplatePicker from './TemplatePicker';
import SaveIndicator from './SaveIndicator';
import UpgradeCard from './UpgradeCard';
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

// Phones: the three buttons share the row; from sm up they keep their natural width.
const ROW_BUTTON = 'min-w-0 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-5';

const NewsletterComposer = forwardRef<NewsletterComposerHandle, NewsletterComposerProps>(function NewsletterComposer(
  { newsletterId, switcher, hidden = false, onClose, onChanged, onSwitchToStoreel },
  ref,
) {
  const nameRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focusName: () => nameRef.current?.focus() }), []);

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
  const [closing, setClosing] = useState(false);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  // True after the first Send / Schedule attempt: from then on, unfinished steps and sections show their problems.
  const [attempted, setAttempted] = useState(false);
  void setAttempted; // set by the send checks (Task 12)
  const saveAddress = async (address: string): Promise<boolean> => {
    const res = await brand.saveAddress(address);
    if (!res.ok) toast.error(res.error ?? GENERIC_ERROR);
    return res.ok;
  };

  const live = fieldProblems(draft);
  const fieldError = (key: keyof NewsletterDraft): string | undefined => live[key] ?? state.fieldErrors[key];

  const close = async () => {
    if (closing) return;
    setClosing(true);
    const existing = await state.flush();
    setClosing(false);
    if (existing) onChanged?.();
    onClose();
  };

  const saveDraft = async () => {
    const result = await state.saveNow();
    if (result.newsletter) {
      toast.success('Draft saved.');
      onChanged?.();
    } else {
      toast.error(result.error ?? GENERIC_ERROR);
    }
  };

  const actionButtons = (sendLabel: string, extra = '') => (
    <>
      <button type="button" onClick={close} disabled={closing} className={`${BUTTON_OUTLINE} ${extra}`}>Cancel</button>
      <button type="button" onClick={saveDraft} disabled={!enabled || readOnly || state.saveState === 'saving'} className={`${BUTTON_SECONDARY} ${extra}`}>Save Draft</button>
      <button type="button" disabled className={`${BUTTON_PRIMARY} ${extra}`}><Globe className={`h-4 w-4 flex-shrink-0 ${extra ? 'hidden min-[400px]:block' : ''}`} aria-hidden="true" />{sendLabel}</button>
    </>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nl-composer-title"
      className="fixed inset-0 flex flex-col bg-[#F8F8FA]"
      style={{ zIndex: LAYER.composer, display: hidden ? 'none' : undefined }}
    >
      <header className="flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-200 bg-white px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={close} aria-label="Back" className="-ml-1.5 rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 id="nl-composer-title" className="truncate text-lg font-semibold text-gray-900">Create Campaign</h2>
        </div>
        <div className="order-3 flex w-full justify-center md:order-none md:w-auto md:flex-1">{switcher}</div>
        <div className="ml-auto flex items-center gap-3">
          <SaveIndicator state={state.saveState} />
          {enabled ? <div className="hidden items-center gap-2 md:flex">{actionButtons('Send now')}</div> : null}
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

              <NameStep value={draft.name} onChange={(name) => update({ name })} fieldError={fieldError('name')} readOnly={readOnly} inputRef={nameRef} autoFocus={!newsletterId} />

              {/* Step 2: AudiencePicker (Task 9) */}
              <StepCard number={2} title="Recipients" id="nl-step-recipients" aside="All leads">
                <p className={LABEL}>Send to</p>
                <p className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900">All leads, by email</p>
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  <User className="h-4 w-4 flex-shrink-0 text-gray-500" aria-hidden="true" />
                  <span>Estimated recipients</span>
                  <span className="ml-auto font-semibold text-gray-900">—</span>
                </div>
              </StepCard>

              <FromStep fromName={draft.from_name} replyTo={draft.reply_to_email} onChange={update}
                errors={{ from_name: fieldError('from_name'), reply_to_email: fieldError('reply_to_email') }} readOnly={readOnly} />

              <SubjectStep subject={draft.subject} previewText={draft.preview_text} onChange={update}
                errors={{ subject: fieldError('subject'), preview_text: fieldError('preview_text') }} readOnly={readOnly} />

              <StepCard number={5} title="Content" id="nl-step-content">
                <TemplatePicker value={draft.template} readOnly={readOnly} />
              </StepCard>

              {/* Step 6: ScheduleStep (Task 11) */}
              <StepCard number={6} title="Schedule" id="nl-step-schedule">
                <p className="text-sm text-gray-600">Send now.</p>
              </StepCard>

              <div className="flex items-center justify-end gap-2 pb-[max(2rem,env(safe-area-inset-bottom))] sm:gap-3">
                {actionButtons('Send Now', ROW_BUTTON)}
              </div>
            </div>

            <aside aria-label="Email preview" className="min-w-0 self-start lg:sticky lg:top-6 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overflow-x-hidden">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Email preview</p>
                <DeviceToggle value={device} onChange={setDevice} />
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
                onHeaderChange={(header) => update({ header })}
                onSaveAddress={saveAddress}
              />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
});

export default NewsletterComposer;
