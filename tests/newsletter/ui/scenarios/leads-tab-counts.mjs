// Batch 3 (Chris, 1 Nov): the Leads page's Leads | Lists | Groups | My Conversations row shows every tab's count as
// plain number text, no purple pill. Leads = Open + Closed. Unread replies keep their red alert badge.
import { createMockApi } from '../mock-api.mjs';

const SHOTS = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
const many = (n, make) => Array.from({ length: n }, (_, i) => make(i));
const LIST = (i) => ({ id: 200 + i, name: `List ${i + 1}`, source: 'manual', member_count: 0, email_count: 0, sms_count: 0, unsubscribed_count: 0, consent_type: null, created_at: '2026-10-01T15:00:00Z', updated_at: '2026-10-01T15:00:00Z' });
const GROUP = (i) => ({ id: 300 + i, name: `Group ${i + 1}`, member_count: 3, members: [], created_at: '2026-10-01T15:00:00Z', updated_at: '2026-10-01T15:00:00Z' });
const CONVO = (unread) => (i) => ({ lead_id: 400 + i, owner: { id: 9, name: `Owner ${i + 1}` }, story: null, last_message: null, unread_count: i < unread ? 1 : 0, last_message_at: '2026-10-27T15:00:00Z' });

/** Each tab: its words, its plain count, and anything in it with a filled background (a pill). */
async function tabs(page) {
  return page.evaluate(() => {
    const leads = [...document.querySelectorAll('button')].find((b) => /^Leads\d*$/.test(b.textContent?.trim() ?? ''));
    if (!leads) return [];
    return [...leads.parentElement.children].map((b) => {
      const count = b.querySelector('[data-tab-count]');
      const pills = [...b.querySelectorAll('span')].filter((s) => {
        const bg = getComputedStyle(s).backgroundColor;
        return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
      }).map((s) => ({ text: s.textContent.trim(), bg: getComputedStyle(s).backgroundColor }));
      return { text: b.textContent.replace(/ /g, ' ').trim(), count: count ? count.textContent.trim() : null, countBg: count ? getComputedStyle(count).backgroundColor : null, pills };
    });
  });
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  // 1. Desktop: every tab with its count, none in a pill; one unread conversation keeps the red badge.
  const api = createMockApi({ lists: many(2, LIST), groups: many(5, GROUP), conversations: many(3, CONVO(1)), leadTabCounts: { open: 40, closed: 2 } });
  const { page, context } = await open({ view: 'leads', width: 1280, height: 900, api });
  await expectVisible(page.getByRole('button', { name: /^Lists/ }).getByText('2', { exact: true }), 'Lists count');
  await page.waitForTimeout(800);
  const row = await tabs(page);
  const counts = row.map((t) => t.count);
  expect(JSON.stringify(counts) === JSON.stringify(['42', '2', '5', '3']), `every tab shows its count: Leads 42 (40 open + 2 closed), Lists 2, Groups 5, My Conversations 3 (got ${JSON.stringify(counts)})`);
  expect(row.every((t) => t.countBg === 'rgba(0, 0, 0, 0)'), `counts are plain text, no background (got ${JSON.stringify(row.map((t) => t.countBg))})`);
  const purple = row.flatMap((t) => t.pills).filter((p) => /108, 96, 255/.test(p.bg));
  expect(purple.length === 0, `no purple pill anywhere in the row (got ${JSON.stringify(purple)})`);
  const red = row[3]?.pills ?? [];
  expect(red.length === 1 && red[0].text === '1', `the unread reply keeps its red badge (got ${JSON.stringify(red)})`);
  expect(row.slice(0, 3).every((t) => t.pills.length === 0), 'no badge on Leads, Lists or Groups');
  const tabRow = page.locator('[data-tab-count]').first().locator('xpath=../..');
  await tabRow.screenshot({ path: `${SHOTS}/leads-tab-counts-1280-01-row.png` });
  await shot(page, '1280-01-page');
  // The active tab's count reads the same.
  await page.getByRole('button', { name: /^Groups/ }).click();
  await page.waitForTimeout(300);
  expect((await tabs(page))[2]?.count === '5', 'Groups count on the active tab');
  await tabRow.screenshot({ path: `${SHOTS}/leads-tab-counts-1280-02-groups-active.png` });
  await context.close();

  // 2. Zero is a count too; a Starter account (no lists) shows no Lists count at all.
  const starter = await open({ view: 'leads', width: 1280, height: 900, api: createMockApi({ plan: 'Starter', groups: [] }) });
  await expectVisible(starter.page.getByRole('button', { name: /^Groups/ }), 'Starter: row');
  await starter.page.waitForTimeout(800);
  const sCounts = (await tabs(starter.page)).map((t) => t.count);
  expect(JSON.stringify(sCounts) === JSON.stringify(['0', null, '0', '0']), `Starter: zeros shown, Lists without a count (got ${JSON.stringify(sCounts)})`);
  await starter.context.close();

  // 3. Phones: two- and three-digit counts and the unread badge still fit, nothing scrolls sideways.
  for (const width of [360, 390]) {
    const phone = await open({ view: 'leads', width, height: 844, api: createMockApi({ lists: many(12, LIST), groups: many(12, GROUP), conversations: many(12, CONVO(12)), leadTabCounts: { open: 230, closed: 12 } }) });
    const p = phone.page;
    await expectVisible(p.getByRole('button', { name: /^Lists/ }).getByText('12', { exact: true }), `${width}: Lists 12`);
    await p.waitForTimeout(800);
    const fits = await p.evaluate(() => {
      const leads = [...document.querySelectorAll('button')].find((b) => /^Leads\d*$/.test(b.textContent?.trim() ?? ''));
      const r = leads?.parentElement;
      if (!r) return 'no row';
      const box = r.getBoundingClientRect();
      const over = [...r.children].filter((b) => { const x = b.getBoundingClientRect(); return x.left < box.left - 1 || x.right > box.right + 1 || b.scrollWidth > b.clientWidth + 1; });
      return r.scrollWidth <= r.clientWidth + 1 && !over.length ? 'ok' : `content ${r.scrollWidth}px in ${r.clientWidth}px; over: ${over.map((b) => b.textContent).join(' | ')}`;
    });
    expect(fits === 'ok', `${width}: four tabs with counts fit (${fits})`);
    expect(!(await hasOverflow(p)), `${width}: no sideways scroll`);
    expect(JSON.stringify((await tabs(p)).map((t) => t.count)) === JSON.stringify(['242', '12', '12', '12']), `${width}: counts`);
    await p.locator('[data-tab-count]').first().locator('xpath=../..').screenshot({ path: `${SHOTS}/leads-tab-counts-${width}-row.png` });
    await phone.context.close();
  }
}
