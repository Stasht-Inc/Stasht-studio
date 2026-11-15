// External-only accounts + Claimed leads (Chris/Deepak 13 Nov 2026), mocked API, 1280 + 390.
// node tests/properties/ui/external-only-claimed.mjs   (dev server: SL_BASE, default http://localhost:5328). Built from salesperson-landing.mjs.
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
const BASE = process.env.SL_BASE || 'http://localhost:5328';
const OUT = process.env.SL_SHOTS || '/private/tmp/claude-501/external-only-ui/shots';
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

// Leads as the API sends them to Bon (13 Nov 2026): a new one to accept, his own, and one Brenna claimed (locked).
const now = '2026-11-13T10:00:00Z';
const leadBase = { source: 'widget', story: null, campaign_deleted: false, source_list: null, status: null, engagement: 1, comments: [], messages_count: 1, sent_count: 0, received_count: 1, comment_unread_count: 0, last_engaged_at: now, first_seen_at: now, last_activity_at: now, property_id: null, notes: null, can_assign: false, can_delete: false, account: { owner_id: 889, name: 'Serpa Chrysler' }, released_from: null };
const LEADS = [
  { ...leadBase, id: 11, user: { id: null, name: 'Jordan Price', email: null, phone_number: '+14165550299' }, assignee: { id: 889, name: 'Serpa Chrysler', profile_color: '#888' }, waiting: true, can_accept: true, can_message: false, is_rollup: true, unread_count: 1, latest_message: { body: 'Is the Jeep in stock?', direction: 'inbound', channel: 'widget', sender_name: null, sent_at: now, attachment_name: null }, claimed: false, can_open: true, can_remove: false },
  { ...leadBase, id: 12, user: { id: null, name: 'Kim Lee', email: 'kim@example.test', phone_number: '+14165550298' }, assignee: { id: 501, name: 'Brenna Smith', profile_color: '#999' }, waiting: false, can_accept: false, can_message: false, is_rollup: true, unread_count: 0, latest_message: null, claimed: true, can_open: false, can_remove: true },
  { ...leadBase, id: 13, user: { id: null, name: 'Sam Own', email: null, phone_number: '+14165550297' }, assignee: { id: 966, name: 'Bon Sun', profile_color: '#777' }, waiting: false, can_accept: false, can_message: true, is_rollup: false, unread_count: 0, latest_message: { body: 'Thanks!', direction: 'inbound', channel: 'sms', sender_name: null, sent_at: now, attachment_name: null }, claimed: false, can_open: true, can_remove: false, account: null },
];

const failures = [];
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

// who: the account the mocked API signs in / answers for. omitOwnRow: the API leaves Bon's row out (a deleted
// property). seed: localStorage on the first load (null = signed out, i.e. the sign-in page). extraRows: Bon's other
// properties.
async function open({ width = 1280, height = 900, who, omitOwnRow = false, extraRows = [], seed = null, path = '/', carCampaign = false }) {
  const state = { leadQueries: [], removed: [], threadOpens: [], loginCalls: 0, propertyFetches: 0, carCampaign, imageDeletes: [], propertyFeeds: [] };
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
    if (p === '/leads' && req.method() === 'GET') {
      state.leadQueries.push(url.search);
      const rows = LEADS.filter((l) => !state.removed.includes(l.id));
      return route.fulfill({ json: { total: rows.length, status_counts: {}, messages_total: 0, tab_counts: { open: rows.length, closed: 0 }, leads: rows, team_leads: { staff: true, can_see_all: false, scope: 'mine_and_new' } } });
    }
    if (p === '/leads/unread-count') return route.fulfill({ json: { total_unread_messages: 1, total_unread_comments: 0, total_unread: 1 } });
    const rm = p.match(/^\/leads\/(\d+)\/remove-from-my-list$/);
    if (rm && req.method() === 'POST') { state.removed.push(Number(rm[1])); return route.fulfill({ json: { lead_id: Number(rm[1]), removed: true } }); }
    if (/^\/leads\/\d+\/messages$/.test(p)) { state.threadOpens.push(p); return route.fulfill({ json: { messages: [] } }); }
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
  await page.getByRole('button', { name: /Send (OTP|Verification Code)/ }).filter({ visible: true }).first().click();
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
  for (const [width, height, tag] of [[1280, 900, 'd'], [390, 844, 'm']]) {
    // 1. Bon (account created for Serpa's property 96, no other choice) signs in: no chooser, straight to External.
    {
      const { page, context } = await open({ width, height, who: BON, path: '/login?prefill_email=bon@dealer.test' });
      await signIn(page, 'bon@dealer.test');
      await page.waitForTimeout(2500);
      expect(await page.getByText('Choose Account', { exact: true }).filter({ visible: true }).count() === 0, `${tag}1: no account chooser`);
      expect(await page.getByText('Your Personal Account - Access your own campaigns').filter({ visible: true }).count() === 0, `${tag}1: no Personal account offered`);
      await waitForApp(page);
      await externalView(page, `${tag}1 lands in External`, { desktop: width >= 1024 });
      await shot(page, `${tag}1-lands-external`);
      if (width >= 1024) {
        await openProfileMenu(page);
        expect(await page.getByText('Back to Bon Sun').filter({ visible: true }).count() === 0, `${tag}1: Profile menu has no "Back to Bon Sun"`);
        expect(await page.getByText('Settings', { exact: true }).filter({ visible: true }).count() > 0, `${tag}1: Profile menu keeps Settings`);
        await shot(page, `${tag}1-profile-menu`);
      }
      await context.close();
    }
    // 1b. Bon also has his own internal lot: the chooser shows, but with no Personal row.
    {
      const { page, context } = await open({ width, height, who: BON, path: '/login?prefill_email=bon@dealer.test', extraRows: [BONS_LOT] });
      await signIn(page, 'bon@dealer.test');
      const choose = page.getByText('Choose Account', { exact: true }).filter({ visible: true }).first();
      await choose.waitFor({ state: 'visible', timeout: 15000 });
      expect(await page.getByText('Your Personal Account - Access your own campaigns').filter({ visible: true }).count() === 0, `${tag}1b: chooser without a Personal row`);
      expect(await externalChoice(page).count() > 0, `${tag}1b: External account open and listed`);
      await shot(page, `${tag}1b-chooser-no-personal`);
      await context.close();
    }
    // 2. A stored personal view (old tab / stale) is moved to the External view.
    {
      const seed = { stasht_token: 'bon-token', stasht_user: BON, view_type: 'personal' };
      const { page, context } = await open({ width, height, who: BON, seed });
      await waitForApp(page);
      await page.waitForTimeout(1500);
      await externalView(page, `${tag}2 stale personal -> External`, { desktop: width >= 1024 });
      await context.close();
    }
    // 3. Leads in the External view: Open lead to accept, own lead, and Brenna's claimed lead (locked) with Remove.
    {
      const seed = { stasht_token: 'bon-token', stasht_user: BON, view_type: 'property', selected_property: BONS_OWN };
      const { page, context, state } = await open({ width, height, who: BON, seed, path: '/leads' });
      await waitForApp(page);
      await page.getByText('Kim Lee').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 20000 });
      expect(await page.locator('[data-claimed-badge]').filter({ visible: true }).count() > 0, `${tag}3: "Claimed" shown on Brenna's lead`);
      expect(await page.getByText('Brenna', { exact: true }).filter({ visible: true }).count() > 0, `${tag}3: who claimed it, in small gray text`);
      expect(await page.locator('[data-open-badge]').filter({ visible: true }).count() > 0, `${tag}3: the new lead is Open`);
      await shot(page, `${tag}3-leads-claimed`);
      await page.getByText('Kim Lee').filter({ visible: true }).first().click();
      await page.waitForTimeout(800);
      expect(state.threadOpens.every((x) => !x.includes('/12/')), `${tag}3: the claimed lead's conversation is not opened`);
      const row = width >= 1024 ? page.locator('tr', { hasText: 'Kim Lee' }).first() : page.locator('div.rounded-xl', { hasText: 'Kim Lee' }).last();
      await row.hover().catch(() => {});
      const remove = row.locator('[data-testid="lead-remove"]').filter({ visible: true }).first();
      expect(await remove.count() > 0, `${tag}3: Remove offered on the claimed lead`);
      if (await remove.count() > 0) {
        await remove.hover();
        await page.waitForTimeout(300);
        const bg = await remove.evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(!/108, 96, 255/.test(bg), `${tag}3: Remove hover is gray, not purple (${bg})`);
        await shot(page, `${tag}3-leads-remove-hover`);
        await remove.click();
        await page.waitForTimeout(1200);
      }
      expect(state.removed.length === 1 && state.removed[0] === 12, `${tag}3: Remove sent for lead 12 only`);
      expect(await page.getByText('Kim Lee').filter({ visible: true }).count() === 0, `${tag}3: gone from the list`);
      expect(await page.getByText('Jordan Price').filter({ visible: true }).count() > 0 && await page.getByText('Sam Own').filter({ visible: true }).count() > 0, `${tag}3: the others stay`);
      expect(await page.locator('[data-testid="lead-remove"]').count() === 0, `${tag}3: no Remove on the other rows`);
      await shot(page, `${tag}3-leads-after-remove`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(!overflow, `${tag}3: no horizontal page scroll`);
      await context.close();
    }
  }
} catch (e) {
  failures.push(String((e && e.stack) || e));
  console.log(e);
}
await browser.close();
console.log('page errors:', pageErrors.length, pageErrors.slice(0, 5));
console.log(failures.length ? `FAILURES ${failures.length}:\n` + failures.join('\n') : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
