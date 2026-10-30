// Chris's newsletter feedback, 29 Oct (round 2), the editor part:
// 1. The "+" between sections is always shown (not only on hover).
// 2. A Campaign section shows its cards in 1 or 2 columns (2 for a new section; an older one stays 1 until changed);
//    the phone view (and a phone screen) shows 1, as the email; the section's "Change" button is now "Edit", with the
//    column choice next to it.
// 3. Each card can be edited for this newsletter only (image, title, description, button text; the link can't be
//    changed); the original values show as placeholders; "Reset to original" per card.
import { IMG, STUDIO, createMockApi, newsletter } from '../mock-api.mjs';

const EDIT = 'Edit campaigns, products or vehicles';
const card = (id, title) => ({ kind: 'campaign', id, title, description: `About ${title}.`, cover_url: IMG, url: `${STUDIO}/published-memory/campaign-${id}`, date: '2026-10-20', price_text: null, meta: null });
const puts = (api) => api.state.calls.filter((c) => c.method === 'PUT');

/** The cards' boxes in the preview (left, top, width), rounded. */
async function cardBoxes(section) {
  return section.getByRole('list', { name: 'Campaigns in this section' }).evaluate((ul) => [...ul.querySelectorAll(':scope > li[data-card-key]')].map((li) => {
    const r = li.getBoundingClientRect();
    return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width) };
  }));
}
/** How many cards sit on the first row. */
const perRow = (boxes) => boxes.filter((b) => b.top === boxes[0]?.top).length;

const SECTIONS = [
  { id: 'b1', type: 'title', data: { text: 'October at Serpa Chrysler', size: 'large' } },
  { id: 'b2', type: 'text', data: { html: '<p>Winter tires are in.</p>' } },
  { id: 'b3', type: 'image', data: { url: IMG, alt: 'Showroom', link: null } },
];

/** Every "+" in the preview, with how visible it really is (its own opacity times its ancestors'). */
async function plusVisibility(page) {
  return page.locator('aside').evaluate((aside) => [...aside.querySelectorAll('button[aria-label^="Add a section"]')].map((b) => {
    let o = 1;
    for (let el = b; el && el !== aside; el = el.parentElement) o *= Number(getComputedStyle(el).opacity);
    const line = b.closest('[data-nl-add]')?.firstElementChild;
    return { label: b.getAttribute('aria-label'), opacity: o, line: line ? Number(getComputedStyle(line).opacity) : 0 };
  }));
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // ---- 1. The "+" lines show without hovering, on a wide screen and on a phone.
  for (const width of [1280, 390]) {
    const api = createMockApi({ newsletters: [newsletter(71, { name: 'Plus check', blocks: SECTIONS })] });
    const { page, context } = await open({ width, height: width === 1280 ? 1400 : 900, query: '&newsletterId=71', api });
    const preview = page.locator('aside');
    await expectVisible(preview.getByText('October at Serpa Chrysler'), `draft open at ${width}`);
    await page.mouse.move(2, 2);
    await page.waitForTimeout(400);
    const plus = await plusVisibility(page);
    expect(plus.length === 4, `a + at the top and after each of 3 sections at ${width} (got ${plus.length})`);
    for (const p of plus) expect(p.opacity === 1 && p.line === 1, `"${p.label}" shown without hovering at ${width} (opacity ${p.opacity}, line ${p.line})`);
    expect(!(await hasOverflow(page)), `no sideways scroll at ${width} (+ lines)`);
    await preview.getByText('Winter tires are in.').scrollIntoViewIfNeeded();
    await shot(page, `${width}-01-plus-always`);
    await context.close();
  }

  // ---- 2a. A new Campaign section: 2 columns, Edit + the column choice, 1 column, the phone view, no save loop.
  {
    const api = createMockApi({ businessAddress: '4505 Steeles Ave W, Toronto, ON' });
    const { page, context } = await open({ width: 1280, height: 1600, api });
    const preview = page.locator('aside');
    await page.locator('#nl-name').fill('Columns check');
    await preview.getByRole('button', { name: 'Add a section at the top' }).click();
    await page.getByRole('menuitem', { name: /^Campaign\b/ }).click();
    const picker = page.getByRole('dialog', { name: 'Choose campaigns' });
    for (const name of ['Fall service event', '2026 Grand Cherokee arrivals', 'Winter tire swap']) await picker.getByRole('checkbox', { name: new RegExp(`^${name}`) }).check();
    await picker.getByRole('button', { name: 'Done' }).click();
    const section = preview.getByRole('group', { name: 'Campaigns section' }).first();
    await expectVisible(section.getByRole('listitem').nth(2), 'three cards');
    await page.waitForTimeout(1500);
    expect(api.state.campaignBodies.at(-1)?.columns === 2, `a new section saves columns: 2 (got ${JSON.stringify(api.state.campaignBodies.at(-1))})`);
    let boxes = await cardBoxes(section);
    expect(perRow(boxes) === 2, `two cards a row (got ${JSON.stringify(boxes)})`);
    expect(boxes[2].left === boxes[0].left && boxes[2].top > boxes[0].top, 'the odd third card starts the next row, on the left');
    expect(Math.abs(boxes[0].width - boxes[1].width) <= 1, 'both columns the same width');
    const imgFits = await section.locator('img').first().evaluate((img) => img.getBoundingClientRect().width <= img.closest('li').getBoundingClientRect().width + 0.5);
    expect(imgFits, 'the cover is no wider than its card');

    const columns = section.getByRole('radiogroup', { name: 'Columns' });
    await expectVisible(section.getByRole('button', { name: EDIT }).filter({ hasText: 'Edit' }), '"Edit" button under the cards');
    expect(!(await section.getByText('Change', { exact: true }).count()), 'no "Change" button any more');
    await expectVisible(columns, 'the column choice next to Edit');
    expect(await columns.getByRole('radio', { name: '2 columns' }).getAttribute('aria-checked') === 'true', '2 columns chosen for a new section');
    const sideBySide = await section.evaluate((el) => {
      const edit = [...el.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit').getBoundingClientRect();
      const group = el.querySelector('[role="radiogroup"][aria-label="Columns"]').getBoundingClientRect();
      return Math.abs((edit.top + edit.bottom) / 2 - (group.top + group.bottom) / 2) < 6 && group.left > edit.right;
    });
    expect(sideBySide, 'the column choice sits right of Edit, on the same line');
    await expectVisible(section.getByText('On phones the cards show one under another.'), 'phone note for 2 columns');
    await section.scrollIntoViewIfNeeded();
    await shot(page, '1280-02-two-columns');

    const before = puts(api).length;
    await columns.getByRole('radio', { name: '1 column' }).click();
    boxes = await cardBoxes(section);
    expect(perRow(boxes) === 1 && boxes.every((b) => b.left === boxes[0].left), `1 column: one card under another (got ${JSON.stringify(boxes)})`);
    await page.waitForTimeout(1500);
    expect(api.state.campaignBodies.at(-1)?.columns === 1, `1 column saved (got ${JSON.stringify(api.state.campaignBodies.at(-1))})`);
    expect(puts(api).length === before + 1, `one save for the change (got ${puts(api).length - before})`);
    await section.scrollIntoViewIfNeeded();
    await shot(page, '1280-03-one-column');

    // Edit opens the picker with the picks ticked; Cancel changes nothing.
    await section.getByRole('button', { name: EDIT }).filter({ hasText: 'Edit' }).click();
    await expectVisible(picker, 'Edit opens the picker');
    expect(await picker.getByRole('checkbox', { name: /^Winter tire swap/ }).isChecked(), 'the picks are ticked');
    await picker.getByRole('button', { name: 'Cancel' }).click();
    await section.click();
    await columns.getByRole('radio', { name: '2 columns' }).click();
    await page.waitForTimeout(1500);
    expect(api.state.campaignBodies.at(-1)?.columns === 2, 'back to 2 columns, saved');

    // The phone view: one column, as the email on a phone.
    await page.getByRole('radio', { name: 'Phone view' }).click();
    boxes = await cardBoxes(section);
    expect(perRow(boxes) === 1, `phone view: one card a row (got ${JSON.stringify(boxes)})`);
    expect(await columns.getByRole('radio', { name: '2 columns' }).getAttribute('aria-checked') === 'true', 'the section still says 2 columns');
    await section.scrollIntoViewIfNeeded();
    await shot(page, '1280-04-phone-view');
    await page.getByRole('radio', { name: 'Desktop view' }).click();

    // Idle: nothing more to save (the server's answer is not a change).
    const settled = puts(api).length;
    await page.waitForTimeout(2500);
    expect(puts(api).length === settled, `no save loop (${puts(api).length - settled} extra saves)`);
    await context.close();
  }

  // ---- 2b. An older section (no columns) opens as 1 column, saves nothing on its own; phones show 1 column.
  {
    const blocks = [
      { id: 'c1', type: 'campaigns', data: { campaign_ids: [601, 604, 602], items: [card(601, 'Fall service event'), card(604, 'Winter tire swap'), card(602, '2026 Grand Cherokee arrivals')] } },
      { id: 'c2', type: 'campaigns', data: { selections: [{ kind: 'campaign', id: 601 }, { kind: 'campaign', id: 604 }], campaign_ids: [601, 604], columns: 2, items: [card(601, 'Fall service event'), card(604, 'Winter tire swap')] } },
    ];
    for (const width of [1280, 360, 375, 390]) {
      const api = createMockApi({ newsletters: [newsletter(72, { name: 'Older section', blocks })] });
      const { page, context } = await open({ width, height: width === 1280 ? 1800 : 900, query: '&newsletterId=72', api });
      const preview = page.locator('aside');
      const older = preview.getByRole('group', { name: 'Campaigns section' }).first();
      const newer = preview.getByRole('group', { name: 'Campaigns section' }).nth(1);
      await expectVisible(older.getByText('Winter tire swap'), `older section open at ${width}`);
      expect(perRow(await cardBoxes(older)) === 1, `older section: 1 column at ${width}`);
      expect(perRow(await cardBoxes(newer)) === (width === 1280 ? 2 : 1), `2-column section: ${width === 1280 ? 2 : 1} a row at ${width}`);
      expect(!(await hasOverflow(page)), `no sideways scroll at ${width}`);
      if (width === 1280) {
        await older.click();
        expect(await older.getByRole('radiogroup', { name: 'Columns' }).getByRole('radio', { name: '1 column' }).getAttribute('aria-checked') === 'true', 'older section says 1 column');
        await page.waitForTimeout(2500);
        expect(!puts(api).length, `opening an older section saves nothing (${puts(api).length} saves)`);
      }
      if (width === 390) {
        await newer.click();
        await expectVisible(newer.getByRole('radiogroup', { name: 'Columns' }), 'column choice on a phone');
        const oneLine = await newer.evaluate((el) => {
          const edit = [...el.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit').getBoundingClientRect();
          const group = el.querySelector('[role="radiogroup"][aria-label="Columns"]').getBoundingClientRect();
          return Math.abs((edit.top + edit.bottom) / 2 - (group.top + group.bottom) / 2) < 6 && group.left > edit.right;
        });
        expect(oneLine, 'Edit and the column choice on one line at 390');
        expect(!(await hasOverflow(page)), 'no sideways scroll at 390 with the section open');
        await newer.getByRole('radiogroup', { name: 'Columns' }).scrollIntoViewIfNeeded();
        await shot(page, '390-02-columns-phone');
      }
      await context.close();
    }
  }

  // ---- 3. Edit each card on its own.
  {
    const noCover = { ...card(604, 'Winter tire swap'), cover_url: null };
    const blocks = [{ id: 'c1', type: 'campaigns', data: { selections: [{ kind: 'campaign', id: 601 }, { kind: 'campaign', id: 604 }], campaign_ids: [601, 604], columns: 2, items: [card(601, 'Fall service event'), noCover] } }];
    const api = createMockApi({ newsletters: [newsletter(73, { name: 'Card edits', blocks })] });
    const { page, context } = await open({ width: 1280, height: 1800, query: '&newsletterId=73', api });
    const preview = page.locator('aside');
    const section = preview.getByRole('group', { name: 'Campaigns section' }).first();
    const fall = section.locator('li[data-card-key="campaign:601"]');
    const winter = section.locator('li[data-card-key="campaign:604"]');
    const lastOverrides = () => api.state.campaignBodies.at(-1)?.overrides;
    await expectVisible(fall.getByText('Fall service event'), 'cards open');
    expect(!(await section.getByRole('button', { name: /^Edit card/ }).count()), 'no Edit card until the section is selected');
    await section.click();
    expect(await section.getByRole('button', { name: /^Edit card/ }).count() === 2, 'an Edit card button on each card');
    await section.getByRole('button', { name: 'Edit card: Fall service event' }).click();
    const panel = section.getByRole('group', { name: 'Edit card: Fall service event' });
    await expectVisible(panel, 'the card’s editor opens');
    const title = panel.getByLabel('Title', { exact: true });
    const description = panel.getByLabel('Description', { exact: true });
    const button = panel.getByLabel('Button text', { exact: true });
    expect(await title.evaluate((el) => el === document.activeElement), 'the cursor is in the title');
    expect(await title.getAttribute('placeholder') === 'Fall service event', 'title placeholder: the original title');
    expect(await description.getAttribute('placeholder') === 'About Fall service event.', 'description placeholder: the original description');
    expect(await button.getAttribute('placeholder') === 'View campaign', 'button placeholder: the original button text');
    expect(await title.getAttribute('maxlength') === '120' && await description.getAttribute('maxlength') === '300' && await button.getAttribute('maxlength') === '30', 'limits 120 / 300 / 30');
    expect(!(await panel.getByLabel(/link/i).count()) && !(await panel.locator('input[inputmode="url"]').count()), 'no link field: the card opens the item’s own page');
    await expectVisible(panel.getByText('The card still opens the campaign’s page.', { exact: false }), 'says the link stays');
    expect(await panel.getByRole('button', { name: 'Reset to original' }).isDisabled(), 'Reset is off until something is edited');
    // The boxes start with what the card shows (Deepak, 30 Oct), so a few letters can be changed.
    expect(await title.inputValue() === 'Fall service event', `title box prefilled (got "${await title.inputValue()}")`);
    expect(await description.inputValue() === 'About Fall service event.', 'description box prefilled');
    expect(await button.inputValue() === 'View campaign', 'button box prefilled');
    await title.press('End');
    await title.press('Backspace');
    await page.waitForTimeout(1500);
    expect(lastOverrides()?.['campaign:601']?.title === 'Fall service even', `one letter changed is saved (got ${JSON.stringify(lastOverrides())})`);
    await title.press('End');
    await page.keyboard.type('t');
    await page.waitForTimeout(1500);
    expect(!lastOverrides()?.['campaign:601']?.title, `typed back to the original: no title edit (got ${JSON.stringify(lastOverrides())})`);
    await title.fill('');
    expect(await title.inputValue() === '', 'an emptied box stays empty while typing');
    await button.click();
    expect(await title.inputValue() === 'Fall service event', 'and refills with the original once left');

    await title.fill('Fall service — 20% off');
    await description.fill('Book before Nov 15.\nCoffee is on us.');
    await button.fill('Book now');
    await expectVisible(fall.getByText('Fall service — 20% off'), 'the card shows the new title');
    await expectVisible(fall.getByText('Book before Nov 15. Coffee is on us.'), 'the card shows the new description (one paragraph)');
    await expectVisible(fall.getByText('Book now', { exact: true }), 'the card shows the new button text');
    expect(!(await fall.getByText('View campaign', { exact: true }).count()), 'the old button text is gone');
    await expectVisible(fall.getByText('Edited', { exact: true }), '"Edited" on the card');
    await page.waitForTimeout(1500);
    const want601 = { title: 'Fall service — 20% off', description: 'Book before Nov 15. Coffee is on us.', button_text: 'Book now' };
    expect(JSON.stringify(lastOverrides()) === JSON.stringify({ 'campaign:601': want601 }), `edits saved as overrides (got ${JSON.stringify(lastOverrides())})`);
    expect(!JSON.stringify(api.state.campaignBodies.at(-1)).includes('"url"'), 'no url is ever sent');
    await panel.scrollIntoViewIfNeeded();
    await shot(page, '1280-05-card-editor');

    // A card with no picture: add one, then back to the original (none).
    await section.getByRole('button', { name: 'Edit card: Winter tire swap' }).click();
    const panel2 = section.getByRole('group', { name: 'Edit card: Winter tire swap' });
    await expectVisible(panel2, 'switches to the other card');
    expect(!(await panel.count()), 'one card editor at a time');
    expect(!(await winter.locator('img').count()), 'no picture before');
    await panel2.getByRole('button', { name: 'Add image' }).click({ trial: true });
    await page.getByTestId('c1-card-image-input').setInputFiles(new URL('../../../../public/pwa-icon-192.png', import.meta.url).pathname);
    await expectVisible(winter.locator(`img[src="${IMG}"]`), 'the uploaded picture on the card');
    await expectVisible(panel2.getByRole('button', { name: 'Use original image' }), '"Use original image" after an upload');
    await page.waitForTimeout(1500);
    expect(lastOverrides()?.['campaign:604']?.image_url === IMG, `uploaded image saved (got ${JSON.stringify(lastOverrides())})`);
    await winter.scrollIntoViewIfNeeded();
    await shot(page, '1280-06-card-image');
    await panel2.getByRole('button', { name: 'Use original image' }).click();
    expect(!(await winter.locator('img').count()), 'back to the original (no picture)');
    await page.waitForTimeout(1500);
    expect(!lastOverrides()?.['campaign:604'], 'the image edit is gone from the save');

    // Reset to original.
    await section.getByRole('button', { name: 'Edit card: Fall service event' }).click();
    await panel.getByRole('button', { name: 'Reset to original' }).click();
    await expectVisible(fall.getByText('Fall service event', { exact: true }), 'the original title is back');
    await expectVisible(fall.getByText('View campaign', { exact: true }), 'the original button text is back');
    expect(await panel.getByLabel('Title', { exact: true }).inputValue() === 'Fall service event', 'the title box shows the original again');
    expect(await panel.getByRole('button', { name: 'Reset to original' }).isDisabled(), 'nothing left to reset');
    await page.waitForTimeout(1500);
    expect(lastOverrides() === undefined, `no overrides sent after the reset (got ${JSON.stringify(lastOverrides())})`);

    // A pause after a space while typing doesn't eat the space when the save answers.
    await title.fill('');
    await page.keyboard.type('Hi ');
    await page.waitForTimeout(1600);
    await page.keyboard.type('there');
    expect(await title.inputValue() === 'Hi there', `typing keeps its space across a save (got "${await title.inputValue()}")`);
    await page.waitForTimeout(1500);
    expect(lastOverrides()?.['campaign:601']?.title === 'Hi there', 'saved as typed');
    // Card text is plain (as the API keeps it): extra spaces show and save as one; the box keeps what was typed.
    await button.fill('Book   now');
    await expectVisible(fall.getByText('Book now', { exact: true }), 'extra spaces show as one on the card');
    await page.waitForTimeout(1500);
    expect(lastOverrides()?.['campaign:601']?.button_text === 'Book now', `saved with one space (got ${JSON.stringify(lastOverrides())})`);
    expect(await button.inputValue() === 'Book   now', 'the box keeps what was typed');
    const settled = puts(api).length;
    await page.waitForTimeout(2500);
    expect(puts(api).length === settled, `no save loop (${puts(api).length - settled} extra saves)`);
    await context.close();

    // Opened again: the edit is still there.
    const again = await open({ width: 1280, height: 1400, query: '&newsletterId=73', api });
    const fall2 = again.page.locator('aside li[data-card-key="campaign:601"]');
    await expectVisible(fall2.getByText('Hi there', { exact: true }), 'the edit is kept after reopening');
    await again.page.waitForTimeout(2000);
    const putsAfterOpen = puts(api).length;
    // Taking the card out in the picker drops its edit.
    const s2 = again.page.locator('aside').getByRole('group', { name: 'Campaigns section' }).first();
    await s2.click();
    await s2.getByRole('button', { name: EDIT }).filter({ hasText: 'Edit' }).click();
    const picker = again.page.getByRole('dialog', { name: 'Choose campaigns' });
    await picker.getByRole('checkbox', { name: /^Fall service event/ }).uncheck();
    await picker.getByRole('button', { name: 'Done' }).click();
    await again.page.waitForTimeout(1500);
    expect(puts(api).length > putsAfterOpen && !api.state.campaignBodies.at(-1)?.overrides, `a card taken out loses its edit (got ${JSON.stringify(api.state.campaignBodies.at(-1))})`);
    await again.context.close();
  }

  // ---- 3b. Phones: the card editor fits; a sent newsletter shows its edits, with nothing to edit.
  for (const width of [360, 375, 390]) {
    const blocks = [{ id: 'c1', type: 'campaigns', data: { selections: [{ kind: 'campaign', id: 601 }, { kind: 'campaign', id: 604 }], campaign_ids: [601, 604], columns: 2,
      items: [card(601, 'Fall service event'), card(604, 'Winter tire swap')], overrides: { 'campaign:604': { title: 'Tires: book this week', button_text: 'Book' } } } }];
    const api = createMockApi({ newsletters: [newsletter(74, { name: 'Phone edits', blocks })] });
    const { page, context } = await open({ width, height: 900, query: '&newsletterId=74', api });
    const section = page.locator('aside').getByRole('group', { name: 'Campaigns section' }).first();
    await expectVisible(section.getByText('Tires: book this week'), `edited card shows at ${width}`);
    await section.click();
    await section.getByRole('button', { name: 'Edit card: Winter tire swap' }).click();
    const panel = section.getByRole('group', { name: 'Edit card: Winter tire swap' });
    await expectVisible(panel, `card editor at ${width}`);
    expect(await panel.getByLabel('Title', { exact: true }).inputValue() === 'Tires: book this week', 'the saved edit is in the box');
    expect(!(await hasOverflow(page)), `no sideways scroll at ${width} (card editor)`);
    const fits = await panel.evaluate((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; });
    expect(fits, `card editor inside the screen at ${width}`);
    if (width === 390) {
      await panel.scrollIntoViewIfNeeded();
      await shot(page, '390-03-card-editor');
    }
    await page.waitForTimeout(1500);
    expect(!puts(api).length, `opening a card editor saves nothing at ${width}`);
    await context.close();
  }
  {
    const blocks = [{ id: 'c1', type: 'campaigns', data: { selections: [{ kind: 'campaign', id: 601 }], campaign_ids: [601], columns: 2, items: [card(601, 'Fall service event')], overrides: { 'campaign:601': { title: 'Edited for October' } } } }];
    const ro = await open({ width: 1280, height: 1200, query: '&newsletterId=75', api: createMockApi({ newsletters: [newsletter(75, { name: 'Sent', status: 'sent', sent_at: '2026-10-27T14:00:00Z', blocks })] }) });
    await expectVisible(ro.page.locator('aside').getByText('Edited for October'), 'a sent newsletter shows its card edits');
    await ro.page.locator('aside').getByText('Edited for October').click();
    expect(!(await ro.page.getByRole('button', { name: /^Edit card/ }).count()), 'nothing to edit when read-only');
    await ro.context.close();
  }

  // ---- 3c. Review: the card editor opens right under its card's row and comes into view; ✕ gives focus back to the
  //      card's "Edit card"; covers capped at 320 px only in 1 column; the description keeps its line breaks while typing.
  {
    const four = [card(601, 'Fall service event'), card(602, '2026 Grand Cherokee arrivals'), card(604, 'Winter tire swap'), card(605, 'Open house weekend')];
    const sel = four.map((c) => ({ kind: 'campaign', id: c.id }));
    const blocks = [
      { id: 'c1', type: 'campaigns', data: { selections: sel, campaign_ids: sel.map((x) => x.id), columns: 2, items: four } },
      { id: 'c2', type: 'campaigns', data: { selections: sel.slice(0, 1), campaign_ids: [601], columns: 1, items: four.slice(0, 1) } },
    ];
    for (const width of [1280, 390]) {
      const api = createMockApi({ newsletters: [newsletter(76, { name: 'Editor placement', blocks })] });
      const { page, context } = await open({ width, height: width === 1280 ? 1000 : 860, query: '&newsletterId=76', api });
      const preview = page.locator('aside');
      const section = preview.getByRole('group', { name: 'Campaigns section' }).first();
      await expectVisible(section.getByText('Open house weekend'), `four cards at ${width}`);
      if (width === 1280) {
        const caps = await preview.evaluate((aside) => [...aside.querySelectorAll('li[data-card-key] img')].map((img) => getComputedStyle(img).maxHeight));
        expect(caps.slice(0, 4).every((m) => m === 'none'), `2 columns: covers not capped (got ${caps.slice(0, 4)})`);
        expect(caps[4] === '320px', `1 column: covers capped at 320 px (got ${caps[4]})`);
      }
      await section.click();
      await section.getByRole('button', { name: 'Edit card: Fall service event' }).click();
      const panel = section.getByRole('group', { name: 'Edit card: Fall service event' });
      await expectVisible(panel, `editor open at ${width}`);
      await page.waitForTimeout(400);
      const place = await section.evaluate((el) => {
        const box = (k) => el.querySelector(`li[data-card-key="${k}"]`).getBoundingClientRect();
        const p = el.querySelector('[data-nl-card-editor]').getBoundingClientRect();
        return { first: box('campaign:601'), second: box('campaign:602'), third: box('campaign:604'), panel: p, vh: window.innerHeight };
      });
      if (width === 1280) {
        expect(place.panel.top >= Math.max(place.first.bottom, place.second.bottom) && place.panel.bottom <= place.third.top, 'in 2 columns: right under the first row, before the second');
      } else {
        expect(place.panel.top >= place.first.bottom && place.panel.bottom <= place.second.top, 'in 1 column: right under the card, before the next one');
      }
      expect(place.panel.top < place.vh && place.panel.bottom > 0, `the editor is on screen at ${width}`);
      await shot(page, `${width}-07-editor-under-card`);

      // The description keeps a line break while typing; one paragraph once the box is left.
      const description = panel.getByLabel('Description', { exact: true });
      await description.fill('');
      await page.keyboard.type('Line one');
      await page.keyboard.press('Enter');
      await page.keyboard.type('line two');
      expect(await description.inputValue() === 'Line one\nline two', `kept as typed (got ${JSON.stringify(await description.inputValue())})`);
      await expectVisible(section.locator('li[data-card-key="campaign:601"]').getByText('Line one line two'), 'the card shows one paragraph');
      await panel.getByLabel('Title', { exact: true }).focus();
      expect(await description.inputValue() === 'Line one line two', 'one paragraph after leaving the box');

      await panel.getByRole('button', { name: 'Close card editor' }).click();
      expect(!(await panel.count()), 'editor closed');
      expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Edit card: Fall service event', 'focus back on that card’s Edit card');
      expect(!(await hasOverflow(page)), `no sideways scroll at ${width}`);
      await context.close();
    }
  }

  // ---- 3d. An upload that finishes after its card was taken out changes nothing.
  {
    const blocks = [{ id: 'c1', type: 'campaigns', data: { selections: [{ kind: 'campaign', id: 601 }, { kind: 'campaign', id: 604 }], campaign_ids: [601, 604], columns: 2, items: [card(601, 'Fall service event'), card(604, 'Winter tire swap')] } }];
    const api = createMockApi({ newsletters: [newsletter(77, { name: 'Late upload', blocks })] });
    const { page, context } = await open({ width: 1280, height: 1400, query: '&newsletterId=77', api });
    const section = page.locator('aside').getByRole('group', { name: 'Campaigns section' }).first();
    await expectVisible(section.getByText('Winter tire swap'), 'cards open');
    await section.click();
    await section.getByRole('button', { name: 'Edit card: Winter tire swap' }).click();
    api.state.uploadDelayMs = 2500;
    await page.getByTestId('c1-card-image-input').setInputFiles(new URL('../../../../public/pwa-icon-192.png', import.meta.url).pathname);
    await section.getByRole('button', { name: EDIT }).filter({ hasText: 'Edit' }).click();
    const picker = page.getByRole('dialog', { name: 'Choose campaigns' });
    await picker.getByRole('checkbox', { name: /^Winter tire swap/ }).uncheck();
    await picker.getByRole('button', { name: 'Done' }).click();
    const upload = api.state.calls.find((c) => c.path === '/newsletters/images');
    expect(upload && upload.status === undefined, 'the upload was still on its way when the card was taken out');
    await page.waitForTimeout(4500);
    expect(upload?.status === 201, 'and then finished');
    const body = api.state.campaignBodies.at(-1);
    expect(api.state.uploads.length === 1, 'the upload went out');
    expect(JSON.stringify(body?.selections) === JSON.stringify([{ kind: 'campaign', id: 601 }]) && !body?.overrides, `the late upload left no edit behind (got ${JSON.stringify(body)})`);
    await context.close();
  }
}
