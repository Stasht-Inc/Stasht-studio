// Chris 19 Nov 2026 — uploads + invites (mocked API, real Chrome, 1280 + 390), click by click as in his videos:
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
const OUT = process.env.C19_SHOTS || '/private/tmp/claude-501/c19-uploads/shots';
mkdirSync(OUT, { recursive: true });
const HEIC = join(FIX, 'IMG_2901.HEIC');
const HEVC_MOV = join(FIX, 'IMG_2874.mov');
const LONG_MP4 = join(FIX, 'long_130s.mp4');
const SHORT_MOV = readFileSync(join(FIX, 'short_h264.mov'));

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

async function coverFlow(width, height) {
  console.log(`-- ${width}px: Edit Cover`);
  const { page, context, state } = await open({ width, height });
  await openCampaign(page);
  const before = await coverState(page);
  expect(before.src === img('photo.jpg') && before.editCover, `${width}: the campaign page shows its photo cover + Edit Cover (${before.src})`);
  await shot(page, '01-cover-before', width);

  // 7a: the iPhone HEVC .mov (Chrome can't read its length).
  const accept = await pickCover(page, width, HEVC_MOV);
  expect(/\.mov|video\/quicktime/.test(accept) && /\.heic|image\/heic/.test(accept), `${width}: the cover picker offers .mov and HEIC (${accept})`);
  const movToast = await waitToast(page, /Cover video updated|Failed|Unable/);
  expect(!/Unable to validate video duration/.test(movToast), `${width}: no "Unable to validate video duration" (${movToast})`);
  const movPut = (await uploads(page)).filter((u) => u.field === 'last_update_img')[0];
  expect(state.coverPuts.length === 1 && movPut && movPut.name === 'IMG_2874.mov' && movPut.type === 'video/quicktime' && movPut.size > 10000,
    `${width}: the .mov itself is uploaded, as video/quicktime (${JSON.stringify(movPut)})`);
  expect(/Cover video updated successfully/.test(movToast), `${width}: "Cover video updated successfully!"`);
  await page.waitForTimeout(1500);
  const afterMov = await coverState(page);
  expect((afterMov.src || '').split('#')[0] === state.cover && afterMov.tag === 'VIDEO', `${width}: the new video is the cover (${afterMov.tag} ${afterMov.src})`);
  await shot(page, '02-cover-mov-done', width);

  // 7a: a 130 s video is refused in the browser — nothing uploaded, cover unchanged.
  const puts = state.coverPuts.length;
  const coverBeforeLong = await coverState(page);
  await page.waitForTimeout(4500); // the success toast goes
  await pickCover(page, width, LONG_MP4);
  const longToast = await waitToast(page, /too long/);
  expect(/Video is too long \(2m 10s\)\. Maximum duration is 2 minutes\./.test(longToast), `${width}: a 130 s video is refused ("${longToast}")`);
  expect(state.coverPuts.length === puts, `${width}: … and nothing is uploaded`);
  expect(JSON.stringify(await coverState(page)) === JSON.stringify(coverBeforeLong), `${width}: … and the cover is unchanged`);

  // 7b: the web API refuses (its ffprobe says too long) → the cover stays exactly as it was, also after a reload.
  await page.waitForTimeout(4500);
  state.coverAnswer = { status: 422, json: { message: 'Video is too long (2m 30s). Maximum duration is 2 minutes.', errors: { last_update_img: ['Video is too long (2m 30s). Maximum duration is 2 minutes.'] } } };
  const coverBeforeRefusal = await coverState(page);
  await pickCover(page, width, HEVC_MOV);
  const refusedToast = await waitToast(page, /too long|Failed/);
  expect(/Video is too long \(2m 30s\)/.test(refusedToast), `${width}: the web API's refusal is shown ("${refusedToast}")`);
  await page.waitForTimeout(800);
  const afterRefusal = await coverState(page);
  expect(JSON.stringify(afterRefusal) === JSON.stringify(coverBeforeRefusal), `${width}: a refused upload leaves the cover as it was (${JSON.stringify(afterRefusal)})`);
  await shot(page, '03-cover-refused-unchanged', width);
  await openCampaign(page); // a fresh load of the page, then the campaign again
  const afterReload = await coverState(page);
  expect(afterReload.src === coverBeforeRefusal.src, `${width}: … and after a reload (${afterReload.src})`);
  state.coverAnswer = null;

  // 8: a HEIC photo goes up as a JPEG and becomes the cover.
  await page.waitForTimeout(4500);
  const n = state.coverPuts.length;
  await pickCover(page, width, HEIC);
  const heicToast = await waitToast(page, /Cover photo updated|Failed|couldn't/, 30000);
  const heicPut = (await uploads(page)).filter((u) => u.field === 'last_update_img').pop();
  expect(state.coverPuts.length === n + 1 && heicPut && heicPut.type === 'image/jpeg' && heicPut.name === 'IMG_2901.jpg' && heicPut.jpeg && heicPut.size > 1000,
    `${width}: the HEIC is uploaded as a JPEG (${JSON.stringify(heicPut)})`);
  expect(/Cover photo updated successfully/.test(heicToast), `${width}: "Cover photo updated successfully!" (${heicToast})`);
  await page.waitForTimeout(1500);
  const afterHeic = await coverState(page);
  expect(afterHeic.src === state.cover && afterHeic.tag === 'IMG', `${width}: the converted photo is the cover (${afterHeic.src})`);
  await shot(page, '04-cover-heic-done', width);
  await context.close();
}

async function addMomentFlow(width, height) {
  const serverConvertsHeic = width < 768;
  console.log(`-- ${width}px: Add a Moment with a HEIC (server ${serverConvertsHeic ? 'converts HEIC' : 'has no HEIC support'})`);
  const { page, context, state } = await open({ width, height, serverConvertsHeic });
  await openCampaign(page);
  if (width >= 768) {
    await page.getByRole('button', { name: /Add a Moment/ }).filter({ visible: true }).first().click();
  } else {
    const plus = page.locator('[data-testid="phone-add-plus"] button:has(path[d="M12 5v14M5 12h14"])').filter({ visible: true }).last();
    await plus.scrollIntoViewIfNeeded();
    await plus.click();
    await page.waitForTimeout(300);
    await page.locator('button').filter({ hasText: /^Moment/ }).filter({ visible: true }).first().click();
  }
  await page.getByRole('heading', { name: 'Add a Moment' }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(600);
  const chooserP = page.waitForEvent('filechooser', { timeout: 15000 });
  if (width >= 768) {
    await page.getByRole('button', { name: /Choose Files/ }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: /Upload from Desktop/ }).filter({ visible: true }).first().click();
  } else {
    await page.locator('label[for="file-upload"]').filter({ visible: true }).first().click();
  }
  const chooser = await chooserP;
  const accept = await chooser.element().evaluate((el) => el.getAttribute('accept') || '');
  expect(/\.heic|image\/heic|image\/\*/.test(accept), `${width}: Add a Moment's picker takes HEIC (${accept})`);
  if (width >= 768) expect(/\.heic/.test(accept), `${width}: … named explicitly on a computer (macOS greys out unnamed types)`);
  await chooser.setFiles(HEIC);
  const thumb = page.locator('img[alt="Preview 1"]').filter({ visible: true }).first();
  await thumb.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(500);
  const ups = (await uploads(page)).filter((u) => u.field === 'image').map((u) => ({ filename: u.name, type: u.type, jpeg: u.jpeg, size: u.size }));
  expect(ups.length === state.metaUploads.length, `${width}: every upload reached the API (${ups.length} / ${state.metaUploads.length})`);
  if (serverConvertsHeic) {
    expect(ups.length === 1 && ups[0].filename === 'IMG_2901.HEIC', `${width}: the server converts HEIC → sent once, as it is (${JSON.stringify(ups)})`);
  } else {
    expect(ups.length === 2 && ups[0].filename === 'IMG_2901.HEIC' && ups[1].type === 'image/jpeg' && ups[1].filename === 'IMG_2901.jpg' && ups[1].jpeg,
      `${width}: refused as HEIC → retried as a JPEG (${JSON.stringify(ups)})`);
  }
  const thumbSrc = await thumb.getAttribute('src').catch(() => null);
  expect(thumbSrc === img(`uploaded-${ups.length}.jpg`), `${width}: the thumbnail shows the uploaded photo (${thumbSrc})`);
  await shot(page, '05-add-moment-heic', width);
  const addAll = page.getByRole('button', { name: /^Add/ }).filter({ hasText: /Add all|Add Moment|^Add$/ }).filter({ visible: true }).last();
  await addAll.click();
  await page.waitForTimeout(2500);
  expect(state.momentPosts.length === 1 && state.momentPosts[0].file === img(`uploaded-${ups.length}.jpg`), `${width}: Add sends the uploaded photo's URL (${JSON.stringify(state.momentPosts)})`);
  await shot(page, '06-add-moment-added', width);
  await context.close();
}

async function inviteFlow(width, height) {
  console.log(`-- ${width}px: invite Accept / Deny`);
  const { page, context, state } = await open({ width, height });
  await page.goto(`${BASE}/memories`);
  const addy = page.locator('[aria-label="Remembering Addy campaign invitation"]').filter({ visible: true }).first();
  await addy.waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(1200);
  const deny = addy.getByRole('button', { name: 'Decline invitation' });
  const acceptBtn = addy.getByRole('button', { name: 'Accept invitation' });
  // One button row: nothing else on top of the photo there.
  const others = await addy.evaluate((card) => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none' && el.offsetParent !== null; };
    return {
      publicBadge: [...card.querySelectorAll('div')].some((d) => vis(d) && /^(Public|Private|View Only)$/.test((d.textContent || '').trim())),
      invitesPill: [...card.querySelectorAll('*')].some((d) => vis(d) && d.children.length === 0 && (d.textContent || '').trim() === 'Invites'),
    };
  });
  expect(!others.publicBadge, `${width}: no Public/Private badge behind Accept / Deny`);
  expect(!others.invitesPill, `${width}: no pink "Invites" pill behind Accept / Deny`);
  const box = await deny.boundingBox();
  const cardBox = await addy.boundingBox();
  const aBox = await acceptBtn.boundingBox();
  expect(aBox.x >= cardBox.x - 1 && box.x + box.width <= cardBox.x + cardBox.width + 1, `${width}: Accept / Deny stay inside their card (${Math.round(aBox.x)}–${Math.round(box.x + box.width)} in ${Math.round(cardBox.x)}–${Math.round(cardBox.x + cardBox.width)})`);
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label') || null, [box.x + box.width / 2, box.y + box.height / 2]);
  expect(hit === 'Decline invitation', `${width}: the topmost thing at Deny's centre is Deny (${hit})`);
  await shot(page, '07-invite-card', width);

  // A refused Deny says so and keeps the card.
  state.inviteAnswer = { status: 500, json: { status: 0, message: 'Something went wrong' } };
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const refusedShown = await waitText(page, /Something went wrong|could not be denied/);
  expect(state.inviteActions.length === 1 && state.inviteActions[0].status === 0, `${width}: Deny sends status 0 (${JSON.stringify(state.inviteActions)})`);
  expect(refusedShown, `${width}: a refused Deny says so`);
  expect(await addy.isVisible(), `${width}: … and the card stays`);
  state.inviteAnswer = null;
  await page.waitForTimeout(3500);

  // Deny for real: the card goes.
  const box2 = await deny.boundingBox();
  await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await page.waitForTimeout(2000);
  expect(state.inviteActions.length === 2 && state.inviteActions[1].status === 0 && state.inviteActions[1].id === 103 && state.inviteActions[1].notification_id === '1103',
    `${width}: Deny → POST invitation/action/103 {status: 0, notification_id} (${JSON.stringify(state.inviteActions[1])})`);
  expect(await page.locator('[aria-label="Remembering Addy campaign invitation"]').filter({ visible: true }).count() === 0, `${width}: the denied invite's card is gone`);
  await shot(page, '08-invite-denied', width);
  await page.reload();
  await page.locator('[aria-label="Spring Fair campaign invitation"]').filter({ visible: true }).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(1000);
  expect(await page.locator('[aria-label="Remembering Addy campaign invitation"]').filter({ visible: true }).count() === 0, `${width}: … still gone after a reload`);

  // Accept still works: status 1, opens the campaign.
  const fair = page.locator('[aria-label="Spring Fair campaign invitation"]').filter({ visible: true }).first();
  const abox = await fair.getByRole('button', { name: 'Accept invitation' }).boundingBox();
  await page.mouse.click(abox.x + abox.width / 2, abox.y + abox.height / 2);
  await page.waitForTimeout(2500);
  expect(state.inviteActions.length === 3 && state.inviteActions[2].status === 1 && state.inviteActions[2].id === 105, `${width}: Accept → status 1 (${JSON.stringify(state.inviteActions[2])})`);
  expect(/\/memories\/105|memory/i.test(page.url()) || (await page.getByText('Moment 1').count()) > 0, `${width}: Accept opens the campaign (${page.url()})`);
  await shot(page, '09-invite-accepted', width);
  await context.close();
}

try {
  for (const [w, h] of [[1280, 900], [390, 844]]) {
    await inviteFlow(w, h);
    await coverFlow(w, h);
    await addMomentFlow(w, h);
  }
} catch (e) {
  failures.push(String((e && e.stack) || e));
  console.log(e);
}
await browser.close();
const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
console.log('page errors:', relevant.length, relevant.slice(0, 5));
console.log(failures.length ? `FAILURES ${failures.length}:\n` + failures.join('\n') : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
