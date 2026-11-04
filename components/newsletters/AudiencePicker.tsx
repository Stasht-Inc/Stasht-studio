import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Loader2, Mail, MessageSquare, Plus, User } from 'lucide-react';
import type { AudienceItem, NewsletterBlock, NewsletterChannel } from '../../services/newslettersAPI';
import StepCard from './StepCard';
import ImportListModal from './ImportListModal';
import ManageListsDialog from './ManageListsDialog';
import PersonFields, { type PersonFieldsHandle } from './PersonFields';
import { withoutList } from './lib/manageLists';
import { moveFocusWithArrows } from './arrowKeys';
import { useAudienceSources } from './hooks/useAudienceSources';
import { useAutoGrow } from './hooks/useAutoGrow';
import type { AudienceCountState } from './hooks/useAudienceCount';
import {
  SINGLE_PERSON, audienceKey, audienceLabel, countSummary, formatCount, hasAudienceItem, isSinglePerson, personId, skippedSummary, smsInfo,
  smsPreview, toggleChannel, toggleGroupItem,
} from './lib/audience';
import { personCountSummary, personEntryProblem, personStatusProblems, personSummary } from './lib/person';
import { smsPartsInfo, smsPartsLabel, type SmsPartsInfo } from './lib/smsParts';
import { MESSAGE_TOO_LONG } from './lib/draft';
import { syncMessageBlock } from './lib/messageBlock';
import { canSetDefaultMessage, isDefaultMessage } from './lib/defaultMessage';
import { LABEL, LAYER, LINK_BUTTON, inputClass, textareaClass } from './lib/ui';

type AudiencePatch = { audience?: AudienceItem[]; channels?: NewsletterChannel[]; sms_text?: string; blocks?: NewsletterBlock[] };

export interface AudiencePickerProps {
  audience: AudienceItem[];
  channels: NewsletterChannel[];
  smsText: string;
  /** The name put before the text (the From name, else the owner's name, as the API does). */
  fromName: string;
  count: AudienceCountState<unknown>;
  readOnly: boolean;
  /** Load lead groups and lists (paid plan, Newsletter tab showing). */
  enabled: boolean;
  fieldErrors: Record<string, string>;
  stepError?: string;
  /** A patch, or a function of the latest draft (null: no change), so a later answer never undoes newer edits. */
  onChange(patch: AudiencePatch | ((latest: { audience: AudienceItem[]; blocks: NewsletterBlock[] }) => AudiencePatch | null)): void;
  /** The account's saved default message (null: none; undefined: not loaded yet, so the box can't be ticked yet). */
  defaultMessage?: string | null;
  /** Save (text) or clear (null) the default message; resolves false when it wasn't saved (the composer says why). */
  onDefaultMessageChange?(message: string | null): Promise<boolean>;
  /** The card's number, title and DOM id (newsletters: 2 Recipients, nl-step-recipients). */
  step?: { number: number; title: string; id: string };
  /** Every DOM id inside starts with this (newsletters: nl). The Storeel flow's Send step uses its own. */
  idPrefix?: string;
  /** Paid-plan sources: the account's lists (Add a list, Manage lists) and lead suggestions for Single person. Off on
   *  the free plan in the Storeel flow, which is on every plan (those endpoints are paid-only). */
  paid?: boolean;
  /** The Storeel flow's Message box: its words, its own text-parts count and what text recipients get. Without it,
   *  the newsletter's (the message also becomes the email's Message section). */
  message?: {
    required: boolean;
    hint: string;
    placeholder: string;
    /** Under the box when Text message is ticked. */
    smsHelp: string;
    parts: SmsPartsInfo;
    preview: string;
  };
  /** At the end of the card (the Storeel flow's Send now row). */
  children?: ReactNode;
  /** The card's first line (the Storeel flow: "Your campaign is saved. Send it now, or do it later."). */
  intro?: ReactNode;
}

const GROUP_HEADING = 'px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500';

/**
 * Step 2 (prototype: "Send to" + the grey "Estimated recipients" row): who gets it (a single person — first and the
 * default, Chris 3 Nov — or All leads, lead groups, lists), by email and/or text, with live counts.
 */
export default function AudiencePicker({
  audience, channels, smsText, fromName, count, readOnly, enabled, fieldErrors, stepError, onChange, defaultMessage, onDefaultMessageChange,
  step = { number: 2, title: 'Recipients', id: 'nl-step-recipients' }, idPrefix = 'nl', paid = true, message, children, intro,
}: AudiencePickerProps) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const sources = useAudienceSources(enabled, paid);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  // Single person or lists (Chris, 3 Nov): one or the other. choosingLists keeps the lists view while nothing is ticked.
  const [choosingLists, setChoosingLists] = useState(false);
  const single = isSinglePerson(audience, choosingLists);
  const leadId = personId(audience);
  const [personLabel, setPersonLabel] = useState<string | null>(null);
  const label = single ? SINGLE_PERSON : audienceLabel(audience, sources.groups, sources.lists);
  const summary = single ? (personSummary(audience) ?? (leadId && personLabel ? personLabel : SINGLE_PERSON)) : label;
  const personRef = useRef<PersonFieldsHandle>(null);
  // After choosing Single person, focus goes to the person's first box instead of back to Send to.
  const focusPersonRef = useRef(false);
  const chooseSingle = () => {
    if (!single) {
      setChoosingLists(false);
      onChange({ audience: [] });
      focusPersonRef.current = true;
    }
    setOpen(false);
  };
  const toggleGroup = (item: AudienceItem) => {
    setChoosingLists(true);
    onChange({ audience: toggleGroupItem(audience, item) });
  };
  const sms = smsInfo(smsText);
  // A typed person who unsubscribed is said under their box (PersonFields), not again in the line under the estimate.
  const personSaysUnsubscribed = single && Object.keys(personStatusProblems(count.counts, channels)).length > 0;
  const skipped = skippedSummary(personSaysUnsubscribed && count.counts ? { ...count.counts, skipped: { ...count.counts.skipped, unsubscribed: 0 } } : count.counts, channels);
  // A Single person box's problem shows under that box (PersonFields), not again under Send to: the live check of a box
  // still being typed, and the API's audience.N.email / audience.N.phone (whose message apiResult also files as `audience`).
  const boxErrors = Object.entries(fieldErrors).filter(([key]) => /^audience\.\d+\.(email|phone)$/.test(key)).map(([, message]) => message);
  const audienceError = fieldErrors.audience && !(single && (fieldErrors.audience === personEntryProblem(audience) || boxErrors.some((m) => fieldErrors.audience.includes(m))))
    ? fieldErrors.audience : undefined;
  const parts = message?.parts ?? smsPartsInfo(fromName, smsText);
  // Screen readers hear the parts line only when the number of parts changes, not on every key.
  const [partsAnnouncement, setPartsAnnouncement] = useState('');
  const lastParts = useRef(parts.parts);
  useEffect(() => {
    if (lastParts.current === parts.parts) return;
    lastParts.current = parts.parts;
    setPartsAnnouncement(parts.tooLong ? (parts.problem ?? '') : smsPartsLabel(parts.parts));
  }, [parts.parts, parts.tooLong, parts.problem]);
  // The Message box (Chris, 31 Oct): always shown. Its text goes at the top of the email as the Message section,
  // updated in the same draft update as sms_text so autosave sends both together; it is the text too when Text
  // message is ticked.
  const texts = channels.includes('sms');
  // Grows with the text: 2 lines up to 10, then it scrolls (review, 3 Nov).
  const messageRef = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(messageRef, smsText, 2, 10);
  const changeMessage = (value: string) => (message ? onChange({ sms_text: value }) : onChange((latest) => {
    const blocks = syncMessageBlock(latest.blocks, value);
    return blocks === latest.blocks ? { sms_text: value } : { sms_text: value, blocks };
  }));
  // No 120 limit any more (Chris, 3 Nov): up to LIMITS.sms_text; as a text it goes out as one long text, refused
  // only over what Twilio takes (smsParts.ts).
  const smsError = fieldErrors.sms_text ?? (sms.over ? MESSAGE_TOO_LONG : undefined) ?? (texts ? parts.problem : null) ?? undefined;
  // "Set as my default message" (Chris, 1 Nov; as the Storeel invite message has): ticked while the box shows the
  // account's saved default, which pre-fills every new newsletter. Ticking saves this text; unticking clears it.
  // While a save is on its way the box shows what was asked for (savingDefault: the text, or null to clear).
  const [savingDefault, setSavingDefault] = useState<string | null | undefined>(undefined);
  const saving = savingDefault !== undefined;
  const isDefault = saving ? savingDefault !== null && isDefaultMessage(savingDefault, smsText) : isDefaultMessage(defaultMessage, smsText);
  const canTickDefault = !readOnly && !saving && defaultMessage !== undefined && Boolean(onDefaultMessageChange)
    && (isDefault || canSetDefaultMessage(smsText));
  const toggleDefault = async (checked: boolean) => {
    if (!onDefaultMessageChange) return;
    const wanted = checked ? smsText.trim() : null;
    setSavingDefault(wanted);
    try {
      await onDefaultMessageChange(wanted);
    } finally {
      setSavingDefault(undefined);
    }
  };

  const option = (item: AudienceItem, title: string, detail: string) => (
    <label key={audienceKey(item)} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 focus-within:bg-gray-50 hover:bg-gray-50">
      <input type="checkbox" checked={hasAudienceItem(audience, item)} disabled={readOnly}
        onChange={() => toggleGroup(item)}
        className="h-4 w-4 flex-shrink-0 accent-[#6C60FF]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500">{detail}</span>
      </span>
    </label>
  );

  const channelBox = (channel: NewsletterChannel, title: string, Icon: typeof Mail) => {
    const checked = channels.includes(channel);
    return (
      <label key={channel} className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg border-2 px-4 py-2.5 ${checked ? 'border-[#6C60FF] bg-[#6C60FF]/5' : 'border-gray-200 bg-white'} ${readOnly ? 'opacity-70' : 'cursor-pointer'}`}>
        <input type="checkbox" checked={checked} disabled={readOnly} onChange={() => onChange({ channels: toggleChannel(channels, channel) })} className="h-4 w-4 flex-shrink-0 accent-[#6C60FF]" />
        <Icon className="h-4 w-4 flex-shrink-0 text-gray-600" aria-hidden="true" />
        <span className="truncate text-sm text-gray-900">{title}</span>
      </label>
    );
  };

  return (
    <StepCard number={step.number} title={step.title} id={step.id} aside={summary} error={stepError}>
      <div className="space-y-4">
        {intro}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p id={id('send-to-label')} className={LABEL}>Send to</p>
            {readOnly || !paid ? null : <button type="button" onClick={() => setManageOpen(true)} className={`${LINK_BUTTON} mb-1.5`}>Manage lists</button>}
          </div>
          <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
              <button type="button" disabled={readOnly} aria-labelledby={`${id('send-to-label')} ${id('send-to-value')}`}
                className={`${inputClass(Boolean(audienceError))} flex items-center justify-between gap-2 text-left`}>
                <span id={id('send-to-value')} className="truncate">{label}</span>
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-500" aria-hidden="true" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="start" sideOffset={6} collisionPadding={10}
                style={{ zIndex: LAYER.popover, width: 'var(--radix-popover-trigger-width)' }}
                onKeyDown={moveFocusWithArrows}
                onCloseAutoFocus={(e) => {
                  if (!focusPersonRef.current) return;
                  focusPersonRef.current = false;
                  e.preventDefault();
                  personRef.current?.focus();
                }}
                aria-label="Send to"
                className="max-h-[min(360px,var(--radix-popover-content-available-height))] min-w-[260px] max-w-[calc(100vw-20px)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg outline-none">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 focus-within:bg-gray-50 hover:bg-gray-50">
                  <input type="checkbox" checked={single} disabled={readOnly} onChange={chooseSingle}
                    className="h-4 w-4 flex-shrink-0 accent-[#6C60FF]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-gray-900">{SINGLE_PERSON}</span>
                    <span className="block text-xs text-gray-500">Type their email or phone number</span>
                  </span>
                </label>
                {option({ type: 'all_leads' }, 'All leads', 'Everyone in your Leads')}
                {sources.groups.length ? <p className={GROUP_HEADING}>Lead groups</p> : null}
                {sources.groups.map((g) => option({ type: 'lead_group', id: g.id }, g.name, `${formatCount(g.member_count)} people`))}
                {paid ? (
                  <>
                    <p className={GROUP_HEADING}>Your lists</p>
                    {sources.lists.length === 0 ? <p className="px-3 py-2 text-sm text-gray-500">{sources.loading ? 'Loading…' : 'No lists yet.'}</p> : null}
                    {sources.lists.map((l) => option({ type: 'list', id: l.id }, l.name, `${formatCount(l.member_count)} contacts`))}
                    <div className="mt-1 border-t border-gray-100 pt-1">
                      <button type="button" disabled={readOnly} onClick={() => { setOpen(false); setImportOpen(true); }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#6C60FF] hover:bg-[#6C60FF]/5 focus:bg-[#6C60FF]/5 focus:outline-none">
                        <Plus className="h-4 w-4" aria-hidden="true" />Add a list
                      </button>
                    </div>
                  </>
                ) : null}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          {audienceError ? <p role="alert" className="mt-1.5 text-xs text-red-600">{audienceError}</p> : null}

          {single ? (
            <PersonFields ref={personRef} idPrefix={idPrefix} audience={audience} channels={channels} counts={count.counts} readOnly={readOnly} enabled={enabled && paid}
              fieldErrors={fieldErrors} showProblems={Boolean(stepError)} onChange={(next) => onChange({ audience: next })} onLeadName={setPersonLabel} />
          ) : null}

          <div className="mt-3 rounded-lg bg-gray-50 px-4 py-3" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-gray-700"><User className="h-4 w-4 flex-shrink-0 text-gray-500" aria-hidden="true" />Estimated recipients</span>
              <span className="whitespace-nowrap text-right font-semibold text-gray-900">{count.loading ? 'Counting…' : count.error ? '—' : single ? personCountSummary(count.counts, channels) : countSummary(count.counts, channels)}</span>
            </div>
            {count.error ? <p className="mt-1 text-xs text-gray-500">{count.error}</p> : skipped ? <p className="mt-1 text-xs text-gray-500">{skipped}</p> : null}
          </div>
        </div>

        <fieldset>
          <legend className={LABEL}>Send by</legend>
          <div className="flex flex-col gap-3 sm:flex-row">
            {channelBox('email', 'Email', Mail)}
            {channelBox('sms', 'Text message (SMS)', MessageSquare)}
          </div>
          {fieldErrors.channels ? <p role="alert" className="mt-1.5 text-xs text-red-600">{fieldErrors.channels}</p> : null}
        </fieldset>

        <div>
          <label htmlFor={id('sms-text')} className={LABEL}>Message{message?.required ? null : <span className="font-normal text-gray-500"> (optional)</span>}</label>
          <p id={id('message-hint')} className="-mt-0.5 mb-1.5 text-xs text-gray-500">{message ? message.hint : "A short note at the top of your email, above your sections. If Text message is ticked, it's also sent as the text."}</p>
          <textarea ref={messageRef} id={id('sms-text')} rows={2} value={smsText} disabled={readOnly} placeholder={message ? message.placeholder : 'October deals are here.'}
            aria-invalid={Boolean(smsError)} aria-describedby={`${id('message-hint')} ${id('sms-help')}`}
            onChange={(e) => changeMessage(e.target.value)} className={textareaClass(Boolean(smsError))} />
          <div id={id('sms-help')} className="mt-1.5 flex items-start justify-between gap-3 text-xs">
            <span className={smsError ? 'text-red-600' : 'text-gray-500'}>{smsError ?? (texts ? (message ? message.smsHelp : 'We add a link to the newsletter and "Reply STOP to opt out."') : null)}</span>
            <span aria-live="polite" className={`whitespace-nowrap ${sms.over ? 'text-red-600' : 'text-gray-500'}`}>{formatCount(sms.length)} {sms.length === 1 ? 'character' : 'characters'}</span>
          </div>
          {onDefaultMessageChange ? (
            <label className={`mt-2 inline-flex items-center gap-2 select-none ${canTickDefault ? 'cursor-pointer' : saving ? 'cursor-wait' : 'cursor-default opacity-60'}`}>
              <input type="checkbox" checked={isDefault} disabled={!canTickDefault} onChange={(e) => { void toggleDefault(e.target.checked); }}
                className="h-4 w-4 flex-shrink-0 accent-[#6C60FF]" />
              <span className="text-sm text-gray-700">Set as my default message</span>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" aria-label="Saving" /> : null}
            </label>
          ) : null}
          {texts ? (
            <>
              {parts.tooLong ? null : (
                <p className="mt-1.5 text-xs text-gray-600">{smsPartsLabel(parts.parts)}</p>
              )}
              <span className="sr-only" aria-live="polite">{partsAnnouncement}</span>
              {parts.unicode ? (
                <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Emoji and some special characters make each part hold 70 characters instead of 160, so the text may use more parts.</p>
              ) : null}
              <p className="mt-2 break-words rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600"><span className="font-medium text-gray-700">People get: </span>{message ? message.preview : smsPreview(smsText)}</p>
            </>
          ) : null}
        </div>
        {children}
      </div>
      <ManageListsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        onChanged={() => { void sources.reload(); }}
        onDeleted={(id) => onChange((latest) => {
          const next = withoutList(latest.audience, id);
          return next === latest.audience ? null : { audience: next };
        })}
      />
      <ImportListModal
        open={importOpen}
        onOpenChange={setImportOpen}
        groups={sources.groups}
        onCreated={(list) => {
          void sources.reload();
          const item: AudienceItem = { type: 'list', id: list.id };
          // A new list is sent to: that leaves Single person.
          if (!hasAudienceItem(audience, item)) toggleGroup(item);
        }}
      />
    </StepCard>
  );
}
