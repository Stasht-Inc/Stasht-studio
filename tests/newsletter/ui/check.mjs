// Newsletter screenshot checks: node tests/newsletter/ui/check.mjs <scenario>
// Needs the dev server (NL_BASE, default http://localhost:5198; see the plan's Global Constraints). Every API
// call is answered by mock-api.mjs and every other non-local request is aborted: nothing leaves this machine.
// Screenshots: NL_SHOTS (default /private/tmp/claude-501/newsletters-ui/shots).
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { createMockApi } from './mock-api.mjs';

const { chromium } = pw;
const BASE = process.env.NL_BASE || 'http://localhost:5198';
const OUT = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
const name = process.argv[2];
if (!name) {
  console.error('usage: node tests/newsletter/ui/check.mjs <scenario>');
  process.exit(2);
}
const scenario = await import(`./scenarios/${name}.mjs`);
mkdirSync(OUT, { recursive: true });

// The stored auth user carries the old keys (profile_image, phone_number) and profile_color.
const USER = {
  id: 1, external_user_id: 990002, name: 'Samantha Smith', email: 'samantha@serpachrysler.ca', role: '2',
  phone_number: '+1 416 555 0100', profile_image: null, profile_color: '#F59E0B',
};
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const failures = [];
const pageErrors = [];
const blocked = new Set();

async function open({ view = 'composer', query = '', width = 1440, height = 1000, api = createMockApi() } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
  await context.addInitScript((user) => {
    // Playwright runs init scripts in every frame; the exact-email preview is a sandboxed iframe with no storage.
    if (window.top !== window) return;
    localStorage.setItem('stasht_token', 'nl-harness-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
  }, USER);
  // Context-wide, so popups and workers are covered too. mock-api aborts every non-local host.
  await context.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    if (!['localhost', '127.0.0.1'].includes(host) && host !== 'i.ytimg.com') blocked.add(host);
    return api.route(route);
  });
  const page = await context.newPage();
  // Playwright's own service-worker blocker also runs inside the sandboxed preview iframe and throws there.
  page.on('pageerror', (e) => { if (!/sandboxed and lacks the 'allow-same-origin' flag/.test(e.message)) pageErrors.push(e.message); });
  await page.goto(`${BASE}/tests/newsletter/ui/harness.html?view=${view}${query}`);
  return { context, page, api };
}

async function shot(page, file) {
  const path = `${OUT}/${name}-${file}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log('shot', path);
  return path;
}

async function expectVisible(locator, label) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout: 8000 });
  } catch {
    failures.push(`not visible: ${label}`);
  }
}

function expect(condition, label) {
  if (!condition) failures.push(label);
}

/** True when anything scrolls sideways: the page or the composer's own scroller. */
async function hasOverflow(page) {
  return page.evaluate(() => {
    if (document.documentElement.scrollWidth > window.innerWidth) return true;
    return [...document.querySelectorAll('[role="dialog"], [role="dialog"] *')].some((el) => {
      const s = getComputedStyle(el);
      return (s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1;
    });
  });
}

try {
  await scenario.run({ open, shot, expectVisible, expect, hasOverflow });
} catch (e) {
  failures.push(`scenario threw: ${e.message}`);
} finally {
  await browser.close();
}
for (const e of pageErrors) failures.push(`page error: ${e}`);
if (blocked.size) console.log(`outside requests (answered locally or aborted; none reached the network): ${[...blocked].join(', ')}`);
if (failures.length) {
  console.error(`FAIL ${name}\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`PASS ${name}`);
