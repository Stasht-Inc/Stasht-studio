// Chris, 7 Nov 2026 — brand covers and card covers (+ review rework: the web API judges each brand picture once), in the
// real app at 1280, 390 and 1600:
//  5.  a campaign with no cover shows the brand LOGO whole on ONE SOLID colour from the logo (The Royal Wood Shop's blue
//      box → a blue cover; no blurred copy): campaign cards, owner page, published page — SIGNED OUT too, an S3 logo
//      included (the answer comes on the payload as `brand_pictures`) — and the Storeel phone preview (asked once via
//      GET /brand-pictures, all unknown covers in one call, then remembered: no switch on the next visit). A square logo is never cut to a circle; a
//      logo on white is a rounded card. No answer: the 4 Nov look, painted at once (no hidden wait).
//  10. the owner's PHOTO avatar (a selfie) used as the brand FILLS the card / page; a chosen photo fills as before.
//  10b. a suggested campaign's "Suggested" pill: white like "12 moments", inside the card, never over the title or the
//      Public badge.
// node tests/campaign-card/ui/brand-covers.mjs   (needs the dev server: CD_BASE, default http://localhost:5327; Playwright:
// `playwright-core` if installed, else PLAYWRIGHT_CORE=/path/to/playwright-core/index.js)
// Every API call is answered here and every non-local request is answered or aborted: nothing leaves this machine.
// Screenshots: CD_SHOTS (default /private/tmp/claude-501/campaign-card-ui/brand-covers).
import { mkdirSync } from 'fs';
import sharp from 'sharp';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const pw = await import('playwright-core').catch(() => import(process.env.PLAYWRIGHT_CORE
  || '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js'));
const { chromium } = pw.default ?? pw;
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
const HEX_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#0B1442"/>
  <polygon points="128,28 214,78 214,178 128,228 42,178 42,78" fill="#1D4ED8"/><polygon points="128,62 184,94 184,162 128,194 72,162 72,94" fill="#0B1442"/></svg>`;
const GREEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300"><rect width="500" height="300" fill="#fff"/>
  <text x="250" y="190" text-anchor="middle" font-family="Arial" font-size="110" font-weight="700" fill="#15803D">GREEN</text></svg>`;
// A realtor headshot on a plain white studio wall, and a JPEG wordmark on white: the API is unsure about both → "whole".
const WALL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="600"><rect width="480" height="600" fill="#F5F5F2"/>
  <ellipse cx="240" cy="250" rx="95" ry="120" fill="#d9a882"/><ellipse cx="240" cy="160" rx="105" ry="55" fill="#2f2622"/>
  <path d="M60 600 Q90 420 240 400 Q390 420 420 600 Z" fill="#2b3f5c"/><ellipse cx="205" cy="245" rx="11" ry="7" fill="#2b2020"/><ellipse cx="275" cy="245" rx="11" ry="7" fill="#2b2020"/></svg>`;
const DOCU_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="600" height="200" fill="#fff"/>
  <rect x="30" y="60" width="60" height="60" fill="#E2231A"/><rect x="50" y="80" width="60" height="60" fill="#4C00FF" opacity="0.85"/>
  <text x="130" y="128" font-family="Arial" font-size="78" font-weight="700" fill="#111">docuseal</text></svg>`;
// Chris's 193.jpg: the Stasht "S" avatar — a purple S on a light-to-darker grey vertical gradient (square JPEG).
const STASHT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#DCDCDC"/><stop offset="1" stop-color="#9A9A9A"/></linearGradient></defs><rect width="512" height="512" fill="url(#g)"/>
  <text x="256" y="350" text-anchor="middle" font-family="Arial Black, Arial" font-size="300" font-weight="900" fill="#554AC8">S</text>
  <rect x="120" y="380" width="272" height="12" rx="6" fill="#554AC8"/></svg>`;
// A one-colour transparent wordmark.
const ACME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="240"><text x="400" y="170" text-anchor="middle" font-family="Arial" font-size="160" font-weight="800" fill="#1D4ED8">ACME</text></svg>`;
const pictures = {
  'royal.jpg': async () => sharp(Buffer.from(ROYAL_SVG)).jpeg({ quality: 85 }).toBuffer(),
  'selfie.jpg': async () => sharp(Buffer.from(selfieSvg())).jpeg({ quality: 80 }).toBuffer(),
  'england.jpg': async () => sharp(Buffer.from(ENGLAND_SVG)).jpeg({ quality: 80 }).toBuffer(),
  'moment.jpg': async () => sharp(Buffer.from(ENGLAND_SVG)).resize(900, 600).jpeg({ quality: 70 }).toBuffer(),
  'hexagon.png': async () => sharp(Buffer.from(HEX_SVG)).png().toBuffer(),
  'green.jpg': async () => sharp(Buffer.from(GREEN_SVG)).jpeg({ quality: 80 }).toBuffer(),
  'wall.jpg': async () => sharp(Buffer.from(WALL_SVG)).blur(1.5).jpeg({ quality: 82 }).toBuffer(),
  'docu.jpg': async () => sharp(Buffer.from(DOCU_SVG)).jpeg({ quality: 85 }).toBuffer(),
  'stasht.jpg': async () => sharp(Buffer.from(STASHT_SVG)).jpeg({ quality: 90 }).toBuffer(),
  'acme.png': async () => sharp(Buffer.from(ACME_SVG)).png().toBuffer(),
};
const bytes = new Map();
async function picture(name) {
  if (!bytes.has(name)) bytes.set(name, await (pictures[name] ?? pictures['moment.jpg'])());
  return bytes.get(name);
}

const img = (n) => `${BASE}/cd-img/${n}`;

const ROYAL = img('royal.jpg');
const SELFIE = img('selfie.jpg');
const HEX = img('hexagon.png');
const GREEN = img('green.jpg');
const WALL = img('wall.jpg');
const DOCU = img('docu.jpg');
const STASHT = img('stasht.jpg');
const ACME = img('acme.png');
const S3_HOST = 'stasht-data.s3.us-east-2.amazonaws.com';
const s3 = (k) => `https://${S3_HOST}/profile_images/${k}`;
const S3_ROYAL = s3('royal-wood.jpg');
const S3_SELFIE = s3('selfie.jpg');
const S3_MAIN = s3('account-logo.jpg');
const S3_UNKNOWN = s3('not-judged-yet.jpg');
const S3_FILES = { 'royal-wood.jpg': 'royal.jpg', 'selfie.jpg': 'selfie.jpg', 'account-logo.jpg': 'royal.jpg', 'not-judged-yet.jpg': 'royal.jpg' };

// What the web API's BrandPictures answers for each picture (tests/Unit/BrandPictures there checks the judging itself).
const LOGO_BLUE = { kind: 'logo', color: ROYAL_BLUE, frame: false, gradient: null };
const ANSWERS = {
  [ROYAL]: LOGO_BLUE, [S3_ROYAL]: LOGO_BLUE, [S3_MAIN]: LOGO_BLUE,
  [SELFIE]: { kind: 'photo', color: '#6F7F62', frame: false }, [S3_SELFIE]: { kind: 'photo', color: '#6F7F62', frame: false },
  [HEX]: { kind: 'logo', color: '#0B1442', frame: false },
  // Chris point 11: a logo on white sits on white (the image's own background) — seamless, no card.
  [GREEN]: { kind: 'logo', color: '#FFFFFF', frame: false, gradient: null },
  [STASHT]: { kind: 'logo', color: '#BBBBBB', frame: false, gradient: ['#DCDCDC', '#9A9A9A'] },
  [ACME]: { kind: 'logo', color: '#D6DFF8', frame: false, gradient: null },
  [WALL]: { kind: 'whole', color: '#F5F5F2', frame: false },
  [DOCU]: { kind: 'whole', color: '#FFFFFF', frame: false },
};
/** brand_pictures as AttachBrandPictures adds it: the known answers for the avatars in the payload. */
function withBrandPictures(body) {
  const urls = new Set();
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if ((k === 'avatar' || k === 'profile_image') && typeof x === 'string') urls.add(x); else walk(x); } };
  walk(body);
  const map = {};
  for (const u of urls) if (ANSWERS[u]) map[u] = ANSWERS[u];
  return Object.keys(map).length ? { ...body, brand_pictures: map } : body;
}

const MAIN = { id: 70, external_user_id: 707, name: 'TheRoyalWoodShop', email: 'main@royal.test', role: '2', status: 1, is_activated: true, avatar: S3_MAIN, profile_image: S3_MAIN, profile_color: '#C08552' };
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
const HEXC = campaign(907, 'Hex Motors', null, HEX);
const GREENC = campaign(908, 'Green Grocer', null, GREEN);
const WALLC = campaign(911, 'Open House Weekend', null, WALL);
const DOCUC = campaign(912, 'Signing Day', null, DOCU);
const STASHTC = campaign(913, 'Stasht Studio Launch', null, STASHT, { photos: { count: 0, preview_images: [] } });
const ACMEC = campaign(914, 'Acme Spring Sale', null, ACME);
const ALL = [MILL, TORONTO, ENGLAND, SUMMER, DAY, S3BRAND, HEXC, GREENC, WALLC, DOCUC, STASHTC, ACMEC];
const listItem = (c) => ({ ...c, last_update_img: c.last_update_img ?? c.user.profile_image });
const detail = (c) => ({ ...c, posts: [post(c.id * 10 + 1, 1)], linked_memories: [], widgets: [], unified_order: null });
const published = {
  royal: detail(MILL), selfie: detail(TORONTO),
  's3-royal': detail(S3BRAND), 's3-selfie': detail(campaign(909, 'Selfie From The Bucket', null, S3_SELFIE)),
  unknown: detail(campaign(910, 'Not Judged Yet', null, S3_UNKNOWN)),
  wall: detail(WALLC),
  stasht: detail(STASHTC),
};

const failures = [];
const pageErrors = [];
const asked = [];
const batches = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const hex = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16));
const near = (a, b, tol = 2) => !!a && Math.hypot(...hex(a).map((v, i) => v - hex(b)[i])) <= tol;

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function newContext({ width, height, signedIn }) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  // Generous: the dev server compiles on first request, and the machine may be busy.
  context.setDefaultNavigationTimeout(180000);
  context.setDefaultTimeout(90000);
  await context.addInitScript(([user, signedIn]) => {
    if (sessionStorage.getItem('cd-seeded')) return;
    sessionStorage.setItem('cd-seeded', '1');
    if (localStorage.getItem('cd-keep')) return;
    localStorage.clear();
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
      const file = S3_FILES[url.pathname.split('/').pop()] ?? 'royal.jpg';
      return route.fulfill({ body: await picture(file), contentType: 'image/jpeg' }); // no CORS: the browser never reads it
    }
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/cd-img/')) return route.fulfill({ body: await picture(url.pathname.slice('/cd-img/'.length)), contentType: url.pathname.endsWith('.png') ? 'image/png' : 'image/jpeg' });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (p === '/qr-codes/logo-image') { failures.push('the browser must not fetch picture bytes any more'); return route.fulfill({ status: 404, json: {} }); }
    if (p === '/brand-pictures') {
      // GET /brand-pictures?urls[]= (one call per page): cached answers; the rest "pending" (worked out after the response).
      const urls = url.searchParams.getAll('urls[]');
      asked.push(...urls);
      batches.push(urls);
      const data = {};
      for (const u of urls) if (ANSWERS[u]) data[u] = ANSWERS[u];
      return route.fulfill({ json: { success: true, data, pending: urls.filter((u) => !ANSWERS[u]).length } });
    }
    if (p === '/memories' && req.method() === 'GET') {
      const all = ALL.map(listItem);
      return route.fulfill({ json: withBrandPictures({ status: 'success', data: { all_memories: { data: all, total: all.length }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Travel', memory_count: 10 }, { id: 9, name: 'suggested', memory_count: 2 }] }, labels: { items: [] } } } }) });
    }
    const m = p.match(/^\/memories\/(\d+)$/);
    if (m && req.method() === 'GET') {
      const c = ALL.find((x) => x.id === Number(m[1]));
      return route.fulfill({ json: withBrandPictures({ status: 'success', data: { memory: detail(c ?? MILL) } }) });
    }
    if (p === '/published-memories') {
      return route.fulfill({ json: withBrandPictures({ success: true, data: { memory: published[url.searchParams.get('token')] ?? published.royal, order_by: 'asc' } }) });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Business' } } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  return context;
}
async function newPage(opts) {
  const context = await newContext(opts);
  const page = await context.newPage();
  if (process.env.CV_DEBUG) page.on('console', (m) => { const t = m.text(); if (/Maximum update|error|Error/.test(t)) console.log('CONSOLE', m.type(), t.slice(0, 300)); });
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
      mode: el.getAttribute('data-cover-mode'), shape: el.getAttribute('data-cover-shape'), kind: el.getAttribute('data-brand-kind'),
      fill: el.getAttribute('data-cover-fill'), gradient: el.getAttribute('data-cover-gradient'), bgImage: getComputedStyle(el).backgroundImage,
      bg: getComputedStyle(el).backgroundColor, blurred: !!el.querySelector('img[aria-hidden="true"]'),
      box: { w: Math.round(r.width), h: Math.round(r.height) },
      img: ir ? { w: Math.round(ir.width), h: Math.round(ir.height), fit: getComputedStyle(img).objectFit, radius: getComputedStyle(img).borderRadius, shadow: getComputedStyle(img).boxShadow, filter: getComputedStyle(img).filter, opacity: getComputedStyle(img).opacity } : null,
    };
  });
}
const rgbHex = (rgb) => { const m = String(rgb).match(/\d+/g); return m ? '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase() : null; };
function checkSolidLogo(tag, info, { color = ROYAL_BLUE, aspect = 600 / 420, gradient = null } = {}) {
  expect(info?.mode === 'brand' && info?.kind === 'logo' && info?.shape === 'rect', `${tag}: the logo, drawn whole, not cut round (mode=${info?.mode}, kind=${info?.kind}, shape=${info?.shape})`);
  if (gradient) {
    expect(info?.gradient === gradient.join(' ') && /linear-gradient/.test(info?.bgImage || ''), `${tag}: its own gradient background around it (${info?.gradient}; ${String(info?.bgImage).slice(0, 80)})`);
  } else {
    expect(near(info?.fill, color) && near(rgbHex(info?.bg), color), `${tag}: ONE solid colour, the logo's own background (fill=${info?.fill}, bg=${rgbHex(info?.bg)})`);
  }
  expect(info && !info.blurred, `${tag}: no blurred copy behind it`);
  if (info?.img) {
    expect(info.img.fit === 'contain' && info.img.w < info.box.w && Math.abs(info.img.w / info.img.h - aspect) < 0.08 && info.img.opacity === '1', `${tag}: logo whole at its own shape, never stretched (${info.img.w}x${info.img.h} in ${info.box.w}x${info.box.h})`);
    expect(info.img.radius === '0px' && info.img.shadow === 'none' && info.img.filter === 'none', `${tag}: seamless — no ring, card, radius or shadow`);
  }
}
/** The cover's pixels just outside / inside the logo's left and right edges, at the same height (the callers'
 *  overlays are the same there): alike when seamless. */
async function edgeSeam(page, coverLoc) {
  const pts = await coverLoc.evaluate((el) => {
    const r = el.querySelector('img:not([aria-hidden="true"])').getBoundingClientRect();
    const y = r.top + r.height / 2;
    return [[r.left - 3, y], [r.left + 3, y], [r.right - 4, y], [r.right + 2, y]];
  });
  const px = [];
  for (const [x, y] of pts) {
    const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
    const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    px.push([data[0], data[1], data[2]]);
  }
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  return { top: d(px[0], px[1]), side: d(px[2], px[3]), px }; // top: the left edge, side: the right edge
}
function checkWhole(tag, info, { color, aspect }) {
  expect(info?.mode === 'brand' && info?.kind === 'whole' && info?.shape === 'rect', `${tag}: drawn whole, never cut round (mode=${info?.mode}, kind=${info?.kind}, shape=${info?.shape})`);
  expect(near(info?.fill, color) && near(rgbHex(info?.bg), color), `${tag}: on its edge colour (fill=${info?.fill}, bg=${rgbHex(info?.bg)})`);
  expect(info && !info.blurred, `${tag}: no blurred copy`);
  if (info?.img) {
    const fullHeight = Math.abs(info.img.h - info.box.h) <= 1;
    const maxWide = Math.abs(info.img.w - Math.round(info.box.w * 0.9)) <= 1;
    expect((fullHeight && info.img.w <= Math.round(info.box.w * 0.9) + 1) || (maxWide && info.img.h <= info.box.h), `${tag}: full height, at most 90% wide (${info.img.w}x${info.img.h} in ${info.box.w}x${info.box.h})`);
    expect(Math.abs(info.img.w / info.img.h - aspect) < 0.03, `${tag}: its own shape (${info.img.w}x${info.img.h})`);
    expect(info.img.radius === '0px' && info.img.shadow === 'none' && info.img.filter === 'none' && info.img.opacity === '1', `${tag}: a plain rectangle (no ring, radius or shadow)`);
  }
}
/** White text's contrast against what is behind the title (sampled just left of it, at its middle). */
async function titleContrast(page, root, titleSel) {
  const at = await root.evaluate((el, sel) => {
    const node = [...el.querySelectorAll(sel)].find((n) => n.getBoundingClientRect().width > 0);
    if (!node) return null;
    const t = node.getBoundingClientRect();
    return { x: Math.max(0, t.left - 6), y: t.top + t.height / 2 };
  }, titleSel);
  if (!at) return null;
  const png = await page.screenshot({ clip: { x: at.x, y: at.y, width: 1, height: 1 } });
  const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const lin = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * lin(data[0]) + 0.7152 * lin(data[1]) + 0.0722 * lin(data[2]);
  return { ratio: 1.05 / (lum + 0.05), rgb: [data[0], data[1], data[2]] };
}
function checkFills(tag, info) {
  expect(info?.mode === 'cover', `${tag}: the photo fills it (mode=${info?.mode}, kind=${info?.kind})`);
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

    // 1. The campaigns grid: every answer is on the /memories payload — nothing asked separately.
    {
      asked.length = 0;
      const { page, context } = await newPage({ width, height, signedIn: true });
      await page.goto(`${BASE}/memories`);
      await cardButton(page, 'Toronto').waitFor({ state: 'visible', timeout: 120000 });
      await page.waitForTimeout(1500);
      checkSolidLogo(`${tag} card Royal Wood logo`, await cover(cardButton(page, 'Around the Mill - Sale Items').locator('[data-cover-mode]').first()));
      checkFills(`${tag} card Toronto (selfie avatar as brand)`, await cover(cardButton(page, 'Toronto').locator('[data-cover-mode]').first()));
      checkFills(`${tag} card England (chosen photo)`, await cover(cardButton(page, 'England').locator('[data-cover-mode]').first()));
      checkFills(`${tag} card Joyful Summer (suggested, selfie)`, await cover(cardButton(page, 'Joyful Summer at the Lake House').locator('[data-cover-mode]').first()));
      checkSolidLogo(`${tag} card S3 logo`, await cover(cardButton(page, 'Bucket Logo Sale').locator('[data-cover-mode]').first()));
      checkSolidLogo(`${tag} card square logo (never a circle)`, await cover(cardButton(page, 'Hex Motors').locator('[data-cover-mode]').first()), { color: '#0B1442', aspect: 1 });
      checkSolidLogo(`${tag} card logo on white (seamless on white)`, await cover(cardButton(page, 'Green Grocer').locator('[data-cover-mode]').first()), { color: '#FFFFFF', aspect: 500 / 300 });
      checkSolidLogo(`${tag} card Stasht S badge (gradient)`, await cover(cardButton(page, 'Stasht Studio Launch').locator('[data-cover-mode]').first()), { aspect: 1, gradient: ['#DCDCDC', '#9A9A9A'] });
      checkSolidLogo(`${tag} card transparent wordmark`, await cover(cardButton(page, 'Acme Spring Sale').locator('[data-cover-mode]').first()), { color: '#D6DFF8', aspect: 800 / 240 });
      for (const title of ['Green Grocer', 'Stasht Studio Launch', 'Around the Mill - Sale Items']) {
        const loc = cardButton(page, title).locator('[data-cover-mode]').first();
        await loc.scrollIntoViewIfNeeded();
        const seam = await edgeSeam(page, loc);
        expect(seam.top <= 12 && seam.side <= 12, `${tag} ${title}: seamless edges (left Δ${seam.top.toFixed(1)}, right Δ${seam.side.toFixed(1)}; ${JSON.stringify(seam.px)})`);
      }
      checkWhole(`${tag} card white-wall headshot (unsure → whole)`, await cover(cardButton(page, 'Open House Weekend').locator('[data-cover-mode]').first()), { color: '#F5F5F2', aspect: 480 / 600 });
      checkWhole(`${tag} card JPEG logo (unsure → whole)`, await cover(cardButton(page, 'Signing Day').locator('[data-cover-mode]').first()), { color: '#FFFFFF', aspect: 3 });
      // Light fills: the white title must read (>= 4.5:1 against what is behind it).
      for (const title of ['Signing Day', 'Open House Weekend']) {
        const card = cardButton(page, title);
        await card.scrollIntoViewIfNeeded();
        const c = await titleContrast(page, card, 'h3');
        expect(c.ratio >= 4.5, `${tag} ${title}: white title contrast ${c.ratio.toFixed(2)}:1 on rgb(${c.rgb})`);
      }
      expect(asked.length === 0, `${tag}: the grid asked nothing separately (${asked.length} asks)`);

      for (const title of ['Joyful Summer at the Lake House', 'Joyful Day at the Mill Pond']) {
        const card = cardButton(page, title);
        await card.scrollIntoViewIfNeeded();
        const pill = card.getByTestId('memory-card-suggested');
        expect((await pill.count()) === 1 && (await pill.textContent()) === 'Suggested', `${tag} ${title}: a "Suggested" pill`);
        const geo = await card.evaluate((el) => {
          const box = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
          const pubEl = el.querySelector('.absolute.top-3.left-3');
          const pillEl = el.querySelector('[data-testid="memory-card-suggested"]');
          return { photo: box(el.querySelector('[class*="aspect-"]')), pill: box(pillEl), title: box(el.querySelector('h3')), pub: pubEl ? box(pubEl) : null, bg: getComputedStyle(pillEl).backgroundColor, color: getComputedStyle(pillEl).color };
        });
        const [pl, pt, pr, pb] = geo.pill;
        const hits = (o) => !!o && !(pr <= o[0] || pl >= o[2] || pb <= o[1] || pt >= o[3]);
        expect(pl >= geo.photo[0] && pt >= geo.photo[1] && pr <= geo.photo[2] && pb <= geo.photo[3], `${tag} ${title}: pill inside the card`);
        expect(!hits(geo.title), `${tag} ${title}: pill clear of the title`);
        expect(!hits(geo.pub), `${tag} ${title}: pill clear of the Public badge`);
        expect(geo.bg === 'rgb(255, 255, 255)' && geo.color !== 'rgb(255, 255, 255)', `${tag} ${title}: white pill, dark text`);
        await inViewport(page, pill, `${tag} ${title} pill`);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/${tag}-01-grid.png`, fullPage: width < 1024 });
      await cardButton(page, 'Joyful Summer at the Lake House').screenshot({ path: `${OUT}/${tag}-01b-suggested-card.png` });
      for (const [title, file] of [['Open House Weekend', '01c-whole-headshot-card'], ['Signing Day', '01d-whole-jpeg-logo-card'], ['Around the Mill - Sale Items', '01e-logo-card'], ['Stasht Studio Launch', '01f-stasht-badge-card'], ['Green Grocer', '01g-logo-on-white-card'], ['Acme Spring Sale', '01h-transparent-logo-card']]) {
        await cardButton(page, title).scrollIntoViewIfNeeded();
        await cardButton(page, title).screenshot({ path: `${OUT}/${tag}-${file}.png` });
      }

      // 2. The owner campaign page.
      await cardButton(page, 'Around the Mill - Sale Items').click();
      await page.getByText('Moment 1').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1200);
      checkSolidLogo(`${tag} owner campaign page`, await cover(page.locator('[data-cover-mode]').filter({ visible: true }).first()));
      await page.screenshot({ path: `${OUT}/${tag}-02-owner-page.png` });
      await context.close();
    }

    // 3. The Storeel (Create Campaign) preview: the account's S3 logo isn't on any payload → asked once; the next
    //    visit paints it at once (localStorage), without asking.
    {
      asked.length = 0;
      const context = await newContext({ width, height, signedIn: true });
      for (const visit of [1, 2]) {
        const page = await context.newPage();
        await page.goto(`${BASE}/memories`);
        await cardButton(page, 'Toronto').waitFor({ state: 'visible', timeout: 120000 });
        await page.getByRole('button', { name: /^Create( a Campaign)?$/ }).filter({ visible: true }).last().click();
        const create = page.getByRole('dialog', { name: 'Create Campaign' });
        await create.waitFor({ state: 'visible', timeout: 15000 });
        const preview = create.getByTestId('storeel-preview');
        await preview.scrollIntoViewIfNeeded();
        const pc = preview.locator('[data-cover-mode]').first();
        if (visit === 2) {
          // first paint: already the answer (no switch on a later visit)
          await pc.waitFor({ state: 'attached', timeout: 10000 });
          const first = await cover(pc);
          expect(first?.kind === 'logo', `${tag} Storeel preview, next visit: right look at first paint (kind=${first?.kind})`);
        }
        await page.waitForTimeout(1500);
        checkSolidLogo(`${tag} Storeel preview (visit ${visit})`, await cover(pc));
        await inViewport(page, pc.locator('img').first(), `${tag} Storeel preview logo`);
        if (visit === 1) {
          await preview.screenshot({ path: `${OUT}/${tag}-03-storeel-preview.png` });
          await page.evaluate(() => localStorage.setItem('cd-keep', '1')); // the next visit keeps this browser's storage
        }
        await page.close();
      }
      const asks = asked.filter((u) => u === S3_MAIN).length;
      expect(asks === 1, `${tag}: the account logo was asked about once over two visits (${asks})`);
      await context.close();
    }

    // 4. Published pages, SIGNED OUT: the answers come on the payload — S3 pictures included.
    for (const [slug, n] of [['royal', '04'], ['selfie', '05'], ['s3-royal', '06'], ['s3-selfie', '07'], ['unknown', '08'], ['wall', '09'], ['stasht', '10']]) {
      const { page, context } = await newPage({ width, height, signedIn: false });
      const t0 = Date.now();
      await page.goto(`${BASE}/published-memory/${slug}`);
      const pc = page.locator('[data-cover-mode]').filter({ visible: true }).first();
      await pc.waitFor({ state: 'visible', timeout: 120000 });
      if (slug === 'unknown') {
        // not judged yet: the 4 Nov look, painted at once (no hidden wait)
        const info = await cover(pc);
        expect(info?.mode === 'brand' && !info?.kind && info?.img?.opacity === '1' && info?.shape === 'rect' && !info?.blurred && info?.img?.radius === '0px' && info?.img?.shadow === 'none',
          `${tag} published page (not judged yet): drawn whole and plain straight away — no circle, ring or blur (mode=${info?.mode}, shape=${info?.shape}, blurred=${info?.blurred}, ${Date.now() - t0} ms)`);
        expect(near(rgbHex(info?.bg), '#FFFFFF'), `${tag} published page (not judged yet): on white (${rgbHex(info?.bg)})`);
      }
      await page.waitForTimeout(1500);
      const info = await cover(pc);
      if (slug === 'royal' || slug === 's3-royal') checkSolidLogo(`${tag} published page signed out (${slug})`, info);
      else if (slug === 'selfie' || slug === 's3-selfie') checkFills(`${tag} published page signed out (${slug})`, info);
      else if (slug === 'stasht') {
        checkSolidLogo(`${tag} published page signed out (Stasht S badge)`, info, { aspect: 1, gradient: ['#DCDCDC', '#9A9A9A'] });
        const seam = await edgeSeam(page, pc);
        expect(seam.top <= 12 && seam.side <= 12, `${tag} published Stasht S: seamless edges (left Δ${seam.top.toFixed(1)}, right Δ${seam.side.toFixed(1)})`);
      } else if (slug === 'wall') {
        checkWhole(`${tag} published page signed out (white-wall headshot)`, info, { color: '#F5F5F2', aspect: 480 / 600 });
        const c = await titleContrast(page, page.locator('body'), 'h1.text-white');
        if (c) expect(c.ratio >= 4.5, `${tag} published page (white wall): white title contrast ${c.ratio.toFixed(2)}:1 on rgb(${c.rgb})`);
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
