// Join a claimed lead + the conversation header's "Read" button (Chris 13 Nov 2026 evening), mocked API, 1280 + 390.
// node tests/properties/ui/join-claimed-unread.mjs   (dev server: SL_BASE, default http://localhost:5330)
// Linda (staff in her own account) sees Brenna's lead "Claimed · Brenna" with Join; joins; the conversation opens with
// "Linda joined"; "✓ Read" sits left of search and marks it unread for everyone (the row turns unread).
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.SL_BASE || 'http://localhost:5330';
const OUT = process.env.SL_SHOTS || '/private/tmp/claude-501/join-unread-ui/shots';
mkdirSync(OUT, { recursive: true });

const LINDA = { id: 130, external_user_id: 977, name: 'Linda Partial', email: 'linda@royalwood.test', role: '2', status: 1, is_activated: true };
const now = '2026-11-13T10:00:00Z';
const leadBase = { source: 'widget', story: null, campaign_deleted: false, source_list: null, status: null, engagement: 1, comments: [], messages_count: 1, sent_count: 0, received_count: 1, comment_unread_count: 0, last_engaged_at: now, first_seen_at: now, last_activity_at: now, property_id: null, notes: null, can_assign: false, can_delete: false, account: { owner_id: 959, name: 'The Royal Wood Shop' }, released_from: null, waiting: false, can_accept: false };
const BRENNA = { id: 501, name: 'Brenna Smith', profile_color: '#999' };
const MSG = { body: 'Is the table in stock?', direction: 'inbound', channel: 'widget', sender_name: null, sent_at: now, attachment_name: null };
function leads(state) {
  const kim = state.joined
    ? { ...leadBase, id: 12, user: { id: null, name: 'Kim Lee', email: 'kim@example.test', phone_number: '+14165550298' }, assignee: BRENNA, can_message: true, is_rollup: false, unread_count: state.marked ? 1 : 0, marked_unread: state.marked, latest_message: MSG, claimed: true, joined: true, can_join: false, can_open: true, can_remove: true, can_mark_unread: true }
    : { ...leadBase, id: 12, user: { id: null, name: 'Kim Lee', email: 'kim@example.test', phone_number: '+14165550298' }, assignee: BRENNA, can_message: false, is_rollup: true, unread_count: 0, latest_message: null, claimed: true, joined: false, can_join: true, can_open: false, can_remove: true, can_mark_unread: false };
  const own = { ...leadBase, id: 13, user: { id: null, name: 'Sam Own', email: null, phone_number: '+14165550297' }, assignee: { id: 977, name: 'Linda Partial', profile_color: '#777' }, can_message: true, is_rollup: false, unread_count: 0, latest_message: { ...MSG, body: 'Thanks!' }, claimed: false, can_open: true, can_remove: false, can_join: false, can_mark_unread: true, account: null };
  return [kim, own];
}

const failures = [];
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width = 1280, height = 900, seed, path = '/leads' }) {
  const state = { leadQueries: [], threadOpens: [], joinCalls: 0, unreadCalls: 0, readCalls: 0, joined: false, marked: false };
  const who = LINDA;
  const ownedFor = () => [];
  const sharedFor = () => [];
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([seedData]) => {
    if (sessionStorage.getItem('sl-seeded')) return;
    sessionStorage.setItem('sl-seeded', '1');
    localStorage.clear();
    if (!seedData) return;
    for (const [k, v] of Object.entries(seedData)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, [seed]);
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
      return route.fulfill({ json: { success: true, data: { user: who, token: 'linda-token', collaborators: [], owned_properties: ownedFor(), shared_properties: sharedFor(), partial_admin_access: [] } } });
    }
    if (p === '/properties' && req.method() === 'GET') {
      state.propertyFetches++;
      const owned = ownedFor();
      const shared = sharedFor();
      return route.fulfill({ json: { success: true, data: { properties: [...owned, ...shared], owned_properties: owned, shared_properties: shared, owned_count: owned.length, shared_count: shared.length, total_count: owned.length + shared.length } } });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/leads' && req.method() === 'GET') {
      state.leadQueries.push(url.search);
      const rows = leads(state);
      return route.fulfill({ json: { total: rows.length, status_counts: {}, messages_total: 0, tab_counts: { open: rows.length, closed: 0 }, leads: rows, team_leads: { staff: true, can_see_all: false, scope: 'mine_and_new' } } });
    }
    if (p === '/leads/unread-count') return route.fulfill({ json: { total_unread_messages: state.marked ? 1 : 0, total_unread_comments: 0, total_unread: state.marked ? 1 : 0 } });
    if (p === '/leads/12/join' && req.method() === 'POST') { state.joinCalls++; state.joined = true; return route.fulfill({ json: { lead_id: 12, joined: true } }); }
    if (p === '/leads/12/messages/mark-unread' && req.method() === 'POST') { state.unreadCalls++; state.marked = true; return route.fulfill({ json: { lead_id: 12, marked_unread: true } }); }
    if (/^\/leads\/\d+\/messages\/mark-read$/.test(p)) { if (p.includes('/12/')) { state.readCalls++; state.marked = false; } return route.fulfill({ json: { marked_read: 0 } }); }
    if (/^\/leads\/\d+\/messages$/.test(p)) {
      state.threadOpens.push(p);
      if (p === '/leads/12/messages' && !state.joined) return route.fulfill({ status: 404, json: { message: 'Lead not found.' } });
      const messages = p === '/leads/12/messages'
        ? [{ id: 1, parent_message_id: null, direction: 'inbound', channel: 'widget', body: 'Is the table in stock?', subject: null, status: 'received', is_ai: false, is_read: true, sent_at: now, attachments: [] },
           { id: 2, parent_message_id: null, direction: 'outbound', channel: 'widget', body: 'Yes, come by today.', subject: null, status: 'sent', is_ai: false, is_read: true, sent_at: '2026-11-13T10:05:00Z', sender_name: 'Brenna Smith', attachments: [] }]
        : [];
      const events = p === '/leads/12/messages' ? [{ type: 'joined', user_id: 977, body: 'Linda joined', at: '2026-11-13T10:10:00Z' }] : [];
      return route.fulfill({ json: { messages, events, visitor_online: false, widget_ai: null } });
    }
    // Dashboard widgets: no data (their own shapes; an empty list crashes some of them).
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => { pageErrors.push(e.message); if (process.env.SL_DEBUG) console.log('pageerror', e.stack); });
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


const rowOf = (page, width) => (width >= 1024 ? page.locator('tr', { hasText: 'Kim Lee' }).first() : page.locator('div.rounded-xl', { hasText: 'Kim Lee' }).last());

try {
  for (const [width, height, tag] of [[1280, 900, 'd'], [390, 844, 'm']]) {
    const seed = { stasht_token: 'linda-token', stasht_user: LINDA, view_type: 'personal' };
    const { page, context, state } = await open({ width, height, seed });
    await waitForApp(page);
    await page.getByText('Kim Lee').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 20000 });
    // 1. Linda sees "Claimed · Brenna" with Join; nothing of the conversation.
    const row = rowOf(page, width);
    expect(await row.locator('[data-claimed-badge]').filter({ visible: true }).count() > 0, `${tag}1: "Claimed" on Brenna's lead`);
    expect(await row.getByText('Brenna', { exact: true }).filter({ visible: true }).count() > 0, `${tag}1: who claimed it`);
    const join = row.locator('[data-testid="lead-join"]').filter({ visible: true }).first();
    expect(await join.count() > 0, `${tag}1: Join shown without hovering`);
    expect(await page.locator('[data-testid="lead-join"]').filter({ visible: true }).count() === 1, `${tag}1: Join only on the claimed row`);
    expect(await row.getByText('Is the table in stock?').count() === 0, `${tag}1: no message text before joining`);
    if (await join.count() > 0) {
      const bg = await join.evaluate((el) => { el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); return getComputedStyle(el).backgroundColor; });
      expect(!/108, 96, 255/.test(bg), `${tag}1: Join is gray, not purple (${bg})`);
    }
    await shot(page, `${tag}1-claimed-join`);
    // Clicking the locked row doesn't open it (toast with Join instead).
    await row.click();
    await page.waitForTimeout(800);
    expect(state.threadOpens.every((x) => !x.includes('/12/')), `${tag}1: the claimed lead's conversation is not opened before joining`);
    const toastJoin = page.locator('[data-sonner-toast] button', { hasText: 'Join' });
    expect(await toastJoin.count() > 0, `${tag}1: the "Claimed by Brenna" toast offers Join`);
    await shot(page, `${tag}1b-toast-join`);
    // 2. Join: the conversation opens with "Linda joined" and Brenna's reply.
    await join.click();
    await page.getByText('Linda joined').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 });
    expect(state.joinCalls === 1, `${tag}2: one join call`);
    expect(await page.getByText('Yes, come by today.').filter({ visible: true }).count() > 0, `${tag}2: the thread shows`);
    await page.waitForTimeout(600);
    expect(state.readCalls >= 1 && !state.marked, `${tag}2: opening it marks it read`);
    // 3. "✓ Read" left of search, gray; tap → unread for everyone.
    const readBtn = page.locator('[data-testid="lead-read-toggle"]').filter({ visible: true }).first();
    const search = page.getByRole('button', { name: 'Search messages' }).filter({ visible: true }).first();
    expect(await readBtn.count() > 0, `${tag}3: Read button in the header`);
    const rb = await readBtn.boundingBox();
    const sb = await search.boundingBox();
    expect(rb && sb && rb.x + rb.width <= sb.x + 1 && Math.abs((rb.y + rb.height / 2) - (sb.y + sb.height / 2)) < 3, `${tag}3: Read sits left of search, same row`);
    expect((await readBtn.innerText()).trim() === 'Read', `${tag}3: labelled "Read"`);
    await shot(page, `${tag}3-thread-read-button`);
    await readBtn.hover();
    await page.waitForTimeout(250);
    const bg = await readBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(!/108, 96, 255/.test(bg), `${tag}3: Read hover is gray (${bg})`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(!overflow, `${tag}3: no horizontal page scroll`);
    const before = state.leadQueries.length;
    const readsBefore = state.readCalls;
    await readBtn.click();
    await page.waitForTimeout(1500);
    expect(state.unreadCalls === 1, `${tag}3: mark-unread sent`);
    expect(state.readCalls === readsBefore && state.marked, `${tag}3: not read again afterwards`);
    expect(await page.getByText('Marked unread').filter({ visible: true }).count() > 0, `${tag}3: "Marked unread" toast`);
    expect(await page.locator('[data-testid="lead-read-toggle"]').filter({ visible: true }).count() === 0, `${tag}3: back to the list`);
    expect(state.leadQueries.length > before, `${tag}3: the list reloads`);
    // 4. In the list: the row is unread (bold + dot) until opened again.
    await page.getByText('Kim Lee').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 20000 });
    const row2 = rowOf(page, width);
    expect(await row2.locator('[aria-label="Unread"]').filter({ visible: true }).count() > 0, `${tag}4: the row shows unread`);
    expect(await row2.locator('[data-claimed-badge]').filter({ visible: true }).count() > 0, `${tag}4: still "Claimed" (Brenna keeps it)`);
    expect(await page.locator('[data-testid="lead-join"]').count() === 0, `${tag}4: no Join once joined`);
    await shot(page, `${tag}4-list-unread`);
    const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(!overflow2, `${tag}4: no horizontal page scroll`);
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
