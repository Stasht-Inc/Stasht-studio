// Newsletter drafts kept in this browser (components/newsletters/lib/draftBackup.ts) are personal data: they go
// when the person logs out, and a deleted newsletter's copies go with it. No imports, so authUtils can use it.

export const NL_BACKUP_PREFIX = 'stasht_nl_backup:';

interface KeyedStorage {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

function defaultStorage(): KeyedStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Every draft backup (logout), or only those of one newsletter (it was deleted). Never throws. */
export function clearNewsletterBackups(storage: KeyedStorage | null = defaultStorage(), newsletterId?: number): void {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !key.startsWith(NL_BACKUP_PREFIX)) continue;
      if (newsletterId === undefined || key.endsWith(`:${newsletterId}`)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // Storage blocked: nothing kept to clear.
  }
}
