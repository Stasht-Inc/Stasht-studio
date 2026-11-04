// Chris, 4 Nov 2026, point 9: Create / Edit a Storeel in three numbered steps like the newsletter composer —
// 1 Set up (Continue saves: POST /memories, or PUT /memories/{id} when editing), 2 Moments (a link to the campaign page,
// coming back resumes on Send), 3 Send (the newsletter audience as tracked Storeels: POST /memories/{id}/storeel-send).
// At 1280 and 390:
//  - create → Set up → Continue → Moments card → Continue → Send to a list → message → Send Now → confirm → toast;
//  - the same campaign opened again on Send (as when coming back) → Single person, email and phone → sent;
//  - Edit (a saved campaign) opens prefilled → Continue saves with PUT /memories/{id} → Send again;
//  - 422 on Set up (title) and on Send (message) under their fields; 503 not_available says it isn't available yet;
//  - Add moments on the campaign page: the flow closes, asks App to open the campaign, and leaves the resume note.
// node tests/newsletter/ui/check.mjs storeel-flow   (NL_BASE = the dev server)
import { createMockApi } from '../mock-api.mjs';

const STOREEL_TITLE = 'Give your campaign a meaningful title';
// GET /memories/3021 (MemoriesController::show) for Edit.
const SAVED = {
  id: 3021, title: 'Spring Open House', slug: 'spring-open-house', published: 1, is_car: 0, user_id: 990002,
  category: { id: 8, name: 'Service' }, sub_category: { id: 3, name: 'Events' }, min_uploaded_img_date: '2026-10-01', max_uploaded_img_date: '2026-10-09',
  location: 'Toronto, ON', tags: ['spring'], last_update_img: null, posts: [{ id: 1, parent_id: null }, { id: 2, parent_id: null }, { id: 3, parent_id: null }],
};

const flow = (page) => page.getByRole('dialog', { name: /^(Create|Edit) Campaign$/ });
const primary = async (page, width, name) => {
  // Wider screens: the top bar; phones: the sticky footer.
  const buttons = flow(page).getByRole('button', { name, exact: true }).filter({ visible: true });
  await buttons.last().click();
};
const step = (page, id) => page.locator(`#${id}`);

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const [width, height] of [[1280, 1000], [390, 844]]) {
    const tag = String(width);

    // ── Create → Set up → Moments → Send to a list ───────────────────────────────────────────────────────────────
    const api = createMockApi({ businessAddress: '4505 Steeles Ave W, Toronto, ON' });
    const { page, context } = await open({ width, height, api });
    const opened = [];
    await page.exposeFunction('__openCampaign', (id) => opened.push(id));
    await page.evaluate(() => window.addEventListener('stasht-open-campaign', (e) => window.__openCampaign(e.detail.memoryId)));
    await page.locator('#nl-name').waitFor();
    await page.getByRole('radio', { name: 'Storeel', exact: true }).click();
    await page.getByPlaceholder(STOREEL_TITLE).waitFor();
    await page.waitForTimeout(800); // categories load

    await expectVisible(step(page, 'st-step-setup').getByRole('heading', { name: 'Set up' }), `${tag}: 1 Set up`);
    await expectVisible(step(page, 'st-step-moments').getByRole('heading', { name: 'Moments' }), `${tag}: 2 Moments`);
    await expectVisible(step(page, 'st-step-send').getByRole('heading', { name: 'Send' }), `${tag}: 3 Send`);
    expect(!(await page.getByText('Add Users').count()), `${tag}: no Add Users in Set up (Send is step 3 now)`);
    expect(!(await page.getByText('Personalized Message').count()), `${tag}: no Personalized Message in Set up`);
    expect(!(await flow(page).getByRole('button', { name: 'Publish' }).count()), `${tag}: no Publish menu (sending publishes)`);
    expect((await step(page, 'st-step-send').textContent()).includes('Finish the steps above first'), `${tag}: Send waits for Set up`);
    expect(!(await hasOverflow(page)), `${tag}: no sideways scroll on Set up`);
    await shot(page, `${tag}-01-setup`);

    await page.getByPlaceholder(STOREEL_TITLE).fill(`Spring sale ${tag}`);
    await primary(page, width, 'Continue');
    await expectVisible(step(page, 'st-step-moments').getByRole('button', { name: 'Add moments on the campaign page' }), `${tag}: Moments card after Continue`);
    const created = api.state.storeels.find((s) => s.title === `Spring sale ${tag}`);
    expect(Boolean(created), `${tag}: Continue created the campaign with POST /memories`);
    expect(created && !('collaborators' in created), `${tag}: no collaborators sent any more`);
    expect((await step(page, 'st-step-moments').textContent()).includes('0 moments'), `${tag}: Moments says 0 moments`);
    expect((await step(page, 'st-step-setup').textContent()).includes(`Spring sale ${tag}`), `${tag}: Set up folds to its title`);
    expect(!(await page.getByRole('radio', { name: 'Newsletter' }).count()), `${tag}: no Newsletter | Storeel switch once saved`);
    await shot(page, `${tag}-02-moments`);

    await primary(page, width, 'Continue');
    const send = step(page, 'st-step-send');
    await expectVisible(send.getByRole('button', { name: /^Send to/ }), `${tag}: Send step open`);
    expect(await send.getByRole('checkbox', { name: /^Email/ }).isChecked(), `${tag}: Email ticked`);
    expect(await send.getByRole('checkbox', { name: /Text message/ }).isChecked(), `${tag}: Text message ticked (email + text)`);
    // Send to → the list (Single person goes).
    await send.getByRole('button', { name: /^Send to/ }).click();
    const menu = page.getByRole('dialog', { name: 'Send to' });
    await menu.getByRole('checkbox', { name: /Open house sign-ups/ }).check();
    await page.keyboard.press('Escape');
    await send.getByLabel(/^Message/).fill('Our spring sale starts Saturday.');
    await page.waitForTimeout(1200); // the count
    const est = (await send.getByText('Estimated recipients').locator('..').locator('..').textContent()) ?? '';
    expect(/198 emails · 140 texts/.test(est), `${tag}: estimate from storeel-audience-count (got "${est}")`);
    expect(api.state.calls.some((c) => c.path === `/memories/${created?.id}/storeel-audience-count`), `${tag}: counted with the Storeel endpoint`);
    expect(!api.state.calls.some((c) => c.path === '/newsletters/audience-count'), `${tag}: never the newsletter count`);
    expect(/Sent as \d+ text messages \(max 10\)/.test(await send.textContent()), `${tag}: SMS parts counter`);
    expect((await send.textContent()).includes('People get: Hi (their first name), this message came from Samantha Smith.'), `${tag}: what text recipients get`);
    expect(!(await hasOverflow(page)), `${tag}: no sideways scroll on Send`);
    await shot(page, `${tag}-03-send-list`);

    await primary(page, width, 'Send Now');
    const confirm = page.getByRole('dialog', { name: 'Send this Storeel now?' });
    await expectVisible(confirm, `${tag}: confirm dialog`);
    const ctext = (await confirm.textContent()) ?? '';
    expect(/198 people/.test(ctext) && /140 people/.test(ctext), `${tag}: confirm shows the counts (got "${ctext}")`);
    expect(/Not included:/.test(ctext), `${tag}: confirm says who is skipped`);
    expect(/338 messages \(up to 1,000 per send\)/.test(ctext), `${tag}: confirm shows the per-send cap`);
    expect(/Your plan has .* left this month/.test(ctext), `${tag}: confirm shows the allowance`);
    expect(/Sending publishes your campaign \(Public\)/.test(ctext), `${tag}: unpublished campaign: sending publishes it`);
    await shot(page, `${tag}-04-confirm`);
    await confirm.getByRole('button', { name: 'Send Now' }).click();
    await expectVisible(page.getByText(/Sending 198 emails and 140 texts/), `${tag}: toast after sending`);
    const sent = api.state.storeelSends.at(-1);
    expect(sent && JSON.stringify(sent.body.audience) === JSON.stringify([{ type: 'list', id: 9 }]) && sent.body.message === 'Our spring sale starts Saturday.'
      && JSON.stringify(sent.body.channels) === '["email","sms"]' && typeof sent.body.idempotency_key === 'string' && sent.body.idempotency_key.length > 8,
    `${tag}: send payload (got ${JSON.stringify(sent?.body)})`);
    await page.waitForTimeout(400);
    expect(!(await flow(page).count()), `${tag}: the flow closes after sending`);
    await shot(page, `${tag}-05-sent-toast`);
    await context.close();

    // ── The same campaign again, opened on Send (coming back): Single person, email and phone ─────────────────────
    const again = createMockApi({ memories: { 3021: SAVED } });
    const resumed = await open({ width, height, api: again, query: '&campaignId=3021&resume=send' });
    const rsend = step(resumed.page, 'st-step-send');
    await expectVisible(rsend.getByLabel('Email address'), `${tag}: back on Send with Single person`);
    expect((await step(resumed.page, 'st-step-moments').textContent()).includes('3 moments'), `${tag}: the campaign's moments`);
    await rsend.getByLabel('Email address').fill('jordan@example.com');
    await rsend.getByLabel('Phone number').fill('4165550171');
    await rsend.getByLabel(/^Message/).fill('Thanks for stopping by!');
    await resumed.page.waitForTimeout(1200);
    await shot(resumed.page, `${tag}-06-resume-single-person`);
    await primary(resumed.page, width, 'Send Now');
    const c2 = resumed.page.getByRole('dialog', { name: 'Send this Storeel now?' });
    await expectVisible(c2, `${tag}: confirm (single person)`);
    expect(!/Sending publishes/.test((await c2.textContent()) ?? ''), `${tag}: a published campaign is not re-published`);
    await c2.getByRole('button', { name: 'Send Now' }).click();
    await expectVisible(resumed.page.getByText('Sent: 1 email and 1 text.'), `${tag}: toast for one person`);
    const s2 = again.state.storeelSends.at(-1);
    expect(s2 && JSON.stringify(s2.body.audience) === JSON.stringify([{ type: 'person', email: 'jordan@example.com', phone: '+14165550171' }]), `${tag}: typed person sent as E.164 (got ${JSON.stringify(s2?.body.audience)})`);
    await resumed.context.close();

    // ── Edit: prefilled Set up → PUT /memories/{id} → Send again; 422 on Set up first ──────────────────────────────
    const edit = createMockApi({ memories: { 3021: SAVED }, putErrors: { title: 'This title is already taken.' } });
    const e = await open({ width, height, api: edit, query: '&campaignId=3021' });
    await expectVisible(e.page.getByRole('heading', { name: 'Edit Campaign' }), `${tag}: Edit Campaign`);
    const title = e.page.getByPlaceholder(STOREEL_TITLE);
    await title.waitFor();
    expect((await title.inputValue()) === 'Spring Open House', `${tag}: title prefilled`);
    expect(!(await e.page.getByRole('radio', { name: 'Newsletter' }).count()), `${tag}: no Newsletter | Storeel switch when editing`);
    expect(!(await e.page.getByText('Select from Existing Campaigns').count()), `${tag}: no linked campaigns in Edit (PUT can't change them)`);
    await expectVisible(e.page.getByRole('button', { name: 'Delete campaign' }), `${tag}: Delete in Set up`);
    await shot(e.page, `${tag}-07-edit-prefilled`);
    await title.fill('Spring Open House 2026');
    await primary(e.page, width, 'Continue');
    await expectVisible(e.page.getByText('This title is already taken.'), `${tag}: 422 title under the title`);
    await shot(e.page, `${tag}-08-edit-422-title`);
    edit.state.putErrors = null;
    await primary(e.page, width, 'Continue');
    await expectVisible(step(e.page, 'st-step-moments').getByRole('button', { name: 'Add moments on the campaign page' }), `${tag}: saved → Moments`);
    const put = edit.state.memoryPuts.at(-1);
    expect(put && put.id === 3021 && put.body.title === 'Spring Open House 2026' && !('category_id' in put.body) && put.body.sub_category_id === 'Events'
      && put.body.date_range === 'Oct 1, 2026 - Oct 9, 2026' && put.body.location === 'Toronto, ON' && !('last_update_img' in put.body),
    `${tag}: PUT /memories/3021 body (got ${JSON.stringify(put?.body)})`);
    await primary(e.page, width, 'Continue');
    const esend = step(e.page, 'st-step-send');
    await esend.getByLabel('Email address').fill('jordan@example.com');
    await esend.getByLabel('Phone number').fill('4165550171');
    // 422 on Send: the API's words under the Message box.
    edit.state.storeelSendErrors = { message: 'Keep your message to 2,000 characters.' };
    await esend.getByLabel(/^Message/).fill('See what is new this spring.');
    await e.page.waitForTimeout(1200);
    await primary(e.page, width, 'Send Now');
    await e.page.getByRole('dialog', { name: 'Send this Storeel now?' }).getByRole('button', { name: 'Send Now' }).click();
    await expectVisible(esend.getByText('Keep your message to 2,000 characters.').first(), `${tag}: 422 message under the Message box`);
    await shot(e.page, `${tag}-09-send-422-message`);
    edit.state.storeelSendErrors = null;
    await esend.getByLabel(/^Message/).fill('See what is new this spring!');
    await e.page.waitForTimeout(1200);
    await primary(e.page, width, 'Send Now');
    await e.page.getByRole('dialog', { name: 'Send this Storeel now?' }).getByRole('button', { name: 'Send Now' }).click();
    await expectVisible(e.page.getByText('Sent: 1 email and 1 text.'), `${tag}: sent again after editing`);
    await e.context.close();

    // ── 503: not available yet (the server's SQL hasn't run) ─────────────────────────────────────────────────────
    const down = createMockApi({ memories: { 3021: SAVED }, storeelUnavailable: true });
    const d = await open({ width, height, api: down, query: '&campaignId=3021&resume=send' });
    const dsend = step(d.page, 'st-step-send');
    await dsend.getByLabel('Email address').fill('jordan@example.com');
    await dsend.getByLabel(/^Message/).fill('Hello');
    await d.page.waitForTimeout(1300);
    await expectVisible(dsend.getByText(/Sending Storeels isn.t available yet/).first(), `${tag}: 503 says sending isn't available yet`);
    await shot(d.page, `${tag}-10-not-available`);
    await d.context.close();

    // ── Add moments on the campaign page: closes, opens the campaign, leaves the note to come back to Send ─────────
    const link = createMockApi({ memories: { 3021: SAVED } });
    const l = await open({ width, height, api: link, query: '&campaignId=3021' });
    const lopened = [];
    await l.page.exposeFunction('__openCampaign', (id) => lopened.push(id));
    await l.page.evaluate(() => window.addEventListener('stasht-open-campaign', (ev) => window.__openCampaign(ev.detail.memoryId)));
    await l.page.getByPlaceholder(STOREEL_TITLE).waitFor();
    await primary(l.page, width, 'Continue');
    await step(l.page, 'st-step-moments').getByRole('button', { name: 'Add moments on the campaign page' }).click();
    await l.page.waitForTimeout(400);
    expect(!(await flow(l.page).count()), `${tag}: the flow closes for the campaign page`);
    expect(lopened.includes(3021), `${tag}: asks App to open campaign 3021 (got ${JSON.stringify(lopened)})`);
    const note = await l.page.evaluate(() => sessionStorage.getItem('stasht_storeel_flow_resume'));
    expect(Boolean(note) && JSON.parse(note).memoryId === 3021 && JSON.parse(note).step === 'send', `${tag}: resume note for Send (got ${note})`);
    await l.context.close();

    // ── Plan gating as the API says: Starter counts but can't send (allowance 0) → See plans; no paid-only calls ──
    const starter = createMockApi({
      plan: 'Starter', memories: { 3021: SAVED },
      allowance: { plan: 'Starter', email_limit: 0, sms_limit: 0, email_used: 0, sms_used: 0, email_pending: 0, sms_pending: 0, resets_at: '2026-12-01T05:00:00Z' },
    });
    const st = await open({ width, height, api: starter, query: '&campaignId=3021&resume=send' });
    const ssend = step(st.page, 'st-step-send');
    await ssend.getByLabel('Email address').fill('jordan@example.com');
    await ssend.getByLabel(/^Message/).fill('Hello from a Starter account');
    await st.page.waitForTimeout(1300);
    await ssend.getByRole('button', { name: /^Send to/ }).click();
    const smenu = st.page.getByRole('dialog', { name: 'Send to' });
    expect(!(await smenu.getByText('Your lists').count()), `${tag}: Starter: no lists (paid-only)`);
    await st.page.keyboard.press('Escape');
    expect(!(await ssend.getByRole('button', { name: 'Manage lists' }).count()), `${tag}: Starter: no Manage lists`);
    await primary(st.page, width, 'Send Now');
    const sc = st.page.getByRole('dialog', { name: 'Send this Storeel now?' });
    await expectVisible(sc.getByText(/This needs 1 email, but your plan has 0 left this month/), `${tag}: Starter: the allowance says why`);
    await expectVisible(sc.getByRole('button', { name: 'See plans' }), `${tag}: Starter: See plans`);
    expect(await sc.getByRole('button', { name: 'Send Now' }).isDisabled(), `${tag}: Starter: Send Now off`);
    expect(!starter.state.calls.some((c) => /^\/(newsletter|contact-lists)/.test(c.path)), `${tag}: Starter: no paid-only calls (got ${starter.state.calls.filter((c) => /^\/(newsletter|contact-lists)/.test(c.path)).map((c) => c.path).join(', ')})`);
    await shot(st.page, `${tag}-11-starter-allowance`);
    await st.context.close();

    // ── Not allowed to send this campaign (403: not its owner / only shared with the property) ──────────────────
    const shared = createMockApi({ memories: { 3021: SAVED }, storeelForbidden: true });
    const sh = await open({ width, height, api: shared, query: '&campaignId=3021&resume=send' });
    await step(sh.page, 'st-step-send').getByLabel('Email address').fill('jordan@example.com');
    await sh.page.waitForTimeout(1300);
    await expectVisible(step(sh.page, 'st-step-send').getByText("Only the campaign's owner or its business's admins can send it."), `${tag}: 403: the step says who can send it`);
    expect(await flow(sh.page).getByRole('button', { name: 'Send Now', exact: true }).filter({ visible: true }).last().isDisabled(), `${tag}: 403: Send Now off`);
    await shot(sh.page, `${tag}-12-not-allowed`);
    await sh.context.close();

    // ── Review fixes 1-2, 4: Edit never re-files a Shopify / Cars / catalogue / property campaign, nor dates one ────
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
      await k.page.waitForTimeout(1200); // categories, cars and catalogue load
      const shown = (await k.page.locator('#st-step-setup').getByRole('combobox').first().textContent()) ?? '';
      expect(shown.includes(want), `${tag}: ${id}: Set up keeps its category "${want}" (shows "${shown}")`);
      if (id === 3105) expect((await k.page.locator('#st-step-setup input[type="date"]').first().inputValue()) === '', `${tag}: no dates stays empty`);
      if (id === 3101 && width === 1280) await shot(k.page, `${tag}-13-edit-shopify-keeps-category`);
      await ktitle.fill(`${kinds[id].title} 2`);
      await primary(k.page, width, 'Continue');
      await expectVisible(step(k.page, 'st-step-moments').getByRole('button', { name: 'Add moments on the campaign page' }), `${tag}: ${id}: saved (no 422)`);
      const kput = kindApi.state.memoryPuts.at(-1);
      expect(kput && kput.id === id && !('category_id' in kput.body), `${tag}: ${id}: PUT without category_id (got ${JSON.stringify(kput?.body)})`);
      if (id === 3105) expect(kput && !('date_range' in kput.body), `${tag}: no dates: no date_range (got ${JSON.stringify(kput?.body)})`);
      await k.context.close();
    }

    // Create a Cars campaign, then Set up → Edit → Continue: PUT without the cars placeholder (no 422).
    const carApi = createMockApi({ cars: true });
    const cc = await open({ width, height, api: carApi });
    await cc.page.locator('#nl-name').waitFor();
    await cc.page.getByRole('radio', { name: 'Storeel', exact: true }).click();
    await cc.page.getByPlaceholder(STOREEL_TITLE).waitFor();
    await cc.page.waitForTimeout(1200);
    await cc.page.locator('#st-step-setup').getByRole('combobox').first().click();
    await cc.page.getByRole('option', { name: 'Cars' }).click();
    await cc.page.getByPlaceholder(STOREEL_TITLE).fill(`Jeep week ${tag}`);
    // A Cars campaign is made from picked listings (the picker opens on its own; one is enough here).
    await cc.page.waitForTimeout(800);
    await primary(cc.page, width, 'Continue');
    await expectVisible(step(cc.page, 'st-step-setup').getByRole('button', { name: 'Edit' }), `${tag}: Cars campaign created`);
    await step(cc.page, 'st-step-setup').getByRole('button', { name: 'Edit' }).click();
    await primary(cc.page, width, 'Continue');
    await expectVisible(step(cc.page, 'st-step-moments').getByRole('button', { name: 'Add moments on the campaign page' }), `${tag}: Cars Set up re-saved (no 422)`);
    const cput = carApi.state.memoryPuts.at(-1);
    expect(cput && !('category_id' in cput.body), `${tag}: Cars re-save without category_id (got ${JSON.stringify(cput?.body)})`);
    await cc.context.close();

    // ── Review fix 6: the 1,000-per-send refusal is said once (under Send to), not twice ─────────────────────────
    const LIMIT = 'This Storeel would go out as 1,200 messages, more than the 1,000 one send can make.';
    const lim = createMockApi({ memories: { 3021: SAVED }, storeelSendErrors: { audience: LIMIT } });
    const lm = await open({ width, height, api: lim, query: '&campaignId=3021&resume=send' });
    const lsend = step(lm.page, 'st-step-send');
    await lsend.getByLabel('Email address').fill('jordan@example.com');
    await lsend.getByLabel(/^Message/).fill('Hello');
    await lm.page.waitForTimeout(1200);
    await primary(lm.page, width, 'Send Now');
    await lm.page.getByRole('dialog', { name: 'Send this Storeel now?' }).getByRole('button', { name: 'Send Now' }).click();
    await lm.page.waitForTimeout(800);
    const times = await lsend.getByText(LIMIT).count();
    expect(times === 1, `${tag}: storeel_limit said once in the step (got ${times})`);
    await shot(lm.page, `${tag}-14-limit-once`);
    await lm.context.close();
    void opened;
  }
}
