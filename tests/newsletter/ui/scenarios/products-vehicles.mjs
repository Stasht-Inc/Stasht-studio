// Products and vehicles in the Campaigns section (shared brief 2026-10-29): Website Catalogue products and dealer
// vehicles go into the newsletter without publishing; their cards open the item's own page on the business's site.
// The picker has Campaigns | Products | Vehicles tabs (a tab only when the account has some), search, a category
// filter, picks kept across tabs (6 in all), and the preview cards show price, details and the right button.
import { IMG, ROYALWOOD, createMockApi, newsletter, seedCampaigns, seedProducts, seedVehicles } from '../mock-api.mjs';

const ADDRESS = '12 King St W, Toronto, ON';
const TITLE = 'Choose campaigns, products or vehicles';
const productCard = (id, title, price, meta) => ({ kind: 'product', id, title, description: `${title} from the Royalwood shop.`, cover_url: IMG, url: `${ROYALWOOD}/products/rw-${id + 119}`, date: '2026-10-20', price_text: price, meta });

/** The cards' titles in the preview, in order. */
async function cardTitles(scope) {
  const items = scope.getByRole('list', { name: 'Campaigns in this section' }).getByRole('listitem');
  const out = [];
  for (let i = 0; i < await items.count(); i++) out.push(((await items.nth(i).locator('p').first().textContent()) || '').trim());
  return out;
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // ---- 1. Royalwood: products only. The picker opens on Products, with categories, search and an unaddable item.
  {
    const api = createMockApi({ campaigns: [], products: seedProducts(), businessAddress: ADDRESS });
    const { page, context } = await open({ width: 1280, height: 1400, api });
    await page.locator('#nl-name').fill('Royalwood picks');
    await page.locator('aside').getByRole('button', { name: 'Add a section at the top' }).click();
    const item = page.getByRole('menuitem', { name: /^Campaign\b/ });
    expect(/Add campaigns, products or vehicles/.test(await item.textContent()), '+ menu: "Add campaigns, products or vehicles"');
    await item.click();
    const picker = page.getByRole('dialog', { name: TITLE });
    await expectVisible(picker, `picker titled "${TITLE}"`);
    const tabs = picker.getByRole('radiogroup', { name: 'Show' });
    await expectVisible(tabs, 'Campaigns | Products tabs');
    expect(await tabs.getByRole('radio').count() === 2, `two tabs: Campaigns and Products (got ${await tabs.getByRole('radio').count()})`);
    expect(!(await tabs.getByRole('radio', { name: 'Vehicles' }).count()), 'no Vehicles tab without vehicles');
    await expectVisible(picker.locator('#nl-campaign-product-881'), 'products listed');
    expect(await tabs.getByRole('radio', { name: 'Products' }).isChecked(), 'opens on Products (no campaigns)');
    expect(api.state.calls.some((c) => c.path === '/newsletters/campaign-options' && /kind=product/.test(c.query)), 'asked for kind=product');
    await expectVisible(picker.getByText('$29.00').first(), 'price on a product row');
    await expectVisible(picker.getByText('Royalwood · Door Hardware').first(), 'details on a product row');
    expect(await picker.locator('#nl-campaign-product-885').isDisabled(), 'a product with no web page can’t be picked');
    await expectVisible(picker.locator('#nl-campaign-product-885-reason').getByText('This item has no web page'), 'its reason is shown');
    await expectVisible(picker.getByText('Pick up to 6.'), 'summary "Pick up to 6."');
    expect(await picker.getByRole('button', { name: 'Show more' }).count() === 1, '30 products: Show more for the second page');
    await shot(page, '1280-01-picker-products');

    // Category filter.
    await picker.locator('#nl-campaign-category').selectOption('Doors');
    await page.waitForTimeout(700);
    expect(api.state.calls.some((c) => /kind=product/.test(c.query) && /category=Doors/.test(c.query)), 'category sent to campaign-options');
    const rows = picker.getByRole('list', { name: 'Your products' }).getByRole('checkbox');
    expect(await rows.count() === 10, `Doors narrows the list (got ${await rows.count()})`);
    const texts = await picker.getByRole('list', { name: 'Your products' }).textContent();
    expect(!/Door Hardware|Mouldings|Stair Parts/.test(texts), 'only Doors listed');
    await picker.locator('#nl-campaign-category').selectOption('');
    await page.waitForTimeout(700);

    // Search (sku), then the Campaigns tab says there are none (today's words).
    await picker.getByLabel('Search your products').fill('rw-1001');
    await page.waitForTimeout(700);
    expect(await rows.count() === 1, `search by SKU (got ${await rows.count()})`);
    await picker.getByLabel('Search your products').fill('');
    await page.waitForTimeout(700);
    await tabs.getByRole('radio', { name: 'Campaigns' }).click();
    await expectVisible(picker.getByText('You have no campaigns yet. Make a Storeel first, then add it here.'), 'Campaigns tab: today’s empty state');
    expect(!(await picker.locator('#nl-campaign-category').count()), 'no category filter for campaigns');
    await picker.getByRole('button', { name: 'Cancel' }).click();
    await context.close();
  }

  // ---- 2. Products and campaigns: picks across tabs, 6 in all, cards in order, saved, reload keeps the order.
  {
    const api = createMockApi({ products: seedProducts(), businessAddress: ADDRESS });
    const { page, context } = await open({ width: 1280, height: 1800, api });
    const preview = page.locator('aside');
    await page.locator('#nl-name').fill('Mixed picks');
    await preview.getByRole('button', { name: 'Add a section at the top' }).click();
    await page.getByRole('menuitem', { name: /^Campaign\b/ }).click();
    const picker = page.getByRole('dialog', { name: TITLE });
    const tabs = picker.getByRole('radiogroup', { name: 'Show' });
    await expectVisible(picker.locator('#nl-campaign-campaign-601'), 'campaigns listed');
    expect(await tabs.getByRole('radio', { name: 'Campaigns' }).isChecked(), 'opens on Campaigns when there are campaigns');

    await tabs.getByRole('radio', { name: 'Products' }).click();
    await expectVisible(picker.locator('#nl-campaign-product-882'), 'Products tab lists products');
    await picker.locator('#nl-campaign-product-882').check();
    await picker.locator('#nl-campaign-product-881').check();
    await tabs.getByRole('radio', { name: 'Campaigns' }).click();
    await expectVisible(picker.locator('#nl-campaign-campaign-601'), 'back on Campaigns');
    await picker.locator('#nl-campaign-campaign-601').check();
    await expectVisible(picker.getByText('3 of 6 chosen'), '3 of 6 chosen across tabs');
    await tabs.getByRole('radio', { name: 'Products' }).click();
    await expectVisible(picker.locator('#nl-campaign-product-882'), 'Products again');
    expect(await picker.locator('#nl-campaign-product-882').isChecked() && await picker.locator('#nl-campaign-product-881').isChecked(), 'product picks kept after switching tabs');
    for (const id of [883, 884, 886]) await picker.locator(`#nl-campaign-product-${id}`).check();
    await expectVisible(picker.getByText('6 of 6 chosen. That’s the most one section can show.'), 'six chosen');
    expect(await picker.locator('#nl-campaign-product-887').isDisabled(), 'a seventh product can’t be picked');
    await tabs.getByRole('radio', { name: 'Campaigns' }).click();
    await expectVisible(picker.locator('#nl-campaign-campaign-602'), 'Campaigns after six');
    expect(await picker.locator('#nl-campaign-campaign-602').isDisabled(), 'nor a seventh campaign (6 across tabs)');
    expect(!(await picker.locator('#nl-campaign-campaign-601').isDisabled()), 'a picked one can still be unticked');
    await tabs.getByRole('radio', { name: 'Products' }).click();
    await expectVisible(picker.locator('#nl-campaign-product-883'), 'Products to untick');
    for (const id of [883, 884, 886]) await picker.locator(`#nl-campaign-product-${id}`).uncheck();
    await expectVisible(picker.getByText('3 of 6 chosen'), 'back to three');
    await picker.getByRole('button', { name: 'Done' }).click();

    const section = preview.getByRole('group', { name: 'Campaigns section' }).first();
    const cards = section.getByRole('list', { name: 'Campaigns in this section' }).getByRole('listitem');
    await expectVisible(cards.first(), 'cards right after Done');
    const order = ['Solid oak interior door', 'Brass lever handle', 'Fall service event'];
    expect(JSON.stringify(await cardTitles(section)) === JSON.stringify(order), `cards in picking order before the save (got ${JSON.stringify(await cardTitles(section))})`);
    expect(await section.getByText('View product', { exact: true }).count() === 2, 'two View product buttons');
    expect(await section.getByText('View campaign', { exact: true }).count() === 1, 'one View campaign button');
    await expectVisible(section.getByText('$36.50'), 'price on the product card');
    await expectVisible(section.getByText('Royalwood · Doors'), 'details on the product card');
    await page.waitForTimeout(1500);
    const sent = api.state.campaignBodies.at(-1);
    const want = { selections: [{ kind: 'product', id: 882 }, { kind: 'product', id: 881 }, { kind: 'campaign', id: 601 }], campaign_ids: [601] };
    expect(JSON.stringify(sent) === JSON.stringify(want), `Studio sends selections + campaign_ids, no items (got ${JSON.stringify(sent)})`);
    const saved = api.state.newsletters[0];
    expect(saved?.blocks?.[0]?.data?.items?.length === 3, 'the API stored its own snapshot of all three');
    expect(JSON.stringify(await cardTitles(section)) === JSON.stringify(order), 'same order after the save');
    await expectVisible(section.getByRole('button', { name: 'Change campaigns, products or vehicles' }).first(), 'Change button named for all three kinds');
    await shot(page, '1280-02-cards');
    await context.close();

    // Reload: the draft opens with the cards in the same order.
    const again = await open({ width: 1280, height: 1600, api, query: `&newsletterId=${saved.id}` });
    const s2 = again.page.locator('aside').getByRole('group', { name: 'Campaigns section' }).first();
    await expectVisible(s2.getByText('Solid oak interior door'), 'cards after reload');
    expect(JSON.stringify(await cardTitles(s2)) === JSON.stringify(order), `reload keeps the order (got ${JSON.stringify(await cardTitles(s2))})`);
    await again.context.close();
  }

  // ---- 3. A dealer: Campaigns | Vehicles, "View vehicle".
  {
    const api = createMockApi({ campaigns: seedCampaigns(3), vehicles: seedVehicles(), businessAddress: ADDRESS });
    const { page, context } = await open({ width: 1280, height: 1600, api });
    await page.locator('#nl-name').fill('Dealer picks');
    await page.locator('aside').getByRole('button', { name: 'Add a section at the top' }).click();
    await page.getByRole('menuitem', { name: /^Campaign\b/ }).click();
    const picker = page.getByRole('dialog', { name: TITLE });
    const tabs = picker.getByRole('radiogroup', { name: 'Show' });
    await expectVisible(tabs.getByRole('radio', { name: 'Vehicles' }), 'Vehicles tab for a dealer');
    expect(!(await tabs.getByRole('radio', { name: 'Products' }).count()), 'no Products tab without products');
    await tabs.getByRole('radio', { name: 'Vehicles' }).click();
    await expectVisible(picker.locator('#nl-campaign-vehicle-45'), 'vehicles listed');
    await expectVisible(picker.getByText('2021 · 45,000 km · Automatic'), 'vehicle details on the row');
    await expectVisible(picker.getByText('$34,995'), 'vehicle price on the row');
    // cars.category comes lowercase ("preowned"): labelled as the cars cards do, sent back as it came.
    const cats = await picker.locator('#nl-campaign-category option').allTextContents();
    expect(JSON.stringify(cats) === JSON.stringify(['All categories', 'Hybrid', 'Preowned']), `vehicle categories labelled (got ${JSON.stringify(cats)})`);
    await picker.locator('#nl-campaign-category').selectOption({ label: 'Hybrid' });
    await page.waitForTimeout(700);
    expect(api.state.calls.some((c) => /kind=vehicle/.test(c.query) && /category=hybrid/.test(c.query)), 'the raw category goes back to the API');
    expect(await picker.getByRole('list', { name: 'Your vehicles' }).getByRole('checkbox').count() === 1, 'Hybrid narrows the vehicles');
    await picker.locator('#nl-campaign-category').selectOption('');
    await page.waitForTimeout(700);
    await picker.locator('#nl-campaign-vehicle-45').check();
    await picker.getByRole('button', { name: 'Done' }).click();
    const section = page.locator('aside').getByRole('group', { name: 'Campaigns section' }).first();
    await expectVisible(section.getByText('View vehicle', { exact: true }), 'View vehicle on the card');
    await expectVisible(section.getByText('2021 · 45,000 km · Automatic'), 'vehicle details on the card');
    await page.waitForTimeout(1500);
    expect(JSON.stringify(api.state.campaignBodies.at(-1)) === JSON.stringify({ selections: [{ kind: 'vehicle', id: 45 }], campaign_ids: [] }), `vehicle pick sent (got ${JSON.stringify(api.state.campaignBodies.at(-1))})`);
    await shot(page, '1280-03-vehicle-card');
    await context.close();
  }

  // ---- 4. Campaigns only: today's picker (no tabs, today's title).
  {
    const { page, context } = await open({ width: 1280, height: 1200, api: createMockApi() });
    await page.locator('#nl-name').fill('Campaigns only');
    await page.locator('aside').getByRole('button', { name: 'Add a section at the top' }).click();
    await page.getByRole('menuitem', { name: /^Campaign\b/ }).click();
    const picker = page.getByRole('dialog', { name: 'Choose campaigns', exact: true });
    await expectVisible(picker.locator('#nl-campaign-campaign-601'), 'campaigns-only picker');
    expect(!(await picker.getByRole('radiogroup', { name: 'Show' }).count()), 'no tabs with campaigns only');
    await expectVisible(picker.getByText('Pick up to 6 campaigns.'), 'today’s summary');
    await context.close();
  }

  // ---- 5. Phones: the Products picker and the cards fit.
  for (const width of [360, 375, 390]) {
    const blocks = [{ id: 'c1', type: 'campaigns', data: {
      selections: [{ kind: 'product', id: 881 }, { kind: 'product', id: 882 }], campaign_ids: [],
      items: [productCard(881, 'Brass lever handle', '$29.00', 'Royalwood · Door Hardware'), productCard(882, 'Solid oak interior door', '$36.50', 'Royalwood · Doors')],
    } }];
    const phone = await open({ width, height: 860, query: '&newsletterId=61', api: createMockApi({
      campaigns: [], products: seedProducts(), newsletters: [newsletter(61, { name: 'Phone', blocks })],
    }) });
    const group = phone.page.getByRole('group', { name: 'Campaigns section' });
    await expectVisible(phone.page.getByText('Solid oak interior door').first(), `cards on a ${width} phone`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width} (cards)`);
    await group.click();
    await group.getByRole('button', { name: 'Change campaigns, products or vehicles' }).last().click();
    const picker = phone.page.getByRole('dialog', { name: TITLE });
    await expectVisible(picker.locator('#nl-campaign-product-883'), `Products picker on a ${width} phone`);
    await expectVisible(picker.locator('#nl-campaign-category'), `category filter on a ${width} phone`);
    expect(await picker.locator('#nl-campaign-product-881').isChecked(), 'the section’s picks are ticked');
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width} (picker)`);
    const fits = await picker.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const g = el.querySelector('[role="radiogroup"]')?.getBoundingClientRect();
      return r.left >= 0 && r.right <= window.innerWidth && (!g || (g.left >= r.left && g.right <= r.right));
    });
    expect(fits, `picker and its tabs inside the screen at ${width}`);
    if (width === 390) {
      await shot(phone.page, '390-01-picker-products');
      await phone.page.keyboard.press('Escape');
      await group.scrollIntoViewIfNeeded();
      await shot(phone.page, '390-02-cards');
    }
    await phone.context.close();
  }
}
