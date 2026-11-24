// tests/campaigns/ui/c21-dash-location.mjs — Chris 21 Nov 2026, P4 + P8. The walk, at 1280 and 390, in the real app
// (every API call answered here; every non-local request aborted, except the reverse-geocode lookup, answered here):
//  P4 Dashboard → Recent Activity: rows lead with the campaign's title, then what happened: "November Specials" /
//     "Created by …", "November Specials" / "3 files added by …", a blank title "Untitled campaign"; the user row is
//     unchanged; clicking a campaign row opens that campaign's page.
//  P8 Campaigns → Create → Storeel step 1: Location opens with the account's Settings location (GET /user/profile);
//     × clears it and it stays cleared (title typed, 2 s later); 1280: "Use current location" (mocked geolocation)
//     fills "Toronto, Canada" → Save as Draft → POST /memories carries location "Toronto, Canada"; 390: cleared →
//     Save as Draft → location "".
// node tests/campaigns/ui/c21-dash-location.mjs  (C21D_BASE = dev server, default http://127.0.0.1:5254; C21D_SHOTS)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.C21D_BASE || 'http://127.0.0.1:5254';
const OUT = process.env.C21D_SHOTS || '/Users/deepaksharma/Pictures/Personal-Works/Stasht-Project/handoff-20261114/c21-D-shots';
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 70, external_user_id: 707, name: 'TheBodyPolitik', email: 'owner@bodypolitik.test', role: '2', status: 1, is_activated: true, profile_color: '#1F6F4A' };
const SETTINGS_LOCATION = 'Barrie, ON, Canada';
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="${['#6C60FF', '#F59E0B', '#10B981'][n % 3]}"/></svg>`;
const img = (n) => `${BASE}/cd-img/${n}.jpg`;
const post = (id, n) => ({
  id, name: `Moment ${n}`, title: `Moment ${n}`, description: '', master_image_link: img(n), image_link: img(n), media_url: img(n),
  capture_date: `2026-11-1${n} 10:00:00`, uploaded_at: `2026-11-1${n} 10:00:00`, parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [],
});
const NOV = {
  id: 951, title: 'November Specials', user_id: 707, published: 0, slug: 'november-specials', category: { id: 5, name: 'Campaigns' }, sub_category: null, photos: { count: 3 },
  collaborators: [], user: { id: 707, name: 'TheBodyPolitik' }, created_at: '2026-11-20 10:00:00', location: 'Barrie, Canada', tags: [],
  min_uploaded_img_date: '2026-11-20', max_uploaded_img_date: '2026-11-20', last_update_img: null,
};
const ACTIVITY = [
  { type: 'media_uploaded', action: '3 media files uploaded', count: 3, memory_id: 951, memory_title: 'November Specials', user: 'Christian Beckermann', avatar: null, initials: 'CB', timestamp: '2026-11-20T11:00:00-05:00' },
  { type: 'campaign_created', action: 'New campaign created', memory_id: 951, memory_title: 'November Specials', user: 'Christian Beckermann', avatar: null, initials: 'CB', timestamp: '2026-11-20T10:00:00-05:00' },
  { type: 'campaign_created', action: 'New campaign created', memory_id: 952, memory_title: 'Holiday Gift Cards and Seasonal Waxing Packages for the Whole Family', user: 'Christian Beckermann', avatar: null, initials: 'CB', timestamp: '2026-11-19T10:00:00-05:00' },
  { type: 'campaign_created', action: 'New campaign created', memory_id: 953, memory_title: null, user: 'Christian Beckermann', avatar: null, initials: 'CB', timestamp: '2026-11-18T10:00:00-05:00' },
  { type: 'user_registered', action: 'New user registered', user: 'Jane Doe', avatar: null, initials: 'JD', timestamp: '2026-11-17T10:00:00-05:00' },
];
const card = (count) => ({ count, formatted: String(count), period_count: 0, previous_period_count: 0, period_label: 'This Week', percentage: { value: 0, text: '', trend: 'neutral' } });
const DASHBOARD = {
  statistics: { total_memories: card(3), total_media: card(3), total_users: card(1), storage: { used: 0, formatted: '0 MB', period_used: 0, period_formatted: '0 MB', limit: 5368709120, limit_formatted: '5 GB', percentage_used: 0, available: 5368709120, available_formatted: '5 GB', period_label: 'This Week' } },
  latest_memories: [], date_range: { start_date: '2026-11-16', end_date: '2026-11-22', type: 'weekly' },
};

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height, path }) {
  const state = { creates: [], geocodes: 0, memoryGets: [] };
  const context = await browser.newContext({
    viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', timezoneId: 'America/Toronto', hasTouch: width < 1024, isMobile: width < 1024,
    permissions: ['geolocation'], geolocation: { latitude: 43.6532, longitude: -79.3832 },
  });
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('c21d-seeded')) return;
    sessionStorage.setItem('c21d-seeded', '1');
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
      if (url.hostname === 'nominatim.openstreetmap.org' && url.pathname === '/reverse') {
        state.geocodes += 1;
        return route.fulfill({ json: { address: { city: 'Toronto', state: 'Ontario', country: 'Canada' }, display_name: 'Toronto, Ontario, Canada' } });
      }
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/cd-img/')) return route.fulfill({ contentType: 'image/svg+xml', body: svg(Number(url.pathname.match(/(\d+)/)?.[1] ?? 0)) });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const m = req.method();
    if (process.env.C21D_DEBUG) console.log('   api', m, p);
    let body = null;
    try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch { body = null; }
    if (p === '/dashboard') return route.fulfill({ json: { success: true, data: DASHBOARD } });
    if (p === '/dashboard/recent-activity') return route.fulfill({ json: { success: true, data: ACTIVITY } });
    if (p === '/user/profile') return route.fulfill({ json: { success: true, data: { user: { ...MAIN, location: SETTINGS_LOCATION } } } });
    if (p === '/memories' && m === 'GET') {
      const all = [NOV];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length, pagination: { current_page: 1, last_page: 1 } }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Campaigns', memory_count: all.length }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories' && m === 'POST') {
      state.creates.push(body);
      return route.fulfill({ json: { success: true, data: { id: 960, title: body?.title, slug: 'new-960', category_id: body?.category_id } } });
    }
    const mg = /^\/memories\/(\d+)$/.exec(p);
    if (mg && m === 'GET') {
      state.memoryGets.push(Number(mg[1]));
      return route.fulfill({ json: { status: 'success', data: { memory: { ...NOV, id: Number(mg[1]), posts: [post(11, 1), post(12, 2), post(13, 3)], linked_memories: [], widgets: [], unified_order: null } } } });
    }
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 5, name: 'Campaigns', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/properties') return route.fulfill({ json: { success: true, data: { properties: [], owned_properties: [], shared_properties: [], owned_count: 0, shared_count: 0, total_count: 0 } } });
    if (p === '/user/memory-counts') return route.fulfill({ json: { success: true, data: { memory_counts: { total_memories: 3, total_memory_images: 3, published_memories: 0, active_collaborators: 0 } } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 1, memory_limit: 50 } } } });
    if (p === '/stripe/payment-methods') return route.fulfill({ json: { success: true, payment_methods: [] } });
    if (p === '/products/status' || p === '/website-catalogue') return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    if (p === '/lead-groups') return route.fulfill({ json: { groups: [] } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(`${width}: ${e.message}`));
  await page.goto(`${BASE}${path}`);
  return { context, page, state };
}

const LOCATION = 'Enter location (e.g. Paris, France or Home)';

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    console.log(tag);

    // ── P4 Dashboard (the card is hidden on phones, as before: 1280 only) ─────────────────────────────────────────
    if (width >= 768) {
      const { page, context, state } = await open({ width, height, path: '/dashboard' }); // Stats ('/' = Campaigns since 24 Nov)
      const heading = page.getByRole('heading', { name: 'Recent Activity' });
      await heading.waitFor({ timeout: 40000 });
      const rows = page.getByTestId('recent-activity-row');
      for (let i = 0; i < 60 && (await rows.count()) < 5; i++) await page.waitForTimeout(250);
      await page.waitForTimeout(500);
      const texts = (await rows.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim().replace(/^(CB|JD) /, ''));
      expect(texts[0] === 'November Specials 3 files added by Christian Beckermann', `${tag}: upload row names the campaign ("${texts[0]}")`);
      expect(texts[1] === 'November Specials Created by Christian Beckermann', `${tag}: created row names the campaign ("${texts[1]}")`);
      expect(texts[3] === 'Untitled campaign Created by Christian Beckermann', `${tag}: blank title → "Untitled campaign" ("${texts[3]}")`);
      expect(texts[4] === 'New user registered by Jane Doe', `${tag}: user row unchanged ("${texts[4]}")`);
      const long = rows.nth(2);
      const lineBox = await long.locator('div.line-clamp-2').evaluate((el) => ({ h: el.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(el).lineHeight), clipped: el.scrollHeight > el.clientHeight + 1 }));
      const fits = await long.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
      expect(fits && lineBox.h <= lineBox.lh * 2 + 1, `${tag}: a long title takes at most two lines, row doesn't overflow (${JSON.stringify(lineBox)})`);
      expect(lineBox.clipped, `${tag}: the long title ends in "…"`);
      const novLine = await rows.nth(1).locator('div.line-clamp-2').evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
      expect(novLine, `${tag}: "Created November Specials" shows in full`);
      expect(await rows.nth(0).evaluate((el) => el.tagName) === 'BUTTON' && await rows.nth(4).evaluate((el) => el.tagName) === 'DIV', `${tag}: campaign rows are buttons, the user row isn't`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow <= 0, `${tag}: no horizontal scroll (${overflow})`);
      await heading.scrollIntoViewIfNeeded();
      await page.locator('div', { has: heading }).last().screenshot({ path: `${OUT}/${tag}-P4-01-recent-activity.png` });
      await page.screenshot({ path: `${OUT}/${tag}-P4-02-dashboard.png` });

      await rows.nth(1).click();
      await page.waitForTimeout(2500);
      expect(state.memoryGets.includes(951), `${tag}: clicking "Created November Specials" loads campaign 951 (GET /memories/951) ${JSON.stringify(state.memoryGets)}`);
      expect(await page.getByText('November Specials').filter({ visible: true }).count() > 0 && !(await page.getByRole('heading', { name: 'Recent Activity' }).count()), `${tag}: … and the campaign page is open`);
      await page.screenshot({ path: `${OUT}/${tag}-P4-03-opened-campaign.png` });
      await context.close();
    }

    // ── P8 Create Campaign location ──────────────────────────────────────────────────────────────────────────────
    {
      const { page, context, state } = await open({ width, height, path: '/memories' });
      await page.getByText(/^November Specials/).filter({ visible: true }).first().waitFor({ timeout: 30000 });
      await page.waitForTimeout(800);
      await page.getByRole('button', { name: /^Create( a Campaign)?$/ }).filter({ visible: true }).last().click();
      const create = page.getByRole('dialog', { name: 'Create Campaign' });
      const title = create.getByPlaceholder('Give your campaign a meaningful title');
      await title.waitFor({ timeout: 10000 });
      const loc = create.getByPlaceholder(LOCATION);
      await page.waitForTimeout(1500);
      expect(await loc.inputValue() === SETTINGS_LOCATION, `${tag}: Location opens with the Settings location ("${await loc.inputValue()}")`);
      expect(state.geocodes === 0, `${tag}: no device lookup on open`);
      const link = create.getByTestId('use-current-location');
      expect(await link.isVisible() && (await link.innerText()).trim() === 'Use current location', `${tag}: "Use current location" link shown`);
      await loc.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${tag}-P8-01-settings-location.png` });

      // × clears it; it stays cleared.
      await loc.click();
      await loc.locator('xpath=..').locator('button').first().click();
      await title.fill(`Waxing menu ${tag}`);
      await create.locator('#st-step-campaign').getByRole('combobox').first().click();
      await page.getByRole('option', { name: 'Campaigns' }).click();
      await page.waitForTimeout(2000);
      expect(await loc.inputValue() === '', `${tag}: cleared stays cleared after typing a title / picking a category ("${await loc.inputValue()}")`);
      await loc.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${tag}-P8-02-cleared.png` });

      if (width === 1280) {
        await link.click();
        await page.waitForTimeout(1500);
        expect(await loc.inputValue() === 'Toronto, Canada' && state.geocodes === 1, `${tag}: Use current location fills the device's city ("${await loc.inputValue()}")`);
        await page.screenshot({ path: `${OUT}/${tag}-P8-03-current-location.png` });
      }

      await create.getByRole('button', { name: 'Save as Draft', exact: true }).filter({ visible: true }).last().click();
      await page.waitForTimeout(2000);
      const sent = state.creates[0];
      const want = width === 1280 ? 'Toronto, Canada' : '';
      expect(sent && (sent.location ?? '') === want, `${tag}: Save as Draft sends location "${want}" (got ${JSON.stringify(sent?.location)})`);
      await page.screenshot({ path: `${OUT}/${tag}-P8-04-saved.png` });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (pageErrors.length) console.log('page errors:', pageErrors);
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall c21-D checks passed');
process.exit(failures.length ? 1 : 0);
