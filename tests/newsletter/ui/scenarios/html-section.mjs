// Chris, 16 Nov 2026 (C3): "Add section" has HTML (Storeel's HTML block: its label, wording and code icon). The section
// opens Storeel's "HTML Content" box ("Paste your HTML code here..."); what is pasted is saved and the API cleans it for
// email; the preview in the email shows the CLEANED copy (no script) in a frame that runs no scripts; the exact email
// preview shows it too. 1280 and 390.
// node tests/newsletter/ui/check.mjs html-section
import { createMockApi } from '../mock-api.mjs';

const PASTE = '<table width="100%"><tr><td style="background:#F3F4F6;padding:12px"><h3 id="nl-html-h">Spring sale</h3>'
  + '<p onclick="steal()">Sofas <strong>30% off</strong> — <a href="https://shop.test/sofas">Shop sofas</a></p></td></tr></table>'
  + '<script>window.__hacked = true;</script><iframe src="https://evil.test"></iframe>';

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const [width, height, tag] of [[1280, 1800, '1280'], [390, 1400, '390']]) {
    const { page, api, context } = await open({ width, height, api: createMockApi() });
    await page.locator('#nl-name').fill(`HTML check ${tag}`);
    const editor = tag === '1280' ? page.locator('aside') : page.locator('body');

    await editor.getByRole('button', { name: 'Add a section at the top' }).first().click();
    const item = page.getByRole('menuitem', { name: /^HTML/ });
    await expectVisible(item, `${tag}: HTML in Add section`);
    expect(/Add custom HTML content/.test(await item.innerText()), `${tag}: Storeel's wording "Add custom HTML content"`);
    // Scrolled to the end of the list, so the screenshot shows the new item.
    await item.scrollIntoViewIfNeeded();
    await shot(page, `${tag}-01-add-section-menu`);
    await item.click();

    const box = editor.getByLabel('HTML Content');
    await expectVisible(box, `${tag}: Storeel's "HTML Content" box opens`);
    expect(await box.getAttribute('placeholder') === 'Paste your HTML code here...', `${tag}: Storeel's placeholder`);
    await expectVisible(editor.getByText('Paste your HTML below.'), `${tag}: empty section says what to do`);
    await box.fill(PASTE);
    await page.waitForTimeout(1800); // autosave

    const saved = (api.state.newsletters[0]?.blocks || []).find((b) => b.type === 'html');
    expect(saved && !/script|iframe|onclick/i.test(saved.data.html) && /Spring sale/.test(saved.data.html), `${tag}: saved cleaned (got ${saved && saved.data.html})`);

    const frame = editor.locator('iframe[title="HTML section preview"]');
    await expectVisible(frame, `${tag}: preview in the email`);
    expect((await frame.getAttribute('sandbox')) === 'allow-same-origin', `${tag}: preview frame runs no scripts`);
    const inner = page.frameLocator('iframe[title="HTML section preview"]');
    await expectVisible(inner.locator('#nl-html-h'), `${tag}: preview shows the pasted HTML`);
    expect(await inner.locator('script, iframe, [onclick]').count() === 0, `${tag}: preview is the cleaned copy (no script, iframe or onclick)`);
    expect(!(await page.evaluate(() => window.__hacked === true)), `${tag}: the pasted script never ran`);
    const fh = (await frame.boundingBox())?.height ?? 0;
    expect(fh > 40, `${tag}: preview frame fits its content (${fh}px)`);
    await editor.getByText('Scripts, forms, iframes and videos are removed').first().scrollIntoViewIfNeeded();
    await shot(page, `${tag}-02-html-section`);

    // The exact email shows it too.
    await page.getByRole('button', { name: 'Preview exact email' }).first().click();
    await expectVisible(page.frameLocator('iframe[title="Exact email preview"]').locator('[data-mock-html] #nl-html-h'), `${tag}: exact email shows the HTML section`);
    await shot(page, `${tag}-03-exact-email`);
    await page.keyboard.press('Escape');
    expect(!(await hasOverflow(page)), `${tag}: no sideways scroll`);
    await context.close();
  }
}
