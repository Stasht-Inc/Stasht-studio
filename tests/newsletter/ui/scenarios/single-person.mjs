// Chris, 3 Nov 2026: "Send to" starts with "Single person", the default for a new newsletter (most go to one
// prospective buyer): pick one of your leads by name, email or phone (GET /newsletters/lead-options); the estimate is
// that one person ({type: 'lead', id}). All leads, groups and lists come after it; an older draft keeps its audience.
import { createMockApi, newsletter } from '../mock-api.mjs';

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const api = createMockApi({ businessAddress: '4505 Steeles Ave W, Toronto, ON' });
  const { page, context } = await open({ width: 1280, height: 1300, api });
  const step = page.locator('#nl-step-recipients');
  const sendTo = step.getByRole('button', { name: /^Send to/ });
  const person = step.getByRole('button', { name: /^Person/ });
  const estimate = step.getByText('Estimated recipients').locator('..').locator('..');

  // A new newsletter: Single person, nobody yet.
  await expectVisible(sendTo, 'Send to');
  expect((await sendTo.textContent()).includes('Single person'), `Send to reads Single person (got "${await sendTo.textContent()}")`);
  await expectVisible(person, 'Person field');
  expect((await person.textContent()).includes('Choose a person from your Leads'), 'nobody picked yet');
  await shot(page, '1280-01-new-default');

  // Single person is first in Send to, ticked; the others follow.
  await sendTo.click();
  const menu = page.getByRole('dialog', { name: 'Send to' });
  await expectVisible(menu, 'Send to menu');
  const boxes = menu.getByRole('checkbox');
  const first = await menu.locator('label').first().textContent();
  expect(/^Single person/.test(first ?? ''), `first option is Single person (got "${first}")`);
  expect(await boxes.first().isChecked(), 'Single person ticked');
  expect(/All leads/.test(await menu.locator('label').nth(1).textContent() ?? ''), 'All leads second');
  await shot(page, '1280-02-send-to-menu');
  await page.keyboard.press('Escape');

  // Search and pick one lead.
  await person.click();
  const picker = page.getByRole('dialog', { name: 'Choose a person' });
  await expectVisible(picker.getByRole('button', { name: /Jordan Price/ }), 'leads listed, newest first');
  expect(await picker.getByRole('listitem').count() === 5, `five leads (got ${await picker.getByRole('listitem').count()})`);
  await shot(page, '1280-03-person-picker');
  await picker.getByRole('searchbox', { name: /Search your leads/ }).fill('905 555');
  await page.waitForTimeout(600);
  expect(await picker.getByRole('listitem').count() === 1 && /Marcus Chen/.test(await picker.textContent()), 'search by phone (any format)');
  await picker.getByRole('searchbox').fill('priya.sharma@');
  await page.waitForTimeout(600);
  expect(await picker.getByRole('listitem').count() === 1 && /Priya Sharma/.test(await picker.textContent()), 'search by email');
  await picker.getByRole('searchbox').fill('jordan');
  await page.waitForTimeout(600);
  expect(api.state.calls.some((c) => c.path === '/newsletters/lead-options' && /search=jordan/.test(c.query)), 'search sent to lead-options');
  await picker.getByRole('button', { name: /Jordan Price/ }).click();
  await page.waitForTimeout(1500);
  expect((await person.textContent()).includes('Jordan Price · jordan.price@example.com · +1 416 555 0171'), `the person shows (got "${await person.textContent()}")`);
  expect((await estimate.textContent()).includes('1'), 'estimated recipients: 1');
  expect((await step.locator('h2, h3').first().locator('..').textContent()).includes('Jordan Price') || (await step.textContent()).includes('Jordan Price'), 'the step says who');
  const saved = api.state.newsletters[0]?.audience;
  expect(JSON.stringify(saved) === JSON.stringify([{ type: 'lead', id: 7101 }]), `saved as one lead (got ${JSON.stringify(saved)})`);
  // Email and text: one of each.
  await step.getByRole('checkbox', { name: /Text message/ }).check();
  await page.waitForTimeout(900);
  expect((await estimate.textContent()).includes('1 email · 1 text'), `one email and one text (got "${await estimate.textContent()}")`);
  await shot(page, '1280-04-jordan-picked');

  // All leads instead: the person goes; back to Single person: nobody picked, focus on the Person field.
  await sendTo.click();
  await menu.getByRole('checkbox', { name: /All leads/ }).check();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  expect(!(await person.count()), 'no Person field for All leads');
  expect(JSON.stringify(api.state.newsletters[0].audience) === JSON.stringify([{ type: 'all_leads' }]), 'All leads replaces the person');
  await sendTo.click();
  await menu.getByRole('checkbox', { name: /Single person/ }).click(); // the menu closes: the Person field is next
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-labelledby')?.includes('nl-person-label')), 'focus on the Person field');
  await page.waitForTimeout(1200);
  expect(JSON.stringify(api.state.newsletters[0].audience) === '[]', 'Single person, nobody yet');
  // Nobody picked: Send says so at Recipients.
  await page.locator('#nl-subject').fill('Hi');
  await page.getByRole('button', { name: 'Send Now' }).first().click();
  await expectVisible(step.getByText('Choose who gets this newsletter.'), 'send asks for the person');
  await context.close();

  // An older draft keeps its saved audience; a saved person is read back by id.
  const older = await open({ width: 1280, height: 1200, query: '&newsletterId=71', api: createMockApi({ newsletters: [newsletter(71, { name: 'Older', audience: [{ type: 'all_leads' }] })] }) });
  const olderSendTo = older.page.locator('#nl-step-recipients').getByRole('button', { name: /^Send to/ });
  await expectVisible(olderSendTo, 'older draft opens');
  expect((await olderSendTo.textContent()).includes('All leads'), 'an older draft keeps All leads');
  expect(!(await older.page.locator('#nl-step-recipients').getByRole('button', { name: /^Person/ }).count()), 'no Person field there');
  await older.context.close();

  const saved2 = await open({ width: 1280, height: 1200, query: '&newsletterId=72', api: createMockApi({ newsletters: [newsletter(72, { name: 'For Marcus', audience: [{ type: 'lead', id: 7103 }] })] }) });
  const savedPerson = saved2.page.locator('#nl-step-recipients').getByRole('button', { name: /^Person/ });
  await expectVisible(savedPerson, 'a saved person');
  await saved2.page.waitForTimeout(800);
  expect((await savedPerson.textContent()).includes('Marcus Chen · +1 905 555 0142'), `read back by id (got "${await savedPerson.textContent()}")`);
  expect(saved2.api.state.calls.some((c) => c.path === '/newsletters/lead-options' && /lead_id=7103/.test(c.query)), 'asked by lead_id');
  await saved2.context.close();

  // Phones: the field and the picker fit.
  const phone = await open({ width: 390, height: 900 });
  const phonePerson = phone.page.locator('#nl-step-recipients').getByRole('button', { name: /^Person/ });
  await phonePerson.scrollIntoViewIfNeeded();
  await phonePerson.click();
  await expectVisible(phone.page.getByRole('dialog', { name: 'Choose a person' }).getByRole('listitem').first(), 'picker on a phone');
  expect(!(await hasOverflow(phone.page)), 'no sideways scroll on a phone');
  await shot(phone.page, '390-01-person-picker');
  await phone.page.getByRole('dialog', { name: 'Choose a person' }).getByRole('button', { name: /Becky Lawson/ }).click();
  await phone.page.waitForTimeout(900);
  await shot(phone.page, '390-02-becky-picked');
  await phone.context.close();
}
