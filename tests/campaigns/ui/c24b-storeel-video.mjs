// tests/campaigns/ui/c24b-storeel-video.mjs — Deepak 24 Nov 2026 (P5): "+" → Video. In the real app at 1280 and 390
// (every API call answered here, every non-local request aborted: nothing leaves this machine).
//  1280 Create: Add a Moment → a photo → the preview's "+" at the top → Video → Upload video (a real 40 s MP4) → it
//   uploads (memories/upload-video purpose=moment) → "Only the first 30 seconds will be used." → description → Add Video
//   → the preview shows it first, with a play mark (nothing else sent) → its ⋮ → Edit → the same editor, filled → Save
//   Changes → Save as Draft → POST /memories carries the video as a moment (its URL, description), after the upload.
//  390 Create (no preview): the Moments card's Add a Moment → Video → Record video → the recorder counts down from 30
//   (fake camera) → stop → it uploads → Add Video → listed in step 2 → Save as Draft sends it.
//  1280 campaign page: the "+" under a moment → Video → upload → note → Add Video → POST upload-photos-after-creation
//   with the video's URL, after that moment (saved at once, like Add a Moment).
//  390 campaign page: the phone "+" menu offers Video → its editor opens.
//  Intro Video unchanged: Create's Add Intro Video uploads with no purpose (the 2-minute intro, not cut to 30 s).
//  Published page: the video moment shows its first frame and a play mark; tapping it plays the video.
// node tests/campaigns/ui/c24b-storeel-video.mjs  (C24BV_BASE = dev server, default http://127.0.0.1:5195; C24BV_SHOTS)
import { mkdirSync, readFileSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.C24BV_BASE || 'http://127.0.0.1:5195';
const OUT = process.env.C24BV_SHOTS || '/Users/deepaksharma/Pictures/Personal-Works/Stasht-Project/handoff-20261114/c24b-storeel-video-shots';
mkdirSync(OUT, { recursive: true });
const VIDEO_40S = readFileSync(new URL('./fixtures/storeel_40s.mp4', import.meta.url));

const LOGO = `${BASE}/cd-img/logo.png`;
const MAIN = { id: 70, external_user_id: 707, name: 'TheBodyPolitik', email: 'owner@bodypolitik.test', role: '2', status: 1, is_activated: true, profile_color: '#4A6B50', avatar: LOGO, profile_image: LOGO };
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#4A6B50"/><text x="40" y="230" font-size="70" fill="#F3EDE4" font-family="Georgia">TBP</text></svg>`;
const photoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#E8A27C"/><circle cx="300" cy="200" r="90" fill="#fff"/></svg>`;
const img = (n) => `${BASE}/cd-img/${n}.jpg`;
const VIDEO_URL = `${BASE}/cd-vid/Showroom_tour_1732_abc.mp4`;
const JPEG = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex');

const NEW_ID = 970;
const POST_ID = 5001;
const VIDEO_POST_ID = 5002;
const user = { id: 707, name: 'TheBodyPolitik', profile_image: LOGO, profile_color: '#4A6B50' };
const NEW_CAMPAIGN = {
  id: NEW_ID, title: 'Spring Open House', user_id: 707, published: 0, slug: 'spring-open-house', category: { id: 5, name: 'Campaigns' }, sub_category: null,
  photos: { count: 1 }, posts_count: 1, collaborators: [], user,
  created_at: '2026-11-24 10:00:00', location: '', tags: [], min_uploaded_img_date: '2026-11-24', max_uploaded_img_date: '2026-11-24', last_update_img: null, is_owner: true,
};
const post = (id, link, description, over = {}) => ({
  id, name: 'IMG_1.jpg', title: '', description, master_image_link: link, image_link: link, media_url: link, type: 'image',
  location: '', capture_date: '2026-11-24 10:00:00', uploaded_at: '2026-11-24 10:00:00', parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [], user, ...over,
});
const POST = post(POST_ID, img('uploaded'), 'Our new kitchen');
const VIDEO_POST = post(VIDEO_POST_ID, VIDEO_URL, 'Walk through the showroom', { name: 'Showroom_tour', title: 'Showroom tour', after_post_id: POST_ID });

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });

/** multipart body → { field: value } for the text fields, and the file names. */
function parts(req) {
  const buf = req.postDataBuffer();
  if (!buf) return {};
  const text = buf.toString('latin1');
  const out = {};
  for (const m of text.matchAll(/name="([^"]+)"(?:; filename="([^"]*)")?\r\n(?:Content-Type: [^\r]+\r\n)?\r\n([\s\S]*?)\r\n--/g)) {
    out[m[1]] = m[2] !== undefined ? { filename: m[2], bytes: m[3].length } : m[3];
  }
  return out;
}

async function open({ width, height, path = '/memories', created = false, withVideo = false }) {
  const state = { log: [], created, videoUploads: [], momentUploads: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024, permissions: ['camera', 'microphone'] });
  await context.addInitScript(([u]) => {
    try { if (window.top !== window || sessionStorage.getItem('cd-seeded')) return; } catch { return; }
    sessionStorage.setItem('cd-seeded', '1');
    if (location.pathname.startsWith('/published-memory')) return; // a visitor
    localStorage.clear();
    localStorage.setItem('stasht_token', 'main-token');
    localStorage.setItem('stasht_user', JSON.stringify(u));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels');
  }, [MAIN]);
  const detail = () => {
    const posts = withVideo || state.videoSaved ? [POST, VIDEO_POST] : [POST];
    return { ...NEW_CAMPAIGN, posts, linked_memories: [], unified_order: posts.map((x) => ({ id: x.id, type: 'post' })) };
  };
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      return route.abort('blockedbyclient');
    }
    if (url.pathname === '/cd-img/logo.png') return route.fulfill({ contentType: 'image/svg+xml', body: logoSvg });
    if (url.pathname.startsWith('/cd-img/')) return route.fulfill({ contentType: 'image/svg+xml', body: photoSvg });
    if (url.pathname.startsWith('/cd-vid/')) return route.fulfill({ contentType: 'video/mp4', body: VIDEO_40S });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const m = req.method();
    let body = null;
    try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch { body = null; }
    if (p === '/memories' && m === 'GET') {
      const all = state.created ? [NEW_CAMPAIGN] : [];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length, pagination: { current_page: 1, last_page: 1 } }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Campaigns', memory_count: all.length }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories' && m === 'POST') {
      state.log.push({ what: 'create', body });
      state.created = true;
      return route.fulfill({ json: { success: true, data: { id: NEW_ID, title: body?.title, slug: 'spring-open-house', category_id: body?.category_id } } });
    }
    if (p === '/memories/upload-video' && m === 'POST') {
      const f = parts(req);
      state.videoUploads.push(f);
      state.log.push({ what: 'upload-video', body: f });
      await new Promise((r) => setTimeout(r, 400));
      return route.fulfill({ json: { success: true, fileUrl: f.purpose === 'moment' ? VIDEO_URL : `${BASE}/cd-vid/intro.mp4`, originalSizeMB: 0.1, compressedSizeMB: 0.08, trimmed: f.purpose === 'moment', cut: 'cut_copy', cutTo: 30 } });
    }
    if (p === '/memories/upload-photos-after-creation' && m === 'POST') {
      const f = parts(req);
      state.momentUploads.push(f);
      state.log.push({ what: 'moment', body: f });
      state.videoSaved = true;
      return route.fulfill({ json: { status: 1, message: 'Success.', data: [{ image: { ...VIDEO_POST, admin_approval: 1 } }] } });
    }
    if (p === '/user/upload-image-with-metadata' && m === 'POST') {
      return route.fulfill({ json: { success: true, data: { fileUrl: img('uploaded'), originalSizeMB: 0.2, capture_date: '2026-11-24' } } });
    }
    if (p === `/memories/${NEW_ID}` && m === 'GET') { const d = detail(); return route.fulfill({ json: { status: 'success', data: { memory: d, linked_memories: [], unified_order: d.unified_order } } }); }
    if (p === `/memories/${NEW_ID}` && m === 'PUT') return route.fulfill({ json: { success: true, data: NEW_CAMPAIGN } });
    if (p === `/memories/${NEW_ID}/widgets` && m === 'GET') return route.fulfill({ json: { success: true, data: [] } });
    if (p === '/published-memories') return route.fulfill({ json: { success: true, data: { memory: { ...detail(), published: 1, widgets: [] }, order_by: 'asc' } } });
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 5, name: 'Campaigns', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/products/status') return route.fulfill({ json: { success: true, data: { pilot: true, available: true, reason: null, can_create: true, counts: { total: 0, manual: 0, website: 0 }, default_currency: 'CAD' } } });
    if (p === '/products' && m === 'GET') return route.fulfill({ json: { success: true, data: { items: [], pagination: { current_page: 1, per_page: 200, total: 0, last_page: 1 } } } });
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: false, reason: 'not_available', item_count: 0 } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 1, memory_limit: 50 } } } });
    if (p === '/lead-groups') return route.fulfill({ json: { groups: [] } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('popup', (pp) => pp.close().catch(() => {}));
  await page.goto(`${BASE}${path}`);
  return { context, page, state };
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const visible = (loc) => loc.filter({ visible: true }).first();

async function startCreate(page) {
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /^Create( a Campaign)?$/ }).filter({ visible: true }).last().click();
  const create = page.getByRole('dialog', { name: 'Create Campaign' });
  await create.getByPlaceholder('Give your campaign a meaningful title').waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  await create.getByPlaceholder('Give your campaign a meaningful title').fill('Spring Open House');
  await create.locator('#st-step-campaign').getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Campaigns' }).click();
  await page.waitForTimeout(400);
  return create;
}
async function cardPick(page, create, kind) {
  await create.getByTestId('storeel-moments-add').scrollIntoViewIfNeeded();
  await create.getByTestId('storeel-moments-add').click();
  await visible(page.locator(`[data-testid="add-widget-chooser"] [data-widget-kind="${kind}"]`)).click();
  await page.waitForTimeout(500);
}
async function previewPick(page, label, kind) {
  const plus = page.getByTestId('storeel-preview-add').and(page.getByLabel(label));
  await plus.scrollIntoViewIfNeeded();
  await plus.click();
  await visible(page.locator(`[data-testid="add-widget-chooser"] [data-widget-kind="${kind}"]`)).click();
  await page.waitForTimeout(500);
}
async function addPhoto(page, create) {
  await cardPick(page, create, 'moment');
  await page.getByRole('heading', { name: 'Add a Moment' }).waitFor({ timeout: 10000 });
  await page.locator('#file-upload').setInputFiles({ name: 'IMG_1.jpg', mimeType: 'image/jpeg', buffer: JPEG });
  await page.waitForTimeout(1500);
  await visible(page.getByPlaceholder('Describe this moment in detail...')).fill('Our new kitchen');
  await visible(page.getByRole('button', { name: /^Add all \(1\)/ })).click();
  await page.waitForTimeout(1200);
}
const videoDialog = (page) => page.getByTestId('video-moment-dialog');

/** In the open Video editor: upload the 40 s video and check the note. */
async function uploadInDialog(page, tag) {
  const d = videoDialog(page);
  await d.waitFor({ timeout: 5000 });
  expect(await d.getByRole('button', { name: 'Upload video' }).count() === 1, `${tag}: the editor offers Upload video`);
  await page.waitForTimeout(400);
  expect(await d.getByRole('button', { name: 'Record video' }).count() === 1, `${tag}: … and Record video (a camera is there)`);
  await shot(page, `${tag}-00-video-editor-empty`);
  await d.getByTestId('video-moment-input').setInputFiles({ name: 'Showroom tour.mp4', mimeType: 'video/mp4', buffer: VIDEO_40S });
  await d.getByTestId('video-moment-note').waitFor({ timeout: 8000 }).catch(() => {});
  expect((await d.getByTestId('video-moment-note').innerText().catch(() => '')) === 'Only the first 30 seconds will be used.', `${tag}: a 40 s video gets the note "Only the first 30 seconds will be used." (not refused)`);
  await d.getByTestId('video-moment-save').and(page.locator(':not([disabled])')).waitFor({ timeout: 8000 });
  return d;
}

try {
  // ── 1280 Create: the preview's "+" ─────────────────────────────────────────────────────────────────────────────
  {
    const tag = '1280-create';
    console.log(`-- ${tag}`);
    const { page, context, state } = await open({ width: 1280, height: 900 });
    const create = await startCreate(page);
    await addPhoto(page, create);
    await previewPick(page, 'Add a moment at the start', 'video');
    const d = await uploadInDialog(page, tag);
    const up = state.videoUploads[0] || {};
    expect(state.videoUploads.length === 1 && up.purpose === 'moment' && up.video?.filename === 'Showroom tour.mp4', `${tag}: uploaded at once with purpose=moment ${JSON.stringify(up)}`);
    expect(await d.getByTestId('video-moment-preview').count() === 1, `${tag}: the editor shows the video`);
    await d.getByLabel('Add a title').check();
    await d.getByPlaceholder('Add a short title').fill('Showroom tour');
    await d.getByPlaceholder('Describe this moment in detail...').fill('Walk through the showroom');
    await shot(page, `${tag}-01-video-editor-note`);
    await d.getByTestId('video-moment-save').click();
    await page.waitForTimeout(800);
    expect(await videoDialog(page).count() === 0, `${tag}: Add Video closes the editor`);
    const first = page.locator('[data-testid="storeel-preview-moments"] > li[data-moment-kind="photo"]').first();
    expect(await first.getByTestId('storeel-preview-moment-video').count() === 1, `${tag}: the preview shows the video moment first (where the "+" was), with a play mark`);
    expect((await first.innerText()).includes('Walk through the showroom'), `${tag}: … with its description`);
    expect(state.log.filter((x) => x.what === 'create').length === 0, `${tag}: no Storeel made yet (only the video uploaded)`);
    expect(await create.locator('[data-moment-row="photo"]').count() === 2, `${tag}: step 2 lists 2 moments`);
    await page.getByTestId('storeel-preview-screen').evaluate((el) => { const li = el.querySelector('[data-testid="storeel-preview-moment-video"]'); if (li) el.scrollTop = li.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 60; });
    await page.waitForTimeout(500);
    await page.locator('aside[aria-label="Storeel preview"]').screenshot({ path: `${OUT}/${tag}-02-preview-video-moment.png` });

    // ⋮ → Edit → Save Changes; Move down exists.
    await first.getByTestId('storeel-preview-moment-menu').click();
    await page.waitForTimeout(300);
    expect(await visible(page.getByRole('menuitem', { name: 'Move down' })).count() === 1, `${tag}: its ⋮ has Move down`);
    expect(await visible(page.getByRole('menuitem', { name: /Delete/ })).count() === 1, `${tag}: … and Delete`);
    await shot(page, `${tag}-03-video-moment-menu`);
    await visible(page.getByRole('menuitem', { name: 'Edit' })).click();
    const e = videoDialog(page);
    await e.waitFor({ timeout: 5000 });
    expect(await e.getByRole('heading', { name: 'Edit Video' }).count() > 0 && await e.getByPlaceholder('Describe this moment in detail...').inputValue() === 'Walk through the showroom', `${tag}: Edit opens the Video editor with its description`);
    await e.getByPlaceholder('Describe this moment in detail...').fill('A walk through the new showroom');
    await e.getByRole('button', { name: 'Save Changes' }).click();
    await page.waitForTimeout(500);
    expect((await first.innerText()).includes('A walk through the new showroom'), `${tag}: the preview shows the edited description`);

    await create.getByRole('button', { name: 'Save as Draft', exact: true }).filter({ visible: true }).last().click();
    await page.waitForTimeout(3000);
    const order = state.log.map((x) => x.what);
    expect(JSON.stringify(order.slice(0, 2)) === JSON.stringify(['upload-video', 'create']), `${tag}: API order: upload-video, then POST /memories ${JSON.stringify(order)}`);
    const photos = state.log.find((x) => x.what === 'create')?.body?.photos || [];
    const vid = photos.find((ph) => ph.fileUrl === VIDEO_URL);
    expect(Boolean(vid) && vid.description === 'A walk through the new showroom' && vid.title === 'Showroom tour', `${tag}: POST /memories carries the video moment (URL, title, description) ${JSON.stringify(vid)}`);
    expect(photos.length === 2, `${tag}: … with the photo (${photos.length} moments)`);
    expect(await page.getByRole('dialog', { name: 'Create Campaign' }).count() === 0, `${tag}: Save as Draft closes`);
    await context.close();
  }

  // ── 390 Create: Moments card → Video → Record (30 s countdown) ────────────────────────────────────────────────
  {
    const tag = '390-create';
    console.log(`-- ${tag}`);
    const { page, context, state } = await open({ width: 390, height: 844 });
    const create = await startCreate(page);
    await cardPick(page, create, 'video');
    const d = videoDialog(page);
    await d.waitFor({ timeout: 5000 });
    await page.waitForTimeout(400);
    await shot(page, `${tag}-01-video-editor`);
    expect(await d.getByRole('button', { name: 'Record video' }).count() === 1, `${tag}: a phone offers Record video`);
    await d.getByRole('button', { name: 'Record video' }).click();
    await page.getByTestId('video-recorder-max').waitFor({ timeout: 8000 });
    expect((await page.getByTestId('video-recorder-max').innerText()) === 'Max 30s', `${tag}: the recorder says Max 30s`);
    await page.waitForTimeout(1200);
    await shot(page, `${tag}-02-recorder`);
    await page.locator('button:has(svg circle)').last().click(); // the record button
    await page.getByTestId('video-recorder-countdown').waitFor({ timeout: 5000 });
    const c0 = await page.getByTestId('video-recorder-countdown').innerText();
    expect(c0 === '30s' || c0 === '29s', `${tag}: the countdown starts at 30 s (${c0})`);
    await page.waitForTimeout(2300);
    const c1 = await page.getByTestId('video-recorder-countdown').innerText();
    expect(/^2[6-8]s$/.test(c1), `${tag}: … and counts down (${c1})`);
    await shot(page, `${tag}-03-recording-countdown`);
    await page.locator('button:has(svg circle)').last().click(); // stop
    await videoDialog(page).waitFor({ timeout: 8000 });
    await videoDialog(page).getByTestId('video-moment-save').and(page.locator(':not([disabled])')).waitFor({ timeout: 10000 });
    const up = state.videoUploads[0] || {};
    expect(up.purpose === 'moment' && /^storeel_video_\d+\.(webm|mp4)$/.test(up.video?.filename || '') && up.video.bytes > 0, `${tag}: the recording uploads with purpose=moment ${JSON.stringify(up)}`);
    await videoDialog(page).getByPlaceholder('Describe this moment in detail...').fill('Hello from the showroom');
    await shot(page, `${tag}-04-recorded`);
    await videoDialog(page).getByTestId('video-moment-save').click();
    await page.waitForTimeout(800);
    const rows = create.locator('[data-moment-row="photo"]');
    expect(await rows.count() === 1 && (await rows.first().innerText()).includes('Hello from the showroom'), `${tag}: step 2 lists the video moment`);
    await create.locator('#st-step-moments').scrollIntoViewIfNeeded();
    await shot(page, `${tag}-05-step2-video`);
    await create.getByRole('button', { name: 'Save as Draft', exact: true }).filter({ visible: true }).last().click();
    await page.waitForTimeout(3000);
    const photos = state.log.find((x) => x.what === 'create')?.body?.photos || [];
    expect(photos.length === 1 && photos[0].fileUrl === VIDEO_URL && photos[0].description === 'Hello from the showroom', `${tag}: Save as Draft sends it ${JSON.stringify(photos)}`);
    await context.close();
  }

  // ── Intro Video unchanged ───────────────────────────────────────────────────────────────────────────────────────
  {
    const tag = '1280-intro';
    console.log(`-- ${tag}`);
    const { page, context, state } = await open({ width: 1280, height: 900 });
    const create = await startCreate(page);
    await create.getByTestId('intro-video-input').setInputFiles({ name: 'intro.mp4', mimeType: 'video/mp4', buffer: VIDEO_40S });
    await page.waitForTimeout(2500);
    const up = state.videoUploads[0] || {};
    expect(state.videoUploads.length === 1 && up.purpose === undefined, `${tag}: Intro Video uploads with no purpose (2-minute intro, not cut to 30 s) ${JSON.stringify(up)}`);
    await context.close();
  }

  // ── 1280 campaign page: "+" → Video, saved at once ─────────────────────────────────────────────────────────────
  {
    const tag = '1280-campaign';
    console.log(`-- ${tag}`);
    const { page, context, state } = await open({ width: 1280, height: 900, created: true });
    const card = page.getByText(/^Spring Open House/).filter({ visible: true }).first();
    await card.waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    await card.click();
    await page.getByText('Our new kitchen').filter({ visible: true }).first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1200);
    const plus = page.locator(`[data-testid="timeline-add-plus"][data-after-post-id="${POST_ID}"]`).first();
    await plus.scrollIntoViewIfNeeded();
    await plus.getByRole('button', { name: 'Add Widget' }).click();
    await shot(page, `${tag}-01-chooser`);
    await visible(page.locator('[data-testid="add-widget-chooser"] [data-widget-kind="video"]')).click();
    const d = await uploadInDialog(page, tag);
    await d.getByPlaceholder('Describe this moment in detail...').fill('Walk through the showroom');
    await shot(page, `${tag}-02-video-editor`);
    await d.getByTestId('video-moment-save').click();
    await page.waitForTimeout(2500);
    const mu = state.momentUploads[0] || {};
    expect(state.momentUploads.length === 1 && mu.file === VIDEO_URL && mu.after_post_id === String(POST_ID) && mu.memory_id === String(NEW_ID) && mu.description === 'Walk through the showroom',
      `${tag}: POST upload-photos-after-creation with the video's URL, after the moment ${JSON.stringify(mu)}`);
    expect(JSON.stringify(state.log.map((x) => x.what)) === JSON.stringify(['upload-video', 'moment']), `${tag}: API order: upload-video, then the moment ${JSON.stringify(state.log.map((x) => x.what))}`);
    expect(await videoDialog(page).count() === 0, `${tag}: the editor closes`);
    const videoCard = page.getByTestId('post-card-video').filter({ visible: true });
    await videoCard.first().waitFor({ timeout: 8000 }).catch(() => {});
    expect(await videoCard.count() >= 1, `${tag}: the timeline shows the video moment with its play mark`);
    await videoCard.first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, `${tag}-03-timeline-video`);
    await context.close();
  }

  // ── 390 campaign page: the phone "+" menu has Video ────────────────────────────────────────────────────────────
  {
    const tag = '390-campaign';
    console.log(`-- ${tag}`);
    const { page, context } = await open({ width: 390, height: 844, created: true });
    const card = page.getByText(/^Spring Open House/).filter({ visible: true }).first();
    await card.waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    await card.click();
    await page.getByText('Our new kitchen').filter({ visible: true }).first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1200);
    const plusBtn = page.locator('button:has(svg path[d="M12 5v14M5 12h14"])').filter({ visible: true });
    expect(await plusBtn.count() > 0, `${tag}: the phone timeline has "+" buttons`);
    await plusBtn.last().scrollIntoViewIfNeeded();
    await plusBtn.last().click();
    await page.waitForTimeout(500);
    const opt = visible(page.locator('button[data-widget-kind="video"]'));
    expect(await opt.count() === 1, `${tag}: the phone "+" menu offers Video`);
    await shot(page, `${tag}-01-plus-menu`);
    await opt.click();
    await videoDialog(page).waitFor({ timeout: 5000 }).catch(() => {});
    expect(await videoDialog(page).count() === 1, `${tag}: Video opens its editor`);
    await page.waitForTimeout(500);
    await shot(page, `${tag}-02-video-editor`);
    await context.close();
  }

  // ── Published page: the video moment plays ────────────────────────────────────────────────────────────────────
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = `${width}-published`;
    console.log(`-- ${tag}`);
    const { page, context } = await open({ width, height, path: '/published-memory/spring-open-house', created: true, withVideo: true });
    const thumb = page.getByTestId('published-moment-video').filter({ visible: true }).first();
    await thumb.waitFor({ timeout: 20000 }).catch(() => {});
    expect(await thumb.count() === 1, `${tag}: the video moment shows its first frame with a play mark`);
    await thumb.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, `${tag}-01-video-moment`);
    await thumb.click().catch(() => {});
    const player = page.getByTestId('published-viewer-video').filter({ visible: true }).first();
    await player.waitFor({ timeout: 8000 }).catch(() => {});
    expect(await player.count() === 1 && (await player.getAttribute('src')) === VIDEO_URL, `${tag}: tapping it opens the viewer with the video playing (controls)`);
    await page.waitForTimeout(800);
    await shot(page, `${tag}-02-viewer-video`);
    await context.close();
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall c24b storeel-video checks passed');
process.exit(failures.length || relevant.length ? 1 : 0);
