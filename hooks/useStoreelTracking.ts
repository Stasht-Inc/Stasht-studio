import { useEffect, useMemo, useRef } from 'react';
import { API_BASE_URL } from '../utils/authUtils';

type StoreelBeaconEvent = 'opened' | 'view_depth' | 'cta_clicked';

interface StoreelBeaconPayload {
  token: string;
  open_id: string;
  event: StoreelBeaconEvent;
  depth_pct?: number;
  moment_index?: number;
  dwell_seconds?: number;
  widget_id?: number | string;
}

const BEACON_URL = `${API_BASE_URL}/storeels/beacon`;
// Mirrors config('storeels.depth_milestones') on the backend — keep in sync.
const DEPTH_MILESTONES = [25, 50, 75, 100];

// Public, unauthenticated, fire-and-forget — a beacon failure must never
// surface to the visitor (matches StoreelBeaconController, which always
// returns 204 even when it silently drops an event internally).
function fireBeacon(payload: StoreelBeaconPayload, useSendBeacon = false): void {
  try {
    const body = JSON.stringify(payload);
    if (useSendBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(BEACON_URL, new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch(BEACON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never throw into a render/event-handler path over an analytics beacon
  }
}

/**
 * Wires the Storeel viewer beacon (spec §5.3/5.4) into a published-memory
 * page. No-ops entirely when sendToken is empty (organic/non-tracked visits —
 * the backend no-ops on an unknown token too, this just skips the network
 * calls). Fires:
 *  - `opened` once, on mount.
 *  - `view_depth` (milestone-only, no dwell_seconds) each time forward
 *    scroll progress crosses 25/50/75/100% of the moments in the timeline —
 *    driven by whichever moment index is currently visible, not raw pixel
 *    scroll, so it matches "moment milestones" per spec.
 *  - a single dwell-only `view_depth` beacon (dwell_seconds, no depth_pct)
 *    on the first tab-hide/page-exit — sent via sendBeacon for delivery
 *    during unload. Deliberately never combined with a depth_pct milestone:
 *    the backend dedupes on provider_ref, and a combined call would collide
 *    with an already-recorded milestone at that same depth_pct (see
 *    docs/storeel-measurement-deploy.md §7). Also deliberately sent only
 *    once per page life (not on every tab-switch) — the backend would drop
 *    a second one anyway (same open_id ⇒ same provider_ref), so sending
 *    once on first hide gets the most representative number for free.
 */
export function useStoreelTracking(
  sendToken: string | null | undefined,
  activeMomentIndex: number,
  totalMoments: number
) {
  const openId = useMemo(
    () => (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    []
  );
  const openedFiredRef = useRef(false);
  const milestonesFiredRef = useRef<Set<number>>(new Set());
  const maxIndexRef = useRef<number>(-1);
  const startedAtRef = useRef<number>(0);
  const dwellSentRef = useRef(false);

  useEffect(() => {
    if (!sendToken) return;
    startedAtRef.current = Date.now();
    if (!openedFiredRef.current) {
      openedFiredRef.current = true;
      fireBeacon({ token: sendToken, open_id: openId, event: 'opened' });
    }

    const sendDwell = () => {
      if (dwellSentRef.current) return;
      dwellSentRef.current = true;
      const dwellSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
      if (dwellSeconds <= 0) return;
      fireBeacon(
        { token: sendToken, open_id: openId, event: 'view_depth', dwell_seconds: dwellSeconds },
        true
      );
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') sendDwell();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', sendDwell);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', sendDwell);
    };
  }, [sendToken, openId]);

  useEffect(() => {
    if (!sendToken || totalMoments <= 0 || activeMomentIndex < 0) return;
    if (activeMomentIndex <= maxIndexRef.current) return; // only fire on forward progress
    maxIndexRef.current = activeMomentIndex;
    const pct = Math.round(((activeMomentIndex + 1) / totalMoments) * 100);
    DEPTH_MILESTONES.forEach((milestone) => {
      if (pct >= milestone && !milestonesFiredRef.current.has(milestone)) {
        milestonesFiredRef.current.add(milestone);
        fireBeacon({
          token: sendToken,
          open_id: openId,
          event: 'view_depth',
          depth_pct: milestone,
          moment_index: activeMomentIndex,
        });
      }
    });
  }, [sendToken, openId, activeMomentIndex, totalMoments]);

  const trackCtaClick = (widgetId?: number | string) => {
    if (!sendToken) return;
    fireBeacon({ token: sendToken, open_id: openId, event: 'cta_clicked', widget_id: widgetId });
  };

  return { trackCtaClick };
}
