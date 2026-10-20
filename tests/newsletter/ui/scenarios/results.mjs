// Task 13: results drawer for a sent newsletter (totals and per-channel counts, approximate note, channel and
// status filters, pages, exact email), a SendGrid-sent one (no delivered), one still sending (cancel stops it),
// cancelling a scheduled one, and phones (no sideways scroll at 360 / 375 / 390).
import { createMockApi, seedNewsletters } from '../mock-api.mjs';

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const api = createMockApi({ newsletters: seedNewsletters() });
  const { page, context } = await open({ view: 'results', query: '&id=21', width: 1280, height: 1300, api });
  const drawer = page.getByRole('dialog', { name: 'September recap' });
  await expectVisible(drawer, 'drawer titled with the newsletter name');
  await page.waitForTimeout(700); // slide-in finishes before the screenshots
  await expectVisible(drawer.getByText('Sent', { exact: true }).first(), 'Sent chip');
  await expectVisible(drawer.getByText('1,180').first(), 'delivered count');
  await expectVisible(drawer.getByText('43% of delivered'), 'open rate');
  await expectVisible(drawer.getByText(/Opens are approximate/), 'approximate note');
  await expectVisible(drawer.getByText('Page 1 of 3'), 'pagination (50 a page)');
  await expectVisible(drawer.getByText('Replied STOP'), 'SMS STOP shown on the person');
  expect(await drawer.getByRole('row').count() === 51, 'header + 50 people on the first page');
  await shot(page, '1280-01-sent');

  await drawer.getByRole('radio', { name: 'Text' }).click();
  await expectVisible(drawer.getByText('Page 1 of 1'), 'filtered to texts');
  expect(api.state.calls.some((c) => c.path === '/newsletters/21/results' && c.query.includes('channel=sms')), 'channel filter sent to the API');
  await expectVisible(drawer.getByText('Link opened'), 'texts show "Link opened" (counts.sms)');
  await expectVisible(drawer.getByText('Replied STOP', { exact: true }).first(), 'texts show "Replied STOP"');
  await expectVisible(drawer.getByText('21% of delivered'), 'text link-open rate from counts.sms (42 / 200)');
  await shot(page, '1280-02-texts');
  await drawer.getByRole('radio', { name: 'Email' }).click();
  await expectVisible(drawer.getByText('48% of delivered'), 'email open rate from counts.email (470 / 980)');
  await shot(page, '1280-03-email');
  await drawer.getByRole('radio', { name: 'All' }).click();
  await drawer.getByLabel('Status').selectOption('opened');
  await page.waitForTimeout(300);
  expect(api.state.calls.some((c) => c.path === '/newsletters/21/results' && c.query.includes('status=opened')), 'Opened filter sent to the API');
  await drawer.getByLabel('Status').selectOption('');
  await drawer.getByRole('button', { name: 'Next page' }).click();
  await expectVisible(drawer.getByText('Page 2 of 3'), 'next page');
  expect(api.state.calls.some((c) => c.path === '/newsletters/21/results' && c.query.includes('page=2')), 'page sent to the API');

  await drawer.getByRole('button', { name: 'View exact email' }).click();
  await expectVisible(page.frameLocator('iframe[title="Exact email preview"]').locator('#mock-preview-title'), 'exact email from the drawer');
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await context.close();

  // Sent through the SendGrid fallback: no delivered count, so rates are out of sent (contract note 10).
  const sg = await open({ view: 'results', query: '&id=24', width: 1280, height: 1100, api: createMockApi({ newsletters: seedNewsletters() }) });
  const d3 = sg.page.getByRole('dialog', { name: 'Service reminder' });
  await expectVisible(d3.getByText('Not every email service reports this'), 'delivered not reported');
  await sg.page.waitForTimeout(700);
  await expectVisible(d3.getByText('30% of sent'), 'open rate out of sent');
  await shot(sg.page, '1280-04-sendgrid');
  await sg.context.close();

  // Still sending: numbers so far, people still waiting, and Cancel sending stops the rest.
  const sd = await open({ view: 'results', query: '&id=25', width: 1280, height: 1300, api: createMockApi({ newsletters: seedNewsletters() }) });
  const d4 = sd.page.getByRole('dialog', { name: 'Open house this weekend' });
  await expectVisible(d4.getByText('Sending now'), 'sending line');
  await sd.page.waitForTimeout(700);
  await expectVisible(d4.locator('tbody').getByText('Waiting', { exact: true }), 'people still waiting');
  await shot(sd.page, '1280-05-sending');
  await d4.getByRole('button', { name: 'Cancel sending' }).click();
  await sd.page.getByRole('button', { name: 'Yes, cancel it' }).click();
  await expectVisible(sd.page.getByText('Newsletter cancelled. Nothing more will be sent.'), 'cancel toast (sending)');
  await expectVisible(d4.getByText('Cancelled', { exact: true }).first(), 'sending one now Cancelled');
  await sd.context.close();

  const s = await open({ view: 'results', query: '&id=22', width: 1280, height: 1100, api: createMockApi({ newsletters: seedNewsletters() }) });
  const d2 = s.page.getByRole('dialog', { name: 'Winter tires' });
  await expectVisible(d2.getByText(/^Sends /), 'scheduled time');
  await expectVisible(d2.getByText('Nobody has been sent this yet.'), 'scheduled: nobody yet');
  await d2.getByRole('button', { name: 'Cancel sending' }).click();
  await s.page.getByRole('button', { name: 'Yes, cancel it' }).click();
  await expectVisible(s.page.getByText('Newsletter cancelled. Nothing more will be sent.'), 'cancel toast');
  await expectVisible(d2.getByText('Cancelled', { exact: true }).first(), 'status now Cancelled');
  await shot(s.page, '1280-06-cancelled');
  await s.context.close();

  // Phones: the drawer is the full width, people are a list (no table to scroll sideways).
  for (const width of [360, 375, 390]) {
    const p = await open({ view: 'results', query: '&id=21', width, height: 844, api: createMockApi({ newsletters: seedNewsletters() }) });
    const d = p.page.getByRole('dialog', { name: 'September recap' });
    await expectVisible(d.getByText('43% of delivered'), `drawer at ${width}`);
    await p.page.waitForTimeout(700);
    expect(!(await hasOverflow(p.page)), `no sideways scroll in the drawer at ${width}`);
    await expectVisible(d.getByRole('listitem').getByText('lead1@example.com', { exact: true }), `people listed at ${width}`);
    if (width === 390) {
      await shot(p.page, '390-01-sent');
      await d.getByRole('radio', { name: 'Text' }).click();
      await expectVisible(d.getByText('Link opened'), 'texts at 390');
      expect(!(await hasOverflow(p.page)), 'no sideways scroll on texts at 390');
      await shot(p.page, '390-02-texts');
    }
    await p.context.close();
  }
}
