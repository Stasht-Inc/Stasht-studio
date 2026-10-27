// Review fixes for Tasks 13–14: rates never pass 100% when SendGrid email (no delivered) and texts mix; a newsletter
// deleted elsewhere drops off the list after a failed duplicate / delete; the drawer's Cancel answered 409 (sent
// meanwhile) shows where it is now; the drawer marks itself busy while loading.
import { COUNTS0, createMockApi, newsletter, seedNewsletters } from '../mock-api.mjs';

const MIXED = newsletter(41, {
  name: 'Mixed channels', subject: 'Email by SendGrid, texts by Twilio', status: 'sent', sent_at: '2026-10-10T14:00:00Z', channels: ['email', 'sms'],
  counts: { ...COUNTS0, recipients: 1100, sent: 1100, delivered: 100, opened: 420, clicked: 60 },
});
const channelCounts = { 41: {
  email: { ...COUNTS0, recipients: 1000, sent: 1000, delivered: 0, opened: 400, clicked: 50 },
  sms: { ...COUNTS0, recipients: 100, sent: 100, delivered: 100, opened: 20, clicked: 10 },
} };

export async function run({ open, shot, expectVisible, expect }) {
  const api = createMockApi({ newsletters: [...seedNewsletters(), MIXED], channelCounts });
  const { page, context } = await open({ view: 'campaigns', width: 1280, height: 1000, api });
  await page.getByRole('radio', { name: 'Newsletters' }).click();
  const row = (name) => page.getByRole('row', { name: new RegExp(name) });
  await expectVisible(row('Mixed channels').getByText('38%'), 'list open rate out of sent (420 / 1,100), not 420%');
  const rates = (await page.locator('body').innerText()).match(/\d+%/g) ?? [];
  expect(rates.every((r) => parseInt(r, 10) <= 100), `no rate over 100% in the list (got ${rates.join(' ')})`);

  await row('Mixed channels').getByRole('button', { name: /^Mixed channels/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Mixed channels' });
  await expectVisible(drawer.getByText('38% of delivered or sent'), 'drawer All: per-channel base (1,000 sent + 100 delivered)');
  await drawer.getByRole('radio', { name: 'Email' }).click();
  await expectVisible(drawer.getByText('40% of sent'), 'email: out of sent');
  await expectVisible(drawer.getByText('Not every email service reports this'), 'email delivered not reported');
  await drawer.getByRole('radio', { name: 'Text' }).click();
  await expectVisible(drawer.getByText('20% of delivered'), 'texts: out of delivered');
  expect(await drawer.getByText('Not every email service reports this').count() === 0, 'no email wording on texts');
  expect(await drawer.locator('[aria-busy]').count() === 1, 'results area carries aria-busy');
  await page.waitForTimeout(500);
  await shot(page, '1280-01-mixed');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Deleted in another tab: duplicate answers 404, the list reloads and the row goes.
  api.state.newsletters = api.state.newsletters.filter((n) => n.id !== 24);
  await page.getByRole('button', { name: 'Actions for Service reminder', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expectVisible(page.getByText('Newsletter not found'), '404 said');
  await page.waitForTimeout(500);
  expect(await row('Service reminder').count() === 0, 'gone from the list after the 404');

  // Same for delete.
  api.state.newsletters = api.state.newsletters.filter((n) => n.id !== 23);
  await page.getByRole('button', { name: 'Actions for October Newsletter 2026', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
  await page.waitForTimeout(600);
  expect(await row('October Newsletter 2026').count() === 0, 'gone from the list after a 404 on delete');

  // Sent meanwhile: the drawer's Cancel gets 409 and shows it as sent.
  await row('Winter tires').getByRole('button', { name: /^Winter tires/ }).click();
  const d2 = page.getByRole('dialog', { name: 'Winter tires' });
  await expectVisible(d2.getByRole('button', { name: 'Cancel sending' }), 'Cancel sending in the drawer');
  const winter = api.state.newsletters.find((n) => n.id === 22);
  winter.status = 'sent';
  winter.sent_at = new Date().toISOString();
  await d2.getByRole('button', { name: 'Cancel sending' }).click();
  await page.getByRole('button', { name: 'Yes, cancel it' }).click();
  await expectVisible(page.getByText('Only scheduled or sending newsletters can be cancelled.'), '409 said');
  await expectVisible(d2.getByText('Sent', { exact: true }).first(), 'drawer now shows Sent');
  expect(await d2.getByRole('button', { name: 'Cancel sending' }).count() === 0, 'no Cancel sending once sent');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await expectVisible(row('Winter tires').getByText('Sent', { exact: true }), 'list refreshed too');
  await context.close();
}
