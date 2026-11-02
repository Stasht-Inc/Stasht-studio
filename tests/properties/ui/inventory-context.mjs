// Personal account vs External view inventory (Deepak, 2 Nov 2026, binding): a salesperson's PERSONAL account shows
// only its own cars and website-catalogue items; the main account's (Serpa Chrysler's) show only in the External view
// of the salesperson's own property. Studio names that property on every request from the External view
// (X-Stasht-Property: 96) and sends nothing from the personal view; the mocked API answers by that header, as the real
// one does. Checks the requests and what the Campaigns page shows, in both views and across an in-app switch.
// node tests/properties/ui/inventory-context.mjs   (needs the dev server: SL_BASE, default http://localhost:5291)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: SL_SHOTS (default /private/tmp/claude-501/salesperson-ui/inventory-context).
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.SL_BASE || 'http://localhost:5291';
const OUT = process.env.SL_SHOTS || '/private/tmp/claude-501/salesperson-ui/inventory-context';
mkdirSync(OUT, { recursive: true });

const HEADER = 'x-stasht-property';
const SERPA = { id: 708, external_user_id: 889, name: 'Serpa Chrysler', email: 'serpa@dealer.test', role: '2', status: 1, is_activated: true };
const BON = { id: 120, external_user_id: 966, name: 'Bon Sun', email: 'bon@dealer.test', role: '2', status: 1, is_activated: true };
const base = { location: 'Toronto, ON', memories_count: 0, users_count: 1, invited_users: [], labels: [], created_at: '2026-10-01T10:00:00Z', is_active: true, status: 1 };
const SERPA_LOGO = `${BASE}/pwa-icon-192.png`;
const INVITED_BY_SERPA = { id: 708, external_user_id: 889, name: 'Serpa Chrysler', email: 'serpa@dealer.test', profile_image: SERPA_LOGO };
const BONS_OWN = { ...base, id: 96, name: 'Bon Sun', unique_id: 'BS-96', username: 'bonsun', user_id: 966, parent_user_id: 889, is_creator: true, user_role: 'admin', property_type: 'external', account_type: 'external', account_created_for_property: true, can_manage: false, is_own_external_account: true, image: null, invited_by: INVITED_BY_SERPA };
const SERPA_INTERNAL = { ...base, id: 12, name: 'Serpa Downtown', unique_id: 'SD-12', user_id: 889, is_creator: true, user_role: 'owner', property_type: 'internal', account_type: 'internal', account_created_for_property: false, can_manage: true, is_own_external_account: false };
const SERPA_SEES_BON = { ...base, id: 96, name: 'Bon Sun', unique_id: 'BS-96', user_id: 966, parent_user_id: 889, is_creator: false, user_role: 'admin', property_type: 'external', account_type: 'external', account_created_for_property: true, can_manage: true, is_own_external_account: false };

// Bon's own car, and Serpa's car + product (read-only, with the owner block the API sends).
const SERPA_OWNER = { id: 889, name: 'Serpa Chrysler', profile_image: SERPA_LOGO, profile_color: '1d4ed8' };
const BON_CAR = { id: 601, user_id: 966, read_only: false, title: '2019 Ram 1500 Bon Own', price: '31900', category: 'preowned', images_count: 2, main_image: null, location: { formatted: 'Toronto, ON' }, spec_summary: 'STK# B601 / 64,000 km' };
const SERPA_CAR = { id: 501, user_id: 889, read_only: true, owner: SERPA_OWNER, title: '2024 Jeep Grand Cherokee Serpa', price: '58900', category: 'preowned', images_count: 3, main_image: null, location: { formatted: 'Toronto, ON' }, spec_summary: 'STK# J501 / 12 km' };
const SERPA_PRODUCT = { id: 31, user_id: 889, read_only: true, owner: SERPA_OWNER, title: 'All-Weather Floor Mats Serpa', price: '199', currency: 'CAD', price_label: '$199 CAD', category: 'Accessories', url: null, main_image: null, images_count: 0, spec_summary: '' };
const BON_OWN_CAMPAIGN = { id: 801, title: 'Bon Test Drive Day', user_id: 966, property_id: 96, published: 1, category: { id: 5, name: 'Campaigns' }, photos: { count: 0 }, location: 'Toronto, ON', collaborators: [], user: { id: 966, name: 'Bon Sun' } };

const failures = [];
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

// Every inventory request: its path and the view header it carried.
async function open({ width = 1280, height = 900, who = BON, seed, path = '/', slowExternalCars = 0 }) {
  const state = { requests: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([seedData]) => {
    if (sessionStorage.getItem('ic-seeded')) return;
    sessionStorage.setItem('ic-seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(seedData)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, [seed]);
  const owned = who === BON ? [BONS_OWN] : [SERPA_INTERNAL];
  const shared = who === BON ? [] : [SERPA_SEES_BON];
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const remoteApi = !['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.startsWith('/api/react/');
    if (!['localhost', '127.0.0.1'].includes(url.hostname) && !remoteApi) {
      blocked.add(url.hostname);
      if (url.hostname === 'js.stripe.com') {
        return route.fulfill({ contentType: 'text/javascript', body: 'window.Stripe=function(){return{elements:function(){return{create:function(){return{mount:function(){},on:function(){},destroy:function(){},unmount:function(){}}},getElement:function(){return null}}}}};' });
      }
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') {
        return route.fulfill({ contentType: 'text/javascript', body: 'window.gapi={load:function(n,c){var f=typeof c==="function"?c:(c&&c.callback);if(f)f();}};' });
      }
      return route.abort('blockedbyclient');
    }
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const view = (await req.allHeaders())[HEADER] || null;
    // The real API's rule: only Bon's own property 96 adds Serpa's inventory, and only for Bon's own sign-in.
    const external = who === BON && view === '96';
    if (process.env.SL_DEBUG) console.log('api', req.method(), p, url.search, view);
    if (p === '/properties' && req.method() === 'GET') {
      return route.fulfill({ json: { success: true, data: { properties: [...owned, ...shared], owned_properties: owned, shared_properties: shared, owned_count: owned.length, shared_count: shared.length, total_count: owned.length + shared.length } } });
    }
    const feed = p.match(/^\/properties\/(\d+)\/memories$/);
    if (feed && req.method() === 'GET') {
      const mine = feed[1] === '96' ? [BON_OWN_CAMPAIGN] : [];
      return route.fulfill({ json: { status: 'success', data: { property: feed[1] === '96' ? BONS_OWN : SERPA_INTERNAL, user_role: 'admin', viewing_invited_content: false, inviter: null, memories: { data: mine, total: mine.length }, sidebar: { categories: { items: [] }, labels: { items: [] } } } } });
    }
    if (p === '/website-catalogue' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { available: true, connected: external, item_count: external ? 1 : 0, source: null } } });
    if (p === '/website-catalogue/items' && req.method() === 'GET') {
      const items = external ? [SERPA_PRODUCT] : [];
      return route.fulfill({ json: { success: true, data: { items, pagination: { current_page: 1, per_page: 500, total: items.length, last_page: 1 } } } });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/cars' || p.startsWith('/cars?')) {
      const cars = who === BON ? (external ? [BON_CAR, SERPA_CAR] : [BON_CAR]) : [];
      // A slow External-view answer, to land after a switch to the personal view (review L1).
      if (external && slowExternalCars) await new Promise((r) => setTimeout(r, slowExternalCars));
      return route.fulfill({ json: { status: 200, data: { cars, pagination: { total: cars.length }, filters: { categories: ['preowned'] } } } });
    }
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  // Recorded as each request is issued (the route handler above runs later), so their order matches a view switch.
  context.on('request', (req) => {
    const url = new URL(req.url());
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (url.pathname.startsWith('/api/') && /^\/(cars|website-catalogue)/.test(p)) state.requests.push({ p, view: req.headers()[HEADER] || null });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}${path}`);
  return { context, page, state };
}

async function shot(page, file) {
  const p = `${OUT}/${file}.png`;
  await page.screenshot({ path: p, fullPage: false });
  console.log('shot', p);
}
async function waitForApp(page) {
  await page.getByText('Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1500);
}
async function showStoreels(page) {
  const storeels = page.getByRole('radio', { name: /^Storeels/ }).filter({ visible: true }).first();
  if (await storeels.count()) await storeels.click();
  await page.getByText(BON_CAR.title).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
}
const shows = async (page, text) => (await page.getByText(text).filter({ visible: true }).count()) > 0;
async function openProfileMenu(page) {
  await page.locator('[data-name="Dropdown"]').filter({ visible: true }).first().locator('*').first().click();
  await page.waitForTimeout(800);
}
const views = (state, from = 0) => [...new Set(state.requests.slice(from).map((r) => r.view))];
// The sidebar's Campaigns count (the "Campaigns 4" nav item).
const sidebarCampaigns = (page) => page.evaluate(() => {
  for (const el of document.querySelectorAll('span, div, p')) {
    if (el.textContent?.trim() !== 'Campaigns' || el.offsetParent === null) continue;
    const m = (el.parentElement?.parentElement?.textContent || '').trim().match(/^Campaigns\s*(\d+)$/);
    if (m) return Number(m[1]);
  }
  return null;
});

try {
  // 1. Personal account: only Bon's own car; no request names a property.
  {
    const { page, context, state } = await open({ seed: { stasht_token: 'bon-token', stasht_user: BON, view_type: 'personal', stasht_campaigns_view: 'storeels' }, path: '/memories' });
    await waitForApp(page);
    await showStoreels(page);
    console.log('1 personal requests', JSON.stringify(state.requests));
    expect(state.requests.length > 0, '1: the personal view asked for cars / catalogue');
    expect(views(state).every((v) => v === null), '1: no X-Stasht-Property from the personal view');
    expect(await shows(page, BON_CAR.title), "1: Bon's own car shows");
    expect(!(await shows(page, SERPA_CAR.title)), "1: Serpa's car does not show in the personal view");
    expect(!(await shows(page, SERPA_PRODUCT.title)), "1: Serpa's product does not show in the personal view");
    await shot(page, '01-personal-view-own-cars-only');
    await context.close();
  }

  // 2. External view of his own property (restored from localStorage): Serpa's car and product too; every request
  //    names property 96. Then "Back to Bon Sun" (no reload): requests stop naming it and GET /cars is not served from
  //    the External view's 15 s GET cache.
  {
    const { page, context, state } = await open({ seed: { stasht_token: 'bon-token', stasht_user: BON, view_type: 'property', selected_property: BONS_OWN, stasht_campaigns_view: 'storeels' } });
    await waitForApp(page);
    await showStoreels(page);
    await page.getByText(SERPA_CAR.title).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    console.log('2 external requests', JSON.stringify(state.requests));
    expect(state.requests.length > 0 && views(state).every((v) => v === '96'), '2: every cars / catalogue request from the External view names property 96');
    expect(await shows(page, SERPA_CAR.title), "2: Serpa's car shows in the External view");
    expect(await shows(page, SERPA_PRODUCT.title), "2: Serpa's product shows in the External view");
    expect(await shows(page, BON_CAR.title), "2: Bon's own car shows too");
    expect(await shows(page, 'Property'), '2: Property badge (External view)');
    await shot(page, '02-external-view-with-main-account-inventory');

    const before = state.requests.length;
    await openProfileMenu(page);
    await page.getByText('Back to Bon Sun').filter({ visible: true }).first().click();
    await page.waitForTimeout(2500);
    // No reload: the page refetches in the personal view. The same GET /cars?per_page=100 the External view read a few
    // seconds ago must not come from the 15 s cache: ask for it again through the app's own module.
    const inApp = state.requests.slice(before);
    const titles = await page.evaluate(async () => {
      const mod = await import('/utils/authUtils.ts');
      const res = await mod.dashboardAPI.carsGetCatalog();
      return (res.data?.data?.cars || []).map((c) => c.title);
    });
    const after = state.requests.slice(before);
    console.log('2b after switch (no reload)', JSON.stringify({ inApp, after, titles }), await page.evaluate(() => localStorage.getItem('view_type')));
    // (It may come from the cache the page's own personal refetch just filled: that's fine, it is keyed by the view.)
    expect(after.length > 0 && views(state, before).every((v) => v === null), '2b: after Back to Bon Sun (no reload) no request names a property');
    expect(titles.includes(BON_CAR.title) && !titles.includes(SERPA_CAR.title), "2b: GET /cars right after the switch is the personal one (not the External view's cached answer)");
    // The Campaigns page stayed on screen (no reload): it loaded the cars and catalogue again for the personal view.
    expect(inApp.some((r) => r.p === '/cars'), '2b: the page itself asked for the cars again after the switch');
    await page.getByText(BON_CAR.title).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    expect(await shows(page, BON_CAR.title), "2b: Bon's own car shows on the page kept across the switch");
    expect(!(await shows(page, SERPA_CAR.title)), "2b: Serpa's car is gone from that page");
    expect(!(await shows(page, SERPA_PRODUCT.title)), "2b: Serpa's product is gone from that page");
    await shot(page, '03-back-to-personal-no-reload');
    // And the Campaigns page opened again in that tab.
    await page.goto(`${BASE}/memories`);
    await waitForApp(page);
    await showStoreels(page);
    expect(views(state, before).every((v) => v === null), '2c: the personal Campaigns page sends no X-Stasht-Property');
    expect(await shows(page, BON_CAR.title), "2c: Bon's own car shows");
    expect(!(await shows(page, SERPA_CAR.title)), "2c: Serpa's car is gone in the personal view");
    await shot(page, '03b-personal-campaigns-own-cars-only');
    await context.close();
  }

  // 3. Personal → External from the Profile menu's External (1) row (it reloads): the requests then name 96.
  {
    const { page, context, state } = await open({ seed: { stasht_token: 'bon-token', stasht_user: BON, view_type: 'personal', stasht_campaigns_view: 'storeels' }, path: '/memories' });
    await waitForApp(page);
    await openProfileMenu(page);
    await page.getByText('External (1)', { exact: true }).filter({ visible: true }).first().click();
    await page.waitForTimeout(400);
    const before = state.requests.length;
    await page.locator('button').filter({ hasText: 'Bon Sun' }).filter({ hasText: 'Serpa Chrysler' }).filter({ visible: true }).first().click();
    await waitForApp(page);
    await showStoreels(page);
    await page.getByText(SERPA_CAR.title).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    console.log('3 after menu switch', JSON.stringify(state.requests.slice(before)));
    expect(state.requests.length > before && views(state, before).every((v) => v === '96'), '3: after opening the External account every request names 96');
    expect(await shows(page, SERPA_CAR.title), "3: Serpa's car shows");
    await shot(page, '04-external-view-from-profile-menu');
    await context.close();
  }

  // 4. The main account in its own internal property view and in its personal view: never sends the header.
  {
    const { page, context, state } = await open({ who: SERPA, seed: { stasht_token: 'serpa-token', stasht_user: SERPA, view_type: 'property', selected_property: SERPA_INTERNAL, stasht_campaigns_view: 'storeels' } });
    await waitForApp(page);
    await page.waitForTimeout(1500);
    console.log('4 main account requests', JSON.stringify(state.requests));
    expect(views(state).every((v) => v === null), '4: the main account\'s internal property view sends no X-Stasht-Property');
    await context.close();
  }

  // 6. Review L1: the External view's cars answer is slow and lands after "Back to Bon Sun". The sidebar's Campaigns
  //    count must end as it does when nothing is slow (the personal view's), not take the stale External answer.
  {
    const switchAndCount = async (slowExternalCars) => {
      const { page, context, state } = await open({ slowExternalCars, seed: { stasht_token: 'bon-token', stasht_user: BON, view_type: 'property', selected_property: BONS_OWN, stasht_campaigns_view: 'storeels' } });
      await waitForApp(page);
      const sentExternal = state.requests.some((r) => r.p === '/cars' && r.view === '96');
      await openProfileMenu(page);
      await page.getByText('Back to Bon Sun').filter({ visible: true }).first().click();
      await page.waitForTimeout(slowExternalCars + 2500); // the slow External answers have landed by now
      const count = await sidebarCampaigns(page);
      if (slowExternalCars) await shot(page, '05-slow-external-answer-after-switch');
      await context.close();
      return { count, sentExternal };
    };
    const control = await switchAndCount(0);
    const slow = await switchAndCount(7000);
    console.log('6 counts', JSON.stringify({ control, slow }));
    expect(slow.sentExternal, '6: the External view asked for its cars (slow answer)');
    expect(control.count !== null && slow.count === control.count, `6: the slow External answer doesn't change the personal count (${slow.count} vs ${control.count})`);
  }

  // 5. Two tabs: tab A personal, tab B opens the External view. Tab A's next requests still send nothing.
  {
    const { page, context, state } = await open({ seed: { stasht_token: 'bon-token', stasht_user: BON, view_type: 'personal', stasht_campaigns_view: 'storeels' }, path: '/memories' });
    await waitForApp(page);
    const tabB = await context.newPage();
    await tabB.goto(`${BASE}/memories`);
    await waitForApp(tabB);
    await openProfileMenu(tabB);
    await tabB.getByText('External (1)', { exact: true }).filter({ visible: true }).first().click();
    await tabB.waitForTimeout(400);
    await tabB.locator('button').filter({ hasText: 'Bon Sun' }).filter({ hasText: 'Serpa Chrysler' }).filter({ visible: true }).first().click();
    await waitForApp(tabB);
    expect(await tabB.evaluate(() => localStorage.getItem('view_type')) === 'property', '5: tab B is in the External view');
    // Tab A asks again (its own dashboardAPI, as a refetch would).
    const before = state.requests.length;
    await page.bringToFront();
    const r = await page.evaluate(async () => {
      const mod = await import('/utils/authUtils.ts');
      const res = await mod.dashboardAPI.carsGetCatalog('preowned');
      return (res.data?.data?.cars || []).map((c) => c.title);
    });
    const tabARequests = state.requests.slice(before).filter((x) => x.p.includes('category=preowned') || x.p === '/cars');
    console.log('5 tab A after tab B switched', JSON.stringify({ r, reqs: state.requests.slice(before) }));
    expect(!r.includes(SERPA_CAR.title), "5: tab A (personal) still doesn't get Serpa's car");
    await context.close();
  }
} catch (e) {
  failures.push(`crashed: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
}

console.log('blocked hosts:', [...blocked].join(', ') || 'none');
if (pageErrors.length) console.log('page errors:', [...new Set(pageErrors)].slice(0, 10));
if (failures.length) {
  console.log(`\n${failures.length} FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nALL PASSED');
