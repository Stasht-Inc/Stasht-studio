// The plan check (/user/storage-overview) fails: the Newsletter tab says so with "Try again" instead of
// "Getting things ready…" forever, makes no newsletter calls, and works once the check answers.
import { createMockApi } from '../mock-api.mjs';

export async function run({ open, shot, expectVisible, expect }) {
  const { page, api, context } = await open({ api: createMockApi({ planFailures: 1 }), width: 1280, height: 900 });
  await expectVisible(page.getByText('We couldn’t check your plan.'), 'plan check failure message');
  const retry = page.getByRole('button', { name: 'Try again' });
  await expectVisible(retry, 'Try again button');
  expect(api.state.calls.every((c) => !/^\/(newsletter|contact-lists)/.test(c.path)), 'no newsletter calls while the plan is unknown');
  await shot(page, '01-plan-failed');
  await retry.click();
  await expectVisible(page.getByRole('heading', { name: 'Campaign name' }), 'composer shows after Try again');
  expect(await page.getByText('We couldn’t check your plan.').count() === 0, 'failure message gone');
  await context.close();
}
