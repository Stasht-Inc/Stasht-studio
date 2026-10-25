// Final review: a scheduled newsletter opened with "Edit" is taken off the schedule (it becomes a draft). The composer
// remembers that, says so, and on closing offers to put it back for its time. In memory only (this page).
import type { NewsletterChannel } from '../../../services/newslettersAPI.ts';
import { scheduleFromPlanned, scheduleProblem, textQuietHoursProblem } from './schedule.ts';

const offSchedule = new Map<number, string | null>();

export function markUnscheduled(id: number, plannedAt: string | null): void {
  offSchedule.set(id, plannedAt);
}

export function unscheduledFor(id: number | null | undefined): { plannedAt: string | null } | null {
  return id != null && offSchedule.has(id) ? { plannedAt: offSchedule.get(id) ?? null } : null;
}

export function clearUnscheduled(id: number | null | undefined): void {
  if (id != null) offSchedule.delete(id);
}

export const EDIT_SCHEDULED_CONFIRM = 'To edit it, we take it off the schedule. Press Schedule when you’re done.';
export const OFF_SCHEDULE_BANNER = 'This newsletter is off the schedule while you edit it. Press Schedule to put it back.';

/** Why it can't go back on the schedule for this time (null: it can): too soon / past, or texts in quiet hours. */
export function putBackProblem(plannedAt: string | null, channels: NewsletterChannel[], now: Date = new Date()): string | null {
  if (!plannedAt) return 'No time is picked.';
  const choice = scheduleFromPlanned(plannedAt);
  if (choice.mode !== 'later') return 'No time is picked.';
  return scheduleProblem(choice, now) ?? textQuietHoursProblem(choice, channels);
}
