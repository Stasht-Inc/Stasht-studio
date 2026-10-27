// Review fixes for Studio follow-up batch 1: a failed save is retried by itself (back online) only after a lost
// connection or a server error.
import { createMockApi } from '../mock-api.mjs';

const puts = (api) => api.state.calls.filter((c) => c.method === 'PUT').length;

export async function run({ open, shot, expectVisible, expect }) {
  // A 404 (or any 4xx) is not tried again when the connection comes back.
  let { page, api, context } = await open({ width: 1280, height: 1200, api: createMockApi({ failPuts: 404 }) });
  await page.locator('#nl-subject').fill('Not found case');
  await page.waitForTimeout(1600);
  await expectVisible(page.getByText('Not saved'), 'Not saved after a 404');
  let before = puts(api);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(1200);
  expect(puts(api) === before, `no retry on online after a 404 (PUTs ${before} → ${puts(api)})`);
  await context.close();

  // A 500 is.
  ({ page, api, context } = await open({ width: 1280, height: 1200, api: createMockApi({ failPuts: 500 }) }));
  await page.locator('#nl-subject').fill('Server down case');
  await page.waitForTimeout(1600);
  await expectVisible(page.getByText('Not saved'), 'Not saved after a 500');
  before = puts(api);
  api.state.failPuts = 0;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(1500);
  expect(puts(api) > before, 'retried on online after a 500');
  expect(api.state.newsletters[0]?.subject === 'Server down case', 'saved once the server was back');
  await shot(page, '1280-01-retried');
  await context.close();
  // No signed-in user id (no shared key 0): covered by tests/newsletter/review-fixes-b1.test.mjs — the composer's plan
  // check needs a user id, so it can't be opened that way here.
}
