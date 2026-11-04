import { useCallback, useEffect, useState } from 'react';
import { leadsAPI } from '../../../services/leadsAPI';
import { newslettersAPI, type ContactList } from '../../../services/newslettersAPI';
import { groupsFromApi, type GroupOption } from '../lib/audience';
import { LISTS_CHANGED_EVENT } from '../lib/lists';

/** Lead groups and the account's contact lists, for the "Send to" checklist. Nothing is fetched until enabled; lists
 *  (a paid-plan endpoint) only when `lists` is on (the Storeel flow is on every plan). */
export function useAudienceSources(enabled: boolean, lists: boolean = true) {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [listRows, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [groupsRes, listsRes] = await Promise.all([leadsAPI.getLeadGroups().catch(() => null), lists ? newslettersAPI.contactLists() : Promise.resolve(null)]);
    // GET /lead-groups answers {groups: [...]} with no envelope; apiRequest wraps it in {success, data}.
    if (groupsRes && groupsRes.success) setGroups(groupsFromApi(groupsRes.data));
    if (listsRes && listsRes.ok && Array.isArray(listsRes.data)) setLists(listsRes.data);
    setLoading(false);
  }, [lists]);

  useEffect(() => {
    if (!enabled) return undefined;
    void reload();
    // A list changed on the Leads page's Lists tab (another view of this tab): the checklist shows it as it is now.
    const onChanged = () => { void reload(); };
    window.addEventListener(LISTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(LISTS_CHANGED_EVENT, onChanged);
  }, [enabled, reload]);

  return { groups, lists: lists ? listRows : [], loading, reload };
}
