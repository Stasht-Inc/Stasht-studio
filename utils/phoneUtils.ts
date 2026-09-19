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
