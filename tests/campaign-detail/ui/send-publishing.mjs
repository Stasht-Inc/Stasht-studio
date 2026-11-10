// Chris 8 Nov 2026 (b), point 2, in the real app (App → Campaigns → campaign page) at 1280 and 390:
// "Publish" (top right) is replaced by "Send", which opens the Storeel stepper (Edit Campaign) at its Send card; Edit
// (desktop Edit / phone Timeline pencil) still opens it at step 1. Every publish option is in the stepper's
// "4 Publishing" card: Publish as View Only / Public / Private (POST /memories/{id}/publish role 2 / 1 / 3), the
// "Published!" modal over the stepper, then the published box (link + Copy, Share menu, QR + Download, Share message
// + Save) and Unpublish (POST /memories/memory-unpublished). Non-owners: Send disabled like Publish was; the
// published box on the page still works for them. Contributors: the shared view, unchanged (never had Publish).
// node tests/campaign-detail/ui/send-publishing.mjs   (needs the dev server: CD_BASE, default http://localhost:5351)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from './cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.CD_BASE || 'http://localhost:5351';
const OUT = process.env.CD_SHOTS || '/private/tmp/claude-501/campaign-detail-ui/send-publishing';
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 70, external_user_id: 707, name: 'Main Dealer', email: 'main@dealer.test', role: '2', status: 1, is_activated: true, profile_color: '#1D4ED8' };
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="${['#6C60FF', '#F59E0B', '#10B981'][n % 3]}"/></svg>`;
const img = (n) => `${BASE}/cd-img/${n}.jpg`;
const post = (id, n) => ({
  id, name: `Moment ${n}`, title: `Moment ${n}`, description: '', master_image_link: img(n), image_link: img(n), media_url: img(n),
  capture_date: `2026-10-1${n} 10:00:00`, uploaded_at: `2026-10-1${n} 10:00:00`, parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [],
});
const LINK = `${BASE}/published-memory/thomas-jeeps`;
const BASE_CAMPAIGN = {
  id: 901, title: 'Thomas Jeeps Inventory', user_id: 707, slug: 'thomas-jeeps', category: { id: 5, name: 'Personal' }, sub_category: null, photos: { count: 2 },
  collaborators: [], user: { id: 707, name: 'Serpa Chrysler' }, created_at: '2026-10-01 10:00:00', location: 'Toronto, Canada', tags: [],
  min_uploaded_img_date: '2026-10-01', max_uploaded_img_date: '2026-10-01', last_update_img: null, share_message: null,
};

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }, { published = 0, owner = true, role = 'admin' } = {}) {
  const state = { published, url: published ? LINK : null, publishes: [], unpublishes: 0, shareMessages: [], puts: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  // The device location (review I1): counted, answered after 1.2 s (Mumbai via the reverse-geocoder below).
  await context.addInitScript(() => {
    window.__geoCalls = 0;
    const geo = { getCurrentPosition: (ok) => { window.__geoCalls++; setTimeout(() => ok({ coords: { latitude: 19.07, longitude: 72.87 } }), 1200); }, watchPosition: () => 0, clearWatch: () => {} };
    try { Object.defineProperty(navigator, 'geolocation', { configurable: true, get: () => geo }); } catch { /* ignore */ }
  });
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('cd-seeded')) return;
    sessionStorage.setItem('cd-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'main-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels');
  }, [MAIN]);
  const campaign = () => ({
    ...BASE_CAMPAIGN,
    ...(owner ? {} : { user_id: 808, user: { id: 808, name: 'Serpa Chrysler' }, collaborator: [{ user_id: 707, status: 1, role, user: { email: MAIN.email } }] }),
    published: state.published, published_url: state.url, share_message: state.shareMessages.at(-1) ?? null,
  });
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STUB_STRIPE });
      if (url.hostname === 'nominatim.openstreetmap.org') return route.fulfill({ json: { address: { city: 'Mumbai', country: 'India' } } });
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
      const all = [campaign()];
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: all, total: all.length }, latest_memories: all, sidebar: { categories: { items: [{ id: 5, name: 'Personal', memory_count: 1 }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories/901' && m === 'GET') return route.fulfill({ json: { status: 'success', data: { memory: { ...campaign(), posts: [post(11, 1), post(12, 2)], linked_memories: [], widgets: [], unified_order: null } } } });
    if (p === '/memories/901' && m === 'PUT') { state.puts.push(body); return route.fulfill({ json: { success: true, data: campaign() } }); }
    if (p === '/memories/901/publish' && m === 'POST') {
      state.publishes.push(body);
      state.published = Number(body?.role) || 1;
      state.url = state.published === 3 ? `${LINK}?access_token=tok123` : LINK;
      return route.fulfill({ json: { success: true, link: state.url, data: { link: state.url } } });
    }
    if (p === '/memories/memory-unpublished' && m === 'POST') { state.unpublishes++; state.published = 0; state.url = null; return route.fulfill({ json: { success: true } }); }
    if (p === '/memories/published/share-message' && m === 'POST') { state.shareMessages.push(body?.share_message); return route.fulfill({ json: { success: true } }); }
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 5, name: 'Personal', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/memories/901/storeel-audience-count') {
      const ch = body?.channels ?? [];
      return route.fulfill({ json: { success: true, data: { email: ch.includes('email') ? 1 : 0, sms: ch.includes('sms') ? 1 : 0, skipped: { no_email: 0, no_phone: 0, unsubscribed: 0, duplicate: 0 }, person: { email: null, sms: null, errors: {} } }, storeel: { max_messages: 1000, needed: ch.length, over_limit: false, sms: null, allowance: { plan: 'Professional', email_limit: 2500, sms_limit: 250, email_used: 0, sms_used: 0, email_pending: 0, sms_pending: 0, resets_at: '2026-12-01T05:00:00Z' } } } });
    }
    if (p === '/memories/901/storeel-send') { state.sends = (state.sends ?? 0) + 1; return route.fulfill({ status: 422, json: { success: false, message: 'private' } }); }
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
  const card = page.getByText(/^Thomas Jeeps Inventory/).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(800);
  await card.click();
  await page.getByText('Moment 1').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

const flow = (page) => page.getByRole('dialog', { name: 'Edit Campaign' });
// Deepak, 9 Nov 2026: "publish on Send" — the Publishing section is at the top of the Send card (no card 4).
const pub = (page) => flow(page).locator('#st-step-send #st-publishing');
const inViewport = async (page, loc) => {
  const box = await loc.boundingBox().catch(() => null);
  const vp = page.viewportSize();
  return Boolean(box && box.y >= -1 && box.x >= -1 && box.y + Math.min(box.height, 40) <= vp.height && box.x + box.width <= vp.width + 1);
};
const sendButton = (page) => page.getByRole('button', { name: 'Send', exact: true }).filter({ visible: true }).first();
const toast = async (page, text) => { await page.getByText(text).first().waitFor({ timeout: 6000 }).catch(() => {}); return page.getByText(text).first().isVisible().catch(() => false); };

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    // ── Owner, not published (Chris's 202 / 203) ─────────────────────────────────────────────────────────────────
    {
      const { page, context, state } = await open({ width, height });
      await openCampaign(page);
      await page.screenshot({ path: `${OUT}/${tag}-01-campaign-page-send.png` });
      expect(!(await page.getByRole('button', { name: /^(Publish|Unpublish)$/ }).filter({ visible: true }).count()), `${tag}: no Publish / Unpublish button on the campaign page`);
      expect(await sendButton(page).isVisible().catch(() => false), `${tag}: Send is on the campaign page`);
      expect(await inViewport(page, sendButton(page)), `${tag}: Send is in the viewport (top right)`);
      if (width < 1024) {
        const box = await sendButton(page).boundingBox();
        expect(box && box.x > width / 2 && box.y < 120, `${tag}: phone Send sits top right where Publish was (${JSON.stringify(box)})`);
        expect(await page.getByText('Edit Cover').filter({ visible: true }).count() > 0, `${tag}: Edit Cover still in the cover bar`);
      } else {
        expect(await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).count() > 0, `${tag}: desktop Edit still there`);
        expect(await page.getByRole('button', { name: 'Add a Moment' }).filter({ visible: true }).count() > 0, `${tag}: desktop Add a Moment still there`);
      }

      // Send → the stepper at its Send card
      await sendButton(page).click();
      await flow(page).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      await flow(page).locator('#st-step-send').waitFor({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(900);
      expect(await flow(page).isVisible().catch(() => false), `${tag}: Send opens the Storeel stepper (Edit Campaign)`);
      const sendTitle = flow(page).locator('#st-step-send-title');
      expect(await inViewport(page, sendTitle), `${tag}: it opens AT the Send card (its heading is in the viewport)`);
      const sendBox = await flow(page).locator('#st-step-send').boundingBox();
      expect(sendBox && sendBox.y < height * 0.4, `${tag}: the Send card is at the top (y=${sendBox?.y})`);
      expect(!(await inViewport(page, flow(page).getByPlaceholder('Give your campaign a meaningful title'))), `${tag}: step 1 is scrolled away`);
      await page.waitForTimeout(2500);
      expect(await inViewport(page, sendTitle), `${tag}: still at the Send card 3 s later (nothing scrolls it back to step 1)`);
      expect(state.puts.length === 0 && state.publishes.length === 0, `${tag}: opening saves nothing`);
      expect((await page.evaluate(() => window.__geoCalls)) === 0, `${tag}: Send doesn't ask for the device location`);
      expect(!(await page.evaluate(() => document.activeElement?.getAttribute('placeholder') === 'Give your campaign a meaningful title')), `${tag}: the title isn't focused (no keyboard) when opened at Send`);
      expect((await flow(page).getByPlaceholder(/Enter location/).inputValue()) === 'Toronto, Canada', `${tag}: the saved Location is kept`);
      await page.screenshot({ path: `${OUT}/${tag}-02-send-opens-at-send-step.png` });

      // Publishing card: 4, after Send, not published, three choices
      expect(await pub(page).count() === 1, `${tag}: Publishing is a section inside the Send card`);
      expect(!(await flow(page).locator('#st-step-publishing').count()), `${tag}: no separate Publishing card`);
      expect(await inViewport(page, pub(page).getByText('Publishing', { exact: true })), `${tag}: Send opens with Publishing at the top of the Send card`);
      const ptext = (await pub(page).textContent()) ?? '';
      expect(ptext.includes('Not published. Save & Send publishes it as Public, or publish it now.'), `${tag}: Publishing says sending publishes it Public (as Save & Send does)`);
      expect(ptext.includes("Publish and Unpublish apply right away. They don't need Save Changes."), `${tag}: Publishing says its changes apply right away`);
      for (const t of ['Publish as View Only', 'Publish as Public', 'Publish as Private', 'Users can only view the campaign, no comments allowed', 'Anyone can view and leave comments', 'Only visible with a valid access token']) expect(ptext.includes(t), `${tag}: Publishing offers "${t}"`);
      const order = await flow(page).evaluate((el) => ['#st-step-send', '#st-publishing', '#st-send-to-label', '#st-actions'].map((s) => el.querySelector(s)?.getBoundingClientRect().top ?? -1));
      expect(order[0] < order[1] && order[1] < order[2] && order[2] < order[3], `${tag}: Send card: Publishing first, then Send to, then the actions (${order})`);
      await pub(page).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${tag}-03-publishing-not-published.png` });

      // Publish as Public → same call → "Published!" modal over the stepper → Done → the published box + Unpublish
      await pub(page).getByRole('button', { name: /Publish as Public/ }).click();
      await page.getByText('Public URL').first().waitFor({ timeout: 10000 }).catch(() => {});
      expect(JSON.stringify(state.publishes) === '[{"role":1}]', `${tag}: POST /memories/901/publish role 1 (${JSON.stringify(state.publishes)})`);
      const done = page.getByRole('button', { name: 'Done', exact: true }).filter({ visible: true }).last();
      const top = await done.evaluate((b) => { const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return Boolean(hit && b.contains(hit)); }).catch(() => false);
      expect(top, `${tag}: the "Published!" modal is on top of the stepper (Done is clickable)`);
      expect(await page.getByText(LINK).first().isVisible().catch(() => false) || (await page.locator(`input[value="${LINK}"]`).filter({ visible: true }).count()) > 0, `${tag}: the modal shows the link`);
      await page.waitForTimeout(700);
      const toastsOverModal = await page.locator('[data-sonner-toast]').filter({ visible: true }).count();
      expect(toastsOverModal === 0, `${tag}: no toasts over the "Published!" modal (${toastsOverModal})`);
      await page.screenshot({ path: `${OUT}/${tag}-04-published-modal-over-stepper.png` });
      await done.click();
      await page.waitForTimeout(700);
      expect(await flow(page).isVisible().catch(() => false), `${tag}: Done → still in the stepper`);
      const p2 = (await pub(page).textContent()) ?? '';
      expect(p2.includes('Published · Public') && p2.includes('Published Campaign') && p2.includes('Live'), `${tag}: Publishing shows Published · Public with the published box`);
      expect(await pub(page).locator(`input[value="${LINK}"]`).count() === 1, `${tag}: the link is in the Publishing card`);
      expect(!p2.includes('Publish as Public'), `${tag}: no Publish choices while published (as before: Unpublish first)`);
      await pub(page).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${tag}-05-publishing-published.png` });

      // Copy
      await pub(page).getByRole('button', { name: /^Copy$/ }).or(pub(page).locator('button:has(svg.lucide-copy)')).first().click();
      expect(await toast(page, 'Link copied to clipboard'), `${tag}: Copy → "Link copied to clipboard"`);
      expect((await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')) === LINK, `${tag}: the link is on the clipboard`);
      // Share menu: every option
      await pub(page).locator('button:has(svg.lucide-share2), button:has(svg.lucide-share-2)').first().click();
      await page.waitForTimeout(300);
      for (const t of ['Copy Link', 'Share on Facebook', 'Share on X', 'Share on LinkedIn', 'Embed Code']) expect(await pub(page).getByText(t, { exact: true }).isVisible().catch(() => false), `${tag}: Share menu has "${t}"`);
      await page.screenshot({ path: `${OUT}/${tag}-06-share-menu.png` });
      await pub(page).getByText('Embed Code', { exact: true }).click();
      expect(await toast(page, 'Embed code copied to clipboard!'), `${tag}: Embed Code copies`);
      expect(((await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')) || '').includes(`<iframe src="${LINK}"`), `${tag}: embed code on the clipboard`);
      // QR
      await pub(page).locator('button:has(svg.lucide-qr-code)').first().click();
      await page.getByText('Scan to View').first().waitFor({ timeout: 4000 }).catch(() => {});
      expect(await page.getByRole('button', { name: 'Download QR Code' }).isVisible().catch(() => false), `${tag}: QR Code popover with Download QR Code`);
      await page.screenshot({ path: `${OUT}/${tag}-07-qr.png` });
      const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await page.getByRole('button', { name: 'Download QR Code' }).click();
      expect(Boolean(await dl) || await toast(page, 'QR Code downloaded'), `${tag}: Download QR Code downloads`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      // Share message
      const msg = pub(page).getByPlaceholder('View this published storeel on stasht.');
      await msg.fill('Fresh Jeeps this week');
      await pub(page).getByRole('button', { name: 'Save', exact: true }).click();
      expect(await toast(page, 'Share message saved'), `${tag}: Share message saved`);
      expect(state.shareMessages.at(-1) === 'Fresh Jeeps this week' && state.shareMessages.length === 1, `${tag}: POST share-message once (${JSON.stringify(state.shareMessages)})`);

      // Unpublish
      await pub(page).getByRole('button', { name: 'Unpublish', exact: true }).click();
      expect(await toast(page, 'Campaign unpublished successfully!'), `${tag}: Unpublish → toast`);
      await page.waitForTimeout(500);
      expect(state.unpublishes === 1, `${tag}: POST /memories/memory-unpublished`);
      expect(((await pub(page).textContent()) ?? '').includes('Not published') && await pub(page).getByRole('button', { name: /Publish as Private/ }).isVisible(), `${tag}: back to the three Publish choices`);

      // Private (the access-token link), then View Only
      await pub(page).getByRole('button', { name: /Publish as Private/ }).click();
      await page.getByText('Public URL').first().waitFor({ timeout: 10000 }).catch(() => {});
      await page.getByRole('button', { name: 'Done', exact: true }).filter({ visible: true }).last().click();
      await page.waitForTimeout(600);
      expect(state.publishes.at(-1)?.role === 3 && ((await pub(page).textContent()) ?? '').includes('Published · Private'), `${tag}: Publish as Private → role 3, Published · Private`);
      expect(((await pub(page).textContent()) ?? '').includes("Private link only: it can't be sent. Unpublish, then publish it as Public or View Only to send it."), `${tag}: Private says it can't be sent`);
      expect(await pub(page).locator(`input[value="${LINK}?access_token=tok123"]`).count() === 1, `${tag}: the private (access-token) link is shown`);
      await pub(page).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${tag}-08-published-private.png` });
      // The Send card follows the Publishing card: a private (access-token) campaign can't be sent, and the confirm says
      // to publish it another way in Publishing (it used to say "on the campaign page").
      const sendCard = flow(page).locator('#st-step-send');
      await sendCard.getByLabel('Email address').fill('jordan@example.com');
      await sendCard.getByLabel(/^Message/).fill('New Jeeps in.');
      await page.waitForTimeout(1200);
      await flow(page).getByRole('button', { name: 'Save & Send', exact: true }).filter({ visible: true }).last().click();
      const confirm = page.getByRole('dialog', { name: 'Send this Storeel now?' });
      await confirm.waitFor({ timeout: 8000 }).catch(() => {});
      const ctext = (await confirm.textContent().catch(() => '')) ?? '';
      expect(ctext.includes('Publish it as Public or View Only at the top of the Send card, then send it.'), `${tag}: private campaign: the send confirm points at the top of the Send card`);
      expect(await confirm.getByRole('button', { name: 'Send Now' }).isDisabled().catch(() => false), `${tag}: private campaign: Send Now is off`);
      await page.screenshot({ path: `${OUT}/${tag}-08b-private-send-confirm.png` });
      await confirm.getByRole('button', { name: /^(Cancel|Not now|Back)$/ }).first().click().catch(async () => { await page.keyboard.press('Escape'); });
      await page.waitForTimeout(500);
      if (await confirm.isVisible().catch(() => false)) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
      expect(!state.sends, `${tag}: nothing sent`);
      expect(state.puts.at(-1)?.location === 'Toronto, Canada', `${tag}: Send → Save & Send PUT keeps the saved Location (${state.puts.at(-1)?.location})`);
      await pub(page).getByRole('button', { name: 'Unpublish', exact: true }).click();
      await page.waitForTimeout(800);
      await pub(page).getByRole('button', { name: /Publish as View Only/ }).click();
      await page.getByText('Public URL').first().waitFor({ timeout: 10000 }).catch(() => {});
      await page.getByRole('button', { name: 'Done', exact: true }).filter({ visible: true }).last().click();
      await page.waitForTimeout(600);
      expect(state.publishes.at(-1)?.role === 2 && ((await pub(page).textContent()) ?? '').includes('Published · View Only'), `${tag}: Publish as View Only → role 2, Published · View Only`);
      expect(state.puts.length === 1, `${tag}: publishing saved nothing else (the one PUT is Save & Send's)`);

      // A share message typed in the card but not Saved: leaving the stepper saves it (review M2)
      await pub(page).getByPlaceholder('View this published storeel on stasht.').fill('Typed, not saved');
      // Close → the campaign page shows the published box as before; Send still there (no Unpublish button)
      await flow(page).getByRole('button', { name: /^(Cancel|Close)$/ }).filter({ visible: true }).last().click();
      await page.waitForTimeout(800);
      expect(state.shareMessages.at(-1) === 'Typed, not saved', `${tag}: a typed share message is saved when the stepper closes (${JSON.stringify(state.shareMessages)})`);
      await page.waitForTimeout(700);
      expect(!(await flow(page).count()), `${tag}: Close → back on the campaign page`);
      expect(await page.getByText('Published Campaign').filter({ visible: true }).count() > 0 || await page.getByText('Published Campaign').count() > 0, `${tag}: the page still shows its published box`);
      expect(await sendButton(page).isVisible().catch(() => false) && !(await page.getByRole('button', { name: /^Unpublish$/ }).filter({ visible: true }).count()), `${tag}: Send (not Unpublish) while published`);
      await page.screenshot({ path: `${OUT}/${tag}-09-page-published-send.png` });

      // Edit → the stepper at step 1
      if (width >= 1024) await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click();
      else await page.getByRole('button', { name: 'Edit Campaign' }).filter({ visible: true }).first().click();
      await flow(page).getByPlaceholder('Give your campaign a meaningful title').waitFor({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(900);
      expect(await inViewport(page, flow(page).getByPlaceholder('Give your campaign a meaningful title')), `${tag}: Edit opens at step 1 (title in the viewport)`);
      expect((await flow(page).getByPlaceholder('Give your campaign a meaningful title').inputValue()) === 'Thomas Jeeps Inventory', `${tag}: step 1 prefilled`);
      expect(await pub(page).count() === 1, `${tag}: Publishing is in the Send card from Edit too`);
      await page.screenshot({ path: `${OUT}/${tag}-10-edit-opens-at-step-1.png` });
      await page.waitForTimeout(2000); // longer than the device-location answer
      expect((await flow(page).getByPlaceholder(/Enter location/).inputValue()) === 'Toronto, Canada', `${tag}: Edit keeps the saved Location (no device city)`);
      const putsBefore = state.puts.length;
      await flow(page).getByRole('button', { name: 'Save Changes', exact: true }).filter({ visible: true }).last().click();
      await page.getByText('Changes saved').first().waitFor({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(800);
      expect(state.puts.length === putsBefore + 1 && state.puts.at(-1)?.location === 'Toronto, Canada', `${tag}: Edit → Save Changes PUT keeps the saved Location (${state.puts.at(-1)?.location})`);
      expect((await page.evaluate(() => window.__geoCalls)) === 0, `${tag}: Edit / Send never asked for the device location`);

      // Phones, scrolled: the pinned top bar (Chris, 9 Nov 2026 — it replaced the white compact header): its ⋯ has Edit
      // Campaign (from the compact header's ⋮), and its Send still opens the stepper at the Send card.
      if (width < 1024) {
        await page.evaluate(() => window.scrollTo(0, 1600));
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(900);
        const pinned = page.locator('[data-campaign-phone-bar]').filter({ visible: true }).first();
        if (await pinned.count()) {
          expect((await pinned.boundingBox())?.y === 0, `${tag}: the top bar is pinned at the top after scrolling`);
          await pinned.locator('label:has-text("Edit Cover") + button').click();
          await page.waitForTimeout(400);
          expect(await page.getByText('Edit Campaign', { exact: true }).filter({ visible: true }).count() > 0, `${tag}: pinned ⋯ offers Edit Campaign`);
          await page.screenshot({ path: `${OUT}/${tag}-11-compact-menu.png` });
          await page.mouse.click(200, 700);
          await page.waitForTimeout(300);
          await pinned.getByRole('button', { name: 'Send', exact: true }).click();
          await flow(page).locator('#st-step-send').waitFor({ timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(900);
          expect(await inViewport(page, flow(page).locator('#st-step-send-title')), `${tag}: pinned Send opens at the Send card`);
          await flow(page).getByRole('button', { name: /^(Cancel|Close)$/ }).filter({ visible: true }).last().click();
          await page.waitForTimeout(500);
        } else expect(false, `${tag}: the pinned top bar is there after scrolling`);
      }

      // Create Campaign keeps the device-city default, but only for an empty Location, read when the answer comes
      await page.getByRole('button', { name: 'Back', exact: true }).filter({ visible: true }).first().click();
      await page.getByText('All Campaigns', { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 10000 }).catch(() => {});
      const create = page.getByRole('dialog', { name: 'Create Campaign' });
      for (const typed of ['', 'Paris, France']) {
        await page.getByRole('button', { name: /^Create( a Campaign)?$/ }).filter({ visible: true }).last().click();
        const loc = create.getByPlaceholder(/Enter location/);
        await loc.waitFor({ timeout: 10000 }).catch(() => {});
        if (typed) await loc.fill(typed);
        await page.waitForTimeout(2500);
        const got = await loc.inputValue().catch(() => '');
        expect(got === (typed || 'Mumbai, India'), `${tag}: Create with ${typed ? 'a typed' : 'an empty'} Location → "${got}"`);
        await create.getByRole('button', { name: 'Cancel', exact: true }).filter({ visible: true }).last().click();
        await page.waitForTimeout(600);
        const discard = page.getByRole('button', { name: /^(Discard|Leave|Yes, discard|Discard changes)$/ }).filter({ visible: true });
        if (await discard.count()) { await discard.first().click(); await page.waitForTimeout(400); }
      }
      await context.close();
    }

    // ── A collaborator with the admin role (full page, not the owner): Send disabled like Publish was; the published box works ─
    {
      const { page, context, state } = await open({ width, height }, { published: 1, owner: false, role: 'admin' });
      await openCampaign(page);
      const send = sendButton(page);
      expect(await send.isVisible().catch(() => false) && await send.isDisabled(), `${tag}: collaborator (admin): Send shown, disabled (as Publish was)`);
      expect(!(await page.getByRole('button', { name: /^(Publish|Unpublish)$/ }).filter({ visible: true }).count()), `${tag}: collaborator: no Publish / Unpublish`);
      const box = page.getByText('Published Campaign').first();
      expect(await box.count() > 0, `${tag}: collaborator still sees the published box`);
      await page.locator(`input[value="${LINK}"]`).first().scrollIntoViewIfNeeded().catch(() => {});
      await page.screenshot({ path: `${OUT}/${tag}-12-collaborator-admin.png` });
      await page.locator('button:has(svg.lucide-copy)').filter({ visible: true }).first().click().catch(() => {});
      expect(await toast(page, 'Link copied to clipboard'), `${tag}: collaborator can still copy the link`);
      expect(state.publishes.length === 0 && state.unpublishes === 0, `${tag}: collaborator: nothing published`);
      await context.close();
    }

    // ── A contributor: the shared view, unchanged (never had Publish) ─────────────────────────────────────────────
    {
      const { page, context } = await open({ width, height }, { published: 1, owner: false, role: 'contributor' });
      await openCampaign(page);
      expect(!(await page.getByRole('button', { name: /^(Publish|Unpublish|Send)$/ }).filter({ visible: true }).count()), `${tag}: contributor (shared view): no Send / Publish, as before`);
      await page.screenshot({ path: `${OUT}/${tag}-13-contributor.png` });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall Send / Publishing checks passed');
process.exit(failures.length ? 1 : 0);
