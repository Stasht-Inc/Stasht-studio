// [wdy2xh2t3z] The Storeel tab uses the Newsletter tab's full-window frame: the same top bar (Back, Create Campaign,
// Newsletter | Storeel, Cancel / Create Campaign / Publish), no centred modal, the form in one white card with
// Advanced filters kept, and a live phone-style preview that follows the form. Phones keep the compact footer.
import { IMG, createMockApi } from '../mock-api.mjs';

const STOREEL_TITLE = 'Give your campaign a meaningful title';

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const api = createMockApi();
  const { page, context } = await open({ width: 1280, height: 1000, api });
  await page.locator('#nl-name').waitFor();
  const newsletterHeader = await page.locator('[aria-labelledby="nl-composer-title"] > header').boundingBox();
  await page.getByRole('radio', { name: 'Storeel', exact: true }).click();

  const frame = page.getByRole('dialog', { name: 'Create Campaign' });
  await expectVisible(frame, 'Storeel tab is a full-window layer named Create Campaign');
  const box = await frame.boundingBox();
  expect(box && box.x === 0 && box.y === 0 && box.width === 1280 && box.height === 1000, `fills the window (got ${JSON.stringify(box)})`);
  const header = frame.locator('header');
  const headerBox = await header.boundingBox();
  expect(newsletterHeader && headerBox && Math.abs(newsletterHeader.height - headerBox.height) <= 2, `same top bar height as the Newsletter tab (${newsletterHeader?.height} vs ${headerBox?.height})`);
  await expectVisible(header.getByRole('button', { name: 'Back' }), 'Back in the top bar');
  await expectVisible(header.getByRole('radio', { name: 'Storeel', checked: true }), 'switch in the top bar');
  await expectVisible(header.getByRole('button', { name: 'Cancel' }), 'Cancel in the top bar');
  await expectVisible(header.getByRole('button', { name: 'Create Campaign', exact: true }), 'Create Campaign in the top bar');
  await expectVisible(header.getByRole('button', { name: 'Publish' }), 'Publish in the top bar');
  expect(!(await page.getByRole('button', { name: 'Save', exact: true }).isVisible().catch(() => false)), 'no phone footer on wide screens');
  await expectVisible(page.getByText('Create New Campaign'), 'form card');
  await expectVisible(frame.getByText('Preview', { exact: true }), 'preview heading');
  await expectVisible(frame.getByText('Live', { exact: true }), 'Live badge');
  const preview = page.getByTestId('storeel-preview');
  await expectVisible(preview, 'live preview');
  expect((await preview.textContent()).includes('0 moments'), 'Timeline · 0 moments');
  expect((await preview.textContent()).includes('Powered by Stasht'), 'Powered by Stasht');
  expect((await preview.textContent()).includes('Samantha Smith'), 'the author on the moment card');

  // Live: the title and location follow the form.
  await page.waitForTimeout(800); // categories load
  await page.getByPlaceholder(STOREEL_TITLE).fill('Fall service event');
  expect((await preview.textContent()).includes('Fall service event'), 'title shows on the preview cover');

  // Advanced filters are kept, folded.
  const advanced = page.getByRole('button', { name: /Advanced filters/ });
  await expectVisible(advanced, 'Advanced filters toggle');
  expect(!(await page.getByPlaceholder(/^Add tags separated by commas/).isVisible().catch(() => false)), 'Tags folded away at first');
  await advanced.click();
  await expectVisible(page.getByPlaceholder(/^Add tags separated by commas/), 'Tags inside Advanced filters');
  // (The place suggestions box stays open over the form here: Google Maps never loads in these checks.)
  await page.getByPlaceholder(/^Enter location/).fill('Vancouver, BC, Canada');
  await page.waitForTimeout(300);
  expect((await preview.textContent()).includes('Vancouver, BC, Canada'), 'location shows on the moment card');
  expect(!(await hasOverflow(page)), 'no sideways scroll at 1280');
  await shot(page, '1280-01-storeel');

  // Switching back keeps the frame: only the content swaps.
  await header.getByRole('radio', { name: 'Newsletter' }).click();
  await expectVisible(page.locator('#nl-name'), 'Newsletter tab again');
  await page.getByRole('radio', { name: 'Storeel', exact: true }).click();
  expect(await page.getByPlaceholder(STOREEL_TITLE).inputValue() === 'Fall service event', 'the Storeel form kept its title');

  // Create Campaign still creates the Storeel.
  await header.getByRole('button', { name: 'Create Campaign', exact: true }).click();
  await page.waitForTimeout(1500);
  expect(api.state.storeels.some((s) => s.title === 'Fall service event'), `Storeel created with POST /memories (got ${JSON.stringify(api.state.storeels.map((s) => s.title))})`);
  await context.close();

  // A photo passed in (Scan Photo) becomes the preview cover.
  const scan = await open({ width: 1280, height: 1000, query: '&photos=1' });
  await expectVisible(scan.page.getByRole('radio', { name: 'Storeel', checked: true }), 'Scan Photo opens the Storeel tab');
  await scan.page.getByRole('button', { name: /^Add all/ }).click();
  await scan.page.waitForTimeout(2500);
  const cover = scan.page.getByTestId('storeel-preview').locator('img').first();
  const src = (await cover.count()) ? await cover.getAttribute('src') : null;
  expect(src === IMG, `the photo is the preview cover (got ${src})`);
  expect((await scan.page.getByTestId('storeel-preview').textContent()).includes('1 moment'), 'Timeline · 1 moment');
  await shot(scan.page, '1280-02-scan-photo');
  await scan.context.close();

  // The campaign limit notice still shows inline.
  const limited = await open({ width: 1280, height: 1000, api: createMockApi({ storeelLimit: true }) });
  await limited.page.getByRole('radio', { name: 'Storeel', exact: true }).click();
  await expectVisible(limited.page.getByText('Campaign Limit Reached'), 'limit notice inline in the frame');
  await limited.context.close();

  // Phones: compact footer, preview below the form, nothing scrolls sideways.
  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 844 });
    await phone.page.locator('#nl-name').waitFor();
    await phone.page.getByRole('radio', { name: 'Storeel', exact: true }).click();
    await expectVisible(phone.page.getByRole('button', { name: 'Publish' }), `Publish in the phone footer at ${width}`);
    await expectVisible(phone.page.getByRole('button', { name: 'Cancel' }), `Cancel in the phone footer at ${width}`);
    const footer = await phone.page.getByRole('button', { name: 'Publish' }).boundingBox();
    expect(footer && footer.y + footer.height <= 844 && footer.y > 700, `footer pinned to the bottom at ${width} (y ${footer?.y})`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width}`);
    const pv = phone.page.getByTestId('storeel-preview');
    await pv.scrollIntoViewIfNeeded();
    expect(await pv.isVisible(), `preview below the form at ${width}`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width} (preview)`);
    if (width === 390) {
      await phone.page.getByRole('dialog', { name: 'Create Campaign' }).locator('.modal-scrollbar').evaluate((el) => el.scrollTo(0, 0));
      await shot(phone.page, '390-01-storeel-top');
      await pv.scrollIntoViewIfNeeded();
      await shot(phone.page, '390-02-storeel-preview');
    }
    await phone.context.close();
  }
}
