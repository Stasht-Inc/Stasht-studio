// Task 12: unfinished steps block sending and say why (an empty from name / reply-to never does: decision 5);
// the confirmation shows counts, allowance and asks for the address on the first send; a 422 allowance answer
// stays in the dialog; the API's errors.blocks messages show on the Content step; its reply_to_email 422 (no
// email on the account) shows on step 3; schedule for later confirms with the time; Starter sees the upgrade
// card and makes no newsletter calls.
import { createMockApi } from '../mock-api.mjs';

async function fillAll(page, { replyTo = 'sales@serpachrysler.ca' } = {}) {
  const preview = page.locator('aside');
  await page.locator('#nl-name').fill('Send check');
  await page.locator('#nl-from-name').fill('Serpa Chrysler');
  if (replyTo !== null) await page.locator('#nl-reply-to').fill(replyTo);
  await page.locator('#nl-subject').fill('October deals are here');
  await preview.getByRole('button', { name: 'Add a section at the top' }).click();
  await page.getByRole('menuitem', { name: /^Title/ }).click();
  await preview.getByLabel('Title', { exact: true }).fill('This month');
}

const sendButton = (page) => page.getByRole('button', { name: 'Send now' }).last();
const confirmDialog = (page) => page.getByRole('dialog', { name: 'Send this newsletter now?' });

function tomorrow() {
  const t = new Date(Date.now() + 24 * 3600 * 1000);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  let { page, api, context } = await open({ width: 1280, height: 1900 });
  await page.locator('#nl-name').fill('Send check');
  await page.locator('#nl-from-name').fill('');
  await page.locator('#nl-reply-to').fill('');
  await sendButton(page).click();
  await expectVisible(page.locator('#nl-step-subject').getByText('Add a subject line.'), 'Subject step marked');
  await expectVisible(page.locator('#nl-step-content').getByText('Add at least one section to the email.'), 'Content step marked');
  await expectVisible(page.getByText('Finish the steps marked in red, then try again.'), 'toast says what to do');
  expect(await page.locator('#nl-step-from [role="alert"]').count() === 0, 'empty from name and reply-to do not block (decision 5)');
  expect(!api.state.calls.some((c) => /\/(send|schedule)$/.test(c.path)), 'nothing sent while steps are unfinished');
  await page.waitForTimeout(700); // counts are debounced
  await shot(page, '1280-01-problems');

  await fillAll(page);
  await sendButton(page).click();
  const dialog = confirmDialog(page);
  await expectVisible(dialog, 'confirmation dialog');
  await expectVisible(dialog.getByText('1,180 people'), 'email count');
  await expectVisible(dialog.getByText('Your plan has 3,800 emails left this month. It resets on Nov 1.'), 'allowance line');
  await expectVisible(dialog.getByLabel('Business address'), 'address asked for on the first send');
  await page.waitForTimeout(700); // counts are debounced
  await shot(page, '1280-02-confirm');
  await dialog.getByLabel('Business address').fill('4505 Steeles Ave W, Toronto, ON');
  await dialog.getByRole('button', { name: 'Send now' }).click();
  await expectVisible(page.getByText(/^Sending now\./), 'sent toast');
  const brandPut = api.state.calls.findIndex((c) => c.method === 'PUT' && c.path === '/newsletter-brand' && c.body?.business_address);
  const send = api.state.calls.findIndex((c) => c.method === 'POST' && /\/send$/.test(c.path));
  expect(brandPut !== -1 && send > brandPut, 'address saved before sending');
  expect(api.state.newsletters[0]?.status === 'scheduled', 'newsletter queued to go');
  await context.close();

  // Allowance 422 stays in the dialog; its message already has the numbers (contract note 4).
  ({ page, api, context } = await open({ width: 1280, height: 1900, api: createMockApi({ businessAddress: '4505 Steeles Ave W', sendErrors: { allowance: ['This newsletter needs 1,216 emails, but your plan has 900 left this month.'] } }) }));
  await fillAll(page);
  await sendButton(page).click();
  const d2 = confirmDialog(page);
  await d2.getByRole('button', { name: 'Send now' }).click();
  await expectVisible(d2.getByText('This newsletter needs 1,216 emails, but your plan has 900 left this month.', { exact: true }), 'allowance 422 (NewsletterSendCheck message, numbers included) shown once in the dialog');
  await page.waitForTimeout(700); // counts are debounced
  await shot(page, '1280-03-allowance');
  await context.close();

  // Emails held back for scheduled / sending newsletters come off what is left (limit − used − pending).
  ({ page, api, context } = await open({ width: 1280, height: 1900, api: createMockApi({
    businessAddress: '4505 Steeles Ave W',
    allowance: { plan: 'Professional', email_limit: 5000, sms_limit: 500, email_used: 1200, sms_used: 40, email_pending: 2900, sms_pending: 0, resets_at: '2026-11-01T00:00:00Z' },
  }) }));
  await fillAll(page);
  await sendButton(page).click();
  const dp = confirmDialog(page);
  await expectVisible(dp.getByText('Your plan has 900 emails left this month. It resets on Nov 1.'), 'pending emails taken off what is left');
  await expectVisible(dp.getByText('This needs 1,180 emails, but your plan has 900 left this month.'), 'over the allowance once pending counts');
  expect(await dp.getByRole('button', { name: 'Send now' }).isDisabled(), 'Send now disabled when pending leaves too few');
  await context.close();

  // Contract note 6, server side: errors.blocks messages show on the Content step.
  ({ page, api, context } = await open({ width: 1280, height: 1900, api: createMockApi({
    businessAddress: '4505 Steeles Ave W',
    sendErrors: { blocks: ['Section 2 (Image) needs a picture.', 'Section 4 (Button) needs a link.'] },
  }) }));
  await fillAll(page);
  await sendButton(page).click();
  await confirmDialog(page).getByRole('button', { name: 'Send now' }).click();
  await expectVisible(page.locator('#nl-step-content').getByText('Section 2 (Image) needs a picture. Section 4 (Button) needs a link.'), 'API section messages on the Content step');
  await page.locator('#nl-step-content').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700); // counts are debounced
  await shot(page, '1280-04-blocks-422');
  await context.close();

  // The account has no email and the reply-to is empty: the API's 422 reply_to_email shows on step 3.
  ({ page, api, context } = await open({ width: 1280, height: 1900, api: createMockApi({ businessAddress: '4505 Steeles Ave W', ownerEmail: null }) }));
  await fillAll(page, { replyTo: null });
  await page.waitForTimeout(1200);
  expect(await page.locator('#nl-reply-to').inputValue() === '', 'no reply-to pre-filled (account has no email)');
  await sendButton(page).click();
  await confirmDialog(page).getByRole('button', { name: 'Send now' }).click();
  await expectVisible(page.locator('#nl-step-from').getByText('Add a reply-to email so people can answer you.'), 'reply_to_email 422 on the From step');
  expect(api.state.newsletters[0]?.status === 'draft', 'still a draft');
  await page.locator('#nl-step-from').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700); // counts are debounced
  await shot(page, '1280-05-reply-to-422');
  await page.locator('#nl-reply-to').fill('sales@serpachrysler.ca');
  await page.waitForTimeout(1200);
  expect(await page.locator('#nl-step-from').getByText('Add a reply-to email so people can answer you.').count() === 0, 'message clears once fixed and saved');
  await context.close();

  // Contract note 6, Studio side: an unfinished image section saves, but send names it first.
  ({ page, api, context } = await open({ width: 1280, height: 1900, api: createMockApi({ businessAddress: '4505 Steeles Ave W' }) }));
  await fillAll(page);
  const preview = page.locator('aside');
  await preview.getByRole('button', { name: 'Add a section after section 1' }).click();
  await page.getByRole('menuitem', { name: /^Image/ }).click();
  await page.waitForTimeout(1500);
  expect(api.state.newsletters[0]?.blocks?.[1]?.type === 'image', 'the unfinished image section was saved as a draft');
  await sendButton(page).click();
  await expectVisible(page.locator('#nl-step-content').getByText('Finish or remove the sections marked in red.'), 'Studio marks the unfinished section before calling send');
  await expectVisible(preview.getByText('Add an image, or remove this section.'), 'the section itself is marked');
  await context.close();

  // Schedule for later: the confirmation says when; the toast too.
  ({ page, api, context } = await open({ width: 1280, height: 1900, api: createMockApi({ businessAddress: '4505 Steeles Ave W' }) }));
  await fillAll(page);
  await page.getByRole('radio', { name: 'Schedule for later' }).check();
  await page.getByLabel('Date', { exact: true }).fill(tomorrow());
  await page.getByLabel('Time', { exact: true }).fill('09:30');
  await page.getByRole('button', { name: 'Schedule', exact: true }).last().click();
  const d3 = page.getByRole('dialog', { name: 'Schedule this newsletter?' });
  await expectVisible(d3.getByText(/It goes out .*9:30/), 'schedule confirmation names the time');
  await page.waitForTimeout(700); // counts are debounced
  await shot(page, '1280-06-schedule-confirm');
  await d3.getByRole('button', { name: 'Schedule' }).click();
  await expectVisible(page.getByText(/^Scheduled for /), 'scheduled toast');
  const sched = api.state.calls.find((c) => /\/schedule$/.test(c.path));
  expect(/Z$/.test(sched?.body?.scheduled_at ?? ''), `scheduled_at sent as UTC ISO (got ${sched?.body?.scheduled_at})`);
  await context.close();

  // Starter: the upgrade card, no newsletter calls; "Make a Storeel instead" switches tabs.
  for (const width of [1280, 390]) {
    const starter = await open({ width, height: 900, api: createMockApi({ plan: 'Starter' }) });
    await expectVisible(starter.page.getByText('Newsletters are part of paid plans'), `upgrade card at ${width}`);
    await starter.page.waitForTimeout(600);
    expect(!starter.api.state.calls.some((c) => c.path.startsWith('/newsletter') || c.path.startsWith('/contact-lists')), `no newsletter calls on Starter at ${width}`);
    expect(!(await hasOverflow(starter.page)), `no sideways scroll on the upgrade card at ${width}`);
    await shot(starter.page, `${width}-07-starter`);
    if (width === 1280) {
      await starter.page.getByRole('button', { name: 'Make a Storeel instead' }).click();
      await expectVisible(starter.page.getByText('Create New Campaign'), 'Storeel form after the upgrade card');
    }
    await starter.context.close();
  }

  // Phones: the confirmation and the step errors fit.
  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 844 });
    const p = phone.page;
    await p.locator('#nl-name').fill('Phone send');
    await sendButton(p).click();
    await expectVisible(p.locator('#nl-step-subject').getByText('Add a subject line.'), `step errors at ${width}`);
    expect(!(await hasOverflow(p)), `no sideways scroll with step errors at ${width}`);
    if (width === 390) await shot(p, '390-01-problems');
    await p.locator('#nl-subject').fill('October deals');
    await p.locator('aside').getByRole('button', { name: 'Add a section at the top' }).click();
    await p.getByRole('menuitem', { name: /^Title/ }).click();
    await p.locator('aside').getByLabel('Title', { exact: true }).fill('This month');
    await sendButton(p).click();
    await expectVisible(confirmDialog(p), `confirmation at ${width}`);
    expect(!(await hasOverflow(p)), `no sideways scroll in the confirmation at ${width}`);
    if (width === 390) { await p.waitForTimeout(700); await shot(p, '390-02-confirm'); }
    await phone.context.close();
  }
}
