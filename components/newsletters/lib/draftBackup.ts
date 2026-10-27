// A copy of the draft in this browser, so a lost connection or a closed tab never loses work. Every storage call
// is wrapped: private windows, full storage or blocked site data just mean no backup.
import type { Newsletter } from '../../../services/newslettersAPI.ts';
import { changedFields, draftFromNewsletter, emptyDraft, type NewsletterDraft } from './draft.ts';
import { NL_BACKUP_PREFIX } from '../../../utils/newsletterBackups.ts';

export interface DraftBackup {
  draft: NewsletterDraft;
  /** When this browser wrote the copy (ms). */
  savedAt: number;
  /** The server's updated_at the copy was made on top of (null before the draft exists). */
  baseUpdatedAt: string | null;
}

export interface BackupStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Null without a signed-in user id: no copy is kept then (never a key shared between accounts). */
export function backupKey(userId: number | string | null | undefined, newsletterId: number | null): string | null {
  if (userId === null || userId === undefined || userId === '' || userId === 0) return null;
  return `${NL_BACKUP_PREFIX}${userId}:${newsletterId ?? 'new'}`;
}

/** The browser's localStorage, or null when it can't be reached. */
export function browserStorage(): BackupStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readBackup(storage: BackupStorage | null, key: string | null): DraftBackup | null {
  if (!storage || !key) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const b = JSON.parse(raw) as Partial<DraftBackup>;
    if (!b || typeof b !== 'object' || !b.draft || typeof b.draft !== 'object' || typeof b.savedAt !== 'number') return null;
    return { draft: { ...emptyDraft(), ...b.draft }, savedAt: b.savedAt, baseUpdatedAt: typeof b.baseUpdatedAt === 'string' ? b.baseUpdatedAt : null };
  } catch {
    return null;
  }
}

export function writeBackup(storage: BackupStorage | null, key: string | null, backup: DraftBackup): void {
  if (!storage || !key) return;
  try {
    storage.setItem(key, JSON.stringify(backup));
  } catch {
    // No room or not allowed: carry on without a backup.
  }
}

export function clearBackup(storage: BackupStorage | null, key: string | null): void {
  if (!storage || !key) return;
  try {
    storage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

export function moveBackup(storage: BackupStorage | null, from: string | null, to: string | null): void {
  const b = readBackup(storage, from);
  clearBackup(storage, from);
  if (b) writeBackup(storage, to, b);
}

const differsFrom = (server: Newsletter, backup: DraftBackup): boolean =>
  Object.keys(changedFields(draftFromNewsletter(server), backup.draft)).length > 0;

/**
 * The copy worth offering as "Restore unsaved changes", or null. It must differ from what the server has and be
 * made on top of exactly the server's current version (same updated_at). The browser clock is never compared with
 * the server's: a copy made on another version is not offered (the caller forgets it).
 */
export function backupToOffer(backup: DraftBackup | null, server: Newsletter | null): DraftBackup | null {
  if (!backup) return null;
  if (!server) {
    const changed = changedFields(emptyDraft(backup.draft.header), backup.draft) as Record<string, unknown>;
    return Object.keys(changed).length > 0 ? backup : null;
  }
  const sameBase = backup.baseUpdatedAt !== null && backup.baseUpdatedAt === server.updated_at;
  return sameBase && differsFrom(server, backup) ? backup : null;
}

export type OfferedBackup = DraftBackup & { olderBase?: boolean };

/**
 * After a stale save and Reload: this tab's edits, made on an older version, are still offered (marked olderBase,
 * so the notice says restoring replaces the other tab's changes) instead of being thrown away.
 */
export function staleBackupToOffer(backup: DraftBackup | null, server: Newsletter): OfferedBackup | null {
  if (!backup || !differsFrom(server, backup)) return null;
  return { ...backup, olderBase: backup.baseUpdatedAt !== server.updated_at };
}
