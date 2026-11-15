// The account chooser's admin_switch_data rows (components/AccountChoiceModal.tsx), 10 Nov 2026.
//
// The sign-in API sends collaborators' owner_id as a number; the chooser handles the clicked one as a string.
// Comparing them with === never matched, so the clicked account's token was not kept in admin_accounts, the stored
// switch data then looked like another sign-in's (utils/propertyAccountSwitch switchDataIsStale) and was deleted on
// the next render: an admin who picked the business at sign-in had no "Switch to …" back (Royal Wood's team admin).

type Collab = { owner_id?: unknown; user_id?: unknown; isPartialAdmin?: boolean; owner?: any; owner_name?: string; owner_email?: string; location?: string };

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
    const name = collab.owner?.name || collab.owner_name || '';
    const email = collab.owner?.email || collab.owner_email || '';
    const location = collab.owner?.location || collab.location || '';
    const mine = isClickedRow(collab, clicked);
    return {
      owner_id: String(collab.owner_id ?? ''),
      user: mine ? adminUser : (name || email ? { name, email, location } : null),
      token: mine ? adminToken : '',
      isPartialAdmin: !!collab.isPartialAdmin,
    };
  });
}
