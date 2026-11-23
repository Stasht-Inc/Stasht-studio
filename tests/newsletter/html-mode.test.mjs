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

// ---- Q4 follow-up (Chris 22 Nov 2026): fonts and pictures in a pasted template; Add image.
import { switchedNote, brokenPicturesNote, imageTag, insertSnippet, DATA_PICTURES_HINT } from '../../components/newsletters/lib/htmlMode.ts';

test('http pictures switched to https are noted as info', () => {
  assert.equal(switchedNote(0), null);
  assert.equal(switchedNote(undefined), null);
  assert.equal(switchedNote(1), '1 picture switched to https');
  assert.equal(switchedNote(3), '3 pictures switched to https');
});

test('pictures that did not load are listed once each', () => {
  assert.equal(brokenPicturesNote([]), null);
  assert.deepEqual(brokenPicturesNote(['https://a.test/x.png', 'https://a.test/x.png', '', 'https://b.test/y.jpg']),
    { title: "2 pictures didn't load", urls: ['https://a.test/x.png', 'https://b.test/y.jpg'] });
  assert.equal(brokenPicturesNote(['https://a.test/x.png']).title, "1 picture didn't load");
});

test('Add image writes an email-safe img tag, its address escaped', () => {
  assert.equal(imageTag('https://cdn.test/a.jpg'), '<img src="https://cdn.test/a.jpg" alt="" style="display:block;max-width:100%;height:auto;" width="600">');
  assert.equal(imageTag('https://cdn.test/a.jpg?x=1&y="><script>'), '<img src="https://cdn.test/a.jpg?x=1&amp;y=&quot;&gt;&lt;script&gt;" alt="" style="display:block;max-width:100%;height:auto;" width="600">');
  assert.match(DATA_PICTURES_HINT, /Add image/);
});

test('the tag goes at the cursor, over a selection, or at the end on its own line', () => {
  assert.deepEqual(insertSnippet('<p>a</p><p>b</p>', '<img>', 8, 8), { value: '<p>a</p><img><p>b</p>', cursor: 13 });
  assert.deepEqual(insertSnippet('<p>a</p>OLD', '<img>', 8, 11), { value: '<p>a</p><img>', cursor: 13 });
  assert.deepEqual(insertSnippet('<p>a</p>', '<img>', null, null), { value: '<p>a</p>\n<img>', cursor: 14 });
  assert.deepEqual(insertSnippet('', '<img>', null, null), { value: '<img>', cursor: 5 });
  assert.deepEqual(insertSnippet('ab', '<img>', 5, 9), { value: 'ab\n<img>', cursor: 8 }, 'a cursor past the end: at the end');
});

// 23 Nov 2026 (Deepak): the "own unsubscribe link" note shows only when the paste carries one.
import { hasOwnUnsubscribe, OWN_UNSUBSCRIBE_NOTE } from '../../components/newsletters/lib/htmlMode.ts';
test('hasOwnUnsubscribe: Mailchimp tag, links and words; plain templates without one', () => {
  assert.equal(hasOwnUnsubscribe('<a href="*|UNSUB|*">Leave</a>'), true);
  assert.equal(hasOwnUnsubscribe('<a href="https://x.us1.list-manage.com/unsubscribe?u=1">here</a>'), true);
  assert.equal(hasOwnUnsubscribe('<p>You can Unsubscribe any time</p>'), true);
  assert.equal(hasOwnUnsubscribe('<a href="{{ unsubscribe_url }}">Opt out</a>'), true);
  assert.equal(hasOwnUnsubscribe('<table><tr><td><h1>Holiday lash packages</h1></td></tr></table>'), false);
  assert.equal(hasOwnUnsubscribe(''), false);
  assert.match(OWN_UNSUBSCRIBE_NOTE, /ours is added/);
});

// ---- Chris 23 Nov 2026 (A): switching an existing newsletter to HTML fills the box with its sections.
import { fillsFromSections, isGeneratedHtml, SECTIONS_AS_HTML_NOTE, SECTIONS_HTML_FAILED } from '../../components/newsletters/lib/htmlMode.ts';

test('the box is filled from the sections only when it is empty and there are sections', () => {
  const block = { id: 'b1', type: 'title', data: { text: 'Hi', size: 'large' } };
  assert.equal(fillsFromSections({ content: { mode: 'sections', html_document: '' }, blocks: [block] }), true);
  assert.equal(fillsFromSections({ content: { mode: 'sections', html_document: '  \n' }, blocks: [block] }), true);
  assert.equal(fillsFromSections({ content: { mode: 'sections', html_document: '<p>mine</p>' }, blocks: [block] }), false, 'never over a paste');
  assert.equal(fillsFromSections({ content: { mode: 'sections', html_document: '' }, blocks: [] }), false, 'no sections: empty box');
});

test('the note shows only while the box holds exactly the generated HTML', () => {
  assert.equal(isGeneratedHtml('<html>x</html>', '<html>x</html>\n'), true);
  assert.equal(isGeneratedHtml('<html>x</html> edited', '<html>x</html>'), false);
  assert.equal(isGeneratedHtml('', ''), false);
  assert.equal(isGeneratedHtml('<html>x</html>', null), false);
  assert.equal(SECTIONS_AS_HTML_NOTE, 'Your sections as HTML. Paste over it to use another email.');
  assert.match(SECTIONS_HTML_FAILED, /Paste your HTML/);
});

test('an empty Message section alone never fills the box (a new draft is ready for a pasted template)', () => {
  const empty = { content: { mode: 'sections', html_document: '' } };
  const message = (html) => ({ id: 'nl-message', type: 'text', data: { html } });
  assert.equal(fillsFromSections({ ...empty, blocks: [message('')] }), false, 'empty Message');
  assert.equal(fillsFromSections({ ...empty, blocks: [message('<p><br></p>')] }), false, 'blank editor Message');
  assert.equal(fillsFromSections({ ...empty, blocks: [message('<p>&nbsp; </p>')] }), false, 'spaces only');
  assert.equal(fillsFromSections({ ...empty, blocks: [message('<p>Lashes all year</p>')] }), true, 'a Message with words counts');
  assert.equal(fillsFromSections({ ...empty, blocks: [message(''), { id: 'b1', type: 'image', data: { url: null, alt: '', link: null } }] }), true, 'any other section counts');
  assert.equal(fillsFromSections({ ...empty, blocks: [{ id: 'b2', type: 'text', data: { html: '' } }] }), true, 'an ordinary text section counts even empty');
});
