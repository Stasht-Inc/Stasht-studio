// Every Studio tab shares one sign-in (localStorage 'stasht_user' / 'stasht_token'), and every API call reads the
// token at the moment it is sent. When another tab switches business (Profile menu → admin account) or signs in
// as someone else, a tab that keeps showing the old account would save into the new one. These helpers tell an
// account switch apart from a sign-in, a sign-out or the same account being saved again.

type StoredUser = { id?: unknown; email?: unknown; phone_number?: unknown; name?: unknown };

const SWITCH_NOTICE_KEY = 'stasht_account_switched_to';
const NOTICE_MAX_AGE_MS = 60_000;

function parse(raw: string | null): StoredUser | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? (value as StoredUser) : null;
  } catch {
    return null;
  }
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function contact(user: StoredUser): string {
  return (text(user.email) || text(user.phone_number)).toLowerCase();
}

/** True only when both values name an account and they are different accounts. Ids are compared when both
 * sides have one; otherwise email/phone on both sides. */
export function isDifferentAccount(oldRaw: string | null, newRaw: string | null): boolean {
  const before = parse(oldRaw);
  const after = parse(newRaw);
  if (!before || !after) return false;
  const [idBefore, idAfter] = [text(before.id), text(after.id)];
  if (idBefore && idAfter) return idBefore !== idAfter;
  const [cBefore, cAfter] = [contact(before), contact(after)];
  return cBefore !== '' && cAfter !== '' && cBefore !== cAfter;
}

/** The account's name for a notice: name, else email, else phone. */
export function accountLabel(raw: string | null): string | null {
  const user = parse(raw);
  if (!user) return null;
  return text(user.name) || text(user.email) || text(user.phone_number) || null;
}

/** Remember (for this tab only, across its reload) which account it was moved to. */
export function rememberSwitchNotice(newRaw: string | null): void {
  try {
    sessionStorage.setItem(SWITCH_NOTICE_KEY, JSON.stringify({ label: accountLabel(newRaw) ?? '', at: Date.now() }));
  } catch {
    // Private mode etc.: the reload still happens, just without the notice.
  }
}

/** The notice left by rememberSwitchNotice, read once. null when there is none. */
export function takeSwitchNotice(): string | null {
  try {
    const raw = sessionStorage.getItem(SWITCH_NOTICE_KEY);
    if (raw === null) return null;
    sessionStorage.removeItem(SWITCH_NOTICE_KEY);
    // Only right after the reload: a notice left behind (e.g. the tab was signed out instead) must not pop up later.
    const { label, at } = JSON.parse(raw) as { label?: string; at?: number };
    if (typeof at !== 'number' || Date.now() - at > NOTICE_MAX_AGE_MS) return null;
    return label ? `You switched to ${label} in another tab, so this tab has been updated.` : 'You switched account in another tab, so this tab has been updated.';
  } catch {
    return null;
  }
}

export const STALE_TAB_MESSAGE = 'You switched account in another tab. Reload this tab to keep working.';

let staleTab = false;

/** True once another tab switched account and this tab has not reloaded yet. */
export function isTabStale(): boolean {
  return staleTab;
}

/** Does this request go to the Stasht API (anything that reads or saves account data)? */
export function isApiRequest(url: string): boolean {
  return /\/(sso-)?api\//.test(url) || /(^|\/\/)restapi\.stasht\.com/.test(url);
}

/**
 * From now on this tab refuses every API request: it still shows the old account while the shared sign-in is the
 * new one, so anything it saved would land in the wrong business. Used when the reload is held up (for example a
 * "Leave site?" prompt the person cancels). Every Studio API path goes through window.fetch, so one wrapper covers
 * them all.
 */
export function markTabStale(): void {
  if (staleTab || typeof window === 'undefined') return;
  staleTab = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (isApiRequest(url)) return Promise.reject(new Error(STALE_TAB_MESSAGE));
    return realFetch(input, init);
  };
  // Uploads with progress bars use XMLHttpRequest instead of fetch: fail those the same way (an "error" event).
  if (typeof XMLHttpRequest === 'undefined') return;
  type Guarded = XMLHttpRequest & { stashtBlocked?: boolean };
  const realOpen = XMLHttpRequest.prototype.open;
  const realSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function open(this: Guarded, method: string, url: string | URL, ...rest: unknown[]) {
    this.stashtBlocked = isApiRequest(String(url));
    return (realOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.send = function send(this: Guarded, body?: Document | XMLHttpRequestBodyInit | null) {
    if (this.stashtBlocked) {
      window.setTimeout(() => {
        this.dispatchEvent(new ProgressEvent('error'));
        this.dispatchEvent(new ProgressEvent('loadend'));
      }, 0);
      return;
    }
    realSend.call(this, body);
  };
}
