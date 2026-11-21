// The text a Storeel send's person gets (Chris, 4 Nov 2026, point 9, step 3 Send), built as the web API builds it
// (StoreelBroadcastText::text → LeadDeliveryService::buildSmsBody): the first-text intro, the personal message, the
// person's tracked campaign link and "Reply STOP to unsubscribe." (Chris 21 Nov 2026, P10: no YES / NO question and no
// "Reply to this message to respond directly." any more). Studio counts it the way the API's estimate
// does (a 30-character first name: StoreelBroadcastText::WORST_NAME) with the newsletter text rules (smsParts.ts:
// at most MAX_SMS_PARTS parts and Twilio's 1,600 characters), and says the API's own words when it is too long.
// The API checks again on Send. Pure, so `node --test` loads it.
import { API_PUBLIC_BASE, MAX_SMS_PARTS, SMS_BODY_MAX, smsSegments, type SmsPartsInfo } from '../../newsletters/lib/smsParts.ts';

/** StoreelBroadcastText::WORST_NAME: the estimate's stand-in first name. */
export const STOREEL_WORST_NAME = 'x'.repeat(30);
/** StoreelLinkService::mintToken: 22 characters. */
const TOKEN_STAND_IN = 'x'.repeat(22);
/** A typical slug when the campaign has none yet. */
const SLUG_STAND_IN = 'x'.repeat(24);

/** LeadDeliveryService::SMS_FOOTER: the last line of a first text (Chris 21 Nov 2026, P10: the STOP line only). */
export const STOREEL_SMS_FOOTER = 'Reply STOP to unsubscribe.';

/** StoreelSendService::senderLabel: the sender's name, and the business in its property view. */
export function senderLabelFor(name: string | null | undefined, business: string | null | undefined): string {
  const who = String(name ?? '').trim() || 'Someone';
  const where = String(business ?? '').trim();
  return where ? `${who}, ${where}` : who;
}

export interface StoreelTextInput {
  sender: string;
  message: string;
  slug: string | null;
  isCar: boolean;
  /** A view-only campaign's link keeps ?viewonly=1. */
  viewOnly: boolean;
}

/** The whole text, as the API's estimate builds it. isCar no longer changes it (the YES / NO question is gone). */
export function storeelSmsText({ sender, message, slug, viewOnly }: StoreelTextInput): string {
  const link = `${API_PUBLIC_BASE}/share/memory/${slug || SLUG_STAND_IN}${viewOnly ? '?viewonly=1&s=' : '?s='}${TOKEN_STAND_IN}`;
  const body = `${String(message ?? '').trim()}\n\n${link}`.replace(/\s+$/, '');
  return `Hi ${STOREEL_WORST_NAME},\nThis message came from ${sender}.\n\n${body}\n\n${STOREEL_SMS_FOOTER}`;
}

const count = (n: number) => n.toLocaleString('en-US');

/** Parts and problem (StoreelBroadcastText::check's words). maxParts null = only Twilio's 1,600 characters. */
export function storeelSmsParts(input: StoreelTextInput, maxParts: number | null = MAX_SMS_PARTS): SmsPartsInfo {
  const text = storeelSmsText(input);
  const s = smsSegments(text);
  const parts = Math.max(1, s.segments);
  const length = text.length;
  let problem: string | null = null;
  if (maxParts !== null && parts > maxParts) {
    problem = `This text would go out as ${parts} text messages, more than the ${maxParts} allowed. Shorten your message or remove emoji.`;
  } else if (length > SMS_BODY_MAX) {
    problem = `This text is too long to send as a text message (${count(length)} of ${count(SMS_BODY_MAX)} characters, with your name, the link and the reply line). Shorten it, or untick Text message.`;
  }
  return { parts, unicode: s.encoding === 'UCS-2', length, tooLong: problem !== null, problem };
}

/** "People get:" under the Message box when Text message is ticked. isCar is kept for callers; it changes nothing now. */
export function storeelSmsPreview(sender: string, message: string, _isCar = false): string {
  return `Hi (their first name), this message came from ${sender}. ${String(message ?? '').trim() || 'Your message'} (link to your campaign) ${STOREEL_SMS_FOOTER}`;
}

/** Under the Message box when Text message is ticked. */
export const STOREEL_SMS_HELP = `We add their link and "${STOREEL_SMS_FOOTER}"`;
