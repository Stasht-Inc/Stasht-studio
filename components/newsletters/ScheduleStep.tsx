import StepCard from './StepCard';
import { dateInputValue, maxScheduleDate, timeZoneName, type ScheduleChoice } from './lib/schedule';
import { LABEL, inputClass } from './lib/ui';

/** Step 6 (prototype s-later): Send now | Schedule for later, then Date and Time side by side (the user's time zone). */
export default function ScheduleStep({ value, onChange, stepError, readOnly }: {
  value: ScheduleChoice;
  onChange(value: ScheduleChoice): void;
  stepError?: string;
  readOnly: boolean;
}) {
  const later = value.mode === 'later';
  const date = value.mode === 'later' ? value.date : '';
  const time = value.mode === 'later' ? value.time : '';
  const card = (checked: boolean) =>
    `flex min-w-0 items-center gap-3 rounded-lg border-2 px-4 py-2.5 ${checked ? 'border-[#6C60FF] bg-[#6C60FF]/5' : 'border-gray-200 bg-white'} ${readOnly ? 'opacity-70' : 'cursor-pointer'}`;

  return (
    <StepCard number={6} title="Schedule" id="nl-step-schedule" error={stepError}>
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
              aria-describedby="nl-send-when-help"
              onChange={(e) => onChange({ mode: 'later', date: e.target.value, time })} className={`${inputClass()} min-w-0`} />
          </div>
          <div className="min-w-0">
            <label htmlFor="nl-send-time" className={LABEL}>Time</label>
            <input id="nl-send-time" type="time" value={time} disabled={readOnly}
              aria-describedby="nl-send-when-help"
              onChange={(e) => onChange({ mode: 'later', date, time: e.target.value })} className={`${inputClass()} min-w-0`} />
          </div>
          <p id="nl-send-when-help" className="col-span-2 text-xs text-gray-500">Times are in your time zone ({timeZoneName()}).</p>
        </div>
      ) : null}
    </StepCard>
  );
}
