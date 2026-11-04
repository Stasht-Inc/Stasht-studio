// Storeel flow v2 (Deepak, 4 Nov 2026 — approved design): Create / Edit a Storeel in TWO steps, explicit save, optional
// send. 1 Campaign (every Set up field; the live preview shows every moment; NOTHING is saved before "Create Campaign" /
// "Save Changes"), then it folds to "Campaign created" / "Changes saved" (View campaign, Edit); 2 Send (optional,
// enabled only once saved) with Done and Send Now. No Moments step, no resume note.
// At 1280 and 390:
//  - create with a picked Website Catalogue product + an uploaded photo → the preview shows 2 moments BEFORE saving,
//    nothing is POSTed until Create Campaign; Create → step 1 folded + Send enabled; Done → toast, no send;
//  - Send Now path; View campaign; Edit again after creating (Save Changes = PUT, Cancel puts the saved values back);
//  - Edit (a saved campaign) → prefilled, Send waits, Save Changes → PUT → Done; 422 on save and on send;
//  - 503 not available, Starter allowance + See plans, 403, the 1,000-per-send refusal said once;
//  - Shopify / Cars / catalogue / property / no-dates campaigns are never re-filed or dated on Save Changes;
//  - a Cars campaign: the vehicle in the preview, created, re-saved without the cars placeholder.
// node tests/newsletter/ui/check.mjs storeel-flow   (NL_BASE = the dev server)
import { createMockApi, IMG } from '../mock-api.mjs';

const STOREEL_TITLE = 'Give your campaign a meaningful title';
const PHOTO = new URL('../../../../public/pwa-icon-512.png', import.meta.url).pathname;
// GET /memories/3021 (MemoriesController::show) for Edit: three moments.
const SAVED = {
  id: 3021, title: 'Spring Open House', slug: 'spring-open-house', published: 1, is_car: 0, user_id: 990002,
  category: { id: 8, name: 'Service' }, sub_category: { id: 3, name: 'Events' }, min_uploaded_img_date: '2026-10-01', max_uploaded_img_date: '2026-10-09',
  location: 'Toronto, ON', tags: ['spring'], last_update_img: null,
  posts: [
    { id: 1, parent_id: null, image_link: IMG, title: 'Front porch', capture_date: '2026-10-01 10:00:00' },
    { id: 2, parent_id: null, image_link: IMG, title: 'Kitchen', capture_date: '2026-10-02 10:00:00' },
    { id: 3, parent_id: null, image_link: IMG, title: 'Backyard', capture_date: '2026-10-03 10:00:00' },
  ],
};
const LOCKED_CREATE = 'Save your campaign first — then you can send it now or later.';
const LOCKED_EDIT = 'Save your changes first — then you can send it now or later.';
const INTRO = 'Your campaign is saved. Send it now, or do it later.';

const flow = (page) => page.getByRole('dialog', { name: /^(Create|Edit) Campaign$/ });
// Wider screens: the top bar; phones: the sticky footer.
const button = (page, name) => flow(page).getByRole('button', { name, exact: true }).filter({ visible: true }).last();
const primary = async (page, name) => { await button(page, name).click(); };
const step = (page, id) => page.locator(`#${id}`);
const moments = (page) => page.getByTestId('storeel-preview-moments').locator(':scope > li');
const createPosts = (api) => api.state.calls.filter((c) => c.method === 'POST' && c.path === '/memories');

async function openStoreel(open, width, height, api) {
  const o = await open({ width, height, api });
  await o.page.locator('#nl-name').waitFor();
  await o.page.getByRole('radio', { name: 'Storeel', exact: true }).click();
  await o.page.getByPlaceholder(STOREEL_TITLE).waitFor();
  await o.page.waitForTimeout(900); // categories, catalogue and cars load
  return o;
}

async function chooseCategory(page, name) {
  await step(page, 'st-step-campaign').getByRole('combobox').first().click();
  await page.getByRole('option', { name }).click();
  await page.waitForTimeout(500);
}

/** The Media box's file picker → Add a Moment → "Add all" (the photo is uploaded; mock answers with IMG). */
async function uploadPhoto(page) {
  await page.locator('#create-memory-file-upload').setInputFiles(PHOTO);
  await page.getByRole('button', { name: /^Add all/ }).click();
  await page.waitForTimeout(2500);
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const [width, height] of [[1280, 1000], [390, 844]]) {
    const tag = String(width);

    // ── Create: a picked catalogue product + an uploaded photo → 2 moments in the preview, nothing POSTed ──────────
    const api = createMockApi({ catalogue: true });
    const { page, context } = await openStoreel(open, width, height, api);
    await expectVisible(step(page, 'st-step-campaign').getByRole('heading', { name: 'Campaign' }), `${tag}: 1 Campaign`);
    await expectVisible(step(page, 'st-step-send').getByRole('heading', { name: 'Send' }), `${tag}: 2 Send`);
    expect(!(await page.locator('#st-step-moments').count()), `${tag}: no Moments step`);
    expect((await step(page, 'st-step-send').textContent()).includes(LOCKED_CREATE), `${tag}: Send waits with "${LOCKED_CREATE}"`);
    await expectVisible(button(page, 'Create Campaign'), `${tag}: Create Campaign button`);
    await expectVisible(button(page, 'Cancel'), `${tag}: Cancel button`);
    expect(!(await flow(page).getByRole('button', { name: 'Continue', exact: true }).count()), `${tag}: no Continue button`);
    expect((await page.getByTestId('storeel-preview').textContent()).includes('0 moments'), `${tag}: empty form: 0 moments`);

    await page.getByPlaceholder(STOREEL_TITLE).fill(`Great Products ${tag}`);
    await chooseCategory(page, 'Website Catalogue');
    await page.getByText('Oak bench', { exact: true }).first().click();
    await page.waitForTimeout(400);
    expect((await page.getByTestId('storeel-preview').textContent()).includes('1 moment'), `${tag}: picked product → 1 moment`);
    await uploadPhoto(page);
    const preview = page.getByTestId('storeel-preview');
    const ptext = (await preview.textContent()) ?? '';
    expect(ptext.includes('2 moments'), `${tag}: product + photo → "2 moments" (got "${ptext.slice(0, 160)}")`);
    expect((await moments(page).count()) === 2, `${tag}: two moment cards (got ${await moments(page).count()})`);
    expect(await moments(page).nth(0).getAttribute('data-moment-kind') === 'product' && await moments(page).nth(1).getAttribute('data-moment-kind') === 'photo',
      `${tag}: the product first, then the photo (the order the API makes them)`);
    expect(ptext.includes('Oak bench') && ptext.includes('$450') && ptext.includes('View on website'), `${tag}: the product moment: title, price, View on website`);
    expect((await moments(page).nth(0).locator('img').first().getAttribute('src')) === IMG, `${tag}: the product's photo`);
    expect((await moments(page).nth(1).locator('img').first().getAttribute('src')) === IMG, `${tag}: the uploaded photo`);
    expect(createPosts(api).length === 0 && api.state.storeels.length === 0, `${tag}: NOTHING POSTed before Create Campaign`);
    expect(!(await hasOverflow(page)), `${tag}: no sideways scroll with moments`);
    await preview.scrollIntoViewIfNeeded();
    await shot(page, `${tag}-01-before-create-2-moments`);

    await primary(page, 'Create Campaign');
    await expectVisible(step(page, 'st-step-campaign').getByText('Campaign created'), `${tag}: step 1 folds to "Campaign created"`);
    const created = api.state.storeels.at(-1);
    expect(createPosts(api).length === 1, `${tag}: one POST /memories (got ${createPosts(api).length})`);
    expect(created && created.category_id === 'website_catalogue' && JSON.stringify(created.catalog_item_ids) === '[61]' && created.photos?.length === 1 && created.photos_count === 1,
      `${tag}: POST body: the catalogue item and the photo (got ${JSON.stringify(created && { c: created.category_id, i: created.catalog_item_ids, p: created.photos?.length })})`);
    const camp = step(page, 'st-step-campaign');
    await expectVisible(camp.getByRole('button', { name: 'View campaign' }), `${tag}: View campaign`);
    await expectVisible(camp.getByRole('button', { name: 'Edit', exact: true }), `${tag}: Edit`);
    await expectVisible(camp.getByRole('button', { name: 'Add more moments on the campaign page' }), `${tag}: Add more moments link`);
    const send = step(page, 'st-step-send');
    await expectVisible(send.getByText(INTRO), `${tag}: Send enabled: "${INTRO}"`);
    await expectVisible(send.getByLabel('Email address'), `${tag}: Send enabled: Single person`);
    await expectVisible(button(page, 'Done'), `${tag}: Done`);
    await expectVisible(button(page, 'Send Now'), `${tag}: Send Now`);
    expect(!(await flow(page).getByRole('button', { name: 'Create Campaign', exact: true }).count()), `${tag}: no second Create Campaign`);
    expect(!(await page.getByRole('radio', { name: 'Newsletter' }).count()), `${tag}: no Newsletter | Storeel switch once created`);
    expect((await preview.textContent()).includes('2 moments'), `${tag}: still 2 moments after creating`);
    await page.locator('[role="dialog"] .modal-scrollbar').first().evaluate((el) => el.scrollTo(0, 0));
    await shot(page, `${tag}-02-created-send-enabled`);

    await primary(page, 'Done');
    await expectVisible(page.getByText('Campaign created').last(), `${tag}: Done → toast "Campaign created"`);
    await page.waitForTimeout(400);
    expect(!(await flow(page).count()), `${tag}: Done closes the flow`);
    expect(!api.state.storeelSends.length && !api.state.calls.some((c) => /storeel-send/.test(c.path)), `${tag}: Done sends nothing`);
    await shot(page, `${tag}-03-done-toast`);
    await context.close();

    // ── Create → Send Now → confirm → sent (and View campaign / Edit again on the way) ───────────────────────────
    const sapi = createMockApi({});
    const s = await openStoreel(open, width, height, sapi);
    const opened = [];
    await s.page.exposeFunction('__openCampaign', (id) => opened.push(id));
    await s.page.evaluate(() => window.addEventListener('stasht-open-campaign', (e) => window.__openCampaign(e.detail.memoryId)));
    await s.page.getByPlaceholder(STOREEL_TITLE).fill(`Spring sale ${tag}`);
    await primary(s.page, 'Create Campaign');
    await expectVisible(step(s.page, 'st-step-campaign').getByText('Campaign created'), `${tag}: created`);
    const sid = sapi.state.storeels.at(-1)?.id;
    // Edit again: Save Changes (PUT), Cancel puts the saved title back.
    await step(s.page, 'st-step-campaign').getByRole('button', { name: 'Edit', exact: true }).click();
    await expectVisible(button(s.page, 'Save Changes'), `${tag}: Edit after creating → Save Changes`);
    expect((await step(s.page, 'st-step-send').textContent()).includes(LOCKED_EDIT), `${tag}: Send waits while step 1 is open again ("${LOCKED_EDIT}")`);
    expect(!(await s.page.locator('#create-memory-file-upload').count()), `${tag}: no Media once created (PUT can't add moments)`);
    await s.page.getByPlaceholder(STOREEL_TITLE).fill('Typo title');
    await primary(s.page, 'Cancel');
    await expectVisible(step(s.page, 'st-step-campaign').getByText('Campaign created'), `${tag}: Cancel folds step 1 again`);
    expect((await step(s.page, 'st-step-campaign').textContent()).includes(`Spring sale ${tag}`), `${tag}: Cancel put the saved title back`);
    expect(!sapi.state.memoryPuts.length, `${tag}: Cancel saved nothing`);
    await step(s.page, 'st-step-campaign').getByRole('button', { name: 'Edit', exact: true }).click();
    await s.page.getByPlaceholder(STOREEL_TITLE).fill(`Spring sale ${tag}!`);
    await shot(s.page, `${tag}-04-edit-again-after-create`);
    await primary(s.page, 'Save Changes');
    await expectVisible(step(s.page, 'st-step-campaign').getByText('Campaign created'), `${tag}: saved again, folded`);
    const sput = sapi.state.memoryPuts.at(-1);
    expect(sput && sput.id === sid && sput.body.title === `Spring sale ${tag}!` && !('category_id' in sput.body), `${tag}: Save Changes = PUT /memories/${sid} (got ${JSON.stringify(sput)})`);
    expect(createPosts(sapi).length === 1, `${tag}: still one campaign (no second POST)`);

    const ssend = step(s.page, 'st-step-send');
    await ssend.getByLabel('Email address').fill('jordan@example.com');
    await ssend.getByLabel('Phone number').fill('4165550171');
    await ssend.getByLabel(/^Message/).fill('Our spring sale starts Saturday.');
    await s.page.waitForTimeout(1200);
    expect(!(await hasOverflow(s.page)), `${tag}: no sideways scroll on Send`);
    await shot(s.page, `${tag}-05-send-filled`);
    await primary(s.page, 'Send Now');
    const confirm = s.page.getByRole('dialog', { name: 'Send this Storeel now?' });
    await expectVisible(confirm, `${tag}: Send Now → confirm`);
    expect(/Sending publishes your campaign \(Public\)/.test((await confirm.textContent()) ?? ''), `${tag}: unpublished: sending publishes it`);
    await shot(s.page, `${tag}-06-confirm`);
    await confirm.getByRole('button', { name: 'Send Now' }).click();
    await expectVisible(s.page.getByText('Sent: 1 email and 1 text.'), `${tag}: toast after sending`);
    await expectVisible(s.page.getByRole('button', { name: 'View stats' }), `${tag}: View stats on the toast`);
    const sent = sapi.state.storeelSends.at(-1);
    expect(sent && sent.id === sid && JSON.stringify(sent.body.audience) === JSON.stringify([{ type: 'person', email: 'jordan@example.com', phone: '+14165550171' }]), `${tag}: send payload (got ${JSON.stringify(sent?.body)})`);
    await s.page.waitForTimeout(400);
    expect(!(await flow(s.page).count()), `${tag}: the flow closes after sending`);
    await shot(s.page, `${tag}-07-sent-toast`);
    await s.context.close();

    // View campaign (create): closes and asks App to open the campaign page.
    const vapi = createMockApi({});
    const v = await openStoreel(open, width, height, vapi);
    const vopened = [];
    await v.page.exposeFunction('__openCampaign', (id) => vopened.push(id));
    await v.page.evaluate(() => window.addEventListener('stasht-open-campaign', (e) => window.__openCampaign(e.detail.memoryId)));
    await v.page.getByPlaceholder(STOREEL_TITLE).fill(`Open me ${tag}`);
    await primary(v.page, 'Create Campaign');
    await step(v.page, 'st-step-campaign').getByRole('button', { name: 'View campaign' }).click();
    await v.page.waitForTimeout(400);
    expect(!(await flow(v.page).count()) && vopened.includes(vapi.state.storeels.at(-1)?.id), `${tag}: View campaign closes and opens the campaign page (got ${JSON.stringify(vopened)})`);
    expect(!(await v.page.evaluate(() => sessionStorage.getItem('stasht_storeel_flow_resume'))), `${tag}: no resume note any more`);
    await v.context.close();
    void opened;

    // ── Edit: prefilled, preview shows its moments, Send waits; 422 on save; Save Changes → PUT; Send; Done ─────────
    const edit = createMockApi({ memories: { 3021: SAVED }, putErrors: { title: 'This title is already taken.' } });
    const e = await open({ width, height, api: edit, query: '&campaignId=3021' });
    await expectVisible(e.page.getByRole('heading', { name: 'Edit Campaign' }), `${tag}: Edit Campaign`);
    const title = e.page.getByPlaceholder(STOREEL_TITLE);
    await title.waitFor();
    expect((await title.inputValue()) === 'Spring Open House', `${tag}: title prefilled`);
    expect(!(await e.page.getByRole('radio', { name: 'Newsletter' }).count()), `${tag}: no Newsletter | Storeel switch when editing`);
    expect(!(await e.page.getByText('Select from Existing Campaigns').count()) && !(await e.page.locator('#create-memory-file-upload').count()), `${tag}: no pickers / media in Edit (PUT can't change them)`);
    await expectVisible(e.page.getByRole('button', { name: 'Delete campaign' }), `${tag}: Delete in step 1`);
    await expectVisible(button(e.page, 'Save Changes'), `${tag}: Save Changes`);
    await expectVisible(button(e.page, 'Cancel'), `${tag}: Cancel`);
    expect((await step(e.page, 'st-step-send').textContent()).includes(LOCKED_EDIT), `${tag}: Send waits: "${LOCKED_EDIT}"`);
    const etext = (await e.page.getByTestId('storeel-preview').textContent()) ?? '';
    expect(etext.includes('3 moments') && etext.includes('Front porch') && etext.includes('Backyard') && (await moments(e.page).count()) === 3, `${tag}: Edit preview shows the campaign's 3 moments`);
    await shot(e.page, `${tag}-08-edit-prefilled`);
    await title.fill('Spring Open House 2026');
    await primary(e.page, 'Save Changes');
    await expectVisible(e.page.getByText('This title is already taken.'), `${tag}: 422 title under the title`);
    edit.state.putErrors = null;
    await primary(e.page, 'Save Changes');
    await expectVisible(step(e.page, 'st-step-campaign').getByText('Changes saved'), `${tag}: "Changes saved"`);
    const put = edit.state.memoryPuts.at(-1);
    expect(put && put.id === 3021 && put.body.title === 'Spring Open House 2026' && !('category_id' in put.body) && put.body.sub_category_id === 'Events'
      && put.body.date_range === 'Oct 1, 2026 - Oct 9, 2026' && put.body.location === 'Toronto, ON' && !('last_update_img' in put.body),
    `${tag}: PUT /memories/3021 body (got ${JSON.stringify(put?.body)})`);
    await expectVisible(button(e.page, 'Done'), `${tag}: Edit saved: Done`);
    await expectVisible(step(e.page, 'st-step-send').getByText(INTRO), `${tag}: Edit saved: Send enabled`);
    await shot(e.page, `${tag}-09-edit-saved`);
    const esend = step(e.page, 'st-step-send');
    await esend.getByLabel('Email address').fill('jordan@example.com');
    edit.state.storeelSendErrors = { message: 'Keep your message to 2,000 characters.' };
    await esend.getByLabel(/^Message/).fill('See what is new this spring.');
    await e.page.waitForTimeout(1200);
    await primary(e.page, 'Send Now');
    await e.page.getByRole('dialog', { name: 'Send this Storeel now?' }).getByRole('button', { name: 'Send Now' }).click();
    await expectVisible(esend.getByText('Keep your message to 2,000 characters.').first(), `${tag}: 422 message under the Message box`);
    edit.state.storeelSendErrors = null;
    await primary(e.page, 'Done');
    await expectVisible(e.page.getByText('Changes saved').last(), `${tag}: Done → toast "Changes saved"`);
    await e.page.waitForTimeout(400);
    expect(!(await flow(e.page).count()), `${tag}: Done closes the Edit flow (back to the campaign page)`);
    await e.context.close();

    // A saved campaign, opened on Edit and saved, ready to send (the paths below).
    const saveFirst = async (o) => {
      await o.page.getByPlaceholder(STOREEL_TITLE).waitFor();
      await o.page.waitForTimeout(600);
      await primary(o.page, 'Save Changes');
      await step(o.page, 'st-step-send').getByLabel('Email address').waitFor({ timeout: 8000 }).catch(() => {});
    };

    // ── 503: not available yet ───────────────────────────────────────────────────────────────────────────────────
    const down = createMockApi({ memories: { 3021: SAVED }, storeelUnavailable: true });
    const d = await open({ width, height, api: down, query: '&campaignId=3021' });
    await saveFirst(d);
    const dsend = step(d.page, 'st-step-send');
    await dsend.getByLabel('Email address').fill('jordan@example.com');
    await dsend.getByLabel(/^Message/).fill('Hello');
    await d.page.waitForTimeout(1300);
    await expectVisible(dsend.getByText(/Sending Storeels isn.t available yet/).first(), `${tag}: 503 says sending isn't available yet`);
    await shot(d.page, `${tag}-10-not-available`);
    await d.context.close();

    // ── Starter: counts, allowance 0 → See plans; no paid-only calls ───────────────────────────────────────────────
    const starter = createMockApi({
      plan: 'Starter', memories: { 3021: SAVED },
      allowance: { plan: 'Starter', email_limit: 0, sms_limit: 0, email_used: 0, sms_used: 0, email_pending: 0, sms_pending: 0, resets_at: '2026-12-01T05:00:00Z' },
    });
    const st = await open({ width, height, api: starter, query: '&campaignId=3021' });
    await saveFirst(st);
    const ssend2 = step(st.page, 'st-step-send');
    await ssend2.getByLabel('Email address').fill('jordan@example.com');
    await ssend2.getByLabel(/^Message/).fill('Hello from a Starter account');
    await st.page.waitForTimeout(1300);
    expect(!(await ssend2.getByRole('button', { name: 'Manage lists' }).count()), `${tag}: Starter: no Manage lists`);
    await primary(st.page, 'Send Now');
    const sc = st.page.getByRole('dialog', { name: 'Send this Storeel now?' });
    await expectVisible(sc.getByText(/This needs 1 email, but your plan has 0 left this month/), `${tag}: Starter: the allowance says why`);
    await expectVisible(sc.getByRole('button', { name: 'See plans' }), `${tag}: Starter: See plans`);
    expect(await sc.getByRole('button', { name: 'Send Now' }).isDisabled(), `${tag}: Starter: Send Now off`);
    expect(!starter.state.calls.some((c) => /^\/(newsletter|contact-lists)/.test(c.path)), `${tag}: Starter: no paid-only calls`);
    await shot(st.page, `${tag}-11-starter-allowance`);
    await st.context.close();

    // ── 403: not allowed to send this campaign ─────────────────────────────────────────────────────────────────────
    const shared = createMockApi({ memories: { 3021: SAVED }, storeelForbidden: true });
    const sh = await open({ width, height, api: shared, query: '&campaignId=3021' });
    await saveFirst(sh);
    await step(sh.page, 'st-step-send').getByLabel('Email address').fill('jordan@example.com');
    await sh.page.waitForTimeout(1300);
    await expectVisible(step(sh.page, 'st-step-send').getByText("Only the campaign's owner or its business's admins can send it."), `${tag}: 403: the step says who can send it`);
    expect(await button(sh.page, 'Send Now').isDisabled(), `${tag}: 403: Send Now off`);
    await expectVisible(button(sh.page, 'Done'), `${tag}: 403: Done still keeps the saved campaign`);
    await shot(sh.page, `${tag}-12-not-allowed`);
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
      expect(shown.includes(want), `${tag}: ${id}: step 1 keeps its category "${want}" (shows "${shown}")`);
      if (id === 3105) expect((await step(k.page, 'st-step-campaign').locator('input[type="date"]').first().inputValue()) === '', `${tag}: no dates stays empty`);
      if (id === 3101 && width === 1280) await shot(k.page, `${tag}-13-edit-shopify-keeps-category`);
      await ktitle.fill(`${kinds[id].title} 2`);
      await primary(k.page, 'Save Changes');
      await expectVisible(step(k.page, 'st-step-campaign').getByText('Changes saved'), `${tag}: ${id}: saved (no 422)`);
      const kput = kindApi.state.memoryPuts.at(-1);
      expect(kput && kput.id === id && !('category_id' in kput.body), `${tag}: ${id}: PUT without category_id (got ${JSON.stringify(kput?.body)})`);
      if (id === 3105) expect(kput && !('date_range' in kput.body), `${tag}: no dates: no date_range (got ${JSON.stringify(kput?.body)})`);
      await k.context.close();
    }

    // ── A Cars campaign: the vehicle is a moment in the preview; created; re-saved without the cars placeholder ────
    const carApi = createMockApi({ cars: true });
    const cc = await openStoreel(open, width, height, carApi);
    await cc.page.getByPlaceholder(STOREEL_TITLE).fill(`Jeep week ${tag}`);
    await chooseCategory(cc.page, 'Cars');
    await cc.page.getByText('2024 Jeep Wrangler', { exact: true }).first().click();
    await cc.page.waitForTimeout(400);
    const ctext = (await cc.page.getByTestId('storeel-preview').textContent()) ?? '';
    expect(ctext.includes('1 moment') && ctext.includes('$34,995 · 45,000 mi · Stock #S2300') && (await moments(cc.page).first().getAttribute('data-moment-kind')) === 'vehicle',
      `${tag}: the picked vehicle is a vehicle moment with price, mileage and stock (got "${ctext.slice(0, 200)}")`);
    expect(!createPosts(carApi).length, `${tag}: Cars: nothing POSTed before Create Campaign`);
    await cc.page.getByTestId('storeel-preview').scrollIntoViewIfNeeded();
    await shot(cc.page, `${tag}-14-cars-preview`);
    await primary(cc.page, 'Create Campaign');
    await expectVisible(step(cc.page, 'st-step-campaign').getByText('Campaign created'), `${tag}: Cars campaign created`);
    expect(JSON.stringify(carApi.state.storeels.at(-1)?.car_ids) === '["5"]', `${tag}: Cars: car_ids sent (got ${JSON.stringify(carApi.state.storeels.at(-1)?.car_ids)})`);
    await step(cc.page, 'st-step-campaign').getByRole('button', { name: 'Edit', exact: true }).click();
    await primary(cc.page, 'Save Changes');
    await expectVisible(step(cc.page, 'st-step-campaign').getByText('Campaign created'), `${tag}: Cars re-saved (no 422)`);
    const cput = carApi.state.memoryPuts.at(-1);
    expect(cput && !('category_id' in cput.body), `${tag}: Cars re-save without category_id (got ${JSON.stringify(cput?.body)})`);
    await cc.context.close();

    // ── The 1,000-per-send refusal is said once (under Send to) ────────────────────────────────────────────────────
    const LIMIT = 'This Storeel would go out as 1,200 messages, more than the 1,000 one send can make.';
    const lim = createMockApi({ memories: { 3021: SAVED }, storeelSendErrors: { audience: LIMIT } });
    const lm = await open({ width, height, api: lim, query: '&campaignId=3021' });
    await saveFirst(lm);
    const lsend = step(lm.page, 'st-step-send');
    await lsend.getByLabel('Email address').fill('jordan@example.com');
    await lsend.getByLabel(/^Message/).fill('Hello');
    await lm.page.waitForTimeout(1200);
    await primary(lm.page, 'Send Now');
    await lm.page.getByRole('dialog', { name: 'Send this Storeel now?' }).getByRole('button', { name: 'Send Now' }).click();
    await lm.page.waitForTimeout(800);
    const times = await lsend.getByText(LIMIT).count();
    expect(times === 1, `${tag}: storeel_limit said once in the step (got ${times})`);
    await lm.context.close();
  }
}
