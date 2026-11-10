// tests/products/ui/products-page.mjs — Products M2 in the real app, every API call answered here (nothing leaves this
// machine). Blocks: nav (Task 12), grid (13), editor (14), campaigns (15). Run one: PR_ONLY=nav node tests/products/ui/products-page.mjs
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
  default_currency: 'CAD',
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
    if (p === '/products/status') return route.fulfill({ json: { success: true, data: statusOf(w) } });
    if (p === '/products' && m === 'GET') {
      if (!w.pilot || w.reason) return route.fulfill({ status: 403, json: { success: false, code: w.reason || 'not_available', message: 'x' } });
      const s = url.searchParams;
      let list = [...w.products];
      if (s.get('q')) list = list.filter((x) => x.title.toLowerCase().includes(s.get('q').toLowerCase()));
      if (s.get('status')) list = list.filter((x) => s.get('status').split(',').includes(x.badge));
      if (s.get('source')) list = list.filter((x) => x.origin === s.get('source'));
      if (s.get('category_id')) list = list.filter((x) => x.categories.some((c) => String(c.id) === s.get('category_id')));
      return route.fulfill({ json: { success: true, data: { items: list, pagination: { current_page: 1, per_page: 48, total: list.length, last_page: 1 } } } });
    }
    // w.reject = {field: [message]}: the next save answers 422 with those errors (like ProductRules / ProductWriter).
    const reject422 = () => { const errors = w.reject; w.reject = null; return route.fulfill({ status: 422, json: { success: false, message: Object.values(errors)[0][0], errors } }); };
    if (p === '/products' && m === 'POST') {
      if (w.reject) return reject422();
      const created = product(w.nextId++, body.title, { status: body.status || 'draft', badge: body.status || 'draft', price: body.price != null ? String(body.price) : null, price_label: body.price != null ? `$${body.price} CAD` : '', main_image: null, images_count: 0 });
      created.extra = extrasFrom(body, { media: [] }, w);
      w.products.unshift(created);
      return route.fulfill({ status: 201, json: { success: true, data: detailOf(created) } });
    }
    const one = /^\/products\/(\d+)$/.exec(p);
    if (one) {
      const found = w.products.find((x) => x.id === Number(one[1]));
      if (!found) return route.fulfill({ status: 404, json: { success: false, message: 'Product not found.' } });
      if (m === 'PATCH' && w.reject) return reject422();
      if (m === 'PATCH') { const extra = extrasFrom(body, found.extra, w); Object.assign(found, body, body.status ? { badge: body.status } : {}); found.extra = extra; }
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
    if (p === '/products/bulk') {
      // Like ProductBulk: ids in w.skip (not the account's own) and, on delete, website products are skipped.
      const ids = body.ids || [];
      const skipped = ids.filter((id) => (w.skip || []).includes(id) || (body.action === 'delete' && w.products.find((x) => x.id === id)?.origin !== 'manual'));
      const done = ids.filter((id) => !skipped.includes(id));
      if (body.action === 'status') w.products.filter((x) => done.includes(x.id)).forEach((x) => { x.status = body.status; x.badge = body.status; });
      if (body.action === 'delete') w.products = w.products.filter((x) => !done.includes(x.id));
      return route.fulfill({ json: { success: true, data: { updated: body.action === 'delete' ? 0 : done.length, deleted: body.action === 'delete' ? done.length : 0, skipped_ids: skipped } } });
    }
    if (p === '/product-categories' && m === 'GET') return route.fulfill({ json: { success: true, data: { categories: w.categories, total: w.products.length } } });
    if (p === '/product-categories' && m === 'POST') {
      const c = { id: w.nextId++, name: body.name, from_website: false, product_count: 0, read_only: false };
      w.categories.push(c);
      return route.fulfill({ status: 201, json: { success: true, data: { category: c } } });
    }
    // App drops a stored property view that isn't among the account's properties (utils/accountState), so a world that
    // opens in a property view lists that property here.
    if (p === '/properties' && m === 'GET') return route.fulfill({ json: { success: true, data: { owned_properties: w.properties || [], shared_properties: [] } } });
    if (p === '/memories' && m === 'GET') return route.fulfill({ json: { success: true, data: { latest_memories: [], sharedWith: [], published: [], shopify: { count: 0, collections: [] }, all_memories: { data: [], pagination: { current_page: 1, per_page: 50, total: 0, last_page: 1 } }, sidebar: { categories: { title: 'Categories', count: 1, items: [{ id: 5, name: 'Campaigns', color: '#6366F1', memory_count: 0, admin_id: null, memories: [] }] }, labels: { title: 'Labels', count: 0, items: [] } }, filters: { authors: [] } } } });
    if (p === '/user/memory-counts') return route.fulfill({ json: { success: true, data: { memory_counts: { total_memories: 4, total_memory_images: 10, published_memories: 0 } } } });
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: true, reason: null, item_count: 1, source: null, scan: null, limits: { item_limit: 500, sync_now_minutes: 15 } } } });
    if (p === '/website-catalogue/items') return route.fulfill({ json: { success: true, data: { items: [{ id: 603, title: 'Harbour Sofa', price_label: '$1,299 CAD', category: 'Sofas', main_image: img(603), images_count: 1, url: 'https://royalwood.example.ca/harbour' }], pagination: { current_page: 1, per_page: 500, total: 1, last_page: 1 } } } });
    if (p === '/cars') return route.fulfill({ json: { success: true, data: { cars: [], pagination: { last_page: 1 }, filters: {} } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 4, memory_limit: 50 } } } });
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
      await bar.getByRole('combobox', { name: 'Change status' }).selectOption('archived');
      await page.waitForTimeout(800);
      const bulk = w.calls.find((c) => c.p === '/products/bulk');
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
      expect(await sbar.getByText("1 deleted, 1 skipped (they're no longer available to you).").isVisible().catch(() => false), `${tag}: the bulk result shows at the bottom of the bar`);
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
      await x.context.close();
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
      expect(await editor.getByRole('button', { name: /Add photos or a video/ }).isVisible(), `${tag}: after the first save, photos can be added`);
      await editor.getByRole('button', { name: 'Close' }).click();
      await page.waitForTimeout(600);

      await page.getByTestId('product-card').filter({ hasText: 'Harbour Sofa' }).getByRole('button').first().click();
      await editor.waitFor({ timeout: 10000 });
      await editor.getByLabel('Title', { exact: true }).waitFor({ timeout: 10000 }); // loaded (the editor says "Loading…" first)
      expect(await editor.getByText(/This product comes from your website\./).isVisible(), `${tag}: a website product says it is read-only`);
      expect(await editor.getByLabel('Title', { exact: true }).isDisabled(), `${tag}: … its title can't be changed`);
      expect(!(await editor.getByLabel('Status', { exact: true }).isDisabled()), `${tag}: … its status can`);
      expect(!(await editor.getByRole('button', { name: 'Delete' }).count()), `${tag}: … and it has no Delete`);
      await editor.getByLabel('Status', { exact: true }).selectOption('archived');
      await editor.getByRole('button', { name: 'Save' }).last().click();
      await page.waitForTimeout(800);
      const patch = w.calls.filter((c) => c.m === 'PATCH').pop();
      expect(patch && Object.keys(patch.body).every((k) => ['status', 'tags', 'collections', 'internal_notes', 'show_price', 'show_enquire', 'category_ids'].includes(k)) && patch.body.status === 'archived', `${tag}: PATCH carries Studio-only fields only (${JSON.stringify(patch?.body)})`);
      await shootEditor(page, `${OUT}/${tag}-02-website.png`);
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
      expect(w.products[0].title === 'Pine Table' && await editor.getByText('Saved. You can add photos now.').isVisible(), `${tag}: created, and the reopened editor says Saved`);
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
      await editor.getByLabel('Blue photo', { exact: true }).selectOption({ label: 'Photo 2' });
      await editor.getByRole('button', { name: 'Save' }).last().click();
      await page.waitForTimeout(800);
      const vp = w.calls.filter((c) => c.m === 'PATCH').pop();
      expect(vp && vp.body.variants[1].image_id === first && !('media' in vp.body), `${tag}: Blue's photo is saved as its image_id (${JSON.stringify(vp?.body?.variants?.map((v) => v.image_id))})`);
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
      await editor.getByRole('button', { name: 'Close' }).click();
      const leave = page.getByRole('alertdialog');
      expect(await leave.getByText('Leave without saving?').isVisible(), `${tag}: unsaved changes ask before closing`);
      const onTop = await leave.evaluate((el) => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + 20); return el.contains(hit); });
      expect(onTop, `${tag}: … above the editor`);
      await leave.getByRole('button', { name: 'Keep editing' }).click();
      await leave.waitFor({ state: 'detached' }); // Radix hides the rest of the page from the accessibility tree while it is open
      await editor.getByLabel('Title', { exact: true }).fill('Pine Table');

      expect(await editor.getByRole('button', { name: 'Archive' }).isVisible(), `${tag}: a manual product has Archive`);
      // Archive changes the status only: an unsaved title stays unsaved (and still guarded).
      await editor.getByLabel('Title', { exact: true }).fill('Pine Table Draft Name');
      await editor.getByRole('button', { name: 'Archive' }).click();
      await page.waitForTimeout(800);
      const arch = w.calls.filter((c) => c.m === 'PATCH').pop();
      expect(arch && JSON.stringify(arch.body) === '{"status":"archived"}', `${tag}: Archive sends only the status (${JSON.stringify(arch?.body)})`);
      expect(await editor.getByLabel('Title', { exact: true }).inputValue() === 'Pine Table Draft Name' && await editor.getByLabel('Status', { exact: true }).inputValue() === 'archived' && await editor.getByRole('button', { name: 'Unarchive' }).isVisible(), `${tag}: … the title edit is kept, the status reads Archived, the button Unarchive`);
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
      await editor.getByRole('button', { name: 'Unarchive' }).click();
      await page.waitForTimeout(800);
      expect(JSON.stringify(w.calls.filter((c) => c.m === 'PATCH').pop()?.body) === '{"status":"active"}', `${tag}: Unarchive sends only the status`);
      await editor.getByLabel('Title', { exact: true }).fill('Pine Table'); // back to the saved title: nothing unsaved
      await editor.getByRole('button', { name: 'Duplicate' }).click();
      await page.waitForTimeout(1200);
      expect(w.calls.some((c) => c.m === 'POST' && c.p === `/products/${id}/duplicate`) && await editor.getByRole('heading', { name: 'Pine Table (copy)' }).isVisible(), `${tag}: Duplicate opens the copy`);
      const copyId = w.products[0].id;
      await editor.getByRole('button', { name: 'Delete' }).click();
      const del = page.getByRole('alertdialog');
      expect(await del.getByText('Delete this product?').isVisible(), `${tag}: Delete asks first`);
      await page.waitForTimeout(400); // the dialog's zoom-in
      await page.screenshot({ path: `${OUT}/${tag}-03-delete.png` });
      await del.getByRole('button', { name: 'Delete' }).click();
      await page.waitForTimeout(1000);
      expect(w.calls.some((c) => c.m === 'DELETE' && c.p === `/products/${copyId}`) && !(await editor.count()), `${tag}: … deletes it and closes the editor`);
      expect(!(await page.getByTestId('product-card').filter({ hasText: 'Pine Table (copy)' }).count()), `${tag}: … and the copy left the grid`);
      // Opened from "Add a product", remounted on the new product and then on its copy: focus goes back to that button.
      expect(await page.evaluate(() => (document.activeElement?.textContent || '').includes('Add a product')), `${tag}: after create, duplicate and delete, focus is back on Add a product (${await page.evaluate(() => document.activeElement?.tagName + ' ' + (document.activeElement?.textContent || '').slice(0, 30))})`);

      // Closing returns focus to the card that opened the editor; a clean editor closes on Back.
      const chairOpen = page.getByTestId('product-card').filter({ hasText: 'Walnut Chair' }).getByRole('button').first();
      await chairOpen.click();
      await editor.getByLabel('Title', { exact: true }).waitFor({ timeout: 10000 });
      await editor.getByRole('button', { name: 'Close' }).click();
      await page.waitForTimeout(400);
      expect(await chairOpen.evaluate((el) => el === document.activeElement), `${tag}: closing puts focus back on the card`);
      await chairOpen.click();
      await editor.getByLabel('Title', { exact: true }).waitFor({ timeout: 10000 });
      await page.goBack();
      await page.waitForTimeout(500);
      expect(!(await editor.count()) && new URL(page.url()).pathname === '/products', `${tag}: Back closes a clean editor and stays on Products`);

      // Closing the tab with unsaved edits: the browser asks.
      await chairOpen.click();
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
      const xe = x.page.getByTestId('product-editor');
      await xe.waitFor({ timeout: 10000 });
      await x.page.waitForTimeout(500);
      expect(await xe.getByText('Shared by Serpa Chrysler. You can view it here.').isVisible(), `${tag}: External view says who shared it`);
      expect(await xe.getByLabel('Title', { exact: true }).isDisabled() && await xe.getByLabel('Status', { exact: true }).isDisabled() && await xe.getByLabel('Price', { exact: true }).isDisabled(), `${tag}: … title, status and price are read-only`);
      expect(!(await xe.getByRole('button', { name: /^(Save|Duplicate|Archive|Delete)$/ }).count()), `${tag}: … no Save, Duplicate, Archive or Delete`);
      expect(!(await xe.getByRole('button', { name: /Add photos/ }).count()) && !(await xe.getByRole('heading', { name: 'Internal notes' }).count()), `${tag}: … no photo upload and no internal notes`);
      expect(xw.calls.some((c) => c.p === '/products/601' && c.view === '31'), `${tag}: … asked with the property header`);
      await shootEditor(x.page, `${OUT}/${tag}-04-external.png`);
      await xe.getByRole('button', { name: 'Close' }).click();
      await x.page.waitForTimeout(400);
      expect(!(await xe.count()) && !xw.calls.some((c) => ['PATCH', 'POST', 'PUT', 'DELETE'].includes(c.m) && c.p.startsWith('/products')), `${tag}: … closes without asking and nothing was written`);
      await x.context.close();
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
      await b.page.screenshot({ path: `${OUT}/${tag}-02-switch-off.png` });
      await b.context.close();
    }
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall products checks passed');
process.exit(failures.length || relevant.length ? 1 : 0);
