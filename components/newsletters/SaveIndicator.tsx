import type { SaveState } from './hooks/useNewsletterDraft';

const TEXT: Record<SaveState, string> = { idle: '', saving: 'Saving…', saved: 'Draft saved', error: 'Not saved' };

export default function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span role="status" aria-live="polite" className={`hidden text-xs sm:inline ${state === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
      {TEXT[state]}
    </span>
  );
}
