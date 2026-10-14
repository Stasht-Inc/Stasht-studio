// Country codes the app supports (must match components/CountrySelect.tsx).
const SUPPORTED_DIAL_CODES = ['+91', '+44', '+86', '+61', '+33', '+49', '+81', '+1'];

/**
 * Split a phone string into a supported country code + national number, for
 * pre-filling the login/signup phone field from an invite link.
 *
 * Handles both forms the backend may send:
 *   "+14163028755"  → { countryCode: "+1",  number: "4163028755" }
 *   "14163028755"   → { countryCode: "+1",  number: "4163028755" }  (no leading +)
 *   "+919876543210" → { countryCode: "+91", number: "9876543210" }
 *
 * Matching the supported codes (rather than a greedy \d{1,3}) prevents a +1
 * number from being mis-split into "+141". When no supported code is recognised,
 * countryCode is null so the caller keeps its own default.
 */
export function parsePhonePrefill(raw: string): { countryCode: string | null; number: string } {
  const cleaned = (raw || '').trim().replace(/[\s()\-.]/g, '');
  if (!cleaned) return { countryCode: null, number: '' };

  // Normalise to a leading + so the same match works with or without one.
  const withPlus = cleaned.startsWith('+') ? cleaned : '+' + cleaned;

  const matched = SUPPORTED_DIAL_CODES.find(code => withPlus.startsWith(code));
  if (matched) {
    return { countryCode: matched, number: withPlus.slice(matched.length) };
  }

  // Unknown code but an explicit + was given — take a generic 1–3 digit code.
  if (cleaned.startsWith('+')) {
    const m = cleaned.match(/^(\+\d{1,3})(\d+)$/);
    if (m) return { countryCode: m[1], number: m[2] };
  }

  // No recognisable country code — keep the digits, let the caller use its default.
  return { countryCode: null, number: cleaned.replace(/^\+/, '') };
}

// Every supported code except +1 writes a leading trunk "0" in national format
// (UK 07911…, India 09876…, Germany 0151…) that is dropped after the country code.
const TRUNK_ZERO_DIAL_CODES = SUPPORTED_DIAL_CODES.filter(code => code !== '+1');

/**
 * Handle a full international number typed or pasted into the national-number
 * box of a split (country code + number) phone field. "+12892211807" with any
 * country selected becomes { countryCode: "+1", number: "2892211807" }, so the
 * code moves to the selector instead of being sent twice.
 *
 * Anything else is returned unchanged: a number without "+", a bare "+44" that
 * has no digits after the code yet (still being typed), or a code the selector
 * doesn't offer (kept in the box; toE164 then sends it as already international).
 */
export function splitTypedPhone(countryCode: string, typed: string): { countryCode: string; number: string } {
  if (!(typed || '').trim().startsWith('+')) return { countryCode, number: typed };
  const parsed = parsePhonePrefill(typed);
  if (parsed.countryCode && SUPPORTED_DIAL_CODES.includes(parsed.countryCode) && parsed.number) {
    return { countryCode: parsed.countryCode, number: parsed.number };
  }
  return { countryCode, number: typed };
}

/**
 * The E.164 form ("+" then digits only) of a split phone field, or '' when no
 * digits were entered. Spaces, dashes, dots and parentheses are dropped; a
 * national number that still starts with "+" is treated as already international.
 * A North American number typed with its leading 1 ("1 289 221 1807" with +1) and
 * a trunk "0" after any other supported code are removed so they aren't doubled.
 */
export function toE164(countryCode: string, national: string): string {
  const raw = (national || '').trim();
  if (raw.startsWith('+')) {
    const intl = raw.replace(/\D/g, '');
    return intl ? `+${intl}` : '';
  }
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (countryCode === '+1' && digits.length === 11 && digits[0] === '1') {
    digits = digits.slice(1);
  } else if (TRUNK_ZERO_DIAL_CODES.includes(countryCode) && digits.length > 1 && digits[0] === '0') {
    digits = digits.slice(1);
  }
  return `+${countryCode.replace(/\D/g, '')}${digits}`;
}

/**
 * Early, client-side plausibility for a split phone field (the server stays
 * authoritative). North America (+1) needs exactly 10 digits after the code;
 * other codes need at least 7, and the whole number fits E.164's 15 digits.
 */
export function isPlausibleSplitPhone(countryCode: string, national: string): boolean {
  const e164 = toE164(countryCode, national);
  if (!e164) return false;
  const total = e164.length - 1;
  if (total > 15) return false;
  if ((national || '').trim().startsWith('+')) return total >= 8;
  const nationalDigits = total - countryCode.replace(/\D/g, '').length;
  return countryCode === '+1' ? nationalDigits === 10 : nationalDigits >= 7;
}

/**
 * Pre-fill a split phone field from a stored number. Like parsePhonePrefill, but
 * always yields a code the selector offers: a stored number with a code it
 * doesn't offer ("+7…") stays whole in the number box, and one with no
 * recognisable code gets the default.
 */
export function splitPrefillPhone(raw: string, defaultCode = '+1'): { countryCode: string; number: string } {
  const parsed = parsePhonePrefill(raw);
  if (!parsed.countryCode) return { countryCode: defaultCode, number: parsed.number };
  if (SUPPORTED_DIAL_CODES.includes(parsed.countryCode)) return { countryCode: parsed.countryCode, number: parsed.number };
  return { countryCode: defaultCode, number: `${parsed.countryCode}${parsed.number}` };
}
