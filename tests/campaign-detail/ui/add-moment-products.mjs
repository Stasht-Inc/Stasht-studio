// Chris, 7 Nov 2026 (point 7, images/189.jpg): the campaign page's Add a Moment offers the account's Website Catalogue
// products and a dealer's vehicles (Products / Vehicles beside Photos & Videos); Add all (N) saves them on the campaign at
// once (POST /memories/{id}/catalogue-items, /cars). Off the Business plan: "Available on the Business plan." + See plans.
// In the real app at 1280 and 390. node tests/campaign-detail/ui/add-moment-products.mjs  (CD_BASE = the dev server)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from './cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.CD_BASE || 'http://localhost:5311';
const OUT = process.env.CD_SHOTS || '/private/tmp/claude-501/campaign-detail-ui/add-moment-products';
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 70, external_user_id: 707, name: 'Main Dealer', email: 'main@dealer.test', role: '2', status: 1, is_activated: true, profile_color: '#1D4ED8' };
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="${['#6C60FF', '#F59E0B', '#10B981'][n % 3]}"/></svg>`;
const img = (n) => `${BASE}/cd-img/${n}.jpg`;
const post = (id, n) => ({
  id, name: `Moment ${n}`, title: `Moment ${n}`, description: '', master_image_link: img(n), image_link: img(n), media_url: img(n),
  capture_date: `2026-10-1${n} 10:00:00`, uploaded_at: `2026-10-1${n} 10:00:00`, parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [],
});
const CAMPAIGN = {
  id: 901, title: 'Fall Promo', user_id: 707, published: 1, slug: 'fall-promo', category: { id: 5, name: 'Campaigns' }, sub_category: null, photos: { count: 3 },
  collaborators: [], user: { id: 707, name: 'Main Dealer' }, created_at: '2026-10-01 10:00:00', location: 'Toronto, ON', tags: ['fall'],
  min_uploaded_img_date: '2026-10-01', max_uploaded_img_date: '2026-10-01', last_update_img: null,
};


const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height, planRequired = false }) {
  const state = { puts: [], sends: [], counts: 0, title: CAMPAIGN.title, deleted: false, created: [], momentCalls: [], itemCalls: 0 };
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
    const campaign = () => ({ ...CAMPAIGN, title: state.title });
    if (p === '/memories' && m === 'GET') {
      const all = [...state.created, campaign()];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Campaigns', memory_count: all.length }] }, labels: { items: [] } } } } });
    }
    // Save as Draft (MemoriesController::store): the new campaign joins the list.
    if (p === '/memories' && m === 'POST') {
      const id = 950 + state.created.length;
      state.created.unshift({ ...CAMPAIGN, id, title: body?.title, slug: `new-${id}`, published: 0, created_at: '2026-11-04 10:00:00' });
      return route.fulfill({ json: { success: true, data: { id, title: body?.title, slug: `new-${id}`, category_id: body?.category_id } } });
    }
    if (p === '/memories/901' && m === 'GET') return route.fulfill({ json: { status: 'success', data: { memory: { ...campaign(), posts: [post(11, 1), post(12, 2), post(13, 3)], linked_memories: [], widgets: [], unified_order: null } } } });
    if (p === '/memories/901' && m === 'PUT') {
      state.puts.push(body);
      if (body?.title) state.title = body.title;
      return route.fulfill({ json: { success: true, message: 'Memory updated successfully.', data: campaign() } });
    }
    if (p === '/memories/901' && m === 'DELETE') { state.deleted = true; return route.fulfill({ json: { success: true } }); }
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 5, name: 'Campaigns', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/memories/901/storeel-audience-count') {
      state.counts++;
      const ch = body?.channels ?? [];
      return route.fulfill({ json: { success: true, data: { email: ch.includes('email') ? 1 : 0, sms: ch.includes('sms') ? 1 : 0, skipped: { no_email: 0, no_phone: 0, unsubscribed: 0, duplicate: 0 }, person: { email: null, sms: null, errors: {} } }, storeel: { max_messages: 1000, needed: ch.length, over_limit: false, sms: null, allowance: { plan: 'Professional', email_limit: 2500, sms_limit: 250, email_used: 0, sms_used: 0, email_pending: 0, sms_pending: 0, resets_at: '2026-12-01T05:00:00Z' } } } });
    }
    if (p === '/memories/901/storeel-send') {
      state.sends.push(body);
      return route.fulfill({ json: { success: true, data: { broadcast_id: 'b1', memory_id: 901, status: 'sent', channels: body.channels, replayed: false, published_now: false, texts_wait_until: null, counts: { recipients: 2, sent: 2, queued: 0, failed: 0, email: { sent: 1, queued: 0, failed: 0 }, sms: { sent: 1, queued: 0, failed: 0 }, skipped: { total: 0 } } } } });
    }
    // Chris, 7 Nov 2026 (point 7): the account's Website Catalogue products and vehicles, and adding them.
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: planRequired ? { available: false, reason: 'plan_required', item_count: 3 } : { available: true, reason: null, item_count: 2 } } });
    if (p === '/website-catalogue/items') {
      state.itemCalls++;
      return route.fulfill({ json: { success: true, data: { items: [
        { id: 61, title: 'Oak bench', price_label: '$450', category: 'Benches', main_image: img(1), images_count: 3, url: 'https://royalwood.example.ca/oak-bench' },
        { id: 62, title: 'Pine shelf', price_label: '$120', category: 'Shelves', main_image: img(2), images_count: 1, url: null },
      ], pagination: { last_page: 1 } } } });
    }
    if (p === '/cars' && m === 'GET') return route.fulfill({ json: { success: true, data: { cars: [{ id: 5, title: '2024 Jeep Wrangler', main_image: img(3), price: '34995', mileage: 45000, stock_number: 'S2300' }], pagination: { last_page: 1 }, filters: {} } } });
    const mm = /^\/memories\/901\/(catalogue-items|cars)$/.exec(p);
    if (mm && m === 'POST') {
      state.momentCalls.push({ kind: mm[1], body });
      return route.fulfill({ json: { success: true, data: mm[1] === 'cars' ? { linked: 1 } : { moments: (body.catalog_item_ids || []).length, skipped_item_ids: [], already_added_item_ids: [], moment_ids: [77] } } });
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


async function openCampaign(page) {
  const card = page.getByText(/^Fall Promo/).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(800);
  await card.click();
  await page.getByText('Moment 1').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

/** The campaign page's own Add a Moment: desktop, the header's button (adds at the end); phones, the "+" between the
 *  2nd "+" (under Moment 2) → Moment (adds right after it). */
async function openAddMoment(page, width) {
  if (width >= 768) {
    await page.getByRole('button', { name: /Add a Moment/ }).filter({ visible: true }).first().click();
  } else {
    const divider = page.locator('button:has(path[d="M12 5v14M5 12h14"])').filter({ visible: true }).nth(1);
    await divider.scrollIntoViewIfNeeded();
    await divider.click();
    await page.waitForTimeout(300);
    await page.locator('button').filter({ hasText: /^Moment/ }).filter({ visible: true }).first().click();
  }
  await page.getByRole('heading', { name: 'Add a Moment' }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
}

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const { page, context, state } = await open({ width, height });
    await openCampaign(page);
    await openAddMoment(page, width);
    const sw = page.getByRole('radiogroup', { name: 'Add from' });
    expect(await sw.isVisible().catch(() => false), `${tag}: the campaign page's Add a Moment has Photos & Videos | Products | Vehicles`);
    await sw.getByRole('radio', { name: 'Products' }).click();
    await page.getByRole('checkbox', { name: /Oak bench/ }).click();
    await page.getByRole('checkbox', { name: /Pine shelf/ }).click();
    await sw.getByRole('radio', { name: 'Vehicles' }).click();
    await page.getByRole('checkbox', { name: /2024 Jeep Wrangler/ }).click();
    const addAll = page.getByRole('button', { name: 'Add all (3)' });
    expect(await addAll.isVisible().catch(() => false), `${tag}: Add all (3) counts 2 products + 1 vehicle`);
    const box = await addAll.boundingBox();
    const vp = page.viewportSize();
    expect(Boolean(box && box.y + box.height <= vp.height + 1), `${tag}: Add all is in the viewport`);
    await page.screenshot({ path: `${OUT}/${tag}-01-add-moment-products.png` });
    await addAll.click();
    await page.waitForTimeout(1500);
    const prod = state.momentCalls.find((c) => c.kind === 'catalogue-items');
    const cars = state.momentCalls.find((c) => c.kind === 'cars');
    expect(prod && JSON.stringify(prod.body.catalog_item_ids) === '[61,62]', `${tag}: products saved on the campaign (got ${JSON.stringify(prod?.body)})`);
    expect(width >= 768 ? !('after_item_id' in prod.body) : (prod.body.after_item_id === 12 && prod.body.after_item_type === 'post'),
      `${tag}: ${width >= 768 ? 'header button: at the end' : 'the "+" under Moment 2: right after it'} (got ${JSON.stringify(prod?.body)})`);
    expect(cars && JSON.stringify(cars.body.car_ids) === '[5]', `${tag}: vehicle linked (got ${JSON.stringify(cars?.body)})`);
    expect(await page.getByText('2 products and 1 vehicle added to your campaign.').first().isVisible().catch(() => false), `${tag}: toast says what was added`);
    expect(!(await page.getByRole('heading', { name: 'Add a Moment' }).count()), `${tag}: the window closes`);
    await page.screenshot({ path: `${OUT}/${tag}-02-added.png` });
    await context.close();

    // Off the Business plan: the note + See plans; no Business-only call.
    const t = await open({ width, height, planRequired: true });
    await openCampaign(t.page);
    await openAddMoment(t.page, width);
    await t.page.getByRole('radiogroup', { name: 'Add from' }).getByRole('radio', { name: 'Products' }).click();
    expect(await t.page.getByText('Available on the Business plan.', { exact: true }).isVisible().catch(() => false), `${tag}: plan note`);
    expect(await t.page.getByRole('button', { name: 'See plans' }).isVisible().catch(() => false), `${tag}: See plans`);
    expect(t.state.itemCalls === 0, `${tag}: no Business-only items call`);
    await t.page.screenshot({ path: `${OUT}/${tag}-03-plan-gate.png` });
    await t.context.close();
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall campaign-page Add a Moment checks passed');
process.exit(failures.length ? 1 : 0);
