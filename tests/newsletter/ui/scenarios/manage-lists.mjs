// [wdy2xh2p3k] Manage lists from the recipients step: each list's size, consent and date; its people, 50 a page;
// rename (PATCH); delete, with the API's 409 for a list a scheduled newsletter uses, and a deleted list leaves the draft.
import { createMockApi, newsletter } from '../mock-api.mjs';

const LISTS = () => [
  { id: 9, name: 'Open house sign-ups', source: 'import', member_count: 212, email_count: 198, sms_count: 140, consent_type: 'express', created_at: '2026-10-02T15:00:00Z' },
  { id: 11, name: 'Spring buyers', source: 'leads', member_count: 30, email_count: 30, sms_count: 12, consent_type: 'implied', created_at: '2026-09-20T15:00:00Z' },
  { id: 12, name: 'Winter tire customers', source: 'import', member_count: 10, email_count: 10, sms_count: 0, consent_type: null, created_at: '2026-08-01T15:00:00Z' },
];
const NEWSLETTERS = () => [
  newsletter(22, { name: 'Winter tires', status: 'scheduled', scheduled_at: new Date(Date.now() + 2 * 86400000).toISOString(), audience: [{ type: 'list', id: 12 }] }),
  newsletter(23, { name: 'October Newsletter 2026', subject: 'Deals', audience: [{ type: 'all_leads' }, { type: 'list', id: 11 }] }),
];

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const api = createMockApi({ lists: LISTS(), newsletters: NEWSLETTERS() });
  const { page, context } = await open({ width: 1280, height: 1100, api, query: '&newsletterId=23' });
  const step = page.locator('#nl-step-recipients');
  await expectVisible(step.getByText('All leads + 1 more').first(), 'draft has the list');
  await step.getByRole('button', { name: 'Manage lists' }).click();
  const dialog = page.getByRole('dialog', { name: 'Manage lists' });
  await expectVisible(dialog.getByText('212 contacts · Express consent · Imported Oct 2, 2026'), 'list details');
  await expectVisible(dialog.getByText('30 contacts · Implied consent · Made from leads Sep 20, 2026'), 'leads list details');
  await expectVisible(dialog.getByText(/10 contacts · Consent not recorded/), 'older list');
  await shot(page, '1280-01-lists');

  // People on a list, 50 a page.
  await dialog.getByRole('listitem').filter({ hasText: 'Open house sign-ups' }).getByRole('button', { name: 'View people' }).click();
  await expectVisible(dialog.getByRole('cell', { name: /Contact 1\b/ }), 'members table');
  await expectVisible(dialog.getByText('Page 1 of 5'), 'page count');
  expect(await dialog.locator('tbody tr').count() === 50, '50 people a page');
  await expectVisible(dialog.getByText('Express, May 1, 2026').first(), 'consent per person');
  await shot(page, '1280-02-members');
  await dialog.getByRole('button', { name: 'Next page' }).click();
  await expectVisible(dialog.getByText('Page 2 of 5'), 'next page');
  expect(api.state.calls.some((c) => c.path === '/contact-lists/9/members' && c.query.startsWith('?page=2')), `page 2 asked for (got ${JSON.stringify(api.state.calls.filter((c) => c.path.includes('members')).map((c) => c.query))})`);
  await dialog.getByRole('button', { name: 'All lists' }).click();

  // Rename.
  const row = dialog.getByRole('listitem').filter({ hasText: 'Open house sign-ups' });
  await row.getByRole('button', { name: 'Rename' }).click();
  await dialog.getByLabel('New name for Open house sign-ups').fill('Open house 2026');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expectVisible(dialog.getByText('Open house 2026', { exact: true }), 'renamed in the dialog');
  const patch = api.state.calls.find((c) => c.method === 'PATCH');
  expect(patch?.path === '/contact-lists/9' && patch?.body?.name === 'Open house 2026', `PATCH body (got ${JSON.stringify(patch)})`);

  // Delete: a list a scheduled newsletter uses can't go (409, the API's words).
  const winter = dialog.getByRole('listitem').filter({ hasText: 'Winter tire customers' });
  await winter.getByRole('button', { name: 'Delete' }).click();
  await expectVisible(winter.getByText(/The people on it are removed for good/), 'delete asks first');
  await winter.getByRole('button', { name: 'Yes, delete it' }).click();
  await expectVisible(winter.getByText('This list is used by a scheduled newsletter. Cancel it first.'), '409 message');
  await shot(page, '1280-03-in-use');
  expect(api.state.lists.some((l) => l.id === 12), 'the list in use is kept');

  // Delete a list the draft uses: it leaves the draft's recipients too.
  const spring = dialog.getByRole('listitem').filter({ hasText: 'Spring buyers' });
  await spring.getByRole('button', { name: 'Delete' }).click();
  await spring.getByRole('button', { name: 'Yes, delete it' }).click();
  await expectVisible(page.getByText('Deleted the list "Spring buyers".'), 'deleted toast');
  expect(!api.state.lists.some((l) => l.id === 11), 'list deleted');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expectVisible(step.getByText('All leads', { exact: true }).first(), 'recipients without the deleted list');
  await page.waitForTimeout(1500);
  expect(JSON.stringify(api.state.newsletters.find((n) => n.id === 23)?.audience) === JSON.stringify([{ type: 'all_leads' }]), 'draft saved without the list');
  await context.close();

  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 844, api: createMockApi({ lists: LISTS(), newsletters: NEWSLETTERS() }), query: '&newsletterId=23' });
    const s = phone.page.locator('#nl-step-recipients');
    await s.getByRole('button', { name: 'Manage lists' }).click();
    const d = phone.page.getByRole('dialog', { name: 'Manage lists' });
    await expectVisible(d.getByText(/212 contacts/), `lists at ${width}`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll in the lists at ${width}`);
    if (width === 390) await shot(phone.page, '390-01-lists');
    await d.getByRole('listitem').filter({ hasText: 'Open house sign-ups' }).getByRole('button', { name: 'Rename' }).click();
    expect(!(await hasOverflow(phone.page)), `no sideways scroll while renaming at ${width}`);
    await d.getByRole('button', { name: 'Cancel' }).click();
    await d.getByRole('listitem').filter({ hasText: 'Open house sign-ups' }).getByRole('button', { name: 'View people' }).click();
    await expectVisible(d.getByText('Page 1 of 5'), `members at ${width}`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll in the members table at ${width}`);
    if (width === 390) await shot(phone.page, '390-02-members');
    await phone.context.close();
  }
}
