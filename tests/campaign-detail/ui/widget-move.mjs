// Deepak, 24 Nov 2026 (batch b, P2; images/c24b/p2-widget-menu-move.png): "what is the point of duplicating, if I can't
// move it up or down?" Every widget's ⋮ menu gets Move up / Move down, sharing one timeline order with the moments.
// In the real app (Campaigns → campaign page), every API mocked, every non-local request aborted:
//  Timeline: Moment 1 · CTA "Join Now" · Moment 2 · Quote · Moment 3 · HTML.
//  - The CTA's ⋮ (desktop left list / phone card) has Edit, Move up, Move down, Duplicate, Delete.
//  - Quote → Move up: goes past Moment 2 (PUT …/widgets/7002/move {after_post_id 11, after_widget_id 7001}), drawn
//    between the CTA and Moment 2; after a reload (the mock returns the new order) still there.
//  - CTA → Move up: past Moment 1 into the top slot → it's the first item: its menu has no Move up (Move down stays).
//  - HTML (last item): Move up only, no Move down.
//  - Duplicate the CTA: sent with after_widget_id = the original (the copy lands right after it).
// node tests/campaign-detail/ui/widget-move.mjs  (CD_BASE = the dev server, CD_SHOTS = screenshot dir)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from './cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.CD_BASE || 'http://127.0.0.1:5192';
const OUT = process.env.CD_SHOTS || '/private/tmp/claude-501/campaign-detail-ui/widget-move';
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 70, external_user_id: 707, name: 'Main Dealer', email: 'main@dealer.test', role: '2', status: 1, is_activated: true, profile_color: '#1D4ED8' };
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="${['#6C60FF', '#F59E0B', '#10B981'][n % 3]}"/></svg>`;
const img = (n) => `${BASE}/cd-img/${n}.jpg`;
const post = (id, n) => ({
  id, name: `Moment ${n}`, title: `Moment ${n}`, description: '', master_image_link: img(n), image_link: img(n), media_url: img(n),
  capture_date: `2026-10-1${n} 10:00:00`, uploaded_at: `2026-10-1${n} 10:00:00`, parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [],
});
const CAMPAIGN = {
  id: 901, title: 'Fall Promo', user_id: 707, published: 1, slug: 'fall-promo', category: { id: 5, name: 'Campaigns' }, sub_category: null, photos: { count: 3 },
  collaborators: [], user: { id: 707, name: 'Main Dealer' }, created_at: '2026-10-01 10:00:00', location: 'Toronto, ON', tags: ['fall'],
  min_uploaded_img_date: '2026-10-01', max_uploaded_img_date: '2026-10-01', last_update_img: null,
};
const W = (id, type, after, order, data) => ({ id, widget_type: type, after_post_id: after, widget_order: order, widget_data: data, admin_approval: 1, is_visible: true, created_at: '2026-11-08 10:00:00' });
const WIDGETS = [
  W(7001, 'cta', 11, 0, { title: '', buttonText: 'Join Now', buttonLink: 'https://example.com/join', mode: 'link' }),
  W(7002, 'quote', 12, 0, { text: 'Quote under moment two', author: '' }),
  W(7003, 'html', 13, 0, { title: '', content: '<p>Html at the very end</p>' }),
];

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }) {
  const state = { widgets: structuredClone(WIDGETS), moves: [], widgetPosts: [], nextWidget: 8000 };
  const posts = [post(11, 1), post(12, 2), post(13, 3)];
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('cd-seeded')) return;
    sessionStorage.setItem('cd-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'main-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels');
  }, [MAIN]);
  const slotOf = (w) => w.after_post_id ?? null;
  const ordered = (slot) => state.widgets.filter((x) => slotOf(x) === slot).sort((a, b) => (a.widget_order - b.widget_order) || (a.id - b.id));
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/cd-img/')) return route.fulfill({ contentType: 'image/svg+xml', body: svg(Number(url.pathname.match(/(\d+)/)?.[1] ?? 0)) });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const m = req.method();
    let body = null;
    try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch { body = null; }
    if (p === '/memories' && m === 'GET') {
      const all = [CAMPAIGN];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Campaigns', memory_count: all.length }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories/901' && m === 'GET') {
      return route.fulfill({ json: { status: 'success', data: { memory: { ...CAMPAIGN, posts, widgets: [], photos: { count: posts.length } }, linked_memories: [], unified_order: null } } });
    }
    if (p === '/memories/901/widgets' && m === 'GET') return route.fulfill({ json: { success: true, data: state.widgets } });
    const mv = /^\/memories\/901\/widgets\/(\d+)\/move$/.exec(p);
    if (mv && m === 'PUT') {
      // As the API does: the target slot renumbered 0…n with the widget right after the anchor (or first).
      const id = Number(mv[1]);
      state.moves.push({ id, ...body });
      const me = state.widgets.find((x) => x.id === id);
      const slot = body.after_post_id ?? null;
      const others = ordered(slot).filter((x) => x.id !== id);
      const at = body.after_widget_id == null ? 0 : others.findIndex((x) => x.id === body.after_widget_id) + 1;
      if (!me || (body.after_widget_id != null && at === 0)) return route.fulfill({ status: 422, json: { success: false, message: 'That widget is not in that place of this campaign.' } });
      others.splice(at, 0, me);
      me.after_post_id = slot;
      others.forEach((x, i) => { x.widget_order = i; });
      return route.fulfill({ json: { success: true, message: 'Moved.' } });
    }
    if (p === '/memories/901/widgets' && m === 'POST') {
      const w = { id: state.nextWidget++, widget_type: body.widget_type, after_post_id: body.after_post_id, widget_order: body.widget_order ?? 0, widget_data: body.widget_data, admin_approval: 1, is_visible: true, created_at: '2026-11-08 10:00:00' };
      if (body.after_widget_id) {
        const anchor = state.widgets.find((x) => x.id === body.after_widget_id);
        w.after_post_id = anchor.after_post_id;
        let n = 0;
        for (const s of ordered(slotOf(anchor))) { s.widget_order = n++; if (s.id === anchor.id) w.widget_order = n++; }
      }
      state.widgets.push(w);
      state.widgetPosts.push(body);
      return route.fulfill({ json: { success: true, data: w } });
    }
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 5, name: 'Campaigns', is_owner: true, can_add_story: true }], labels: [] } } });
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

const box = async (loc) => loc.first().boundingBox().catch(() => null);
async function openCampaign(page) {
  const card = page.getByText(/^Fall Promo/).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(800);
  await card.click();
  await page.waitForTimeout(2500);
}
// The drawn timeline: desktop = the right-hand cards column, phone = the page. Returns the y of each thing, top-down.
const TEXT = { cta: 'Join Now', quote: 'Quote under moment two', html: 'Html at the very end' };
async function orderOf(page) {
  const desk = page.viewportSize().width >= 1024;
  const scope = desk ? page.locator('[data-timeline-list]').filter({ visible: true }).first().locator(':scope > div').nth(1) : page;
  const ys = {};
  for (const [k, t] of Object.entries(TEXT)) {
    const b = await box(scope.getByText(t).filter({ visible: true }));
    ys[k] = b ? b.y : null;
  }
  for (const n of [11, 12, 13]) {
    // Desktop: the moment card's data-post-id; phone: the card's date (Moment n is 10/1n/2026).
    const b = await box(desk ? page.locator(`[data-post-id="${n}"]`).filter({ visible: true }) : page.getByText(`10/${n}/2026`, { exact: true }).filter({ visible: true }));
    ys[`m${n}`] = b ? b.y : null;
  }
  return Object.entries(ys).filter(([, y]) => y !== null).sort((a, b) => a[1] - b[1]).map(([k]) => k).join(' ');
}
// A widget's ⋮: desktop = its entry in the left timeline list; phone = the card.
async function openMenu(page, kind) {
  const desk = page.viewportSize().width >= 1024;
  let trigger;
  if (desk) {
    const label = { cta: 'Call to Action', quote: TEXT.quote, html: null }[kind];
    const entry = kind === 'html'
      ? page.locator('[data-testid="sidebar-slot"] > div').filter({ has: page.locator('svg.lucide-type, svg') }).filter({ hasText: /HTML|Html/ }).filter({ visible: true }).first()
      : page.locator('[data-testid="sidebar-slot"] > div').filter({ hasText: label }).filter({ visible: true }).first();
    await entry.scrollIntoViewIfNeeded().catch(() => {});
    trigger = entry.locator('[aria-haspopup="dialog"]').first();
  } else {
    const card = kind === 'cta'
      ? page.locator('[data-cta-widget-id="7001"]').filter({ visible: true }).first()
      : page.locator('div.rounded-2xl').filter({ hasText: TEXT[kind] }).filter({ visible: true }).last();
    await card.scrollIntoViewIfNeeded().catch(() => {});
    trigger = card.locator('[aria-haspopup="dialog"]').first();
  }
  await trigger.click();
  await page.waitForTimeout(400);
  const menu = page.locator('[data-radix-popper-content-wrapper]').filter({ visible: true }).last();
  const items = (await menu.innerText().catch(() => '')).split('\n').map((s) => s.trim()).filter(Boolean);
  return { menu, items };
}
const closeMenu = async (page) => { await page.keyboard.press('Escape'); await page.waitForTimeout(250); };

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const o = await open({ width, height });
    const page = o.page;
    await openCampaign(page);

    const start = await orderOf(page);
    expect(start === 'm11 cta m12 quote m13 html', `${tag}: starting order Moment 1 · CTA · Moment 2 · Quote · Moment 3 · HTML (got "${start}")`);

    // The CTA's menu: all five.
    let { items } = await openMenu(page, 'cta');
    for (const want of ['Edit', 'Move up', 'Move down', 'Duplicate', 'Delete']) expect(items.includes(want), `${tag}: the CTA's ⋮ has ${want} (got ${items.join(', ')})`);
    if (width >= 1024) expect(items.join('|') === 'Edit|Move up|Move down|Duplicate|Delete', `${tag}: …in that order (got ${items.join('|')})`);
    await page.screenshot({ path: `${OUT}/${tag}-01-cta-menu.png` });
    await closeMenu(page);

    // Quote → Move up: past Moment 2, right after the CTA.
    let r = await openMenu(page, 'quote');
    await r.menu.getByTestId('widget-move-up').click();
    await page.waitForTimeout(900);
    const mv = o.state.moves.at(-1);
    expect(mv && mv.id === 7002 && mv.after_post_id === 11 && mv.after_widget_id === 7001, `${tag}: Move up sends PUT 7002/move {after_post_id 11, after_widget_id 7001} (got ${JSON.stringify(mv)})`);
    const afterUp = await orderOf(page);
    expect(afterUp === 'm11 cta quote m12 m13 html', `${tag}: the Quote is now above Moment 2, after the CTA (got "${afterUp}")`);
    expect(!(await page.locator('[data-radix-popper-content-wrapper]').filter({ visible: true }).count()), `${tag}: the menu closed after the move`);
    await page.locator('[data-post-id="12"]').filter({ visible: true }).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: `${OUT}/${tag}-02-quote-moved-up.png` });

    // Reload: the campaign page isn't in this mocked app's URL (/stories), so reload and open the campaign again —
    // a fresh GET /widgets, which now returns the moved order.
    await page.reload();
    await openCampaign(page);
    await page.locator('[data-post-id="12"]').filter({ visible: true }).first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.screenshot({ path: `${OUT}/${tag}-02b-after-reload.png` });
    const afterReload = await orderOf(page);
    expect(afterReload === 'm11 cta quote m12 m13 html', `${tag}: after a reload the order is kept (got "${afterReload}")`);

    // CTA → Move up: past Moment 1 into the top slot: the first item, so no Move up any more.
    r = await openMenu(page, 'cta');
    await r.menu.getByTestId('widget-move-up').click();
    await page.waitForTimeout(900);
    const mv2 = o.state.moves.at(-1);
    expect(mv2 && mv2.id === 7001 && mv2.after_post_id === null && mv2.after_widget_id === null, `${tag}: CTA up sends {after_post_id null, after_widget_id null} (got ${JSON.stringify(mv2)})`);
    const top = await orderOf(page);
    expect(top === 'cta m11 quote m12 m13 html', `${tag}: the CTA is first, above Moment 1 (got "${top}")`);
    ({ items } = await openMenu(page, 'cta'));
    expect(!items.includes('Move up') && items.includes('Move down'), `${tag}: the first item has no Move up, keeps Move down (got ${items.join(', ')})`);
    await page.screenshot({ path: `${OUT}/${tag}-03-first-item-menu.png` });
    await closeMenu(page);

    // The last item (HTML after Moment 3): Move up, no Move down.
    ({ items } = await openMenu(page, 'html'));
    expect(items.includes('Move up') && !items.includes('Move down'), `${tag}: the last item has Move up, no Move down (got ${items.join(', ')})`);
    await page.screenshot({ path: `${OUT}/${tag}-04-last-item-menu.png` });
    await closeMenu(page);

    // Duplicate (desktop list and, since this change, the phone card): sent right after its original.
    {
      r = await openMenu(page, 'cta');
      await r.menu.getByText('Duplicate', { exact: true }).click();
      await page.waitForTimeout(1500);
      const dup = o.state.widgetPosts.at(-1);
      expect(dup && dup.after_widget_id === 7001, `${tag}: Duplicate sends after_widget_id 7001 (got ${JSON.stringify(dup && { a: dup.after_widget_id, p: dup.after_post_id })})`);
      const ctaScope = width >= 1024 ? page.locator('[data-timeline-list]').filter({ visible: true }).first().locator(':scope > div').nth(1) : page;
      const ctas = await ctaScope.getByText('Join Now').filter({ visible: true }).count();
      expect(ctas === 2, `${tag}: the copy shows (got ${ctas} CTA cards)`);
      const dupOrder = await orderOf(page);
      expect(dupOrder.startsWith('cta m11'), `${tag}: …both CTAs above Moment 1 (got "${dupOrder}")`);
      await page.screenshot({ path: `${OUT}/${tag}-05-duplicated.png` });
    }
    await o.context.close();
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall widget Move up / Move down checks passed');
process.exit(failures.length ? 1 : 0);
