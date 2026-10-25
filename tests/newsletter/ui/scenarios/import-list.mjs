// Task 10: CSV import in the browser (header detection, preview, skipped rows, required consent) and "From leads".
import { mkdirSync, writeFileSync } from 'fs';

const DIR = '/private/tmp/claude-501/newsletters-ui';
const CSV = `${DIR}/open-house.csv`;

async function openImport(page) {
  const step = page.locator('#nl-step-recipients');
  await step.scrollIntoViewIfNeeded();
  await step.getByRole('button', { name: /Send to/ }).click();
  await page.getByRole('button', { name: 'Add a list' }).click();
  return page.getByRole('dialog', { name: 'Add a list' });
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(CSV, 'Full Name,Email,Mobile,Signed up\nAva Chen,AVA@example.com,416-555-0101,2026-05-01\nNo Contact,,,\nBen Ortiz,,(647) 555-0199,\nCara Diaz,cara@example,,\n"Lee, Dana",dana.lee.long.address@serpachrysler-example.ca,,2026-09-12\n');
  const { page, api, context } = await open({ width: 1280, height: 1100 });

  const dialog = await openImport(page);
  await expectVisible(dialog, 'Add a list dialog');
  await dialog.getByTestId('nl-csv-input').setInputFiles(CSV);
  await expectVisible(dialog.getByText(/3 contacts ready to import\./), 'ready count');
  await expectVisible(dialog.getByText(/2 rows have no email address or mobile number we can use/), 'skipped rows');
  await expectVisible(dialog.getByRole('cell', { name: 'Lee, Dana' }), 'quoted comma kept');
  await expectVisible(dialog.getByRole('cell', { name: 'ava@example.com' }), 'email lower-cased');
  expect(await dialog.getByLabel('List name').inputValue() === 'open house', 'list named after the file');
  const importButton = dialog.getByRole('button', { name: 'Import 3 contacts' });
  expect(await importButton.isDisabled(), 'import waits for the consent choice');
  // [wdy2xh2p3e] The date column is found and the consent question has two plain choices and the 6-month hint.
  expect(await dialog.getByLabel(/Date they agreed/).inputValue() === '3', 'the "Signed up" column is the consent date');
  await expectVisible(dialog.getByText('How did these people agree to hear from you?'), 'consent question');
  await expectVisible(dialog.getByText(/implied consent lasts 6 months/), 'implied consent hint');
  await dialog.getByRole('radio', { name: /customers or enquired recently/ }).check();
  await shot(page, '1280-01-preview');

  await importButton.click();
  await expectVisible(page.getByText('Imported 3 contacts.'), 'import toast');
  const call = api.state.calls.find((c) => c.path === '/contact-lists/import');
  expect(call?.status === 201 && call?.body?.consent === true && call?.body?.rows?.length === 3, `import body has consent and 3 rows (got ${JSON.stringify(call?.body)})`);
  expect(call?.body?.consent_type === 'implied' && call?.body?.consent_source === 'import', 'import sends consent_type implied and consent_source import');
  expect(call?.body?.rows?.[0]?.consent_at === '2026-05-01' && !('consent_at' in (call?.body?.rows?.[1] ?? {})) && call?.body?.rows?.[2]?.consent_at === '2026-09-12', `per-row consent_at from the date column (got ${JSON.stringify(call?.body?.rows)})`);
  const list = api.state.lists.find((l) => l.name === 'open house');
  await page.waitForTimeout(1500);
  expect(api.state.newsletters[0]?.audience?.some((a) => a.type === 'list' && a.id === list?.id), 'the new list is ticked in Send to');
  await expectVisible(page.locator('#nl-step-recipients').getByText('All leads + 1 more').first(), 'summary shows the new list');

  const d2 = await openImport(page);
  await d2.getByRole('radio', { name: 'From leads' }).click();
  await d2.getByLabel('List name').fill('VIP snapshot');
  await d2.getByLabel('Who to copy').selectOption('4');
  await expectVisible(d2.getByText('The list is a copy made now. New leads are not added to it later.'), 'snapshot sentence');
  await d2.getByRole('button', { name: 'Make the list' }).click();
  await expectVisible(page.getByText(/Made the list "VIP snapshot"/), 'from-leads toast');
  const fromLeads = api.state.calls.find((c) => c.path === '/contact-lists/from-leads');
  expect(fromLeads?.body?.lead_group_id === 4 && fromLeads?.body?.name === 'VIP snapshot', `from-leads body (got ${JSON.stringify(fromLeads?.body)})`);
  await shot(page, '1280-02-after');
  await context.close();

  // Phones: the dialog and its preview table fit; nothing scrolls sideways.
  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 844 });
    const d = await openImport(phone.page);
    await d.getByTestId('nl-csv-input').setInputFiles(CSV);
    await expectVisible(d.getByText(/3 contacts ready to import\./), `preview at ${width}`);
    await d.getByRole('radio', { name: /signed up or asked to hear from us/ }).check();
    expect(!(await hasOverflow(phone.page)), `no sideways scroll in the import dialog at ${width}`);
    if (width === 390) await shot(phone.page, '390-01-preview');
    await phone.context.close();
  }
}
