// hooks/useProductsStatus.ts — one GET /products/status per inventory view, shared by the sidebar, phone bar, Products
// page, Campaigns grid, Dashboard and Add a Moment. Writes call announceProductsChanged() so the counts refresh.
// Cached per (user, view): a slow answer for an old view can't replace the current one, and a failure isn't cached.
import { useCallback, useEffect, useState } from 'react';
import { productsAPI, type ProductsStatus } from '../services/productsAPI';
import { useInventoryViewKey } from './useInventoryViewKey';
import { useAuth } from '../contexts/AuthContext';
import { createKeyedStore } from '../utils/keyedStore';

export const PRODUCTS_CHANGED_EVENT = 'stasht-products-changed';
export const announceProductsChanged = (): void => {
  try { window.dispatchEvent(new Event(PRODUCTS_CHANGED_EVENT)); } catch { /* not in a browser */ }
};

const store = createKeyedStore<ProductsStatus>();

// An older API (404) or any failure resolves to null, which the store doesn't cache.
const fetchStatus = (fresh: boolean) => () => productsAPI.getStatus(fresh).then((r) => (r.ok && r.data ? r.data : null));
const load = (key: string, fresh: boolean) => store.load(key, fresh, fetchStatus(fresh));

/** The store key: one status per (user, inventory view). */
export const productsStatusKey = (isAuthenticated: boolean, userId: unknown, viewKey: string): string =>
  `${isAuthenticated ? `u${userId ?? ''}` : 'out'}|${viewKey}`;
/** For code outside React (the sidebar Campaigns count): the same shared request and cache as the hook. null = not
 *  known (no answer, an error, or an older API's 404, JSON or HTML). */
export const loadProductsStatus = (key: string): Promise<ProductsStatus | null> => load(key, false);
export const peekProductsStatus = (key: string): ProductsStatus | undefined => store.peek(key);
export const subscribeProductsStatus = (listener: () => void): (() => void) => store.subscribe(listener);

export function useProductsStatus(): { status: ProductsStatus | null; loading: boolean; refresh(): Promise<void> } {
  const { isAuthenticated, user } = useAuth();
  const viewKey = useInventoryViewKey();
  const key = productsStatusKey(isAuthenticated, user?.id, viewKey);
  const [, rerender] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => store.subscribe(() => rerender((n) => n + 1)), []);
  useEffect(() => {
    if (!isAuthenticated) return;
    void load(key, false).then((v) => setFailed(v === null ? key : null));
  }, [isAuthenticated, key]);
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const onChanged = () => { void load(key, true); }; // the store shares one request across every mounted hook
    window.addEventListener(PRODUCTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PRODUCTS_CHANGED_EVENT, onChanged);
  }, [isAuthenticated, key]);

  const refresh = useCallback(async () => { if (isAuthenticated) await load(key, true); }, [isAuthenticated, key]);
  const current = isAuthenticated ? store.peek(key) ?? null : null;
  return { status: current, loading: isAuthenticated && current === null && failed !== key, refresh };
}
