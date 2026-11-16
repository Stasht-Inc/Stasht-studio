// Deepak 16 Nov 2026 (F1), mocked API, 1280 + 390: Leads "+ Products" lists and sends the account's MANUAL products.
//  A. Manual products only (no website catalogue, no cars): "+ Products" shows in "+ Send Message"; the picker lists the
//     active manual products with a photo (out of stock too), leaves out the photo-less one; Send carries the pick.
//  B. Website + manual: the lead chat composer's "+ Products" lists both; Add → campaign-draft with the manual id;
//     Send (the composer's channel: email here) → messages/{channel} with campaign {kind: product, ids}.
//  C. An API from before F1 ({vehicles, products} only): website products only, exactly as before.
// node tests/leads/ui/manual-products-16nov.mjs   (dev server: SM_BASE, default http://localhost:5401; SM_SHOTS = screenshot dir)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.SM_BASE || 'http://localhost:5401';
const OUT = process.env.SM_SHOTS || '/private/tmp/claude-501/manual-products-16nov/shots';
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
const MANUAL = [
  { id: 1001, user_id: 959, read_only: false, origin: 'manual', status: 'active', stock_status: 'in_stock', badge: 'active', title: 'Walnut Chair', price: '450.00', compare_at_price: null, currency: 'USD', price_label: '$450 USD', compare_at_label: '', price_on_request: false, show_price: true, main_image: null, images_count: 2, category: null, categories: [{ id: 3, name: 'Chairs' }], sku: null, brand: null, url: null, updated_at: now },
  { id: 1002, user_id: 959, read_only: false, origin: 'manual', status: 'active', stock_status: 'out_of_stock', badge: 'out_of_stock', title: 'Oak Bench', price: null, compare_at_price: null, currency: 'USD', price_label: '', compare_at_label: '', price_on_request: true, show_price: true, main_image: null, images_count: 1, category: null, categories: [], sku: null, brand: null, url: null, updated_at: now },
  { id: 1003, user_id: 959, read_only: false, origin: 'manual', status: 'active', stock_status: 'in_stock', badge: 'active', title: 'No Photo Stool', price: '90.00', compare_at_price: null, currency: 'USD', price_label: '$90 USD', compare_at_label: '', price_on_request: false, show_price: true, main_image: null, images_count: 0, category: null, categories: [], sku: null, brand: null, url: null, updated_at: now },
];
const CARS = [{ id: 901, year: 2024, make: 'Jeep', model: 'Wrangler', title: '2024 Jeep Wrangler', category: 'SUV', price: 45000, images: [] }];

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }, sources) {
  const state = { starts: [], drafts: [], sms: [], productLists: [] };
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
    if (p === '/leads/campaign-sources') return route.fulfill({ json: { success: true, data: sources } });
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: true, item_count: ITEMS.length } } });
    if (p === '/products' && req.method() === 'GET') {
      state.productLists.push(url.search);
      const items = url.searchParams.get('source') === 'manual' ? MANUAL : [];
      return route.fulfill({ json: { success: true, data: { items, pagination: { current_page: 1, per_page: 200, total: items.length, last_page: 1 } } } });
    }
    if (p === '/leads/campaign-draft' && req.method() === 'POST') {
      const b = req.postDataJSON();
      state.drafts.push(b);
      return route.fulfill({ json: { success: true, data: { body: 'Here is a product picked for you: [campaign link]', count: b.ids.length, placeholder: '[campaign link]' } } });
    }
    if (/^\/leads\/12\/messages\/(sms|email)$/.test(p) && req.method() === 'POST') {
      const b = req.postDataJSON();
      state.sms.push(b);
      return route.fulfill({ json: { id: 2, direction: 'outbound', channel: p.endsWith('email') ? 'email' : 'sms', body: b.body, status: 'sent', sent_at: now, attachments: [], campaign: { id: 77, title: 'Walnut Chair', url: 'https://x.test/c', items: 1 } } });
    }
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
// The Products page's Active badge (utils/products BADGE_CLASS.active): emerald-50 bg, emerald-700 words, emerald-200 border.
const isGreen = (c) => /236, 253, 245/.test(c) && /4, 120, 87/.test(c) && /167, 243, 208/.test(c);
const isLightPurple = (c) => /250, 245, 255/.test(c) && /90, 79, 229/.test(c); // purple-50 bg, #5A4FE5 words
const leftOf = async (a, b) => { const [x, y] = [await a.boundingBox(), await b.boundingBox()]; return x && y && x.x + x.width <= y.x + 1 && Math.abs(x.y - y.y) < 4; };


const pickerOf = (page) => page.getByRole('dialog', { name: 'Share Campaign' });
const row = (picker, name) => picker.getByRole('checkbox', { name: new RegExp(name) });

try {
  for (const [width, height, tag] of [[1280, 900, 'd'], [390, 844, 'm']]) {
    // ---- A. manual products only, "+ Send Message"
    {
      const { page, context, state } = await open({ width, height }, { vehicles: false, products: true, website_products: false, manual_products: true });
      await page.getByText('Kim Lee').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 40000 });
      const sendMessage = page.getByRole('button', { name: /Send Message/ }).filter({ visible: true }).first();
      if (await sendMessage.count()) await sendMessage.click();
      else {
        await page.locator('nav.phone-bottom-bar-pin button.rounded-full').first().click();
        await page.getByRole('button', { name: /Send Message/ }).filter({ visible: true }).first().click();
      }
      const dlg = page.getByRole('dialog', { name: 'Start a new message' });
      await dlg.waitFor({ state: 'visible', timeout: 15000 });
      const products = dlg.getByRole('button', { name: 'Add products to your message' });
      await products.waitFor({ state: 'visible', timeout: 10000 });
      expect(true, `${tag}A: "+ Products" shows for an account with only manual products`);
      await products.click();
      const picker = pickerOf(page);
      await row(picker, 'Walnut Chair').waitFor({ state: 'visible', timeout: 15000 });
      expect(await row(picker, 'Oak Bench').count() === 1, `${tag}A: an out-of-stock active manual product is listed`);
      expect(await row(picker, 'No Photo Stool').count() === 0, `${tag}A: a manual product with no photo is left out`);
      expect(await row(picker, 'Fine Line Router').count() === 0, `${tag}A: no website products (none connected)`);
      expect(state.productLists.length >= 1 && state.productLists.every((q) => /source=manual/.test(q) && /status=active%2Cout_of_stock/.test(q)), `${tag}A: asks GET /products for active manual ones (${state.productLists.join(' ')})`);
      expect(/Chairs/.test(await row(picker, 'Walnut Chair').innerText()), `${tag}A: price and category under the name`);
      await row(picker, 'Walnut Chair').click();
      await shot(page, `mp16-${tag}1-picker-manual`);
      await picker.getByRole('button', { name: /^Add \(1\)$/ }).click();
      await picker.waitFor({ state: 'hidden', timeout: 5000 });
      await page.waitForTimeout(300);
      await shot(page, `mp16-${tag}2-send-message-picked`);
      await dlg.locator('#sm-phone').fill('4165550298');
      await dlg.getByRole('button', { name: /^Send$/ }).click();
      await page.waitForTimeout(800);
      expect(state.starts.length === 1 && JSON.stringify(state.starts[0].catalog_item_ids) === '[1001]', `${tag}A: Send carries the manual product (${JSON.stringify(state.starts[0] || null)})`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(!overflow, `${tag}A: no horizontal page scroll`);
      await context.close();
    }

    // ---- B. website + manual, the lead chat composer
    {
      const { page, context, state } = await open({ width, height }, { vehicles: false, products: true, website_products: true, manual_products: true });
      await page.getByText('Kim Lee').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 40000 });
      await page.getByText('Kim Lee').filter({ visible: true }).first().click();
      const box = page.getByPlaceholder(/Type a message to Kim/).filter({ visible: true }).first();
      await box.waitFor({ state: 'visible', timeout: 20000 });
      const cProducts = page.getByRole('button', { name: 'Add products to your message' }).filter({ visible: true }).first();
      await cProducts.waitFor({ state: 'visible', timeout: 10000 });
      await cProducts.click();
      const picker = pickerOf(page);
      await row(picker, 'Walnut Chair').waitFor({ state: 'visible', timeout: 15000 });
      expect(await row(picker, 'Fine Line Router Carved MDF').count() === 1, `${tag}B: website products still listed`);
      expect(await row(picker, 'Oak Bench').count() === 1, `${tag}B: manual products listed with them`);
      await row(picker, 'Walnut Chair').click();
      await row(picker, 'Fine Line Router Carved MDF').click();
      await page.waitForTimeout(400);
      await shot(page, `mp16-${tag}3-composer-picker-mixed`);
      await picker.getByRole('button', { name: /^Add \(2\)$/ }).click();
      await picker.waitFor({ state: 'hidden', timeout: 5000 });
      await page.waitForTimeout(500);
      expect(state.drafts.length === 1 && state.drafts[0].kind === 'product' && JSON.stringify([...state.drafts[0].ids].sort((a, b) => a - b)) === '[501,1001]', `${tag}B: campaign-draft gets the mixed pick (${JSON.stringify(state.drafts[0] || null)})`);
      expect(/\[campaign link\]/.test(await box.inputValue()), `${tag}B: the wording goes in the message box`);
      await shot(page, `mp16-${tag}4-composer-drafted`);
      await page.getByRole('button', { name: /^Send$/ }).filter({ visible: true }).last().click();
      await page.waitForTimeout(1000);
      const sent = state.sms[0];
      expect(Boolean(sent && sent.campaign && sent.campaign.kind === 'product' && JSON.stringify([...sent.campaign.ids].sort((a, b) => a - b)) === '[501,1001]'), `${tag}B: Send makes the campaign with both (${JSON.stringify(sent || null)})`);
      await context.close();
    }

    // ---- C. an API from before F1: website only, as before (no /products call)
    {
      const { page, context, state } = await open({ width, height }, { vehicles: false, products: true });
      await page.getByText('Kim Lee').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 40000 });
      await page.getByText('Kim Lee').filter({ visible: true }).first().click();
      const cProducts = page.getByRole('button', { name: 'Add products to your message' }).filter({ visible: true }).first();
      await cProducts.waitFor({ state: 'visible', timeout: 20000 });
      await cProducts.click();
      const picker = pickerOf(page);
      await row(picker, 'Fine Line Router Carved MDF').waitFor({ state: 'visible', timeout: 15000 });
      expect(await row(picker, 'Walnut Chair').count() === 0 && state.productLists.length === 0, `${tag}C: older API — website products only, GET /products not asked`);
      await page.keyboard.press('Escape');
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
