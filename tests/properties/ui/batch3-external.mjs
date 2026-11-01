// Chris batch 3 (1 Nov 2026), external accounts / properties:
//  1. Account invite sign-up (/account-register?token=…) and property invite sign-up (/property/register/:token): the
//     OTP step's button says "Verify" (was "Verify & Create Account"), next to Back.
//  2. A salesperson covered by the main account (Deepak, 1 Nov 2026: no forced purchase) sees the main account's plan:
//     Profile Settings and Billing say "Business" with "Covered by Serpa Chrysler", never "Starter"; no "Upgrade Plan" /
//     "Need More Storage?" for the plan that covers it; no trial banner. Accounts on their own plan are unchanged.
//  3. External view: the avatar camera changes the PROPERTY's image (POST /properties/{id}/update), never the person's
//     profile (no /user/update-profile); the Profile menu there has no Settings, and Get Started has no "Complete your
//     Profile" (the personal photo and bio); the personal view keeps it.
//  4. Users → External rows: the property's image, else the external account's logo (account_profile_image), else the
//     shield. Internal rows keep the property image or the shield.
//  5. Account chooser and Profile menu: two groups, "Properties (N)" and "External (N)", each collapsible; no
//     "Property Accounts", "Internal" or "n internal, n external".
//  6. A salesperson's view of the main account's website-catalogue products names the main account as the author.
//  7. Users tab counts: "1 property", "1 external account".
//  8. Edit Property: a chosen file that can't be shown as an image (a text file named .png, which the server refuses)
//     never leaves a broken preview: the box shows the saved image again (or the empty upload box) and says why.
// node tests/properties/ui/batch3-external.mjs   (needs the dev server: B3_BASE, default http://127.0.0.1:5311)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: B3_SHOTS (default /private/tmp/claude-501/batch3-external-ui/shots).
import { mkdirSync, writeFileSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.B3_BASE || 'http://127.0.0.1:5311';
const OUT = process.env.B3_SHOTS || '/private/tmp/claude-501/batch3-external-ui/shots';
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 708, external_user_id: 889, name: 'Serpa Chrysler', email: 'serpa@dealer.test', role: '2', status: 1, is_activated: true };
const BON = { id: 120, external_user_id: 966, name: 'Bon Sun', email: 'bon@dealer.test', role: '3', status: 1, is_activated: true };

const LOGO_URL = `${BASE}/__test/artem-logo.png`;
const STORE_URL = `${BASE}/__test/store-front.png`;
const OLD_URL = `${BASE}/__test/old-photo.png`;
const SERPA_LOGO = `${BASE}/__test/serpa-logo.png`;
const images = {};

const base = { memories_count: 2, users_count: 1, invited_users: [], labels: [], invite_link: null, created_at: '2026-10-01T10:00:00Z', location: 'Toronto, ON' };
const INTERNAL_DOWNTOWN = { ...base, id: 12, name: 'Downtown Lot', unique_id: 'DL-12', username: 'downtown', image: OLD_URL, user_id: 889, is_creator: true, user_role: 'admin', property_type: 'internal', status: 'inactive', account_type: 'internal', is_active: true, can_manage: true, account_created_for_property: false, account_profile_image: SERPA_LOGO };
const INTERNAL_NO_IMAGE = { ...base, id: 3403, name: 'Chris Wirth', unique_id: '3403', username: 'chriswirth', image: null, user_id: 889, is_creator: true, user_role: 'admin', property_type: 'internal', status: 'inactive', account_type: 'internal', is_active: true, can_manage: true, account_created_for_property: false, account_profile_image: SERPA_LOGO };
const EXT_ARTEM = { ...base, id: 2, name: 'Artem Auto', unique_id: 'AA-2', username: 'artem', image: null, user_id: 970, parent_user_id: 889, is_creator: false, user_role: 'admin', property_type: 'external', status: 1, account_type: 'external', is_active: true, can_manage: true, account_created_for_property: true, account_profile_image: LOGO_URL };
const EXT_BOB = { ...base, id: 3, name: 'Bob Bozic', unique_id: 'BB-3', username: 'bob', image: STORE_URL, user_id: 901, parent_user_id: 889, is_creator: false, user_role: 'admin', property_type: 'external', status: 1, account_type: 'external', is_active: true, can_manage: true, account_created_for_property: true, account_profile_image: LOGO_URL };
const EXT_RITA = { ...base, id: 4, name: 'Rita Rep', unique_id: 'RR-4', username: 'rita', image: null, user_id: 903, parent_user_id: 889, is_creator: false, user_role: 'admin', property_type: 'external', status: 1, account_type: 'external', is_active: true, can_manage: true, account_created_for_property: true, account_profile_image: null };
// Bon's own External account (his property made by Serpa), shown as representing Serpa.
const INVITED_BY_SERPA = { id: 708, external_user_id: 889, name: 'Serpa Chrysler', email: 'serpa@dealer.test', profile_image: SERPA_LOGO };
const BONS_OWN = { ...base, id: 96, name: 'Bon Sun', unique_id: 'BS-96', username: 'bonsun', image: null, user_id: 966, parent_user_id: 889, is_creator: true, user_role: 'admin', property_type: 'external', status: 1, account_type: 'external', is_active: true, can_manage: false, account_created_for_property: true, is_own_external_account: true, invited_by: INVITED_BY_SERPA };
// Serpa's catalogue product, read-only for Bon, with the owner block (web API 1 Nov 2026).
const SERPA_PRODUCT = { id: 31, user_id: 889, read_only: true, owner: { id: 889, name: 'Serpa Chrysler', profile_image: SERPA_LOGO, profile_color: '1d4ed8' }, title: 'All-Weather Floor Mats', price: '199', currency: 'CAD', price_label: '$199 CAD', category: 'Accessories', url: null, main_image: null, images_count: 0, spec_summary: '' };
const BON_PRODUCT = { id: 32, user_id: 966, read_only: false, title: 'Bon Test Drive Voucher', price: '0', currency: 'CAD', price_label: '', category: 'Accessories', url: null, main_image: null, images_count: 0, spec_summary: '' };

const failures = [];
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function makeImages() {
  const page = await browser.newPage({ viewport: { width: 240, height: 240 } });
  const draw = async (bg, text, file) => {
    await page.setContent(`<div style="width:240px;height:240px;background:${bg};display:flex;align-items:center;justify-content:center;font:bold 40px sans-serif;color:#fff">${text}</div>`);
    const buf = await page.screenshot({ type: 'png' });
    const path = `${OUT}/${file}`;
    writeFileSync(path, buf);
    return { path, buf };
  };
  images.logo = await draw('#b91c1c', 'ARTEM', 'fixture-artem-logo.png');
  images.store = await draw('#059669', 'STORE', 'fixture-store-front.png');
  images.old = await draw('#6b7280', 'OLD', 'fixture-old-photo.png');
  images.serpa = await draw('#1d4ed8', 'S', 'fixture-serpa-logo.png');
  await page.close();
  // A text file named .png: the browser takes it (type image/png), the server refuses it, its preview is broken.
  writeFileSync(`${OUT}/fixture-not-really.png`, 'stock,price\nJ501,58900\n');
}

function parseMultipart(req) {
  const type = req.headers()['content-type'] || '';
  const m = type.match(/boundary=(.+)$/);
  const out = {};
  if (!m) return out;
  const body = (req.postDataBuffer() || Buffer.alloc(0)).toString('latin1');
  for (const part of body.split(`--${m[1]}`)) {
    const name = part.match(/name="([^"]+)"/);
    if (!name) continue;
    const filename = part.match(/filename="([^"]*)"/);
    const value = part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
    out[name[1]] = filename ? { filename: filename[1], bytes: value.length } : value;
  }
  return out;
}

// who: the signed-in account. rows: GET /properties rows. seed: extra localStorage. tab: the Users tab to open on.
// plan: storage-overview / profile plan fields. accountTrial: GET /properties data.account_trial.
async function open({ width = 1280, height = 900, who = MAIN, rows = [INTERNAL_DOWNTOWN, EXT_ARTEM, EXT_BOB, EXT_RITA], seed = {}, path = '/users', tab = 'properties', signedOut = false, plan = { plan_name: 'Professional', plan_covered_by: null }, accountTrial = null }) {
  const state = { rows: rows.map((r) => ({ ...r })), updates: [], profileWrites: [], otpSent: [], updateReply: null };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([seedData, openTab, out]) => {
    try {
      if (location.pathname === '/users' && openTab) sessionStorage.setItem('users_open_tab', openTab);
      if (sessionStorage.getItem('b3-seeded')) return;
      sessionStorage.setItem('b3-seeded', '1');
      localStorage.clear();
      if (out) return;
      for (const [k, v] of Object.entries(seedData)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    } catch {
      // about:blank has no storage
    }
  }, [{ stasht_token: `${who.name}-token`, stasht_user: who, view_type: 'personal', ...seed }, tab, signedOut]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
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
    if (url.pathname === '/__test/artem-logo.png') return route.fulfill({ contentType: 'image/png', body: images.logo.buf });
    if (url.pathname === '/__test/store-front.png') return route.fulfill({ contentType: 'image/png', body: images.store.buf });
    if (url.pathname === '/__test/old-photo.png') return route.fulfill({ contentType: 'image/png', body: images.old.buf });
    if (url.pathname === '/__test/serpa-logo.png') return route.fulfill({ contentType: 'image/png', body: images.serpa.buf });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (process.env.B3_DEBUG) console.log('api', req.method(), p);
    if (p === '/account/invite-info') return route.fulfill({ json: { status: 'success', data: { owner_name: 'Serpa Chrysler', profile_image: SERPA_LOGO } } });
    if (p === '/users/check-exists') return route.fulfill({ json: { success: true, exists: false } });
    if (p === '/send-otp') {
      state.otpSent.push(JSON.parse(req.postData() || 'null'));
      return route.fulfill({ json: { success: true, message: 'OTP sent', channel: 'sms' } });
    }
    if (p === '/properties' && req.method() === 'GET') {
      const owned = state.rows.filter((r) => r.is_creator);
      const shared = state.rows.filter((r) => !r.is_creator);
      return route.fulfill({ json: { success: true, data: { properties: state.rows, owned_properties: owned, shared_properties: shared, owned_count: owned.length, shared_count: shared.length, total_count: state.rows.length, account_trial: accountTrial } } });
    }
    if (p === '/properties/view/tok-downtown') return route.fulfill({ json: { status: 'success', data: { property: { id: 12, name: 'Downtown Lot', image: null, location: 'Toronto, ON' }, properties_with_invite: [] } } });
    if (p === '/user/profile' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { user: { ...who, phone: null, bio: '', ...plan } } } });
    const m = p.match(/^\/properties\/(\d+)\/update$/);
    if (m && req.method() === 'POST') {
      const fields = parseMultipart(req);
      state.updates.push({ id: Number(m[1]), fields });
      if (state.updateReply) {
        const reply = state.updateReply;
        state.updateReply = null;
        return route.fulfill(reply);
      }
      const row = state.rows.find((r) => r.id === Number(m[1])) || { id: Number(m[1]) };
      if (fields.image) row.image = STORE_URL;
      return route.fulfill({ json: { status: 'success', message: 'Property updated successfully', data: { property: { ...row } } } });
    }
    if (/^\/user\/(update-profile|profile)/.test(p) && req.method() !== 'GET') {
      state.profileWrites.push(p);
      return route.fulfill({ json: { success: true, data: { user: who } } });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_id: 1, memories_count: 0, plan_storage_size_gb: 1024, total_storage_used_mb: 0, ...plan } } } });
    // Billing & Payment's own data (their real shapes; nothing to pay or show here).
    if (p === '/ai-credits/balance') return route.fulfill({ json: { status: 1, data: { total_credits: 5, monthly_credits: { available: 5, allocation: 5, used_this_month: 0, usage_percentage: 0, next_reset_date: null, days_until_reset: 0 }, addon_credits: { available: 0, total_purchased: 0, breakdown: [] }, plan: { name: 'Starter', monthly_allocation: 5 } } } });
    if (p === '/ai-credits/usage-history') return route.fulfill({ json: { status: 1, data: { usage: [], summary: { total_credits_used: 0, by_service: { ai_captions: 0, ai_memory_wizard: 0 } }, pagination: { current_page: 1, per_page: 10, total_records: 0, total_pages: 1 } } } });
    if (p === '/stripe/subscription') return route.fulfill({ json: { success: true, active_subscriptions: [], upcoming_subscriptions: [], scheduled_changes: [] } });
    if (p === '/stripe/payment-methods') return route.fulfill({ json: { success: true, payment_methods: [] } });
    if (p === '/stripe/billing-history') return route.fulfill({ json: { success: true, data: [] } });
    if (p === '/website-catalogue' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { available: true, connected: true, item_count: 2 } } });
    if (p === '/website-catalogue/items' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { items: [SERPA_PRODUCT, BON_PRODUCT], pagination: { current_page: 1, per_page: 500, total: 2, last_page: 1 } } } });
    const feed = p.match(/^\/properties\/(\d+)\/memories$/);
    if (feed && req.method() === 'GET') {
      return route.fulfill({ json: { status: 'success', data: { property: BONS_OWN, user_role: 'admin', viewing_invited_content: false, inviter: null, memories: { data: [], total: 0 }, sidebar: { categories: { items: [] }, labels: { items: [] } } } } });
    }
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}${path}`);
  return { context, page, state };
}

async function shot(page, file) {
  const path = `${OUT}/${file}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('shot', path);
}
const tabButton = (page, name) => page.getByRole('button', { name, exact: true }).filter({ visible: true }).first();
function rowOf(page, name, width) {
  return width >= 1024
    ? page.locator('tr', { hasText: name }).filter({ visible: true }).first()
    : page.locator('div.p-3', { hasText: name }).filter({ visible: true }).first();
}
async function rowImage(page, name, width) {
  const img = rowOf(page, name, width).locator('img').first();
  if (!(await img.count())) return null;
  return img.getAttribute('src');
}
const visibleCount = (page, text, exact = true) => page.getByText(text, { exact }).filter({ visible: true }).count();
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
async function openProfileMenu(page, width) {
  if (width >= 1024) await page.locator('[data-name="Dropdown"]').filter({ visible: true }).first().locator('*').first().click();
  else await page.locator('div.rounded-full.cursor-pointer').filter({ visible: true }).first().click();
  await page.waitForTimeout(700);
}
// Profile menu → Settings (Profile Settings), once the app is up.
async function openSettings(page, width) {
  await page.getByText('Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1000);
  await openProfileMenu(page, width);
  await page.getByRole('button', { name: 'Settings', exact: true }).filter({ visible: true }).first().click();
}
async function openMenu(page, name, width) {
  const trigger = rowOf(page, name, width).locator('button').last();
  await trigger.click({ timeout: 8000 });
  const menu = page.getByRole('menu');
  await menu.waitFor({ state: 'visible', timeout: 5000 });
  return menu;
}
async function toastText(page) {
  await page.waitForTimeout(400);
  return page.locator('[data-sonner-toast]').evaluateAll((els) => els.map((el) => el.textContent.trim()));
}

try {
  await makeImages();

  // ---------- 1. Account invite sign-up: "Verify" ----------
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = `${width}`;
    const { page, context, state } = await open({ width, height, path: '/account-register?token=tok-serpa', signedOut: true });
    await page.getByText('Sign Up', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    await page.getByPlaceholder('First Name').fill('Artem');
    await page.getByPlaceholder('Last Name').fill('Auto');
    await page.getByPlaceholder('(555) 123-4567').fill('4165550199');
    await page.waitForTimeout(900); // the existing-account check (debounced)
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByText('Verify your phone number').waitFor({ state: 'visible', timeout: 10000 });
    expect(state.otpSent.length === 1, `${tag} 1: a code was sent (${state.otpSent.length})`);
    expect(await page.getByRole('button', { name: 'Verify', exact: true }).filter({ visible: true }).count() === 1, `${tag} 1: the button says "Verify"`);
    expect(await page.getByRole('button', { name: 'Back', exact: true }).filter({ visible: true }).count() === 1, `${tag} 1: Back is still there`);
    expect(await visibleCount(page, 'Verify & Create Account') === 0, `${tag} 1: no "Verify & Create Account"`);
    if (width < 1024) expect(await noOverflow(page), `${tag} 1: no sideways scroll`);
    await page.locator('input[autocomplete=one-time-code]').fill('123456');
    await shot(page, `${tag}-1-account-register-verify`);
    await context.close();
  }

  // ---------- 1b. Property invite sign-up: "Verify" ----------
  {
    const { page, context, state } = await open({ path: '/property/register/tok-downtown', signedOut: true });
    await page.getByPlaceholder('First Name').waitFor({ state: 'visible', timeout: 30000 });
    await page.getByPlaceholder('First Name').fill('Artem');
    await page.getByPlaceholder('Last Name').fill('Auto');
    await page.getByPlaceholder('(555) 123-4567').fill('4165550199');
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByPlaceholder('Enter 6-digit code').waitFor({ state: 'visible', timeout: 10000 });
    expect(state.otpSent.length === 1, `1b: a code was sent (${state.otpSent.length})`);
    expect(await page.getByRole('button', { name: 'Verify', exact: true }).filter({ visible: true }).count() === 1, '1b: the property sign-up button says "Verify"');
    expect(await visibleCount(page, 'Verify & Create Account') === 0, '1b: no "Verify & Create Account"');
    await shot(page, '1280-1b-property-register-verify');
    await context.close();
  }

  // ---------- 2. Covered by the main account: the main account's plan, never "Starter" ----------
  const COVERED = { plan_name: 'Business', plan_covered_by: { id: 889, name: 'Serpa Chrysler' } };
  const ENDED_TRIAL = { trial_ends_at: '2026-10-20T23:59:59+00:00', trial_ends_on: '2026-10-20', trial_ended: true };
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = `${width}`;
    // Profile Settings.
    {
      const { page, context } = await open({ width, height, who: BON, rows: [BONS_OWN], path: '/', plan: COVERED });
      await openSettings(page, width);
      await page.getByTestId('profile-plan-badge').first().waitFor({ state: 'visible', timeout: 30000 }).catch(async (e) => {
        await shot(page, `debug-${tag}-profile`);
        console.log('url', page.url(), (await page.locator('body').innerText()).slice(0, 600));
        throw e;
      });
      await page.waitForTimeout(600);
      expect((await page.getByTestId('profile-plan-badge').first().textContent())?.trim() === 'Business', `${tag} 2: Profile Settings badge says Business`);
      expect((await page.getByTestId('profile-plan-covered').first().textContent())?.trim() === 'Covered by Serpa Chrysler', `${tag} 2: ... Covered by Serpa Chrysler`);
      expect(await visibleCount(page, 'Starter') === 0, `${tag} 2: no "Starter" on Profile Settings`);
      if (width < 1024) expect(await noOverflow(page), `${tag} 2: no sideways scroll`);
      await shot(page, `${tag}-2-profile-settings-covered`);
      if (width >= 1024) {
        await page.getByText('Storage Management', { exact: true }).filter({ visible: true }).first().click();
        await page.getByText('Your Data', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 10000 });
        await page.waitForTimeout(800);
        expect(await visibleCount(page, 'Need More Storage?') === 0, `${tag} 2: no "Need More Storage? Upgrade Plan" while covered by Business`);
        await shot(page, `${tag}-2-profile-storage-covered`);
      }
      await context.close();
    }
    // Billing & Payment.
    {
      const { page, context } = await open({ width, height, who: BON, rows: [BONS_OWN], path: '/', plan: COVERED });
      await page.getByText('Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForTimeout(1000);
      await openProfileMenu(page, width);
      await page.getByRole('button', { name: /Billing & Payment/ }).filter({ visible: true }).first().click();
      await page.getByTestId('billing-plan-badge').first().waitFor({ state: 'visible', timeout: 20000 });
      await page.waitForTimeout(800);
      expect((await page.getByTestId('billing-plan-badge').first().textContent())?.trim() === 'Business', `${tag} 2: Billing current plan says Business`);
      expect((await page.getByTestId('billing-plan-covered').first().textContent())?.trim() === 'Covered by Serpa Chrysler', `${tag} 2: ... Covered by Serpa Chrysler`);
      expect(await page.getByRole('button', { name: /Upgrade Plan/ }).filter({ visible: true }).count() === 0, `${tag} 2: no Upgrade Plan button`);
      expect(await visibleCount(page, 'Upgrade to Unlock:') === 0, `${tag} 2: no "Upgrade to Unlock"`);
      expect(await visibleCount(page, '5 Admin Roles') > 0, `${tag} 2: Plan Includes lists Business features (5 Admin Roles)`);
      expect(await page.getByRole('button', { name: /Buy more Credits/ }).filter({ visible: true }).count() > 0, `${tag} 2: Buy more Credits stays`);
      if (width < 1024) expect(await noOverflow(page), `${tag} 2: no sideways scroll`);
      await shot(page, `${tag}-2-billing-covered`);
      await context.close();
    }
  }
  // Dashboard: no trial banner while covered; the same trial on an account's own plan still shows it.
  // (Role 2 opens on the Dashboard; a role-3 salesperson has no Dashboard page at all.)
  const BON_ROLE2 = { ...BON, role: '2' };
  for (const [label, plan, expectBanner] of [['covered', COVERED, false], ['own plan', { plan_name: 'Starter', plan_covered_by: null }, true]]) {
    const { page, context } = await open({ who: BON_ROLE2, rows: [BONS_OWN], path: '/', plan, accountTrial: ENDED_TRIAL });
    await page.getByText('Overview & Analytics', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(2500);
    const banner = await visibleCount(page, 'Trial ended');
    expect((banner > 0) === expectBanner, `2 dashboard ${label}: trial banner ${expectBanner ? 'shown' : 'hidden'} (${banner})`);
    await shot(page, `1280-2-dashboard-${label.replace(' ', '-')}`);
    await context.close();
  }
  // Accounts on their own plan: unchanged (own Business: Upgrade Plan still offered, no covered note; own Starter badge).
  {
    const { page, context } = await open({ path: '/', plan: { plan_name: 'Business', plan_covered_by: null } });
    await page.getByText('Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);
    await openProfileMenu(page, 1280);
    await page.getByRole('button', { name: /Billing & Payment/ }).filter({ visible: true }).first().click();
    await page.getByTestId('billing-plan-badge').first().waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(600);
    expect((await page.getByTestId('billing-plan-badge').first().textContent())?.trim() === 'Business', '2 own Business: badge Business');
    expect(await page.getByTestId('billing-plan-covered').count() === 0, '2 own Business: no covered note');
    expect(await page.getByRole('button', { name: /Upgrade Plan/ }).filter({ visible: true }).count() > 0, '2 own Business: Upgrade Plan as before');
    await context.close();
  }
  {
    // (Role 2: a role-3 Starter account with a property gets the plan picker over everything first.)
    const { page, context } = await open({ who: BON_ROLE2, rows: [BONS_OWN], path: '/', plan: { plan_name: 'Starter', plan_covered_by: null } });
    await openSettings(page, 1280);
    await page.getByTestId('profile-plan-badge').first().waitFor({ state: 'visible', timeout: 30000 });
    expect((await page.getByTestId('profile-plan-badge').first().textContent())?.trim() === 'Starter', '2 own Starter: Profile Settings badge Starter');
    expect(await page.getByTestId('profile-plan-covered').count() === 0, '2 own Starter: no covered note');
    await context.close();
  }

  // ---------- 4 + 7. Users → External / Properties rows ----------
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = `${width}`;
    const { page, context } = await open({ width, height });
    await rowOf(page, 'Downtown Lot', width).waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);
    expect(await visibleCount(page, '1 property') > 0, `${tag} 7: Properties count says "1 property"`);
    expect(await visibleCount(page, '1 properties') === 0, `${tag} 7: never "1 properties"`);
    expect(await rowImage(page, 'Downtown Lot', width) === OLD_URL, `${tag} 4: internal row keeps its own image`);
    await shot(page, `${tag}-4-properties-tab`);

    await tabButton(page, 'External').click();
    await rowOf(page, 'Artem Auto', width).waitFor({ state: 'visible', timeout: 15000 });
    await page.getByText('Loading properties...').first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);
    const artem = await rowImage(page, 'Artem Auto', width);
    const bob = await rowImage(page, 'Bob Bozic', width);
    const rita = await rowImage(page, 'Rita Rep', width);
    expect(artem === LOGO_URL, `${tag} 4: Artem's row shows his account's logo (${artem})`);
    expect(bob === STORE_URL, `${tag} 4: a property image still wins (${bob})`);
    expect(rita === null, `${tag} 4: no image anywhere → the shield (${rita})`);
    expect(await visibleCount(page, '3 external accounts') > 0, `${tag} 7: External count says "3 external accounts"`);
    if (width < 1024) expect(await noOverflow(page), `${tag} 4: no sideways scroll`);
    await shot(page, `${tag}-4-external-tab-logos`);
    await context.close();
  }
  // One external account → singular; an internal row with no image keeps the shield even though its account has a photo.
  {
    const { page, context } = await open({ rows: [INTERNAL_NO_IMAGE, EXT_ARTEM], tab: 'external' });
    await rowOf(page, 'Artem Auto', 1280).waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);
    expect(await visibleCount(page, '1 external account') > 0, '7: External count says "1 external account"');
    await tabButton(page, 'Properties').click();
    await rowOf(page, 'Chris Wirth', 1280).waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500);
    expect(await rowImage(page, 'Chris Wirth', 1280) === null, '4: internal row without an image keeps the shield (not the account photo)');
    await shot(page, '1280-4-internal-shield');
    await context.close();
  }

  // ---------- 5. Profile menu: Properties (N) and External (N) ----------
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = `${width}`;
    const { page, context } = await open({ width, height, path: '/' });
    await page.getByText('Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1200);
    await openProfileMenu(page, width);
    const props = page.getByRole('button', { name: 'Properties (1)', exact: true }).filter({ visible: true });
    const ext = page.getByRole('button', { name: 'External (3)', exact: true }).filter({ visible: true });
    expect(await props.count() === 1, `${tag} 5: Profile menu has "Properties (1)"`);
    expect(await ext.count() === 1, `${tag} 5: Profile menu has "External (3)"`);
    expect(await page.getByText(/Property Accounts/).filter({ visible: true }).count() === 0, `${tag} 5: no "Property Accounts"`);
    expect(await page.getByText(/internal, \d+ external/).filter({ visible: true }).count() === 0, `${tag} 5: no "n internal, n external"`);
    await shot(page, `${tag}-5-profile-menu-closed`);
    await ext.first().click();
    await page.waitForTimeout(400);
    expect(await page.getByRole('button', { name: /Artem Auto/ }).filter({ visible: true }).count() > 0, `${tag} 5: External opens its list`);
    expect(await page.getByRole('button', { name: /Downtown Lot/ }).filter({ visible: true }).count() === 0, `${tag} 5: ... without the properties`);
    await props.first().click();
    await page.waitForTimeout(400);
    expect(await page.getByRole('button', { name: /Downtown Lot/ }).filter({ visible: true }).count() > 0, `${tag} 5: Properties opens its own list`);
    expect(await page.getByText(/^Internal \(/).filter({ visible: true }).count() === 0, `${tag} 5: no "Internal" label`);
    await page.getByPlaceholder('Search external accounts...').filter({ visible: true }).first().fill('rita');
    await page.waitForTimeout(300);
    expect(await page.getByRole('button', { name: /Artem Auto/ }).filter({ visible: true }).count() === 0
      && await page.getByRole('button', { name: /Rita Rep/ }).filter({ visible: true }).count() > 0, `${tag} 5: External has its own search`);
    expect(await page.getByRole('button', { name: /Downtown Lot/ }).filter({ visible: true }).count() > 0, `${tag} 5: ... which leaves Properties alone`);
    await page.getByPlaceholder('Search external accounts...').filter({ visible: true }).first().fill('');
    await page.waitForTimeout(300);
    if (width < 1024) expect(await noOverflow(page), `${tag} 5: no sideways scroll`);
    await shot(page, `${tag}-5-profile-menu-both-open`);
    await context.close();
  }

  // ---------- 6. Salesperson: the main account's product names its owner ----------
  {
    const { page, context } = await open({ who: BON, rows: [BONS_OWN], path: '/memories', seed: { stasht_campaigns_view: 'storeels' } });
    await page.getByText('Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    const storeels = page.getByRole('radio', { name: /^Storeels/ }).filter({ visible: true }).first();
    if (await storeels.count()) await storeels.click().catch(() => {});
    await page.getByText(SERPA_PRODUCT.title).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(800);
    expect(await visibleCount(page, 'Complete your Profile') > 0, '3: his personal view keeps "Complete your Profile"');
    const card = page.locator('.memory-card-container', { hasText: SERPA_PRODUCT.title }).filter({ visible: true }).first();
    const own = page.locator('.memory-card-container', { hasText: BON_PRODUCT.title }).filter({ visible: true }).first();
    const cardText = (await card.textContent()) || '';
    const ownText = (await own.textContent()) || '';
    expect(/Serpa/.test(cardText) && !/Bon Sun/.test(cardText), `6: Serpa's product card names Serpa, not Bon (${cardText.slice(0, 80)})`);
    expect(/Bon/.test(ownText), `6: Bon's own product keeps Bon as the author (${ownText.slice(0, 80)})`);
    await card.scrollIntoViewIfNeeded();
    await shot(page, '1280-6-product-card-owner');
    await context.close();
  }

  // ---------- 3. External view: the camera changes the property's image only ----------
  {
    const { page, context, state } = await open({ who: BON, rows: [BONS_OWN], path: '/', seed: { view_type: 'property', selected_property: BONS_OWN } });
    await page.getByText('Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1500);
    expect(await visibleCount(page, 'Get Started') > 0, '3: Get Started is shown in the External view');
    expect(await visibleCount(page, 'Complete your Profile') === 0, '3: ... without "Complete your Profile" (personal photo and bio)');
    await shot(page, '1280-3-external-view-get-started');
    await openProfileMenu(page, 1280);
    expect(await page.getByText('Back to Bon Sun').filter({ visible: true }).count() > 0, '3: External view Profile menu offers Back to Bon Sun');
    expect(await page.getByRole('button', { name: 'Settings', exact: true }).filter({ visible: true }).count() === 0, '3: no Settings (personal profile) in the External view menu');
    expect(await page.getByRole('button', { name: 'Change property image' }).filter({ visible: true }).count() === 1, '3: camera on the property avatar');
    await page.locator('[data-testid=property-avatar-input]').setInputFiles(images.store.path);
    await page.waitForTimeout(1500);
    const toasts = await toastText(page);
    expect(state.updates.length === 1 && state.updates[0].id === 96 && !!state.updates[0].fields.image, `3: POST /properties/96/update with the image (${JSON.stringify(state.updates.map((u) => u.id))})`);
    expect(state.profileWrites.length === 0, `3: the personal profile is untouched (${JSON.stringify(state.profileWrites)})`);
    expect(toasts.some((t) => t.includes('Property image updated')), `3: says Property image updated (${toasts})`);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('stasht_user') || '{}'));
    expect(!stored.profile_image && !stored.avatar, '3: the signed-in person keeps no new photo');
    expect(await page.locator(`[data-testid=property-avatar] img[src="${STORE_URL}"]`).filter({ visible: true }).count() > 0, '3: the property avatar shows the new image');
    await shot(page, '1280-3-external-view-camera-saved');
    await context.close();
  }

  // ---------- 8. Edit Property: a file that can't be shown as an image never leaves a broken preview ----------
  // A text file named .png passes the type check (image/png) but can't be drawn: the box shows what it showed before
  // (the saved image, or the empty upload box), says why, and the file is never sent. A real image the server refuses
  // still stays chosen (property-image-and-external-tab.mjs, "keeps the form and the chosen image").
  for (const [label, rowName, rows, expectSrc] of [
    ['saved image', 'Downtown Lot', [INTERNAL_DOWNTOWN, EXT_ARTEM], OLD_URL],
    ['no image', 'Chris Wirth', [INTERNAL_NO_IMAGE, EXT_ARTEM], null],
  ]) {
    const { page, context, state } = await open({ rows });
    await rowOf(page, rowName, 1280).waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);
    const menu = await openMenu(page, rowName, 1280);
    await menu.getByRole('menuitem', { name: /Edit Property/ }).click();
    await page.getByText('Edit Property', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(400);
    await page.locator('[data-testid=property-image-input]').setInputFiles(`${OUT}/fixture-not-really.png`);
    await page.waitForTimeout(1000);
    const toasts = await toastText(page);
    expect(toasts.some((t) => t.includes('Please choose a PNG, JPG, GIF or WebP image.')), `8 ${label}: says to choose a PNG, JPG, GIF or WebP image (${toasts})`);
    const preview = page.locator('img[alt="Property preview"]');
    const after = (await preview.count()) ? await preview.getAttribute('src') : null;
    expect(after === expectSrc, `8 ${label}: the box shows ${expectSrc ?? 'the empty upload box'} again (${after?.slice(0, 40)})`);
    if (expectSrc === null) expect(await visibleCount(page, 'Click to upload property image') > 0, `8 ${label}: the empty upload box`);
    if (expectSrc) expect(await preview.evaluate((img) => img.complete && img.naturalWidth > 0), `8 ${label}: the image really shows (not broken)`);
    if (label === 'saved image') await shot(page, '1280-8-unreadable-file-reverted');
    await page.getByRole('button', { name: 'Update Property' }).click();
    await page.waitForTimeout(1200);
    expect(state.updates.length === 1 && !state.updates[0].fields.image && state.updates[0].fields.remove_image !== '1',
      `8 ${label}: Update sends no image and keeps the saved one (${JSON.stringify(state.updates.map((u) => Object.keys(u.fields)))})`);
    await context.close();
  }

  // ---------- 8b. A real image after an unreadable one is sent ----------
  {
    const { page, context, state } = await open({ rows: [INTERNAL_NO_IMAGE, EXT_ARTEM] });
    await rowOf(page, 'Chris Wirth', 1280).waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);
    const menu = await openMenu(page, 'Chris Wirth', 1280);
    await menu.getByRole('menuitem', { name: /Edit Property/ }).click();
    await page.waitForTimeout(400);
    await page.locator('[data-testid=property-image-input]').setInputFiles(`${OUT}/fixture-not-really.png`);
    await page.waitForTimeout(900);
    await page.locator('[data-testid=property-image-input]').setInputFiles(images.store.path);
    await page.waitForTimeout(900);
    const src = await page.locator('img[alt="Property preview"]').getAttribute('src');
    expect(!!src && src.startsWith('data:image/png'), '8b: the real image is previewed');
    await page.getByRole('button', { name: 'Update Property' }).click();
    await page.waitForTimeout(1200);
    expect(state.updates.length === 1 && state.updates[0].fields.image?.filename === 'fixture-store-front.png', `8b: and sent (${JSON.stringify(state.updates.map((u) => u.fields.image))})`);
    await context.close();
  }
} catch (e) {
  failures.push(`threw: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
}
for (const e of pageErrors) failures.push(`page error: ${e}`);
console.log('blocked (never sent):', [...blocked].join(', ') || 'none');
if (failures.length) {
  console.error(`FAIL batch3-external\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('PASS batch3-external');
