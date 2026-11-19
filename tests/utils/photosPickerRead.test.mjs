// tests/utils/photosPickerRead.test.mjs — Chris 19 Nov 2026: a photo picked from Mac Photos (Edit Cover → Upload from
// Desktop → Photos) failed with "Failed to upload cover photo": the web API said OK to the request, then Chrome never
// sent the photo (macOS writes that file at pick time; when it changes after the pick, Chrome won't send it).
// Every picked photo is now read into memory at once; Chrome's re-readable picker gets fresh copies until one reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
const {
  materializeFile, ensureInMemory, prepareImageForUpload, pickFiles, canUseHandlePicker, UploadFileError, PHOTO_READ_FAILED,
} = await import('../../utils/uploadFiles.ts');

const file = (name, type, bytes = [1, 2, 3]) => new File([new Uint8Array(bytes)], name, { type, lastModified: 42 });
/** A File whose read fails (what Chrome does for a picked file that changed after the pick). */
const unreadable = (name = 'IMG_9369.jpeg', type = 'image/jpeg') => {
  const f = file(name, type);
  Object.defineProperty(f, 'arrayBuffer', { value: () => Promise.reject(Object.assign(new Error('changed'), { name: 'NotReadableError' })) });
  return f;
};

test('a readable pick becomes an in-memory copy with the same name, type and bytes', async () => {
  const copy = await materializeFile(file('IMG_9369.jpeg', 'image/jpeg', [9, 8, 7]));
  assert.equal(copy.name, 'IMG_9369.jpeg');
  assert.equal(copy.type, 'image/jpeg');
  assert.deepEqual([...new Uint8Array(await copy.arrayBuffer())], [9, 8, 7]);
});

test('an unreadable pick with no way to re-read → clear message, no silent upload failure', async () => {
  await assert.rejects(materializeFile(unreadable()), (e) => e instanceof UploadFileError && e.message === PHOTO_READ_FAILED);
});

test('re-readable picker: keeps taking fresh copies until one reads (photo still being written by macOS)', async () => {
  let calls = 0;
  const reread = async () => (++calls < 3 ? unreadable() : file('IMG_9369.jpeg', 'image/jpeg', [5, 5]));
  const copy = await materializeFile(unreadable(), reread, 10, 1);
  assert.equal(calls, 3);
  assert.deepEqual([...new Uint8Array(await copy.arrayBuffer())], [5, 5]);
});

test('re-readable picker gives up after the attempts with the clear message', async () => {
  await assert.rejects(materializeFile(unreadable(), async () => unreadable(), 4, 1), (e) => e.message === PHOTO_READ_FAILED);
});

test('every photo upload path reads the photo into memory first (prepareImageForUpload)', async () => {
  await assert.rejects(prepareImageForUpload(unreadable()), (e) => e.message === PHOTO_READ_FAILED);
  const ok = await prepareImageForUpload(file('a.jpg', 'image/jpeg', [1]));
  assert.deepEqual([...new Uint8Array(await ok.arrayBuffer())], [1]);
  // already copied → not copied again
  const once = await ensureInMemory(file('b.jpg', 'image/jpeg'));
  assert.equal(await ensureInMemory(once), once);
  // videos go as they are (can be large)
  const mov = file('IMG_2874.mov', 'video/quicktime');
  assert.equal(await prepareImageForUpload(mov), mov);
});

test('re-readable picker only on a computer with showOpenFilePicker, not in an iframe, not on iPhone/Android', () => {
  const mac = { showOpenFilePicker() {}, navigator: { userAgent: 'Mozilla/5.0 (Macintosh) Chrome/157', platform: 'MacIntel', maxTouchPoints: 0 } };
  mac.self = mac; mac.top = mac;
  assert.equal(canUseHandlePicker(mac), true);
  assert.equal(canUseHandlePicker({ ...mac, showOpenFilePicker: undefined }), false); // Safari / Firefox
  const framed = { ...mac, top: {} }; framed.self = framed;
  assert.equal(canUseHandlePicker(framed), false);
  const ipad = { ...mac, navigator: { userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 } }; ipad.self = ipad; ipad.top = ipad;
  assert.equal(canUseHandlePicker(ipad), false);
});

test('pickFiles with the re-readable picker: in-memory copies, re-read when the first read fails; cancel = []', async () => {
  let reads = 0;
  const handle = { getFile: async () => (++reads === 1 ? unreadable() : file('IMG_9305.jpeg', 'image/jpeg', [4])) };
  const win = { showOpenFilePicker: async (o) => { win.opts = o; return [handle]; }, navigator: { userAgent: 'Chrome', platform: 'MacIntel', maxTouchPoints: 0 } };
  win.self = win; win.top = win;
  const files = await pickFiles({ kind: 'media', win });
  assert.equal(files.length, 1);
  assert.deepEqual([...new Uint8Array(await files[0].arrayBuffer())], [4]);
  assert.ok(win.opts.types[0].accept['image/*'].includes('.heic'));
  assert.ok(win.opts.types[0].accept['video/*'].includes('.mov'));
  const cancel = { ...win, showOpenFilePicker: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); } };
  cancel.self = cancel; cancel.top = cancel;
  assert.deepEqual(await pickFiles({ kind: 'image', win: cancel }), []);
});

test('installed Studio app (its own window) never uses the re-readable picker (Deepak 19 Nov: NotReadableError there)', async () => {
  const { isInstalledApp } = await import('../../utils/uploadFiles.ts');
  const make = (mode) => {
    const w = { showOpenFilePicker() {}, navigator: { userAgent: 'Mozilla/5.0 (Macintosh) Chrome/157', platform: 'MacIntel', maxTouchPoints: 0 },
      matchMedia: (q) => ({ matches: mode ? q === `(display-mode: ${mode})` : false }) };
    w.self = w; w.top = w;
    return w;
  };
  assert.equal(isInstalledApp(make(null)), false);
  assert.equal(canUseHandlePicker(make(null)), true); // a Chrome tab
  for (const mode of ['standalone', 'window-controls-overlay', 'minimal-ui']) {
    assert.equal(isInstalledApp(make(mode)), true, mode);
    assert.equal(canUseHandlePicker(make(mode)), false, mode);
  }
});
