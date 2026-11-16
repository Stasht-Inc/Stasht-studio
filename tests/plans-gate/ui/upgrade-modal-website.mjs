// Chris, 16 Nov 2026 (point 3): "Studio is wrong. Website is right." The Upgrade Your Plan cards list exactly the
// marketing website's lines (+ Contact Us Widget and Website Catalogue (up to 500 products) on Business), Business is
// $39 ($32.37 a month yearly), Teams is "Popular", and no storage / sync / publishing lines are left.
// node tests/plans-gate/ui/upgrade-modal-website.mjs   (dev server: UM_BASE, default http://127.0.0.1:5434)
// Uses the upgrade-modal harness page; every API call is answered here and every non-local request is aborted.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.UM_BASE || 'http://127.0.0.1:5434';
const OUT = process.env.UM_SHOTS || '/private/tmp/claude-501/upgrade-modal-website-shots';
mkdirSync(OUT, { recursive: true });
const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

const CARDS = {
  starter: {
    name: 'Starter', monthly: 'FREE', yearly: 'FREE',
    description: 'Perfect for small teams getting started with brand storytelling.',
    lines: ['AI Tokens (10 credits/mo)', 'Email Campaigns (500 emails/mo)', '3 Storeels', '1 Admin Role', '5 Collaborators', 'Leads Manager'],
  },
  intermediate: {
    name: 'Teams', monthly: '$19', yearly: '$15.77', popular: true,
    description: 'For growing organizations that need more features.',
    lines: ['AI Tokens (100 credits/mo)', 'Email Campaigns (5,000 emails/mo)', 'Unlimited Storeels', 'Connectors', '2 Admin Roles', 'Unlimited Collaborators', 'Leads Manager'],
  },
  professional: {
    name: 'Business', monthly: '$39', yearly: '$32.37',
    description: 'For large organizations with marketing teams.',
    lines: ['AI Tokens (250 credits/mo)', 'Email Campaigns (10,000 emails/mo)', 'Unlimited Storeels', 'Connectors', '5 Admin Roles', 'Unlimited Collaborators', 'Leads Manager', 'Moderation Tool', 'Add Properties', 'Contact Us Widget', 'Website Catalogue (up to 500 products)'],
  },
};
const GONE = ['GB storage', 'TB storage', 'Sync', 'Publishing', 'Property Accounts', '$29', '24.07', 'Everything in', '3 Admin Roles', 'AI Credits'];

async function open(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(() => {
    localStorage.setItem('stasht_token', 'um-token');
    localStorage.setItem('stasht_user', JSON.stringify({ id: 1, external_user_id: 2, name: 'Samantha Smith', email: 's@example.test', role: '2' }));
  });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort('blockedbyclient');
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 200, json: { success: false } });
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/tests/plans-gate/ui/upgrade-modal.html?plan=Starter`);
  await page.getByRole('dialog', { name: 'Upgrade Your Plan' }).waitFor();
  await page.waitForTimeout(300);
  return { context, page };
}

const squash = (t) => t.replace(/\s+/g, ' ').trim();

for (const [width, height] of [[1280, 900], [390, 844]]) {
  const { context, page } = await open(width, height);
  const dialog = page.getByRole('dialog', { name: 'Upgrade Your Plan' });
  for (const period of ['Monthly', 'Yearly']) {
    const tag = `${width}-${period}`;
    await dialog.getByRole('button', { name: new RegExp(`^${period}`) }).click();
    await page.waitForTimeout(150);
    for (const [id, card] of Object.entries(CARDS)) {
      const el = dialog.locator(`[data-plan-card="${id}"]`);
      const text = squash(await el.innerText());
      expect(text.includes(card.name), `${tag} ${id}: name ${card.name}`);
      expect(text.includes(card.description), `${tag} ${id}: the website description`);
      expect(text.includes(period === 'Monthly' ? card.monthly : card.yearly), `${tag} ${id}: price ${period === 'Monthly' ? card.monthly : card.yearly}`);
      expect(text.includes('Popular') === Boolean(card.popular), `${tag} ${id}: Popular ${card.popular ? 'shown' : 'not shown'}`);
      const lines = (await el.locator('li').allInnerTexts()).map(squash);
      expect(JSON.stringify(lines) === JSON.stringify(card.lines), `${tag} ${id}: exactly the website lines ${lines.length === card.lines.length ? '' : `(got ${JSON.stringify(lines)})`}`);
      for (const g of GONE) expect(!text.includes(g), `${tag} ${id}: no "${g}"`);
      const box = await el.boundingBox();
      expect(Boolean(box) && box.x >= 0 && box.x + box.width <= width + 0.5, `${tag} ${id}: card fits the width`);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${tag}: no horizontal scroll`);
    await page.screenshot({ path: `${OUT}/${width}-${period.toLowerCase()}.png`, fullPage: false });
    await dialog.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/${width}-${period.toLowerCase()}-bottom.png`, fullPage: false });
    await dialog.evaluate((el) => { el.scrollTop = 0; });
  }
  await context.close();
}

await browser.close();
if (pageErrors.length) console.log('page errors:', pageErrors);
console.log(failures.length ? `FAIL ${failures.length}` : 'PASS upgrade-modal-website');
process.exit(failures.length ? 1 : 0);
