// What belongs to the signed-in account in this browser (Chris, 5 Nov 2026, point 1).
//
// Chris signed out of Pedalheads and created a new account: it opened in Pedalheads' "Point Grey" property view
// (header "Point Grey · Property") behind the new-account plan picker, with Starter hidden because a property view was
// open. view_type / selected_property (PropertyContext) and is_new_user outlived the sign-out: userUtils.clearAuthData
// removed only the auth keys. clearAccountState removes everything that belongs to one account; it runs on every
// sign-out, token expiry / 401 and sign-in (clearAuthData), and before a sign-up / activation / SSO writes the new
// sign-in directly. PropertyContext listens for ACCOUNT_STATE_CLEARED_EVENT and returns to the account view.
//
// Kept on purpose: device preferences (pwa-install-dismissed, stasht_login_method_*, google_photos_dont_ask) and
// sign-in flows in progress, which are written BEFORE the sign-in they are for (pending_property_switch,
// pendingInvite, pendingRedirectAfterLogin, magic-link and QR-invite keys). Newsletter draft copies are keyed per
// account and go on an explicit sign-out (utils/newsletterBackups). No imports, so authUtils can use it.

export const ACCOUNT_STATE_CLEARED_EVENT = 'stasht-account-state-cleared';

/** localStorage: the login id of the account that opened the stored property view (PropertyContext). */
export const PROPERTY_VIEW_OWNER_KEY = 'selected_property_owner';

/** localStorage keys of the signed-in account (besides the auth keys clearAuthData removes itself). */
export const ACCOUNT_LOCAL_KEYS: readonly string[] = [
  // The property view (PropertyContext) and the new-account plan picker's flag (App).
  'view_type',
  'selected_property',
  PROPERTY_VIEW_OWNER_KEY,
  'is_new_user',
  // Per-account screens and caches.
  'stasht_campaigns_view',
  'stash_invited_memories',
  'stasht_recent_searches',
  'hiddenServices',
  'imageCropSettings',
  'stasht_watched_videos',
  'stasht_category_colors',
  'moderation_preference_updated',
];

/** sessionStorage keys that open a screen of the signed-in account on the next page. */
export const ACCOUNT_SESSION_KEYS: readonly string[] = [
  'users_open_tab',
  'billing_open_upgrade',
  'openPurchaseCreditsModal',
  'restorePublishedEntry',
];

type RemovableStorage = { removeItem(key: string): void } | null | undefined;

function browserStorage(kind: 'localStorage' | 'sessionStorage'): RemovableStorage {
  try {
    return typeof window !== 'undefined' ? window[kind] : null;
  } catch {
    return null;
  }
}

function removeAll(storage: RemovableStorage, keys: readonly string[]): void {
  if (!storage) return;
  for (const key of keys) {
    try {
      storage.removeItem(key);
    } catch {
      // storage refused (private mode): nothing kept to clear
    }
  }
}

/**
 * Removes the signed-in account's keys (tests pass their own storages; the app uses the browser's) and tells
 * PropertyContext (ACCOUNT_STATE_CLEARED_EVENT). Never throws.
 */
export function clearAccountState(
  local: RemovableStorage = browserStorage('localStorage'),
  session: RemovableStorage = browserStorage('sessionStorage'),
): void {
  removeAll(local, ACCOUNT_LOCAL_KEYS);
  removeAll(session, ACCOUNT_SESSION_KEYS);
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(ACCOUNT_STATE_CLEARED_EVENT));
    }
  } catch {
    // no window (tests)
  }
}

/**
 * A property view restored from storage that is not one of the signed-in account's properties (owned or shared, as
 * GET /properties lists them): left behind by another sign-in, so the account view is shown instead. Unknown
 * (`rows` null: the list could not be loaded) keeps the view.
 */
export function propertyViewIsStale(viewType: unknown, property: { id?: unknown } | null | undefined, rows: unknown): boolean {
  if (viewType !== 'property' || !property || !Array.isArray(rows)) return false;
  const id = property.id === null || property.id === undefined ? '' : String(property.id).trim();
  if (!id) return false;
  return !rows.some((row: any) => row && String(row.id).trim() === id);
}
