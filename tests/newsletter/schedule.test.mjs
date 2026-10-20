// Runs in Toronto time so the conversions are fixed (EDT in October, EST in December).
process.env.TZ = 'America/Toronto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_LEAD_MINUTES, localDateTimeToIso, scheduleProblem, formatSendTime, dateInputValue, maxScheduleDate, DST_GAP_PROBLEM } from '../../components/newsletters/lib/schedule.ts';

test('localDateTimeToIso reads the date and time in the user’s time zone', () => {
  assert.equal(localDateTimeToIso('2026-10-22', '09:30'), '2026-10-22T13:30:00.000Z');
  assert.equal(localDateTimeToIso('2026-12-01', '09:30'), '2026-12-01T14:30:00.000Z');
  assert.equal(localDateTimeToIso('2026-02-31', '09:30'), null);
  assert.equal(localDateTimeToIso('2026-10-22', '24:00'), null);
  assert.equal(localDateTimeToIso('', '09:30'), null);
});

test('scheduleProblem', () => {
  const now = new Date('2026-10-22T13:20:00Z');
  assert.equal(MIN_LEAD_MINUTES, 5);
  assert.equal(scheduleProblem({ mode: 'now' }, now), null);
  assert.equal(scheduleProblem({ mode: 'later', date: '', time: '' }, now), 'Pick a date and a time.');
  assert.equal(scheduleProblem({ mode: 'later', date: '2026-02-31', time: '09:30' }, now), "That date doesn't exist. Pick another.");
  assert.equal(scheduleProblem({ mode: 'later', date: '2026-10-22', time: '09:30' }, now), null);
  assert.equal(scheduleProblem({ mode: 'later', date: '2026-10-22', time: '09:30' }, new Date('2026-10-22T13:27:00Z')), 'Pick a time at least 5 minutes from now.');
});

test('formatSendTime and dateInputValue', () => {
  const text = formatSendTime('2026-10-22T13:30:00.000Z');
  assert.match(text, /Thu/);
  assert.match(text, /Oct 22/);
  assert.match(text, /9:30/);
  assert.equal(formatSendTime(null), '');
  assert.equal(dateInputValue(new Date(2026, 9, 5)), '2026-10-05');
});

test('a schedule more than a year ahead is refused like the API (before:+1 year)', () => {
  const now = new Date('2026-10-22T13:20:00Z');
  assert.equal(scheduleProblem({ mode: 'later', date: '2027-10-23', time: '09:30' }, now), 'Pick a time within the next year.');
  assert.equal(scheduleProblem({ mode: 'later', date: '2027-10-21', time: '09:30' }, now), null);
  assert.equal(maxScheduleDate(now), '2027-10-22');
});

// Review 9–12 #9: 2:30 AM on the day the clocks go forward doesn't exist; say so instead of moving it.
test('a time skipped by the clock change is a problem, not silently moved', () => {
  assert.equal(localDateTimeToIso('2027-03-14', '02:30'), null);
  assert.equal(DST_GAP_PROBLEM, 'That time is skipped when the clocks change. Pick another time.');
  assert.equal(scheduleProblem({ mode: 'later', date: '2027-03-14', time: '02:30' }, new Date('2027-03-01T12:00:00Z')), DST_GAP_PROBLEM);
  assert.equal(scheduleProblem({ mode: 'later', date: '2027-02-30', time: '09:00' }, new Date('2027-02-01T12:00:00Z')), "That date doesn't exist. Pick another.");
});
