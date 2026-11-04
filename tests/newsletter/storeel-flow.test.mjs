// Chris, 4 Nov 2026, point 9: the Storeel flow (Create / Edit a Storeel) in three numbered steps like the newsletter
// composer: 1 Set up (Continue saves: POST /memories, or PUT /memories/{id} when editing), 2 Moments (a link to the
// campaign page; coming back resumes on step 3), 3 Send (newsletter-style audience, tracked Storeels).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FLOW_STEPS, FLOW_RESUME_KEY, FLOW_RESUME_MAX_AGE_MS, clearFlowResume, dateRangeFor, momentsOf, readFlowResume, seedFromMemory,
  sendPayload, startStep, stepNumber, stepStatus, updatePayload, writeFlowResume, formFromSeed, coverFromSeed, firstImageOf,
} from '../../components/storeel/lib/storeelFlow.ts';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

test('three steps, numbered like the newsletter composer', () => {
  assert.deepEqual(FLOW_STEPS, ['setup', 'moments', 'send']);
  assert.deepEqual(FLOW_STEPS.map(stepNumber), [1, 2, 3]);
});

test('a new Storeel starts on Set up; an edit starts on Set up too; coming back from the campaign page starts on Send', () => {
  assert.equal(startStep({ campaignId: null }), 'setup');
  assert.equal(startStep({ campaignId: null, resume: 'send' }), 'setup', 'nothing to resume without a campaign');
  assert.equal(startStep({ campaignId: 42 }), 'setup');
  assert.equal(startStep({ campaignId: 42, resume: 'send' }), 'send');
  assert.equal(startStep({ campaignId: 42, resume: 'moments' }), 'moments');
});

test('each card is current, done or not reached yet; nothing past Set up until the campaign is saved', () => {
  assert.equal(stepStatus('setup', 'setup', false), 'current');
  assert.equal(stepStatus('moments', 'setup', false), 'locked');
  assert.equal(stepStatus('send', 'setup', false), 'locked');
  assert.equal(stepStatus('setup', 'moments', true), 'done');
  assert.equal(stepStatus('moments', 'moments', true), 'current');
  assert.equal(stepStatus('send', 'moments', true), 'locked');
  assert.equal(stepStatus('setup', 'send', true), 'done');
  assert.equal(stepStatus('moments', 'send', true), 'done');
  assert.equal(stepStatus('send', 'send', true), 'current');
  // Back on Set up of a saved campaign (Edit pressed on its summary): the later steps stay reachable.
  assert.equal(stepStatus('moments', 'setup', true), 'locked');
});

test('Add moments on the campaign page remembers the campaign; coming back resumes on Send, once', () => {
  const s = memoryStorage();
  const now = 1_700_000_000_000;
  writeFlowResume(s, 77, now);
  assert.ok(s.m.has(FLOW_RESUME_KEY));
  assert.deepEqual(readFlowResume(s, now + 1000), { memoryId: 77, step: 'send', at: now });
  assert.deepEqual(readFlowResume(s, now + 1000, 77), { memoryId: 77, step: 'send', at: now }, 'for this campaign');
  assert.equal(readFlowResume(s, now + 1000, 78), null, 'another campaign page does not offer it');
  assert.equal(readFlowResume(s, now + FLOW_RESUME_MAX_AGE_MS + 1), null, 'too old: forgotten');
  clearFlowResume(s);
  assert.equal(readFlowResume(s, now + 1000), null);
});

test('a broken or missing resume note is ignored, and storage that throws never breaks the flow', () => {
  const s = memoryStorage();
  s.setItem(FLOW_RESUME_KEY, '{not json');
  assert.equal(readFlowResume(s, Date.now()), null);
  s.setItem(FLOW_RESUME_KEY, JSON.stringify({ memoryId: 'abc', at: Date.now() }));
  assert.equal(readFlowResume(s, Date.now()), null);
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  assert.equal(readFlowResume(throwing, Date.now()), null);
  assert.doesNotThrow(() => writeFlowResume(throwing, 1, Date.now()));
  assert.doesNotThrow(() => clearFlowResume(throwing));
});

// GET /memories/{id} (MemoriesController::show): data.memory with the columns and the moments (posts).
const DETAIL = {
  id: 3021, title: 'Spring Open House', slug: 'spring-open-house', published: 0, is_car: 0, user_id: 707,
  category: { id: 8, name: 'Service' }, sub_category: { id: 3, name: 'Events' },
  min_uploaded_img_date: '2026-10-01', max_uploaded_img_date: '2026-10-09 00:00:00', location: 'Toronto, ON', tags: ['spring', 'open house'],
  last_update_img: 'https://cdn.example.com/cover.jpg',
  posts: [{ id: 1, parent_id: null }, { id: 2, parent_id: null }, { id: 3, parent_id: 1 }],
};

test('Edit opens the flow prefilled from the campaign', () => {
  const seed = seedFromMemory({ data: { memory: DETAIL } });
  assert.deepEqual(seed, {
    id: 3021, title: 'Spring Open House', category: 'Service', categoryId: 8, label: 'Events', date: '2026-10-01', endDate: '2026-10-09',
    location: 'Toronto, ON', tags: ['spring', 'open house'], cover: { kind: 'photo', url: 'https://cdn.example.com/cover.jpg' },
    slug: 'spring-open-house', published: 0, isCar: false, moments: 2, ownerId: 707, firstImage: null,
  });
  assert.deepEqual(formFromSeed(seed), {
    title: 'Spring Open House', category: 'Service', label: 'Events', date: '2026-10-01', endDate: '2026-10-09', location: 'Toronto, ON', tags: ['spring', 'open house'],
  });
  assert.deepEqual(coverFromSeed(seed), { kind: 'photo', url: 'https://cdn.example.com/cover.jpg' });
});

test('the seed reads every shape the campaign comes in, and a single day has no end date', () => {
  const one = seedFromMemory({ ...DETAIL, max_uploaded_img_date: '2026-10-01', last_update_img: 'https://cdn.example.com/intro.MP4?x=1', sub_category: null, tags: null, posts: undefined, photos: { count: 5 }, is_car: 1 });
  assert.equal(one.endDate, '');
  assert.equal(one.label, '');
  assert.deepEqual(one.tags, []);
  assert.deepEqual(one.cover, { kind: 'video', url: 'https://cdn.example.com/intro.MP4?x=1' });
  assert.equal(one.moments, 5);
  assert.equal(one.isCar, true);
  assert.equal(seedFromMemory({ success: true, data: { data: { memory: DETAIL } } }).id, 3021, 'apiRequest envelope + server envelope');
  assert.equal(seedFromMemory(null), null);
  assert.equal(seedFromMemory({ title: 'no id' }), null);
  assert.equal(seedFromMemory({ ...DETAIL, last_update_img: '' }).cover, null);
  assert.equal(seedFromMemory({ ...DETAIL, min_uploaded_img_date: null, max_uploaded_img_date: null }).date, '');
});

test('the preview\'s moment card: the first moment\'s picture (never a video)', () => {
  assert.equal(firstImageOf({ posts: [{ id: 1, parent_id: null, image_link: 'https://cdn.example.com/clip.mp4' }, { id: 2, parent_id: null, image_link: 'https://cdn.example.com/a.jpg' }] }), 'https://cdn.example.com/a.jpg');
  assert.equal(firstImageOf({ posts: [{ id: 1, parent_id: 9, image_link: 'https://cdn.example.com/sub.jpg' }] }), null, 'a sub-image is not a moment');
  assert.equal(firstImageOf({ photos: { preview_images: [{ url: 'https://cdn.example.com/p.jpg' }] } }), 'https://cdn.example.com/p.jpg');
  assert.equal(firstImageOf({}), null);
});

test('the moments count: top-level moments, else the photo count the API gives', () => {
  assert.equal(momentsOf({ posts: [{ id: 1 }, { id: 2, parent_id: 1 }, { id: 3, parent_id: null }] }), 2);
  assert.equal(momentsOf({ photos: { count: 4 } }), 4);
  assert.equal(momentsOf({ photos_count: '3' }), 3);
  assert.equal(momentsOf({}), 0);
});

test('the date range the API reads: "Oct 1, 2026" or "Oct 1, 2026 - Oct 9, 2026", never a day early', () => {
  assert.equal(dateRangeFor('2026-10-01', ''), 'Oct 1, 2026');
  assert.equal(dateRangeFor('2026-10-01', '2026-10-09'), 'Oct 1, 2026 - Oct 9, 2026');
  assert.equal(dateRangeFor('2026-10-01', '2026-10-01'), 'Oct 1, 2026');
  assert.equal(dateRangeFor('', ''), '');
  assert.equal(dateRangeFor('2026-12-31', ''), 'Dec 31, 2026');
});

const CATEGORIES = [{ id: 7, name: 'Personal' }, { id: 8, name: 'Service' }];

test('Set up of an edited campaign saves with PUT /memories/{id}: its fields, and the cover only when it changed', () => {
  const form = { title: '  Spring Open House 2  ', category: 'Personal', label: 'Events', date: '2026-10-02', endDate: '2026-10-09', location: 'Mississauga, ON', tags: ['spring'] };
  assert.deepEqual(updatePayload(form, CATEGORIES, { changed: false, url: null }), {
    title: 'Spring Open House 2', category_id: 7, sub_category_id: 'Events', date_range: 'Oct 2, 2026 - Oct 9, 2026', location: 'Mississauga, ON', tags: ['spring'],
  });
  assert.deepEqual(updatePayload({ ...form, label: ' ' }, CATEGORIES, { changed: true, url: 'https://cdn.example.com/new.jpg' }), {
    title: 'Spring Open House 2', category_id: 7, sub_category_id: null, date_range: 'Oct 2, 2026 - Oct 9, 2026', location: 'Mississauga, ON', tags: ['spring'],
    last_update_img: 'https://cdn.example.com/new.jpg',
  });
  // Cover removed: null (the campaign falls back to the brand).
  assert.equal(updatePayload(form, CATEGORIES, { changed: true, url: null }).last_update_img, null);
  // A category that isn't in the list (still loading): left as it is.
  assert.equal('category_id' in updatePayload({ ...form, category: 'Gone' }, CATEGORIES, { changed: false, url: null }), false);
  // No date: the date is left as it is.
  assert.equal('date_range' in updatePayload({ ...form, date: '', endDate: '' }, CATEGORIES, { changed: false, url: null }), false);
});

test('Send now: the audience, channels, the message as typed (trimmed) and one idempotency key per press', () => {
  const payload = sendPayload({
    audience: [{ type: 'list', id: 7 }, { type: 'lead_group', id: 12 }], channels: ['sms', 'email'], message: '  Come see our spring open house.  ', idempotencyKey: 'k-1',
  });
  assert.deepEqual(payload, {
    audience: [{ type: 'list', id: 7 }, { type: 'lead_group', id: 12 }], channels: ['email', 'sms'], message: 'Come see our spring open house.', idempotency_key: 'k-1',
  });
  assert.deepEqual(sendPayload({ audience: [{ type: 'person', email: 'a@b.com', phone: '+14165550100' }], channels: ['email'], message: 'Hi', idempotencyKey: 'k-2' }).audience,
    [{ type: 'person', email: 'a@b.com', phone: '+14165550100' }]);
});
