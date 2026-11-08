// Chris, 6 Nov 2026 — the Storeel create / edit page.
// Point 1: the reason / error line above the actions reads like an error: "*Add a campaign title" (asterisk, no full
//   stop), red, left-aligned, in the middle of the gap between the Send card and the buttons — every reason there.
// Point 2: the live preview is a real phone screen built to his Figma "Story Details - Cover": the chosen device's
//   aspect ratio (iPhone 15 by default; SE, 15 Pro Max, Pixel 8 in a small picker), scaled to fit the panel, the cover
//   filling the first screen (the Figma's 852 of 852 pt), the page scrolling inside the phone; the choice remembered.
// At 1280 and 390. node tests/newsletter/ui/check.mjs storeel-phone-preview   (NL_BASE = the dev server)
import { readFileSync } from 'fs';
import sharp from 'sharp';
import { createMockApi } from '../mock-api.mjs';

const STOREEL_TITLE = 'Give your campaign a meaningful title';
const PNG = readFileSync(new URL('../../../../public/pwa-icon-512.png', import.meta.url));
const RED_600 = 'rgb(220, 38, 38)';
// Chris's Figma "Story Details - Cover" (an 852 pt tall first screen): the cover ends at 852, the Continue chip's
// bottom is at 690, the pills' top at 500 and the first moment card's top at 767 (measured from the PDF).
const FIGMA = { screen: 852, cover: 852, continueBottom: 690, pillsTop: 500, cardTop: 767 };
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

/** The phone screen's size on the page, and where the cover's pieces sit in it, in the phone's own CSS px. */
async function phoneGeometry(page) {
  return page.evaluate(() => {
    const scr = document.querySelector('[data-testid="storeel-preview-screen"]');
    const phone = document.querySelector('[data-testid="storeel-preview"]');
    const cover = document.querySelector('[data-testid="storeel-preview-cover"]');
    const r = scr.getBoundingClientRect();
    const k = r.width / scr.offsetWidth; // the phone's scale on the page
    const y = (el) => (el ? { top: (el.getBoundingClientRect().top - r.top + scr.scrollTop * k) / k, bottom: (el.getBoundingClientRect().bottom - r.top + scr.scrollTop * k) / k } : null);
    const timeline = [...cover.querySelectorAll('p')].find((p) => p.textContent.startsWith('Timeline'));
    const cont = [...cover.querySelectorAll('span, button')].find((el) => el.textContent === 'Continue');
    const pills = document.querySelector('[data-testid="storeel-preview-category"]');
    const firstCard = document.querySelector('[data-testid="storeel-preview-moments"] > li');
    return {
      device: phone.getAttribute('data-device'), width: r.width, height: r.height, scale: k,
      cssWidth: scr.offsetWidth, cssHeight: scr.offsetHeight,
      cover: y(cover), timeline: y(timeline), cont: y(cont), pills: y(pills), card: y(firstCard),
      scrollable: scr.scrollHeight > scr.clientHeight,
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
    // Review: no title yet → no title row (no empty band with a lone ⋮), as the old preview.
    expect(!(await page.getByTestId('storeel-preview-title').count()), `${tag}: no title row on the cover before a title is typed`);
    // Review: the phone's scroll area is reachable by keyboard and named; the decorative counts are hidden from readers.
    expect(await screen(page).getAttribute('tabindex') === '0' && Boolean(await screen(page).getAttribute('aria-label')), `${tag}: the phone's scroll area is focusable and labelled`);
    expect(await page.getByTestId('storeel-preview').evaluate((el) => [...el.querySelectorAll('.lucide-heart, .lucide-message-square')].every((i) => i.closest('[aria-hidden="true"]'))),
      `${tag}: like / comment counts hidden from screen readers`);
    // Review: the picker is compact on desktop and a real touch target on phones.
    const pk = await picker(page).boundingBox();
    expect(pk && pk.width <= 152 && (width < 640 ? pk.height >= 44 : pk.height <= 30), `${tag}: the phone picker is compact / touch-sized (${JSON.stringify(pk)})`);

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
    // Chris, 8 Nov 2026: Add a Moment opens the Add Widget chooser; Moment opens Add a Moment.
    await page.getByTestId('add-widget-chooser').getByRole('menuitem', { name: /^Moment/ }).click();
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
    // Review: a long category ends in "…" inside its pill.
    const ell = await page.getByTestId('storeel-preview-category').evaluate((pill) => {
      const inner = pill.querySelector('span');
      inner.textContent = 'Spring Open House Collection 2026 and more';
      const st = getComputedStyle(inner);
      return { ellipsis: st.textOverflow === 'ellipsis', cut: inner.scrollWidth > inner.clientWidth, fits: pill.getBoundingClientRect().right <= pill.parentElement.getBoundingClientRect().right };
    });
    expect(ell.ellipsis && ell.cut && ell.fits, `${tag}: a long category is cut with an ellipsis (${JSON.stringify(ell)})`);
    // Review: an ordinary 640x400 cover photo still fills the cover (only genuinely small pictures are contained).
    const mid = await sharp({ create: { width: 640, height: 400, channels: 3, background: '#0EA5E9' } }).jpeg().toBuffer();
    await page.getByTestId('cover-photo-input').setInputFiles({ name: 'mid.jpg', mimeType: 'image/jpeg', buffer: mid });
    await page.waitForTimeout(900);
    expect(await page.getByTestId('storeel-preview-cover').locator('[data-cover-mode]').first().getAttribute('data-cover-mode') === 'cover', `${tag}: a 640×400 cover photo fills the cover`);
    const tiny = await sharp({ create: { width: 120, height: 120, channels: 3, background: '#22C55E' } }).png().toBuffer();
    await page.getByTestId('cover-photo-input').setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: tiny });
    await page.waitForTimeout(900);
    expect(await page.getByTestId('storeel-preview-cover').locator('[data-cover-mode]').first().getAttribute('data-cover-mode') === 'small', `${tag}: a 120×120 picture is shown whole (contained)`);
    await page.getByTestId('cover-photo-input').setInputFiles({ name: 'mid.jpg', mimeType: 'image/jpeg', buffer: mid });
    await page.waitForTimeout(900);
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
      // Against the Figma (not by construction): the cover fills the first screen and the pills / Continue / first
      // card sit where the PDF has them — as shares of the screen on iPhone 15 (the PDF's phone), and at the same
      // distance from the bottom of the first screen on the others (the design keeps the details at the cover's foot).
      expect(g.cover && Math.abs(g.cover.bottom - h) <= 1 && Math.abs(g.cover.top) <= 1, `${tag} ${id}: the cover fills the first screen (cover ${JSON.stringify(g.cover)})`);
      const at = (v) => (v == null ? NaN : v);
      if (id === 'iphone-15') {
        for (const [name, got, want] of [['cover', at(g.cover?.bottom), FIGMA.cover], ['Continue', at(g.cont?.bottom), FIGMA.continueBottom], ['pills', at(g.pills?.top), FIGMA.pillsTop], ['first card', at(g.card?.top), FIGMA.cardTop]]) {
          expect(Math.abs(got / h - want / FIGMA.screen) <= 0.02, `${tag} ${id}: ${name} at ${(got / h).toFixed(3)} of the screen, Figma ${(want / FIGMA.screen).toFixed(3)}`);
        }
      }
      for (const [name, got, want] of [['Continue', at(g.cont?.bottom), FIGMA.continueBottom], ['pills', at(g.pills?.top), FIGMA.pillsTop], ['first card', at(g.card?.top), FIGMA.cardTop]]) {
        expect(Math.abs((h - got) - (FIGMA.screen - want)) <= 6, `${tag} ${id}: ${name} ${(h - got).toFixed(1)} px above the screen's foot, Figma ${FIGMA.screen - want}`);
      }
      expect(g.timeline && g.timeline.bottom <= h, `${tag} ${id}: "Timeline • N moments" on the first screen`);
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
    // Chris, 7 Nov 2026 (point 6): the preview's controls are real buttons now, each with a name (storeel-preview-controls).
    expect(await page.getByTestId('storeel-preview').getByRole('button').evaluateAll((bs) => bs.length > 0 && bs.every((b) => (b.getAttribute('aria-label') || b.textContent || '').trim())), `${tag}: the preview's controls are named buttons`);

    // ── A resized window: the phone follows (smaller when the window is shorter / narrower), still whole and in view ─
    const before = await phoneGeometry(page);
    const smaller = width >= 1024 ? { width, height: 640 } : { width: 360, height: 700 };
    await page.setViewportSize(smaller);
    await page.waitForTimeout(400);
    await page.getByTestId('storeel-preview').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    const after = await phoneGeometry(page);
    expect(after.scale < before.scale - 0.01, `${tag}: after resizing to ${smaller.width}×${smaller.height} the phone is smaller (scale ${before.scale.toFixed(3)} → ${after.scale.toFixed(3)})`);
    expect(Math.abs(after.width / after.height - 393 / 852) < 0.005, `${tag}: still the iPhone 15's shape after the resize`);
    expect(await inView(page, page.getByTestId('storeel-preview')) && !(await hasOverflow(page)), `${tag}: the whole phone in view, no sideways scroll after the resize`);
    await shot(page, `${tag}-04b-resized-${smaller.width}x${smaller.height}`);
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(400);
    expect(Math.abs((await phoneGeometry(page)).scale - before.scale) < 0.01, `${tag}: back to the first size when the window is restored`);

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
