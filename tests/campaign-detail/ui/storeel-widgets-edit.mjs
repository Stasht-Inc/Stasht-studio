// Chris, 8 Nov 2026 (points 1, 2), in the real app (App → Campaigns → campaign page) at 1280 and 390:
//  - Edit a Storeel: a "+" in the phone preview opens the campaign page's Add Widget chooser (every option, DocuSign
//    when connected — only while FEATURES.docusign is on: hidden everywhere since 8 Nov 2026, and its status / envelopes
//    endpoints are not called); each option opens the campaign page's OWN editor ON TOP of the Storeel page, at that place;
//    Call to Action / HTML / Quote save as on the campaign page (POST /memories/901/widgets with the moment's id) and
//    the phone shows them; Moment → Add a Moment → Campaigns (optional) links campaigns at the "+"
//    (POST /memories/901/linked-memories after that moment) and they show as campaign cards;
//  - the campaign page's own Add a Moment: Media tab + Campaigns (optional) → linked;
//  - a widget picked before the Storeel existed: the campaign page opens Edit Storeel with that editor.
// node tests/campaign-detail/ui/storeel-widgets-edit.mjs  (CD_BASE = the dev server)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from './cover-fixtures.mjs';
import { DOCUSIGN_ENABLED } from '../../../constants/features.ts';

const { chromium } = pw;
const BASE = process.env.CD_BASE || 'http://localhost:5311';
const OUT = process.env.CD_SHOTS || '/private/tmp/claude-501/campaign-detail-ui/storeel-widgets-edit';
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
const OTHERS = [
  { ...CAMPAIGN, id: 701, title: 'Open House Weekend', slug: 'open-house', last_update_img: img(2), posts_count: 4 },
  { ...CAMPAIGN, id: 702, title: 'Kitchen Reno', slug: 'kitchen-reno', last_update_img: img(1), posts_count: 2 },
];
// Review I1: added in this order after Moment 1 — CTA, Quote, HTML — plus a pinned Share Request a Moment.
const W = (id, type, after, order, data) => ({ id, widget_type: type, after_post_id: after, widget_order: order, widget_data: data, admin_approval: 1, is_visible: true, created_at: '2026-11-08 10:00:00' });
const SEEDED = [
  W(5001, 'cta', 11, 0, { title: 'Ready to visit?', buttonText: 'Book a tour', buttonLink: 'https://example.com/tour' }),
  W(5002, 'quote', 11, 1, { text: 'Home is where the heart is.' }),
  W(5003, 'html', 11, 2, { title: '', content: '<p><strong>Open daily</strong> 9–5</p>' }),
  W(5004, 'cta', 12, 0, { title: '', buttonText: 'Share a Moment', mode: 'request_moment', pinToBottom: true }),
];
const ALL = ['Moment', 'Call to Action', 'Share Request a Moment', 'Voice to Text', 'HTML', 'Youtube', 'Quote', 'AI Creator', 'Shopify Product', ...(DOCUSIGN_ENABLED ? ['DocuSign'] : [])];

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height, intent = null, widgets = [] }) {
  const state = { widgets: structuredClone(widgets), widgetPosts: [], linked: [], linkCalls: [], nextWidget: 4000, docuSignCalls: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user, intent]) => {
    if (sessionStorage.getItem('cd-seeded')) return;
    sessionStorage.setItem('cd-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'main-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels');
    if (intent) sessionStorage.setItem('stasht_storeel_widget_intent', JSON.stringify({ ...intent, at: Date.now() }));
  }, [MAIN, intent]);
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
      const linked = state.linked.map((id) => ({ ...OTHERS.find((o) => o.id === id), is_car: 0 }));
      const order = [{ type: 'post', id: 11 }, ...state.linked.map((id) => ({ type: 'linked_memory', id })), { type: 'post', id: 12 }, { type: 'post', id: 13 }];
      return route.fulfill({ json: { status: 'success', data: { memory: { ...CAMPAIGN, posts: [post(11, 1), post(12, 2), post(13, 3)], widgets: [] }, linked_memories: linked, unified_order: state.linked.length ? order : null } } });
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
      const fresh = (body.linked_memory_ids || []).filter((id) => !state.linked.includes(id));
      state.linked.push(...fresh);
      return route.fulfill({ json: { success: true, data: { linked: fresh.length, already_linked_ids: [] } } });
    }
    if (/docusign/i.test(p)) state.docuSignCalls.push(`${m} ${p}`);
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
  await page.waitForTimeout(1500);
}

const flow = (page) => page.getByRole('dialog', { name: 'Edit Campaign' });
const preview = (page) => page.getByTestId('storeel-preview');
const chooser = (page) => page.getByTestId('add-widget-chooser');
const previewKeys = (page) => page.getByTestId('storeel-preview-moments').locator(':scope > li[data-moment-key]').evaluateAll((items) => items.map((li) => li.getAttribute('data-moment-key')));
const openEdit = async (page, width) => {
  if (width >= 1024) await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click();
  else await page.getByRole('button', { name: 'Edit Campaign' }).filter({ visible: true }).first().click();
  await flow(page).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
};
async function plusAfterMoment1(page) {
  const b = preview(page).getByRole('button', { name: 'Add a moment after Moment 1', exact: true });
  await b.scrollIntoViewIfNeeded();
  await b.click();
  await chooser(page).waitFor();
  await page.waitForTimeout(700);
}
async function pick(page, label) {
  await chooser(page).getByRole('menuitem', { name: new RegExp(`^${label}`) }).click();
  await page.waitForTimeout(700);
}
/** True when the element at the centre of `locator` belongs to it (it is on top of the Storeel page). */
const onTop = (locator) => locator.first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(r.height / 2, 60));
  return Boolean(hit && el.contains(hit));
});
async function inView(page, locator) {
  const box = await locator.first().boundingBox();
  const vp = page.viewportSize();
  return Boolean(box && vp && box.y >= 0 && box.y + box.height <= vp.height + 1 && box.x >= 0 && box.x + box.width <= vp.width + 1);
}

/** The y of the first visible element matching `selector` that contains `text`. */
const yOf = (page, selector, text) => page.locator(selector).filter({ hasText: text }).filter({ visible: true }).first().boundingBox().then((b) => b?.y ?? NaN).catch(() => NaN);

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);

    // ── Review I1: the preview orders widgets exactly like the campaign page ───────────────────────────────────
    {
      const o = await open({ width, height, widgets: SEEDED });
      await openCampaign(o.page);
      await o.page.waitForTimeout(1500);
      const pageOrder = [
        ['html', await yOf(o.page, 'div.rounded-2xl', 'Open daily')],
        ['quote', await yOf(o.page, 'div.rounded-2xl', 'Home is where the heart is.')],
        ['cta', await yOf(o.page, 'a, button', 'Book a tour')],
        ['pinned', await yOf(o.page, 'button', 'Share a Moment')],
      ].filter(([, y]) => Number.isFinite(y)).sort((a, b) => a[1] - b[1]).map(([k]) => k);
      await o.page.screenshot({ path: `${OUT}/${tag}-00-campaign-page-order.png` });
      await openEdit(o.page, width);
      const previewOrder = await o.page.getByTestId('storeel-preview-moments').evaluate((ul) => {
        const out = [];
        for (const el of ul.querySelectorAll('[data-preview-widget], li[data-moment-key]')) {
          if (el.matches('li')) { if (el.getAttribute('data-moment-key') === 'post-13') out.push('moment3'); continue; }
          const kind = el.getAttribute('data-preview-widget');
          out.push(kind === 'cta' && el.textContent.includes('Share a Moment') ? 'pinned' : kind);
        }
        return out;
      });
      expect(JSON.stringify(previewOrder) === JSON.stringify(['html', 'quote', 'cta', 'moment3', 'pinned']), `${tag}: preview order HTML, Quote, CTA, …, pinned last (got ${previewOrder})`);
      expect(JSON.stringify(pageOrder) === JSON.stringify(['html', 'quote', 'cta', 'pinned']), `${tag}: the campaign page shows the same order (got ${pageOrder})`);
      await o.page.getByTestId('storeel-preview-moments').locator('[data-preview-widget="quote"]').scrollIntoViewIfNeeded();
      await o.page.screenshot({ path: `${OUT}/${tag}-00b-preview-order.png` });
      await o.context.close();
    }

    const { page, context, state } = await open({ width, height });
    await openCampaign(page);
    await openEdit(page, width);

    // ── The chooser, from a "+" in the preview ──────────────────────────────────────────────────────────────────
    await plusAfterMoment1(page);
    const labels = await chooser(page).getByRole('menuitem').evaluateAll((els) => els.map((e) => e.querySelector('p')?.textContent?.trim()));
    expect(JSON.stringify(labels) === JSON.stringify(ALL), `${tag}: every option, DocuSign ${DOCUSIGN_ENABLED ? 'when connected' : 'hidden even though connected'} (got ${labels})`);
    if (!DOCUSIGN_ENABLED) expect(state.docuSignCalls.length === 0, `${tag}: DocuSign hidden — no DocuSign endpoint called (got ${JSON.stringify(state.docuSignCalls)})`);
    expect(await inView(page, chooser(page)), `${tag}: the chooser is in the viewport`);
    await page.screenshot({ path: `${OUT}/${tag}-01-chooser.png` });

    // ── Call to Action: the campaign page's editor on top, saved after Moment 1, shown in the phone ─────────────
    await pick(page, 'Call to Action');
    const cta = page.getByRole('dialog').filter({ hasText: 'Add a title and a button that links somewhere' });
    await cta.waitFor({ timeout: 8000 }).catch(() => {});
    expect(await cta.isVisible().catch(() => false) && await onTop(cta.getByPlaceholder('e.g. Book Now')), `${tag}: Call to Action opens the campaign page's editor on top of the Storeel page`);
    await page.screenshot({ path: `${OUT}/${tag}-02-cta-editor.png` });
    await cta.getByPlaceholder('e.g. Ready to book your stay?').fill('Ready to visit?');
    await cta.getByPlaceholder('e.g. Book Now').fill('Book a tour');
    await cta.getByPlaceholder('https://example.com').fill('https://example.com/tour');
    await cta.getByRole('button', { name: 'Add Call to Action' }).click();
    await page.waitForTimeout(1500);
    const ctaPost = state.widgetPosts.find((b) => b.widget_type === 'cta');
    expect(ctaPost && String(ctaPost.after_post_id) === '11', `${tag}: saved after Moment 1 (got ${JSON.stringify(ctaPost && { a: ctaPost.after_post_id, t: ctaPost.widget_type })})`);
    expect(await flow(page).isVisible(), `${tag}: back on the Storeel page`);
    const ctaCard = preview(page).locator('[data-preview-widget="cta"]');
    expect(await ctaCard.count() === 1 && ((await ctaCard.textContent()) ?? '').includes('Book a tour'), `${tag}: the phone shows the Call to Action`);
    const ctaAfter = await page.getByTestId('storeel-preview-moments').locator('li[data-moment-key="post-11"] [data-preview-widget="cta"]').count();
    expect(ctaAfter === 1, `${tag}: …right after Moment 1`);
    await ctaCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${tag}-03-cta-in-preview.png` });

    // ── Quote and HTML the same way ────────────────────────────────────────────────────────────────────────────
    await plusAfterMoment1(page);
    await pick(page, 'Quote');
    const quote = page.getByRole('dialog').filter({ has: page.getByPlaceholder('Enter your quote here...') });
    expect(await onTop(quote.getByPlaceholder('Enter your quote here...')), `${tag}: Quote editor on top`);
    await quote.getByPlaceholder('Enter your quote here...').fill('Home is where the heart is.');
    await quote.getByRole('button', { name: 'Add Quote' }).click();
    await page.waitForTimeout(1500);
    expect(state.widgetPosts.some((b) => b.widget_type === 'quote' && String(b.after_post_id) === '11'), `${tag}: Quote saved after Moment 1`);
    expect(await preview(page).locator('[data-preview-widget="quote"]').count() === 1, `${tag}: the phone shows the Quote`);

    await plusAfterMoment1(page);
    await pick(page, 'HTML');
    const html = page.getByRole('dialog').filter({ has: page.getByPlaceholder('Paste your HTML code here...') });
    expect(await onTop(html.getByPlaceholder('Paste your HTML code here...')), `${tag}: HTML editor on top`);
    await html.getByPlaceholder('Paste your HTML code here...').fill('<p><strong>Open daily</strong> 9–5</p>');
    await html.getByRole('button', { name: 'Add HTML' }).click();
    await page.waitForTimeout(1500);
    expect(state.widgetPosts.some((b) => b.widget_type === 'html' && String(b.after_post_id) === '11'), `${tag}: HTML saved after Moment 1`);
    expect(await preview(page).locator('[data-preview-widget="html"]').count() === 1, `${tag}: the phone shows the HTML`);
    await preview(page).locator('[data-preview-widget="html"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${tag}-04-widgets-in-preview.png` });

    // ── The other options open their editors on top (closed without saving) ────────────────────────────────────
    for (const [label, text] of [['Share Request a Moment', 'Visitors tap this button to submit a photo and caption'], ['Youtube', 'Embed YouTube Video'], ['AI Creator', 'AI Creator'], ['Voice to Text', 'Add Voice to Text Memo'], ['Shopify Product', 'Add Shopify Products'], ...(DOCUSIGN_ENABLED ? [['DocuSign', 'Send for Signature']] : [])]) {
      await plusAfterMoment1(page);
      await pick(page, label);
      // Share Request a Moment: its button-text field (the subtitle is desktop only).
      const el = (label === 'Share Request a Moment' ? page.getByPlaceholder('e.g. Book Now') : page.getByText(text, { exact: true })).filter({ visible: true }).first();
      const shown = await el.isVisible().catch(() => false);
      expect(shown && await onTop(el), `${tag}: ${label} opens its editor on top`);
      if (label === 'Share Request a Moment') await page.screenshot({ path: `${OUT}/${tag}-05-request-editor.png` });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      // Editors without Esc: their own close / Cancel.
      if (label === 'Shopify Product' && await el.isVisible().catch(() => false)) {
        await el.locator('xpath=../../..').locator(':scope > button').click(); // the picker's ✕
        await page.waitForTimeout(500);
      }
      if (label === 'DocuSign' && await el.isVisible().catch(() => false)) {
        await el.locator('xpath=../..').locator(':scope > button').click(); // the window's ✕
        await page.waitForTimeout(500);
      }
      if (await el.isVisible().catch(() => false)) {
        const close = page.getByRole('button', { name: /^(Cancel|Close)$/ }).filter({ visible: true }).last();
        if (await close.count()) await close.click(); else await page.locator('button:has(svg.lucide-x)').filter({ visible: true }).last().click();
        await page.waitForTimeout(500);
      }
      expect(await flow(page).isVisible() && !(await el.isVisible().catch(() => false)), `${tag}: ${label} closed, the Storeel page is back`);
    }
    expect(state.widgetPosts.length === 3, `${tag}: only the 3 saved widgets were created (got ${state.widgetPosts.length})`);

    // ── Moment → Add a Moment → Campaigns (optional) → linked after Moment 1 ───────────────────────────────────
    await plusAfterMoment1(page);
    await pick(page, 'Moment');
    await page.getByRole('heading', { name: 'Add a Moment' }).waitFor();
    await page.waitForTimeout(800);
    expect(!(await page.getByRole('radiogroup', { name: 'Add from' }).count()), `${tag}: no products / vehicles: no tab bar`);
    await page.locator('#moment-campaigns-toggle').click();
    await page.getByTestId('moment-campaigns').getByRole('checkbox', { name: /Open House Weekend/ }).click();
    await page.getByTestId('moment-campaigns').getByRole('checkbox', { name: /Kitchen Reno/ }).click();
    expect(!(await page.getByTestId('moment-campaigns').getByRole('checkbox', { name: /Fall Promo/ }).count()), `${tag}: the campaign itself is not offered`);
    await page.screenshot({ path: `${OUT}/${tag}-06-edit-campaigns.png` });
    await page.getByRole('button', { name: 'Add all (2)' }).click();
    await page.waitForTimeout(2000);
    const link = state.linkCalls[0];
    expect(link && JSON.stringify(link.linked_memory_ids) === '[701,702]' && link.after_item_id === 11 && link.after_item_type === 'post', `${tag}: linked right after Moment 1 (got ${JSON.stringify(link)})`);
    const keys = await previewKeys(page);
    expect(keys[1] === 'campaign-701' && keys[2] === 'campaign-702', `${tag}: shown as campaign moments after Moment 1 (got ${keys})`);
    await page.getByTestId('storeel-preview-moments').locator('li[data-moment-key="campaign-701"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${tag}-07-linked-in-preview.png` });
    await context.close();

    // ── The campaign page's own Add a Moment: Media + Campaigns (optional) ─────────────────────────────────────
    const c = await open({ width, height });
    await openCampaign(c.page);
    if (width >= 768) await c.page.getByRole('button', { name: /Add a Moment/ }).filter({ visible: true }).first().click();
    else {
      const divider = c.page.locator('button:has(path[d="M12 5v14M5 12h14"])').filter({ visible: true }).first();
      await divider.scrollIntoViewIfNeeded();
      await divider.click();
      await c.page.waitForTimeout(300);
      await c.page.locator('button').filter({ hasText: /^Moment/ }).filter({ visible: true }).first().click();
    }
    await c.page.getByRole('heading', { name: 'Add a Moment' }).waitFor({ timeout: 10000 });
    await c.page.waitForTimeout(1000);
    await c.page.locator('#moment-campaigns-toggle').click();
    await c.page.getByTestId('moment-campaigns').getByRole('checkbox', { name: /Kitchen Reno/ }).click();
    const addAll = c.page.getByRole('button', { name: 'Add all (1)' });
    expect(await inView(c.page, addAll), `${tag}: campaign page: Add all (1) in view`);
    await c.page.screenshot({ path: `${OUT}/${tag}-08-campaign-page-campaigns.png` });
    await addAll.click();
    await c.page.waitForTimeout(1800);
    expect(c.state.linkCalls.length === 1 && JSON.stringify(c.state.linkCalls[0].linked_memory_ids) === '[702]', `${tag}: campaign page links it (got ${JSON.stringify(c.state.linkCalls)})`);
    expect(await c.page.getByText('1 campaign linked to your campaign.').first().isVisible().catch(() => false), `${tag}: toast says so`);
    await c.context.close();

    // ── Created on the Storeel page with a widget picked: the campaign page opens Edit + that editor ──────────
    const h = await open({ width, height, intent: { memoryId: 901, kind: 'quote', afterPostId: 12 } });
    await openCampaign(h.page);
    await h.page.waitForTimeout(1500);
    const q = h.page.getByRole('dialog').filter({ has: h.page.getByPlaceholder('Enter your quote here...') });
    expect(await flow(h.page).count() === 1 && await q.isVisible().catch(() => false), `${tag}: hand-off opens Edit Storeel with the Quote editor`);
    await h.page.screenshot({ path: `${OUT}/${tag}-09-handoff.png` });
    await q.getByPlaceholder('Enter your quote here...').fill('Welcome!');
    await q.getByRole('button', { name: 'Add Quote' }).click();
    await h.page.waitForTimeout(1500);
    expect(h.state.widgetPosts.some((b) => b.widget_type === 'quote' && String(b.after_post_id) === '12'), `${tag}: …saved at the "+" it was picked from (after Moment 2)`);
    await h.context.close();
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall Storeel widget (edit) checks passed');
process.exit(failures.length ? 1 : 0);
