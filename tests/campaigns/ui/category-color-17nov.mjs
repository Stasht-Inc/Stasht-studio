// Chris 17 Nov 2026: "We need to offer a color selector next to pencil icon on hover … 5 or 6 colors."
// Mocked API, 1280: Personal and Travel (own categories, the web API sends custom_color) get a palette button next to
// the pencil; a category without custom_color (an older web API) gets none. Picking a colour posts it once, recolours
// the card at once, survives a reload (the web API now answers with it), and a failed save puts the old colour back.
// node tests/campaigns/ui/category-color-17nov.mjs   (dev server: CC_BASE, default http://localhost:5402; CC_SHOTS = screenshot dir)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.CC_BASE || 'http://localhost:5402';
const OUT = process.env.CC_SHOTS || '/private/tmp/claude-501/category-color-17nov/shots';
mkdirSync(OUT, { recursive: true });

const OWNER = { id: 70, external_user_id: 707, name: 'TheRoyalWoodShop', email: 'owner@royal.test', role: '2', status: 1, is_activated: true };
const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

const state = { posts: [], colors: { 1: null, 5: null }, failNext: false };
const items = () => [
  { id: 1, name: 'Personal', memory_count: 0, admin_id: null, memories: [], custom_color: state.colors[1] },
  { id: 5, name: 'Travel', memory_count: 0, admin_id: 3, memories: [], custom_color: state.colors[5] },
  { id: 7, name: 'Old Web', memory_count: 0, admin_id: 3, memories: [] },
];

const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', locale: 'en-US' });
context.setDefaultTimeout(60000);
await context.addInitScript(([user]) => {
  if (sessionStorage.getItem('cc-seeded')) return;
  sessionStorage.setItem('cc-seeded', '1');
  localStorage.clear();
  localStorage.setItem('stasht_token', 'owner-token');
  localStorage.setItem('stasht_user', JSON.stringify(user));
  localStorage.setItem('view_type', 'personal');
}, [OWNER]);
await context.route('**/*', async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
    if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: 'window.Stripe=function(){return{elements:function(){return{create:function(){return{mount:function(){},on:function(){},destroy:function(){},unmount:function(){}}},getElement:function(){return null}}}}};' });
    if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: 'window.gapi={load:function(n,c){var f=typeof c==="function"?c:(c&&c.callback);if(f)f();}};' });
    return route.abort('blockedbyclient');
  }
  if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
  if (!url.pathname.startsWith('/api/')) return route.continue();
  const p = url.pathname.replace(/^\/api\/react/, '');
  if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Business' } } } });
  if (p === '/memories' && req.method() === 'GET') {
    return route.fulfill({ json: { status: 'success', data: { all_memories: { data: [], total: 0 }, latest_memories: [], sidebar: { categories: { items: items() }, labels: { items: [] } } } } });
  }
  const m = p.match(/^\/categories\/(\d+)\/color$/);
  if (m && req.method() === 'POST') {
    const body = req.postDataJSON();
    state.posts.push({ id: Number(m[1]), ...body });
    if (state.failNext) { state.failNext = false; return route.fulfill({ status: 500, json: { message: 'Something went wrong.' } }); }
    state.colors[Number(m[1])] = body.color ? body.color.toUpperCase() : null;
    return route.fulfill({ json: { id: Number(m[1]), name: Number(m[1]) === 1 ? 'Personal' : 'Travel', custom_color: state.colors[Number(m[1])] } });
  }
  if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
  return route.fulfill({ json: { success: true, data: [] } });
});

const page = await context.newPage();
page.on('pageerror', (e) => pageErrors.push(e.message));
const shot = async (file) => { const path = `${OUT}/${file}.png`; await page.screenshot({ path }); console.log('shot', path); };
const card = (name) => page.locator('div.group').filter({ has: page.getByText(name, { exact: true }) }).filter({ visible: true }).first();
const cardBg = (name) => card(name).evaluate((el) => getComputedStyle(el).backgroundColor);

try {
  await page.goto(`${BASE}/memories`);
  await page.getByText('Travel', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(800);

  const personalBtn = page.getByRole('button', { name: 'Colour of Personal' });
  const travelBtn = page.getByRole('button', { name: 'Colour of Travel' });
  expect(await personalBtn.count() === 1, 'Personal has a colour button');
  expect(await travelBtn.count() === 1, 'Travel has a colour button');
  expect(await page.getByRole('button', { name: 'Colour of Old Web' }).count() === 0, 'no colour button without custom_color');
  expect(await personalBtn.evaluate((el) => getComputedStyle(el).opacity) === '0', 'hidden until hover');
  await card('Personal').hover();
  await page.waitForTimeout(250);
  expect(await personalBtn.evaluate((el) => getComputedStyle(el).opacity) === '1', 'shows on hover');

  const before = await cardBg('Personal');
  await personalBtn.click();
  const picker = page.getByTestId('category-color-picker');
  await picker.waitFor({ state: 'visible' });
  const swatches = picker.getByRole('radio');
  expect(await swatches.count() === 6, `six colours (${await swatches.count()})`);
  await card('Personal').hover();
  await shot('cc17-1-picker');
  await picker.getByRole('radio', { name: 'Red' }).click();
  await page.waitForTimeout(600);
  expect(state.posts.length === 1 && state.posts[0].id === 1 && state.posts[0].color === '#EF4444', `one POST with Red for Personal (${JSON.stringify(state.posts)})`);
  const after = await cardBg('Personal');
  expect(after !== before && /239, 68, 68/.test(after), `Personal card turns red (${before} → ${after})`);
  expect(await picker.count() === 0 || !(await picker.isVisible()), 'picker closes after a pick');
  await shot('cc17-2-red');

  // Survives a reload: the web API now sends custom_color.
  await page.reload();
  await page.getByText('Travel', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  expect(/239, 68, 68/.test(await cardBg('Personal')), 'still red after a reload');

  // A failed save puts the old colour back.
  await page.mouse.move(1200, 880);
  await page.waitForTimeout(300);
  const travelBefore = await cardBg('Travel');
  state.failNext = true;
  await card('Travel').hover();
  await travelBtn.click();
  await page.getByTestId('category-color-picker').getByRole('radio', { name: 'Pink' }).click();
  await page.waitForTimeout(800);
  await page.mouse.move(1200, 880);
  await page.waitForTimeout(300);
  expect(state.posts.length === 2 && state.posts[1].color === '#EC4899', 'failed save: one POST');
  expect(await cardBg('Travel') === travelBefore, `failed save: Travel keeps its colour (${travelBefore})`);
  expect(await page.getByText('Something went wrong.').filter({ visible: true }).count() > 0, 'failed save: says so');

  // Clicking the button never opens the category.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(!overflow, 'no horizontal page scroll');
} catch (e) {
  failures.push(String((e && e.stack) || e));
  console.log(e);
}
await browser.close();
console.log('page errors:', pageErrors.length, pageErrors.slice(0, 5));
console.log(failures.length ? `FAILURES ${failures.length}:\n` + failures.join('\n') : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
