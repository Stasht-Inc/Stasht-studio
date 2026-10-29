// Chris, 29 Oct: the subject line follows the newsletter name until the person edits the subject themselves. Pure.
import { LIMITS } from './rules.ts';

/**
 * The subject after the name changes from prevName to newName. A subject that is empty, or still the name it was
 * copied from, follows the name; one the person typed (different from the name) is kept as it is. Works for drafts
 * opened again too: their subject is "edited" exactly when it differs from their name.
 */
export function nextSubjectForName(prevName: string, newName: string, subject: string): string {
  if (subject.trim() === '' || subject === prevName) return newName.slice(0, LIMITS.subject);
  return subject;
}
