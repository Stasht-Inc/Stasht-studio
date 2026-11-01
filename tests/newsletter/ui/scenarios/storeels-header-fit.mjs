// Review (batch 3): at a 1280 px window beside App's two sidebars (about 650 px for the page; Chris saw it in a
// salesperson's External view) the Storeels header's "Create a Campaign" was cut off at the right edge. The header's
// buttons now wrap under the title when they don't fit; where they fit (a wide window) it is one row as before.
import { createMockApi } from '../mock-api.mjs';

const SHOTS = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';

/** The header row around "All Campaigns": does every button sit inside the card, and is it one row? */
async function header(page) {
  return page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((x) => x.textContent.trim() === 'All Campaigns' && x.offsetParent);
    if (!h) return { error: 'no header' };
    let card = h;
    while (card && !(card.className || '').toString().includes('md:rounded-xl')) card = card.parentElement;
    const edge = card.getBoundingClientRect();
    const buttons = [...card.querySelectorAll('button')].filter((b) => b.offsetParent && b.getBoundingClientRect().top < h.getBoundingClientRect().bottom + 80);
    const outside = buttons.filter((b) => { const r = b.getBoundingClientRect(); return r.right > edge.right + 0.5 || r.left < edge.left - 0.5; }).map((b) => b.textContent.trim() || b.getAttribute('aria-label'));
    const create = buttons.find((b) => /Create/.test(b.textContent));
    const title = h.getBoundingClientRect();
    return {
      outside,
      create: create ? create.textContent.trim() : null,
      oneRow: create ? Math.abs(create.getBoundingClientRect().top + create.getBoundingClientRect().height / 2 - (title.top + title.height)) < 40 : null,
      createBelowTitle: create ? create.getBoundingClientRect().top >= title.bottom - 2 : null,
    };
  });
}

export async function run({ open, expect, expectVisible, hasOverflow }) {
  const cases = [
    { width: 1280, query: '&appSidebars=1', label: '1280 + sidebars' },
    { width: 1440, query: '', label: '1440 wide' },
    { width: 390, query: '', label: '390 phone' },
  ];
  for (const c of cases) {
    const { page, context } = await open({ view: 'campaigns', width: c.width, height: 900, api: createMockApi(), campaignsView: 'storeels', query: c.query });
    await expectVisible(page.getByRole('heading', { name: 'All Campaigns' }).locator('visible=true'), `${c.label}: header`);
    await page.waitForTimeout(500);
    const h = await header(page);
    expect(!h.error, `${c.label}: ${h.error}`);
    expect(h.create !== null, `${c.label}: Create button shown`);
    expect(h.outside.length === 0, `${c.label}: every header button inside the card (outside: ${JSON.stringify(h.outside)})`);
    expect(!(await hasOverflow(page)), `${c.label}: no sideways scroll`);
    if (c.width === 1440) expect(h.oneRow === true, `${c.label}: still one row where it fits`);
    await page.screenshot({ path: `${SHOTS}/storeels-header-${c.width}${c.query ? '-sidebars' : ''}.png` });
    await context.close();
  }
}
