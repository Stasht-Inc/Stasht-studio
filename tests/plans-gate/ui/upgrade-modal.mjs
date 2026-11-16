// Chris, 16 Nov (C11): "Upgrade Your Plan" — the buttons (Current plan / Upgrade… / Cancel) stay in view at the
// bottom of the modal on desktop and phones, and the Order Summary is gone (it is on the checkout page).
// node tests/plans-gate/ui/upgrade-modal.mjs   (dev server: UM_BASE, default http://localhost:5402)
// Every API call is answered here; every non-local request is aborted. Screenshots: UM_SHOTS.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.UM_BASE || 'http://localhost:5402';
const OUT = process.env.UM_SHOTS || '/private/tmp/claude-501/upgrade-modal-shots';
mkdirSync(OUT, { recursive: true });
const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height, query = '' }) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(() => {
    localStorage.setItem('stasht_token', 'um-token');
    localStorage.setItem('stasht_user', JSON.stringify({ id: 1, external_user_id: 2, name: 'Samantha Smith', email: 's@example.test', role: '2' }));
  });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort('blockedbyclient');
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 200, json: { success: false } });
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/tests/plans-gate/ui/upgrade-modal.html${query}`);
  await page.getByRole('dialog', { name: 'Upgrade Your Plan' }).waitFor();
  await page.waitForTimeout(300);
  return { context, page };
}

const inView = async (page, locator) => {
  const box = await locator.boundingBox();
  const vh = page.viewportSize().height;
  return Boolean(box) && box.y >= 0 && box.y + box.height <= vh + 0.5;
};

for (const [width, height] of [[1280, 800], [1280, 720], [390, 844]]) {
  const tag = `${width}x${height}`;
  // Starter account: Teams preselected (utils/planPicker) → "Upgrade to Teams"; Cancel next to it.
  let { context, page } = await open({ width, height, query: '?plan=Starter' });
  const dialog = page.getByRole('dialog', { name: 'Upgrade Your Plan' });
  expect(await dialog.getByText('Order Summary').count() === 0, `${tag}: no Order Summary`);
  const upgrade = dialog.getByRole('button', { name: /^Upgrade to Teams/ });
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
  expect(await inView(page, upgrade), `${tag}: Upgrade button in view without scrolling`);
  expect(await inView(page, cancel), `${tag}: Cancel in view without scrolling`);
  await page.screenshot({ path: `${OUT}/${tag}-01-starter-top.png` });
  // Scroll the modal to the bottom: the buttons stay where they are, the footer text is reachable.
  await dialog.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(200);
  expect(await inView(page, upgrade), `${tag}: Upgrade still in view at the bottom`);
  await expectVisibleSafe(dialog.getByText('Enterprise Accounts Available'), `${tag}: Enterprise note reachable`);
  await page.screenshot({ path: `${OUT}/${tag}-02-starter-bottom.png` });
  // Pick Business: the label follows; the own plan (Starter) says Current plan.
  await dialog.getByRole('heading', { name: 'Business' }).click();
  expect(await dialog.getByRole('button', { name: /^Upgrade to Business/ }).count() === 1, `${tag}: Upgrade to Business`);
  await dialog.getByRole('heading', { name: 'Starter' }).click();
  expect(await dialog.getByRole('button', { name: 'Current plan' }).isDisabled(), `${tag}: own plan = Current plan (disabled)`);
  expect(await inView(page, dialog.getByRole('button', { name: 'Current plan' })), `${tag}: Current plan in view`);
  await page.screenshot({ path: `${OUT}/${tag}-03-current-plan.png` });
  await cancel.click();
  expect(await page.locator('#closed').textContent() === 'closed', `${tag}: Cancel closes`);
  await context.close();

  // A picker that can't be closed (trial ended, MemoriesPage / App): no Cancel, the action still in view.
  ({ context, page } = await open({ width, height, query: '?plan=Starter&canClose=0&hideStarter=1' }));
  const d2 = page.getByRole('dialog', { name: 'Upgrade Your Plan' });
  expect(await d2.getByRole('button', { name: 'Cancel', exact: true }).count() === 0, `${tag}: locked picker has no Cancel`);
  expect(await inView(page, d2.getByRole('button', { name: /^Upgrade to Teams/ })), `${tag}: locked picker action in view`);
  await page.screenshot({ path: `${OUT}/${tag}-04-locked.png` });
  await context.close();
}

async function expectVisibleSafe(locator, label) {
  try { await locator.waitFor({ state: 'visible', timeout: 3000 }); expect(true, label); } catch { expect(false, label); }
}

await browser.close();
if (pageErrors.length) console.log('page errors:', pageErrors);
console.log(failures.length ? `FAIL ${failures.length}` : 'PASS upgrade-modal');
process.exit(failures.length ? 1 : 0);
