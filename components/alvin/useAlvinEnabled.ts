import { useEffect, useState } from 'react';
import { apiRequest } from '../../utils/authUtils';

// Whether Alvin is switched on for the signed-in account (web API ALVIN_ENABLED_FOR). Asked once per
// sign-in and shared by the top-bar button and the account menu; off until the answer arrives.
let cached: { token: string | null; result: Promise<boolean> } | null = null;

function alvinEnabled(): Promise<boolean> {
  const token = localStorage.getItem('stasht_token');
  if (!cached || cached.token !== token) {
    const result = apiRequest<{ data?: { enabled?: boolean } }>('/alvin/status', { method: 'GET', skipCache: true } as RequestInit)
      .then((res) => !!(res.success && res.data?.data?.enabled))
      .catch(() => false);
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
