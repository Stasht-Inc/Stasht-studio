// tests/campaigns/ui/c20i-storeel-pickers.mjs — Chris 20 Nov 2026 (I9): Create Campaign (Storeel editor) step 2 Moments
// has "+ Add a Moment" first and unchanged, then the coloured, bordered "+ Products" (green) and "+ Campaigns" (purple)
// of the message composer. They open Add a Moment's own Products list / Campaigns list; the picks become moments as
// Add a Moment's picks do. The walk, at 1280 and 390, in the real app (every API call answered here, nothing leaves
// this machine):
//  Create: Campaigns → Create → title + category → step 2: the three buttons, in order → + Products → Products list →
//  tick "Walnut chair" → Add all (1) → the row is in step 2 → + Campaigns → the campaigns list is open → tick
//  "Fall Promo" → Add all (1) → its row → Save as Draft → POST /memories carries catalog_item_ids [71] and
//  linked_memory_ids [901].
//  Edit (a saved campaign): Edit → step 2 → + Products → tick "Oak bench" → Add all → POST /memories/901/catalogue-items
//  [61] at once; + Campaigns → tick "Spring Promo" → POST /memories/901/linked-memories [902].
// node tests/campaigns/ui/c20i-storeel-pickers.mjs  (C20I_BASE = dev server, default http://127.0.0.1:5241; C20I_SHOTS)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.C20I_BASE || 'http://127.0.0.1:5241';
const OUT = process.env.C20I_SHOTS || '/Users/deepaksharma/Pictures/Personal-Works/Stasht-Project/handoff-20261114/c20i-P-shots';
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 70, external_user_id: 707, name: 'TheBodyPolitik', email: 'owner@bodypolitik.test', role: '2', status: 1, is_activated: true, profile_color: '#1F6F4A' };
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="${['#6C60FF', '#F59E0B', '#10B981'][n % 3]}"/></svg>`;
const img = (n) => `${BASE}/cd-img/${n}.jpg`;
const post = (id, n) => ({
  id, name: `Moment ${n}`, title: `Moment ${n}`, description: '', master_image_link: img(n), image_link: img(n), media_url: img(n),
  capture_date: `2026-10-1${n} 10:00:00`, uploaded_at: `2026-10-1${n} 10:00:00`, parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [],
});
const CAMPAIGN = {
  id: 901, title: 'Fall Promo', user_id: 707, published: 1, slug: 'fall-promo', category: { id: 5, name: 'Campaigns' }, sub_category: null, photos: { count: 3 },
  collaborators: [], user: { id: 707, name: 'TheBodyPolitik' }, created_at: '2026-10-01 10:00:00', location: 'Barrie, Canada', tags: [],
  min_uploaded_img_date: '2026-10-01', max_uploaded_img_date: '2026-10-01', last_update_img: null,
};
const SPRING = { ...CAMPAIGN, id: 902, title: 'Spring Promo', slug: 'spring-promo', photos: { count: 2 } };

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }) {
  const state = { created: [], creates: [], momentCalls: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('cd-seeded')) return;
    sessionStorage.setItem('cd-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'main-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels');
  }, [MAIN]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/cd-img/')) return route.fulfill({ contentType: 'image/svg+xml', body: svg(Number(url.pathname.match(/(\d+)/)?.[1] ?? 0)) });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const m = req.method();
    let body = null;
    try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch { body = null; }
    if (p === '/memories' && m === 'GET') {
      const all = [...state.created, CAMPAIGN, SPRING];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length, pagination: { current_page: 1, last_page: 1 } }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Campaigns', memory_count: all.length }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories' && m === 'POST') {
      state.creates.push(body);
      const id = 950 + state.created.length;
      state.created.unshift({ ...CAMPAIGN, id, title: body?.title, slug: `new-${id}`, published: 0, created_at: '2026-11-20 10:00:00' });
      return route.fulfill({ json: { success: true, data: { id, title: body?.title, slug: `new-${id}`, category_id: body?.category_id } } });
    }
    if (p === '/memories/901' && m === 'GET') return route.fulfill({ json: { status: 'success', data: { memory: { ...CAMPAIGN, posts: [post(11, 1), post(12, 2), post(13, 3)], linked_memories: [], widgets: [], unified_order: null } } } });
    if (p === '/memories/901' && m === 'PUT') return route.fulfill({ json: { success: true, message: 'Memory updated successfully.', data: CAMPAIGN } });
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 5, name: 'Campaigns', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/products/status') return route.fulfill({ json: { success: true, data: { pilot: true, available: true, reason: null, can_create: true, counts: { total: 2, manual: 1, website: 1 }, default_currency: 'CAD' } } });
    if (p === '/products' && m === 'GET') {
      const base = { read_only: false, status: 'active', stock_status: 'in_stock', badge: 'active', compare_at_label: '', price_on_request: false, show_price: true, categories: [], sku: null, brand: null, updated_at: null, user_id: 707 };
      const items = [
        { ...base, id: 71, origin: 'manual', title: 'Walnut chair', price_label: '$300', category: null, main_image: img(2), images_count: 1, url: null },
        { ...base, id: 61, origin: 'website', title: 'Oak bench', price_label: '$450', category: 'Benches', main_image: img(1), images_count: 3, url: 'https://royalwood.example.ca/oak-bench' },
      ];
      return route.fulfill({ json: { success: true, data: { items, pagination: { current_page: 1, per_page: 200, total: items.length, last_page: 1 } } } });
    }
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: true, reason: null, item_count: 1 } } });
    if (p === '/website-catalogue/items') return route.fulfill({ json: { success: true, data: { items: [], pagination: { last_page: 1 } } } });
    if (p === '/cars' && m === 'GET') return route.fulfill({ json: { success: true, data: { cars: [], pagination: { last_page: 1 }, filters: {} } } });
    const mm = /^\/memories\/901\/(catalogue-items|linked-memories)$/.exec(p);
    if (mm && m === 'POST') {
      state.momentCalls.push({ kind: mm[1], body });
      return route.fulfill({ json: { success: true, data: mm[1] === 'linked-memories' ? { linked: (body.linked_memory_ids || []).length, already_linked_ids: [] } : { moments: (body.catalog_item_ids || []).length, skipped_item_ids: [], already_added_item_ids: [], moment_ids: [77] } } });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 1, memory_limit: 50 } } } });
    if (p === '/lead-groups') return route.fulfill({ json: { groups: [] } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/memories`);
  return { context, page, state };
}

const css = (loc) => loc.evaluate((el) => { const s = getComputedStyle(el); return { bg: s.backgroundColor, border: s.borderTopColor, bw: s.borderTopWidth, color: s.color, h: el.getBoundingClientRect().height, radius: s.borderTopLeftRadius }; });

/** Step 2's buttons: order, borders, colours. */
async function checkButtons(page, scope, tag) {
  const actions = scope.getByTestId('storeel-moments-actions');
  await actions.scrollIntoViewIfNeeded();
  const labels = (await actions.locator(':scope > button, :scope > * > button, :scope > button').allInnerTexts()).map((t) => t.trim());
  const order = await actions.evaluate((el) => [...el.querySelectorAll('button')].map((b) => b.textContent.trim()));
  expect(JSON.stringify(order) === JSON.stringify(['Add a Moment', 'Products', 'Campaigns']), `${tag}: step 2 buttons in order Add a Moment · + Products · + Campaigns (got ${JSON.stringify(order || labels)})`);
  const add = await css(scope.getByTestId('storeel-moments-add'));
  const prod = await css(scope.getByTestId('storeel-moments-products'));
  const camp = await css(scope.getByTestId('storeel-moments-campaigns'));
  expect(add.bg === 'rgb(255, 255, 255)' && add.border === 'rgb(209, 213, 219)', `${tag}: Add a Moment unchanged (white, grey border) ${JSON.stringify(add)}`);
  expect(prod.bw === '1px' && prod.border === 'rgb(167, 243, 208)' && prod.bg === 'rgb(236, 253, 245)' && prod.color === 'rgb(4, 120, 87)', `${tag}: + Products green fill with a green border ${JSON.stringify(prod)}`);
  expect(camp.bw === '1px' && camp.border === 'rgb(233, 213, 255)' && camp.bg === 'rgb(250, 245, 255)', `${tag}: + Campaigns purple fill WITH a purple border ${JSON.stringify(camp)}`);
  expect(prod.h === camp.h && prod.h === add.h && prod.radius === camp.radius, `${tag}: the three are the same height; the pair the same radius (${add.h}/${prod.h}/${camp.h})`);
}

const addAll = (page, n) => page.getByRole('button', { name: `Add all (${n})` });

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const { page, context, state } = await open({ width, height });

    // ── Create ───────────────────────────────────────────────────────────────────────────────────────────────────────
    await page.getByText(/^Fall Promo/).filter({ visible: true }).first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /^Create( a Campaign)?$/ }).filter({ visible: true }).last().click();
    const create = page.getByRole('dialog', { name: 'Create Campaign' });
    await create.getByPlaceholder('Give your campaign a meaningful title').waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    await create.getByPlaceholder('Give your campaign a meaningful title').fill(`Waxing menu ${tag}`);
    await create.locator('#st-step-campaign').getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Campaigns' }).click();
    await page.waitForTimeout(400);
    await checkButtons(page, create, `${tag} create`);
    await create.locator('#st-step-moments').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${tag}-I9-01-step2-buttons.png` });

    // + Products → Add a Moment on its Products list.
    await create.getByTestId('storeel-moments-products').click();
    await page.getByRole('heading', { name: 'Add a Moment' }).waitFor({ timeout: 10000 });
    await page.getByRole('checkbox', { name: /Walnut chair/ }).waitFor({ timeout: 10000 });
    const sw = page.getByRole('radiogroup', { name: 'Add from' });
    expect(await sw.getByRole('radio', { name: 'Products' }).getAttribute('aria-checked') === 'true', `${tag}: + Products opens Add a Moment on Products`);
    await page.getByRole('checkbox', { name: /Walnut chair/ }).click();
    await page.screenshot({ path: `${OUT}/${tag}-I9-02-products-picker.png` });
    await addAll(page, 1).click();
    await page.waitForTimeout(800);
    expect(!(await page.getByRole('heading', { name: 'Add a Moment' }).count()), `${tag}: Add all closes it`);
    expect(await create.locator('[data-moment-row="product"]').filter({ hasText: 'Walnut chair' }).count() === 1, `${tag}: "Walnut chair" is a moment in step 2`);

    // + Campaigns → Add a Moment with the Campaigns list first and open.
    await create.getByTestId('storeel-moments-campaigns').click();
    await page.getByRole('heading', { name: 'Add a Moment' }).waitFor({ timeout: 10000 });
    const list = page.getByRole('list', { name: 'Campaigns' });
    await list.waitFor({ timeout: 10000 });
    expect(await page.locator('#moment-campaigns-toggle').getAttribute('aria-expanded') === 'true', `${tag}: + Campaigns opens with the campaigns list open`);
    const campaignsTop = (await page.getByTestId('moment-campaigns').boundingBox())?.y ?? 9999;
    const photosTop = (await page.getByText('Photos & Videos', { exact: true }).boundingBox())?.y ?? 0;
    expect(campaignsTop < photosTop, `${tag}: … above Photos & Videos`);
    expect(await page.getByRole('radiogroup', { name: 'Add from' }).getByRole('radio', { name: 'Media' }).getAttribute('aria-checked') === 'true', `${tag}: … on Media (the other tabs still there)`);
    await list.getByRole('checkbox', { name: /Fall Promo/ }).click();
    await page.screenshot({ path: `${OUT}/${tag}-I9-03-campaigns-picker.png` });
    await addAll(page, 1).click();
    await page.waitForTimeout(800);
    expect(await create.locator('[data-moment-row="campaign"]').filter({ hasText: 'Fall Promo' }).count() === 1, `${tag}: "Fall Promo" is a moment in step 2`);

    // Add a Moment itself is unchanged: its chooser → Moment → Media first, no list open.
    await create.getByTestId('storeel-moments-add').click();
    await page.waitForTimeout(400);
    await page.locator('button').filter({ hasText: /^Moment/ }).filter({ visible: true }).first().click();
    await page.getByRole('heading', { name: 'Add a Moment' }).waitFor({ timeout: 10000 });
    expect(await page.getByRole('radiogroup', { name: 'Add from' }).getByRole('radio', { name: 'Media' }).getAttribute('aria-checked') === 'true'
      && await page.locator('#moment-campaigns-toggle').getAttribute('aria-expanded') === 'false', `${tag}: Add a Moment still opens on Media, campaigns closed`);
    await page.getByRole('heading', { name: 'Add a Moment' }).locator('xpath=ancestor::div[2]').getByRole('button').last().click().catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
    if (await page.getByRole('heading', { name: 'Add a Moment' }).count()) await page.getByRole('button', { name: /^Cancel$/ }).filter({ visible: true }).last().click().catch(() => {});
    await page.waitForTimeout(400);
    await create.locator('#st-step-moments').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${tag}-I9-04-step2-with-picks.png` });

    await create.getByRole('button', { name: 'Save as Draft', exact: true }).filter({ visible: true }).last().click();
    await page.waitForTimeout(1500);
    const sent = state.creates[0] || {};
    expect(JSON.stringify(sent.catalog_item_ids) === '[71]' && JSON.stringify(sent.linked_memory_ids) === '[901]', `${tag}: Save as Draft sends the picks (catalog_item_ids ${JSON.stringify(sent.catalog_item_ids)}, linked_memory_ids ${JSON.stringify(sent.linked_memory_ids)})`);

    // ── Edit a saved campaign: the same buttons add at once ────────────────────────────────────────────────────────
    await page.goto(`${BASE}/memories`);
    const card = page.getByText(/^Fall Promo/).filter({ visible: true }).first();
    await card.waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    await card.click();
    await page.getByText('Moment 1').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    if (width >= 1024) await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click();
    else await page.getByRole('button', { name: 'Edit Campaign' }).filter({ visible: true }).first().click();
    const edit = page.getByRole('dialog', { name: 'Edit Campaign' });
    await edit.getByTestId('storeel-moments-products').waitFor({ timeout: 15000 });
    await page.waitForTimeout(1200);
    await checkButtons(page, edit, `${tag} edit`);
    await edit.getByTestId('storeel-moments-products').click();
    await page.getByRole('checkbox', { name: /Oak bench/ }).waitFor({ timeout: 10000 });
    await page.getByRole('checkbox', { name: /Oak bench/ }).click();
    await addAll(page, 1).click();
    await page.waitForTimeout(1500);
    const prodCall = state.momentCalls.find((c) => c.kind === 'catalogue-items');
    expect(JSON.stringify(prodCall?.body?.catalog_item_ids) === '[61]', `${tag}: edit: + Products adds "Oak bench" to the campaign at once (${JSON.stringify(prodCall?.body)})`);
    await edit.getByTestId('storeel-moments-campaigns').click();
    await page.getByRole('list', { name: 'Campaigns' }).getByRole('checkbox', { name: /Spring Promo/ }).waitFor({ timeout: 10000 });
    expect(!(await page.getByRole('list', { name: 'Campaigns' }).getByRole('checkbox', { name: /Fall Promo/ }).count()), `${tag}: edit: the campaign itself is never offered`);
    await page.getByRole('list', { name: 'Campaigns' }).getByRole('checkbox', { name: /Spring Promo/ }).click();
    await addAll(page, 1).click();
    await page.waitForTimeout(1500);
    const linkCall = state.momentCalls.find((c) => c.kind === 'linked-memories');
    expect(JSON.stringify(linkCall?.body?.linked_memory_ids) === '[902]', `${tag}: edit: + Campaigns links "Spring Promo" at once (${JSON.stringify(linkCall?.body)})`);
    await page.screenshot({ path: `${OUT}/${tag}-I9-05-edit-after-adds.png` });
    await context.close();
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall I9 Storeel picker checks passed');
process.exit(failures.length || relevant.length ? 1 : 0);
