// Chris 16 Nov 2026 (C1, C2), mocked API, 1280 + 390:
//  C1. "+ Send Message": "Send as" (not "Send from"), placeholder "Choose a business", the hint under it, and it starts on
//      the business's own property (Royal Wood's shop) in the main account — still changeable; Send carries it.
//  C2. "+ Products" (green) to the LEFT of "+ Campaign" (light purple) in "+ Send Message" and in the lead chat
//      composer; "+ Products" opens the picker on its Products tab, "+ Campaign" as before (Vehicles first).
// node tests/leads/ui/send-message-16nov.mjs   (dev server: SM_BASE, default http://localhost:5402; SM_SHOTS = screenshot dir)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.SM_BASE || 'http://localhost:5402';
const OUT = process.env.SM_SHOTS || '/private/tmp/claude-501/send-message-16nov/shots';
mkdirSync(OUT, { recursive: true });

const OWNER = { id: 708, external_user_id: 959, name: 'TheRoyalWoodShop', email: 'owner@royalwood.test', role: '2', status: 1, is_activated: true };
const now = '2026-11-16T10:00:00Z';
const KIM = { id: 12, source: 'memory', user: { id: null, name: 'Kim Lee', email: 'kim@example.test', phone_number: '+14165550298' }, story: null, campaign_deleted: false, source_list: null, status: null, engagement: 1, comments: [], messages_count: 1, sent_count: 0, received_count: 1, unread_count: 0, comment_unread_count: 0, last_engaged_at: now, first_seen_at: now, last_activity_at: now, property_id: null, assignee: { id: 959, name: 'TheRoyalWoodShop' }, latest_message: { body: 'Do you have MDF panels?', direction: 'inbound', channel: 'sms', sender_name: null, sent_at: now, attachment_name: null }, notes: null, can_message: true, is_rollup: false, can_assign: true, can_accept: false, account: null, can_delete: true, waiting: false, released_from: null, claimed: false, can_open: true, can_remove: false, joined: false, can_join: false, can_mark_unread: false };
// Royal Wood's main account: a team property it was added to first, Chris Becks' External account, then its own shop.
const MY_PROPS = [{ id: 11, name: 'Other store' }, { id: 12, name: 'Chris Becks' }, { id: 10, name: 'TheRoyalWoodShop' }];
const FULL_ROWS = [
  { id: 10, name: 'TheRoyalWoodShop', is_creator: true, account_type: 'internal', user_id: 959 },
  { id: 11, name: 'Other store', is_creator: false, account_type: 'internal', user_id: 400 },
  { id: 12, name: 'Chris Becks', is_creator: false, account_type: 'external', account_created_for_property: true, user_id: 1300 },
];
const ITEMS = [{ id: 501, title: 'Fine Line Router Carved MDF', category: 'MDF', price_label: '$120', main_image: null }];
const CARS = [{ id: 901, year: 2024, make: 'Jeep', model: 'Wrangler', title: '2024 Jeep Wrangler', category: 'SUV', price: 45000, images: [] }];

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }) {
  const state = { starts: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([seed]) => {
    if (sessionStorage.getItem('sm-seeded')) return;
    sessionStorage.setItem('sm-seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, [{ stasht_token: 'owner-token', stasht_user: OWNER, view_type: 'personal' }]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    const remoteApi = !local && url.pathname.startsWith('/api/react/');
    if (!local && !remoteApi) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: 'window.Stripe=function(){return{elements:function(){return{create:function(){return{mount:function(){},on:function(){},destroy:function(){},unmount:function(){}}},getElement:function(){return null}}}}};' });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: 'window.gapi={load:function(n,c){var f=typeof c==="function"?c:(c&&c.callback);if(f)f();}};' });
      return route.abort('blockedbyclient');
    }
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/properties' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { properties: FULL_ROWS, owned_properties: FULL_ROWS.slice(0, 1), shared_properties: FULL_ROWS.slice(1), owned_count: 1, shared_count: 2, total_count: 3 } } });
    if (p === '/storeels/my-properties') return route.fulfill({ json: { success: true, properties: MY_PROPS } });
    if (p === '/leads' && req.method() === 'GET') return route.fulfill({ json: { total: 1, status_counts: {}, messages_total: 0, tab_counts: { open: 1, closed: 0 }, leads: [KIM], team_leads: null } });
    if (p === '/leads/unread-count') return route.fulfill({ json: { total_unread_messages: 0, total_unread_comments: 0, total_unread: 0 } });
    // Both kinds, so the picker has its Vehicles / Products switch.
    if (p === '/leads/campaign-sources') return route.fulfill({ json: { success: true, data: { vehicles: true, products: true } } });
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: true, item_count: ITEMS.length } } });
    if (p === '/website-catalogue/items') return route.fulfill({ json: { success: true, data: { items: ITEMS, pagination: { last_page: 1 } } } });
    if (p.startsWith('/cars')) return route.fulfill({ json: { success: true, data: { cars: CARS, filters: { categories: ['SUV'] }, pagination: { total: 1 } } } });
    if (p === '/leads/start-conversation' && req.method() === 'POST') {
      const b = req.postDataJSON();
      state.starts.push(b);
      return route.fulfill({ json: { success: true, data: { lead_id: 12, created: false } } });
    }
    if (/^\/leads\/12\/messages$/.test(p)) return route.fulfill({ json: { messages: [{ id: 1, parent_message_id: null, direction: 'inbound', channel: 'sms', body: 'Do you have MDF panels?', subject: null, status: 'received', is_ai: false, is_read: true, sent_at: now, attachments: [] }], events: [], visitor_online: false, widget_ai: null } });
    if (/^\/leads\/\d+\/messages\/mark-read$/.test(p)) return route.fulfill({ json: { marked_read: 0 } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/leads`);
  return { context, page, state };
}

const shot = async (page, file) => { const path = `${OUT}/${file}.png`; await page.screenshot({ path }); console.log('shot', path); };
const colours = (loc) => loc.evaluate((el) => { const s = getComputedStyle(el); return `${s.backgroundColor}|${s.color}|${s.borderColor}`; });
const isGreen = (c) => /240, 253, 244/.test(c) && /21, 128, 61/.test(c); // green-50 bg, green-700 words
const isLightPurple = (c) => /250, 245, 255/.test(c) && /90, 79, 229/.test(c); // purple-50 bg, #5A4FE5 words
const leftOf = async (a, b) => { const [x, y] = [await a.boundingBox(), await b.boundingBox()]; return x && y && x.x + x.width <= y.x + 1 && Math.abs(x.y - y.y) < 4; };

try {
  for (const [width, height, tag] of [[1280, 900, 'd'], [390, 844, 'm']]) {
    const { page, context, state } = await open({ width, height });
    await page.getByText('Kim Lee').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 40000 });

    // ---- C1 + C2 in "+ Send Message"
    const sendMessage = page.getByRole('button', { name: /Send Message/ }).filter({ visible: true }).first();
    if (await sendMessage.count()) await sendMessage.click();
    else {
      // Phone: Send Message sits in the + menu (Chris 27 Oct).
      await page.locator('nav.phone-bottom-bar-pin button.rounded-full').first().click();
      await page.getByRole('button', { name: /Send Message/ }).filter({ visible: true }).first().click();
    }
    const dlg = page.getByRole('dialog', { name: 'Start a new message' });
    await dlg.waitFor({ state: 'visible', timeout: 15000 });
    const sendAs = dlg.getByRole('combobox', { name: 'Send as' });
    await sendAs.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(400);
    expect(await dlg.getByText('Send from').count() === 0, `${tag}C1: no "Send from" label`);
    expect(/TheRoyalWoodShop/.test(await sendAs.innerText()), `${tag}C1: starts on the business's own property (got "${(await sendAs.innerText()).trim()}")`);
    expect(await dlg.getByText('Which business this conversation is filed under. Its team sees it in Leads.').count() === 1, `${tag}C1: hint under "Send as"`);
    expect(await dlg.getByText(/dealership/i).count() === 0, `${tag}C1: no "dealership" wording`);

    const products = dlg.getByRole('button', { name: 'Add products to your message' });
    const campaign = dlg.getByRole('button', { name: /^Campaign/ });
    await products.waitFor({ state: 'visible', timeout: 10000 });
    expect(await leftOf(products, campaign), `${tag}C2: "+ Products" left of "+ Campaign" in Send Message`);
    const pc = await colours(products); const cc = await colours(campaign);
    expect(isGreen(pc), `${tag}C2: "+ Products" green (${pc})`);
    expect(isLightPurple(cc), `${tag}C2: "+ Campaign" light purple (${cc})`);
    await shot(page, `sm16-${tag}1-send-message`);

    // Changeable: open the list and pick another business.
    await sendAs.click();
    await page.getByRole('option', { name: 'Other store' }).click();
    expect(/Other store/.test(await sendAs.innerText()), `${tag}C1: "Send as" can be changed`);
    await sendAs.click();
    await page.getByRole('option', { name: 'TheRoyalWoodShop' }).click();

    // "+ Products" → picker on Products.
    await products.click();
    const picker = page.getByRole('dialog', { name: 'Share Campaign' });
    await picker.getByText('Fine Line Router Carved MDF').waitFor({ state: 'visible', timeout: 15000 });
    expect(await picker.getByRole('button', { name: 'Products', pressed: true }).count() === 1, `${tag}C2: "+ Products" opens on the Products tab`);
    await shot(page, `sm16-${tag}2-products-picker`);
    await page.keyboard.press('Escape');
    await picker.waitFor({ state: 'hidden', timeout: 5000 });
    // "+ Campaign" → as before: Vehicles first for an account with both.
    await campaign.click();
    await picker.getByText(/Wrangler/).first().waitFor({ state: 'visible', timeout: 15000 });
    expect(await picker.getByRole('button', { name: 'Vehicles', pressed: true }).count() === 1, `${tag}C2: "+ Campaign" still opens as before (Vehicles)`);
    await page.keyboard.press('Escape');
    await picker.waitFor({ state: 'hidden', timeout: 5000 });

    // Send carries the picked business.
    await dlg.locator('#sm-phone').fill('4165550298');
    await dlg.getByRole('button', { name: /^Send$/ }).click();
    await page.waitForTimeout(800);
    expect(state.starts.length === 1 && String(state.starts[0].property_id) === '10', `${tag}C1: Send files it under the picked business (${JSON.stringify(state.starts[0] && state.starts[0].property_id)})`);
    await dlg.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

    // ---- C2 in the lead chat composer
    await page.getByText('Kim Lee').filter({ visible: true }).first().click();
    const box = page.getByPlaceholder(/Type a message to Kim/).filter({ visible: true }).first();
    await box.waitFor({ state: 'visible', timeout: 20000 });
    const cProducts = page.getByRole('button', { name: 'Add products to your message' }).filter({ visible: true }).first();
    const cCampaign = page.getByRole('button', { name: 'Add a campaign to your message' }).filter({ visible: true }).first();
    await cProducts.waitFor({ state: 'visible', timeout: 10000 });
    expect(await leftOf(cProducts, cCampaign), `${tag}C2: composer "+ Products" left of "+ Campaign"`);
    expect(isGreen(await colours(cProducts)), `${tag}C2: composer "+ Products" green`);
    expect(isLightPurple(await colours(cCampaign)), `${tag}C2: composer "+ Campaign" light purple`);
    await shot(page, `sm16-${tag}3-composer`);
    await cProducts.click();
    await picker.getByText('Fine Line Router Carved MDF').waitFor({ state: 'visible', timeout: 15000 });
    expect(await picker.getByRole('button', { name: 'Products', pressed: true }).count() === 1, `${tag}C2: composer "+ Products" opens on Products`);
    await page.keyboard.press('Escape');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(!overflow, `${tag}: no horizontal page scroll`);
    await context.close();
  }
} catch (e) {
  failures.push(String((e && e.stack) || e));
  console.log(e);
}
await browser.close();
console.log('page errors:', pageErrors.length, pageErrors.slice(0, 5));
console.log(failures.length ? `FAILURES ${failures.length}:\n` + failures.join('\n') : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
