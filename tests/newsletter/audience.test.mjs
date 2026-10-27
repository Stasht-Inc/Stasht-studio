import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ZERO_COUNT, audienceKey, hasAudienceItem, toggleAudienceItem, toggleChannel, audienceLabel, formatCount, reachable,
  countSummary, skippedSummary, smsInfo, smsPreview, groupsFromApi, smsPlain,
} from '../../components/newsletters/lib/audience.ts';

const groups = [{ id: 4, name: 'VIP buyers', member_count: 38 }];
const lists = [{ id: 9, name: 'Open house sign-ups', source: 'import', member_count: 212, email_count: 198, sms_count: 140, created_at: '' }];
const counts = { email: 1414, sms: 480, skipped: { no_email: 24, no_phone: 0, unsubscribed: 3, duplicate: 11 } };

test('audience items toggle by type and id', () => {
  assert.equal(audienceKey({ type: 'all_leads' }), 'all_leads');
  assert.equal(audienceKey({ type: 'list', id: 9 }), 'list:9');
  const a = toggleAudienceItem([{ type: 'all_leads' }], { type: 'lead_group', id: 4 });
  assert.deepEqual(a, [{ type: 'all_leads' }, { type: 'lead_group', id: 4 }]);
  assert.equal(hasAudienceItem(a, { type: 'lead_group', id: 4 }), true);
  assert.equal(hasAudienceItem(a, { type: 'list', id: 4 }), false);
  assert.deepEqual(toggleAudienceItem(a, { type: 'all_leads' }), [{ type: 'lead_group', id: 4 }]);
});

test('channels stay in the order email, sms', () => {
  assert.deepEqual(toggleChannel(['sms'], 'email'), ['email', 'sms']);
  assert.deepEqual(toggleChannel(['email', 'sms'], 'email'), ['sms']);
});

test('audienceLabel names the first pick and counts the rest', () => {
  assert.equal(audienceLabel([], groups, lists), 'Choose recipients');
  assert.equal(audienceLabel([{ type: 'all_leads' }], groups, lists), 'All leads');
  assert.equal(audienceLabel([{ type: 'list', id: 9 }, { type: 'lead_group', id: 4 }], groups, lists), 'Open house sign-ups + 1 more');
  assert.equal(audienceLabel([{ type: 'list', id: 77 }], groups, lists), 'A list that was deleted');
});

test('counts read plainly', () => {
  assert.equal(formatCount(1414), '1,414');
  assert.equal(reachable(counts, ['email']), 1414);
  assert.equal(reachable(counts, ['email', 'sms']), 1894);
  assert.equal(countSummary(counts, ['email']), '1,414');
  assert.equal(countSummary(counts, ['sms']), '480 texts');
  assert.equal(countSummary(counts, ['email', 'sms']), '1,414 emails · 480 texts');
  assert.equal(countSummary(null, ['email']), '—');
  assert.equal(skippedSummary(counts, ['email']), 'Not included: 24 with no email address, 3 unsubscribed, 11 listed twice.');
  assert.equal(skippedSummary(ZERO_COUNT, ['email']), '');
});

test('SMS helpers', () => {
  assert.deepEqual(smsInfo('October deals are here.'), { length: 23, remaining: 97, over: false });
  assert.equal(smsInfo('x'.repeat(121)).over, true);
  assert.equal(smsPreview('  Hi  '), 'Hi (link to your newsletter) Reply STOP to opt out.');
  assert.equal(smsPreview(''), 'Your message (link to your newsletter) Reply STOP to opt out.');
});

test('groupsFromApi reads every shape the lead-groups endpoint has used', () => {
  const row = { id: 4, name: 'VIP buyers', member_count: 38, members: [] };
  assert.deepEqual(groupsFromApi([row]), groups);
  assert.deepEqual(groupsFromApi({ groups: [row] }), groups);
  assert.deepEqual(groupsFromApi({ success: true, data: [row] }), groups);
  assert.deepEqual(groupsFromApi({ success: true, data: { groups: [row] } }), groups);
  assert.deepEqual(groupsFromApi(null), []);
});

// Review 9–12 #1a: the 120 limit counts the text as it is sent (NewsletterRenderer::smsPlain folds … to ... etc.).
test('smsPlain folds punctuation like the server, and smsInfo counts the folded text', () => {
  assert.equal(smsPlain('It’s “here” – now…'), 'It\'s "here" - now...');
  assert.equal(smsPlain('  a   b\t\tc  '), 'a b c');
  assert.equal(smsPlain('• deal — − ′ ″ ‚ „ ―   '), '- deal - - \' " \' " -');
  const text = `${'x'.repeat(118)}…`; // 119 characters typed, 121 sent
  assert.deepEqual(smsInfo(text), { length: 121, remaining: -1, over: true });
});
