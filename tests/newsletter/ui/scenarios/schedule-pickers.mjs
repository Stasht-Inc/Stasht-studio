// Chris, 16 Nov (C10): Schedule for later uses Studio's own pickers, not the browser's date / clock popovers.
// Date = Popover + Calendar (as Add a Moment's Date), Time = Studio's Select. Selected is darker gray, never purple.
// The existing checks still hold: at least 5 minutes ahead, the time zone note, and the texts-hours note.
import { pickDate, pickTime, timeOptionLabel, dateOptionLabel } from '../steps.mjs';

const ymd = (t) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
const PURPLE = /rgb\((108, 96, 255|123, 104, 238)/;

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const width of [1280, 390]) {
    const { page, context } = await open({ width, height: width === 390 ? 844 : 1000 });
    const step = page.locator('#nl-step-schedule');
    await step.scrollIntoViewIfNeeded();
    await page.getByRole('radio', { name: 'Schedule for later' }).check();
    expect(await page.locator('input[type="date"], input[type="time"]').count() === 0, `${width}: no native date / time inputs`);
    expect(((await page.locator('#nl-send-date').textContent()) ?? '').includes('Pick a date'), `${width}: Date placeholder`);
    expect(((await page.locator('#nl-send-time').textContent()) ?? '').includes('Pick a time'), `${width}: Time placeholder`);

    // Date: the calendar opens; past days and days past a year are off; picking closes it and shows the day.
    await page.locator('#nl-send-date').click();
    const pop = page.locator('[data-slot="popover-content"]').last();
    await expectVisible(pop, `${width}: calendar open`);
    const yesterday = new Date(Date.now() - 86400000);
    if (yesterday.getMonth() === new Date().getMonth()) {
      const y = pop.locator('button[name="day"]:not(.day-outside)').getByText(String(yesterday.getDate()), { exact: true });
      expect(await y.isDisabled(), `${width}: yesterday cannot be picked`);
    }
    const todayBtn = pop.locator('button[name="day"]:not(.day-outside)').getByText(String(new Date().getDate()), { exact: true });
    const todayStyle = await todayBtn.evaluate((el) => getComputedStyle(el).borderColor + ' ' + getComputedStyle(el).color);
    expect(!PURPLE.test(todayStyle), `${width}: today is gray (${todayStyle})`);
    expect(!(await hasOverflow(page)), `${width}: no sideways scroll with the calendar open`);
    await page.waitForTimeout(400); // open animation
    await shot(page, `${width}-01-calendar`);
    await page.keyboard.press('Escape');
    const tomorrow = ymd(new Date(Date.now() + 86400000));
    await pickDate(page, tomorrow);
    expect(((await page.locator('#nl-send-date').textContent()) ?? '').includes(dateOptionLabel(tomorrow)), `${width}: picked day shown`);
    // Reopen: the picked day is darker gray.
    await page.locator('#nl-send-date').click();
    const sel = page.locator('[data-slot="popover-content"]').last().locator('button[name="day"][aria-selected="true"]');
    const selBg = await sel.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(selBg === 'rgb(31, 41, 55)', `${width}: selected day is gray-800 (got ${selBg})`);
    await page.waitForTimeout(400); // open animation
    await shot(page, `${width}-02-calendar-selected`);
    await page.keyboard.press('Escape');

    // Time: Studio's Select list, labelled 9:30 AM, every 15 minutes; the picked time is shown.
    await page.locator('#nl-send-time').click();
    const list = page.getByRole('listbox');
    await expectVisible(list, `${width}: time list open`);
    expect(await list.getByRole('option').count() === 96, `${width}: 96 times (every 15 minutes)`);
    const z = await list.evaluate((el) => Number(getComputedStyle(el.closest('[data-slot="select-content"]') ?? el).zIndex));
    expect(z >= 100005, `${width}: time list above the composer (z ${z})`);
    await page.waitForTimeout(400); // open animation
    await shot(page, `${width}-03-time-list`);
    await page.keyboard.press('Escape');
    await pickTime(page, '09:30');
    expect(((await page.locator('#nl-send-time').textContent()) ?? '').trim() === timeOptionLabel('09:30'), `${width}: picked time shown`);
    await page.locator('#nl-send-time').click();
    const checked = page.getByRole('option', { name: '9:30 AM', exact: true });
    const cs = await checked.evaluate((el) => getComputedStyle(el).backgroundColor + ' ' + getComputedStyle(el).color);
    expect(!PURPLE.test(cs), `${width}: picked time is gray (${cs})`);
    await page.waitForTimeout(400); // open animation
    await shot(page, `${width}-04-time-selected`);
    await page.keyboard.press('Escape');
    await expectVisible(step.getByText(/Times are in your time zone/), `${width}: time zone note`);
    await expectVisible(page.getByRole('button', { name: 'Schedule', exact: true }).last(), `${width}: Schedule button`);
    await step.scrollIntoViewIfNeeded();
    await shot(step, `${width}-05-picked`);

    // Too soon: today at 00:00 is refused with the existing message, marked on Time.
    await pickDate(page, ymd(new Date()));
    await pickTime(page, '00:00');
    await page.getByRole('button', { name: 'Schedule', exact: true }).last().click();
    await page.waitForTimeout(800);
    await expectVisible(step.getByText('Pick a time at least 5 minutes from now.'), `${width}: 5-minute rule kept`);
    expect(await page.locator('#nl-send-time').getAttribute('aria-invalid') === 'true', `${width}: Time marked`);
    await step.scrollIntoViewIfNeeded();
    await shot(step, `${width}-06-too-soon`);
    expect(!(await hasOverflow(page)), `${width}: no sideways scroll`);
    await context.close();
  }
}
