// Chris 23 Nov 2026, points C and D.
//  C. Settings has no Account Security card any more (password / two-factor; sign-in is by verification code only):
//     not on the page, not in the page's section list, not in the Settings side menu; the other sections stay.
//     An account still flagged change_password = 1 (old forgot-password temporary password) is no longer sent to
//     Settings and held there.
//  D. Choose Account (sign-in): the account they're an admin of reads like the Personal row — business name, logo
//     (else initials on its profile colour) and email — never "Admin Account 1"; the open "Admin Accounts" header is a
//     darker gray with no black click outline, and the keyboard still gets a ring. The profile menu's switcher lists
//     the same names after signing in.
// node tests/account/ui/c23-settings-choose-account.mjs   (dev server: C23_BASE, default http://127.0.0.1:5623;
//   C23_SHOTS = screenshot dir). Every API call is answered here; every non-local request is aborted.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.C23_BASE || 'http://127.0.0.1:5623';
const OUT = process.env.C23_SHOTS || '/private/tmp/claude-501/c23-bcd/shots';
mkdirSync(OUT, { recursive: true });

const NEO = { id: 1501, external_user_id: 1601, name: 'Neolegend Sports', email: 'neolegendsports@example.test', role: '2', status: 1, is_activated: true, profile_color: 'c026d3', profile_image: `${BASE}/pwa-icon-192.png` };
const LOGO = `${BASE}/pwa-icon-512.png`;
// What the web API now sends (UserController::adminOwnerSummary): name, email, picture, colour from either users table.
const ROYAL = { id: 959, role: 'admin', owner_id: 959, user_id: 1601, memory_id: null, status: 1,
  owner: { id: 708, external_user_id: 959, name: 'Royal Wood Shop', email: 'hello@royalwood.example', phone_number: null, profile_image: LOGO, profile_color: 'ff8800', location: 'Location Not Specified' } };
const SERPA = { id: 960, role: 'admin', owner_id: 889, user_id: 1601, memory_id: null, status: 1,
  owner: { id: 710, external_user_id: 889, name: 'Serpa Chrysler', email: 'sales@serpa.example', phone_number: null, profile_image: null, profile_color: '1d4ed8', location: 'Toronto, ON' } };
// No name: the email is the name.
const NONAME = { id: 961, role: 'admin', owner_id: 777, user_id: 1601, memory_id: null, status: 1,
  owner: { id: 711, external_user_id: 777, name: null, email: 'owner@noname.example', phone_number: null, profile_image: null, profile_color: null } };
const PARTIAL = { owner_id: 555, owner: { id: 712, external_user_id: 555, name: 'TheBodyPolitik', email: 'hi@bodypolitik.example', profile_image: null, profile_color: '16a34a' }, memories: [] };

const failures = [];
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height, seed = null, path = '/' }) {
  const state = { calls: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([seedData]) => {
    if (sessionStorage.getItem('c23-seeded')) return;
    sessionStorage.setItem('c23-seeded', '1');
    localStorage.clear();
    if (!seedData) return;
    for (const [k, v] of Object.entries(seedData)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, [seed]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      blocked.add(url.hostname);
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: 'window.Stripe=function(){return{elements:function(){return{create:function(){return{mount:function(){},on:function(){},destroy:function(){},unmount:function(){}}},getElement:function(){return null}}}}};' });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: 'window.gapi={load:function(n,c){var f=typeof c==="function"?c:(c&&c.callback);if(f)f();}};' });
      return route.abort('blockedbyclient');
    }
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    state.calls.push(`${req.method()} ${p}`);
    if (p === '/send-otp') return route.fulfill({ json: { success: true, message: 'OTP sent', channel: 'email' } });
    if (p === '/verify-otp') return route.fulfill({ json: { success: true, verification_token: 'vt-1' } });
    if (p === '/login' && req.method() === 'POST') {
      return route.fulfill({ json: { success: true, data: { user: NEO, token: 'neo-token', collaborators: [ROYAL, SERPA, NONAME], partial_admin_access: [PARTIAL], owned_properties: [], shared_properties: [] } } });
    }
    if (p === '/user/profile') return route.fulfill({ json: { success: true, data: { user: { ...NEO, phone_number: '+14165550100', location: 'Toronto, ON', bio: '' } } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional', used_storage_gb: 1, total_storage_gb: 100 } } } });
    if (p === '/properties' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { properties: [], owned_properties: [], shared_properties: [], owned_count: 0, shared_count: 0, total_count: 0 } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(`${width}: ${e.message}`));
  await page.goto(`${BASE}${path}`);
  return { context, page, state };
}

async function signIn(page, email) {
  const field = page.locator('input[type=email]').filter({ visible: true }).first();
  await field.waitFor({ state: 'visible', timeout: 60000 });
  await field.fill(email);
  await page.getByRole('button', { name: /Send OTP|Send code|Send verification code/i }).filter({ visible: true }).first().click();
  const otp = page.locator('#otp');
  await otp.waitFor({ state: 'visible', timeout: 10000 });
  await otp.fill('123456');
  await page.getByRole('button', { name: /Verify & Sign In|Sign In/ }).filter({ visible: true }).first().click();
}
const shot = async (page, file) => { const path = `${OUT}/${file}.png`; await page.screenshot({ path }); console.log('  shot', path); };
const look = (loc) => loc.evaluate((el) => {
  const s = getComputedStyle(el);
  return { outline: s.outlineStyle === 'none' || s.outlineColor === 'rgba(0, 0, 0, 0)' ? 'none' : `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, shadow: s.boxShadow, bg: s.backgroundColor, focusVisible: el.matches(':focus-visible'), focused: document.activeElement === el };
});
const GRAY_100 = 'rgb(243, 244, 246)';
async function waitForApp(page) {
  await page.getByText('Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 40000 });
  await page.waitForTimeout(1500);
}
async function openProfileMenu(page, width) {
  // Phones: the header's avatar (MobileProfileAvatar) opens the same menu.
  if (width < 1024) await page.locator('img[alt="Neolegend Sports"]').filter({ visible: true }).first().click();
  else await page.locator('[data-name="Dropdown"]').filter({ visible: true }).first().locator('*').first().click();
  await page.waitForTimeout(800);
}

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    // ---- D. Sign in → Choose Account.
    {
      const { page, context } = await open({ width, height, path: '/login?prefill_email=neolegendsports@example.test' });
      await signIn(page, NEO.email);
      await page.getByText('Choose Account', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 20000 });
      await page.waitForTimeout(500);
      const header = page.getByTestId('chooser-admin-header');
      await header.waitFor({ state: 'visible', timeout: 30000 });
      expect(/Admin Accounts \(4\)/.test(await header.textContent()), `${tag} D: Admin Accounts (4) — three admins + one partial`);
      await header.click();
      await page.waitForTimeout(500);
      const names = await page.getByTestId('admin-account-name').allInnerTexts();
      console.log(tag, 'rows', JSON.stringify(names));
      expect(JSON.stringify(names) === JSON.stringify(['Royal Wood Shop', 'Serpa Chrysler', 'owner@noname.example', 'TheBodyPolitik']), `${tag} D: rows are the business names / email (got ${JSON.stringify(names)})`);
      expect(!(await page.getByText(/Admin Account \d/).count()), `${tag} D: no "Admin Account N" anywhere`);
      const modal = page.locator('div', { has: page.getByText('Choose Account', { exact: true }) }).last();
      expect((await page.getByText('hello@royalwood.example').filter({ visible: true }).count()) === 1, `${tag} D: Royal Wood's email under its name`);
      expect((await page.getByText('sales@serpa.example').filter({ visible: true }).count()) === 1, `${tag} D: Serpa's email under its name`);
      expect((await page.getByText('owner@noname.example').filter({ visible: true }).count()) === 1, `${tag} D: a nameless account's email shown once (as its name)`);
      expect((await page.locator(`img[src="${LOGO}"]`).filter({ visible: true }).count()) === 1, `${tag} D: Royal Wood's logo`);
      const serpaInitials = page.locator('span[aria-hidden="true"]', { hasText: /^SC$/ }).filter({ visible: true }).first();
      expect((await serpaInitials.count()) === 1, `${tag} D: Serpa shows "SC" initials`);
      if (await serpaInitials.count()) expect((await look(serpaInitials)).bg === 'rgb(29, 78, 216)', `${tag} D: on its profile colour #1d4ed8 (got ${(await look(serpaInitials)).bg})`);
      // The open header after a click: darker gray, no black outline, no ring (mouse focus).
      const after = await look(header);
      console.log(tag, 'header after click', JSON.stringify(after));
      expect(after.outline === 'none', `${tag} D: no outline after the click (got ${after.outline})`);
      expect(!after.focusVisible && (after.shadow === 'none' || !/rgb\(156, 163, 175\)/.test(after.shadow)), `${tag} D: no ring after a click (got ${after.shadow})`);
      expect(after.bg === GRAY_100, `${tag} D: open header is darker gray (got ${after.bg})`);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(200);
      await shot(page, `${tag}-D1-choose-account-open`);
      // Keyboard (desktop; touch emulation has no keyboard focus ring): Tab onto the header → a gray ring shows.
      if (width >= 1024) {
      await page.getByRole('button', { name: /Your Personal Account/ }).focus();
      await page.waitForTimeout(150);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(150);
      if (!(await header.evaluate((el) => document.activeElement === el))) { await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); await page.waitForTimeout(150); }
      await page.waitForTimeout(200);
      const kb = await look(header);
      console.log(tag, 'header keyboard', JSON.stringify(kb));
      expect(kb.focused && kb.focusVisible && /rgb\(156, 163, 175\)/.test(kb.shadow), `${tag} D: keyboard focus shows a gray ring`);
      await shot(page, `${tag}-D2-choose-account-keyboard-ring`);
      }
      void modal;

      // Personal account → the profile menu lists the same names.
      await page.getByText('Your Personal Account - Access your own campaigns').click();
      await waitForApp(page);
      await openProfileMenu(page, width);
      const adminToggle = page.getByRole('button', { name: /Admin Accounts \(4\)/ }).filter({ visible: true }).first();
      expect((await adminToggle.count()) === 1, `${tag} D: profile menu has Admin Accounts (4)`);
      if (await adminToggle.count()) {
        await adminToggle.click();
        await page.waitForTimeout(400);
        for (const n of ['Royal Wood Shop', 'Serpa Chrysler', 'owner@noname.example', 'TheBodyPolitik']) {
          expect((await page.getByText(n, { exact: true }).filter({ visible: true }).count()) > 0, `${tag} D: profile menu lists ${n}`);
        }
        expect(!(await page.getByText(/Admin Account \d/).count()), `${tag} D: profile menu has no "Admin Account N"`);
        const m = await look(adminToggle);
        expect(m.outline === 'none' && m.bg === GRAY_100, `${tag} D: profile menu open header gray, no outline (got ${JSON.stringify(m)})`);
        await shot(page, `${tag}-D3-profile-menu-admin-accounts`);
      }
      await context.close();
    }

    // ---- C. Settings: no Account Security card.
    {
      const seed = { stasht_token: 'neo-token', stasht_user: { ...NEO, change_password: 1 }, view_type: 'personal' };
      const { page, context } = await open({ width, height, seed, path: '/memories' });
      await waitForApp(page);
      // change_password = 1 no longer forces Settings: the app stays on Campaigns.
      expect(!/profile/.test(new URL(page.url()).pathname), `${tag} C: a change_password account is not sent to Settings (at ${page.url()})`);
      await openProfileMenu(page, width);
      await page.getByRole('button', { name: 'Settings', exact: true }).filter({ visible: true }).first().click();
      await page.getByRole('heading', { name: 'Profile Settings', level: 1 }).waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(1500);
      expect(!(await page.getByText('Account Security').count()), `${tag} C: no "Account Security" anywhere (card, page menu, side menu)`);
      expect(!(await page.getByText('Two-Factor Authentication').count()), `${tag} C: no Two-Factor Authentication`);
      expect(!(await page.getByText('Manage your password and security settings').count()), `${tag} C: no password card text`);
      expect(!(await page.getByText('Password Change Required').count()), `${tag} C: no "Password Change Required" banner`);
      expect(!(await page.locator('#security').count()), `${tag} C: no #security section`);
      // The other sections stay (the page's own section ids; the hidden Privacy / App Preferences stay hidden as before).
      for (const id of ['personal', 'storage', 'categories', 'notifications', 'remove']) {
        expect((await page.locator(`#${id}`).count()) >= 1, `${tag} C: section #${id} still there`);
      }
      if (width >= 1024) {
        const side = await page.locator('aside').allInnerTexts();
        expect(/Storage Management/.test(side.join(' ')) && !/Account Security/.test(side.join(' ')), `${tag} C: side menu keeps the other sections, no Account Security`);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${tag} C: no sideways scroll`);
      await shot(page, `${tag}-C1-settings-top`);
      await page.locator('#storage').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await shot(page, `${tag}-C2-settings-after-personal`);
      // Leave Settings: nothing holds the account there.
      // (desktop: the sidebar's Campaigns; phone: open the Campaigns address, as its bottom bar does)
      if (width >= 1024) await page.getByText('Campaigns', { exact: true }).filter({ visible: true }).first().click().catch(() => {});
      else await page.goto(`${BASE}/memories`);
      await page.waitForTimeout(2500);
      expect(!(await page.getByRole('heading', { name: 'Profile Settings', level: 1 }).filter({ visible: true }).count()), `${tag} C: can leave Settings for Campaigns`);
      await context.close();
    }
  }
} catch (e) {
  failures.push(`threw: ${e.message}`);
} finally {
  await browser.close();
}
for (const e of pageErrors) failures.push(`page error: ${e}`);
if (blocked.size) console.log(`outside requests (answered locally or aborted; none reached the network): ${[...blocked].join(', ')}`);
if (failures.length) { console.error(`FAIL\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('PASS c23-settings-choose-account');
