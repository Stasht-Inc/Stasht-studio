// tests/utils/campaignCoverPick.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// "Brand everywhere" (Deepak, 4 Nov 2026): a campaign with NO chosen cover (last_update_img empty) shows the brand —
// the property's image in the property view, else the owner's / author's profile image — everywhere: preview, owner
// campaign page, shared view, published page and campaign cards. Never the first moment photo. Car / catalogue /
// Shopify cards keep their own images. The web API's campaign list already sends last_update_img = cover ?? the
// owner's profile image (MemoriesController::formatLatestMemory), so an avatar there means "no chosen cover".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignCover, campaignCardCover } from '../../utils/campaignCover.ts';

const AVATAR = 'https://cdn.test/owner.png';
const PROPERTY = 'https://cdn.test/property.png';
const PHOTO = 'https://cdn.test/cover.jpg';

test('a chosen cover is the cover', () => {
  assert.deepEqual(campaignCover({ chosen: PHOTO, brand: AVATAR, ownerAvatar: AVATAR }), { src: PHOTO, isBrand: false });
  assert.deepEqual(campaignCover({ chosen: 'https://s3.test/intro.mp4', brand: AVATAR }), { src: 'https://s3.test/intro.mp4', isBrand: false });
});

test('no chosen cover: the brand, never the first photo', () => {
  assert.deepEqual(campaignCover({ chosen: null, brand: AVATAR }), { src: AVATAR, isBrand: true });
  assert.deepEqual(campaignCover({ chosen: '  ', brand: PROPERTY, ownerAvatar: AVATAR }), { src: PROPERTY, isBrand: true });
});

test("last_update_img that is just the owner's avatar (filled in by the API) counts as no chosen cover", () => {
  assert.deepEqual(campaignCover({ chosen: AVATAR, brand: AVATAR, ownerAvatar: AVATAR }), { src: AVATAR, isBrand: true });
  // property view: the brand is the property's image
  assert.deepEqual(campaignCover({ chosen: AVATAR, brand: PROPERTY, ownerAvatar: AVATAR }), { src: PROPERTY, isBrand: true });
});

test('no cover and no brand image: nothing (the page shows the initial on the profile colour)', () => {
  assert.deepEqual(campaignCover({ chosen: null, brand: null }), { src: null, isBrand: false });
});

const card = (over = {}) => ({
  id: 1, title: 'Fall Promo', category: { name: 'Events' }, author: { name: 'Owner', avatar: AVATAR },
  last_update_img: AVATAR, photos: { preview_images: [{ url: 'https://cdn.test/first-moment.jpg' }] }, ...over,
});

test('cards: a campaign with no chosen cover shows the brand, not its first moment photo', () => {
  assert.deepEqual(campaignCardCover(card()), { src: AVATAR, isBrand: true });
  assert.deepEqual(campaignCardCover(card({ last_update_img: null })), { src: AVATAR, isBrand: true });
  assert.deepEqual(campaignCardCover(card({ last_update_img: null }), { propertyImage: PROPERTY }), { src: PROPERTY, isBrand: true });
  assert.deepEqual(campaignCardCover(card({ last_update_img: AVATAR }), { propertyImage: PROPERTY }), { src: PROPERTY, isBrand: true });
  assert.deepEqual(campaignCardCover(card({ last_update_img: PHOTO })), { src: PHOTO, isBrand: false });
  // no avatar anywhere: no picture (MemoryCard shows the author's initials)
  assert.deepEqual(campaignCardCover(card({ last_update_img: null, author: { name: 'Owner' } })), { src: null, isBrand: false });
});

test('cards: car, catalogue and Shopify cards keep their own images', () => {
  const carPhoto = 'https://cdn.test/car.jpg';
  for (const over of [
    { isCars: true, last_update_img: carPhoto },
    { isShopify: true, last_update_img: carPhoto },
    { isCatalogItem: true, last_update_img: carPhoto },
    { category: { name: 'Cars' }, last_update_img: null, photos: { preview_images: [{ url: carPhoto }] } },
    { category: { name: 'Shopify' }, last_update_img: null, thumbnail: carPhoto, photos: {} },
    { category: { name: 'Website Catalogue' }, last_update_img: null, photos: { preview_images: [{ url: carPhoto }] } },
    { is_car: true, last_update_img: null, photos: { preview_images: [{ url: carPhoto }] } },
  ]) {
    assert.deepEqual(campaignCardCover(card(over)), { src: carPhoto, isBrand: false }, JSON.stringify(over));
  }
});
