import { useEffect, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Mail, MessageSquare, Plus, User } from 'lucide-react';
import type { AudienceItem, NewsletterChannel } from '../../services/newslettersAPI';
import StepCard from './StepCard';
import ImportListModal from './ImportListModal';
import ManageListsDialog from './ManageListsDialog';
import { withoutList } from './lib/manageLists';
import { moveFocusWithArrows } from './arrowKeys';
import { useAudienceSources } from './hooks/useAudienceSources';
import type { AudienceCountState } from './hooks/useAudienceCount';
import {
  audienceKey, audienceLabel, countSummary, formatCount, hasAudienceItem, skippedSummary, smsInfo, smsPreview, toggleAudienceItem, toggleChannel,
} from './lib/audience';
import { LIMITS } from './lib/rules';
import { smsPartsInfo } from './lib/smsParts';
import { LABEL, LAYER, LINK_BUTTON, inputClass, textareaClass } from './lib/ui';

type AudiencePatch = { audience?: AudienceItem[]; channels?: NewsletterChannel[]; sms_text?: string };

export interface AudiencePickerProps {
  audience: AudienceItem[];
  channels: NewsletterChannel[];
  smsText: string;
  /** The name put before the text (the From name, else the owner's name, as the API does). */
  fromName: string;
  count: AudienceCountState;
  readOnly: boolean;
  /** Load lead groups and lists (paid plan, Newsletter tab showing). */
  enabled: boolean;
  fieldErrors: Record<string, string>;
  stepError?: string;
  /** A patch, or a function of the latest draft (null: no change), so a later answer never undoes newer edits. */
  onChange(patch: AudiencePatch | ((latest: { audience: AudienceItem[] }) => AudiencePatch | null)): void;
}

const GROUP_HEADING = 'px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500';

/**
 * Step 2 (prototype: "Send to" + the grey "Estimated recipients" row): who gets it (All leads, lead groups,
 * lists), by email and/or text, with live counts.
 */
export default function AudiencePicker({ audience, channels, smsText, fromName, count, readOnly, enabled, fieldErrors, stepError, onChange }: AudiencePickerProps) {
  const sources = useAudienceSources(enabled);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const label = audienceLabel(audience, sources.groups, sources.lists);
  const sms = smsInfo(smsText);
  const skipped = skippedSummary(count.counts, channels);
  const parts = smsPartsInfo(fromName, smsText);
  // Screen readers hear the parts line only when the number of parts changes, not on every key.
  const [partsAnnouncement, setPartsAnnouncement] = useState('');
  const lastParts = useRef(parts.parts);
  useEffect(() => {
    if (lastParts.current === parts.parts) return;
    lastParts.current = parts.parts;
    setPartsAnnouncement(parts.tooLong ? (parts.problem ?? '') : `Uses ${parts.parts} text message ${parts.parts === 1 ? 'part' : 'parts'} per person.`);
  }, [parts.parts, parts.tooLong, parts.problem]);
  const smsError = fieldErrors.sms_text ?? (sms.over ? `Use ${LIMITS.sms_text} characters or fewer.` : undefined) ?? parts.problem ?? undefined;

  const option = (item: AudienceItem, title: string, detail: string) => (
    <label key={audienceKey(item)} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 focus-within:bg-gray-50 hover:bg-gray-50">
      <input type="checkbox" checked={hasAudienceItem(audience, item)} disabled={readOnly}
        onChange={() => onChange({ audience: toggleAudienceItem(audience, item) })}
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
    <StepCard number={2} title="Recipients" id="nl-step-recipients" aside={label} error={stepError}>
      <div className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p id="nl-send-to-label" className={LABEL}>Send to</p>
            {readOnly ? null : <button type="button" onClick={() => setManageOpen(true)} className={`${LINK_BUTTON} mb-1.5`}>Manage lists</button>}
          </div>
          <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
              <button type="button" disabled={readOnly} aria-labelledby="nl-send-to-label nl-send-to-value"
                className={`${inputClass(Boolean(fieldErrors.audience))} flex items-center justify-between gap-2 text-left`}>
                <span id="nl-send-to-value" className="truncate">{label}</span>
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-500" aria-hidden="true" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="start" sideOffset={6} collisionPadding={10}
                style={{ zIndex: LAYER.popover, width: 'var(--radix-popover-trigger-width)' }}
                onKeyDown={moveFocusWithArrows}
                aria-label="Send to"
                className="max-h-[min(360px,var(--radix-popover-content-available-height))] min-w-[260px] max-w-[calc(100vw-20px)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg outline-none">
                {option({ type: 'all_leads' }, 'All leads', 'Everyone in your Leads')}
                {sources.groups.length ? <p className={GROUP_HEADING}>Lead groups</p> : null}
                {sources.groups.map((g) => option({ type: 'lead_group', id: g.id }, g.name, `${formatCount(g.member_count)} people`))}
                <p className={GROUP_HEADING}>Your lists</p>
                {sources.lists.length === 0 ? <p className="px-3 py-2 text-sm text-gray-500">{sources.loading ? 'Loading…' : 'No lists yet.'}</p> : null}
                {sources.lists.map((l) => option({ type: 'list', id: l.id }, l.name, `${formatCount(l.member_count)} contacts`))}
                <div className="mt-1 border-t border-gray-100 pt-1">
                  <button type="button" disabled={readOnly} onClick={() => { setOpen(false); setImportOpen(true); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#6C60FF] hover:bg-[#6C60FF]/5 focus:bg-[#6C60FF]/5 focus:outline-none">
                    <Plus className="h-4 w-4" aria-hidden="true" />Add a list
                  </button>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          {fieldErrors.audience ? <p role="alert" className="mt-1.5 text-xs text-red-600">{fieldErrors.audience}</p> : null}

          <div className="mt-3 rounded-lg bg-gray-50 px-4 py-3" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-gray-700"><User className="h-4 w-4 flex-shrink-0 text-gray-500" aria-hidden="true" />Estimated recipients</span>
              <span className="whitespace-nowrap text-right font-semibold text-gray-900">{count.loading ? 'Counting…' : count.error ? '—' : countSummary(count.counts, channels)}</span>
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

        {channels.includes('sms') ? (
          <div>
            <label htmlFor="nl-sms-text" className={LABEL}>Text message</label>
            <textarea id="nl-sms-text" rows={2} value={smsText} disabled={readOnly} placeholder="October deals are here."
              aria-invalid={Boolean(smsError)} aria-describedby="nl-sms-help"
              onChange={(e) => onChange({ sms_text: e.target.value })} className={textareaClass(Boolean(smsError))} />
            <div id="nl-sms-help" className="mt-1.5 flex items-start justify-between gap-3 text-xs">
              <span className={smsError ? 'text-red-600' : 'text-gray-500'}>{smsError ?? 'We add a link to the newsletter and "Reply STOP to opt out."'}</span>
              <span aria-live="polite" className={`whitespace-nowrap ${sms.over ? 'text-red-600' : sms.remaining < 10 ? 'text-amber-600' : 'text-gray-500'}`}>{sms.length} / {LIMITS.sms_text}</span>
            </div>
            {parts.tooLong ? null : (
              <p className="mt-1.5 text-xs text-gray-600">Uses {parts.parts} text message {parts.parts === 1 ? 'part' : 'parts'} per person.</p>
            )}
            <span className="sr-only" aria-live="polite">{partsAnnouncement}</span>
            {parts.unicode ? (
              <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Emoji and some special characters make each part hold 70 characters instead of 160, so the text may use more parts.</p>
            ) : null}
            <p className="mt-2 break-words rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600"><span className="font-medium text-gray-700">People get: </span>{smsPreview(smsText)}</p>
          </div>
        ) : null}
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
          if (!hasAudienceItem(audience, item)) onChange({ audience: [...audience, item] });
        }}
      />
    </StepCard>
  );
}
