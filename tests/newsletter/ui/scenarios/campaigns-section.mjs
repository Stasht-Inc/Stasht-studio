// [wdy2xh2t3w] The Campaigns section: pick up to 6 of your own campaigns, cards in the preview, Studio sends
// campaign_ids only and shows the API's snapshot (including campaigns it drops), the send check, read-only copy.
import { IMG, createMockApi, newsletter, STUDIO } from '../mock-api.mjs';

const card = (id, title) => ({ id, title, description: `About ${title}.`, cover_url: IMG, url: `${STUDIO}/published-memory/campaign-${id}`, date: '2026-10-20' });

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const api = createMockApi({ businessAddress: '4505 Steeles Ave W, Toronto, ON' });
  const { page, context } = await open({ width: 1280, height: 1800, api });
  const preview = page.locator('aside');
  await page.locator('#nl-name').fill('Campaigns check');

  await preview.getByRole('button', { name: 'Add a section at the top' }).click();
  const item = page.getByRole('menuitem', { name: /^Campaigns/ });
  await expectVisible(item, 'Campaigns in Add section');
  expect(/Show your campaigns/.test(await item.textContent()), 'subtitle "Show your campaigns"');
  await item.click();

  const picker = page.getByRole('dialog', { name: 'Choose campaigns' });
  await expectVisible(picker, 'picker opens straight away for a new Campaigns section');
  await expectVisible(picker.getByRole('checkbox', { name: /^Fall service event/ }), 'campaign options listed');
  const draftRow = picker.getByRole('checkbox', { name: /^Customer stories/ });
  expect(await draftRow.isDisabled(), 'an unpublished campaign can’t be picked');
  await expectVisible(picker.getByText('Publish it first to add it'), 'reason shown for an unpublished campaign');
  await expectVisible(picker.getByText('It is private. Make it public to add it'), 'the API’s own reason shown for a private campaign');
  await expectVisible(picker.getByText('Pick up to 6 campaigns.'), 'summary before picking');
  await shot(page, '1280-01-picker');

  // Search goes to the API.
  await picker.getByLabel('Search your campaigns').fill('service');
  await page.waitForTimeout(700);
  expect(api.state.calls.some((c) => c.path === '/newsletters/campaign-options' && /search=service/.test(c.query)), 'search sent to campaign-options');
  expect(await picker.getByRole('checkbox').count() === 2, `search narrows the list (got ${await picker.getByRole('checkbox').count()})`);
  await picker.getByRole('checkbox', { name: /^Fall service event/ }).check();
  await picker.getByLabel('Search your campaigns').fill('');
  await page.waitForTimeout(700);
  expect(await picker.getByRole('checkbox', { name: /^Fall service event/ }).isChecked(), 'a pick survives a new search');
  await picker.getByRole('checkbox', { name: /^2026 Grand Cherokee arrivals/ }).check();
  await picker.getByRole('checkbox', { name: /^Winter tire swap/ }).check();
  await expectVisible(picker.getByText('3 of 6 picked'), 'count of picked campaigns');
  await picker.getByRole('button', { name: 'Done' }).click();

  const section = preview.getByRole('group', { name: 'Campaigns section' }).first();
  const cards = section.getByRole('list', { name: 'Campaigns in this section' }).getByRole('listitem');
  await expectVisible(cards.first(), 'cards in the preview right after Done');
  expect(await cards.count() === 3, `three cards (got ${await cards.count()})`);
  expect(await section.getByText('View campaign').count() === 3, 'a View campaign button on each card');
  await page.waitForTimeout(1500);
  const sent = api.state.campaignBodies.at(-1);
  expect(JSON.stringify(sent) === JSON.stringify({ campaign_ids: [601, 602, 604] }), `Studio sends campaign_ids only, in picking order (got ${JSON.stringify(sent)})`);
  const savedBlock = api.state.newsletters[0]?.blocks?.[0];
  expect(savedBlock?.type === 'campaigns' && savedBlock.data.items.length === 3, 'the API stored its own snapshot');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Campaigns section', 'focus back on the section after Done');
  await shot(page, '1280-02-cards');

  // Change campaigns from the toolbar: the picks come back; 6 is the most; Cancel changes nothing.
  await section.getByRole('button', { name: 'Change campaigns' }).first().click();
  await expectVisible(picker, 'picker opens again');
  expect(await picker.getByRole('checkbox', { name: /^Winter tire swap/ }).isChecked(), 'picked campaigns are ticked');
  for (const name of ['Open house weekend', 'Summer road trip tips', 'Meet the service team']) await picker.getByRole('checkbox', { name: new RegExp(`^${name}`) }).check();
  await expectVisible(picker.getByText(/6 of 6 picked/), 'six picked');
  expect(await picker.getByRole('checkbox', { name: /^Community car wash/ }).isDisabled(), 'a seventh can’t be picked');
  await shot(page, '1280-03-six');
  await picker.getByRole('button', { name: 'Cancel' }).click();
  expect(await cards.count() === 3, 'Cancel keeps the section as it was');

  // A campaign stops being shareable. A save without sections keeps the snapshot (the API only refreshes it when
  // blocks are sent); the next save with sections drops it, and the preview follows the API.
  api.state.campaigns.find((c) => c.id === 602).shareable = false;
  await preview.getByRole('group', { name: 'Header' }).click();
  await preview.getByLabel('Header title').fill('Serpa Chrysler Jeep');
  await page.waitForTimeout(1500);
  expect(await cards.count() === 3, 'a header-only save leaves the cards as they were');

  // An empty Campaigns section is unfinished: send says so. (Adding it saves the sections.)
  await preview.getByRole('button', { name: 'Add a section after section 1' }).click();
  await page.getByRole('menuitem', { name: /^Campaigns/ }).click();
  await expectVisible(picker, 'picker for the second section');
  await picker.getByRole('button', { name: 'Cancel' }).click();
  await expectVisible(preview.getByText('Show your campaigns in this email.'), 'empty section placeholder');
  await page.waitForTimeout(1500);
  expect(await cards.count() === 2, `the dropped campaign leaves the preview (got ${await cards.count()})`);
  expect(!(await section.first().textContent()).includes('Grand Cherokee'), 'Grand Cherokee card gone');
  await page.locator('#nl-subject').fill('October at Serpa');
  await page.getByRole('button', { name: 'Send Now' }).first().click();
  await expectVisible(preview.getByText('Pick at least one campaign, or remove this section.'), 'empty Campaigns section marked');
  await shot(page, '1280-04-problem');
  await context.close();

  // Send answers 409 stale (the draft kept changing in another tab): the message and Reload show, nothing closes.
  const stale = await open({ width: 1280, height: 1400, query: '&newsletterId=53', api: createMockApi({
    sendStale: true, businessAddress: '4505 Steeles Ave W, Toronto, ON',
    newsletters: [newsletter(53, { name: 'Stale one', subject: 'Hello', blocks: [{ id: 'c1', type: 'campaigns', data: { campaign_ids: [601], items: [card(601, 'Fall service event')] } }] })],
  }) });
  await expectVisible(stale.page.locator('aside').getByText('Fall service event'), 'draft opened');
  await stale.page.getByRole('button', { name: 'Send Now' }).first().click();
  await stale.page.getByRole('dialog', { name: 'Send this newsletter now?' }).getByRole('button', { name: 'Send Now' }).click();
  await expectVisible(stale.page.getByRole('button', { name: 'Reload' }), 'Reload offered after a stale send');
  await expectVisible(stale.page.getByText('This newsletter was changed in another tab. Reload to see the latest.').first(), 'stale message');
  expect(await stale.page.locator('#nl-composer-title').isVisible(), 'the composer stays open');
  await stale.context.close();

  // Phones: the picker and the cards fit.
  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 860, query: '&newsletterId=51', api: createMockApi({
      newsletters: [newsletter(51, { name: 'Phone', blocks: [{ id: 'c1', type: 'campaigns', data: { campaign_ids: [601, 604], items: [card(601, 'Fall service event'), card(604, 'Winter tire swap')] } }] })],
    }) });
    await expectVisible(phone.page.getByText('Winter tire swap').first(), `cards on a ${width} phone`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width} (cards)`);
    await phone.page.getByRole('group', { name: 'Campaigns section' }).click();
    await phone.page.getByRole('group', { name: 'Campaigns section' }).getByRole('button', { name: 'Change campaigns' }).last().click();
    await expectVisible(phone.page.getByRole('dialog', { name: 'Choose campaigns' }).getByRole('checkbox').first(), `picker on a ${width} phone`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width} (picker)`);
    if (width === 390) {
      await shot(phone.page, '390-01-picker');
      await phone.page.keyboard.press('Escape');
      await phone.page.getByRole('group', { name: 'Campaigns section' }).scrollIntoViewIfNeeded();
      await shot(phone.page, '390-02-cards');
    }
    await phone.context.close();
  }

  // A sent newsletter shows its frozen cards, read-only.
  const ro = await open({ width: 1280, height: 1400, query: '&newsletterId=52', api: createMockApi({
    newsletters: [newsletter(52, { name: 'Sent one', status: 'sent', sent_at: '2026-10-27T14:00:00Z', blocks: [{ id: 'c1', type: 'campaigns', data: { campaign_ids: [601], items: [card(601, 'Fall service event')] } }] })],
  }) });
  await expectVisible(ro.page.locator('aside').getByText('Fall service event'), 'frozen card on a sent newsletter');
  expect(!(await ro.page.getByRole('button', { name: 'Change campaigns' }).count()), 'no Change campaigns when read-only');
  await ro.context.close();
}
