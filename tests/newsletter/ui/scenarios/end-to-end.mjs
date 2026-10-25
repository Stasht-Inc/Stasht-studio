// Task 15: one account, the whole journey, at 1280 and at 390: Campaigns → Create a Campaign (Newsletter is the
// default tab) → all six steps (a lead group, an imported CSV list, email and text, header, every section type) →
// exact email → a test by text → schedule (address on the first send) → Newsletters view lists it as Scheduled →
// results of a sent one → cancel the scheduled one → duplicate → delete. Plus: the Storeel tab still creates a
// Storeel; the Storeel limit shows on the Storeel tab only; Starter gets the upgrade card and makes no newsletter
// calls; page-wide checks (16 px root font, every composer control labelled, no sideways scroll at 360/375/390).
import { mkdirSync, writeFileSync } from 'fs';
import { createMockApi, seedNewsletters } from '../mock-api.mjs';

const FILE = new URL('../../../../public/pwa-icon-192.png', import.meta.url).pathname;
const DIR = '/private/tmp/claude-501/newsletters-ui';
const CSV = `${DIR}/winter-event.csv`;
const newsletterCalls = (api) => api.state.calls.filter((c) => /^\/(newsletter|contact-lists)/.test(c.path));

function tomorrow() {
  const t = new Date(Date.now() + 24 * 3600 * 1000);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** The Create a Campaign button on the Storeels view ("Create" on phones). */
const createButton = (page, phone) => (phone
  ? page.getByRole('button', { name: 'Create', exact: true })
  : page.getByRole('button', { name: 'Create a Campaign' })).first();

async function journey({ open, shot, expectVisible, expect, hasOverflow }, width) {
  const phone = width < 768;
  const tag = String(width);
  const NAME = `November Newsletter ${width}`;
  const api = createMockApi({ newsletters: seedNewsletters() });
  const { page, context } = await open({ view: 'campaigns', width, height: phone ? 844 : 1100, api, timezoneId: 'America/Toronto' });
  const rootFont = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  expect(rootFont === '16px', `root font size is 16px at ${tag} (got ${rootFont})`);
  await expectVisible(page.getByRole('heading', { name: 'All Campaigns' }), `Campaigns page at ${tag}`);
  await page.waitForTimeout(800);
  expect(newsletterCalls(api).length === 0, `opening Campaigns makes no newsletter calls at ${tag}`);

  // Create a Campaign opens on the Newsletter tab.
  await createButton(page, phone).click();
  await expectVisible(page.getByRole('radio', { name: 'Newsletter', exact: true, checked: true }), `Create Campaign opens on Newsletter at ${tag}`);
  const preview = page.locator('aside');
  await expectVisible(preview.getByText('Serpa Chrysler').first(), `brand header at ${tag}`);

  // 1 Campaign name
  await page.locator('#nl-name').fill(NAME);

  // 2 Recipients: a lead group, an imported CSV list, and text messages too.
  const step2 = page.locator('#nl-step-recipients');
  await step2.scrollIntoViewIfNeeded();
  await step2.getByRole('button', { name: /Send to/ }).click();
  await page.getByRole('checkbox', { name: /VIP buyers/ }).check();
  await page.getByRole('button', { name: 'Add a list' }).click();
  const importDialog = page.getByRole('dialog', { name: 'Add a list' });
  await importDialog.getByTestId('nl-csv-input').setInputFiles(CSV);
  await expectVisible(importDialog.getByText(/3 contacts ready to import\./), `CSV preview at ${tag}`);
  await importDialog.getByLabel('List name').fill('Winter event sign-ups');
  await importDialog.getByRole('radio', { name: /signed up or asked to hear from us/ }).check();
  expect(!(await hasOverflow(page)), `no sideways scroll in the import dialog at ${tag}`);
  await importDialog.getByRole('button', { name: 'Import 3 contacts' }).click();
  await expectVisible(page.getByText('Imported 3 contacts.'), `import toast at ${tag}`);
  // Importing closes the dialog and the Send to list, with the new list ticked.
  await expectVisible(step2.getByText('All leads + 2 more').first(), `Send to summary at ${tag}`);
  await step2.getByRole('checkbox', { name: /Text message/ }).check();
  await step2.getByLabel('Text message', { exact: true }).fill('November deals are here.');

  // 3 From, 4 Subject
  await page.locator('#nl-from-name').fill('Serpa Chrysler');
  await page.locator('#nl-reply-to').fill('sales@serpachrysler.ca');
  await page.locator('#nl-subject').fill('November deals are here');
  await page.locator('#nl-preview-text').fill('Winter tires and service specials');
  await expectVisible(preview.getByText('November deals are here').first(), `subject in the inbox row at ${tag}`);

  // 5 Content: the header and one of every section.
  await preview.getByRole('group', { name: 'Header' }).click();
  await preview.getByLabel('Header title').fill('Serpa Chrysler Jeep');
  await preview.getByTestId('nl-logo-input').setInputFiles(FILE);
  await preview.getByRole('button', { name: 'Add a section at the top' }).click();
  await page.getByRole('menuitem', { name: /^Image/ }).click();
  await preview.getByTestId(/-image-input$/).first().setInputFiles(FILE);
  await expectVisible(preview.locator('img[src^="https://127.0.0.1/nl-img/"]').nth(1), `image section uploaded at ${tag}`);
  const addAfter = async (n, item) => {
    await preview.getByRole('button', { name: `Add a section after section ${n}` }).click();
    await page.getByRole('menuitem', { name: new RegExp(`^${item}`) }).click();
  };
  await addAfter(1, 'Title');
  await preview.getByLabel('Title', { exact: true }).fill('Winter is coming');
  await addAfter(2, 'Text');
  await preview.getByRole('textbox', { name: 'Text', exact: true }).click();
  await page.keyboard.type('Book your winter tire swap this week.');
  await addAfter(3, 'YouTube');
  await preview.getByLabel('YouTube link').fill('https://youtu.be/dQw4w9WgXcQ');
  await addAfter(4, 'Button');
  await preview.getByLabel('Button text').fill('Book now');
  await preview.getByLabel('Opens this link').fill('serpachrysler.ca/service');
  await preview.getByLabel('Button text').click();
  await addAfter(5, 'Divider');
  expect(!(await hasOverflow(page)), `no sideways scroll with every section at ${tag}`);
  await page.waitForTimeout(1500); // autosave
  await shot(page, `${tag}-01-composed`);
  if (phone) {
    await page.setViewportSize({ width, height: 5200 });
    await page.waitForTimeout(300);
    await shot(page, `${tag}-01b-composed-full`);
    await page.setViewportSize({ width, height: 844 });
  }

  // Every control in the composer has a label.
  const unlabeled = await page.evaluate(() => {
    const root = document.querySelector('[role="dialog"]') ?? document.body;
    return Array.from(root.querySelectorAll('input:not([type="hidden"]):not([type="file"]), textarea, select, [contenteditable="true"]'))
      .filter((el) => el.offsetParent !== null && !(el.labels && el.labels.length) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby'))
      .map((el) => el.outerHTML.slice(0, 120));
  });
  expect(unlabeled.length === 0, `every composer control has a label at ${tag} (${unlabeled.join(' | ')})`);

  // The exact email, and a test by text.
  await page.getByRole('button', { name: 'Preview exact email' }).click();
  await expectVisible(page.frameLocator('iframe[title="Exact email preview"]').locator('#mock-preview-title'), `exact email at ${tag}`);
  expect(!(await hasOverflow(page)), `no sideways scroll in the exact email at ${tag}`);
  await page.waitForTimeout(300);
  await shot(page, `${tag}-02-exact-email`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Send a test to me' }).click();
  await page.getByRole('menuitem', { name: 'Text me a test' }).click();
  await expectVisible(page.getByText('Test sent to +1 416 555 0100.', { exact: true }), `text test sent at ${tag}`);

  // 6 Schedule for tomorrow 09:30 Toronto time (texts only go out 8am to 9pm there); the confirmation has the counts, the allowance and asks for the address.
  const list = api.state.lists.find((l) => l.name === 'Winter event sign-ups');
  const emails = 1180 + 36 + (list?.email_count ?? 0);
  const texts = 310 + 30 + (list?.sms_count ?? 0);
  await page.getByRole('radio', { name: 'Schedule for later' }).check();
  await page.getByLabel('Date', { exact: true }).fill(tomorrow());
  await page.getByLabel('Time', { exact: true }).fill('09:30');
  await page.waitForTimeout(800); // counts are debounced
  await page.getByRole('button', { name: 'Schedule', exact: true }).last().click();
  const dialog = page.getByRole('dialog', { name: 'Schedule this newsletter?' });
  await expectVisible(dialog.getByText(`${emails.toLocaleString('en-US')} people`), `email count (all leads + VIP buyers + the list) at ${tag}`);
  await expectVisible(dialog.getByText(`${texts.toLocaleString('en-US')} people`), `text count at ${tag}`);
  await expectVisible(dialog.getByText(/Your plan has 3,800 emails and 460 text message parts left this month/), `allowance at ${tag}`);
  await expectVisible(dialog.getByText(/It goes out .*9:30/), `the time at ${tag}`);
  await dialog.getByLabel('Business address').fill('4505 Steeles Ave W, Toronto, ON');
  expect(!(await hasOverflow(page)), `no sideways scroll in the confirmation at ${tag}`);
  await shot(page, `${tag}-03-confirm`);
  await dialog.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expectVisible(page.getByText(/^Scheduled for /), `scheduled toast at ${tag}`);
  await expectVisible(page.getByRole('heading', { name: 'All Campaigns' }), `composer closed at ${tag}`);

  const saved = api.state.newsletters.find((n) => n.name === NAME);
  const types = (saved?.blocks || []).map((b) => b.type);
  expect(saved?.status === 'scheduled' && Boolean(saved?.scheduled_at), `scheduled with a time at ${tag}`);
  expect(JSON.stringify(types) === JSON.stringify(['image', 'title', 'text', 'youtube', 'button', 'divider']), `every section saved in order at ${tag} (got ${types})`);
  expect(saved?.header?.title === 'Serpa Chrysler Jeep' && Boolean(saved?.header?.logo_url), `header saved at ${tag}`);
  expect(saved?.sms_text === 'November deals are here.' && JSON.stringify(saved?.channels) === '["email","sms"]', `channels and text saved at ${tag}`);
  expect(JSON.stringify(saved?.audience) === JSON.stringify([{ type: 'all_leads' }, { type: 'lead_group', id: 4 }, { type: 'list', id: list?.id }]), `audience saved at ${tag} (got ${JSON.stringify(saved?.audience)})`);
  expect(saved?.blocks?.[4]?.data?.url === 'https://serpachrysler.ca/service', `button link saved as https at ${tag}`);
  expect(saved?.subject === 'November deals are here' && saved?.preview_text === 'Winter tires and service specials', `subject and preview text saved at ${tag}`);
  expect(api.state.brand.business_address === '4505 Steeles Ave W, Toronto, ON', `business address saved at ${tag}`);

  // The Newsletters view lists it as Scheduled.
  await page.getByRole('radio', { name: 'Newsletters' }).click();
  const item = (name) => (phone ? page.getByRole('listitem').filter({ hasText: name }) : page.getByRole('row', { name: new RegExp(name) }));
  await expectVisible(item(NAME).getByText('Scheduled', { exact: true }), `listed as Scheduled at ${tag}`);
  await expectVisible(item(NAME).getByText(/^Sends /), `send time listed at ${tag}`);
  expect(!(await hasOverflow(page)), `no sideways scroll on the Newsletters view at ${tag}`);
  await page.waitForTimeout(300);
  await shot(page, `${tag}-04-list`);

  // Results of a sent one.
  await item('September recap').getByRole('button', { name: /^September recap/ }).click();
  const drawer = page.getByRole('dialog', { name: 'September recap' });
  await expectVisible(drawer.getByText('43% of delivered'), `results of a sent newsletter at ${tag}`);
  await page.waitForTimeout(700);
  expect(!(await hasOverflow(page)), `no sideways scroll in the results at ${tag}`);
  await shot(page, `${tag}-05-results`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Cancel the scheduled one.
  await page.getByRole('button', { name: `Actions for ${NAME}`, exact: true }).first().click();
  await page.getByRole('menuitem', { name: 'Cancel sending' }).click();
  await page.getByRole('button', { name: 'Yes, cancel it' }).click();
  await expectVisible(page.getByText('Newsletter cancelled. Nothing more will be sent.'), `cancel toast at ${tag}`);
  await expectVisible(item(NAME).getByText('Cancelled', { exact: true }), `now Cancelled at ${tag}`);
  expect(api.state.newsletters.find((n) => n.name === NAME)?.status === 'cancelled', `cancelled on the API at ${tag}`);

  // Duplicate it: the copy is a draft with the same content.
  await page.getByRole('button', { name: `Actions for ${NAME}`, exact: true }).first().click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expectVisible(page.getByText('Copied. The copy is a draft.'), `duplicate toast at ${tag}`);
  await expectVisible(item(`Copy of ${NAME}`).getByText('Draft', { exact: true }), `copy listed as a draft at ${tag}`);
  const copy = api.state.newsletters.find((n) => n.name === `Copy of ${NAME}`);
  expect(copy?.status === 'draft' && copy?.blocks?.length === 6 && copy?.sms_text === 'November deals are here.', `copy keeps the content at ${tag}`);

  // Delete the cancelled one.
  await page.getByRole('button', { name: `Actions for ${NAME}`, exact: true }).first().click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
  await expectVisible(page.getByText('Newsletter deleted.'), `delete toast at ${tag}`);
  await page.waitForTimeout(400);
  expect(!api.state.newsletters.some((n) => n.name === NAME), `deleted on the API at ${tag}`);
  expect(await item(`^${NAME}`).count() === 0, `deleted row gone at ${tag}`);
  await shot(page, `${tag}-06-after-actions`);

  // The Storeel tab still creates a Storeel.
  await page.getByRole('radio', { name: 'Storeels' }).click();
  await createButton(page, phone).click();
  await page.getByRole('radio', { name: 'Storeel', exact: true }).click();
  await expectVisible(page.getByText('Create New Campaign'), `Storeel form at ${tag}`);
  await page.waitForTimeout(800); // categories load
  await page.getByPlaceholder('Give your campaign a meaningful title').fill(`Winter tire event ${width}`);
  expect(!(await hasOverflow(page)), `no sideways scroll on the Storeel tab at ${tag}`);
  await shot(page, `${tag}-07-storeel`);
  await page.getByRole('button', { name: 'Create Campaign', exact: true }).click();
  await page.waitForTimeout(1500);
  const storeel = api.state.storeels.find((s) => s.title === `Winter tire event ${width}`);
  expect(Boolean(storeel) && storeel.category_id === 7, `Storeel created with POST /memories at ${tag} (got ${JSON.stringify(api.state.storeels)})`);
  await context.close();
}

export async function run(ctx) {
  const { open, shot, expectVisible, expect, hasOverflow } = ctx;
  mkdirSync(DIR, { recursive: true });
  writeFileSync(CSV, 'Name,Email,Phone\nAva Chen,ava@example.com,+14165550101\nBen Ortiz,,+16475550199\nDana Lee,dana@example.com,\n');

  await journey(ctx, 1280);
  await journey(ctx, 390);

  // The Storeel limit: Create a Campaign still opens on Newsletter; the Storeel tab shows the limit and won't create.
  for (const width of [1280, 390]) {
    const phone = width < 768;
    const api = createMockApi({ storeelLimit: true, newsletters: seedNewsletters() });
    const { page, context } = await open({ view: 'campaigns', width, height: phone ? 844 : 1000, api });
    await expectVisible(page.getByRole('heading', { name: 'All Campaigns' }), `Campaigns page with the limit at ${width}`);
    await createButton(page, phone).click();
    await expectVisible(page.getByRole('heading', { name: 'Campaign name' }), `Newsletter opens with the Storeel limit reached at ${width}`);
    // (The Campaigns page has its own limit banner behind the modal; these look inside Create Campaign only.)
    expect(await page.getByRole('dialog').getByText('Campaign Limit Reached').count() === 0, `no limit notice on the Newsletter tab at ${width}`);
    await page.getByRole('radio', { name: 'Storeel', exact: true }).click();
    await expectVisible(page.locator('p').filter({ hasText: /^Campaign Limit Reached$/ }), `limit notice on the Storeel tab at ${width}`);
    await page.getByPlaceholder('Give your campaign a meaningful title').fill('One too many');
    await page.getByRole('button', { name: 'Create Campaign', exact: true }).click();
    await page.waitForTimeout(800);
    expect(!api.state.calls.some((c) => c.method === 'POST' && c.path === '/memories'), `no Storeel created over the limit at ${width}`);
    expect(!(await hasOverflow(page)), `no sideways scroll with the limit notice at ${width}`);
    await shot(page, `${width}-08-storeel-limit`);
    await page.getByRole('radio', { name: 'Newsletter', exact: true }).click();
    await page.locator('#nl-name').fill('Still allowed');
    await page.waitForTimeout(1500);
    expect(api.state.newsletters.some((n) => n.name === 'Still allowed'), `the newsletter still saves with the Storeel limit reached at ${width}`);
    await context.close();
  }

  // Starter: Create a Campaign shows the upgrade card; Newsletters too; not one newsletter call.
  for (const width of [1280, 390]) {
    const phone = width < 768;
    const api = createMockApi({ plan: 'Starter', newsletters: seedNewsletters() });
    const { page, context } = await open({ view: 'campaigns', width, height: phone ? 844 : 1000, api });
    await expectVisible(page.getByRole('heading', { name: 'All Campaigns' }), `Starter Campaigns page at ${width}`);
    await createButton(page, phone).click();
    await expectVisible(page.getByText('Newsletters are part of paid plans'), `Starter upgrade card in Create Campaign at ${width}`);
    expect(!(await hasOverflow(page)), `no sideways scroll on the Starter card at ${width}`);
    await shot(page, `${width}-09-starter-composer`);
    await page.getByRole('button', { name: 'Make a Storeel instead' }).click();
    await expectVisible(page.getByText('Create New Campaign'), `Starter can still make a Storeel at ${width}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    if (await page.getByText('Create New Campaign').isVisible()) await page.getByRole('button', { name: 'Cancel' }).first().click();
    await page.getByRole('radio', { name: 'Newsletters' }).click();
    await expectVisible(page.getByText('Newsletters are part of paid plans'), `Starter card on the Newsletters view at ${width}`);
    await page.waitForTimeout(1000);
    expect(newsletterCalls(api).length === 0, `Starter makes no newsletter calls at ${width} (got ${newsletterCalls(api).map((c) => c.path).join(', ')})`);
    await context.close();
  }

  // Overflow at 360, 375 and 390: composer (with every section), Newsletters list, results.
  for (const width of [360, 375, 390]) {
    const api = createMockApi({ newsletters: seedNewsletters() });
    const { page, context } = await open({ view: 'campaigns', width, height: 844, api });
    await expectVisible(page.getByRole('heading', { name: 'All Campaigns' }), `Campaigns at ${width}`);
    expect(!(await hasOverflow(page)), `no sideways scroll on Storeels at ${width}`);
    await page.getByRole('radio', { name: 'Newsletters' }).click();
    await expectVisible(page.getByRole('listitem').getByText('September recap'), `list at ${width}`);
    expect(!(await hasOverflow(page)), `no sideways scroll on Newsletters at ${width}`);
    await page.getByRole('listitem').getByRole('button', { name: /^September recap/ }).click();
    await expectVisible(page.getByRole('dialog', { name: 'September recap' }).getByText('43% of delivered'), `results at ${width}`);
    await page.waitForTimeout(700);
    expect(!(await hasOverflow(page)), `no sideways scroll in results at ${width}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Create', exact: true }).click(); // "Create a Newsletter" on wider screens
    await expectVisible(page.getByRole('heading', { name: 'Campaign name' }), `composer at ${width}`);
    const preview = page.locator('aside');
    await page.locator('#nl-name').fill('Overflow check');
    for (const [i, item] of ['Image', 'Title', 'Text', 'YouTube', 'Button', 'Divider'].entries()) {
      await preview.getByRole('button', { name: i === 0 ? 'Add a section at the top' : `Add a section after section ${i}` }).click();
      await page.getByRole('menuitem', { name: new RegExp(`^${item}`) }).click();
    }
    await preview.getByRole('group', { name: 'Button section' }).click();
    expect(!(await hasOverflow(page)), `no sideways scroll in the composer with every section at ${width}`);
    await page.getByRole('radio', { name: 'Schedule for later' }).check();
    expect(!(await hasOverflow(page)), `no sideways scroll with Schedule for later at ${width}`);
    await context.close();
  }
}
