// Chris (7 Nov, point 2): "we are getting there, but need more options. Add spacing so we can make gaps smaller between
// rows. Add padding so we can decrease padding on top and bottom." His screenshot: a brown Text section with a
// paragraph and a bulleted list, big gaps between the rows and big room above and below. One "Spacing" button on the
// Title and Text toolbars (Line spacing + Padding); a Padding switch on Button and Divider. Checked at 1280 and 390:
// the controls are in view, every choice shows in the editor (computed line height, gaps, padding) and in the saved
// payload, Normal removes the key. SP_PAYLOAD=<file>: the final saved blocks, to render the real email from them.
import { writeFileSync } from 'fs';
import { createMockApi, newsletter } from '../mock-api.mjs';

const OUT = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
const BROWN = '#4A2F1F';
const LIST = '<p>In today\'s email you\'ll find:</p><ul><li>Year End Laser Deals</li><li>New Staff &amp; Expanded Hours</li><li>For The Dolls: A Beauty Social + Our <span style="font-size:20px">Black Friday</span> specials!</li></ul>';

const seed = () => newsletter(70, {
  name: 'November Newsletter 2026', subject: 'November at Serpa', blocks: [
    { id: 't1', type: 'title', data: { text: 'Year end at the spa', size: 'large', background_color: BROWN } },
    { id: 'x1', type: 'text', data: { html: LIST, background_color: BROWN } },
    { id: 'u1', type: 'button', data: { label: 'Book now', url: 'https://serpachrysler.ca/book', color: '#6C60FF' } },
    { id: 'd1', type: 'divider', data: { style: 'line' } },
    { id: 'c1', type: 'campaigns', data: { campaign_ids: [601], items: [{ id: 601, title: 'Fall service event', description: 'About the event.', cover_url: null, url: 'http://localhost:5173/published-memory/campaign-601', date: '2026-10-20' }] } },
  ],
});

function savedBlocks(api) {
  const puts = api.state.calls.filter((c) => c.method === 'PUT' && /^\/newsletters\/\d+$/.test(c.path) && c.body && 'blocks' in c.body);
  return puts.length ? puts[puts.length - 1].body.blocks : null;
}

async function inViewport(page, locator) {
  const box = await locator.boundingBox();
  const vp = page.viewportSize();
  return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 0.5 && box.y + box.height <= vp.height + 0.5;
}

async function oneRow(toolbar) {
  const tops = await toolbar.getByRole('button').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  return tops.length > 0 && Math.max(...tops) - Math.min(...tops) <= 2;
}

/** Scroll a control into view; a toolbar that is still re-rendering just after a click gets one more try. */
async function intoView(page, locator) {
  try { await locator.scrollIntoViewIfNeeded({ timeout: 5000 }); } catch { await page.waitForTimeout(400); await locator.scrollIntoViewIfNeeded(); }
}

const css = (locator, prop) => locator.first().evaluate((el, p) => getComputedStyle(el)[p], prop);

export async function run({ open, expectVisible, expect, hasOverflow }) {
  for (const width of [1280, 390]) {
    const { page, api, context } = await open({ width, height: width === 390 ? 844 : 1300, query: '&newsletterId=70', api: createMockApi({ newsletters: [seed()] }) });
    const shot = async (locator, file) => {
      const path = `${OUT}/section-spacing-${width}-${file}.png`;
      await locator.screenshot({ path });
      console.log('shot', path);
    };
    const until = async (check, label) => {
      for (let i = 0; i < 40; i += 1) {
        const b = savedBlocks(api);
        if (b && check(b)) return b;
        await page.waitForTimeout(150);
      }
      expect(false, `${width}: saved ${label} (got ${JSON.stringify(savedBlocks(api))})`);
      return savedBlocks(api) ?? [];
    };
    const preview = page.locator('aside');
    const textFrame = preview.locator('[role="group"][aria-label="Text section"]');
    const text = preview.getByRole('textbox', { name: 'Text' });
    await expectVisible(text, 'the seeded text section');
    const menu = page.getByRole('menu', { name: 'Spacing' });
    const lines = (name) => menu.getByRole('group', { name: 'Line spacing' }).getByRole('menuitemradio', { name, exact: true });
    const pads = (name) => menu.getByRole('group', { name: 'Padding (top and bottom)' }).getByRole('menuitemradio', { name, exact: true });

    // Before: today's look (Chris's screenshot).
    expect(await css(textFrame, 'paddingTop') === '24px', `${width}: a band has 24 px above (as before)`);
    expect(await css(text, 'lineHeight') === '26px', `${width}: 26 px lines (as before)`);
    expect(await css(text.locator('li'), 'marginBottom') === '6px', `${width}: 6 px between list rows (as before)`);
    await text.click();
    const bar = preview.getByRole('toolbar', { name: 'Text formatting' });
    const spacingButton = bar.getByRole('button', { name: /^Spacing/ });
    await expectVisible(spacingButton, 'Spacing button on the Text toolbar');
    expect(await spacingButton.getAttribute('aria-label') === 'Spacing: line spacing Normal, padding Normal', `${width}: the button says the current choices`);
    await intoView(page, spacingButton);
    expect(await inViewport(page, spacingButton), `${width}: Spacing is in view`);
    expect(await oneRow(bar), `${width}: the text toolbar is still one row`);
    // Review M6: Bold / Italic / Link keep 32 px tap targets on phones too.
    const toggles = await bar.getByRole('button', { name: /^(Bold|Italic|Link)$/ }).evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)));
    expect(toggles.length === 3 && toggles.every((w) => w >= 32), `${width}: B / I / link are at least 32 px wide (${toggles})`);
    expect(await inViewport(page, bar), `${width}: the whole toolbar is in view`);
    await shot(textFrame, '01-text-before');

    // The menu: Line spacing and Padding, the current ones ticked.
    await spacingButton.click();
    await expectVisible(menu, 'Spacing menu');
    expect(await inViewport(page, menu), `${width}: the Spacing menu is in view`);
    expect(await lines('Normal').getAttribute('aria-checked') === 'true', 'Line spacing Normal ticked');
    expect(await pads('Normal').getAttribute('aria-checked') === 'true', 'Padding Normal ticked');
    await shot(page.locator('[data-radix-popper-content-wrapper]'), '02-spacing-menu');

    // Tight + None: Chris's ask.
    await lines('Tight').click();
    await until((b) => b[1]?.data?.line_spacing === 'tight', 'text tight');
    expect(await css(text, 'lineHeight') === '22px', `${width}: tight: 22 px lines`);
    expect(await css(text.locator('p'), 'marginBottom') === '8px', `${width}: tight: 8 px after a paragraph`);
    expect(await css(text.locator('li'), 'marginBottom') === '2px', `${width}: tight: 2 px between list rows`);
    expect(await css(text.locator('span'), 'lineHeight') === '25px', `${width}: tight: 20 px words on 25 px lines (the email's) (got ${await css(text.locator('span'), 'lineHeight')})`);
    expect(await css(text.locator('ul'), 'marginBottom') === '0px', `${width}: the section ends on its list (no gap above the bottom edge)`);
    await expectVisible(menu, 'the menu stays open to pick padding too');
    await pads('None').click();
    await until((b) => b[1]?.data?.padding === 'none', 'text padding none');
    expect(await css(textFrame, 'paddingTop') === '0px' && await css(textFrame, 'paddingBottom') === '0px', `${width}: padding None: no room above or below`);
    await shot(page.locator('[data-radix-popper-content-wrapper]'), '03-menu-tight-none');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await shot(textFrame, '04-text-tight-none');

    // Relaxed + Large.
    await spacingButton.click();
    await lines('Relaxed').click();
    await pads('Large').click();
    await until((b) => b[1]?.data?.line_spacing === 'relaxed' && b[1]?.data?.padding === 'large', 'text relaxed large');
    expect(await css(text, 'lineHeight') === '32px', `${width}: relaxed: 32 px lines`);
    expect(await css(text.locator('li'), 'marginBottom') === '12px', `${width}: relaxed: 12 px between list rows`);
    expect(await css(textFrame, 'paddingTop') === '40px', `${width}: padding Large on a band: 40 px`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await shot(textFrame, '05-text-relaxed-large');

    // Normal + Normal removes both keys: exactly the block it was.
    await spacingButton.click();
    await lines('Normal').click();
    await pads('Normal').click();
    await until((b) => !('line_spacing' in b[1].data) && !('padding' in b[1].data), 'normal removes the keys');
    expect(await css(text, 'lineHeight') === '26px' && await css(textFrame, 'paddingTop') === '24px', `${width}: Normal is the old look`);
    // Leave it Tight + Small for the email render.
    await lines('Tight').click();
    await pads('Small').click();
    await until((b) => b[1]?.data?.line_spacing === 'tight' && b[1]?.data?.padding === 'small', 'text tight small');
    expect(await css(textFrame, 'paddingTop') === '12px', `${width}: padding Small on a band: 12 px`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Title: the same button.
    const titleFrame = preview.locator('[role="group"][aria-label="Title section"]');
    const title = preview.getByLabel('Title', { exact: true });
    await title.click();
    const titleBar = preview.getByRole('toolbar', { name: 'Title style' });
    const titleSpacing = titleBar.getByRole('button', { name: /^Spacing/ });
    await expectVisible(titleSpacing, 'Spacing button on the Title toolbar');
    await intoView(page, titleSpacing);
    expect(await inViewport(page, titleSpacing), `${width}: title Spacing in view`);
    expect(await oneRow(titleBar), `${width}: the title toolbar is one row`);
    await titleSpacing.click();
    await lines('Tight').click();
    await pads('None').click();
    await until((b) => b[0]?.data?.line_spacing === 'tight' && b[0]?.data?.padding === 'none', 'title tight none');
    expect(await css(title, 'lineHeight') === '33.6px', `${width}: a tight large title: 33.6 px lines (got ${await css(title, 'lineHeight')})`);
    expect(await css(titleFrame, 'paddingTop') === '0px', `${width}: title padding None`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await shot(titleFrame, '06-title-tight-none');

    // Button and Divider: a Padding switch with their other controls.
    const buttonFrame = preview.locator('[role="group"][aria-label="Button section"]');
    await buttonFrame.click({ position: { x: 10, y: 10 } });
    const buttonPadding = buttonFrame.getByRole('radiogroup', { name: 'Padding (top and bottom)' });
    await expectVisible(buttonPadding, 'Button: Padding switch');
    await intoView(page, buttonPadding);
    expect(await inViewport(page, buttonPadding), `${width}: Button padding switch in view`);
    await buttonPadding.getByRole('radio', { name: 'None' }).click();
    await until((b) => b[2]?.data?.padding === 'none', 'button padding none');
    expect(await css(buttonFrame, 'paddingTop') === '0px', `${width}: button padding None`);
    await shot(buttonFrame, '07-button-padding-none');
    const dividerFrame = preview.locator('[role="group"][aria-label="Divider section"]');
    await dividerFrame.focus();
    const dividerPadding = dividerFrame.getByRole('radiogroup', { name: 'Padding (top and bottom)' });
    await expectVisible(dividerPadding, 'Divider: Padding switch');
    await intoView(page, dividerPadding);
    expect(await inViewport(page, dividerPadding), `${width}: Divider padding switch in view`);
    await dividerPadding.getByRole('radio', { name: 'Large' }).click();
    await until((b) => b[3]?.data?.padding === 'large', 'divider padding large');
    expect(await css(dividerFrame, 'paddingTop') === '24px', `${width}: divider padding Large: 24 px`);
    expect(!(await hasOverflow(page)), `${width}: nothing scrolls sideways`);
    await shot(dividerFrame, '08-divider-padding-large');

    // Campaigns (review M8): the same switch with its Edit / Columns controls.
    const campaignsFrame = preview.locator('[role="group"][aria-label="Campaigns section"]');
    await campaignsFrame.focus();
    const campaignsPadding = campaignsFrame.getByRole('radiogroup', { name: 'Padding (top and bottom)' });
    await expectVisible(campaignsPadding, 'Campaigns: Padding switch');
    await intoView(page, campaignsPadding);
    expect(await inViewport(page, campaignsPadding), `${width}: Campaigns padding switch in view`);
    // Every choice inside the section's panel (none cut off at the edge on a phone).
    const panelBox = await campaignsPadding.locator('xpath=ancestor::div[contains(@class,"bg-gray-50")][1]').boundingBox();
    const lastBox = await campaignsPadding.getByRole('radio', { name: 'Large' }).boundingBox();
    expect(!!panelBox && !!lastBox && lastBox.x + lastBox.width <= panelBox.x + panelBox.width, `${width}: "Large" fits inside the panel`);
    await campaignsPadding.getByRole('radio', { name: 'Small' }).click();
    await until((b) => b[4]?.data?.padding === 'small', 'campaigns padding small');
    expect(await css(campaignsFrame, 'paddingTop') === '6px', `${width}: campaigns padding Small: 6 px (got ${await css(campaignsFrame, 'paddingTop')})`);
    await shot(campaignsFrame, '08b-campaigns-padding-small');

    // Done: the preview as the email will look.
    await campaignsFrame.getByRole('button', { name: 'Done' }).click();
    await page.waitForTimeout(300);
    if (width === 1280) await shot(preview, '09-preview-done');
    else {
      await page.evaluate(() => document.querySelector('[data-block-id="x1"]')?.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/section-spacing-390-09-preview-done.png` });
      console.log('shot', `${OUT}/section-spacing-390-09-preview-done.png`);
    }
    const final = savedBlocks(api);
    expect(JSON.stringify(final.map((b) => [b.data.line_spacing ?? null, b.data.padding ?? null])) === JSON.stringify([['tight', 'none'], ['tight', 'small'], [null, 'none'], [null, 'large'], [null, 'small']]), `${width}: saved keys ${JSON.stringify(final)}`);
    if (width === 1280 && process.env.SP_PAYLOAD) writeFileSync(process.env.SP_PAYLOAD, JSON.stringify(final));
    await context.close();
  }
}
