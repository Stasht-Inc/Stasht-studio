import { useEffect, useState } from 'react';
import { apiRequest, isPartialAdmin } from '../../utils/authUtils';

// Alvin's status for the signed-in account (web API GET /alvin/status): whether it's switched on
// (ALVIN_ENABLED_FOR), whether they've used it (no first-time popover then) and their "Getting
// started" checklist. Asked once per sign-in and shared; off until the answer arrives.
// Never for partial admins: they work with the owner's sign-in, so Alvin would act with the owner's
// full access (and show the owner's leads) rather than theirs.

export interface AlvinSetupStep {
  key: string;
  label: string;
  done: boolean;
  ask: string;
}

export interface AlvinStatus {
  enabled: boolean;
  hasUsed: boolean;
  setup: AlvinSetupStep[];
}

const OFF: AlvinStatus = { enabled: false, hasUsed: false, setup: [] };
let cached: { token: string | null; result: Promise<AlvinStatus> } | null = null;

export function loadAlvinStatus(fresh = false): Promise<AlvinStatus> {
  if (isPartialAdmin()) return Promise.resolve(OFF);
  const token = localStorage.getItem('stasht_token');
  if (fresh || !cached || cached.token !== token) {
    const result = apiRequest<{ data?: { enabled?: boolean; has_used?: boolean; setup?: AlvinSetupStep[] } }>('/alvin/status', { method: 'GET', skipCache: true } as RequestInit)
      .then((res) => {
        if (!res.success) cached = null; // a failed check is asked again next time
        const d = res.success ? res.data?.data : undefined;
        return d?.enabled ? { enabled: true, hasUsed: !!d.has_used, setup: d.setup ?? [] } : OFF;
      })
      .catch(() => {
        cached = null;
        return OFF;
      });
    cached = { token, result };
  }
  return cached.result;
}

export function useAlvinStatus(): AlvinStatus {
  const [status, setStatus] = useState<AlvinStatus>(OFF);
  useEffect(() => {
    let live = true;
    loadAlvinStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);
  return status;
}

export default function useAlvinEnabled(): boolean {
  return useAlvinStatus().enabled;
}

// Opens Alvin from anywhere (e.g. the Get Started checklist), optionally asking a question.
export function openAlvin(ask?: string) {
  window.dispatchEvent(new CustomEvent('alvin-open', { detail: ask ? { ask } : undefined }));
}
