// [wdy2xh2t3y] "I have saved as draft... where does it go?" Save Draft closes the composer and lands on
// Campaigns › Newsletters with that draft at the top, highlighted; the toast says where it is; drafts show Edit;
// Storeels | Newsletters is remembered on this device, but a Starter account never calls a newsletter endpoint.
import { createMockApi, seedNewsletters } from '../mock-api.mjs';

const KEY = 'stasht_campaigns_view';
const newsletterCalls = (api) => api.state.calls.filter((c) => /^\/(newsletter|contact-lists)/.test(c.path));
const firstRowId = (page, selector) => page.locator(selector).first().getAttribute('data-newsletter-row');

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const api = createMockApi({ newsletters: seedNewsletters(), businessAddress: '4505 Steeles Ave W, Toronto, ON' });
  const { page, context } = await open({ view: 'campaigns', width: 1280, height: 1000, api });
  await expectVisible(page.getByRole('radio', { name: 'Storeels', checked: true }), 'opens on Storeels the first time');
  await page.getByRole('radio', { name: 'Newsletters' }).click();
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY) === 'newsletters', 'the choice is remembered on this device');

  // A draft's main action is Edit.
  const row = (name) => page.getByRole('row', { name: new RegExp(name) });
  const edit = row('October Newsletter 2026').getByRole('button', { name: 'Edit October Newsletter 2026' });
  await expectVisible(edit, 'Edit on the draft row');
  expect(!(await row('September recap').getByRole('button', { name: /^Edit/ }).count()), 'no Edit on a sent newsletter');
  expect(await firstRowId(page, '[role="row"][data-newsletter-row]') !== '23', 'the draft is not first before saving');
  await shot(page, '1280-01-list-edit');
  await edit.click();
  await expectVisible(page.locator('#nl-name'), 'Edit opens the composer');
  expect(await page.locator('#nl-name').inputValue() === 'October Newsletter 2026', 'on that draft');

  // Save Draft: saves, closes, lands on the list with the draft on top and highlighted.
  await page.locator('#nl-subject').fill('October deals are here!');
  await page.getByRole('button', { name: 'Save Draft' }).first().click();
  await expectVisible(page.getByText('Draft saved. Find it in Campaigns › Newsletters.'), 'toast says where the draft is');
  expect(!(await page.locator('#nl-composer-title').isVisible()), 'the composer closed');
  expect(api.state.newsletters.find((n) => n.id === 23).subject === 'October deals are here!', 'the draft was saved');
  await expectVisible(page.getByRole('radio', { name: 'Newsletters', checked: true }), 'on Campaigns › Newsletters');
  await page.waitForTimeout(500);
  expect(await firstRowId(page, '[role="row"][data-newsletter-row]') === '23', 'the saved draft is at the top');
  expect(/ring-/.test(await page.locator('[role="row"][data-newsletter-row="23"]').getAttribute('class')), 'and highlighted');
  await shot(page, '1280-02-landed');
  await page.waitForTimeout(4500);
  expect(!/ring-/.test(await page.locator('[role="row"][data-newsletter-row="23"]').getAttribute('class')), 'the highlight fades after a moment');

  // Remembered after a reload.
  await page.reload();
  await expectVisible(page.getByRole('radio', { name: 'Newsletters', checked: true }), 'Campaigns opens on Newsletters next time');
  await context.close();

  // A new newsletter from the Newsletters view: Save Draft lands on the list too (phone).
  const phoneApi = createMockApi({ newsletters: seedNewsletters() });
  const phone = await open({ view: 'campaigns', width: 390, height: 844, api: phoneApi });
  await phone.page.evaluate((k) => localStorage.setItem(k, 'newsletters'), KEY);
  await phone.page.reload();
  await expectVisible(phone.page.getByRole('heading', { name: 'Newsletters', exact: true }), 'phone opens on Newsletters');
  await phone.page.getByRole('button', { name: /^Create/ }).first().click();
  await phone.page.locator('#nl-name').fill('Phone draft');
  await phone.page.getByRole('button', { name: 'Save Draft' }).last().click();
  await expectVisible(phone.page.getByText('Draft saved. Find it in Campaigns › Newsletters.'), 'toast on a phone');
  const newId = String(phoneApi.state.newsletters.at(-1).id);
  await phone.page.waitForTimeout(500);
  expect(await firstRowId(phone.page, 'li[data-newsletter-row]') === newId, 'the new draft is at the top on a phone');
  await expectVisible(phone.page.locator(`li[data-newsletter-row="${newId}"]`).getByRole('button', { name: 'Edit Phone draft' }), 'Edit on the phone row');
  expect(!(await hasOverflow(phone.page)), 'no sideways scroll at 390');
  await shot(phone.page, '390-01-landed');
  await phone.context.close();

  for (const width of [360, 375]) {
    const p = await open({ view: 'campaigns', width, height: 800, api: createMockApi({ newsletters: seedNewsletters() }) });
    await p.page.getByRole('radio', { name: 'Newsletters' }).click();
    await expectVisible(p.page.locator('li[data-newsletter-row="23"]').getByRole('button', { name: /^Edit/ }), `Edit at ${width}`);
    expect(!(await hasOverflow(p.page)), `no sideways scroll at ${width}`);
    await p.context.close();
  }

  // Starter: a remembered Newsletters choice shows Storeels, and no newsletter endpoint is called.
  const starterApi = createMockApi({ plan: 'Starter', newsletters: seedNewsletters() });
  const starter = await open({ view: 'campaigns', width: 1280, height: 900, api: starterApi });
  await starter.page.evaluate((k) => localStorage.setItem(k, 'newsletters'), KEY);
  await starter.page.reload();
  await expectVisible(starter.page.getByRole('radio', { name: 'Storeels', checked: true }), 'Starter goes back to Storeels');
  await starter.page.waitForTimeout(1500);
  expect(newsletterCalls(starterApi).length === 0, `no newsletter calls on Starter (got ${newsletterCalls(starterApi).map((c) => c.path).join(', ')})`);
  await starter.context.close();
}
