// Chris, 8 Nov 2026 (point 3, images/200.jpg): a product moment's "View on website" button sits INSIDE the product's
// moment card, under its details — no second card repeating the title — on the campaign page and the published page.
// A product's button is the widget the API marks in_card (old product moments: the memory_catalog_items link; new
// ones: also widget_data.placement). The owner's own Call to Action widgets — even one that says "View on website" —
// still render as their own cards. The owner keeps Edit / Delete (phone: the ⋮ beside the button; desktop: sidebar).
// In the real app at 1280 and 390. node tests/campaign-detail/ui/product-card-button.mjs  (CD_BASE = the dev server)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from './cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.CD_BASE || 'http://localhost:5321';
const OUT = process.env.CD_SHOTS || '/private/tmp/claude-501/campaign-detail-ui/product-card-button';
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 70, external_user_id: 707, name: 'TheRoyalWoodShop', email: 'shop@royalwood.test', role: '2', status: 1, is_activated: true, profile_color: '#1D4ED8' };
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="${['#6C60FF', '#F59E0B', '#10B981'][n % 3]}"/></svg>`;
const img = (n) => `${BASE}/cd-img/${n}.jpg`;
const HINGE = '3-1/2 Ball Bearing Sq Butt Hinge Nickel';
const post = (id, n, title, description, after) => ({
  id, name: title, title, description, master_image_link: img(n), image_link: img(n), media_url: img(n), location: 'royalwoodshop.com',
  capture_date: `2026-11-0${n} 10:00:00`, uploaded_at: `2026-11-0${n} 10:00:00`, parent_id: null, after_post_id: after, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [], user: { id: 707, name: 'TheRoyalWoodShop' },
});
const POSTS = [
  post(21, 1, HINGE, '3-1/2″ Ball Bearing Sq Butt Hinge Nickel', null),        // a product made after 8 Nov (placement key)
  post(22, 2, 'Oak Table', 'Solid oak, seats six.\nPrice: $1,299 CAD', 21),      // a product made before (only the API's in_card)
  post(23, 3, 'Our showroom', 'Come and see us.', 22),                          // an ordinary photo
];
const cta = (id, after, data, inCard) => ({
  id, memory_id: 901, widget_type: 'cta', after_post_id: after, widget_order: id === 504 ? 1 : 0, is_visible: true, admin_approval: 1, in_card: inCard,
  widget_data: { buttonText: 'View on website', icon: 'ExternalLink', ...data }, created_at: '2026-11-07T10:00:00Z', updated_at: '2026-11-07T10:00:00Z',
});
const WIDGETS = [
  cta(501, 21, { title: HINGE, buttonLink: 'https://royalwoodshop.com/product/hinge', placement: 'in_card' }, true),
  // The owner styled this one: 240px wide, no icon (review M3: both must survive in the card).
  cta(502, 22, { title: '$1,299 CAD', buttonLink: 'https://royalwoodshop.com/product/oak-table', buttonWidth: 240, icon: '' }, true),
  cta(503, 23, { title: 'Book a visit', buttonText: 'Book now', buttonLink: 'https://royalwoodshop.com/book', icon: 'Calendar' }, false),
  cta(504, 21, { title: 'Ask about bulk pricing', buttonLink: 'https://royalwoodshop.com/bulk' }, false), // the owner's own, same words
];
const CAMPAIGN = {
  id: 901, title: 'Hinges and Tables', user_id: 707, published: 1, slug: 'hinges-and-tables', category: { id: 5, name: 'Campaigns' }, sub_category: null, photos: { count: 3 },
  collaborators: [], user: { id: 707, name: 'TheRoyalWoodShop', is_business: 0 }, created_at: '2026-11-01 10:00:00', location: 'royalwoodshop.com', tags: [],
  min_uploaded_img_date: '2026-11-01', max_uploaded_img_date: '2026-11-07', last_update_img: img(0),
};
const DETAIL = { ...CAMPAIGN, posts: POSTS, linked_memories: [], unified_order: null };
// The same campaign opened by a collaborator with edit rights (another account owns it): the shared view.
const SHARED_CAMPAIGN = { ...CAMPAIGN, user_id: 808, user: { id: 808, name: 'TheRoyalWoodShop', is_business: 0 } };
const SHARED_DETAIL = { ...DETAIL, ...SHARED_CAMPAIGN, collaborator: [{ id: 1, user_id: 707, status: 1, permission: 'edit', role: 'edit', user: { id: 70, email: MAIN.email, name: MAIN.name } }] };

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function newContext(width, height, state, shared = false) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('cd-seeded')) return;
    sessionStorage.setItem('cd-seeded', '1');
    localStorage.clear();
    if (location.pathname.startsWith('/published-memory')) return; // a visitor
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
    if (p === '/memories' && m === 'GET') {
      const c = shared ? SHARED_CAMPAIGN : CAMPAIGN;
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: [c], total: 1 }, latest_memories: [c], sidebar: { categories: { items: [{ id: 5, name: 'Campaigns', memory_count: 1 }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories/901' && m === 'GET') return route.fulfill({ json: { status: 'success', data: { memory: shared ? SHARED_DETAIL : DETAIL } } });
    if (/^\/memories\/901\/widgets\/\d+$/.test(p) && m === 'PUT') { state.puts.push({ path: p, body: JSON.parse(req.postData() || 'null') }); return route.fulfill({ json: { success: true } }); }
    if (p === '/memories/901/widgets' && m === 'GET') return route.fulfill({ json: { success: true, data: WIDGETS } });
    if (/^\/memories\/901\/widgets\/\d+\/track-click$/.test(p)) { state.clicks.push(p); return route.fulfill({ json: { success: true } }); }
    if (p === '/published-memories') return route.fulfill({ json: { success: true, data: { memory: { ...DETAIL, widgets: WIDGETS }, order_by: 'asc' } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('popup', (p) => p.close().catch(() => {}));
  return { context, page };
}

const visible = (page, sel) => page.locator(sel).filter({ visible: true });

/**
 * The in-card button for this widget: visible, inside the moment's card (the nearest ancestor holding the moment's
 * photo, and no CTA widget card), below the photo and the moment's text, in the viewport once scrolled to.
 */
async function checkInCard(page, tag, widgetId, imgN, text, href) {
  const btn = visible(page, `[data-product-card-button="${widgetId}"]`).first();
  if (!(await btn.count())) { expect(false, `${tag}: product button ${widgetId} shows`); return; }
  await btn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const info = await btn.evaluate((el, [n, t]) => {
    let card = el.parentElement;
    while (card && !card.querySelector(`img[src*="/cd-img/${n}.jpg"]`)) card = card.parentElement;
    const a = el.querySelector('a');
    const pic = card?.querySelector(`img[src*="/cd-img/${n}.jpg"]`);
    const r = el.getBoundingClientRect();
    return {
      inCard: !!card && !card.querySelector('[data-cta-widget-id]') && card.querySelectorAll('[data-product-card-button]').length === 1 && card.textContent.includes(t),
      below: !!pic && pic.getBoundingClientRect().bottom <= r.top + 1,
      href: a?.getAttribute('href'), label: a?.textContent.trim(),
      inView: r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth,
    };
  }, [imgN, text]);
  expect(info.inCard, `${tag}: ${widgetId}'s button is inside the product's own card with its details (no CTA card in it)`);
  expect(info.below, `${tag}: ${widgetId}'s button is under the product's photo and details`);
  expect(info.href === href && info.label === 'View on website', `${tag}: ${widgetId} links to ${href} (${info.href}, "${info.label}")`);
  expect(info.inView, `${tag}: ${widgetId}'s button is in the viewport when scrolled to`);
}

/** Review M3: the owner's width (240px) and "no icon" survive in the card. */
async function checkStyle(page, tag) {
  const st = await visible(page, '[data-product-card-button="502"]').first().locator('a').evaluate((a) => ({ w: Math.round(a.getBoundingClientRect().width), icons: a.querySelectorAll('svg').length }));
  expect(Math.abs(st.w - 240) <= 1, `${tag}: the owner's button width (240px) is kept (${st.w})`);
  expect(st.icons === 0, `${tag}: the owner's "no icon" is kept (${st.icons} icons)`);
}

async function noSeparateCards(page, tag) {
  expect(!(await visible(page, '[data-cta-widget-id="501"]').count()) && !(await visible(page, '[data-cta-widget-id="502"]').count()), `${tag}: no separate card for either product's button`);
  // The old card's heading repeated the product title / price: neither is a heading anywhere now.
  const headings = await page.locator('h3').filter({ visible: true }).allTextContents();
  expect(!headings.includes(HINGE) && !headings.includes('$1,299 CAD'), `${tag}: no repeated product title / price heading (${JSON.stringify(headings.slice(0, 6))})`);
}

try {
  for (const [width, height] of [[1280, 900], [390, 844], [1600, 1000]]) {
    const tag = String(width);
    // ── Campaign page (owner) ──────────────────────────────────────────────────────────────────────────────
    {
      const state = { clicks: [], puts: [] };
      const { context, page } = await newContext(width, height, state);
      await page.goto(`${BASE}/memories`);
      const card = page.getByText('Hinges and Tables', { exact: true }).filter({ visible: true }).first();
      await card.waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForTimeout(800);
      await card.click();
      await page.getByText('Our showroom').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUT}/campaign-${tag}-top.png` });
      await checkInCard(page, `campaign ${tag}`, 501, 1, 'Ball Bearing Sq Butt Hinge Nickel', 'https://royalwoodshop.com/product/hinge');
      await page.screenshot({ path: `${OUT}/campaign-${tag}-new-style-product.png` });
      await checkInCard(page, `campaign ${tag}`, 502, 2, 'Solid oak, seats six.', 'https://royalwoodshop.com/product/oak-table');
      await page.screenshot({ path: `${OUT}/campaign-${tag}-old-style-product.png` });
      await checkStyle(page, `campaign ${tag}`);
      await noSeparateCards(page, `campaign ${tag}`);
      // The owner's own Call to Action widgets are untouched: their own cards, with their titles.
      for (const [id, t] of [[503, 'Book a visit'], [504, 'Ask about bulk pricing']]) {
        const c = visible(page, `[data-cta-widget-id="${id}"]`);
        expect((await c.count()) === 1 && (await c.first().textContent()).includes(t), `campaign ${tag}: the owner's CTA "${t}" is still its own card`);
      }
      await visible(page, '[data-cta-widget-id="504"]').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/campaign-${tag}-user-cta-kept.png` });
      if (width < 1024) {
        // Phone: the button's card offered Edit / Delete; the ⋮ beside the button keeps them.
        const btn = visible(page, '[data-product-card-button="501"]').first();
        await btn.scrollIntoViewIfNeeded();
        await btn.getByRole('button', { name: 'Button actions' }).click();
        await page.waitForTimeout(300);
        expect(await page.getByText('Edit', { exact: true }).filter({ visible: true }).count() > 0 && await page.getByText('Delete', { exact: true }).filter({ visible: true }).count() > 0, `campaign ${tag}: ⋮ beside the button → Edit / Delete`);
        await page.screenshot({ path: `${OUT}/campaign-${tag}-button-menu.png` });
        await page.getByText('Edit', { exact: true }).filter({ visible: true }).first().click();
        await page.waitForTimeout(500);
        expect(await page.getByText('Edit Call to Action').filter({ visible: true }).count() > 0, `campaign ${tag}: Edit opens the Call to Action editor`);
        await page.screenshot({ path: `${OUT}/campaign-${tag}-edit-button.png` });
        await page.getByRole('button', { name: 'Save Changes' }).filter({ visible: true }).first().click();
        await page.waitForTimeout(600);
        const put = state.puts.find((x) => x.path === '/memories/901/widgets/501');
        expect(put && put.body?.widget_data?.placement === 'in_card' && put.body.widget_data.buttonLink === 'https://royalwoodshop.com/product/hinge', `campaign ${tag}: saving the edit keeps placement "in_card" (review M1) (${JSON.stringify(put?.body?.widget_data)})`);
        expect((await visible(page, '[data-product-card-button="501"]').count()) === 1 && !(await visible(page, '[data-cta-widget-id="501"]').count()), `campaign ${tag}: after the edit the button is still in the card`);
      } else {
        // Desktop: the sidebar entry (Edit / Duplicate / Delete) stays and scrolls to the button.
        const entries = await page.getByText('$1,299 CAD', { exact: true }).filter({ visible: true }).count();
        expect(entries >= 1, `campaign ${tag}: the sidebar still lists the Oak Table button (Edit / Duplicate / Delete) (${entries})`);
        // Review M5: selecting the button's sidebar entry highlights the in-card button (purple), as it did the card.
        await page.getByText('$1,299 CAD', { exact: true }).filter({ visible: true }).first().click();
        await page.waitForTimeout(1500);
        const active = await visible(page, '[data-product-card-button="502"]').first().getAttribute('data-active');
        expect(active === 'true', `campaign ${tag}: sidebar entry selected → the in-card button is highlighted (data-active=${active})`);
        await page.screenshot({ path: `${OUT}/campaign-${tag}-sidebar-selected.png` });
        // (At 1280 Studio's Media panel overlaps the timeline's right edge — existing layout — so the click is dispatched.)
        await visible(page, '[data-product-card-button="501"]').first().locator('a').dispatchEvent('click');
        await page.waitForTimeout(400);
        expect(state.clicks.includes('/memories/901/widgets/501/track-click'), `campaign ${tag}: a click is counted on the button's widget (${JSON.stringify(state.clicks)})`);
      }
      await context.close();
    }
    // ── Shared view (a collaborator with edit rights) — review I1 ─────────────────────────────────────────
    {
      const state = { clicks: [], puts: [] };
      const { context, page } = await newContext(width, height, state, true);
      await page.goto(`${BASE}/memories`);
      const card = page.getByText('Hinges and Tables', { exact: true }).filter({ visible: true }).first();
      await card.waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForTimeout(800);
      await card.click();
      await page.getByText('Our showroom').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await checkInCard(page, `shared ${tag}`, 502, 2, 'Solid oak, seats six.', 'https://royalwoodshop.com/product/oak-table');
      await page.screenshot({ path: `${OUT}/shared-${tag}-old-style-product.png` });
      expect(!(await visible(page, '[data-cta-widget-id="502"]').count()), `shared ${tag}: no separate card for the product's button`);
      if (width >= 1024) {
        // The shared desktop nav entry under the moment keeps its ⋮ Edit / Delete (as on development).
        const entry = page.getByText('$1,299 CAD', { exact: true }).filter({ visible: true }).first();
        expect(await entry.count() === 1, `shared ${tag}: the nav still lists the product's button`);
        const navItem = entry.locator('xpath=ancestor::div[contains(@class,"pl-10")][1]');
        await navItem.locator('svg.lucide-ellipsis-vertical, svg.lucide-more-vertical').first().click();
        await page.waitForTimeout(300);
        expect(await page.getByText('Edit', { exact: true }).filter({ visible: true }).count() > 0 && await page.getByText('Delete', { exact: true }).filter({ visible: true }).count() > 0, `shared ${tag}: its ⋮ → Edit / Delete`);
        await page.screenshot({ path: `${OUT}/shared-${tag}-nav-menu.png` });
        await page.getByText('Edit', { exact: true }).filter({ visible: true }).first().click();
        await page.waitForTimeout(500);
        expect(await page.getByText('Edit Call to Action').filter({ visible: true }).count() > 0, `shared ${tag}: Edit opens the Call to Action editor`);
        await page.getByRole('button', { name: 'Save Changes' }).filter({ visible: true }).first().click();
        await page.waitForTimeout(600);
        const put = state.puts.find((x) => x.path === '/memories/901/widgets/502');
        expect(put && put.body?.widget_data?.placement === 'in_card', `shared ${tag}: the saved edit keeps it in the card (${JSON.stringify(put?.body?.widget_data)})`);
      }
      await context.close();
    }
    // ── Published page (visitor) ───────────────────────────────────────────────────────────────────────────
    {
      const state = { clicks: [], puts: [] };
      const { context, page } = await newContext(width, height, state);
      await page.goto(`${BASE}/published-memory/hinges-and-tables`);
      await page.getByText('Timeline').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 20000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/published-${tag}-top.png` });
      await checkInCard(page, `published ${tag}`, 501, 1, 'Ball Bearing Sq Butt Hinge Nickel', 'https://royalwoodshop.com/product/hinge');
      await page.screenshot({ path: `${OUT}/published-${tag}-new-style-product.png` });
      await checkInCard(page, `published ${tag}`, 502, 2, 'Solid oak, seats six.', 'https://royalwoodshop.com/product/oak-table');
      await page.screenshot({ path: `${OUT}/published-${tag}-old-style-product.png` });
      await checkStyle(page, `published ${tag}`);
      expect(!(await page.getByText('$1,299 CAD', { exact: true }).filter({ visible: true }).count()), `published ${tag}: the old button card's title (price) is nowhere — not a card, not a nav entry`);
      const headings = await page.locator('h3').filter({ visible: true }).allTextContents();
      expect(!headings.includes(HINGE), `published ${tag}: no repeated product title heading`);
      for (const t of ['Book a visit', 'Ask about bulk pricing']) {
        expect(headings.includes(t), `published ${tag}: the owner's CTA "${t}" is still its own card`);
      }
      await page.getByText('Ask about bulk pricing').filter({ visible: true }).last().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/published-${tag}-user-cta-kept.png` });
      await visible(page, '[data-product-card-button="502"]').first().locator('a').dispatchEvent('click');
      await page.waitForTimeout(400);
      expect(state.clicks.includes('/memories/901/widgets/502/track-click'), `published ${tag}: a click is counted on the button's widget (${JSON.stringify(state.clicks)})`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) { console.log('page errors:', relevant.slice(0, 5)); failures.push(`page errors: ${relevant.length}`); }
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall product card button checks passed');
process.exit(failures.length ? 1 : 0);
