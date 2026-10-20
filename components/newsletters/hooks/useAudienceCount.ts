import { useEffect, useState } from 'react';
import { newslettersAPI, type AudienceCount, type AudienceItem, type NewsletterChannel } from '../../../services/newslettersAPI';
import { ZERO_COUNT } from '../lib/audience';

export interface AudienceCountState {
  counts: AudienceCount | null;
  loading: boolean;
  error: string | null;
}

/** Quiet time after the last change before asking again (the endpoint resolves every list: keep calls rare). */
export const AUDIENCE_COUNT_DELAY_MS = 450;

/**
 * Live "Estimated recipients" (POST /newsletters/audience-count), AUDIENCE_COUNT_DELAY_MS after the last change.
 * `enabled` must be false unless the Newsletter tab is showing on a paid plan (contract note 1).
 */
export function useAudienceCount(audience: AudienceItem[], channels: NewsletterChannel[], enabled: boolean): AudienceCountState {
  const [state, setState] = useState<AudienceCountState>({ counts: null, loading: false, error: null });
  const key = JSON.stringify([audience, [...channels].sort()]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!audience.length || !channels.length) {
      setState({ counts: ZERO_COUNT, loading: false, error: null });
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    const timer = setTimeout(async () => {
      const res = await newslettersAPI.audienceCount(audience, channels);
      if (cancelled) return;
      setState(res.ok && res.data
        ? { counts: res.data, loading: false, error: null }
        : { counts: null, loading: false, error: res.error ?? 'Recipients could not be counted right now.' });
    }, AUDIENCE_COUNT_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
