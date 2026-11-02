// Salespeople choose each time they sign in (Deepak, 1 Nov 2026 evening, after Chris: "They still represent Serpa
// Chrysler. They should still have an External account, and a personal account."): an account made for a main
// account's external property gets the account chooser with its External account — its own external property,
// shown as representing the main account ("Bon Sun" + "Serpa Chrysler", the main account's logo, the Property
// badge) — and its personal account. In the External view: Campaigns (with the main account's cars and website
// catalogue, read-only), Leads, Media; Newsletters on Campaigns; "Back to Bon Sun" in the Profile menu. The view
// is restored on reload. The main account's sign-in is unchanged.
// node tests/properties/ui/salesperson-landing.mjs   (needs the dev server: SL_BASE, default http://localhost:5291)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: SL_SHOTS (default /private/tmp/claude-501/salesperson-ui/shots).
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.SL_BASE || 'http://localhost:5291';
const OUT = process.env.SL_SHOTS || '/private/tmp/claude-501/salesperson-ui/shots';
mkdirSync(OUT, { recursive: true });

// Serpa Chrysler (main account, stash 889) made property 96 for its salesperson Bon Sun (stash 966).
const SERPA = { id: 708, external_user_id: 889, name: 'Serpa Chrysler', email: 'serpa@dealer.test', role: '2', status: 1, is_activated: true };
const BON = { id: 120, external_user_id: 966, name: 'Bon Sun', email: 'bon@dealer.test', role: '2', status: 1, is_activated: true };
const base = { location: 'Toronto, ON', memories_count: 0, users_count: 1, invited_users: [], labels: [], created_at: '2026-10-01T10:00:00Z', is_active: true, status: 1 };
// Bon's own row as his sign-in / properties list sends it (the API names Serpa as invited_by, with its logo).
const SERPA_LOGO = `${BASE}/pwa-icon-192.png`;
const INVITED_BY_SERPA = { id: 708, external_user_id: 889, name: 'Serpa Chrysler', email: 'serpa@dealer.test', profile_image: SERPA_LOGO };
const BONS_OWN = { ...base, id: 96, name: 'Bon Sun', unique_id: 'BS-96', username: 'bonsun', user_id: 966, parent_user_id: 889, is_creator: true, user_role: 'admin', property_type: 'external', account_type: 'external', account_created_for_property: true, can_manage: false, is_own_external_account: true, image: null, invited_by: INVITED_BY_SERPA };
const BONS_LOT = { ...base, id: 97, name: 'Bons Lot', unique_id: 'BL-97', user_id: 966, is_creator: true, user_role: 'owner', property_type: 'internal', account_type: 'internal', account_created_for_property: false, can_manage: true, is_own_external_account: false };
// Serpa's rows: one internal property, and Bon's account as Serpa sees it.
const SERPA_INTERNAL = { ...base, id: 12, name: 'Serpa Downtown', unique_id: 'SD-12', user_id: 889, is_creator: true, user_role: 'owner', property_type: 'internal', account_type: 'internal', account_created_for_property: false, can_manage: true };
const SERPA_SEES_BON = { ...base, id: 96, name: 'Bon Sun', unique_id: 'BS-96', user_id: 966, parent_user_id: 889, is_creator: false, user_role: 'admin', property_type: 'external', account_type: 'external', account_created_for_property: true, can_manage: true };
// Serpa's car, shown to Bon read-only (user_id = the main account).
const SERPA_CAR = { id: 501, user_id: 889, title: '2024 Jeep Grand Cherokee', price: '58900', category: 'new', images_count: 3, main_image: null, location: { formatted: 'Toronto, ON' }, spec_summary: 'STK# J501 / 12 km' };

// Bon's own car campaign made by sharing Serpa's car: its posts are Bon's own photos (memory_images); Serpa's car
// is a linked entry, read_only. Post 9002 is a photo tied to that car (car_id) — no select / edit / delete.
const IMG = `${BASE}/pwa-icon-512.png`;
// A website-catalogue product of the main account, shown to Bon read-only.
const SERPA_PRODUCT = { id: 31, title: 'All-Weather Floor Mats', price: '199', currency: 'CAD', price_label: '$199 CAD', category: 'Accessories', url: null, main_image: null, images_count: 0, spec_summary: '' };
// Bon's own campaign in his External account's feed (GET /properties/96/memories: no Serpa campaigns merged).
const BON_OWN_CAMPAIGN = { id: 801, title: 'Bon Test Drive Day', user_id: 966, property_id: 96, published: 1, category: { id: 5, name: 'Campaigns' }, photos: { count: 0 }, location: 'Toronto, ON', collaborators: [], user: { id: 966, name: 'Bon Sun' } };
const BON_CAR_CAMPAIGN = {
  id: 700, title: 'Vehicles Just for You', user_id: 966, is_car: 1, published: 1, category: { id: 'cars', name: 'Cars' },
  last_update_img: IMG, location: 'Toronto, ON', tags: [], collaborators: [], user: { id: 966, name: 'Bon Sun' },
  posts: [
    { id: 9001, image_link: IMG, image: IMG, type: 'image', parent_id: null, admin_approval: 1, name: 'bon-walkaround.jpg', title: 'Walkaround', user: { id: 966, name: 'Bon Sun' }, created_at: '2026-11-01T10:00:00Z', capture_date: '2026-11-01T10:00:00Z' },
    { id: 9002, car_id: 501, image_link: IMG, image: IMG, type: 'image', parent_id: null, admin_approval: 1, name: 'jeep-front.jpg', title: 'Jeep front', user: { id: 889, name: 'Serpa Chrysler' }, created_at: '2026-11-01T09:00:00Z', capture_date: '2026-11-01T09:00:00Z' },
  ],
  linked_memories: [
    { id: 501, user_id: 889, read_only: true, is_car: true, title: SERPA_CAR.title, cover_image: null, category: { id: 'cars', name: 'Cars' }, posts_count: 0, tags: [], location: 'Toronto', make: 'Jeep', model: 'Grand Cherokee', year: 2024, price: '58900', mileage: 12, stock_number: 'J501', collaborators: [] },
  ],
};
const BON_CAR_CAMPAIGN_CARD = { id: 700, title: BON_CAR_CAMPAIGN.title, user_id: 966, is_car: 1, category: { id: 'cars', name: 'Cars', color: '#0ea5e9' }, photos: { count: 2 }, last_update_img: IMG, location: { formatted: 'Toronto, ON' }, dates: { formatted_range: '' }, author: { name: 'Bon Sun' }, collaborators: [] };

const failures = [];
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

// who: the account the mocked API signs in / answers for. omitOwnRow: the API leaves Bon's row out (a deleted
// property). seed: localStorage on the first load (null = signed out, i.e. the sign-in page). extraRows: Bon's other
// properties.
async function open({ width = 1280, height = 900, who, omitOwnRow = false, extraRows = [], seed = null, path = '/', carCampaign = false }) {
  const state = { loginCalls: 0, propertyFetches: 0, carCampaign, imageDeletes: [], propertyFeeds: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([seedData]) => {
    if (sessionStorage.getItem('sl-seeded')) return; // only the first load: later loads keep what the app stored
    sessionStorage.setItem('sl-seeded', '1');
    localStorage.clear();
    if (!seedData) return;
    for (const [k, v] of Object.entries(seedData)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, [seed]);
  const ownedFor = () => (who === BON ? [...(omitOwnRow ? [] : [BONS_OWN]), ...extraRows] : [SERPA_INTERNAL]);
  const sharedFor = () => (who === BON ? [] : [SERPA_SEES_BON]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    // An .env with VITE_API_BASE_URL points the app at a remote API host: answered here too, never sent.
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
    if (process.env.SL_DEBUG) console.log('api', req.method(), p, url.search);
    if (p === '/send-otp') return route.fulfill({ json: { success: true, message: 'OTP sent', channel: 'email' } });
    if (p === '/verify-otp') return route.fulfill({ json: { success: true, verification_token: 'vt-1' } });
    if (p === '/login' && req.method() === 'POST') {
      state.loginCalls++;
      return route.fulfill({ json: { success: true, data: { user: who, token: who === BON ? 'bon-token' : 'serpa-token', collaborators: [], owned_properties: ownedFor(), shared_properties: sharedFor(), partial_admin_access: [] } } });
    }
    if (p === '/properties' && req.method() === 'GET') {
      state.propertyFetches++;
      const owned = ownedFor();
      const shared = sharedFor();
      return route.fulfill({ json: { success: true, data: { properties: [...owned, ...shared], owned_properties: owned, shared_properties: shared, owned_count: owned.length, shared_count: shared.length, total_count: owned.length + shared.length } } });
    }
    if (p === '/memories' && req.method() === 'GET' && state.carCampaign) {
      return route.fulfill({ json: { success: true, data: { all_memories: { data: [BON_CAR_CAMPAIGN_CARD] }, total_memories: 1 } } });
    }
    const feed = p.match(/^\/properties\/(\d+)\/memories$/);
    if (feed && req.method() === 'GET') {
      state.propertyFeeds.push(feed[1]);
      const mine = feed[1] === '96' ? [BON_OWN_CAMPAIGN] : [];
      return route.fulfill({ json: { status: 'success', data: { property: feed[1] === '96' ? BONS_OWN : SERPA_INTERNAL, user_role: 'admin', viewing_invited_content: false, inviter: null, memories: { data: mine, total: mine.length }, sidebar: { categories: { items: [] }, labels: { items: [] } } } } });
    }
    if (p === '/website-catalogue' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { available: true, connected: true, item_count: 1 } } });
    if (p === '/website-catalogue/items' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { items: [SERPA_PRODUCT], pagination: { current_page: 1, per_page: 500, total: 1, last_page: 1 } } } });
    if (p === '/memories/700' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { memory: BON_CAR_CAMPAIGN, linked_memories: BON_CAR_CAMPAIGN.linked_memories } } });
    const del = p.match(/^\/memory-images\/(.+)$/);
    if (del && req.method() === 'DELETE') {
      state.imageDeletes.push(`${del[1]}${url.search}`);
      return route.fulfill({ json: { success: true, message: 'Image deleted successfully.' } });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/cars' || p.startsWith('/cars?')) return route.fulfill({ json: { status: 200, data: { cars: [SERPA_CAR], pagination: { total: 1 }, filters: { categories: ['new'] } } } });
    // Dashboard widgets: no data (their own shapes; an empty list crashes some of them).
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => { pageErrors.push(e.message); if (process.env.SL_DEBUG) console.log('pageerror', e.stack); });
  if (process.env.SL_DEBUG) page.on('console', (m) => { const t = m.text(); if (/🏠|👤|pending|switch/i.test(t)) console.log('console', t.slice(0, 220)); });
  await page.goto(`${BASE}${path}`);
  return { context, page, state };
}

async function signIn(page, email) {
  const field = page.locator('input[type=email]').filter({ visible: true }).first();
  await field.waitFor({ state: 'visible', timeout: 40000 });
  await field.fill(email);
  await page.getByRole('button', { name: /Send OTP/ }).filter({ visible: true }).first().click();
  const otp = page.locator('#otp');
  await otp.waitFor({ state: 'visible', timeout: 10000 });
  await otp.fill('123456');
  await page.getByRole('button', { name: /Verify & Sign In/ }).click();
}

async function shot(page, file) {
  const path = `${OUT}/${file}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('shot', path);
}

// The signed-in app: its sidebar is up (Campaigns is in both views).
async function waitForApp(page) {
  try {
    await page.getByText('Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30000 });
  } catch (e) {
    await page.screenshot({ path: `${OUT}/debug-${Date.now()}.png` });
    console.log('url at failure:', page.url(), (await page.locator('body').innerText()).slice(0, 400));
    throw e;
  }
  await page.waitForTimeout(1500); // pending-switch / cached-view checks settle
}
const visibleText = (page, text) => page.getByText(text, { exact: true }).filter({ visible: true }).count();
const view = (page) => page.evaluate(() => ({ view: localStorage.getItem('view_type'), selected: localStorage.getItem('selected_property'), pending: localStorage.getItem('pending_property_switch') }));
async function accountView(page, tag) {
  const leads = await visibleText(page, 'Leads');
  const users = await visibleText(page, 'Users');
  const badge = await visibleText(page, 'Property');
  const v = await view(page);
  console.log(tag, JSON.stringify({ leads, users, badge, ...v }));
  expect(leads > 0 && users > 0, `${tag}: full account sidebar (Leads, Users)`);
  expect(badge === 0, `${tag}: no Property badge`);
  expect(v.view !== 'property' && !v.selected && !v.pending, `${tag}: account view stored, no property selected or pending`);
}
async function openProfileMenu(page) {
  await page.locator('[data-name="Dropdown"]').filter({ visible: true }).first().locator('*').first().click();
  await page.waitForTimeout(800);
}

// The chooser's External account row: "Bon Sun" with "Serpa Chrysler" under it.
const externalChoice = (page) => page.locator('button').filter({ hasText: 'Bon Sun' }).filter({ hasText: 'Serpa Chrysler' }).filter({ visible: true }).first();

// The External view: Property badge, Bon Sun + Serpa Chrysler and Serpa's logo in the header, and its sidebar.
async function externalView(page, tag, { desktop = true } = {}) {
  const v = await view(page);
  const selected = JSON.parse(v.selected || '{}');
  console.log(tag, JSON.stringify({ view: v.view, selected: selected.id, pending: v.pending }));
  expect(v.view === 'property' && selected.id === 96 && !v.pending, `${tag}: External account view stored (property 96)`);
  // The phone header shows only the account avatar (no property name / badge there, as before): desktop only.
  if (desktop) {
    expect(await visibleText(page, 'Property') > 0, `${tag}: Property badge`);
    expect(await visibleText(page, 'Bon Sun') > 0, `${tag}: header names Bon Sun`);
    expect(await visibleText(page, 'Serpa Chrysler') > 0, `${tag}: header names Serpa Chrysler`);
    expect(await page.locator(`img[src="${SERPA_LOGO}"]`).filter({ visible: true }).count() > 0, `${tag}: Serpa's logo as the avatar`);
    expect(await visibleText(page, 'Leads') > 0, `${tag}: Leads in the External account's sidebar`);
    expect(await visibleText(page, 'Media') > 0, `${tag}: Media in the sidebar`);
    expect(await visibleText(page, 'Users') === 0, `${tag}: no Users (property sidebar)`);
  }
}

try {
  // 1. Salesperson signs in: the account chooser offers his personal account and his External account, which is
  //    shown as representing Serpa. Picking it opens the External view.
  {
    const { page, context, state } = await open({ who: BON, path: '/login?prefill_email=bon@dealer.test' });
    await shot(page, '01-salesperson-sign-in');
    await signIn(page, 'bon@dealer.test');
    const choose = page.getByText('Choose Account', { exact: true }).filter({ visible: true }).first();
    await choose.waitFor({ state: 'visible', timeout: 15000 });
    expect(await page.getByText('Your Personal Account - Access your own campaigns').filter({ visible: true }).count() > 0, '1: chooser offers the personal account');
    // Chris calls it his External account: its own "External (1)" card; no Properties card (he has no property of his
    // own) and no "n internal, n external" line (two cards since 1 Nov).
    const props = page.getByText('External (1)', { exact: true }).filter({ visible: true }).first();
    expect(await props.count() > 0, '1: chooser offers External (1)');
    expect(await page.getByText(/^Properties \(/).filter({ visible: true }).count() === 0, '1: no Properties card');
    expect(await page.getByText(/internal, \d+ external/).filter({ visible: true }).count() === 0, '1: no "internal, external" line');
    await props.click();
    await page.waitForTimeout(400);
    // The personal card is named "Bon Sun" too: the External account is the row naming Serpa Chrysler.
    const externalRow = externalChoice(page);
    expect(await externalRow.count() > 0, '1: chooser lists the External account "Bon Sun · Serpa Chrysler"');
    expect(await externalRow.locator(`img[src="${SERPA_LOGO}"]`).count() > 0, '1: ... with Serpa\'s logo');
    await shot(page, '02-salesperson-account-choice');
    await externalRow.click();
    await waitForApp(page);
    expect(state.loginCalls === 1, '1: signed in once');
    // Campaigns opens on Newsletters (the External account has the Newsletters | Storeels switch); Storeels shows the cards.
    expect(await page.getByRole('radio', { name: /^Newsletters/ }).filter({ visible: true }).count() > 0, '1: Newsletters on Campaigns');
    await page.getByRole('radio', { name: /^Storeels/ }).filter({ visible: true }).first().click();
    await page.getByText(SERPA_CAR.title).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await page.getByText(SERPA_PRODUCT.title).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    await externalView(page, '1 External view');
    expect(state.propertyFeeds.includes('96'), '1: External view reads its own feed (GET /properties/96/memories)');
    expect(await page.getByText(SERPA_CAR.title).filter({ visible: true }).count() > 0, '1: Serpa\'s car shows in the External view');
    expect(await page.getByText(SERPA_PRODUCT.title).filter({ visible: true }).count() > 0, '1: Serpa\'s catalogue product shows in the External view');
    expect(await page.getByText(BON_OWN_CAMPAIGN.title).filter({ visible: true }).count() > 0, '1: Bon\'s own campaign shows');
    await shot(page, '03-external-view-campaigns');
    // A car card in the External view is read-only: no edit / delete on it.
    const carCard = page.locator('.group', { hasText: SERPA_CAR.title }).filter({ visible: true }).first();
    await carCard.hover().catch(() => {});
    expect(await carCard.locator('button[aria-label*="Delete" i], button[title*="Delete" i]').count() === 0, '1: no delete on Serpa\'s car card');
    // Leads opens from the External view and stays in it.
    await page.getByText('Leads', { exact: true }).filter({ visible: true }).first().click();
    await page.waitForTimeout(1500);
    const lv = await view(page);
    expect(/\/leads/.test(page.url()) && lv.view === 'property', `1: Leads opens in the External view (${page.url()})`);
    await shot(page, '04-external-view-leads');
    // Profile menu: the External account's card and "Back to Bon Sun".
    await openProfileMenu(page);
    expect(await page.getByText('Back to Bon Sun').filter({ visible: true }).count() > 0, '1: Profile menu offers Back to Bon Sun');
    await shot(page, '05-external-view-profile-menu');
    await page.getByText('Back to Bon Sun').filter({ visible: true }).first().click();
    await page.waitForTimeout(1500);
    await accountView(page, '1 back to personal');
    await openProfileMenu(page);
    expect(await page.getByText('External (1)', { exact: true }).filter({ visible: true }).count() > 0, '1: personal Profile menu has the External (1) dropdown');
    expect(await page.getByText(/^Property Accounts|^Properties \(/).filter({ visible: true }).count() === 0, '1: no Property Accounts / Properties dropdown');
    await page.getByText('External (1)', { exact: true }).filter({ visible: true }).first().click();
    await page.waitForTimeout(400);
    const menuExternal = page.locator('button').filter({ hasText: 'Bon Sun' }).filter({ hasText: 'Serpa Chrysler' }).filter({ visible: true });
    expect(await menuExternal.count() > 0, '1: Profile menu lists "Bon Sun · Serpa Chrysler" under External (1)');
    expect(await menuExternal.first().locator(`img[src="${SERPA_LOGO}"]`).count() > 0, '1: ... with Serpa\'s logo');
    await shot(page, '06-personal-profile-menu-lists-external');
    // Picking it there opens the External view again.
    await menuExternal.first().click();
    await waitForApp(page);
    await externalView(page, '1 External view from the Profile menu');
    await shot(page, '06b-external-view-from-profile-menu');
    await context.close();
  }

  // 2. Salesperson signs in and picks his personal account: the full account view.
  {
    const { page, context } = await open({ who: BON, path: '/login?prefill_email=bon@dealer.test' });
    await signIn(page, 'bon@dealer.test');
    await page.getByText('Your Personal Account - Access your own campaigns').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 });
    await page.getByText('Your Personal Account - Access your own campaigns').filter({ visible: true }).first().click();
    await waitForApp(page);
    await accountView(page, '2 salesperson picks personal');
    await shot(page, '07-salesperson-personal-account');
    await context.close();
  }

  // 3. Reload with the External view stored: it is restored (no longer reset to the personal account).
  {
    const { page, context } = await open({ who: BON, seed: { stasht_token: 'bon-token', stasht_user: BON, view_type: 'property', selected_property: BONS_OWN, stasht_campaigns_view: 'storeels' } });
    await waitForApp(page);
    await page.waitForTimeout(1500);
    await externalView(page, '3 stored External view restored');
    await shot(page, '08-external-view-restored');
    await context.close();
  }

  // 4. Pending switch (invite sign-up ?property=1 → "first", or an id) opens the External view as before; a pending
  //    switch to a property that is gone is cleared (no endless "Loading Stasht Studio...").
  {
    const { page, context } = await open({ who: BON, seed: { stasht_token: 'bon-token', stasht_user: BON, view_type: 'personal', pending_property_switch: 'first' } });
    await waitForApp(page);
    await externalView(page, '4 pending "first"');
    await context.close();
  }
  {
    const { page, context } = await open({ who: BON, omitOwnRow: true, seed: { stasht_token: 'bon-token', stasht_user: BON, view_type: 'personal', pending_property_switch: '96' } });
    await waitForApp(page);
    await accountView(page, '4b pending switch to a property that is gone');
    await context.close();
  }

  // 5. Main account: account choice has two cards, Properties (1) + External (1) (1 Nov: "INTERNAL" reads
  //    "PROPERTIES"); picking the internal property opens its property view (Property badge, no Leads there).
  {
    const { page, context } = await open({ who: SERPA, path: '/login?prefill_email=serpa@dealer.test' });
    await signIn(page, 'serpa@dealer.test');
    const props = page.getByText('Properties (1)', { exact: true }).filter({ visible: true }).first();
    await page.getByText('Choose Account', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 });
    await props.waitFor({ state: 'visible', timeout: 15000 });
    expect(await page.getByText('External (1)', { exact: true }).filter({ visible: true }).count() > 0, '5: main account sees External (1) (its salesperson)');
    expect(await page.getByText(/^Internal \(/).filter({ visible: true }).count() === 0, '5: no "Internal" label');
    await props.click();
    await page.waitForTimeout(400);
    await shot(page, '09-main-account-choice-properties');
    await page.getByText('Serpa Downtown').filter({ visible: true }).first().click();
    await waitForApp(page);
    await page.waitForTimeout(1500);
    const v = await view(page);
    const badge = await visibleText(page, 'Property');
    console.log('5 main → internal', JSON.stringify({ badge, ...v }));
    expect(v.view === 'property' && JSON.parse(v.selected || '{}').id === 12, '5: main account opens its internal property view');
    expect(badge > 0, '5: Property badge in the internal property view');
    expect(await visibleText(page, 'Leads') === 0, '5: no Leads in an internal property view');
    await shot(page, '10-main-account-internal-property-view');
    await context.close();
  }

  // 6. Main account's Profile menu still counts both properties.
  {
    const { page, context } = await open({ who: SERPA, seed: { stasht_token: 'serpa-token', stasht_user: SERPA, view_type: 'personal' } });
    await waitForApp(page);
    await accountView(page, '6 main account personal');
    await openProfileMenu(page);
    expect(await page.getByText('Properties (1)', { exact: true }).filter({ visible: true }).count() > 0, '6: main Profile menu: Properties (1)');
    expect(await page.getByText('External (1)', { exact: true }).filter({ visible: true }).count() > 0, '6: main Profile menu: External (1)');
    await context.close();
  }

  // 7. Phone: the chooser fits and opens the External view.
  {
    const { page, context } = await open({ width: 390, height: 844, who: BON, path: '/login?prefill_email=bon@dealer.test' });
    await signIn(page, 'bon@dealer.test');
    await page.getByText('Choose Account', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 });
    await page.getByText('External (1)', { exact: true }).filter({ visible: true }).first().click();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '7 phone: chooser has no sideways scroll');
    await shot(page, '11-phone-account-choice');
    await externalChoice(page).click();
    await page.waitForTimeout(4000);
    await externalView(page, '7 phone External view', { desktop: false });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '7 phone: External view has no sideways scroll');
    await shot(page, '12-phone-external-view');
    await context.close();
  }

  // 8. Users → External lists his own External account again; Properties lists his internal one.
  {
    const { page, context } = await open({ who: BON, extraRows: [BONS_LOT], path: '/users', seed: { stasht_token: 'bon-token', stasht_user: BON, view_type: 'personal' } });
    await page.evaluate(() => sessionStorage.setItem('users_open_tab', 'external'));
    await page.goto(`${BASE}/users`);
    await page.locator('tr', { hasText: 'Bon Sun' }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(500);
    const own = await page.locator('tr', { hasText: 'Bon Sun' }).filter({ visible: true }).count();
    console.log('8 users/external', JSON.stringify({ own }));
    expect(own > 0, '8: Users → External lists his own External account');
    await shot(page, '13-users-external-own-row');
    await page.getByRole('button', { name: /^Properties( \d+)?$/ }).filter({ visible: true }).first().click();
    await page.waitForTimeout(500);
    expect(await page.locator('tr', { hasText: 'Bons Lot' }).filter({ visible: true }).count() > 0, '8: Users → Properties lists his internal property');
    await openProfileMenu(page);
    expect(await page.getByText('Properties (1)', { exact: true }).filter({ visible: true }).count() > 0, '8: Profile menu: Properties (1) (Bons Lot)');
    expect(await page.getByText('External (1)', { exact: true }).filter({ visible: true }).count() > 0, '8: Profile menu: External (1) (his External account)');
    await context.close();
  }

  // 11. Bon's own car campaign (shared from Serpa's car): his own photo keeps edit / delete (deleted as a memory
  //     image, no is_car); the photo of Serpa's read-only car has no select / edit / delete.
  {
    const { page, context, state } = await open({ who: BON, carCampaign: true, path: '/memories', seed: { stasht_token: 'bon-token', stasht_user: BON, view_type: 'personal', stasht_campaigns_view: 'storeels' } });
    await waitForApp(page);
    await page.getByText(BON_CAR_CAMPAIGN.title).filter({ visible: true }).first().click();
    const media = page.getByText('bon-walkaround.jpg', { exact: true }).filter({ visible: true }).first();
    await media.waitFor({ state: 'visible', timeout: 25000 }).catch(async (e) => { await shot(page, 'debug-11'); console.log((await page.locator('body').innerText()).slice(0, 600)); throw e; });
    await media.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await shot(page, '14-car-campaign-view');
    const card = (name) => page.locator('.group', { hasText: name }).filter({ visible: true }).first();
    const own = card('bon-walkaround.jpg');
    const parents = card('jeep-front.jpg');
    await own.hover();
    await page.waitForTimeout(300);
    const ownTrash = await own.locator('button.text-red-600').count();
    await shot(page, '15-car-campaign-own-photo-hover');
    await parents.hover();
    await page.waitForTimeout(300);
    const parentTrash = await parents.locator('button.text-red-600').count();
    const parentButtons = await parents.locator('.absolute.top-2.right-2 button').count();
    await shot(page, '16-car-campaign-parent-car-photo-hover');
    console.log('11 car campaign', JSON.stringify({ ownTrash, parentTrash, parentButtons }));
    expect(ownTrash > 0, '11: own photo in his car campaign keeps Delete');
    expect(parentTrash === 0 && parentButtons === 0, '11: photo of the main account\'s car: no edit / delete');
    await own.hover();
    await own.locator('button.text-red-600').first().click();
    const confirm = page.getByRole('alertdialog').getByRole('button', { name: /^Delete/ });
    await confirm.waitFor({ state: 'visible', timeout: 5000 });
    await confirm.click();
    await page.waitForTimeout(1200);
    console.log('11 deletes', JSON.stringify(state.imageDeletes));
    expect(state.imageDeletes.length === 1 && state.imageDeletes[0] === '9001', `11: own photo deleted as a memory image, no is_car (${state.imageDeletes})`);
    expect(!(await page.locator('[data-sonner-toast]').evaluateAll((els) => els.map((e) => e.textContent))).some((t) => /Failed|permission/i.test(t || '')), '11: no error toast');
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
