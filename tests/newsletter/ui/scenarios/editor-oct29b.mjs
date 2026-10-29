// Chris's newsletter feedback, 29 Oct (round 2), the editor part:
// 1. The "+" between sections is always shown (not only on hover).
import { IMG, createMockApi, newsletter } from '../mock-api.mjs';

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
}
