import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Globe, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { useIsStarterPlan } from '../../hooks/usePlan';
import { requestUpgrade } from '../../utils/planEvents';
import { useNewsletterBrand } from './hooks/useNewsletterBrand';
import { useNewsletterDraft } from './hooks/useNewsletterDraft';
import { useSenderProfile } from './hooks/useSenderProfile';
import { fieldProblems, type NewsletterDraft } from './lib/draft';
import { GENERIC_ERROR, PLAN_REQUIRED_ERROR } from './lib/apiResult';
import { initialsFrom } from './lib/profile';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_SECONDARY, LABEL, LAYER } from './lib/ui';
import StepCard from './StepCard';
import InboxRow from './InboxRow';
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
  const { isStarter, known } = useIsStarterPlan();
  const enabled = known && !isStarter;
  const brand = useNewsletterBrand(enabled);
  const state = useNewsletterDraft(newsletterId, enabled, brand.brand?.header ?? null);
  const profile = useSenderProfile(enabled);
  const { draft, update, readOnly } = state;
  const [closing, setClosing] = useState(false);

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
        {!known ? (
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

              {/* Step 5: TemplatePicker (Task 8) */}
              <StepCard number={5} title="Content" id="nl-step-content">
                <p className="text-sm text-gray-600">Basic template. Edit the email in the preview.</p>
              </StepCard>

              {/* Step 6: ScheduleStep (Task 11) */}
              <StepCard number={6} title="Schedule" id="nl-step-schedule">
                <p className="text-sm text-gray-600">Send now.</p>
              </StepCard>

              <div className="flex items-center justify-end gap-2 pb-[max(2rem,env(safe-area-inset-bottom))] sm:gap-3">
                {actionButtons('Send Now', ROW_BUTTON)}
              </div>
            </div>

            <aside aria-label="Email preview" className="min-w-0 self-start lg:sticky lg:top-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Email preview</p>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <p className="border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Inbox</p>
                <InboxRow fromName={draft.from_name} subject={draft.subject} previewText={draft.preview_text}
                  initial={initialsFrom(profile?.name || draft.from_name).slice(0, 1)} photoUrl={profile?.photoUrl ?? null} color={profile?.color ?? null} />
                <div className="space-y-3 p-4" aria-hidden="true">
                  <div className="flex h-[70px] items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">Header image</div>
                  <div className="space-y-2">
                    <div className="h-2 w-3/4 rounded bg-gray-100" />
                    <div className="h-2 rounded bg-gray-100" />
                    <div className="h-2 w-5/6 rounded bg-gray-100" />
                  </div>
                  <div className="flex h-9 items-center justify-center rounded-lg bg-[#6C60FF] text-sm font-semibold text-white">Call to action</div>
                  <div className="space-y-2">
                    <div className="h-2 rounded bg-gray-100" />
                    <div className="h-2 w-4/5 rounded bg-gray-100" />
                  </div>
                  <p className="pt-2 text-center text-xs text-gray-500">Powered by <span className="font-semibold text-[#6C60FF]">Stasht</span></p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
});

export default NewsletterComposer;
