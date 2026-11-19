// tests/utils/uploadFiles.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
// Chris, 19 Nov 2026: iPhone/Mac HEIC photos must upload everywhere (converted to JPEG in the browser), iPhone .mov
// covers must not be blocked when the browser can't read the video's length, and pickers must offer HEIC and .mov.
import { test } from 'node:test';
import assert from 'node:assert/strict';
const {
  isHeicFile, isVideoFile, isImageFile, jpegFileName, prepareImageForUpload, prepareImagesForUpload, convertHeicToJpeg,
  setHeicConverterForTests, UploadFileError, HEIC_CONVERT_FAILED, IMAGE_ACCEPT, MEDIA_ACCEPT, coverVideoTooLongMessage,
  readVideoDuration, HEIC_JPEG_QUALITY, imageAcceptFor, mediaAcceptFor,
} = await import('../../utils/uploadFiles.ts');

const file = (name, type = '', bytes = [1, 2, 3]) => new File([new Uint8Array(bytes)], name, { type, lastModified: 42 });

test('HEIC/HEIF is recognised by type or by extension (empty / octet-stream types)', () => {
  assert.equal(isHeicFile(file('a.heic', 'image/heic')), true);
  assert.equal(isHeicFile(file('a.HEIF', 'image/heif')), true);
  assert.equal(isHeicFile(file('IMG_1.HEIC', '')), true);
  assert.equal(isHeicFile(file('IMG_1.heic', 'application/octet-stream')), true);
  assert.equal(isHeicFile(file('a.jpg', 'image/jpeg')), false);
  assert.equal(isHeicFile(file('a.heic', 'video/quicktime')), false);
});

test('videos are recognised by type or by extension (.mov with no type)', () => {
  assert.equal(isVideoFile(file('IMG_2874.mov', 'video/quicktime')), true);
  assert.equal(isVideoFile(file('IMG_2874.MOV', '')), true);
  assert.equal(isVideoFile(file('clip.mp4', 'video/mp4')), true);
  assert.equal(isVideoFile(file('a.heic', 'image/heic')), false);
  assert.equal(isImageFile(file('a.heic', '')), true);
  assert.equal(isImageFile(file('a.mov', '')), false);
});

test('converted file name keeps the base and ends .jpg', () => {
  assert.equal(jpegFileName('IMG_2901.HEIC'), 'IMG_2901.jpg');
  assert.equal(jpegFileName('my.photo.heif'), 'my.photo.jpg');
  assert.equal(jpegFileName('.heic'), 'photo.jpg');
});

test('a HEIC is converted to a JPEG File (type image/jpeg, .jpg name, quality 0.9)', async () => {
  const calls = [];
  setHeicConverterForTests(async (args) => { calls.push(args); return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 9])], { type: 'image/jpeg' }); });
  try {
    const out = await prepareImageForUpload(file('IMG_2901.HEIC', 'image/heic'));
    assert.ok(out instanceof File);
    assert.equal(out.type, 'image/jpeg');
    assert.equal(out.name, 'IMG_2901.jpg');
    assert.equal(out.size, 4);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].type, 'image/jpeg');
    assert.equal(calls[0].quality, HEIC_JPEG_QUALITY);
    assert.equal(HEIC_JPEG_QUALITY, 0.9);
  } finally {
    setHeicConverterForTests(null);
  }
});

test('non-HEIC files (JPEG, PNG, video) and empty values are not converted — no converter call (photos are copied into memory, 19 Nov Mac Photos fix)', async () => {
  let called = 0;
  setHeicConverterForTests(async () => { called++; return new Blob([1]); });
  try {
    const jpg = file('a.jpg', 'image/jpeg');
    const mov = file('a.mov', 'video/quicktime');
    const jpgOut = await prepareImageForUpload(jpg);
    assert.equal(jpgOut.name, jpg.name);
    assert.equal(jpgOut.type, jpg.type);
    assert.deepEqual([...new Uint8Array(await jpgOut.arrayBuffer())], [...new Uint8Array(await jpg.arrayBuffer())]);
    assert.equal(await prepareImageForUpload(mov), mov);
    assert.equal(await prepareImageForUpload(null), null);
    assert.equal(await prepareImageForUpload(undefined), undefined);
    const list = await prepareImagesForUpload([jpg, file('b.heic', 'image/heic'), mov]);
    assert.equal(list.length, 3);
    assert.equal(list[0].name, jpg.name);
    assert.equal(list[1].name, 'b.jpg');
    assert.equal(list[2], mov);
    assert.equal(called, 1);
  } finally {
    setHeicConverterForTests(null);
  }
});

test('a HEIC that cannot be decoded gives a friendly UploadFileError', async () => {
  setHeicConverterForTests(async () => { throw new Error('libheif: unsupported'); });
  try {
    await assert.rejects(convertHeicToJpeg(file('bad.heic', 'image/heic')), (e) => e instanceof UploadFileError && e.message === HEIC_CONVERT_FAILED);
  } finally {
    setHeicConverterForTests(null);
  }
  setHeicConverterForTests(async () => new Blob([]));
  try {
    await assert.rejects(convertHeicToJpeg(file('empty.heic', 'image/heic')), UploadFileError);
  } finally {
    setHeicConverterForTests(null);
  }
});

test('picker accept strings offer HEIC/HEIF and (for media) QuickTime .mov', () => {
  for (const t of ['image/*', 'image/heic', 'image/heif', '.heic', '.heif']) assert.ok(IMAGE_ACCEPT.split(',').includes(t), t);
  for (const t of ['image/*', '.heic', 'video/*', 'video/quicktime', '.mov', '.mp4']) assert.ok(MEDIA_ACCEPT.split(',').includes(t), t);
  assert.ok(!IMAGE_ACCEPT.includes('video'));
  const mac = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131', platform: 'MacIntel', maxTouchPoints: 0 };
  assert.equal(imageAcceptFor(mac), IMAGE_ACCEPT);
  assert.equal(mediaAcceptFor(mac), MEDIA_ACCEPT);
});

test('on an iPhone / iPad the pickers stay image/* (video/*) so iOS hands over JPEGs', () => {
  const iphone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 };
  const ipad = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 };
  assert.equal(imageAcceptFor(iphone), 'image/*');
  assert.equal(imageAcceptFor(ipad), 'image/*');
  assert.equal(mediaAcceptFor(iphone), 'image/*,video/*');
});

test('cover video length: unknown length is allowed (web API checks), over 2 minutes is refused', () => {
  assert.equal(coverVideoTooLongMessage(null), null);
  assert.equal(coverVideoTooLongMessage(30), null);
  assert.equal(coverVideoTooLongMessage(120), null);
  assert.equal(coverVideoTooLongMessage(125), 'Video is too long (2m 5s). Maximum duration is 2 minutes.');
});

test('readVideoDuration never throws without a DOM (resolves null)', async () => {
  assert.equal(await readVideoDuration(file('a.mov', 'video/quicktime')), null);
});
