// utils/keyedStore.ts — per-key cache + in-flight de-duplication for small shared lookups (the Products status).
// Pure (no React, no requests) so tests/products can run it directly. A fetcher returns null for a failure, and a
// failure is never cached, so the next caller retries instead of hiding the feature for the session.
export interface KeyedStore<T> {
  peek(key: string): T | undefined;
  load(key: string, fresh: boolean, fetcher: () => Promise<T | null>): Promise<T | null>;
  subscribe(listener: () => void): () => void;
}

export function createKeyedStore<T>(): KeyedStore<T> {
  const cache = new Map<string, T>();
  const inflight = new Map<string, { fresh: boolean; promise: Promise<T | null> }>();
  const latest = new Map<string, number>();
  const listeners = new Set<() => void>();
  let seq = 0;

  return {
    peek: (key) => cache.get(key),
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    load(key, fresh, fetcher) {
      if (!fresh && cache.has(key)) return Promise.resolve(cache.get(key) as T);
      const pending = inflight.get(key);
      if (pending && (pending.fresh || !fresh)) return pending.promise; // N callers share one request
      const mine = ++seq;
      latest.set(key, mine);
      const promise: Promise<T | null> = fetcher()
        .catch(() => null)
        .then((value) => {
          if (inflight.get(key)?.promise === promise) inflight.delete(key);
          if (value !== null && latest.get(key) === mine) { // an older response never overwrites a newer request's
            cache.set(key, value);
            listeners.forEach((notify) => notify());
          }
          return value;
        });
      inflight.set(key, { fresh, promise });
      return promise;
    },
  };
}
