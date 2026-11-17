// Chris 17 Nov 2026: "how does STOP work? … where is the stop list?" — a person who texted STOP shows a gray
// "Texts off" tag (title: when, and that START undoes it) on their Leads row / phone card, in the conversation header
// and in Contact Details; nobody else does. Sending to them shows the API's reason (a STOP, and when).
// Mocked API, 1280 + 390.
// node tests/leads/ui/texts-off-17nov.mjs   (dev server: TO_BASE, default http://127.0.0.1:5442; TO_SHOTS = screenshot dir)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.TO_BASE || 'http://127.0.0.1:5442';
const OUT = process.env.TO_SHOTS || '/private/tmp/claude-501/texts-off-17nov/shots';
mkdirSync(OUT, { recursive: true });

const OWNER = { id: 708, external_user_id: 959, name: 'TheRoyalWoodShop', email: 'owner@royalwood.test', role: '2', status: 1, is_activated: true };
const now = '2026-11-17T10:00:00Z';
const STOPPED = '2026-11-15T14:00:00+05:30';
const REFUSAL = 'They replied STOP on Nov 15, 2026, so texts and emails are off until they reply START.';
const base = { source: 'memory', story: null, campaign_deleted: false, source_list: null, status: null, engagement: 1, comments: [], messages_count: 1, sent_count: 1, received_count: 1, comment_unread_count: 0, last_engaged_at: now, first_seen_at: now, last_activity_at: now, property_id: null, assignee: { id: 959, name: 'TheRoyalWoodShop', profile_color: null, avatar_url: null }, notes: null, can_message: true, is_rollup: false, can_assign: true, can_accept: false, account: null, can_delete: true, waiting: false, released_from: null, claimed: false, can_open: true, can_remove: false, joined: false, can_join: false, can_mark_unread: false, opted_out: false, opted_out_at: null, texts_stopped_at: null };
const lead = (id, name, phone, body, over = {}) => ({ ...base, id, user: { id: null, name, email: null, phone_number: phone }, unread_count: 0, latest_message: { body, direction: 'inbound', channel: 'sms', sender_name: null, sent_at: now, attachment_name: null }, ...over });
const LEADS = [
  lead(31, 'Robert Contento', '+15550000101', 'STOP', { opted_out: true, opted_out_at: STOPPED, texts_stopped_at: STOPPED }),
  lead(32, 'John Cardoso', '+15550000102', 'Thanks!'),
];

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }) {
  const state = { sms: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([seed]) => {
    if (sessionStorage.getItem('to-seeded')) return;
    sessionStorage.setItem('to-seeded', '1');
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
    if (p === '/leads' && req.method() === 'GET') {
      const id = Number(url.searchParams.get('lead_id'));
      const leads = id ? LEADS.filter((l) => l.id === id) : LEADS;
      return route.fulfill({ json: { total: leads.length, status_counts: {}, messages_total: 0, tab_counts: { open: leads.length, closed: 0 }, leads, team_leads: null } });
    }
    if (p === '/leads/unread-count') return route.fulfill({ json: { total_unread_messages: 0, total_unread_comments: 0, total_unread: 0 } });
    if (/^\/leads\/\d+\/messages$/.test(p)) {
      const id = Number(p.split('/')[2]);
      const l = LEADS.find((x) => x.id === id);
      return route.fulfill({ json: { messages: [{ id: id * 10, lead_id: id, direction: 'inbound', channel: 'sms', body: l?.latest_message.body, status: 'received', is_read: true, sent_at: now, attachments: [] }], events: [], visitor_online: false, widget_ai: null } });
    }
    if (/^\/leads\/\d+\/messages\/sms$/.test(p) && req.method() === 'POST') {
      state.sms.push(p);
      return route.fulfill({ status: 422, json: { message: REFUSAL } });
    }
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
const vis = (loc) => loc.filter({ visible: true });

try {
  for (const [width, height, tag] of [[1280, 900, 'd'], [390, 844, 'm']]) {
    const { page, context, state } = await open({ width, height });
    await vis(page.getByText('Robert Contento')).first().waitFor({ state: 'visible', timeout: 40000 });
    await page.waitForTimeout(500);

    const tags = vis(page.locator('[data-texts-off]'));
    expect(await tags.count() === 1, `${tag}: one "Texts off" tag in the list (${await tags.count()})`);
    expect((await tags.first().innerText()).trim() === 'Texts off', `${tag}: it says "Texts off"`);
    const title = await tags.first().getAttribute('title');
    expect(title === 'Replied STOP on Nov 15, 2026. Texts and emails are off until they reply START.', `${tag}: title says when and how to undo (${title})`);
    const color = await tags.first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(color === 'rgb(243, 244, 246)', `${tag}: gray (${color})`);
    const rowOfTag = await tags.first().evaluate((el) => (el.closest('tr') || el.closest('[role="button"]') || el.parentElement.parentElement.parentElement).innerText);
    expect(/Robert Contento/.test(rowOfTag) && !/John Cardoso/.test(rowOfTag), `${tag}: on Robert's row only`);
    await shot(page, `to17-${tag}1-list`);

    // Open Robert's conversation.
    await vis(page.getByText('Robert Contento')).first().click();
    await vis(page.getByPlaceholder('Type a message to Robert...')).first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500);
    const header = vis(page.locator('#lead-drawer-title').locator('xpath=..').locator('[data-texts-off]'));
    expect(await header.count() === 1, `${tag}: header shows "Texts off" (${await header.count()})`);
    await shot(page, `to17-${tag}2-conversation`);

    // Sending to them: the API's reason shows.
    const box = vis(page.getByPlaceholder('Type a message to Robert...')).first();
    await box.fill('Hello again');
    await box.press('Enter');
    await vis(page.getByText(REFUSAL)).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    expect(state.sms.length === 1, `${tag}: tried the SMS once (${state.sms.length})`);
    expect(await vis(page.getByText(REFUSAL)).count() >= 1, `${tag}: shows "${REFUSAL}"`);
    await shot(page, `to17-${tag}3-refused`);

    // Contact Details (phones: tap the name).
    if (tag === 'm') {
      await vis(page.getByTestId('lead-name-details-trigger')).first().click();
      await page.waitForTimeout(600);
    }
    const details = vis(page.getByText('Texts off'));
    expect(await details.count() >= (tag === 'd' ? 2 : 1), `${tag}: Contact Details shows it too (${await details.count()} visible)`);
    await shot(page, `to17-${tag}4-details`);

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
