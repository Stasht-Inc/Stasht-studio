// [wdy2xh2t3x] Every editor in the preview can be closed: Done (bottom right), × (top right), Escape, or a tap
// outside the selected part. Changes are already saved; focus goes back to the part that was being edited.
import { createMockApi, newsletter } from '../mock-api.mjs';

const BLOCKS = [
  { id: 'b1', type: 'title', data: { text: 'October at Serpa', size: 'large' } },
  { id: 'b2', type: 'text', data: { html: '<p>Winter tires are in.</p>' } },
  { id: 'b3', type: 'button', data: { label: 'Book now', url: 'https://serpachrysler.ca/book', color: '#6C60FF' } },
];
const seeded = () => createMockApi({
  businessAddress: '4505 Steeles Ave W, Toronto, ON',
  newsletters: [newsletter(61, { name: 'Close check', subject: 'Hello', blocks: BLOCKS })],
});
const focusedLabel = (page) => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName);

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const { page, context, api } = await open({ width: 1280, height: 1400, query: '&newsletterId=61', api: seeded() });
  const preview = page.locator('aside');
  const header = preview.getByRole('group', { name: 'Header' });
  const title = page.locator('#nl-header-title');
  await expectVisible(header, 'header');

  // Header: ×.
  await header.click();
  await expectVisible(title, 'header editor opens');
  await title.fill('Serpa Chrysler Jeep');
  await shot(page, '1280-01-header-open');
  await header.getByRole('button', { name: 'Close editor' }).click();
  expect(!(await title.count()), '× closes the header editor');
  expect(await focusedLabel(page) === 'Header', `focus back on the header after × (got ${await focusedLabel(page)})`);
  await page.waitForTimeout(1200);
  expect(api.state.newsletters[0].header.title === 'Serpa Chrysler Jeep', 'the change was saved');

  // Header: Done.
  await header.click();
  await header.getByRole('button', { name: 'Done' }).click();
  expect(!(await title.count()), 'Done closes the header editor');
  expect(await focusedLabel(page) === 'Header', 'focus back on the header after Done');

  // Header: Escape closes the editor, not the composer.
  await header.click();
  await title.focus();
  await page.keyboard.press('Escape');
  expect(!(await title.count()), 'Escape closes the header editor');
  expect(await page.locator('#nl-composer-title').isVisible(), 'Escape did not close the composer');
  expect(await focusedLabel(page) === 'Header', 'focus back on the header after Escape');

  // Sections: Done, ×, Escape and a tap outside.
  const section = (name) => preview.getByRole('group', { name: `${name} section` });
  await section('Title').click();
  const toolbar = preview.getByRole('toolbar', { name: 'Title section actions' });
  await expectVisible(toolbar, 'title toolbar');
  await expectVisible(section('Title').getByRole('button', { name: 'Done' }), 'Done under the title editor');
  await shot(page, '1280-02-section-open');
  await section('Title').getByRole('button', { name: 'Done' }).click();
  expect(!(await toolbar.count()), 'Done closes the title editor');
  expect(await focusedLabel(page) === 'Title section', `focus back on the section (got ${await focusedLabel(page)})`);

  await section('Button').click();
  await section('Button').getByRole('button', { name: 'Close editor' }).click();
  expect(!(await section('Button').getByLabel('Button text').count()), '× closes the button editor');

  await section('Text').click();
  await section('Text').getByRole('textbox', { name: 'Text' }).click();
  await page.keyboard.press('Escape');
  expect(!(await preview.getByRole('toolbar', { name: 'Text formatting' }).count()), 'Escape closes the text editor');
  expect(await page.locator('#nl-composer-title').isVisible(), 'and the composer stays open');

  await section('Button').click();
  await preview.getByText('Powered by Stasht').click();
  expect(!(await section('Button').getByLabel('Button text').count()), 'a tap outside the section closes its editor');

  // With nothing selected, Escape still works like Cancel.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  expect(!(await page.locator('#nl-composer-title').isVisible()), 'Escape with nothing selected closes the composer');
  await context.close();

  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 860, query: '&newsletterId=61', api: seeded() });
    const h = phone.page.getByRole('group', { name: 'Header' });
    await h.click();
    await expectVisible(h.getByRole('button', { name: 'Done' }), `Done on a ${width} phone`);
    await expectVisible(h.getByRole('button', { name: 'Close editor' }), `× on a ${width} phone`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width} (header editor)`);
    if (width === 390) await shot(phone.page, '390-01-header-open');
    await h.getByRole('button', { name: 'Done' }).click();
    const s = phone.page.getByRole('group', { name: 'Button section' });
    await s.click();
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width} (section editor)`);
    if (width === 390) { await s.scrollIntoViewIfNeeded(); await shot(phone.page, '390-02-section-open'); }
    await s.getByRole('button', { name: 'Done' }).click();
    expect(!(await s.getByLabel('Button text').count()), `Done closes on a ${width} phone`);
    await phone.context.close();
  }
}
