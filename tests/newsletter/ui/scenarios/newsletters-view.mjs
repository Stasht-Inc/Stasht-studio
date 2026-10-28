// Task 14: the Campaigns page opens on Newsletters (first on the switch, with counts); Storeels makes only the count call; → Newsletters: the All Campaigns list look
// with drafts, scheduled, sending and sent rows (chips, times, rates; out of sent for SendGrid-sent ones); a row
// opens its results; duplicate, cancel, delete, filter; a draft opens in the composer; a new newsletter shows up
// after it's saved; the empty state; Starter makes no newsletter calls; phones keep the sidebar toggle and never
// scroll sideways.
import { createMockApi, seedNewsletters } from '../mock-api.mjs';

// The switch's Newsletters count (GET /newsletters, paid plans) is the one call the Campaigns page itself makes.
const isCountCall = (c) => c.method === 'GET' && c.path === '/newsletters' && !/[?&]status=/.test(c.query || '');
const newsletterCalls = (api) => api.state.calls.filter((c) => /^\/(newsletter|contact-lists)/.test(c.path) && !isCountCall(c));
// Starter: not even the count.
const anyNewsletterCalls = (api) => api.state.calls.filter((c) => /^\/(newsletter|contact-lists)/.test(c.path));

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  let api = createMockApi({ newsletters: seedNewsletters() });
  let { page, context } = await open({ view: 'campaigns', width: 1280, height: 1000, api });
  await expectVisible(page.getByRole('radio', { name: /^Newsletters/, checked: true }), 'opens on Newsletters the first time');
  const order = await page.getByRole('radio').evaluateAll((els) => els.map((e) => e.textContent.trim()));
  expect(/^Newsletters\s*5$/.test(order[0] ?? '') && /^Storeels\s*\d+$/.test(order[1] ?? ''), `Newsletters first, both with counts (got ${JSON.stringify(order)})`);
  await shot(page, '1280-00a-switch-counts');
  await context.close();
  api = createMockApi({ newsletters: seedNewsletters() });
  ({ page, context } = await open({ view: 'campaigns', width: 1280, height: 1000, api, campaignsView: 'storeels' }));
  await expectVisible(page.getByRole('radio', { name: /^Storeels/, checked: true }), 'a remembered Storeels choice stands');
  await expectVisible(page.getByRole('heading', { name: 'All Campaigns' }), 'All Campaigns on Storeels');
  await page.waitForTimeout(1500);
  expect(newsletterCalls(api).length === 0, `Campaigns page load on Storeels makes no newsletter calls but the count (got ${newsletterCalls(api).map((c) => c.path).join(', ')})`);
  // The All Campaigns list view, to compare the Newsletters list with.
  await page.locator('button:has(svg.lucide-list)').first().click();
  await page.waitForTimeout(400);
  await shot(page, '1280-00-storeels-list');

  await page.getByRole('radio', { name: 'Newsletters' }).click();
  await expectVisible(page.getByRole('heading', { name: 'Newsletters', exact: true }), 'Newsletters view');
  for (const name of ['September recap', 'Winter tires', 'October Newsletter 2026', 'Service reminder', 'Open house this weekend']) {
    await expectVisible(page.getByRole('row', { name: new RegExp(name) }), `row "${name}"`);
  }
  const row = (name) => page.getByRole('row', { name: new RegExp(name) });
  await expectVisible(row('September recap').getByText('Sent', { exact: true }), 'Sent chip');
  await expectVisible(row('September recap').getByText('43%'), 'open rate 512 / 1,180');
  await expectVisible(row('Winter tires').getByText(/^Sends /), 'scheduled time');
  await expectVisible(row('Open house this weekend').getByText('Sending now'), 'sending row');
  await expectVisible(row('October Newsletter 2026').getByText('Draft', { exact: true }), 'draft row');
  await expectVisible(row('Service reminder').getByText('30%'), 'open rate out of sent when delivered is not reported');
  await expectVisible(page.locator('p:visible', { hasText: '5 newsletters' }), 'count under the title');
  await page.waitForTimeout(300);
  await shot(page, '1280-01-list');

  // A sent row opens its results.
  await row('September recap').getByRole('button', { name: /^September recap/ }).click();
  const drawer = page.getByRole('dialog', { name: 'September recap' });
  await expectVisible(drawer.getByText('43% of delivered'), 'results drawer from the list');
  await page.waitForTimeout(700);
  await shot(page, '1280-02-results');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await page.getByRole('button', { name: 'Actions for September recap', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expectVisible(page.getByText('Copied. The copy is a draft.'), 'duplicate toast');
  await expectVisible(page.getByRole('row', { name: /Copy of September recap/ }), 'copy listed (API names it "Copy of …")');

  await page.getByRole('button', { name: 'Actions for Winter tires', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Cancel sending' }).click();
  await page.getByRole('button', { name: 'Yes, cancel it' }).click();
  await expectVisible(page.getByText('Newsletter cancelled. Nothing more will be sent.'), 'cancel toast');
  await expectVisible(row('Winter tires').getByText('Cancelled', { exact: true }), 'row now Cancelled');

  await page.getByRole('button', { name: 'Actions for Copy of September recap', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
  await expectVisible(page.getByText('Newsletter deleted.'), 'delete toast');
  await page.waitForTimeout(300);
  expect(await page.getByRole('row', { name: /Copy of September recap/ }).count() === 0, 'deleted row gone');

  await page.getByRole('radio', { name: 'Drafts' }).click();
  await page.waitForTimeout(300);
  expect(api.state.calls.some((c) => c.path === '/newsletters' && c.query.includes('status=draft')), 'Drafts filter asks the API');
  expect(await page.getByRole('row', { name: /September recap/ }).count() === 0, 'only drafts listed');
  await page.getByRole('radio', { name: 'All' }).click();

  // A draft opens in the composer; closing saves; the list shows the change.
  await row('October Newsletter 2026').getByRole('button', { name: /^October Newsletter 2026/ }).click();
  await expectVisible(page.getByRole('heading', { name: 'Create Campaign' }), 'composer opened for the draft');
  await page.waitForTimeout(800);
  expect(await page.locator('#nl-name').inputValue() === 'October Newsletter 2026', 'draft loaded into the composer');
  await page.locator('#nl-subject').fill('October deals are here!');
  await page.getByRole('button', { name: 'Cancel' }).first().click();
  await expectVisible(page.getByRole('heading', { name: 'Newsletters', exact: true }), 'back on the list');
  expect(api.state.newsletters.find((n) => n.id === 23)?.subject === 'October deals are here!', 'closing saved the edit');
  await expectVisible(page.getByText('October deals are here!'), 'list shows the saved subject');

  // A new newsletter shows up once it's saved.
  await page.getByRole('button', { name: 'Create a Newsletter' }).click();
  await expectVisible(page.getByRole('heading', { name: 'Create Campaign' }), 'composer for a new newsletter');
  await expectVisible(page.getByRole('radio', { name: 'Newsletter', checked: true }), 'Newsletter tab chosen');
  await page.locator('#nl-name').fill('Black Friday preview');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Cancel' }).first().click();
  await expectVisible(page.getByRole('row', { name: /Black Friday preview/ }), 'new draft listed');
  await context.close();

  // Empty state.
  api = createMockApi({ newsletters: [] });
  ({ page, context } = await open({ view: 'campaigns', width: 1280, height: 900, api }));
  await page.getByRole('radio', { name: 'Newsletters' }).click();
  await expectVisible(page.getByText('No newsletters yet'), 'empty state');
  await expectVisible(page.getByRole('button', { name: 'Create your first newsletter' }), 'empty state action');
  await page.waitForTimeout(300);
  await shot(page, '1280-03-empty');
  await context.close();

  // Starter: the upgrade card, and not one newsletter call (even after choosing Newsletters).
  api = createMockApi({ plan: 'Starter', newsletters: seedNewsletters() });
  ({ page, context } = await open({ view: 'campaigns', width: 1280, height: 900, api }));
  await page.getByRole('radio', { name: 'Newsletters' }).click();
  await expectVisible(page.getByText('Newsletters are part of paid plans'), 'Starter card');
  await page.waitForTimeout(1200);
  expect(anyNewsletterCalls(api).length === 0, `Starter makes no newsletter calls (got ${anyNewsletterCalls(api).map((c) => c.path).join(', ')})`);
  await shot(page, '1280-04-starter');
  await context.close();

  // Phones.
  for (const width of [360, 375, 390]) {
    api = createMockApi({ newsletters: seedNewsletters() });
    ({ page, context } = await open({ view: 'campaigns', width, height: 844, api, campaignsView: 'storeels' }));
    await expectVisible(page.getByRole('heading', { name: 'All Campaigns' }), `Storeels at ${width}`);
    await page.waitForTimeout(800);
    expect(!(await hasOverflow(page)), `no sideways scroll on Storeels at ${width}`);
    if (width === 390) await shot(page, '390-00-storeels');
    await page.getByRole('radio', { name: 'Newsletters' }).click();
    await expectVisible(page.getByRole('listitem').getByText('September recap'), `newsletters listed at ${width}`);
    await expectVisible(page.getByRole('button', { name: 'Open sidebar' }), `sidebar toggle kept at ${width}`);
    expect(!(await hasOverflow(page)), `no sideways scroll on Newsletters at ${width}`);
    if (width === 390) {
      await page.waitForTimeout(300);
      await shot(page, '390-01-list');
      await page.getByRole('listitem').getByRole('button', { name: /^September recap/ }).click();
      await expectVisible(page.getByRole('dialog', { name: 'September recap' }).getByText('43% of delivered'), 'results at 390');
      await page.waitForTimeout(700);
      expect(!(await hasOverflow(page)), 'no sideways scroll in results at 390');
      await shot(page, '390-02-results');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      await page.getByRole('button', { name: 'Open sidebar' }).click();
      await expectVisible(page.getByText('Campaigns Library'), 'sidebar opens from the Newsletters view');
    }
    await context.close();
  }

  for (const width of [390]) {
    api = createMockApi({ newsletters: [] });
    ({ page, context } = await open({ view: 'campaigns', width, height: 844, api }));
    await page.getByRole('radio', { name: 'Newsletters' }).click();
    await expectVisible(page.getByText('No newsletters yet'), 'empty state at 390');
    expect(!(await hasOverflow(page)), 'no sideways scroll on the empty state at 390');
    await shot(page, '390-03-empty');
    await context.close();
    api = createMockApi({ plan: 'Starter' });
    ({ page, context } = await open({ view: 'campaigns', width, height: 844, api }));
    await page.getByRole('radio', { name: 'Newsletters' }).click();
    await expectVisible(page.getByText('Newsletters are part of paid plans'), 'Starter at 390');
    expect(!(await hasOverflow(page)), 'no sideways scroll on Starter at 390');
    await shot(page, '390-04-starter');
    await context.close();
  }
}
