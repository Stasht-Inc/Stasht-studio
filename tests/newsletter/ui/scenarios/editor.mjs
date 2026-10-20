// Task 8: the preview is the editor. Add sections with the "+" (keyboard and mouse), edit, reorder, delete;
// phone view; templates other than Basic say Coming soon. Order and content reach the API.
import { IMG, createMockApi, newsletter } from '../mock-api.mjs';

const FILE = new URL('../../../../public/pwa-icon-192.png', import.meta.url).pathname;

// A draft with one of every section, for the screenshots.
const ALL_SECTIONS = [
  { id: 'b1', type: 'image', data: { url: IMG, alt: 'Showroom', link: null } },
  { id: 'b2', type: 'title', data: { text: 'October at Serpa Chrysler', size: 'large' } },
  { id: 'b3', type: 'text', data: { html: '<p>Winter tires are in. Book your swap before the first snow and get a <strong>free</strong> wiper set. <a href="https://serpachrysler.ca/tires">See tire deals</a>.</p><ul><li>Free inspection</li><li>Same-day install</li></ul>' } },
  { id: 'b4', type: 'youtube', data: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
  { id: 'b5', type: 'button', data: { label: 'Book a test drive', url: 'https://serpachrysler.ca/book', color: '#6C60FF' } },
  { id: 'b6', type: 'divider', data: { style: 'line' } },
];
const seeded = () => createMockApi({
  businessAddress: '4505 Steeles Ave W, Toronto, ON',
  newsletters: [newsletter(31, { name: 'October Newsletter 2026', subject: 'October deals are here', preview_text: 'New arrivals and service specials', from_name: 'Serpa Chrysler', reply_to_email: 'sales@serpachrysler.ca', blocks: ALL_SECTIONS })],
});

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const { page, api, context } = await open({ width: 1280, height: 1800 });
  const preview = page.locator('aside');
  // Before any typing: an untouched new draft takes the brand header when it arrives.
  await expectVisible(preview.getByText('Serpa Chrysler').first(), 'header pre-filled from the brand');
  await expectVisible(preview.getByText('Powered by Stasht'), 'footer');
  await expectVisible(preview.getByText('Tap + to add your first section.'), 'empty email hint');
  await page.locator('#nl-name').fill('Editor check');

  const top = preview.getByRole('button', { name: 'Add a section at the top' });
  await top.focus();
  await page.keyboard.press('Enter');
  await expectVisible(page.getByRole('menu', { name: 'Sections' }), 'Add section popover');
  await shot(page, '1280-01-add-section');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await preview.getByLabel('Title', { exact: true }).fill('This month at Serpa');

  const addAfter = async (n, item) => {
    await preview.getByRole('button', { name: `Add a section after section ${n}` }).click();
    await page.getByRole('menuitem', { name: new RegExp(`^${item}`) }).click();
  };
  await addAfter(1, 'Text');
  await preview.getByRole('textbox', { name: 'Text', exact: true }).click();
  await page.keyboard.type('Winter tires are in.');
  await addAfter(2, 'Button');
  await addAfter(3, 'Divider');

  await preview.getByRole('group', { name: 'Divider section' }).click();
  await preview.getByRole('button', { name: 'Move up' }).click();
  await preview.getByRole('button', { name: 'Delete section' }).click();
  await addAfter(3, 'Image');
  await preview.getByTestId(/-image-input$/).setInputFiles(FILE);
  await expectVisible(preview.locator(`img[src="${IMG}"]`), 'uploaded image in the email');
  await page.waitForTimeout(1500);

  const saved = api.state.newsletters[0];
  const types = (saved?.blocks || []).map((b) => b.type);
  expect(JSON.stringify(types) === JSON.stringify(['title', 'text', 'button', 'image']), `sections saved in order (got ${types})`);
  expect(saved?.blocks?.[1]?.data?.html?.includes('Winter tires are in.'), 'text saved');
  expect(saved?.blocks?.[0]?.data?.text === 'This month at Serpa', 'title saved');
  expect(saved?.blocks?.[3]?.data?.url === IMG, 'image saved');
  await shot(page, '1280-02-sections');

  // The header is edited in place too.
  await preview.getByRole('group', { name: 'Header' }).click();
  await expectVisible(preview.getByLabel('Header title'), 'header editor opens');
  await preview.getByLabel('Header title').fill('Serpa Chrysler Jeep');
  await page.waitForTimeout(1200);
  expect(api.state.newsletters[0]?.header?.title === 'Serpa Chrysler Jeep', 'header saved with the draft');
  await shot(page, '1280-03-header-editor');

  await page.getByRole('radio', { name: 'Phone view' }).click();
  await shot(page, '1280-04-phone-view');
  await page.getByRole('radio', { name: 'Desktop view' }).click();

  await page.getByRole('button', { name: /^Featured/ }).click();
  await expectVisible(page.getByText('Coming soon'), 'Featured says Coming soon');
  await shot(page, '1280-05-coming-soon');
  await page.keyboard.press('Escape');
  for (const name of ['Minimal', 'Promotional']) {
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await expectVisible(page.getByText(`The ${name} template is on its way.`, { exact: false }), `${name} says Coming soon`);
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: /Design from scratch/ }).click();
  await expectVisible(page.getByText('Design from scratch is on its way. Basic is ready to use now.'), 'Design from scratch says Coming soon');
  await page.keyboard.press('Escape');
  expect(api.state.newsletters[0]?.template === 'basic', 'template stays basic');
  await context.close();

  // Every section type, at 1280 and on phones.
  const all = await open({ api: seeded(), query: '&newsletterId=31', width: 1280, height: 2600 });
  await expectVisible(all.page.locator('aside').getByText('October at Serpa Chrysler'), 'seeded sections');
  await all.page.waitForTimeout(500);
  await shot(all.page, '1280-06-every-section');
  await all.page.locator('aside').getByRole('group', { name: 'Button section' }).click();
  await shot(all.page, '1280-07-button-selected');
  expect(all.api.state.calls.every((c) => c.method !== 'PUT'), 'opening and selecting saves nothing');
  await all.context.close();

  for (const width of [360, 375, 390]) {
    const phone = await open({ api: seeded(), query: '&newsletterId=31', width, height: 844 });
    const aside = phone.page.locator('aside');
    await expectVisible(aside.getByText('October at Serpa Chrysler'), `sections at ${width}`);
    await aside.getByRole('group', { name: 'Text section' }).click();
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width} (text selected)`);
    await aside.getByRole('group', { name: 'Button section' }).click();
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width} (button selected)`);
    await aside.getByRole('group', { name: 'Header' }).click();
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width} (header selected)`);
    await aside.getByRole('button', { name: 'Add a section after section 2' }).click();
    await expectVisible(phone.page.getByRole('menu', { name: 'Sections' }), `Add section popover at ${width}`);
    const box = await phone.page.getByRole('menu', { name: 'Sections' }).boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= width, `Add section popover fits at ${width}`);
    if (width === 390) {
      await phone.page.setViewportSize({ width, height: 4200 });
      await shot(phone.page, '390-01-add-section');
      await phone.page.keyboard.press('Escape');
      await phone.page.getByRole('radio', { name: 'Phone view' }).click();
      expect(!(await hasOverflow(phone.page)), 'no sideways scroll at 390 in phone view');
      await shot(phone.page, '390-02-every-section');
      await phone.page.getByRole('button', { name: /^Featured/ }).click();
      await shot(phone.page, '390-03-coming-soon');
      await phone.page.keyboard.press('Escape');
    }
    await phone.context.close();
  }
}
