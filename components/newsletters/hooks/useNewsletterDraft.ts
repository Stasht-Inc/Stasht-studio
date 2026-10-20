import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { newslettersAPI, type Newsletter, type NewsletterHeader } from '../../../services/newslettersAPI';
import { GENERIC_ERROR, type NlResult } from '../lib/apiResult';
import { createAutosaver, type Autosaver } from '../lib/autosave';
import { draftFromNewsletter, emptyDraft, headerFrom, mergeUntouched, rejectedKeys, savableChanges, type NewsletterDraft } from '../lib/draft';

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

export function useNewsletterDraft(newsletterId: number | null, enabled: boolean, brandHeader: NewsletterHeader | null): NewsletterDraftState {
  const [loading, setLoading] = useState<boolean>(Boolean(newsletterId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [draft, setDraft] = useState<NewsletterDraft>(() => emptyDraft(brandHeader));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [planRequired, setPlanRequired] = useState(false);

  const draftRef = useRef(draft);
  const savedRef = useRef<NewsletterDraft | null>(null);
  const idRef = useRef<number | null>(newsletterId);
  const newsletterRef = useRef<Newsletter | null>(null);
  // The fields the person has changed. After the draft is created, every other field takes the server's default.
  const touchedRef = useRef<Set<string>>(new Set());
  const lastErrorRef = useRef<string | null>(null);
  // Fields a PUT answered 422 for, with the value that was refused and its messages. While the value stays the
  // same it is left out of every save (still dirty, its message still showing), so one bad field never blocks
  // the others; a new value is sent again.
  const rejectedRef = useRef(new Map<string, { value: string; errors: Record<string, string> }>());
  const discardedRef = useRef(false);
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

  const fail = useCallback((res: NlResult<unknown>) => {
    lastErrorRef.current = res.error ?? GENERIC_ERROR;
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
    if (readOnlyRef.current || !enabledRef.current) return;
    setSaveState('saving');
    if (!idRef.current) {
      const created = await newslettersAPI.create(draftRef.current.name.trim() || undefined);
      if (!created.ok || !created.data) { fail(created); return; }
      take(created.data, false);
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
      let res = await newslettersAPI.update(idRef.current as number, body);
      // A 422 on some fields: hold those back and save the rest once more.
      const refused = !res.ok && !res.conflict && !res.planRequired ? rejectedKeys(body, res.fieldErrors) : [];
      if (refused.length) {
        for (const key of refused) {
          const errors = Object.fromEntries(Object.entries(res.fieldErrors).filter(([k]) => k.split('.')[0] === key));
          rejected.set(key, { value: JSON.stringify(body[key]), errors });
          holdBack(key);
        }
        if (Object.keys(body).length > 0) res = await newslettersAPI.update(idRef.current as number, body);
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
    setSaveState('saved');
    setSaveError(null);
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
      return undefined;
    }
    setLoading(true);
    newslettersAPI.get(newsletterId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok && res.data) take(res.data, true);
      else {
        setLoadError(res.error ?? GENERIC_ERROR);
        if (res.planRequired) setPlanRequired(true);
      }
    });
    return () => { cancelled = true; };
  }, [newsletterId, enabled, take]);

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
  }, []);

  const adopt = useCallback((n: Newsletter) => take(n, true), [take]);

  return {
    loading, loadError, newsletter, draft, readOnly, saveState, saveError, fieldErrors, planRequired,
    update, saveNow, flush, discard, adopt, setFieldErrors,
  };
}
