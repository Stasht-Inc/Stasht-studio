import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Pause, Play, RefreshCw, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { catalogueAPI, type CatalogueOverview, type CatalogueResult } from '../../services/catalogueAPI';
import { BlockedHelp, BUTTON_DANGER, BUTTON_OUTLINED, BUTTON_PRIMARY, BUTTON_SECONDARY, CatalogueModalShell, Notice, VerificationMethods } from './WebsiteCatalogueParts';
import { announceCatalogueSync, formatRelative, openBillingUpgrade, plural, syncNowLabel, syncPercent } from './websiteCatalogue';

type Busy = null | 'sync' | 'pause' | 'resume' | 'disconnect';

/** While open and an import runs, the website's progress is asked for every 5 s. */
const SYNC_POLL_MS = 5000;

/** "You can sync again in 12 minutes." from the API's seconds-until-allowed, or null when Sync now is open. */
function syncWaitSentence(seconds: number): string | null {
  if (seconds <= 0) return null;
  return seconds < 60 ? 'You can sync again in under a minute.' : `You can sync again in ${plural(Math.ceil(seconds / 60), 'minute')}.`;
}

/** Spec 2026-09-30 §8.1: the connected website's status, Sync now / Pause / Resume / Disconnect, and what to do when it's paused. */
export function WebsiteCatalogueManageModal({
  overview,
  onClose,
  onChanged,
}: {
  overview: CatalogueOverview;
  onClose: () => void;
  onChanged: (next: CatalogueOverview) => void;
}) {
  const [busy, setBusy] = useState<Busy>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  // Set when Resume answers 409 paused_by_support: the API's sentence replaces the Resume button (retrying can't help).
  const [supportHold, setSupportHold] = useState<string | null>(null);
  const source = overview.source;

  // While an import runs, refresh the website every 5 s so the progress block (and the card behind) stay current.
  // The interval stops once the answer has no sync (the last answer also brings the new item count), and on close.
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const syncing = !!source?.sync;
  useEffect(() => {
    if (!syncing) return undefined;
    let cancelled = false;
    const timer = window.setInterval(() => {
      catalogueAPI.getOverview()
        .then((res) => { if (!cancelled && res.ok && res.data) onChangedRef.current(res.data); })
        .catch(() => {});
    }, SYNC_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [syncing]);

  if (!source) return null;

  const act = async (
    kind: Exclude<Busy, null>,
    call: () => Promise<CatalogueResult<CatalogueOverview>>,
    done: (next: CatalogueOverview) => string,
  ): Promise<boolean> => {
    setBusy(kind);
    const res = await call();
    setBusy(null);
    if (!res.ok || !res.data) {
      const message = res.error || 'Something went wrong. Please try again.';
      if (res.code === 'paused_by_support') setSupportHold(message);
      else toast.error(message);
      return false;
    }
    onChanged(res.data);
    toast.success(done(res.data));
    // A queued sync: the sidebar's progress bar picks it up straight away.
    if ((kind === 'sync' || kind === 'resume') && res.data.source?.sync_requested) announceCatalogueSync();
    return true;
  };

  const notBusiness = overview.reason === 'plan_required';
  const attention = source.status !== 'active' && source.status !== 'paused';
  const sync = source.sync;
  const percent = sync ? syncPercent(sync) : null; // null: indeterminate bar, no number
  const lastSync = sync?.state === 'running'
    ? 'In progress'
    : source.sync_requested ? 'Starting within a minute' : formatRelative(source.last_sync_at) ?? 'Not yet';
  const wait = syncWaitSentence(source.sync_now_available_in);
  const showVerification = source.domain && (source.status === 'unverified' || source.warning);
  const canResume = source.can_resume && supportHold === null;
  // Lost ownership record: the API's message says to disconnect and connect again, and a sync would be skipped.
  const canSync = source.status_reason !== 'no_domain' || source.status !== 'unverified';

  return (
    <>
      <CatalogueModalShell
        title="Website Catalogue"
        subtitle={source.host}
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>Close</button>
            {!notBusiness && (
              <button type="button" onClick={() => setConfirmDisconnect(true)} disabled={busy !== null} className={BUTTON_DANGER}>
                <Unplug className="w-4 h-4" />
                Disconnect
              </button>
            )}
            {/* The state's primary action sits in the pinned footer, rightmost, so a long body never hides it. */}
            {notBusiness ? (
              <button type="button" onClick={openBillingUpgrade} className={BUTTON_PRIMARY}>Upgrade to Business</button>
            ) : (
              <>
                {source.status !== 'paused' && canSync && (
                  <button
                    type="button"
                    onClick={() =>
                      act(
                        'sync',
                        catalogueAPI.syncNow,
                        (next) => (next.source?.sync_requested === false ? 'Sync requested.' : 'Sync requested. It starts within a minute.'),
                      )
                    }
                    disabled={!source.can_sync_now || busy !== null}
                    className={BUTTON_PRIMARY}
                  >
                    {busy === 'sync' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {syncNowLabel(source.status)}
                  </button>
                )}
                {canResume && (
                  <button
                    type="button"
                    onClick={() =>
                      act(
                        'resume',
                        catalogueAPI.resume,
                        // A false sync_requested means the 15-minute allowance was in use: the website is back, no sync was queued.
                        (next) => (next.source?.sync_requested === false ? 'Syncing resumed.' : 'Syncing resumed. A sync starts within a minute.'),
                      )
                    }
                    disabled={busy !== null}
                    className={BUTTON_PRIMARY}
                  >
                    {busy === 'resume' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Resume syncing
                  </button>
                )}
              </>
            )}
          </>
        }
      >
        {source.status === 'active' && !source.warning ? (
          <div className="bg-green-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span className="text-green-700 font-semibold text-sm">Connected and syncing every night</span>
            </div>
            <p className="text-green-600 text-sm">{plural(source.item_count, 'item')} from {source.host}</p>
          </div>
        ) : (
          <Notice tone={attention || source.warning ? 'warning' : 'neutral'}>
            <span className="flex items-start gap-2">
              {attention || source.warning
                ? <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                : <Pause className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />}
              <span>{source.warning || source.message}</span>
            </span>
          </Notice>
        )}

        {supportHold && <Notice tone="warning">{supportHold}</Notice>}

        {sync && (
          <div className="bg-blue-50 rounded-xl p-4" aria-live="polite">
            <p className="font-semibold text-sm text-gray-900 mb-3">{sync.label}</p>
            <div
              className="w-full bg-[#6C60FF]/20 rounded-full h-2 overflow-hidden"
              role="progressbar"
              aria-label="Import progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent ?? undefined}
            >
              {percent === null ? (
                <div className="bg-[#6C60FF] h-2 w-1/3 rounded-full animate-pulse" />
              ) : (
                <div className="bg-[#6C60FF] h-2 rounded-full transition-all duration-500 ease-out" style={{ width: `${percent}%` }} />
              )}
            </div>
            {percent !== null && (
              <div className="flex items-center justify-end mt-2">
                <span className="text-xs font-semibold text-[#6C60FF]">{percent}%</span>
              </div>
            )}
            <p className="text-xs text-gray-600 mt-2">
              {/* The engine emails only after the first import (no earlier run: last_sync_at is null until a run ends). */}
              This can take a while. You can close this window and keep using Studio
              {source.last_sync_at ? '.' : " — we'll email you when your catalogue is ready."}
            </p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Website</dt>
          <dd className="text-gray-900 break-all">
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-[#6C60FF] hover:underline">{source.url}</a>
          </dd>
          <dt className="text-gray-500">Items</dt>
          <dd className="text-gray-900">{sync ? 'Importing…' : source.item_count.toLocaleString('en-US')}</dd>
          <dt className="text-gray-500">Last synced</dt>
          <dd className="text-gray-900">{lastSync}</dd>
          <dt className="text-gray-500">Last successful sync</dt>
          <dd className="text-gray-900">{formatRelative(source.last_success_at) ?? 'Not yet'}</dd>
        </dl>

        {source.blocked && <BlockedHelp blocked={source.blocked} />}
        {showVerification && source.domain && <VerificationMethods domain={source.domain} />}

        {!notBusiness && source.can_pause && (
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => act('pause', catalogueAPI.pause, () => 'Syncing paused.')} disabled={busy !== null} className={BUTTON_OUTLINED}>
              {busy === 'pause' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
              Pause syncing
            </button>
          </div>
        )}
        {!notBusiness && source.status !== 'paused' && canSync && !source.can_sync_now && wait && (
          <p className="text-xs text-gray-500">
            {source.sync_requested ? 'A sync is already on its way. ' : ''}{syncNowLabel(source.status)} is unavailable for now. {wait}
          </p>
        )}
      </CatalogueModalShell>

      <AlertDialog open={confirmDisconnect} onOpenChange={(next) => { if (busy === null) setConfirmDisconnect(next); }}>
        <AlertDialogContent className="sm:max-w-md bg-white border-0 shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {source.host}?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 leading-relaxed">
              {source.item_count > 0
                ? <>Nightly syncing stops and your {plural(source.item_count, 'item')} leave the catalogue and the campaign picker. </>
                : <>Nightly syncing stops. </>}
              Campaigns you've already made keep their moments. You can connect a website again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={busy !== null} className="border-gray-200 hover:bg-gray-50">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                if (await act('disconnect', catalogueAPI.disconnect, () => 'Website disconnected.')) {
                  setConfirmDisconnect(false);
                  onClose();
                }
              }}
              disabled={busy !== null}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
