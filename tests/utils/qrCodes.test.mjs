// tests/utils/qrCodes.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Dynamic QR Codes (3 Nov 2026): reading the API's answers (the web API's contract, 3 Nov), what the picker says about
// each campaign, and the small labels and file names the QR Codes window shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  campaignHint, campaignOptionsFromResponse, canManageQrCodes, campaignUse, canPick, canPublish, cleanName, normalizeQrCode, opensLabel, qrCodeFromResponse,
  qrCodesFromResponse, qrListFromResponse, uploadedUrlFromResponse, qrFileName, qrRedirectUrl, scansLabel, viewQuery, QR_REDIRECT_FALLBACK_ORIGIN, SHORT_URL_BASE,
} from '../../utils/qrCodes.ts';

const CAMPAIGN = { id: 801, title: 'Fall Promo', state: 'public', usable: true, public_url: 'https://studio.stasht.com/published-memory/fall-promo' };
const ROW = {
  id: 7, public_code: 'K7PQ2MZX', short_url: 'https://studio.stasht.com/q/K7PQ2MZX', name: 'Front window', property_id: null, memory_id: 801,
  campaign: CAMPAIGN, scan_count: 12, last_scanned_at: '2026-11-02T10:00:00Z', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-02T10:00:00Z',
};

test('a code reads as the window needs it', () => {
  assert.deepEqual(normalizeQrCode(ROW), {
    id: 7, publicCode: 'K7PQ2MZX', name: 'Front window', memoryId: 801, campaignTitle: 'Fall Promo', campaignUsable: true,
    shortUrl: 'https://studio.stasht.com/q/K7PQ2MZX', scanCount: 12, lastScannedAt: '2026-11-02T10:00:00Z',
    logoMode: 'default', logoUrl: null, color: null,
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
  assert.equal(normalizeQrCode({ ...ROW, logo: { mode: 'weird', url: null } }).logoMode, 'default');
  assert.equal(normalizeQrCode({ ...ROW, logo: { mode: 'default', url: null } }).logoUrl, null, 'no avatar: no centre image');
  // Flat fields, in case the API sends them that way.
  const flat = normalizeQrCode({ ...ROW, logo_mode: 'custom', logo_url: avatar });
  assert.equal(flat.logoMode, 'custom');
  assert.equal(flat.logoUrl, avatar);
  // Only #RRGGBB counts as a saved colour.
  for (const bad of ['red', '#abc', 'javascript:x', 12, '#12345g']) assert.equal(normalizeQrCode({ ...ROW, color: bad }).color, null, String(bad));
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

test('a campaign the API calls unusable (made private, unpublished, no link): say so, not "Opens:"', () => {
  const c = normalizeQrCode({ ...ROW, campaign: { ...CAMPAIGN, state: 'private', usable: false } });
  assert.equal(c.campaignUsable, false);
  assert.equal(opensLabel(c), 'Campaign not available — change it');
  assert.equal(normalizeQrCode({ ...ROW, campaign: null }).campaignUsable, null);
});

test('rows without an id or a public code are dropped', () => {
  assert.equal(normalizeQrCode({ public_code: 'X' }), null);
  assert.equal(normalizeQrCode({ id: 1 }), null);
  assert.equal(normalizeQrCode(null), null);
});

test('list meta.style_available: image / colour controls only when the API says it can save them', () => {
  assert.equal(qrListFromResponse({ success: true, data: [ROW], meta: { default_logo_url: null, style_available: true } }).styleAvailable, true);
  assert.equal(qrListFromResponse({ success: true, data: [ROW], meta: { style_available: false } }).styleAvailable, false);
  assert.equal(qrListFromResponse({ success: true, data: [ROW] }).styleAvailable, false, 'an API without it: the default look only');
  assert.equal(qrListFromResponse({ success: true, data: [ROW], meta: { style_available: true } }).codes.length, 1);
});

test('image upload answer {success, data: {url}}', () => {
  assert.equal(uploadedUrlFromResponse({ success: true, data: { url: 'https://stasht-media.s3.amazonaws.com/qr-codes/x.png' } }), 'https://stasht-media.s3.amazonaws.com/qr-codes/x.png');
  assert.equal(uploadedUrlFromResponse({ success: true, data: {} }), null);
  assert.equal(uploadedUrlFromResponse(null), null);
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

test('Publish shows only for an unpublished campaign the API says can be published', () => {
  assert.equal(canPublish(opt('unpublished', false, { canPublish: true })), true);
  assert.equal(canPublish(opt('unpublished', false, { canPublish: false })), false);
  assert.equal(canPublish(opt('public', true, { canPublish: true })), false, 'already usable: nothing to publish');
  assert.equal(canPublish(opt('private', false, { canPublish: true })), false, 'private: changing it to Public is not done here');
  assert.equal(canPublish(opt('public', false, { canPublish: true, reason: 'No public link yet' })), false, 'no public link yet: publishing again would not help');
  assert.equal(canPublish(opt('view_only', false, { canPublish: true })), false);
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

test('names: trimmed, at most 120 characters, empty keeps the old one', () => {
  assert.equal(cleanName('  Front   window '), 'Front window');
  assert.equal(cleanName('   '), null);
  assert.equal(cleanName('a'.repeat(200)).length, 120);
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
