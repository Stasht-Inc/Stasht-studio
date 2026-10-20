import type { SaveState } from './hooks/useNewsletterDraft';

const TEXT: Record<SaveState, string> = { idle: '', saving: 'Saving…', saved: 'Draft saved', error: 'Not saved' };
// Phones: the header row is tight, so the same news in fewer letters.
const SHORT: Record<SaveState, string> = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Not saved' };

export default function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span role="status" aria-live="polite" className={`whitespace-nowrap text-xs ${state === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
      {SHORT[state] === TEXT[state] ? TEXT[state] : (
        <>
          <span className="sm:hidden">{SHORT[state]}</span>
          <span className="hidden sm:inline">{TEXT[state]}</span>
        </>
      )}
    </span>
  );
}
