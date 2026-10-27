// [wdy2xh2p3k] Manage lists: what each list shows, and a deleted list leaves the draft's recipients.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listDetails, listOrigin, withoutList, memberConsentText } from '../../components/newsletters/lib/manageLists.ts';

const list = { id: 9, name: 'Open house sign-ups', source: 'import', member_count: 212, email_count: 198, sms_count: 140, consent_type: 'express', created_at: '2026-10-02T15:00:00Z' };

test('where a list came from, with its date', () => {
  assert.equal(listOrigin(list, 'en-US'), 'Imported Oct 2, 2026');
  assert.equal(listOrigin({ ...list, source: 'leads' }, 'en-US'), 'Made from leads Oct 2, 2026');
  assert.equal(listOrigin({ ...list, source: 'lead_group', created_at: null }, 'en-US'), 'Made from a lead group');
});

test('one line per list: size, consent, origin', () => {
  assert.equal(listDetails(list, 'en-US'), '212 contacts · Express consent · Imported Oct 2, 2026');
  assert.equal(listDetails({ ...list, member_count: 1, consent_type: 'implied' }, 'en-US'), '1 contact · Implied consent · Imported Oct 2, 2026');
  assert.equal(listDetails({ ...list, consent_type: null }, 'en-US'), '212 contacts · Consent not recorded · Imported Oct 2, 2026');
});

test('a member’s consent, in plain words', () => {
  assert.equal(memberConsentText({ consent_type: 'implied', consent_at: '2026-05-01T04:00:00Z' }, 'en-US'), 'Implied, May 1, 2026');
  assert.equal(memberConsentText({ consent_type: 'express', consent_at: null }, 'en-US'), 'Express');
  assert.equal(memberConsentText({}, 'en-US'), '—');
});

test('a deleted list leaves the recipients', () => {
  const audience = [{ type: 'all_leads' }, { type: 'list', id: 9 }, { type: 'list', id: 10 }, { type: 'lead_group', id: 9 }];
  assert.deepEqual(withoutList(audience, 9), [{ type: 'all_leads' }, { type: 'list', id: 10 }, { type: 'lead_group', id: 9 }]);
  assert.equal(withoutList(audience, 77), audience, 'unchanged: the same array');
});
