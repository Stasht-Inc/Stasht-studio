// Dynamic QR Codes (3 Nov 2026): the Campaigns tab's "QR Codes" button (in place of AI Campaign Wizard, phones too)
// and its window: empty state, create (one pick; unpublished → Publish in place; view only allowed with a hint;
// private can't be used), the new code with Download PNG (2048 px) / SVG, the list (thumbnail, name, Opens:, scans),
// Change campaign, Rename, Delete with confirm, and property_id sent only in a property view.
// Branded codes (3 Nov 2026): the default avatar in the middle on a white circle and its colour (auto), Change image /
// Remove image, the colour override (Auto, presets, Custom), the three downloads (PNG 4096 white, PNG 4096
// transparent, SVG with the logo inside) — every PNG is read back with a real QR decoder (jsQR) at 4096 and ~300 px.
// node tests/qr-codes/ui/qr-codes.mjs   (needs the dev server: QR_BASE, default http://localhost:5311)
// The /qr-codes API is mocked here to the web API's contract (3 Nov 2026); every non-local request is aborted.
// Screenshots: QR_SHOTS (default /private/tmp/claude-501/qr-shots).
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import sharp from 'sharp';
import jsQRModule from 'jsqr';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const jsQR = jsQRModule.default ?? jsQRModule;
const BASE = process.env.QR_BASE || 'http://localhost:5311';
const OUT = process.env.QR_SHOTS || '/private/tmp/claude-501/qr-shots';
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 70, external_user_id: 707, name: 'Main Dealer', email: 'main@dealer.test', role: '2', status: 1, is_activated: true };
const PROPERTY = { id: 12, name: 'Main Downtown', unique_id: 'MD-12', user_id: 707, is_creator: true, user_role: 'owner', property_type: 'internal', account_type: 'internal', account_created_for_property: false, can_manage: true, is_own_external_account: false, location: 'Toronto, ON', memories_count: 0, users_count: 1, invited_users: [], labels: [], created_at: '2026-10-01T10:00:00Z', is_active: true, status: 1 };

// state as the API names it; slug: whether it has a public link yet; canPublish: the owner may publish it.
// A salesperson's property the main account manages (can_manage), and one it may only view.
const P_MANAGED = { ...PROPERTY, id: 96, name: 'Bon Sun', unique_id: 'BS-96', user_id: 966, is_creator: false, user_role: 'admin', property_type: 'external', account_type: 'external', account_created_for_property: true, can_manage: true };
const P_VIEWER = { ...PROPERTY, id: 97, name: 'Rita Rep', unique_id: 'RR-97', user_id: 967, is_creator: false, user_role: 'viewer', property_type: 'external', account_type: 'external', account_created_for_property: true, can_manage: false };
const ALL_PROPERTIES = [PROPERTY, P_MANAGED, P_VIEWER];

const CAMPAIGNS = [
  { id: 801, title: 'Fall Promo', state: 'public', slug: 'fall-promo', canPublish: false },
  { id: 802, title: 'Open House', state: 'view_only', slug: 'open-house', canPublish: false },
  { id: 803, title: 'Spring Sale', state: 'unpublished', slug: null, canPublish: true },
  { id: 804, title: 'Private VIP Night', state: 'private', slug: 'vip', canPublish: false },
  { id: 805, title: 'Shared With Me Event', state: 'unpublished', slug: null, canPublish: false },
  // can_publish true but not offered: private (made Public on the campaign itself) and public with no link yet.
  { id: 806, title: 'Brand New Campaign', state: 'public', slug: null, canPublish: true },
  { id: 807, title: 'Private Owners Only', state: 'private', slug: 'owners', canPublish: true },
  { id: 808, title: `Long ${'title '.repeat(29)}end`.slice(0, 150), state: 'public', slug: 'long', canPublish: false },
];
const LONG = CAMPAIGNS[CAMPAIGNS.length - 1];
const REASON = { view_only: "View only — visitors can't add moments", private: 'Private — change to Public to use', unpublished: 'Not published' };
const usable = (c) => (c.state === 'public' || c.state === 'view_only') && Boolean(c.slug);
const reasonFor = (c) => (c.state === 'public' && !c.slug ? 'No public link yet' : REASON[c.state] ?? null);

// Logos the API answers at GET /qr-codes/logo-image?url=<logo.url>: the account's avatar (a round green
// logo), the property's image (blue), and an uploaded custom image (a light yellow sun on transparent).
const AVATAR_URL = 'https://stasht-media.s3.amazonaws.com/profile/u707.jpg';
const PROPERTY_IMG = 'https://stasht-media.s3.amazonaws.com/properties/p12.jpg';
const svgLogo = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">${body}</svg>`);
const GREEN_LOGO = await sharp(svgLogo('<rect width="400" height="400" fill="#fff"/><circle cx="200" cy="200" r="198" fill="#00704A"/><circle cx="200" cy="200" r="150" fill="none" stroke="#fff" stroke-width="14"/><polygon fill="#fff" points="200,90 228,170 312,170 244,220 270,300 200,250 130,300 156,220 88,170 172,170"/>')).jpeg().toBuffer();
const BLUE_LOGO = await sharp(svgLogo('<rect width="400" height="400" fill="#1D4ED8"/><rect x="120" y="120" width="160" height="160" fill="#fff"/>')).png().toBuffer();
const YELLOW_LOGO = await sharp(svgLogo('<circle cx="200" cy="200" r="120" fill="#FDE047"/><g stroke="#FDE047" stroke-width="22">' +
  [0, 45, 90, 135].map((a) => `<line x1="200" y1="20" x2="200" y2="380" transform="rotate(${a} 200 200)"/>`).join('') + '</g>')).png().toBuffer();
const YELLOW_FILE = `${OUT}/fixture-yellow-logo.png`;
writeFileSync(YELLOW_FILE, YELLOW_LOGO);
const logoBytes = (url) => (url === AVATAR_URL ? { contentType: 'image/jpeg', body: GREEN_LOGO } : url === PROPERTY_IMG ? { contentType: 'image/png', body: BLUE_LOGO } : /\/qr-codes\/custom-\d+\.png$/.test(url || '') ? { contentType: 'image/png', body: YELLOW_LOGO } : null);

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
// The top-left finder's centre: quiet zone 4 + 3.5 modules, of 45 (version 5 + quiet zones).
const FINDER = (4 + 3.5) / 45;
const near = (px, hex, tol = 24) => {
  const n = parseInt(hex.slice(1), 16);
  return Math.abs(px.r - (n >> 16)) <= tol && Math.abs(px.g - ((n >> 8) & 255)) <= tol && Math.abs(px.b - (n & 255)) <= tol;
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

// fail: { list?: true, create?: true } answers those calls with the API's refusals.
async function open({ width, height, seed, codes = [], fail = {}, styleAvailable = true }) {
  const state = { codes: codes.map((c) => ({ ...c })), nextId: 50, calls: [], campaigns: CAMPAIGNS.map((c) => ({ ...c })) };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024, acceptDownloads: true });
  await context.addInitScript(([seedData]) => {
    if (sessionStorage.getItem('qr-seeded')) return;
    sessionStorage.setItem('qr-seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(seedData)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, [seed]);
  // The code object: campaign null when none is set or it was deleted (memory_id may remain).
  const row = (c) => {
    const m = state.campaigns.find((x) => x.id === c.memory_id && !x.deleted);
    return {
      id: c.id, public_code: c.public_code, short_url: `https://studio.stasht.com/q/${c.public_code}`, name: c.name, property_id: c.property_id ?? null,
      memory_id: c.memory_id, campaign: m ? { id: m.id, title: m.title, state: m.state, usable: usable(m), public_url: m.slug ? `https://studio.stasht.com/published-memory/${m.slug}` : null } : null,
      scan_count: c.scan_count, last_scanned_at: c.last_scanned_at, created_at: '2026-11-03T10:00:00Z', updated_at: '2026-11-03T10:00:00Z',
      // The API resolves the default: the property's image in a property view, else the account's avatar.
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
    if (p.startsWith('/qr-codes') || /^\/memories\/\d+\/publish$/.test(p)) {
      state.calls.push({ method, p, q: url.searchParams.get('property_id'), body, view: req.headers()['x-stasht-property'] || null });
    }
    if (p === '/qr-codes' && method === 'GET') {
      if (fail.list) return route.fulfill({ status: 503, json: { success: false, code: 'qr_codes_unavailable', message: 'QR codes are not available yet.' } });
      const pid = url.searchParams.get('property_id');
      const codes = state.codes.filter((c) => String(c.property_id ?? '') === String(pid ?? '') || (pid === null && c.property_id === undefined));
      return route.fulfill({ json: { success: true, data: codes.map(row), meta: { default_logo_url: pid ? PROPERTY_IMG : AVATAR_URL, style_available: styleAvailable } } });
    }
    if (p === '/qr-codes' && method === 'POST') {
      if (fail.create) return route.fulfill({ status: 422, json: { success: false, code: 'campaign_unpublished', message: 'This campaign is no longer published.' } });
      const m = state.campaigns.find((x) => x.id === body.memory_id);
      // The API's default name: the campaign title, within 120 characters.
      const c = { id: state.nextId++, public_code: `NEW${state.nextId}ABCD`.slice(0, 8), name: body.name || (m ? m.title.slice(0, 120) : null), memory_id: body.memory_id, property_id: body.property_id ?? null, scan_count: 0, last_scanned_at: null };
      state.codes.unshift(c);
      return route.fulfill({ status: 201, json: { success: true, data: row(c) } });
    }
    if (p === '/qr-codes/campaign-options' && method === 'GET') {
      const s = (url.searchParams.get('search') || '').toLowerCase();
      const list = state.campaigns.filter((c) => !c.deleted && c.title.toLowerCase().includes(s))
        .map((c) => ({ id: c.id, title: c.title, cover_url: null, state: c.state, usable: usable(c), can_publish: c.canPublish, reason: usable(c) && c.state === 'public' ? null : reasonFor(c) }));
      return route.fulfill({ json: { success: true, data: list, meta: { page: 1, per_page: 20, total: list.length, total_pages: 1 } } });
    }
    if (p === '/qr-codes/logo-image' && method === 'GET') {
      const bytes = logoBytes(url.searchParams.get('url'));
      state.logoFetches = [...(state.logoFetches || []), url.searchParams.get('url')];
      return bytes ? route.fulfill({ status: 200, contentType: bytes.contentType, body: bytes.body }) : route.fulfill({ status: 404, json: { success: false, code: 'logo_not_found', message: 'Image not found.' } });
    }
    if (p === '/qr-codes/images' && method === 'POST') {
      const multipart = (req.headers()['content-type'] || '').startsWith('multipart/form-data') && /name="file"/.test(req.postDataBuffer()?.toString('latin1') || '');
      state.uploads = [...(state.uploads || []), { multipart }];
      return route.fulfill({ json: { success: true, data: { url: `https://stasht-media.s3.amazonaws.com/qr-codes/custom-${state.uploads.length}.png` } } });
    }
    const one = p.match(/^\/qr-codes\/(\d+)$/);
    if (one) {
      const c = state.codes.find((x) => x.id === Number(one[1]));
      if (!c) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
      if (method === 'PATCH') {
        Object.assign(c, body);
        if (body?.logo_mode === 'default' || body?.logo_mode === 'none') delete c.logo_url;
        return route.fulfill({ json: { success: true, data: row(c) } });
      }
      if (method === 'DELETE') {
        state.codes = state.codes.filter((x) => x !== c);
        return route.fulfill({ json: { success: true, message: 'QR code deleted.' } });
      }
    }
    const pub = p.match(/^\/memories\/(\d+)\/publish$/);
    if (pub && method === 'POST') {
      const m = state.campaigns.find((x) => x.id === Number(pub[1]));
      if (m && body?.role === 1 && body?.publish_only === true) Object.assign(m, { state: 'public', slug: 'spring-sale' });
      return route.fulfill({ json: { success: true, data: { slug: 'spring-sale' } } });
    }
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
  await page.goto(`${BASE}/memories`);
  await page.getByText('All Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1200);
  return { context, page, state };
}

async function shot(page, file) {
  const path = `${OUT}/${file}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('shot', path);
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const dialog = (page) => page.getByRole('dialog').filter({ visible: true }).first();
const qrButton = (page) => page.getByRole('button', { name: 'QR Codes', exact: true }).filter({ visible: true }).first();
const hexPx = (hex) => { const n = parseInt(hex.slice(1), 16); return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 }; };
const pngSize = (file) => {
  const b = readFileSync(file);
  return { png: b.slice(1, 4).toString() === 'PNG', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const seed = { stasht_token: 'main-token', stasht_user: MAIN, view_type: 'personal', stasht_campaigns_view: 'storeels' };

    // 1. Account view: the button replaces AI Campaign Wizard; empty window.
    {
      const { page, context, state } = await open({ width, height, seed });
      expect(await qrButton(page).count() === 1, `${tag}: QR Codes button shows`);
      expect(await page.getByText('AI Campaign Wizard').count() === 0, `${tag}: no AI Campaign Wizard button`);
      expect(await noOverflow(page), `${tag}: Campaigns header has no sideways scroll`);
      await shot(page, `${tag}-01-campaigns-header`);
      await qrButton(page).click();
      await dialog(page).getByText('Print a QR code once and point it at any campaign — change it anytime.').waitFor({ timeout: 8000 });
      const list = state.calls.find((c) => c.method === 'GET' && c.p === '/qr-codes');
      expect(list && list.q === null && list.view === null, `${tag}: account view list sends no property_id (${JSON.stringify(list)})`);
      if (width < 640) {
        const box = await dialog(page).boundingBox();
        expect(box && box.x === 0 && box.y === 0 && Math.round(box.width) === width && Math.round(box.height) === height, `${tag}: full screen on phone (${JSON.stringify(box)})`);
      }
      await shot(page, `${tag}-02-empty`);

      // 2. Create: the picker.
      await dialog(page).getByRole('button', { name: 'Create QR Code' }).click();
      await dialog(page).getByText('Fall Promo').waitFor({ timeout: 8000 });
      expect(await dialog(page).getByText("View only — visitors can't add moments").count() === 1, `${tag}: view-only hint`);
      expect(await dialog(page).getByText('Private — change to Public to use').count() === 2, `${tag}: private hint (both private campaigns, can_publish or not)`);
      expect(await dialog(page).getByRole('button', { name: /Private VIP Night/ }).count() === 0, `${tag}: private campaign is not pickable`);
      expect(await dialog(page).getByRole('button', { name: /Spring Sale/ }).count() === 0, `${tag}: unpublished campaign not pickable before Publish`);
      expect(await dialog(page).getByRole('button', { name: 'Publish', exact: true }).count() === 1, `${tag}: Publish only for unpublished + can_publish (not private, not no-link, not can_publish false)`);
      expect(await dialog(page).getByText('No public link yet').count() === 1 && await dialog(page).getByRole('button', { name: /Brand New Campaign/ }).count() === 0, `${tag}: public without a link: reason, not pickable`);
      expect(await noOverflow(page), `${tag}: picker no sideways scroll`);
      await shot(page, `${tag}-03-picker`);

      // Publish in place, then it can be picked.
      await dialog(page).getByRole('button', { name: 'Publish', exact: true }).click();
      await dialog(page).getByRole('button', { name: /Spring Sale/ }).waitFor({ timeout: 8000 });
      const pub = state.calls.find((c) => c.p === '/memories/803/publish');
      expect(pub && pub.body && pub.body.role === 1 && pub.body.publish_only === true, `${tag}: Publish publishes publicly, publish_only (${JSON.stringify(pub)})`);
      const pubAt = state.calls.indexOf(pub);
      expect(state.calls.slice(pubAt + 1).some((c) => c.p === '/qr-codes/campaign-options'), `${tag}: after Publish the option is asked for again from the server`);
      await shot(page, `${tag}-04-picker-after-publish`);

      // Pick Fall Promo → the new code with downloads.
      await dialog(page).getByRole('button', { name: /Fall Promo/ }).click();
      await dialog(page).getByRole('button', { name: 'Download', exact: true }).waitFor({ timeout: 8000 });
      const create = state.calls.find((c) => c.method === 'POST' && c.p === '/qr-codes');
      expect(create && create.body.memory_id === 801 && !('name' in create.body) && create.body.property_id === undefined, `${tag}: create body: no name, the API defaults it (${JSON.stringify(create?.body)})`);
      expect(await dialog(page).getByText('Fall Promo', { exact: true }).count() === 1, `${tag}: new code named after the campaign`);
      // Branded: the default avatar (green) in the middle, the code in its colour (auto).
      const view = dialog(page).locator('[data-qr-view] img');
      await view.waitFor({ timeout: 8000 });
      const viewColor = await view.getAttribute('data-qr-color');
      expect(viewColor && near(hexPx(viewColor), '#00704A', 12), `${tag}: created view drawn in the avatar's green, auto (${viewColor})`);
      expect((await view.getAttribute('src')).includes('data%3Aimage%2Fjpeg%3Bbase64') || (await view.getAttribute('src')).includes('data:image/jpeg;base64'), `${tag}: created view has the avatar inside`);
      const vm = decodeURIComponent(await view.getAttribute('src')).match(/href="data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)"/);
      const vmeta = vm ? await sharp(Buffer.from(vm[1], 'base64')).metadata() : null;
      expect(vmeta && Math.max(vmeta.width, vmeta.height) > 128, `${tag}: code view embeds the full-size logo (${vmeta && `${vmeta.width}x${vmeta.height}`})`);
      expect(await dialog(page).getByText('Image', { exact: true }).count() === 1 && await dialog(page).getByRole('button', { name: 'Change image' }).count() === 1 && await dialog(page).getByRole('button', { name: 'Remove image' }).count() === 1, `${tag}: Image: Change image / Remove image`);
      expect(await dialog(page).getByRole('radio', { name: /Auto/ }).getAttribute('aria-checked') === 'true', `${tag}: colour: Auto chosen`);
      expect(await dialog(page).getByRole('button', { name: 'Use profile picture' }).count() === 0, `${tag}: default image: no "Use profile picture"`);
      expect(await noOverflow(page), `${tag}: created view no sideways scroll`);
      await shot(page, `${tag}-05-created`);
      await dialog(page).getByRole('button', { name: 'Download', exact: true }).click();
      await page.getByRole('menuitem', { name: 'PNG · white background (any fabric)' }).waitFor({ timeout: 5000 });
      expect(await page.getByText('Print at least 2.5 cm (1 in) wide · dark code on a light background').count() === 1, `${tag}: print tip in the download menu`);
      await page.waitForTimeout(400);
      expect(await page.getByRole('menuitem', { name: 'PNG · transparent (light fabrics only)' }).count() === 1 && await page.getByRole('menuitem', { name: 'SVG · vector (print shops)' }).count() === 1, `${tag}: download menu says what each file is for`);
      await shot(page, `${tag}-05b-download-menu`);
      const [png] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'PNG · white background (any fabric)' }).click()]);
      const pngPath = `${OUT}/${tag}-download.png`;
      await png.saveAs(pngPath);
      expect(png.suggestedFilename() === 'qr-fall-promo.png', `${tag}: PNG name (${png.suggestedFilename()})`);
      await checkPng(tag, 'PNG white', pngPath, 'https://studio.stasht.com/q/NEW51ABC');
      expect(near(await pixelAt(pngPath, FINDER, FINDER), '#00704A', 16), `${tag}: PNG finder in the avatar's green`);
      // The logo's green outer band (90% of its radius; the logo is 29% of the 37-module code, of 45 with quiet zones).
      const band = await pixelAt(pngPath, 0.5, 0.5 + (0.9 * 0.145 * 37) / 45);
      expect(near(band, '#00704A', 40), `${tag}: PNG has the avatar logo in the middle (${JSON.stringify(band)})`);
      await dialog(page).getByRole('button', { name: 'Download', exact: true }).click();
      const [clear] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'PNG · transparent (light fabrics only)' }).click()]);
      const clearPath = `${OUT}/${tag}-download-transparent.png`;
      await clear.saveAs(clearPath);
      expect(clear.suggestedFilename() === 'qr-fall-promo-transparent.png', `${tag}: transparent PNG name (${clear.suggestedFilename()})`);
      await checkPng(tag, 'PNG transparent', clearPath, 'https://studio.stasht.com/q/NEW51ABC', { transparent: true });
      const ringEdge = await pixelAt(clearPath, 0.5, 0.5 - 0.35 * 37 / 45 / 2 + 0.004);
      expect(ringEdge.a === 255 && near(ringEdge, '#FFFFFF', 4), `${tag}: transparent PNG keeps the logo's white circle (${JSON.stringify(ringEdge)})`);
      await dialog(page).getByRole('button', { name: 'Download', exact: true }).click();
      const [svg] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'SVG · vector (print shops)' }).click()]);
      const svgPath = `${OUT}/${tag}-download.svg`;
      await svg.saveAs(svgPath);
      const svgText = readFileSync(svgPath, 'utf8');
      expect(svg.suggestedFilename() === 'qr-fall-promo.svg' && /<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/.test(svgText) && /viewBox="0 0 \d+ \d+"/.test(svgText), `${tag}: SVG download is a standalone svg`);
      expect(/href="data:image\/jpeg;base64,/.test(svgText) && !/href="https?:/.test(svgText) && new RegExp(`<path fill="${viewColor}" d="M`).test(svgText), `${tag}: SVG: vector paths, logo embedded as a data URI, no outside links`);
      const svgPng = `${OUT}/${tag}-download-svg-rendered.png`;
      await sharp(Buffer.from(svgText)).resize(4096, 4096).png().toFile(svgPng);
      for (const size of [4096, 300]) expect(await decodePng(svgPng, size) === 'https://studio.stasht.com/q/NEW51ABC', `${tag}: SVG rendered at ${size} px decodes`);
      await dialog(page).getByRole('button', { name: 'Done' }).click();
      await dialog(page).locator('[data-qr-row]').first().waitFor({ timeout: 5000 });
      await context.close();
    }

    // 3. List with codes: rows, Change campaign, Rename, Delete.
    {
      const codes = [
        { id: 7, public_code: 'K7PQ2MZX', name: 'Front window sign', memory_id: 801, scan_count: 12, last_scanned_at: '2026-11-02T10:00:00Z' },
        { id: 8, public_code: 'R4TW9BNC', name: 'Trade show banner', memory_id: null, scan_count: 1, last_scanned_at: null },
        { id: 9, public_code: 'Z8DLM3QE', name: 'Old flyer', memory_id: 899, scan_count: 0, last_scanned_at: null },
        { id: 10, public_code: 'P2VNX7KD', name: 'Door hanger', memory_id: 804, scan_count: 3, last_scanned_at: null },
      ];
      const { page, context, state } = await open({ width, height, seed, codes });
      await qrButton(page).click();
      await dialog(page).locator('[data-qr-row]').first().waitFor({ timeout: 8000 });
      expect(await dialog(page).getByText('Opens: Fall Promo').count() === 1 && await dialog(page).getByText('No campaign').count() === 2, `${tag}: Opens / No campaign (never set, and deleted campaign)`);
      expect(await dialog(page).getByText('Campaign not available — change it').count() === 1 && await dialog(page).getByText('Opens: Private VIP Night').count() === 0, `${tag}: campaign the API calls unusable: "Campaign not available — change it"`);
      expect(await dialog(page).getByText('12 scans').count() === 1 && await dialog(page).getByText('1 scan', { exact: true }).count() === 1, `${tag}: scan counts`);
      expect(await noOverflow(page), `${tag}: list no sideways scroll`);
      const overflow = await dialog(page).evaluate((el) => [...el.querySelectorAll('[data-qr-row]')].every((r) => r.scrollWidth <= r.clientWidth + 1));
      expect(overflow, `${tag}: rows fit their width`);
      await shot(page, `${tag}-06-list`);

      // Download menu.
      const row7 = dialog(page).locator('[data-qr-row="K7PQ2MZX"]');
      const thumb = row7.locator('img');
      await thumb.waitFor({ timeout: 8000 });
      expect(near(hexPx(await thumb.getAttribute('data-qr-color')), '#00704A', 12), `${tag}: list thumbnail is branded too (avatar green)`);
      // The thumbnail carries a small logo (≤ 128 px), not the 1024 px one the code view and downloads use.
      const embedded = async (img) => {
        const m = decodeURIComponent(await img.getAttribute('src')).match(/href="data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)"/);
        return m ? sharp(Buffer.from(m[1], 'base64')).metadata() : null;
      };
      const tmeta = await embedded(thumb);
      expect(tmeta && Math.max(tmeta.width, tmeta.height) <= 128, `${tag}: list thumbnail embeds a ≤ 128 px logo (${tmeta && `${tmeta.width}x${tmeta.height}`})`);
      await row7.getByRole('button', { name: 'Download' }).click();
      await page.getByRole('menuitem', { name: 'PNG · white background (any fabric)' }).waitFor({ timeout: 5000 });
      await page.waitForTimeout(400);
      await shot(page, `${tag}-07-download-menu`);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'SVG · vector (print shops)' }).click()]);
      expect(dl.suggestedFilename() === 'qr-front-window-sign.svg', `${tag}: row SVG download (${dl.suggestedFilename()})`);

      // Change campaign → Open House (view only).
      await row7.getByRole('button', { name: 'Change campaign' }).click();
      await dialog(page).getByRole('button', { name: /Open House/ }).waitFor({ timeout: 8000 });
      expect(await dialog(page).locator('[aria-current="true"]').count() === 1, `${tag}: the current campaign is marked`);
      await shot(page, `${tag}-08-change-campaign`);
      await dialog(page).getByRole('button', { name: /Open House/ }).click();
      await dialog(page).getByText('Opens: Open House').waitFor({ timeout: 8000 });
      const patch = state.calls.find((c) => c.method === 'PATCH' && c.p === '/qr-codes/7');
      expect(patch && patch.body.memory_id === 802, `${tag}: PATCH memory_id (${JSON.stringify(patch?.body)})`);
      await shot(page, `${tag}-09-after-change`);

      // Rename.
      await row7.getByRole('button', { name: /More actions/ }).click();
      await page.getByRole('menuitem', { name: 'Rename' }).click();
      const input = row7.getByLabel('Name');
      await input.waitFor({ timeout: 5000 });
      await input.fill('Lobby poster');
      await shot(page, `${tag}-10-rename`);
      await row7.getByRole('button', { name: 'Save' }).click();
      await dialog(page).getByText('Lobby poster', { exact: true }).waitFor({ timeout: 5000 });
      expect(state.calls.some((c) => c.method === 'PATCH' && c.body?.name === 'Lobby poster'), `${tag}: PATCH name`);

      // Delete with confirm.
      const row8 = dialog(page).locator('[data-qr-row="R4TW9BNC"]');
      await row8.getByRole('button', { name: /More actions/ }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('alertdialog').getByText("Printed copies will show a 'not linked' page.").waitFor({ timeout: 5000 });
      await shot(page, `${tag}-11-delete-confirm`);
      await page.getByRole('button', { name: 'Yes, delete it' }).click();
      await row8.waitFor({ state: 'detached', timeout: 5000 });
      expect(state.calls.some((c) => c.method === 'DELETE' && c.p === '/qr-codes/8'), `${tag}: DELETE sent`);
      await shot(page, `${tag}-12-after-delete`);
      await context.close();
    }

    // 3b. Branded look on an existing code: open it from the list, Change image (a light yellow logo → darkened colour,
    // still scans), the colour override (preset, Custom, back to Auto), Remove image (plain code, still scans).
    {
      const codes = [{ id: 7, public_code: 'K7PQ2MZX', name: 'Front window sign', memory_id: 801, scan_count: 12, last_scanned_at: null }];
      const { page, context, state } = await open({ width, height, seed, codes });
      const TEXT = 'https://studio.stasht.com/q/K7PQ2MZX';
      await qrButton(page).click();
      const row7 = dialog(page).locator('[data-qr-row="K7PQ2MZX"]');
      await row7.waitFor({ timeout: 8000 });
      await row7.getByRole('button', { name: 'Open Front window sign' }).click();
      const view = dialog(page).locator('[data-qr-view] img');
      await view.waitFor({ timeout: 8000 });
      const download = async (name, file) => {
        await dialog(page).getByRole('button', { name: 'Download', exact: true }).click();
        const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name }).click()]);
        const path = `${OUT}/${tag}-${file}`;
        await d.saveAs(path);
        return path;
      };

      // Change image: the uploaded file goes up as multipart "image"; the code redraws with it, in its (darkened) yellow.
      const before = await view.getAttribute('data-qr-color');
      await dialog(page).locator('input[type=file]').setInputFiles(YELLOW_FILE);
      await page.waitForFunction((was) => {
        const c = document.querySelector('[data-qr-view] img')?.getAttribute('data-qr-color');
        return c && c !== was;
      }, before, { timeout: 8000 }).catch(() => {});
      expect(state.uploads?.length === 1 && state.uploads[0].multipart, `${tag}: Change image uploads multipart "file" to /qr-codes/images (${JSON.stringify(state.uploads)})`);
      const setCustom = state.calls.find((c) => c.method === 'PATCH' && c.body?.logo_mode === 'custom');
      expect(setCustom && setCustom.body.logo_url === 'https://stasht-media.s3.amazonaws.com/qr-codes/custom-1.png', `${tag}: then PATCH logo_mode custom + the uploaded logo_url (${JSON.stringify(setCustom?.body)})`);
      expect((state.logoFetches || []).every((u) => u !== 'https://stasht-media.s3.amazonaws.com/qr-codes/custom-1.png'), `${tag}: the uploaded file is drawn from the file in hand, not downloaded again`);
      const yellow = await view.getAttribute('data-qr-color');
      const yrgb = hexPx(yellow);
      const lum = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      const contrast = 1.05 / (0.2126 * lum(yrgb.r) + 0.7152 * lum(yrgb.g) + 0.0722 * lum(yrgb.b) + 0.05);
      expect(yrgb.r > yrgb.b + 60 && yrgb.g > yrgb.b + 40 && contrast >= 4.5, `${tag}: light yellow logo → a darker yellow with ≥ 4.5:1 contrast (${yellow}, ${contrast.toFixed(2)}:1)`);
      expect(await dialog(page).getByRole('button', { name: 'Use profile picture' }).count() === 1, `${tag}: own image: "Use profile picture" offered`);
      await shot(page, `${tag}-19-change-image-yellow`);
      const yPng = await download('PNG · white background (any fabric)', 'yellow.png');
      await checkPng(tag, 'yellow logo PNG', yPng, TEXT);
      expect(near(await pixelAt(yPng, FINDER, FINDER), yellow, 16), `${tag}: yellow logo PNG finder in ${yellow}`);

      // Colour override: Navy preset → PATCH color; drawn navy; the swatch is chosen.
      await dialog(page).getByRole('radio', { name: 'Navy' }).click();
      // The colour previews at once; the swatch is marked once the API has saved it.
      await page.waitForFunction(() => document.querySelector('[role=radio][aria-label=Navy]')?.getAttribute('aria-checked') === 'true', null, { timeout: 8000 }).catch(() => {});
      expect(state.calls.some((c) => c.method === 'PATCH' && c.body?.color === '#1E3A8A'), `${tag}: preset sends PATCH color #1E3A8A`);
      expect(await dialog(page).getByRole('radio', { name: 'Navy' }).getAttribute('aria-checked') === 'true', `${tag}: Navy chosen`);
      await shot(page, `${tag}-20-colour-navy`);
      const nPng = await download('PNG · transparent (light fabrics only)', 'navy-transparent.png');
      await checkPng(tag, 'navy transparent PNG', nPng, TEXT, { transparent: true });
      expect(near(await pixelAt(nPng, FINDER, FINDER), '#1E3A8A', 16), `${tag}: navy PNG finder is navy`);

      // Custom: a too-light pick is saved print safe.
      await dialog(page).getByLabel('Colour: custom').fill('#7dd3fc');
      await page.waitForTimeout(600);
      const customPatch = [...state.calls].reverse().find((c) => c.method === 'PATCH' && typeof c.body?.color === 'string' && c.body.color !== '#1E3A8A');
      const cHex = customPatch?.body.color;
      const crgb = cHex ? hexPx(cHex) : { r: 255, g: 255, b: 255 };
      const cContrast = 1.05 / (0.2126 * lum(crgb.r) + 0.7152 * lum(crgb.g) + 0.0722 * lum(crgb.b) + 0.05);
      expect(cHex && cContrast >= 4.5 && crgb.b > crgb.r, `${tag}: custom light blue saved darkened (${cHex}, ${cContrast.toFixed(2)}:1)`);
      expect(await dialog(page).locator('[role=radio][aria-checked=true]').count() === 0, `${tag}: custom colour: no preset / Auto marked chosen`);
      await shot(page, `${tag}-21-colour-custom`);
      const cPng = await download('PNG · white background (any fabric)', 'custom.png');
      await checkPng(tag, 'custom colour PNG', cPng, TEXT);

      // Back to Auto: PATCH color null.
      await dialog(page).getByRole('radio', { name: /Auto/ }).click();
      await page.waitForTimeout(400);
      expect(state.calls.some((c) => c.method === 'PATCH' && 'color' in (c.body || {}) && c.body.color === null), `${tag}: Auto sends PATCH color null`);

      // Remove image: PATCH logo_mode none → a plain code (no logo), still scans; "Add image" offered.
      await dialog(page).getByRole('button', { name: 'Remove image' }).click();
      await dialog(page).getByRole('button', { name: 'Add image' }).waitFor({ timeout: 8000 });
      expect(state.calls.some((c) => c.method === 'PATCH' && c.body?.logo_mode === 'none'), `${tag}: Remove image sends PATCH logo_mode none`);
      const src = await view.getAttribute('src');
      expect(!src.includes('base64'), `${tag}: no image in the middle after Remove image`);
      expect(await view.getAttribute('data-qr-color') === '#111827', `${tag}: no image, Auto → near-black #111827`);
      expect(await dialog(page).getByRole('button', { name: 'Use profile picture' }).count() === 1, `${tag}: no image: "Use profile picture" offered`);
      await shot(page, `${tag}-22-remove-image`);
      const pPng = await download('PNG · white background (any fabric)', 'plain.png');
      await checkPng(tag, 'plain PNG', pPng, TEXT);
      expect(near(await pixelAt(pPng, 0.5, 0.5), '#FFFFFF', 30) || near(await pixelAt(pPng, 0.5, 0.5), '#111827', 30), `${tag}: plain PNG has modules in the middle, no logo`);
      expect(await noOverflow(page), `${tag}: code view no sideways scroll`);
      await dialog(page).getByRole('button', { name: 'Done' }).click();
      await row7.waitFor({ timeout: 5000 });
      expect(await row7.locator('img').getAttribute('data-qr-color') === '#111827', `${tag}: list thumbnail follows (plain, near-black)`);

      // Use profile picture: PATCH logo_mode default → the avatar (green) is back, auto colour green; the button goes.
      await row7.getByRole('button', { name: 'Open Front window sign' }).click();
      await dialog(page).getByRole('button', { name: 'Use profile picture' }).click();
      await page.waitForFunction(() => document.querySelector('[data-qr-view] img')?.getAttribute('src')?.includes('base64'), null, { timeout: 8000 }).catch(() => {});
      expect(state.calls.some((c) => c.method === 'PATCH' && c.body?.logo_mode === 'default' && !('logo_url' in c.body)), `${tag}: Use profile picture sends PATCH logo_mode default`);
      expect(near(hexPx(await view.getAttribute('data-qr-color')), '#00704A', 12), `${tag}: back to the avatar and its green (${await view.getAttribute('data-qr-color')})`);
      expect(await dialog(page).getByRole('button', { name: 'Use profile picture' }).count() === 0 && await dialog(page).getByRole('button', { name: 'Change image' }).count() === 1, `${tag}: default image: no "Use profile picture"; Change / Remove image`);
      await shot(page, `${tag}-24-use-profile-picture`);
      const aPng = await download('PNG · white background (any fabric)', 'avatar-again.png');
      await checkPng(tag, 'avatar again PNG', aPng, TEXT);
      await context.close();
    }

    // 3c. An API without the style columns (meta.style_available false): the default look, no image / colour controls.
    {
      const codes = [{ id: 7, public_code: 'K7PQ2MZX', name: 'Front window sign', memory_id: 801, scan_count: 12, last_scanned_at: null }];
      const { page, context, state } = await open({ width, height, seed, codes, styleAvailable: false });
      await qrButton(page).click();
      const row7 = dialog(page).locator('[data-qr-row="K7PQ2MZX"]');
      await row7.waitFor({ timeout: 8000 });
      await row7.locator('img').waitFor({ timeout: 8000 });
      await row7.getByRole('button', { name: 'Open Front window sign' }).click();
      await dialog(page).locator('[data-qr-view] img').waitFor({ timeout: 8000 });
      expect(await dialog(page).getByRole('button', { name: 'Change image' }).count() === 0 && await dialog(page).getByRole('radio', { name: /Auto/ }).count() === 0, `${tag}: style unavailable: no image / colour controls`);
      expect(near(hexPx(await dialog(page).locator('[data-qr-view] img').getAttribute('data-qr-color')), '#00704A', 12), `${tag}: style unavailable: still the default look (avatar, auto colour)`);
      expect((state.logoFetches || []).includes(AVATAR_URL), `${tag}: the logo is loaded through /qr-codes/logo-image?url=`);
      await shot(page, `${tag}-23-style-unavailable`);
      await context.close();
    }
    // 3d. A logo the API can't serve (logo_not_found): drawn without the centre image, auto colour falls back.
    {
      const codes = [{ id: 7, public_code: 'K7PQ2MZX', name: 'Front window sign', memory_id: 801, scan_count: 12, last_scanned_at: null, logo_mode: 'custom', logo_url: 'https://stasht-media.s3.amazonaws.com/qr-codes/missing.png' }];
      const { page, context } = await open({ width, height, seed, codes });
      await qrButton(page).click();
      await dialog(page).locator('[data-qr-row="K7PQ2MZX"]').waitFor({ timeout: 8000 });
      const thumb = dialog(page).locator('[data-qr-row="K7PQ2MZX"] img');
      await thumb.waitFor({ timeout: 8000 });
      expect(await thumb.getAttribute('data-qr-color') === '#111827' && !(await thumb.getAttribute('src')).includes('base64'), `${tag}: unloadable logo: plain code, near-black`);
      await context.close();
    }

    // 4. Refusals show the server's message: list 503 in the window, create 422 as a toast.
    {
      const { page, context } = await open({ width, height, seed, fail: { list: true } });
      await qrButton(page).click();
      await dialog(page).getByText('QR codes are not available yet.').waitFor({ timeout: 8000 }).catch(() => failures.push(`${tag}: list 503 shows the server message`));
      await shot(page, `${tag}-14-list-unavailable`);
      await context.close();
    }
    {
      const { page, context } = await open({ width, height, seed, fail: { create: true } });
      await qrButton(page).click();
      await dialog(page).getByRole('button', { name: 'Create QR Code' }).click();
      await dialog(page).getByRole('button', { name: /Fall Promo/ }).click();
      await page.getByText('This campaign is no longer published.').first().waitFor({ timeout: 8000 }).catch(() => failures.push(`${tag}: create 422 shows the server message`));
      expect(await dialog(page).getByRole('button', { name: /Fall Promo/ }).isEnabled(), `${tag}: after a refused create the picker can be used again`);
      await shot(page, `${tag}-15-create-refused`);
      await context.close();
    }

    // 5. A 150-character campaign title: no name sent, the API's (120-character) name fits the window.
    {
      const { page, context, state } = await open({ width, height, seed });
      await qrButton(page).click();
      await dialog(page).getByRole('button', { name: 'Create QR Code' }).click();
      await dialog(page).getByRole('button', { name: /^Long title/ }).click();
      await dialog(page).getByRole('button', { name: 'Download', exact: true }).waitFor({ timeout: 8000 });
      const create = state.calls.find((c) => c.method === 'POST' && c.p === '/qr-codes');
      expect(create && create.body.memory_id === LONG.id && !('name' in create.body), `${tag}: long title: no name sent (${JSON.stringify(create?.body)})`);
      expect(await noOverflow(page), `${tag}: long title: new code, no sideways scroll`);
      await shot(page, `${tag}-16-long-title-created`);
      await dialog(page).getByRole('button', { name: 'Done' }).click();
      await dialog(page).locator('[data-qr-row]').first().waitFor({ timeout: 5000 });
      const fits = await dialog(page).evaluate((el) => [...el.querySelectorAll('[data-qr-row]')].every((r) => r.scrollWidth <= r.clientWidth + 1));
      expect(fits && await noOverflow(page), `${tag}: long title: list row fits`);
      await shot(page, `${tag}-17-long-title-list`);
      await context.close();
    }

    // 6. Property view: property_id on the list, the picker and create.
    {
      const pseed = { stasht_token: 'main-token', stasht_user: MAIN, view_type: 'property', selected_property: PROPERTY, stasht_campaigns_view: 'storeels' };
      const { page, context, state } = await open({ width, height, seed: pseed });
      expect(await qrButton(page).count() === 1, `${tag}: property view: QR Codes button shows for the owner`);
      await qrButton(page).click();
      await dialog(page).getByRole('button', { name: 'Create QR Code' }).click();
      await dialog(page).getByRole('button', { name: /Fall Promo/ }).click();
      await dialog(page).getByRole('button', { name: 'Download', exact: true }).waitFor({ timeout: 8000 });
      const pview = dialog(page).locator('[data-qr-view] img');
      await pview.waitFor({ timeout: 8000 });
      expect(near(hexPx(await pview.getAttribute('data-qr-color')), '#1D4ED8', 12), `${tag}: property view: the property's image (blue) and its colour (${await pview.getAttribute('data-qr-color')})`);
      const list = state.calls.find((c) => c.method === 'GET' && c.p === '/qr-codes');
      const opts = state.calls.find((c) => c.p === '/qr-codes/campaign-options');
      const create = state.calls.find((c) => c.method === 'POST' && c.p === '/qr-codes');
      expect(list?.q === '12' && opts?.q === '12' && create?.body.property_id === 12, `${tag}: property view sends property_id 12 (${JSON.stringify([list?.q, opts?.q, create?.body])})`);
      await shot(page, `${tag}-13-property-created`);
      await context.close();
    }

    // 7. The main account in a salesperson's property it manages (can_manage): the button, and that property's codes.
    {
      const mseed = { stasht_token: 'main-token', stasht_user: MAIN, view_type: 'property', selected_property: P_MANAGED, stasht_campaigns_view: 'storeels' };
      const codes = [{ id: 20, public_code: 'BSUN96QR', name: 'Bon Sun showroom', memory_id: 801, property_id: 96, scan_count: 4, last_scanned_at: null }];
      const { page, context, state } = await open({ width, height, seed: mseed, codes });
      expect(await qrButton(page).count() === 1, `${tag}: main account in a managed property sees QR Codes`);
      await qrButton(page).click();
      await dialog(page).getByText('Bon Sun showroom').waitFor({ timeout: 8000 }).catch(() => failures.push(`${tag}: managed property: its codes listed`));
      const list = state.calls.find((c) => c.method === 'GET' && c.p === '/qr-codes');
      expect(list?.q === '96', `${tag}: managed property: list asked with property_id 96 (${list?.q})`);
      await shot(page, `${tag}-18-managed-property-list`);
      await context.close();
    }
    // 8. A property the main account may only view: no button.
    {
      const vseed = { stasht_token: 'main-token', stasht_user: MAIN, view_type: 'property', selected_property: P_VIEWER, stasht_campaigns_view: 'storeels' };
      const { page, context } = await open({ width, height, seed: vseed });
      expect(await qrButton(page).count() === 0, `${tag}: view-only property: no QR Codes button`);
      await context.close();
    }
  }
  // 7. /q/<code> served by the app (an old service worker): straight on to the API host's /q/ redirect, not back here.
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
    // Replaced, not pushed: Back skips the /q/ page (it would only bounce forward again).
    await page.goBack().catch(() => {});
    expect(!page.url().includes('/q/K7PQ2MZX') || page.url().startsWith('https://restapi'), `/q/ route: replace, not push (Back → ${page.url()})`);
    await page.goto(`${BASE}/q/bad%2Fcode`);
    await page.waitForTimeout(3000);
    expect(page.url().startsWith(BASE) && seen.length === 1, `/q/ route: a malformed code goes nowhere (${page.url()})`);
    await shot(page, 'q-route-bad-code');
    await context.close();
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant);
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall QR code checks passed');
process.exit(failures.length || relevant.length ? 1 : 0);
