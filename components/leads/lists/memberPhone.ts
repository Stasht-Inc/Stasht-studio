// Chris, 29 Oct (round 2), item 8: the Lists add / edit person Mobile field has the country-code picker the other
// Studio phone fields use (CountrySelect + utils/phoneUtils), starts on +1 like them, and saves E.164. The API
// decides which countries can get texts (its 422 is shown under the field). Pure, so `node --test` loads it.
import { collaboratorPhoneValue, isPlausibleSplitPhone, splitPrefillPhone, splitTypedPhone } from '../../../utils/phoneUtils.ts';

export const MEMBER_DIAL_CODE = '+1';
export const MEMBER_PHONE_INCOMPLETE = 'Enter the full number, including the area code.';

/** The picker and the number box for a stored number (E.164), or +1 and an empty box. */
export function memberPhoneParts(stored: string | null | undefined): { countryCode: string; number: string } {
  return stored && stored.trim() ? splitPrefillPhone(stored, MEMBER_DIAL_CODE) : { countryCode: MEMBER_DIAL_CODE, number: '' };
}

/** What is saved: the E.164 form ("+14165550100"), or '' when the box is empty. A pasted "+44…" uses its own code. */
export function memberPhoneValue(countryCode: string, national: string): string {
  return (national ?? '').trim() ? collaboratorPhoneValue(countryCode, national) : '';
}

/** Only what phoneUtils already calls incomplete (+1 needs 10 digits; other codes at least 7); other countries are
 *  left to the API. null when empty or fine. */
export function memberPhoneProblem(countryCode: string, national: string): string | null {
  if (!(national ?? '').replace(/\D/g, '')) return null;
  const split = splitTypedPhone(countryCode, national);
  return isPlausibleSplitPhone(split.countryCode, split.number) ? null : MEMBER_PHONE_INCOMPLETE;
}
