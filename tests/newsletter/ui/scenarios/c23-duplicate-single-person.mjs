// Chris 23 Nov 2026 (point B): "Copy of November 2026" kept Send to = Single person with chrisgrafix77@gmail.com filled
// in. The web API's duplicate now leaves the Single person out (NewsletterController::copiedAudience; mock-api mirrors
// it), so the copy opens on Single person with an empty Email address box, nothing in the Recipients header, and the
// original keeps its person. A copy of a list newsletter keeps the list. 1280 and 390.
import { createMockApi, newsletter } from '../mock-api.mjs';

const PERSON = 'chrisgrafix77@gmail.com';

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const [width, height] of [[1280, 1000], [390, 844]]) {
    const api = createMockApi({
      newsletters: [
        newsletter(31, { name: 'November 2026', subject: 'November news', status: 'sent', sent_at: '2026-11-20T15:00:00Z', audience: [{ type: 'person', email: PERSON }] }),
        newsletter(32, { name: 'Open house', subject: 'Open house', status: 'draft', audience: [{ type: 'list', id: 9 }] }),
      ],
    });
    const { page, context } = await open({ view: 'campaigns', width, height, api });
    await page.getByRole('radio', { name: /^Newsletters/ }).first().click().catch(() => {});
    const actions = (name) => page.getByRole('button', { name: `Actions for ${name}`, exact: true }).filter({ visible: true }).first();
    await expectVisible(actions('November 2026'), `${width}: November 2026 listed`);
    await page.waitForTimeout(500);

    await actions('November 2026').click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expectVisible(page.getByText('Copied. The copy is a draft.'), `${width}: duplicate toast`);
    const copy = api.state.newsletters.find((n) => n.name === 'Copy of November 2026');
    expect(!!copy, `${width}: the API made "Copy of November 2026"`);
    expect(JSON.stringify(copy?.audience) === '[]', `${width}: the copy has no Single person (got ${JSON.stringify(copy?.audience)})`);
    expect(JSON.stringify(api.state.newsletters.find((n) => n.id === 31)?.audience) === JSON.stringify([{ type: 'person', email: PERSON }]), `${width}: the original keeps its person`);
    await page.waitForTimeout(400);
    await shot(page, `${width}-01-copied`);

    // Open the copy from the toast's Edit, as Chris would.
    await page.locator('[data-sonner-toast]').getByRole('button', { name: 'Edit' }).click();
    const step = page.locator('#nl-step-recipients');
    await expectVisible(step, `${width}: composer opened on the copy`);
    await page.waitForTimeout(1200);
    const sendTo = step.getByRole('button', { name: /^Send to/ });
    expect(((await sendTo.textContent()) ?? '').includes('Single person'), `${width}: Send to stays Single person (got "${await sendTo.textContent()}")`);
    const email = step.getByLabel('Email address');
    await expectVisible(email, `${width}: Email address box`);
    expect((await email.inputValue()) === '', `${width}: Email address empty (got "${await email.inputValue()}")`);
    const header = (await step.locator('header').textContent()) ?? '';
    expect(!header.includes(PERSON), `${width}: Recipients header doesn't show the old address (got "${header}")`);
    expect(!(await page.getByText(PERSON).filter({ visible: true }).count()), `${width}: the old address is nowhere on screen`);
    expect(!(await hasOverflow(page)), `${width}: no sideways scroll`);
    await step.scrollIntoViewIfNeeded();
    await shot(page, `${width}-02-copy-recipients-empty`);

    // Typing a new person works and saves as usual.
    await email.fill('new.buyer@example.com');
    await page.waitForTimeout(1800);
    expect(JSON.stringify(api.state.newsletters.find((n) => n.name === 'Copy of November 2026')?.audience) === JSON.stringify([{ type: 'person', email: 'new.buyer@example.com' }]), `${width}: the new person saves on the copy`);
    await context.close();

    // A list newsletter's copy keeps the list.
    const api2 = createMockApi({ newsletters: [newsletter(32, { name: 'Open house', status: 'draft', audience: [{ type: 'list', id: 9 }] })] });
    const second = await open({ view: 'campaigns', width, height, api: api2 });
    await second.page.getByRole('radio', { name: /^Newsletters/ }).first().click().catch(() => {});
    const a2 = second.page.getByRole('button', { name: 'Actions for Open house', exact: true }).filter({ visible: true }).first();
    await expectVisible(a2, `${width}: Open house listed`);
    await a2.click();
    await second.page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expectVisible(second.page.getByText('Copied. The copy is a draft.'), `${width}: list copy toast`);
    expect(JSON.stringify(api2.state.newsletters.find((n) => n.name === 'Copy of Open house')?.audience) === JSON.stringify([{ type: 'list', id: 9 }]), `${width}: the list is kept`);
    await second.context.close();
  }
}
