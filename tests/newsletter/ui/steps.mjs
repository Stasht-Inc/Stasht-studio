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

/** A Page, or a Locator on one. */
const asPage = (scope) => (typeof scope.page === 'function' ? scope.page() : scope);

/** 'HH:MM' → "9:30 AM" (the harness runs in en-US). */
export function timeOptionLabel(time) {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * Chris, 16 Nov: Schedule for later uses Studio's Calendar popover (Date) and Select (Time), not native inputs.
 * pickDate opens the Date field and clicks that day (month / year chosen from the calendar's dropdowns).
 */
export async function pickDate(scope, ymd) {
  const page = asPage(scope);
  const [y, mo, d] = ymd.split('-').map(Number);
  await page.locator('#nl-send-date').click();
  const pop = page.locator('[data-slot="popover-content"]').last();
  await pop.waitFor({ state: 'visible' });
  const selects = pop.locator('select');
  if (await selects.count() >= 2) {
    await selects.nth(1).selectOption(String(y));
    await selects.nth(0).selectOption(String(mo - 1));
  }
  await pop.locator('button[name="day"]:not(.day-outside)').getByText(String(d), { exact: true }).click();
  await pop.waitFor({ state: 'hidden' });
}

/** pickTime opens the Time field and picks that time ('HH:MM', 24-hour). */
export async function pickTime(scope, hhmm) {
  const page = asPage(scope);
  await page.locator('#nl-send-time').click();
  await page.getByRole('option', { name: timeOptionLabel(hhmm), exact: true }).click();
}

/** Both, for checks that only need some later time. */
export async function pickSchedule(page, ymd, hhmm) {
  await pickDate(page, ymd);
  await pickTime(page, hhmm);
}

/** 'YYYY-MM-DD' → "Nov 17, 2026", as the Date field shows it. */
export function dateOptionLabel(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(y, m - 1, d));
}
