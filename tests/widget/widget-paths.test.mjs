// tests/widget/widget-paths.test.mjs — where the widget shows: the loader's built-in admin skip
// (Chris, 2026-10-06: "front end only"), and the home page plus each widget's "Also show on these
// pages" (shown_paths; owner decision 2026-10-15, ClickUp wdy2xh28hp), incl. the builder's normaliser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as core from '../../public/widget-core.js';

import { shownPathFromInput, withShownPath, shownPathsProblem, SHOWN_PATHS_MAX } from '../../components/widgets/widgetHelpers.ts';

const { pathShown, pathMatchesAny, isHomePath } = core;

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

test('the embed decides with pathShown and the config\'s shown_paths, not hidden_paths', () => {
  const embedSrc = readFileSync(new URL('../../public/widget-embed.js', import.meta.url), 'utf8');
  assert.match(embedSrc, /if \(!pathShown\(params\.get\('path'\), state\.config\.shown_paths\)\) return tell\('hide'\);/);
  assert.doesNotMatch(embedSrc, /hidden_paths|pathHidden/);
  assert.equal(core.pathHidden, undefined);
});

// --- pathShown: home page + shown_paths ------------------------------------------------------

test('pathShown: the home page always shows, in all its forms, whatever the list', () => {
  for (const p of ['/', '/index.html', '/index.htm', '/index.php', '/INDEX.HTML', '/index.html/', '//', '/%69ndex.html']) {
    for (const pats of [[], undefined, null, ['/contact']]) {
      assert.equal(pathShown(p, pats), true, `${p} ${JSON.stringify(pats)}`);
    }
  }
  for (const p of ['/index', '/index.asp', '/home', '/en/', '/en/index.html', '/index.html/x']) {
    assert.equal(isHomePath(p), false, p);
  }
});

test('pathShown: any other page is hidden unless listed (every existing widget: home page only)', () => {
  for (const p of ['/about', '/contact', '/inventory/1', '/checkout']) {
    assert.equal(pathShown(p, []), false, p);
    assert.equal(pathShown(p, undefined), false, `${p} with an API that predates shown_paths`);
    assert.equal(pathShown(p, null), false, p);
  }
  assert.equal(pathShown('/about', ['/contact']), false);
});

test('pathShown: an exact page matches only that page, ignoring case and a trailing slash', () => {
  const pats = ['/contact'];
  assert.equal(pathShown('/contact', pats), true);
  assert.equal(pathShown('/contact/', pats), true);
  assert.equal(pathShown('/Contact', pats), true);
  assert.equal(pathShown('/contact/form', pats), false);
  assert.equal(pathShown('/contacts', pats), false);
  assert.equal(pathShown('/us/contact', pats), false);
  assert.equal(pathShown('/contact', ['/contact/']), true);
});

test('pathShown: "/inventory/*" covers the section and its own front page, nothing else', () => {
  const pats = ['/inventory/*'];
  assert.equal(pathShown('/inventory', pats), true);
  assert.equal(pathShown('/inventory/', pats), true);
  assert.equal(pathShown('/inventory/used/2021-ram-1500', pats), true);
  assert.equal(pathShown('/inventory-old', pats), false);
  assert.equal(pathShown('/shop/inventory/x', pats), false);
});

test('pathShown: * elsewhere matches any characters, / included; "/*" means the whole site', () => {
  assert.equal(pathShown('/account/42/orders', ['/account/*/orders']), true);
  assert.equal(pathShown('/account/a/b/orders', ['/account/*/orders']), true);
  assert.equal(pathShown('/account/42/orders/7', ['/account/*/orders']), false);
  assert.equal(pathShown('/shop/red-chair', ['/shop/*-chair']), true);
  assert.equal(pathShown('/anything/at/all', ['/*']), true);
});

test('pathShown: regex characters in a pattern are literal', () => {
  assert.equal(pathShown('/a.b', ['/a.b']), true);
  assert.equal(pathShown('/axb', ['/a.b']), false);
  assert.equal(pathShown('/c++', ['/c++']), true);
  assert.equal(pathShown('/(x)', ['/(x)']), true);
});

test('pathShown: a percent-encoded path also matches its decoded form', () => {
  assert.equal(pathShown('/caf%C3%A9', ['/café']), true);
  assert.equal(pathShown('/caf%C3%A9', ['/caf%C3%A9']), true);
  assert.equal(pathShown('/bad%E0%A4%A', ['/bad*']), true); // malformed escape: raw path still compared
});

test('pathShown: admin pages never show, even when listed or matched by "/*"', () => {
  for (const p of ['/admin', '/admin/', '/wp-admin/edit.php', '/Administrator', '/wp-login.php', '/%61dmin/x']) {
    assert.equal(pathShown(p, ['/*', '/admin', '/admin/*', '/wp-admin/*', '/administrator', '/wp-login.php', '/%61dmin/*']), false, p);
  }
});

test('pathShown: invalid patterns show nothing extra; valid ones next to them still count', () => {
  for (const pats of ['/contact', {}, [''], ['   '], ['contact'], ['*'], ['https://x.com/contact'], [null, 7, {}], ['/' + 'a'.repeat(200)]]) {
    assert.equal(pathShown('/contact', pats), false, JSON.stringify(pats));
  }
  assert.equal(pathShown('/contact', ['', 'nope', ' /contact ']), true);
  assert.equal(pathMatchesAny('/contact', [' /contact ']), true);
  assert.equal(pathMatchesAny('/', []), false, 'pathMatchesAny alone knows nothing about the home page');
});

test('pathShown: no path (a loader copy without ?path=) fails open and shows', () => {
  for (const p of [null, undefined, '', 'contact', 7]) {
    assert.equal(pathShown(p, []), true, String(p));
    assert.equal(pathShown(p, ['/contact']), true, String(p));
  }
});

// --- Builder: shownPathFromInput (components/widgets/widgetHelpers.ts) -----------------------

const ok = (raw, domains = ['example.com']) => {
  const r = shownPathFromInput(raw, domains);
  assert.equal(r.error, undefined, `${raw}: ${r.error}`);
  return r.path;
};
const err = (raw, domains = ['example.com']) => {
  const r = shownPathFromInput(raw, domains);
  assert.equal(r.path, undefined, `${raw} should be refused`);
  return r.error;
};

test('builder: page addresses are kept, trimmed, without a trailing slash, query or hash', () => {
  assert.equal(ok('/contact'), '/contact');
  assert.equal(ok('  /contact/  '), '/contact');
  assert.equal(ok('/inventory/*'), '/inventory/*');
  assert.equal(ok('/checkout?step=2'), '/checkout');
  assert.equal(ok('/faq#top'), '/faq');
  assert.equal(ok('/caf%C3%A9'), '/caf%C3%A9');
});

test('builder: full links become their page address', () => {
  assert.equal(ok('https://example.com/contact'), '/contact');
  assert.equal(ok('example.com/contact'), '/contact');
  assert.equal(ok('HTTPS://WWW.Example.com:8443/contact/?utm=1#form'), '/contact');
  assert.equal(ok('example.com/inventory/*'), '/inventory/*');
  assert.equal(ok('//example.com/a/b'), '/a/b');
  assert.equal(ok('shop.example.com/x'), '/x', 'a subdomain is part of the website');
});

test('builder: links to another website are refused, naming the website', () => {
  assert.equal(err('https://other.com/contact'), "That page isn't on your website (example.com).");
  assert.equal(err('other.com/contact', ['example.com', 'mysite.ca']), "That page isn't on your website (example.com, mysite.ca).");
  assert.match(err('notexample.com/x'), /isn't on your website/);
  // No domains yet: any website.
  assert.equal(ok('https://other.com/contact', []), '/contact');
});

test('builder: the home page needs no entry', () => {
  for (const raw of ['/', 'https://example.com', 'example.com/', '/index.html', 'example.com/index.php?x=1']) {
    assert.match(err(raw), /always shows on your home page/, raw);
  }
});

test('builder: things that are not a page are refused with a hint', () => {
  for (const raw of ['contact', '*', 'localhost/contact', 'not a url', 'mailto:x@example.com', 'http://']) {
    assert.match(err(raw), /starts with \//, raw);
  }
  assert.match(err('/my page'), /without spaces/);
  assert.match(err('/' + 'a'.repeat(200)), /200 characters/);
  assert.match(err('https://example.com/' + 'a'.repeat(3000)), /too long/);
});

test('builder: whatever it saves, the embed matches as intended', () => {
  const saved = ['example.com/contact', 'https://www.example.com/inventory/*'].map((raw) => ok(raw));
  assert.deepEqual(saved, ['/contact', '/inventory/*']);
  assert.equal(pathShown('/contact/', saved), true);
  assert.equal(pathShown('/inventory/42', saved), true);
  assert.equal(pathShown('/about', saved), false);
  assert.equal(pathShown('/', saved), true);
});

test('builder: duplicates (any case) are not added twice; at most 20 pages', () => {
  assert.deepEqual(withShownPath(['/contact'], '/Contact'), ['/contact']);
  assert.deepEqual(withShownPath(['/contact'], '/about'), ['/contact', '/about']);
  assert.equal(SHOWN_PATHS_MAX, core.SHOWN_PATHS_MAX);
  const twenty = Array.from({ length: 20 }, (_, i) => `/p${i}`);
  assert.equal(shownPathsProblem(twenty), null);
  assert.match(shownPathsProblem([...twenty, '/p20']), /up to 20/);
});
