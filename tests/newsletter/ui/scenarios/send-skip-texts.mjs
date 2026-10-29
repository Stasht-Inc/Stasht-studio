// Chris, 29 Oct (round 2), item 6 (Deepak's decision): no text parts left no longer greys out Send Now with no
// reason. The emails go, the texts are skipped, and a note right at the button says so (with See plans), on the
// Send and the Schedule confirmations. Only texts and none can go: Send stays off, with the reason at the button.
// An older API that still refuses: its words show at the button.
import { createMockApi, newsletter, seedNewsletters } from '../mock-api.mjs';

const TZ = 'America/Toronto';
const NOTE = "310 text messages won't be sent: no text parts left this month. Emails will still go out.";
const NO_PARTS = { plan: 'Professional', email_limit: 5000, sms_limit: 500, email_used: 1200, sms_used: 500, email_pending: 0, sms_pending: 0, resets_at: '2026-11-01T04:00:00Z' };
const ready = (over = {}) => newsletter(23, {
  name: 'October Newsletter 2026', subject: 'October deals are here', from_name: 'Serpa Chrysler', reply_to_email: 'sales@serpachrysler.ca',
  channels: ['email', 'sms'], sms_text: 'October deals are here.', blocks: [{ id: 'b1', type: 'title', data: { text: 'This month', size: 'large' } }], ...over,
});
const tomorrow = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 24 * 3600 * 1000));

/** The note sits in the dialog's footer, next to the button (not in the scrolling body). */
async function noteAtButton(dialog, buttonName) {
  return dialog.evaluate((el, name) => {
    const note = el.querySelector('#nl-send-note');
    const button = [...el.querySelectorAll('button')].find((b) => b.textContent.trim() === name);
    if (!note || !button) return false;
    return note.parentElement === button.parentElement && button.getAttribute('aria-describedby') === 'nl-send-note';
  }, buttonName);
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // ---- 1. Email + texts, no text parts left: Send Now on, the note at the button, it sends.
  {
    const api = createMockApi({ newsletters: [ready()], businessAddress: '4505 Steeles Ave W, Toronto, ON', allowance: NO_PARTS });
    const { page, context } = await open({ width: 1280, height: 1200, api, query: '&newsletterId=23', timezoneId: TZ });
    await page.waitForTimeout(700); // counts are debounced
    await page.getByRole('button', { name: 'Send now' }).last().click();
    const dialog = page.getByRole('dialog', { name: 'Send this newsletter now?' });
    await expectVisible(dialog.getByText(NOTE, { exact: true }), 'the note says which texts won’t go and that emails will');
    const send = dialog.getByRole('button', { name: 'Send now' });
    expect(await send.isEnabled(), 'Send Now is on');
    expect(await noteAtButton(dialog, 'Send Now'), 'the note is right at the Send Now button (same footer row, aria-describedby)');
    await expectVisible(dialog.locator('#nl-send-note').getByRole('button', { name: 'See plans' }), 'See plans in the note');
    await shot(page, '1280-01-send-note');
    await send.click();
    await expectVisible(page.getByText(/^Sending now\./), 'sent');
    expect(api.state.calls.some((c) => c.method === 'POST' && /\/newsletters\/23\/send$/.test(c.path)), 'the send went to the API');
    await context.close();
  }

  // ---- 2. The Schedule confirmation says the same.
  {
    const api = createMockApi({ newsletters: [ready()], businessAddress: '4505 Steeles Ave W', allowance: NO_PARTS });
    const { page, context } = await open({ width: 1280, height: 1200, api, query: '&newsletterId=23', timezoneId: TZ });
    const schedule = page.locator('#nl-step-schedule');
    await schedule.getByText('Schedule for later').click();
    await schedule.getByLabel('Date').fill(tomorrow());
    await schedule.getByLabel('Time').fill('10:00');
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Schedule' }).last().click();
    const dialog = page.getByRole('dialog', { name: 'Schedule this newsletter?' });
    await expectVisible(dialog.getByText(NOTE, { exact: true }), 'note on the Schedule confirmation');
    expect(await dialog.getByRole('button', { name: 'Schedule' }).isEnabled(), 'Schedule is on');
    expect(await noteAtButton(dialog, 'Schedule'), 'the note is right at the Schedule button');
    await shot(page, '1280-02-schedule-note');
    await dialog.getByRole('button', { name: 'Schedule' }).click();
    await expectVisible(page.getByText(/^Scheduled for /), 'scheduled');
    await context.close();
  }

  // ---- 3. Only texts, none can go: Send stays off and says why at the button.
  {
    const api = createMockApi({ newsletters: [ready({ channels: ['sms'] })], businessAddress: '4505 Steeles Ave W', allowance: NO_PARTS });
    const { page, context } = await open({ width: 1280, height: 1200, api, query: '&newsletterId=23', timezoneId: TZ });
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Send now' }).last().click();
    const dialog = page.getByRole('dialog', { name: 'Send this newsletter now?' });
    const reason = 'This needs 310 text message parts, but your plan has 0 left this month.';
    await expectVisible(dialog.locator('#nl-send-note').getByText(reason, { exact: true }), 'the reason is at the button');
    expect(await dialog.getByRole('button', { name: 'Send now' }).isDisabled(), 'Send Now is off');
    expect(await noteAtButton(dialog, 'Send Now'), 'the reason sits with the button');
    expect(await dialog.locator('#nl-send-note').getAttribute('role') === 'alert', 'the reason is announced');
    await expectVisible(dialog.locator('#nl-send-note').getByRole('button', { name: 'See plans' }), 'See plans with the reason');
    await shot(page, '1280-03-texts-only-refused');
    await context.close();
  }

  // ---- 4. An API that still refuses texts it can't send: its words at the button, Send off.
  {
    const refusal = 'This newsletter needs 310 text message parts, but your plan has 0 left this month.';
    const api = createMockApi({ newsletters: [ready()], businessAddress: '4505 Steeles Ave W', allowance: NO_PARTS, sendErrors: { allowance: [refusal] } });
    const { page, context } = await open({ width: 1280, height: 1200, api, query: '&newsletterId=23', timezoneId: TZ });
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Send now' }).last().click();
    const dialog = page.getByRole('dialog', { name: 'Send this newsletter now?' });
    await expectVisible(dialog.getByText(NOTE, { exact: true }), 'note first');
    await dialog.getByRole('button', { name: 'Send now' }).click();
    await expectVisible(dialog.locator('#nl-send-note').getByText(refusal, { exact: true }), 'the API’s refusal at the button');
    expect(!(await dialog.getByText(NOTE, { exact: true }).count()), 'the skip note gives way to the refusal');
    expect(await dialog.getByRole('button', { name: 'Send now' }).isDisabled(), 'Send off after the refusal');
    await context.close();
  }

  // ---- 5. Results: a skipped text says why (the API's skip_note), on a computer and a phone.
  for (const width of [1280, 390]) {
    const api = createMockApi({ newsletters: seedNewsletters(), textSkips: true });
    const { page, context } = await open({ view: 'results', query: '&id=21', width, height: width === 1280 ? 1100 : 844, api });
    const drawer = page.getByRole('dialog', { name: 'September recap' });
    await expectVisible(drawer, `results at ${width}`);
    await drawer.getByRole('radio', { name: 'Text' }).click();
    await drawer.getByLabel('Status').selectOption('skipped');
    await expectVisible(drawer.locator('text="Not sent: no text parts left" >> visible=true'), `skip note on a skipped text at ${width}`);
    if (width === 390) expect(!(await hasOverflow(page)), 'no sideways scroll at 390 (results)');
    await page.waitForTimeout(500);
    await shot(page, `${width}-results-skip-note`);
    await context.close();
  }

  // ---- 6. Phones: the note fits next to the buttons.
  for (const width of [360, 375, 390]) {
    const api = createMockApi({ newsletters: [ready()], businessAddress: '4505 Steeles Ave W', allowance: NO_PARTS });
    const { page, context } = await open({ width, height: 844, api, query: '&newsletterId=23', timezoneId: TZ });
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Send now' }).last().click();
    const dialog = page.getByRole('dialog', { name: 'Send this newsletter now?' });
    await expectVisible(dialog.getByText(NOTE, { exact: true }), `note at ${width}`);
    expect(!(await hasOverflow(page)), `no sideways scroll at ${width}`);
    if (width === 390) await shot(page, '390-01-send-note');
    await context.close();
  }
}
