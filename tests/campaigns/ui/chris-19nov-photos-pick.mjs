// Chris 19 Nov 2026 (evening, video 17.08.16) — Edit Cover → Upload from Desktop → Photos → a photo → "Failed to upload
// cover photo". Server logs: the web API answered the browser's OK-to-send (OPTIONS 204) and the photo itself was never
// sent: macOS writes a Photos pick (HEIC → .jpeg, iCloud download) at pick time and Chrome won't send a file that
// changed after the pick. Now Chrome / Edge use the re-readable picker (showOpenFilePicker) and every pick is read into
// memory at once, re-read while the first reads fail. This script stubs the picker with a Mac-Photos-like handle whose
// first copies can't be read, then a readable JPEG, and checks the cover is uploaded and shown (1280).
// (Header of the copied harness — the flows below replace the ones it lists:)
//
//  6.  All Campaigns: a pending invite card shows ONE button row (Accept / Deny — no Public badge or pink "Invites"
//      pill behind them); a real mouse click on Deny reaches Deny, sends {status: 0}, and the card goes; Accept sends
//      {status: 1} and opens the campaign; a refused Deny says so and keeps the card.
//  7a. Campaign page → Edit Cover → Upload from Desktop → an iPhone HEVC .mov (Chrome can't read its length): no
//      "Unable to validate video duration", the .mov is uploaded as video/quicktime and becomes the cover.
//      A 130-second H.264 video is refused in the browser ("Video is too long (2m 10s)…"), nothing uploaded.
//  7b. A refused cover upload (the web API's 422 "too long") leaves the cover exactly as it was (same picture, title,
//      Edit Cover still there) — after the toast and after a reload.
//  8.  Edit Cover with a HEIC photo: what is uploaded is a JPEG (image/jpeg, IMG_2901.jpg, JPEG bytes), and it shows.
//      Add a Moment → Choose Files → Upload from Desktop with a HEIC: the server's refusal (no HEIC support) is
//      retried as a JPEG; where the server converts HEIC itself (390 run) the HEIC goes once, as it is; the thumbnail
//      shows; Add all sends the uploaded URL.
//  10d. Every file picker on the way offers HEIC/HEIF (and .mov where videos are allowed) in its accept list.
// node tests/campaigns/ui/chris-19nov-uploads.mjs   (dev server: C19_BASE, default http://127.0.0.1:5451;
//   C19_SHOTS = screenshot dir). Every API call is answered here; every non-local request is aborted.
import { mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { imageFor, STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures');
const BASE = process.env.C19_BASE || 'http://127.0.0.1:5451';
const OUT = process.env.C19_SHOTS || '/private/tmp/claude-501/c19d-photos/shots';
mkdirSync(OUT, { recursive: true });
const HEIC = join(FIX, 'IMG_2901.HEIC');
const HEVC_MOV = join(FIX, 'IMG_2874.mov');
const LONG_MP4 = join(FIX, 'long_130s.mp4');
const SHORT_MOV = readFileSync(join(FIX, 'short_h264.mov'));
const JPEG_FIXTURE = join(FIX, 'IMG_9369.jpeg');

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const MAIN = { id: 70, external_user_id: 707, name: 'Christian Beckermann', email: 'chris@c19.test', role: '2', status: 1, is_activated: true, profile_color: '#1D4ED8' };
const img = (n) => `${BASE}/cd-img/${n}`;
const post = (id, n) => ({
  id, name: `Moment ${n}`, title: `Moment ${n}`, description: '', master_image_link: img(`post-${n}.jpg`), image_link: img(`post-${n}.jpg`), media_url: img(`post-${n}.jpg`),
  capture_date: `2026-10-1${n} 10:00:00`, uploaded_at: `2026-10-1${n} 10:00:00`, parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [],
});
const author = { id: 707, name: 'Christian Beckermann', avatar: null, profile_color: '#1D4ED8' };

/** Multipart body → [{ name, filename, type, data }]. */
function parseMultipart(buf, contentType) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType || '');
  if (!buf || !boundary) return [];
  const sep = Buffer.from(`--${boundary[1] || boundary[2]}`);
  const parts = [];
  let start = buf.indexOf(sep);
  while (start !== -1) {
    const next = buf.indexOf(sep, start + sep.length);
    if (next === -1) break;
    const chunk = buf.subarray(start + sep.length + 2, next - 2); // skip CRLF after boundary, CRLF before next
    const headEnd = chunk.indexOf('\r\n\r\n');
    if (headEnd !== -1) {
      const head = chunk.subarray(0, headEnd).toString('utf8');
      parts.push({
        name: /name="([^"]*)"/.exec(head)?.[1],
        filename: /filename="([^"]*)"/.exec(head)?.[1],
        type: /Content-Type:\s*([^\r\n]+)/i.exec(head)?.[1]?.trim(),
        data: chunk.subarray(headEnd + 4),
      });
    }
    start = next;
  }
  return parts;
}
const isJpeg = (b) => b && b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height, serverConvertsHeic = false, keepHandlePicker = false }) {
  const state = {
    cover: img('photo.jpg'), coverPuts: [], coverAnswer: null, metaUploads: [], momentPosts: [], inviteActions: [], inviteAnswer: null,
    invites: [103, 105], extraPosts: [],
  };
  const campaign = () => ({
    id: 901, title: 'Recipes', user_id: 707, published: 1, slug: 'recipes', category: { id: 1, name: 'Personal' }, sub_category: null,
    photos: { count: 3 + state.extraPosts.length }, collaborators: [], user: { id: 707, name: author.name }, author, created_at: '2026-10-01 10:00:00',
    location: 'Vancouver, BC', tags: [], min_uploaded_img_date: '2026-01-24', max_uploaded_img_date: '2026-01-24', last_update_img: state.cover,
  });
  const listCards = () => {
    const cards = [
      { ...campaign(), dates: { formatted_range: 'Jan 24/26' }, location: { formatted: 'Vancouver' }, photos: { count: 3, preview_images: [] } },
    ];
    for (const id of state.invites) {
      cards.unshift({
        id, title: id === 103 ? 'Remembering Addy' : 'Spring Fair', category: { id: 0, name: 'Invites', color: '#FF69B4' }, author,
        photos: { count: 4, preview_images: [] }, dates: { formatted_range: 'Jul 11 - Jul 22/26' }, location: { formatted: 'Barrie, Canada' },
        last_update_img: img(`invite-${id}.jpg`), collaborators: [], tags: [], published: 1, notification_id: id + 1000, invited_at: '2026-07-11 10:00:00',
      });
    }
    return cards;
  };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  context.setDefaultTimeout(30000);
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('c19-seeded')) return;
    sessionStorage.setItem('c19-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'main-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels');
  }, [MAIN]);
  // What the page hands to the network: every File in a FormData sent by XHR or fetch (CDP doesn't expose upload
  // bodies with files to the route handler), with its first bytes.
  await context.addInitScript(() => {
    window.__uploads = [];
    const record = (body, url) => {
      if (!(body instanceof FormData)) return;
      for (const [field, value] of body.entries()) {
        if (!(value instanceof File)) continue;
        const entry = { url: String(url), field, name: value.name, type: value.type, size: value.size, head: null };
        window.__uploads.push(entry);
        value.slice(0, 4).arrayBuffer().then((b) => { entry.head = [...new Uint8Array(b)]; }).catch(() => {});
      }
    };
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) { this.__url = url; return open.call(this, method, url, ...rest); };
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) { record(body, this.__url); return send.call(this, body); };
    const f = window.fetch;
    window.fetch = function (input, init) { record(init && init.body, typeof input === 'string' ? input : input && input.url); return f.apply(this, arguments); };
  });
  // The classic file input path (Safari / Firefox, and what Studio used before 19 Nov evening). Chrome's re-readable
  // picker is covered by chris-19nov-photos-pick.mjs.
  if (!keepHandlePicker) await context.addInitScript(() => { try { delete window.showOpenFilePicker; } catch { window.showOpenFilePicker = undefined; } });
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/cd-img/')) {
      const name = url.pathname.slice('/cd-img/'.length);
      if (name.endsWith('.mp4') || name.endsWith('.mov')) return route.fulfill({ contentType: 'video/mp4', body: SHORT_MOV });
      const { body, contentType } = await imageFor(name);
      return route.fulfill({ body, contentType });
    }
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const m = req.method();
    if (p === '/memories' && m === 'GET') {
      const all = listCards();
      const sideMem = (c) => ({ id: c.id, title: c.title, image_link: c.last_update_img, memory_images: [] });
      const categories = [
        { id: 1, name: 'Personal', memory_count: 1, admin_id: 3, memories: [sideMem(all[all.length - 1])] },
        ...(state.invites.length ? [{ id: 'invites', name: 'Invites', memory_count: state.invites.length, admin_id: null, is_virtual: true, memories: all.filter((c) => c.category.name === 'Invites').map(sideMem) }] : []),
      ];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length }, latest_memories: all, sidebar: { categories: { items: categories }, labels: { items: [] } } } } });
    }
    if (p === '/memories/901' && m === 'GET') {
      return route.fulfill({ json: { status: 'success', data: { memory: { ...campaign(), posts: [post(11, 1), post(12, 2), post(13, 3), ...state.extraPosts], linked_memories: [], widgets: [], unified_order: null } } } });
    }
    if (p === '/memories/105' && m === 'GET') {
      return route.fulfill({ json: { status: 'success', data: { memory: { ...campaign(), id: 105, title: 'Spring Fair', posts: [post(51, 1)], linked_memories: [], widgets: [], unified_order: null } } } });
    }
    // Edit Cover → Upload from Desktop: multipart POST with _method=PUT and last_update_img.
    if (p === '/memories/901' && m === 'POST') {
      const parts = parseMultipart(req.postDataBuffer(), req.headers()['content-type']);
      const file = parts.find((x) => x.name === 'last_update_img');
      state.coverPuts.push({ filename: file?.filename, type: file?.type, size: file?.data?.length ?? 0, jpeg: isJpeg(file?.data) });
      if (state.coverAnswer) return route.fulfill(state.coverAnswer);
      const ext = (file?.filename || '').split('.').pop().toLowerCase();
      state.cover = img(`cover-${state.coverPuts.length}.${ext === 'mov' ? 'mp4' : 'jpg'}`);
      return route.fulfill({ json: { success: true, message: 'Memory updated successfully.', data: campaign() } });
    }
    // Add a Moment: each picked photo goes to upload-image-with-metadata first.
    if (p === '/user/upload-image-with-metadata') {
      const parts = parseMultipart(req.postDataBuffer(), req.headers()['content-type']);
      const file = parts.find((x) => x.name === 'image');
      state.metaUploads.push({ filename: file?.filename, type: file?.type, jpeg: isJpeg(file?.data) });
      if (/\.hei[cf]$/i.test(file?.filename || '') && !serverConvertsHeic) {
        return route.fulfill({ status: 500, json: { success: false, message: 'Failed to process image: HEIC images are not supported on this server' } });
      }
      return route.fulfill({ json: { success: true, data: { fileUrl: img(`uploaded-${state.metaUploads.length}.jpg`), capture_date: serverConvertsHeic ? '2026-11-18' : '', capture_time: '', location: '', originalSizeMB: 0.01 } } });
    }
    if (p === '/memories/upload-photos-after-creation') {
      const parts = parseMultipart(req.postDataBuffer(), req.headers()['content-type']);
      const fileField = parts.find((x) => x.name === 'file');
      state.momentPosts.push({ file: fileField?.filename ? `(file ${fileField.filename})` : fileField?.data?.toString('utf8') });
      state.extraPosts.push({ ...post(20 + state.momentPosts.length, 4), title: 'IMG_2901', name: 'IMG_2901', image_link: img('uploaded-x.jpg') });
      return route.fulfill({ json: { success: true, status: true, message: 'Uploaded', data: [] } });
    }
    const inv = /^\/memories\/invitation\/action\/(\d+)$/.exec(p);
    if (inv && m === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      state.inviteActions.push({ id: Number(inv[1]), status: body.status, notification_id: body.notification_id });
      if (state.inviteAnswer) return route.fulfill(state.inviteAnswer);
      state.invites = state.invites.filter((id) => id !== Number(inv[1]));
      return route.fulfill({ json: { status: 1, message: body.status === 1 ? 'Invitation accepted successfully' : 'Invitation rejected successfully' } });
    }
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 1, name: 'Personal', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 1, memory_limit: 50 } } } });
    if (p === '/products/status' || p === '/website-catalogue') return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    if (p === '/lead-groups') return route.fulfill({ json: { groups: [] } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(`${width}: ${e.message}`));
  return { context, page, state };
}

const uploads = (page) => page.evaluate(() => window.__uploads.map((u) => ({ ...u, jpeg: !!u.head && u.head[0] === 0xff && u.head[1] === 0xd8 && u.head[2] === 0xff })));
async function waitText(page, re, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (re.test(await toastText(page)) || (await page.getByText(re).filter({ visible: true }).count()) > 0) return true;
    await page.waitForTimeout(150);
  }
  return false;
}
const shot = async (page, name, width) => { const path = `${OUT}/${width}-${name}.png`; await page.screenshot({ path }); console.log('  shot', path); };
const toastText = (page) => page.locator('[data-sonner-toast]').allInnerTexts().then((t) => t.join(' | '));
async function waitToast(page, re, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const t = await toastText(page);
    if (re.test(t)) return t;
    await page.waitForTimeout(200);
  }
  return toastText(page);
}

async function openCampaign(page) {
  await page.goto(`${BASE}/memories`);
  const card = page.getByRole('button', { name: 'View Recipes campaign details' }).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(800);
  await card.click();
  await page.getByText('Moment 1').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

/** What the visible cover shows: the img/video src (whichever is shown), plus whether Edit Cover and the title are there. */
async function coverState(page) {
  return page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 40 && r.height > 40 && s.visibility !== 'hidden' && s.display !== 'none'; };
    // A video cover is its own <video> (no data-cover-mode box); a photo / brand cover is the data-cover-mode box.
    const video = [...document.querySelectorAll('video')].find((v) => vis(v) && (v.getAttribute('src') || v.querySelector('source')));
    const box = [...document.querySelectorAll('[data-cover-mode]')].find(vis);
    const media = video || (box ? box.querySelector('img:not([aria-hidden="true"])') : null);
    const editCover = [...document.querySelectorAll('button, label')].some((el) => /Edit Cover/.test(el.textContent || '') && el.getBoundingClientRect().width > 0);
    return { src: media ? (media.getAttribute('src') || media.querySelector?.('source')?.getAttribute('src')) : null, tag: media?.tagName || null, editCover };
  });
}

/** Edit Cover → Upload from Desktop (desktop menu) / the Edit Cover label (phones), then pick `file`. Returns the chooser's accept. */
async function pickCover(page, width, file) {
  const chooserP = page.waitForEvent('filechooser', { timeout: 15000 });
  if (width >= 768) {
    await page.getByRole('button', { name: /Edit Cover/ }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: /Upload from Desktop/ }).filter({ visible: true }).first().click();
  } else {
    await page.locator('label').filter({ hasText: 'Edit Cover' }).filter({ visible: true }).first().click();
  }
  const chooser = await chooserP;
  const accept = await chooser.element().evaluate((el) => el.getAttribute('accept') || '');
  await chooser.setFiles(file);
  return accept;
}


/** Chrome's re-readable picker, stubbed like a Mac Photos pick: the first `bad` copies can't be read (the file changed
 *  after the pick), then a readable JPEG `IMG_9369.jpeg`. Records how often the picker / getFile were called. */
async function stubPhotosPicker(page, { bad = 2, cancel = false, neverReadable = false } = {}) {
  const jpeg = [...readFileSync(JPEG_FIXTURE)];
  await page.evaluate(([bytes, bad, cancel, neverReadable]) => {
    window.__picker = { opened: 0, getFile: 0, options: null };
    const good = () => new File([new Uint8Array(bytes)], 'IMG_9369.jpeg', { type: 'image/jpeg', lastModified: Date.now() });
    const broken = () => {
      const f = new File([new Uint8Array([1, 2, 3])], 'IMG_9369.jpeg', { type: 'image/jpeg', lastModified: Date.now() });
      const fail = () => Promise.reject(new DOMException('The requested file could not be read', 'NotReadableError'));
      Object.defineProperty(f, 'arrayBuffer', { value: fail });
      return f;
    };
    window.showOpenFilePicker = async (options) => {
      window.__picker.opened++;
      window.__picker.options = options;
      if (cancel) throw new DOMException('The user aborted a request.', 'AbortError');
      return [{ kind: 'file', name: 'IMG_9369.jpeg', getFile: async () => (++window.__picker.getFile <= bad || neverReadable ? broken() : good()) }];
    };
  }, [jpeg, bad, cancel, neverReadable]);
}

async function clickUploadFromDesktop(page) {
  await page.getByRole('button', { name: /Edit Cover/ }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: /Upload from Desktop/ }).filter({ visible: true }).first().click();
}

async function photosCoverFlow() {
  const width = 1280;
  console.log(`-- ${width}px: Edit Cover → Upload from Desktop → Mac Photos pick (Chrome picker)`);
  const { page, context, state } = await open({ width, height: 900, keepHandlePicker: true });
  await openCampaign(page);
  const before = await coverState(page);
  expect(before.src === img('photo.jpg') && before.editCover, `${width}: the campaign shows its cover + Edit Cover (${before.src})`);

  // 1. A Photos pick whose first two copies can't be read (still being written) → read again → uploaded → cover shows.
  await stubPhotosPicker(page, { bad: 2 });
  let fileChooser = false;
  page.once('filechooser', () => { fileChooser = true; });
  await clickUploadFromDesktop(page);
  const okToast = await waitToast(page, /Cover photo updated|Failed|couldn't/);
  const pick = await page.evaluate(() => window.__picker);
  expect(pick.opened === 1 && !fileChooser, `${width}: Chrome's re-readable picker opens (not the old file input) (opened ${pick.opened}, filechooser ${fileChooser})`);
  const accept = JSON.stringify(pick.options?.types?.[0]?.accept || {});
  expect(/\.heic/.test(accept) && /\.jpe?g/.test(accept) && /\.mov/.test(accept), `${width}: … offering photos incl. HEIC and videos incl. .mov (${accept})`);
  expect(pick.getFile >= 3, `${width}: the unreadable copies are read again until one reads (getFile ×${pick.getFile})`);
  const put = (await uploads(page)).filter((u) => u.field === 'last_update_img')[0];
  expect(state.coverPuts.length === 1 && put && put.name === 'IMG_9369.jpeg' && put.type === 'image/jpeg' && put.jpeg && put.size > 1000,
    `${width}: the photo itself is sent (JPEG bytes) (${JSON.stringify(put)} / server got ${JSON.stringify(state.coverPuts[0])})`);
  expect(state.coverPuts[0]?.jpeg && state.coverPuts[0]?.size > 1000, `${width}: … and the web API receives the whole JPEG (${state.coverPuts[0]?.size} bytes)`);
  expect(/Cover photo updated successfully/.test(okToast) && !/Failed to upload cover photo/.test(okToast), `${width}: "Cover photo updated successfully!" (${okToast})`);
  await page.waitForTimeout(1500);
  const after = await coverState(page);
  expect(after.src === state.cover && after.editCover, `${width}: the new photo is the cover, Edit Cover still there (${after.src})`);
  await shot(page, '01-photos-pick-cover-done', width);

  // 2. Reload: still the new cover.
  await page.reload(); // the in-app router lands on the campaigns list after a reload: open the campaign again
  await openCampaign(page);
  const reloaded = await coverState(page);
  expect(reloaded.src === state.cover, `${width}: after a reload the new cover is still shown (${reloaded.src})`);

  // 3. Cancel in the picker → nothing happens (no toast, no upload).
  await page.waitForTimeout(4500);
  await stubPhotosPicker(page, { cancel: true });
  await clickUploadFromDesktop(page);
  await page.waitForTimeout(1200);
  expect(state.coverPuts.length === 1 && !/Failed|couldn't/.test(await toastText(page)), `${width}: Cancel in the picker does nothing`);

  // 4. A pick that never becomes readable → a clear message, nothing sent, cover unchanged.
  const coverBefore = await coverState(page);
  await stubPhotosPicker(page, { neverReadable: true });
  await clickUploadFromDesktop(page);
  const badToast = await waitToast(page, /couldn't be read|Failed/, 20000);
  expect(/This photo couldn't be read\. Please pick it again\./.test(badToast), `${width}: an unreadable pick says so ("${badToast}")`);
  expect(state.coverPuts.length === 1, `${width}: … nothing is sent`);
  expect(JSON.stringify(await coverState(page)) === JSON.stringify(coverBefore), `${width}: … the cover is unchanged`);
  await shot(page, '02-photos-pick-unreadable', width);
  await context.close();
}

/** Without the Chrome picker (Safari / Firefox / phone): the file input as before, the pick read into memory first. */
async function classicCoverFlow(width, height) {
  console.log(`-- ${width}px: Edit Cover → classic file input (no showOpenFilePicker)`);
  const { page, context, state } = await open({ width, height });
  await openCampaign(page);
  await pickCover(page, width, JPEG_FIXTURE);
  const t = await waitToast(page, /Cover photo updated|Failed|couldn't/);
  expect(/Cover photo updated successfully/.test(t) && state.coverPuts.length === 1 && state.coverPuts[0].jpeg, `${width}: a JPEG picked with the file input uploads (${t})`);
  await page.waitForTimeout(1500);
  expect((await coverState(page)).src === state.cover, `${width}: … and is the cover`);
  await shot(page, '03-classic-cover', width);
  await context.close();
}

/** Add a Moment → Choose Files → Upload from Desktop → a Mac Photos pick whose first copies can't be read (1280). */
async function photosAddMomentFlow() {
  const width = 1280;
  console.log(`-- ${width}px: Add a Moment → Choose Files → Upload from Desktop → Mac Photos pick (Chrome picker)`);
  const { page, context, state } = await open({ width, height: 900, keepHandlePicker: true });
  await openCampaign(page);
  await page.getByRole('button', { name: /Add a Moment/ }).filter({ visible: true }).first().click();
  await page.getByRole('heading', { name: 'Add a Moment' }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(600);
  await stubPhotosPicker(page, { bad: 1 });
  let fileChooser = false;
  page.once('filechooser', () => { fileChooser = true; });
  await page.getByRole('button', { name: /Choose Files/ }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: /Upload from Desktop/ }).filter({ visible: true }).first().click();
  const thumb = page.locator('img[alt="Preview 1"]').filter({ visible: true }).first();
  await thumb.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  const pick = await page.evaluate(() => window.__picker);
  expect(pick.opened === 1 && !fileChooser && pick.options?.multiple === true, `${width}: Chrome's re-readable picker opens, several photos allowed (opened ${pick.opened}, multiple ${pick.options?.multiple})`);
  expect(pick.getFile >= 2, `${width}: the unreadable copy is read again (getFile ×${pick.getFile})`);
  const ups = (await uploads(page)).filter((u) => u.field === 'image');
  expect(state.metaUploads.length === 1 && state.metaUploads[0].jpeg && ups[0]?.name === 'IMG_9369.jpeg' && ups[0]?.size > 1000,
    `${width}: the photo is uploaded (JPEG) (${JSON.stringify(state.metaUploads)} / ${JSON.stringify(ups.map((u) => ({ n: u.name, s: u.size })))})`);
  expect(await thumb.isVisible(), `${width}: its thumbnail shows in Add a Moment`);
  await shot(page, '04-add-moment-photos-pick', width);
  await page.getByRole('button', { name: /^Add/ }).filter({ visible: true }).last().click().catch(() => {});
  await page.waitForTimeout(2500);
  expect(state.momentPosts.length === 1, `${width}: Add sends the moment (${JSON.stringify(state.momentPosts)})`);
  await context.close();
}

/** The installed Studio app (display-mode: standalone): Edit Cover opens the plain file window, the pick uploads.
 *  Then a pick that can't be read (Chrome tab) shows "Pick again", which opens the plain file window and uploads. */
async function installedAppAndPickAgainFlow() {
  const width = 1280;
  console.log(`-- ${width}px: installed Studio app → plain file window; "Pick again" after an unreadable pick`);
  const { page, context, state } = await open({ width, height: 900, keepHandlePicker: true });
  await openCampaign(page);
  // Installed app: display-mode standalone.
  await page.evaluate(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q) => (q === '(display-mode: standalone)' ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q));
  });
  await stubPhotosPicker(page, { bad: 0 });
  const accept = await pickCover(page, width, JPEG_FIXTURE);
  const t1 = await waitToast(page, /Cover photo updated|Failed|couldn't/);
  const opened = await page.evaluate(() => window.__picker.opened);
  expect(opened === 0 && /\.heic/.test(accept), `${width}: installed app → the plain file window (re-readable picker opened ${opened}×, accept ${accept})`);
  expect(/Cover photo updated successfully/.test(t1) && state.coverPuts.length === 1 && state.coverPuts[0].jpeg, `${width}: … and the photo uploads (${t1})`);
  await page.waitForTimeout(4500);

  // Back to a Chrome tab: a pick that never reads → "Pick again" → plain file window → uploads.
  await page.reload();
  await openCampaign(page);
  await stubPhotosPicker(page, { neverReadable: true });
  await clickUploadFromDesktop(page);
  const t2 = await waitToast(page, /couldn't be read/, 20000);
  expect(/This photo couldn't be read\. Please pick it again\./.test(t2), `${width}: unreadable pick → message (${t2})`);
  const again = page.getByRole('button', { name: 'Pick again' }).filter({ visible: true }).first();
  expect(await again.isVisible(), `${width}: … with a "Pick again" button`);
  await shot(page, '05-pick-again', width);
  const chooserP = page.waitForEvent('filechooser', { timeout: 15000 });
  await again.click();
  const chooser = await chooserP;
  await chooser.setFiles(JPEG_FIXTURE);
  const t3 = await waitToast(page, /Cover photo updated/, 15000);
  expect(/Cover photo updated successfully/.test(t3) && state.coverPuts.length === 2, `${width}: "Pick again" opens the plain file window and the photo uploads (${t3})`);
  await page.waitForTimeout(1500);
  expect((await coverState(page)).src === state.cover, `${width}: … and is the cover`);
  await context.close();
}

try {
  await installedAppAndPickAgainFlow();
  await photosCoverFlow();
  await photosAddMomentFlow();
  await classicCoverFlow(1280, 900);
  await classicCoverFlow(390, 844);
} catch (e) {
  failures.push(String((e && e.stack) || e));
  console.log(e);
}
await browser.close();
const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
console.log('page errors:', relevant.length, relevant.slice(0, 5));
console.log(failures.length ? `FAILURES ${failures.length}:\n` + failures.join('\n') : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
