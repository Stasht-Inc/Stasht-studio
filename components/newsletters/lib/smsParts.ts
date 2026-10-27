// [wdy2xh2p3f] SMS parts, as app/Services/Newsletter/NewsletterSms.php counts them (keep the two in step):
// GSM-7 = 160 characters in one part, 153 per part after (^{}\[~]|€ take two places); any other character makes the
// whole text UCS-2 = 70 UTF-16 units in one part, 67 per part (an emoji takes two). A two-place character or an
// emoji never splits across parts: it starts the next one. The API refuses more than 3 parts and the monthly text
// allowance counts parts.
import { smsPlain } from './rules.ts';

const GSM_BASIC = new Set([..."@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"]);
const GSM_EXTENDED = new Set([...'^{}\\[~]|€\f']);

export const MAX_SMS_PARTS = 3;
/** NewsletterRenderer::SMS_FROM_MAX: the business name before the text is cut to this many characters. */
export const SMS_FROM_MAX = 25;
/**
 * The web API's NEWSLETTER_PUBLIC_URL (texts link there). Studio's VITE_API_BASE_URL is not it (production calls the
 * API through studio.stasht.com's own /api/react), so the production value is the default; VITE_NEWSLETTER_PUBLIC_URL
 * overrides it if the API's public URL ever changes.
 */
const PUBLIC_BASE = (() => {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const value = env?.VITE_NEWSLETTER_PUBLIC_URL?.trim();
    return value ? value.replace(/\/+$/, '') : 'https://restapi.stasht.com';
  } catch {
    return 'https://restapi.stasht.com';
  }
})();
/** NewsletterSms::finalText's stand-in link: NEWSLETTER_PUBLIC_URL + /n/r/ + a 32-character token. */
export const SMS_LINK_STAND_IN = `${PUBLIC_BASE}/n/r/${'x'.repeat(32)}`;

export interface SmsSegments { encoding: 'GSM-7' | 'UCS-2'; segments: number; units: number }

export function smsSegments(text: string): SmsSegments {
  const chars = [...String(text ?? '')];
  let gsm = true;
  let sizes: number[] = [];
  for (const c of chars) {
    if (GSM_BASIC.has(c)) sizes.push(1);
    else if (GSM_EXTENDED.has(c)) sizes.push(2);
    else { gsm = false; break; }
  }
  if (!gsm) sizes = chars.map((c) => ((c.codePointAt(0) ?? 0) > 0xffff ? 2 : 1));
  const [single, multi] = gsm ? [160, 153] : [70, 67];
  const units = sizes.reduce((sum, n) => sum + n, 0);
  let segments = 0;
  if (units > 0 && units <= single) segments = 1;
  else if (units > single) {
    segments = 1;
    let used = 0;
    for (const size of sizes) {
      if (used + size > multi) { segments++; used = 0; }
      used += size;
    }
  }
  return { encoding: gsm ? 'GSM-7' : 'UCS-2', segments, units };
}

/** The text exactly as each person gets it (NewsletterRenderer::sms), with a stand-in link of the real length. */
export function finalSmsText(fromName: string, smsText: string): string {
  const from = [...smsPlain(fromName)].slice(0, SMS_FROM_MAX).join('').trimEnd();
  return `${from ? `${from}: ` : ''}${smsPlain(smsText)}\n${SMS_LINK_STAND_IN}\nReply STOP to opt out.`;
}

export interface SmsPartsInfo {
  parts: number;
  /** Emoji or a character outside GSM-7: every part holds 70 characters instead of 160. */
  unicode: boolean;
  tooLong: boolean;
  /** The API's own words when it is over the limit (NewsletterSendCheck::smsTooLong). */
  problem: string | null;
}

export function smsPartsInfo(fromName: string, smsText: string): SmsPartsInfo {
  const s = smsSegments(finalSmsText(fromName, smsText));
  const parts = Math.max(1, s.segments);
  const tooLong = parts > MAX_SMS_PARTS;
  return { parts, unicode: s.encoding === 'UCS-2', tooLong, problem: tooLong ? `This text is too long once sent (${parts} parts). Shorten it or remove emoji.` : null };
}
