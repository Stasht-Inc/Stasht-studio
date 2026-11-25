// tests/campaigns/ui/c24b-widgets-inplace.mjs — Deepak 24 Nov 2026 (P1): on Create Storeel every "+" option works in
// place (no "Save this Storeel as a draft first?"). In the real app at 1280 and 390 (every API call answered here,
// every non-local request aborted: nothing leaves this machine).
//  1280: Create → title + category → Add a Moment → a photo → the preview's "+" after it → Call to Action → fill → Add
//   → it shows in the preview at that "+" (nothing sent) → "+" at the top → Quote → "+" after the photo → YouTube, HTML
//   → the Quote's ⋮ → Move down (now after the photo) → the CTA's ⋮ → Edit → new title → Save Changes → AI Creator
//   (Generate with the campaign-less route) → Save as Draft → POST /memories, then one POST …/widgets per widget in the
//   preview's order, each after the new photo's id, with exactly the campaign page's widget_data.
//  390 (no preview): Moments card's Add a Moment → Call to Action / Quote / YouTube / HTML / Share Request a Moment,
//   each listed under the moments (Widgets) → Remove the Quote → Move the HTML up → Save as Draft → the same requests.
//  Failure: a widget the API refuses is named in a message; the Storeel is still made.
//  Edit Storeel (the campaign exists, opened from its page): the preview's "+" → Call to Action opens the campaign
//   page's editor and Add saves it at once (POST …/widgets before any Save).
// node tests/campaigns/ui/c24b-widgets-inplace.mjs  (C24BW_BASE = dev server, default http://127.0.0.1:5191; C24BW_SHOTS)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.C24BW_BASE || 'http://127.0.0.1:5191';
const OUT = process.env.C24BW_SHOTS || '/Users/deepaksharma/Pictures/Personal-Works/Stasht-Project/handoff-20261114/c24b-widgets-inplace-shots';
mkdirSync(OUT, { recursive: true });

const LOGO = `${BASE}/cd-img/logo.png`;
const MAIN = { id: 70, external_user_id: 707, name: 'TheBodyPolitik', email: 'owner@bodypolitik.test', role: '2', status: 1, is_activated: true, profile_color: '#4A6B50', avatar: LOGO, profile_image: LOGO };
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#4A6B50"/><text x="40" y="230" font-size="70" fill="#F3EDE4" font-family="Georgia">TBP</text></svg>`;
const photoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#E8A27C"/><circle cx="300" cy="200" r="90" fill="#fff"/></svg>`;
const img = (n) => `${BASE}/cd-img/${n}.jpg`;
const JPEG = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex');

const NEW_ID = 970;
const POST_ID = 5001;
const NEW_CAMPAIGN = {
  id: NEW_ID, title: 'Spring Open House', user_id: 707, published: 0, slug: 'spring-open-house', category: { id: 5, name: 'Campaigns' }, sub_category: null,
  photos: { count: 1 }, posts_count: 1, collaborators: [], user: { id: 707, name: 'TheBodyPolitik', profile_image: LOGO, profile_color: '#4A6B50' },
  created_at: '2026-11-24 10:00:00', location: '', tags: [], min_uploaded_img_date: '2026-11-24', max_uploaded_img_date: '2026-11-24', last_update_img: null, is_owner: true,
};
const POST = {
  id: POST_ID, name: 'IMG_1.jpg', title: '', description: 'Our new kitchen', master_image_link: img('uploaded'), image_link: img('uploaded'), media_url: img('uploaded'),
  location: '', capture_date: '2026-11-24 10:00:00', uploaded_at: '2026-11-24 10:00:00', parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [], user: { id: 707, name: 'TheBodyPolitik', profile_image: LOGO, profile_color: '#4A6B50' },
};
const NEW_DETAIL = { ...NEW_CAMPAIGN, posts: [POST], linked_memories: [], unified_order: [{ id: POST_ID, type: 'post' }] };

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
// A fake microphone for Voice to Text (Deepgram's socket is answered below; needs the dev server started with
// VITE_DEEPGRAM_API_KEY set to any value, e.g. "test-key" — without it the Voice section is skipped and says so).
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });

async function open({ width, height, path = '/memories', failWidget = null, created = false, transcript = null }) {
  // log: every API write, in order (the create, then each widget).
  const state = { log: [], widgets: [], created, generate: [], uploads: 0 };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024, permissions: ['microphone'] });
  // Deepgram's live transcription socket, answered here: one final transcript once audio arrives.
  state.deepgram = 0;
  await context.routeWebSocket(/deepgram\.com/, (ws) => {
    state.deepgram += 1;
    let said = false;
    ws.onMessage(() => {
      if (said || !transcript) return;
      said = true;
      ws.send(JSON.stringify({ is_final: true, channel: { alternatives: [{ transcript }] } }));
    });
  });
  await context.addInitScript(([user]) => {
    // Not in the YouTube preview's (blocked) frame.
    try { if (window.top !== window || sessionStorage.getItem('cd-seeded')) return; } catch { return; }
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
    if (url.pathname === '/cd-img/logo.png') return route.fulfill({ contentType: 'image/svg+xml', body: logoSvg });
    if (url.pathname.startsWith('/cd-img/')) return route.fulfill({ contentType: 'image/svg+xml', body: photoSvg });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const m = req.method();
    let body = null;
    try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch { body = null; }
    if (p === '/memories' && m === 'GET') {
      const all = state.created ? [NEW_CAMPAIGN] : [];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length, pagination: { current_page: 1, last_page: 1 } }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Campaigns', memory_count: all.length }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories' && m === 'POST') {
      state.log.push({ what: 'create', body });
      state.created = true;
      return route.fulfill({ json: { success: true, data: { id: NEW_ID, title: body?.title, slug: 'spring-open-house', category_id: body?.category_id } } });
    }
    if (p === '/user/upload-image-with-metadata' && m === 'POST') {
      state.uploads += 1;
      return route.fulfill({ json: { success: true, data: { fileUrl: img('uploaded'), originalSizeMB: 0.2, capture_date: '2026-11-24' } } });
    }
    if (p === '/memories/ai-creator/generate' && m === 'POST') {
      state.generate.push(body);
      return route.fulfill({ json: { success: true, data: { text: '<span style="font-size:18px;">Welcome home!</span>', background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', is_dark: false, credits_used: 1 } } });
    }
    if (p === `/memories/${NEW_ID}` && m === 'GET') return route.fulfill({ json: { status: 'success', data: { memory: NEW_DETAIL, linked_memories: [], unified_order: NEW_DETAIL.unified_order } } });
    if (p === `/memories/${NEW_ID}` && m === 'PUT') return route.fulfill({ json: { success: true, data: NEW_CAMPAIGN } });
    if (p === `/memories/${NEW_ID}/widgets` && m === 'GET') return route.fulfill({ json: { success: true, data: state.widgets } });
    if (p === `/memories/${NEW_ID}/widgets` && m === 'POST') {
      state.log.push({ what: 'widget', body });
      if (failWidget && body?.widget_type === failWidget) return route.fulfill({ status: 500, json: { success: false, message: 'Server error' } });
      const w = { id: 800 + state.widgets.length, memory_id: NEW_ID, widget_type: body.widget_type, after_post_id: body.after_post_id, widget_order: body.widget_order, widget_data: body.widget_data, is_visible: true, admin_approval: 1, created_at: '2026-11-24T10:00:00Z', updated_at: '2026-11-24T10:00:00Z' };
      state.widgets.push(w);
      return route.fulfill({ json: { success: true, data: w } });
    }
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 5, name: 'Campaigns', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/products/status') return route.fulfill({ json: { success: true, data: { pilot: true, available: true, reason: null, can_create: true, counts: { total: 0, manual: 0, website: 0 }, default_currency: 'CAD' } } });
    if (p === '/products' && m === 'GET') return route.fulfill({ json: { success: true, data: { items: [], pagination: { current_page: 1, per_page: 200, total: 0, last_page: 1 } } } });
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: false, reason: 'not_available', item_count: 0 } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 1, memory_limit: 50 } } } });
    if (p === '/lead-groups') return route.fulfill({ json: { groups: [] } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('popup', (pp) => pp.close().catch(() => {}));
  await page.goto(`${BASE}${path}`);
  return { context, page, state };
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const visible = (loc) => loc.filter({ visible: true }).first();

async function startCreate(page) {
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /^Create( a Campaign)?$/ }).filter({ visible: true }).last().click();
  const create = page.getByRole('dialog', { name: 'Create Campaign' });
  await create.getByPlaceholder('Give your campaign a meaningful title').waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  await create.getByPlaceholder('Give your campaign a meaningful title').fill('Spring Open House');
  await create.locator('#st-step-campaign').getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Campaigns' }).click();
  await page.waitForTimeout(400);
  return create;
}

/** The Moments card's Add a Moment → the chooser → `kind`. */
async function cardPick(page, create, kind) {
  await create.getByTestId('storeel-moments-add').scrollIntoViewIfNeeded();
  await create.getByTestId('storeel-moments-add').click();
  await visible(page.locator(`[data-testid="add-widget-chooser"] [data-widget-kind="${kind}"]`)).click();
  await page.waitForTimeout(500);
}

/** The preview's "+" (aria-label) → the chooser → `kind`. */
async function previewPick(page, label, kind) {
  const plus = page.getByTestId('storeel-preview-add').and(page.getByLabel(label));
  await plus.scrollIntoViewIfNeeded();
  await plus.click();
  await visible(page.locator(`[data-testid="add-widget-chooser"] [data-widget-kind="${kind}"]`)).click();
  await page.waitForTimeout(500);
}

async function addPhoto(page, create) {
  await cardPick(page, create, 'moment');
  await page.getByRole('heading', { name: 'Add a Moment' }).waitFor({ timeout: 10000 });
  await page.locator('#file-upload').setInputFiles({ name: 'IMG_1.jpg', mimeType: 'image/jpeg', buffer: JPEG });
  await page.waitForTimeout(1500);
  await visible(page.getByPlaceholder('Describe this moment in detail...')).fill('Our new kitchen');
  await visible(page.getByRole('button', { name: /^Add all \(1\)/ })).click();
  await page.waitForTimeout(1200);
}

const noAsk = async (page, tag) => expect(await page.getByText('Save this Storeel as a draft first?').count() === 0, `${tag}: no "Save this Storeel as a draft first?" dialog`);
const dialog = (page, title) => page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: title }) });

async function fillCta(page, title) {
  const d = page.getByRole('dialog').filter({ hasText: 'Add a title and a button that links somewhere' }).last();
  await d.getByPlaceholder('e.g. Ready to book your stay?').fill(title);
  await d.getByPlaceholder('e.g. Book Now').fill('Book a viewing');
  await d.getByPlaceholder('https://example.com').fill('example.com/book');
  return d;
}
async function fillQuote(page) {
  const d = page.getByRole('dialog').filter({ hasText: 'Enter a quote and author' }).last();
  await d.getByPlaceholder('Enter your quote here...').fill('Home is where the heart is.');
  await d.getByPlaceholder('Enter author name here...').fill('Pliny');
  await d.getByRole('button', { name: 'Add Quote' }).click();
}
async function fillYoutube(page) {
  const d = page.getByRole('dialog').filter({ hasText: 'Enter a YouTube URL' }).last();
  await d.getByPlaceholder('Video title (optional)').fill('The tour');
  await d.getByPlaceholder('https://www.youtube.com/watch?v=...').fill('https://youtu.be/dQw4w9WgXcQ');
  await d.getByRole('button', { name: 'Add Video' }).click();
}
async function fillHtml(page) {
  const d = page.getByRole('dialog').filter({ hasText: 'HTML Content' }).last();
  await d.getByPlaceholder('Enter a title for this HTML block').fill('Opening hours');
  await d.getByPlaceholder('Paste your HTML code here...').fill('<p><strong>Sat</strong> 10–4</p>');
  await d.getByRole('button', { name: 'Add HTML' }).click();
}

const widgetPosts = (state) => state.log.filter((x) => x.what === 'widget').map((x) => x.body);

try {
  // ── 1280: the preview's "+" ─────────────────────────────────────────────────────────────────────────────────
  {
    const tag = '1280';
    console.log(`-- ${tag}`);
    const { page, context, state } = await open({ width: 1280, height: 900 });
    const create = await startCreate(page);
    await addPhoto(page, create);
    expect(await create.locator('[data-moment-row="photo"]').count() === 1, `${tag}: the photo is a moment`);

    // CTA at the "+" after the photo.
    await previewPick(page, 'Add a moment at the end', 'cta');
    await noAsk(page, tag);
    const ctaDialog = await fillCta(page, 'Ready to see it?');
    expect(await ctaDialog.getByRole('heading', { name: 'Add Call to Action' }).count() > 0, `${tag}: the campaign page's "Add Call to Action" editor opens over Create`);
    await shot(page, `${tag}-01-cta-editor`);
    await ctaDialog.getByRole('button', { name: 'Add Call to Action' }).click();
    await page.waitForTimeout(600);
    expect(state.log.length === 0, `${tag}: nothing is sent when the editor saves (${state.log.length} writes)`);
    const photoLi = page.locator('[data-testid="storeel-preview-moments"] > li[data-moment-kind="photo"]').first();
    expect(await photoLi.locator('[data-preview-widget="cta"]').count() === 1, `${tag}: the CTA shows in the preview after the photo`);
    expect((await photoLi.locator('[data-preview-widget="cta"]').innerText()).includes('Book a viewing'), `${tag}: … drawn with its title and button`);
    expect(await create.locator('[data-widget-row]').count() === 1, `${tag}: step 2 lists it under Widgets`);

    // Quote at the top, YouTube and HTML after the photo.
    await previewPick(page, 'Add a moment at the start', 'quote');
    await noAsk(page, tag);
    await fillQuote(page);
    await page.waitForTimeout(500);
    const topLi = page.locator('[data-testid="storeel-preview-moments"] > li[data-moment-kind="widgets"]');
    expect(await topLi.locator('[data-preview-widget="quote"]').count() === 1, `${tag}: the Quote shows at the top (under the cover)`);
    await previewPick(page, 'Add a moment at the end', 'youtube');
    await fillYoutube(page);
    await page.waitForTimeout(500);
    await previewPick(page, 'Add a moment at the end', 'html');
    await fillHtml(page);
    await page.waitForTimeout(500);
    const kinds = await photoLi.locator('[data-preview-widget]').evaluateAll((els) => els.map((e) => e.getAttribute('data-preview-widget')));
    expect(JSON.stringify(kinds) === JSON.stringify(['cta', 'youtube', 'html']), `${tag}: after the photo: CTA, YouTube, HTML in the order added ${JSON.stringify(kinds)}`);
    await page.getByTestId('storeel-preview-screen').evaluate((el) => { const li = el.querySelector('[data-moment-kind="widgets"]'); if (li) el.scrollTop = li.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 10; });
    await page.waitForTimeout(400);
    await page.locator('aside[aria-label="Storeel preview"]').screenshot({ path: `${OUT}/${tag}-02-preview-widgets.png` });

    // The Quote's ⋮ → Move down: past the photo, first after it.
    const quoteMenu = page.locator('[data-pending-widget]').filter({ has: page.locator('[data-preview-widget="quote"]') }).getByTestId('storeel-preview-widget-menu');
    await quoteMenu.click();
    await shot(page, `${tag}-03-widget-menu`);
    expect(await visible(page.getByRole('menuitem', { name: 'Move up' })).count() === 0, `${tag}: the top widget has no Move up`);
    await visible(page.getByRole('menuitem', { name: 'Move down' })).click();
    await page.waitForTimeout(400);
    const kinds2 = await photoLi.locator('[data-preview-widget]').evaluateAll((els) => els.map((e) => e.getAttribute('data-preview-widget')));
    expect(JSON.stringify(kinds2) === JSON.stringify(['quote', 'cta', 'youtube', 'html']), `${tag}: Move down put the Quote first after the photo ${JSON.stringify(kinds2)}`);

    // The CTA's ⋮ → Edit → the same editor, filled → Save Changes.
    await page.locator('[data-pending-widget]').filter({ has: page.locator('[data-preview-widget="cta"]') }).getByTestId('storeel-preview-widget-menu').click();
    await visible(page.getByRole('menuitem', { name: 'Edit' })).click();
    const editCta = page.getByRole('dialog').filter({ hasText: 'Edit Call to Action' }).last();
    await editCta.waitFor({ timeout: 5000 });
    expect(await editCta.getByPlaceholder('e.g. Ready to book your stay?').inputValue() === 'Ready to see it?', `${tag}: Edit opens the editor with the widget's own fields`);
    await editCta.getByPlaceholder('e.g. Ready to book your stay?').fill('Come and see it');
    await editCta.getByRole('button', { name: 'Save Changes' }).click();
    await page.waitForTimeout(400);
    expect((await photoLi.locator('[data-preview-widget="cta"]').innerText()).includes('Come and see it'), `${tag}: the preview shows the edited CTA`);

    // AI Creator: Generate (no campaign yet) → Add to Timeline.
    await previewPick(page, 'Add a moment at the end', 'ai_creator');
    const ai = page.getByRole('dialog').filter({ hasText: 'Generate custom content with AI' }).last();
    await ai.getByPlaceholder(/Describe the content you want to create/).fill('A warm welcome');
    await ai.getByRole('button', { name: /Generate/ }).click();
    await page.waitForTimeout(800);
    expect(state.generate.length === 1 && state.generate[0].prompt === 'A warm welcome' && state.generate[0].after_post_id === null, `${tag}: AI Creator generates with the campaign-less route ${JSON.stringify(state.generate[0] || {})}`);
    await shot(page, `${tag}-04-ai-creator`);
    await ai.getByRole('button', { name: 'Add to Timeline' }).click();
    await page.waitForTimeout(500);
    expect(await photoLi.locator('[data-preview-widget="ai_creator"]').count() === 1, `${tag}: the AI Creator content shows after the photo`);
    expect(state.log.length === 0, `${tag}: still nothing sent before Save as Draft`);
    await create.locator('#st-step-moments').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shot(page, `${tag}-05-step2-widgets`);

    // Save as Draft: the Storeel, then each widget at its place.
    await create.getByRole('button', { name: 'Save as Draft', exact: true }).filter({ visible: true }).last().click();
    await page.waitForTimeout(3000);
    expect(state.log[0]?.what === 'create', `${tag}: POST /memories first`);
    const posts = widgetPosts(state);
    expect(JSON.stringify(posts.map((b) => b.widget_type)) === JSON.stringify(['quote', 'cta', 'youtube', 'html', 'ai_creator']), `${tag}: then one POST …/widgets per widget, in the preview's order ${JSON.stringify(posts.map((b) => b.widget_type))}`);
    expect(posts.every((b) => b.after_post_id === String(POST_ID)), `${tag}: each after the new photo's id ${POST_ID} ${JSON.stringify(posts.map((b) => b.after_post_id))}`);
    expect(JSON.stringify(posts.map((b) => b.widget_order)) === '[0,1,2,3,4]', `${tag}: numbered in that place ${JSON.stringify(posts.map((b) => b.widget_order))}`);
    const ctaBody = posts.find((b) => b.widget_type === 'cta')?.widget_data || {};
    expect(ctaBody.title === 'Come and see it' && ctaBody.buttonText === 'Book a viewing' && ctaBody.buttonLink === 'https://example.com/book' && ctaBody.mode === 'link'
      && ctaBody.buttonColor === '#6C60FF' && ctaBody.textColor === '#FFFFFF' && ctaBody.fontSize === 16 && ctaBody.borderRadius === 12 && ctaBody.buttonWidth === 0 && ctaBody.pinToBottom === false,
      `${tag}: the CTA carries the campaign page editor's widget_data ${JSON.stringify(ctaBody)}`);
    const q = posts.find((b) => b.widget_type === 'quote')?.widget_data || {};
    expect(q.text === 'Home is where the heart is.' && q.author === 'Pliny', `${tag}: the Quote's text and author`);
    const y = posts.find((b) => b.widget_type === 'youtube')?.widget_data || {};
    expect(y.videoId === 'dQw4w9WgXcQ' && y.url === 'https://youtu.be/dQw4w9WgXcQ' && y.title === 'The tour', `${tag}: the YouTube video id, url and title`);
    const h = posts.find((b) => b.widget_type === 'html')?.widget_data || {};
    expect(h.title === 'Opening hours' && h.content === '<p><strong>Sat</strong> 10–4</p>', `${tag}: the HTML title and content`);
    const a = posts.find((b) => b.widget_type === 'ai_creator')?.widget_data || {};
    expect(/Welcome home!/.test(a.text) && a.prompt === 'A warm welcome' && a.is_dark === false && a.pin_to_bottom === false, `${tag}: the AI Creator content`);
    expect(await page.getByRole('dialog', { name: 'Create Campaign' }).count() === 0, `${tag}: Save as Draft closes, as before`);
    await shot(page, `${tag}-06-after-save`);
    await context.close();
  }

  // ── 390: the Moments card's Add a Moment (phones have no preview) ───────────────────────────────────────────────
  {
    const tag = '390';
    console.log(`-- ${tag}`);
    const { page, context, state } = await open({ width: 390, height: 844 });
    const create = await startCreate(page);
    await addPhoto(page, create);
    await cardPick(page, create, 'cta');
    await noAsk(page, tag);
    const d = await fillCta(page, 'Ready to see it?');
    await shot(page, `${tag}-01-cta-editor`);
    await d.getByRole('button', { name: 'Add Call to Action' }).click();
    await page.waitForTimeout(500);
    await cardPick(page, create, 'quote'); await fillQuote(page); await page.waitForTimeout(400);
    await cardPick(page, create, 'youtube'); await fillYoutube(page); await page.waitForTimeout(400);
    await cardPick(page, create, 'html'); await fillHtml(page); await page.waitForTimeout(400);
    await cardPick(page, create, 'request_moment');
    const rm = page.getByRole('dialog').filter({ hasText: 'Visitors tap this button to submit a photo and caption' }).last();
    expect(await rm.getByPlaceholder('e.g. Book Now').inputValue() === 'Share a Moment', `${tag}: Share Request a Moment opens the same editor with its own words`);
    await rm.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(400);
    const rows = create.locator('[data-widget-row]');
    expect(await rows.count() === 5, `${tag}: step 2 lists the 5 widgets (got ${await rows.count()})`);
    expect(state.log.length === 0, `${tag}: nothing sent before Save as Draft`);
    // Remove the Quote; move the HTML up (above the YouTube).
    await create.getByRole('button', { name: 'Remove Quote' }).click();
    await create.getByRole('button', { name: 'Move Opening hours up' }).click();
    await page.waitForTimeout(300);
    const labels = await create.locator('[data-widget-row] p.font-medium').allInnerTexts();
    expect(JSON.stringify(labels) === JSON.stringify(['Ready to see it?', 'Opening hours', 'The tour', 'Share Request a Moment']), `${tag}: removed and moved ${JSON.stringify(labels)}`);
    await create.locator('[data-testid="storeel-pending-widgets"]').scrollIntoViewIfNeeded();
    await shot(page, `${tag}-02-step2-widgets`);
    await create.getByRole('button', { name: 'Save as Draft', exact: true }).filter({ visible: true }).last().click();
    await page.waitForTimeout(3000);
    expect(state.log[0]?.what === 'create', `${tag}: POST /memories first`);
    const posts = widgetPosts(state);
    expect(JSON.stringify(posts.map((b) => `${b.widget_type}:${b.widget_data.mode || ''}`)) === JSON.stringify(['cta:link', 'html:', 'youtube:', 'cta:request_moment']), `${tag}: the 4 widgets in order ${JSON.stringify(posts.map((b) => b.widget_type))}`);
    expect(posts.every((b) => b.after_post_id === String(POST_ID)), `${tag}: each after the photo's new id`);
    const req = posts[3]?.widget_data || {};
    expect(req.buttonLink === '' && req.icon === 'Upload' && req.buttonText === 'Share a Moment', `${tag}: Share Request a Moment: no link, the Upload icon`);
    await shot(page, `${tag}-03-after-save`);
    await context.close();
  }

  // ── A widget the API refuses: named; the Storeel is still made ─────────────────────────────────────────────────
  {
    const tag = '1280-fail';
    console.log(`-- ${tag}`);
    const { page, context, state } = await open({ width: 1280, height: 900, failWidget: 'youtube' });
    const create = await startCreate(page);
    await addPhoto(page, create);
    await previewPick(page, 'Add a moment at the end', 'youtube'); await fillYoutube(page); await page.waitForTimeout(400);
    await previewPick(page, 'Add a moment at the end', 'quote'); await fillQuote(page); await page.waitForTimeout(400);
    await create.getByRole('button', { name: 'Save as Draft', exact: true }).filter({ visible: true }).last().click();
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'couldn’t be added' });
    await toast.first().waitFor({ timeout: 8000 }).catch(() => {});
    const text = await toast.first().innerText().catch(() => '');
    expect(/“The tour” couldn’t be added/.test(text), `${tag}: the failed widget is named (${text})`);
    expect(state.log[0]?.what === 'create' && widgetPosts(state).length === 2, `${tag}: the Storeel was made and the Quote still went (${state.log.map((x) => x.what)})`);
    await shot(page, `${tag}-01-failed-toast`);
    await context.close();
  }

  // ── Close without saving: dropped ──────────────────────────────────────────────────────────────────────────────
  {
    const tag = '1280-close';
    console.log(`-- ${tag}`);
    const { page, context, state } = await open({ width: 1280, height: 900 });
    const create = await startCreate(page);
    await previewPick(page, 'Add a moment at the start', 'quote'); await fillQuote(page); await page.waitForTimeout(400);
    await create.getByRole('button', { name: 'Back' }).click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /^Create( a Campaign)?$/ }).filter({ visible: true }).last().click();
    const again = page.getByRole('dialog', { name: 'Create Campaign' });
    await again.getByPlaceholder('Give your campaign a meaningful title').waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    expect(await again.locator('[data-widget-row]').count() === 0 && await page.locator('[data-preview-widget]').count() === 0, `${tag}: reopened Create has no widgets left over`);
    expect(state.log.length === 0, `${tag}: nothing was sent`);
    await context.close();
  }

  // ── Voice to Text: its parts become moments here, where the "+" was ───────────────────────────────────────────
  {
    const tag = '1280-voice';
    console.log(`-- ${tag}`);
    const { page, context, state } = await open({ width: 1280, height: 900, transcript: 'The garden in full bloom' });
    const create = await startCreate(page);
    await addPhoto(page, create);
    await previewPick(page, 'Add a moment at the start', 'voice');
    await noAsk(page, tag);
    await visible(page.getByRole('heading', { name: 'Add Voice to Text Memo' })).waitFor({ timeout: 5000 });
    await shot(page, `${tag}-01-voice`);
    await visible(page.getByRole('button', { name: 'Start Recording' })).click();
    const toastText = await page.locator('[data-sonner-toast]').first().innerText({ timeout: 1500 }).catch(() => '');
    if (/Deepgram API key not configured/.test(toastText)) {
      console.log('  SKIP Voice to Text: start the dev server with VITE_DEEPGRAM_API_KEY=test-key');
    } else {
      await visible(page.getByText('The garden in full bloom')).waitFor({ timeout: 10000 });
      await visible(page.getByRole('button', { name: 'End Recording' })).click();
      await visible(page.getByRole('heading', { name: 'Review Transcript' })).waitFor({ timeout: 5000 });
      await visible(page.getByRole('button', { name: 'Complete Process' })).click();
      await page.waitForTimeout(2500);
      const rows = create.locator('[data-moment-row="photo"]');
      expect(await rows.count() === 2, `${tag}: the voice part is a new moment here (got ${await rows.count()} photo moments)`);
      expect((await rows.nth(0).innerText()).includes('The garden in full bloom'), `${tag}: … first, where the "+" was, with the words as its caption`);
      expect(state.uploads === 2, `${tag}: its "no image" picture was uploaded like a photo (${state.uploads} uploads)`);
      expect(state.log.length === 0, `${tag}: nothing else sent before Save as Draft`);
      await create.locator('#st-step-moments').scrollIntoViewIfNeeded();
      await shot(page, `${tag}-02-voice-moment`);
      await create.getByRole('button', { name: 'Save as Draft', exact: true }).filter({ visible: true }).last().click();
      await page.waitForTimeout(2500);
      const sent = state.log[0]?.body?.photos || [];
      expect(sent.length === 2 && sent.some((ph) => ph.description === 'The garden in full bloom'), `${tag}: Save as Draft sends both moments (${sent.map((ph) => ph.description)})`);
    }
    await context.close();
  }

  // ── Edit Storeel (the campaign exists): the campaign page's editor, saved at once ──────────────────────────────
  {
    const tag = '1280-edit';
    console.log(`-- ${tag}`);
    const { page, context, state } = await open({ width: 1280, height: 900, created: true });
    const card = page.getByText(/^Spring Open House/).filter({ visible: true }).first();
    await card.waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    await card.click();
    await page.getByText('Our new kitchen').filter({ visible: true }).first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click();
    const edit = page.getByRole('dialog', { name: 'Edit Campaign' });
    await edit.locator('#st-step-moments').waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    await previewPick(page, 'Add a moment at the end', 'cta');
    await noAsk(page, tag);
    const d = await fillCta(page, 'Edit-mode CTA');
    await shot(page, `${tag}-01-campaign-page-editor`);
    await d.getByRole('button', { name: 'Add Call to Action' }).click();
    await page.waitForTimeout(1500);
    const posts = widgetPosts(state);
    expect(posts.length === 1 && posts[0].widget_type === 'cta' && posts[0].after_post_id === String(POST_ID), `${tag}: the campaign page's editor saves it at once, after the moment (${JSON.stringify(posts.map((b) => [b.widget_type, b.after_post_id]))})`);
    expect(await edit.locator('[data-widget-row]').count() === 0, `${tag}: nothing pending in Edit`);
    // The other shared editors on the campaign page: each saved at once, as before.
    await previewPick(page, 'Add a moment at the start', 'quote'); await fillQuote(page); await page.waitForTimeout(1200);
    await previewPick(page, 'Add a moment at the end', 'youtube'); await fillYoutube(page); await page.waitForTimeout(1200);
    await previewPick(page, 'Add a moment at the end', 'html'); await fillHtml(page); await page.waitForTimeout(1200);
    const all = widgetPosts(state);
    expect(JSON.stringify(all.map((b) => [b.widget_type, b.after_post_id])) === JSON.stringify([['cta', String(POST_ID)], ['quote', null], ['youtube', String(POST_ID)], ['html', String(POST_ID)]]),
      `${tag}: Quote / YouTube / HTML from the campaign page's editors, saved at once ${JSON.stringify(all.map((b) => [b.widget_type, b.after_post_id]))}`);
    expect(all[1]?.widget_data?.text === 'Home is where the heart is.' && all[2]?.widget_data?.videoId === 'dQw4w9WgXcQ' && all[3]?.widget_data?.content === '<p><strong>Sat</strong> 10–4</p>', `${tag}: … with their fields`);
    await shot(page, `${tag}-02-saved`);
    await context.close();
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall c24b widgets-in-place checks passed');
process.exit(failures.length || relevant.length ? 1 : 0);
