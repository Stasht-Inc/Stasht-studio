// Leads quick switch (Deepak + Chris, 14 Nov 2026): the button at the far right of the Leads OPEN / CLOSED row.
//
// Signed in as themselves, an Admin / Partial Admin of other accounts sees one button (the business's logo + its
// unread count) that switches into that account and lands on its Leads; with 2+ accounts the button opens a list.
// Switched into one of those accounts, the same spot offers the way back to the personal account (its avatar).
//
// Which accounts: GET /leads/admin-accounts-unread (the server's own grants, with unread counts) when it answers;
// otherwise the Profile menu's "Admin Accounts" rows (localStorage admin_switch_data, no counts). Property /
// External accounts are never listed: the server lists Users-tab Admin + Partial Admin grants only, and the
// fallback drops the 'property_' rows as the Profile menu does (an opened external property is not in
// admin_accounts at all — utils/propertyAccountSwitch.ts — so in it the switch shows nothing).

import { sameOwner } from './adminSwitchAccounts.ts';

export type QuickSwitchApiAccount = {
  owner_id: number | string;
  name?: string | null;
  email?: string | null;
  profile_image?: string | null;
  profile_color?: string | null;
  role?: string | null;
  unread?: number | null;
};

export type QuickSwitchAccount = {
  ownerId: string;
  name: string;
  email: string;
  image: string | null;
  color: string | null;
  partial: boolean;
  unread: number | null;
};

export type QuickSwitchState =
  | { mode: 'none' }
  | { mode: 'personal'; accounts: QuickSwitchAccount[] }
  | { mode: 'business'; current: QuickSwitchAccount; personal: { name: string; email: string; image: string | null; color: string | null }; others: QuickSwitchAccount[] };

type SwitchData = {
  current_mode?: string;
  current_admin_owner_id?: string;
  personal_account?: { user?: any };
  admin_accounts?: Array<{ owner_id?: unknown; user?: any; isPartialAdmin?: boolean }>;
} | null | undefined;

const imageOf = (u: any): string | null => {
  const v = u?.profile_image || u?.avatar;
  return typeof v === 'string' && v.trim() !== '' && v !== 'null' ? v : null;
};

/** The switch's accounts: the server's list when it answered (most unread first), else the Profile menu's rows. */
export function quickSwitchAccounts(switchData: SwitchData, api: QuickSwitchApiAccount[] | null): QuickSwitchAccount[] {
  const rows = (Array.isArray(switchData?.admin_accounts) ? switchData!.admin_accounts : [])
    .filter((r) => r && String(r.owner_id ?? '').trim() !== '' && !String(r.owner_id).startsWith('property_'));

  if (Array.isArray(api)) {
    return api.filter((a) => a && String(a.owner_id ?? '').trim() !== '').map((a) => {
      const row = rows.find((r) => sameOwner(r.owner_id, a.owner_id));
      return {
        ownerId: String(a.owner_id),
        name: String(a.name || row?.user?.name || a.email || row?.user?.email || 'Account'),
        email: String(a.email || row?.user?.email || ''),
        image: imageOf(a) ?? imageOf(row?.user),
        color: a.profile_color || row?.user?.profile_color || null,
        partial: a.role === 'partial_admin',
        unread: typeof a.unread === 'number' ? a.unread : null,
      };
    });
  }

  const seen = new Set<string>();
  return rows.filter((r) => {
    const id = String(r.owner_id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map((r) => ({
    ownerId: String(r.owner_id),
    name: String(r.user?.name || r.user?.email || 'Account'),
    email: String(r.user?.email || ''),
    image: imageOf(r.user),
    color: r.user?.profile_color || null,
    partial: !!r.isPartialAdmin,
    unread: null,
  }));
}

/** What the switch shows for the account in use now. */
export function quickSwitchState(switchData: SwitchData, api: QuickSwitchApiAccount[] | null, inPropertyView = false): QuickSwitchState {
  if (inPropertyView) return { mode: 'none' };
  const accounts = quickSwitchAccounts(switchData, api);

  if (switchData?.current_mode === 'admin') {
    const current = accounts.find((a) => sameOwner(a.ownerId, switchData.current_admin_owner_id));
    const p = switchData.personal_account?.user;
    // Switched into something that isn't one of these accounts (an external property): nothing here.
    if (!current || !p) return { mode: 'none' };
    return {
      mode: 'business',
      current,
      personal: { name: String(p.name || p.email || p.phone_number || 'Personal'), email: String(p.email || ''), image: imageOf(p), color: p.profile_color || null },
      others: accounts.filter((a) => a !== current),
    };
  }

  return accounts.length > 0 ? { mode: 'personal', accounts } : { mode: 'none' };
}

/** Badge text: nothing for 0 / unknown, 99+ past 99. */
export function unreadBadge(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return '';
  return n > 99 ? '99+' : String(Math.floor(n));
}

/** Initials for an account without a logo. */
export function accountInitials(name: string): string {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}
