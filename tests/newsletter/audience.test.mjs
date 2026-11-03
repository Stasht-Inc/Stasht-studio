import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ZERO_COUNT, audienceKey, hasAudienceItem, toggleAudienceItem, toggleChannel, audienceLabel, formatCount, reachable,
  countSummary, skippedSummary, smsInfo, smsPreview, groupsFromApi, smsPlain,
  isSinglePerson, personAudience, personDetail, personId, personName, toggleGroupItem,
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
  assert.equal(countSummary({ ...ZERO_COUNT, email: 1, sms: 1 }, ['email', 'sms']), '1 email · 1 text', 'one person');
  assert.equal(countSummary({ ...ZERO_COUNT, sms: 1 }, ['sms']), '1 text');
  assert.equal(skippedSummary(counts, ['email']), 'Not included: 24 with no email address, 3 unsubscribed, 11 listed twice.');
  assert.equal(skippedSummary(ZERO_COUNT, ['email']), '');
});

test('SMS helpers', () => {
  assert.deepEqual(smsInfo('October deals are here.'), { length: 23, remaining: 1977, over: false });
  assert.equal(smsInfo('x'.repeat(121)).over, false, 'no 120 limit any more (Chris, 3 Nov)');
  assert.equal(smsInfo('x'.repeat(2001)).over, true);
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

// Review 9–12 #1a: the limit counts the text as it is sent (NewsletterRenderer::smsPlain folds … to ... etc.). It is
// 2,000 since Chris's 3 Nov fix (was 120).
test('smsPlain folds punctuation like the server, and smsInfo counts the folded text', () => {
  assert.equal(smsPlain('It’s “here” – now…'), 'It\'s "here" - now...');
  assert.equal(smsPlain('  a   b\t\tc  '), 'a b c');
  assert.equal(smsPlain('• deal — − ′ ″ ‚ „ ―   '), '- deal - - \' " \' " -');
  const text = `${'x'.repeat(1998)}…`; // 1,999 characters typed, 2,001 sent
  assert.deepEqual(smsInfo(text), { length: 2001, remaining: -1, over: true });
  assert.deepEqual(smsInfo('x'.repeat(500)), { length: 500, remaining: 1500, over: false }, 'no 120 limit any more');
});

// Chris, 3 Nov 2026: "Single person" first in Send to and the default for a new newsletter.
test('Single person: the default for a new draft, one lead or nothing yet, and one or the other with lists', async () => {
  const { emptyDraft } = await import('../../components/newsletters/lib/draft.ts');
  assert.deepEqual(emptyDraft().audience, [], 'a new newsletter starts on Single person with nobody picked yet');
  assert.equal(isSinglePerson([]), true);
  assert.equal(isSinglePerson([], true), false, 'choosing lists with nothing ticked yet stays on lists');
  assert.equal(isSinglePerson(personAudience(7101)), true);
  assert.equal(isSinglePerson([{ type: 'all_leads' }]), false, 'an older draft keeps its saved audience');
  assert.equal(personId(personAudience(7101)), 7101);
  assert.equal(personId([{ type: 'all_leads' }]), null);
  assert.deepEqual(personAudience(7101), [{ type: 'lead', id: 7101 }]);
  assert.equal(audienceKey({ type: 'lead', id: 7101 }), 'lead:7101');
  // Ticking a list leaves Single person; the lead goes.
  assert.deepEqual(toggleGroupItem(personAudience(7101), { type: 'all_leads' }), [{ type: 'all_leads' }]);
  assert.deepEqual(toggleGroupItem([{ type: 'all_leads' }], { type: 'list', id: 9 }), [{ type: 'all_leads' }, { type: 'list', id: 9 }]);
  assert.equal(audienceLabel(personAudience(7101), [], [], 'Jordan Price'), 'Jordan Price');
  assert.equal(audienceLabel(personAudience(7101), [], []), 'Single person');
});

test('a lead reads as its name, else its email, else its mobile; the line under it has both', () => {
  assert.equal(personName({ name: 'Jordan Price', email: 'j@example.com', phone: null }), 'Jordan Price');
  assert.equal(personName({ name: '  ', email: 'walkin@example.com', phone: null }), 'walkin@example.com');
  assert.equal(personName({ name: null, email: null, phone: '+14165550171' }), '+1 416 555 0171');
  assert.equal(personName({ name: null, email: null, phone: null }), 'Unnamed lead');
  assert.equal(personDetail({ name: 'J', email: 'j@example.com', phone: '+14165550171' }), 'j@example.com · +1 416 555 0171');
  assert.equal(personDetail({ name: 'J', email: null, phone: null }), 'No email or mobile number');
  assert.equal(personDetail({ name: null, email: 'walkin@example.com', phone: null }), '', 'the email read as the name is not repeated');
  assert.equal(personDetail({ name: null, email: 'walkin@example.com', phone: '+14165550171' }), '+1 416 555 0171');
});
