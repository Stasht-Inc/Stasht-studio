// Chris's review, 29 Oct 2026. (1) The + menu: Campaign first, every item visible on a laptop without scrolling,
// and a "More below" cue when a short window makes it scroll. (2) Step 1 "Name and subject": the subject follows
// the name until it is edited, and the preview's subject changes as the name is typed.
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
}
