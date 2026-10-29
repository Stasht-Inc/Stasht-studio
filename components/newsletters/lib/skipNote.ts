// Chris, 29 Oct (round 2), item 6: texts the plan had no parts left for are skipped at sending. Results show why a
// skipped row wasn't sent: the API's skip_note, or plain words for a reason Studio knows when the note is missing.
import type { RecipientRow } from '../../../services/newslettersAPI.ts';

const NOTES: Record<string, string> = { no_text_parts: 'Not sent: no text parts left' };

export function recipientSkipNote(r: Pick<RecipientRow, 'status' | 'skip_reason' | 'skip_note'>): string | null {
  if (r.status !== 'skipped') return null;
  if (typeof r.skip_note === 'string' && r.skip_note.trim()) return r.skip_note.trim();
  return (r.skip_reason && NOTES[r.skip_reason]) || null;
}
