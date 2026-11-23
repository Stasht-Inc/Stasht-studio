// The account chooser's admin_switch_data rows (components/AccountChoiceModal.tsx), 10 Nov 2026.
//
// The sign-in API sends collaborators' owner_id as a number; the chooser handles the clicked one as a string.
// Comparing them with === never matched, so the clicked account's token was not kept in admin_accounts, the stored
// switch data then looked like another sign-in's (utils/propertyAccountSwitch switchDataIsStale) and was deleted on
// the next render: an admin who picked the business at sign-in had no "Switch to …" back (Royal Wood's team admin).

type Collab = { owner_id?: unknown; user_id?: unknown; isPartialAdmin?: boolean; owner?: any; owner_name?: string; owner_email?: string; location?: string };

// Choose Account and the profile menu's admin rows (Chris, 23 Nov 2026): the account they're an admin of showed as
// "Admin Account 1" with an "A" circle. Each row now reads like the Personal row: the business name (the account's
// name), else the owner's email, else their phone; its logo, else initials on its profile colour; and its email.

/** What an admin account row shows. `name` is never empty while the API sent anything about the account. */
export interface AdminAccountDisplay { name: string; email: string; image: string | null; color: string | null; initials: string }

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** The stored admin_switch_data user for a row that isn't signed in yet (null when the API sent nothing about it). */
export function adminRowUser(collab: Collab): { name: string; email: string; location: string; profile_image: string | null; profile_color: string | null; phone_number: string } | null {
  const o = collab?.owner ?? {};
  const name = text(o.name) || text(collab?.owner_name);
  const email = text(o.email) || text(collab?.owner_email);
  const phone = text(o.phone_number);
  const image = text(o.profile_image) || null;
  if (!name && !email && !phone && !image) return null;
  return { name, email, location: text(o.location) || text(collab?.location), profile_image: image, profile_color: text(o.profile_color) || null, phone_number: phone };
}

/** A row from the sign-in collaborators (owner) or from admin_switch_data (user). */
export function adminAccountDisplay(account: { owner?: any; user?: any; owner_name?: string; owner_email?: string } | null | undefined): AdminAccountDisplay {
  const who = account?.owner ?? account?.user ?? {};
  const email = text(who.email) || text(account?.owner_email);
  const name = text(who.name) || text(account?.owner_name) || email || text(who.phone_number) || 'Admin account';
  const color = text(who.profile_color);
  return {
    name,
    email: email && email !== name ? email : '',
    image: text(who.profile_image) || text(who.avatar) || null,
    color: /^#?[0-9a-fA-F]{6}$/.test(color) ? (color.startsWith('#') ? color : `#${color}`) : null,
    initials: accountInitials(name),
  };
}

/** Up to two initials from the first two words with a letter or digit ("Royal Wood" → "RW"); the first character else. */
export function accountInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const out = words.slice(0, 2).map((w) => (w.match(/[\p{L}\p{N}]/u) ?? [''])[0]).join('').toUpperCase();
  return out || name.trim().charAt(0).toUpperCase() || '?';
}

/** Dark initials on a light colour, white on a dark one (as the Leads assignee badge). */
export function initialsInk(hex: string): string {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#1f2937' : '#ffffff';
}

/** Account ids from the API (number or string) compared as strings; empty never matches. */
export function sameOwner(a: unknown, b: unknown): boolean {
  const x = String(a ?? '').trim();
  return x !== '' && x === String(b ?? '').trim();
}

/** The chooser row that was clicked: same owner and same kind (an owner can be listed as Admin and Partial Admin). */
export function isClickedRow(collab: Collab, clicked: { owner_id?: unknown; isPartialAdmin?: boolean }): boolean {
  return sameOwner(collab.owner_id, clicked.owner_id) && !!collab.isPartialAdmin === !!clicked.isPartialAdmin;
}

/** admin_accounts after choosing `clicked`: its user and token; the other rows keep name/email/location for the menu. */
export function adminAccountsAfterChoice(
  collaborators: Collab[],
  clicked: { owner_id?: unknown; isPartialAdmin?: boolean },
  adminUser: any,
  adminToken: string,
): Array<{ owner_id: string; user: any; token: string; isPartialAdmin: boolean }> {
  return (Array.isArray(collaborators) ? collaborators : []).filter(Boolean).map((collab) => {
    const mine = isClickedRow(collab, clicked);
    return {
      owner_id: String(collab.owner_id ?? ''),
      user: mine ? adminUser : adminRowUser(collab),
      token: mine ? adminToken : '',
      isPartialAdmin: !!collab.isPartialAdmin,
    };
  });
}
