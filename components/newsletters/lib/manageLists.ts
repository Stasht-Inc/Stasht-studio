// [wdy2xh2p3k] Manage lists: the line under each list, a member's consent, and dropping a deleted list from a draft.
import type { AudienceItem, ConsentType, ContactList } from '../../../services/newslettersAPI.ts';
import { consentLabel } from './consent.ts';
import { formatCount } from './audience.ts';
import { userLocale } from './locale.ts';

function dateText(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

const ORIGIN: Record<string, string> = { import: 'Imported', leads: 'Made from leads', lead_group: 'Made from a lead group' };

export function listOrigin(list: Pick<ContactList, 'source' | 'created_at'>, locale: string = userLocale()): string {
  const date = dateText(list.created_at, locale);
  const origin = ORIGIN[list.source] ?? 'Made';
  return date ? `${origin} ${date}` : origin;
}

export function listDetails(list: Pick<ContactList, 'source' | 'created_at' | 'member_count' | 'consent_type'>, locale: string = userLocale()): string {
  const size = `${formatCount(list.member_count, locale)} ${list.member_count === 1 ? 'contact' : 'contacts'}`;
  return [size, consentLabel(list.consent_type), listOrigin(list, locale)].join(' · ');
}

export function memberConsentText(m: { consent_type?: ConsentType | null; consent_at?: string | null }, locale: string = userLocale()): string {
  if (!m.consent_type) return '—';
  const type = m.consent_type === 'express' ? 'Express' : 'Implied';
  const date = dateText(m.consent_at, locale);
  return date ? `${type}, ${date}` : type;
}

/** The draft's recipients without a list that was just deleted (the same array when it wasn't there). */
export function withoutList(audience: AudienceItem[], listId: number): AudienceItem[] {
  const next = audience.filter((a) => !(a.type === 'list' && a.id === listId));
  return next.length === audience.length ? audience : next;
}
