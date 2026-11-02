// tests/utils/qrCodes.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Dynamic QR Codes (3 Nov 2026): reading the API's answers (the web API's contract, 3 Nov), what the picker says about
// each campaign, and the small labels and file names the QR Codes window shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  campaignHint, campaignOptionsFromResponse, campaignUse, canPick, canPublish, cleanName, normalizeQrCode, opensLabel, qrCodeFromResponse,
  qrCodesFromResponse, qrFileName, scansLabel, viewQuery, SHORT_URL_BASE,
} from '../../utils/qrCodes.ts';

const CAMPAIGN = { id: 801, title: 'Fall Promo', state: 'public', usable: true, public_url: 'https://studio.stasht.com/published-memory/fall-promo' };
const ROW = {
  id: 7, public_code: 'K7PQ2MZX', short_url: 'https://studio.stasht.com/q/K7PQ2MZX', name: 'Front window', property_id: null, memory_id: 801,
  campaign: CAMPAIGN, scan_count: 12, last_scanned_at: '2026-11-02T10:00:00Z', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-02T10:00:00Z',
};

test('a code reads as the window needs it', () => {
  assert.deepEqual(normalizeQrCode(ROW), {
    id: 7, publicCode: 'K7PQ2MZX', name: 'Front window', memoryId: 801, campaignTitle: 'Fall Promo',
    shortUrl: 'https://studio.stasht.com/q/K7PQ2MZX', scanCount: 12, lastScannedAt: '2026-11-02T10:00:00Z',
  });
});

test('missing pieces: name falls back to the campaign, the short URL to the default base, scans to 0', () => {
  const c = normalizeQrCode({ id: '3', public_code: 'ABCDEFGH', memory_id: 9, campaign: { id: 9, title: 'Open House', state: 'view_only', usable: true } });
  assert.equal(c.id, 3);
  assert.equal(c.name, 'Open House');
  assert.equal(c.memoryId, 9);
  assert.equal(c.shortUrl, `${SHORT_URL_BASE}ABCDEFGH`);
  assert.equal(c.scanCount, 0);
});

test('campaign null is "No campaign" — never set, or the campaign was deleted (memory_id may still be there)', () => {
  const deleted = normalizeQrCode({ ...ROW, memory_id: 801, campaign: null });
  assert.equal(deleted.campaignTitle, null);
  assert.equal(opensLabel(deleted), 'No campaign');
  assert.equal(opensLabel(normalizeQrCode({ ...ROW, memory_id: null, campaign: null })), 'No campaign');
  assert.equal(opensLabel(normalizeQrCode(ROW)), 'Opens: Fall Promo');
});

test('rows without an id or a public code are dropped', () => {
  assert.equal(normalizeQrCode({ public_code: 'X' }), null);
  assert.equal(normalizeQrCode({ id: 1 }), null);
  assert.equal(normalizeQrCode(null), null);
});

test('list answer {success, data: [code]}', () => {
  assert.equal(qrCodesFromResponse({ success: true, data: [ROW, { bad: 1 }] }).length, 1);
  assert.deepEqual(qrCodesFromResponse({ success: true, data: [] }), []);
  assert.deepEqual(qrCodesFromResponse({ success: true }), []);
});

test('create / update answer {success, data: code}', () => {
  assert.equal(qrCodeFromResponse({ success: true, data: ROW }).id, 7);
  assert.equal(qrCodeFromResponse({ success: true, data: null }), null);
});

const OPTIONS = {
  success: true,
  data: [
    { id: 1, title: 'A', cover_url: null, state: 'public', usable: true, can_publish: false, reason: null },
    { id: 2, title: '', cover_url: 'https://x/y.jpg', state: 'unpublished', usable: false, can_publish: true, reason: 'Not published' },
    { nope: true },
  ],
  meta: { page: 1, per_page: 20, total: 45, total_pages: 3 },
};

test('campaign options with paging meta', () => {
  const page = campaignOptionsFromResponse(OPTIONS);
  assert.equal(page.options.length, 2);
  assert.deepEqual(page.options[1], { id: 2, title: 'Untitled campaign', coverUrl: 'https://x/y.jpg', state: 'unpublished', usable: false, canPublish: true, reason: 'Not published' });
  assert.deepEqual([page.page, page.totalPages], [1, 3]);
  const bare = campaignOptionsFromResponse({ success: true, data: [] }, 2);
  assert.deepEqual([bare.page, bare.totalPages], [2, 2]);
});

const opt = (state, usable, extra = {}) => ({ state, usable, canPublish: false, reason: null, ...extra });

test('what each state allows', () => {
  assert.equal(campaignUse(opt('public', true)), 'ready');
  assert.equal(campaignUse(opt('view_only', true)), 'viewOnly');
  assert.equal(campaignUse(opt('private', false)), 'private');
  assert.equal(campaignUse(opt('unpublished', false)), 'unpublished');
  assert.equal(campaignUse(opt('public', false, { reason: 'No public link yet' })), 'blocked', 'public but no slug yet');
  assert.equal(campaignUse(opt('something-new', true)), 'unpublished', 'an unknown state is never pickable');
  for (const [use, pickable] of [['ready', true], ['viewOnly', true], ['private', false], ['unpublished', false], ['blocked', false]]) {
    assert.equal(canPick(use), pickable, use);
  }
});

test('Publish shows only when the API says the campaign can be published', () => {
  assert.equal(canPublish(opt('unpublished', false, { canPublish: true })), true);
  assert.equal(canPublish(opt('unpublished', false, { canPublish: false })), false);
  assert.equal(canPublish(opt('public', true, { canPublish: true })), false, 'already usable: nothing to publish');
});

test('hints: the server reason first, then the words for the state', () => {
  assert.equal(campaignHint(opt('public', true)), null);
  assert.equal(campaignHint(opt('view_only', true, { reason: "View only — visitors can't add moments" })), "View only — visitors can't add moments");
  assert.equal(campaignHint(opt('view_only', true)), "View only — visitors can't add moments");
  assert.equal(campaignHint(opt('private', false)), 'Private — change to Public to use');
  assert.equal(campaignHint(opt('unpublished', false)), 'Not published');
  assert.equal(campaignHint(opt('public', false, { reason: 'No public link yet' })), 'No public link yet');
});

test('scan counts read as English', () => {
  assert.equal(scansLabel(0), '0 scans');
  assert.equal(scansLabel(1), '1 scan');
  assert.equal(scansLabel(1204), '1,204 scans');
});

test('download file names', () => {
  assert.equal(qrFileName('Fall Promo 2026!', 'png'), 'qr-fall-promo-2026.png');
  assert.equal(qrFileName('Café Ünïcode', 'svg'), 'qr-cafe-unicode.svg');
  assert.equal(qrFileName('   ', 'png'), 'qr-code.png');
  assert.ok(qrFileName('x'.repeat(200), 'png').length <= 3 + 60 + 4);
});

test('the view query: property_id only in a property view', () => {
  assert.equal(viewQuery(null), '');
  assert.equal(viewQuery(12), '?property_id=12');
  assert.equal(viewQuery('abc'), '');
  assert.equal(viewQuery(12, { search: 'fall', page: 2 }), '?property_id=12&search=fall&page=2');
  assert.equal(viewQuery(undefined, { search: '' }), '');
});

test('names: trimmed, at most 120 characters, empty keeps the old one', () => {
  assert.equal(cleanName('  Front   window '), 'Front window');
  assert.equal(cleanName('   '), null);
  assert.equal(cleanName('a'.repeat(200)).length, 120);
});
