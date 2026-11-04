import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from 'react';
import CountrySelect from '../CountrySelect';
import { splitTypedPhone } from '../../utils/phoneUtils';
import { newslettersAPI, type AudienceCount, type AudienceItem, type LeadOption, type NewsletterChannel } from '../../services/newslettersAPI';
import { personDetail, personId, personName } from './lib/audience';
import { audienceFromFields, fieldsFromAudience, fieldsFromLead, personBoxProblems, personStatusProblems, type PersonFields as Fields } from './lib/person';
import { LABEL, inputClass } from './lib/ui';

const SEARCH_DELAY_MS = 300;
const MAX_SUGGESTIONS = 5;
type Box = 'email' | 'phone';

export interface PersonFieldsHandle { focus(): void }

export interface PersonFieldsProps {
  audience: AudienceItem[];
  channels: NewsletterChannel[];
  /** The live estimate: its `person` says when a typed address has unsubscribed. */
  counts: AudienceCount | null;
  readOnly: boolean;
  /** Only call the API on a paid plan with the Newsletter tab showing (contract note 1). */
  enabled: boolean;
  /** The API's 422 for the boxes (audience.N.email / audience.N.phone). */
  fieldErrors: Record<string, string>;
  /** Send was pressed with a problem here: show every box's problem now, not only after leaving the box. */
  showProblems: boolean;
  onChange(audience: AudienceItem[]): void;
  /** An older draft's picked lead, once read back (for the step's summary). */
  onLeadName?(name: string | null): void;
}

const apiError = (errors: Record<string, string>, field: 'email' | 'phone'): string | undefined =>
  Object.entries(errors).find(([key]) => new RegExp(`^audience\\.\\d+\\.${field}$`).test(key))?.[1];

/** The text a box searches your leads with: the email as typed, or the phone's digits. */
const searchText = (fields: Fields, box: Box): string => {
  if (box === 'email') return fields.email.trim().length >= 2 ? fields.email.trim() : '';
  const digits = fields.phone.replace(/\D/g, '');
  return digits.length >= 3 ? digits : '';
};

/**
 * "Single person" (Chris, 3 Nov 2026: "we need the email address here, or phone number if chosen. It has to be
 * simple."): the boxes follow Send by — Email address when Email is ticked, Phone number (country code + number, as
 * every Studio phone field) when Text message is ticked, both when both are. While typing, matching leads are
 * suggested (GET /newsletters/lead-options, name, email or phone); picking one fills the boxes. The audience is
 * [{type: 'person', email?, phone?}] (lib/person.ts); the API finds or creates their lead when it is sent.
 */
const PersonFields = forwardRef<PersonFieldsHandle, PersonFieldsProps>(function PersonFields(
  { audience, channels, counts, readOnly, enabled, fieldErrors, showProblems, onChange, onLeadName }, ref,
) {
  const showEmail = channels.includes('email');
  const showPhone = channels.includes('sms');
  const [fields, setFields] = useState<Fields>(() => fieldsFromAudience(audience));
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => (emailRef.current ?? phoneRef.current)?.focus() }), []);

  // What the boxes last sent up. Any other audience (a draft opened, a kept copy restored, Single person chosen again)
  // is shown in the boxes; a saved lead is filled in once it is read back.
  const audienceJson = JSON.stringify(audience);
  const emitted = useRef(audienceJson);
  useEffect(() => {
    if (audienceJson === emitted.current) return;
    emitted.current = audienceJson;
    if (personId(audience) === null) setFields(fieldsFromAudience(audience));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceJson]);

  const send = (next: Fields, on: NewsletterChannel[] = channels) => {
    const items = audienceFromFields(next, on);
    const json = JSON.stringify(items);
    emitted.current = json;
    if (json !== audienceJson) onChange(items);
  };
  const change = (next: Fields) => {
    setFields(next);
    send(next);
  };

  // Ticking or unticking Email / Text message: only the boxes showing are sent to (an older draft's lead stays).
  const channelsKey = channels.join(',');
  const lastChannels = useRef(channelsKey);
  useEffect(() => {
    if (lastChannels.current === channelsKey) return;
    lastChannels.current = channelsKey;
    if (!readOnly && personId(audience) === null) send(fields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelsKey]);

  // An older draft's picked lead ({type: 'lead', id}): its email and number fill the boxes.
  const leadId = personId(audience);
  const onLeadNameRef = useRef(onLeadName);
  onLeadNameRef.current = onLeadName;
  useEffect(() => {
    if (!leadId) { onLeadNameRef.current?.(null); return undefined; }
    if (!enabled) return undefined;
    let cancelled = false;
    void newslettersAPI.leadOptions({ lead_id: leadId }).then((res) => {
      if (cancelled) return;
      const lead = res.ok && res.data ? res.data.data.find((l) => l.id === leadId) : undefined;
      if (lead) setFields(fieldsFromLead(lead));
      onLeadNameRef.current?.(lead ? personName(lead) : null);
    });
    return () => { cancelled = true; };
  }, [leadId, enabled]);

  // Suggestions: your leads matching the box being typed in.
  const [active, setActive] = useState<Box | null>(null);
  const [typed, setTyped] = useState(false);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<LeadOption[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const wanted = active && typed ? searchText(fields, active) : '';
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(wanted), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [wanted]);
  const requestRef = useRef(0);
  useEffect(() => {
    const request = ++requestRef.current;
    if (!query || !enabled || readOnly) { setRows([]); return; }
    void newslettersAPI.leadOptions({ search: query }).then((res) => {
      if (request !== requestRef.current) return;
      setRows(res.ok && res.data ? res.data.data.slice(0, MAX_SUGGESTIONS) : []);
      setHighlight(-1);
    });
  }, [query, enabled, readOnly]);
  const open = Boolean(active && typed && wanted && rows.length);
  const close = () => { setTyped(false); setHighlight(-1); };

  const pick = (lead: LeadOption) => {
    change(fieldsFromLead(lead));
    close();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const down = e.key === 'ArrowDown';
      const n = rows.length;
      setHighlight((h) => (down ? (h + 1 >= n ? 0 : h + 1) : (h <= 0 ? n - 1 : h - 1)));
    } else if (e.key === 'Enter' && highlight >= 0 && rows[highlight]) {
      e.preventDefault();
      pick(rows[highlight]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  const [touched, setTouched] = useState<Record<Box, boolean>>({ email: false, phone: false });
  const box = personBoxProblems(fields, channels);
  const status = personStatusProblems(counts, channels);
  const errorFor = (b: Box): string | undefined => ((touched[b] || showProblems) ? box[b] : undefined) ?? apiError(fieldErrors, b) ?? status[b];
  const emailError = errorFor('email');
  const phoneError = errorFor('phone');

  const listId = (b: Box) => `nl-person-${b}-suggestions`;
  const optionId = (b: Box, i: number) => `nl-person-${b}-suggestion-${i}`;
  const comboProps = (b: Box) => ({
    role: 'combobox' as const,
    'aria-autocomplete': 'list' as const,
    'aria-expanded': open && active === b,
    'aria-controls': listId(b),
    'aria-activedescendant': open && active === b && highlight >= 0 ? optionId(b, highlight) : undefined,
    onKeyDown,
    onFocus: () => setActive(b),
    onBlur: () => {
      close();
      setActive((a) => (a === b ? null : a));
      if ((b === 'email' ? fields.email : fields.phone).trim()) setTouched((t) => ({ ...t, [b]: true }));
    },
  });
  const suggestions = (b: Box) => (open && active === b ? (
    <ul id={listId(b)} role="listbox" aria-label="Matching leads"
      className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
      {rows.map((l, i) => (
        <li key={l.id} id={optionId(b, i)} role="option" aria-selected={i === highlight}
          // Keeps the focus in the box, so the list doesn't close before the pick.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick(l)}
          onMouseEnter={() => setHighlight(i)}
          className={`cursor-pointer rounded-lg px-3 py-2 ${i === highlight ? 'bg-gray-50' : ''}`}>
          <span className="block truncate text-sm text-gray-900">{personName(l)}</span>
          {personDetail(l) ? <span className="block truncate text-xs text-gray-500">{personDetail(l)}</span> : null}
        </li>
      ))}
    </ul>
  ) : null);

  return (
    <div className="mt-3 space-y-3">
      {showEmail ? (
        <div>
          <label htmlFor="nl-person-email" className={LABEL}>Email address</label>
          <div className="relative">
            <input ref={emailRef} id="nl-person-email" type="email" inputMode="email" autoComplete="off" placeholder="name@example.com"
              value={fields.email} disabled={readOnly} {...comboProps('email')}
              aria-invalid={Boolean(emailError)} aria-describedby={emailError ? 'nl-person-email-error' : undefined}
              onChange={(e) => { setTyped(true); change({ ...fields, email: e.target.value }); }}
              className={inputClass(Boolean(emailError))} />
            {suggestions('email')}
          </div>
          {emailError ? <p id="nl-person-email-error" className="mt-1.5 text-xs text-red-600">{emailError}</p> : null}
        </div>
      ) : null}
      {showPhone ? (
        <div>
          <label htmlFor="nl-person-phone" className={LABEL}>Phone number</label>
          <div className="relative">
            <div className="flex gap-2">
              <CountrySelect value={fields.phoneCode} ariaLabel="Country code" disabled={readOnly}
                onChange={(code) => change({ ...fields, phoneCode: code })}
                className={`h-9 w-28 flex-shrink-0 rounded-lg border bg-white text-sm text-gray-900 outline-none transition-colors focus:border-[#6C60FF] focus:ring-2 focus:ring-[#6C60FF]/20 disabled:bg-gray-50 ${phoneError ? 'border-red-400' : 'border-gray-200'}`} />
              <input ref={phoneRef} id="nl-person-phone" type="tel" inputMode="tel" autoComplete="off" placeholder="416 555 0100"
                value={fields.phone} disabled={readOnly} {...comboProps('phone')}
                aria-invalid={Boolean(phoneError)} aria-describedby={phoneError ? 'nl-person-phone-error' : undefined}
                onChange={(e) => {
                  // A full number pasted with its code ("+44 7911…") moves the code to the picker.
                  const next = splitTypedPhone(fields.phoneCode, e.target.value);
                  setTyped(true);
                  change({ ...fields, phoneCode: next.countryCode, phone: next.number });
                }}
                className={`${inputClass(Boolean(phoneError))} min-w-0 flex-1`} />
            </div>
            {suggestions('phone')}
          </div>
          {phoneError ? <p id="nl-person-phone-error" className="mt-1.5 text-xs text-red-600">{phoneError}</p> : null}
        </div>
      ) : null}
      {!showEmail && !showPhone ? <p className="text-sm text-gray-500">Tick Email or Text message below to add their details.</p> : null}
    </div>
  );
});

export default PersonFields;
