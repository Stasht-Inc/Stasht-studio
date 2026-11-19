// Chris 19 Nov 2026, second set — Studio points 16, 17, 18 and the Studio half of 19 (mocked API, 1280 + 390), click by
// click as in his screenshots / video (Creamed Spinach):
//  16 — campaign page → Send → Edit Campaign: Save Changes and Save & Send are ALSO in the top bar, with the same
//       handlers and the same disabled state as the bottom ones (Save & Send off until someone is chosen; the red
//       "*To send now…" stays at the bottom); top Save & Send → the "Send this Storeel now?" confirm; top Save Changes →
//       PUT /memories/901 and the page closes. Phone (390): compact, nothing overflows.
//  17 — click a moment → full-screen viewer → "+ Add" → Add a Moment (this moment preselected) → Choose Files → Add from
//       Media Library: the library opens ON TOP (it did nothing), a photo is picked → Add 1 Moment → back in Add a
//       Moment → Add all: the photo is added to THAT moment (parent_image_id), the viewer shows it (Image 1 of 2).
//       Escape closes the library first, then Add a Moment, then the viewer. Upload from Desktop from there too.
//       Phone: "+ Add" → Choose Files (device picker) → Add all → added to that moment.
//  18 — opening a campaign page tells the API (POST /memories/901/visit); the Dashboard's Latest Campaigns shows the
//       API's order (most recent first) with the real "Last Visited", and sorting Last Visited sorts by time.
//  19 — no "Image 1 of 1" in the viewer for a single-photo moment; the timeline card's sub-photo badge shows only when
//       the moment has extra photos (hidden at 0).
// Nothing leaves this machine. node tests/campaigns/ui/chris-19nov-s.mjs   (C19_BASE, default http://127.0.0.1:5454; C19_SHOTS)
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from '../../campaign-detail/ui/cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.C19_BASE || 'http://127.0.0.1:5454';
const OUT = process.env.C19_SHOTS || '/private/tmp/claude-501/c19-s/shots';
mkdirSync(OUT, { recursive: true });

const OWNER = { id: 70, external_user_id: 707, name: 'Christian Beckermann', email: 'chris@c19.test', role: '2', status: 1, is_activated: true, profile_color: '#D946EF' };
const COLORS = ['#14532D', '#166534', '#15803D', '#A16207', '#CA8A04', '#78350F', '#1E3A8A', '#7C2D12', '#4C1D95', '#9D174D'];
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${COLORS[n % COLORS.length]}"/><text x="20" y="160" font-size="60" fill="#fff">${n}</text></svg>`;
const img = (n) => `${BASE}/c19-img/${n}.jpg`;
const STEPS = [
  [11, 'chop', 'Finely chop spinach'],
  [12, 'squeeze', 'Gently squeeze spinach to remove excess water before chopping.'],
  [15, 'Add-flour', 'Add 3 tablespoons of flour and stir until combined.'],
  [17, 'add-milk', 'Add 1 cup of milk, and stir until it thickens.'],
];
const post = (id, name, description, n = id) => ({
  id, name, title: '', description, image_link: img(n), master_image_link: img(n), media_url: img(n), size: 3.37, width: 4032, height: 3024,
  capture_date: '2026-11-16 10:00:00', uploaded_at: '2026-11-16 10:00:00', parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [], user: { id: 707, name: 'Christian Beckermann' },
});
const LIBRARY = { media_id: 501, media_url: img(501), name: 'image_picker_7560F800', description: '', capture_date: '2026-11-16', size: 2.4 };
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const CAMPAIGN = {
  id: 901, title: 'Creamed Spinach', user_id: 707, published: 0, slug: 'creamed-spinach', category: { id: 1, name: 'Personal' }, sub_category: null,
  collaborators: [], user: { id: 707, name: 'Christian Beckermann' }, author: { name: 'Christian Beckermann' }, created_at: '2025-01-05T10:00:00Z', location: null, tags: [],
  min_uploaded_img_date: '2026-11-17', max_uploaded_img_date: '2026-11-18', dates: { formatted_range: 'Nov 17 - Nov 18/26', start_date: 'Nov 17/26', end_date: 'Nov 18/26' },
  last_update_img: `${BASE}/c19-img/900.jpg`, updated_at: ago(2 * 3600e3), last_updated: '2 hours ago',
};
// The Dashboard's Latest Campaigns as the API now sends it: most recently opened / edited first; the pending invite by its time.
const LATEST = [
  { ...CAMPAIGN, photos: { count: 4 } },
  { ...CAMPAIGN, id: 902, title: 'Remembering Addy', category: { id: 'invites', name: 'Invites' }, author: { name: 'TeamAddy' }, is_invite: true, updated_at: ago(90 * 86400e3), last_updated: '3 months ago', photos: { count: 0 } },
  { ...CAMPAIGN, id: 903, title: 'Zoo Day', category: { id: 2, name: 'Published' }, updated_at: ago(120 * 86400e3), last_updated: '4 months ago', photos: { count: 11 } },
  { ...CAMPAIGN, id: 904, title: 'Vancouver Life', category: { id: 2, name: 'Published' }, updated_at: ago(125 * 86400e3), last_updated: '4 months ago', photos: { count: 11 } },
];

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

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

async function open(width, height, path = '/memories') {
  const state = {
    posts: STEPS.map(([id, name, d]) => post(id, name, d)),
    order: STEPS.map(([id]) => id),
    uploads: [], puts: [], visits: [], sends: [], nextId: 950,
  };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  context.setDefaultTimeout(30000);
  await context.addInitScript(([user]) => {
    if (!sessionStorage.getItem('c19s-seeded')) {
      sessionStorage.setItem('c19s-seeded', '1');
      localStorage.clear();
      localStorage.setItem('stasht_token', 'owner-token');
      localStorage.setItem('stasht_user', JSON.stringify(user));
      localStorage.setItem('view_type', 'personal');
      localStorage.setItem('stasht_campaigns_view', 'storeels');
    }
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
    let body = null;
    try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch { body = null; }
    if (p === '/memories' && m === 'GET') {
      const all = [{ ...CAMPAIGN, photos: { count: state.posts.length, preview_images: [] } }];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: 1 }, latest_memories: LATEST, sidebar: { categories: { items: [{ id: 1, name: 'Personal', memory_count: 1, memories: [] }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories/901' && m === 'GET') {
      return route.fulfill({ json: { status: 'success', data: { memory: { ...CAMPAIGN, posts: structuredClone(state.posts), widgets: [], photos: { count: state.posts.length } }, linked_memories: [], unified_order: state.order.map((id) => ({ type: 'post', id })) } } });
    }
    if (p === '/memories/901' && (m === 'PUT' || m === 'POST')) { state.puts.push(body ?? formFields(req)); return route.fulfill({ json: { success: true, data: CAMPAIGN } }); }
    if (p === '/memories/901/visit' && m === 'POST') { state.visits.push(Date.now()); return route.fulfill({ json: { success: true, data: { visited: true, last_visited_at: new Date().toISOString() } } }); }
    if (p === '/memories/901/storeel-audience-count') {
      const ch = body?.channels ?? [];
      return route.fulfill({ json: { success: true, data: { email: ch.includes('email') ? 1 : 0, sms: ch.includes('sms') ? 1 : 0, skipped: { no_email: 0, no_phone: 0, unsubscribed: 0, duplicate: 0 }, person: { email: null, sms: null, errors: {} } }, storeel: { max_messages: 1000, needed: ch.length, over_limit: false, sms: null, allowance: { plan: 'Professional', email_limit: 2500, sms_limit: 250, email_used: 0, sms_used: 0, email_pending: 0, sms_pending: 0, resets_at: '2026-12-01T05:00:00Z' } } } });
    }
    if (p === '/memories/901/storeel-send') { state.sends.push(body); return route.fulfill({ status: 500, json: { success: false, message: 'not in this test' } }); }
    if (p === '/memory-images' && m === 'GET') {
      return route.fulfill({ json: { success: true, categories_media: { Personal: [LIBRARY] }, unassigned_media: [] } });
    }
    if (p === '/user/upload-image-with-metadata' && m === 'POST') {
      return route.fulfill({ json: { success: true, data: { fileUrl: img(777), originalSizeMB: 2.61, capture_date: '2026-11-18' } } });
    }
    if (p === '/memories/upload-photos-after-creation' && m === 'POST') {
      const f = formFields(req);
      state.uploads.push(f);
      const lib = f.media_id && Number(f.media_id) === LIBRARY.media_id;
      const row = post(state.nextId++, lib ? LIBRARY.name : (f.name || 'New Image'), f.description || '', lib ? 501 : 777);
      state.posts.push(row);
      if (f.parent_image_id) row.parent_id = Number(f.parent_image_id);
      else if (f.after_post_id) state.order.splice(state.order.indexOf(Number(f.after_post_id)) + 1, 0, row.id);
      else state.order.push(row.id);
      return route.fulfill({ json: { status: 1, message: 'Success', data: [{ image: row, tagsFileName: null }], count: 1 } });
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
  await page.goto(`${BASE}${path}`);
  return { context, page, state };
}

async function openCampaign(page) {
  const card = page.getByText(/^Creamed Spinach/).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(800);
  await card.click();
  await page.locator('[data-post-id="11"]').first().waitFor({ state: 'attached', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const topOf = async (page, loc) => {
  // Is `loc` the element actually hit at its centre (on top, clickable)?
  const box = await loc.boundingBox().catch(() => null);
  if (!box) return false;
  const r = await loc.evaluate((el, [x, y]) => { const hit = document.elementFromPoint(x, y); return { ok: Boolean(hit && (el === hit || el.contains(hit) || hit.contains(el))), hit: hit ? `${hit.tagName}.${String(hit.className).slice(0, 80)}` : null }; }, [box.x + box.width / 2, box.y + box.height / 2]);
  if (!r.ok) console.log('   (hit:', r.hit, ')');
  return r.ok;
};

// ── 16: the Edit Campaign top bar ─────────────────────────────────────────────────────────────────────────────────
async function point16(width, height) {
  const tag = `${width}-16`;
  console.log(`-- ${tag}`);
  const { context, page, state } = await open(width, height);
  await openCampaign(page);
  expect(state.visits.length >= 1, `${tag} 18: opening the campaign page calls POST /memories/901/visit (${state.visits.length})`);
  await page.getByRole('button', { name: 'Send', exact: true }).filter({ visible: true }).first().click();
  const flow = page.getByRole('dialog', { name: 'Edit Campaign' });
  await flow.waitFor({ state: 'visible', timeout: 15000 });
  await flow.locator('#st-step-send').waitFor({ timeout: 10000 });
  await page.waitForTimeout(1200);
  const header = flow.locator('header').first();
  const topSave = flow.getByTestId('st-top-save');
  const topSend = flow.getByTestId('st-top-send');
  const actions = flow.locator('#st-actions');
  const bottomSave = actions.getByRole('button', { name: 'Save Changes', exact: true });
  const bottomSend = actions.getByRole('button', { name: 'Save & Send', exact: true });
  expect(await topSave.isVisible() && (await topSave.innerText()).trim() === 'Save Changes', `${tag}: "Save Changes" is in the top bar`);
  expect(await topSend.isVisible() && (await topSend.innerText()).trim() === 'Save & Send', `${tag}: "Save & Send" is in the top bar`);
  expect(await header.evaluate((h, els) => true, null) && await topSave.evaluate((el) => !!el.closest('header')) && await topSend.evaluate((el) => !!el.closest('header')), `${tag}: both sit in the page's top bar`);
  expect(await bottomSave.count() === 1 && await bottomSend.count() === 1, `${tag}: the bottom Save Changes / Save & Send stay`);
  expect(await topSend.isDisabled() && await bottomSend.isDisabled(), `${tag}: Save & Send is off top and bottom until someone is chosen`);
  expect(await topSave.isEnabled() === await bottomSave.isEnabled(), `${tag}: Save Changes top = bottom state`);
  expect(await actions.getByText(/^\*To send now/).count() > 0 && await header.getByText(/To send now/).count() === 0, `${tag}: the red "*To send now…" stays at the bottom only`);
  // Styles: same Studio button classes (primary purple / secondary outline) as the bottom ones.
  await page.mouse.move(5, height - 5); // no hover colour
  await page.waitForTimeout(200);
  const looks = await Promise.all([topSend, bottomSend, topSave, bottomSave].map((l) => l.evaluate((el) => { const c = getComputedStyle(el); return [c.backgroundColor, c.borderRadius, c.fontWeight]; })));
  expect(JSON.stringify(looks[0]) === JSON.stringify(looks[1]) && JSON.stringify(looks[2]) === JSON.stringify(looks[3]), `${tag}: the top buttons look like the bottom ones (${JSON.stringify(looks)})`);
  // Layout: nothing overflows; buttons inside the viewport; header one compact row on the phone too.
  const hb = await header.boundingBox();
  const sb = await topSend.boundingBox();
  const vb = await topSave.boundingBox();
  expect(sb && vb && sb.x + sb.width <= width + 0.5 && vb.x >= 0, `${tag}: the top buttons are inside the screen (${JSON.stringify({ vb, sb })})`);
  expect(await header.evaluate((h) => h.scrollWidth <= h.clientWidth + 1), `${tag}: the top bar doesn't overflow`);
  expect(await noHScroll(page), `${tag}: no horizontal page scroll`);
  expect(hb && hb.height <= (width < 768 ? 72 : 80), `${tag}: the top bar stays compact (${hb && Math.round(hb.height)}px)`);
  await page.screenshot({ path: `${OUT}/${tag}-01-top-bar-disabled.png` });

  // Choose someone → both Save & Send on.
  const sc = flow.locator('#st-step-send');
  await sc.getByRole('checkbox', { name: 'Email', exact: true }).check();
  await sc.getByLabel('Email address').fill('jordan@example.com');
  const sms = sc.getByRole('checkbox', { name: 'Text message (SMS)', exact: true });
  if (await sms.isChecked()) await sms.uncheck();
  await sc.getByLabel(/^Message/).fill('New spinach recipe.');
  await page.waitForTimeout(1500);
  if (await topSend.isDisabled()) console.log('   (reasons:', (await actions.innerText()).replace(/\s+/g, ' ').slice(0, 200), ')');
  expect(await topSend.isEnabled() && await bottomSend.isEnabled(), `${tag}: with a recipient, Save & Send is on top and bottom`);
  await page.screenshot({ path: `${OUT}/${tag}-02-top-bar-enabled.png` });

  // Top Save & Send → the same confirm as the bottom one; Back keeps the page.
  const putsBefore = state.puts.length;
  await topSend.click();
  const confirm = page.getByRole('dialog', { name: 'Send this Storeel now?' });
  await confirm.waitFor({ timeout: 10000 }).catch(() => {});
  expect(await confirm.isVisible().catch(() => false), `${tag}: top Save & Send saves and asks "Send this Storeel now?"`);
  expect(state.puts.length > putsBefore, `${tag}: …after saving the campaign (PUT /memories/901)`);
  await page.screenshot({ path: `${OUT}/${tag}-03-top-send-confirm.png` });
  await confirm.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(600);
  expect(state.sends.length === 0, `${tag}: nothing sent without Send Now`);

  // Top Save Changes → saves and closes, like the bottom one.
  const puts2 = state.puts.length;
  await topSave.click();
  await page.waitForTimeout(2500);
  expect(state.puts.length > puts2, `${tag}: top Save Changes saves (PUT /memories/901)`);
  expect(!(await flow.isVisible().catch(() => false)), `${tag}: …and closes the Edit page`);
  await context.close();
}

// ── 17 / 19: the full-screen viewer ───────────────────────────────────────────────────────────────────────────────
async function openViewer(page, id = 15) {
  // The moment's photo on its timeline card (desktop: [data-post-id]; phone: the phone timeline's card).
  const photo = page.locator(`img[src*="/c19-img/${id}.jpg"]`).filter({ visible: true }).first();
  await photo.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await photo.click();
  const viewer = page.locator('div.fixed.z-\\[99999\\].bg-black').first();
  await viewer.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1200);
  return viewer;
}

async function point17desktop() {
  const tag = '1280-17';
  console.log(`-- ${tag}`);
  const { context, page, state } = await open(1280, 900);
  await openCampaign(page);
  // 19: the timeline card's sub-photo badge is hidden for a moment with no extra photos.
  const flourCard = page.locator('[data-post-id="15"]').filter({ visible: true }).first();
  expect(await flourCard.locator('.absolute.bottom-2.right-2.rounded-full').count() === 0, `${tag} 19: no sub-photo badge on a single-photo moment card`);
  let viewer = await openViewer(page);
  await page.screenshot({ path: `${OUT}/${tag}-01-viewer.png` });
  expect(await page.getByTestId('viewer-photo-counter').filter({ visible: true }).count() === 0 && await page.getByText('Image 1 of 1').filter({ visible: true }).count() === 0, `${tag} 19: no "Image 1 of 1" for a single-photo moment`);

  // Escape order: library → Add a Moment → viewer.
  const addBtn = viewer.locator('button').filter({ hasText: 'Add' }).filter({ visible: true }).first();
  await addBtn.click();
  const addHeading = page.getByRole('heading', { name: 'Add a Moment' });
  await addHeading.waitFor({ timeout: 10000 });
  const chooseMoment = await page.getByText('Choose a Moment').filter({ visible: true }).first().locator('xpath=..').innerText().catch(() => '');
  const pickerRow = page.locator('button').filter({ hasText: 'Add-flour' }).filter({ visible: true });
  expect(await pickerRow.count() > 0, `${tag}: Add a Moment opens with this moment (Add-flour) chosen under Choose a Moment (${chooseMoment.replace(/\s+/g, ' ').slice(0, 80)})`);
  await page.getByRole('button', { name: 'Choose Files' }).filter({ visible: true }).first().click();
  await page.getByText('Add from Media Library').filter({ visible: true }).first().click();
  const library = page.locator('div.fixed.inset-0').filter({ hasText: 'Add Moments from Library' }).last();
  const tile = library.getByText(LIBRARY.name).filter({ visible: true }).first();
  await tile.waitFor({ timeout: 10000 }).catch(async () => { await page.screenshot({ path: `${OUT}/${tag}-02-library-FAILED.png` }); });
  expect(await tile.isVisible().catch(() => false), `${tag} 17: "Add from Media Library" opens the library (it did nothing)`);
  expect(await topOf(page, tile), `${tag} 17: the library is on top of the viewer and Add a Moment (its photo is what a click hits)`);
  await page.screenshot({ path: `${OUT}/${tag}-02-library-on-top.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  expect(!(await library.isVisible().catch(() => false)) && await addHeading.isVisible() && await viewer.isVisible(), `${tag} 17: Escape closes only the library (Add a Moment and the viewer stay)`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  expect(!(await addHeading.isVisible().catch(() => false)) && await viewer.isVisible(), `${tag} 17: Escape again closes Add a Moment (the viewer stays)`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  expect(!(await viewer.isVisible().catch(() => false)), `${tag} 17: Escape again closes the viewer`);

  // The flow: + Add → Choose Files → Add from Media Library → pick → Add 1 Moment → Add all (1).
  viewer = await openViewer(page);
  await viewer.locator('button').filter({ hasText: 'Add' }).filter({ visible: true }).first().click();
  await addHeading.waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Choose Files' }).filter({ visible: true }).first().click();
  await page.getByText('Add from Media Library').filter({ visible: true }).first().click();
  await tile.waitFor({ timeout: 10000 });
  await tile.click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Add 1 Moment$/ }).filter({ visible: true }).first().click();
  await page.waitForTimeout(800);
  expect(!(await library.isVisible().catch(() => false)) && await addHeading.isVisible(), `${tag} 17: picking returns to Add a Moment`);
  const addAll = page.getByRole('button', { name: /^Add all \(1\)/ }).filter({ visible: true }).first();
  expect(await addAll.isVisible().catch(() => false), `${tag} 17: the picked photo is in Add a Moment (Add all (1))`);
  await page.screenshot({ path: `${OUT}/${tag}-03-picked.png` });
  await addAll.click();
  await page.waitForTimeout(3500);
  const sent = state.uploads.at(-1) || {};
  expect(sent.parent_image_id === '15' && sent.media_id === '501', `${tag} 17: the library photo is added to THIS moment (parent_image_id=15, media_id=501: ${JSON.stringify({ p: sent.parent_image_id, m: sent.media_id })})`);
  expect(await viewer.isVisible(), `${tag} 17: the viewer stays open`);
  const counter = page.getByTestId('viewer-photo-counter').filter({ visible: true });
  await counter.first().waitFor({ timeout: 8000 }).catch(() => {});
  expect(/Image 1 of 2/.test(await counter.first().innerText().catch(() => '')), `${tag} 17/19: the viewer now shows the moment's 2 photos ("Image 1 of 2")`);
  await page.screenshot({ path: `${OUT}/${tag}-04-added.png` });

  // Upload from Desktop from the same place.
  await viewer.locator('button').filter({ hasText: 'Add' }).filter({ visible: true }).first().click();
  await addHeading.waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Choose Files' }).filter({ visible: true }).first().click();
  const chooser = page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null);
  await page.getByText('Upload from Desktop').filter({ visible: true }).first().click();
  const fc = await chooser;
  expect(Boolean(fc), `${tag} 17: "Upload from Desktop" opens the file picker`);
  if (fc) await fc.setFiles({ name: 'IMG_2874.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex') });
  await page.waitForTimeout(1500);
  const addAll2 = page.getByRole('button', { name: /^Add all \(1\)/ }).filter({ visible: true }).first();
  await addAll2.click().catch(() => {});
  await page.waitForTimeout(3500);
  const sent2 = state.uploads.at(-1) || {};
  expect(state.uploads.length === 2 && sent2.parent_image_id === '15', `${tag} 17: the desktop photo is added to this moment too (parent_image_id=${sent2.parent_image_id})`);
  await counter.first().waitFor({ timeout: 8000 }).catch(() => {});
  expect(/of 3/.test(await counter.first().innerText().catch(() => '')), `${tag} 17: the viewer shows 3 photos now`);
  await page.screenshot({ path: `${OUT}/${tag}-05-desktop-upload.png` });

  // Reload: still there (the card's badge counts the 2 extra photos).
  await page.keyboard.press('Escape');
  await page.reload();
  await openCampaign(page);
  const badge = page.locator('[data-post-id="15"]').filter({ visible: true }).first().locator('.absolute.bottom-2.right-2.rounded-full');
  expect(await badge.count() === 1 && /\b2\b/.test(await badge.innerText().catch(() => '')), `${tag} 17/19: after a reload the moment's card shows its 2 extra photos`);
  expect(await noHScroll(page), `${tag}: no horizontal page scroll`);
  await context.close();
}

async function point17phone() {
  const tag = '390-17';
  console.log(`-- ${tag}`);
  const { context, page, state } = await open(390, 844);
  await openCampaign(page);
  const viewer = await openViewer(page);
  await page.screenshot({ path: `${OUT}/${tag}-01-viewer.png` });
  expect(await page.getByText(/^1\/1$/).filter({ visible: true }).count() === 0, `${tag} 19: no "1/1" counter on a single-photo moment`);
  await viewer.locator('button:has(svg.lucide-plus)').filter({ visible: true }).first().click();
  const addHeading = page.getByRole('heading', { name: 'Add a Moment' });
  await addHeading.waitFor({ timeout: 10000 });
  expect(await topOf(page, addHeading), `${tag} 17: Add a Moment is on top of the viewer`);
  await page.locator('#file-upload').setInputFiles({ name: 'IMG_2874.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex') });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${tag}-02-add-moment.png` });
  await page.getByRole('button', { name: /^Add all \(1\)/ }).filter({ visible: true }).first().click();
  await page.waitForTimeout(3500);
  const sent = state.uploads.at(-1) || {};
  expect(sent.parent_image_id === '15', `${tag} 17: the photo is added to this moment (parent_image_id=${sent.parent_image_id})`);
  const counter = page.getByText(/^1\/2$/).filter({ visible: true });
  await counter.first().waitFor({ timeout: 8000 }).catch(() => {});
  expect(await counter.count() > 0, `${tag} 17/19: the viewer shows "1/2" now`);
  await page.screenshot({ path: `${OUT}/${tag}-03-added.png` });
  expect(await noHScroll(page), `${tag}: no horizontal page scroll`);
  await context.close();
}

// ── 18: Dashboard Latest Campaigns ───────────────────────────────────────────────────────────────────────────────
async function point18(width, height) {
  const tag = `${width}-18`;
  console.log(`-- ${tag}`);
  const { context, page } = await open(width, height, '/dashboard');
  const heading = page.getByText('Latest Campaigns').filter({ visible: true }).first();
  await heading.waitFor({ timeout: 180000 });
  await page.getByText('Remembering Addy').filter({ visible: true }).first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  const section = heading.locator('xpath=ancestor::*[.//text()[contains(., "Zoo Day")]][1]');
  const titles = async () => section.evaluate((el) => {
    const want = ['Creamed Spinach', 'Remembering Addy', 'Zoo Day', 'Vancouver Life'];
    const found = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent.trim();
      const r = walker.currentNode.parentElement.getBoundingClientRect();
      if (want.includes(t) && r.width > 0 && r.height > 0 && !found.includes(t)) found.push(t);
    }
    return found;
  });
  const first = await titles();
  expect(JSON.stringify(first) === JSON.stringify(['Creamed Spinach', 'Remembering Addy', 'Zoo Day', 'Vancouver Life']), `${tag}: the API's order (most recent first; the invite by its time) — ${first.join(', ')}`);
  expect(await section.getByText('2 hours ago').filter({ visible: true }).count() > 0, `${tag}: "Last Visited" shows the real time (2 hours ago)`);
  await page.screenshot({ path: `${OUT}/${tag}-01-latest.png` });
  if (width >= 1024) {
    const sortBtn = section.getByRole('button', { name: /Last Visited/ }).first();
    await sortBtn.click();
    await page.waitForTimeout(300);
    const asc = await titles();
    expect(asc[0] === 'Vancouver Life' && asc.at(-1) === 'Creamed Spinach', `${tag}: Last Visited ↑ sorts oldest first by time (${asc.join(', ')})`);
    await sortBtn.click();
    await page.waitForTimeout(300);
    const desc = await titles();
    expect(desc[0] === 'Creamed Spinach' && desc.at(-1) === 'Vancouver Life', `${tag}: Last Visited ↓ sorts most recent first (${desc.join(', ')})`);
  }
  expect(await noHScroll(page), `${tag}: no horizontal page scroll`);
  await context.close();
}

try {
  await point16(1280, 900);
  await point16(390, 844);
  await point17desktop();
  await point17phone();
  await point18(1280, 900);
  await point18(390, 844);
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
