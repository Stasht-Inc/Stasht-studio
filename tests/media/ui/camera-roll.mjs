// Chris 9 Nov 2026, points 1 + 3, in the real app (App → Media) at 1280 and 390:
// the Media page opens on a new "Camera Roll" tab (tabs Camera Roll | Media). "Choose from Camera Roll" opens the
// phone's photo picker (here: setInputFiles); the picks show as a grid, all selected; tapping toggles; a bar on top
// shows "N selected" (left) and Next (right), in the viewport, also after scrolling. Next opens Create campaign with
// the selected photos in Add a Moment (uploaded there, HEIC included). Closing Create → back on Media, Camera Roll,
// picks still there. A campaign made from them → the picks are cleared. The Media tab is the page as it was.
// node tests/media/ui/camera-roll.mjs   (needs the dev server: MEDIA_BASE, default http://localhost:5291)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
import { mkdirSync } from 'fs';
import { deflateSync, crc32 } from 'zlib';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.MEDIA_BASE || 'http://localhost:5291';
const OUT = process.env.MEDIA_SHOTS || '/private/tmp/claude-501/media-ui/camera-roll';
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 70, external_user_id: 707, name: 'Main Dealer', email: 'main@dealer.test', role: '2', status: 1, is_activated: true, profile_color: '#1D4ED8' };
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="${['#6C60FF', '#F59E0B', '#10B981'][n % 3]}"/></svg>`;

// A small solid-colour PNG, so each picked "photo" shows as a coloured square.
function png(r, g, b, w = 40, h = 40) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3).map((_, i) => [r, g, b][i % 3])]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const COLOURS = [[108, 96, 255], [245, 158, 11], [16, 185, 129], [239, 68, 68], [59, 130, 246], [236, 72, 153], [20, 184, 166], [132, 204, 22], [234, 179, 8], [99, 102, 241], [168, 85, 247], [14, 165, 233]];
const photo = (i, name = `IMG_${1000 + i}.png`) => ({ name, mimeType: 'image/png', buffer: png(...COLOURS[i % COLOURS.length]) });
const heic = { name: 'IMG_2001.HEIC', mimeType: 'image/heic', buffer: Buffer.from('not-really-heic') };
const video = { name: 'clip.mov', mimeType: 'video/quicktime', buffer: Buffer.from('mov') };

const MEDIA = [1, 2].map((n) => ({ media_id: 500 + n, media_url: `${BASE}/cr-img/${n}.svg`, memory_id: null, name: `Existing_${n}.jpg`, type: 'image', created_at: '2026-11-0' + n + ' 10:00:00', capture_date: '2026-11-0' + n, media_size: 1.2 }));

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }) {
  const state = { uploads: [], creates: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(() => {
    const geo = { getCurrentPosition: (_ok, err) => err && err({ code: 1, message: 'denied' }), watchPosition: () => 0, clearWatch: () => {} };
    try { Object.defineProperty(navigator, 'geolocation', { configurable: true, get: () => geo }); } catch { /* ignore */ }
  });
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('cr-seeded')) return;
    sessionStorage.setItem('cr-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'main-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels');
  }, [MAIN]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/cr-img/')) return route.fulfill({ contentType: 'image/svg+xml', body: svg(Number(url.pathname.match(/(\d+)/)?.[1] ?? 0)) });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const m = req.method();
    if (p === '/memory-images' && m === 'GET') return route.fulfill({ json: { success: true, all_media: MEDIA, categories_media: {}, unassigned_media: [] } });
    if (p === '/user/upload-image-with-metadata') {
      const n = state.uploads.length + 1;
      const name = (req.postDataBuffer()?.toString('latin1').match(/filename="([^"]+)"/) || [])[1] || `file${n}`;
      state.uploads.push(name);
      return route.fulfill({ json: { success: true, data: { fileUrl: `${BASE}/cr-img/${n}.svg`, capture_date: '2026-11-09', capture_location: '', originalSizeMB: 0.1 } } });
    }
    if (p === '/memories' && m === 'POST') {
      state.creates.push(req.postData() || '');
      return route.fulfill({ json: { success: true, status: 'success', data: { id: 950, memory: { id: 950, title: 'Camera Roll Campaign' } } } });
    }
    if (p === '/memories' && m === 'GET') {
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: [], total: 0 }, latest_memories: [], sidebar: { categories: { items: [{ id: 5, name: 'Personal', memory_count: 0 }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 5, name: 'Personal', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 0, memory_limit: 50 } } } });
    if (p === '/lead-groups') return route.fulfill({ json: { groups: [] } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(`${width}: ${e.message}`));
  await page.goto(`${BASE}/media`);
  return { context, page, state };
}

const inViewport = async (page, loc) => {
  const box = await loc.boundingBox().catch(() => null);
  const vp = page.viewportSize();
  return Boolean(box && box.y >= -1 && box.x >= -1 && box.y + Math.min(box.height, 40) <= vp.height && box.x + box.width <= vp.width + 1);
};
// Nothing covers it (e.g. the app's top bar): the element at its centre is it.
const onTop = (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return Boolean(hit && el.contains(hit)); }).catch(() => false);
const tab = (page, name) => page.getByTestId('media-tabs').getByRole('button', { name, exact: true });
const isTab = async (page, name) => (await tab(page, name).getAttribute('aria-current').catch(() => null)) === 'page';
const bar = (page) => page.getByTestId('camera-roll-bar');
const tiles = (page) => page.locator('[data-testid="camera-roll-bar"] ~ div button[aria-pressed]');
const nextBtn = (page) => bar(page).getByRole('button', { name: 'Next', exact: true });
const input = (page) => page.getByTestId('camera-roll-input');
const createFlow = (page) => page.locator('[role="dialog"][aria-labelledby="storeel-create-title"]');

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const { page, context, state } = await open({ width, height });
    await tab(page, 'Camera Roll').waitFor({ state: 'visible', timeout: 30000 }).catch(async (e) => { await page.screenshot({ path: `${OUT}/${tag}-00-boot-fail.png` }); console.log(pageErrors); throw e; });
    await page.waitForTimeout(1200);

    // ── Opens on Camera Roll, empty ──────────────────────────────────────────────────────────────────────────────
    expect(await isTab(page, 'Camera Roll'), `${tag}: Camera Roll tab selected by default`);
    expect(!(await isTab(page, 'Media')), `${tag}: Media tab not selected`);
    const choose = page.getByRole('button', { name: 'Choose from Camera Roll' });
    expect(await inViewport(page, choose), `${tag}: "Choose from Camera Roll" is in the viewport`);
    expect(await page.getByText('Nothing is uploaded until you create it.').isVisible(), `${tag}: helper line shown`);
    expect(!(await page.getByPlaceholder('Search media files, campaigns...').isVisible().catch(() => false)), `${tag}: Media controls hidden on Camera Roll`);
    expect((await input(page).getAttribute('accept')) === 'image/*' && (await input(page).getAttribute('multiple')) !== null && (await input(page).getAttribute('capture')) === null, `${tag}: picker = accept image/*, multiple, no capture`);
    await page.screenshot({ path: `${OUT}/${tag}-01-camera-roll-empty.png` });

    // The button opens the picker (a file chooser)
    const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null), choose.click()]);
    expect(Boolean(chooser) && chooser.isMultiple(), `${tag}: "Choose from Camera Roll" opens a multi-select file chooser`);

    // ── Media tab = the page as it was ───────────────────────────────────────────────────────────────────────────
    await tab(page, 'Media').click();
    await page.waitForTimeout(600);
    expect(await isTab(page, 'Media'), `${tag}: Media tab selects`);
    for (const [label, loc] of [
      ['Media heading', page.locator('h1', { hasText: /^Media$/ }).filter({ visible: true }).first()],
      ['Upload button', page.getByRole('button', { name: /^Upload( Files)?$/ }).filter({ visible: true }).first()],
      ['search box', page.getByPlaceholder('Search media files, campaigns...')],
      ['items count', page.getByText(/^\d+ items?$/).filter({ visible: true }).first()],
      ['a media card', page.getByText('Existing_1.jpg').filter({ visible: true }).first()],
    ]) expect(await loc.isVisible().catch(() => false), `${tag}: Media tab still has the ${label}`);
    if (width >= 1024) {
      expect(await page.getByRole('button', { name: /^Select All$/ }).filter({ visible: true }).count() > 0, `${tag}: Media tab Select All (desktop)`);
      expect(await page.getByRole('button', { name: /Sync/ }).filter({ visible: true }).count() > 0, `${tag}: Media tab Sync (desktop)`);
    }
    await page.screenshot({ path: `${OUT}/${tag}-02-media-tab-unchanged.png` });
    // Media checkbox selection → BatchActions still works
    await page.locator('.group .absolute.top-3.left-3').filter({ visible: true }).first().click();
    await page.waitForTimeout(400);
    expect(await page.getByText(/1 items? selected/).filter({ visible: true }).count() > 0, `${tag}: Media checkbox → BatchActions bar "1 item selected"`);
    await page.screenshot({ path: `${OUT}/${tag}-03-media-tab-batch-actions.png` });
    await tab(page, 'Camera Roll').click();
    await page.waitForTimeout(400);

    // ── Pick: the grid, all selected, the bar ─────────────────────────────────────────────────────────────────────
    await input(page).setInputFiles([photo(0), photo(1), photo(2), heic, video]);
    await page.waitForTimeout(600);
    expect(await tiles(page).count() === 4, `${tag}: 4 photos in the grid (video skipped) (${await tiles(page).count()})`);
    const pressed = await tiles(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-pressed')));
    expect(pressed.every((v) => v === 'true'), `${tag}: picked photos arrive selected (${pressed})`);
    expect((await bar(page).textContent()).includes('4 selected'), `${tag}: bar says "4 selected"`);
    expect(await inViewport(page, bar(page).getByText('4 selected')) && await inViewport(page, nextBtn(page)), `${tag}: counter + Next in the viewport`);
    expect(await onTop(nextBtn(page)), `${tag}: Next not covered`);
    const cBox = await bar(page).getByText('4 selected').boundingBox();
    const nBox = await nextBtn(page).boundingBox();
    const bBox = await bar(page).boundingBox();
    const mid = bBox ? bBox.x + bBox.width / 2 : width / 2;
    expect(cBox && nBox && cBox.x < mid && nBox.x > mid, `${tag}: counter left, Next right of the bar`);
    expect(await page.getByText(/1 file wasn’t added/).isVisible(), `${tag}: skipped-video message shown`);
    const msgBox = await page.getByText(/1 file wasn’t added/).boundingBox();
    const lastTile = await page.getByRole('button', { name: 'Add more' }).boundingBox();
    expect(msgBox && lastTile && msgBox.y > lastTile.y, `${tag}: the message is at the bottom of the card`);
    expect(await page.getByText('IMG_2001.HEIC').isVisible(), `${tag}: HEIC without a browser preview shows its name`);
    await page.screenshot({ path: `${OUT}/${tag}-04-picked-preselected.png` });

    // Tap toggles
    await tiles(page).nth(1).click();
    await page.waitForTimeout(200);
    expect((await tiles(page).nth(1).getAttribute('aria-pressed')) === 'false', `${tag}: tap deselects`);
    expect((await bar(page).textContent()).includes('3 selected'), `${tag}: bar says "3 selected"`);
    await page.screenshot({ path: `${OUT}/${tag}-05-one-deselected.png` });
    await tiles(page).nth(1).click();
    await tiles(page).nth(1).click();

    // Add more: appends, dedupes the same photo
    const [chooser2] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null), page.getByRole('button', { name: 'Add more' }).click()]);
    expect(Boolean(chooser2), `${tag}: "Add more" reopens the picker`);
    await input(page).setInputFiles([photo(0), ...Array.from({ length: 9 }, (_, i) => photo(i + 3))]);
    await page.waitForTimeout(600);
    expect(await tiles(page).count() === 13, `${tag}: Add more appended 9 new, the duplicate dropped (${await tiles(page).count()})`);
    expect((await bar(page).textContent()).includes('12 selected'), `${tag}: earlier deselection kept, new ones selected → 12 selected`);
    expect(!(await page.getByText(/wasn’t added/).isVisible().catch(() => false)), `${tag}: no skip message after a clean pick`);

    // Sticky: scroll down, the bar stays at the top under the app header
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(500);
    const scrolled = await page.evaluate(() => Math.max(window.scrollY, document.querySelector('main')?.scrollTop ?? 0, ...Array.from(document.querySelectorAll('*')).filter((e) => e.scrollTop > 0).map((e) => e.scrollTop)));
    expect(await inViewport(page, nextBtn(page)) && await onTop(nextBtn(page)), `${tag}: after scrolling (${scrolled}px) Next is still in view, not under the header`);
    await page.screenshot({ path: `${OUT}/${tag}-06-scrolled-bar-sticky.png` });
    await page.mouse.wheel(0, -2000);
    await page.waitForTimeout(300);

    // Clear → empty; pick again (4 selected of 4)
    await bar(page).getByRole('button', { name: 'Clear' }).click();
    await page.waitForTimeout(300);
    expect(await page.getByRole('button', { name: 'Choose from Camera Roll' }).isVisible(), `${tag}: Clear → back to the empty Camera Roll`);
    await input(page).setInputFiles([photo(0), photo(1), photo(2), heic]);
    await page.waitForTimeout(400);
    await tiles(page).nth(2).click(); // 3 selected: 0, 1, HEIC
    expect((await bar(page).textContent()).includes('3 selected'), `${tag}: 3 selected before Next`);

    // Deselect all → Next disabled, bar stays (no jump)
    // (checked on a copy of the state: toggling back after)
    for (const i of [0, 1, 3]) await tiles(page).nth(i).click();
    expect(await nextBtn(page).isDisabled(), `${tag}: 0 selected → Next disabled`);
    expect((await bar(page).textContent()).includes('Tap photos to select'), `${tag}: 0 selected → "Tap photos to select"`);
    await page.screenshot({ path: `${OUT}/${tag}-07-none-selected.png` });
    for (const i of [0, 1, 3]) await tiles(page).nth(i).click();

    // ── Next → Create campaign with the photos in Add a Moment ───────────────────────────────────────────────────
    await nextBtn(page).click();
    await createFlow(page).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await page.getByText('Add a Moment', { exact: true }).first().waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2500);
    expect(await createFlow(page).isVisible().catch(() => false), `${tag}: Next opens Create campaign (Storeel)`);
    expect(await page.locator('h2', { hasText: 'Add a Moment' }).filter({ visible: true }).count() > 0, `${tag}: with Add a Moment open`);
    expect(state.uploads.length === 3, `${tag}: Add a Moment uploads the 3 selected photos (${JSON.stringify(state.uploads)})`);
    expect(state.uploads.includes('IMG_2001.HEIC'), `${tag}: the HEIC is not dropped`);
    expect(!state.uploads.includes('IMG_1002.png'), `${tag}: the deselected photo is not sent`);
    const addAll = page.getByRole('button', { name: /Add all \(3\)/ }).filter({ visible: true }).first();
    expect(await addAll.isVisible().catch(() => false), `${tag}: Add a Moment offers "Add all (3)"`);
    await page.screenshot({ path: `${OUT}/${tag}-08-next-opens-create-add-a-moment.png` });

    // Add all → the moments in the Storeel's step 2
    await addAll.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${tag}-09-create-after-add-all.png`, fullPage: false });
    const flowText = (await createFlow(page).textContent()) ?? '';
    const momentsShown = (flowText.match(/IMG_1000|IMG_1001|IMG_2001/g) || []).length;
    console.log(`      (${tag}: moments card mentions picks ${momentsShown}×)`);

    // Close Create without making a campaign → back on Media, Camera Roll, picks still there
    await createFlow(page).getByRole('button', { name: 'Back' }).click();
    await page.waitForTimeout(800);
    const discard = page.getByRole('button', { name: /^(Discard|Leave|Yes|Close without saving|Discard changes)/ }).filter({ visible: true }).first();
    if (await discard.isVisible().catch(() => false)) { console.log(`      (${tag}: a discard confirm showed: ${await discard.textContent()})`); await discard.click(); await page.waitForTimeout(800); }
    await tab(page, 'Camera Roll').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    expect(!(await createFlow(page).isVisible().catch(() => false)), `${tag}: Create closed`);
    expect(new URL(page.url()).pathname.startsWith('/media'), `${tag}: back on /media (${page.url()})`);
    expect(await isTab(page, 'Camera Roll'), `${tag}: on the Camera Roll tab`);
    expect(await tiles(page).count() === 4 && (await bar(page).textContent()).includes('3 selected'), `${tag}: picks and selection still there (${await tiles(page).count()} tiles)`);
    await page.screenshot({ path: `${OUT}/${tag}-10-back-from-create-picks-kept.png` });

    // Next again → make the campaign (Save as Draft) → picks cleared
    state.uploads.length = 0;
    await nextBtn(page).click();
    await createFlow(page).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /Add all \(3\)/ }).filter({ visible: true }).first().click().catch(() => {});
    await page.waitForTimeout(1000);
    await createFlow(page).getByPlaceholder('Give your campaign a meaningful title').fill('Camera Roll Campaign').catch(() => {});
    const catSelect = createFlow(page).locator('select').filter({ hasText: 'Personal' }).first();
    if (await catSelect.count()) await catSelect.selectOption({ label: 'Personal' }).catch(() => {});
    const save = createFlow(page).getByRole('button', { name: /^Save as Draft$/ }).filter({ visible: true }).first();
    if (await save.isVisible().catch(() => false)) {
      await save.click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUT}/${tag}-11-saved-draft.png` });
      expect(state.creates.length === 1, `${tag}: Save as Draft → POST /memories (${state.creates.length})`);
      await createFlow(page).getByRole('button', { name: 'Back' }).click().catch(() => {});
      await page.waitForTimeout(1200);
      expect(!new URL(page.url()).pathname.startsWith('/media'), `${tag}: after a campaign is made, closing stays on Campaigns (${page.url()})`);
      // In-app back to Media (a reload would forget the picks anyway): Camera Roll is empty again.
      await page.getByRole('button', { name: /^Media( \d+)?$/ }).filter({ visible: true }).first().click();
      await tab(page, 'Camera Roll').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(600);
      expect(await isTab(page, 'Camera Roll') && await page.getByRole('button', { name: 'Choose from Camera Roll' }).isVisible().catch(() => false), `${tag}: campaign made → the picks are cleared (Camera Roll empty)`);
    } else {
      expect(false, `${tag}: Save as Draft button found`);
    }
    await page.screenshot({ path: `${OUT}/${tag}-12-after-create.png` });
    await context.close();
  }
} finally {
  await browser.close();
}

if (pageErrors.length) console.log('page errors:', pageErrors);
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
