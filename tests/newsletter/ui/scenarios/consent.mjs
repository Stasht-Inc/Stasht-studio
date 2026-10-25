// [wdy2xh2p3e] The recipients step says who consent and phone-number rules leave out (audience-count skipped).
import { createMockApi } from '../mock-api.mjs';

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const api = createMockApi({ skipped: { consent_expired: 5, unsupported_number: 3 } });
  const { page, context } = await open({ width: 1280, height: 1400, api });
  const step = page.locator('#nl-step-recipients');
  await expectVisible(step.getByText('5 emails left out: their consent is older than 6 months.', { exact: false }), 'expired consent count (emails)');
  expect(!(await step.getByText(/can't get texts/).count()), 'phone-number line only once texts are on');
  await step.getByRole('checkbox', { name: /Text message/ }).check();
  await expectVisible(step.getByText(/3 phone numbers can't get texts \(only Canadian and US mobile numbers\)\./), 'unsupported numbers count');
  await expectVisible(step.getByText('5 emails or texts left out: their consent is older than 6 months.', { exact: false }), 'per-channel wording with both');
  await step.scrollIntoViewIfNeeded();
  await shot(page, '1280-01-skipped');
  await context.close();

  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 844, api: createMockApi({ skipped: { consent_expired: 5, unsupported_number: 3 } }) });
    const s = phone.page.locator('#nl-step-recipients');
    await s.getByRole('checkbox', { name: /Text message/ }).check();
    await expectVisible(s.getByText(/can't get texts/), `phone-number line at ${width}`);
    await s.scrollIntoViewIfNeeded();
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width}`);
    if (width === 390) await shot(phone.page, '390-01-skipped');
    await phone.context.close();
  }
}
