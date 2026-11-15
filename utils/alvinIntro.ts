// Whether the "Meet Alvin, your AI assistant" explainer (components/alvin/AlvinIntroPopover) has been dismissed.
//
// Chris, 10 Nov 2026: "once you have said got it. It should go away. It keeps reappearing when I sign back in."
// It was remembered under ONE key, stasht_alvin_intro_seen_<external_user_id ?? id>: whichever of the two ids the
// stored user had at that moment (a sign-in's user and a refreshed profile do not always carry the same fields), or
// 'anon' before the user had loaded; a later sign-in that resolved a different id found nothing and showed it again.
// Now a dismissal is written under every id of the person (external_user_id, id, email, phone) and any of them counts.
// The keys are never cleared on sign-out (utils/accountState / clearAuthData do not list them). "Got it", the close
// button, Escape and "Try Alvin" all dismiss it. No imports, so the util tests can load it.

type KeyValueStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void } | null | undefined;

const PREFIX = 'stasht_alvin_intro_seen_';

function browserStorage(): KeyValueStorage {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The person's ids as storage-key suffixes; empty when nothing identifies them (the user hasn't loaded). */
export function introKeys(user: unknown): string[] {
  const u = (user ?? {}) as { external_user_id?: unknown; id?: unknown; email?: unknown; phone_number?: unknown; phone?: unknown };
  const keys: string[] = [];
  const add = (suffix: string) => {
    if (!keys.includes(PREFIX + suffix)) keys.push(PREFIX + suffix);
  };
  for (const id of [u.external_user_id, u.id]) {
    const text = id === null || id === undefined ? '' : String(id).trim();
    if (text) add(text); // the id keys older builds wrote stay valid
  }
  const email = typeof u.email === 'string' ? u.email.trim().toLowerCase() : '';
  if (email) add(`email:${email}`);
  const phone = String(u.phone_number ?? u.phone ?? '').replace(/[^\d+]/g, '');
  if (phone) add(`phone:${phone}`);
  return keys;
}

/** Dismissed already. Unknown user (not loaded yet) or no storage: treated as seen, so it never flashes up wrongly. */
export function introSeen(user: unknown, storage: KeyValueStorage = browserStorage()): boolean {
  const keys = introKeys(user);
  if (!storage || keys.length === 0) return true;
  try {
    return keys.some((key) => storage.getItem(key) === '1');
  } catch {
    return true;
  }
}

/** Remembers the dismissal under every id of the person. */
export function markIntroSeen(user: unknown, storage: KeyValueStorage = browserStorage()): void {
  if (!storage) return;
  for (const key of introKeys(user)) {
    try {
      storage.setItem(key, '1');
    } catch {
      // storage refused: it may show again
    }
  }
}
