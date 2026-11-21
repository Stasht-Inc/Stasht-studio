// tests/products/ui/c21-video-cover.mjs — Chris 21 Nov 2026 P11 (after deploy): a product whose cover is its intro video
// shows that video's first frame on its Products card, its page's Media lists the video, and a photo set as cover in the
// editor puts the photo back on the card. Mocks copied from c21-products.mjs, whose header follows.
// (was) tests/products/ui/c21-products.mjs — Chris 21 Nov 2026, P1 + P2, in the real app with every API call answered here.
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
import { mkdirSync, readFileSync } from 'fs';
const VIDEO = readFileSync(new URL('./fixtures/spinach-1s.mp4', import.meta.url));
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.C21_BASE || 'http://127.0.0.1:5251';
const OUT = process.env.C21_SHOTS || '/Users/deepaksharma/Pictures/Personal-Works/Stasht-Project/handoff-20261114/c21-P-shots/p11';
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
    cover_video: (() => { const f = [...media].sort((a, b) => a.sort_order - b.sort_order)[0]; return !p.coverRemoved && f?.type === 'video' ? f.url : null; })(),
    main_image: p.coverRemoved && media.length ? null : ([...media].sort((a, b) => a.sort_order - b.sort_order).find((m) => m.type === 'photo')?.url || p.main_image || null),
    images_count: media.filter((m) => m.type === 'photo').length, editable_fields: p.origin === 'manual' ? MANUAL : WEBSITE,
  };
}
const summaryOf = (p) => { const d = detailOf(p); return { ...p, d: undefined, main_image: d.main_image, images_count: d.images_count, cover_video: d.cover_video, cover_removed: d.cover_removed }; };

function world() {
  return {
    nextId: 900, calls: [], uploads: [],
    products: [
      product(801, 'Half Arms', { d: { ...product(0, '').d, media: [{ id: 8011, url: img(1), type: 'photo', sort_order: 0 }] } }),
      product(805, 'New Test Product', { price: '34.00', price_label: '$34 USD', currency: 'USD', d: { short_description: 'Anything', description: 'Full description', description_html: '<p>Full description</p>', buy_url: null, buy_label: null, tags: [], attributes: [], internal_notes: null,
        media: [{ id: 8052, url: `${BASE}/pr-vid/8052.mp4`, type: 'video', sort_order: 0 }, { id: 8051, url: img(1), type: 'photo', sort_order: 1 }] } }),
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
    if (url.pathname.startsWith('/pr-vid/')) return route.fulfill({ contentType: 'video/mp4', body: VIDEO }); // a real 1s clip: the card draws its first frame
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
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
async function isShownText(page, _l, re) { return re.test(await page.locator('body').innerText()); }
const card = (page) => page.getByTestId('product-card').filter({ hasText: 'New Test Product' });

async function grid(page) {
  await page.goto(`${BASE}/products`);
  await page.getByTestId('products-page').waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = `${width}`;
    const w = world();
    const { page, context } = await open(w, { width, height });
    const prod = () => w.products.find((x) => x.id === 805);
    await page.waitForTimeout(1000);

    // 1. Grid card: the intro video's first frame, not the photo (P11).
    expect(await card(page).getByTestId('product-cover-video').count() === 1, `${tag}: the card shows the intro video cover`);
    expect(await card(page).locator('video[src*="/pr-vid/8052.mp4"]').count() === 1, `${tag}: … the product's intro video`);
    expect(await card(page).locator(`img[src="${img(1)}"]`).count() === 0, `${tag}: … not the first photo`);
    await card(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${tag}-01-grid-video-cover.png` });

    // 2. Product page: the same intro video as cover; Media lists the video.
    await card(page).locator('button').first().click();
    await productPage(page).waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);
    expect(await visible(productPage(page).locator('video[src^="' + `${BASE}/pr-vid/8052.mp4` + '"]')).count() > 0, `${tag}: the page's cover is the intro video`);
    const all = await page.locator('body').innerText();
    if (width >= 1024) {
      expect(/Media\s*·\s*\(2 photos\)/.test(all), `${tag}: the Media panel counts both items (campaign label "photos")`);
      expect(await isShownText(page, 'Video', /\bVideo\b/), `${tag}: the Media panel lists the video (its "Video" tile)`);
    }
    await page.screenshot({ path: `${OUT}/${tag}-02-page-media-lists-video.png` });
    // the timeline: the video is a moment of its own (phone: scroll down to the moment cards)
    await page.mouse.wheel(0, 1400); await page.waitForTimeout(800);
    const timelineVideos = await visible(productPage(page).locator('video[src*="/pr-vid/8052.mp4"]')).count();
    const named = /\bVideo\b/.test(await visible(productPage(page)).first().innerText());
    expect(named || timelineVideos > 0, `${tag}: the timeline has the video moment (name ${named}, players ${timelineVideos})`);
    await page.screenshot({ path: `${OUT}/${tag}-02b-timeline-video-moment.png` });
    const vcard = visible(productPage(page).getByTestId('post-card-video')).first();
    expect(await vcard.count() > 0, `${tag}: the video moment card shows the video's first frame (not a broken image)`);
    if (await vcard.count()) {
      await vcard.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${tag}-02c-video-moment-card.png` });
      await vcard.click();
      await page.waitForTimeout(1500);
      const player = visible(page.getByTestId('viewer-video'));
      expect(await player.count() === 1 && (await player.first().getAttribute('controls')) !== null, `${tag}: tapping it opens the video in the viewer, with controls`);
      expect(!(await page.getByText('Image could not be loaded').count()), `${tag}: … not "Image could not be loaded"`);
      await page.screenshot({ path: `${OUT}/${tag}-02d-video-opened.png` });
      await page.keyboard.press('Escape'); await page.waitForTimeout(800);
      if (await page.getByText(/Image \d+ of \d+/).count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); }
    }
    await page.mouse.wheel(0, -3000); await page.waitForTimeout(500);
    expect(/2 moments/.test(all), `${tag}: the timeline counts the video (2 moments)`);

    // 3. Edit → set a photo as cover → Save → the card shows the photo.
    await visible(page.getByRole('button', { name: 'Edit', exact: true })).first().click();
    const editor = page.getByTestId('product-editor');
    await editor.waitFor({ timeout: 8000 });
    await page.waitForTimeout(600);
    expect(await editor.getByTestId('product-cover-choice-video').isVisible(), `${tag}: editor shows the intro video as cover`);
    await editor.getByTestId('product-cover-photo-input').setInputFiles({ name: 'photo-cover.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForTimeout(1500);
    const first = [...prod().d.media].sort((a, b) => a.sort_order - b.sort_order)[0];
    expect(first.type === 'photo', `${tag}: the photo is first now`);
    await visible(editor.getByRole('button', { name: 'Save', exact: true })).first().click();
    await page.waitForTimeout(2500);
    expect(await visible(productPage(page).locator(`img[src="${first.url}"]`)).count() > 0, `${tag}: the page shows the photo cover`);
    await grid(page);
    expect(await card(page).getByTestId('product-cover-video').count() === 0, `${tag}: the card no longer shows the video`);
    expect(await card(page).locator(`img[src="${first.url}"]`).count() === 1, `${tag}: the card shows the new cover photo`);
    await card(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${tag}-03-grid-photo-cover.png` });
    await page.reload(); await page.waitForTimeout(3000);
    expect(await card(page).locator(`img[src="${first.url}"]`).count() === 1, `${tag}: after reload the card still shows the photo`);
    await context.close();
  }
} finally {
  await browser.close();
}
const errs = pageErrors.filter((e) => !/ResizeObserver|Failed to fetch|NetworkError|blockedbyclient/i.test(e));
if (errs.length) { console.log('page errors:', errs); }
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
