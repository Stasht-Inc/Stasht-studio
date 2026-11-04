// Campaign covers (Chris, 4 Nov 2026, point 7): a campaign with no cover of its own shows the brand (the account
// avatar). It was stretched full-bleed — "hugely zoomed, pixelated" (screenshot 8abfd1b2). Now it is the round avatar,
// centred, at most 60% of the box, over a blurred copy of itself; real photos stay full-bleed as before.
// Checks at 1280, 390 (and 1600): the campaign grid (brand card + photo card), the campaign page with the brand cover and with
// a real photo, and the published page with the brand cover and with a real photo.
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
const OWNER = { id: 707, name: 'Next Summit', profile_image: LOGO, profile_color: '#1D4ED8' };
const MAIN = { id: 70, external_user_id: 707, name: 'Next Summit', email: 'main@summit.test', role: '2', status: 1, is_activated: true, avatar: LOGO, profile_image: LOGO, profile_color: '#1D4ED8' };
const post = (id, n) => ({
  id, name: `Moment ${n}`, title: `Moment ${n}`, description: '', master_image_link: img(`post-${n}.jpg`), image_link: img(`post-${n}.jpg`), media_url: img(`post-${n}.jpg`),
  capture_date: `2026-10-1${n} 10:00:00`, uploaded_at: `2026-10-1${n} 10:00:00`, parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [],
});
const campaign = (id, title, cover) => ({
  id, title, user_id: 707, published: 1, slug: `c-${id}`, category: { id: 5, name: 'Events' }, photos: { count: 1 },
  collaborators: [], user: OWNER, author: { name: 'Next Summit', avatar: LOGO, profile_color: '#1D4ED8' }, created_at: '2026-10-01 10:00:00',
  location: 'Toronto, ON', tags: [], last_update_img: cover,
});
const BRAND = campaign(901, 'Next Summit / 25', null);
const PHOTO = campaign(902, 'Lakeside Launch', img('photo.jpg'));
const detail = (c) => ({ ...c, posts: [post(c.id * 10 + 1, 1)], linked_memories: [], widgets: [], unified_order: null });
// Published pages: the brand case has no cover and no moments (so nothing else can stand in for the cover).
const published = { brand: { ...detail(BRAND), posts: [] }, photo: detail(PHOTO) };

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
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: [BRAND, PHOTO], total: 2 }, latest_memories: [BRAND, PHOTO], sidebar: { categories: { items: [{ id: 5, name: 'Events', memory_count: 2 }] }, labels: { items: [] } } } } });
    }
    const m = p.match(/^\/memories\/(\d+)$/);
    if (m && req.method() === 'GET') return route.fulfill({ json: { status: 'success', data: { memory: detail(Number(m[1]) === 901 ? BRAND : PHOTO) } } });
    if (p === '/published-memories') {
      const which = url.searchParams.get('token') === 'brand-cover' ? 'brand' : 'photo';
      return route.fulfill({ json: { success: true, data: { memory: published[which], order_by: 'asc' } } });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  return { context, page };
}

const visibleCovers = (page) => page.locator('[data-cover-mode]').filter({ visible: true });
async function settle(page) { await page.waitForTimeout(1500); }

function checkBrand(tag, info) {
  expect(info?.mode === 'brand', `${tag}: shows the brand avatar treatment (mode=${info?.mode})`);
  if (!info?.img) return;
  const short = Math.min(info.box.width, info.box.height);
  expect(info.img.width <= Math.ceil(short * 0.6) + 1 && info.img.width === info.img.height,
    `${tag}: the avatar is a centred circle at most 60% of the box (${info.img.width}x${info.img.height} in ${info.box.width}x${info.box.height})`);
  expect(info.img.width <= info.img.natural * 1.5 + 1, `${tag}: never enlarged past 1.5x (${info.img.width} vs natural ${info.img.natural})`);
  expect(info.img.radius === '50%' || parseFloat(info.img.radius) >= info.img.width / 2 - 1, `${tag}: round (${info.img.radius})`);
}
function checkPhoto(tag, info) {
  expect(info?.mode === 'cover', `${tag}: a real photo stays full-bleed (mode=${info?.mode})`);
  if (info?.img) expect(info.img.fit === 'cover' && info.img.width === info.box.width, `${tag}: photo fills the box (${info.img.width} of ${info.box.width}, ${info.img.fit})`);
}

try {
  // 1600 too: at 1280 the campaign page's centre column (the header) is mostly behind the Media panel, as before.
  for (const [width, height] of [[1280, 900], [390, 844], [1600, 1000]]) {
    const tag = String(width);

    // 1. The campaign grid: the brand card and the photo card.
    {
      const { page, context } = await newPage({ width, height, signedIn: true });
      await page.goto(`${BASE}/memories`);
      const brandCard = page.getByRole('button', { name: 'View Next Summit / 25 campaign details' }).filter({ visible: true }).first();
      await brandCard.waitFor({ state: 'visible', timeout: 30000 });
      await settle(page);
      checkBrand(`${tag} card`, await coverInfo(brandCard.locator('[data-cover-mode]').first()));
      const photoCard = page.getByRole('button', { name: 'View Lakeside Launch campaign details' }).filter({ visible: true }).first();
      checkPhoto(`${tag} photo card`, await coverInfo(photoCard.locator('[data-cover-mode]').first()));
      await page.screenshot({ path: `${OUT}/${tag}-01-card-grid.png` });

      // 2. The brand campaign's page (the 8abfd1b2 case).
      await brandCard.click();
      await page.getByText('Moment 1').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
      await settle(page);
      const header = visibleCovers(page).first();
      checkBrand(`${tag} campaign page`, await coverInfo(header));
      expect(await page.getByText('Edit Cover').filter({ visible: true }).count() > 0, `${tag} campaign page: Edit Cover still there`);
      await page.screenshot({ path: `${OUT}/${tag}-02-campaign-page-brand.png` });
      await context.close();
    }

    // 3. A campaign page with a real photo cover.
    {
      const { page, context } = await newPage({ width, height, signedIn: true });
      await page.goto(`${BASE}/memories`);
      const photoCard = page.getByRole('button', { name: 'View Lakeside Launch campaign details' }).filter({ visible: true }).first();
      await photoCard.waitFor({ state: 'visible', timeout: 30000 });
      await settle(page);
      await photoCard.click();
      await page.getByText('Moment 1').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
      await settle(page);
      checkPhoto(`${tag} campaign page photo`, await coverInfo(visibleCovers(page).first()));
      await page.screenshot({ path: `${OUT}/${tag}-03-campaign-page-photo.png` });
      await context.close();
    }

    // 4. The published page: no cover → brand; with a photo → full-bleed.
    for (const [slug, kind] of [['brand-cover', 'brand'], ['photo-cover', 'photo']]) {
      const { page, context } = await newPage({ width, height, signedIn: false });
      await page.goto(`${BASE}/published-memory/${slug}`);
      await visibleCovers(page).first().waitFor({ state: 'visible', timeout: 30000 });
      await settle(page);
      const info = await coverInfo(visibleCovers(page).first());
      if (kind === 'brand') checkBrand(`${tag} published page`, info); else checkPhoto(`${tag} published page photo`, info);
      await page.screenshot({ path: `${OUT}/${tag}-0${kind === 'brand' ? 4 : 5}-published-${kind}.png` });
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
