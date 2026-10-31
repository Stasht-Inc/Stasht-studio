// [wdy2xh2p3f] Text rules: live parts counter with the emoji warning, the 3-part limit, quiet hours checked in
// Studio and the API's own 422 scheduled_at shown on step 6, and the allowance counted in text message parts.
import { createMockApi, newsletter } from '../mock-api.mjs';

const TZ = 'America/Toronto';
const ready = (over = {}) => newsletter(23, {
  name: 'October Newsletter 2026', subject: 'October deals are here', from_name: 'Serpa Chrysler', reply_to_email: 'sales@serpachrysler.ca',
  channels: ['email', 'sms'], sms_text: 'October deals are here.', blocks: [{ id: 'b1', type: 'title', data: { text: 'This month', size: 'large' } }], ...over,
});

function tomorrow() {
  const t = new Date(Date.now() + 24 * 3600 * 1000);
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
  return p; // YYYY-MM-DD in Toronto
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const api = createMockApi({ newsletters: [ready()], businessAddress: '4505 Steeles Ave W, Toronto, ON' });
  const { page, context } = await open({ width: 1280, height: 1900, api, query: '&newsletterId=23', timezoneId: TZ });
  const step = page.locator('#nl-step-recipients');
  const box = step.getByLabel('Message (optional)', { exact: true });
  await expectVisible(step.getByText('Uses 1 text message part per person.'), 'one part');

  await box.fill('Sale 😀 this weekend only');
  await expectVisible(step.getByText('Uses 2 text message parts per person.'), 'emoji: two parts');
  await expectVisible(step.getByText(/Emoji and some special characters make each part hold 70 characters/), 'emoji warning');
  await shot(page, '1280-01-parts');

  await box.fill('ą'.repeat(110));
  await expectVisible(step.getByText(/^This text is too long once sent \(\d parts\)\. Shorten it or remove emoji\.$/), 'too long: the API words');
  await box.fill('October deals are here.');
  expect(!(await step.getByText(/Emoji and some special/).count()), 'no warning for plain text');

  // Quiet hours: Studio checks before asking the API.
  const schedule = page.locator('#nl-step-schedule');
  await schedule.getByText('Schedule for later').click();
  await expectVisible(schedule.getByText(/Texts go out only between 8am and 9pm\./), 'quiet hours note');
  await schedule.getByLabel('Date').fill(tomorrow());
  await schedule.getByLabel('Time').fill('22:00');
  await page.getByRole('button', { name: 'Schedule' }).last().click();
  await expectVisible(schedule.getByText('Texts can only go out between 8am and 9pm. Pick a time in that window.'), 'quiet hours on step 6');
  expect(!api.state.calls.some((c) => c.path.endsWith('/schedule')), 'nothing scheduled in quiet hours');
  await shot(page, '1280-02-quiet-hours');

  await schedule.getByLabel('Time').fill('10:00');
  await page.getByRole('button', { name: 'Schedule' }).last().click();
  const dialog = page.getByRole('dialog', { name: 'Schedule this newsletter?' });
  await expectVisible(dialog, 'confirm dialog');
  await expectVisible(dialog.getByText(/Your plan has 3,800 emails and 460 text message parts left this month/), 'allowance in text message parts');
  await shot(page, '1280-03-confirm');
  await context.close();

  // The API's own 422 scheduled_at (it decides; Studio only checks first) goes back to step 6.
  const QUIET = 'Texts can only go out between 8am and 9pm. Pick a time in that window.';
  const api2 = createMockApi({ newsletters: [ready()], businessAddress: '4505 Steeles Ave W', sendErrors: { scheduled_at: [QUIET] } });
  const second = await open({ width: 1280, height: 1900, api: api2, query: '&newsletterId=23', timezoneId: TZ });
  const s2 = second.page.locator('#nl-step-schedule');
  await s2.getByText('Schedule for later').click();
  await s2.getByLabel('Date').fill(tomorrow());
  await s2.getByLabel('Time').fill('10:00');
  await second.page.getByRole('button', { name: 'Schedule' }).last().click();
  await second.page.getByRole('dialog', { name: 'Schedule this newsletter?' }).getByRole('button', { name: 'Schedule' }).click();
  await expectVisible(s2.getByText(QUIET), 'server quiet-hours message on step 6');
  expect(!(await second.page.getByRole('dialog', { name: 'Schedule this newsletter?' }).count()), 'confirm dialog closed');
  await s2.getByLabel('Time').fill('11:00');
  expect(!(await s2.getByText(QUIET).count()), 'the refused time message goes once another time is picked');
  // The API's sms_text parts error shows under the text box.
  await second.context.close();

  const api3 = createMockApi({ newsletters: [ready({ from_name: null })], businessAddress: '4505 Steeles Ave W', sendErrors: { sms_text: ['This text is too long once sent (4 parts). Shorten it or remove emoji.'] } });
  const third = await open({ width: 1280, height: 1900, api: api3, query: '&newsletterId=23', timezoneId: TZ });
  await third.page.getByRole('button', { name: 'Send now' }).last().click();
  await third.page.getByRole('dialog', { name: 'Send this newsletter now?' }).getByRole('button', { name: 'Send Now' }).click();
  await expectVisible(third.page.locator('#nl-step-recipients').getByText('This text is too long once sent (4 parts). Shorten it or remove emoji.'), 'server parts error under the text');
  await third.context.close();

  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 844, api: createMockApi({ newsletters: [ready({ sms_text: 'Sale 😀 this weekend only' })] }), query: '&newsletterId=23', timezoneId: TZ });
    const s = phone.page.locator('#nl-step-recipients');
    await expectVisible(s.getByText(/Emoji and some special/), `warning at ${width}`);
    await s.getByLabel('Message (optional)', { exact: true }).scrollIntoViewIfNeeded();
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width}`);
    if (width === 390) await shot(phone.page, '390-01-parts');
    await phone.context.close();
  }
}
