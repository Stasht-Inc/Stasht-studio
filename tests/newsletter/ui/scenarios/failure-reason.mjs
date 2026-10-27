// Follow-up wdy2xh2p3h (Studio part): a failed newsletter says why (failure_reason) in the list (chip tooltip, the
// When column, the phone card) and in the results drawer.
import { createMockApi, newsletter, seedNewsletters } from '../mock-api.mjs';

const TOO_LATE = "It was more than 6 hours late, so it wasn't sent. Duplicate it to send it now.";
const ERROR = 'Something went wrong before it started sending.';
const items = () => [
  ...seedNewsletters(),
  newsletter(30, { name: 'Black Friday early access', subject: 'Early access starts now', status: 'failed', failure_reason: 'too_late', scheduled_at: '2026-10-20T13:00:00Z' }),
  newsletter(31, { name: 'Service clinic', subject: 'Free inspection', status: 'failed', failure_reason: 'error', scheduled_at: '2026-10-21T13:00:00Z' }),
];

async function toNewsletters(page) {
  await page.getByRole('radio', { name: 'Newsletters' }).click();
  await page.getByRole('heading', { name: 'Newsletters', exact: true }).waitFor();
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const { page, context } = await open({ view: 'campaigns', width: 1280, height: 1100, api: createMockApi({ newsletters: items() }) });
  await toNewsletters(page);
  const late = page.getByRole('row', { name: /Black Friday early access/ });
  await expectVisible(late.getByText('Too late to send'), 'too late in the When column');
  expect(await late.getByText('Failed').getAttribute('title') === TOO_LATE, 'chip tooltip says why');
  const broken = page.getByRole('row', { name: /Service clinic/ });
  await expectVisible(broken.getByText('Could not be sent'), 'error in the When column');
  expect(await broken.getByText('Failed').getAttribute('title') === ERROR, 'error tooltip');
  await late.getByText('Failed').hover();
  await shot(page, '1280-01-list');

  await late.getByRole('button', { name: /^Black Friday early access/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Black Friday early access' });
  await expectVisible(drawer.getByText(TOO_LATE), 'drawer says why');
  await expectVisible(drawer.getByText('Nobody was sent this.'), 'empty list says nobody was sent it');
  await page.waitForTimeout(700);
  await shot(page, '1280-02-drawer');
  await context.close();

  for (const width of [360, 375, 390]) {
    const phone = await open({ view: 'campaigns', width, height: 900, api: createMockApi({ newsletters: items() }) });
    await toNewsletters(phone.page);
    await expectVisible(phone.page.getByRole('listitem').filter({ hasText: 'Black Friday early access' }).getByText(TOO_LATE), `phone card says why at ${width}`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll in the list at ${width}`);
    if (width === 390) await shot(phone.page, '390-01-list');
    await phone.page.getByRole('button', { name: /^Service clinic/ }).click();
    await expectVisible(phone.page.getByRole('dialog', { name: 'Service clinic' }).getByText(ERROR), `drawer at ${width}`);
    await phone.page.waitForTimeout(700);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll in the drawer at ${width}`);
    if (width === 390) await shot(phone.page, '390-02-drawer');
    await phone.context.close();
  }
}
