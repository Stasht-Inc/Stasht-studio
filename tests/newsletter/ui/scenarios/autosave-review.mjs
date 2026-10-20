// Review fixes for Tasks 1–3: the mock PUT now validates like the API (name required when sent, reply-to must
// be an email, https links). A blank name never reaches the API; the server's defaults show after create; a
// half-typed reply-to stays out of the save; closing with unsaved changes asks; Escape closes; focus stays in.
import { createMockApi } from '../mock-api.mjs';

const MONTH_NAME = `${new Date().toLocaleString('en-US', { month: 'long' })} Newsletter ${new Date().getFullYear()}`;
const COMPOSER = '[role="dialog"][aria-labelledby="nl-composer-title"]';

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  let { page, api, context } = await open({ width: 1280, height: 1700 });
  const rejected = () => api.state.calls.filter((c) => c.method === 'PUT' && c.status === 422);

  // 1. Subject first, no name: one draft, the server's defaults appear, nothing 422s.
  await page.locator('#nl-subject').fill('October deals are here');
  await page.waitForTimeout(1600);
  expect(api.state.calls.filter((c) => c.method === 'POST' && c.path === '/newsletters').length === 1, 'one draft created');
  expect(rejected().length === 0, `no PUT rejected (got ${JSON.stringify(rejected().map((c) => c.body))})`);
  expect(!api.state.calls.some((c) => c.method === 'PUT' && c.body && 'name' in c.body && !c.body.name), 'a blank name is never sent');
  expect(await page.locator('#nl-name').inputValue() === MONTH_NAME, `server default name shown (got "${await page.locator('#nl-name').inputValue()}")`);
  expect(await page.locator('#nl-from-name').inputValue() === 'Samantha Smith', 'server from name shown');
  expect(await page.locator('#nl-reply-to').inputValue() === 'samantha@serpachrysler.ca', 'server reply-to shown');
  const saved = api.state.newsletters[0];
  expect(saved?.subject === 'October deals are here', 'subject saved');
  expect(saved?.from_name === 'Samantha Smith' && saved?.reply_to_email === 'samantha@serpachrysler.ca', `defaults not wiped (got ${saved?.from_name} / ${saved?.reply_to_email})`);
  expect(JSON.stringify(saved?.audience) === JSON.stringify([{ type: 'all_leads' }]), `All leads saved (got ${JSON.stringify(saved?.audience)})`);

  // 2. A half-typed reply-to stays out of the save; the rest still saves.
  await page.locator('#nl-reply-to').fill('sales@');
  await page.locator('#nl-subject').fill('October deals are here!');
  await page.waitForTimeout(1600);
  expect(rejected().length === 0, 'still no PUT rejected');
  expect(api.state.newsletters[0]?.subject === 'October deals are here!', 'subject saved next to a half-typed reply-to');
  expect(api.state.newsletters[0]?.reply_to_email === 'samantha@serpachrysler.ca', 'half-typed reply-to not sent');
  await expectVisible(page.getByText('Enter an email address like sales@yourbusiness.com.'), 'reply-to problem shown');

  // 3. Cancel with an unsaved field asks; Keep editing stays.
  await page.getByRole('button', { name: 'Cancel' }).first().click();
  const unsaved = page.getByRole('dialog', { name: "Your latest changes aren't saved" });
  await expectVisible(unsaved, 'unsaved-changes dialog');
  await shot(page, '01-unsaved');
  await unsaved.getByRole('button', { name: 'Keep editing' }).click();
  expect(await unsaved.count() === 0, 'dialog closed');
  await expectVisible(page.getByRole('heading', { name: 'Campaign name' }), 'still editing');

  // 4. Fixed: it saves; Escape inside a popover closes only the popover; Escape then closes like Cancel.
  await page.locator('#nl-reply-to').fill('sales@serpachrysler.ca');
  await page.waitForTimeout(1600);
  expect(api.state.newsletters[0]?.reply_to_email === 'sales@serpachrysler.ca', 'fixed reply-to saved');
  await page.locator('aside').getByRole('button', { name: 'Add a section at the top' }).click();
  await expectVisible(page.getByRole('menuitem', { name: /^Title/ }), 'add-section menu open');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(await page.getByRole('menuitem', { name: /^Title/ }).count() === 0, 'Escape closed the menu');
  expect(await page.locator(COMPOSER).isVisible(), 'composer still open after the menu closed');

  // Focus stays inside the composer.
  for (let i = 0; i < 70; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate((sel) => document.querySelector(sel)?.contains(document.activeElement), COMPOSER), 'Tab keeps focus inside the composer');

  // aria-describedby only names ids that exist.
  const dangling = await page.evaluate((sel) => [...document.querySelectorAll(`${sel} [aria-describedby]`)]
    .flatMap((el) => el.getAttribute('aria-describedby').split(/\s+/).filter((id) => !document.getElementById(id)).map((id) => `${el.id || el.tagName}→${id}`)), COMPOSER);
  expect(dangling.length === 0, `aria-describedby points at missing ids: ${dangling.join(', ')}`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  expect(await page.locator(COMPOSER).count() === 0, 'Escape closed the composer');
  await context.close();

  // 5. Switching tabs never drops focus to <body>. The Storeel form keeps its own title focus (unchanged);
  // coming back, focus is on the checked Newsletter radio.
  ({ page, api, context } = await open({ width: 1280, height: 1000 }));
  await page.getByRole('radio', { name: 'Storeel' }).click();
  await expectVisible(page.getByText('Create New Campaign'), 'Storeel form');
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => document.activeElement !== document.body && document.activeElement?.closest('[role="dialog"], .fixed') !== null), 'focus inside the Storeel form');
  await page.getByRole('radio', { name: 'Newsletter' }).click();
  await expectVisible(page.getByRole('heading', { name: 'Campaign name' }), 'back on Newsletter');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.activeElement?.textContent === 'Newsletter' && document.activeElement?.getAttribute('aria-checked') === 'true'), 'focus on the checked Newsletter radio');
  await context.close();

  // 6. The server is down: Cancel offers Discard changes, which closes.
  ({ page, api, context } = await open({ width: 1280, height: 1000, api: createMockApi({ failPuts: 500 }) }));
  await page.locator('#nl-name').fill('Down day');
  await page.waitForTimeout(1600);
  await expectVisible(page.getByText('Not saved'), 'save indicator says Not saved');
  await page.getByRole('button', { name: 'Cancel' }).first().click();
  const down = page.getByRole('dialog', { name: "Your latest changes aren't saved" });
  await expectVisible(down, 'unsaved dialog when the server fails');
  await down.getByRole('button', { name: 'Discard changes' }).click();
  await page.waitForTimeout(300);
  expect(await page.locator(COMPOSER).count() === 0, 'Discard changes closed the composer');
  await context.close();

  // 7. Phones: the save state shows in the header, and nothing scrolls sideways.
  for (const width of [360, 390]) {
    const phone = await open({ width, height: 844 });
    await phone.page.locator('#nl-name').fill('Phone check');
    await expectVisible(phone.page.getByText('Saved', { exact: true }), `compact save indicator at ${width}`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width}`);
    if (width === 390) await shot(phone.page, '390-saved');
    await phone.context.close();
  }
}
