// Shared composer steps for the screenshot checks.

/**
 * A new newsletter starts on Single person (Chris, 3 Nov 2026). Checks written for the old default (All leads) tick it
 * first: Send to → All leads, then close the menu.
 */
export async function sendToAllLeads(page) {
  const step = page.locator('#nl-step-recipients');
  await step.getByRole('button', { name: /^Send to/ }).click();
  await page.getByRole('dialog', { name: 'Send to' }).getByRole('checkbox', { name: /All leads/ }).check();
  await page.keyboard.press('Escape');
}
