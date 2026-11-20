// tests/utils/videoPickRead.test.mjs — Chris 20 Nov 2026 (call 19 Nov 07:33–08:30): photos picked from Mac Photos upload
// now, "videos are still not working". A video picked from Photos is written by macOS at pick time like a photo, and
// Chrome won't send it once it changed — but videos were passed through untouched (never read into memory). Now every
// upload path reads videos into memory too (up to 500 MB, the web API's video limit), with a "video" message.
import { test } from 'node:test';
import assert from 'node:assert/strict';
const {
  ensureInMemory, prepareImageForUpload, prepareImagesForUpload, pickFiles, materializeFile, readFailedMessage,
  UploadFileError, VIDEO_READ_FAILED, PHOTO_READ_FAILED, MAX_IN_MEMORY_BYTES,
} = await import('../../utils/uploadFiles.ts');

const file = (name, type, bytes = [1, 2, 3]) => new File([new Uint8Array(bytes)], name, { type, lastModified: 42 });
const unreadable = (name, type) => {
  const f = file(name, type);
  Object.defineProperty(f, 'arrayBuffer', { value: () => Promise.reject(Object.assign(new Error('changed'), { name: 'NotReadableError' })) });
  return f;
};
/** A File that says it is huge, and fails the test if anything reads it. */
const huge = (name, type) => {
  const f = file(name, type);
  Object.defineProperty(f, 'size', { value: MAX_IN_MEMORY_BYTES + 1 });
  Object.defineProperty(f, 'arrayBuffer', { value: () => { throw new Error('a huge file must not be read into memory'); } });
  return f;
};

test('a video upload is an in-memory copy with the same name, type and bytes (prepareImageForUpload)', async () => {
  const mov = file('IMG_2874.mov', 'video/quicktime', [7, 7, 7]);
  const copy = await prepareImageForUpload(mov);
  assert.notEqual(copy, mov);
  assert.equal(copy.name, 'IMG_2874.mov');
  assert.equal(copy.type, 'video/quicktime');
  assert.deepEqual([...new Uint8Array(await copy.arrayBuffer())], [7, 7, 7]);
  // already in memory → not copied again
  assert.equal(await ensureInMemory(copy), copy);
});

test('a video with no type (extension only) is read too', async () => {
  const copy = await prepareImageForUpload(file('clip.MOV', '', [1]));
  assert.equal(copy.name, 'clip.MOV');
  assert.deepEqual([...new Uint8Array(await copy.arrayBuffer())], [1]);
});

test('an unreadable video says "video", not "photo"', async () => {
  await assert.rejects(prepareImageForUpload(unreadable('IMG_2874.mov', 'video/quicktime')),
    (e) => e instanceof UploadFileError && e.message === VIDEO_READ_FAILED);
  await assert.rejects(materializeFile(unreadable('IMG_1.jpeg', 'image/jpeg')), (e) => e.message === PHOTO_READ_FAILED);
  assert.equal(readFailedMessage(file('a.mp4', 'video/mp4')), VIDEO_READ_FAILED);
  assert.equal(readFailedMessage(file('a.jpg', 'image/jpeg')), PHOTO_READ_FAILED);
  assert.equal(VIDEO_READ_FAILED, "This video couldn't be read. Please pick it again.");
});

test('cap: a video over 500 MB goes as it is (never read into memory; the web API refuses it with its message)', async () => {
  assert.equal(MAX_IN_MEMORY_BYTES, 500 * 1024 * 1024);
  const big = huge('long.mov', 'video/quicktime');
  assert.equal(await prepareImageForUpload(big), big);
  assert.equal(await ensureInMemory(big), big);
});

test('photos keep working: JPEG copied, list keeps order with photos and videos', async () => {
  const out = await prepareImagesForUpload([file('a.jpg', 'image/jpeg', [1]), file('b.mp4', 'video/mp4', [2]), file('c.png', 'image/png', [3])]);
  assert.deepEqual(out.map((f) => f.name), ['a.jpg', 'b.mp4', 'c.png']);
  assert.deepEqual(await Promise.all(out.map(async (f) => [...new Uint8Array(await f.arrayBuffer())][0])), [1, 2, 3]);
});

test('re-readable picker: a Photos video still being written is read again until it reads', async () => {
  let reads = 0;
  const handle = { getFile: async () => (++reads < 3 ? unreadable('IMG_2874.mov', 'video/quicktime') : file('IMG_2874.mov', 'video/quicktime', [9])) };
  const win = { showOpenFilePicker: async () => [handle], navigator: { userAgent: 'Chrome', platform: 'MacIntel', maxTouchPoints: 0 } };
  win.self = win; win.top = win;
  const [picked] = await pickFiles({ kind: 'media', win });
  assert.equal(reads >= 3, true);
  assert.deepEqual([...new Uint8Array(await picked.arrayBuffer())], [9]);
  // and it isn't copied again on upload
  assert.equal(await prepareImageForUpload(picked), picked);
});

test('plain file input (installed app / Safari): a picked video is read into memory at once', async () => {
  const mov = file('IMG_2874.mov', 'video/quicktime', [4, 2]);
  const doc = {
    body: { appendChild() {} },
    createElement() {
      const input = { style: {}, parentNode: null, addEventListener() {}, click() { input.files = [mov]; void input.onchange(); } };
      return input;
    },
  };
  const win = { navigator: { userAgent: 'Mozilla/5.0 (Macintosh) Chrome/157', platform: 'MacIntel', maxTouchPoints: 0 } };
  win.self = win; win.top = win;
  const [picked] = await pickFiles({ kind: 'media', win, doc });
  assert.notEqual(picked, mov);
  assert.deepEqual([...new Uint8Array(await picked.arrayBuffer())], [4, 2]);
});

test('plain file input: an unreadable video rejects with the video message (the caller shows "Pick again")', async () => {
  const bad = unreadable('IMG_2874.mov', 'video/quicktime');
  const doc = {
    body: { appendChild() {} },
    createElement() {
      const input = { style: {}, parentNode: null, addEventListener() {}, click() { input.files = [bad]; void input.onchange(); } };
      return input;
    },
  };
  const win = { navigator: { userAgent: 'Safari', platform: 'MacIntel', maxTouchPoints: 0 } };
  win.self = win; win.top = win;
  await assert.rejects(pickFiles({ kind: 'media', win, doc }), (e) => e.message === VIDEO_READ_FAILED);
});
