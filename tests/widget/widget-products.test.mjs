// tests/widget/widget-products.test.mjs — the AI's product cards (ClickUp wdy2xh2kp0): one card per product,
// opening its page on the business's website, never a Stasht campaign.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PRODUCT_CARDS_MAX, PRODUCT_CARD_TEXT, safeWebUrl, productsFrom, bodyWithoutProducts, chatMessageFrom, linkTarget, linkParts,
} from '../../public/widget-core.js';

const PHOTO = 'https://stasht-data.s3.us-east-2.amazonaws.com/catalog/7/p-1.jpg';
const SHIPLAP = 'https://www.royalwoodshop.com/products/1x8-shiplap';
const VGROOVE = 'https://royalwoodshop.com/products/1x6-v-groove';
const BEAD = 'http://royalwoodshop.com/products/beadboard';
const TEXT = 'For your accent wall, you might consider our 1x8 Shiplap Wall Ceiling Paneling or 1x6 V-Groove Panelling. Tap a product below to see it on our website.';

test('constants', () => {
  assert.equal(PRODUCT_CARDS_MAX, 4);
  assert.equal(PRODUCT_CARD_TEXT, 'View product');
});

test('safeWebUrl: http and https pages of a website only', () => {
  assert.equal(safeWebUrl(` ${SHIPLAP} `), SHIPLAP);
  assert.equal(safeWebUrl(BEAD), BEAD, 'a small shop on plain http still gets its card');
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://shop.example/x', '//shop.example/x', '/products/x', 'https://user:pw@shop.example/x', 'https://', '', null, 7]) {
    assert.equal(safeWebUrl(bad), null, String(bad));
  }
});

test('productsFrom: at most 4 cards with a title and an http(s) page; photos https only', () => {
  assert.deepEqual(productsFrom([
    { title: ' 1x8 Shiplap Wall Ceiling Paneling ', url: SHIPLAP, image: PHOTO },
    { title: '1x6 V-Groove Panelling', url: VGROOVE, image: 'http://insecure.example/p.jpg' },
    { title: 'Beadboard', url: BEAD, image: 'javascript:alert(1)' },
  ]), [
    { title: '1x8 Shiplap Wall Ceiling Paneling', url: SHIPLAP, linkText: SHIPLAP, image: PHOTO },
    { title: '1x6 V-Groove Panelling', url: VGROOVE, linkText: VGROOVE, image: null },
    { title: 'Beadboard', url: BEAD, linkText: BEAD, image: null },
  ]);

  const many = productsFrom([
    null, 'x', { title: '', url: SHIPLAP }, { title: '   ', url: SHIPLAP }, { title: 7, url: SHIPLAP }, { title: 'Bad', url: 'javascript:alert(1)' },
    { title: 'A', url: `${SHIPLAP}?a` }, { title: 'A again', url: `${SHIPLAP}?a` },
    { title: 'B', url: `${SHIPLAP}?b` }, { title: 'C', url: `${SHIPLAP}?c` }, { title: 'D', url: `${SHIPLAP}?d` }, { title: 'E', url: `${SHIPLAP}?e` },
  ]);
  assert.deepEqual(many.map((p) => p.title), ['A', 'B', 'C', 'D'], 'bad entries and a repeated page dropped, at most 4');

  for (const raw of [undefined, null, {}, 'https://x.example', { title: 'A', url: SHIPLAP }]) {
    assert.deepEqual(productsFrom(raw), [], JSON.stringify(raw));
  }
});

test('chatMessageFrom: product cards on AI replies only', () => {
  const body = `${TEXT} ${SHIPLAP} ${VGROOVE}`;
  const products = [{ title: 'Shiplap', url: SHIPLAP, image: PHOTO }, { title: 'V-Groove', url: VGROOVE, image: null }];

  const m = chatMessageFrom({ id: 40, from: 'team', body, is_ai: true, campaign: null, products });
  assert.deepEqual(m.products.map((p) => p.url), [SHIPLAP, VGROOVE]);
  assert.equal(m.campaign, null);
  assert.equal(m.body, body, 'the text keeps the pages: the embed hides them where it draws the cards');

  assert.deepEqual(chatMessageFrom({ id: 41, from: 'team', body, is_ai: false, products }).products, [], 'a rep');
  assert.deepEqual(chatMessageFrom({ id: 42, from: 'visitor', body, is_ai: true, products }).products, [], 'a visitor');
  assert.deepEqual(chatMessageFrom({ id: 43, from: 'team', body: 'Hi', is_ai: true }).products, [], 'an older API sends none');
});

test('bodyWithoutProducts: the card pages at the end of the reply go, everything else stays', () => {
  const cards = productsFrom([{ title: 'Shiplap', url: SHIPLAP }, { title: 'V-Groove', url: VGROOVE }, { title: 'Beadboard', url: BEAD }]);

  assert.equal(bodyWithoutProducts(`${TEXT} ${SHIPLAP} ${VGROOVE} ${BEAD}`, cards), TEXT);
  assert.equal(bodyWithoutProducts(`${TEXT}\n${SHIPLAP}  ${VGROOVE}\n`, cards), TEXT);
  assert.equal(
    bodyWithoutProducts(`See ${SHIPLAP} for our panelling. ${SHIPLAP}`, cards),
    `See ${SHIPLAP} for our panelling.`,
    'the same page inside the text is the model\'s own link: kept',
  );
  assert.equal(
    bodyWithoutProducts(`${TEXT} ${SHIPLAP} https://elsewhere.example/p/1 ${VGROOVE}`, cards),
    `${TEXT} https://elsewhere.example/p/1`,
    'a page at the end that has no card stays as a link',
  );
  assert.equal(bodyWithoutProducts(`${TEXT} ${SHIPLAP}-12`, cards), `${TEXT} ${SHIPLAP}-12`, 'only whole pages');
  assert.equal(bodyWithoutProducts(`${TEXT} ${SHIPLAP}`, []), `${TEXT} ${SHIPLAP}`);
  assert.equal(bodyWithoutProducts(`${SHIPLAP} ${VGROOVE}`, cards), '', 'nothing but cards');
});

test('a card on the website the widget runs on stays in that tab; another site opens a new tab', () => {
  // The embed is an iframe on Stasht's domain: "the page the widget is on" is the customer's page (?host=).
  assert.deepEqual(linkTarget(SHIPLAP, 'https://royalwoodshop.com'), { target: '_top' }, 'www. or not, one site');
  assert.deepEqual(linkTarget(BEAD, 'https://www.royalwoodshop.com'), { target: '_top' });
  assert.deepEqual(linkTarget(SHIPLAP, 'https://stasht.com'), { target: '_blank', rel: 'noopener noreferrer' });
  assert.deepEqual(linkTarget(SHIPLAP, ''), { target: '_blank', rel: 'noopener noreferrer' });
});

test('the text left around the cards still links ordinary https pages', () => {
  const text = bodyWithoutProducts(`See https://royalwoodshop.com/panelling for more. ${SHIPLAP}`, productsFrom([{ title: 'S', url: SHIPLAP }]));
  assert.deepEqual(linkParts(text).filter((p) => p.href).map((p) => p.href), ['https://royalwoodshop.com/panelling']);
});

// widget-core.js and widget-embed.js cache separately for 5 minutes: a newer embed must still load next to
// an older core, so it never names the product helpers in its import list (see the comment in widget-core.js).
test('the embed reaches the product helpers through the namespace, never a named import', () => {
  const src = readFileSync(new URL('../../public/widget-embed.js', import.meta.url), 'utf8');
  const named = /import\s*\{([^}]*)\}\s*from\s*'\.\/widget-core\.js'/.exec(src)[1];
  for (const name of ['productsFrom', 'bodyWithoutProducts', 'PRODUCT_CARD_TEXT', 'PRODUCT_CARDS_MAX', 'safeWebUrl']) {
    assert.doesNotMatch(named, new RegExp(`\\b${name}\\b`), name);
  }
  assert.match(src, /import \* as core from '\.\/widget-core\.js';/);
  assert.match(src, /typeof core\.bodyWithoutProducts === 'function'/, 'an older core: no cards, the pages stay links');
});
