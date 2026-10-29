// Chris, 29 Oct (round 2), item 8: Lists › add / edit person. Mobile has the Studio country-code picker (starts
// on +1 like the other phone fields), saves E.164, and shows the API's 422 message under the field.
import { createMockApi } from '../mock-api.mjs';

const NA_ONLY = 'Text messages can only go to Canadian and US mobile numbers for now.';
const LISTS = () => [
  { id: 9, name: 'Open house sign-ups', source: 'import', member_count: 12, email_count: 9, sms_count: 4, unsubscribed_count: 0, consent_type: 'express', created_at: '2026-10-02T15:00:00Z', updated_at: '2026-10-20T15:00:00Z' },
];
const memberCalls = (api, method) => api.state.calls.filter((c) => c.method === method && /^\/contact-lists\/9\/members(\/\d+)?$/.test(c.path));

async function openList(page, expectVisible) {
  await page.getByRole('button', { name: /^Lists/ }).click();
  await page.getByRole('button', { name: /Open house sign-ups/ }).first().click();
  await expectVisible(page.getByRole('heading', { name: 'Open house sign-ups' }), 'list detail');
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // ---- 1. Add: +1 first, saved as E.164; a UK number gets the API's words under the field.
  {
    const api = createMockApi({ lists: LISTS(), naMobilesOnly: true });
    const { page, context } = await open({ view: 'leads', width: 1280, height: 900, api });
    await openList(page, expectVisible);
    await page.getByRole('button', { name: 'Add person' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a person' });
    const code = dialog.getByLabel('Country code');
    await expectVisible(code, 'country-code picker next to Mobile');
    expect(await code.inputValue() === '+1', `starts on +1 (got ${await code.inputValue()})`);
    await dialog.getByLabel('Name').fill('Jane Doe');
    await dialog.getByRole('radio', { name: /signed up or asked/ }).check();
    // Too short for +1: said under the field, nothing sent.
    await dialog.getByLabel('Mobile').fill('416 555 017');
    await dialog.getByRole('button', { name: 'Add person' }).click();
    await expectVisible(dialog.getByText('Enter the full number, including the area code.'), 'an incomplete +1 number is caught in Studio');
    expect(!memberCalls(api, 'POST').length, 'nothing sent for an incomplete number');
    // A UK mobile: Studio lets it through, the API answers 422, shown under Mobile.
    await code.selectOption('+44');
    await dialog.getByLabel('Mobile').fill('07911 123456');
    await dialog.getByRole('button', { name: 'Add person' }).click();
    await expectVisible(dialog.locator('#lists-member-phone-error').getByText(NA_ONLY, { exact: true }), 'the API’s 422 under Mobile');
    const uk = memberCalls(api, 'POST').at(-1);
    expect(uk?.body?.phone === '+447911123456', `sent as E.164 (got ${uk?.body?.phone})`);
    expect(await dialog.getByLabel('Mobile').getAttribute('aria-invalid') === 'true', 'the field is marked');
    await shot(page, '1280-01-add-422');
    // Back to +1: saved as E.164.
    await code.selectOption('+1');
    await dialog.getByLabel('Mobile').fill('(416) 555-0177');
    await dialog.getByRole('button', { name: 'Add person' }).click();
    await expectVisible(page.getByText('Added Jane Doe to the list.'), 'added');
    const add = memberCalls(api, 'POST').at(-1);
    expect(add?.status === 201 && add?.body?.phone === '+14165550177', `saved E.164 (got ${JSON.stringify(add?.body)})`);

    // ---- 2. Edit: the stored number splits into +1 and the number; unchanged sends nothing; a pasted number moves its code.
    await page.getByRole('button', { name: 'Actions for Jane Doe' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit person' });
    expect(await edit.getByLabel('Country code').inputValue() === '+1', 'edit: +1 from the stored number');
    expect(await edit.getByLabel('Mobile').inputValue() === '4165550177', `edit: the number without its code (got ${await edit.getByLabel('Mobile').inputValue()})`);
    await shot(page, '1280-02-edit');
    await edit.getByLabel('Name').fill('Jane Doe-Smith');
    await edit.getByRole('button', { name: 'Save' }).click();
    await expectVisible(page.getByRole('cell', { name: 'Jane Doe-Smith' }), 'edited');
    const patch = memberCalls(api, 'PATCH').at(-1);
    expect(JSON.stringify(patch?.body) === JSON.stringify({ name: 'Jane Doe-Smith' }), `an unchanged mobile is not sent (got ${JSON.stringify(patch?.body)})`);
    await page.getByRole('button', { name: 'Actions for Jane Doe-Smith' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const edit2 = page.getByRole('dialog', { name: 'Edit person' });
    await edit2.getByLabel('Mobile').fill('+1 647 555 0199');
    expect(await edit2.getByLabel('Country code').inputValue() === '+1' && await edit2.getByLabel('Mobile').inputValue() === '6475550199', 'a pasted +1 number: code in the picker, digits in the box');
    await edit2.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(600);
    const patch2 = memberCalls(api, 'PATCH').at(-1);
    expect(JSON.stringify(patch2?.body) === JSON.stringify({ phone: '+16475550199' }), `changed mobile saved E.164 (got ${JSON.stringify(patch2?.body)})`);
    await context.close();
  }

  // ---- 3. Phones: the picker and the number fit.
  for (const width of [360, 375, 390]) {
    const api = createMockApi({ lists: LISTS(), naMobilesOnly: true });
    const { page, context } = await open({ view: 'leads', width, height: 844, api });
    await openList(page, expectVisible);
    await page.getByRole('button', { name: 'Add person' }).filter({ visible: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Add a person' });
    await expectVisible(dialog.getByLabel('Country code'), `picker at ${width}`);
    await dialog.getByLabel('Country code').selectOption('+44');
    await dialog.getByLabel('Mobile').fill('07911 123456');
    await dialog.getByLabel('Email').fill('jane@example.com');
    await dialog.getByRole('radio', { name: /signed up or asked/ }).check();
    await dialog.getByRole('button', { name: 'Add person' }).click();
    await expectVisible(dialog.getByText(NA_ONLY, { exact: true }), `422 at ${width}`);
    expect(!(await hasOverflow(page)), `no sideways scroll at ${width}`);
    const fits = await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const input = el.querySelector('#lists-member-phone')?.getBoundingClientRect();
      return Boolean(input && input.right <= r.right && input.width > 120);
    });
    expect(fits, `the number box fits beside the picker at ${width}`);
    if (width === 390) await shot(page, '390-01-add-422');
    await context.close();
  }
}
