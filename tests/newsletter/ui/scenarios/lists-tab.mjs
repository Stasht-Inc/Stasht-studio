// Lists management on the Leads page (Chris, 28 Oct 2026): the Leads | Lists | Groups | My Conversations row, the
// lists table, and inside one list: search, filter, add / edit / remove people, bulk remove, copy to another list,
// import into the list, export, duplicate, rename and delete. Starter makes no list calls at all.
import { mkdirSync, writeFileSync } from 'fs';
import { createMockApi, newsletter } from '../mock-api.mjs';

const DIR = '/private/tmp/claude-501/newsletters-ui';
const NEW_CSV = `${DIR}/royalwood-subscribers.csv`;
const MERGE_CSV = `${DIR}/more-sign-ups.csv`;

const LISTS = () => [
  { id: 9, name: 'Open house sign-ups', source: 'import', member_count: 212, email_count: 159, sms_count: 70, unsubscribed_count: 16, consent_type: 'express', created_at: '2026-10-02T15:00:00Z', updated_at: '2026-10-20T15:00:00Z' },
  { id: 11, name: 'Spring buyers', source: 'leads', member_count: 30, email_count: 23, sms_count: 10, unsubscribed_count: 1, consent_type: 'implied', created_at: '2026-09-20T15:00:00Z', updated_at: '2026-09-20T15:00:00Z' },
];
// A scheduled newsletter still needs Spring buyers: deleting it answers 409.
const NEWSLETTERS = () => [
  newsletter(22, { name: 'Spring offers', status: 'scheduled', scheduled_at: new Date(Date.now() + 2 * 86400000).toISOString(), audience: [{ type: 'list', id: 11 }] }),
];

const listCalls = (api) => api.state.calls.filter((c) => c.path.startsWith('/contact-lists') || c.path.startsWith('/newsletter'));

/** The harness's toasts sit top right, over the list's buttons at 1280: wait until they have gone. */
async function toastsGone(page) {
  for (let i = 0; i < 40 && (await page.locator('[data-sonner-toast]').count()); i++) await page.waitForTimeout(250);
}

/** The Leads | Lists | Groups | My Conversations row, as the labels read (badges included). */
async function tabRow(page) {
  return page.evaluate(() => {
    const leads = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Leads');
    return leads ? [...leads.parentElement.children].map((b) => b.textContent.trim()) : [];
  });
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  mkdirSync(DIR, { recursive: true });
  // A Mailchimp export: its headers are recognised by lib/csv.ts.
  writeFileSync(NEW_CSV, 'Email Address,First Name,Last Name,Phone Number\nava@example.com,Ava,Chen,+1 416 555 0101\nben@example.com,Ben,Ortiz,\n,,,\n');
  // Into Open house sign-ups: Contact 4 is on it with only a mobile number (the file fills in the email), Contact 1
  // is on it already (nothing to fill: "already on the list"), Dee is new and in the file twice, and one row has nothing usable.
  writeFileSync(MERGE_CSV, 'Name,Email,Mobile\nContact Four,contact4@new.example.com,+1 416 555 1004\nContact One,contact1@example.com,\nDee Park,dee@example.com,\nDee Park,dee@example.com,\nNobody,,\n');

  // ── Starter: the upgrade card, and not one list or newsletter call (no badge either) ──
  {
    const api = createMockApi({ plan: 'Starter', lists: LISTS() });
    const { page, context } = await open({ view: 'leads', width: 1280, height: 900, api });
    await expectVisible(page.getByRole('button', { name: 'Groups' }), 'Starter: tab row');
    await page.waitForTimeout(800);
    expect(JSON.stringify(await tabRow(page)) === JSON.stringify(['Leads', 'Lists', 'Groups1', 'My Conversations']), `Starter: no lists badge (got ${JSON.stringify(await tabRow(page))})`);
    await page.getByRole('button', { name: 'Lists', exact: true }).click();
    await expectVisible(page.getByText('Lists are part of paid plans'), 'Starter: upgrade card');
    await page.waitForTimeout(800);
    expect(listCalls(api).length === 0, `Starter makes no list calls (got ${JSON.stringify(listCalls(api).map((c) => c.path))})`);
    await shot(page, '1280-00-starter');
    await context.close();
  }

  const api = createMockApi({ lists: LISTS(), newsletters: NEWSLETTERS() });
  const { page, context } = await open({ view: 'leads', width: 1280, height: 1000, api });

  // ── Tab row: Leads | Lists | Groups | My Conversations, Lists with its count ──
  await expectVisible(page.getByRole('button', { name: /^Lists/ }), 'Lists tab');
  await expectVisible(page.getByRole('button', { name: /^Lists/ }).getByText('2'), 'lists badge');
  expect(JSON.stringify(await tabRow(page)) === JSON.stringify(['Leads', 'Lists2', 'Groups1', 'My Conversations']), `tab order (got ${JSON.stringify(await tabRow(page))})`);
  await shot(page, '1280-01-tab-row');

  // ── Lists table ──
  await page.getByRole('button', { name: /^Lists/ }).click();
  await expectVisible(page.getByText('Total lists'), 'summary cards');
  await expectVisible(page.getByRole('cell', { name: 'Open house sign-ups' }), 'lists table');
  await expectVisible(page.getByRole('cell', { name: 'Made from leads' }), 'source label');
  await expectVisible(page.getByRole('cell', { name: 'Oct 20, 2026' }), 'updated date');
  const cards = await page.locator('p:text-is("Total people") + p').innerText().catch(() => '');
  expect(cards === '242', `total people card (got ${cards})`);
  await shot(page, '1280-02-lists');

  // ── Create an empty list: it opens, ready for people ──
  await page.getByRole('button', { name: 'Create list' }).click();
  let dialog = page.getByRole('dialog', { name: 'Create a list' });
  await dialog.getByLabel('List name').fill('VIP open house');
  await dialog.getByRole('button', { name: 'Create list' }).click();
  await expectVisible(page.getByRole('heading', { name: 'VIP open house' }), 'new list opens');
  await expectVisible(page.getByText('Nobody is on this list yet'), 'empty list');
  const create = api.state.calls.find((c) => c.method === 'POST' && c.path === '/contact-lists');
  expect(create?.body?.name === 'VIP open house' && create?.status === 201, `create body (got ${JSON.stringify(create)})`);
  await page.getByRole('button', { name: 'All lists' }).click();
  await expectVisible(page.getByRole('button', { name: /^Lists/ }).getByText('3'), 'badge counts the new list');

  // ── Import CSV → a new list ──
  await page.getByRole('button', { name: 'Import CSV' }).click();
  dialog = page.getByRole('dialog', { name: 'Add a list' });
  await dialog.getByTestId('nl-csv-input').setInputFiles(NEW_CSV);
  await expectVisible(dialog.getByText(/2 contacts ready to import\./), 'Mailchimp file read');
  await dialog.getByRole('radio', { name: /signed up or asked/ }).check();
  await dialog.getByRole('button', { name: 'Import 2 contacts' }).click();
  await expectVisible(page.getByText('Imported 2 contacts.').first(), 'import toast');
  await expectVisible(page.getByRole('cell', { name: 'royalwood subscribers' }), 'imported list in the table');

  // ── Open a list: people, newest first, with status chips and counts ──
  await page.getByRole('button', { name: 'Open house sign-ups', exact: true }).click();
  await expectVisible(page.getByRole('heading', { name: 'Open house sign-ups' }), 'list detail');
  await expectVisible(page.getByRole('cell', { name: 'Contact 1', exact: true }), 'people table');
  await expectVisible(page.getByText('Page 1 of 5'), 'pages');
  await expectVisible(page.getByRole('radio', { name: /Unsubscribed\s*\d+/ }), 'filter counts');
  await expectVisible(page.getByText('Express, May 1, 2026').first(), 'how they agreed');
  await shot(page, '1280-03-list-detail');

  // Search (debounced): one request with the words, not one per key.
  const before = api.state.calls.length;
  await page.getByLabel('Search people on this list').pressSequentially('contact13@', { delay: 20 });
  await page.waitForTimeout(900);
  await expectVisible(page.getByRole('cell', { name: 'contact13@example.com' }), 'search result');
  expect(await page.locator('tbody tr').count() === 1, `only the match shows (got ${await page.locator('tbody tr').count()})`);
  const searches = api.state.calls.slice(before).filter((c) => c.path === '/contact-lists/9/members');
  expect(searches.length === 1 && searches[0].query.includes('search=contact13%40'), `one debounced search (got ${JSON.stringify(searches.map((c) => c.query))})`);
  await page.getByLabel('Search people on this list').fill('');
  await page.getByLabel('Search people on this list').press('Enter');

  // Filter: Unsubscribed only.
  await page.getByRole('radio', { name: /^Unsubscribed/ }).click();
  await expectVisible(page.getByText('Email: unsubscribed').first(), 'unsubscribed people');
  const filter = api.state.calls.filter((c) => c.path === '/contact-lists/9/members').pop();
  expect(filter?.query.includes('status=unsubscribed'), `status filter sent (got ${filter?.query})`);
  expect(await page.locator('tbody tr').filter({ hasNotText: /unsubscribed|bounced|stopped/i }).count() === 0, 'only unsubscribed people show');
  await page.getByRole('radio', { name: /^All/ }).click();
  await expectVisible(page.getByText('Page 1 of 5'), 'all again');

  // ── Add a person: someone already on the list → the API's 409 words; then someone new ──
  await page.getByRole('button', { name: 'Add person' }).click();
  dialog = page.getByRole('dialog', { name: 'Add a person' });
  await dialog.getByLabel('Name').fill('Jane Doe');
  await dialog.getByLabel('Email').fill('contact1@example.com');
  await dialog.getByRole('button', { name: 'Add person' }).click();
  await expectVisible(dialog.getByText('Choose how this person agreed to hear from you.'), 'consent required');
  expect(!api.state.calls.some((c) => c.method === 'POST' && c.path === '/contact-lists/9/members'), 'nothing sent without consent');
  await dialog.getByRole('radio', { name: /signed up or asked/ }).check();
  await dialog.getByRole('button', { name: 'Add person' }).click();
  await expectVisible(dialog.getByText('This person is already on this list.'), '409 duplicate message');
  await shot(page, '1280-04-add-person');
  await dialog.getByLabel('Email').fill('jane.doe@example.com');
  await dialog.getByLabel('Mobile').fill('+1 416 555 0177');
  await dialog.getByRole('button', { name: 'Add person' }).click();
  await expectVisible(page.getByText('Added Jane Doe to the list.'), 'added toast');
  const add = api.state.calls.filter((c) => c.method === 'POST' && c.path === '/contact-lists/9/members').pop();
  expect(add?.status === 201 && add.body.email === 'jane.doe@example.com' && add.body.consent_type === 'express' && add.body.name === 'Jane Doe', `add body (got ${JSON.stringify(add?.body)})`);
  await expectVisible(page.getByRole('cell', { name: 'Jane Doe' }), 'new person on top');

  // ── Edit ──
  await page.getByRole('button', { name: 'Actions for Jane Doe' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  dialog = page.getByRole('dialog', { name: 'Edit person' });
  await dialog.getByLabel('Name').fill('Jane Doe-Smith');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expectVisible(page.getByRole('cell', { name: 'Jane Doe-Smith' }), 'edited name');
  const patch = api.state.calls.find((c) => c.method === 'PATCH' && /\/contact-lists\/9\/members\/\d+$/.test(c.path));
  expect(patch?.body?.name === 'Jane Doe-Smith' && patch?.body?.email === 'jane.doe@example.com', `edit body (got ${JSON.stringify(patch?.body)})`);

  // ── Remove one ──
  await page.getByRole('button', { name: 'Actions for Jane Doe-Smith' }).click();
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  dialog = page.getByRole('dialog', { name: 'Remove Jane Doe-Smith?' });
  await expectVisible(dialog.getByText(/deleted for good/), 'remove asks first');
  await dialog.getByRole('button', { name: 'Remove' }).click();
  await expectVisible(page.getByText('Removed Jane Doe-Smith from the list.'), 'removed toast');
  let remove = api.state.calls.filter((c) => c.path === '/contact-lists/9/members/remove').pop();
  expect(remove?.body?.ids?.length === 1, `remove one (got ${JSON.stringify(remove?.body)})`);

  // ── Bulk remove ──
  await page.locator('input[aria-label="Choose Contact 2"]:visible').check();
  await page.locator('input[aria-label="Choose Contact 3"]:visible').check();
  await expectVisible(page.getByText('2 chosen'), 'bulk bar');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Remove 2 people?' });
  await dialog.getByRole('button', { name: 'Remove' }).click();
  await expectVisible(page.getByText('Removed 2 people from the list.'), 'bulk removed toast');
  remove = api.state.calls.filter((c) => c.path === '/contact-lists/9/members/remove').pop();
  expect(remove?.body?.ids?.length === 2, `remove two (got ${JSON.stringify(remove?.body)})`);
  expect(api.state.lists.find((l) => l.id === 9)?.member_count === 210, `two fewer after Jane came and went (got ${api.state.lists.find((l) => l.id === 9)?.member_count})`);
  await expectVisible(page.getByText(/^210 people/), 'header count updated');

  // ── Copy to another list ──
  await page.locator('input[aria-label="Choose Contact 4"]:visible').check();
  await page.locator('input[aria-label="Choose Contact 5"]:visible').check();
  await page.getByRole('button', { name: 'Copy to list…' }).click();
  dialog = page.getByRole('dialog', { name: 'Copy to another list' });
  await dialog.getByRole('radio', { name: /VIP open house/ }).check();
  await dialog.getByRole('button', { name: 'Copy 2 people' }).click();
  await expectVisible(page.getByText('Copied to “VIP open house”. Added 2.'), 'copy toast');
  const copy = api.state.calls.find((c) => c.path === '/contact-lists/9/members/copy');
  const vip = api.state.lists.find((l) => l.name === 'VIP open house');
  expect(copy?.body?.ids?.length === 2 && copy?.body?.target_list_id === vip?.id, `copy body (got ${JSON.stringify(copy?.body)})`);
  expect(vip?.member_count === 2, 'target list has them');
  // The same two again: already on that list.
  await toastsGone(page);
  await page.locator('input[aria-label="Choose Contact 4"]:visible').check();
  await page.locator('input[aria-label="Choose Contact 5"]:visible').check();
  await page.getByRole('button', { name: 'Copy to list…' }).click();
  dialog = page.getByRole('dialog', { name: 'Copy to another list' });
  await dialog.getByRole('radio', { name: /VIP open house/ }).check();
  await dialog.getByRole('button', { name: 'Copy 2 people' }).click();
  await expectVisible(page.getByText('Everyone you chose is already on “VIP open house”.'), 'copy again: already there');

  // ── Import into this list (merge) ──
  await page.getByRole('button', { name: 'Import into this list' }).click();
  dialog = page.getByRole('dialog', { name: 'Import into “Open house sign-ups”' });
  expect(await dialog.getByLabel('List name').count() === 0, 'no list name when adding to a list');
  await dialog.getByTestId('nl-csv-input').setInputFiles(MERGE_CSV);
  await dialog.getByRole('radio', { name: /customers or enquired/ }).check();
  await dialog.getByRole('button', { name: 'Import 4 contacts' }).click();
  await expectVisible(page.getByText('Added 1, updated 1, skipped 1, 1 already on the list.'), 'merge result toast');
  const merge = api.state.calls.find((c) => c.path === '/contact-lists/9/import');
  expect(merge?.body?.consent === true && merge?.body?.consent_type === 'implied' && merge?.body?.rows?.length === 4 && !('name' in merge.body), `merge body (got ${JSON.stringify(merge?.body)})`);
  await expectVisible(page.getByRole('cell', { name: 'Dee Park' }), 'merged person shows');
  await expectVisible(page.getByRole('cell', { name: 'contact4@new.example.com' }), 'missing email filled in');

  // The same file again: nobody new, nothing to fill (the duplicate row is skipped) …
  await toastsGone(page);
  await page.getByRole('button', { name: 'Import into this list' }).click();
  dialog = page.getByRole('dialog', { name: 'Import into “Open house sign-ups”' });
  await dialog.getByTestId('nl-csv-input').setInputFiles(MERGE_CSV);
  await dialog.getByRole('radio', { name: /customers or enquired/ }).check();
  await dialog.getByRole('button', { name: 'Import 4 contacts' }).click();
  await expectVisible(page.getByText('Everyone in this file is already on the list. Skipped 1.'), 'second import result');
  // … and a file of people all already on it says so plainly.
  await toastsGone(page);
  writeFileSync(`${DIR}/already-there.csv`, 'Email\ncontact1@example.com\ndee@example.com\n');
  await page.getByRole('button', { name: 'Import into this list' }).click();
  dialog = page.getByRole('dialog', { name: 'Import into “Open house sign-ups”' });
  await dialog.getByTestId('nl-csv-input').setInputFiles(`${DIR}/already-there.csv`);
  await dialog.getByRole('radio', { name: /customers or enquired/ }).check();
  await dialog.getByRole('button', { name: 'Import 2 contacts' }).click();
  await expectVisible(page.getByText('Everyone in this file is already on the list.', { exact: true }), 'nothing-new import result');

  // ── Export CSV: an authenticated request, and a download named by the API ──
  await toastsGone(page);
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
  const exp = api.state.calls.find((c) => c.path === '/contact-lists/9/export');
  expect(exp?.method === 'GET', 'export asked for');
  expect(/^open-house-sign-ups-\d{4}-\d{2}-\d{2}\.csv$/.test(file.suggestedFilename()), `download name (got ${file.suggestedFilename()})`);
  const saved = `${DIR}/lists-export.csv`;
  await file.saveAs(saved);
  const { readFileSync } = await import('fs');
  const text = readFileSync(saved, 'utf8');
  expect(text.startsWith('﻿Name,Email,Mobile,Email status,Text status,Consent,Consent note,Consent date,Added'), `CSV header (got ${JSON.stringify(text.slice(0, 80))})`);
  await expectVisible(page.getByText(/^Downloaded open-house-sign-ups-/), 'download toast');

  // ── Duplicate, rename, delete (the list's More menu) ──
  await page.getByRole('menu').waitFor({ state: 'detached' }).catch(() => {});
  await page.getByRole('button', { name: 'More list actions' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expectVisible(page.getByText('Made a copy: “Open house sign-ups (copy)”.'), 'duplicate toast');
  expect(api.state.calls.some((c) => c.method === 'POST' && c.path === '/contact-lists/9/duplicate'), 'duplicate asked for');

  await page.getByRole('menu').waitFor({ state: 'detached' }).catch(() => {});
  await page.getByRole('button', { name: 'More list actions' }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  dialog = page.getByRole('dialog', { name: 'Rename list' });
  await dialog.getByLabel('List name').fill('Open house 2026');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expectVisible(page.getByRole('heading', { name: 'Open house 2026' }), 'renamed');
  const rename = api.state.calls.find((c) => c.method === 'PATCH' && c.path === '/contact-lists/9');
  expect(rename?.body?.name === 'Open house 2026', `rename body (got ${JSON.stringify(rename?.body)})`);

  await page.getByRole('menu').waitFor({ state: 'detached' }).catch(() => {});
  await page.getByRole('button', { name: 'More list actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete list' }).click();
  dialog = page.getByRole('dialog', { name: 'Delete “Open house 2026”?' });
  await dialog.getByRole('button', { name: 'Delete list' }).click();
  await expectVisible(page.getByText('Deleted the list “Open house 2026”.'), 'deleted toast');
  await expectVisible(page.getByRole('cell', { name: 'Spring buyers' }), 'back to all lists');

  // A list a scheduled newsletter uses can't go: the API's 409 words, and it stays.
  await page.getByRole('button', { name: 'Actions for Spring buyers' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  dialog = page.getByRole('dialog', { name: 'Delete “Spring buyers”?' });
  await dialog.getByRole('button', { name: 'Delete list' }).click();
  await expectVisible(dialog.getByText('This list is used by a scheduled newsletter. Cancel it first.'), '409 delete message');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(api.state.lists.some((l) => l.id === 11), 'list in use kept');

  // Row menu → Export CSV from the table too.
  await toastsGone(page);
  const [file2] = await Promise.all([
    page.waitForEvent('download'),
    (async () => { await page.getByRole('button', { name: 'Actions for Spring buyers' }).click(); await page.getByRole('menuitem', { name: 'Export CSV' }).click(); })(),
  ]);
  expect(/^spring-buyers-/.test(file2.suggestedFilename()), `table export name (got ${file2.suggestedFilename()})`);
  await context.close();

  // ── Phones: the four tabs fit, nothing scrolls sideways ──
  for (const width of [360, 375, 390]) {
    const phone = await open({ view: 'leads', width, height: 844, api: createMockApi({ lists: LISTS(), newsletters: NEWSLETTERS() }) });
    const p = phone.page;
    await expectVisible(p.getByRole('button', { name: /^Lists/ }).getByText('2'), `badge at ${width}`);
    const fits = await p.evaluate(() => {
      const leads = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Leads');
      const row = leads?.parentElement;
      if (!row) return false;
      const box = row.getBoundingClientRect();
      return row.scrollWidth <= row.clientWidth + 1 && [...row.children].every((b) => { const r = b.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1 && r.height >= 40; });
    });
    expect(fits, `four tabs fit (40 px tall) at ${width}`);
    expect(!(await hasOverflow(p)), `no sideways scroll on Leads at ${width}`);
    if (width === 390) await shot(p, '390-01-tab-row');
    await p.getByRole('button', { name: /^Lists/ }).click();
    await expectVisible(p.getByRole('button', { name: /Open house sign-ups/ }).first(), `list cards at ${width}`);
    expect(!(await hasOverflow(p)), `no sideways scroll on Lists at ${width}`);
    if (width === 390) await shot(p, '390-02-lists');
    if (process.env.NL_VIEWPORT_SHOTS) await p.screenshot({ path: `${process.env.NL_VIEWPORT_SHOTS}/lists-${width}.png` });
    await p.getByRole('button', { name: /Open house sign-ups/ }).first().click();
    await expectVisible(p.getByRole('heading', { name: 'Open house sign-ups' }), `list detail at ${width}`);
    await expectVisible(p.locator('li:visible', { hasText: 'contact1@example.com' }), `people cards at ${width}`);
    expect(!(await hasOverflow(p)), `no sideways scroll in a list at ${width}`);
    if (width === 390) await shot(p, '390-03-list-detail');
    if (process.env.NL_VIEWPORT_SHOTS) await p.screenshot({ path: `${process.env.NL_VIEWPORT_SHOTS}/detail-${width}.png` });
    await p.locator('input[aria-label="Choose Contact 2"]:visible').check();
    await expectVisible(p.getByText('1 chosen'), `bulk bar at ${width}`);
    expect(!(await hasOverflow(p)), `no sideways scroll with people chosen at ${width}`);
    if (width === 390) await shot(p, '390-04-chosen');
    if (process.env.NL_VIEWPORT_SHOTS) await p.screenshot({ path: `${process.env.NL_VIEWPORT_SHOTS}/chosen-${width}.png` });
    await p.getByRole('button', { name: 'Add person' }).click();
    await expectVisible(p.getByRole('dialog', { name: 'Add a person' }), `add person at ${width}`);
    expect(!(await hasOverflow(p)), `no sideways scroll in Add a person at ${width}`);
    if (width === 390) await shot(p, '390-05-add-person');
    if (process.env.NL_VIEWPORT_SHOTS) await p.screenshot({ path: `${process.env.NL_VIEWPORT_SHOTS}/add-${width}.png` });
    await phone.context.close();
  }
}
