import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeTextHtml, textHtmlIsEmpty, parseTextHtml, decodeEntities, safeLinkHref, editorHtml } from '../../components/newsletters/lib/textHtml.ts';

const NBSP = ' ';

test('keeps the allowed subset as is', () => {
  assert.equal(sanitizeTextHtml('<p>Hello <strong>there</strong></p>'), '<p>Hello <strong>there</strong></p>');
  assert.equal(sanitizeTextHtml('<ul><li>One</li><li>Two</li></ul>'), '<ul><li>One</li><li>Two</li></ul>');
  assert.equal(sanitizeTextHtml('<ol><li>One</li></ol>'), '<ol><li>One</li></ol>');
});

test('maps what browsers produce: b, i, div, headings (as the API does)', () => {
  assert.equal(sanitizeTextHtml('<b>Bold</b> and <i>it</i>'), '<p><strong>Bold</strong> and <em>it</em></p>');
  assert.equal(sanitizeTextHtml('<div>One</div><div>Two</div>'), '<p>One</p><p>Two</p>');
  assert.equal(sanitizeTextHtml('First line<div>Second</div>'), '<p>First line</p><p>Second</p>');
  assert.equal(sanitizeTextHtml('<div><br></div>'), '<p><br></p>');
  assert.equal(sanitizeTextHtml('<h2>Big</h2>'), '<p>Big</p>');
});

test('drops scripts, styles, attributes and unknown tags', () => {
  assert.equal(sanitizeTextHtml('<p>Hi<script>alert(1)</script></p>'), '<p>Hi</p>');
  assert.equal(sanitizeTextHtml('<style>p{color:red}</style><p>Hi</p>'), '<p>Hi</p>');
  assert.equal(sanitizeTextHtml('<p onclick="x()" style="color:red">Hi</p>'), '<p>Hi</p>');
  assert.equal(sanitizeTextHtml('<span style="x">Hi <u>there</u></span>'), '<p>Hi there</p>');
  assert.equal(sanitizeTextHtml('<img src=x onerror=alert(1)>Hi'), '<p>Hi</p>');
  assert.equal(sanitizeTextHtml('<!-- note --><p>Hi</p>'), '<p>Hi</p>');
  assert.equal(sanitizeTextHtml('<p>Hi</p><form><p>Log in</p></form><video>x</video>'), '<p>Hi</p>');
});

test('links: https and mailto only, other attributes dropped', () => {
  assert.equal(
    sanitizeTextHtml('<a href="https://serpachrysler.ca/deals" target="_blank" onclick="x">Deals</a>'),
    '<p><a href="https://serpachrysler.ca/deals">Deals</a></p>',
  );
  assert.equal(sanitizeTextHtml('<a href="mailto:sales@serpachrysler.ca">Email us</a>'), '<p><a href="mailto:sales@serpachrysler.ca">Email us</a></p>');
  assert.equal(sanitizeTextHtml('<a href="javascript:alert(1)">Click</a>'), '<p>Click</p>');
  assert.equal(sanitizeTextHtml('<a href="http://serpachrysler.ca">Old</a>'), '<p>Old</p>');
  assert.equal(sanitizeTextHtml('<a>Bare</a> words'), '<p>Bare words</p>');
  assert.equal(safeLinkHref('mailto:nobody'), null);
  assert.equal(safeLinkHref("mailto:o'neil@x.ca"), null, 'the API refuses quotes in links');
  assert.equal(safeLinkHref('https://serpachrysler.ca'), 'https://serpachrysler.ca/');
});

test('text is escaped and entities survive a round trip', () => {
  assert.equal(sanitizeTextHtml('<p>Tom &amp; Jerry &lt;3 &quot;hi&quot;</p>'), '<p>Tom &amp; Jerry &lt;3 &quot;hi&quot;</p>');
  assert.equal(sanitizeTextHtml('1 < 2'), '<p>1 &lt; 2</p>');
  assert.equal(sanitizeTextHtml('a&nbsp;b'), `<p>a${NBSP}b</p>`);
  assert.equal(decodeEntities('&#39;&#x41;&unknown;'), "'A&unknown;");
});

test('emptiness and parse shape', () => {
  assert.equal(textHtmlIsEmpty('<p><br></p>'), true);
  assert.equal(textHtmlIsEmpty('<p>&nbsp;</p>'), true);
  assert.equal(textHtmlIsEmpty(''), true);
  assert.equal(textHtmlIsEmpty(null), true);
  assert.equal(textHtmlIsEmpty('<p>x</p>'), false);
  assert.deepEqual(parseTextHtml('<p>a<br>b</p>'), [{ kind: 'el', tag: 'p', children: [{ kind: 'text', text: 'a' }, { kind: 'br' }, { kind: 'text', text: 'b' }] }]);
});

// Review fix 8: a cleared editor leaves <p><br></p>; it is saved as '' so the placeholder shows.
test('editorHtml cleans what contentEditable holds and treats a blank editor as empty', () => {
  assert.equal(editorHtml('<p><br></p>'), '');
  assert.equal(editorHtml('<div><br></div>'), '');
  assert.equal(editorHtml('&nbsp;'), '');
  assert.equal(editorHtml('<b>Hi</b>'), '<p><strong>Hi</strong></p>');
  assert.equal(safeLinkHref("https://a.ca/it's"), 'https://a.ca/it%27s', 'a quote in an https link is encoded, not refused');
});
