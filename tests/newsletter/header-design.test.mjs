// Chris (3 Nov): a background image behind the header's logo and name, and a logo size control.
// The same keys and numbers as the API (NewsletterContent::LOGO_HEIGHTS, header.blade.php).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKGROUND_SHADE, LOGO_HEIGHTS, LOGO_SIZES, headerInk, logoHeight, logoRatioFrom, logoSizeOf, needsLogoRatio,
  withBackgroundImage, withLogo, withLogoSize,
} from '../../components/newsletters/lib/headerDesign.ts';

const BASE = { logo_url: 'https://cdn.example.com/bmw.png', banner_url: null, background_color: '#FFFFFF', title: 'Serpa BMW' };

test('logo sizes: small is the old 48 px and the default', () => {
  assert.deepEqual(LOGO_SIZES.map((o) => o.value), ['small', 'medium', 'large']);
  assert.deepEqual(LOGO_SIZES.map((o) => o.label), ['Small', 'Medium', 'Large']);
  assert.deepEqual(LOGO_HEIGHTS, { small: 48, medium: 80, large: 120 });
  assert.equal(logoSizeOf(BASE), 'small');
  assert.equal(logoSizeOf({ ...BASE, logo_size: 'large' }), 'large');
  assert.equal(logoSizeOf({ ...BASE, logo_size: 'huge' }), 'small');
  assert.equal(logoHeight({ ...BASE, logo_size: 'medium' }), 80);
});

test('choosing a size stores it with the logo shape; small removes both, like an old header', () => {
  assert.deepEqual(withLogoSize(BASE, 'large', 3.2), { ...BASE, logo_size: 'large', logo_ratio: 3.2 });
  assert.deepEqual(withLogoSize(BASE, 'medium', null), { ...BASE, logo_size: 'medium' });
  const small = withLogoSize({ ...BASE, logo_size: 'large', logo_ratio: 3.2 }, 'small', 3.2);
  assert.deepEqual(small, BASE);
  assert.ok(!('logo_size' in small) && !('logo_ratio' in small), 'no keys left behind');
});

test('the logo shape is width ÷ height to 2 places, null for a broken image', () => {
  assert.equal(logoRatioFrom(400, 100), 4);
  assert.equal(logoRatioFrom(1000, 307), 3.26);
  assert.equal(logoRatioFrom(0, 100), null);
  assert.equal(logoRatioFrom(100, 0), null);
  assert.equal(logoRatioFrom(5000, 10), null, 'beyond 20:1');
});

test('the shape is only recorded for a bigger logo, and only when it changed', () => {
  assert.equal(needsLogoRatio(BASE, 4), false, 'small: the old markup needs no shape');
  assert.equal(needsLogoRatio({ ...BASE, logo_size: 'large' }, 4), true);
  assert.equal(needsLogoRatio({ ...BASE, logo_size: 'large', logo_ratio: 4 }, 4), false);
  assert.equal(needsLogoRatio({ ...BASE, logo_size: 'large', logo_ratio: 4 }, 1), true);
  assert.equal(needsLogoRatio({ ...BASE, logo_size: 'large' }, null), false);
});

test('a new logo forgets the old one\'s shape but keeps the size', () => {
  assert.deepEqual(withLogo({ ...BASE, logo_size: 'large', logo_ratio: 4 }, 'https://cdn.example.com/new.png'),
    { ...BASE, logo_url: 'https://cdn.example.com/new.png', logo_size: 'large' });
  assert.deepEqual(withLogo({ ...BASE, logo_size: 'large', logo_ratio: 4 }, null), { ...BASE, logo_url: null });
});

test('background image: set, and removed without leaving a key', () => {
  assert.deepEqual(withBackgroundImage(BASE, 'https://cdn.example.com/showroom.jpg'), { ...BASE, background_image_url: 'https://cdn.example.com/showroom.jpg' });
  const removed = withBackgroundImage({ ...BASE, background_image_url: 'https://cdn.example.com/showroom.jpg' }, null);
  assert.deepEqual(removed, BASE);
  assert.ok(!('background_image_url' in removed));
});

test('the name is white on a picture (dark layer), else readable on the colour', () => {
  assert.equal(BACKGROUND_SHADE, 'rgba(17,24,39,0.45)', 'the same layer as header.blade.php');
  assert.equal(headerInk('#FFFFFF', true), '#FFFFFF');
  assert.equal(headerInk('#FFFFFF', false), '#1F2937');
  assert.equal(headerInk('#1F2937', false), '#FFFFFF');
});
