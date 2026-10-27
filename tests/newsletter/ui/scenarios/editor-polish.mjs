// wdy2xh2p3p Editor polish: deleting a section offers Undo; big phone photos are shrunk and saved as JPEG before
// upload (HEIC the browser can't open gets a clear message); pasted formatting keeps only what the email allows;
// the exact-email preview warns from 80 KB; both send buttons say "Send Now".
import { createMockApi } from '../mock-api.mjs';

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // 1. Gallery: paste and phone photos.
  let { page, api, context } = await open({ view: 'blocks', width: 900, height: 2600 });
  const gallery = (name) => page.getByTestId(`gallery-${name}`);
  const data = async (name) => JSON.parse(await gallery(name).getByTestId('gallery-data').textContent());

  const text = gallery('Text').getByRole('textbox', { name: 'Text' });
  await text.click();
  await page.keyboard.press('End');
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="gallery-Text"] [role="textbox"]');
    const dt = new DataTransfer();
    dt.setData('text/html', '<meta charset="utf-8"><b style="font-weight:normal" id="docs-internal-guid-1"><p><span style="font-size:40px;color:red">Pasted </span><strong>bold</strong> <a href="javascript:alert(1)">bad</a> <a href="https://serpachrysler.ca/x">link</a></p></b><script>alert(1)</script>');
    dt.setData('text/plain', 'Pasted bold bad link');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(200);
  const html = (await data('Text')).html;
  expect(html.includes('Pasted <strong>bold</strong> bad <a href="https://serpachrysler.ca/x">link</a>'), `pasted formatting kept (got ${html})`);
  expect(!/style|script|javascript|font-size|docs-internal/.test(html), `nothing else pasted (got ${html})`);
  expect(!/<strong>Pasted/.test(html), 'Google Docs wrapper did not make it bold');
  await shot(page, '00-paste');

  // A 4000 x 3000 phone photo: shrunk to 1600 px and re-saved as JPEG before it is sent.
  const big = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 4000; c.height = 3000;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(4000, 3000);
    for (let i = 0; i < img.data.length; i += 4) { img.data[i] = (i * 7) % 255; img.data[i + 1] = (i * 13) % 255; img.data[i + 2] = (i * 3) % 255; img.data[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.95).split(',')[1];
  });
  const original = Buffer.from(big, 'base64');
  const imgGallery = gallery('Image');
  await imgGallery.getByTestId('g-image-image-input').setInputFiles({ name: 'IMG_0042.jpeg', mimeType: 'image/jpeg', buffer: original });
  await page.waitForTimeout(2500);
  const up = api.state.uploads[0];
  expect(up && up.type === 'image/jpeg', `uploaded as JPEG (got ${JSON.stringify(up)})`);
  expect(up && up.bytes < original.length / 2, `photo shrunk before upload (${original.length} → ${up?.bytes})`);
  expect(up && up.name === 'IMG_0042.jpg', `file name kept (got ${up?.name})`);

  // HEIC this browser can't open: a clear message, nothing uploaded.
  const uploadsBefore = api.state.uploads.length;
  await imgGallery.getByTestId('g-image-image-input').setInputFiles({ name: 'IMG_0043.HEIC', mimeType: 'image/heic', buffer: Buffer.from('not really a heic file') });
  await expectVisible(page.getByText("This browser can't open HEIC photos. Save the photo as a JPG and try again."), 'HEIC message');
  expect(api.state.uploads.length === uploadsBefore, 'nothing uploaded for an unreadable HEIC');
  // Review fix 3: the picker doesn't ask for HEIC, so iPhones hand over a JPEG (a dropped HEIC is still handled).
  expect(!/heic|heif/i.test(await imgGallery.getByTestId('g-image-image-input').getAttribute('accept')), 'the picker does not offer HEIC');
  await context.close();

  // 2. Composer: Undo a deleted section; "Send Now" on both buttons; the size hint in the exact preview.
  ({ page, api, context } = await open({ width: 1280, height: 1400, api: createMockApi({ previewSizeKb: 92 }) }));
  const preview = page.locator('aside');
  await page.locator('#nl-name').fill('Polish check');
  await preview.getByRole('button', { name: 'Add a section at the top' }).click();
  await page.getByRole('menuitem', { name: /^Title/ }).click();
  await preview.getByLabel('Title', { exact: true }).fill('Keep me');
  await page.waitForTimeout(1200);
  await preview.getByRole('button', { name: 'Delete section' }).click();
  expect(await preview.getByLabel('Title', { exact: true }).count() === 0, 'section deleted');
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  await expectVisible(undo, 'Undo on the deleted toast');
  await page.waitForTimeout(400);
  await shot(page, '1280-01-undo');
  await undo.click();
  await expectVisible(preview.getByLabel('Title', { exact: true }), 'section back after Undo');
  expect(await preview.getByLabel('Title', { exact: true }).inputValue() === 'Keep me', 'with its words');
  await page.waitForTimeout(1500);
  expect(api.state.newsletters[0]?.blocks?.[0]?.data?.text === 'Keep me', 'restored section saved');

  expect(await page.locator('header').getByRole('button', { name: 'Send Now', exact: true }).count() === 1, 'header says Send Now');
  expect(await page.getByRole('button', { name: 'Send Now', exact: true }).count() === 2, 'bottom button says Send Now too');

  await preview.getByRole('button', { name: 'Preview exact email' }).click();
  const hint = page.getByText('About 92 KB — Gmail hides the end of emails over about 100 KB.');
  await expectVisible(hint, 'size hint in the exact preview');
  await page.waitForTimeout(300);
  await shot(page, '1280-02-size-hint');
  await context.close();

  // Under 80 KB: no hint.
  ({ page, api, context } = await open({ width: 1280, height: 1000, api: createMockApi({ previewSizeKb: 40 }) }));
  await page.locator('#nl-name').fill('Small');
  await page.locator('aside').getByRole('button', { name: 'Preview exact email' }).click();
  await page.locator('iframe[title="Exact email preview"]').waitFor();
  expect(await page.getByText(/Gmail hides the end/).count() === 0, 'no hint under 80 KB');
  await context.close();

  // 3. Phones.
  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 844, api: createMockApi({ previewSizeKb: 92 }) });
    await phone.page.locator('#nl-name').fill('Phone polish');
    await phone.page.locator('aside').getByRole('button', { name: 'Preview exact email' }).click();
    await expectVisible(phone.page.getByText(/About 92 KB/), `size hint at ${width}`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width}`);
    if (width === 390) await shot(phone.page, '390-size-hint');
    await phone.context.close();
  }
}
