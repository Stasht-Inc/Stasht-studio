// Chris 22 Nov 2026 (Q4, "Edit as HTML"): the composer's Sections | HTML switch, click by click, at 1280 and 390.
// Paste a whole Mailchimp/Canva-style template (head <style>, classes, a media query, tables, pictures, a script, an
// onclick, a form, a tracking pixel) → saved as typed → the preview is the API's own email (the real NewsletterRenderer
// output for this template, tests/newsletter/ui/fixtures): styles inlined, no script, our footer with Unsubscribe and
// the business address → "We removed 12 unsupported items" → Text message hidden with its note → back to Sections: the
// sections and the text are still there → HTML again → reopen the draft: still HTML with the paste → Send now: email only.
// node tests/newsletter/ui/check.mjs c22-html-newsletter
import { readFileSync } from 'fs';
import { createMockApi, newsletter } from '../mock-api.mjs';

const FX = new URL('../fixtures/', import.meta.url).pathname;
const TEMPLATE = readFileSync(`${FX}c22-tbp-template.html`, 'utf8');
const FIXTURE = { source: TEMPLATE, html: readFileSync(`${FX}c22-tbp-email.html`, 'utf8'), ...JSON.parse(readFileSync(`${FX}c22-tbp-preview.json`, 'utf8')) };
const MESSAGE = 'Lashes all year: 4 for the price of 3.';

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const [width, height, tag] of [[1280, 1000, '1280'], [390, 844, '390']]) {
    const phone = tag === '390';
    const api = createMockApi({ htmlDocumentFixture: FIXTURE, businessAddress: '22 Commercial Dr, Vancouver, BC' });
    const { page, context } = await open({ width, height, api });
    const step2 = page.locator('#nl-step-recipients');
    const content = page.locator('#nl-step-content');
    const aside = page.locator('aside');
    const modeSwitch = page.getByRole('radiogroup', { name: 'Email content' });

    // 1 Name and subject; 2 All leads, by email and text, with a message (it becomes the email's Message section).
    await page.locator('#nl-name').fill(`November Newsletter ${tag}`);
    await page.locator('#nl-subject').fill('November specials');
    await step2.getByRole('button', { name: /Send to/ }).click();
    await page.getByRole('checkbox', { name: /All leads/ }).check();
    await page.keyboard.press('Escape');
    await step2.getByRole('checkbox', { name: /Text message/ }).check();
    await step2.getByLabel('Message (optional)', { exact: true }).fill(MESSAGE);
    await expectVisible(aside.getByText(MESSAGE).first(), `${tag}: the message is a section of the email`);
    await page.waitForTimeout(1500); // autosave

    // The switch: at the top of the composer, Sections chosen.
    await expectVisible(modeSwitch, `${tag}: Sections | HTML switch`);
    expect(await modeSwitch.getByRole('radio', { name: 'Sections' }).getAttribute('aria-checked') === 'true', `${tag}: Sections is chosen first`);
    const switchBox = await modeSwitch.boundingBox();
    const step1Box = await page.locator('#nl-step-name').boundingBox();
    expect(switchBox && step1Box && switchBox.y < step1Box.y, `${tag}: the switch is at the top, above step 1`);
    await shot(page, `${tag}-01-sections`);

    // HTML: the code box in Content, the preview's empty state, Text message hidden with a short note.
    await modeSwitch.getByRole('radio', { name: 'HTML' }).click();
    const box = content.getByLabel('HTML Content');
    await expectVisible(box, `${tag}: HTML Content box`);
    expect(await box.getAttribute('placeholder') === 'Paste your HTML code here...', `${tag}: Storeel's placeholder`);
    expect(await content.getByText('Choose a template').count() === 0, `${tag}: the template cards make way for the HTML box`);
    await expectVisible(aside.getByText('Paste your HTML to see your email here.'), `${tag}: preview's empty state`);
    expect(await step2.getByRole('checkbox', { name: /Text message/ }).count() === 0, `${tag}: Text message is hidden`);
    await expectVisible(step2.getByText('HTML emails go out by email only.'), `${tag}: the email-only note`);
    expect(await step2.getByLabel('Message (optional)', { exact: true }).count() === 0, `${tag}: the Message box is hidden`);
    expect(await step2.getByRole('checkbox', { name: /Email/ }).isChecked(), `${tag}: Email stays on`);
    await page.waitForTimeout(1200);
    const switched = api.state.newsletters[0];
    expect(switched?.content?.mode === 'html', `${tag}: HTML is saved (got ${JSON.stringify(switched?.content)})`);
    expect(switched?.blocks?.length === 1, `${tag}: the sections are kept`);
    await shot(page, `${tag}-02-html-empty`);

    // Paste the whole template: saved as typed, the API's email shows.
    await box.fill(TEMPLATE);
    const frame = aside.locator('iframe[title="HTML email preview"]');
    await expectVisible(frame, `${tag}: the email preview`);
    const saved = api.state.newsletters[0];
    expect(saved?.content?.html_document === TEMPLATE.trim(), `${tag}: the paste is saved as typed`);
    expect((await frame.getAttribute('sandbox')) === 'allow-same-origin', `${tag}: the preview frame runs no scripts`);
    const email = page.frameLocator('iframe[title="HTML email preview"]');
    const h1 = email.locator('h1', { hasText: 'Holiday lash packages' });
    await expectVisible(h1, `${tag}: the template is in the preview`);
    expect((await h1.getAttribute('style'))?.includes('color:#2E3B30'), `${tag}: the template's <style> is inlined (h1 ${await h1.getAttribute('style')})`);
    expect(await h1.evaluate((el) => getComputedStyle(el).color) === 'rgb(46, 59, 48)', `${tag}: and it shows`);
    expect(await email.locator('script, iframe, form, [onclick]').count() === 0, `${tag}: no script, frame, form or handler`);
    expect(await email.locator('img[src*="tracker"]').count() === 0, `${tag}: no tracking pixel`);
    await expectVisible(email.getByText('Unsubscribe', { exact: true }), `${tag}: our unsubscribe link`);
    await expectVisible(email.getByText('22 Commercial Dr, Vancouver, BC'), `${tag}: the business address`);
    const footerBelow = await email.locator('[data-newsletter="footer"]').evaluate((footer) => {
      const doc = footer.ownerDocument.querySelector('[data-newsletter="document"]');
      return doc ? footer.getBoundingClientRect().top >= doc.getBoundingClientRect().bottom - 1 : false;
    });
    expect(footerBelow, `${tag}: the footer is under the template`);
    expect(!(await page.evaluate(() => window.__hacked === true)), `${tag}: the pasted script never ran`);
    await expectVisible(content.getByText(/We removed 12 unsupported items/), `${tag}: what the cleaning removed`);
    expect(/4 scripts, 1 form, 1 embedded item, 2 links, 1 picture not on https, 1 tracking pixel, 2 style sheets/.test(await content.locator('[data-nl-html-removed]').innerText()), `${tag}: the removed items`);
    const fh = (await frame.boundingBox())?.height ?? 0;
    expect(fh > 600, `${tag}: the preview fits the email (${fh}px)`);
    expect(!(await hasOverflow(page)), `${tag}: no sideways scroll`);
    await page.waitForTimeout(400);
    await shot(page, `${tag}-03-html-pasted`);
    if (phone) {
      // The code box and the email, as a phone shows them (the email preview is under the steps).
      await content.scrollIntoViewIfNeeded();
      await page.screenshot({ path: shotPath(tag, '03b-html-box'), fullPage: false });
      await frame.scrollIntoViewIfNeeded();
      await page.screenshot({ path: shotPath(tag, '03c-html-preview'), fullPage: false });
    } else {
      await aside.getByRole('radio', { name: 'Phone view' }).click();
      await page.waitForTimeout(500);
      await shot(page, `${tag}-04-phone-view`);
      await aside.getByRole('radio', { name: 'Desktop view' }).click();
    }

    // The exact email is the same email.
    await page.getByRole('button', { name: 'Preview exact email' }).first().click();
    await expectVisible(page.frameLocator('iframe[title="Exact email preview"]').locator('h1', { hasText: 'Holiday lash packages' }), `${tag}: exact email shows the template`);
    await page.waitForTimeout(400);
    await shot(page, `${tag}-05-exact-email`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Back to Sections: the Message section, Text message (still ticked) and the message are all there; the paste stays saved.
    await modeSwitch.getByRole('radio', { name: 'Sections' }).click();
    await expectVisible(aside.getByText(MESSAGE).first(), `${tag}: the sections are back`);
    expect(await step2.getByRole('checkbox', { name: /Text message/ }).isChecked(), `${tag}: Text message is still ticked`);
    expect(await step2.getByLabel('Message (optional)', { exact: true }).inputValue() === MESSAGE, `${tag}: the message is kept`);
    await expectVisible(content.getByText('Choose a template'), `${tag}: the template cards are back`);
    await page.waitForTimeout(1200);
    const back = api.state.newsletters[0];
    expect(back?.content?.mode === 'sections' && back.content.html_document === TEMPLATE.trim(), `${tag}: back on Sections, the paste is kept (${back?.content?.mode})`);
    await shot(page, `${tag}-06-back-to-sections`);

    // HTML again, then reopen the draft: still HTML, with the paste and its preview.
    await modeSwitch.getByRole('radio', { name: 'HTML' }).click();
    await expectVisible(frame, `${tag}: the preview comes back`);
    expect(await box.inputValue() === TEMPLATE, `${tag}: the paste is still in the box`);
    await page.waitForTimeout(1200);
    const id = api.state.newsletters[0].id;
    await context.close();

    const again = await open({ width, height, api, query: `&newsletterId=${id}` });
    const p2 = again.page;
    const switch2 = p2.getByRole('radiogroup', { name: 'Email content' });
    await expectVisible(switch2.getByRole('radio', { name: 'HTML', checked: true }), `${tag}: reopened on HTML`);
    expect((await p2.locator('#nl-step-content').getByLabel('HTML Content').inputValue()) === TEMPLATE.trim(), `${tag}: reopened with the paste`);
    await expectVisible(p2.frameLocator('iframe[title="HTML email preview"]').locator('h1', { hasText: 'Holiday lash packages' }), `${tag}: reopened with its preview`);
    await expectVisible(p2.locator('#nl-step-recipients').getByText('HTML emails go out by email only.'), `${tag}: reopened email only`);
    await p2.waitForTimeout(400);
    await shot(p2, `${tag}-07-reopened`);

    // A test goes by email only (one button, no Text me a test).
    await p2.getByRole('button', { name: 'Send a test to me' }).click();
    expect(await p2.getByRole('menuitem', { name: 'Text me a test' }).count() === 0, `${tag}: no text test`);
    await expectVisible(p2.getByText('Test sent to samantha@serpachrysler.ca.', { exact: true }), `${tag}: email test sent`);

    // Send now: the confirmation counts emails only; the API takes it although texts were ticked for the sections.
    await p2.getByRole('button', { name: 'Send Now' }).last().click();
    const confirm = p2.getByRole('dialog', { name: 'Send this newsletter now?' });
    await expectVisible(confirm, `${tag}: send confirmation`);
    await p2.waitForTimeout(800);
    const confirmText = await confirm.innerText();
    expect(/email/i.test(confirmText) && !/text message/i.test(confirmText), `${tag}: the confirmation counts emails only (${confirmText.replace(/\s+/g, ' ').slice(0, 200)})`);
    await shot(p2, `${tag}-08-send-confirm`);
    await confirm.getByRole('button', { name: 'Send Now' }).click();
    await expectVisible(p2.getByText('Sending now. Follow it in Campaigns › Newsletters.'), `${tag}: sent`);
    const sent = api.state.newsletters.find((n) => n.id === id);
    expect(sent?.status === 'scheduled', `${tag}: queued (got ${sent?.status})`);
    expect(JSON.stringify(sent?.channels) === '["email","sms"]', `${tag}: the sections' choice is kept on the newsletter`);
    await again.context.close();
  }

  // A sent HTML newsletter opens read-only: the switch and the box can't change, the email still shows.
  const sentApi = createMockApi({ htmlDocumentFixture: FIXTURE, businessAddress: '22 Commercial Dr, Vancouver, BC',
    newsletters: [newsletter(900, { name: 'October Newsletter', subject: 'October specials', status: 'sent', sent_at: '2026-10-30T15:00:00Z', content: { mode: 'html', html_document: TEMPLATE.trim() } })] });
  const ro = await open({ width: 1280, height: 1000, api: sentApi, query: '&newsletterId=900' });
  const roSwitch = ro.page.getByRole('radiogroup', { name: 'Email content' });
  await expectVisible(roSwitch.getByRole('radio', { name: 'HTML', checked: true }), 'sent: on HTML');
  expect(await roSwitch.getByRole('radio', { name: 'Sections' }).isDisabled(), 'sent: the switch can\'t change');
  expect(await ro.page.locator('#nl-html-document').getAttribute('readonly') !== null, 'sent: the box is read-only');
  await expectVisible(ro.page.frameLocator('iframe[title="HTML email preview"]').locator('h1', { hasText: 'Holiday lash packages' }), 'sent: the email shows');
  expect(sentApi.state.contentBodies.length === 0, 'sent: nothing saved');
  await ro.page.waitForTimeout(400);
  await shot(ro.page, '1280-09-sent-read-only');
  await ro.context.close();
}

function shotPath(tag, file) {
  const dir = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
  console.log('shot', `${dir}/c22-html-newsletter-${tag}-${file}.png`);
  return `${dir}/c22-html-newsletter-${tag}-${file}.png`;
}
