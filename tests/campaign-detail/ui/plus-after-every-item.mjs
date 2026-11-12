// Chris, 12 Nov 2026 (images/68.png): a "+" after EVERY timeline item — each moment and each widget card — on the desktop
// right column and the phone timeline. In the real app (Campaigns → campaign page), every API mocked:
//  - 1280, 0 moments + a top Quote: a "+" under the header AND after the Quote.
//  - 1280, a moment with 2 widgets (Quote order 0, HTML order 1): drawn in widget_order (Quote above HTML, across types),
//    a "+" after each; the "+" after the first widget → HTML → saved with after_widget_id and drawn between the two.
//  - 390, the same on the phone timeline (0 moments + Quote; moment + 2 widgets; insert after the first widget).
// node tests/campaign-detail/ui/plus-after-every-item.mjs  (CD_BASE = the dev server)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from './cover-fixtures.mjs';
import { DOCUSIGN_ENABLED } from '../../../constants/features.ts';

const { chromium } = pw;
const BASE = process.env.CD_BASE || 'http://localhost:5293';
const OUT = process.env.CD_SHOTS || '/private/tmp/claude-501/campaign-detail-ui/plus-after-every-item';
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
// The same campaign, owned by someone else, with Main Dealer as an accepted contributor → the shared (collaborator) view.
const sharedAs = (role) => ({ ...CAMPAIGN, user_id: 808, user: { id: 808, name: 'Other Owner' }, collaborator: [{ user_id: 707, status: 1, role, user: { email: 'main@dealer.test' } }] });

const OTHERS = [{ ...CAMPAIGN, id: 701, title: 'Open House Weekend', slug: 'open-house', last_update_img: img(2), posts_count: 4 }];
const W = (id, type, after, order, data) => ({ id, widget_type: type, after_post_id: after, widget_order: order, widget_data: data, admin_approval: 1, is_visible: true, created_at: '2026-11-08 10:00:00' });
const QUOTE_TOP = W(6001, 'quote', null, 0, { text: 'Whether you are just getting started, growing an established company.', author: '' });
const TWO = [
  W(6005, 'quote', 11, 0, { text: 'First widget quote', author: '' }),
  W(6003, 'html', 11, 1, { title: '', content: '<p>Second widget html</p>' }),
];
const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height, memory = CAMPAIGN, widgets = [], posts = [post(11, 1), post(12, 2), post(13, 3)] }) {
  const state = { widgets: structuredClone(widgets), widgetPosts: [], linkCalls: [], nextWidget: 4000 };
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
      const all = [memory, ...OTHERS];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Campaigns', memory_count: all.length }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories/901' && m === 'GET') {
      return route.fulfill({ json: { status: 'success', data: { memory: { ...memory, posts, widgets: [], photos: { count: posts.length } }, linked_memories: [], unified_order: null } } });
    }
    if (p === '/memories/901/widgets' && m === 'GET') return route.fulfill({ json: { success: true, data: state.widgets } });
    if (p === '/memories/901/widgets' && m === 'POST') {
      const w = { id: state.nextWidget++, widget_type: body.widget_type, after_post_id: body.after_post_id, widget_order: body.widget_order ?? 0, widget_data: body.widget_data, admin_approval: 1, is_visible: true, created_at: '2026-11-08 10:00:00' };
      if (body.after_widget_id) {
        // As the API does: the anchor's slot, renumbered 0…n with a gap right after the anchor.
        const anchor = state.widgets.find((x) => x.id === body.after_widget_id);
        if (!anchor) return route.fulfill({ status: 422, json: { success: false, message: 'That widget is not in this campaign.' } });
        w.after_post_id = anchor.after_post_id;
        const sibs = state.widgets.filter((x) => (x.after_post_id ?? null) === (anchor.after_post_id ?? null)).sort((a, b) => (a.widget_order - b.widget_order) || (a.id - b.id));
        let n = 0;
        for (const s of sibs) { s.widget_order = n++; if (s.id === anchor.id) w.widget_order = n++; }
      }
      state.widgets.push(w);
      state.widgetPosts.push(body);
      return route.fulfill({ json: { success: true, data: w } });
    }
    if (p === '/memories/901/linked-memories' && m === 'POST') {
      state.linkCalls.push(body);
      return route.fulfill({ json: { success: true, data: { linked: (body.linked_memory_ids || []).length, already_linked_ids: [] } } });
    }
    if (p === '/integrations/docusign/status') return route.fulfill({ json: { success: true, connected: true, data: { connected: true } } });
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


const chooser = (page) => page.getByTestId('add-widget-chooser');
const deskPlus = (page, wid) => page.locator(`[data-testid="timeline-add-plus"][data-after-widget-id="${wid}"]`).filter({ visible: true });
const phonePlus = (page, wid) => page.locator(`[data-testid="phone-add-plus"][data-after-widget-id="${wid}"]`).filter({ visible: true });
const box = async (loc) => loc.first().boundingBox().catch(() => null);
// Desktop: the right-hand column (the left timeline list repeats a widget's text); phone: the page.
const vis = (page, text) => (page.viewportSize().width >= 1024
  ? page.locator('[data-timeline-list]').filter({ visible: true }).first().locator(':scope > div').nth(1)
  : page).getByText(text).filter({ visible: true }).first();
const pick = async (page, label) => { await chooser(page).getByRole('menuitem', { name: new RegExp(`^${label}`) }).click(); await page.waitForTimeout(700); };
async function openCampaign(page) {
  const card = page.getByText(/^Fall Promo/).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(800);
  await card.click();
  await page.waitForTimeout(2500);
}
async function saveHtml(page, text) {
  const html = page.getByRole('dialog').filter({ has: page.getByPlaceholder('Paste your HTML code here...') });
  await html.getByPlaceholder('Paste your HTML code here...').fill(`<p>${text}</p>`);
  await html.getByRole('button', { name: 'Add HTML' }).click();
  await page.waitForTimeout(1800);
}
const below = (a, b) => Boolean(a && b && a.y >= b.y + b.height - 1); // a starts at/after b's bottom

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const phone = width < 768;
    const P = phone ? phonePlus : deskPlus;
    const tag = phone ? '390' : '1280';

    // ── 0 moments + a top Quote (Chris's screenshot) ──
    {
      const o = await open({ width, height, posts: [], widgets: [QUOTE_TOP] });
      await openCampaign(o.page);
      const page = o.page;
      const quote = vis(page, 'Whether you are just getting started');
      expect(await quote.isVisible().catch(() => false), `${tag} 0 moments: the top Quote shows`);
      const plus = P(page, '6001');
      expect(await plus.count() === 1, `${tag} 0 moments: a "+" after the Quote (got ${await plus.count()})`);
      await plus.first().scrollIntoViewIfNeeded().catch(() => {});
      expect(below(await box(plus), await box(quote)), `${tag} 0 moments: …directly below the Quote`);
      const topPlus = phone ? page.locator('[data-testid="phone-add-plus"][data-after-post-id=""][data-after-widget-id=""]').filter({ visible: true })
        : page.locator('[data-testid="timeline-add-plus"][data-after-post-id=""][data-after-widget-id=""]').filter({ visible: true });
      expect(await topPlus.count() === 1, `${tag} 0 moments: the top "+" is kept`);
      await page.screenshot({ path: `${OUT}/${tag}-01-zero-moments-quote.png`, fullPage: false });
      if (phone) {
        // The phone's new top "+" opens its mini-menu where it can be tapped.
        await topPlus.first().locator('button').first().click();
        await page.waitForTimeout(400);
        const html = page.locator('button').filter({ hasText: /^HTML/ }).filter({ visible: true }).first();
        const hb = await box(html);
        const hit = hb && await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return Boolean(e && e.closest('button') && /HTML/.test(e.closest('button').textContent)); }, [hb.x + hb.width / 2, hb.y + hb.height / 2]);
        expect(Boolean(hit), `${tag} 0 moments: the top "+" mini-menu is on screen and tappable`);
        await page.screenshot({ path: `${OUT}/${tag}-01b-top-menu.png` });
      }
      await o.context.close();
    }

    // ── a moment with 2 widgets ──
    {
      const o = await open({ width, height, widgets: TWO });
      await openCampaign(o.page);
      const page = o.page;
      const q = vis(page, 'First widget quote');
      const h = vis(page, 'Second widget html');
      await q.scrollIntoViewIfNeeded().catch(() => {});
      const qb = await box(q); const hb = await box(h);
      expect(qb && hb && qb.y < hb.y, `${tag}: widgets in widget_order across types (Quote order 0 above HTML order 1)`);
      for (const id of ['6005', '6003']) expect(await P(page, id).count() === 1, `${tag}: a "+" after widget ${id}`);
      const p5 = await box(P(page, '6005')); const p3 = await box(P(page, '6003'));
      expect(below(p5, qb) && hb && p5 && p5.y + p5.height <= hb.y + 1, `${tag}: the "+" after the Quote sits between the Quote and the HTML`);
      expect(below(p3, hb), `${tag}: the "+" after the HTML sits below it`);
      const m2 = page.locator('[data-post-id="12"]').filter({ visible: true }).first();
      if (!phone) expect(p3 && (await box(m2)) && p3.y < (await box(m2)).y, `${tag}: …and above Moment 2`);
      await page.screenshot({ path: `${OUT}/${tag}-02-two-widgets.png` });

      // Insert after the first widget.
      await P(page, '6005').first().scrollIntoViewIfNeeded();
      if (phone) {
        await P(page, '6005').first().locator('button').first().click();
        await page.waitForTimeout(400);
        await page.locator('button').filter({ hasText: /^HTML/ }).filter({ visible: true }).first().click();
      } else {
        await P(page, '6005').first().getByRole('button', { name: 'Add Widget' }).click();
        await chooser(page).waitFor({ timeout: 5000 });
        await pick(page, 'HTML');
      }
      await page.waitForTimeout(600);
      await saveHtml(page, 'Inserted between');
      const sent = o.state.widgetPosts.at(-1);
      expect(sent && sent.after_widget_id === 6005 && String(sent.after_post_id) === '11', `${tag}: insert after the first widget sends after_widget_id 6005, slot 11 (got ${JSON.stringify(sent && { a: sent.after_widget_id, p: sent.after_post_id })})`);
      const ins = vis(page, 'Inserted between');
      await ins.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);
      const ib = await box(ins); const qb2 = await box(q); const hb2 = await box(h);
      expect(ib && qb2 && hb2 && qb2.y < ib.y && ib.y < hb2.y, `${tag}: the new HTML lands between the Quote and the old HTML`);
      expect(await P(page, String(sent?.id ?? o.state.widgets.at(-1).id)).count() === 1, `${tag}: …and gets its own "+"`);
      await page.screenshot({ path: `${OUT}/${tag}-03-inserted.png` });
      await o.context.close();
    }
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall "+ after every item" checks passed');
process.exit(failures.length ? 1 : 0);
