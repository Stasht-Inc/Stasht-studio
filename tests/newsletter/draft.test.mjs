import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDraft, draftFromNewsletter, draftToInput, changedFields, fieldProblems, DEFAULT_HEADER } from '../../components/newsletters/lib/draft.ts';
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
