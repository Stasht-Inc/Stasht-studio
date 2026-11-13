// tests/utils/livePoll.test.mjs — live Leads list (Deepak 13 Nov 2026, option A). Needs Node >= 22.18 (type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { livePollDelay, reconcileList, sameValue, createLivePoller } from '../../utils/livePoll.ts';
import { withoutCurrentAccountRow } from '../../utils/salespersonLanding.ts';

test('delay doubles per failure and is capped', () => {
  assert.equal(livePollDelay(10000, 0), 10000);
  assert.equal(livePollDelay(10000, 1), 20000);
  assert.equal(livePollDelay(10000, 2), 40000);
  assert.equal(livePollDelay(10000, 9), 120000);
});

test('reconcileList keeps the same array when nothing changed', () => {
  const prev = [{ id: 1, unread_count: 0 }, { id: 2, unread_count: 1 }];
  const next = [{ id: 1, unread_count: 0 }, { id: 2, unread_count: 1 }];
  assert.equal(reconcileList(prev, next, (l) => l.id), prev);
});

test('reconcileList reuses unchanged rows and takes changed / new ones', () => {
  const a = { id: 1, latest_message: { body: 'hi' } };
  const b = { id: 2, claimed: false };
  const out = reconcileList([a, b], [{ id: 3, x: 1 }, { id: 1, latest_message: { body: 'hi' } }, { id: 2, claimed: true }], (l) => l.id);
  assert.equal(out.length, 3);
  assert.equal(out[1], a);
  assert.deepEqual(out[2], { id: 2, claimed: true });
  assert.notEqual(out[2], b);
});

test('reconcileList notices a removed row and a reorder', () => {
  const a = { id: 1 }, b = { id: 2 };
  assert.deepEqual(reconcileList([a, b], [{ id: 1 }], (l) => l.id), [a]);
  const re = reconcileList([a, b], [{ id: 2 }, { id: 1 }], (l) => l.id);
  assert.notEqual(re, undefined);
  assert.equal(re[0], b);
  assert.equal(re[1], a);
});

test('sameValue compares by value', () => {
  assert.ok(sameValue({ open: 1, closed: 2 }, { open: 1, closed: 2 }));
  assert.ok(!sameValue({ open: 1 }, { open: 2 }));
});

function fakeEnv() {
  const timers = [];
  let t = 0;
  const listeners = { doc: {}, win: {} };
  const env = {
    document: {
      visibilityState: 'visible',
      addEventListener: (k, f) => { listeners.doc[k] = f; },
      removeEventListener: (k) => { delete listeners.doc[k]; },
    },
    window: {
      addEventListener: (k, f) => { listeners.win[k] = f; },
      removeEventListener: (k) => { delete listeners.win[k]; },
    },
    setTimeout: (f, ms) => { const h = { f, ms }; timers.push(h); return h; },
    clearTimeout: (h) => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); },
    now: () => t,
  };
  return {
    env, timers, listeners,
    advance: (ms) => { t += ms; },
    async fire() { const h = timers.shift(); h.f(); await new Promise((r) => setImmediate(r)); return h.ms; },
  };
}

test('poller: runs every interval, never overlaps, backs off on errors, resets on success', async () => {
  const f = fakeEnv();
  let calls = 0;
  let result = true;
  const p = createLivePoller(async () => { calls++; return result; }, { intervalMs: 10000, env: f.env });
  assert.equal(f.timers.length, 1);
  assert.equal(await f.fire(), 10000);
  assert.equal(calls, 1);
  result = false;
  f.advance(10000); await f.fire();
  assert.equal(calls, 2);
  assert.equal(f.timers[0].ms, 20000); // backed off
  result = true;
  f.advance(20000); await f.fire();
  assert.equal(f.timers[0].ms, 10000); // back to normal
  p.stop();
  assert.equal(f.timers.length, 0);
});

test('poller: skips a tick while a check is still running', async () => {
  const f = fakeEnv();
  let calls = 0;
  let release;
  const p = createLivePoller(() => { calls++; return new Promise((r) => { release = r; }); }, { env: f.env });
  f.timers.shift().f(); // first check starts and hangs
  p.poke();             // focus while in flight: ignored
  assert.equal(calls, 1);
  release(true);
  await new Promise((r) => setImmediate(r));
  assert.equal(f.timers.length, 1);
  p.stop();
});

test('poller: hidden tab has no timer and makes no requests; visible again checks at once', async () => {
  const f = fakeEnv();
  let calls = 0;
  const p = createLivePoller(async () => { calls++; return true; }, { env: f.env });
  f.env.document.visibilityState = 'hidden';
  f.listeners.doc.visibilitychange();
  assert.equal(f.timers.length, 0);
  p.poke();
  assert.equal(calls, 0);
  f.advance(5000);
  f.env.document.visibilityState = 'visible';
  f.listeners.doc.visibilitychange();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 1);
  f.listeners.win.focus(); // same moment as visibilitychange: ignored
  assert.equal(calls, 1);
  p.stop();
  assert.equal(f.listeners.doc.visibilitychange, undefined);
});

test('poller: stop aborts the running check', async () => {
  const f = fakeEnv();
  let signal;
  const p = createLivePoller((s) => { signal = s; return new Promise(() => {}); }, { env: f.env });
  f.timers.shift().f();
  p.stop();
  assert.equal(signal.aborted, true);
});

test('withoutCurrentAccountRow drops only the account currently open', () => {
  const rows = [{ id: 5, name: 'Chris Becks' }, { id: 6, name: 'Other' }];
  assert.deepEqual(withoutCurrentAccountRow(rows, { id: 5 }), [{ id: 6, name: 'Other' }]);
  assert.equal(withoutCurrentAccountRow(rows, { id: 9 }), rows);
  assert.equal(withoutCurrentAccountRow(rows, null), rows);
  assert.deepEqual(withoutCurrentAccountRow([{ id: '5' }], { id: 5 }), []);
});
