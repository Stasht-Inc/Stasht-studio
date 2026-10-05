// tests/widget/widget-links.test.mjs — clickable links in chat bubbles (ClickUp wdy2xh1tdp)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkParts, siteHost, linkTarget, shouldReopenChat, REOPEN_AFTER_LINK_MS } from '../../public/widget-core.js';

test('linkParts splits text around https links', () => {
  assert.deepEqual(linkParts('Our hours are on https://www.serpa.ca/hours and we can help.'), [
    { text: 'Our hours are on ' },
    { text: 'https://www.serpa.ca/hours', href: 'https://www.serpa.ca/hours' },
    { text: ' and we can help.' },
  ]);
});

test('linkParts leaves sentence punctuation out of the link', () => {
  for (const tail of ['.', ',', ';', ':', '!', '?', ')', '.)', '!?']) {
    const parts = linkParts(`See https://serpa.ca/contact${tail}`);
    assert.equal(parts[1].href, 'https://serpa.ca/contact', tail);
    assert.equal(parts[2].text, tail, tail);
  }
  assert.deepEqual(linkParts('(https://serpa.ca/map)'), [
    { text: '(' }, { text: 'https://serpa.ca/map', href: 'https://serpa.ca/map' }, { text: ')' },
  ]);
  assert.equal(linkParts('https://serpa.ca/search?q=suv&max=40000.')[0].href, 'https://serpa.ca/search?q=suv&max=40000');
});

test('linkParts finds several links and keeps line breaks in the text', () => {
  const parts = linkParts('Hours: https://serpa.ca/hours\nContact: https://serpa.ca/contact');
  assert.deepEqual(parts.filter((p) => p.href).map((p) => p.href), ['https://serpa.ca/hours', 'https://serpa.ca/contact']);
  assert.equal(parts.map((p) => p.text).join(''), 'Hours: https://serpa.ca/hours\nContact: https://serpa.ca/contact');
});

test('only https links are clickable', () => {
  for (const text of ['http://serpa.ca/hours', 'javascript:alert(1)', 'ftp://serpa.ca/x', 'www.serpa.ca/hours', 'https://', 'data:text/html,hi']) {
    const parts = linkParts(text);
    assert.equal(parts.some((p) => p.href), false, text);
    assert.equal(parts.map((p) => p.text).join(''), text, text);
  }
  assert.deepEqual(linkParts(''), [{ text: '' }]);
  assert.deepEqual(linkParts(null), [{ text: '' }]);
  assert.equal(linkParts('<b>https://serpa.ca/x</b>')[1].href, 'https://serpa.ca/x', 'markup characters end the URL');
});

test('siteHost treats www and the bare domain as one site', () => {
  assert.equal(siteHost('https://www.Serpa.ca/hours'), 'serpa.ca');
  assert.equal(siteHost('https://serpa.ca'), 'serpa.ca');
  assert.equal(siteHost('https://shop.serpa.ca'), 'shop.serpa.ca');
  assert.equal(siteHost('not a url'), '');
  assert.equal(siteHost(''), '');
});

test('linkTarget opens the host site in place and anything else in a new tab', () => {
  assert.deepEqual(linkTarget('https://serpa.ca/hours', 'https://www.serpa.ca'), { target: '_top' });
  assert.deepEqual(linkTarget('https://www.serpa.ca/hours', 'https://serpa.ca'), { target: '_top' });
  assert.deepEqual(linkTarget('https://www.serpa.ca/hours', 'https://www.serpa.ca:443'), { target: '_top' });
  const blank = { target: '_blank', rel: 'noopener noreferrer' };
  assert.deepEqual(linkTarget('https://restapi.stasht.com/share/memory/x', 'https://www.serpa.ca'), blank);
  assert.deepEqual(linkTarget('https://shop.serpa.ca/x', 'https://serpa.ca'), blank, 'a subdomain is another site');
  assert.deepEqual(linkTarget('https://serpa.ca.evil.com/x', 'https://serpa.ca'), blank);
  assert.deepEqual(linkTarget('https://serpa.ca/x', ''), blank, 'unknown host page: new tab');
});

test('shouldReopenChat only right after a chat link was followed', () => {
  const now = 1_000_000_000;
  assert.equal(shouldReopenChat(String(now - 2000), now), true);
  assert.equal(shouldReopenChat(String(now - REOPEN_AFTER_LINK_MS - 1), now), false);
  assert.equal(shouldReopenChat(String(now + 5000), now), false);
  assert.equal(shouldReopenChat(null, now), false);
  assert.equal(shouldReopenChat('nope', now), false);
});
