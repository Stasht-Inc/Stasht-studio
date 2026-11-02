// Linked campaigns on a Private campaign page (3 Nov 2026): the web API reads a Private (published=3) parent's linked
// campaigns (GET /memory-detail/{id}) only with that page's ?access_token=. The mocked API answers 404 without the token
// and 200 with it, as the real one does. Checks: an anonymous visitor who typed the token into the prompt opens a linked
// campaign; a public page's linked campaign is asked for with no token, as before.
// node tests/published-memory/ui/linked-private-token.mjs   (needs the dev server: PM_BASE, default http://localhost:5311)
// Every non-local request is aborted: nothing leaves this machine.
// Screenshots: PM_SHOTS (default /private/tmp/claude-501/published-memory-ui/linked-private).
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.PM_BASE || 'http://localhost:5311';
const OUT = process.env.PM_SHOTS || '/private/tmp/claude-501/published-memory-ui/linked-private';
mkdirSync(OUT, { recursive: true });

const TOKEN = 'TOK-123';
const owner = { id: 7, name: 'Serpa Chrysler', profile_image: null, profile_color: '#6C60FF' };
const LINKED = { id: 902, title: 'Backstage Pass', published: 1, posts_count: 0, user: owner, cover_image: null, tags: [], collaborators: [] };
const parent = (published, slug) => ({
  id: 501, title: published === 3 ? 'VIP Night' : 'Open Day', slug, published, user_id: 7, user: owner, last_update_img: null,
  description: 'Members only.', posts: [], linked_memories: [LINKED], widgets: [], unified_order: null, category: { name: 'Events' }, tags: [],
  created_at: '2026-10-01 10:00:00',
});
const CHILD = { memory: { id: 902, title: 'Backstage Pass Inside', slug: 'backstage', published: 1, user_id: 7, user: owner, posts: [], linked_memories: [], widgets: [], unified_order: null, category: { name: 'Events' }, tags: [], created_at: '2026-10-02 10:00:00' } };

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height, slug }) {
  const state = { detail: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(() => { if (!sessionStorage.getItem('pm-seeded')) { sessionStorage.setItem('pm-seeded', '1'); localStorage.clear(); } });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') {
        return route.fulfill({ contentType: 'text/javascript', body: 'window.Stripe=function(){return{elements:function(){return{create:function(){return{mount:function(){},on:function(){},destroy:function(){},unmount:function(){}}},getElement:function(){return null}}}}};' });
      }
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') {
        return route.fulfill({ contentType: 'text/javascript', body: 'window.gapi={load:function(n,c){var f=typeof c==="function"?c:(c&&c.callback);if(f)f();}};' });
      }
      return route.abort('blockedbyclient');
    }
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (url.pathname === '/api/react/published-memories') {
      const token = url.searchParams.get('access_token');
      if (url.searchParams.get('token') === 'vip-night') {
        if (token !== TOKEN) return route.fulfill({ json: { success: true, status: 0, requires_token: true, message: 'This campaign is private.' } });
        return route.fulfill({ json: { success: true, data: { memory: parent(3, 'vip-night'), order_by: 'asc' } } });
      }
      return route.fulfill({ json: { success: true, data: { memory: parent(1, 'open-day'), order_by: 'asc' } } });
    }
    const detail = url.pathname.match(/^\/api\/react\/memory-detail\/(\d+)$/);
    if (detail) {
      const token = url.searchParams.get('access_token');
      state.detail.push(token);
      // The real rule: a Private parent's linked campaign needs the parent page's token; a public parent's doesn't.
      if (slug === 'vip-night' && token !== TOKEN) return route.fulfill({ status: 404, json: { success: false, message: 'Campaign not found' } });
      return route.fulfill({ json: { success: true, data: CHILD } });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { success: true, data: [] } });
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/published-memory/${slug}`);
  return { context, page, state };
}

async function shot(page, file) {
  const path = `${OUT}/${file}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('shot', path);
}
// The linked campaign's card (on desktop the timeline list names it first; the card in the right column opens it).
const linkedCard = (page) => page.getByText('Backstage Pass', { exact: true }).filter({ visible: true }).last();
const childShown = (page) => page.getByText('Backstage Pass Inside').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);

    // 1. Private page, anonymous visitor: token typed into the prompt → the linked campaign opens with that token.
    {
      const { page, context, state } = await open({ width, height, slug: 'vip-night' });
      const input = page.getByPlaceholder('Enter your access token...');
      await input.waitFor({ state: 'visible', timeout: 20000 });
      await input.fill(TOKEN);
      // The page asks again as the token is typed (its effect depends on it), so Submit may already be gone.
      const submit = page.getByRole('button', { name: 'Submit Access Token' });
      if (await submit.isVisible().catch(() => false)) await submit.click().catch(() => {});
      await linkedCard(page).waitFor({ state: 'visible', timeout: 15000 });
      await shot(page, `${tag}-01-private-parent`);
      await linkedCard(page).scrollIntoViewIfNeeded();
      await linkedCard(page).click();
      const opened = await childShown(page);
      expect(opened, `${tag}: private parent: the linked campaign opens`);
      expect(state.detail.length > 0 && state.detail.every((t) => t === TOKEN), `${tag}: private parent: /memory-detail asked with ?access_token= (${JSON.stringify(state.detail)})`);
      await shot(page, `${tag}-02-private-linked-opened`);
      await context.close();
    }

    // 2. Public page: the linked campaign is asked for with no token, as before.
    {
      const { page, context, state } = await open({ width, height, slug: 'open-day' });
      await linkedCard(page).waitFor({ state: 'visible', timeout: 20000 });
      await linkedCard(page).scrollIntoViewIfNeeded();
      await linkedCard(page).click();
      expect(await childShown(page), `${tag}: public parent: the linked campaign opens`);
      expect(state.detail.length > 0 && state.detail.every((t) => t === null), `${tag}: public parent: no access_token sent (${JSON.stringify(state.detail)})`);
      await shot(page, `${tag}-03-public-linked-opened`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant);
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall linked-campaign token checks passed');
process.exit(failures.length || relevant.length ? 1 : 0);
