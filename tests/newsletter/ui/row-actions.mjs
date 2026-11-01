// Newsletters list row actions (Chris, 1 Nov 2026): the "⋯" menu button is plain like the Edit action beside it —
// no border or outline at rest, grey, light grey on hover — and a keyboard user still sees where focus is (the same
// purple focus ring as Edit, keyboard focus only). Desktop table and phone cards.
// Leads → Lists rows had the same pattern: after a click the menu put focus back on "⋯" and the ring stayed there.
// Now focus goes back to "⋯" only after a keyboard close (utils/menuFocus).
// node tests/newsletter/ui/row-actions.mjs   (needs the dev server: NL_BASE, default http://localhost:5291)
// Every API call is answered here and every non-local request is aborted: nothing leaves this machine.
// Screenshots: NL_SHOTS (default /private/tmp/claude-501/newsletter-row-actions/shots).
import { mkdirSync } from 'fs';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const BASE = process.env.NL_BASE || 'http://localhost:5291';
const OUT = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletter-row-actions/shots';
mkdirSync(OUT, { recursive: true });

const SERPA = { id: 708, external_user_id: 889, name: 'Serpa Chrysler', email: 'serpa@dealer.test', role: '2', status: 1, is_activated: true };
const counts = { recipients: 120, delivered: 118, opened: 40, clicked: 12, failed: 0, skipped: 2, unsubscribed: 0, queued: 0, sent: 118 };
const newsletter = (id, status, name) => ({ id, name, subject: `${name} subject`, preview_text: null, from_name: 'Serpa', reply_to_email: null, channels: ['email'], sms_text: null, template: 'basic', header: {}, audience: [], status, scheduled_at: null, sent_at: status === 'sent' ? '2026-10-30T10:00:00Z' : null, public_url: null, counts, created_at: '2026-10-29T10:00:00Z', updated_at: '2026-10-30T10:00:00Z' });

const CONTACT_LISTS = [
  { id: 7, name: 'VIP buyers', source: 'manual', member_count: 12, email_count: 10, sms_count: 8, consent_type: 'express', created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-30T10:00:00Z', unsubscribed_count: 1 },
  { id: 8, name: 'Service customers', source: 'import', member_count: 40, email_count: 38, sms_count: 20, consent_type: 'implied', created_at: '2026-10-21T10:00:00Z', updated_at: '2026-10-29T10:00:00Z', unsubscribed_count: 0 },
];

const failures = [];
const blocked = new Set();
const expect = (ok, label) => { if (!ok) failures.push(label); console.log(ok ? '  ok  ' : '  FAIL', label); };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function open(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', locale: 'en-US', hasTouch: width < 1024, isMobile: width < 1024 });
  await context.addInitScript(([user]) => {
    if (sessionStorage.getItem('nl-seeded')) return;
    sessionStorage.setItem('nl-seeded', '1');
    localStorage.clear();
    localStorage.setItem('stasht_token', 'serpa-token');
    localStorage.setItem('stasht_user', JSON.stringify(user));
    localStorage.setItem('view_type', 'personal');
    localStorage.setItem('stasht_campaigns_view', 'newsletters');
  }, [SERPA]);
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (!local && !url.pathname.startsWith('/api/react/')) { blocked.add(url.hostname); return route.abort('blockedbyclient'); }
    if (/^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p = url.pathname.replace(/^\/api\/react/, '');
    if (p === '/user/storage-overview') return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: 'Professional' } } } });
    if (/^\/newsletters\/\d+\/duplicate$/.test(p)) return route.fulfill({ json: { success: true, data: newsletter(3, 'draft', 'Copy of October Recap') } });
    if (p === '/contact-lists' && route.request().method() === 'GET') return route.fulfill({ json: { success: true, data: CONTACT_LISTS } });
    if (/^\/contact-lists\/\d+\/duplicate$/.test(p)) return route.fulfill({ json: { success: true, data: { ...CONTACT_LISTS[0], id: 9, name: 'VIP buyers (copy)' } } });
    if (p === '/newsletters') return route.fulfill({ json: { success: true, data: [newsletter(1, 'draft', 'November Offers'), newsletter(2, 'sent', 'October Recap')] } });
    if (p.startsWith('/dashboard/')) return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/memories`);
  return { context, page };
}

const look = (locator) => locator.evaluate((el) => {
  const s = getComputedStyle(el);
  return { border: parseFloat(s.borderTopWidth) || 0, shadow: s.boxShadow, outline: s.outlineStyle === 'none' || s.outlineColor === 'rgba(0, 0, 0, 0)' ? 'none' : `${s.outlineWidth} ${s.outlineColor}`, bg: s.backgroundColor, focusVisible: el.matches(':focus-visible') };
});

try {
  for (const [width, height] of [[1700, 900], [390, 844]]) {
    const tag = String(width);
    const { page, context } = await open(width, height);
    // Radix hides everything outside an open menu with aria-hidden, so the buttons are found by their label.
    const menu = page.locator('button[aria-label="Actions for November Offers"]').filter({ visible: true }).first();
    const edit = page.locator('button[aria-label="Edit November Offers"]').filter({ visible: true }).first();
    await menu.waitFor({ state: 'visible', timeout: 40000 });
    await page.waitForTimeout(600);
    const row = page.locator('[data-newsletter-row="1"]').filter({ visible: true }).first();

    const rest = await look(menu);
    const editRest = await look(edit);
    console.log(tag, 'rest', JSON.stringify({ menu: rest, edit: editRest }));
    expect(rest.border === 0 && editRest.border === 0, `${tag}: ⋯ has no border, like Edit`);
    expect(rest.shadow === 'none' && rest.outline === 'none', `${tag}: ⋯ has no outline or ring at rest`);
    expect(rest.bg === editRest.bg, `${tag}: ⋯ has Edit's background (${rest.bg})`);
    await row.screenshot({ path: `${OUT}/${tag}-1-row-rest.png` });

    if (width >= 1024) {
      await menu.hover();
      await page.waitForTimeout(250);
      const hover = await look(menu);
      expect(hover.bg !== rest.bg && hover.border === 0 && hover.shadow === 'none', `${tag}: hover is a light grey fill, still no border (${hover.bg})`);
      await row.screenshot({ path: `${OUT}/${tag}-2-row-hover.png` });
      await page.mouse.move(5, 5);
    }

    // A mouse click opens the menu; closing it with a click elsewhere leaves no ring behind.
    await menu.click();
    await page.getByRole('menuitem').first().waitFor({ state: 'visible', timeout: 5000 });
    await page.screenshot({ path: `${OUT}/${tag}-3-menu-open.png` });
    await page.mouse.click(Math.round(width / 2), 160);
    await page.waitForTimeout(400);
    const afterClick = await look(menu);
    expect(afterClick.shadow === 'none' && afterClick.border === 0, `${tag}: no ring or border after the menu closes (${afterClick.shadow})`);

    // Keyboard: Tab from Edit lands on ⋯ with a visible focus ring; Enter opens the menu.
    if (width >= 1024) {
      await edit.focus();
      await page.keyboard.press('Tab');
      await page.waitForTimeout(150);
      const kb = await look(menu);
      const editKb = await (async () => { await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(150); const l = await look(edit); await page.keyboard.press('Tab'); await page.waitForTimeout(150); return l; })();
      console.log(tag, 'keyboard', JSON.stringify({ menu: kb, edit: editKb }));
      expect(kb.focusVisible && kb.shadow !== 'none', `${tag}: keyboard focus on ⋯ shows a ring (${kb.shadow})`);
      expect(kb.shadow === editKb.shadow, `${tag}: the same focus ring as Edit`);
      await row.screenshot({ path: `${OUT}/${tag}-4-row-keyboard-focus.png` });
      await page.keyboard.press('Enter');
      expect(await page.getByRole('menuitem').first().isVisible().catch(() => false), `${tag}: Enter opens the menu`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const back = await look(menu);
      expect(back.focusVisible && back.shadow !== 'none', `${tag}: Escape puts keyboard focus back on ⋯, ring shown`);
    }
    // A mouse pick of a menu item (Duplicate on the sent row) leaves no ring on its ⋯ either.
    const sentMenu = page.locator('button[aria-label="Actions for October Recap"]').filter({ visible: true }).first();
    await page.mouse.click(Math.round(width / 2), 160);
    await sentMenu.click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await page.waitForTimeout(500);
    const afterPick = await look(sentMenu);
    expect(afterPick.shadow === 'none', `${tag}: no ring after picking a menu item with the mouse (${afterPick.shadow})`);
    await context.close();
  }

  // ---------- Leads → Lists rows ----------
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = `lists ${width}`;
    const { page, context } = await open(width, height);
    await page.goto(`${BASE}/leads`);
    const listsTab = page.getByRole('button', { name: /^Lists/ }).filter({ visible: true }).first();
    await listsTab.waitFor({ state: 'visible', timeout: 40000 });
    await listsTab.click();
    const menu = page.locator('button[aria-label="Actions for VIP buyers"]').filter({ visible: true }).first();
    await menu.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500);
    const rest = await look(menu);
    expect(rest.border === 0 && rest.shadow === 'none', `${tag}: ⋯ plain at rest`);
    await menu.click();
    await page.getByRole('menuitem', { name: 'Rename' }).waitFor({ state: 'visible', timeout: 5000 });
    await page.screenshot({ path: `${OUT}/${width}-lists-1-menu-open.png` });
    await page.mouse.click(Math.round(width / 2), 120);
    await page.waitForTimeout(400);
    const afterClick = await look(menu);
    expect(afterClick.shadow === 'none', `${tag}: no ring after the menu closes on a click elsewhere (${afterClick.shadow})`);
    await menu.click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await page.waitForTimeout(600);
    const afterPick = await look(menu);
    expect(afterPick.shadow === 'none', `${tag}: no ring after picking Duplicate with the mouse (${afterPick.shadow})`);
    // Rename opens a dialog; closing it with the mouse leaves no ring on "⋯" either.
    await menu.click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const cancel = page.getByRole('button', { name: 'Cancel' }).filter({ visible: true }).first();
    await cancel.waitFor({ state: 'visible', timeout: 5000 });
    await cancel.click();
    await page.waitForTimeout(500);
    const afterDialog = await look(menu);
    expect(afterDialog.shadow === 'none', `${tag}: no ring after Rename → Cancel with the mouse (${afterDialog.shadow})`);
    await page.locator('table, ul').filter({ hasText: 'VIP buyers' }).filter({ visible: true }).first().screenshot({ path: `${OUT}/${width}-lists-2-after-menu.png` }).catch(() => {});
    if (width >= 1024) {
      await menu.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('menuitem', { name: 'Rename' }).waitFor({ state: 'visible', timeout: 5000 });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const back = await look(menu);
      expect(back.focusVisible && back.shadow !== 'none', `${tag}: Escape puts keyboard focus back on ⋯ with its ring (${back.shadow})`);
      await page.locator('table').filter({ hasText: 'VIP buyers' }).first().screenshot({ path: `${OUT}/${width}-lists-3-keyboard-focus.png` }).catch(() => {});
    }
    await context.close();
  }
} catch (e) {
  failures.push(`crashed: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
}

console.log('blocked hosts:', [...blocked].join(', ') || 'none');
if (failures.length) {
  console.log(`\n${failures.length} FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nALL PASSED');
