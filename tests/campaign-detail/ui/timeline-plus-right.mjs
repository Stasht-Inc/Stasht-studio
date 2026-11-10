// Chris, 9 Nov 2026 (point 5, images/4.jpg): "add the + options on the right side, and remove it from the left … it
// should be in the same spot everywhere." In the real app (App → Campaigns → campaign page), every API mocked:
//  - 1280 + 1600, owner: the left timeline list has no "+"; the right-hand timeline has a visible "+" under the
//    "Timeline • N moments" header and after every moment card (the last one too), in that order; each opens the Add
//    Widget chooser with the left "+"'s options; picking one saves at that place (after_post_id); "+ Add a Moment" stays.
//  - 1600, collaborator (shared view): the same, with the shared view's own options (no Share Request a Moment / AI Creator).
//  - 390, owner: the phone keeps its own "+" between cards (unchanged); no desktop "+" shows.
//  - Fix round (review I1 + Deepak 10 Nov): at 1280/1366/1440/1600 with the nav open nothing covers the "+" (hit-test +
//    real click opens the chooser), no horizontal scroll; viewer / view see no "+" (desktop or phone), contributor /
//    edit do (same rule as "+ Add a Moment"); Shopify Product is in the desktop chooser like the phone's.
// node tests/campaign-detail/ui/timeline-plus-right.mjs  (CD_BASE = the dev server)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from './cover-fixtures.mjs';
import { DOCUSIGN_ENABLED } from '../../../constants/features.ts';

const { chromium } = pw;
const BASE = process.env.CD_BASE || 'http://localhost:5293';
const OUT = process.env.CD_SHOTS || '/private/tmp/claude-501/campaign-detail-ui/timeline-plus-right';
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
const SHARED = sharedAs('contributor');
const OTHERS = [{ ...CAMPAIGN, id: 701, title: 'Open House Weekend', slug: 'open-house', last_update_img: img(2), posts_count: 4 }];
const W = (id, type, after, order, data) => ({ id, widget_type: type, after_post_id: after, widget_order: order, widget_data: data, admin_approval: 1, is_visible: true, created_at: '2026-11-08 10:00:00' });
const SEEDED = [
  W(5003, 'html', 11, 2, { title: '', content: '<p><strong>Open daily</strong> 9–5</p>' }),
  W(5004, 'cta', 12, 0, { title: '', buttonText: 'Share a Moment', mode: 'request_moment', pinToBottom: true }),
];
// The left "+"'s options before 9 Nov (MemoryDetailsPage, development 2832857): owner view and collaborator view.
// Deepak, 10 Nov 2026: + Shopify Product (the phone "+" menu always offers it), so all three "+" menus match.
const OWNER = ['Moment', 'Call to Action', 'Share Request a Moment', 'Voice to Text', 'HTML', 'Youtube', 'Quote', 'AI Creator', 'Shopify Product', ...(DOCUSIGN_ENABLED ? ['DocuSign'] : [])];
const COLLAB = ['Moment', 'Call to Action', 'Voice to Text', 'HTML', 'Youtube', 'Quote', 'Shopify Product', ...(DOCUSIGN_ENABLED ? ['DocuSign'] : [])];

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height, memory = CAMPAIGN, widgets = SEEDED }) {
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
      return route.fulfill({ json: { status: 'success', data: { memory: { ...memory, posts: [post(11, 1), post(12, 2), post(13, 3)], widgets: [] }, linked_memories: [], unified_order: null } } });
    }
    if (p === '/memories/901/widgets' && m === 'GET') return route.fulfill({ json: { success: true, data: state.widgets } });
    if (p === '/memories/901/widgets' && m === 'POST') {
      const w = { id: state.nextWidget++, widget_type: body.widget_type, after_post_id: body.after_post_id, widget_order: body.widget_order ?? 0, widget_data: body.widget_data, admin_approval: 1, is_visible: true, created_at: '2026-11-08 10:00:00' };
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

async function openCampaign(page) {
  const card = page.getByText(/^Fall Promo/).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(800);
  await card.click();
  await page.getByText('Moment 1').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1800);
}

const chooser = (page) => page.getByTestId('add-widget-chooser');
const pluses = (page) => page.getByTestId('timeline-add-plus').filter({ visible: true });
const plusAt = (page, after) => page.locator(`[data-testid="timeline-add-plus"][data-after-post-id="${after}"]`).filter({ visible: true }).first();
/** The desktop timeline (left list + right cards): [data-timeline-list] of the visible layout. */
const desktop = (page) => page.locator('[data-timeline-list]').filter({ visible: true }).first();
async function inView(page, locator) {
  const box = await locator.first().boundingBox();
  const vp = page.viewportSize();
  return Boolean(box && vp && box.y >= 0 && box.y + box.height <= vp.height + 1 && box.x >= 0 && box.x + box.width <= vp.width + 1);
}
async function openPlus(page, after) {
  const plus = plusAt(page, after);
  await plus.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await plus.getByRole('button', { name: 'Add Widget' }).click();
  await chooser(page).waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
}
const pick = async (page, label) => { await chooser(page).getByRole('menuitem', { name: new RegExp(`^${label}`) }).click(); await page.waitForTimeout(700); };
const labelsOf = (page) => chooser(page).getByRole('menuitem').evaluateAll((els) => els.map((e) => e.querySelector('p')?.textContent?.trim()));
const top = (loc) => loc.boundingBox().then((b) => b?.y ?? NaN).catch(() => NaN);
const bottom = (loc) => loc.boundingBox().then((b) => (b ? b.y + b.height : NaN)).catch(() => NaN);
/** The y of the moment card titled `text` in the right-hand column. */
const cardY = (page, text) => page.locator(`[data-timeline-list] [data-post-id="${{ 'Moment 1': 11, 'Moment 2': 12, 'Moment 3': 13 }[text]}"]`).filter({ visible: true }).first();

try {
  // ── Laptop widths, app nav open (review I1): the fixed Media sidebar used to cover the right-hand column at 1280–1440,
  // so the "+" couldn't be clicked. The page now leaves room for it: the "+" is hit-testable and opens the chooser,
  // both columns sit left of the sidebar and the page has no horizontal scroll. ──────────────────────────────────
  for (const [width, height] of [[1280, 800], [1366, 768], [1440, 900], [1600, 1000]]) {
    const tag = `${width}-layout`;
    const o = await open({ width, height });
    await openCampaign(o.page);
    const page = o.page;
    const left = desktop(page).locator(':scope > div').first();
    const right = desktop(page).locator(':scope > div').nth(1);
    expect(await left.locator('svg.lucide-plus').count() === 0, `${tag}: the left timeline list has no "+"`);
    const afters = await pluses(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-after-post-id')));
    expect(JSON.stringify(afters) === JSON.stringify(['', '11', '12', '13']), `${tag}: right timeline "+" at the top and after every moment (got ${afters})`);
    const geo = await page.evaluate(() => {
      const list = [...document.querySelectorAll('[data-timeline-list]')].find((e) => e.offsetParent);
      const [l, r] = [...list.children].map((c) => c.getBoundingClientRect());
      const aside = document.querySelector('aside.fixed.right-0')?.getBoundingClientRect();
      return { leftW: l.width, rightL: r.left, rightR: r.right, rightW: r.width, asideL: aside ? aside.left : innerWidth, scrollW: document.documentElement.scrollWidth, vw: innerWidth };
    });
    expect(geo.scrollW <= geo.vw, `${tag}: no horizontal scroll (${geo.scrollW} ≤ ${geo.vw})`);
    expect(geo.rightR <= geo.asideL + 1, `${tag}: the right-hand column ends before the Media sidebar (${Math.round(geo.rightR)} ≤ ${Math.round(geo.asideL)})`);
    expect(geo.leftW >= 240 && geo.rightW >= 300, `${tag}: neither column is cramped (left ${Math.round(geo.leftW)}, right ${Math.round(geo.rightW)})`);
    expect(await inView(page, plusAt(page, '')), `${tag}: the top "+" is in the viewport`);
    const btn = plusAt(page, '').getByRole('button', { name: 'Add Widget' });
    const hit = await btn.evaluate((el) => { const b = el.getBoundingClientRect(); const h = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return Boolean(h && el.contains(h)); });
    expect(hit, `${tag}: nothing covers the top "+" (hit-test)`);
    await page.screenshot({ path: `${OUT}/${tag}-01-page.png` });
    await btn.click({ timeout: 5000 }).catch(() => {});
    const opened = await chooser(page).isVisible({ timeout: 3000 }).catch(() => false);
    expect(opened, `${tag}: clicking the top "+" opens the chooser`);
    if (opened) expect(await chooser(page).evaluate((el) => { const b = el.getBoundingClientRect(); const h = document.elementFromPoint(b.x + b.width / 2, b.y + 40); return Boolean(h && el.contains(h)); }), `${tag}: the chooser is on top`);
    await page.screenshot({ path: `${OUT}/${tag}-02-chooser.png` });
    await page.keyboard.press('Escape');
    await chooser(page).waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
    await plusAt(page, '13').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const btn13 = plusAt(page, '13').getByRole('button', { name: 'Add Widget' });
    const hit13 = await btn13.evaluate((el) => { const b = el.getBoundingClientRect(); const h = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return Boolean(h && el.contains(h)); });
    expect(hit13, `${tag}: nothing covers the "+" after the last moment (hit-test)`);
    await btn13.click({ timeout: 5000 }).catch(() => {});
    expect(await chooser(page).isVisible({ timeout: 3000 }).catch(() => false), `${tag}: clicking the "+" after the last moment opens the chooser`);
    await page.screenshot({ path: `${OUT}/${tag}-03-after-last.png` });
    await page.keyboard.press('Escape');
    await chooser(page).waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    // Re-review R1: the Media sidebar is 20rem below 1536px — its Media and Library tab headers must not clip text.
    const aside = page.locator('aside.fixed.right-0').filter({ visible: true }).first();
    const clipped = (root) => root.evaluate((el) => [...el.querySelectorAll('button, h3, span')].filter((b) => b.offsetParent && b.textContent.trim())
      .filter((b) => { const r = b.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(b).lineHeight) || 20;
        return b.scrollWidth > b.clientWidth + 1 || (b.matches('button') && r.height > lh * 1.6 + 16) || r.right > el.getBoundingClientRect().right + 1; })
      .map((b) => b.textContent.trim().slice(0, 30)));
    const mediaHeader = aside.locator('div.flex-shrink-0').nth(1);
    const mediaClipped = await clipped(mediaHeader).catch((e) => [String(e)]);
    expect(mediaClipped.length === 0, `${tag}: Media tab header — nothing clipped or wrapped (got ${JSON.stringify(mediaClipped)})`);
    await aside.getByRole('button', { name: /^Library$/ }).first().click();
    await page.waitForTimeout(500);
    const libHeader = aside.locator('div.flex-shrink-0.p-4.border-b').filter({ hasText: /Library \(/ }).first();
    const libClipped = await clipped(libHeader).catch((e) => [String(e)]);
    expect(libClipped.length === 0, `${tag}: Library tab header — nothing clipped or wrapped (got ${JSON.stringify(libClipped)})`);
    const scanOneLine = await libHeader.getByRole('button', { name: /AI Scan|Scanned|Rescan/ }).first().evaluate((b) => {
      const t = [...b.querySelectorAll('span')].pop() || b; const r = t.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(t).lineHeight) || 20;
      return { oneLine: r.height <= lh * 1.5, fits: b.scrollWidth <= b.clientWidth + 1 && t.getBoundingClientRect().bottom <= b.getBoundingClientRect().bottom + 1 };
    }).catch(() => ({ oneLine: false, fits: false }));
    expect(scanOneLine.oneLine && scanOneLine.fits, `${tag}: "AI Scan" on one line inside its button (${JSON.stringify(scanOneLine)})`);
    const titleOneLine = await libHeader.getByText(/^Library \(/).first().evaluate((t) => t.getBoundingClientRect().height <= (parseFloat(getComputedStyle(t).lineHeight) || 24) * 1.5);
    expect(titleOneLine, `${tag}: "Library (N people)" on one line`);
    await page.screenshot({ path: `${OUT}/${tag}-04-library.png` });
    void right;
    await o.context.close();
  }

  // ── 1600, owner ─────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const tag = '1600-owner';
    const o = await open({ width: 1600, height: 1000 });
    await openCampaign(o.page);
    const page = o.page;
    const list = desktop(page);
    const left = list.locator(':scope > div').first();
    const leftPlus = await left.locator('svg.lucide-plus').count();
    expect(leftPlus === 0, `${tag}: the left timeline list has no "+" (got ${leftPlus})`);
    expect(await left.getByText('Introduction', { exact: true }).isVisible(), `${tag}: the left list still shows Introduction + moments`);
    const afters = await pluses(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-after-post-id')));
    expect(JSON.stringify(afters) === JSON.stringify(['', '11', '12', '13']), `${tag}: right timeline "+" at the top and after every moment, the last too (got ${afters})`);
    const right = list.locator(':scope > div').nth(1);
    expect(await right.getByTestId('timeline-add-plus').count() === 4, `${tag}: …all in the right-hand column`);
    const opacities = await pluses(page).evaluateAll((els) => els.map((e) => getComputedStyle(e.querySelector('button')).opacity));
    expect(opacities.every((x) => x === '1'), `${tag}: always visible, not hover-only (opacity ${opacities})`);
    expect(await inView(page, plusAt(page, '')), `${tag}: the top "+" is in the viewport on load`);
    expect(await page.getByRole('button', { name: /Add a Moment/ }).filter({ visible: true }).count() >= 1, `${tag}: "+ Add a Moment" header button still there`);
    await page.screenshot({ path: `${OUT}/${tag}-01-page.png` });

    // Positions: top "+" above Moment 1; "+" after 11 below Moment 1's HTML widget and above Moment 2; after 13 below Moment 3 and above the pinned button.
    await plusAt(page, '11').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const yHtml = await bottom(right.getByText('Open daily').first());
    const y11 = await top(plusAt(page, '11'));
    const yM2 = await top(cardY(page, 'Moment 2'));
    expect(yHtml < y11 && y11 < yM2, `${tag}: "+" after Moment 1 sits below its widget and above Moment 2 (${yHtml} < ${y11} < ${yM2})`);
    await page.screenshot({ path: `${OUT}/${tag}-02-between.png` });
    await plusAt(page, '13').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const yM3 = await top(cardY(page, 'Moment 3'));
    const y13 = await top(plusAt(page, '13'));
    const yPinned = await top(right.getByRole('button', { name: /Share a Moment/ }).first());
    expect(yM3 < y13 && y13 < yPinned, `${tag}: "+" after the last moment sits below it and above the pinned Share a Moment (${yM3} < ${y13} < ${yPinned})`);
    await page.screenshot({ path: `${OUT}/${tag}-03-after-last.png` });

    // Each "+" opens the chooser with the left "+"'s options.
    for (const after of ['', '11', '12', '13']) {
      await openPlus(page, after);
      const labels = await labelsOf(page);
      expect(JSON.stringify(labels) === JSON.stringify(OWNER), `${tag}: "+" ${after || 'top'} opens the Add Widget chooser with every option (got ${labels})`);
      expect(await inView(page, chooser(page)), `${tag}: "+" ${after || 'top'}: the chooser is in the viewport`);
      if (after === '' || after === '13') await page.screenshot({ path: `${OUT}/${tag}-04-chooser-${after || 'top'}.png` });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Picking an option saves at that place.
    await openPlus(page, '');
    await pick(page, 'Quote');
    const quote = page.getByRole('dialog').filter({ has: page.getByPlaceholder('Enter your quote here...') });
    await quote.getByPlaceholder('Enter your quote here...').fill('Home is where the heart is.');
    await quote.getByRole('button', { name: 'Add Quote' }).click();
    await page.waitForTimeout(1500);
    const q = o.state.widgetPosts.find((b) => b.widget_type === 'quote');
    expect(q && q.after_post_id === null, `${tag}: top "+" → Quote saved at the top (after_post_id ${JSON.stringify(q?.after_post_id)})`);

    await openPlus(page, '12');
    await pick(page, 'Call to Action');
    const cta = page.getByRole('dialog').filter({ hasText: 'Add a title and a button that links somewhere' });
    await cta.getByPlaceholder('e.g. Ready to book your stay?').fill('Ready to visit?');
    await cta.getByPlaceholder('e.g. Book Now').fill('Book a tour');
    await cta.getByPlaceholder('https://example.com').fill('https://example.com/tour');
    await page.screenshot({ path: `${OUT}/${tag}-05-cta-editor.png` });
    await cta.getByRole('button', { name: 'Add Call to Action' }).click();
    await page.waitForTimeout(1500);
    const c = o.state.widgetPosts.find((b) => b.widget_type === 'cta');
    expect(c && String(c.after_post_id) === '12', `${tag}: "+" after Moment 2 → Call to Action saved after Moment 2 (got ${JSON.stringify(c?.after_post_id)})`);

    await openPlus(page, '13');
    await pick(page, 'HTML');
    const html = page.getByRole('dialog').filter({ has: page.getByPlaceholder('Paste your HTML code here...') });
    await html.getByPlaceholder('Paste your HTML code here...').fill('<p>Thanks for visiting</p>');
    await html.getByRole('button', { name: 'Add HTML' }).click();
    await page.waitForTimeout(1500);
    const h = o.state.widgetPosts.find((b) => b.widget_type === 'html');
    expect(h && String(h.after_post_id) === '13', `${tag}: "+" after the last moment → HTML saved after Moment 3 (got ${JSON.stringify(h?.after_post_id)})`);
    const thanks = right.getByText('Thanks for visiting').first();
    await thanks.scrollIntoViewIfNeeded().catch(() => {});
    expect(await thanks.isVisible().catch(() => false), `${tag}: …and shows in the right-hand timeline`);
    await page.screenshot({ path: `${OUT}/${tag}-06-html-after-last.png` });

    // Moment → Add a Moment at that place (Campaigns (optional) links after Moment 1).
    await openPlus(page, '11');
    await pick(page, 'Moment');
    await page.getByRole('heading', { name: 'Add a Moment' }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    await page.locator('#moment-campaigns-toggle').click();
    await page.getByTestId('moment-campaigns').getByRole('checkbox', { name: /Open House Weekend/ }).click();
    await page.screenshot({ path: `${OUT}/${tag}-07-add-moment.png` });
    await page.getByRole('button', { name: 'Add all (1)' }).click();
    await page.waitForTimeout(1800);
    const link = o.state.linkCalls[0];
    expect(link && link.after_item_id === 11 && link.after_item_type === 'post', `${tag}: "+" after Moment 1 → Moment → linked after Moment 1 (got ${JSON.stringify(link)})`);

    // The other options open their editors.
    for (const [label, text] of [['Share Request a Moment', null], ['Youtube', 'Embed YouTube Video'], ['AI Creator', 'AI Creator'], ['Voice to Text', 'Add Voice to Text Memo'], ['Shopify Product', 'Add Shopify Products']]) {
      await openPlus(page, '12');
      await pick(page, label);
      const el = (text ? page.getByText(text, { exact: true }) : page.getByPlaceholder('e.g. Book Now')).filter({ visible: true }).first();
      expect(await el.isVisible().catch(() => false), `${tag}: ${label} opens its editor`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      if (label === 'Shopify Product' && await el.isVisible().catch(() => false)) {
        await el.locator('xpath=../../..').locator(':scope > button').click(); // the picker's ✕
        await page.waitForTimeout(500);
      }
      if (await el.isVisible().catch(() => false)) {
        const close = page.getByRole('button', { name: /^(Cancel|Close)$/ }).filter({ visible: true }).last();
        if (await close.count()) await close.click(); else await page.locator('button:has(svg.lucide-x)').filter({ visible: true }).last().click();
        await page.waitForTimeout(500);
      }
    }
    expect(o.state.widgetPosts.length === 3, `${tag}: only the 3 saved widgets were created (got ${o.state.widgetPosts.length})`);

    // The header's "+ Add a Moment" is unchanged.
    await page.getByRole('button', { name: /Add a Moment/ }).filter({ visible: true }).first().click();
    expect(await page.getByRole('heading', { name: 'Add a Moment' }).isVisible({ timeout: 8000 }).catch(() => false), `${tag}: "+ Add a Moment" still opens Add a Moment`);
    await o.context.close();
  }

  // ── 1600, collaborator (shared view) ────────────────────────────────────────────────────────────────────────────
  {
    const tag = '1600-collaborator';
    const o = await open({ width: 1600, height: 1000, memory: SHARED });
    await openCampaign(o.page);
    const page = o.page;
    const afters = await pluses(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-after-post-id')));
    expect(JSON.stringify(afters) === JSON.stringify(['', '11', '12', '13']), `${tag}: right timeline "+" at the top and after every moment (got ${afters})`);
    const leftPlus = await page.locator('svg.lucide-plus').filter({ visible: true }).evaluateAll((els) => els.filter((e) => !e.closest('[data-testid="timeline-add-plus"]')).length);
    const leftHidden = await page.locator('svg.lucide-plus').evaluateAll((els) => els.filter((e) => !e.closest('[data-testid="timeline-add-plus"]') && e.closest('.group\\/border')).length);
    expect(leftHidden === 0, `${tag}: the left timeline list has no "+" (hover "+" left: ${leftHidden}; other visible plus icons: ${leftPlus})`);
    await page.screenshot({ path: `${OUT}/${tag}-01-page.png` });
    await openPlus(page, '12');
    const labels = await labelsOf(page);
    expect(JSON.stringify(labels) === JSON.stringify(COLLAB), `${tag}: the chooser offers the shared view's options (got ${labels})`);
    await page.screenshot({ path: `${OUT}/${tag}-02-chooser.png` });
    await pick(page, 'Quote');
    const quote = page.getByRole('dialog').filter({ has: page.getByPlaceholder('Enter your quote here...') });
    await quote.getByPlaceholder('Enter your quote here...').fill('Shared quote');
    await quote.getByRole('button', { name: 'Add Quote' }).click();
    await page.waitForTimeout(1500);
    const q = o.state.widgetPosts.find((b) => b.widget_type === 'quote');
    expect(q && String(q.after_post_id) === '12', `${tag}: Quote saved after Moment 2 (got ${JSON.stringify(q?.after_post_id)})`);
    await o.context.close();
  }

  // ── Deepak, 10 Nov 2026: view-only people get no "+"; contributor / edit (who get "+ Add a Moment") do ──────────
  for (const [role, canAdd] of [['viewer', false], ['view', false], ['edit', true], ['contributor', true]]) {
    for (const [width, height] of [[1600, 1000], [390, 844]]) {
      const tag = `${width}-${role}`;
      const o = await open({ width, height, memory: sharedAs(role) });
      await openCampaign(o.page);
      const page = o.page;
      const desk = await pluses(page).count();
      const phone = await page.locator('button:has(path[d="M12 5v14M5 12h14"])').filter({ visible: true }).count();
      if (width >= 1024) expect(canAdd ? desk === 4 : desk === 0, `${tag}: ${canAdd ? 'sees' : 'no'} timeline "+" (got ${desk})`);
      else expect(canAdd ? phone >= 2 : phone === 0, `${tag}: ${canAdd ? 'sees' : 'no'} phone "+" dividers (got ${phone})`);
      const addMoment = await page.getByRole('button', { name: /Add a Moment/ }).filter({ visible: true }).count();
      if (width >= 1024) expect((addMoment > 0) === canAdd, `${tag}: same rule as "+ Add a Moment" (shown: ${addMoment > 0})`);
      if (role === 'viewer') await page.screenshot({ path: `${OUT}/${tag}-01-no-plus.png` });
      await o.context.close();
    }
  }

  // ── 390, owner: the phone keeps its own "+" between cards ───────────────────────────────────────────────────────
  {
    const tag = '390-owner';
    const o = await open({ width: 390, height: 844 });
    await openCampaign(o.page);
    const page = o.page;
    expect(await pluses(page).count() === 0, `${tag}: no desktop "+" on the phone`);
    const dividers = page.locator('button:has(path[d="M12 5v14M5 12h14"])').filter({ visible: true });
    const n = await dividers.count();
    expect(n >= 2, `${tag}: the phone's own "+" dividers are still there (got ${n})`);
    await dividers.first().scrollIntoViewIfNeeded();
    await dividers.first().click();
    await page.waitForTimeout(400);
    const moment = page.locator('button').filter({ hasText: /^Moment/ }).filter({ visible: true }).first();
    expect(await moment.isVisible().catch(() => false), `${tag}: tapping it opens the phone's mini-menu (unchanged)`);
    await page.screenshot({ path: `${OUT}/${tag}-01-phone-plus.png` });
    await o.context.close();
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall timeline "+" checks passed');
process.exit(failures.length ? 1 : 0);
