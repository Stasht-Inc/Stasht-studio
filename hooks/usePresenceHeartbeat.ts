import { useEffect } from 'react';
import { apiRequest } from '../utils/authUtils';

// The server counts someone as online for 3 minutes after a beat.
const BEAT_EVERY_MS = 60_000;

/**
 * Tells the server this person has Studio open, so the Contact Us widget on their
 * dealership's website can show them as online. Only beats while the tab is visible.
 */
export function usePresenceHeartbeat(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      apiRequest('/presence/heartbeat', { method: 'POST', body: '{}' }).catch(() => {});
    };

    beat();
    const timer = window.setInterval(beat, BEAT_EVERY_MS);
    document.addEventListener('visibilitychange', beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [active]);
}
