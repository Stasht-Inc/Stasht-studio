// Review (batch 3): in the Leads page's group drawer at 1280 px the composer's "Send to N" button was clipped at the
// drawer's right edge (and its words broke over two lines). It now always sits whole inside the drawer, on one line.
import { createMockApi } from '../mock-api.mjs';

const SHOTS = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
const now = () => new Date().toISOString();

export async function run({ open, expectVisible, expect, hasOverflow }) {
  const member = (i) => ({ lead_id: 100 + i, status: 'warm', user: { id: 500 + i, name: `Lead ${i + 1}`, email: `lead${i + 1}@example.com`, profile_image: null, phone_number: null }, has_email: true, has_phone: false });
  const groups = [{ id: 4, name: 'Open house guests', member_count: 12, created_at: now(), updated_at: now(), members: [{ lead_id: 100, name: 'Lead 1', profile_image: null }] }];
  const groupDetails = { 4: { ...groups[0], members: Array.from({ length: 12 }, (_, i) => member(i)) } };
  // 1280 in App's main column (drawer about 280 px), 1280 full width, and a phone.
  for (const [width, query] of [[1280, '&appSidebars=1'], [1280, ''], [390, '']]) {
    const { page, context } = await open({ view: 'leads', width, height: 900, api: createMockApi({ groups, groupDetails }), query });
    await page.getByRole('button', { name: /^Groups/ }).click();
    await page.getByText('Open house guests').locator('visible=true').first().click();
    const send = page.getByRole('button', { name: /^Send to 12$/ }).locator('visible=true');
    await expectVisible(send, `${width}${query ? ' app' : ''}: Send to 12`);
    await page.waitForTimeout(400);
    const fit = await send.evaluate((btn) => {
      // The composer card around it (the nearest ancestor with a border) and the drawer (the nearest that clips).
      let card = btn.parentElement;
      while (card && parseFloat(getComputedStyle(card).borderRightWidth) === 0) card = card.parentElement;
      const c = (card ?? document.documentElement).getBoundingClientRect();
      const r = btn.getBoundingClientRect();
      // The words' line boxes: more than one distinct top means "Send to 12" broke over two lines.
      const tops = new Set();
      const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (!t.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(t);
        for (const x of range.getClientRects()) if (x.width > 0) tops.add(Math.round(x.top));
      }
      return {
        inside: r.left >= c.left - 0.5 && r.right <= c.right + 0.5 && r.right <= window.innerWidth + 0.5,
        oneLine: tops.size <= 1,
        right: Math.round(r.right), clipRight: Math.round(c.right), lines: tops.size,
      };
    });
    expect(fit.inside, `${width}${query ? ' app' : ''}: Send button whole inside the drawer (right ${fit.right} vs ${fit.clipRight})`);
    expect(fit.oneLine, `${width}${query ? ' app' : ''}: "Send to 12" on one line (got ${fit.lines} lines)`);
    expect(!(await hasOverflow(page)), `${width}${query ? ' app' : ''}: no sideways scroll`);
    await page.screenshot({ path: `${SHOTS}/group-drawer-send-${width}${query ? '-app' : ''}.png` });
    await context.close();
  }
}
