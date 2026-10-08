// tests/widget/widget-paths.test.mjs — where the widget shows (Chris, 2026-10-06: "front end only"):
// the loader's built-in admin skip and each widget's "Don't show on these pages" (hidden_paths).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as core from '../../public/widget-core.js';

const { pathHidden } = core;

// widget-loader.js is a classic script and carries its own copy of the admin skip between
// <admin-skip> markers. Load that copy too, and run the admin cases against both.
const loaderSrc = readFileSync(new URL('../../public/widget-loader.js', import.meta.url), 'utf8');
const block = loaderSrc.match(/\/\/ <admin-skip>[^\n]*\n([\s\S]*?)\n\s*\/\/ <\/admin-skip>/);
assert.ok(block, 'widget-loader.js has an <admin-skip> block');
const loader = new Function(`${block[1]}\nreturn { ADMIN_PATH_SEGMENTS, isAdminPath };`)();
const impls = [['core', core], ['loader', loader]];
const squash = (s) => s.replace(/\s+/g, ' ').trim();

test('the loader copy of the admin skip matches widget-core.js', () => {
  assert.equal(squash(loader.isAdminPath.toString()), squash(core.isAdminPath.toString()));
  assert.deepEqual(loader.ADMIN_PATH_SEGMENTS, core.ADMIN_PATH_SEGMENTS);
  assert.deepEqual(core.ADMIN_PATH_SEGMENTS, ['admin', 'wp-admin', 'administrator', 'wp-login.php']);
});

test('the loader skips admin pages before it builds the frame', () => {
  const skip = loaderSrc.indexOf('if (isAdminPath(window.location.pathname)) return;');
  assert.ok(skip > 0, 'the loader calls isAdminPath on location.pathname');
  assert.ok(skip < loaderSrc.indexOf("document.createElement('iframe')"), 'before creating the iframe');
  assert.ok(skip < loaderSrc.indexOf('widget-embed.html'), 'before building the embed URL');
});

test('the loader passes the page path to the embed', () => {
  assert.match(loaderSrc, /'&path=' \+ encodeURIComponent\(window\.location\.pathname\)/);
});

for (const [name, impl] of impls) {
  test(`${name}: isAdminPath skips admin pages by their first path segment, any case`, () => {
    for (const p of ['/admin', '/admin/', '/admin/products', '/ADMIN/Orders?x', '/wp-admin/', '/wp-admin/edit.php',
      '/administrator', '/Administrator/index.php', '/wp-login.php', '/%61dmin/x']) {
      assert.equal(impl.isAdminPath(p), true, p);
    }
  });

  test(`${name}: isAdminPath leaves front-end pages alone`, () => {
    for (const p of ['/', '', '/shop', '/products/admin', '/admins', '/administration', '/admin-tips', '/wp-login',
      '/blog/wp-admin', '/%E0%A4%A', null, undefined, 42]) {
      assert.equal(impl.isAdminPath(p), false, String(p));
    }
  });
}

test('pathHidden: "/admin/*" hides everything under /admin and /admin itself, nothing else', () => {
  const pats = ['/admin/*'];
  assert.equal(pathHidden('/admin/products', pats), true);
  assert.equal(pathHidden('/admin/products/12/edit', pats), true);
  // Documented choice: a section pattern also covers the section's own front page.
  assert.equal(pathHidden('/admin', pats), true);
  assert.equal(pathHidden('/admin/', pats), true);
  assert.equal(pathHidden('/administrator', pats), false);
  assert.equal(pathHidden('/shop/admin/x', pats), false);
  assert.equal(pathHidden('/', pats), false);
});

test('pathHidden: an exact page matches only that page, ignoring case and a trailing slash', () => {
  const pats = ['/checkout'];
  assert.equal(pathHidden('/checkout', pats), true);
  assert.equal(pathHidden('/checkout/', pats), true);
  assert.equal(pathHidden('/Checkout', pats), true);
  assert.equal(pathHidden('/checkout/step-2', pats), false);
  assert.equal(pathHidden('/checkouts', pats), false);
  assert.equal(pathHidden('/shop/checkout', pats), false);
  assert.equal(pathHidden('/checkout', ['/checkout/']), true);
  assert.equal(pathHidden('/', ['/']), true);
  assert.equal(pathHidden('/about', ['/']), false);
});

test('pathHidden: * in the middle matches any characters, / included', () => {
  const pats = ['/account/*/orders'];
  assert.equal(pathHidden('/account/42/orders', pats), true);
  assert.equal(pathHidden('/account/a/b/orders', pats), true);
  assert.equal(pathHidden('/account/42/orders/7', pats), false);
  assert.equal(pathHidden('/account/42/settings', pats), false);
  assert.equal(pathHidden('/shop/red-chair', ['/shop/*-chair']), true);
  assert.equal(pathHidden('/anything/at/all', ['/*']), true);
  assert.equal(pathHidden('/', ['/*']), true);
});

test('pathHidden: regex characters in a pattern are literal', () => {
  assert.equal(pathHidden('/a.b', ['/a.b']), true);
  assert.equal(pathHidden('/axb', ['/a.b']), false);
  assert.equal(pathHidden('/c++', ['/c++']), true);
  assert.equal(pathHidden('/(x)', ['/(x)']), true);
});

test('pathHidden: a percent-encoded path also matches its decoded form', () => {
  assert.equal(pathHidden('/caf%C3%A9', ['/café']), true);
  assert.equal(pathHidden('/caf%C3%A9', ['/caf%C3%A9']), true);
  assert.equal(pathHidden('/bad%E0%A4%A', ['/bad*']), true); // malformed escape: raw path still compared
});

test('pathHidden: empty, invalid or missing patterns hide nothing', () => {
  const path = '/checkout';
  for (const pats of [[], null, undefined, '/checkout', {}, [''], ['   '], ['checkout'], ['*'], ['https://x.com/checkout'],
    [null, 7, {}], ['/' + 'a'.repeat(200)]]) {
    assert.equal(pathHidden(path, pats), false, JSON.stringify(pats));
  }
  assert.equal(pathHidden(path, ['', 'nope', ' /checkout ']), true, 'valid entries still count next to invalid ones');
});

test('pathHidden: no path (an older cached loader) never hides', () => {
  for (const p of [null, undefined, '', 'checkout', 7]) assert.equal(pathHidden(p, ['/*']), false, String(p));
});
