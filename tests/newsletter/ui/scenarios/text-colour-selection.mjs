// Chris (10 Nov): "I can't change text color on selection. It changes the whole row text." In the real Text editor at
// 1280 and 390: select one word → Text colour → Red: only that word is red (on screen and in the saved html, as an
// inline span), the section's own colour is untouched. Custom (HEX) works on the selection too. Automatic takes the
// word's colour away. With only a caret, the colour still goes on the whole section (data.color), as before.
import { createMockApi } from '../mock-api.mjs';

function savedBlocks(api) {
  const puts = api.state.calls.filter((c) => c.method === 'PUT' && /^\/newsletters\/\d+$/.test(c.path) && c.body && 'blocks' in c.body);
  return puts.length ? puts[puts.length - 1].body.blocks : null;
}

async function selectWords(page, selector, words) {
  await page.evaluate(([sel, w]) => {
    const root = document.querySelector(sel);
    root.focus();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const i = node.textContent.indexOf(w);
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(node, i);
      r.setEnd(node, i + w.length);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      return;
    }
    throw new Error(`words not found: ${w}`);
  }, [selector, words]);
  await page.waitForTimeout(100);
}

/** The colour each listed word is drawn in. */
const inkOf = (page, selector, words) => page.evaluate(([sel, list]) => {
  const root = document.querySelector(sel);
  const out = {};
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const w of list) if (node.textContent.includes(w) && !out[w]) out[w] = getComputedStyle(node.parentElement).color;
  }
  return out;
}, [selector, words]);

export async function run({ open, shot, expect }) {
  for (const width of [1280, 390]) {
    const phone = width < 640;
    const api = createMockApi();
    const { page, context } = await open({ width, height: phone ? 844 : 1200, api });
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
    await page.locator('#nl-name').fill('Colour on selection');
    const addTop = scope.getByRole('button', { name: 'Add a section at the top' });
    await addTop.scrollIntoViewIfNeeded();
    await addTop.click();
    await page.getByRole('menuitem', { name: /^Text/ }).click();
    const text = scope.getByRole('textbox', { name: 'Text', exact: true });
    await text.click();
    await page.keyboard.type('Smart Search finds it fast');
    const sel = phone ? '[role="textbox"][aria-label="Text"]' : 'aside [role="textbox"][aria-label="Text"]';
    const bar = scope.getByRole('toolbar', { name: 'Text formatting' });
    const colourButton = bar.getByRole('button', { name: 'Text colour' });
    const panel = page.locator('[data-radix-popper-content-wrapper]').first();

    // ---- one word → Red ---------------------------------------------------------------------------------------------
    await selectWords(page, sel, 'Search');
    await colourButton.click();
    await panel.getByText('On the selected words.', { exact: false }).waitFor({ timeout: 4000 }).catch(() => expect(false, `${width}: hint says it is on the selected words`));
    await panel.getByRole('radio', { name: 'Red' }).click();
    let blocks = await until((b) => /<span style="color:#DC2626">Search<\/span>/.test(b[0]?.data?.html ?? ''), 'only "Search" is red');
    expect(blocks[0].data.html === '<p>Smart <span style="color:#DC2626">Search</span> finds it fast</p>', `${width}: saved html (got ${blocks[0].data.html})`);
    expect(!('color' in blocks[0].data), `${width}: the section's colour is untouched`);
    let ink = await inkOf(page, sel, ['Smart', 'Search', 'finds']);
    expect(ink.Search === 'rgb(220, 38, 38)', `${width}: "Search" drawn red (${ink.Search})`);
    expect(ink.Smart !== 'rgb(220, 38, 38)' && ink.Smart === ink.finds, `${width}: the other words keep their colour (${ink.Smart}, ${ink.finds})`);
    expect(await panel.count() === 1, `${width}: the panel stays open after picking`);
    expect(await panel.getByRole('radio', { name: 'Red' }).getAttribute('aria-checked') === 'true', `${width}: Red is marked as the words' colour`);
    expect(await panel.getByText('On the selected words.', { exact: false }).count() === 1, `${width}: still "on the selected words" after picking`);
    expect(await page.evaluate((s) => document.activeElement !== document.querySelector(s), sel), `${width}: focus stays in the panel`);
    await shot(page, `${width}-01-one-word-red`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const still = await page.evaluate(() => getSelection().toString());
    expect(still === 'Search', `${width}: the words stay selected after the panel closes (got "${still}")`);

    // ---- Custom HEX on another word ---------------------------------------------------------------------------------
    await selectWords(page, sel, 'fast');
    await colourButton.click();
    await panel.getByRole('button', { name: 'Text colour: custom colour' }).click();
    const hex = page.locator('[data-nl-color-picker]').getByRole('textbox', { name: 'HEX colour' });
    await hex.fill('1f6f8b');
    blocks = await until((b) => /<span style="color:#1F6F8B">fast<\/span>/.test(b[0]?.data?.html ?? ''), 'custom hex on "fast"');
    expect(await hex.evaluate((el) => document.activeElement === el), `${width}: the HEX field keeps focus while typing`);
    expect(/<span style="color:#DC2626">Search<\/span>/.test(blocks[0].data.html), `${width}: "Search" still red`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // ---- Automatic removes the word's own colour --------------------------------------------------------------------
    await selectWords(page, sel, 'Search');
    await colourButton.click();
    await panel.getByRole('button', { name: 'Automatic' }).click();
    blocks = await until((b) => !/color:#DC2626/.test(b[0]?.data?.html ?? ''), 'Automatic removes red');
    expect(blocks[0].data.html === '<p>Smart Search finds it <span style="color:#1F6F8B">fast</span></p>', `${width}: html after Automatic (got ${blocks[0].data.html})`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // ---- caret only: the whole section, as before ------------------------------------------------------------------
    await page.evaluate((s) => { const el = document.querySelector(s); el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r); }, sel);
    await page.waitForTimeout(100);
    await colourButton.click();
    await panel.getByRole('radio', { name: 'Blue' }).click();
    blocks = await until((b) => b[0]?.data?.color === '#2563EB', 'caret: section colour Blue');
    ink = await inkOf(page, sel, ['Smart', 'fast']);
    expect(ink.Smart === 'rgb(37, 99, 235)', `${width}: caret: the section is blue (${ink.Smart})`);
    expect(ink.fast === 'rgb(31, 111, 139)', `${width}: caret: a word's own colour stays (${ink.fast})`);
    await shot(page, `${width}-02-caret-section-blue`);
    await context.close();
  }
}
