// tests/products/ui/c22-buttons.mjs — Chris 22 Nov 2026, points Q1, Q2, Q3, Q5 (TheBodyPolitik, MANUAL products). In the
// real app at 1280 and 390, every API call answered here (a small stateful web API: products, their Button text, the
// campaign's in-card buttons — whose words follow the product the way the web API's CatalogSnapshotWriter::syncButtons
// now makes them), every non-local request aborted.
//  Q5. Products page: no "Button colour" button in the header (Import + Add a product still there).
//  Q1. Full Arms → Edit: the Links card is the first card of the right column, above Visibility (on a phone: Links
//      before Visibility too).
//  Q3b. Visibility → Button colour preview = the campaign card's button: full width of its card, the external-link icon
//      on the left of the words, same height / corners / font as the real buttons, in the product's words as typed.
//  Q3a. Button text "Add to Cart" → "Buy Now" → Save (PATCH buy_label) → product page button "Buy Now" → reload → still
//      → the owner's campaign page and the published Storeel say "Buy Now" (1280: the Storeel preview too).
//  Q2. No purple ring round the in-card button: owner page (also after picking its timeline entry, which used to draw
//      it), Storeel preview, published page.
// node tests/products/ui/c22-buttons.mjs  (C22_BASE = dev server, default http://127.0.0.1:5322; C22_SHOTS)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.C22_BASE || 'http://127.0.0.1:5322';
const OUT = process.env.C22_SHOTS || '/Users/deepaksharma/Pictures/Personal-Works/Stasht-Project/handoff-20261114/c22-buttons-shots';
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
    widget_data: { title: p.price_label, buttonText: p.origin === 'manual' ? (p.d.buy_label || 'Buy now') : 'View on website', buttonLink: p.origin === 'manual' ? p.d.buy_url : p.url, icon: 'ExternalLink', placement: 'in_card' },
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
    if (sessionStorage.getItem('c22-seeded')) return;
    sessionStorage.setItem('c22-seeded', '1');
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
      return route.fulfill({ json: { success: true, data: accountInfo(w) } }); // the web API saves nothing now (Q5)
    }
    if (p === '/products' && m === 'GET') return route.fulfill({ json: { success: true, data: { items: w.products.map((x) => summaryOf(w, x)), pagination: { current_page: 1, per_page: 48, total: 3, last_page: 1 } } } });
    const one = /^\/products\/(\d+)$/.exec(p);
    if (one) {
      const found = w.products.find((x) => x.id === Number(one[1]));
      if (!found) return route.fulfill({ status: 404, json: { success: false, message: 'Product not found.' } });
      if (m === 'PATCH' && body && 'button_color' in body) found.button_color = body.button_color ? String(body.button_color).toUpperCase() : null;
      if (m === 'PATCH' && body && 'buy_label' in body) found.d.buy_label = body.buy_label ? String(body.buy_label) : null;
      if (m === 'PATCH' && body && 'buy_url' in body) found.d.buy_url = body.buy_url || null;
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
/** Each visible in-card button: [words, background, has an icon left of the words, box-shadow of its wrapper, outline]. */
async function cardButtons(scope) {
  return scope.locator('[data-product-card-button]').evaluateAll((els) => els.filter((e) => e.getClientRects().length).map((e) => {
    const a = e.querySelector('a');
    const svg = a?.querySelector('svg');
    const span = a?.querySelector('span');
    const iconLeft = !!(svg && span && svg.getBoundingClientRect().right <= span.getBoundingClientRect().left + 1);
    return { text: (a?.textContent || '').trim(), bg: a ? getComputedStyle(a).backgroundColor : '', iconLeft, ring: getComputedStyle(e).boxShadow, outline: a ? getComputedStyle(a).outlineStyle : '', active: e.getAttribute('data-active') };
  }));
}
/** The look of a button's <a>: height, corners, font size / weight, padding. */
const lookOf = (loc) => loc.evaluate((el) => { const a = el.querySelector('a') || el; const s = getComputedStyle(a); const r = a.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), radius: s.borderTopLeftRadius, font: s.fontSize, weight: s.fontWeight, pad: `${s.paddingTop} ${s.paddingLeft}`, family: s.fontFamily }; });
const noRing = (b) => !b.ring || b.ring === 'none';

async function campaignChecks(page, tag, words, { owner }) {
  await page.getByText('Full Arms').filter({ visible: true }).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  let got = await cardButtons(page.locator('body'));
  const arms = got.filter((b) => b.text === words);
  expect(arms.length > 0, `${tag}: the product button says "${words}" ${JSON.stringify(got.map((b) => b.text))}`);
  // Full Legs was not edited: it keeps its own "Add to Cart" (only the edited product's buttons change).
  expect(got.filter((b) => b.text === 'Add to Cart').length >= 1 && arms.length >= 1, `${tag}: Full Legs keeps "Add to Cart", Full Arms says "${words}"`);
  expect(got.every(noRing), `${tag}: no ring round any product button ${JSON.stringify(got.map((b) => b.ring))}`);
  expect(got.every((b) => b.iconLeft), `${tag}: the icon sits left of the words`);
  if (owner && page.viewportSize().width >= 1024) {
    // The desktop timeline entry of Full Arms' button: picking it used to draw the purple ring round the button.
    const entry = visible(page.getByText('$65 CAD', { exact: true })).first();
    expect(await entry.count() > 0, `${tag}: the timeline entry "$65 CAD" is there`);
    if (await entry.count()) {
      await entry.click();
      await page.waitForTimeout(1200);
      got = await cardButtons(page.locator('body'));
      expect(got.some((b) => b.active === 'true'), `${tag}: picking its timeline entry marks the button active`);
      expect(got.every(noRing), `${tag}: … and still no ring round it ${JSON.stringify(got.map((b) => b.ring))}`);
    }
  }
}

async function shootCard(page, path, words) {
  const el = visible(page.locator('[data-product-card-button]').filter({ hasText: words })).first();
  if (await el.count()) await el.evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(600);
  await page.screenshot({ path });
}

const looks = {};
try {
  for (const [width, height] of (process.env.C22_SIZES ? JSON.parse(process.env.C22_SIZES) : [[1280, 900], [390, 844]])) {
    const tag = `${width}`;
    const desktop = width >= 1024;
    const w = world();

    // ── Q5. Products page header ────────────────────────────────────────────────────────────────────────────────
    const { page, context } = await open(w, { width, height });
    await page.getByTestId('products-page').waitFor({ timeout: 15000 });
    await page.getByTestId('products-import').filter({ visible: true }).first().waitFor({ timeout: 10000 });
    expect(await visible(page.getByTestId('products-button-color')).count() === 0, `${tag} Q5: no "Button colour" button on the Products page`);
    expect(await visible(page.getByRole('button', { name: 'Button colour' })).count() === 0, `${tag} Q5: … by name either`);
    expect(await visible(page.getByRole('button', { name: /Add a product/ })).count() > 0, `${tag} Q5: Import + Add a product still there`);
    await page.screenshot({ path: `${OUT}/${tag}-Q5-products-header.png` });

    // ── Full Arms → its page (product's buy button = the real button) → Edit ────────────────────────────────────
    await page.getByTestId('product-card').filter({ hasText: 'Full Arms' }).locator('button').first().click();
    await page.getByTestId('product-page').waitFor({ timeout: 10000 });
    await page.waitForTimeout(2500);
    const buy = () => visible(page.getByTestId('product-page').getByTestId('product-buy-button')).first();
    expect((await buy().innerText()).trim() === 'Add to Cart', `${tag}: Full Arms' page button says "Add to Cart" before`);
    looks[`${tag} product page`] = await lookOf(buy());
    await visible(page.getByRole('button', { name: 'Edit', exact: true })).first().click();
    const editor = page.getByTestId('product-editor');
    await editor.waitFor({ timeout: 8000 });
    await page.waitForTimeout(800);

    // ── Q1. Links first, above Visibility ───────────────────────────────────────────────────────────────────────
    const heads = await editor.locator('section > h2').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY) }; }));
    const links = heads.find((h) => h.t === 'Links');
    const vis = heads.find((h) => h.t === 'Visibility');
    expect(!!links && !!vis && links.y < vis.y, `${tag} Q1: Links is above Visibility ${JSON.stringify([links, vis])}`);
    if (desktop) {
      const right = heads.filter((h) => h.x === vis.x).sort((a, b) => a.y - b.y);
      expect(right[0]?.t === 'Links', `${tag} Q1: Links is the first card of the right column ${JSON.stringify(right.map((h) => h.t))}`);
    } else {
      const order = [...heads].sort((a, b) => a.y - b.y).map((h) => h.t);
      expect(order.indexOf('Links') === order.indexOf('Visibility') - 1, `${tag} Q1: phone order … Links, Visibility … ${JSON.stringify(order)}`);
    }
    await editor.locator('section', { has: page.locator('h2', { hasText: /^Links$/ }) }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${tag}-Q1-editor-links-first.png` });

    // ── Q3b. The Button colour preview = the real button ────────────────────────────────────────────────────────
    const field = editor.getByTestId('p-button-color-field');
    const preview = field.getByTestId('p-button-color-preview');
    await field.scrollIntoViewIfNeeded();
    const pv = (await cardButtons(field))[0];
    expect(pv?.text === 'Add to Cart', `${tag} Q3b: the preview says the product's words "Add to Cart" (${pv?.text})`);
    expect(pv?.iconLeft === true, `${tag} Q3b: the preview has the external-link icon on the left`);
    expect(pv?.bg === rgb(GREEN), `${tag} Q3b: the preview is the brand colour (${pv?.bg})`);
    const card = await field.evaluate((el) => Math.round(el.getBoundingClientRect().width));
    const pl = await lookOf(preview);
    looks[`${tag} preview`] = pl;
    expect(Math.abs(pl.w - card) <= 1, `${tag} Q3b: the preview is the full width of the card (${pl.w} of ${card})`);
    const real = looks[`${tag} product page`];
    expect(pl.h === real.h && pl.radius === real.radius && pl.font === real.font && pl.weight === real.weight && pl.pad === real.pad,
      `${tag} Q3b: same height / corners / font / padding as the real button ${JSON.stringify([pl, real])}`);
    // Live as typed.
    const label = editor.getByTestId('product-buy-label');
    await label.fill('Buy Now');
    await page.waitForTimeout(200);
    expect((await preview.innerText()).trim() === 'Buy Now', `${tag} Q3b: the preview follows the Button text as typed`);
    await field.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${tag}-Q3b-preview-buy-now.png` });
    // Its own colour: the preview follows it.
    await field.getByTestId('p-button-color-use-brand').click();
    await page.waitForTimeout(300);
    await field.getByRole('radio', { name: 'Red' }).click();
    await page.waitForTimeout(300);
    expect((await cardButtons(field))[0]?.bg === rgb(RED), `${tag} Q3b: the preview takes a picked colour (Red)`);
    await field.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${OUT}/${tag}-Q3b-preview-red.png` });
    await field.getByTestId('p-button-color-use-brand').click(); // back to the brand colour
    await page.waitForTimeout(300);

    // ── Q3a. Save → product page → reload ───────────────────────────────────────────────────────────────────────
    await visible(editor.getByRole('button', { name: 'Save', exact: true })).first().click();
    await page.waitForTimeout(2500);
    const patch = w.calls.filter((c) => c.m === 'PATCH' && c.p === '/products/804').pop();
    expect(patch?.body?.buy_label === 'Buy Now', `${tag} Q3a: Save sends buy_label "Buy Now" (${JSON.stringify(patch?.body?.buy_label)})`);
    expect((await buy().innerText()).trim() === 'Buy Now', `${tag} Q3a: its page's button says "Buy Now"`);
    expect(w.calls.every((c) => !(c.m === 'PUT' && c.p === '/products/button-color')), `${tag} Q5: nothing calls PUT /products/button-color`);
    await buy().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${tag}-Q3a-product-page-buy-now.png` });
    await page.reload();
    await page.waitForTimeout(3500);
    if (!(await visible(page.getByTestId('product-page')).count())) {
      await page.goto(`${BASE}/products`);
      await page.waitForTimeout(2500);
      await page.getByTestId('product-card').filter({ hasText: 'Full Arms' }).locator('button').first().click();
      await page.getByTestId('product-page').waitFor({ timeout: 10000 });
      await page.waitForTimeout(2500);
    }
    expect((await buy().innerText()).trim() === 'Buy Now', `${tag} Q3a: after a reload still "Buy Now"`);

    // ── Owner campaign page (+ 1280 Storeel preview) ────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/memories`);
    const tile = page.getByText(/^November Specials/).filter({ visible: true }).first();
    await tile.waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    await tile.click();
    await page.waitForTimeout(2500);
    await campaignChecks(page, `${tag} owner page`, 'Buy Now', { owner: true });
    const cardBtn = visible(page.locator('[data-product-card-button]').filter({ hasText: 'Buy Now' })).first();
    looks[`${tag} campaign card`] = await lookOf(cardBtn);
    const cc = looks[`${tag} campaign card`];
    expect(pl.h === cc.h && pl.radius === cc.radius && pl.font === cc.font && pl.weight === cc.weight, `${tag} Q3b: the preview matches the campaign card's button ${JSON.stringify([pl, cc])}`);
    await shootCard(page, `${OUT}/${tag}-Q2-owner-campaign-no-ring.png`, 'Buy Now');
    if (desktop) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click();
      const aside = page.locator('aside[aria-label="Storeel preview"]');
      await aside.waitFor({ timeout: 15000 });
      await page.waitForTimeout(2000);
      const prev = await cardButtons(aside);
      expect(prev.some((b) => b.text === 'Buy Now'), `${tag} Storeel preview: "Buy Now" ${JSON.stringify(prev.map((b) => b.text))}`);
      expect(prev.every(noRing), `${tag} Storeel preview: no ring`);
      await page.getByTestId('storeel-preview-screen').evaluate((el) => { const li = el.querySelector('[data-moment-key]'); if (li) el.scrollTop = li.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop + 120; });
      await page.waitForTimeout(500);
      await aside.screenshot({ path: `${OUT}/${tag}-Q2-storeel-preview.png` });
    }
    await context.close();

    // ── Published Storeel (visitor) ─────────────────────────────────────────────────────────────────────────────
    const v = await open(w, { width, height, visitor: true, path: `/published-memory/${SLUG}` });
    await campaignChecks(v.page, `${tag} published`, 'Buy Now', { owner: false });
    await shootCard(v.page, `${OUT}/${tag}-Q2-published-no-ring.png`, 'Buy Now');
    await v.context.close();
  }
} finally {
  await browser.close();
}

console.log('looks:', JSON.stringify(looks));
const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall c22 buttons checks passed');
process.exit(failures.length || relevant.length ? 1 : 0);
