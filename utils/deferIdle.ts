// Run a low-priority task after the browser is idle, so non-critical work (e.g.
// decorative sidebar badge counts) stays off the initial-load critical path where
// the actually-needed data — memories, media — is competing for the network and
// the per-user API rate limit (see PERFORMANCE_OPTIMIZATION_PLAN.md #4).
//
// Uses requestIdleCallback when available, falling back to a short setTimeout for
// browsers that lack it (older Safari). Returns a cancel function so React effects
// can clean up if they unmount before the deferred work runs.
export function runWhenIdle(task: () => void, fallbackDelayMs = 200): () => void {
  const ric = (globalThis as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout?: number }) => number)
    | undefined;

  if (typeof ric === 'function') {
    const id = ric(task, { timeout: 2000 });
    return () => {
      const cancel = (globalThis as any).cancelIdleCallback as
        | ((handle: number) => void)
        | undefined;
      cancel?.(id);
    };
  }

  const id = setTimeout(task, fallbackDelayMs);
  return () => clearTimeout(id);
}
