// Chris 20 Nov 2026 (call 19 Nov) — Studio points 1–6 (point 7 is in tests/products/ui/products-page.mjs, PR_ONLY=c20green).
// Mocked API, click by click, 1280 + 390:
//  1. Mac Photos VIDEOS: a video picked from Photos is written by macOS at pick time, like a photo; videos were never read
//     into memory, so Chrome wouldn't send them. Edit Cover → Upload from Desktop (Chrome's re-readable picker, stubbed
//     like a Photos pick whose first copies can't be read) → the .mov is read again, sent whole (video/quicktime) and
//     becomes the cover; a video that never reads → "This video couldn't be read. Please pick it again." + Pick again
//     (plain file window) → uploads. Create Campaign → Intro Video (file input) → the whole video goes to
//     /memories/upload-video; an unreadable one → the video message + Pick again, nothing sent.
//  2. Moment card: no bottom-right clock badge (it was the extra-photos count; read as "views"); "1 / 3" still shows.
//  3. The "+" between moments stays solid on hover (opaque background; the line doesn't show through).
//  4. Media panel: the sort button has two states (Campaign order ↔ Newest first; no "Oldest first"), a sort icon;
//     2 / 3 across still toggles.
//  5. Create Campaign (Storeel): Save as Draft / Save & Send in the top bar (computer); top Save as Draft creates the
//     campaign. Phone: the actions stay at the end of the list (like the Newsletter composer).
//  6. Dashboard: no "User Activity Metrics" / "Published Stories: Viewed vs Unopened" row, and their APIs aren't called.
// node tests/campaigns/ui/chris-20nov-studio.mjs   (C20_BASE = dev server, default http://127.0.0.1:5234; C20_SHOTS)
import { mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures');
const BASE = process.env.C20_BASE || 'http://127.0.0.1:5234';
const OUT = process.env.C20_SHOTS || '/private/tmp/claude-501/c20-s/shots';
mkdirSync(OUT, { recursive: true });
const MOV_PATH = join(FIX, 'short_h264.mov');
const MOV = readFileSync(MOV_PATH);
const ONLY = process.env.C20_ONLY || '';
const run = (n) => !ONLY || ONLY.split(',').includes(n);

const OWNER = { id: 70, external_user_id: 707, name: 'Christian Beckermann', email: 'chris@c20.test', role: '2', status: 1, is_activated: true, profile_color: '#D946EF' };
const COLORS = ['#14532D', '#166534', '#15803D', '#A16207', '#CA8A04', '#78350F', '#1E3A8A', '#7C2D12', '#4C1D95', '#9D174D'];
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${COLORS[n % COLORS.length]}"/><text x="20" y="160" font-size="60" fill="#fff">${n}</text></svg>`;
const img = (n) => `${BASE}/c20-img/${n}.jpg`;
const STEPS = [
  [11, 'chop', 'Finely chop spinach', '2026-11-16 10:00:00'],
  [12, 'squeeze', 'Gently squeeze spinach to remove excess water before chopping.', '2026-11-18 10:00:00'],
  [15, 'Add-flour', 'Add 3 tablespoons of flour and stir until combined.', '2026-11-14 10:00:00'],
  [17, 'add-milk', 'Add 1 cup of milk, and stir until it thickens.', '2026-11-19 10:00:00'],
];
const post = (id, name, description, date = '2026-11-16 10:00:00', parent_id = null) => ({
  id, name, title: '', description, image_link: img(id), master_image_link: img(id), media_url: img(id), size: 3.37, width: 4032, height: 3024,
  capture_date: date, uploaded_at: date, parent_id, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [], user: { id: 707, name: 'Christian Beckermann' },
});
const CAMPAIGN = {
  id: 901, title: 'Creamed Spinach', user_id: 707, published: 0, slug: 'creamed-spinach', category: { id: 1, name: 'Personal' }, sub_category: null,
  collaborators: [], user: { id: 707, name: 'Christian Beckermann' }, author: { name: 'Christian Beckermann' }, created_at: '2025-01-05T10:00:00Z', location: null, tags: [],
  min_uploaded_img_date: '2026-11-17', max_uploaded_img_date: '2026-11-18', dates: { formatted_range: 'Nov 17 - Nov 18/26', start_date: 'Nov 17/26', end_date: 'Nov 18/26' },
};

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

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
    const chunk = buf.subarray(start + sep.length + 2, next - 2);
    const headEnd = chunk.indexOf('\r\n\r\n');
    if (headEnd !== -1) {
      const head = chunk.subarray(0, headEnd).toString('utf8');
      parts.push({ name: /name="([^"]*)"/.exec(head)?.[1], filename: /filename="([^"]*)"/.exec(head)?.[1], type: /Content-Type:\s*([^\r\n]+)/i.exec(head)?.[1]?.trim(), data: chunk.subarray(headEnd + 4) });
    }
    start = next;
  }
  return parts;
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open(width, height, { path = '/memories', keepHandlePicker = true } = {}) {
  const state = {
    posts: STEPS.map(([id, name, d, date]) => post(id, name, d, date)),
    order: STEPS.map(([id]) => id),
    cover: `${BASE}/c20-img/900.jpg`, coverPuts: [], videoUploads: [], created: [], calls: [],
  };
  // Moment 12 has two extra photos (the card's "1 / 3").
  state.posts.push(post(21, 'squeeze-2', '', '2026-11-18 11:00:00', 12), post(22, 'squeeze-3', '', '2026-11-18 12:00:00', 12));
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  context.setDefaultTimeout(30000);
  await context.addInitScript(([user]) => {
    if (!sessionStorage.getItem('c20-seeded')) {
      sessionStorage.setItem('c20-seeded', '1');
      localStorage.clear();
      localStorage.setItem('stasht_token', 'owner-token');
      localStorage.setItem('stasht_user', JSON.stringify(user));
      localStorage.setItem('view_type', 'personal');
      localStorage.setItem('stasht_campaigns_view', 'storeels');
    }
  }, [OWNER]);
  if (!keepHandlePicker) await context.addInitScript(() => { try { delete window.showOpenFilePicker; } catch { window.showOpenFilePicker = undefined; } });
  const campaign = () => ({ ...CAMPAIGN, last_update_img: state.cover });
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/c20-img/')) {
      if (/\.(mp4|mov)$/.test(url.pathname)) return route.fulfill({ contentType: 'video/mp4', body: MOV });
      return route.fulfill({ contentType: 'image/svg+xml', body: svg(Number(url.pathname.match(/(\d+)/)?.[1] ?? 0)) });
    }
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const m = req.method();
    state.calls.push(`${m} ${p}`);
    let body = null;
    try { body = req.postData() && !String(req.headers()['content-type'] || '').startsWith('multipart/') ? JSON.parse(req.postData()) : null; } catch { body = null; }
    if (p === '/memories' && m === 'GET') {
      const all = [...state.created, { ...campaign(), photos: { count: state.posts.length, preview_images: [] } }];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length }, latest_memories: all, sidebar: { categories: { items: [{ id: 1, name: 'Personal', memory_count: all.length, memories: [] }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories' && m === 'POST') {
      const id = 950 + state.created.length;
      state.created.unshift({ ...CAMPAIGN, id, title: body?.title, slug: `new-${id}`, published: 0, last_update_img: body?.last_update_img ?? null });
      return route.fulfill({ json: { success: true, data: { id, title: body?.title, slug: `new-${id}`, category_id: body?.category_id } } });
    }
    if (p === '/memories/901' && m === 'GET') {
      // Sub-photos come flat, with parent_id (as the web API sends them).
      return route.fulfill({ json: { status: 'success', data: { memory: { ...campaign(), posts: structuredClone(state.posts), widgets: [], photos: { count: state.posts.length } }, linked_memories: [], unified_order: state.order.map((id) => ({ type: 'post', id })) } } });
    }
    // Edit Cover → Upload from Desktop: multipart POST with _method=PUT and last_update_img.
    if (p === '/memories/901' && m === 'POST') {
      const parts = parseMultipart(req.postDataBuffer(), req.headers()['content-type']);
      const file = parts.find((x) => x.name === 'last_update_img');
      state.coverPuts.push({ filename: file?.filename, type: file?.type, size: file?.data?.length ?? 0, same: Boolean(file?.data && Buffer.compare(file.data, MOV) === 0) });
      const ext = (file?.filename || '').split('.').pop().toLowerCase();
      state.cover = `${BASE}/c20-img/cover-${state.coverPuts.length}.${['mov', 'mp4'].includes(ext) ? 'mp4' : 'jpg'}`;
      return route.fulfill({ json: { success: true, message: 'Memory updated successfully.', data: campaign() } });
    }
    if (p === '/memories/upload-video' && m === 'POST') {
      const parts = parseMultipart(req.postDataBuffer(), req.headers()['content-type']);
      const file = parts.find((x) => x.name === 'video');
      state.videoUploads.push({ filename: file?.filename, type: file?.type, size: file?.data?.length ?? 0, same: Boolean(file?.data && Buffer.compare(file.data, MOV) === 0) });
      return route.fulfill({ json: { success: true, fileUrl: `${BASE}/c20-img/intro-${state.videoUploads.length}.mp4` } });
    }
    if (p === '/memories/901/visit') return route.fulfill({ json: { success: true, data: { visited: true } } });
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 1, name: 'Personal', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: false, reason: 'not_available', item_count: 0 } } });
    if (p === '/cars' && m === 'GET') return route.fulfill({ json: { success: true, data: { cars: [], pagination: { last_page: 1 }, filters: {} } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 1, memory_limit: 50 } } } });
    if (p === '/user/memory-counts') return route.fulfill({ json: { success: true, data: { memory_counts: { total_memories: 1, total_memory_images: 6, published_memories: 0, active_collaborators: 0 } } } });
    if (p === '/lead-groups') return route.fulfill({ json: { groups: [] } });
    if (p === '/properties') return route.fulfill({ json: { success: true, data: { properties: [], owned_properties: [], shared_properties: [], owned_count: 0, shared_count: 0, total_count: 0 } } });
    if (p === '/stripe/payment-methods') return route.fulfill({ json: { success: true, payment_methods: [] } });
    if (p === '/dashboard') {
      const card = (count) => ({ count, formatted: String(count), period_count: 0, previous_period_count: 0, period_label: 'This Week', percentage: { value: 0, text: '', trend: 'neutral' } });
      return route.fulfill({ json: { success: true, data: { statistics: { total_memories: card(1), total_media: card(6), total_users: card(1), storage: { used: 0, formatted: '0 MB', period_used: 0, period_formatted: '0 MB', limit: 1, limit_formatted: '1000 GB', percentage_used: 0, available: 1, available_formatted: '1000 GB', period_label: 'This Week' } }, latest_memories: [], date_range: { type: 'weekly' } } } });
    }
    if (p === '/dashboard/activity-metrics' || p === '/dashboard/published-memories') {
      return route.fulfill({ json: { success: true, data: { chart_data: [], weeks: [], viewed: 0, unopened: 0 } } });
    }
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(`${width}: ${e.message}`));
  await page.goto(`${BASE}${path}`);
  return { context, page, state };
}

async function openCampaign(page) {
  const card = page.getByText(/^Creamed Spinach/).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(800);
  await card.click();
  await page.locator('[data-post-id="11"]').first().waitFor({ state: 'attached', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
}
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const toastText = (page) => page.locator('[data-sonner-toast]').allInnerTexts().then((t) => t.join(' | '));
async function waitToast(page, re, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const t = await toastText(page);
    if (re.test(t)) return t;
    await page.waitForTimeout(200);
  }
  return toastText(page);
}
const shot = async (page, name) => { const path = `${OUT}/${name}.png`; await page.screenshot({ path }); console.log('  shot', path); };

/** Chrome's re-readable picker stubbed like a Mac Photos VIDEO pick: the first `bad` copies can't be read (macOS still
 *  writing it), then the readable .mov; `neverReadable`: never. */
async function stubPhotosVideoPicker(page, { bad = 2, neverReadable = false } = {}) {
  await page.evaluate(([bytes, bad, neverReadable]) => {
    window.__picker = { opened: 0, getFile: 0, options: null };
    const good = () => new File([new Uint8Array(bytes)], 'IMG_3001.mov', { type: 'video/quicktime', lastModified: Date.now() });
    const broken = () => {
      const f = new File([new Uint8Array([0, 0, 0])], 'IMG_3001.mov', { type: 'video/quicktime', lastModified: Date.now() });
      Object.defineProperty(f, 'arrayBuffer', { value: () => Promise.reject(new DOMException('The requested file could not be read', 'NotReadableError')) });
      return f;
    };
    window.showOpenFilePicker = async (options) => {
      window.__picker.opened++;
      window.__picker.options = options;
      return [{ kind: 'file', name: 'IMG_3001.mov', getFile: async () => (++window.__picker.getFile <= bad || neverReadable ? broken() : good()) }];
    };
  }, [[...MOV], bad, neverReadable]);
}
async function clickUploadFromDesktop(page) {
  await page.getByRole('button', { name: /Edit Cover/ }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: /Upload from Desktop/ }).filter({ visible: true }).first().click();
}

// ── 1: Edit Cover with a Mac Photos video (1280, Chrome picker) ───────────────────────────────────────────────────
async function videoCoverFlow() {
  const tag = '1280-p1-cover';
  console.log(`-- ${tag}`);
  const { context, page, state } = await open(1280, 900);
  await openCampaign(page);
  await stubPhotosVideoPicker(page, { bad: 2 });
  await clickUploadFromDesktop(page);
  const t = await waitToast(page, /updated|Failed|couldn't/i);
  const pick = await page.evaluate(() => window.__picker);
  expect(pick.opened === 1 && pick.getFile >= 3, `${tag}: the re-readable picker opens and the unreadable copies are read again (getFile ×${pick.getFile})`);
  const put = state.coverPuts[0] || {};
  expect(state.coverPuts.length === 1 && put.type === 'video/quicktime' && put.filename === 'IMG_3001.mov' && put.same && put.size === MOV.length,
    `${tag}: the whole video is sent as video/quicktime (${JSON.stringify(put)}, fixture ${MOV.length} bytes)`);
  expect(/Cover video updated|updated successfully/i.test(t) && !/Failed|couldn't/i.test(t), `${tag}: success toast (${t})`);
  await page.waitForTimeout(1500);
  const shown = await page.evaluate(() => [...document.querySelectorAll('video')].map((v) => v.getAttribute('src') || v.querySelector('source')?.getAttribute('src')).filter(Boolean));
  expect(shown.some((s) => s.includes('cover-1.mp4')), `${tag}: the video is the cover (${shown.join(', ')})`);
  await shot(page, `${tag}-01-video-cover`);

  // A Photos video that never becomes readable → the VIDEO message + Pick again → plain file window → uploads.
  await page.waitForTimeout(4500);
  await stubPhotosVideoPicker(page, { neverReadable: true });
  await clickUploadFromDesktop(page);
  const bad = await waitToast(page, /couldn't be read/, 25000);
  expect(/This video couldn't be read\. Please pick it again\./.test(bad), `${tag}: an unreadable video says "video" (${bad})`);
  expect(state.coverPuts.length === 1, `${tag}: … nothing sent`);
  const again = page.getByRole('button', { name: 'Pick again' }).filter({ visible: true }).first();
  expect(await again.isVisible(), `${tag}: … with "Pick again"`);
  await shot(page, `${tag}-02-video-pick-again`);
  const chooserP = page.waitForEvent('filechooser', { timeout: 15000 });
  await again.click();
  const chooser = await chooserP;
  await chooser.setFiles(MOV_PATH);
  const t3 = await waitToast(page, /Cover video updated|updated successfully/i, 20000);
  expect(state.coverPuts.length === 2 && state.coverPuts[1].same && state.coverPuts[1].type === 'video/quicktime', `${tag}: Pick again → the plain file window → the whole video uploads (${t3}; ${JSON.stringify(state.coverPuts[1])})`);
  await context.close();
}

// ── 1: installed Studio app (plain file input) — a picked video uploads whole (1280) / phone (390) ─────────────────
async function videoCoverInputFlow(width, height) {
  const tag = `${width}-p1-cover-input`;
  console.log(`-- ${tag}`);
  const { context, page, state } = await open(width, height, { keepHandlePicker: width >= 768 });
  await openCampaign(page);
  if (width >= 768) {
    await page.evaluate(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q) => (q === '(display-mode: standalone)' ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q));
    });
  }
  const chooserP = page.waitForEvent('filechooser', { timeout: 15000 });
  if (width >= 768) await clickUploadFromDesktop(page);
  else await page.locator('label').filter({ hasText: 'Edit Cover' }).filter({ visible: true }).first().click();
  const chooser = await chooserP;
  await chooser.setFiles(MOV_PATH);
  const t = await waitToast(page, /updated|Failed|couldn't/i);
  expect(state.coverPuts.length === 1 && state.coverPuts[0].same && state.coverPuts[0].type === 'video/quicktime', `${tag}: the plain file window: the whole .mov uploads (${t}; ${JSON.stringify(state.coverPuts[0])})`);
  await page.waitForTimeout(1200);
  await shot(page, `${tag}-01-video-cover`);
  expect(await noHScroll(page), `${tag}: no horizontal page scroll`);
  await context.close();
}

// ── 2, 3, 4: the campaign page (1280; 390 for the card badge) ─────────────────────────────────────────────────────
async function campaignPage(width, height) {
  const tag = `${width}-p2-4`;
  console.log(`-- ${tag}`);
  const { context, page } = await open(width, height);
  await openCampaign(page);
  // 2. The moment with 2 extra photos: "1 / 3", no clock badge.
  // (The phone's timeline cards have no data-post-id: find the counter by its text there.)
  const counter = width >= 1024
    ? page.locator('[data-post-id="12"]').filter({ visible: true }).first().locator('.absolute.top-2.right-2').first()
    : page.locator('.absolute.top-2.right-2').filter({ hasText: '1 / 3' }).filter({ visible: true }).first();
  await counter.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);
  const clockBadges = await page.locator('path[d="M12 7V12L15 15"]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0 && e.closest('.rounded-full.absolute, .absolute.rounded-full')).length);
  const cardEl = counter.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
  expect(/1 \/ 3/.test(await counter.innerText().catch(() => '')), `${tag} 2: the moment card still counts its photos ("1 / 3")`);
  expect(clockBadges === 0 && await cardEl.locator('.absolute.bottom-2.right-2.rounded-full').count() === 0, `${tag} 2: no clock badge on the moment card (${clockBadges})`);
  await shot(page, `${tag}-01-moment-card-no-clock`);

  if (width >= 1024) {
    // 3. The "+" between moments: opaque on hover and at rest.
    const plus = page.locator('[data-testid="timeline-add-plus"]').filter({ visible: true }).nth(1).getByRole('button', { name: 'Add Widget' });
    await plus.scrollIntoViewIfNeeded();
    const alpha = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); const parts = m ? m[1].split(',').map((x) => x.trim()) : []; return parts.length === 4 ? Number(parts[3]) : 1; };
    const rest = await plus.evaluate((el) => getComputedStyle(el).backgroundColor);
    await plus.hover();
    await page.waitForTimeout(400);
    const hover = await plus.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(alpha(rest) === 1 && alpha(hover) === 1, `${tag} 3: the "+" is solid at rest (${rest}) and on hover (${hover})`);
    // The line under it doesn't show: the pixel at the circle's centre-left (on the line's row) is the button's colour.
    const box = await plus.boundingBox();
    await page.screenshot({ path: `${OUT}/${tag}-02-plus-hover.png`, clip: { x: box.x - 120, y: box.y - 30, width: box.width + 240, height: box.height + 60 } });

    // 4. Media panel: sort = two states; 2 / 3 across still toggles.
    const sortBtn = page.getByTestId('media-sort-toggle').filter({ visible: true }).first();
    await sortBtn.scrollIntoViewIfNeeded();
    const states = [];
    for (let i = 0; i < 4; i++) { states.push(await sortBtn.getAttribute('title')); await sortBtn.click(); await page.waitForTimeout(250); }
    expect(JSON.stringify(states) === JSON.stringify(['Campaign order', 'Newest first', 'Campaign order', 'Newest first']), `${tag} 4: the sort button has two states, no "Oldest first" (${states.join(' → ')})`);
    const icon = await sortBtn.locator('svg').getAttribute('class');
    expect(/arrow-up-down/.test(icon || ''), `${tag} 4: Campaign order shows a sort icon, not the list icon (${icon})`);
    const cols = page.getByTestId('media-columns-toggle').filter({ visible: true }).first();
    const grid = page.locator('[data-testid="media-panel-grid"]').filter({ visible: true }).first();
    const c0 = await grid.getAttribute('data-columns');
    await cols.click();
    await page.waitForTimeout(300);
    const c1 = await grid.getAttribute('data-columns');
    await shot(page, `${tag}-03-media-panel-${c1}-across`);
    await cols.click();
    await page.waitForTimeout(300);
    const c2 = await grid.getAttribute('data-columns');
    expect(c0 !== c1 && c2 === c0 && ['2', '3'].includes(c1), `${tag} 4: 2 / 3 across still toggles (${c0} → ${c1} → ${c2})`);
  }
  expect(await noHScroll(page), `${tag}: no horizontal page scroll`);
  await context.close();
}

// ── 1 + 5: Create Campaign (Storeel) — top-bar actions; Intro Video from a file input ─────────────────────────────
async function createCampaign(width, height) {
  const tag = `${width}-p5`;
  console.log(`-- ${tag}`);
  const { context, page, state } = await open(width, height);
  await page.getByText(/^Creamed Spinach/).filter({ visible: true }).first().waitFor({ timeout: 180000 });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Create( a Campaign)?$/ }).filter({ visible: true }).last().click();
  const flow = page.getByRole('dialog', { name: 'Create Campaign' });
  await flow.getByPlaceholder('Give your campaign a meaningful title').waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const header = flow.locator('header').first();
  const topSave = flow.getByTestId('st-top-save');
  const topSend = flow.getByTestId('st-top-send');
  const actions = flow.locator('#st-actions');
  if (width >= 768) {
    expect(await topSave.isVisible() && (await topSave.innerText()).trim() === 'Save as Draft', `${tag}: "Save as Draft" is in the top bar`);
    expect(await topSend.isVisible() && (await topSend.innerText()).trim() === 'Save & Send', `${tag}: "Save & Send" is in the top bar`);
    expect(await header.getByRole('button', { name: 'Cancel', exact: true }).isVisible(), `${tag}: Cancel stays in the top bar`);
    const order = await header.locator('button').evaluateAll((bs) => bs.filter((b) => b.getBoundingClientRect().width > 0).map((b) => b.textContent.trim()).filter((t) => /Cancel|Save/.test(t)));
    expect(JSON.stringify(order) === JSON.stringify(['Cancel', 'Save as Draft', 'Save & Send']), `${tag}: Cancel · Save as Draft · Save & Send, like the newsletter's (${order.join(' · ')})`);
    expect(await header.evaluate((h) => h.scrollWidth <= h.clientWidth + 1), `${tag}: the top bar doesn't overflow`);
    const hb = await header.boundingBox();
    expect(hb && hb.height <= 80, `${tag}: one compact row (${hb && Math.round(hb.height)}px)`);
    expect(await topSave.isDisabled() && await actions.getByRole('button', { name: 'Save as Draft', exact: true }).isDisabled(), `${tag}: Save as Draft off top and bottom with no title (same state)`);
  } else {
    expect(!(await topSave.isVisible()) && !(await topSend.isVisible()), `${tag}: phone: not in the top bar (like the newsletter composer)`);
  }
  expect(await actions.getByRole('button', { name: 'Save as Draft', exact: true }).count() === 1 && await actions.getByRole('button', { name: 'Save & Send', exact: true }).count() === 1, `${tag}: the bottom actions stay`);
  await shot(page, `${tag}-01-create-top-bar`);

  // 1. Intro Video: a video picked with the file input goes whole to /memories/upload-video.
  const introInput = flow.getByTestId('intro-video-input');
  await introInput.setInputFiles(MOV_PATH);
  const end = Date.now() + 15000;
  while (!state.videoUploads.length && Date.now() < end) await page.waitForTimeout(200);
  expect(state.videoUploads.length === 1 && state.videoUploads[0].same && state.videoUploads[0].filename === 'short_h264.mov', `${tag} 1: Intro Video: the whole video is uploaded (${JSON.stringify(state.videoUploads[0])})`);
  // An intro video that can't be read (a Photos pick that changed) → the video message + Pick again, nothing sent.
  await introInput.evaluate((input) => {
    const f = new File([new Uint8Array([0, 0, 0])], 'IMG_3002.mov', { type: 'video/quicktime' });
    Object.defineProperty(f, 'arrayBuffer', { value: () => Promise.reject(new DOMException('The requested file could not be read', 'NotReadableError')) });
    const dt = new DataTransfer();
    dt.items.add(f);
    const shown = dt.files[0];
    try { Object.defineProperty(shown, 'arrayBuffer', { value: () => Promise.reject(new DOMException('The requested file could not be read', 'NotReadableError')) }); } catch { /* the same File object: already unreadable */ }
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const bad = await waitToast(page, /couldn't be read|could not be uploaded/, 10000);
  expect(/This video couldn't be read\. Please pick it again\./.test(bad) && state.videoUploads.length === 1, `${tag} 1: an unreadable intro video says so, nothing sent (${bad})`);
  const again = page.getByRole('button', { name: 'Pick again' }).filter({ visible: true }).first();
  expect(await again.isVisible(), `${tag} 1: … with "Pick again"`);
  await shot(page, `${tag}-02-intro-video-pick-again`);
  const chooserP = page.waitForEvent('filechooser', { timeout: 10000 });
  await again.click();
  const chooser = await chooserP;
  await chooser.setFiles(MOV_PATH);
  const end2 = Date.now() + 15000;
  while (state.videoUploads.length < 2 && Date.now() < end2) await page.waitForTimeout(200);
  expect(state.videoUploads.length === 2 && state.videoUploads[1].same, `${tag} 1: Pick again opens the intro-video file window and the video uploads`);

  // 5. Title → (computer) the TOP Save as Draft creates the campaign; (phone) the bottom one.
  await flow.getByPlaceholder('Give your campaign a meaningful title').fill(`Winter tires ${tag}`);
  await page.waitForTimeout(600);
  if (width >= 768) {
    expect(await topSave.isEnabled(), `${tag}: with a title, top Save as Draft is on`);
    await topSave.click();
  } else {
    await actions.getByRole('button', { name: 'Save as Draft', exact: true }).click();
  }
  const end3 = Date.now() + 10000;
  while (!state.created.length && Date.now() < end3) await page.waitForTimeout(200);
  await page.waitForTimeout(1200);
  expect(state.created.length === 1 && state.created[0].title === `Winter tires ${tag}`, `${tag}: Save as Draft made one campaign (${state.created.length})`);
  expect(state.created[0]?.last_update_img?.includes('intro-2.mp4'), `${tag}: … with the intro video as its cover (${state.created[0]?.last_update_img})`);
  expect(!(await flow.count()), `${tag}: … and the page closes`);
  expect(await page.getByText(`Winter tires ${tag}`).filter({ visible: true }).count() > 0, `${tag}: the new campaign is in the list`);
  await shot(page, `${tag}-03-created`);
  expect(await noHScroll(page), `${tag}: no horizontal page scroll`);
  await context.close();
}

// ── 6: Dashboard ──────────────────────────────────────────────────────────────────────────────────────────────────
async function dashboard(width, height) {
  const tag = `${width}-p6`;
  console.log(`-- ${tag}`);
  const { context, page, state } = await open(width, height, { path: '/dashboard' });
  await page.getByText(/Latest Campaigns|Total Campaigns|Campaigns/).filter({ visible: true }).first().waitFor({ timeout: 180000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  expect(await page.getByText(/User Activity Metrics/).count() === 0, `${tag}: no "User Activity Metrics"`);
  expect(await page.getByText(/Viewed vs Unopened/).count() === 0, `${tag}: no "Published Stories: Viewed vs Unopened"`);
  const asked = state.calls.filter((c) => /activity-metrics|published-memories/.test(c));
  expect(asked.length === 0, `${tag}: their APIs aren't called (${asked.join(', ')})`);
  expect(state.calls.some((c) => c === 'GET /dashboard'), `${tag}: the rest of the dashboard still loads (GET /dashboard)`);
  await page.screenshot({ path: `${OUT}/${tag}-01-dashboard.png`, fullPage: true });
  expect(await noHScroll(page), `${tag}: no horizontal page scroll`);
  await context.close();
}

try {
  if (run('cover')) { await videoCoverFlow(); await videoCoverInputFlow(1280, 900); await videoCoverInputFlow(390, 844); }
  if (run('page')) { await campaignPage(1280, 900); await campaignPage(390, 844); }
  if (run('create')) { await createCampaign(1280, 900); await createCampaign(390, 844); }
  if (run('dashboard')) { await dashboard(1280, 900); await dashboard(390, 844); }
} catch (e) {
  failures.push(String((e && e.stack) || e));
  console.log(e);
}
await browser.close();
const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
console.log('page errors:', relevant.length, relevant.slice(0, 5));
console.log(failures.length ? `FAILURES ${failures.length}:\n` + failures.join('\n') : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
