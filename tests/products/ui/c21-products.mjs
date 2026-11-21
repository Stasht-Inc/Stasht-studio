// tests/products/ui/c21-products.mjs — Chris 21 Nov 2026, P1 + P2, in the real app with every API call answered here.
// P1: edit "Full Arms" → the Cover field shows its current cover → pick a cover photo → pick an intro video → Save →
// reopen: the intro video shows → its page plays the intro video → reload → still → Remove → the brand cover → reload.
// A new product with a cover photo picked before its first save. A website product: the picker is off.
// P2: the buy button ("Add to Cart") sits under the Description card, after Price/Category, before the Timeline, and
// below the Author row — at 1280 and 390. Fixtures copied from product-intro-video-ui.mjs (below the original header).
// Original header: tests/products/ui/product-intro-video-ui.mjs — c20-product-page walk + the 21 Nov Cover/Intro Video picker (UI only).
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
const BASE = process.env.C21_BASE || 'http://127.0.0.1:5251';
const OUT = process.env.C21_SHOTS || '/Users/deepaksharma/Pictures/Personal-Works/Stasht-Project/handoff-20261114/c21-P-shots';
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
    ...p.d, buy_button: p.d.buy_label || 'Buy now', media, cover_removed: Boolean(p.coverRemoved && media.length),
    main_image: p.coverRemoved && media.length ? null : ([...media].sort((a, b) => a.sort_order - b.sort_order).find((m) => m.type === 'photo')?.url || p.main_image || null),
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
      product(804, 'Full Arms', { price: '65.00', price_label: '$65 CAD', d: { short_description: 'All our waxing services are performed with Hard Wax. All Services are gender neutral', description: 'Includes hands and fingers.', description_html: '<p>Includes hands and fingers.</p>', buy_url: FRESHA, buy_label: 'Add to Cart', tags: [], attributes: [], internal_notes: null,
        media: [{ id: 8041, url: img(4), type: 'photo', sort_order: 0 }] } }),
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
    if (url.pathname.startsWith('/pr-vid/')) return route.fulfill({ contentType: 'video/mp4', body: Buffer.alloc(0) });
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
        const name = /filename="([^"]+)"/.exec(raw)?.[1] || '';
        w.uploads.push({ product: found.id, name });
        const id = w.nextId++;
        const isVideo = /\.(mp4|mov|webm)$/i.test(name);
        if (isVideo && list.some((x) => x.type === 'video')) return route.fulfill({ status: 422, json: { success: false, message: 'The given data was invalid.', errors: { file: ['A product can have one video.'] } } });
        list = [...list, { id, url: isVideo ? `${BASE}/pr-vid/${id}.mp4` : img(id), type: isVideo ? 'video' : 'photo', sort_order: list.length }];
      }
      if (m === 'PUT' && media[2] === 'order') { list = body.ids.map((id, i) => ({ ...list.find((x) => x.id === id), sort_order: i })); found.coverRemoved = false; }
      if (m === 'DELETE' && /^\d+$/.test(media[2] || '')) list = list.filter((x) => x.id !== Number(media[2]));
      found.d.media = list;
      return route.fulfill({ json: { success: true, data: detailOf(found) } });
    }
    const coverDel = /^\/products\/(\d+)\/cover$/.exec(p);
    if (coverDel && m === 'DELETE') {
      const found = w.products.find((x) => x.id === Number(coverDel[1]));
      if (!found.d.media.length) return route.fulfill({ status: 422, json: { success: false, message: 'This product has no cover to remove.' } });
      found.coverRemoved = true;
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
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const box = async (loc) => (await visible(loc).count()) ? visible(loc).first().boundingBox() : null;

async function openProduct(page, title) {
  await page.goto(`${BASE}/products`);
  await page.getByTestId('products-page').waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.getByTestId('product-card').filter({ hasText: title }).locator('button').first().click();
  await productPage(page).waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2500);
}
async function openEditor(page) {
  await visible(page.getByRole('button', { name: 'Edit', exact: true })).first().click();
  const editor = page.getByTestId('product-editor');
  await editor.waitFor({ timeout: 8000 });
  await page.waitForTimeout(800);
  const cover = editor.getByTestId('product-cover-field');
  await cover.scrollIntoViewIfNeeded();
  return { editor, cover };
}

// P2: Author row < Description card < buy button < Timeline (phone: the details sheet under the cover).
async function checkButtonPlace(page, tag, label, phone) {
  const pp = productPage(page);
  const details = await box(pp.getByTestId('product-page-details'));
  const buy = await box(pp.getByTestId('product-buy-button'));
  expect(!!details && !!buy, `${tag} ${label}: details card and buy button both on the page`);
  if (!details || !buy) return;
  expect(buy.y >= details.y + details.height - 1, `${tag} ${label}: the buy button is BELOW the Description card (button ${Math.round(buy.y)}, card ends ${Math.round(details.y + details.height)})`);
  expect(await visible(pp.getByTestId('product-buy-button')).count() === 1, `${tag} ${label}: one buy button only`);
  const text = (await visible(pp.getByTestId('product-buy-button')).first().innerText()).trim();
  expect(text === 'Add to Cart', `${tag} ${label}: it reads "Add to Cart" (${text})`);
  // Tablet (768–1023): this page shows no Author row or Timeline header there (its photos follow as "Media").
  if (page.viewportSize().width >= 768 && page.viewportSize().width < 1024) return;
  const author = await box(pp.getByText(/^Author:/));
  expect(!!author && author.y < buy.y, `${tag} ${label}: the Author row is above the button`);
  if (!phone) {
    const timeline = await box(pp.getByRole('heading', { name: 'Timeline' }));
    expect(!!timeline && buy.y + buy.height <= timeline.y + 1, `${tag} ${label}: the button is above the Timeline`);
  } else {
    // phone: the photos follow the details sheet (moment cards) — the button comes before the first one
    const firstMoment = await box(pp.locator('img[src*="/pr-img/"]').nth(1));
    expect(!firstMoment || firstMoment.y > buy.y, `${tag} ${label}: the button is above the timeline's photos`);
  }
}

try {
  for (const [width, height] of (process.env.C21_SIZES ? JSON.parse(process.env.C21_SIZES) : [[1280, 900], [390, 844]])) {
    const tag = `${width}`;
    const phone = width < 768;
    const w = world();
    const { page, context } = await open(w, { width, height });
    const arms = () => w.products.find((x) => x.id === 804);
    const sorted = () => [...arms().d.media].sort((a, b) => a.sort_order - b.sort_order);

    // 1. "Full Arms" page: P2 — Add to Cart under Description.
    await openProduct(page, 'Full Arms');
    await checkButtonPlace(page, tag, 'page', phone);
    if (phone) { await visible(productPage(page).getByTestId('product-page-details')).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(400); }
    await page.screenshot({ path: `${OUT}/${tag}-01-p2-button-below-description.png` });
    if (phone) {
      await visible(productPage(page).getByTestId('product-buy-button')).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${tag}-01b-p2-button-scrolled.png` });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
    }

    // 2. Edit → the Cover field shows the current cover (its first photo), with Remove.
    let { editor, cover } = await openEditor(page);
    expect(await cover.getByTestId('product-cover-choice-photo').isVisible(), `${tag}: editor shows the current cover photo`);
    expect((await cover.getByTestId('product-cover-thumb').getAttribute('src')) === img(4), `${tag}: … the product's first photo`);
    expect(await cover.getByRole('button', { name: 'Remove cover photo' }).isVisible(), `${tag}: … with Remove`);
    expect(await cover.getByRole('button', { name: 'Add Intro Video' }).isEnabled(), `${tag}: Add Intro Video is offered`);
    await page.screenshot({ path: `${OUT}/${tag}-02-editor-current-cover.png` });

    // 3. Pick a cover photo → uploaded and made first.
    await editor.getByTestId('product-cover-photo-input').setInputFiles({ name: 'arms-cover.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForTimeout(1500);
    expect(w.uploads.some((u) => u.product === 804 && u.name === 'arms-cover.png'), `${tag}: the cover photo was uploaded to the product`);
    const photoId = sorted()[0]?.id;
    expect(sorted()[0]?.type === 'photo' && photoId !== 8041 && sorted()[1]?.id === 8041, `${tag}: it is now the first media item (old photo second)`);
    expect((await cover.getByTestId('product-cover-choice-photo').innerText()).includes('arms-cover.png'), `${tag}: the field shows the picked photo's name`);
    expect((await editor.getByTestId('product-cover-thumb').getAttribute('src')) === img(photoId), `${tag}: … and its thumbnail`);
    await page.screenshot({ path: `${OUT}/${tag}-03-editor-cover-photo-picked.png` });

    // 4. Pick an intro video → uploaded and made first; the photo stays in Media.
    await editor.getByTestId('product-intro-video-input').setInputFiles({ name: 'arms-intro.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fake-mp4') });
    await page.waitForTimeout(1500);
    expect(sorted()[0]?.type === 'video', `${tag}: the intro video is the first media item`);
    expect(sorted().filter((m) => m.type === 'photo').length === 2, `${tag}: both photos stay in Media`);
    expect(await cover.getByTestId('product-cover-choice-video').isVisible() && (await cover.getByTestId('product-cover-choice-video').innerText()).includes('arms-intro.mp4'), `${tag}: the field shows the intro video`);
    expect(await cover.getByRole('button', { name: 'Add Cover Photo' }).isVisible(), `${tag}: … and Cover photo goes back to its button (one or the other)`);
    await page.screenshot({ path: `${OUT}/${tag}-04-editor-intro-video-picked.png` });

    // 4b. A second intro video replaces the first (a product has one video).
    const firstVideo = sorted()[0].id;
    await editor.getByTestId('product-intro-video-input').setInputFiles({ name: 'arms-intro-2.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fake-mp4-2') });
    await page.waitForTimeout(1500);
    expect(sorted().filter((m) => m.type === 'video').length === 1 && sorted()[0].type === 'video' && sorted()[0].id !== firstVideo, `${tag}: a new intro video replaces the old one`);
    expect(!(await isShown(editor.getByTestId('product-cover-error'))), `${tag}: no error under the field`);

    // 5. Save → the page plays the intro video in the cover; the button is still under the description.
    await visible(editor.getByRole('button', { name: 'Save', exact: true })).first().click();
    await page.waitForTimeout(2500);
    const vidUrl = sorted()[0].url;
    const coverVideo = visible(productPage(page).locator(`video[src^="${vidUrl}"]`));
    expect(await coverVideo.count() > 0, `${tag}: the product page shows the intro video as its cover`);
    expect(await isShown(productPage(page).locator('button:has(svg.lucide-play)')), `${tag}: … with the play button (as a campaign's intro video)`);
    await page.screenshot({ path: `${OUT}/${tag}-05-page-intro-video.png` });
    await checkButtonPlace(page, tag, 'after save', phone);

    // 6. Reload → still right; reopen the editor → the intro video is shown with Remove.
    await page.reload();
    await page.waitForTimeout(3500);
    expect(await visible(productPage(page).locator(`video[src^="${vidUrl}"]`)).count() > 0, `${tag}: after reload the page still plays the intro video`);
    await checkButtonPlace(page, tag, 'after reload', phone);
    ({ editor, cover } = await openEditor(page));
    expect(await cover.getByTestId('product-cover-choice-video').isVisible(), `${tag}: reopened editor shows the saved intro video`);
    expect(await cover.getByRole('button', { name: 'Remove intro video' }).isVisible(), `${tag}: … with Remove`);
    await page.screenshot({ path: `${OUT}/${tag}-06-editor-reopened-intro-video.png` });

    // 7. Remove → the brand cover (I10); every photo / video stays.
    const before = arms().d.media.length;
    await cover.getByRole('button', { name: 'Remove intro video' }).click();
    await page.waitForTimeout(1200);
    expect(arms().coverRemoved === true && arms().d.media.length === before, `${tag}: Remove = Remove cover (media kept)`);
    expect(await cover.getByRole('button', { name: 'Add Intro Video' }).isVisible() && await cover.getByRole('button', { name: 'Add Cover Photo' }).isVisible(), `${tag}: the field is empty again`);
    await page.screenshot({ path: `${OUT}/${tag}-07-editor-removed.png` });
    await visible(editor.getByRole('button', { name: 'Save', exact: true })).first().click();
    await page.waitForTimeout(2500);
    const brand = visible(productPage(page).locator('[data-cover-mode="brand"] img[src*="pr-logo"], [data-cover-mode="pending"] img[src*="pr-logo"]'));
    expect(await brand.count() > 0, `${tag}: the page shows the brand (avatar) cover`);
    expect(await visible(productPage(page).locator('video[src*="/pr-vid/"]')).count() === 0, `${tag}: … no intro video`);
    await page.screenshot({ path: `${OUT}/${tag}-08-page-brand-cover.png` });
    await page.reload();
    await page.waitForTimeout(3500);
    expect(await visible(productPage(page).locator('[data-cover-mode="brand"] img[src*="pr-logo"], [data-cover-mode="pending"] img[src*="pr-logo"]')).count() > 0, `${tag}: after reload still the brand cover`);
    ({ editor, cover } = await openEditor(page));
    expect(!(await isShown(cover.getByTestId('product-cover-choice-photo'))) && !(await isShown(cover.getByTestId('product-cover-choice-video'))), `${tag}: reopened editor: no cover`);
    // Picking a cover photo again brings a cover back (the order clears Remove cover).
    await editor.getByTestId('product-cover-photo-input').setInputFiles({ name: 'back.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForTimeout(1500);
    expect(arms().coverRemoved === false && sorted()[0].type === 'photo', `${tag}: a new cover photo after Remove is the cover again`);
    await visible(editor.getByRole('button', { name: 'Cancel' })).first().click();
    await page.waitForTimeout(2500);
    expect(await visible(productPage(page).locator(`img[src="${sorted()[0].url}"]`)).count() > 0, `${tag}: the page shows that cover photo`);
    await page.screenshot({ path: `${OUT}/${tag}-09-page-cover-photo-again.png` });

    // 8. A new product: the cover photo picked before the first save uploads first.
    await page.goto(`${BASE}/products`);
    await page.waitForTimeout(2500);
    await visible(page.getByRole('button', { name: /Add a product/ })).first().click();
    editor = page.getByTestId('product-editor');
    await editor.waitFor({ timeout: 8000 });
    await editor.locator('#p-title').fill('Full Back');
    await editor.locator('#p-short').fill('Back and shoulders.');
    await editor.locator('#p-price').fill('75');
    // An intro video picked, then removed: dropped (it was only on the device).
    await editor.getByTestId('product-intro-video-input').setInputFiles({ name: 'dropped.mp4', mimeType: 'video/mp4', buffer: Buffer.from('v') });
    await page.waitForTimeout(400);
    expect(await editor.getByTestId('product-cover-choice-video').isVisible(), `${tag}: new product — the picked intro video shows`);
    await editor.getByRole('button', { name: 'Remove intro video' }).click();
    expect(await editor.getByRole('button', { name: 'Add Intro Video' }).isVisible(), `${tag}: new product — Remove drops the pick`);
    await editor.getByTestId('product-cover-photo-input').setInputFiles({ name: 'back-cover.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForTimeout(500);
    expect(await editor.getByTestId('product-cover-choice-photo').isVisible(), `${tag}: new product — the picked cover shows before saving`);
    await page.screenshot({ path: `${OUT}/${tag}-10-new-product-cover-picked.png` });
    await visible(editor.getByRole('button', { name: 'Save', exact: true })).first().click();
    await page.waitForTimeout(3500);
    const created = w.products.find((x) => x.title === 'Full Back');
    expect(!!created && created.d.media.length === 1 && w.uploads.some((u) => u.product === created.id && u.name === 'back-cover.png'), `${tag}: new product — the cover uploaded after the first save`);
    expect(!w.uploads.some((u) => u.name === 'dropped.mp4'), `${tag}: new product — the removed intro video was never uploaded`);
    expect(created && await visible(productPage(page).locator(`img[src="${created.d.media[0]?.url}"]`)).count() > 0, `${tag}: new product — its page shows the cover`);
    await page.screenshot({ path: `${OUT}/${tag}-11-new-product-page.png` });

    await context.close();
  }

  // Website product editor (opened from the Products page's editor path): buttons disabled.
  {
    const w = world();
    const { page, context } = await open(w, { width: 1280, height: 900 });
    await openProduct(page, 'WVF-WO-4X8-RIFT-POLY');
    // A website product's editor opens from ⋯ → Edit settings (only Studio's own fields).
    await visible(page.getByRole('button', { name: 'More actions' })).first().click();
    await page.getByRole('menuitem', { name: 'Edit settings' }).click();
    const editor = page.getByTestId('product-editor');
    await editor.waitFor({ timeout: 8000 });
    await page.waitForTimeout(800);
    const cover = editor.getByTestId('product-cover-field');
    await cover.scrollIntoViewIfNeeded();
    expect(await cover.getByRole('button', { name: 'Add Intro Video' }).isDisabled(), '1280: website product — Add Intro Video is off');
    expect(await cover.getByRole('button', { name: 'Remove cover photo' }).isDisabled(), '1280: website product — its cover shows, Remove is off');
    await page.screenshot({ path: `${OUT}/1280-12-website-product-cover-off.png` });
    await context.close();
  }
} finally {
  await browser.close();
}
const errs = pageErrors.filter((e) => !/ResizeObserver|Failed to fetch|NetworkError|blockedbyclient/i.test(e));
if (errs.length) { console.log('page errors:', errs); }
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
