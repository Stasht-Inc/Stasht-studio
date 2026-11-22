import { useCallback, useEffect, useRef, useState } from 'react';
import { newslettersAPI, type RemovedItem } from '../../../services/newslettersAPI';
import { GENERIC_ERROR } from '../lib/apiResult';

export interface HtmlDocumentPreviewState {
  /** The email exactly as people get it (the API's preview: the cleaned template and our footer), or null. */
  html: string | null;
  sizeKb: number | null;
  removed: RemovedItem[];
  loading: boolean;
  error: string | null;
  reload(): void;
}

const DEBOUNCE_MS = 350;

/**
 * Chris 22 Nov 2026 (Q4): the live preview of an HTML newsletter is the API's own email (POST /newsletters/{id}/preview),
 * fetched again after every save (savedAt: the saved copy's updated_at), so it shows exactly what will be sent — the
 * template as the API cleaned it, with the footer and unsubscribe link — and what the cleaning removed. The last
 * preview stays on screen while the next one loads; an answer for an older save is ignored.
 */
export function useHtmlDocumentPreview(newsletterId: number | null, savedAt: string | null, enabled: boolean): HtmlDocumentPreviewState {
  const [html, setHtml] = useState<string | null>(null);
  const [sizeKb, setSizeKb] = useState<number | null>(null);
  const [removed, setRemoved] = useState<RemovedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!enabled || !newsletterId) {
      requestRef.current += 1; // an answer still on its way is for nothing on screen now
      setLoading(false);
      return undefined;
    }
    const request = ++requestRef.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void newslettersAPI.preview(newsletterId).then((res) => {
        if (request !== requestRef.current) return;
        setLoading(false);
        if (res.ok && typeof res.data?.html === 'string') {
          setHtml(res.data.html);
          setSizeKb(typeof res.data.size_kb === 'number' && Number.isFinite(res.data.size_kb) ? res.data.size_kb : null);
          setRemoved(Array.isArray(res.data.removed) ? res.data.removed : []);
          setError(null);
        } else {
          setError(res.error ?? GENERIC_ERROR);
        }
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [newsletterId, savedAt, enabled, attempt]);

  // Another newsletter, or HTML switched off: nothing from before is shown.
  useEffect(() => {
    setHtml(null);
    setSizeKb(null);
    setRemoved([]);
    setError(null);
  }, [newsletterId]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { html, sizeKb, removed, loading, error, reload };
}
