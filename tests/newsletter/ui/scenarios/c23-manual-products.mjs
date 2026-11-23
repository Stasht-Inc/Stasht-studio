// Chris 23 Nov 2026, point F: TheBodyPolitik (manual products only, no Website Catalogue) saw no Products in Add section
// → Campaign, while Royal Wood got Products | Campaigns. With the web API fix the picker gets the account's manual
// products (counts.product > 0): this walks Add section → Campaign → Products tab → pick → cards in the preview, at
// 1280 and 390, and checks a manual product's own button words ("Book now") and price on its card.
import { IMG, createMockApi } from '../mock-api.mjs';

const ADDRESS = '2482 East Hastings Street, Vancouver, BC';
const TITLE = 'Choose campaigns, products or vehicles';
const STUDIO = 'https://studio.stasht.com';

// TheBodyPolitik's campaigns (Chris's screenshot): one published, two not yet.
const campaigns = [
  { id: 701, title: 'Products for you', description: 'Half Front Torso, Half Arms and Full Back.', cover_url: IMG, date: '2026-11-23', public_url: `${STUDIO}/published-memory/products-for-you-6b04697b9d3a6`, shareable: true, reason: null },
  { id: 702, title: 'November Specials', description: '', cover_url: IMG, date: '2026-11-21', public_url: null, shareable: false, reason: 'Publish it first to add it' },
  { id: 703, title: 'Just 4 U - Jeremy Noonan', description: '', cover_url: IMG, date: '2026-11-21', public_url: null, shareable: false, reason: 'Publish it first to add it' },
];
// Its manual products as the web API now lists them (NewsletterListings with Products): a buy link with the owner's
// button words, a product linked to the campaign it is in, and a photo-less one with neither (can't be added).
const products = [
  { id: 9101, title: 'Half Front Torso', description: 'Laser hair removal, half front torso.', cover_url: IMG, date: '2026-11-20', url: 'https://www.fresha.com/a/the-body-politik-vancouver/booking?pId=572377', price_text: '$45 CAD', meta: 'Body', category: 'Body', button_text: 'Book now' },
  { id: 9102, title: 'Half Arms', description: 'Laser hair removal, half arms.', cover_url: IMG, date: '2026-11-20', url: `${STUDIO}/published-memory/products-for-you-6b04697b9d3a6`, price_text: '$45 CAD', meta: 'Body', category: 'Body' },
  { id: 9103, title: 'Full Back', description: 'Laser hair removal, full back.', cover_url: IMG, date: '2026-11-19', url: 'https://www.fresha.com/a/the-body-politik-vancouver/booking?pId=572380', price_text: '$75 CAD', meta: 'Body', category: 'Body', button_text: 'Book now' },
  { id: 9104, title: 'Brazilian (V)', description: '', cover_url: null, date: '2026-11-18', url: null, price_text: '$80 CAD', meta: 'Face & Bikini', category: 'Face & Bikini' },
];
const USER = { id: 2, external_user_id: 991201, name: 'TheBodyPolitik', email: 'hello@thebodypolitik.test', role: '2', phone_number: '+1 604 555 0100', profile_image: null, profile_color: '#1F4D3A' };

async function cardTitles(scope) {
  const items = scope.getByRole('list', { name: 'Campaigns in this section' }).getByRole('listitem');
  const out = [];
  for (let i = 0; i < await items.count(); i++) out.push(((await items.nth(i).locator('p').first().textContent()) || '').trim());
  return out;
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const [width, height] of [[1280, 1500], [390, 1800]]) {
    const api = createMockApi({ campaigns, products, businessAddress: ADDRESS });
    const { page, context } = await open({ width, height, api, user: USER });
    await page.locator('#nl-name').fill('November Newsletter 2026');
    // At 390 the preview sits below the form, in the same column.
    const preview = page.locator('aside');
    await preview.getByRole('button', { name: 'Add a section at the top' }).click();
    const item = page.getByRole('menuitem', { name: /^Campaign\b/ });
    await expectVisible(item, `${width}: Add section → Campaign`);
    await item.click();

    const picker = page.getByRole('dialog', { name: TITLE });
    await expectVisible(picker, `${width}: picker titled "${TITLE}" (products exist, so not just "Choose campaigns")`);
    const tabs = picker.getByRole('radiogroup', { name: 'Show' });
    await expectVisible(tabs, `${width}: Products | Campaigns tabs`);
    const tabNames = await tabs.getByRole('radio').allTextContents();
    expect(JSON.stringify(tabNames) === JSON.stringify(['Products', 'Campaigns']), `${width}: tabs Products | Campaigns (got ${JSON.stringify(tabNames)})`);
    expect(await tabs.getByRole('radio', { name: 'Products' }).isChecked(), `${width}: opens on Products`);
    await expectVisible(picker.locator('#nl-campaign-product-9101'), `${width}: manual products listed`);
    await expectVisible(picker.getByText('$45 CAD').first(), `${width}: price on a product row`);
    expect(await picker.locator('#nl-campaign-product-9104').isDisabled(), `${width}: a product with no page can't be picked`);
    await expectVisible(picker.locator('#nl-campaign-product-9104-reason').getByText('This item has no web page'), `${width}: its reason shows`);
    expect(!(await hasOverflow(page)), `${width}: nothing scrolls sideways in the picker`);
    await shot(page, `${width}-01-products-tab`);

    await picker.locator('#nl-campaign-product-9101').check();
    await picker.locator('#nl-campaign-product-9102').check();
    await tabs.getByRole('radio', { name: 'Campaigns' }).click();
    await expectVisible(picker.locator('#nl-campaign-campaign-701'), `${width}: Campaigns tab lists the campaigns`);
    expect(await picker.locator('#nl-campaign-campaign-702').isDisabled(), `${width}: an unpublished campaign is disabled`);
    await expectVisible(picker.getByText('2 of 6 chosen'), `${width}: 2 of 6 chosen`);
    await picker.getByRole('button', { name: 'Done' }).click();

    const section = preview.getByRole('group', { name: 'Campaigns section' }).first();
    await expectVisible(section.getByRole('list', { name: 'Campaigns in this section' }).getByRole('listitem').first(), `${width}: cards in the preview`);
    const titles = await cardTitles(section);
    expect(JSON.stringify(titles) === JSON.stringify(['Half Front Torso', 'Half Arms']), `${width}: cards in picking order (got ${JSON.stringify(titles)})`);
    await expectVisible(section.getByText('Book now', { exact: true }), `${width}: the product's own button words`);
    await expectVisible(section.getByText('View product', { exact: true }), `${width}: View product on the one linked to its campaign`);
    await expectVisible(section.getByText('$45 CAD').first(), `${width}: price on the card`);
    await page.waitForTimeout(1500);
    const sent = api.state.campaignBodies.at(-1);
    expect(JSON.stringify(sent?.selections) === JSON.stringify([{ kind: 'product', id: 9101 }, { kind: 'product', id: 9102 }]), `${width}: Studio sends the two picks (got ${JSON.stringify(sent)})`);
    expect(!(await hasOverflow(page)), `${width}: nothing scrolls sideways`);
    await section.scrollIntoViewIfNeeded();
    await shot(page, `${width}-02-cards`);

    // Reload: the draft opens with the same cards and words.
    const saved = api.state.newsletters[0];
    await context.close();
    const again = await open({ width, height, api, user: USER, query: `&newsletterId=${saved.id}` });
    const s2 = again.page.locator('aside').getByRole('group', { name: 'Campaigns section' }).first();
    await expectVisible(s2.getByText('Half Front Torso'), `${width}: cards after reload`);
    await expectVisible(s2.getByText('Book now', { exact: true }), `${width}: Book now after reload`);
    await again.context.close();
  }
}
