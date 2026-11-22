// Chris 22 Nov 2026 (Q4, "Edit as HTML"): the composer's Sections | HTML switch. The draft keeps both; HTML goes out by
// email only; the PUT sends `content` only when it changed; Studio's own send checks look at the paste, not the sections.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDraft, draftFromNewsletter, draftToInput, changedFields, contentFrom } from '../../components/newsletters/lib/draft.ts';
import { forSending, htmlDocumentProblem, isHtmlMode, removedSummary, sendChannels, HTML_EMPTY, HTML_TOO_LONG, EMAIL_ONLY_NOTE, CONTENT_MODE_OPTIONS } from '../../components/newsletters/lib/htmlMode.ts';
import { sendProblems } from '../../components/newsletters/lib/sendFieldChecks.ts';
import { stepErrorsFrom } from '../../components/newsletters/lib/sendChecks.ts';
import { LIMITS } from '../../components/newsletters/lib/rules.ts';

const COUNTS = { recipients: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0, failed: 0, skipped: 0 };
const BASE = {
  id: 31, name: 'November Newsletter', subject: 'November specials', preview_text: '', from_name: 'The Body Politik', reply_to_email: 'hi@tbp.test',
  channels: ['email', 'sms'], sms_text: '', template: 'basic', header: { logo_url: null, banner_url: null, background_color: '#6C60FF', title: 'TBP' },
  blocks: [{ id: 'b1', type: 'title', data: { text: 'This month', size: 'large' } }], audience: [{ type: 'all_leads' }], status: 'draft',
  scheduled_at: null, sent_at: null, public_url: null, counts: COUNTS, created_at: '2026-11-22T10:00:00Z', updated_at: '2026-11-22T10:00:00Z',
};
const PASTE = '<!doctype html><html><head><style>.x{color:red}</style></head><body><p class="x">Lashes</p></body></html>';
const AUDIENCE = { email: 12, sms: 9, skipped: { no_email: 0, no_phone: 0, unsubscribed: 0, duplicate: 0 } };

test('the switch says Sections | HTML, and the note under Send by is short', () => {
  assert.deepEqual(CONTENT_MODE_OPTIONS.map((o) => o.label), ['Sections', 'HTML']);
  assert.equal(EMAIL_ONLY_NOTE, 'HTML emails go out by email only.');
});

test('an older newsletter (no content) opens on Sections with nothing pasted, and saves no content', () => {
  const d = draftFromNewsletter(BASE);
  assert.deepEqual(d.content, { mode: 'sections', html_document: '' });
  assert.equal(isHtmlMode(d), false);
  assert.deepEqual(emptyDraft().content, { mode: 'sections', html_document: '' });
  assert.equal('content' in changedFields(d, { ...d }), false, 'unchanged: never sent');
  assert.deepEqual(draftToInput(d).content, { mode: 'sections', html_document: null });
});

test('switching to HTML and pasting sends content; the sections stay in the draft', () => {
  const saved = draftFromNewsletter(BASE);
  const html = { ...saved, content: { mode: 'html', html_document: PASTE } };
  assert.deepEqual(changedFields(saved, html), { content: { mode: 'html', html_document: PASTE } });
  assert.deepEqual(html.blocks, saved.blocks);
  // Back to Sections: only the mode changes; the paste is still sent along, so it stays saved.
  const back = { ...html, content: { ...html.content, mode: 'sections' } };
  assert.deepEqual(changedFields(html, back), { content: { mode: 'sections', html_document: PASTE } });
});

test('the API content reads back as typed, and a list row (mode only) reads as no paste', () => {
  assert.deepEqual(contentFrom({ mode: 'html', html_document: PASTE }), { mode: 'html', html_document: PASTE });
  assert.deepEqual(contentFrom({ mode: 'html' }), { mode: 'html', html_document: '' });
  assert.deepEqual(contentFrom({ mode: 'mjml', html_document: 3 }), { mode: 'sections', html_document: '' });
  assert.deepEqual(contentFrom(null), { mode: 'sections', html_document: '' });
});

test('an HTML newsletter goes out by email only; the sections\' choice is kept', () => {
  const d = { ...draftFromNewsletter(BASE), content: { mode: 'html', html_document: PASTE } };
  assert.deepEqual(sendChannels(d), ['email']);
  assert.deepEqual(forSending(d).channels, ['email']);
  assert.deepEqual(d.channels, ['email', 'sms']);
  const sections = draftFromNewsletter(BASE);
  assert.deepEqual(sendChannels(sections), ['email', 'sms']);
  assert.equal(forSending(sections), sections);
  // Even with only Text message ticked for the sections.
  assert.deepEqual(sendChannels({ ...d, channels: ['sms'] }), ['email']);
});

test('Studio\'s send checks: the paste, not the sections; no text message needed', () => {
  const now = new Date('2026-11-22T12:00:00Z');
  const html = { ...draftFromNewsletter(BASE), blocks: [], content: { mode: 'html', html_document: PASTE } };
  const ok = sendProblems(html, AUDIENCE, { mode: 'now' }, now, 'TBP');
  assert.deepEqual(ok, { fields: {}, steps: {} }, 'no "add a section", no "write the text message"');

  const empty = sendProblems({ ...html, content: { mode: 'html', html_document: '   ' } }, AUDIENCE, { mode: 'now' }, now, 'TBP');
  assert.equal(empty.steps.content, HTML_EMPTY);

  // The same draft on Sections still needs its sections and its text.
  const sections = sendProblems({ ...html, content: { mode: 'sections', html_document: PASTE } }, AUDIENCE, { mode: 'now' }, now, 'TBP');
  assert.equal(sections.steps.content, 'Add at least one section to the email.');
  assert.equal(sections.fields.sms_text, 'Write the text message.');
});

test('the paste limit and the API\'s content errors go to the Content step', () => {
  assert.equal(htmlDocumentProblem(''), HTML_EMPTY);
  assert.equal(htmlDocumentProblem('<p>Hi</p>'), null);
  assert.equal(htmlDocumentProblem('x'.repeat(LIMITS.html_document + 1)), HTML_TOO_LONG);
  assert.equal(HTML_TOO_LONG, 'HTML can be up to 300,000 characters.');
  assert.deepEqual(stepErrorsFrom({ content: 'Paste the HTML for your email.' }), { content: 'Paste the HTML for your email.' });
});

test('what the cleaning removed reads as one short line', () => {
  assert.equal(removedSummary([]), null);
  assert.equal(removedSummary(undefined), null);
  assert.deepEqual(removedSummary([
    { type: 'script', count: 4, label: '4 scripts' },
    { type: 'pixel', count: 1, label: '1 tracking pixel' },
  ]), { title: 'We removed 5 unsupported items', detail: '4 scripts, 1 tracking pixel' });
  assert.deepEqual(removedSummary([{ type: 'form', count: 1, label: '1 form' }]), { title: 'We removed 1 unsupported item', detail: '1 form' });
});
