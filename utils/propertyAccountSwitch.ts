// Opening an external property switches into that full account with the same admin-account switch the
// Profile menu uses (localStorage 'admin_switch_data', see components/AccountChoiceModal.tsx). This builds the
// switch data for it: the account that was signed in stays the one "Switch to …" returns to.
//
// The property account is not added to admin_accounts: it is reached from the Properties lists, and
// login-as-admin hands out a fresh token every time it is opened.

type SwitchAccount = { user: any; token: string };

export type PropertySwitchData = {
  has_admin_access: boolean;
  current_mode: 'admin' | 'personal';
  current_admin_owner_id?: string;
  personal_account: SwitchAccount;
  admin_accounts: Array<{ owner_id: string; user: any; token: string; isPartialAdmin?: boolean }>;
};

export function switchDataForPropertyAccount(
  existing: PropertySwitchData | null | undefined,
  signedIn: SwitchAccount,
  ownerId: string | number,
): PropertySwitchData {
  const keep = existing && existing.personal_account && existing.personal_account.token;
  return {
    has_admin_access: true,
    current_mode: 'admin',
    current_admin_owner_id: String(ownerId),
    personal_account: keep ? existing!.personal_account : { user: signedIn.user, token: signedIn.token },
    admin_accounts: keep && Array.isArray(existing!.admin_accounts) ? existing!.admin_accounts : [],
  };
}

const accountKey = (user: any) => user?.id ?? user?.email ?? user?.phone_number;

/**
 * True when stored switch data was left behind by a different sign-in (signup, SSO, a login that never hit
 * "Sign out") and must be discarded. It still belongs to the signed-in user when that user is the personal
 * account, or — while switched into another account — the account switched to (login-as-admin's user carries
 * external_user_id = the owner id it was switched to).
 */
export function switchDataIsStale(data: Partial<PropertySwitchData> | null | undefined, currentUser: any): boolean {
  if (!data || !currentUser) return false;
  const currentId = accountKey(currentUser);
  const storedId = accountKey(data.personal_account?.user);
  if (!currentId || !storedId || String(currentId) === String(storedId)) return false;
  const switchedTo = data.current_mode === 'admin' ? String(data.current_admin_owner_id ?? '') : '';
  if (switchedTo && String(currentUser.external_user_id ?? '') === switchedTo) return false;
  return true;
}
