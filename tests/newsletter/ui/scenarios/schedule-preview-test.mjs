// Task 11: schedule for later (button says Schedule, Date + Time side by side as in the prototype), the server's
// exact email in a sandboxed iframe, and "Send a test to me" (including the API's 422 when there is no email).
import { createMockApi } from '../mock-api.mjs';

function tomorrow() {
  const t = new Date(Date.now() + 24 * 3600 * 1000);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  let { page, api, context } = await open({ width: 1280, height: 1900 });
  await page.locator('#nl-name').fill('Schedule check');
  await page.locator('#nl-subject').fill('Winter tires');

  await page.getByRole('radio', { name: 'Schedule for later' }).check();
  await page.getByLabel('Date', { exact: true }).fill(tomorrow());
  await page.getByLabel('Time', { exact: true }).fill('09:30');
  await expectVisible(page.getByText(/Times are in your time zone/), 'time zone hint');
  await expectVisible(page.getByRole('button', { name: 'Schedule', exact: true }).last(), 'the send button says Schedule');
  const dateBox = await page.locator('#nl-send-date').boundingBox();
  const timeBox = await page.locator('#nl-send-time').boundingBox();
  expect(dateBox && timeBox && Math.abs(dateBox.y - timeBox.y) < 2 && timeBox.x > dateBox.x, 'Date and Time side by side');
  await page.locator('#nl-step-schedule').scrollIntoViewIfNeeded();
  await shot(page, '1280-01-schedule');

  await page.getByRole('button', { name: 'Preview exact email' }).click();
  const frame = page.locator('iframe[title="Exact email preview"]');
  await expectVisible(frame, 'preview iframe');
  expect(await frame.getAttribute('sandbox') === '', 'iframe fully sandboxed');
  await expectVisible(page.frameLocator('iframe[title="Exact email preview"]').locator('#mock-preview-title'), 'server HTML shown in the iframe');
  expect(api.state.calls.some((c) => c.method === 'POST' && /\/preview$/.test(c.path)), 'preview asked for after saving');
  await shot(page, '1280-02-exact-preview');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  expect(await page.getByRole('heading', { name: 'Campaign name' }).isVisible(), 'Escape closed only the preview');

  await page.getByRole('button', { name: 'Send a test to me' }).click();
  await expectVisible(page.getByText('Test sent to samantha@serpachrysler.ca.'), 'test toast');
  expect(api.state.calls.some((c) => /\/test$/.test(c.path) && c.body?.channel === 'email'), 'test sent by email');

  // With Text on, the test button offers email or text.
  await page.locator('#nl-step-recipients').getByRole('checkbox', { name: /Text message/ }).check();
  await page.getByRole('button', { name: 'Send a test to me' }).click();
  await page.getByRole('menuitem', { name: 'Text me a test' }).click();
  await expectVisible(page.getByText('Write the text message first.').first(), 'API 422 sms_text shown');
  await context.close();

  // The account has no email: the API's 422 "channel" message is what the toast says.
  ({ page, api, context } = await open({ width: 1280, height: 1200, api: createMockApi({ ownerEmail: null }) }));
  await page.locator('#nl-name').fill('No email');
  await page.getByRole('button', { name: 'Send a test to me' }).click();
  await expectVisible(page.getByText('Add an email address to your profile to get a test email.'), 'no-email 422 toast');
  await context.close();

  // The hourly test limit (429): said plainly, and asked once (no automatic retries).
  ({ page, api, context } = await open({ width: 1280, height: 1200, api: createMockApi({ testsLeft: 0 }) }));
  await page.locator('#nl-name').fill('Too many tests');
  await page.getByRole('button', { name: 'Send a test to me' }).click();
  await expectVisible(page.getByText("You've sent the most test messages for this hour. Try again later."), 'hourly test limit toast');
  await page.waitForTimeout(1500);
  expect(api.state.calls.filter((c) => /\/test$/.test(c.path)).length === 1, 'the limited test was not retried');
  await context.close();

  // Phones.
  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 844 });
    const p = phone.page;
    await p.locator('#nl-name').fill('Phone schedule');
    const sched = p.locator('#nl-step-schedule');
    await sched.scrollIntoViewIfNeeded();
    await p.getByRole('radio', { name: 'Schedule for later' }).check();
    await p.getByLabel('Date', { exact: true }).fill(tomorrow());
    await p.getByLabel('Time', { exact: true }).fill('09:30');
    await p.getByRole('button', { name: 'Schedule', exact: true }).last().scrollIntoViewIfNeeded();
    expect(!(await hasOverflow(p)), `no sideways scroll on Schedule for later at ${width}`);
    if (width === 390) await shot(p, '390-01-schedule');
    await p.getByRole('button', { name: 'Preview exact email' }).click();
    await expectVisible(p.locator('iframe[title="Exact email preview"]'), `preview at ${width}`);
    expect(!(await hasOverflow(p)), `no sideways scroll in the preview at ${width}`);
    if (width === 390) await shot(p, '390-02-exact-preview');
    await phone.context.close();
  }
}
