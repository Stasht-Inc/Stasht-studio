// Dashboard "User Engagement" chart (Chris, 11 Nov 2026): it showed "Story Views" and 0 everywhere for Royal Wood (455
// campaigns). It now shows All campaigns' views by default, with a filter for Newsletters and Storeels (gray, not purple);
// the legend, totals and chart follow the filter. Also: a card with nothing added this week no longer says "-100% vs
// last week" next to "+0 this week".
// node tests/dashboard/ui/engagement.mjs   (needs the dev server: DE_BASE, default http://127.0.0.1:5323)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.DE_BASE || 'http://127.0.0.1:5323';
const OUT = process.env.DE_SHOTS || '/private/tmp/claude-501/-Users-deepaksharma-Pictures-Personal-Works-Stasht-Project/5e3f503a-2015-47bf-8e38-f032004a0a87/scratchpad/db-shots';
mkdirSync(OUT, { recursive: true });

const ROYALWOOD = { id: 708, external_user_id: 959, name: 'TheRoyalWoodShop', email: 'owner@royalwood.test', role: '2', status: 1, is_activated: true, plan_id: 3 };
const card = (count, period, previous, trend, value) => ({ count, formatted: String(count), period_count: period, previous_period_count: previous, period_label: 'This Week', percentage: { value, text: '', trend } });
const DASHBOARD = {
  statistics: {
    total_memories: card(455, 0, 3, 'down', 100), // nothing added this week, 3 last week
    total_media: card(3, 0, 0, 'neutral', 0),
    total_users: card(5, 1, 0, 'up', 0),
    storage: { used: 0, formatted: '0 MB', period_used: 0, period_formatted: '0 MB', limit: 536870912000, limit_formatted: '500 GB', percentage_used: 0, available: 536870912000, available_formatted: '500 GB', period_label: 'This Week' },
  },
  latest_memories: [],
  date_range: { start_date: '2026-11-09', end_date: '2026-11-15', type: 'weekly' },
};
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SERIES = {
  campaigns: { values: [4, 9, 12, 0, 0, 0, 0], label: 'Campaign views', clicks: null },
  newsletters: { values: [0, 7, 2, 0, 0, 0, 0], label: 'Newsletter opens', clicks: 3 },
  storeels: { values: [1, 0, 5, 0, 0, 0, 0], label: 'Storeel views', clicks: 2 },
};
const engagement = (metric) => {
  const s = SERIES[metric];
  const total = s.values.reduce((a, b) => a + b, 0);
  const peak = Math.max(...s.values);
  return {
    chart_data: DAYS.map((d, i) => ({ label: d, view_count: s.values[i] })), total_views: total, total_clicks: s.clicks,
    previous_views: 10, peak_period: DAYS[s.values.indexOf(peak)], peak_value: peak,
    growth: { percentage: 50, trend: 'up', color: 'green', text: 50 }, metric, metric_label: s.label,
    period_type: 'weekly', period_heading: 'This Week', current_offset: 0,
  };
};

const failures = [];
const pageErrors = [];
const metricCalls = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open(width, height = 900) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', timezoneId: 'America/Toronto', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('de-seeded')) return;
    sessionStorage.setItem('de-seeded', '1');
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
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: 'window.Stripe=function(){return{elements:function(){return{create:function(){return{mount:function(){},on:function(){},destroy:function(){},unmount:function(){}}},getElement:function(){return null}}}}};' });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: 'window.gapi={load:function(n,c){var f=typeof c==="function"?c:(c&&c.callback);if(f)f();}};' });
      return route.abort('blockedbyclient');
    }
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (p === '/dashboard') return route.fulfill({ json: { success: true, data: DASHBOARD } });
    if (p === '/dashboard/user-engagement') {
      const metric = url.searchParams.get('metric') || 'campaigns';
      metricCalls.push(metric);
      return route.fulfill({ json: { success: true, data: engagement(metric) } });
    }
    if (p === '/properties') return route.fulfill({ json: { success: true, data: { properties: [], owned_properties: [], shared_properties: [], owned_count: 0, shared_count: 0, total_count: 0 } } });
    if (p === '/user/memory-counts') return route.fulfill({ json: { success: true, data: { memory_counts: { total_memories: 455, total_memory_images: 3, published_memories: 0, active_collaborators: 0 } } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Business' } } } });
    if (p === '/stripe/payment-methods') return route.fulfill({ json: { success: true, payment_methods: [] } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/dashboard`); // Stats (was Dashboard; '/' opens Campaigns since 24 Nov)
  await page.getByRole('heading', { name: 'Stats', exact: true }).first().waitFor({ state: 'visible', timeout: 40000 });
  await page.waitForTimeout(2500);
  return { context, page };
}

const shot = async (page, file) => { await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: false }); console.log('shot', `${OUT}/${file}.png`); };

// ---- 1280: the chart, its filter and the cards ----
{
  console.log('1280');
  const { context, page } = await open(1280);
  const legend = page.getByTestId('engagement-legend');
  const total = page.getByTestId('engagement-total');
  expect((await legend.textContent()) === 'Campaign views', 'default legend is "Campaign views" (was "Story Views")');
  expect((await total.textContent()).trim().startsWith('25'), 'All campaigns total = 25');
  expect(metricCalls[0] === 'campaigns', 'first request asks for metric=campaigns');
  expect(await page.getByText('Story Views').count() === 0, 'no "Story Views" label');

  // Cards: "+0 this week" no longer sits next to "-100% vs last week".
  const campaignsCard = page.locator('div', { has: page.getByRole('heading', { name: 'Total Campaigns' }) }).last();
  expect(!/-100%/.test(await campaignsCard.textContent()), 'Total Campaigns: no "-100% vs last week" when +0 this week');
  expect(await page.getByText('+1 this week').count() === 1, 'Total Users shows its count line');
  await shot(page, 'engagement-1280-all');

  const trigger = page.getByTestId('engagement-metric');
  await trigger.click();
  const option = page.getByRole('option', { name: 'Newsletters' });
  await option.waitFor({ state: 'visible' });
  const checked = page.getByRole('option', { name: 'All campaigns' });
  const bg = await checked.evaluate((el) => getComputedStyle(el).backgroundColor);
  if (process.env.DE_DEBUG) console.log(await checked.evaluate((el) => {
    const hits = [];
    for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) { if (r.selectorText && el.matches(r.selectorText) && /background/.test(r.cssText)) hits.push(r.cssText.slice(0, 160)); } } catch (e) {} }
    return el.className.split(' ').filter((c) => /aria|bg|state/.test(c)).join(' ') + '\n' + hits.join('\n');
  }));
  expect(!/108,\s*96,\s*255|99,\s*102,\s*241|123,\s*104,\s*238/.test(bg), `selected option is gray, not purple (${bg})`);
  await shot(page, 'engagement-1280-menu');
  await option.click();
  await page.waitForTimeout(800);
  expect((await legend.textContent()) === 'Newsletter opens', 'Newsletters: legend "Newsletter opens"');
  expect((await total.textContent()).includes('9') && (await page.getByTestId('engagement-clicks').textContent()) === '3 clicks', 'Newsletters: 9 opens, 3 clicks');
  expect(await page.getByText('Total Opens').count() === 1, 'Newsletters: "Total Opens" label');
  const triggerBorder = await trigger.evaluate((el) => getComputedStyle(el).borderTopColor);
  expect(!/108,\s*96,\s*255/.test(triggerBorder), `filter trigger is gray (${triggerBorder})`);
  await shot(page, 'engagement-1280-newsletters');

  await trigger.click();
  await page.getByRole('option', { name: 'Storeels' }).click();
  await page.waitForTimeout(800);
  expect((await legend.textContent()) === 'Storeel views', 'Storeels: legend "Storeel views"');
  expect((await total.textContent()).trim().startsWith('6'), 'Storeels: 6 views');
  expect(metricCalls.includes('newsletters') && metricCalls.includes('storeels'), 'each filter asks the API for its metric');
  await shot(page, 'engagement-1280-storeels');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow <= 0, `no horizontal scroll at 1280 (${overflow})`);
  await context.close();
}

// ---- 390: the chart is hidden on phones (as before); the cards still render without overflow ----
{
  console.log('390');
  const { context, page } = await open(390, 844);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow <= 0, `no horizontal scroll at 390 (${overflow})`);
  expect(!/-100%/.test(await page.locator('body').textContent()), '390: no "-100%" next to "+0 this week"');
  await shot(page, 'engagement-390');
  await context.close();
}

await browser.close();
if (pageErrors.length) console.log('page errors:', pageErrors);
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
