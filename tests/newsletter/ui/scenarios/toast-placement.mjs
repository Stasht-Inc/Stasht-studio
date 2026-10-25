// Composer toasts never cover the composer's own action buttons: the header's Cancel / Save Draft / Send now on
// wide screens, and the Cancel / Save Draft / Send Now row (and "Send a test to me") on phones. They also sit in
// front of the composer layer (z-index 99999) and inside the screen.

function intersects(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function toastBox(page, text, label, expectVisible) {
  const toast = page.locator('[data-sonner-toast]', { hasText: text });
  await expectVisible(toast, label);
  await page.waitForTimeout(600); // the slide-in transition
  return toast.first();
}

async function boxes(locators) {
  const out = [];
  for (const l of locators) {
    const b = await l.boundingBox();
    if (b) out.push(b);
  }
  return out;
}

async function inFront(page, toast) {
  return toast.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && el.contains(hit) && r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
  });
}

export async function run({ open, shot, expectVisible, expect }) {
  for (const width of [1280, 768]) {
    const { page, context } = await open({ width, height: 900 });
    await page.locator('#nl-name').fill('Toast check');
    const header = page.locator('[aria-labelledby="nl-composer-title"] > header');
    const headerButtons = [
      header.getByRole('button', { name: 'Cancel', exact: true }),
      header.getByRole('button', { name: 'Save Draft', exact: true }),
      header.getByRole('button', { name: 'Send Now', exact: true }),
    ];

    await headerButtons[1].click();
    let toast = await toastBox(page, 'Draft saved.', `draft saved toast at ${width}`, expectVisible);
    let box = await toast.boundingBox();
    const hb = await boxes(headerButtons);
    expect(hb.length === 3, `header buttons measured at ${width}`);
    expect(box && hb.every((b) => !intersects(box, b)), `Draft saved toast clear of the header buttons at ${width}`);
    expect(await inFront(page, toast), `Draft saved toast in front of the composer at ${width}`);

    await page.getByRole('button', { name: 'Send a test to me' }).click();
    toast = await toastBox(page, 'Test sent to samantha@serpachrysler.ca.', `test toast at ${width}`, expectVisible);
    box = await toast.boundingBox();
    const row = await boxes([
      page.getByRole('button', { name: 'Send a test to me' }),
      page.getByRole('button', { name: 'Cancel', exact: true }).last(),
      page.getByRole('button', { name: 'Save Draft', exact: true }).last(),
      page.getByRole('button', { name: 'Send Now', exact: true }).last(),
    ]);
    expect(box && [...hb, ...row].every((b) => !intersects(box, b)), `test toast clear of the header and bottom buttons at ${width}`);
    expect(await inFront(page, toast), `test toast in front of the composer at ${width}`);
    if (width === 1280) await shot(page, '1280-01-test-toast');
    await context.close();
  }

  for (const width of [360, 390]) {
    const { page, context } = await open({ width, height: 844 });
    await page.locator('#nl-name').fill('Toast check');
    await page.locator('#nl-step-recipients').getByRole('checkbox', { name: /Text message/ }).check();
    await page.locator('#nl-sms-text').fill('Winter tire deals this week.');
    const rowButtons = [
      page.getByRole('button', { name: 'Send a test to me' }),
      page.getByRole('button', { name: 'Cancel', exact: true }).last(),
      page.getByRole('button', { name: 'Save Draft', exact: true }).last(),
      page.getByRole('button', { name: 'Send Now', exact: true }).last(),
    ];
    // Bottom of the screen and middle of the screen: the row is in the page flow, so try both.
    for (const where of ['end', 'center']) {
      await rowButtons[3].evaluate((el, block) => el.scrollIntoView({ block }), where);
      await page.waitForTimeout(300);
      await rowButtons[2].click();
      const toast = await toastBox(page, 'Draft saved.', `draft saved toast at ${width} (${where})`, expectVisible);
      const box = await toast.boundingBox();
      const rb = await boxes(rowButtons);
      expect(rb.length === 4, `bottom row measured at ${width}`);
      expect(box && rb.every((b) => !intersects(box, b)), `toast clear of the bottom button row at ${width} (${where})`);
      expect(await inFront(page, toast), `toast in front of the composer at ${width} (${where})`);
      await page.waitForFunction(() => !document.querySelector('[data-sonner-toast]'), null, { timeout: 10000 });
    }
    await rowButtons[0].click();
    const menu = page.getByRole('menuitem', { name: 'Text me a test' });
    if (await menu.count()) await menu.click();
    const toast = await toastBox(page, 'Test sent to', `test toast at ${width}`, expectVisible);
    const box = await toast.boundingBox();
    const rb = await boxes(rowButtons);
    expect(box && rb.every((b) => !intersects(box, b)), `test toast clear of the bottom button row at ${width}`);
    expect(await inFront(page, toast), `test toast in front of the composer at ${width}`);
    if (width === 390) await shot(page, '390-01-test-toast');
    await context.close();
  }
}
