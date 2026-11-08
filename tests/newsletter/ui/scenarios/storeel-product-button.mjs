// Chris, 8 Nov 2026 (point 3, images/200.jpg): a product moment's "View on website" button is INSIDE the product's
// moment card in the Storeel phone preview, under its details — no second card repeating the title. At 1280 and 390.
// node tests/newsletter/ui/check.mjs storeel-product-button   (NL_BASE = the dev server)
import { createMockApi } from '../mock-api.mjs';

const STOREEL_TITLE = 'Give your campaign a meaningful title';
const step = (page, id) => page.locator(`#${id}`);
const previewMoments = (page) => page.getByTestId('storeel-preview-moments').locator(':scope > li');

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const [width, height] of [[1280, 1000], [390, 844]]) {
    const tag = String(width);
    const api = createMockApi({ catalogue: true });
    const { page, context } = await open({ width, height, api });
    await page.locator('#nl-name').waitFor();
    await page.getByRole('radio', { name: 'Storeel', exact: true }).click();
    await page.getByPlaceholder(STOREEL_TITLE).waitFor();
    await page.waitForTimeout(900);
    await page.getByPlaceholder(STOREEL_TITLE).fill(`Hinges ${tag}`);
    await step(page, 'st-step-campaign').getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Website Catalogue' }).click();
    await page.waitForTimeout(500);
    await page.getByText('Oak bench', { exact: true }).first().click();
    await page.waitForTimeout(600);

    expect((await previewMoments(page).count()) === 1, `${tag}: one product → ONE preview card (got ${await previewMoments(page).count()})`);
    const btn = page.getByTestId('storeel-preview-product-button');
    await expectVisible(btn, `${tag}: View on website button in the preview`);
    const inside = await btn.first().evaluate((el) => {
      const li = el.closest('li');
      const card = el.closest('.rounded-2xl');
      return { sameCard: !!card && card.textContent.includes('Oak bench'), cardsInLi: li ? li.querySelectorAll(':scope > div, :scope .rounded-2xl').length : -1, liText: li?.textContent ?? '' };
    });
    expect(inside.sameCard, `${tag}: the button sits inside the card that has the product's title`);
    const titleCount = (inside.liText.match(/Oak bench/g) || []).length;
    expect(titleCount === 1, `${tag}: the product title shows once (got ${titleCount})`);
    // The button comes after (below) the title, inside the card.
    const titleBox = await page.getByTestId('storeel-preview-moments').getByText('Oak bench', { exact: true }).first().boundingBox();
    const btnBox = await btn.first().boundingBox();
    expect(titleBox && btnBox && btnBox.y > titleBox.y, `${tag}: the button is under the product details`);
    expect(createPosts(api) === 0, `${tag}: nothing saved`);
    expect(!(await hasOverflow(page)), `${tag}: no sideways scroll`);
    await btn.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const vp = page.viewportSize();
    const b2 = await btn.first().boundingBox();
    expect(b2 && vp && b2.y >= 0 && b2.y + b2.height <= vp.height, `${tag}: the button is in the viewport once scrolled to`);
    await shot(page, `${tag}-preview-product-card`);
    await context.close();
  }
}

function createPosts(api) {
  return api.state.calls.filter((c) => c.method === 'POST' && c.path === '/memories').length;
}
