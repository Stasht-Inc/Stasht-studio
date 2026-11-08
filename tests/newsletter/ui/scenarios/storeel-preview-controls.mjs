// Chris, 7 Nov 2026 (points 6, 7) — the Storeel page's phone preview is interactive, and Add a Moment offers the
// account's Website Catalogue products and a dealer's vehicles. At 1280 and 390:
//  - create: the "+" under the cover → Add a Moment → Products → tick → Add all (1) → the product is the FIRST moment;
//    photos from the card's Add a Moment go last; a "+" between two moments inserts there; ⋮ Move up / Delete; a
//    vehicle from the last "+" stays last with Delete only; Edit Cover → Cover photo picks the form's cover; the title's
//    ⋮ focuses the title field; Continue scrolls the phone to the timeline; no ✕; nothing is saved until Save as Draft,
//    which sends the product + vehicle + photos, then the shown order (PUT moment-order);
//  - off the Business plan: Products says "Available on the Business plan." + See plans, and no items are asked for;
//  - edit: "+" after a moment adds a product right there (POST catalogue-items after it), ⋮ Move up saves the order,
//    Delete asks then deletes, Edit Moment opens the moment's caption in step 2, a photo from the top "+" goes first.
// node tests/newsletter/ui/check.mjs storeel-preview-controls   (NL_BASE = the dev server)
import { readFileSync } from 'fs';
import { createMockApi, IMG } from '../mock-api.mjs';

const STOREEL_TITLE = 'Give your campaign a meaningful title';
const PNG = readFileSync(new URL('../../../../public/pwa-icon-512.png', import.meta.url));
const SAVED = {
  id: 3021, title: 'Around the Mill - Sale Items', slug: 'around-the-mill', published: 0, is_car: 0, user_id: 990002,
  category: { id: 7, name: 'Personal' }, sub_category: null, min_uploaded_img_date: '2026-11-06', max_uploaded_img_date: '2026-11-06',
  location: 'Toronto, ON', tags: [], last_update_img: null,
  posts: [
    { id: 1, parent_id: null, image_link: IMG, title: 'Front porch', description: 'Fresh paint.', capture_date: '2026-11-01 10:00:00' },
    { id: 2, parent_id: null, image_link: IMG, title: 'Kitchen', description: '', capture_date: '2026-11-02 10:00:00' },
    { id: 3, parent_id: null, image_link: IMG, title: 'Backyard', description: '', capture_date: '2026-11-03 10:00:00' },
  ],
};

const flow = (page) => page.getByRole('dialog', { name: /^(Create|Edit) Campaign$/ });
const button = (page, name) => flow(page).getByRole('button', { name, exact: true }).filter({ visible: true }).last();
const preview = (page) => page.getByTestId('storeel-preview');
const cards = (page) => page.getByTestId('storeel-preview-moments').locator(':scope > li');
const rows = (page) => page.locator('#st-step-moments li[data-moment-row]');
const plus = (page, name) => preview(page).getByRole('button', { name, exact: true });

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

const previewKeys = (page) => cards(page).evaluateAll((items) => items.map((li) => li.getAttribute('data-moment-key')));
const rowKeys = (page) => rows(page).evaluateAll((items) => items.map((li) => li.getAttribute('data-moment-key')));

async function clickPlus(page, name) {
  const b = plus(page, name).first();
  await b.scrollIntoViewIfNeeded();
  await b.click();
  // Chris, 8 Nov 2026: a "+" opens the Add Widget chooser; Moment opens Add a Moment.
  await page.getByTestId('add-widget-chooser').getByRole('menuitem', { name: /^Moment/ }).click();
  await page.getByRole('heading', { name: 'Add a Moment' }).waitFor();
  await page.waitForTimeout(600);
}

async function menu(page, key, item) {
  const trigger = page.getByTestId('storeel-preview-moments').locator(`li[data-moment-key="${key}"]`).getByTestId('storeel-preview-moment-menu').first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await page.waitForTimeout(300);
  const items = (await page.getByRole('menuitem').allTextContents()).map((t) => t.trim());
  if (item) await page.getByRole('menuitem', { name: item, exact: true }).click();
  else await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  return items;
}

async function uploadIn(page, names) {
  await page.locator('#file-upload').setInputFiles(names.map((name) => ({ name, mimeType: 'image/png', buffer: PNG })));
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /^Add all/ }).click();
  await page.waitForTimeout(1300);
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const [width, height] of [[1280, 1000], [390, 844]]) {
    const tag = String(width);

    // ── Create ────────────────────────────────────────────────────────────────────────────────────────────────
    const api = createMockApi({ catalogue: true, cars: true });
    const { page, context } = await openStoreel(open, width, height, api);
    await page.getByPlaceholder(STOREEL_TITLE).fill('Around the Mill - Sale Items');
    await page.waitForTimeout(300);
    expect(!(await preview(page).locator('svg.lucide-x').count()), `${tag}: no ✕ in the preview`);
    for (const name of ['Edit Cover', 'Continue', "Edit the campaign's title and details", 'Add a moment at the start']) {
      expect(await preview(page).getByRole('button', { name, exact: true }).count() === 1, `${tag}: "${name}" is a real button`);
    }
    const start = plus(page, 'Add a moment at the start');
    await start.scrollIntoViewIfNeeded();
    expect(await inView(page, start), `${tag}: the + under the cover can be scrolled into view`);
    const hit = await start.boundingBox();
    expect(hit && hit.width >= 30 && hit.height >= 30, `${tag}: the + has a big enough hit area (${hit?.width}×${hit?.height})`);
    await page.keyboard.press('Tab');
    await start.focus();
    await shot(page, `${tag}-01-controls`);

    await clickPlus(page, 'Add a moment at the start');
    const sw = page.getByRole('radiogroup', { name: 'Add from' });
    expect(((await sw.textContent()) ?? '') === 'MediaProductsVehicles', `${tag}: Add a Moment offers Media | Products | Vehicles (got ${await sw.textContent()})`);
    const swHeight = (await sw.boundingBox())?.height ?? 0;
    expect(swHeight < 50, `${tag}: the switch is one row (${swHeight}px)`);
    expect(await inView(page, sw), `${tag}: the switch is in view`);
    await sw.getByRole('radio', { name: 'Products' }).click();
    await page.waitForTimeout(400);
    await expectVisible(page.getByRole('checkbox', { name: /Oak bench/ }), `${tag}: products listed`);
    await page.getByRole('combobox', { name: 'Category' }).selectOption('Benches');
    expect(await page.getByRole('checkbox', { name: /Pine shelf/ }).count() === 0, `${tag}: the category filter narrows the list`);
    await page.getByRole('combobox', { name: 'Category' }).selectOption('');
    await page.getByRole('searchbox', { name: 'Search products' }).fill('oak');
    expect(await page.getByTestId('moment-product-picker').getByRole('checkbox').count() === 1, `${tag}: search narrows the list`);
    await page.getByRole('checkbox', { name: /Oak bench/ }).click();
    await expectVisible(page.getByRole('button', { name: 'Add all (1)' }), `${tag}: Add all (1)`);
    expect(await inView(page, page.getByRole('button', { name: 'Add all (1)' })), `${tag}: Add all is in view`);
    await shot(page, `${tag}-02-products-picker`);
    await page.getByRole('button', { name: 'Add all (1)' }).click();
    await page.waitForTimeout(900);
    expect(JSON.stringify(await previewKeys(page)) === JSON.stringify(['catalog-61']), `${tag}: the product is the first moment (got ${await previewKeys(page)})`);
    expect(((await preview(page).textContent()) ?? '').includes('View on website'), `${tag}: with its View on website card`);

    await page.locator('#st-step-moments').getByRole('button', { name: 'Add a Moment' }).click();
    await page.getByTestId('add-widget-chooser').getByRole('menuitem', { name: /^Moment/ }).click();
    await page.getByRole('heading', { name: 'Add a Moment' }).waitFor();
    await uploadIn(page, ['front.png', 'kitchen.png']);
    const afterPhotos = await previewKeys(page);
    expect(afterPhotos.length === 3 && afterPhotos[0] === 'catalog-61' && afterPhotos.slice(1).every((k) => k.startsWith('photo-')), `${tag}: photos added at the end (got ${afterPhotos})`);
    await clickPlus(page, 'Add a moment after Oak bench');
    await uploadIn(page, ['middle.png']);
    const inserted = await previewKeys(page);
    expect(inserted.length === 4 && inserted[0] === 'catalog-61' && !afterPhotos.includes(inserted[1]) && inserted[2] === afterPhotos[1] && inserted[3] === afterPhotos[2], `${tag}: "+" after Oak bench inserts right there (got ${inserted})`);
    expect(JSON.stringify(await rowKeys(page)) === JSON.stringify(inserted), `${tag}: the Moments card shows the same order`);
    await shot(page, `${tag}-03-inserted`);

    const firstItems = await menu(page, 'catalog-61');
    expect(JSON.stringify(firstItems) === JSON.stringify(['Move down', 'Delete']), `${tag}: a product's ⋮ = Move down / Delete (got ${firstItems})`);
    const lastItems = await menu(page, inserted[3], 'Move up');
    expect(JSON.stringify(lastItems) === JSON.stringify(['Edit Moment', 'Move up', 'Delete']), `${tag}: the last photo's ⋮ = Edit Moment / Move up / Delete (got ${lastItems})`);
    const moved = await previewKeys(page);
    expect(moved[2] === inserted[3] && moved[3] === inserted[2], `${tag}: Move up swapped it (got ${moved})`);
    const nextAfterDeleted = moved[2];
    await menu(page, inserted[1], 'Delete');
    const afterDelete = await previewKeys(page);
    expect(afterDelete.length === 3 && !afterDelete.includes(inserted[1]), `${tag}: Delete took it off (got ${afterDelete})`);
    await page.waitForTimeout(300);
    expect(await page.evaluate((k) => document.activeElement?.closest('li')?.getAttribute('data-moment-key') === k && document.activeElement?.getAttribute('data-testid') === 'storeel-preview-moment-menu', nextAfterDeleted),
      `${tag}: after Delete, focus is on the next moment's ⋮ (review minor 8)`);

    await clickPlus(page, 'Add a moment at the end');
    await page.getByRole('radiogroup', { name: 'Add from' }).getByRole('radio', { name: 'Vehicles' }).click();
    const jeep = page.getByRole('checkbox', { name: /2024 Jeep Wrangler/ });
    await jeep.click();
    expect(((await jeep.textContent()) ?? '').includes('$34,995 · 45,000 mi · Stock #S2300'), `${tag}: vehicle row shows price · mileage · stock`);
    await page.getByRole('button', { name: 'Add all (1)' }).click();
    await page.waitForTimeout(900);
    const withCar = await previewKeys(page);
    expect(withCar.at(-1) === 'car-5' && withCar.length === 4, `${tag}: the vehicle is last (got ${withCar})`);
    // Review minor 5: no "+" below a vehicle (it would add above it); the "+" above the vehicle stays.
    expect(await plus(page, 'Add a moment at the end').count() === 0, `${tag}: no "+" below the vehicle`);
    expect(await page.getByTestId('storeel-preview-moments').locator('li[data-moment-key="car-5"]').getByTestId('storeel-preview-add').count() === 1, `${tag}: the "+" above the vehicle stays`);
    expect(JSON.stringify(await menu(page, 'car-5')) === JSON.stringify(['Delete']), `${tag}: a vehicle's ⋮ = Delete only`);
    await shot(page, `${tag}-04-vehicle`);

    const editCover = preview(page).getByTestId('storeel-preview-edit-cover');
    await editCover.scrollIntoViewIfNeeded();
    await editCover.click();
    await page.waitForTimeout(300);
    const coverItems = (await page.getByRole('menuitem').allTextContents()).map((t) => t.trim());
    expect(JSON.stringify(coverItems) === JSON.stringify(['Cover photo', 'Intro video']), `${tag}: Edit Cover = Cover photo / Intro video (got ${coverItems})`);
    await shot(page, `${tag}-05-edit-cover-menu`);
    const chooser = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
    await page.getByRole('menuitem', { name: 'Cover photo' }).click();
    const fc = await chooser;
    expect(Boolean(fc), `${tag}: Cover photo opens the file chooser`);
    if (fc) await fc.setFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForTimeout(1800);
    await expectVisible(page.getByTestId('cover-choice-photo'), `${tag}: the form's Cover photo is set`);
    expect((await page.getByTestId('storeel-preview-cover').getAttribute('data-cover-kind')) === 'photo', `${tag}: the phone shows the cover photo`);

    await preview(page).getByRole('button', { name: "Edit the campaign's title and details" }).click();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.activeElement?.getAttribute('placeholder')) === STOREEL_TITLE, `${tag}: title ⋮ focuses the title field`);
    expect(await inView(page, page.getByPlaceholder(STOREEL_TITLE)), `${tag}: …and it is in view`);
    const screenEl = page.getByTestId('storeel-preview-screen');
    await screenEl.evaluate((el) => el.scrollTo(0, 0));
    await preview(page).getByRole('button', { name: 'Continue' }).scrollIntoViewIfNeeded();
    await preview(page).getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(1000);
    expect(await screenEl.evaluate((el) => el.scrollTop) > 100, `${tag}: Continue scrolls the phone to the timeline`);
    await shot(page, `${tag}-06-continue`);

    const early = api.state.calls.filter((c) => c.method !== 'GET' && /^\/memories(\/|$)/.test(c.path) && c.path !== '/memories/auto-mark-seen').map((c) => `${c.method} ${c.path}`);
    expect(!early.length, `${tag}: nothing saved before Save as Draft (got ${early})`);
    expect(!(await hasOverflow(page)), `${tag}: no sideways scroll`);

    await page.locator('#st-actions').scrollIntoViewIfNeeded();
    await button(page, 'Save as Draft').click();
    await page.waitForTimeout(2500);
    const posts = api.state.calls.filter((c) => c.method === 'POST' && c.path === '/memories');
    const body = posts[0]?.body ?? {};
    // Review minor 1: the vehicle goes as car_ids (never among linked campaigns).
    expect(posts.length === 1 && JSON.stringify(body.catalog_item_ids) === '[61]' && JSON.stringify(body.car_ids) === '["5"]' && !('linked_memory_ids' in body) && body.photos?.length === 2,
      `${tag}: one POST with product, vehicle (car_ids), 2 photos (got ${JSON.stringify({ c: body.catalog_item_ids, car: body.car_ids, l: body.linked_memory_ids, p: body.photos?.length })})`);
    const orderPut = (api.state.momentCalls ?? []).find((c) => c.kind === 'moment-order');
    const id = api.state.storeels[0]?.id;
    expect(orderPut && JSON.stringify(orderPut.body.order) === JSON.stringify([{ type: 'post', id: id * 100 }, { type: 'post', id: id * 100 + 2 }, { type: 'post', id: id * 100 + 1 }]),
      `${tag}: then the shown order is saved (got ${JSON.stringify(orderPut?.body)})`);
    await context.close();

    // ── Off the Business plan ────────────────────────────────────────────────────────────────────────────────
    const teams = createMockApi({ cataloguePlanRequired: true });
    const t = await openStoreel(open, width, height, teams);
    await t.page.getByPlaceholder(STOREEL_TITLE).fill('Keep me');
    await clickPlus(t.page, 'Add a moment at the start');
    await t.page.getByRole('radiogroup', { name: 'Add from' }).getByRole('radio', { name: 'Products' }).click();
    await expectVisible(t.page.getByText('Available on the Business plan.', { exact: true }), `${tag}: plan note`);
    await expectVisible(t.page.getByRole('button', { name: 'See plans' }), `${tag}: See plans`);
    expect(!teams.state.calls.some((c) => c.path === '/website-catalogue/items'), `${tag}: no Business-only call`);
    await shot(t.page, `${tag}-07-plan-gate`);
    // Review I2: never silently lost — See plans asks first; Stay keeps the page and everything typed.
    await t.page.getByRole('button', { name: 'See plans' }).click();
    const ask = t.page.getByRole('dialog', { name: 'Leave this Storeel to see the plans?' });
    await expectVisible(ask, `${tag}: See plans asks before leaving`);
    await shot(t.page, `${tag}-07b-plans-ask`);
    await ask.getByRole('button', { name: 'Stay' }).click();
    await t.page.waitForTimeout(400);
    expect(await flow(t.page).count() === 1 && (await t.page.getByPlaceholder(STOREEL_TITLE).inputValue()) === 'Keep me', `${tag}: Stay keeps the page and the title`);
    await clickPlus(t.page, 'Add a moment at the start');
    await t.page.getByRole('radiogroup', { name: 'Add from' }).getByRole('radio', { name: 'Products' }).click();
    await t.page.getByRole('button', { name: 'See plans' }).click();
    await t.page.getByRole('dialog', { name: 'Leave this Storeel to see the plans?' }).getByRole('button', { name: 'Leave and see plans' }).click();
    await t.page.waitForTimeout(700);
    expect(!(await flow(t.page).count()), `${tag}: Leave and see plans closes the page`);
    await t.context.close();

    // ── Edit ─────────────────────────────────────────────────────────────────────────────────────────────────
    const edit = createMockApi({ memories: { 3021: SAVED }, catalogue: true, cars: true });
    const e = await open({ width, height, api: edit, query: '&campaignId=3021' });
    await e.page.getByRole('heading', { name: 'Edit Campaign' }).waitFor();
    await e.page.waitForTimeout(900);
    expect(JSON.stringify(await previewKeys(e.page)) === JSON.stringify(['post-1', 'post-2', 'post-3']), `${tag}: edit shows the campaign's moments (got ${await previewKeys(e.page)})`);
    await clickPlus(e.page, 'Add a moment after Front porch');
    await e.page.getByRole('radiogroup', { name: 'Add from' }).getByRole('radio', { name: 'Products' }).click();
    await e.page.getByRole('checkbox', { name: /Oak bench/ }).click();
    await e.page.getByRole('button', { name: 'Add all (1)' }).click();
    await e.page.waitForTimeout(1300);
    const addCall = (edit.state.momentCalls ?? []).find((c) => c.kind === 'catalogue-items');
    expect(addCall && addCall.body.after_item_id === 1 && addCall.body.after_item_type === 'post' && JSON.stringify(addCall.body.catalog_item_ids) === '[61]', `${tag}: product added right after Front porch (got ${JSON.stringify(addCall?.body)})`);
    const edited = await previewKeys(e.page);
    expect(edited.length === 4 && edited[0] === 'post-1' && edited[2] === 'post-2' && edited[3] === 'post-3', `${tag}: …and shown there (got ${edited})`);
    await menu(e.page, 'post-3', 'Move up');
    const orderCall = (edit.state.momentCalls ?? []).filter((c) => c.kind === 'moment-order').at(-1);
    expect(orderCall && JSON.stringify(orderCall.body.order.map((o) => o.id)) === JSON.stringify([1, Number(edited[1].replace('post-', '')), 3, 2]), `${tag}: Move up saved the order (got ${JSON.stringify(orderCall?.body)})`);
    expect((await previewKeys(e.page))[2] === 'post-3', `${tag}: …and shows it`);
    expect(await e.page.getByText('Order saved.').first().isVisible().catch(() => false), `${tag}: says the order is saved (review minor 6)`);
    await menu(e.page, 'post-2', 'Delete');
    await expectVisible(e.page.getByRole('dialog', { name: 'Delete this moment?' }), `${tag}: Delete asks first`);
    await shot(e.page, `${tag}-08-edit-delete-ask`);
    await e.page.getByRole('dialog', { name: 'Delete this moment?' }).getByRole('button', { name: 'Delete' }).click();
    await e.page.waitForTimeout(1300);
    expect((edit.state.deletedPosts ?? []).includes(2) && !(await previewKeys(e.page)).includes('post-2'), `${tag}: deleted on the campaign`);
    await menu(e.page, 'post-1', 'Edit Moment');
    await e.page.waitForTimeout(700);
    expect(await e.page.evaluate(() => document.activeElement?.getAttribute('placeholder')) === 'Write a caption...', `${tag}: Edit Moment opens its caption in step 2`);
    await shot(e.page, `${tag}-09-edit-caption`);
    await e.page.locator('#st-step-moments').getByRole('button', { name: 'Cancel', exact: true }).click();
    await clickPlus(e.page, 'Add a moment at the start');
    await uploadIn(e.page, ['top.png']);
    await e.page.waitForTimeout(1300);
    const lastOrder = (edit.state.momentCalls ?? []).filter((c) => c.kind === 'moment-order').at(-1);
    const top = (await previewKeys(e.page))[0];
    expect(lastOrder && top === `post-${lastOrder.body.order[0].id}` && !['post-1', 'post-3'].includes(top), `${tag}: a photo from the top "+" goes first (got ${top}, ${JSON.stringify(lastOrder?.body)})`);
    await shot(e.page, `${tag}-10-edit-done`);
    expect(!edit.state.memoryPuts.length, `${tag}: moments never PUT the campaign's fields`);
    await e.context.close();
  }
}
