// Task 9: All leads by default, pick a lead group and a list, add Text, live counts, SMS counter, all saved.
// Counts are debounced (one call for a burst of changes) and never asked for while the Storeel tab shows.
export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const { page, api, context } = await open({ width: 1280, height: 1800 });
  const step = page.locator('#nl-step-recipients');
  const countCalls = () => api.state.calls.filter((c) => c.path === '/newsletters/audience-count');
  await expectVisible(step.getByText('All leads').first(), 'All leads chosen by default');
  await expectVisible(step.getByText('1,180', { exact: true }), 'estimated email recipients for all leads');
  expect(countCalls().length === 1, `one count call on open (got ${countCalls().length})`);

  await step.getByRole('button', { name: /Send to/ }).click();
  await expectVisible(page.getByRole('checkbox', { name: /VIP buyers/ }), 'lead group listed');
  await expectVisible(page.getByRole('checkbox', { name: /Open house sign-ups/ }), 'list listed');
  await shot(page, '1280-01-send-to');
  const before = countCalls().length;
  await page.getByRole('checkbox', { name: /VIP buyers/ }).check();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  await expectVisible(step.getByText('All leads + 2 more').first(), 'summary label');
  await expectVisible(step.getByText('1,414', { exact: true }), 'count updates (1,180 + 36 + 198)');
  expect(countCalls().length - before === 1, `two quick picks, one count call (got ${countCalls().length - before})`);

  await step.getByRole('checkbox', { name: /Text message/ }).check();
  await step.getByLabel('Text message (SMS only)', { exact: true }).fill('October deals are here.');
  await expectVisible(step.getByText('23 / 120'), 'character counter');
  await expectVisible(step.getByText('1,414 emails · 480 texts'), 'both channel counts');
  await expectVisible(step.getByText('Not included: 24 with no email address, 3 unsubscribed, 11 listed twice.'), 'not-included line');
  await page.waitForTimeout(1500);

  const saved = api.state.newsletters[0];
  expect(JSON.stringify(saved?.audience) === JSON.stringify([{ type: 'all_leads' }, { type: 'lead_group', id: 4 }, { type: 'list', id: 9 }]), `audience saved (got ${JSON.stringify(saved?.audience)})`);
  expect(JSON.stringify(saved?.channels) === JSON.stringify(['email', 'sms']), 'channels saved');
  expect(saved?.sms_text === 'October deals are here.', 'SMS text saved');
  expect(api.state.calls.some((c) => c.path === '/newsletters/audience-count' && c.body?.channels?.includes('sms')), 'counts asked for both channels');
  await shot(page, '1280-02-chosen');

  // While the Storeel tab shows, nothing is counted.
  await page.getByRole('radio', { name: 'Storeel' }).click();
  await expectVisible(page.getByText('Create New Campaign'), 'Storeel form');
  const onStoreel = countCalls().length;
  await page.waitForTimeout(1200);
  expect(countCalls().length === onStoreel, 'no count calls on the Storeel tab');
  await context.close();

  // Phones: the checklist fits, nothing scrolls sideways.
  for (const width of [360, 375, 390]) {
    const phone = await open({ width, height: 844 });
    const s = phone.page.locator('#nl-step-recipients');
    await s.scrollIntoViewIfNeeded();
    await s.getByRole('button', { name: /Send to/ }).click();
    await expectVisible(phone.page.getByRole('checkbox', { name: /VIP buyers/ }), `checklist at ${width}`);
    expect(!(await hasOverflow(phone.page)), `no sideways scroll with the checklist open at ${width}`);
    if (width === 390) await phone.page.screenshot({ path: '/private/tmp/claude-501/newsletters-ui/shots/audience-390-01-send-to.png' });
    await phone.page.keyboard.press('Escape');
    await s.getByRole('checkbox', { name: /Text message/ }).check();
    expect(!(await hasOverflow(phone.page)), `no sideways scroll with Text on at ${width}`);
    if (width === 390) await shot(phone.page, '390-02-chosen');
    await phone.context.close();
  }
}
