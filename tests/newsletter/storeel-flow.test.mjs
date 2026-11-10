// Storeel flow v2 (Deepak, 4 Nov 2026) with Chris's change the same day: ONE scrolling page like the newsletter
// composer. Numbered cards, all open, top to bottom — 1 Campaign (every field; the preview shows every moment), 2 Send
// (optional) — and the actions at the BOTTOM of the list: Save as Draft (creates only) and Save & Send (creates,
// then the send confirm). Edit: Save Changes / Save & Send. Nothing is saved before one of them is pressed; no step
// gating, no Continue, no primary action in the header. No Moments step, no resume note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FLOW_STEPS, dateRangeFor, momentsOf, seedFromMemory, sendPayload, stepNumber, updatePayload, formFromSeed, coverFromSeed, flowView, CURRENT_CATEGORY,
  saveBlockedReason, createdToast,
} from '../../components/storeel/lib/storeelFlow.ts';
import * as flow from '../../components/storeel/lib/storeelFlow.ts';

test('three numbered cards, all open: 1 Campaign, 2 Moments (the original Add a Moment UI), 3 Send', () => {
  assert.deepEqual(FLOW_STEPS, ['campaign', 'moments', 'send']);
  assert.deepEqual(FLOW_STEPS.map(stepNumber), [1, 2, 3]);
});

test('the resume note and its helpers are gone (moments come from step 1)', () => {
  for (const name of ['startStep', 'stepStatus', 'writeFlowResume', 'readFlowResume', 'clearFlowResume', 'flowOwnerKey', 'sessionNotes', 'FLOW_RESUME_KEY']) {
    assert.equal(name in flow, false, `${name} removed`);
  }
});

test('create: the bottom actions are Save as Draft (creates only) and Save & Send; Send is optional', () => {
  const v = flowView({ editing: false, created: false });
  assert.equal(v.title, 'Create Campaign');
  assert.deepEqual(v.save, { label: 'Save as Draft', action: 'create' });
  assert.deepEqual(v.saveAndSend, { label: 'Save & Send', action: 'create' });
  assert.equal(v.savedToast, 'Saved as a draft');
  assert.equal(v.sendOptional, 'Optional — send it now or later from the campaign page.');
  assert.equal(v.createdNote, null);
  assert.equal(v.closeToast, null, 'Cancel before anything is saved: nothing to say');
});

test('create, after Save & Send made it but the send was not confirmed: it is saved (PUT from now on), and says so', () => {
  const v = flowView({ editing: false, created: true });
  assert.equal(v.title, 'Edit Campaign', 'the campaign exists now');
  assert.equal(v.closeLabel, 'Close', 'nothing to cancel any more');
  assert.deepEqual(v.save, { label: 'Save Changes', action: 'save' });
  assert.deepEqual(v.saveAndSend, { label: 'Save & Send', action: 'save' });
  assert.equal(v.createdNote, 'Saved as a draft. Send it now, or later from the campaign page.');
  assert.equal(v.savedToast, 'Changes saved');
  assert.equal(v.closeToast, 'Saved as a draft', 'closing keeps it, and says so');
});

test('edit: Save Changes (PUT) and Save & Send on the same single page', () => {
  const v = flowView({ editing: true, created: false });
  assert.equal(v.title, 'Edit Campaign');
  assert.deepEqual(v.save, { label: 'Save Changes', action: 'save' });
  assert.deepEqual(v.saveAndSend, { label: 'Save & Send', action: 'save' });
  assert.equal(v.savedToast, 'Changes saved');
  assert.equal(v.createdNote, null);
  assert.equal(v.closeToast, null);
});

// Review (4 Nov): what a user sees around the bottom actions.
test('Cancel says Close once something was saved straight to the campaign; Save & Send left: "Changes saved…"', () => {
  const base = flowView({ editing: true, created: false });
  assert.equal(base.closeLabel, 'Cancel');
  assert.equal(base.momentsNote, 'Moments and captions save straight to your campaign. The title, cover and other details save with Save Changes.');
  assert.equal(flowView({ editing: true, created: false, savedNow: true }).closeLabel, 'Close', 'a caption or moment was saved');
  const sent = flowView({ editing: true, created: false, changesSaved: true });
  assert.equal(sent.closeLabel, 'Close');
  assert.equal(sent.createdNote, 'Changes saved. Send it now, or later.');
  assert.equal(flowView({ editing: false, created: false }).momentsNote, null, 'before creating, moments are held here');
  assert.equal(flowView({ editing: false, created: true }).momentsNote, 'Moments and captions save straight to your campaign. The title, cover and other details save with Save Changes.');
  assert.equal(flowView({ editing: false, created: false }).closeLabel, 'Cancel');
});

test('why the save button is off, said above the actions', () => {
  assert.equal(saveBlockedReason({ title: '  ', category: 'Personal', coverUploading: false }), 'Add a campaign title.');
  assert.equal(saveBlockedReason({ title: 'Spring', category: '', coverUploading: false }), 'Pick a category.');
  assert.equal(saveBlockedReason({ title: 'Spring', category: 'Personal', coverUploading: true }), 'Wait for the cover to finish uploading.');
  assert.equal(saveBlockedReason({ title: 'Spring', category: 'Personal', coverUploading: false }), null);
});

test('Save as Draft with a filled-in Send card says it was not sent', () => {
  assert.equal(createdToast(false), 'Saved as a draft');
  assert.equal(createdToast(true), 'Saved as a draft — not sent.');
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
      { kind: 'photo', key: 'post-1', postId: 1, image: null, video: false, title: '', caption: '', location: '', date: '' },
      { kind: 'photo', key: 'post-2', postId: 2, image: null, video: false, title: '', caption: '', location: '', date: '' },
    ],
    // Moderation per campaign (Chris, 7 Nov 2026): unknown here (no moderation fields) → the account decides.
    moderation: null,
    moderationApplies: null,
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
  // Chris 9 Nov 2026 (point 6): the Publishing choice goes as publish_role (the publish endpoint's 1 / 2 / 3); none: left out.
  assert.equal(sendPayload({ audience: [], channels: ['email'], message: 'Hi', idempotencyKey: 'k-3', publishRole: 2 }).publish_role, 2);
  assert.equal('publish_role' in sendPayload({ audience: [], channels: ['email'], message: 'Hi', idempotencyKey: 'k-4' }), false);
  assert.equal('publish_role' in sendPayload({ audience: [], channels: ['email'], message: 'Hi', idempotencyKey: 'k-5', publishRole: null }), false);
});
