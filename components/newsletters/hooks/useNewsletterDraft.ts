import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { newslettersAPI, type Newsletter, type NewsletterHeader } from '../../../services/newslettersAPI';
import { GENERIC_ERROR, retryableSaveFailure, type NlResult } from '../lib/apiResult';
import { createAutosaver, type Autosaver } from '../lib/autosave';
import { changedFields, draftFromNewsletter, emptyDraft, headerFrom, mergeUntouched, rejectedKeys, savableChanges, type NewsletterDraft } from '../lib/draft';
import { backupKey, backupToOffer, browserStorage, clearBackup, readBackup, staleBackupToOffer, writeBackup, type OfferedBackup } from '../lib/draftBackup';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type DraftPatch = Partial<NewsletterDraft> | ((latest: NewsletterDraft) => Partial<NewsletterDraft> | null);
export interface SaveOutcome { newsletter: Newsletter | null; error: string | null }

export interface NewsletterDraftState {
  loading: boolean;
  loadError: string | null;
  /** The last copy the server returned (null until the draft exists). */
  newsletter: Newsletter | null;
  draft: NewsletterDraft;
  /** Anything but a draft opens read-only (the API answers 409 to edits). */
  readOnly: boolean;
  saveState: SaveState;
  saveError: string | null;
  fieldErrors: Record<string, string>;
  planRequired: boolean;
  /** The draft was saved from another tab or device: saving stops until reload(). */
  stale: boolean;
  /** A failed save that "Try again" can help with (not a held field, not stale). */
  canRetry: boolean;
  /** A copy of this draft kept in this browser (a save that never reached the server). olderBase: made before
   *  the newsletter was changed elsewhere (offered after a stale Reload). */
  restoreOffer: OfferedBackup | null;
  /** Put the kept copy back (it then saves as usual). */
  restore(): void;
  /** Forget the kept copy. */
  dismissRestore(): void;
  /** Try the failed save again now. */
  retry(): void;
  /** Load the server's latest copy (after a stale save). */
  reload(): Promise<void>;
  /** A patch, or a function of the latest draft (null: nothing to change). Use the function form from anything
   *  that finishes later (an upload) or acts on one section, so it never merges a stale copy over newer edits. */
  update(patch: DraftPatch): void;
  /** Save now, creating the draft if needed. */
  saveNow(): Promise<SaveOutcome>;
  /** Finish any pending save. `error` is set when something is still not saved (a failed save, or a field
   *  held back because it would not pass). */
  flush(): Promise<SaveOutcome>;
  /** Forget unsaved changes (the person chose "Discard changes"): nothing more is saved, even on unmount. */
  discard(): void;
  /** Take the copy the server returned from send / schedule / cancel. */
  adopt(n: Newsletter): void;
  setFieldErrors(errors: Record<string, string>): void;
}

const AUTOSAVE_DELAY_MS = 800;
export const HELD_ERROR = 'Fix the fields marked in red so they can be saved.';
export const UNMOUNT_SAVE_ERROR = 'Your latest newsletter changes could not be saved. Open the draft from Campaigns › Newsletters to check it.';
export const SAVE_FAILED_ERROR = "Your latest changes couldn't be saved just now. They're kept on this device.";
export const OFFLINE_ERROR = "You're offline. Your changes are kept on this device and will save when you're back online.";

function currentUserId(): number | string | null {
  try {
    const raw = window.localStorage.getItem('stasht_user');
    const user = raw ? JSON.parse(raw) : null;
    return user && (typeof user.id === 'number' || typeof user.id === 'string') ? user.id : null;
  } catch {
    return null;
  }
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export function useNewsletterDraft(newsletterId: number | null, enabled: boolean, brandHeader: NewsletterHeader | null): NewsletterDraftState {
  const [loading, setLoading] = useState<boolean>(Boolean(newsletterId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [draft, setDraft] = useState<NewsletterDraft>(() => emptyDraft(brandHeader));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [planRequired, setPlanRequired] = useState(false);
  const [stale, setStale] = useState(false);
  const [restoreOffer, setRestoreOffer] = useState<OfferedBackup | null>(null);

  const draftRef = useRef(draft);
  const savedRef = useRef<NewsletterDraft | null>(null);
  const idRef = useRef<number | null>(newsletterId);
  const newsletterRef = useRef<Newsletter | null>(null);
  // The fields the person has changed. After the draft is created, every other field takes the server's default.
  const touchedRef = useRef<Set<string>>(new Set());
  const lastErrorRef = useRef<string | null>(null);
  // The last failed save was a lost connection or a server error: worth trying again by itself (review fix 10).
  const retryableRef = useRef(false);
  // Fields a PUT answered 422 for, with the value that was refused and its messages. While the value stays the
  // same it is left out of every save (still dirty, its message still showing), so one bad field never blocks
  // the others; a new value is sent again.
  const rejectedRef = useRef(new Map<string, { value: string; errors: Record<string, string> }>());
  const discardedRef = useRef(false);
  const staleRef = useRef(false);
  const storageRef = useRef(browserStorage());
  const userIdRef = useRef(currentUserId());
  const brandHeaderRef = useRef(brandHeader);
  brandHeaderRef.current = brandHeader;
  // Not enabled (plan unknown or Starter): never call the API, whatever happens (contract note 1).
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const readOnly = newsletter !== null && newsletter.status !== 'draft';
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;

  const take = useCallback((n: Newsletter, resetDraft: boolean) => {
    newsletterRef.current = n;
    idRef.current = n.id;
    setNewsletter(n);
    if (resetDraft) {
      const d = draftFromNewsletter(n);
      savedRef.current = d;
      draftRef.current = d;
      setDraft(d);
    }
  }, []);

  // After loading a draft: offer the copy kept in this browser if it is newer; forget one that isn't.
  const offerBackup = useCallback((n: Newsletter) => {
    const key = backupKey(userIdRef.current, n.id);
    const offer = n.status === 'draft' ? backupToOffer(readBackup(storageRef.current, key), n) : null;
    if (!offer) clearBackup(storageRef.current, key);
    setRestoreOffer(offer);
  }, []);

  const fail = useCallback((res: NlResult<unknown>) => {
    retryableRef.current = retryableSaveFailure(res);
    const plain = !res.stale && !res.conflict && !res.planRequired && Object.keys(res.fieldErrors).length === 0;
    // A server or connection failure: say what it means for the person's work, not "Server Error".
    const raw = res.error ?? GENERIC_ERROR;
    const serverSide = plain && (raw === GENERIC_ERROR || /^(server error|http \d+|internal server error)\.?$/i.test(raw.trim()));
    lastErrorRef.current = plain && isOffline() ? OFFLINE_ERROR : serverSide ? SAVE_FAILED_ERROR : raw;
    if (res.stale) {
      // Saved from another tab: stop saving (each save would be refused) until the person reloads.
      staleRef.current = true;
      setStale(true);
    }
    setSaveState('error');
    setSaveError(lastErrorRef.current);
    setFieldErrors(res.fieldErrors);
    if (res.planRequired) setPlanRequired(true);
    if (res.conflict && idRef.current) {
      // Sent or scheduled somewhere else: reload so the composer turns read-only.
      void newslettersAPI.get(idRef.current).then((r) => { if (r.ok && r.data) take(r.data, true); });
    }
  }, [take]);

  const run = useCallback(async () => {
    if (readOnlyRef.current || !enabledRef.current || staleRef.current) return;
    setSaveState('saving');
    if (!idRef.current) {
      const created = await newslettersAPI.create(draftRef.current.name.trim() || undefined);
      if (!created.ok || !created.data) { fail(created); return; }
      take(created.data, false);
      // The copy kept as "new" now belongs to this draft.
      clearBackup(storageRef.current, backupKey(userIdRef.current, null));
      writeBackup(storageRef.current, backupKey(userIdRef.current, created.data.id), { draft: draftRef.current, savedAt: Date.now(), baseUpdatedAt: created.data.updated_at });
      const server = draftFromNewsletter(created.data);
      savedRef.current = server;
      // Show the server's defaults (name, from name, reply-to, header) in every field not touched yet.
      const merged = mergeUntouched(draftRef.current, server, touchedRef.current);
      draftRef.current = merged;
      setDraft(merged);
    }
    const current = draftRef.current;
    const saved = savedRef.current as NewsletterDraft;
    // A field that would not pass (a half-typed reply-to) stays out of the patch, so the rest still saves.
    const { patch, nextSaved, held } = savableChanges(saved, current);
    const body = patch as Record<string, unknown>;
    const next = nextSaved as unknown as Record<string, unknown>;
    const holdBack = (key: string) => {
      delete body[key];
      next[key] = (saved as unknown as Record<string, unknown>)[key];
      held.push(key as keyof NewsletterDraft);
    };
    const rejected = rejectedRef.current;
    for (const [key, r] of [...rejected]) {
      if (!(key in body)) rejected.delete(key); // back to the saved value
      else if (JSON.stringify(body[key]) === r.value) holdBack(key); // still the refused value
      else rejected.delete(key); // changed: try it again
    }
    if (Object.keys(body).length > 0) {
      let res = await newslettersAPI.update(idRef.current as number, body, newsletterRef.current?.updated_at);
      // A 422 on some fields: hold those back and save the rest once more.
      const refused = !res.ok && !res.conflict && !res.planRequired ? rejectedKeys(body, res.fieldErrors) : [];
      if (refused.length) {
        for (const key of refused) {
          const errors = Object.fromEntries(Object.entries(res.fieldErrors).filter(([k]) => k.split('.')[0] === key));
          rejected.set(key, { value: JSON.stringify(body[key]), errors });
          holdBack(key);
        }
        if (Object.keys(body).length > 0) res = await newslettersAPI.update(idRef.current as number, body, newsletterRef.current?.updated_at);
        else res = { ok: true, data: newsletterRef.current ?? undefined, fieldErrors: {} };
      }
      if (!res.ok || !res.data) { fail(res); return; }
      take(res.data, false);
    }
    savedRef.current = nextSaved;
    setFieldErrors(Object.assign({}, ...[...rejected.values()].map((r) => r.errors)));
    if (held.length) {
      lastErrorRef.current = HELD_ERROR;
      setSaveState('error');
      setSaveError(HELD_ERROR);
      return;
    }
    lastErrorRef.current = null;
    retryableRef.current = false;
    setSaveState('saved');
    setSaveError(null);
    // Everything on screen is on the server now: the kept copy is no longer needed.
    if (Object.keys(changedFields(nextSaved, draftRef.current)).length === 0) clearBackup(storageRef.current, backupKey(userIdRef.current, idRef.current));
  }, [fail, take]);

  const runRef = useRef(run);
  runRef.current = run;
  const saverRef = useRef<Autosaver | null>(null);
  if (!saverRef.current) saverRef.current = createAutosaver({ delayMs: AUTOSAVE_DELAY_MS, run: () => runRef.current() });

  // Open an existing newsletter, or start a new one.
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    idRef.current = newsletterId;
    savedRef.current = null;
    newsletterRef.current = null;
    touchedRef.current = new Set();
    lastErrorRef.current = null;
    rejectedRef.current = new Map();
    discardedRef.current = false;
    staleRef.current = false;
    setStale(false);
    setRestoreOffer(null);
    userIdRef.current = currentUserId();
    const fresh = emptyDraft(brandHeaderRef.current);
    draftRef.current = fresh;
    setDraft(fresh);
    setNewsletter(null);
    setFieldErrors({});
    setSaveState('idle');
    setSaveError(null);
    setLoadError(null);
    if (!newsletterId) {
      setLoading(false);
      setRestoreOffer(backupToOffer(readBackup(storageRef.current, backupKey(userIdRef.current, null)), null));
      return undefined;
    }
    setLoading(true);
    newslettersAPI.get(newsletterId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok && res.data) {
        take(res.data, true);
        offerBackup(res.data);
      } else {
        setLoadError(res.error ?? GENERIC_ERROR);
        if (res.planRequired) setPlanRequired(true);
      }
    });
    return () => { cancelled = true; };
  }, [newsletterId, enabled, take, offerBackup]);

  // A new, untouched draft takes the account's last header when the brand arrives.
  useEffect(() => {
    if (!brandHeader || idRef.current || touchedRef.current.has('header')) return;
    const next = { ...draftRef.current, header: headerFrom(brandHeader) };
    draftRef.current = next;
    setDraft(next);
  }, [brandHeader]);

  // Save what's pending when the composer goes away (the Storeel tab's X closes Create Campaign without our
  // Cancel). There is no screen left to ask on, so say so in a toast if it can't be saved.
  useEffect(() => () => {
    const saver = saverRef.current;
    if (discardedRef.current || !saver || (!saver.pending && !lastErrorRef.current)) return;
    // A save that failed earlier is tried once more too.
    if (lastErrorRef.current) saver.schedule();
    void saver.flush().then(() => {
      if (lastErrorRef.current && !discardedRef.current) toast.error(UNMOUNT_SAVE_ERROR);
    });
  }, []);

  const update = useCallback((change: DraftPatch) => {
    if (readOnlyRef.current) return;
    const patch = typeof change === 'function' ? change(draftRef.current) : change;
    if (!patch || Object.keys(patch).length === 0) return;
    for (const key of Object.keys(patch)) touchedRef.current.add(key);
    discardedRef.current = false;
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    writeBackup(storageRef.current, backupKey(userIdRef.current, idRef.current), { draft: next, savedAt: Date.now(), baseUpdatedAt: newsletterRef.current?.updated_at ?? null });
    saverRef.current?.schedule();
  }, []);

  const saveNow = useCallback(async (): Promise<SaveOutcome> => {
    if (readOnlyRef.current) return { newsletter: newsletterRef.current, error: null };
    saverRef.current?.schedule();
    await saverRef.current?.flush();
    return lastErrorRef.current
      ? { newsletter: null, error: lastErrorRef.current }
      : { newsletter: newsletterRef.current, error: newsletterRef.current ? null : GENERIC_ERROR };
  }, []);

  const flush = useCallback(async (): Promise<SaveOutcome> => {
    // After a failed save, closing tries once more before saying the changes aren't saved.
    if (lastErrorRef.current && !readOnlyRef.current) saverRef.current?.schedule();
    await saverRef.current?.flush();
    return { newsletter: newsletterRef.current, error: readOnlyRef.current ? null : lastErrorRef.current };
  }, []);

  const discard = useCallback(() => {
    discardedRef.current = true;
    saverRef.current?.cancel();
    clearBackup(storageRef.current, backupKey(userIdRef.current, idRef.current));
  }, []);

  const adopt = useCallback((n: Newsletter) => {
    take(n, true);
    if (n.status !== 'draft') clearBackup(storageRef.current, backupKey(userIdRef.current, n.id));
  }, [take]);

  const restore = useCallback(() => {
    const offer = restoreOffer;
    setRestoreOffer(null);
    if (!offer) return;
    const current = draftRef.current as unknown as Record<string, unknown>;
    const kept = offer.draft as unknown as Record<string, unknown>;
    const patch = Object.fromEntries(Object.keys(kept).filter((k) => JSON.stringify(kept[k]) !== JSON.stringify(current[k])).map((k) => [k, kept[k]]));
    update(patch as Partial<NewsletterDraft>);
  }, [restoreOffer, update]);

  const dismissRestore = useCallback(() => {
    setRestoreOffer(null);
    // Edits made since opening are a fresh copy worth keeping.
    if (touchedRef.current.size === 0) clearBackup(storageRef.current, backupKey(userIdRef.current, idRef.current));
  }, []);

  const retry = useCallback(() => {
    const saver = saverRef.current;
    if (!saver || readOnlyRef.current || staleRef.current) return;
    saver.schedule();
    void saver.flush();
  }, []);

  const reload = useCallback(async () => {
    const id = idRef.current;
    if (!id) return;
    const res = await newslettersAPI.get(id);
    if (!res.ok || !res.data) {
      setSaveError(res.error ?? GENERIC_ERROR);
      return;
    }
    saverRef.current?.cancel();
    staleRef.current = false;
    setStale(false);
    touchedRef.current = new Set();
    rejectedRef.current = new Map();
    lastErrorRef.current = null;
    setFieldErrors({});
    setSaveState('idle');
    setSaveError(null);
    // The edits this tab couldn't save were made on the older version: keep them on offer, with a warning,
    // instead of throwing them away (review fix 6). Read before take(): nothing here writes the copy.
    const kept = staleBackupToOffer(readBackup(storageRef.current, backupKey(userIdRef.current, id)), res.data);
    take(res.data, true);
    setRestoreOffer(kept);
  }, [take]);

  // A failed save tries again by itself when the connection comes back or the person returns to the tab.
  useEffect(() => {
    if (!enabled) return undefined;
    const again = () => {
      if (!lastErrorRef.current || lastErrorRef.current === HELD_ERROR || staleRef.current || discardedRef.current || !retryableRef.current) return;
      retry();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') again(); };
    window.addEventListener('online', again);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', again);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, retry]);

  // Closing or reloading the browser tab while a save is on its way, or after one failed: the browser asks first.
  useEffect(() => {
    if (!enabled) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const saver = saverRef.current;
      if (readOnlyRef.current || discardedRef.current || !saver) return;
      if (!saver.pending && !lastErrorRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [enabled]);

  const canRetry = saveState === 'error' && !stale && saveError !== HELD_ERROR;

  return {
    loading, loadError, newsletter, draft, readOnly, saveState, saveError, fieldErrors, planRequired,
    stale, canRetry, restoreOffer, restore, dismissRestore, retry, reload,
    update, saveNow, flush, discard, adopt, setFieldErrors,
  };
}
