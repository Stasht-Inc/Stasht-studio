import { useEffect, useState } from 'react';
import { apiRequest, isPartialAdmin } from '../../utils/authUtils';

// Whether Alvin is switched on for the signed-in account (web API ALVIN_ENABLED_FOR). Asked once per
// sign-in and shared by the top-bar button and the account menu; off until the answer arrives.
// Never for partial admins: they work with the owner's sign-in, so Alvin would act with the owner's
// full access (and show the owner's leads) rather than theirs.
let cached: { token: string | null; result: Promise<boolean> } | null = null;

function alvinEnabled(): Promise<boolean> {
  if (isPartialAdmin()) return Promise.resolve(false);
  const token = localStorage.getItem('stasht_token');
  if (!cached || cached.token !== token) {
    const result = apiRequest<{ data?: { enabled?: boolean } }>('/alvin/status', { method: 'GET', skipCache: true } as RequestInit)
      .then((res) => {
        if (!res.success) cached = null; // a failed check is asked again next time
        return !!(res.success && res.data?.data?.enabled);
      })
      .catch(() => {
        cached = null;
        return false;
      });
    cached = { token, result };
  }
  return cached.result;
}

export default function useAlvinEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    alvinEnabled().then((on) => live && setEnabled(on));
    return () => {
      live = false;
    };
  }, []);
  return enabled;
}
