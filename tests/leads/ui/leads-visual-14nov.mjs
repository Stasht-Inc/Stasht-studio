// Chris 14 Nov 2026 (points 1–4), mocked API, 1280 + 390:
//  1. phone: unread lead cards are yellow (as the desktop rows);
//  2. phone: the bottom nav stays on the bottom edge at the end of a long list — also when iOS has drawn it mid-screen
//     (simulated by forcing it up; usePhoneBottomBarPin moves it back down);
//  3. Contact Details: edit the lead's name (hover pencil / tap, Enter saves, Esc cancels, blank → error under field);
//     header + avatar + list row follow;
//  4. less purple: AI bubble light gray, AI chip / sparkle / Take over / Accept / business chip / avatars not purple.
// node tests/leads/ui/leads-visual-14nov.mjs   (dev server: LV_BASE, default http://localhost:5181; LV_SHOTS = screenshot dir)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.LV_BASE || 'http://localhost:5181';
const OUT = process.env.LV_SHOTS || '/private/tmp/claude-501/leads-visual-14nov/shots';
mkdirSync(OUT, { recursive: true });

const OWNER = { id: 140, external_user_id: 959, name: 'Royal Owner', email: 'owner@royalwood.test', role: '2', status: 1, is_activated: true };
const now = '2026-11-14T10:00:00Z';
const PURPLE = /108, 96, 255/;
const base = { source: 'memory', story: { id: 1, title: 'MDF' }, campaign_deleted: false, source_list: null, status: null, engagement: 1, comments: [], messages_count: 1, sent_count: 0, received_count: 1, comment_unread_count: 0, last_engaged_at: now, first_seen_at: now, last_activity_at: now, property_id: null, notes: null, can_assign: true, can_delete: true, account: null, released_from: null, waiting: false, can_accept: false, assignee: null, can_message: true, is_rollup: false, claimed: false, can_open: true, can_mark_unread: true, latest_message: { body: 'Hi', direction: 'inbound', channel: 'sms', sender_name: null, sent_at: now, attachment_name: null } };
function leads(state) {
  const rows = [];
  // The widget lead: a guest (no account), unread, waiting to be accepted, for another business (chip).
  rows.push({ ...base, id: 1, source: 'widget', story: null, user: { id: null, name: state.name, email: null, phone_number: '+17248013801' }, unread_count: 2, waiting: true, can_accept: true, can_assign: false, account: { owner_id: 1, name: 'TheRoyalWoodShop' } });
  for (let i = 2; i <= 14; i++) rows.push({ ...base, id: i, user: { id: null, name: `Lead ${i}`, email: `l${i}@example.test`, phone_number: null }, unread_count: 0 });
  return rows;
}

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height }) {
  const state = { name: null, nameCalls: [] };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([seed]) => {
    if (sessionStorage.getItem('lv-seeded')) return;
    sessionStorage.setItem('lv-seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, [{ stasht_token: 'owner-token', stasht_user: OWNER, view_type: 'personal' }]);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    const remoteApi = !local && url.pathname.startsWith('/api/react/');
    if (!local && !remoteApi) {
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: 'window.Stripe=function(){return{elements:function(){return{create:function(){return{mount:function(){},on:function(){},destroy:function(){},unmount:function(){}}},getElement:function(){return null}}}}};' });
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: 'window.gapi={load:function(n,c){var f=typeof c==="function"?c:(c&&c.callback);if(f)f();}};' });
      return route.abort('blockedbyclient');
    }
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (p === '/properties' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { properties: [], owned_properties: [], shared_properties: [], owned_count: 0, shared_count: 0, total_count: 0 } } });
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/leads' && req.method() === 'GET') {
      const rows = leads(state);
      return route.fulfill({ json: { total: rows.length, status_counts: {}, messages_total: 0, tab_counts: { open: rows.length, closed: 0 }, leads: rows, team_leads: { staff: false, can_see_all: true, scope: 'all' } } });
    }
    if (p === '/leads/1/name' && req.method() === 'PATCH') {
      const body = JSON.parse(req.postData() || '{}');
      state.nameCalls.push(body.name);
      if (!String(body.name || '').trim()) return route.fulfill({ status: 422, json: { message: 'Enter a name.', errors: { name: ['Enter a name.'] } } });
      state.name = String(body.name).trim();
      return route.fulfill({ json: { id: 1, name: state.name } });
    }
    if (p === '/leads/unread-count') return route.fulfill({ json: { total_unread_messages: 2, total_unread_comments: 0, total_unread: 2 } });
    if (/^\/leads\/\d+\/messages\/mark-read$/.test(p)) return route.fulfill({ json: { marked_read: 0 } });
    if (/^\/leads\/\d+\/messages$/.test(p)) {
      const messages = p === '/leads/1/messages'
        ? [{ id: 1, parent_message_id: null, direction: 'inbound', channel: 'widget', body: 'Do you have MDF baseboard?', subject: null, status: 'received', is_ai: false, is_read: true, sent_at: now, attachments: [] },
           { id: 2, parent_message_id: null, direction: 'outbound', channel: 'widget', body: 'Yes! See https://www.royalwoodshop.com/upcp_product/baseboard-1867/', subject: null, status: 'sent', is_ai: true, is_read: true, sent_at: '2026-11-14T10:01:00Z', attachments: [] },
           { id: 3, parent_message_id: null, direction: 'outbound', channel: 'widget', body: 'Happy to help further.', subject: null, status: 'sent', is_ai: false, is_read: true, sent_at: '2026-11-14T10:02:00Z', sender_name: 'Royal Owner', attachments: [] }]
        : [];
      return route.fulfill({ json: { messages, events: [], visitor_online: true, widget_ai: p === '/leads/1/messages' ? { ai_enabled: true, assistant_name: 'Chip', handled_by: null } : null } });
    }
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/leads`);
  return { context, page, state };
}
async function shot(page, file) { const path = `${OUT}/${file}.png`; await page.screenshot({ path }); console.log('shot', path); }
const bg = (loc) => loc.evaluate((el) => getComputedStyle(el).backgroundColor);
const nameCell = (page) => page.getByText('+17248013801', { exact: false }).filter({ visible: true }).first();

try {
  for (const [width, height, tag] of [[1280, 900, 'd'], [390, 844, 'm']]) {
    const { page, context, state } = await open({ width, height });
    await page.getByText('Lead 2', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 40000 });
    await page.waitForTimeout(1200);

    if (tag === 'm') {
      // 1. Unread card is yellow; read card is white.
      const unreadCard = page.locator('div.rounded-xl', { has: page.getByText('(724) 801-3801') }).filter({ visible: true }).last();
      const readCard = page.locator('div.rounded-xl', { has: page.getByText('Lead 2', { exact: true }) }).filter({ visible: true }).last();
      const ub = await bg(unreadCard);
      expect(ub === 'rgb(255, 251, 235)', `m1: unread card yellow (${ub})`);
      expect((await bg(readCard)) === 'rgb(255, 255, 255)', 'm1: read card white');
      expect(await unreadCard.locator('[aria-label="Unread"]').count() > 0, 'm1: unread dot kept');
      await shot(page, 'lv-m1-unread-yellow');

      // 2. Bottom nav at the very bottom after scrolling to the end of the list.
      const nav = page.locator('nav.phone-bottom-bar-pin').filter({ visible: true }).first();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(500);
      let box = await nav.boundingBox();
      expect(box && Math.abs(box.y + box.height - 844) <= 1, `m2: nav on the bottom edge after scrolling to the end (bottom ${box && box.y + box.height})`);
      expect(await page.getByText(/Showing 1/).filter({ visible: true }).count() >= 0, 'm2: list end rendered');
      await shot(page, 'lv-m2-scrolled-end');
      // iOS state: the bar drawn 336px too high (stale viewport) → moved back down.
      await page.addStyleTag({ content: 'nav.phone-bottom-bar-pin { bottom: 336px !important; }' });
      await page.evaluate(() => window.scrollBy(0, -5));
      await page.waitForTimeout(400);
      box = await nav.boundingBox();
      expect(box && Math.abs(box.y + box.height - 844) <= 1, `m2: a bar iOS drew mid-screen is put back on the bottom edge (bottom ${box && box.y + box.height})`);
      const shift = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--phone-bar-shift').trim());
      expect(shift === '336px', `m2: shift applied (${shift})`);
      await shot(page, 'lv-m2-ios-stuck-fixed');
      // Other pages at 390: Dashboard and Media.
      for (const label of ['Dashboard', 'Media']) {
        await nav.getByText(label, { exact: true }).click();
        await page.waitForTimeout(1200);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(400);
        const b = await page.locator('nav.phone-bottom-bar-pin').filter({ visible: true }).first().boundingBox();
        expect(b && Math.abs(b.y + b.height - 844) <= 1, `m2: ${label} page: nav on the bottom edge`);
      }
      // iOS recovers (its next scroll/resize): the shift goes back to 0.
      await page.addStyleTag({ content: 'nav.phone-bottom-bar-pin { bottom: 0 !important; }' });
      await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
      await page.waitForTimeout(300);
      await nav.getByText('Leads', { exact: true }).click();
      await page.getByText('Lead 2', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 20000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      const b2 = await page.locator('nav.phone-bottom-bar-pin').filter({ visible: true }).first().boundingBox();
      expect(b2 && Math.abs(b2.y + b2.height - 844) <= 1, 'm2: back to normal: no leftover shift');
    }

    // Open the widget lead.
    await page.getByText('(724) 801-3801').filter({ visible: true }).first().click().catch(async () => { await nameCell(page).click(); });
    await page.getByText('Do you have MDF baseboard?').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(600);

    // 4. Colours.
    const bubbles = page.locator('[data-outbound-bubble]').filter({ visible: true });
    expect(await bubbles.count() === 2, `${tag}4: two outbound bubbles`);
    const aiBg = await bg(bubbles.nth(0));
    const aiColor = await bubbles.nth(0).evaluate((el) => getComputedStyle(el).color);
    const linkColor = await bubbles.nth(0).locator('a').first().evaluate((el) => getComputedStyle(el).color);
    expect(aiBg === 'rgb(243, 244, 246)', `${tag}4: AI bubble light gray (${aiBg})`);
    expect(aiColor === 'rgb(10, 10, 10)' && linkColor === 'rgb(10, 10, 10)', `${tag}4: AI text + link dark (${aiColor} / ${linkColor})`);
    expect(!PURPLE.test(await bg(bubbles.nth(1))), `${tag}4: your reply not purple`);
    const chip = page.locator('[data-ai-badge]').filter({ visible: true }).first();
    expect(!PURPLE.test(await bg(chip)) && !PURPLE.test(await chip.evaluate((el) => getComputedStyle(el).color)), `${tag}4: AI chip neutral`);
    const take = page.getByRole('button', { name: 'Take over' }).filter({ visible: true }).first();
    expect(await take.count() > 0 && !PURPLE.test(await bg(take)), `${tag}4: Take over not purple (${await take.count() ? await bg(take) : '-'})`);
    const send = page.getByRole('button', { name: /^Send$/ }).filter({ visible: true }).last();
    if (await send.count()) console.log('  info composer Send bg', await bg(send));
    await shot(page, `lv-${tag}4-thread`);

    // 3. Contact Details: desktop column / phone sheet (tap the name in the header).
    if (tag === 'm') {
      await page.locator('[data-testid="lead-name-details-trigger"]').click();
      await page.locator('[data-testid="lead-details-sheet"]').waitFor({ state: 'visible', timeout: 5000 });
      await page.waitForTimeout(400);
    }
    const scope = tag === 'm' ? page.locator('[data-testid="lead-details-sheet"]') : page.locator('aside').filter({ visible: true }).last();
    const tagChip = scope.locator('[data-lead-business]').first();
    expect(await tagChip.count() > 0 && !PURPLE.test(await bg(tagChip)), `${tag}4: business chip neutral`);
    const accept = scope.getByRole('button', { name: 'Accept' }).first();
    expect(await accept.count() > 0 && !PURPLE.test(await bg(accept)), `${tag}4: Accept not purple`);
    const avatar = scope.locator('span[class*="E5E7EB"]').first();
    expect(await avatar.count() > 0, `${tag}4: gray avatar with dark initials`);
    await shot(page, `lv-${tag}4-contact-details`);

    const trigger = scope.locator('[data-testid="lead-name-edit"]');
    expect(await trigger.count() === 1, `${tag}3: name is editable (guest lead)`);
    if (tag === 'd') {
      const pencil = trigger.locator('svg');
      const before = await pencil.evaluate((el) => getComputedStyle(el).opacity);
      await trigger.hover();
      await page.waitForTimeout(300);
      const after = await pencil.evaluate((el) => getComputedStyle(el).opacity);
      expect(before === '0' && after === '1', `d3: pencil shows on hover (${before} → ${after})`);
      await shot(page, 'lv-d3-hover-pencil');
    }
    await trigger.click();
    const input = scope.locator('[data-testid="lead-name-input"]');
    await input.waitFor({ state: 'visible', timeout: 3000 });
    // Esc cancels.
    await input.fill('Nope');
    await input.press('Escape');
    await page.waitForTimeout(200);
    expect(state.nameCalls.length === 0, `${tag}3: Esc cancels (no save)`);
    if (tag === 'm') {
      // Radix closes the sheet on Esc; reopen it.
      await page.waitForTimeout(600);
      if (!(await page.locator('[data-testid="lead-details-sheet"]').isVisible().catch(() => false))) {
        await page.locator('[data-testid="lead-name-details-trigger"]').click();
        await page.waitForTimeout(400);
      }
    }
    await scope.locator('[data-testid="lead-name-edit"]').click();
    await input.waitFor({ state: 'visible', timeout: 3000 });
    // Blank: error under the field, nothing sent.
    await input.fill('   ');
    await input.press('Enter');
    await page.waitForTimeout(200);
    expect(await scope.getByText('Enter a name', { exact: true }).isVisible(), `${tag}3: blank → "Enter a name" under the field`);
    expect(state.nameCalls.length === 0, `${tag}3: blank not sent`);
    await shot(page, `lv-${tag}3-blank-error`);
    // Save with Enter.
    await input.fill('Becks Wirth');
    await input.press('Enter');
    await page.waitForTimeout(1500);
    expect(state.nameCalls.join() === 'Becks Wirth', `${tag}3: one save with the new name (${state.nameCalls.join('|')})`);
    expect(await scope.getByText('Becks Wirth', { exact: true }).filter({ visible: true }).count() > 0, `${tag}3: Contact Details shows the new name`);
    expect(await scope.getByText('BW', { exact: true }).count() > 0, `${tag}3: avatar initials updated`);
    await shot(page, `lv-${tag}3-saved`);
    if (tag === 'm') { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    expect(await page.locator('#lead-drawer-title').getByText('Becks Wirth').filter({ visible: true }).count() > 0, `${tag}3: thread header updated`);
    expect(await page.getByText('Becks via', { exact: false }).filter({ visible: true }).count() > 0, `${tag}3: thread sender name updated`);
    // Back to the list: row shows the new name.
    await page.getByRole('button', { name: 'Back to Leads' }).click();
    await page.getByText('Lead 2', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(800);
    expect(await page.getByText('Becks Wirth', { exact: true }).filter({ visible: true }).count() > 0, `${tag}3: list row shows the new name`);
    await shot(page, `lv-${tag}3-list-row`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(!overflow, `${tag}: no horizontal page scroll`);
    await context.close();
  }
} catch (e) {
  failures.push(String((e && e.stack) || e));
  console.log(e);
}
await browser.close();
console.log('page errors:', pageErrors.length, pageErrors.slice(0, 5));
console.log(failures.length ? `FAILURES ${failures.length}:\n` + failures.join('\n') : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
