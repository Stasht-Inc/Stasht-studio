// Chris's newsletter feedback, 29 Oct (round 2), the editor part:
// 1. The "+" between sections is always shown (not only on hover).
// 2. A Campaign section shows its cards in 1 or 2 columns (2 for a new section; an older one stays 1 until changed);
//    the phone view (and a phone screen) shows 1, as the email; the section's "Change" button is now "Edit", with the
//    column choice next to it.
import { IMG, STUDIO, createMockApi, newsletter } from '../mock-api.mjs';

const EDIT = 'Edit campaigns, products or vehicles';
const card = (id, title) => ({ kind: 'campaign', id, title, description: `About ${title}.`, cover_url: IMG, url: `${STUDIO}/published-memory/campaign-${id}`, date: '2026-10-20', price_text: null, meta: null });
const puts = (api) => api.state.calls.filter((c) => c.method === 'PUT');

/** The cards' boxes in the preview (left, top, width), rounded. */
async function cardBoxes(section) {
  return section.getByRole('list', { name: 'Campaigns in this section' }).evaluate((ul) => [...ul.children].map((li) => {
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
}
