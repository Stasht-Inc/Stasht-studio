import { useCallback, useEffect, useState } from 'react';
import { leadsAPI } from '../../../services/leadsAPI';
import { newslettersAPI, type ContactList } from '../../../services/newslettersAPI';
import { groupsFromApi, type GroupOption } from '../lib/audience';

/** Lead groups and the account's contact lists, for the "Send to" checklist. Nothing is fetched until enabled. */
export function useAudienceSources(enabled: boolean) {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [groupsRes, listsRes] = await Promise.all([leadsAPI.getLeadGroups().catch(() => null), newslettersAPI.contactLists()]);
    // GET /lead-groups answers {groups: [...]} with no envelope; apiRequest wraps it in {success, data}.
    if (groupsRes && groupsRes.success) setGroups(groupsFromApi(groupsRes.data));
    if (listsRes.ok && Array.isArray(listsRes.data)) setLists(listsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  return { groups, lists, loading, reload };
}
