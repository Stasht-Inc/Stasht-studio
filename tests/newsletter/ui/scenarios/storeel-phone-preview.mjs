// Chris, 6 Nov 2026 — the Storeel create / edit page.
// Point 1: the reason / error line above the actions reads like an error: "*Add a campaign title" (asterisk, no full
//   stop), red, left-aligned, in the middle of the gap between the Send card and the buttons — every reason there.
// Point 2: the live preview is a real phone screen built to his Figma "Story Details - Cover": the chosen device's
//   aspect ratio (iPhone 15 by default; SE, 15 Pro Max, Pixel 8 in a small picker), scaled to fit the panel, the cover
//   filling the first screen (the Figma's 852 of 852 pt), the page scrolling inside the phone; the choice remembered.
// At 1280 and 390. node tests/newsletter/ui/check.mjs storeel-phone-preview   (NL_BASE = the dev server)
import { readFileSync } from 'fs';
import { createMockApi } from '../mock-api.mjs';

const STOREEL_TITLE = 'Give your campaign a meaningful title';
const PNG = readFileSync(new URL('../../../../public/pwa-icon-512.png', import.meta.url));
const RED_600 = 'rgb(220, 38, 38)';
const DEVICES = [['iphone-se', 375, 667], ['iphone-15', 393, 852], ['iphone-15-pro-max', 430, 932], ['pixel-8', 412, 915]];

const flow = (page) => page.getByRole('dialog', { name: /^(Create|Edit) Campaign$/ });
const button = (page, name) => flow(page).getByRole('button', { name, exact: true }).filter({ visible: true }).last();
const picker = (page) => page.getByTestId('storeel-preview-device');
const screen = (page) => page.getByTestId('storeel-preview-screen');

async function openStoreel(open, width, height, api) {
  const o = await open({ width, height, api });
  await o.page.locator('#nl-name').waitFor();
  await o.page.getByRole('radio', { name: 'Storeel', exact: true }).click();
  await o.page.getByPlaceholder(STOREEL_TITLE).waitFor();
  await o.page.waitForTimeout(900);
  return o;
}

async function inView(page, locator) {
  const box = await locator.first().boundingBox();
  const vp = page.viewportSize();
  return Boolean(box && vp && box.y >= 0 && box.y + box.height <= vp.height + 1 && box.x >= 0 && box.x + box.width <= vp.width + 1);
}

/** The line's colour / alignment, and the gaps above (to the Send card) and below it (to the buttons). */
async function lineGeometry(page, id) {
  return page.evaluate((id) => {
    const line = document.getElementById(id);
    if (!line) return null;
    const box = line.parentElement;
    const lines = { top: box.firstElementChild.getBoundingClientRect().top, bottom: box.lastElementChild.getBoundingClientRect().bottom };
    const send = document.getElementById('st-step-send').getBoundingClientRect();
    const buttons = document.querySelector('#st-actions > div:last-child').getBoundingClientRect();
    const s = getComputedStyle(line);
    const r = line.getBoundingClientRect();
    return {
      text: line.textContent, color: s.color, align: s.textAlign, left: r.left, sendLeft: send.left,
      above: lines.top - send.bottom, below: buttons.top - lines.bottom,
    };
  }, id);
}

async function checkLine(page, expect, id, text, label) {
  const g = await lineGeometry(page, id);
  expect(g && g.text === text, `${label}: reads "${text}" (got ${JSON.stringify(g?.text)})`);
  expect(g && g.color === RED_600, `${label}: red (${g?.color})`);
  expect(g && (g.align === 'left' || g.align === 'start') && Math.abs(g.left - g.sendLeft) <= 2, `${label}: left-aligned with the cards (${g?.align}, x ${g?.left} vs ${g?.sendLeft})`);
  expect(g && Math.abs(g.above - g.below) <= 4, `${label}: in the middle of the gap (above ${g?.above}, below ${g?.below})`);
  return g;
}

/** The phone screen's size on the page, and the cover's / first-screen pieces in it. */
async function phoneGeometry(page) {
  return page.evaluate(() => {
    const scr = document.querySelector('[data-testid="storeel-preview-screen"]');
    const phone = document.querySelector('[data-testid="storeel-preview"]');
    const cover = document.querySelector('[data-testid="storeel-preview-cover"]');
    const r = scr.getBoundingClientRect();
    const c = cover.getBoundingClientRect();
    const timeline = [...cover.querySelectorAll('p')].find((p) => p.textContent.startsWith('Timeline'));
    const t = timeline?.getBoundingClientRect();
    return {
      device: phone.getAttribute('data-device'), width: r.width, height: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right,
      cssWidth: scr.offsetWidth, cssHeight: scr.offsetHeight, coverShare: c.height / r.height,
      timelineInFirstScreen: t ? t.bottom <= r.bottom : false, scrollable: scr.scrollHeight > scr.clientHeight,
      transform: phone.style.transform,
    };
  });
}

export async function run({ open, shot, expect, hasOverflow }) {
  for (const [width, height] of [[1280, 800], [390, 844]]) {
    const tag = String(width);
    const api = createMockApi({ catalogue: true });
    const { page, context } = await openStoreel(open, width, height, api);

    // ── Point 1: "*Add a campaign title" — red, left, centred in the gap ────────────────────────────────────────
    await page.locator('#st-actions').scrollIntoViewIfNeeded();
    expect(await button(page, 'Save as Draft').isDisabled(), `${tag}: Save as Draft off with no title`);
    await checkLine(page, expect, 'st-save-reason', '*Add a campaign title', `${tag}: no title`);
    expect(await inView(page, page.locator('#st-save-reason')), `${tag}: the line is in the viewport with the buttons`);
    expect(!(await page.getByText('Add a campaign title.', { exact: true }).count()), `${tag}: the old wording with a full stop is gone`);
    await page.waitForTimeout(200);
    await shot(page, `${tag}-01-error-no-title`);

    // A refused save (no catalogue item picked) and the Send reason, in the same style.
    await page.getByPlaceholder(STOREEL_TITLE).fill(`Great Products ${tag}`);
    await page.locator('#st-step-campaign').getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Website Catalogue' }).click();
    await page.waitForTimeout(500);
    await page.locator('#st-actions').scrollIntoViewIfNeeded();
    await checkLine(page, expect, 'st-send-reason', '*To send now: Choose who gets this Storeel', `${tag}: Send reason`);
    await button(page, 'Save as Draft').click();
    await page.waitForTimeout(900);
    await page.locator('#st-actions').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const err = await checkLine(page, expect, 'st-action-error', '*Pick at least one item from your Website Catalogue', `${tag}: refused save`);
    const reasonColor = (await lineGeometry(page, 'st-send-reason'))?.color;
    expect(err && reasonColor === err.color, `${tag}: the refused save and the reason look the same`);
    await shot(page, `${tag}-02-error-and-reason`);
    await page.getByText('Oak bench', { exact: true }).first().click();
    await page.waitForTimeout(300);

    // ── Point 2: a phone screen, iPhone 15 by default ───────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Add a Moment' }).first().click();
    await page.locator('#file-upload').setInputFiles([{ name: 'front.png', mimeType: 'image/png', buffer: PNG }]);
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /^Add all/ }).click();
    await page.waitForTimeout(1200);
    // The cover's pills and dates (Figma): the category, the year, start – end.
    await page.locator('#endDateCheckbox').check();
    const start = await page.locator('#st-step-campaign input[type="date"]').first().inputValue();
    await page.locator('#st-step-campaign input[type="date"]').nth(1).fill(`${start.slice(0, 4)}-12-31`);
    await page.waitForTimeout(300);
    const coverText = (await page.getByTestId('storeel-preview-cover').textContent()) ?? '';
    expect(coverText.includes('Website Catalogue') && coverText.includes(start.slice(0, 4)) && coverText.includes(`Dec 31, ${start.slice(0, 4)}`) && coverText.includes(' – '),
      `${tag}: the cover shows the category, the year and start – end (got "${coverText.slice(0, 160)}")`);
    expect(await picker(page).inputValue() === 'iphone-15', `${tag}: iPhone 15 by default (got ${await picker(page).inputValue()})`);
    const options = await picker(page).locator('option').allTextContents();
    expect(JSON.stringify(options) === JSON.stringify(['iPhone SE', 'iPhone 15', 'iPhone 15 Pro Max', 'Pixel 8']), `${tag}: the four phones (${options})`);
    await page.getByTestId('storeel-preview').scrollIntoViewIfNeeded();
    for (const [id, w, h] of DEVICES) {
      await picker(page).selectOption(id);
      await page.waitForTimeout(250);
      const g = await phoneGeometry(page);
      expect(g.device === id && g.cssWidth === w && g.cssHeight === h, `${tag} ${id}: laid out at ${w}×${h} (got ${g.cssWidth}×${g.cssHeight})`);
      expect(Math.abs(g.width / g.height - w / h) < 0.005, `${tag} ${id}: on screen at the device's aspect ${(w / h).toFixed(4)} (got ${(g.width / g.height).toFixed(4)})`);
      expect(Math.abs(g.coverShare - 1) <= 0.05, `${tag} ${id}: the cover fills the first screen like the Figma (share ${g.coverShare.toFixed(3)})`);
      expect(g.timelineInFirstScreen, `${tag} ${id}: "Timeline • N moments" on the first screen`);
      expect(g.scrollable, `${tag} ${id}: the Storeel scrolls inside the phone`);
      // The whole phone in view (beside the form at 1280: sticky; at 390 once scrolled to).
      await page.getByTestId('storeel-preview').evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(150);
      const pbox = await page.getByTestId('storeel-preview').boundingBox();
      expect(await inView(page, page.getByTestId('storeel-preview')), `${tag} ${id}: the whole phone in the viewport (${JSON.stringify(pbox)})`);
      expect(!(await hasOverflow(page)), `${tag} ${id}: no sideways scroll`);
      await shot(page, `${tag}-03-device-${id}`);
    }
    // Scroll inside the phone: the moment cards come up under the cover.
    await picker(page).selectOption('iphone-15');
    await page.waitForTimeout(250);
    await screen(page).evaluate((el) => el.scrollTo(0, 600));
    await page.waitForTimeout(250);
    expect(await screen(page).evaluate((el) => el.scrollTop) > 0, `${tag}: scrolled inside the phone`);
    await shot(page, `${tag}-04-scrolled-inside`);
    expect(!(await page.getByTestId('storeel-preview').getByRole('button').count()), `${tag}: nothing in the preview is a button`);

    // ── The choice is remembered after a reload ────────────────────────────────────────────────────────────────
    await picker(page).selectOption('pixel-8');
    await page.reload();
    await page.locator('#nl-name').waitFor();
    await page.getByRole('radio', { name: 'Storeel', exact: true }).click();
    await page.getByPlaceholder(STOREEL_TITLE).waitFor();
    await page.waitForTimeout(600);
    expect(await picker(page).inputValue() === 'pixel-8', `${tag}: Pixel 8 remembered after reload (got ${await picker(page).inputValue()})`);
    expect((await phoneGeometry(page)).device === 'pixel-8', `${tag}: the phone is the Pixel 8 after reload`);
    await page.getByTestId('storeel-preview').scrollIntoViewIfNeeded();
    await shot(page, `${tag}-05-remembered-pixel-8`);
    await context.close();
  }
}
