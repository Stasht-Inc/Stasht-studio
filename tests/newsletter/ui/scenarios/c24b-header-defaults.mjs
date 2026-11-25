// Deepak 24 Nov 2026 (P3): "newsletter should automatically pull in avatar, and add background color". The web API now
// starts a new newsletter's header with the account's avatar as the logo on its brand colour (NewsletterHeaderDefaults:
// GET /newsletter-brand pre-fills the editor, POST /newsletters stores the same header). Here the API answers that
// header; the composer must show it as it is (logo + dark colour + white title) before anything is saved, opening alone
// must create nothing, a changed colour is saved (the logo kept) and still there after re-opening, and an existing
// newsletter keeps its own plain header. 1280 and 390.
import { IMG, createMockApi, newsletter } from '../mock-api.mjs';

const AUTO = { logo_url: IMG, banner_url: null, background_color: '#111827', title: 'Neolegend Sports' };
const OLD = { logo_url: null, banner_url: null, background_color: '#6C60FF', title: 'Serpa Chrysler' };
const existing = () => newsletter(23, {
  name: 'October Newsletter 2026', subject: 'October deals are here', header: structuredClone(OLD),
  blocks: [{ id: 'b1', type: 'title', data: { text: 'This month', size: 'large' } }],
});
const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

async function headerLook(page) {
  const h = page.locator('[data-nl-header]:visible').first();
  return h.evaluate((el) => {
    const bg = el.querySelector(':scope > div');
    const logo = el.querySelector('img');
    const title = el.querySelector('p');
    return {
      bg: bg ? getComputedStyle(bg).backgroundColor : null,
      logo: logo ? logo.getAttribute('src') : null,
      logoLoaded: !!(logo && logo.complete && logo.naturalWidth > 0),
      title: title ? title.textContent : null,
      ink: title ? getComputedStyle(title).color : null,
    };
  });
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const width of [1280, 390]) {
    const api = createMockApi({ newsletters: [existing()], brandHeader: structuredClone(AUTO) });
    const { page, context } = await open({ width, height: 1600, api });
    const header = page.locator('[data-nl-header]:visible').first();
    await expectVisible(header, `${width}: the header is drawn`);
    await expectVisible(header.locator(`img[src="${IMG}"]`), `${width}: the avatar is the logo`);
    await page.waitForTimeout(600);
    let look = await headerLook(page);
    expect(look.bg === rgb('#111827'), `${width}: the header starts on the brand colour (got ${look.bg})`);
    expect(look.logoLoaded, `${width}: the logo image loads`);
    expect(look.title === 'Neolegend Sports', `${width}: the account name is the title (got ${look.title})`);
    expect(look.ink === 'rgb(255, 255, 255)', `${width}: white title on the dark colour (got ${look.ink})`);
    expect(!api.state.calls.some((c) => c.method === 'POST' && c.path === '/newsletters'), `${width}: opening alone creates no draft`);
    expect(!(await hasOverflow(page)), `${width}: nothing scrolls sideways`);
    await shot(page, `${width}-01-new-newsletter-header`);

    // Change the colour: saved with the logo kept.
    await header.click();
    await expectVisible(page.getByLabel('Header title'), `${width}: the header editor opens`);
    await header.getByRole('radio', { name: 'Green' }).click();
    await page.waitForTimeout(2500);
    const created = api.state.newsletters.find((n) => n.id !== 23);
    expect(!!created, `${width}: the first change creates the draft`);
    expect(created?.header?.background_color === '#059669', `${width}: the new colour is saved (got ${created?.header?.background_color})`);
    expect(created?.header?.logo_url === IMG, `${width}: the logo is kept`);
    look = await headerLook(page);
    expect(look.bg === rgb('#059669'), `${width}: the header shows the new colour (got ${look.bg})`);
    await shot(page, `${width}-02-colour-changed`);
    await context.close();

    // Re-open that newsletter: still green with the avatar. The older newsletter keeps its own plain header.
    const again = await open({ width, height: 1600, api, query: `&newsletterId=${created?.id}` });
    await expectVisible(again.page.locator('[data-nl-header]:visible').first().locator(`img[src="${IMG}"]`), `${width}: re-opened with the logo`);
    await again.page.waitForTimeout(600);
    look = await headerLook(again.page);
    expect(look.bg === rgb('#059669'), `${width}: re-opened, still the chosen colour (got ${look.bg})`);
    await shot(again.page, `${width}-03-reopened`);
    await again.context.close();

    const old = await open({ width, height: 1600, api, query: '&newsletterId=23' });
    await expectVisible(old.page.locator('[data-nl-header]:visible').first(), `${width}: existing newsletter opens`);
    await old.page.waitForTimeout(800);
    look = await headerLook(old.page);
    expect(look.bg === rgb('#6C60FF'), `${width}: the existing newsletter keeps its purple (got ${look.bg})`);
    expect(look.logo === null, `${width}: and has no logo added`);
    expect(look.title === 'Serpa Chrysler', `${width}: and its own title`);
    const stored = api.state.newsletters.find((n) => n.id === 23).header;
    expect(JSON.stringify(stored) === JSON.stringify(OLD), `${width}: its stored header is untouched (${JSON.stringify(stored)})`);
    await shot(old.page, `${width}-04-existing-untouched`);
    await old.context.close();
  }
}
