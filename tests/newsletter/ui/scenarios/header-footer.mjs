// Task 7: header logo / colour / banner / title, and the e-card footer with the business address.
import { IMG } from '../mock-api.mjs';

const FILE = new URL('../../../../public/pwa-icon-192.png', import.meta.url).pathname;

export async function run({ open, shot, expectVisible, expect }) {
  const { page, api, context } = await open({ view: 'blocks', width: 900, height: 3800 });
  const gallery = (name) => page.getByTestId(`gallery-${name}`);
  const data = async (name) => JSON.parse(await gallery(name).getByTestId('gallery-data').textContent());
  const h = gallery('Header');

  await expectVisible(h.getByText('Serpa Chrysler').first(), 'header title shown');
  await h.getByTestId('nl-logo-input').setInputFiles(FILE);
  await expectVisible(h.locator(`img[src="${IMG}"]`), 'logo shown');
  await h.getByRole('radio', { name: 'Green' }).click();
  expect((await data('Header')).background_color === '#059669', 'background colour saved');
  await h.getByRole('radio', { name: 'Banner image' }).click();
  await h.getByTestId('nl-banner-input').setInputFiles(FILE);
  await h.getByLabel('Header title').fill('Serpa Chrysler Jeep');
  // The banner upload finishes on its own time; give it a moment before reading what was saved.
  let header = await data('Header');
  for (let i = 0; i < 40 && header.banner_url !== IMG; i += 1) {
    await page.waitForTimeout(100);
    header = await data('Header');
  }
  expect(header.banner_url === IMG && header.logo_url === IMG && header.title === 'Serpa Chrysler Jeep', `header saved (got ${JSON.stringify(header)})`);
  await shot(page, '00-header-banner');
  await h.getByRole('radio', { name: 'Colour', exact: true }).click();
  expect((await data('Header')).banner_url === null, 'switching back to Colour removes the banner');

  const f = gallery('Footer');
  await expectVisible(f.getByText('Samantha Smith'), 'e-card name from /user/profile');
  await expectVisible(f.getByText('samantha@serpachrysler.ca'), 'e-card email');
  await expectVisible(f.getByText('+1 416 555 0100'), 'e-card phone (GET /user/profile `phone`)');
  await expectVisible(f.getByText('serpachrysler.ca', { exact: true }), 'website without https://');
  await expectVisible(f.getByRole('img', { name: 'Instagram' }), 'social icon');
  await expectVisible(f.getByText('Unsubscribe'), 'unsubscribe line');
  await expectVisible(f.getByText('Powered by Stasht'), 'Powered by Stasht');
  await f.getByLabel('Business address').fill('4505 Steeles Ave W, Toronto, ON');
  await f.getByRole('button', { name: 'Save address' }).click();
  await expectVisible(f.getByText('4505 Steeles Ave W, Toronto, ON'), 'address shown');
  expect(api.state.calls.some((c) => c.method === 'PUT' && c.path === '/newsletter-brand' && c.body?.business_address === '4505 Steeles Ave W, Toronto, ON'), 'address saved to the brand');
  await shot(page, '01-header-footer');
  await context.close();
}
