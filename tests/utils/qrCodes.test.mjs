// tests/utils/qrCodes.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Dynamic QR Codes (3 Nov 2026): reading the API's answers, what the picker says about each campaign, and the small
// labels and file names the QR Codes window shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  campaignHint, campaignOptionsFromResponse, campaignUse, canPick, cleanName, normalizeQrCode, opensLabel, qrCodeFromResponse,
  qrCodesFromResponse, qrFileName, scansLabel, viewQuery, SHORT_URL_BASE,
} from '../../utils/qrCodes.ts';

const ROW = { id: 7, public_code: 'K7PQ2MZX', name: 'Front window', memory_id: 801, campaign_title: 'Fall Promo', scan_count: 12, last_scanned_at: '2026-11-02T10:00:00Z', short_url: 'https://studio.stasht.com/q/K7PQ2MZX' };

test('a code row reads as the window needs it', () => {
  assert.deepEqual(normalizeQrCode(ROW), {
    id: 7, publicCode: 'K7PQ2MZX', name: 'Front window', memoryId: 801, campaignTitle: 'Fall Promo',
    shortUrl: 'https://studio.stasht.com/q/K7PQ2MZX', scanCount: 12, lastScannedAt: '2026-11-02T10:00:00Z',
  });
});

test('missing pieces: name falls back to the campaign, the short URL to the default base, scans to 0', () => {
  const c = normalizeQrCode({ id: '3', public_code: 'ABCDEFGH', memory_id: '9', campaign: { id: 9, title: 'Open House' } });
  assert.equal(c.id, 3);
  assert.equal(c.name, 'Open House');
  assert.equal(c.memoryId, 9);
  assert.equal(c.shortUrl, `${SHORT_URL_BASE}ABCDEFGH`);
  assert.equal(c.scanCount, 0);
});

test('a code with no campaign opens nothing, even if a stale title came with it', () => {
  const c = normalizeQrCode({ ...ROW, memory_id: null, campaign_title: 'Old' });
  assert.equal(c.memoryId, null);
  assert.equal(c.campaignTitle, null);
  assert.equal(opensLabel(c), 'No campaign');
  assert.equal(opensLabel(normalizeQrCode(ROW)), 'Opens: Fall Promo');
});

test('rows without an id or a public code are dropped', () => {
  assert.equal(normalizeQrCode({ public_code: 'X' }), null);
  assert.equal(normalizeQrCode({ id: 1 }), null);
  assert.equal(normalizeQrCode(null), null);
});

test('list answers: the {success, data: []} envelope, or rows under a key', () => {
  assert.equal(qrCodesFromResponse({ success: true, data: [ROW, { bad: 1 }] }).length, 1);
  assert.equal(qrCodesFromResponse({ success: true, data: { qr_codes: [ROW] } }).length, 1);
  assert.equal(qrCodesFromResponse([ROW]).length, 1);
  assert.deepEqual(qrCodesFromResponse({ success: true }), []);
});

test('create / update answers: the code under data or data.qr_code', () => {
  assert.equal(qrCodeFromResponse({ success: true, data: ROW }).id, 7);
  assert.equal(qrCodeFromResponse({ success: true, data: { qr_code: ROW } }).id, 7);
  assert.equal(qrCodeFromResponse({ success: true, data: null }), null);
});

test('campaign options with paging meta', () => {
  const page = campaignOptionsFromResponse({
    success: true,
    data: [{ id: 1, title: 'A', published: 1 }, { id: 2, title: '', published: 0, cover_url: 'https://x/y.jpg' }, { nope: true }],
    meta: { page: 1, total_pages: 3 },
  });
  assert.equal(page.options.length, 2);
  assert.equal(page.options[1].title, 'Untitled campaign');
  assert.equal(page.options[1].coverUrl, 'https://x/y.jpg');
  assert.equal(page.page, 1);
  assert.equal(page.totalPages, 3);
  const bare = campaignOptionsFromResponse({ success: true, data: [] }, 2);
  assert.deepEqual([bare.page, bare.totalPages], [2, 2]);
  const laravel = campaignOptionsFromResponse({ success: true, data: { data: [{ id: 5, published: '2' }], current_page: 1, last_page: 4 } });
  assert.equal(laravel.options[0].published, 2);
  assert.deepEqual([laravel.page, laravel.totalPages], [1, 4]);
});

test('what each published state allows', () => {
  assert.equal(campaignUse({ published: 1 }), 'ready');
  assert.equal(campaignUse({ published: 2 }), 'viewOnly');
  assert.equal(campaignUse({ published: 3 }), 'private');
  assert.equal(campaignUse({ published: 0 }), 'unpublished');
  assert.equal(campaignUse({ published: 1, usable: false }), 'blocked');
  assert.equal(campaignUse({ published: 3, usable: false }), 'private', 'the published state explains it better');
  assert.equal(canPick('ready'), true);
  assert.equal(canPick('viewOnly'), true);
  assert.equal(canPick('private'), false);
  assert.equal(canPick('unpublished'), false);
  assert.equal(canPick('blocked'), false);
});

test('hints under each campaign in the picker', () => {
  assert.equal(campaignHint({ published: 1 }), null);
  assert.equal(campaignHint({ published: 2 }), "View only — visitors can't add moments");
  assert.equal(campaignHint({ published: 3 }), 'Private — change to Public to use');
  assert.equal(campaignHint({ published: 0 }), 'Not published');
  assert.equal(campaignHint({ published: 1, usable: false, reason: 'This campaign was deleted.' }), 'This campaign was deleted.');
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
