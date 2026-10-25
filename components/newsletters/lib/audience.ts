import type { AudienceCount, AudienceItem, ContactList, NewsletterChannel } from '../../../services/newslettersAPI.ts';
import { LIMITS, smsPlain } from './rules.ts';
import { userLocale } from './locale.ts';

export { smsPlain };

export interface GroupOption { id: number; name: string; member_count: number }

export const ZERO_COUNT: AudienceCount = { email: 0, sms: 0, skipped: { no_email: 0, no_phone: 0, unsubscribed: 0, duplicate: 0, consent_expired: 0, unsupported_number: 0 } };

export function audienceKey(item: AudienceItem): string {
  return item.type === 'all_leads' ? 'all_leads' : `${item.type}:${item.id}`;
}

export function hasAudienceItem(audience: AudienceItem[], item: AudienceItem): boolean {
  const key = audienceKey(item);
  return audience.some((a) => audienceKey(a) === key);
}

export function toggleAudienceItem(audience: AudienceItem[], item: AudienceItem): AudienceItem[] {
  const key = audienceKey(item);
  return hasAudienceItem(audience, item) ? audience.filter((a) => audienceKey(a) !== key) : [...audience, item];
}

export function toggleChannel(channels: NewsletterChannel[], channel: NewsletterChannel): NewsletterChannel[] {
  const next = channels.includes(channel) ? channels.filter((c) => c !== channel) : [...channels, channel];
  return (['email', 'sms'] as NewsletterChannel[]).filter((c) => next.includes(c));
}

function itemName(item: AudienceItem, groups: GroupOption[], lists: Pick<ContactList, 'id' | 'name'>[]): string {
  if (item.type === 'all_leads') return 'All leads';
  if (item.type === 'lead_group') return groups.find((g) => g.id === item.id)?.name ?? 'A lead group that was deleted';
  return lists.find((l) => l.id === item.id)?.name ?? 'A list that was deleted';
}

export function audienceLabel(audience: AudienceItem[], groups: GroupOption[], lists: Pick<ContactList, 'id' | 'name'>[]): string {
  if (!audience.length) return 'Choose recipients';
  const first = itemName(audience[0], groups, lists);
  return audience.length === 1 ? first : `${first} + ${audience.length - 1} more`;
}

export function formatCount(n: number, locale: string = userLocale()): string {
  return new Intl.NumberFormat(locale).format(Math.max(0, Math.round(Number(n) || 0)));
}

export function reachable(counts: AudienceCount | null, channels: NewsletterChannel[]): number {
  if (!counts) return 0;
  return (channels.includes('email') ? counts.email : 0) + (channels.includes('sms') ? counts.sms : 0);
}

export function countSummary(counts: AudienceCount | null, channels: NewsletterChannel[]): string {
  if (!counts) return '—';
  const email = channels.includes('email');
  const sms = channels.includes('sms');
  if (email && sms) return `${formatCount(counts.email)} emails · ${formatCount(counts.sms)} texts`;
  if (sms) return `${formatCount(counts.sms)} texts`;
  return formatCount(counts.email);
}

export function skippedSummary(counts: AudienceCount | null, channels: NewsletterChannel[]): string {
  if (!counts) return '';
  const s = counts.skipped;
  const parts: string[] = [];
  if (channels.includes('email') && s.no_email) parts.push(`${formatCount(s.no_email)} with no email address`);
  if (channels.includes('sms') && s.no_phone) parts.push(`${formatCount(s.no_phone)} with no mobile number`);
  if (s.unsubscribed) parts.push(`${formatCount(s.unsubscribed)} unsubscribed`);
  if (s.duplicate) parts.push(`${formatCount(s.duplicate)} listed twice`);
  const out = parts.length ? [`Not included: ${parts.join(', ')}.`] : [];
  // [wdy2xh2p3e / 2p3f] Older API versions leave these two out.
  if (s.consent_expired) out.push(`${formatCount(s.consent_expired)} left out: their consent is older than 6 months.`);
  if (channels.includes('sms') && s.unsupported_number) {
    out.push(`${formatCount(s.unsupported_number)} phone ${s.unsupported_number === 1 ? 'number' : 'numbers'} can't get texts (only Canadian and US mobile numbers).`);
  }
  return out.join(' ');
}

/** Counted as it is texted (smsPlain): "…" is three characters, curly quotes one. */
export function smsInfo(text: string): { length: number; remaining: number; over: boolean } {
  const length = smsPlain(text).length;
  return { length, remaining: LIMITS.sms_text - length, over: length > LIMITS.sms_text };
}

/** What a text recipient gets (spec §2): one line, the link to the web version, the opt-out line. */
export function smsPreview(text: string): string {
  return `${text.trim() || 'Your message'} (link to your newsletter) Reply STOP to opt out.`;
}

/** GET /lead-groups has answered with an array, {groups}, {data} and {data: {groups}}; read them all. */
export function groupsFromApi(raw: unknown): GroupOption[] {
  let list: unknown = raw;
  for (let depth = 0; depth < 3 && list && typeof list === 'object' && !Array.isArray(list); depth++) {
    const o = list as Record<string, unknown>;
    list = o.groups ?? o.data;
  }
  if (!Array.isArray(list)) return [];
  return list.flatMap((g) => {
    if (!g || typeof g !== 'object') return [];
    const r = g as Record<string, unknown>;
    const id = Number(r.id);
    return Number.isFinite(id) && typeof r.name === 'string' ? [{ id, name: r.name, member_count: Number(r.member_count) || 0 }] : [];
  });
}
