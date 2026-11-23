// Chris (11 Nov, point 3) put the Reply-to email on the footer e-card. Deepak, 23 Nov 2026: every newsletter now ends
// with the Fresha-style footer, which has no e-card, so no email shows in the footer at all — whether Reply-to is blank
// or typed — and the "in touch with …" line follows the From name. Checked at 1280 and 390.
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
    const footer = page.locator('[data-nl-footer]').last();
    await footer.scrollIntoViewIfNeeded();
    await expectVisible(footer.getByText('unsubscribe here'), `${width}: the footer`);
    expect(await page.locator('[data-testid="ecard-email"]').count() === 0, `${width}: no e-card`);
    expect(await footer.getByText(PROFILE_EMAIL).count() === 0, `${width}: no profile email in the footer`);

    await reply.scrollIntoViewIfNeeded();
    await reply.fill(REPLY);
    await page.locator('#nl-from-name').fill('Royal Wood News').catch(() => {});
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    expect(await footer.getByText(REPLY).count() === 0, `${width}: no Reply-to email in the footer`);
    await expectVisible(footer.getByText(/in touch with Royal Wood News\./), `${width}: the line follows the From name`);
    expect(!(await hasOverflow(page)), `${width}: no sideways scroll`);
    await footer.screenshot({ path: `${OUT}/replyto-ecard-${width}-footer.png` });
    console.log('shot', `${OUT}/replyto-ecard-${width}-footer.png`);
    await context.close();
  }
}
