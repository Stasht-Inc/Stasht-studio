// "Add a moment" bar on the public campaign page (/published-memory/:slug), Chris 30 Oct.
// node tests/published-memory/ui/add-moment-bar.mjs   (needs the dev server: PM_BASE, default http://localhost:5241)
// The page's API calls are answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: PM_SHOTS (default /private/tmp/claude-501/published-memory-ui/shots).
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.PM_BASE || 'http://localhost:5241';
const OUT = process.env.PM_SHOTS || '/private/tmp/claude-501/published-memory-ui/shots';
mkdirSync(OUT, { recursive: true });

const COLORS = ['#6C60FF', '#F59E0B', '#10B981', '#EF4444', '#0EA5E9'];
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="${COLORS[n % COLORS.length]}"/><text x="400" y="520" font-size="120" text-anchor="middle" fill="white" font-family="sans-serif">${n}</text></svg>`;
// .jpg in the path: the page shows initials instead of any .svg moment image. The body is an SVG all the same.
const img = (n) => `${BASE}/pm-img/${n}.jpg`;

const owner = {
  id: 7, name: 'Serpa Chrysler', email: 'sales@serpachrysler.ca', phone_number: '+1 416 555 0100', profile_image: null,
  profile_color: '#6C60FF', is_business: 1, website: 'https://serpachrysler.ca',
};
const post = (id, n, over = {}) => ({
  id, name: `Moment ${n}`, title: `Moment ${n}`, description: `Picked up the new Jeep, moment ${n}.`, master_image_link: img(n), image_link: img(n),
  capture_date: `2026-10-${String(10 + n).padStart(2, '0')} 10:00:00`, uploaded_at: `2026-10-${String(10 + n).padStart(2, '0')} 10:00:00`,
  parent_id: null, after_post_id: null, admin_approval: 1, comments: [], comments_count: 0, location: 'Toronto, ON', ...over,
});
function memory(posts) {
  return {
    id: 501, title: 'October Deals at Serpa', slug: 'october-deals', published: 1, user_id: 7, user: owner,
    last_update_img: img(0), description: 'Our customers this month.', posts, linked_memories: [], widgets: [], unified_order: null,
    category: { name: 'Automotive' }, tags: [], created_at: '2026-10-01 10:00:00',
  };
}
const WITH_MOMENTS = memory([post(11, 1), post(12, 2, { after_post_id: 11 }), post(13, 3, { after_post_id: 12 }), post(14, 4, { after_post_id: 13 })]);
const EMPTY = memory([]);

const failures = [];
// What the form sent to /memories/submit-photo (the mock answers the upload and the submit).
const submits = [];
// A 1x1 PNG for the form's photo.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height, memoryData = WITH_MOMENTS, query = '' }) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      blocked.add(url.hostname);
      // The app loads Stripe.js and Google's api.js on every route: do-nothing stubs answered here (as mock-api.mjs does).
      if (url.hostname === 'js.stripe.com') {
        return route.fulfill({ contentType: 'text/javascript', body: 'window.Stripe=function(){return{elements:function(){return{create:function(){return{mount:function(){},on:function(){},destroy:function(){},unmount:function(){}}},getElement:function(){return null}}}}};' });
      }
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') {
        return route.fulfill({ contentType: 'text/javascript', body: 'window.gapi={load:function(n,c){var f=typeof c==="function"?c:(c&&c.callback);if(f)f();}};' });
      }
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/pm-img/')) return route.fulfill({ contentType: 'image/svg+xml', body: svg(Number(url.pathname.match(/(\d+)/)?.[1] ?? 0)) });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (url.pathname === '/api/react/published-memories') return route.fulfill({ json: { success: true, data: { memory: memoryData, order_by: 'asc' } } });
    if (url.pathname === '/api/react/public/upload-image-with-metadata') {
      return route.fulfill({ json: { success: true, data: { fileUrl: `${BASE}/pm-img/9.jpg`, location: null, capture_date: null, originalSizeMB: 0.01 } } });
    }
    if (url.pathname === '/api/react/memories/submit-photo') {
      submits.push(JSON.parse(route.request().postData() || 'null'));
      return route.fulfill({ json: { success: true, message: 'Submitted' } });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { success: true, data: [] } });
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/published-memory/october-deals${query}`);
  await page.getByText('Timeline').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(400);
  return { context, page };
}

async function shot(page, file) {
  const path = `${OUT}/${file}.png`;
  await page.screenshot({ path }); // the viewport: what is on screen, with the bar where it sits
  console.log('shot', path);
}

const barButton = (page) => page.getByRole('button', { name: 'Add a moment', exact: true });

/** The bar is on screen, fixed, flush with the bottom of the viewport. Returns the bar's top edge. */
async function barAtBottom(page, label) {
  const button = barButton(page);
  if (!(await button.isVisible())) { failures.push(`${label}: Add a moment not visible`); return null; }
  const info = await page.evaluate(() => {
    const bar = document.querySelector('[data-add-moment-bar]');
    const r = bar.getBoundingClientRect();
    const b = bar.querySelector('button').getBoundingClientRect();
    return { position: getComputedStyle(bar).position, top: r.top, bottom: r.bottom, vh: window.innerHeight, bh: b.height, bw: b.width, vw: window.innerWidth, bg: getComputedStyle(bar.querySelector('button')).backgroundColor };
  });
  expect(info.position === 'fixed', `${label}: bar is position fixed (${info.position})`);
  expect(Math.abs(info.bottom - info.vh) <= 1, `${label}: bar sits on the bottom edge (${info.bottom} vs ${info.vh})`);
  expect(Math.round(info.bh) === 48, `${label}: button is 48px tall (${info.bh})`);
  expect(info.bg === 'rgb(108, 96, 255)', `${label}: button is #6C60FF (${info.bg})`);
  if (info.vw < 1024) expect(Math.round(info.bw) === info.vw - 32, `${label}: full width on phones (${info.bw} of ${info.vw})`);
  else expect(info.bw <= 448, `${label}: centred, max width on desktop (${info.bw})`);
  return info.top;
}

async function scrollToBottom(page, width) {
  if (width < 1024) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  } else {
    await page.evaluate(() => {
      const scrollers = [...document.querySelectorAll('.overflow-y-auto')].filter((el) => el.scrollHeight > el.clientHeight && el.offsetParent);
      for (const el of scrollers) el.scrollTop = el.scrollHeight;
    });
  }
  await page.waitForTimeout(500);
}

/** The bottom of the last visible element matching text (in the layout that shows at this width). */
async function bottomOf(page, text) {
  return page.evaluate((t) => {
    const els = [...document.querySelectorAll('p, span, div')].filter((el) => el.textContent.trim() === t && el.offsetParent !== null);
    const el = els[els.length - 1];
    return el ? el.getBoundingClientRect().bottom : null;
  }, text);
}

/** Opens the form from the bar, adds a photo and a name, submits; returns what reached the API. */
async function submitFromBar(page, label) {
  const count = submits.length;
  await barButton(page).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 5000 });
  await dialog.locator('input[type=file]').setInputFiles({ name: 'moment.png', mimeType: 'image/png', buffer: PNG });
  await dialog.getByPlaceholder('Your name').fill('Jamie Guest');
  const submit = dialog.getByRole('button', { name: 'Submit', exact: true });
  await submit.waitFor({ state: 'visible' });
  for (let i = 0; i < 40 && (await submit.isDisabled()); i++) await page.waitForTimeout(100);
  await submit.click();
  for (let i = 0; i < 40 && submits.length === count; i++) await page.waitForTimeout(100);
  if (submits.length === count) failures.push(`${label}: nothing submitted`);
  await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => failures.push(`${label}: form did not close after submitting`));
  return submits[submits.length - 1] ?? null;
}

async function noOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = String(width);
    const { page, context } = await open({ width, height });
    await barAtBottom(page, `${tag} top`);
    if (width < 1024) expect(await noOverflow(page), `${tag}: no sideways scroll`);
    await shot(page, `${tag}-01-top`);

    await scrollToBottom(page, width);
    const barTop = await barAtBottom(page, `${tag} scrolled`);
    const powered = await bottomOf(page, 'Powered by Stasht');
    expect(powered !== null && barTop !== null && powered <= barTop, `${tag}: "Powered by Stasht" above the bar (${powered} vs ${barTop})`);
    const lastCard = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('img')].filter((i) => i.offsetParent !== null && /pm-img\/4\.jpg/.test(i.src));
      const el = imgs[imgs.length - 1]?.closest('.rounded-2xl');
      return el ? el.getBoundingClientRect().bottom : null;
    });
    expect(lastCard !== null && barTop !== null && lastCard <= barTop, `${tag}: last moment not covered (${lastCard} vs ${barTop})`);
    if (width < 1024) {
      const card = await bottomOf(page, owner.name);
      expect(card !== null && card <= barTop, `${tag}: e-card above the bar (${card} vs ${barTop})`);
    }
    await shot(page, `${tag}-02-bottom`);

    // Opens the "share a moment" form; the bar hides while it is open and comes back with focus on it.
    await barButton(page).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => failures.push(`${tag}: form did not open`));
    expect(await dialog.getByText('Request a Moment').filter({ visible: true }).count() > 0, `${tag}: it is the Request a Moment form`);
    expect(!(await barButton(page).isVisible()), `${tag}: bar hidden while the form is open`);
    await page.waitForTimeout(400); // the dialog's open animation
    await shot(page, `${tag}-03-form-open`);
    const close = width < 1024 ? dialog.getByRole('button', { name: 'Close' }).first() : dialog.locator('button[data-slot=dialog-default-close]');
    if (await close.count()) await close.click();
    else await dialog.getByRole('button', { name: 'Cancel' }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => failures.push(`${tag}: form did not close`));
    await page.waitForTimeout(200);
    expect(await barButton(page).isVisible(), `${tag}: bar back after the form closes`);
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Add a moment'), `${tag}: focus back on Add a moment`);

    // The full-screen image viewer hides it.
    await page.evaluate(() => window.scrollTo(0, 0));
    await scrollToBottom(page, width);
    const tile = page.locator('.cursor-pointer.aspect-\\[4\\/5\\]').filter({ visible: true }).last();
    await tile.click();
    await page.locator('.fixed.inset-0.bg-black').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => failures.push(`${tag}: viewer did not open`));
    expect(!(await barButton(page).isVisible()), `${tag}: bar hidden while the image viewer is open`);
    await page.waitForTimeout(300);
    await shot(page, `${tag}-04-viewer-open`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    expect(await barButton(page).isVisible(), `${tag}: bar back after the viewer closes`);

    // The moment goes at the END of the timeline: after the last post shown (14).
    const sent = await submitFromBar(page, tag);
    expect(sent?.after_post_id === 14, `${tag}: submitted after the last post (after_post_id ${sent?.after_post_id})`);
    expect(sent?.memory_id === 501 && sent?.name === 'Jamie Guest', `${tag}: submitted for this campaign (${JSON.stringify(sent)})`);
    await context.close();

    // View-only links: no bar.
    const viewOnly = await open({ width, height, query: '?viewonly=1' });
    expect((await viewOnly.page.locator('[data-add-moment-bar]').count()) === 0, `${tag}: no bar on ?viewonly=1`);
    await shot(viewOnly.page, `${tag}-05-viewonly`);
    await viewOnly.context.close();

    // A campaign with no moments (Chris's screenshot): the bar shows and the empty card is not covered.
    const empty = await open({ width, height, memoryData: EMPTY });
    await empty.page.getByText('No moments to display').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => failures.push(`${tag}: empty state not shown`));
    await barAtBottom(empty.page, `${tag} empty`);
    await shot(empty.page, `${tag}-06-empty-top`);
    await scrollToBottom(empty.page, width);
    const emptyBarTop = await barAtBottom(empty.page, `${tag} empty scrolled`);
    const emptyBox = await bottomOf(empty.page, 'No moments to display');
    expect(emptyBox !== null && emptyBox <= emptyBarTop, `${tag}: "No moments to display" not covered (${emptyBox} vs ${emptyBarTop})`);
    const emptyPowered = await bottomOf(empty.page, 'Powered by Stasht');
    expect(emptyPowered !== null && emptyPowered <= emptyBarTop, `${tag}: empty: "Powered by Stasht" above the bar`);
    await shot(empty.page, `${tag}-07-empty-bottom`);
    const emptySent = await submitFromBar(empty.page, `${tag} empty`);
    expect(emptySent !== null && emptySent.after_post_id === null, `${tag}: no moments yet, so no position (after_post_id ${emptySent?.after_post_id})`);
    await empty.context.close();
  }

  for (const width of [360, 375]) {
    const { page, context } = await open({ width, height: 780 });
    await barAtBottom(page, `${width}`);
    expect(await noOverflow(page), `${width}: no sideways scroll`);
    await scrollToBottom(page, width);
    expect(await noOverflow(page), `${width}: no sideways scroll at the bottom`);
    await context.close();
  }
} catch (e) {
  failures.push(`threw: ${e.message}`);
} finally {
  await browser.close();
}
for (const e of pageErrors) failures.push(`page error: ${e}`);
if (blocked.size) console.log(`outside requests aborted (none reached the network): ${[...blocked].join(', ')}`);
if (failures.length) {
  console.error(`FAIL add-moment-bar\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('PASS add-moment-bar');
