// A published campaign stays in the Storeels "All Campaigns" grid (real local E2E, 9 Nov 2026: after publishing,
// "3 campaigns found" and the campaign was gone, though GET /memories returned all 4).
//   node tests/campaign-card/ui/published-in-grid.mjs   (needs the dev server: CC_BASE, default http://localhost:5288)
// GET /memories is answered with the real API's shape: a published campaign's card carries the virtual category
// "Published", and the sidebar rows are the account's own categories with non-published counts (here Personal (3),
// no "Published" row). Checks at 1280 and 390: the count, every campaign exactly once, the Public badge, the
// category / author / label dropdowns; an account WITH a "Published" row, where the user can still collapse it;
// and nothing published (unchanged). Every API call is answered here; every non-local request is aborted.
// Screenshots: CC_SHOTS (default /private/tmp/claude-501/campaign-card-ui/published-in-grid).
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.CC_BASE || 'http://localhost:5288';
const OUT = process.env.CC_SHOTS || '/private/tmp/claude-501/campaign-card-ui/published-in-grid';
mkdirSync(OUT, { recursive: true });

const USER = { id: 70, external_user_id: 707, name: 'Serpa Chrysler', email: 'dealer@serpa.test', role: '2', status: 1, profile_color: '#1D4ED8' };
const author = { id: 707, name: 'Serpa Chrysler', avatar: null, profile_color: '#1D4ED8' };
const card = (id, title, { published = 0, label = null, daysAgo = 3 } = {}) => ({
  id, title, slug: `c-${id}`, published, author, collaborators: [], tags: [], photos: { count: 2, preview_images: [] },
  category: published ? { id: null, name: 'Published', color: '#9333EA', badge_style: { hex_color: '#9333EA' } } : { id: 5, name: 'Personal', color: '#6366F1', badge_style: { hex_color: '#6366F1' } },
  sub_category: label ? { id: 31, name: label } : null,
  dates: { formatted_range: 'Nov 9/26' }, location: { formatted: 'Toronto, Canada' },
  created_at: new Date(Date.now() - daysAgo * 864e5).toISOString(), updated_at: new Date(Date.now() - daysAgo * 864e5).toISOString(),
});
const TITLES = ['Thomas Jeeps Inventory', 'Spring Open House', 'Winter Tires', 'Summer BBQ'];

function memoriesResponse({ publishThomas, publishedRow }) {
  const all = [
    card(12888, TITLES[0], { published: publishThomas ? 1 : 0, label: 'Jeeps', daysAgo: 0 }),
    card(12889, TITLES[1]), card(12890, TITLES[2]), card(12891, TITLES[3]),
  ];
  const personal = all.filter((m) => !m.published).length;
  const items = [{ id: 5, name: 'Personal', color: '#6366F1', memory_count: personal, admin_id: null, memories: [] }];
  if (publishedRow) items.push({ id: 6, name: 'Published', color: '#9333EA', memory_count: all.length - personal, admin_id: null, memories: [] });
  return {
    success: true,
    data: {
      latest_memories: all, sharedWith: [], published: [], shopify: { count: 0, collections: [] },
      all_memories: { data: all, pagination: { current_page: 1, per_page: 50, total: all.length, last_page: 1 } },
      sidebar: { categories: { title: 'Categories', count: items.length, items }, labels: { title: 'Labels', count: 1, items: [{ id: 31, name: 'Jeeps', memory_count: 0, category_id: 5, memories: [] }] } },
      filters: { authors: [{ id: 707, name: 'Serpa Chrysler' }] },
    },
  };
}

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }, opts) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('cc-seeded')) return;
    sessionStorage.setItem('cc-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'tok');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels');
  }, [USER]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      return route.abort('blockedbyclient');
    }
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (p === '/memories' && req.method() === 'GET') return route.fulfill({ json: memoriesResponse(opts) });
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 5, name: 'Personal', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 4, memory_limit: 50 } } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/memories`);
  await page.getByText(/\d+ campaigns? found/).filter({ visible: true }).first().waitFor({ timeout: 45000 });
  await page.getByText('Spring Open House').filter({ visible: true }).first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  return { context, page };
}

const grid = (page) => page.locator('div.grid.md\\:grid-cols-4').filter({ visible: true }).first();
const countText = async (page) => (await page.getByText(/\d+ campaigns? found/).filter({ visible: true }).first().textContent()).trim();
const cardsIn = async (page) => Object.fromEntries(await Promise.all(TITLES.map(async (t) => [t, await grid(page).getByText(t, { exact: true }).count()])));
const inViewport = async (page, loc) => {
  const box = await loc.boundingBox().catch(() => null);
  const vp = page.viewportSize();
  return Boolean(box && box.y >= -1 && box.x >= -1 && box.y + Math.min(box.height, 40) <= vp.height && box.x + box.width <= vp.width + 1);
};
// The grid's own dropdowns (the desktop sidebar has its own "Category Filter" combobox earlier in the page).
async function pick(page, current, option) {
  await page.getByRole('combobox').filter({ hasText: current }).filter({ visible: true }).last().click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await page.waitForTimeout(700);
}

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    // ── The E2E account: Thomas published, no "Published" sidebar row ────────────────────────────────────────────
    {
      const { page, context } = await open({ width, height }, { publishThomas: true, publishedRow: false });
      await page.screenshot({ path: `${OUT}/${tag}-01-published-in-all-campaigns.png` });
      expect((await countText(page)) === '4 campaigns found', `${tag}: "4 campaigns found" (got "${await countText(page)}")`);
      const c = await cardsIn(page);
      expect(TITLES.every((t) => c[t] === 1), `${tag}: every campaign exactly once in the grid ${JSON.stringify(c)}`);
      const thomas = grid(page).locator('div.relative.z-0').filter({ hasText: TITLES[0] }).first();
      expect(await thomas.getByText('Public', { exact: true }).isVisible(), `${tag}: the published card shows its Public badge`);
      expect(await thomas.getByText('Published', { exact: true }).isVisible(), `${tag}: … and the Published category pill`);
      expect(await inViewport(page, page.getByText(/\d+ campaigns? found/).filter({ visible: true }).first()), `${tag}: the count is in the viewport`);
      // Category dropdown: "Published" picks just the published one; "Personal" the other three.
      await pick(page, 'All Categories', 'Published');
      await page.screenshot({ path: `${OUT}/${tag}-02-category-published.png` });
      let k = await cardsIn(page);
      expect(k[TITLES[0]] === 1 && k[TITLES[1]] + k[TITLES[2]] + k[TITLES[3]] === 0, `${tag}: category Published → only the published campaign ${JSON.stringify(k)}`);
      await pick(page, 'Published', 'Personal');
      k = await cardsIn(page);
      expect(k[TITLES[0]] === 0 && k[TITLES[1]] === 1 && k[TITLES[2]] === 1 && k[TITLES[3]] === 1, `${tag}: category Personal → the three unpublished ${JSON.stringify(k)}`);
      await pick(page, 'Personal', 'All Categories');
      // Author: the owner → all four. Label "Jeeps" → the published one (it carries the label).
      await pick(page, 'All Authors', 'Serpa Chrysler');
      k = await cardsIn(page);
      expect(TITLES.every((t) => k[t] === 1), `${tag}: author Serpa Chrysler → all four ${JSON.stringify(k)}`);
      await pick(page, 'Serpa Chrysler', 'All Authors');
      await pick(page, 'All Labels', 'Jeeps');
      await page.screenshot({ path: `${OUT}/${tag}-03-label-jeeps.png` });
      k = await cardsIn(page);
      expect(k[TITLES[0]] === 1 && k[TITLES[1]] + k[TITLES[2]] + k[TITLES[3]] === 0, `${tag}: label Jeeps → the published campaign ${JSON.stringify(k)}`);
      await context.close();
    }
    // ── An account with a "Published" row: shown expanded; on desktop the user can still collapse it ────────────
    {
      const { page, context } = await open({ width, height }, { publishThomas: true, publishedRow: true });
      expect((await countText(page)) === '4 campaigns found', `${tag}: with a Published row, "4 campaigns found" (got "${await countText(page)}")`);
      const c = await cardsIn(page);
      expect(TITLES.every((t) => c[t] === 1), `${tag}: with a Published row, every campaign exactly once ${JSON.stringify(c)}`);
      if (width >= 1024) {
        const row = page.getByText('Published', { exact: true }).filter({ visible: true });
        // The sidebar row's name toggles its expansion (CategoryNav): collapse it → its campaign leaves the grid.
        const sidebarRow = page.locator('aside, nav, div').filter({ has: page.getByText('Categories', { exact: true }) }).getByText('Published', { exact: true }).filter({ visible: true }).first();
        await sidebarRow.click().catch(() => row.first().click());
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${OUT}/${tag}-04-published-row-collapsed.png` });
        const k = await cardsIn(page);
        expect(k[TITLES[0]] === 0 && k[TITLES[1]] === 1, `${tag}: collapsing the Published row still hides its campaign (unchanged) ${JSON.stringify(k)}`);
        expect((await countText(page)) === '3 campaigns found', `${tag}: … and the count follows: "3 campaigns found" (got "${await countText(page)}")`);
      }
      await context.close();
    }
    // ── Nothing published (unchanged) ─────────────────────────────────────────────────────────────────────────────
    {
      const { page, context } = await open({ width, height }, { publishThomas: false, publishedRow: false });
      await page.screenshot({ path: `${OUT}/${tag}-05-nothing-published.png` });
      expect((await countText(page)) === '4 campaigns found', `${tag}: nothing published, "4 campaigns found"`);
      const c = await cardsIn(page);
      expect(TITLES.every((t) => c[t] === 1), `${tag}: nothing published, every campaign exactly once ${JSON.stringify(c)}`);
      expect(!(await grid(page).getByText('Public', { exact: true }).count()), `${tag}: no Public badge when nothing is published`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
expect(pageErrors.length === 0, `no page errors ${JSON.stringify(pageErrors.slice(0, 3))}`);
console.log(failures.length ? `FAIL (${failures.length}): ${failures.join(' | ')}` : 'PASS');
process.exit(failures.length ? 1 : 0);
