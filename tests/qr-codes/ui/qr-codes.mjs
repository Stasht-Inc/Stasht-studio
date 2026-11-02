// Dynamic QR Codes (3 Nov 2026): the Campaigns tab's "QR Codes" button (in place of AI Campaign Wizard, phones too)
// and its window: empty state, create (one pick; unpublished → Publish in place; view only allowed with a hint;
// private can't be used), the new code with Download PNG (2048 px) / SVG, the list (thumbnail, name, Opens:, scans),
// Change campaign, Rename, Delete with confirm, and property_id sent only in a property view.
// node tests/qr-codes/ui/qr-codes.mjs   (needs the dev server: QR_BASE, default http://localhost:5311)
// The /qr-codes API is mocked here to the web API's contract (3 Nov 2026); every non-local request is aborted.
// Screenshots: QR_SHOTS (default /private/tmp/claude-501/qr-shots).
import { mkdirSync, readFileSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.QR_BASE || 'http://localhost:5311';
const OUT = process.env.QR_SHOTS || '/private/tmp/claude-501/qr-shots';
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 70, external_user_id: 707, name: 'Main Dealer', email: 'main@dealer.test', role: '2', status: 1, is_activated: true };
const PROPERTY = { id: 12, name: 'Main Downtown', unique_id: 'MD-12', user_id: 707, is_creator: true, user_role: 'owner', property_type: 'internal', account_type: 'internal', account_created_for_property: false, can_manage: true, is_own_external_account: false, location: 'Toronto, ON', memories_count: 0, users_count: 1, invited_users: [], labels: [], created_at: '2026-10-01T10:00:00Z', is_active: true, status: 1 };

// state as the API names it; slug: whether it has a public link yet; canPublish: the owner may publish it.
const CAMPAIGNS = [
  { id: 801, title: 'Fall Promo', state: 'public', slug: 'fall-promo', canPublish: false },
  { id: 802, title: 'Open House', state: 'view_only', slug: 'open-house', canPublish: false },
  { id: 803, title: 'Spring Sale', state: 'unpublished', slug: null, canPublish: true },
  { id: 804, title: 'Private VIP Night', state: 'private', slug: 'vip', canPublish: false },
  { id: 805, title: 'Shared With Me Event', state: 'unpublished', slug: null, canPublish: false },
  { id: 806, title: 'Brand New Campaign', state: 'public', slug: null, canPublish: false },
];
const REASON = { view_only: "View only — visitors can't add moments", private: 'Private — change to Public to use', unpublished: 'Not published' };
const usable = (c) => (c.state === 'public' || c.state === 'view_only') && Boolean(c.slug);
const reasonFor = (c) => (c.state === 'public' && !c.slug ? 'No public link yet' : REASON[c.state] ?? null);

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

// fail: { list?: true, create?: true } answers those calls with the API's refusals.
async function open({ width, height, seed, codes = [], fail = {} }) {
  const state = { codes: codes.map((c) => ({ ...c })), nextId: 50, calls: [], campaigns: CAMPAIGNS.map((c) => ({ ...c })) };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024, acceptDownloads: true });
  await context.addInitScript(([seedData]) => {
    if (sessionStorage.getItem('qr-seeded')) return;
    sessionStorage.setItem('qr-seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(seedData)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, [seed]);
  // The code object: campaign null when none is set or it was deleted (memory_id may remain).
  const row = (c) => {
    const m = state.campaigns.find((x) => x.id === c.memory_id && !x.deleted);
    return {
      id: c.id, public_code: c.public_code, short_url: `https://studio.stasht.com/q/${c.public_code}`, name: c.name, property_id: c.property_id ?? null,
      memory_id: c.memory_id, campaign: m ? { id: m.id, title: m.title, state: m.state, usable: usable(m), public_url: m.slug ? `https://studio.stasht.com/published-memory/${m.slug}` : null } : null,
      scan_count: c.scan_count, last_scanned_at: c.last_scanned_at, created_at: '2026-11-03T10:00:00Z', updated_at: '2026-11-03T10:00:00Z',
    };
  };
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
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
    const method = req.method();
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    if (p.startsWith('/qr-codes') || /^\/memories\/\d+\/publish$/.test(p)) {
      state.calls.push({ method, p, q: url.searchParams.get('property_id'), body, view: req.headers()['x-stasht-property'] || null });
    }
    if (p === '/qr-codes' && method === 'GET') {
      if (fail.list) return route.fulfill({ status: 503, json: { success: false, code: 'qr_codes_unavailable', message: 'QR codes are not available yet.' } });
      return route.fulfill({ json: { success: true, data: state.codes.map(row) } });
    }
    if (p === '/qr-codes' && method === 'POST') {
      if (fail.create) return route.fulfill({ status: 422, json: { success: false, code: 'campaign_unpublished', message: 'This campaign is no longer published.' } });
      const m = state.campaigns.find((x) => x.id === body.memory_id);
      const c = { id: state.nextId++, public_code: `NEW${state.nextId}ABCD`.slice(0, 8), name: body.name || m?.title || null, memory_id: body.memory_id, property_id: body.property_id ?? null, scan_count: 0, last_scanned_at: null };
      state.codes.unshift(c);
      return route.fulfill({ status: 201, json: { success: true, data: row(c) } });
    }
    if (p === '/qr-codes/campaign-options' && method === 'GET') {
      const s = (url.searchParams.get('search') || '').toLowerCase();
      const list = state.campaigns.filter((c) => !c.deleted && c.title.toLowerCase().includes(s))
        .map((c) => ({ id: c.id, title: c.title, cover_url: null, state: c.state, usable: usable(c), can_publish: c.canPublish && !usable(c), reason: usable(c) && c.state === 'public' ? null : reasonFor(c) }));
      return route.fulfill({ json: { success: true, data: list, meta: { page: 1, per_page: 20, total: list.length, total_pages: 1 } } });
    }
    const one = p.match(/^\/qr-codes\/(\d+)$/);
    if (one) {
      const c = state.codes.find((x) => x.id === Number(one[1]));
      if (!c) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
      if (method === 'PATCH') {
        Object.assign(c, body);
        return route.fulfill({ json: { success: true, data: row(c) } });
      }
      if (method === 'DELETE') {
        state.codes = state.codes.filter((x) => x !== c);
        return route.fulfill({ json: { success: true, message: 'QR code deleted.' } });
      }
    }
    const pub = p.match(/^\/memories\/(\d+)\/publish$/);
    if (pub && method === 'POST') {
      const m = state.campaigns.find((x) => x.id === Number(pub[1]));
      if (m && body?.role === 1 && body?.publish_only === true) Object.assign(m, { state: 'public', slug: 'spring-sale' });
      return route.fulfill({ json: { success: true, data: { slug: 'spring-sale' } } });
    }
    if (p === '/properties' && method === 'GET') {
      return route.fulfill({ json: { success: true, data: { properties: [PROPERTY], owned_properties: [PROPERTY], shared_properties: [], owned_count: 1, shared_count: 0, total_count: 1 } } });
    }
    if (/^\/properties\/\d+\/memories$/.test(p)) {
      return route.fulfill({ json: { status: 'success', data: { property: PROPERTY, user_role: 'owner', viewing_invited_content: false, inviter: null, memories: { data: [], total: 0 }, sidebar: { categories: { items: [] }, labels: { items: [] } } } } });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/memories`);
  await page.getByText('All Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1200);
  return { context, page, state };
}

async function shot(page, file) {
  const path = `${OUT}/${file}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('shot', path);
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const dialog = (page) => page.getByRole('dialog').filter({ visible: true }).first();
const qrButton = (page) => page.getByRole('button', { name: 'QR Codes', exact: true }).filter({ visible: true }).first();
const pngSize = (file) => {
  const b = readFileSync(file);
  return { png: b.slice(1, 4).toString() === 'PNG', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const seed = { stasht_token: 'main-token', stasht_user: MAIN, view_type: 'personal', stasht_campaigns_view: 'storeels' };

    // 1. Account view: the button replaces AI Campaign Wizard; empty window.
    {
      const { page, context, state } = await open({ width, height, seed });
      expect(await qrButton(page).count() === 1, `${tag}: QR Codes button shows`);
      expect(await page.getByText('AI Campaign Wizard').count() === 0, `${tag}: no AI Campaign Wizard button`);
      expect(await noOverflow(page), `${tag}: Campaigns header has no sideways scroll`);
      await shot(page, `${tag}-01-campaigns-header`);
      await qrButton(page).click();
      await dialog(page).getByText('Print a QR code once and point it at any campaign — change it anytime.').waitFor({ timeout: 8000 });
      const list = state.calls.find((c) => c.method === 'GET' && c.p === '/qr-codes');
      expect(list && list.q === null && list.view === null, `${tag}: account view list sends no property_id (${JSON.stringify(list)})`);
      if (width < 640) {
        const box = await dialog(page).boundingBox();
        expect(box && box.x === 0 && box.y === 0 && Math.round(box.width) === width && Math.round(box.height) === height, `${tag}: full screen on phone (${JSON.stringify(box)})`);
      }
      await shot(page, `${tag}-02-empty`);

      // 2. Create: the picker.
      await dialog(page).getByRole('button', { name: 'Create QR Code' }).click();
      await dialog(page).getByText('Fall Promo').waitFor({ timeout: 8000 });
      expect(await dialog(page).getByText("View only — visitors can't add moments").count() === 1, `${tag}: view-only hint`);
      expect(await dialog(page).getByText('Private — change to Public to use').count() === 1, `${tag}: private hint`);
      expect(await dialog(page).getByRole('button', { name: /Private VIP Night/ }).count() === 0, `${tag}: private campaign is not pickable`);
      expect(await dialog(page).getByRole('button', { name: /Spring Sale/ }).count() === 0, `${tag}: unpublished campaign not pickable before Publish`);
      expect(await dialog(page).getByRole('button', { name: 'Publish', exact: true }).count() === 1, `${tag}: Publish only where can_publish (one of two unpublished)`);
      expect(await dialog(page).getByText('No public link yet').count() === 1 && await dialog(page).getByRole('button', { name: /Brand New Campaign/ }).count() === 0, `${tag}: public without a link: reason, not pickable`);
      expect(await noOverflow(page), `${tag}: picker no sideways scroll`);
      await shot(page, `${tag}-03-picker`);

      // Publish in place, then it can be picked.
      await dialog(page).getByRole('button', { name: 'Publish', exact: true }).click();
      await dialog(page).getByRole('button', { name: /Spring Sale/ }).waitFor({ timeout: 8000 });
      const pub = state.calls.find((c) => c.p === '/memories/803/publish');
      expect(pub && pub.body && pub.body.role === 1 && pub.body.publish_only === true, `${tag}: Publish publishes publicly, publish_only (${JSON.stringify(pub)})`);
      await shot(page, `${tag}-04-picker-after-publish`);

      // Pick Fall Promo → the new code with downloads.
      await dialog(page).getByRole('button', { name: /Fall Promo/ }).click();
      await dialog(page).getByRole('button', { name: 'Download PNG' }).waitFor({ timeout: 8000 });
      const create = state.calls.find((c) => c.method === 'POST' && c.p === '/qr-codes');
      expect(create && create.body.memory_id === 801 && create.body.name === 'Fall Promo' && create.body.property_id === undefined, `${tag}: create body (${JSON.stringify(create?.body)})`);
      await shot(page, `${tag}-05-created`);
      const [png] = await Promise.all([page.waitForEvent('download'), dialog(page).getByRole('button', { name: 'Download PNG' }).click()]);
      const pngPath = `${OUT}/${tag}-download.png`;
      await png.saveAs(pngPath);
      const dims = pngSize(pngPath);
      expect(png.suggestedFilename() === 'qr-fall-promo.png' && dims.png && dims.width === 2048 && dims.height === 2048, `${tag}: PNG is 2048 x 2048 (${png.suggestedFilename()} ${JSON.stringify(dims)})`);
      const [svg] = await Promise.all([page.waitForEvent('download'), dialog(page).getByRole('button', { name: 'Download SVG' }).click()]);
      const svgPath = `${OUT}/${tag}-download.svg`;
      await svg.saveAs(svgPath);
      const svgText = readFileSync(svgPath, 'utf8');
      expect(svg.suggestedFilename() === 'qr-fall-promo.svg' && /<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/.test(svgText) && /viewBox="0 0 \d+ \d+"/.test(svgText), `${tag}: SVG download is a standalone svg`);
      await dialog(page).getByRole('button', { name: 'Done' }).click();
      await dialog(page).locator('[data-qr-row]').first().waitFor({ timeout: 5000 });
      await context.close();
    }

    // 3. List with codes: rows, Change campaign, Rename, Delete.
    {
      const codes = [
        { id: 7, public_code: 'K7PQ2MZX', name: 'Front window sign', memory_id: 801, scan_count: 12, last_scanned_at: '2026-11-02T10:00:00Z' },
        { id: 8, public_code: 'R4TW9BNC', name: 'Trade show banner', memory_id: null, scan_count: 1, last_scanned_at: null },
        { id: 9, public_code: 'Z8DLM3QE', name: 'Old flyer', memory_id: 899, scan_count: 0, last_scanned_at: null },
      ];
      const { page, context, state } = await open({ width, height, seed, codes });
      await qrButton(page).click();
      await dialog(page).locator('[data-qr-row]').first().waitFor({ timeout: 8000 });
      expect(await dialog(page).getByText('Opens: Fall Promo').count() === 1 && await dialog(page).getByText('No campaign').count() === 2, `${tag}: Opens / No campaign (never set, and deleted campaign)`);
      expect(await dialog(page).getByText('12 scans').count() === 1 && await dialog(page).getByText('1 scan', { exact: true }).count() === 1, `${tag}: scan counts`);
      expect(await noOverflow(page), `${tag}: list no sideways scroll`);
      const overflow = await dialog(page).evaluate((el) => [...el.querySelectorAll('[data-qr-row]')].every((r) => r.scrollWidth <= r.clientWidth + 1));
      expect(overflow, `${tag}: rows fit their width`);
      await shot(page, `${tag}-06-list`);

      // Download menu.
      const row7 = dialog(page).locator('[data-qr-row="K7PQ2MZX"]');
      await row7.getByRole('button', { name: 'Download' }).click();
      await page.getByRole('menuitem', { name: 'PNG (print)' }).waitFor({ timeout: 5000 });
      await shot(page, `${tag}-07-download-menu`);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'SVG' }).click()]);
      expect(dl.suggestedFilename() === 'qr-front-window-sign.svg', `${tag}: row SVG download (${dl.suggestedFilename()})`);

      // Change campaign → Open House (view only).
      await row7.getByRole('button', { name: 'Change campaign' }).click();
      await dialog(page).getByRole('button', { name: /Open House/ }).waitFor({ timeout: 8000 });
      expect(await dialog(page).locator('[aria-current="true"]').count() === 1, `${tag}: the current campaign is marked`);
      await shot(page, `${tag}-08-change-campaign`);
      await dialog(page).getByRole('button', { name: /Open House/ }).click();
      await dialog(page).getByText('Opens: Open House').waitFor({ timeout: 8000 });
      const patch = state.calls.find((c) => c.method === 'PATCH' && c.p === '/qr-codes/7');
      expect(patch && patch.body.memory_id === 802, `${tag}: PATCH memory_id (${JSON.stringify(patch?.body)})`);
      await shot(page, `${tag}-09-after-change`);

      // Rename.
      await row7.getByRole('button', { name: /More actions/ }).click();
      await page.getByRole('menuitem', { name: 'Rename' }).click();
      const input = row7.getByLabel('Name');
      await input.waitFor({ timeout: 5000 });
      await input.fill('Lobby poster');
      await shot(page, `${tag}-10-rename`);
      await row7.getByRole('button', { name: 'Save' }).click();
      await dialog(page).getByText('Lobby poster', { exact: true }).waitFor({ timeout: 5000 });
      expect(state.calls.some((c) => c.method === 'PATCH' && c.body?.name === 'Lobby poster'), `${tag}: PATCH name`);

      // Delete with confirm.
      const row8 = dialog(page).locator('[data-qr-row="R4TW9BNC"]');
      await row8.getByRole('button', { name: /More actions/ }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('alertdialog').getByText("Printed copies will show a 'not linked' page.").waitFor({ timeout: 5000 });
      await shot(page, `${tag}-11-delete-confirm`);
      await page.getByRole('button', { name: 'Yes, delete it' }).click();
      await row8.waitFor({ state: 'detached', timeout: 5000 });
      expect(state.calls.some((c) => c.method === 'DELETE' && c.p === '/qr-codes/8'), `${tag}: DELETE sent`);
      await shot(page, `${tag}-12-after-delete`);
      await context.close();
    }

    // 4. Refusals show the server's message: list 503 in the window, create 422 as a toast.
    {
      const { page, context } = await open({ width, height, seed, fail: { list: true } });
      await qrButton(page).click();
      await dialog(page).getByText('QR codes are not available yet.').waitFor({ timeout: 8000 }).catch(() => failures.push(`${tag}: list 503 shows the server message`));
      await shot(page, `${tag}-14-list-unavailable`);
      await context.close();
    }
    {
      const { page, context } = await open({ width, height, seed, fail: { create: true } });
      await qrButton(page).click();
      await dialog(page).getByRole('button', { name: 'Create QR Code' }).click();
      await dialog(page).getByRole('button', { name: /Fall Promo/ }).click();
      await page.getByText('This campaign is no longer published.').first().waitFor({ timeout: 8000 }).catch(() => failures.push(`${tag}: create 422 shows the server message`));
      expect(await dialog(page).getByRole('button', { name: /Fall Promo/ }).isEnabled(), `${tag}: after a refused create the picker can be used again`);
      await shot(page, `${tag}-15-create-refused`);
      await context.close();
    }

    // 5. Property view: property_id on the list, the picker and create.
    {
      const pseed = { stasht_token: 'main-token', stasht_user: MAIN, view_type: 'property', selected_property: PROPERTY, stasht_campaigns_view: 'storeels' };
      const { page, context, state } = await open({ width, height, seed: pseed });
      expect(await qrButton(page).count() === 1, `${tag}: property view: QR Codes button shows for the owner`);
      await qrButton(page).click();
      await dialog(page).getByRole('button', { name: 'Create QR Code' }).click();
      await dialog(page).getByRole('button', { name: /Fall Promo/ }).click();
      await dialog(page).getByRole('button', { name: 'Download PNG' }).waitFor({ timeout: 8000 });
      const list = state.calls.find((c) => c.method === 'GET' && c.p === '/qr-codes');
      const opts = state.calls.find((c) => c.p === '/qr-codes/campaign-options');
      const create = state.calls.find((c) => c.method === 'POST' && c.p === '/qr-codes');
      expect(list?.q === '12' && opts?.q === '12' && create?.body.property_id === 12, `${tag}: property view sends property_id 12 (${JSON.stringify([list?.q, opts?.q, create?.body])})`);
      await shot(page, `${tag}-13-property-created`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant);
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall QR code checks passed');
process.exit(failures.length || relevant.length ? 1 : 0);
