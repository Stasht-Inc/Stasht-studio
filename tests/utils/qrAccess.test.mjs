// tests/utils/qrAccess.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// QR codes v2 (3 Nov 2026 evening): the public campaign page reads ?qr= from its URL and adds it to every API call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignAccessBody, qrFromSearch, withQr } from '../../utils/qrAccess.ts';

test('the page\'s ?qr=: letters and digits, at most 16; anything else is ignored', () => {
  assert.equal(qrFromSearch('?qr=K7PQ2MZX'), 'K7PQ2MZX');
  assert.equal(qrFromSearch('qr=K7PQ2MZX&post_id=3'), 'K7PQ2MZX');
  assert.equal(qrFromSearch(new URLSearchParams('s=abc&qr=AB12')), 'AB12');
  assert.equal(qrFromSearch('?qr=%20K7PQ2MZX%20'), 'K7PQ2MZX', 'trimmed');
  for (const bad of ['?qr=', '?qr=a-b', '?qr=K7PQ2MZXAB3CD4EF9', '?qr=%3Cscript%3E', '?other=1', '', null, undefined]) {
    assert.equal(qrFromSearch(bad), null, String(bad));
  }
});

test('withQr adds qr= to a path, after any query it already has', () => {
  assert.equal(withQr('/published-memories?token=fall-promo', 'K7PQ2MZX'), '/published-memories?token=fall-promo&qr=K7PQ2MZX');
  assert.equal(withQr('/memories/submit-photo', 'K7PQ2MZX'), '/memories/submit-photo?qr=K7PQ2MZX');
  assert.equal(withQr('/published-memory/fall-promo#top', 'K7PQ2MZX'), '/published-memory/fall-promo?qr=K7PQ2MZX#top');
  assert.equal(withQr('/x?', 'AB'), '/x?qr=AB');
  assert.equal(withQr('/x?a=1&', 'AB'), '/x?a=1&qr=AB');
});

test('no code, or a malformed one: the path as it is', () => {
  assert.equal(withQr('/memory-detail/9', null), '/memory-detail/9');
  assert.equal(withQr('/memory-detail/9', ''), '/memory-detail/9');
  assert.equal(withQr('/memory-detail/9', 'a&b=c'), '/memory-detail/9');
  assert.equal(withQr('/memory-detail/9', undefined), '/memory-detail/9');
});

test('campaign access body (track-view, comments): qr and / or the Private page\'s access_token', () => {
  assert.deepEqual(campaignAccessBody('K7PQ2MZX', null), { qr: 'K7PQ2MZX' });
  assert.deepEqual(campaignAccessBody(null, 'tok123'), { access_token: 'tok123' });
  assert.deepEqual(campaignAccessBody('K7PQ2MZX', ' tok123 '), { qr: 'K7PQ2MZX', access_token: 'tok123' });
  assert.equal(campaignAccessBody(null, null), null, 'a Public page: no body, as before');
  assert.equal(campaignAccessBody('', '   '), null);
  assert.deepEqual(campaignAccessBody('bad code!', 'tok'), { access_token: 'tok' }, 'a malformed code is never sent');
});
