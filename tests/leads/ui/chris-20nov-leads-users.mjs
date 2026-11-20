// Chris 20 Nov 2026, issues after deploy (I6, I7, I8), mocked API, 1280 + 390:
//  I6. Users (TheBodyPolitik): an Admin invited but not yet in the account (the web API now answers status 'invited',
//      joined false, no last_active_at, memory_count = this account's campaigns only) shows PENDING, "0 created",
//      Last active "Never", Joined "—"; the cards agree (Pending Invites 1, Active Users counts joined people only,
//      Collaborations = campaigns shared with accepted people); the sidebar Users badge follows the page's fresh total.
//  I7. Leads → "+ Send Message" → "Send as": the business itself (TheRoyalWoodShop, logo/initials) is the FIRST option
//      and starts picked when the account has only staff External accounts; placeholder wording "Choose a sender";
//      the sign-off is the business alone ("— TheRoyalWoodShop."), SMS and Email; Send carries send_as: 'account' and
//      no property_id; picking a person's account still sends property_id.
//  I8. "+ Campaign" has a purple border like "+ Products"' green one: same border width, radius and height — in
//      "+ Send Message" and in the lead chat composer.
// node tests/leads/ui/chris-20nov-leads-users.mjs   (dev server: C20L_BASE, default http://127.0.0.1:5242;
//   C20L_SHOTS = screenshot dir). Every API call is answered here; every non-local request is aborted.
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.C20L_BASE || 'http://127.0.0.1:5242';
const OUT = process.env.C20L_SHOTS || '/private/tmp/claude-501/c20i-L/shots';
mkdirSync(OUT, { recursive: true });

const ROYAL = { id: 708, external_user_id: 959, name: 'TheRoyalWoodShop', email: 'owner@royalwood.test', role: '2', status: 1, is_activated: true };
const TBP = { id: 900, external_user_id: 1900, name: 'TheBodyPolitik', email: 'owner@tbp.test', role: '2', status: 1, is_activated: true };
const now = new Date().toISOString();
const KIM = { id: 12, source: 'memory', user: { id: null, name: 'Kim Lee', email: 'kim@example.test', phone_number: '+14165550298' }, story: null, campaign_deleted: false, source_list: null, status: null, engagement: 1, comments: [], messages_count: 1, sent_count: 0, received_count: 1, unread_count: 0, comment_unread_count: 0, last_engaged_at: now, first_seen_at: now, last_activity_at: now, property_id: null, assignee: { id: 959, name: 'TheRoyalWoodShop' }, latest_message: { body: 'Do you have MDF panels?', direction: 'inbound', channel: 'sms', sender_name: null, sent_at: now, attachment_name: null }, notes: null, can_message: true, is_rollup: false, can_assign: true, can_accept: false, account: null, can_delete: true, waiting: false, released_from: null, claimed: false, can_open: true, can_remove: false, joined: false, can_join: false, can_mark_unread: false };
// Royal Wood (Chris's screenshot): only its staff's External accounts.
const MY_PROPS = [{ id: 12, name: 'Chris Becks' }, { id: 14, name: 'Andrew S.' }, { id: 15, name: 'Lindsay H.' }];
const FULL_ROWS = MY_PROPS.map((p) => ({ id: p.id, name: p.name, is_creator: true, account_type: 'external', account_created_for_property: true, user_id: 1300 + p.id }));
const ITEMS = [{ id: 501, title: 'Fine Line Router Carved MDF', category: 'MDF', price_label: '$120', main_image: null }];

// Users rows as GET /user/collaborators-and-non-collaborators answers after the fix.
const CHRISTIAN = { id: 2001, collaborator_id: 31, external_user_id: 2001, name: 'Christian Beckermann', email: 'christian@tbp.test', phone_number: null, profile_image: null, role: 'user', collaborator_role: 'admin', status: 'invited', joined: false, created_at: now, last_active_at: null, is_user_collaborator: true, collaborator_type: 'user', is_account_admin: true, memory: { id: null, title: 'All Memories (Account Admin)' }, memory_count: 0, shared_memory_count: 0, properties: [], properties_count: 0, unread_messages_count: 0 };
const AIDEN = { ...CHRISTIAN, id: 2002, collaborator_id: 32, external_user_id: 2002, name: 'Aiden Linda', email: 'aiden@tbp.test', status: 1, joined: true, last_active_at: now, created_at: '2026-10-02T10:00:00Z' };
const KIMV = { ...CHRISTIAN, id: 2003, collaborator_id: 33, external_user_id: 2003, name: 'Kim Viewer', email: 'kimv@tbp.test', collaborator_role: 'view', status: 1, joined: true, is_account_admin: false, last_active_at: now, memory: { id: 55, title: 'Waxing 101' }, created_at: '2026-10-05T10:00:00Z' };

const failures = [];
const pageErrors = [];
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open({ width, height, user, path, usersRows = [] }) {
  const state = { starts: [], usersRows };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([seed]) => {
    if (sessionStorage.getItem('c20l-seeded')) return;
    sessionStorage.setItem('c20l-seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, [{ stasht_token: 'owner-token', stasht_user: user, view_type: 'personal' }]);
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
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (p === '/properties' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { properties: FULL_ROWS, owned_properties: FULL_ROWS, shared_properties: [], owned_count: 3, shared_count: 0, total_count: 3 } } });
    if (p === '/storeels/my-properties') return route.fulfill({ json: { success: true, properties: MY_PROPS } });
    if (p === '/user/collaborators-and-non-collaborators') {
      const rows = state.usersRows;
      return route.fulfill({ json: { success: true, data: { collaborators: rows, total_unread_messages: 0, pagination: { current_page: 1, per_page: 60, total: rows.length, total_pages: 1, has_more: false } } } });
    }
    if (p === '/leads' && req.method() === 'GET') return route.fulfill({ json: { total: 1, status_counts: {}, messages_total: 0, tab_counts: { open: 1, closed: 0 }, leads: [KIM], team_leads: null } });
    if (p === '/leads/unread-count') return route.fulfill({ json: { total_unread_messages: 0, total_unread_comments: 0, total_unread: 0 } });
    if (p === '/leads/campaign-sources') return route.fulfill({ json: { success: true, data: { vehicles: false, products: true } } });
    if (p === '/website-catalogue') return route.fulfill({ json: { success: true, data: { available: true, item_count: ITEMS.length } } });
    if (p === '/website-catalogue/items') return route.fulfill({ json: { success: true, data: { items: ITEMS, pagination: { last_page: 1 } } } });
    if (p === '/leads/start-conversation' && req.method() === 'POST') {
      state.starts.push(req.postDataJSON());
      return route.fulfill({ json: { success: true, data: { lead_id: 12, created: false } } });
    }
    if (/^\/leads\/12\/messages$/.test(p)) return route.fulfill({ json: { messages: [{ id: 1, parent_message_id: null, direction: 'inbound', channel: 'sms', body: 'Do you have MDF panels?', subject: null, status: 'received', is_ai: false, is_read: true, sent_at: now, attachments: [] }], events: [], visitor_online: false, widget_ai: null } });
    if (/^\/leads\/\d+\/messages\/mark-read$/.test(p)) return route.fulfill({ json: { marked_read: 0 } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}${path}`);
  return { context, page, state };
}

const shot = async (page, file) => { const path = `${OUT}/${file}.png`; await page.screenshot({ path }); console.log('shot', path); };
const box = (loc) => loc.evaluate((el) => {
  const s = getComputedStyle(el); const r = el.getBoundingClientRect();
  return { bw: s.borderTopWidth, bc: s.borderTopColor, radius: s.borderTopLeftRadius, h: Math.round(r.height), px: s.paddingLeft, fw: s.fontWeight, bg: s.backgroundColor };
});
const PURPLE_200 = /233, 213, 255/;

async function checkPair(products, campaign, label) {
  const [pb, cb] = [await box(products), await box(campaign)];
  expect(cb.bw === '1px' && PURPLE_200.test(cb.bc), `${label}: "+ Campaign" has a 1px purple-200 border (${cb.bw} ${cb.bc})`);
  expect(pb.bw === cb.bw && pb.radius === cb.radius && pb.h === cb.h && pb.px === cb.px && pb.fw === cb.fw,
    `${label}: same border width / radius / height / padding / weight as "+ Products" (${JSON.stringify(pb)} vs ${JSON.stringify(cb)})`);
  expect(/250, 245, 255/.test(cb.bg), `${label}: "+ Campaign" keeps its light purple fill (${cb.bg})`);
}

try {
  for (const [width, height, tag] of [[1280, 900, 'd'], [390, 844, 'm']]) {
    // ───────── I7 + I8: Leads (Royal Wood)
    {
      const { page, context, state } = await open({ width, height, user: ROYAL, path: '/leads' });
      await page.getByText('Kim Lee').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 40000 });
      const sendMessage = page.getByRole('button', { name: /Send Message/ }).filter({ visible: true }).first();
      if (await sendMessage.count()) await sendMessage.click();
      else {
        await page.locator('nav.phone-bottom-bar-pin button.rounded-full').first().click();
        await page.getByRole('button', { name: /Send Message/ }).filter({ visible: true }).first().click();
      }
      const dlg = page.getByRole('dialog', { name: 'Start a new message' });
      await dlg.waitFor({ state: 'visible', timeout: 15000 });
      const sendAs = dlg.getByRole('combobox', { name: 'Send as' });
      await sendAs.waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(500);
      expect(/TheRoyalWoodShop/.test(await sendAs.innerText()), `${tag}I7: "Send as" starts on the business (got "${(await sendAs.innerText()).trim()}")`);
      const body = dlg.locator('#sm-body');
      const smsBody = await body.inputValue();
      expect(/— TheRoyalWoodShop\.$/.test(smsBody) && !/ at TheRoyalWoodShop/.test(smsBody), `${tag}I7: SMS sign-off is the business alone ("${smsBody}")`);

      const products = dlg.getByRole('button', { name: 'Add products to your message' });
      const campaign = dlg.getByRole('button', { name: /^Campaign/ });
      await products.waitFor({ state: 'visible', timeout: 10000 });
      await checkPair(products, campaign, `${tag}I8 Send Message`);
      await shot(page, `c20iL-${tag}1-send-as-business`);

      await sendAs.click();
      const options = page.getByRole('option');
      await options.first().waitFor({ state: 'visible', timeout: 5000 });
      const names = (await options.allInnerTexts()).map((t) => t.trim());
      expect(names[0].endsWith('TheRoyalWoodShop') && names.length === 4, `${tag}I7: business first, then the 3 people (${JSON.stringify(names)})`);
      expect(await page.getByRole('option').first().locator('span.rounded-full, [class*="rounded-full"]').count() > 0, `${tag}I7: business option shows its logo / initials`);
      await shot(page, `c20iL-${tag}2-send-as-options`);
      await page.getByRole('option', { name: 'Andrew S.' }).click();
      expect(/Andrew S\./.test(await sendAs.innerText()), `${tag}I7: can pick a person's account`);
      await sendAs.click();
      await page.getByRole('option', { name: /TheRoyalWoodShop/ }).click();

      // Email tab: same sign-off; subject from the business.
      await dlg.getByRole('button', { name: /Email/ }).click();
      const emailBody = await body.inputValue();
      expect(/— TheRoyalWoodShop\.$/.test(emailBody), `${tag}I7: Email sign-off is the business alone ("${emailBody}")`);
      expect((await dlg.locator('#sm-subject').inputValue()) === 'Checking in from TheRoyalWoodShop', `${tag}I7: Email subject from the business`);
      await shot(page, `c20iL-${tag}3-email-business`);
      await dlg.getByRole('button', { name: /Text \(SMS\)/ }).click();

      await dlg.locator('#sm-phone').fill('4165550298');
      await dlg.getByRole('button', { name: /^Send$/ }).click();
      await page.waitForTimeout(800);
      const sent = state.starts[0] || {};
      expect(state.starts.length === 1 && sent.send_as === 'account' && !('property_id' in sent), `${tag}I7: Send carries send_as 'account' and no property_id (${JSON.stringify(sent)})`);
      expect(/— TheRoyalWoodShop\.$/.test(sent.body || ''), `${tag}I7: the sent text is signed by the business`);
      await dlg.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

      // I8 in the lead chat composer.
      // Send opens the lead's chat (LeadsPage onSent); open it from the list when it isn't up yet.
      const input = page.getByPlaceholder(/Type a message to Kim/).filter({ visible: true }).first();
      await input.waitFor({ state: 'visible', timeout: 4000 }).catch(async () => {
        await page.getByText('Kim Lee').filter({ visible: true }).first().click();
      });
      await input.waitFor({ state: 'visible', timeout: 20000 });
      const cProducts = page.getByRole('button', { name: 'Add products to your message' }).filter({ visible: true }).first();
      const cCampaign = page.getByRole('button', { name: 'Add a campaign to your message' }).filter({ visible: true }).first();
      await cProducts.waitFor({ state: 'visible', timeout: 10000 });
      await checkPair(cProducts, cCampaign, `${tag}I8 composer`);
      await cCampaign.scrollIntoViewIfNeeded();
      await shot(page, `c20iL-${tag}4-composer-pills`);
      // A person's account still goes out as before (property_id). Close the chat first.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
      const reopen = page.getByRole('button', { name: /Send Message/ }).filter({ visible: true }).first();
      if (await reopen.count()) await reopen.click();
      else {
        await page.locator('nav.phone-bottom-bar-pin button.rounded-full').first().click();
        await page.getByRole('button', { name: /Send Message/ }).filter({ visible: true }).first().click();
      }
      await dlg.waitFor({ state: 'visible', timeout: 15000 });
      await sendAs.waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(400);
      await sendAs.click();
      await page.getByRole('option', { name: 'Lindsay H.' }).click();
      await dlg.locator('#sm-phone').fill('4165550299');
      await dlg.getByRole('button', { name: /^Send$/ }).click();
      await page.waitForTimeout(800);
      const sent2 = state.starts[1] || {};
      expect(String(sent2.property_id) === '15' && !sent2.send_as, `${tag}I7: a person's account still sends property_id (${JSON.stringify(sent2)})`);
      await dlg.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(!overflow, `${tag}: Leads — no horizontal page scroll`);
      await context.close();
    }

    // ───────── I6: Users (TheBodyPolitik)
    {
      const { page, context, state } = await open({ width, height, user: TBP, path: '/users', usersRows: [AIDEN, KIMV] });
      await page.getByText('Aiden Linda').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 40000 });
      // Christian is invited now (as the Invite User modal would): the page reloads its list.
      state.usersRows = [CHRISTIAN, AIDEN, KIMV];
      await page.waitForTimeout(15500); // past authUtils' 15 s GET cache, as a write would clear it
      const search = page.getByPlaceholder('Search users or emails...').filter({ visible: true }).first();
      await search.fill('a');
      await page.waitForTimeout(900);
      await search.fill('');
      await page.getByText('Christian Beckermann').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 20000 });
      await page.waitForTimeout(600);

      const card = async (label) => {
        const el = page.getByText(label, { exact: true }).filter({ visible: true }).first();
        return (await el.locator('xpath=..').innerText()).replace(/\s+/g, ' ');
      };
      expect(/Total Users 3/.test(await card('Total Users')), `${tag}I6: Total Users 3 (${await card('Total Users')})`);
      expect(/Active Users 2/.test(await card('Active Users')), `${tag}I6: Active Users 2 (${await card('Active Users')})`);
      expect(/Pending Invites 1/.test(await card('Pending Invites')), `${tag}I6: Pending Invites 1 (${await card('Pending Invites')})`);
      expect(/Collaborations 1 /.test(await card('Collaborations')), `${tag}I6: Collaborations = 1 shared campaign, not people (${await card('Collaborations')})`);

      if (width >= 1024) {
        const row = page.locator('tr', { hasText: 'Christian Beckermann' }).first();
        const t = (await row.innerText()).replace(/\s+/g, ' ');
        expect(/PENDING/.test(t) && !/ACTIVE/.test(t), `${tag}I6: Christian's status is PENDING (${t})`);
        expect(/0 created/.test(t), `${tag}I6: 0 campaigns created in this account`);
        expect(/Never/.test(t) && !/Today/.test(t), `${tag}I6: Last active "Never", not "Today"`);
        expect(/—/.test(t) && !/Nov \d+, 2026/.test(t.split('Never')[1] || ''), `${tag}I6: Joined shows "—" for an invite`);
        const aiden = (await page.locator('tr', { hasText: 'Aiden Linda' }).first().innerText()).replace(/\s+/g, ' ');
        expect(/ACTIVE/.test(aiden) && /Today/.test(aiden), `${tag}I6: a joined Admin is still ACTIVE / Today`);
      } else {
        const cardEl = page.getByText('Christian Beckermann').filter({ visible: true }).first().locator('xpath=ancestor::div[contains(@class,"flex")][3]');
        const t = (await cardEl.innerText()).replace(/\s+/g, ' ');
        expect(/PENDING/.test(t) && /0 created/.test(t) && /Active: Never/.test(t) && /Invited:/.test(t), `${tag}I6: phone card PENDING, 0 created, Active: Never, Invited: (${t})`);
      }

      // Sidebar badge follows the page (it was read at sign-in: 2).
      // (Phone: no sidebar — the visible "Users" is the bottom nav, which has no count.)
      const nav = page.getByRole('button', { name: /^Users/ }).filter({ visible: true }).first();
      if (width >= 1024 && await nav.count()) {
        const navText = (await nav.innerText()).replace(/\s+/g, ' ');
        expect(/3/.test(navText), `${tag}I6: sidebar Users badge 3 like the table (${navText})`);
      } else {
        console.log(`  (${tag}: sidebar not shown at this width — badge checked at 1280)`);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, `c20iL-${tag}5-users-invited-admin`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(!overflow, `${tag}: Users — no horizontal page scroll`);
      await context.close();
    }
  }
} catch (e) {
  failures.push(String((e && e.stack) || e));
  console.log(e);
}
await browser.close();
console.log('page errors:', pageErrors.length, pageErrors.slice(0, 5));
console.log(failures.length ? `FAILURES ${failures.length}:\n` + failures.join('\n') : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
