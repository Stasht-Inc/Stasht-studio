// Chris 23 Nov 2026 (A): "I loaded an existing newsletter and switched to html....and it is blank??"
// node tests/newsletter/ui/check.mjs c23-sections-to-html — at 1280 and 390, every API call answered by the mock.
// Open an existing sections newsletter → HTML → "Loading your sections…" → the box holds the sections as HTML (the REAL
// API output for these sections: tests/newsletter/ui/fixtures/c23-*) and is saved → the note "Your sections as HTML…"
// shows, no own-unsubscribe note, nothing removed → the preview (the real API email for that HTML) has ONE footer →
// the sections are untouched → typing in the box hides the note → Sections and back: the box is kept, no new fetch.
// Then: a newsletter with no sections keeps the empty box; a failed fetch leaves it empty with an error at the bottom.
import { readFileSync } from 'fs';
import { createMockApi, newsletter } from '../mock-api.mjs';

const FX = new URL('../fixtures/', import.meta.url).pathname;
const SECTIONS = readFileSync(`${FX}c23-sections-html.html`, 'utf8');
const BLOCKS = JSON.parse(readFileSync(`${FX}c23-blocks.json`, 'utf8'));
const FIXTURE = { source: SECTIONS, html: readFileSync(`${FX}c23-html-email.html`, 'utf8'), ...JSON.parse(readFileSync(`${FX}c23-html-preview.json`, 'utf8')) };
const NOTE = 'Your sections as HTML. Paste over it to use another email.';
const HEADER = { logo_url: null, banner_url: null, background_color: '#4B2E1E', title: 'The Body Politik' };
const seeded = (id, over = {}) => newsletter(id, { name: 'November Newsletter', subject: 'November specials', from_name: 'The Body Politik', header: HEADER, blocks: BLOCKS, ...over });

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const [width, height, tag] of [[1280, 1000, '1280'], [390, 844, '390']]) {
    const api = createMockApi({ newsletters: [seeded(77)], sectionsHtml: SECTIONS, htmlDocumentFixture: FIXTURE, businessAddress: '22 Commercial Dr, Vancouver, BC' });
    const { page, context } = await open({ width, height, api, query: '&newsletterId=77' });
    const content = page.locator('#nl-step-content');
    const aside = page.locator('aside');
    const modeSwitch = page.getByRole('radiogroup', { name: 'Email content' });
    await expectVisible(modeSwitch.getByRole('radio', { name: 'Sections', checked: true }), `${tag}: opens on Sections`);
    await expectVisible(aside.getByText('Holiday lash packages').first(), `${tag}: the sections`);
    await page.waitForTimeout(1200);
    await shot(page, `${tag}-01-sections`);
    const blocksBefore = JSON.stringify(api.state.newsletters[0].blocks);

    // HTML: the box loads the sections as HTML.
    api.state.sectionsHtmlDelayMs = 1500;
    await modeSwitch.getByRole('radio', { name: 'HTML' }).click();
    const box = content.getByLabel('HTML Content');
    await expectVisible(content.getByText('Loading your sections…').first(), `${tag}: loading in the box area`);
    if (phone(tag)) await box.scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: shotPath(tag, '02-loading'), fullPage: false });
    console.log('shot', shotPath(tag, '02-loading'));
    await page.waitForFunction(() => (document.getElementById('nl-html-document')?.value ?? '').includes('<!DOCTYPE html>'), null, { timeout: 10000 }).catch(() => {});
    expect((await box.inputValue()) === SECTIONS.trim(), `${tag}: the box holds the sections as HTML`);
    await expectVisible(content.getByText(NOTE), `${tag}: the note above the box`);
    const [noteBox, boxBox] = [await content.getByText(NOTE).boundingBox(), await box.boundingBox()];
    expect(noteBox && boxBox && noteBox.y < boxBox.y, `${tag}: the note is above the box`);
    expect(await page.evaluate(() => document.activeElement?.id === 'nl-html-document'), `${tag}: the cursor is in the box`);
    expect(await content.locator('[data-nl-html-own-unsubscribe]').count() === 0, `${tag}: no own-unsubscribe note`);
    expect(api.state.sectionsHtmlCalls === 1, `${tag}: one fetch (${api.state.sectionsHtmlCalls})`);
    await page.waitForTimeout(1500); // autosave
    const saved = api.state.newsletters[0];
    expect(saved.content?.mode === 'html' && saved.content.html_document === SECTIONS.trim(), `${tag}: saved as the HTML`);
    expect(JSON.stringify(saved.blocks) === blocksBefore, `${tag}: the sections are untouched`);

    // The preview: the API's email for that HTML — our footer once, nothing removed.
    const email = page.frameLocator('iframe[title="HTML email preview"]');
    await expectVisible(email.getByText('Holiday lash packages'), `${tag}: the preview shows the sections`);
    await expectVisible(email.getByText('Book now'), `${tag}: and the button`);
    expect(await email.locator('[data-newsletter="footer-band"]').count() === 1, `${tag}: one footer`);
    expect(await email.getByText('unsubscribe here').count() === 1, `${tag}: one unsubscribe link`);
    expect(await email.getByText('Powered by', { exact: true }).count() === 1, `${tag}: one Powered by`);
    expect(await email.getByText('22 Commercial Dr, Vancouver, BC').count() === 1, `${tag}: one address`);
    expect(await content.locator('[data-nl-html-removed]').count() === 0, `${tag}: nothing removed from our own HTML`);
    expect(!(await hasOverflow(page)), `${tag}: no sideways scroll`);
    await page.waitForTimeout(400);
    await shot(page, `${tag}-03-filled`);
    if (phone(tag)) {
      await box.scrollIntoViewIfNeeded();
      await page.screenshot({ path: shotPath(tag, '03b-box-and-note'), fullPage: false });
      console.log('shot', shotPath(tag, '03b-box-and-note'));
      await aside.locator('iframe[title="HTML email preview"]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: shotPath(tag, '03c-preview'), fullPage: false });
      console.log('shot', shotPath(tag, '03c-preview'));
    } else {
      await page.getByRole('button', { name: 'Preview exact email' }).first().click();
      const exact = page.frameLocator('iframe[title="Exact email preview"]');
      await expectVisible(exact.getByText('Holiday lash packages'), `${tag}: exact email`);
      expect(await exact.locator('[data-newsletter="footer-band"]').count() === 1, `${tag}: exact email has one footer`);
      await page.waitForTimeout(400);
      await shot(page, `${tag}-04-exact-email`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Typing in the box: the note goes.
    await box.focus();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('\n<!-- edited -->');
    expect(await content.getByText(NOTE).count() === 0, `${tag}: the note hides once edited`);

    // Sections and back: the box keeps its HTML, nothing fetched again.
    await modeSwitch.getByRole('radio', { name: 'Sections' }).click();
    await expectVisible(aside.getByText('Holiday lash packages').first(), `${tag}: the sections are back`);
    await modeSwitch.getByRole('radio', { name: 'HTML' }).click();
    expect((await box.inputValue()).endsWith('<!-- edited -->'), `${tag}: the box is kept`);
    expect(api.state.sectionsHtmlCalls === 1, `${tag}: no new fetch`);
    await context.close();
  }

  // No sections: today's empty box, no fetch.
  {
    const api = createMockApi({ newsletters: [seeded(78, { blocks: [] })], sectionsHtml: SECTIONS });
    const { page, context } = await open({ width: 1280, height: 1000, api, query: '&newsletterId=78' });
    await page.waitForTimeout(1000);
    await page.getByRole('radiogroup', { name: 'Email content' }).getByRole('radio', { name: 'HTML' }).click();
    const box = page.locator('#nl-step-content').getByLabel('HTML Content');
    await expectVisible(box, 'no sections: the box');
    await page.waitForTimeout(800);
    expect((await box.inputValue()) === '' && !api.state.sectionsHtmlCalls, 'no sections: empty box, no fetch');
    expect(await page.getByText(NOTE).count() === 0, 'no sections: no note');
    await context.close();
  }

  // A failed fetch: the box stays empty, a short error at the bottom of the Content card.
  {
    const api = createMockApi({ newsletters: [seeded(79)], sectionsHtml: SECTIONS });
    api.state.sectionsHtmlFail = true;
    const { page, context } = await open({ width: 390, height: 844, api, query: '&newsletterId=79' });
    await page.waitForTimeout(1000);
    await page.getByRole('radiogroup', { name: 'Email content' }).getByRole('radio', { name: 'HTML' }).click();
    const content = page.locator('#nl-step-content');
    const err = content.locator('[data-nl-html-sections-error]');
    await expectVisible(err, 'failed: error shown');
    expect((await err.innerText().catch(() => '')) === 'Your sections couldn’t be loaded as HTML. Paste your HTML instead.', 'failed: the message');
    expect((await content.getByLabel('HTML Content').inputValue()) === '', 'failed: the box stays empty');
    const [e, c] = [await err.boundingBox(), await content.boundingBox()];
    expect(e && c && c.y + c.height - (e.y + e.height) < 40, 'failed: at the bottom of the card');
    await err.scrollIntoViewIfNeeded();
    await page.screenshot({ path: shotPath('390', '05-fetch-failed'), fullPage: false });
    console.log('shot', shotPath('390', '05-fetch-failed'));
    await context.close();
  }
}

const phone = (tag) => tag === '390';
function shotPath(tag, file) {
  const dir = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
  return `${dir}/c23-sections-to-html-${tag}-${file}.png`;
}
