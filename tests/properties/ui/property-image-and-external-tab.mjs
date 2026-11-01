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
    if (location.pathname === '/users' && openTab) sessionStorage.setItem('users_open_tab', openTab);
    if (sessionStorage.getItem('pi-seeded')) return;
    sessionStorage.setItem('pi-seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(seedData)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
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
  await rowOf(page, name, width).locator('button').last().click();
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
    expect(await rowOf(page, 'Bon Sun', width).count() === 1, `${tag}: External lists Bon Sun (deactivated)`);
    expect(await page.getByText('2 external accounts', { exact: true }).filter({ visible: true }).count() > 0, `${tag}: External count says 2 external accounts`);
    expect(await page.getByRole('button', { name: /Create( Property)?$/ }).filter({ visible: true }).count() === 0, `${tag}: no Create Property on External`);
    const fetches = state.propertyFetches;
    const bobMenu = await menuItems(page, 'Bob Bozic', width);
    expect(['Edit Property', 'Manage Users', 'Leads Report', 'View Property', 'Deactivate', 'Delete Property'].every((t) => bobMenu.some((i) => i.startsWith(t))), `${tag}: Bob's row actions (${bobMenu})`);
    const bonMenu = await menuItems(page, 'Bon Sun', width);
    expect(bonMenu.some((i) => i.startsWith('Reactivate')) && bonMenu.some((i) => /View Property.*Deactivated/.test(i)), `${tag}: Bon's row: Reactivate, View says Deactivated (${bonMenu})`);
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
