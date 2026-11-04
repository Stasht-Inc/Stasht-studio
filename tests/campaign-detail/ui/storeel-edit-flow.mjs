// Chris, 4 Nov 2026, points 8-9: on the campaign page, Edit (and the phone ⋮ menu's Edit Campaign) opens the Storeel
// flow on that campaign — Set up prefilled, Continue saves with PUT /memories/{id}, then Moments and Send again — not
// the old Edit Campaign popover. Delete is in Set up. "Add moments on the campaign page" closes the flow and the page
// offers "Continue to Send"; Back to Campaigns also reopens the flow on Send.
// Checks at 1280 and 390 in the real app (App → Campaigns → campaign page).
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
  const state = { puts: [], sends: [], counts: 0, title: CAMPAIGN.title, deleted: false };
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
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: [campaign()], total: 1 }, latest_memories: [campaign()], sidebar: { categories: { items: [{ id: 5, name: 'Campaigns', memory_count: 1 }] }, labels: { items: [] } } } } });
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

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const { page, context, state } = await open({ width, height });
    await openCampaign(page);
    await page.screenshot({ path: `${OUT}/${tag}-01-campaign-page.png` });

    // Edit: the desktop header's Edit; phones: the Timeline row's pencil.
    if (width >= 1024) {
      await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click();
    } else {
      // Phones: the pencil in the Timeline row.
      await page.getByRole('button', { name: 'Edit Campaign' }).filter({ visible: true }).first().click();
    }
    await flow(page).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    expect(await flow(page).isVisible(), `${tag}: Edit opens the Storeel flow (Edit Campaign)`);
    expect(!(await page.getByText('Start Date').filter({ visible: true }).count()), `${tag}: not the old Edit Campaign popover`);
    const title = flow(page).getByPlaceholder('Give your campaign a meaningful title');
    await title.waitFor({ timeout: 10000 }).catch(() => {});
    expect((await title.inputValue().catch(() => '')) === 'Fall Promo', `${tag}: Set up prefilled with the campaign title`);
    expect((await flow(page).locator('#st-step-moments').textContent())?.includes('3 moments'), `${tag}: Moments says 3 moments`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${tag}-02-edit-flow.png` });

    await title.fill('Fall Promo 2026');
    await primary(page, 'Continue').click();
    await flow(page).locator('#st-step-moments').getByRole('button', { name: 'Add moments on the campaign page' }).waitFor({ timeout: 8000 }).catch(() => {});
    const put = state.puts.at(-1);
    expect(put && put.title === 'Fall Promo 2026' && Number(put.category_id) === 5 && put.date_range === 'Oct 1, 2026' && put.location === 'Toronto, ON' && JSON.stringify(put.tags) === '["fall"]',
      `${tag}: Continue saved with PUT /memories/901 (got ${JSON.stringify(put)})`);
    await primary(page, 'Continue').click();
    const send = flow(page).locator('#st-step-send');
    await send.getByLabel('Email address').fill('jordan@example.com');
    await send.getByLabel('Phone number').fill('4165550171');
    await send.getByLabel(/^Message/).fill('Our fall promo is on now.');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${tag}-03-send.png` });
    await primary(page, 'Send Now').click();
    const confirm = page.getByRole('dialog', { name: 'Send this Storeel now?' });
    await confirm.waitFor({ timeout: 8000 }).catch(() => {});
    await confirm.getByRole('button', { name: 'Send Now' }).click();
    await page.getByText('Sent: 1 email and 1 text.').first().waitFor({ timeout: 8000 }).catch(() => {});
    expect(await page.getByText('Sent: 1 email and 1 text.').first().isVisible().catch(() => false), `${tag}: toast after sending again`);
    expect(state.sends.length === 1 && JSON.stringify(state.sends[0].audience) === JSON.stringify([{ type: 'person', email: 'jordan@example.com', phone: '+14165550171' }]), `${tag}: send payload (${JSON.stringify(state.sends[0])})`);
    await page.waitForTimeout(500);
    expect(!(await flow(page).count()), `${tag}: the flow closed, back on the campaign page`);
    await page.screenshot({ path: `${OUT}/${tag}-04-sent.png` });

    // Add moments on the campaign page → the page offers Continue to Send.
    if (width >= 1024) await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click();
    else {
      await page.getByRole('button', { name: 'Edit Campaign' }).filter({ visible: true }).first().click();
    }
    await flow(page).waitFor({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    await primary(page, 'Continue').click();
    await flow(page).locator('#st-step-moments').getByRole('button', { name: 'Add moments on the campaign page' }).click();
    await page.waitForTimeout(800);
    expect(!(await flow(page).count()), `${tag}: the flow closes for the campaign page`);
    const resume = page.getByRole('button', { name: 'Continue to Send' });
    expect(await resume.isVisible().catch(() => false), `${tag}: the campaign page offers Continue to Send`);
    await page.screenshot({ path: `${OUT}/${tag}-05-continue-to-send.png` });
    await resume.click();
    await flow(page).locator('#st-step-send').getByLabel('Email address').waitFor({ timeout: 8000 }).catch(() => {});
    expect(await flow(page).locator('#st-step-send').getByLabel('Email address').isVisible().catch(() => false), `${tag}: Continue to Send opens the flow on Send`);
    await page.screenshot({ path: `${OUT}/${tag}-06-back-on-send.png` });

    // Delete is in Set up: it asks to confirm (the page's own dialog).
    await flow(page).locator('#st-step-setup').getByRole('button', { name: 'Edit' }).click();
    await flow(page).getByRole('button', { name: 'Delete campaign' }).click();
    await page.waitForTimeout(500);
    expect(!(await flow(page).count()), `${tag}: Delete closes the flow`);
    const ask = page.getByRole('alertdialog');
    expect(await ask.isVisible().catch(() => false), `${tag}: the page asks before deleting`);
    await page.screenshot({ path: `${OUT}/${tag}-07-delete-asks.png` });
    await page.keyboard.press('Escape');
    expect(!state.deleted, `${tag}: nothing deleted without confirming`);

    // Coming back to Campaigns after "Add moments": the flow opens on Send there too.
    if (width >= 1024) await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click();
    else {
      await page.getByRole('button', { name: 'Edit Campaign' }).filter({ visible: true }).first().click();
    }
    await flow(page).waitFor({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    await primary(page, 'Continue').click();
    await flow(page).locator('#st-step-moments').getByRole('button', { name: 'Add moments on the campaign page' }).click();
    await page.waitForTimeout(800);
    // The campaign page's own Back.
    await page.getByRole('button', { name: 'Back', exact: true }).filter({ visible: true }).first().click();
    await page.getByRole('dialog', { name: 'Edit Campaign' }).waitFor({ timeout: 10000 }).catch(() => {});
    const onSend = await page.getByRole('dialog', { name: 'Edit Campaign' }).locator('#st-step-send').getByLabel('Email address').isVisible().catch(() => false);
    expect(onSend, `${tag}: back on Campaigns, the flow opens again on Send`);
    await page.screenshot({ path: `${OUT}/${tag}-08-back-to-campaigns-resumes.png` });
    await flow(page).getByRole('button', { name: 'Cancel' }).filter({ visible: true }).first().click();
    await page.waitForTimeout(600);
    expect(await page.getByText('All Campaigns', { exact: true }).filter({ visible: true }).count() > 0, `${tag}: under the flow was the Campaigns page`);
    expect(!(await page.evaluate(() => sessionStorage.getItem('stasht_storeel_flow_resume'))), `${tag}: the note is used once`);
    await page.screenshot({ path: `${OUT}/${tag}-09-campaigns-after-cancel.png` });
    await context.close();
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall Storeel edit flow checks passed');
process.exit(failures.length ? 1 : 0);
