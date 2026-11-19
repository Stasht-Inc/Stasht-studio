// Chris 19 Nov 2026 — the campaign page's Media panel: he asked for 3 across "so I can properly organize by dragging
// images up and down", but a drag was never saved (on screen only; a reload put everything back). Now (mocked API,
// click by click):
//  - the panel opens in the campaign's order (each moment, then the photos inside it) — the same as the timeline;
//  - 3 across: drag a moment's photo UP onto another → PUT /memories/901/moment-order { item, before }; the timeline
//    shows the new order right away, no "Loading campaign…", refreshed in place; reload → still there (timeline + panel);
//  - 2 across: drag DOWN → { item, after };
//  - a photo inside a moment: shuffles among its moment's photos on screen only (no call); onto another moment → a hint;
//  - the API refuses → the timeline goes back and the error toast shows;
//  - the sort button: Campaign order → Newest first → Oldest first; a drag in a date view goes back to the campaign order;
//  - 390: the phone has no Media panel (the timeline's own order is unchanged there).
// node tests/campaigns/ui/chris-19nov-media-order.mjs   (C19_BASE = dev server, default http://127.0.0.1:5461; C19_SHOTS)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.C19_BASE || 'http://127.0.0.1:5461';
const OUT = process.env.C19_SHOTS || '/private/tmp/claude-501/c19c-media/shots';
mkdirSync(OUT, { recursive: true });

const OWNER = { id: 70, external_user_id: 707, name: 'Christian Beckermann', email: 'chris@c19.test', role: '2', status: 1, is_activated: true, profile_color: '#D946EF' };
const COLORS = ['#14532D', '#166534', '#15803D', '#A16207', '#CA8A04', '#78350F', '#1E3A8A', '#7C2D12', '#4C1D95', '#9D174D'];
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${COLORS[n % COLORS.length]}"/><text x="20" y="160" font-size="60" fill="#fff">${n}</text></svg>`;
const img = (n) => `${BASE}/c19-img/${n}.jpg`;
// Capture dates deliberately NOT in campaign order (the old panel sorted by date: its order meant nothing).
const STEPS = [
  [11, 'chop', 'Finely chop spinach', '2026-11-16 10:00:00'],
  [12, 'squeeze', 'Gently squeeze spinach.', '2026-11-18 10:00:00'],
  [13, 'add-spinach', 'Add spinach to pot.', '2026-11-15 10:00:00'],
  [14, 'add-salt', 'Add salt.', '2026-11-17 10:00:00'],
  [15, 'Add-flour', 'Add flour.', '2026-11-14 10:00:00'],
  [16, 'add-milk', 'Add 1 cup of milk.', '2026-11-19 10:00:00'],
];
const post = (id, name, description, date, parent_id = null) => ({
  id, name, title: '', description, image_link: img(id), master_image_link: img(id), media_url: img(id), size: 3.37, width: 4032, height: 3024,
  capture_date: date, uploaded_at: date, parent_id, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [], user: { id: 707, name: 'Christian Beckermann' },
});
const CAMPAIGN = {
  id: 901, title: 'Creamed Spinach', user_id: 707, published: 0, slug: 'creamed-spinach', category: { id: 1, name: 'Personal' }, sub_category: null,
  collaborators: [], user: { id: 707, name: 'Christian Beckermann' }, created_at: '2026-01-05 10:00:00', location: null, tags: [],
  min_uploaded_img_date: '2026-11-14', max_uploaded_img_date: '2026-11-19', dates: { formatted_range: 'Nov 14 - Nov 19/26' },
  last_update_img: `${BASE}/c19-img/900.jpg`,
};

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open(width, height) {
  const state = {
    posts: [...STEPS.map(([id, name, d, date]) => post(id, name, d, date)), post(21, 'squeeze-close', 'Close up', '2026-11-18 11:00:00', 12), post(22, 'squeeze-towel', 'Towel', '2026-11-18 12:00:00', 12)],
    order: STEPS.map(([id]) => id),
    orderPuts: [], detailGets: 0, refuseNext: false,
  };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  context.setDefaultTimeout(30000);
  await context.addInitScript(([user]) => {
    if (!sessionStorage.getItem('c19c-seeded')) {
      sessionStorage.setItem('c19c-seeded', '1');
      localStorage.clear();
      localStorage.setItem('stasht_token', 'owner-token');
      localStorage.setItem('stasht_user', JSON.stringify(user));
      localStorage.setItem('view_type', 'personal');
      localStorage.setItem('stasht_campaigns_view', 'storeels');
    }
    window.__loadingSeen = 0;
    new MutationObserver(() => {
      if (window.__armLoading && document.body && document.body.innerText.includes('Loading campaign')) window.__loadingSeen++;
    }).observe(document, { subtree: true, childList: true, characterData: true });
  }, [OWNER]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/c19-img/')) return route.fulfill({ contentType: 'image/svg+xml', body: svg(Number(url.pathname.match(/(\d+)/)?.[1] ?? 0)) });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const m = req.method();
    if (p === '/memories' && m === 'GET') {
      const all = [{ ...CAMPAIGN, photos: { count: state.posts.length, preview_images: [] } }];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: 1 }, latest_memories: all, sidebar: { categories: { items: [{ id: 1, name: 'Personal', memory_count: 1, memories: [] }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories/901' && m === 'GET') {
      state.detailGets++;
      return route.fulfill({ json: { status: 'success', data: { memory: { ...CAMPAIGN, posts: structuredClone(state.posts), widgets: [], photos: { count: state.posts.length } }, linked_memories: [], unified_order: state.order.map((id) => ({ type: 'post', id })) } } });
    }
    // As the web API (MomentOrder::place): one moment right before / after another.
    if (p === '/memories/901/moment-order' && m === 'PUT') {
      const b = JSON.parse(req.postData() || '{}');
      state.orderPuts.push(b);
      if (state.refuseNext) {
        state.refuseNext = false;
        return route.fulfill({ status: 422, json: { success: false, message: "Those aren't this campaign's moments. Reload the page and try again." } });
      }
      const where = b.before ? 'before' : 'after';
      const id = Number(b.item?.id); const anchor = Number((b.before || b.after)?.id);
      state.order = state.order.filter((x) => x !== id);
      state.order.splice(state.order.indexOf(anchor) + (where === 'after' ? 1 : 0), 0, id);
      return route.fulfill({ json: { success: true, data: { order: state.order.map((x) => ({ type: 'post', id: x })) } } });
    }
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 1, name: 'Personal', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: false, reason: 'not_available', item_count: 0 } } });
    if (p === '/cars' && m === 'GET') return route.fulfill({ json: { success: true, data: { cars: [], pagination: { last_page: 1 }, filters: {} } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 1, memory_limit: 50 } } } });
    if (p === '/lead-groups') return route.fulfill({ json: { groups: [] } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/memories`);
  return { context, page, state };
}

async function openCampaign(page) {
  const card = page.getByText(/^Creamed Spinach/).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(800);
  await card.click();
  await page.locator('[data-post-id="11"]').first().waitFor({ state: 'attached', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__armLoading = true; window.__loadingSeen = 0; });
}

// The moments as drawn on the timeline (desktop cards, data-post-id).
const drawnOrder = (page) => page.evaluate(() => {
  const ids = [];
  document.querySelectorAll('[data-post-id]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) { const id = Number(el.getAttribute('data-post-id')); if (!ids.includes(id)) ids.push(id); }
  });
  return ids;
});
const grid = (page) => page.locator('[data-testid="media-panel-grid"]').filter({ visible: true }).first();
const panelOrder = async (page) => (await grid(page).locator(':scope > [data-image-id]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-image-id')))));
// HTML5 drag-and-drop as the browser fires it (dragstart → dragenter/over → drop → dragend). Playwright's mouse-driven
// dragAndDrop picks up whatever sits under the start point once the panel scrolls to the target, so the events are
// dispatched on the two photos directly.
const drag = (page, from, to) => page.evaluate(([a, b]) => {
  const q = (id) => document.querySelector(`[data-testid="media-panel-grid"] > [data-image-id="${id}"]`);
  const src = q(a); const dst = q(b);
  if (!src || !dst) throw new Error(`drag: photo ${src ? b : a} not in the panel`);
  const dt = new DataTransfer();
  const fire = (el, type) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
  fire(src, 'dragstart');
  return new Promise((done) => setTimeout(() => { fire(dst, 'dragenter'); fire(dst, 'dragover'); setTimeout(() => { fire(dst, 'drop'); fire(src, 'dragend'); done(); }, 50); }, 50));
}, [from, to]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// The panel = the timeline's moments, each followed by its sub-photos (21, 22 inside 12).
const expectedPanel = (order) => order.flatMap((id) => (id === 12 ? [12, 21, 22] : [id]));

try {
  // ───────────────────────── 1280 ─────────────────────────
  {
    const tag = '1280';
    console.log(`-- ${tag}`);
    const o = await open(1280, 900);
    const { page, state } = o;
    await openCampaign(page);
    await grid(page).waitFor({ timeout: 10000 });
    expect(same(await drawnOrder(page), state.order), `${tag}: the timeline opens in the API's order (${(await drawnOrder(page)).join(',')})`);
    expect(same(await panelOrder(page), expectedPanel(state.order)), `${tag}: the Media panel opens in the campaign's order, sub-photos after their moment (${(await panelOrder(page)).join(',')})`);
    expect(await page.getByTestId('media-sort-toggle').getAttribute('title') === 'Campaign order', `${tag}: the sort button says "Campaign order"`);

    // 3 across, drag "add-milk" (16) UP onto "squeeze" (12).
    await page.getByTestId('media-columns-toggle').filter({ visible: true }).first().click();
    await page.waitForTimeout(400);
    expect(await grid(page).getAttribute('data-columns') === '3', `${tag}: 3 across`);
    await page.screenshot({ path: `${OUT}/${tag}-01-three-columns.png` });
    const getsBefore = state.detailGets;
    await drag(page, 16, 12);
    await page.waitForTimeout(150);
    const optimistic = await drawnOrder(page);
    await page.waitForTimeout(1500);
    const put1 = state.orderPuts.at(-1) || {};
    expect(same(put1, { item: { type: 'post', id: 16 }, before: { type: 'post', id: 12 } }), `${tag}: the drop sends { item: 16, before: 12 } (${JSON.stringify(put1)})`);
    expect(same(optimistic, [11, 16, 12, 13, 14, 15]), `${tag}: the timeline shows the new order right away (${optimistic.join(',')})`);
    expect(same(await drawnOrder(page), [11, 16, 12, 13, 14, 15]) && same(state.order, [11, 16, 12, 13, 14, 15]), `${tag}: saved, and the timeline keeps it after the refresh (${(await drawnOrder(page)).join(',')})`);
    expect(same(await panelOrder(page), expectedPanel(state.order)), `${tag}: the panel shows it too (${(await panelOrder(page)).join(',')})`);
    expect(state.detailGets > getsBefore && await page.evaluate(() => window.__loadingSeen) === 0, `${tag}: refreshed in place, no "Loading campaign…"`);
    await page.screenshot({ path: `${OUT}/${tag}-02-after-drag-up.png` });

    // Back to 2 across, drag "chop" (11) DOWN onto "add-salt" (14).
    await page.getByTestId('media-columns-toggle').filter({ visible: true }).first().click();
    await page.waitForTimeout(400);
    expect(await grid(page).getAttribute('data-columns') === '2', `${tag}: 2 across`);
    await drag(page, 11, 14);
    await page.waitForTimeout(1500);
    const put2 = state.orderPuts.at(-1) || {};
    expect(same(put2, { item: { type: 'post', id: 11 }, after: { type: 'post', id: 14 } }), `${tag}: dragging down sends { item: 11, after: 14 } (${JSON.stringify(put2)})`);
    expect(same(await drawnOrder(page), [16, 12, 13, 14, 11, 15]), `${tag}: the timeline follows (${(await drawnOrder(page)).join(',')})`);

    // Reload: timeline and panel keep the order.
    await page.reload();
    await openCampaign(page);
    await grid(page).waitFor({ timeout: 10000 });
    expect(same(await drawnOrder(page), [16, 12, 13, 14, 11, 15]), `${tag}: after a reload the timeline keeps the order (${(await drawnOrder(page)).join(',')})`);
    expect(same(await panelOrder(page), expectedPanel([16, 12, 13, 14, 11, 15])), `${tag}: …and so does the panel (${(await panelOrder(page)).join(',')})`);
    await page.screenshot({ path: `${OUT}/${tag}-03-after-reload.png` });

    // A photo inside a moment: shuffled among its moment's photos on screen, nothing saved.
    const puts = state.orderPuts.length;
    await drag(page, 22, 21);
    await page.waitForTimeout(800);
    const p3 = await panelOrder(page);
    expect(state.orderPuts.length === puts && p3.indexOf(22) === p3.indexOf(21) - 1, `${tag}: a sub-photo moves within its moment, no call (${p3.join(',')})`);
    // …onto another moment: nothing moves, a hint shows.
    await drag(page, 21, 15);
    await page.waitForTimeout(600);
    expect(state.orderPuts.length === puts, `${tag}: a sub-photo onto another moment is not saved`);
    expect(await page.getByText('use Edit → Choose a Moment').filter({ visible: true }).count() > 0, `${tag}: …and the hint says how to move it`);
    expect(same(await drawnOrder(page), [16, 12, 13, 14, 11, 15]), `${tag}: the timeline didn't change`);

    // The API refuses: the timeline goes back, the error toast shows.
    state.refuseNext = true;
    await drag(page, 15, 16);
    await page.waitForTimeout(1500);
    expect(same(await drawnOrder(page), [16, 12, 13, 14, 11, 15]), `${tag}: refused → the timeline is back as it was (${(await drawnOrder(page)).join(',')})`);
    expect(await page.getByText("Those aren't this campaign's moments").filter({ visible: true }).count() > 0, `${tag}: …and the error toast shows`);
    await page.screenshot({ path: `${OUT}/${tag}-04-refused.png` });

    // Sort button: Campaign order → Newest first → Oldest first → Campaign order.
    const sortBtn = page.getByTestId('media-sort-toggle');
    await sortBtn.click();
    await page.waitForTimeout(300);
    const newest = await panelOrder(page);
    expect(await sortBtn.getAttribute('title') === 'Newest first' && newest[0] === 16, `${tag}: Newest first (${newest.join(',')})`);
    await sortBtn.click();
    await page.waitForTimeout(300);
    expect(await sortBtn.getAttribute('title') === 'Oldest first' && (await panelOrder(page))[0] === 15, `${tag}: Oldest first`);
    // A drag in a date view saves next to the target and goes back to the campaign order.
    // Oldest first: 15, 13, 11, 14, 12, 21, 22, 16 — drag 16 (last) up onto 13 → before 13.
    await drag(page, 16, 13);
    await page.waitForTimeout(1500);
    const put3 = state.orderPuts.at(-1) || {};
    expect(same(put3, { item: { type: 'post', id: 16 }, before: { type: 'post', id: 13 } }), `${tag}: in a date view the drop still saves next to the target (${JSON.stringify(put3)})`);
    expect(await sortBtn.getAttribute('title') === 'Campaign order' && same(await panelOrder(page), expectedPanel(state.order)), `${tag}: …and the panel goes back to the campaign order (${(await panelOrder(page)).join(',')})`);
    expect(same(await drawnOrder(page), state.order), `${tag}: the timeline matches (${(await drawnOrder(page)).join(',')})`);
    expect(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), `${tag}: no horizontal page scroll`);
    await o.context.close();
  }

  // ───────────────────────── 390 ─────────────────────────
  {
    const tag = '390';
    console.log(`-- ${tag}`);
    const o = await open(390, 844);
    const { page, state } = o;
    await openCampaign(page);
    expect(await page.locator('[data-testid="media-panel-grid"]').filter({ visible: true }).count() === 0, `${tag}: no Media panel on the phone (nothing to drag)`);
    expect(state.orderPuts.length === 0, `${tag}: no order call`);
    expect(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), `${tag}: no horizontal page scroll`);
    await page.screenshot({ path: `${OUT}/${tag}-01-phone.png` });
    await o.context.close();
  }
} catch (e) {
  failures.push(`crashed: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
}
if (pageErrors.length) console.log('page errors:', pageErrors.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n - ${failures.join('\n - ')}` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
