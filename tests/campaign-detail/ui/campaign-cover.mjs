// Campaign covers (Chris, 4 Nov 2026, point 7 + review + "Brand everywhere"): a campaign with no chosen cover shows
// the brand (the owner's avatar; the property image in the property view) EVERYWHERE — owner page, shared view,
// published page, cards — never the first moment photo. The brand is never stretched: a logo is drawn whole and
// plain (Chris 7 Nov point 11: never the round avatar, ring or blurred backdrop), a wordmark uncut, at most 60% of the box
// (when not judged yet: on white). Real photos stay full-bleed, including a typical 640x480 dealer photo.
// Checks at 1280, 390 (and 1600):
//  - the campaign grid: brand card (the API sends last_update_img = owner's avatar), photo card, shared campaign card
//    with a wordmark owner; cards use the plain colour backdrop;
//  - the owner campaign page with the brand (the 8abfd1b2 case, moments present), with a real photo, with a 640x480;
//  - the shared view (a viewer of someone else's campaign, moments present) → the owner's wordmark, whole;
//  - the published page: square-logo brand, wordmark brand with moments present, and a real photo.
// node tests/campaign-detail/ui/campaign-cover.mjs   (needs the dev server: CD_BASE, default http://localhost:5311)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: CD_SHOTS (default /private/tmp/claude-501/campaign-detail-ui/cover).
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { imageFor, coverInfo, STUB_STRIPE, STUB_GAPI } from './cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.CD_BASE || 'http://localhost:5311';
const OUT = process.env.CD_SHOTS || '/private/tmp/claude-501/campaign-detail-ui/cover';
mkdirSync(OUT, { recursive: true });

const img = (n) => `${BASE}/cd-img/${n}`;
const LOGO = img('logo.png');
const WIDE = img('wide.png');
const OWNER = { id: 707, name: 'Next Summit', profile_image: LOGO, profile_color: '#1D4ED8' };
const PARTNER = { id: 808, name: 'Northwind Motors', profile_image: WIDE, profile_color: '#0F172A' };
const MAIN = { id: 70, external_user_id: 707, name: 'Next Summit', email: 'main@summit.test', role: '2', status: 1, is_activated: true, avatar: LOGO, profile_image: LOGO, profile_color: '#1D4ED8' };
const post = (id, n) => ({
  id, name: `Moment ${n}`, title: `Moment ${n}`, description: '', master_image_link: img(`post-${n}.jpg`), image_link: img(`post-${n}.jpg`), media_url: img(`post-${n}.jpg`),
  capture_date: `2026-10-1${n} 10:00:00`, uploaded_at: `2026-10-1${n} 10:00:00`, parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [],
});
const FIRST_MOMENT = img('post-1.jpg');
const campaign = (id, title, cover, owner = OWNER, over = {}) => ({
  id, title, user_id: owner.id, published: 1, slug: `c-${id}`, category: { id: 5, name: 'Events' },
  photos: { count: 1, preview_images: [{ id: id * 10 + 1, url: FIRST_MOMENT }] },
  collaborators: [], user: owner, author: { name: owner.name, avatar: owner.profile_image, profile_color: owner.profile_color }, created_at: '2026-10-01 10:00:00',
  location: 'Toronto, ON', tags: [], last_update_img: cover, ...over,
});
// The list API sends last_update_img = cover ?? owner's profile image (MemoriesController::formatLatestMemory).
const BRAND = campaign(901, 'Next Summit / 25', null);
const PHOTO = campaign(902, 'Lakeside Launch', img('photo.jpg'));
const DEALER = campaign(903, 'Dealer Photo', img('photo640.jpg'));
const SHARED = campaign(904, 'Northwind Showcase', null, PARTNER, { collaborator: [{ user_id: 707, status: 1, role: 'viewer' }] });
const listItem = (c) => ({ ...c, last_update_img: c.last_update_img ?? c.user.profile_image });
const detail = (c) => ({ ...c, posts: [post(c.id * 10 + 1, 1)], linked_memories: [], widgets: [], unified_order: null });
const DETAILS = { 901: detail(BRAND), 902: detail(PHOTO), 903: detail(DEALER), 904: detail(SHARED) };
// Published pages: the square-logo brand with no moments; the wordmark brand WITH a moment (the first moment must
// not stand in for the cover); a real photo cover.
const published = {
  'brand-cover': { ...detail(BRAND), posts: [] },
  'wide-brand': detail(campaign(905, 'Northwind Open House', null, PARTNER)),
  'photo-cover': detail(PHOTO),
};

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function newPage({ width, height, signedIn }) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user, signedIn]) => {
    if (sessionStorage.getItem('cd-seeded')) return;
    sessionStorage.setItem('cd-seeded', '1');
    localStorage.clear();
    if (!signedIn) return;
    localStorage.setItem('stasht_token', 'main-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels');
  }, [MAIN, signedIn]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/cd-img/')) {
      const { body, contentType } = await imageFor(url.pathname.slice('/cd-img/'.length));
      return route.fulfill({ body, contentType });
    }
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (p === '/memories' && req.method() === 'GET') {
      const all = [BRAND, PHOTO, DEALER, SHARED].map(listItem);
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Events', memory_count: all.length }] }, labels: { items: [] } } } } });
    }
    const m = p.match(/^\/memories\/(\d+)$/);
    if (m && req.method() === 'GET') return route.fulfill({ json: { status: 'success', data: { memory: DETAILS[Number(m[1])] } } });
    if (p === '/published-memories') {
      return route.fulfill({ json: { success: true, data: { memory: published[url.searchParams.get('token')] ?? published['photo-cover'], order_by: 'asc' } } });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
  return { context, page };
}

const visibleCovers = (page) => page.locator('[data-cover-mode]').filter({ visible: true });
async function settle(page) { await page.waitForTimeout(1500); }
const cardButton = (page, title) => page.getByRole('button', { name: `View ${title} campaign details` }).filter({ visible: true }).first();

function checkBrand(tag, info, { src, shape }) {
  // Chris 7 Nov point 11 ("this needs to be smooth"): a brand not judged yet is drawn whole and PLAIN — never the round
  // avatar with a ring, never on a blurred copy; a square logo is a square, a wordmark keeps its 3:1 shape.
  expect(info?.mode === 'brand', `${tag}: shows the brand (mode=${info?.mode})`);
  if (!info?.img) return;
  expect(info.src === src, `${tag}: the brand image, not the first moment (${info.src})`);
  expect(info.shape === 'rect', `${tag}: whole, never cut round (shape=${info.shape})`);
  const aspect = shape === 'circle' ? 1 : 3;
  expect(Math.abs(info.img.width / info.img.height - aspect) < 0.1 && info.img.fit === 'contain', `${tag}: shown whole at its own shape (${info.img.width}x${info.img.height}, ${info.img.fit})`);
  expect(info.img.width <= Math.ceil(info.box.width * 0.6) + 1, `${tag}: ≤ 60% of the box width (${info.img.width} of ${info.box.width})`);
  expect(info.img.width <= info.img.natural * 1.5 + 1 || shape !== 'circle', `${tag}: never enlarged past 1.5x (${info.img.width} vs natural ${info.img.natural})`);
  expect(!info.blurred && info.img.radius === '0px', `${tag}: plain — no blurred copy, no ring (blurred=${info.blurred}, radius=${info.img.radius})`);
}
function checkPhoto(tag, info, src) {
  expect(info?.mode === 'cover', `${tag}: a real photo stays full-bleed (mode=${info?.mode})`);
  if (info?.img) expect(info.img.fit === 'cover' && info.img.width === info.box.width, `${tag}: photo fills the box (${info.img.width} of ${info.box.width}, ${info.img.fit})`);
  if (src) expect(info?.src === src, `${tag}: the chosen cover (${info?.src})`);
}

async function openCampaign(page, title) {
  await page.goto(`${BASE}/memories`);
  const card = cardButton(page, title);
  await card.waitFor({ state: 'visible', timeout: 30000 });
  await settle(page);
  await card.click();
  await page.getByText('Moment 1').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  await settle(page);
}

try {
  // 1600 too: at 1280 the campaign page's centre column (the header) is mostly behind the Media panel, as before.
  for (const [width, height] of [[1280, 900], [390, 844], [1600, 1000]]) {
    const tag = String(width);

    // 1. The campaign grid + the brand campaign's page (the 8abfd1b2 case).
    {
      const { page, context } = await newPage({ width, height, signedIn: true });
      await page.goto(`${BASE}/memories`);
      const brandCard = cardButton(page, 'Next Summit / 25');
      await brandCard.waitFor({ state: 'visible', timeout: 30000 }).catch(async (e) => {
        await page.screenshot({ path: `${OUT}/${tag}-00-grid-not-shown.png` });
        console.log('page errors:', pageErrors.slice(0, 5));
        throw e;
      });
      await settle(page);
      checkBrand(`${tag} card`, await coverInfo(brandCard.locator('[data-cover-mode]').first()), { src: LOGO, shape: 'circle', blurred: false });
      checkPhoto(`${tag} photo card`, await coverInfo(cardButton(page, 'Lakeside Launch').locator('[data-cover-mode]').first()), img('photo.jpg'));
      checkPhoto(`${tag} 640x480 card`, await coverInfo(cardButton(page, 'Dealer Photo').locator('[data-cover-mode]').first()), img('photo640.jpg'));
      checkBrand(`${tag} shared card (wordmark owner)`, await coverInfo(cardButton(page, 'Northwind Showcase').locator('[data-cover-mode]').first()), { src: WIDE, shape: 'rect', blurred: false });
      await page.screenshot({ path: `${OUT}/${tag}-01-card-grid.png`, fullPage: width < 1024 });

      await brandCard.click();
      await page.getByText('Moment 1').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
      await settle(page);
      checkBrand(`${tag} campaign page`, await coverInfo(visibleCovers(page).first()), { src: LOGO, shape: 'circle', blurred: true });
      expect(await page.getByText('Edit Cover').filter({ visible: true }).count() > 0, `${tag} campaign page: Edit Cover still there`);
      await page.screenshot({ path: `${OUT}/${tag}-02-campaign-page-brand.png` });
      await context.close();
    }

    // 2. Campaign pages with a real photo cover and a 640x480 dealer photo: full-bleed.
    for (const [title, src, n] of [['Lakeside Launch', img('photo.jpg'), '03'], ['Dealer Photo', img('photo640.jpg'), '03b']]) {
      const { page, context } = await newPage({ width, height, signedIn: true });
      await openCampaign(page, title);
      checkPhoto(`${tag} campaign page ${title}`, await coverInfo(visibleCovers(page).first()), src);
      await page.screenshot({ path: `${OUT}/${tag}-${n}-campaign-page-${n === '03' ? 'photo' : 'photo640'}.png` });
      await context.close();
    }

    // 3. The shared view (a viewer of Northwind's campaign, which has a moment): the owner's wordmark, whole.
    {
      const { page, context } = await newPage({ width, height, signedIn: true });
      await openCampaign(page, 'Northwind Showcase');
      checkBrand(`${tag} shared view`, await coverInfo(visibleCovers(page).first()), { src: WIDE, shape: 'rect', blurred: true });
      await page.screenshot({ path: `${OUT}/${tag}-04-shared-view-wordmark.png` });
      await context.close();
    }

    // 4. The published page.
    for (const [slug, n] of [['brand-cover', '05'], ['wide-brand', '06'], ['photo-cover', '07']]) {
      const { page, context } = await newPage({ width, height, signedIn: false });
      await page.goto(`${BASE}/published-memory/${slug}`);
      await visibleCovers(page).first().waitFor({ state: 'visible', timeout: 30000 });
      await settle(page);
      const info = await coverInfo(visibleCovers(page).first());
      if (slug === 'brand-cover') checkBrand(`${tag} published page`, info, { src: LOGO, shape: 'circle', blurred: true });
      else if (slug === 'wide-brand') checkBrand(`${tag} published page wordmark (moments present)`, info, { src: WIDE, shape: 'rect', blurred: true });
      else checkPhoto(`${tag} published page photo`, info, img('photo.jpg'));
      await page.screenshot({ path: `${OUT}/${tag}-${n}-published-${slug}.png` });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall campaign cover checks passed');
process.exit(failures.length ? 1 : 0);
