// Chris, 8 Nov 2026 (points 1, 2), Create a Storeel at 1280 and 390:
//  - every "+" in the phone preview (and the Moments card's Add a Moment) opens the campaign page's Add Widget chooser
//    with all its options (images/198.jpg), in view;
//  - Moment → Add a Moment: "Media" tab (was "Photos & Videos"), and under the upload "Campaigns (optional)": a
//    searchable multi-select; ticked campaigns show in the phone at that "+" and Save as Draft sends linked_memory_ids;
//  - Call to Action (any non-Moment option) → "Save this Storeel as a draft first?" — Cancel saves nothing; Save draft
//    and continue → one POST, then the campaign page is asked to open that editor after the moment the "+" followed;
//  - tabs: Media alone → no tab bar; Products only with products; Vehicles only with vehicles.
// node tests/newsletter/ui/check.mjs storeel-widgets   (NL_BASE = the dev server)
import { readFileSync } from 'fs';
import { createMockApi, IMG } from '../mock-api.mjs';

const STOREEL_TITLE = 'Give your campaign a meaningful title';
const PNG = readFileSync(new URL('../../../../public/pwa-icon-512.png', import.meta.url));
const CAMPAIGNS = [
  { id: 701, title: 'Fall open house', last_update_img: IMG, posts_count: 4 },
  { id: 702, title: 'Spring kitchen reno', last_update_img: IMG, posts_count: 2 },
  { id: 703, title: 'Backyard deck', last_update_img: null, posts_count: 1 },
];
const ALL = ['Moment', 'Call to Action', 'Share Request a Moment', 'Voice to Text', 'HTML', 'Youtube', 'Quote', 'AI Creator', 'Shopify Product'];

const flow = (page) => page.getByRole('dialog', { name: /^(Create|Edit) Campaign$/ });
const preview = (page) => page.getByTestId('storeel-preview');
const cards = (page) => page.getByTestId('storeel-preview-moments').locator(':scope > li[data-moment-key]');
const chooser = (page) => page.getByTestId('add-widget-chooser');
const previewKeys = (page) => cards(page).evaluateAll((items) => items.map((li) => li.getAttribute('data-moment-key')));

async function openStoreel(open, width, height, api) {
  const o = await open({ width, height, api });
  await o.page.locator('#nl-name').waitFor();
  await o.page.getByRole('radio', { name: 'Storeel', exact: true }).click();
  await o.page.getByPlaceholder(STOREEL_TITLE).waitFor();
  await o.page.waitForTimeout(900);
  return o;
}

async function inView(page, locator) {
  const box = await locator.first().boundingBox();
  const vp = page.viewportSize();
  return Boolean(box && vp && box.y >= 0 && box.y + box.height <= vp.height + 1 && box.x >= 0 && box.x + box.width <= vp.width + 1);
}

async function tapPlus(page, name) {
  const b = preview(page).getByRole('button', { name, exact: true }).first();
  await b.scrollIntoViewIfNeeded();
  await b.click();
  await chooser(page).waitFor();
  await page.waitForTimeout(700);
}

async function pick(page, label) {
  await chooser(page).getByRole('menuitem', { name: new RegExp(`^${label}`) }).click();
  await page.waitForTimeout(500);
}

const labels = async (page) => (await chooser(page).getByRole('menuitem').evaluateAll((els) => els.map((e) => e.querySelector('p')?.textContent?.trim())));

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const [width, height] of [[1280, 1000], [390, 844]]) {
    const tag = String(width);
    const api = createMockApi({ catalogue: true, cars: true, existingCampaigns: CAMPAIGNS });
    const { page, context } = await openStoreel(open, width, height, api);
    await page.getByPlaceholder(STOREEL_TITLE).fill('Around the Mill');

    // ── 1. The "+" opens the Add Widget chooser with every option ─────────────────────────────────────────────────
    await tapPlus(page, 'Add a moment at the start');
    expect(JSON.stringify(await labels(page)) === JSON.stringify(ALL), `${tag}: the chooser lists every option (got ${await labels(page)})`);
    await expectVisible(chooser(page).getByText('Choose a widget to add to your timeline'), `${tag}: chooser heading`);
    const cb = await chooser(page).boundingBox();
    expect(await inView(page, chooser(page)), `${tag}: the chooser is in the viewport (${cb ? [cb.x, cb.y, cb.width, cb.height].map(Math.round) : 'none'})`);
    await shot(page, `${tag}-01-chooser`);
    // What the person sees (a full-page shot resizes the window, and the chooser moves with it).
    await page.screenshot({ path: `${process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots'}/storeel-widgets-${tag}-01b-chooser-viewport.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    expect(!(await chooser(page).count()), `${tag}: Esc closes the chooser`);

    // ── 2. Moment → Add a Moment: Media tab, Campaigns (optional) under the upload ───────────────────────────────
    await tapPlus(page, 'Add a moment at the start');
    await pick(page, 'Moment');
    await page.getByRole('heading', { name: 'Add a Moment' }).waitFor();
    await page.waitForTimeout(500);
    const sw = page.getByRole('radiogroup', { name: 'Add from' });
    expect(((await sw.textContent()) ?? '') === 'MediaProductsVehicles', `${tag}: tabs Media | Products | Vehicles (got ${await sw.textContent()})`);
    const field = page.getByTestId('moment-campaigns');
    await expectVisible(field, `${tag}: Campaigns (optional) field`);
    expect(((await field.textContent()) ?? '').replace(/\s+/g, ' ').includes('Campaigns (optional)'), `${tag}: labelled Campaigns (optional)`);
    const uploadBox = await page.locator('label[for="file-upload"], #file-upload').first().boundingBox().catch(() => null);
    const fieldBox = await field.boundingBox();
    expect(Boolean(fieldBox && (!uploadBox || fieldBox.y > uploadBox.y)), `${tag}: it sits under the upload`);
    await page.locator('#moment-campaigns-toggle').click();
    await page.getByRole('searchbox', { name: 'Search campaigns' }).fill('spring');
    expect(await field.getByRole('checkbox').count() === 1, `${tag}: search narrows the campaigns`);
    await page.getByRole('searchbox', { name: 'Search campaigns' }).fill('');
    await field.getByRole('checkbox', { name: /Fall open house/ }).click();
    await field.getByRole('checkbox', { name: /Spring kitchen reno/ }).click();
    await expectVisible(field.getByText('2 campaigns selected'), `${tag}: 2 selected`);
    await expectVisible(field.getByRole('button', { name: 'Remove Fall open house' }), `${tag}: chips with remove`);
    const addAll = page.getByRole('button', { name: 'Add all (2)' });
    await expectVisible(addAll, `${tag}: Add all (2) counts the campaigns`);
    expect(await inView(page, addAll), `${tag}: Add all in view`);
    await field.scrollIntoViewIfNeeded();
    expect(await inView(page, field.getByRole('checkbox', { name: /Fall open house/ })), `${tag}: the campaigns list is in view`);
    await shot(page, `${tag}-02-campaigns-field`);
    await addAll.click();
    await page.waitForTimeout(900);
    expect(JSON.stringify(await previewKeys(page)) === JSON.stringify(['campaign-701', 'campaign-702']), `${tag}: linked campaigns shown in the phone (got ${await previewKeys(page)})`);
    expect(((await preview(page).textContent()) ?? '').includes('Fall open house'), `${tag}: as campaign cards`);

    // ── 3. The Moments card's Add a Moment opens the same chooser; Moment → a photo at the end ──────────────────
    await page.locator('#st-step-moments').getByRole('button', { name: 'Add a Moment' }).click();
    await chooser(page).waitFor();
    await page.waitForTimeout(700);
    expect(await inView(page, chooser(page)), `${tag}: the card's chooser is in the viewport`);
    expect(JSON.stringify(await labels(page)) === JSON.stringify(ALL), `${tag}: the card's Add a Moment opens the same chooser`);
    await page.screenshot({ path: `${process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots'}/storeel-widgets-${tag}-03-card-chooser-viewport.png` });
    await pick(page, 'Moment');
    await page.getByRole('heading', { name: 'Add a Moment' }).waitFor();
    await page.locator('#file-upload').setInputFiles([{ name: 'porch.png', mimeType: 'image/png', buffer: PNG }]);
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /^Add all/ }).click();
    await page.waitForTimeout(1200);
    const withPhoto = await previewKeys(page);
    expect(withPhoto.length === 3 && withPhoto[2].startsWith('photo-'), `${tag}: the photo is last (got ${withPhoto})`);
    // A linked campaign's ⋮: Move up / Move down / Delete.
    await shot(page, `${tag}-04-preview`);

    // ── 4. Call to Action before the Storeel exists: save first, asked ─────────────────────────────────────────
    await tapPlus(page, 'Add a moment at the end');
    await pick(page, 'Call to Action');
    const ask = page.getByRole('dialog', { name: 'Save this Storeel as a draft first?' });
    await expectVisible(ask, `${tag}: asks to save as a draft first`);
    expect(((await ask.textContent()) ?? '').includes('Call to Action is added to a saved Storeel'), `${tag}: says why`);
    await shot(page, `${tag}-05-save-first`);
    await ask.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(300);
    expect(!api.state.calls.some((c) => c.method === 'POST' && c.path === '/memories'), `${tag}: Cancel saves nothing`);
    expect(await flow(page).count() === 1, `${tag}: …and stays on the page`);

    await tapPlus(page, 'Add a moment at the end');
    await pick(page, 'Call to Action');
    await page.getByRole('dialog', { name: 'Save this Storeel as a draft first?' }).getByRole('button', { name: 'Save draft and continue' }).click();
    await page.waitForTimeout(2500);
    const posts = api.state.calls.filter((c) => c.method === 'POST' && c.path === '/memories');
    const body = posts[0]?.body ?? {};
    expect(posts.length === 1 && JSON.stringify(body.linked_memory_ids) === '[701,702]' && body.photos?.length === 1,
      `${tag}: one POST with linked_memory_ids [701,702] and the photo (got ${JSON.stringify({ l: body.linked_memory_ids, p: body.photos?.length, n: posts.length })})`);
    const id = api.state.storeels[0]?.id;
    const intent = await page.evaluate(() => sessionStorage.getItem('stasht_storeel_widget_intent'));
    const parsed = intent ? JSON.parse(intent) : null;
    expect(parsed && parsed.memoryId === id && parsed.kind === 'cta' && parsed.afterPostId === id * 100,
      `${tag}: the campaign page is asked to open Call to Action after the photo (got ${intent})`);
    expect(!(await flow(page).count()), `${tag}: the Storeel page closes (the campaign page opens)`);
    expect(!(await hasOverflow(page)), `${tag}: no sideways scroll`);
    await context.close();

    // ── 5. Tabs only for what the account has ─────────────────────────────────────────────────────────────────
    for (const [opts, want, name] of [[{}, null, 'media-only'], [{ catalogue: true }, 'MediaProducts', 'products'], [{ cars: true }, 'MediaVehicles', 'vehicles']]) {
      const o = await openStoreel(open, width, height, createMockApi({ ...opts, existingCampaigns: CAMPAIGNS }));
      await tapPlus(o.page, 'Add a moment at the start');
      await pick(o.page, 'Moment');
      await o.page.getByRole('heading', { name: 'Add a Moment' }).waitFor();
      await o.page.waitForTimeout(1200);
      const bar = o.page.getByRole('radiogroup', { name: 'Add from' });
      const got = (await bar.count()) ? await bar.textContent() : null;
      expect(got === want, `${tag} ${name}: tabs ${want ?? 'none'} (got ${got})`);
      await expectVisible(o.page.getByTestId('moment-campaigns'), `${tag} ${name}: Campaigns (optional) still there`);
      if (name === 'media-only') await shot(o.page, `${tag}-06-media-only`);
      await o.context.close();
    }
  }
}
