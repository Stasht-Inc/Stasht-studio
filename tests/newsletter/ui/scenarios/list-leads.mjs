// Chris 7 Nov (point 8): people added to a newsletter list become leads. On Leads they read "List: <list name>"
// (GET /leads source_list) where a campaign lead reads "Via: <campaign>" — not "Direct message".
import { createMockApi } from '../mock-api.mjs';

const SHOTS = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
const at = (minutesAgo) => new Date(Date.now() - minutesAgo * 60000).toISOString();

const lead = (id, name, email, phone, extra) => ({
  id, source: 'memory', user: { id: null, name, email, profile_image: null, location: null, phone_number: phone },
  story: null, campaign_deleted: false, status: null, engagement: 1, is_rollup: false, comments: [],
  messages_count: 0, sent_count: 0, received_count: 0, unread_count: 0, comment_unread_count: 0,
  last_engaged_at: at(id), first_seen_at: at(id), last_activity_at: at(id), property_id: null,
  assignee: { id: 990002, name: 'Samantha Smith', profile_color: '#F59E0B', avatar_url: null }, latest_message: null,
  notes: null, notes_updated_at: null, notes_updated_by: null, can_message: true, can_assign: true, can_delete: true,
  source_list: null, ...extra,
});

export async function run({ open, expectVisible, expect }) {
  const inboxLeads = [
    lead(1, 'Jordan Price', 'jordan@example.com', '+14165550101', { engagement: 0, first_seen_at: '2024-01-05T15:00:00Z', source_list: { id: 4, name: 'Subscriber list sept 30th 2026', added_at: at(5) } }),
    lead(2, 'Sam Lee', 'sam@example.com', null, { story: { id: 9, title: 'Fall show' } }),
    lead(3, 'Walk In', 'walkin@example.com', null, {}),
  ];
  for (const width of [1280, 390]) {
    const { page, context } = await open({ view: 'leads', width, height: 900, api: createMockApi({ inboxLeads, leadTabCounts: { open: 3, closed: 0 } }) });
    await page.waitForTimeout(800);
    expect(await page.getByText('Something went wrong').count() === 0, `${width}: no crash`);
    await expectVisible(page.getByText('Jordan Price').locator('visible=true').first(), `${width}: the list's lead shows`);
    // Wide: the Name cell's tooltip (the table has no Via column); narrow cards have no Via line either.
    if (width === 1280) expect(await page.locator('[title="List: Subscriber list sept 30th 2026"]').count() === 1, `${width}: the Name tooltip names the list`);
    expect(await page.getByText('Direct message').locator('visible=true').count() <= 1, `${width}: only the real direct lead reads "Direct message"`);
    await page.screenshot({ path: `${SHOTS}/list-leads-${width}.png` });
    // The lead's details name the list too.
    await page.getByText('Jordan Price').locator('visible=true').first().click();
    await page.waitForTimeout(600);
    await expectVisible(page.getByText(/was added from the list/).locator('visible=true').first(), `${width}: the thread says they were added from the list`);
    expect(await page.getByText(/viewed "a campaign"/).locator('visible=true').count() === 0, `${width}: not "viewed a campaign"`);
    // Dated when they were added to the list (today), not their 2024 consent date.
    const row = page.getByText(/was added from the list/).locator('visible=true').first().locator('xpath=..');
    expect(!(await row.innerText()).includes('Jan'), `${width}: the row shows the date they were added`);
    await page.screenshot({ path: `${SHOTS}/list-leads-${width}-open.png` });
    await context.close();
  }
}
