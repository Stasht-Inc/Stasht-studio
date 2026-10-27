// wdy2xh2p3j Don't lose work: a copy of the draft stays in this browser until it saves, and comes back as
// "Restore unsaved changes"; the browser asks before closing a tab with a save pending or failed; a failed save
// says why with Try again and retries itself when the connection is back; a draft saved in another tab stops
// this tab with Reload (each PUT carries if_unmodified_since). Paused sending says so in plain words.
import { createMockApi, newsletter } from '../mock-api.mjs';

const STALE = 'This newsletter was changed in another tab. Reload to see the latest.';
const backupKeys = (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('stasht_nl_backup:')));
const savedText = (page) => page.getByText('Draft saved', { exact: true });

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // 1. Every PUT carries the updated_at this tab last saw.
  let { page, api, context } = await open({ width: 1280, height: 1500 });
  await page.locator('#nl-subject').fill('October deals are here');
  await page.waitForTimeout(1600);
  const id = api.state.newsletters[0]?.id;
  const puts = () => api.state.calls.filter((c) => c.method === 'PUT' && c.path === `/newsletters/${id}`);
  expect(puts().length >= 1 && puts().every((c) => typeof c.body?.if_unmodified_since === 'string'), 'each PUT sends if_unmodified_since');
  expect(puts()[0]?.status === 200, 'first PUT accepted');
  await page.locator('#nl-subject').fill('October deals are here!');
  await page.waitForTimeout(1600);
  expect(puts().at(-1)?.status === 200, 'the next PUT uses the newer updated_at and is accepted');
  expect((await backupKeys(page)).length === 0, 'the kept copy is cleared once everything saved');

  // 2. Another tab saves: this tab's next save is refused (409 stale), it says so and offers Reload.
  api.editElsewhere(id, { subject: 'Changed in the other tab' });
  await page.locator('#nl-subject').fill('My edit in this tab');
  await page.waitForTimeout(1600);
  await expectVisible(page.getByRole('alert').filter({ hasText: STALE }), 'stale notice');
  const putsAfterStale = puts().length;
  await page.locator('#nl-from-name').fill('Typing while stale').catch(() => {});
  await page.waitForTimeout(1300);
  expect(puts().length === putsAfterStale, 'no more saves while stale');
  await shot(page, '1280-01-stale');
  await page.getByRole('alert').getByRole('button', { name: 'Reload' }).click();
  await page.waitForTimeout(500);
  expect(await page.locator('#nl-subject').inputValue() === 'Changed in the other tab', 'Reload shows the latest copy');
  const restore = page.getByRole('button', { name: 'Restore unsaved changes' });
  await expectVisible(restore, 'this tab\'s edits stay on offer after Reload');
  // Review fix 6: made on the older version, so the notice says restoring replaces the other tab's changes.
  await expectVisible(page.getByText('They were made before this newsletter was changed in another tab. Restoring them replaces those changes.'), 'older-copy warning');
  await shot(page, '1280-02-restore-after-reload');
  await restore.click();
  await page.waitForTimeout(1600);
  expect(await page.locator('#nl-subject').inputValue() === 'My edit in this tab', 'restored edit shown');
  expect(api.state.newsletters[0]?.subject === 'My edit in this tab', 'restored edit saved');
  await context.close();

  // 3. The server is down: the reason and Try again show; the copy stays in this browser and comes back on reopening.
  ({ page, api, context } = await open({ width: 1280, height: 1200, api: createMockApi({ failPuts: 500 }) }));
  await page.locator('#nl-subject').fill('Kept on this device');
  await page.waitForTimeout(1600);
  await expectVisible(page.getByText('Not saved'), 'Not saved');
  const failed = page.getByRole('alert').filter({ hasText: "Your latest changes couldn't be saved just now. They're kept on this device." });
  await expectVisible(failed, 'save reason shown');
  await expectVisible(failed.getByRole('button', { name: 'Try again' }), 'Try again in the notice');
  await expectVisible(page.locator('header').getByRole('button', { name: 'Try again' }), 'Try again next to Not saved');
  await shot(page, '1280-03-not-saved');
  const createdId = api.state.newsletters[0]?.id;
  expect((await backupKeys(page)).some((k) => k.endsWith(`:${createdId}`)), 'copy kept under the created draft id');

  // The browser asks before the tab closes with a failed save.
  const origin = new URL(page.url()).origin;
  let asked = false;
  page.on('dialog', (d) => { if (d.type() === 'beforeunload') asked = true; void d.dismiss(); });
  await page.close({ runBeforeUnload: true });
  await new Promise((r) => setTimeout(r, 500));
  expect(asked, 'beforeunload prompt while a save failed');

  page = await context.newPage();
  await page.goto(`${origin}/tests/newsletter/ui/harness.html?view=composer&newsletterId=${createdId}`);
  const offer = page.getByRole('button', { name: 'Restore unsaved changes' });
  await expectVisible(offer, 'restore offered on reopening');
  expect(await page.locator('#nl-subject').inputValue() === '', 'server copy shown until restored');
  api.state.failPuts = 0;
  await offer.click();
  await page.waitForTimeout(1600);
  expect(api.state.newsletters[0]?.subject === 'Kept on this device', 'restored copy saved');
  await expectVisible(savedText(page), 'Draft saved after restore');
  expect((await backupKeys(page)).length === 0, 'copy cleared after saving');
  await context.close();

  // 4. Try again works once the server is back.
  ({ page, api, context } = await open({ width: 1280, height: 1200, api: createMockApi({ failPuts: 500 }) }));
  await page.locator('#nl-name').fill('Try again check');
  await page.waitForTimeout(1600);
  api.state.failPuts = 0;
  await page.getByRole('alert').getByRole('button', { name: 'Try again' }).click();
  await page.waitForTimeout(600);
  await expectVisible(savedText(page), 'saved after Try again');
  expect(api.state.newsletters[0]?.name === 'Try again check', 'Try again saved the name');
  await context.close();

  // 5. Offline: plain words, then it saves by itself when the connection is back.
  ({ page, api, context } = await open({ width: 1280, height: 1200 }));
  await page.locator('#nl-name').fill('Before offline');
  await page.waitForTimeout(1600);
  // The mock answers even offline, so it also fails the PUT the way a dropped connection would.
  await context.setOffline(true);
  api.state.failPuts = 503;
  await page.locator('#nl-name').fill('Typed offline');
  await page.waitForTimeout(1600);
  await expectVisible(page.getByText("You're offline. Your changes are kept on this device and will save when you're back online."), 'offline reason');
  api.state.failPuts = 0;
  await context.setOffline(false);
  await page.waitForTimeout(1200);
  expect(api.state.newsletters[0]?.name === 'Typed offline', 'saved by itself when back online');
  await expectVisible(savedText(page), 'Draft saved after reconnecting');
  await context.close();

  // 6. A new newsletter that never reached the server comes back too.
  ({ page, api, context } = await open({ width: 1280, height: 1200, api: createMockApi() }));
  await page.evaluate(() => {
    const draft = { name: '', subject: 'Typed before the first save', preview_text: '', from_name: '', reply_to_email: '', channels: ['email'], sms_text: '', template: 'basic', header: { logo_url: null, banner_url: null, background_color: '#6C60FF', title: null }, blocks: [], audience: [{ type: 'all_leads' }] };
    localStorage.setItem('stasht_nl_backup:1:new', JSON.stringify({ draft, savedAt: Date.now() - 60000, baseUpdatedAt: null }));
  });
  await page.reload();
  await expectVisible(page.getByRole('button', { name: 'Restore unsaved changes' }), 'restore offered for a new newsletter');
  await page.getByRole('button', { name: 'Dismiss' }).click();
  expect((await backupKeys(page)).length === 0, 'Dismiss forgets the copy');
  await context.close();

  // 7. Paused sending: plain words, the newsletter stays a draft.
  for (const [paused, words] of [['all', 'Newsletters are paused right now. Your draft is saved. Try again later.'], ['account', 'Sending is paused for your account. Contact support.']]) {
    const draft = newsletter(23, {
      name: 'October Newsletter 2026', subject: 'October deals are here', from_name: 'Serpa Chrysler', reply_to_email: 'sales@serpachrysler.ca',
      blocks: [{ id: 'b1', type: 'title', data: { text: 'This month', size: 'large' } }],
    });
    ({ page, api, context } = await open({ width: 1280, height: 1500, query: '&newsletterId=23', api: createMockApi({ newsletters: [draft], businessAddress: '4505 Steeles Ave W', sendPaused: paused }) }));
    await page.locator('#nl-name').waitFor();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /^Send now$/i }).last().click();
    const dialog = page.getByRole('dialog', { name: 'Send this newsletter now?' });
    await expectVisible(dialog, `confirm dialog (${paused})`);
    await page.waitForTimeout(700);
    await dialog.getByRole('button', { name: /^Send now$/i }).click();
    await expectVisible(page.getByText(words), `paused words (${paused})`);
    expect(api.state.newsletters[0]?.status === 'draft', `still a draft (${paused})`);
    expect(await page.locator('#nl-name').isEditable(), `still editable, not read-only (${paused})`);
    if (paused === 'all') await shot(page, '1280-04-paused');
    await context.close();
  }

  // 8. Phones: the notices fit.
  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 844, api: createMockApi({ failPuts: 500 }) });
    await phone.page.locator('#nl-name').fill('Phone check');
    await phone.page.waitForTimeout(1600);
    await expectVisible(phone.page.getByRole('alert').getByRole('button', { name: 'Try again' }), `Try again at ${width}`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll at ${width}`);
    if (width === 390) await shot(phone.page, '390-not-saved');
    await phone.context.close();
  }
}
