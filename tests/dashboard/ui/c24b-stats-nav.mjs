// tests/dashboard/ui/c24b-stats-nav.mjs — Deepak 24 Nov 2026 (b), P4: "this should be called Stats not Dashboard, and we
// should move it under Leads. Campaigns should be shown first." The walk, at 1280 and 390, in the real app (every API
// call answered here; every non-local request aborted):
//  A. Sign in (email → code → Verify & Sign In) → Studio opens on Campaigns ('/'), not Stats; Stats' API isn't asked.
//  B. Menu order: sidebar Campaigns, Leads, Stats, Media, Products, Users, Apps, Connectors (1280); phone bar Campaigns,
//     Leads, Stats, Media, Products, Users, every label inside 390 px (390). No "Dashboard" anywhere.
//  C. Click Stats → heading "Stats", address /dashboard, sidebar header "Stats / Overview & Analytics"; reload → Stats.
//  D. An old /dashboard link opens Stats; '/' opens Campaigns; an unknown address opens Campaigns.
//  E. A Starter self sign-up (role 3): no Stats (as before), opens on Campaigns.
// node tests/dashboard/ui/c24b-stats-nav.mjs  (C24S_BASE = dev server, default http://127.0.0.1:5194; C24S_SHOTS)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.C24S_BASE || 'http://127.0.0.1:5194';
const OUT = process.env.C24S_SHOTS || '/Users/deepaksharma/Pictures/Personal-Works/Stasht-Project/handoff-20261114/c24b-stats-nav-shots';
mkdirSync(OUT, { recursive: true });

const OWNER = { id: 70, external_user_id: 707, name: 'TheBodyPolitik', email: 'owner@bodypolitik.test', role: '2', status: 1, is_activated: true, profile_color: '#1F6F4A', profile_image: null, bio: 'Waxing studio', location: 'Barrie, ON' };
const STARTER = { ...OWNER, id: 71, external_user_id: 708, name: 'New Starter', email: 'starter@example.test', role: '3' };
const NOV = {
  id: 951, title: 'November Specials', user_id: 707, published: 0, slug: 'november-specials', category: { id: 5, name: 'Campaigns' }, sub_category: null, photos: { count: 0 },
  collaborators: [], user: { id: 707, name: 'TheBodyPolitik' }, created_at: '2026-11-20 10:00:00', location: 'Barrie, Canada', tags: [],
  min_uploaded_img_date: '2026-11-20', max_uploaded_img_date: '2026-11-20', last_update_img: null,
};
const card = (count) => ({ count, formatted: String(count), period_count: 0, previous_period_count: 0, period_label: 'This Week', percentage: { value: 0, text: '', trend: 'neutral' } });
const DASHBOARD = {
  statistics: { total_memories: card(1), total_media: card(0), total_users: card(1), storage: { used: 0, formatted: '0 MB', period_used: 0, period_formatted: '0 MB', limit: 5368709120, limit_formatted: '5 GB', percentage_used: 0, available: 5368709120, available_formatted: '5 GB', period_label: 'This Week' } },
  latest_memories: [], date_range: { start_date: '2026-11-16', end_date: '2026-11-22', type: 'weekly' },
};

const failures = [];
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height, path, user = OWNER, plan = 'Professional', signedIn = true }) {
  const state = { calls: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', timezoneId: 'America/Toronto', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([u, signed]) => {
    if (sessionStorage.getItem('c24s-seeded')) return;
    sessionStorage.setItem('c24s-seeded', '1');
    localStorage.clear();
    if (!signed) return;
    localStorage.setItem('stasht_token', 'tok-' + u.id);
    localStorage.setItem('stasht_user', JSON.stringify(u));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels');
  }, [user, signedIn]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      blocked.add(url.hostname);
      return route.abort('blockedbyclient');
    }
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const m = req.method();
    state.calls.push(`${m} ${p}`);
    if (process.env.C24S_DEBUG) console.log('   api', m, p);
    if (p === '/send-otp') return route.fulfill({ json: { success: true, message: 'OTP sent', channel: 'email' } });
    if (p === '/verify-otp') return route.fulfill({ json: { success: true, verification_token: 'vt-1' } });
    if (p === '/login' && m === 'POST') return route.fulfill({ json: { success: true, data: { user, token: 'tok-' + user.id, collaborators: [], partial_admin_access: [], owned_properties: [], shared_properties: [] } } });
    if (p === '/dashboard') return route.fulfill({ json: { success: true, data: DASHBOARD } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    if (p === '/user/profile') return route.fulfill({ json: { success: true, data: { user } } });
    if (p === '/memories' && m === 'GET') {
      const all = [NOV];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length, pagination: { current_page: 1, last_page: 1 } }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Campaigns', memory_count: all.length }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 5, name: 'Campaigns', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/properties') return route.fulfill({ json: { success: true, data: { properties: [], owned_properties: [], shared_properties: [], owned_count: 0, shared_count: 0, total_count: 0 } } });
    if (p === '/user/memory-counts') return route.fulfill({ json: { success: true, data: { memory_counts: { total_memories: 1, total_memory_images: 0, published_memories: 0, active_collaborators: 0 } } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: plan, used_storage_gb: 0, total_storage_gb: 100 } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 1, memory_limit: 50 } } } });
    if (p === '/stripe/payment-methods') return route.fulfill({ json: { success: true, payment_methods: [{ id: 'pm_1' }] } });
    if (p === '/products/status') {
      const on = plan !== 'Starter';
      return route.fulfill({ json: { success: true, data: { pilot: on, available: on, reason: on ? null : 'not_available', can_create: on, counts: { total: 0, manual: 0, website: 0, shopify: 0 }, default_currency: 'USD' } } });
    }
    if (p === '/website-catalogue') return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    if (p === '/lead-groups') return route.fulfill({ json: { groups: [] } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(`${width}: ${e.message}`));
  await page.goto(`${BASE}${path}`);
  return { context, page, state };
}

async function signIn(page, email) {
  const field = page.locator('input[type=email]').filter({ visible: true }).first();
  await field.waitFor({ state: 'visible', timeout: 90000 });
  await field.fill(email);
  await page.getByRole('button', { name: /Send OTP|Send code|Send verification code/i }).filter({ visible: true }).first().click();
  const otp = page.locator('#otp');
  await otp.waitFor({ state: 'visible', timeout: 10000 });
  await otp.fill('123456');
  await page.getByRole('button', { name: /Verify & Sign In|Sign In/ }).filter({ visible: true }).first().click();
}
const shot = async (page, file) => { const path = `${OUT}/${file}.png`; await page.screenshot({ path }); console.log('  shot', path); };
const pathOf = (page) => new URL(page.url()).pathname;
const statsHeading = (page) => page.getByRole('heading', { name: 'Stats', exact: true }).filter({ visible: true });
const dashboardText = (page) => page.getByText('Dashboard', { exact: true }).filter({ visible: true });
// The Campaigns page is showing: its sidebar header (1280) or its phone-bar tab is the active one (390).
async function onCampaigns(page, width) {
  if (width >= 768) return (await page.locator('aside').filter({ visible: true }).first().getByText('Manage Storeels', { exact: true }).count()) > 0;
  return page.evaluate(() => {
    const nav = document.querySelector('nav.phone-bottom-bar-pin');
    const btn = nav && [...nav.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Campaigns');
    return !!btn && btn.className.includes('text-[#6C60FF]');
  });
}
async function waitForApp(page) {
  await page.getByText('Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(2500);
}
const sidebarLabels = (page) => page.evaluate(() => {
  const NAV = ['Dashboard', 'Stats', 'Campaigns', 'Leads', 'Media', 'Products', 'Library', 'Users', 'Apps', 'Connectors'];
  const aside = [...document.querySelectorAll('aside')].find((a) => a.getBoundingClientRect().width > 0);
  return aside ? [...aside.querySelectorAll('button')].map((b) => (b.innerText || '').split('\n')[0].trim()).filter((t) => NAV.includes(t)) : [];
});
const phoneLabels = (page, width) => page.evaluate((w) => {
  const nav = document.querySelector('nav.phone-bottom-bar-pin');
  return nav ? [...nav.querySelectorAll('button span')].map((s) => { const r = s.getBoundingClientRect(); return { t: s.textContent.trim(), inside: r.left >= 0 && r.right <= w, clipped: s.scrollWidth > s.clientWidth + 1 }; }) : [];
}, width);

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    console.log(`-- ${tag}`);

    // A. Sign in → Campaigns.
    {
      const { page, context, state } = await open({ width, height, path: '/login?prefill_email=' + encodeURIComponent(OWNER.email), signedIn: false });
      await signIn(page, OWNER.email);
      await waitForApp(page);
      expect(pathOf(page) === '/' || pathOf(page) === '/stories', `${tag} A: after sign-in the address is Campaigns' (${pathOf(page)})`);
      expect(await onCampaigns(page, width), `${tag} A: Studio opens on Campaigns`);
      expect(await statsHeading(page).count() === 0, `${tag} A: not on Stats`);
      expect(!state.calls.includes('GET /dashboard'), `${tag} A: Stats' numbers aren't asked on landing`);
      await shot(page, `${tag}-A-signed-in-lands-on-campaigns`);

      // B. Menu order.
      if (width >= 768) {
        const labels = await sidebarLabels(page);
        console.log('   sidebar', JSON.stringify(labels));
        expect(labels.slice(0, 3).join(',') === 'Campaigns,Leads,Stats', `${tag} B: sidebar starts Campaigns, Leads, Stats`);
        expect(labels.join(',') === 'Campaigns,Leads,Stats,Media,Products,Users,Apps,Connectors', `${tag} B: then the rest unchanged (Media, Products, Users, Apps, Connectors)`);
      } else {
        const labels = await phoneLabels(page, width);
        console.log('   phone bar', JSON.stringify(labels.map((l) => l.t)));
        expect(labels.map((l) => l.t).join(',') === 'Campaigns,Leads,Stats,Media,Products,Users', `${tag} B: phone bar Campaigns, Leads, Stats, Media, Products, Users`);
        expect(labels.every((l) => l.inside && !l.clipped), `${tag} B: every phone-bar label fits inside 390 px`);
      }
      expect(await dashboardText(page).count() === 0, `${tag} B: no "Dashboard" label left`);

      // C. Click Stats → Stats page.
      const stats = width >= 768
        ? page.locator('aside').filter({ visible: true }).first().getByRole('button', { name: /^Stats/ }).first()
        : page.getByTestId('phone-bar-stats');
      await stats.click();
      await statsHeading(page).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2000);
      expect(await statsHeading(page).count() > 0, `${tag} C: Stats opens with the heading "Stats"`);
      expect(pathOf(page) === '/dashboard', `${tag} C: its address is /dashboard (${pathOf(page)})`);
      expect(state.calls.includes('GET /dashboard') || state.calls.some((c) => c.startsWith('GET /dashboard')), `${tag} C: its numbers load`);
      expect(await page.getByText('Total Campaigns', { exact: true }).filter({ visible: true }).count() > 0, `${tag} C: the cards show (Total Campaigns)`);
      if (width >= 768) {
        const aside = page.locator('aside').filter({ visible: true }).first();
        expect(await aside.getByText('Overview & Analytics', { exact: true }).count() > 0 && await aside.getByText('Stats', { exact: true }).count() >= 2, `${tag} C: sidebar header reads Stats / Overview & Analytics`);
      } else {
        const active = await page.evaluate(() => [...document.querySelectorAll('nav.phone-bottom-bar-pin button')].find((b) => b.className.includes('text-[#6C60FF]'))?.textContent?.trim());
        expect(active === 'Stats', `${tag} C: the phone bar marks Stats (${active})`);
      }
      expect(await dashboardText(page).count() === 0, `${tag} C: no "Dashboard" label on Stats`);
      await shot(page, `${tag}-C-stats-page`);
      await page.reload();
      await statsHeading(page).first().waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(1500);
      expect(await statsHeading(page).count() > 0 && pathOf(page) === '/dashboard', `${tag} C: reload stays on Stats`);

      // Back to Campaigns from the menu, then the Campaigns list is there.
      const camp = width >= 768
        ? page.locator('aside').filter({ visible: true }).first().getByRole('button', { name: /^Campaigns/ }).first()
        : page.locator('nav.phone-bottom-bar-pin').getByText('Campaigns', { exact: true });
      await camp.click();
      await page.waitForTimeout(2000);
      expect(await onCampaigns(page, width) && pathOf(page) === '/stories', `${tag} C: Campaigns from the menu (${pathOf(page)})`);
      await context.close();
    }

    // D. Old /dashboard links, '/' and unknown addresses.
    {
      const { page, context } = await open({ width, height, path: '/dashboard' });
      await statsHeading(page).first().waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
      await page.waitForTimeout(1500);
      expect(await statsHeading(page).count() > 0, `${tag} D: an old /dashboard link opens Stats`);
      await shot(page, `${tag}-D-old-dashboard-link-opens-stats`);
      await context.close();
    }
    for (const path of ['/', '/no-such-page']) {
      const { page, context } = await open({ width, height, path });
      await waitForApp(page);
      expect(await onCampaigns(page, width) && await statsHeading(page).count() === 0, `${tag} D: ${path} opens Campaigns`);
      if (path === '/') await shot(page, `${tag}-D-root-opens-campaigns`);
      await context.close();
    }

    // E. A Starter self sign-up (role 3): no Stats, as before; Campaigns.
    {
      const { page, context } = await open({ width, height, path: '/', user: STARTER, plan: 'Starter' });
      await waitForApp(page);
      await page.waitForTimeout(1500);
      expect(await onCampaigns(page, width), `${tag} E: a Starter role 3 opens on Campaigns`);
      const labels = width >= 768 ? await sidebarLabels(page) : (await phoneLabels(page, width)).map((l) => l.t);
      console.log('   starter menu', JSON.stringify(labels));
      expect(!labels.includes('Stats') && labels[0] === 'Campaigns' && labels[1] === 'Leads', `${tag} E: no Stats on Starter (as before); Campaigns, Leads first`);
      await context.close();
    }
  }
} catch (e) {
  failures.push(`crashed: ${e.message}`);
  console.log(e);
}

await browser.close();
if (pageErrors.length) console.log('page errors:', pageErrors);
console.log('blocked hosts:', [...blocked].join(', ') || 'none');
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
