// "A new version of Stasht Studio is available." — Refresh (components/AppUpdatePrompt.tsx), against real builds.
//
// Build twice, at least a minute apart (the profile menu's stamp has minute precision), then run:
//   node --max-old-space-size=8192 node_modules/vite/bin/vite.js build --outDir <A>
//   node --max-old-space-size=8192 node_modules/vite/bin/vite.js build --outDir <B>
//   UP_DIST_A=<A> UP_DIST_B=<B> node tests/update-prompt/ui/update-prompt.mjs
// A small static server here plays the deploy (like nginx: files, else index.html); "deploying" B swaps its root.
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: UP_SHOTS (default /private/tmp/claude-501/update-prompt-ui/shots).
import { mkdirSync, readFileSync, existsSync, statSync } from 'fs';
import { createServer } from 'http';
import { join, extname, normalize } from 'path';

// Route the service worker's own requests too (Chromium), so its fetches are visible to context.route.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
const { default: pw } = await import('/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js');
const { chromium } = pw;

const DIST_A = process.env.UP_DIST_A;
const DIST_B = process.env.UP_DIST_B;
if (!DIST_A || !DIST_B) { console.error('UP_DIST_A and UP_DIST_B are required'); process.exit(2); }
const OUT = process.env.UP_SHOTS || '/private/tmp/claude-501/update-prompt-ui/shots';
const PORT = Number(process.env.UP_PORT || 5311);
const BASE = `http://127.0.0.1:${PORT}`;
mkdirSync(OUT, { recursive: true });

const buildOf = (dist) => JSON.parse(readFileSync(join(dist, 'version.json'), 'utf8')).buildTime;
const stampOf = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `Build ${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
};
const BUILD_A = buildOf(DIST_A);
const BUILD_B = buildOf(DIST_B);
console.log('A', BUILD_A, stampOf(BUILD_A));
console.log('B', BUILD_B, stampOf(BUILD_B));
if (stampOf(BUILD_A) === stampOf(BUILD_B)) { console.error('A and B show the same stamp: build B at least a minute after A'); process.exit(2); }

// ---- the "server" -------------------------------------------------------------------------------------------
let root = DIST_A;           // what is deployed
let versionRoot = null;      // when set, version.json comes from here (a deploy whose other files are stuck/cached)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = createServer((req, res) => {
  const url = new URL(req.url, BASE);
  let path = decodeURIComponent(url.pathname);
  const dir = path === '/version.json' && versionRoot ? versionRoot : root;
  let file = normalize(join(dir, path));
  if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) {
    if (extname(path) && path !== '/') { res.writeHead(404); return res.end('not found'); }
    file = join(dir, 'index.html');
    path = '/index.html';
  }
  const hashed = path.startsWith('/assets/');
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
    'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

// ---- the signed-in app ----------------------------------------------------------------------------------------
const USER = { id: 708, external_user_id: 959, name: 'TheRoyalWoodShop', email: 'owner@royalwood.test', role: '2', status: 1, is_activated: true, plan_id: 3 };
const card = (count) => ({ count, formatted: String(count), period_count: 0, previous_period_count: 0, period_label: 'This Week', percentage: { value: 0, text: 'No previous data', trend: 'neutral' } });
const DASHBOARD = {
  statistics: { total_memories: card(3), total_media: card(12), total_users: card(0), storage: { used: 0, formatted: '0 MB', period_used: 0, period_formatted: '0 MB', limit: 536870912000, limit_formatted: '500 GB', percentage_used: 0, available: 536870912000, available_formatted: '500 GB', period_label: 'This Week' } },
  latest_memories: [],
  date_range: { start_date: '2026-10-26', end_date: '2026-11-01', type: 'weekly' },
};

const failures = [];
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function newContext({ serviceWorkers = 'allow', width = 1280, height = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers, locale: 'en-US', timezoneId: 'America/Toronto', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user]) => {
    if (localStorage.getItem('stasht_token')) return;
    localStorage.setItem('stasht_token', 'royalwood-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
  }, [USER]);
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
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (p === '/properties' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { properties: [], owned_properties: [], shared_properties: [], owned_count: 0, shared_count: 0, total_count: 0, account_trial: null } } });
    if (p === '/dashboard') return route.fulfill({ json: { success: true, data: DASHBOARD } });
    if (p === '/user/memory-counts') return route.fulfill({ json: { success: true, data: { memory_counts: { total_memories: 0, total_memory_images: 0, published_memories: 0, active_collaborators: 0 } } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Business' } } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  return context;
}

async function openPage(context, path = '/dashboard') {
  const page = await context.newPage();
  page.loads = 0;
  page.on('load', () => { page.loads += 1; });
  page.on('pageerror', (e) => { pageErrors.push(e.message); if (process.env.UP_DEBUG) console.log('pageerror', e.stack); });
  await page.goto(`${BASE}${path}`);
  await waitForApp(page);
  return page;
}

async function waitForApp(page) {
  // Desktop: the header's profile menu; phone: the bottom nav.
  await page.locator('[data-name="Profile-ddwn"], nav.fixed.bottom-0').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 40000 });
}

/** The bundle the page is running: its entry script, compared with each build's index.html. */
const entryOf = (dist) => readFileSync(join(dist, 'index.html'), 'utf8').match(/src="(\/assets\/index-[^"]+\.js)"/)[1];
const ENTRY_A = entryOf(DIST_A);
const ENTRY_B = entryOf(DIST_B);
async function runningEntry(page) {
  return page.evaluate(() => {
    const el = document.querySelector('script[type="module"][src*="/assets/index-"]');
    return el ? new URL(el.src).pathname : null;
  });
}

/** The "Build … UTC" line in the profile menu. */
async function profileStamp(page) {
  await page.locator('[data-name="Profile-ddwn"] [data-name="Dropdown"]').filter({ visible: true }).first().click();
  const line = page.getByText(/^Build .* UTC$/).first();
  await line.waitFor({ state: 'visible', timeout: 10000 });
  const text = (await line.innerText()).trim();
  await page.keyboard.press('Escape');
  if (await line.isVisible()) await page.mouse.click(Math.round(page.viewportSize().width / 2), page.viewportSize().height - 40);
  await line.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  return text;
}

const banner = (page) => page.locator('[data-sonner-toast]').filter({ hasText: 'A new version of Stasht Studio is available.' });
const bannerVisible = async (page) => (await banner(page).count()) > 0 && banner(page).first().isVisible();
async function waitForBanner(page, timeout = 20000) {
  try { await banner(page).first().waitFor({ state: 'visible', timeout }); return true; } catch { return false; }
}
async function controlled(page) {
  await page.waitForFunction(() => !!navigator.serviceWorker && !!navigator.serviceWorker.controller, null, { timeout: 30000 });
}
async function workerUpdate(page) {
  await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration('/'); await r?.update(); });
}
async function shot(page, file) {
  await page.waitForTimeout(800); // toast slide-in
  const path = `${OUT}/${file}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('shot', path);
}
const pathOf = (page) => new URL(page.url()).pathname;

try {
  // 1. Service worker path, desktop: a new deploy is picked up by the worker; the banner offers it; Refresh lands
  //    on the new build on the same page, once.
  {
    root = DIST_A; versionRoot = null;
    const context = await newContext();
    const page = await openPage(context, '/memories');
    await controlled(page);
    const startPath = pathOf(page);
    expect((await profileStamp(page)) === stampOf(BUILD_A), `1: page runs A (${stampOf(BUILD_A)})`);
    await page.waitForTimeout(4500); // start-up check (3 s) sees the same build
    expect(!(await bannerVisible(page)), '1: no banner while A is the deployed build');
    root = DIST_B; // deploy B
    await workerUpdate(page);
    expect(await waitForBanner(page), '1: banner appears after the worker picks up B');
    await shot(page, '01-banner-desktop');
    const toast = banner(page).first();
    expect(await toast.getByRole('button', { name: 'Refresh', exact: true }).isVisible(), '1: banner has a Refresh button');
    expect((await toast.locator('[data-close-button]').count()) === 1, '1: banner has a close (dismiss) button');
    const loadsBefore = page.loads;
    await toast.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.waitForEvent('load', { timeout: 30000 });
    await waitForApp(page);
    expect((await profileStamp(page)) === stampOf(BUILD_B), `1: after Refresh the page runs B (${stampOf(BUILD_B)})`);
    expect((await runningEntry(page)) === ENTRY_B, '1: and loads B\'s bundle');
    expect(pathOf(page) === startPath, `1: same page after Refresh (${startPath} → ${pathOf(page)})`);
    await page.waitForTimeout(8000);
    expect(page.loads - loadsBefore === 1, `1: exactly one reload (got ${page.loads - loadsBefore})`);
    expect(!(await bannerVisible(page)), '1: no banner on the new build');
    await shot(page, '02-after-refresh-desktop');
    await context.close();
  }

  // 2. version.json path only (no service worker at all), phone: the 5-minute check finds B; Refresh loads it.
  {
    root = DIST_A; versionRoot = null;
    const context = await newContext({ serviceWorkers: 'block', width: 390, height: 844 });
    const page = await context.newPage();
    page.loads = 0;
    page.on('load', () => { page.loads += 1; });
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.clock.install();
    await page.goto(`${BASE}/dashboard`);
    await waitForApp(page);
    await page.waitForTimeout(4500);
    expect(!(await bannerVisible(page)), '2: no banner before the deploy');
    expect((await runningEntry(page)) === ENTRY_A, '2: phone runs A');
    root = DIST_B;
    await page.waitForTimeout(500);
    expect(!(await bannerVisible(page)), '2: nothing until the next check');
    await page.clock.fastForward('05:01');
    expect(await waitForBanner(page), '2: the 5-minute check shows the banner (version.json is newer)');
    await shot(page, '03-banner-phone');
    const loadsBefore = page.loads;
    await banner(page).first().getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.waitForEvent('load', { timeout: 30000 });
    await waitForApp(page);
    expect((await runningEntry(page)) === ENTRY_B, `2: after Refresh the phone runs B (${await runningEntry(page)})`);
    await page.waitForTimeout(6000);
    expect(page.loads - loadsBefore === 1, `2: exactly one reload (got ${page.loads - loadsBefore})`);
    expect(!(await bannerVisible(page)), '2: no banner on the new build');
    await context.close();
  }

  // 3. Dismiss: the banner goes, and later checks for the same build do not bring it back.
  {
    root = DIST_A; versionRoot = null;
    const context = await newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    page.loads = 0;
    page.on('load', () => { page.loads += 1; });
    await page.clock.install();
    await page.goto(`${BASE}/dashboard`);
    await waitForApp(page);
    root = DIST_B;
    await page.clock.fastForward('05:01');
    expect(await waitForBanner(page), '3: banner shows');
    await banner(page).first().locator('[data-close-button]').click();
    await page.waitForTimeout(1000);
    expect(!(await bannerVisible(page)), '3: close dismisses it');
    await page.clock.fastForward('05:01');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(3000);
    expect(!(await bannerVisible(page)), '3: not shown again for the same build');
    expect(page.loads === 1, `3: dismissing never reloads (loads ${page.loads})`);
    await shot(page, '04-dismissed');
    await context.close();
  }

  // 4. Two windows: one Refreshes (its worker takes over every window); the other is now an old page under a new
  //    worker — it shows the banner too, and its Refresh lands on B without touching the first.
  {
    root = DIST_A; versionRoot = null;
    const context = await newContext();
    const first = await openPage(context, '/dashboard');
    await controlled(first);
    const second = await openPage(context, '/memories');
    await controlled(second);
    await second.waitForTimeout(4000);
    const secondPath = pathOf(second);
    root = DIST_B;
    await workerUpdate(first);
    expect(await waitForBanner(first), '4: first window shows the banner');
    await second.evaluate(() => window.dispatchEvent(new Event('focus')));
    expect(await waitForBanner(second), '4: second window shows the banner too');
    const firstLoads = first.loads;
    await banner(first).first().getByRole('button', { name: 'Refresh', exact: true }).click();
    await first.waitForEvent('load', { timeout: 30000 });
    await waitForApp(first);
    expect((await profileStamp(first)) === stampOf(BUILD_B), '4: first window runs B');
    await second.waitForTimeout(3000);
    expect(second.loads === 1, `4: the other window was not reloaded behind the user's back (loads ${second.loads})`);
    expect(await bannerVisible(second), '4: the other window still offers the update');
    await banner(second).first().getByRole('button', { name: 'Refresh', exact: true }).click();
    await second.waitForEvent('load', { timeout: 30000 });
    await waitForApp(second);
    expect((await profileStamp(second)) === stampOf(BUILD_B), '4: second window runs B after its own Refresh');
    expect(pathOf(second) === secondPath, `4: second window stayed on its page (${secondPath} → ${pathOf(second)})`);
    await first.waitForTimeout(3000);
    expect(first.loads - firstLoads === 1, `4: first window reloaded once (${first.loads - firstLoads})`);
    await context.close();
  }

  // 5. A stuck deploy (version.json says B, but index.html / sw.js are still A — a cache in front of the site):
  //    Refresh reloads, a second Refresh resets the worker and reloads, then the banner stays away. No loop.
  {
    root = DIST_A; versionRoot = DIST_B;
    const context = await newContext();
    const page = await openPage(context, '/dashboard');
    expect(await waitForBanner(page), '5: start-up check shows the banner (version.json newer)');
    const loadsBefore = page.loads;
    await banner(page).first().getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.waitForEvent('load', { timeout: 30000 });
    await waitForApp(page);
    expect((await profileStamp(page)) === stampOf(BUILD_A) && (await runningEntry(page)) === ENTRY_A, '5: still A after the first Refresh (stuck deploy)');
    expect(await waitForBanner(page), '5: banner offered again once');
    await banner(page).first().getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.waitForEvent('load', { timeout: 30000 });
    await waitForApp(page);
    await page.waitForTimeout(9000);
    expect(!(await bannerVisible(page)), '5: after the worker reset the banner stays away (no loop)');
    expect(page.loads - loadsBefore === 2, `5: exactly two reloads, both clicked (got ${page.loads - loadsBefore})`);
    const roots = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope));
    expect(roots.length === 1, `5: the app's worker is registered again after the reset (${roots.join(', ')})`);
    await shot(page, '05-stuck-deploy-no-loop');
    await context.close();
  }

  // 7. Refresh while a page holds unsaved work: its beforeunload prompt is answered "Stay". The page keeps running,
  //    so the banner comes back (not stuck on "Updating…"), the cancelled click is not counted as an attempt, and
  //    the header's refresh button stops spinning. Without the prompt, Refresh then lands on B with one reload.
  {
    root = DIST_A; versionRoot = null;
    const context = await newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    page.loads = 0;
    page.on('load', () => { page.loads += 1; });
    page.on('pageerror', (e) => pageErrors.push(e.message));
    let prompts = 0;
    page.on('dialog', (dialog) => { if (dialog.type() === 'beforeunload') prompts += 1; dialog.dismiss(); });
    await page.clock.install();
    await page.goto(`${BASE}/dashboard`);
    await waitForApp(page);
    root = DIST_B;
    await page.clock.fastForward('05:01');
    expect(await waitForBanner(page), '7: banner shows');
    await page.evaluate(() => {
      window.__unsaved = (e) => { e.preventDefault(); e.returnValue = ''; };
      window.addEventListener('beforeunload', window.__unsaved);
    });
    await banner(page).first().getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.waitForTimeout(1500);
    expect(prompts === 1, `7: the page asked about unsaved changes (${prompts})`);
    await page.waitForTimeout(5000);
    expect(await bannerVisible(page) && await banner(page).first().getByRole('button', { name: 'Refresh', exact: true }).isVisible(), '7: after "Stay" the banner is back with Refresh');
    expect((await page.getByText('Updating Stasht Studio…').count()) === 0, '7: no stuck "Updating…" toast');
    expect(page.loads === 1, `7: no reload happened (loads ${page.loads})`);
    expect((await page.evaluate(() => sessionStorage.getItem('stasht_update_refresh_attempt'))) === null, '7: the cancelled click is not counted as an attempt');
    await shot(page, '07-cancelled-reload-banner-back');
    const headerRefresh = page.getByRole('button', { name: 'Refresh to get the latest version' }).filter({ visible: true }).first();
    await headerRefresh.click();
    await page.waitForTimeout(1500);
    expect(prompts === 2, `7: header refresh also asked (${prompts})`);
    await page.waitForTimeout(5000);
    expect(await headerRefresh.isEnabled(), '7: header refresh button is usable again (spinner stopped)');
    expect(page.loads === 1, `7: still no reload (loads ${page.loads})`);
    await page.evaluate(() => window.removeEventListener('beforeunload', window.__unsaved));
    await banner(page).first().getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.waitForEvent('load', { timeout: 30000 });
    await waitForApp(page);
    expect((await runningEntry(page)) === ENTRY_B, '7: Refresh without the prompt lands on B');
    await page.waitForTimeout(6000);
    expect(page.loads === 2, `7: exactly one reload (loads ${page.loads})`);
    expect(!(await bannerVisible(page)), '7: no banner on B');
    await context.close();
  }

  // 6. Where the banner sits: bottom-right on desktop, clear of the header search; on phones / narrow windows
  //    bottom-center, above the bottom nav and its "+" button. (version.json newer → start-up check shows it.)
  const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  for (const [width, height] of [[1280, 900], [1440, 900], [700, 900], [390, 844]]) {
    root = DIST_A; versionRoot = DIST_B;
    const context = await newContext({ serviceWorkers: 'block', width, height });
    const page = await openPage(context, '/dashboard');
    expect(await waitForBanner(page), `6 @${width}: banner shows`);
    await page.waitForTimeout(800);
    const box = await banner(page).first().boundingBox();
    if (width >= 768) {
      const search = await page.locator('input[placeholder^="Search"]').filter({ visible: true }).first().boundingBox();
      expect(!!search && !overlaps(box, search), `6 @${width}: does not cover the header search`);
      expect(width - (box.x + box.width) <= 40 && height - (box.y + box.height) <= 40, `6 @${width}: bottom-right (right gap ${Math.round(width - box.x - box.width)}, bottom gap ${Math.round(height - box.y - box.height)})`);
    } else {
      const nav = await page.locator('nav.fixed.bottom-0').filter({ visible: true }).first().boundingBox();
      const plus = await page.locator('nav.fixed.bottom-0 button.rounded-full').filter({ visible: true }).first().boundingBox();
      const clearTop = Math.min(nav.y, plus ? plus.y : nav.y);
      expect(box.y + box.height <= clearTop, `6 @${width}: above the bottom nav and its + button (banner bottom ${Math.round(box.y + box.height)}, nav/+ top ${Math.round(clearTop)})`);
      expect(Math.abs(box.x + box.width / 2 - width / 2) <= 4, `6 @${width}: centered`);
    }
    await shot(page, `06-position-${width}`);
    await context.close();
  }
} catch (e) {
  failures.push(`crashed: ${e.message}`);
  console.log(e);
} finally {
  await browser.close();
  server.close();
}

console.log('blocked external hosts:', [...blocked].join(', ') || 'none');
if (pageErrors.length) console.log('page errors:', [...new Set(pageErrors)].slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
