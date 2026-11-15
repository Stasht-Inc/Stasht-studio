import { useEffect } from 'react';
import { apiRequest, getApiBaseUrl } from '../utils/authUtils';
import { PRESENCE_IDLE_MS, isPresenceActive } from '../utils/presenceActivity';

// The server counts someone as online for 90 s after a beat.
const BEAT_EVERY_MS = 60_000;
// Only what a person does: no 'scroll' or 'focus', which the app and the browser fire on their own.
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
// Another Studio tab closed and told the server "offline": the tabs still open beat at once (they are still here).
const OFFLINE_SIGNAL_KEY = 'stasht_presence_offline_at';

/**
 * Studio is closing (tab / app window, Chris 10 Nov 2026): drop off the website widget at once rather than 90 s later.
 * fetch keepalive (sendBeacon can't send the bearer token). Never throws.
 */
export function sendPresenceOffline(): void {
  try {
    const token = localStorage.getItem('stasht_token');
    if (!token) return;
    fetch(`${getApiBaseUrl()}/presence/offline`, {
      method: 'POST',
      keepalive: true,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => {});
    localStorage.setItem(OFFLINE_SIGNAL_KEY, String(Date.now()));
  } catch {
    /* storage blocked / page going away */
  }
}

/**
 * Tells the server this person has Studio open, so the Contact Us widget on their
 * dealership's website can show them as online. Only beats while the tab is visible AND in use (an interaction within
 * PRESENCE_IDLE_MS); says "offline" when it goes idle and when the tab or app window closes (signing out does it on
 * the server).
 */
export function usePresenceHeartbeat(active: boolean) {
  useEffect(() => {
    if (!active) return;

    let lastActivityAt = Date.now();
    let idle = false;

    const beat = () => {
      if (!isPresenceActive(document.visibilityState === 'visible', lastActivityAt, Date.now())) return;
      apiRequest('/presence/heartbeat', { method: 'POST', body: '{}' }).catch(() => {});
    };

    // Each minute: still in use → beat; just went idle → say "offline" once (other tabs in use beat back at once).
    const tick = () => {
      if (!idle && Date.now() - lastActivityAt >= PRESENCE_IDLE_MS) {
        idle = true;
        sendPresenceOffline();
        return;
      }
      beat();
    };

    // Back from idle: online again at once rather than on the next tick.
    const onActivity = () => {
      lastActivityAt = Date.now();
      if (idle) {
        idle = false;
        beat();
      }
    };

    const onStorage = (e: StorageEvent) => { if (e.key === OFFLINE_SIGNAL_KEY) beat(); };
    // Switching to the tab is someone using it.
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      lastActivityAt = Date.now();
      idle = false;
      beat();
    };

    beat();
    const timer = window.setInterval(tick, BEAT_EVERY_MS);
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', sendPresenceOffline);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity, { capture: true }));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', sendPresenceOffline);
      window.removeEventListener('storage', onStorage);
    };
  }, [active]);
}
