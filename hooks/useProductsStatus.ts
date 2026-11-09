// hooks/useProductsStatus.ts — one GET /products/status per inventory view, shared by the sidebar, phone bar, Products
// page, Campaigns grid, Dashboard and Add a Moment. Writes call announceProductsChanged() so the counts refresh.
import { useCallback, useEffect, useState } from 'react';
import { productsAPI, type ProductsStatus } from '../services/productsAPI';
import { useInventoryViewKey } from './useInventoryViewKey';
import { useAuth } from '../contexts/AuthContext';

export const PRODUCTS_CHANGED_EVENT = 'stasht-products-changed';
export const announceProductsChanged = (): void => {
  try { window.dispatchEvent(new Event(PRODUCTS_CHANGED_EVENT)); } catch { /* not in a browser */ }
};

let cache: { key: string; value: ProductsStatus | null } | null = null;
let inflight: { key: string; promise: Promise<ProductsStatus | null> } | null = null;
const subscribers = new Set<() => void>();

function load(key: string, fresh: boolean): Promise<ProductsStatus | null> {
  if (!fresh && cache && cache.key === key) return Promise.resolve(cache.value);
  if (!fresh && inflight && inflight.key === key) return inflight.promise;
  const promise = productsAPI.getStatus(fresh)
    .then((r) => (r.ok && r.data ? r.data : null)) // an older API (404) or any failure: Products stays hidden
    .catch(() => null)
    .then((value) => {
      cache = { key, value };
      if (inflight && inflight.promise === promise) inflight = null;
      subscribers.forEach((notify) => notify());
      return value;
    });
  inflight = { key, promise };
  return promise;
}

export function useProductsStatus(): { status: ProductsStatus | null; loading: boolean; refresh(): Promise<void> } {
  const { isAuthenticated } = useAuth();
  const viewKey = useInventoryViewKey();
  const key = `${isAuthenticated ? 'in' : 'out'}|${viewKey}`;
  const [, rerender] = useState(0);

  useEffect(() => {
    const notify = () => rerender((n) => n + 1);
    subscribers.add(notify);
    return () => { subscribers.delete(notify); };
  }, []);
  useEffect(() => {
    if (isAuthenticated) void load(key, false);
  }, [isAuthenticated, key]);
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const onChanged = () => { void load(key, true); };
    window.addEventListener(PRODUCTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PRODUCTS_CHANGED_EVENT, onChanged);
  }, [isAuthenticated, key]);

  const refresh = useCallback(async () => { if (isAuthenticated) await load(key, true); }, [isAuthenticated, key]);
  const current = isAuthenticated && cache && cache.key === key ? cache.value : null;
  return { status: current, loading: isAuthenticated && !(cache && cache.key === key), refresh };
}
