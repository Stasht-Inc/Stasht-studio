// Leads quick switch (Deepak + Chris 14 Nov 2026), mocked API, 1280 + 390. node tests/properties/ui/leads-quick-switch.mjs (dev server: SL_BASE, default http://localhost:5191). Nothing leaves this machine.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
const { chromium } = pw;
const BASE = process.env.SL_BASE || 'http://localhost:5191';
const OUT = process.env.SL_SHOTS || '/private/tmp/claude-501/leads-quick-switch/shots';
mkdirSync(OUT, { recursive: true });

const CHRIS = { id: 1300, external_user_id: 1300, name: 'Christian Beckermann', email: 'chris@test.test', role: '3', status: 1, is_activated: true, profile_color: 'D9915B' };
const ROYAL = { id: 708, external_user_id: 959, name: 'TheRoyalWoodShop', email: 'owner@royal.test', role: '3', status: 1, is_activated: true, profile_color: '2E7D32' };
const switchData = (extra = {}) => ({
  has_admin_access: true, current_mode: 'personal',
  personal_account: { user: CHRIS, token: 'chris-token' },
  admin_accounts: [
    { owner_id: '959', user: { name: 'TheRoyalWoodShop', email: 'owner@royal.test' }, token: '', isPartialAdmin: false },
    { owner_id: '958', user: { name: 'Second Shop', email: 'second@test.test' }, token: '', isPartialAdmin: true },
  ],
  ...extra,
});
const API2 = [
  { owner_id: 959, name: 'TheRoyalWoodShop', email: 'owner@royal.test', profile_image: null, profile_color: '2E7D32', role: 'admin', unread: 4 },
  { owner_id: 958, name: 'Second Shop', email: 'second@test.test', profile_image: null, profile_color: null, role: 'partial_admin', unread: 1 },
];

const failures = []; const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, seed, accounts = API2, apiFails = false }) {
  const state = { switchCalls: [], authSeen: [] };
  const context = await browser.newContext({ viewport: { width, height: 860 }, serviceWorkers: 'block', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([seedData]) => {
    if (sessionStorage.getItem('qs-seeded')) return;
    sessionStorage.setItem('qs-seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(seedData)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, [seed]);
  await context.route('**/*', async (route) => {
    const req = route.request(); const url = new URL(req.url());
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    const remoteApi = !local && url.pathname.startsWith('/api/react/');
    if (!local && !remoteApi) return route.abort('blockedbyclient');
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (p === '/leads/admin-accounts-unread') {
      state.authSeen.push(req.headers()['authorization']);
      if (apiFails) return route.fulfill({ status: 500, json: { message: 'boom' } });
      return route.fulfill({ json: { accounts } });
    }
    if (p === '/login-as-admin' || p === '/login-as-partial-admin') {
      state.switchCalls.push([p, req.postDataJSON(), req.headers()['authorization']]);
      return route.fulfill({ json: { success: true, data: { user: ROYAL, token: 'royal-token', token_type: 'Bearer' } } });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/leads' && req.method() === 'GET') return route.fulfill({ json: { total: 0, status_counts: {}, messages_total: 0, tab_counts: { open: 0, closed: 0 }, leads: [] } });
    if (p === '/leads/unread-count') return route.fulfill({ json: { total_unread_messages: 0, total_unread_comments: 0, total_unread: 0 } });
    if (p === '/properties') return route.fulfill({ json: { success: true, data: { properties: [], owned_properties: [], shared_properties: [], owned_count: 0, shared_count: 0, total_count: 0 } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/leads`);
  await page.getByText('OPEN', { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 40000 }).catch(() => {});
  await page.locator('[aria-label="Open or closed leads"]').first().waitFor({ timeout: 40000 });
  await page.waitForTimeout(1500);
  return { context, page, state };
}
const row = (page) => page.locator('[aria-label="Open or closed leads"]').filter({ visible: true }).first();
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const width of [1280, 390]) {
  console.log(`--- ${width}: personal, 2 accounts`);
  {
    const { context, page, state } = await open({ width, seed: { stasht_token: 'chris-token', stasht_user: CHRIS, view_type: 'personal', admin_switch_data: switchData() } });
    const btn = row(page).getByRole('button', { name: /Switch account/ });
    expect(await btn.count() === 1, 'one switch button in the OPEN/CLOSED row');
    expect((await btn.innerText()).includes('5'), 'badge = total unread (4 + 1)');
    expect(width < 640 ? !(await btn.innerText()).includes('Accounts') : (await btn.innerText()).includes('Accounts'), 'label on desktop only');
    expect(await noOverflow(page), 'no horizontal overflow');
    await page.screenshot({ path: `${OUT}/${width}-personal.png` });
    await btn.click();
    const menu = page.getByRole('menu');
    await menu.waitFor();
    const items = await menu.getByRole('menuitem').allInnerTexts();
    expect(items.length === 2 && items[0].includes('TheRoyalWoodShop') && items[0].includes('4') && items[1].includes('Second Shop'), 'dropdown lists both accounts with counts');
    const box = await menu.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= width, 'dropdown fits the screen');
    await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${width}-dropdown.png` });
    await menu.getByRole('menuitem', { name: /TheRoyalWoodShop/ }).click();
    await page.waitForURL(/\/leads/, { timeout: 15000 });
    await page.locator('[aria-label="Open or closed leads"]').first().waitFor({ timeout: 40000 });
    await page.waitForTimeout(1500);
    expect(state.switchCalls.length === 1 && state.switchCalls[0][0] === '/login-as-admin' && String(state.switchCalls[0][1].owner_id) === '959' && state.switchCalls[0][2] === 'Bearer chris-token', 'switched with the existing /login-as-admin call on the personal token');
    const ls = await page.evaluate(() => ({ token: localStorage.getItem('stasht_token'), data: JSON.parse(localStorage.getItem('admin_switch_data') || '{}'), path: location.pathname }));
    expect(ls.token === 'royal-token' && ls.data.current_mode === 'admin' && ls.data.current_admin_owner_id === '959' && ls.path === '/leads', 'landed on the business Leads page');
    // Switched in: back to personal (+ the other account).
    const back = row(page).getByRole('button', { name: /Switch account/ });
    expect(await back.count() === 1, 'switched in: the button is there');
    if (width >= 640) expect((await back.innerText()).includes('Personal'), 'shows "Personal"');
    await page.screenshot({ path: `${OUT}/${width}-switched.png` });
    await back.click();
    await page.getByRole('menu').waitFor();
    const items2 = await page.getByRole('menu').getByRole('menuitem').allInnerTexts();
    expect(items2[0].includes('Personal') && items2.some((t) => t.includes('Second Shop')), 'menu: Personal first, other accounts listed');
    await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${width}-switched-menu.png` });
    await page.getByRole('menu').getByRole('menuitem', { name: /Personal/ }).click();
    await page.waitForURL(/\/leads/, { timeout: 15000 });
    await page.locator('[aria-label="Open or closed leads"]').first().waitFor({ timeout: 40000 });
    await page.waitForTimeout(1000);
    const ls2 = await page.evaluate(() => ({ token: localStorage.getItem('stasht_token'), mode: JSON.parse(localStorage.getItem('admin_switch_data') || '{}').current_mode, path: location.pathname }));
    expect(ls2.token === 'chris-token' && ls2.mode === 'personal' && ls2.path === '/leads', 'back on the personal Leads page');
    await context.close();
  }
  console.log(`--- ${width}: one account, no dropdown`);
  {
    const { context, page, state } = await open({ width, seed: { stasht_token: 'chris-token', stasht_user: CHRIS, view_type: 'personal', admin_switch_data: switchData({ admin_accounts: [switchData().admin_accounts[0]] }) }, accounts: [API2[0]] });
    const btn = row(page).getByRole('button', { name: /Open TheRoyalWoodShop/ });
    expect(await btn.count() === 1, 'single account: a direct button');
    expect((await btn.innerText()).includes('4'), 'badge 4');
    expect(await noOverflow(page), 'no horizontal overflow');
    await page.screenshot({ path: `${OUT}/${width}-single.png` });
    await context.close();
  }
  console.log(`--- ${width}: API fails -> menu rows, no badge`);
  {
    const { context, page } = await open({ width, apiFails: true, seed: { stasht_token: 'chris-token', stasht_user: CHRIS, view_type: 'personal', admin_switch_data: switchData() } });
    const btn = row(page).getByRole('button', { name: /Switch account/ });
    expect(await btn.count() === 1, 'still offered from the Profile menu rows');
    expect(!/\d/.test(await btn.innerText()), 'no badge');
    await context.close();
  }
  console.log(`--- ${width}: owner with no admin accounts`);
  {
    const { context, page } = await open({ width, accounts: [], seed: { stasht_token: 'chris-token', stasht_user: CHRIS, view_type: 'personal' } });
    expect(await row(page).getByRole('button').count() === 2, 'only OPEN / CLOSED, nothing new');
    await context.close();
  }
}
await browser.close();
console.log('page errors:', pageErrors.length, pageErrors.slice(0, 5));
console.log(failures.length ? `FAILURES: ${failures.length}` : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
