// QR codes v2 (Chris, 3 Nov 2026 evening): "keep it simple. a popover with a dropdown and the Live Campaign selected,
// with edit link". The Campaigns header's "QR Code" button (in place of AI Campaign Wizard, phones too) opens a popover
// (a bottom sheet on phones) with the view's ONE code (GET /qr-code, made on first open): the branded code, the Live
// campaign dropdown (every campaign of the view, published or not, searchable when long, more on scroll), Edit (the
// campaign's page in Studio), Download (PNG white / PNG transparent / SVG + print tip — every PNG read back with a real
// QR decoder, jsQR, at 4096, 300 and 200 px) and "Logo & colour" tucked away. property_id only in a property view.
// The logo auto-trim: a padded BMW-like avatar fills its circle (before / after shots), and still scans.
// The public campaign page opened from a QR code (?qr=): GET published-memories ?qr=, track-view / submit-photo body
// {qr}; "Add a moment" on an unpublished campaign when the API answers qr_access: true.
// node tests/qr-codes/ui/qr-codes.mjs   (needs the dev server: QR_BASE, default http://localhost:5311)
// The API is mocked here to the web API's v2 contract (3 Nov 2026 evening); every non-local request is aborted.
// Screenshots: QR_SHOTS (default /private/tmp/claude-501/qr-shots).
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import sharp from 'sharp';
import jsQRModule from 'jsqr';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { qrSvg } from '../../../utils/qrStyle.ts';

const { chromium } = pw;
const jsQR = jsQRModule.default ?? jsQRModule;
const BASE = process.env.QR_BASE || 'http://localhost:5311';
const OUT = process.env.QR_SHOTS || '/private/tmp/claude-501/qr-shots';
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 70, external_user_id: 707, name: 'Main Dealer', email: 'main@dealer.test', role: '2', status: 1, is_activated: true };
const PROPERTY = { id: 12, name: 'Main Downtown', unique_id: 'MD-12', user_id: 707, is_creator: true, user_role: 'owner', property_type: 'internal', account_type: 'internal', account_created_for_property: false, can_manage: true, is_own_external_account: false, location: 'Toronto, ON', memories_count: 0, users_count: 1, invited_users: [], labels: [], created_at: '2026-10-01T10:00:00Z', is_active: true, status: 1 };
// A salesperson's property the main account manages (can_manage), and one it may only view.
const P_MANAGED = { ...PROPERTY, id: 96, name: 'Bon Sun', unique_id: 'BS-96', user_id: 966, is_creator: false, user_role: 'admin', property_type: 'external', account_type: 'external', account_created_for_property: true, can_manage: true };
const P_VIEWER = { ...PROPERTY, id: 97, name: 'Rita Rep', unique_id: 'RR-97', user_id: 967, is_creator: false, user_role: 'viewer', property_type: 'external', account_type: 'external', account_created_for_property: true, can_manage: false };
const ALL_PROPERTIES = [PROPERTY, P_MANAGED, P_VIEWER];

// Every state may be live now (QR v2): no publish gating. The first is the most recently updated (the API's default).
const CAMPAIGNS = [
  { id: 801, title: 'Fall Promo', state: 'public' },
  { id: 802, title: 'Open House', state: 'view_only' },
  { id: 803, title: 'Spring Sale', state: 'unpublished' },
  { id: 804, title: 'Private VIP Night', state: 'private' },
  { id: 805, title: 'Shared With Me Event', state: 'unpublished' },
  { id: 806, title: 'Brand New Campaign', state: 'public' },
  { id: 807, title: 'Private Owners Only', state: 'private' },
  { id: 808, title: `Long ${'title '.repeat(29)}end`.slice(0, 150), state: 'public' },
  { id: 809, title: 'Summer BBQ', state: 'public' },
  { id: 810, title: 'Winter Tires Event', state: 'unpublished' },
];
const MANY = Array.from({ length: 45 }, (_, i) => ({ id: 900 + i, title: `Campaign ${String(i + 1).padStart(2, '0')}`, state: i % 3 ? 'public' : 'unpublished' }));

// Logos the API answers at GET /qr-codes/logo-image?url=<logo.url>: the account's avatar (a round green logo), the
// property's image (blue), an uploaded custom image (a light yellow sun on transparent), and a BMW-like avatar: a small
// roundel in the middle of a big white JPEG (Chris's screenshot, 3 Nov evening).
const AVATAR_URL = 'https://stasht-media.s3.amazonaws.com/profile/u707.jpg';
const PROPERTY_IMG = 'https://stasht-media.s3.amazonaws.com/properties/p12.jpg';
const BMW_URL = 'https://stasht-media.s3.amazonaws.com/profile/bmw-dealer.jpg';
const svgLogo = (body, s = 400) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${body}</svg>`);
const GREEN_LOGO = await sharp(svgLogo('<rect width="400" height="400" fill="#fff"/><circle cx="200" cy="200" r="198" fill="#00704A"/><circle cx="200" cy="200" r="150" fill="none" stroke="#fff" stroke-width="14"/><polygon fill="#fff" points="200,90 228,170 312,170 244,220 270,300 200,250 130,300 156,220 88,170 172,170"/>')).jpeg().toBuffer();
const BLUE_LOGO = await sharp(svgLogo('<rect width="400" height="400" fill="#1D4ED8"/><rect x="120" y="120" width="160" height="160" fill="#fff"/>')).png().toBuffer();
const YELLOW_LOGO = await sharp(svgLogo('<circle cx="200" cy="200" r="120" fill="#FDE047"/><g stroke="#FDE047" stroke-width="22">' +
  [0, 45, 90, 135].map((a) => `<line x1="200" y1="20" x2="200" y2="380" transform="rotate(${a} 200 200)"/>`).join('') + '</g>')).png().toBuffer();
const roundel = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#111"/><circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="#fff"/>` +
  `<path d="M${cx} ${cy}L${cx} ${cy - r * 0.6}A${r * 0.6} ${r * 0.6} 0 0 1 ${cx + r * 0.6} ${cy}Z" fill="#1C69D4"/>` +
  `<path d="M${cx} ${cy}L${cx} ${cy + r * 0.6}A${r * 0.6} ${r * 0.6} 0 0 1 ${cx - r * 0.6} ${cy}Z" fill="#1C69D4"/>`;
const BMW_LOGO = await sharp(svgLogo(`<rect width="800" height="800" fill="#fff"/>${roundel(400, 400, 120)}`, 800)).flatten({ background: '#fff' }).jpeg({ quality: 85 }).toBuffer();
const YELLOW_FILE = `${OUT}/fixture-yellow-logo.png`;
writeFileSync(YELLOW_FILE, YELLOW_LOGO);
const MOMENT_FILE = `${OUT}/fixture-moment.jpg`;
writeFileSync(MOMENT_FILE, await sharp({ create: { width: 64, height: 48, channels: 3, background: '#88aacc' } }).jpeg().toBuffer());
const logoBytes = (url) => (url === AVATAR_URL ? { contentType: 'image/jpeg', body: GREEN_LOGO }
  : url === PROPERTY_IMG ? { contentType: 'image/png', body: BLUE_LOGO }
    : url === BMW_URL ? { contentType: 'image/jpeg', body: BMW_LOGO }
      : /\/qr-codes\/custom-\d+\.png$/.test(url || '') ? { contentType: 'image/png', body: YELLOW_LOGO } : null);

/** Read a PNG back with jsQR: at its own size, and downscaled (transparent ones flattened on white first). */
async function decodePng(file, size, blur = 0) {
  let img = sharp(file).flatten({ background: '#ffffff' });
  if (size) img = img.resize(size, size);
  let png = await img.png().toBuffer();
  if (blur) png = await sharp(png).blur(blur).png().toBuffer();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const found = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height);
  return found ? found.data : null;
}
/** The colour at a point of a PNG (x, y as shares of its width), and its alpha. */
async function pixelAt(file, fx, fy) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (Math.round(fy * (info.height - 1)) * info.width + Math.round(fx * (info.width - 1))) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}
/** The share of an image's width / height its mark (non-transparent, non-near-white pixels) spans. */
async function markSpan(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width; let y0 = info.height; let x1 = -1; let y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (data[i + 3] < 24 || Math.min(data[i], data[i + 1], data[i + 2]) >= 235) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  return { w: (x1 - x0 + 1) / info.width, h: (y1 - y0 + 1) / info.height };
}
// The top-left finder's centre: quiet zone 4 + 3.5 modules, of 45 (version 5 + quiet zones).
const FINDER = (4 + 3.5) / 45;
const near = (px, hex, tol = 24) => {
  const n = parseInt(hex.slice(1), 16);
  return Math.abs(px.r - (n >> 16)) <= tol && Math.abs(px.g - ((n >> 8) & 255)) <= tol && Math.abs(px.b - (n & 255)) <= tol;
};
const pngSize = (file) => {
  const b = readFileSync(file);
  return { png: b.slice(1, 4).toString() === 'PNG', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};
async function checkPng(tag, label, file, text, { transparent = false } = {}) {
  const { width, height } = pngSize(file);
  expect(width === 4096 && height === 4096, `${tag}: ${label}: 4096 x 4096 (${width} x ${height})`);
  for (const [size, blur] of [[0, 0], [300, 0], [200, 0], [300, 1.2]]) {
    const got = await decodePng(file, size || undefined, blur);
    expect(got === text, `${tag}: ${label}: decodes with jsQR at ${size || 4096} px${blur ? ', slightly blurred' : ''} (${got})`);
  }
  const corner = await pixelAt(file, 0.01, 0.01);
  expect(transparent ? corner.a === 0 : corner.a === 255 && near(corner, '#FFFFFF', 2), `${tag}: ${label}: ${transparent ? 'transparent' : 'white'} background (${JSON.stringify(corner)})`);
}

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

/**
 * codes: the views' codes by property_id ('' = the account's); a view without one gets one on first GET (live: the
 * most recently updated campaign). fail: { get?: true, logoUrl?: true }. campaigns: the view's campaigns.
 */
async function open({ width, height, seed, codes = {}, fail = {}, styleAvailable = true, campaigns = CAMPAIGNS, path = '/memories', waitFor = 'campaigns', published = null }) {
  const state = { codes: Object.fromEntries(Object.entries(codes).map(([k, c]) => [k, { ...c }])), nextId: 50, calls: [], all: [], campaigns: campaigns.map((c) => ({ ...c })) };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024, acceptDownloads: true });
  await context.addInitScript(([seedData]) => {
    if (sessionStorage.getItem('qr-seeded')) return;
    sessionStorage.setItem('qr-seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(seedData)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, [seed]);
  const row = (c) => {
    const m = state.campaigns.find((x) => x.id === c.memory_id && !x.deleted);
    return {
      id: c.id, public_code: c.public_code, short_url: `https://studio.stasht.com/q/${c.public_code}`, name: c.name, property_id: c.property_id ?? null,
      memory_id: c.memory_id, campaign: m ? { id: m.id, title: m.title, state: m.state, usable: true, public_url: null } : null,
      scan_count: 0, last_scanned_at: null, created_at: '2026-11-03T10:00:00Z', updated_at: '2026-11-03T10:00:00Z',
      logo: {
        mode: c.logo_mode ?? 'default',
        url: (c.logo_mode ?? 'default') === 'none' ? null : c.logo_mode === 'custom' ? c.logo_url : (c.property_id ? PROPERTY_IMG : AVATAR_URL),
        default_url: c.property_id ? PROPERTY_IMG : AVATAR_URL,
      },
      color: c.color ?? null,
    };
  };
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') {
        return route.fulfill({ contentType: 'text/javascript', body: 'window.Stripe=function(){return{elements:function(){return{create:function(){return{mount:function(){},on:function(){},destroy:function(){},unmount:function(){}}},getElement:function(){return null}}}}};' });
      }
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') {
        return route.fulfill({ contentType: 'text/javascript', body: 'window.gapi={load:function(n,c){var f=typeof c==="function"?c:(c&&c.callback);if(f)f();}};' });
      }
      return route.abort('blockedbyclient');
    }
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const method = req.method();
    const isJson = (req.headers()['content-type'] || '').includes('application/json');
    const body = req.postData() && isJson ? JSON.parse(req.postData()) : null;
    state.all.push({ method, p, search: url.search, body });
    if (p.startsWith('/qr-code') || /^\/memories\/\d+\/publish$/.test(p)) {
      state.calls.push({ method, p, q: url.searchParams.get('property_id'), search: url.searchParams.get('search'), page: url.searchParams.get('page'), body, view: req.headers()['x-stasht-property'] || null });
    }
    if (p === '/qr-code' && method === 'GET') {
      if (fail.get) return route.fulfill({ status: 503, json: { success: false, code: 'qr_codes_unavailable', message: 'QR codes are not available yet.' } });
      const key = url.searchParams.get('property_id') ?? '';
      if (!state.codes[key]) {
        state.codes[key] = { id: state.nextId++, public_code: `NEW${state.nextId}ABCD`.slice(0, 8), name: key ? 'Main Downtown' : 'Main Dealer', property_id: key ? Number(key) : null, memory_id: state.campaigns[0]?.id ?? null };
        state.created = (state.created || 0) + 1;
      }
      return route.fulfill({ json: { success: true, data: row(state.codes[key]), meta: { style_available: styleAvailable } } });
    }
    if (p === '/qr-codes/campaign-options' && method === 'GET') {
      const s = (url.searchParams.get('search') || '').toLowerCase();
      const pageNo = Number(url.searchParams.get('page') || 1);
      // hidden: live on the code but not one this caller may pick (e.g. another admin's own campaign).
      const all = state.campaigns.filter((c) => !c.deleted && !c.hidden && c.title.toLowerCase().includes(s));
      const list = all.slice((pageNo - 1) * 20, pageNo * 20).map((c) => ({ id: c.id, title: c.title, cover_url: null, state: c.state, usable: true }));
      return route.fulfill({ json: { success: true, data: list, meta: { page: pageNo, per_page: 20, total: all.length, total_pages: Math.max(1, Math.ceil(all.length / 20)) } } });
    }
    if (p === '/qr-codes/logo-image' && method === 'GET') {
      const bytes = logoBytes(url.searchParams.get('url'));
      state.logoFetches = [...(state.logoFetches || []), url.searchParams.get('url')];
      return bytes ? route.fulfill({ status: 200, contentType: bytes.contentType, body: bytes.body }) : route.fulfill({ status: 404, json: { success: false, code: 'logo_not_found', message: 'Image not found.' } });
    }
    if (p === '/qr-codes/images' && method === 'POST') {
      const raw = req.postDataBuffer()?.toString('latin1') || '';
      const multipart = (req.headers()['content-type'] || '').startsWith('multipart/form-data') && /name="file"/.test(raw);
      const pidField = raw.match(/name="property_id"\r\n\r\n([^\r]*)\r\n/);
      state.uploads = [...(state.uploads || []), { multipart, property_id: pidField ? pidField[1] : null }];
      return route.fulfill({ json: { success: true, data: { url: `https://stasht-media.s3.amazonaws.com/qr-codes/custom-${state.uploads.length}.png` } } });
    }
    const one = p.match(/^\/qr-codes\/(\d+)$/);
    if (one) {
      const c = Object.values(state.codes).find((x) => x.id === Number(one[1]));
      if (!c) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
      if (method === 'PATCH') {
        if (fail.logoUrl && body?.logo_url) return route.fulfill({ status: 422, json: { success: false, message: 'That image belongs to another account. Please upload it again.', errors: { logo_url: ['That image belongs to another account. Please upload it again.'] } } });
        Object.assign(c, body);
        if (body?.logo_mode === 'default' || body?.logo_mode === 'none') delete c.logo_url;
        return route.fulfill({ json: { success: true, data: row(c) } });
      }
    }
    // The public campaign page (?qr=): the campaign as the API answers when the code points at it (qr_access: true).
    if (p === '/published-memories' && published) {
      const byQr = Boolean(published.qr) && url.searchParams.get('qr') === published.qr;
      const byToken = Boolean(published.token) && url.searchParams.get('access_token') === published.token;
      if (!byQr && !byToken && !published.open) return route.fulfill({ status: 404, json: { success: false, message: 'Campaign not found' } });
      return route.fulfill({ json: { success: true, data: { memory: published.memory, order_by: 'asc', qr_access: byQr } } });
    }
    if (p === '/public/upload-image-with-metadata') return route.fulfill({ json: { success: true, data: { fileUrl: 'https://stasht-media.s3.amazonaws.com/x/moment.jpg', location: null, capture_date: null, originalSizeMB: 0.01 } } });
    if (p === '/memories/submit-photo') return route.fulfill({ json: { success: true, message: 'Submitted' } });
    if (p === '/memory-images/comments' && method === 'POST') return route.fulfill({ json: { success: true, data: { comment: { id: 77 } } } });
    if (p === '/properties' && method === 'GET') {
      return route.fulfill({ json: { success: true, data: { properties: ALL_PROPERTIES, owned_properties: [PROPERTY], shared_properties: [P_MANAGED, P_VIEWER], owned_count: 1, shared_count: 2, total_count: 3 } } });
    }
    if (/^\/properties\/\d+\/memories$/.test(p)) {
      const prop = ALL_PROPERTIES.find((x) => String(x.id) === p.split('/')[2]) || PROPERTY;
      return route.fulfill({ json: { status: 'success', data: { property: prop, user_role: 'owner', viewing_invited_content: false, inviter: null, memories: { data: [], total: 0 }, sidebar: { categories: { items: [] }, labels: { items: [] } } } } });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}${path}`);
  if (waitFor === 'campaigns') {
    await page.getByText('All Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1200);
  }
  return { context, page, state };
}

async function shot(page, file, locator) {
  const path = `${OUT}/${file}.png`;
  if (locator) await locator.screenshot({ path });
  else await page.screenshot({ path, fullPage: false });
  console.log('shot', path);
  return path;
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const panel = (page) => page.locator('[data-qr-popover]').filter({ visible: true }).first();
const qrButton = (page) => page.getByRole('button', { name: 'QR Code', exact: true }).filter({ visible: true }).first();
const liveSelect = (page) => panel(page).getByRole('button', { name: /^Live campaign/ });
const liveList = (page) => panel(page).getByRole('listbox');
const NONE = 'None (QR shows ‘not linked’)';
const focusIn = (page, sel) => page.evaluate((s) => Boolean(document.activeElement?.closest(s)), sel);
const hexPx = (hex) => { const n = parseInt(hex.slice(1), 16); return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 }; };
const lum = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const contrastOf = (hex) => { const x = hexPx(hex); return 1.05 / (0.2126 * lum(x.r) + 0.7152 * lum(x.g) + 0.0722 * lum(x.b) + 0.05); };
async function openPanel(page) {
  await qrButton(page).click();
  await panel(page).waitFor({ timeout: 8000 });
  await panel(page).locator('[data-qr-view] img').waitFor({ timeout: 8000 });
}
async function download(page, tag, name, file) {
  await panel(page).getByRole('button', { name: 'Download' }).click();
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name }).click()]);
  const path = `${OUT}/${tag}-${file}`;
  await d.saveAs(path);
  return { path, name: d.suggestedFilename() };
}

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const seed = { stasht_token: 'main-token', stasht_user: MAIN, view_type: 'personal', stasht_campaigns_view: 'storeels' };

    // 1. Account view: the QR Code button; the popover (sheet on phones) with the code made on first open.
    {
      const { page, context, state } = await open({ width, height, seed });
      expect(await qrButton(page).count() === 1, `${tag}: "QR Code" button shows`);
      expect(await page.getByText('AI Campaign Wizard').count() === 0, `${tag}: no AI Campaign Wizard button`);
      expect(await noOverflow(page), `${tag}: Campaigns header has no sideways scroll`);
      const btn = await qrButton(page).boundingBox();
      await openPanel(page);
      const get = state.calls.find((c) => c.method === 'GET' && c.p === '/qr-code');
      expect(get && get.q === null && get.view === null && state.created === 1, `${tag}: GET /qr-code, no property_id; the code is made on first open (${JSON.stringify(get)})`);
      expect(!state.calls.some((c) => c.p === '/qr-codes' || c.method === 'POST' || c.method === 'DELETE'), `${tag}: no list / create / delete calls`);
      const kind = await panel(page).getAttribute('data-qr-popover');
      const box = await panel(page).boundingBox();
      if (width < 768) {
        await page.waitForTimeout(500); // the sheet slides in
        const box = await panel(page).boundingBox();
        expect(kind === 'sheet' && box && Math.round(box.x) === 0 && Math.round(box.width) === width && Math.abs(box.y + box.height - height) <= 2, `${tag}: a bottom sheet on phones (${JSON.stringify(box)})`);
      } else {
        expect(kind === 'popover' && box && btn && box.y >= btn.y + btn.height && Math.abs(box.x + box.width - (btn.x + btn.width)) < 16 && box.width <= 380, `${tag}: a popover under the button, right-aligned (${JSON.stringify(box)} / ${JSON.stringify(btn)})`);
      }
      const view = panel(page).locator('[data-qr-view] img');
      const viewColor = await view.getAttribute('data-qr-color');
      expect(viewColor && near(hexPx(viewColor), '#00704A', 12), `${tag}: drawn in the avatar's green, auto (${viewColor})`);
      expect(decodeURIComponent(await view.getAttribute('src')).includes('data:image/jpeg;base64'), `${tag}: the avatar in the middle`);
      expect((await liveSelect(page).textContent()).includes('Fall Promo'), `${tag}: Live campaign: the most recently updated campaign selected`);
      expect(await panel(page).getByRole('button', { name: 'Edit Fall Promo' }).count() === 1, `${tag}: Edit link for the live campaign`);
      expect(await panel(page).getByRole('button', { name: 'Change image' }).count() === 0, `${tag}: image / colour tucked away until "Logo & colour"`);
      expect(await panel(page).getByRole('button', { name: /Logo & colour/ }).getAttribute('aria-expanded') === 'false', `${tag}: "Logo & colour" link, collapsed`);
      expect(await noOverflow(page), `${tag}: popover no sideways scroll`);
      await shot(page, `${tag}-01-popover`);

      // The dropdown: the view's campaigns, no publish badges / Publish links; the live one checked; None last.
      await liveSelect(page).click();
      const list = liveList(page);
      await list.getByRole('option', { name: /Spring Sale/ }).waitFor({ timeout: 8000 });
      expect(await list.getByRole('option').count() === CAMPAIGNS.length + 1 && await list.getByRole('option').last().textContent() === NONE, `${tag}: dropdown lists all ${CAMPAIGNS.length} campaigns, then "${NONE}" (${await list.getByRole('option').count()})`);
      const qrBox = await panel(page).locator('[data-qr-view]').boundingBox();
      const trig = await liveSelect(page).boundingBox();
      const lb = await panel(page).locator('[data-qr-live-list]').boundingBox();
      expect(qrBox && trig && lb && lb.y >= trig.y + trig.height && qrBox.y + qrBox.height <= trig.y, `${tag}: the list opens below the control, inside the panel, never over the code (${JSON.stringify({ qrBox, trig, lb })})`);
      expect(await focusIn(page, '[data-qr-live-list]'), `${tag}: the keyboard is in the list once it opens`);
      expect(await list.getByText(/Not published|Publish|Private — change|View only — visitors/).count() === 0 && await panel(page).getByText(/Publish/).count() === 0, `${tag}: no publish badges or Publish links`);
      expect(await list.locator('[data-selected-campaign]').textContent() === 'Fall Promo', `${tag}: Fall Promo marked live`);
      expect(await page.getByPlaceholder('Search campaigns', { exact: true }).count() === 1, `${tag}: more than 8 campaigns: a search box`);
      const lbox = await list.boundingBox();
      expect(lbox && lbox.x >= 0 && lbox.x + lbox.width <= width && lbox.y + lbox.height <= height, `${tag}: dropdown inside the screen (${JSON.stringify(lbox)})`);
      expect(await noOverflow(page), `${tag}: dropdown open: no sideways scroll`);
      await shot(page, `${tag}-02-dropdown`);

      // Search (server side), then pick an UNPUBLISHED campaign: it goes live (PATCH memory_id).
      await page.getByPlaceholder('Search campaigns', { exact: true }).fill('spring');
      await page.waitForFunction(() => document.querySelectorAll('[data-qr-popover] [role=listbox] [role=option]').length === 1, null, { timeout: 8000 }).catch(() => {});
      const searched = state.calls.find((c) => c.p === '/qr-codes/campaign-options' && c.search === 'spring');
      expect(searched && await list.getByRole('option').count() === 1, `${tag}: search asks the API (search=spring) and shows the match`);
      await shot(page, `${tag}-02b-dropdown-search`);
      await list.getByRole('option', { name: /Spring Sale/ }).click();
      await page.waitForFunction(() => /Spring Sale/.test(document.querySelector('[data-qr-popover] [aria-haspopup=listbox]')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
      const patch = state.calls.find((c) => c.method === 'PATCH' && c.body?.memory_id === 803);
      expect(patch && Object.keys(patch.body).length === 1, `${tag}: picking sends PATCH {memory_id: 803} only (${JSON.stringify(patch?.body)})`);
      expect((await liveSelect(page).textContent()).includes('Spring Sale') && await panel(page).getByRole('button', { name: 'Edit Spring Sale' }).count() === 1, `${tag}: unpublished Spring Sale is live; Edit follows`);
      // Re-opened: the search is cleared.
      await liveSelect(page).click();
      await list.getByRole('option', { name: /Fall Promo/ }).waitFor({ timeout: 8000 }).catch(() => failures.push(`${tag}: dropdown reopens with every campaign`));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      expect(await panel(page).isVisible() && await liveList(page).count() === 0 && await focusIn(page, '[aria-haspopup=listbox]'), `${tag}: Escape closes only the list; focus back on the control`);

      // Download: the menu (three files + the print tip), each file decodes.
      await panel(page).getByRole('button', { name: 'Download' }).click();
      await page.getByRole('menuitem', { name: 'PNG · white background (any fabric)' }).waitFor({ timeout: 5000 });
      expect(await page.getByText('Print at least 2.5 cm (1 in) wide · dark code on a light background').count() === 1, `${tag}: print tip in the download menu`);
      expect(await page.getByRole('menuitem', { name: 'PNG · transparent (light fabrics only)' }).count() === 1 && await page.getByRole('menuitem', { name: 'SVG · vector (print shops)' }).count() === 1, `${tag}: PNG transparent (light fabrics only) and SVG`);
      await page.waitForTimeout(300);
      await shot(page, `${tag}-03-download-menu`);
      await page.keyboard.press('Escape');
      const TEXT = 'https://studio.stasht.com/q/NEW51ABC';
      const white = await download(page, tag, 'PNG · white background (any fabric)', 'download.png');
      expect(white.name === 'qr-main-dealer.png', `${tag}: PNG named after the code (${white.name})`);
      await checkPng(tag, 'PNG white', white.path, TEXT);
      expect(near(await pixelAt(white.path, FINDER, FINDER), '#00704A', 16), `${tag}: PNG finder in the avatar's green`);
      const clear = await download(page, tag, 'PNG · transparent (light fabrics only)', 'download-transparent.png');
      expect(clear.name === 'qr-main-dealer-transparent.png', `${tag}: transparent PNG name (${clear.name})`);
      await checkPng(tag, 'PNG transparent', clear.path, TEXT, { transparent: true });
      const svg = await download(page, tag, 'SVG · vector (print shops)', 'download.svg');
      const svgText = readFileSync(svg.path, 'utf8');
      expect(svg.name === 'qr-main-dealer.svg' && /href="data:image\/jpeg;base64,/.test(svgText) && !/href="https?:/.test(svgText), `${tag}: SVG standalone, logo embedded, no outside links`);
      const svgPng = `${OUT}/${tag}-download-svg-rendered.png`;
      await sharp(Buffer.from(svgText)).resize(4096, 4096).png().toFile(svgPng);
      for (const size of [4096, 300]) expect(await decodePng(svgPng, size) === TEXT, `${tag}: SVG rendered at ${size} px decodes`);

      // Logo & colour: expands inline with the image and colour controls; each change saves at once.
      await panel(page).getByRole('button', { name: /Logo & colour/ }).click();
      await panel(page).getByRole('button', { name: 'Change image' }).waitFor({ timeout: 5000 });
      expect(await panel(page).getByRole('button', { name: /Logo & colour/ }).getAttribute('aria-expanded') === 'true', `${tag}: Logo & colour expanded`);
      expect(await panel(page).getByRole('radio', { name: /Auto/ }).getAttribute('aria-checked') === 'true', `${tag}: colour Auto`);
      expect(await noOverflow(page), `${tag}: Logo & colour: no sideways scroll`);
      if (width >= 768) {
        const b = await panel(page).boundingBox();
        expect(b && b.y + b.height <= height, `${tag}: popover with Logo & colour fits the window (${JSON.stringify(b)})`);
      }
      await panel(page).evaluate((el) => { const s = el.closest('[data-qr-popover]')?.querySelector('.overflow-y-auto') || el; s.scrollTop = s.scrollHeight; el.scrollTop = el.scrollHeight; });
      await shot(page, `${tag}-04-logo-colour`);
      await panel(page).getByRole('radio', { name: 'Navy' }).click();
      await page.waitForFunction(() => document.querySelector('[role=radio][aria-label=Navy]')?.getAttribute('aria-checked') === 'true', null, { timeout: 8000 }).catch(() => {});
      expect(state.calls.some((c) => c.method === 'PATCH' && c.body?.color === '#1E3A8A') && await view.getAttribute('data-qr-color') === '#1E3A8A', `${tag}: Navy: PATCH color, drawn navy`);
      await panel(page).locator('input[type=file]').setInputFiles(YELLOW_FILE);
      await page.waitForFunction(() => document.querySelectorAll('[data-qr-popover] [role=radio][aria-checked=true]').length === 1 && !!document.querySelector('[data-qr-popover]')?.textContent?.includes('Use profile picture'), null, { timeout: 8000 }).catch(() => {});
      expect(state.uploads?.length === 1 && state.uploads[0].multipart && state.uploads[0].property_id === null, `${tag}: Change image uploads multipart, no property_id in the account view (${JSON.stringify(state.uploads)})`);
      expect(state.calls.some((c) => c.method === 'PATCH' && c.body?.logo_mode === 'custom' && c.body.logo_url === 'https://stasht-media.s3.amazonaws.com/qr-codes/custom-1.png'), `${tag}: then PATCH logo_mode custom + logo_url`);
      const yPng = await download(page, tag, 'PNG · white background (any fabric)', 'yellow-navy.png');
      await checkPng(tag, 'custom logo, navy PNG', yPng.path, TEXT);
      await panel(page).getByRole('radio', { name: /Auto/ }).click();
      await page.waitForTimeout(500);
      const yellow = await view.getAttribute('data-qr-color');
      expect(state.calls.some((c) => c.method === 'PATCH' && c.body && 'color' in c.body && c.body.color === null) && contrastOf(yellow) >= 4.5 && hexPx(yellow).r > hexPx(yellow).b + 60, `${tag}: Auto: the yellow logo's colour, darkened to print (${yellow})`);
      await panel(page).getByRole('button', { name: 'Remove image' }).click();
      await panel(page).getByRole('button', { name: 'Add image' }).waitFor({ timeout: 8000 });
      expect(!(await view.getAttribute('src')).includes('base64') && await view.getAttribute('data-qr-color') === '#111827', `${tag}: Remove image: plain code, near-black`);
      await panel(page).getByRole('button', { name: 'Use profile picture' }).click();
      await page.waitForFunction(() => document.querySelector('[data-qr-view] img')?.getAttribute('src')?.includes('base64'), null, { timeout: 8000 }).catch(() => {});
      expect(near(hexPx(await view.getAttribute('data-qr-color')), '#00704A', 12), `${tag}: Use profile picture: the avatar again`);

      // Edit: closes the popover and opens the live campaign's page in Studio.
      await panel(page).getByRole('button', { name: 'Edit Spring Sale' }).click();
      await page.waitForTimeout(1500);
      expect(await page.locator('[data-qr-popover]').count() === 0, `${tag}: Edit closes the popover`);
      expect(state.all.some((c) => /\/(memories|memory-detail)\/803(\/|$)/.test(c.p)) && await page.getByText('All Campaigns', { exact: true }).filter({ visible: true }).count() === 0, `${tag}: Edit opens campaign 803's page (${state.all.filter((c) => /803/.test(c.p)).map((c) => c.p).join(', ')})`);
      await shot(page, `${tag}-05-edit-opened-campaign`);
      await context.close();
    }

    // 2. The BMW-like avatar (a small roundel on a big white JPEG): trimmed so the mark fills its circle; still scans.
    {
      const codes = { '': { id: 7, public_code: 'K7PQ2MZX', name: 'BMW Dealer', memory_id: 801, logo_mode: 'custom', logo_url: BMW_URL } };
      const { page, context } = await open({ width, height, seed, codes });
      await openPanel(page);
      const view = panel(page).locator('[data-qr-view] img');
      const src = decodeURIComponent(await view.getAttribute('src'));
      const m = src.match(/href="data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)"/);
      const embedded = m ? Buffer.from(m[1], 'base64') : null;
      const span = embedded ? await markSpan(embedded) : { w: 0, h: 0 };
      const before = await markSpan(BMW_LOGO);
      expect(span.w >= 0.8 && span.h >= 0.8, `${tag}: BMW-like logo trimmed: the roundel spans ${(span.w * 100).toFixed(0)}% of the logo (was ${(before.w * 100).toFixed(0)}%)`);
      await shot(page, `${tag}-06-bmw-trimmed`);
      await shot(page, `${tag}-06b-bmw-trimmed-code`, panel(page).locator('[data-qr-view]'));
      const png = await download(page, tag, 'PNG · white background (any fabric)', 'bmw.png');
      await checkPng(tag, 'BMW-like PNG', png.path, 'https://studio.stasht.com/q/K7PQ2MZX');
      // The roundel's black ring now reaches near the logo's edge (logo 29% of the 37-module code, of 45 with quiet zones).
      const ring = await pixelAt(png.path, 0.5, 0.5 + (0.8 * 0.145 * 37) / 45);
      expect(ring.r < 90 && ring.g < 90 && ring.b < 90, `${tag}: PNG: the roundel's black ring at 80% of the logo's radius (${JSON.stringify(ring)})`);
      if (width === 1280) {
        // "Before": the same code drawn with the untrimmed avatar (what Chris saw), for the before / after shots.
        const old = qrSvg('https://studio.stasht.com/q/K7PQ2MZX', { color: '#111827', background: 'white', logo: { href: `data:image/jpeg;base64,${BMW_LOGO.toString('base64')}`, width: 800, height: 800 } }, 440);
        await sharp(Buffer.from(old)).png().toFile(`${OUT}/bmw-before-untrimmed.png`);
        console.log('shot', `${OUT}/bmw-before-untrimmed.png`);
        writeFileSync(`${OUT}/bmw-avatar-source.jpg`, BMW_LOGO);
      }
      await context.close();
    }

    // 3. Many campaigns: 20 at a time, more as the dropdown scrolls; the live one listed even beyond the first page.
    if (width === 1280) {
      const codes = { '': { id: 7, public_code: 'K7PQ2MZX', name: 'Front window', memory_id: 940 } };
      const { page, context, state } = await open({ width, height, seed, codes, campaigns: MANY });
      await openPanel(page);
      await page.waitForTimeout(600);
      expect(await panel(page).getByRole('button', { name: 'Edit Campaign 41' }).count() === 1
        && state.calls.some((c) => c.p === '/qr-codes/campaign-options' && c.search === 'Campaign 41'), `${tag}: live campaign beyond page 1: asked by title, it is the caller's → Edit stays`);
      await liveSelect(page).click();
      const list = liveList(page);
      await list.getByRole('option').first().waitFor({ timeout: 8000 });
      expect(await list.getByRole('option').count() === 21 && await list.getByText(NONE).count() === 0, `${tag}: None waits at the very bottom (after every page)`);
      expect(await list.getByRole('option').first().textContent() === 'Campaign 41' && await list.locator('[data-selected-campaign]').count() === 1, `${tag}: live Campaign 41 (page 3) listed first and checked`);
      for (let i = 0; i < 6; i++) {
        await list.evaluate((el) => { el.scrollTop = el.scrollHeight; });
        await page.waitForTimeout(500);
      }
      const pages = state.calls.filter((c) => c.p === '/qr-codes/campaign-options').map((c) => c.page);
      expect(pages.includes('2') && pages.includes('3') && await list.getByRole('option').count() === 46 && await list.getByRole('option').last().textContent() === NONE, `${tag}: scrolling loads pages 2 and 3, then None (${pages.join(',')}; ${await list.getByRole('option').count()} rows, no duplicate)`);
      await context.close();
    }

    // 4. Few campaigns (no search box): the keyboard alone — Enter opens, ↓ moves, Enter picks; Escape closes the
    // list, then the popover. None turns the code off (PATCH memory_id null): no Edit, the control says so.
    {
      const { page, context, state } = await open({ width, height, seed, campaigns: CAMPAIGNS.slice(0, 3) });
      await openPanel(page);
      await liveSelect(page).focus();
      await page.keyboard.press('Enter');
      await liveList(page).getByRole('option').first().waitFor({ timeout: 8000 });
      await page.waitForFunction(() => Boolean(document.activeElement?.closest('[data-qr-live-list]')), null, { timeout: 3000 }).catch(() => {});
      expect(await page.getByPlaceholder('Search campaigns', { exact: true }).count() === 0, `${tag}: 3 campaigns: no search box`);
      expect(await focusIn(page, '[data-qr-live-list]'), `${tag}: no search box: the keyboard is still in the list`);
      expect(await liveList(page).locator('[aria-selected=true]').textContent() === 'Fall Promo', `${tag}: the live row is highlighted on open`);
      await page.keyboard.press('ArrowDown');
      expect(await liveList(page).locator('[aria-selected=true]').textContent() === 'Open House', `${tag}: ↓ highlights the next row`);
      await shot(page, `${tag}-11-keyboard-list`);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => /Open House/.test(document.querySelector('[data-qr-popover] [aria-haspopup=listbox]')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
      expect(state.calls.some((c) => c.method === 'PATCH' && c.body?.memory_id === 802) && await liveList(page).count() === 0, `${tag}: Enter picks Open House (PATCH memory_id 802) and closes the list`);
      await page.waitForTimeout(300);
      expect(await focusIn(page, '[aria-haspopup=listbox]'), `${tag}: focus back on the control after picking`);
      // ↓ on the control opens the list too; End reaches None; Enter turns the code off.
      await page.keyboard.press('ArrowDown');
      await liveList(page).getByRole('option').first().waitFor({ timeout: 8000 });
      await page.waitForFunction(() => Boolean(document.activeElement?.closest('[data-qr-live-list]')), null, { timeout: 3000 }).catch(() => {});
      await page.keyboard.press('End');
      expect(await liveList(page).locator('[aria-selected=true]').textContent() === NONE, `${tag}: End highlights None`);
      await page.keyboard.press('Enter');
      await page.waitForFunction((n) => (document.querySelector('[data-qr-popover] [aria-haspopup=listbox]')?.textContent || '').includes(n), NONE, { timeout: 8000 }).catch(() => {});
      const off = state.calls.find((c) => c.method === 'PATCH' && c.body && 'memory_id' in c.body && c.body.memory_id === null);
      expect(off && (await liveSelect(page).textContent()).includes(NONE) && await panel(page).getByRole('button', { name: /^Edit/ }).count() === 0, `${tag}: None: PATCH memory_id null; the control shows "${NONE}", no Edit`);
      await shot(page, `${tag}-12-none-selected`);
      // Escape: first the list, then the popover.
      await page.keyboard.press('Enter');
      await liveList(page).waitFor({ timeout: 5000 });
      await page.waitForFunction(() => Boolean(document.activeElement?.closest('[data-qr-live-list]')), null, { timeout: 3000 }).catch(() => {});
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      expect(await liveList(page).count() === 0 && await panel(page).isVisible(), `${tag}: Escape closes the list first`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      expect(await page.locator('[data-qr-popover]').count() === 0, `${tag}: a second Escape closes the popover`);
      await context.close();
    }
    // The live campaign is not in this caller's options (another admin's campaign): shown selected, pinned, read-only.
    if (width === 1280) {
      const codes = { '': { id: 7, public_code: 'K7PQ2MZX', name: 'Front window', memory_id: 999 } };
      const { page, context, state } = await open({ width, height, seed, codes, campaigns: [...CAMPAIGNS.slice(0, 3), { id: 999, title: 'Rita Rep Showroom', state: 'public', hidden: true }] });
      await openPanel(page);
      expect((await liveSelect(page).textContent()).includes('Rita Rep Showroom'), `${tag}: a live campaign outside the options is the selected value`);
      await page.waitForTimeout(600);
      expect(await panel(page).getByRole('button', { name: /^Edit/ }).count() === 0, `${tag}: not one of the caller's options: no Edit`);
      await liveSelect(page).click();
      await liveList(page).getByRole('option').first().waitFor({ timeout: 8000 });
      const first = liveList(page).getByRole('option').first();
      expect(await first.textContent() === 'Rita Rep Showroom' && await first.getAttribute('aria-disabled') === 'true' && await first.getAttribute('data-qr-pinned') !== null, `${tag}: pinned on top, read-only`);
      expect(await liveList(page).getByRole('option').count() === 5, `${tag}: pinned + 3 options + None`);
      await first.click({ force: true });
      await page.waitForTimeout(300);
      expect(!state.calls.some((c) => c.method === 'PATCH'), `${tag}: the pinned row can't be picked (no PATCH)`);
      await shot(page, `${tag}-13-pinned-live`);
      await context.close();
    }
    // No campaigns you may publish: "No campaigns yet — create one" (starts a new campaign), None; the code downloads.
    {
      const { page, context } = await open({ width, height, seed, campaigns: [] });
      await openPanel(page);
      await page.waitForTimeout(500);
      expect((await liveSelect(page).textContent()).includes(NONE) && await liveSelect(page).isEnabled(), `${tag}: no campaigns: the control shows None`);
      expect(await panel(page).getByRole('button', { name: /^Edit/ }).count() === 0, `${tag}: no campaigns: no Edit`);
      expect(await panel(page).getByRole('button', { name: 'Download' }).isEnabled(), `${tag}: no campaigns: Download still there`);
      await liveSelect(page).click();
      await panel(page).locator('[data-qr-no-campaigns]').waitFor({ timeout: 8000 }).catch(() => failures.push(`${tag}: no campaigns: the empty message`));
      expect((await panel(page).locator('[data-qr-no-campaigns]').textContent()).replace(/\s+/g, ' ').trim() === 'No campaigns yet — create one' && await liveList(page).getByRole('option').count() === 1, `${tag}: "No campaigns yet — create one", and None`);
      await shot(page, `${tag}-07-no-campaigns`);
      await panel(page).getByRole('button', { name: 'create one' }).click();
      await page.waitForTimeout(1200);
      expect(await page.locator('[data-qr-popover]').count() === 0, `${tag}: "create one" closes the popover and starts a campaign`);
      await shot(page, `${tag}-07b-create-one`);
      await context.close();
    }

    // 5. Refusal: GET /qr-code 503 shows the server's message, Try again.
    {
      const { page, context } = await open({ width, height, seed, fail: { get: true } });
      await qrButton(page).click();
      await panel(page).getByText('QR codes are not available yet.').waitFor({ timeout: 8000 }).catch(() => failures.push(`${tag}: 503 shows the server message`));
      expect(await panel(page).getByRole('button', { name: 'Try again' }).count() === 1, `${tag}: 503: Try again`);
      await shot(page, `${tag}-08-unavailable`);
      await context.close();
    }

    // 6. style_available false: no "Logo & colour" link; the default look.
    {
      const { page, context } = await open({ width, height, seed, styleAvailable: false });
      await openPanel(page);
      expect(await panel(page).getByRole('button', { name: /Logo & colour/ }).count() === 0, `${tag}: style unavailable: no Logo & colour`);
      await context.close();
    }

    // 7. Property view: property_id on GET, campaign options and the upload; the property's image.
    {
      const pseed = { stasht_token: 'main-token', stasht_user: MAIN, view_type: 'property', selected_property: PROPERTY, stasht_campaigns_view: 'storeels' };
      const { page, context, state } = await open({ width, height, seed: pseed });
      expect(await qrButton(page).count() === 1, `${tag}: property view: QR Code button for the owner`);
      await openPanel(page);
      const view = panel(page).locator('[data-qr-view] img');
      expect(near(hexPx(await view.getAttribute('data-qr-color')), '#1D4ED8', 12), `${tag}: property view: the property's image (blue)`);
      await liveSelect(page).click();
      await liveList(page).getByRole('option', { name: /Open House/ }).click();
      await page.waitForTimeout(600);
      await panel(page).getByRole('button', { name: /Logo & colour/ }).click();
      await panel(page).locator('input[type=file]').setInputFiles(YELLOW_FILE);
      await page.waitForTimeout(1200);
      const get = state.calls.find((c) => c.method === 'GET' && c.p === '/qr-code');
      const opts = state.calls.find((c) => c.p === '/qr-codes/campaign-options');
      const patch = state.calls.find((c) => c.method === 'PATCH' && c.body?.memory_id === 802);
      expect(get?.q === '12' && opts?.q === '12' && patch && state.uploads?.[0]?.property_id === '12', `${tag}: property view sends property_id 12 (${JSON.stringify([get?.q, opts?.q, !!patch, state.uploads])})`);
      await shot(page, `${tag}-09-property-view`);
      await context.close();
    }
    // 7b. The API refuses the uploaded image (422 errors.logo_url): its message shows, the code keeps its image.
    {
      const pseed = { stasht_token: 'main-token', stasht_user: MAIN, view_type: 'property', selected_property: PROPERTY, stasht_campaigns_view: 'storeels' };
      const { page, context } = await open({ width, height, seed: pseed, fail: { logoUrl: true } });
      await openPanel(page);
      await panel(page).getByRole('button', { name: /Logo & colour/ }).click();
      await panel(page).locator('input[type=file]').setInputFiles(YELLOW_FILE);
      await page.getByText('That image belongs to another account. Please upload it again.').first().waitFor({ timeout: 8000 })
        .catch(() => failures.push(`${tag}: refused logo_url shows the server message`));
      expect(near(hexPx(await panel(page).locator('[data-qr-view] img').getAttribute('data-qr-color')), '#1D4ED8', 12), `${tag}: refused: keeps the property image`);
      await context.close();
    }
    // 8. The main account in a salesperson's property it manages: the button, that property's code.
    {
      const mseed = { stasht_token: 'main-token', stasht_user: MAIN, view_type: 'property', selected_property: P_MANAGED, stasht_campaigns_view: 'storeels' };
      const { page, context, state } = await open({ width, height, seed: mseed });
      expect(await qrButton(page).count() === 1, `${tag}: main account in a managed property sees QR Code`);
      await openPanel(page);
      expect(state.calls.find((c) => c.method === 'GET' && c.p === '/qr-code')?.q === '96', `${tag}: managed property: GET /qr-code?property_id=96`);
      await context.close();
    }
    // 9. A property the main account may only view: no button.
    {
      const vseed = { stasht_token: 'main-token', stasht_user: MAIN, view_type: 'property', selected_property: P_VIEWER, stasht_campaigns_view: 'storeels' };
      const { page, context } = await open({ width, height, seed: vseed });
      expect(await qrButton(page).count() === 0, `${tag}: view-only property: no QR Code button`);
      await context.close();
    }

    // 10. The public campaign page opened from a QR code: an UNPUBLISHED campaign opens with ?qr=, Add a moment shows,
    // and every call carries qr=.
    {
      const memory = { id: 803, title: 'Spring Sale', description: 'Our spring sale', published: 0, slug: 'spring-sale', user: { id: 707, name: 'Main Dealer' }, posts: [], linked_memories: [], widgets: [], created_at: '2026-11-01T10:00:00Z' };
      const { page, context, state } = await open({ width, height, seed: {}, path: '/published-memory/spring-sale?qr=K7PQ2MZX', waitFor: 'none', published: { qr: 'K7PQ2MZX', memory } });
      await page.getByRole('button', { name: 'Add a moment' }).filter({ visible: true }).first().waitFor({ timeout: 30000 }).catch(() => failures.push(`${tag}: QR page: Add a moment shows on an unpublished campaign`));
      const pub = state.all.find((c) => c.p === '/published-memories');
      expect(pub && /[?&]token=spring-sale/.test(pub.search) && /[?&]qr=K7PQ2MZX/.test(pub.search), `${tag}: QR page: published-memories asked with qr=K7PQ2MZX (${pub?.search})`);
      await page.waitForTimeout(800);
      const view = state.all.find((c) => c.p === '/memories/803/track-view');
      expect(view && view.body?.qr === 'K7PQ2MZX' && !('access_token' in view.body), `${tag}: QR page: track-view body {qr} (${JSON.stringify(view?.body)})`);
      await shot(page, `${tag}-10-qr-public-page`);
      await page.getByRole('button', { name: 'Add a moment' }).filter({ visible: true }).first().click();
      await page.locator('input[type=file]').first().setInputFiles(MOMENT_FILE);
      await page.getByPlaceholder('Your name').fill('Sam Visitor');
      await page.waitForTimeout(1200);
      await page.getByRole('button', { name: 'Submit' }).click();
      await page.getByText('Thanks! Your moment was submitted for review.').first().waitFor({ timeout: 8000 }).catch(() => failures.push(`${tag}: QR page: moment submitted`));
      const up = state.all.find((c) => c.p === '/public/upload-image-with-metadata');
      const sub = state.all.find((c) => c.p === '/memories/submit-photo');
      expect(up && sub?.body?.qr === 'K7PQ2MZX' && sub.body.memory_id === 803 && !sub.search, `${tag}: QR page: submit-photo body {memory_id: 803, qr} (${JSON.stringify(sub?.body)})`);
      await context.close();
    }
    // 10b. Without the code (or a re-pointed one): the unpublished campaign doesn't open.
    {
      const memory = { id: 803, title: 'Spring Sale', published: 0, slug: 'spring-sale', posts: [], linked_memories: [], widgets: [] };
      const { page, context } = await open({ width, height, seed: {}, path: '/published-memory/spring-sale', waitFor: 'none', published: { qr: 'K7PQ2MZX', memory } });
      await page.waitForTimeout(4000);
      expect(await page.getByRole('button', { name: 'Add a moment' }).filter({ visible: true }).count() === 0, `${tag}: no qr: the unpublished campaign doesn't open`);
      await context.close();
    }
  }

  // 10c. A Private campaign (published 3) opened with its access_token: track-view sends the token in the body, so the
  // API (which records a view only when the campaign is open to the caller) keeps counting views / leads.
  {
    const seed = { stasht_token: 'main-token', stasht_user: MAIN, view_type: 'personal' };
    const memory = { id: 804, title: 'Private VIP Night', published: 3, slug: 'vip', user: { id: 707, name: 'Main Dealer' }, posts: [], linked_memories: [], widgets: [], created_at: '2026-11-01T10:00:00Z' };
    const { page, context, state } = await open({ width: 1280, height: 900, seed, path: '/published-memory/vip?access_token=tok123', waitFor: 'none', published: { token: 'tok123', memory } });
    await page.getByRole('heading', { name: 'Private VIP Night' }).filter({ visible: true }).first().waitFor({ timeout: 30000 }).catch(() => failures.push('private page: opens with its access_token'));
    await page.waitForTimeout(800);
    await shot(page, '1280-11-private-page-token');
    const view = state.all.find((c) => c.p === '/memories/804/track-view');
    expect(view && view.body?.access_token === 'tok123' && !('qr' in view.body), `private page: track-view body {access_token} (${JSON.stringify(view?.body)})`);
    await context.close();
  }
  // 10d. Comments are gated on campaign access too: a comment on a Private page carries its access_token, one on a QR
  // visitor's page its qr (body), and a plain Public page sends neither.
  {
    const seed = { stasht_token: 'main-token', stasht_user: MAIN, view_type: 'personal' };
    const post = { id: 5001, name: 'Welcome night', title: 'Welcome night', image_link: '/default-memory-image.jpg', master_image_link: '/default-memory-image.jpg', admin_approval: 1, comments: [], comments_count: 0, user_name: 'Main Dealer', uploaded_at: '2026-11-01T10:00:00Z' };
    const comment = async (path, published, label, check) => {
      const memory = { id: 804, title: 'Private VIP Night', published: 3, slug: 'vip', user: { id: 707, name: 'Main Dealer' }, posts: [post], linked_memories: [], widgets: [], created_at: '2026-11-01T10:00:00Z' };
      const { page, context, state } = await open({ width: 1280, height: 900, seed, path, waitFor: 'none', published: { ...published, memory } });
      const box = page.getByPlaceholder('Add a comment...').filter({ visible: true }).first();
      await box.waitFor({ timeout: 30000 }).catch(() => failures.push(`${label}: the moment opens with its comment box`));
      await box.fill('Great night!');
      await page.getByRole('button', { name: 'Post' }).filter({ visible: true }).first().click();
      await page.waitForTimeout(800);
      const sent = state.all.find((c) => c.method === 'POST' && c.p === '/memory-images/comments');
      expect(sent && sent.body?.comment === 'Great night!' && String(sent.body.image_id) === '5001' && check(sent.body) && !sent.search, `${label} (${JSON.stringify(sent?.body)})`);
      await context.close();
    };
    await comment('/published-memory/vip?access_token=tok123&post_id=5001', { token: 'tok123' }, 'private page: comment body carries access_token', (b) => b.access_token === 'tok123' && !('qr' in b));
    await comment('/published-memory/vip?qr=K7PQ2MZX&post_id=5001', { qr: 'K7PQ2MZX' }, 'QR page: comment body carries qr', (b) => b.qr === 'K7PQ2MZX' && !('access_token' in b));
    await comment('/published-memory/vip?post_id=5001', { open: true }, 'public page: comment body carries neither', (b) => !('qr' in b) && !('access_token' in b));
  }
  // 11. /q/<code> served by the app (an old service worker): straight on to the API host's /q/ redirect, not back here.
  {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const seen = [];
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'restapi.stasht.com') {
        seen.push(url.href);
        return route.fulfill({ contentType: 'text/html', body: '<p>api redirect reached</p>' });
      }
      if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort('blockedbyclient');
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { success: true, data: [] } });
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/q/K7PQ2MZX`);
    await page.getByText('api redirect reached').waitFor({ timeout: 20000 }).catch(() => {});
    expect(seen[0] === 'https://restapi.stasht.com/q/K7PQ2MZX' && page.url() === 'https://restapi.stasht.com/q/K7PQ2MZX', `/q/ route: replaced to the API host (${JSON.stringify(seen)} → ${page.url()})`);
    await page.goBack().catch(() => {});
    expect(!page.url().includes('/q/K7PQ2MZX') || page.url().startsWith('https://restapi'), `/q/ route: replace, not push (Back → ${page.url()})`);
    await page.goto(`${BASE}/q/bad%2Fcode`);
    await page.waitForTimeout(3000);
    expect(page.url().startsWith(BASE) && seen.length === 1, `/q/ route: a malformed code goes nowhere (${page.url()})`);
    await context.close();
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant);
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall QR code checks passed');
process.exit(failures.length || relevant.length ? 1 : 0);
