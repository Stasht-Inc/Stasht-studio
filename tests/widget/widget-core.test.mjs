// tests/widget/widget-core.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  safeColor, safeHttpsUrl, contrastInk, hostOrigin, isPlausiblePhone, clampPosition, panelWidth, panelMaxHeight, MESSAGE_MAX,
  configUrl, ROOT_PAD,
} from '../../public/widget-core.js';

test('safeColor accepts #RRGGBB only', () => {
  assert.equal(safeColor('#2F5FAC'), '#2F5FAC');
  assert.equal(safeColor('  #2f5fac '), '#2f5fac');
  assert.equal(safeColor('red'), '#2f5fac');
  assert.equal(safeColor('#fff'), '#2f5fac');
  assert.equal(safeColor('#2f5fac; background:url(x)'), '#2f5fac');
  assert.equal(safeColor(null, '#000000'), '#000000');
});

test('safeHttpsUrl only allows https', () => {
  assert.equal(safeHttpsUrl('https://cdn.example/logo.png'), 'https://cdn.example/logo.png');
  assert.equal(safeHttpsUrl('http://cdn.example/logo.png'), null);
  assert.equal(safeHttpsUrl('javascript:alert(1)'), null);
  assert.equal(safeHttpsUrl('not a url'), null);
  assert.equal(safeHttpsUrl(undefined), null);
});

test('contrastInk picks a readable ink colour', () => {
  assert.equal(contrastInk('#ffffff'), '#111111');
  assert.equal(contrastInk('#ffd700'), '#111111');
  assert.equal(contrastInk('#2f5fac'), '#ffffff');
  assert.equal(contrastInk('#000000'), '#ffffff');
  assert.equal(contrastInk('bogus'), '#ffffff');
});

test('hostOrigin prefers the loader param, falls back to the referrer, strips paths', () => {
  assert.equal(hostOrigin({ hostParam: 'https://royalwoodshop.com', referrer: 'https://other.example/x' }), 'https://royalwoodshop.com');
  assert.equal(hostOrigin({ hostParam: '', referrer: 'https://royalwoodshop.com/contact?a=1' }), 'https://royalwoodshop.com');
  assert.equal(hostOrigin({ hostParam: 'garbage', referrer: 'https://royalwoodshop.com/' }), 'https://royalwoodshop.com');
  assert.equal(hostOrigin({ hostParam: null, referrer: '' }), '');
});

test('isPlausiblePhone mirrors the server rule', () => {
  for (const ok of ['(416) 818-1235', '4168181235', '1 416 818 1235', '+1 416 818 1235', '+44 20 7946 0958']) {
    assert.equal(isPlausiblePhone(ok), true, ok);
  }
  for (const bad of ['', '12345', 'abc', '416818123', '24168181235', '+1234567']) {
    assert.equal(isPlausiblePhone(bad), false, bad);
  }
});

test('clampPosition defaults to bottom-right', () => {
  assert.equal(clampPosition('bottom-left'), 'bottom-left');
  assert.equal(clampPosition('bottom-right'), 'bottom-right');
  assert.equal(clampPosition('top'), 'bottom-right');
  assert.equal(clampPosition(undefined), 'bottom-right');
});

test('panel plus its shadow padding fits inside the loader-capped iframe (vw - 32 wide)', () => {
  assert.equal(panelWidth(undefined), 360);
  assert.equal(panelWidth(0), 360);
  assert.equal(panelWidth(1440), 360);
  assert.equal(panelWidth(400), 336);
  assert.equal(panelWidth(320), 256);
  assert.equal(panelWidth(250), 240);
  for (const vw of [360, 390, 400, 430]) {
    assert.ok(panelWidth(vw) + ROOT_PAD.x * 2 <= vw - 32, `fits at ${vw}px`);
  }
});

test('MESSAGE_MAX matches the API limit', () => {
  assert.equal(MESSAGE_MAX, 320);
});

test('panelMaxHeight leaves room for the shadow padding inside the loader-capped iframe', () => {
  assert.equal(panelMaxHeight(undefined), 684);
  assert.equal(panelMaxHeight(0), 684);
  assert.equal(panelMaxHeight(900), 684);
  assert.equal(panelMaxHeight(640), 572);
  assert.equal(panelMaxHeight(568), 500);
  assert.equal(panelMaxHeight(200), 200);
  for (const vh of [568, 640, 900]) {
    assert.ok(panelMaxHeight(vh) + ROOT_PAD.top + ROOT_PAD.bottom <= Math.min(720, vh - 32), `fits at ${vh}px`);
  }
});

test('the panel shadow stays inside the padding, so the iframe edge never cuts it off', () => {
  // PANEL_SHADOW's largest layer is 0 8px 20px -6px: reaches blur + spread + offset from each edge.
  const reach = { top: 20 - 6 - 8, x: 20 - 6, bottom: 20 - 6 + 8 };
  assert.ok(ROOT_PAD.top >= reach.top && ROOT_PAD.x >= reach.x && ROOT_PAD.bottom >= reach.bottom);
});

test('configUrl passes the customer page origin so the server can record where the widget is installed', () => {
  const api = 'https://restapi.stasht.com/api/react';
  assert.equal(
    configUrl(api, 'w_abcdefghij', 'https://www.example.com'),
    'https://restapi.stasht.com/api/react/widget-embed/w_abcdefghij/config?host=https%3A%2F%2Fwww.example.com',
  );
  assert.equal(configUrl(api, 'w_abcdefghij', ''), 'https://restapi.stasht.com/api/react/widget-embed/w_abcdefghij/config');
});
