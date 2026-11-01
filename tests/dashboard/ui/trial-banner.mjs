// Dashboard trial banner (Chris, 1 Nov 2026): TheRoyalWoodShop has a plan trial (Admin Portal "Trial Period Ends
// 2027-01-28") and no property of its own, so the banner — which only read an owned property's trial_ends_at — never
// showed. GET /properties now sends the account's plan trial as data.account_trial; the banner shows it first, and the
// old owned-property trial still shows when there is no account trial.
// node tests/dashboard/ui/trial-banner.mjs   (needs the dev server: TB_BASE, default http://127.0.0.1:5293)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: TB_SHOTS (default /private/tmp/claude-501/trial-banner-ui/shots).
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.TB_BASE || 'http://127.0.0.1:5293';
const OUT = process.env.TB_SHOTS || '/private/tmp/claude-501/trial-banner-ui/shots';
mkdirSync(OUT, { recursive: true });

// TheRoyalWoodShop: login id 708, stash 959, Business plan.
const ROYALWOOD = { id: 708, external_user_id: 959, name: 'TheRoyalWoodShop', email: 'owner@royalwood.test', role: '2', status: 1, is_activated: true, plan_id: 3 };

const fmt = (y, m, d) => new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
const daysUntil = (y, m, d) => {
  const t = new Date();
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 86400000);
};

// Dashboard cards as the fixed API reports a catalogue-only account (products = campaign cards, their photos = media).
const card = (count, period = 0) => ({ count, formatted: String(count), period_count: period, previous_period_count: 0, period_label: 'This Week', percentage: { value: 0, text: 'No previous data', trend: period > 0 ? 'up' : 'neutral' } });
const DASHBOARD = {
  statistics: {
    total_memories: card(454, 2),
    total_media: card(1630, 6),
    total_users: card(0),
    storage: { used: 0, formatted: '0 MB', period_used: 0, period_formatted: '0 MB', limit: 536870912000, limit_formatted: '500 GB', percentage_used: 0, available: 536870912000, available_formatted: '500 GB', period_label: 'This Week' },
  },
  latest_memories: [],
  date_range: { start_date: '2026-10-26', end_date: '2026-11-01', type: 'weekly' },
};

const failures = [];
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

// properties: what GET /properties answers (owned_properties / account_trial).
async function open({ properties, width = 1280, height = 900 }) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', timezoneId: 'America/Toronto', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('tb-seeded')) return;
    sessionStorage.setItem('tb-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'royalwood-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
  }, [ROYALWOOD]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    const remoteApi = !local && url.pathname.startsWith('/api/react/');
    if (!local && !remoteApi) {
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
    if (p === '/properties' && req.method() === 'GET') {
      const owned = properties.owned_properties || [];
      return route.fulfill({ json: { success: true, data: { properties: owned, owned_properties: owned, shared_properties: [], owned_count: owned.length, shared_count: 0, total_count: owned.length, ...('account_trial' in properties ? { account_trial: properties.account_trial } : {}) } } });
    }
    if (p === '/dashboard') return route.fulfill({ json: { success: true, data: DASHBOARD } });
    if (p === '/user/memory-counts') return route.fulfill({ json: { success: true, data: { memory_counts: { total_memories: 0, total_memory_images: 0, published_memories: 0, active_collaborators: 0 } } } });
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: true, reason: null, item_count: 454, source: null, scan: null, limits: { item_limit: 500, sync_now_minutes: 15 } } } });
    if (p.startsWith('/website-catalogue/items')) return route.fulfill({ json: { success: true, data: { items: [], pagination: { current_page: 1, per_page: 1, total: 454, last_page: 454 } } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Business' } } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => { pageErrors.push(e.message); if (process.env.TB_DEBUG) console.log('pageerror', e.stack); });
  await page.goto(`${BASE}/`);
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).first().waitFor({ state: 'visible', timeout: 40000 });
  await page.waitForTimeout(2500); // properties + dashboard calls settle
  return { context, page };
}

async function shot(page, file) {
  const path = `${OUT}/${file}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('shot', path);
}

const banner = (page) => page.locator('[role="status"]').filter({ hasText: /trial/i }).first();

try {
  // 1. TheRoyalWoodShop: plan trial, no property of its own → the banner shows the account trial (no property name).
  {
    const { page, context } = await open({ properties: { owned_properties: [], account_trial: { trial_ends_at: '2027-01-28T23:59:59+00:00', trial_ends_on: '2027-01-28', trial_ended: false } } });
    const text = (await banner(page).innerText().catch(() => '')).replace(/\s+/g, ' ');
    console.log('1 banner:', text);
    const left = daysUntil(2027, 1, 28);
    expect(text.includes('Free trial'), '1: "Free trial" banner shows');
    expect(text.includes(`Your trial ends on ${fmt(2027, 1, 28)} (${left} ${left === 1 ? 'day' : 'days'} left)`), `1: ends on ${fmt(2027, 1, 28)}, ${left} days left, no property name`);
    expect(await page.getByText('Total Campaigns').filter({ visible: true }).count() > 0, '1: dashboard cards render');
    await shot(page, '01-royalwood-account-trial-desktop');
    await context.close();
  }
  // 1b. The same on a phone.
  {
    const { page, context } = await open({ width: 390, height: 844, properties: { owned_properties: [], account_trial: { trial_ends_at: '2027-01-28T23:59:59+00:00', trial_ends_on: '2027-01-28', trial_ended: false } } });
    expect((await banner(page).innerText().catch(() => '')).includes('Free trial'), '1b: banner shows on a phone');
    await shot(page, '02-royalwood-account-trial-phone');
    await context.close();
  }
  // 2. Older shape / no account trial: an owned property's trial still shows with its name.
  {
    const { page, context } = await open({ properties: { owned_properties: [{ id: 3, name: 'Royalwood Showroom', trial_ends_at: '2026-12-15 23:59:59', trial_ended: false, account_type: 'internal', is_creator: true }] } });
    const text = (await banner(page).innerText().catch(() => '')).replace(/\s+/g, ' ');
    console.log('2 banner:', text);
    expect(text.includes(`Your trial for Royalwood Showroom ends on ${fmt(2026, 12, 15)}`), '2: property trial still shows, with the property name');
    await shot(page, '03-property-trial-fallback');
    await context.close();
  }
  // 3. Ended account trial (before the nightly downgrade removes it).
  {
    const { page, context } = await open({ properties: { owned_properties: [], account_trial: { trial_ends_at: '2026-10-31T23:59:59+00:00', trial_ends_on: '2026-10-31', trial_ended: true } } });
    const text = (await banner(page).innerText().catch(() => '')).replace(/\s+/g, ' ');
    console.log('3 banner:', text);
    expect(text.includes('Trial ended') && text.includes(`ended on ${fmt(2026, 10, 31)}`), '3: "Trial ended" banner');
    await shot(page, '04-account-trial-ended');
    await context.close();
  }
  // 4. No trial anywhere → no banner.
  {
    const { page, context } = await open({ properties: { owned_properties: [], account_trial: null } });
    expect(await page.locator('[role="status"]').filter({ hasText: /trial/i }).count() === 0, '4: no trial → no banner');
    await shot(page, '05-no-trial');
    await context.close();
  }
} catch (e) {
  failures.push(`crashed: ${e.message}`);
  console.log(e);
} finally {
  await browser.close();
}

console.log('blocked external hosts:', [...blocked].join(', ') || 'none');
if (pageErrors.length) console.log('page errors:', pageErrors.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
