// "+ Campaign" goes into the message box (Chris 14 Nov 2026), mocked API, 1280 + 390.
// node tests/properties/ui/composer-campaign.mjs   (dev server: SL_BASE, default http://localhost:5182)
// Pick 2 products → their wording lands in "Type a message to Kim…" after what was typed, a "2 products · More MDF" chip
// shows, NOTHING is created or sent; the agent keeps typing; Send makes one call that carries the box text + the pick.
// × on the chip takes the wording out. Secondary controls are grey; Send stays purple.
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.SL_BASE || 'http://localhost:5182';
const OUT = process.env.SL_SHOTS || '/Users/deepaksharma/Pictures/Personal-Works/Stasht-Project/handoff-20261114/images';
mkdirSync(OUT, { recursive: true });

const OWNER = { id: 708, external_user_id: 959, name: 'TheRoyalWoodShop', email: 'owner@royalwood.test', role: '2', status: 1, is_activated: true };
const now = '2026-11-14T10:00:00Z';
const KIM = { id: 12, source: 'memory', user: { id: null, name: 'Kim Lee', email: 'kim@example.test', phone_number: '+14165550298' }, story: null, campaign_deleted: false, source_list: null, status: null, engagement: 1, comments: [], messages_count: 1, sent_count: 0, received_count: 1, unread_count: 0, comment_unread_count: 0, last_engaged_at: now, first_seen_at: now, last_activity_at: now, property_id: null, assignee: { id: 959, name: 'TheRoyalWoodShop' }, latest_message: { body: 'Do you have MDF panels?', direction: 'inbound', channel: 'sms', sender_name: null, sent_at: now, attachment_name: null }, notes: null, can_message: true, is_rollup: false, can_assign: true, can_accept: false, account: null, can_delete: true, waiting: false, released_from: null, claimed: false, can_open: true, can_remove: false, joined: false, can_join: false, can_mark_unread: false, wants_more: true };
const ITEMS = [
  { id: 501, title: 'Fine Line Router Carved MDF', category: 'MDF', price_label: '$120', main_image: null },
  { id: 502, title: 'Router Carved Solid MDF', category: 'MDF', price_label: '$140', main_image: null },
  { id: 503, title: 'Oak Shelf', category: 'Wood', price_label: '$60', main_image: null },
];
const DRAFT = 'Here are 2 products picked for you:\nFine Line Router Carved MDF: https://royalwood.test/fine-line/\nRouter Carved Solid MDF: [campaign link]';

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }) {
  const state = { drafts: [], sends: [], shares: 0 };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([seed]) => {
    if (sessionStorage.getItem('sl-seeded')) return;
    sessionStorage.setItem('sl-seeded', '1');
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
    if (p === '/leads' && req.method() === 'GET') return route.fulfill({ json: { total: 1, status_counts: {}, messages_total: 0, tab_counts: { open: 1, closed: 0 }, leads: [KIM], team_leads: null } });
    if (p === '/leads/unread-count') return route.fulfill({ json: { total_unread_messages: 0, total_unread_comments: 0, total_unread: 0 } });
    if (p === '/leads/campaign-sources') return route.fulfill({ json: { success: true, data: { vehicles: false, products: true } } });
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: true, item_count: ITEMS.length } } });
    if (p === '/website-catalogue/items') return route.fulfill({ json: { success: true, data: { items: ITEMS, pagination: { last_page: 1 } } } });
    if (p === '/leads/campaign-draft') {
      const b = req.postDataJSON();
      state.drafts.push(b);
      const body = b.ids.length === 2 ? DRAFT : `Here is a product picked for you: https://royalwood.test/p${b.ids[0]}/`;
      return route.fulfill({ json: { success: true, data: { body, count: b.ids.length, placeholder: '[campaign link]' } } });
    }
    if (/^\/leads\/12\/share-cars$/.test(p)) { state.shares++; return route.fulfill({ status: 500, json: { message: 'must not be called' } }); }
    if (/^\/leads\/12\/messages\/(sms|email|chat)$/.test(p) && req.method() === 'POST') {
      const b = req.postDataJSON();
      state.sends.push({ channel: p.split('/').pop(), ...b });
      return route.fulfill({ json: { id: 99, direction: 'outbound', channel: 'email', body: b.body, status: 'sent', sent_at: now, attachments: [], campaign: b.campaign ? { id: 77, title: b.campaign.title || 'Products for Kim', url: 'https://studio.test/p/x', items: b.campaign.ids.length } : undefined } });
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
const isPurple = (c) => /108, 96, 255|90, 79, 229|245, 242, 255|243, 232, 255|250, 245, 255/.test(c);

try {
  for (const [width, height, tag] of [[1280, 900, 'd'], [390, 844, 'm']]) {
    const { page, context, state } = await open({ width, height });
    await page.getByText('Kim Lee').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 40000 });
    expect(await page.locator('[data-wants-more]').filter({ visible: true }).count() > 0, `${tag}0: "Wants more" tag on the lead`);
    await page.getByText('Kim Lee').filter({ visible: true }).first().click();
    const box = page.getByPlaceholder(/Type a message to Kim/).filter({ visible: true }).first();
    await box.waitFor({ state: 'visible', timeout: 20000 });
    await box.fill('Hi Kim, as promised.');

    const plus = page.getByRole('button', { name: 'Add a campaign to your message' }).filter({ visible: true }).first();
    expect(!isPurple(await plus.evaluate((el) => getComputedStyle(el).backgroundColor + getComputedStyle(el).color)), `${tag}1: + Campaign is grey`);
    const send = page.getByRole('button', { name: /^Send$/ }).filter({ visible: true }).first();
    expect(isPurple(await send.evaluate((el) => getComputedStyle(el).backgroundColor)), `${tag}1: Send stays purple`);
    await plus.click();

    const dialog = page.getByRole('dialog', { name: 'Share Campaign' });
    await dialog.getByText('Fine Line Router Carved MDF').waitFor({ state: 'visible', timeout: 15000 });
    expect(await dialog.getByPlaceholder('Search products').count() === 1, `${tag}2: products wording ("Search products")`);
    expect(await dialog.getByText('Category').count() > 0, `${tag}2: category filter kept`);
    await dialog.locator('#share-cars-campaign-name').fill('More MDF');
    expect((await dialog.getByRole('button', { name: /^Add/ }).innerText()).trim() === 'Add', `${tag}2: button says "Add"`);
    await dialog.getByRole('checkbox', { name: /Fine Line Router Carved MDF/ }).click();
    await dialog.getByRole('checkbox', { name: /Router Carved Solid MDF/ }).click();
    const sel = await dialog.getByRole('checkbox', { name: /Fine Line/ }).evaluate((el) => getComputedStyle(el).backgroundColor + getComputedStyle(el).borderColor);
    expect(!isPurple(sel), `${tag}2: selected item is grey (${sel})`);
    await shot(page, `lm-${tag}1-picker`);
    const add = dialog.getByRole('button', { name: 'Add (2)' });
    expect(await add.count() === 1, `${tag}2: "Add (2)"`);
    await add.click();
    await page.waitForTimeout(800);

    const text = await box.inputValue();
    expect(state.drafts.length === 1 && state.sends.length === 0 && state.shares === 0, `${tag}3: picking asked for the wording only — nothing created or sent`);
    expect(text === `Hi Kim, as promised.\n\n${DRAFT}`, `${tag}3: wording in the box after the typed text (${JSON.stringify(text)})`);
    const chip = page.getByRole('button', { name: /2 products/ }).filter({ visible: true }).first();
    expect(await chip.count() === 1 && /More MDF/.test(await chip.innerText()), `${tag}3: chip "2 products · More MDF"`);
    expect(await page.getByRole('dialog', { name: 'Share Campaign' }).count() === 0, `${tag}3: picker closed`);
    await shot(page, `lm-${tag}2-in-box`);

    // Keep typing, then Send: one call with exactly the box text and the pick.
    await box.focus();
    await page.keyboard.press('End');
    await box.press('Control+End').catch(() => {});
    await box.evaluate((el) => el.setSelectionRange(el.value.length, el.value.length));
    await page.keyboard.type('\nCall me any time.'.replace('\n', ''), { delay: 5 });
    await send.click();
    await page.getByText('Sent with a new campaign, "More MDF".').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 10000 });
    const s = state.sends[0];
    expect(state.sends.length === 1, `${tag}4: one send`);
    expect(s && s.body === `Hi Kim, as promised.\n\n${DRAFT}Call me any time.`, `${tag}4: the box text as typed (${JSON.stringify(s && s.body)})`);
    expect(s && s.campaign && s.campaign.kind === 'product' && s.campaign.ids.join() === '501,502' && s.campaign.title === 'More MDF', `${tag}4: the pick goes with Send`);
    expect(await page.getByRole('button', { name: /2 products/ }).filter({ visible: true }).count() === 0, `${tag}4: chip cleared after Send`);
    await shot(page, `lm-${tag}3-sent`);

    // Pick one, then × : a plain message again.
    await box.fill('Quick note');
    await plus.click();
    await dialog.getByText('Oak Shelf').waitFor({ state: 'visible', timeout: 15000 });
    await dialog.getByRole('checkbox', { name: /Oak Shelf/ }).click();
    await dialog.getByRole('button', { name: 'Add (1)' }).click();
    await page.waitForTimeout(600);
    expect((await box.inputValue()).includes('Here is a product picked for you'), `${tag}5: one product in the box`);
    await page.getByRole('button', { name: 'Remove campaign' }).filter({ visible: true }).first().click();
    expect((await box.inputValue()) === 'Quick note', `${tag}5: × takes the wording out`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(!overflow, `${tag}5: no horizontal page scroll`);
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
