// Deepak, 9 Nov 2026: "Select from Existing Campaigns" back on Edit (hidden there by 2c44261), in the real app at 1280
// and 390. Step 1 has the same control as Create; the campaign's linked campaigns show ticked (the box opens ticked);
// ticking / unticking saves nothing until Save Changes, which links the newly ticked (POST /memories/901/linked-memories)
// and unlinks the unticked (DELETE /memories/901/linked-memories/{id}); the campaign page then shows them. A campaign
// linked with Add a Moment's "Campaigns (optional)" shows ticked too. A failed link keeps the flow open, says so at the
// bottom, and a retry sends only what is missing. An Edit without links opens the box unticked; Create is unchanged.
// node tests/campaign-detail/ui/edit-linked-campaigns.mjs   (dev server: CD_BASE, default http://localhost:5351)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from './cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.CD_BASE || 'http://localhost:5351';
const OUT = process.env.CD_SHOTS || '/private/tmp/claude-501/campaign-detail-ui/edit-linked-campaigns';
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 70, external_user_id: 707, name: 'Main Dealer', email: 'main@dealer.test', role: '2', status: 1, is_activated: true, profile_color: '#1D4ED8' };
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="${['#6C60FF', '#F59E0B', '#10B981'][n % 3]}"/></svg>`;
const img = (n) => `${BASE}/cd-img/${n}.jpg`;
const post = (id, n) => ({
  id, name: `Moment ${n}`, title: `Moment ${n}`, description: '', master_image_link: img(n), image_link: img(n), media_url: img(n),
  capture_date: `2026-10-1${n} 10:00:00`, uploaded_at: `2026-10-1${n} 10:00:00`, parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [],
});
const base = { user_id: 707, user: { id: 707, name: 'Main Dealer' }, category: { id: 5, name: 'Campaigns' }, sub_category: null, collaborators: [], created_at: '2026-10-01 10:00:00', location: 'Toronto, Canada', tags: [], published: 0, last_update_img: null };
const CAMPAIGN = { ...base, id: 901, title: 'Fall Promo', slug: 'fall-promo', photos: { count: 2 }, min_uploaded_img_date: '2026-10-01', max_uploaded_img_date: '2026-10-01' };
const OTHERS = [
  { ...base, id: 12, title: 'Spring Open House', slug: 'spring', posts_count: 4, last_update_img: img(1) },
  { ...base, id: 14, title: 'Winter Tires', slug: 'winter', posts_count: 2, last_update_img: img(2) },
  { ...base, id: 20, title: 'Summer BBQ', slug: 'bbq', posts_count: 6, last_update_img: img(3) },
  { ...base, id: 13, title: 'Invited Campaign', slug: 'invite', is_invite: true, user_id: 999 },
];

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }, { linked = [12, 14] } = {}) {
  const state = { linked: [...linked], puts: [], linkCalls: [], unlinkCalls: [], failNextLink: false };
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
      const all = [CAMPAIGN, ...OTHERS];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Campaigns', memory_count: all.length }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories/901' && m === 'GET') {
      const linkedRows = state.linked.map((id) => ({ ...OTHERS.find((o) => o.id === id), is_car: 0 }));
      return route.fulfill({ json: { status: 'success', data: { memory: { ...CAMPAIGN, posts: [post(11, 1), post(12, 2)], widgets: [] }, linked_memories: linkedRows, unified_order: null } } });
    }
    if (p === '/memories/901' && m === 'PUT') { state.puts.push(body); return route.fulfill({ json: { success: true, data: CAMPAIGN } }); }
    if (p === '/memories/901/linked-memories' && m === 'POST') {
      state.linkCalls.push(body);
      if (state.failNextLink) { state.failNextLink = false; return route.fulfill({ status: 500, json: { success: false, message: 'Server error' } }); }
      const fresh = (body.linked_memory_ids || []).filter((id) => !state.linked.includes(id));
      state.linked.push(...fresh);
      return route.fulfill({ json: { success: true, data: { linked: fresh.length, already_linked_ids: [] } } });
    }
    const un = p.match(/^\/memories\/901\/linked-memories\/(\d+)$/);
    if (un && m === 'DELETE') { state.unlinkCalls.push(Number(un[1])); state.linked = state.linked.filter((id) => id !== Number(un[1])); return route.fulfill({ json: { success: true } }); }
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
  await page.waitForTimeout(1500);
}
const flow = (page) => page.getByRole('dialog', { name: 'Edit Campaign' });
const picker = (page) => flow(page).locator('#st-pick-items');
const openEdit = async (page, width) => {
  if (width >= 1024) await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click();
  else await page.getByRole('button', { name: 'Edit Campaign' }).filter({ visible: true }).first().click();
  await flow(page).getByPlaceholder('Give your campaign a meaningful title').waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1200);
};
const row = (page, title) => picker(page).locator('div.cursor-pointer').filter({ hasText: title }).first();
const ticked = async (page, title) => row(page, title).locator('input[type="checkbox"]').isChecked().catch(() => null);
const pageHas = async (page, title) => (await page.getByText(title, { exact: true }).filter({ visible: true }).count()) > 0;

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    {
      const { page, context, state } = await open({ width, height });
      await openCampaign(page);
      expect(await pageHas(page, 'Spring Open House') && await pageHas(page, 'Winter Tires'), `${tag}: the page shows the 2 linked campaigns`);
      await openEdit(page, width);
      const box = picker(page).getByRole('checkbox', { name: 'Select from Existing Campaigns' });
      expect(await box.isVisible().catch(() => false), `${tag}: Edit has "Select from Existing Campaigns"`);
      expect(await box.isChecked().catch(() => false), `${tag}: it opens ticked (the campaign links campaigns)`);
      expect(await ticked(page, 'Spring Open House') === true && await ticked(page, 'Winter Tires') === true, `${tag}: the linked campaigns are ticked`);
      expect(await ticked(page, 'Summer BBQ') === false, `${tag}: another campaign is unticked`);
      expect(!(await row(page, 'Fall Promo').count()) && !(await row(page, 'Invited Campaign').count()), `${tag}: never the campaign itself or a pending invite`);
      expect(((await picker(page).textContent()) ?? '').includes('2 selected'), `${tag}: "2 selected"`);
      expect(await picker(page).getByText('Linked and removed when you press Save Changes.').isVisible().catch(() => false), `${tag}: says when it is saved`);
      await box.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${tag}-01-edit-linked-ticked.png` });

      // Tick Summer BBQ, untick Spring Open House: nothing saved yet
      await row(page, 'Summer BBQ').click();
      await row(page, 'Spring Open House').click();
      expect(await ticked(page, 'Summer BBQ') === true && await ticked(page, 'Spring Open House') === false, `${tag}: ticks follow the clicks`);
      expect(!state.linkCalls.length && !state.unlinkCalls.length && !state.puts.length, `${tag}: nothing saved before Save Changes`);
      await page.screenshot({ path: `${OUT}/${tag}-02-changed.png` });

      // Save Changes → PUT, link 20, unlink 12 → toast, closed, the page shows them
      await flow(page).getByRole('button', { name: 'Save Changes', exact: true }).filter({ visible: true }).last().click();
      await page.getByText('Changes saved').first().waitFor({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1500);
      expect(state.puts.length === 1, `${tag}: Save Changes PUT`);
      expect(JSON.stringify(state.linkCalls.map((c) => c.linked_memory_ids)) === '[[20]]', `${tag}: POST linked-memories [20] (${JSON.stringify(state.linkCalls)})`);
      expect(JSON.stringify(state.unlinkCalls) === '[12]', `${tag}: DELETE linked-memories/12 (${JSON.stringify(state.unlinkCalls)})`);
      expect(!(await flow(page).count()), `${tag}: closed after Save Changes`);
      expect(await pageHas(page, 'Summer BBQ') && await pageHas(page, 'Winter Tires') && !(await pageHas(page, 'Spring Open House')), `${tag}: the campaign page shows Winter Tires + Summer BBQ, not Spring Open House`);
      await page.getByText('Summer BBQ').first().scrollIntoViewIfNeeded().catch(() => {});
      await page.screenshot({ path: `${OUT}/${tag}-03-page-after-save.png` });

      // Edit again: ticks = the saved links
      await openEdit(page, width);
      expect(await ticked(page, 'Winter Tires') === true && await ticked(page, 'Summer BBQ') === true && await ticked(page, 'Spring Open House') === false, `${tag}: Edit again shows the saved links ticked`);

      // Add a Moment's "Campaigns (optional)" links Spring Open House at once → ticked here too
      await flow(page).getByTestId('storeel-moments-add').click(); // the Add Widget chooser (Chris, 8 Nov) → Moment
      await page.getByRole('menuitem', { name: /^Moment/ }).first().click();
      await page.getByRole('heading', { name: 'Add a Moment' }).waitFor({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(800);
      await page.locator('#moment-campaigns-toggle').click();
      await page.getByTestId('moment-campaigns').getByRole('checkbox', { name: /Spring Open House/ }).click();
      await page.getByRole('button', { name: /^Add all \(1\)$/ }).click();
      await page.waitForTimeout(2000);
      expect(state.linked.includes(12), `${tag}: Add a Moment linked Spring Open House`);
      expect(await ticked(page, 'Spring Open House') === true, `${tag}: …and it shows ticked in Select from Existing Campaigns`);
      await picker(page).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${tag}-04-add-a-moment-consistent.png` });

      // Review fix: with a search, Deselect All / Select All touch only the campaigns shown (saved links hidden stay)
      const search = picker(page).getByPlaceholder('Search campaigns...');
      await search.fill('Summer');
      await picker(page).getByText('Linked and removed when you press Save Changes.').click(); // closes the suggestions
      await picker(page).getByRole('button', { name: 'Deselect All', exact: true }).click();
      await search.fill('');
      await page.waitForTimeout(300);
      expect(await ticked(page, 'Summer BBQ') === false && await ticked(page, 'Spring Open House') === true && await ticked(page, 'Winter Tires') === true, `${tag}: searched Deselect All unticks only Summer BBQ`);
      await page.screenshot({ path: `${OUT}/${tag}-04b-search-deselect.png` });
      await search.fill('Summer');
      await picker(page).getByText('Linked and removed when you press Save Changes.').click(); // closes the suggestions
      await picker(page).getByRole('button', { name: 'Select All', exact: true }).click();
      await search.fill('');
      await page.waitForTimeout(300);
      expect(await ticked(page, 'Summer BBQ') === true && await ticked(page, 'Spring Open House') === true && await ticked(page, 'Winter Tires') === true, `${tag}: searched Select All adds Summer BBQ, keeps the rest`);

      // Deselect All / Select All, then untick Winter Tires → Save Changes unlinks only Winter Tires
      await picker(page).getByRole('button', { name: 'Deselect All', exact: true }).click();
      expect(await ticked(page, 'Spring Open House') === false && await ticked(page, 'Winter Tires') === false && await ticked(page, 'Summer BBQ') === false, `${tag}: Deselect All unticks all`);
      await picker(page).getByRole('button', { name: 'Select All', exact: true }).click();
      expect(await ticked(page, 'Spring Open House') && await ticked(page, 'Winter Tires') && await ticked(page, 'Summer BBQ'), `${tag}: Select All ticks all`);
      await row(page, 'Winter Tires').click();
      state.linkCalls = []; state.unlinkCalls = [];
      await flow(page).getByRole('button', { name: 'Save Changes', exact: true }).filter({ visible: true }).last().click();
      await page.getByText('Changes saved').first().waitFor({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1500);
      expect(JSON.stringify(state.unlinkCalls) === '[14]' && !state.linkCalls.length, `${tag}: only Winter Tires unlinked (links ${JSON.stringify(state.linkCalls)}, unlinks ${JSON.stringify(state.unlinkCalls)})`);
      expect(await pageHas(page, 'Spring Open House') && await pageHas(page, 'Summer BBQ') && !(await pageHas(page, 'Winter Tires')), `${tag}: the page shows Spring Open House + Summer BBQ`);
      await context.close();
    }

    // A failed POST: flow stays open, error at the bottom, retry links only what is missing
    {
      const { page, context, state } = await open({ width, height }, { linked: [14] });
      await openCampaign(page);
      await openEdit(page, width);
      await row(page, 'Summer BBQ').click();
      state.failNextLink = true;
      await flow(page).getByRole('button', { name: 'Save Changes', exact: true }).filter({ visible: true }).last().click();
      await page.waitForTimeout(2000);
      const err = "Your changes were saved, but the linked campaigns couldn't be updated. Try again.";
      expect(await flow(page).isVisible().catch(() => false), `${tag}: a failed link keeps the flow open`);
      // The action lines read "*…" without the full stop (Chris, 6 Nov); the Campaign card shows it at its bottom too.
      expect(await flow(page).getByTestId('st-action-lines').getByText(`*${err.replace(/\.$/, '')}`).isVisible().catch(() => false), `${tag}: the error is at the bottom, by the actions`);
      expect(await ticked(page, 'Summer BBQ') === true, `${tag}: the tick is kept`);
      await page.screenshot({ path: `${OUT}/${tag}-05-link-failed.png` });
      await flow(page).getByRole('button', { name: 'Save Changes', exact: true }).filter({ visible: true }).last().click();
      await page.getByText('Changes saved').first().waitFor({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1200);
      expect(JSON.stringify(state.linkCalls.map((c) => c.linked_memory_ids)) === '[[20],[20]]' && state.linked.includes(20), `${tag}: the retry links Summer BBQ (${JSON.stringify(state.linkCalls)})`);
      expect(!(await flow(page).count()), `${tag}: closed after the retry`);
      await context.close();
    }

    // No links: the box opens unticked; Create is unchanged (unticked, the list on ticking)
    {
      const { page, context, state } = await open({ width, height }, { linked: [] });
      await openCampaign(page);
      await openEdit(page, width);
      const box = picker(page).getByRole('checkbox', { name: 'Select from Existing Campaigns' });
      expect(await box.isVisible().catch(() => false) && !(await box.isChecked()), `${tag}: no links: the box opens unticked`);
      await box.check();
      await page.waitForTimeout(500);
      expect(await ticked(page, 'Summer BBQ') === false && ((await picker(page).textContent()) ?? '').includes('0 selected'), `${tag}: ticking it shows the list, nothing ticked`);
      await flow(page).getByRole('button', { name: /^(Cancel|Close)$/ }).filter({ visible: true }).last().click();
      await page.waitForTimeout(600);
      expect(!state.linkCalls.length && !state.unlinkCalls.length, `${tag}: Cancel saves nothing`);
      await page.getByRole('button', { name: 'Back', exact: true }).filter({ visible: true }).first().click();
      await page.getByText('All Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 10000 }).catch(() => {});
      await page.getByRole('button', { name: /^Create( a Campaign)?$/ }).filter({ visible: true }).last().click();
      const create = page.getByRole('dialog', { name: 'Create Campaign' });
      const cbox = create.locator('#st-pick-items').getByRole('checkbox', { name: 'Select from Existing Campaigns' });
      await cbox.waitFor({ timeout: 10000 }).catch(() => {});
      expect(await cbox.isVisible().catch(() => false) && !(await cbox.isChecked()), `${tag}: Create still has it, unticked`);
      await cbox.check();
      await page.waitForTimeout(500);
      expect(!(await create.getByText('Linked and removed when you press Save Changes.').count()), `${tag}: Create has no Edit note`);
      await create.locator('#st-pick-items').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${tag}-06-create-unchanged.png` });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall Edit linked-campaigns checks passed');
process.exit(failures.length ? 1 : 0);
