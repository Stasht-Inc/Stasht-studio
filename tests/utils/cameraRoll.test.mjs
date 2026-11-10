// tests/utils/cameraRoll.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
// Media page "Camera Roll" tab (Chris, 9 Nov 2026): photos picked from the phone's picker are kept here (nothing is
// uploaded), arrive selected, tap toggles, "Add more" appends without duplicates, Next hands the selected ones to
// Create campaign, and the picks survive a trip to Create and back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
// sessionStorage (the one-shot "open on the Media tab" signal survives a reload) — a stand-in for Node.
const store = new Map();
globalThis.sessionStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
// window events: ACCOUNT_STATE_CLEARED_EVENT (a sign-out / sign-in without a reload).
globalThis.window = globalThis.window ?? new EventTarget();
const {
  isAddablePhoto, pickKey, addPicks, togglePick, selectedPickFiles, selectionLabel, skippedMessage, cameraRollSession,
  accountKeyOf, OPEN_MEDIA_TAB_KEY,
} = await import('../../utils/cameraRoll.ts');
const { ACCOUNT_STATE_CLEARED_EVENT } = await import('../../utils/accountState.ts');
const A = accountKeyOf({ userId: 70, viewType: 'personal', propertyId: null });

const file = (name, { type = 'image/jpeg', size = 100, lastModified = 1 } = {}) => new File([new Uint8Array(size)], name, { type, lastModified });

test('photos the upload accepts are addable, including iPhone HEIC/HEIF and WEBP', () => {
  for (const [name, type] of [['a.jpg', 'image/jpeg'], ['a.png', 'image/png'], ['a.webp', 'image/webp'], ['a.gif', 'image/gif'], ['a.heic', 'image/heic'], ['a.heif', 'image/heif']]) {
    assert.equal(isAddablePhoto(file(name, { type })), true, name);
  }
});

test('HEIC with an empty type (some browsers) is still addable by its extension', () => {
  assert.equal(isAddablePhoto(file('IMG_1.HEIC', { type: '' })), true);
});

test('HEIC/HEIF reported as application/octet-stream (some desktops) is addable by its extension', () => {
  assert.equal(isAddablePhoto(file('IMG_1.heic', { type: 'application/octet-stream' })), true);
  assert.equal(isAddablePhoto(file('IMG_1.HEIF', { type: 'application/octet-stream' })), true);
  assert.equal(isAddablePhoto(file('notes.bin', { type: 'application/octet-stream' })), false);
});

test('videos, PDFs and unknown files are not addable', () => {
  assert.equal(isAddablePhoto(file('clip.mov', { type: 'video/quicktime' })), false);
  assert.equal(isAddablePhoto(file('doc.pdf', { type: 'application/pdf' })), false);
  assert.equal(isAddablePhoto(file('noext', { type: '' })), false);
  assert.equal(isAddablePhoto(file('a.tiff', { type: 'image/tiff' })), false);
});

test('pickKey is name + size (not the date: iPhone Safari dates every pick "now")', () => {
  assert.equal(pickKey(file('a.jpg', { size: 5, lastModified: 9 })), 'a.jpg|5');
  assert.equal(pickKey(file('a.jpg', { size: 5, lastModified: 10 })), 'a.jpg|5');
});

test('picked photos arrive selected, in the order picked', () => {
  const { picks, skipped, duplicates } = addPicks([], [file('a.jpg'), file('b.jpg', { size: 2 })]);
  assert.deepEqual(picks.map((p) => [p.file.name, p.selected]), [['a.jpg', true], ['b.jpg', true]]);
  assert.equal(skipped, 0);
  assert.equal(duplicates, 0);
});

test('Add more appends, keeps earlier selection, and drops the same photo picked again', () => {
  const first = addPicks([], [file('a.jpg'), file('b.jpg', { size: 2 })]).picks;
  const toggled = togglePick(first, pickKey(file('a.jpg')));
  const { picks, duplicates } = addPicks(toggled, [file('a.jpg'), file('c.jpg', { size: 3 }), file('c.jpg', { size: 3 })]);
  assert.deepEqual(picks.map((p) => [p.file.name, p.selected]), [['a.jpg', false], ['b.jpg', true], ['c.jpg', true]]);
  assert.equal(duplicates, 2);
});

test('same name but a different size is another photo; same name + size picked later is the same one', () => {
  const { picks, duplicates } = addPicks([], [file('IMG.jpg', { size: 1 }), file('IMG.jpg', { size: 2 }), file('IMG.jpg', { size: 1, lastModified: 2 })]);
  assert.equal(picks.length, 2);
  assert.equal(duplicates, 1);
});

test('files that are not photos are skipped and counted', () => {
  const { picks, skipped } = addPicks([], [file('a.jpg'), file('v.mov', { type: 'video/quicktime' })]);
  assert.equal(picks.length, 1);
  assert.equal(skipped, 1);
});

test('togglePick flips only that photo and returns a new array', () => {
  const picks = addPicks([], [file('a.jpg'), file('b.jpg', { size: 2 })]).picks;
  const next = togglePick(picks, pickKey(file('b.jpg', { size: 2 })));
  assert.notEqual(next, picks);
  assert.deepEqual(next.map((p) => p.selected), [true, false]);
  assert.deepEqual(togglePick(next, pickKey(file('b.jpg', { size: 2 }))).map((p) => p.selected), [true, true]);
});

test('selectedPickFiles keeps the grid order', () => {
  const picks = togglePick(addPicks([], [file('a.jpg'), file('b.jpg', { size: 2 }), file('c.jpg', { size: 3 })]).picks, 'b.jpg|2');
  assert.deepEqual(selectedPickFiles(picks).map((f) => f.name), ['a.jpg', 'c.jpg']);
});

test('selectionLabel', () => {
  assert.equal(selectionLabel(0), 'Tap photos to select');
  assert.equal(selectionLabel(1), '1 selected');
  assert.equal(selectionLabel(12), '12 selected');
});

test('skippedMessage', () => {
  assert.equal(skippedMessage(0), '');
  assert.match(skippedMessage(1), /^1 file wasn’t added/);
  assert.match(skippedMessage(3), /^3 files weren’t added/);
});

test('session keeps picks across unmounts; a handoff is recognised by its exact files', () => {
  cameraRollSession.clear();
  const picks = addPicks([], [file('a.jpg')]).picks;
  cameraRollSession.setPicks(picks, A);
  assert.equal(cameraRollSession.getPicks(A), picks);
  const files = selectedPickFiles(picks);
  cameraRollSession.startHandoff(files);
  assert.equal(cameraRollSession.isHandoff(files), true);
  assert.equal(cameraRollSession.isHandoff([...files]), false, 'another array (e.g. Scan Photo) is not ours');
  assert.equal(cameraRollSession.isHandoff(null), false);
  cameraRollSession.endHandoff();
  assert.equal(cameraRollSession.isHandoff(files), false);
  assert.equal(cameraRollSession.getPicks(A), picks, 'ending the handoff keeps the picks (Create was closed)');
});

test('session.clear forgets picks and any handoff (campaign created)', () => {
  const picks = addPicks([], [file('a.jpg')]).picks;
  cameraRollSession.setPicks(picks, A);
  cameraRollSession.startHandoff(selectedPickFiles(picks));
  cameraRollSession.clear();
  assert.deepEqual(cameraRollSession.getPicks(A), []);
  assert.equal(cameraRollSession.isHandoff(selectedPickFiles(picks)), false);
});

test('session: open the Media tab once (after "Take a Photo" saved to Media), kept in sessionStorage so a reload keeps it', () => {
  store.clear();
  assert.equal(cameraRollSession.takeOpenMediaTab(), false);
  cameraRollSession.openMediaTabNext();
  assert.equal(store.get(OPEN_MEDIA_TAB_KEY), '1');
  assert.equal(cameraRollSession.peekOpenMediaTab(), true, 'peek does not consume');
  assert.equal(cameraRollSession.peekOpenMediaTab(), true);
  assert.equal(cameraRollSession.takeOpenMediaTab(), true);
  assert.equal(cameraRollSession.takeOpenMediaTab(), false, 'consumed on read');
  assert.equal(store.has(OPEN_MEDIA_TAB_KEY), false);
});

test('Sidebar "View Media" writes the key literally before its reload: the next Media page opens on Media', () => {
  store.clear();
  sessionStorage.setItem('stasht_open_media_tab', '1'); // components/Sidebar.tsx
  assert.equal(OPEN_MEDIA_TAB_KEY, 'stasht_open_media_tab');
  assert.equal(cameraRollSession.peekOpenMediaTab(), true);
  assert.equal(cameraRollSession.takeOpenMediaTab(), true);
});

test('a service just connected / imported (service_just_connected) opens on Media too, without consuming that flag', () => {
  store.clear();
  sessionStorage.setItem('service_just_connected', 'true'); // OAuth / Facebook return, Google Photos import
  assert.equal(cameraRollSession.peekOpenMediaTab(), true);
  assert.equal(cameraRollSession.takeOpenMediaTab(), true);
  assert.equal(store.get('service_just_connected'), 'true', 'MediaPage.checkOAuthReturn still sees it');
  store.clear();
});

test('session: a Media page already open switches to its Media tab at once (no flag left for the next visit)', () => {
  let calls = 0;
  const stop = cameraRollSession.onOpenMediaTab(() => { calls++; });
  store.clear();
  cameraRollSession.openMediaTabNext();
  assert.equal(calls, 1);
  assert.equal(cameraRollSession.takeOpenMediaTab(), false);
  stop();
  cameraRollSession.openMediaTabNext();
  assert.equal(calls, 1);
  assert.equal(cameraRollSession.takeOpenMediaTab(), true);
});

test('accountKeyOf: user + view + property', () => {
  assert.equal(accountKeyOf({ userId: 70, viewType: 'personal', propertyId: null }), '70|personal|');
  assert.equal(accountKeyOf({ userId: 70, viewType: 'property', propertyId: 12 }), '70|property|12');
  assert.equal(accountKeyOf({ userId: undefined, viewType: 'personal' }), '|personal|');
});

test('picks belong to the account they were picked in: another account (business switch, other user) gets none, and they are gone', () => {
  cameraRollSession.clear();
  const B = accountKeyOf({ userId: 70, viewType: 'property', propertyId: 12 });
  const picks = addPicks([], [file('a.jpg')]).picks;
  cameraRollSession.setPicks(picks, A);
  cameraRollSession.startHandoff(selectedPickFiles(picks));
  assert.deepEqual(cameraRollSession.getPicks(B), []);
  assert.deepEqual(cameraRollSession.getPicks(A), [], 'switching back does not bring them back');
  assert.equal(cameraRollSession.isHandoff(selectedPickFiles(picks)), false);
});

test('a sign-out / sign-in without a reload (ACCOUNT_STATE_CLEARED_EVENT) clears the picks and tells an open tab', () => {
  const picks = addPicks([], [file('a.jpg')]).picks;
  cameraRollSession.setPicks(picks, A);
  let told = 0;
  const stop = cameraRollSession.onClear(() => { told++; });
  window.dispatchEvent(new Event(ACCOUNT_STATE_CLEARED_EVENT));
  assert.deepEqual(cameraRollSession.getPicks(A), []);
  assert.equal(told, 1);
  stop();
  cameraRollSession.clear();
  assert.equal(told, 1, 'unsubscribed');
});

test('storage that throws (private mode, blocked site data) never breaks it: Take a Photo still works, nothing opens on Media', () => {
  const saved = globalThis.sessionStorage;
  const boom = () => { throw new Error('SecurityError'); };
  globalThis.sessionStorage = { getItem: boom, setItem: boom, removeItem: boom, clear: boom };
  try {
    assert.doesNotThrow(() => cameraRollSession.openMediaTabNext());
    assert.equal(cameraRollSession.peekOpenMediaTab(), false);
    assert.equal(cameraRollSession.takeOpenMediaTab(), false);
    let calls = 0;
    const stop = cameraRollSession.onOpenMediaTab(() => { calls++; });
    cameraRollSession.openMediaTabNext();
    assert.equal(calls, 1, 'an open Media page still switches');
    stop();
  } finally {
    globalThis.sessionStorage = saved;
  }
});
