// components/newsletters/lib/phoneDisplay.ts
// How a test's "sent to" address reads in a toast. The API returns phones in E.164 ("+14165550100").
import { parsePhonePrefill } from '../../../utils/phoneUtils.ts';

/**
 * North American numbers read as "+1 416 555 0100"; other codes the app supports get a space after
 * the code ("+44 7911123456"). Emails, unknown codes and anything that is not a clean number stay as is.
 */
export function formatSentTo(value: string): string {
  const raw = (value ?? '').trim();
  if (!raw.startsWith('+') || raw.includes('@')) return raw;
  const digits = raw.replace(/[\s()\-.]/g, '');
  if (!/^\+\d{8,15}$/.test(digits)) return raw;
  const { countryCode, number } = parsePhonePrefill(digits);
  if (countryCode === '+1') {
    return number.length === 10 ? `+1 ${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6)}` : raw;
  }
  // parsePhonePrefill's generic fallback guesses a 1-3 digit code; only split codes it knows.
  if (countryCode && ['+91', '+44', '+86', '+61', '+33', '+49', '+81'].includes(countryCode)) return `${countryCode} ${number}`;
  return digits;
}
