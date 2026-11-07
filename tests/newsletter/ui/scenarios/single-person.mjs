// Chris, 3 Nov 2026: "If this is for a single person, then we need the email address here, or phone number if chosen.
// It has to be simple. We aren't going to send them to the leads page to add 1 email address or phone number. Make sure
// Phone number has Country Code and Phone number like we have on all other views on the platform."
// Single person = boxes that follow Send by (Email address / Phone number with the country-code picker), suggestions
// from your leads while typing, saved as [{type: 'person', email?, phone?}]. Older drafts keep their audience.
import { createMockApi, newsletter } from '../mock-api.mjs';

const lastAudience = (api) => api.state.newsletters[0]?.audience;
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const api = createMockApi({ businessAddress: '4505 Steeles Ave W, Toronto, ON', unsubscribed: ['gone@example.com'] });
  const { page, context } = await open({ width: 1280, height: 1400, api });
  const step = page.locator('#nl-step-recipients');
  const sendTo = step.getByRole('button', { name: /^Send to/ });
  const email = step.getByLabel('Email address');
  const phone = step.getByLabel('Phone number');
  const code = step.getByLabel('Country code');
  const textBox = step.getByRole('checkbox', { name: /Text message/ });
  const emailBox = step.getByRole('checkbox', { name: /^Email/ });
  const estimate = step.getByText('Estimated recipients').locator('..').locator('..');
  const estimateText = async () => (await estimate.textContent()) ?? '';

  // A new newsletter: Single person, an Email address box (Email is ticked), no lead picker, no Phone box yet.
  await expectVisible(sendTo, 'Send to');
  expect((await sendTo.textContent()).includes('Single person'), `Send to reads Single person (got "${await sendTo.textContent()}")`);
  await expectVisible(email, 'Email address box');
  expect(!(await phone.count()), 'no Phone number box while Text message is unticked');
  expect(!(await step.getByRole('button', { name: /^Person/ }).count()), 'no lead picker any more');
  expect((await estimateText()).includes('0 emails'), `nobody yet (got "${await estimateText()}")`);
  await shot(page, '1280-01-new-default');

  // Send to: Single person first and ticked; its line says what to do.
  await sendTo.click();
  const menu = page.getByRole('dialog', { name: 'Send to' });
  await expectVisible(menu, 'Send to menu');
  const first = await menu.locator('label').first().textContent();
  expect(/^Single person\s*Type their email or phone number/.test(first ?? ''), `first option is Single person (got "${first}")`);
  expect(await menu.getByRole('checkbox').first().isChecked(), 'Single person ticked');
  await page.keyboard.press('Escape');

  // Typing suggests matching leads; picking one fills the box.
  await email.click();
  await email.pressSequentially('jor', { delay: 30 });
  const list = step.getByRole('listbox', { name: 'Matching leads' });
  await expectVisible(list, 'suggestions while typing');
  expect(api.state.calls.some((c) => c.path === '/newsletters/lead-options' && /search=jor/.test(c.query)), 'search sent to lead-options');
  expect(/Jordan Price/.test(await list.textContent()), 'Jordan suggested');
  expect((await email.getAttribute('aria-expanded')) === 'true', 'the box says its list is open');
  await shot(page, '1280-02-suggestions');
  await email.press('ArrowDown');
  await email.press('Enter');
  await page.waitForTimeout(300);
  expect((await email.inputValue()) === 'jordan.price@example.com', `picked: the email box filled (got "${await email.inputValue()}")`);
  expect(!(await list.count()), 'the list closes after a pick');
  await page.waitForTimeout(1500);
  expect((await estimateText()).includes('1 email'), `1 email (got "${await estimateText()}")`);
  expect(sameJson(lastAudience(api), [{ type: 'person', email: 'jordan.price@example.com' }]), `saved as the typed person (got ${JSON.stringify(lastAudience(api))})`);
  expect((await step.locator('header').textContent()).includes('jordan.price@example.com'), 'the step says who');

  // Text message ticked: a Phone number box with the country-code picker, already filled from the pick.
  await textBox.check();
  await expectVisible(phone, 'Phone number box');
  expect((await code.inputValue()) === '+1', `country code +1 (got "${await code.inputValue()}")`);
  expect((await phone.inputValue()) === '4165550171', `phone filled from the pick (got "${await phone.inputValue()}")`);
  await page.waitForTimeout(1500);
  expect((await estimateText()).includes('1 email · 1 text'), `1 email · 1 text (got "${await estimateText()}")`);
  expect(sameJson(lastAudience(api), [{ type: 'person', email: 'jordan.price@example.com', phone: '+14165550171' }]), `both saved (got ${JSON.stringify(lastAudience(api))})`);
  await shot(page, '1280-03-email-and-phone');

  // Email unticked: only the Phone number box, and only the phone is sent to.
  await emailBox.uncheck();
  await page.waitForTimeout(1500);
  expect(!(await email.count()), 'no Email address box');
  expect((await estimateText()).includes('1 text'), `1 text (got "${await estimateText()}")`);
  expect(sameJson(lastAudience(api), [{ type: 'person', phone: '+14165550171' }]), `only the phone (got ${JSON.stringify(lastAudience(api))})`);
  await shot(page, '1280-04-text-only');

  // The phone box works like every Studio phone field: country code + number, a pasted "+1 …" moves the code.
  await code.selectOption('+44');
  await phone.fill('07911 123456');
  await page.waitForTimeout(1500);
  expect(sameJson(lastAudience(api), [{ type: 'person', phone: '+447911123456' }]), `+44 saved E.164 (got ${JSON.stringify(lastAudience(api))})`);
  expect(/can't get texts \(only Canadian and US mobile numbers\)/.test(await estimateText()), `texts only to +1 (got "${await estimateText()}")`);
  await phone.fill('+1 905 555 0142');
  expect((await code.inputValue()) === '+1' && (await phone.inputValue()) === '9055550142', `pasted number: code moved to the picker (got ${await code.inputValue()} ${await phone.inputValue()})`);
  await page.waitForTimeout(1500);
  // Half typed: kept in the box, said once you leave it, never saved or counted.
  await phone.fill('416 555');
  await phone.blur();
  await expectVisible(step.getByText('Enter the full number, including the area code.'), 'incomplete phone');
  await page.waitForTimeout(1500);
  expect(sameJson(lastAudience(api), [{ type: 'person', phone: '+19055550142' }]), `the last whole number stays saved (got ${JSON.stringify(lastAudience(api))})`);
  expect((await estimateText()).includes('0 texts'), `a half-typed number counts nobody (got "${await estimateText()}")`);
  await shot(page, '1280-05-phone-incomplete');

  // Email again: a half-typed address says so after leaving the box.
  await emailBox.check();
  await email.fill('bad@exa');
  await email.blur();
  await expectVisible(step.getByText('Enter an email address like name@example.com.'), 'bad email');
  expect(!(await step.getByRole('alert').filter({ hasText: 'Enter an email address like' }).count()), 'not repeated under Send to');

  // An unsubscribed address: said under the box before Send, and Send never reaches the API.
  await phone.fill('');
  await email.fill('gone@example.com');
  await page.waitForTimeout(1500);
  await expectVisible(step.getByText("This email address has unsubscribed, so it can't get your newsletters."), 'unsubscribed said under the box');
  expect(!/unsubscribed\./.test(await estimateText()), 'not said twice under the estimate');
  expect(!/email/.test(await estimateText()), `the refused email isn't counted (got "${await estimateText()}")`);
  await page.locator('#nl-subject').fill('Hi');
  await page.getByRole('button', { name: 'Send Now' }).first().click();
  // Chris (7 Nov) / review I1: said under the Email address box only (not again under Send to), and that box has focus.
  await expectVisible(step.locator('#nl-person-email-error').filter({ hasText: 'This email address has unsubscribed' }), 'Recipients step says why, under the box');
  expect(!(await step.locator('[role="alert"]').filter({ hasText: 'This email address has unsubscribed' }).count()), 'not repeated under Send to');
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => document.activeElement?.id) === 'nl-person-email', 'Send focused the Email address box');
  expect(!api.state.calls.some((c) => /\/(send|schedule)$/.test(c.path)), 'nothing sent');
  await shot(page, '1280-06-unsubscribed');

  // An email and a number of two different leads (Jordan's email, Marcus's number): said under the phone box.
  await email.fill('jordan.price@example.com');
  await code.selectOption('+1');
  await phone.fill('905 555 0142');
  await page.waitForTimeout(1500);
  await expectVisible(step.locator('#nl-person-phone-error').filter({ hasText: 'That email and phone belong to two different leads — use one.' }), 'two different leads');
  expect(/1 email/.test(await estimateText()) && !/text/.test(await estimateText()), `the refused phone isn't counted (got "${await estimateText()}")`);
  await page.getByRole('button', { name: 'Send Now' }).first().click();
  // Chris (7 Nov) / review I1: said under the Phone box only, not again under Send to.
  await expectVisible(step.locator('#nl-person-phone-error').filter({ hasText: 'two different leads' }), 'Send stops at Recipients (under the box)');
  expect(!(await step.locator('[role="alert"]').filter({ hasText: 'two different leads' }).count()), 'not repeated under Send to');
  expect(!api.state.calls.some((c) => /\/(send|schedule)$/.test(c.path)), 'still nothing sent');
  await shot(page, '1280-07-two-leads');

  // Someone new (email and number not in Leads): counted for both, nothing to fix; their lead is made when it is sent.
  await email.fill('new.buyer@example.com');
  await phone.fill('416 555 0199');
  await page.waitForTimeout(1500);
  expect((await estimateText()).includes('1 email · 1 text'), `a new person: 1 email · 1 text (got "${await estimateText()}")`);
  expect(!(await step.locator('#nl-person-email-error, #nl-person-phone-error').count()), 'no problem under the boxes');
  expect(sameJson(lastAudience(api), [{ type: 'person', email: 'new.buyer@example.com', phone: '+14165550199' }]), `saved (got ${JSON.stringify(lastAudience(api))})`);
  await shot(page, '1280-08-new-person');
  await context.close();

  // The API's 422 for a box (send / schedule) shows under that box.
  const refused = createMockApi({ businessAddress: '4505 Steeles Ave W, Toronto, ON', sendErrors: { 'audience.0.email': ["This email address has unsubscribed, so it can't get your newsletters."] } });
  const r = await open({ width: 1280, height: 1400, api: refused });
  const rStep = r.page.locator('#nl-step-recipients');
  await r.page.locator('#nl-name').fill('For Casey');
  await rStep.getByLabel('Email address').fill('casey@example.com');
  await r.page.locator('#nl-from-name').fill('Serpa Chrysler');
  await r.page.locator('#nl-reply-to').fill('sales@serpachrysler.ca');
  await r.page.locator('#nl-subject').fill('October deals are here');
  await r.page.locator('aside').getByRole('button', { name: 'Add a section at the top' }).click();
  await r.page.getByRole('menuitem', { name: /^Title/ }).click();
  await r.page.locator('aside').getByLabel('Title', { exact: true }).fill('This month');
  await r.page.waitForTimeout(1500);
  await r.page.getByRole('button', { name: 'Send now' }).last().click();
  const confirm = r.page.getByRole('dialog', { name: 'Send this newsletter now?' });
  await expectVisible(confirm, 'confirm');
  await confirm.getByRole('button', { name: 'Send now' }).click();
  await expectVisible(rStep.locator('#nl-person-email-error').filter({ hasText: 'has unsubscribed' }), "the API's 422 under the Email address box");
  expect((await rStep.getByText('This email address has unsubscribed', { exact: false }).count()) === 1, 'said once, under the box');
  await r.page.waitForTimeout(500);
  await shot(r.page, '1280-09-api-refused');
  await r.context.close();

  // A saved person comes back in the boxes; an older draft's lead fills them; an All leads draft keeps All leads.
  const savedApi = createMockApi({ newsletters: [newsletter(73, { name: 'For Sam', channels: ['email', 'sms'], sms_text: 'Hi', audience: [{ type: 'person', email: 'sam@example.com', phone: '+447911123456' }] })] });
  const saved = await open({ width: 1280, height: 1200, query: '&newsletterId=73', api: savedApi });
  const sStep = saved.page.locator('#nl-step-recipients');
  await expectVisible(sStep.getByLabel('Email address'), 'saved person');
  expect((await sStep.getByLabel('Email address').inputValue()) === 'sam@example.com', 'saved email');
  expect((await sStep.getByLabel('Country code').inputValue()) === '+44' && (await sStep.getByLabel('Phone number').inputValue()) === '7911123456', 'saved phone with its country code');
  await saved.page.waitForTimeout(1500);
  expect(!saved.api.state.calls.some((c) => c.method === 'PUT' && c.body && 'audience' in c.body), 'opening a draft leaves its person as saved');
  await saved.context.close();

  const legacy = await open({ width: 1280, height: 1200, query: '&newsletterId=72', api: createMockApi({ newsletters: [newsletter(72, { name: 'For Marcus', channels: ['email', 'sms'], sms_text: 'Hi', audience: [{ type: 'lead', id: 7103 }] })] }) });
  const lStep = legacy.page.locator('#nl-step-recipients');
  await expectVisible(lStep.getByLabel('Phone number'), 'older lead draft');
  await legacy.page.waitForTimeout(1000);
  expect((await lStep.getByLabel('Phone number').inputValue()) === '9055550142', `the lead's number fills the box (got "${await lStep.getByLabel('Phone number').inputValue()}")`);
  expect(legacy.api.state.calls.some((c) => c.path === '/newsletters/lead-options' && /lead_id=7103/.test(c.query)), 'read back by lead_id');
  expect((await lStep.locator('header').textContent()).includes('Marcus Chen'), 'the step names the lead');
  expect((await lStep.getByText('Estimated recipients').locator('..').locator('..').textContent()).includes('0 emails · 1 text'), 'counted as the lead');
  expect(!legacy.api.state.calls.some((c) => c.method === 'PUT' && c.body && 'audience' in c.body), 'the lead stays until a box is changed');
  await legacy.context.close();

  const older = await open({ width: 1280, height: 1200, query: '&newsletterId=71', api: createMockApi({ newsletters: [newsletter(71, { name: 'Older', audience: [{ type: 'all_leads' }] })] }) });
  const oStep = older.page.locator('#nl-step-recipients');
  await expectVisible(oStep.getByRole('button', { name: /^Send to/ }), 'older draft opens');
  expect((await oStep.getByRole('button', { name: /^Send to/ }).textContent()).includes('All leads'), 'an older draft keeps All leads');
  expect(!(await oStep.getByLabel('Email address').count()), 'no person boxes there');
  await older.context.close();

  // Phones: both boxes and the suggestions fit.
  const phoneView = await open({ width: 390, height: 900 });
  const pStep = phoneView.page.locator('#nl-step-recipients');
  await pStep.getByRole('checkbox', { name: /Text message/ }).check();
  const pPhone = pStep.getByLabel('Phone number');
  await pPhone.scrollIntoViewIfNeeded();
  await pPhone.click();
  await pPhone.pressSequentially('905', { delay: 30 });
  await expectVisible(pStep.getByRole('listbox', { name: 'Matching leads' }), 'suggestions on a phone');
  expect(/Marcus Chen/.test(await pStep.getByRole('listbox', { name: 'Matching leads' }).textContent()), 'search by phone');
  expect(!(await hasOverflow(phoneView.page)), 'no sideways scroll on a phone');
  await shot(phoneView.page, '390-01-suggestions');
  await pStep.getByRole('option', { name: /Marcus Chen/ }).click();
  await phoneView.page.waitForTimeout(1500);
  expect((await pPhone.inputValue()) === '9055550142', 'picked on a phone');
  await pStep.getByLabel('Email address').fill('marcus@exa');
  await pStep.getByLabel('Email address').blur();
  expect(!(await hasOverflow(phoneView.page)), 'no sideways scroll with an error showing');
  await shot(phoneView.page, '390-02-both-boxes');
  await phoneView.context.close();
}
