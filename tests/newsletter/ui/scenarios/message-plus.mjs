// The Message section is always first under the header (live screenshot, 3 Nov): no "+" between the header and the
// message, one right below it; a section added there, or moved up, never goes above it. No message: unchanged.
import { createMockApi, newsletter } from '../mock-api.mjs';

const ID = 'nl-message';
const SHOTS = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
const draft = (over = {}) => newsletter(23, {
  name: 'October Newsletter 2026', subject: 'October deals are here', from_name: 'Royal Woodshop', reply_to_email: 'sales@royalwoodshop.ca',
  channels: ['email'], sms_text: '', blocks: [{ id: 'b1', type: 'title', data: { text: 'This month', size: 'large' } }], ...over,
});
const order = (page) => page.locator('aside [data-block-id]').evaluateAll((els) => els.map((el) => el.getAttribute('data-block-id')));
// The + buttons and sections in page order, as 'plus' / block id.
const layout = (page) => page.locator('aside [data-block-id], aside button[aria-label^="Add a section"]').evaluateAll((els) =>
  els.map((el) => el.getAttribute('data-block-id') ?? 'plus'));

export async function run({ open, expectVisible, expect, hasOverflow }) {
  for (const width of [1280, 390]) {
    // With a message.
    const api = createMockApi({ newsletters: [draft({ sms_text: 'Hey Team, see you soon' })] });
    const { page, context } = await open({ width, height: width === 390 ? 844 : 1800, api, query: '&newsletterId=23' });
    const msg = page.locator(`aside [data-block-id="${ID}"]`);
    await expectVisible(msg, `${width}: message in the preview`);
    await page.waitForTimeout(1500);
    let l = await layout(page);
    expect(l.join(',') === `${ID},plus,b1,plus`, `${width}: no + above the message, one below (${l.join(',')})`);
    expect(await page.getByRole('button', { name: 'Add a section at the top' }).count() === 0, `${width}: no "at the top" +`);
    const plus = page.getByRole('button', { name: 'Add a section after section 1' });
    const [mb, pb] = [await msg.boundingBox(), await plus.boundingBox()];
    expect(mb && pb && pb.y >= mb.y + mb.height - 1, `${width}: the first + is below the message`);
    expect(!(await hasOverflow(page)), `${width}: no sideways scroll`);
    await msg.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/message-plus-${width}-01-with-message.png` });

    // Move up on the first section stays off; Move down on the message too.
    await page.locator('aside [data-block-id="b1"]').click();
    expect(await page.locator('aside [data-block-id="b1"]').getByRole('button', { name: 'Move up' }).isDisabled(), `${width}: first section can't move above the message`);
    await page.locator('aside [data-block-id="b1"]').getByRole('button', { name: 'Done' }).click();
    await msg.click();
    expect(await msg.getByRole('button', { name: 'Move down' }).isDisabled(), `${width}: the message can't move down`);
    await msg.getByRole('button', { name: 'Done' }).click();

    // Adding with the first +: it goes below the message.
    await plus.click();
    await page.getByRole('menuitem', { name: /Divider/ }).click();
    await page.waitForTimeout(300);
    const o = await order(page);
    expect(o[0] === ID && o.length === 3 && o[2] === 'b1', `${width}: added section goes below the message (${o.join(',')})`);
    await context.close();

    // Without a message: the + above the first section stays.
    const api2 = createMockApi({ newsletters: [draft()] });
    const plain = await open({ width, height: width === 390 ? 844 : 1800, api: api2, query: '&newsletterId=23' });
    await expectVisible(plain.page.locator('aside [data-block-id="b1"]'), `${width}: no message: section shown`);
    l = await layout(plain.page);
    expect(l.join(',') === 'plus,b1,plus', `${width}: no message: unchanged (${l.join(',')})`);
    await plain.page.locator('aside [data-block-id="b1"]').scrollIntoViewIfNeeded();
    await plain.page.waitForTimeout(300);
    await plain.page.screenshot({ path: `${SHOTS}/message-plus-${width}-02-no-message.png` });
    await plain.context.close();
  }
}
