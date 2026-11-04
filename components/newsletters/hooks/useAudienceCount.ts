import { useEffect, useRef, useState } from 'react';
import { newslettersAPI, type AudienceCount, type AudienceItem, type NewsletterChannel } from '../../../services/newslettersAPI';
import { ZERO_COUNT } from '../lib/audience';

export interface AudienceCountState<X = undefined> {
  counts: AudienceCount | null;
  loading: boolean;
  error: string | null;
  /** What else the count endpoint answered (the Storeel flow's per-send cap and allowance). */
  extra?: X;
}

/** One count request: the counts, or why there are none. */
export type AudienceCountFetcher<X = undefined> = (audience: AudienceItem[], channels: NewsletterChannel[]) =>
  Promise<{ ok: boolean; data?: AudienceCount; extra?: X; error?: string }>;

/** Quiet time after the last change before asking again (the endpoint resolves every list: keep calls rare). */
export const AUDIENCE_COUNT_DELAY_MS = 450;

const newsletterCount: AudienceCountFetcher = async (audience, channels) => newslettersAPI.audienceCount(audience, channels);

/**
 * Live "Estimated recipients", AUDIENCE_COUNT_DELAY_MS after the last change. Newsletters: POST
 * /newsletters/audience-count, and `enabled` must be false unless the Newsletter tab is showing on a paid plan
 * (contract note 1). The Storeel flow passes its own fetcher (POST /memories/{id}/storeel-audience-count) and a
 * fetcherKey (the campaign) so another campaign is counted again.
 */
export function useAudienceCount<X = undefined>(
  audience: AudienceItem[], channels: NewsletterChannel[], enabled: boolean,
  fetcher?: AudienceCountFetcher<X>, fetcherKey: string | number = '',
): AudienceCountState<X> {
  const [state, setState] = useState<AudienceCountState<X>>({ counts: null, loading: false, error: null });
  const key = JSON.stringify([audience, [...channels].sort(), fetcherKey]);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return undefined;
    if (!audience.length || !channels.length) {
      setState({ counts: ZERO_COUNT, loading: false, error: null });
      return undefined;
    }
    let cancelled = false;
    // The old numbers are for other lists or channels: never show or check against them (null = not known yet).
    setState({ counts: null, loading: true, error: null });
    const timer = setTimeout(async () => {
      const run = (fetcherRef.current ?? newsletterCount) as AudienceCountFetcher<X>;
      const res = await run(audience, channels);
      if (cancelled) return;
      setState(res.ok && res.data
        ? { counts: res.data, loading: false, error: null, extra: res.extra }
        : { counts: null, loading: false, error: res.error ?? 'Recipients could not be counted right now.', extra: res.extra });
    }, AUDIENCE_COUNT_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
