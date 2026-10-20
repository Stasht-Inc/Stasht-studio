// Limits from spec §8. The web API enforces the same numbers; Studio stops people earlier.
export const LIMITS = {
  name: 120,
  subject: 150,
  preview_text: 200,
  from_name: 80,
  sms_text: 120,
  blocks: 40,
  title: 200,
  text_html: 20000,
  button_label: 40,
  url: 2000,
} as const;

// Close to PHP's FILTER_VALIDATE_EMAIL (the API's email:filter): dot-atom local part (no leading, trailing or double
// dots), and a host of dotted labels that don't start or end with a hyphen.
const LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

export function isPlausibleEmail(value: string): boolean {
  if (typeof value !== 'string' || value.length > 254) return false;
  const at = value.lastIndexOf('@');
  if (at < 1) return false;
  const local = value.slice(0, at);
  const labels = value.slice(at + 1).split('.');
  return local.length <= 64 && LOCAL.test(local) && labels.length >= 2 && labels.every((l) => LABEL.test(l));
}

const SMS_FOLD: Record<string, string> = {
  '\u2018': "'", '\u2019': "'", '\u201A': "'", '\u2032': "'",
  '\u201C': '"', '\u201D': '"', '\u201E': '"', '\u2033': '"',
  '\u2013': '-', '\u2014': '-', '\u2015': '-', '\u2212': '-',
  '\u2026': '...', '\u2022': '-', '\u00A0': ' ', '\u202F': ' ', '\u2009': ' ',
};
const SMS_FOLD_RE = new RegExp(`[${Object.keys(SMS_FOLD).join('')}]`, 'g');

/** The text as it is texted (NewsletterRenderer::smsPlain): plain ASCII punctuation, single spaces. The API's
 *  120-character sms_text limit counts this, so "…" counts as three. */
export function smsPlain(value: string): string {
  return String(value ?? '').replace(SMS_FOLD_RE, (c) => SMS_FOLD[c]).replace(/[ \t]+/g, ' ').trim();
}
