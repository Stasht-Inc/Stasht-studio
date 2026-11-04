// Storeel flow v2 (Deepak, 4 Nov 2026; Chris's single-page change the same day), in the real app (App → Campaigns →
// campaign page), at 1280 and 390: the campaign page's Edit (phones: the Timeline pencil) opens the one-page flow on
// that campaign — 1 Campaign prefilled, 2 Moments with its moments, 3 Send (optional) — with the actions at the end:
// Save Changes (PUT /memories/{id}, toast, back on the page) and Save & Send (PUT, then the confirm). No "Continue to
// Send" card, no resume note. Delete is in step 1. From the Campaigns page: Create Campaign → toast → the new campaign
// is in the Storeels list.
// node tests/campaign-detail/ui/storeel-edit-flow.mjs   (needs the dev server: CD_BASE, default http://localhost:5311)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: CD_SHOTS (default /private/tmp/claude-501/campaign-detail-ui/storeel-edit-flow).
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from './cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.CD_BASE || 'http://localhost:5311';
const OUT = process.env.CD_SHOTS || '/private/tmp/claude-501/campaign-detail-ui/storeel-edit-flow';
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

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }) {
  const state = { puts: [], sends: [], counts: 0, title: CAMPAIGN.title, deleted: false, created: [] };
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
    const campaign = () => ({ ...CAMPAIGN, title: state.title });
    if (p === '/memories' && m === 'GET') {
      const all = [...state.created, campaign()];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Campaigns', memory_count: all.length }] }, labels: { items: [] } } } } });
    }
    // Create Campaign (MemoriesController::store): the new campaign joins the list.
    if (p === '/memories' && m === 'POST') {
      const id = 950 + state.created.length;
      state.created.unshift({ ...CAMPAIGN, id, title: body?.title, slug: `new-${id}`, published: 0, created_at: '2026-11-04 10:00:00' });
      return route.fulfill({ json: { success: true, data: { id, title: body?.title, slug: `new-${id}`, category_id: body?.category_id } } });
    }
    if (p === '/memories/901' && m === 'GET') return route.fulfill({ json: { status: 'success', data: { memory: { ...campaign(), posts: [post(11, 1), post(12, 2), post(13, 3)], linked_memories: [], widgets: [], unified_order: null } } } });
    if (p === '/memories/901' && m === 'PUT') {
      state.puts.push(body);
      if (body?.title) state.title = body.title;
      return route.fulfill({ json: { success: true, message: 'Memory updated successfully.', data: campaign() } });
    }
    if (p === '/memories/901' && m === 'DELETE') { state.deleted = true; return route.fulfill({ json: { success: true } }); }
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 5, name: 'Campaigns', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/memories/901/storeel-audience-count') {
      state.counts++;
      const ch = body?.channels ?? [];
      return route.fulfill({ json: { success: true, data: { email: ch.includes('email') ? 1 : 0, sms: ch.includes('sms') ? 1 : 0, skipped: { no_email: 0, no_phone: 0, unsubscribed: 0, duplicate: 0 }, person: { email: null, sms: null, errors: {} } }, storeel: { max_messages: 1000, needed: ch.length, over_limit: false, sms: null, allowance: { plan: 'Professional', email_limit: 2500, sms_limit: 250, email_used: 0, sms_used: 0, email_pending: 0, sms_pending: 0, resets_at: '2026-12-01T05:00:00Z' } } } });
    }
    if (p === '/memories/901/storeel-send') {
      state.sends.push(body);
      return route.fulfill({ json: { success: true, data: { broadcast_id: 'b1', memory_id: 901, status: 'sent', channels: body.channels, replayed: false, published_now: false, texts_wait_until: null, counts: { recipients: 2, sent: 2, queued: 0, failed: 0, email: { sent: 1, queued: 0, failed: 0 }, sms: { sent: 1, queued: 0, failed: 0 }, skipped: { total: 0 } } } } });
    }
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
const primary = (page, name) => flow(page).getByRole('button', { name, exact: true }).filter({ visible: true }).last();

const openEdit = async (page, width) => {
  if (width >= 1024) await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click();
  else await page.getByRole('button', { name: 'Edit Campaign' }).filter({ visible: true }).first().click(); // phones: the Timeline pencil
  await flow(page).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await flow(page).getByPlaceholder('Give your campaign a meaningful title').waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
};

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const { page, context, state } = await open({ width, height });
    await openCampaign(page);
    await page.screenshot({ path: `${OUT}/${tag}-01-campaign-page.png` });

    // ── Edit: one page, prefilled, its moments in step 2 and the preview; Save Changes → PUT → toast, back on the page ─
    await openEdit(page, width);
    expect(await flow(page).isVisible(), `${tag}: Edit opens the Storeel flow (Edit Campaign)`);
    expect(!(await page.getByText('Start Date').filter({ visible: true }).count()), `${tag}: not the old Edit Campaign popover`);
    const title = flow(page).getByPlaceholder('Give your campaign a meaningful title');
    expect((await title.inputValue().catch(() => '')) === 'Fall Promo', `${tag}: step 1 prefilled with the campaign title`);
    const mtext = (await flow(page).locator('#st-step-moments').textContent()) ?? '';
    expect(mtext.includes('3 moments') && mtext.includes('Moment 1') && mtext.includes('Moment 3'), `${tag}: step 2 lists the campaign's 3 moments`);
    const ptext = (await flow(page).getByTestId('storeel-preview').textContent()) ?? '';
    expect(ptext.includes('3 moments'), `${tag}: the preview shows the campaign's 3 moments`);
    expect(((await flow(page).locator('#st-step-send').textContent()) ?? '').includes('Optional — send it now or later from the campaign page.'), `${tag}: Send is open and optional`);
    expect(!(await flow(page).getByRole('button', { name: /^(Continue|Done)$/ }).count()), `${tag}: no Continue / Done`);
    await page.screenshot({ path: `${OUT}/${tag}-02-edit-flow.png` });

    await title.fill('Fall Promo 2026');
    await primary(page, 'Save Changes').click();
    await page.getByText('Changes saved').first().waitFor({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    const put = state.puts.at(-1);
    expect(put && put.title === 'Fall Promo 2026' && !('category_id' in put) && put.date_range === 'Oct 1, 2026' && put.location === 'Toronto, ON' && JSON.stringify(put.tags) === '["fall"]',
      `${tag}: Save Changes = PUT /memories/901 (got ${JSON.stringify(put)})`);
    expect(await page.getByText('Changes saved').first().isVisible().catch(() => false), `${tag}: toast "Changes saved"`);
    expect(!(await flow(page).count()), `${tag}: Save Changes closes the flow`);
    expect(await page.getByText('Fall Promo 2026').filter({ visible: true }).count() > 0, `${tag}: back on the campaign page, refreshed`);
    expect(!state.sends.length, `${tag}: nothing sent`);
    expect(!(await page.getByRole('button', { name: 'Continue to Send' }).count()), `${tag}: no "Continue to Send" card`);
    await page.screenshot({ path: `${OUT}/${tag}-03-saved-back-on-page.png` });

    // ── Edit again → Save & Send → confirm → sent ──────────────────────────────────────────────────────────────────
    await openEdit(page, width);
    const send = flow(page).locator('#st-step-send');
    await send.getByLabel('Email address').fill('jordan@example.com');
    await send.getByLabel('Phone number').fill('4165550171');
    await send.getByLabel(/^Message/).fill('Our fall promo is on now.');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${tag}-05-send.png` });
    await primary(page, 'Save & Send').click();
    const confirm = page.getByRole('dialog', { name: 'Send this Storeel now?' });
    await confirm.waitFor({ timeout: 8000 }).catch(() => {});
    expect(state.puts.length === 2, `${tag}: Save & Send saved first (PUT)`);
    await confirm.getByRole('button', { name: 'Send Now' }).click();
    await page.getByText('Sent: 1 email and 1 text.').first().waitFor({ timeout: 8000 }).catch(() => {});
    expect(await page.getByText('Sent: 1 email and 1 text.').first().isVisible().catch(() => false), `${tag}: toast after sending`);
    expect(state.sends.length === 1 && JSON.stringify(state.sends[0].audience) === JSON.stringify([{ type: 'person', email: 'jordan@example.com', phone: '+14165550171' }]), `${tag}: send payload (${JSON.stringify(state.sends[0])})`);
    await page.waitForTimeout(500);
    expect(!(await flow(page).count()), `${tag}: the flow closed, back on the campaign page`);
    await page.screenshot({ path: `${OUT}/${tag}-06-sent.png` });

    // ── Delete is in step 1: it asks to confirm (the page's own dialog) ────────────────────────────────────────────
    await openEdit(page, width);
    await flow(page).getByRole('button', { name: 'Delete campaign' }).click();
    await page.waitForTimeout(500);
    expect(!(await flow(page).count()), `${tag}: Delete closes the flow`);
    expect(await page.getByRole('alertdialog').isVisible().catch(() => false), `${tag}: the page asks before deleting`);
    await page.screenshot({ path: `${OUT}/${tag}-07-delete-asks.png` });
    await page.keyboard.press('Escape');
    expect(!state.deleted, `${tag}: nothing deleted without confirming`);
    expect(!(await page.evaluate(() => sessionStorage.getItem('stasht_storeel_flow_resume'))), `${tag}: no resume note`);

    // ── Create from the Campaigns page → Create Campaign → Done → the new campaign is in the Storeels list ─────────
    await page.getByRole('button', { name: 'Back', exact: true }).filter({ visible: true }).first().click();
    await page.getByText('All Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 10000 }).catch(() => {});
    // The Campaigns page's own "+ Create a Campaign" (the Sidebar's opens on Newsletter, by design).
    await page.getByRole('button', { name: /^Create( a Campaign)?$/ }).filter({ visible: true }).last().click(); // phones: "Create"
    const create = page.getByRole('dialog', { name: 'Create Campaign' });
    await create.getByPlaceholder('Give your campaign a meaningful title').waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
    await create.getByPlaceholder('Give your campaign a meaningful title').fill(`Winter tires ${tag}`);
    // This account has no "Personal" category to default to: pick its own.
    await create.locator('#st-step-campaign').getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Campaigns' }).click();
    await page.waitForTimeout(400);
    expect(!state.created.length, `${tag}: nothing created before Create Campaign`);
    await create.locator('#st-step-moments').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${tag}-08-create-one-page.png` });
    await create.getByRole('button', { name: 'Create Campaign', exact: true }).filter({ visible: true }).last().click();
    await page.waitForTimeout(1500);
    expect(state.created.length === 1, `${tag}: Create Campaign made one campaign (got ${state.created.length})`);
    expect(!(await create.count()), `${tag}: Create Campaign closes`);
    expect(await page.getByText('Campaign created').first().isVisible().catch(() => false), `${tag}: toast "Campaign created"`);
    expect(await page.getByText(`Winter tires ${tag}`).filter({ visible: true }).count() > 0, `${tag}: the Campaigns list shows the new campaign`);
    await page.screenshot({ path: `${OUT}/${tag}-09-campaigns-list-after-done.png` });
    await context.close();
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall Storeel edit flow checks passed');
process.exit(failures.length ? 1 : 0);
