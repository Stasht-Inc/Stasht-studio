// Chris (7 Nov, points 9 and 9b): "Highlight should be on the subject line, not the card." and "Error messages always go
// at bottom not top of card." Studio's checks before Send / Schedule now say which FIELD is wrong (the message goes
// under it, the field is marked); only problems that belong to no one field stay on the card (at its bottom).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHOOSE_AUDIENCE, saveRefusedFields, scheduleField, sendProblems, sendToMessage, firstProblem, stepSummary } from '../../components/newsletters/lib/sendFieldChecks.ts';
import { preSendProblems } from '../../components/newsletters/lib/sendChecks.ts';
import { emptyDraft } from '../../components/newsletters/lib/draft.ts';

const counts = { email: 1180, sms: 310, skipped: { no_email: 0, no_phone: 0, unsubscribed: 0, duplicate: 0 } };
const ready = {
  ...emptyDraft(), name: 'October', from_name: 'Serpa Chrysler', reply_to_email: 'sales@serpachrysler.ca', subject: 'October deals', audience: [{ type: 'lead', id: 7101 }],
  blocks: [{ id: 'b1', type: 'title', data: { text: 'This month', size: 'large' } }],
};
const NOW = new Date('2026-11-07T15:00:00Z');

test('a finished newsletter has no problems', () => {
  assert.deepEqual(sendProblems(ready, counts, { mode: 'now' }, NOW), { fields: {}, steps: {} });
  assert.equal(firstProblem({ fields: {}, steps: {} }), null);
});

test('the screenshot: a missing subject marks the Subject line field, not the card', () => {
  const p = sendProblems({ ...ready, subject: '' }, counts, { mode: 'now' }, NOW);
  assert.deepEqual(p, { fields: { subject: 'Add a subject line.' }, steps: {} });
  assert.deepEqual(firstProblem(p), { step: 'name', field: 'subject' });
});

test('an empty draft: each field says its own problem; only "no sections" is the Content card\'s', () => {
  const p = sendProblems(emptyDraft(), counts, { mode: 'now' }, NOW);
  assert.deepEqual(p.fields, { name: 'Give your newsletter a name.', subject: 'Add a subject line.', audience: 'Choose who gets this newsletter.' });
  assert.deepEqual(p.steps, { content: 'Add at least one section to the email.' });
  assert.deepEqual(firstProblem(p), { step: 'name', field: 'name' });
  // Every step preSendProblems flags is still flagged (nothing is lost on the way to the fields).
  const before = preSendProblems(emptyDraft(), counts, { mode: 'now' }, NOW);
  assert.deepEqual(Object.keys(before).sort(), ['content', 'name', 'recipients']);
});

test('recipients: channels, the text message, nobody reachable', () => {
  assert.deepEqual(sendProblems({ ...ready, channels: [] }, counts, { mode: 'now' }, NOW).fields, { channels: 'Choose email, text or both.' });
  assert.deepEqual(sendProblems({ ...ready, channels: ['email', 'sms'], sms_text: '' }, counts, { mode: 'now' }, NOW).fields, { sms_text: 'Write the text message.' });
  assert.deepEqual(sendProblems(ready, { ...counts, email: 0, sms: 0 }, { mode: 'now' }, NOW).fields, { audience: 'Nobody on these lists can get this newsletter yet.' });
});

test('from: a reply-to that is not an email address', () => {
  const p = sendProblems({ ...ready, reply_to_email: 'sales@' }, counts, { mode: 'now' }, NOW);
  assert.deepEqual(p.fields, { reply_to_email: 'Enter an email address like sales@yourbusiness.com.' });
  assert.deepEqual(firstProblem(p), { step: 'from', field: 'reply_to_email' });
});

test('content: unfinished sections are marked on the sections; the card says so at its bottom', () => {
  const p = sendProblems({ ...ready, blocks: [{ id: 'b1', type: 'button', data: { label: '', url: '', color: '#6C60FF' } }] }, counts, { mode: 'now' }, NOW);
  assert.deepEqual(p, { fields: {}, steps: { content: 'Finish or remove the sections marked in red.' } });
  assert.deepEqual(firstProblem(p), { step: 'content', field: null });
});

test('schedule: the date or the time field, whichever is wrong', () => {
  assert.deepEqual(sendProblems(ready, counts, { mode: 'later', date: '', time: '' }, NOW).fields, { send_date: 'Pick a date and a time.' });
  assert.deepEqual(sendProblems(ready, counts, { mode: 'later', date: '2026-11-20', time: '' }, NOW).fields, { send_time: 'Pick a date and a time.' });
  const past = sendProblems(ready, counts, { mode: 'later', date: '2026-11-07', time: '00:05' }, NOW);
  assert.deepEqual(Object.keys(past.fields), ['send_time']);
  assert.deepEqual(firstProblem(past), { step: 'schedule', field: 'send_time' });
  assert.equal(scheduleField({ mode: 'later', date: '2026-11-07', time: '' }), 'send_time');
  assert.equal(scheduleField({ mode: 'later', date: '', time: '10:00' }), 'send_date');
});

test('the first problem follows the steps\' order, then the fields\' order inside a step', () => {
  const p = sendProblems({ ...emptyDraft(), name: 'x', channels: [] }, counts, { mode: 'later', date: '', time: '' }, NOW);
  assert.deepEqual(firstProblem(p), { step: 'name', field: 'subject' });
  assert.deepEqual(firstProblem({ fields: { send_date: 'x', reply_to_email: 'y' }, steps: { content: 'z' } }), { step: 'from', field: 'reply_to_email' });
});

// Review (7 Nov), I1 + M5: what shows under "Send to" when Single person is picked.
test('Single person: a typed person\'s status problem is said under their box only, never under Send to', () => {
  const typed = [{ type: 'person', email: 'gone@example.com' }];
  const status = { email: 'This email address has unsubscribed.' };
  assert.deepEqual(sendToMessage({ single: true, audience: typed, message: status.email, statusProblems: status, boxErrors: [] }), { sendTo: undefined, personMissing: false });
  // Nobody typed yet: the box to fill is marked (generic message only).
  assert.deepEqual(sendToMessage({ single: true, audience: [], message: CHOOSE_AUDIENCE, statusProblems: {}, boxErrors: [] }), { sendTo: undefined, personMissing: true });
  // A server message about the audience is kept, under Send to, even with nobody typed.
  assert.deepEqual(sendToMessage({ single: true, audience: [], message: 'Your plan does not include Single person.', statusProblems: {}, boxErrors: [] }), { sendTo: 'Your plan does not include Single person.', personMissing: false });
  // Lists: under Send to as before.
  assert.deepEqual(sendToMessage({ single: false, audience: [], message: CHOOSE_AUDIENCE, statusProblems: {}, boxErrors: [] }), { sendTo: CHOOSE_AUDIENCE, personMissing: false });
  // A box error from the API (audience.0.email) is said under the box.
  assert.deepEqual(sendToMessage({ single: true, audience: typed, message: 'audience.0.email: Enter a real email.', statusProblems: {}, boxErrors: ['Enter a real email.'] }).sendTo, undefined);
  assert.deepEqual(sendToMessage({ single: true, audience: typed, message: undefined, statusProblems: status, boxErrors: [] }), { sendTo: undefined, personMissing: false });
});

test('a failed Save Draft goes to a field only when the API refused fields (not on a network error)', () => {
  assert.equal(saveRefusedFields({}), false);
  assert.equal(saveRefusedFields({ subject: 'Keep the subject to 150 characters or fewer.' }), true);
});

test('the step summary (preSendProblems) is derived from the field checks: one set of rules', () => {
  const p = sendProblems(emptyDraft(), counts, { mode: 'now' }, NOW);
  assert.deepEqual(stepSummary(p), preSendProblems(emptyDraft(), counts, { mode: 'now' }, NOW));
  assert.equal(stepSummary(p).name, 'Give your newsletter a name and a subject line.');
});
