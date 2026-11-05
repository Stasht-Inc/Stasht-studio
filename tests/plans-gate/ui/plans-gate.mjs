// Chris, 5 Nov 2026 (points 1, 4, 6): sign-out → new account showed the previous account's property view behind a plan
// picker without Starter and under "Meet Alvin"; a Pedalheads property got stuck on the picker; TheBodyPolitik on Teams
// had no Dashboard.
// node tests/plans-gate/ui/plans-gate.mjs   (needs the dev server: PG_BASE, default http://127.0.0.1:5297)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: PG_SHOTS.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.PG_BASE || 'http://127.0.0.1:5297';
const OUT = process.env.PG_SHOTS || '/private/tmp/claude-501/-Users-deepaksharma-Pictures-Personal-Works-Stasht-Project/358f851f-e1b3-4c65-b98a-a40284346ac4/scratchpad/chris-5nov-shots/pg';
mkdirSync(OUT, { recursive: true });
const ONLY = process.env.PG_ONLY ? process.env.PG_ONLY.split(',') : null;

// Accounts (login id / stash id). Pedalheads: Business, owns the internal property Point Grey (41).
const PEDALHEADS = { id: 501, external_user_id: 801, name: 'Pedalheads', email: 'owner@pedalheads.test', role: '2', status: 1, is_activated: true };
const NEWBIE = { id: 777, external_user_id: 977, name: 'Kits Beach Cycles', email: 'hello@kitsbeach.test', role: '3', status: 1, is_activated: true };
const BODY = { id: 650, external_user_id: 950, name: 'TheBodyPolitik', email: 'owner@bodypolitik.test', role: '3', status: 1, is_activated: true };
const POINT_GREY = { id: 41, name: 'Point Grey', username: 'pointgrey', unique_id: 'PG41', code: 'PG41', user_id: 801, location: 'Vancouver', user_role: 'admin', is_creator: true, property_type: 'internal', account_type: 'internal', status: 'active' };

// A property of Pedalheads that the new account was invited to (it is a member: shared_properties).
const KITS_SHARED = { id: 55, name: 'Kitsilano Camp', username: 'kitscamp', unique_id: 'KC55', code: 'KC55', user_id: 801, location: 'Vancouver', user_role: 'viewer', is_creator: false, property_type: 'internal', account_type: 'internal', status: 'active' };
// A property the new account owns whose trial has ended (MemoriesPage's "Trial Ended" picker).
const KITS_OWN = { id: 60, name: 'Kits Beach Shop', username: 'kitsshop', unique_id: 'KS60', code: 'KS60', user_id: 977, location: 'Vancouver', user_role: 'admin', is_creator: true, property_type: 'internal', account_type: 'internal', status: 'active', trial_ended: true, trial_ends_at: '2026-10-01T00:00:00Z' };
const TOKENS = { 'pedal-token': PEDALHEADS, 'newbie-token': NEWBIE, 'body-token': BODY };
const tokenOf = (user) => Object.keys(TOKENS).find((t) => TOKENS[t].id === user.id);

const failures = [];
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const run = (name) => !ONLY || ONLY.some((o) => name.startsWith(o));

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

/**
 * plans: token → plan_name for GET /user/storage-overview (mutable during a test).
 * seed: localStorage to start from (null = signed out).
 */
async function open({ seed, plans = {}, width = 1280, height = 900, path = '/', waitFor = null, newbieMember = false, newbieOwns = false, overview = 'ok', stripeSub = null, widgets = null }) {
  const calls = [];
  const state = { plans: { 'pedal-token': 'Business', 'newbie-token': 'Starter', 'body-token': 'Intermediate', ...plans }, downgraded: false, newbieMember, newbieOwns, overview, overviewCalls: 0, stripeSub, widgets };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', timezoneId: 'America/Vancouver', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([entries]) => {
    if (localStorage.getItem('pg-seeded')) return; // once per browser: a second tab shares the first one's storage
    localStorage.clear();
    localStorage.setItem('pg-seeded', '1');
    for (const [k, v] of Object.entries(entries || {})) localStorage.setItem(k, v);
  }, [seed]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    const remoteApi = !local && url.pathname.startsWith('/api/react/');
    if (!local && !remoteApi) {
      blocked.add(url.hostname);
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: 'window.Stripe=function(){return{elements:function(){return{create:function(){return{mount:function(){},on:function(){},destroy:function(){},unmount:function(){}}},getElement:function(){return null}}}}};' });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: 'window.gapi={load:function(n,c){var f=typeof c==="function"?c:(c&&c.callback);if(f)f();}};' });
      return route.abort('blockedbyclient');
    }
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/') && !remoteApi) return route.continue();
    const p = url.pathname.replace(/^.*\/api\/react/, '');
    const auth = req.headers()['authorization'] || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    const me = TOKENS[token] || null;
    let body = null;
    try { body = req.postDataJSON(); } catch { body = null; }
    calls.push({ method: req.method(), path: p, token, body });

    // Sign-in / sign-up (passwordless OTP: send-otp → verify-otp → login / signup with the verification token).
    if (p === '/send-otp') return route.fulfill({ json: { success: true, message: 'OTP sent' } });
    if (p === '/verify-otp') return route.fulfill({ json: { success: true, verification_token: 'vt-1', data: { verification_token: 'vt-1' } } });
    if (p === '/login' && req.method() === 'POST') {
      const who = Object.values(TOKENS).find((u) => u.email === body?.email) || NEWBIE;
      return route.fulfill({ json: { success: true, message: 'Login successful', data: { user: who, token: tokenOf(who), token_type: 'Bearer', is_internal: true, collaborators: [], partial_admin_access: [], properties: [], owned_properties: [], shared_properties: [] } } });
    }
    if (p === '/signup' && req.method() === 'POST') {
      return route.fulfill({ json: { success: true, message: 'Account created', data: { user: NEWBIE, token: 'newbie-token' } } });
    }
    if (p === '/logout') return route.fulfill({ json: { success: true } });
    if (p === '/check-user-exists' || p === '/check-email' || p === '/check-phone') return route.fulfill({ json: { success: true, exists: false } });

    if (p === '/user/storage-overview') {
      state.overviewCalls++;
      // overview: 'ok' | 'covered' (a main account pays) | '429' (rate limited every time)
      if (state.overview === '429') return route.fulfill({ status: 429, headers: { 'Retry-After': '0' }, json: { message: 'Too Many Attempts.' } });
      const plan = state.downgraded ? 'Starter' : (state.plans[token] ?? 'Starter');
      const coveredBy = state.overview === 'covered' ? { id: 801, name: 'Pedalheads' } : null;
      const allowance = /business|professional/i.test(plan) ? 250 : /team|intermediate/i.test(plan) ? 100 : 5;
      return route.fulfill({ json: { success: true, data: { storage_overview: { plan_id: 1, plan_name: coveredBy ? 'Business' : plan, plan_covered_by: coveredBy, ai_connects: allowance, used_token: allowance === 100 ? 10 : 0, plan_storage_size_gb: 500, total_storage_used_mb: 12, is_unlimited: false } } } });
    }
    if (p === '/properties' && req.method() === 'GET') {
      const owned = me && me.id === PEDALHEADS.id ? [POINT_GREY] : me && me.id === NEWBIE.id && state.newbieOwns ? [KITS_OWN] : [];
      const shared = me && me.id === NEWBIE.id && state.newbieMember ? [KITS_SHARED] : [];
      return route.fulfill({ json: { success: true, data: { properties: owned, owned_properties: owned, shared_properties: shared, owned_count: owned.length, shared_count: shared.length, total_count: owned.length + shared.length } } });
    }
    if (/^\/properties\/41\//.test(p)) {
      if (me && me.id === PEDALHEADS.id) return route.fulfill({ json: { success: true, data: { memories: [], categories: [], pagination: { total: 0, current_page: 1, last_page: 1 } } } });
      return route.fulfill({ status: 403, json: { status: 'error', message: 'You do not have access to this property' } });
    }
    if (p === '/ai-credits/balance') {
      const plan = state.plans[token] ?? 'Starter';
      const n = /business|professional/i.test(plan) ? 250 : /team|intermediate/i.test(plan) ? 100 : 5;
      return route.fulfill({ json: { status: 1, data: { total_credits: n, monthly_credits: { available: n, allocation: n, used_this_month: 0, usage_percentage: 0, next_reset_date: null, days_until_reset: 0 }, addon_credits: { available: 0, total_purchased: 0, breakdown: [] }, plan: { name: plan, monthly_allocation: n } } } });
    }
    if (p === '/ai-credits/usage-history') return route.fulfill({ json: { status: 1, data: { usage: [], summary: { total_credits_used: 0, by_service: { ai_captions: 0, ai_memory_wizard: 0 } }, pagination: { current_page: 1, total_pages: 1, total_records: 0, per_page: 10 } } } });
    if (p === '/alvin/status') return route.fulfill({ json: { success: true, data: { enabled: true, has_used: false, setup: [] } } });
    if (p === '/stripe/subscription') return route.fulfill({ json: { success: true, active_subscriptions: state.stripeSub ? [state.stripeSub] : [] } });
    if (p === '/widgets' && req.method() === 'GET' && state.widgets) return route.fulfill({ json: { success: true, data: state.widgets, team_options: [], business_plan_required: true } });
    if (p === '/stripe/create-setup-intent') { state.setupIntent = true; return route.fulfill({ json: { success: true, clientSecret: 'seti_x' } }); }
    if (p === '/stripe/downgrade-to-starter') { state.downgraded = true; return route.fulfill({ json: { success: true, message: 'User downgraded to starter plan successfully' } }); }
    if (p === '/stripe/payment-methods') return route.fulfill({ json: { success: true, payment_methods: [] } });
    if (p === '/user/memory-counts') return route.fulfill({ json: { success: true, data: { memory_counts: { total_memories: 0, total_memory_images: 0, published_memories: 0, active_collaborators: 0 } } } });
    if (p === '/dashboard') return route.fulfill({ json: { success: true, data: { statistics: {}, latest_memories: [] } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => { pageErrors.push(e.message); if (process.env.PG_DEBUG) console.log('pageerror', e.stack); });
  await page.goto(`${BASE}${path}`);
  if (waitFor) await waitFor(page);
  return { context, page, calls, state };
}

const session = (user, extra = {}) => ({ stasht_token: tokenOf(user), stasht_user: JSON.stringify(user), ...extra });
const NEW_FLAG = (user) => ({ is_new_user: 'true', is_new_user_account: String(user.id) });
const STALE_POINT_GREY = { view_type: 'property', selected_property: JSON.stringify(POINT_GREY) };

async function shot(page, file) {
  const path = `${OUT}/${file}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('shot', path);
}

const gateBanner = (page) => page.getByText('Select a plan to unlock the Stasht portal').filter({ visible: true });
const gateDialog = (page) => page.getByRole('dialog', { name: 'Upgrade Your Plan' });
const alvinIntro = (page) => page.locator('[data-name="AlvinIntroPopover"]');
const inViewport = async (locator, width, height) => {
  const box = await locator.boundingBox().catch(() => null);
  return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1;
};
const storageOf = (page) => page.evaluate(() => ({ ...localStorage }));
const appReady = (page) => page.locator('[data-name="Main Nav"]').first().waitFor({ state: 'visible', timeout: 40000 });

try {
  // ── 1a. Pedalheads in Point Grey's property view signs out; a new account signs up: nothing of Pedalheads shows ──
  if (run('1a')) {
    // How the property view outlived a sign-out: Sign Out is only in the account view's Profile menu, but view_type /
    // selected_property are shared by every tab. Tab 2 opens Point Grey; tab 1 (account view) signs out and signs up.
    console.log('1a: tab 2 opens Point Grey, tab 1 signs out and signs up a new account');
    const { page, context, calls } = await open({ seed: session(PEDALHEADS, { view_type: 'personal' }), waitFor: appReady });
    await page.waitForTimeout(2000);
    const tab2 = await context.newPage();
    await tab2.goto(`${BASE}/`);
    await appReady(tab2);
    await tab2.waitForTimeout(1500);
    // Tab 2: Profile menu → Point Grey (the property list in the menu).
    await tab2.locator('[data-name="Dropdown"]').filter({ visible: true }).first().click();
    await tab2.getByText(/^Properties \(1\)$/).filter({ visible: true }).first().click();
    await tab2.getByText('Point Grey', { exact: true }).filter({ visible: true }).first().click({ timeout: 8000 }).catch((e) => console.log('     tab2 property click:', e.message.split('\n')[0]));
    await tab2.waitForTimeout(2500);
    const mid = await storageOf(page);
    expect(mid.view_type === 'property', `1a: tab 2 opened Point Grey (shared view_type=${mid.view_type})`);
    await shot(tab2, '1a-01-tab2-point-grey');
    // Tab 1 (still the account view): Profile menu → Sign Out.
    await page.bringToFront();
    await page.locator('[data-name="Dropdown"]').filter({ visible: true }).first().click();
    await page.getByRole('button', { name: /Sign Out/ }).filter({ visible: true }).first().click();
    await page.waitForURL(/\/login/, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const after = await storageOf(page);
    expect(after.view_type !== 'property' && !after.selected_property, `1a: sign-out clears the shared property view (view_type=${after.view_type}, selected_property=${after.selected_property ? 'set' : 'none'})`);
    expect(!after.stasht_token && !after.stasht_user, '1a: sign-out clears the sign-in');
    await shot(page, '1a-02-signed-out-login');
    // Sign up a new account (passwordless: Send OTP → Verify OTP → POST /signup → reload).
    const firstSignupCall = calls.length;
    await page.goto(`${BASE}/login?login=0`);
    await page.locator('#name').waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('#name').fill('KitsBeach');
    await shot(page, '1a-03a-signup-page');
    await page.getByText('Email address', { exact: true }).click();
    await page.getByPlaceholder('Enter your email').fill(NEWBIE.email);
    await page.getByRole('checkbox').first().click();
    await shot(page, '1a-03-signup-form');
    await page.getByRole('button', { name: /Send OTP/ }).click();
    await page.getByPlaceholder('000000').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByPlaceholder('000000').fill('123456');
    await page.getByRole('button', { name: /Verify OTP/ }).click();
    await appReady(page).catch(() => {});
    await gateBanner(page).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3500);
    const ls = await storageOf(page);
    expect(ls.stasht_token === 'newbie-token', '1a: signed up and signed in as the new account');
    expect(ls.view_type !== 'property' && !ls.selected_property, `1a: the new account opens in its own view (view_type=${ls.view_type})`);
    const later = calls.slice(firstSignupCall);
    expect(!later.some((c) => c.token === 'pedal-token'), '1a: no request with Pedalheads\' token after sign-out');
    expect(!later.some((c) => /^\/properties\/41(\/|$)/.test(c.path)), '1a: no request for Point Grey');
    expect(await page.getByText('Point Grey').filter({ visible: true }).count() === 0, '1a: "Point Grey" nowhere on screen');
    expect(await page.getByText('Property', { exact: true }).filter({ visible: true }).count() === 0, '1a: no "Property" badge');
    expect(await page.getByText(NEWBIE.name).filter({ visible: true }).count() > 0 || await page.getByText('Select a plan to unlock', { exact: true }).filter({ visible: true }).count() > 0, '1a: the header is the new account');
    expect(await gateDialog(page).getByRole('heading', { name: 'Starter', exact: true }).count() === 1, '1a/1c: the plan picker offers Starter');
    expect(await alvinIntro(page).count() === 0, '1a/1b: no "Meet Alvin" over the picker');
    await shot(page, '1a-04-new-account-after-signup');
    await context.close();
  }

  // ── 1a-legacy. Chris's browser as it was: the new account's sign-in next to Pedalheads' leftover Point Grey view and the
  //    new-account flag. The app must open the new account (no "Property" header), with Starter offered and no Alvin.
  for (const [w, h, tag] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
    if (!run('1b')) break;
    console.log(`1b/1c (${tag}): new account with a leftover Point Grey view`);
    const { page, context, calls } = await open({ width: w, height: h, seed: session(NEWBIE, { ...STALE_POINT_GREY, ...NEW_FLAG(NEWBIE) }), waitFor: appReady });
    await gateBanner(page).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(4000); // Alvin intro would show 1.2 s after it can
    const ls = await storageOf(page);
    expect(ls.view_type !== 'property' && !ls.selected_property, `1b ${tag}: the leftover Point Grey view is dropped (view_type=${ls.view_type})`);
    expect(await page.getByText('Property', { exact: true }).filter({ visible: true }).count() === 0, `1b ${tag}: no "Property" badge in the header`);
    // A view saved before this fix has no owner recorded: the first page load may still ask for it once — the API refuses
    // (403, not this account's property) — and the app then drops it (the account's properties don't include it).
    const pg = calls.filter((c) => /^\/properties\/41\//.test(c.path));
    console.log(`     (${pg.length} Point Grey request(s) on the first load, each refused by the API)`);
    expect(pg.length <= 2, `1b ${tag}: at most the first load's Point Grey request, refused (${pg.map((c) => c.path).join(', ')})`);
    expect(!calls.some((c) => c.token === 'pedal-token'), `1b ${tag}: no request with Pedalheads' token`);
    expect(await gateBanner(page).count() > 0, `1b ${tag}: the new account gets the plan picker`);
    const starter = gateDialog(page).getByRole('heading', { name: 'Starter', exact: true });
    expect(await starter.count() === 1, `1c ${tag}: Starter (free) is offered`);
    expect(await gateDialog(page).getByRole('heading', { name: 'Teams', exact: true }).count() === 1 && await gateDialog(page).getByRole('heading', { name: 'Business', exact: true }).count() === 1, `1c ${tag}: alongside Teams and Business`);
    expect(await alvinIntro(page).count() === 0, `1b ${tag}: no "Meet Alvin" popover over the picker`);
    const out = page.getByRole('button', { name: 'Sign out' }).filter({ visible: true });
    expect(await out.count() === 1 && await inViewport(out.first(), w, h), `6 ${tag}: the picker offers "Sign out", in view`);
    await shot(page, `1b-01-new-account-picker-${tag}`);
    // Starter: choose it → picker closes (POST /stripe/downgrade-to-starter), then Alvin may introduce itself.
    await starter.click();
    const getStarted = gateDialog(page).getByRole('button', { name: /Get Started/ });
    expect(await inViewport(getStarted, w, h) || (await getStarted.scrollIntoViewIfNeeded().then(() => inViewport(getStarted, w, h))), `1c ${tag}: "Get Started" reachable`);
    await shot(page, `1c-01-starter-selected-${tag}`);
    await getStarted.click();
    await gateBanner(page).first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    expect(calls.some((c) => c.path === '/stripe/downgrade-to-starter' && c.method === 'POST'), `1c ${tag}: choosing Starter calls POST /stripe/downgrade-to-starter`);
    expect(await gateBanner(page).count() === 0, `1c ${tag}: the picker closes`);
    expect(!(await storageOf(page)).is_new_user, `1c ${tag}: the new-account flag goes`);
    await page.waitForTimeout(3500);
    if (tag === 'desktop') expect(await alvinIntro(page).count() === 1, '1b desktop: once the plan is chosen, "Meet Alvin" introduces itself');
    await shot(page, `1c-02-after-starter-${tag}`);
    await context.close();
  }

  // ── 1a-owner. A view saved by this version names the account that opened it: never restored for another sign-in ──
  if (run('1a-owner')) {
    console.log('1a-owner: new account signed in next to a Point Grey view saved by Pedalheads');
    const { page, context, calls } = await open({ seed: session(NEWBIE, { ...STALE_POINT_GREY, selected_property_owner: String(PEDALHEADS.id) }), waitFor: appReady });
    await page.waitForTimeout(3000);
    expect(!calls.some((c) => /^\/properties\/41\//.test(c.path)), '1a-owner: no request for Point Grey at all');
    expect(await page.getByText('Point Grey').filter({ visible: true }).count() === 0, '1a-owner: Point Grey never shows');
    const ls = await storageOf(page);
    expect(ls.view_type === 'personal' && !ls.selected_property && !ls.selected_property_owner, '1a-owner: the stored view is dropped');
    await shot(page, '1a-03-owner-recorded-new-account');
    await context.close();
  }

  // ── 6. Pedalheads (Business) opens Point Grey with an old new-account flag in the browser: never the picker ──
  for (const [w, h, tag] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
    if (!run('6')) break;
    console.log(`6 (${tag}): Pedalheads in Point Grey's view with a new-account flag in the browser`);
    // The flag names Pedalheads itself (the strongest case: it is "its own"); the account is paid, so it goes.
    const { page, context } = await open({ width: w, height: h, seed: session(PEDALHEADS, { ...STALE_POINT_GREY, ...NEW_FLAG(PEDALHEADS) }), waitFor: appReady });
    await page.waitForTimeout(5000);
    expect(await gateBanner(page).count() === 0, `6 ${tag}: no plan picker in a paid account's property view`);
    expect(!(await storageOf(page)).is_new_user, `6 ${tag}: the stale flag is cleared (the account has a plan)`);
    expect((await storageOf(page)).view_type === 'property', `6 ${tag}: still in Point Grey's view (it is Pedalheads' own property)`);
    if (tag === 'desktop') expect(await page.getByText('Point Grey').filter({ visible: true }).count() > 0, '6 desktop: header shows Point Grey');
    if (tag === 'phone') {
      // Review: the phone bottom bar follows the sidebar — no Dashboard / Apps in a property view.
      const bar = page.locator('div.flex.items-center.justify-around.h-24');
      expect(await bar.getByText('Dashboard', { exact: true }).count() === 0 && await bar.getByText('Apps', { exact: true }).count() === 0, '6 phone: no Dashboard / Apps on the bottom bar in a property view');
      expect(await bar.getByText('Campaigns', { exact: true }).count() === 1, '6 phone: the bottom bar is there (Campaigns)');
    }
    await shot(page, `6-01-pedalheads-point-grey-no-gate-${tag}`);
    await context.close();
  }

  // ── 6c. A new account (Starter, plan not chosen yet) opening a property it was invited to: no picker there; the
  //    picker waits for the account's own view.
  if (run('6c')) {
    console.log('6c: new account in a property it was invited to');
    const { page, context } = await open({ newbieMember: true, seed: session(NEWBIE, { ...NEW_FLAG(NEWBIE), view_type: 'property', selected_property: JSON.stringify(KITS_SHARED), selected_property_owner: String(NEWBIE.id) }), waitFor: appReady });
    await page.waitForTimeout(4500);
    expect(await gateBanner(page).count() === 0, '6c: no plan picker in the property view');
    expect((await storageOf(page)).is_new_user === 'true', '6c: the plan is still to be chosen (flag kept)');
    expect(await page.getByText('Kitsilano Camp').filter({ visible: true }).count() > 0, '6c: header shows the property');
    await shot(page, '6c-01-new-account-property-view-no-gate');
    await page.locator('[data-name="Dropdown"]').filter({ visible: true }).first().click();
    await page.getByText(/^Back to /).filter({ visible: true }).first().click();
    await gateBanner(page).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    expect(await gateBanner(page).count() > 0, '6c: back in its own view, the account chooses its plan');
    expect(await gateDialog(page).getByRole('heading', { name: 'Starter', exact: true }).count() === 1, '6c: with Starter offered');
    await shot(page, '6c-02-back-to-account-picker');
    await context.close();
  }

  // ── 6b. Way out when switched into another account: "Switch to <account>" next to "Sign out" ──
  if (run('6b')) {
    console.log('6b: new account reached from the Profile menu switch → picker offers the way back');
    const switchData = JSON.stringify({ has_admin_access: true, current_mode: 'admin', current_admin_owner_id: '977', switched_token: 'newbie-token', personal_account: { user: PEDALHEADS, token: 'pedal-token' }, admin_accounts: [] });
    const { page, context } = await open({ seed: session(NEWBIE, { ...NEW_FLAG(NEWBIE), admin_switch_data: switchData }), waitFor: appReady });
    await gateBanner(page).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    const back = page.getByRole('button', { name: 'Switch to Pedalheads' });
    expect(await back.count() === 1 && await inViewport(back, 1280, 900), '6b: "Switch to Pedalheads" in view');
    await shot(page, '6b-01-picker-switch-back');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL(/\/login/, { timeout: 20000 }).catch(() => {});
    expect(/\/login/.test(page.url()), '6b: "Sign out" leaves the picker for the login page');
    const ls = await storageOf(page);
    expect(!ls.is_new_user && !ls.admin_switch_data && !ls.stasht_token, '6b: and nothing of the account is left');
    await context.close();
  }

  // ── 6d. Another account's new-account flag (a switch carried it) is ignored ──
  if (run('6d')) {
    console.log('6d: Pedalheads with the new account\'s flag in the browser');
    const { page, context } = await open({ seed: session(PEDALHEADS, { view_type: 'personal', ...NEW_FLAG(NEWBIE) }), waitFor: appReady });
    await page.waitForTimeout(4000);
    expect(await gateBanner(page).count() === 0, '6d: no picker for an account the flag does not name');
    await context.close();
  }

  // ── T. MemoriesPage's "Trial Ended" picker (review): only a Starter account owning a property whose trial ended, in its
  //    own view; never in a property view, for a covered account, or when storage-overview fails (429).
  for (const [w, h, tag] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
    if (!run('T1')) break;
    console.log(`T1 (${tag}): Starter account, owned property trial ended → Trial Ended picker with a way out`);
    const { page, context } = await open({ width: w, height: h, newbieOwns: true, seed: session(NEWBIE, { view_type: 'personal' }), waitFor: appReady });
    await gateBanner(page).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    expect(await gateBanner(page).count() > 0, `T1 ${tag}: the Trial Ended picker shows`);
    const out = page.getByRole('button', { name: 'Sign out' }).filter({ visible: true });
    expect(await out.count() === 1 && await inViewport(out.first(), w, h), `T1 ${tag}: it offers "Sign out", in view`);
    await page.waitForTimeout(2500);
    expect(await alvinIntro(page).count() === 0, `T1 ${tag}: no "Meet Alvin" over it`);
    // Release fixes: it says why, and offers Starter (the account's own choice); the title is one line on a phone.
    const notice = page.getByText('Your trial has ended — choose a plan to keep using Stasht.');
    expect(await notice.count() === 1 && await inViewport(notice, w, h), `T1 ${tag}: says why ("Your trial has ended…"), in view`);
    expect(await gateDialog(page).getByRole('heading', { name: 'Starter', exact: true }).count() === 1, `T1 ${tag}: Starter offered`);
    const title = await gateDialog(page).getByRole('heading', { name: 'Upgrade Your Plan' }).boundingBox();
    expect(!!title && title.height < 40, `T1 ${tag}: "Upgrade Your Plan" on one line (${title && Math.round(title.height)}px)`);
    await shot(page, `T1-01-trial-ended-picker-${tag}`);
    if (tag === 'phone') {
      await out.first().click();
      await page.waitForURL(/\/login/, { timeout: 20000 }).catch(() => {});
      expect(/\/login/.test(page.url()), `T1 ${tag}: "Sign out" leaves it`);
    } else {
      await gateDialog(page).getByRole('heading', { name: 'Starter', exact: true }).click();
      await gateDialog(page).getByRole('button', { name: /Get Started/ }).click();
      await gateBanner(page).first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      expect(await gateBanner(page).count() === 0, `T1 ${tag}: choosing Starter closes it`);
      await page.reload();
      await appReady(page);
      await page.waitForTimeout(5000);
      expect(await gateBanner(page).count() === 0, `T1 ${tag}: and it isn't asked again`);
      await shot(page, `T1-02-after-starter-${tag}`);
    }
    await context.close();
  }
  if (run('T2')) {
    console.log('T2: the same account in a property view → no Trial Ended picker');
    const { page, context } = await open({ newbieOwns: true, newbieMember: true, seed: session(NEWBIE, { view_type: 'property', selected_property: JSON.stringify(KITS_SHARED), selected_property_owner: String(NEWBIE.id) }), waitFor: appReady });
    await page.waitForTimeout(5000);
    expect(await gateBanner(page).count() === 0, 'T2: no picker in the property view');
    expect(await page.getByText('Kitsilano Camp').filter({ visible: true }).count() > 0, 'T2: still in the property view');
    await shot(page, 'T2-01-property-view-no-trial-picker');
    await context.close();
  }
  if (run('T3')) {
    console.log('T3: covered by a paying main account → no Trial Ended picker');
    const { page, context } = await open({ newbieOwns: true, overview: 'covered', seed: session(NEWBIE, { view_type: 'personal' }), waitFor: appReady });
    await page.waitForTimeout(5000);
    expect(await gateBanner(page).count() === 0, 'T3: no picker for a covered account');
    await shot(page, 'T3-01-covered-no-trial-picker');
    await context.close();
  }
  if (run('T4')) {
    console.log('T4: storage-overview answers 429 → never gated');
    const { page, context, state } = await open({ newbieOwns: true, overview: '429', seed: session(NEWBIE, { view_type: 'personal' }), waitFor: appReady });
    await page.waitForTimeout(15000); // apiRequest retries 429 with backoff before giving up
    console.log(`     (${state.overviewCalls} storage-overview calls, all 429)`);
    expect(state.overviewCalls > 0, 'T4: storage-overview was asked (and refused)');
    expect(await gateBanner(page).count() === 0, 'T4: an unknown plan never opens the picker');
    await shot(page, 'T4-01-429-no-trial-picker');
    await context.close();
  }

  // ── C. Conveniences (review): kept for the same account, gone when a different account signs in ──
  if (run('C')) {
    console.log('C: per-account conveniences');
    const conv = { hiddenServices: '["dropbox"]', stasht_watched_videos: '[1,2]', stasht_campaigns_view: 'newsletters', stash_invited_memories: '[]' };
    {
      const { page, context } = await open({ seed: session(NEWBIE, { ...conv, stasht_conveniences_account: String(NEWBIE.id) }), waitFor: appReady });
      await page.waitForTimeout(2000);
      const ls = await storageOf(page);
      expect(ls.hiddenServices === conv.hiddenServices && ls.stasht_watched_videos === conv.stasht_watched_videos, 'C: same account signing in keeps its conveniences');
      await context.close();
    }
    {
      const { page, context } = await open({ seed: session(NEWBIE, { ...conv, stasht_conveniences_account: String(PEDALHEADS.id) }), waitFor: appReady });
      await page.waitForTimeout(2000);
      const ls = await storageOf(page);
      expect(!ls.hiddenServices && !ls.stasht_watched_videos && !ls.stasht_campaigns_view && !ls.stash_invited_memories, 'C: another account\'s conveniences are gone');
      expect(ls.stasht_conveniences_account === String(NEWBIE.id), 'C: they now belong to the new account');
      await context.close();
    }
  }

  // ── R1. Release E2E B1: a Teams self sign-up (role 3) opening the app on Campaigns, then clicking Dashboard, stays there ──
  for (const [w, h, tag] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
    if (!run('R1')) break;
    console.log(`R1 (${tag}): Teams role 3 opens on Campaigns → Dashboard`);
    const { page, context } = await open({ width: w, height: h, path: '/stories', seed: session(BODY, { view_type: 'personal' }), waitFor: appReady });
    await page.waitForTimeout(3500);
    const dash = page.getByRole('button', { name: /^Dashboard/ }).filter({ visible: true }).first();
    await dash.click();
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    expect(await page.getByRole('heading', { name: 'Dashboard', exact: true }).filter({ visible: true }).count() > 0, `R1 ${tag}: first Dashboard click stays on Dashboard`);
    expect(!/\/(stories|memories)/.test(new URL(page.url()).pathname), `R1 ${tag}: not bounced to Campaigns (${new URL(page.url()).pathname})`);
    await shot(page, `R1-01-teams-dashboard-first-click-${tag}`);
    await context.close();
  }

  // ── R2. Release E2E B2: a Teams account's plan picker marks Teams "Current plan" and never offers "Upgrade to Teams" ──
  const teamsCases = [
    ['admin-set', { plans: { 'body-token': 'Teams' } }],
    ['stripe', { plans: { 'body-token': 'Intermediate' }, stripeSub: { plan_name: 'intermediate', billing_period: 'monthly', current_period_end: '2026-12-05T00:00:00Z' } }],
  ];
  for (const [kind, opts] of teamsCases) {
    for (const [w, h, tag] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
      if (!run('R2')) break;
      console.log(`R2 (${kind}, ${tag}): Teams account opens the plans from Billing`);
      const { page, context, state } = await open({ width: w, height: h, ...opts, seed: session(BODY, { view_type: 'personal', stasht_alvin_intro_seen_950: '1' }), waitFor: appReady });
      await page.waitForTimeout(2000);
      // Billing & Payment from the Profile menu (desktop: the header dropdown; phone: the avatar).
      if (tag === 'desktop') {
        await page.locator('[data-name="Dropdown"]').filter({ visible: true }).first().click();
        await page.getByText('Billing & Payment').filter({ visible: true }).first().click();
      } else {
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('app-navigate', { detail: 'billing' })));
      }
      const credits = page.getByText('90 of 100 credits left');
      await credits.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      expect(await credits.count() > 0, `R2 ${kind} ${tag}: Billing says "90 of 100 credits left"`);
      if (kind === 'admin-set') await shot(page, `R2-00-billing-credits-left-${tag}`);
      await page.getByRole('button', { name: /Upgrade Plan/ }).filter({ visible: true }).first().click();
      const dialog = gateDialog(page);
      await dialog.waitFor({ state: 'visible', timeout: 10000 });
      const teamsCard = dialog.locator('div.border-2', { has: page.getByRole('heading', { name: 'Teams', level: 3 }) }).first();
      expect(await teamsCard.getByText('Current plan', { exact: true }).count() === 1, `R2 ${kind} ${tag}: Teams card marked "Current plan"`);
      const main = dialog.getByRole('button', { name: /Upgrade to Business/ });
      await main.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}); // the picker selects after it opens
      expect(await main.count() === 1, `R2 ${kind} ${tag}: opens on Business: "Upgrade to Business"`);
      expect(await dialog.getByText('Individuals', { exact: true }).count() === 1, `R2 ${kind} ${tag}: Starter's tagline is "Individuals"`);
      if (tag === 'phone') {
        const title = await dialog.getByRole('heading', { name: 'Upgrade Your Plan' }).boundingBox();
        expect(!!title && title.height < 40, `R2 ${kind} ${tag}: title on one line (${title && Math.round(title.height)}px)`);
      }
      await shot(page, `R2-01-${kind}-teams-current-${tag}`);
      await teamsCard.click();
      const current = dialog.getByRole('button', { name: 'Current plan' });
      expect(await current.count() === 1 && await current.isDisabled(), `R2 ${kind} ${tag}: Teams selected → "Current plan", disabled`);
      expect(await dialog.getByRole('button', { name: /Upgrade to Teams/ }).count() === 0, `R2 ${kind} ${tag}: never "Upgrade to Teams"`);
      await current.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
      expect(await page.getByRole('dialog', { name: 'Payment method' }).count() === 0 && !state.setupIntent, `R2 ${kind} ${tag}: nothing to pay for (no payment step)`);
      await current.scrollIntoViewIfNeeded();
      await shot(page, `R2-02-${kind}-teams-selected-disabled-${tag}`);
      await context.close();
    }
  }

  // ── R3. Teams widget manager: "New widget" only opens the plans, so it looks like a Business option ──
  for (const [w, h, tag] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
    if (!run('R3')) break;
    console.log(`R3 (${tag}): Teams widget manager New widget`);
    const widget = { id: 'w_abcdefghij', name: 'Homepage', status: 'live', agent_name: 'Neo', callout_text: 'Hi', welcome_subtext: null, theme: { primary_color: '#6C60FF', logo_url: null, bubble_position: 'bottom-right' }, allowed_domains: ['body.example'], created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z', leads_count: 0, installs: [] };
    const { page, context } = await open({ width: w, height: h, path: '/marketplace', widgets: [widget], seed: session(BODY, { view_type: 'personal', stasht_alvin_intro_seen_950: '1' }), waitFor: appReady });
    await page.getByRole('button', { name: 'Manage Contact Us Widget' }).first().click({ timeout: 20000 });
    const btn = page.getByRole('dialog').getByRole('button', { name: /New widget/ });
    await page.getByRole('dialog').getByText('Homepage', { exact: true }).waitFor({ timeout: 15000 }); // the list (and the plan answer) loaded
    await btn.filter({ hasText: 'Business' }).waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    const look = await btn.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderTopColor, text: el.textContent }));
    expect(look.bg === 'rgb(255, 255, 255)' && look.text.includes('Business'), `R3 ${tag}: outlined with a "Business" hint (${JSON.stringify(look)})`);
    expect(await btn.locator('svg.lucide-lock').count() === 1, `R3 ${tag}: lock icon`);
    expect(await inViewport(btn, w, h), `R3 ${tag}: in view`);
    await shot(page, `R3-01-teams-new-widget-business-${tag}`);
    await context.close();
  }

  // ── 4. TheBodyPolitik (self sign-up, role 3) on Teams: Dashboard and Apps ──
  for (const [w, h, tag] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
    if (!run('4')) break;
    console.log(`4 (${tag}): TheBodyPolitik role 3 on Teams`);
    const { page, context } = await open({ width: w, height: h, seed: session(BODY, { view_type: 'personal' }), waitFor: appReady });
    await page.waitForTimeout(3000);
    const dash = page.getByRole('button', { name: /^Dashboard/ }).filter({ visible: true });
    const apps = page.getByRole('button', { name: /^Apps/ }).filter({ visible: true });
    expect(await dash.count() > 0 && await inViewport(dash.first(), w, h), `4 ${tag}: Dashboard in the menu, in view`);
    expect(await apps.count() > 0, `4 ${tag}: Apps in the menu`);
    await shot(page, `4-01-bodypolitik-teams-dashboard-${tag}`);
    await dash.first().click();
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    expect(await page.getByRole('heading', { name: 'Dashboard', exact: true }).filter({ visible: true }).count() > 0, `4 ${tag}: Dashboard opens`);
    await shot(page, `4-02-bodypolitik-dashboard-open-${tag}`);
    await context.close();
  }

  // ── 4b. A Starter self sign-up still has no Dashboard; an Admin Portal upgrade shows when the person comes back ──
  if (run('4b')) {
    console.log('4b: Starter → (Admin Portal upgrade) → Teams without signing in again');
    const { page, context, state } = await open({ seed: session(BODY, { view_type: 'personal' }), plans: { 'body-token': 'Starter' }, waitFor: appReady });
    await page.waitForTimeout(3000);
    const dash = () => page.getByRole('button', { name: /^Dashboard/ }).filter({ visible: true });
    expect(await dash().count() === 0, '4b: on Starter, no Dashboard (as before)');
    await shot(page, '4b-01-starter-no-dashboard');
    state.plans['body-token'] = 'Teams';
    await page.waitForTimeout(31000); // past the 30 s refresh window
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await dash().first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    expect(await dash().count() > 0, '4b: after the upgrade, Dashboard appears on returning to the tab (no sign-in)');
    await shot(page, '4b-02-upgraded-dashboard-appears');
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
