// Chris, 3 Nov 2026: the Message box has no 120-character limit (up to 2,000) and grows with its text (2 lines up to
// 10, then it scrolls). With Text message ticked the same text goes out as one long text: "Sent as N text messages
// (max 10)."; over 10 parts it says so in the API's words. Before the 3 Nov SQL widens the column the API still says
// 120, under the box.
import { createMockApi } from '../mock-api.mjs';

const para = 'Our November deals are here and the new arrivals are on the lot. Come in this week for a test drive. ';
const text = (n) => para.repeat(Math.ceil(n / para.length)).slice(0, n);

export async function run({ open, shot, expectVisible, expect }) {
  const api = createMockApi({ businessAddress: '4505 Steeles Ave W, Toronto, ON' });
  const { page, context } = await open({ width: 1280, height: 1500, api });
  const step = page.locator('#nl-step-recipients');
  const box = page.locator('#nl-sms-text');
  const preview = page.locator('aside');
  await page.locator('#nl-name').fill('Long message');

  // The empty box is 2 lines high.
  const height = () => box.evaluate((el) => el.getBoundingClientRect().height);
  const lineHeight = await box.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
  const emptyHeight = await height();
  expect(emptyHeight >= 2 * lineHeight && emptyHeight < 3 * lineHeight + 24, `2 lines when empty (${emptyHeight}px, line ${lineHeight}px)`);
  // A few lines: it grows to fit, no scrolling inside.
  await box.fill(text(160));
  const few = await height();
  expect(few > emptyHeight, `grows with the text (${emptyHeight}px -> ${few}px)`);
  expect(await box.evaluate((el) => el.scrollHeight <= el.clientHeight + 1), 'all of a few lines shows, no inner scroll');

  // More than 10 lines (1,200 characters): it stops at 10 and scrolls inside.
  await box.fill(text(1200));
  const tall = await height();
  expect(tall <= 10 * lineHeight + 24 && tall >= 10 * lineHeight, `stops at 10 lines (${tall}px)`);
  expect(await box.evaluate((el) => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === 'auto'), 'then scrolls inside');
  await shot(page, '1280-00-ten-lines-then-scroll');

  // 600 characters by email: no limit, no error; the whole text is the Message section and is saved.
  const long = text(600);
  await box.fill(long);
  await expectVisible(step.getByText('600 characters'), 'counter reads "600 characters" (no / 120)');
  expect(!(await step.getByRole('alert').count()) && !(await step.locator('.text-red-600').count()), 'no error for 600 characters');
  await expectVisible(preview.getByText(long.trim().slice(0, 60)), 'the Message section shows the text');
  await page.waitForTimeout(1500);
  expect(api.state.newsletters[0]?.sms_text === long.trim(), `saved whole (${api.state.newsletters[0]?.sms_text?.length} characters)`);
  await shot(page, '1280-01-600-email');

  // Text message ticked: one long text, "Sent as 5 text messages (max 10)." (16 + 600 + link + STOP line in GSM-7).
  await step.getByRole('checkbox', { name: /Text message/ }).check();
  await expectVisible(step.getByText('Sent as 5 text messages (max 10).').first(), '"Sent as 5 text messages (max 10)."');
  expect(!(await step.getByText(/too long|more than the 10 allowed/).count()), 'not blocked');
  await step.getByText('Sent as 5 text messages (max 10).').first().scrollIntoViewIfNeeded();
  await shot(page, '1280-02-600-sms');

  // More than 10 texts: said under the box, in the API's words.
  await box.fill(text(1600));
  await expectVisible(step.getByText('This text would go out as 12 text messages, more than the 10 allowed. Shorten it or remove emoji.'), 'over 10 parts: refused');
  await shot(page, '1280-03-over-10-texts');
  // By email only it is fine.
  await step.getByRole('checkbox', { name: /Text message/ }).uncheck();
  expect(!(await step.getByText(/too long|more than the 10 allowed/).count()), 'by email only: fine');
  // Over 2,000: the box says so.
  await box.fill(text(2001));
  await expectVisible(step.getByText('The message can be up to 2,000 characters.'), 'over 2,000');
  await shot(page, '1280-04-over-2000');
  await box.fill(text(1500));
  await page.waitForTimeout(1500);
  // Set as my default message takes a long text too.
  await step.getByRole('checkbox', { name: 'Set as my default message' }).check();
  await page.waitForTimeout(900);
  expect(api.state.brand.default_message === text(1500).trim(), 'a long default message is saved');
  await context.close();

  // An API whose column is still VARCHAR(120) (SQL not run yet): its message shows under the box; nothing breaks.
  const old = await open({ width: 1280, height: 1300, api: createMockApi({ messageLimit: 120 }) });
  await old.page.locator('#nl-name').fill('Before the SQL');
  await old.page.locator('#nl-sms-text').fill(text(300));
  await expectVisible(old.page.locator('#nl-step-recipients').getByText('The text message can be up to 120 characters (some symbols, like …, count as more than one).'), 'the old limit, said under the box');
  await shot(old.page, '1280-05-before-sql');
  await old.context.close();

  // Phones: the hint fits.
  const phone = await open({ width: 390, height: 900 });
  await phone.page.locator('#nl-sms-text').fill(text(400));
  await phone.page.locator('#nl-step-recipients').getByRole('checkbox', { name: /Text message/ }).check();
  await expectVisible(phone.page.getByText(/^Sent as \d text messages \(max 10\)\.$/), 'hint on a phone');
  await phone.page.getByText(/^Sent as \d text messages \(max 10\)\.$/).first().scrollIntoViewIfNeeded();
  await shot(phone.page, '390-01-hint');
  await phone.context.close();
}
