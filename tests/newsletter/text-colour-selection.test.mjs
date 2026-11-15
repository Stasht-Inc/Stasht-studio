// Chris (10 Nov): "I can't change text color on selection. It changes the whole row text." With words selected, the
// Text colour goes on those words only, as an inline span (<span style="color:#RRGGBB">, the API's
// NewsletterHtmlSanitizer::color); Automatic (null) takes it away. With only a caret the toolbar still sets the whole
// section's colour (data.color). The span keeps any size / font the words had, and survives a save (sanitise) round trip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorAt, colorTextHtml, fontTextHtml, parseTextHtml, sanitizeTextHtml, spanOpen, styleColor } from '../../components/newsletters/lib/textHtml.ts';

const html = '<p>Smart Search finds it</p>';
// "Search" is characters 6..12.
const SEARCH = { start: 6, end: 12 };

test('a colour on a selected word colours only that word', () => {
  const out = colorTextHtml(html, '#dc2626', SEARCH);
  assert.equal(out, '<p>Smart <span style="color:#DC2626">Search</span> finds it</p>');
  // The saved payload is what the editor sends: sanitising it again changes nothing.
  assert.equal(sanitizeTextHtml(out), out);
  assert.equal(colorAt(parseTextHtml(out), 6, 12), '#DC2626');
  assert.equal(colorAt(parseTextHtml(out), 0, 5), null);
  assert.equal(colorAt(parseTextHtml(out), 0, 12), null); // mixed
});

test('Automatic removes the inline colour from the selection only', () => {
  const both = colorTextHtml(colorTextHtml(html, '#DC2626', SEARCH), '#2563EB', { start: 0, end: 5 });
  assert.equal(both, '<p><span style="color:#2563EB">Smart</span> <span style="color:#DC2626">Search</span> finds it</p>');
  assert.equal(colorTextHtml(both, null, SEARCH), '<p><span style="color:#2563EB">Smart</span> Search finds it</p>');
});

test('the colour keeps the word\'s font and size, in the API\'s order', () => {
  const georgia = fontTextHtml(html, 'georgia', SEARCH);
  const out = colorTextHtml(georgia, '#DC2626', { start: 6, end: 9 });
  assert.match(out, /<span style="font-family:Georgia[^"]*;color:#DC2626">Sea<\/span><span style="font-family:Georgia[^"]*">rch<\/span>/);
  assert.equal(spanOpen(20, null, '#dc2626'), '<span data-size="large" style="font-size:20px;color:#DC2626">');
});

test('only a plain hex colour is read; the editor\'s data-color wins over the browser\'s rgb()', () => {
  assert.equal(styleColor('color:#f00'), '#FF0000');
  assert.equal(styleColor('color:red'), null);
  assert.equal(styleColor('color:rgb(55, 65, 81)'), null);
  assert.equal(styleColor('background-color:#ff0000'), null);
  assert.equal(sanitizeTextHtml('<p><span data-color="#DC2626" style="color: rgb(220, 38, 38);">a</span></p>'), '<p><span style="color:#DC2626">a</span></p>');
  // A span the browser made when joining paragraphs (the editor's own colour, as rgb) is not kept.
  assert.equal(sanitizeTextHtml('<p><span style="color: rgb(55, 65, 81);">a</span></p>'), '<p>a</p>');
});
