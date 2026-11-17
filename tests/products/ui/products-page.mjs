// tests/products/ui/products-page.mjs — Products M2 in the real app, every API call answered here (nothing leaves this
// machine). Blocks: nav (Task 12), grid (13), details (post-live P1), editor (14), campaigns (15; Task 16 adds older-API, failed-status, Dashboard). Run one: PR_ONLY=nav node tests/products/ui/products-page.mjs
// Needs the dev server: PR_BASE (default http://localhost:5341). Screenshots: PR_SHOTS.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.PR_BASE || 'http://localhost:5341';
const OUT = process.env.PR_SHOTS || '/private/tmp/claude-501/products-ui';
const ONLY = process.env.PR_ONLY || '';
mkdirSync(OUT, { recursive: true });

const USER = { id: 70, external_user_id: 959, name: 'The Royal Wood Shop', email: 'owner@royalwood.test', role: '2', status: 1, is_activated: true, profile_color: '#0062A8' };
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="${['#6C60FF', '#F59E0B', '#10B981'][n % 3]}"/></svg>`;
const img = (n) => `${BASE}/pr-img/${n}.jpg`;

function product(id, title, over = {}) {
  return {
    id, user_id: 959, read_only: false, origin: 'manual', status: 'active', stock_status: 'in_stock', badge: 'active', title,
    price: '450.00', compare_at_price: null, currency: 'CAD', price_label: '$450 CAD', compare_at_label: '', price_on_request: false, show_price: true,
    main_image: img(id), images_count: 1, category: null, categories: [], sku: `SKU-${id}`, brand: null, url: null, updated_at: '2026-11-09T10:00:00Z', ...over,
  };
}
function detailOf(p) {
  const website = p.origin === 'website';
  return {
    ...p, short_description: null, description: null, description_html: null, product_type: null, barcode: null, quantity: null, availability: 'available',
    options: [], variants: [], attributes: [], weight: null, weight_unit: null, dimensions: null, tags: [], collections: [],
    seo: { slug: `p-${p.id}`, title: null, description: null, share_image: null }, buy_url: null, show_enquire: true,
    media: p.main_image ? [{ id: p.id * 10, url: p.main_image, type: 'photo', sort_order: 0 }] : [], internal_notes: '',
    editable_fields: p.read_only ? [] : website
      ? ['status', 'tags', 'collections', 'internal_notes', 'show_price', 'show_enquire', 'category_ids']
      : ['title', 'short_description', 'description_html', 'brand', 'product_type', 'price', 'compare_at_price', 'currency', 'price_on_request', 'sku', 'barcode', 'stock_status', 'quantity', 'options', 'variants', 'attributes', 'weight', 'weight_unit', 'dimensions', 'category_ids', 'tags', 'collections', 'status', 'show_enquire', 'show_price', 'slug', 'seo_title', 'seo_description', 'share_image', 'buy_url', 'internal_notes', 'media'],
    ...(p.extra || {}), // what the editor saved (options, variants, tags, slug) and the media routes changed
  };
}
// The detail-only fields a POST / PATCH body changes, kept on the product as p.extra (variants get ids, like the API).
function extrasFrom(body, prev, w) {
  const x = { ...(prev || {}) };
  if ('options' in body) x.options = body.options;
  if ('variants' in body) {
    x.variants = body.variants.map((v, i) => ({
      id: v.id || w.nextId++, title: Object.values(v.options).join(' / '), options: v.options, sku: v.sku, barcode: null,
      price: v.price != null ? String(v.price) : null, compare_at_price: v.compare_at_price != null ? String(v.compare_at_price) : null,
      price_label: '', stock_status: v.stock_status || 'in_stock', quantity: v.quantity, image_id: v.image_id ?? null, sort_order: i,
    }));
  }
  if ('tags' in body) x.tags = body.tags;
  if ('slug' in body) x.seo = { slug: body.slug || 'generated-slug', title: body.seo_title ?? null, description: body.seo_description ?? null, share_image: body.share_image ?? null };
  return x;
}

function world(over = {}) {
  return {
    pilot: true, reason: null, canCreate: true,
    products: [
      product(601, 'Walnut Chair', { compare_at_price: '500.00', compare_at_label: '$500 CAD', categories: [{ id: 1, name: 'Chairs' }] }),
      product(602, 'Draft Stool', { status: 'draft', badge: 'draft' }),
      product(603, 'Harbour Sofa', { origin: 'website', category: 'Sofas', categories: [{ id: 2, name: 'Sofas' }], url: 'https://royalwood.example.ca/harbour', price: '1299.00', price_label: '$1,299 CAD' }),
    ],
    categories: [{ id: 1, name: 'Chairs', from_website: false, product_count: 1, read_only: false }, { id: 2, name: 'Sofas', from_website: true, product_count: 1, read_only: false }],
    calls: [], nextId: 700, ...over,
  };
}
const statusOf = (w) => ({
  pilot: w.pilot, available: w.pilot && !w.reason, reason: w.pilot ? w.reason : 'not_available', can_create: w.canCreate,
  counts: { total: w.products.length, manual: w.products.filter((p) => p.origin === 'manual').length, website: w.products.filter((p) => p.origin === 'website').length },
  default_currency: w.defaultCurrency || 'USD',
});

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open(w, { width, height, path = '/products', view = 'personal', property = null } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user, view, property]) => {
    if (sessionStorage.getItem('pr-seeded')) return;
    sessionStorage.setItem('pr-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'tok');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', view);
    localStorage.setItem('stasht_campaigns_view', 'storeels');
    if (property) localStorage.setItem('selected_property', JSON.stringify(property));
  }, [USER, view, property]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/pr-img/')) return route.fulfill({ contentType: 'image/svg+xml', body: svg(Number(url.pathname.match(/(\d+)/)?.[1] ?? 0)) });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const m = req.method();
    let body = null;
    try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch { body = null; }
    w.calls.push({ m, p, q: url.search, body, view: req.headers()['x-stasht-property'] || null });
    // w.statusMode (Task 16): 'fail' = the status route errors (500), 'old' = an API without Products (404). The real
    // API renders an unmatched route as Laravel's HTML 404 page (Studio sends no Accept: application/json), so 'old'
    // answers HTML, which apiRequest can't parse and returns without a status code (final review C1).
    if (p === '/products/status' && w.statusMode === 'fail') return route.fulfill({ status: 500, json: { success: false, message: 'Server Error' } });
    if (p === '/products/status' && w.statusMode === 'old') return route.fulfill({ status: 404, contentType: 'text/html; charset=UTF-8', body: '<!DOCTYPE html><html lang="en"><head><title>Not Found</title></head><body><div>404 | Not Found</div></body></html>' });
    if (p === '/products/status') return route.fulfill({ json: { success: true, data: statusOf(w) } });
    // w.slowListMs / w.slowSaveMs (final review I3/I4): the list / a product save answers that much later.
    if (p === '/products' && m === 'GET' && w.slowListMs) await new Promise((r) => setTimeout(r, w.slowListMs));
    if (/^\/products(\/\d+)?$/.test(p) && (m === 'POST' || m === 'PATCH') && w.slowSaveMs) await new Promise((r) => setTimeout(r, w.slowSaveMs));
    if (p === '/products' && m === 'GET') {
      if (!w.pilot || w.reason) return route.fulfill({ status: 403, json: { success: false, code: w.reason || 'not_available', message: 'x' } });
      const s = url.searchParams;
      let list = [...w.products];
      if (s.get('q')) list = list.filter((x) => x.title.toLowerCase().includes(s.get('q').toLowerCase()));
      if (s.get('status')) list = list.filter((x) => s.get('status').split(',').includes(x.badge));
      if (s.get('source')) list = list.filter((x) => x.origin === s.get('source'));
      if (s.get('category_id')) list = list.filter((x) => x.categories.some((c) => String(c.id) === s.get('category_id')));
      // w.lastPage (pre-merge D2): the list says it has that many pages, so the pager shows.
      return route.fulfill({ json: { success: true, data: { items: list, pagination: { current_page: Number(s.get('page') || 1), per_page: 48, total: w.lastPage ? list.length + 48 * (w.lastPage - 1) : list.length, last_page: w.lastPage || 1 } } } });
    }
    // w.reject = {field: [message]}: the next save answers 422 with those errors (like ProductRules / ProductWriter).
    const reject422 = () => { const errors = w.reject; w.reject = null; return route.fulfill({ status: 422, json: { success: false, message: Object.values(errors)[0][0], errors } }); };
    if (p === '/products' && m === 'POST') {
      if (w.reject) return reject422();
      const created = product(w.nextId++, body.title, { status: body.status || 'draft', badge: body.status || 'draft', price: body.price != null ? String(body.price) : null, price_label: body.price != null ? `$${body.price} CAD` : '', main_image: null, images_count: 0 });
      created.extra = extrasFrom(body, { media: [] }, w);
      created.currency = body.currency || 'USD';
      if (Array.isArray(body.category_ids)) created.categories = body.category_ids.map((id) => w.categories.find((c) => c.id === id)).filter(Boolean).map((c) => ({ id: c.id, name: c.name }));
      w.products.unshift(created);
      return route.fulfill({ status: 201, json: { success: true, data: detailOf(created) } });
    }
    const one = /^\/products\/(\d+)$/.exec(p);
    if (one) {
      const found = w.products.find((x) => x.id === Number(one[1]));
      if (!found) return route.fulfill({ status: 404, json: { success: false, message: 'Product not found.' } });
      if (m === 'PATCH' && w.reject) return reject422();
      if (m === 'PATCH') { const extra = extrasFrom(body, found.extra, w); Object.assign(found, body, body.status ? { badge: body.status } : {}); found.extra = extra; }
      if (m === 'PATCH' && Array.isArray(body.category_ids)) found.categories = body.category_ids.map((id) => w.categories.find((c) => c.id === id)).filter(Boolean).map((c) => ({ id: c.id, name: c.name }));
      if (m === 'DELETE') { w.products = w.products.filter((x) => x !== found); return route.fulfill({ json: { success: true, data: { deleted: true } } }); }
      return route.fulfill({ json: { success: true, data: detailOf(found) } });
    }
    const media = /^\/products\/(\d+)\/media(?:\/(order|\d+))?$/.exec(p);
    if (media) {
      const found = w.products.find((x) => x.id === Number(media[1]));
      if (!found) return route.fulfill({ status: 404, json: { success: false, message: 'Product not found.' } });
      let list = detailOf(found).media;
      if (m === 'POST' && !media[2]) {
        if (w.mediaNetFail) return route.abort('failed'); // a dropped connection (Task 16: never retried, an upload may have landed)
        if (w.mediaReject) { const msg = w.mediaReject; w.mediaReject = null; return route.fulfill({ status: 422, json: { success: false, message: msg, errors: { file: [msg] } } }); }
        const raw = req.postDataBuffer()?.toString('latin1') || '';
        (w.uploads ||= []).push({ product: found.id, name: /filename="([^"]+)"/.exec(raw)?.[1] || '' }); // C4: which file, in which order
        if (w.mediaRejectName && raw.includes(`filename="${w.mediaRejectName}"`)) return route.fulfill({ status: 422, json: { success: false, message: 'The photo is too large.', errors: { file: ['The photo is too large.'] } } });
        const id = w.nextId++;
        list = [...list, { id, url: img(id), type: /Content-Type: video\//i.test(raw) ? 'video' : 'photo', sort_order: list.length }];
      }
      if (m === 'PUT' && media[2] === 'order') list = body.ids.map((id) => list.find((x) => x.id === id));
      if (m === 'DELETE') list = list.filter((x) => x.id !== Number(media[2]));
      found.extra = { ...(found.extra || {}), media: list };
      found.main_image = list.find((x) => x.type === 'photo')?.url || null;
      found.images_count = list.filter((x) => x.type === 'photo').length;
      return route.fulfill({ json: { success: true, data: detailOf(found) } });
    }
    const dup = /^\/products\/(\d+)\/duplicate$/.exec(p);
    if (dup && m === 'POST') {
      const found = w.products.find((x) => x.id === Number(dup[1]));
      const copy = { ...found, id: w.nextId++, origin: 'manual', title: `${found.title} (copy)`, status: 'draft', badge: 'draft', extra: { ...(found.extra || {}) } };
      w.products.unshift(copy);
      return route.fulfill({ status: 201, json: { success: true, data: detailOf(copy) } });
    }
    if (p === '/products/bulk' && w.slowBulkMs) await new Promise((r) => setTimeout(r, w.slowBulkMs)); // final review M4
    if (p === '/products/bulk') {
      // Like ProductBulk: ids in w.skip (not the account's own) and, on delete, website products are skipped.
      const ids = body.ids || [];
      const skipped = ids.filter((id) => (w.skip || []).includes(id) || (body.action === 'delete' && w.products.find((x) => x.id === id)?.origin !== 'manual'));
      const done = ids.filter((id) => !skipped.includes(id));
      if (body.action === 'status') w.products.filter((x) => done.includes(x.id)).forEach((x) => { x.status = body.status; x.badge = body.status; });
      if (body.action === 'delete') w.products = w.products.filter((x) => !done.includes(x.id));
      // Chris 16 Nov (C6): Add to category links the products, like ProductBulk::categorise (the list then shows it).
      if (body.action === 'category') {
        const cat = w.categories.find((c) => c.id === body.category_id);
        w.products.filter((x) => done.includes(x.id) && cat && !x.categories.some((c) => c.id === cat.id)).forEach((x) => { x.categories = [...x.categories, { id: cat.id, name: cat.name }]; });
        if (cat) cat.product_count = w.products.filter((x) => x.categories.some((c) => c.id === cat.id)).length;
      }
      return route.fulfill({ json: { success: true, data: { updated: body.action === 'delete' ? 0 : done.length, deleted: body.action === 'delete' ? done.length : 0, skipped_ids: skipped } } });
    }
    if (p === '/product-categories' && m === 'GET' && w.categoriesFail) return route.fulfill({ status: 500, json: { success: false, message: 'Server Error' } }); // final review M3
    if (p === '/product-categories' && m === 'GET') return route.fulfill({ json: { success: true, data: { categories: w.categories, total: w.products.length } } });
    if (p === '/product-categories' && m === 'POST') {
      if (w.categoryReject) { const msg = w.categoryReject; w.categoryReject = null; return route.fulfill({ status: 422, json: { success: false, message: msg, errors: { name: [msg] } } }); }
      const c = { id: w.nextId++, name: body.name, from_website: false, product_count: 0, read_only: false };
      w.categories.push(c);
      return route.fulfill({ status: 201, json: { success: true, data: { category: c } } });
    }
    // Rename / delete a category (ProductCategoriesController): the products' links follow.
    const catOne = /^\/product-categories\/(\d+)$/.exec(p);
    if (catOne) {
      const c = w.categories.find((x) => x.id === Number(catOne[1]));
      if (!c) return route.fulfill({ status: 404, json: { success: false, message: 'Category not found.' } });
      if (m === 'PATCH') {
        if (w.categoryReject) { const msg = w.categoryReject; w.categoryReject = null; return route.fulfill({ status: 422, json: { success: false, message: msg, errors: { name: [msg] } } }); }
        c.name = body.name;
        w.products.forEach((x) => { x.categories = x.categories.map((k) => (k.id === c.id ? { ...k, name: body.name } : k)); });
        return route.fulfill({ json: { success: true, data: { category: c } } });
      }
      if (m === 'DELETE') {
        w.categories = w.categories.filter((x) => x !== c);
        w.products.forEach((x) => { x.categories = x.categories.filter((k) => k.id !== c.id); });
        return route.fulfill({ json: { success: true, data: { deleted: true } } });
      }
    }
    // App drops a stored property view that isn't among the account's properties (utils/accountState), so a world that
    // opens in a property view lists that property here.
    if (p === '/properties' && m === 'GET') return route.fulfill({ json: { success: true, data: { owned_properties: w.properties || [], shared_properties: [] } } });
    // w.catalogueCampaign (post-live review I1): the account has a campaign filed under its real "Website Catalogue" category.
    if (p === '/memories' && m === 'GET' && w.catalogueCampaign) {
      const cat = { id: 12, name: 'Website Catalogue', color: '#0F766E', memory_count: 1, admin_id: null };
      const mem = { id: 880, title: 'Bench sale', category: { id: 12, name: 'Website Catalogue' }, tags: [], labels: [], author: { name: 'The Royal Wood Shop' }, photos: { count: 2 }, dates: { start_date: '2026-11-01', end_date: '2026-11-30', formatted_range: 'Nov 1 – 30, 2026' }, location: { formatted: 'Toronto, ON' }, last_update_img: img(880) };
      // The desktop list view renders the raw rows' category / author / photos as text (pre-existing: API-shaped objects
      // there crash it, found 16 Nov, not this change), so w.flatRows gives it strings as that table expects.
      if (w.flatRows) Object.assign(mem, { category: 'Website Catalogue', author: 'The Royal Wood Shop', photos: 2 });
      return route.fulfill({ json: { success: true, data: { latest_memories: [mem], sharedWith: [], published: [], shopify: { count: 0, collections: [] }, all_memories: { data: [mem], pagination: { current_page: 1, per_page: 50, total: 1, last_page: 1 } }, sidebar: { categories: { title: 'Categories', count: 2, items: [{ id: 5, name: 'Campaigns', color: '#6366F1', memory_count: 0, admin_id: null, memories: [] }, { ...cat, memories: [mem] }] }, labels: { title: 'Labels', count: 0, items: [] } }, filters: { authors: [] } } } });
    }
    if (p === '/memories' && m === 'GET') return route.fulfill({ json: { success: true, data: { latest_memories: [], sharedWith: [], published: [], shopify: { count: 0, collections: [] }, all_memories: { data: [], pagination: { current_page: 1, per_page: 50, total: 0, last_page: 1 } }, sidebar: { categories: { title: 'Categories', count: 1, items: [{ id: 5, name: 'Campaigns', color: '#6366F1', memory_count: 0, admin_id: null, memories: [] }] }, labels: { title: 'Labels', count: 0, items: [] } }, filters: { authors: [] } } } });
    if (p === '/user/memory-counts') return route.fulfill({ json: { success: true, data: { memory_counts: { total_memories: 4, total_memory_images: 10, published_memories: 0 } } } });
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: true, reason: null, item_count: 1, source: null, scan: null, limits: { item_limit: 500, sync_now_minutes: 15 } } } });
    if (p === '/website-catalogue/items') return route.fulfill({ json: { success: true, data: { items: [{ id: 603, title: 'Harbour Sofa', price_label: '$1,299 CAD', category: 'Sofas', main_image: img(603), images_count: 1, url: 'https://royalwood.example.ca/harbour' }], pagination: { current_page: 1, per_page: 500, total: 1, last_page: 1 } } } });
    if (p === '/cars') return route.fulfill({ json: { success: true, data: { cars: [], pagination: { last_page: 1 }, filters: {} } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 4, memory_limit: 50 } } } });
    if (p === '/dashboard' && w.dashboard) return route.fulfill({ json: { success: true, data: { statistics: w.dashboard } } });
    if (p.startsWith('/dashboard')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(3000);
  return { context, page };
}

const run = (name) => !ONLY || ONLY === name;

// Re-review I5-N1: watch the bulk dialog every frame while it closes (its fade-out is 200 ms); true if it ever showed
// the Delete wording ("Delete N products?" / a Delete button) after a status or category choice.
async function closeShowsDelete(page, click) {
  await page.evaluate(() => {
    window.__sawDelete = false;
    const until = performance.now() + 900;
    const tick = () => {
      const d = document.querySelector('[role="alertdialog"]');
      if (d && (/Delete \d+ products?\?/.test(d.textContent || '') || [...d.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Delete'))) window.__sawDelete = true;
      if (performance.now() < until) requestAnimationFrame(tick);
    };
    tick();
  });
  await click();
  await page.waitForTimeout(1000);
  return page.evaluate(() => window.__sawDelete);
}

// Chris 16 Nov: Products uses the Studio Select (Radix): open the trigger, then pick the option by its text.
async function choose(page, trigger, name) {
  await trigger.click();
  await page.getByRole('option', { name, exact: true }).click();
  await page.waitForTimeout(250);
}

// A product layer (details view or editor) is fixed and scrolls itself: grow the viewport to its full height for one shot.
async function shootLayer(page, testId, path) {
  const size = page.viewportSize();
  const full = await page.getByTestId(testId).evaluate((el) => el.scrollHeight);
  await page.setViewportSize({ width: size.width, height: Math.max(size.height, full) });
  await page.waitForTimeout(300);
  await page.screenshot({ path });
  await page.setViewportSize(size);
  await page.waitForTimeout(200);
}

// The product editor is a fixed layer that scrolls itself: grow the viewport to its full height for one shot.
async function shootEditor(page, path) {
  const size = page.viewportSize();
  const full = await page.getByTestId('product-editor').evaluate((el) => el.scrollHeight);
  await page.setViewportSize({ width: size.width, height: Math.max(size.height, full) });
  await page.waitForTimeout(300);
  await page.screenshot({ path });
  await page.setViewportSize(size);
  await page.waitForTimeout(200);
}

try {
  if (run('nav')) {
    for (const [width, height] of [[1280, 900], [390, 844]]) {
      const tag = `nav-${width}`;
      const w = world();
      const { page, context } = await open(w, { width, height, path: '/' });
      if (width >= 768) {
        const item = page.getByRole('button', { name: /^Products\s*3$/ }).filter({ visible: true }).first();
        expect(await item.isVisible().catch(() => false), `${tag}: sidebar shows "Products 3"`);
        await item.click();
      } else {
        const bar = page.getByTestId('phone-bar-products');
        expect(await bar.isVisible().catch(() => false), `${tag}: the phone bar has Products`);
        await bar.click();
      }
      await page.getByTestId('products-page').waitFor({ timeout: 15000 }).catch(() => {});
      expect(new URL(page.url()).pathname === '/products', `${tag}: the URL is /products (got ${page.url()})`);
      expect(await page.getByRole('heading', { name: 'Products', exact: true }).filter({ visible: true }).count() > 0, `${tag}: the page heading says Products`);
      await page.screenshot({ path: `${OUT}/${tag}-01-products-nav.png` });
      await context.close();

      const off = world({ pilot: false });
      const o = await open(off, { width, height, path: '/' });
      expect(!(await o.page.getByRole('button', { name: /^Products/ }).filter({ visible: true }).count()), `${tag}: switch off → no sidebar Products`);
      expect(!(await o.page.getByTestId('phone-bar-products').count()), `${tag}: switch off → no phone-bar Products`);
      expect(!off.calls.some((c) => c.p === '/products'), `${tag}: switch off → the gated list is never asked`);
      await o.context.close();

      const free = world({ reason: 'plan_required' });
      const f = await open(free, { width, height, path: '/products' });
      expect(await f.page.getByText('Products are available on the Teams and Business plans.').filter({ visible: true }).count() > 0, `${tag}: a free plan sees the upgrade line`);
      expect(!free.calls.some((c) => c.p === '/products' && c.m === 'GET'), `${tag}: … and the gated list is never asked`);
      await f.page.screenshot({ path: `${OUT}/${tag}-02-upgrade.png` });
      await f.context.close();
    }
  }

  if (run('nav')) {
    // Phone bar with 7 items (Products shown): every label inside the viewport, none overlapping another.
    for (const width of [320, 360, 390]) {
      const { page, context } = await open(world(), { width, height: 740, path: '/' });
      const boxes = await page.evaluate(() => {
        const nav = [...document.querySelectorAll('nav')].find((n) => n.querySelector('[data-testid="phone-bar-products"]'));
        return nav ? [...nav.querySelectorAll('button span')].map((s) => { const r = s.getBoundingClientRect(); return { t: s.textContent, l: r.left, r: r.right, w: s.scrollWidth, cw: s.clientWidth }; }) : [];
      });
      if (process.env.PR_DEBUG) console.log(width, JSON.stringify(boxes.map((b) => [b.t, Math.round(b.l), Math.round(b.r)])));
      expect(boxes.length >= 7, `phone-${width}: the bar shows 7 labels (got ${boxes.length})`);
      expect(boxes.every((b) => b.l >= 0 && b.r <= width), `phone-${width}: every label is inside the viewport`);
      expect(boxes.every((b, i) => i === 0 || b.l >= boxes[i - 1].r - 0.5), `phone-${width}: no two labels overlap`);
      await page.screenshot({ path: `${OUT}/phone-${width}-bar.png` });
      await context.close();
    }

    // Products hidden for this account: /products leaves for the dashboard.
    const hiddenW = world({ pilot: false });
    const h = await open(hiddenW, { width: 1280, height: 900, path: '/products' });
    expect(new URL(h.page.url()).pathname !== '/products' && !(await h.page.getByTestId('products-page').count()), `hidden: /products does not stay on a dead page (${h.page.url()})`);
    await h.page.screenshot({ path: `${OUT}/hidden-redirect.png` });
    await h.context.close();

    // A salesperson's own External view: Products is there, asked for with the property header.
    const OWN = { id: 31, name: 'Serpa Chrysler (External)', account_type: 'external', is_own_external_account: true, user_id: 959 };
    for (const [width, height] of [[1280, 900], [390, 844]]) {
      const tag = `external-${width}`;
      const ew = world();
      const e = await open(ew, { width, height, path: '/', view: 'property', property: OWN });
      if (width >= 768) {
        const item = e.page.getByRole('button', { name: /^Products\s*3$/ }).filter({ visible: true }).first();
        expect(await item.isVisible().catch(() => false), `${tag}: the External view sidebar has Products`);
        await item.click().catch(() => {});
      } else {
        const bar = e.page.getByTestId('phone-bar-products');
        expect(await bar.isVisible().catch(() => false), `${tag}: the External view phone bar has Products`);
        await bar.click().catch(() => {});
      }
      await e.page.getByTestId('products-page').waitFor({ timeout: 15000 }).catch(() => {});
      expect(new URL(e.page.url()).pathname === '/products', `${tag}: the URL is /products (got ${e.page.url()})`);
      expect(ew.calls.some((c) => c.p === '/products/status' && c.view === '31'), `${tag}: status is asked with the property header`);
      expect(await e.page.getByRole('button', { name: /^Campaigns/ }).filter({ visible: true }).count() > 0 || width < 768, `${tag}: Campaigns is still in the sidebar`);
      await e.page.screenshot({ path: `${OUT}/${tag}-products.png` });
      await e.context.close();
    }
  }
  if (run('grid')) {
    for (const [width, height] of [[1280, 900], [390, 844]]) {
      const tag = `grid-${width}`;
      const w = world();
      const { page, context } = await open(w, { width, height });
      const cards = page.getByTestId('product-card');
      await cards.first().waitFor({ timeout: 15000 });
      expect(await cards.count() === 3, `${tag}: three product cards`);
      const chair = cards.filter({ hasText: 'Walnut Chair' }).first();
      expect(await chair.getByText('Active', { exact: true }).isVisible(), `${tag}: status badge Active`);
      expect(await chair.getByText('Manual', { exact: true }).isVisible(), `${tag}: source badge Manual`);
      expect(await chair.getByText('$500 CAD').evaluate((el) => getComputedStyle(el).textDecorationLine.includes('line-through')), `${tag}: the sale price is struck through`);
      expect(await cards.filter({ hasText: 'Harbour Sofa' }).getByText('Website', { exact: true }).isVisible(), `${tag}: source badge Website`);
      expect(await cards.filter({ hasText: 'Draft Stool' }).getByText('Draft', { exact: true }).isVisible(), `${tag}: status badge Draft`);
      await page.screenshot({ path: `${OUT}/${tag}-01-grid.png`, fullPage: true });

      await page.getByRole('searchbox', { name: 'Search products' }).fill('walnut');
      await page.waitForTimeout(900);
      expect(await cards.count() === 1, `${tag}: search "walnut" → one card`);
      expect(w.calls.some((c) => c.p === '/products' && c.q.includes('q=walnut')), `${tag}: search reaches the API`);
      await page.getByRole('searchbox', { name: 'Search products' }).fill('');
      await page.waitForTimeout(900);

      await page.getByRole('button', { name: /^Filters/ }).click();
      await page.getByRole('checkbox', { name: 'Draft', exact: true }).check(); // exact: the cards' "Select Draft Stool" also matches
      await page.getByRole('button', { name: 'Apply', exact: true }).click();
      await page.waitForTimeout(700);
      expect(await cards.count() === 1 && await cards.first().getByText('Draft Stool').isVisible(), `${tag}: filter Draft → Draft Stool`);
      expect(await page.getByRole('button', { name: 'Filters (1)' }).isVisible(), `${tag}: the Filters button counts 1`);
      await page.getByRole('button', { name: 'Filters (1)' }).click();
      await page.getByRole('button', { name: 'Clear', exact: true }).click();
      await page.waitForTimeout(700);

      if (width < 768) await page.getByRole('button', { name: 'Categories' }).click();
      await page.getByRole('navigation', { name: 'Product categories' }).getByRole('button', { name: /^Chairs/ }).filter({ visible: true }).first().click();
      await page.waitForTimeout(700);
      expect(await cards.count() === 1, `${tag}: category Chairs → one card`);
      if (width < 768) await page.getByRole('button', { name: 'Categories' }).click();
      await page.getByRole('navigation', { name: 'Product categories' }).getByRole('button', { name: /^All products/ }).filter({ visible: true }).first().click();
      await page.waitForTimeout(700);

      await cards.filter({ hasText: 'Walnut Chair' }).getByRole('checkbox').check();
      await cards.filter({ hasText: 'Harbour Sofa' }).getByRole('checkbox').check();
      const bar = page.getByTestId('product-bulk-bar');
      expect(await bar.getByText('2 selected').isVisible(), `${tag}: the bulk bar says 2 selected`);
      expect(await bar.getByRole('button', { name: 'Delete' }).isDisabled(), `${tag}: Delete is off while a website product is selected`);
      // Final review I5: choosing in a bulk select only asks (a single keypress fires change); Cancel sends nothing.
      await choose(page, bar.getByRole('combobox', { name: 'Change status' }), 'Archived');
      await page.waitForTimeout(300);
      const ask = page.getByRole('alertdialog');
      expect(await ask.getByText('Set 2 products to Archived?').isVisible().catch(() => false), `${tag}: Change status asks "Set 2 products to Archived?"`);
      expect(!w.calls.some((c) => c.p === '/products/bulk'), `${tag}: … and sends nothing yet`);
      await page.screenshot({ path: `${OUT}/${tag}-02a-bulk-confirm.png` });
      expect(!(await closeShowsDelete(page, () => ask.getByRole('button', { name: 'Cancel' }).click())), `${tag}: the closing status dialog never shows the Delete wording (Cancel)`);
      expect(!w.calls.some((c) => c.p === '/products/bulk') && await bar.getByText('2 selected').isVisible(), `${tag}: Cancel sends nothing and keeps the selection`);
      expect((await bar.getByRole('combobox', { name: 'Change status' }).textContent()).trim() === 'Change status', `${tag}: … and the select is back on "Change status"`);
      await choose(page, bar.getByRole('combobox', { name: 'Add to category' }), 'Chairs');
      await page.waitForTimeout(300);
      expect(await ask.getByText('Add 2 products to Chairs?').isVisible().catch(() => false), `${tag}: Add to category asks "Add 2 products to Chairs?"`);
      expect(!(await closeShowsDelete(page, () => ask.getByRole('button', { name: 'Cancel' }).click())), `${tag}: the closing category dialog never shows the Delete wording (Cancel)`);
      expect(!w.calls.some((c) => c.p === '/products/bulk'), `${tag}: … Cancel sends nothing`);
      // Category Confirm (the stub keeps the selection: it skips nothing, but the page keeps the bar with its result).
      await choose(page, bar.getByRole('combobox', { name: 'Add to category' }), 'Chairs');
      expect(!(await closeShowsDelete(page, () => page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).click())), `${tag}: the closing category dialog never shows the Delete wording (Confirm)`);
      expect(w.calls.some((c) => c.p === '/products/bulk' && c.body.action === 'category' && c.body.category_id === 1), `${tag}: … Add to category Confirm sends it`);
      await cards.filter({ hasText: 'Walnut Chair' }).getByRole('checkbox').check();
      await cards.filter({ hasText: 'Harbour Sofa' }).getByRole('checkbox').check();
      await choose(page, bar.getByRole('combobox', { name: 'Change status' }), 'Archived');
      expect(!(await closeShowsDelete(page, () => page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).click())), `${tag}: the closing status dialog never shows the Delete wording (Confirm)`);
      const bulk = w.calls.find((c) => c.p === '/products/bulk' && c.body.action === 'status');
      expect(bulk && bulk.body.action === 'status' && bulk.body.status === 'archived' && bulk.body.ids.length === 2, `${tag}: bulk archive sent (${JSON.stringify(bulk?.body)})`);
      expect(await cards.filter({ hasText: 'Walnut Chair' }).getByText('Archived', { exact: true }).isVisible(), `${tag}: the grid shows Archived after it`);
      await page.screenshot({ path: `${OUT}/${tag}-02-bulk.png` });
      await context.close();

      const empty = world({ products: [], categories: [] });
      const e = await open(empty, { width, height });
      expect(await e.page.getByRole('button', { name: 'Add a product' }).filter({ visible: true }).count() > 0, `${tag}: empty state offers Add a product`);
      expect(await e.page.getByRole('button', { name: 'Import from your website' }).filter({ visible: true }).count() > 0, `${tag}: … and Import from your website`);
      await e.page.screenshot({ path: `${OUT}/${tag}-03-empty.png` });
      await e.context.close();

      // The server's answer shows at the bottom of the bar; what it skipped stays selected.
      const sk = world({ skip: [602] });
      const s2 = await open(sk, { width, height });
      const sc = s2.page.getByTestId('product-card');
      await sc.first().waitFor({ timeout: 15000 });
      await sc.filter({ hasText: 'Walnut Chair' }).getByRole('checkbox').check();
      await sc.filter({ hasText: 'Draft Stool' }).getByRole('checkbox').check();
      const sbar = s2.page.getByTestId('product-bulk-bar');
      await sbar.getByRole('button', { name: 'Delete' }).click();
      await s2.page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await s2.page.waitForTimeout(800);
      expect(await s2.page.locator('[data-sonner-toast]').getByText("1 deleted, 1 skipped (they're no longer available to you).").isVisible().catch(() => false), `${tag}: the bulk result shows as a toast (Chris 16 Nov: Studio's pattern, no Dismiss box)`);
      expect(!(await sbar.getByText(/skipped/).count()) && !(await sbar.getByRole('button', { name: 'Dismiss' }).count()), `${tag}: … not as a box in the bar`);
      expect(await sbar.getByText('1 selected').isVisible().catch(() => false) && await sc.filter({ hasText: 'Draft Stool' }).getByRole('checkbox').isChecked(), `${tag}: the skipped product stays selected`);
      expect(await sc.count() === 2, `${tag}: the deleted product left the grid`);
      await s2.page.screenshot({ path: `${OUT}/${tag}-04-skipped.png` });

      // A website product in the selection: Delete is aria-disabled and described by a visible hint.
      await sc.filter({ hasText: 'Harbour Sofa' }).getByRole('checkbox').check();
      const del = sbar.getByRole('button', { name: 'Delete' });
      const hint = sbar.getByText("Products from your website can't be deleted. Archive them instead.");
      expect(await hint.isVisible().catch(() => false), `${tag}: the website-delete hint is visible under the bar`);
      const hintId = await hint.getAttribute('id').catch(() => null);
      expect(await del.getAttribute('aria-disabled') === 'true' && Boolean(hintId) && await del.getAttribute('aria-describedby') === hintId, `${tag}: Delete is aria-disabled and described by the hint`);
      await del.click({ force: true });
      await s2.page.waitForTimeout(300);
      expect(!(await s2.page.getByRole('alertdialog').count()), `${tag}: … and clicking it opens nothing`);
      await s2.page.screenshot({ path: `${OUT}/${tag}-05-website-hint.png` });
      await s2.context.close();

      // Task 16 (T13 minor): the bulk result is about the old list, so a new search or sort clears it.
      const s3 = await open(world({ skip: [602] }), { width, height });
      const c3 = s3.page.getByTestId('product-card');
      await c3.first().waitFor({ timeout: 15000 });
      const bar3 = s3.page.getByTestId('product-bulk-bar');
      const notice3 = "1 deleted, 1 skipped (they're no longer available to you).";
      const bulkDelete = async () => {
        await c3.filter({ hasText: 'Walnut Chair' }).getByRole('checkbox').check();
        await c3.filter({ hasText: 'Draft Stool' }).getByRole('checkbox').check();
        await bar3.getByRole('button', { name: 'Delete' }).click();
        await s3.page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
        await s3.page.waitForTimeout(800);
      };
      await bulkDelete();
      expect(await s3.page.locator('[data-sonner-toast]').getByText(notice3).isVisible().catch(() => false), `${tag}: (setup) the bulk result shows as a toast`);
      await s3.page.getByRole('searchbox', { name: 'Search products' }).fill('Sofa');
      await s3.page.waitForTimeout(1000);
      expect(!(await s3.page.getByTestId('product-bulk-bar').count()), `${tag}: a new search clears what the bulk action left selected`);
      await s3.page.getByRole('searchbox', { name: 'Search products' }).fill('');
      await s3.page.waitForTimeout(1000);
      // Again with Draft Stool alone (the API skips it), then a new sort.
      await c3.filter({ hasText: 'Draft Stool' }).getByRole('checkbox').check();
      await bar3.getByRole('button', { name: 'Delete' }).click();
      await s3.page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await s3.page.waitForTimeout(800);
      const notice4 = "0 deleted, 1 skipped (they're no longer available to you).";
      expect(await s3.page.locator('[data-sonner-toast]').getByText(notice4).isVisible().catch(() => false) && await bar3.getByText('1 selected').isVisible().catch(() => false), `${tag}: (setup) a second bulk result shows; the skipped one stays selected`);
      await choose(s3.page, s3.page.getByRole('combobox', { name: 'Sort' }), 'Title A–Z');
      await s3.page.waitForTimeout(800);
      expect(!(await s3.page.getByTestId('product-bulk-bar').count()), `${tag}: … and so does a new sort`);
      await s3.context.close();

      // A salesperson's External view: the main account's products, read-only — no checkboxes, no bulk bar, no create.
      const EXT = { id: 31, name: 'Serpa Chrysler (External)', account_type: 'external', is_own_external_account: true, user_id: 959 };
      const owner = { id: 959, name: 'Serpa Chrysler', profile_image: null, profile_color: '#0062A8' };
      const xw = world({ canCreate: false, properties: [EXT] });
      xw.products = xw.products.map((x) => ({ ...x, read_only: true, owner }));
      xw.categories = xw.categories.map((c) => ({ ...c, read_only: true }));
      const x = await open(xw, { width, height, path: '/products', view: 'property', property: EXT });
      const xc = x.page.getByTestId('product-card');
      await xc.first().waitFor({ timeout: 15000 }).catch(() => {});
      expect(await xc.count() === 3, `${tag}: External view lists the parent's products`);
      expect(await xc.getByRole('checkbox').count() === 0, `${tag}: … with no checkboxes`);
      expect(!(await x.page.getByTestId('product-bulk-bar').count()), `${tag}: … and no bulk bar`);
      expect(!(await x.page.getByRole('button', { name: 'Add a product' }).filter({ visible: true }).count()), `${tag}: … and no Add a product`);
      expect(await xc.first().getByText('Shared by Serpa Chrysler').isVisible().catch(() => false), `${tag}: cards say who shared them`);
      expect(xw.calls.some((c) => c.p === '/products' && c.view === '31'), `${tag}: the list is asked with the property header`);
      await x.page.screenshot({ path: `${OUT}/${tag}-06-external.png` });
      // Pre-merge D1: the External view lists active products only, so its Filters offer no Draft / Archived.
      await x.page.getByRole('button', { name: /^Filters/ }).filter({ visible: true }).first().click();
      const xStatus = x.page.getByRole('group', { name: 'Status' });
      await xStatus.waitFor({ timeout: 5000 }).catch(() => {});
      const xLabels = (await xStatus.getByRole('checkbox').evaluateAll((els) => els.map((e) => e.parentElement.textContent.trim()))).join(',');
      expect(xLabels === 'Active,Out of stock', `${tag}: External view status filter is Active + Out of stock only (got ${xLabels})`);
      expect(await x.page.getByRole('group', { name: 'Source' }).isVisible().catch(() => false), `${tag}: … the other filters stay (Source)`);
      await x.page.screenshot({ path: `${OUT}/${tag}-07-external-filters.png` });
      await x.context.close();
      // … and the account's own Products page keeps every status.
      const ow = await open(world(), { width, height });
      await ow.page.getByTestId('product-card').first().waitFor({ timeout: 15000 }).catch(() => {});
      await ow.page.getByRole('button', { name: /^Filters/ }).filter({ visible: true }).first().click();
      const oStatus = ow.page.getByRole('group', { name: 'Status' });
      await oStatus.waitFor({ timeout: 5000 }).catch(() => {});
      const oLabels = (await oStatus.getByRole('checkbox').evaluateAll((els) => els.map((e) => e.parentElement.textContent.trim()))).join(',');
      expect(oLabels === 'Active,Draft,Out of stock,Archived', `${tag}: the account's own status filter keeps all four (got ${oLabels})`);
      await ow.context.close();
    }
  }
  if (run('pager')) {
    // Pre-merge D2: on a phone the floating "+" (App.tsx, 6rem round, 5rem above the bar) must not cover the pager.
    for (const [width, height] of [[390, 844], [320, 640], [1280, 900]]) {
      const tag = `pager-${width}`;
      const w = world({ lastPage: 2 });
      const { page, context } = await open(w, { width, height });
      await page.getByTestId('product-card').first().waitFor({ timeout: 15000 }).catch(() => {});
      const label = page.getByText('Page 1 of 2', { exact: true });
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(600);
      const rects = await page.evaluate(() => {
        const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
        const span = [...document.querySelectorAll('span')].find((e) => e.textContent.trim() === 'Page 1 of 2');
        const row = span?.parentElement;
        const btns = row ? [...row.querySelectorAll('button')] : [];
        const fab = [...document.querySelectorAll('nav.phone-bottom-bar-pin button')].find((b) => b.querySelector('svg') && b.className.includes('rounded-full'));
        const nav = document.querySelector('nav.phone-bottom-bar-pin');
        const fabShown = fab && getComputedStyle(nav).display !== 'none';
        return { row: r(row), label: r(span), buttons: btns.map(r), fab: fabShown ? r(fab) : null, nav: fabShown ? r(nav) : null, vh: window.innerHeight };
      });
      expect(Boolean(rects.row) && await label.isVisible(), `${tag}: the pager shows (Page 1 of 2)`);
      const clear = (a) => !rects.fab || a.bottom <= rects.fab.top || a.right <= rects.fab.left || a.left >= rects.fab.right;
      const inView = (a) => a.top >= 0 && a.bottom <= (rects.nav ? rects.nav.top : rects.vh);
      expect(rects.row && [rects.label, ...rects.buttons].every((a) => clear(a) && inView(a)), `${tag}: Previous, "Page 1 of 2" and Next are fully visible, not under the "+" (${JSON.stringify(rects)})`);
      if (width < 768) expect(Boolean(rects.fab), `${tag}: (setup) the phone "+" is on screen`);
      // Usable: Next is the element at its own centre (nothing on top of it) and moves to page 2.
      const next = page.getByRole('button', { name: 'Next' });
      const hit = await next.evaluate((b) => { const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top === b || b.contains(top); });
      expect(hit, `${tag}: Next is not covered (it gets the tap)`);
      await page.screenshot({ path: `${OUT}/${tag}-01-pager-bottom.png` });
      await next.click();
      await page.waitForTimeout(800);
      expect(w.calls.some((c) => c.p === '/products' && /page=2/.test(c.q)), `${tag}: Next asks for page 2`);
      await context.close();
    }
  }
  if (run('editor')) {
    for (const [width, height] of [[1280, 900], [390, 844]]) {
      const tag = `editor-${width}`;
      const w = world();
      const { page, context } = await open(w, { width, height });
      await page.getByTestId('product-card').first().waitFor({ timeout: 15000 });
      await page.getByRole('button', { name: 'Add a product' }).filter({ visible: true }).first().click();
      const editor = page.getByTestId('product-editor');
      await editor.waitFor({ timeout: 10000 });
      for (const group of ['Basics', 'Media', 'Pricing', 'Inventory', 'Variants', 'Details', 'Organisation', 'Visibility', 'SEO and sharing', 'Links']) {
        expect(await editor.getByRole('heading', { name: group, exact: true }).count() === 1, `${tag}: the editor has the ${group} group`);
      }
      await editor.getByRole('button', { name: 'Save' }).last().click();
      expect(await editor.getByText('Give the product a title.').isVisible(), `${tag}: an empty title says so under the field`);
      expect(await editor.getByText('Check the highlighted fields.').isVisible(), `${tag}: … and at the bottom of the card`);
      expect(await editor.locator('#p-title').getAttribute('aria-invalid') === 'true' && (await editor.locator('#p-title').getAttribute('aria-describedby') || '').includes('p-title-error'), `${tag}: the title is aria-invalid and described by its error`);
      // getByLabel matches substrings by default ("Title" would also find "Page title"): exact everywhere.
      await editor.getByLabel('Title', { exact: true }).fill('Oak Bench');
      expect(!(await editor.getByText('Give the product a title.').count()), `${tag}: typing a title clears its error`);
      await editor.getByLabel('Price', { exact: true }).fill('120');
      await editor.getByLabel('Compare-at price', { exact: true }).fill('150');
      await editor.getByRole('button', { name: /Add an option/ }).click();
      await editor.getByLabel('Option 1 name', { exact: true }).fill('Size');
      const values = editor.getByLabel('Option 1 values', { exact: true });
      await values.fill('S');
      await values.press('Enter');
      await values.fill('L');
      await values.press('Enter');
      expect(await editor.getByLabel('S price', { exact: true }).isVisible() && await editor.getByLabel('L price', { exact: true }).isVisible(), `${tag}: two variant rows (S, L)`);
      await shootEditor(page, `${OUT}/${tag}-01-new.png`);
      await editor.getByRole('button', { name: 'Save' }).last().click();
      await page.waitForTimeout(1000);
      const created = w.calls.find((c) => c.p === '/products' && c.m === 'POST');
      expect(created && created.body.title === 'Oak Bench' && created.body.price === 120 && created.body.compare_at_price === 150, `${tag}: POST /products body (${JSON.stringify(created?.body)?.slice(0, 160)})`);
      expect(created && created.body.variants.length === 2 && created.body.options[0].name === 'Size', `${tag}: options and variants saved`);
      expect(!('media' in (created?.body || {})), `${tag}: media is never in the JSON body`);
      // Post-live P1: the first save lands on the new product's details view; Edit there opens the editor for photos.
      const details = page.getByTestId('product-details');
      await details.waitFor({ timeout: 10000 });
      expect(!(await editor.count()) && await details.getByRole('heading', { name: 'Oak Bench' }).isVisible(), `${tag}: after the first save, the new product's details view shows`);
      expect(await details.getByText('Saved.', { exact: true }).isVisible(), `${tag}: … saying Saved (at the bottom of the card)`);
      await details.getByRole('button', { name: 'Edit', exact: true }).click();
      await editor.waitFor({ timeout: 10000 });
      await editor.getByLabel('Title', { exact: true }).waitFor({ timeout: 10000 });
      expect(await editor.getByRole('button', { name: /Add photos or a video/ }).isVisible(), `${tag}: … and Edit there lets photos be added`);
      await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
      await details.waitFor({ timeout: 10000 });
      expect(!(await editor.count()), `${tag}: Cancel (nothing changed) goes back to the details view`);
      await details.getByRole('button', { name: 'Products', exact: true }).click();
      await page.waitForTimeout(600);

      await page.getByTestId('product-card').filter({ hasText: 'Harbour Sofa' }).getByRole('button').first().click();
      await details.waitFor({ timeout: 10000 });
      await details.getByRole('heading', { name: 'Harbour Sofa' }).waitFor({ timeout: 10000 });
      expect(!(await details.getByRole('button', { name: 'Edit', exact: true }).count()), `${tag}: a website product's details have no Edit`);
      expect(await details.getByText('This product comes from your website and updates each time it syncs.').isVisible(), `${tag}: … and say it comes from the website`);
      await details.getByRole('button', { name: 'More actions' }).click();
      const wmenu = page.getByRole('menu');
      const wItems = (await wmenu.getByRole('menuitem').allTextContents()).map((t) => t.trim()).join(',');
      expect(wItems === 'Edit settings,Duplicate,Archive', `${tag}: … its ⋯ keeps Duplicate and Archive, plus Edit settings, no Delete (${wItems})`);
      await wmenu.getByRole('menuitem', { name: 'Edit settings' }).click();
      await editor.waitFor({ timeout: 10000 });
      await editor.getByLabel('Title', { exact: true }).waitFor({ timeout: 10000 }); // loaded (the editor says "Loading…" first)
      expect(await editor.getByText(/This product comes from your website\./).isVisible(), `${tag}: a website product says it is read-only`);
      expect(await editor.getByLabel('Title', { exact: true }).isDisabled(), `${tag}: … its title can't be changed`);
      expect(!(await editor.getByLabel('Status', { exact: true }).isDisabled()), `${tag}: … its status can`);
      expect(!(await editor.getByRole('button', { name: 'Delete' }).count()), `${tag}: … and it has no Delete`);
      await choose(page, editor.getByLabel('Status', { exact: true }), 'Archived');
      await shootEditor(page, `${OUT}/${tag}-02-website.png`);
      await editor.getByRole('button', { name: 'Save' }).last().click();
      await page.waitForTimeout(800);
      const patch = w.calls.filter((c) => c.m === 'PATCH').pop();
      expect(patch && Object.keys(patch.body).every((k) => ['status', 'tags', 'collections', 'internal_notes', 'show_price', 'show_enquire', 'category_ids'].includes(k)) && patch.body.status === 'archived', `${tag}: PATCH carries Studio-only fields only (${JSON.stringify(patch?.body)})`);
      expect(!(await editor.count()) && await details.getByText('Archived', { exact: true }).isVisible() && await details.getByText('Saved.', { exact: true }).isVisible(), `${tag}: Save goes back to the details view, showing Archived`);
      await context.close();
    }
  }
  if (run('details')) {
    // Post-live P1 (15 Nov): a product card opens a read-only details view (not the form). Manual: Edit + ⋯; website:
    // no Edit, the sync line, View on website; Back keeps the search, sort and page; Edit → Save → details (new values);
    // Cancel with edits asks first. Phone: full screen, Edit and ⋯ inside the viewport, no sideways scroll.
    for (const [width, height] of [[1280, 900], [390, 844]]) {
      const tag = `details-${width}`;
      const w = world({ lastPage: 2 });
      w.products[0].extra = {
        brand: 'Royal Wood', short_description: 'A solid walnut dining chair.', description_html: '<p>Hand made from <strong>solid walnut</strong>.</p><ul><li>Oiled finish</li></ul>',
        options: [{ name: 'Size', values: ['Small', 'Large'] }],
        variants: [
          { id: 1, title: 'Small', options: { Size: 'Small' }, sku: 'WC-S', barcode: null, price: '450.00', compare_at_price: null, price_label: '$450 CAD', stock_status: 'in_stock', quantity: 4, image_id: null, sort_order: 0 },
          { id: 2, title: 'Large', options: { Size: 'Large' }, sku: 'WC-L', barcode: null, price: '520.00', compare_at_price: null, price_label: '$520 CAD', stock_status: 'out_of_stock', quantity: 0, image_id: null, sort_order: 1 },
        ],
        attributes: [{ label: 'Finish', value: 'Oil' }], tags: ['solid wood'], buy_url: 'https://shop.example.ca/walnut-chair', weight: '7.5', weight_unit: 'kg',
        media: [6011, 6012, 6013].map((id, i) => ({ id, url: img(id), type: 'photo', sort_order: i })),
      };
      w.products[1].show_price = false; // Draft Stool: "Price hidden"
      const { page, context } = await open(w, { width, height });
      const cards = page.getByTestId('product-card');
      await cards.first().waitFor({ timeout: 15000 });
      const details = page.getByTestId('product-details');
      const editor = page.getByTestId('product-editor');

      // Search + sort set before opening: Back keeps them (and the grid).
      await page.getByRole('searchbox', { name: 'Search products' }).fill('Walnut');
      await choose(page, page.getByRole('combobox', { name: 'Sort' }), 'Title A–Z');
      await page.waitForTimeout(1000);
      const listsBefore = w.calls.filter((c) => c.m === 'GET' && c.p === '/products').length;
      await cards.filter({ hasText: 'Walnut Chair' }).getByRole('button').first().click();
      await details.getByRole('heading', { name: 'Walnut Chair' }).waitFor({ timeout: 10000 });
      expect(!(await editor.count()), `${tag}: a card opens the details view, not the editor`);
      expect(await details.getByText('$450 CAD').first().isVisible() && await details.getByText('$500 CAD').isVisible(), `${tag}: … price and the struck-through compare-at`);
      expect(await details.getByText('Active', { exact: true }).isVisible() && await details.getByText('Manual', { exact: true }).isVisible(), `${tag}: … status and source badges`);
      expect(await details.getByText('Chairs', { exact: true }).isVisible() && await details.getByText('solid wood', { exact: true }).isVisible(), `${tag}: … categories and tags`);
      expect(await details.getByText('SKU-601').isVisible() && await details.getByText('Royal Wood').isVisible() && await details.getByText('7.5 kg').isVisible(), `${tag}: … SKU, brand and weight`);
      expect(await details.locator('strong', { hasText: 'solid walnut' }).isVisible() && await details.getByText('Oiled finish').isVisible(), `${tag}: … the formatted description`);
      const large = details.getByRole('row').filter({ hasText: 'Large' });
      expect(await large.getByText('$520 CAD').isVisible() && await large.getByText('Out of stock').isVisible() && await large.getByText('WC-L').isVisible(), `${tag}: … the variants table`);
      expect(await details.getByText('Finish', { exact: true }).isVisible(), `${tag}: … the specifications`);
      expect(await details.getByRole('link', { name: /Buy link/ }).getAttribute('href') === 'https://shop.example.ca/walnut-chair', `${tag}: … the buy link`);
      expect(!(await details.locator('input, textarea, select, [contenteditable="true"]').count()), `${tag}: … read-only (no form fields)`);
      await details.getByRole('button', { name: 'Show photo 3' }).click();
      expect(await details.getByRole('button', { name: 'Show photo 3' }).getAttribute('aria-pressed') === 'true' && await details.getByRole('img', { name: 'Walnut Chair, photo 3 of 3' }).isVisible(), `${tag}: … the gallery shows the chosen photo`);
      const fits = await details.evaluate((el) => el.scrollWidth <= el.clientWidth && document.documentElement.scrollWidth <= window.innerWidth);
      expect(fits, `${tag}: no sideways scroll`);
      for (const name of ['Edit', 'More actions', 'Products']) {
        const b = await details.getByRole('button', { name, exact: true }).boundingBox();
        expect(b && b.x >= 0 && b.x + b.width <= width && b.y >= 0 && b.y + b.height <= height, `${tag}: ${name} is inside the viewport`);
      }
      await shootLayer(page, 'product-details', `${OUT}/${tag}-01-manual.png`);
      await details.getByRole('button', { name: 'Products', exact: true }).click();
      await page.waitForTimeout(600);
      expect(!(await details.count()) && await page.getByRole('searchbox', { name: 'Search products' }).inputValue() === 'Walnut' && (await page.getByRole('combobox', { name: 'Sort' }).textContent()).trim() === 'Title A–Z' && await cards.count() === 1,
        `${tag}: Back keeps the search, the sort and the list`);
      expect(w.calls.filter((c) => c.m === 'GET' && c.p === '/products').length === listsBefore, `${tag}: … without reloading the list`);
      expect(await cards.filter({ hasText: 'Walnut Chair' }).getByRole('button').first().evaluate((el) => el === document.activeElement), `${tag}: … and focus is back on the card`);

      // Page 2: open a product, browser Back closes it, still on page 2.
      await page.getByRole('searchbox', { name: 'Search products' }).fill('');
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: 'Next' }).click();
      await page.waitForTimeout(1000);
      expect(await page.getByText('Page 2 of 2').isVisible(), `${tag}: (setup) page 2`);
      await cards.filter({ hasText: 'Draft Stool' }).getByRole('button').first().click();
      await details.getByRole('heading', { name: 'Draft Stool' }).waitFor({ timeout: 10000 });
      expect(await details.getByText('Price hidden').isVisible() && !(await details.getByText('$450 CAD').count()) && await details.getByText('Draft', { exact: true }).isVisible(), `${tag}: show price off → "Price hidden"; Draft badge`);
      await page.goBack();
      await page.waitForTimeout(600);
      expect(!(await details.count()) && await page.getByText('Page 2 of 2').isVisible() && new URL(page.url()).pathname === '/products', `${tag}: browser Back closes it and keeps page 2`);

      // A website product: no Edit, the sync line, View on website, ⋯ without Delete.
      await cards.filter({ hasText: 'Harbour Sofa' }).getByRole('button').first().click();
      await details.getByRole('heading', { name: 'Harbour Sofa' }).waitFor({ timeout: 10000 });
      expect(await details.getByText('Website', { exact: true }).isVisible() && await details.getByText('This product comes from your website and updates each time it syncs.').isVisible(), `${tag}: website product: Website tag and the sync line`);
      expect(!(await details.getByRole('button', { name: 'Edit', exact: true }).count()) && await details.getByRole('button', { name: 'More actions' }).isVisible(), `${tag}: … no Edit, ⋯ stays`);
      expect(await details.getByRole('link', { name: /View on website/ }).getAttribute('href') === 'https://royalwood.example.ca/harbour', `${tag}: … View on website`);
      await shootLayer(page, 'product-details', `${OUT}/${tag}-02-website.png`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      expect(!(await details.count()), `${tag}: Escape closes the details view`);

      // Edit → Save → details with the new values; Edit → change → Cancel asks first, Leave → details unchanged.
      await page.getByRole('button', { name: 'Previous' }).click();
      await page.waitForTimeout(800);
      await cards.filter({ hasText: 'Walnut Chair' }).getByRole('button').first().click();
      await details.getByRole('button', { name: 'Edit', exact: true }).click();
      await editor.getByLabel('Title', { exact: true }).waitFor({ timeout: 10000 });
      await editor.getByLabel('Title', { exact: true }).fill('Walnut Chair Deluxe');
      await editor.getByRole('button', { name: 'Save' }).last().click();
      await details.getByRole('heading', { name: 'Walnut Chair Deluxe' }).waitFor({ timeout: 10000 }).catch(() => {});
      expect(!(await editor.count()) && await details.getByRole('heading', { name: 'Walnut Chair Deluxe' }).isVisible() && await details.getByText('Saved.', { exact: true }).isVisible(), `${tag}: Edit → Save → the details view with the new title, "Saved."`);
      expect(w.calls.filter((c) => c.m === 'PATCH').pop()?.body?.title === 'Walnut Chair Deluxe', `${tag}: … PATCHed`);
      await page.screenshot({ path: `${OUT}/${tag}-03-saved.png` });
      const patches = w.calls.filter((c) => c.m === 'PATCH').length;
      await details.getByRole('button', { name: 'Edit', exact: true }).click();
      await editor.getByLabel('Title', { exact: true }).waitFor({ timeout: 10000 });
      await editor.getByLabel('Title', { exact: true }).fill('Something else');
      await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
      const leave = page.getByRole('alertdialog');
      expect(await leave.getByText('Leave without saving?').isVisible(), `${tag}: Cancel with unsaved edits asks first`);
      await leave.getByRole('button', { name: 'Leave' }).click();
      await details.waitFor({ timeout: 10000 });
      await details.getByRole('heading', { name: 'Walnut Chair Deluxe' }).waitFor({ timeout: 10000 }).catch(() => {}); // it reloads ("Loading…" first)
      expect(!(await editor.count()) && await details.getByRole('heading', { name: 'Walnut Chair Deluxe' }).isVisible() && w.calls.filter((c) => c.m === 'PATCH').length === patches, `${tag}: … Leave → back to the details view, nothing saved`);
      await details.getByRole('button', { name: 'Products', exact: true }).click();
      await page.waitForTimeout(600);
      expect(await cards.filter({ hasText: 'Walnut Chair Deluxe' }).count() === 1, `${tag}: the grid shows the saved title`);
      await context.close();
    }
  }
  if (run('labels')) {
    // Post-live review I1 + I2 (option A): the stored "Website Catalogue" category is shown as "Product campaigns" in the Campaigns list view and
    // on the Media page (display only: the category still filters by its stored name).
    for (const [width, height] of [[1280, 900], [390, 844]]) {
      const tag = `labels-${width}`;
      const w = world({ pilot: false, catalogueCampaign: true, flatRows: width >= 768 });
      const { page, context } = await open(w, { width, height, path: '/memories' });
      await page.getByText('Bench sale').filter({ visible: true }).first().waitFor({ timeout: 20000 }).catch(() => {});
      await page.locator('button:has(svg.lucide-list)').filter({ visible: true }).first().click().catch(() => {});
      await page.waitForTimeout(1200);
      const listText = await page.evaluate(() => document.body.innerText);
      expect(/Bench sale/.test(listText) && /Product campaigns/.test(listText), `${tag}: Campaigns list view shows the campaign with its category as "Product campaigns"`);
      expect(!/Website Catalogue/.test(listText), `${tag}: … and no "Website Catalogue" anywhere on the Campaigns page`);
      await page.screenshot({ path: `${OUT}/${tag}-01-list.png` });
      if (width < 768) { await context.close(); continue; } // the phone Media page opens on Camera Roll, without the category column
      w.flatRows = false; // the Media page reads the API's category objects
      await page.goto(`${BASE}/media`);
      await page.waitForTimeout(3500);
      const mediaText = await page.evaluate(() => document.body.innerText);
      expect(/Product campaigns/.test(mediaText) && !/Website Catalogue/.test(mediaText), `${tag}: Media page shows the category as "Product campaigns", never "Website Catalogue"`);
      await page.screenshot({ path: `${OUT}/${tag}-02-media.png` });
      await context.close();
    }
  }
  if (run('page')) {
    // Final review M3 / M4 / M6 on the Products page.
    for (const [width, height] of [[1280, 900], [390, 844]]) {
      const tag = `page-${width}`;
      // M3: /product-categories failing never hides Add a product / Import while products exist.
      const cf = world({ categoriesFail: true });
      const a = await open(cf, { width, height });
      await a.page.getByTestId('product-card').first().waitFor({ timeout: 15000 });
      expect(await a.page.getByRole('button', { name: 'Add a product' }).filter({ visible: true }).count() > 0, `${tag}: categories failed → Add a product still shows`);
      expect(await a.page.getByRole('button', { name: 'Import from your website' }).filter({ visible: true }).count() > 0, `${tag}: … and Import from your website`);
      await a.page.screenshot({ path: `${OUT}/${tag}-01-categories-failed.png` });
      await a.context.close();

      // M4: a bulk action still running when the search changes doesn't put its result / selection on the new list.
      const w = world();
      const b = await open(w, { width, height });
      const cards = b.page.getByTestId('product-card');
      await cards.first().waitFor({ timeout: 15000 });
      await cards.filter({ hasText: 'Walnut Chair' }).getByRole('checkbox').check();
      w.slowBulkMs = 2000;
      await choose(b.page, b.page.getByTestId('product-bulk-bar').getByRole('combobox', { name: 'Change status' }), 'Draft');
      await b.page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).click();
      await b.page.waitForTimeout(200);
      await b.page.getByRole('searchbox', { name: 'Search products' }).fill('Sofa');
      await b.page.waitForTimeout(3000);
      expect(w.calls.some((c) => c.p === '/products/bulk'), `${tag}: (setup) the bulk action ran`);
      expect(!(await b.page.getByRole('checkbox', { checked: true }).count()), `${tag}: … its result does not select anything on the new search`);
      expect(!(await b.page.getByTestId('product-bulk-bar').count()), `${tag}: … and nothing is selected there`);
      expect(await cards.count() === 1 && await cards.first().getByText('Harbour Sofa').isVisible(), `${tag}: … and the grid shows the new search's list (${await cards.count()} cards)`);
      await b.page.screenshot({ path: `${OUT}/${tag}-02-stale-bulk.png` });
      w.slowBulkMs = 0;

      // M6: one change asks for the list, the status and the categories once each.
      await b.page.getByRole('searchbox', { name: 'Search products' }).fill('');
      await b.page.waitForTimeout(1200);
      await cards.filter({ hasText: 'Walnut Chair' }).getByRole('checkbox').check();
      const from = w.calls.length;
      await choose(b.page, b.page.getByTestId('product-bulk-bar').getByRole('combobox', { name: 'Change status' }), 'Active');
      await b.page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).click();
      await b.page.waitForTimeout(2000);
      const after = w.calls.slice(from);
      const n = (pth) => after.filter((c) => c.m === 'GET' && c.p === pth).length;
      expect(n('/products') === 1 && n('/products/status') === 1 && n('/product-categories') === 1,
        `${tag}: a bulk change → 1 list, 1 status, 1 categories request (${n('/products')}, ${n('/products/status')}, ${n('/product-categories')})`);
      expect(await b.page.locator('[data-sonner-toast]').getByText('1 updated.', { exact: true }).count() > 0, `${tag}: … and its result shows as a toast`);
      await b.context.close();
    }
  }
  if (run('save')) {
    // Final review I3 + I4: a second Save while the new product's list refreshes never POSTs again; while a save is on
    // its way the fields are locked (nothing typed then is replaced by the server's copy).
    for (const [width, height] of [[1280, 900], [390, 844]]) {
      const tag = `save-${width}`;
      const w = world();
      const { page, context } = await open(w, { width, height });
      await page.getByTestId('product-card').first().waitFor({ timeout: 15000 });
      await page.getByRole('button', { name: 'Add a product' }).filter({ visible: true }).first().click();
      const editor = page.getByTestId('product-editor');
      await editor.waitFor({ timeout: 10000 });
      await editor.getByLabel('Title', { exact: true }).fill('Ash Stool');
      w.slowListMs = 2500;
      const save = editor.getByRole('button', { name: /^(Save|Saving…)$/ }).last();
      await save.click();
      await page.waitForTimeout(700); // POST answered; the list refresh (onChanged) is still on its way
      expect(w.calls.filter((c) => c.p === '/products' && c.m === 'POST').length === 1, `${tag}: (setup) the product was created`);
      expect(await save.isDisabled(), `${tag}: Save stays disabled while the list refreshes after a create`);
      await save.click({ force: true }).catch(() => {});
      await save.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(3500);
      const posts = w.calls.filter((c) => c.p === '/products' && c.m === 'POST').length;
      expect(posts === 1, `${tag}: … a second click never POSTs a second copy (${posts} POSTs)`);
      const details = page.getByTestId('product-details');
      expect(await details.getByRole('heading', { name: 'Ash Stool' }).isVisible().catch(() => false), `${tag}: … and the new product is open (its details view)`);
      w.slowListMs = 0;

      // An existing product: the fields are locked while its save is on its way.
      await details.getByRole('button', { name: 'Edit', exact: true }).click();
      await editor.getByLabel('Title', { exact: true }).waitFor({ timeout: 10000 });
      await editor.getByLabel('Title', { exact: true }).fill('Ash Stool II');
      w.slowSaveMs = 1500;
      await editor.getByRole('button', { name: 'Save' }).last().click();
      await page.waitForTimeout(400);
      const title = editor.getByLabel('Title', { exact: true });
      expect(await title.isDisabled(), `${tag}: while saving, the title is locked`);
      expect(await editor.getByRole('textbox', { name: 'Full description' }).getAttribute('contenteditable') === 'false', `${tag}: … and the description too`);
      expect(await editor.getByRole('heading', { name: 'Basics', exact: true }).isVisible(), `${tag}: … the form stays on screen`);
      await page.screenshot({ path: `${OUT}/${tag}-01-saving-locked.png` });
      await page.waitForTimeout(2000);
      // Post-live P1: the save goes back to the details view, which shows the saved title.
      expect(!(await editor.count()) && await details.getByRole('heading', { name: 'Ash Stool II' }).isVisible(), `${tag}: after the save the details view shows the saved title`);
      expect(w.calls.filter((c) => c.m === 'PATCH').pop()?.body?.title === 'Ash Stool II', `${tag}: … PATCHed`);
      w.slowSaveMs = 0;
      await context.close();
    }
  }
  if (run('editor')) {
    // More of the editor: errors under their fields (the form's own checks and the API's 422s), photos (upload, API
    // limit message, reorder, remove), a variant's photo, unsaved-changes guard, Duplicate, Delete, and the
    // salesperson's read-only External view. Phone: key controls inside the viewport, no sideways scroll.
    const tiny = (name) => ({ name, mimeType: 'image/jpeg', buffer: Buffer.from(name) });
    for (const [width, height] of [[1280, 900], [390, 844]]) {
      const tag = `editor2-${width}`;
      const w = world();
      const { page, context } = await open(w, { width, height });
      await page.getByTestId('product-card').first().waitFor({ timeout: 15000 });
      await page.getByRole('button', { name: 'Add a product' }).filter({ visible: true }).first().click();
      const editor = page.getByTestId('product-editor');
      await editor.waitFor({ timeout: 10000 });
      const fits = await editor.evaluate((el) => el.scrollWidth <= el.clientWidth && document.documentElement.scrollWidth <= window.innerWidth);
      expect(fits, `${tag}: no sideways scroll`);
      const headerSave = await editor.locator('header').getByRole('button', { name: 'Save' }).boundingBox();
      expect(headerSave && headerSave.x >= 0 && headerSave.x + headerSave.width <= width && headerSave.y >= 0 && headerSave.y + headerSave.height <= height, `${tag}: the header Save is inside the viewport`);
      const close = await editor.getByRole('button', { name: 'Close' }).boundingBox();
      expect(close && close.x >= 0 && close.y >= 0 && close.y + close.height <= height, `${tag}: Close is inside the viewport`);

      await editor.getByLabel('Title', { exact: true }).fill('Pine Table');
      await editor.getByLabel('Price', { exact: true }).fill('300');
      await editor.getByRole('button', { name: /Add an option/ }).click();
      await editor.getByLabel('Option 1 name', { exact: true }).fill('Colour');
      const values = editor.getByLabel('Option 1 values', { exact: true });
      for (const v of ['Red', 'Blue']) { await values.fill(v); await values.press('Enter'); }
      await editor.getByLabel('Red price', { exact: true }).fill('300');
      await editor.getByLabel('Red compare-at price', { exact: true }).fill('250');
      const variantScroll = await editor.locator('table').evaluate((t) => {
        const box = t.parentElement.getBoundingClientRect();
        const card = t.closest('section').getBoundingClientRect();
        return getComputedStyle(t.parentElement).overflowX === 'auto' && box.left >= card.left && box.right <= card.right;
      });
      expect(variantScroll, `${tag}: the variant table scrolls inside its card`);
      const before = w.calls.length;
      await editor.getByRole('button', { name: 'Save' }).last().click();
      await page.waitForTimeout(300);
      const redRow = editor.getByRole('row').filter({ hasText: 'Red' });
      expect(await redRow.getByText('The compare-at price should be higher than the price.').isVisible(), `${tag}: a variant's compare-at below its price shows in its row`);
      expect(!w.calls.slice(before).some((c) => c.m === 'POST'), `${tag}: … and nothing is sent`);
      await editor.getByLabel('Red compare-at price', { exact: true }).fill('');
      // Renaming the option (even clearing it on the way) keeps the rows and what was typed in them.
      await editor.getByLabel('Option 1 name', { exact: true }).fill('');
      expect(await editor.getByLabel('Red price', { exact: true }).inputValue() === '300', `${tag}: clearing the option name keeps the rows`);
      await editor.getByLabel('Option 1 name', { exact: true }).pressSequentially('Finish');
      expect(await editor.getByLabel('Red price', { exact: true }).inputValue() === '300' && await editor.getByLabel('Blue price', { exact: true }).isVisible(), `${tag}: renaming the option keeps both rows and the Red price`);
      expect(await editor.getByRole('cell', { name: 'Red', exact: true }).evaluate((td) => getComputedStyle(td).position === 'sticky'), `${tag}: the variant name column stays put while the row scrolls`);
      await editor.locator('table').evaluate((t) => { t.parentElement.scrollLeft = 400; });
      await editor.getByRole('heading', { name: 'Variants', exact: true }).evaluate((h) => h.scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/${tag}-01b-variants-scrolled.png` });
      await editor.locator('table').evaluate((t) => { t.parentElement.scrollLeft = 0; });

      await editor.getByLabel('URL slug', { exact: true }).fill('taken');
      w.reject = { slug: ['This address is already used by another product.'] };
      await editor.getByRole('button', { name: 'Save' }).last().click();
      await page.waitForTimeout(800);
      const slugField = editor.locator('#p-slug').locator('xpath=..');
      expect(await slugField.getByText('This address is already used by another product.').isVisible(), `${tag}: the API's slug clash shows under the slug`);
      expect(await editor.getByText('Check the highlighted fields.').isVisible(), `${tag}: … and the bottom of the card says so`);
      await shootEditor(page, `${OUT}/${tag}-01-errors.png`);
      w.reject = { options: ['Some variants use options that are no longer there. Change the variants too.'], 'variants.1.compare_at_price': ['The compare-at price should be higher than the price.'] };
      await editor.getByRole('button', { name: 'Save' }).last().click();
      await page.waitForTimeout(800);
      expect(await editor.getByText('Some variants use options that are no longer there. Change the variants too.').isVisible(), `${tag}: the API's options message shows under the options`);
      expect(await editor.getByRole('row').filter({ hasText: 'Blue' }).getByText('The compare-at price should be higher than the price.').isVisible(), `${tag}: the API's variants.1 message shows in the Blue row`);

      await editor.getByLabel('URL slug', { exact: true }).fill('');
      await editor.getByRole('button', { name: 'Save' }).last().click();
      await page.waitForTimeout(1200);
      const id = w.products[0].id;
      const details = page.getByTestId('product-details');
      expect(w.products[0].title === 'Pine Table' && await details.getByText('Saved.', { exact: true }).isVisible(), `${tag}: created, and its details view says Saved`);
      expect(await details.getByRole('table').getByRole('cell', { name: 'Red', exact: true }).isVisible() && await details.getByRole('cell', { name: 'Blue', exact: true }).isVisible(), `${tag}: … and lists its variants`);
      await details.getByRole('button', { name: 'Edit', exact: true }).click();
      await editor.getByLabel('Title', { exact: true }).waitFor({ timeout: 10000 });
      expect(await editor.getByLabel('Red price', { exact: true }).inputValue() === '300', `${tag}: the reopened product keeps its variants`);
      const made = w.calls.filter((c) => c.m === 'POST' && c.p === '/products').pop();
      expect(made && made.body.options[0].name === 'Finish' && made.body.variants.every((v) => Object.keys(v.options).join() === 'Finish') && made.body.variants[0].price === 300, `${tag}: the renamed option and its rows are saved (${JSON.stringify(made?.body?.variants?.map((v) => v.options))})`);

      const listsBefore = w.calls.filter((c) => c.m === 'GET' && c.p === '/products').length;
      await editor.locator('input[type=file]').setInputFiles([tiny('a.jpg'), tiny('b.jpg')]);
      await page.waitForTimeout(1200);
      expect(w.calls.filter((c) => c.m === 'GET' && c.p === '/products').length - listsBefore === 1, `${tag}: one grid refresh for the whole upload batch`);
      const uploads = w.calls.filter((c) => c.m === 'POST' && c.p === `/products/${id}/media`);
      expect(uploads.length === 2, `${tag}: two uploads, one request each (${uploads.length})`);
      expect(await editor.getByRole('img', { name: 'Photo 1' }).isVisible() && await editor.getByRole('img', { name: 'Photo 2' }).isVisible() && await editor.getByText('Main', { exact: true }).isVisible(), `${tag}: two photos, the first marked Main`);
      const [first, second] = w.products[0].extra.media.map((x) => x.id);
      await editor.getByRole('img', { name: 'Photo 1' }).hover().catch(() => {});
      await editor.getByRole('button', { name: 'Move Photo 1 later' }).click();
      await page.waitForTimeout(700);
      const order = w.calls.filter((c) => c.m === 'PUT' && c.p === `/products/${id}/media/order`).pop();
      expect(order && JSON.stringify(order.body.ids) === JSON.stringify([second, first]), `${tag}: reorder sends the new order (${JSON.stringify(order?.body)})`);
      await choose(page, editor.getByLabel('Blue photo', { exact: true }), 'Photo 2');
      await editor.getByRole('button', { name: 'Save' }).last().click();
      await page.waitForTimeout(800);
      const vp = w.calls.filter((c) => c.m === 'PATCH').pop();
      expect(vp && vp.body.variants[1].image_id === first && !('media' in vp.body), `${tag}: Blue's photo is saved as its image_id (${JSON.stringify(vp?.body?.variants?.map((v) => v.image_id))})`);
      // Save went back to the details view: its gallery shows both photos. Edit again for the rest.
      expect(!(await editor.count()) && await details.getByRole('button', { name: 'Show photo 2' }).isVisible(), `${tag}: Save → details view with both photos`);
      await details.getByRole('button', { name: 'Edit', exact: true }).click();
      await editor.getByLabel('Title', { exact: true }).waitFor({ timeout: 10000 });
      w.mediaReject = 'A product can have up to 20 photos.';
      await editor.locator('input[type=file]').setInputFiles([tiny('c.jpg')]);
      await page.waitForTimeout(800);
      expect(await editor.getByText('c.jpg: A product can have up to 20 photos.').isVisible(), `${tag}: the API's upload limit message shows in the Media card`);
      // Task 16 (T11 minor): a network error on the upload is not retried, so one file can never land twice.
      const attemptsBefore = w.calls.filter((c) => c.m === 'POST' && c.p === `/products/${id}/media`).length;
      const photosBefore = await editor.getByRole('img', { name: /^Photo \d/ }).count();
      w.mediaNetFail = true;
      await editor.locator('input[type=file]').setInputFiles([tiny('d.jpg')]);
      await page.waitForTimeout(5000); // longer than the 1s + 3s network-retry backoff
      w.mediaNetFail = false;
      const attempts = w.calls.filter((c) => c.m === 'POST' && c.p === `/products/${id}/media`).length - attemptsBefore;
      expect(attempts === 1, `${tag}: a dropped upload is sent once, never retried (${attempts})`);
      expect(await editor.getByText('d.jpg: The file could not be uploaded. Check your connection and try again.').isVisible(), `${tag}: … and the Media card says to check the connection`);
      expect(await editor.getByRole('img', { name: /^Photo \d/ }).count() === photosBefore, `${tag}: … and no photo is added`);
      await editor.getByRole('heading', { name: 'Media', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${tag}-02a-upload-limit.png` });
      await editor.getByRole('img', { name: 'Photo 1' }).hover().catch(() => {});
      await editor.getByRole('button', { name: 'Remove Photo 1' }).click();
      const removeDialog = page.getByRole('alertdialog');
      expect(await removeDialog.getByText('Remove photo 1?').isVisible() && !w.calls.some((c) => c.m === 'DELETE' && c.p.includes('/media/')), `${tag}: removing a photo asks first`);
      // Back while that dialog is open closes the dialog only.
      await page.goBack();
      await page.waitForTimeout(500);
      expect(!(await removeDialog.count()) && await editor.isVisible() && !w.calls.some((c) => c.m === 'DELETE' && c.p.includes('/media/')), `${tag}: Back closes the remove dialog first, the editor stays`);
      await editor.getByRole('img', { name: 'Photo 1' }).hover().catch(() => {});
      await editor.getByRole('button', { name: 'Remove Photo 1' }).click();
      await removeDialog.waitFor();
      await page.waitForTimeout(400); // the dialog's zoom-in
      await page.screenshot({ path: `${OUT}/${tag}-02b-remove-confirm.png` });
      await removeDialog.getByRole('button', { name: 'Remove' }).click();
      await page.waitForTimeout(700);
      expect(w.calls.some((c) => c.m === 'DELETE' && c.p === `/products/${id}/media/${second}`) && await editor.getByRole('img', { name: /^Photo \d/ }).count() === 1, `${tag}: Remove deletes that photo`);
      await shootEditor(page, `${OUT}/${tag}-02-photos.png`);

      await editor.getByLabel('Title', { exact: true }).fill('Pine Table XL');
      await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
      const leave = page.getByRole('alertdialog');
      expect(await leave.getByText('Leave without saving?').isVisible(), `${tag}: unsaved changes ask before closing`);
      const onTop = await leave.evaluate((el) => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + 20); return el.contains(hit); });
      expect(onTop, `${tag}: … above the editor`);
      await leave.getByRole('button', { name: 'Keep editing' }).click();
      await leave.waitFor({ state: 'detached' }); // Radix hides the rest of the page from the accessibility tree while it is open
      expect(await editor.getByLabel('Title', { exact: true }).inputValue() === 'Pine Table XL', `${tag}: Keep editing keeps the edit`);
      // Post-live P1: Duplicate, Archive and Delete moved from the editor's header to the details view's ⋯.
      expect(!(await editor.getByRole('button', { name: /^(Duplicate|Archive|Unarchive|Delete)$/ }).count()), `${tag}: the editor no longer has Duplicate / Archive / Delete (they are on the details view)`);
      await editor.getByLabel('Title', { exact: true }).fill('Pine Table Draft Name');
      // Back (browser or phone) with unsaved edits asks first; Keep editing stays.
      await page.goBack();
      await page.waitForTimeout(500);
      expect(await page.getByRole('alertdialog').getByText('Leave without saving?').isVisible() && await editor.isVisible(), `${tag}: Back with unsaved edits asks first`);
      await page.getByRole('alertdialog').getByRole('button', { name: 'Keep editing' }).click();
      await page.getByRole('alertdialog').waitFor({ state: 'detached' });
      // Focus is trapped: tabbing round never leaves the editor.
      let outside = 0;
      for (let k = 0; k < 60; k += 1) {
        await page.keyboard.press('Tab');
        if (!(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-testid="product-editor"]'))))) outside += 1;
      }
      expect(outside === 0, `${tag}: Tab stays inside the editor (${outside} stops outside)`);
      await editor.getByLabel('Title', { exact: true }).fill('Pine Table'); // back to the saved title: nothing unsaved
      await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
      await details.waitFor({ timeout: 10000 });
      expect(!(await editor.count()) && !(await page.getByRole('alertdialog').count()), `${tag}: Cancel with nothing unsaved goes straight back to the details view`);

      // The details view's ⋯: Archive / Unarchive change the status only; Duplicate opens the copy; Delete asks first.
      const menu = async (item) => { await details.getByRole('button', { name: 'More actions' }).click(); await page.getByRole('menu').getByRole('menuitem', { name: item, exact: true }).click(); };
      await details.getByRole('button', { name: 'More actions' }).click();
      const mItems = (await page.getByRole('menu').getByRole('menuitem').allTextContents()).map((t) => t.trim()).join(',');
      expect(mItems === 'Duplicate,Archive,Delete', `${tag}: a manual product's ⋯ has Duplicate, Archive, Delete (${mItems})`);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/${tag}-02c-details-menu.png` });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      expect(await details.isVisible() && !(await page.getByRole('menu').count()), `${tag}: Escape closes the menu only`);
      await menu('Archive');
      await page.waitForTimeout(800);
      const arch = w.calls.filter((c) => c.m === 'PATCH').pop();
      expect(arch && JSON.stringify(arch.body) === '{"status":"archived"}', `${tag}: Archive sends only the status (${JSON.stringify(arch?.body)})`);
      expect(await details.getByText('Archived', { exact: true }).first().isVisible() && await details.getByText('Archived.', { exact: true }).isVisible(), `${tag}: … the badge reads Archived and the card says so`);
      // Focus is trapped in the details view too.
      let dOutside = 0;
      for (let k = 0; k < 30; k += 1) {
        await page.keyboard.press('Tab');
        if (!(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-testid="product-details"]'))))) dOutside += 1;
      }
      expect(dOutside === 0, `${tag}: Tab stays inside the details view (${dOutside} stops outside)`);
      await menu('Unarchive');
      await page.waitForTimeout(800);
      expect(JSON.stringify(w.calls.filter((c) => c.m === 'PATCH').pop()?.body) === '{"status":"active"}', `${tag}: Unarchive sends only the status`);
      await menu('Duplicate');
      await page.waitForTimeout(1200);
      expect(w.calls.some((c) => c.m === 'POST' && c.p === `/products/${id}/duplicate`) && await editor.getByRole('heading', { name: 'Pine Table (copy)' }).isVisible(), `${tag}: Duplicate opens the copy (in the editor, as before)`);
      const copyId = w.products[0].id;
      await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
      await details.getByRole('heading', { name: 'Pine Table (copy)' }).waitFor({ timeout: 10000 });
      await menu('Delete');
      const del = page.getByRole('alertdialog');
      expect(await del.getByText('Delete this product?').isVisible(), `${tag}: Delete asks first`);
      await page.waitForTimeout(400); // the dialog's zoom-in
      await page.screenshot({ path: `${OUT}/${tag}-03-delete.png` });
      await del.getByRole('button', { name: 'Delete' }).click();
      await page.waitForTimeout(1000);
      expect(w.calls.some((c) => c.m === 'DELETE' && c.p === `/products/${copyId}`) && !(await editor.count()) && !(await details.count()), `${tag}: … deletes it and closes the details view`);
      expect(!(await page.getByTestId('product-card').filter({ hasText: 'Pine Table (copy)' }).count()), `${tag}: … and the copy left the grid`);
      // Opened from "Add a product", remounted on the new product and then on its copy: focus goes back to that button.
      expect(await page.evaluate(() => (document.activeElement?.textContent || '').includes('Add a product')), `${tag}: after create, duplicate and delete, focus is back on Add a product (${await page.evaluate(() => document.activeElement?.tagName + ' ' + (document.activeElement?.textContent || '').slice(0, 30))})`);

      // Closing returns focus to the card that opened the details view (also after Edit → Cancel); Back closes the
      // editor to the details view, then the details view to the list.
      const chairOpen = page.getByTestId('product-card').filter({ hasText: 'Walnut Chair' }).getByRole('button').first();
      await chairOpen.click();
      await details.getByRole('heading', { name: 'Walnut Chair' }).waitFor({ timeout: 10000 });
      await details.getByRole('button', { name: 'Edit', exact: true }).click();
      await editor.getByLabel('Title', { exact: true }).waitFor({ timeout: 10000 });
      await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
      await details.waitFor({ timeout: 10000 });
      await details.getByRole('button', { name: 'Products', exact: true }).click();
      await page.waitForTimeout(400);
      expect(await chairOpen.evaluate((el) => el === document.activeElement), `${tag}: closing puts focus back on the card`);
      await chairOpen.click();
      await details.getByRole('button', { name: 'Edit', exact: true }).click();
      await editor.getByLabel('Title', { exact: true }).waitFor({ timeout: 10000 });
      await page.goBack();
      await page.waitForTimeout(500);
      expect(!(await editor.count()) && await details.isVisible(), `${tag}: Back closes a clean editor to the details view`);
      await page.goBack();
      await page.waitForTimeout(500);
      expect(!(await details.count()) && new URL(page.url()).pathname === '/products', `${tag}: … and Back again closes the details view and stays on Products`);

      // Closing the tab with unsaved edits: the browser asks.
      await chairOpen.click();
      await details.getByRole('button', { name: 'Edit', exact: true }).click();
      await editor.getByLabel('Title', { exact: true }).waitFor({ timeout: 10000 });
      await editor.getByLabel('Title', { exact: true }).fill('Walnut Chair 2');
      let asked = false;
      page.on('dialog', async (d) => { if (d.type() === 'beforeunload') asked = true; await d.dismiss().catch(() => {}); });
      await page.close({ runBeforeUnload: true });
      await new Promise((r) => setTimeout(r, 800));
      expect(asked, `${tag}: closing the tab with unsaved edits asks first`);
      await context.close();

      // A salesperson's External view: the main account's product, every field read-only, no actions, no notes.
      const EXT = { id: 31, name: 'Serpa Chrysler (External)', account_type: 'external', is_own_external_account: true, user_id: 959 };
      const owner = { id: 959, name: 'Serpa Chrysler', profile_image: null, profile_color: '#0062A8' };
      const xw = world({ canCreate: false, properties: [EXT] });
      xw.products = xw.products.map((x) => ({ ...x, read_only: true, owner }));
      const x = await open(xw, { width, height, path: '/products', view: 'property', property: EXT });
      await x.page.getByTestId('product-card').filter({ hasText: 'Walnut Chair' }).getByRole('button').first().click();
      // Post-live P1: the External view opens the read-only details view: no Edit, no ⋯, no form at all.
      const xe = x.page.getByTestId('product-details');
      await xe.waitFor({ timeout: 10000 });
      await xe.getByRole('heading', { name: 'Walnut Chair' }).waitFor({ timeout: 10000 });
      expect(await xe.getByText('Shared by Serpa Chrysler. You can view it here.').isVisible(), `${tag}: External view says who shared it`);
      expect(!(await xe.getByRole('textbox').count()) && !(await xe.getByRole('combobox').count()) && !(await x.page.getByTestId('product-editor').count()), `${tag}: … read-only (no fields)`);
      expect(!(await xe.getByRole('button', { name: /^(Edit|Edit settings|Save|Duplicate|Archive|Delete|More actions)$/ }).count()), `${tag}: … no Edit, no ⋯, no Save, Duplicate, Archive or Delete`);
      expect(!(await xe.getByRole('button', { name: /Add photos/ }).count()) && !(await xe.getByRole('heading', { name: 'Internal notes' }).count()), `${tag}: … no photo upload and no internal notes`);
      expect(xw.calls.some((c) => c.p === '/products/601' && c.view === '31'), `${tag}: … asked with the property header`);
      await x.page.screenshot({ path: `${OUT}/${tag}-04-external.png` });
      await xe.getByRole('button', { name: 'Products', exact: true }).click();
      await x.page.waitForTimeout(400);
      expect(!(await xe.count()) && !xw.calls.some((c) => ['PATCH', 'POST', 'PUT', 'DELETE'].includes(c.m) && c.p.startsWith('/products')), `${tag}: … closes without asking and nothing was written`);
      await x.context.close();
    }
  }
  if (run('chris16')) {
    // Chris, 16 Nov: the flows he used, click by click. C5 categories (Campaigns' Category Filter + "+" popover, rename,
    // delete), C6 category pills after bulk Add to category / status / rename / delete, C8 Import colour, the audit's
    // toast + empty state, C4 photos on a new product before its first save, C7 currency, C9 placeholders.
    const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGPISfiPFTEMLQkAsZxywVYStwwAAAAASUVORK5CYII=';
    const png = (n) => ({ name: `${n}.png`, mimeType: 'image/png', buffer: Buffer.from(PNG_1PX, 'base64') });
    for (const [width, height] of [[1280, 900], [390, 844]]) {
      const tag = `chris16-${width}`;
      const w = world();
      const { page, context } = await open(w, { width, height });
      const cards = page.getByTestId('product-card');
      await cards.first().waitFor({ timeout: 15000 });
      const nav = page.getByRole('navigation', { name: 'Product categories' }).filter({ visible: true });
      const openNav = async () => { if (width < 768 && !(await nav.count())) { await page.getByRole('button', { name: 'Categories', exact: true }).click(); await page.waitForTimeout(400); } };
      const closeNav = async () => { if (width < 768 && await page.getByRole('dialog').filter({ has: page.getByRole('navigation', { name: 'Product categories' }) }).count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); } };
      const toast = (text) => page.locator('[data-sonner-toast]').getByText(text, { exact: true });
      const pill = (title) => cards.filter({ hasText: title }).getByTestId('product-card-category');

      // C8: Import from your website in the Website Catalogue connector's teal.
      const importBg = await page.getByRole('button', { name: 'Import from your website' }).filter({ visible: true }).first().evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(importBg === 'rgb(15, 118, 110)', `${tag}: C8 Import from your website is the connector's teal (${importBg})`);
      // C6: a card with a category shows it as a pill.
      expect((await pill('Walnut Chair').textContent())?.trim() === 'Chairs' && !(await pill('Draft Stool').count()), `${tag}: C6 Walnut Chair shows its Chairs pill; Draft Stool has none`);
      const sofaBg = await pill('Harbour Sofa').locator('span').first().evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(sofaBg === 'rgb(15, 118, 110)', `${tag}: review I1 a website category's pill is the website teal, as its row (${sofaBg})`);

      // C5: Campaigns' Category Filter: the heading, the "All Categories" Select and the "+".
      await openNav();
      expect(await nav.getByText('Category Filter', { exact: true }).isVisible(), `${tag}: C5 the column says Category Filter`);
      const filter = nav.getByRole('combobox', { name: 'Category filter' });
      expect((await filter.textContent()).trim() === 'All Categories', `${tag}: … with the All Categories dropdown`);
      expect(!(await nav.getByText('New category', { exact: true }).count()), `${tag}: … and no inline "New category" link`);
      const allRowBg = await nav.getByRole('button', { name: /^All products/ }).evaluate((el) => getComputedStyle(el.parentElement).backgroundColor);
      expect(allRowBg === 'rgb(229, 231, 235)', `${tag}: the active row is gray, not purple (${allRowBg})`);
      await nav.getByRole('button', { name: 'New category' }).click();
      const pop = page.getByRole('dialog').filter({ hasText: 'New Category' });
      await pop.waitFor({ timeout: 5000 });
      expect(await pop.getByText('Create a category to organize products').isVisible(), `${tag}: "+" opens Campaigns' New Category popover`);
      await page.waitForTimeout(400); // the popover's fade-in
      await page.screenshot({ path: `${OUT}/${tag}-01-new-category.png` });
      await pop.getByPlaceholder('Category name...').fill('chairs');
      expect(await pop.getByText('Category already exists').isVisible() && await pop.getByRole('button', { name: 'Create' }).isDisabled(), `${tag}: … a name that exists says so under the field; Create is off`);
      w.categoryReject = 'That name is not allowed.';
      await pop.getByPlaceholder('Category name...').fill('Bad');
      await pop.getByRole('button', { name: 'Create' }).click();
      await page.waitForTimeout(500);
      expect(await pop.getByText('That name is not allowed.').isVisible(), `${tag}: … a server error shows under the field, the popover stays`);
      await pop.getByPlaceholder('Category name...').fill('Intimate');
      await pop.getByRole('button', { name: 'Create' }).click();
      await page.waitForTimeout(800);
      expect(w.calls.some((c) => c.p === '/product-categories' && c.m === 'POST' && c.body.name === 'Intimate'), `${tag}: Create sends the name`);
      expect(await toast('Category "Intimate" created').count() > 0, `${tag}: … a toast says it was created`);
      await openNav();
      expect(await nav.getByRole('button', { name: /^Intimate/ }).isVisible(), `${tag}: … and Intimate is in the column`);
      await page.screenshot({ path: `${OUT}/${tag}-02-created.png` });
      await closeNav();

      // C6, as Chris did it: select 2 → Add to category → Intimate → the cards show it.
      await cards.filter({ hasText: 'Walnut Chair' }).getByRole('checkbox').check();
      await cards.filter({ hasText: 'Draft Stool' }).getByRole('checkbox').check();
      const bar = page.getByTestId('product-bulk-bar');
      await choose(page, bar.getByRole('combobox', { name: 'Add to category' }), 'Intimate');
      await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).click();
      await page.waitForTimeout(1200);
      expect(await toast('2 updated.').count() > 0 && !(await bar.count()), `${tag}: bulk Add to category → toast "2 updated.", bar goes`);
      expect((await pill('Draft Stool').textContent())?.trim() === 'Intimate', `${tag}: C6 Draft Stool's card now shows Intimate`);
      expect(/Chairs\s*\+1/.test((await pill('Walnut Chair').textContent()) || ''), `${tag}: … Walnut Chair shows Chairs +1 (${await pill('Walnut Chair').textContent()})`);
      await page.screenshot({ path: `${OUT}/${tag}-03-bulk-category.png`, fullPage: true });
      // Bulk Change status updates the badge straight away.
      await cards.filter({ hasText: 'Walnut Chair' }).getByRole('checkbox').check();
      await choose(page, bar.getByRole('combobox', { name: 'Change status' }), 'Draft');
      await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).click();
      await page.waitForTimeout(1200);
      expect(await cards.filter({ hasText: 'Walnut Chair' }).getByText('Draft', { exact: true }).isVisible(), `${tag}: bulk Change status → the badge says Draft straight away`);

      // Rename through the pencil → Edit Category popover; the cards follow.
      await openNav();
      await nav.getByRole('button', { name: 'Rename Intimate' }).click();
      const edit = page.getByRole('dialog').filter({ hasText: 'Edit Category' });
      await edit.waitFor({ timeout: 5000 });
      expect(await edit.getByPlaceholder('Category name...').inputValue() === 'Intimate', `${tag}: the pencil opens Edit Category with the name`);
      await edit.getByPlaceholder('Category name...').fill('Lingerie');
      await edit.getByRole('button', { name: 'Edit' }).click();
      await page.waitForTimeout(1000);
      expect(w.calls.some((c) => c.m === 'PATCH' && /^\/product-categories\/\d+$/.test(c.p) && c.body.name === 'Lingerie'), `${tag}: … Edit sends the new name`);
      await closeNav();
      expect((await pill('Draft Stool').textContent())?.trim() === 'Lingerie', `${tag}: … and the card shows the new name (no stale list)`);

      // Filter through the Category Filter Select.
      await openNav();
      await choose(page, nav.getByRole('combobox', { name: 'Category filter' }), 'Chairs');
      await page.waitForTimeout(800);
      await closeNav();
      expect(await cards.count() === 1 && w.calls.some((c) => c.p === '/products' && c.q.includes('category_id=1')), `${tag}: the Category Filter dropdown filters the grid`);
      await openNav();
      const chairsBg = await nav.getByRole('button', { name: /^Chairs/ }).evaluate((el) => getComputedStyle(el.parentElement).backgroundColor);
      expect(chairsBg === 'rgb(229, 231, 235)', `${tag}: … its row is the active (gray) one (${chairsBg})`);
      await choose(page, nav.getByRole('combobox', { name: 'Category filter' }), 'All Categories');
      await page.waitForTimeout(800);

      // Delete → Campaigns' Delete Category dialog → the pill goes.
      await openNav();
      await nav.getByRole('button', { name: 'Delete Lingerie' }).click();
      const del = page.getByRole('alertdialog');
      expect(await del.getByRole('heading', { name: 'Delete Category' }).isVisible() && await del.getByText(/Its products stay/).isVisible(), `${tag}: Delete asks in Campaigns' Delete Category dialog`);
      await page.waitForTimeout(400); // the dialog's zoom-in
      await page.screenshot({ path: `${OUT}/${tag}-04-delete.png` });
      await del.getByRole('button', { name: 'Delete' }).click();
      await page.waitForTimeout(1000);
      expect(w.calls.some((c) => c.m === 'DELETE' && /^\/product-categories\/\d+$/.test(c.p)) && await toast('Category "Lingerie" deleted').count() > 0, `${tag}: … deleted, with a toast`);
      await closeNav();
      expect(!(await pill('Draft Stool').count()) && (await pill('Walnut Chair').textContent())?.trim() === 'Chairs', `${tag}: … and the cards drop it (no stale list)`);
      expect(!(await nav.getByRole('button', { name: 'Delete Sofas' }).count()), `${tag}: a website category still can't be deleted`);

      // Review I1: none of this wrote product categories into Campaigns' colour store.
      const stored = Object.keys(JSON.parse(await page.evaluate(() => localStorage.getItem('stasht_category_colors')) || '{}'));
      expect(!stored.some((k) => ['Chairs', 'Sofas', 'Intimate', 'Lingerie'].includes(k)), `${tag}: review I1 Campaigns' colour store holds no product category (${stored.join(',')})`);

      // Audit: filtered empty state = Campaigns' AllMemoriesEmptyState.
      await page.getByRole('searchbox', { name: 'Search products' }).fill('zzz');
      await page.waitForTimeout(1000);
      expect(await page.getByRole('heading', { name: 'No products found' }).isVisible() && await page.getByRole('button', { name: 'Clear all filters' }).isVisible(), `${tag}: no match → Campaigns' "No … found" empty state`);
      await page.screenshot({ path: `${OUT}/${tag}-05-empty-filtered.png` });
      await page.getByRole('button', { name: 'Clear all filters' }).click();
      await page.waitForTimeout(1000);
      expect(await cards.count() === 3, `${tag}: … Clear all filters brings the list back`);

      // C4 + C7 + C9: a new product, photos picked before the first save.
      await page.getByRole('button', { name: 'Add a product' }).filter({ visible: true }).first().click();
      const editor = page.getByTestId('product-editor');
      await editor.waitFor({ timeout: 10000 });
      expect(!(await editor.getByText('Save the product to add photos and a video.').count()) && await editor.getByRole('button', { name: 'Add photos or a video' }).isVisible(), `${tag}: C4 a new product's Media card has Add photos or a video`);
      const currency = editor.getByLabel('Currency', { exact: true });
      expect((await currency.textContent()).includes('USD – US dollar') && await currency.getAttribute('role') === 'combobox', `${tag}: C7 Currency is a dropdown, USD by default`);
      for (const [label, ph] of [['Price', 'e.g. 49.99'], ['Compare-at price', 'e.g. 59.99'], ['SKU', 'e.g. WAL-CHAIR-01'], ['Barcode / UPC', 'e.g. 012345678905'], ['Quantity (optional)', 'e.g. 25'], ['Brand', 'e.g. Mill & Co'], ['Page title', 'e.g. Walnut Dining Chair | Mill & Co'], ['Share image', 'e.g. https://example.com/chair.jpg']]) {
        expect(await editor.getByLabel(label, { exact: true }).getAttribute('placeholder') === ph, `${tag}: C9 ${label} placeholder "${ph}"`);
      }
      const fileInput = editor.getByLabel('Choose photos or a video');
      await fileInput.setInputFiles([png('red'), png('green'), png('blue')]);
      await page.waitForTimeout(300);
      const tiles = editor.locator('li[data-pending]');
      expect(await tiles.count() === 3 && await tiles.first().getByText('Main').isVisible(), `${tag}: three previews before saving, the first is Main`);
      expect(!w.uploads?.length, `${tag}: … nothing uploaded yet`);
      await editor.getByRole('button', { name: 'Move Photo 2 earlier' }).click({ force: true });
      await editor.getByRole('button', { name: 'Remove Photo 3' }).click({ force: true });
      expect(await tiles.count() === 2, `${tag}: reorder + remove work before saving (no confirm needed: nothing is uploaded)`);
      await fileInput.setInputFiles([{ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') }]);
      await page.waitForTimeout(300);
      expect(await editor.getByText('notes.pdf: Use a JPG, PNG, GIF or WebP photo, or an MP4, MOV or WebM video.').isVisible(), `${tag}: a refused file is listed at the bottom of the Media card`);
      await editor.getByLabel('Title', { exact: true }).fill('Linen Cushion');
      await choose(page, currency, 'EUR – Euro');
      await shootEditor(page, `${OUT}/${tag}-06-new-with-photos.png`);
      // Leaving with picks asks first.
      await editor.getByRole('button', { name: 'Close' }).click();
      expect(await page.getByRole('alertdialog').getByText('Leave without saving?').isVisible(), `${tag}: leaving with picked photos asks first`);
      await page.getByRole('alertdialog').getByRole('button', { name: 'Keep editing' }).click();
      await page.waitForTimeout(300);
      const before = w.calls.length;
      await editor.getByRole('button', { name: 'Save' }).last().click();
      const details = page.getByTestId('product-details');
      await details.waitFor({ timeout: 15000 });
      const made = w.calls.slice(before);
      const posts = made.filter((c) => c.m === 'POST' && c.p === '/products');
      const ups = made.filter((c) => c.m === 'POST' && /^\/products\/\d+\/media$/.test(c.p));
      expect(posts.length === 1 && posts[0].body.currency === 'EUR', `${tag}: one POST /products, currency EUR (${posts.length})`);
      expect(ups.length === 2 && w.uploads.map((u) => u.name).join(',') === 'green.png,red.png', `${tag}: then the 2 photos upload in their order (${w.uploads.map((u) => u.name)})`);
      expect(await details.getByRole('heading', { name: 'Linen Cushion' }).isVisible() && await details.getByRole('button', { name: /^Show photo/ }).count() === 2 && await details.getByText('Saved.', { exact: true }).isVisible(), `${tag}: … the details view shows the product with its 2 photos`);
      await shootLayer(page, 'product-details', `${OUT}/${tag}-07-created-details.png`);
      await details.getByRole('button', { name: 'Products', exact: true }).click();
      await page.waitForTimeout(600);
      expect(await cards.filter({ hasText: 'Linen Cushion' }).count() === 1, `${tag}: … and its card is in the grid`);

      // A failed upload keeps the product and the other photos; the editor stays on the saved product.
      w.uploads = [];
      w.mediaRejectName = 'big.png';
      await page.getByRole('button', { name: 'Add a product' }).filter({ visible: true }).first().click();
      await editor.waitFor({ timeout: 10000 });
      await editor.getByLabel('Title', { exact: true }).fill('Wool Throw');
      await editor.getByLabel('Choose photos or a video').setInputFiles([png('big'), png('small')]);
      await page.waitForTimeout(300);
      const before2 = w.calls.length;
      await editor.getByRole('button', { name: 'Save' }).last().click();
      await page.waitForTimeout(1500);
      expect(await editor.isVisible() && await editor.getByText('big.png: The photo is too large.').isVisible(), `${tag}: a failed upload is listed at the bottom of the Media card`);
      expect(await editor.getByText('The product is saved, but one file could not be uploaded.').isVisible(), `${tag}: … the card's bottom says the product is saved`);
      expect(w.products.some((x) => x.title === 'Wool Throw') && w.uploads.map((u) => u.name).join(',') === 'big.png,small.png' && await editor.locator('ul img').count() === 1, `${tag}: … the product exists and small.png still uploaded`);
      await shootEditor(page, `${OUT}/${tag}-08-upload-failed.png`);
      await editor.getByRole('button', { name: 'Save' }).last().click();
      await details.waitFor({ timeout: 15000 });
      const after2 = w.calls.slice(before2);
      expect(after2.filter((c) => c.m === 'POST' && c.p === '/products').length === 1 && after2.some((c) => c.m === 'PATCH'), `${tag}: … Save again PATCHes it (still one POST) and opens its details`);
      w.mediaRejectName = null;
      await context.close();
    }
  }
  if (run('photos')) {
    // Chris, 17 Nov: "should have option to hide photo in edit. So this should be gone" — the editor's "Show photos".
    for (const [width, height] of [[1280, 900], [390, 844]]) {
      const tag = `photos-${width}`;
      const w = world();
      const MANUAL_EDITABLE = detailOf(w.products[0]).editable_fields;
      // Walnut Chair: a web API with the column (can_hide_photos). Draft Stool: an older web API (no switch).
      Object.assign(w.products[0], { can_hide_photos: true, show_photos: true, extra: { editable_fields: [...MANUAL_EDITABLE, 'show_photos'] } });
      const { page, context } = await open(w, { width, height });
      const cards = page.getByTestId('product-card');
      await cards.first().waitFor({ timeout: 15000 });
      const details = page.getByTestId('product-details');
      const editor = page.getByTestId('product-editor');
      const photos = details.getByTestId('product-photos');

      await cards.filter({ hasText: 'Draft Stool' }).getByRole('button').first().click();
      await details.getByRole('heading', { name: 'Draft Stool' }).waitFor({ timeout: 10000 });
      expect(await photos.count() === 1 && !(await details.getByText('Photos', { exact: true }).count()), `${tag}: older web API: photos show, no Photos line`);
      await details.getByRole('button', { name: 'Edit', exact: true }).click();
      await editor.waitFor({ timeout: 10000 });
      expect(!(await editor.getByTestId('product-show-photos').count()), `${tag}: … and the editor offers no switch`);
      await editor.getByRole('button', { name: /^Cancel/ }).first().click();
      await page.waitForTimeout(600);
      if (await details.isVisible()) await details.getByRole('button', { name: 'Products' }).first().click();
      await page.waitForTimeout(400);

      await cards.filter({ hasText: 'Walnut Chair' }).getByRole('button').first().click();
      await details.getByRole('heading', { name: 'Walnut Chair' }).waitFor({ timeout: 10000 });
      expect(await photos.count() === 1, `${tag}: Walnut Chair shows its photo`);
      await details.getByRole('button', { name: 'Edit', exact: true }).click();
      await editor.waitFor({ timeout: 10000 });
      const sw = editor.getByTestId('product-show-photos');
      await sw.scrollIntoViewIfNeeded();
      expect(await sw.isVisible() && (await sw.getAttribute('aria-checked')) === 'true', `${tag}: the editor has "Show photos", on`);
      expect(await editor.getByText("Off hides the photo area on this product's page.").isVisible(), `${tag}: … with its help line`);
      await page.screenshot({ path: `${OUT}/${tag}-01-switch.png` });
      await sw.click();
      const before = w.calls.length;
      await editor.getByRole('button', { name: 'Save' }).last().click();
      await details.getByRole('heading', { name: 'Walnut Chair' }).waitFor({ timeout: 15000 });
      const patch = w.calls.slice(before).find((c) => c.m === 'PATCH');
      expect(patch && patch.body.show_photos === false, `${tag}: Save sends show_photos: false (${JSON.stringify(patch?.body?.show_photos)})`);
      await page.waitForTimeout(400);
      expect(await photos.count() === 0, `${tag}: the details page has no photo area`);
      expect(await details.getByText('Hidden', { exact: true }).isVisible(), `${tag}: … and its Details say Photos: Hidden`);
      await page.screenshot({ path: `${OUT}/${tag}-02-hidden.png` });

      await details.getByRole('button', { name: 'Edit', exact: true }).click();
      await editor.waitFor({ timeout: 10000 });
      expect((await editor.getByTestId('product-show-photos').getAttribute('aria-checked')) === 'false', `${tag}: the editor opens with it off`);
      await editor.getByTestId('product-show-photos').click();
      await editor.getByRole('button', { name: 'Save' }).last().click();
      await details.getByRole('heading', { name: 'Walnut Chair' }).waitFor({ timeout: 15000 });
      await page.waitForTimeout(400);
      expect(await photos.count() === 1, `${tag}: on again: the photo is back`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(!overflow, `${tag}: no horizontal page scroll`);
      await context.close();
    }
  }
  if (run('campaigns')) {
    for (const [width, height] of [[1280, 900], [390, 844]]) {
      const tag = `campaigns-${width}`;
      const on = world();
      const a = await open(on, { width, height, path: '/memories' });
      await a.page.waitForTimeout(3000);
      expect(!(await a.page.getByText('Harbour Sofa', { exact: true }).filter({ visible: true }).count()), `${tag}: switch on → no website product card in Campaigns`);
      if (width >= 768) {
        expect(await a.page.getByRole('button', { name: /^Campaigns\s*4$/ }).filter({ visible: true }).count() > 0, `${tag}: sidebar Campaigns 4 (catalogue item not added)`);
        expect(await a.page.getByRole('button', { name: /^Products\s*3$/ }).filter({ visible: true }).count() > 0, `${tag}: sidebar Products 3`);
      }
      await a.page.screenshot({ path: `${OUT}/${tag}-01-switch-on.png` });
      await a.context.close();

      const off = world({ pilot: false });
      const b = await open(off, { width, height, path: '/memories' });
      await b.page.getByText('Harbour Sofa', { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 20000 }).catch(() => {});
      expect(await b.page.getByText('Harbour Sofa', { exact: true }).filter({ visible: true }).count() > 0, `${tag}: switch off → the website product card is still in Campaigns`);
      if (width >= 768) expect(await b.page.getByRole('button', { name: /^Campaigns\s*5$/ }).filter({ visible: true }).count() > 0, `${tag}: switch off → sidebar Campaigns 5 (as today)`);
      if (width >= 768) {
        // Post-live P2: the Campaigns panel's catalogue box says "Products" (same items, same count, same search).
        const box = b.page.getByRole('button', { name: /^Products\s*1$/ }).filter({ visible: true }).first();
        expect(await box.count() > 0 && !(await b.page.getByText(/Website Catalogue/).filter({ visible: true }).count()), `${tag}: the Campaigns panel box reads "Products (1)", no "Website Catalogue"`);
        // The panel still settles after the first paint (the AI-credits notice above it): click again if the first
        // click landed before that (the box itself is unchanged apart from its label).
        await box.click().catch(() => {});
        await b.page.waitForTimeout(600);
        if (await box.getAttribute('aria-expanded').catch(() => null) !== 'true') { await box.click().catch(() => {}); await b.page.waitForTimeout(600); }
        expect(await b.page.getByPlaceholder('Search products').filter({ visible: true }).count() > 0 && await b.page.getByRole('button', { name: 'Expand Sofas' }).filter({ visible: true }).count() > 0, `${tag}: … opening it shows its search and the same items (Sofas group)`);
      }
      await b.page.screenshot({ path: `${OUT}/${tag}-02-switch-off.png` });
      await b.context.close();

      // Task 16 (T15 minors): an older API (404 on /products/status, as Laravel's HTML page) is the switch off, exactly as today.
      const old = world({ statusMode: 'old' });
      const o = await open(old, { width, height, path: '/memories' });
      await o.page.getByText('Harbour Sofa', { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 20000 }).catch(() => {});
      expect(await o.page.getByText('Harbour Sofa', { exact: true }).filter({ visible: true }).count() > 0, `${tag}: older API (HTML 404) → the website product card is in Campaigns`);
      if (width >= 768) {
        expect(await o.page.getByRole('button', { name: /^Campaigns\s*5$/ }).filter({ visible: true }).count() > 0, `${tag}: older API (HTML 404) → sidebar Campaigns 5 (as today)`);
        // (/^Products(?!\s*1$)/: not the Campaigns panel's catalogue box, which says "Products 1" since post-live P2.)
        expect(!(await o.page.getByRole('button', { name: /^Products(?!\s*1$)/ }).filter({ visible: true }).count()), `${tag}: older API (HTML 404) → no sidebar Products`);
      }
      expect(!old.calls.some((c) => c.m === 'GET' && c.p === '/products'), `${tag}: older API (HTML 404) → no /products list call`);
      await o.page.screenshot({ path: `${OUT}/${tag}-03-older-api.png` });
      await o.context.close();

      // Final review C1: the status route failing fails OPEN, like development and like the grid: the website product
      // card stays in Campaigns and is counted (grid and count agree) …
      const failOn = world({ statusMode: 'fail' });
      const f1 = await open(failOn, { width, height, path: '/memories' });
      await f1.page.getByText('Harbour Sofa', { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 20000 }).catch(() => {});
      expect(await f1.page.getByText('Harbour Sofa', { exact: true }).filter({ visible: true }).count() > 0, `${tag}: status failed (pilot) → the website product card is in Campaigns (fail open)`);
      if (width >= 768) {
        expect(await f1.page.getByRole('button', { name: /^Campaigns\s*5$/ }).filter({ visible: true }).count() > 0, `${tag}: status failed (pilot) → sidebar Campaigns 5, matching the grid`);
      }
      await f1.page.screenshot({ path: `${OUT}/${tag}-04-status-failed-pilot.png` });
      // … and once the status answers pilot (another counter mounting: the Users page), the count and the grid drop it.
      if (width >= 768) {
        failOn.statusMode = null;
        await f1.page.getByRole('button', { name: /^Users/ }).filter({ visible: true }).first().click();
        await f1.page.getByRole('button', { name: /^Campaigns\s*4$/ }).filter({ visible: true }).first().waitFor({ timeout: 15000 }).catch(() => {});
        expect(await f1.page.getByRole('button', { name: /^Campaigns\s*4$/ }).filter({ visible: true }).count() > 0, `${tag}: … the status answers pilot → sidebar Campaigns 4`);
        await f1.page.getByRole('button', { name: /^Campaigns\s*4$/ }).filter({ visible: true }).first().click();
        await f1.page.waitForTimeout(2500);
        expect(!(await f1.page.getByText('Harbour Sofa', { exact: true }).filter({ visible: true }).count()), `${tag}: … and the grid no longer shows the website product card`);
        await f1.page.screenshot({ path: `${OUT}/${tag}-04b-status-answered-pilot.png` });
      }
      await f1.context.close();

      // Switch off: a failed status counts the website products as today, and the later answer keeps them.
      if (width >= 768) {
        const failOff = world({ pilot: false, statusMode: 'fail' });
        const f2 = await open(failOff, { width, height, path: '/memories' });
        await f2.page.waitForTimeout(3000);
        expect(await f2.page.getByRole('button', { name: /^Campaigns\s*5$/ }).filter({ visible: true }).count() > 0, `${tag}: status failed (switch off) → sidebar Campaigns 5 (as today)`);
        failOff.statusMode = null;
        await f2.page.getByRole('button', { name: /^Users/ }).filter({ visible: true }).first().click();
        await f2.page.waitForTimeout(3000);
        expect(await f2.page.getByRole('button', { name: /^Campaigns\s*5$/ }).filter({ visible: true }).count() > 0, `${tag}: … the status answers later → still Campaigns 5`);
        const countCalls = failOff.calls.filter((c) => c.p === '/website-catalogue/items' && new URLSearchParams(c.q).get('per_page') === '1').length;
        expect(countCalls === 1, `${tag}: … without counting the website items again (${countCalls} count calls)`);
        await f2.page.screenshot({ path: `${OUT}/${tag}-05-status-recovered.png` });
        await f2.context.close();
      }

      // Dashboard: a Total Products card only when the API sends total_products (Products on); 5 columns from 2xl.
      const stats = (products) => ({
        total_memories: { count: 4, period_count: 1, previous_period_count: 0, percentage: { value: 25, trend: 'up' } },
        total_media: { count: 10, percentage: { value: 0, trend: 'neutral' } },
        total_users: { count: 2, percentage: { value: 0, trend: 'neutral' } },
        ...(products ? { total_products: { count: 3, period_count: 2, previous_period_count: 1, percentage: { value: 50, trend: 'up' } } } : {}),
        storage: { used: 1, formatted: '1 MB', limit_formatted: '5 GB', available_formatted: '4.99 GB', percentage: { value: 0, trend: 'up' } },
      });
      for (const products of [true, false]) {
        const dw = world({ pilot: products, dashboard: stats(products) });
        const d = await open(dw, { width, height, path: '/' });
        const campaignsCard = d.page.getByText('Total Campaigns', { exact: true }).filter({ visible: true }).first();
        await campaignsCard.waitFor({ timeout: 20000 }).catch(() => {});
        const productsCard = d.page.getByText('Total Products', { exact: true }).filter({ visible: true });
        const grid = await campaignsCard.evaluate((el) => el.closest('.grid')?.className || '').catch(() => '');
        if (products) {
          expect(await productsCard.count() === 1, `${tag}: Dashboard shows a Total Products card`);
          const card = d.page.locator('div', { has: d.page.getByText('Total Products', { exact: true }) }).filter({ hasText: '3' }).last();
          expect(await card.isVisible().catch(() => false), `${tag}: … with the API's count (3)`);
          expect(/\b2xl:grid-cols-5\b/.test(grid) && /\blg:grid-cols-4\b/.test(grid), `${tag}: … 4 columns at lg, 5 from 2xl (${grid})`);
        } else {
          expect(await productsCard.count() === 0, `${tag}: no total_products → no Total Products card`);
          expect(!/2xl:grid-cols-5/.test(grid) && /\blg:grid-cols-4\b/.test(grid), `${tag}: … and the grid classes are as today (${grid})`);
        }
        await d.page.screenshot({ path: `${OUT}/${tag}-06-dashboard-${products ? 'products' : 'off'}.png`, fullPage: true });
        await d.context.close();
      }
    }
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall products checks passed');
process.exit(failures.length || relevant.length ? 1 : 0);
