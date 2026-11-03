// Chris (3 Nov): "We need option to add background image. Also when I upload a logo, I need to be able to adjust
// the size. When I add the BMW logo, it is way too small." Header logo size (Small / Medium / Large) and one
// switch "Header background: Colour | Image" (Image = a picture behind the logo and name, the colour kept as the
// fallback). Banners are no longer offered; an old one can be removed. The pictures are drawn here, locally.

const WIDE = 'https://127.0.0.1/nl-design/logo-wide.svg';
const ROUND = 'https://127.0.0.1/nl-design/logo-round.svg';
const PHOTO = 'https://127.0.0.1/nl-design/showroom.svg';
const SVGS = {
  'logo-wide.svg': `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="150" viewBox="0 0 600 150"><g transform="translate(75 75)"><circle r="70" fill="#111"/><circle r="62" fill="none" stroke="#fff" stroke-width="3"/><circle r="44" fill="#fff"/><path d="M0 0 L0 -44 A44 44 0 0 1 44 0 Z" fill="#1C69D4"/><path d="M0 0 L0 44 A44 44 0 0 1 -44 0 Z" fill="#1C69D4"/></g><text x="165" y="92" font-family="Arial" font-weight="700" font-size="54" fill="#1C69D4">Serpa Motors</text></svg>`,
  'logo-round.svg': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="-100 -100 200 200"><circle r="96" fill="#111"/><circle r="86" fill="none" stroke="#fff" stroke-width="4"/><circle r="60" fill="#fff"/><path d="M0 0 L0 -60 A60 60 0 0 1 60 0 Z" fill="#1C69D4"/><path d="M0 0 L0 60 A60 60 0 0 1 -60 0 Z" fill="#1C69D4"/></svg>`,
  'showroom.svg': `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ec5ff"/><stop offset="0.6" stop-color="#f4f7fb"/><stop offset="1" stop-color="#d9dde3"/></linearGradient></defs><rect width="1200" height="400" fill="url(#s)"/><rect y="290" width="1200" height="110" fill="#c9ced6"/><g fill="#fff" opacity="0.8"><rect x="80" y="40" width="160" height="230"/><rect x="300" y="40" width="160" height="230"/><rect x="740" y="40" width="160" height="230"/><rect x="960" y="40" width="160" height="230"/></g><path d="M330 300 Q360 220 470 205 L640 195 Q760 195 840 250 L900 262 Q930 270 930 300 Z" fill="#1b2a44"/><circle cx="440" cy="305" r="34" fill="#222"/><circle cx="800" cy="305" r="34" fill="#222"/></svg>`,
};
const FILE = new URL('../../../../public/pwa-icon-192.png', import.meta.url).pathname;
const OUT = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';

/** The Header gallery alone (the page shot is 3800 px of every editor). */
async function headerShot(locator, file) {
  const path = `${OUT}/header-design-${file}.png`;
  await locator.screenshot({ path });
  console.log('shot', path);
}

async function serveDrawings(page) {
  await page.route('https://127.0.0.1/nl-design/**', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVGS[name] });
  });
}

export async function run({ open, expectVisible, expect, hasOverflow }) {
  const { page, api, context } = await open({ view: 'blocks', width: 1280, height: 3800 });
  await serveDrawings(page);
  const h = page.getByTestId('gallery-Header');
  const data = async () => JSON.parse(await h.getByTestId('gallery-data').textContent());
  const until = async (check) => { for (let i = 0; i < 40 && !check(await data()); i += 1) await page.waitForTimeout(100); return data(); };
  const logoBox = async () => h.locator('[data-nl-logo-size]').boundingBox();
  const near = (a, b) => Math.abs(a - b) <= 1.5;
  const checked = async (name) => (await h.getByRole('radio', { name, exact: true }).getAttribute('aria-checked')) === 'true';

  // One background switch, no banner option, no separate picture row; nothing to size without a logo.
  await expectVisible(h.getByRole('radiogroup', { name: 'Header background' }), 'Header background switch');
  expect(await checked('Colour'), 'Colour is chosen by default');
  expect(await h.getByRole('radio', { name: 'Banner image' }).count() === 0, 'no Banner image option');
  expect(await h.getByText('Background image', { exact: true }).count() === 0, 'no separate Background image row');
  expect(await h.getByRole('button', { name: 'Upload image' }).count() === 0, 'no picture upload while Colour is chosen');
  expect(await h.getByText('Banner image in use').count() === 0, 'no banner line without a banner');
  await expectVisible(h.getByText('Background colour', { exact: true }), 'Colour: the swatches as today');
  expect(await h.getByRole('radiogroup', { name: 'Logo size' }).count() === 0, 'no size control without a logo');
  await headerShot(h, '00-panel-colour');

  // A wide BMW-like logo: Small is the old 48 px and the default; nothing new is saved.
  api.state.uploadUrl = WIDE;
  await h.getByTestId('nl-logo-input').setInputFiles(FILE);
  await expectVisible(h.locator(`img[src="${WIDE}"]`), 'wide logo shown');
  await page.waitForFunction(() => document.querySelector('[data-nl-logo-size]')?.complete);
  let header = await data();
  expect(header.logo_url === WIDE && !('logo_size' in header) && !('logo_ratio' in header), `small: no new keys (got ${JSON.stringify(header)})`);
  expect(await checked('Small'), 'Small is chosen by default');
  let box = await logoBox();
  expect(near(box.height, 48), `small logo is 48 px tall (got ${box.height})`);
  await headerShot(h, '01-wide-logo-small');

  await h.getByRole('radio', { name: 'Medium' }).click();
  header = await until((d) => d.logo_size === 'medium');
  expect(header.logo_size === 'medium' && header.logo_ratio === 4, `medium saved with the logo's shape (got ${JSON.stringify(header)})`);
  box = await logoBox();
  expect(near(box.height, 80) && near(box.width, 320), `medium logo is 320 × 80 (got ${box.width} × ${box.height})`);
  await headerShot(h, '02-wide-logo-medium');

  await h.getByRole('radio', { name: 'Large' }).click();
  header = await until((d) => d.logo_size === 'large');
  box = await logoBox();
  // 480 × 120, or narrower (same shape) where the column is: this gallery's is 470 inside the sides.
  const room = (await h.locator('[data-nl-header]').boundingBox()).width - 80;
  expect(near(box.width, Math.min(480, room)) && near(box.width / box.height, 4), `large logo is 480 × 120 or fits the column (got ${box.width} × ${box.height}, room ${room})`);
  await headerShot(h, '03-wide-logo-large');

  // A new logo keeps the size and is measured again (round: 120 × 120).
  api.state.uploadUrl = ROUND;
  await h.getByTestId('nl-logo-input').setInputFiles(FILE);
  header = await until((d) => d.logo_url === ROUND && d.logo_ratio === 1);
  expect(header.logo_size === 'large' && header.logo_ratio === 1, `new logo: size kept, shape measured again (got ${JSON.stringify(header)})`);
  box = await logoBox();
  expect(near(box.height, 120) && near(box.width, 120), `round large logo is 120 × 120 (got ${box.width} × ${box.height})`);

  // Image: upload a picture; the swatches stay below as the fallback colour.
  // Orange would take a dark name on the colour alone; on the picture it is white.
  await h.getByRole('radio', { name: 'Orange' }).click();
  await h.getByRole('radio', { name: 'Image', exact: true }).click();
  expect(await checked('Image'), 'Image chosen');
  expect(!('background_image_url' in await data()), 'choosing Image alone saves nothing');
  await expectVisible(h.getByRole('button', { name: 'Upload image' }), 'Image: Upload image');
  await expectVisible(h.getByText('Fallback colour', { exact: true }), 'Image: swatches labelled Fallback colour');
  await expectVisible(h.getByText('Shown where email apps hide images'), 'Image: fallback hint');
  api.state.uploadUrl = PHOTO;
  await h.getByTestId('nl-header-bg-input').setInputFiles(FILE);
  header = await until((d) => d.background_image_url === PHOTO);
  expect(header.background_image_url === PHOTO && header.background_color === '#F59E0B', `picture saved, colour kept (got ${JSON.stringify(header)})`);
  const pic = h.locator('[data-nl-header-picture]');
  expect((await pic.evaluate((el) => getComputedStyle(el).backgroundImage)).includes('showroom.svg'), 'the picture is the header background');
  expect(await h.getByText('Serpa Chrysler').first().evaluate((el) => getComputedStyle(el).color) === 'rgb(255, 255, 255)', 'the name is white on the picture');
  await expectVisible(h.getByRole('button', { name: 'Replace image' }), 'Replace image');
  await headerShot(h, '04-image-on-1280');

  await h.getByRole('button', { name: 'Remove image' }).click();
  header = await data();
  expect(!('background_image_url' in header), `Remove image leaves no key (got ${JSON.stringify(header)})`);
  expect(await h.locator('[data-nl-header-picture]').count() === 0, 'no picture after Remove');
  await expectVisible(h.getByRole('button', { name: 'Upload image' }), 'still on Image, ready for another picture');

  // Colour with a picture: the picture goes, the swatches are the background colour again.
  await h.getByTestId('nl-header-bg-input').setInputFiles(FILE);
  await until((d) => d.background_image_url === PHOTO);
  await h.getByRole('radio', { name: 'Colour', exact: true }).click();
  header = await data();
  expect(!('background_image_url' in header), `Colour removes the picture (got ${JSON.stringify(header)})`);
  await expectVisible(h.getByText('Background colour', { exact: true }), 'Colour: Background colour label');
  expect(await h.getByText('Shown where email apps hide images').count() === 0, 'no fallback hint on Colour');
  await headerShot(h, '05-image-off-colour');

  // Small again: the header is exactly an old one.
  await h.getByRole('radio', { name: 'Small' }).click();
  header = await data();
  expect(!('logo_size' in header) && !('logo_ratio' in header), `back to small: no keys (got ${JSON.stringify(header)})`);
  await context.close();

  // A header saved with a banner before: still drawn, and it can be removed (no new banner upload).
  const old = await open({ view: 'blocks', width: 1280, height: 3800, query: '&headerBanner=1' });
  const oh = old.page.getByTestId('gallery-Header');
  await expectVisible(oh.getByText('Banner image in use'), 'old banner: "Banner image in use"');
  expect(await oh.locator('img[src="https://127.0.0.1/nl-img/pwa-icon-512.png"]').count() === 1, 'old banner still drawn');
  expect(await oh.getByTestId('nl-banner-input').count() === 0, 'no banner upload');
  await headerShot(oh, '06-old-banner-in-use');
  await oh.getByRole('button', { name: 'Remove banner' }).click();
  const cleared = JSON.parse(await oh.getByTestId('gallery-data').textContent());
  expect(cleared.banner_url === null, `Remove banner clears it (got ${JSON.stringify(cleared)})`);
  expect(await oh.getByText('Banner image in use').count() === 0, 'banner line gone');
  await old.context.close();

  // Phone (390): the wide logo at Large plus a picture fits without sideways scrolling.
  const phone = await open({ view: 'blocks', width: 390, height: 2400 });
  await serveDrawings(phone.page);
  const ph = phone.page.getByTestId('gallery-Header');
  phone.api.state.uploadUrl = WIDE;
  await ph.getByTestId('nl-logo-input').setInputFiles(FILE);
  await expectVisible(ph.locator(`img[src="${WIDE}"]`), 'phone: logo shown');
  await phone.page.waitForFunction(() => document.querySelector('[data-nl-logo-size]')?.complete);
  await ph.getByRole('radio', { name: 'Large' }).click();
  await headerShot(ph, '07-phone-390-colour');
  await ph.getByRole('radio', { name: 'Image', exact: true }).click();
  phone.api.state.uploadUrl = PHOTO;
  await ph.getByTestId('nl-header-bg-input').setInputFiles(FILE);
  for (let i = 0; i < 40 && (await ph.locator('[data-nl-header-picture]').count()) === 0; i += 1) await phone.page.waitForTimeout(100);
  const pbox = await ph.locator('[data-nl-logo-size]').boundingBox();
  const hbox = await ph.locator('[data-nl-header]').boundingBox();
  expect(pbox.x >= hbox.x && pbox.x + pbox.width <= hbox.x + hbox.width + 0.5, `phone: the logo stays inside the header (logo ${pbox.x}+${pbox.width}, header ${hbox.x}+${hbox.width})`);
  expect(near(pbox.width / pbox.height, 4), `phone: the logo keeps its shape (got ${pbox.width} × ${pbox.height})`);
  expect(!(await hasOverflow(phone.page)), 'phone: nothing scrolls sideways');
  await headerShot(ph, '08-phone-390-image');
  await phone.context.close();
}
