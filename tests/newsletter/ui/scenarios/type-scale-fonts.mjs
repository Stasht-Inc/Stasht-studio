// Chris (7 Nov). Point 1: a colour picked with Custom and left by a click outside (the panel and the picker close
// together) is still kept as a recent colour. Point 3: the Font button reads as a font control (a font icon, the font's
// name, never "Default" alone, tooltip "Font"), also on a Title with a background picture, and every font applies there.
// Point 4: "Edit sizes…" at the bottom of the size menus: px per style, live in every Text span and Title, saved with the
// newsletter (type_scale); Reset; "Use as my default" (the account's, new newsletters start from it); older drafts keep
// their sizes and save nothing new. Checked at 1280 and 390 with the key controls in the viewport.
import { createMockApi, newsletter } from '../mock-api.mjs';

const OUT = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
const PHOTO = 'https://127.0.0.1/nl-design/showroom.svg';
const FILE = new URL('../../../../public/pwa-icon-192.png', import.meta.url).pathname;

async function partShot(locator, file) {
  const path = `${OUT}/type-scale-fonts-${file}.png`;
  await locator.screenshot({ path });
  console.log('shot', path);
}

const puts = (api) => api.state.calls.filter((c) => c.method === 'PUT' && /^\/newsletters\/\d+$/.test(c.path) && c.body);
function savedBlocks(api) {
  const p = puts(api).filter((c) => 'blocks' in c.body);
  return p.length ? p[p.length - 1].body.blocks : null;
}
const lastScalePut = (api) => [...puts(api)].reverse().find((c) => 'type_scale' in c.body)?.body.type_scale;

async function inViewport(page, locator) {
  const box = await locator.boundingBox();
  const vp = page.viewportSize();
  return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 0.5 && box.y + box.height <= vp.height + 0.5;
}
async function oneRow(toolbar) {
  const tops = await toolbar.getByRole('button').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  return tops.length > 0 && Math.max(...tops) - Math.min(...tops) <= 2;
}
async function closeAll(page) {
  for (let i = 0; i < 3 && (await page.locator('[data-radix-popper-content-wrapper]').count()); i += 1) {
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(150);
}
const px = (locator, prop = 'fontSize') => locator.evaluate((el, p) => getComputedStyle(el)[p], prop);

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const width of [1280, 390]) {
    const phone = width < 640;
    const api = createMockApi({ uploadUrl: PHOTO });
    const { page, context } = await open({ width, height: phone ? 844 : 1300, api });
    const scope = phone ? page : page.locator('aside');
    const until = async (check, label, read = savedBlocks) => {
      for (let i = 0; i < 40; i += 1) {
        const v = read(api);
        if (v !== undefined && v !== null && check(v)) return v;
        await page.waitForTimeout(150);
      }
      expect(false, `${width}: saved: ${label} (got ${JSON.stringify(read(api))})`);
      return read(api);
    };
    await page.locator('#nl-name').fill('Sizes and fonts');
    const addTop = scope.getByRole('button', { name: 'Add a section at the top' });
    await addTop.scrollIntoViewIfNeeded();
    await addTop.click();
    await page.getByRole('menuitem', { name: /^Title/ }).click();
    const title = scope.getByLabel('Title', { exact: true });
    await title.fill('November Newsletter');
    const titleFrame = scope.locator('[role="group"][aria-label="Title section"]');
    const titleBar = scope.getByRole('toolbar', { name: 'Title style' });
    await titleBar.scrollIntoViewIfNeeded();

    // ---- point 3: the Font button ------------------------------------------------------------------------------------
    const fontBtn = titleBar.getByRole('button', { name: 'Font: Sans Serif' });
    await expectVisible(fontBtn, 'title Font button named "Font: Sans Serif"');
    expect(await fontBtn.getAttribute('title') === 'Font', `${width}: tooltip "Font"`);
    expect(await inViewport(page, fontBtn), `${width}: Font button in view`);
    expect(await oneRow(titleBar), `${width}: title toolbar is one row`);
    if (!phone) {
      expect(await fontBtn.locator('svg.lucide-type').isVisible(), '1280: a font icon on the button');
      expect((await fontBtn.innerText()).trim() === 'Sans Serif', `1280: the button shows the font's name (got "${(await fontBtn.innerText()).trim()}")`);
    } else {
      expect((await fontBtn.innerText()).trim() === 'Aa', `390: "Aa" in the font (got "${(await fontBtn.innerText()).trim()}")`);
    }
    // A background picture, as in Chris's screenshot: the Font button is there and every font applies to the white words.
    await titleBar.getByRole('button', { name: 'Section background' }).click();
    const panel = page.locator('[data-radix-popper-content-wrapper]');
    await panel.getByRole('radio', { name: 'Image', exact: true }).click();
    await titleFrame.locator('input[type="file"]').setInputFiles(FILE);
    await until((b) => b[0]?.data?.background_image_url === PHOTO, 'title picture');
    await closeAll(page);
    expect((await title.evaluate((el) => getComputedStyle(el).textShadow)).includes('rgba(0, 0, 0, 0.5)'), `${width}: white words with a shadow on the picture`);
    await partShot(titleFrame, `${width}-01-title-picture-font-button`);
    const fonts = [['Arial', 'Arial'], ['Helvetica', 'Helvetica'], ['Georgia', 'Georgia'], ['Times New Roman', '"Times New Roman"'], ['Verdana', 'Verdana'],
      ['Trebuchet MS', '"Trebuchet MS"'], ['Tahoma', 'Tahoma'], ['Courier New', '"Courier New"'], ['Sans Serif (default)', '-apple-system']];
    for (const [label, family] of phone ? fonts.slice(2, 4) : fonts) {
      await titleBar.getByRole('button', { name: /^Font:/ }).click();
      const menu = page.getByRole('menu', { name: 'Font' });
      if (label === 'Georgia') {
        expect(await inViewport(page, menu), `${width}: font menu in view`);
        await partShot(page.locator('[data-radix-popper-content-wrapper]'), `${width}-02-font-menu`);
      }
      await menu.getByRole('menuitemradio', { name: label }).click();
      await page.waitForTimeout(150);
      // Sans Serif (the usual font): the device's system font, as the email's -apple-system / Segoe UI / Roboto stack.
      const ff = await title.evaluate((el) => getComputedStyle(el).fontFamily);
      expect(family === '-apple-system' ? /system-ui|-apple-system/.test(ff) : ff.startsWith(family), `${width}: ${label} applies on the picture title (${ff})`);
      if (label === 'Georgia') {
        expect(await titleBar.getByRole('button', { name: 'Font: Georgia' }).count() === 1, `${width}: the button names Georgia`);
        await partShot(titleFrame, `${width}-03-title-picture-georgia`);
      }
    }

    // ---- point 4: Edit sizes from the Title size menu ----------------------------------------------------------------
    expect(await px(title) === '28px', `${width}: a Large title is 28 px with the usual sizes`);
    await titleBar.getByRole('button', { name: /^Title size:/ }).click();
    const editItem = page.getByRole('button', { name: 'Edit sizes…' });
    await expectVisible(editItem, '"Edit sizes…" at the bottom of the Title size menu');
    await partShot(page.locator('[data-radix-popper-content-wrapper]'), `${width}-04-title-size-menu`);
    await editItem.click();
    const sizes = page.getByRole('group', { name: 'Edit sizes' });
    await expectVisible(sizes, 'the Edit sizes panel');
    await page.waitForTimeout(200);
    expect(await inViewport(page, sizes), `${width}: Edit sizes panel in view (${JSON.stringify(await sizes.boundingBox())})`);
    expect(await sizes.getByRole('button', { name: 'Reset' }).getAttribute('aria-disabled') === 'true', `${width}: Reset off with the usual sizes`);
    await sizes.getByLabel('X-Large', { exact: true }).fill('30');
    await until((s) => s.xlarge === 30, 'X-Large 30', lastScalePut);
    expect(await px(title) === '35px', `${width}: the Large title follows X-Large live (30 × 28/24 = 35, got ${await px(title)})`);
    expect(await px(title, 'lineHeight') === '43px', `${width}: and its line height (+8)`);
    await partShot(page.locator('[data-radix-popper-content-wrapper]'), `${width}-05-edit-sizes-panel`);
    await closeAll(page);

    // ---- Text: a size names its style; Edit sizes changes every word in it ------------------------------------------
    await scope.getByRole('button', { name: 'Add a section after section 1' }).click();
    await page.getByRole('menuitem', { name: /^Text/ }).click();
    const text = scope.getByRole('textbox', { name: 'Text', exact: true });
    await text.click();
    await page.keyboard.type('Spring tune-ups are here. Book this week.');
    const textBar = scope.getByRole('toolbar', { name: 'Text formatting' });
    expect(await oneRow(textBar), `${width}: text toolbar is one row`);
    expect(await inViewport(page, textBar.getByRole('button', { name: 'Font: Sans Serif' })), `${width}: text Font button in view`);
    await page.evaluate(() => {
      const root = document.querySelector('[role="textbox"][aria-label="Text"]');
      const node = [...root.querySelectorAll('*'), root].flatMap((e) => [...e.childNodes]).find((n) => n.nodeType === 3 && n.textContent.includes('Book this week'));
      const i = node.textContent.indexOf('Book this week');
      const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 'Book this week'.length);
      getSelection().removeAllRanges(); getSelection().addRange(r);
    });
    await textBar.getByRole('button', { name: /^Font size:/ }).click();
    await page.getByRole('menu', { name: 'Font size' }).getByRole('menuitemradio', { name: 'Large', exact: true }).click();
    await until((b) => (b[1]?.data?.html ?? '').includes('<span data-size="large">Book this week</span>'), 'the words keep the style name, not a px');
    const big = text.locator('span[data-size="large"]');
    expect(await px(big) === '20px', `${width}: Large is 20 px`);
    expect(await px(text) === '16px', `${width}: the usual words are Normal 16 px`);
    await textBar.getByRole('button', { name: /^Font size:/ }).click();
    await expectVisible(page.getByRole('button', { name: 'Edit sizes…' }), '"Edit sizes…" in the Text size menu');
    await partShot(page.locator('[data-radix-popper-content-wrapper]'), `${width}-06-text-size-menu`);
    await page.getByRole('button', { name: 'Edit sizes…' }).click();
    await sizes.getByRole('button', { name: 'Large bigger', exact: true }).click();
    await sizes.getByRole('button', { name: 'Large bigger', exact: true }).click();
    await until((s) => s.large === 22, 'Large 22', lastScalePut);
    expect(await px(big) === '22px' && await px(big, 'lineHeight') === '33px', `${width}: every Large word follows live (22 / 33, got ${await px(big)} / ${await px(big, 'lineHeight')})`);
    expect(await px(text) === '16px', `${width}: Normal words unchanged`);
    expect((savedBlocks(api)[1].data.html).includes('<span data-size="large">'), `${width}: the html is unchanged (the style, not a px)`);
    // A size out of range: said under the field, nothing saved.
    const normal = sizes.getByLabel('Normal', { exact: true });
    await normal.fill('99');
    await normal.press('Tab');
    await expectVisible(sizes.getByText('Use 10 to 72 px.'), 'the size error under its field');
    expect(await normal.getAttribute('aria-invalid') === 'true', `${width}: the field is marked`);
    expect(lastScalePut(api).normal === 16, `${width}: 99 is not saved`);
    await partShot(page.locator('[data-radix-popper-content-wrapper]'), `${width}-07-size-error`);
    await normal.fill('17');
    await until((s) => s.normal === 17, 'Normal 17', lastScalePut);
    expect(await px(text) === '17px', `${width}: the usual words follow Normal`);
    // Use as my default.
    await sizes.getByRole('button', { name: 'Use as my default' }).click();
    await expectVisible(sizes.getByText('Saved. New newsletters start with these sizes.'), 'saved as the default');
    const brandPut = api.state.calls.find((c) => c.method === 'PUT' && c.path === '/newsletter-brand' && c.body && 'type_scale' in c.body);
    expect(JSON.stringify(brandPut?.body.type_scale) === JSON.stringify({ small: 14, normal: 17, large: 22, xlarge: 30 }), `${width}: the account default sent (${JSON.stringify(brandPut?.body)})`);
    expect(await inViewport(page, sizes.getByRole('status')), `${width}: the saved note is in view`);
    await partShot(page.locator('[data-radix-popper-content-wrapper]'), `${width}-08-default-saved`);
    // Reset: the usual sizes, nothing kept.
    await sizes.getByRole('button', { name: 'Reset' }).click();
    for (let i = 0; i < 40 && lastScalePut(api) !== null; i += 1) await page.waitForTimeout(150);
    expect(lastScalePut(api) === null, `${width}: Reset saved no sizes`);
    expect(await sizes.isVisible(), `${width}: the panel stays open after Reset`);
    expect(await px(big) === '20px' && await px(title) === '28px', `${width}: back to 20 / 28`);
    await sizes.getByLabel('Large', { exact: true }).fill('24');
    await until((s) => s?.large === 24, 'Large 24', lastScalePut);
    await closeAll(page);
    expect(!(await hasOverflow(page)), `${width}: nothing scrolls sideways`);
    await shot(page, `${width}-09-editor`);

    // Reopened: the newsletter's own sizes are kept.
    const nlId = api.state.newsletters[0]?.id;
    await page.goto(page.url().replace(/&newsletterId=\d+/, '') + `&newsletterId=${nlId}`);
    const scope2 = phone ? page : page.locator('aside');
    await expectVisible(scope2.getByRole('textbox', { name: 'Text', exact: true }), 'reopened draft');
    expect(await px(scope2.locator('[role="textbox"][aria-label="Text"] span[data-size="large"]')) === '24px', `${width}: Large is still 24 px after reopening`);
    await context.close();

    // A new newsletter starts from the account default (saved above).
    const { page: p2, context: c2 } = await open({ width, height: phone ? 844 : 1300, api });
    const s2 = phone ? p2 : p2.locator('aside');
    await p2.locator('#nl-name').fill('Next month');
    await s2.getByRole('button', { name: 'Add a section at the top' }).click();
    await p2.getByRole('menuitem', { name: /^Title/ }).click();
    await s2.getByLabel('Title', { exact: true }).fill('Next month');
    for (let i = 0; i < 30 && (await px(s2.getByLabel('Title', { exact: true }))) !== '35px'; i += 1) await p2.waitForTimeout(150);
    expect(await px(s2.getByLabel('Title', { exact: true })) === '35px', `${width}: a new newsletter uses the account's default sizes (got ${await px(s2.getByLabel('Title', { exact: true }))})`);
    await c2.close();
  }

  // ---- Older drafts: px spans keep their size; opening and editing saves no sizes ------------------------------------
  {
    const old = newsletter(41, { name: 'Older', blocks: [
      { id: 'o1', type: 'title', data: { text: 'Old title', size: 'small' } },
      { id: 'o2', type: 'text', data: { html: '<p>Plain <span style="font-size:24px">big old words</span></p>' } },
    ] });
    const api = createMockApi({ newsletters: [old] });
    const { page, context } = await open({ width: 1280, height: 1300, api, query: '&newsletterId=41' });
    const scope = page.locator('aside');
    await expectVisible(scope.getByLabel('Title', { exact: true }), 'older draft');
    expect(await px(scope.getByLabel('Title', { exact: true })) === '18px', 'older: a Small title is still 18 px');
    expect(await px(scope.locator('[role="textbox"][aria-label="Text"] span[data-size="xlarge"]')) === '24px', 'older: a 24 px span is X-Large at 24 px');
    await scope.getByLabel('Title', { exact: true }).fill('Old title edited');
    for (let i = 0; i < 30 && !puts(api).some((c) => 'blocks' in c.body); i += 1) await page.waitForTimeout(150);
    expect(puts(api).length > 0 && puts(api).every((c) => !('type_scale' in c.body)), `older: no sizes saved (${JSON.stringify(puts(api).map((c) => Object.keys(c.body)))})`);
    expect(JSON.stringify(savedBlocks(api)?.[0]?.data) === JSON.stringify({ text: 'Old title edited', size: 'small' }), 'older: the title saves exactly its old keys');
    await context.close();
  }

  // ---- point 1: a click outside after picking in the colour area keeps the colour (mocked; real API: e2e-ty) ---------
  for (const width of [1280, 390]) {
    const phone = width < 640;
    const api = createMockApi();
    const { page, context } = await open({ width, height: phone ? 844 : 1300, api });
    const scope = phone ? page : page.locator('aside');
    await page.locator('#nl-name').fill('Recent colours');
    await scope.getByRole('button', { name: 'Add a section at the top' }).click();
    await page.getByRole('menuitem', { name: /^Title/ }).click();
    await scope.getByLabel('Title', { exact: true }).fill('Brown band');
    const bar = scope.getByRole('toolbar', { name: 'Title style' });
    await bar.getByRole('button', { name: 'Section background' }).click();
    await page.locator('[data-radix-popper-content-wrapper]').getByRole('button', { name: 'Background colour: custom colour' }).click();
    const area = page.locator('[data-nl-color-picker] [data-nl-color-area]');
    const box = await area.boundingBox();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.72, { steps: 4 });
    await page.mouse.up();
    const picked = (await page.locator('[data-nl-color-picker] input').inputValue()).toUpperCase();
    // Click outside both (as Chris did): the panel and the picker close together.
    await page.mouse.click(phone ? 5 : 5, phone ? 80 : 5);
    await page.waitForTimeout(400);
    const brandPuts = api.state.calls.filter((c) => c.method === 'PUT' && c.path === '/newsletter-brand' && c.body?.recent_color);
    expect(brandPuts.length === 1 && brandPuts[0].body.recent_color === picked, `${width}: the colour is saved once as a recent colour (${JSON.stringify(brandPuts.map((c) => c.body))}, picked ${picked})`);
    await bar.getByRole('button', { name: 'Text colour' }).click();
    await expectVisible(page.locator('[data-radix-popper-content-wrapper]').getByRole('radio', { name: `Recent colour ${picked}` }), `${width}: recent swatch in the Text colour panel`);
    await partShot(page.locator('[data-radix-popper-content-wrapper]').first(), `${width}-10-recent-after-outside-click`);
    await context.close();
  }
}
