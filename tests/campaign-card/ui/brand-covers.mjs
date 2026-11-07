// Chris, 7 Nov 2026 — brand covers and card covers, in the real app at 1280 and 390:
//  5.  a campaign with no cover shows the brand LOGO whole on ONE SOLID colour, the logo's primary colour (The Royal
//      Wood Shop's blue box → a blue cover; no blurred copy behind): campaign card, owner campaign page, published page,
//      the Storeel (Create Campaign) phone preview. A logo in our S3 bucket (no CORS) is read through the API
//      (GET /qr-codes/logo-image); a signed-out viewer can't read it and gets the 4 Nov look (graceful).
//  10. the owner's PHOTO avatar (a selfie) used as the brand now FILLS the card (it was drawn small and whole like a
//      logo — images/192.jpg "Toronto", "Joyful Summer…"); a chosen photo ("England") fills as before.
//  10b. a suggested campaign's "suggested" pill is a white pill like "12 moments", inside the card, never over the title.
// node tests/campaign-card/ui/brand-covers.mjs   (needs the dev server: CD_BASE, default http://localhost:5327)
// Every API call is answered here and every non-local request is answered or aborted: nothing leaves this machine.
// Screenshots: CD_SHOTS (default /private/tmp/claude-501/campaign-card-ui/brand-covers).
import { mkdirSync } from 'fs';
import sharp from 'sharp';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.CD_BASE || 'http://localhost:5327';
const OUT = process.env.CD_SHOTS || '/private/tmp/claude-501/campaign-card-ui/brand-covers';
mkdirSync(OUT, { recursive: true });

// ---- pictures (made here with sharp) ----
const ROYAL_BLUE = '#0062A8';
const ROYAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420">
  <rect width="600" height="420" fill="${ROYAL_BLUE}"/>
  <rect x="60" y="92" width="480" height="5" fill="#fff"/><rect x="60" y="104" width="480" height="3" fill="#fff"/>
  <text x="300" y="210" text-anchor="middle" font-family="Georgia, serif" font-size="78" font-weight="700" fill="#fff">THE ROYAL</text>
  <text x="300" y="300" text-anchor="middle" font-family="Georgia, serif" font-size="78" font-weight="700" fill="#fff">WOOD SHOP</text>
  <rect x="60" y="326" width="480" height="3" fill="#fff"/><rect x="60" y="334" width="480" height="5" fill="#fff"/>
</svg>`;
function selfieSvg(w = 480, h = 640) {
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let blobs = '';
  for (let i = 0; i < 260; i++) {
    blobs += `<circle cx="${(rnd() * w).toFixed(1)}" cy="${(rnd() * h * 0.7).toFixed(1)}" r="${(8 + rnd() * 50).toFixed(1)}" fill="hsl(${90 + Math.floor(rnd() * 60)},${20 + Math.floor(rnd() * 40)}%,${20 + Math.floor(rnd() * 50)}%)"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="#6f7f62"/>${blobs}
    <ellipse cx="${w * 0.34}" cy="${h * 0.42}" rx="${w * 0.16}" ry="${h * 0.15}" fill="#e2b393"/>
    <ellipse cx="${w * 0.7}" cy="${h * 0.47}" rx="${w * 0.14}" ry="${h * 0.13}" fill="#d6a384"/>
    <rect x="0" y="${h * 0.68}" width="${w * 0.55}" height="${h * 0.32}" fill="#9ec3e6"/>
    <rect x="${w * 0.55}" y="${h * 0.7}" width="${w * 0.45}" height="${h * 0.3}" fill="#27466e"/></svg>`;
}
const ENGLAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a90d9"/><stop offset="1" stop-color="#cfe6fb"/></linearGradient></defs>
  <rect width="1200" height="800" fill="url(#s)"/><circle cx="300" cy="200" r="60" fill="#fff" opacity="0.8"/>
  <polygon points="760,560 820,80 880,560" fill="#5b6b7c"/><rect x="0" y="520" width="1200" height="40" fill="#8a8f96"/>
  <rect x="0" y="560" width="1200" height="240" fill="#4b5a52"/><rect x="100" y="420" width="140" height="140" fill="#a07850"/></svg>`;
const pictures = {
  'royal.jpg': async () => sharp(Buffer.from(ROYAL_SVG)).jpeg({ quality: 85 }).toBuffer(),
  'selfie.jpg': async () => sharp(Buffer.from(selfieSvg())).jpeg({ quality: 80 }).toBuffer(),
  'england.jpg': async () => sharp(Buffer.from(ENGLAND_SVG)).jpeg({ quality: 80 }).toBuffer(),
  'moment.jpg': async () => sharp(Buffer.from(ENGLAND_SVG)).resize(900, 600).jpeg({ quality: 70 }).toBuffer(),
};
const bytes = new Map();
async function picture(name) {
  if (!bytes.has(name)) bytes.set(name, await (pictures[name] ?? pictures['moment.jpg'])());
  return bytes.get(name);
}

const img = (n) => `${BASE}/cd-img/${n}`;
const ROYAL = img('royal.jpg');
const SELFIE = img('selfie.jpg');
const S3_HOST = 'stasht-data.s3.us-east-2.amazonaws.com';
const S3_ROYAL = `https://${S3_HOST}/profile_images/royal-wood.jpg`;

const MAIN = { id: 70, external_user_id: 707, name: 'TheRoyalWoodShop', email: 'main@royal.test', role: '2', status: 1, is_activated: true, avatar: ROYAL, profile_image: ROYAL, profile_color: '#C08552' };
const owner = (avatar) => ({ id: 707, name: 'TheRoyalWoodShop', profile_image: avatar, profile_color: '#C08552' });
const SUGGESTED = { id: 9, name: 'suggested', color: '#80808000', badge_style: { hex_color: '#80808000' } };
const post = (id, n) => ({
  id, name: `Moment ${n}`, title: `Moment ${n}`, description: '', master_image_link: img('moment.jpg'), image_link: img('moment.jpg'), media_url: img('moment.jpg'),
  capture_date: `2026-10-1${n} 10:00:00`, uploaded_at: `2026-10-1${n} 10:00:00`, parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [],
});
const campaign = (id, title, cover, avatar, over = {}) => ({
  id, title, user_id: 707, published: 1, slug: `c-${id}`, category: { id: 5, name: 'Travel' },
  photos: { count: 12, preview_images: [{ id: id * 10 + 1, url: img('moment.jpg') }] },
  collaborators: [], user: owner(avatar), author: { name: 'TheRoyalWoodShop', avatar, profile_color: '#C08552' }, created_at: '2026-10-01 10:00:00',
  location: 'Toronto, ON', tags: [], last_update_img: cover, ...over,
});
const MILL = campaign(901, 'Around the Mill - Sale Items', null, ROYAL, { photos: { count: 0, preview_images: [] } });
const TORONTO = campaign(902, 'Toronto', null, SELFIE);
const ENGLAND = campaign(903, 'England', img('england.jpg'), SELFIE, { location: '' });
const SUMMER = campaign(904, 'Joyful Summer at the Lake House', null, SELFIE, { category: SUGGESTED, photos: { count: 3, preview_images: [] }, location: '' });
const DAY = campaign(905, 'Joyful Day at the Mill Pond', null, SELFIE, { category: SUGGESTED, photos: { count: 0, preview_images: [] }, location: '' });
const S3BRAND = campaign(906, 'Bucket Logo Sale', null, S3_ROYAL);
const ALL = [MILL, TORONTO, ENGLAND, SUMMER, DAY, S3BRAND];
// The list API sends last_update_img = cover ?? owner's profile image (MemoriesController::formatLatestMemory).
const listItem = (c) => ({ ...c, last_update_img: c.last_update_img ?? c.user.profile_image });
const detail = (c) => ({ ...c, posts: [post(c.id * 10 + 1, 1)], linked_memories: [], widgets: [], unified_order: null });
const published = { royal: detail(MILL), 's3-royal': detail(S3BRAND), selfie: detail(TORONTO) };

const failures = [];
const pageErrors = [];
const proxied = [];
const corsRequests = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const hex = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16));
const near = (a, b, tol = 16) => !!a && Math.hypot(...hex(a).map((v, i) => v - hex(b)[i])) <= tol;

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function newPage({ width, height, signedIn }) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user, signedIn]) => {
    if (sessionStorage.getItem('cd-seeded')) return;
    sessionStorage.setItem('cd-seeded', '1');
    localStorage.clear();
    // The colour the old pill took for "suggested" (synced from the API's see-through #80808000).
    localStorage.setItem('stasht_category_colors', JSON.stringify({ suggested: '#80808000' }));
    if (!signedIn) return;
    localStorage.setItem('stasht_token', 'main-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels');
  }, [MAIN, signedIn]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === S3_HOST) {
      // Our bucket: the picture, NOT readable cross-origin (as in production: no CORS headers). Playwright lets a
      // fulfilled response through CORS unless it names another origin, so it names one.
      corsRequests.push(req.headers()['sec-fetch-mode']);
      return route.fulfill({ body: await picture('royal.jpg'), contentType: 'image/jpeg', headers: { 'access-control-allow-origin': 'https://not-studio.example' } });
    }
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/cd-img/')) return route.fulfill({ body: await picture(url.pathname.slice('/cd-img/'.length)), contentType: 'image/jpeg' });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (p === '/qr-codes/logo-image') {
      const auth = req.headers().authorization || '';
      proxied.push(url.searchParams.get('url'));
      if (!auth.includes('main-token')) return route.fulfill({ status: 401, json: { message: 'Unauthenticated.' } });
      if (url.searchParams.get('url') !== S3_ROYAL) return route.fulfill({ status: 404, json: { message: 'not found' } });
      return route.fulfill({ body: await picture('royal.jpg'), contentType: 'image/jpeg' });
    }
    if (p === '/memories' && req.method() === 'GET') {
      const all = ALL.map(listItem);
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Travel', memory_count: 4 }, { id: 9, name: 'suggested', memory_count: 2 }] }, labels: { items: [] } } } } });
    }
    const m = p.match(/^\/memories\/(\d+)$/);
    if (m && req.method() === 'GET') {
      const c = ALL.find((x) => x.id === Number(m[1]));
      return route.fulfill({ json: { status: 'success', data: { memory: detail(c ?? MILL) } } });
    }
    if (p === '/published-memories') {
      return route.fulfill({ json: { success: true, data: { memory: published[url.searchParams.get('token')] ?? published.royal, order_by: 'asc' } } });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Business' } } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
  return { context, page };
}

const cardButton = (page, title) => page.getByRole('button', { name: `View ${title} campaign details` }).filter({ visible: true }).first();
async function cover(locator) {
  if ((await locator.count()) === 0) return null;
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const img = el.querySelector('img:not([aria-hidden="true"])');
    const ir = img ? img.getBoundingClientRect() : null;
    return {
      mode: el.getAttribute('data-cover-mode'), kind: el.getAttribute('data-brand-kind'), fill: el.getAttribute('data-cover-fill'),
      bg: getComputedStyle(el).backgroundColor, blurred: !!el.querySelector('img[aria-hidden="true"]'),
      box: { w: Math.round(r.width), h: Math.round(r.height) },
      img: ir ? { w: Math.round(ir.width), h: Math.round(ir.height), fit: getComputedStyle(img).objectFit, filter: getComputedStyle(img).filter, opacity: getComputedStyle(img).opacity } : null,
    };
  });
}
const rgbHex = (rgb) => { const m = String(rgb).match(/\d+/g); return m ? '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase() : null; };
function checkSolidLogo(tag, info) {
  expect(info?.mode === 'brand' && info?.kind === 'logo', `${tag}: the logo, drawn whole (mode=${info?.mode}, kind=${info?.kind})`);
  expect(near(info?.fill, ROYAL_BLUE) && near(rgbHex(info?.bg), ROYAL_BLUE), `${tag}: ONE solid colour = the logo's blue (fill=${info?.fill}, bg=${rgbHex(info?.bg)})`);
  expect(info && !info.blurred, `${tag}: no blurred copy behind it`);
  if (info?.img) expect(info.img.fit === 'contain' && info.img.w < info.box.w && Math.abs(info.img.w / info.img.h - 600 / 420) < 0.05, `${tag}: logo whole at its own shape, never stretched (${info.img.w}x${info.img.h} in ${info.box.w}x${info.box.h})`);
}
function checkFills(tag, info) {
  expect(info?.mode === 'cover', `${tag}: the photo fills the card (mode=${info?.mode}, kind=${info?.kind})`);
  if (info?.img) expect(info.img.fit === 'cover' && info.img.w === info.box.w && info.img.h === info.box.h && info.img.opacity === '1', `${tag}: edge to edge (${info.img.w}x${info.img.h} of ${info.box.w}x${info.box.h}, ${info.img.fit})`);
}
async function inViewport(page, locator, label) {
  const box = await locator.boundingBox();
  const vp = page.viewportSize();
  expect(!!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 0.5 && box.y + box.height <= vp.height + 0.5, `${label} is in the viewport (${box ? `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}` : 'none'})`);
}

try {
  for (const [width, height] of [[1280, 900], [390, 844], [1600, 1000]]) {
    const tag = String(width);

    // 1. The campaigns grid.
    {
      const { page, context } = await newPage({ width, height, signedIn: true });
      await page.goto(`${BASE}/memories`);
      await cardButton(page, 'Toronto').waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForTimeout(2500);
      checkSolidLogo(`${tag} card Royal Wood logo`, await cover(cardButton(page, 'Around the Mill - Sale Items').locator('[data-cover-mode]').first()));
      checkFills(`${tag} card Toronto (selfie avatar as brand)`, await cover(cardButton(page, 'Toronto').locator('[data-cover-mode]').first()));
      checkFills(`${tag} card England (chosen photo)`, await cover(cardButton(page, 'England').locator('[data-cover-mode]').first()));
      checkFills(`${tag} card Joyful Summer (suggested, selfie)`, await cover(cardButton(page, 'Joyful Summer at the Lake House').locator('[data-cover-mode]').first()));
      checkSolidLogo(`${tag} card logo in our S3 bucket (read through the API)`, await cover(cardButton(page, 'Bucket Logo Sale').locator('[data-cover-mode]').first()));
      expect(proxied.includes(S3_ROYAL), `${tag}: the S3 logo was read through GET /qr-codes/logo-image`);

      for (const title of ['Joyful Summer at the Lake House', 'Joyful Day at the Mill Pond']) {
        const card = cardButton(page, title);
        await card.scrollIntoViewIfNeeded();
        const pill = card.getByTestId('memory-card-suggested');
        expect((await pill.count()) === 1 && (await pill.textContent()) === 'Suggested', `${tag} ${title}: a "Suggested" pill`);
        const geo = await card.evaluate((el) => {
          const photo = el.querySelector('.aspect-square, [class*="aspect-"]').getBoundingClientRect();
          const pill = el.querySelector('[data-testid="memory-card-suggested"]');
          const p = pill.getBoundingClientRect();
          const t = el.querySelector('h3').getBoundingClientRect();
          const pubEl = el.querySelector('.absolute.top-3.left-3');
          const pb = pubEl ? pubEl.getBoundingClientRect() : null;
          return {
            pub: pb ? [pb.left, pb.top, pb.right, pb.bottom] : null, photo: [photo.left, photo.top, photo.right, photo.bottom], pill: [p.left, p.top, p.right, p.bottom], title: [t.left, t.top, t.right, t.bottom], bg: getComputedStyle(pill).backgroundColor, color: getComputedStyle(pill).color };
        });
        const [pl, pt, pr, pb] = geo.pill;
        const inside = pl >= geo.photo[0] && pt >= geo.photo[1] && pr <= geo.photo[2] && pb <= geo.photo[3];
        const overlaps = !(pr <= geo.title[0] || pl >= geo.title[2] || pb <= geo.title[1] || pt >= geo.title[3]);
        expect(inside, `${tag} ${title}: pill inside the card (${geo.pill.map(Math.round)} in ${geo.photo.map(Math.round)})`);
        expect(!overlaps, `${tag} ${title}: pill clear of the title (pill ${geo.pill.map(Math.round)}, title ${geo.title.map(Math.round)})`);
        const hitsPublic = !!geo.pub && !(pr <= geo.pub[0] || pl >= geo.pub[2] || pb <= geo.pub[1] || pt >= geo.pub[3]);
        expect(!hitsPublic, `${tag} ${title}: pill clear of the Public badge (pill ${geo.pill.map(Math.round)}, badge ${geo.pub?.map(Math.round)})`);
        expect(geo.bg === 'rgb(255, 255, 255)' && geo.color !== 'rgb(255, 255, 255)', `${tag} ${title}: white pill, dark text (${geo.bg} / ${geo.color})`);
        await inViewport(page, pill, `${tag} ${title} pill`);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await cardButton(page, 'Around the Mill - Sale Items').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/${tag}-01-grid.png`, fullPage: width < 1024 });
      await cardButton(page, 'Joyful Summer at the Lake House').scrollIntoViewIfNeeded();
      await cardButton(page, 'Joyful Summer at the Lake House').screenshot({ path: `${OUT}/${tag}-01b-suggested-card.png` });

      // 2. The owner campaign page with the brand logo.
      await cardButton(page, 'Around the Mill - Sale Items').click();
      await page.getByText('Moment 1').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const pageCover = page.locator('[data-cover-mode]').filter({ visible: true }).first();
      checkSolidLogo(`${tag} owner campaign page`, await cover(pageCover));
      await page.screenshot({ path: `${OUT}/${tag}-02-owner-page.png` });
      await context.close();
    }

    // 3. The Storeel (Create Campaign) phone preview: no cover chosen → the account's logo on its blue.
    {
      const { page, context } = await newPage({ width, height, signedIn: true });
      await page.goto(`${BASE}/memories`);
      await cardButton(page, 'Toronto').waitFor({ state: 'visible', timeout: 30000 });
      await page.getByRole('button', { name: /^Create( a Campaign)?$/ }).filter({ visible: true }).last().click();
      const create = page.getByRole('dialog', { name: 'Create Campaign' });
      await create.waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(2000);
      const preview = create.getByTestId('storeel-preview');
      if (await preview.count()) {
        await preview.scrollIntoViewIfNeeded();
        const pc = preview.locator('[data-cover-mode]').first();
        checkSolidLogo(`${tag} Storeel preview`, await cover(pc));
        await inViewport(page, pc.locator('img').first(), `${tag} Storeel preview logo`);
        await preview.screenshot({ path: `${OUT}/${tag}-03-storeel-preview.png` });
      } else {
        expect(false, `${tag}: the Storeel preview is on the page`);
      }
      await page.screenshot({ path: `${OUT}/${tag}-03b-create-page.png` });
      await context.close();
    }

    // 4. Published pages, signed out.
    for (const [slug, n] of [['royal', '04'], ['selfie', '05'], ['s3-royal', '06']]) {
      const { page, context } = await newPage({ width, height, signedIn: false });
      await page.goto(`${BASE}/published-memory/${slug}`);
      const pc = page.locator('[data-cover-mode]').filter({ visible: true }).first();
      await pc.waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForTimeout(3500);
      const info = await cover(pc);
      if (slug === 'royal') checkSolidLogo(`${tag} published page (logo)`, info);
      else if (slug === 'selfie') checkFills(`${tag} published page (selfie avatar)`, info);
      else {
        // Signed out, the bucket's logo can't be read: the 4 Nov look, the logo still whole and visible.
        expect(info?.mode === 'brand' && !info?.kind && info?.img?.opacity === '1', `${tag} published page (S3 logo, signed out): falls back to the 4 Nov look (mode=${info?.mode}, kind=${info?.kind}, blurred=${info?.blurred})`);
      }
      await page.screenshot({ path: `${OUT}/${tag}-${n}-published-${slug}.png` });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall brand cover checks passed');
process.exit(failures.length ? 1 : 0);
