// Salespeople sign in to their own account (1 Nov 2026, decision 3): an account made for a main account's external
// property must land in its full account view (sidebar with Leads, Users ...; no "Property" badge), never in the
// property view of its own property — whether the API still lists that row (with its flags) or leaves it out. The
// main account's sign-in (account choice with Internal / External properties, property view) is unchanged.
// node tests/properties/ui/salesperson-landing.mjs   (needs the dev server: SL_BASE, default http://localhost:5291)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: SL_SHOTS (default /private/tmp/claude-501/salesperson-ui/shots).
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.SL_BASE || 'http://localhost:5291';
const OUT = process.env.SL_SHOTS || '/private/tmp/claude-501/salesperson-ui/shots';
mkdirSync(OUT, { recursive: true });

// Serpa Chrysler (main account, stash 889) made property 96 for its salesperson Bon Sun (stash 966).
const SERPA = { id: 708, external_user_id: 889, name: 'Serpa Chrysler', email: 'serpa@dealer.test', role: '2', status: 1, is_activated: true };
const BON = { id: 120, external_user_id: 966, name: 'Bon Sun', email: 'bon@dealer.test', role: '2', status: 1, is_activated: true };
const base = { location: 'Toronto, ON', memories_count: 0, users_count: 1, invited_users: [], labels: [], created_at: '2026-10-01T10:00:00Z', is_active: true, status: 1 };
// Bon's own row as his sign-in / properties list sends it today.
const BONS_OWN = { ...base, id: 96, name: 'Bon Sun', unique_id: 'BS-96', user_id: 966, parent_user_id: 889, is_creator: true, user_role: 'owner', property_type: 'external', account_type: 'external', account_created_for_property: true, can_manage: false };
// Serpa's rows: one internal property, and Bon's account as Serpa sees it.
const SERPA_INTERNAL = { ...base, id: 12, name: 'Serpa Downtown', unique_id: 'SD-12', user_id: 889, is_creator: true, user_role: 'owner', property_type: 'internal', account_type: 'internal', account_created_for_property: false, can_manage: true };
const SERPA_SEES_BON = { ...base, id: 96, name: 'Bon Sun', unique_id: 'BS-96', user_id: 966, parent_user_id: 889, is_creator: false, user_role: 'admin', property_type: 'external', account_type: 'external', account_created_for_property: true, can_manage: true };
// Serpa's car, shown to Bon read-only (user_id = the main account).
const SERPA_CAR = { id: 501, user_id: 889, title: '2024 Jeep Grand Cherokee', price: '58900', category: 'new', images_count: 3, main_image: null, location: { formatted: 'Toronto, ON' }, spec_summary: 'STK# J501 / 12 km' };

const failures = [];
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

// who: the account the mocked API signs in / answers for. omitOwnRow: the API leaves Bon's row out.
// seed: localStorage on the first load (null = signed out, i.e. the sign-in page).
async function open({ width = 1280, height = 900, who, omitOwnRow = false, seed = null, path = '/' }) {
  const state = { loginCalls: 0, propertyFetches: 0 };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([seedData]) => {
    if (sessionStorage.getItem('sl-seeded')) return; // only the first load: later loads keep what the app stored
    sessionStorage.setItem('sl-seeded', '1');
    localStorage.clear();
    if (!seedData) return;
    for (const [k, v] of Object.entries(seedData)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, [seed]);
  const ownedFor = () => (who === BON ? (omitOwnRow ? [] : [BONS_OWN]) : [SERPA_INTERNAL]);
  const sharedFor = () => (who === BON ? [] : [SERPA_SEES_BON]);
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
    if (p === '/send-otp') return route.fulfill({ json: { success: true, message: 'OTP sent', channel: 'email' } });
    if (p === '/verify-otp') return route.fulfill({ json: { success: true, verification_token: 'vt-1' } });
    if (p === '/login' && req.method() === 'POST') {
      state.loginCalls++;
      return route.fulfill({ json: { success: true, data: { user: who, token: who === BON ? 'bon-token' : 'serpa-token', collaborators: [], owned_properties: ownedFor(), shared_properties: sharedFor(), partial_admin_access: [] } } });
    }
    if (p === '/properties' && req.method() === 'GET') {
      state.propertyFetches++;
      const owned = ownedFor();
      const shared = sharedFor();
      return route.fulfill({ json: { success: true, data: { properties: [...owned, ...shared], owned_properties: owned, shared_properties: shared, owned_count: owned.length, shared_count: shared.length, total_count: owned.length + shared.length } } });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/cars' || p.startsWith('/cars?')) return route.fulfill({ json: { status: 200, data: { cars: [SERPA_CAR], pagination: { total: 1 }, filters: { categories: ['new'] } } } });
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
  await page.getByRole('button', { name: /Send OTP/ }).filter({ visible: true }).first().click();
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

try {
  // 1. Salesperson signs in; the API still lists his own row with its flags.
  {
    const { page, context, state } = await open({ who: BON, path: '/login?prefill_email=bon@dealer.test' });
    await shot(page, '01-salesperson-sign-in');
    await signIn(page, 'bon@dealer.test');
    // The account choice would open here, before the app; it must not.
    await page.waitForTimeout(1500);
    expect(await page.getByText('Choose Account', { exact: true }).filter({ visible: true }).count() === 0, '1: no account-choice modal');
    await waitForApp(page);
    expect(state.loginCalls === 1, '1: signed in once');
    await accountView(page, '1 salesperson, row listed');
    await shot(page, '02-salesperson-own-account');
    await openProfileMenu(page);
    expect(await page.getByText(/Property Accounts/).filter({ visible: true }).count() === 0, '1: Profile menu offers no property account');
    await shot(page, '03-salesperson-profile-menu');
    await page.keyboard.press('Escape');
    // The main account's cars show up (read-only cards) on Campaigns.
    await page.evaluate(() => localStorage.setItem('stasht_campaigns_view', 'storeels')); // the Storeels grid
    await page.goto(`${BASE}/memories`);
    await waitForApp(page);
    await page.getByText(SERPA_CAR.title).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    const car = await page.getByText(SERPA_CAR.title).filter({ visible: true }).count();
    expect(car > 0, '1: main account\'s car card shows in the salesperson\'s Campaigns');
    await shot(page, '04-salesperson-campaigns-with-parent-car');
    await context.close();
  }

  // 2. Salesperson signs in; the API leaves his row out.
  {
    const { page, context } = await open({ who: BON, omitOwnRow: true, path: '/login?prefill_email=bon@dealer.test' });
    await signIn(page, 'bon@dealer.test');
    await waitForApp(page);
    await accountView(page, '2 salesperson, row omitted');
    await context.close();
  }

  // 3. Cached session from before: property view of his own property (row with flags) → account view.
  {
    const { page, context } = await open({ who: BON, seed: { stasht_token: 'bon-token', stasht_user: BON, view_type: 'property', selected_property: BONS_OWN } });
    await waitForApp(page);
    await accountView(page, '3 cached own property view (flags)');
    await shot(page, '05-salesperson-cached-property-view-reset');
    await context.close();
  }

  // 4. Cached property view stored before the flags existed, API now omits the row → account view.
  {
    const { page, context } = await open({ who: BON, omitOwnRow: true, seed: { stasht_token: 'bon-token', stasht_user: BON, view_type: 'property', selected_property: { id: 96, name: 'Bon Sun', username: 'bon', unique_id: 'BS-96', user_id: 966 } } });
    await waitForApp(page);
    await page.waitForTimeout(1500);
    await accountView(page, '4 cached unflagged property view, row omitted');
    await context.close();
  }

  // 5. Left-over pending switch to his property (old modal pick / activation link), row omitted → no endless
  //    "Loading Stasht Studio...", account view.
  {
    const { page, context } = await open({ who: BON, omitOwnRow: true, seed: { stasht_token: 'bon-token', stasht_user: BON, view_type: 'personal', pending_property_switch: '96' } });
    await waitForApp(page);
    await accountView(page, '5 pending switch to own property, row omitted');
    await context.close();
  }
  {
    const { page, context } = await open({ who: BON, seed: { stasht_token: 'bon-token', stasht_user: BON, view_type: 'personal', pending_property_switch: 'first' } });
    await waitForApp(page);
    await accountView(page, '5b pending "first" with only his own row');
    await context.close();
  }

  // 6. Main account: unchanged. Account choice lists Internal (1) + External (1); picking the internal property
  //    opens its property view (Property badge).
  {
    const { page, context } = await open({ who: SERPA, path: '/login?prefill_email=serpa@dealer.test' });
    await signIn(page, 'serpa@dealer.test');
    const props = page.getByText(/Properties \(2\)/).filter({ visible: true }).first();
    await page.getByText('Choose Account', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 });
    await props.waitFor({ state: 'visible', timeout: 15000 });
    await shot(page, '06-main-account-choice');
    await props.click();
    await page.waitForTimeout(400);
    expect(await page.getByText('Internal (1)').filter({ visible: true }).count() > 0, '6: main account sees Internal (1)');
    expect(await page.getByText('External (1)').filter({ visible: true }).count() > 0, '6: main account sees External (1) (its salesperson)');
    await shot(page, '07-main-account-choice-properties');
    await page.getByText('Serpa Downtown').filter({ visible: true }).first().click();
    await waitForApp(page);
    await page.waitForTimeout(1500);
    const v = await view(page);
    const badge = await visibleText(page, 'Property');
    console.log('6 main → internal', JSON.stringify({ badge, ...v }));
    expect(v.view === 'property' && JSON.parse(v.selected || '{}').id === 12, '6: main account opens its internal property view');
    expect(badge > 0, '6: Property badge in the internal property view');
    await shot(page, '08-main-account-internal-property-view');
    await context.close();
  }

  // 7. Main account's Profile menu still counts both properties.
  {
    const { page, context } = await open({ who: SERPA, seed: { stasht_token: 'serpa-token', stasht_user: SERPA, view_type: 'personal' } });
    await waitForApp(page);
    await accountView(page, '7 main account personal');
    await openProfileMenu(page);
    expect(await page.getByText('Property Accounts (2)').filter({ visible: true }).count() > 0, '7: main Profile menu: Property Accounts (2)');
    expect(await page.getByText('1 internal, 1 external').filter({ visible: true }).count() > 0, '7: main Profile menu: 1 internal, 1 external');
    await shot(page, '09-main-account-profile-menu');
    await context.close();
  }

  // 8. Phone: salesperson lands in the account.
  {
    const { page, context } = await open({ width: 390, height: 844, who: BON, path: '/login?prefill_email=bon@dealer.test' });
    await signIn(page, 'bon@dealer.test');
    await page.waitForTimeout(4000);
    const v = await view(page);
    expect(v.view !== 'property' && !v.selected, '8 phone: account view stored');
    expect(await visibleText(page, 'Property') === 0, '8 phone: no Property badge');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '8 phone: no sideways scroll');
    await shot(page, '10-phone-salesperson-own-account');
    await context.close();
  }
} catch (e) {
  failures.push(`crashed: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
}

console.log('blocked hosts:', [...blocked].join(', ') || 'none');
if (pageErrors.length) console.log('page errors:', [...new Set(pageErrors)].slice(0, 10));
if (failures.length) {
  console.log(`\n${failures.length} FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nALL PASSED');
