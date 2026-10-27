// wdy2xh2p3p Editor polish: undo delete, phone photos, paste formatting, size hint, locale-aware dates/numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreBlock } from '../../components/newsletters/lib/blocks.ts';
import { pastedTextNodes, serializeTextNodes } from '../../components/newsletters/lib/textHtml.ts';
import { isHeic, planImage, MAX_IMAGE_SIDE, REENCODE_ABOVE_BYTES } from '../../components/newsletters/lib/images.ts';
import { previewSizeHint } from '../../components/newsletters/lib/sendChecks.ts';
import { userLocale } from '../../components/newsletters/lib/locale.ts';
import { formatCount } from '../../components/newsletters/lib/audience.ts';
import { formatResetDate } from '../../components/newsletters/lib/sendChecks.ts';
import { formatSendTime } from '../../components/newsletters/lib/schedule.ts';

const title = (id) => ({ id, type: 'title', data: { text: id, size: 'large' } });

test('restoreBlock puts a deleted section back where it was, once', () => {
  const list = [title('a'), title('c')];
  const back = restoreBlock(list, title('b'), 1);
  assert.deepEqual(back.map((b) => b.id), ['a', 'b', 'c']);
  assert.equal(restoreBlock(back, title('b'), 1), back, 'already there: unchanged');
  assert.deepEqual(restoreBlock(list, title('z'), 99).map((b) => b.id), ['a', 'c', 'z'], 'index past the end goes last');
});

test('pasted HTML keeps only the allowed formatting', () => {
  const nodes = pastedTextNodes('<meta charset="utf-8"><p style="color:red">Hello <b>bold</b> and <i>it</i> <span style="font-size:30px">big</span> <a href="javascript:alert(1)">bad</a> <a href="https://serpa.ca">good</a></p><script>x()</script>');
  assert.equal(serializeTextNodes(nodes), '<p>Hello <strong>bold</strong> and <em>it</em> big bad <a href="https://serpa.ca/">good</a></p>');
  assert.ok(!nodes.some((n) => n.kind === 'el' && n.tag === 'p'), 'one paragraph pastes inline');
});

test('one pasted paragraph goes in as words (inline), several stay paragraphs and lists', () => {
  assert.deepEqual(pastedTextNodes('<p>Just <em>this</em></p>').map((n) => n.kind), ['text', 'el']);
  const many = serializeTextNodes(pastedTextNodes('<p>One</p><p>Two</p><ul><li>A</li></ul>'));
  assert.equal(many, '<p>One</p><p>Two</p><ul><li>A</li></ul>');
});

test('Google Docs wraps everything in a non-bold <b>: it does not turn the paste bold', () => {
  const html = '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1234"><p dir="ltr"><span>Plain words</span></p></b>';
  const nodes = pastedTextNodes(html);
  assert.ok(!JSON.stringify(nodes).includes('strong'), 'not bold');
  assert.deepEqual(nodes, [{ kind: 'text', text: 'Plain words' }]);
});

test('Word conditional comments and o:p tags leave no stray text', () => {
  const html = '<html><head><style>p{}</style></head><body><!--StartFragment--><p class=MsoNormal><![if !supportLists]>1.<![endif]>Item<o:p></o:p></p><!--EndFragment--></body></html>';
  assert.deepEqual(pastedTextNodes(html), [{ kind: 'text', text: '1.Item' }]);
});

test('isHeic by type or file name', () => {
  assert.equal(isHeic({ type: 'image/heic', name: 'a' }), true);
  assert.equal(isHeic({ type: 'image/heif', name: 'a' }), true);
  assert.equal(isHeic({ type: '', name: 'IMG_0001.HEIC' }), true);
  assert.equal(isHeic({ type: 'image/jpeg', name: 'a.jpg' }), false);
});

test('planImage: big phone photos are shrunk and saved as JPEG; small ones and GIFs are left alone', () => {
  assert.equal(MAX_IMAGE_SIDE, 1600);
  const photo = planImage({ type: 'image/jpeg', size: 4_000_000 }, { width: 4032, height: 3024 });
  assert.deepEqual(photo, { action: 'reencode', type: 'image/jpeg', width: 1600, height: 1200 });
  const portrait = planImage({ type: 'image/jpeg', size: 2_000_000 }, { width: 3024, height: 4032 });
  assert.deepEqual(portrait, { action: 'reencode', type: 'image/jpeg', width: 1200, height: 1600 });
  assert.deepEqual(planImage({ type: 'image/jpeg', size: 200_000 }, { width: 800, height: 600 }), { action: 'keep' });
  // Under the size limit but heavy: re-saved at the same size.
  assert.deepEqual(planImage({ type: 'image/jpeg', size: REENCODE_ABOVE_BYTES + 1 }, { width: 1200, height: 800 }), { action: 'reencode', type: 'image/jpeg', width: 1200, height: 800 });
  assert.deepEqual(planImage({ type: 'image/gif', size: 4_000_000 }, { width: 3000, height: 3000 }), { action: 'keep' });
  // PNG keeps PNG (logos keep their see-through background); only shrunk when too big.
  assert.deepEqual(planImage({ type: 'image/png', size: 3_000_000 }, { width: 3000, height: 1000 }), { action: 'reencode', type: 'image/png', width: 1600, height: 533 });
  assert.deepEqual(planImage({ type: 'image/png', size: 3_000_000 }, { width: 1200, height: 400 }), { action: 'keep' });
  // HEIC always becomes JPEG.
  assert.deepEqual(planImage({ type: 'image/heic', size: 900_000 }, { width: 1000, height: 800 }), { action: 'reencode', type: 'image/jpeg', width: 1000, height: 800 });
});

test('previewSizeHint from 80 KB up', () => {
  assert.equal(previewSizeHint(undefined), null);
  assert.equal(previewSizeHint(null), null);
  assert.equal(previewSizeHint(79), null);
  assert.equal(previewSizeHint(80), 'About 80 KB — Gmail hides the end of emails over about 100 KB.');
  assert.equal(previewSizeHint(104.6), 'About 105 KB — Gmail hides the end of emails over about 100 KB.');
  assert.equal(previewSizeHint('90'), null, 'only numbers');
});

test('dates and numbers follow the browser language', () => {
  assert.equal(typeof userLocale(), 'string');
  assert.equal(formatCount(1180, 'en-US'), '1,180');
  assert.equal(formatCount(1180, 'de-DE'), '1.180');
  assert.equal(formatResetDate('2026-11-01T00:00:00Z', 'en-US'), 'Nov 1');
  assert.equal(formatResetDate('2026-11-01T00:00:00Z', 'en-GB'), '1 Nov');
  assert.match(formatSendTime('2026-10-22T13:30:00Z', 'en-GB'), /22 Oct/);
  assert.match(formatSendTime('2026-10-22T13:30:00Z', 'en-US'), /Oct 22/);
});
