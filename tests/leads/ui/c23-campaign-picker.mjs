// Chris 23 Nov 2026, point G, mocked API, 1280 + 390 (TheBodyPolitik):
//  A. Lead chat composer: "+ Campaign" opens the account's EXISTING campaigns (the newsletter's "Choose campaigns" list:
//     thumbnail, title, date, search; an unpublished one disabled with "Publish it first to add it"); picking one puts
//     "Title: link" into the message box; Send carries memory_id (the server sends it as the lead's tracked link) and no
//     new-campaign pick.
//  B. "+ Products" keeps today's product picker ("Share Campaign"), and manual products show their photos (or the
//     brand for a product without one), never the generic box icon.
//  C. "+ Send Message": the same "+ Campaign" → existing campaigns → link in the message → start-conversation memory_id.
//  D. A dealer with vehicles keeps its vehicle picker under "+ Vehicles".
// node tests/leads/ui/c23-campaign-picker.mjs   (dev server: SM_BASE, default http://127.0.0.1:5623; SM_SHOTS = screenshot dir)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
import { mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const HERE = dirname(fileURLToPath(import.meta.url));
const PNG = readFileSync(join(HERE, '../../../public/apple-touch-icon.png'));
const BASE = process.env.SM_BASE || 'http://127.0.0.1:5623';
const OUT = process.env.SM_SHOTS || '/private/tmp/claude-501/c23-campaign-picker/shots';
mkdirSync(OUT, { recursive: true });

const OWNER = { id: 802, external_user_id: 991201, name: 'TheBodyPolitik', email: 'hello@thebodypolitik.test', role: '2', status: 1, is_activated: true, profile_color: '#1F4D3A' };
const now = '2026-11-23T10:00:00Z';
const STUDIO = 'https://studio.stasht.com';
const PHOTO = `${BASE}/c23-img/half-arms.png`;
const COVER = 'https://127.0.0.1/c23-img/products-for-you.png'; // campaign covers must be https (the picker's httpsUrl)
const JEREMY = { id: 12, source: 'memory', user: { id: null, name: 'Jeremy Noonan', email: null, phone_number: '+12368892225' }, story: null, campaign_deleted: false, source_list: null, status: null, engagement: 1, comments: [], messages_count: 1, sent_count: 1, received_count: 0, unread_count: 0, comment_unread_count: 0, last_engaged_at: now, first_seen_at: now, last_activity_at: now, property_id: null, assignee: { id: 991201, name: 'TheBodyPolitik' }, latest_message: { body: 'Hey Jeremy', direction: 'outbound', channel: 'sms', sender_name: 'TheBodyPolitik', sent_at: now, attachment_name: null }, notes: null, can_message: true, is_rollup: false, can_assign: true, can_accept: false, account: null, can_delete: true, waiting: false, released_from: null, claimed: false, can_open: true, can_remove: false, joined: false, can_join: false, can_mark_unread: false };
const MY_PROPS = [{ id: 10, name: 'TheBodyPolitik' }];
const FULL_ROWS = [{ id: 10, name: 'TheBodyPolitik', is_creator: true, account_type: 'internal', user_id: 991201 }];
// GET /newsletters/campaign-options?kind=campaign rows (Chris's screenshot).
const CAMPAIGNS = [
  { kind: 'campaign', id: 701, title: 'Products for you', description: 'Half Front Torso, Half Arms and Full Back.', cover_url: COVER, date: '2026-11-23', public_url: `${STUDIO}/published-memory/products-for-you-6b04697b9d3a6`, shareable: true, reason: null, price_text: null, meta: null, category: null },
  { kind: 'campaign', id: 702, title: 'November Specials', description: '', cover_url: COVER, date: '2026-11-21', public_url: null, shareable: false, reason: 'Publish it first to add it', price_text: null, meta: null, category: null },
  { kind: 'campaign', id: 703, title: 'Just 4 U - Jeremy Noonan', description: '', cover_url: null, date: '2026-11-21', public_url: `${STUDIO}/published-memory/just-4-u?viewonly=1`, shareable: true, reason: null, price_text: null, meta: null, category: null },
];
const manual = (id, title, price, over = {}) => ({ id, user_id: 991201, read_only: false, origin: 'manual', status: 'active', stock_status: 'in_stock', badge: 'active', title, price: String(price), compare_at_price: null, currency: 'CAD', price_label: `$${price} CAD`, compare_at_label: '', price_on_request: false, show_price: true, main_image: PHOTO, images_count: 2, category: null, categories: [{ id: 3, name: 'Body' }], sku: null, brand: null, url: null, updated_at: now, ...over });
const MANUAL = [
  manual(1001, 'Full Arms', 65),
  manual(1002, 'Full Back', 75),
  manual(1003, 'Half Front Torso', 45, { main_image: null, cover_removed: true }), // Remove cover: the brand, as its Products card
];
const CARS = [{ id: 901, year: 2024, make: 'Jeep', model: 'Wrangler', title: '2024 Jeep Wrangler', category: 'SUV', price: 45000, main_image: PHOTO, images: [] }];

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }, sources) {
  const state = { starts: [], sends: [], options: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([seed]) => {
    if (sessionStorage.getItem('c23-seeded')) return;
    sessionStorage.setItem('c23-seeded', '1');
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
    if (url.pathname.startsWith('/c23-img/')) return route.fulfill({ contentType: 'image/png', body: PNG });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/properties' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { properties: FULL_ROWS, owned_properties: FULL_ROWS, shared_properties: [], owned_count: 1, shared_count: 0, total_count: 1 } } });
    if (p === '/storeels/my-properties') return route.fulfill({ json: { success: true, properties: MY_PROPS } });
    if (p === '/leads' && req.method() === 'GET') return route.fulfill({ json: { total: 1, status_counts: {}, messages_total: 0, tab_counts: { open: 1, closed: 0 }, leads: [JEREMY], team_leads: null } });
    if (p === '/leads/unread-count') return route.fulfill({ json: { total_unread_messages: 0, total_unread_comments: 0, total_unread: 0 } });
    if (p === '/leads/campaign-sources') return route.fulfill({ json: { success: true, data: sources } });
    if (p === '/newsletters/campaign-options') {
      state.options.push(url.search);
      const kind = url.searchParams.get('kind') || 'campaign';
      const q = (url.searchParams.get('search') || '').toLowerCase();
      const rows = kind === 'campaign' ? CAMPAIGNS.filter((c) => !q || c.title.toLowerCase().includes(q)) : [];
      return route.fulfill({ json: { success: true, data: { data: rows, meta: { page: 1, total_pages: 1, total: rows.length, counts: { campaign: CAMPAIGNS.length, product: 3, vehicle: 0 }, categories: [] } } } });
    }
    if (p === '/products/status') return route.fulfill({ json: { success: true, data: { pilot: true, available: true, reason: null, can_create: true, counts: { total: 3, manual: 3, website: 0 } } } });
    if (p === '/products' && req.method() === 'GET') {
      const items = url.searchParams.get('source') === 'manual' ? MANUAL : [];
      return route.fulfill({ json: { success: true, data: { items, pagination: { current_page: 1, per_page: 200, total: items.length, last_page: 1 } } } });
    }
    if (p === '/leads/campaign-draft' && req.method() === 'POST') {
      const b = req.postDataJSON();
      return route.fulfill({ json: { success: true, data: { body: `Here are ${b.ids.length} products picked for you: [campaign link]`, count: b.ids.length, placeholder: '[campaign link]' } } });
    }
    if (/^\/leads\/12\/messages\/(sms|email|chat)$/.test(p) && req.method() === 'POST') {
      const b = req.postDataJSON();
      state.sends.push(b);
      return route.fulfill({ json: { id: 2, direction: 'outbound', channel: 'sms', body: b.body, status: 'sent', sent_at: now, attachments: [] } });
    }
    if (p.startsWith('/cars')) return route.fulfill({ json: { success: true, data: { cars: CARS, filters: { categories: ['SUV'] }, pagination: { total: 1 } } } });
    if (p === '/leads/start-conversation' && req.method() === 'POST') {
      state.starts.push(req.postDataJSON());
      return route.fulfill({ json: { success: true, data: { lead_id: 12, created: false } } });
    }
    if (/^\/leads\/12\/messages$/.test(p)) return route.fulfill({ json: { messages: [{ id: 1, parent_message_id: null, direction: 'outbound', channel: 'sms', body: 'Hey Jeremy, here are 3 products picked for you', subject: null, status: 'sent', is_ai: false, is_read: true, sent_at: now, attachments: [] }], events: [], visitor_online: false, widget_ai: null } });
    if (/^\/leads\/\d+\/messages\/mark-read$/.test(p)) return route.fulfill({ json: { marked_read: 0 } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/leads`);
  return { context, page, state };
}

const shot = async (page, file) => { const path = `${OUT}/${file}.png`; await page.screenshot({ path, animations: 'disabled' }); console.log('shot', path); };
const existingPicker = (page) => page.getByRole('dialog', { name: 'Choose campaigns' });
const sharePicker = (page) => page.getByRole('dialog', { name: 'Share Campaign' });
const openLead = async (page) => {
  await page.getByText('Jeremy Noonan').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 40000 });
  await page.getByText('Jeremy Noonan').filter({ visible: true }).first().click();
  const box = page.getByPlaceholder(/Type a message to Jeremy/).filter({ visible: true }).first();
  await box.waitFor({ state: 'visible', timeout: 20000 });
  return box;
};

try {
  for (const [width, height, tag] of [[1280, 900, 'd'], [390, 844, 'm']]) {
    const productsOnly = { vehicles: false, products: true, website_products: false, manual_products: true };

    // ---- A. lead chat composer: "+ Campaign" → existing campaigns → link in the box → Send with memory_id
    {
      const { page, context, state } = await open({ width, height }, productsOnly);
      const box = await openLead(page);
      await box.fill('Hi Jeremy, have a look:');
      await page.getByRole('button', { name: 'Add a campaign to your message' }).filter({ visible: true }).first().click();
      const picker = existingPicker(page);
      await picker.waitFor({ state: 'visible', timeout: 10000 });
      await picker.locator('#nl-campaign-campaign-701').waitFor({ state: 'visible', timeout: 10000 });
      expect(await picker.getByRole('radiogroup', { name: 'Show' }).count() === 0, `${tag}A: campaigns only, no Products/Vehicles tabs`);
      expect(state.options.length > 0 && state.options.every((q) => !/kind=(product|vehicle)/.test(q)), `${tag}A: asks campaign-options for campaigns only (${state.options.join(' ')})`);
      expect(await picker.getByLabel('Search your campaigns').count() === 1, `${tag}A: a search box`);
      expect(await picker.locator('#nl-campaign-campaign-702').isDisabled(), `${tag}A: an unpublished campaign is disabled`);
      expect(await picker.getByText('Publish it first to add it').count() >= 1, `${tag}A: "Publish it first to add it"`);
      expect(await picker.locator('img').count() >= 1, `${tag}A: thumbnails`);
      expect(/Nov/.test(await picker.textContent()), `${tag}A: dates shown`);
      expect(await page.getByRole('dialog', { name: 'Share Campaign' }).count() === 0, `${tag}A: not the product picker`);
      await shot(page, `c23-G-${tag}1-campaign-picker`);
      await picker.getByLabel('Search your campaigns').fill('products');
      await page.waitForTimeout(700);
      expect(await picker.locator('#nl-campaign-campaign-703').count() === 0, `${tag}A: search narrows the list`);
      await picker.getByLabel('Search your campaigns').fill('');
      await page.waitForTimeout(700);
      await picker.locator('#nl-campaign-campaign-701').check();
      await picker.getByRole('button', { name: 'Done' }).click();
      await picker.waitFor({ state: 'hidden', timeout: 5000 });
      await page.waitForTimeout(300);
      const text = await box.inputValue();
      const link = `${STUDIO}/published-memory/products-for-you-6b04697b9d3a6`;
      expect(text.includes(`Products for you: ${link}`) && text.startsWith('Hi Jeremy, have a look:'), `${tag}A: "Title: link" in the box after the typed text (${JSON.stringify(text)})`);
      await shot(page, `c23-G-${tag}2-link-in-box`);
      await page.getByRole('button', { name: /^Send$/ }).filter({ visible: true }).last().click();
      await page.waitForTimeout(1000);
      const sent = state.sends[0];
      expect(Boolean(sent && sent.memory_id === 701 && !sent.campaign && sent.body.includes(link)), `${tag}A: Send carries memory_id 701 and the link, no new campaign (${JSON.stringify(sent || null)})`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(!overflow, `${tag}A: no horizontal page scroll`);
      await context.close();
    }

    // ---- B. "+ Products": today's product picker, with photos (brand for a removed cover), no box icon
    {
      const { page, context } = await open({ width, height }, productsOnly);
      await openLead(page);
      await page.getByRole('button', { name: 'Add products to your message' }).filter({ visible: true }).first().click();
      const picker = sharePicker(page);
      await picker.getByRole('checkbox', { name: /Full Arms/ }).waitFor({ state: 'visible', timeout: 15000 });
      const imgs = picker.locator(`img[src="${PHOTO}"]`);
      expect(await imgs.count() === 2, `${tag}B: the two products with photos show them (got ${await imgs.count()})`);
      expect(await picker.locator('[data-testid="product-brand-thumb"]').count() === 1, `${tag}B: a removed cover shows the brand`);
      expect(await picker.locator('svg.lucide-package').count() === 0, `${tag}B: no generic box icon`);
      expect(await picker.isVisible(), `${tag}B: the picker is on screen`);
      // Really on top (not under the phone's lead layer): a real click on a row ticks it.
      await picker.getByRole('checkbox', { name: /Full Arms/ }).click({ timeout: 5000 });
      expect(await picker.getByRole('checkbox', { name: /Full Arms/ }).getAttribute('aria-checked') === 'true', `${tag}B: a real click ticks a product`);
      await page.waitForTimeout(1200);
      await shot(page, `c23-G-${tag}3-products-picker-photos`);
      // The phone page shot can miss this dialog's layer; the dialog itself is captured too.
      await picker.screenshot({ path: `${OUT}/c23-G-${tag}3b-products-picker-dialog.png` });
      await page.keyboard.press('Escape');
      await context.close();
    }

    // ---- C. "+ Send Message": "+ Campaign" → existing campaign → link → start-conversation memory_id
    {
      const { page, context, state } = await open({ width, height }, productsOnly);
      await page.getByText('Jeremy Noonan').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 40000 });
      const sendMessage = page.getByRole('button', { name: /Send Message/ }).filter({ visible: true }).first();
      if (await sendMessage.count()) await sendMessage.click();
      else {
        await page.locator('nav.phone-bottom-bar-pin button.rounded-full').first().click();
        await page.getByRole('button', { name: /Send Message/ }).filter({ visible: true }).first().click();
      }
      const dlg = page.getByRole('dialog', { name: 'Start a new message' });
      await dlg.waitFor({ state: 'visible', timeout: 15000 });
      await dlg.getByRole('button', { name: /^Campaign/ }).click();
      const picker = existingPicker(page);
      await picker.locator('#nl-campaign-campaign-703').waitFor({ state: 'visible', timeout: 10000 });
      await picker.locator('#nl-campaign-campaign-703').check();
      await picker.getByRole('button', { name: 'Done' }).click();
      await picker.waitFor({ state: 'hidden', timeout: 5000 });
      expect(await dlg.isVisible(), `${tag}C: Send Message stays open`);
      const body = await dlg.locator('#sm-body').inputValue();
      expect(body.includes(`Just 4 U - Jeremy Noonan: ${STUDIO}/published-memory/just-4-u?viewonly=1`), `${tag}C: "Title: link" in the message (${JSON.stringify(body)})`);
      await shot(page, `c23-G-${tag}4-send-message-campaign`);
      await dlg.locator('#sm-phone').fill('2368892225');
      await dlg.getByRole('button', { name: /^Send$/ }).click();
      await page.waitForTimeout(800);
      const s = state.starts[0];
      expect(Boolean(s && s.memory_id === 703 && !s.catalog_item_ids && !s.car_ids), `${tag}C: start-conversation carries memory_id 703 (${JSON.stringify(s || null)})`);
      await context.close();
    }

    // ---- D. a dealer with vehicles: "+ Vehicles" opens the vehicle picker (what "+ Campaign" used to open)
    {
      const { page, context } = await open({ width, height }, { vehicles: true, products: false });
      await openLead(page);
      const v = page.getByRole('button', { name: 'Add vehicles to your message' }).filter({ visible: true }).first();
      await v.waitFor({ state: 'visible', timeout: 10000 });
      expect(await page.getByRole('button', { name: 'Add products to your message' }).filter({ visible: true }).count() === 0, `${tag}D: no "+ Products" without products`);
      await v.click();
      const picker = sharePicker(page);
      await picker.getByText('2024 Jeep Wrangler').waitFor({ state: 'visible', timeout: 15000 });
      expect(true, `${tag}D: "+ Vehicles" lists the dealer's vehicles`);
      await shot(page, `c23-G-${tag}5-vehicles`);
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
