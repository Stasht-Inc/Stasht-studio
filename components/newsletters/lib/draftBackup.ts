// A copy of the draft in this browser, so a lost connection or a closed tab never loses work. Every storage call
// is wrapped: private windows, full storage or blocked site data just mean no backup.
import type { Newsletter } from '../../../services/newslettersAPI.ts';
import { changedFields, draftFromNewsletter, emptyDraft, type NewsletterDraft } from './draft.ts';

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

export function backupKey(userId: number | string | null | undefined, newsletterId: number | null): string {
  return `stasht_nl_backup:${userId || 0}:${newsletterId ?? 'new'}`;
}

/** The browser's localStorage, or null when it can't be reached. */
export function browserStorage(): BackupStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readBackup(storage: BackupStorage | null, key: string): DraftBackup | null {
  if (!storage) return null;
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

export function writeBackup(storage: BackupStorage | null, key: string, backup: DraftBackup): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(backup));
  } catch {
    // No room or not allowed: carry on without a backup.
  }
}

export function clearBackup(storage: BackupStorage | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

export function moveBackup(storage: BackupStorage | null, from: string, to: string): void {
  const b = readBackup(storage, from);
  clearBackup(storage, from);
  if (b) writeBackup(storage, to, b);
}

/**
 * The copy worth offering as "Restore unsaved changes", or null. It must differ from what the server has, and be
 * newer: made on top of the server's current version, or written after the server's last change.
 */
export function backupToOffer(backup: DraftBackup | null, server: Newsletter | null): DraftBackup | null {
  if (!backup) return null;
  if (!server) {
    const changed = changedFields(emptyDraft(backup.draft.header), backup.draft) as Record<string, unknown>;
    return Object.keys(changed).length > 0 ? backup : null;
  }
  if (Object.keys(changedFields(draftFromNewsletter(server), backup.draft)).length === 0) return null;
  const serverTime = Date.parse(server.updated_at);
  const sameBase = backup.baseUpdatedAt !== null && backup.baseUpdatedAt === server.updated_at;
  return sameBase || !Number.isFinite(serverTime) || backup.savedAt > serverTime ? backup : null;
}
