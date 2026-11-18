// Chris 18 Nov 2026, Campaigns page (mocked API, 1280 + 390):
//  - the default category (stored "Personal") reads "Campaigns" in the sidebar and on the card badge;
//  - an empty leftover "Website Catalogue" category shows no "Product campaigns" section;
//  - Invites has no rename pencil / colour button;
//  - the pending invite is the FIRST grid card (Accept / Deny), though it is the oldest;
//  - clicking the invite in the sidebar while another category is selected shows All Campaigns with that card
//    scrolled to and highlighted;
//  - a campaign whose cover is a video shows the video's first frame (not a grey box).
// node tests/campaigns/ui/chris-18nov-campaigns.mjs   (dev server: C18_BASE, default http://localhost:5418;
//   C18_CLIP = a small mp4; C18_SHOTS = screenshot dir). Every API call is answered here; nothing leaves this machine.
import { mkdirSync, readFileSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.C18_BASE || 'http://localhost:5418';
const OUT = process.env.C18_SHOTS || '/private/tmp/claude-501/c18-studio/shots';
const CLIP = readFileSync(process.env.C18_CLIP || '/private/tmp/claude-501/c18-studio/clip.mp4');
mkdirSync(OUT, { recursive: true });

const OWNER = { id: 70, external_user_id: 707, name: 'Chris Tester', email: 'owner@c18.test', role: '2', status: 1, is_activated: true };
const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };

const now = Date.now();
const iso = (daysAgo) => new Date(now - daysAgo * 86400000).toISOString();
const author = { id: 70, name: 'Chris Tester', avatar: null, profile_color: '#6C60FF' };
const mem = (id, title, category, daysAgo, extra = {}) => ({
  id, title, category: { id: category.id, name: category.name, color: '#F97316' }, author,
  photos: { count: 1, preview_images: [] }, dates: { formatted_range: 'Nov 1/26' }, location: { formatted: 'Calgary' },
  created_at: iso(daysAgo), updated_at: iso(daysAgo), last_update_img: null, collaborators: [], tags: [], ...extra,
});
const PERSONAL = { id: 1, name: 'Personal' };
const TRAVEL = { id: 5, name: 'Travel' };
const CATALOGUE = { id: 9, name: 'Website Catalogue' };
const INVITES = { id: 0, name: 'Invites' };
const memories = [
  mem(101, 'Beach Day', PERSONAL, 0),
  mem(102, 'Winnie adventures', PERSONAL, 1, { last_update_img: `${BASE}/__c18/winnie.mp4` }),
  mem(104, 'Road Trip', TRAVEL, 2),
  mem(103, 'Remembering Addy', INVITES, 400, { invited_at: iso(400), notification_id: 55 }),
];
const sideMem = (m) => ({ id: m.id, title: m.title, image_link: m.last_update_img, memory_images: [] });
const categories = [
  { ...PERSONAL, memory_count: 2, admin_id: 3, memories: memories.filter((m) => m.category.id === 1).map(sideMem), custom_color: null },
  { ...TRAVEL, memory_count: 1, admin_id: 3, memories: [sideMem(memories[2])], custom_color: null },
  { ...CATALOGUE, memory_count: 0, admin_id: 3, memories: [] },
  { ...INVITES, memory_count: 1, admin_id: null, memories: [sideMem(memories[3])] },
];

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function run(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US' });
  context.setDefaultTimeout(60000);
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('c18-seeded')) return;
    sessionStorage.setItem('c18-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'owner-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
  }, [OWNER]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: 'window.Stripe=function(){return{elements:function(){return{create:function(){return{mount:function(){},on:function(){},destroy:function(){},unmount:function(){}}},getElement:function(){return null}}}}};' });
      return route.abort('blockedbyclient');
    }
    if (url.pathname === '/__c18/winnie.mp4') return route.fulfill({ status: 200, contentType: 'video/mp4', body: CLIP });
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Business' } } } });
    if (p === '/memories' && req.method() === 'GET') {
      return route.fulfill({ json: { status: 'success', data: { all_memories: { data: memories, total: memories.length }, latest_memories: memories, sidebar: { categories: { items: categories }, labels: { items: [] } } } } });
    }
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const shot = async (file) => { const path = `${OUT}/${file}-${width}.png`; await page.screenshot({ path }); console.log('shot', path); };
  const gridCards = () => page.locator('[aria-label$="campaign details"], [aria-label$="campaign invitation"]').filter({ visible: true });

  await page.goto(`${BASE}/memories`);
  await page.getByRole('radio', { name: /^Storeels/ }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(1200);

  console.log(`-- ${width}px`);
  await page.getByRole('radio', { name: /^Storeels/ }).filter({ visible: true }).first().click();
  await page.waitForTimeout(1000);
  const firstLabel = await gridCards().first().getAttribute('aria-label');
  expect(firstLabel === 'Remembering Addy campaign invitation', `the pending invite is the first card (${firstLabel})`);
  expect(await page.getByRole('button', { name: /^Accept/ }).filter({ visible: true }).count() > 0, 'its Accept button shows');
  expect(await page.getByText('Product campaigns').filter({ visible: true }).count() === 0, 'no "Product campaigns" section or text');
  const beach = page.locator('[aria-label="View Beach Day campaign details"]').filter({ visible: true }).first();
  expect(await beach.getByText('Campaigns', { exact: true }).count() > 0, 'the default-category badge reads "Campaigns"');
  expect(await beach.getByText('Personal', { exact: true }).count() === 0, 'no "Personal" badge');

  // The video cover shows its first frame (opacity-100 once a frame is in), not the grey box.
  const winnieVideo = page.locator('[aria-label="View Winnie adventures campaign details"] video').filter({ visible: true }).first();
  await page.waitForFunction(() => {
    const v = document.querySelector('[aria-label="View Winnie adventures campaign details"] video');
    return v && v.className.includes('opacity-100');
  }, null, { timeout: 15000 }).catch(() => {});
  expect(/opacity-100/.test((await winnieVideo.getAttribute('class')) || ''), 'the video cover shows its frame');

  if (width >= 1024) {
    // Sidebar: "Campaigns" heading for the default category, Invites without edit controls.
    const aside = page.locator('aside').filter({ visible: true });
    expect(await aside.getByText('Campaigns', { exact: true }).count() > 0, 'sidebar heading reads "Campaigns"');
    expect(await aside.getByText('Personal', { exact: true }).count() === 0, 'sidebar shows no "Personal"');
    expect(await page.locator('[title="Edit Invites"]').count() === 0, 'no pencil on Invites');
    expect(await page.getByRole('button', { name: 'Colour of Invites' }).count() === 0, 'no colour button on Invites');
    expect(await page.locator('[title="Edit Travel"]').count() > 0, 'Travel keeps its pencil');
    await shot('c18-1-grid');

    // Collapse Travel (its card leaves the grid), then click the invite in the sidebar.
    await aside.getByText('Travel', { exact: true }).first().click();
    await page.waitForTimeout(800);
    await page.locator('[title="Show Remembering Addy"]').first().click();
    await page.waitForTimeout(1000);
    const revealed = page.locator('[data-campaign-card-id="103"]');
    expect(await revealed.filter({ visible: true }).count() === 1, 'clicking the invite shows its card');
    expect(/ring-2/.test((await revealed.getAttribute('class')) || ''), 'the card is highlighted');
    expect(await page.locator('[aria-label="View Beach Day campaign details"]').filter({ visible: true }).count() > 0, 'back on All Campaigns (other cards show)');
    expect(await page.locator('[aria-label="Remembering Addy campaign invitation"]').getByRole('button', { name: /^Accept/ }).count() > 0, 'Accept is on it');
    await shot('c18-2-revealed');
  } else {
    await shot('c18-1-phone');
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(!overflow, 'no horizontal page scroll');
  await context.close();
}

try {
  await run(1280, 900);
  await run(390, 844);
} catch (e) {
  failures.push(String((e && e.stack) || e));
  console.log(e);
}
await browser.close();
console.log('page errors:', pageErrors.length, pageErrors.slice(0, 5));
console.log(failures.length ? `FAILURES ${failures.length}:\n` + failures.join('\n') : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
