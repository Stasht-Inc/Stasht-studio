// Storeel flow v2 (Deepak, 4 Nov 2026 — approved design): Create / Edit a Storeel in TWO numbered steps.
//   1 Campaign — every Set up field incl. media and the catalogue / vehicle pickers; the live preview shows every moment.
//              Nothing is saved until "Create Campaign" (edit: "Save Changes" = PUT /memories/{id}). Once saved it
//              folds to "Campaign created" (edit: "Changes saved") with View campaign and Edit.
//   2 Send (optional) — enabled only once step 1 is saved; Done keeps the campaign, Send Now opens the confirm.
// No separate Moments step, no resume note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FLOW_STEPS, dateRangeFor, momentsOf, seedFromMemory, sendPayload, stepNumber, updatePayload, formFromSeed, coverFromSeed, flowView, CURRENT_CATEGORY,
} from '../../components/storeel/lib/storeelFlow.ts';
import * as flow from '../../components/storeel/lib/storeelFlow.ts';

test('two steps: 1 Campaign, 2 Send (no Moments step)', () => {
  assert.deepEqual(FLOW_STEPS, ['campaign', 'send']);
  assert.deepEqual(FLOW_STEPS.map(stepNumber), [1, 2]);
});

test('the resume note and its helpers are gone (moments come from step 1)', () => {
  for (const name of ['startStep', 'stepStatus', 'writeFlowResume', 'readFlowResume', 'clearFlowResume', 'flowOwnerKey', 'sessionNotes', 'FLOW_RESUME_KEY']) {
    assert.equal(name in flow, false, `${name} removed`);
  }
});

test('create, before saving: Cancel + Create Campaign; Send waits with a muted line; nothing else creates it', () => {
  const v = flowView({ editing: false, saved: false, campaignOpen: true });
  assert.equal(v.title, 'Create Campaign');
  assert.equal(v.campaign, 'open');
  assert.deepEqual(v.secondary, { label: 'Cancel', action: 'close' });
  assert.deepEqual(v.primary, { label: 'Create Campaign', action: 'create' });
  assert.equal(v.sendEnabled, false);
  assert.equal(v.sendLockedLine, 'Save your campaign first — then you can send it now or later.');
  assert.equal(v.back, 'close');
});

test('create, saved: step 1 folds to "Campaign created"; Done + Send Now; Send says it is saved and optional', () => {
  const v = flowView({ editing: false, saved: true, campaignOpen: false });
  assert.equal(v.campaign, 'saved');
  assert.equal(v.savedLabel, 'Campaign created');
  assert.deepEqual(v.secondary, { label: 'Done', action: 'done' });
  assert.deepEqual(v.primary, { label: 'Send Now', action: 'send' });
  assert.equal(v.sendEnabled, true);
  assert.equal(v.sendIntro, 'Your campaign is saved. Send it now, or do it later.');
  assert.equal(v.doneToast, 'Campaign created');
  assert.equal(v.back, 'done', 'Back after saving keeps it, like Done');
});

test('saved, step 1 opened again with Edit: Save Changes (PUT) and Cancel (put the saved values back); Send waits again', () => {
  const v = flowView({ editing: false, saved: true, campaignOpen: true });
  assert.equal(v.campaign, 'open');
  assert.deepEqual(v.primary, { label: 'Save Changes', action: 'save' });
  assert.deepEqual(v.secondary, { label: 'Cancel', action: 'revert' });
  assert.equal(v.sendEnabled, false);
  assert.equal(v.sendLockedLine, 'Save your changes first — then you can send it now or later.');
  assert.equal(v.back, 'done');
});

test('edit from the campaign page: prefilled, Cancel + Save Changes; after saving "Changes saved", Done + Send Now', () => {
  const before = flowView({ editing: true, saved: false, campaignOpen: true });
  assert.equal(before.title, 'Edit Campaign');
  assert.deepEqual(before.primary, { label: 'Save Changes', action: 'save' });
  assert.deepEqual(before.secondary, { label: 'Cancel', action: 'close' });
  assert.equal(before.sendEnabled, false);
  assert.equal(before.sendLockedLine, 'Save your changes first — then you can send it now or later.');
  const after = flowView({ editing: true, saved: true, campaignOpen: false });
  assert.equal(after.savedLabel, 'Changes saved');
  assert.deepEqual(after.primary, { label: 'Send Now', action: 'send' });
  assert.deepEqual(after.secondary, { label: 'Done', action: 'done' });
  assert.equal(after.doneToast, 'Changes saved');
  assert.equal(after.sendIntro, 'Your campaign is saved. Send it now, or do it later.');
});

const CATEGORIES = [{ id: 7, name: 'Personal' }, { id: 8, name: 'Service' }];

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
    id: 3021, title: 'Spring Open House', category: 'Service', categoryId: 8, categoryKind: 'regular', label: 'Events', date: '2026-10-01', endDate: '2026-10-09',
    location: 'Toronto, ON', tags: ['spring', 'open house'], cover: { kind: 'photo', url: 'https://cdn.example.com/cover.jpg' },
    slug: 'spring-open-house', published: 0, isCar: false, moments: 2, ownerId: 707,
    // The preview in Edit shows the campaign's own moments (storeel-moments.test.mjs).
    previewMoments: [
      { kind: 'photo', key: 'post-1', image: null, video: false, text: '', location: '', date: '' },
      { kind: 'photo', key: 'post-2', image: null, video: false, text: '', location: '', date: '' },
    ],
  });
  assert.deepEqual(formFromSeed(seed), {
    title: 'Spring Open House', category: 'Service', label: 'Events', date: '2026-10-01', endDate: '2026-10-09', location: 'Toronto, ON', tags: ['spring', 'open house'],
  });
  assert.deepEqual(coverFromSeed(seed), { kind: 'photo', url: 'https://cdn.example.com/cover.jpg' });
});

// Review fix (critical): GET /memories/{id} sends category null for Shopify, Cars and property-category campaigns.
test('the seed keeps a Shopify, Cars or property-category campaign\'s category (never falls back to Personal)', () => {
  const shopify = seedFromMemory({ ...DETAIL, category: null, category_id: null, is_shopify: 1 });
  assert.equal(shopify.category, 'Shopify');
  assert.equal(shopify.categoryKind, 'shopify');
  const car = seedFromMemory({ ...DETAIL, category: null, category_id: null, is_car: 1 });
  assert.equal(car.category, 'Cars');
  assert.equal(car.categoryKind, 'car');
  // Viewed from the personal view: the property's categories aren't known by name.
  const prop = seedFromMemory({ ...DETAIL, category: null, category_id: null, property_category_id: 44 });
  assert.equal(prop.categoryKind, 'property');
  assert.equal(prop.categoryId, 44);
  assert.equal(prop.category, CURRENT_CATEGORY);
  // The property view's own categories name it.
  assert.equal(seedFromMemory({ ...DETAIL, category: null, property_category_id: 44 }, [{ id: '44', name: 'Showroom' }]).category, 'Showroom');
  assert.equal(seedFromMemory({ ...DETAIL, category: null, category_id: null }).category, CURRENT_CATEGORY, 'no category at all: kept as it is');
});

test('a campaign with no dates keeps no dates (review: never today\'s date on save)', () => {
  const seed = seedFromMemory({ ...DETAIL, min_uploaded_img_date: null, max_uploaded_img_date: null });
  const form = formFromSeed(seed);
  assert.equal(form.date, '');
  assert.equal('date_range' in updatePayload(form, CATEGORIES, { changed: false, url: null }, seed.category), false);
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

test('the moments count: top-level moments and linked campaigns / vehicles, else the photo count the API gives', () => {
  assert.equal(momentsOf({ posts: [{ id: 1 }, { id: 2, parent_id: 1 }, { id: 3, parent_id: null }] }), 2);
  assert.equal(momentsOf({ posts: [{ id: 1 }], linked_memories: [{ id: 5 }, { id: 6 }] }), 3);
  assert.equal(momentsOf({ posts: [], linked_memories: [{ id: 5 }] }), 1);
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


test('Set up of an edited campaign saves with PUT /memories/{id}: its fields, and the cover only when it changed', () => {
  const form = { title: '  Spring Open House 2  ', category: 'Personal', label: 'Events', date: '2026-10-02', endDate: '2026-10-09', location: 'Mississauga, ON', tags: ['spring'] };
  assert.deepEqual(updatePayload(form, CATEGORIES, { changed: false, url: null }, 'Service'), {
    title: 'Spring Open House 2', category_id: 7, sub_category_id: 'Events', date_range: 'Oct 2, 2026 - Oct 9, 2026', location: 'Mississauga, ON', tags: ['spring'],
  });
  assert.deepEqual(updatePayload({ ...form, label: ' ' }, CATEGORIES, { changed: true, url: 'https://cdn.example.com/new.jpg' }, 'Service'), {
    title: 'Spring Open House 2', category_id: 7, sub_category_id: null, date_range: 'Oct 2, 2026 - Oct 9, 2026', location: 'Mississauga, ON', tags: ['spring'],
    last_update_img: 'https://cdn.example.com/new.jpg',
  });
  // Cover removed: null (the campaign falls back to the brand).
  assert.equal(updatePayload(form, CATEGORIES, { changed: true, url: null }, 'Service').last_update_img, null);
  // A category that isn't in the list (still loading): left as it is.
  assert.equal('category_id' in updatePayload({ ...form, category: 'Gone' }, CATEGORIES, { changed: false, url: null }, 'Service'), false);
  // No date: the date is left as it is.
  assert.equal('date_range' in updatePayload({ ...form, date: '', endDate: '' }, CATEGORIES, { changed: false, url: null }, 'Service'), false);
});

// Review fixes 1-2: PUT /memories/{id} gets category_id only when the person picked another real category.
test('category_id only when changed to a real category (Shopify, Cars, Website Catalogue and property categories are never re-filed)', () => {
  const dropdown = [...CATEGORIES, { id: 'shopify', name: 'Shopify' }, { id: 'cars', name: 'Cars' }, { id: 'website_catalogue', name: 'Website Catalogue' }];
  const form = { title: 'T', category: 'Shopify', label: '', date: '2026-10-01', endDate: '', location: '', tags: [] };
  const put = (category, seeded) => updatePayload({ ...form, category }, dropdown, { changed: false, url: null }, seeded);
  assert.equal('category_id' in put('Shopify', 'Shopify'), false, 'Shopify campaign, untouched: its links stay');
  assert.equal('category_id' in put('Cars', 'Cars'), false, 'Cars campaign, untouched: no 422 on "cars"');
  assert.equal('category_id' in put('Website Catalogue', 'Website Catalogue'), false, 'catalogue campaign, untouched: no 422 on the placeholder');
  assert.equal('category_id' in put(CURRENT_CATEGORY, CURRENT_CATEGORY), false, 'property category from the personal view: untouched');
  assert.equal(put('Personal', 'Service').category_id, 7, 'changed to a real category: sent');
  assert.equal(put('Personal', 'Shopify').category_id, 7, 'Shopify campaign moved to a real category on purpose');
  assert.equal(put('Shopify', 'Service').category_id, 'shopify', 'moved to Shopify on purpose');
  assert.equal('category_id' in put('Cars', 'Service'), false, 'never the cars placeholder');
  assert.equal('category_id' in put('Website Catalogue', 'Service'), false, 'never the catalogue placeholder');
  assert.equal(updatePayload({ ...form, category: 'Personal' }, [{ id: '7', name: 'Personal' }], { changed: false, url: null }, 'Service').category_id, '7', 'a numeric id as text is fine');
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
