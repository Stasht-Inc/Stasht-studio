// tests/products/ui/c20i-products.mjs — Chris 20 Nov 2026, issues after the deploy, in the real app (every API call answered
// here, nothing leaves this machine), at 1280 and 390:
//  I4 — no source badge ("Manual" / "Website") on the Products cards or the product page header; status / category /
//       price badges stay; Filters → Source still filters (?source=manual).
//  I5 — "Import from your website" is the page's secondary outlined button (white, grey border); "+ Add a product"
//       stays the purple primary.
//  I10 — product page Edit Cover → Remove cover → confirm → DELETE /products/{id}/cover → the brand cover shows, both
//       photos stay in the timeline; reload → still the brand; the Products card shows the brand and still "2 photos";
//       Edit Cover → upload → a cover again (the order call brings it back).
// node tests/products/ui/c20i-products.mjs  (C20I_BASE = dev server, default http://127.0.0.1:5241; C20I_SHOTS)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.C20I_BASE || 'http://127.0.0.1:5241';
const OUT = process.env.C20I_SHOTS || '/Users/deepaksharma/Pictures/Personal-Works/Stasht-Project/handoff-20261114/c20i-P-shots';
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
    ...p.d, buy_button: p.d.buy_label || 'Buy now', media, main_image: p.coverRemoved ? null : media.find((m) => m.type === 'photo')?.url || p.main_image || null,
    cover_removed: Boolean(p.coverRemoved),
    images_count: media.filter((m) => m.type === 'photo').length, editable_fields: p.origin === 'manual' ? MANUAL : WEBSITE,
  };
}
const summaryOf = (p) => { const d = detailOf(p); return { ...p, d: undefined, main_image: d.main_image, images_count: d.images_count, cover_removed: d.cover_removed }; };

function world() {
  return {
    nextId: 900, calls: [], uploads: [],
    products: [
      product(801, 'Half Arms', { d: { ...product(0, '').d, media: [{ id: 8011, url: img(1), type: 'photo', sort_order: 0 }, { id: 8012, url: img(2), type: 'photo', sort_order: 1 }] } }),
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
    if (p === '/products' && m === 'GET') w.listQueries = [...(w.listQueries || []), url.search];
    if (p === '/products' && m === 'GET' && url.searchParams.get('source')) {
      const items = w.products.filter((x) => x.origin === url.searchParams.get('source')).map(summaryOf);
      return route.fulfill({ json: { success: true, data: { items, pagination: { current_page: 1, per_page: 48, total: items.length, last_page: 1 } } } });
    }
    // Remove cover (I10), as ProductMediaController::removeCover: the photos stay, main_image goes, cover_removed.
    const cover = /^\/products\/(\d+)\/cover$/.exec(p);
    if (cover && m === 'DELETE') {
      const found = w.products.find((x) => x.id === Number(cover[1]));
      w.coverDeletes = [...(w.coverDeletes || []), found.id];
      found.coverRemoved = true;
      return route.fulfill({ json: { success: true, data: detailOf(found) } });
    }
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
      if (m === 'PUT' && media[2] === 'order') { list = body.ids.map((id, i) => ({ ...list.find((x) => x.id === id), sort_order: i })); found.coverRemoved = false; }
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
    await page.getByTestId('product-card').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);

    // ── I4: no source badges on the cards ─────────────────────────────────────────────────────────────────────────
    const cards = page.getByTestId('product-card');
    for (const t of ['Half Arms', 'Full Legs', 'WVF-WO-4X8-RIFT-POLY']) {
      const c = cards.filter({ hasText: t }).first();
      expect(await c.getByText('Active', { exact: true }).isVisible(), `${tag}: "${t}" card keeps its status badge`);
      expect(!(await c.getByText(/^(Manual|Website|Shopify)$/).count()), `${tag}: "${t}" card has no source badge`);
    }
    expect(await cards.filter({ hasText: 'Half Arms' }).getByTestId('product-card-category').isVisible(), `${tag}: … the category pill stays`);

    // ── I5: Import is the outlined secondary, Add a product the primary ─────────────────────────────────────────────
    const look = (sel) => page.evaluate((s) => {
      const el = [...document.querySelectorAll(s)].find((e) => e.getBoundingClientRect().width > 0);
      if (!el) return null;
      const st = getComputedStyle(el);
      return { bg: st.backgroundColor, border: st.borderTopColor, bw: st.borderTopWidth, color: st.color, h: el.getBoundingClientRect().height };
    }, sel);
    const imp = await look('[data-testid="products-import"]');
    const addBtn = await page.evaluate(() => {
      const el = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === 'Add a product' && e.getBoundingClientRect().width > 0);
      return el ? { bg: getComputedStyle(el).backgroundColor, h: el.getBoundingClientRect().height } : null;
    });
    expect(imp && imp.bg === 'rgb(255, 255, 255)' && imp.bw === '1px' && imp.border === 'rgb(209, 213, 219)' && imp.color === 'rgb(55, 65, 81)', `${tag}: Import is outlined, no fill (${JSON.stringify(imp)})`);
    expect(addBtn && addBtn.bg === 'rgb(108, 96, 255)' && addBtn.h === imp?.h, `${tag}: Add a product stays the purple primary, same height (${JSON.stringify(addBtn)})`);
    await page.screenshot({ path: `${OUT}/${tag}-I4I5-01-products-grid.png` });

    // ── I4: Filters → Source still works ────────────────────────────────────────────────────────────────────────────
    await visible(page.getByRole('button', { name: /^Filters/ })).first().click();
    await page.getByRole('radio', { name: 'Manual' }).check();
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForTimeout(1200);
    expect((w.listQueries || []).some((q) => /source=manual/.test(q)), `${tag}: Filters → Source → Manual asks for ?source=manual`);
    expect(!(await cards.filter({ hasText: 'WVF-WO-4X8-RIFT-POLY' }).count()) && await cards.filter({ hasText: 'Half Arms' }).count() === 1, `${tag}: … and the grid shows only manual products`);
    await visible(page.getByRole('button', { name: /^Filters/ })).first().click();
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.waitForTimeout(1200);

    // ── I4 on the page header: manual product ──────────────────────────────────────────────────────────────────────
    await cards.filter({ hasText: 'Half Arms' }).locator('button').first().click();
    await productPage(page).waitFor({ timeout: 10000 });
    await page.waitForTimeout(2500);
    const header = await productPage(page).innerText();
    expect(/\$45 CAD/.test(header) && /\bActive\b/.test(header) && /\bBody\b/.test(header), `${tag}: product page keeps category, price and status badges`);
    expect(!/^\s*Manual\s*$/m.test(header), `${tag}: product page has no "Manual" badge`);
    expect(await visible(productPage(page).locator('img[src*="/pr-img/1."]')).count() > 0, `${tag}: the first photo is the cover`);
    await page.screenshot({ path: `${OUT}/${tag}-I4-02-manual-page-no-badge.png` });

    // ── I10: Edit Cover → Remove cover ─────────────────────────────────────────────────────────────────────────────
    if (phone) {
      await visible(page.getByRole('button', { name: 'More cover options' })).first().click();
      await page.waitForTimeout(400);
      const opt = visible(page.getByTestId('phone-remove-cover')).first();
      expect(await opt.isVisible().catch(() => false), `${tag}: the cover's ⋯ menu offers Remove cover`);
      await page.screenshot({ path: `${OUT}/${tag}-I10-01-cover-menu.png` });
      await opt.click();
    } else {
      await visible(page.getByTestId('desktop-edit-cover')).first().click();
      const menu = page.getByRole('dialog').filter({ hasText: 'Upload from Desktop' });
      expect(await menu.getByText('Remove cover').isVisible().catch(() => false), `${tag}: Edit Cover offers Remove cover`);
      await page.screenshot({ path: `${OUT}/${tag}-I10-01-cover-menu.png` });
      await menu.getByTestId('desktop-remove-cover').click();
    }
    const confirm = page.getByRole('alertdialog').filter({ hasText: 'Remove cover' });
    await confirm.waitFor({ timeout: 5000 });
    expect(/Its photos stay/.test(await confirm.innerText()), `${tag}: the confirm says the photos stay`);
    await page.screenshot({ path: `${OUT}/${tag}-I10-02-confirm.png` });
    await confirm.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.waitForTimeout(3000);
    expect(JSON.stringify(w.coverDeletes) === '[801]', `${tag}: DELETE /products/801/cover (${JSON.stringify(w.coverDeletes)})`);
    expect(!w.calls.some((c) => c.m === 'DELETE' && /\/media\//.test(c.p)), `${tag}: no photo was deleted`);
    const brand = () => visible(productPage(page).locator('img[src*="pr-logo"]')).count();
    const checkRemoved = async (label) => {
      expect(await brand() > 0, `${tag} ${label}: the page shows the brand (logo) as cover`);
      const left = await productPage(page).innerText();
      // Phones show the count over the cover and the moment cards as photos; wider screens list the moment names.
      expect(phone ? /Timeline\s*•?\s*2 moments/.test(left) : left.includes('Half Arms') && left.includes('Photo 2'), `${tag} ${label}: both photos are still moments (${phone ? '"2 moments"' : '"Half Arms", "Photo 2"'})`);
      expect(await visible(productPage(page).locator('img[src*="/pr-img/1."]')).count() > 0, `${tag} ${label}: … the first photo still shows as a moment`);
    };
    await checkRemoved('after remove');
    await page.screenshot({ path: `${OUT}/${tag}-I10-03-brand-cover.png` });
    // the menu no longer offers Remove cover
    if (!phone) {
      await visible(page.getByTestId('desktop-edit-cover')).first().click();
      expect(!(await page.getByRole('dialog').filter({ hasText: 'Upload from Desktop' }).getByText('Remove cover').count()), `${tag}: no Remove cover once the brand shows`);
      await page.keyboard.press('Escape');
    }
    await page.reload();
    await page.waitForTimeout(3500);
    await checkRemoved('after reload');

    // Products card: the brand, still 2 photos.
    await page.goto(`${BASE}/products`);
    await cards.first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(1000);
    const arms = cards.filter({ hasText: 'Half Arms' }).first();
    expect(await arms.getByTestId('product-card-brand').count() === 1, `${tag}: the Products card shows the brand`);
    expect((await arms.getByTestId('product-card-photos').getAttribute('aria-label')) === '2 photos', `${tag}: … and still "2 photos"`);
    await page.screenshot({ path: `${OUT}/${tag}-I10-04-grid-brand.png` });

    // Edit Cover → upload → a cover again.
    await arms.locator('button').first().click();
    await productPage(page).waitFor({ timeout: 10000 });
    await page.waitForTimeout(2500);
    const chooser = page.waitForEvent('filechooser', { timeout: 8000 });
    if (phone) await visible(page.getByTestId('phone-edit-cover')).first().click();
    else {
      await visible(page.getByTestId('desktop-edit-cover')).first().click();
      await page.getByRole('dialog').filter({ hasText: 'Upload from Desktop' }).getByText('Upload from Desktop').click();
    }
    const fc = await chooser.catch(() => null);
    if (fc) await fc.setFiles({ name: 'room.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    await page.waitForTimeout(3500);
    const arm = w.products.find((x) => x.id === 801);
    expect(!arm.coverRemoved && arm.d.media.length === 3, `${tag}: Edit Cover after Remove: a cover again, 3 photos`);
    const first = [...arm.d.media].sort((a, b) => a.sort_order - b.sort_order)[0];
    expect(await visible(productPage(page).locator(`img[src="${first.url}"]`)).count() > 0, `${tag}: … the new photo is the cover`);
    await page.screenshot({ path: `${OUT}/${tag}-I10-05-cover-back.png` });

    // ── I4 on a website product's header ────────────────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/products`);
    await cards.first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
    await cards.filter({ hasText: 'WVF-WO-4X8-RIFT-POLY' }).locator('button').first().click();
    await productPage(page).waitFor({ timeout: 10000 });
    await page.waitForTimeout(2500);
    const wt = await productPage(page).innerText();
    expect(!/^\s*Website\s*$/m.test(wt) && /\bActive\b/.test(wt) && /Sheet Stock/.test(wt), `${tag}: website product page: no "Website" badge; status + category stay`);
    expect(!(await isShown(page.getByTestId('desktop-remove-cover'))) && !(await isShown(page.getByTestId('phone-remove-cover'))), `${tag}: website product: no Remove cover`);
    await page.screenshot({ path: `${OUT}/${tag}-I4-03-website-page-no-badge.png` });
    await context.close();
  }
} finally {
  await browser.close();
}
const errs = pageErrors.filter((e) => !/ResizeObserver|Failed to fetch|NetworkError|blockedbyclient/i.test(e));
if (errs.length) { console.log('page errors:', errs); }
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nALL c20i products checks PASSED');
process.exit(failures.length || errs.length ? 1 : 0);
