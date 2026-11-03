// Chris, 3 Nov 2026: the preview showed 4+ empty "Show campaigns, products or vehicles in this email. Choose" sections
// stacked. "+ → Campaign" used to add the empty section before its picker opened, and every picker closed without
// picking (Cancel, ×, Escape) left one behind, saved with the draft. Now the section is added on Done with something
// picked, and opening an older draft keeps only the first of a run of empty Campaigns sections (and saves that).
import { createMockApi, newsletter, seedVehicles } from '../mock-api.mjs';

const EMPTY_TEXT = 'Show campaigns, products or vehicles in this email.';

export async function run({ open, shot, expectVisible, expect }) {
  const api = createMockApi({ businessAddress: '4505 Steeles Ave W, Toronto, ON', vehicles: seedVehicles() });
  const { page, context } = await open({ width: 1280, height: 1500, api });
  const preview = page.locator('aside');
  const sections = preview.getByRole('group', { name: 'Campaigns section' });
  const picker = page.getByRole('dialog', { name: /^Choose/ });
  const savedTypes = () => (api.state.newsletters[0]?.blocks ?? []).map((b) => b.type);
  await page.locator('#nl-name').fill('No stacking');
  await page.waitForTimeout(1200);

  // Every way of closing the picker without Done adds nothing.
  const closeWays = [
    ['Cancel', () => picker.getByRole('button', { name: 'Cancel' }).click()],
    ['×', () => picker.getByRole('button', { name: 'Close' }).click()],
    ['Escape', () => page.keyboard.press('Escape')],
    ['Done with nothing picked', () => picker.getByRole('button', { name: 'Done' }).click()],
  ];
  for (const [how, close] of closeWays) {
    await preview.getByRole('button', { name: 'Add a section at the top' }).click();
    await page.getByRole('menuitem', { name: /^Campaign\b/ }).click();
    await expectVisible(picker, `picker opens (${how})`);
    await expectVisible(picker.getByRole('checkbox').first(), `options listed (${how})`);
    await close();
    await page.waitForTimeout(400);
    expect(!(await picker.count()), `picker closed (${how})`);
  }
  await page.waitForTimeout(1500);
  expect(await sections.count() === 0, `no Campaigns section after four closed pickers (got ${await sections.count()})`);
  expect(!(await preview.getByText(EMPTY_TEXT).count()), 'no empty "Show campaigns…" section');
  expect(!savedTypes().includes('campaigns'), `nothing saved for them (saved: ${JSON.stringify(savedTypes())})`);
  await shot(page, '1280-01-four-cancels-nothing-added');

  // Done with a pick: one section, with its card, where the + was; saved once.
  await preview.getByRole('button', { name: 'Add a section at the top' }).click();
  await page.getByRole('menuitem', { name: /^Campaign\b/ }).click();
  await picker.getByRole('checkbox').first().check();
  await picker.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(1500);
  expect(await sections.count() === 1, `one Campaigns section after Done (got ${await sections.count()})`);
  expect(await sections.first().getByRole('listitem').count() === 1, 'its card shows straight away');
  expect(JSON.stringify(savedTypes()) === JSON.stringify(['campaigns']), `saved as one section (saved: ${JSON.stringify(savedTypes())})`);
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Campaigns section', 'focus on the new section');
  await shot(page, '1280-02-one-section-after-done');
  await context.close();

  // An older draft with a stack of empty Campaigns sections (what Chris saw): only the first of the run stays, the
  // picked one and every other section stay, and the tidy-up is saved.
  const card = { kind: 'campaign', id: 601, title: 'Fall service event', description: 'About it.', cover_url: null, url: 'https://127.0.0.1/studio/published-memory/campaign-601', date: '2026-10-20' };
  const emptyBlock = (id) => ({ id, type: 'campaigns', data: { selections: [], campaign_ids: [], items: [], columns: 2 } });
  const old = await open({ width: 1280, height: 1600, query: '&newsletterId=61', api: createMockApi({
    businessAddress: '4505 Steeles Ave W, Toronto, ON',
    newsletters: [newsletter(61, { name: 'Stacked draft', subject: 'Hi', sms_text: 'November deals are here.', blocks: [
      { id: 'nl-message', type: 'text', data: { html: '<p>November deals are here.</p>' } },
      emptyBlock('e1'), emptyBlock('e2'), emptyBlock('e3'), emptyBlock('e4'),
      { id: 'p1', type: 'campaigns', data: { selections: [{ kind: 'campaign', id: 601 }], campaign_ids: [601], items: [card] } },
      { id: 't1', type: 'title', data: { text: 'See you soon', size: 'medium' } },
    ] })],
  }) });
  const oldPreview = old.page.locator('aside');
  await expectVisible(oldPreview.getByText('Fall service event'), 'the older draft opens');
  await old.page.waitForTimeout(1800);
  expect(await oldPreview.getByText(EMPTY_TEXT).count() === 1, `one empty section left of four (got ${await oldPreview.getByText(EMPTY_TEXT).count()})`);
  expect(await oldPreview.getByRole('group', { name: 'Campaigns section' }).count() === 2, 'the picked section stays');
  const saved = old.api.state.newsletters[0].blocks.map((b) => b.id);
  expect(JSON.stringify(saved) === JSON.stringify(['nl-message', 'e1', 'p1', 't1']), `the tidy-up is saved (saved: ${JSON.stringify(saved)})`);
  await shot(old.page, '1280-03-older-draft-deduped');
  await old.context.close();

  // Phones too: Cancel adds nothing.
  const phone = await open({ width: 390, height: 900, api: createMockApi({ vehicles: seedVehicles() }) });
  await phone.page.locator('#nl-name').fill('Phone');
  const phonePreview = phone.page.locator('body');
  await phonePreview.getByRole('button', { name: 'Add a section at the top' }).first().click();
  await phone.page.getByRole('menuitem', { name: /^Campaign\b/ }).click();
  await expectVisible(phone.page.getByRole('dialog', { name: /^Choose/ }), 'picker on a phone');
  await phone.page.getByRole('dialog', { name: /^Choose/ }).getByRole('button', { name: 'Cancel' }).click();
  await phone.page.waitForTimeout(400);
  expect(!(await phonePreview.getByText(EMPTY_TEXT).count()), 'no empty section on a phone either');
  await phone.page.getByRole('button', { name: 'Add a section at the top' }).first().scrollIntoViewIfNeeded();
  await shot(phone.page, '390-01-cancel-nothing-added');
  await phone.context.close();
}
