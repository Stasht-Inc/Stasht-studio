import { useCallback, useEffect, useRef, useState } from 'react';
import { newslettersAPI, type Newsletter, type NewsletterHeader } from '../../../services/newslettersAPI';
import { GENERIC_ERROR, type NlResult } from '../lib/apiResult';
import { createAutosaver, type Autosaver } from '../lib/autosave';
import { changedFields, draftFromNewsletter, emptyDraft, headerFrom, type NewsletterDraft } from '../lib/draft';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
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
  update(patch: Partial<NewsletterDraft>): void;
  /** Save now, creating the draft if needed. */
  saveNow(): Promise<SaveOutcome>;
  /** Finish any pending save; resolves with the newsletter if one exists. */
  flush(): Promise<Newsletter | null>;
  /** Take the copy the server returned from send / schedule / cancel. */
  adopt(n: Newsletter): void;
  setFieldErrors(errors: Record<string, string>): void;
}

const AUTOSAVE_DELAY_MS = 800;

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
  const touchedRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);
  const brandHeaderRef = useRef(brandHeader);
  brandHeaderRef.current = brandHeader;

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
    if (readOnlyRef.current) return;
    const current = draftRef.current;
    setSaveState('saving');
    if (!idRef.current) {
      const created = await newslettersAPI.create(current.name.trim() || undefined);
      if (!created.ok || !created.data) { fail(created); return; }
      take(created.data, false);
      savedRef.current = draftFromNewsletter(created.data);
    }
    const patch = changedFields(savedRef.current, current);
    if (Object.keys(patch).length > 0) {
      const res = await newslettersAPI.update(idRef.current as number, patch);
      if (!res.ok || !res.data) { fail(res); return; }
      savedRef.current = current;
      take(res.data, false);
    }
    lastErrorRef.current = null;
    setSaveState('saved');
    setSaveError(null);
    setFieldErrors({});
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
    touchedRef.current = false;
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
    if (!brandHeader || idRef.current || touchedRef.current) return;
    const next = { ...draftRef.current, header: headerFrom(brandHeader) };
    draftRef.current = next;
    setDraft(next);
  }, [brandHeader]);

  // Save what's pending when the composer goes away.
  useEffect(() => () => { void saverRef.current?.flush(); }, []);

  const update = useCallback((patch: Partial<NewsletterDraft>) => {
    if (readOnlyRef.current) return;
    touchedRef.current = true;
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

  const flush = useCallback(async () => {
    await saverRef.current?.flush();
    return newsletterRef.current;
  }, []);

  const adopt = useCallback((n: Newsletter) => take(n, true), [take]);

  return {
    loading, loadError, newsletter, draft, readOnly, saveState, saveError, fieldErrors, planRequired,
    update, saveNow, flush, adopt, setFieldErrors,
  };
}
