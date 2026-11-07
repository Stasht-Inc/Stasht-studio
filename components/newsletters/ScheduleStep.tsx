import StepCard from './StepCard';
import { dateInputValue, maxScheduleDate, textHoursNote, timeZoneName, type ScheduleChoice } from './lib/schedule';
import { LABEL, inputClass } from './lib/ui';

/** Step 6 (prototype s-later): Send now | Schedule for later, then Date and Time side by side (the user's time zone). */
export default function ScheduleStep({ value, onChange, stepError, readOnly, texts = false, errors = {} }: {
  value: ScheduleChoice;
  /** Texts are on: they only go out in the daytime (wdy2xh2p3f). */
  texts?: boolean;
  onChange(value: ScheduleChoice): void;
  stepError?: string;
  readOnly: boolean;
  /** Chris (7 Nov): a problem with the date or the time, marked on that field with the message under the two. */
  errors?: { send_date?: string; send_time?: string };
}) {
  const later = value.mode === 'later';
  const date = value.mode === 'later' ? value.date : '';
  const time = value.mode === 'later' ? value.time : '';
  const whenError = errors.send_date ?? errors.send_time;
  const describedBy = `${whenError ? 'nl-send-when-error ' : ''}nl-send-when-help`;
  const card = (checked: boolean) =>
    `flex min-w-0 items-center gap-3 rounded-lg border-2 px-4 py-2.5 ${checked ? 'border-[#6C60FF] bg-[#6C60FF]/5' : 'border-gray-200 bg-white'} ${readOnly ? 'opacity-70' : 'cursor-pointer'}`;

  return (
    <StepCard number={5} title="Schedule" id="nl-step-schedule" error={stepError}>
      <fieldset>
        <legend className="sr-only">When to send</legend>
        <div className="grid gap-3 min-[400px]:grid-cols-2">
          <label className={card(!later)}>
            <input type="radio" name="nl-when" checked={!later} disabled={readOnly} onChange={() => onChange({ mode: 'now' })} className="h-4 w-4 flex-shrink-0 accent-[#6C60FF]" />
            <span className="text-sm text-gray-900">Send now</span>
          </label>
          <label className={card(later)}>
            <input type="radio" name="nl-when" checked={later} disabled={readOnly} onChange={() => onChange({ mode: 'later', date, time })} className="h-4 w-4 flex-shrink-0 accent-[#6C60FF]" />
            <span className="text-sm text-gray-900">Schedule for later</span>
          </label>
        </div>
      </fieldset>
      {later ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
          <div className="min-w-0">
            <label htmlFor="nl-send-date" className={LABEL}>Date</label>
            <input id="nl-send-date" type="date" value={date} min={dateInputValue(new Date())} max={maxScheduleDate()} disabled={readOnly}
              aria-invalid={Boolean(errors.send_date)} aria-describedby={describedBy}
              onChange={(e) => onChange({ mode: 'later', date: e.target.value, time })} className={`${inputClass(Boolean(errors.send_date))} min-w-0`} />
          </div>
          <div className="min-w-0">
            <label htmlFor="nl-send-time" className={LABEL}>Time</label>
            <input id="nl-send-time" type="time" value={time} disabled={readOnly}
              aria-invalid={Boolean(errors.send_time)} aria-describedby={describedBy}
              onChange={(e) => onChange({ mode: 'later', date, time: e.target.value })} className={`${inputClass(Boolean(errors.send_time))} min-w-0`} />
          </div>
          {whenError ? <p id="nl-send-when-error" role="alert" className="col-span-2 -mt-1 text-xs text-red-600">{whenError}</p> : null}
          <p id="nl-send-when-help" className="col-span-2 text-xs text-gray-500">Times are in your time zone ({timeZoneName()}).{texts ? ` ${textHoursNote()}` : ''}</p>
        </div>
      ) : null}
    </StepCard>
  );
}
