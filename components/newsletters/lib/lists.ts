// Lists tab on the Leads page (Chris, 28 Oct 2026): pure helpers for the lists table and one list's people.
import type { ContactList, MemberEmailStatus, MemberSmsStatus } from '../../../services/newslettersAPI.ts';
import { formatCount } from './audience.ts';
import { cleanPhone } from './csv.ts';
import { shortDate } from './manageLists.ts';
import { isPlausibleEmail } from './rules.ts';
import { userLocale } from './locale.ts';

/** The API takes 1–500 ids per remove or copy. */
export const MAX_SELECTED = 500;

/** Fired after the Lists tab changes a list, so the composer's Send to checklist reloads. */
export const LISTS_CHANGED_EVENT = 'stasht-contact-lists-changed';

export function announceListsChanged(): void {
  if (typeof window === 'undefined' || !window || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new Event(LISTS_CHANGED_EVENT));
}

const SOURCE: Record<string, string> = { import: 'Imported', leads: 'Made from leads', lead_group: 'Made from a lead group', manual: 'Created here' };

export function listSourceLabel(source: string | null | undefined): string {
  return (source && SOURCE[source]) || 'List';
}

type Totals = Pick<ContactList, 'member_count' | 'email_count' | 'unsubscribed_count'>;

export function listTotals(lists: Totals[]): { lists: number; people: number; email: number; unsubscribed: number } {
  let people = 0;
  let email = 0;
  let unsubscribed = 0;
  for (const l of lists) {
    people += Number(l.member_count) || 0;
    email += Number(l.email_count) || 0;
    unsubscribed += Number(l.unsubscribed_count) || 0;
  }
  return { lists: lists.length, people, email, unsubscribed };
}

export function listUpdatedText(list: Pick<ContactList, 'created_at' | 'updated_at'>, locale: string = userLocale()): string {
  return shortDate(list.updated_at, locale) || shortDate(list.created_at, locale) || '—';
}

export function peopleText(n: number, locale: string = userLocale()): string {
  return `${formatCount(n, locale)} ${n === 1 ? 'person' : 'people'}`;
}

/** "Added 812, updated 40, skipped 12." — the parts that are zero (besides Added) are left out. */
export function mergeResultText(r: { added?: number; updated?: number; skipped?: number }, locale: string = userLocale()): string {
  const parts = [`Added ${formatCount(r.added ?? 0, locale)}`];
  if (r.updated) parts.push(`updated ${formatCount(r.updated, locale)}`);
  if (r.skipped) parts.push(`skipped ${formatCount(r.skipped, locale)}`);
  return `${parts.join(', ')}.`;
}

const baseName = (name: string): string => name.split(/[\\/]/).pop()?.trim() ?? '';

/** filename*= (RFC 5987) first, then filename=; only the last path part; `fallback` when there is none. */
export function filenameFromDisposition(header: string | null | undefined, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
  if (star) {
    try {
      const name = baseName(decodeURIComponent(star[1].trim().replace(/^"|"$/g, '')));
      if (name) return name;
    } catch {
      // Badly encoded: try the plain one.
    }
  }
  const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/.exec(header);
  const name = plain ? baseName(plain[2] ?? plain[1]) : '';
  return name || fallback;
}

export type ChipTone = 'good' | 'muted' | 'bad';
export interface StatusChipInfo { label: string; tone: ChipTone; title: string }

const EMAIL_CHIP: Record<MemberEmailStatus, StatusChipInfo> = {
  subscribed: { label: 'Email', tone: 'good', title: 'Gets emails' },
  unsubscribed: { label: 'Email: unsubscribed', tone: 'muted', title: 'Unsubscribed from emails' },
  bounced: { label: 'Email: bounced', tone: 'bad', title: 'Emails to this address bounced' },
  complained: { label: 'Email: marked as spam', tone: 'bad', title: 'Marked an email as spam' },
};
const SMS_CHIP: Record<MemberSmsStatus, StatusChipInfo> = {
  subscribed: { label: 'Text', tone: 'good', title: 'Gets texts' },
  stopped: { label: 'Text: stopped', tone: 'muted', title: 'Replied STOP to a text' },
};

/** null: no email address on file (nothing to show). */
export function emailStatusChip(status: MemberEmailStatus | null | undefined): StatusChipInfo | null {
  return status ? EMAIL_CHIP[status] ?? null : null;
}

export function smsStatusChip(status: MemberSmsStatus | null | undefined): StatusChipInfo | null {
  return status ? SMS_CHIP[status] ?? null : null;
}

export const NEED_CONTACT = 'Add an email address or a mobile number.';
export const BAD_EMAIL = 'Enter an email address like name@example.com.';
export const BAD_PHONE = 'Enter a mobile number with its country code, like +1 416 555 0100.';

/** The same words the API answers with (422); the API has the last say on what it can use. */
export function memberFormProblems(input: { email: string; phone: string }): Partial<Record<'email' | 'phone', string>> {
  const email = input.email.trim();
  const phone = input.phone.trim();
  if (!email && !phone) return { email: NEED_CONTACT };
  const out: Partial<Record<'email' | 'phone', string>> = {};
  if (email && !isPlausibleEmail(email)) out.email = BAD_EMAIL;
  if (phone && !cleanPhone(phone)) out.phone = BAD_PHONE;
  return out;
}

export function toggleSelected(selected: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else if (next.size < MAX_SELECTED) next.add(id);
  return next;
}

export function pageSelection(selected: ReadonlySet<number>, pageIds: number[]): 'none' | 'some' | 'all' {
  const chosen = pageIds.filter((id) => selected.has(id)).length;
  if (!pageIds.length || chosen === 0) return 'none';
  return chosen === pageIds.length ? 'all' : 'some';
}

/** The page's checkbox: everyone on the page chosen → unchoose them; otherwise choose them (up to the limit). */
export function togglePage(selected: ReadonlySet<number>, pageIds: number[]): Set<number> {
  const next = new Set(selected);
  if (pageSelection(selected, pageIds) === 'all') {
    pageIds.forEach((id) => next.delete(id));
    return next;
  }
  for (const id of pageIds) {
    if (next.size >= MAX_SELECTED) break;
    next.add(id);
  }
  return next;
}

export function withListSummary<T extends { id: number }>(lists: T[], summary: T): T[] {
  return lists.some((l) => l.id === summary.id) ? lists.map((l) => (l.id === summary.id ? { ...l, ...summary } : l)) : [summary, ...lists];
}
