// Chris 21 Nov 2026 (c21-M), in the real app (App → Campaigns → campaign page → Send → the Storeel stepper's Send card),
// at 1280 and 390:
//  P6  "Save as default" under the Message box: ticking it saves the note as the account's default message
//      (PUT /newsletter-brand default_message, the newsletter composer's "Set as my default message" storage); the
//      next Storeel opens with it pre-filled and the box ticked; editing the text unticks it; unticking clears it.
//  P10 No YES / NO question: the hint says 'We add their link and "Reply STOP to unsubscribe."', "People get:" ends
//      "(link to your campaign) Reply STOP to unsubscribe.", and TheBodyPolitik's 61-character note is 2 text parts.
//  P5  The confirm says WHY there are too few text parts: the plan has none ("Contact Stasht to add some"), or how many
//      went out and how many sends going out / scheduled newsletters hold. Send Now stays off; nothing is sent.
// node tests/campaign-detail/ui/c21-storeel-send-message.mjs   (dev server: C21_BASE, default http://127.0.0.1:5253;
//   C21_SHOTS = screenshot dir). Every API call is answered here; every non-local request is aborted.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';
import { STUB_STRIPE, STUB_GAPI } from './cover-fixtures.mjs';

const { chromium } = pw;
const BASE = process.env.C21_BASE || 'http://127.0.0.1:5253';
const OUT = process.env.C21_SHOTS || '/private/tmp/claude-501/c21-messaging/shots';
mkdirSync(OUT, { recursive: true });

const MAIN = { id: 70, external_user_id: 707, name: 'TheBodyPolitik', email: 'hello@bodypolitik.test', role: '2', status: 1, is_activated: true, profile_color: '#1D4ED8' };
const NOTE = 'Let me know if you are interested in any of these treatments.';
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="${['#6C60FF', '#F59E0B', '#10B981'][n % 3]}"/></svg>`;
const img = (n) => `${BASE}/cd-img/${n}.jpg`;
const post = (id, n) => ({
  id, name: `Moment ${n}`, title: `Moment ${n}`, description: '', master_image_link: img(n), image_link: img(n), media_url: img(n),
  capture_date: `2026-11-1${n} 10:00:00`, uploaded_at: `2026-11-1${n} 10:00:00`, parent_id: null, after_post_id: null, admin_approval: 1,
  comments: [], comments_count: 0, sub_images: [],
});
const CAMPAIGN = {
  id: 901, title: 'November Specials', user_id: 707, slug: 'november-specials-abc123', category: { id: 5, name: 'Personal' }, sub_category: null, photos: { count: 2 },
  collaborators: [], user: { id: 707, name: 'TheBodyPolitik' }, created_at: '2026-11-01 10:00:00', location: 'Toronto, Canada', tags: [],
  min_uploaded_img_date: '2026-11-01', max_uploaded_img_date: '2026-11-01', last_update_img: null, share_message: null, published: 1, published_url: `${BASE}/published-memory/november-specials-abc123`,
};
const ALLOWANCE = { plan: 'Teams', email_limit: 5000, sms_limit: 250, email_used: 0, sms_used: 0, email_pending: 0, sms_pending: 0, resets_at: '2026-12-01T05:00:00Z' };

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }, { defaultMessage = null, allowance = ALLOWANCE } = {}) {
  const state = { defaultMessage, brandPuts: [], sends: 0, allowance };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('c21-seeded')) return;
    sessionStorage.setItem('c21-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'main-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels');
  }, [MAIN]);
  const brand = () => ({ header: { type: 'color', color: '#6C60FF' }, business_address: '1 King St, Toronto', default_message: state.defaultMessage, recent_colors: [] });
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
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: [CAMPAIGN], total: 1 }, latest_memories: [CAMPAIGN], sidebar: { categories: { items: [{ id: 5, name: 'Personal', memory_count: 1 }] }, labels: { items: [] } } } } });
    }
    if (p === '/memories/901' && m === 'GET') return route.fulfill({ json: { status: 'success', data: { memory: { ...CAMPAIGN, posts: [post(11, 1), post(12, 2)], linked_memories: [], widgets: [], unified_order: null } } } });
    if (p === '/memories/901' && m === 'PUT') return route.fulfill({ json: { success: true, data: CAMPAIGN } });
    if (p === '/memories/categories-labels') return route.fulfill({ json: { success: true, data: { categories: [{ id: 5, name: 'Personal', is_owner: true, can_add_story: true }], labels: [] } } });
    if (p === '/newsletter-brand' && m === 'GET') return route.fulfill({ json: { success: true, data: brand() } });
    if (p === '/newsletter-brand' && m === 'PUT') {
      state.brandPuts.push(body);
      if (body && 'default_message' in body) state.defaultMessage = body.default_message ? String(body.default_message).trim() : null;
      return route.fulfill({ json: { success: true, data: brand() } });
    }
    if (p === '/memories/901/storeel-audience-count') {
      const ch = body?.channels ?? [];
      return route.fulfill({ json: { success: true, data: { email: ch.includes('email') ? 1 : 0, sms: ch.includes('sms') ? 1 : 0, skipped: { no_email: 0, no_phone: 0, unsubscribed: 0, duplicate: 0 }, person: { email: null, sms: null, errors: {} } }, storeel: { max_messages: 5000, needed: ch.length, over_limit: false, sms: null, allowance: state.allowance } } });
    }
    if (p === '/memories/901/storeel-send') { state.sends++; return route.fulfill({ status: 500, json: { message: 'must not be sent in this test' } }); }
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Teams' } } } });
    if (p === '/user/check-memory-limit') return route.fulfill({ json: { success: true, data: { limit_status: { status: 'within_limit', current_memories: 1, memory_limit: 50 } } } });
    if (p === '/lead-groups') return route.fulfill({ json: { groups: [] } });
    if (p === '/newsletters/lead-options') return route.fulfill({ json: { success: true, data: { data: [], current_page: 1, last_page: 1, total: 0 } } });
    if (p === '/contact-lists') return route.fulfill({ json: { success: true, data: { lists: [] } } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(process.env.C21_STACK ? `${e.message} @ ${(e.stack || '').split('\n').slice(1, 4).join(' / ')}` : e.message));
  await page.goto(`${BASE}/memories`);
  return { context, page, state };
}

async function openCampaign(page) {
  const card = page.getByText(/^November Specials/).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(800);
  await card.click();
  await page.getByText('Moment 1').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

const flow = (page) => page.getByRole('dialog', { name: 'Edit Campaign' });
const card = (page) => flow(page).locator('#st-step-send');
const sendButton = (page) => page.getByRole('button', { name: 'Send', exact: true }).filter({ visible: true }).first();
const box = (page) => card(page).getByRole('checkbox', { name: 'Save as default' });
const messageBox = (page) => card(page).getByLabel(/^Message/);

async function openSend(page) {
  await sendButton(page).click();
  await card(page).waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function closeFlow(page) {
  await flow(page).getByRole('button', { name: 'Cancel', exact: true }).filter({ visible: true }).last().click();
  await page.waitForTimeout(600);
  // A "discard changes?" question, if the stepper asks one.
  const discard = page.getByRole('button', { name: /^(Discard|Leave|Yes, discard|Discard changes)$/ }).filter({ visible: true });
  if (await discard.count()) { await discard.first().click(); await page.waitForTimeout(500); }
  await flow(page).waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
}

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    // ── P6 + P10: no default yet → type → Save as default → reopen pre-filled ─────────────────────────────────────
    {
      const { page, context, state } = await open({ width, height });
      await openCampaign(page);
      await openSend(page);
      expect(await card(page).isVisible().catch(() => false), `${tag}: Send opens the stepper's Send card`);
      await card(page).getByLabel(/^Phone/).first().fill('1235555555');
      expect((await messageBox(page).inputValue()) === '', `${tag}: no saved default → the Message box starts empty`);
      expect(await box(page).isVisible() && !(await box(page).isChecked()), `${tag}: "Save as default" is under the Message box, unticked`);
      expect(await box(page).isDisabled(), `${tag}: an empty box can't be saved as the default`);
      await messageBox(page).fill(NOTE);
      await page.waitForTimeout(800);
      const text = (await card(page).textContent()) ?? '';
      expect(text.includes('We add their link and "Reply STOP to unsubscribe."'), `${tag}: P10 hint: 'We add their link and "Reply STOP to unsubscribe."'`);
      expect(!/YES \/ NO|Reply YES|Reply NO|respond directly/.test(text), `${tag}: P10 no YES / NO or "respond directly" anywhere in the Send card`);
      expect(text.includes(`People get: Hi (their first name), this message came from TheBodyPolitik. ${NOTE} (link to your campaign) Reply STOP to unsubscribe.`), `${tag}: P10 "People get:" ends with the STOP line only`);
      expect(text.includes('Sent as 2 text messages'), `${tag}: P5/P10 the 61-character note is 2 text parts (was 3)`);
      expect(text.includes('61 characters'), `${tag}: 61 characters`);
      // Order: textarea, then the hint row, then "Save as default", then the parts line (P6 screenshot: under the message).
      const order = await card(page).evaluate((el) => {
        const ta = el.querySelector('textarea')?.getBoundingClientRect().top ?? -1;
        const cb = [...el.querySelectorAll('label')].find((l) => l.textContent?.includes('Save as default'))?.getBoundingClientRect().top ?? -1;
        const parts = [...el.querySelectorAll('p')].find((p) => p.textContent?.startsWith('Sent as'))?.getBoundingClientRect().top ?? -1;
        return [ta, cb, parts];
      });
      expect(order[0] > 0 && order[0] < order[1] && order[1] < order[2], `${tag}: "Save as default" sits under the Message box, above "Sent as …" (${order})`);
      await box(page).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${tag}-01-send-card-p10-text.png` });

      await box(page).check();
      await page.waitForTimeout(900);
      expect(JSON.stringify(state.brandPuts) === JSON.stringify([{ default_message: NOTE }]), `${tag}: P6 tick → PUT /newsletter-brand {default_message: the note} (${JSON.stringify(state.brandPuts)})`);
      expect(await box(page).isChecked(), `${tag}: P6 the box stays ticked once saved`);
      await page.screenshot({ path: `${OUT}/${tag}-02-saved-as-default.png` });

      // Next Storeel: pre-filled, ticked.
      await closeFlow(page);
      await openSend(page);
      expect((await messageBox(page).inputValue()) === NOTE, `${tag}: P6 reopened → the Message box is pre-filled with the default (${await messageBox(page).inputValue()})`);
      expect(await box(page).isChecked(), `${tag}: P6 pre-filled default → "Save as default" ticked`);
      await box(page).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${tag}-03-next-storeel-prefilled.png` });

      // Editing it for this one Storeel unticks the box; the saved default stays.
      await messageBox(page).fill(`${NOTE} This week only.`);
      await page.waitForTimeout(500);
      expect(!(await box(page).isChecked()) && state.brandPuts.length === 1, `${tag}: P6 edited → unticked, the saved default is untouched`);
      // Unticking a ticked default clears it.
      await messageBox(page).fill(NOTE);
      await page.waitForTimeout(400);
      expect(await box(page).isChecked(), `${tag}: back to the saved text → ticked again`);
      await box(page).uncheck();
      await page.waitForTimeout(900);
      expect(JSON.stringify(state.brandPuts.at(-1)) === JSON.stringify({ default_message: null }) && state.defaultMessage === null, `${tag}: P6 untick → the default is cleared (${JSON.stringify(state.brandPuts.at(-1))})`);
      expect(state.sends === 0, `${tag}: nothing sent`);
      await context.close();
    }

    // ── P5: a plan with no text parts / parts held by other sends: the confirm says why ───────────────────────────
    for (const [name, allowance, why] of [
      ['no-parts', { ...ALLOWANCE, sms_limit: 0 }, "Your plan doesn't include text message parts. Contact Stasht to add some."],
      ['held', { ...ALLOWANCE, sms_used: 12, sms_pending: 238 }, 'Your plan includes 250 text message parts a month: 12 sent, 238 held by sends still going out or scheduled newsletters.'],
    ]) {
      const { page, context, state } = await open({ width, height }, { defaultMessage: NOTE, allowance });
      await openCampaign(page);
      await openSend(page);
      expect((await messageBox(page).inputValue()) === NOTE, `${tag} ${name}: the saved default is pre-filled`);
      await card(page).getByLabel(/^Phone/).first().fill('1235555555');
      await page.waitForTimeout(1500);
      const saveSend = flow(page).getByRole('button', { name: 'Save & Send', exact: true }).filter({ visible: true }).last();
      await saveSend.click();
      const confirm = page.getByRole('dialog', { name: 'Send this Storeel now?' });
      await confirm.waitFor({ timeout: 8000 }).catch(() => {});
      const ctext = (await confirm.textContent().catch(() => '')) ?? '';
      expect(ctext.includes('1 person · 2 parts each') || /2 parts each/.test(ctext), `${tag} ${name}: the confirm counts 2 parts each (${ctext.slice(0, 120)})`);
      expect(ctext.includes('This needs 2 text message parts, but your plan has 0 left this month.'), `${tag} ${name}: still says 2 needed, 0 left`);
      expect(ctext.includes(why), `${tag} ${name}: P5 says why: "${why}"`);
      expect(await confirm.getByRole('button', { name: 'Send Now' }).isDisabled(), `${tag} ${name}: Send Now is off`);
      await page.screenshot({ path: `${OUT}/${tag}-04-confirm-${name}.png` });
      await confirm.getByRole('button', { name: 'Back', exact: true }).click();
      expect(state.sends === 0, `${tag} ${name}: nothing sent`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const relevant = pageErrors.filter((e) => !/ResizeObserver/.test(e));
if (relevant.length) console.log('page errors:', relevant.slice(0, 5));
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall c21-M Send step checks passed');
process.exit(failures.length ? 1 : 0);
