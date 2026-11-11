// Chris, 11 Nov 2026 (b), point 1: a new newsletter's "Send by" has Email ticked and Text message (SMS) not; both
// cards still show and ticking Text message sends both. A saved draft keeps the channels it stored.
// (The Storeel side — Text message ticked, Email not — is checked in tests/campaign-detail/ui/send-publishing.mjs.)
import { createMockApi, newsletter } from '../mock-api.mjs';

const emailBox = (step) => step.getByRole('checkbox', { name: 'Email', exact: true });
const smsBox = (step) => step.getByRole('checkbox', { name: 'Text message (SMS)', exact: true });

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const [width, height] of [[1280, 1800], [390, 1600]]) {
    // New newsletter: Email only.
    const { page, context } = await open({ width, height, api: createMockApi() });
    const step = page.locator('#nl-step-recipients');
    await expectVisible(emailBox(step), `${width}: Email card shown`);
    await expectVisible(smsBox(step), `${width}: Text message card shown`);
    await page.waitForTimeout(800);
    expect(await emailBox(step).isChecked(), `${width}: new newsletter → Email ticked`);
    expect(!(await smsBox(step).isChecked()), `${width}: new newsletter → Text message not ticked`);
    expect(await step.getByLabel('Email address').count() > 0 && await step.getByLabel(/^Phone/).count() === 0, `${width}: Single person shows the email box only`);
    expect(!(await hasOverflow(page)), `${width}: no sideways scroll`);
    await step.scrollIntoViewIfNeeded();
    await shot(page, `${width}-new-email-only`);
    // Tick Text message: both.
    await smsBox(step).check();
    await page.waitForTimeout(400);
    expect(await emailBox(step).isChecked() && await smsBox(step).isChecked(), `${width}: ticking Text message sends both`);
    await shot(page, `${width}-both-ticked`);
    await context.close();

    // Saved draft with both: kept.
    const api = createMockApi({ newsletters: [newsletter(23, { name: 'Saved both', channels: ['email', 'sms'], blocks: [] })] });
    const saved = await open({ width, height, api, query: '&newsletterId=23' });
    const sstep = saved.page.locator('#nl-step-recipients');
    await expectVisible(smsBox(sstep), `${width}: saved draft Text message card shown`);
    await saved.page.waitForTimeout(800);
    expect(await emailBox(sstep).isChecked() && await smsBox(sstep).isChecked(), `${width}: saved draft keeps Email + Text message`);
    await saved.context.close();
  }
}
