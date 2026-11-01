// Batch 3 (Chris, 1 Nov): "Set as my default message" under the Message box, as the Storeel invite message has. Ticking
// saves the box's text as the account's default (PUT /newsletter-brand default_message); a new newsletter opens with
// it in the box and at the top of the email, and it goes with the first save (opening alone creates no draft).
// Editing it for one newsletter only unticks the box; unticking clears the default. An API that keeps nothing (SQL
// not run yet) is told apart: the box stays unticked and the composer says it wasn't saved.
import { createMockApi, newsletter } from '../mock-api.mjs';

const ID = 'nl-message';
const SHOTS = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
const DEFAULT = 'November deals are here. Come see us this weekend.';
const brandPuts = (api, from = 0) => api.state.calls.slice(from).filter((c) => c.method === 'PUT' && c.path === '/newsletter-brand');
const blockOrder = (page) => page.locator('aside [data-block-id]').evaluateAll((els) => els.map((el) => el.getAttribute('data-block-id')));
const draft = (over = {}) => newsletter(23, {
  name: 'October Newsletter 2026', subject: 'October deals are here', from_name: 'Royal Woodshop', reply_to_email: 'sales@royalwoodshop.ca',
  channels: ['email'], sms_text: '', blocks: [{ id: 'b1', type: 'title', data: { text: 'This month', size: 'large' } }], ...over,
});

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // 1. An existing draft: type a message, tick the box → saved as the default.
  const api = createMockApi({ newsletters: [draft()] });
  const { page, context } = await open({ width: 1280, height: 1800, api, query: '&newsletterId=23' });
  const step = page.locator('#nl-step-recipients');
  const box = step.getByLabel('Message (optional)', { exact: true });
  const tick = step.getByRole('checkbox', { name: 'Set as my default message' });
  await expectVisible(tick, 'checkbox under the Message box');
  await page.waitForTimeout(800);
  expect(await tick.isDisabled(), 'empty box: nothing to save as the default yet');
  expect(!(await tick.isChecked()), 'not ticked with no default');
  await box.fill(DEFAULT);
  expect(await tick.isEnabled(), 'with a message the box can be ticked');
  await shot(page, '1280-01-before-tick');
  const n0 = api.state.calls.length;
  await tick.check();
  await page.waitForTimeout(500);
  const put = brandPuts(api, n0);
  expect(put.length === 1 && put[0].body?.default_message === DEFAULT, `ticking PUTs the text (${JSON.stringify(put.map((p) => p.body))})`);
  expect(Object.keys(put[0]?.body ?? {}).join(',') === 'default_message', 'only the default message is sent (address and header untouched)');
  expect(api.state.brand.default_message === DEFAULT, 'saved on the account');
  expect(await tick.isChecked(), 'ticked once saved');
  expect(await box.isEnabled(), 'the box stays editable');
  await shot(page, '1280-02-ticked');
  await step.screenshot({ path: `${SHOTS}/default-message-1280-02-step.png` });

  // Editing the text for this newsletter only unticks it; the saved default stays.
  const n1 = api.state.calls.length;
  await box.pressSequentially(' Today only!', { delay: 20 });
  await page.waitForTimeout(300);
  expect(!(await tick.isChecked()), 'edited: no longer ticked');
  expect(brandPuts(api, n1).length === 0, 'editing never changes the saved default');
  expect(api.state.brand.default_message === DEFAULT, 'default kept');
  // Back to the saved words: ticked again by itself.
  await box.fill(DEFAULT);
  expect(await tick.isChecked(), 'same words as the default: ticked');
  await context.close();

  // 2. A new newsletter opens with the default in the box and at the top of the email. Opening creates nothing.
  const api2 = createMockApi({ defaultMessage: DEFAULT });
  const fresh = await open({ width: 1280, height: 1800, api: api2 });
  const step2 = fresh.page.locator('#nl-step-recipients');
  const box2 = step2.getByLabel('Message (optional)', { exact: true });
  const tick2 = step2.getByRole('checkbox', { name: 'Set as my default message' });
  await expectVisible(box2, 'new newsletter: box');
  await fresh.page.waitForTimeout(1500);
  expect((await box2.inputValue()) === DEFAULT, `new newsletter: box pre-filled (${JSON.stringify(await box2.inputValue())})`);
  expect(await tick2.isChecked(), 'new newsletter: ticked (it is the default)');
  await expectVisible(fresh.page.locator(`aside [data-block-id="${ID}"]`).getByText(DEFAULT), 'new newsletter: message at the top of the email');
  expect(api2.state.calls.every((c) => !(c.method === 'POST' && c.path === '/newsletters')), 'opening alone creates no draft');
  await shot(fresh.page, '1280-03-new-prefilled');
  // The first save carries it.
  await fresh.page.locator('#nl-name').fill('November Newsletter 2026');
  await fresh.page.waitForTimeout(1800);
  const saved = api2.state.newsletters[0];
  expect(saved?.sms_text === DEFAULT, `first save has the message (${JSON.stringify(saved?.sms_text)})`);
  expect(saved?.blocks?.[0]?.id === ID, `first save has the Message section (${JSON.stringify(saved?.blocks)})`);
  expect((await blockOrder(fresh.page)).filter((x) => x === ID).length === 1, 'one Message section');

  // Unticking clears the default; the words stay in this newsletter.
  const n2 = api2.state.calls.length;
  await tick2.uncheck();
  await fresh.page.waitForTimeout(500);
  const clear = brandPuts(api2, n2);
  expect(clear.length === 1 && clear[0].body?.default_message === null, `unticking PUTs null (${JSON.stringify(clear.map((p) => p.body))})`);
  expect(api2.state.brand.default_message === null, 'default cleared');
  expect((await box2.inputValue()) === DEFAULT, 'the words stay in this newsletter');
  await fresh.context.close();

  // 3. Someone who typed a message before the default arrived keeps their words (and an older draft is never filled).
  const api3 = createMockApi({ defaultMessage: DEFAULT, newsletters: [draft({ sms_text: '' })] });
  const older = await open({ width: 1280, height: 1800, api: api3, query: '&newsletterId=23' });
  await older.page.waitForTimeout(1500);
  const box3 = older.page.locator('#nl-step-recipients').getByLabel('Message (optional)', { exact: true });
  expect((await box3.inputValue()) === '', 'an existing draft with no message is not filled in');
  await older.context.close();

  // 4. An API that keeps nothing yet: unticked again, and the composer says so.
  const api4 = createMockApi({ newsletters: [draft({ sms_text: DEFAULT })], defaultMessageColumn: false });
  const noCol = await open({ width: 1280, height: 1800, api: api4, query: '&newsletterId=23' });
  const tick4 = noCol.page.locator('#nl-step-recipients').getByRole('checkbox', { name: 'Set as my default message' });
  await expectVisible(tick4, 'no column: checkbox');
  await noCol.page.waitForTimeout(800);
  await tick4.click();
  await expectVisible(noCol.page.getByText("Your default message couldn't be saved. Try again."), 'no column: says it was not saved');
  expect(!(await tick4.isChecked()), 'no column: stays unticked');
  await noCol.context.close();

  // 5. A sent newsletter: the checkbox can't be used.
  const api5 = createMockApi({ newsletters: [draft({ status: 'sent', sms_text: DEFAULT, sent_at: '2026-10-01T14:00:00Z' })] });
  const sent = await open({ width: 1280, height: 1800, api: api5, query: '&newsletterId=23' });
  const tick5 = sent.page.locator('#nl-step-recipients').getByRole('checkbox', { name: 'Set as my default message' });
  await expectVisible(tick5, 'sent: checkbox shown');
  expect(await tick5.isDisabled(), 'sent: disabled');
  await sent.context.close();

  // 6. Phone width: fits, nothing scrolls sideways.
  const api6 = createMockApi({ defaultMessage: DEFAULT });
  const phone = await open({ width: 390, height: 844, api: api6 });
  const tick6 = phone.page.locator('#nl-step-recipients').getByRole('checkbox', { name: 'Set as my default message' });
  await tick6.scrollIntoViewIfNeeded();
  await expectVisible(tick6, '390: checkbox');
  await phone.page.waitForTimeout(800);
  expect(await tick6.isChecked(), '390: ticked with the default pre-filled');
  expect(!(await hasOverflow(phone.page)), '390: no sideways scroll');
  await phone.page.screenshot({ path: `${SHOTS}/default-message-390-01-viewport.png` });
  await phone.context.close();
}
