// Chris, 7 Nov 2026 (point 12): the Storeel page's Advanced filters get "Moderation" — small text "Moderate media
// before it goes live." and an on/off switch — after Labels, above the divider / Delete campaign. Per campaign: a new
// campaign starts at the account's setting; Edit shows the campaign's effective value; Save as Draft / Save Changes send
// the shown value. At 1280 and 390.
// node tests/newsletter/ui/check.mjs storeel-moderation   (NL_BASE = the dev server)
import { createMockApi, IMG } from '../mock-api.mjs';

const STOREEL_TITLE = 'Give your campaign a meaningful title';
const flow = (page) => page.getByRole('dialog', { name: /^(Create|Edit) Campaign$/ });
const button = (page, name) => flow(page).getByRole('button', { name, exact: true }).filter({ visible: true }).last();
const sw = (page) => page.getByRole('switch', { name: 'Moderation' });
const saved = (over) => ({
  id: 3021, title: 'Around the Mill', slug: 'mill', published: 0, is_car: 0, user_id: 990002, category: { id: 7, name: 'Personal' }, sub_category: null,
  min_uploaded_img_date: '2026-11-06', max_uploaded_img_date: '2026-11-06', location: '', tags: [], last_update_img: null,
  posts: [{ id: 1, parent_id: null, image_link: IMG, title: 'Front porch', description: '' }], ...over,
});

async function inView(page, locator) {
  const box = await locator.first().boundingBox();
  const vp = page.viewportSize();
  return Boolean(box && vp && box.y >= 0 && box.y + box.height <= vp.height + 1 && box.x >= 0 && box.x + box.width <= vp.width + 1);
}

async function openAdvanced(page) {
  const toggle = page.getByRole('button', { name: /^Advanced filters/ });
  await toggle.scrollIntoViewIfNeeded();
  await toggle.click();
  await sw(page).waitFor();
  await sw(page).scrollIntoViewIfNeeded();
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const [width, height] of [[1280, 1000], [390, 844]]) {
    const tag = String(width);

    // ── Create, account setting OFF: starts off; turn it on; Save as Draft sends true ───────────────────────────
    const api = createMockApi({ accountModeration: false });
    const { page, context } = await open({ width, height, api });
    await page.locator('#nl-name').waitFor();
    await page.getByRole('radio', { name: 'Storeel', exact: true }).click();
    await page.getByPlaceholder(STOREEL_TITLE).waitFor();
    await page.waitForTimeout(900);
    await page.getByPlaceholder(STOREEL_TITLE).fill(`Moderated ${tag}`);
    await openAdvanced(page);
    const row = page.getByTestId('st-moderation');
    expect(((await row.textContent()) ?? '').includes('Moderate media before it goes live.'), `${tag}: helper text`);
    expect((await sw(page).getAttribute('aria-checked')) === 'false', `${tag}: a new campaign starts at the account's setting (off)`);
    expect(await inView(page, sw(page)), `${tag}: the switch is in view`);
    // After Labels.
    const order = await page.locator('#create-campaign-advanced-filters').evaluate((el) => {
      const labels = [...el.querySelectorAll('label')].map((l) => l.textContent.trim().split(/\s/)[0]);
      return labels;
    });
    expect(order.indexOf('Labels') >= 0 && order.indexOf('Moderation') > order.indexOf('Labels'), `${tag}: Moderation comes after Labels (${order})`);
    await shot(page, `${tag}-01-create-off`);
    await sw(page).click();
    expect((await sw(page).getAttribute('aria-checked')) === 'true', `${tag}: switched on`);
    await page.waitForTimeout(400);
    await shot(page, `${tag}-02-create-on`);
    expect(!api.state.calls.some((c) => c.method === 'POST' && c.path === '/memories'), `${tag}: nothing saved by the switch`);
    await page.locator('#st-actions').scrollIntoViewIfNeeded();
    await button(page, 'Save as Draft').click();
    await page.waitForTimeout(1500);
    const post = api.state.calls.find((c) => c.method === 'POST' && c.path === '/memories');
    expect(post && post.body.moderation_enabled === true, `${tag}: Save as Draft sends moderation_enabled true (got ${JSON.stringify(post?.body?.moderation_enabled)})`);
    expect(!(await hasOverflow(page)), `${tag}: no sideways scroll`);
    await context.close();

    // ── Create, account ON, untouched: shows on, sends NOTHING (review I1: the campaign follows the account) ──────
    const on = createMockApi({ accountModeration: true });
    const o = await open({ width, height, api: on });
    await o.page.locator('#nl-name').waitFor();
    await o.page.getByRole('radio', { name: 'Storeel', exact: true }).click();
    await o.page.getByPlaceholder(STOREEL_TITLE).waitFor();
    await o.page.waitForTimeout(900);
    await o.page.getByPlaceholder(STOREEL_TITLE).fill(`Default ${tag}`);
    await openAdvanced(o.page);
    expect((await sw(o.page).getAttribute('aria-checked')) === 'true', `${tag}: account on → starts on`);
    await o.page.locator('#st-actions').scrollIntoViewIfNeeded();
    await button(o.page, 'Save as Draft').click();
    await o.page.waitForTimeout(1500);
    const post2 = on.state.calls.find((c) => c.method === 'POST' && c.path === '/memories');
    expect(post2 && !('moderation_enabled' in post2.body), `${tag}: untouched → not sent (follows the account) (got ${JSON.stringify(post2?.body?.moderation_enabled)})`);
    await o.context.close();

    // ── Edit: the campaign's own value (off, although the account is on); turn on; Save Changes sends true ─────
    const edit = createMockApi({ accountModeration: true, memories: { 3021: saved({ moderation_enabled: false, moderation_effective: false }) } });
    const e = await open({ width, height, api: edit, query: '&campaignId=3021' });
    await e.page.getByRole('heading', { name: 'Edit Campaign' }).waitFor();
    await e.page.waitForTimeout(900);
    await openAdvanced(e.page);
    expect((await sw(e.page).getAttribute('aria-checked')) === 'false', `${tag}: Edit shows the campaign's own value (off)`);
    const deleteBtn = e.page.getByRole('button', { name: 'Delete campaign' });
    const swBox = await sw(e.page).boundingBox();
    const delBox = await deleteBtn.boundingBox().catch(() => null);
    expect(!delBox || (swBox && swBox.y < delBox.y), `${tag}: above Delete campaign`);
    await shot(e.page, `${tag}-03-edit-off`);
    await sw(e.page).click();
    await e.page.locator('#st-actions').scrollIntoViewIfNeeded();
    await button(e.page, 'Save Changes').click();
    await e.page.waitForTimeout(1500);
    const put = edit.state.memoryPuts.at(-1);
    expect(put && put.body.moderation_enabled === true, `${tag}: Save Changes sends moderation_enabled true (got ${JSON.stringify(put?.body)})`);
    await e.context.close();

    // ── Edit an older campaign (no own value): shows what the account makes it do (on); an untouched Save Changes
    //    leaves it alone (review I1); Cancel saves nothing ─────────────────────────────────────────────────────────
    const older = createMockApi({ accountModeration: true, memories: { 3021: saved({ moderation_enabled: null, moderation_effective: true }) } });
    const d = await open({ width, height, api: older, query: '&campaignId=3021' });
    await d.page.getByRole('heading', { name: 'Edit Campaign' }).waitFor();
    await d.page.waitForTimeout(900);
    await openAdvanced(d.page);
    expect((await sw(d.page).getAttribute('aria-checked')) === 'true', `${tag}: an older campaign shows its effective value (on)`);
    await d.page.locator('#st-actions').scrollIntoViewIfNeeded();
    await button(d.page, 'Save Changes').click();
    await d.page.waitForTimeout(1500);
    const put2 = older.state.memoryPuts.at(-1);
    expect(put2 && !('moderation_enabled' in put2.body), `${tag}: untouched Save Changes leaves it alone (got ${JSON.stringify(put2?.body)})`);
    await d.context.close();
    const cancel = createMockApi({ accountModeration: true, memories: { 3021: saved({ moderation_enabled: null, moderation_effective: true }) } });
    const c = await open({ width, height, api: cancel, query: '&campaignId=3021' });
    await c.page.getByRole('heading', { name: 'Edit Campaign' }).waitFor();
    await c.page.waitForTimeout(900);
    await openAdvanced(c.page);
    await sw(c.page).click();
    await button(c.page, 'Cancel').click();
    await c.page.waitForTimeout(500);
    expect(!cancel.state.memoryPuts.length, `${tag}: Cancel saves nothing`);
    await c.context.close();

    // ── Review M2: only where moderation applies ──────────────────────────────────────────────────────────────
    const personal = createMockApi({ accountModeration: true });
    const p = await open({ width, height, api: personal, user: { id: 1, external_user_id: 990002, name: 'Pat Personal', email: 'pat@example.com', role: '1', profile_image: null, profile_color: '#F59E0B' } });
    await p.page.locator('#nl-name').waitFor();
    await p.page.getByRole('radio', { name: 'Storeel', exact: true }).click();
    await p.page.getByPlaceholder(STOREEL_TITLE).waitFor();
    await p.page.waitForTimeout(900);
    await p.page.getByRole('button', { name: /^Advanced filters/ }).click();
    await p.page.waitForTimeout(300);
    expect(!(await sw(p.page).count()), `${tag}: a personal account sees no Moderation switch`);
    await p.context.close();
    const notBiz = createMockApi({ accountModeration: true, memories: { 3021: saved({ moderation_enabled: null, moderation_effective: true, moderation_applies: false }) } });
    const nb = await open({ width, height, api: notBiz, query: '&campaignId=3021' });
    await nb.page.getByRole('heading', { name: 'Edit Campaign' }).waitFor();
    await nb.page.waitForTimeout(900);
    await nb.page.getByRole('button', { name: /^Advanced filters/ }).click();
    await nb.page.waitForTimeout(300);
    expect(!(await sw(nb.page).count()), `${tag}: Edit hides it when the campaign's owner isn't a business (moderation_applies false)`);
    await nb.context.close();
  }
}
