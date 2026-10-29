// Chris, 29 Oct (round 2), items 4 and 5. The Campaign section picker: what is chosen shows at the top
// ("Chosen (3 of 6)") with ✕ to remove each, across tabs and for picks that aren't on a loaded page; the list loads
// more as it scrolls (no "Show more"), search and category start it again, an older answer never lands in a newer
// list, no row shows twice and it stops at the last page.
import { IMG, ROYALWOOD, createMockApi, newsletter, seedProducts } from '../mock-api.mjs';

const TITLE = 'Choose campaigns, products or vehicles';
const productCard = (id, title) => ({ kind: 'product', id, title, description: `${title} from the Royalwood shop.`, cover_url: IMG, url: `${ROYALWOOD}/products/rw-${id + 119}`, date: '2026-10-20', price_text: '$99.00', meta: 'Royalwood · Doors' });

const optionCalls = (api) => api.state.calls.filter((c) => c.path === '/newsletters/campaign-options');
const pageOf = (c) => Number(new URLSearchParams(c.query).get('page') || 1);

async function chipTitles(picker) {
  const chips = picker.getByRole('list', { name: /^Chosen \(/ }).getByRole('listitem');
  const out = [];
  for (let i = 0; i < await chips.count(); i++) out.push(((await chips.nth(i).textContent()) || '').trim());
  return out;
}

const scrollToEnd = (picker) => picker.locator('.overflow-y-auto').first().evaluate((el) => { el.scrollTop = el.scrollHeight; });

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // ---- 1. Chosen strip across tabs; ✕ removes a pick that sits on another tab.
  {
    const api = createMockApi({ products: seedProducts() });
    const { page, context } = await open({ width: 1280, height: 1100, api });
    await page.locator('#nl-name').fill('Chosen strip');
    await page.locator('aside').getByRole('button', { name: 'Add a section at the top' }).click();
    await page.getByRole('menuitem', { name: /^Campaign\b/ }).click();
    const picker = page.getByRole('dialog', { name: TITLE });
    const tabs = picker.getByRole('radiogroup', { name: 'Show' });
    await expectVisible(picker.locator('#nl-campaign-campaign-601'), 'campaigns listed');
    expect(!(await picker.getByRole('heading', { name: /^Chosen \(/ }).count()), 'no Chosen strip while nothing is chosen');
    await tabs.getByRole('radio', { name: 'Products' }).click();
    await expectVisible(picker.locator('#nl-campaign-product-882'), 'products listed');
    await picker.locator('#nl-campaign-product-882').check();
    await picker.locator('#nl-campaign-product-881').check();
    await tabs.getByRole('radio', { name: 'Campaigns' }).click();
    await expectVisible(picker.locator('#nl-campaign-campaign-601'), 'back on Campaigns');
    await picker.locator('#nl-campaign-campaign-601').check();
    await expectVisible(picker.getByRole('heading', { name: 'Chosen (3 of 6)' }), 'heading "Chosen (3 of 6)"');
    const titles = await chipTitles(picker);
    expect(JSON.stringify(titles) === JSON.stringify(['Solid oak interior door', 'Brass lever handle', 'Fall service event']), `chips in picking order across tabs (got ${JSON.stringify(titles)})`);
    const top = await picker.evaluate((el) => {
      const strip = el.querySelector('#nl-chosen-heading')?.getBoundingClientRect();
      const tabsBox = el.querySelector('[role="radiogroup"]')?.getBoundingClientRect();
      return Boolean(strip && tabsBox && strip.top < tabsBox.top);
    });
    expect(top, 'the strip sits at the top, above the tabs');
    await shot(page, '1280-01-chosen-strip');

    // ✕ on a product while the Campaigns tab shows.
    await picker.getByRole('button', { name: 'Remove Brass lever handle' }).click();
    await expectVisible(picker.getByRole('heading', { name: 'Chosen (2 of 6)' }), 'two left after ✕');
    await expectVisible(picker.getByText('2 of 6 chosen', { exact: true }), 'footer agrees');
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    expect(focused === 'Remove Fall service event', `focus moves to the next ✕ (got ${focused})`);
    await picker.getByRole('button', { name: 'Remove Fall service event' }).click();
    expect(!(await picker.locator('#nl-campaign-campaign-601').isChecked()), '✕ unticks a row on this tab');
    await tabs.getByRole('radio', { name: 'Products' }).click();
    await expectVisible(picker.locator('#nl-campaign-product-881'), 'products again');
    expect(!(await picker.locator('#nl-campaign-product-881').isChecked()), 'the product removed from the strip is unticked');
    expect(await picker.locator('#nl-campaign-product-882').isChecked(), 'the other pick stays');
    await picker.getByRole('button', { name: 'Remove Solid oak interior door' }).click();
    expect(!(await picker.getByRole('heading', { name: /^Chosen \(/ }).count()), 'strip gone when nothing is left');
    const afterLast = await page.evaluate(() => document.activeElement?.id);
    expect(afterLast === 'nl-campaign-search', `focus goes to search after the last ✕ (got ${afterLast})`);
    await picker.getByRole('button', { name: 'Cancel' }).click();
    await context.close();
  }

  // ---- 2. A pick on page 2 (not loaded): in the strip from the section's own card, and ✕ removes it.
  {
    const blocks = [{ id: 'c1', type: 'campaigns', data: {
      selections: [{ kind: 'product', id: 881 }, { kind: 'product', id: 910 }], campaign_ids: [],
      items: [productCard(881, 'Brass lever handle'), productCard(910, 'Shaker pine closet door 30')],
    } }];
    const api = createMockApi({ campaigns: [], products: seedProducts(), newsletters: [newsletter(71, { name: 'Page two pick', blocks })] });
    const { page, context } = await open({ width: 1280, height: 1100, api, query: '&newsletterId=71' });
    const group = page.locator('aside').getByRole('group', { name: 'Campaigns section' }).first();
    await expectVisible(group.getByText('Shaker pine closet door 30'), 'the section shows both cards');
    await group.click();
    await group.getByRole('button', { name: /^(Change campaigns, products or vehicles|Edit)\b/ }).last().click();
    const picker = page.getByRole('dialog', { name: TITLE });
    await expectVisible(picker.locator('#nl-campaign-product-881'), 'page 1 listed');
    expect(!(await picker.locator('#nl-campaign-product-910').count()), 'product 910 is on page 2 (not loaded yet)');
    await expectVisible(picker.getByRole('heading', { name: 'Chosen (2 of 6)' }), 'both picks in the strip');
    const titles = await chipTitles(picker);
    expect(JSON.stringify(titles) === JSON.stringify(['Brass lever handle', 'Shaker pine closet door 30']), `the page-2 pick is named from its card (got ${JSON.stringify(titles)})`);
    await picker.getByRole('button', { name: 'Remove Shaker pine closet door 30' }).click();
    await expectVisible(picker.getByRole('heading', { name: 'Chosen (1 of 6)' }), 'one left');
    await picker.getByRole('button', { name: 'Done' }).click();
    await page.waitForTimeout(1500);
    const sent = api.state.campaignBodies.at(-1);
    expect(JSON.stringify(sent) === JSON.stringify({ selections: [{ kind: 'product', id: 881 }], campaign_ids: [] }), `the removed page-2 pick is gone from the save (got ${JSON.stringify(sent)})`);
    await context.close();
  }

  // ---- 3. Infinite scroll: page 2 loads on scroll, "Loading more…" while it comes, no repeats, stops at the end;
  //         search and category start again from page 1; an older answer never lands in a newer list.
  {
    const api = createMockApi({ campaigns: [], products: seedProducts(45) });
    const { page, context } = await open({ width: 1280, height: 1000, api });
    await page.locator('#nl-name').fill('Scroll');
    await page.locator('aside').getByRole('button', { name: 'Add a section at the top' }).click();
    await page.getByRole('menuitem', { name: /^Campaign\b/ }).click();
    const picker = page.getByRole('dialog', { name: TITLE });
    const rows = picker.getByRole('list', { name: 'Your products' }).getByRole('checkbox');
    await expectVisible(picker.locator('#nl-campaign-product-881'), 'products listed');
    expect(await rows.count() === 20, `first page: 20 (got ${await rows.count()})`);
    expect(!(await picker.getByRole('button', { name: /Show more|Load more/ }).count()), 'no Show more / Load more button');
    expect(!optionCalls(api).some((c) => pageOf(c) === 2), 'page 2 waits until the list is scrolled');

    api.state.optionsDelayMs = 1500;
    await scrollToEnd(picker);
    await expectVisible(picker.getByRole('status').getByText('Loading more…'), '"Loading more…" row while page 2 comes');
    await scrollToEnd(picker);
    await shot(page, '1280-02-loading-more');
    await page.waitForFunction(() => document.querySelectorAll('[role="dialog"] ul[aria-label="Your products"] input[type="checkbox"]').length === 40, null, { timeout: 8000 }).catch(() => {});
    expect(await rows.count() === 40, `page 2 added on scroll (got ${await rows.count()})`);
    api.state.optionsDelayMs = 0;
    await scrollToEnd(picker);
    await page.waitForFunction(() => document.querySelectorAll('[role="dialog"] ul[aria-label="Your products"] input[type="checkbox"]').length === 45, null, { timeout: 8000 }).catch(() => {});
    expect(await rows.count() === 45, `page 3 (the last) added (got ${await rows.count()})`);
    await scrollToEnd(picker);
    await page.waitForTimeout(800);
    expect(!optionCalls(api).some((c) => pageOf(c) === 4), 'stops at total_pages');
    for (const p of [2, 3]) expect(optionCalls(api).filter((c) => pageOf(c) === p).length === 1, `page ${p} asked for once (got ${optionCalls(api).filter((c) => pageOf(c) === p).length})`);
    const ids = await rows.evaluateAll((els) => els.map((e) => e.id));
    expect(new Set(ids).size === ids.length, 'no row shows twice');
    expect(!(await picker.getByText('Loading more…').count()), 'no loading row at the end');

    // Search starts again from page 1, then scrolling still works within the search.
    const before = optionCalls(api).length;
    await picker.getByLabel('Search your products').fill('rw-10');
    await page.waitForTimeout(800);
    const searched = optionCalls(api).slice(before).filter((c) => /search=rw-10/.test(c.query));
    expect(searched.length >= 1 && pageOf(searched[0]) === 1, `search asks for page 1 (got ${searched.map((c) => c.query).join(' ')})`);
    expect(await rows.count() === 20, `search: first 20 matches (got ${await rows.count()})`);
    await scrollToEnd(picker);
    await page.waitForFunction(() => document.querySelectorAll('[role="dialog"] ul[aria-label="Your products"] input[type="checkbox"]').length > 20, null, { timeout: 8000 }).catch(() => {});
    expect(await rows.count() > 20, 'scrolling loads more matches');
    expect(optionCalls(api).some((c) => pageOf(c) === 2 && /search=rw-10/.test(c.query)), 'page 2 of the search keeps the search');
    await picker.getByLabel('Search your products').fill('');
    await page.waitForTimeout(800);

    // Latest answer wins: page 2 is on its way when the category changes; it must not land in the Doors list.
    api.state.optionsDelayMs = 1200;
    await scrollToEnd(picker);
    await expectVisible(picker.getByText('Loading more…'), 'page 2 on its way');
    await picker.locator('#nl-campaign-category').selectOption('Doors');
    await page.waitForTimeout(3200);
    api.state.optionsDelayMs = 0;
    const catCall = optionCalls(api).filter((c) => /category=Doors/.test(c.query));
    expect(catCall.length >= 1 && pageOf(catCall[0]) === 1, 'a category asks for page 1');
    const doors = await picker.getByRole('list', { name: 'Your products' }).textContent();
    expect(!/Door Hardware|Mouldings|Stair Parts/.test(doors || ''), 'the older page-2 answer did not land in the Doors list');
    expect(await rows.count() === 15, `Doors: 15 products (got ${await rows.count()})`);
    await context.close();
  }

  // ---- 4. Phones: six chips wrap inside the dialog; the loading row fits.
  for (const width of [360, 375, 390]) {
    const picks = [881, 882, 883, 884, 886, 887];
    const blocks = [{ id: 'c1', type: 'campaigns', data: {
      selections: picks.map((id) => ({ kind: 'product', id })), campaign_ids: [],
      items: picks.map((id, i) => productCard(id, ['Brass lever handle', 'Solid oak interior door', 'Colonial baseboard 8 ft', 'Maple stair tread', 'Shaker pine closet door', 'Brass lever handle 7'][i])),
    } }];
    const api = createMockApi({ campaigns: [], products: seedProducts(), newsletters: [newsletter(72, { name: 'Phone', blocks })] });
    const phone = await open({ width, height: 844, api, query: '&newsletterId=72' });
    const group = phone.page.getByRole('group', { name: 'Campaigns section' });
    await expectVisible(phone.page.getByText('Solid oak interior door').first(), `cards on a ${width} phone`);
    await group.click();
    await group.getByRole('button', { name: /^(Change campaigns, products or vehicles|Edit)\b/ }).last().click();
    const picker = phone.page.getByRole('dialog', { name: TITLE });
    await expectVisible(picker.getByRole('heading', { name: 'Chosen (6 of 6)' }), `six chosen at ${width}`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width} (chosen strip)`);
    const inside = await picker.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return [...el.querySelectorAll('ul[aria-labelledby="nl-chosen-heading"] li')].every((li) => {
        const b = li.getBoundingClientRect();
        return b.left >= r.left && b.right <= r.right;
      });
    });
    expect(inside, `chips inside the dialog at ${width}`);
    if (width === 390) {
      await shot(phone.page, '390-01-chosen-strip');
      api.state.optionsDelayMs = 1500;
      await scrollToEnd(picker);
      await expectVisible(picker.getByText('Loading more…'), 'loading row on a phone');
      expect(!(await hasOverflow(phone.page)), 'no sideways scroll at 390 (loading row)');
      await scrollToEnd(picker);
      await shot(phone.page, '390-02-loading-more');
    }
    await phone.context.close();
  }
}
