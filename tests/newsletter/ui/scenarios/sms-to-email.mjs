// Chris, 30 Oct: the Text message box is the SMS only. Its label and hint say so, and "Add this to the email too"
// copies the text to the end of the email as a Text section (saved by autosave like any edit).
import { createMockApi, newsletter } from '../mock-api.mjs';

const draft = (over = {}) => newsletter(23, {
  name: 'October Newsletter 2026', subject: 'October deals are here', from_name: 'Serpa Chrysler', reply_to_email: 'sales@serpachrysler.ca',
  channels: ['email', 'sms'], sms_text: '', blocks: [{ id: 'b1', type: 'title', data: { text: 'This month', size: 'large' } }], ...over,
});
const TEXT = 'Sale <b>now</b> & more\nCall us today.';
const HTML = '<p>Sale &lt;b&gt;now&lt;/b&gt; &amp; more<br>Call us today.</p>';

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const api = createMockApi({ newsletters: [draft()] });
  const { page, context } = await open({ width: 1280, height: 1700, api, query: '&newsletterId=23' });
  const step = page.locator('#nl-step-recipients');
  const box = step.getByLabel('Text message (SMS only)', { exact: true });
  await expectVisible(box, 'label says SMS only');
  await expectVisible(step.getByText("Only sent as a text. It isn't added to the email."), 'hint under the label');
  const describedBy = await box.getAttribute('aria-describedby');
  expect((describedBy ?? '').split(' ').includes('nl-sms-only'), `the hint describes the box (${describedBy})`);
  await expectVisible(step.getByText('We add a link to the newsletter and "Reply STOP to opt out."'), 'existing link line kept');
  const add = step.getByRole('button', { name: 'Add this to the email too' });
  await expectVisible(add, 'Add this to the email too');
  expect(await add.isDisabled(), 'button off while the box is empty');
  await box.fill('   ');
  expect(await add.isDisabled(), 'button off for spaces only');

  await box.fill(TEXT);
  expect(!(await add.isDisabled()), 'button on once there is text');
  await shot(page, '1280-01-sms-box');
  await page.waitForTimeout(1500); // let the text's own autosave go first
  const before = api.state.calls.length;
  await add.click();
  await expectVisible(page.getByText('Added to the email as a Text section.'), 'toast');
  const preview = page.locator('aside');
  await expectVisible(preview.getByText('Sale <b>now</b> & more', { exact: false }), 'the text shows in the email preview, as plain text');
  expect(await preview.locator('b').count() === 0, 'nothing in the text is read as HTML');
  const order = await preview.locator('[data-block-id]').evaluateAll((els) => els.map((el) => el.getAttribute('data-block-id')));
  expect(order.length === 2 && order[0] === 'b1', `added at the end (${order.join(',')})`);
  await page.waitForTimeout(1800);
  const puts = api.state.calls.slice(before).filter((c) => c.method === 'PUT' && /^\/newsletters\/23$/.test(c.path) && c.body && Array.isArray(c.body.blocks));
  const last = puts[puts.length - 1]?.body.blocks ?? [];
  expect(puts.length >= 1, 'autosave PUT sends the sections');
  expect(last.length === 2 && last[0].id === 'b1', `PUT keeps the first section and adds one (${JSON.stringify(last)})`);
  expect(last[1]?.type === 'text' && last[1]?.data?.html === HTML, `PUT has the Text section with the escaped text (${JSON.stringify(last[1])})`);
  expect(await box.inputValue() === TEXT, 'the text message itself is unchanged');
  await shot(page, '1280-02-added');
  await context.close();

  // Phone width: the hint and the button fit, nothing scrolls sideways.
  const phone = await open({ width: 390, height: 844, api: createMockApi({ newsletters: [draft({ sms_text: 'October deals are here.' })] }), query: '&newsletterId=23' });
  const s = phone.page.locator('#nl-step-recipients');
  const phoneAdd = s.getByRole('button', { name: 'Add this to the email too' });
  await phoneAdd.scrollIntoViewIfNeeded();
  expect(!(await phoneAdd.isDisabled()), '390: button on with saved text');
  expect(!(await hasOverflow(phone.page)), '390: no sideways scroll');
  await phone.page.waitForTimeout(300);
  await phone.page.screenshot({ path: `${process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots'}/sms-to-email-390-01-sms-box-viewport.png` });
  await shot(phone.page, '390-01-sms-box');
  await phone.context.close();

  // A sent newsletter is read-only: the button stays off.
  const sent = await open({ width: 1280, height: 1700, api: createMockApi({ newsletters: [draft({ status: 'sent', sms_text: 'October deals are here.', sent_at: '2026-10-01T14:00:00Z' })] }), query: '&newsletterId=23' });
  const sentAdd = sent.page.locator('#nl-step-recipients').getByRole('button', { name: 'Add this to the email too' });
  await expectVisible(sentAdd, 'button shown on a sent newsletter');
  expect(await sentAdd.isDisabled(), 'button off when the newsletter is read-only');
  await sent.context.close();
}
