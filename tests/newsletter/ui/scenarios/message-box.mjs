// Chris, 31 Oct: the Message box is always there (not only with Text message ticked). Its text goes at the top of the
// email as the Message section (id nl-message), kept in step with the box and saved in the same PUT as sms_text; with
// Text message ticked it is the text too, and the SMS lines show. An older draft with a message gets the section when
// opened; a sent newsletter is never changed.
import { createMockApi, newsletter } from '../mock-api.mjs';

const ID = 'nl-message';
const draft = (over = {}) => newsletter(23, {
  name: 'October Newsletter 2026', subject: 'October deals are here', from_name: 'Royal Woodshop', reply_to_email: 'sales@royalwoodshop.ca',
  channels: ['email'], sms_text: '', blocks: [{ id: 'b1', type: 'title', data: { text: 'This month', size: 'large' } }], ...over,
});
const TEXT = 'Hey Team <b>hi</b> & more\nSee you';
const HTML = '<p>Hey Team &lt;b&gt;hi&lt;/b&gt; &amp; more<br>See you soon</p>';
const OLD = 'Hey Team, This is just a test of the newsletter.';
const SHOTS = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';

const putsSince = (api, from) => api.state.calls.slice(from).filter((c) => c.method === 'PUT' && /^\/newsletters\/23$/.test(c.path));
const blockOrder = (page) => page.locator('aside [data-block-id]').evaluateAll((els) => els.map((el) => el.getAttribute('data-block-id')));

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // 1. Email only: the box shows, the SMS-only lines don't, and there is no "Add this to the email too" any more.
  const api = createMockApi({ newsletters: [draft()] });
  const { page, context } = await open({ width: 1280, height: 1800, api, query: '&newsletterId=23' });
  const step = page.locator('#nl-step-recipients');
  const box = step.getByLabel('Message (optional)', { exact: true });
  await expectVisible(box, 'Message box shown with Email only');
  await expectVisible(step.getByText("A short note at the top of your email, above your sections. If Text message is ticked, it's also sent as the text."), 'hint');
  expect(((await box.getAttribute('aria-describedby')) ?? '').split(' ').includes('nl-message-hint'), 'the hint describes the box');
  await expectVisible(step.getByText('0 / 120'), 'counter shown with Email only');
  expect(await step.getByText('We add a link to the newsletter').count() === 0, 'no link line with Email only');
  expect(await step.getByText('People get:').count() === 0, 'no "People get:" with Email only');
  expect(await step.getByText(/Uses \d text message part/).count() === 0, 'no parts line with Email only');
  expect(await page.getByRole('button', { name: 'Add this to the email too' }).count() === 0, 'the old button is gone');
  expect((await blockOrder(page)).join(',') === 'b1', 'no Message section while the box is empty');

  await page.waitForTimeout(1200);
  const before = api.state.calls.length;
  await box.fill(TEXT);
  // Live: the preview shows it straight away, at the top, as plain text.
  await expectVisible(page.locator(`aside [data-block-id="${ID}"]`).getByText('Hey Team <b>hi</b> & more', { exact: false }), 'message shows in the preview straight away');
  let order = await blockOrder(page);
  expect(order[0] === ID && order[1] === 'b1' && order.length === 2, `Message section at the top (${order.join(',')})`);
  expect(await page.locator(`aside [data-block-id="${ID}"] b`).count() === 0, 'nothing in the message is read as HTML');
  await box.pressSequentially(' soon', { delay: 30 });
  await expectVisible(page.locator(`aside [data-block-id="${ID}"]`).getByText('See you soon'), 'preview follows each key');
  await page.waitForTimeout(1800);
  const puts = putsSince(api, before);
  const last = puts[puts.length - 1]?.body ?? {};
  expect(puts.length >= 1 && puts.length <= 3, `a few autosaves, no PUT storm (${puts.length})`);
  expect(puts.every((p) => !('sms_text' in p.body) || (Array.isArray(p.body.blocks) && p.body.blocks[0]?.id === ID)), 'every PUT with the message also carries the Message section');
  expect(last.sms_text === `${TEXT} soon`, `PUT sms_text (${JSON.stringify(last.sms_text)})`);
  expect(JSON.stringify(last.blocks?.[0]) === JSON.stringify({ id: ID, type: 'text', data: { html: HTML } }), `PUT first block is the escaped message (${JSON.stringify(last.blocks?.[0])})`);
  expect(last.blocks?.[1]?.id === 'b1' && last.blocks.length === 2, 'the other section is kept');
  const settled = api.state.calls.length;
  await page.waitForTimeout(1500);
  expect(putsSince(api, settled).length === 0, 'nothing more to save once saved (dirty check stable)');
  await shot(page, '1280-01-email-only-message');
  await page.screenshot({ path: `${SHOTS}/message-box-1280-01-viewport.png` });

  // Selecting the section says where to edit it, and it has no editable words of its own.
  await page.locator(`aside [data-block-id="${ID}"]`).click();
  await expectVisible(page.getByText('This is your Message — edit it in the Message box.'), 'note on the selected Message section');
  expect(await page.locator(`aside [data-block-id="${ID}"] [contenteditable="true"]`).count() === 0, 'Message section is not edited in the preview');
  await page.locator(`aside [data-block-id="${ID}"]`).getByRole('button', { name: 'Done' }).click();

  // Clearing the box takes it out of the email.
  const beforeClear = api.state.calls.length;
  await box.fill('');
  expect((await blockOrder(page)).join(',') === 'b1', 'cleared: the Message section goes');
  await page.waitForTimeout(1800);
  const clearPut = putsSince(api, beforeClear).pop()?.body ?? {};
  expect(clearPut.sms_text === null && JSON.stringify(clearPut.blocks?.map((b) => b.id)) === '["b1"]', `cleared PUT (${JSON.stringify(clearPut)})`);

  // Deleted from the email while the box has text: back only on the next box edit.
  await box.fill('Back again');
  await page.waitForTimeout(300);
  await page.locator(`aside [data-block-id="${ID}"]`).click();
  await page.getByRole('button', { name: 'Delete section' }).click();
  await page.waitForTimeout(1500);
  expect(!(await blockOrder(page)).includes(ID), 'deleted Message section stays gone without a box edit');
  await box.pressSequentially('!', { delay: 30 });
  order = await blockOrder(page);
  expect(order[0] === ID && order.filter((x) => x === ID).length === 1, `next box edit puts it back at the top, once (${order.join(',')})`);

  // Ticking Text message shows the SMS lines.
  await step.getByRole('checkbox', { name: /Text message/ }).check();
  await expectVisible(step.getByText('We add a link to the newsletter and "Reply STOP to opt out."'), 'link line with Text message');
  await expectVisible(step.getByText(/Uses 1 text message part per person/), 'parts line with Text message');
  await expectVisible(step.getByText('People get:'), '"People get:" with Text message');
  await shot(page, '1280-02-with-texts');
  await context.close();

  // 2. An older draft (Royal Woodshop's) with a message but no section: opening it adds the section once and saves it.
  const api2 = createMockApi({ newsletters: [draft({ sms_text: OLD })] });
  const old = await open({ width: 1280, height: 1800, api: api2, query: '&newsletterId=23' });
  await expectVisible(old.page.locator(`aside [data-block-id="${ID}"]`).getByText(OLD), 'older draft: message at the top on open');
  await old.page.waitForTimeout(1800);
  const oldPuts = putsSince(api2, 0);
  const savedOld = api2.state.newsletters[0];
  expect(oldPuts.length === 1, `one save on open (${oldPuts.length})`);
  expect(savedOld.blocks[0]?.id === ID && savedOld.blocks[0]?.data?.html === `<p>${OLD}</p>` && savedOld.blocks[1]?.id === 'b1', `older draft saved with the section first (${JSON.stringify(savedOld.blocks)})`);
  expect(savedOld.sms_text === OLD, 'its message is unchanged');
  await old.context.close();
  // Opened again: it is there already, nothing is added or saved.
  const again = await open({ width: 1280, height: 1800, api: api2, query: '&newsletterId=23' });
  await expectVisible(again.page.locator(`aside [data-block-id="${ID}"]`), 'opened again: still there');
  const n0 = api2.state.calls.length;
  await again.page.waitForTimeout(1800);
  expect(putsSince(api2, n0).length === 0, 'opened again: no save');
  expect((await blockOrder(again.page)).filter((x) => x === ID).length === 1, 'opened again: one Message section');
  await again.context.close();

  // 3. A sent newsletter with a message is never changed.
  const api3 = createMockApi({ newsletters: [draft({ status: 'sent', sms_text: OLD, sent_at: '2026-10-01T14:00:00Z' })] });
  const sent = await open({ width: 1280, height: 1800, api: api3, query: '&newsletterId=23' });
  await expectVisible(sent.page.getByLabel('Message (optional)', { exact: true }), 'sent: box shown');
  expect(await sent.page.getByLabel('Message (optional)', { exact: true }).isDisabled(), 'sent: box read-only');
  await sent.page.waitForTimeout(1800);
  expect(!(await blockOrder(sent.page)).includes(ID), 'sent: no Message section added');
  expect(putsSince(api3, 0).length === 0, 'sent: nothing saved');
  await sent.context.close();

  // 4. Phone width, Email only: the box and the message in the preview, nothing scrolls sideways.
  const api4 = createMockApi({ newsletters: [draft({ sms_text: OLD })] });
  const phone = await open({ width: 390, height: 844, api: api4, query: '&newsletterId=23' });
  const pbox = phone.page.locator('#nl-step-recipients').getByLabel('Message (optional)', { exact: true });
  await pbox.scrollIntoViewIfNeeded();
  await expectVisible(pbox, '390: box shown');
  expect(!(await hasOverflow(phone.page)), '390: no sideways scroll');
  await phone.page.waitForTimeout(300);
  await phone.page.screenshot({ path: `${SHOTS}/message-box-390-01-box-viewport.png` });
  const msg = phone.page.locator(`aside [data-block-id="${ID}"]`);
  await msg.scrollIntoViewIfNeeded();
  await expectVisible(msg.getByText(OLD), '390: message in the preview');
  await phone.page.waitForTimeout(300);
  await phone.page.screenshot({ path: `${SHOTS}/message-box-390-02-preview-viewport.png` });
  await shot(phone.page, '390-01-email-only');
  await phone.context.close();
}
