import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { newslettersAPI, type ConsentType, type ContactListMember, type MemberInput } from '../../../services/newslettersAPI';
import ComposerDialog from '../../newsletters/ComposerDialog';
import CountrySelect from '../../CountrySelect';
import { GENERIC_ERROR } from '../../newsletters/lib/apiResult';
import { CONSENT_HINT, CONSENT_OPTIONS } from '../../newsletters/lib/consent';
import { memberFormProblems } from '../../newsletters/lib/lists';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, LABEL, inputClass } from '../../newsletters/lib/ui';
import { ErrorNote } from './ListDialogs';
import { MEMBER_DIAL_CODE, memberPhoneParts, memberPhoneProblem, memberPhoneValue } from './memberPhone';
import { splitTypedPhone } from '../../../utils/phoneUtils';

type Field = 'name' | 'email' | 'phone' | 'consent_type';
const CONSENT_REQUIRED = 'Choose how this person agreed to hear from you.';

/** Add one person to a list (with how they agreed), or edit someone's name, email or mobile number. The mobile has
 *  the country-code picker used elsewhere in Studio (+1 first) and is saved as E.164 (Chris, 29 Oct round 2). */
export default function MemberDialog({ open, onOpenChange, listId, listName, member, onSaved, onGone }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  listId: number;
  listName: string;
  /** Editing this person; adding someone new when null. */
  member: ContactListMember | null;
  onSaved(row: ContactListMember | undefined, mode: 'add' | 'edit'): void;
  /** 404: the list, or this person, is gone. */
  onGone(message: string): void;
}) {
  const editing = Boolean(member && member.id != null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  // The number box (national number) and its country code; what is saved is memberPhoneValue(code, number).
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState(MEMBER_DIAL_CODE);
  const [consent, setConsent] = useState<ConsentType | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const parts = memberPhoneParts(member?.phone);
    setName(member?.name ?? ''); setEmail(member?.email ?? ''); setPhone(parts.number); setPhoneCode(parts.countryCode);
    setConsent(null); setErrors({}); setError(null); setBusy(false);
  }, [open, member]);

  const save = async () => {
    setError(null);
    const phoneValue = memberPhoneValue(phoneCode, phone);
    const problems: Partial<Record<Field, string>> = memberFormProblems({ email, phone: phoneValue });
    const phoneProblem = memberPhoneProblem(phoneCode, phone);
    if (phoneProblem) problems.phone = phoneProblem;
    if (!editing && !consent) problems.consent_type = CONSENT_REQUIRED;
    setErrors(problems);
    if (Object.keys(problems).length) return;
    const clean = (v: string) => v.trim() || null;
    // Editing: only what changed (PATCH takes any of the three). Nothing changed: nothing to save.
    const patch: MemberInput = {};
    if (editing) {
      if (clean(name) !== (member!.name ?? null)) patch.name = clean(name);
      if (clean(email) !== (member!.email ?? null)) patch.email = clean(email);
      // Compared as saved (E.164), so opening and saving an unchanged number sends nothing.
      const was = memberPhoneParts(member!.phone);
      const before = memberPhoneValue(was.countryCode, was.number);
      if (phoneValue !== before) patch.phone = phoneValue || null;
      if (!Object.keys(patch).length) { onOpenChange(false); return; }
    }
    setBusy(true);
    const res = editing
      ? await newslettersAPI.updateMember(listId, member!.id!, patch)
      : await newslettersAPI.addMember(listId, {
        ...(clean(name) ? { name: clean(name) } : {}),
        ...(clean(email) ? { email: clean(email) } : {}),
        ...(phoneValue ? { phone: phoneValue } : {}),
        consent_type: consent!,
        consent_source: 'manual',
      });
    setBusy(false);
    if (res.ok) {
      onSaved(res.data, editing ? 'edit' : 'add');
      onOpenChange(false);
      return;
    }
    if (res.status === 404) { onOpenChange(false); onGone(res.error ?? 'That list was deleted somewhere else.'); return; }
    const fe = res.fieldErrors;
    const fieldProblems: Partial<Record<Field, string>> = {};
    (['name', 'email', 'phone', 'consent_type'] as Field[]).forEach((f) => { if (fe[f]) fieldProblems[f] = fe[f]; });
    setErrors(fieldProblems);
    // 409 "This person is already on this list." and anything not about one field.
    if (!Object.keys(fieldProblems).length) setError(res.error ?? GENERIC_ERROR);
  };

  const field = (id: Field, label: string, value: string, set: (v: string) => void, extra: { type?: string; placeholder?: string; autoComplete?: string; inputMode?: 'email' | 'tel' } = {}) => (
    <div>
      <label htmlFor={`lists-member-${id}`} className={LABEL}>{label}</label>
      <input id={`lists-member-${id}`} type={extra.type ?? 'text'} value={value} placeholder={extra.placeholder} autoComplete={extra.autoComplete} inputMode={extra.inputMode}
        aria-invalid={Boolean(errors[id])} aria-describedby={errors[id] ? `lists-member-${id}-error` : undefined}
        onChange={(e) => { set(e.target.value); if (errors[id]) setErrors((p) => ({ ...p, [id]: undefined })); }}
        className={inputClass(Boolean(errors[id]))} />
      {errors[id] ? <p id={`lists-member-${id}-error`} className="mt-1.5 text-xs text-red-600">{errors[id]}</p> : null}
    </div>
  );

  return (
    <ComposerDialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}
      title={editing ? 'Edit person' : 'Add a person'}
      description={editing ? `On “${listName}”.` : `Add someone to “${listName}”. An email address or a mobile number is needed.`}
      footer={(
        <>
          <button type="button" onClick={() => onOpenChange(false)} disabled={busy} className={BUTTON_OUTLINE}>Cancel</button>
          <button type="submit" form="lists-member-form" disabled={busy} className={BUTTON_PRIMARY}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{editing ? 'Save' : 'Add person'}
          </button>
        </>
      )}>
      <form id="lists-member-form" noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {field('name', 'Name', name, setName, { placeholder: 'e.g. Jane Doe', autoComplete: 'off' })}
        {field('email', 'Email', email, setEmail, { type: 'email', placeholder: 'name@example.com', autoComplete: 'off', inputMode: 'email' })}
        <div>
          <label htmlFor="lists-member-phone" className={LABEL}>Mobile</label>
          <div className="flex gap-2">
            <CountrySelect value={phoneCode} ariaLabel="Country code"
              onChange={(code) => { setPhoneCode(code); if (errors.phone) setErrors((p) => ({ ...p, phone: undefined })); }}
              className={`h-9 w-28 flex-shrink-0 rounded-lg border bg-white text-sm text-gray-900 outline-none transition-colors focus:border-[#6C60FF] focus:ring-2 focus:ring-[#6C60FF]/20 ${errors.phone ? 'border-red-400' : 'border-gray-200'}`} />
            <input id="lists-member-phone" type="tel" value={phone} placeholder="416 555 0100" autoComplete="off" inputMode="tel"
              aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'lists-member-phone-error' : undefined}
              onChange={(e) => {
                // A full number pasted with its code ("+44 7911…") moves the code to the picker.
                const next = splitTypedPhone(phoneCode, e.target.value);
                setPhoneCode(next.countryCode);
                setPhone(next.number);
                if (errors.phone) setErrors((p) => ({ ...p, phone: undefined }));
              }}
              className={`${inputClass(Boolean(errors.phone))} min-w-0 flex-1`} />
          </div>
          {errors.phone ? <p id="lists-member-phone-error" className="mt-1.5 text-xs text-red-600">{errors.phone}</p> : null}
        </div>
        {editing ? null : (
          <fieldset className="rounded-lg bg-gray-50 p-3" aria-describedby="lists-member-consent-hint">
            <legend className="float-left mb-2 w-full text-sm font-medium text-gray-900">How did this person agree to hear from you? <span className="font-normal text-gray-500">(Required)</span></legend>
            <div className="clear-both space-y-2">
              {CONSENT_OPTIONS.map((o) => (
                <label key={o.value} className="flex cursor-pointer items-start gap-2 text-sm text-gray-800">
                  <input type="radio" name="lists-member-consent" value={o.value} checked={consent === o.value}
                    onChange={() => { setConsent(o.value); setErrors((p) => ({ ...p, consent_type: undefined })); }}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#6C60FF]" />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
            <p id="lists-member-consent-hint" className="mt-2 text-xs text-gray-500">{CONSENT_HINT}</p>
            {errors.consent_type ? <p className="mt-1.5 text-xs text-red-600">{errors.consent_type}</p> : null}
          </fieldset>
        )}
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </form>
    </ComposerDialog>
  );
}
