// Chris (11 Nov, point 3): "when you change reply to emails. This should over ride the ebusiness card and change it
// at bottom also." Checked at 1280 and 390: the preview's e-card shows the profile email while Reply-to is blank,
// switches to the Reply-to email as it is typed, keeps the profile name when From name changes, and goes back to the
// profile email when Reply-to is cleared.
import { createMockApi, newsletter } from '../mock-api.mjs';

const OUT = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
const PROFILE_EMAIL = 'samantha@serpachrysler.ca';
const REPLY = 'info@royalwoodshop.com';

export async function run({ open, expectVisible, expect, hasOverflow }) {
  for (const width of [1280, 390]) {
    const seeded = newsletter(81, { reply_to_email: null });
    const { page, context } = await open({ width, height: width === 390 ? 844 : 1000, query: '&newsletterId=81', api: createMockApi({ newsletters: [seeded] }) });
    const reply = page.locator('#nl-reply-to');
    await expectVisible(reply, `${width}: Reply-to field`);
    const card = page.locator('[data-testid="ecard-email"]').last();
    await card.scrollIntoViewIfNeeded();
    expect((await card.textContent())?.trim() === PROFILE_EMAIL, `${width}: blank Reply-to → profile email on the card`);

    await reply.scrollIntoViewIfNeeded();
    await reply.fill(REPLY);
    await page.locator('#nl-from-name').fill('Royal Wood News').catch(() => {});
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    expect((await card.textContent())?.trim() === REPLY, `${width}: card shows the Reply-to email live`);
    expect(await page.getByText(PROFILE_EMAIL).count() === 0, `${width}: profile email no longer shown in the preview`);
    expect(await page.locator('footer').getByText('Samantha Smith', { exact: true }).count() >= 1, `${width}: card name stays the profile name`);
    expect(!(await hasOverflow(page)), `${width}: no sideways scroll`);
    await page.locator('footer').last().screenshot({ path: `${OUT}/replyto-ecard-${width}-card.png` });
    console.log('shot', `${OUT}/replyto-ecard-${width}-card.png`);

    await reply.fill('');
    await page.waitForTimeout(200);
    expect((await card.textContent())?.trim() === PROFILE_EMAIL, `${width}: cleared Reply-to → profile email again`);
    await context.close();
  }
}
