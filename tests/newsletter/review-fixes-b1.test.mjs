// Review fixes for Studio follow-up batch 1 (draft backups, phone photos, paste, auto-retry).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupKey, readBackup, writeBackup, clearBackup, staleBackupToOffer } from '../../components/newsletters/lib/draftBackup.ts';
import { NL_BACKUP_PREFIX, clearNewsletterBackups } from '../../utils/newsletterBackups.ts';
import { emptyDraft } from '../../components/newsletters/lib/draft.ts';
import { PICK_ACCEPT, planImage } from '../../components/newsletters/lib/images.ts';
import { pastedTextNodes, serializeTextNodes } from '../../components/newsletters/lib/textHtml.ts';
import { toResult, retryableSaveFailure } from '../../components/newsletters/lib/apiResult.ts';

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    keys: () => [...m.keys()],
  };
}

const COUNTS = { recipients: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0, failed: 0, skipped: 0 };
const server = (over = {}) => ({
  id: 7, name: 'October', subject: 'Deals', preview_text: null, from_name: 'Serpa', reply_to_email: 'a@b.ca', channels: ['email'], sms_text: null,
  template: 'basic', header: { logo_url: null, banner_url: null, background_color: '#6C60FF', title: null }, blocks: [], audience: [{ type: 'all_leads' }],
  status: 'draft', scheduled_at: null, sent_at: null, public_url: null, counts: COUNTS, created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-20T12:00:00Z', ...over,
});

test('fix 5: with no key (no user id) nothing is stored or read', () => {
  const s = memoryStorage();
  writeBackup(s, null, { draft: emptyDraft(), savedAt: 1, baseUpdatedAt: null });
  assert.equal(s.length, 0);
  assert.equal(readBackup(s, null), null);
  assert.doesNotThrow(() => clearBackup(s, null));
});

test('fix 5: logging out clears every draft backup; deleting a newsletter clears its own', () => {
  assert.equal(NL_BACKUP_PREFIX, 'stasht_nl_backup:');
  const s = memoryStorage({ 'stasht_nl_backup:5:7': '{}', 'stasht_nl_backup:5:new': '{}', 'stasht_nl_backup:9:7': '{}', 'stasht_nl_backup:5:17': '{}', stasht_token: 't' });
  clearNewsletterBackups(s, 7);
  assert.deepEqual(s.keys().sort(), ['stasht_nl_backup:5:17', 'stasht_nl_backup:5:new', 'stasht_token']);
  clearNewsletterBackups(s);
  assert.deepEqual(s.keys(), ['stasht_token']);
  assert.doesNotThrow(() => clearNewsletterBackups({ get length() { throw new Error('denied'); } }));
  assert.doesNotThrow(() => clearNewsletterBackups(null));
});

test('fix 6: after a stale reload, this tab’s edits on the older version are still offered, marked as older', () => {
  const n = server();
  const b = { draft: { ...emptyDraft(), name: 'October', subject: 'Mine', from_name: 'Serpa', reply_to_email: 'a@b.ca' }, savedAt: 1, baseUpdatedAt: '2026-10-20T10:00:00Z' };
  assert.deepEqual(staleBackupToOffer(b, n), { ...b, olderBase: true });
  assert.deepEqual(staleBackupToOffer({ ...b, baseUpdatedAt: n.updated_at }, n), { ...b, baseUpdatedAt: n.updated_at, olderBase: false });
  const same = { ...b, draft: { ...b.draft, subject: 'Deals' } };
  assert.equal(staleBackupToOffer(same, n), null, 'nothing different: nothing to offer');
  assert.equal(staleBackupToOffer(null, n), null);
});

test('fix 3: the picker does not ask for HEIC (iPhone hands over a JPEG instead)', () => {
  assert.ok(!/heic|heif/i.test(PICK_ACCEPT));
  assert.equal(PICK_ACCEPT, 'image/jpeg,image/png,image/gif,image/webp');
});

test('fix 4: a WebP with see-through parts stays WebP; one without becomes JPEG', () => {
  assert.deepEqual(planImage({ type: 'image/webp', size: 3_000_000 }, { width: 3200, height: 1600 }, true), { action: 'reencode', type: 'image/webp', width: 1600, height: 800 });
  assert.deepEqual(planImage({ type: 'image/webp', size: 3_000_000 }, { width: 3200, height: 1600 }, false), { action: 'reencode', type: 'image/jpeg', width: 1600, height: 800 });
  assert.deepEqual(planImage({ type: 'image/webp', size: 200_000 }, { width: 800, height: 600 }, true), { action: 'keep' });
  // A JPEG never has see-through parts; a PNG stays PNG either way.
  assert.deepEqual(planImage({ type: 'image/png', size: 3_000_000 }, { width: 3000, height: 1000 }, false), { action: 'reencode', type: 'image/png', width: 1600, height: 533 });
});

test('fix 8: Google Docs bold and italic spans become strong and em', () => {
  const html = '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr"><span style="font-weight:700;">Bold</span> <span style="font-style:italic;">it</span> <span style="font-weight:bold;font-style:italic">both</span> <span style="font-weight:400">plain</span></p></b>';
  assert.equal(serializeTextNodes(pastedTextNodes(html)), '<p><strong>Bold</strong> <em>it</em> <strong><em>both</em></strong> plain</p>'); // serialized as one paragraph
});

test('fix 8: Word bullet paragraphs become a list', () => {
  const html = '<p class=MsoListParagraphCxSpFirst style=\'mso-list:l0 level1 lfo1\'><![if !supportLists]><span style=\'font-family:Symbol;mso-list:Ignore\'>·<span style=\'font:7.0pt "Times New Roman"\'>&nbsp;&nbsp;&nbsp; </span></span><![endif]>First<o:p></o:p></p>'
    + '<p class=MsoListParagraphCxSpLast style=\'mso-list:l0 level1 lfo1\'><![if !supportLists]><span style=\'font-family:"Courier New";mso-list:Ignore\'>o<span>&nbsp;&nbsp; </span></span><![endif]>Second<o:p></o:p></p>'
    + '<p class=MsoNormal>After</p>';
  assert.equal(serializeTextNodes(pastedTextNodes(html)), '<ul><li>First</li><li>Second</li></ul><p>After</p>');
});

test('fix 10: only a lost connection or a server error is retried by itself', () => {
  assert.equal(retryableSaveFailure({ ok: false, error: 'x', fieldErrors: {} }), true, 'no status: the request never got an answer');
  assert.equal(retryableSaveFailure(toResult({ success: false, message: 'Server Error', statusCode: 500 })), true);
  assert.equal(retryableSaveFailure(toResult({ success: false, message: 'Bad gateway', statusCode: 502 })), true);
  assert.equal(retryableSaveFailure(toResult({ success: false, message: 'Not found', statusCode: 404 })), false);
  assert.equal(retryableSaveFailure(toResult({ success: false, message: 'Too many requests', statusCode: 429, rateLimited: true })), false);
  assert.equal(retryableSaveFailure(toResult({ success: false, code: 'stale', message: 'x', statusCode: 409 })), false);
  assert.equal(retryableSaveFailure(toResult({ success: false, message: 'Bad', errors: { name: ['x'] }, statusCode: 422 })), false);
  assert.equal(retryableSaveFailure(toResult({ success: false, code: 'plan_required', message: 'x', statusCode: 403 })), false);
  assert.equal(retryableSaveFailure({ ok: true, fieldErrors: {} }), false);
});

import { undoDelete, ACTION_TOAST_MS } from '../../components/newsletters/lib/blocks.ts';

test('fix 7: Undo says when it can’t put the section back; action toasts stay 10 seconds', () => {
  assert.equal(ACTION_TOAST_MS, 10000);
  const t = (id) => ({ id, type: 'divider', data: { style: 'line' } });
  const r = undoDelete([t('a'), t('c')], t('b'), 1);
  assert.equal(r.outcome, 'restored');
  assert.deepEqual(r.blocks.map((b) => b.id), ['a', 'b', 'c']);
  assert.equal(undoDelete(r.blocks, t('b'), 1).outcome, 'already');
  const full = Array.from({ length: 40 }, (_, i) => t(`x${i}`));
  assert.equal(undoDelete(full, t('b'), 1).outcome, 'full');
});
