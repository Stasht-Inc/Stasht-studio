// Chris 19 Nov 2026, campaign page Timeline + Media panel (mocked API, 1280 + 390), click by click as in his video
// (Creamed Spinach):
//  10  — "+" under a moment → Add Widget → Moment → Add a Moment → Choose Files → Add from Media Library → a photo →
//        Add 1 Moment → type a description → Add all: the request carries after_post_id; the new moment lands right
//        after that moment (and the top "+" puts one first), still there after a reload.
//  10b — the typed text is the moment's DESCRIPTION (card shows it, no "+ Add description"); no title is sent.
//  10c — no full-page "Loading campaign…", the timeline keeps its scroll position and the new moment is in view.
//  11/13 — Media panel → edit add-salt-flour → Choose a Moment: its own moment isn't listed (13a), the campaign row
//        shows the cover and "Nov 17 - Nov 18/26" (13c); pick Add-flour → Save: the SAME photo moves (no copy), its old
//        moment leaves the timeline, no full reload.
//  12  — the 2 / 3 columns button right of the sort button: 3 across, remembered after a reload, drag-reorder works.
//  12b — sizes read "3.4 MB", never "3 B".
// The mock API behaves like the web API (MomentOrder: unified_order; MomentMove). Nothing leaves this machine.
// node tests/campaigns/ui/chris-19nov-moments.mjs   (C19_BASE = dev server, default http://127.0.0.1:5452; C19_SHOTS)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.C19_BASE || 'http://127.0.0.1:5452';
const OUT = process.env.C19_SHOTS || '/private/tmp/claude-501/c19-moments/shots';
mkdirSync(OUT, { recursive: true });

const OWNER = { id: 70, external_user_id: 707, name: 'Christian Beckermann', email: 'chris@c19.test', role: '2', status: 1, is_activated: true, profile_color: '#D946EF' };
const COLORS = ['#14532D', '#166534', '#15803D', '#A16207', '#CA8A04', '#78350F', '#1E3A8A', '#7C2D12', '#4C1D95', '#9D174D'];
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${COLORS[n % COLORS.length]}"/><text x="20" y="160" font-size="60" fill="#fff">${n}</text></svg>`;
const img = (n) => `${BASE}/c19-img/${n}.jpg`;
const STEPS = [
  [11, 'chop', 'Finely chop spinach'],
  [12, 'squeeze', 'Gently squeeze spinach to remove excess water before chopping.'],
  [13, 'add-spinach', 'Add spinach to pot, add salt and pepper to taste.'],
  [14, 'add-salt-flour', 'Add salt.'],
  [15, 'Add-flour', 'Add flour.'],
  [16, 'stir-flour', 'Stir the flour in.'],
  [17, 'add-milk', 'Add 1 cup of milk, and stir until it thickens.'],
  [18, 'nutmeg', 'Add a pinch of nutmeg'],
];
const post = (id, name, description, n = id) => ({
  id, name, title: '', description, image_link: img(n), master_image_link: img(n), media_url: img(n), size: 3.37, width: 4032, height: 3024,
  capture_date: '2026-11-16 10:00:00', uploaded_at: '2026-11-16 10:00:00', parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [], user: { id: 707, name: 'Christian Beckermann' },
});
const LIBRARY = { media_id: 501, media_url: img(501), name: 'image_picker_7560F800', description: '', capture_date: '2026-11-16', size: 2.4 };
const CAMPAIGN = {
  id: 901, title: 'Creamed Spinach', user_id: 707, published: 0, slug: 'creamed-spinach', category: { id: 1, name: 'Personal' }, sub_category: null,
  collaborators: [], user: { id: 707, name: 'Christian Beckermann' }, created_at: '2026-01-05 10:00:00', location: null, tags: [],
  min_uploaded_img_date: '2026-11-17', max_uploaded_img_date: '2026-11-18', dates: { formatted_range: 'Nov 17 - Nov 18/26' },
  last_update_img: `${BASE}/c19-img/900.jpg`,
};

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

// multipart/form-data → { field: value } (files: their file name)
function formFields(req) {
  const buf = req.postDataBuffer();
  const out = {};
  if (!buf) return out;
  const text = buf.toString('latin1');
  const re = /Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]*)")?\r\n(?:Content-Type: [^\r\n]+\r\n)?\r\n([\s\S]*?)\r\n--/g;
  let m;
  while ((m = re.exec(text))) out[m[1]] = m[2] !== undefined ? `file:${m[2]}` : Buffer.from(m[3], 'latin1').toString('utf8');
  return out;
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open(width, height) {
  const state = {
    posts: STEPS.map(([id, name, d]) => post(id, name, d)),
    order: STEPS.map(([id]) => id),
    uploads: [], edits: [], detailGets: 0, nextId: 950,
  };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  context.setDefaultTimeout(30000);
  await context.addInitScript(([user]) => {
    if (!sessionStorage.getItem('c19-seeded')) {
      sessionStorage.setItem('c19-seeded', '1');
      localStorage.clear();
      localStorage.setItem('stasht_token', 'owner-token');
      localStorage.setItem('stasht_user', JSON.stringify(user));
      localStorage.setItem('view_type', 'personal');
      localStorage.setItem('stasht_campaigns_view', 'storeels');
    }
    // 10c: remember if the full-page "Loading campaign…" ever shows after the campaign first rendered.
    window.__loadingSeen = 0;
    new MutationObserver(() => {
      if (window.__armLoading && document.body && document.body.innerText.includes('Loading campaign')) window.__loadingSeen++;
    }).observe(document, { subtree: true, childList: true, characterData: true });
  }, [OWNER]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: STUB_GAPI });
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/c19-img/')) return route.fulfill({ contentType: 'image/svg+xml', body: svg(Number(url.pathname.match(/(\d+)/)?.[1] ?? 0)) });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    const m = req.method();
    if (p === '/memories' && m === 'GET') {
      const all = [{ ...CAMPAIGN, photos: { count: state.posts.length, preview_images: [] } }];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: 1 }, latest_memories: all, sidebar: { categories: { items: [{ id: 1, name: 'Personal', memory_count: 1, memories: [] }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories/901' && m === 'GET') {
      state.detailGets++;
      return route.fulfill({ json: { status: 'success', data: { memory: { ...CAMPAIGN, posts: structuredClone(state.posts), widgets: [], photos: { count: state.posts.length } }, linked_memories: [], unified_order: state.order.map((id) => ({ type: 'post', id })) } } });
    }
    if (p === '/memory-images' && m === 'GET') {
      return route.fulfill({ json: { success: true, categories_media: { Personal: [LIBRARY] }, unassigned_media: [] } });
    }
    if (p === '/user/upload-image-with-metadata' && m === 'POST') {
      return route.fulfill({ json: { success: true, data: { fileUrl: img(777), originalSizeMB: 2.61, capture_date: '2026-11-18' } } });
    }
    if (p === '/memories/upload-photos-after-creation' && m === 'POST') {
      const f = formFields(req);
      state.uploads.push(f);
      // As the web API: a photo of this campaign moves, anything else is a new row; after_post_id / insert_at_start place it.
      const mediaId = f.media_id ? Number(f.media_id) : null;
      let row = mediaId ? state.posts.find((x) => x.id === mediaId) : null;
      if (!row) {
        const lib = mediaId === LIBRARY.media_id ? LIBRARY : null;
        row = post(state.nextId++, lib ? lib.name : (f.name || 'New Image'), f.description || '', lib ? 501 : 777);
        row.title = f.title || '';
        row.size = lib ? lib.size : Number(f.size || 0);
        state.posts.push(row);
      } else {
        row.description = f.description || '';
      }
      state.order = state.order.filter((id) => id !== row.id);
      if (f.parent_image_id) row.parent_id = Number(f.parent_image_id);
      else if (f.after_post_id) state.order.splice(state.order.indexOf(Number(f.after_post_id)) + 1, 0, row.id);
      else if (f.insert_at_start === '1') state.order.unshift(row.id);
      else state.order.push(row.id);
      return route.fulfill({ json: { status: 1, message: 'Success', data: [{ image: row, tagsFileName: null }], count: 1 } });
    }
    const edit = p.match(/^\/memory-images\/(\d+)$/);
    if (edit && m === 'POST') {
      const f = formFields(req);
      state.edits.push({ id: Number(edit[1]), ...f });
      const row = state.posts.find((x) => x.id === Number(edit[1]));
      if (f.description !== undefined) row.description = f.description;
      const parent = f.parent_image_id ? Number(f.parent_image_id) : null;
      if (parent !== (row.parent_id ?? null)) {
        if (parent) {
          state.posts.filter((x) => x.parent_id === row.id).forEach((x) => { x.parent_id = parent; });
          state.order = state.order.filter((id) => id !== row.id);
        } else {
          state.order.splice(state.order.indexOf(row.parent_id) + 1, 0, row.id);
        }
        row.parent_id = parent;
      }
      return route.fulfill({ json: { success: true, message: 'Memory Image updated successfully.', data: row } });
    }
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 1, name: 'Personal', is_owner: true, can_add_story: true }], labels: [] } } });
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
  const card = page.getByText(/^Creamed Spinach/).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(800);
  await card.click();
  await page.locator('[data-post-id="11"]').first().waitFor({ state: 'attached', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__armLoading = true; window.__loadingSeen = 0; });
}

// The order of moments as drawn: desktop = the right-hand cards (data-post-id); phone = the phone timeline cards.
const drawnOrder = (page) => page.evaluate(() => {
  const ids = [];
  const phone = window.innerWidth < 768;
  // Phone: each moment is followed by its own "+" (data-after-post-id = the moment), in timeline order.
  const sel = phone ? '[data-testid="phone-add-plus"][data-after-widget-id=""]:not([data-after-post-id=""])' : '[data-post-id]';
  document.querySelectorAll(sel).forEach((el) => {
    if (phone) { const id = Number(el.getAttribute('data-after-post-id')); if (el.getBoundingClientRect().height > 0 && !ids.includes(id)) ids.push(id); return; }
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) { const id = Number(el.getAttribute('data-post-id')); if (!ids.includes(id)) ids.push(id); }
  });
  return ids;
});
const inView = async (loc) => {
  const b = await loc.boundingBox().catch(() => null);
  const vh = loc.page().viewportSize().height;
  return Boolean(b && b.y < vh && b.y + b.height > 0);
};
const scrollerTop = (page) => page.evaluate(() => {
  const card = document.querySelector('[data-post-id="12"]');
  let el = card && card.parentElement;
  while (el && !(el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
  return el ? el.scrollTop : window.scrollY;
});

async function addFromLibraryVia(page, openPlus, description, tag, label) {
  await openPlus();
  const modal = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Add a Moment' }) }).last();
  await page.getByRole('heading', { name: 'Add a Moment' }).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Choose Files' }).filter({ visible: true }).first().click();
  await page.getByText('Add from Media Library').filter({ visible: true }).first().click();
  const library = page.locator('div.fixed.inset-0').filter({ hasText: 'Add Moments from Library' }).last();
  const tile = library.getByText(LIBRARY.name).filter({ visible: true }).first();
  await tile.waitFor({ timeout: 10000 }).catch(async (e) => { await page.screenshot({ path: `${OUT}/${tag}-${label}-library-FAILED.png` }); throw e; });
  await tile.click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Add 1 Moment$/ }).filter({ visible: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByPlaceholder('Describe this moment in detail...').filter({ visible: true }).first().fill(description);
  await page.screenshot({ path: `${OUT}/${tag}-${label}-modal.png` });
  await page.getByRole('button', { name: /^Add all \(1\)/ }).filter({ visible: true }).first().click();
  await page.waitForTimeout(3000);
  return modal;
}

try {
  // ───────────────────────── 1280 ─────────────────────────
  {
    const tag = '1280';
    console.log(`-- ${tag}`);
    const o = await open(1280, 900);
    const { page, state } = o;
    await openCampaign(page);
    expect(JSON.stringify(await drawnOrder(page)) === JSON.stringify(state.order), `${tag}: the campaign opens in the API's order`);

    // 10 / 10b / 10c: "+" under "Gently squeeze spinach…" (moment 12).
    const plus12 = page.locator('[data-testid="timeline-add-plus"][data-after-post-id="12"][data-after-widget-id=""]').filter({ visible: true }).first();
    await plus12.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const topBefore = await scrollerTop(page);
    await page.screenshot({ path: `${OUT}/${tag}-01-before-plus.png` });
    const desc = 'Add 3 tablespoons of flour and stir until combined.';
    await addFromLibraryVia(page, async () => {
      await plus12.getByRole('button', { name: 'Add Widget' }).click();
      await page.getByTestId('add-widget-chooser').getByRole('menuitem', { name: /^Moment/ }).click();
    }, desc, tag, '02');
    const sent = state.uploads.at(-1) || {};
    expect(sent.after_post_id === '12', `${tag} 10: the request carries after_post_id=12 (got ${sent.after_post_id})`);
    expect(sent.description === desc && !sent.title, `${tag} 10b: the text is sent as the description, no title (${JSON.stringify({ d: sent.description, t: sent.title })})`);
    expect(sent.media_id === '501' && sent.name === LIBRARY.name, `${tag}: the library photo's id and own name are sent`);
    const newId = state.posts.at(-1).id;
    const order = await drawnOrder(page);
    expect(order.indexOf(newId) === order.indexOf(12) + 1 && order.indexOf(13) === order.indexOf(newId) + 1, `${tag} 10: the new moment is right after moment 12, before 13 (${order.join(',')})`);
    expect(await page.evaluate(() => window.__loadingSeen) === 0, `${tag} 10c: no full-page "Loading campaign…"`);
    const newCard = page.locator(`[data-post-id="${newId}"]`).filter({ visible: true }).first();
    expect(await inView(newCard), `${tag} 10c: the new moment is in view`);
    const topAfter = await scrollerTop(page);
    expect(topBefore > 0 && topAfter > 0, `${tag} 10c: the timeline kept its scroll position (before ${topBefore}, after ${topAfter})`);
    expect(await newCard.getByText(desc).count() > 0, `${tag} 10b: the card shows the description`);
    expect(await newCard.getByText('Add description').count() === 0, `${tag} 10b: …and no "+ Add description"`);
    await page.screenshot({ path: `${OUT}/${tag}-03-after-add.png` });

    // The top "+" puts a moment first.
    const topPlus = page.locator('[data-testid="timeline-add-plus"][data-after-post-id=""][data-after-widget-id=""]').filter({ visible: true }).first();
    await topPlus.scrollIntoViewIfNeeded();
    await addFromLibraryVia(page, async () => {
      await topPlus.getByRole('button', { name: 'Add Widget' }).click();
      await page.getByTestId('add-widget-chooser').getByRole('menuitem', { name: /^Moment/ }).click();
    }, 'Intro photo', tag, '04-top');
    const sentTop = state.uploads.at(-1) || {};
    expect(sentTop.insert_at_start === '1' && !sentTop.after_post_id, `${tag} 10: the top "+" sends insert_at_start=1 (${JSON.stringify({ s: sentTop.insert_at_start, a: sentTop.after_post_id })})`);
    const topId = state.posts.at(-1).id;
    expect((await drawnOrder(page))[0] === topId, `${tag} 10: …and the moment is drawn first`);

    // The header's "Add a Moment" button still appends.
    // Reload: everything stays where it was put.
    await page.reload();
    await openCampaign(page);
    const reloaded = await drawnOrder(page);
    expect(JSON.stringify(reloaded) === JSON.stringify(state.order) && reloaded.indexOf(newId) === reloaded.indexOf(12) + 1, `${tag} 10: after a reload the moments are still in place (${reloaded.join(',')})`);

    // 12b: sizes in the Media panel.
    const panel = page.locator('[data-testid="media-panel-grid"]').filter({ visible: true }).first();
    await panel.waitFor({ timeout: 10000 });
    const panelText = await panel.innerText();
    expect(/3\.4 MB/.test(panelText), `${tag} 12b: a 4032×3024 photo reads 3.4 MB`);
    expect(!/\b\d+ B\b/.test(panelText), `${tag} 12b: no "3 B" / "4 B" sizes`);

    // 11 / 13: Media panel → edit add-salt-flour → Choose a Moment.
    const salt = page.locator('[data-image-id="14"]').filter({ visible: true }).first();
    await salt.scrollIntoViewIfNeeded();
    await salt.hover();
    await page.waitForTimeout(300);
    await salt.locator('.absolute.top-2.right-2 button').first().click();
    await page.getByText('Choose a Moment').filter({ visible: true }).first().waitFor({ timeout: 10000 });
    const pickerHead = page.locator('button').filter({ hasText: 'Creamed Spinach' }).filter({ has: page.locator('svg.lucide-chevron-down') }).filter({ visible: true }).first();
    const headText = await pickerHead.innerText();
    expect(/Nov 17 - Nov 18\/26/.test(headText) && !/Jan 2026/.test(headText), `${tag} 13c: the campaign row shows its dates, not "Jan 2026" (${headText.replace(/\s+/g, ' ')})`);
    const coverSrc = await pickerHead.locator('img').first().getAttribute('src').catch(() => null);
    expect(coverSrc === CAMPAIGN.last_update_img, `${tag} 13c: the campaign row shows the cover image, not a letter (${coverSrc})`);
    await pickerHead.click();
    const list = page.locator('.max-h-64.overflow-y-auto').filter({ visible: true }).first();
    await list.waitFor({ timeout: 5000 });
    const names = (await list.innerText()).split('\n').map((s) => s.trim()).filter(Boolean);
    expect(!names.includes('add-salt-flour') && names.includes('Add-flour'), `${tag} 13a: its own moment isn't listed (${names.slice(0, 12).join(' | ')})`);
    await page.screenshot({ path: `${OUT}/${tag}-05-choose-moment.png` });
    await list.getByText('Add-flour', { exact: true }).click();
    const rowsBefore = state.posts.length;
    const getsBefore = state.detailGets;
    await page.getByRole('button', { name: /Save Changes/ }).filter({ visible: true }).first().click();
    await page.waitForTimeout(3000);
    const ed = state.edits.at(-1) || {};
    expect(ed.id === 14 && ed.parent_image_id === '15', `${tag} 11: Save moves photo 14 into moment 15 (${JSON.stringify({ id: ed.id, p: ed.parent_image_id })})`);
    expect(state.posts.length === rowsBefore, `${tag} 11: no copy was made`);
    expect(state.detailGets > getsBefore && await page.evaluate(() => window.__loadingSeen) === 0, `${tag} 11: refreshed in place, no "Loading campaign…"`);
    const after = await drawnOrder(page);
    expect(!after.includes(14) && after.includes(15), `${tag} 11: the old moment left the timeline (${after.join(',')})`);
    const badge = page.locator('[data-post-id="15"]').filter({ visible: true }).first();
    expect(/\b1\b/.test(await badge.innerText()), `${tag} 11: Add-flour now holds the photo (sub-photo count 1)`);
    expect(await page.locator('[data-image-id="14"]').filter({ visible: true }).count() === 1, `${tag} 11: the photo is still once in the Media panel`);
    await page.screenshot({ path: `${OUT}/${tag}-06-after-move.png` });

    // 12: 2 / 3 columns, remembered, drag-reorder.
    const toggle = page.getByTestId('media-columns-toggle').filter({ visible: true }).first();
    const sortBox = await page.locator('[data-testid="media-columns-toggle"]').first().evaluate((el) => {
      const prev = el.previousElementSibling; const a = prev.getBoundingClientRect(); const b = el.getBoundingClientRect();
      return { sameRow: Math.abs(a.top - b.top) < 2, right: b.left > a.left, sameSize: Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1, sameClass: prev.className === el.className };
    });
    expect(sortBox.sameRow && sortBox.right && sortBox.sameSize && sortBox.sameClass, `${tag} 12: the button sits right of the sort button and looks the same (${JSON.stringify(sortBox)})`);
    await toggle.click();
    await page.waitForTimeout(400);
    expect(await panel.getAttribute('data-columns') === '3', `${tag} 12: 3 across`);
    const cols = await panel.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(cols === 3, `${tag} 12: the grid draws 3 columns (${cols})`);
    await page.screenshot({ path: `${OUT}/${tag}-07-three-columns.png` });
    const ids = () => panel.locator(':scope > [data-image-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-image-id')));
    const before = await ids();
    await page.dragAndDrop(`[data-testid="media-panel-grid"] > [data-image-id="${before[0]}"]`, `[data-testid="media-panel-grid"] > [data-image-id="${before[2]}"]`);
    await page.waitForTimeout(500);
    const afterDrag = await ids();
    expect(afterDrag[2] === before[0] && afterDrag[0] === before[1], `${tag} 12: drag-reorder works in 3 columns (${before.slice(0, 4).join(',')} → ${afterDrag.slice(0, 4).join(',')})`);
    await page.reload();
    await openCampaign(page);
    const panel2 = page.locator('[data-testid="media-panel-grid"]').filter({ visible: true }).first();
    await panel2.waitFor({ timeout: 10000 });
    expect(await panel2.getAttribute('data-columns') === '3', `${tag} 12: 3 across is remembered after a reload`);
    await page.getByTestId('media-columns-toggle').filter({ visible: true }).first().click();
    await page.waitForTimeout(300);
    expect(await panel2.getAttribute('data-columns') === '2', `${tag} 12: and back to 2`);
    expect(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), `${tag}: no horizontal page scroll`);
    await o.context.close();
  }

  // ───────────────────────── 390 ─────────────────────────
  {
    const tag = '390';
    console.log(`-- ${tag}`);
    const o = await open(390, 844);
    const { page, state } = o;
    await openCampaign(page);
    const plus12 = page.locator('[data-testid="phone-add-plus"][data-after-post-id="12"][data-after-widget-id=""]').filter({ visible: true }).first();
    await plus12.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const yBefore = await page.evaluate(() => window.scrollY);
    const topBefore = await scrollerTop(page);
    await plus12.locator('button').first().click();
    await page.waitForTimeout(400);
    await page.locator('button').filter({ hasText: /^Moment/ }).filter({ visible: true }).first().click();
    await page.getByRole('heading', { name: 'Add a Moment' }).waitFor({ timeout: 10000 });
    // Phone: Choose Files is the device picker (no library on the phone).
    await page.locator('#file-upload').setInputFiles({ name: 'IMG_2874.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex') });
    await page.waitForTimeout(1500);
    const desc = 'Add 3 tablespoons of flour and stir until combined.';
    await page.getByPlaceholder('Describe this moment in detail...').filter({ visible: true }).first().fill(desc);
    await page.screenshot({ path: `${OUT}/${tag}-01-modal.png` });
    await page.getByRole('button', { name: /^Add all \(1\)/ }).filter({ visible: true }).first().click();
    await page.waitForTimeout(3000);
    const sent = state.uploads.at(-1) || {};
    expect(sent.after_post_id === '12', `${tag} 10: the request carries after_post_id=12 (got ${sent.after_post_id})`);
    expect(sent.description === desc && !sent.title, `${tag} 10b: description, no title (${JSON.stringify({ d: sent.description, t: sent.title })})`);
    const newId = state.posts.at(-1).id;
    const order = await drawnOrder(page);
    expect(order.indexOf(newId) === order.indexOf(12) + 1, `${tag} 10: the new moment is right after moment 12 (${order.join(',')})`);
    expect(await page.evaluate(() => window.__loadingSeen) === 0, `${tag} 10c: no full-page "Loading campaign…"`);
    const yAfter = await page.evaluate(() => window.scrollY);
    const topAfter = await scrollerTop(page);
    expect((yBefore > 0 && yAfter > 0) || (topBefore > 0 && topAfter > 0), `${tag} 10c: the page kept its scroll position (window ${yBefore}→${yAfter}, list ${topBefore}→${topAfter})`);
    // Phone: the moment's card sits right above its own "+".
    const plusNew = page.locator(`[data-testid="phone-add-plus"][data-after-post-id="${newId}"][data-after-widget-id=""]`).filter({ visible: true }).first();
    expect(await inView(plusNew), `${tag} 10c: the new moment is scrolled into view`);
    const descText = page.getByText(desc).filter({ visible: true }).first();
    expect(await inView(descText), `${tag} 10b: the new moment's card shows the description, on screen`);
    await page.screenshot({ path: `${OUT}/${tag}-02-after-add.png` });
    expect(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), `${tag}: no horizontal page scroll`);
    await o.context.close();
  }
} catch (e) {
  failures.push(String((e && e.stack) || e));
  console.log(e);
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
