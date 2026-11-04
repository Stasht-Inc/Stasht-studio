// The text a Storeel send's person gets (Chris, 4 Nov 2026, point 9, step 3 Send), built as the web API builds it
// (StoreelBroadcastText::text → LeadDeliveryService::buildSmsBody): the first-text intro, the personal message, the
// person's tracked campaign link, the YES/NO question, the reply line. Studio counts it the way the API's estimate
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

/** config/storeels.php: vehicles for a car campaign, campaign-neutral for every other (Chris, 4 Nov 2026). */
export function storeelQuestion(isCar: boolean): string {
  return isCar ? 'Want to see more vehicles like this? Reply YES. Reply NO to stop.' : 'Want to see more like this? Reply YES. Reply NO to stop.';
}

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

/** The whole text, as the API's estimate builds it. */
export function storeelSmsText({ sender, message, slug, isCar, viewOnly }: StoreelTextInput): string {
  const link = `${API_PUBLIC_BASE}/share/memory/${slug || SLUG_STAND_IN}${viewOnly ? '?viewonly=1&s=' : '?s='}${TOKEN_STAND_IN}`;
  const body = `${String(message ?? '').trim()}\n\n${link}`.replace(/\s+$/, '') + `\n\n${storeelQuestion(isCar)}`;
  return `Hi ${STOREEL_WORST_NAME},\nThis message came from ${sender}.\n\n${body}\n\nReply to this message to respond directly. Reply STOP to unsubscribe.`;
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

/** "People get:" under the Message box when Text message is ticked. */
export function storeelSmsPreview(sender: string, message: string, isCar: boolean): string {
  return `Hi (their first name), this message came from ${sender}. ${String(message ?? '').trim() || 'Your message'} (link to your campaign) ${storeelQuestion(isCar)} Reply STOP to unsubscribe.`;
}
