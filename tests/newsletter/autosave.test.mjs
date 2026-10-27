import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAutosaver } from '../../components/newsletters/lib/autosave.ts';

function fakeTimers() {
  let next = 1;
  const timers = new Map();
  return {
    setTimer: (fn) => { const id = next++; timers.set(id, fn); return id; },
    clearTimer: (id) => { timers.delete(id); },
    fireAll: () => { const fns = [...timers.values()]; timers.clear(); fns.forEach((fn) => fn()); },
    get count() { return timers.size; },
  };
}

test('schedule debounces: many changes, one save', async () => {
  const t = fakeTimers();
  let runs = 0;
  const saver = createAutosaver({ delayMs: 800, run: async () => { runs++; }, setTimer: t.setTimer, clearTimer: t.clearTimer });
  saver.schedule(); saver.schedule(); saver.schedule();
  assert.equal(t.count, 1);
  t.fireAll();
  await saver.flush();
  assert.equal(runs, 1);
});

test('flush saves a pending change right away and waits for it', async () => {
  const t = fakeTimers();
  let runs = 0;
  const saver = createAutosaver({ delayMs: 800, run: async () => { runs++; }, setTimer: t.setTimer, clearTimer: t.clearTimer });
  saver.schedule();
  await saver.flush();
  assert.equal(runs, 1);
  assert.equal(t.count, 0);
  assert.equal(saver.pending, false);
  await saver.flush();
  assert.equal(runs, 1, 'nothing pending, nothing saved');
});

test('a change during a save causes exactly one more save', async () => {
  const t = fakeTimers();
  let runs = 0;
  let release;
  const saver = createAutosaver({
    delayMs: 800, setTimer: t.setTimer, clearTimer: t.clearTimer,
    run: () => { runs++; return runs === 1 ? new Promise((resolve) => { release = resolve; }) : Promise.resolve(); },
  });
  saver.schedule();
  t.fireAll();              // first save starts and waits
  saver.schedule();
  saver.schedule();         // two more edits while it runs
  release();
  await saver.flush();
  assert.equal(runs, 2);
});

test('a failed save does not block the next one; cancel drops a pending save', async () => {
  const t = fakeTimers();
  let runs = 0;
  const saver = createAutosaver({ delayMs: 800, setTimer: t.setTimer, clearTimer: t.clearTimer, run: async () => { runs++; if (runs === 1) throw new Error('offline'); } });
  saver.schedule();
  await saver.flush();
  saver.schedule();
  await saver.flush();
  assert.equal(runs, 2);
  saver.schedule();
  saver.cancel();
  await saver.flush();
  assert.equal(runs, 2);
});
