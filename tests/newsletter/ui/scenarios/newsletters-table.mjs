// Batch 3 (Chris, 1 Nov): the Newsletters table at a 1280 px window beside App's two sidebars (about 650 px) had the
// name column collapsed, "Newsletter" running into "Status" and Edit / ⋯ past the right edge. Its layout now follows
// its own width. And a row is obviously clickable: hover shows it, a click anywhere on it opens the newsletter
// (results; a draft opens in the composer), while Edit and ⋯ still do their own thing.
import { createMockApi, seedNewsletters } from '../mock-api.mjs';

const SHOTS = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';

/** Overlaps in the header, and anything in a row reaching past the list's right edge. */
async function fitProblems(page) {
  return page.evaluate(() => {
    const out = [];
    const table = document.querySelector('[role="table"][aria-label="Your newsletters"]');
    if (!table) return ['no table'];
    const edge = table.getBoundingClientRect().right;
    const heads = [...table.querySelectorAll('[role="columnheader"]')];
    for (let i = 0; i < heads.length - 1; i++) {
      const a = heads[i].getBoundingClientRect();
      const b = heads[i + 1].getBoundingClientRect();
      const textA = heads[i].textContent.trim();
      // A header's words must fit its own column (no "NewsStatus").
      if (heads[i].scrollWidth > heads[i].clientWidth + 1) out.push(`header "${textA}" wider than its column`);
      if (a.right > b.left + 0.5) out.push(`header "${textA}" overlaps the next`);
    }
    for (const el of table.querySelectorAll('[role="row"] button, [role="cell"]')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > edge + 0.5) out.push(`${el.getAttribute('aria-label') || el.textContent.trim().slice(0, 20)} past the right edge`);
    }
    const names = [...table.querySelectorAll('[role="rowgroup"]:last-child [role="row"] [role="cell"]:first-child')];
    for (const n of names) if (n.getBoundingClientRect().width < 139) out.push(`name column only ${Math.round(n.getBoundingClientRect().width)} px`);
    return out;
  });
}

const listWidth = (page) => page.evaluate(() => {
  const h = [...document.querySelectorAll('h2')].find((x) => x.textContent.trim() === 'Newsletters' && x.offsetParent);
  let el = h;
  while (el && !(el.className || '').toString().includes('md:rounded-xl')) el = el.parentElement;
  return el ? Math.round(el.getBoundingClientRect().width) : 0;
});

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // 1. 1280 px window, both App sidebars open: the table fits (When under the Status chip).
  let api = createMockApi({ newsletters: seedNewsletters() });
  let { page, context } = await open({ view: 'campaigns', width: 1280, height: 900, api, query: '&appSidebars=1' });
  await expectVisible(page.getByRole('heading', { name: 'Newsletters', exact: true }), 'Newsletters view');
  await expectVisible(page.getByRole('row', { name: /September recap/ }), 'rows');
  const w = await listWidth(page);
  expect(w >= 600 && w <= 660, `list is about 650 px wide here (got ${w})`);
  let problems = await fitProblems(page);
  expect(problems.length === 0, `1280 + sidebars: everything fits (${problems.join('; ')})`);
  expect(!(await hasOverflow(page)), '1280 + sidebars: no sideways scroll');
  const heads = await page.getByRole('columnheader').allTextContents();
  expect(JSON.stringify(heads.map((h) => h.trim())) === JSON.stringify(['Newsletter', 'Status', 'Recipients', 'Opened', 'Clicked', 'Actions']), `headers (got ${JSON.stringify(heads)})`);
  await expectVisible(page.getByRole('row', { name: /Winter tires/ }).getByText(/^Sends /), 'when, under the chip');
  await expectVisible(page.getByRole('button', { name: 'Edit October Newsletter 2026' }), 'Edit on the draft');
  await expectVisible(page.getByRole('button', { name: 'Actions for September recap' }), '⋯ on a row');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/newsletters-table-1280-sidebars-01-viewport.png` });

  // Hover: the row lights up and the name turns purple.
  const sept = page.getByRole('row', { name: /September recap/ });
  const bgBefore = await sept.evaluate((el) => getComputedStyle(el).backgroundColor);
  await sept.getByText(/^Sent/).first().hover();
  await page.waitForTimeout(400);
  const bgHover = await sept.evaluate((el) => getComputedStyle(el).backgroundColor);
  const nameColor = await sept.getByText('September recap', { exact: true }).evaluate((el) => getComputedStyle(el).color);
  expect(bgBefore !== bgHover, `row background changes on hover (${bgBefore} → ${bgHover})`);
  expect(nameColor === 'rgb(108, 96, 255)', `name purple on row hover (got ${nameColor})`);
  expect((await sept.evaluate((el) => getComputedStyle(el).cursor)) === 'pointer', 'pointer cursor on the row');
  await page.screenshot({ path: `${SHOTS}/newsletters-table-1280-sidebars-02-hover.png` });

  // A click on an empty part of the row (the Clicked cell) opens its results.
  await sept.getByRole('cell').nth(4).click();
  await expectVisible(page.getByRole('dialog').getByText('September recap').first(), 'row click opens the results');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ⋯ opens its menu only; choosing Duplicate doesn't open the results too.
  await sept.getByRole('button', { name: 'Actions for September recap' }).click();
  await expectVisible(page.getByRole('menuitem', { name: 'Duplicate' }), '⋯ menu');
  expect(await page.getByRole('dialog').count() === 0, '⋯ does not open the results');
  const before = api.state.calls.length;
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await page.waitForTimeout(700);
  expect(api.state.calls.slice(before).some((c) => c.method === 'POST' && /\/duplicate$/.test(c.path)), 'Duplicate ran');
  expect(await page.getByRole('dialog').count() === 0, 'a menu choice does not open the results');

  // A draft row opens in the composer; its Edit button does too, once.
  const draftRow = page.getByRole('row', { name: /October Newsletter 2026/ });
  await draftRow.getByRole('cell').nth(2).click();
  await expectVisible(page.getByRole('heading', { name: 'Create Campaign' }), 'draft row opens the composer');
  await page.getByRole('button', { name: 'Cancel' }).first().click();
  await page.waitForTimeout(600);
  await context.close();

  // 2. Wide list (no sidebars, 1440): the When column and Edit with its word, as before.
  api = createMockApi({ newsletters: seedNewsletters() });
  ({ page, context } = await open({ view: 'campaigns', width: 1440, height: 900, api }));
  await expectVisible(page.getByRole('row', { name: /September recap/ }), 'wide: rows');
  const wideHeads = (await page.getByRole('columnheader').allTextContents()).map((h) => h.trim());
  expect(wideHeads.includes('When'), `wide: When column (got ${JSON.stringify(wideHeads)})`);
  await expectVisible(page.getByRole('button', { name: 'Edit October Newsletter 2026' }).getByText('Edit', { exact: true }), 'wide: Edit with its word');
  problems = await fitProblems(page);
  expect(problems.length === 0, `wide: everything fits (${problems.join('; ')})`);
  await page.screenshot({ path: `${SHOTS}/newsletters-table-1440-01-viewport.png` });
  await context.close();

  // 3. Narrower than the table (1100 px window beside both sidebars, list under 600 px): the card rows, no overflow.
  api = createMockApi({ newsletters: seedNewsletters() });
  ({ page, context } = await open({ view: 'campaigns', width: 1150, height: 900, api, query: '&appSidebars=1' }));
  await expectVisible(page.getByRole('heading', { name: 'Newsletters', exact: true }), 'narrow: view');
  const nw = await listWidth(page);
  expect(nw < 600, `narrow list (got ${nw})`);
  await expectVisible(page.getByRole('list', { name: 'Your newsletters' }).getByText('September recap'), 'narrow: card rows');
  expect(await page.getByRole('table').count() === 0, 'narrow: no clipped table');
  expect(!(await hasOverflow(page)), 'narrow: no sideways scroll');
  await page.screenshot({ path: `${SHOTS}/newsletters-table-1150-sidebars-cards-viewport.png` });
  await context.close();

  // 4. Every width from 600 to 1300 px of list: never anything clipped.
  for (const width of [1232, 1280, 1400, 1500, 1640]) {
    api = createMockApi({ newsletters: seedNewsletters() });
    ({ page, context } = await open({ view: 'campaigns', width, height: 900, api, query: '&appSidebars=1' }));
    await expectVisible(page.getByRole('row', { name: /September recap/ }), `${width}: rows`);
    const p = await fitProblems(page);
    expect(p.length === 0, `${width} (list ${await listWidth(page)} px): fits (${p.join('; ')})`);
    await context.close();
  }
}
