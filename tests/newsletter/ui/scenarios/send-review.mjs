// Send-flow review fixes (Tasks 9–12): a 422 on one field holds only that field (the rest saves, its message
// shows, a new value is sent again); the SMS limit counts "…" as three; Send after a 409 turns the composer
// read-only; closing after a failed save tries again; the allowance message shows once; CSV import refuses a
// spreadsheet, reads windows-1252, and asks for consent again for a new file.
import { mkdirSync, writeFileSync } from 'fs';
import { createMockApi } from '../mock-api.mjs';

const DIR = '/private/tmp/claude-501/newsletters-ui';
const COMPOSER = '[role="dialog"][aria-labelledby="nl-composer-title"]';

async function fillAll(page) {
  await page.locator('#nl-name').fill('Send review');
  await page.locator('#nl-subject').fill('October deals are here');
  await page.locator('aside').getByRole('button', { name: 'Add a section at the top' }).click();
  await page.getByRole('menuitem', { name: /^Title/ }).click();
  await page.locator('aside').getByLabel('Title', { exact: true }).fill('This month');
}

export async function run({ open, shot, expectVisible, expect }) {
  // 1. A 422 on the from name: the subject still saves; the from name's message shows; a new value is sent again.
  let api = createMockApi({ rejectPut: { from_name: 'That from name can’t be used. Try your business name.' } });
  let { page, context } = await open({ width: 1280, height: 1400, api });
  await page.locator('#nl-name').fill('Held field');
  await page.waitForTimeout(1500);
  await page.locator('#nl-from-name').fill('Bad name');
  await page.locator('#nl-subject').fill('Subject still saves');
  await page.waitForTimeout(1800);
  const n = api.state.newsletters[0];
  expect(n?.subject === 'Subject still saves', `the subject saved despite the refused from name (got ${n?.subject})`);
  expect(n?.from_name !== 'Bad name', 'the refused from name was not saved');
  await expectVisible(page.locator('#nl-step-from').getByText('That from name can’t be used. Try your business name.'), 'the refusal shows under the field');
  await expectVisible(page.getByRole('status').getByText('Not saved').first(), 'save indicator says not saved');
  const putsBefore = api.state.calls.filter((c) => c.method === 'PUT').length;
  await page.locator('#nl-preview-text').fill('Teaser');
  await page.waitForTimeout(1500);
  const later = api.state.calls.filter((c) => c.method === 'PUT').slice(putsBefore);
  expect(later.length === 1 && !('from_name' in (later[0].body || {})), 'the same refused value is not sent again');
  api.state.rejectPut = {};
  await page.locator('#nl-from-name').fill('Serpa Chrysler');
  await page.waitForTimeout(1500);
  expect(api.state.newsletters[0]?.from_name === 'Serpa Chrysler', 'a new from name is sent and saved');
  await expectVisible(page.getByRole('status').getByText('Draft saved'), 'saved again');
  await shot(page, '1280-01-held-field');

  // 1a. The text limit counts the text as it is sent.
  await page.locator('#nl-step-recipients').getByRole('checkbox', { name: /Text message/ }).check();
  await page.locator('#nl-sms-text').fill(`${'x'.repeat(118)}…`);
  await expectVisible(page.locator('#nl-step-recipients').getByText('121 / 120'), '"…" counts as three');
  await context.close();

  // 2. Send finds it already scheduled (409): the composer shows it read-only.
  api = createMockApi({ businessAddress: '4505 Steeles Ave W', sendConflict: true });
  ({ page, context } = await open({ width: 1280, height: 1600, api }));
  await fillAll(page);
  await page.getByRole('button', { name: 'Send now' }).last().click();
  const confirm = page.getByRole('dialog', { name: 'Send this newsletter now?' });
  await expectVisible(confirm, 'confirmation');
  await page.waitForTimeout(800);
  await confirm.getByRole('button', { name: 'Send now' }).click();
  await expectVisible(page.getByText(/This newsletter is scheduled, so it can't be changed\./), 'read-only after the 409');
  expect(await page.locator('#nl-name').isDisabled() || (await page.locator('#nl-name').getAttribute('readonly')) !== null, 'name field read-only');
  await context.close();

  // 5. A save failed; the server is back; Cancel tries again and closes.
  api = createMockApi({ failPuts: 500 });
  ({ page, context } = await open({ width: 1280, height: 1200, api }));
  await page.locator('#nl-name').fill('Retry on close');
  await page.waitForTimeout(1500);
  await page.locator('#nl-subject').fill('Saved on the way out');
  await page.waitForTimeout(1500);
  await expectVisible(page.getByRole('status').getByText('Not saved').first(), 'the save failed');
  api.state.failPuts = 0;
  await page.getByRole('button', { name: 'Cancel' }).first().click();
  await page.waitForTimeout(1500);
  expect(await page.locator(COMPOSER).count() === 0, 'closed without the "not saved" question');
  expect(api.state.newsletters[0]?.subject === 'Saved on the way out', 'the retry on close saved it');
  await context.close();

  // 7. The allowance message (it has the numbers already) shows once.
  const message = 'This newsletter needs 1,216 emails, but your plan has 900 left this month.';
  api = createMockApi({ businessAddress: '4505 Steeles Ave W', sendErrors: { allowance: [message] } });
  ({ page, context } = await open({ width: 1280, height: 1600, api }));
  await fillAll(page);
  await page.getByRole('button', { name: 'Send now' }).last().click();
  const d = page.getByRole('dialog', { name: 'Send this newsletter now?' });
  await page.waitForTimeout(800);
  await d.getByRole('button', { name: 'Send now' }).click();
  await expectVisible(d.getByText(message, { exact: true }), 'allowance message');
  expect(await d.getByText(/This send needs/).count() === 0, 'numbers not repeated');
  await context.close();

  // 9. CSV import: a spreadsheet is refused; windows-1252 is read; a new file asks for consent again.
  mkdirSync(DIR, { recursive: true });
  const XLSX = `${DIR}/contacts.xlsx`;
  const LATIN = `${DIR}/latin.csv`;
  const OTHER = `${DIR}/other.csv`;
  writeFileSync(XLSX, Buffer.from([0x50, 0x4b, 3, 4, 0, 0, 0, 0]));
  writeFileSync(LATIN, Buffer.concat([Buffer.from('Name,Email\nRen'), Buffer.from([0xe9]), Buffer.from('e Roy,renee@example.com\n')]));
  writeFileSync(OTHER, 'Name,Email\nBo Chen,bo@example.com\n');
  ({ page, context } = await open({ width: 1280, height: 1100 }));
  const step = page.locator('#nl-step-recipients');
  await step.getByRole('button', { name: /Send to/ }).click();
  await page.getByRole('button', { name: 'Add a list' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a list' });
  await dialog.getByTestId('nl-csv-input').setInputFiles(XLSX);
  await expectVisible(dialog.getByText('This file isn’t a CSV file. Save it as CSV and try again.'), 'spreadsheet refused');
  await dialog.getByTestId('nl-csv-input').setInputFiles(LATIN);
  await expectVisible(dialog.getByRole('cell', { name: 'Renée Roy' }), 'windows-1252 read as Renée');
  await dialog.getByRole('checkbox', { name: /These people agreed/ }).check();
  await dialog.getByTestId('nl-csv-input').setInputFiles(OTHER);
  await expectVisible(dialog.getByRole('cell', { name: 'Bo Chen' }), 'second file read');
  expect(!(await dialog.getByRole('checkbox', { name: /These people agreed/ }).isChecked()), 'consent asked again for the new file');
  await shot(page, '1280-02-import');
  await context.close();
}
