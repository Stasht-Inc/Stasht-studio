// Opening an external property switches into that full account with the same admin-account switch the
// Profile menu uses (localStorage 'admin_switch_data', see components/AccountChoiceModal.tsx). This builds the
// switch data for it: the account that was signed in stays the one "Switch to …" returns to.
//
// The property account is not added to admin_accounts: it is reached from the Properties lists, and
// login-as-admin hands out a fresh token every time it is opened. The token it handed out is kept as
// switched_token, so the data counts only while that exact sign-in is in use (see switchDataIsStale).
//
// Opened while already switched into an admin account X: "Switch to …" still returns to the personal account
// (the one that signed in); X stays in admin_accounts with its cached token, so it is one click away from there.

type SwitchAccount = { user: any; token: string };

export type PropertySwitchData = {
  has_admin_access: boolean;
  current_mode: 'admin' | 'personal';
  current_admin_owner_id?: string;
  switched_token?: string;
  personal_account: SwitchAccount;
  admin_accounts: Array<{ owner_id: string; user: any; token: string; isPartialAdmin?: boolean }>;
};

export function switchDataForPropertyAccount(
  existing: PropertySwitchData | null | undefined,
  signedIn: SwitchAccount,
  ownerId: string | number,
  switchedToken: string,
): PropertySwitchData {
  const keep = existing && existing.personal_account && existing.personal_account.token;
  return {
    has_admin_access: true,
    current_mode: 'admin',
    current_admin_owner_id: String(ownerId),
    switched_token: switchedToken,
    personal_account: keep ? existing!.personal_account : { user: signedIn.user, token: signedIn.token },
    admin_accounts: keep && Array.isArray(existing!.admin_accounts) ? existing!.admin_accounts : [],
  };
}

const accountKey = (user: any) => user?.id ?? user?.email ?? user?.phone_number;

/**
 * True when stored switch data was left behind by a different sign-in (signup, SSO, a login that never hit
 * "Sign out", or the switched-to account's own owner signing in later) and must be discarded. It still belongs
 * to the browser's current sign-in when that is the personal account, or — while switched into another
 * account — when the token in use is the one the switch produced (switched_token, or the admin account's cached
 * token). Matching by account id alone is not enough: the switched-to account's real owner has the same id.
 */
export function switchDataIsStale(
  data: Partial<PropertySwitchData> | null | undefined,
  currentUser: any,
  currentToken: string | null | undefined,
): boolean {
  if (!data || !currentUser) return false;
  const currentId = accountKey(currentUser);
  const storedId = accountKey(data.personal_account?.user);
  if (!currentId || !storedId || String(currentId) === String(storedId)) return false;
  if (data.current_mode !== 'admin' || !currentToken) return true;
  const minted = [data.switched_token, ...(Array.isArray(data.admin_accounts) ? data.admin_accounts.map((a) => a?.token) : [])];
  return !minted.some((token) => !!token && token === currentToken);
}
