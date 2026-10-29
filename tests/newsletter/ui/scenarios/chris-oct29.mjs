// Chris's review, 29 Oct 2026. (1) The + menu: Campaign first, every item visible on a laptop without scrolling,
// and a "More below" cue when a short window makes it scroll. (2) Step 1 "Name and subject": the subject follows
// the name until it is edited, and the preview's subject changes as the name is typed.
import { createMockApi, newsletter } from '../mock-api.mjs';

const LABELS = ['Campaign', 'Image', 'Title', 'Text', 'YouTube', 'Button', 'Divider'];

async function openMenu(page) {
  await page.locator('aside').getByRole('button', { name: 'Add a section at the top' }).click();
  const menu = page.getByRole('menu', { name: 'Sections' });
  await menu.waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(300);
  return menu;
}

/** Each item's box inside the menu's visible area, and the menu inside the window. */
async function menuFit(page) {
  return page.evaluate(() => {
    const menu = document.querySelector('[role="menu"][aria-label="Sections"]');
    const m = menu.getBoundingClientRect();
    const items = [...menu.querySelectorAll('[role="menuitem"]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { label: el.querySelector('span span')?.textContent ?? '', inside: r.top >= m.top - 0.5 && r.bottom <= m.bottom + 0.5 };
    });
    const content = menu.closest('[data-radix-popper-content-wrapper]')?.getBoundingClientRect() ?? m;
    return {
      items,
      scrolls: menu.scrollHeight > menu.clientHeight + 1,
      inWindow: content.top >= 0 && content.bottom <= window.innerHeight + 0.5 && content.left >= 0 && content.right <= window.innerWidth + 0.5,
      cue: Boolean(document.querySelector('[data-more-below]')),
    };
  });
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // ---- Fix 1: the + menu at 1280 × 800 (a normal laptop) and 1280 × 700.
  for (const height of [800, 700]) {
    const { page, context } = await open({ width: 1280, height });
    await page.locator('#nl-name').fill('Menu check');
    const menu = await openMenu(page);
    const fit = await menuFit(page);
    expect(JSON.stringify(fit.items.map((i) => i.label)) === JSON.stringify(LABELS), `Campaign first at 1280×${height} (got ${fit.items.map((i) => i.label)})`);
    for (const item of fit.items) expect(item.inside, `"${item.label}" visible without scrolling at 1280×${height}`);
    expect(!fit.scrolls, `menu does not scroll at 1280×${height}`);
    expect(fit.inWindow, `menu inside the window at 1280×${height}`);
    expect(!fit.cue, `no "More below" cue when nothing is hidden at 1280×${height}`);
    const first = menu.getByRole('menuitem').first();
    expect(/Add one of your campaigns/.test(await first.textContent()), 'Campaign subtitle');
    expect(await first.evaluate((el) => el === document.activeElement), 'focus starts on Campaign');
    if (height === 800) await shot(page, '1280-menu');
    await context.close();
  }

  // ---- Phones and short windows: it may scroll, but then says "More below" until the end is reached.
  for (const [width, height] of [[390, 600], [390, 844]]) {
    const { page, context } = await open({ width, height });
    await page.locator('#nl-name').fill('Menu check');
    const trigger = page.locator('aside').getByRole('button', { name: 'Add a section at the top' });
    await trigger.scrollIntoViewIfNeeded();
    // The "+" mid-window, as when scrolling through the email.
    await trigger.evaluate((el) => {
      const scroller = (function find(n) { while (n && n !== document.body) { const s = getComputedStyle(n); if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight) return n; n = n.parentElement; } return document.scrollingElement; })(el.parentElement);
      const r = el.getBoundingClientRect();
      scroller.scrollTop += r.top - window.innerHeight / 2;
    });
    const menu = await openMenu(page);
    const fit = await menuFit(page);
    expect(fit.inWindow, `menu inside the window at ${width}×${height}`);
    expect(fit.items[0]?.label === 'Campaign', `Campaign first at ${width}×${height}`);
    if (fit.scrolls) {
      expect(fit.cue, `"More below" shows when the menu scrolls at ${width}×${height}`);
      await expectVisible(page.getByText('More below'), `"More below" visible at ${width}×${height}`);
      if (height === 600) await shot(page, `${width}x${height}-menu-cue`);
      await menu.evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await page.waitForTimeout(200);
      expect(!(await menuFit(page)).cue, `cue goes away at the end of the list at ${width}×${height}`);
    } else {
      expect(!fit.cue, `no cue when everything fits at ${width}×${height}`);
    }
    if (height === 600) expect(fit.scrolls, 'the short phone window exercises the scrolling menu');
    if (height === 844) await shot(page, `${width}-menu`);
    expect(!(await hasOverflow(page)), `no sideways scroll with the menu open at ${width}×${height}`);
    await context.close();
  }

  // ---- Fix 2: step 1 "Name and subject"; the subject follows the name until it is edited.
  const { page, api, context } = await open({ width: 1280, height: 900 });
  const step1 = page.locator('#nl-step-name');
  const inbox = page.locator('aside');
  await expectVisible(step1.getByRole('heading', { name: 'Name and subject', exact: true }), 'step 1 is "Name and subject"');
  for (const [title, n] of [['Name and subject', '1'], ['Recipients', '2'], ['From', '3'], ['Content', '4'], ['Schedule', '5']]) {
    const card = page.locator('section').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    expect((await card.locator('header span[aria-hidden="true"]').first().textContent())?.trim() === n, `"${title}" is step ${n}`);
  }
  expect(await page.getByRole('heading', { name: 'Subject', exact: true }).count() === 0, 'no separate Subject step');
  expect(await step1.locator('#nl-subject').count() === 1 && await step1.locator('#nl-preview-text').count() === 1, 'subject line and preview text in step 1');
  await expectVisible(step1.getByText('Subscribers see the subject line, not the name.'), 'name hint');
  await expectVisible(inbox.getByText('Your subject line'), 'subject placeholder before typing');

  // Typing a name (key by key) updates the subject field and the preview's subject as it goes.
  const name = page.locator('#nl-name');
  await name.click();
  await page.keyboard.type('October deals');
  expect(await page.locator('#nl-subject').inputValue() === 'October deals', `subject followed the name (got ${await page.locator('#nl-subject').inputValue()})`);
  await expectVisible(inbox.getByText('October deals', { exact: true }), 'preview subject follows the name');
  expect(await name.evaluate((el) => el === document.activeElement && el.selectionStart === el.value.length), 'cursor stays at the end of the name');
  // Editing in the middle of the name: no cursor jump.
  await name.evaluate((el) => el.setSelectionRange(7, 7)); // after "October" (Home does not move the caret on macOS)
  await page.keyboard.type(' big');
  expect(await name.inputValue() === 'October big deals', `typed mid-name (got ${await name.inputValue()})`);
  expect(await name.evaluate((el) => el.selectionStart) === 11, 'cursor stayed where the person typed');
  expect(await page.locator('#nl-subject').inputValue() === 'October big deals', 'subject still following');
  await shot(page, '1280-step1-synced');

  // Editing the subject stops the sync.
  await page.locator('#nl-subject').fill('Big savings this October');
  await name.fill('October Newsletter 2026');
  expect(await page.locator('#nl-subject').inputValue() === 'Big savings this October', 'an edited subject no longer follows the name');
  await expectVisible(inbox.getByText('Big savings this October'), 'preview keeps the edited subject');
  await page.waitForTimeout(1600);
  const saved = api.state.newsletters[0];
  expect(saved?.name === 'October Newsletter 2026' && saved?.subject === 'Big savings this October', `autosaved name and subject (got ${saved?.name} / ${saved?.subject})`);
  await shot(page, '1280-step1-edited');

  // Reload (the draft opened again): the edited subject stays edited.
  const id = saved?.id;
  await page.goto(`${page.url().split('?')[0]}?view=composer&newsletterId=${id}`);
  await expectVisible(page.locator('#nl-step-name'), 'composer back after reload');
  await page.waitForFunction(() => document.querySelector('#nl-name')?.value === 'October Newsletter 2026', null, { timeout: 8000 }).catch(() => {});
  expect(await page.locator('#nl-subject').inputValue() === 'Big savings this October', 'edited subject reloaded');
  await page.locator('#nl-name').fill('October Newsletter');
  expect(await page.locator('#nl-subject').inputValue() === 'Big savings this October', 'after reload, the edited subject still does not follow');
  await context.close();

  // Opened drafts: a subject still equal to the name keeps following it; an empty subject starts following.
  for (const [over, label] of [[{ name: 'Spring', subject: 'Spring' }, 'subject equal to the name'], [{ name: 'Spring', subject: null }, 'empty subject']]) {
    const seeded = await open({ width: 1280, height: 900, query: '&newsletterId=30', api: createMockApi({ newsletters: [newsletter(30, over)] }) });
    await seeded.page.waitForFunction(() => document.querySelector('#nl-name')?.value === 'Spring', null, { timeout: 8000 }).catch(() => {});
    await seeded.page.locator('#nl-name').fill('Spring sale');
    expect(await seeded.page.locator('#nl-subject').inputValue() === 'Spring sale', `opened draft with ${label} follows the name`);
    await seeded.page.waitForTimeout(1500);
    expect(seeded.api.state.newsletters[0]?.subject === 'Spring sale', `followed subject autosaved (${label})`);
    await seeded.context.close();
  }

  // Screenshots of step 1 at 1280 and 390.
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const s = await open({ width, height });
    await s.page.locator('#nl-name').fill('Spring');
    await s.page.locator('#nl-preview-text').fill('New arrivals');
    expect(await s.page.locator('#nl-subject').inputValue() === 'Spring', `synced at ${width}`);
    await s.page.locator('#nl-name').focus();
    await shot(s.page, `${width}-step1`);
    await s.context.close();
  }
  for (const width of [360, 375, 390]) {
    const s = await open({ width, height: 844 });
    await s.page.locator('#nl-name').fill('A fairly long newsletter name for a phone screen');
    expect(!(await hasOverflow(s.page)), `no sideways scroll on step 1 at ${width}`);
    await s.context.close();
  }
}
