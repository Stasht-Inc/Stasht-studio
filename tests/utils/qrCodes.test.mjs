// tests/utils/qrCodes.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// QR codes (3 Nov 2026): reading the API's answers (the web API's contract), and the file names and view query the QR
// Code popover uses. QR codes v2 (3 Nov evening): one code per view (GET /qr-code), any campaign of the view live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  campaignOptionsFromResponse, canManageQrCodes, liveCampaignRows, normalizeQrCode, qrCodeAnswer, qrCodeFromResponse,
  uploadedUrlFromResponse, qrFileName, qrRedirectUrl, viewQuery, QR_REDIRECT_FALLBACK_ORIGIN, SHORT_URL_BASE,
} from '../../utils/qrCodes.ts';

const CAMPAIGN = { id: 801, title: 'Fall Promo', state: 'public', usable: true, public_url: 'https://studio.stasht.com/published-memory/fall-promo' };
const ROW = {
  id: 7, public_code: 'K7PQ2MZX', short_url: 'https://studio.stasht.com/q/K7PQ2MZX', name: 'Front window', property_id: null, memory_id: 801,
  campaign: CAMPAIGN, scan_count: 12, last_scanned_at: '2026-11-02T10:00:00Z', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-02T10:00:00Z',
};

test('a code reads as the popover needs it', () => {
  assert.deepEqual(normalizeQrCode(ROW), {
    id: 7, publicCode: 'K7PQ2MZX', name: 'Front window', memoryId: 801, campaignTitle: 'Fall Promo',
    shortUrl: 'https://studio.stasht.com/q/K7PQ2MZX', logoMode: 'default', logoUrl: null, logoDefaultUrl: null, color: null,
  });
});

test('branded codes: logo {mode, url} and color (null = auto); older answers draw the default avatar', () => {
  const avatar = 'https://stasht-media.s3.amazonaws.com/profile/u707.jpg';
  const c = normalizeQrCode({ ...ROW, logo: { mode: 'default', url: avatar, default_url: avatar }, color: '#00704a' });
  assert.equal(c.logoMode, 'default');
  assert.equal(c.logoUrl, avatar);
  assert.equal(c.color, '#00704A');
  const custom = normalizeQrCode({ ...ROW, logo: { mode: 'custom', url: 'https://stasht-media.s3.amazonaws.com/qr-codes/a1.png' }, color: null });
  assert.equal(custom.logoMode, 'custom');
  assert.equal(custom.color, null);
  const none = normalizeQrCode({ ...ROW, logo: { mode: 'none', url: avatar } });
  assert.equal(none.logoMode, 'none');
  assert.equal(none.logoUrl, null, 'no logo: nothing to draw, whatever url says');
  // default_url: the avatar "Use profile picture" goes back to (offered only when there is one).
  assert.equal(normalizeQrCode({ ...ROW, logo: { mode: 'none', url: null, default_url: avatar } }).logoDefaultUrl, avatar);
  assert.equal(normalizeQrCode({ ...ROW, logo: { mode: 'custom', url: avatar, default_url: null } }).logoDefaultUrl, null);
  assert.equal(c.logoDefaultUrl, avatar);
  assert.equal(normalizeQrCode({ ...ROW, logo: { mode: 'weird', url: null } }).logoMode, 'default');
  assert.equal(normalizeQrCode({ ...ROW, logo: { mode: 'default', url: null } }).logoUrl, null, 'no avatar: no centre image');
  // Flat fields, in case the API sends them that way.
  const flat = normalizeQrCode({ ...ROW, logo_mode: 'custom', logo_url: avatar });
  assert.equal(flat.logoMode, 'custom');
  assert.equal(flat.logoUrl, avatar);
  // Only #RRGGBB counts as a saved colour.
  for (const bad of ['red', '#abc', 'javascript:x', 12, '#12345g']) assert.equal(normalizeQrCode({ ...ROW, color: bad }).color, null, String(bad));
});

test('missing pieces: name falls back to the campaign, the short URL to the default base', () => {
  const c = normalizeQrCode({ id: '3', public_code: 'ABCDEFGH', memory_id: 9, campaign: { id: 9, title: 'Open House', state: 'view_only', usable: true } });
  assert.equal(c.id, 3);
  assert.equal(c.name, 'Open House');
  assert.equal(c.memoryId, 9);
  assert.equal(c.shortUrl, `${SHORT_URL_BASE}ABCDEFGH`);
});

test('campaign null: no live campaign — none in the view yet, or it was deleted (memory_id may still be there)', () => {
  const deleted = normalizeQrCode({ ...ROW, memory_id: 801, campaign: null });
  assert.equal(deleted.campaignTitle, null);
  assert.equal(deleted.memoryId, null, 'a deleted campaign is not live');
  assert.equal(normalizeQrCode({ ...ROW, memory_id: null, campaign: null }).memoryId, null);
  // Any published state is fine now: the code reads the same for an unpublished campaign.
  const draft = normalizeQrCode({ ...ROW, memory_id: 803, campaign: { id: 803, title: 'Spring Sale', state: 'unpublished' } });
  assert.equal(draft.memoryId, 803);
  assert.equal(draft.campaignTitle, 'Spring Sale');
});

test('rows without an id or a public code are dropped', () => {
  assert.equal(normalizeQrCode({ public_code: 'X' }), null);
  assert.equal(normalizeQrCode({ id: 1 }), null);
  assert.equal(normalizeQrCode(null), null);
});

test('GET /qr-code: the view\'s code; image / colour controls unless meta.style_available is false', () => {
  const a = qrCodeAnswer({ success: true, data: ROW, meta: { style_available: true } });
  assert.equal(a.code.id, 7);
  assert.equal(a.styleAvailable, true);
  assert.equal(qrCodeAnswer({ success: true, data: ROW, meta: { style_available: false } }).styleAvailable, false);
  assert.equal(qrCodeAnswer({ success: true, data: ROW }).styleAvailable, true, 'absent: the API serving /qr-code has the style columns');
  assert.equal(qrCodeAnswer({ success: true, data: null }), null);
  assert.equal(qrCodeAnswer({ success: true, data: [ROW] }), null, 'a list is not THE code');
});

test('image upload answer {success, data: {url}}', () => {
  assert.equal(uploadedUrlFromResponse({ success: true, data: { url: 'https://stasht-media.s3.amazonaws.com/qr-codes/x.png' } }), 'https://stasht-media.s3.amazonaws.com/qr-codes/x.png');
  assert.equal(uploadedUrlFromResponse({ success: true, data: {} }), null);
  assert.equal(uploadedUrlFromResponse(null), null);
});

test('update answer {success, data: code}', () => {
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

test('campaign options with paging meta: every campaign, whatever its state', () => {
  const page = campaignOptionsFromResponse(OPTIONS);
  assert.equal(page.options.length, 2);
  assert.deepEqual(page.options, [{ id: 1, title: 'A' }, { id: 2, title: 'Untitled campaign' }]);
  assert.deepEqual([page.page, page.totalPages, page.total], [1, 3, 45]);
  const bare = campaignOptionsFromResponse({ success: true, data: [] }, 2);
  assert.deepEqual([bare.page, bare.totalPages, bare.total], [2, 2, 0]);
  assert.equal(campaignOptionsFromResponse({ success: true, data: [{ id: 1, title: 'A' }, { id: 2, title: 'B' }] }).total, 2, 'no meta: the count');
});

test('the dropdown always lists the live campaign, even when it is not on the loaded page', () => {
  const opts = [{ id: 1, title: 'A' }, { id: 2, title: 'B' }];
  assert.deepEqual(liveCampaignRows(opts, { id: 2, title: 'B' }, false), opts, 'already there: no duplicate');
  assert.deepEqual(liveCampaignRows(opts, { id: 9, title: 'Live one' }, false).map((o) => o.id), [9, 1, 2]);
  assert.deepEqual(liveCampaignRows(opts, { id: 9, title: 'Live one' }, true), opts, 'searching: only the matches');
  assert.deepEqual(liveCampaignRows(opts, null, false), opts);
});

test('download file names', () => {
  assert.equal(qrFileName('Fall Promo 2026!', 'png'), 'qr-fall-promo-2026.png');
  assert.equal(qrFileName('Café Ünïcode', 'svg'), 'qr-cafe-unicode.svg');
  assert.equal(qrFileName('   ', 'png'), 'qr-code.png');
  assert.equal(qrFileName('Fall Promo', 'png', 'transparent'), 'qr-fall-promo-transparent.png');
  assert.ok(qrFileName('x'.repeat(200), 'png').length <= 3 + 60 + 4);
});

test('the view query: property_id only in a property view', () => {
  assert.equal(viewQuery(null), '');
  assert.equal(viewQuery(12), '?property_id=12');
  assert.equal(viewQuery('abc'), '');
  assert.equal(viewQuery(12, { search: 'fall', page: 2 }), '?property_id=12&search=fall&page=2');
  assert.equal(viewQuery(undefined, { search: '' }), '');
});

test('/q/<code> reached in Studio (an old service worker): off to the API host, never back to this origin', () => {
  const studio = 'https://studio.stasht.com';
  // Production: no VITE_API_BASE_URL (the API is same-origin /api/react) → the restapi default.
  assert.equal(qrRedirectUrl('K7PQ2MZX', undefined, studio), `${QR_REDIRECT_FALLBACK_ORIGIN}/q/K7PQ2MZX`);
  assert.equal(qrRedirectUrl('K7PQ2MZX', '/api/react', studio), `${QR_REDIRECT_FALLBACK_ORIGIN}/q/K7PQ2MZX`);
  assert.equal(qrRedirectUrl('K7PQ2MZX', `${studio}/api/react`, studio), `${QR_REDIRECT_FALLBACK_ORIGIN}/q/K7PQ2MZX`, 'same origin would loop');
  // A configured API host elsewhere (staging) is used.
  assert.equal(qrRedirectUrl('K7PQ2MZX', 'https://restapi-stasht.wd-projects.online/api/react', 'https://stashtpro.wd-projects.online'),
    'https://restapi-stasht.wd-projects.online/q/K7PQ2MZX');
  // Running on the API host itself: nowhere to go.
  assert.equal(qrRedirectUrl('K7PQ2MZX', undefined, QR_REDIRECT_FALLBACK_ORIGIN), null);
  // Only real codes.
  assert.equal(qrRedirectUrl('', undefined, studio), null);
  assert.equal(qrRedirectUrl('../admin', undefined, studio), null);
  assert.equal(qrRedirectUrl('x'.repeat(17), undefined, studio), null);
  assert.equal(qrRedirectUrl('K7PQ2MZX', 'javascript:alert(1)', studio), `${QR_REDIRECT_FALLBACK_ORIGIN}/q/K7PQ2MZX`);
});

test('who sees the QR Codes button: account view = the account; property view = its own account or anyone who can manage it', () => {
  const me = { external_user_id: 707 };
  assert.equal(canManageQrCodes('personal', null, me, false), true);
  assert.equal(canManageQrCodes('personal', null, me, true), false, 'partial admins never');
  // The property's own account.
  assert.equal(canManageQrCodes('property', { id: 12, user_id: 707 }, me, false), true);
  assert.equal(canManageQrCodes('property', { id: 12, user_id: '707' }, me, false), true);
  // The main account (inviter / admin) in a property whose account is someone else's: the row's can_manage.
  assert.equal(canManageQrCodes('property', { id: 96, user_id: 966, can_manage: true }, me, false), true);
  assert.equal(canManageQrCodes('property', { id: 96, user_id: 966, can_manage: false }, me, false), false);
  assert.equal(canManageQrCodes('property', { id: 96, user_id: 966 }, me, false), false);
  assert.equal(canManageQrCodes('property', { id: 96, user_id: 966, can_manage: true }, me, true), false, 'partial admins never');
  assert.equal(canManageQrCodes('property', null, me, false), false);
  assert.equal(canManageQrCodes('property', { id: 12, user_id: 707 }, null, false), false);
});
