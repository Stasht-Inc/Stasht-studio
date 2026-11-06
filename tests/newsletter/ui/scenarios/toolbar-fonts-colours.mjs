// Chris (6 Nov, points 3 and 4). 3a: B / I / link show a pressed state for the words at the caret; a Title is bold by
// default (B pressed) and B turns that off and on (bold: false). 3b: a Font dropdown in the Title and Text toolbars,
// each choice drawn in its font; Text: the selected words, or the whole section when nothing is selected (undo/redo
// clean); Title: the whole title. 4a: "Custom" opens Studio's own picker with a HEX field shown first (typing a hex
// applies it). 4b: a colour picked there shows up as a recent colour in every colour panel, also after a reload.
// Checked in the real editor at 1280 and 390, with the key controls in the viewport.
import { writeFileSync } from 'fs';
import { createMockApi, newsletter } from '../mock-api.mjs';

const OUT = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
const GEORGIA = "Georgia, 'Times New Roman', Times, serif";
const COURIER = "'Courier New', Courier, monospace";

async function partShot(locator, file) {
  const path = `${OUT}/toolbar-fonts-colours-${file}.png`;
  await locator.screenshot({ path });
  console.log('shot', path);
}

function savedBlocks(api) {
  const puts = api.state.calls.filter((c) => c.method === 'PUT' && /^\/newsletters\/\d+$/.test(c.path) && c.body && 'blocks' in c.body);
  return puts.length ? puts[puts.length - 1].body.blocks : null;
}

async function oneRow(toolbar) {
  const tops = await toolbar.getByRole('button').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  return tops.length > 0 && Math.max(...tops) - Math.min(...tops) <= 2;
}

async function inViewport(page, locator) {
  const box = await locator.boundingBox();
  const vp = page.viewportSize();
  return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 0.5 && box.y + box.height <= vp.height + 0.5;
}

async function closePanel(page) {
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
}

async function closeAllPanels(page) {
  for (let i = 0; i < 3 && (await page.locator('[data-radix-popper-content-wrapper]').count()); i += 1) await closePanel(page);
}

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

/** Put the caret inside the given words (collapsed), as a click there would. */
async function caretIn(page, selector, words) {
  await page.evaluate(([sel, w]) => {
    const root = document.querySelector(sel);
    root.focus();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.textContent.indexOf(w);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(node, i + 1);
        r.collapse(true);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
        return;
      }
    }
    throw new Error(`words not found: ${w}`);
  }, [selector, words]);
  await page.waitForTimeout(100);
}

/** The caret right after the given words. */
async function caretAfter(page, selector, words) {
  await page.evaluate(([sel, w]) => {
    const root = document.querySelector(sel);
    root.focus();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.textContent.indexOf(w);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(node, i + w.length);
        r.collapse(true);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
        return;
      }
    }
    throw new Error(`words not found: ${w}`);
  }, [selector, words]);
  await page.waitForTimeout(100);
}

function overlaps(a, b) {
  return !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function caretAtEnd(page, selector) {
  await page.evaluate((sel) => { const el = document.querySelector(sel); el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }, selector);
  await page.waitForTimeout(100);
}

const pressed = (locator) => locator.getAttribute('aria-pressed');

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const width of [1280, 390]) {
    const phone = width < 640;
    const api = createMockApi();
    const { page, context } = await open({ width, height: phone ? 844 : 1300, api });
    const scope = phone ? page : page.locator('aside');
    const until = async (check, label) => {
      for (let i = 0; i < 40; i += 1) {
        const b = savedBlocks(api);
        if (b && check(b)) return b;
        await page.waitForTimeout(150);
      }
      expect(false, `${width}: saved: ${label} (got ${JSON.stringify(savedBlocks(api))})`);
      return savedBlocks(api) ?? [];
    };
    await page.locator('#nl-name').fill('Fonts and colours');
    const addTop = scope.getByRole('button', { name: 'Add a section at the top' });
    await addTop.scrollIntoViewIfNeeded();
    await addTop.click();
    await page.getByRole('menuitem', { name: /^Title/ }).click();
    const title = scope.getByLabel('Title', { exact: true });
    await title.fill('Leadership in a New Era!');
    const titleFrame = scope.locator('[role="group"][aria-label="Title section"]');
    const titleBar = scope.getByRole('toolbar', { name: 'Title style' });
    await titleBar.scrollIntoViewIfNeeded();

    // ---- 3a: Title is bold by default, B pressed; B toggles it ------------------------------------------------------
    const titleB = titleBar.getByRole('button', { name: 'Bold' });
    for (const name of ['Bold', 'Font: Default', 'Title size: Large', 'Align: Left', 'Text colour', 'Section background']) {
      expect(await inViewport(page, titleBar.getByRole('button', { name })), `${width}: title "${name}" is in view`);
    }
    expect(await oneRow(titleBar), `${width}: the title toolbar is one row`);
    expect(await pressed(titleB) === 'true', `${width}: B is pressed on a title (bold by default)`);
    expect(await title.evaluate((el) => getComputedStyle(el).fontWeight) === '700', `${width}: the title is bold`);
    await partShot(titleFrame, `${width}-01-title-bold-pressed`);
    await titleB.click();
    let blocks = await until((b) => b[0]?.data?.bold === false, 'title bold off');
    expect(await pressed(titleB) === 'false', `${width}: B no longer pressed`);
    expect(await title.evaluate((el) => getComputedStyle(el).fontWeight) === '400', `${width}: preview: normal weight`);
    await partShot(titleFrame, `${width}-02-title-bold-off`);
    await titleB.click();
    blocks = await until((b) => !('bold' in b[0].data), 'title bold back on (key removed)');
    expect(await pressed(titleB) === 'true', `${width}: B pressed again`);

    // ---- 3b: Title font ---------------------------------------------------------------------------------------------
    await titleBar.getByRole('button', { name: 'Font: Default' }).click();
    const fontMenu = page.getByRole('menu', { name: 'Font' });
    await expectVisible(fontMenu, 'font choices');
    expect(await inViewport(page, fontMenu), `${width}: font choices in view`);
    const choices = await fontMenu.getByRole('menuitemradio').evaluateAll((els) => els.map((el) => [el.textContent.trim(), getComputedStyle(el.querySelector('span')).fontFamily]));
    expect(JSON.stringify(choices.map((c) => c[0])) === JSON.stringify(['Default', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana', 'Trebuchet MS', 'Tahoma', 'Courier New']), `${width}: the fonts offered (got ${JSON.stringify(choices.map((c) => c[0]))})`);
    expect(choices.find((c) => c[0] === 'Georgia')?.[1].startsWith('Georgia'), `${width}: each choice is drawn in its own font (${choices.find((c) => c[0] === 'Georgia')?.[1]})`);
    await partShot(page.locator('[data-radix-popper-content-wrapper]'), `${width}-03-font-menu`);
    await fontMenu.getByRole('menuitemradio', { name: 'Times New Roman' }).click();
    blocks = await until((b) => b[0]?.data?.font === 'times', 'title font Times New Roman');
    expect((await title.evaluate((el) => getComputedStyle(el).fontFamily)).startsWith('"Times New Roman"'), `${width}: preview: the title is in Times New Roman`);
    expect(await titleBar.getByRole('button', { name: 'Font: Times New Roman' }).count() === 1, `${width}: the Font button names it`);
    await partShot(titleFrame, `${width}-04-title-times`);

    // ---- 3a/3b: Text section ----------------------------------------------------------------------------------------
    await scope.getByRole('button', { name: 'Add a section after section 1' }).click();
    await page.getByRole('menuitem', { name: /^Text/ }).click();
    const text = scope.getByRole('textbox', { name: 'Text', exact: true });
    await text.click();
    await page.keyboard.type('Book your winter tire swap this week. Big savings on all brands.');
    const sel = phone ? '[role="textbox"][aria-label="Text"]' : 'aside [role="textbox"][aria-label="Text"]';
    const textBar = scope.getByRole('toolbar', { name: 'Text formatting' });
    const B = textBar.getByRole('button', { name: 'Bold' });
    const I = textBar.getByRole('button', { name: 'Italic' });
    const L = textBar.getByRole('button', { name: 'Link' });
    for (const name of ['Bold', 'Italic', 'Link', 'Font: Default', 'Font size: Normal', 'Align: Left', 'Text colour', 'Section background']) {
      expect(await inViewport(page, textBar.getByRole('button', { name })), `${width}: text "${name}" is in view`);
    }
    expect(await oneRow(textBar), `${width}: the text toolbar is one row`);
    expect(await pressed(B) === 'false' && await pressed(I) === 'false' && await pressed(L) === 'false', `${width}: nothing pressed on plain words`);
    await selectWords(page, sel, 'Big savings');
    await B.click();
    await until((b) => /<strong>Big savings<\/strong>/.test(b[1]?.data?.html ?? ''), 'bold words');
    expect(await pressed(B) === 'true', `${width}: B pressed after bolding the selection`);
    await caretIn(page, sel, 'swap');
    expect(await pressed(B) === 'false', `${width}: B not pressed with the caret in plain words`);
    await caretIn(page, sel, 'savings');
    expect(await pressed(B) === 'true', `${width}: B pressed with the caret in bold words`);
    await partShot(scope.locator('[role="group"][aria-label="Text section"]'), `${width}-05-text-bold-pressed`);
    // Ctrl/Cmd+I with a caret: the next words typed are italic, and I shows it straight away.
    const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
    await caretAtEnd(page, sel);
    await page.keyboard.press(`${MOD}+i`);
    await page.waitForTimeout(150);
    expect(await pressed(I) === 'true', `${width}: I pressed after Cmd+I with a caret`);
    await page.keyboard.type(' Now');
    await until((b) => /<em>\s?Now<\/em>/.test(b[1]?.data?.html ?? ''), 'italic typed words');
    await caretIn(page, sel, 'Now');
    expect(await pressed(I) === 'true', `${width}: I pressed in italic words`);
    // Link: pressed inside linked words.
    await selectWords(page, sel, 'winter tire');
    await L.click();
    await page.locator(`input[id$="-link"]`).fill('https://serpachrysler.ca/tires');
    await page.getByRole('button', { name: 'Add link' }).click();
    await until((b) => /<a href="https:\/\/serpachrysler.ca\/tires">winter tire<\/a>/.test(b[1]?.data?.html ?? ''), 'linked words');
    await caretIn(page, sel, 'tire');
    expect(await pressed(L) === 'true', `${width}: Link pressed in linked words`);
    await caretIn(page, sel, 'Book');
    expect(await pressed(L) === 'false', `${width}: Link not pressed outside`);
    // Review (6 Nov): right after the link (typing there is not linked) Link is not pressed.
    await caretAfter(page, sel, 'winter tire');
    expect(await pressed(L) === 'false', `${width}: Link not pressed with the caret just after the link`);

    // Font on selected words only.
    await selectWords(page, sel, 'this week');
    await textBar.getByRole('button', { name: 'Font: Default' }).click();
    await expectVisible(page.getByText('Select words to change just them; otherwise the whole section.'), 'the font hint');
    await page.getByRole('menu', { name: 'Font' }).getByRole('menuitemradio', { name: 'Georgia' }).click();
    blocks = await until((b) => b[1]?.data?.html?.includes(`<span style="font-family:${GEORGIA}">this week</span>`), 'Georgia on the selected words');
    const serif = text.locator('span[style*="font-family"]', { hasText: 'this week' });
    expect((await serif.evaluate((el) => getComputedStyle(el).fontFamily)).startsWith('Georgia'), `${width}: preview: the words are in Georgia`);
    expect(await textBar.getByRole('button', { name: 'Font: Georgia' }).count() === 1, `${width}: the Font button shows the font where the words are`);
    expect(!/font-family/.test(blocks[1].data.html.replace(/<span style="font-family:[^"]*">this week<\/span>/, '')), `${width}: the other words keep the usual font`);
    await caretIn(page, sel, 'Book');
    expect(await textBar.getByRole('button', { name: 'Font: Default' }).count() === 1, `${width}: Default with the caret in other words`);
    await partShot(scope.locator('[role="group"][aria-label="Text section"]'), `${width}-06-text-georgia-words`);

    // Nothing selected: the whole section; then undo / redo.
    const before = savedBlocks(api)[1].data.html;
    await caretAtEnd(page, sel);
    await textBar.getByRole('button', { name: /^Font:/ }).click();
    await page.getByRole('menu', { name: 'Font' }).getByRole('menuitemradio', { name: 'Courier New' }).click();
    blocks = await until((b) => (b[1]?.data?.html ?? '').startsWith(`<p><span style="font-family:${COURIER}">Book `), 'Courier New on the whole section');
    const whole = blocks[1].data.html;
    expect(!whole.includes('Georgia'), `${width}: the whole section is one font (the Georgia words too)`);
    expect(/<strong>Big savings<\/strong>/.test(whole) && /<a href=/.test(whole), `${width}: bold and links kept`);
    expect((await text.evaluate((el) => getComputedStyle(el.querySelector('span')).fontFamily)).startsWith('"Courier New"'), `${width}: preview: Courier New`);
    await text.focus();
    await page.keyboard.press(`${MOD}+z`);
    await until((b) => b[1]?.data?.html === before, 'undo the whole-section font');
    expect(!/<font/i.test(await text.evaluate((el) => el.innerHTML)), `${width}: no <font> after undo`);
    await page.keyboard.press(`${MOD}+Shift+z`);
    await until((b) => b[1]?.data?.html === whole, 'redo the whole-section font');
    expect((await text.innerText()).replace(/\s+/g, ' ').trim() === 'Book your winter tire swap this week. Big savings on all brands. Now', `${width}: no words lost or doubled`);

    // ---- 4a: Custom opens Studio's picker, HEX first; typing a hex applies it ----------------------------------------
    await titleFrame.click({ position: { x: 5, y: 5 } });
    await titleBar.scrollIntoViewIfNeeded();
    await titleBar.getByRole('button', { name: 'Text colour' }).click();
    const panel = page.locator('[data-radix-popper-content-wrapper]').first();
    expect(await page.locator('input[type="color"]').count() === 0, `${width}: no browser colour input any more`);
    await panel.getByRole('button', { name: 'Text colour: custom colour' }).click();
    const picker = page.locator('[data-nl-color-picker]');
    await expectVisible(picker, 'the colour picker');
    const hex = picker.getByRole('textbox', { name: 'HEX colour' });
    await expectVisible(hex, 'the HEX field, shown by default');
    expect(await hex.evaluate((el) => document.activeElement === el), `${width}: the HEX field has focus`);
    expect(/^#[0-9A-F]{6}$/.test(await hex.inputValue()), `${width}: HEX value shown (${await hex.inputValue()})`);
    expect(await inViewport(page, picker), `${width}: the picker is in view`);
    expect(!overlaps(await picker.boundingBox(), await panel.boundingBox()), `${width}: the picker leaves the colour panel visible (${JSON.stringify([await picker.boundingBox(), await panel.boundingBox()])})`);
    const hasDropper = await page.evaluate(() => 'EyeDropper' in window);
    expect(await picker.getByRole('button', { name: 'Pick a colour from the screen' }).count() === (hasDropper ? 1 : 0), `${width}: eyedropper only where the browser has one (${hasDropper})`);
    await shot(page, `${width}-07-picker`);
    await partShot(picker, `${width}-07b-picker`);
    // An invalid value applies nothing; it is called out only on leaving the field (or Enter), not while typing.
    await hex.fill('#12');
    await page.waitForTimeout(150);
    expect(await picker.getByRole('alert').count() === 0, `${width}: no error while typing`);
    expect(await hex.getAttribute('aria-invalid') === 'false', `${width}: not marked invalid while typing`);
    await hex.press('Tab');
    await expectVisible(picker.getByText('Use a colour like #6C60FF or #FFF.'), 'invalid hex note on leaving the field');
    expect(await hex.getAttribute('aria-invalid') === 'true', `${width}: marked invalid after leaving the field`);
    expect(!('color' in (savedBlocks(api)[0].data)), `${width}: an invalid hex applies nothing`);
    // #FFF shorthand expands when the field is left.
    await hex.fill('#FFF');
    expect(await picker.getByRole('alert').count() === 0, `${width}: typing again clears the error`);
    await hex.press('Tab');
    await until((b) => b[0]?.data?.color === '#FFFFFF', 'shorthand #FFF expanded and applied');
    expect(await hex.inputValue() === '#FFFFFF', `${width}: the field shows the full value`);
    // A pasted value with spaces around it works whole.
    await hex.fill(' #DC2626 ');
    await until((b) => b[0]?.data?.color === '#DC2626', 'pasted hex with spaces applied');
    // Without the # works too.
    await hex.fill('1f6f8b');
    blocks = await until((b) => b[0]?.data?.color === '#1F6F8B', 'typed hex applied');
    expect(await title.evaluate((el) => getComputedStyle(el).color) === 'rgb(31, 111, 139)', `${width}: preview: the typed colour`);
    // Keyboard on the hue strip changes the colour.
    await picker.getByRole('slider', { name: 'Hue' }).focus();
    await page.keyboard.press('Shift+ArrowRight');
    blocks = await until((b) => b[0]?.data?.color && b[0].data.color !== '#1F6F8B', 'hue arrow key changes the colour');
    await hex.fill('#1F6F8B');
    await until((b) => b[0]?.data?.color === '#1F6F8B', 'back to the typed hex');
    await hex.press('Enter');
    await page.waitForTimeout(300);
    expect(await picker.count() === 0, `${width}: Enter closes the picker`);
    // 4b: it is now a recent colour, in this panel...
    const recentHere = panel.getByRole('radio', { name: 'Recent colour #1F6F8B' });
    await expectVisible(recentHere, 'the recent colour in the same panel');
    expect(await recentHere.getAttribute('aria-checked') === 'true', `${width}: and it is the one picked`);
    expect(api.state.calls.some((c) => c.method === 'PUT' && c.path === '/newsletter-brand' && c.body?.recent_color === '#1F6F8B'), `${width}: saved for the account`);
    await partShot(panel, `${width}-08-recent-in-text-colour`);
    // Escape closes only the picker (the panel stays); opened and closed without a change, nothing is saved.
    const brandPuts = () => api.state.calls.filter((c) => c.method === 'PUT' && c.path === '/newsletter-brand').length;
    const putsBefore = brandPuts();
    await panel.getByRole('button', { name: 'Text colour: custom colour' }).click();
    await expectVisible(picker, 'the picker again');
    await closePanel(page);
    expect(await picker.count() === 0, `${width}: Escape closes the picker`);
    expect(await panel.getByText('Text colour', { exact: true }).isVisible(), `${width}: the colour panel stays open`);
    expect(brandPuts() === putsBefore, `${width}: no recent colour saved when nothing changed`);
    // Re-review (N2): dragging the colour area clears a HEX error; a click outside the picker commits a typed #ABC
    // (expanded) and keeps it as a recent colour, as Enter does.
    await panel.getByRole('button', { name: 'Text colour: custom colour' }).click();
    await picker.getByRole('textbox', { name: 'HEX colour' }).fill('#12');
    await picker.getByRole('textbox', { name: 'HEX colour' }).press('Tab');
    await expectVisible(picker.getByRole('alert'), 'the HEX error');
    await picker.locator('[data-nl-color-area]').click({ position: { x: 30, y: 30 } });
    await page.waitForTimeout(150);
    expect(await picker.getByRole('alert').count() === 0, `${width}: dragging the colour area clears the HEX error`);
    expect(await picker.getByRole('textbox', { name: 'HEX colour' }).getAttribute('aria-invalid') === 'false', `${width}: and the field is no longer marked invalid`);
    await picker.getByRole('textbox', { name: 'HEX colour' }).fill('#ABC');
    await panel.getByText('Text colour', { exact: true }).click();
    await page.waitForTimeout(300);
    expect(await picker.count() === 0, `${width}: a click outside closes the picker`);
    await until((b) => b[0]?.data?.color === '#AABBCC', 'a typed #ABC committed by a click outside');
    await expectVisible(panel.getByRole('radio', { name: 'Recent colour #AABBCC' }), 'the committed colour as a recent colour');
    expect(api.state.calls.some((c) => c.method === 'PUT' && c.path === '/newsletter-brand' && c.body?.recent_color === '#AABBCC'), `${width}: saved for the account`);
    await closeAllPanels(page);

    // ...in the Text section's background panel...
    await text.click();
    await textBar.getByRole('button', { name: 'Section background' }).click();
    const bgPanel = page.locator('[data-radix-popper-content-wrapper]').first();
    // Review (6 Nov): with no background yet, typing the default purple applies it (it is not "unchanged").
    await bgPanel.getByRole('button', { name: 'Background colour: custom colour' }).click();
    await picker.getByRole('textbox', { name: 'HEX colour' }).fill('6C60FF');
    await until((b) => b[1]?.data?.background_color === '#6C60FF', 'the default purple typed on an unset background applies');
    await picker.getByRole('textbox', { name: 'HEX colour' }).press('Enter');
    await page.waitForTimeout(200);
    const recentBg = bgPanel.getByRole('radio', { name: 'Recent colour #1F6F8B' });
    await expectVisible(recentBg, 'the recent colour in another panel (section background)');
    expect(await inViewport(page, bgPanel), `${width}: background panel in view`);
    await partShot(bgPanel, `${width}-09-recent-in-background`);
    await recentBg.click();
    await until((b) => b[1]?.data?.background_color === '#1F6F8B', 'recent colour applied as a background');
    await closeAllPanels(page);

    // ...in the Button section's colour (review, 6 Nov: exercised, not just shared code).
    await scope.getByRole('button', { name: 'Add a section after section 2' }).click();
    await page.getByRole('menuitem', { name: /^Button/ }).click();
    const buttonFrame = scope.locator('[role="group"][aria-label="Button section"]');
    await buttonFrame.scrollIntoViewIfNeeded();
    await expectVisible(buttonFrame.getByRole('radio', { name: 'Recent colour #1F6F8B' }), 'the recent colour in the Button colour');
    await buttonFrame.getByRole('button', { name: 'Button colour: custom colour' }).click();
    await expectVisible(picker, 'the picker from the Button colour');
    expect(await inViewport(page, picker), `${width}: Button colour picker in view`);
    const swatchRow = buttonFrame.getByRole('radiogroup', { name: 'Button colour: recent colours' });
    expect(!overlaps(await picker.boundingBox(), await swatchRow.boundingBox()), `${width}: the picker leaves the Button's colours visible`);
    await shot(page, `${width}-09b-button-picker`);
    await closeAllPanels(page);

    // ...and in the header's background colours.
    const header = scope.locator('[data-nl-header]');
    await header.scrollIntoViewIfNeeded();
    await header.click({ position: { x: 10, y: 10 } });
    await expectVisible(page.getByRole('radio', { name: 'Recent colour #1F6F8B' }), 'the recent colour in the header panel');
    await partShot(header, `${width}-10-recent-in-header`);
    expect(!(await hasOverflow(page)), `${width}: nothing scrolls sideways`);

    // NLA_PAYLOAD=<file>: the blocks saved at 1280, to render the real email from them.
    if (process.env.NLA_PAYLOAD && !phone) writeFileSync(process.env.NLA_PAYLOAD, JSON.stringify(savedBlocks(api), null, 2));
    await header.getByRole('button', { name: 'Done' }).click();
    await page.waitForTimeout(1200);
    await partShot(scope.locator('div.max-w-\\[600px\\]').first(), `${width}-10b-preview-done`);

    // After a reload (the brand comes back from the API): still there.
    const nlId = api.state.newsletters[0]?.id;
    await page.goto(page.url().replace(/&newsletterId=\d+/, '') + `&newsletterId=${nlId}`);
    const scope2 = phone ? page : page.locator('aside');
    await expectVisible(scope2.getByLabel('Title', { exact: true }), 'reopened draft');
    const t2 = scope2.getByLabel('Title', { exact: true });
    expect((await t2.evaluate((el) => getComputedStyle(el).fontFamily)).startsWith('"Times New Roman"'), `${width}: the title font is kept after reopening`);
    await t2.click();
    await scope2.getByRole('toolbar', { name: 'Title style' }).getByRole('button', { name: 'Section background' }).click();
    await expectVisible(page.locator('[data-radix-popper-content-wrapper]').getByRole('radio', { name: 'Recent colour #1F6F8B' }), 'the recent colour after a reload');
    await shot(page, `${width}-11-after-reload`);
    await context.close();
  }

  // ---- Review (6 Nov): the picker at 768 and 1024 (Title colour panel and Button colour), and on a touch screen ---------
  for (const width of [768, 1024, 390]) {
    const touch = width === 390;
    const api = createMockApi({ recentColors: ['#1F6F8B'] });
    const { page, context } = await open({ width, height: touch ? 844 : 1000, api });
    if (touch) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await page.reload();
    }
    const scope = width < 1024 ? page : page.locator('aside');
    await page.locator('#nl-name').fill('Picker sizes');
    const addTop = scope.getByRole('button', { name: 'Add a section at the top' });
    await addTop.scrollIntoViewIfNeeded();
    await addTop.click();
    await page.getByRole('menuitem', { name: /^Title/ }).click();
    await scope.getByLabel('Title', { exact: true }).fill('Picker sizes');
    const bar = scope.getByRole('toolbar', { name: 'Title style' });
    await bar.scrollIntoViewIfNeeded();
    await bar.getByRole('button', { name: 'Text colour' }).click();
    const panel = page.locator('[data-radix-popper-content-wrapper]').first();
    await panel.getByRole('button', { name: 'Text colour: custom colour' }).click();
    const picker = page.locator('[data-nl-color-picker]');
    await expectVisible(picker, `${width}: picker`);
    expect(await inViewport(page, picker), `${width}: the picker is in view`);
    expect(!overlaps(await picker.boundingBox(), await panel.boundingBox()), `${width}: the picker leaves the colour panel (and its recent colours) visible`);
    if (touch) {
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'touch emulation gives a coarse pointer');
      expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Colour', 'touch: the colour area has focus, not HEX (no keyboard popping up)');
      await expectVisible(picker.getByRole('textbox', { name: 'HEX colour' }), 'touch: HEX still shown');
    } else {
      expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'HEX colour', `${width}: HEX has focus`);
    }
    await shot(page, `${width}-12-picker${touch ? '-touch' : ''}`);
    await closeAllPanels(page);
    if (!touch) {
      await scope.getByRole('button', { name: 'Add a section after section 1' }).click();
      await page.getByRole('menuitem', { name: /^Button/ }).click();
      const buttonFrame = scope.locator('[role="group"][aria-label="Button section"]');
      await buttonFrame.scrollIntoViewIfNeeded();
      await buttonFrame.getByRole('button', { name: 'Button colour: custom colour' }).click();
      await expectVisible(picker, `${width}: Button picker`);
      expect(await inViewport(page, picker), `${width}: the Button picker is in view`);
      expect(!overlaps(await picker.boundingBox(), await buttonFrame.getByRole('radiogroup', { name: 'Button colour: recent colours' }).boundingBox()), `${width}: the Button picker leaves its colours visible`);
      await shot(page, `${width}-13-button-picker`);
      expect(!(await hasOverflow(page)), `${width}: nothing scrolls sideways`);
    }
    await context.close();
  }

  // ---- An older draft: B pressed on its title, nothing new saved -----------------------------------------------------
  const older = newsletter(23, {
    name: 'October Newsletter 2026', subject: 'October deals are here', from_name: 'Serpa Chrysler', reply_to_email: 'sales@serpachrysler.ca',
    blocks: [{ id: 'b1', type: 'title', data: { text: 'This month', size: 'large' } }, { id: 'b2', type: 'text', data: { html: '<p>Hello <strong>there</strong></p>' } }],
  });
  const api = createMockApi({ newsletters: [older], recentColors: false });
  const { page, context } = await open({ width: 1280, height: 1200, query: '&newsletterId=23', api });
  const p = page.locator('aside');
  await expectVisible(p.getByLabel('Title', { exact: true }), 'older draft open');
  await p.getByLabel('Title', { exact: true }).fill('This month, updated');
  expect(await pressed(p.getByRole('toolbar', { name: 'Title style' }).getByRole('button', { name: 'Bold' })) === 'true', 'older title: B pressed (bold as before)');
  await page.waitForTimeout(1800);
  const old = savedBlocks(api);
  expect(old && JSON.stringify(old[0].data) === '{"text":"This month, updated","size":"large"}', `older title saves no new keys (got ${JSON.stringify(old?.[0]?.data)})`);
  expect(old && JSON.stringify(old[1].data) === '{"html":"<p>Hello <strong>there</strong></p>"}', `older text saves no new keys (got ${JSON.stringify(old?.[1]?.data)})`);
  await context.close();
}
