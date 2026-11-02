// Users page tab counts (2 Nov): "All Users | Shared with | External | Properties" show each tab's count as plain grey
// number text next to the label, as on the Leads page tabs (no pill), and no number until that tab's list has loaded.
// The counts are there on page load, without opening each tab; each list is fetched once for it.
// node tests/properties/ui/users-tab-counts.mjs   (needs the dev server: PR_BASE, default http://localhost:5263)
// The app's API calls are answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: PR_SHOTS (default /private/tmp/claude-501/properties-ui/users-tab-counts).
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.PR_BASE || 'http://localhost:5263';
const OUT = process.env.PR_SHOTS || '/private/tmp/claude-501/properties-ui/users-tab-counts';
mkdirSync(OUT, { recursive: true });

// role 2 + a Professional plan: what shows the External and Properties tabs (UsersPage).
const MAIN = { id: 70, external_user_id: 707, name: 'Main Dealer', email: 'main@dealer.test', role: '2', status: 1 };

const person = (id, name, extra = {}) => ({ id, name, email: `${name.split(' ')[0].toLowerCase()}@dealer.test`, status: 1, role: 'admin', collaborator_role: 'admin', is_user_collaborator: true, created_at: '2026-10-01T10:00:00Z', ...extra });
// 12 users (10 collaborators + 2 not yet): two-digit counts on the narrowest tab bar.
const USERS = {
  collaborators: Array.from({ length: 10 }, (_, i) => person(100 + i, `Team Member${i + 1}`)),
  non_collaborators: [person(200, 'Nina Newcomer', { status: 0, is_user_collaborator: false }), person(201, 'Omar Owl', { status: 0, is_user_collaborator: false })],
};
const SHARED = [
  { collaboration_id: 1, memory_title: 'Fall Promo', role: 'viewer', status: 'active', added_at: '2026-10-02T10:00:00Z', added_by: { name: 'Other Dealer' } },
  { collaboration_id: 2, memory_title: 'Open House', role: 'editor', status: 'active', added_at: '2026-10-03T10:00:00Z', added_by: { name: 'Other Dealer' } },
  { collaboration_id: 3, memory_title: 'Winter Tires', role: 'viewer', status: 'active', added_at: '2026-10-04T10:00:00Z', added_by: { name: 'Other Dealer' } },
];
const base = { location: 'Toronto, ON', memories_count: 2, users_count: 1, invited_users: [], labels: [], invite_link: null, created_at: '2026-10-01T10:00:00Z', is_active: true, can_manage: true };
// 1 internal property ("1 property") + 4 external accounts (one of them the viewer's own external row, still listed).
const PROPERTIES = [
  { ...base, id: 1, name: 'Pedalheads North', unique_id: 'PH-1', user_id: 707, is_creator: true, user_role: 'admin', property_type: 'internal', status: 'active', account_type: 'internal', account_created_for_property: false },
  { ...base, id: 2, name: 'Bob Bozic', unique_id: 'BB-2', user_id: 901, is_creator: false, user_role: 'admin', property_type: 'external', status: 1, account_type: 'external', account_created_for_property: false },
  { ...base, id: 3, name: 'Sam Seller', unique_id: 'SS-3', user_id: 902, is_creator: false, user_role: 'admin', property_type: 'external', status: 1, account_type: 'external', account_created_for_property: true },
  { ...base, id: 4, name: 'Rita Rep', unique_id: 'RR-4', user_id: 903, is_creator: false, user_role: 'viewer', property_type: 'external', status: 1, account_type: 'external', can_manage: false, account_created_for_property: true },
  { ...base, id: 5, name: 'Main Dealer Sales', unique_id: 'MD-5', user_id: 707, is_creator: true, user_role: 'admin', property_type: 'external', status: 1, account_type: 'external', account_created_for_property: true },
];
const EXPECT = { 'All Users': '12', 'Shared with': '3', External: '4', Properties: '1' };
const TABS = Object.keys(EXPECT);

const failures = [];
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

// delays: ms before /properties and the Shared with list answer (checks no number shows before they load).
async function open({ width, height, tab = null, delays = {} }) {
  const state = { fetches: { users: 0, shared: 0, properties: 0 } };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user, openTab]) => {
    if (openTab && location.pathname === '/users') sessionStorage.setItem('users_open_tab', openTab);
    if (sessionStorage.getItem('pr-seeded')) return;
    sessionStorage.setItem('pr-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'main-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
  }, [MAIN, tab]);
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
      const wait = (ms) => (ms ? new Promise((r) => setTimeout(r, ms)) : null);
      if (path === '/user/collaborators-and-non-collaborators' && req.method() === 'GET') {
        state.fetches.users++;
        await wait(delays.users);
        return route.fulfill({ json: { success: true, data: USERS } });
      }
      if (path === '/user/my-collaboration-associations' && req.method() === 'GET') {
        state.fetches.shared++;
        await wait(delays.shared);
        return route.fulfill({ json: { success: true, data: { associations: SHARED } } });
      }
      if (path === '/properties' && req.method() === 'GET') {
        state.fetches.properties++;
        await wait(delays.properties);
        return route.fulfill({ json: { success: true, data: { properties: PROPERTIES } } });
      }
      if (path === '/user/storage-overview') {
        return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
      }
      return route.fulfill({ json: { success: true, data: [] } });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/users`);
  await tabButton(page, 'Properties').waitFor({ state: 'visible', timeout: 25000 });
  return { context, page, state };
}

// The visible tab button (its accessible name is the label, then its count once loaded).
function tabButton(page, label) {
  return page.getByRole('button', { name: new RegExp(`^${label}( \\d+)?$`) }).filter({ visible: true }).first();
}
// { label: count text or '' } for the four tabs, and how the count is drawn.
async function readTabs(page) {
  const out = {};
  for (const label of TABS) {
    out[label] = await tabButton(page, label).evaluate((el) => {
      const c = el.querySelector('[data-tab-count]');
      if (!c) return { count: '' };
      const cs = getComputedStyle(c);
      return { count: c.textContent.trim(), color: cs.color, bg: cs.backgroundColor, radius: cs.borderRadius };
    });
  }
  return out;
}
const counts = (tabs) => Object.fromEntries(Object.entries(tabs).map(([k, v]) => [k, v.count]));
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function shot(page, file) {
  const path = `${OUT}/${file}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('shot', path);
}

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);

    // 1. Opened on All Users: every tab's count appears without opening the other tabs; one fetch per list.
    {
      const { page, context, state } = await open({ width, height });
      await page.waitForFunction(() => document.querySelectorAll('[data-tab-count]').length >= 4, null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1200); // the users tab's own debounced reload, then nothing more
      const tabs = await readTabs(page);
      expect(JSON.stringify(counts(tabs)) === JSON.stringify(EXPECT), `${tag}: tab counts on load (${JSON.stringify(counts(tabs))})`);
      // Plain grey number, no pill: gray-500 text, transparent background, no rounding.
      for (const [label, t] of Object.entries(tabs)) {
        expect(t.color === 'rgb(107, 114, 128)' && t.bg === 'rgba(0, 0, 0, 0)' && (t.radius === '0px' || t.radius === ''), `${tag}: ${label} count is plain grey text (${JSON.stringify(t)})`);
      }
      expect(state.fetches.shared === 1 && state.fetches.properties === 1, `${tag}: Shared with and properties fetched once on load (${JSON.stringify(state.fetches)})`);
      // The numbers agree with what each tab says inside.
      expect(await page.getByText('12 users', { exact: false }).filter({ visible: true }).count() > 0, `${tag}: All Users list says 12 users`);
      // All four tabs fit the bar (no hidden tab needing a sideways scroll) and the page doesn't scroll sideways.
      const fit = await tabButton(page, 'Properties').evaluate((el) => {
        const bar = el.parentElement;
        return { scroll: bar.scrollWidth, client: bar.clientWidth };
      });
      expect(fit.scroll <= fit.client + 1, `${tag}: all four tabs fit the tab bar (${JSON.stringify(fit)})`);
      expect(await noOverflow(page), `${tag}: no sideways page scroll`);
      await shot(page, `${tag}-01-all-users-counts`);

      // Opening the other tabs: the counts stay, the tab contents agree.
      await tabButton(page, 'Shared with').click();
      await page.getByText('3 campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => failures.push(`${tag}: Shared with says 3 campaigns`));
      await tabButton(page, 'External').click();
      await page.getByText('4 external accounts', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => failures.push(`${tag}: External says 4 external accounts`));
      await shot(page, `${tag}-02-external-counts`);
      await tabButton(page, 'Properties').click();
      await page.getByText('1 property', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => failures.push(`${tag}: Properties says 1 property`));
      await page.waitForTimeout(600);
      const after = counts(await readTabs(page));
      expect(JSON.stringify(after) === JSON.stringify(EXPECT), `${tag}: counts unchanged after opening each tab (${JSON.stringify(after)})`);
      await shot(page, `${tag}-03-properties-counts`);
      await context.close();
    }

    // 2. Slow lists: a tab shows no number (not "0") until its own list has loaded.
    {
      const { page, context } = await open({ width, height, delays: { properties: 3000, shared: 3000 } });
      await page.waitForFunction(() => document.querySelectorAll('[data-tab-count]').length >= 1, null, { timeout: 15000 }).catch(() => {});
      const early = counts(await readTabs(page));
      expect(early['All Users'] === '12' && early['Shared with'] === '' && early.External === '' && early.Properties === '', `${tag}: before the slow lists load only All Users has a number (${JSON.stringify(early)})`);
      await shot(page, `${tag}-04-before-lists-load`);
      await page.waitForFunction(() => document.querySelectorAll('[data-tab-count]').length >= 4, null, { timeout: 15000 }).catch(() => {});
      const late = counts(await readTabs(page));
      expect(JSON.stringify(late) === JSON.stringify(EXPECT), `${tag}: after they load (${JSON.stringify(late)})`);
      await context.close();
    }

    // 3. Opened on Properties (as after a property action): the All Users and Shared with counts load too, and the
    // properties list is fetched once (by the open tab), not again for the count.
    {
      const { page, context, state } = await open({ width, height, tab: 'properties' });
      await page.waitForFunction(() => document.querySelectorAll('[data-tab-count]').length >= 4, null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);
      const tabs = counts(await readTabs(page));
      expect(JSON.stringify(tabs) === JSON.stringify(EXPECT), `${tag}: opened on Properties: counts (${JSON.stringify(tabs)})`);
      expect(state.fetches.properties === 1 && state.fetches.users >= 1 && state.fetches.shared === 1, `${tag}: opened on Properties: fetches (${JSON.stringify(state.fetches)})`);
      await shot(page, `${tag}-05-opened-on-properties`);
      await context.close();
    }
  }
} catch (e) {
  failures.push(`threw: ${e.message}`);
} finally {
  await browser.close();
}
for (const e of pageErrors) failures.push(`page error: ${e}`);
if (blocked.size) console.log(`outside requests aborted (none reached the network): ${[...blocked].join(', ')}`);
if (failures.length) {
  console.error(`FAIL users-tab-counts\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('PASS users-tab-counts');
