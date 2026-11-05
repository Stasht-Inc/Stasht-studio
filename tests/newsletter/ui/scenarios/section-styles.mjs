// Chris (5 Nov, points 2 and 3): "This needs to be as good or better than other newsletters… right now this is very
// basic." The Title section's Small | Medium | Large pills become one Size dropdown, with Align, Text colour and Section
// background (colour or image); the Text section's toolbar gets Font size (on the selected words, or the whole section
// when nothing is selected), Align, Text colour and Section background. Checked in the real editor at 1280 and 390:
// the controls are in view, the preview shows each choice, and the saved payload carries exactly the new keys.
// NL5_PAYLOAD=<file>: the final saved blocks are written there, to render the real email from them.
import { writeFileSync } from 'fs';
import { createMockApi, newsletter } from '../mock-api.mjs';

const PHOTO = 'https://127.0.0.1/nl-design/showroom.svg';
const SHOWROOM = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ec5ff"/><stop offset="0.6" stop-color="#f4f7fb"/><stop offset="1" stop-color="#d9dde3"/></linearGradient></defs><rect width="1200" height="400" fill="url(#s)"/><rect y="290" width="1200" height="110" fill="#c9ced6"/><g fill="#fff" opacity="0.8"><rect x="80" y="40" width="160" height="230"/><rect x="300" y="40" width="160" height="230"/><rect x="740" y="40" width="160" height="230"/><rect x="960" y="40" width="160" height="230"/></g><path d="M330 300 Q360 220 470 205 L640 195 Q760 195 840 250 L900 262 Q930 270 930 300 Z" fill="#1b2a44"/><circle cx="440" cy="305" r="34" fill="#222"/><circle cx="800" cy="305" r="34" fill="#222"/></svg>`;
const FILE = new URL('../../../../public/pwa-icon-192.png', import.meta.url).pathname;
const OUT = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';

async function serveDrawings(page) {
  await page.route('https://127.0.0.1/nl-design/**', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: SHOWROOM }));
}

async function partShot(locator, file) {
  const path = `${OUT}/section-styles-${file}.png`;
  await locator.screenshot({ path });
  console.log('shot', path);
}

/** The last blocks a PUT saved. */
function savedBlocks(api) {
  const puts = api.state.calls.filter((c) => c.method === 'PUT' && /^\/newsletters\/\d+$/.test(c.path) && c.body && 'blocks' in c.body);
  return puts.length ? puts[puts.length - 1].body.blocks : null;
}

/** All of a toolbar's buttons on one row (nothing wrapped onto a second line). */
async function oneRow(toolbar) {
  const tops = await toolbar.getByRole('button').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  return tops.length > 0 && Math.max(...tops) - Math.min(...tops) <= 2;
}

async function closePanel(page) {
  await page.waitForTimeout(250); // a panel's Escape listener attaches just after it opens
  await page.keyboard.press('Escape');
  await page.locator('[data-radix-popper-content-wrapper]').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
}

/** Two boxes overlap. */
function overlaps(a, b) {
  return !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function inViewport(page, locator) {
  const box = await locator.boundingBox();
  const vp = page.viewportSize();
  return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 0.5 && box.y + box.height <= vp.height + 0.5;
}

/** Select the given words inside an element (a real selection, as a person's drag makes). */
async function selectWords(page, selector, words) {
  await page.evaluate(([sel, w]) => {
    const root = document.querySelector(sel);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.textContent.indexOf(w);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + w.length);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
        return;
      }
    }
    throw new Error(`words not found: ${w}`);
  }, [selector, words]);
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // ---- 1280: Title -------------------------------------------------------------------------------------------------
  let { page, api, context } = await open({ width: 1280, height: 1500, api: createMockApi({ uploadUrl: PHOTO }) });
  await serveDrawings(page);
  const preview = page.locator('aside');
  const until = async (check, label) => {
    for (let i = 0; i < 40; i += 1) {
      const b = savedBlocks(api);
      if (b && check(b)) return b;
      await page.waitForTimeout(150);
    }
    expect(false, `saved: ${label} (got ${JSON.stringify(savedBlocks(api))})`);
    return savedBlocks(api) ?? [];
  };
  await page.locator('#nl-name').fill('Section styles');
  await preview.getByRole('button', { name: 'Add a section at the top' }).click();
  await page.getByRole('menuitem', { name: /^Title/ }).click();
  const title = preview.getByLabel('Title', { exact: true });
  await title.fill('Fall service event');
  const titleFrame = preview.locator('[role="group"][aria-label="Title section"]');
  const titleBar = preview.getByRole('toolbar', { name: 'Title style' });
  await expectVisible(titleBar, 'Title style toolbar');
  expect(await titleBar.getByRole('button', { name: 'Title size: Large' }).count() === 1, 'one Size dropdown (Large by default)');
  expect(await preview.getByRole('radiogroup', { name: 'Title size' }).count() === 0, 'no Small | Medium | Large pills any more');
  for (const name of ['Title size: Large', 'Align: Left', 'Text colour', 'Section background']) {
    expect(await inViewport(page, titleBar.getByRole('button', { name })), `1280: "${name}" is in view`);
  }
  expect(await oneRow(titleBar), '1280: the title toolbar is one row');
  await partShot(titleFrame, '1280-01-title-toolbar');

  // Size: one dropdown.
  await titleBar.getByRole('button', { name: 'Title size: Large' }).click();
  const sizeMenu = page.getByRole('menu', { name: 'Title size' });
  await expectVisible(sizeMenu, 'size choices');
  expect(await inViewport(page, sizeMenu), '1280: size choices in view');
  await partShot(page.locator('[data-radix-popper-content-wrapper]'), '1280-02-title-size-menu');
  await sizeMenu.getByRole('menuitemradio', { name: 'Medium', exact: true }).click();
  let blocks = await until((b) => b[0]?.data?.size === 'medium', 'title size medium');
  expect(await title.evaluate((el) => getComputedStyle(el).fontSize) === '22px', 'preview: medium title is 22 px (the email\'s)');
  expect(await titleBar.getByRole('button', { name: 'Title size: Medium' }).count() === 1, 'the dropdown says Medium');

  // Align.
  await titleBar.getByRole('button', { name: 'Align: Left' }).click();
  await page.getByRole('menu', { name: 'Align' }).getByRole('menuitemradio', { name: 'Centre', exact: true }).click();
  blocks = await until((b) => b[0]?.data?.align === 'center', 'title centred');
  expect(await title.evaluate((el) => getComputedStyle(el).textAlign) === 'center', 'preview: title centred');

  // Text colour, then back to Automatic (the key goes).
  await titleBar.getByRole('button', { name: 'Text colour' }).click();
  let panel = page.locator('[data-radix-popper-content-wrapper]');
  expect(await inViewport(page, panel), '1280: colour panel in view');
  await panel.getByRole('radio', { name: 'Red' }).click();
  blocks = await until((b) => b[0]?.data?.color === '#DC2626', 'title red');
  expect(await title.evaluate((el) => getComputedStyle(el).color) === 'rgb(220, 38, 38)', 'preview: red title');
  await partShot(page.locator('[data-radix-popper-content-wrapper]'), '1280-03-title-colour');
  await panel.getByRole('button', { name: 'Automatic' }).click();
  blocks = await until((b) => !('color' in b[0].data), 'Automatic removes the colour key');
  await closePanel(page);

  // Background colour: the whole section, 24 px of room, dark words on a light tint.
  await titleBar.getByRole('button', { name: 'Section background' }).click();
  panel = page.locator('[data-radix-popper-content-wrapper]');
  await expectVisible(panel.getByRole('radiogroup', { name: 'Section background' }), 'Colour | Image switch (as the header)');
  await expectVisible(panel.getByText('Background colour', { exact: true }), 'Background colour swatches');
  await panel.getByRole('radio', { name: 'Cream' }).click();
  blocks = await until((b) => b[0]?.data?.background_color === '#FEF3C7', 'title cream band');
  expect(await titleFrame.evaluate((el) => getComputedStyle(el).backgroundColor) === 'rgb(254, 243, 199)', 'preview: the whole section is cream');
  expect(await titleFrame.evaluate((el) => getComputedStyle(el).paddingTop) === '24px', 'preview: 24 px above on a band (the email\'s)');
  expect(await title.evaluate((el) => getComputedStyle(el).color) === 'rgb(17, 24, 39)', 'dark words on cream');
  await partShot(page.locator('[data-radix-popper-content-wrapper]'), '1280-04-title-background-colour');
  // On Studio's own purple the selection still shows (a white edge inside the purple line) and so does Done.
  await panel.getByRole('radio', { name: 'Purple', exact: true }).click();
  await until((b) => b[0]?.data?.background_color === '#6C60FF', 'title purple band');
  expect((await titleFrame.evaluate((el) => getComputedStyle(el).boxShadow)).includes('rgb(255, 255, 255)'), 'white edge inside the selection on a band');
  expect((await titleFrame.getByRole('button', { name: 'Done' }).evaluate((el) => getComputedStyle(el).boxShadow)).includes('rgb(255, 255, 255)'), 'Done has a white ring on a band');
  await closePanel(page);
  await partShot(titleFrame, '1280-05a-title-on-purple-selected');
  await titleBar.getByRole('button', { name: 'Section background' }).click();
  panel = page.locator('[data-radix-popper-content-wrapper]');
  await panel.getByRole('radio', { name: 'Black' }).click();
  await until((b) => b[0]?.data?.background_color === '#111827', 'title black band');
  expect(await title.evaluate((el) => getComputedStyle(el).color) === 'rgb(255, 255, 255)', 'white words on black, automatically');

  // Image: upload, the picture behind the words with the dark layer; the colour stays as the fallback.
  await panel.getByRole('radio', { name: 'Image', exact: true }).click();
  await expectVisible(panel.getByRole('button', { name: 'Upload image' }), 'Upload image');
  await expectVisible(panel.getByText('Fallback colour', { exact: true }), 'Fallback colour swatches');
  await expectVisible(panel.getByText('Shown where email apps hide images'), 'fallback hint');
  expect(!('background_image_url' in (savedBlocks(api)[0].data)), 'choosing Image alone saves nothing');
  // (The header has a picture upload of its own: this one is the section's.)
  await titleFrame.locator('input[type="file"]').setInputFiles(FILE);
  blocks = await until((b) => b[0]?.data?.background_image_url === PHOTO, 'title picture');
  expect(blocks[0].data.background_color === '#111827', 'the colour is kept as the fallback');
  expect((await titleFrame.evaluate((el) => getComputedStyle(el).backgroundImage)).includes('showroom.svg'), 'preview: the picture fills the section');
  expect(await titleFrame.locator('[data-nl-shade]').evaluate((el) => getComputedStyle(el).backgroundColor) === 'rgba(17, 24, 39, 0.55)', 'preview: the header\'s dark layer');
  expect(await titleFrame.evaluate((el) => getComputedStyle(el).paddingTop) === '40px', 'preview: 40 px above on a picture');
  expect((await title.evaluate((el) => getComputedStyle(el).textShadow)).includes('rgba(0, 0, 0, 0.5)'), 'soft shadow on the words');
  await expectVisible(panel.getByRole('button', { name: 'Replace image' }), 'Replace image');
  await partShot(page.locator('[data-radix-popper-content-wrapper]'), '1280-05-title-background-image-panel');
  await closePanel(page);
  await partShot(titleFrame, '1280-06-title-on-picture');

  // ---- 1280: Text ------------------------------------------------------------------------------------------------
  await preview.getByRole('button', { name: 'Add a section after section 1' }).click();
  await page.getByRole('menuitem', { name: /^Text/ }).click();
  const text = preview.getByRole('textbox', { name: 'Text' });
  await text.click();
  await page.keyboard.type('Book your winter tire swap this week. Big savings on all brands.');
  const textBar = preview.getByRole('toolbar', { name: 'Text formatting' });
  for (const name of ['Bold', 'Italic', 'Link', 'Font size: Normal', 'Align: Left', 'Text colour', 'Section background']) {
    expect(await inViewport(page, textBar.getByRole('button', { name })), `1280: "${name}" is in view`);
  }
  // Keyboard: the toolbar is one Tab stop; arrow keys move along it.
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Bold', 'Shift+Tab from the words lands on Bold');
  await page.keyboard.press('End');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Section background', 'End moves to Section background');
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Text colour', 'ArrowLeft moves to Text colour');
  await page.keyboard.press('Home');
  await text.click();
  expect(await oneRow(textBar), '1280: the text toolbar is one row');
  const textFrame = preview.locator('[role="group"][aria-label="Text section"]');
  await partShot(textFrame, '1280-07-text-toolbar');

  // Font size on the selected words only.
  const editorSel = 'aside [role="textbox"][aria-label="Text"]';
  await selectWords(page, editorSel, 'Big savings');
  await textBar.getByRole('button', { name: 'Font size: Normal' }).click();
  const fontMenu = page.getByRole('menu', { name: 'Font size' });
  expect(await inViewport(page, fontMenu), '1280: font size choices in view');
  await expectVisible(page.getByText('Select words to size just them; otherwise the whole section.'), 'the font size hint');
  // Arrow keys move through the choices (focus starts on the current one).
  expect(await page.evaluate(() => document.activeElement?.textContent) === 'Normal', 'focus starts on the current size');
  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => document.activeElement?.textContent) === 'Large', 'ArrowDown moves to Large');
  await page.keyboard.press('End');
  expect(await page.evaluate(() => document.activeElement?.textContent) === 'X-Large', 'End moves to X-Large');
  await partShot(page.locator('[data-radix-popper-content-wrapper]'), '1280-08-font-size-menu');
  await fontMenu.getByRole('menuitemradio', { name: 'X-Large', exact: true }).click();
  blocks = await until((b) => b[1]?.data?.html?.includes('<span style="font-size:24px">Big savings</span>'), 'X-Large on the selected words');
  expect(!/font-size:24px">Book/.test(blocks[1].data.html), 'the other words keep their size');
  const big = text.locator('span[style*="font-size"]', { hasText: 'Big savings' });
  expect(await big.evaluate((el) => getComputedStyle(el).fontSize) === '24px', 'preview: the words are 24 px');
  expect(await big.evaluate((el) => getComputedStyle(el).lineHeight) === '34px', 'preview: with the email\'s 34 px line height');
  expect(await textBar.getByRole('button', { name: 'Font size: X-Large' }).count() === 1, 'the button shows the size where the words are');

  // Nothing selected: the whole section (one size, the older one inside goes).
  await page.evaluate((sel) => { const el = document.querySelector(sel); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }, editorSel);
  await textBar.getByRole('button', { name: /^Font size/ }).click();
  await page.getByRole('menu', { name: 'Font size' }).getByRole('menuitemradio', { name: 'Large', exact: true }).click();
  blocks = await until((b) => /^<p><span style="font-size:20px">Book your winter tire swap this week\. Big savings on all brands\.<\/span><\/p>$/.test(b[1]?.data?.html ?? ''), 'Large on the whole section');
  // Normal on the whole section: no size left at all.
  await page.evaluate((sel) => { const el = document.querySelector(sel); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }, editorSel);
  await textBar.getByRole('button', { name: /^Font size/ }).click();
  await page.getByRole('menu', { name: 'Font size' }).getByRole('menuitemradio', { name: 'Normal', exact: true }).click();
  blocks = await until((b) => b[1]?.data?.html === '<p>Book your winter tire swap this week. Big savings on all brands.</p>', 'Normal everywhere: no spans');
  // A word in Large, then one inside it back to Normal (a span inside a span).
  await selectWords(page, editorSel, 'Big savings on all brands.');
  await textBar.getByRole('button', { name: /^Font size/ }).click();
  await page.getByRole('menu', { name: 'Font size' }).getByRole('menuitemradio', { name: 'Large', exact: true }).click();
  await until((b) => b[1]?.data?.html?.includes('<span style="font-size:20px">Big savings on all brands.</span>'), 'Large on a sentence');
  await selectWords(page, editorSel, 'all brands');
  await textBar.getByRole('button', { name: /^Font size/ }).click();
  await page.getByRole('menu', { name: 'Font size' }).getByRole('menuitemradio', { name: 'Normal', exact: true }).click();
  // The browser splits the Large words around them, so they are simply Normal again (no span inside a span).
  blocks = await until((b) => (b[1]?.data?.html ?? '') === '<p>Book your winter tire swap this week. <span style="font-size:20px">Big savings on </span>all brands<span style="font-size:20px">.</span></p>', 'Normal inside Large');
  expect(await text.locator('span[style*="font-size"]', { hasText: 'Big savings' }).evaluate((el) => getComputedStyle(el).fontSize) === '20px', 'preview: the rest stays Large');
  // Bold still works on sized words.
  await selectWords(page, editorSel, 'Big');
  await textBar.getByRole('button', { name: 'Bold' }).click();
  blocks = await until((b) => /<strong>Big<\/strong>/.test(b[1]?.data?.html ?? ''), 'bold inside a size');

  // Undo / redo after a size change (review): always back to the clean html saved before, never <font> or lost words.
  const savedHtml = () => savedBlocks(api)[1].data.html;
  const domHtml = () => text.evaluate((el) => el.innerHTML);
  const steps = [savedHtml()];
  await selectWords(page, editorSel, 'winter tire');
  await textBar.getByRole('button', { name: /^Font size/ }).click();
  await page.getByRole('menu', { name: 'Font size' }).getByRole('menuitemradio', { name: 'X-Large', exact: true }).click();
  await until((b) => b[1]?.data?.html?.includes('<span style="font-size:24px">winter tire</span>'), 'X-Large on "winter tire"');
  steps.push(savedHtml());
  await page.evaluate((sel) => { const el = document.querySelector(sel); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }, editorSel);
  await textBar.getByRole('button', { name: /^Font size/ }).click();
  await page.getByRole('menu', { name: 'Font size' }).getByRole('menuitemradio', { name: 'Small', exact: true }).click();
  await until((b) => /^<p><span style="font-size:14px">/.test(b[1]?.data?.html ?? ''), 'Small on the whole section');
  steps.push(savedHtml());
  await text.focus();
  const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
  for (const [key, want, label] of [[`${MOD}+z`, steps[1], 'undo the whole-section size'], [`${MOD}+z`, steps[0], 'undo the selected-words size'],
    [`${MOD}+Shift+z`, steps[1], 'redo the selected-words size'], [`${MOD}+Shift+z`, steps[2], 'redo the whole-section size'], [`${MOD}+z`, steps[1], 'undo again']]) {
    await page.keyboard.press(key);
    await until((b) => b[1]?.data?.html === want, label);
    const dom = await domHtml();
    expect(!/<font/i.test(dom), `${label}: no <font> in the editor (got ${dom})`);
    expect((await text.innerText()).replace(/\s+/g, ' ').trim() === 'Book your winter tire swap this week. Big savings on all brands.', `${label}: no words lost or doubled`);
  }
  await page.keyboard.press(`${MOD}+Shift+z`);
  await until((b) => b[1]?.data?.html === steps[2], 'back to Small everywhere');

  // Align, colour and background for the whole section.
  await textBar.getByRole('button', { name: 'Align: Left' }).click();
  await page.getByRole('menu', { name: 'Align' }).getByRole('menuitemradio', { name: 'Centre', exact: true }).click();
  await until((b) => b[1]?.data?.align === 'center', 'text centred');
  expect(await text.evaluate((el) => getComputedStyle(el).textAlign) === 'center', 'preview: text centred');
  await textBar.getByRole('button', { name: 'Section background' }).click();
  panel = page.locator('[data-radix-popper-content-wrapper]');
  expect(await panel.getByRole('radiogroup', { name: 'Section background' }).count() === 0, 'no Image choice for text');
  await panel.getByRole('radio', { name: 'Light purple' }).click();
  await until((b) => b[1]?.data?.background_color === '#EEEDFF', 'text light purple band');
  expect(await textFrame.evaluate((el) => getComputedStyle(el).backgroundColor) === 'rgb(238, 237, 255)', 'preview: the whole text section is light purple');
  await expectVisible(panel.getByRole('button', { name: 'No background' }), 'No background');
  await closePanel(page);
  await textBar.getByRole('button', { name: 'Text colour' }).click();
  await page.locator('[data-radix-popper-content-wrapper]').getByRole('radio', { name: 'Green' }).click();
  blocks = await until((b) => b[1]?.data?.color === '#059669', 'text green');
  expect(await text.evaluate((el) => getComputedStyle(el).color) === 'rgb(5, 150, 105)', 'preview: green words');
  // A picked colour that is hard to read on the band gets a small note.
  await page.locator('[data-radix-popper-content-wrapper]').getByRole('radio', { name: 'Orange' }).click();
  await expectVisible(page.locator('[data-nl-contrast-note]'), 'hard-to-read note for orange on light purple');
  await partShot(page.locator('[data-radix-popper-content-wrapper]'), '1280-11-contrast-note');
  await page.locator('[data-radix-popper-content-wrapper]').getByRole('radio', { name: 'Green' }).click();
  await closePanel(page);

  // A third section: text on a dark band, with a link (links take the light colour there).
  await preview.getByRole('button', { name: 'Add a section after section 2' }).click();
  await page.getByRole('menuitem', { name: /^Text/ }).click();
  const dark = preview.getByRole('textbox', { name: 'Text' }).nth(1);
  await dark.click();
  await page.keyboard.type('Questions? Call us any time.');
  const darkBar = preview.getByRole('toolbar', { name: 'Text formatting' });
  await darkBar.getByRole('button', { name: 'Section background' }).click();
  await page.locator('[data-radix-popper-content-wrapper]').getByRole('radio', { name: 'Black' }).click();
  blocks = await until((b) => b[2]?.data?.background_color === '#111827', 'third section black');
  expect(await dark.evaluate((el) => getComputedStyle(el).color) === 'rgb(255, 255, 255)', 'white words on black, automatically');
  await closePanel(page);
  await page.waitForTimeout(300);
  await shot(page, '1280-09-editing');

  // Done: the preview without toolbars, for side-by-side with the rendered email.
  await preview.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(1500);
  blocks = savedBlocks(api);
  const keys = blocks.map((b) => Object.keys(b.data).sort().join(','));
  expect(keys[0] === 'align,background_color,background_image_url,size,text', `title payload keys (got ${keys[0]})`);
  expect(keys[1] === 'align,background_color,color,html', `text payload keys (got ${keys[1]})`);
  expect(keys[2] === 'background_color,html', `dark text payload keys (got ${keys[2]})`);
  console.log('payload', JSON.stringify(blocks));
  if (process.env.NL5_PAYLOAD) writeFileSync(process.env.NL5_PAYLOAD, JSON.stringify(blocks, null, 2));
  const card = preview.locator('div.max-w-\\[600px\\]').first();
  await partShot(card, '1280-10-preview-done');
  expect(!(await hasOverflow(page)), '1280: nothing scrolls sideways');
  await context.close();

  // ---- 390: the same toolbars on a phone --------------------------------------------------------------------------
  ({ page, api, context } = await open({ width: 390, height: 844, api: createMockApi({ uploadUrl: PHOTO }) }));
  await serveDrawings(page);
  await page.locator('#nl-name').fill('Phone styles');
  // On a phone the preview is below the form: its first "+".
  const addTop = page.getByRole('button', { name: 'Add a section at the top' });
  await addTop.scrollIntoViewIfNeeded();
  await addTop.click();
  await page.getByRole('menuitem', { name: /^Title/ }).click();
  const pTitle = page.getByLabel('Title', { exact: true });
  await pTitle.fill('Winter tires');
  const pTitleBar = page.getByRole('toolbar', { name: 'Title style' });
  await pTitleBar.scrollIntoViewIfNeeded();
  for (const name of ['Title size: Large', 'Align: Left', 'Text colour', 'Section background']) {
    expect(await inViewport(page, pTitleBar.getByRole('button', { name })), `390: "${name}" is in view`);
  }
  expect(await oneRow(pTitleBar), '390: the title toolbar is one row');
  await partShot(page.locator('[role="group"][aria-label="Title section"]'), '390-01-title-toolbar');
  await pTitleBar.getByRole('button', { name: 'Section background' }).click();
  panel = page.locator('[data-radix-popper-content-wrapper]');
  expect(await inViewport(page, panel), '390: background panel fits the screen');
  expect(!overlaps(await panel.boundingBox(), await page.locator('[role="group"][aria-label="Title section"]').boundingBox()), '390: the panel leaves the section visible');
  // A light band, then Image: the fallback starts dark (white words read on it where pictures are hidden).
  await panel.getByRole('radio', { name: 'Cream' }).click();
  await until((b) => b[0]?.data?.background_color === '#FEF3C7', '390: cream band');
  await panel.getByRole('radio', { name: 'Image', exact: true }).click();
  await until((b) => !('background_color' in b[0].data), '390: Image after a light band drops it for the dark fallback');
  expect(await panel.locator('[data-nl-fallback-sample]').evaluate((el) => getComputedStyle(el).backgroundColor) === 'rgb(17, 24, 39)', '390: the fallback sample is the dark colour');
  await page.locator('[role="group"][aria-label="Title section"] input[type="file"]').setInputFiles(FILE);
  await until((b) => b[0]?.data?.background_image_url === PHOTO, '390: title picture');
  expect(await inViewport(page, panel), '390: the panel still fits with the picture choices');
  expect(!overlaps(await panel.boundingBox(), await page.locator('[role="group"][aria-label="Title section"]').boundingBox()), '390: still clear of the section with the picture');
  await shot(page, '390-02-title-background-panel');
  await closePanel(page);
  await pTitleBar.getByRole('button', { name: 'Title size: Large' }).click();
  expect(await inViewport(page, page.getByRole('menu', { name: 'Title size' })), '390: size choices fit');
  await closePanel(page);

  await page.getByRole('button', { name: 'Add a section after section 1' }).click();
  await page.getByRole('menuitem', { name: /^Text/ }).click();
  const pText = page.getByRole('textbox', { name: 'Text', exact: true });
  await pText.click();
  await page.keyboard.type('Swap before the first snow.');
  const pTextBar = page.getByRole('toolbar', { name: 'Text formatting' });
  await pTextBar.scrollIntoViewIfNeeded();
  for (const name of ['Bold', 'Italic', 'Link', 'Font size: Normal', 'Align: Left', 'Text colour', 'Section background']) {
    expect(await inViewport(page, pTextBar.getByRole('button', { name })), `390: "${name}" is in view`);
  }
  expect(await oneRow(pTextBar), '390: the text toolbar is one row');
  const a = await pTextBar.boundingBox();
  const b = await page.getByRole('toolbar', { name: 'Text section actions' }).boundingBox();
  expect(a && b && (a.y >= b.y + b.height || a.x + a.width <= b.x), `390: the style toolbar is clear of the move / delete buttons (${JSON.stringify([a, b])})`);
  await selectWords(page, '[role="textbox"][aria-label="Text"]', 'first snow');
  await pTextBar.getByRole('button', { name: 'Font size: Normal' }).click();
  const pFont = page.getByRole('menu', { name: 'Font size' });
  expect(await inViewport(page, pFont), '390: font size choices fit');
  await pFont.getByRole('menuitemradio', { name: 'Large', exact: true }).click();
  await until((b) => b[1]?.data?.html?.includes('<span style="font-size:20px">first snow</span>'), '390: Large on the words');
  await pTextBar.getByRole('button', { name: 'Text colour' }).click();
  expect(await inViewport(page, page.locator('[data-radix-popper-content-wrapper]')), '390: colour panel fits');
  await closePanel(page);
  await partShot(page.locator('[role="group"][aria-label="Text section"]'), '390-03-text-toolbar');
  expect(!(await hasOverflow(page)), '390: nothing scrolls sideways');
  await shot(page, '390-04-page');
  await context.close();

  // ---- An older draft: its sections look and save exactly as before ----------------------------------------------
  const older = newsletter(23, {
    name: 'October Newsletter 2026', subject: 'October deals are here', from_name: 'Serpa Chrysler', reply_to_email: 'sales@serpachrysler.ca',
    blocks: [{ id: 'b1', type: 'title', data: { text: 'This month', size: 'large' } }, { id: 'b2', type: 'text', data: { html: '<p>Hello <strong>there</strong></p>' } }],
  });
  ({ page, api, context } = await open({ width: 1280, height: 1200, query: '&newsletterId=23', api: createMockApi({ newsletters: [older] }) }));
  const oldPreview = page.locator('aside');
  await expectVisible(oldPreview.getByLabel('Title', { exact: true }), 'older draft open');
  expect(await oldPreview.locator('[data-nl-section-bg]').count() === 0, 'no section backgrounds on older sections');
  await oldPreview.getByLabel('Title', { exact: true }).fill('This month, updated');
  await page.waitForTimeout(1800);
  const old = savedBlocks(api);
  expect(old && JSON.stringify(old[0].data) === '{"text":"This month, updated","size":"large"}', `older title saves no new keys (got ${JSON.stringify(old?.[0]?.data)})`);
  expect(old && JSON.stringify(old[1].data) === '{"html":"<p>Hello <strong>there</strong></p>"}', `older text saves no new keys (got ${JSON.stringify(old?.[1]?.data)})`);
  await context.close();
}
