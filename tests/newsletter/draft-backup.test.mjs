import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupKey, readBackup, writeBackup, clearBackup, moveBackup, backupToOffer } from '../../components/newsletters/lib/draftBackup.ts';
import { emptyDraft } from '../../components/newsletters/lib/draft.ts';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    get size() { return m.size; },
  };
}
const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('denied'); } };

const COUNTS = { recipients: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0, failed: 0, skipped: 0 };
const server = (over = {}) => ({
  id: 7, name: 'October', subject: 'Deals', preview_text: null, from_name: 'Serpa', reply_to_email: 'a@b.ca', channels: ['email'], sms_text: null,
  template: 'basic', header: { logo_url: null, banner_url: null, background_color: '#6C60FF', title: null }, blocks: [], audience: [{ type: 'all_leads' }],
  status: 'draft', scheduled_at: null, sent_at: null, public_url: null, counts: COUNTS, created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-20T10:00:00Z', ...over,
});

test('backupKey: per account and per newsletter, "new" before the draft exists', () => {
  assert.equal(backupKey(5, 7), 'stasht_nl_backup:5:7');
  assert.equal(backupKey(5, null), 'stasht_nl_backup:5:new');
  // Review fix 5: no shared key 0 — no backup without a signed-in user id.
  assert.equal(backupKey(null, 7), null);
  assert.equal(backupKey(0, 7), null);
});

test('write, read and clear round-trip', () => {
  const s = memoryStorage();
  const draft = { ...emptyDraft(), subject: 'Hi' };
  writeBackup(s, 'k', { draft, savedAt: 1000, baseUpdatedAt: null });
  assert.deepEqual(readBackup(s, 'k'), { draft, savedAt: 1000, baseUpdatedAt: null });
  clearBackup(s, 'k');
  assert.equal(readBackup(s, 'k'), null);
});

test('storage that throws (private mode, full) never breaks the composer', () => {
  assert.doesNotThrow(() => writeBackup(throwing, 'k', { draft: emptyDraft(), savedAt: 1, baseUpdatedAt: null }));
  assert.equal(readBackup(throwing, 'k'), null);
  assert.doesNotThrow(() => clearBackup(throwing, 'k'));
  assert.doesNotThrow(() => moveBackup(throwing, 'a', 'b'));
  assert.equal(readBackup(null, 'k'), null);
});

test('a broken or foreign value reads as nothing', () => {
  const s = memoryStorage();
  s.setItem('k', '{not json');
  assert.equal(readBackup(s, 'k'), null);
  s.setItem('k', JSON.stringify({ hello: 1 }));
  assert.equal(readBackup(s, 'k'), null);
});

test('moveBackup takes the "new" copy over to the created draft id', () => {
  const s = memoryStorage();
  writeBackup(s, 'new', { draft: emptyDraft(), savedAt: 5, baseUpdatedAt: null });
  moveBackup(s, 'new', 'id7');
  assert.equal(readBackup(s, 'new'), null);
  assert.equal(readBackup(s, 'id7').savedAt, 5);
});

test('backupToOffer: nothing to offer when the copy matches the server', () => {
  const n = server();
  const b = { draft: { ...emptyDraft(), name: 'October', subject: 'Deals', from_name: 'Serpa', reply_to_email: 'a@b.ca' }, savedAt: Date.parse(n.updated_at) + 5000, baseUpdatedAt: n.updated_at };
  assert.equal(backupToOffer(b, n), null);
});

test('backupToOffer: offers a changed copy made on top of the same server version', () => {
  const n = server();
  const b = { draft: { ...emptyDraft(), name: 'October', subject: 'Deals!!', from_name: 'Serpa', reply_to_email: 'a@b.ca' }, savedAt: 1, baseUpdatedAt: n.updated_at };
  assert.equal(backupToOffer(b, n), b);
});

test('backupToOffer: a copy made on another server version is never offered (no clock comparison)', () => {
  // Review fix 1: the browser clock and the server's updated_at are never compared.
  const n = server({ updated_at: '2026-10-20T12:00:00Z' });
  const b = { draft: { ...emptyDraft(), subject: 'Old' }, savedAt: Date.parse('2026-10-20T11:00:00Z'), baseUpdatedAt: '2026-10-20T10:00:00Z' };
  assert.equal(backupToOffer(b, n), null);
  const laterClock = { ...b, savedAt: Date.parse('2026-10-20T12:30:00Z') };
  assert.equal(backupToOffer(laterClock, n), null);
  assert.equal(backupToOffer({ ...b, baseUpdatedAt: null }, n), null, 'no base: not offered for a saved draft');
});

test('backupToOffer for a new newsletter: only a copy that differs from an empty draft', () => {
  assert.equal(backupToOffer({ draft: emptyDraft(), savedAt: 1, baseUpdatedAt: null }, null), null);
  const b = { draft: { ...emptyDraft(), subject: 'Draft before the save' }, savedAt: 1, baseUpdatedAt: null };
  assert.equal(backupToOffer(b, null), b);
  assert.equal(backupToOffer(null, null), null);
});

test('backupToOffer: header differences alone do not count (a new draft takes the brand header)', () => {
  const b = { draft: { ...emptyDraft({ title: 'Serpa' }) }, savedAt: 1, baseUpdatedAt: null };
  assert.equal(backupToOffer(b, null), null);
});
