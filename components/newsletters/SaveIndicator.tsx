import type { SaveState } from './hooks/useNewsletterDraft';

const TEXT: Record<SaveState, string> = { idle: '', saving: 'Saving…', saved: 'Draft saved', error: 'Not saved' };
// Phones: the header row is tight, so the same news in fewer letters.
const SHORT: Record<SaveState, string> = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Not saved' };

interface SaveIndicatorProps {
  state: SaveState;
  /** Why the save failed (shown on hover and to screen readers; the composer shows it in full under the header). */
  reason?: string | null;
  /** Offered after a failed save that trying again can fix. */
  onRetry?: () => void;
}

export default function SaveIndicator({ state, reason, onRetry }: SaveIndicatorProps) {
  const error = state === 'error';
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs">
      <span role="status" aria-live="polite" title={error && reason ? reason : undefined} className={error ? 'text-red-600' : 'text-gray-500'}>
        {SHORT[state] === TEXT[state] ? TEXT[state] : (
          <>
            <span className="sm:hidden">{SHORT[state]}</span>
            <span className="hidden sm:inline">{TEXT[state]}</span>
          </>
        )}
        {error && reason ? <span className="sr-only">: {reason}</span> : null}
      </span>
      {error && onRetry ? (
        <button type="button" onClick={onRetry} className="hidden rounded font-medium text-[#6C60FF] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40 sm:inline">
          Try again
        </button>
      ) : null}
    </span>
  );
}
