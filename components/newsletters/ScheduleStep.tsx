import { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import StepCard from './StepCard';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import ProductSelect, { fieldTrigger } from '../products/ProductSelect';
import { dateFromInput, dateInputValue, dateLabel, maxScheduleDate, textHoursNote, timeOptions, timeZoneName, type ScheduleChoice } from './lib/schedule';
import { LABEL, LAYER } from './lib/ui';

// Chris, 16 Nov: no browser date / clock popovers. Date = Studio's Popover + Calendar (Add a Moment's Date,
// components/AddMomentModal.tsx); Time = Studio's Select (components/products/ProductSelect.tsx, Campaigns' filters).
// Selected / today / hover are darker gray, never purple (globals.css .nl-schedule-calendar; the time list reuses the
// Leads filters' .leads-filter-menu gray).
const CALENDAR_GRAY = {
  day: 'inline-flex size-9 items-center justify-center rounded-md p-0 text-sm font-normal text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 aria-selected:opacity-100',
  day_selected: 'bg-gray-800 text-white hover:bg-gray-800 hover:text-white focus:bg-gray-800 focus:text-white',
  day_today: 'day-today border border-gray-400 font-medium',
  day_disabled: 'text-gray-300 opacity-60 hover:bg-transparent',
  dropdown: 'px-2 py-1 rounded border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 cursor-pointer hover:border-gray-400 transition-colors',
  cell: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
};

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
  const [dateOpen, setDateOpen] = useState(false);
  const today = dateFromInput(dateInputValue(new Date())) as Date;
  const maxDay = dateFromInput(maxScheduleDate()) as Date;
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
            <Popover open={dateOpen} onOpenChange={(o) => setDateOpen(o && !readOnly)}>
              <PopoverTrigger asChild>
                <button id="nl-send-date" type="button" disabled={readOnly}
                  aria-invalid={Boolean(errors.send_date)} aria-describedby={describedBy}
                  className={`flex w-full min-w-0 items-center gap-2 border px-3 text-left text-sm outline-none ${fieldTrigger(Boolean(errors.send_date))}`}>
                  <CalendarIcon className="h-4 w-4 flex-shrink-0 text-gray-500" aria-hidden="true" />
                  <span className={`truncate ${date ? '' : 'text-gray-400'}`}>{date ? dateLabel(date) : 'Pick a date'}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={5} style={{ zIndex: LAYER.popover }}
                className="nl-schedule-calendar w-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                <Calendar mode="single" selected={dateFromInput(date)} defaultMonth={dateFromInput(date) ?? today}
                  fromMonth={today} toMonth={maxDay} disabled={[{ before: today }, { after: maxDay }]}
                  classNames={CALENDAR_GRAY} initialFocus
                  onSelect={(d) => {
                    if (!d) return;
                    onChange({ mode: 'later', date: dateInputValue(d), time });
                    setDateOpen(false);
                  }} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="min-w-0">
            <label htmlFor="nl-send-time" className={LABEL}>Time</label>
            <ProductSelect id="nl-send-time" value={time} disabled={readOnly} placeholder="Pick a time"
              options={timeOptions(time)} onChange={(t) => onChange({ mode: 'later', date, time: t })}
              aria-invalid={Boolean(errors.send_time)} aria-describedby={describedBy}
              className={`min-w-0 ${fieldTrigger(Boolean(errors.send_time))}`} contentClassName="leads-filter-menu z-[100005] max-h-72" />
          </div>
          {whenError ? <p id="nl-send-when-error" role="alert" className="col-span-2 -mt-1 text-xs text-red-600">{whenError}</p> : null}
          <p id="nl-send-when-help" className="col-span-2 text-xs text-gray-500">Times are in your time zone ({timeZoneName()}).{texts ? ` ${textHoursNote()}` : ''}</p>
        </div>
      ) : null}
    </StepCard>
  );
}
