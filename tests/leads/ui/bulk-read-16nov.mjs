// Chris 16 Nov 2026: "We will need a bulk marked as read" (a run of STOP replies left the Open tab full of unread leads).
// Mocked API, 1280 + 390: a checkbox per lead (not on a claimed lead this person can't open) and one for the page; the
// bar shows "N chosen" with Mark read; Mark read posts the chosen ids once, the rows lose their unread dot, the bar goes.
// Ticking a box never opens the lead.
// node tests/leads/ui/bulk-read-16nov.mjs   (dev server: BR_BASE, default http://localhost:5402; BR_SHOTS = screenshot dir)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.BR_BASE || 'http://localhost:5402';
const OUT = process.env.BR_SHOTS || '/private/tmp/claude-501/bulk-read-16nov/shots';
mkdirSync(OUT, { recursive: true });

const OWNER = { id: 708, external_user_id: 959, name: 'TheRoyalWoodShop', email: 'owner@royalwood.test', role: '2', status: 1, is_activated: true };
const now = '2026-11-16T10:00:00Z';
const base = { source: 'memory', story: null, campaign_deleted: false, source_list: null, status: null, engagement: 1, comments: [], messages_count: 1, sent_count: 1, received_count: 1, comment_unread_count: 0, last_engaged_at: now, first_seen_at: now, last_activity_at: now, property_id: null, assignee: null, notes: null, can_message: true, is_rollup: false, can_assign: true, can_accept: false, account: null, can_delete: true, waiting: true, released_from: null, claimed: false, can_open: true, can_remove: false, joined: false, can_join: false, can_mark_unread: false };
const lead = (id, name, phone, body, unread, over = {}) => ({ ...base, id, user: { id: null, name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, phone_number: phone }, unread_count: unread, latest_message: { body, direction: 'inbound', channel: 'sms', sender_name: null, sent_at: now, attachment_name: null }, ...over });
const LEADS = [
  lead(21, 'Robert Contento', '+14165550101', 'STOP', 1),
  lead(22, 'Sheila Kaarlela', '+14165550102', 'Stop', 1),
  lead(23, 'Laura Johansen', '+14165550103', 'STOP', 1),
  lead(24, 'John Cardoso', '+14165550104', 'Thanks!', 0),
  lead(25, 'Claimed Carl', '+14165550105', 'Hi', 1, { claimed: true, can_open: false, waiting: false, claimed_by: { id: 5, name: 'Brenna' } }),
];

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }) {
  const state = { bulk: [], read: new Set(), opened: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([seed]) => {
    if (sessionStorage.getItem('br-seeded')) return;
    sessionStorage.setItem('br-seeded', '1');
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
      const leads = LEADS.map((l) => (state.read.has(l.id) ? { ...l, unread_count: 0 } : l));
      return route.fulfill({ json: { total: leads.length, status_counts: {}, messages_total: 0, tab_counts: { open: leads.length, closed: 0 }, leads, team_leads: null } });
    }
    if (p === '/leads/unread-count') {
      const n = LEADS.filter((l) => l.unread_count && !state.read.has(l.id)).length;
      return route.fulfill({ json: { total_unread_messages: n, total_unread_comments: 0, total_unread: n } });
    }
    if (p === '/leads/bulk/mark-read' && req.method() === 'POST') {
      const b = req.postDataJSON();
      state.bulk.push(b);
      const ids = (b.lead_ids || []).filter((id) => LEADS.some((l) => l.id === id && l.can_open !== false));
      ids.forEach((id) => state.read.add(id));
      return route.fulfill({ json: { marked_lead_ids: ids, marked: ids.length } });
    }
    if (/^\/leads\/\d+\/messages$/.test(p)) { state.opened.push(p); return route.fulfill({ json: { messages: [], events: [], visitor_online: false, widget_ai: null } }); }
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
    const unreadDots = () => vis(page.getByRole('img', { name: 'Unread' })).count();
    expect(await unreadDots() === 4, `${tag}: 4 unread to start (${await unreadDots()})`);

    const boxes = vis(page.getByTestId('lead-choose'));
    expect(await boxes.count() === 5, `${tag}: a checkbox per lead (${await boxes.count()})`);
    expect(await vis(page.getByRole('checkbox', { name: 'Choose Claimed Carl' })).isDisabled(), `${tag}: a claimed lead you can't open can't be chosen`);
    expect(await vis(page.getByTestId('leads-bulk-bar')).count() === 0, `${tag}: no bar until something is chosen`);

    // Ticking a box doesn't open the lead.
    await vis(page.getByRole('checkbox', { name: 'Choose Robert Contento' })).click();
    await vis(page.getByRole('checkbox', { name: 'Choose Sheila Kaarlela' })).click();
    await page.waitForTimeout(300);
    expect(state.opened.length === 0, `${tag}: ticking doesn't open the lead (${state.opened.join(',')})`);
    const bar = vis(page.getByTestId('leads-bulk-bar'));
    expect(/2 chosen/.test(await bar.innerText()), `${tag}: bar says "2 chosen" (${(await bar.innerText()).replace(/\s+/g, ' ')})`);
    await shot(page, `br16-${tag}1-two-chosen`);

    // Page box: everyone choosable (4), then clear, then all again.
    const pageBox = tag === 'd' ? vis(page.getByTestId('lead-choose-page')) : vis(page.getByRole('checkbox', { name: 'Choose every lead on this page' }));
    expect(await pageBox.evaluate((el) => el.indeterminate), `${tag}: page box shows "some"`);
    await pageBox.click();
    expect(/4 chosen/.test(await bar.innerText()), `${tag}: page box chooses the 4 that can be chosen`);
    await pageBox.click();
    expect(await vis(page.getByTestId('leads-bulk-bar')).count() === 0, `${tag}: page box again clears the choice`);
    await pageBox.click();

    await vis(page.getByTestId('leads-bulk-mark-read')).click();
    await vis(page.getByText('Marked 4 leads read')).first().waitFor({ state: 'visible', timeout: 10000 });
    expect(state.bulk.length === 1, `${tag}: one request (${state.bulk.length})`);
    expect(JSON.stringify([...(state.bulk[0]?.lead_ids || [])].sort()) === '[21,22,23,24]', `${tag}: posts the chosen ids (${JSON.stringify(state.bulk[0])})`);
    await page.waitForTimeout(400);
    expect(await unreadDots() === 1, `${tag}: only the claimed lead stays unread (${await unreadDots()})`);
    expect(await vis(page.getByTestId('leads-bulk-bar')).count() === 0, `${tag}: bar goes after Mark read`);
    expect(await vis(page.getByTestId('lead-choose')).evaluateAll((els) => els.every((e) => !e.checked)), `${tag}: nothing left chosen`);
    await shot(page, `br16-${tag}2-after-mark-read`);

    // A plain row click still opens the lead.
    await vis(page.getByText('John Cardoso')).first().click();
    await page.waitForTimeout(800);
    expect(state.opened.some((o) => o.includes('/24/')), `${tag}: clicking the row still opens it`);

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
