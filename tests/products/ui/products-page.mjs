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
  };
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
    if (p === '/products' && m === 'POST') {
      const created = product(w.nextId++, body.title, { status: body.status || 'draft', badge: body.status || 'draft', price: body.price != null ? String(body.price) : null, price_label: body.price != null ? `$${body.price} CAD` : '' });
      w.products.unshift(created);
      return route.fulfill({ status: 201, json: { success: true, data: detailOf(created) } });
    }
    const one = /^\/products\/(\d+)$/.exec(p);
    if (one) {
      const found = w.products.find((x) => x.id === Number(one[1]));
      if (!found) return route.fulfill({ status: 404, json: { success: false, message: 'Product not found.' } });
      if (m === 'PATCH') Object.assign(found, body, body.status ? { badge: body.status } : {});
      if (m === 'DELETE') { w.products = w.products.filter((x) => x !== found); return route.fulfill({ json: { success: true, data: { deleted: true } } }); }
      return route.fulfill({ json: { success: true, data: detailOf(found) } });
    }
    if (p === '/products/bulk') {
      const ids = body.ids || [];
      if (body.action === 'status') w.products.filter((x) => ids.includes(x.id)).forEach((x) => { x.status = body.status; x.badge = body.status; });
      if (body.action === 'delete') w.products = w.products.filter((x) => !(ids.includes(x.id) && x.origin === 'manual'));
      return route.fulfill({ json: { success: true, data: { updated: ids.length, deleted: body.action === 'delete' ? ids.length : 0, skipped_ids: [] } } });
    }
    if (p === '/product-categories' && m === 'GET') return route.fulfill({ json: { success: true, data: { categories: w.categories, total: w.products.length } } });
    if (p === '/product-categories' && m === 'POST') {
      const c = { id: w.nextId++, name: body.name, from_website: false, product_count: 0, read_only: false };
      w.categories.push(c);
      return route.fulfill({ status: 201, json: { success: true, data: { category: c } } });
    }
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
    }
  }
  // (Tasks 14–15 add their blocks here.)
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall products checks passed');
process.exit(failures.length || relevant.length ? 1 : 0);
