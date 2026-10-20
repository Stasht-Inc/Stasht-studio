// Task 6: image upload (and its limits), image link https-only, YouTube thumbnail.
import { IMG } from '../mock-api.mjs';

const FILE = new URL('../../../../public/pwa-icon-192.png', import.meta.url).pathname;

export async function run({ open, shot, expectVisible, expect }) {
  const { page, api, context } = await open({ view: 'blocks', width: 900, height: 2600 });
  const gallery = (name) => page.getByTestId(`gallery-${name}`);
  const data = async (name) => JSON.parse(await gallery(name).getByTestId('gallery-data').textContent());
  const img = gallery('Image');

  await expectVisible(img.getByText('Drop an image here, or'), 'empty image drop zone');
  await shot(page, '00-empty');
  await img.getByTestId('g-image-image-input').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(6 * 1024 * 1024) });
  await expectVisible(page.getByText('Images can be up to 5 MB. Choose a smaller one.'), 'too-big image refused before upload');
  expect(!api.state.calls.some((c) => c.path === '/newsletters/images'), 'nothing uploaded for a too-big file');
  await img.getByTestId('g-image-image-input').setInputFiles(FILE);
  await expectVisible(img.locator(`img[src="${IMG}"]`), 'uploaded image shown');
  expect(api.state.calls.some((c) => c.method === 'POST' && c.path === '/newsletters/images'), 'upload sent to /newsletters/images');
  await img.getByLabel('Describe the image').fill('Red Jeep in the showroom');
  await img.getByLabel('Link when tapped').fill('http://serpachrysler.ca');
  await img.getByLabel('Describe the image').click();
  await expectVisible(img.getByText('Use a link that starts with https://.'), 'http image link refused');
  expect((await data('Image')).link === null, 'an http image link is never saved');
  await img.getByLabel('Link when tapped').fill('serpachrysler.ca/jeep');
  await img.getByLabel('Describe the image').click();
  const d = await data('Image');
  expect(d.url === IMG && d.alt === 'Red Jeep in the showroom' && d.link === 'https://serpachrysler.ca/jeep', `image data saved (got ${JSON.stringify(d)})`);
  await expectVisible(img.getByRole('button', { name: 'Replace image' }), 'Replace image');

  const yt = gallery('YouTube');
  await yt.getByLabel('YouTube link').fill('https://vimeo.com/1');
  await expectVisible(yt.getByText('That doesn’t look like a YouTube link.'), 'non-YouTube link flagged');
  expect((await data('YouTube')).url === '', 'a non-YouTube link is never saved');
  await yt.getByLabel('YouTube link').fill('https://youtu.be/dQw4w9WgXcQ');
  await expectVisible(yt.locator('img[src="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"]'), 'YouTube thumbnail with play button');
  expect((await data('YouTube')).url === 'https://youtu.be/dQw4w9WgXcQ', 'YouTube link saved');
  await expectVisible(yt.getByText('Watch on YouTube'), 'Watch on YouTube line, as in the email');
  await shot(page, '01-media');
  await context.close();
}
