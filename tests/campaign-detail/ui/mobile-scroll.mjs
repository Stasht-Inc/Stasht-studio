// Chris, 9 Nov 2026 — phone scrolling (points 2, 4, 7), in the real app at 390×844 (+ 1280 unchanged):
//  7. Campaign page → Send opens Edit Campaign FULL screen at the Send step, even when window.visualViewport is
//     stale/short (iOS after the keyboard closes, home-screen app); dragging/scrolling inside the sheet doesn't trigger
//     the campaign page's pull-to-refresh (no refetch) and scrollTop never jumps; the keyboard behaviour (the sheet
//     follows the visual viewport while a text field is focused — 36434ce) still works.
//  4. Campaign page top bar Back · Edit Cover · ⋯ · Send stays pinned at the top while scrolling (one bar, white once
//     the cover has gone by), every button still works; the campaign bottom nav stays at the bottom.
//  2. Media page: the bottom nav's bottom edge stays at the viewport bottom while scrolling, also after the search
//     field's keyboard closes (and the recovery nudge doesn't move the page).
// ENGINE=chromium|webkit node tests/campaign-detail/ui/mobile-scroll.mjs   (dev server: CD_BASE, default :5292)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from './cover-fixtures.mjs';

const ENGINE = process.env.ENGINE || 'chromium';
const BASE = process.env.CD_BASE || 'http://localhost:5292';
const OUT = process.env.CD_SHOTS || `/private/tmp/claude-501/campaign-detail-ui/mobile-scroll/${ENGINE}`;
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 70, external_user_id: 707, name: 'Main Dealer', email: 'main@dealer.test', role: '2', status: 1, is_activated: true, profile_color: '#1D4ED8' };
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="${['#6C60FF', '#F59E0B', '#10B981'][n % 3]}"/></svg>`;
const img = (n) => `${BASE}/cd-img/${n}.jpg`;
const post = (id, n) => ({
  id, name: `Moment ${n}`, title: `Moment ${n}`, description: '', master_image_link: img(n), image_link: img(n), media_url: img(n),
  capture_date: `2026-10-1${n % 10} 10:00:00`, uploaded_at: `2026-10-1${n % 10} 10:00:00`, parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [],
});
const CAMPAIGN = {
  id: 901, title: 'Hyundai show room lights', user_id: 707, slug: 'hyundai-lights', category: { id: 5, name: 'Personal' }, sub_category: null, photos: { count: 8 },
  collaborators: [], user: { id: 707, name: 'KHB Electric Inc.' }, created_at: '2026-11-09 10:00:00', location: 'Newmarket Hyundai', tags: [],
  min_uploaded_img_date: '2026-11-09', max_uploaded_img_date: '2026-11-09', last_update_img: null, share_message: null, published: 0, published_url: null,
};
const media = (n) => ({ id: String(500 + n), image_url: img(n), name: `IMG_42${60 + n}.jpg`, size: '0.16 MB', dimensions: '1200x647', capture_date: '2025-09-05', created_at: '2025-09-05 10:00:00', updated_at: '2025-09-05 10:00:00' });

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await pw[ENGINE].launch(ENGINE === 'chromium' ? { headless: true, channel: 'chrome' } : { headless: true });

async function open({ width, height }, path = '/memories') {
  const state = { detailGets: 0, apiCalls: 0 };
  const phone = width < 768;
  const context = await browser.newContext({
    viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US',
    ...(phone ? { hasTouch: true, isMobile: ENGINE !== 'firefox', deviceScaleFactor: 3, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' } : {}),
  });
  // A controllable visualViewport height: window.__vvH (null = the real one). iOS can leave it short after the
  // keyboard closes; tests set it to fake that (520) and the keyboard itself (500 while a field is focused).
  await context.addInitScript(() => {
    window.__vvH = null;
    const vv = window.visualViewport;
    if (!vv) return;
    const proto = Object.getPrototypeOf(vv);
    const real = Object.getOwnPropertyDescriptor(proto, 'height')?.get;
    try { Object.defineProperty(vv, 'height', { configurable: true, get: () => (window.__vvH ?? real.call(vv)) }); } catch { /* ignore */ }
  });
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('cd-seeded')) return;
    sessionStorage.setItem('cd-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'main-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels');
    localStorage.setItem('pwa-install-dismissed', '1'); // Chris uses the home-screen app: no install banner
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
    state.apiCalls++;
    const p = url.pathname.replace(/^\/api\/react/, '');
    const m = req.method();
    let body = null;
    try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch { body = null; }
    if (p === '/memories' && m === 'GET') {
      const all = [CAMPAIGN];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Personal', memory_count: 1 }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories/901' && m === 'GET') {
      state.detailGets++;
      return route.fulfill({ json: { status: 'success', data: { memory: { ...CAMPAIGN, posts: Array.from({ length: 8 }, (_, i) => post(11 + i, i + 1)), linked_memories: [], widgets: [], unified_order: null } } } });
    }
    if (p === '/memory-images' || p.startsWith('/memory-images?')) {
      return route.fulfill({ json: { categories_media: { Personal: [{ memory_id: 901, memory_title: 'Residential - New Build', memory_image: null, memory_size: null }, ...Array.from({ length: 16 }, (_, i) => ({ ...media(i), media_id: 500 + i, memory_id: 901, memory_title: 'Residential - New Build', media_url: img(i), media_size: '0.16 MB' }))] }, unassigned_media: [] } });
    }
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 5, name: 'Personal', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/memories/901/storeel-audience-count') {
      const ch = body?.channels ?? [];
      return route.fulfill({ json: { success: true, data: { email: ch.includes('email') ? 1 : 0, sms: ch.includes('sms') ? 1 : 0, skipped: { no_email: 0, no_phone: 0, unsubscribed: 0, duplicate: 0 }, person: { email: null, sms: null, errors: {} } }, storeel: { max_messages: 1000, needed: ch.length, over_limit: false, sms: null, allowance: { plan: 'Professional', email_limit: 2500, sms_limit: 250, email_used: 0, sms_used: 0, email_pending: 0, sms_pending: 0, resets_at: '2026-12-01T05:00:00Z' } } } });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 1, memory_limit: 50 } } } });
    if (p === '/lead-groups') return route.fulfill({ json: { groups: [] } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}${path}`);
  return { context, page, state };
}

async function openCampaign(page) {
  const card = page.getByText(/^Hyundai show room lights/).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 40000 });
  await page.waitForTimeout(800);
  await card.click();
  await page.getByText('Moment 1').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

const flow = (page) => page.getByRole('dialog', { name: 'Edit Campaign' });
const inViewport = async (page, loc) => {
  const box = await loc.boundingBox().catch(() => null);
  const vp = page.viewportSize();
  return Boolean(box && box.y >= -1 && box.x >= -1 && box.y + box.height <= vp.height + 1 && box.x + box.width <= vp.width + 1);
};
// The phone top bar's four buttons (Chris's 3.jpg): Back · Edit Cover · ⋯ · Send.
const bar = {
  back: (page) => page.getByRole('button', { name: 'Back', exact: true }).filter({ visible: true }).first(),
  editCover: (page) => page.locator('label').filter({ hasText: 'Edit Cover' }).filter({ visible: true }).first(),
  more: (page) => page.locator('label:has-text("Edit Cover") + button').filter({ visible: true }).first(),
  send: (page) => page.getByRole('button', { name: 'Send', exact: true }).filter({ visible: true }).first(),
};
const settle = (page, ms = 350) => page.waitForTimeout(ms);
const scrollTo = async (page, y) => { await page.evaluate((top) => window.scrollTo(0, top), y); await settle(page); };
// A finger drag (touchstart → moves → touchend) starting on `selector`. Chromium: real touches via CDP (they scroll
// and reach React like a finger); WebKit: synthetic touch events with `touches` (React's handlers read those).
const drag = async (page, selector, fromY, toY) => {
  const pt = await page.evaluate(([sel, y]) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().height > 0);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(Math.min(Math.max(r.left + 40, 20), window.innerWidth - 20)), y };
  }, [selector, fromY]);
  if (!pt) return false;
  await page.evaluate(() => {
    window.__pullShown = false;
    window.__pullObs?.disconnect();
    window.__pullObs = new MutationObserver(() => { if (document.querySelector('.fixed.top-20.z-\\[60\\]')) window.__pullShown = true; });
    window.__pullObs.observe(document.body, { childList: true, subtree: true });
  });
  if (ENGINE === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    const tp = (y) => [{ x: pt.x, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(fromY) });
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(Math.round(fromY + ((toY - fromY) * i) / 8)) }); await page.waitForTimeout(30); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    return true;
  }
  return page.evaluate(async ([x, a, b]) => {
    const el = document.elementFromPoint(x, a);
    if (!el) return false;
    const fire = (type, y) => {
      const ev = new Event(type, { bubbles: true, cancelable: true, composed: true });
      const t = [{ identifier: 1, target: el, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y }];
      Object.defineProperty(ev, 'touches', { value: type === 'touchend' ? [] : t });
      Object.defineProperty(ev, 'targetTouches', { value: type === 'touchend' ? [] : t });
      Object.defineProperty(ev, 'changedTouches', { value: t });
      el.dispatchEvent(ev);
    };
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    fire('touchstart', a);
    await frame();
    for (let i = 1; i <= 6; i++) { fire('touchmove', a + ((b - a) * i) / 6); await frame(); }
    fire('touchend', b);
    return true;
  }, [pt.x, fromY, toY]);
};
const setVV = (page, h) => page.evaluate((v) => { window.__vvH = v; window.visualViewport?.dispatchEvent(new Event('resize')); }, h);
const sheetBox = (page) => page.evaluate(() => {
  const d = document.querySelector('[role="dialog"][aria-labelledby="storeel-create-title"]');
  if (!d) return null;
  const r = d.getBoundingClientRect();
  const pts = [[195, window.innerHeight - 4], [8, window.innerHeight / 2], [window.innerWidth - 8, window.innerHeight - 40], [195, window.innerHeight * 0.75]];
  const covered = pts.every(([x, y]) => { const hit = document.elementFromPoint(x, y); return Boolean(hit && d.contains(hit)); });
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), innerHeight: window.innerHeight, covered };
});

try {
  // ── 390: campaign page top bar (4) + Send sheet (7) ─────────────────────────────────────────────────────────────
  {
    const tag = `${ENGINE}-390`;
    const { page, state } = await open({ width: 390, height: 844 });
    await openCampaign(page);
    await page.screenshot({ path: `${OUT}/${tag}-01-campaign-top.png` });
    const maxY = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(maxY > 1200, `${tag}: the campaign page scrolls (max scrollY ${maxY})`);
    for (const y of [0, 300, 900, maxY]) {
      await scrollTo(page, y);
      const ok = await Promise.all(Object.values(bar).map((f) => inViewport(page, f(page))));
      const backBox = await bar.back(page).boundingBox().catch(() => null);
      expect(ok.every(Boolean) && backBox && backBox.y < 40, `${tag}: scrollY ${y}: Back, Edit Cover, ⋯, Send all in view, pinned at the top (Back y=${backBox?.y?.toFixed(0)}; ${ok})`);
      const sendHit = await bar.send(page).evaluate((b) => { const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return Boolean(hit && b.contains(hit)); }).catch(() => false);
      expect(sendHit, `${tag}: scrollY ${y}: Send is on top (nothing covers it)`);
      const whiteHeaders = await page.locator('div.fixed.top-0.bg-white:not([data-campaign-phone-bar])').filter({ visible: true }).count();
      expect(whiteHeaders === 0, `${tag}: scrollY ${y}: one bar only — the old white header isn't stacked on it (${whiteHeaders})`);
      const nav = await page.evaluate(() => { const n = [...document.querySelectorAll('nav.fixed.bottom-0')].find((e) => e.getBoundingClientRect().height > 0); return n ? Math.round(n.getBoundingClientRect().bottom) : null; });
      expect(nav === 844, `${tag}: scrollY ${y}: campaign bottom nav bottom edge at the viewport bottom (${nav})`);
    }
    // Mid-page, a downward drag on the campaign page is a scroll, not a pull-to-refresh (the window scrolls).
    await scrollTo(page, 900);
    const getsMid = state.detailGets;
    await drag(page, 'main', 300, 620);
    await page.waitForTimeout(1500);
    expect(!(await page.evaluate(() => window.__pullShown)), `${tag}: a downward drag mid-page doesn't start the pull-to-refresh (no spinner)`);
    expect(state.detailGets === getsMid, `${tag}: a downward drag mid-page doesn't refetch the campaign (${getsMid} → ${state.detailGets})`);
    await scrollTo(page, maxY);
    const barBg = await bar.back(page).evaluate((b) => { let el = b; while (el && getComputedStyle(el).position !== 'fixed') el = el.parentElement; return el ? getComputedStyle(el).backgroundColor : null; });
    expect(/^rgba?\(255, 255, 255(, 0\.9\d+)?\)$/.test(barBg ?? ''), `${tag}: once the cover has scrolled away the bar is white (readable) (${barBg})`);
    await page.screenshot({ path: `${OUT}/${tag}-02-campaign-scrolled-bar.png` });
    await scrollTo(page, 200);
    const barBgTop = await bar.back(page).evaluate((b) => { let el = b; while (el && getComputedStyle(el).position !== 'fixed') el = el.parentElement; return el ? getComputedStyle(el).backgroundColor : null; });
    expect(barBgTop === 'rgba(0, 0, 0, 0)', `${tag}: over the cover the bar stays transparent (${barBgTop})`);
    await page.screenshot({ path: `${OUT}/${tag}-03-campaign-over-cover.png` });

    // The pinned ⋯ still opens the cover menu, with Edit Campaign (the white header's ⋯) in it.
    await scrollTo(page, maxY);
    await bar.more(page).click();
    await settle(page, 400);
    for (const t of ['Record a Video', 'Add from Media Library', 'YouTube Video', 'Edit Campaign']) {
      expect(await page.getByText(t, { exact: true }).filter({ visible: true }).count() > 0, `${tag}: pinned ⋯ menu offers "${t}"`);
    }
    await page.screenshot({ path: `${OUT}/${tag}-04-pinned-more-menu.png` });
    await page.keyboard.press('Escape').catch(() => {});
    await page.mouse.click(200, 600);
    await settle(page, 300);

    // 7: a stale/short visualViewport (keyboard closed but iOS still reports 520) — Send from the pinned bar.
    await setVV(page, 520);
    const getsBefore = state.detailGets;
    await bar.send(page).click();
    await flow(page).locator('#st-step-send').waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1200);
    let box = await sheetBox(page);
    expect(box && box.top === 0 && box.bottom === 844 && box.covered, `${tag}: Send opens Edit Campaign FULL screen even with a stale 520px visualViewport (${JSON.stringify(box)})`);
    expect(await inViewport(page, flow(page).locator('#st-step-send-title')), `${tag}: it opens at the Send step (heading in view)`);
    await page.screenshot({ path: `${OUT}/${tag}-05-send-sheet-full-stale-vv.png` });

    // Drags inside the sheet don't reach the campaign page's pull-to-refresh.
    await drag(page, '#st-step-send', 200, 600);
    await page.waitForTimeout(1500);
    expect(state.detailGets === getsBefore, `${tag}: dragging down inside the sheet doesn't refetch the campaign (${getsBefore} → ${state.detailGets})`);
    expect(!(await page.evaluate(() => window.__pullShown)), `${tag}: dragging inside the sheet doesn't start the campaign page's pull-to-refresh (no spinner)`);

    // Scrolling inside the sheet: steady steps, no jumps; the sheet keeps its box; the scroller contains overscroll.
    const steps = await page.evaluate(async () => {
      const d = document.querySelector('[role="dialog"][aria-labelledby="storeel-create-title"]');
      const sc = d.querySelector(':scope > div.overflow-y-auto');
      const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      const out = [Math.round(sc.scrollTop)];
      for (let i = 0; i < 8; i++) { sc.scrollBy(0, -80); window.visualViewport?.dispatchEvent(new Event('scroll')); await frame(); out.push(Math.round(sc.scrollTop)); }
      for (let i = 0; i < 8; i++) { sc.scrollBy(0, 120); await frame(); out.push(Math.round(sc.scrollTop)); }
      return { out, overscroll: getComputedStyle(sc).overscrollBehaviorY, h: Math.round(d.getBoundingClientRect().height) };
    });
    const up = steps.out.slice(0, 9); const down = steps.out.slice(8);
    const steadyUp = up.every((v, i) => i === 0 || (v <= up[i - 1] && (up[i - 1] - v === 80 || v === 0)));
    const steadyDown = down.every((v, i) => i === 0 || (v >= down[i - 1] && v - down[i - 1] <= 120));
    expect(steadyUp && steadyDown, `${tag}: scrolling the sheet moves in steady steps, no jumps (${steps.out.join(',')})`);
    expect(steps.overscroll === 'contain', `${tag}: the sheet's scroller contains overscroll (no scroll chaining to the page) (${steps.overscroll})`);
    expect(steps.h === 844, `${tag}: the sheet keeps its full height while scrolling (${steps.h})`);
    expect(state.detailGets === getsBefore, `${tag}: no campaign refetch while scrolling the sheet (${state.detailGets - getsBefore})`);

    // 36434ce kept: while a text field is focused (keyboard up) the sheet follows the visual viewport; after, full again.
    const email = flow(page).getByPlaceholder('name@example.com').first();
    if (await email.count()) {
      await email.scrollIntoViewIfNeeded();
      await email.focus();
      await setVV(page, 500);
      await page.waitForTimeout(400);
      box = await sheetBox(page);
      expect(box && box.height === 500, `${tag}: keyboard up (text field focused, 500px visual viewport): the sheet follows it (${box?.height})`);
      await page.screenshot({ path: `${OUT}/${tag}-06-send-sheet-keyboard.png` });
      await email.evaluate((e) => e.blur());
      await setVV(page, 520); // keyboard closed, iOS still says 520
      await page.waitForTimeout(400);
      box = await sheetBox(page);
      expect(box && box.height === 844 && box.covered, `${tag}: keyboard closed with a stale viewport: full screen again (${JSON.stringify(box)})`);
    } else {
      expect(false, `${tag}: Send card has the email field`);
    }
    await page.screenshot({ path: `${OUT}/${tag}-07-send-sheet-after-keyboard.png` });
    await setVV(page, null);
    await page.close();
  }

  // ── 1280: unchanged desktop ─────────────────────────────────────────────────────────────────────────────────
  {
    const tag = `${ENGINE}-1280`;
    const { page } = await open({ width: 1280, height: 900 });
    await openCampaign(page);
    expect(!(await page.locator('label').filter({ hasText: 'Edit Cover' }).filter({ visible: true }).count()), `${tag}: no phone cover bar on desktop`);
    const sendBtn = page.getByRole('button', { name: 'Send', exact: true }).filter({ visible: true }).first();
    expect(await inViewport(page, sendBtn), `${tag}: desktop Send in view`);
    await page.screenshot({ path: `${OUT}/${tag}-01-campaign.png` });
    await sendBtn.click();
    await flow(page).locator('#st-step-send').waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const box = await sheetBox(page);
    expect(box && box.top === 0 && box.bottom === 900, `${tag}: Edit Campaign fills the window as before (${JSON.stringify(box)})`);
    await page.screenshot({ path: `${OUT}/${tag}-02-send-sheet.png` });
    await page.close();
  }

  // ── 390: Media page bottom nav (2) ───────────────────────────────────────────────────────────────────────────
  {
    const tag = `${ENGINE}-390-media`;
    const { page } = await open({ width: 390, height: 844 }, '/media');
    await page.locator('nav.fixed.bottom-0').filter({ visible: true }).first().waitFor({ timeout: 40000 });
    await page.getByText('IMG_4260.jpg').first().waitFor({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    const navBottom = () => page.evaluate(() => { const n = [...document.querySelectorAll('nav.fixed.bottom-0')].find((e) => e.getBoundingClientRect().height > 0); return n ? Math.round(n.getBoundingClientRect().bottom) : null; });
    const maxY = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(maxY > 600, `${tag}: Media scrolls (max ${maxY})`);
    for (const y of [0, Math.round(maxY / 2), maxY]) {
      await scrollTo(page, y);
      const b = await navBottom();
      expect(b === 844, `${tag}: scrollY ${y}: bottom nav bottom edge == viewport bottom (${b})`);
    }
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(sw <= 390, `${tag}: no horizontal overflow (scrollWidth ${sw})`);
    // Search → keyboard → close: the page doesn't move (the recovery nudge puts it back), the bar stays put.
    await scrollTo(page, Math.round(maxY / 2));
    const search = page.getByPlaceholder('Search media files, campaigns...').first();
    const yBefore = await page.evaluate(() => Math.round(window.scrollY));
    await search.evaluate((e) => e.focus({ preventScroll: true }));
    await setVV(page, 520);
    await page.waitForTimeout(200);
    await search.evaluate((e) => e.blur());
    await setVV(page, null);
    await page.waitForTimeout(900);
    const yAfter = await page.evaluate(() => Math.round(window.scrollY));
    expect(Math.abs(yAfter - yBefore) <= 1, `${tag}: closing the keyboard leaves the page where it was (${yBefore} → ${yAfter})`);
    expect((await navBottom()) === 844, `${tag}: after the keyboard closes the bottom nav is at the bottom (${await navBottom()})`);
    await page.screenshot({ path: `${OUT}/${tag}-01-media-scrolled.png` });
    // Home-screen app (display-mode: standalone) — Chromium only (CDP media emulation).
    if (ENGINE === 'chromium') {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: 'standalone' }] }).catch(() => {});
      const standalone = await page.evaluate(() => matchMedia('(display-mode: standalone)').matches);
      await scrollTo(page, maxY);
      const b = await navBottom();
      expect(!standalone || b === 844, `${tag}: home-screen app (standalone=${standalone}): bottom nav still at the bottom (${b})`);
      await page.screenshot({ path: `${OUT}/${tag}-02-media-standalone.png` });
    }
    await page.close();
  }
} catch (e) {
  failures.push(`threw: ${e.message}`);
  console.log(e);
}

await browser.close();
if (pageErrors.length) console.log('page errors:', [...new Set(pageErrors)].slice(0, 8));
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
