// The sign-off on Leads' pre-written messages ("+ Send Message": "I'm happy to help — Brenna at TheRoyalWoodShop",
// subject "Checking in from TheRoyalWoodShop"). Chris, 13 Nov 2026: Brenna, a Royal Wood team Admin switched into the
// Royal Wood account, got "— TheRoyalWoodShop at Chris Becks": the sender was the switched-into account (stasht_user)
// and "at …" was Royal Wood's only property, which is Chris Becks' External account.
//
// - Sender: the real person sending. Switched into an account (admin_switch_data, components/AccountChoiceModal), that
//   is the account that signed in (personal_account.user); otherwise the signed-in account itself.
// - Business: a property's name only when it is a real (internal) property; never an External account (a person's
//   own account) or a row whose kind is unknown. In a salesperson's External view, the main account it represents
//   (invited_by, e.g. "Serpa Chrysler"). Otherwise the account's own display name.
// - Never "X at X": the account's own sends (and a business name already naming the sender) are just the business.

import { switchDataIsStale } from './propertyAccountSwitch.ts';

type Person = { id?: unknown; email?: unknown; phone_number?: unknown; name?: unknown } | null | undefined;
type Row = Record<string, any> | null | undefined;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstName(name: unknown): string {
  return text(name).split(/\s+/)[0] ?? '';
}

const accountKey = (user: Person) => {
  const key = user?.id ?? user?.email ?? user?.phone_number;
  return key === null || key === undefined || String(key).trim() === '' ? null : String(key).trim();
};

/**
 * The person behind a switched-in session: admin_switch_data's personal account while it is in admin mode for this
 * sign-in (not stale) and is a different account from the one in use. Null when not switched in.
 */
export function actingPerson(switchData: any, currentUser: Person, currentToken: string | null | undefined): Person {
  if (!switchData || switchData.current_mode !== 'admin' || !currentUser) return null;
  const person = switchData.personal_account?.user;
  const personKey = accountKey(person);
  const currentKey = accountKey(currentUser);
  if (!personKey || !currentKey || personKey === currentKey) return null;
  if (switchDataIsStale(switchData, currentUser, currentToken)) return null;
  return person;
}

/** A property whose name may stand for the business: only an explicitly internal (dealership / main) property. */
export function propertyNamesBusiness(row: Row): boolean {
  if (!row || !text(row.name)) return false;
  if (text(row.account_type).toLowerCase() !== 'internal') return false;
  if (row.account_created_for_property === true || row.account_created_for_property === 1 || row.account_created_for_property === '1') return false;
  return row.is_own_external_account !== true;
}

/** The main account an External (property) view represents: its inviter's name ("Serpa Chrysler"), or ''. */
export function externalViewParentName(viewProperty: Row): string {
  if (!viewProperty || text(viewProperty.account_type).toLowerCase() !== 'external') return '';
  const raw = viewProperty.invited_by;
  const invitedBy = Array.isArray(raw) ? raw[0] : raw;
  return text(invitedBy?.name);
}

export interface SignoffInput {
  /** The signed-in account in use (stasht_user) — the switched-into account while switched in. */
  account: Person;
  /** The real person when switched in (actingPerson), else null. */
  acting?: Person;
  /** The property picked in the dialog (a full row with account_type when known). */
  property?: Row;
  /** The property view's property (PropertyContext currentProperty), for a salesperson's External view. */
  viewProperty?: Row;
}

export interface Signoff { sender: string; business: string; who: string }

export function messageSignoff({ account, acting, property, viewProperty }: SignoffInput): Signoff {
  const accountName = text(account?.name);
  const sender = firstName(acting ? acting.name : account?.name);
  const business = (propertyNamesBusiness(property) ? text(property!.name) : '')
    || externalViewParentName(viewProperty)
    || accountName;

  let who: string;
  if (!sender) who = business;
  else if (!business) who = sender;
  else if (sender.toLowerCase() === business.toLowerCase()) who = business;
  else if (!acting && business === accountName) who = business; // the account's own send: its name alone
  else if (!acting && new RegExp(`(^|[^\\p{L}\\p{N}])${sender.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`, 'iu').test(business)) who = business;
  else who = `${sender} at ${business}`;

  return { sender, business, who };
}
