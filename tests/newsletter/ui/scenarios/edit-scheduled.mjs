// [wdy2xh2p3m] Edit a scheduled newsletter (list menu and results drawer → unschedule → composer with the time kept),
// the 409 once sending started, the picked time kept on a draft (planned_send_at), and over the allowance: "See
// plans", and the API's next-month answer for a time after the reset.
import { createMockApi, newsletter, seedNewsletters } from '../mock-api.mjs';

const TZ = 'America/Toronto';
const day = 86400000;
const torontoDate = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const torontoTime = (ms) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));

async function toNewsletters(page) {
  await page.getByRole('radio', { name: 'Newsletters' }).click();
  await page.getByRole('heading', { name: 'Newsletters', exact: true }).waitFor();
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // 1. List menu → Edit: back to a draft, opened with Schedule for later and the same date and time.
  const seeded = seedNewsletters();
  const winter = seeded.find((n) => n.id === 22);
  const at = Date.now() + 2 * day;
  winter.scheduled_at = new Date(Math.floor(at / 60000) * 60000).toISOString();
  let api = createMockApi({ newsletters: seeded });
  let { page, context } = await open({ view: 'campaigns', width: 1280, height: 1000, api, timezoneId: TZ });
  await toNewsletters(page);
  await page.getByRole('button', { name: 'Actions for Winter tires', exact: true }).click();
  await shot(page, '1280-01-menu');
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await expectVisible(page.getByRole('heading', { name: 'Create Campaign' }), 'composer opened');
  expect(api.state.calls.some((c) => c.method === 'POST' && c.path === '/newsletters/22/unschedule'), 'unschedule called');
  expect(api.state.newsletters.find((n) => n.id === 22)?.status === 'draft', 'now a draft');
  const schedule = page.locator('#nl-step-schedule');
  await expectVisible(schedule.getByRole('radio', { name: 'Schedule for later', checked: true }), 'Schedule for later restored');
  expect(await schedule.getByLabel('Date').inputValue() === torontoDate(Date.parse(winter.scheduled_at ?? '') || Date.parse(api.state.newsletters.find((n) => n.id === 22).planned_send_at)), 'date restored');
  expect(await schedule.getByLabel('Time').inputValue() === torontoTime(Date.parse(api.state.newsletters.find((n) => n.id === 22).planned_send_at)), 'time restored');
  await schedule.scrollIntoViewIfNeeded();
  await shot(page, '1280-02-restored');

  // 2. A new time is kept on the draft (planned_send_at) and comes back when it is opened again.
  await schedule.getByLabel('Time').fill('11:15');
  await page.waitForTimeout(1500);
  const put = [...api.state.calls].reverse().find((c) => c.method === 'PUT' && c.body && 'planned_send_at' in c.body);
  expect(put && torontoTime(Date.parse(put.body.planned_send_at)) === '11:15', `PUT planned_send_at (got ${JSON.stringify(put?.body)})`);
  await page.getByRole('button', { name: 'Cancel' }).first().click();
  await expectVisible(page.getByRole('heading', { name: 'Newsletters', exact: true }), 'back on the list');
  await page.getByRole('button', { name: /^Winter tires/ }).first().click();
  await expectVisible(page.getByRole('heading', { name: 'Create Campaign' }), 'draft opened again');
  await expectVisible(page.locator('#nl-step-schedule').getByRole('radio', { name: 'Schedule for later', checked: true }), 'still Schedule for later');
  expect(await page.locator('#nl-step-schedule').getByLabel('Time').inputValue() === '11:15', 'the new time came back');
  // Send now clears it.
  await page.locator('#nl-step-schedule').getByText('Send now').click();
  await page.waitForTimeout(1500);
  expect(api.state.newsletters.find((n) => n.id === 22)?.planned_send_at === null, 'Send now: planned_send_at null');
  await context.close();

  // 3. Sending already started: the API's 409 words, nothing opens.
  api = createMockApi({ newsletters: seedNewsletters(), unscheduleStarted: true });
  ({ page, context } = await open({ view: 'campaigns', width: 1280, height: 1000, api, timezoneId: TZ }));
  await toNewsletters(page);
  await page.getByRole('button', { name: 'Actions for Winter tires', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await expectVisible(page.getByText('This newsletter has started sending, so it can no longer be edited. Duplicate it to make changes.'), '409 message');
  expect(!(await page.getByRole('heading', { name: 'Create Campaign' }).count()), 'composer not opened');
  await context.close();

  // 4. Results drawer → Edit.
  api = createMockApi({ newsletters: seedNewsletters() });
  ({ page, context } = await open({ view: 'campaigns', width: 1280, height: 1000, api, timezoneId: TZ }));
  await toNewsletters(page);
  await page.getByRole('button', { name: /^Winter tires/ }).first().click();
  const drawer = page.getByRole('dialog', { name: 'Winter tires' });
  await expectVisible(drawer.getByRole('button', { name: 'Edit', exact: true }), 'Edit in the drawer');
  await page.waitForTimeout(700); // the drawer slides in
  await shot(page, '1280-03-drawer');
  await drawer.getByRole('button', { name: 'Edit', exact: true }).click();
  await expectVisible(page.getByRole('heading', { name: 'Create Campaign' }), 'composer from the drawer');
  expect(api.state.newsletters.find((n) => n.id === 22)?.status === 'draft', 'drawer Edit unscheduled it');
  await context.close();

  // 5. Over the allowance: See plans closes the composer, then asks for the plans.
  // A fresh copy each time: the mock keeps (and changes) the object it is given.
  const ready = () => newsletter(23, { name: 'October Newsletter 2026', subject: 'Deals', from_name: 'Serpa Chrysler', blocks: [{ id: 'b1', type: 'title', data: { text: 'Hi', size: 'large' } }] });
  api = createMockApi({ newsletters: [ready()], businessAddress: '4505 Steeles Ave W', allowance: { plan: 'Teams', email_limit: 1000, sms_limit: 0, email_used: 900, sms_used: 0, email_pending: 0, sms_pending: 0, resets_at: new Date(Date.now() + day).toISOString().slice(0, 10) + 'T04:00:00Z' } });
  ({ page, context } = await open({ width: 1280, height: 1400, api, query: '&newsletterId=23', timezoneId: TZ }));
  await page.evaluate(() => { window.__upgrades = []; window.addEventListener('stasht-upgrade-required', (e) => window.__upgrades.push(e.detail?.message ?? '')); });
  await page.getByRole('button', { name: 'Send now' }).last().click();
  let dialog = page.getByRole('dialog', { name: 'Send this newsletter now?' });
  await expectVisible(dialog.getByText('This needs 1,180 emails, but your plan has 100 left this month.'), 'over the allowance');
  await expectVisible(dialog.getByRole('button', { name: 'See plans' }), 'See plans');
  await shot(page, '1280-04-over-limit');
  await dialog.getByRole('button', { name: 'See plans' }).click();
  await page.waitForTimeout(800);
  expect(!(await page.getByRole('heading', { name: 'Create Campaign' }).isVisible().catch(() => false)), 'composer closed');
  expect((await page.evaluate(() => window.__upgrades.length)) === 1, 'plans asked for once');
  await context.close();

  // 6. After the reset: Studio doesn't judge it against this month; the API's next-month answer is shown.
  const nextMonthMsg = 'This newsletter needs 1,180 emails, but your plan has 100 left in November.';
  api = createMockApi({ newsletters: [ready()], businessAddress: '4505 Steeles Ave W', sendErrors: { allowance: [nextMonthMsg] },
    allowance: { plan: 'Teams', email_limit: 1000, sms_limit: 0, email_used: 900, sms_used: 0, email_pending: 0, sms_pending: 0, resets_at: new Date(Date.now() + day).toISOString().slice(0, 10) + 'T04:00:00Z' } });
  ({ page, context } = await open({ width: 1280, height: 1400, api, query: '&newsletterId=23', timezoneId: TZ }));
  const s6 = page.locator('#nl-step-schedule');
  await s6.getByText('Schedule for later').click();
  await s6.getByLabel('Date').fill(torontoDate(Date.now() + 3 * day));
  await s6.getByLabel('Time').fill('10:00');
  await page.getByRole('button', { name: 'Schedule' }).last().click();
  dialog = page.getByRole('dialog', { name: 'Schedule this newsletter?' });
  await expectVisible(dialog.getByText(/It goes out after your plan resets on .*, so it uses next month’s allowance\./), 'next-month line');
  expect(!(await dialog.getByText(/left this month/).count()), 'not judged against this month');
  await dialog.getByRole('button', { name: 'Schedule' }).click();
  await expectVisible(dialog.getByText(nextMonthMsg), 'the API next-month message');
  await expectVisible(dialog.getByRole('button', { name: 'See plans' }), 'See plans with the API message');
  await shot(page, '1280-05-next-month');
  await context.close();

  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 844, api: createMockApi({ newsletters: [ready()], businessAddress: '4505 Steeles Ave W', allowance: { plan: 'Teams', email_limit: 1000, sms_limit: 0, email_used: 900, sms_used: 0, resets_at: '2026-11-01T04:00:00Z' } }), query: '&newsletterId=23', timezoneId: TZ });
    await phone.page.getByRole('button', { name: 'Send now' }).last().click();
    const d = phone.page.getByRole('dialog', { name: 'Send this newsletter now?' });
    await expectVisible(d.getByRole('button', { name: 'See plans' }), `See plans at ${width}`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll in the confirm at ${width}`);
    if (width === 390) await shot(phone.page, '390-01-over-limit');
    await phone.context.close();
    const list = await open({ view: 'campaigns', width, height: 844, api: createMockApi({ newsletters: seedNewsletters() }), timezoneId: TZ });
    await toNewsletters(list.page);
    await list.page.getByRole('button', { name: /^Winter tires/ }).first().click();
    const dr = list.page.getByRole('dialog', { name: 'Winter tires' });
    await expectVisible(dr.getByRole('button', { name: 'Edit', exact: true }), `drawer Edit at ${width}`);
    expect(!(await hasOverflow(list.page)), `no sideways scroll in the drawer at ${width}`);
    await list.page.waitForTimeout(700);
    expect(!(await hasOverflow(list.page)), `no sideways scroll in the open drawer at ${width}`);
    if (width === 390) await shot(list.page, '390-02-drawer');
    await list.context.close();
  }
}
