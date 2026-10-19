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
  // useAlvinStatus only: false until the answer has arrived, so callers can wait instead of showing the "off" view first.
  ready?: boolean;
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
  const [status, setStatus] = useState<AlvinStatus>({ ...OFF, ready: false });
  useEffect(() => {
    let live = true;
    loadAlvinStatus().then((s) => live && setStatus({ ...s, ready: true }));
    // Alvin did something (or was used for the first time): tick the checklist again.
    const refresh = () => loadAlvinStatus(true).then((s) => live && setStatus({ ...s, ready: true }));
    window.addEventListener('alvin-status-refresh', refresh);
    return () => {
      live = false;
      window.removeEventListener('alvin-status-refresh', refresh);
    };
  }, []);
  return status;
}

export function refreshAlvinStatus() {
  window.dispatchEvent(new Event('alvin-status-refresh'));
}

export default function useAlvinEnabled(): boolean {
  return useAlvinStatus().enabled;
}

// "Open straight into Alvin" links (ClickUp wdy2xh2a2q): the app's "Ask Alvin" opens Studio in its WebView
// at /dashboard?code=<SSO code>&alvin=1. Read once as Studio loads, before the router or the SSO exchange
// rewrites the address; takeOpenAlvinFromUrl() hands it over once and takes ?alvin=1 out of the address.
let openFromUrl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('alvin') === '1';

export function takeOpenAlvinFromUrl(): boolean {
  const wanted = openFromUrl;
  openFromUrl = false;
  const params = new URLSearchParams(window.location.search);
  if (params.has('alvin')) {
    params.delete('alvin');
    const query = params.toString();
    window.history.replaceState(window.history.state, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
  }
  return wanted;
}

// Opens Alvin from anywhere (e.g. the Get Started checklist), optionally asking a question.
export function openAlvin(ask?: string) {
  window.dispatchEvent(new CustomEvent('alvin-open', { detail: ask ? { ask } : undefined }));
}
