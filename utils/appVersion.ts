// "New version available" prompt: the pure decisions behind components/AppUpdatePrompt.tsx.
//
// Every build stamps its own build time into the bundle (__APP_BUILD_TIME__, vite.config.ts) and writes the same
// value to /version.json. An open window compares the two to tell that a newer build has been deployed, even when
// the service worker path does not say so. Nothing here reloads the page: the user clicks Refresh.
//
// Refresh attempts are remembered for the tab (sessionStorage) so a deploy that keeps serving old files cannot turn
// the prompt into a loop: the first click reloads, a second click for the same old build also resets the service
// worker, and after that the prompt stays away for a while.

/** How often an open window checks for a newer build. */
export const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
/** Focus / tab-visible checks closer together than this are skipped. */
export const FOCUS_CHECK_MIN_GAP_MS = 60 * 1000;
/** A refresh attempt older than this no longer holds the prompt back. */
export const REFRESH_ATTEMPT_TTL_MS = 30 * 60 * 1000;
/** sessionStorage key for the last refresh attempt. */
export const REFRESH_ATTEMPT_KEY = 'stasht_update_refresh_attempt';

export type RefreshAttempt = {
  /** The build the page was on when Refresh was clicked. */
  fromBuild: string;
  /** Refresh clicks that left the page on fromBuild. */
  count: number;
  /** When the last click happened (ms). */
  at: number;
};

/** A build stamp (ISO time) as ms, or null when it is not one. */
export function parseBuildTime(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** The build stamp in a /version.json body ({ buildTime }), or null when the body is not one. */
export function readRemoteBuild(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const value = (body as { buildTime?: unknown }).buildTime;
  return parseBuildTime(value) === null ? null : (value as string);
}

/** True only when both stamps are valid and the deployed one is later than this page's. */
export function isNewerBuild(remote: unknown, local: unknown): boolean {
  const r = parseBuildTime(remote);
  const l = parseBuildTime(local);
  return r !== null && l !== null && r > l;
}

/** True when both stamps are valid and name the same build. */
export function isSameBuild(a: unknown, b: unknown): boolean {
  const x = parseBuildTime(a);
  const y = parseBuildTime(b);
  return x !== null && y !== null && x === y;
}

/**
 * A new service worker took control (this window's update check, or another window's). Offer the update unless
 * /version.json says this page already is the deployed build. Unknown (fetch failed) still offers it; an older
 * deployed build (a rollback) also offers it, since the service worker now serves that build.
 */
export function shouldOfferForWorkerUpdate(remote: string | null, local: string): boolean {
  return remote === null || !isSameBuild(remote, local);
}

/** A stored attempt that still applies to this page: same build, not expired. Anything else is dropped. */
export function activeAttempt(attempt: RefreshAttempt | null, local: string, now: number): RefreshAttempt | null {
  if (!attempt || typeof attempt !== 'object') return null;
  if (attempt.fromBuild !== local) return null; // the last Refresh worked
  if (typeof attempt.count !== 'number' || typeof attempt.at !== 'number') return null;
  if (now - attempt.at > REFRESH_ATTEMPT_TTL_MS || now < attempt.at) return null;
  return attempt;
}

/** What a Refresh click does: a plain reload first; if that already left the page on this build, reset the service worker too. */
export function refreshAction(attempt: RefreshAttempt | null, local: string, now: number): 'reload' | 'reset-and-reload' {
  const active = activeAttempt(attempt, local, now);
  return active && active.count >= 1 ? 'reset-and-reload' : 'reload';
}

/** The attempt to store just before reloading. */
export function nextAttempt(attempt: RefreshAttempt | null, local: string, now: number): RefreshAttempt {
  const active = activeAttempt(attempt, local, now);
  return { fromBuild: local, count: (active?.count ?? 0) + 1, at: now };
}

/** False once a plain reload and a service worker reset have both left the page on the same build. */
export function canOfferUpdate(attempt: RefreshAttempt | null, local: string, now: number): boolean {
  const active = activeAttempt(attempt, local, now);
  return !active || active.count < 2;
}

/** Throttle for focus / visibility checks. */
export function shouldCheckNow(lastCheckAt: number | null, now: number, minGap = FOCUS_CHECK_MIN_GAP_MS): boolean {
  return lastCheckAt === null || now - lastCheckAt >= minGap || now < lastCheckAt;
}

/** A stored attempt, parsed defensively. */
export function parseAttempt(raw: string | null): RefreshAttempt | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const { fromBuild, count, at } = value as RefreshAttempt;
    if (typeof fromBuild !== 'string' || typeof count !== 'number' || typeof at !== 'number') return null;
    return { fromBuild, count, at };
  } catch {
    return null;
  }
}

/** A close within this long of the user touching the banner (X, swipe) is their dismissal. */
export const USER_DISMISS_WINDOW_MS = 2000;
/** After reload() this long with the page still here, the reload was cancelled (a beforeunload "Stay"). */
export const RELOAD_CANCEL_GRACE_MS = 4000;

/**
 * Was the banner closed by the user? sonner's toast.dismiss() with no id (used elsewhere in the app) closes every
 * toast, this one included, and reports it the same way; only a close right after a touch on the banner counts.
 */
export function isUserDismiss(lastTouchAt: number | null, now: number, windowMs = USER_DISMISS_WINDOW_MS): boolean {
  return lastTouchAt !== null && now >= lastTouchAt && now - lastTouchAt <= windowMs;
}

/** The reload never happened, so the click is not an attempt: the stored attempt goes back to what it was before it. */
export function attemptAfterCancelledReload(previous: RefreshAttempt | null): RefreshAttempt | null {
  return previous;
}
