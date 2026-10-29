// Chris, 29 Oct (round 2), item 7: importing a Mailchimp export. The problem message shows next to the Import
// button (always in view, focused so it is read out), not below the fold; auto-match takes Email Address, First /
// Last Name and Phone Number, and never a date or time column (OPTIN_TIME, CONFIRM_TIME, LAST_CHANGED) for Mobile,
// Name or Email, even when the file has no phone column.
import { mkdirSync, writeFileSync } from 'fs';

const DIR = '/private/tmp/claude-501/newsletters-ui';
const WITH_PHONE = `${DIR}/mailchimp-subscribed.csv`;
const NO_PHONE = `${DIR}/mailchimp-no-phone.csv`;
const HEADER = ['Email Address', 'First Name', 'Last Name', 'Address', 'Phone Number', 'Birthday', 'MEMBER_RATING', 'OPTIN_TIME', 'OPTIN_IP', 'CONFIRM_TIME', 'CONFIRM_IP', 'LATITUDE', 'LONGITUDE', 'GMTOFF', 'DSTOFF', 'TIMEZONE', 'CC', 'REGION', 'LAST_CHANGED', 'LEID', 'EUID', 'NOTES', 'TAGS'];
const PEOPLE = [['Ava', 'Chen', '+1 416 555 0101'], ['Ben', 'Ortiz', '(647) 555-0199'], ['Cara', 'Diaz', ''], ['Dev', 'Patel', '905-555-0142'], ['Eli', 'Moreau', ''], ['Fay', 'Wong', '416.555.0177']];
const row = ([first, last, phone], i) => [
  `${first.toLowerCase()}@example.com`, first, last, i === 0 ? '"12 King St W  Toronto ON M5H 1A1 CA"' : '', phone, i === 0 ? '03/15' : '', String(2 + (i % 3)),
  `2024-0${3 + i}-0${1 + i} 14:22:0${i}`, `192.168.1.${10 + i}`, `2024-0${3 + i}-0${1 + i} 14:25:1${i}`, `10.0.0.${7 + i}`, `43.65${i}2`, `-79.38${i}2`, '-5', '-4', 'America/Toronto', 'CA', 'ON',
  `2024-0${6 + (i % 3)}-1${i} 09:10:11`, String(153856109 + i), `a1b2c3d4e${i}`, '', i === 1 ? '"""VIP"""' : '',
];
const csv = (dropPhone) => [HEADER, ...PEOPLE.map(row)].map((cells) => cells.filter((_, i) => !(dropPhone && i === 4)).join(',')).join('\n') + '\n';

async function openImport(page) {
  const step = page.locator('#nl-step-recipients');
  await step.scrollIntoViewIfNeeded();
  await step.getByRole('button', { name: /Send to/ }).click();
  await page.getByRole('button', { name: 'Add a list' }).click();
  return page.getByRole('dialog', { name: 'Add a list' });
}

/** The message is next to Import (same footer row), inside the screen, and has focus. */
async function errorAtImport(page, dialog) {
  return dialog.evaluate((el) => {
    const msg = el.querySelector('#nl-import-error');
    const button = [...el.querySelectorAll('button')].find((b) => /^Import \d/.test(b.textContent.trim()));
    if (!msg || !button) return 'missing';
    const r = msg.getBoundingClientRect();
    if (msg.parentElement !== button.parentElement) return 'not in the Import row';
    if (r.top < 0 || r.bottom > window.innerHeight) return 'outside the screen';
    if (document.activeElement !== msg) return 'not focused';
    return 'ok';
  });
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(WITH_PHONE, csv(false));
  writeFileSync(NO_PHONE, csv(true));

  // ---- 1. Mailchimp export with a Phone Number column: the right columns; the consent problem next to Import.
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const { page, api, context } = await open({ width, height });
    const dialog = await openImport(page);
    await dialog.getByTestId('nl-csv-input').setInputFiles(WITH_PHONE);
    await expectVisible(dialog.getByText(/6 contacts ready to import\./), `ready count at ${width}`);
    expect(await dialog.getByLabel('Email column').inputValue() === '0', 'Email column: Email Address');
    expect(await dialog.getByLabel('Mobile column').inputValue() === '4', `Mobile column: Phone Number (got ${await dialog.getByLabel('Mobile column').inputValue()})`);
    expect(await dialog.getByLabel('Name column').inputValue() === '', 'Name column: First and last name');
    const nameShown = await dialog.getByLabel('Name column').evaluate((el) => el.selectedOptions[0]?.textContent);
    expect(nameShown === 'First and last name', `Name column reads "First and last name" (got ${nameShown})`);
    expect(await dialog.getByLabel(/Date they agreed/).inputValue() === '', 'no date column guessed');
    await expectVisible(dialog.getByRole('cell', { name: '+14165550101' }), 'the phone number in the preview');
    expect(!(await dialog.getByRole('cell', { name: /^2024/ }).count()), 'no date in the preview');
    await dialog.getByRole('button', { name: 'Import 6 contacts' }).click();
    await expectVisible(dialog.locator('#nl-import-error').getByText('Choose how these people agreed to hear from you.'), `consent message at ${width}`);
    const where = await errorAtImport(page, dialog);
    expect(where === 'ok', `the message is next to Import, in view and focused at ${width} (got ${where})`);
    expect(!api.state.calls.some((c) => c.path === '/contact-lists/import'), 'nothing imported without consent');
    if (width === 390) expect(!(await hasOverflow(page)), 'no sideways scroll at 390');
    await shot(page, `${width}-01-error-at-import`);
    // Choosing consent clears the message; Import works.
    await dialog.getByRole('radio', { name: /signed up or asked/ }).check();
    await dialog.getByRole('button', { name: 'Import 6 contacts' }).click();
    await expectVisible(page.getByText('Imported 6 contacts.'), `imported at ${width}`);
    const call = api.state.calls.find((c) => c.path === '/contact-lists/import');
    expect(call?.body?.rows?.[0]?.phone === '+14165550101' && call?.body?.rows?.[0]?.name === 'Ava Chen', `rows carry the phone and name (got ${JSON.stringify(call?.body?.rows?.[0])})`);
    expect(call?.body?.rows?.every((r) => !r.phone || !/^2024/.test(r.phone)), 'no date sent as a phone');
    await context.close();
  }

  // ---- 2. No phone column: Mobile stays None (never OPTIN_TIME or another number column).
  for (const width of [1280, 360, 375, 390]) {
    const { page, context } = await open({ width, height: 844 });
    const dialog = await openImport(page);
    await dialog.getByTestId('nl-csv-input').setInputFiles(NO_PHONE);
    await expectVisible(dialog.getByText(/6 contacts ready to import\./), `ready count (emails) at ${width}`);
    const mobile = await dialog.getByLabel('Mobile column').inputValue();
    expect(mobile === '', `Mobile column stays None without a phone column at ${width} (got ${mobile})`);
    expect(!(await dialog.getByRole('cell', { name: /^2024|^\+?20240/ }).count()), 'no OPTIN_TIME in the Mobile cells');
    if (width !== 1280) expect(!(await hasOverflow(page)), `no sideways scroll at ${width}`);
    if (width === 1280 || width === 390) await shot(page, `${width}-02-no-phone-column`);
    await context.close();
  }
}
