// Live Leads list (Deepak 13 Nov 2026, option A): the Leads page quietly re-asks for the list it shows every ~10 s
// while the browser tab is visible, and straight away when the tab or window comes back. No React here, so it can be
// tested in node (tests/utils/livePoll.test.mjs).

export const LIVE_POLL_INTERVAL_MS = 10_000;
export const LIVE_POLL_MAX_BACKOFF_MS = 120_000;
// visibilitychange and focus usually fire together: the second one within this gap is ignored.
export const LIVE_POLL_MIN_GAP_MS = 1_000;

/** Delay before the next check: the interval, doubled per failure in a row, capped. */
export function livePollDelay(baseMs: number, failures: number, maxMs = LIVE_POLL_MAX_BACKOFF_MS): number {
  if (failures <= 0) return baseMs;
  return Math.min(maxMs, baseMs * 2 ** Math.min(failures, 10));
}

/**
 * Merges a freshly fetched list into the one on screen. Returns `prev` itself when nothing changed (so React skips the
 * render), otherwise a new array that reuses every unchanged row object (rows that didn't change keep their identity).
 * Rows are compared by value (JSON), which covers excerpts, unread counts, Claimed/Join, Read marks, assignee and status.
 */
export function reconcileList<T>(prev: T[], next: T[], keyOf: (item: T) => string | number): T[] {
  const byKey = new Map<string | number, { item: T; json: string }>();
  for (const item of prev) byKey.set(keyOf(item), { item, json: JSON.stringify(item) });
  let changed = prev.length !== next.length;
  const merged = next.map((item, i) => {
    const old = byKey.get(keyOf(item));
    if (old && old.json === JSON.stringify(item)) {
      if (prev[i] !== old.item) changed = true; // same row, new position
      return old.item;
    }
    changed = true;
    return item;
  });
  return changed ? merged : prev;
}

/** Same value (JSON) — for the small extras that come with the list (counts, totals). */
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface LivePollerEnv {
  document?: { visibilityState: string; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void };
  window?: { addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void };
  setTimeout?: (f: () => void, ms: number) => unknown;
  clearTimeout?: (h: unknown) => void;
  now?: () => number;
}

export interface LivePoller {
  /** Check now (skipped when one is already running). */
  poke: () => void;
  /** Cancel the running check, if any (e.g. the filters changed). */
  abort: () => void;
  stop: () => void;
}

/**
 * Calls `run` every `intervalMs` while the page is visible. `run` resolves false (or throws) on failure, which backs
 * off; anything else counts as success. Never overlaps: a tick while one is in flight is skipped. Hidden tab → no
 * timer at all; visible again / window focus → an immediate check.
 */
export function createLivePoller(
  run: (signal: AbortSignal) => Promise<boolean | void>,
  opts: { intervalMs?: number; maxBackoffMs?: number; env?: LivePollerEnv } = {},
): LivePoller {
  const env = opts.env ?? {};
  const doc = env.document ?? (typeof document !== 'undefined' ? document : undefined);
  const win = env.window ?? (typeof window !== 'undefined' ? window : undefined);
  const setT = env.setTimeout ?? ((f: () => void, ms: number) => setTimeout(f, ms));
  const clearT = env.clearTimeout ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const now = env.now ?? (() => Date.now());
  const intervalMs = opts.intervalMs ?? LIVE_POLL_INTERVAL_MS;
  const maxBackoffMs = opts.maxBackoffMs ?? LIVE_POLL_MAX_BACKOFF_MS;

  let timer: unknown = null;
  let inFlight: AbortController | null = null;
  let failures = 0;
  let stopped = false;
  let lastStart = -Infinity;
  const hidden = () => doc?.visibilityState === 'hidden';

  const clear = () => { if (timer !== null) { clearT(timer); timer = null; } };
  const schedule = () => {
    clear();
    if (stopped || hidden()) return;
    timer = setT(tick, livePollDelay(intervalMs, failures, maxBackoffMs));
  };
  async function tick() {
    timer = null;
    if (stopped || hidden()) return;
    if (inFlight) { schedule(); return; }
    const controller = new AbortController();
    inFlight = controller;
    lastStart = now();
    try {
      const ok = await run(controller.signal);
      if (!controller.signal.aborted) failures = ok === false ? failures + 1 : 0;
    } catch {
      if (!controller.signal.aborted) failures += 1;
    } finally {
      if (inFlight === controller) inFlight = null;
      schedule();
    }
  }
  const poke = () => {
    if (stopped || hidden() || inFlight) return;
    if (now() - lastStart < LIVE_POLL_MIN_GAP_MS) return;
    clear();
    void tick();
  };
  const onVisibility = () => { if (hidden()) clear(); else poke(); };
  const onFocus = () => poke();
  doc?.addEventListener('visibilitychange', onVisibility);
  win?.addEventListener('focus', onFocus);
  schedule();

  return {
    poke,
    abort: () => { inFlight?.abort(); inFlight = null; },
    stop: () => {
      stopped = true;
      clear();
      inFlight?.abort();
      inFlight = null;
      doc?.removeEventListener('visibilitychange', onVisibility);
      win?.removeEventListener('focus', onFocus);
    },
  };
}
