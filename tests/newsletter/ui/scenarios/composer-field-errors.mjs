// Chris (7 Nov, points 9 and 9b): "Highlight should be on the subject line, not the card." (his screenshot: step 1 with a
// red card border and a pink "Add a subject line." banner at the top, the empty Subject line itself unmarked) and
// "Error messages always go at bottom not top of card." Checked at 1280 and 390: the card is never outlined in red, the
// field is (red border, aria-invalid) with its message right under it, Send scrolls to and focuses the first problem,
// and a problem that belongs to no field (Content: no sections) sits at the bottom of its card.
import { createMockApi, newsletter } from '../mock-api.mjs';

const OUT = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
const sendButton = (page) => page.getByRole('button', { name: 'Send now' }).last();

async function inViewport(page, locator) {
  const box = await locator.boundingBox();
  const vp = page.viewportSize();
  return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 0.5 && box.y + box.height <= vp.height + 0.5;
}

const css = (locator, prop) => locator.first().evaluate((el, p) => getComputedStyle(el)[p], prop);
const focusedId = (page) => page.evaluate(() => document.activeElement?.id ?? '');
const RED = 'rgb(252, 165, 165)'; // border-red-300

/** The message sits right under the field: within 12 px below its bottom edge, and nothing else in between. */
async function rightUnder(field, message) {
  const f = await field.boundingBox();
  const m = await message.boundingBox();
  return !!f && !!m && m.y >= f.y + f.height - 1 && m.y - (f.y + f.height) <= 12;
}

export async function run({ open, expectVisible, expect }) {
  for (const width of [1280, 390]) {
    const shot = async (locator, file) => {
      const path = `${OUT}/composer-field-errors-${width}-${file}.png`;
      await locator.screenshot({ path });
      console.log('shot', path);
    };
    // Chris's screenshot: a name, no subject, everything else fine.
    const seeded = newsletter(71, { name: 'November Newsletter 2026', subject: '', blocks: [{ id: 't1', type: 'title', data: { text: 'This month', size: 'large' } }] });
    let { page, context } = await open({ width, height: width === 390 ? 844 : 1000, query: '&newsletterId=71', api: createMockApi({ newsletters: [seeded] }) });
    await expectVisible(page.locator('#nl-name'), 'composer');
    await page.waitForTimeout(700); // counts are debounced
    await sendButton(page).click();
    const subject = page.locator('#nl-subject');
    const message = page.locator('#nl-subject-help');
    await expectVisible(message, `${width}: the subject's message`);
    expect((await message.textContent()) === 'Add a subject line.', `${width}: "Add a subject line." under the field`);
    expect(await subject.getAttribute('aria-invalid') === 'true', `${width}: Subject line marked aria-invalid`);
    expect(await css(subject, 'borderTopColor') !== await css(page.locator('#nl-name'), 'borderTopColor'), `${width}: Subject line has the red border (Name does not)`);
    const card = page.locator('#nl-step-name');
    expect(await css(card, 'borderTopColor') !== RED, `${width}: the card is not outlined in red`);
    expect(await card.locator('[data-nl-card-error]').count() === 0, `${width}: no banner on the card`);
    expect(await card.locator('[role="alert"]').count() === 1, `${width}: one message on step 1 (the field's)`);
    await page.waitForTimeout(800); // smooth scroll
    expect(await rightUnder(subject, message), `${width}: the message is directly under the Subject line`);
    expect(await focusedId(page) === 'nl-subject', `${width}: Send focused the Subject line (got ${await focusedId(page)})`);
    expect(await inViewport(page, subject), `${width}: the Subject line is in view`);
    await expectVisible(page.getByText('Fix what’s marked in red, then try again.'), 'toast says what to do');
    await shot(card, '01-subject');
    // Typing a subject clears it.
    await subject.fill('November at Serpa');
    expect(await subject.getAttribute('aria-invalid') === 'false', `${width}: fixed: no longer marked`);
    await context.close();

    // A new newsletter (its name is filled in for you) with nothing else: every field marks itself; Content's own
    // problem at the card's bottom.
    ({ page, context } = await open({ width, height: width === 390 ? 844 : 1000 }));
    await page.locator('#nl-subject').fill('');
    await page.locator('#nl-reply-to').fill('sales@');
    await expectVisible(page.locator('#nl-name[value="November Newsletter 2026"]'), 'the new draft has its name');
    await page.waitForTimeout(700); // the new draft is created and counted
    await sendButton(page).click();
    await page.waitForTimeout(800);
    expect(await focusedId(page) === 'nl-subject', `${width}: the first problem (Subject line) has focus (got ${await focusedId(page)})`);
    expect(await page.locator('#nl-name').getAttribute('aria-invalid') === 'false', `${width}: Name is fine, not marked`);
    expect((await page.locator('#nl-subject-help').textContent()) === 'Add a subject line.', `${width}: Subject's own message`);
    expect(await page.locator('#nl-reply-to').getAttribute('aria-invalid') === 'true', `${width}: Reply-to marked`);
    expect((await page.locator('#nl-reply-to-help').textContent()).startsWith('Enter an email address'), `${width}: Reply-to's message under it`);
    // Single person with nobody typed yet: the Email address box (the field to fill) is marked, not Send to.
    const recipients = page.locator('#nl-step-recipients');
    expect((await page.locator('#nl-person-email-error').textContent()) === 'Type their email address.', `${width}: the person's Email address box says what to type`);
    expect(await page.locator('#nl-person-email').getAttribute('aria-invalid') === 'true', `${width}: the Email address box is marked`);
    expect(await recipients.getByText('Choose who gets this newsletter.').count() === 0, `${width}: not said again under Send to`);
    expect(await css(recipients, 'borderTopColor') !== RED, `${width}: Recipients card not outlined`);
    const content = page.locator('#nl-step-content');
    const contentError = content.locator('[data-nl-card-error]');
    await expectVisible(contentError, `${width}: Content's own problem`);
    expect((await contentError.textContent()) === 'Add at least one section to the email.', `${width}: Content: no sections`);
    const body = await content.boundingBox();
    const err = await contentError.boundingBox();
    expect(!!body && !!err && body.y + body.height - (err.y + err.height) <= 24, `${width}: the card's problem is at the BOTTOM of the card`);
    expect(await css(content, 'borderTopColor') !== RED, `${width}: Content card not outlined`);
    await shot(page.locator('#nl-step-name'), '02-name-and-subject');
    await recipients.scrollIntoViewIfNeeded();
    await shot(recipients, '03-recipients');
    await page.locator('#nl-step-from').scrollIntoViewIfNeeded();
    await shot(page.locator('#nl-step-from'), '04-from');
    await content.scrollIntoViewIfNeeded();
    await shot(content, '05-content-bottom');

    // Schedule for later with no date: the Date field is marked and focused once the steps above are fine.
    await page.locator('#nl-name').fill('Field errors');
    await page.locator('#nl-subject').fill('Hello');
    await page.locator('#nl-reply-to').fill('sales@serpachrysler.ca');
    await page.getByRole('button', { name: /^Send to/ }).first().click().catch(() => {});
    await page.keyboard.press('Escape');
    const step = page.locator('#nl-step-schedule');
    await step.getByText('Schedule for later').click();
    const later = page.getByRole('button', { name: 'Schedule' }).last();
    await later.click();
    await page.waitForTimeout(800);
    const date = page.locator('#nl-send-date');
    expect(await date.getAttribute('aria-invalid') === 'true', `${width}: Date marked`);
    await expectVisible(step.getByText('Pick a date and a time.'), `${width}: the schedule message under the date and time`);
    expect(await step.locator('[data-nl-card-error]').count() === 0, `${width}: no banner on the Schedule card`);
    await step.scrollIntoViewIfNeeded();
    await shot(step, '06-schedule');
    await context.close();
  }
}
