// Chris 19-20 Nov 2026 (Admin Portal point 9, Deepak): TheRoyalWoodShop's trial now comes from its custom plan's Terms
// ("Add trial date"). The Admin Portal writes it to the same account trial, so the Dashboard shows the same amber banner it
// showed on the Enterprise plan; GET /properties adds account_trial.custom_plan, and the text says billing for the plan
// starts after the trial (not "moves to Starter"); with emailed invoices there is no add-card line.
// node tests/dashboard/ui/c20-custom-plan-trial.mjs   (dev server: TB_BASE, default http://127.0.0.1:5233; TB_SHOTS)
// Harness copied from tests/dashboard/ui/trial-banner.mjs: every API call answered here, every non-local request aborted.
// service. You won't be billed until the trial is over" with "Add Payment Method", which opens the add-card modal.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.TB_BASE || 'http://127.0.0.1:5233';
const OUT = process.env.TB_SHOTS || '/private/tmp/claude-501/c20-trial-banner/shots';
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
// cards: what GET /stripe/payment-methods answers — 'none' (no card), 'card' (one card), 'error' (the call fails).
const ADD_CARD = "Add credit card info to avoid disruption to service. You won't be billed until the trial is over";
const paymentCalls = [];
async function open({ properties, width = 1280, height = 900, cards = 'none', coveredBy = null }) {
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
    if (p === '/stripe/payment-methods' && req.method() === 'GET') {
      paymentCalls.push(cards);
      if (cards === 'error') return route.fulfill({ status: 500, json: { success: false, error: 'Stripe unavailable' } });
      const list = cards === 'card' ? [{ id: 'pm_1', brand: 'visa', last4: '4242', exp_month: 4, exp_year: 2030, is_default: true }]
        : cards === 'expired' ? [{ id: 'pm_2', brand: 'visa', last4: '1111', exp_month: 12, exp_year: 2026, is_default: true }] : [];
      return route.fulfill({ json: { success: true, payment_methods: list } });
    }
    if (p === '/dashboard') return route.fulfill({ json: { success: true, data: DASHBOARD } });
    if (p === '/user/memory-counts') return route.fulfill({ json: { success: true, data: { memory_counts: { total_memories: 0, total_memory_images: 0, published_memories: 0, active_collaborators: 0 } } } });
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: true, reason: null, item_count: 454, source: null, scan: null, limits: { item_limit: 500, sync_now_minutes: 15 } } } });
    if (p.startsWith('/website-catalogue/items')) return route.fulfill({ json: { success: true, data: { items: [], pagination: { current_page: 1, per_page: 1, total: 454, last_page: 454 } } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Business', ...(coveredBy ? { plan_covered_by: coveredBy } : {}) } } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => { pageErrors.push(e.message); if (process.env.TB_DEBUG) console.log('pageerror', e.stack); });
  await page.goto(`${BASE}/dashboard`); // Stats (was Dashboard; '/' opens Campaigns since 24 Nov)
  await page.getByRole('heading', { name: 'Stats', exact: true }).first().waitFor({ state: 'visible', timeout: 40000 });
  await page.waitForTimeout(2500); // properties + dashboard calls settle
  return { context, page };
}

async function shot(page, file) {
  const path = `${OUT}/${file}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('shot', path);
}

const banner = (page) => page.locator('[role="status"]').filter({ hasText: /trial/i }).first();
// Studio's amber notice: the Dashboard's limit Alerts (border-amber-200 bg-amber-50 text-amber-800, AlertTriangle).
async function looksAmber(page) {
  return banner(page).evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, border: cs.borderTopColor, icon: !!el.querySelector('svg.lucide-triangle-alert, svg.lucide-alert-triangle'), slot: el.getAttribute('data-slot') };
  }).catch(() => null);
}
const AMBER_50 = 'rgb(255, 251, 235)';
const AMBER_200 = 'rgb(253, 230, 138)';

const TRIAL = (ended, collection = 'send_invoice') => ({ owned_properties: [], account_trial: {
  trial_ends_at: '2026-12-30T23:59:59+00:00', trial_ends_on: '2026-12-30', trial_ended: ended,
  custom_plan: { name: 'TheRoyalWoodShop', collection_method: collection } } });

try {
  for (const width of [1280, 390]) {
    const { page, context } = await open({ properties: TRIAL(false), width, height: width < 1024 ? 844 : 900 });
    const text = (await banner(page).innerText().catch(() => '')).replace(/\s+/g, ' ');
    console.log(width, 'banner:', text);
    const left = daysUntil(2026, 12, 30);
    expect(text.includes('Free trial'), `${width}: the same "Free trial" banner shows`);
    // Days left are counted in the browser's zone (America/Toronto), so allow the machine's own zone to be a day apart.
    const m = /Your trial ends on (.+?) \((\d+) days? left\)\. After that, billing for your TheRoyalWoodShop plan starts\./.exec(text);
    expect(m && m[1] === fmt(2026, 12, 30) && Math.abs(+m[2] - left) <= 1, `${width}: custom plan wording (${m && m[2]} days left)`);
    expect(!text.includes('Starter'), `${width}: never says Starter`);
    expect(!text.includes(ADD_CARD), `${width}: emailed invoices → no add-card line`);
    const look = await looksAmber(page);
    expect(look?.bg === AMBER_50 && look?.border === AMBER_200 && look?.icon === true, `${width}: same amber Alert as the Enterprise trial`);
    await shot(page, `c20-custom-plan-trial-${width}`);
    await context.close();
  }
  {
    const { page, context } = await open({ properties: TRIAL(true) });
    const text = (await banner(page).innerText().catch(() => '')).replace(/\s+/g, ' ');
    expect(text.includes('Trial ended') && text.includes(`Your trial ended on ${fmt(2026, 12, 30)}.`) && !text.includes('Starter'), 'ended: "Trial ended" without Starter');
    await shot(page, 'c20-custom-plan-trial-ended-1280');
    await context.close();
  }
  {
    const { page, context } = await open({ properties: TRIAL(false, 'charge_automatically') });
    const text = (await banner(page).innerText().catch(() => '')).replace(/\s+/g, ' ');
    expect(text.includes(ADD_CARD), 'card-paid custom plan, no card → add-card line still shows');
    await context.close();
  }
  {
    // A plain Enterprise / Business trial is unchanged.
    const { page, context } = await open({ properties: { owned_properties: [], account_trial: { trial_ends_at: '2027-01-28T23:59:59+00:00', trial_ends_on: '2027-01-28', trial_ended: false } } });
    const text = (await banner(page).innerText().catch(() => '')).replace(/\s+/g, ' ');
    expect(text.includes('After that your account moves to the Starter plan.'), 'plain plan trial keeps its Starter wording');
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`blocked hosts: ${[...blocked].join(', ') || 'none'}`);
if (pageErrors.length) console.log('page errors:', pageErrors);
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
