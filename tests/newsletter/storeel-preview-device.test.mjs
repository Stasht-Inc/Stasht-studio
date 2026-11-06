// Chris, 6 Nov 2026 (point 2): the Storeel live preview is a real phone screen — the chosen device's CSS size,
// scaled to fit the panel — with a small device picker (iPhone 15 by default) remembered per browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PREVIEW_DEVICES, DEFAULT_PREVIEW_DEVICE, PREVIEW_DEVICE_KEY, previewDevice, fitScale, readPreviewDevice, savePreviewDevice,
} from '../../components/storeel/lib/previewDevice.ts';

test('the four phones, at their CSS sizes, iPhone 15 first by default', () => {
  assert.deepEqual(PREVIEW_DEVICES.map((d) => [d.id, d.label, d.width, d.height]), [
    ['iphone-se', 'iPhone SE', 375, 667],
    ['iphone-15', 'iPhone 15', 393, 852],
    ['iphone-15-pro-max', 'iPhone 15 Pro Max', 430, 932],
    ['pixel-8', 'Pixel 8', 412, 915],
  ]);
  assert.equal(DEFAULT_PREVIEW_DEVICE, 'iphone-15');
});

test('an unknown or missing id is the default phone', () => {
  assert.equal(previewDevice('pixel-8').label, 'Pixel 8');
  assert.equal(previewDevice('nokia-3310').id, 'iphone-15');
  assert.equal(previewDevice(null).id, 'iphone-15');
  assert.equal(previewDevice(undefined).id, 'iphone-15');
});

test('the scale fits the phone (with its frame) into the panel, by width and by height, never above 1', () => {
  // 320 px panel, no height limit: width decides.
  assert.equal(fitScale({ width: 393, height: 852 }, { width: 320 }), Number((320 / 393).toFixed(4)));
  // A short window: height decides.
  assert.equal(fitScale({ width: 393, height: 852 }, { width: 320, height: 600 }), Number((600 / 852).toFixed(4)));
  // A big panel: real size, never enlarged.
  assert.equal(fitScale({ width: 393, height: 852 }, { width: 900, height: 2000 }), 1);
  // Nothing measured yet / nonsense: a safe positive scale.
  assert.ok(fitScale({ width: 393, height: 852 }, { width: 0 }) > 0);
  assert.ok(fitScale({ width: 393, height: 852 }, { width: Number.NaN, height: -5 }) > 0);
});

test('scaling keeps the device aspect ratio for every phone', () => {
  for (const d of PREVIEW_DEVICES) {
    const s = fitScale(d, { width: 320, height: 700 });
    const ratio = (d.width * s) / (d.height * s);
    assert.ok(Math.abs(ratio - d.width / d.height) < 1e-9, d.id);
  }
});

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

test('the choice is remembered in this browser', () => {
  const s = memoryStorage();
  assert.equal(readPreviewDevice(s).id, 'iphone-15', 'nothing saved: iPhone 15');
  savePreviewDevice('iphone-15-pro-max', s);
  assert.equal(s.data[PREVIEW_DEVICE_KEY], 'iphone-15-pro-max');
  assert.equal(readPreviewDevice(s).id, 'iphone-15-pro-max');
});

test('a stale or bad saved value falls back to iPhone 15; an unknown id is never saved', () => {
  assert.equal(readPreviewDevice(memoryStorage({ [PREVIEW_DEVICE_KEY]: 'galaxy-fold' })).id, 'iphone-15');
  const s = memoryStorage({ [PREVIEW_DEVICE_KEY]: 'pixel-8' });
  savePreviewDevice('galaxy-fold', s);
  assert.equal(s.data[PREVIEW_DEVICE_KEY], 'pixel-8');
});

test('storage that throws (private window, blocked site data) or is missing never breaks the preview', () => {
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(readPreviewDevice(throwing).id, 'iphone-15');
  assert.doesNotThrow(() => savePreviewDevice('pixel-8', throwing));
  assert.equal(readPreviewDevice(null).id, 'iphone-15');
  assert.doesNotThrow(() => savePreviewDevice('pixel-8', null));
});
