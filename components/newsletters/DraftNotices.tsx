import { BUTTON_SMALL } from './lib/ui';

const BUTTON_SMALL_PRIMARY = 'inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#6C60FF] px-3 text-xs font-medium text-white hover:bg-[#5B50E6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40';
import type { DraftBackup } from './lib/draftBackup';

interface DraftNoticesProps {
  /** A failed save's reason, or null. */
  saveError: string | null;
  stale: boolean;
  canRetry: boolean;
  restoreOffer: DraftBackup | null;
  onRetry(): void;
  onReload(): void;
  onRestore(): void;
  onDismissRestore(): void;
}

const keptAt = (ms: number) => new Intl.DateTimeFormat(typeof navigator !== 'undefined' ? navigator.language : undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));

/** Above the steps: why the last save failed (with Try again or Reload), and unsaved changes kept on this device. */
export default function DraftNotices({ saveError, stale, canRetry, restoreOffer, onRetry, onReload, onRestore, onDismissRestore }: DraftNoticesProps) {
  return (
    <>
      {restoreOffer ? (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-[#6C60FF]/30 bg-[#F3F1FF] px-4 py-3 text-sm text-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <p>You have changes from {keptAt(restoreOffer.savedAt)} that weren’t saved.</p>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button type="button" onClick={onDismissRestore} className={BUTTON_SMALL}>Dismiss</button>
            <button type="button" onClick={onRestore} className={BUTTON_SMALL_PRIMARY}>Restore unsaved changes</button>
          </div>
        </div>
      ) : null}
      {saveError && (stale || canRetry) ? (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <p>{saveError}</p>
          <button type="button" onClick={stale ? onReload : onRetry} className={`${BUTTON_SMALL} flex-shrink-0 self-start sm:self-auto`}>{stale ? 'Reload' : 'Try again'}</button>
        </div>
      ) : null}
    </>
  );
}
