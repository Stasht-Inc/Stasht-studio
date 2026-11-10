import { useEffect } from 'react';
import { apiRequest, getApiBaseUrl } from '../utils/authUtils';

// The server counts someone as online for 90 s after a beat.
const BEAT_EVERY_MS = 60_000;
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
 * dealership's website can show them as online. Only beats while the tab is visible; says "offline" when the tab or
 * app window closes (signing out does it on the server).
 */
export function usePresenceHeartbeat(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      apiRequest('/presence/heartbeat', { method: 'POST', body: '{}' }).catch(() => {});
    };

    const onStorage = (e: StorageEvent) => { if (e.key === OFFLINE_SIGNAL_KEY) beat(); };

    beat();
    const timer = window.setInterval(beat, BEAT_EVERY_MS);
    document.addEventListener('visibilitychange', beat);
    window.addEventListener('pagehide', sendPresenceOffline);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
      window.removeEventListener('pagehide', sendPresenceOffline);
      window.removeEventListener('storage', onStorage);
    };
  }, [active]);
}
