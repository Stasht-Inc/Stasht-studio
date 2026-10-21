// Task 3: the Newsletter tab opens by default, shows six steps and the preview, autosaves once, and the
// Storeel tab still shows today's form. The Storeel campaign limit shows inline on the Storeel tab only.
import { createMockApi } from '../mock-api.mjs';

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const { page, api, context } = await open({ width: 1280, height: 1700 });
  await expectVisible(page.getByRole('heading', { name: 'Create Campaign' }), 'composer header');
  await expectVisible(page.getByRole('radio', { name: 'Newsletter', checked: true }), 'Newsletter tab selected by default');
  for (const title of ['Campaign name', 'Recipients', 'From', 'Subject', 'Content', 'Schedule']) {
    await expectVisible(page.getByRole('heading', { name: title, exact: true }), `step "${title}"`);
  }
  await expectVisible(page.getByText('Email preview', { exact: true }), 'EMAIL PREVIEW label');
  await page.waitForTimeout(600);
  expect(api.state.calls.every((c) => !(c.method === 'POST' && c.path === '/newsletters')), 'opening creates no draft');
  expect(await page.locator('#nl-name').evaluate((el) => el === document.activeElement), 'name field focused on open');
  await shot(page, '1280-newsletter');

  await page.locator('#nl-name').fill('October Newsletter 2026');
  await page.locator('#nl-from-name').fill('Serpa Chrysler');
  await page.locator('#nl-reply-to').fill('sales@serpachrysler.ca');
  await page.locator('#nl-subject').fill('October deals are here');
  await page.locator('#nl-preview-text').fill('New arrivals and service specials');
  await expectVisible(page.locator('aside').getByText('October deals are here'), 'subject in the inbox row');
  await page.waitForTimeout(1500);
  const posts = api.state.calls.filter((c) => c.method === 'POST' && c.path === '/newsletters');
  const puts = api.state.calls.filter((c) => c.method === 'PUT' && /^\/newsletters\/\d+$/.test(c.path));
  expect(posts.length === 1, `exactly one draft created (got ${posts.length})`);
  expect(puts.length >= 1, 'draft saved with PUT');
  const saved = api.state.newsletters[0];
  expect(saved?.subject === 'October deals are here', 'subject saved');
  expect(saved?.reply_to_email === 'sales@serpachrysler.ca', 'reply-to saved');
  await expectVisible(page.getByText('Draft saved'), 'save indicator');
  await shot(page, '1280-newsletter-filled');

  await page.getByRole('radio', { name: 'Storeel' }).click();
  await expectVisible(page.getByText('Create New Campaign'), 'Storeel form shown unchanged');
  expect(await page.getByText('Campaign Limit Reached').count() === 0, 'no limit notice when within the limit');
  await shot(page, '1280-storeel');
  await page.getByRole('radio', { name: 'Newsletter' }).first().click();
  await expectVisible(page.getByRole('heading', { name: 'Campaign name' }), 'back on Newsletter');
  expect(await page.locator('#nl-name').inputValue() === 'October Newsletter 2026', 'draft kept while on the Storeel tab');
  await page.locator('#nl-subject').fill('October deals are here!');
  await page.waitForTimeout(1500);
  expect(api.state.calls.filter((c) => c.method === 'POST' && c.path === '/newsletters').length === 1, 'still one draft after switching tabs');
  await context.close();

  // Phones: no sideways scroll at 360, 375 and 390, on both tabs.
  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 844 });
    await expectVisible(phone.page.getByRole('heading', { name: 'Campaign name' }), `phone layout ${width}`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll on the Newsletter tab at ${width} px`);
    if (width === 390) {
      await shot(phone.page, '390-newsletter');
      await phone.page.setViewportSize({ width, height: 2300 });
      await shot(phone.page, '390-newsletter-full');
      await phone.page.setViewportSize({ width, height: 844 });
    }
    await phone.page.getByRole('radio', { name: 'Storeel' }).click();
    await expectVisible(phone.page.getByText('Create New Campaign'), `Storeel form at ${width}`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll on the Storeel tab at ${width} px`);
    if (width === 390) await shot(phone.page, '390-storeel');
    await phone.context.close();
  }

  // Plan gate (contract note 1): Create Campaign opened on the Storeel tab (a category was picked) makes no
  // newsletter calls at all.
  const storeel = await open({ query: '&category=Cars' });
  await expectVisible(storeel.page.getByText('Create New Campaign'), 'opens on the Storeel tab when a category is picked');
  await storeel.page.waitForTimeout(1500);
  const newsletterCalls = storeel.api.state.calls.filter((c) => /^\/(newsletter|contact-lists)/.test(c.path));
  expect(newsletterCalls.length === 0, `no newsletter calls with the Storeel tab showing (got ${newsletterCalls.map((c) => c.path).join(', ')})`);
  await storeel.context.close();

  // Starter plan: no newsletter calls; the Newsletter tab shows the upgrade card.
  const starter = await open({ api: createMockApi({ plan: 'Starter' }), width: 1280 });
  await expectVisible(starter.page.getByText('Newsletters are part of paid plans'), 'upgrade card on Starter');
  await starter.page.waitForTimeout(1000);
  const starterCalls = starter.api.state.calls.filter((c) => /^\/(newsletter|contact-lists)/.test(c.path));
  expect(starterCalls.length === 0, `no newsletter calls on Starter (got ${starterCalls.map((c) => c.path).join(', ')})`);
  await starter.context.close();

  // Storeel campaign limit reached: Newsletter still opens and works; the Storeel tab shows the limit inline.
  const limited = await open({ api: createMockApi({ storeelLimit: true }), width: 1280 });
  await expectVisible(limited.page.getByRole('heading', { name: 'Campaign name' }), 'Newsletter tab opens with the Storeel limit reached');
  expect(await limited.page.getByText('Campaign Limit Reached').count() === 0, 'no limit notice on the Newsletter tab');
  await limited.page.getByRole('radio', { name: 'Storeel' }).click();
  await expectVisible(limited.page.getByText('Campaign Limit Reached'), 'limit notice inline on the Storeel tab');
  await shot(limited.page, '1280-storeel-limit');
  await limited.context.close();

  // The limit check said yes but POST /memories says 403 memory_limit_reached: the same inline notice (with the
  // server's words), scrolled to and focused, not a browser alert.
  for (const width of [1280, 390]) {
    const raced = await open({ api: createMockApi({ storeelServerLimit: true }), width, height: width < 768 ? 844 : 1000 });
    const alerts = [];
    raced.page.on('dialog', (d) => { alerts.push(d.message()); void d.dismiss(); });
    await raced.page.getByRole('radio', { name: 'Storeel', exact: true }).click();
    await expectVisible(raced.page.getByText('Create New Campaign'), `Storeel form at ${width}`);
    expect(await raced.page.getByText('Campaign Limit Reached').count() === 0, `no limit notice before creating at ${width}`);
    await raced.page.waitForTimeout(800); // categories load
    await raced.page.getByPlaceholder('Give your campaign a meaningful title').fill('Raced past the limit');
    await raced.page.getByRole('button', { name: 'Create Campaign', exact: true }).click();
    const notice = raced.page.getByRole('alert').filter({ hasText: 'Campaign Limit Reached' });
    await expectVisible(notice, `server limit shown inline at ${width}`);
    await expectVisible(notice.getByText(/You've reached your plan's campaign limit/), `server limit message at ${width}`);
    await raced.page.waitForTimeout(500);
    expect(await notice.evaluate((el) => el === document.activeElement), `limit notice focused at ${width}`);
    expect(alerts.length === 0, `no browser alert for the server limit at ${width} (got ${alerts.join(' | ')})`);
    expect(raced.api.state.calls.some((c) => c.method === 'POST' && c.path === '/memories'), `POST /memories was tried at ${width}`);
    await shot(raced.page, `${width}-storeel-server-limit`);
    await raced.context.close();
  }
}
