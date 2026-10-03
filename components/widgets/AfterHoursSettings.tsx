// components/widgets/AfterHoursSettings.tsx
// The builder's "AI assistant" section (spec 2026-09-29 part 2 §2, amended 2026-10-03): the AI
// switch (it answers at any hour; a rep's reply takes over), business hours in the dealer's timezone
// (only used to tell visitors when the team is in) and the notes it answers from. Same inputs,
// SelectField, labels and help text as the rest of the builder.
import { useState } from 'react';
import { Switch } from '../ui/switch';
import type { WeekdayKey } from '../../services/widgetsAPI';
import { FieldError, SelectField, errorInputClass, inputClass } from './builderFields';
import { AI_NOTES_MAX, DAY_KEYS, DAY_NAMES, TIME_OPTIONS, browserTimeZone, timeLabel, timeZoneOptions } from './widgetHelpers';
import type { DayHours, WeekHours } from './widgetHelpers';
import { AiKnowledge } from './AiKnowledge';

export interface AfterHoursValue {
  hoursOn: boolean; // false = no hours set: the widget counts as always open (the AI answers either way)
  hours: WeekHours;
  timezone: string; // IANA name; '' until hours are first set
  aiEnabled: boolean;
  aiNotes: string;
}

export const AI_NOTES_NUDGE = 'Add a few notes so the AI can answer questions accurately.';

export function AfterHoursSettings({ value, onChange, errors, idPrefix, publicId, firstDomain }: {
  value: AfterHoursValue;
  onChange: (patch: Partial<AfterHoursValue>) => void;
  errors: Record<string, string>;
  idPrefix: string;
  // Widget AI knowledge (spec 2026-10-02 §5): null until the widget is first saved.
  publicId: string | null;
  firstDomain?: string;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  // Files/website feed the AI alongside notes; the nudge below should only fire when all three
  // are empty, so this tracks whether AiKnowledge has at least one ready source.
  const [hasKnowledgeContent, setHasKnowledgeContent] = useState(false);
  const setDay = (day: WeekdayKey, patch: Partial<DayHours>) =>
    onChange({ hours: { ...value.hours, [day]: { ...value.hours[day], ...patch } } });
  // The owner's own timezone when hours are first set.
  const toggleHours = (on: boolean) =>
    onChange(on && !value.timezone ? { hoursOn: true, timezone: browserTimeZone() } : { hoursOn: on });
  const zones = timeZoneOptions(value.timezone);

  return (
    <section data-section="after-hours" aria-labelledby={id('title')} className="space-y-5 border-t border-gray-100 pt-5">
      <div>
        <h3 id={id('title')} className="text-sm font-bold text-gray-900">AI assistant</h3>
        <p className="text-xs text-gray-400 mt-1">An AI assistant answers website chats right away. Your team can take over at any time by replying.</p>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-gray-800 mb-1.5">Business hours</legend>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={value.hoursOn}
            onChange={(e) => toggleHours(e.target.checked)}
            aria-describedby={id('hours-help')}
            className="w-4 h-4 accent-[#6C60FF]"
          />
          Set business hours
        </label>
        <p id={id('hours-help')} className="text-xs text-gray-400 mt-1">Used to tell visitors when your team is in.</p>
        {value.hoursOn && (
          <>
            <div className="mt-2 rounded-xl border border-gray-200 divide-y divide-gray-100">
              {DAY_KEYS.map((day) => {
                const d = value.hours[day];
                const name = DAY_NAMES[day];
                return (
                  <div key={day} className="grid grid-cols-[6.5rem_minmax(0,1fr)] sm:grid-cols-[6.5rem_4.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 items-center px-3 py-2">
                    <span className={`text-sm font-medium ${d.open ? 'text-gray-900' : 'text-gray-400'}`}>{name}</span>
                    <label className="inline-flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.open}
                        onChange={(e) => setDay(day, { open: e.target.checked })}
                        aria-label={`Open on ${name}`}
                        className="w-4 h-4 accent-[#6C60FF]"
                      />
                      Open
                    </label>
                    {d.open ? (
                      <div className="col-span-2 sm:col-span-1 flex items-center gap-2 min-w-0">
                        <SelectField
                          aria-label={`${name} opens`}
                          value={d.from}
                          onChange={(e) => setDay(day, { from: e.target.value })}
                          wrapperClassName="flex-1 min-w-0"
                          selectClassName="!py-1.5"
                        >
                          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}
                        </SelectField>
                        <span className="text-sm text-gray-500 shrink-0">to</span>
                        <SelectField
                          aria-label={`${name} closes`}
                          value={d.to}
                          onChange={(e) => setDay(day, { to: e.target.value })}
                          wrapperClassName="flex-1 min-w-0"
                          selectClassName="!py-1.5"
                        >
                          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}
                        </SelectField>
                      </div>
                    ) : (
                      <span className="col-span-2 sm:col-span-1 text-sm text-gray-400">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
            <FieldError id={id('hours-err')} message={errors.business_hours} />
            <div className="mt-3">
              <label htmlFor={id('tz')} className="block text-sm font-medium text-gray-800 mb-1.5">Timezone</label>
              <SelectField
                id={id('tz')}
                value={value.timezone}
                onChange={(e) => onChange({ timezone: e.target.value })}
                aria-describedby={id('tz-help')}
                wrapperClassName="sm:max-w-xs"
              >
                {!value.timezone && <option value="">Choose a timezone</option>}
                {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
              </SelectField>
              <p id={id('tz-help')} className="text-xs text-gray-400 mt-1">Your hours are in this timezone.</p>
              <FieldError id={id('tz-err')} message={errors.timezone} />
            </div>
          </>
        )}
      </fieldset>

      <div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor={id('ai')} className="text-sm font-medium text-gray-800">AI replies</label>
          <Switch
            id={id('ai')}
            checked={value.aiEnabled}
            onCheckedChange={(on) => onChange({ aiEnabled: on })}
            aria-describedby={id('ai-help')}
            className="h-6 w-11 [&>span]:size-5"
          />
        </div>
        <p id={id('ai-help')} className="text-xs text-gray-400 mt-1">
          The AI answers chat messages immediately, can send matching vehicles from your inventory, and tells visitors
          it's an AI. Each reply uses 1 AI credit. When someone on your team replies, they take over and the AI steps
          back for 12 hours.
        </p>
      </div>

      <div>
        <label htmlFor={id('notes')} className="block text-sm font-medium text-gray-800 mb-1.5">Notes for the AI</label>
        <textarea
          id={id('notes')}
          value={value.aiNotes}
          maxLength={AI_NOTES_MAX}
          rows={5}
          onChange={(e) => onChange({ aiNotes: e.target.value })}
          placeholder="Financing, trade-ins, your address and parking, holiday hours…"
          aria-invalid={!!errors.faq_notes}
          aria-describedby={errors.faq_notes ? id('notes-err') : id('notes-help')}
          className={inputClass + ' resize-y' + (errors.faq_notes ? errorInputClass : '')}
        />
        <div className="flex justify-between gap-3 mt-1">
          <p id={id('notes-help')} className="text-xs text-gray-400">The AI answers only from these notes, your inventory and the conversation.</p>
          <span className="text-xs text-gray-400 shrink-0">{value.aiNotes.length}/{AI_NOTES_MAX.toLocaleString('en-US')}</span>
        </div>
        {value.aiEnabled && value.aiNotes.trim() === '' && !hasKnowledgeContent && (
          <p className="text-xs text-amber-700 mt-1">{AI_NOTES_NUDGE}</p>
        )}
        <FieldError id={id('notes-err')} message={errors.faq_notes} />
      </div>

      <AiKnowledge
        idPrefix={id('knowledge')}
        publicId={publicId}
        firstDomain={firstDomain}
        onHasContentChange={setHasKnowledgeContent}
      />
    </section>
  );
}
