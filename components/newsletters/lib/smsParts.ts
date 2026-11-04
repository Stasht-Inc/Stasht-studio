// [wdy2xh2p3f] SMS parts, as app/Services/Newsletter/NewsletterSms.php counts them (keep the two in step):
// GSM-7 = 160 characters in one part, 153 per part after (^{}\[~]|€ take two places); any other character makes the
// whole text UCS-2 = 70 UTF-16 units in one part, 67 per part (an emoji takes two). A two-place character or an
// emoji never splits across parts: it starts the next one. The monthly text allowance counts parts.
// Chris, 3 Nov 2026: a long message goes out as one long text, of at most MAX_SMS_PARTS parts (the API's
// newsletters.sms.max_segments default) and never longer than Twilio takes in one message (SMS_BODY_MAX,
// NewsletterSms::MAX_BODY_UNITS). NewsletterSendCheck::smsTooLong says the same words.
import { smsPlain } from './rules.ts';

const GSM_BASIC = new Set([..."@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"]);
const GSM_EXTENDED = new Set([...'^{}\\[~]|€\f']);

/** Twilio refuses a text longer than 1,600 characters; counted in UTF-16 units (String.length), as the API does. */
export const SMS_BODY_MAX = 1600;
/** The most parts a newsletter text may take: the API's newsletters.sms.max_segments default (NEWSLETTER_SMS_MAX_SEGMENTS
 *  can change it there; keep the two in step). */
export const MAX_SMS_PARTS = 10;
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
/** The web API's public address (the Storeel flow's texts link there too: StoreelLinkService::tokenisedUrl). */
export const API_PUBLIC_BASE = PUBLIC_BASE;
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
  /** The whole text as sent (name, text, link, STOP line), in UTF-16 units. */
  length: number;
  tooLong: boolean;
  /** The API's own words when it is over the limit (NewsletterSendCheck::smsTooLong). */
  problem: string | null;
}

const count = (n: number) => n.toLocaleString('en-US');

/** maxParts: null = no limit on parts (only Twilio's SMS_BODY_MAX), as the API with NEWSLETTER_SMS_MAX_SEGMENTS=0. */
export function smsPartsInfo(fromName: string, smsText: string, maxParts: number | null = MAX_SMS_PARTS): SmsPartsInfo {
  const text = finalSmsText(fromName, smsText);
  const s = smsSegments(text);
  const parts = Math.max(1, s.segments);
  const length = text.length;
  let problem: string | null = null;
  if (maxParts !== null && parts > maxParts) {
    problem = `This text would go out as ${parts} text messages, more than the ${maxParts} allowed. Shorten it or remove emoji.`;
  } else if (length > SMS_BODY_MAX) {
    problem = `This text is too long to send as a text message (${count(length)} of ${count(SMS_BODY_MAX)} characters, with your name, the link and "Reply STOP to opt out."). Shorten it, or untick Text message.`;
  }
  return { parts, unicode: s.encoding === 'UCS-2', length, tooLong: problem !== null, problem };
}

/** The hint under the Message box when Text message is ticked: how many texts each person's message is sent as. */
export function smsPartsLabel(parts: number): string {
  return `Sent as ${parts} text ${parts === 1 ? 'message' : 'messages'} (max ${MAX_SMS_PARTS}).`;
}
