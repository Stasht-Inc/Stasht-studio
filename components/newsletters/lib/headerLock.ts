import type { HeaderLock } from '../../../services/newslettersAPI';

type WithLock = { header_locked?: HeaderLock | null } | null | undefined;

const valid = (lock: unknown): HeaderLock | null => {
  const l = lock as HeaderLock | null | undefined;
  return l && typeof l.message === 'string' && l.message.trim() ? { by: String(l.by ?? ''), message: l.message.trim() } : null;
};

/**
 * Property accounts (Chris, 12 Nov 2026): the header is the main account's, locked. The draft's own answer once it
 * exists (the API decides per newsletter), else the brand's (a new draft not saved yet). null: the header is editable.
 */
export function headerLockOf(newsletter: WithLock, brand: WithLock): HeaderLock | null {
  return newsletter ? valid(newsletter.header_locked) : valid(brand?.header_locked);
}
