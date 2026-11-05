// Storeel flow v2 (Deepak, 4 Nov 2026) with Chris's changes the same day: ONE scrolling page like the newsletter
// composer — cards all open, top to bottom: 1 Campaign, 2 Moments (the original Add a Moment UI, captions edited the
// way the campaign page edits them), 3 Send (optional) — and the actions at the END of the list: Save as Draft /
// Save & Send (edit: Save Changes / Save & Send). Nothing is saved before one of them; no Continue, no header action.
// At 1280 and 390:
//  - create with 2 uploaded photos with captions + 1 picked product → the preview shows 3 moments, nothing POSTed;
//    Save as Draft → one POST with the product and both photos (captions, in order) → toast, closed;
//  - Save & Send: off with the reason until Send is filled in; then one POST → confirm → sent;
//  - Save & Send, confirm left → "Saved as a draft…", Save Changes / Save & Send (PUT, never a second campaign);
//  - Edit: prefilled, step 2 lists its moments, a caption saved on the campaign (PUT /memory-images/{id}); Save Changes
//    → PUT → toast, closed; Save & Send → confirm; 422s; 503; Starter allowance; 403;
//  - Shopify / Cars / catalogue / property / no-dates campaigns never re-filed or dated; a Cars campaign's vehicle.
// node tests/newsletter/ui/check.mjs storeel-flow   (NL_BASE = the dev server)
import { readFileSync } from 'fs';
import { createMockApi, IMG } from '../mock-api.mjs';

const STOREEL_TITLE = 'Give your campaign a meaningful title';
const PNG = readFileSync(new URL('../../../../public/pwa-icon-512.png', import.meta.url));
const SAVED = {
  id: 3021, title: 'Spring Open House', slug: 'spring-open-house', published: 1, is_car: 0, user_id: 990002,
  category: { id: 8, name: 'Service' }, sub_category: { id: 3, name: 'Events' }, min_uploaded_img_date: '2026-10-01', max_uploaded_img_date: '2026-10-09',
  location: 'Toronto, ON', tags: ['spring'], last_update_img: null,
  posts: [
    { id: 1, parent_id: null, image_link: IMG, title: 'Front porch', description: 'Fresh paint and new railings.', capture_date: '2026-10-01 10:00:00' },
    { id: 2, parent_id: null, image_link: IMG, title: 'Kitchen', description: '', capture_date: '2026-10-02 10:00:00' },
    { id: 3, parent_id: null, image_link: IMG, title: 'Backyard', description: '', capture_date: '2026-10-03 10:00:00' },
  ],
};
const OPTIONAL = 'Optional — send it now or later from the campaign page.';

const flow = (page) => page.getByRole('dialog', { name: /^(Create|Edit) Campaign$/ });
const button = (page, name) => flow(page).getByRole('button', { name, exact: true }).filter({ visible: true }).last();
const step = (page, id) => page.locator(`#${id}`);
const previewMoments = (page) => page.getByTestId('storeel-preview-moments').locator(':scope > li');
const rows = (page) => step(page, 'st-step-moments').locator('li[data-moment-row]');
const createPosts = (api) => api.state.calls.filter((c) => c.method === 'POST' && c.path === '/memories');

async function openStoreel(open, width, height, api) {
  const o = await open({ width, height, api });
  await o.page.locator('#nl-name').waitFor();
  await o.page.getByRole('radio', { name: 'Storeel', exact: true }).click();
  await o.page.getByPlaceholder(STOREEL_TITLE).waitFor();
  await o.page.waitForTimeout(900);
  return o;
}

async function chooseCategory(page, name) {
  await step(page, 'st-step-campaign').getByRole('combobox').first().click();
  await page.getByRole('option', { name }).click();
  await page.waitForTimeout(500);
}

/** Step 2's Add a Moment → the original Add a Moment UI → pick photos → Add all (each is uploaded; mock answers IMG). */
async function addPhotos(page, names) {
  await step(page, 'st-step-moments').getByRole('button', { name: 'Add a Moment' }).click();
  await page.locator('#file-upload').setInputFiles(names.map((name) => ({ name, mimeType: 'image/png', buffer: PNG })));
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /^Add all/ }).click();
  await page.waitForTimeout(1200);
}

/** A moment's caption, written the way the campaign page does it (Add caption → Write a caption… → Save). */
async function caption(page, index, text) {
  const row = rows(page).nth(index);
  await row.getByRole('button', { name: /^(Add|Edit) caption$/ }).click();
  await row.getByPlaceholder('Write a caption...').fill(text);
  await row.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(300);
}

/** In the viewport (not just "visible" somewhere in the scroller): what a person actually sees. */
async function inView(page, locator) {
  const box = await locator.first().boundingBox();
  const vp = page.viewportSize();
  return Boolean(box && vp && box.y >= 0 && box.y + Math.min(box.height, 40) <= vp.height && box.x >= 0 && box.x < vp.width);
}

async function scrollToEnd(page) {
  await page.locator('[role="dialog"] .modal-scrollbar').first().evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForTimeout(300);
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const [width, height] of [[1280, 1000], [390, 844]]) {
    const tag = String(width);

    // ── Create: 2 photos with captions + 1 picked product → 3 moments; Save as Draft → one POST, in order ───────
    const api = createMockApi({ catalogue: true });
    const { page, context } = await openStoreel(open, width, height, api);
    for (const [id, name] of [['st-step-campaign', 'Campaign'], ['st-step-moments', 'Moments'], ['st-step-send', 'Send']]) {
      await expectVisible(step(page, id).getByRole('heading', { name, exact: true }), `${tag}: card ${name} open`);
    }
    expect((await step(page, 'st-step-send').textContent()).includes(OPTIONAL), `${tag}: Send says it is optional`);
    expect(!(await flow(page).getByRole('button', { name: /^(Continue|Done)$/ }).count()), `${tag}: no Continue / Done`);
    expect(!(await page.locator('header').getByRole('button', { name: /Save as Draft|Save & Send|Send Now/ }).count()), `${tag}: no action in the top bar`);
    expect(!(await page.getByText('Press Continue').count()), `${tag}: no "Press Continue…" text`);
    expect(await button(page, 'Save & Send').isDisabled(), `${tag}: Save & Send off until Send is filled in`);
    await shot(page, `${tag}-01-empty`);
    // No title: the button is off and says why, above the actions.
    await page.locator('#st-actions').scrollIntoViewIfNeeded();
    expect(await button(page, 'Save as Draft').isDisabled() && await inView(page, page.getByText('Add a campaign title.')), `${tag}: Save as Draft off, "Add a campaign title." above the actions`);

    await page.getByPlaceholder(STOREEL_TITLE).fill(`Great Products ${tag}`);
    await chooseCategory(page, 'Website Catalogue');
    // Pressed with no catalogue item: the picker is scrolled into view, and the error shows above the actions too.
    await page.locator('#st-actions').scrollIntoViewIfNeeded();
    await button(page, 'Save as Draft').click();
    await page.waitForTimeout(900);
    expect(await inView(page, page.locator('#st-pick-items')), `${tag}: no item picked → the picker is brought into view`);
    expect((await page.locator('#st-actions').getByRole('alert').textContent())?.includes('Pick at least one item from your Website Catalogue.'), `${tag}: …and said above the actions`);
    expect(createPosts(api).length === 0, `${tag}: refused before any POST`);
    await shot(page, `${tag}-01b-no-item-picked`);
    await page.getByText('Oak bench', { exact: true }).first().click();
    await page.waitForTimeout(200);
    expect(!(await page.locator('#st-actions').getByRole('alert').count()), `${tag}: the error goes once an item is picked`);
    await page.waitForTimeout(300);
    await addPhotos(page, ['front.png', 'kitchen.png']);
    expect((await rows(page).count()) === 3, `${tag}: step 2 lists 3 moments (got ${await rows(page).count()})`);
    // Add from Media Library inside Add a Moment (desktop: its "Add" menu; phones only pick files there): the library
    // opens over it, the file already chosen in it stays, and the library pick is added to step 2.
    if (width >= 768) {
      await step(page, 'st-step-moments').getByRole('button', { name: 'Add a Moment' }).click();
      await page.locator('#file-upload').setInputFiles({ name: 'garden.png', mimeType: 'image/png', buffer: PNG });
      await page.waitForTimeout(1200);
      // Add a Moment's own "+ Add" menu (not step 1's tag / label Add buttons, which have no icon).
      await page.locator('button', { hasText: /^Add$/ }).filter({ has: page.locator('svg') }).filter({ visible: true }).first().click();
      await page.getByText('Add from Media Library').filter({ visible: true }).first().click();
      await expectVisible(page.getByRole('heading', { name: 'Add Moments from Library' }), `${tag}: the Media Library opens over Add a Moment`);
      await page.getByAltText('library-porch.png').click();
      await page.getByRole('button', { name: 'Add 1 Moment' }).click();
      await page.waitForTimeout(600);
      expect(await page.getByRole('button', { name: /^Add all \(1\)/ }).isVisible().catch(() => false), `${tag}: Add a Moment is still open with the file chosen in it`);
      expect((await rows(page).count()) === 4, `${tag}: the library photo is added to step 2 (got ${await rows(page).count()})`);
      await shot(page, `${tag}-02a-library-kept-files`);
      await page.getByRole('button', { name: /^Add all/ }).click();
      await page.waitForTimeout(1200);
      expect((await rows(page).count()) === 5, `${tag}: and the chosen file too (got ${await rows(page).count()})`);
      // Back to 3 moments for the checks below (removing rows never moves another row's caption).
      await rows(page).nth(4).getByRole('button', { name: /^Remove/ }).click();
      await rows(page).nth(3).getByRole('button', { name: /^Remove/ }).click();
      expect((await rows(page).count()) === 3, `${tag}: back to 3 moments`);
    }
    await caption(page, 1, 'Front porch, freshly painted');
    await caption(page, 2, 'Brand new kitchen');
    const ptext = (await page.getByTestId('storeel-preview').textContent()) ?? '';
    expect(ptext.includes('3 moments') && (await previewMoments(page).count()) === 3, `${tag}: the preview shows 3 moments (got "${ptext.slice(0, 120)}")`);
    expect(ptext.includes('Oak bench') && ptext.includes('View on website') && ptext.includes('Front porch, freshly painted') && ptext.includes('Brand new kitchen'),
      `${tag}: product, View on website and both captions in the preview`);
    expect(createPosts(api).length === 0, `${tag}: NOTHING POSTed before Save as Draft`);
    expect(!(await hasOverflow(page)), `${tag}: no sideways scroll`);
    await step(page, 'st-step-moments').scrollIntoViewIfNeeded();
    await shot(page, `${tag}-02-three-moments`);
    expect(!(await page.getByTestId('storeel-preview').getByText('Continue', { exact: true }).count()), `${tag}: no "Continue" pill in the preview`);
    // The actions come right after the Send card (phones: before the preview, so they're reached after the form).
    const actionsBox = await page.locator('#st-actions').boundingBox();
    const sendBox = await step(page, 'st-step-send').boundingBox();
    const pvBox = await page.getByTestId('storeel-preview').boundingBox();
    expect(actionsBox && sendBox && pvBox && actionsBox.y > sendBox.y + sendBox.height - 2 && (width < 1024 ? actionsBox.y < pvBox.y : actionsBox.x < pvBox.x),
      `${tag}: the actions right after the Send card${width < 1024 ? ', before the preview' : ''} (actions ${JSON.stringify(actionsBox)}, preview ${JSON.stringify(pvBox)})`);
    await page.locator('#st-actions').scrollIntoViewIfNeeded();
    expect(await inView(page, button(page, 'Save as Draft')), `${tag}: Save as Draft in the viewport once scrolled to`);
    await shot(page, `${tag}-03-end-of-list-actions`);

    await button(page, 'Save as Draft').click();
    await expectVisible(page.getByText('Saved as a draft').last(), `${tag}: toast "Saved as a draft"`);
    await page.waitForTimeout(400);
    const made = api.state.storeels.at(-1);
    expect(createPosts(api).length === 1, `${tag}: one POST /memories`);
    expect(made && JSON.stringify(made.catalog_item_ids) === '[61]' && made.photos_count === 2
      && made.photos?.[0]?.description === 'Front porch, freshly painted' && made.photos?.[1]?.description === 'Brand new kitchen'
      && made.photos?.[0]?.imageName === 'front.png' && made.photos?.[1]?.imageName === 'kitchen.png',
    `${tag}: the product + both photos with their captions, in order (got ${JSON.stringify(made && { i: made.catalog_item_ids, p: made.photos?.map((p) => [p.imageName, p.description]) })})`);
    expect(!(await flow(page).count()) && !api.state.storeelSends.length, `${tag}: closed, nothing sent`);
    await shot(page, `${tag}-04-created-toast`);
    await context.close();

    // ── Save as Draft with a filled-in Send card: created, and the toast says it was not sent ───────────────────
    const napi = createMockApi({});
    const n = await openStoreel(open, width, height, napi);
    await n.page.getByPlaceholder(STOREEL_TITLE).fill(`Not sent ${tag}`);
    await step(n.page, 'st-step-send').getByLabel(/^Message/).fill('Hello there');
    await button(n.page, 'Save as Draft').click();
    await expectVisible(n.page.getByText('Saved as a draft — not sent.'), `${tag}: "Saved as a draft — not sent."`);
    expect(createPosts(napi).length === 1 && !napi.state.storeelSends.length, `${tag}: created, nothing sent`);
    await n.context.close();

    // ── Save & Send: off with the reason until Send is filled in; then POST → confirm → sent ───────────────────
    const sapi = createMockApi({});
    const s = await openStoreel(open, width, height, sapi);
    await s.page.getByPlaceholder(STOREEL_TITLE).fill(`Spring sale ${tag}`);
    await scrollToEnd(s.page);
    await expectVisible(s.page.getByText(/^To send now:/), `${tag}: the reason Save & Send is off`);
    await shot(s.page, `${tag}-05-send-reason`);
    const send = step(s.page, 'st-step-send');
    await send.getByLabel('Email address').fill('jordan@example.com');
    await send.getByLabel('Phone number').fill('4165550171');
    await send.getByLabel(/^Message/).fill('Our spring sale starts Saturday.');
    await s.page.waitForTimeout(500);
    expect(!(await button(s.page, 'Save & Send').isDisabled()), `${tag}: Save & Send on once Send is filled in`);
    expect(createPosts(sapi).length === 0, `${tag}: still nothing created`);
    await button(s.page, 'Save & Send').click();
    const confirm = s.page.getByRole('dialog', { name: 'Send this Storeel now?' });
    await expectVisible(confirm, `${tag}: Save & Send → created, then the confirm`);
    await s.page.waitForTimeout(1200);
    expect(createPosts(sapi).length === 1, `${tag}: one POST before the confirm`);
    expect(/1 person/.test((await confirm.textContent()) ?? '') && /Sending publishes your campaign/.test((await confirm.textContent()) ?? ''), `${tag}: confirm counted and says it publishes`);
    await shot(s.page, `${tag}-06-confirm`);
    await confirm.getByRole('button', { name: 'Send Now' }).click();
    await expectVisible(s.page.getByText('Sent: 1 email and 1 text.'), `${tag}: sent toast`);
    await expectVisible(s.page.getByRole('button', { name: 'View stats' }), `${tag}: View stats`);
    const sent = sapi.state.storeelSends.at(-1);
    expect(sent && sent.id === sapi.state.storeels.at(-1)?.id && JSON.stringify(sent.body.audience) === JSON.stringify([{ type: 'person', email: 'jordan@example.com', phone: '+14165550171' }]),
      `${tag}: sent to the new campaign (got ${JSON.stringify(sent)})`);
    await s.page.waitForTimeout(400);
    expect(!(await flow(s.page).count()), `${tag}: closed after sending`);
    await shot(s.page, `${tag}-07-sent`);
    await s.context.close();

    // ── Save & Send, confirm left: it's saved; Save Changes / Save & Send are PUTs (never a second campaign) ──────
    const bapi = createMockApi({});
    const b = await openStoreel(open, width, height, bapi);
    await b.page.getByPlaceholder(STOREEL_TITLE).fill(`Back out ${tag}`);
    const bsend = step(b.page, 'st-step-send');
    await bsend.getByLabel('Email address').fill('jordan@example.com');
    await bsend.getByLabel(/^Message/).fill('Hello');
    await b.page.waitForTimeout(400);
    await button(b.page, 'Save & Send').click();
    const bconfirm = b.page.getByRole('dialog', { name: 'Send this Storeel now?' });
    await bconfirm.waitFor();
    await bconfirm.getByRole('button', { name: 'Back' }).click();
    await b.page.waitForTimeout(1500);
    const best = (await bsend.getByText('Estimated recipients').locator('..').locator('..').textContent()) ?? '';
    expect(/1 email/.test(best), `${tag}: once created, the Send card counts with the campaign (got "${best}")`);
    await scrollToEnd(b.page);
    await expectVisible(b.page.getByText('Saved as a draft. Send it now, or later from the campaign page.'), `${tag}: says it was created`);
    await expectVisible(button(b.page, 'Save Changes'), `${tag}: now Save Changes`);
    await expectVisible(b.page.getByRole('heading', { name: 'Edit Campaign' }), `${tag}: the campaign exists: the header says Edit Campaign`);
    expect(await inView(b.page, button(b.page, 'Close')) && !(await flow(b.page).getByRole('button', { name: 'Cancel', exact: true }).count()), `${tag}: …and Cancel says Close`);
    await expectVisible(button(b.page, 'Save & Send'), `${tag}: now Save & Send`);
    await shot(b.page, `${tag}-08-created-confirm-left`);
    await button(b.page, 'Save & Send').click();
    await expectVisible(b.page.getByRole('dialog', { name: 'Send this Storeel now?' }), `${tag}: Save & Send → confirm`);
    expect(createPosts(bapi).length === 1 && bapi.state.memoryPuts.length === 1, `${tag}: one campaign, then a PUT (posts ${createPosts(bapi).length}, puts ${bapi.state.memoryPuts.length})`);
    await b.page.getByRole('dialog', { name: 'Send this Storeel now?' }).getByRole('button', { name: 'Back' }).click();
    await button(b.page, 'Close').click();
    await expectVisible(b.page.getByText('Saved as a draft').last(), `${tag}: Close keeps it and says so`);
    await b.context.close();

    // ── Edit: prefilled, its moments in step 2, a caption saved on the campaign; Save Changes → PUT → closed ──────
    const edit = createMockApi({ memories: { 3021: SAVED }, putErrors: { title: 'This title is already taken.' } });
    const e = await open({ width, height, api: edit, query: '&campaignId=3021' });
    await expectVisible(e.page.getByRole('heading', { name: 'Edit Campaign' }), `${tag}: Edit Campaign`);
    const title = e.page.getByPlaceholder(STOREEL_TITLE);
    await title.waitFor();
    await e.page.waitForTimeout(600);
    expect((await title.inputValue()) === 'Spring Open House', `${tag}: title prefilled`);
    expect(!(await e.page.getByText('Select from Existing Campaigns').count()), `${tag}: no pickers in Edit (PUT can't change them)`);
    expect((await rows(e.page).count()) === 3 && ((await step(e.page, 'st-step-moments').textContent()) ?? '').includes('Fresh paint and new railings.'), `${tag}: step 2 lists the campaign's 3 moments`);
    expect(((await e.page.getByTestId('storeel-preview').textContent()) ?? '').includes('3 moments'), `${tag}: preview 3 moments`);
    await expectVisible(button(e.page, 'Save Changes'), `${tag}: Save Changes`);
    await expectVisible(button(e.page, 'Save & Send'), `${tag}: Save & Send`);
    await expectVisible(step(e.page, 'st-step-moments').getByText('Moments and captions save straight to your campaign.'), `${tag}: Edit says moments save at once`);
    expect(await button(e.page, 'Cancel').isVisible(), `${tag}: Cancel before anything is saved`);
    await caption(e.page, 1, 'All new cabinets');
    expect(await button(e.page, 'Close').isVisible() && !(await flow(e.page).getByRole('button', { name: 'Cancel', exact: true }).count()), `${tag}: after a caption is saved, Cancel says Close`);
    const upd = edit.state.imageUpdates.at(-1);
    expect(upd && upd.id === 2 && upd.description === 'All new cabinets', `${tag}: caption saved on the campaign (PUT /memory-images/2) (got ${JSON.stringify(upd)})`);
    expect(((await e.page.getByTestId('storeel-preview').textContent()) ?? '').includes('All new cabinets'), `${tag}: the preview shows the new caption`);
    // The original Add a Moment works on the campaign directly (as on its page), and step 2 / the preview follow.
    await step(e.page, 'st-step-moments').getByRole('button', { name: 'Add a Moment' }).click();
    await e.page.locator('#file-upload').setInputFiles({ name: 'garage.png', mimeType: 'image/png', buffer: PNG });
    await e.page.waitForTimeout(1500);
    await e.page.getByRole('button', { name: /^Add all/ }).click();
    await e.page.waitForTimeout(2000);
    expect((edit.state.momentsAdded ?? []).some((a) => a.memoryId === 3021), `${tag}: Add a Moment added it to campaign 3021 (POST upload-photos-after-creation)`);
    expect((await rows(e.page).count()) === 4 && ((await e.page.getByTestId('storeel-preview').textContent()) ?? '').includes('4 moments'), `${tag}: step 2 and the preview show 4 moments`);
    expect(!createPosts(edit).length, `${tag}: Edit never POSTs a campaign`);
    // Add from Media Library on a saved campaign works as on the campaign page: the pick goes into Add a Moment, which
    // adds it to the campaign.
    if (width >= 768) {
      await step(e.page, 'st-step-moments').getByRole('button', { name: 'Add a Moment' }).click();
      await e.page.getByRole('button', { name: 'Choose Files' }).filter({ visible: true }).first().click();
      await e.page.getByText('Add from Media Library').filter({ visible: true }).first().click();
      await expectVisible(e.page.getByRole('heading', { name: 'Add Moments from Library' }), `${tag}: Edit: the Media Library opens over Add a Moment`);
      await e.page.getByAltText('library-porch.png').click();
      await e.page.getByRole('button', { name: 'Add 1 Moment' }).click();
      await e.page.waitForTimeout(800);
      await e.page.getByRole('button', { name: /^Add all/ }).click();
      await rows(e.page).nth(4).waitFor({ timeout: 8000 }).catch(() => {});
      expect((edit.state.momentsAdded ?? []).length === 2 && (await rows(e.page).count()) === 5, `${tag}: Edit: the library photo added to the campaign (adds ${(edit.state.momentsAdded ?? []).length}, rows ${await rows(e.page).count()})`);
    }
    await step(e.page, 'st-step-moments').scrollIntoViewIfNeeded();
    await shot(e.page, `${tag}-09-edit-moments`);
    await title.fill('Spring Open House 2026');
    await button(e.page, 'Save Changes').click();
    await expectVisible(e.page.getByText('This title is already taken.'), `${tag}: 422 title under the title`);
    await e.page.waitForTimeout(800);
    expect(await inView(e.page, title), `${tag}: the title is brought into view on the 422`);
    expect((await e.page.locator('#st-actions').getByRole('alert').textContent())?.includes('This title is already taken.'), `${tag}: …and the error shows above the actions`);
    await shot(e.page, `${tag}-09b-edit-422-title-in-view`);
    edit.state.putErrors = null;
    await button(e.page, 'Save Changes').click();
    await expectVisible(e.page.getByText('Changes saved').last(), `${tag}: toast "Changes saved"`);
    await e.page.waitForTimeout(400);
    const put = edit.state.memoryPuts.at(-1);
    expect(put && put.id === 3021 && put.body.title === 'Spring Open House 2026' && !('category_id' in put.body) && put.body.date_range === 'Oct 1, 2026 - Oct 9, 2026' && !('last_update_img' in put.body),
      `${tag}: PUT /memories/3021 body (got ${JSON.stringify(put?.body)})`);
    expect(!(await flow(e.page).count()), `${tag}: Save Changes closes (back to the campaign page)`);
    await e.context.close();

    // Edit → Save & Send: PUT → confirm; a 422 on the message comes back under the box.
    const es = createMockApi({ memories: { 3021: SAVED }, storeelSendErrors: { message: 'Keep your message to 2,000 characters.' } });
    const e2 = await open({ width, height, api: es, query: '&campaignId=3021' });
    await e2.page.getByPlaceholder(STOREEL_TITLE).waitFor();
    const e2send = step(e2.page, 'st-step-send');
    await e2send.getByLabel('Email address').fill('jordan@example.com');
    await e2send.getByLabel(/^Message/).fill('See what is new.');
    await e2.page.waitForTimeout(1200);
    await button(e2.page, 'Save & Send').click();
    const e2c = e2.page.getByRole('dialog', { name: 'Send this Storeel now?' });
    await expectVisible(e2c, `${tag}: Save & Send → confirm`);
    expect(es.state.memoryPuts.length === 1, `${tag}: Save & Send saved first (PUT)`);
    await e2c.getByRole('button', { name: 'Send Now' }).click();
    await expectVisible(e2send.getByText('Keep your message to 2,000 characters.').first(), `${tag}: 422 message under the Message box`);
    await shot(e2.page, `${tag}-10-edit-send-422`);
    await e2.page.locator('#st-actions').scrollIntoViewIfNeeded();
    expect(await inView(e2.page, e2.page.getByText('Changes saved. Send it now, or later.')), `${tag}: after Save & Send's confirm: "Changes saved. Send it now, or later."`);
    expect(await button(e2.page, 'Close').isVisible(), `${tag}: …and Cancel says Close`);
    await e2.context.close();

    // ── 503 / Starter allowance / 403 ──────────────────────────────────────────────────────────────────────────────
    const down = createMockApi({ memories: { 3021: SAVED }, storeelUnavailable: true });
    const d = await open({ width, height, api: down, query: '&campaignId=3021' });
    await d.page.getByPlaceholder(STOREEL_TITLE).waitFor();
    const dsend = step(d.page, 'st-step-send');
    await dsend.getByLabel('Email address').fill('jordan@example.com');
    await dsend.getByLabel(/^Message/).fill('Hello');
    await d.page.waitForTimeout(1300);
    await expectVisible(dsend.getByText(/Sending Storeels isn.t available yet/).first(), `${tag}: 503 says sending isn't available yet`);
    await shot(d.page, `${tag}-11-not-available`);
    await d.context.close();

    const starter = createMockApi({
      plan: 'Starter', memories: { 3021: SAVED },
      allowance: { plan: 'Starter', email_limit: 0, sms_limit: 0, email_used: 0, sms_used: 0, email_pending: 0, sms_pending: 0, resets_at: '2026-12-01T05:00:00Z' },
    });
    const st = await open({ width, height, api: starter, query: '&campaignId=3021' });
    await st.page.getByPlaceholder(STOREEL_TITLE).waitFor();
    const ssend = step(st.page, 'st-step-send');
    await ssend.getByLabel('Email address').fill('jordan@example.com');
    await ssend.getByLabel(/^Message/).fill('Hello from a Starter account');
    await st.page.waitForTimeout(1300);
    expect(!(await ssend.getByRole('button', { name: 'Manage lists' }).count()), `${tag}: Starter: no Manage lists`);
    await button(st.page, 'Save & Send').click();
    const sc = st.page.getByRole('dialog', { name: 'Send this Storeel now?' });
    await expectVisible(sc.getByText(/This needs 1 email, but your plan has 0 left this month/), `${tag}: Starter: the allowance says why`);
    await expectVisible(sc.getByRole('button', { name: 'See plans' }), `${tag}: Starter: See plans`);
    expect(await sc.getByRole('button', { name: 'Send Now' }).isDisabled(), `${tag}: Starter: Send Now off`);
    expect(!starter.state.calls.some((c) => /^\/(newsletter|contact-lists)/.test(c.path)), `${tag}: Starter: no paid-only calls`);
    await shot(st.page, `${tag}-12-starter-allowance`);
    await st.context.close();

    const shared = createMockApi({ memories: { 3021: SAVED }, storeelForbidden: true });
    const sh = await open({ width, height, api: shared, query: '&campaignId=3021' });
    await sh.page.getByPlaceholder(STOREEL_TITLE).waitFor();
    await step(sh.page, 'st-step-send').getByLabel('Email address').fill('jordan@example.com');
    await sh.page.waitForTimeout(1300);
    await expectVisible(step(sh.page, 'st-step-send').getByText("Only the campaign's owner or its business's admins can send it."), `${tag}: 403: the card says who can send it`);
    expect(await button(sh.page, 'Save & Send').isDisabled() && !(await button(sh.page, 'Save Changes').isDisabled()), `${tag}: 403: Save & Send off, Save Changes on`);
    await shot(sh.page, `${tag}-13-not-allowed`);
    await sh.context.close();

    // ── Edit never re-files a Shopify / Cars / catalogue / property campaign, nor dates one ────────────────────────
    const kinds = {
      3101: { ...SAVED, id: 3101, title: 'Shopify picks', category: null, category_id: null, is_shopify: 1 },
      3102: { ...SAVED, id: 3102, title: 'Jeep deals', category: null, category_id: null, is_car: 1 },
      3103: { ...SAVED, id: 3103, title: 'Showroom', category: null, category_id: null, property_category_id: 44 },
      3104: { ...SAVED, id: 3104, title: 'Bench sale', category: { id: 12, name: 'Website Catalogue' } },
      3105: { ...SAVED, id: 3105, title: 'No dates', min_uploaded_img_date: null, max_uploaded_img_date: null },
    };
    const kindApi = createMockApi({ memories: kinds, catalogue: true, cars: true });
    for (const [id, want] of [[3101, 'Shopify'], [3102, 'Cars'], [3103, 'Current category'], [3104, 'Website Catalogue'], [3105, 'Service']]) {
      const k = await open({ width, height, api: kindApi, query: `&campaignId=${id}` });
      const ktitle = k.page.getByPlaceholder(STOREEL_TITLE);
      await ktitle.waitFor();
      await k.page.waitForTimeout(1200);
      const shown = (await step(k.page, 'st-step-campaign').getByRole('combobox').first().textContent()) ?? '';
      expect(shown.includes(want), `${tag}: ${id}: keeps its category "${want}" (shows "${shown}")`);
      if (id === 3105) expect((await step(k.page, 'st-step-campaign').locator('input[type="date"]').first().inputValue()) === '', `${tag}: no dates stays empty`);
      await ktitle.fill(`${kinds[id].title} 2`);
      await button(k.page, 'Save Changes').click();
      await k.page.waitForTimeout(800);
      const kput = kindApi.state.memoryPuts.at(-1);
      expect(kput && kput.id === id && !('category_id' in kput.body), `${tag}: ${id}: PUT without category_id (got ${JSON.stringify(kput?.body)})`);
      if (id === 3105) expect(kput && !('date_range' in kput.body), `${tag}: no dates: no date_range`);
      await k.context.close();
    }

    // ── A Cars campaign: the vehicle in step 2 and the preview; created with car_ids ───────────────────────────────
    const carApi = createMockApi({ cars: true });
    const cc = await openStoreel(open, width, height, carApi);
    await cc.page.getByPlaceholder(STOREEL_TITLE).fill(`Jeep week ${tag}`);
    await chooseCategory(cc.page, 'Cars');
    await cc.page.getByText('2024 Jeep Wrangler', { exact: true }).first().click();
    await cc.page.waitForTimeout(400);
    expect((await rows(cc.page).count()) === 1 && (await rows(cc.page).first().getAttribute('data-moment-row')) === 'vehicle', `${tag}: the vehicle in step 2`);
    const ctext = (await cc.page.getByTestId('storeel-preview').textContent()) ?? '';
    expect(ctext.includes('1 moment') && ctext.includes('$34,995 · 45,000 mi · Stock #S2300'), `${tag}: the vehicle in the preview`);
    await cc.page.getByTestId('storeel-preview').scrollIntoViewIfNeeded();
    await shot(cc.page, `${tag}-14-cars`);
    await button(cc.page, 'Save as Draft').click();
    await cc.page.waitForTimeout(800);
    expect(JSON.stringify(carApi.state.storeels.at(-1)?.car_ids) === '["5"]', `${tag}: car_ids sent`);
    await cc.context.close();
  }
}
