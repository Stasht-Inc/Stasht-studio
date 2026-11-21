// tests/products/ui/c21r-button-colour.mjs — Chris 21 Nov 2026 (R2-2): "we need ability to color button … so it matches
// their brand. By default maybe it can use the color it chooses from the default background. It doesn't look nice when
// you open up the Royal Woodshop Storeels and the visit buttons are purple." In the real app at 1280 and 390, every API
// call answered here (a small stateful web API: the account colour, each product's colour, the in-card buttons'
// button_color the way ProductButtonColor works it out), every non-local request aborted.
//  A. A visitor opens the published Storeel: "Add to Cart", the website product's "View on website" and Enquire are in
//     the brand green (the brand cover's colour), not purple.
//  B. Products → Button colour → "Use brand colour" off → Blue → saved (PUT /products/button-color) → reload: still Blue.
//  C. Full Arms → its page's buy button is Blue → Edit → Visibility → Button colour → off → Red → Save (PATCH carries
//     button_color) → its page's button is Red → reload → still Red.
//  D. The owner's campaign page: Full Arms Red (+ its Enquire), Full Legs Blue, the website product's "View on website"
//     Blue. 1280: Edit Campaign → the Storeel preview's buttons the same.
//  E. The published page again: only Full Arms Red, the rest Blue.
//  F. 1280: Create → + Products → Full Legs picked → the preview's "Add to Cart" is Blue before saving.
// node tests/products/ui/c21r-button-colour.mjs  (C21B_BASE = dev server, default http://127.0.0.1:5262; C21B_SHOTS)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.C21B_BASE || 'http://127.0.0.1:5262';
const OUT = process.env.C21B_SHOTS || '/Users/deepaksharma/Pictures/Personal-Works/Stasht-Project/handoff-20261114/c21r-B-shots';
mkdirSync(OUT, { recursive: true });

const GREEN = '#1F6F4A'; // TheBodyPolitik's brand colour (its profile colour / brand cover)
const BLUE = '#2563EB';
const RED = '#DC2626';
const rgb = (hex) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
const USER = { id: 71, external_user_id: 960, name: 'TheBodyPolitik', email: 'owner@bodypolitik.test', role: '2', status: 1, is_activated: true, profile_color: GREEN, avatar: `${BASE}/pr-logo/logo.svg`, profile_image: `${BASE}/pr-logo/logo.svg` };
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${GREEN}"/><circle cx="200" cy="170" r="90" fill="#F4E9D8"/><text x="200" y="330" font-size="44" text-anchor="middle" fill="#F4E9D8" font-family="Georgia">BODY POLITIK</text></svg>`;
const photo = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="${['#E8A87C', '#C38D9E', '#41B3A3', '#85CDCA'][n % 4]}"/><text x="400" y="320" font-size="80" text-anchor="middle" fill="#fff">${n}</text></svg>`;
const img = (n) => `${BASE}/pr-img/${n}.jpg`;
const FRESHA = 'https://www.fresha.com/a/the-body-politik-vancouver';
const MANUAL = ['title', 'short_description', 'description_html', 'brand', 'product_type', 'price', 'compare_at_price', 'currency', 'price_on_request', 'sku', 'barcode', 'stock_status', 'quantity', 'options', 'variants', 'attributes', 'weight', 'weight_unit', 'dimensions', 'category_ids', 'tags', 'collections', 'status', 'show_enquire', 'show_price', 'show_photos', 'slug', 'seo_title', 'seo_description', 'share_image', 'buy_url', 'buy_label', 'internal_notes', 'media', 'button_color'];
const WEBSITE = ['status', 'tags', 'collections', 'internal_notes', 'show_price', 'show_enquire', 'show_photos', 'category_ids', 'button_color'];
const textOn = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 > 0.6 ? '#1F2937' : '#FFFFFF'; };

function product(id, title, over = {}) {
  return {
    id, user_id: 960, read_only: false, origin: 'manual', status: 'active', stock_status: 'in_stock', badge: 'active', title,
    price: '45.00', compare_at_price: null, currency: 'CAD', price_label: '$45 CAD', compare_at_label: '', price_on_request: false, show_price: true, show_photos: true,
    main_image: null, images_count: 0, category: null, categories: [{ id: 2, name: 'Body' }], sku: null, brand: null, url: null, updated_at: '2026-11-20T10:00:00Z',
    button_color: null,
    d: { short_description: null, description: null, description_html: null, buy_url: FRESHA, buy_label: 'Add to Cart', media: [], tags: [], attributes: [], internal_notes: null },
    ...over,
  };
}
function world() {
  return {
    calls: [], account: { setting: null, brand: GREEN },
    products: [
      product(804, 'Full Arms', { price: '65.00', price_label: '$65 CAD', d: { short_description: 'All our waxing services are performed with Hard Wax.', description: 'Includes hands and fingers.', description_html: null, buy_url: FRESHA, buy_label: 'Add to Cart', tags: [], attributes: [], internal_notes: null, media: [{ id: 8041, url: img(4), type: 'photo', sort_order: 0 }] } }),
      product(802, 'Full Legs', { price: '85.00', price_label: '$85 CAD', d: { short_description: null, description: 'Both legs, thigh to ankle.', description_html: null, buy_url: FRESHA, buy_label: 'Add to Cart', tags: [], attributes: [], internal_notes: null, media: [{ id: 8021, url: img(2), type: 'photo', sort_order: 0 }] } }),
      product(803, 'Walnut Dining Chair', { origin: 'website', url: 'https://royalwoodshop.example/p/chair', categories: [{ id: 9, name: 'Furniture' }], price: '499.00', price_label: '$499 CAD',
        d: { short_description: null, description: 'Hand-made walnut chair.', description_html: null, buy_url: null, buy_label: null, tags: [], attributes: [], internal_notes: '', media: [{ id: 8031, url: img(3), type: 'photo', sort_order: 0 }] } }),
    ],
  };
}
const accountColor = (w) => w.account.setting || w.account.brand;
const colorOf = (w, p) => p.button_color || accountColor(w);
const accountInfo = (w) => ({ color: accountColor(w), text: textOn(accountColor(w)), setting: w.account.setting, brand: w.account.brand });
function detailOf(w, p) {
  const media = p.d.media;
  return {
    ...p, d: undefined, product_type: null, barcode: null, quantity: null, availability: 'available', options: [], variants: [], weight: null, weight_unit: null, dimensions: null, collections: [],
    seo: { slug: `p-${p.id}`, title: null, description: null, share_image: null }, show_enquire: p.origin === 'manual', can_hide_photos: true,
    ...p.d, buy_button: p.d.buy_label || 'Buy now', media, main_image: media[0]?.url || null, images_count: media.length,
    editable_fields: p.origin === 'manual' ? MANUAL : WEBSITE,
    button_style: { background: colorOf(w, p), text: textOn(colorOf(w, p)) }, brand_button_color: accountColor(w),
  };
}
const summaryOf = (w, p) => { const d = detailOf(w, p); return { ...p, d: undefined, main_image: d.main_image, images_count: d.images_count }; };
const statusOf = (w) => ({ pilot: true, available: true, reason: null, can_create: true, counts: { total: 3, manual: 2, website: 1, shopify: 0 }, default_currency: 'CAD', button_color: accountInfo(w) });

// The campaign: one moment per product (CatalogSnapshotWriter), each with its in-card button.
const CID = 960;
const SLUG = 'november-specials';
const momentText = (p) => [p.d.description || p.title, `Price: ${p.price_label}`].join('\n');
const POSTS = (w) => w.products.map((p, i) => ({
  id: 3000 + i, name: null, title: p.title, description: momentText(p), type_id: `catalog_${p.id}_0_1763730000`,
  master_image_link: p.d.media[0].url, image_link: p.d.media[0].url, media_url: p.d.media[0].url, location: 'Vancouver, BC',
  capture_date: '2026-11-21 10:00:00', uploaded_at: '2026-11-21 10:00:00', parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [], user: { id: 960, name: 'TheBodyPolitik', profile_image: USER.avatar, profile_color: GREEN },
}));
const WIDGETS = (w) => w.products.map((p, i) => {
  const c = colorOf(w, p);
  return {
    id: 700 + i, memory_id: CID, widget_type: 'cta', after_post_id: 3000 + i, widget_order: 0, is_visible: true, admin_approval: 1, in_card: true,
    widget_data: { title: p.price_label, buttonText: p.origin === 'manual' ? 'Add to Cart' : 'View on website', buttonLink: p.origin === 'manual' ? FRESHA : p.url, icon: 'ExternalLink', placement: 'in_card' },
    button_color: c, button_text_color: textOn(c), created_at: '2026-11-21T10:00:00Z', updated_at: '2026-11-21T10:00:00Z',
  };
});
const ENQUIRE = (w) => w.products.map((p, i) => ({ p, i })).filter(({ p }) => p.origin === 'manual').map(({ p, i }) => ({ post_id: 3000 + i, title: p.title, button_color: colorOf(w, p) }));
const CAMPAIGN = {
  id: CID, title: 'November Specials', user_id: 960, published: 1, slug: SLUG, category: { id: 5, name: 'Campaigns' }, sub_category: null,
  photos: { count: 3 }, posts_count: 3, collaborators: [], user: { id: 960, name: 'TheBodyPolitik', profile_image: USER.avatar, profile_color: GREEN },
  created_at: '2026-11-21 10:00:00', location: 'Vancouver, BC', tags: [], min_uploaded_img_date: '2026-11-21', max_uploaded_img_date: '2026-11-21', last_update_img: null,
};
const detailCampaign = (w) => ({ ...CAMPAIGN, posts: POSTS(w), linked_memories: [], unified_order: POSTS(w).map((p) => ({ id: p.id, type: 'post' })) });

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open(w, { width, height, path = '/products', visitor = false }) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user, isVisitor]) => {
    if (sessionStorage.getItem('c21b-seeded')) return;
    sessionStorage.setItem('c21b-seeded', '1');
    localStorage.clear();
    if (isVisitor) return;
    localStorage.setItem('stasht_token', 'tok');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels');
  }, [USER, visitor]);
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
    if (p === '/brand-pictures') return route.fulfill({ json: { success: true, data: Object.fromEntries(url.searchParams.getAll('urls[]').map((u) => [u, { kind: 'logo', color: GREEN, gradient: null }])), pending: 0 } });
    if (p === '/products/status') return route.fulfill({ json: { success: true, data: statusOf(w) } });
    if (p === '/products/button-color' && m === 'PUT') {
      w.account.setting = body?.color ? String(body.color).toUpperCase() : null;
      return route.fulfill({ json: { success: true, data: accountInfo(w) } });
    }
    if (p === '/products' && m === 'GET') return route.fulfill({ json: { success: true, data: { items: w.products.map((x) => summaryOf(w, x)), pagination: { current_page: 1, per_page: 48, total: 3, last_page: 1 } } } });
    const one = /^\/products\/(\d+)$/.exec(p);
    if (one) {
      const found = w.products.find((x) => x.id === Number(one[1]));
      if (!found) return route.fulfill({ status: 404, json: { success: false, message: 'Product not found.' } });
      if (m === 'PATCH' && body && 'button_color' in body) found.button_color = body.button_color ? String(body.button_color).toUpperCase() : null;
      return route.fulfill({ json: { success: true, data: detailOf(w, found) } });
    }
    const item = /^\/website-catalogue\/items\/(\d+)$/.exec(p);
    if (item) {
      const found = w.products.find((x) => x.id === Number(item[1]));
      return found ? route.fulfill({ json: { success: true, data: { ...summaryOf(w, found), description: found.d.description, images: found.d.media, attributes: [], button_style: detailOf(w, found).button_style } } }) : route.fulfill({ status: 404, json: { success: false } });
    }
    if (p === '/product-categories' && m === 'GET') return route.fulfill({ json: { success: true, data: { categories: [{ id: 2, name: 'Body', from_website: false, product_count: 2, read_only: false }, { id: 9, name: 'Furniture', from_website: true, product_count: 1, read_only: false }], total: 3 } } });
    if (p === '/memories' && m === 'GET') {
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: [CAMPAIGN], total: 1, pagination: { current_page: 1, last_page: 1 } }, latest_memories: [CAMPAIGN], sidebar: { categories: { items: [{ id: 5, name: 'Campaigns', memory_count: 1 }] }, labels: { items: [] } } } } });
    }
    if (p === `/memories/${CID}` && m === 'GET') return route.fulfill({ json: { status: 'success', data: { memory: detailCampaign(w), linked_memories: [], unified_order: detailCampaign(w).unified_order, enquire_products: ENQUIRE(w) } } });
    if (p === `/memories/${CID}/widgets` && m === 'GET') return route.fulfill({ json: { success: true, data: WIDGETS(w) } });
    if (p === '/published-memories') return route.fulfill({ json: { success: true, data: { memory: { ...detailCampaign(w), widgets: WIDGETS(w), enquire_products: ENQUIRE(w) }, widgets: WIDGETS(w), enquire_products: ENQUIRE(w), order_by: 'asc' } } });
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 5, name: 'Campaigns', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: false, reason: 'not_available', item_count: 0 } } });
    if (p === '/website-catalogue/items') return route.fulfill({ json: { success: true, data: { items: [], pagination: { last_page: 1 } } } });
    if (p === '/cars') return route.fulfill({ json: { success: true, data: { cars: [], pagination: { last_page: 1 }, filters: {} } } });
    if (p === '/user/memory-counts') return route.fulfill({ json: { success: true, data: { memory_counts: { total_memories: 1, total_memory_images: 3, published_memories: 1 } } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 1, memory_limit: 50 } } } });
    if (p === '/lead-groups') return route.fulfill({ json: { groups: [] } });
    if (p.startsWith('/dashboard')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(`${width}: ${e.message}`));
  page.on('popup', (pp) => pp.close().catch(() => {}));
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(3000);
  return { context, page };
}

const visible = (loc) => loc.filter({ visible: true });
const bg = (loc) => loc.evaluate((el) => getComputedStyle(el.querySelector('a') || el).backgroundColor);
/** Each visible in-card button's text → its background colour. */
async function buttonColours(scope) {
  return scope.locator('[data-product-card-button] a').evaluateAll((els) => els.filter((e) => e.getClientRects().length).map((e) => [e.textContent.trim(), getComputedStyle(e).backgroundColor, getComputedStyle(e).color]));
}
async function enquireColours(scope) {
  return scope.getByTestId('product-enquire-button').evaluateAll((els) => els.filter((e) => e.getClientRects().length).map((e) => getComputedStyle(e).borderTopColor));
}

/** The published Storeel / owner page: product i's button (in moment order) is expected[i]. */
async function checkCampaignButtons(page, tag, expected, { enquire }) {
  await page.getByText('Full Arms').filter({ visible: true }).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  const got = await buttonColours(page.locator('body'));
  const want = [['Add to Cart', expected[0]], ['Add to Cart', expected[1]], ['View on website', expected[2]]];
  // The page may show a card twice (desktop + phone layouts): every visible button must be right, all three present.
  for (const [text, hex] of want) {
    const hits = got.filter(([t]) => t === text);
    expect(hits.length > 0, `${tag}: a visible "${text}" button`);
  }
  const arms = got.filter(([t]) => t === 'Add to Cart');
  expect(arms.some(([, c]) => c === rgb(expected[0])) && arms.some(([, c]) => c === rgb(expected[1])) && arms.every(([, c]) => c === rgb(expected[0]) || c === rgb(expected[1])),
    `${tag}: "Add to Cart" buttons are ${expected[0]} (Full Arms) / ${expected[1]} (Full Legs) ${JSON.stringify(arms)}`);
  const visit = got.filter(([t]) => t === 'View on website');
  expect(visit.length > 0 && visit.every(([, c]) => c === rgb(expected[2])), `${tag}: the website product's "View on website" is ${expected[2]}, not purple ${JSON.stringify(visit)}`);
  expect(!got.some(([, c]) => c === rgb('#6C60FF')), `${tag}: no purple product button left`);
  expect(got.every(([, , ink]) => ink === 'rgb(255, 255, 255)'), `${tag}: white words on the dark colours`);
  if (enquire) {
    const e = await enquireColours(page.locator('body'));
    expect(e.length >= 2 && e.includes(rgb(expected[0])) && e.includes(rgb(expected[1])), `${tag}: Enquire borders follow the product colour ${JSON.stringify(e)}`);
  }
}

async function shootCard(page, path, text = 'Full Arms') {
  const el = visible(page.locator('[data-product-card-button]')).first();
  if (await el.count()) await el.evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(600);
  await page.screenshot({ path });
}

try {
  for (const [width, height] of (process.env.C21B_SIZES ? JSON.parse(process.env.C21B_SIZES) : [[1280, 900], [390, 844]])) {
    const tag = `${width}`;
    const desktop = width >= 1024;
    const w = world();

    // C21B_ONLY_F=1: only F (the Create preview), with the colours A–E would have saved.
    if (process.env.C21B_ONLY_F) { w.account.setting = BLUE; w.products[0].button_color = RED; }
    let v;
    if (!process.env.C21B_ONLY_F) {
    // ── A. Visitor: the published Storeel, default = the brand green ────────────────────────────────────────────
    v = await open(w, { width, height, visitor: true, path: `/published-memory/${SLUG}` });
    await checkCampaignButtons(v.page, `${tag} A published (default)`, [GREEN, GREEN, GREEN], { enquire: true });
    await shootCard(v.page, `${OUT}/${tag}-A1-published-default-green.png`);
    const visitBtn = visible(v.page.locator('[data-product-card-button]').filter({ hasText: 'View on website' })).first();
    await visitBtn.evaluate((n) => n.scrollIntoView({ block: 'center' }));
    await v.page.waitForTimeout(500);
    await v.page.screenshot({ path: `${OUT}/${tag}-A2-published-visit-green.png` });
    await v.context.close();

    // ── B. Products → Button colour → Blue → reload ─────────────────────────────────────────────────────────────
    const { page, context } = await open(w, { width, height });
    await page.getByTestId('products-page').waitFor({ timeout: 15000 });
    const trigger = visible(page.getByTestId('products-button-color')).first();
    await trigger.waitFor({ timeout: 10000 });
    expect((await trigger.innerText()).trim() === 'Button colour', `${tag} B: the Products page has a "Button colour" button`);
    expect(await trigger.locator('span').evaluate((el) => getComputedStyle(el).backgroundColor) === rgb(GREEN), `${tag} B: … its dot shows the brand green`);
    await page.screenshot({ path: `${OUT}/${tag}-B1-products-button-colour.png` });
    await trigger.click();
    const panel = page.getByTestId('products-button-color-panel');
    await panel.waitFor({ timeout: 5000 });
    await page.waitForTimeout(500); // the popover's fade-in
    const useBrand = panel.getByTestId('account-button-color-use-brand');
    expect(await useBrand.getAttribute('aria-checked') === 'true' || await useBrand.getAttribute('data-state') === 'checked', `${tag} B: "Use brand colour" is on by default`);
    expect(await panel.getByTestId('account-button-color-preview').evaluate((el) => getComputedStyle(el).backgroundColor) === rgb(GREEN), `${tag} B: the preview button is green`);
    await page.screenshot({ path: `${OUT}/${tag}-B2-panel-brand.png` });
    await useBrand.click();
    await page.waitForTimeout(300);
    await panel.getByRole('radio', { name: 'Blue' }).click();
    await page.waitForTimeout(1500);
    const put = w.calls.filter((c) => c.m === 'PUT' && c.p === '/products/button-color').pop();
    expect(put?.body?.color === BLUE, `${tag} B: Blue saved with PUT /products/button-color (${JSON.stringify(put?.body)})`);
    expect(await panel.getByTestId('account-button-color-preview').evaluate((el) => getComputedStyle(el).backgroundColor) === rgb(BLUE), `${tag} B: the preview button is Blue`);
    await page.screenshot({ path: `${OUT}/${tag}-B3-panel-blue.png` });
    await page.keyboard.press('Escape');
    expect(await panel.waitFor({ state: 'hidden', timeout: 3000 }).then(() => true, () => false), `${tag} B: Escape closes the Button colour panel (after picking)`);
    await page.reload();
    await page.waitForTimeout(3000);
    const trig2 = visible(page.getByTestId('products-button-color')).first();
    expect(await trig2.locator('span').evaluate((el) => getComputedStyle(el).backgroundColor) === rgb(BLUE), `${tag} B: after a reload the dot is Blue`);
    await trig2.click();
    await page.getByTestId('products-button-color-panel').waitFor();
    expect(await page.getByTestId('account-button-color-use-brand').getAttribute('data-state') === 'unchecked', `${tag} B: … "Use brand colour" stays off`);
    expect(await page.getByTestId('products-button-color-panel').getByRole('radio', { name: 'Blue' }).getAttribute('aria-checked') === 'true', `${tag} B: … Blue is the picked colour`);
    await page.keyboard.press('Escape');
    expect(await page.getByTestId('products-button-color-panel').waitFor({ state: 'hidden', timeout: 3000 }).then(() => true, () => false), `${tag} B: Escape closes the panel after a reload`);

    // ── C. Full Arms: Blue → its own Red ────────────────────────────────────────────────────────────────────────
    await page.getByTestId('product-card').filter({ hasText: 'Full Arms' }).locator('button').first().click();
    await page.getByTestId('product-page').waitFor({ timeout: 10000 });
    await page.waitForTimeout(2500);
    const buy = () => visible(page.getByTestId('product-page').getByTestId('product-buy-button')).first();
    expect(await bg(buy()) === rgb(BLUE), `${tag} C: Full Arms' page buy button follows the account colour (Blue) (${await bg(buy())})`);
    await buy().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${tag}-C1-product-page-blue.png` });
    await visible(page.getByRole('button', { name: 'Edit', exact: true })).first().click();
    const editor = page.getByTestId('product-editor');
    await editor.waitFor({ timeout: 8000 });
    await page.waitForTimeout(800);
    const field = editor.getByTestId('p-button-color-field');
    await field.scrollIntoViewIfNeeded();
    expect(await field.isVisible(), `${tag} C: the editor's Visibility card has "Button colour"`);
    expect((await field.innerText()).includes('Use brand colour'), `${tag} C: … with "Use brand colour"`);
    expect(await field.getByTestId('p-button-color-preview').evaluate((el) => getComputedStyle(el).backgroundColor) === rgb(BLUE), `${tag} C: … previewing the account's Blue`);
    expect((await field.getByTestId('p-button-color-preview').innerText()).trim() === 'Add to Cart', `${tag} C: … in the product's own words`);
    await page.screenshot({ path: `${OUT}/${tag}-C2-editor-brand.png` });
    await field.getByTestId('p-button-color-use-brand').click();
    await page.waitForTimeout(300);
    await field.getByRole('radio', { name: 'Red' }).click();
    await page.waitForTimeout(300);
    await field.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${tag}-C3-editor-red.png` });
    await visible(editor.getByRole('button', { name: 'Save', exact: true })).first().click();
    await page.waitForTimeout(2500);
    const patch = w.calls.filter((c) => c.m === 'PATCH' && c.p === '/products/804').pop();
    expect(patch?.body?.button_color === RED, `${tag} C: Save sends button_color ${RED} (${JSON.stringify(patch?.body?.button_color)})`);
    expect(await bg(buy()) === rgb(RED), `${tag} C: its page's buy button is Red now (${await bg(buy())})`);
    await buy().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${tag}-C4-product-page-red.png` });
    await page.reload();
    await page.waitForTimeout(3500);
    if (!(await visible(page.getByTestId('product-page')).count())) {
      await page.goto(`${BASE}/products`);
      await page.waitForTimeout(2500);
      await page.getByTestId('product-card').filter({ hasText: 'Full Arms' }).locator('button').first().click();
      await page.getByTestId('product-page').waitFor({ timeout: 10000 });
      await page.waitForTimeout(2500);
    }
    expect(await bg(buy()) === rgb(RED), `${tag} C: after a reload it is still Red`);
    // Full Legs (no colour of its own) stays on the account's Blue.
    await page.goto(`${BASE}/products`);
    await page.waitForTimeout(2500);
    await page.getByTestId('product-card').filter({ hasText: 'Full Legs' }).locator('button').first().click();
    await page.getByTestId('product-page').waitFor({ timeout: 10000 });
    await page.waitForTimeout(2500);
    expect(await bg(buy()) === rgb(BLUE), `${tag} C: Full Legs' button is still the account's Blue`);

    // ── D. The owner's campaign page (and, 1280, the Storeel preview) ────────────────────────────────────────────
    await page.goto(`${BASE}/memories`);
    const card = page.getByText(/^November Specials/).filter({ visible: true }).first();
    await card.waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    await card.click();
    await page.waitForTimeout(2500);
    await checkCampaignButtons(page, `${tag} D owner page`, [RED, BLUE, BLUE], { enquire: true });
    await shootCard(page, `${OUT}/${tag}-D1-owner-campaign.png`);
    if (desktop) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click();
      const aside = page.locator('aside[aria-label="Storeel preview"]');
      await aside.waitFor({ timeout: 15000 });
      await page.waitForTimeout(2000);
      const prev = await buttonColours(aside);
      expect(prev.length >= 3, `${tag} D preview: the saved Storeel preview draws the 3 buttons (${prev.length})`);
      expect(prev.some(([t, c]) => t === 'Add to Cart' && c === rgb(RED)) && prev.some(([t, c]) => t === 'Add to Cart' && c === rgb(BLUE)) && prev.some(([t, c]) => t === 'View on website' && c === rgb(BLUE)),
        `${tag} D preview: Red / Blue / Blue as the campaign page ${JSON.stringify(prev)}`);
      await page.getByTestId('storeel-preview-screen').evaluate((el) => { const li = el.querySelector('[data-moment-key]'); if (li) el.scrollTop = li.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop + 120; });
      await page.waitForTimeout(500);
      await aside.screenshot({ path: `${OUT}/${tag}-D2-storeel-preview.png` });
    }
    await context.close();

    // ── E. The published page again ─────────────────────────────────────────────────────────────────────────────
    v = await open(w, { width, height, visitor: true, path: `/published-memory/${SLUG}` });
    await checkCampaignButtons(v.page, `${tag} E published (account Blue, Full Arms Red)`, [RED, BLUE, BLUE], { enquire: true });
    await shootCard(v.page, `${OUT}/${tag}-E1-published-red-blue.png`);
    await visible(v.page.locator('[data-product-card-button]').filter({ hasText: 'View on website' })).first().evaluate((n) => n.scrollIntoView({ block: 'center' }));
    await v.page.waitForTimeout(500);
    await v.page.screenshot({ path: `${OUT}/${tag}-E2-published-visit-blue.png` });
    await v.context.close();

    }
    // ── F. 1280: a product picked in Create shows its colour in the preview before saving ──────────────────────
    if (desktop) {
      const c = await open(w, { width, height, path: '/memories' });
      const cp = c.page;
      await cp.getByRole('button', { name: /^Create( a Campaign)?$/ }).filter({ visible: true }).last().click();
      const create = cp.getByRole('dialog', { name: 'Create Campaign' });
      await create.getByPlaceholder('Give your campaign a meaningful title').waitFor({ timeout: 10000 }).catch(async (e) => { await cp.screenshot({ path: `${OUT}/debug-F.png` }); throw e; });
      await cp.waitForTimeout(800);
      await create.getByPlaceholder('Give your campaign a meaningful title').fill('December');
      await create.locator('#st-step-campaign').getByRole('combobox').first().click();
      await cp.getByRole('option', { name: 'Campaigns' }).click();
      await cp.waitForTimeout(400);
      await create.getByTestId('storeel-moments-products').scrollIntoViewIfNeeded();
      await create.getByTestId('storeel-moments-products').click();
      await cp.getByRole('heading', { name: 'Add a Moment' }).waitFor({ timeout: 10000 });
      for (const name of ['Full Legs', 'Full Arms']) {
        const box = cp.getByRole('checkbox', { name: new RegExp(name) });
        await box.waitFor({ timeout: 10000 });
        await box.click();
      }
      await cp.getByRole('button', { name: 'Add all (2)' }).click();
      await cp.waitForTimeout(2500);
      const aside = cp.locator('aside[aria-label="Storeel preview"]');
      const got = await buttonColours(aside);
      expect(got.some(([t, col]) => t === 'Add to Cart' && col === rgb(BLUE)) && got.some(([t, col]) => t === 'Add to Cart' && col === rgb(RED)),
        `${tag} F: picked products' preview buttons: Full Legs Blue, Full Arms Red ${JSON.stringify(got)}`);
      const enq = await enquireColours(aside);
      expect(enq.includes(rgb(BLUE)) && enq.includes(rgb(RED)), `${tag} F: … their Enquire too ${JSON.stringify(enq)}`);
      await cp.getByTestId('storeel-preview-screen').evaluate((el) => { const li = el.querySelector('[data-moment-key]'); if (li) el.scrollTop = li.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop + 120; });
      await cp.waitForTimeout(500);
      await aside.screenshot({ path: `${OUT}/${tag}-F1-create-preview.png` });
      await c.context.close();
    }

    // Back to the brand: "Use brand colour" on → the brand green again (API state).
    w.account.setting = null;
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall R2-2 button colour checks passed');
process.exit(failures.length || relevant.length ? 1 : 0);
