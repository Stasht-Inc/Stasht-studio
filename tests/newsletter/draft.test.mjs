import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDraft, draftFromNewsletter, draftToInput, changedFields, fieldProblems, DEFAULT_HEADER, mergeUntouched, savableChanges, rejectedKeys } from '../../components/newsletters/lib/draft.ts';
import { LIMITS, isPlausibleEmail } from '../../components/newsletters/lib/rules.ts';

const COUNTS = { recipients: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0, failed: 0, skipped: 0 };
const SPEC_NEWSLETTER = {
  id: 12, name: 'October Newsletter 2026', subject: 'October deals are here', preview_text: 'New arrivals and service specials',
  from_name: 'Serpa Chrysler', reply_to_email: 'sales@serpachrysler.ca', channels: ['email', 'sms'], sms_text: 'October deals are here.',
  template: 'basic', header: { logo_url: null, banner_url: null, background_color: '#6C60FF', title: 'Serpa Chrysler' },
  blocks: [{ id: 'b2', type: 'title', data: { text: 'This month', size: 'large' } }],
  audience: [{ type: 'all_leads' }, { type: 'lead_group', id: 4 }], status: 'draft', scheduled_at: null, sent_at: null,
  public_url: null, counts: COUNTS, created_at: '2026-10-15T10:00:00Z', updated_at: '2026-10-15T10:00:00Z',
};

test('LIMITS copy spec §8', () => {
  assert.deepEqual(LIMITS, { name: 120, subject: 150, preview_text: 200, from_name: 80, sms_text: 120, blocks: 40, title: 200, text_html: 20000, button_label: 40, url: 2000 });
});

test('isPlausibleEmail', () => {
  assert.equal(isPlausibleEmail('sales@serpachrysler.ca'), true);
  assert.equal(isPlausibleEmail('sales@serpachrysler'), false);
  assert.equal(isPlausibleEmail('sales serpachrysler.ca'), false);
});

test('emptyDraft starts with all leads by email and the purple header', () => {
  const d = emptyDraft();
  assert.deepEqual(d.audience, [{ type: 'all_leads' }]);
  assert.deepEqual(d.channels, ['email']);
  assert.deepEqual(d.header, DEFAULT_HEADER);
  assert.equal(d.header.background_color, '#6C60FF');
  assert.equal(d.template, 'basic');
  assert.deepEqual(d.blocks, []);
  assert.equal(emptyDraft({ title: 'Serpa', logo_url: 'https://cdn.example/l.png' }).header.title, 'Serpa');
});

test('draftFromNewsletter turns nulls into empty strings and keeps arrays', () => {
  const d = draftFromNewsletter({ ...SPEC_NEWSLETTER, subject: null, sms_text: null, header: null });
  assert.equal(d.subject, '');
  assert.equal(d.sms_text, '');
  assert.deepEqual(d.header, DEFAULT_HEADER);
  assert.deepEqual(d.channels, ['email', 'sms']);
  assert.equal(d.blocks.length, 1);
});

test('draftToInput trims text and sends null for empty text', () => {
  const input = draftToInput({ ...emptyDraft(), name: '  October  ', subject: '   ' });
  assert.equal(input.name, 'October');
  assert.equal(input.subject, null);
  assert.equal(input.reply_to_email, null);
  assert.deepEqual(input.audience, [{ type: 'all_leads' }]);
});

test('changedFields sends everything first, then only what changed', () => {
  const saved = draftFromNewsletter(SPEC_NEWSLETTER);
  assert.ok(Object.keys(changedFields(null, saved)).includes('blocks'));
  assert.deepEqual(changedFields(saved, saved), {});
  assert.deepEqual(changedFields(saved, { ...saved, subject: 'New subject' }), { subject: 'New subject' });
  assert.deepEqual(changedFields(saved, { ...saved, subject: 'October deals are here ' }), {}, 'trailing space alone is not a change');
  const moved = { ...saved, audience: [{ type: 'all_leads' }] };
  assert.deepEqual(changedFields(saved, moved), { audience: [{ type: 'all_leads' }] });
});

test('fieldProblems flags long text and a bad reply-to address', () => {
  assert.deepEqual(fieldProblems(emptyDraft()), {});
  const p = fieldProblems({ ...emptyDraft(), name: 'x'.repeat(121), reply_to_email: 'sales@' });
  assert.equal(p.name, 'Use 120 characters or fewer.');
  assert.equal(p.reply_to_email, 'Enter an email address like sales@yourbusiness.com.');
});

test('draftFromNewsletter gives the editor strings where the API stores null', () => {
  const d = draftFromNewsletter({ ...SPEC_NEWSLETTER, blocks: [{ id: 'b1', type: 'button', data: { label: 'Go', url: null, color: '#6C60FF' } }] });
  assert.deepEqual(d.blocks, [{ id: 'b1', type: 'button', data: { label: 'Go', url: '', color: '#6C60FF' } }]);
});

// Review fixes (Tasks 1-3).
test('a blank name is left out of the PUT body (the API answers 422 to name: null)', () => {
  const input = draftToInput({ ...emptyDraft(), name: '   ', subject: 'Hi' });
  assert.equal('name' in input, false);
  assert.equal(input.subject, 'Hi');
  const saved = draftFromNewsletter(SPEC_NEWSLETTER);
  assert.deepEqual(changedFields(saved, { ...saved, name: '' }), {}, 'clearing the name sends nothing');
});

test('mergeUntouched takes the server copy for every field the person has not touched', () => {
  const server = draftFromNewsletter({ ...SPEC_NEWSLETTER, subject: null, audience: [], blocks: [] });
  const local = { ...emptyDraft(), subject: 'Typed subject' };
  const merged = mergeUntouched(local, server, new Set(['subject']));
  assert.equal(merged.subject, 'Typed subject', 'touched field kept');
  assert.equal(merged.name, 'October Newsletter 2026', 'server default name shown');
  assert.equal(merged.from_name, 'Serpa Chrysler');
  assert.equal(merged.reply_to_email, 'sales@serpachrysler.ca');
  assert.deepEqual(merged.header, server.header);
  assert.deepEqual(merged.audience, [{ type: 'all_leads' }], 'an empty server value never replaces a local default');
  assert.deepEqual(mergeUntouched(local, server, new Set(['name', 'from_name'])).from_name, '', 'touched and cleared stays cleared');
});

test('savableChanges holds back a field that would not pass, and keeps it dirty', () => {
  const saved = draftFromNewsletter(SPEC_NEWSLETTER);
  const current = { ...saved, subject: 'New subject', reply_to_email: 'sales@' };
  const { patch, nextSaved, held } = savableChanges(saved, current);
  assert.deepEqual(patch, { subject: 'New subject' });
  assert.deepEqual(held, ['reply_to_email']);
  assert.equal(nextSaved.subject, 'New subject');
  assert.equal(nextSaved.reply_to_email, 'sales@serpachrysler.ca', 'the held field still differs from what is saved');
  assert.deepEqual(changedFields(nextSaved, { ...current, reply_to_email: 'sales@serpa.ca' }), { reply_to_email: 'sales@serpa.ca' });
  assert.deepEqual(savableChanges(saved, saved), { patch: {}, nextSaved: saved, held: [] });
});

// Review fix 4: an over-long text block stays out of the autosave patch (kept dirty) so other edits still save.
test('savableChanges keeps an over-long text block out of the patch and the rest saves', () => {
  const saved = { ...draftFromNewsletter(SPEC_NEWSLETTER), blocks: [{ id: 't1', type: 'text', data: { html: '<p>short</p>' } }] };
  const long = { id: 't1', type: 'text', data: { html: `<p>${'x'.repeat(20001)}</p>` } };
  const added = { id: 'b9', type: 'title', data: { text: 'New', size: 'large' } };
  const current = { ...saved, subject: 'New subject', blocks: [long, added] };
  const { patch, nextSaved, held } = savableChanges(saved, current);
  assert.equal(patch.subject, 'New subject');
  assert.deepEqual(patch.blocks, [saved.blocks[0], added], 'the long block keeps its saved version; the new title saves');
  assert.deepEqual(held, ['blocks']);
  assert.deepEqual(nextSaved.blocks, [saved.blocks[0], added]);
  assert.notDeepEqual(nextSaved.blocks, current.blocks, 'still dirty');
  // A new over-long block that was never saved is left out entirely; nothing else changed, so no blocks in the patch.
  const fresh = { ...saved, blocks: [saved.blocks[0], { ...long, id: 't2' }] };
  const r = savableChanges(saved, fresh);
  assert.equal('blocks' in r.patch, false);
  assert.deepEqual(r.held, ['blocks']);
  // Fixed: saves as usual.
  const fixed = savableChanges(nextSaved, { ...current, blocks: [{ ...long, data: { html: '<p>short again</p>' } }, added] });
  assert.deepEqual(fixed.held, []);
  assert.equal(fixed.patch.blocks[0].data.html, '<p>short again</p>');
});

// Review 9–12 #1a/#1b: what the API would refuse is caught while typing.
test('fieldProblems counts sms_text as sent and checks email like PHP FILTER_VALIDATE_EMAIL', () => {
  const d = emptyDraft();
  assert.ok(fieldProblems({ ...d, sms_text: `${'x'.repeat(118)}…` }).sms_text, '… counts as three');
  assert.equal(fieldProblems({ ...d, sms_text: 'x'.repeat(120) }).sms_text, undefined);
  for (const bad of ['a..b@x.ca', '.a@x.ca', 'a.@x.ca', 'a@x..ca', 'a@-x.ca', 'a@x-.ca', 'a b@x.ca', 'a@x', 'a@x.c_a', 'a(b)@x.ca']) {
    assert.equal(isPlausibleEmail(bad), false, bad);
  }
  for (const good of ['sales@serpachrysler.ca', 'first.last+news@mail.serpa-chrysler.co.uk', "o'neil@x.ca", 'a_b@x.io', 'x@123.45.ca']) {
    assert.equal(isPlausibleEmail(good), true, good);
  }
});

// Review 9–12 #1c: on a 422, the keys it names are held (stay dirty) and the rest of the patch is retried.
test('rejectedKeys names the patch fields a 422 refused', () => {
  assert.deepEqual(rejectedKeys({ subject: 'x', from_name: 'y', blocks: [] }, { from_name: 'Too long.', 'blocks.2.data.url': 'Use https.', blocks: 'Use https.' }), ['from_name', 'blocks']);
  assert.deepEqual(rejectedKeys({ subject: 'x' }, { name: 'Required.' }), []);
});
