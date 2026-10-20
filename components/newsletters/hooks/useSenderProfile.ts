import { useEffect, useMemo, useState } from 'react';
import { dashboardAPI } from '../../../utils/authUtils';
import { useAuth } from '../../../contexts/AuthContext';
import { mergeProfileSources, profileFromApi, type SenderProfile } from '../lib/profile';

/**
 * The signed-in user's e-card fields. Starts from the stored auth user (avatar/profile_image, phone_number,
 * profile_color), then lays GET /user/profile's user (phone, avatar) over it. dashboardAPI.getUserProfile
 * goes through apiRequest, so it is de-duplicated and cached for 15 s.
 */
export function useSenderProfile(enabled = true): SenderProfile | null {
  const { user } = useAuth();
  const [apiUser, setApiUser] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    dashboardAPI.getUserProfile()
      .then((res: any) => {
        if (cancelled || !res?.success) return;
        const raw = res.data?.data?.user || res.data?.user || res.data?.data || res.data;
        if (raw && typeof raw === 'object') setApiUser(raw as Record<string, unknown>);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);

  return useMemo(() => profileFromApi(mergeProfileSources(user, apiUser)), [user, apiUser]);
}
