// Chris, 1 Nov 2026:
//  - Users page tabs: All Users | Shared with | External | Properties. External = account_type 'external' rows
//    (salespeople / external accounts), Properties = internal properties only; same row actions and counts per tab.
//  - Users → Properties → ⋯ → Edit Property → "Property Image" uploads, saves and shows (table avatar), removing it
//    clears it, and an empty location is not saved as "No location".
//  - Property view: a camera button on the property avatar (top of the profile dropdown) changes the PROPERTY's own
//    image, for whoever may manage it (main account / property admins / the property's own account); never for a
//    rep or viewer. The new image shows in the dropdown card and the header straight away.
// node tests/properties/ui/property-image-and-external-tab.mjs   (needs the dev server: PI_BASE, default http://127.0.0.1:5287)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: PI_SHOTS (default /private/tmp/claude-501/property-image-ui/shots).
import { mkdirSync, writeFileSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.PI_BASE || 'http://127.0.0.1:5287';
const OUT = process.env.PI_SHOTS || '/private/tmp/claude-501/property-image-ui/shots';
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 70, external_user_id: 707, name: 'Main Dealer', email: 'main@dealer.test', role: '2', status: 1 };
// Becks: an existing account that joined Main Dealer (linked external; it keeps the property view of its own property).
const BECKS = { id: 71, external_user_id: 930, name: 'Becks Bikes', email: 'becks@dealer.test', role: '2', status: 1 };
const REX = { id: 72, external_user_id: 931, name: 'Rex Rep', email: 'rex@dealer.test', role: '2', status: 1 };

// Images the mocked S3 serves (made below, before the browser opens).
const LOGO_URL = `${BASE}/__test/inviter-logo.png`;
const STORE_URL = `${BASE}/__test/store-front.png`;
const OLD_URL = `${BASE}/__test/old-photo.png`;
const images = {};

const base = { memories_count: 2, users_count: 1, invited_users: [], labels: [], invite_link: null, created_at: '2026-10-01T10:00:00Z' };
function rows() {
  return [
    // Internal, no location and no image (the "Chris Wirth" case).
    { ...base, id: 3403, name: 'Chris Wirth', unique_id: '3403', username: 'chriswirth', location: null, image: null, user_id: 707, is_creator: true, user_role: 'admin', property_type: 'internal', status: 'inactive', account_type: 'internal', is_active: true, can_manage: true, account_created_for_property: false },
    // Internal with a saved image.
    { ...base, id: 12, name: 'Downtown Lot', unique_id: 'DL-12', username: 'downtown', location: 'Toronto, ON', image: OLD_URL, user_id: 707, is_creator: true, user_role: 'admin', property_type: 'internal', status: 'inactive', account_type: 'internal', is_active: true, can_manage: true, account_created_for_property: false },
    // External accounts.
    { ...base, id: 2, name: 'Bob Bozic', unique_id: 'BB-2', username: 'bob', location: 'Toronto, ON', image: null, user_id: 901, parent_user_id: 707, is_creator: false, user_role: 'admin', property_type: 'external', status: 1, account_type: 'external', is_active: true, can_manage: true, account_created_for_property: true },
    { ...base, id: 5, name: 'Bon Sun', unique_id: 'BS-5', username: 'bon', location: 'Toronto, ON', image: null, user_id: 966, parent_user_id: 707, is_creator: false, user_role: 'admin', property_type: 'external', status: 0, account_type: 'external', is_active: false, can_manage: true, account_created_for_property: true, delete_closes_account: true },
    // Someone else's external property this account only views (can_manage false): no Edit / Deactivate / Delete.
    { ...base, id: 4, name: 'Rita Rep', unique_id: 'RR-4', username: 'rita', location: 'Toronto, ON', image: null, user_id: 903, parent_user_id: 555, is_creator: false, user_role: 'viewer', property_type: 'external', status: 1, account_type: 'external', is_active: true, can_manage: false, account_created_for_property: true },
  ];
}

const failures = [];
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

// Test pictures, drawn by the browser itself.
async function makeImages() {
  const page = await browser.newPage({ viewport: { width: 240, height: 240 } });
  const draw = async (bg, text, file) => {
    await page.setContent(`<div style="width:240px;height:240px;background:${bg};display:flex;align-items:center;justify-content:center;font:bold 40px sans-serif;color:#fff">${text}</div>`);
    const buf = await page.screenshot({ type: 'png' });
    const path = `${OUT}/${file}`;
    writeFileSync(path, buf);
    return { path, buf };
  };
  images.logo = await draw('#1d4ed8', 'LOGO', 'fixture-inviter-logo.png');
  images.store = await draw('#059669', 'STORE', 'fixture-store-front.png');
  images.old = await draw('#9ca3af', 'OLD', 'fixture-old-photo.png');
  await page.close();
  writeFileSync(`${OUT}/fixture-notes.pdf`, '%PDF-1.4\n%fake\n');
}

/** Multipart body → { field: value | { filename } } (enough to see what the app sent). */
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

// who: the signed-in account. seed: extra localStorage (e.g. the property view). updateReply: override for the
// next /properties/{id}/update answer.
// scale: PI_SCALE (device pixels per CSS pixel) for the property-view screenshots only.
async function open({ width, height, who = MAIN, seed = {}, path = '/users', tab = 'properties', scale = false }) {
  const state = { rows: rows(), updates: [], statusCalls: [], propertyFetches: 0, updateReply: null };
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: (scale && Number(process.env.PI_SCALE)) || 1, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([seedData, openTab]) => {
    try {
      if (location.pathname === '/users' && openTab) sessionStorage.setItem('users_open_tab', openTab);
      if (sessionStorage.getItem('pi-seeded')) return;
      sessionStorage.setItem('pi-seeded', '1');
      localStorage.clear();
      for (const [k, v] of Object.entries(seedData)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    } catch {
      // about:blank of a new tab (the Leads report opens with noopener) has no storage yet
    }
  }, [{ stasht_token: `${who.name}-token`, stasht_user: who, view_type: 'personal', ...seed }, tab]);
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
    if (url.pathname === '/__test/inviter-logo.png') return route.fulfill({ contentType: 'image/png', body: images.logo.buf });
    if (url.pathname === '/__test/store-front.png') return route.fulfill({ contentType: 'image/png', body: images.store.buf });
    if (url.pathname === '/__test/old-photo.png') return route.fulfill({ contentType: 'image/png', body: images.old.buf });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (p === '/properties' && req.method() === 'GET') {
      state.propertyFetches++;
      const owned = state.rows.filter((r) => r.is_creator);
      const shared = state.rows.filter((r) => !r.is_creator);
      return route.fulfill({ json: { success: true, data: { properties: state.rows, owned_properties: owned, shared_properties: shared, owned_count: owned.length, shared_count: shared.length, total_count: state.rows.length } } });
    }
    let m = p.match(/^\/properties\/(\d+)\/update$/);
    if (m && req.method() === 'POST') {
      const fields = parseMultipart(req);
      state.updates.push({ id: Number(m[1]), fields, auth: req.headers()['authorization'], accept: req.headers()['accept'] });
      if (state.updateReply) {
        const reply = state.updateReply;
        state.updateReply = null;
        return route.fulfill(reply);
      }
      const row = state.rows.find((r) => r.id === Number(m[1])) || { id: Number(m[1]) };
      if (fields.image) row.image = STORE_URL;
      else if (fields.remove_image === '1') row.image = null;
      if (typeof fields.name === 'string') row.name = fields.name;
      return route.fulfill({ json: { status: 'success', message: 'Property updated successfully', data: { property: { ...row } } } });
    }
    m = p.match(/^\/properties\/(\d+)\/status$/);
    if (m && req.method() === 'POST') {
      const body = JSON.parse(req.postData() || 'null');
      state.statusCalls.push({ id: Number(m[1]), body });
      const row = state.rows.find((r) => r.id === Number(m[1]));
      row.is_active = !!body.active;
      return route.fulfill({ json: { success: true, data: row } });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
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
async function openMenu(page, name, width) {
  const trigger = rowOf(page, name, width).locator('button').last();
  try {
    await trigger.click({ timeout: 8000 });
  } catch {
    // A menu or toast still animating out: settle, then once more.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    await trigger.scrollIntoViewIfNeeded().catch(() => {});
    await shot(page, `debug-openmenu-${width}-${name.replace(/\W+/g, '-')}`);
    await trigger.click({ timeout: 8000, force: true });
  }
  const menu = page.getByRole('menu');
  await menu.waitFor({ state: 'visible', timeout: 5000 });
  return menu;
}
async function menuItems(page, name, width) {
  const menu = await openMenu(page, name, width);
  const items = await menu.getByRole('menuitem').evaluateAll((els) => els.map((el) => el.textContent.trim()));
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  return items;
}
async function toastText(page) {
  await page.waitForTimeout(300);
  return page.locator('[data-sonner-toast]').evaluateAll((els) => els.map((el) => el.textContent.trim()));
}
async function rowImage(page, name, width) {
  const img = rowOf(page, name, width).locator('img').first();
  if (!(await img.count())) return null;
  return img.getAttribute('src');
}
// The dropdown card's top (avatar, camera, name), larger.
async function closeUpShot(page, file) {
  const box = await page.locator('[data-testid=property-avatar]').filter({ visible: true }).first().boundingBox().catch(() => null);
  if (!box) return;
  const path = `${OUT}/${file}.png`;
  await page.screenshot({ path, clip: { x: Math.max(0, box.x - 16), y: Math.max(0, box.y - 16), width: 250, height: box.height + 32 } });
  console.log('shot', path);
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
async function openProfileMenu(page, width) {
  if (width >= 1024) await page.locator('[data-name="Dropdown"]').filter({ visible: true }).first().locator('*').first().click();
  else await page.locator('div.rounded-full.cursor-pointer').filter({ visible: true }).first().click();
  await page.waitForTimeout(600);
}

try {
  await makeImages();

  // ---------- C. External tab ----------
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const { page, context, state } = await open({ width, height });
    await rowOf(page, 'Chris Wirth', width).waitFor({ state: 'visible', timeout: 25000 });
    await page.waitForTimeout(400);

    const tabOrder = await page.locator('button').filter({ hasText: /^(All Users|Shared with|External|Properties)$/ }).filter({ visible: true })
      .evaluateAll((els) => els.map((el) => el.textContent.trim()));
    expect(JSON.stringify(tabOrder) === JSON.stringify(['All Users', 'Shared with', 'External', 'Properties']), `${tag}: tab order (${tabOrder})`);
    if (width < 1024) expect(await noOverflow(page), `${tag}: no sideways scroll`);

    // Properties: internal only.
    expect(await rowOf(page, 'Chris Wirth', width).count() === 1 && await rowOf(page, 'Downtown Lot', width).count() === 1, `${tag}: Properties lists the internal properties`);
    expect(await rowOf(page, 'Bob Bozic', width).count() === 0 && await rowOf(page, 'Bon Sun', width).count() === 0, `${tag}: Properties has no external accounts`);
    expect(await page.getByText('2 properties', { exact: true }).filter({ visible: true }).count() > 0, `${tag}: Properties count says 2 properties`);
    expect(await page.getByRole('button', { name: /Create( Property)?$/ }).filter({ visible: true }).count() > 0, `${tag}: Create Property on Properties`);
    await shot(page, `${tag}-C1-properties-tab`);

    // External: the external accounts, same actions, own count, no Create Property.
    await tabButton(page, 'External').click();
    await rowOf(page, 'Bob Bozic', width).waitFor({ state: 'visible', timeout: 5000 });
    expect(await rowOf(page, 'Chris Wirth', width).count() === 0, `${tag}: External has no internal property`);
    // Switching tabs re-reads the list (a "Loading properties..." moment): let it finish.
    await page.getByText('Loading properties...').first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await rowOf(page, 'Bon Sun', width).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    const bonRows = await rowOf(page, 'Bon Sun', width).count();
    if (bonRows !== 1) {
      await shot(page, `${tag}-debug-bon-row`);
      console.log('debug bon rows', bonRows, await page.locator('div.p-3').filter({ visible: true }).evaluateAll((els) => els.map((e) => e.textContent.trim().slice(0, 40))));
    }
    expect(bonRows === 1, `${tag}: External lists Bon Sun (deactivated) (${bonRows})`);
    expect(await page.getByText('3 external accounts', { exact: true }).filter({ visible: true }).count() > 0, `${tag}: External count says 3 external accounts`);
    expect(await page.getByRole('button', { name: /Create( Property)?$/ }).filter({ visible: true }).count() === 0, `${tag}: no Create Property on External`);
    const fetches = state.propertyFetches;
    const bobMenu = await menuItems(page, 'Bob Bozic', width);
    expect(['Edit Property', 'Manage Users', 'Leads Report', 'View Property', 'Deactivate', 'Delete Property'].every((t) => bobMenu.some((i) => i.startsWith(t))), `${tag}: Bob's row actions (${bobMenu})`);
    const bonMenu = await menuItems(page, 'Bon Sun', width);
    expect(bonMenu.some((i) => i.startsWith('Reactivate')) && bonMenu.some((i) => /View Property.*Deactivated/.test(i)), `${tag}: Bon's row: Reactivate, View says Deactivated (${bonMenu})`);
    const ritaOpen = await openMenu(page, 'Rita Rep', width);
    const ritaMenu = await ritaOpen.getByRole('menuitem').evaluateAll((els) => els.map((el) => el.textContent.trim()));
    expect(!ritaMenu.some((i) => i.startsWith('Edit Property')) && !ritaMenu.some((i) => i.startsWith('Deactivate')) && !ritaMenu.some((i) => i.startsWith('Delete')) && ritaMenu.some((i) => i.startsWith('View Property')),
      `${tag}: viewer row (can_manage false): no Edit Property, Deactivate or Delete (${ritaMenu})`);
    await shot(page, `${tag}-C2b-viewer-row-menu-no-edit`);
    await page.keyboard.press('Escape');
    await ritaOpen.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, `${tag}-C2-external-tab`);
    await (await openMenu(page, 'Bob Bozic', width)).getByRole('menuitem', { name: 'Deactivate' }).click();
    await page.waitForTimeout(800);
    expect(state.statusCalls.at(-1)?.id === 2 && state.statusCalls.at(-1)?.body?.active === false, `${tag}: Deactivate from External sends {active:false} for Bob`);
    expect(state.propertyFetches > fetches, `${tag}: list refreshed after Deactivate`);
    expect(await rowOf(page, 'Bob Bozic', width).count() === 1, `${tag}: Bob stays on External after Deactivate`);
    await (await openMenu(page, 'Bob Bozic', width)).getByRole('menuitem', { name: 'Delete Property' }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    expect(/closes their account/.test((await dialog.textContent()) || ''), `${tag}: External delete dialog is the existing one`);
    await page.waitForTimeout(300);
    await shot(page, `${tag}-C3-external-delete-dialog`);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });

    // Back to Properties: still internal only.
    await tabButton(page, 'Properties').click();
    await rowOf(page, 'Chris Wirth', width).waitFor({ state: 'visible', timeout: 5000 });
    expect(await rowOf(page, 'Bob Bozic', width).count() === 0, `${tag}: Properties again without external accounts`);
    await context.close();
  }

  // ---------- B4. Edit Property → Property Image ----------
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const { page, context, state } = await open({ width, height });
    await rowOf(page, 'Chris Wirth', width).waitFor({ state: 'visible', timeout: 25000 });
    await page.waitForTimeout(300);

    // A PDF is refused before anything is sent.
    await (await openMenu(page, 'Chris Wirth', width)).getByRole('menuitem', { name: 'Edit Property' }).click();
    const modal = page.locator('div.fixed.inset-0').filter({ hasText: 'Edit Property' }).last();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    expect(await modal.getByText('Click to upload property image').count() === 1, `${tag}: empty image box shown`);
    await shot(page, `${tag}-B4-1-edit-modal-empty`);
    await modal.locator('[data-testid=property-image-input]').setInputFiles(`${OUT}/fixture-notes.pdf`);
    const pdfToasts = await toastText(page);
    expect(pdfToasts.some((t) => t.includes('Please choose a PNG, JPG, GIF or WebP image.')), `${tag}: a PDF is refused (${pdfToasts})`);
    expect(await modal.getByText('Click to upload property image').count() === 1, `${tag}: still no preview after the PDF`);

    // A PNG: preview, then Update sends it.
    await modal.locator('[data-testid=property-image-input]').setInputFiles(images.store.path);
    await modal.locator('img[alt="Property preview"]').waitFor({ state: 'visible', timeout: 5000 });
    await shot(page, `${tag}-B4-2-edit-modal-preview`);
    await modal.getByRole('button', { name: 'Update Property' }).click();
    await page.waitForTimeout(1200);
    const up = state.updates.at(-1);
    console.log(tag, 'update sent', JSON.stringify(up));
    // Chromium hands interception the multipart parts but not a file's bytes, so the file is checked by name.
    expect(up?.id === 3403 && up.fields.image?.filename === 'fixture-store-front.png', `${tag}: POST /properties/3403/update carries the image file`);
    expect(up?.fields.location === undefined, `${tag}: an empty location is not sent as "No location" (${up?.fields.location})`);
    expect(up?.fields.remove_image === undefined, `${tag}: no remove_image with a new file`);
    expect(up?.auth === 'Bearer Main Dealer-token' && /application\/json/.test(up?.accept || ''), `${tag}: signed request asking for JSON`);
    const okToasts = await toastText(page);
    expect(okToasts.some((t) => t.includes('Property updated successfully')), `${tag}: success toast (${okToasts})`);
    expect(await modal.isVisible() === false, `${tag}: modal closed`);
    expect((await rowImage(page, 'Chris Wirth', width)) === STORE_URL, `${tag}: table avatar shows the new image straight away (the list was re-read, not cached)`);
    await shot(page, `${tag}-B4-3-row-avatar-after-upload`);

    // Remove a saved image: remove_image=1, no file; the row goes back to the icon.
    await (await openMenu(page, 'Downtown Lot', width)).getByRole('menuitem', { name: 'Edit Property' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    await modal.locator('img[alt="Property preview"]').waitFor({ state: 'visible', timeout: 5000 });
    await modal.locator('img[alt="Property preview"]').locator('xpath=..').locator('button').click();
    await modal.getByRole('button', { name: 'Update Property' }).click();
    await page.waitForTimeout(1000);
    const rm = state.updates.at(-1);
    expect(rm?.id === 12 && rm.fields.remove_image === '1' && !rm.fields.image, `${tag}: removing the saved image sends remove_image=1 (${JSON.stringify(rm?.fields)})`);
    expect(rm?.fields.location === 'Toronto, ON', `${tag}: a real location is kept`);
    expect((await rowImage(page, 'Downtown Lot', width)) === null, `${tag}: Downtown Lot back to the icon`);

    // External row (main account): the upload goes through too.
    await tabButton(page, 'External').click();
    await rowOf(page, 'Bob Bozic', width).waitFor({ state: 'visible', timeout: 5000 });
    await (await openMenu(page, 'Bob Bozic', width)).getByRole('menuitem', { name: 'Edit Property' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    await modal.locator('[data-testid=property-image-input]').setInputFiles(images.store.path);
    await modal.locator('img[alt="Property preview"]').waitFor({ state: 'visible', timeout: 5000 });
    await modal.getByRole('button', { name: 'Update Property' }).click();
    await page.waitForTimeout(1000);
    expect(state.updates.at(-1)?.id === 2 && state.updates.at(-1)?.fields.image, `${tag}: Bob's (external) image sent`);
    expect((await rowImage(page, 'Bob Bozic', width)) === STORE_URL, `${tag}: Bob's row shows the new image`);
    await shot(page, `${tag}-B4-4-external-row-avatar`);

    // The API's field message is shown when it refuses the file.
    await (await openMenu(page, 'Bon Sun', width)).getByRole('menuitem', { name: 'Edit Property' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    state.updateReply = { status: 422, json: { status: 'error', message: 'Validation failed', errors: { image: ['The image must not be greater than 10240 kilobytes.'] } } };
    await modal.locator('[data-testid=property-image-input]').setInputFiles(images.store.path);
    await modal.getByRole('button', { name: 'Update Property' }).click();
    await page.waitForTimeout(900);
    const badToasts = await toastText(page);
    expect(badToasts.some((t) => t.includes('The image must not be greater than 10240 kilobytes.')), `${tag}: API image message shown (${badToasts})`);
    await shot(page, `${tag}-B4-5-api-refusal-toast`);
    await context.close();
  }

  // ---------- B2. Property view: camera on the property avatar ----------
  const internalView = { ...rows()[1], image: null, invited_by: null };
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const { page, context, state } = await open({ width, height, path: '/', tab: null, scale: true, seed: { view_type: 'property', selected_property: internalView } });
    await page.getByText('Property', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await openProfileMenu(page, width);
    const camera = page.getByRole('button', { name: 'Change property image' }).filter({ visible: true }).first();
    await camera.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    expect(await camera.isVisible(), `${tag}: main account sees the camera on the property avatar`);
    await shot(page, `${tag}-B2-1-dropdown-camera`);
    await closeUpShot(page, `${tag}-B2-1b-dropdown-camera-closeup`);
    await page.locator('[data-testid=property-avatar-input]').first().setInputFiles(images.store.path);
    await page.waitForTimeout(1200);
    const up = state.updates.at(-1);
    console.log(tag, 'camera upload', JSON.stringify(up));
    expect(up?.id === 12 && up.fields.image?.filename === 'fixture-store-front.png' && Object.keys(up.fields).length === 1, `${tag}: camera sends only the image to /properties/12/update`);
    const toasts = await toastText(page);
    expect(toasts.some((t) => t.includes('Property image updated')), `${tag}: success toast (${toasts})`);
    const cardImg = await page.locator('[data-testid=property-avatar] img').filter({ visible: true }).first().getAttribute('src').catch(() => null);
    expect(cardImg === STORE_URL, `${tag}: dropdown card shows the new image (${cardImg})`);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('selected_property') || 'null'));
    expect(stored?.image === STORE_URL && stored?.name === 'Downtown Lot', `${tag}: stored property view keeps the new image`);
    await shot(page, `${tag}-B2-2-dropdown-after-upload`);
    await closeUpShot(page, `${tag}-B2-2b-dropdown-after-upload-closeup`);
    if (width >= 1024) {
      await page.keyboard.press('Escape');
      await page.mouse.click(600, 600);
      await page.waitForTimeout(4500); // the toast fades, so the header is visible in the screenshot
      const headerImg = await page.locator('[data-name="Profile-ddwn"] img').filter({ visible: true }).first().getAttribute('src').catch(() => null);
      expect(headerImg === STORE_URL, `${tag}: header avatar shows the new image (${headerImg})`);
      await shot(page, `${tag}-B2-3-header-after-upload`);
    }
    await context.close();
  }

  // A rep (can_manage false, not theirs): no camera.
  {
    const repRow = { ...rows()[2], user_role: 'rep', can_manage: false, is_creator: false };
    const { page, context } = await open({ width: 1280, height: 900, who: REX, path: '/', tab: null, seed: { view_type: 'property', selected_property: repRow } });
    await page.waitForTimeout(3000);
    await openProfileMenu(page, 1280);
    expect(await page.getByRole('button', { name: 'Change property image' }).filter({ visible: true }).count() === 0, 'rep: no camera on the property avatar');
    await shot(page, '1280-B2-4-rep-no-camera');
    await context.close();
  }

  // The property's own (linked) account in its own property view: camera shown; the inviter's logo until it has an
  // image of its own, then its own image wins.
  {
    const ownRow = { ...base, id: 77, name: 'Becks Bikes', unique_id: 'BK-77', username: 'becks', location: 'Ottawa, ON', image: null, user_id: 930, parent_user_id: 707, is_creator: true, user_role: 'owner', property_type: 'external', account_type: 'external', is_active: true, can_manage: false, account_created_for_property: false, invited_by: { external_user_id: 707, name: 'Main Dealer', profile_image: LOGO_URL } };
    const { page, context, state } = await open({ width: 1280, height: 900, who: BECKS, path: '/', tab: null, seed: { view_type: 'property', selected_property: ownRow } });
    state.rows.push(ownRow);
    await page.waitForTimeout(3000);
    const before = await page.locator('[data-name="Profile-ddwn"] img').filter({ visible: true }).first().getAttribute('src').catch(() => null);
    expect(before === LOGO_URL, `own account: header shows the inviter's logo before (${before})`);
    await openProfileMenu(page, 1280);
    const camera = page.getByRole('button', { name: 'Change property image' }).filter({ visible: true }).first();
    expect(await camera.isVisible().catch(() => false), 'own account: camera shown');
    await shot(page, '1280-B2-5-own-account-before');
    await page.locator('[data-testid=property-avatar-input]').first().setInputFiles(images.store.path);
    await page.waitForTimeout(1200);
    expect(state.updates.at(-1)?.id === 77, 'own account: upload sent for its own property');
    const cardImg = await page.locator('[data-testid=property-avatar] img').filter({ visible: true }).first().getAttribute('src').catch(() => null);
    expect(cardImg === STORE_URL, `own account: its own image now wins over the inviter's logo (${cardImg})`);
    await shot(page, '1280-B2-6-own-account-after');
    await context.close();
  }
  // ---------- $2 property checkout: the payment form is on top of the cart ----------
  // The cart modal stays open under the Stripe form (z-[60] vs the form's z-[70]); the form must be the top layer.
  const STRIPE_STUB = 'window.Stripe=function(){var el={mount:function(){},on:function(){},off:function(){},update:function(){},destroy:function(){},unmount:function(){},focus:function(){},blur:function(){},clear:function(){}};'
    + 'return{elements:function(){return{create:function(){return el},getElement:function(){return el},update:function(){},on:function(){}}},'
    + 'createToken:function(){return Promise.resolve({})},createPaymentMethod:function(){return Promise.resolve({})},confirmCardPayment:function(){return Promise.resolve({})},'
    + 'confirmPayment:function(){return Promise.resolve({})},confirmCardSetup:function(){return Promise.resolve({})},retrievePaymentIntent:function(){return Promise.resolve({})},'
    + 'registerAppInfo:function(){},_registerWrapper:function(){}}};';
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const { page, context, state } = await open({ width, height });
    state.purchases = [];
    await page.route('https://js.stripe.com/**', (route) => route.fulfill({ contentType: 'text/javascript', body: STRIPE_STUB }));
    await page.route('**/api/react/**', async (route) => {
      const url = new URL(route.request().url());
      const p = url.pathname.replace(/^\/api\/react/, '');
      if (p === '/billing/purchase-property' && route.request().method() === 'POST') {
        state.purchases.push(parseMultipart(route.request()));
        return route.fulfill({ json: { status: 'success', data: { client_secret: 'pi_test_secret_abc', payment_intent_id: 'pi_test' } } });
      }
      if (p.startsWith('/payment-methods') || p.startsWith('/stripe/payment-methods') || p.includes('payment-methods')) {
        return route.fulfill({ json: { success: true, data: { payment_methods: [] } } });
      }
      return route.fallback();
    });
    await page.reload();
    await rowOf(page, 'Chris Wirth', width).waitFor({ state: 'visible', timeout: 25000 });
    await page.getByRole('button', { name: /^(Create Property|Create)$/ }).filter({ visible: true }).first().click();
    const cart = page.locator('div.fixed.inset-0').filter({ hasText: 'Add properties to your cart' }).last();
    await cart.waitFor({ state: 'visible', timeout: 5000 });
    await cart.getByPlaceholder('e.g., Burnley Bloomfield Park Alliance Church').fill('Cart Lot');
    await cart.getByPlaceholder('e.g., Brentwood').fill('cartlot');
    await cart.getByRole('button', { name: 'Add to Cart' }).click();
    await cart.getByRole('button', { name: /Checkout/ }).click();
    const pay = page.getByRole('heading', { name: 'Payment Details' }).filter({ visible: true }).first();
    await pay.waitFor({ state: 'visible', timeout: 10000 }).catch(async (e) => { await shot(page, `${tag}-debug-checkout`); throw e; });
    await page.waitForTimeout(600);
    expect(state.purchases.length === 1 && state.purchases[0]['properties[0][name]'] === 'Cart Lot', `${tag}: checkout asked for the payment (${JSON.stringify(state.purchases)})`);
    // The top element at the payment heading, and at the bottom of the form's box, belongs to the payment form.
    const onTop = await page.evaluate(() => {
      const heading = [...document.querySelectorAll('h2')].find((h) => h.textContent?.trim() === 'Payment Details');
      if (!heading) return { heading: false };
      const modal = heading.closest('.rounded-2xl');
      const hb = heading.getBoundingClientRect();
      const mb = modal.getBoundingClientRect();
      const at = (x, y) => { const el = document.elementFromPoint(x, y); return !!el && modal.contains(el); };
      return { heading: at(hb.left + 10, hb.top + hb.height / 2), bottom: at(mb.left + mb.width / 2, Math.min(mb.bottom, window.innerHeight) - 8) };
    });
    expect(onTop.heading === true && onTop.bottom === true, `${tag}: the payment form is the top layer, cart and bottom nav below it (${JSON.stringify(onTop)})`);
    await shot(page, `${tag}-E1-checkout-payment-on-top`);
    // Closing the payment form leaves the cart as it was.
    await page.keyboard.press('Escape');
    await page.locator('div.fixed.inset-0.z-\\[70\\]').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.waitForTimeout(500);
    if (await pay.isVisible().catch(() => false)) failures.push(`${tag}: payment form did not close`);
    expect(await cart.getByText('1 property in cart').count() === 1, `${tag}: the cart is still there after closing the payment form`);
    await shot(page, `${tag}-E2-cart-after-closing-payment`);
    await context.close();
  }

  // ---------- Leads report from an External row goes back to External ----------
  {
    const { page, context } = await open({ width: 1280, height: 900 });
    await rowOf(page, 'Chris Wirth', 1280).waitFor({ state: 'visible', timeout: 25000 });
    await tabButton(page, 'External').click();
    await rowOf(page, 'Bob Bozic', 1280).waitFor({ state: 'visible', timeout: 5000 });
    // The report opens in a new tab: catch it.
    const popupPromise = context.waitForEvent('page', { timeout: 10000 });
    await (await openMenu(page, 'Bob Bozic', 1280)).getByRole('menuitem', { name: 'Leads Report' }).click();
    const report = await popupPromise;
    report.on('pageerror', (e) => pageErrors.push(e.message));
    await report.waitForURL(/\/leads-report/, { timeout: 15000 });
    expect(new URL(report.url()).searchParams.get('from') === 'external', `report opened with from=external (${report.url()})`);
    await report.getByRole('heading', { name: 'Leads Report' }).waitFor({ state: 'visible', timeout: 25000 });
    await report.locator('h1', { hasText: 'Leads Report' }).locator('xpath=../..').locator('button').first().click();
    await report.waitForTimeout(1500);
    const externalActive = await report.getByRole('button', { name: 'External', exact: true }).filter({ visible: true }).first()
      .evaluate((el) => el.className.includes('border-[#6C60FF]')).catch(() => false);
    expect(new URL(report.url()).pathname === '/users' && externalActive, `Back from the report lands on Users → External (${report.url()}, ${externalActive})`);
    await shot(report, '1280-E3-back-from-report-external');
    await context.close();
  }

  // ---------- Car cards in a salesperson's own account ----------
  // Bon Sun (salesperson of Serpa Chrysler) sees Serpa's car read-only: its card and its page name Serpa (the API's
  // owner block), not Bon; Bon's own car still shows Bon.
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const BON_ACCT = { id: 120, external_user_id: 966, name: 'Bon Sun', email: 'bon@dealer.test', role: '2', status: 1, profile_color: 'f97316' };
    const carBase = { make: 'Jeep', model: 'Wrangler', year: 2024, price: '58900', mileage: 12, category: 'preowned', images_count: 2, location: { formatted: 'Toronto, ON' }, listing_url: null };
    const serpaCar = { ...carBase, id: 501, title: 'Serpa Grand Cherokee', stock_number: 'J501', spec_summary: 'STK# J501 / 12 km', main_image: STORE_URL, user_id: 889, read_only: true, owner: { id: 889, name: 'Serpa Chrysler', profile_image: LOGO_URL, profile_color: '1d4ed8' } };
    const bonCar = { ...carBase, id: 601, title: 'Bon Own Ram', stock_number: 'R601', spec_summary: 'STK# R601 / 40 km', main_image: OLD_URL, user_id: 966, read_only: false };
    const { page, context } = await open({ width, height, who: BON_ACCT, path: '/memories', tab: null, scale: true, seed: { stasht_campaigns_view: 'storeels' } });
    await page.route('**/api/react/**', async (route) => {
      const url = new URL(route.request().url());
      const p = url.pathname.replace(/^\/api\/react/, '');
      if (p === '/cars') return route.fulfill({ json: { status: 1, data: { cars: [serpaCar, bonCar], pagination: { total: 2 }, filters: { makes: ['Jeep'], categories: ['preowned'] } } } });
      if (p === '/cars/501') return route.fulfill({ json: { status: 1, data: { ...serpaCar, images: [{ id: 1, url: STORE_URL, is_main: true, sort_order: 1 }, { id: 2, url: OLD_URL, is_main: false, sort_order: 2 }], description: 'Clean.' } } });
      if (p === '/memories' && route.request().method() === 'GET') return route.fulfill({ json: { success: true, data: { all_memories: { data: [] }, total_memories: 0 } } });
      return route.fallback();
    });
    await page.reload();
    // The card title is shortened on screen; its aria-label carries the full title.
    const card = (title) => page.locator(`.memory-card-container[aria-label="View ${title} campaign details"]`).filter({ visible: true }).first();
    await card('Serpa Grand Cherokee').waitFor({ state: 'visible', timeout: 30000 }).catch(async (e) => { await shot(page, `${tag}-debug-cars`); throw e; });
    await page.waitForTimeout(1200);
    const serpaText = (await card('Serpa Grand Cherokee').innerText()) || '';
    const bonText = (await card('Bon Own Ram').innerText()) || '';
    expect(serpaText.includes('Serpa Chrysler') && !serpaText.includes('Bon Sun'), `${tag}: Serpa's car card names Serpa Chrysler, not Bon Sun (${serpaText.replace(/\s+/g, ' ').slice(0, 160)})`);
    const avatarSrcs = await card('Serpa Grand Cherokee').locator('img').evaluateAll((els) => els.map((el) => el.getAttribute('src')));
    expect(avatarSrcs.includes(LOGO_URL), `${tag}: Serpa's avatar on the card (${avatarSrcs})`);
    expect(bonText.includes('Bon Sun'), `${tag}: Bon's own car still shows Bon Sun (${bonText.replace(/\s+/g, ' ').slice(0, 160)})`);
    await card('Serpa Grand Cherokee').scrollIntoViewIfNeeded();
    await shot(page, `${tag}-D1-car-cards-owner`);
    const box = await card('Serpa Grand Cherokee').boundingBox();
    if (box) await page.screenshot({ path: `${OUT}/${tag}-D1b-serpa-card-closeup.png`, clip: { x: box.x, y: box.y, width: Math.min(box.width, width - box.x), height: Math.min(box.height, height - box.y) } });

    // Its page: the posts' author is Serpa too.
    await card('Serpa Grand Cherokee').click();
    await page.waitForTimeout(4000);
    const authors = await page.getByText('Serpa Chrysler', { exact: true }).filter({ visible: true }).count();
    expect(authors > 0, `${tag}: Serpa's car page names Serpa Chrysler (${authors})`);
    const pageLogos = await page.locator(`img[src="${LOGO_URL}"]`).filter({ visible: true }).count();
    expect(pageLogos > 0, `${tag}: Serpa's photo on the car page (${pageLogos})`);
    await shot(page, `${tag}-D2-car-page-owner`);
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
  console.error(`FAIL property-image-and-external-tab\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('PASS property-image-and-external-tab');
