import { useCallback, useEffect, useRef, useState } from 'react';
import { newslettersAPI, type ContactList } from '../../../services/newslettersAPI';
import { GENERIC_ERROR } from '../../newsletters/lib/apiResult';

/**
 * The account's contact lists for the Leads page (the Lists tab and its badge). Nothing is fetched until
 * `enabled` (a paid plan, known): a Starter account would get 403 plan_required and the upgrade modal.
 */
export function useContactLists(enabled: boolean) {
  const [lists, setLists] = useState<ContactList[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++request.current;
    setLoading(true);
    const res = await newslettersAPI.contactLists();
    if (mine !== request.current) return;
    setLoading(false);
    if (res.ok && Array.isArray(res.data)) {
      setLists(res.data);
      setError(null);
    } else {
      setLists((prev) => prev ?? []);
      setError(res.error ?? GENERIC_ERROR);
    }
  }, []);

  useEffect(() => {
    if (enabled) { void reload(); return; }
    request.current += 1;
    setLists(null);
    setError(null);
    setLoading(false);
  }, [enabled, reload]);

  return { lists, error, loading, reload, setLists };
}

export type ContactListsState = ReturnType<typeof useContactLists>;
