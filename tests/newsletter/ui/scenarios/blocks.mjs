// Task 5: title, text (bold / link, clean HTML), button (https only, colour) and divider editors.
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

export async function run({ open, shot, expectVisible, expect }) {
  const { page, context } = await open({ view: 'blocks', width: 900, height: 1700 });
  const gallery = (name) => page.getByTestId(`gallery-${name}`);
  const data = async (name) => JSON.parse(await gallery(name).getByTestId('gallery-data').textContent());

  await gallery('Title').getByLabel('Title', { exact: true }).fill('October offers');
  await gallery('Title').getByRole('radio', { name: 'Medium' }).click();
  const t = await data('Title');
  expect(t.text === 'October offers' && t.size === 'medium', `title text and size saved (got ${JSON.stringify(t)})`);

  const box = gallery('Text').getByRole('textbox', { name: 'Text' });
  await expectVisible(gallery('Text').getByRole('toolbar', { name: 'Text formatting' }), 'text toolbar');
  await expectVisible(box.locator('a[href="https://serpachrysler.ca/deals"]'), 'stored link rendered as a real link');
  await box.evaluate((el) => {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await page.keyboard.type(' Call today.');
  await page.keyboard.down('Shift');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.up('Shift');
  await page.keyboard.press(`${MOD}+b`);
  let html = (await data('Text')).html;
  expect(/<strong>today\.<\/strong>/.test(html), `bold applied (got ${html})`);
  await gallery('Text').getByRole('button', { name: 'Link' }).click();
  await page.getByLabel('Link address').fill('serpachrysler.ca/service');
  await page.getByRole('button', { name: 'Add link' }).click();
  html = (await data('Text')).html;
  expect(html.includes('href="https://serpachrysler.ca/service"'), `link added with https (got ${html})`);
  expect(!/style=|<b>|<span|<div/.test(html), `only the allowed tags are saved (got ${html})`);

  const url = gallery('Button').getByLabel('Opens this link');
  await url.fill('http://serpachrysler.ca');
  await expectVisible(gallery('Button').getByText('Use a link that starts with https://.'), 'http refused');
  expect((await data('Button')).url === '', 'an http link is never saved (the API would refuse the whole draft)');
  await url.fill('serpachrysler.ca/book-now');
  await gallery('Button').getByLabel('Button text').click();
  expect(await url.inputValue() === 'https://serpachrysler.ca/book-now', 'link shown with https after leaving the field');
  await gallery('Button').getByRole('radio', { name: 'Green' }).click();
  const b = await data('Button');
  expect(b.url === 'https://serpachrysler.ca/book-now' && b.color === '#059669', `button link and colour saved (got ${JSON.stringify(b)})`);
  await gallery('Button').getByRole('radio', { name: 'Green' }).press('ArrowRight');
  expect((await data('Button')).color === '#DC2626', 'arrow keys move between colours');

  await gallery('Divider').getByRole('radio', { name: 'Space' }).click();
  expect((await data('Divider')).style === 'space', 'divider style saved');
  await shot(page, '01-gallery');
  await context.close();
}
