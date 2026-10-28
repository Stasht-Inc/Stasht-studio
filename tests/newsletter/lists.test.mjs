// Lists tab on the Leads page (Chris, 28 Oct 2026): the pure helpers behind the lists table and one list's people.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LISTS_CHANGED_EVENT, MAX_SELECTED, announceListsChanged, emailStatusChip, filenameFromDisposition, listSourceLabel, listTotals,
  listUpdatedText, memberFormProblems, mergeResultText, copyResultText, pageSelection, peopleText, smsStatusChip, toggleSelected, togglePage, withListSummary,
} from '../../components/newsletters/lib/lists.ts';
import { listOrigin } from '../../components/newsletters/lib/manageLists.ts';

const list = (over = {}) => ({
  id: 9, name: 'Open house sign-ups', source: 'import', member_count: 212, email_count: 198, sms_count: 140, unsubscribed_count: 6,
  consent_type: 'express', created_at: '2026-10-02T15:00:00Z', updated_at: '2026-10-20T15:00:00Z', ...over,
});

test('where a list came from, in plain words', () => {
  assert.equal(listSourceLabel('import'), 'Imported');
  assert.equal(listSourceLabel('leads'), 'Made from leads');
  assert.equal(listSourceLabel('lead_group'), 'Made from a lead group');
  assert.equal(listSourceLabel('manual'), 'Created here');
  assert.equal(listSourceLabel('something-new'), 'List');
  // The composer's Manage lists line knows the new source too.
  assert.equal(listOrigin({ source: 'manual', created_at: '2026-10-28T12:00:00Z' }, 'en-US'), 'Created here Oct 28, 2026');
});

test('summary cards: lists, people, can email, unsubscribed', () => {
  assert.deepEqual(listTotals([]), { lists: 0, people: 0, email: 0, unsubscribed: 0 });
  assert.deepEqual(
    listTotals([list(), list({ id: 10, member_count: 30, email_count: 25, unsubscribed_count: undefined }), list({ id: 11, member_count: null, email_count: null, unsubscribed_count: 2 })]),
    { lists: 3, people: 242, email: 223, unsubscribed: 8 },
  );
});

test('when a list last changed (falls back to when it was made)', () => {
  assert.equal(listUpdatedText(list(), 'en-US'), 'Oct 20, 2026');
  assert.equal(listUpdatedText(list({ updated_at: undefined }), 'en-US'), 'Oct 2, 2026');
  assert.equal(listUpdatedText(list({ updated_at: null, created_at: null }), 'en-US'), '—');
  assert.equal(listUpdatedText(list({ updated_at: 'not a date', created_at: null }), 'en-US'), '—');
});

test('people, counted', () => {
  assert.equal(peopleText(1, 'en-US'), '1 person');
  assert.equal(peopleText(0, 'en-US'), '0 people');
  assert.equal(peopleText(1234, 'en-US'), '1,234 people');
});

test('what an import or copy did', () => {
  assert.equal(mergeResultText({ added: 812, updated: 40, skipped: 12 }, 'en-US'), 'Added 812, updated 40, skipped 12.');
  assert.equal(mergeResultText({ added: 3, updated: 0, skipped: 0 }, 'en-US'), 'Added 3.');
  assert.equal(mergeResultText({ added: 0, updated: 5, skipped: 0 }, 'en-US'), 'Added 0, updated 5.');
  assert.equal(mergeResultText({ added: 1200, updated: 0, skipped: 2 }, 'en-US'), 'Added 1,200, skipped 2.');
  assert.equal(mergeResultText({}, 'en-US'), 'Added 0.');
  // Nothing changed (everyone was already there): the caller's own words instead of "Added 0."
  assert.equal(mergeResultText({ added: 0, updated: 0, skipped: 0 }, 'en-US', 'Everyone in this file is already on the list.'), 'Everyone in this file is already on the list.');
  assert.equal(mergeResultText({ added: 0, updated: 0, skipped: 2 }, 'en-US', 'Everyone in this file is already on the list.'), 'Added 0, skipped 2.');
  // unchanged (newer API): people in the file already on the list with nothing new to fill in.
  assert.equal(mergeResultText({ added: 812, updated: 40, skipped: 12, unchanged: 5 }, 'en-US'), 'Added 812, updated 40, skipped 12, 5 already on the list.');
  assert.equal(mergeResultText({ added: 3, updated: 0, skipped: 0, unchanged: 1 }, 'en-US'), 'Added 3, 1 already on the list.');
  assert.equal(mergeResultText({ added: 0, updated: 0, skipped: 0, unchanged: 7 }, 'en-US'), 'Everyone in this file is already on the list.');
  assert.equal(mergeResultText({ added: 0, updated: 0, skipped: 1, unchanged: 7 }, 'en-US'), 'Everyone in this file is already on the list. Skipped 1.');
  assert.equal(mergeResultText({ added: 0, updated: 2, skipped: 0, unchanged: 7 }, 'en-US'), 'Added 0, updated 2, 7 already on the list.');
});

test('a copy where everyone chosen was already on the other list', () => {
  assert.equal(copyResultText({ added: 2, updated: 0, skipped: 0 }, 'VIP', 'en-US'), 'Copied to \u201cVIP\u201d. Added 2.');
  assert.equal(copyResultText({ added: 1, updated: 1, skipped: 3 }, 'VIP', 'en-US'), 'Copied to \u201cVIP\u201d. Added 1, updated 1, skipped 3.');
  assert.equal(copyResultText({ added: 0, updated: 0, skipped: 3 }, 'VIP', 'en-US'), 'Everyone you chose is already on \u201cVIP\u201d.');
  assert.equal(copyResultText({ added: 0, updated: 0, skipped: 1 }, 'VIP', 'en-US'), 'This person is already on \u201cVIP\u201d.');
});

test('the download name from Content-Disposition', () => {
  assert.equal(filenameFromDisposition('attachment; filename="open-house-sign-ups-2026-10-28.csv"', 'list.csv'), 'open-house-sign-ups-2026-10-28.csv');
  assert.equal(filenameFromDisposition('attachment; filename=plain.csv', 'list.csv'), 'plain.csv');
  assert.equal(filenameFromDisposition("attachment; filename=\"x.csv\"; filename*=UTF-8''ren%C3%A9e-2026-10-28.csv", 'list.csv'), 'renée-2026-10-28.csv');
  assert.equal(filenameFromDisposition(null, 'list.csv'), 'list.csv');
  assert.equal(filenameFromDisposition('inline', 'list.csv'), 'list.csv');
  // Never a path.
  assert.equal(filenameFromDisposition('attachment; filename="../../etc/passwd.csv"', 'list.csv'), 'passwd.csv');
  assert.equal(filenameFromDisposition("attachment; filename*=UTF-8''%E0%A4%A", 'list.csv'), 'list.csv');
});

test('email and text status chips', () => {
  assert.equal(emailStatusChip(null), null);
  assert.equal(emailStatusChip(undefined), null);
  assert.deepEqual(emailStatusChip('subscribed'), { label: 'Email', tone: 'good', title: 'Gets emails' });
  assert.deepEqual(emailStatusChip('unsubscribed'), { label: 'Email: unsubscribed', tone: 'muted', title: 'Unsubscribed from emails' });
  assert.deepEqual(emailStatusChip('bounced'), { label: 'Email: bounced', tone: 'bad', title: 'Emails to this address bounced' });
  assert.deepEqual(emailStatusChip('complained'), { label: 'Email: marked as spam', tone: 'bad', title: 'Marked an email as spam' });
  assert.equal(smsStatusChip(null), null);
  assert.deepEqual(smsStatusChip('subscribed'), { label: 'Text', tone: 'good', title: 'Gets texts' });
  assert.deepEqual(smsStatusChip('stopped'), { label: 'Text: stopped', tone: 'muted', title: 'Replied STOP to a text' });
});

test('add or edit a person: an email or a mobile number, written so we can use it', () => {
  assert.deepEqual(memberFormProblems({ email: '', phone: '  ' }), { email: 'Add an email address or a mobile number.' });
  assert.deepEqual(memberFormProblems({ email: 'jane@', phone: '' }), { email: 'Enter an email address like name@example.com.' });
  assert.deepEqual(memberFormProblems({ email: '', phone: '555' }), { phone: 'Enter a mobile number with its country code, like +1 416 555 0100.' });
  assert.deepEqual(memberFormProblems({ email: ' jane@example.com ', phone: '' }), {});
  assert.deepEqual(memberFormProblems({ email: '', phone: '+1 416 555 0100' }), {});
  assert.deepEqual(memberFormProblems({ email: 'nope', phone: 'call me' }), {
    email: 'Enter an email address like name@example.com.', phone: 'Enter a mobile number with its country code, like +1 416 555 0100.',
  });
});

test('choosing people: one, a page, never more than 500', () => {
  const none = new Set();
  const one = toggleSelected(none, 4);
  assert.deepEqual([...one], [4]);
  assert.notEqual(one, none, 'a new set every time');
  assert.deepEqual([...toggleSelected(one, 4)], []);

  assert.equal(pageSelection(new Set(), [1, 2, 3]), 'none');
  assert.equal(pageSelection(new Set([2]), [1, 2, 3]), 'some');
  assert.equal(pageSelection(new Set([1, 2, 3, 9]), [1, 2, 3]), 'all');
  assert.equal(pageSelection(new Set([9]), []), 'none');

  assert.deepEqual([...togglePage(new Set([9]), [1, 2])].sort(), [1, 2, 9]);
  assert.deepEqual([...togglePage(new Set([1, 2, 9]), [1, 2])], [9]);
  assert.deepEqual([...togglePage(new Set([1]), [1, 2])].sort(), [1, 2], 'some chosen: choose the rest');

  const many = new Set(Array.from({ length: MAX_SELECTED - 1 }, (_, i) => i + 1000));
  const capped = togglePage(many, [1, 2, 3]);
  assert.equal(capped.size, MAX_SELECTED);
  assert.equal(toggleSelected(capped, 7).size, MAX_SELECTED, 'full: no more');
  assert.equal(MAX_SELECTED, 500);
});

test('a changed list replaces its row (or joins at the top)', () => {
  const a = list();
  const b = list({ id: 10, name: 'B' });
  assert.deepEqual(withListSummary([a, b], { ...b, name: 'B2' }).map((l) => l.name), ['Open house sign-ups', 'B2']);
  assert.deepEqual(withListSummary([a], b).map((l) => l.id), [10, 9]);
});

test('list changes are announced so the composer reloads its lists', () => {
  const seen = [];
  const prev = globalThis.window;
  globalThis.window = new EventTarget();
  try {
    globalThis.window.addEventListener(LISTS_CHANGED_EVENT, () => seen.push(1));
    announceListsChanged();
    assert.equal(seen.length, 1);
  } finally {
    globalThis.window = prev;
  }
  // No window (server, tests): nothing to tell, and no crash.
  announceListsChanged();
});
