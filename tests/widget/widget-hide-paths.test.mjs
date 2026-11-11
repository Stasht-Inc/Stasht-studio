// tests/widget/widget-hide-paths.test.mjs — "Hide on these pages" (Chris 11 Nov 2026: no chat on
// Royal Wood's catalogue page): widgetShownOn() matching, the builder's entry rules, and the loader's
// single-page-site handling (it reports each new path to the embed and soft-hides / re-shows the frame).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { widgetShownOn } from '../../public/widget-core.js';
import { hidePathFromInput, shownPathFromInput } from '../../components/widgets/widgetHelpers.ts';

const cfg = (hide, shown = ['/*']) => ({ shown_paths: shown, hide_paths: hide });

test('a listed page hides the widget: whole path, any case, trailing slash ignored', () => {
  const c = cfg(['/catalogue']);
  for (const p of ['/catalogue', '/catalogue/', '/Catalogue', '/CATALOGUE/']) assert.equal(widgetShownOn(p, c), false, p);
  for (const p of ['/catalogues', '/catalogue/oak-table', '/shop/catalogue', '/contact', '/']) assert.equal(widgetShownOn(p, c), true, p);
});

test('* wildcards: "/products/*" covers the section and its front page, "/catalogue*" any suffix', () => {
  const c = cfg(['/products/*', '/catalogue*']);
  for (const p of ['/products', '/products/', '/products/oak-table', '/Products/a/b', '/catalogue', '/catalogue-2026', '/catalogue/x']) {
    assert.equal(widgetShownOn(p, c), false, p);
  }
  for (const p of ['/product', '/productsx', '/shop/products/x', '/contact', '/']) assert.equal(widgetShownOn(p, c), true, p);
});

test('hide wins over the home page and over shown_paths; percent-encoded paths match too', () => {
  assert.equal(widgetShownOn('/', cfg(['/'])), false);
  assert.equal(widgetShownOn('/index.html', cfg(['/index.html'])), false);
  assert.equal(widgetShownOn('/contact', cfg(['/contact'], ['/contact'])), false);
  assert.equal(widgetShownOn('/caf%C3%A9', cfg(['/café'])), false);
});

test('nothing hidden: no list, an empty list, junk entries, or an API without the setting', () => {
  for (const hide of [undefined, null, [], ['', 'catalogue', 42, null]]) {
    assert.equal(widgetShownOn('/catalogue', cfg(hide)), true, JSON.stringify(hide));
  }
  // Older API (no hide_paths key): exactly the home page + shown_paths rule.
  assert.equal(widgetShownOn('/', { shown_paths: [] }), true);
  assert.equal(widgetShownOn('/catalogue', { shown_paths: [] }), false);
  assert.equal(widgetShownOn('/catalogue', { shown_paths: ['/catalogue'] }), true);
  // Admin pages never, no usable path = shown (fail open), as before.
  assert.equal(widgetShownOn('/admin/x', cfg([])), false);
  assert.equal(widgetShownOn(null, cfg(['/catalogue'])), true);
});

test('builder: hide entries accept paths, links on the site and the home page', () => {
  assert.deepEqual(hidePathFromInput(' /catalogue/ ', []), { path: '/catalogue' });
  assert.deepEqual(hidePathFromInput('https://www.royalwood.example/products/*?x=1#y', ['royalwood.example']), { path: '/products/*' });
  assert.deepEqual(hidePathFromInput('/', []), { path: '/' });
  assert.ok(shownPathFromInput('/', []).error, 'the shown list still refuses the home page');
  assert.match(hidePathFromInput('https://other.com/x', ['royalwood.example']).error, /isn't on your website/);
  assert.match(hidePathFromInput('catalogue', []).error, /starts with \//);
  assert.match(hidePathFromInput('/' + 'a'.repeat(200), []).error, /200 characters/);
});

// --- The loader in a minimal fake browser --------------------------------------------------------

function runLoader(startPath) {
  const src = readFileSync(new URL('../../public/widget-loader.js', import.meta.url), 'utf8');
  const listeners = {};
  const posted = [];
  const loc = { pathname: startPath, origin: 'https://shop.example', href: `https://shop.example${startPath}` };
  const contentWindow = { postMessage: (msg, origin) => posted.push({ msg, origin }) };
  let frame = null;
  const styleMap = {};
  const history = {
    pushState(_s, _t, url) { loc.pathname = url; },
    replaceState(_s, _t, url) { loc.pathname = url; },
  };
  const script = {
    src: 'https://studio.example/widget-loader.js', isConnected: true,
    getAttribute: (k) => ({ src: 'https://studio.example/widget-loader.js', 'data-widget-id': 'w_abcdefghij' })[k],
  };
  const timers = [];
  const document = {
    currentScript: script,
    getElementById: () => null,
    querySelector: () => script,
    createElement: () => {
      frame = {
        style: { setProperty: (k, v) => { styleMap[k] = v; }, removeProperty: (k) => { delete styleMap[k]; } },
        setAttribute() {}, isConnected: false, contentWindow,
        remove() { this.isConnected = false; },
      };
      return frame;
    },
    body: { appendChild: (el) => { el.isConnected = true; } },
  };
  const window = {
    location: loc, innerWidth: 1280, innerHeight: 800, history,
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
  };
  vm.runInNewContext(src, { window, document, URL, setTimeout: (fn) => timers.push(fn), Object, Array, Math, Number, String, isFinite });
  const flush = () => { while (timers.length) timers.shift()(); };
  const fromEmbed = (msg) => {
    for (const fn of listeners.message || []) {
      fn({ origin: 'https://studio.example', source: contentWindow, data: { source: 'stasht-widget', id: 'w_abcdefghij', ...msg } });
    }
    flush();
  };
  const popstate = (path) => { loc.pathname = path; for (const fn of listeners.popstate || []) fn({}); flush(); };
  return { window, frame: () => frame, styleMap, posted, flush, fromEmbed, popstate };
}

test('loader: a soft hide keeps the frame hidden and zero-sized; a hard hide still removes it', () => {
  const env = runLoader('/catalogue');
  assert.ok(env.frame().isConnected);
  assert.equal(env.styleMap.visibility, 'hidden');
  env.fromEmbed({ type: 'hide', soft: true });
  assert.ok(env.frame().isConnected, 'kept for later pages');
  assert.equal(env.styleMap.width, '0');
  assert.equal(env.styleMap.visibility, 'hidden');
  env.fromEmbed({ type: 'resize', width: 300, height: 400 });
  assert.equal(env.styleMap.visibility, 'visible');
  env.fromEmbed({ type: 'hide' });
  assert.equal(env.frame().isConnected, false, 'paused / unknown widget: removed as before');
});

test('loader: SPA navigation (pushState, replaceState, back button) reports each new path once', () => {
  const env = runLoader('/');
  // Nothing is posted before the embed has spoken (it might not be listening yet).
  env.window.history.pushState({}, '', '/catalogue');
  env.flush();
  assert.equal(env.posted.length, 0);
  // Its first message: the path it doesn't know about is sent straight away, to the embed origin only.
  env.fromEmbed({ type: 'resize', width: 300, height: 400 });
  assert.deepEqual(env.posted.map((p) => [p.msg.type, p.msg.path, p.origin]), [['path', '/catalogue', 'https://studio.example']]);
  assert.equal(env.posted[0].msg.source, 'stasht-widget-host');
  assert.equal(env.posted[0].msg.id, 'w_abcdefghij');

  env.fromEmbed({ type: 'hide', soft: true });
  env.window.history.pushState({}, '', '/catalogue'); env.flush(); // same path: nothing new
  env.window.history.replaceState({}, '', '/contact'); env.flush();
  env.popstate('/catalogue');
  assert.deepEqual(env.posted.map((p) => p.msg.path), ['/catalogue', '/contact', '/catalogue']);
  // The wrapped history methods still do their job.
  assert.equal(env.window.location.pathname, '/catalogue');
});
