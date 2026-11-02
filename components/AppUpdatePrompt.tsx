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
// If the reload is cancelled (a page's "unsaved changes" prompt, answered Stay), the banner comes back.
//
// Everything below runs once per page (module-level), however often the component mounts.
import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { Toaster, toast, type ExternalToast } from 'sonner';
import {
  FOCUS_CHECK_MIN_GAP_MS,
  REFRESH_ATTEMPT_KEY,
  RELOAD_CANCEL_GRACE_MS,
  UPDATE_CHECK_INTERVAL_MS,
  attemptAfterCancelledReload,
  canOfferUpdate,
  isNewerBuild,
  isUserDismiss,
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
const TOAST_CLASS = 'stasht-app-update-toast';
const MESSAGE = 'A new version of Stasht Studio is available.';
// Below md (768px) App.tsx shows the fixed bottom nav: a 96px bar (h-24, plus the safe-area inset) with a 96px
// "+" button sticking 80px above it, so its top edge is 176px up. The campaign page's own nav reaches 123px. The
// banner sits 12px above that, clear of both.
const WIDE = '(min-width: 768px)';
const ABOVE_BOTTOM_NAV = 'calc(188px + env(safe-area-inset-bottom, 0px))';

let registration: ServiceWorkerRegistration | undefined;
let started = false;
let refreshing = false;
let offeredKey: string | null = null; // what the open banner is for ('sw' when only the worker said so)
let lastOfferKey: string | null = null; // what to offer again after a cancelled reload
const dismissed = new Set<string>();
let lastTouchAt: number | null = null; // last pointer / key press on the banner
let lastCheckAt: number | null = null;
const refreshEndListeners = new Set<() => void>();

/** Lets the header's refresh button stop its spinner when a reload was cancelled. */
export function onRefreshCancelled(listener: () => void): () => void {
  refreshEndListeners.add(listener);
  return () => { refreshEndListeners.delete(listener); };
}

function readAttempt(): RefreshAttempt | null {
  try {
    return parseAttempt(sessionStorage.getItem(REFRESH_ATTEMPT_KEY));
  } catch {
    return null;
  }
}

function writeAttempt(attempt: RefreshAttempt | null) {
  try {
    if (attempt) sessionStorage.setItem(REFRESH_ATTEMPT_KEY, JSON.stringify(attempt));
    else sessionStorage.removeItem(REFRESH_ATTEMPT_KEY);
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
 * reload(), then watch for it not happening: a page's beforeunload prompt answered "Stay" leaves this page running
 * with nothing to say so. Still here after the grace period → put things back (onCancelled).
 */
function reloadOrRecover(onCancelled: () => void) {
  let leaving = false;
  const onHide = () => { leaving = true; };
  window.addEventListener('pagehide', onHide, { once: true });
  window.location.reload();
  window.setTimeout(() => {
    window.removeEventListener('pagehide', onHide);
    if (leaving) return;
    refreshing = false;
    onCancelled();
    refreshEndListeners.forEach((listener) => listener());
  }, RELOAD_CANCEL_GRACE_MS);
}

/** Pick up a newer service worker if there is one (bounded waits). */
async function pickUpNewWorker(): Promise<void> {
  try {
    const reg = await appRegistration();
    if (reg) {
      if (!reg.installing && !reg.waiting) await withTimeout(reg.update().catch(() => undefined), 10000);
      if (reg.installing || reg.waiting) await activateNewWorker(reg, 20000);
    }
  } catch {
    // Reload anyway.
  }
}

/**
 * Get onto the latest deployed build: pick up a newer service worker if there is one, then reload once.
 * Also used by the header's refresh button (components/InteractiveNav.tsx), which listens to onRefreshCancelled.
 */
export async function refreshToLatest(): Promise<void> {
  refreshing = true;
  await pickUpNewWorker();
  reloadOrRecover(() => {});
}

/** Unregisters only the app's own worker (scope "/") — not OneSignal's push worker. */
async function unregisterAppWorker(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    const root = `${window.location.origin}/`;
    await withTimeout(Promise.all(regs.filter((r) => r.scope === root).map((r) => r.unregister())), 5000);
  } catch {
    // Reload anyway.
  }
}

async function applyUpdate() {
  if (refreshing) return;
  refreshing = true;
  const now = Date.now();
  const previous = readAttempt();
  const action = 'serviceWorker' in navigator ? refreshAction(previous, LOCAL_BUILD, now) : 'reload';
  writeAttempt(nextAttempt(previous, LOCAL_BUILD, now));
  toast.loading('Updating Stasht Studio…', { id: TOAST_ID, toasterId: TOASTER_ID, duration: Infinity, closeButton: false, action: undefined });
  if (action === 'reset-and-reload') await unregisterAppWorker();
  else await pickUpNewWorker();
  reloadOrRecover(() => {
    // Cancelled: not an attempt, and the banner comes back as it was.
    writeAttempt(attemptAfterCancelledReload(previous));
    const key = lastOfferKey;
    offeredKey = null;
    if (key) offer(key, true);
  });
}

function offer(key: string, force = false) {
  if (refreshing || (!force && (offeredKey !== null || dismissed.has(key)))) return;
  if (!canOfferUpdate(readAttempt(), LOCAL_BUILD, Date.now())) return;
  offeredKey = key;
  lastOfferKey = key;
  toast(MESSAGE, {
    // After a cancelled reload this same toast is still the "Updating…" loading toast: clear its type (a plain
    // toast() has none), or it keeps the spinner / icon space and sonner hides the close button.
    type: undefined,
    id: TOAST_ID,
    toasterId: TOASTER_ID,
    className: TOAST_CLASS,
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
      offeredKey = null;
      if (isUserDismiss(lastTouchAt, Date.now())) {
        dismissed.add(key);
        return;
      }
      // Closed by code (another screen's toast.dismiss() with no id): not the user's choice, so it comes back.
      window.setTimeout(() => offer(key), 600);
    },
  } as ExternalToast);
}

async function check() {
  if (refreshing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  lastCheckAt = Date.now();
  const reg = await appRegistration();
  if (reg && !reg.installing) reg.update().catch(() => undefined); // a new worker reports through onNeedReload
  if (!import.meta.env.PROD) return; // version.json only exists in builds
  const remote = await fetchRemoteBuild();
  if (remote && isNewerBuild(remote, LOCAL_BUILD)) offer(remote);
}

/** Starts the service worker registration and the update checks, once per page. */
function startWatching() {
  if (started) return;
  started = true;
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      registration = reg;
    },
    // A new worker took control (registerType 'autoUpdate'). Offer the update instead of the plugin's own reload.
    onNeedReload() {
      if (refreshing) return;
      void (async () => {
        const remote = import.meta.env.PROD ? await fetchRemoteBuild() : null;
        if (shouldOfferForWorkerUpdate(remote, LOCAL_BUILD)) offer(remote ?? 'sw');
      })();
    },
  });
  // A touch on the banner (its X, a swipe) just before it closes is the user dismissing it.
  const touch = (event: Event) => {
    if (event.target instanceof Element && event.target.closest(`.${TOAST_CLASS}`)) lastTouchAt = Date.now();
  };
  document.addEventListener('pointerdown', touch, true);
  document.addEventListener('keydown', touch, true);
  window.setTimeout(() => void check(), 3000);
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void check();
  }, UPDATE_CHECK_INTERVAL_MS);
  const onFocus = () => {
    if (document.visibilityState !== 'visible') return;
    if (shouldCheckNow(lastCheckAt, Date.now(), FOCUS_CHECK_MIN_GAP_MS)) void check();
  };
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onFocus);
}

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

export default function AppUpdatePrompt() {
  const wide = useMatches(WIDE);
  useEffect(() => { startWatching(); }, []);

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
