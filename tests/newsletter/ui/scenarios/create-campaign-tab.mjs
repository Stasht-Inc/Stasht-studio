// Chris, 4 Nov 2026: on the Campaigns page with "Storeels" selected (Newsletters 0 | Storeels 1), "+ Create a
// Campaign" opened the NEWSLETTER composer. Create Campaign always opened on its Newsletter tab (initialCampaignType);
// it now follows the view showing: Storeels → the Storeel tab (normal Create Campaign), Newsletters → a new newsletter.
// Checked at 1280 and 390, after switching the views back and forth, and after a reload (the view is remembered).
import { createMockApi, seedNewsletters } from '../mock-api.mjs';

const SHOTS = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
const COMPOSER = '[role="dialog"][aria-labelledby="nl-composer-title"]';

/** Which Create Campaign tab is showing: 'storeel' | 'newsletter' | null (closed). */
async function openTab(page) {
  await page.waitForTimeout(700);
  const composer = await page.locator(COMPOSER).filter({ visible: true }).count();
  const storeel = await page.locator('[role="radiogroup"][aria-label="Campaign type"]').filter({ visible: true })
    .getByRole('radio', { name: 'Storeel', checked: true }).count();
  if (composer && !storeel) return 'newsletter';
  if (storeel && !composer) return 'storeel';
  return composer || storeel ? 'both?' : null;
}

/** The Storeels header's create button ("Create a Campaign"; "Create" on a phone). */
const storeelsCreate = (page) => page.getByRole('button', { name: /^(Create a Campaign|Create)$/ }).filter({ visible: true }).first();
const newslettersCreate = (page) => page.getByRole('button', { name: /^(Create a Newsletter|Create)$/ }).filter({ visible: true }).first();
const pick = (page, view) => page.getByRole('radiogroup', { name: 'Campaigns to show' }).getByRole('radio', { name: new RegExp(`^${view}`) }).click();

async function closeCreate(page) {
  // Storeel tab: its Cancel; Newsletter tab: the composer's Cancel (nothing typed, so it just closes).
  await page.getByRole('button', { name: 'Cancel' }).filter({ visible: true }).first().click();
  await page.waitForTimeout(600);
}

export async function run({ open, expect, expectVisible, hasOverflow }) {
  for (const width of [1280, 390]) {
    const tag = String(width);
    const api = createMockApi({ newsletters: seedNewsletters() });
    const { page, context } = await open({ view: 'campaigns', width, height: width < 768 ? 844 : 900, api, campaignsView: 'storeels' });
    await expectVisible(page.getByRole('heading', { name: 'All Campaigns' }).locator('visible=true'), `${tag}: Storeels view`);
    await page.waitForTimeout(500);
    const checked = await page.getByRole('radiogroup', { name: 'Campaigns to show' }).getByRole('radio', { checked: true }).textContent();
    expect(/Storeels/.test(checked || ''), `${tag}: the switch shows Storeels selected (${checked})`);
    await page.screenshot({ path: `${SHOTS}/${tag}-01-storeels-view.png` });

    // 1. Storeels → "+ Create a Campaign" opens the Storeel tab (normal Create Campaign), not the newsletter composer.
    await storeelsCreate(page).click();
    let tab = await openTab(page);
    expect(tab === 'storeel', `${tag}: Storeels → Create a Campaign opens the Storeel tab (got ${tab})`);
    expect(!(await hasOverflow(page)), `${tag}: Storeel Create Campaign: no sideways scroll`);
    await page.screenshot({ path: `${SHOTS}/${tag}-02-storeels-create-opens-storeel.png` });
    await closeCreate(page);
    expect(await openTab(page) === null, `${tag}: closed`);

    // 2. Newsletters → "Create a Newsletter" opens a new newsletter.
    await pick(page, 'Newsletters');
    await page.waitForTimeout(800);
    await newslettersCreate(page).click();
    tab = await openTab(page);
    expect(tab === 'newsletter', `${tag}: Newsletters → Create opens the newsletter composer (got ${tab})`);
    await page.screenshot({ path: `${SHOTS}/${tag}-03-newsletters-create-opens-newsletter.png` });
    await closeCreate(page);

    // 3. Back to Storeels after that: Storeel again (the newsletter tab isn't remembered across opens).
    await pick(page, 'Storeels');
    await page.waitForTimeout(800);
    await storeelsCreate(page).click();
    tab = await openTab(page);
    expect(tab === 'storeel', `${tag}: Storeels again after Newsletters → Storeel tab (got ${tab})`);
    await closeCreate(page);

    // 4. Back and forth without creating in between, then create: still follows the view showing.
    await pick(page, 'Newsletters');
    await page.waitForTimeout(400);
    await pick(page, 'Storeels');
    await page.waitForTimeout(600);
    await storeelsCreate(page).click();
    tab = await openTab(page);
    expect(tab === 'storeel', `${tag}: Newsletters → Storeels → Create → Storeel tab (got ${tab})`);
    await closeCreate(page);

    // 5. After a reload (Storeels remembered on this device): Storeel tab.
    await page.reload();
    await expectVisible(page.getByRole('heading', { name: 'All Campaigns' }).locator('visible=true'), `${tag}: Storeels view after reload`);
    await page.waitForTimeout(800);
    await storeelsCreate(page).click();
    tab = await openTab(page);
    expect(tab === 'storeel', `${tag}: after reload on Storeels → Storeel tab (got ${tab})`);
    await page.screenshot({ path: `${SHOTS}/${tag}-04-after-reload-storeel.png` });
    await closeCreate(page);

    // 6. After a reload with Newsletters remembered: the Newsletters view, whose create opens a newsletter.
    await pick(page, 'Newsletters');
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForTimeout(1500);
    const afterReload = await page.getByRole('radiogroup', { name: 'Campaigns to show' }).getByRole('radio', { checked: true }).textContent();
    expect(/Newsletters/.test(afterReload || ''), `${tag}: Newsletters remembered after reload (${afterReload})`);
    await newslettersCreate(page).click();
    tab = await openTab(page);
    expect(tab === 'newsletter', `${tag}: after reload on Newsletters → newsletter composer (got ${tab})`);
    await closeCreate(page);
    await context.close();
  }
}
