// wdy2xh2p3n Entry points & back button: opening the composer adds a browser history entry, so Back works like
// Cancel (asking first when changes aren't saved); closing any other way takes the entry off; the sent toast's
// "View" opens Campaigns › Newsletters on that newsletter's results; a photo passed in (Scan Photo) opens the
// Storeel tab with it ready to add.
import { createMockApi, seedNewsletters } from '../mock-api.mjs';

const COMPOSER = '[role="dialog"][aria-labelledby="nl-composer-title"]';
const marked = (page) => page.evaluate(() => Boolean(history.state?.stashtNlLayer));

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // 1. Back closes the composer when everything is saved.
  let { page, api, context } = await open({ width: 1280, height: 1000 });
  await page.locator('#nl-name').waitFor();
  await page.waitForTimeout(300);
  expect(await marked(page), 'a history entry is added when the composer opens');
  await page.locator('#nl-name').fill('Back check');
  await page.waitForTimeout(1600);
  await page.evaluate(() => history.back());
  await page.waitForTimeout(800);
  expect(await page.locator(COMPOSER).count() === 0, 'Back closed the composer');
  expect(!(await marked(page)), 'its history entry is gone');
  expect(api.state.newsletters[0]?.name === 'Back check', 'the draft was saved');
  await context.close();

  // 2. Back with changes that can't be saved asks first and keeps the composer (and its entry).
  ({ page, api, context } = await open({ width: 1280, height: 1000, api: createMockApi({ failPuts: 500 }) }));
  await page.locator('#nl-name').fill('Unsaved back');
  await page.waitForTimeout(1600);
  await page.evaluate(() => history.back());
  const unsaved = page.getByRole('dialog', { name: "Your latest changes aren't saved" });
  await expectVisible(unsaved, 'unsaved dialog on Back');
  expect(await page.locator(COMPOSER).isVisible(), 'composer still open');
  expect(await marked(page), 'the entry is back, so the next Back asks again');
  await shot(page, '1280-01-back-unsaved');
  await unsaved.getByRole('button', { name: 'Discard changes' }).click();
  await page.waitForTimeout(500);
  expect(await page.locator(COMPOSER).count() === 0, 'Discard changes closed it');
  expect(!(await marked(page)), 'entry taken off after Discard');
  await context.close();

  // 3. Cancel takes the entry off; the Storeel tab has none of its own.
  ({ page, api, context } = await open({ width: 1280, height: 1000 }));
  await page.locator('#nl-name').waitFor();
  await page.waitForTimeout(300);
  await page.getByRole('radio', { name: 'Storeel' }).click();
  await page.waitForTimeout(400);
  expect(!(await marked(page)), 'no entry while the Storeel tab shows');
  await page.getByRole('radio', { name: 'Newsletter' }).click();
  await page.waitForTimeout(400);
  expect(await marked(page), 'entry again on the Newsletter tab');
  await page.getByRole('button', { name: 'Cancel' }).first().click();
  await page.waitForTimeout(500);
  expect(await page.locator(COMPOSER).count() === 0, 'Cancel closed it');
  expect(!(await marked(page)), 'Cancel took the entry off');
  await context.close();

  // 4. "View" on the sent toast opens Campaigns › Newsletters with that newsletter's results.
  api = createMockApi({ newsletters: seedNewsletters(), businessAddress: '4505 Steeles Ave W, Toronto, ON' });
  ({ page, context } = await open({ view: 'campaigns', width: 1280, height: 1000, api }));
  await page.getByRole('radio', { name: 'Newsletters' }).click();
  const row = page.getByRole('row', { name: /October Newsletter 2026/ });
  await row.getByRole('button', { name: /^October Newsletter 2026/ }).click();
  await page.locator('#nl-name').waitFor();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /^Send now$/i }).last().click();
  const confirm = page.getByRole('dialog', { name: 'Send this newsletter now?' });
  await expectVisible(confirm, 'confirm dialog');
  await page.waitForTimeout(700);
  await confirm.getByRole('button', { name: /^Send now$/i }).click();
  const view = page.getByRole('button', { name: 'View', exact: true });
  await expectVisible(view, 'View on the sent toast');
  await shot(page, '1280-02-sent-toast');
  // Back on Storeels first, to see View switch the page over.
  await page.getByRole('radio', { name: 'Storeels' }).click();
  await view.click();
  await expectVisible(page.getByRole('dialog', { name: 'October Newsletter 2026' }), 'its results open');
  await page.waitForTimeout(400);
  await shot(page, '1280-03-view-results');
  await page.keyboard.press('Escape');
  // The results drawer hides the page from the accessibility tree while open.
  await expectVisible(page.getByRole('radio', { name: 'Newsletters', checked: true }), 'Newsletters view after View');
  await context.close();

  // 5. A photo passed in (Scan Photo) opens the Storeel tab with it ready to add.
  ({ page, api, context } = await open({ width: 1280, height: 1000, query: '&photos=1' }));
  await page.waitForTimeout(1500);
  expect(await page.locator(COMPOSER).count() === 0 || !(await page.locator(COMPOSER).isVisible()), 'Newsletter composer not showing');
  await expectVisible(page.getByRole('radio', { name: 'Storeel', checked: true }), 'Storeel tab chosen');
  await shot(page, '1280-04-scan-photo');
  await context.close();

  // 6. Phones: Back works and nothing scrolls sideways.
  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 844 });
    await phone.page.locator('#nl-name').waitFor();
    await phone.page.waitForTimeout(300);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width}`);
    await phone.page.evaluate(() => history.back());
    await phone.page.waitForTimeout(800);
    expect(await phone.page.locator(COMPOSER).count() === 0, `Back closed it at ${width}`);
    await phone.context.close();
  }
}
