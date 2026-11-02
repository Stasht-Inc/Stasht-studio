// "A new version of Stasht Studio is available." — Refresh / dismiss, in every open window (browser tab or the
// installed app).
//
// How a window learns about a new deploy:
//  1. The service worker (vite-plugin-pwa, registerType 'autoUpdate', workbox skipWaiting + clientsClaim): when a
//     new worker takes control — after this window's update check or another window's — the plugin calls
//     onNeedReload. Without it the plugin reloads the page on its own, which could throw away unsaved work; now it
//     only offers the update.
//  2. /version.json ({ buildTime }, written by every build — vite.config.ts) compared with the build time stamped
//     into this bundle (__APP_BUILD_TIME__, also the profile menu's "Build … UTC"). This catches a page that is
//     older than the deploy even when the worker path says nothing (worker already updated, update missed).
// Checks run on start, every 5 minutes, and when the window regains focus or becomes visible.
//
// Refresh: activates a new worker if one is installing or waiting, then reloads once (same URL, so the same page).
// A Refresh that leaves the page on the same old build escalates once (unregister the app's worker, reload); after
// that the prompt stays away for a while — see utils/appVersion.ts. Nothing here ever reloads without a click.
import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Toaster, toast } from 'sonner';
import {
  FOCUS_CHECK_MIN_GAP_MS,
  REFRESH_ATTEMPT_KEY,
  UPDATE_CHECK_INTERVAL_MS,
  canOfferUpdate,
  isNewerBuild,
  nextAttempt,
  parseAttempt,
  readRemoteBuild,
  refreshAction,
  shouldCheckNow,
  shouldOfferForWorkerUpdate,
  type RefreshAttempt,
} from '../utils/appVersion';

const LOCAL_BUILD = __APP_BUILD_TIME__;
const TOASTER_ID = 'app-update';
const TOAST_ID = 'app-update';
const MESSAGE = 'A new version of Stasht Studio is available.';
// Below md (768px) App.tsx shows the fixed bottom nav: a 96px bar (h-24, plus the safe-area inset) with a 96px
// "+" button sticking 80px above it, so its top edge is 176px up. The campaign page's own nav reaches 123px. The
// banner sits 12px above that, clear of both.
const WIDE = '(min-width: 768px)';
const ABOVE_BOTTOM_NAV = 'calc(188px + env(safe-area-inset-bottom, 0px))';

function useMatches(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

let registration: ServiceWorkerRegistration | undefined;
let refreshing = false;

function readAttempt(): RefreshAttempt | null {
  try {
    return parseAttempt(sessionStorage.getItem(REFRESH_ATTEMPT_KEY));
  } catch {
    return null;
  }
}

function writeAttempt(attempt: RefreshAttempt) {
  try {
    sessionStorage.setItem(REFRESH_ATTEMPT_KEY, JSON.stringify(attempt));
  } catch {
    // Private mode / storage blocked: Refresh still works, only the loop guard is lost.
  }
}

/** The deployed build's stamp, or null when /version.json is missing, cached as HTML, or unreachable. */
async function fetchRemoteBuild(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return readRemoteBuild(await res.json());
  } catch {
    return null;
  }
}

async function appRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (registration) return registration;
  if (!('serviceWorker' in navigator)) return undefined;
  try {
    return (await navigator.serviceWorker.getRegistration(`${window.location.origin}/`)) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Waits (up to timeoutMs) for an installing / waiting worker to take control, asking a waiting one to skip waiting. */
function activateNewWorker(reg: ServiceWorkerRegistration, timeoutMs: number): Promise<void> {
  const worker = reg.installing || reg.waiting;
  if (!worker || !('serviceWorker' in navigator)) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('controllerchange', finish);
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    navigator.serviceWorker.addEventListener('controllerchange', finish);
    const nudge = () => {
      if (worker.state === 'installed') worker.postMessage({ type: 'SKIP_WAITING' });
      if (worker.state === 'activated' || worker.state === 'redundant') finish();
    };
    worker.addEventListener('statechange', nudge);
    nudge();
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([promise, new Promise<undefined>((resolve) => window.setTimeout(() => resolve(undefined), ms))]);
}

/**
 * Get onto the latest deployed build: pick up a newer service worker if there is one, then reload once.
 * Also used by the header's refresh button (components/InteractiveNav.tsx).
 */
export async function refreshToLatest(): Promise<void> {
  refreshing = true;
  try {
    const reg = await appRegistration();
    if (reg) {
      if (!reg.installing && !reg.waiting) await withTimeout(reg.update().catch(() => undefined), 10000);
      if (reg.installing || reg.waiting) await activateNewWorker(reg, 20000);
    }
  } catch {
    // Reload anyway.
  }
  window.location.reload();
}

/** Unregisters only the app's own worker (scope "/") — not OneSignal's push worker — then reloads. */
async function resetWorkerAndReload(): Promise<void> {
  refreshing = true;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    const root = `${window.location.origin}/`;
    await withTimeout(Promise.all(regs.filter((r) => r.scope === root).map((r) => r.unregister())), 5000);
  } catch {
    // Reload anyway.
  }
  window.location.reload();
}

async function applyUpdate() {
  if (refreshing) return;
  const now = Date.now();
  const previous = readAttempt();
  const action = 'serviceWorker' in navigator ? refreshAction(previous, LOCAL_BUILD, now) : 'reload';
  writeAttempt(nextAttempt(previous, LOCAL_BUILD, now));
  toast.loading('Updating Stasht Studio…', { id: TOAST_ID, toasterId: TOASTER_ID, duration: Infinity, closeButton: false, action: undefined });
  if (action === 'reset-and-reload') await resetWorkerAndReload();
  else await refreshToLatest();
}

export default function AppUpdatePrompt() {
  const wide = useMatches(WIDE);
  // What the open prompt is for ('sw' when only the worker said so), and what the user dismissed.
  const shownFor = useRef<string | null>(null);
  const dismissed = useRef<Set<string>>(new Set());
  const lastCheckAt = useRef<number | null>(null);

  const offer = useRef((key: string) => {
    if (refreshing || shownFor.current !== null || dismissed.current.has(key)) return;
    if (!canOfferUpdate(readAttempt(), LOCAL_BUILD, Date.now())) return;
    shownFor.current = key;
    toast(MESSAGE, {
      id: TOAST_ID,
      toasterId: TOASTER_ID,
      duration: Infinity,
      closeButton: true,
      action: {
        label: 'Refresh',
        onClick: (event) => {
          event.preventDefault(); // keep the toast up while it updates
          void applyUpdate();
        },
      },
      onDismiss: () => {
        if (refreshing) return;
        dismissed.current.add(key);
        shownFor.current = null;
      },
    });
  });

  const check = useRef(async () => {
    if (refreshing) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    lastCheckAt.current = Date.now();
    const reg = await appRegistration();
    if (reg && !reg.installing) reg.update().catch(() => undefined); // a new worker reports through onNeedReload
    if (!import.meta.env.PROD) return; // version.json only exists in builds
    const remote = await fetchRemoteBuild();
    if (remote && isNewerBuild(remote, LOCAL_BUILD)) offer.current(remote);
  });

  useRegisterSW({
    onRegisteredSW(_url, reg) {
      registration = reg;
    },
    // A new worker took control (registerType 'autoUpdate'). Offer the update instead of the plugin's own reload.
    onNeedReload() {
      if (refreshing) return;
      void (async () => {
        const remote = import.meta.env.PROD ? await fetchRemoteBuild() : null;
        if (shouldOfferForWorkerUpdate(remote, LOCAL_BUILD)) offer.current(remote ?? 'sw');
      })();
    },
  });

  useEffect(() => {
    const startup = window.setTimeout(() => void check.current(), 3000);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check.current();
    }, UPDATE_CHECK_INTERVAL_MS);
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      if (shouldCheckNow(lastCheckAt.current, Date.now(), FOCUS_CHECK_MIN_GAP_MS)) void check.current();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearTimeout(startup);
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  // Its own Toaster so it shows on every screen (App's Toaster only exists once signed in) and does not stack
  // with ordinary toasts top-right. Bottom-right on desktop (clear of the header search); on phones and narrow
  // windows bottom-center, above the bottom nav. Same look as App's Toaster; Refresh in Studio purple.
  return (
    <Toaster
      id={TOASTER_ID}
      position={wide ? 'bottom-right' : 'bottom-center'}
      offset={wide ? 24 : { bottom: ABOVE_BOTTOM_NAV, left: 16, right: 16 }}
      mobileOffset={{ bottom: ABOVE_BOTTOM_NAV, left: 12, right: 12 }}
      toastOptions={{
        unstyled: false,
        style: { background: 'white', color: '#374151', border: '1px solid #E5E7EB' },
        actionButtonStyle: { background: '#6C60FF', color: '#FFFFFF', fontWeight: 600 },
      }}
    />
  );
}
