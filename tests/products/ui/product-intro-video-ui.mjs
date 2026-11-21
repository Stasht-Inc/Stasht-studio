// tests/products/ui/product-intro-video-ui.mjs — c20-product-page walk + the 21 Nov Cover/Intro Video picker (UI only).
// Based on c20-product-page.mjs — Chris 20 Nov 2026 (points 13–17, 19, 20b) in the real app, every API call
// answered here (nothing leaves this machine). The walk, at 1280 and 390: Products (a photo-less product shows the
// account's brand) → Add a product (title, short + full description, price, category, buy link + "Book now") → Save →
// its page shows the details and a "Book now" button, no internal settings → reload → still right → Edit Cover →
// the new cover shows → a photo-less product's page shows the brand cover. Also a website product (Royal Wood) whose
// specs repeat the category: one Category row, no "Sheet Stock" everywhere, no "Untitled moment".
// Needs the dev server: C20_BASE (default http://127.0.0.1:5231). Screenshots: C20_SHOTS.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.C20_BASE || 'http://127.0.0.1:5231';
const OUT = process.env.C20_SHOTS || '/Users/deepaksharma/Pictures/Personal-Works/Stasht-Project/handoff-20261114/c20-P-shots';
mkdirSync(OUT, { recursive: true });

const GREEN = '#1F6F4A';
const USER = { id: 71, external_user_id: 960, name: 'TheBodyPolitik', email: 'owner@bodypolitik.test', role: '2', status: 1, is_activated: true, profile_color: GREEN, avatar: `${BASE}/pr-logo/logo.svg` };
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${GREEN}"/><circle cx="200" cy="170" r="90" fill="#F4E9D8"/><text x="200" y="330" font-size="44" text-anchor="middle" fill="#F4E9D8" font-family="Georgia">BODY POLITIK</text></svg>`;
const photo = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="${['#E8A87C', '#C38D9E', '#41B3A3', '#85CDCA'][n % 4]}"/><text x="400" y="320" font-size="80" text-anchor="middle" fill="#fff">${n}</text></svg>`;
const img = (n) => `${BASE}/pr-img/${n}.jpg`;
const FRESHA = 'https://www.fresha.com/a/the-body-politik-vancouver';
const MANUAL = ['title', 'short_description', 'description_html', 'brand', 'product_type', 'price', 'compare_at_price', 'currency', 'price_on_request', 'sku', 'barcode', 'stock_status', 'quantity', 'options', 'variants', 'attributes', 'weight', 'weight_unit', 'dimensions', 'category_ids', 'tags', 'collections', 'status', 'show_enquire', 'show_price', 'show_photos', 'slug', 'seo_title', 'seo_description', 'share_image', 'buy_url', 'buy_label', 'internal_notes', 'media'];
const WEBSITE = ['status', 'tags', 'collections', 'internal_notes', 'show_price', 'show_enquire', 'show_photos', 'category_ids'];

function product(id, title, over = {}) {
  return {
    id, user_id: 960, read_only: false, origin: 'manual', status: 'active', stock_status: 'in_stock', badge: 'active', title,
    price: '45.00', compare_at_price: null, currency: 'CAD', price_label: '$45 CAD', compare_at_label: '', price_on_request: false, show_price: true, show_photos: true,
    main_image: null, images_count: 0, category: null, categories: [{ id: 2, name: 'Body' }], sku: null, brand: null, url: null, updated_at: '2026-11-20T10:00:00Z',
    d: { short_description: null, description: null, description_html: null, buy_url: null, buy_label: null, media: [], tags: [], attributes: [], internal_notes: 'Wax supplier: Lycon' },
    ...over,
  };
}
function detailOf(p) {
  const media = p.d.media;
  return {
    ...p, d: undefined, product_type: null, barcode: null, quantity: null, availability: 'available', options: [], variants: [], weight: null, weight_unit: null, dimensions: null, collections: [],
    seo: { slug: `p-${p.id}`, title: null, description: null, share_image: null }, show_enquire: true, can_hide_photos: true,
    ...p.d, buy_button: p.d.buy_label || 'Buy now', media, main_image: media.find((m) => m.type === 'photo')?.url || p.main_image || null,
    images_count: media.filter((m) => m.type === 'photo').length, editable_fields: p.origin === 'manual' ? MANUAL : WEBSITE,
  };
}
const summaryOf = (p) => { const d = detailOf(p); return { ...p, d: undefined, main_image: d.main_image, images_count: d.images_count }; };

function world() {
  return {
    nextId: 900, calls: [], uploads: [],
    products: [
      product(801, 'Half Arms', { d: { ...product(0, '').d, media: [{ id: 8011, url: img(1), type: 'photo', sort_order: 0 }] } }),
      product(802, 'Full Legs', { price: '85.00', price_label: '$85 CAD' }),
      product(803, 'WVF-WO-4X8-RIFT-POLY', {
        origin: 'website', category: 'Sheet Stock', categories: [{ id: 9, name: 'Sheet Stock' }], sku: 'WVF-WO-4X8-RIFT-POLY', brand: 'The Royal Wood Shop', url: 'https://royalwoodshop.example/p/wvf',
        price: null, price_label: '',
        d: { short_description: null, description: "4' X 8' Flexible Wood Veneer Rift Cut White Oak with Polyback - individually boxed", description_html: null, buy_url: null, buy_label: null, tags: [], internal_notes: '',
          media: [{ id: 8031, url: img(2), type: 'photo', sort_order: 0 }, { id: 8032, url: img(3), type: 'photo', sort_order: 1 }],
          attributes: [{ label: 'Category', value: 'Sheet Stock' }, { label: 'Material', value: 'White Oak' }, { label: 'Sub-Category', value: 'Sheet Stock' }, { label: 'Product Code', value: 'Sheet Stock' }, { label: 'Lead Time', value: '-' }, { label: 'Size', value: "4' x 8'" }] },
      }),
    ],
    categories: [{ id: 1, name: 'Intimate', from_website: false, product_count: 0, read_only: false }, { id: 2, name: 'Body', from_website: false, product_count: 2, read_only: false }, { id: 9, name: 'Sheet Stock', from_website: true, product_count: 1, read_only: false }],
  };
}
const statusOf = (w) => ({ pilot: true, available: true, reason: null, can_create: true, counts: { total: w.products.length, manual: w.products.filter((p) => p.origin === 'manual').length, website: 1, shopify: 0 }, default_currency: 'CAD' });

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

function applyBody(w, p, body) {
  for (const k of ['title', 'price', 'currency', 'status']) if (k in body) p[k] = body[k] == null ? null : String(body[k]);
  if ('price' in body) p.price_label = body.price != null ? `$${Number(body.price)} ${p.currency || 'CAD'}` : '';
  if ('status' in body) p.badge = body.status;
  for (const k of ['short_description', 'description_html', 'buy_url', 'buy_label', 'tags', 'attributes', 'internal_notes']) if (k in body) p.d[k] = body[k];
  if ('description_html' in body) p.d.description = (body.description_html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
  if (Array.isArray(body.category_ids)) p.categories = body.category_ids.map((id) => w.categories.find((c) => c.id === id)).filter(Boolean).map((c) => ({ id: c.id, name: c.name }));
}

async function open(w, { width, height, path = '/products' }) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript((user) => {
    try { delete window.showOpenFilePicker; } catch { /* the file input path, so Playwright can pick the file */ }
    if (sessionStorage.getItem('c20-seeded')) return;
    sessionStorage.setItem('c20-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'tok');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
  }, USER);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/pr-img/')) return route.fulfill({ contentType: 'image/svg+xml', body: photo(Number(url.pathname.match(/(\d+)/)?.[1] ?? 0)) });
    if (url.pathname.startsWith('/pr-logo/')) return route.fulfill({ contentType: 'image/svg+xml', body: LOGO });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const m = req.method();
    let body = null;
    try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch { body = null; }
    w.calls.push({ m, p, body });
    // The web API's judgement of the brand picture (BrandPictureController): a logo on its own green.
    if (p === '/brand-pictures') return route.fulfill({ json: { success: true, data: Object.fromEntries(url.searchParams.getAll('urls[]').map((u) => [u, { kind: 'logo', color: GREEN, gradient: null }])), pending: 0 } });
    if (p === '/products/status') return route.fulfill({ json: { success: true, data: statusOf(w) } });
    if (p === '/products' && m === 'GET') return route.fulfill({ json: { success: true, data: { items: w.products.map(summaryOf), pagination: { current_page: 1, per_page: 48, total: w.products.length, last_page: 1 } } } });
    if (p === '/products' && m === 'POST') {
      const created = product(w.nextId++, body.title, { status: body.status || 'draft', badge: body.status || 'draft', categories: [] });
      created.d = { ...created.d, internal_notes: null };
      applyBody(w, created, body);
      w.products.unshift(created);
      return route.fulfill({ status: 201, json: { success: true, data: detailOf(created) } });
    }
    const one = /^\/products\/(\d+)$/.exec(p);
    if (one) {
      const found = w.products.find((x) => x.id === Number(one[1]));
      if (!found) return route.fulfill({ status: 404, json: { success: false, message: 'Product not found.' } });
      if (m === 'PATCH') applyBody(w, found, body);
      return route.fulfill({ json: { success: true, data: detailOf(found) } });
    }
    const media = /^\/products\/(\d+)\/media(?:\/(order|\d+))?$/.exec(p);
    if (media) {
      const found = w.products.find((x) => x.id === Number(media[1]));
      let list = found.d.media;
      if (m === 'POST' && !media[2]) {
        const raw = req.postDataBuffer()?.toString('latin1') || '';
        w.uploads.push({ product: found.id, name: /filename="([^"]+)"/.exec(raw)?.[1] || '' });
        const id = w.nextId++;
        list = [...list, { id, url: img(id), type: 'photo', sort_order: list.length }];
      }
      if (m === 'PUT' && media[2] === 'order') list = body.ids.map((id, i) => ({ ...list.find((x) => x.id === id), sort_order: i }));
      found.d.media = list;
      return route.fulfill({ json: { success: true, data: detailOf(found) } });
    }
    if (p === '/product-categories' && m === 'GET') return route.fulfill({ json: { success: true, data: { categories: w.categories, total: w.products.length } } });
    if (p === '/memories' && m === 'GET') return route.fulfill({ json: { success: true, data: { latest_memories: [], sharedWith: [], published: [], shopify: { count: 0, collections: [] }, all_memories: { data: [], pagination: { current_page: 1, per_page: 50, total: 0, last_page: 1 } }, sidebar: { categories: { title: 'Categories', count: 1, items: [{ id: 5, name: 'Campaigns', color: '#6366F1', memory_count: 0, admin_id: null, memories: [] }] }, labels: { title: 'Labels', count: 0, items: [] } }, filters: { authors: [] } } } });
    if (p === '/user/memory-counts') return route.fulfill({ json: { success: true, data: { memory_counts: { total_memories: 0, total_memory_images: 0, published_memories: 0 } } } });
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: true, reason: null, item_count: 1, source: null, scan: null, limits: { item_limit: 500, sync_now_minutes: 15 } } } });
    if (p === '/cars') return route.fulfill({ json: { success: true, data: { cars: [], pagination: { last_page: 1 }, filters: {} } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 0, memory_limit: 50 } } } });
    if (p.startsWith('/dashboard')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(`${width}: ${e.message}`));
  if (process.env.C20_DEBUG) page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.log('    nav', f.url()); });
  if (process.env.C20_DEBUG) page.on('console', (m) => { if (/Updating URL|Navigating|Initial URL|Detected/i.test(m.text())) console.log('    console', m.text().slice(0, 160)); });
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(3000);
  return { context, page };
}

const productPage = (page) => page.getByTestId('product-page');
const visible = (loc) => loc.filter({ visible: true });
async function isShown(loc) { return (await visible(loc).count()) > 0; }

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = `${width}`;
    const phone = width < 768;
    const w = world();
    const { page, context } = await open(w, { width, height });

    // 1. Products grid: the photo-less "Full Legs" shows the brand, not the grey box.
    await page.getByTestId('products-page').waitFor({ timeout: 15000 }).catch(() => {});
    const legs = page.getByTestId('product-card').filter({ hasText: 'Full Legs' });
    expect(await legs.getByTestId('product-card-brand').count() === 1, `${tag}: a product with no photo shows the brand cover on its card`);
    expect(await legs.locator('img[src*="pr-logo"]').count() > 0, `${tag}: … the account's logo`);
    expect(await page.getByTestId('product-card').filter({ hasText: 'Half Arms' }).getByTestId('product-card-brand').count() === 0, `${tag}: a product with a photo keeps its photo`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${tag}-01-grid-branded.png` });

    // 2. Add a product.
    await visible(page.getByRole('button', { name: /Add a product/ })).first().click();
    const editor = page.getByTestId('product-editor');
    await editor.waitFor({ timeout: 8000 });
    // Chris 21 Nov: Cover photo or Intro Video above Media (UI only).
    const cover = editor.getByTestId('product-cover-field');
    await cover.scrollIntoViewIfNeeded();
    expect(await cover.getByRole('button', { name: 'Add Intro Video' }).isVisible(), `${tag}: the editor offers Add Intro Video`);
    expect(await cover.getByRole('button', { name: 'Add Cover Photo' }).isVisible(), `${tag}: … and Add Cover Photo`);
    await page.screenshot({ path: `${OUT}/${tag}-intro-01-empty.png` });
    await editor.getByTestId('product-intro-video-input').setInputFiles({ name: 'waxing-intro.mov', mimeType: 'video/quicktime', buffer: Buffer.from('x') });
    // The pick is read into memory first (c21 P1), so it shows a moment later.
    expect(await editor.getByTestId('product-cover-choice-video').waitFor({ timeout: 5000 }).then(() => true, () => false), `${tag}: the picked video shows`);
    await page.screenshot({ path: `${OUT}/${tag}-intro-02-picked.png` });
    await editor.getByRole('button', { name: 'Remove intro video' }).click();
    expect(await cover.getByRole('button', { name: 'Add Intro Video' }).isVisible(), `${tag}: removing it brings the button back`);
    await editor.locator('#p-title').fill('Half Front Torso');
    await editor.locator('#p-short').fill('All our waxing services are performed with Hard Wax. All Services are gender neutral');
    await editor.getByRole('textbox', { name: 'Full description' }).click();
    await page.keyboard.type('Hair removed from the front body');
    await editor.locator('#p-price').fill('45');
    await editor.getByRole('checkbox', { name: 'Body' }).check();
    await editor.locator('#p-buy').fill(FRESHA);
    expect(await editor.getByTestId('product-buy-label').isVisible(), `${tag}: the editor offers "Button text" next to the link`);
    expect((await editor.getByTestId('product-buy-label').getAttribute('placeholder')) === 'Buy now', `${tag}: … with "Buy now" as its placeholder`);
    await editor.getByTestId('product-buy-label').fill('Book now');
    if (width === 1280) {
      await editor.locator('#p-buy-label').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${tag}-02-editor-button-text.png` });
    }
    await visible(editor.getByRole('button', { name: 'Save', exact: true })).first().click();
    await productPage(page).waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const post = w.calls.find((c) => c.m === 'POST' && c.p === '/products');
    expect(post?.body?.buy_label === 'Book now' && post?.body?.buy_url === FRESHA, `${tag}: the save sends buy_url + buy_label`);

    // 3. The product page: details + Buy button, never internal settings.
    const checkPage = async (label) => {
      const details = visible(productPage(page).getByTestId('product-page-details'));
      expect(await details.count() > 0, `${tag} ${label}: the details section is on the page`);
      const text = (await details.first().innerText().catch(() => '')) || '';
      expect(text.includes('All our waxing services are performed with Hard Wax'), `${tag} ${label}: short description shows`);
      expect(text.includes('Hair removed from the front body'), `${tag} ${label}: full description shows`);
      expect(/PRICE\s*\$45 CAD/i.test(text), `${tag} ${label}: price row shows`);
      expect(/CATEGORY\s*Body/i.test(text), `${tag} ${label}: category row shows`);
      const all = await productPage(page).innerText();
      expect(!/Enquire button|PHOTOS\s*(Shown|Hidden)|Wax supplier/i.test(all), `${tag} ${label}: no internal settings / notes on the page`);
      expect(!/Untitled moment/.test(all), `${tag} ${label}: no "Untitled moment"`);
      expect(!/Buy link/.test(all), `${tag} ${label}: no small "Buy link" text any more`);
      const buy = visible(productPage(page).getByTestId('product-buy-button')).first();
      expect(await buy.isVisible().catch(() => false), `${tag} ${label}: the Buy button shows`);
      const a = buy.locator('a');
      expect((await a.innerText().catch(() => '')).trim() === 'Book now', `${tag} ${label}: … reading "Book now"`);
      expect((await a.getAttribute('href').catch(() => null)) === FRESHA && (await a.getAttribute('target')) === '_blank', `${tag} ${label}: … opening the Fresha link in a new tab`);
    };
    await checkPage('after save');
    await page.screenshot({ path: `${OUT}/${tag}-03-page-after-save.png` });
    if (phone) {
      await visible(productPage(page).getByTestId('product-page-details')).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${tag}-03b-page-details-scrolled.png` });
    }
    const productUrl = page.url();
    if (process.env.C20_DEBUG) { console.log('    url after save', productUrl); await page.reload(); await page.waitForTimeout(4000); console.log('    after reload', page.url()); process.exit(0); }

    // 4. Reload: still right.
    await page.reload();
    await page.waitForTimeout(3500);
    expect(page.url() === productUrl, `${tag}: reload stays on the product page (${page.url()})`);
    await checkPage('after reload');
    // No photo yet: the cover is the brand (CampaignCover in brand mode with the logo), never the letter placeholder.
    const brandCover = visible(productPage(page).locator('[data-cover-mode="brand"] img[src*="pr-logo"], [data-cover-mode="pending"] img[src*="pr-logo"]'));
    expect(await brandCover.count() > 0, `${tag}: a product with no photo shows the brand cover on its page`);
    await page.screenshot({ path: `${OUT}/${tag}-04-page-reloaded-brand-cover.png` });

    // 5. Edit Cover: upload a photo → it becomes the cover (first media item).
    const newId = w.products[0].id;
    const chooser = page.waitForEvent('filechooser', { timeout: 8000 });
    if (phone) {
      const pill = visible(page.getByTestId('phone-edit-cover')).first();
      expect(await pill.isVisible().catch(() => false), `${tag}: the phone cover has Edit Cover`);
      await pill.click();
    } else {
      const btn = visible(page.getByTestId('desktop-edit-cover')).first();
      expect(await btn.isVisible().catch(() => false), `${tag}: the cover has Edit Cover`);
      await btn.click();
      const menu = page.getByRole('dialog').filter({ hasText: 'Upload from Desktop' });
      expect(!(await isShown(menu.getByText('YouTube Video'))), `${tag}: no YouTube option for a product cover`);
      await page.screenshot({ path: `${OUT}/${tag}-05-edit-cover-menu.png` });
      await menu.getByText('Upload from Desktop').click();
    }
    const fc = await chooser.catch(() => null);
    expect(!!fc, `${tag}: Edit Cover opens the file window`);
    if (fc) await fc.setFiles({ name: 'studio-room.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    await page.waitForTimeout(3500);
    expect(w.uploads.some((u) => u.product === newId), `${tag}: the photo was uploaded to the product`);
    const media = w.products.find((x) => x.id === newId).d.media;
    expect(media.length === 1 && media[0].sort_order === 0, `${tag}: it is the product's first media item`);
    const coverSrc = media[0]?.url || '';
    expect(await visible(productPage(page).locator(`img[src="${coverSrc}"]`)).count() > 0, `${tag}: the new cover shows on the page`);
    const names = await productPage(page).innerText();
    expect(!/Untitled moment/.test(names), `${tag}: the photo moment is not "Untitled moment"`);
    await page.screenshot({ path: `${OUT}/${tag}-06-after-edit-cover.png` });

    // A second photo through Edit Cover goes FIRST (the cover), the old one second.
    if (!phone) {
      const chooser2 = page.waitForEvent('filechooser', { timeout: 8000 });
      await visible(page.getByTestId('desktop-edit-cover')).first().click();
      await page.getByRole('dialog').filter({ hasText: 'Upload from Desktop' }).getByText('Upload from Desktop').click();
      const fc2 = await chooser2.catch(() => null);
      if (fc2) await fc2.setFiles({ name: 'second.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
      await page.waitForTimeout(3500);
      const m2 = [...w.products.find((x) => x.id === newId).d.media].sort((a, b) => a.sort_order - b.sort_order);
      expect(m2.length === 2 && m2[0].id !== media[0].id && m2[1].id === media[0].id, `${tag}: a newer Edit Cover pick goes first, the old cover second`);
      const timeline = await visible(productPage(page).getByTestId('product-page-left')).first().innerText().catch(() => '');
      expect(timeline.includes('Half Front Torso') && timeline.includes('Photo 2'), `${tag}: the photo moments read "Half Front Torso" / "Photo 2"`);
      await page.screenshot({ path: `${OUT}/${tag}-07-two-photos-named.png` });
      const order = async () => (await visible(productPage(page).getByTestId('product-page-left')).first().innerText()).split('\n').filter((l) => l === 'Half Front Torso' || l === 'Photo 2');
      expect(JSON.stringify(await order()) === JSON.stringify(['Half Front Torso', 'Half Front Torso', 'Photo 2']), `${tag}: the new cover photo is first in the timeline right away`);
      await page.reload(); await page.waitForTimeout(3500);
      expect(JSON.stringify(await order()) === JSON.stringify(['Half Front Torso', 'Half Front Torso', 'Photo 2']), `${tag}: … and after a reload`);
    }

    // 6. Website product (Royal Wood): one Category row, no category leaking into every spec, no "Untitled moment".
    await page.goto(`${BASE}/products`);
    await page.waitForTimeout(2500);
    await page.getByTestId('product-card').filter({ hasText: 'WVF-WO-4X8-RIFT-POLY' }).locator('button').first().click();
    await page.waitForTimeout(2500);
    const wtext = await productPage(page).innerText().catch(() => '');
    expect((wtext.match(/Sheet Stock/g) || []).length <= 3, `${tag}: website product — "Sheet Stock" is not repeated in every spec (${(wtext.match(/Sheet Stock/g) || []).length}×)`);
    expect(/MATERIAL\s*White Oak/i.test(wtext) && /SIZE\s*4' x 8'/i.test(wtext), `${tag}: website product — its real specs show`);
    expect(!/LEAD TIME|PRODUCT CODE|SUB-CATEGORY/i.test(wtext), `${tag}: website product — placeholder / repeated rows are left out`);
    expect(!/Untitled moment/.test(wtext), `${tag}: website product — no "Untitled moment"`);
    expect(!(await isShown(productPage(page).getByTestId('desktop-edit-cover'))) && !(await isShown(productPage(page).getByTestId('phone-edit-cover'))), `${tag}: website product — no Edit Cover (its photos come from the website)`);
    await page.screenshot({ path: `${OUT}/${tag}-08-website-product.png` });
    // The photo viewer's panel: no Enquire / Photos lines, Category once.
    if (!phone) {
      // A moment card's photo (not the cover) opens the photo viewer.
      const cardImgs = visible(productPage(page).locator('img[src*="/pr-img/"]'));
      for (let i = (await cardImgs.count()) - 1; i >= 0 && !(await isShown(page.getByText(/Image \d+ of \d+/))); i--) {
        await cardImgs.nth(i).click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1200);
      }
      expect(await isShown(page.getByText(/Image \d+ of \d+/)), `${tag}: the photo viewer opens from a product photo`);
      const viewer = await page.locator('body').innerText();
      expect(/White Oak/.test(viewer) && /SKU/i.test(viewer), `${tag}: viewer panel — the description and specs show`);
      expect(!/ENQUIRE BUTTON|Enquire button/.test(viewer) && !/PHOTOS\s*\n?\s*Shown/i.test(viewer), `${tag}: viewer panel — no internal settings`);
      // The page behind the viewer has its own details section: once there + once in the viewer's panel.
      expect(((viewer.match(/\bCATEGORY\b/gi) || []).length) <= 2, `${tag}: viewer panel — Category once`);
      await page.screenshot({ path: `${OUT}/${tag}-09-viewer-panel.png` });
      await page.keyboard.press('Escape');
    }

    // 7. The photo-less "Full Legs" page: the brand cover.
    await page.goto(`${BASE}/products`);
    await page.waitForTimeout(2500);
    await page.getByTestId('product-card').filter({ hasText: 'Full Legs' }).locator('button').first().click();
    await page.waitForTimeout(2500);
    expect(await visible(productPage(page).locator('img[src*="pr-logo"]')).count() > 0, `${tag}: "Full Legs" page — the brand cover (logo), not a letter`);
    await page.screenshot({ path: `${OUT}/${tag}-10-photoless-product-brand.png` });
    await context.close();
  }
} finally {
  await browser.close();
}
const errs = pageErrors.filter((e) => !/ResizeObserver|Failed to fetch|NetworkError|blockedbyclient/i.test(e));
if (errs.length) { console.log('page errors:', errs); }
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
