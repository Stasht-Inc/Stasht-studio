// Review (batch 3): a lead group holding a lead with no account (GET /lead-groups member name: null) crashed the whole
// app on Leads → Groups ("Something went wrong"). It now shows the group, the guests' avatars with "G" (Guest), and the drawer names them.
import { createMockApi } from '../mock-api.mjs';

const SHOTS = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
const now = () => new Date().toISOString();

export async function run({ open, expectVisible, expect }) {
  const groups = [{
    id: 4, name: 'Open house guests', member_count: 3, created_at: now(), updated_at: now(),
    members: [
      { lead_id: 11, name: 'Bon Sun', profile_image: null },
      { lead_id: 12, name: null, profile_image: null },
      { lead_id: 13, name: null, profile_image: null },
    ],
  }];
  // GET /lead-groups/4: a member with an account, a guest with only an email (no name), and one with nothing (user null).
  const groupDetails = { 4: { ...groups[0], members: [
    { lead_id: 11, status: 'hot', user: { id: 7, name: 'Bon Sun', email: 'bon@example.com', profile_image: null, phone_number: null }, has_email: true, has_phone: false },
    { lead_id: 12, status: null, user: { id: null, name: null, email: 'guest@example.com', profile_image: null, phone_number: null }, has_email: true, has_phone: false },
    { lead_id: 13, status: null, user: null, has_email: false, has_phone: false },
  ] } };
  for (const width of [1280, 390]) {
    const { page, context } = await open({ view: 'leads', width, height: 900, api: createMockApi({ groups, groupDetails }) });
    await page.getByRole('button', { name: /^Groups/ }).click();
    await page.waitForTimeout(800);
    expect(await page.getByText('Something went wrong').count() === 0, `${width}: no crash`);
    await expectVisible(page.getByText('Open house guests').locator('visible=true'), `${width}: the group shows`);
    const fallbacks = await page.locator('span').filter({ hasText: /^G$/ }).locator('visible=true').count();
    expect(fallbacks >= 2, `${width}: guests' avatars show "G" for Guest (got ${fallbacks})`);
    await page.screenshot({ path: `${SHOTS}/leads-groups-guest-${width}.png` });
    // Opening the group: the drawer lists every member by a name.
    await page.getByText('Open house guests').locator('visible=true').first().click();
    const drawer = page.getByText('Members', { exact: true }).locator('visible=true');
    await expectVisible(drawer, `${width}: group drawer opens`);
    await expectVisible(page.getByText('guest@example.com').locator('visible=true'), `${width}: email-only guest named by email`);
    await expectVisible(page.getByText('Guest', { exact: true }).locator('visible=true'), `${width}: a guest with nothing is "Guest"`);
    expect(await page.getByText('Something went wrong').count() === 0, `${width}: drawer does not crash`);
    await page.screenshot({ path: `${SHOTS}/leads-groups-guest-${width}-drawer.png` });
    await context.close();
  }
}
