// Website signup form (Royal Wood task 11): the copyable examples on a list's management view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchSnippet, htmlFormSnippet, parseDomains } from '../../components/leads/lists/signupSnippets.ts';

const URL = 'https://restapi.stasht.com/api/react/public/lists/subscribe';
const KEY = 'ls_' + 'a1'.repeat(20);

test('the HTML form posts to the endpoint with the key, an email field and a hidden honeypot', () => {
  const html = htmlFormSnippet(URL, KEY);
  assert.match(html, new RegExp(`<form action="${URL}" method="post">`));
  assert.ok(html.includes(`<input type="hidden" name="key" value="${KEY}">`));
  assert.ok(html.includes('name="email"') && html.includes('required'));
  assert.match(html, /name="website" tabindex="-1"[^>]*left:-9999px/);
});

test('the fetch example sends JSON with the key', () => {
  const js = fetchSnippet(URL, KEY);
  assert.ok(js.includes(`fetch("${URL}"`));
  assert.ok(js.includes(`key: "${KEY}"`));
  assert.ok(js.includes("'Content-Type': 'application/json'"));
});

test('values are escaped in the HTML example', () => {
  assert.ok(htmlFormSnippet('https://x.test/"><script>', 'k').includes('https://x.test/&quot;&gt;&lt;script&gt;'));
});

test('redirect domains: one per line or comma separated, blanks dropped', () => {
  assert.deepEqual(parseDomains(' royalwoodshop.com \n\n www.royalwoodshop.com, shop.example.org '), ['royalwoodshop.com', 'www.royalwoodshop.com', 'shop.example.org']);
});
