// Users → Properties: Active/Inactive + Internal/External badges, Deactivate / Reactivate / Delete, and opening
// an external property as its own account (login-as-admin) instead of the property view (31 Oct, wdy2xh2x97).
// node tests/properties/ui/properties-tab.mjs   (needs the dev server: PR_BASE, default http://localhost:5263)
// The app's API calls are answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: PR_SHOTS (default /private/tmp/claude-501/properties-ui/shots).
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.PR_BASE || 'http://localhost:5263';
const OUT = process.env.PR_SHOTS || '/private/tmp/claude-501/properties-ui/shots';
mkdirSync(OUT, { recursive: true });

// role 2 + a Professional plan: what shows the Properties tab (UsersPage).
const MAIN = { id: 70, external_user_id: 707, name: 'Main Dealer', email: 'main@dealer.test', role: '2', status: 1 };
const BOB = { id: 90, external_user_id: 901, name: 'Bob Bozic', email: 'bob@dealer.test', role: '3', status: 1 };
const DELETE_EXTERNAL = "Closes Bob Bozic's account: they can't sign in, their own campaigns, leads and newsletters are removed, and any subscription is cancelled. Campaigns you transferred to it come back to you.";
const DELETE_INTERNAL = 'Removes the property. Campaigns you transferred to it come back to you.';
const REFUSED = 'Only the main account or an admin of this property can do that.';

const base = { location: 'Toronto, ON', memories_count: 2, users_count: 1, invited_users: [], labels: [], invite_link: null, created_at: '2026-10-01T10:00:00Z' };
function rows() {
  return [
    { ...base, id: 1, name: 'Pedalheads North', unique_id: 'PH-1', user_id: 707, is_creator: true, user_role: 'admin', property_type: 'internal', status: 'inactive', account_type: 'internal', is_active: true, can_manage: true },
    { ...base, id: 2, name: 'Bob Bozic', unique_id: 'BB-2', user_id: 901, parent_user_id: 707, is_creator: false, user_role: 'admin', property_type: 'external', status: 1, account_type: 'external', is_active: true, can_manage: true },
    { ...base, id: 3, name: 'Sam Seller', unique_id: 'SS-3', user_id: 902, parent_user_id: 707, is_creator: false, user_role: 'admin', property_type: 'external', status: 0, account_type: 'external', is_active: false, can_manage: true },
    { ...base, id: 4, name: 'Rita Rep', unique_id: 'RR-4', user_id: 903, parent_user_id: 555, is_creator: false, user_role: 'viewer', property_type: 'external', status: 1, account_type: 'external', is_active: true, can_manage: false },
  ];
}

const failures = [];
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }) {
  const state = { rows: rows(), statusCalls: [], deleteCalls: [], switchCalls: [], propertyFetches: 0 };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('pr-seeded')) return; // only the first load: later loads keep what the app stored
    sessionStorage.setItem('pr-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'main-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    sessionStorage.setItem('users_open_tab', 'properties');
  }, [MAIN]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
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
    const path = url.pathname.replace(/^\/api\/react/, '');
    if (url.pathname.startsWith('/api/')) {
      const auth = req.headers()['authorization'] || '';
      if (path === '/properties' && req.method() === 'GET') {
        state.propertyFetches++;
        const owned = state.rows.filter((r) => r.is_creator);
        const shared = state.rows.filter((r) => !r.is_creator);
        return route.fulfill({ json: { success: true, data: { properties: state.rows, owned_properties: owned, shared_properties: shared, owned_count: owned.length, shared_count: shared.length, total_count: state.rows.length } } });
      }
      let m = path.match(/^\/properties\/(\d+)\/status$/);
      if (m && req.method() === 'POST') {
        const body = JSON.parse(req.postData() || 'null');
        state.statusCalls.push({ id: Number(m[1]), body, auth });
        const row = state.rows.find((r) => r.id === Number(m[1]));
        if (row.id === 3) return route.fulfill({ status: 403, json: { success: false, message: REFUSED } });
        row.is_active = !!body.active;
        return route.fulfill({ json: { success: true, data: row } });
      }
      m = path.match(/^\/properties\/(\d+)$/);
      if (m && req.method() === 'DELETE') {
        state.deleteCalls.push({ id: Number(m[1]), auth });
        state.rows = state.rows.filter((r) => r.id !== Number(m[1]));
        return route.fulfill({ json: { success: true, message: 'Property deleted' } });
      }
      if (path === '/user/storage-overview') {
        return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
      }
      if (path === '/login-as-admin') {
        state.switchCalls.push({ body: JSON.parse(req.postData() || 'null'), auth });
        return route.fulfill({ json: { success: true, data: { user: BOB, token: 'bob-token', collaborators: [], properties: [] } } });
      }
      return route.fulfill({ json: { success: true, data: [] } });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/users`);
  try {
    await page.getByText('Pedalheads North').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 20000 });
  } catch (e) {
    await page.screenshot({ path: `${OUT}/debug-open-${width}.png` });
    console.log('url at failure:', page.url());
    throw e;
  }
  await page.waitForTimeout(500);
  return { context, page, state };
}

async function shot(page, file) {
  const path = `${OUT}/${file}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('shot', path);
}

// The visible row (desktop table row or phone card) for a property.
function rowOf(page, name, width) {
  return width >= 1024
    ? page.locator('tr', { hasText: name }).filter({ visible: true }).first()
    : page.locator('div.p-3', { hasText: name }).filter({ visible: true }).first();
}
async function openMenu(page, name, width) {
  await rowOf(page, name, width).locator('button').last().click();
  const menu = page.getByRole('menu');
  await menu.waitFor({ state: 'visible', timeout: 5000 });
  return menu;
}
async function menuItems(page, name, width) {
  const menu = await openMenu(page, name, width);
  const items = await menu.getByRole('menuitem').evaluateAll((els) => els.map((el) => ({ text: el.textContent.trim(), disabled: el.hasAttribute('data-disabled') })));
  return items;
}
async function closeMenu(page) {
  await page.keyboard.press('Escape');
  const menu = page.getByRole('menu');
  const closed = await menu.waitFor({ state: 'hidden', timeout: 1500 }).then(() => true, () => false);
  if (!closed) {
    await page.mouse.click(2, 300); // an outside click closes a Radix menu too
    await menu.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => failures.push('a row menu did not close'));
  }
}
async function badgesOf(page, name, width) {
  return rowOf(page, name, width).locator('[data-slot=badge], .inline-flex').evaluateAll((els) => els.map((el) => el.textContent.trim()).filter(Boolean));
}
async function toastText(page) {
  await page.waitForTimeout(300);
  return page.locator('[data-sonner-toast]').evaluateAll((els) => els.map((el) => el.textContent.trim()));
}
// The Profile menu: the chevron next to the name on desktop, the initials on phones.
async function openProfileMenu(page, initials, width) {
  if (width >= 1024) await page.locator('[data-name="Dropdown"]').filter({ visible: true }).first().locator('*').first().click();
  else await page.getByText(initials, { exact: true }).filter({ visible: true }).first().click();
  await page.waitForTimeout(400);
}
async function noOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const { page, context, state } = await open({ width, height });
    await shot(page, `${tag}-01-properties`);
    if (width < 1024) expect(await noOverflow(page), `${tag}: no sideways scroll`);

    // Badges.
    const b1 = await badgesOf(page, 'Pedalheads North', width);
    const b2 = await badgesOf(page, 'Bob Bozic', width);
    const b3 = await badgesOf(page, 'Sam Seller', width);
    const b4 = await badgesOf(page, 'Rita Rep', width);
    console.log(tag, 'badges', JSON.stringify({ b1, b2, b3, b4 }));
    expect(b1.includes('Active') && b1.includes('Internal') && !b1.includes('Inactive'), `${tag}: internal row Active + Internal (${b1})`);
    expect(b2.includes('Active') && b2.includes('External'), `${tag}: external active row Active + External (${b2})`);
    expect(b3.includes('Inactive') && b3.includes('External'), `${tag}: external inactive row Inactive + External (${b3})`);
    expect(b4.includes('Active') && b4.includes('External'), `${tag}: no-manage row Active + External (${b4})`);
    for (const b of [b1, b2, b3, b4]) expect(!b.some((t) => t === '1' || t === '0'), `${tag}: no raw status numbers (${b})`);

    // Menus.
    const has = (items, text) => items.some((i) => i.text.startsWith(text));
    const m1 = await menuItems(page, 'Pedalheads North', width);
    expect(has(m1, 'Deactivate') && !has(m1, 'Reactivate') && has(m1, 'Delete Property'), `${tag}: internal menu (${JSON.stringify(m1)})`);
    await closeMenu(page);
    const m2 = await menuItems(page, 'Bob Bozic', width);
    expect(has(m2, 'Deactivate') && has(m2, 'Delete Property') && !m2.find((i) => i.text.startsWith('View Property')).disabled, `${tag}: external active menu (${JSON.stringify(m2)})`);
    await shot(page, `${tag}-02-menu-external-active`);
    await closeMenu(page);
    const m3 = await menuItems(page, 'Sam Seller', width);
    const view3 = m3.find((i) => i.text.startsWith('View Property'));
    expect(has(m3, 'Reactivate') && !has(m3, 'Deactivate') && has(m3, 'Delete Property'), `${tag}: external inactive menu (${JSON.stringify(m3)})`);
    expect(view3?.disabled && /Deactivated/.test(view3.text), `${tag}: inactive external can't be opened (${JSON.stringify(view3)})`);
    await shot(page, `${tag}-03-menu-external-inactive`);
    await closeMenu(page);
    const m4 = await menuItems(page, 'Rita Rep', width);
    expect(!has(m4, 'Deactivate') && !has(m4, 'Reactivate') && !has(m4, 'Delete Property') && has(m4, 'View Property'), `${tag}: no-manage menu hides the actions (${JSON.stringify(m4)})`);
    await shot(page, `${tag}-04-menu-no-manage`);
    await closeMenu(page);

    // Reactivate refused: the API's message in a toast, nothing changes.
    await (await openMenu(page, 'Sam Seller', width)).getByRole('menuitem', { name: 'Reactivate' }).click();
    await page.waitForTimeout(500);
    const refusedCall = state.statusCalls.at(-1);
    expect(refusedCall?.id === 3 && refusedCall.body?.active === true, `${tag}: Reactivate sends {active: true} (${JSON.stringify(refusedCall)})`);
    const toasts1 = await toastText(page);
    expect(toasts1.some((t) => t.includes(REFUSED)), `${tag}: refusal message shown (${toasts1})`);
    await shot(page, `${tag}-05-refused-toast`);

    // Deactivate the internal row: {active: false}, list refreshed, now Inactive with Reactivate.
    const fetchesBefore = state.propertyFetches;
    await (await openMenu(page, 'Pedalheads North', width)).getByRole('menuitem', { name: 'Deactivate' }).click();
    await page.waitForTimeout(800);
    const deact = state.statusCalls.at(-1);
    expect(deact?.id === 1 && deact.body?.active === false, `${tag}: Deactivate sends {active: false} (${JSON.stringify(deact)})`);
    expect(state.propertyFetches > fetchesBefore, `${tag}: list refreshed after Deactivate`);
    const b1after = await badgesOf(page, 'Pedalheads North', width);
    expect(b1after.includes('Inactive'), `${tag}: internal row now Inactive (${b1after})`);
    const m1after = await menuItems(page, 'Pedalheads North', width);
    expect(has(m1after, 'Reactivate'), `${tag}: internal row now offers Reactivate (${JSON.stringify(m1after)})`);
    await closeMenu(page);

    // Delete dialogs: the exact words; Cancel sends nothing.
    await (await openMenu(page, 'Bob Bozic', width)).getByRole('menuitem', { name: 'Delete Property' }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    const ext = (await dialog.textContent()) || '';
    expect(ext.includes(DELETE_EXTERNAL), `${tag}: external delete text (${ext})`);
    await page.waitForTimeout(300);
    await shot(page, `${tag}-06-delete-external`);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    expect(state.deleteCalls.length === 0, `${tag}: Cancel deletes nothing`);

    await (await openMenu(page, 'Pedalheads North', width)).getByRole('menuitem', { name: 'Delete Property' }).click();
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    const int = (await dialog.textContent()) || '';
    expect(int.includes(DELETE_INTERNAL) && !int.includes('Closes'), `${tag}: internal delete text (${int})`);
    await page.waitForTimeout(300);
    await shot(page, `${tag}-07-delete-internal`);
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => failures.push(`${tag}: dialog stays after Delete`));
    await page.waitForTimeout(600);
    expect(state.deleteCalls.length === 1 && state.deleteCalls[0].id === 1, `${tag}: DELETE /properties/1 sent (${JSON.stringify(state.deleteCalls)})`);
    expect((await rowOf(page, 'Pedalheads North', width).count()) === 0, `${tag}: deleted row gone after refresh`);
    await shot(page, `${tag}-08-after-delete`);

    // View on the external row: switches into that account (login-as-admin), not the property view.
    await (await openMenu(page, 'Bob Bozic', width)).getByRole('menuitem', { name: /View Property/ }).click();
    await page.waitForURL((u) => u.pathname === '/', { timeout: 10000 }).catch(() => failures.push(`${tag}: did not go to / after switching`));
    await page.waitForTimeout(1500);
    expect(state.switchCalls.length === 1 && String(state.switchCalls[0].body?.owner_id) === '901', `${tag}: login-as-admin for owner 901 (${JSON.stringify(state.switchCalls)})`);
    expect(state.switchCalls[0]?.auth === 'Bearer main-token', `${tag}: switch asked with the main account's token (${state.switchCalls[0]?.auth})`);
    const stored = await page.evaluate(() => ({
      token: localStorage.getItem('stasht_token'),
      user: JSON.parse(localStorage.getItem('stasht_user') || 'null'),
      view: localStorage.getItem('view_type'),
      selected: localStorage.getItem('selected_property'),
      switchData: JSON.parse(localStorage.getItem('admin_switch_data') || 'null'),
    }));
    console.log(tag, 'after switch', JSON.stringify({ ...stored, user: stored.user?.name }));
    expect(stored.token === 'bob-token' && stored.user?.name === 'Bob Bozic', `${tag}: signed in as Bob Bozic's account`);
    expect(stored.view !== 'property' && !stored.selected, `${tag}: not the property view (${stored.view}, ${stored.selected})`);
    expect(stored.switchData?.personal_account?.token === 'main-token' && stored.switchData?.current_mode === 'admin', `${tag}: can switch back to the main account (${JSON.stringify(stored.switchData)})`);
    await shot(page, `${tag}-09-in-external-account`);

    // And back: the Profile menu offers "Switch to Main Dealer".
    await openProfileMenu(page, 'BB', width);
    const back = page.getByRole('button', { name: /Switch to Main Dealer/ }).filter({ visible: true }).first();
    await back.waitFor({ state: 'visible', timeout: 5000 }).catch(() => failures.push(`${tag}: no "Switch to Main Dealer" in the Profile menu`));
    await shot(page, `${tag}-10-profile-switch-back`);
    if (await back.isVisible()) {
      await back.click();
      await page.waitForLoadState('load');
      await page.waitForTimeout(1500);
      const token = await page.evaluate(() => localStorage.getItem('stasht_token'));
      expect(token === 'main-token', `${tag}: back in the main account (${token})`);
    }
    await context.close();
  }

  // Internal property: View keeps today's property view — no account switch.
  {
    const { page, context, state } = await open({ width: 1280, height: 900 });
    await (await openMenu(page, 'Pedalheads North', 1280)).getByRole('menuitem', { name: /View Property/ }).click();
    await page.waitForTimeout(1500);
    const stored = await page.evaluate(() => ({ view: localStorage.getItem('view_type'), selected: JSON.parse(localStorage.getItem('selected_property') || 'null'), token: localStorage.getItem('stasht_token') }));
    expect(state.switchCalls.length === 0, `internal View: no login-as-admin (${JSON.stringify(state.switchCalls)})`);
    expect(stored.view === 'property' && stored.selected?.id === 1 && stored.token === 'main-token', `internal View: property view of Pedalheads North (${JSON.stringify(stored)})`);
    await context.close();
  }

  // Profile menu → Property Accounts: the inactive external one is disabled ("Deactivated"); an active one switches.
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const { page, context, state } = await open({ width, height });
    await openProfileMenu(page, 'MD', width);
    await page.getByRole('button', { name: /Property Accounts/ }).filter({ visible: true }).first().click();
    const sam = page.getByRole('button', { name: /Sam Seller/ }).filter({ visible: true }).first();
    await sam.waitFor({ state: 'visible', timeout: 5000 });
    expect(await sam.isDisabled(), `${width} profile: inactive external disabled`);
    expect(/Deactivated/.test((await sam.textContent()) || ''), `${width} profile: says Deactivated`);
    await sam.scrollIntoViewIfNeeded();
    await shot(page, `${width}-11-profile-property-accounts`);
    await page.getByRole('button', { name: /Bob Bozic/ }).filter({ visible: true }).first().click();
    await page.waitForURL((u) => u.pathname === '/', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    expect(state.switchCalls.length === 1 && String(state.switchCalls[0].body?.owner_id) === '901', `${width} profile: Bob Bozic opens with login-as-admin (${JSON.stringify(state.switchCalls)})`);
    expect((await page.evaluate(() => localStorage.getItem('stasht_token'))) === 'bob-token', `${width} profile: signed in as Bob Bozic's account`);
    await context.close();
  }
} catch (e) {
  failures.push(`threw: ${e.message}`);
} finally {
  await browser.close();
}
for (const e of pageErrors) failures.push(`page error: ${e}`);
if (blocked.size) console.log(`outside requests aborted (none reached the network): ${[...blocked].join(', ')}`);
if (failures.length) {
  console.error(`FAIL properties-tab\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('PASS properties-tab');
