/**
 * Shared client-side concurrency limiter.
 *
 * Several screens fan out one API call per item over an API-driven list
 * (`Promise.all(leads.map(...))` and friends). On a small account that is a
 * handful of requests; on a real one it is hundreds fired in the same tick,
 * which trips the backend's rate limiter and surfaces as an intermittent 429.
 *
 * Routing those fan-outs through `mapLimit` keeps the work identical but caps
 * how many requests are in flight at once. Requests queue instead of stampeding.
 */

export function createLimiter(maxConcurrent: number) {
  let active = 0;
  const waiting: Array<() => void> = [];

  const release = () => {
    active--;
    waiting.shift()?.();
  };

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= maxConcurrent) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      release();
    }
  };
}

/**
 * Default limiter for general API fan-out. Four in flight is comfortably under
 * any sane per-minute throttle while still being much faster than sequential.
 */
export const apiLimit = createLimiter(4);

/**
 * Uploads are heavier and slower, so they get their own, smaller budget — this
 * matches the BATCH_SIZE = 2 already used by AddMomentModal and CreateMemory.
 * Kept small deliberately: the backend's PHP-FPM pool runs in "ondemand" mode
 * (no pre-warmed workers), so a burst of simultaneous uploads forces several
 * cold worker forks at once, and whichever request draws the short straw can
 * exceed the connection timeout and fail before any response comes back.
 */
export const uploadLimit = createLimiter(2);

/**
 * Drop-in replacement for `Promise.all(items.map(fn))` that respects a limiter.
 * Resolution order matches the input order, exactly like Promise.all.
 */
export function mapLimit<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  limit: <U>(task: () => Promise<U>) => Promise<U> = apiLimit
): Promise<R[]> {
  return Promise.all(items.map((item, index) => limit(() => fn(item, index))));
}
