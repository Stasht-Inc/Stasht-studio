// tests/campaigns/ui/c21-storeel-products.mjs — Chris 21 Nov 2026, Storeel product moments (P3, P7, P9), in the real
// app at 1280 and 390 (every API call answered here, every non-local request aborted: nothing leaves this machine).
// TheBodyPolitik (manual products, Chris's demo client):
//  Create: Campaigns → Create → title + category → step 2 → + Products → tick Brazilian (V) (no photo), Full Arms
//  (photo), Full Front Torso (no photo) → Add all (3) → step 2 has 3 rows, the photo-less ones show the brand, not a
//  grey square (P7) → the preview's cards (1280; phones have no preview): the brand where there is no photo, the price
//  as the product page's yellow badge (no "Price: …" line), the description, "Add to Cart" and Enquire (P3) →
//  Save as Draft → POST /memories carries all 3 ids, in the order ticked (P9) → the saved campaign's preview: 3 cards,
//  badges, brand → reopen the draft from its page (Edit): step 2 still has 3 moments.
//  Published (a visitor opens the Storeel link): the same card — brand, badge, description without the price line,
//  "Add to Cart", Enquire.
// node tests/campaigns/ui/c21-storeel-products.mjs  (C21S_BASE = dev server, default http://127.0.0.1:5252; C21S_SHOTS)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.C21S_BASE || 'http://127.0.0.1:5252';
const OUT = process.env.C21S_SHOTS || '/Users/deepaksharma/Pictures/Personal-Works/Stasht-Project/handoff-20261114/c21-S-shots';
mkdirSync(OUT, { recursive: true });

const LOGO = `${BASE}/cd-img/logo.png`;
const MAIN = { id: 70, external_user_id: 707, name: 'TheBodyPolitik', email: 'owner@bodypolitik.test', role: '2', status: 1, is_activated: true, profile_color: '#4A6B50', avatar: LOGO, profile_image: LOGO };
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#4A6B50"/><text x="40" y="150" font-size="70" fill="#F3EDE4" font-family="Georgia">THE</text><text x="40" y="230" font-size="70" fill="#F3EDE4" font-family="Georgia">BODY</text><text x="40" y="310" font-size="70" fill="#F3EDE4" font-family="Georgia">POLITIK</text></svg>`;
const photoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#E8A27C"/><rect x="80" y="220" width="440" height="80" fill="#fff"/></svg>`;
const img = (n) => `${BASE}/cd-img/${n}.jpg`;
// As production judges TheBodyPolitik's logo (BrandPictures): a logo on its own green.
const BRAND_PICTURES = { [`${BASE}/cd-img/logo.png`]: { kind: 'logo', color: '#4A6B50', gradient: null } };

const DESC = {
  81: 'All our waxing services are performed with Hard Wax. All Services are gender neutral',
  82: 'Includes hands and fingers.',
  83: '',
};
const PRODUCTS = [
  { id: 81, title: 'Brazilian (V)', price_label: '$80 CAD', category: 'Intimate', main_image: null, images_count: 0 },
  { id: 82, title: 'Full Arms', price_label: '$65 CAD', category: 'Body', main_image: img(2), images_count: 1 },
  { id: 83, title: 'Full Front Torso', price_label: '$75 CAD', category: 'Body', main_image: null, images_count: 0 },
  { id: 84, title: 'Full Back', price_label: '$75 CAD', category: 'Body', main_image: null, images_count: 0 },
];
const base = { read_only: false, origin: 'manual', status: 'active', stock_status: 'in_stock', badge: 'active', compare_at_label: '', price_on_request: false, show_price: true, categories: [], sku: null, brand: null, updated_at: null, user_id: 707, url: null };
const detail = (p) => ({
  ...base, ...p, short_description: null, description: DESC[p.id] || null, description_html: null, buy_url: 'https://thebodypolitik.example/book', buy_label: 'Add to Cart', buy_button: 'Add to Cart',
  show_enquire: true, media: p.main_image ? [{ id: p.id * 10, url: p.main_image, type: 'photo', sort_order: 0 }] : [], editable_fields: [], tags: [], options: [], variants: [], attributes: [],
});

// What the web API makes of them (CatalogSnapshotWriter): one moment each, in order; no photo → no image_link.
const NEW_ID = 960;
const momentText = (p) => [DESC[p.id] || p.title, `Price: ${p.price_label}`].join('\n');
const savedPost = (p, i) => ({
  id: 3000 + i, name: null, title: p.title, description: momentText(p), type_id: `catalog_${p.id}_0_1763730000`,
  master_image_link: p.main_image, image_link: p.main_image, media_url: p.main_image, location: 'Barrie, Canada',
  capture_date: '2026-11-21 10:00:00', uploaded_at: '2026-11-21 10:00:00', parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [], user: { id: 707, name: 'TheBodyPolitik', profile_image: LOGO, profile_color: '#4A6B50' },
});
const picked = [PRODUCTS[0], PRODUCTS[1], PRODUCTS[2]];
const POSTS = picked.map(savedPost);
const WIDGETS = POSTS.map((p, i) => ({
  id: 700 + i, memory_id: NEW_ID, widget_type: 'cta', after_post_id: p.id, widget_order: 0, is_visible: true, admin_approval: 1, in_card: true,
  widget_data: { title: picked[i].price_label, buttonText: 'Add to Cart', buttonLink: 'https://thebodypolitik.example/book', icon: 'ExternalLink', placement: 'in_card' },
  created_at: '2026-11-21T10:00:00Z', updated_at: '2026-11-21T10:00:00Z',
}));
const ENQUIRE = POSTS.map((p, i) => ({ post_id: p.id, title: picked[i].title }));
const NEW_CAMPAIGN = {
  id: NEW_ID, title: 'November Specials', user_id: 707, published: 0, slug: 'november-specials', category: { id: 5, name: 'Campaigns' }, sub_category: null,
  photos: { count: 3 }, posts_count: 3, collaborators: [], user: { id: 707, name: 'TheBodyPolitik', profile_image: LOGO, profile_color: '#4A6B50' },
  created_at: '2026-11-21 10:00:00', location: 'Barrie, Canada', tags: [], min_uploaded_img_date: '2026-11-21', max_uploaded_img_date: '2026-11-21', last_update_img: null,
};
const NEW_DETAIL = { ...NEW_CAMPAIGN, posts: POSTS, linked_memories: [], unified_order: POSTS.map((p) => ({ id: p.id, type: 'post' })) };

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height, visitor = false, path = '/memories' }) {
  const state = { creates: [], created: false, detailGets: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user, isVisitor]) => {
    if (sessionStorage.getItem('cd-seeded')) return;
    sessionStorage.setItem('cd-seeded', '1');
    localStorage.clear();
    if (isVisitor) return;
    localStorage.setItem('stasht_token', 'main-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels');
  }, [MAIN, visitor]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      return route.abort('blockedbyclient');
    }
    if (url.pathname === '/cd-img/logo.png') return route.fulfill({ contentType: 'image/svg+xml', body: logoSvg });
    if (url.pathname.startsWith('/cd-img/')) return route.fulfill({ contentType: 'image/svg+xml', body: photoSvg });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const m = req.method();
    let body = null;
    try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch { body = null; }
    if (p === '/memories' && m === 'GET') {
      const all = state.created ? [NEW_CAMPAIGN] : [];
      return route.fulfill({ json: { status: 'success', brand_pictures: BRAND_PICTURES, data: { all_memories: { data: all, total: all.length, pagination: { current_page: 1, last_page: 1 } }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Campaigns', memory_count: all.length }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories' && m === 'POST') {
      state.creates.push(body);
      state.created = true;
      return route.fulfill({ json: { success: true, data: { id: NEW_ID, title: body?.title, slug: 'november-specials', category_id: body?.category_id, catalog: { moments: (body?.catalog_item_ids || []).length, skipped_item_ids: [] } } } });
    }
    if (p === `/memories/${NEW_ID}` && m === 'GET') { state.detailGets.push(p); return route.fulfill({ json: { status: 'success', data: { memory: NEW_DETAIL, linked_memories: [], unified_order: NEW_DETAIL.unified_order, enquire_products: ENQUIRE } } }); }
    if (p === `/memories/${NEW_ID}` && m === 'PUT') return route.fulfill({ json: { success: true, message: 'Memory updated successfully.', data: NEW_CAMPAIGN } });
    if (p === `/memories/${NEW_ID}/widgets` && m === 'GET') return route.fulfill({ json: { success: true, data: WIDGETS } });
    if (p === `/memories/${NEW_ID}/moment-order` || p === `/memories/${NEW_ID}/order`) return route.fulfill({ json: { success: true } });
    if (p === '/published-memories') return route.fulfill({ json: { success: true, brand_pictures: BRAND_PICTURES, data: { memory: { ...NEW_DETAIL, published: 1, widgets: WIDGETS, enquire_products: ENQUIRE }, widgets: WIDGETS, enquire_products: ENQUIRE, order_by: 'asc' } } });
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 5, name: 'Campaigns', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/products/status') return route.fulfill({ json: { success: true, data: { pilot: true, available: true, reason: null, can_create: true, counts: { total: PRODUCTS.length, manual: PRODUCTS.length, website: 0 }, default_currency: 'CAD' } } });
    if (p === '/products' && m === 'GET') {
      const items = PRODUCTS.map((x) => ({ ...base, ...x }));
      return route.fulfill({ json: { success: true, data: { items, pagination: { current_page: 1, per_page: 200, total: items.length, last_page: 1 } } } });
    }
    const pd = /^\/products\/(\d+)$/.exec(p);
    if (pd && m === 'GET') {
      const x = PRODUCTS.find((y) => y.id === Number(pd[1]));
      return x ? route.fulfill({ json: { success: true, data: detail(x) } }) : route.fulfill({ status: 404, json: { success: false } });
    }
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: false, reason: 'not_available', item_count: 0 } } });
    if (p === '/website-catalogue/items') return route.fulfill({ json: { success: true, data: { items: [], pagination: { last_page: 1 } } } });
    if (p === '/cars' && m === 'GET') return route.fulfill({ json: { success: true, data: { cars: [], pagination: { last_page: 1 }, filters: {} } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 1, memory_limit: 50 } } } });
    if (p === '/lead-groups') return route.fulfill({ json: { groups: [] } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('popup', (pp) => pp.close().catch(() => {}));
  await page.goto(`${BASE}${path}`);
  return { context, page, state };
}

const addAll = (page, n) => page.getByRole('button', { name: `Add all (${n})` });

/** The preview's product cards (1280): brand where there is no photo, badge, description, Add to Cart, Enquire. */
async function checkPreviewCards(page, tag, { saved }) {
  const preview = page.getByTestId('storeel-preview-moments');
  await preview.waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  const cards = preview.locator(':scope > li[data-moment-key]');
  expect(await cards.count() === 3, `${tag}: the preview shows 3 moment cards (got ${await cards.count()})`);
  const first = cards.nth(0);
  expect(await first.getByTestId('storeel-preview-moment-brand').count() === 1, `${tag}: Brazilian (V) (no photo) shows the brand, not a grey box (P7)`);
  expect(await first.locator('[data-testid="storeel-preview-moment-brand"] img').count() > 0 || await first.getByTestId('storeel-preview-moment-brand').innerText() !== '', `${tag}: … the brand logo / initials is drawn`);
  expect((await first.getByTestId('product-price-badge').innerText()).trim() === '$80 CAD', `${tag}: Brazilian (V)'s price is a badge "$80 CAD" (P3c)`);
  const badgeBg = await first.getByTestId('product-price-badge').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(badgeBg === 'rgb(254, 197, 61)', `${tag}: … the product page's yellow (${badgeBg})`);
  const text = await preview.innerText();
  expect(!/Price:/.test(text), `${tag}: no "Price: …" text line on any card`);
  expect((await first.getByTestId('storeel-preview-caption').innerText()).includes('performed with Hard Wax'), `${tag}: the description is in the caption slot (P3b)`);
  expect(await cards.nth(1).locator('img[src*="/cd-img/2.jpg"]').count() === 1, `${tag}: Full Arms shows its photo`);
  expect((await cards.nth(1).getByTestId('product-price-badge').innerText()).trim() === '$65 CAD', `${tag}: Full Arms: badge "$65 CAD"`);
  expect(await cards.nth(2).getByTestId('storeel-preview-moment-brand').count() === 1, `${tag}: Full Front Torso (no photo) shows the brand`);
  const buttons = await preview.locator('[data-product-card-button]').allInnerTexts();
  expect(buttons.length === 3 && buttons.every((b) => b.trim() === 'Add to Cart'), `${tag}: each card has the product's "Add to Cart" button (P3a) ${JSON.stringify(buttons)}`);
  if (!saved) expect(await preview.getByTestId('product-enquire-button').count() === 3, `${tag}: each card has Enquire, as the published page`);
}

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const desktop = width >= 1024;
    const { page, context, state } = await open({ width, height });

    // ── Create: + Products → three products, two without a photo ────────────────────────────────────────────────
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /^Create( a Campaign)?$/ }).filter({ visible: true }).last().click();
    const create = page.getByRole('dialog', { name: 'Create Campaign' });
    await create.getByPlaceholder('Give your campaign a meaningful title').waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    await create.getByPlaceholder('Give your campaign a meaningful title').fill('November Specials');
    await create.locator('#st-step-campaign').getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Campaigns' }).click();
    await page.waitForTimeout(400);
    await create.getByTestId('storeel-moments-products').scrollIntoViewIfNeeded();
    await create.getByTestId('storeel-moments-products').click();
    await page.getByRole('heading', { name: 'Add a Moment' }).waitFor({ timeout: 10000 });
    for (const name of ['Brazilian (V)', 'Full Arms', 'Full Front Torso']) {
      const box = page.getByRole('checkbox', { name: new RegExp(name.replace(/[()]/g, '\\$&')) });
      await box.waitFor({ timeout: 10000 });
      await box.click();
    }
    await page.screenshot({ path: `${OUT}/${tag}-P9-01-picker-3-ticked.png` });
    await addAll(page, 3).click();
    await page.waitForTimeout(1500);

    const rows = create.locator('[data-moment-row="product"]');
    expect(await rows.count() === 3, `${tag}: step 2 lists 3 product moments (got ${await rows.count()})`);
    const order = await rows.evaluateAll((els) => els.map((e) => e.querySelector('p')?.textContent?.trim()));
    expect(JSON.stringify(order) === JSON.stringify(['Brazilian (V)', 'Full Arms', 'Full Front Torso']), `${tag}: … in the order ticked ${JSON.stringify(order)}`);
    expect(await rows.nth(0).getByTestId('storeel-moment-brand').count() === 1 && await rows.nth(2).getByTestId('storeel-moment-brand').count() === 1,
      `${tag}: the photo-less rows show the brand thumbnail, not a grey square (P7)`);
    expect(await rows.nth(1).locator('img[src*="/cd-img/2.jpg"]').count() === 1, `${tag}: Full Arms' row shows its photo`);
    expect((await rows.nth(0).innerText()).includes('performed with Hard Wax'), `${tag}: the row shows the product's description`);
    expect((await rows.nth(0).innerText()).includes('Its caption comes from the product.'), `${tag}: a manual product's note says the caption comes from the product`);
    await create.locator('#st-step-moments').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${tag}-P7-02-step2-rows-brand.png` });

    if (desktop) {
      await checkPreviewCards(page, `${tag} preview`, { saved: false });
      const aside = page.locator('aside[aria-label="Storeel preview"]');
      await page.getByTestId('storeel-preview-screen').evaluate((el) => { const li = el.querySelector('[data-moment-key]'); if (li) el.scrollTop = li.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 10; });
      await page.waitForTimeout(400);
      await aside.screenshot({ path: `${OUT}/${tag}-P3-03-preview-card-1.png` });
      await page.getByTestId('storeel-preview-screen').evaluate((el) => { const li = el.querySelectorAll('[data-moment-key]')[1]; if (li) el.scrollTop = li.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 10; });
      await page.waitForTimeout(400);
      await aside.screenshot({ path: `${OUT}/${tag}-P3-04-preview-card-2.png` });
    }

    // ── Save as Draft: every product goes, in order ──────────────────────────────────────────────────────────────
    await create.getByRole('button', { name: 'Save as Draft', exact: true }).filter({ visible: true }).last().click();
    await page.waitForTimeout(2500);
    const sent = state.creates[0] || {};
    expect(JSON.stringify(sent.catalog_item_ids) === '[81,82,83]', `${tag}: Save as Draft sends all 3 products in order (catalog_item_ids ${JSON.stringify(sent.catalog_item_ids)}) (P9)`);
    await page.screenshot({ path: `${OUT}/${tag}-P9-05-after-save.png` });
    if (desktop && await page.getByTestId('storeel-preview-moments').count()) {
      await checkPreviewCards(page, `${tag} saved preview`, { saved: true });
      await page.locator('aside[aria-label="Storeel preview"]').screenshot({ path: `${OUT}/${tag}-P3-06-saved-preview.png` });
    }
    const savedRows = page.locator('[data-moment-row]');
    if (await savedRows.count()) expect(await savedRows.count() === 3, `${tag}: after saving, step 2 still lists 3 moments (got ${await savedRows.count()})`);

    // ── Reopen the draft from its page: Edit → 3 moments ─────────────────────────────────────────────────────────
    await page.goto(`${BASE}/memories`);
    const card = page.getByText(/^November Specials/).filter({ visible: true }).first();
    await card.waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    await card.click();
    await page.waitForTimeout(2500);

    // ── The owner's campaign page: the same product cards as the published page ─────────────────────────────────
    await page.getByText('Brazilian (V)').filter({ visible: true }).first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1200);
    const ownerBrand = page.getByTestId('post-card-brand').filter({ visible: true });
    expect(await ownerBrand.count() >= 2, `${tag} owner page: photo-less product moments show the brand (${await ownerBrand.count()})`);
    const ownerBadges = (await page.getByTestId('product-price-badge').filter({ visible: true }).allInnerTexts()).map((x) => x.trim());
    expect(['$80 CAD', '$65 CAD', '$75 CAD'].every((b) => ownerBadges.includes(b)), `${tag} owner page: prices are yellow badges ${JSON.stringify(ownerBadges)}`);
    const ownerPriceLines = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => el.children.length === 0 && /Price: \$/.test(el.textContent || '') && el.getClientRects().length).map((el) => `${el.tagName}.${el.className}|${(el.textContent || '').slice(0, 40)}`.slice(0, 200)));
    expect(!ownerPriceLines.length, `${tag} owner page: no visible "Price: $…" line ${JSON.stringify(ownerPriceLines)}`);
    expect((await page.getByTestId('post-card-product-caption').filter({ visible: true }).allInnerTexts()).some((t) => t.includes('Includes hands and fingers.')), `${tag} owner page: the description is the caption`);
    const ownerButtons = await page.locator('[data-product-card-button]').filter({ visible: true }).allInnerTexts();
    expect(ownerButtons.filter((b) => b.trim().startsWith('Add to Cart')).length >= 3, `${tag} owner page: "Add to Cart" in each card ${JSON.stringify(ownerButtons)}`);
    expect(await page.getByTestId('product-enquire-button').filter({ visible: true }).count() >= 3, `${tag} owner page: Enquire in each card`);
    await ownerBrand.first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${tag}-OWN-01-owner-card-brand.png` });
    await page.getByTestId('post-card-product-caption').filter({ hasText: 'Includes hands' }).filter({ visible: true }).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${tag}-OWN-02-owner-card-photo.png` });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    if (desktop) await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click();
    else await page.getByRole('button', { name: 'Edit Campaign' }).filter({ visible: true }).first().click();
    const edit = page.getByRole('dialog', { name: 'Edit Campaign' });
    await edit.locator('#st-step-moments').waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const editRows = edit.locator('[data-moment-row]');
    expect(await editRows.count() === 3, `${tag}: the reopened draft has 3 moments (got ${await editRows.count()})`);
    expect(await editRows.nth(0).getByTestId('storeel-moment-brand').count() === 1, `${tag}: … Brazilian (V) still shows the brand`);
    expect(!/Price:/.test(await edit.locator('#st-step-moments').innerText()), `${tag}: … its rows show the price, not a "Price:" line`);
    await edit.locator('#st-step-moments').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${tag}-P9-07-reopened-draft.png` });
    if (desktop) {
      await checkPreviewCards(page, `${tag} edit preview`, { saved: true });
      await page.locator('aside[aria-label="Storeel preview"]').screenshot({ path: `${OUT}/${tag}-P3-08-edit-preview.png` });
    }
    await context.close();

    // ── Published: what the recipient opens ─────────────────────────────────────────────────────────────────────
    const pub = await open({ width, height, visitor: true, path: '/published-memory/november-specials' });
    const pp = pub.page;
    await pp.getByText('Brazilian (V)').filter({ visible: true }).first().waitFor({ timeout: 30000 });
    await pp.waitForTimeout(1500);
    const brand = pp.getByTestId('published-moment-brand').filter({ visible: true });
    expect(await brand.count() >= 2, `${tag} published: the photo-less moments show the brand (P7) (${await brand.count()})`);
    const badges = await pp.getByTestId('product-price-badge').filter({ visible: true }).allInnerTexts();
    expect(['$80 CAD', '$65 CAD', '$75 CAD'].every((b) => badges.map((x) => x.trim()).includes(b)), `${tag} published: prices are badges ${JSON.stringify(badges)} (P3c)`);
    const bodyText = await pp.locator('body').innerText();
    const priceLines = await pp.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => el.children.length === 0 && /Price: \$/.test(el.textContent || '') && el.getClientRects().length).map((el) => `${el.tagName}.${el.className}`.slice(0, 120)));
    expect(!priceLines.length, `${tag} published: no visible "Price: $…" text line ${JSON.stringify(priceLines)}`);
    expect(bodyText.includes('Includes hands and fingers.'), `${tag} published: the description shows (P3b)`);
    const pubButtons = await pp.locator('[data-product-card-button]').filter({ visible: true }).allInnerTexts();
    expect(pubButtons.filter((b) => b.trim() === 'Add to Cart').length >= 3, `${tag} published: "Add to Cart" in each card (P3a) ${JSON.stringify(pubButtons)}`);
    expect(await pp.getByTestId('product-enquire-button').filter({ visible: true }).count() >= 3, `${tag} published: Enquire in each card`);
    await brand.first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await pp.waitForTimeout(1200);
    await pp.screenshot({ path: `${OUT}/${tag}-P3-09-published-card.png` });
    await pp.getByTestId('product-price-badge').filter({ visible: true }).nth(1).evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await pp.waitForTimeout(1200);
    await pp.screenshot({ path: `${OUT}/${tag}-P3-10-published-card-photo.png` });
    // Tapping the brand picture opens the moment as any picture does (no crash; page errors are checked at the end).
    await brand.first().click();
    await pp.waitForTimeout(1200);
    await pp.screenshot({ path: `${OUT}/${tag}-P7-11-published-brand-opened.png` });
    const viewerPrice = pp.getByTestId('viewer-price-detail').filter({ visible: true });
    expect(await viewerPrice.count() >= 1 && (await viewerPrice.first().innerText()).includes('$80 CAD'), `${tag} published viewer: the price is a "Price" detail row`);
    const viewerPriceLines = await pp.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => el.children.length === 0 && /Price: \$/.test(el.textContent || '') && el.getClientRects().length).map((el) => el.tagName));
    expect(!viewerPriceLines.length, `${tag} published viewer: no "Price: $…" text line ${JSON.stringify(viewerPriceLines)}`);
    await pp.keyboard.press('Escape').catch(() => {});
    await pub.context.close();
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall c21 Storeel product checks passed');
process.exit(failures.length || relevant.length ? 1 : 0);
