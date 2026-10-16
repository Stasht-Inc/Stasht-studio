import { useEffect, useRef } from 'react';
import { useSyncProgress } from '../contexts/SyncProgressContext';
import { catalogueAPI, type CatalogueOverview } from '../services/catalogueAPI';
import { CATALOGUE_SYNC_STARTED_EVENT } from './connectors/websiteCatalogue';

const SERVICE_ID = 'website-catalogue';
const SERVICE_TYPE = 'catalogue'; // Sidebar: "Importing {host} (n%)", and View catalogue when it's done
const IDLE_MS = 60_000; // no import running
const ACTIVE_MS = 10_000; // an import is running (or was just announced)
const ANNOUNCED_MS = 2 * 60_000; // after Connect / Sync now, check every 10 s for this long even before the import shows

/**
 * Shows the Website Catalogue's import in the sidebar's sync bar (SyncProgressContext), wherever the user is in
 * Studio. Mounted once in App.tsx; `enabled` only for a signed-in user in the personal view (the catalogue is a
 * personal-account connector). It asks GET /website-catalogue on start, every 60 s, every 10 s while an import
 * runs, and at once when the connect or Sync now flows announce a sync (CATALOGUE_SYNC_STARTED_EVENT).
 *
 * It never takes the bar from another service's sync (Google Photos, Dropbox, …) that is running or showing its
 * failure: it waits and tries again at the next check. A finished import of another service is replaced.
 */
export function CatalogueSyncWatcher({ enabled }: { enabled: boolean }) {
  // The context's functions are new on every render, so the checks read the latest ones from a ref.
  const syncContext = useSyncProgress();
  const contextRef = useRef(syncContext);
  contextRef.current = syncContext;

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    let timer: number | undefined;
    let inFlight = false;
    let checkAgainAfter = false; // an announcement arrived while a check was in flight
    let importing = false; // the last answer had an import running
    let announcedUntil = 0;
    let unavailable = false; // outside the pilot: no routine checks, but an announcement is still answered

    const ownsRunningBar = () => {
      const current = contextRef.current.syncProgress;
      return current?.serviceId === SERVICE_ID && current.status === 'syncing';
    };

    const apply = (overview: CatalogueOverview) => {
      const { syncProgress, startSync, updateProgress, completeSync, failSync, clearSync } = contextRef.current;
      const source = overview.source;
      const running = source?.sync ?? null;
      importing = running !== null;
      const ours = syncProgress?.serviceId === SERVICE_ID;
      const oursRunning = ours && syncProgress?.status === 'syncing';

      if (running && source) {
        // Another service's sync is running or showing its failure: leave its bar alone and wait.
        if (syncProgress && !ours && syncProgress.status !== 'completed') return;
        if (!oursRunning) startSync(SERVICE_ID, source.host, SERVICE_TYPE);
        const previous = oursRunning && syncProgress ? syncProgress.progress : 0;
        updateProgress(Math.round(running.percent ?? previous), running.label);
        return;
      }

      if (!oursRunning) return; // nothing of ours on the bar
      if (!source || source.status === 'paused' || source.status === 'plan_required') {
        clearSync(); // disconnected or paused while importing: nothing to report
      } else if (source.status === 'active') {
        completeSync(source.item_count);
      } else {
        // blocked / needs attention / unverified: the import stopped; the card and Manage say why.
        failSync(source.message || "We couldn't finish importing your catalogue.");
      }
    };

    const schedule = () => {
      if (cancelled) return;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      const announced = Date.now() < announcedUntil;
      if (unavailable && !importing && !announced) return;
      timer = window.setTimeout(check, importing || announced ? ACTIVE_MS : IDLE_MS);
    };

    const check = async () => {
      timer = undefined;
      inFlight = true;
      const res = await catalogueAPI.getOverview();
      inFlight = false;
      if (cancelled) return;
      if (res.ok && res.data) {
        unavailable = res.data.reason === 'not_available';
        apply(res.data);
      }
      if (checkAgainAfter) {
        checkAgainAfter = false;
        void check();
        return;
      }
      schedule();
    };

    const onAnnounced = () => {
      announcedUntil = Date.now() + ANNOUNCED_MS;
      if (inFlight) {
        checkAgainAfter = true;
        return;
      }
      if (timer !== undefined) window.clearTimeout(timer);
      void check();
    };

    window.addEventListener(CATALOGUE_SYNC_STARTED_EVENT, onAnnounced);
    void check();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener(CATALOGUE_SYNC_STARTED_EVENT, onAnnounced);
      // Signed out or switched to a property: a bar that would no longer be updated must not stay behind.
      if (ownsRunningBar()) contextRef.current.clearSync();
    };
  }, [enabled]);

  return null;
}
