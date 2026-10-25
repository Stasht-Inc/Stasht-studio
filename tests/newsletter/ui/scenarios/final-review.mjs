// Final review of the Studio follow-ups: kept drafts survive an involuntary sign-out (401); consent dates read in
// the browser (day/month asked when the column can't tell, unreadable ones counted); Manage lists keyboard and
// focus; a list deleted elsewhere reloads; the parts line is announced only when the count changes.
import { mkdirSync, writeFileSync } from 'fs';
import { createMockApi } from '../mock-api.mjs';

const DIR = '/private/tmp/claude-501/newsletters-ui';
const CSV = `${DIR}/consent-dates.csv`;
const backupKeys = (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('stasht_nl_backup:')));

async function openImport(page) {
  const step = page.locator('#nl-step-recipients');
  await step.getByRole('button', { name: /Send to/ }).click();
  await page.getByRole('button', { name: 'Add a list' }).click();
  return page.getByRole('dialog', { name: 'Add a list' });
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // 1. A 401 signs the person out by itself: the copy kept in this browser stays for when they sign back in.
  let { page, api, context } = await open({ width: 1280, height: 1200 });
  // apiRequest sends the page to /login after a 401: a blank stand-in (the whole app isn't under test here).
  await page.route('**/login', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><p>Log in</p>' }));
  await page.locator('#nl-subject').fill('Saved before the sign-out');
  await page.waitForTimeout(1600);
  api.state.failPuts = 401;
  await page.locator('#nl-subject').fill('Typed as the session ran out');
  await page.waitForTimeout(2500);
  expect(new URL(page.url()).pathname === '/login', 'signed out by the 401');
  const keys = await backupKeys(page).catch(() => []);
  expect(keys.length > 0, `the kept copy survives a 401 (keys ${JSON.stringify(keys)})`);
  await context.close();

  // 2. Consent dates: 01/06/2026 could be either, so Import asks; unreadable dates are counted.
  mkdirSync(DIR, { recursive: true });
  writeFileSync(CSV, 'Name,Email,Signed up\nAva,ava@example.com,01/06/2026\nBen,ben@example.com,03/04/2026\nCy,cy@example.com,someday\n');
  ({ page, api, context } = await open({ width: 1280, height: 1200 }));
  const dialog = await openImport(page);
  await dialog.getByTestId('nl-csv-input').setInputFiles(CSV);
  await expectVisible(dialog.getByText('Are dates day/month or month/day?'), 'asks for the date order');
  await dialog.getByRole('radio', { name: /signed up or asked to hear from us/ }).check();
  await dialog.getByRole('button', { name: /^Import 3 contacts/ }).click();
  await expectVisible(dialog.getByText('Choose whether the dates are day/month or month/day.'), 'date order needed on Import');
  await dialog.getByRole('radio', { name: /Month\/day/ }).check();
  await expectVisible(dialog.getByText('1 date couldn’t be read — we’ll use today’s date.'), 'unreadable date counted');
  await shot(page, '1280-01-date-order');
  await dialog.getByRole('button', { name: /^Import 3 contacts/ }).click();
  await expectVisible(page.getByText('Imported 3 contacts.'), 'imported');
  const call = api.state.calls.find((c) => c.path === '/contact-lists/import');
  expect(JSON.stringify(call?.body?.rows?.map((r) => r.consent_at ?? null)) === JSON.stringify(['2026-01-06', '2026-03-04', null]), `ISO dates sent (got ${JSON.stringify(call?.body?.rows)})`);
  await context.close();

  // 3. Manage lists: focus moves to "Yes, delete it" and, after the row goes, to the next row; Escape in the rename
  // box cancels only the rename; a list deleted elsewhere (404) reloads the lists.
  const lists = [
    { id: 9, name: 'Open house sign-ups', source: 'import', member_count: 212, email_count: 198, sms_count: 140, consent_type: 'express', created_at: '2026-10-02T15:00:00Z' },
    { id: 11, name: 'Spring buyers', source: 'leads', member_count: 30, email_count: 30, sms_count: 12, consent_type: 'implied', created_at: '2026-09-20T15:00:00Z' },
    { id: 12, name: 'Winter tire customers', source: 'import', member_count: 10, email_count: 10, sms_count: 0, consent_type: null, created_at: '2026-08-01T15:00:00Z' },
  ];
  ({ page, api, context } = await open({ width: 1280, height: 1100, api: createMockApi({ lists }) }));
  await page.locator('#nl-step-recipients').getByRole('button', { name: 'Manage lists' }).click();
  const manage = page.getByRole('dialog', { name: 'Manage lists' });
  const row = (name) => manage.getByRole('listitem').filter({ hasText: name });
  await row('Open house sign-ups').getByRole('button', { name: 'Rename' }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(await manage.isVisible(), 'Escape in the rename box keeps the dialog open');
  expect(!(await manage.getByLabel('New name for Open house sign-ups').count()), 'the rename is cancelled');
  expect(await page.evaluate(() => document.activeElement?.textContent) === 'Rename', 'focus back on Rename');

  await row('Spring buyers').getByRole('button', { name: 'Delete' }).click();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => document.activeElement?.textContent) === 'Yes, delete it', 'focus on "Yes, delete it"');
  await page.keyboard.press('Enter');
  await expectVisible(page.getByText('Deleted the list "Spring buyers".'), 'deleted');
  await page.waitForTimeout(150);
  const focused = await page.evaluate(() => ({ text: document.activeElement?.textContent, row: document.activeElement?.closest('[data-list-id]')?.getAttribute('data-list-id') }));
  expect(focused.text === 'View people' && focused.row === '12', `focus moves to the next list (got ${JSON.stringify(focused)})`);

  api.state.lists = api.state.lists.filter((l) => l.id !== 9); // deleted in another tab
  await row('Open house sign-ups').getByRole('button', { name: 'View people' }).click();
  await expectVisible(manage.getByText('That list was deleted somewhere else.'), '404 says so');
  await page.waitForTimeout(300);
  expect(!(await row('Open house sign-ups').count()), 'lists reloaded without it');
  await shot(page, '1280-02-manage-404');
  await context.close();

  // 4. The parts line is announced when the count changes, not on every key.
  ({ page, api, context } = await open({ width: 1280, height: 1200 }));
  const step = page.locator('#nl-step-recipients');
  await step.getByRole('checkbox', { name: /Text message/ }).check();
  const live = step.locator('span.sr-only[aria-live="polite"]');
  await step.getByLabel('Text message', { exact: true }).fill('Hello');
  await page.waitForTimeout(200);
  expect(await live.textContent() === '', 'nothing announced while it stays at 1 part');
  await step.getByLabel('Text message', { exact: true }).fill('Sale 😀 this weekend');
  await page.waitForTimeout(200);
  expect(await live.textContent() === 'Uses 2 text message parts per person.', 'announced when it becomes 2 parts');
  expect(!(await step.locator('p[aria-live]').filter({ hasText: 'Uses' }).count()), 'the visible line is not a live region');
  await context.close();

  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 844 });
    const d = await openImport(phone.page);
    await d.getByTestId('nl-csv-input').setInputFiles(CSV);
    await expectVisible(d.getByText('Are dates day/month or month/day?'), `date order at ${width}`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll with the date question at ${width}`);
    if (width === 390) await shot(phone.page, '390-01-date-order');
    await phone.context.close();
  }
}
