// tests/utils/appLaunch.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Chris, 10 Nov 2026: the lead email's "Open conversation" (https://studio.stasht.com/leads?lead=2350) opened the
// browser instead of the installed Stasht Studio app. The manifest now captures links into the app and reuses its open
// window (launch_handler focus-existing); the app routes the launched URL itself via window.launchQueue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchTarget, installLaunchConsumer, isInstalledAppWindow } from '../../utils/appLaunch.ts';

const ORIGIN = 'https://studio.stasht.com';

test('a lead link is routed to that lead', () => {
  assert.deepEqual(launchTarget(`${ORIGIN}/leads?lead=2350`, ORIGIN), { kind: 'lead', leadId: 2350 });
  assert.deepEqual(launchTarget(`${ORIGIN}/leads/?lead=7&utm_source=email`, ORIGIN), { kind: 'lead', leadId: 7 });
});

test('anything else on Studio is a plain page; bad or foreign links are ignored', () => {
  assert.deepEqual(launchTarget(`${ORIGIN}/leads`, ORIGIN), { kind: 'url', url: `${ORIGIN}/leads` });
  assert.deepEqual(launchTarget(`${ORIGIN}/leads?lead=abc`, ORIGIN), { kind: 'url', url: `${ORIGIN}/leads?lead=abc` });
  assert.deepEqual(launchTarget(`${ORIGIN}/leads?lead=0`, ORIGIN), { kind: 'url', url: `${ORIGIN}/leads?lead=0` });
  assert.deepEqual(launchTarget(`${ORIGIN}/leads-report?lead=5`, ORIGIN).kind, 'url');
  assert.equal(launchTarget('https://evil.example/leads?lead=1', ORIGIN), null);
  assert.equal(launchTarget('', ORIGIN), null);
  assert.equal(launchTarget(null, ORIGIN), null);
});

function fakeWindow(href) {
  let consumer = null;
  return {
    location: new URL(href),
    launchQueue: { setConsumer: (c) => { consumer = c; } },
    launch: (targetURL) => consumer({ targetURL }),
  };
}

test('a launch into the open app window routes to the lead without reloading', () => {
  const win = fakeWindow(`${ORIGIN}/newsletters`);
  const leads = []; const urls = [];
  assert.equal(installLaunchConsumer({ onLead: (id) => leads.push(id), onUrl: (u) => urls.push(u) }, win, `${ORIGIN}/`), true);
  win.launch(`${ORIGIN}/leads?lead=2350`);
  win.launch(`${ORIGIN}/memories`);
  win.launch(`${ORIGIN}/newsletters`); // already there — nothing to do
  assert.deepEqual(leads, [2350]);
  assert.deepEqual(urls, [`${ORIGIN}/memories`]);
});

test('the launch that opened this window is not replayed (start-up URL handling already did it)', () => {
  const win = fakeWindow(`${ORIGIN}/leads`);
  const leads = [];
  installLaunchConsumer({ onLead: (id) => leads.push(id), onUrl: () => assert.fail('no reload') }, win, `${ORIGIN}/leads?lead=9`);
  win.launch(`${ORIGIN}/leads?lead=9`);
  win.launch(`${ORIGIN}/leads?lead=9`); // the same link clicked again later does open it
  assert.deepEqual(leads, [9]);
});

test('browsers without launchQueue (Safari, Firefox) are left alone', () => {
  assert.equal(installLaunchConsumer({ onLead: () => {}, onUrl: () => {} }, { location: new URL(ORIGIN) }, null), false);
});

test('installed-app detection', () => {
  const mm = (on) => () => ({ matches: on });
  assert.equal(isInstalledAppWindow({ matchMedia: mm(true), navigator: {} }), true);
  assert.equal(isInstalledAppWindow({ matchMedia: mm(false), navigator: { standalone: true } }), true);
  assert.equal(isInstalledAppWindow({ matchMedia: mm(false), navigator: {} }), false);
});
