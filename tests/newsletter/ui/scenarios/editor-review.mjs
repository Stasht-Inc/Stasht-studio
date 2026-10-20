// Editor review fixes (Tasks 4–8): links the API accepts (' encoded), a section deleted during its upload stays
// deleted, one upload at a time, keyboard access to every section and the header, over-long text flagged while
// typing without blocking other saves, drop inserts words only, the link popover hands focus back, and a
// cleared text shows its placeholder and saves as empty.
import { createMockApi, newsletter } from '../mock-api.mjs';

const FILE = new URL('../../../../public/pwa-icon-192.png', import.meta.url).pathname;
const SECTIONS = [
  { id: 'b1', type: 'title', data: { text: 'October at Serpa', size: 'large' } },
  { id: 'b2', type: 'text', data: { html: '<p>Winter tires are in.</p>' } },
  { id: 'b3', type: 'button', data: { label: 'Book', url: 'https://serpachrysler.ca/book', color: '#6C60FF' } },
  { id: 'b4', type: 'divider', data: { style: 'line' } },
];
const seeded = (over = {}) => createMockApi({
  businessAddress: '4505 Steeles Ave W, Toronto, ON',
  newsletters: [newsletter(31, { name: 'Review', subject: 'Deals', from_name: 'Serpa', reply_to_email: 'sales@serpachrysler.ca', blocks: structuredClone(SECTIONS) })],
  ...over,
});
const lastPut = (api) => [...api.state.calls].reverse().find((c) => c.method === 'PUT' && c.path === '/newsletters/31');

export async function run({ open, shot, expectVisible, expect }) {
  const { page, api, context } = await open({ api: seeded({ uploadDelayMs: 1500 }), query: '&newsletterId=31', width: 1280, height: 1800 });
  const aside = page.locator('aside');
  await expectVisible(aside.getByText('October at Serpa'), 'draft opened');

  // 1. A link with ' saves (encoded); the PUT is accepted.
  await aside.getByRole('group', { name: 'Button section' }).click();
  await aside.getByLabel('Opens this link').fill("serpachrysler.ca/it's-here");
  await page.waitForTimeout(1300);
  expect(api.state.newsletters[0].blocks[2].data.url === 'https://serpachrysler.ca/it%27s-here', `button link saved encoded (got ${api.state.newsletters[0].blocks[2].data.url})`);
  expect(lastPut(api)?.status === 200, 'the PUT with that link was accepted');

  // 2. Delete an image section while its picture uploads: it stays deleted. A second file meanwhile is ignored.
  await aside.getByRole('button', { name: 'Add a section after section 4' }).click();
  await page.getByRole('menuitem', { name: /^Image/ }).click();
  const input = aside.getByTestId(/-image-input$/);
  await input.setInputFiles(FILE);
  await expectVisible(aside.getByText('Uploading…'), 'upload on its way');
  await input.setInputFiles(FILE);
  await page.waitForTimeout(100);
  expect(api.state.calls.filter((c) => c.path === '/newsletters/images').length === 1, 'a second file while uploading is ignored');
  await aside.getByRole('group', { name: 'Image section' }).click();
  await aside.getByRole('button', { name: 'Delete section' }).click();
  await page.waitForTimeout(2600);
  expect(await aside.getByRole('group', { name: 'Image section' }).count() === 0, 'the deleted image section did not come back');
  expect(!api.state.newsletters[0].blocks.some((b) => b.type === 'image'), 'no image section saved');

  // 3. Keyboard: the header and sections with no field of their own are tab stops; Enter selects.
  await aside.getByRole('group', { name: 'Header' }).focus();
  await expectVisible(aside.getByLabel('Header title'), 'header selected by focus');
  await aside.getByRole('group', { name: 'Divider section' }).focus();
  await page.keyboard.press('Enter');
  await expectVisible(aside.getByRole('toolbar', { name: 'Divider section actions' }), 'divider selected from the keyboard');
  const tabbable = await aside.getByRole('group', { name: 'Button section' }).getAttribute('tabindex');
  expect(tabbable === '0', 'button section is a tab stop');

  // 4. Over-long text: flagged while typing; other edits still save; the long text is not sent.
  const text = aside.getByRole('textbox', { name: 'Text', exact: true });
  await text.click();
  await page.evaluate(() => {
    const el = document.querySelector('[role="textbox"][aria-label="Text"]');
    el.focus();
    document.execCommand('selectAll');
    document.execCommand('insertText', false, 'x'.repeat(20050));
  });
  await expectVisible(aside.getByText('This text is too long. Split it into two sections.'), 'too long shown while typing');
  await page.locator('#nl-subject').fill('Deals, saved anyway');
  await page.waitForTimeout(1500);
  expect(api.state.newsletters[0].subject === 'Deals, saved anyway', 'other edits still save');
  expect(api.state.newsletters[0].blocks[1].data.html === '<p>Winter tires are in.</p>', 'the over-long text kept its saved version');
  await expectVisible(page.getByRole('status').getByText('Not saved').first(), 'save indicator says something is held back');
  await shot(page, '1280-01-too-long');

  // 5. Cleared text: placeholder, saved as ''. 6. Drop inserts words only.
  await page.evaluate(() => {
    const el = document.querySelector('[role="textbox"][aria-label="Text"]');
    el.focus();
    document.execCommand('selectAll');
    document.execCommand('delete');
  });
  await expectVisible(aside.getByText('Write something…'), 'placeholder on a cleared text');
  await page.waitForTimeout(1400);
  expect(api.state.newsletters[0].blocks[1].data.html === '', `cleared text saved as empty (got ${JSON.stringify(api.state.newsletters[0].blocks[1].data.html)})`);
  await page.evaluate(() => {
    const el = document.querySelector('[role="textbox"][aria-label="Text"]');
    const r = el.getBoundingClientRect();
    const dt = new DataTransfer();
    dt.setData('text/html', '<img src="https://evil.example/x.png"><b>Bold</b>');
    dt.setData('text/plain', 'Dropped words');
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 5, clientY: r.top + 5 }));
  });
  await page.waitForTimeout(1400);
  const html = api.state.newsletters[0].blocks[1].data.html;
  expect(html === '<p>Dropped words</p>', `drop inserted words only (got ${JSON.stringify(html)})`);

  // 7. Link popover: closing hands focus back to the words.
  await page.evaluate(() => {
    const el = document.querySelector('[role="textbox"][aria-label="Text"]');
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await aside.getByRole('button', { name: 'Link', exact: true }).click();
  await expectVisible(page.getByLabel('Link address'), 'link popover');
  await page.waitForTimeout(250); // its Escape listener attaches after mount
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Text'), 'focus back in the text after the link popover');

  // Tabbing onto Bold keeps the selection: the words get bold.
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Bold', 'Shift+Tab reaches Bold');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1400);
  expect(api.state.newsletters[0].blocks[1].data.html === '<p><strong>Dropped words</strong></p>', `Bold from the keyboard kept the selection (got ${JSON.stringify(api.state.newsletters[0].blocks[1].data.html)})`);
  await shot(page, '1280-02-after');
  await context.close();
}
