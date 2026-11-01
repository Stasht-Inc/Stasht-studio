// Car campaign cards: the yellow price pill, the category pill and the title must never overlap (Chris, ClickUp
// wdy2xh2x96: on a ~190px card "2025 Audi A5 45" sat under "$44,095").
//   node tests/campaign-card/ui/car-card-overlap.mjs   (needs the dev server: CC_BASE, default http://localhost:5288)
// Opens the real Campaigns page with car cards from a mocked GET /cars at 1624x1000 (sidebar + categories column
// open, 4 cards per row), 1280x800, 1920x1080 and 390x844, then a harness row of cards at fixed widths. Every API
// call is answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: CC_SHOTS (default /private/tmp/claude-501/campaign-card-ui/shots), file names prefixed CC_PREFIX.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.CC_BASE || 'http://localhost:5288';
const OUT = process.env.CC_SHOTS || '/private/tmp/claude-501/campaign-card-ui/shots';
const PREFIX = process.env.CC_PREFIX || '';
mkdirSync(OUT, { recursive: true });

const USER = { id: 70, external_user_id: 707, name: 'Serpa Dealer', email: 'dealer@serpa.test', role: '2', status: 1 };

// A car-photo stand-in: bright sky over a dark road, like the dealer's lot photos.
const photo = (hue) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0" stop-color="hsl(${hue},40%,85%)"/><stop offset="1" stop-color="hsl(${hue},25%,55%)"/></linearGradient></defs>`
  + `<rect width="400" height="400" fill="url(#s)"/><rect y="260" width="400" height="140" fill="#3f3f46"/>`
  + `<path d="M70 250 q20-60 90-65 h80 q60 5 90 65 z" fill="hsl(${hue},60%,35%)"/><circle cx="120" cy="255" r="22" fill="#111"/>`
  + `<circle cx="285" cy="255" r="22" fill="#111"/></svg>`);

const CARS = [
  { id: 1, title: '2025 Audi A5 45 Progressiv quattro', price: '44095', category: 'preowned', images_count: 28 },
  { id: 2, title: '2024 Jeep Grand Cherokee Limited 4xe', price: '61950', category: 'hybrid', images_count: 31 },
  { id: 3, title: '2025 Chrysler Pacifica Pinnacle AWD', price: '58420', category: 'new', images_count: 24 },
  { id: 4, title: '2023 Ram 1500 Big Horn Crew Cab', price: '47888', category: 'preowned', images_count: 1 },
  { id: 5, title: '2022 Dodge Durango GT Plus', price: '39995', category: 'preowned', images_count: 19 },
  { id: 6, title: '2025 Jeep Wrangler Sahara', price: '55210', category: 'new', images_count: 22 },
  { id: 7, title: '2024 Fiat 500e', price: '32995', category: 'new', images_count: 12 },
  { id: 8, title: '2025 Audi A5 45 Progressiv quattro Sportback S line with a very long trim name', price: '144095', category: 'preowned', images_count: 128 },
].map((c, i) => ({
  ...c, main_image: photo((i * 47) % 360), location: { formatted: '1 Serpa Way, Toronto, ON' },
  spec_summary: `STK# P${4400 + c.id} / ${12000 * c.id} km / 2.0L 4cyl`, listing_url: null,
}));

// Two ordinary campaigns (no yellow label): they must render exactly as before.
const CATEGORIES = [
  { id: 11, name: 'Family', color: '#6C60FF', memory_count: 1, admin_id: null },
  { id: 12, name: 'Events', color: '#10B981', memory_count: 1, admin_id: null },
];
const MEMORIES = [
  { id: 501, title: 'Summer at the Lake House', category: CATEGORIES[0], photos: { count: 14 }, location: { formatted: 'Muskoka, ON' },
    dates: { formatted_range: 'Jul 2 - Jul 9, 2026' }, author: { name: 'Serpa Dealer' }, published: 1, last_update_img: photo(200), collaborators: [], tags: [] },
  { id: 502, title: 'Grand Opening Weekend Celebration', category: CATEGORIES[1], photos: { count: 3 }, location: { formatted: 'Toronto, ON' },
    dates: { formatted_range: 'Sep 12, 2026' }, author: { name: 'Serpa Dealer' }, last_update_img: photo(30), collaborators: [], tags: [] },
];

const failures = [];
const pageErrors = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function openCampaigns({ width, height }) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('cc-seeded')) return;
    sessionStorage.setItem('cc-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'dealer-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'storeels'); // the cards are on the Storeels tab
  }, [USER]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      blocked.add(url.hostname);
      if (url.hostname === 'js.stripe.com') {
        return route.fulfill({ contentType: 'text/javascript', body: 'window.Stripe=function(){return{elements:function(){return{create:function(){return{mount:function(){},on:function(){},destroy:function(){},unmount:function(){}}},getElement:function(){return null}}}}};' });
      }
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') {
        return route.fulfill({ contentType: 'text/javascript', body: 'window.gapi={load:function(n,c){var f=typeof c==="function"?c:(c&&c.callback);if(f)f();}};' });
      }
      return route.abort('blockedbyclient');
    }
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    const path = url.pathname.replace(/^\/api\/react/, '');
    if (url.pathname.startsWith('/api/')) {
      if (path === '/cars') {
        const cats = ['preowned', 'new', 'hybrid'];
        const data = { cars: CARS, pagination: { total: CARS.length }, filters: { categories: cats } };
        return route.fulfill({ json: { success: true, status: 200, data, cars: CARS } });
      }
      if (path === '/memories') {
        const sidebar = { categories: { items: CATEGORIES }, labels: { items: [] } };
        return route.fulfill({ json: { status: 'success', data: { all_memories: { data: MEMORIES }, sidebar } } });
      }
      if (path === '/user/storage-overview') {
        return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
      }
      return route.fulfill({ json: { success: true, data: [] } });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/memories`);
  await page.getByText(CARS[0].title).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(800);
  return { context, page };
}

// Boxes of every card on the page: the card's photo box, its title, the yellow label (price) pill, the category
// pill and the moments pill. Found by text and style so this also measures builds from before the fix.
function measureCards(page) {
  return page.evaluate(() => {
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } : null; };
    return [...document.querySelectorAll('.memory-card-container')].map((card) => {
      const photo = card.firstElementChild;
      const title = card.querySelector('h3');
      const pills = [...photo.querySelectorAll('div')].filter((d) => d.style.borderRadius === '8px' && d.offsetParent !== null);
      const text = (d) => d.textContent.trim();
      const label = pills.find((d) => d.style.background && /rgb\(252, 211, 77\)|#FCD34D/i.test(d.style.background));
      const category = pills.find((d) => d !== label && d.style.backgroundColor && d.style.fontSize === '15px');
      const moments = pills.find((d) => /moment|^\d+$/.test(text(d)) && d.style.fontSize === '12px');
      return {
        title: text(title), photo: box(photo), titleBox: box(title), label: label ? text(label) : null, labelBox: box(label),
        category: category ? text(category) : null, categoryBox: box(category), momentsBox: box(moments),
        titleLines: title ? Math.round(title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight)) : 0,
      };
    });
  });
}

const intersects = (a, b) => !!a && !!b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
const inside = (a, p) => !!a && a.l >= p.l - 0.5 && a.r <= p.r + 0.5 && a.t >= p.t - 0.5 && a.b <= p.b + 0.5;

function checkCards(cards, tag) {
  const cars = cards.filter((c) => c.label);
  expect(cars.length >= CARS.length, `${tag}: ${cars.length} car cards found (expected ${CARS.length})`);
  for (const c of cars) {
    const name = `${tag} "${c.title.slice(0, 24)}" (${Math.round(c.photo.w)}x${Math.round(c.photo.h)})`;
    expect(!!c.titleBox && !!c.labelBox && !!c.categoryBox, `${name}: title, price and category all shown`);
    expect(!intersects(c.labelBox, c.titleBox), `${name}: price pill overlaps the title`);
    expect(!intersects(c.categoryBox, c.titleBox), `${name}: category pill overlaps the title`);
    expect(!intersects(c.labelBox, c.categoryBox), `${name}: price pill overlaps the category pill`);
    expect(!intersects(c.momentsBox, c.titleBox), `${name}: moments pill overlaps the title`);
    for (const [k, b] of [['title', c.titleBox], ['price', c.labelBox], ['category', c.categoryBox]]) {
      expect(inside(b, c.photo), `${name}: ${k} not fully inside the photo`);
    }
  }
  return cars;
}

const summary = [];
async function pass(page, tag) {
  const cards = await measureCards(page);
  const cars = checkCards(cards, tag);
  const first = cars[0];
  summary.push(`${tag}: ${cars.length} car cards, first ${Math.round(first.photo.w)}x${Math.round(first.photo.h)}, title lines ${cars.map((c) => c.titleLines).join('/')}`);
  return cards;
}

async function shot(page, file, locator) {
  const out = `${OUT}/${PREFIX}${file}.png`;
  if (locator) await locator.screenshot({ path: out });
  else await page.screenshot({ path: out });
  console.log('shot', out);
}

// The card grid, and the first car card scrolled to the middle of the screen for the page screenshots.
const grid = (page) => page.locator('.memory-card-container').first().locator('xpath=ancestor::div[contains(@class,"grid")][1]');
const centerCars = (page) => page.locator('.memory-card-container').filter({ hasText: CARS[0].title }).first()
  .evaluate((el) => el.scrollIntoView({ block: 'center' }));

try {
  for (const [width, height] of [[1624, 1000], [1280, 800], [1920, 1080], [390, 844]]) {
    const tag = String(width);
    const { page, context } = await openCampaigns({ width, height });
    await centerCars(page);
    await page.waitForTimeout(200);
    await shot(page, `${tag}-page`);
    await pass(page, tag);
    if (width < 1024) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${tag}: no sideways scroll`);
      await shot(page, `${tag}-cards`, grid(page));
    }
    // Ordinary campaigns keep their Add Media (+) button, clickable over the photo (nothing covers it).
    for (const m of MEMORIES) {
      const card = page.locator('.memory-card-container').filter({ hasText: m.title }).first();
      await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(150);
      const ok = await card.evaluate((el) => {
        const plus = el.querySelector('button[title="Add media to this campaign"]');
        if (!plus) return false;
        const r = plus.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!hit && plus.contains(hit);
      });
      expect(ok, `${tag} "${m.title}": Add Media button shown and clickable`);
      // Ordinary cards must render exactly as before: compare these between builds.
      await shot(page, `${tag}-regular-${m.id}`, card);
    }

    if (width === 1624) {
      // The same cards at fixed widths (square photo on md+): the reported ~190px plus roomier and tighter cards.
      for (const w of [170, 190, 215, 240, 300]) {
        await page.evaluate((cw) => {
          const g = document.querySelector('.memory-card-container').closest('.grid');
          g.style.gridTemplateColumns = `repeat(3, ${cw}px)`;
        }, w);
        await page.waitForTimeout(400);
        await pass(page, `${tag}@card${w}`);
        await shot(page, `card-${w}`, grid(page));
      }
      await page.evaluate(() => { document.querySelector('.memory-card-container').closest('.grid').style.gridTemplateColumns = ''; });
      await page.waitForTimeout(400);

      // Edit mode: the select checkbox still shows on ordinary campaigns and toggles.
      await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click();
      await page.waitForTimeout(600);
      const regular = page.locator('.memory-card-container').filter({ hasText: MEMORIES[0].title }).first();
      const checkbox = regular.locator('div.absolute.top-3.left-3.z-20 > div').first();
      const shown = await checkbox.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
      expect(shown, `${tag}: edit-mode checkbox shows`);
      if (shown) {
        await checkbox.click();
        await page.waitForTimeout(200);
        const bg = await checkbox.evaluate((el) => el.style.backgroundColor);
        expect(bg === 'rgb(0, 117, 255)', `${tag}: edit-mode checkbox toggles (bg ${bg})`);
      }
      await regular.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await shot(page, `${tag}-edit-mode`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
summary.forEach((l) => console.log(l));
console.log('blocked (aborted):', [...blocked].join(', ') || 'none');
if (pageErrors.length) console.log('page errors:\n' + pageErrors.join('\n'));
if (failures.length) {
  console.error(`FAIL (${failures.length}):\n` + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('PASS: price, category and title never overlap');
