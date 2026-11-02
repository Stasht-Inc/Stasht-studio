// The per-campaign AI Campaign Wizard (3 Nov 2026): its button sat in the tablet-only media section (md..lg) but was
// itself shown only from lg up, so it never showed at any width; the Campaigns tab's own wizard button is gone (QR
// Codes took its place). Now: in the desktop media sidebar (lg+) and the tablet media section (md..lg); phones as
// before (no media section, no button). Checks 1280, 900 and 390, and that the button still opens the wizard.
// node tests/campaign-detail/ui/ai-wizard-button.mjs   (needs the dev server: CD_BASE, default http://localhost:5311)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: CD_SHOTS (default /private/tmp/claude-501/campaign-detail-ui/ai-wizard).
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.CD_BASE || 'http://localhost:5311';
const OUT = process.env.CD_SHOTS || '/private/tmp/claude-501/campaign-detail-ui/ai-wizard';
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 70, external_user_id: 707, name: 'Main Dealer', email: 'main@dealer.test', role: '2', status: 1, is_activated: true };
const img = (n) => `${BASE}/cd-img/${n}.jpg`;
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="${['#6C60FF', '#F59E0B', '#10B981'][n % 3]}"/></svg>`;
const post = (id, n) => ({
  id, name: `Moment ${n}`, title: `Moment ${n}`, description: '', master_image_link: img(n), image_link: img(n), media_url: img(n),
  capture_date: `2026-10-1${n} 10:00:00`, uploaded_at: `2026-10-1${n} 10:00:00`, parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [],
});
const CAMPAIGN = {
  id: 901, title: 'Fall Promo', user_id: 707, published: 1, slug: 'fall-promo', category: { id: 5, name: 'Campaigns' }, photos: { count: 3 },
  collaborators: [], user: { id: 707, name: 'Main Dealer' }, created_at: '2026-10-01 10:00:00', location: 'Toronto, ON', tags: [],
};
const DETAIL = { ...CAMPAIGN, posts: [post(11, 1), post(12, 2), post(13, 3)], linked_memories: [], widgets: [], unified_order: null };

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }) {
  const state = { creditChecks: 0 };
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
      if (url.hostname === 'js.stripe.com') {
        return route.fulfill({ contentType: 'text/javascript', body: 'window.Stripe=function(){return{elements:function(){return{create:function(){return{mount:function(){},on:function(){},destroy:function(){},unmount:function(){}}},getElement:function(){return null}}}}};' });
      }
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') {
        return route.fulfill({ contentType: 'text/javascript', body: 'window.gapi={load:function(n,c){var f=typeof c==="function"?c:(c&&c.callback);if(f)f();}};' });
      }
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/cd-img/')) return route.fulfill({ contentType: 'image/svg+xml', body: svg(Number(url.pathname.match(/(\d+)/)?.[1] ?? 0)) });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (p === '/memories' && req.method() === 'GET') {
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: [CAMPAIGN], total: 1 }, latest_memories: [CAMPAIGN], sidebar: { categories: { items: [{ id: 5, name: 'Campaigns', memory_count: 1 }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories/901' && req.method() === 'GET') return route.fulfill({ json: { status: 'success', data: { memory: DETAIL } } });
    if (p === '/ai-credits/check') {
      state.creditChecks++;
      return route.fulfill({ json: { success: true, data: { has_sufficient_credits: true, total_available: 50 } } });
    }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/memories`);
  const card = page.getByText('Fall Promo', { exact: true }).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(800);
  await card.click();
  await page.getByText('Moment 1').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  return { context, page, state };
}

const wizardButtons = (page) => page.getByRole('button', { name: /AI Campaign Wizard/ }).filter({ visible: true });

try {
  for (const [width, height, shown] of [[1280, 900, true], [900, 1000, true], [390, 844, false]]) {
    const tag = String(width);
    const { page, context, state } = await open({ width, height });
    const n = await wizardButtons(page).count();
    expect(shown ? n === 1 : n === 0, `${tag}: AI Campaign Wizard button ${shown ? 'shows once' : 'hidden (phone, as before)'} (${n} visible)`);
    await page.screenshot({ path: `${OUT}/${tag}-campaign-page.png` });
    if (shown && n) {
      await wizardButtons(page).first().scrollIntoViewIfNeeded();
      await wizardButtons(page).first().click();
      await page.getByText('AI Suggestions').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
      expect(state.creditChecks === 1, `${tag}: the button checks AI credits (${state.creditChecks})`);
      expect(await page.getByText('AI Suggestions').filter({ visible: true }).count() > 0, `${tag}: the wizard opens`);
      await page.screenshot({ path: `${OUT}/${tag}-wizard-open.png` });
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall AI wizard button checks passed');
process.exit(failures.length ? 1 : 0);
