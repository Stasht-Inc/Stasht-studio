// tests/utils/brandPictures.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Chris, 7 Nov 2026 (review rework): the web API judges each brand picture once (logo or photo + its solid colour) and
// hands it over as `brand_pictures` on campaign payloads, or GET /brand-picture?url=. utils/brandPictures keeps those
// answers (memory + localStorage) so a cover paints the right look at once — never a hidden wait, and a picture seen
// before never switches look on a later visit.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};
let fetches = [];
globalThis.fetch = async (url) => {
  fetches.push(String(url));
  const target = new URL(String(url), 'https://studio.example').searchParams.get('url');
  if (target?.includes('slow')) return { ok: false, status: 503, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => ({ success: true, data: { kind: 'logo', color: '#0062A8', frame: false } }) };
};

const mod = await import('../../utils/brandPictures.ts');
const { seedBrandPictures, knownBrandPicture, requestBrandPicture, subscribeBrandPictures, parseBrandPicture, brandPictureEligible, __resetBrandPictures } = mod;

const S3 = 'https://stasht-data.s3.us-east-2.amazonaws.com/profile_images/royal.png';
beforeEach(() => { store.clear(); fetches = []; __resetBrandPictures(); });

test('answers on a payload are kept and readable at once (no request)', () => {
  seedBrandPictures({ success: true, data: {}, brand_pictures: { [S3]: { kind: 'logo', color: '#0062a8', frame: false } } });
  assert.deepEqual(knownBrandPicture(S3), { kind: 'logo', color: '#0062A8', frame: false });
  assert.equal(fetches.length, 0);
});

test('they survive a reload (localStorage), so a picture seen before never switches look', () => {
  seedBrandPictures({ brand_pictures: { [S3]: { kind: 'photo', color: null, frame: false } } });
  __resetBrandPictures({ keepStorage: true });
  assert.deepEqual(knownBrandPicture(S3), { kind: 'photo', color: null, frame: false });
});

test('bad shapes are ignored', () => {
  assert.equal(parseBrandPicture(null), null);
  assert.equal(parseBrandPicture({ kind: 'banner', color: '#000000', frame: false }), null);
  assert.equal(parseBrandPicture({ kind: 'logo', color: 'red', frame: false }), null);
  assert.deepEqual(parseBrandPicture({ kind: 'logo', color: null }), { kind: 'logo', color: null, frame: false });
  seedBrandPictures({ brand_pictures: 'nope' });
  seedBrandPictures({ brand_pictures: { [S3]: { kind: 'x' } } });
  assert.equal(knownBrandPicture(S3), undefined);
  store.set('stasht_brand_pictures_v2', '{not json');
  __resetBrandPictures({ keepStorage: true });
  assert.equal(knownBrandPicture(S3), undefined);
});

test('only pictures the API can judge are asked about (our bucket, Google profile pictures; no query)', () => {
  assert.equal(brandPictureEligible(S3), true);
  assert.equal(brandPictureEligible('https://lh3.googleusercontent.com/a/ACg8oc_x=s96-c'), true);
  for (const u of ['', 'http://stasht-data.s3.us-east-2.amazonaws.com/a.png', 'https://other.s3.amazonaws.com/a.png?X-Amz-Signature=1',
    `${S3}?v=2`, 'https://evil.example/a.png', 'data:image/png;base64,AAAA', '/cd-img/royal.jpg', `${S3.replace('.png', '.svg')}`]) {
    assert.equal(brandPictureEligible(u), false, u);
  }
});

test('an unknown picture is asked about once; listeners hear the answer', async () => {
  let heard = 0;
  const off = subscribeBrandPictures(() => { heard += 1; });
  requestBrandPicture(S3);
  requestBrandPicture(S3);
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  off();
  assert.equal(fetches.length, 1);
  assert.match(fetches[0], /\/brand-picture\?url=/);
  assert.deepEqual(knownBrandPicture(S3), { kind: 'logo', color: '#0062A8', frame: false });
  assert.equal(heard, 1);
});

test('a failed answer is not asked again in this visit (the cover keeps the 4 Nov look)', async () => {
  const slow = S3.replace('royal', 'slow');
  requestBrandPicture(slow);
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  requestBrandPicture(slow);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(fetches.length, 1);
  assert.equal(knownBrandPicture(slow), null);
});

test('the store is capped', () => {
  const many = {};
  for (let i = 0; i < 260; i++) many[`${S3}-${i}`] = { kind: 'logo', color: '#112233', frame: false };
  seedBrandPictures({ brand_pictures: many });
  const saved = JSON.parse(store.get('stasht_brand_pictures_v2'));
  assert.ok(Object.keys(saved).length <= 200);
  assert.ok(saved[`${S3}-259`], 'the newest are kept');
});
